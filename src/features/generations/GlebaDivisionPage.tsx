import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Save, Scissors } from 'lucide-react';
import type { Feature, GeoJsonProperties, Geometry, Polygon } from 'geojson';
import { GlobalLoading } from '../../components/GlobalLoading';
import { FileUploadField, type UploadProgressReporter } from '../../components/FileUploadField';
import { useAuth } from '../auth/AuthContext';
import { listProjects, getProject, projectTitle, saveProjectBundle, type Project, type ProjectFull } from '../projects/projectsApi';
import { getPolygons, fmt, distance, type SurveyPolygon } from '../memorial/memorialEngine';
import { splitPolygonIntoLots, GLEBA_PALETTE } from '../map/glebaGeometry';
import { xmlEscape } from './geometry';
import { polygonMeasures } from '../map/geoServices';
import { downloadText, kmlFeatures, toCsv, toKml } from '../map/mapFormats';
import { toShapefileZip, downloadBytes as downloadShpBytes } from '../map/shapefileExport';
import { makeZip, downloadBytes } from './exportOffice';
import '../documents/documents.css';

function readUploadText(file: File, reportProgress: UploadProgressReporter): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = event => {
      if (event.lengthComputable && event.total > 0) reportProgress(file, event.loaded, event.total);
    };
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler o arquivo.'));
    reader.onabort = () => reject(new Error('Leitura do arquivo cancelada.'));
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('O arquivo não pôde ser lido como texto.'));
    reader.readAsText(file);
  });
}

type GeneratedLot = {
  id: string;
  name: string;
  heirOwner: string;
  color: string;
  areaHa: number;
  perimeterM: number;
  verticesCount: number;
  feature: Feature<Geometry, GeoJsonProperties>;
};

export function GlebaDivisionPage() {
  const { session } = useAuth();
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [full, setFull] = useState<ProjectFull | null>(null);
  const [featureId, setFeatureId] = useState('');
  const [geojsonText, setGeojsonText] = useState('');
  const [baseName, setBaseName] = useState('Gleba');
  const [count, setCount] = useState(4);
  const [mode, setMode] = useState<'equal' | 'custom'>('equal');
  const [axisMode, setAxisMode] = useState<'0' | '90' | 'custom'>('0');
  const [azimuthDeg, setAzimuthDeg] = useState(0);
  const [customAreasText, setCustomAreasText] = useState('');
  const [familyOwner, setFamilyOwner] = useState('');
  const [lots, setLots] = useState<GeneratedLot[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingCloud, setSavingCloud] = useState(false);
  const [message, setMessage] = useState('');
  const projectLoadSequence = useRef(0);

  useEffect(() => {
    if (!session) return;
    let active = true;
    setLoadingProjects(true);
    listProjects(session)
      .then(list => { if (active) setProjects(list); })
      .catch(() => { if (active) setMessage('Não foi possível listar projetos da nuvem.'); })
      .finally(() => { if (active) setLoadingProjects(false); });
    return () => { active = false; };
  }, [session]);

  const polygons = useMemo(() => getPolygons(full?.features || []), [full]);

  const applyPolygonToEditor = (poly: SurveyPolygon | null) => {
    if (!poly) return;
    const ring = [...poly.vertices, poly.vertices[0]];
    const feat: Feature<Polygon> = {
      type: 'Feature',
      id: poly.id,
      properties: { ...poly.properties, name: poly.name },
      geometry: { type: 'Polygon', coordinates: [ring] }
    };
    setGeojsonText(JSON.stringify(feat, null, 2));
  };

  const openProject = useCallback(async (id: string) => {
    const loadSequence = ++projectLoadSequence.current;
    setProjectId(id);
    setFull(null);
    setFeatureId('');
    setLots([]);
    setMessage('');
    if (!id || !session) {
      setLoading(false);
      return;
    }
    // Não deixar a geometria nem o proprietário do projeto anterior entrarem
    // por engano numa nova divisão caso este projeto falhe ou não tenha polígono.
    setGeojsonText('');
    setFamilyOwner('');
    setLoading(true);
    try {
      const data = await getProject(session, id);
      if (loadSequence !== projectLoadSequence.current) return;
      setFull(data);
      const polys = getPolygons(data.features);
      if (polys[0]) {
        setFeatureId(polys[0].id);
        applyPolygonToEditor(polys[0]);
      } else {
        setMessage('O projeto selecionado não contém um polígono para dividir. Importe ou cole um perímetro.');
      }
      if (data.project?.ownerName || data.project?.owner) {
        setFamilyOwner(String(data.project.ownerName || data.project.owner));
      }
    } catch (e) {
      if (loadSequence === projectLoadSequence.current) {
        setMessage(e instanceof Error ? e.message : 'Falha ao carregar projeto.');
      }
    } finally {
      if (loadSequence === projectLoadSequence.current) setLoading(false);
    }
  }, [session]);

  const handleFileUpload = async (file: File, reportProgress: UploadProgressReporter) => {
    const raw = await readUploadText(file, reportProgress);
    if (file.name.toLowerCase().endsWith('.kml')) {
      const parsed = kmlFeatures(raw).find(f => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon');
      if (!parsed) throw new Error('Nenhum polígono encontrado no KML.');
      setGeojsonText(JSON.stringify(parsed, null, 2));
    } else {
      setGeojsonText(raw);
    }
    setMessage(`Arquivo ${file.name} carregado. Clique em "Gerar glebas" para dividir.`);
  };

  const parseSourceFeature = (): Feature<Geometry, GeoJsonProperties> => {
    if (!geojsonText.trim()) throw new Error('Selecione um projeto salvo ou informe um polígono em GeoJSON/KML.');
    const parsed = JSON.parse(geojsonText);
    if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
      const found = parsed.features.find((f: Feature) => f?.geometry?.type === 'Polygon');
      if (!found) throw new Error('A coleção não possui um Polygon simples.');
      return found;
    }
    if (parsed.type === 'Polygon') {
      return { type: 'Feature', properties: { name: baseName }, geometry: parsed };
    }
    if (parsed.type === 'Feature' && parsed.geometry?.type === 'Polygon') {
      return parsed;
    }
    throw new Error('O GeoJSON precisa conter um Polygon válido.');
  };

  const generateGlebas = () => {
    try {
      const source = parseSourceFeature();
      const targetAreas = mode === 'custom'
        ? customAreasText.split(/[;,\s\n]+/).map(s => Number(s.replace(',', '.'))).filter(n => Number.isFinite(n) && n > 0)
        : undefined;
      if (mode === 'custom' && (!targetAreas || targetAreas.length < 2)) {
        throw new Error('Informe pelo menos 2 áreas positivas separadas por ponto-e-vírgula (ex.: 5; 8; 10).');
      }
      const effectiveCount = mode === 'custom' && targetAreas ? targetAreas.length : count;
      const effectiveAngle = axisMode === '0' ? 0 : axisMode === '90' ? 90 : azimuthDeg;
      const generated = splitPolygonIntoLots(source, effectiveCount, axisMode === '90' ? 1 : 0, {
        angleDeg: effectiveAngle,
        targetAreasHa: targetAreas
      });
      const built: GeneratedLot[] = generated.map((feat, idx) => {
        const ring = (feat.geometry as Polygon).coordinates[0] || [];
        const m = polygonMeasures(ring);
        const color = String(feat.properties?.fillColor || GLEBA_PALETTE[idx % GLEBA_PALETTE.length]);
        const name = `${baseName.trim() || 'Gleba'} ${String(idx + 1).padStart(2, '0')}`;
        const heir = familyOwner.trim() ? `${familyOwner.trim()} (${name})` : '';
        return {
          id: String(feat.id || `gleba-${idx + 1}`),
          name,
          heirOwner: heir,
          color,
          areaHa: m.area / 10000,
          perimeterM: m.perimeter,
          verticesCount: Math.max(0, ring.length - 1),
          feature: {
            ...feat,
            properties: {
              ...feat.properties,
              name,
              category: 'gleba',
              owner: heir,
              lotColor: color,
              fillColor: color,
              strokeColor: color,
              fillOpacity: 0.28,
              estimatedAreaHa: Number((m.area / 10000).toFixed(4))
            }
          }
        };
      });
      setLots(built);
      setMessage(`${built.length} glebas geradas com sucesso! Você pode editar cores, nomes, herdeiros e exportar ou salvar como projeto.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Não foi possível dividir o polígono.');
    }
  };

  const updateLot = (index: number, patch: Partial<GeneratedLot>) => {
    setLots(prev => prev.map((lot, idx) => {
      if (idx !== index) return lot;
      const updated = { ...lot, ...patch };
      updated.feature = {
        ...updated.feature,
        properties: {
          ...updated.feature.properties,
          name: updated.name,
          owner: updated.heirOwner,
          lotColor: updated.color,
          fillColor: updated.color,
          strokeColor: updated.color
        }
      };
      return updated;
    }));
  };

  const saveAsCloudProject = async () => {
    if (!session || !lots.length || savingCloud) return;
    setSavingCloud(true);
    setMessage('Salvando glebas na nuvem como novo projeto...');
    try {
      const originName = full?.project ? projectTitle(full.project) : baseName || 'Partilha de Glebas';
      const newProjectName = `${originName} — Glebas (${lots.length})`;
      const allCoords = lots.flatMap(l => (l.feature.geometry as Polygon).coordinates[0] || []);
      const centerLon = allCoords.reduce((s, c) => s + c[0], 0) / Math.max(1, allCoords.length);
      const centerLat = allCoords.reduce((s, c) => s + c[1], 0) / Math.max(1, allCoords.length);
      const totalHa = lots.reduce((s, l) => s + l.areaHa, 0);
      const totalPerim = lots.reduce((s, l) => s + l.perimeterM, 0);

      const payload = {
        name: newProjectName,
        propertyName: newProjectName,
        ownerName: familyOwner.trim() || full?.project?.ownerName || full?.project?.owner || 'Proprietário',
        municipality: full?.project?.municipality || full?.project?.city || '',
        stateCode: full?.project?.stateCode || full?.project?.uf || 'BA',
        areaHa: Number(totalHa.toFixed(4)),
        perimeterM: Number(totalPerim.toFixed(2)),
        centerLatitude: centerLat,
        centerLongitude: centerLon,
        defaultZoom: 15,
        status: 'active'
      };
      const featuresPayload = lots.map((l, idx) => ({
        id: l.id,
        name: l.name,
        type: 'gleba',
        category: 'gleba',
        orderIndex: idx,
        geoJson: l.feature.geometry,
        geometry: l.feature.geometry,
        properties: {
          ...l.feature.properties,
          surveyorFeatureId: l.id
        }
      }));
      const saved = await saveProjectBundle(session, null, payload, featuresPayload);
      setMessage(`Projeto "${newProjectName}" salvo na nuvem! Agora você pode abrir direto em Pranchas, Croquis ou na Central de Lotes.`);
      if (saved.project?.id) {
        const updatedList = await listProjects(session).catch(() => projects);
        setProjects(updatedList);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Falha ao salvar projeto na nuvem.');
    } finally {
      setSavingCloud(false);
    }
  };

  const downloadZipIndividual = () => {
    if (!lots.length) return;
    const files = lots.map((lot, idx) => {
      const slug = lot.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_');
      return {
        name: `${String(idx + 1).padStart(2, '0')}_${slug}.geojson`,
        content: JSON.stringify({ type: 'FeatureCollection', features: [lot.feature] }, null, 2)
      };
    });
    downloadBytes(makeZip(files), 'SURVEYOR_PERIMETROS_POR_GLEBA.zip', 'application/zip');
  };

  const previewSvg = useMemo(() => {
    if (!lots.length) return '';
    const allPts = lots.flatMap(l => (l.feature.geometry as Polygon).coordinates[0] || []);
    if (!allPts.length) return '';
    const minX = Math.min(...allPts.map(p => p[0]));
    const maxX = Math.max(...allPts.map(p => p[0]));
    const minY = Math.min(...allPts.map(p => p[1]));
    const maxY = Math.max(...allPts.map(p => p[1]));
    const w = Math.max(1e-7, maxX - minX);
    const h = Math.max(1e-7, maxY - minY);
    const pad = 40;
    const svgW = 860;
    const svgH = 440;
    const scale = Math.min((svgW - pad * 2) / w, (svgH - pad * 2) / h);
    const ox = (svgW - w * scale) / 2;
    const oy = (svgH - h * scale) / 2;
    const proj = ([lon, lat]: number[]) => [
      ox + (lon - minX) * scale,
      svgH - (oy + (lat - minY) * scale)
    ];

    const polysSvg = lots.map(lot => {
      const ring = (lot.feature.geometry as Polygon).coordinates[0] || [];
      const open = ring.slice(0, -1);
      const pts = open.map(proj);
      const ptsAttr = pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
      const cx = pts.reduce((s, p) => s + p[0], 0) / Math.max(1, pts.length);
      const cy = pts.reduce((s, p) => s + p[1], 0) / Math.max(1, pts.length);
      const cotas = open.map((v, i) => {
        const next = open[(i + 1) % open.length];
        const pa = pts[i];
        const pb = pts[(i + 1) % pts.length];
        if (!pa || !pb || Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) < 32) return '';
        const mx = (pa[0] + pb[0]) / 2;
        const my = (pa[1] + pb[1]) / 2;
        return `<text x="${mx.toFixed(1)}" y="${my.toFixed(1)}" font-size="9.5" font-weight="700" text-anchor="middle" fill="#0f172a" paint-order="stroke" stroke="#fff" stroke-width="2.5">${fmt(distance(v as [number, number], next as [number, number]), 1)} m</text>`;
      }).join('');
      return `<g>
        <polygon points="${ptsAttr}" fill="${lot.color}" fill-opacity="0.32" stroke="${lot.color}" stroke-width="2.4"/>
        ${cotas}
        <text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" font-size="12" font-weight="800" text-anchor="middle" fill="#0f172a" paint-order="stroke" stroke="#fff" stroke-width="3.2">${xmlEscape(lot.name)} (${fmt(lot.areaHa, 4)} ha)</text>
      </g>`;
    }).join('');

    return `<svg viewBox="0 0 ${svgW} ${svgH}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <rect width="${svgW}" height="${svgH}" fill="#f8fafc" rx="10"/>
      ${polysSvg}
    </svg>`;
  }, [lots]);

  const totalAreaHa = lots.reduce((s, l) => s + l.areaHa, 0);
  const maxDiffHa = lots.length > 1
    ? Math.max(...lots.map(l => l.areaHa)) - Math.min(...lots.map(l => l.areaHa))
    : 0;

  return (
    <main className="workspace-main doc-root">
      <GlobalLoading active={loading || loadingProjects || savingCloud} />
      <div className="workspace-container doc-container">
        <div className="doc-title">
          <Scissors size={20} />
          <h1>Divisão de Glebas e Partilha</h1>
          <span>Subdivisão geodésica em áreas iguais ou personalizadas (côncavos e convexos)</span>
        </div>

        {message && (
          <div className="doc-alert" role="status">
            <span>{message}</span>
            <button type="button" onClick={() => setMessage('')}>×</button>
          </div>
        )}

        <div className="doc-layout" style={{ gridTemplateColumns: '400px 1fr', gap: 20 }}>
          <aside className="doc-sidebar">
            <div className="doc-panel" style={{ display: 'grid', gap: 10 }}>
              <strong>1. Origem do Perímetro</strong>
              <label>
                Projeto salvo na nuvem
                <select value={projectId} onChange={e => void openProject(e.target.value)}>
                  <option value="">Selecione um projeto...</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{projectTitle(p)}</option>
                  ))}
                </select>
              </label>

              {polygons.length > 1 && (
                <label>
                  Polígono do projeto
                  <select
                    value={featureId}
                    onChange={e => {
                      setFeatureId(e.target.value);
                      applyPolygonToEditor(polygons.find(p => p.id === e.target.value) || null);
                    }}
                  >
                    {polygons.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({fmt(p.areaM2 / 10000, 4)} ha)</option>
                    ))}
                  </select>
                </label>
              )}

              <FileUploadField label="Importar perímetro GeoJSON / KML" accept=".geojson,.json,.kml" maxBytes={50 * 1024 * 1024} description="O arquivo será lido localmente; revise o perímetro antes de gerar as glebas." onFile={handleFileUpload} />

              <details>
                <summary style={{ fontSize: 12, cursor: 'pointer', color: '#0284c7', fontWeight: 600 }}>Ver / colar GeoJSON manualmente</summary>
                <textarea
                  rows={4}
                  value={geojsonText}
                  onChange={e => setGeojsonText(e.target.value)}
                  placeholder="Cole aqui um Feature ou Polygon GeoJSON"
                  style={{ width: '100%', fontSize: 11, fontFamily: 'monospace', marginTop: 6 }}
                />
              </details>

              <hr style={{ border: 0, borderTop: '1px solid #e2e8f0', margin: '4px 0' }} />
              <strong>2. Parâmetros da Partilha</strong>

              <div className="doc-two">
                <label>
                  Nome-base
                  <input value={baseName} onChange={e => setBaseName(e.target.value)} />
                </label>
                <label>
                  Quantidade
                  <input type="number" min={2} max={80} value={count} disabled={mode === 'custom'} onChange={e => setCount(Math.max(2, Math.min(80, Number(e.target.value) || 2)))} />
                </label>
              </div>

              <label>
                Modo de divisão
                <select value={mode} onChange={e => setMode(e.target.value as 'equal' | 'custom')}>
                  <option value="equal">Áreas iguais (automático)</option>
                  <option value="custom">Áreas informadas por gleba (ha ou %)</option>
                </select>
              </label>

              {mode === 'custom' && (
                <label>
                  Áreas desejadas por gleba (separadas por ponto-e-vírgula)
                  <input value={customAreasText} onChange={e => setCustomAreasText(e.target.value)} placeholder="Ex.: 5.5; 8.0; 12.25; 10.0" />
                </label>
              )}

              <label>
                Orientação das faixas divisórias
                <select value={axisMode} onChange={e => setAxisMode(e.target.value as '0' | '90' | 'custom')}>
                  <option value="0">Oeste → Leste (0°)</option>
                  <option value="90">Sul → Norte (90°)</option>
                  <option value="custom">Azimute / Ângulo personalizado (0°–360°)</option>
                </select>
              </label>

              {axisMode === 'custom' && (
                <label>
                  Ângulo / Azimute ({azimuthDeg}°)
                  <input type="range" min={0} max={360} step={1} value={azimuthDeg} onChange={e => setAzimuthDeg(Number(e.target.value))} />
                </label>
              )}

              <label>
                Proprietário / Família / Herdeiros (opcional)
                <input value={familyOwner} onChange={e => setFamilyOwner(e.target.value)} placeholder="Ex.: Espólio de João da Silva" />
              </label>

              <button type="button" className="doc-primary" onClick={generateGlebas} style={{ padding: '10px 14px', fontWeight: 700 }}>
                <Scissors size={15} /> Gerar Glebas
              </button>
            </div>
          </aside>

          <div className="doc-main" style={{ padding: 20, overflowY: 'auto', display: 'grid', gap: 16, alignContent: 'start' }}>
            <section style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                  <div><small style={{ color: '#64748b', display: 'block', fontSize: 11 }}>Área Total</small><strong style={{ fontSize: 15 }}>{lots.length ? `${fmt(totalAreaHa, 4)} ha` : '—'}</strong></div>
                  <div><small style={{ color: '#64748b', display: 'block', fontSize: 11 }}>Glebas Geradas</small><strong style={{ fontSize: 15 }}>{lots.length}</strong></div>
                  <div><small style={{ color: '#64748b', display: 'block', fontSize: 11 }}>Diferença Máx.</small><strong style={{ fontSize: 15 }}>{lots.length ? `${fmt(maxDiffHa, 4)} ha` : '—'}</strong></div>
                </div>

                {lots.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" className="doc-primary" disabled={savingCloud} onClick={() => void saveAsCloudProject()}>
                      <Save size={14} /> {savingCloud ? 'Salvando...' : 'Salvar como Projeto na Nuvem'}
                    </button>
                    <button type="button" className="doc-mini-btn" onClick={downloadZipIndividual}>
                      <Download size={14} /> Extrair Perímetros 1 por 1 (.zip)
                    </button>
                    <button type="button" className="doc-mini-btn" onClick={() => downloadText('SURVEYOR_GLEBAS.geojson', JSON.stringify({ type: 'FeatureCollection', features: lots.map(l => l.feature) }, null, 2), 'application/geo+json')}>
                      GeoJSON
                    </button>
                    <button type="button" className="doc-mini-btn" onClick={() => downloadText('SURVEYOR_GLEBAS.kml', toKml(lots.map(l => l.feature)), 'application/vnd.google-earth.kml+xml')}>
                      KML (Campo/GPS)
                    </button>
                    <button type="button" className="doc-mini-btn" onClick={() => downloadText('SURVEYOR_GLEBAS.csv', toCsv(lots.map(l => l.feature)), 'text/csv;charset=utf-8')}>
                      CSV
                    </button>
                    <button type="button" className="doc-mini-btn" onClick={() => downloadShpBytes('SURVEYOR_GLEBAS_SHP.zip', toShapefileZip(lots.map(l => l.feature), 'qgis-arcgis'))}>
                      Shapefile (.zip)
                    </button>
                  </div>
                )}
              </div>

              <div style={{ height: 380, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
                {previewSvg ? (
                  <div style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: previewSvg }} />
                ) : (
                  <p style={{ color: '#64748b', fontSize: 13 }}>Selecione um projeto ou polígono à esquerda e clique em "Gerar Glebas" para visualizar a planta de partilha.</p>
                )}
              </div>
            </section>

            {lots.length > 0 && (
              <section style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 16 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 15, color: '#0f172a' }}>3. Personalizar Cores, Nomes e Extrair Individualmente</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table className="ods-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Cor</th>
                        <th>Nome da Gleba</th>
                        <th>Proprietário / Herdeiro</th>
                        <th>Área (ha)</th>
                        <th>Perímetro (m)</th>
                        <th>Vértices</th>
                        <th>Ações Individuais</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lots.map((lot, idx) => (
                        <tr key={lot.id}>
                          <td>
                            <input
                              type="color"
                              value={lot.color}
                              onChange={e => updateLot(idx, { color: e.target.value })}
                              style={{ width: 28, height: 26, border: 0, padding: 0, background: 'transparent', cursor: 'pointer' }}
                            />
                          </td>
                          <td>
                            <input
                              value={lot.name}
                              onChange={e => updateLot(idx, { name: e.target.value })}
                              style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', width: '100%' }}
                            />
                          </td>
                          <td>
                            <input
                              value={lot.heirOwner}
                              onChange={e => updateLot(idx, { heirOwner: e.target.value })}
                              placeholder="Opcional"
                              style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', width: '100%' }}
                            />
                          </td>
                          <td><strong>{fmt(lot.areaHa, 4)} ha</strong></td>
                          <td>{fmt(lot.perimeterM, 2)} m</td>
                          <td>{lot.verticesCount}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                type="button"
                                className="doc-mini-btn"
                                onClick={() => downloadText(`${lot.name.replace(/\s+/g, '_')}.geojson`, JSON.stringify({ type: 'FeatureCollection', features: [lot.feature] }, null, 2), 'application/geo+json')}
                              >
                                GeoJSON
                              </button>
                              <button
                                type="button"
                                className="doc-mini-btn"
                                onClick={() => downloadText(`${lot.name.replace(/\s+/g, '_')}.kml`, toKml([lot.feature]), 'application/vnd.google-earth.kml+xml')}
                              >
                                KML
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
