import { useState } from 'react';
import { X } from 'lucide-react';
import type { Feature, Geometry, GeoJsonProperties } from 'geojson';
import { measureMapGeometry } from './geometryMetrics';
import { downloadText, toKml } from './mapFormats';
import { featuresToDxf } from './advancedTerrainTools';
import { downloadBytes, toShapefileZip } from './shapefileExport';

type MapFeature = Feature<Geometry, GeoJsonProperties>;
type FeatureExport = 'GeoJSON' | 'KML' | 'DXF' | 'Shapefile';

export type FeatureDetailsPanelProps = {
  feature: MapFeature;
  onClose: () => void;
};

function collectPositions(value: unknown): [number, number][] {
  if (!Array.isArray(value)) return [];
  if (typeof value[0] === 'number' && Number.isFinite(value[0]) && typeof value[1] === 'number' && Number.isFinite(value[1])) {
    return [[value[0], value[1]]];
  }
  return value.flatMap(collectPositions);
}

function positionsOf(geometry: Geometry): [number, number][] {
  if (geometry.type === 'GeometryCollection') {
    return geometry.geometries.flatMap(positionsOf);
  }
  return collectPositions(geometry.coordinates);
}

function isPolygon(geometry: Geometry): geometry is Extract<Geometry, { type: 'Polygon' | 'MultiPolygon' }> {
  return geometry.type === 'Polygon' || geometry.type === 'MultiPolygon';
}

export function FeatureDetailsPanel({ feature, onClose }: FeatureDetailsPanelProps) {
  const [exportError, setExportError] = useState('');
  const geometry = feature.geometry;
  const polygon = isPolygon(geometry);
  const metrics = polygon ? measureMapGeometry(geometry) : null;
  const positions = positionsOf(geometry);
  const featureId = feature.id == null ? '' : String(feature.id);
  const name = String(feature.properties?.name || '').trim() || (featureId ? `Feição ${featureId}` : 'Feição');
  const fileId = (featureId || 'feicao').replace(/[^a-zA-Z0-9_-]/g, '_');
  const supportsKml = ['Polygon', 'MultiPolygon', 'Point', 'LineString'].includes(geometry.type);
  const supportsDxf = ['Polygon', 'Point', 'LineString'].includes(geometry.type);
  const supportsShapefile = ['Polygon', 'MultiPolygon', 'Point', 'LineString'].includes(geometry.type);

  const exportFeature = (format: FeatureExport) => {
    setExportError('');
    try {
      if (format === 'GeoJSON') {
        downloadText(`feicao-${fileId}.geojson`, JSON.stringify({ type: 'FeatureCollection', features: [feature] }, null, 2), 'application/geo+json');
      } else if (format === 'KML') {
        downloadText(`feicao-${fileId}.kml`, toKml([feature]), 'application/vnd.google-earth.kml+xml');
      } else if (format === 'DXF') {
        downloadText(`feicao-${fileId}.dxf`, featuresToDxf([feature]), 'application/dxf');
      } else {
        downloadBytes(`feicao-${fileId}-shape.zip`, toShapefileZip([feature]));
      }
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Falha ao exportar feição.');
    }
  };

  return (
    <aside className="map-feature-details-panel map-feature-details" aria-label={`Detalhes de ${name}`}>
      <header>
        <strong>DETALHES DO DESENHO</strong>
        <button type="button" aria-label="Fechar detalhes" onClick={onClose}><X size={16} /></button>
      </header>
      <h3>{name}</h3>
      <div className="map-measures" aria-label="Medições da feição">
        <span>Área<b>{metrics ? `${(metrics.areaM2 / 10000).toLocaleString('pt-BR', { maximumFractionDigits: 4 })} ha` : '—'}</b></span>
        <span>Perímetro<b>{metrics ? `${metrics.perimeterMeters.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m` : '—'}</b></span>
        <span>Vértices<b>{metrics?.vertexCount ?? positions.length}</b></span>
      </div>
      <div className="map-feature-coord-head"><span>Coordenadas (lat, lon)</span><span>{positions.length}</span></div>
      <textarea
        aria-label="Coordenadas da feição"
        rows={Math.min(12, Math.max(4, positions.length))}
        readOnly
        value={positions.map(([longitude, latitude], index) => `${index + 1}: ${latitude.toFixed(7)}, ${longitude.toFixed(7)}`).join('\n')}
      />
      <section aria-label="Downloads da feição">
        <div className="map-feature-coord-head"><strong>Baixar feição</strong></div>
        <div className="map-feature-actions" role="group" aria-label="Formatos de download">
          <button type="button" onClick={() => exportFeature('GeoJSON')}>GeoJSON</button>
          {supportsKml && <button type="button" onClick={() => exportFeature('KML')}>KML</button>}
          {supportsDxf && <button type="button" onClick={() => exportFeature('DXF')}>DXF</button>}
          {supportsShapefile && <button type="button" onClick={() => exportFeature('Shapefile')}>Shapefile</button>}
        </div>
      </section>
      {exportError && <p className="map-save-alert" role="alert">{exportError}</p>}
    </aside>
  );
}
