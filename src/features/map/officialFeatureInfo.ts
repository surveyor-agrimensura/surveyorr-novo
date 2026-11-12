import type { Geometry } from 'geojson';
import { GEOSERVICES_BASE, layerProxyUrl, type OfficialLayer } from './geoServices';

export type OfficialInfoStatus = 'loading' | 'found' | 'empty' | 'unavailable';
export type OfficialInfoTarget =
  | { id: string; label: string; group: string; kind: 'wms'; layer: OfficialLayer }
  | { id: string; label: string; group: string; kind: 'arcgis'; endpoint: string };
export type OfficialInfoResult = {
  id: string;
  label: string;
  group: string;
  status: OfficialInfoStatus;
  attributes: Record<string, unknown> | null;
  geometry?: Geometry | null;
};

const SIGEF_PUBLIC_QUERY = 'https://pamgia.ibama.gov.br/server/rest/services/01_Publicacoes_Bases/lim_imovel_sigef_publico_a/FeatureServer/10/query';

/** Camada CAR/CEFIR ativa e camada pública SIGEF creditada ao INCRA. */
export function officialInfoTargets(activeLayers: OfficialLayer[]): OfficialInfoTarget[] {
  const targets: OfficialInfoTarget[] = activeLayers.map(layer => ({
    id: 'active:' + layer.id,
    label: layer.name,
    group: layer.id.startsWith('sicar') ? 'CAR / SICAR' : layer.id.startsWith('cefir') ? 'CAR / CEFIR' : layer.source,
    kind: 'wms' as const,
    layer
  }));
  targets.push({
    id: 'sigef-incra-public',
    label: 'SIGEF Público · INCRA (PAMGIA/IBAMA)',
    group: 'INCRA / SIGEF',
    kind: 'arcgis',
    endpoint: SIGEF_PUBLIC_QUERY
  });
  return targets;
}

export type WmsPoint = { bbox: [number, number, number, number]; width: number; height: number; x: number; y: number; lat: number; lng: number };
type ParsedInfo = { kind: 'found' | 'empty' | 'unrecognized'; attributes?: Record<string, unknown>; geometry?: Geometry | null };

function firstJsonFeature(payload: unknown): ParsedInfo {
  if (!payload || typeof payload !== 'object') return { kind: 'unrecognized' };
  if (Array.isArray(payload)) {
    const first = payload.find(item => item && typeof item === 'object');
    if (!first) return { kind: 'empty' };
    const row = first as { properties?: Record<string, unknown>; geometry?: Geometry | null };
    const values = row.properties || Object.fromEntries(Object.entries(first).filter(([key, value]) => !['geometry', 'bbox', 'crs'].includes(key.toLowerCase()) && (value == null || ['string', 'number', 'boolean'].includes(typeof value))));
    return Object.keys(values).length ? { kind: 'found', attributes: values, geometry: row.geometry || null } : { kind: 'unrecognized' };
  }
  const data = payload as { features?: unknown[]; properties?: Record<string, unknown>; geometry?: Geometry | null; ok?: boolean; error?: string; feature?: { properties?: Record<string, unknown>; geometry?: Geometry | null } };
  if (data.ok === false || data.error) return { kind: 'unrecognized' };
  if (Array.isArray(data.features)) {
    const feature = data.features.find(item => item && typeof item === 'object' && (item as { properties?: unknown }).properties && Object.keys((item as { properties: object }).properties).length);
    if (!feature) return { kind: 'empty' };
    const candidate = feature as { properties: Record<string, unknown>; geometry?: Geometry | null };
    return { kind: 'found', attributes: candidate.properties, geometry: candidate.geometry || null };
  }
  if (data.feature?.properties && Object.keys(data.feature.properties).length) return { kind: 'found', attributes: data.feature.properties, geometry: data.feature.geometry || null };
  if (data.properties && Object.keys(data.properties).length) return { kind: 'found', attributes: data.properties };
  const fields = Object.fromEntries(Object.entries(data).filter(([key, value]) => !['type', 'id', 'geometry', 'bbox', 'crs', 'features', 'feature'].includes(key.toLowerCase()) && (value == null || ['string', 'number', 'boolean'].includes(typeof value))));
  if (Object.keys(fields).length) return { kind: 'found', attributes: fields, geometry: data.geometry || null };
  return { kind: 'unrecognized' };
}

function parseWmsInfo(text: string): ParsedInfo {
  const value = text.trim();
  if (!value) return { kind: 'unrecognized' };
  if (value.startsWith('{') || value.startsWith('[')) {
    try { return firstJsonFeature(JSON.parse(value)); } catch { return { kind: 'unrecognized' }; }
  }

  if (/^</.test(value)) {
    const html = new DOMParser().parseFromString(value, 'text/html');
    if (/ServiceException|ExceptionReport|ows:Exception/i.test(html.body.textContent || '')) return { kind: 'unrecognized' };
    const preformatted = html.querySelector('pre')?.textContent?.trim();
    if (preformatted && (preformatted.startsWith('{') || preformatted.startsWith('['))) {
      try { return firstJsonFeature(JSON.parse(preformatted)); } catch { /* tenta os demais formatos */ }
    }
    const attributes: Record<string, unknown> = {};
    for (const row of Array.from(html.querySelectorAll('tr'))) {
      const cells = Array.from(row.querySelectorAll('th,td')).map(cell => cell.textContent?.trim() || '').filter(Boolean);
      if (cells.length >= 2) attributes[cells[0].replace(/\s+/g, ' ').slice(0, 100)] = cells.slice(1).join(' · ').slice(0, 1000);
    }
    if (Object.keys(attributes).length) return { kind: 'found', attributes };

    const xml = new DOMParser().parseFromString(value, 'application/xml');
    if (!xml.querySelector('parsererror')) {
      if (/ServiceException|ExceptionReport|ows:Exception/i.test(xml.documentElement?.localName || '')) return { kind: 'unrecognized' };
      const fields: Record<string, unknown> = {};
      for (const element of Array.from(xml.getElementsByTagName('*'))) {
        if (element.children.length || /^(?:geometry|geom|boundedBy|the_geom|shape|coordinates|pos|posList|lowerCorner|upperCorner)$/i.test(element.localName)) continue;
        const content = element.textContent?.trim();
        if (!content || content.length > 1000) continue;
        const key = element.localName;
        if (key && key !== 'Feature' && key !== 'FeatureCollection') fields[key] = content;
        if (Object.keys(fields).length >= 80) break;
      }
      if (Object.keys(fields).length) return { kind: 'found', attributes: fields };
      if (/featurecollection|featuremember|member/i.test(value)) return { kind: 'empty' };
    }
  }

  const lines = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const attributes: Record<string, unknown> = {};
  for (const line of lines) {
    const match = line.match(/^([^:=]{1,100})\s*[:=]\s*(.+)$/);
    if (match) attributes[match[1].trim()] = match[2].trim().slice(0, 1000);
  }
  return Object.keys(attributes).length ? { kind: 'found', attributes } : { kind: 'unrecognized' };
}

/** Consulta a camada WMS ativa com formatos alternativos e prazo limitado. */
async function queryWmsFeatureInfo(target: Extract<OfficialInfoTarget, { kind: 'wms' }>, point: WmsPoint): Promise<OfficialInfoResult> {
  const result: OfficialInfoResult = { id: target.id, label: target.label, group: target.group, status: 'unavailable', attributes: null };
  const formats = ['application/json', 'text/html', 'application/vnd.ogc.gml', 'text/plain'];
  const deadline = Date.now() + 9000;
  let validEmptyResponse = false;
  for (const infoFormat of formats) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    try {
      const endpoint = new URL(layerProxyUrl(target.layer));
      const params: Record<string, string> = {
        SERVICE: 'WMS', VERSION: '1.1.1', REQUEST: 'GetFeatureInfo',
        LAYERS: target.layer.layers, QUERY_LAYERS: target.layer.layers, STYLES: '', SRS: 'EPSG:4326',
        BBOX: point.bbox.join(','), WIDTH: String(point.width), HEIGHT: String(point.height),
        X: String(point.x), Y: String(point.y), FEATURE_COUNT: '4', FORMAT: 'image/png', INFO_FORMAT: infoFormat
      };
      for (const [key, value] of Object.entries(params)) endpoint.searchParams.set(key, value);
      const response = await fetch(endpoint.toString(), { signal: AbortSignal.timeout(Math.min(6500, remaining)), credentials: 'omit', cache: 'no-store', headers: { Accept: infoFormat } });
      const body = await response.text();
      if (!response.ok) continue;
      const parsed = parseWmsInfo(body);
      if (parsed.kind === 'found' && parsed.attributes && Object.keys(parsed.attributes).length) {
        return { ...result, status: 'found', attributes: parsed.attributes, geometry: parsed.geometry || null };
      }
      if (parsed.kind === 'empty') validEmptyResponse = true;
    } catch {
      // Tenta os demais formatos; falha de uma fonte não bloqueia as outras.
    }
  }
  return { ...result, status: validEmptyResponse ? 'empty' : 'unavailable' };
}

const SIGEF_FIELDS: Record<string, string> = {
  parcela_co: 'Código da parcela',
  codigo_imo: 'Código do imóvel',
  situacao_i: 'Situação informada',
  status: 'Status no SIGEF',
  nome_area: 'Nome da área',
  registro_m: 'Matrícula / registro',
  registro_d: 'Data do registro',
  data_submi: 'Data de submissão',
  data_aprov: 'Data de aprovação',
  rt: 'Responsável técnico (RT)',
  art: 'ART'
};

function sigefValue(key: string, value: unknown): unknown {
  if (value == null || String(value).trim() === '') return null;
  if (/^(?:registro_d|data_submi|data_aprov)$/.test(key) && typeof value === 'number' && Number.isFinite(value)) {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' }).format(new Date(value));
  }
  return value;
}

/** Consulta pontual no serviço público SIGEF/INCRA pelo proxy geoespacial já configurado. */
async function querySigefPublic(target: Extract<OfficialInfoTarget, { kind: 'arcgis' }>, lat: number, lng: number): Promise<OfficialInfoResult> {
  const result: OfficialInfoResult = { id: target.id, label: target.label, group: target.group, status: 'unavailable', attributes: null };
  try {
    const endpoint = new URL(`${GEOSERVICES_BASE}/info`);
    endpoint.searchParams.set('target', target.endpoint);
    const params: Record<string, string> = {
      where: '1=1',
      geometry: JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }),
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: Object.keys(SIGEF_FIELDS).join(','),
      returnGeometry: 'false',
      resultRecordCount: '1',
      f: 'json'
    };
    Object.entries(params).forEach(([key, value]) => endpoint.searchParams.set(key, value));
    const response = await fetch(endpoint.toString(), { signal: AbortSignal.timeout(9000), credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!response.ok) return result;
    const payload = await response.json() as { error?: unknown; features?: Array<{ attributes?: Record<string, unknown> }> };
    if (payload.error || !Array.isArray(payload.features)) return result;
    const feature = payload.features.find(item => item?.attributes && typeof item.attributes === 'object');
    if (!feature) return { ...result, status: 'empty' };
    const attributes = Object.fromEntries(Object.entries(SIGEF_FIELDS)
      .map(([field, label]) => [label, sigefValue(field, feature.attributes?.[field])])
      .filter(([, value]) => value != null));
    return Object.keys(attributes).length ? { ...result, status: 'found', attributes } : { ...result, status: 'empty' };
  } catch {
    return result;
  }
}

export function queryOfficialFeatureInfo(target: OfficialInfoTarget, point: WmsPoint): Promise<OfficialInfoResult> {
  if (target.kind === 'arcgis') {
    return querySigefPublic(target, point.lat, point.lng);
  }
  return queryWmsFeatureInfo(target, point);
}
