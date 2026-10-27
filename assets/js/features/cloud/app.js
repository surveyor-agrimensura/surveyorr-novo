(() => {
  'use strict';
  const auth = window.GeoRuralAuth || window.SurveyorAuth;
  const user = auth?.requireAuth?.();
  if (!user) return;

  const $ = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const fileSafe = (value) => String(value || 'projeto').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'projeto';
  const projectUiIcon = (name) => {
    const paths={
      place:'<path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/>',
      area:'<path d="M5 5l12 2 2 10-10 2-5-8Z"/>',
      layers:'<path d="m12 3 8 4-8 4-8-4 8-4Zm8 8-8 4-8-4m16 4-8 4-8-4"/>',
      time:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
      cloud:'<path d="M7 18h10a4 4 0 0 0 .7-7.9A6 6 0 0 0 6.3 9.2 4.5 4.5 0 0 0 7 18Z"/>'
    };
    return `<svg class="project-meta-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name]||paths.layers}</svg>`;
  };

  let projects = [];
  let storageStatus = null;
  let expandedProjectId = "";
  const previewCache = new Map();

  function showToast(message, type = '') {
    if (window.SurveyorToast) return window.SurveyorToast(message, type);
    const host = $('suiteToast');
    if (!host) return console[type === 'error' ? 'error' : 'log'](message);
    host.textContent = message;
    host.className = `toast show ${type}`.trim();
    clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => { host.className = 'toast'; }, 3200);
  }

  function downloadBlob(filename, content, mimeType = 'application/octet-stream') {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    return blob;
  }

  function formatSize(bytes) {
    const value = Number(bytes || 0);
    if (!Number.isFinite(value) || value <= 0) return '0 KB';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = value;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    const digits = size >= 100 || unitIndex === 0 ? 0 : size >= 10 ? 1 : 2;
    return `${size.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: digits })} ${units[unitIndex]}`;
  }

  function projectBytes(project) {
    const direct = Number(project?.sizeBytes ?? project?.bytes ?? project?.storageBytes ?? project?.metadata?.sizeBytes ?? project?.metadata?.bytes ?? 0);
    if (Number.isFinite(direct) && direct > 0) return direct;
    try {
      return new Blob([JSON.stringify(project || {})]).size;
    } catch {
      return 0;
    }
  }

  function renderStorageStatus() {
    const host = $('projectsStorage');
    if (!host) return;
    if (!storageStatus) {
      host.textContent = 'Carregando…';
      return;
    }
    const used = Number(storageStatus.usedBytes || 0);
    const limit = storageStatus.limitBytes == null ? null : Number(storageStatus.limitBytes || 0);
    host.textContent = limit == null ? `${formatSize(used)} usados` : `${formatSize(used)} de ${formatSize(limit)}`;
    const remaining = $('projectsStorageRemaining');
    if (remaining) remaining.textContent = limit == null ? 'Armazenamento ilimitado' : `${formatSize(Math.max(0, limit - used))} disponíveis`;
    const progress = $('projectsStorageProgress');
    if (progress) {
      const pct = limit > 0 ? Math.max(0, Math.min(100, used / limit * 100)) : 0;
      progress.style.width = `${pct}%`;
      progress.parentElement?.setAttribute('aria-valuenow', String(Math.round(pct)));
    }
    const buy = $('projectsBuyStorage');
    if (buy) {
      const max = Number(storageStatus.maxBytes || limit || 0);
      buy.hidden = Boolean(limit != null && max > 0 && limit >= max);
      buy.onclick = () => auth.openStorageStore?.();
    }
  }

  async function loadStorageStatus() {
    if (!auth?.loadStorageStatus) return;
    try { storageStatus = await auth.loadStorageStatus(); }
    catch (error) { console.warn('[Surveyor storage status]', error?.message || error); storageStatus = null; }
    renderStorageStatus();
  }

  function parseMaybeJson(value) {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed || !/^[\[{]/.test(trimmed)) return null;
    try { return JSON.parse(trimmed); } catch { return null; }
  }

  function collectFeatureCandidates(source) {
    const bucket = [];
    const seen = new WeakSet();
    const maybeGeometryFromArray = (node) => {
      if (!Array.isArray(node) || node.length < 2) return null;
      const pointLike = node.every((item) => Array.isArray(item) && item.length >= 2 && Number.isFinite(Number(item[0])) && Number.isFinite(Number(item[1])));
      if (pointLike && node.length >= 3) return { type:'Feature', geometry:{ type:'Polygon', coordinates:[[...node, node[0]]] }, properties:{} };
      const latLngObjects = node.every((item) => item && typeof item === 'object' && Number.isFinite(Number(item.lat ?? item.latitude)) && Number.isFinite(Number(item.lng ?? item.lon ?? item.longitude)));
      if (latLngObjects && node.length >= 3) {
        const ring = node.map((item) => [Number(item.lng ?? item.lon ?? item.longitude), Number(item.lat ?? item.latitude)]);
        return { type:'Feature', geometry:{ type:'Polygon', coordinates:[[...ring, ring[0]]] }, properties:{} };
      }
      return null;
    };
    const visit = (node) => {
      if (!node || bucket.length > 220) return;
      if (typeof node === 'string') {
        const parsed = parseMaybeJson(node);
        if (parsed) visit(parsed);
        return;
      }
      if (Array.isArray(node)) {
        const raw = maybeGeometryFromArray(node);
        if (raw) bucket.push(raw);
        node.forEach(visit);
        return;
      }
      if (typeof node !== 'object') return;
      if (seen.has(node)) return;
      seen.add(node);
      if (node.type === 'FeatureCollection' && Array.isArray(node.features)) {
        bucket.push(...node.features);
        node.features.forEach(visit);
        return;
      }
      if (node.type === 'Feature' && node.geometry) {
        bucket.push(node);
        visit(node.geometry);
        return;
      }
      if (node.type && node.coordinates) {
        bucket.push({ type:'Feature', geometry:node, properties:{} });
        return;
      }
      Object.values(node).forEach(visit);
    };
    visit(source);
    return bucket;
  }

  function findPreviewUrl(project, full) {
    const candidates = [
      project?.previewImage, project?.thumbnailUrl, project?.image, project?.coverImage,
      project?.metadata?.previewImage, project?.metadata?.thumbnailUrl, project?.metadata?.previewUrl,
      full?.previewImage, full?.thumbnailUrl, full?.project?.previewImage, full?.project?.thumbnailUrl,
      full?.project?.metadata?.previewImage, full?.project?.metadata?.thumbnailUrl, full?.project?.metadata?.previewUrl
    ];
    return candidates.find((value) => typeof value === 'string' && /^https?:/i.test(value.trim())) || '';
  }

  function flattenCoordinates(geometry) {
    if (!geometry || !geometry.coordinates) return [];
    const out = [];
    const walk = (node) => {
      if (!Array.isArray(node)) return;
      if (node.length >= 2 && Number.isFinite(Number(node[0])) && Number.isFinite(Number(node[1]))) {
        out.push([Number(node[0]), Number(node[1])]);
        return;
      }
      node.forEach(walk);
    };
    walk(geometry.coordinates);
    return out.filter(([lon, lat]) => Math.abs(lon) <= 180 && Math.abs(lat) <= 90);
  }

  function clampLatitude(lat) {
    return Math.max(-85.05112878, Math.min(85.05112878, Number(lat) || 0));
  }

  function lonLatToMercator(lon, lat) {
    const x = Number(lon) * 20037508.34 / 180;
    const safeLat = clampLatitude(lat);
    const y = Math.log(Math.tan((90 + safeLat) * Math.PI / 360)) / (Math.PI / 180);
    return {
      x,
      y: y * 20037508.34 / 180
    };
  }

  function normalizeRing(points = []) {
    const clean = points
      .map((coord) => [Number(coord?.[0]), Number(coord?.[1])])
      .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90);
    if (clean.length < 2) return [];
    return clean;
  }

  function collectRenderableShapes(geoms) {
    const shapes = [];
    (Array.isArray(geoms) ? geoms : []).forEach((geom) => {
      if (!geom?.type) return;
      const type = String(geom.type);
      if (type === 'Polygon') {
        const outer = normalizeRing(geom.coordinates?.[0]);
        if (outer.length >= 3) shapes.push({ kind:'polygon', points:outer });
        return;
      }
      if (type === 'MultiPolygon') {
        (geom.coordinates || []).forEach((polygon) => {
          const outer = normalizeRing(polygon?.[0]);
          if (outer.length >= 3) shapes.push({ kind:'polygon', points:outer });
        });
        return;
      }
      if (type === 'LineString') {
        const line = normalizeRing(geom.coordinates);
        if (line.length >= 2) shapes.push({ kind:'line', points:line });
        return;
      }
      if (type === 'MultiLineString') {
        (geom.coordinates || []).forEach((lineCoords) => {
          const line = normalizeRing(lineCoords);
          if (line.length >= 2) shapes.push({ kind:'line', points:line });
        });
        return;
      }
      if (type === 'Point') {
        const point = normalizeRing([geom.coordinates]);
        if (point.length) shapes.push({ kind:'point', points:point });
        return;
      }
      if (type === 'MultiPoint') {
        const point = normalizeRing(geom.coordinates);
        point.forEach((coord) => shapes.push({ kind:'point', points:[coord] }));
      }
    });
    return shapes;
  }

  function buildProjectedPreviewBounds(shapes, fallbackLon, fallbackLat, aspectRatio = 16 / 9) {
    const projected = [];
    (Array.isArray(shapes) ? shapes : []).forEach((shape) => {
      (shape.points || []).forEach(([lon, lat]) => {
        projected.push(lonLatToMercator(lon, lat));
      });
    });

    if (!projected.length) {
      const center = lonLatToMercator(fallbackLon, fallbackLat);
      const spanX = 360;
      const spanY = spanX / Math.max(0.5, Math.min(3, aspectRatio || (16 / 9)));
      return {
        minX: center.x - spanX,
        maxX: center.x + spanX,
        minY: center.y - spanY,
        maxY: center.y + spanY
      };
    }

    let minX = Math.min(...projected.map((item) => item.x));
    let maxX = Math.max(...projected.map((item) => item.x));
    let minY = Math.min(...projected.map((item) => item.y));
    let maxY = Math.max(...projected.map((item) => item.y));

    let spanX = Math.max(maxX - minX, 120);
    let spanY = Math.max(maxY - minY, 120);

    const padX = Math.max(spanX * 0.08, 45);
    const padY = Math.max(spanY * 0.08, 45);
    minX -= padX;
    maxX += padX;
    minY -= padY;
    maxY += padY;
    spanX = maxX - minX;
    spanY = maxY - minY;

    const targetRatio = Math.max(0.5, Math.min(3, Number(aspectRatio) || (16 / 9)));
    const currentRatio = spanX / Math.max(spanY, 1);
    if (currentRatio > targetRatio) {
      const desiredHeight = spanX / targetRatio;
      const extra = (desiredHeight - spanY) / 2;
      minY -= extra;
      maxY += extra;
    } else {
      const desiredWidth = spanY * targetRatio;
      const extra = (desiredWidth - spanX) / 2;
      minX -= extra;
      maxX += extra;
    }

    return { minX, maxX, minY, maxY };
  }

  function buildStaticPreviewUrl(bounds, width = 1200, height = 720) {
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bounds.minX},${bounds.minY},${bounds.maxX},${bounds.maxY}&bboxSR=3857&imageSR=3857&size=${width},${height}&format=jpg&transparent=false&f=image`;
  }

  function buildGeographicPreviewBounds(shapes, fallbackLon, fallbackLat, aspectRatio = 16 / 9) {
    const coords = (Array.isArray(shapes) ? shapes : []).flatMap((shape) => shape.points || []);
    if (!coords.length) {
      const spanLon = 0.006;
      const spanLat = spanLon / Math.max(0.5, Math.min(3, Number(aspectRatio) || (16 / 9)));
      return { minLon:fallbackLon-spanLon, maxLon:fallbackLon+spanLon, minLat:fallbackLat-spanLat, maxLat:fallbackLat+spanLat };
    }
    let minLon=Math.min(...coords.map((c)=>c[0])), maxLon=Math.max(...coords.map((c)=>c[0]));
    let minLat=Math.min(...coords.map((c)=>c[1])), maxLat=Math.max(...coords.map((c)=>c[1]));
    let spanLon=Math.max(maxLon-minLon, 0.00025), spanLat=Math.max(maxLat-minLat, 0.00025);
    const padLon=Math.max(spanLon*0.12, 0.00012), padLat=Math.max(spanLat*0.12, 0.00012);
    minLon-=padLon; maxLon+=padLon; minLat-=padLat; maxLat+=padLat;
    spanLon=maxLon-minLon; spanLat=maxLat-minLat;
    const target=Math.max(0.5, Math.min(3, Number(aspectRatio) || (16/9)));
    const current=spanLon/Math.max(spanLat,1e-9);
    if(current>target){const want=spanLon/target, extra=(want-spanLat)/2; minLat-=extra; maxLat+=extra;}
    else {const want=spanLat*target, extra=(want-spanLon)/2; minLon-=extra; maxLon+=extra;}
    return {minLon,maxLon,minLat,maxLat};
  }

  function buildGeographicPreviewUrl(bounds, width = 1200, height = 720) {
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bounds.minLon},${bounds.minLat},${bounds.maxLon},${bounds.maxLat}&bboxSR=4326&imageSR=4326&size=${width},${height}&format=jpg&transparent=false&f=image`;
  }

  function previewCenter(project) {
    const viewCenter = project?.view?.center || project?.metadata?.view?.center || project?.metadata?.center || null;
    const lon = Number(project?.centerLongitude ?? project?.metadata?.centerLongitude ?? viewCenter?.lng ?? viewCenter?.lon ?? viewCenter?.longitude);
    const lat = Number(project?.centerLatitude ?? project?.metadata?.centerLatitude ?? viewCenter?.lat ?? viewCenter?.latitude);
    return Number.isFinite(lon) && Number.isFinite(lat) ? { lon, lat } : null;
  }

  function clampPreviewZoom(value) {
    const zoom = Math.round(Number(value));
    return Math.max(10, Math.min(19, Number.isFinite(zoom) ? zoom : 16));
  }

  function lonLatToWorldPixel(lon, lat, zoom) {
    const worldSize = 256 * (2 ** zoom);
    const safeLat = clampLatitude(lat);
    const sin = Math.sin(safeLat * Math.PI / 180);
    return {
      x: ((Number(lon) + 180) / 360) * worldSize,
      y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * worldSize
    };
  }

  function worldPixelToLonLat(x, y, zoom) {
    const worldSize = 256 * (2 ** zoom);
    const lon = (x / worldSize) * 360 - 180;
    const n = Math.PI - (2 * Math.PI * y) / worldSize;
    const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
    return { lon, lat };
  }

  function fitTileZoom(shapes, width, height, fallbackZoom = 16) {
    const coords = (Array.isArray(shapes) ? shapes : []).flatMap((shape) => shape.points || []);
    if (!coords.length) return clampPreviewZoom(fallbackZoom);
    const projected = coords.map(([lon, lat]) => lonLatToMercator(lon, lat));
    const minX = Math.min(...projected.map((p) => p.x));
    const maxX = Math.max(...projected.map((p) => p.x));
    const minY = Math.min(...projected.map((p) => p.y));
    const maxY = Math.max(...projected.map((p) => p.y));
    const spanX = Math.max(maxX - minX, 25);
    const spanY = Math.max(maxY - minY, 25);
    const usableW = Math.max(220, width * 0.78);
    const usableH = Math.max(130, height * 0.76);
    const worldMeters = 40075016.68;
    const scale = Math.min(usableW / spanX, usableH / spanY);
    const z = Math.floor(Math.log2(Math.max(scale * worldMeters / 256, 1)));
    return Math.max(10, Math.min(19, z));
  }

  function renderFastTilePreview(host, centerLon, centerLat, zoom, shapes = []) {
    if (!host || !Number.isFinite(Number(centerLon)) || !Number.isFinite(Number(centerLat))) return null;
    const rect = host.getBoundingClientRect();
    const width = Math.max(360, Math.round(rect.width || 420));
    const height = Math.max(200, Math.round(rect.height || 220));
    const z = clampPreviewZoom(zoom);
    const center = lonLatToWorldPixel(centerLon, centerLat, z);
    const leftWorld = center.x - width / 2;
    const topWorld = center.y - height / 2;
    const rightWorld = center.x + width / 2;
    const bottomWorld = center.y + height / 2;
    const n = 2 ** z;

    host.querySelector('.project-preview-fast-tiles')?.remove();
    host.querySelector('.project-preview-static-image')?.remove();
    host.querySelector('.project-preview-static-svg')?.remove();
    host.querySelector('.project-preview-outline')?.remove();
    clearPreviewMessage(host);

    const tileHost = document.createElement('div');
    tileHost.className = 'project-preview-fast-tiles';
    tileHost.setAttribute('aria-hidden', 'true');

    const startX = Math.floor(leftWorld / 256);
    const endX = Math.floor((rightWorld - 1) / 256);
    const startY = Math.max(0, Math.floor(topWorld / 256));
    const endY = Math.min(n - 1, Math.floor((bottomWorld - 1) / 256));

    for (let ty = startY; ty <= endY; ty += 1) {
      for (let tx = startX; tx <= endX; tx += 1) {
        const wrappedX = ((tx % n) + n) % n;
        const image = document.createElement('img');
        image.alt = '';
        image.decoding = 'async';
        image.loading = 'eager';
        image.fetchPriority = 'high';
        image.referrerPolicy = 'no-referrer';
        image.style.left = `${Math.round(tx * 256 - leftWorld)}px`;
        image.style.top = `${Math.round(ty * 256 - topWorld)}px`;
        image.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${ty}/${wrappedX}`;
        tileHost.appendChild(image);
      }
    }

    host.prepend(tileHost);
    host.classList.remove('is-placeholder', 'is-preview-unavailable');
    host.classList.add('is-preview-ready');
    host.dataset.previewInstant = '1';

    const topLeft = worldPixelToLonLat(leftWorld, topWorld, z);
    const bottomRight = worldPixelToLonLat(rightWorld, bottomWorld, z);
    const geoBounds = {
      minLon: topLeft.lon,
      maxLon: bottomRight.lon,
      minLat: bottomRight.lat,
      maxLat: topLeft.lat
    };
    if (Array.isArray(shapes) && shapes.length) renderGeographicOverlay(host, shapes, geoBounds, width, height);
    return { width, height, zoom:z, bounds:geoBounds };
  }

  function renderGeographicOverlay(host, shapes, bounds, width = 1200, height = 720) {
    host.querySelector('.project-preview-static-svg')?.remove();
    if (!Array.isArray(shapes) || !shapes.length) return;
    const svgNS='http://www.w3.org/2000/svg';
    const svg=document.createElementNS(svgNS,'svg');
    svg.classList.add('project-preview-static-svg');
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    svg.setAttribute('preserveAspectRatio','none');
    shapes.slice(0,48).forEach((shape,index)=>{
      const mapped=(shape.points||[]).map(([lon,lat])=>[
        ((lon-bounds.minLon)/Math.max(bounds.maxLon-bounds.minLon,1e-9))*width,
        ((bounds.maxLat-lat)/Math.max(bounds.maxLat-bounds.minLat,1e-9))*height
      ]);
      if((shape.kind==='polygon'&&mapped.length<3)||(shape.kind==='line'&&mapped.length<2)||!mapped.length)return;
      const stroke=index%2?'#2b83ff':'#f2b000';
      if(shape.kind==='point'){
        const [pt]=mapped; const marker=document.createElementNS(svgNS,'circle');
        marker.setAttribute('cx',pt[0].toFixed(2)); marker.setAttribute('cy',pt[1].toFixed(2)); marker.setAttribute('r','2.5');
        marker.setAttribute('fill','#fff'); marker.setAttribute('stroke',stroke); marker.setAttribute('stroke-width','0.9'); vectorSafe(marker); svg.appendChild(marker); return;
      }
      const el=document.createElementNS(svgNS,shape.kind==='polygon'?'polygon':'polyline');
      el.setAttribute('points',mapped.map(([x,y])=>`${x.toFixed(2)},${y.toFixed(2)}`).join(' '));
      el.setAttribute('fill',shape.kind==='polygon'?(index%2?'rgba(43,131,255,.13)':'rgba(242,176,0,.12)'):'none');
      el.setAttribute('stroke',stroke); el.setAttribute('stroke-width',shape.kind==='polygon'?'0.78':'0.72');
      el.setAttribute('stroke-linejoin','round'); el.setAttribute('stroke-linecap','round'); vectorSafe(el); svg.appendChild(el);
    });
    host.appendChild(svg);
  }

  function expandProjectedBounds(bounds, factor = 1) {
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    const halfW = Math.max((bounds.maxX - bounds.minX) / 2, 1) * factor;
    const halfH = Math.max((bounds.maxY - bounds.minY) / 2, 1) * factor;
    return { minX:cx-halfW, maxX:cx+halfW, minY:cy-halfH, maxY:cy+halfH };
  }

  async function preloadPreviewImage(url, attempts = 2) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const candidate = `${url}${url.includes('?') ? '&' : '?'}_sv=${Date.now()}-${attempt}`;
      const ok = await new Promise((resolve) => {
        const image = new Image();
        image.decoding = 'async';
        image.referrerPolicy = 'no-referrer';
        let settled = false;
        const finish = (value) => { if (settled) return; settled = true; clearTimeout(timer); resolve(value); };
        const timer = window.setTimeout(() => finish(false), 8000);
        image.onload = () => finish(image.naturalWidth > 0 && image.naturalHeight > 0);
        image.onerror = () => finish(false);
        image.src = candidate;
      });
      if (ok) return candidate;
      if (attempt + 1 < attempts) await new Promise((resolve) => window.setTimeout(resolve, 260 + attempt * 320));
    }
    return '';
  }

  function renderPreviewOverlay(host, shapes, bounds, width = 1200, height = 720) {
    host.querySelector('.project-preview-static-svg')?.remove();
    if (!Array.isArray(shapes) || !shapes.length) return;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.classList.add('project-preview-static-svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('preserveAspectRatio', 'none');

    shapes.slice(0, 48).forEach((shape, index) => {
      const projectedPoints = (shape.points || []).map(([lon, lat]) => lonLatToMercator(lon, lat));
      if ((shape.kind === 'polygon' && projectedPoints.length < 3) || (shape.kind === 'line' && projectedPoints.length < 2) || !projectedPoints.length) return;
      const mapped = projectedPoints.map(({ x, y }) => {
        const px = ((x - bounds.minX) / Math.max(bounds.maxX - bounds.minX, 1)) * width;
        const py = ((bounds.maxY - y) / Math.max(bounds.maxY - bounds.minY, 1)) * height;
        return [px, py];
      });
      const stroke = index % 2 ? '#2b83ff' : '#f2b000';

      if (shape.kind === 'point') {
        const [point] = mapped;
        const marker = document.createElementNS(svgNS, 'circle');
        marker.setAttribute('cx', point[0].toFixed(2));
        marker.setAttribute('cy', point[1].toFixed(2));
        marker.setAttribute('r', '2.6');
        marker.setAttribute('fill', '#ffffff');
        marker.setAttribute('stroke', stroke);
        marker.setAttribute('stroke-width', '0.95');
        vectorSafe(marker);
        svg.appendChild(marker);
        return;
      }

      const pointsAttr = mapped.map(([px, py]) => `${px.toFixed(2)},${py.toFixed(2)}`).join(' ');
      const element = document.createElementNS(svgNS, shape.kind === 'polygon' ? 'polygon' : 'polyline');
      element.setAttribute('points', pointsAttr);
      element.setAttribute('fill', shape.kind === 'polygon' ? (index % 2 ? 'rgba(43,131,255,0.16)' : 'rgba(242,176,0,0.14)') : 'none');
      element.setAttribute('stroke', stroke);
      element.setAttribute('stroke-width', shape.kind === 'polygon' ? '0.78' : '0.72');
      element.setAttribute('stroke-linejoin', 'round');
      element.setAttribute('stroke-linecap', 'round');
      vectorSafe(element);
      svg.appendChild(element);
    });

    host.appendChild(svg);
  }

  function vectorSafe(node) {
    node.setAttribute('vector-effect', 'non-scaling-stroke');
  }

  function clearPreviewMessage(host) {
    host.querySelector('.project-preview-unavailable-note')?.remove();
  }

  function setPreviewUnavailable(host, message = 'Prévia indisponível até o projeto possuir geometria salva.') {
    host.dataset.previewReady = '0';
    host.classList.remove('is-preview-ready');
    host.classList.add('is-preview-unavailable');
    clearPreviewMessage(host);
    const note = document.createElement('div');
    note.className = 'project-preview-unavailable-note';
    note.textContent = message;
    host.appendChild(note);
  }

  function applyStaticPreview(host, imageUrl, shapes, bounds, width, height) {
    clearPreviewMessage(host);
    host.classList.remove('is-placeholder', 'is-preview-unavailable');
    host.classList.add('is-preview-ready');
    host.dataset.previewReady = '1';
    host.style.removeProperty('background-image');
    host.style.removeProperty('background-position');
    host.style.removeProperty('background-size');
    host.querySelector('.project-preview-outline')?.remove();
    host.querySelector('.project-preview-static-image')?.remove();
    const image = document.createElement('img');
    image.className = 'project-preview-static-image';
    image.alt = '';
    image.decoding = 'async';
    image.loading = 'lazy';
    image.referrerPolicy = 'no-referrer';
    image.src = imageUrl;
    host.prepend(image);
    renderPreviewOverlay(host, shapes, bounds, width, height);
  }


  function applyGeographicPreview(host, imageUrl, shapes, bounds, width, height) {
    clearPreviewMessage(host);
    host.classList.remove('is-placeholder','is-preview-unavailable');
    host.classList.add('is-preview-ready');
    host.dataset.previewReady='1';
    host.querySelector('.project-preview-outline')?.remove();
    host.querySelector('.project-preview-static-image')?.remove();
    const image=document.createElement('img');
    image.className='project-preview-static-image'; image.alt=''; image.decoding='async'; image.loading='lazy'; image.referrerPolicy='no-referrer'; image.src=imageUrl;
    host.prepend(image);
    renderGeographicOverlay(host,shapes,bounds,width,height);
  }

  async function hydrateProjectPreview(project) {
    const row = document.querySelector(`.project-list-row[data-project-id="${CSS.escape(String(project.id))}"]`);
    const host = row?.querySelector('.project-card-preview');
    if (!host || host.dataset.previewLoading === '1' || host.dataset.previewReady === '1') return;
    host.dataset.previewLoading = '1';

    // A miniatura aparece imediatamente usando tiles CDN e o centro/zoom já
    // presentes no resumo do projeto. Nenhum export de imagem de 1200x720 é
    // aguardado antes de mostrar o conteúdo ao usuário.
    const summaryCenter = previewCenter(project);
    if (summaryCenter) {
      renderFastTilePreview(host, summaryCenter.lon, summaryCenter.lat, project?.defaultZoom ?? project?.metadata?.defaultZoom ?? 16);
    } else {
      host.classList.add('is-placeholder');
    }

    try {
      let full = previewCache.get(project.id);
      if (!full) {
        try {
          // Usa o cache normal da API. A versão anterior forçava refresh/noCache,
          // o que adicionava uma espera de rede desnecessária em cada expansão.
          full = await auth.getProject(project.id);
        } catch {
          full = null;
        }
        previewCache.set(project.id, full || project);
      }

      const p = full?.project || project;
      const allFeatures = [
        ...collectFeatureCandidates(full),
        ...collectFeatureCandidates(p),
        ...collectFeatureCandidates(project)
      ];
      const geoms = allFeatures.map((feature) => {
        const candidate = feature?.geoJson ?? feature?.geojson ?? feature?.feature?.geometry ?? feature?.geometry ?? feature ?? null;
        if (!candidate) return null;
        return candidate.type === 'Feature' ? candidate.geometry : (candidate.geometry || candidate);
      }).filter((geom) => geom?.type && geom?.coordinates);
      const shapes = collectRenderableShapes(geoms);
      const coords = shapes.flatMap((shape) => shape.points || []);

      let centerLon = NaN;
      let centerLat = NaN;
      if (coords.length) {
        const lons = coords.map((c) => c[0]);
        const lats = coords.map((c) => c[1]);
        centerLon = (Math.min(...lons) + Math.max(...lons)) / 2;
        centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
      } else {
        const center = previewCenter(p) || summaryCenter;
        centerLon = Number(center?.lon);
        centerLat = Number(center?.lat);
      }

      if (!Number.isFinite(centerLon) || !Number.isFinite(centerLat)) {
        if (!host.dataset.previewInstant) setPreviewUnavailable(host);
        return;
      }

      const rect = host.getBoundingClientRect();
      const width = Math.max(360, Math.round(rect.width || 420));
      const height = Math.max(200, Math.round(rect.height || 220));
      const zoom = fitTileZoom(shapes, width, height, p?.defaultZoom ?? project?.defaultZoom ?? 16);
      renderFastTilePreview(host, centerLon, centerLat, zoom, shapes);
      host.dataset.previewReady = '1';
    } catch (error) {
      console.warn('[projetos] falha ao enriquecer pré-visualização:', project?.id, error);
      // Se os tiles instantâneos já estão na tela, não substitui a miniatura por erro.
      if (!host.dataset.previewInstant) setPreviewUnavailable(host, 'Falha ao montar a miniatura deste projeto.');
    } finally {
      host.dataset.previewLoading = '0';
    }
  }

  const previewQueue = [];
  let previewWorkers = 0;
  const previewWorkerLimit = 1;

  function pumpPreviewQueue() {
    while (previewWorkers < previewWorkerLimit && previewQueue.length) {
      const project = previewQueue.shift();
      if (!project) continue;
      const host = document.querySelector(`.project-list-row[data-project-id="${CSS.escape(String(project.id))}"] .project-card-preview`);
      if (!host || host.dataset.previewReady === '1' || host.dataset.previewLoading === '1') {
        if (host) host.dataset.previewQueued = '0';
        continue;
      }
      host.dataset.previewQueued = '0';
      previewWorkers += 1;
      Promise.resolve(hydrateProjectPreview(project)).finally(() => {
        previewWorkers = Math.max(0, previewWorkers - 1);
        pumpPreviewQueue();
      });
    }
  }

  function queueProjectPreview(project) {
    const host = document.querySelector(`.project-list-row[data-project-id="${CSS.escape(String(project.id))}"] .project-card-preview`);
    if (!host || host.dataset.previewReady === '1' || host.dataset.previewLoading === '1' || host.dataset.previewQueued === '1') return;
    host.dataset.previewQueued = '1';
    previewQueue.push(project);
    pumpPreviewQueue();
  }

  function hydrateVisibleProjectPreviews(list = []) {
    const rows = [...document.querySelectorAll('.project-list-row.is-expanded[data-project-id]')];
    rows.forEach((row) => {
      const project = list.find((item) => String(item.id) === String(row.dataset.projectId)) || projects.find((item) => String(item.id) === String(row.dataset.projectId));
      if (project) queueProjectPreview(project);
    });
  }

  window.SurveyorProjectPreviews = window.SurveyorProjectPreviews || {};
  window.SurveyorProjectPreviews.refresh = () => hydrateVisibleProjectPreviews(projects);
  document.addEventListener('surveyor:projects-view-changed', () => {
    requestAnimationFrame(() => window.SurveyorProjectPreviews?.refresh?.());
  });

  function buildGeoJSON(project, features) {
    return {
      type: 'FeatureCollection',
      properties: {
        projectId: project.id,
        propertyName: project.propertyName || project.name,
        ownerName: window.GeoRuralProjects?.ownerNames?.(project) || project.ownerName || project.owner,
        municipality: project.municipality || project.city,
        stateCode: project.stateCode || project.uf,
        metadata: project.metadata || {},
        exportedAt: new Date().toISOString(),
        generatedBy: 'Surveyor'
      },
      features: (features || []).map((feature) => feature.geojson || feature.feature || feature)
    };
  }

  function coordinatesOfGeometry(geometry) {
    if (!geometry) return [];
    if (geometry.type === 'Point') return [geometry.coordinates];
    if (geometry.type === 'LineString') return geometry.coordinates || [];
    if (geometry.type === 'Polygon') return geometry.coordinates?.[0] || [];
    if (geometry.type === 'MultiLineString') return (geometry.coordinates || []).flat();
    if (geometry.type === 'MultiPolygon') return (geometry.coordinates || []).flat(2);
    return [];
  }

  function geojsonToKml(fc) {
    const placemarks = (fc.features || []).map((feature, index) => {
      const geometry = feature.geometry || {};
      const name = escapeHtml(feature.properties?.name || feature.properties?.title || `Elemento ${index + 1}`);
      const coords = coordinatesOfGeometry(geometry).map((coord) => `${coord[0]},${coord[1]},${coord[2] || 0}`).join(' ');
      let body = '';
      if (geometry.type === 'Point') body = `<Point><coordinates>${coords}</coordinates></Point>`;
      else if (/LineString/.test(geometry.type || '')) body = `<LineString><coordinates>${coords}</coordinates></LineString>`;
      else body = `<Polygon><outerBoundaryIs><LinearRing><coordinates>${coords}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
      return `<Placemark><name>${name}</name>${body}</Placemark>`;
    }).join('');
    return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>${placemarks}</Document></kml>`;
  }

  function geojsonToTxt(project, fc) {
    const lines = [
      `PROJETO: ${project.propertyName || project.name || 'SEM NOME'}`,
      `PROPRIETÁRIO: ${window.GeoRuralProjects?.ownerNames?.(project) || project.ownerName || project.owner || 'NÃO INFORMADO'}`,
      `MUNICÍPIO/UF: ${project.municipality || project.city || 'NÃO INFORMADO'}/${project.stateCode || project.uf || ''}`,
      ''
    ];
    (fc.features || []).forEach((feature, fi) => {
      const name = feature.properties?.name || feature.properties?.title || `Elemento ${fi + 1}`;
      coordinatesOfGeometry(feature.geometry).forEach((coord, ci) => lines.push(`${name};V${ci + 1};LAT=${Number(coord[1]).toFixed(8)};LON=${Number(coord[0]).toFixed(8)}`));
    });
    return lines.join('\r\n');
  }

  function geojsonToCsv(fc) {
    const rows = [['elemento','vertice','latitude','longitude','altitude']];
    (fc.features || []).forEach((feature, fi) => {
      coordinatesOfGeometry(feature.geometry).forEach((coord, ci) => rows.push([fi + 1, ci + 1, coord[1] ?? '', coord[0] ?? '', coord[2] ?? '']));
    });
    return rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(';')).join('\n');
  }

  async function downloadProject(projectId, format) {
    const result = await auth.getProject(projectId);
    const project = result.project || result;
    const features = result.features || project.features || [];
    const geojson = buildGeoJSON(project, features);
    const base = fileSafe(project.propertyName || project.name || 'projeto');
    if (format === 'geojson') return downloadBlob(`${base}.geojson`, JSON.stringify(geojson, null, 2), 'application/geo+json;charset=utf-8');
    if (format === 'kml') return downloadBlob(`${base}.kml`, geojsonToKml(geojson), 'application/vnd.google-earth.kml+xml;charset=utf-8');
    if (format === 'txt') return downloadBlob(`${base}.txt`, geojsonToTxt(project, geojson), 'text/plain;charset=utf-8');
    if (format === 'csv') return downloadBlob(`${base}-vertices.csv`, geojsonToCsv(geojson), 'text/csv;charset=utf-8');
    if (format === 'shp') {
      if (!window.SurveyorShapefileExport) throw new Error('O exportador Shapefile não foi carregado. Atualize a página com Ctrl+F5.');
      return window.SurveyorShapefileExport.open({
        featureCollection: geojson,
        baseName: base,
        mode: 'projeto salvo na nuvem',
        context: {
          propertyName: project.propertyName || project.name || '',
          ownerName: project.ownerName || project.owner || '',
          municipality: project.municipality || project.city || '',
          stateCode: project.stateCode || project.uf || ''
        },
        onStatus: showToast
      });
    }
    throw new Error('Formato de download não reconhecido.');
  }

  function showDownloadMenu(project, anchor) {
    document.querySelector('.project-download-popover')?.remove();
    const popover = document.createElement('div');
    popover.className = 'project-download-popover';
    popover.innerHTML = `
      <button type="button" data-format="kml">KML</button>
      <button type="button" data-format="txt">TXT</button>
      <button type="button" data-format="geojson">GeoJSON</button>
      <button type="button" data-format="csv">CSV</button>
      <button type="button" data-format="shp">Shapefile</button>`;
    document.body.append(popover);
    const rect = anchor.getBoundingClientRect();
    popover.style.top = `${Math.min(window.innerHeight - popover.offsetHeight - 10, rect.bottom + 6)}px`;
    popover.style.left = `${Math.max(10, rect.right - popover.offsetWidth)}px`;
    popover.querySelectorAll('[data-format]').forEach((button) => button.addEventListener('click', async () => {
      popover.remove();
      try {
        const result = await downloadProject(project.id, button.dataset.format);
        if (button.dataset.format !== 'shp' && result !== null) showToast('Download gerado.', 'success');
      } catch (error) {
        showToast(error.message || 'Não foi possível gerar o download.', 'error');
      }
    }));
    setTimeout(() => document.addEventListener('click', function close(event) {
      if (!popover.contains(event.target)) {
        popover.remove();
        document.removeEventListener('click', close);
      }
    }), 0);
  }

  function workspaceActivityLabel(item={}) {
    const action=String(item.action||'').toLowerCase();
    const actor=item.actorName||item.actorEmail||'Usuário';
    const target=item.metadata?.projectName||item.metadata?.documentName||item.targetName||item.target||'';
    const map={project_created:'criou',project_opened:'abriu',project_bundle_saved:'salvou',project_updated:'alterou',document_created:'gerou',document_updated:'atualizou',login_success:'entrou no sistema',logout:'saiu do sistema'};
    const verb=map[action]||'realizou uma atividade em';
    const kind=action.startsWith('document_')?'documento':action.startsWith('project_')?'projeto':'';
    return `${actor} ${verb}${kind&&target?' o '+kind:''}${target?' “'+target+'”':''}`;
  }

  async function loadWorkspaceActivity(){
    const panel=$('workspaceActivityPanel'), host=$('workspaceActivityList');
    if(!panel||!host||!auth?.apiFetch)return;
    try{
      const data=await auth.apiFetch('/api/workspace/activity?limit=12',{method:'GET',noCache:true});
      const items=Array.isArray(data?.activity)?data.activity:[];
      if(!items.length){panel.hidden=true;return}
      panel.hidden=false;
      host.innerHTML=items.slice(0,12).map(item=>`<article><span class="workspace-activity-dot"></span><div><b>${escapeHtml(workspaceActivityLabel(item))}</b><small>${item.createdAt?new Date(item.createdAt).toLocaleString('pt-BR'):'—'}</small></div></article>`).join('');
    }catch(error){console.warn('[Surveyor workspace activity]',error?.message||error);panel.hidden=true}
  }

  function render() {
    const search = String($('projectSearch')?.value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const sort = $('projectSort')?.value || 'recent';
    const filtered = projects.filter((project) => {
      const text = [project.propertyName, project.name, project.ownerName, project.owner, project.municipality, project.city, project.stateCode, project.uf, project.createdByName, project.lastSavedByName]
        .filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      return !search || text.includes(search);
    }).sort((a,b) => sort === 'name'
      ? String(a.propertyName || a.name || '').localeCompare(String(b.propertyName || b.name || ''))
      : new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));

    renderStorageStatus();
    if ($('projectsCount')) $('projectsCount').textContent = String(filtered.length);

    const host = $('projectsList');
    if (!host) return;
    host.classList.add('is-accordion-view');
    if (!filtered.length) {
      host.innerHTML = '<div class="empty-box">Nenhum projeto encontrado.</div>';
      return;
    }
    host.innerHTML = filtered.map((project) => {
      const title = project.propertyName || project.name || 'Projeto sem nome';
      const owner = window.GeoRuralProjects?.ownerNames?.(project) || project.ownerName || project.owner || 'Proprietário não informado';
      const city = project.municipality || project.city || 'Município não informado';
      const uf = project.stateCode || project.uf || '';
      const count = Number(project.featureCount || project.metadata?.featureCount || 0);
      const updated = project.updatedAt || project.createdAt;
      const areaHa = Number(project.areaHa || project.metadata?.areaHa || project.metadata?.hectares || project.areaHectares || 0);
      const expanded = String(expandedProjectId) === String(project.id);
      return `<article class="project-list-row${expanded ? ' is-expanded' : ''}" data-project-id="${escapeHtml(project.id)}">
        <button type="button" class="project-list-summary" data-action="toggle-preview" aria-expanded="${expanded ? 'true' : 'false'}">
          <span class="project-list-main">
            <strong>${escapeHtml(title)}</strong>
            <span class="project-owner">${escapeHtml(owner)}</span>${project.createdByName ? `<small class="project-created-by">Feito por: <b>${escapeHtml(project.createdByName)}</b></small>` : `<small class="project-created-by is-unknown">Autor não identificado</small>`}
          </span>
          <span class="project-list-meta">
            <span>${projectUiIcon('place')} ${escapeHtml(city)}${uf ? `/${escapeHtml(uf)}` : ''}</span>
            ${areaHa > 0 ? `<span>${projectUiIcon('area')} ${areaHa.toLocaleString('pt-BR',{maximumFractionDigits:4})} ha</span>` : `<span>${projectUiIcon('layers')} ${count} elemento(s)</span>`}
            <span>${projectUiIcon('time')} ${updated ? new Date(updated).toLocaleString('pt-BR') : 'Sem data'}</span>
          </span>
          <span class="project-expand-toggle">
            <span>${expanded ? 'Ocultar miniatura' : 'Expandir miniatura'}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9 5 5 5-5"/></svg>
          </span>
        </button>
        ${expanded ? `<div class="project-list-expanded">
          <div class="project-card-preview is-placeholder">
            <span class="project-preview-outline" aria-hidden="true"></span>
            <span class="project-cloud-pill">${projectUiIcon('cloud')}<span>Nuvem</span></span>
          </div>
          <div class="project-expanded-side">
            <div class="project-expanded-copy">
              <strong>Miniatura do projeto</strong>
              <span>A miniatura abre imediatamente; o perímetro do projeto é refinado em segundo plano.</span>
            </div>
            <div class="project-list-actions">
              <button type="button" data-action="view" title="Abrir no mapa" aria-label="Abrir no mapa" class="project-icon-button">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h6l2 2h8v12H4V5Z"/><path d="M9 13h6m-3-3 3 3-3 3"/></svg>
              </button>
              ${auth.hasPermission?.('projects:export-zip') ? `<button type="button" data-action="batch" title="Gerar peças na Central de Lotes" aria-label="Gerar peças na Central de Lotes" class="project-icon-button">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h6l2 2h8v12H4V5Z"/><path d="M12 10v8m-4-4h8"/></svg>
              </button>` : ''}
              <button type="button" data-action="download" title="Baixar projeto" aria-label="Baixar projeto" class="project-icon-button">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 20h14"/></svg>
              </button>
              <button type="button" data-action="delete" title="Excluir projeto" aria-label="Excluir projeto" class="project-icon-button project-delete-button">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"/></svg>
              </button>
            </div>
          </div>
        </div>` : ''}
      </article>`;
    }).join('');

    const expandedProject = filtered.find((project) => String(project.id) === String(expandedProjectId));
    if (expandedProject) requestAnimationFrame(() => queueProjectPreview(expandedProject));
  }

  $('workspaceActivityRefresh')?.addEventListener('click',loadWorkspaceActivity);
  $('projectsList')?.addEventListener('click', async (event) => {
    const control = event.target.closest('[data-action]');
    const row = event.target.closest('[data-project-id]');
    if (!control || !row) return;
    const project = projects.find((item) => String(item.id) === String(row.dataset.projectId));
    if (!project) return;
    const action = control.dataset.action;
    if (action === 'toggle-preview') {
      expandedProjectId = String(expandedProjectId) === String(project.id) ? '' : String(project.id);
      render();
      return;
    }
    if (action === 'view') location.href = `/mapa/?project=${encodeURIComponent(project.id)}`;
    if (action === 'batch' && auth.hasPermission?.('projects:export-zip')) location.href = `/central-lotes/?project=${encodeURIComponent(project.id)}`;
    if (action === 'download') showDownloadMenu(project, control);
    if (action === 'delete' && confirm(`Excluir o projeto “${project.propertyName || project.name || 'Projeto'}”?`)) {
      control.disabled = true;
      try {
        await auth.deleteProject(project.id);
        if (String(expandedProjectId) === String(project.id)) expandedProjectId = '';
        projects = await auth.listProjects({ noCache: true, refresh: true });
        render();
        showToast('Projeto excluído.', 'success');
      } catch (error) {
        showToast(error.message || 'Não foi possível excluir o projeto.', 'error');
      } finally {
        control.disabled = false;
      }
    }
  });

  $('projectSearch')?.addEventListener('input', render);
  $('projectSort')?.addEventListener('change', render);

  loadStorageStatus().catch(()=>{});
  auth.listProjects({ noCache: true, refresh: true }).then((items) => {
    projects = Array.isArray(items) ? items : [];
    render();
  }).catch((error) => {
    showToast(error.message || 'Não foi possível carregar os projetos.', 'error');
    render();
  });
  loadWorkspaceActivity().catch(()=>{});
})();
