(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const R = 6378137;
  const palette = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#84cc16', '#f97316', '#be123c', '#0f766e', '#4f46e5', '#a16207'];
  let projects = [];
  let selectedProject = null;
  let resultGeojson = null;
  let resultStats = [];

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }
  function toast(message, kind = 'success') {
    const host = $('suiteToast');
    if (!host) return alert(message);
    host.textContent = message;
    host.classList.add('show', kind === 'error' ? 'error' : 'success');
    setTimeout(() => host.classList.remove('show', 'error', 'success'), 3800);
  }
  function num(value, digits = 2) {
    return Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  function download(name, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function slug(value) {
    return String(value || 'glebas').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'glebas';
  }

  function normalizeFeature(input) {
    if (!input) throw new Error('Informe um polígono.');
    let feature = input;
    if (typeof input === 'string') feature = JSON.parse(input);
    if (feature.type === 'FeatureCollection') {
      feature = (feature.features || []).find((item) => /Polygon/.test(item.geometry?.type));
    }
    if (feature.type === 'Polygon' || feature.type === 'MultiPolygon') feature = { type: 'Feature', properties: {}, geometry: feature };
    if (feature.type !== 'Feature' || !/Polygon/.test(feature.geometry?.type)) throw new Error('O arquivo precisa conter um Polygon ou MultiPolygon.');
    return feature;
  }
  function featureCoords(feature) {
    const g = feature?.geometry || {};
    if (g.type === 'Polygon') return g.coordinates.flat();
    if (g.type === 'MultiPolygon') return g.coordinates.flat(2);
    return [];
  }
  function allFeatureCoords(value) {
    if (value?.type === 'FeatureCollection') return (value.features || []).flatMap((feature) => featureCoords(feature));
    return featureCoords(value);
  }
  function bboxXY(feature) {
    const coords = featureCoords(feature);
    return coords.reduce((box, c) => [Math.min(box[0], c[0]), Math.min(box[1], c[1]), Math.max(box[2], c[0]), Math.max(box[3], c[1])], [Infinity, Infinity, -Infinity, -Infinity]);
  }
  function localProjection(feature) {
    const coords = featureCoords(feature);
    const center = coords.reduce((sum, c) => [sum[0] + c[0], sum[1] + c[1]], [0, 0]).map((v) => v / Math.max(coords.length, 1));
    const lon0 = center[0] * Math.PI / 180;
    const lat0 = center[1] * Math.PI / 180;
    const cos = Math.cos(lat0) || 1;
    return {
      toXY: ([lon, lat]) => [(lon * Math.PI / 180 - lon0) * R * cos, (lat * Math.PI / 180 - lat0) * R],
      toLngLat: ([x, y]) => [(x / (R * cos) + lon0) * 180 / Math.PI, (y / R + lat0) * 180 / Math.PI]
    };
  }
  function mapCoordsDeep(value, fn) {
    if (!Array.isArray(value)) return value;
    if (typeof value[0] === 'number' && typeof value[1] === 'number') return fn(value);
    return value.map((item) => mapCoordsDeep(item, fn));
  }
  function transformFeature(feature, fn) {
    return { type: 'Feature', properties: { ...(feature.properties || {}) }, geometry: { type: feature.geometry.type, coordinates: mapCoordsDeep(feature.geometry.coordinates, fn) } };
  }
  function rotatePoint([x, y], deg) {
    if (!deg) return [x, y];
    const a = deg * Math.PI / 180;
    return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  }
  function rotateFeature(feature, deg) {
    return transformFeature(feature, (coord) => rotatePoint(coord, deg));
  }
  function closeRing(ring) {
    if (!ring?.length) return ring;
    const first = ring[0], last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
    return ring;
  }
  function ringArea(ring) {
    let sum = 0;
    for (let i = 0; i < ring.length - 1; i++) sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    return sum / 2;
  }
  function geometryArea(geometry) {
    if (!geometry) return 0;
    if (geometry.type === 'Polygon') {
      const rings = geometry.coordinates || [];
      if (!rings.length) return 0;
      return Math.abs(ringArea(rings[0] || [])) - rings.slice(1).reduce((sum, ring) => sum + Math.abs(ringArea(ring || [])), 0);
    }
    if (geometry.type === 'MultiPolygon') return geometry.coordinates.reduce((sum, poly) => sum + geometryArea({ type: 'Polygon', coordinates: poly }), 0);
    return 0;
  }
  function geometryLength(geometry) {
    const rings = geometry?.type === 'Polygon' ? [geometry.coordinates?.[0] || []] : geometry?.type === 'MultiPolygon' ? geometry.coordinates.map((poly) => poly[0] || []) : [];
    let total = 0;
    rings.forEach((ring) => {
      for (let i = 0; i < ring.length - 1; i++) total += Math.hypot(ring[i + 1][0] - ring[i][0], ring[i + 1][1] - ring[i][1]);
    });
    return total;
  }
  function vertexCount(geometry) {
    if (geometry?.type === 'Polygon') return (geometry.coordinates?.[0] || []).length - 1;
    if (geometry?.type === 'MultiPolygon') return geometry.coordinates.reduce((sum, poly) => sum + Math.max((poly[0] || []).length - 1, 0), 0);
    return 0;
  }
  function rectangle(minX, minY, maxX, maxY) {
    return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY], [minX, minY]]] } };
  }
  function safeIntersect(a, b) {
    if (!window.turf?.intersect) throw new Error('Turf.js não carregou.');
    try { return turf.intersect(turf.featureCollection([a, b])); }
    catch (error) {
      try { return turf.intersect(a, b); }
      catch (second) { console.warn('[Glebas] Interseção falhou:', error, second); return null; }
    }
  }
  function stripIntersection(feature, min, max, axis, bbox, pad) {
    const rect = axis === 'y'
      ? rectangle(bbox[0] - pad, min, bbox[2] + pad, max)
      : rectangle(min, bbox[1] - pad, max, bbox[3] + pad);
    return safeIntersect(feature, rect);
  }
  function cumulativeArea(feature, value, axis, bbox, pad) {
    const strip = axis === 'y'
      ? stripIntersection(feature, bbox[1] - pad, value, axis, bbox, pad)
      : stripIntersection(feature, bbox[0] - pad, value, axis, bbox, pad);
    return strip ? geometryArea(strip.geometry) : 0;
  }
  function cutoffForArea(feature, targetArea, totalArea, axis, bbox, pad) {
    const min = axis === 'y' ? bbox[1] - pad : bbox[0] - pad;
    const max = axis === 'y' ? bbox[3] + pad : bbox[2] + pad;
    if (targetArea <= 0) return min;
    if (targetArea >= totalArea) return max;
    let lo = min, hi = max;
    for (let i = 0; i < 42; i++) {
      const mid = (lo + hi) / 2;
      const area = cumulativeArea(feature, mid, axis, bbox, pad);
      if (area < targetArea) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }
  function parseCustomAreas(totalAreaM2, count) {
    if ($('glebaMode').value !== 'custom') return Array(count).fill(totalAreaM2 / count);
    const values = $('glebaAreas').value.split(/[;\n,\t]+/).map((v) => Number(String(v).replace(',', '.'))).filter((v) => Number.isFinite(v) && v > 0);
    if (!values.length) throw new Error('Informe as áreas personalizadas em hectares.');
    const areas = values.map((v) => v * 10000);
    const sum = areas.reduce((a, b) => a + b, 0);
    if (sum > totalAreaM2 * 1.002) throw new Error('A soma das áreas informadas é maior que a área do imóvel.');
    if (Math.abs(sum - totalAreaM2) > totalAreaM2 * 0.02) throw new Error('A soma das áreas informadas precisa ser próxima da área total do imóvel.');
    return areas;
  }

  function dividePolygon(inputFeature) {
    const original = normalizeFeature(inputFeature);
    const proj = localProjection(original);
    let projected = transformFeature(original, proj.toXY);
    const axisOption = $('glebaAxis').value;
    const axis = axisOption === 'y' ? 'y' : 'x';
    const angle = axisOption === 'angle' ? -Number($('glebaAzimuth').value || 0) : 0;
    if (angle) projected = rotateFeature(projected, angle);
    const bbox = bboxXY(projected);
    const extent = Math.max(bbox[2] - bbox[0], bbox[3] - bbox[1], 1000);
    const pad = extent * 2;
    const totalArea = geometryArea(projected.geometry);
    const count = Math.max(2, Math.min(80, Number($('glebaCount').value || 2)));
    const targetAreas = parseCustomAreas(totalArea, count);
    const cuts = [axis === 'y' ? bbox[1] - pad : bbox[0] - pad];
    let cumulative = 0;
    for (let i = 0; i < targetAreas.length - 1; i++) {
      cumulative += targetAreas[i];
      cuts.push(cutoffForArea(projected, cumulative, totalArea, axis, bbox, pad));
    }
    cuts.push(axis === 'y' ? bbox[3] + pad : bbox[2] + pad);
    const base = $('glebaBaseName').value.trim() || 'Gleba';
    const features = [];
    const stats = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      let part = stripIntersection(projected, cuts[i], cuts[i + 1], axis, bbox, pad);
      if (!part?.geometry || geometryArea(part.geometry) < 1) continue;
      if (angle) part = rotateFeature(part, -angle);
      const lngLat = transformFeature(part, proj.toLngLat);
      const areaM2 = geometryArea(part.geometry);
      const perimeter = geometryLength(part.geometry);
      lngLat.properties = {
        ...(lngLat.properties || {}),
        name: `${base} ${String(i + 1).padStart(2, '0')}`,
        category: 'gleba',
        areaHectares: areaM2 / 10000,
        perimeterMeters: perimeter,
        targetAreaHectares: targetAreas[i] ? targetAreas[i] / 10000 : null,
        owner: $('glebaOwner').value.trim() || '',
        style: { color: palette[i % palette.length], fillColor: palette[i % palette.length], fillOpacity: 0.36, weight: 2 }
      };
      features.push(lngLat);
      stats.push({ name: lngLat.properties.name, areaM2, targetM2: targetAreas[i] || 0, perimeter, vertices: vertexCount(lngLat.geometry) });
    }
    if (features.length < 2) throw new Error('Não foi possível gerar as glebas. Tente outra orientação de corte.');
    return { type: 'FeatureCollection', features, properties: { source: 'GeoRural Pro - Divisão de glebas', generatedAt: new Date().toISOString(), totalAreaHectares: totalArea / 10000 } };
  }

  function pathForRing(ring, project) { return ring.map((coord) => project(coord).join(',')).join(' '); }
  function renderPreview(fc) {
    const all = allFeatureCoords(fc);
    const bb = all.reduce((box, c) => [Math.min(box[0], c[0]), Math.min(box[1], c[1]), Math.max(box[2], c[0]), Math.max(box[3], c[1])], [Infinity, Infinity, -Infinity, -Infinity]);
    const w = 1000, h = 620, pad = 55;
    const dx = Math.max(bb[2] - bb[0], 0.000001), dy = Math.max(bb[3] - bb[1], 0.000001);
    const scale = Math.min((w - pad * 2) / dx, (h - pad * 2) / dy);
    const ow = dx * scale, oh = dy * scale;
    const ox = (w - ow) / 2, oy = (h - oh) / 2;
    const project = (coord) => [Number((ox + (coord[0] - bb[0]) * scale).toFixed(2)), Number((oy + oh - (coord[1] - bb[1]) * scale).toFixed(2))];
    const shapes = fc.features.map((feature, index) => {
      const color = palette[index % palette.length];
      const polygons = feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates : [feature.geometry.coordinates];
      const paths = polygons.map((poly) => `<polygon points="${pathForRing(poly[0], project)}" fill="${color}55" stroke="${color}" stroke-width="0.95"/>`).join('');
      let label = '';
      try {
        const center = turf.centerOfMass(feature).geometry.coordinates;
        const [x, y] = project(center);
        label = `<text x="${x}" y="${y}" text-anchor="middle" font-size="20" font-weight="800" fill="#0f172a">${esc(feature.properties.name)}</text>`;
      } catch {}
      return `${paths}${label}`;
    }).join('');
    $('glebaPreview').innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Croqui da divisão de glebas"><rect width="${w}" height="${h}" fill="#f8fafc"/><text x="50" y="35" font-size="24" font-weight="800" fill="#0f172a">Divisão automática de glebas</text><text x="50" y="60" font-size="13" fill="#475569">${esc($('glebaOwner').value || 'GeoRural Pro')}</text>${shapes}<text x="${w - 55}" y="${h - 24}" text-anchor="end" font-size="12" fill="#64748b">Prévia técnica — confira em campo antes do uso oficial</text></svg>`;
  }
  function renderTable(fc) {
    const targetAreas = resultStats.map((s) => s.targetM2).filter(Boolean);
    const diffs = resultStats.map((s) => Math.abs(s.areaM2 - (s.targetM2 || s.areaM2)) / 10000);
    const totalArea = resultStats.reduce((sum, s) => sum + s.areaM2, 0);
    $('glebaTotalArea').textContent = `${num(totalArea / 10000, 4)} ha`;
    $('glebaTotalLots').textContent = String(fc.features.length);
    $('glebaMaxDiff').textContent = diffs.length ? `${num(Math.max(...diffs), 4)} ha` : '—';
    $('glebaStatus').textContent = 'Gerado';
    $('glebaTable').innerHTML = resultStats.map((s, i) => `<tr><td><b>${esc(s.name)}</b></td><td>${num(s.areaM2 / 10000, 4)} ha</td><td>${num(s.perimeter, 2)} m</td><td>${s.vertices}</td><td>${targetAreas.length ? `Alvo: ${num(s.targetM2 / 10000, 4)} ha` : 'Parte igual'}</td></tr>`).join('');
  }
  function polygonToKmlCoords(geometry) {
    const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
    return polygons.map((poly) => `<Polygon><outerBoundaryIs><LinearRing><coordinates>${poly[0].map((c) => `${c[0]},${c[1]},0`).join(' ')}</coordinates></LinearRing></outerBoundaryIs></Polygon>`).join('');
  }
  function toKml(fc) {
    return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Divisão de glebas GeoRural</name>${fc.features.map((f, i) => `<Placemark><name>${esc(f.properties.name)}</name><description>Área: ${num(f.properties.areaHectares, 4)} ha</description><Style><LineStyle><color>ff000000</color><width>2</width></LineStyle><PolyStyle><color>6600ffff</color></PolyStyle></Style>${polygonToKmlCoords(f.geometry)}</Placemark>`).join('')}</Document></kml>`;
  }
  function toCsv(fc) {
    const rows = ['gleba;vertice;latitude;longitude;area_ha;perimetro_m'];
    fc.features.forEach((f) => {
      const polys = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates];
      let v = 1;
      polys.forEach((poly) => (poly[0] || []).slice(0, -1).forEach((c) => rows.push(`${f.properties.name};V-${String(v++).padStart(2, '0')};${c[1].toFixed(8)};${c[0].toFixed(8)};${Number(f.properties.areaHectares).toFixed(4)};${Number(f.properties.perimeterMeters).toFixed(3)}`)));
    });
    return rows.join('\n');
  }
  function copyCoords(fc) {
    const text = fc.features.map((f) => `${f.properties.name}\n` + toCsv({ type: 'FeatureCollection', features: [f] })).join('\n\n');
    navigator.clipboard?.writeText(text).then(() => toast('Coordenadas copiadas.')).catch(() => download('coordenadas-glebas.txt', text, 'text/plain;charset=utf-8'));
  }
  async function loadProjects() {
    const select = $('glebaProjectSelect');
    try {
      if (!window.GeoRuralProjects?.list) throw new Error('Módulo de projetos indisponível.');
      projects = await window.GeoRuralProjects.list({ full: false, refresh: true });
      select.innerHTML = '<option value="">Selecione um projeto salvo</option>' + projects.map((p) => `<option value="${esc(p.id)}">${esc(p.propertyName || p.name || p.title || 'Projeto sem nome')}</option>`).join('');
    } catch (error) {
      select.innerHTML = '<option value="">Não foi possível carregar projetos</option>';
      console.warn('[Glebas] projetos:', error);
    }
  }
  function fillFeatureSelect(project) {
    const features = project?.geojson?.features?.filter((f) => /Polygon/.test(f.geometry?.type)) || [];
    $('glebaFeatureSelect').innerHTML = features.length ? features.map((f, i) => `<option value="${i}">${esc(f.properties?.name || f.properties?.category || `Polígono ${i + 1}`)}</option>`).join('') : '<option value="">Nenhum polígono no projeto</option>';
    if (features[0]) $('glebaGeojson').value = JSON.stringify(features[0], null, 2);
  }
  async function parseKml(text) {
    const xml = new DOMParser().parseFromString(text, 'application/xml');
    const coords = [...xml.querySelectorAll('Polygon outerBoundaryIs coordinates, Polygon coordinates')].map((node) => node.textContent.trim().split(/\s+/).map((item) => item.split(',').slice(0, 2).map(Number)).filter((c) => Number.isFinite(c[0]) && Number.isFinite(c[1]))).find((ring) => ring.length >= 4);
    if (!coords) throw new Error('KML sem polígono válido.');
    return { type: 'Feature', properties: { name: 'Polígono KML' }, geometry: { type: 'Polygon', coordinates: [closeRing(coords)] } };
  }
  async function readFile(file) {
    const text = await file.text();
    const feature = /\.kml$/i.test(file.name) || text.trim().startsWith('<') ? await parseKml(text) : normalizeFeature(text);
    $('glebaGeojson').value = JSON.stringify(feature, null, 2);
    toast('Polígono importado.');
  }

  async function generate() {
    try {
      $('glebaStatus').textContent = 'Calculando...';
      const source = normalizeFeature($('glebaGeojson').value);
      const fc = dividePolygon(source);
      resultGeojson = fc;
      resultStats = fc.features.map((f) => ({ name: f.properties.name, areaM2: f.properties.areaHectares * 10000, targetM2: (f.properties.targetAreaHectares || 0) * 10000, perimeter: f.properties.perimeterMeters, vertices: vertexCount(f.geometry) }));
      renderPreview(fc);
      renderTable(fc);
      toast('Glebas geradas com sucesso.');
    } catch (error) {
      console.error(error);
      $('glebaStatus').textContent = 'Erro';
      toast(error.message || 'Não foi possível dividir a área.', 'error');
    }
  }
  async function saveProject() {
    if (!resultGeojson) return toast('Gere as glebas primeiro.', 'error');
    if (!window.GeoRuralProjects?.saveLegacy) return toast('Módulo de nuvem indisponível.', 'error');
    const coords = allFeatureCoords(resultGeojson);
    const center = coords.reduce((sum, c) => [sum[0] + c[0], sum[1] + c[1]], [0, 0]).map((v) => v / Math.max(coords.length, 1));
    await window.GeoRuralProjects.saveLegacy({
      title: `Divisão de glebas - ${$('glebaBaseName').value || 'Projeto'}`,
      owner: $('glebaOwner').value || '',
      city: selectedProject?.city || '',
      uf: selectedProject?.uf || 'BA',
      geojson: resultGeojson,
      metadata: { module: 'glebas-v21.9.31', splitMode: $('glebaMode').value, splitAxis: $('glebaAxis').value },
      view: { center: { lat: center[1], lng: center[0] }, zoom: 15 }
    });
    toast('Divisão salva como projeto no Appwrite.');
  }
  function loadDraftFromMap() {
    let draft = null;
    try { draft = JSON.parse(sessionStorage.getItem('georural:glebas:draft') || 'null'); }
    catch { draft = null; }
    if (!draft?.geojson) return false;
    try {
      const feature = normalizeFeature(draft.geojson);
      $('glebaGeojson').value = JSON.stringify(feature, null, 2);
      $('glebaBaseName').value = 'Gleba';
      $('glebaOwner').value = draft.ownerName || draft.owner || '';
      const option = document.createElement('option');
      option.value = '__map_draft__';
      option.textContent = `${draft.propertyName || 'Polígono do mapa'} — enviado do Mapa`;
      $('glebaProjectSelect').prepend(option);
      $('glebaProjectSelect').value = '__map_draft__';
      $('glebaFeatureSelect').innerHTML = '<option value="0">Polígono recebido do Mapa e Cadastro</option>';
      selectedProject = {
        id: '__map_draft__',
        propertyName: draft.propertyName || 'Polígono do mapa',
        owner: draft.ownerName || '',
        city: draft.city || '',
        uf: draft.uf || 'BA',
        geojson: draft.collection || { type: 'FeatureCollection', features: [feature] }
      };
      sessionStorage.removeItem('georural:glebas:draft');
      toast('Polígono do mapa carregado para divisão de glebas.');
      return true;
    } catch (error) {
      console.warn('[Glebas] rascunho do mapa inválido:', error);
      toast('Não foi possível carregar o polígono enviado pelo mapa.', 'error');
      return false;
    }
  }

  function install() {
    loadProjects().then(() => loadDraftFromMap());
    $('mobileToggle')?.addEventListener('click', () => $('side')?.classList.toggle('open'));
    $('glebaProjectSelect').addEventListener('change', async (event) => {
      const id = event.target.value;
      selectedProject = id ? await window.GeoRuralProjects.get(id) : null;
      fillFeatureSelect(selectedProject);
      $('glebaOwner').value = selectedProject?.owner || '';
    });
    $('glebaFeatureSelect').addEventListener('change', (event) => {
      const feature = selectedProject?.geojson?.features?.filter((f) => /Polygon/.test(f.geometry?.type))[Number(event.target.value)];
      if (feature) $('glebaGeojson').value = JSON.stringify(feature, null, 2);
    });
    $('glebaFile').addEventListener('change', (event) => event.target.files?.[0] && readFile(event.target.files[0]));
    $('glebaGenerate').onclick = generate;
    $('glebaSave').onclick = saveProject;
    $('glebaGeojsonBtn').onclick = () => resultGeojson ? download('divisao-glebas.geojson', JSON.stringify(resultGeojson, null, 2), 'application/geo+json;charset=utf-8') : toast('Gere as glebas primeiro.', 'error');
    $('glebaKmlBtn').onclick = () => resultGeojson ? download('divisao-glebas.kml', toKml(resultGeojson), 'application/vnd.google-earth.kml+xml;charset=utf-8') : toast('Gere as glebas primeiro.', 'error');
    $('glebaCsvBtn').onclick = () => resultGeojson ? download('vertices-glebas.csv', toCsv(resultGeojson), 'text/csv;charset=utf-8') : toast('Gere as glebas primeiro.', 'error');
    $('glebaCopyCoords').onclick = () => resultGeojson ? copyCoords(resultGeojson) : toast('Gere as glebas primeiro.', 'error');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
