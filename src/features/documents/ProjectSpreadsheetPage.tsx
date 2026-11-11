import { GlobalLoading } from '../../components/GlobalLoading';
import { ProjectSourcePicker } from '../../components/ProjectSourcePicker';
import { DocumentWorkflowBar } from '../../components/layout/DocumentWorkflowBar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Download, FileSpreadsheet, Paintbrush, Palette, RotateCcw } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { listProjects, getProject, projectTitle, type Project, type ProjectFull } from '../projects/projectsApi';
import { getPolygons, record, distance, azimuth, text } from '../memorial/memorialEngine';
import { getDocumentCustomization } from '../customization/customizationApi';
import { readConfrontants, mergeConfrontantsIntoProperties } from './confrontantRegistry';
import { readConfrontation, groupConfrontations } from '../croqui/croquiGeometry';
import { generateOds, type OdsSheet } from './odsWriter';
import { reviewSigef } from './sigefReview';
import { utmFromWgs84 } from './utmGrid';
import { downloadText } from '../map/mapFormats';
import { LatestRequestSequence } from '../../lib/latestRequestSequence';
import './documents.css';

type SpreadsheetAppearance = { paperColor: string; tableColor: string; headerColor: string; borderColor: string; highlightColor: string; cellColors: Record<string, string> };
const defaultAppearance: SpreadsheetAppearance = { paperColor: '#ffffff', tableColor: '#ffffff', headerColor: '#e8f1ff', borderColor: '#dbe4ed', highlightColor: '#ffe08a', cellColors: {} };

export function ProjectSpreadsheetPage() {
  const [loadingProjects, setLoadingProjects] = useState(true);
  const { session } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [full, setFull] = useState<ProjectFull | null>(null);
  const [opts, setOpts] = useState<Record<string, unknown>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sigefMode, setSigefMode] = useState(false);
  const [selectedPolyId, setSelectedPolyId] = useState('all');
  const [activeSheetIdx, setActiveSheetIdx] = useState(1);
  const [currentStep, setCurrentStep] = useState(0);
  const [paintMode, setPaintMode] = useState(false);
  const [appearance, setAppearance] = useState<SpreadsheetAppearance>(defaultAppearance);
  const projectEditorRef = useRef<HTMLElement | null>(null);
  const spreadsheetEditorRef = useRef<HTMLDivElement | null>(null);
  const planTypeRef = useRef<HTMLSelectElement | null>(null);
  const odsExportRef = useRef<HTMLButtonElement | null>(null);
  const projectLoads = useRef(new LatestRequestSequence());

  // Parâmetros técnicos editáveis para pré-conferência SIGEF / Planilha
  const [vertexTypeDefault, setVertexTypeDefault] = useState<'M' | 'P' | 'V'>('M');
  const [posMethod, setPosMethod] = useState('PG1 (Relativo estático)');
  const [sigmaH, setSigmaH] = useState('0.05');
  const [sigmaV, setSigmaV] = useState('0.12');
  const [defaultAltitude, setDefaultAltitude] = useState('350.00');

  useEffect(() => {
    if (!session) return;
    let ok = true;
    setLoadingProjects(true);
    Promise.allSettled([listProjects(session), getDocumentCustomization(session)])
      .then(([a, b]) => {
        if (!ok) return;
        if (a.status === 'fulfilled') setProjects(a.value);
        else setError('Não foi possível carregar os projetos.');
        if (b.status === 'fulfilled') setOpts(record(record(b.value.customization).options));
      })
      .finally(() => {
        if (ok) setLoadingProjects(false);
      });
    return () => {
      ok = false;
    };
  }, [session]);

  const open = async (id: string, local?: ProjectFull) => {
    const request = projectLoads.current.begin();
    setProjectId(id);
    setCurrentStep(0);
    setPaintMode(false);
    setAppearance(defaultAppearance);
    setSelectedPolyId('all');
    setFull(null);
    setError('');
    if (!id || (!session && !local)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = local || await getProject(session!, id);
      if (projectLoads.current.isCurrent(request)) setFull(data);
    } catch (e) {
      if (projectLoads.current.isCurrent(request)) setError(e instanceof Error ? e.message : 'Falha ao carregar projeto.');
    } finally {
      if (projectLoads.current.isCurrent(request)) setLoading(false);
    }
  };

  const allPolygons = useMemo(() => (full ? getPolygons(full.features) : []), [full]);
  const filteredPolygons = useMemo(
    () => (selectedPolyId === 'all' ? allPolygons : allPolygons.filter(p => p.id === selectedPolyId)),
    [allPolygons, selectedPolyId]
  );

  const sheets = useMemo<OdsSheet[]>(() => {
    if (!full || !projectId) return [];
    const p = filteredPolygons;
    const project = full.project;
    const base: OdsSheet = {
      name: 'Projeto',
      rows: [
        ['CAMPO', 'DADO'],
        ['Projeto', projectTitle(project || { id: projectId })],
        ['Proprietário', text(project?.ownerName || project?.owner)],
        ['Município', text(project?.municipality || project?.city)],
        ['UF', text(project?.stateCode || project?.uf)],
        ['Imóveis / Glebas incluídas', p.length],
        ['Área (ha)', p.reduce((sum, f) => sum + f.areaM2 / 10000, 0)],
        ['Perímetro total (m)', p.reduce((sum, f) => sum + f.perimeterM, 0)]
      ]
    };
    const vertices: OdsSheet = {
      name: 'Vértices',
      rows: [['IMÓVEL', 'VÉRTICE', 'LATITUDE (DD)', 'LONGITUDE (DD)', 'ESTE E (UTM)', 'NORTE N (UTM)', 'FUSO', 'DISTÂNCIA PRÓXIMA (M)', 'AZIMUTE (GRAUS)']]
    };
    const confrontations: OdsSheet = {
      name: 'Confrontantes',
      rows: [['IMÓVEL', 'TRECHO INICIAL', 'TRECHO FINAL', 'CONFRONTANTE', 'PROPRIEDADE', 'PROPRIETÁRIO', 'CPF/CNPJ', 'RG', 'DIVISA']]
    };
    for (const poly of p) {
      const shared = readConfrontants(opts, projectId, poly.id);
      const props = mergeConfrontantsIntoProperties(poly.properties, poly.vertices.length, shared);
      const values = poly.vertices.map((_, i) => readConfrontation(props, i, poly.vertices.length));
      const groups = groupConfrontations(values);
      poly.vertices.forEach((v, i) => {
        const next = poly.vertices[(i + 1) % poly.vertices.length];
        let eUtm: number | string = '';
        let nUtm: number | string = '';
        let fuso = '';
        try {
          const u = utmFromWgs84([v[0], v[1]]);
          eUtm = Number(u.east.toFixed(3));
          nUtm = Number(u.north.toFixed(3));
          fuso = `${u.zone}${u.hemisphere}`;
        } catch {
          /* ignore */
        }
        vertices.rows.push([
          poly.name,
          `V-${String(i + 1).padStart(2, '0')}`,
          v[1],
          v[0],
          eUtm,
          nUtm,
          fuso,
          Number(distance(v, next).toFixed(2)),
          Number(azimuth(v, next).toFixed(5))
        ]);
      });
      for (const group of groups) {
        const start = group.start;
        const end = (group.indices.at(-1)! + 1) % poly.vertices.length;
        const details = record(record(props.confrontantDetails)[String(start)]);
        confrontations.rows.push([
          poly.name,
          `V-${String(start + 1).padStart(2, '0')}`,
          `V-${String(end + 1).padStart(2, '0')}`,
          group.label,
          text(details.property) || group.label,
          text(details.owner),
          text(details.cpf),
          text(details.rg),
          text(details.limitType)
        ]);
      }
    }
    return [base, vertices, confrontations];
  }, [full, opts, projectId, filteredPolygons]);

  const precheck = useMemo(() => {
    if (!full) return { sheets: [] as OdsSheet[], alerts: [] as string[] };
    const raw = reviewSigef(filteredPolygons, opts, projectId);
    // Enrich SIGEF precheck rows with the user-configured technical defaults when empty
    const patchedSheets = raw.sheets.map(s => {
      if (s.name !== 'Pré-conferência') return s;
      return {
        ...s,
        rows: s.rows.map((row, idx) => {
          if (idx === 0) return row;
          const nextRow = [...row];
          if (!nextRow[2]) nextRow[2] = vertexTypeDefault;
          if (!nextRow[9]) nextRow[9] = posMethod;
          if (nextRow[10] === null || nextRow[10] === '') nextRow[10] = Number(sigmaH) || 0.05;
          if (nextRow[11] === null || nextRow[11] === '') nextRow[11] = Number(sigmaV) || 0.12;
          if (!nextRow[12]) nextRow[12] = `${defaultAltitude} m`;
          return nextRow;
        })
      };
    });
    return { sheets: patchedSheets, alerts: raw.alerts };
  }, [full, opts, projectId, filteredPolygons, vertexTypeDefault, posMethod, sigmaH, sigmaV, defaultAltitude]);

  const exportSheets = sigefMode ? precheck.sheets : sheets;
  const safeSheetIdx = Math.min(activeSheetIdx, Math.max(0, exportSheets.length - 1));
  const spreadsheet = exportSheets[safeSheetIdx] || exportSheets[1] || exportSheets[0];

  const downloadOds = () => {
    if (!exportSheets.length) return;
    const blob = generateOds(exportSheets, {
      headerColor: appearance.headerColor,
      cellColor: appearance.tableColor,
      borderColor: appearance.borderColor,
      cellColors: appearance.cellColors
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `surveyor-${sigefMode ? 'conferencia-pre-sigef' : 'planilha'}-${projectId}.ods`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  const downloadCsv = () => {
    if (!spreadsheet) return;
    const csv =
      '\ufeff' +
      spreadsheet.rows
        .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';'))
        .join('\r\n');
    downloadText(`surveyor-${spreadsheet.name.toLowerCase()}-${projectId}.csv`, csv, 'text/csv;charset=utf-8');
  };

  const paintCell = (rowIndex: number, columnIndex: number) => {
    if (!paintMode) return;
    const key = `${safeSheetIdx}:${rowIndex}:${columnIndex}`;
    setAppearance(current => ({ ...current, cellColors: { ...current.cellColors, [key]: current.highlightColor } }));
  };

  const goToWorkflowStep = (step: number) => {
    const next = Math.max(0, Math.min(2, currentStep + 1, step));
    if (next > 0 && (!projectId || !full || loading)) {
      setError('Selecione ou aguarde o carregamento do projeto antes de continuar.');
      setCurrentStep(0);
      return;
    }
    setCurrentStep(next);
    requestAnimationFrame(() => {
      if (next === 0) {
        projectEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        projectEditorRef.current?.querySelector<HTMLSelectElement>('.project-source-select select')?.focus({ preventScroll: true });
      } else if (next === 1) {
        spreadsheetEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        spreadsheetEditorRef.current?.focus({ preventScroll: true });
      } else {
        odsExportRef.current?.focus({ preventScroll: true });
      }
    });
  };

  return (
    <main className="workspace-main doc-root">
      <GlobalLoading active={loading || loadingProjects} />
      <DocumentWorkflowBar
        label="Planilha técnica"
        variant="croqui"
        steps={['Projeto', 'Planilha', 'Exportação']}
        currentStep={currentStep}
        onStepChange={goToWorkflowStep}
        startActions={currentStep === 2 ? (
          <>
            <button className="doc-workflow-action" disabled={!exportSheets.length} onClick={downloadCsv}>
              <Download size={15} /> Baixar Aba Atual (.csv Excel)
            </button>
            <button ref={odsExportRef} className="doc-workflow-action doc-primary" disabled={!exportSheets.length} onClick={downloadOds}>
              <Download size={15} /> {sigefMode ? 'Baixar pré-conferência ODS' : 'Baixar Planilha ODS'}
            </button>
          </>
        ) : null}
      />
      <div className="workspace-container doc-container">
        <div className="doc-layout">
          <aside ref={projectEditorRef} className="doc-sidebar doc-sidebar--workflow">
            <div className="doc-panel doc-panel--workflow">
              {currentStep === 0 && <>
              <strong>Projeto</strong>
              <ProjectSourcePicker scope="project-spreadsheet" projects={projects} projectId={projectId} loading={loadingProjects||loading} onProjectChange={next => void open(next)} onImport={(data,fileName) => void open(data.project?.id||`local-upload:project-spreadsheet:${encodeURIComponent(fileName)}`,data)} onClearImport={() => void open('')} />
              {!full && <p className="doc-hint">Selecione o projeto que será usado na planilha.</p>}
              <nav className="doc-step-navigation" aria-label="Navegação da planilha">
                <button type="button" className="doc-workflow-action doc-outline" disabled>Anterior</button>
                <span>Etapa 1 de 3</span>
                <button type="button" className="doc-workflow-action doc-primary" disabled={!full || loading} onClick={() => goToWorkflowStep(1)}><ArrowRight size={15} /> Próximo</button>
              </nav>
              </>}
              {currentStep === 1 && <>
                <strong>Dados da planilha</strong>
                <label>
                  Tipo de planilha
                  <select
                    ref={planTypeRef}
                    value={sigefMode ? 'pre-sigef' : 'geral'}
                    onChange={e => {
                      setSigefMode(e.target.value === 'pre-sigef');
                      setActiveSheetIdx(1);
                    }}
                  >
                    <option value="geral">Planilha técnica completa (ODS / CSV)</option>
                    <option value="pre-sigef">Pré-conferência SIGEF / INCRA</option>
                  </select>
                </label>
                {allPolygons.length > 1 && (
                  <label>
                    Filtrar por Gleba / Perímetro
                    <select value={selectedPolyId} onChange={e => setSelectedPolyId(e.target.value)}>
                      <option value="all">Todas as glebas ({allPolygons.length})</option>
                      {allPolygons.map(poly => <option key={poly.id} value={poly.id}>{poly.name}</option>)}
                    </select>
                  </label>
                )}
                {sigefMode && projectId && <>
                  <h2>PARÂMETROS TÉCNICOS PADRÃO</h2>
                  <label>Tipo de vértice padrão<select value={vertexTypeDefault} onChange={e => setVertexTypeDefault(e.target.value as 'M' | 'P' | 'V')}><option value="M">M — Marco materializado</option><option value="P">P — Ponto de divisa natural</option><option value="V">V — Vértice virtual / inacessível</option></select></label>
                  <label>Método de posicionamento<select value={posMethod} onChange={e => setPosMethod(e.target.value)}><option value="PG1 (Relativo estático)">PG1 — GNSS Relativo Estático</option><option value="PG2 (Relativo estático-rápido)">PG2 — GNSS Estático-Rápido</option><option value="PG6 (RTK convencional)">PG6 — GNSS RTK Convencional</option><option value="PG7 (RTK em rede)">PG7 — GNSS RTK em Rede</option><option value="PG8 (PPP)">PG8 — Posicionamento por Ponto Preciso (PPP)</option><option value="PT1 (Poligonal topográfica)">PT1 — Poligonal Topográfica</option></select></label>
                  <div className="doc-two"><label>Precisão Horiz. σH (m)<input value={sigmaH} onChange={e => setSigmaH(e.target.value)} /></label><label>Precisão Vert. σV (m)<input value={sigmaV} onChange={e => setSigmaV(e.target.value)} /></label></div>
                  <label>Altitude padrão (m)<input value={defaultAltitude} onChange={e => setDefaultAltitude(e.target.value)} /></label>
                </>}
                {firstRowPreview(sheets)}
                <strong><Palette size={16} /> Editar planilha</strong>
                <p className="doc-hint">Defina as cores da folha e da tabela. Para destacar uma célula, selecione a cor, ative a pintura e clique nela.</p>
                <label>Cor do fundo da folha<input type="color" value={appearance.paperColor} onChange={event => setAppearance(current => ({ ...current, paperColor: event.target.value }))} /></label>
                <label>Cor da tabela<input type="color" value={appearance.tableColor} onChange={event => setAppearance(current => ({ ...current, tableColor: event.target.value }))} /></label>
                <label>Cor do cabeçalho<input type="color" value={appearance.headerColor} onChange={event => setAppearance(current => ({ ...current, headerColor: event.target.value }))} /></label>
                <label>Cor das bordas<input type="color" value={appearance.borderColor} onChange={event => setAppearance(current => ({ ...current, borderColor: event.target.value }))} /></label>
                <label>Cor para destacar células<input type="color" value={appearance.highlightColor} onChange={event => setAppearance(current => ({ ...current, highlightColor: event.target.value }))} /></label>
                <button type="button" className={`doc-workflow-action ${paintMode ? 'doc-primary' : 'doc-outline'}`} onClick={() => setPaintMode(value => !value)}>
                  <Paintbrush size={15} /> {paintMode ? 'Concluir pintura' : 'Pintar células'}
                </button>
                <p className="doc-hint" role="status">{paintMode ? 'Modo de pintura ativo: clique em uma célula da tabela para aplicar a cor selecionada.' : 'O ODS mantém as cores da tabela, do cabeçalho, das bordas e dos destaques. O fundo da folha é aplicado à prévia.'}</p>
                <button type="button" className="doc-workflow-action doc-outline" disabled={!Object.keys(appearance.cellColors).length} onClick={() => setAppearance(current => ({ ...current, cellColors: {} }))}>Limpar destaques</button>
                <nav className="doc-step-navigation" aria-label="Navegação da planilha">
                  <button type="button" className="doc-workflow-action doc-outline" onClick={() => goToWorkflowStep(0)}>Anterior</button>
                  <span>Etapa 2 de 3</span>
                  <button type="button" className="doc-workflow-action doc-primary" onClick={() => goToWorkflowStep(2)}><ArrowRight size={15} /> Próximo</button>
                </nav>
              </>}
              {currentStep === 2 && <nav className="doc-step-navigation" aria-label="Navegação da planilha">
                <button type="button" className="doc-workflow-action doc-outline" onClick={() => goToWorkflowStep(1)}>Anterior</button>
                <span>Etapa 3 de 3</span>
              </nav>}
            </div>
          </aside>
          <div ref={spreadsheetEditorRef} className="doc-main" tabIndex={-1}>
            <div className="doc-viewer doc-spreadsheet-viewer">
              {loading ? (
                <div className="doc-empty">Carregando...</div>
              ) : !full ? (
                <div className="doc-empty">Selecione um projeto para visualizar a planilha.</div>
              ) : (
                <div className="doc-spreadsheet-paper" style={{ backgroundColor: appearance.paperColor }}>
                  {currentStep === 2 && <div className="doc-export-guide"><strong>Planilha pronta para exportação</strong><span>Use ODS para manter as cores da tabela, do cabeçalho e os destaques. CSV exporta apenas os dados da aba atual.</span></div>}
                  <div className="ods-heading" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <FileSpreadsheet size={22} />
                      <strong>{sigefMode ? 'CONFERÊNCIA PRÉ-SIGEF (NÃO OFICIAL)' : 'PLANILHA TÉCNICA DO PROJETO'}</strong>
                      <span>{projectTitle(full.project || { id: projectId })}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {exportSheets.map((s, idx) => (
                        <button
                          key={s.name}
                          type="button"
                          className={safeSheetIdx === idx ? 'doc-primary' : 'doc-outline'}
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={() => setActiveSheetIdx(idx)}
                        >
                          Aba: {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="doc-sheet-scroll">
                    <table className="ods-table" style={{ backgroundColor: appearance.tableColor }}>
                      <thead>
                        <tr>
                          {spreadsheet?.rows[0].map((cell, i) => (
                            <th key={i} style={{ backgroundColor: appearance.cellColors[`${safeSheetIdx}:0:${i}`] || appearance.headerColor, borderColor: appearance.borderColor, cursor: paintMode ? 'crosshair' : undefined }} onClick={() => paintCell(0, i)} title={paintMode ? 'Aplicar cor de destaque' : undefined}>{cell}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {spreadsheet?.rows.slice(1).map((row, i) => (
                          <tr key={i}>
                            {row.map((cell, j) => (
                              <td key={j} style={{ backgroundColor: appearance.cellColors[`${safeSheetIdx}:${i + 1}:${j}`] || appearance.tableColor, borderColor: appearance.borderColor, cursor: paintMode ? 'crosshair' : undefined }} onClick={() => paintCell(i + 1, j)} title={paintMode ? 'Aplicar cor de destaque' : undefined}>
                                {typeof cell === 'number' ? cell.toLocaleString('pt-BR', { maximumFractionDigits: 7 }) : cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="ods-count">
                    {sigefMode
                      ? `Prévia com ${precheck.alerts.length} alerta(s); métodos, precisões, altitudes e modelo oficial devem ser conferidos antes de enviar ao SIGEF.`
                      : `${sheets[1]?.rows.length ? sheets[1].rows.length - 1 : 0} vértices • ${sheets[2]?.rows.length ? sheets[2].rows.length - 1 : 0} confrontações agrupadas • ${exportSheets.length} abas no arquivo ODS`}
                  </div>
                </div>
              )}
            </div>
            <div className="doc-toolbar">
              <div className="doc-toolbar-left">
                <button type="button" onClick={() => { setAppearance(defaultAppearance); setPaintMode(false); }} disabled={appearance === defaultAppearance && !Object.keys(appearance.cellColors).length}>
                  <RotateCcw size={14} /> Restaurar cores
                </button>
              </div>
            </div>
          </div>
        </div>
        {error && (
          <div className="doc-alert" role="status">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}

function firstRowPreview(sheets: OdsSheet[]) {
  if (!sheets.length) return null;
  return (
    <dl className="ods-summary">
      {sheets[0].rows.slice(1).map((row, i) => (
        <div key={i}>
          <dt>{row[0]}</dt>
          <dd>{typeof row[1] === 'number' ? (row[1] as number).toLocaleString('pt-BR', { maximumFractionDigits: 4 }) : row[1]}</dd>
        </div>
      ))}
    </dl>
  );
}
