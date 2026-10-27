(() => {
  'use strict';

  const MB = 1024 * 1024;
  const MAX_ZIP_BYTES = 1024 * MB;
  const MAX_CONVERTED_BYTES = 1024 * MB;
  const MAX_BROWSER_GEOJSON_BYTES = 96 * MB;
  const WORKER_URL = '/assets/js/workers/layer-import-worker.js?v=1.0.0-rc.185.74';
  let activeJob = null;
  const largeSessions = new Map();
  let largeQuerySerial = 0;

  function registerLargeSession(worker, meta = {}) {
    const sessionId = `large-local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    const pending = new Map();
    const onMessage = (event) => {
      const data = event.data || {};
      if (data.type !== 'query-result' && data.type !== 'query-error') return;
      const item = pending.get(data.requestId);
      if (!item) return;
      pending.delete(data.requestId);
      clearTimeout(item.timer);
      if (data.type === 'query-error') item.reject(new Error(data.message || 'Falha ao consultar a camada local.'));
      else item.resolve(data.data || { type: 'FeatureCollection', features: [], meta: { returned: 0, truncated: false } });
    };
    worker.addEventListener('message', onMessage);
    largeSessions.set(sessionId, { worker, pending, onMessage, meta });
    return {
      sessionId,
      featureCount: Number(meta.featureCount || 0),
      estimatedBytes: Number(meta.estimatedBytes || meta.bytes || 0),
      bounds: Array.isArray(meta.bounds) ? meta.bounds.map(Number) : null
    };
  }

  function queryLargeSession(sessionId, bbox, limit = 1500) {
    const session = largeSessions.get(sessionId);
    if (!session) return Promise.reject(new Error('A camada local grande não está mais disponível. Importe o Shapefile novamente.'));
    const requestId = `q${++largeQuerySerial}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        session.pending.delete(requestId);
        reject(new Error('A consulta local demorou mais do que o esperado. Aproxime o mapa e tente novamente.'));
      }, 30000);
      session.pending.set(requestId, { resolve, reject, timer });
      session.worker.postMessage({ type: 'query-large-layer', requestId, bbox, limit });
    });
  }

  function disposeLargeSession(sessionId) {
    const session = largeSessions.get(sessionId);
    if (!session) return false;
    largeSessions.delete(sessionId);
    for (const item of session.pending.values()) { clearTimeout(item.timer); item.reject(new Error('Camada local encerrada.')); }
    session.pending.clear();
    try { session.worker.postMessage({ type: 'dispose-large-layer' }); } catch {}
    setTimeout(() => { try { session.worker.terminate(); } catch {} }, 50);
    return true;
  }

  window.addEventListener('beforeunload', () => {
    for (const sessionId of [...largeSessions.keys()]) disposeLargeSession(sessionId);
  });

  const normalizeCollection = (value) => {
    if (Array.isArray(value)) {
      const features = value.flatMap((item) => item?.type === 'FeatureCollection' ? item.features || [] : item?.type === 'Feature' ? [item] : []);
      return { type: 'FeatureCollection', features };
    }
    if (value?.type === 'FeatureCollection') return value;
    if (value?.type === 'Feature') return { type: 'FeatureCollection', features: [value] };
    if (value?.type && value?.coordinates) return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: value }] };
    throw new Error('O arquivo não contém uma camada geográfica reconhecida.');
  };

  const parsePairs = (text) => String(text || '')
    .trim()
    .replace(/,\s+/g, ',')
    .split(/\s+/)
    .map((part) => part.split(',').slice(0, 2).map((value) => Number(String(value).trim())))
    .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));

  function parseKml(text) {
    const xml = new DOMParser().parseFromString(String(text || ''), 'application/xml');
    if (xml.querySelector('parsererror')) throw new Error('O KML está inválido.');
    const localName = (node) => String(node?.localName || node?.nodeName || '').split(':').pop().toLowerCase();
    const elements = (root, name) => Array.from(root?.getElementsByTagName?.('*') || []).filter((node) => localName(node) === name.toLowerCase());
    const first = (root, name) => elements(root, name)[0] || null;
    const direct = (root, name) => Array.from(root?.children || []).filter((node) => localName(node) === name.toLowerCase());
    const textOf = (root, name) => first(root, name)?.textContent?.trim() || '';
    const closeRing = (coords) => {
      if (!coords.length) return coords;
      const a = coords[0];
      const b = coords[coords.length - 1];
      if (a[0] !== b[0] || a[1] !== b[1]) coords.push([...a]);
      return coords;
    };
    const gxCoords = (track) => elements(track, 'coord')
      .map((node) => String(node.textContent || '').trim().split(/\s+/).slice(0, 2).map(Number))
      .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
    const propsFromPlacemark = (placemark, index) => {
      const props = { name: textOf(placemark, 'name') || `Elemento ${index + 1}` };
      elements(placemark, 'data').forEach((node) => {
        const key = node.getAttribute('name');
        if (key) props[key] = textOf(node, 'value');
      });
      elements(placemark, 'simpledata').forEach((node) => {
        const key = node.getAttribute('name');
        if (key) props[key] = node.textContent || '';
      });
      return props;
    };
    const polygonRings = (polygon) => {
      const outerNode = first(polygon, 'outerboundaryis') || polygon;
      const outerRingNode = first(outerNode, 'linearring') || outerNode;
      const outer = closeRing(parsePairs(textOf(outerRingNode, 'coordinates')));
      if (outer.length < 4) return null;
      const holes = elements(polygon, 'innerboundaryis')
        .map((innerNode) => {
          const ringNode = first(innerNode, 'linearring') || innerNode;
          const ring = closeRing(parsePairs(textOf(ringNode, 'coordinates')));
          return ring.length >= 4 ? ring : null;
        })
        .filter(Boolean);
      return [outer, ...holes];
    };
    const features = [];
    const addFeature = (properties, geometry, suffix = '') => {
      const props = { ...properties };
      if (suffix) props.name = `${properties.name} ${suffix}`;
      features.push({ type: 'Feature', properties: props, geometry });
    };
    const parseContainer = (container, index) => {
      const baseProps = propsFromPlacemark(container, index);
      let count = 0;
      elements(container, 'polygon').forEach((polygon) => {
        const rings = polygonRings(polygon);
        if (rings) { count += 1; addFeature(baseProps, { type: 'Polygon', coordinates: rings }, count > 1 ? `(${count})` : ''); }
      });
      elements(container, 'linestring').forEach((line) => {
        const coords = parsePairs(textOf(line, 'coordinates'));
        if (coords.length >= 2) { count += 1; addFeature(baseProps, { type: 'LineString', coordinates: coords }, count > 1 ? `(${count})` : ''); }
      });
      elements(container, 'point').forEach((point) => {
        const coord = parsePairs(textOf(point, 'coordinates'))[0];
        if (coord) { count += 1; addFeature(baseProps, { type: 'Point', coordinates: coord }, count > 1 ? `(${count})` : ''); }
      });
      elements(container, 'track').forEach((track) => {
        const coords = gxCoords(track);
        if (coords.length >= 2) { count += 1; addFeature(baseProps, { type: 'LineString', coordinates: coords }, count > 1 ? `(${count})` : ''); }
        else if (coords.length === 1) { count += 1; addFeature(baseProps, { type: 'Point', coordinates: coords[0] }, count > 1 ? `(${count})` : ''); }
      });
      if (!count) {
        direct(container, 'linearring').forEach((ring) => {
          const coords = closeRing(parsePairs(textOf(ring, 'coordinates')));
          if (coords.length >= 4) addFeature(baseProps, { type: 'Polygon', coordinates: [coords] });
        });
      }
    };
    const placemarks = elements(xml, 'placemark');
    if (placemarks.length) placemarks.forEach(parseContainer);
    else parseContainer(xml, 0);
    if (!features.length) throw new Error('Nenhuma geometria foi encontrada no KML. Aceito: Polygon, LineString, Point e gx:Track.');
    return { type: 'FeatureCollection', features };
  }

  function splitCsvLine(line, delimiter) {
    const out = []; let current = ''; let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') { current += '"'; i += 1; }
        else quoted = !quoted;
      } else if (ch === delimiter && !quoted) { out.push(current.trim()); current = ''; }
      else current += ch;
    }
    out.push(current.trim());
    return out;
  }

  function parseCsv(text) {
    const lines = String(text || '').split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) throw new Error('O CSV precisa ter cabeçalho e ao menos uma coordenada.');
    const delimiter = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
    const headers = splitCsvLine(lines[0], delimiter).map((v) => v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    const latIndex = headers.findIndex((v) => /^(lat|latitude|coord[_ ]?n|norte)$/.test(v) || v.includes('latitude'));
    const lngIndex = headers.findIndex((v) => /^(lon|lng|longitude|coord[_ ]?e|leste)$/.test(v) || v.includes('longitude'));
    if (latIndex < 0 || lngIndex < 0) throw new Error('O CSV precisa ter colunas de latitude e longitude.');
    const nameIndex = headers.findIndex((v) => ['nome', 'name', 'codigo', 'vertice'].includes(v));
    const points = lines.slice(1).map((line, index) => {
      const values = splitCsvLine(line, delimiter);
      const lat = Number(String(values[latIndex] || '').replace(',', '.'));
      const lng = Number(String(values[lngIndex] || '').replace(',', '.'));
      return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, name: values[nameIndex] || `Ponto ${index + 1}` } : null;
    }).filter(Boolean);
    if (!points.length) throw new Error('Nenhuma coordenada válida foi encontrada no CSV.');
    if (points.length >= 3) {
      const coords = points.map((p) => [p.lng, p.lat]);
      const first = coords[0], last = coords[coords.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) coords.push([...first]);
      return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { name: 'Camada importada do CSV' }, geometry: { type: 'Polygon', coordinates: [coords] } }] };
    }
    return { type: 'FeatureCollection', features: points.map((p) => ({ type: 'Feature', properties: { name: p.name }, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } })) };
  }


  function parseRw5(text) {
    const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) throw new Error('O arquivo RW5/RAW está vazio.');
    const points = [];
    const seen = new Set();
    const numeric = (value) => {
      const raw = String(value ?? '').trim();
      if (!raw) return null;
      const parsed = Number(raw.replace(',', '.'));
      return Number.isFinite(parsed) ? parsed : null;
    };
    const fieldValue = (parts, prefixes) => {
      const list = (Array.isArray(prefixes) ? prefixes : [prefixes]).slice().sort((a,b) => String(b).length - String(a).length);
      for (const part of parts) {
        const token = String(part || '').trim();
        for (const prefix of list) {
          if (token.toUpperCase().startsWith(prefix.toUpperCase())) return token.slice(prefix.length).trim();
        }
      }
      return '';
    };
    lines.forEach((line, index) => {
      if (/^(?:--|;|#)/.test(line)) return;
      const parts = line.split(',').map((item) => item.trim());
      const code = String(parts[0] || '').toUpperCase();
      if (!/^(SP|MP|OC|BK|BP|GS|GPS|PT|PN)$/.test(code) && !parts.some((item) => /^PN\s*[-+\w]/i.test(item))) return;
      const name = fieldValue(parts, ['PN']) || fieldValue(parts, ['PT']) || `P-${points.length + 1}`;
      const north = numeric(fieldValue(parts, ['N '] ) || fieldValue(parts, ['N'])) ;
      const east = numeric(fieldValue(parts, ['E '] ) || fieldValue(parts, ['E'])) ;
      const elev = numeric(fieldValue(parts, ['EL']) || fieldValue(parts, ['Z'])) ;
      const lat = numeric(fieldValue(parts, ['LAT','LA'])) ;
      const lng = numeric(fieldValue(parts, ['LON','LONG','LN','LO']));
      let coordinates = null;
      let coordinateMode = 'projected';
      if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        coordinates = [lng, lat];
        coordinateMode = 'geographic';
      } else if (Number.isFinite(east) && Number.isFinite(north)) {
        coordinates = [east, north];
      }
      if (!coordinates) return;
      const key = `${name}|${coordinates[0]}|${coordinates[1]}`;
      if (seen.has(key)) return;
      seen.add(key);
      const descriptionToken = parts.find((item) => /^--/.test(item));
      const description = descriptionToken ? descriptionToken.replace(/^--+/, '').trim() : '';
      points.push({
        type: 'Feature',
        properties: {
          name: String(name).trim() || `P-${points.length + 1}`,
          category: 'marco',
          sourceFormat: 'RW5',
          rw5RecordType: code || 'POINT',
          rw5Line: index + 1,
          coordinateMode,
          elevation: Number.isFinite(elev) ? elev : null,
          description
        },
        geometry: { type: 'Point', coordinates }
      });
    });
    if (!points.length) {
      throw new Error('Nenhum ponto reconhecido no RW5/RAW. O importador aceita registros de ponto com PN e coordenadas N/E ou latitude/longitude.');
    }
    const projected = points.some((feature) => feature.properties.coordinateMode === 'projected');
    return {
      type: 'FeatureCollection',
      properties: { sourceFormat: 'RW5', projectedCoordinates: projected, pointCount: points.length },
      features: points
    };
  }

  function collectionToBlob(collection) {
    const features = Array.isArray(collection?.features) ? collection.features : [];
    const parts = ['{"type":"FeatureCollection","features":['];
    for (let index = 0; index < features.length; index += 1) {
      const featureText = JSON.stringify(features[index]);
      if (index) parts.push(',');
      parts.push(featureText);
    }
    parts.push(']}');
    return new Blob(parts, { type: 'application/geo+json' });
  }

  function cancelCurrentImport() {
    if (!activeJob) return false;
    activeJob.cancelled = true;
    try { activeJob.reader?.abort(); } catch {}
    try { activeJob.worker?.terminate(); } catch {}
    activeJob.reject?.(new Error('Conversão cancelada pelo usuário.'));
    activeJob = null;
    return true;
  }

  function readFileBuffer(file, onProgress) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      if (activeJob) activeJob.reader = reader;
      reader.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const percent = Math.max(1, Math.min(8, Math.round((event.loaded / event.total) * 8)));
        onProgress({ stage: 'reading', percent, message: `Lendo arquivo: ${percent}%...` });
      };
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'));
      reader.onabort = () => reject(new Error('Conversão cancelada pelo usuário.'));
      reader.readAsArrayBuffer(file);
    });
  }


  const SHAPE_COMPONENT_RE = /\.(shp|shx|dbf|prj|cpg|sbn|sbx)$/i;

  async function readShapeParts(files, onProgress) {
    const selected = [...files].filter((file) => SHAPE_COMPONENT_RE.test(file.name));
    if (!selected.some((file) => /\.shp$/i.test(file.name))) throw new Error('Selecione também o arquivo .SHP do Shapefile.');
    if (!selected.some((file) => /\.dbf$/i.test(file.name))) throw new Error('Selecione também o arquivo .DBF do Shapefile.');
    const totalBytes = selected.reduce((sum, file) => sum + Number(file.size || 0), 0);
    if (totalBytes > MAX_ZIP_BYTES) throw new Error('Os arquivos do Shapefile ultrapassam o limite máximo de 1 GB.');
    const items = [];
    let loaded = 0;
    for (const file of selected) {
      onProgress({ stage: 'reading', percent: Math.min(8, Math.max(1, Math.round((loaded / Math.max(totalBytes, 1)) * 8))), message: `Lendo componente ${file.name}...` });
      const buffer = await readFileBuffer(file, onProgress);
      loaded += Number(file.size || 0);
      items.push({ name: file.name, buffer });
    }
    return items;
  }

  async function parseShapeFilesInWorker(files, onProgress) {
    if (!window.Worker) throw new Error('Seu navegador não oferece processamento em segundo plano. Atualize o Edge, Chrome ou Brave.');

    return new Promise(async (resolve, reject) => {
      const worker = new Worker(WORKER_URL);
      activeJob = { worker, reader: null, reject, cancelled: false };

      worker.onmessage = (event) => {
        const data = event.data || {};
        if (data.type === 'progress') {
          onProgress({ stage: data.stage, percent: data.percent, message: data.message });
          return;
        }
        if (data.type === 'error') {
          worker.terminate();
          activeJob = null;
          reject(new Error(data.message || 'Não foi possível converter o Shapefile.'));
          return;
        }
        if (data.type === 'result') {
          activeJob = null;
          if (data.largeLocal) {
            worker.onmessage = null;
            const localLarge = registerLargeSession(worker, data);
            resolve({ localLarge, jsonBlob: null, bytes: Number(data.bytes || data.estimatedBytes || 0), featureCount: Number(data.featureCount || 0) });
          } else {
            worker.terminate();
            resolve({ jsonBlob: data.jsonBlob, bytes: Number(data.bytes || 0), featureCount: Number(data.featureCount || 0) });
          }
        }
      };
      worker.onerror = (event) => {
        worker.terminate();
        activeJob = null;
        reject(new Error(event.message || 'O processador em segundo plano falhou durante a conversão.'));
      };

      try {
        onProgress({ stage: 'reading', percent: 1, message: 'Lendo componentes do Shapefile...' });
        const packedFiles = await readShapeParts(files, onProgress);
        if (!activeJob || activeJob.cancelled) return;
        onProgress({ stage: 'parsing', percent: 12, message: 'Convertendo Shapefile em segundo plano...' });
        const transfer = packedFiles.map((item) => item.buffer);
        worker.postMessage({ type: 'parse-shapefile', files: packedFiles }, transfer);
      } catch (error) {
        worker.terminate();
        activeJob = null;
        reject(error);
      }
    });
  }

  async function parseShapeFileInWorker(file, onProgress) {
    if (!window.Worker) throw new Error('Seu navegador não oferece processamento em segundo plano. Atualize o Edge, Chrome ou Brave.');

    return new Promise(async (resolve, reject) => {
      const worker = new Worker(WORKER_URL);
      activeJob = { worker, reader: null, reject, cancelled: false };

      worker.onmessage = (event) => {
        const data = event.data || {};
        if (data.type === 'progress') {
          onProgress({ stage: data.stage, percent: data.percent, message: data.message });
          return;
        }
        if (data.type === 'error') {
          worker.terminate();
          activeJob = null;
          reject(new Error(data.message || 'Não foi possível converter o ZIP.'));
          return;
        }
        if (data.type === 'result') {
          activeJob = null;
          if (data.largeLocal) {
            worker.onmessage = null;
            const localLarge = registerLargeSession(worker, data);
            resolve({ localLarge, jsonBlob: null, bytes: Number(data.bytes || data.estimatedBytes || 0), featureCount: Number(data.featureCount || 0) });
          } else {
            worker.terminate();
            resolve({ jsonBlob: data.jsonBlob, bytes: Number(data.bytes || 0), featureCount: Number(data.featureCount || 0) });
          }
        }
      };
      worker.onerror = (event) => {
        worker.terminate();
        activeJob = null;
        reject(new Error(event.message || 'O processador em segundo plano falhou durante a conversão.'));
      };

      try {
        onProgress({ stage: 'reading', percent: 1, message: 'Lendo o arquivo ZIP...' });
        const buffer = await readFileBuffer(file, onProgress);
        if (!activeJob || activeJob.cancelled) return;
        onProgress({ stage: 'parsing', percent: 10, message: 'Convertendo Shapefile em segundo plano...' });
        worker.postMessage({ type: 'parse-shapefile', buffer }, [buffer]);
      } catch (error) {
        worker.terminate();
        activeJob = null;
        reject(error);
      }
    });
  }


  function normalizeParsedShape(value) {
    if (Array.isArray(value)) {
      const features = value.flatMap((item) => normalizeCollection(item).features || []);
      return { type: 'FeatureCollection', features };
    }
    return normalizeCollection(value);
  }

  function parsedShapeResult(value) {
    const geojson = normalizeParsedShape(value);
    const jsonBlob = collectionToBlob(geojson);
    return {
      geojson: jsonBlob.size <= MAX_BROWSER_GEOJSON_BYTES ? geojson : null,
      jsonBlob,
      bytes: jsonBlob.size,
      featureCount: Array.isArray(geojson.features) ? geojson.features.length : 0
    };
  }

  async function parseShapeZipOnMainThread(file, onProgress) {
    if (typeof window.shp !== 'function') throw new Error('O leitor Shapefile não foi carregado. Atualize a página e tente novamente.');
    onProgress({ stage: 'fallback', percent: 14, message: 'Usando conversor compatível no navegador...' });
    const buffer = await readFileBuffer(file, onProgress);
    const parsed = await window.shp(buffer);
    return parsedShapeResult(parsed);
  }

  async function parseShapePartsOnMainThread(files, onProgress) {
    if (typeof window.shp !== 'function') throw new Error('O leitor Shapefile não foi carregado. Atualize a página e tente novamente.');
    const selected = [...files].filter((file) => SHAPE_COMPONENT_RE.test(file.name));
    const find = (ext) => selected.find((file) => new RegExp(`\\.${ext}$`, 'i').test(file.name));
    const shpFile = find('shp');
    const dbfFile = find('dbf');
    if (!shpFile || !dbfFile) throw new Error('Selecione pelo menos os arquivos .SHP e .DBF do mesmo Shapefile.');
    onProgress({ stage: 'fallback', percent: 14, message: 'Lendo os componentes do Shapefile no navegador...' });
    const shpBuffer = await readFileBuffer(shpFile, onProgress);
    const dbfBuffer = await readFileBuffer(dbfFile, onProgress);
    const prjFile = find('prj');
    const cpgFile = find('cpg');
    const prj = prjFile ? await prjFile.text() : undefined;
    const cpg = cpgFile ? (await cpgFile.text()).trim() : undefined;
    if (typeof window.shp.parseShp !== 'function' || typeof window.shp.parseDbf !== 'function' || typeof window.shp.combine !== 'function') {
      throw new Error('Esta versão do leitor não suporta componentes separados. Compacte .SHP, .SHX, .DBF e .PRJ em um ZIP.');
    }
    const geometries = window.shp.parseShp(shpBuffer, prj);
    const attributes = window.shp.parseDbf(dbfBuffer, cpg);
    const parsed = window.shp.combine([geometries, attributes]);
    return parsedShapeResult(parsed);
  }

  async function filesToGeoJSON(fileList, onProgress = () => {}) {
    const files = [...(fileList || [])];
    if (!files.length) return null;

    const file = files[0];
    const totalBytes = files.reduce((sum, item) => sum + Number(item.size || 0), 0);
    if (totalBytes > MAX_ZIP_BYTES) throw new Error('O arquivo ultrapassa o limite máximo de 1 GB.');

    const name = file.name.toLowerCase();
    const hasShapeParts = files.some((item) => SHAPE_COMPONENT_RE.test(item.name));
    const originalFormat = name.endsWith('.zip') || hasShapeParts ? 'shapefile'
      : name.endsWith('.kml') ? 'kml'
      : name.endsWith('.csv') ? 'csv'
      : 'geojson';

    let geojson = null;
    let jsonBlob = null;
    let bytes = 0;
    let featureCount = 0;
    let localLarge = null;

    if (originalFormat === 'shapefile') {
      let result;
      try {
        result = hasShapeParts && !name.endsWith('.zip')
          ? await parseShapeFilesInWorker(files, onProgress)
          : await parseShapeFileInWorker(file, onProgress);
      } catch (workerError) {
        console.warn('Worker Shapefile indisponível; usando fallback compatível.', workerError);
        result = hasShapeParts && !name.endsWith('.zip')
          ? await parseShapePartsOnMainThread(files, onProgress)
          : await parseShapeZipOnMainThread(file, onProgress);
      }
      jsonBlob = result.jsonBlob;
      bytes = result.bytes;
      featureCount = result.featureCount;
      localLarge = result.localLarge || null;
      geojson = result.geojson || null;
      if (!localLarge && !geojson && bytes <= MAX_BROWSER_GEOJSON_BYTES) {
        onProgress({ stage: 'finalizing', percent: 97, message: 'Finalizando e validando geometrias...' });
        geojson = normalizeCollection(JSON.parse(await jsonBlob.text()));
      }
    } else {
      onProgress({ stage: 'reading', percent: 5, message: `Lendo ${originalFormat.toUpperCase()}...` });
      const text = await file.text();
      if (originalFormat === 'kml') geojson = parseKml(text);
      else if (originalFormat === 'csv') geojson = parseCsv(text);
      else {
        try { geojson = normalizeCollection(JSON.parse(text)); }
        catch { throw new Error('O arquivo JSON/GeoJSON não é válido.'); }
      }
      jsonBlob = collectionToBlob(geojson);
      bytes = jsonBlob.size;
      featureCount = Array.isArray(geojson.features) ? geojson.features.length : 1;
    }

    if (geojson && window.GeoRuralCRS?.normalizeGeoJSON) {
      try {
        const normalized = window.GeoRuralCRS.normalizeGeoJSON(geojson);
        geojson = normalized.geojson;
        jsonBlob = collectionToBlob(geojson);
        bytes = jsonBlob.size;
        featureCount = Array.isArray(geojson.features) ? geojson.features.length : featureCount;
      } catch (error) {
        if (error?.code === 'CRS_REQUIRED') {
          throw new Error('O arquivo usa coordenadas projetadas, mas não informa o EPSG. Salve o CRS no arquivo ou importe pelo mapa para informar o código, como EPSG:31984.');
        }
        throw error;
      }
    }

    if (!localLarge && bytes > MAX_CONVERTED_BYTES) throw new Error('A camada convertida ultrapassou 1 GB. Divida o Shapefile em partes menores antes de enviar.');
    onProgress({ stage: 'ready', percent: 100, message: localLarge ? 'Camada grande indexada localmente. O mapa carregará somente o que estiver visível.' : 'Conversão concluída e normalizada em EPSG:4326.' });

    return {
      geojson,
      jsonBlob: bytes > 18 * MB ? jsonBlob : null,
      originalFormat,
      fileNames: files.map((item) => item.name),
      originalBytes: totalBytes,
      bytes,
      featureCount,
      localLarge
    };
  }

  window.GeoRuralLayerImport = Object.freeze({
    filesToGeoJSON,
    cancelCurrentImport,
    parseKml,
    parseCsv,
    parseRw5,
    normalizeCollection,
    collectionToBlob,
    queryLargeSession,
    disposeLargeSession,
    MAX_ZIP_BYTES,
    MAX_BROWSER_GEOJSON_BYTES
  });
})();
