(() => {
  'use strict';
  window.EARTH_3D_UI_PROFILE = '21.9.244-inline-viewer';

  const status = document.getElementById('earthStatus');
  const coordinatesInput = document.getElementById('earthCoordinates');
  const setStatus = (message, type = '') => {
    if (!status) return;
    status.textContent = message;
    status.className = `earth-status ${type}`.trim();
  };

  if (!window.Cesium) {
    setStatus('CesiumJS não carregou. Verifique bloqueadores de conteúdo e recarregue.', 'error');
    return;
  }

  Cesium.Ion.defaultAccessToken = '';

  const imageryProviders = {
    satellite: () => new Cesium.UrlTemplateImageryProvider({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      credit: 'Esri World Imagery',
      maximumLevel: 19
    }),
    streets: () => new Cesium.UrlTemplateImageryProvider({
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      credit: '© OpenStreetMap contributors',
      minimumLevel: 0,
      maximumLevel: 19
    }),
    terrain: () => new Cesium.UrlTemplateImageryProvider({
      url: 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
      credit: '© OpenTopoMap contributors',
      minimumLevel: 0,
      maximumLevel: 17
    })
  };

  const viewer = new Cesium.Viewer('cesiumContainer', {
    baseLayer: new Cesium.ImageryLayer(imageryProviders.satellite()),
    terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    animation: false,
    timeline: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: true,
    baseLayerPicker: false,
    navigationHelpButton: true,
    fullscreenButton: true,
    infoBox: true,
    selectionIndicator: true,
    shadows: false,
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity
  });

  viewer.scene.globe.show = true;
  viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#cbd5e1');
  viewer.scene.backgroundColor = Cesium.Color.BLACK;
  viewer.scene.skyAtmosphere.show = true;
  viewer.scene.fog.enabled = true;
  if ('showGroundAtmosphere' in viewer.scene.globe) viewer.scene.globe.showGroundAtmosphere = true;
  viewer.scene.globe.enableLighting = false;
  viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;

  let atmosphereVisible = true;
  let cloudsHidden = false;
  let cloudReductionStage = null;
  let pendingPayload = null;
  let activeDataSources = [];
  let activeWmsLayers = [];
  let baseImageryLayer = viewer.imageryLayers.get(0);
  let lastBasemapKey = 'satellite';

  function parseCoordinates(value) {
    const parts = String(value || '').match(/-?\d+(?:[.,]\d+)?/g);
    if (!parts || parts.length < 2) return null;
    const lat = Number(parts[0].replace(',', '.'));
    const lng = Number(parts[1].replace(',', '.'));
    return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
  }

  function fly(lat, lng, height = 6500) {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lng, lat, height),
      duration: 1.35
    });
  }

  function normalizeCollection(value) {
    const source = value?.geojson || value;
    if (!source) return null;
    if (source.type === 'FeatureCollection') return source;
    if (source.type === 'Feature') return { type: 'FeatureCollection', features: [source] };
    if (Array.isArray(source.features)) return { type: 'FeatureCollection', features: source.features };
    return null;
  }

  function getSharedProject() {
    try {
      // Handoff temporário do mapa para o Earth 3D. A carga atual pertence à
      // sessão/aba e não deve permanecer no navegador como dado oficial.
      const transient = sessionStorage.getItem('georuralEarthProject');
      if (transient) {
        sessionStorage.removeItem('georuralEarthProject');
        const data = JSON.parse(transient);
        const geojson = normalizeCollection(data?.project || data?.geojson || data);
        if (geojson) return { project: { geojson, name: data?.name || data?.title || 'Projeto salvo' }, references: [] };
      }
      // A versão 1.0 não usa mais armazenamento persistente do navegador para
      // transportar projetos. Chaves históricas são apenas limpas; a fonte
      // oficial continua sendo o projeto salvo no backend.
      ['georuralEarthProject', 'georuralCurrentProject', 'currentProject', 'georuralProject']
        .forEach((key) => { try { localStorage.removeItem(key); } catch {} });
    } catch (error) {
      console.warn('[Earth 3D] projeto local indisponível:', error);
    }
    return null;
  }

  function setBaseMap(key = 'satellite') {
    lastBasemapKey = key;
    const providerFactory = imageryProviders[key] || imageryProviders.satellite;
    try {
      if (baseImageryLayer && viewer.imageryLayers.contains(baseImageryLayer)) viewer.imageryLayers.remove(baseImageryLayer, true);
    } catch {}
    baseImageryLayer = new Cesium.ImageryLayer(providerFactory());
    viewer.imageryLayers.add(baseImageryLayer, 0);
    refreshCloudReductionForBasemap();
    viewer.scene.requestRender?.();
  }

  function addWmsLayer(layerConfig) {
    if (!layerConfig?.serviceUrl || !layerConfig?.layerName) return null;
    try {
      const parameters = {
        transparent: 'true',
        format: 'image/png',
        ...(layerConfig.parameters || {})
      };
      delete parameters.layers;
      const provider = new Cesium.WebMapServiceImageryProvider({
        url: layerConfig.serviceUrl,
        layers: layerConfig.layerName,
        parameters,
        credit: layerConfig.name || 'WMS GeoRural',
        enablePickFeatures: false
      });
      const imageryLayer = viewer.imageryLayers.addImageryProvider(provider);
      // Camadas oficiais precisam aparecer fortes sobre satélite.
      imageryLayer.alpha = Math.max(0.82, Math.min(1, Number(layerConfig.opacity || 0.95)));
      imageryLayer.brightness = 1.08;
      imageryLayer.contrast = 1.18;
      imageryLayer.name = layerConfig.name || layerConfig.layerName;
      activeWmsLayers.push(imageryLayer);
      return imageryLayer;
    } catch (error) {
      console.warn('[Earth 3D] WMS ignorado:', layerConfig?.name || layerConfig?.layerName, error);
      return null;
    }
  }

  async function addGeoJsonSource(geojson, options = {}) {
    const collection = normalizeCollection(geojson);
    if (!collection || !Array.isArray(collection.features) || !collection.features.length) return null;

    const color = options.color || Cesium.Color.RED;
    const source = await Cesium.GeoJsonDataSource.load(collection, {
      clampToGround: true,
      stroke: color,
      fill: color.withAlpha(options.alpha ?? 0.22),
      strokeWidth: options.strokeWidth || 3,
      markerColor: options.markerColor || color
    });

    source.name = options.name || 'Camada GeoRural';
    viewer.dataSources.add(source);
    activeDataSources.push(source);
    return source;
  }

  async function loadPayload(payload, flyToProject = true) {
    const data = payload || pendingPayload || getSharedProject();
    if (!data) return false;

    pendingPayload = data;
    activeDataSources.forEach((ds) => viewer.dataSources.remove(ds, true));
    activeDataSources = [];
    activeWmsLayers.forEach((layer) => { try { viewer.imageryLayers.remove(layer, true); } catch {} });
    activeWmsLayers = [];

    let primarySource = null;
    const projectGeojson = normalizeCollection(data.project?.geojson || data.project || data.geojson);
    if (projectGeojson) {
      primarySource = await addGeoJsonSource(projectGeojson, {
        name: data.project?.name || data.project?.title || 'Imóvel do projeto',
        color: Cesium.Color.fromCssColorString('#ef4444'),
        markerColor: Cesium.Color.fromCssColorString('#f97316'),
        alpha: 0.34,
        strokeWidth: 5
      });
    }

    const wmsLayers = Array.isArray(data.wmsLayers) ? data.wmsLayers : [];
    wmsLayers.forEach(addWmsLayer);

    const references = Array.isArray(data.references) ? data.references : [];
    for (const reference of references) {
      const referenceGeojson = normalizeCollection(reference.geojson || reference);
      if (!referenceGeojson?.features?.length) continue;
      await addGeoJsonSource(referenceGeojson, {
        name: reference.name || 'Camada importada',
        color: Cesium.Color.fromCssColorString(reference.color || '#facc15'),
        markerColor: Cesium.Color.fromCssColorString(reference.color || '#facc15'),
        alpha: 0.32,
        strokeWidth: 3.5
      });
    }

    if (flyToProject && primarySource) {
      await viewer.flyTo(primarySource, { duration: 1.3, offset: new Cesium.HeadingPitchRange(0, -0.75, 0) });
    } else if (data.center?.lat && data.center?.lng) {
      fly(Number(data.center.lat), Number(data.center.lng), 9000);
    }

    const total = activeDataSources.length;
    const wmsTotal = activeWmsLayers.length;
    setStatus(wmsTotal || total > 1
      ? `Globo 3D carregado com imóvel, ${Math.max(0, total - 1)} camada(s) vetorial(is) e ${wmsTotal} WMS.`
      : 'Globo 3D carregado com o imóvel do projeto.', 'ok');
    viewer.scene.requestRender?.();
    return true;
  }

  function ensureCloudReductionStage() {
    if (cloudReductionStage) return cloudReductionStage;
    cloudReductionStage = viewer.scene.postProcessStages.add(new Cesium.PostProcessStage({
      name: 'georural-cloud-reduction',
      fragmentShader: `
        uniform sampler2D colorTexture;
        in vec2 v_textureCoordinates;
        void main() {
          vec4 color = texture(colorTexture, v_textureCoordinates);
          float maxc = max(max(color.r, color.g), color.b);
          float minc = min(min(color.r, color.g), color.b);
          float saturation = maxc - minc;
          float brightness = (color.r + color.g + color.b) / 3.0;
          float cloudMask = smoothstep(0.80, 0.98, brightness) * (1.0 - smoothstep(0.02, 0.18, saturation));
          vec3 terrainTone = vec3(0.56, 0.61, 0.47);
          vec3 cleaned = mix(color.rgb, terrainTone, cloudMask * 0.82);
          out_FragColor = vec4(cleaned, color.a);
        }
      `
    }));
    cloudReductionStage.enabled = false;
    return cloudReductionStage;
  }

  function setCloudReduction(enabled) {
    cloudsHidden = Boolean(enabled);
    const stage = ensureCloudReductionStage();
    stage.enabled = cloudsHidden && lastBasemapKey === 'satellite';
    const button = document.getElementById('earthClouds');
    if (button) {
      button.setAttribute('aria-pressed', String(cloudsHidden));
      button.textContent = cloudsHidden ? 'Mostrar nuvens' : 'Remover nuvens';
      button.title = cloudsHidden
        ? 'Desativa o filtro de nuvens e restaura a imagem original de satélite.'
        : 'Ativa um filtro experimental para atenuar nuvens claras da imagem de satélite, sem trocar o mapa-base.';
    }
    if (cloudsHidden && lastBasemapKey !== 'satellite') {
      setStatus('Filtro de nuvens ativado, mas ele só atua na visualização por satélite.', 'warn');
    } else {
      setStatus(cloudsHidden
        ? 'Filtro experimental de nuvens ativado sem trocar o mapa-base.'
        : 'Filtro de nuvens desativado. A imagem original foi restaurada.', cloudsHidden ? 'warn' : 'ok');
    }
    viewer.scene.requestRender?.();
  }

  function refreshCloudReductionForBasemap() {
    if (!cloudReductionStage) return;
    cloudReductionStage.enabled = cloudsHidden && lastBasemapKey === 'satellite';
    viewer.scene.requestRender?.();
  }

  // ---------------------------------------------------------------------------
  // Ferramentas de desenho nativas no Earth 3D
  // ---------------------------------------------------------------------------
  const drawSource = new Cesium.CustomDataSource('Desenhos Earth 3D');
  viewer.dataSources.add(drawSource);
  const drawHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  try { viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK); } catch {}

  let drawMode = 'select';
  let drawPositions = [];
  let hoverPosition = null;
  let previewEntity = null;
  let pointCounter = 1;
  let shapeCounter = 1;
  let activeVertexEntities = [];
  let lastDrawClickAt = 0;
  let lastDrawClickPosition = null;
  const drawRecords = [];

  const drawColor = Cesium.Color.fromCssColorString('#00d4ff');
  const drawFill = Cesium.Color.fromCssColorString('#22d3ee').withAlpha(0.48);
  const drawOutline = Cesium.Color.fromCssColorString('#f8fafc');
  const markerColor = Cesium.Color.fromCssColorString('#f97316');
  const vertexColor = Cesium.Color.fromCssColorString('#ffff00');

  function earthPointFromScreen(screenPosition) {
    if (!screenPosition) return null;
    const ray = viewer.camera.getPickRay(screenPosition);
    const cartesian = ray ? viewer.scene.globe.pick(ray, viewer.scene) : null;
    if (!Cesium.defined(cartesian)) return null;
    const cart = Cesium.Cartographic.fromCartesian(cartesian);
    const lat = Cesium.Math.toDegrees(cart.latitude);
    const lng = Cesium.Math.toDegrees(cart.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    // Mantém os desenhos levemente acima do solo para evitar piscar/sumir atrás da imagem 3D.
    return Cesium.Cartesian3.fromDegrees(lng, lat, 1.2);
  }

  function cartesianToCoord(position) {
    const cart = Cesium.Cartographic.fromCartesian(position);
    return {
      lat: Cesium.Math.toDegrees(cart.latitude),
      lng: Cesium.Math.toDegrees(cart.longitude),
      height: Number(cart.height || 0)
    };
  }

  function coordLine(position, index = null) {
    const c = cartesianToCoord(position);
    const prefix = index === null ? '' : `V-${String(index + 1).padStart(2, '0')}: `;
    return `${prefix}${c.lat.toFixed(7)}, ${c.lng.toFixed(7)}`;
  }

  function coordsFromPositions(positions) {
    return positions.map((position) => {
      const c = cartesianToCoord(position);
      return [Number(c.lng.toFixed(8)), Number(c.lat.toFixed(8))];
    });
  }

  function distanceMeters(a, b) {
    const ca = Cesium.Cartographic.fromCartesian(a);
    const cb = Cesium.Cartographic.fromCartesian(b);
    const geodesic = new Cesium.EllipsoidGeodesic(ca, cb);
    return Number(geodesic.surfaceDistance || 0);
  }

  function lengthMeters(positions) {
    let total = 0;
    for (let i = 1; i < positions.length; i += 1) total += distanceMeters(positions[i - 1], positions[i]);
    return total;
  }

  function approximateAreaMeters(positions) {
    if (positions.length < 3) return 0;
    const radius = 6378137;
    const coords = positions.map((position) => {
      const c = Cesium.Cartographic.fromCartesian(position);
      return { lat: c.latitude, lng: c.longitude };
    });
    let area = 0;
    for (let i = 0; i < coords.length; i += 1) {
      const a = coords[i];
      const b = coords[(i + 1) % coords.length];
      area += (b.lng - a.lng) * (2 + Math.sin(a.lat) + Math.sin(b.lat));
    }
    return Math.abs(area * radius * radius / 2);
  }

  function formatMeters(value) {
    return `${Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m`;
  }

  function formatArea(value) {
    const hectares = value / 10000;
    return `${hectares.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} ha (${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m²)`;
  }

  function updateDrawCoordinatesPanel(message = '') {
    const output = document.getElementById('earthDrawCoords');
    if (!output) return;
    const current = drawPositions.map((position, index) => coordLine(position, index));
    const saved = drawRecords.slice(-4).map((record) => `${record.label}: ${record.summary}`);
    const lines = [];
    if (message) lines.push(message);
    if (current.length) {
      lines.push('Desenho atual:');
      lines.push(...current);
      if (hoverPosition) lines.push(`Mouse: ${coordLine(hoverPosition)}`);
    }
    if (saved.length) {
      if (lines.length) lines.push('');
      lines.push('Últimos desenhos:');
      lines.push(...saved);
    }
    output.textContent = lines.join('\n') || 'Selecione Marcação, Linha, Polígono ou Círculo e clique no terreno.';
  }

  function recordFeature(type, positions, properties = {}) {
    const coords = coordsFromPositions(positions);
    let geometry = null;
    if (type === 'Point') geometry = { type, coordinates: coords[0] };
    if (type === 'LineString') geometry = { type, coordinates: coords };
    if (type === 'Polygon') geometry = { type, coordinates: [[...coords, coords[0]]] };
    if (!geometry) return;
    drawRecords.push({
      label: properties.label || `${type} ${drawRecords.length + 1}`,
      summary: properties.summary || `${positions.length} ponto(s)`,
      geometry,
      properties: { ...properties, createdAt: new Date().toISOString() }
    });
    updateDrawCoordinatesPanel();
  }

  function drawRecordsToGeoJson() {
    return {
      type: 'FeatureCollection',
      name: 'desenhos-earth-3d-georural',
      features: drawRecords.map((record) => ({
        type: 'Feature',
        properties: record.properties,
        geometry: record.geometry
      }))
    };
  }

  function clearPreview() {
    if (previewEntity) {
      drawSource.entities.remove(previewEntity);
      previewEntity = null;
    }
  }

  function clearUnfinishedVertexMarkers() {
    activeVertexEntities.forEach((entity) => { try { drawSource.entities.remove(entity); } catch {} });
    activeVertexEntities = [];
  }

  function resetCurrentDrawing({ removeMarkers = false } = {}) {
    clearPreview();
    if (removeMarkers) clearUnfinishedVertexMarkers();
    drawPositions = [];
    hoverPosition = null;
    updateDrawCoordinatesPanel();
  }

  function previewPath(close = false) {
    const positions = [...drawPositions];
    if (hoverPosition) positions.push(hoverPosition);
    if (close && positions.length >= 3) positions.push(positions[0]);
    return positions;
  }

  function rebuildPreview() {
    clearPreview();
    if (!['line', 'polygon'].includes(drawMode)) return;
    const open = previewPath(false);
    if (open.length < 2) return;
    if (drawMode === 'line') {
      previewEntity = drawSource.entities.add({
        name: 'Prévia da linha',
        polyline: { positions: open, width: 6, material: Cesium.Color.YELLOW, depthFailMaterial: Cesium.Color.YELLOW.withAlpha(0.65), clampToGround: false }
      });
      return;
    }
    const closed = previewPath(true);
    previewEntity = drawSource.entities.add({
      name: 'Prévia do polígono',
      polygon: open.length >= 3 ? { hierarchy: new Cesium.PolygonHierarchy(open), material: Cesium.Color.YELLOW.withAlpha(0.34), outline: true, outlineColor: Cesium.Color.YELLOW, height: 1.2 } : undefined,
      polyline: { positions: open.length >= 3 ? closed : open, width: 6, material: Cesium.Color.YELLOW, depthFailMaterial: Cesium.Color.YELLOW.withAlpha(0.65), clampToGround: false }
    });
  }

  function finishCurrentDrawing(silent = false) {
    clearPreview();
    const positions = [...drawPositions];
    if (drawMode === 'line' && positions.length >= 2) {
      const total = lengthMeters(positions);
      drawSource.entities.add({
        name: 'Linha desenhada no Earth 3D',
        polyline: { positions, width: 6, material: drawColor, depthFailMaterial: drawColor.withAlpha(0.72), clampToGround: false },
        description: `<b>Linha</b><br>Comprimento: ${formatMeters(total)}<br><pre>${positions.map((p, i) => coordLine(p, i)).join('\n')}</pre>`
      });
      recordFeature('LineString', positions, { label: `Linha ${shapeCounter++}`, summary: `${formatMeters(total)} • ${positions.length} vértices`, lengthMeters: total });
      if (!silent) setStatus(`Linha concluída com ${positions.length} vértices e ${formatMeters(total)}.`, 'ok');
    } else if (drawMode === 'polygon' && positions.length >= 3) {
      const perimeter = lengthMeters([...positions, positions[0]]);
      const area = approximateAreaMeters(positions);
      drawSource.entities.add({
        name: 'Polígono desenhado no Earth 3D',
        polygon: { hierarchy: new Cesium.PolygonHierarchy(positions), material: drawFill, outline: true, outlineColor: drawOutline, height: 1.2 },
        polyline: { positions: [...positions, positions[0]], width: 6, material: drawColor, depthFailMaterial: drawColor.withAlpha(0.72), clampToGround: false },
        description: `<b>Polígono</b><br>Área aproximada: ${formatArea(area)}<br>Perímetro: ${formatMeters(perimeter)}<br><pre>${positions.map((p, i) => coordLine(p, i)).join('\n')}</pre>`
      });
      recordFeature('Polygon', positions, { label: `Polígono ${shapeCounter++}`, summary: `${formatArea(area)} • ${positions.length} vértices`, areaMeters2: area, perimeterMeters: perimeter });
      if (!silent) setStatus(`Polígono concluído com área aproximada de ${formatArea(area)}.`, 'ok');
    } else if (!silent && drawMode !== 'select') {
      setStatus('Adicione mais vértices antes de finalizar o desenho.', 'warn');
      rebuildPreview();
      return;
    }
    activeVertexEntities = [];
    drawPositions = [];
    hoverPosition = null;
    updateDrawCoordinatesPanel();
    viewer.scene.requestRender?.();
  }

  function setDrawMode(mode = 'select') {
    if (drawMode === 'line' || drawMode === 'polygon') finishCurrentDrawing(true);
    if (drawPositions.length) resetCurrentDrawing({ removeMarkers: true });
    drawMode = mode;
    document.body.classList.toggle('earth-drawing-active', drawMode !== 'select');
    document.querySelectorAll('[data-earth-draw]').forEach((btn) => btn.classList.toggle('active', btn.dataset.earthDraw === mode));
    const hint = document.getElementById('earthDrawHint');
    if (hint) {
      const hints = {
        select: 'Selecionar desenhos prontos para ver dados e coordenadas.',
        point: 'Clique no globo para criar uma marcação com coordenada.',
        line: 'Clique para adicionar vértices. A prévia acompanha o mouse. Finalize no botão, duplo clique ou botão direito.',
        polygon: 'Clique para adicionar vértices. A prévia acompanha o mouse. Finalize no botão, duplo clique ou botão direito.',
        circle: '1º clique define o centro; 2º clique define o raio do círculo.'
      };
      hint.textContent = hints[mode] || hints.select;
    }
    setStatus(mode === 'select' ? 'Ferramenta de seleção ativada no Earth 3D.' : `Ferramenta ${mode === 'point' ? 'marcação' : mode === 'line' ? 'linha' : mode === 'polygon' ? 'polígono' : 'círculo'} ativada no Earth 3D.`, 'ok');
  }

  function addVertexMarker(position, labelText = null) {
    const label = labelText || `V-${String(drawPositions.length).padStart(2, '0')}`;
    const entity = drawSource.entities.add({
      name: `Vértice ${label}`,
      position,
      point: { pixelSize: 11, color: vertexColor, outlineColor: Cesium.Color.BLACK, outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY },
      label: { text: label, font: '700 12px Inter,Arial', fillColor: Cesium.Color.YELLOW, outlineColor: Cesium.Color.BLACK, outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(0, -18), disableDepthTestDistance: Number.POSITIVE_INFINITY },
      description: `<b>${label}</b><br>${coordLine(position)}`
    });
    activeVertexEntities.push(entity);
  }

  function addPointMarker(position) {
    const latLng = coordLine(position);
    const label = `P-${String(pointCounter++).padStart(2, '0')}`;
    drawSource.entities.add({
      name: `Marcação ${label}`,
      position,
      point: { pixelSize: 15, color: markerColor, outlineColor: Cesium.Color.WHITE, outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY },
      label: { text: label, font: '700 13px Inter,Arial', fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(0, -24), disableDepthTestDistance: Number.POSITIVE_INFINITY },
      description: `<b>${label}</b><br>Coordenada: ${latLng}`
    });
    recordFeature('Point', [position], { label, summary: latLng });
    setStatus(`Marcação ${label} criada: ${latLng}.`, 'ok');
  }

  function addCircle(center, edge) {
    const radius = Math.max(1, distanceMeters(center, edge));
    const label = `Círculo ${shapeCounter++}`;
    drawSource.entities.add({
      name: 'Círculo desenhado no Earth 3D',
      position: center,
      ellipse: {
        semiMajorAxis: radius,
        semiMinorAxis: radius,
        material: Cesium.Color.fromCssColorString('#8b5cf6').withAlpha(0.32),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString('#f8fafc'),
        height: 1.2
      },
      description: `<b>${label}</b><br>Centro: ${coordLine(center)}<br>Raio aproximado: ${formatMeters(radius)}`
    });
    recordFeature('Point', [center], { label, summary: `Centro ${coordLine(center)} • raio ${formatMeters(radius)}`, radiusMeters: radius, kind: 'circle-center' });
    setStatus(`${label} criado com raio aproximado de ${formatMeters(radius)}.`, 'ok');
    viewer.scene.requestRender?.();
  }

  drawHandler.setInputAction((movement) => {
    const position = earthPointFromScreen(movement.position);
    if (!position || drawMode === 'select') return;
    const now = Date.now();
    if (lastDrawClickPosition && now - lastDrawClickAt < 260 && distanceMeters(lastDrawClickPosition, position) < 1.5) return;
    lastDrawClickAt = now;
    lastDrawClickPosition = position;
    if (drawMode === 'point') { addPointMarker(position); updateDrawCoordinatesPanel('Marcação salva.'); return; }
    if (drawMode === 'circle') {
      drawPositions.push(position);
      addVertexMarker(position, drawPositions.length === 1 ? 'Centro' : 'Raio');
      if (drawPositions.length === 1) {
        setStatus(`Centro do círculo definido em ${coordLine(position)}. Clique no limite para definir o raio.`, 'ok');
        updateDrawCoordinatesPanel('Centro do círculo definido.');
      } else {
        addCircle(drawPositions[0], drawPositions[1]);
        activeVertexEntities = [];
        drawPositions = [];
        hoverPosition = null;
        updateDrawCoordinatesPanel();
      }
      return;
    }
    drawPositions.push(position);
    addVertexMarker(position);
    rebuildPreview();
    updateDrawCoordinatesPanel(`${drawMode === 'line' ? 'Linha' : 'Polígono'} em edição.`);
    setStatus(`${drawMode === 'line' ? 'Linha' : 'Polígono'}: ${drawPositions.length} vértice(s). Coordenada: ${coordLine(position)}.`, 'ok');
    viewer.scene.requestRender?.();
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  drawHandler.setInputAction((movement) => {
    if (!['line', 'polygon'].includes(drawMode) || !drawPositions.length) return;
    hoverPosition = earthPointFromScreen(movement.endPosition);
    rebuildPreview();
    updateDrawCoordinatesPanel();
    viewer.scene.requestRender?.();
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  drawHandler.setInputAction(() => {
    if (drawMode === 'line' || drawMode === 'polygon') finishCurrentDrawing(false);
    lastDrawClickAt = 0;
    lastDrawClickPosition = null;
  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

  drawHandler.setInputAction(() => {
    if (drawMode === 'line' || drawMode === 'polygon') finishCurrentDrawing(false);
    lastDrawClickAt = 0;
    lastDrawClickPosition = null;
  }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

  document.querySelectorAll('[data-earth-draw]').forEach((button) => {
    button.addEventListener('click', () => setDrawMode(button.dataset.earthDraw || 'select'));
  });
  document.getElementById('earthFinishDraw')?.addEventListener('click', () => finishCurrentDrawing(false));
  document.getElementById('earthCopyDrawCoords')?.addEventListener('click', async () => {
    const text = document.getElementById('earthDrawCoords')?.textContent || '';
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Coordenadas copiadas.', 'ok');
    } catch {
      setStatus('Não consegui copiar automaticamente. Selecione o texto das coordenadas e copie manualmente.', 'warn');
    }
  });
  document.getElementById('earthExportGeojson')?.addEventListener('click', () => {
    if (!drawRecords.length) return setStatus('Nenhum desenho salvo para exportar.', 'warn');
    const blob = new Blob([JSON.stringify(drawRecordsToGeoJson(), null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `desenhos-earth-3d-${new Date().toISOString().slice(0, 10)}.geojson`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 800);
    setStatus('GeoJSON dos desenhos exportado.', 'ok');
  });
  document.getElementById('earthClearDrawings')?.addEventListener('click', () => {
    drawSource.entities.removeAll();
    drawPositions = [];
    hoverPosition = null;
    previewEntity = null;
    activeVertexEntities = [];
    drawRecords.splice(0, drawRecords.length);
    pointCounter = 1;
    shapeCounter = 1;
    setDrawMode('select');
    updateDrawCoordinatesPanel();
    setStatus('Desenhos do Earth 3D foram limpos.', 'ok');
    viewer.scene.requestRender?.();
  });

  function setAtmosphere(visible) {
    atmosphereVisible = Boolean(visible);
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = atmosphereVisible;
    if (viewer.scene.sun) viewer.scene.sun.show = atmosphereVisible;
    if (viewer.scene.moon) viewer.scene.moon.show = atmosphereVisible;
    if (viewer.scene.skyBox) viewer.scene.skyBox.show = atmosphereVisible;
    viewer.scene.fog.enabled = atmosphereVisible;
    if ('showGroundAtmosphere' in viewer.scene.globe) viewer.scene.globe.showGroundAtmosphere = atmosphereVisible;
    const button = document.getElementById('earthAtmosphere');
    if (button) {
      button.setAttribute('aria-pressed', String(!atmosphereVisible));
      button.textContent = atmosphereVisible ? 'Remover atmosfera' : 'Mostrar atmosfera';
      button.title = atmosphereVisible
        ? 'Oculta somente a atmosfera/névoa do globo, sem trocar o mapa-base.'
        : 'Restaura a atmosfera/névoa do globo.';
    }
    setStatus(atmosphereVisible
      ? 'Atmosfera visual ativada.'
      : 'Atmosfera e névoa visuais removidas. O mapa-base atual foi preservado.', atmosphereVisible ? 'ok' : 'warn');
    viewer.scene.requestRender?.();
  }

  document.getElementById('earthLocate')?.addEventListener('click', () => {
    const c = parseCoordinates(coordinatesInput.value);
    if (!c) return setStatus('Digite latitude e longitude válidas.', 'error');
    fly(c.lat, c.lng, 5000);
    setStatus(`Localizando ${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}.`, 'ok');
  });

  document.getElementById('earthFit')?.addEventListener('click', async () => {
    try {
      if (!(await loadPayload(pendingPayload, true))) {
        setStatus('Nenhum imóvel foi enviado pelo mapa. Abra um projeto e clique novamente em Earth 3D.', 'error');
      }
    } catch (error) {
      console.error(error);
      setStatus('Não foi possível enquadrar as camadas no globo 3D.', 'error');
    }
  });

  document.getElementById('earthHome')?.addEventListener('click', () => viewer.camera.flyHome(1.5));
  document.getElementById('earthAtmosphere')?.addEventListener('click', () => setAtmosphere(!atmosphereVisible));
  document.getElementById('earthClouds')?.addEventListener('click', () => setCloudReduction(!cloudsHidden));

  document.getElementById('earthBasemap')?.addEventListener('change', (event) => {
    const key = event.target.value;
    setBaseMap(key);
    setStatus(key === 'satellite' ? 'Visualização por satélite ativada.' : key === 'terrain' ? 'Mapa topográfico limpo ativado.' : 'Mapa vetorial ativado.', 'ok');
  });

  document.getElementById('earthMyLocation')?.addEventListener('click', () => {
    if (!navigator.geolocation) return setStatus('Geolocalização não disponível neste navegador.', 'error');
    const button = document.getElementById('earthMyLocation');
    button.disabled = true;
    button.textContent = 'Localizando…';
    navigator.geolocation.getCurrentPosition((position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      coordinatesInput.value = `${lat.toFixed(7)}, ${lng.toFixed(7)}`;
      fly(lat, lng, 3500);
      setStatus('Localização atual aberta no globo 3D.', 'ok');
      button.disabled = false;
      button.textContent = 'Minha localização';
    }, (error) => {
      setStatus(error.code === 1 ? 'Permissão de localização negada.' : 'Não foi possível obter a localização atual.', 'error');
      button.disabled = false;
      button.textContent = 'Minha localização';
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  });

  window.addEventListener('message', async (event) => {
    const sameOrigin = event.origin === window.location.origin || event.origin === 'null' || window.location.origin === 'null';
    if (!sameOrigin || event.data?.type !== 'georural:earth-data') return;
    try {
      pendingPayload = event.data.payload;
      await loadPayload(pendingPayload, false);
    } catch (error) {
      console.error(error);
      setStatus('Recebi as camadas do mapa, mas não consegui desenhá-las no globo 3D.', 'error');
    }
  });

  const params = new URLSearchParams(location.search);
  if (params.get('embedded') === '1') {
    document.body.classList.add('embedded');
    document.getElementById('earthBack')?.remove();
    const brand = document.querySelector('.earth-brand');
    if (brand) { brand.removeAttribute('href'); brand.setAttribute('role', 'presentation'); }
    window.parent?.postMessage?.({ type: 'georural:earth-ready' }, '*');
  }

  const lat = Number(params.get('lat'));
  const lng = Number(params.get('lng'));
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    coordinatesInput.value = `${lat}, ${lng}`;
    fly(lat, lng, 9000);
  } else {
    viewer.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(-41.5, -13.2, 9500000) });
  }

  loadPayload(null, true).then((found) => {
    if (!found) setStatus('Globo 3D gratuito carregado. Use Localizar ou abra um imóvel pelo mapa.', 'ok');
  });
  setTimeout(() => viewer.resize(), 250);
  window.addEventListener('resize', () => viewer.resize());
})();