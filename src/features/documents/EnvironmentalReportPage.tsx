import { GlobalLoading } from '../../components/GlobalLoading';
import { DocumentWorkflowBar } from '../../components/layout/DocumentWorkflowBar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Download, Printer } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { listProjects, getProject, projectTitle, type Project, type ProjectFull } from '../projects/projectsApi';
import { getDocumentCustomization } from '../customization/customizationApi';
import { getPolygons, record, text, fmt } from '../memorial/memorialEngine';
import { docxBytes, downloadBytes } from '../generations/exportOffice';
import { SignaturePadControl } from '../../components/SignaturePadControl';
import { FileUploadField, type UploadProgressReporter } from '../../components/FileUploadField';
import { ProjectSourcePicker } from '../../components/ProjectSourcePicker';
import { LatestRequestSequence } from '../../lib/latestRequestSequence';
import './documents.css';

function readUploadDataUrl(file: File, reportProgress: UploadProgressReporter): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = event => {
      if (event.lengthComputable && event.total > 0) reportProgress(file, event.loaded, event.total);
    };
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler a assinatura.'));
    reader.onabort = () => reject(new Error('Leitura da assinatura cancelada.'));
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('A assinatura não pôde ser lida.'));
    reader.readAsDataURL(file);
  });
}

type EnvironmentCategory = 'app' | 'reserva' | 'vegetacao' | 'produtiva';
const findCategory = (raw: Record<string, unknown>): EnvironmentCategory | null => {
  const label = [raw.category, raw.type, raw.layer, raw.classification, raw.nome].map(v => text(v).toLowerCase()).join(' ');
  if (/reserva\s*legal|\brl\b/.test(label)) return 'reserva';
  if (/\bapp\b|preserva[cç][aã]o permanente/.test(label)) return 'app';
  if (/vegeta[cç][aã]o nativa/.test(label)) return 'vegetacao';
  if (/produtiv|consolidada/.test(label)) return 'produtiva';
  return null;
};
const categories: [EnvironmentCategory, string][] = [
  ['app', 'APP'],
  ['reserva', 'RESERVA LEGAL'],
  ['vegetacao', 'VEGETAÇÃO NATIVA'],
  ['produtiva', 'ÁREA PRODUTIVA']
];
const formatData = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR');
const cssPrint = `@page{size:A4;margin:0}*{box-sizing:border-box}html,body{margin:0;background:white;color:#1b293e;font-family:Arial,sans-serif}.env-paper{width:210mm;min-height:297mm;padding:12mm;box-shadow:none;font-size:11px}.env-header{display:flex;justify-content:space-between;align-items:center;min-height:65px;border-bottom:2px solid #4c627c;padding-bottom:9px}.env-header img{max-width:170px;max-height:65px;object-fit:contain}.env-header div{display:grid;gap:5px;text-align:right}.env-header strong{font-size:19px}.env-header small{color:#71819a;font-size:10px}.env-paper h1{font-size:17px;text-align:center;margin:16px 0 9px;border-bottom:2px solid #75859c;padding-bottom:10px}.env-subtitle{text-align:center;color:#627188;margin:6px 0 17px;font-size:10px}.env-data,.env-categories{border-collapse:collapse;width:100%;table-layout:fixed}.env-data th,.env-data td,.env-categories th,.env-categories td{border:1px solid #a1afbf;padding:8px;text-align:left;word-break:break-word;vertical-align:top}.env-data th{width:18%;font-size:10px}.env-data td{width:32%}.env-metrics{display:grid;grid-template-columns:repeat(4,1fr);margin-top:16px;border:1px solid #aebccb}.env-metrics div{padding:8px;display:grid;gap:5px;border-right:1px solid #aebccb}.env-metrics small{font-size:9px;color:#425b78;font-weight:700}.env-metrics strong{font-size:13px}.env-paper h2{font-size:13px;margin:18px 0 8px;padding-bottom:6px;border-bottom:1px solid #8c9bab}.env-categories th{background:#e6edf7}.env-signatures{display:grid;grid-template-columns:1fr 1fr;gap:25px;margin-top:32px;text-align:center}.env-signatures>div{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;min-height:58px}.env-signatures img{max-width:170px;max-height:45px;object-fit:contain}.env-sign-line{width:100%;border-top:1px solid #4c5c6e;margin-bottom:6px}.env-signatures strong{font-size:10px}.env-signatures small{font-size:9px;font-weight:700}.env-footer{border-top:1px solid #b4c0cd;margin-top:26px;padding-top:9px;font-size:9px;color:#536783}`;

export function EnvironmentalReportPage() {
  const [loadingProjects, setLoadingProjects] = useState(true);
  const { session } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [full, setFull] = useState<ProjectFull | null>(null);
  const [id, setId] = useState('');
  const [prefs, setPrefs] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [signature, setSignature] = useState<string | null>(null);
  const [includeSignature, setIncludeSignature] = useState(true);
  const [manualAreas, setManualAreas] = useState<Record<EnvironmentCategory, string>>({ app: '', reserva: '', vegetacao: '', produtiva: '' });
  const [technicalNotes, setTechnicalNotes] = useState(
    'Diagnóstico ambiental preliminar elaborado a partir da fotointerpretação de imagens orbitais e levantamento perimetral georreferenciado.'
  );
  const sidebarRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const projectLoads = useRef(new LatestRequestSequence());

  useEffect(() => {
    if (!session) return;
    let active = true;
    setLoadingProjects(true);
    Promise.allSettled([listProjects(session), getDocumentCustomization(session)])
      .then(([a, b]) => {
        if (!active) return;
        if (a.status === 'fulfilled') setProjects(a.value);
        else setError('Falha ao carregar projetos.');
        if (b.status === 'fulfilled') setPrefs(record(b.value.customization));
      })
      .finally(() => {
        if (active) setLoadingProjects(false);
      });
    return () => {
      active = false;
    };
  }, [session]);

  const open = async (projectId: string, local?: ProjectFull) => {
    const request = projectLoads.current.begin();
    setId(projectId);
    setCurrentStep(0);
    setFull(null);
    setError('');
    setManualAreas({ app: '', reserva: '', vegetacao: '', produtiva: '' });
    if ((!session && !local) || !projectId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = local || await getProject(session!, projectId);
      if (projectLoads.current.isCurrent(request)) {
        setFull(data);
        setCurrentStep(0);
      }
    } catch (e) {
      if (projectLoads.current.isCurrent(request)) setError(e instanceof Error ? e.message : 'Erro ao carregar imóvel.');
    } finally {
      if (projectLoads.current.isCurrent(request)) setLoading(false);
    }
  };

  const features = useMemo(() => getPolygons(full?.features || []), [full]);
  const main = features.find(p => !findCategory(p.properties)) || features[0];

  const classified = useMemo(() => {
    const areas: Record<EnvironmentCategory, number | undefined> = {
      app: undefined,
      reserva: undefined,
      vegetacao: undefined,
      produtiva: undefined
    };
    for (const polygon of features) {
      const type = findCategory(polygon.properties);
      if (type) areas[type] = (areas[type] || 0) + polygon.areaM2 / 10000;
    }
    for (const [k] of categories) {
      const manualVal = Number(manualAreas[k].replace(',', '.'));
      if (manualAreas[k].trim() && Number.isFinite(manualVal) && manualVal >= 0) {
        areas[k] = manualVal;
      }
    }
    return areas;
  }, [features, manualAreas]);

  const company = text(prefs.companyName) || 'AGR Consultoria';
  const logo = text(prefs.logoDataUrl) || '/brand/agr-logo-referencia.png';
  const cloudSignature = text(prefs.planDocumentSignatureDataUrl);
  const activeSignature = signature === null ? cloudSignature : signature;
  const owner = text(full?.project?.ownerName || full?.project?.owner) || text(main?.properties.owner) || 'Não informado';
  const town = text(full?.project?.municipality || full?.project?.city);
  const state = text(full?.project?.stateCode || full?.project?.uf);
  const tech = text(prefs.responsibleTechnician) || 'Não informado';
  const date = new Date().toISOString().slice(0, 10);

  const print = () => {
    const paper = document.querySelector('.env-paper')?.outerHTML;
    if (!paper) return;
    const w = window.open('', '_blank');
    if (!w) {
      setError('Permita pop-ups para gerar PDF.');
      return;
    }
    w.document.write(
      `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><base href="${location.origin}/"><title>Relatório Ambiental</title><style>${cssPrint}</style></head><body>${paper}</body></html>`
    );
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 550);
  };

  const downloadDocx = () => {
    if (!full) return;
    const paragraphs = [
      `Imóvel: ${projectTitle(full.project || { id })}`,
      `Proprietário: ${owner}`,
      `Município / UF: ${[town, state].filter(Boolean).join('/') || 'Não informada'}`,
      `Área Total do Perímetro: ${main ? `${fmt(main.areaM2 / 10000, 4)} ha` : 'Não informada'}`,
      `Data da Análise: ${formatData(date)}`,
      'QUADRO DE ÁREAS AMBIENTAIS',
      ...categories.map(([key, label]) => `${label}: ${classified[key] === undefined ? 'Não cadastrado' : `${fmt(classified[key]!, 4)} ha`}`),
      'PARECER E CONSIDERAÇÕES TÉCNICAS',
      technicalNotes,
      `Responsável Técnico: ${tech}${text(prefs.professionalRegistry) ? ` — ${text(prefs.professionalRegistry)}` : ''}`
    ];
    downloadBytes(docxBytes(['RELATÓRIO AMBIENTAL PRELIMINAR', ...paragraphs]), 'relatorio-ambiental.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  };

  const changeSignature = async (file: File, reportProgress: UploadProgressReporter) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2_000_000) {
      setError('Selecione uma imagem PNG, JPEG ou WebP de até 2 MB.');
      throw new Error('Selecione uma imagem PNG, JPEG ou WebP de até 2 MB.');
    }
    try {
      const dataUrl = await readUploadDataUrl(file, reportProgress);
      setSignature(dataUrl);
      setIncludeSignature(true);
      setError('');
    } catch (error) {
      setError('Não foi possível ler a imagem da assinatura.');
      throw error;
    }
  };

  const goToStep = (step: number) => {
    const next = Math.max(0, Math.min(3, currentStep + 1, step));
    if (next > 0 && (!id || !full)) {
      setCurrentStep(0);
      sidebarRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      sidebarRef.current?.querySelector<HTMLSelectElement>('.project-source-select select')?.focus({ preventScroll: true });
      return;
    }
    setCurrentStep(next);
    if (next !== 3) setDownloadOpen(false);
    if (next === 0) {
      sidebarRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      sidebarRef.current?.querySelector<HTMLSelectElement>('.project-source-select select')?.focus({ preventScroll: true });
    } else if (next === 1) {
      const field = document.getElementById('env-area-app');
      field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (field || sidebarRef.current?.querySelector<HTMLSelectElement>('.project-source-select select'))?.focus({ preventScroll: true });
    } else if (next === 3) {
      sidebarRef.current?.scrollTo({ top: sidebarRef.current.scrollHeight, behavior: 'smooth' });
    } else {
      previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      previewRef.current?.focus({ preventScroll: true });
    }
  };

  return (
    <main className="workspace-main doc-root environmental-report-page">
      <GlobalLoading active={loading || loadingProjects} />
      <DocumentWorkflowBar
        label="Relatório ambiental"
        variant="croqui"
        steps={['Projeto', 'Análise', 'Relatório', 'Assinatura']}
        currentStep={currentStep}
        onStepChange={goToStep}
        startActions={(
          <div className="doc-menu-wrap">
            <button type="button" className="doc-workflow-action doc-primary" disabled={!full || currentStep !== 3 || loading} onClick={() => setDownloadOpen(value => !value)} aria-haspopup="menu" aria-expanded={downloadOpen}>
              <Download size={15} /> Baixar <ChevronDown size={14} />
            </button>
            {downloadOpen && <div className="doc-download-menu" role="menu">
              <button role="menuitem" onClick={() => { setDownloadOpen(false); downloadDocx(); }}><Download size={14} /> Baixar Word (.docx)</button>
              <button role="menuitem" onClick={() => { setDownloadOpen(false); print(); }}><Printer size={14} /> Imprimir / salvar PDF</button>
            </div>}
          </div>
        )}
      />
      <div className="workspace-container doc-container">
        <div className="doc-layout">
          <aside className="doc-sidebar doc-sidebar--workflow" ref={sidebarRef}>
            <div className="doc-panel doc-panel--workflow">
              <strong>{['Projeto', 'Análise', 'Relatório', 'Assinatura'][currentStep]}</strong>
              {currentStep === 0 && <>
                <ProjectSourcePicker scope="environmental-report" projects={projects} projectId={id} loading={loadingProjects||loading} onProjectChange={next => void open(next)} onImport={(data,fileName) => void open(data.project?.id||`local-upload:environmental-report:${encodeURIComponent(fileName)}`,data)} onClearImport={() => void open('')} />
                {!id&&!full&&!loadingProjects&&!loading&&<p className="doc-project-empty">Selecione um projeto para carregar os dados do imóvel e as glebas.</p>}
                {full && <div className="doc-status-card"><strong>{projectTitle(full.project || { id })}</strong><span>Projeto carregado. Avance para analisar as áreas ambientais.</span></div>}
              </>}
              {currentStep === 1 && full && <>
                {categories.map(([key, label]) => (
                  <label key={key}>
                    {label} (ha)
                    <input
                      id={`env-area-${key}`}
                      placeholder={classified[key] !== undefined ? fmt(classified[key]!, 4) : 'Ex.: 4,2500'}
                      value={manualAreas[key]}
                      onChange={e => setManualAreas(prev => ({ ...prev, [key]: e.target.value }))}
                    />
                  </label>
                ))}
              </>}
              {currentStep === 2 && full && <>
                <h2>Relatório ambiental preliminar</h2>
                <label>
                  Parecer / Observações técnicas
                  <textarea rows={7} value={technicalNotes} onChange={e => setTechnicalNotes(e.target.value)} />
                </label>
                <div className="doc-status-card"><strong>Áreas classificadas</strong><span>{categories.filter(([key]) => classified[key] !== undefined).length} categoria(s) preenchida(s).</span></div>
              </>}
              {currentStep === 3 && full && <>
                <h2>Assinatura do responsável</h2>
                <label className="doc-inline">
                  <input type="checkbox" checked={includeSignature} onChange={e => setIncludeSignature(e.target.checked)} /> Incluir assinatura
                </label>
                {activeSignature && <img style={{ maxWidth: 180, maxHeight: 65, objectFit: 'contain' }} src={activeSignature} alt="Prévia da assinatura" />}
                <FileUploadField label="Substituir assinatura neste relatório" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" maxBytes={2_000_000} description="PNG, JPEG ou WebP, até 2 MB." onFile={changeSignature} />
                <SignaturePadControl label="Desenhar assinatura na tela" onApply={dataUrl => { setSignature(dataUrl); setIncludeSignature(true); }} />
                <button
                  type="button"
                  className="doc-outline"
                  disabled={signature === null}
                  onClick={() => {
                    setSignature(null);
                    setIncludeSignature(true);
                  }}
                >
                  Usar assinatura da minha conta
                </button>
              </>}
              <nav className="doc-step-navigation" aria-label="Navegação do relatório ambiental">
                <button type="button" className="doc-workflow-action doc-outline" disabled={currentStep === 0} onClick={() => goToStep(currentStep - 1)}>Anterior</button>
                <span>Etapa {currentStep + 1} de 4</span>
                {currentStep < 3 ? (
                  <button type="button" className="doc-workflow-action doc-primary" disabled={currentStep === 0 && !full} onClick={() => goToStep(currentStep + 1)}>Próximo</button>
                ) : (
                  <button type="button" className="doc-workflow-action doc-primary" onClick={() => { setDownloadOpen(true); setError('Relatório revisado. Você pode baixar em Word ou imprimir em PDF.'); }}>Finalizar</button>
                )}
              </nav>
            </div>
          </aside>
          <div className="doc-main">
            <div className="doc-viewer" ref={previewRef} tabIndex={-1}>
              {loading ? (
                <div className="doc-empty">Carregando...</div>
              ) : !full ? (
                <div className="doc-empty">Selecione um projeto para visualizar o relatório.</div>
              ) : (
                <div className="env-paper">
                  <header className="env-header">
                    <img alt="Marca da empresa" src={logo} />
                    <div>
                      <strong>{company}</strong>
                      <small>{text(prefs.addressText)}</small>
                    </div>
                  </header>
                  <h1>RELATÓRIO AMBIENTAL PRELIMINAR</h1>
                  <p className="env-subtitle">APP, Reserva Legal, vegetação e áreas produtivas do projeto.</p>
                  <table className="env-data">
                    <tbody>
                      <tr>
                        <th>IMÓVEL</th>
                        <td>{projectTitle(full.project || { id })}</td>
                        <th>PROPRIETÁRIO</th>
                        <td>{owner}</td>
                      </tr>
                      <tr>
                        <th>LOCALIZAÇÃO</th>
                        <td>{[town, state].filter(Boolean).join('/') || 'Não informada'}</td>
                        <th>RESPONSÁVEL PELA ANÁLISE</th>
                        <td>{tech}</td>
                      </tr>
                      <tr>
                        <th>DATA</th>
                        <td>{formatData(date)}</td>
                        <th>ÁREA DO PERÍMETRO</th>
                        <td>{main ? `${fmt(main.areaM2 / 10000, 4)} ha` : 'Não informada'}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="env-metrics">
                    {categories.map(([key, label]) => (
                      <div key={key}>
                        <small>{label}</small>
                        <strong>{classified[key] === undefined ? 'Não cadastrado' : `${fmt(classified[key]!, 4)} ha`}</strong>
                      </div>
                    ))}
                  </div>
                  <h2>QUADRO DE ÁREAS AMBIENTAIS</h2>
                  <table className="env-categories">
                    <thead>
                      <tr>
                        <th>CATEGORIA</th>
                        <th>ÁREA (HA)</th>
                        <th>% DO PERÍMETRO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories
                        .filter(([key]) => classified[key] !== undefined)
                        .map(([key, label]) => (
                          <tr key={key}>
                            <td>{label}</td>
                            <td>{fmt(classified[key]!, 4)}</td>
                            <td>{main?.areaM2 ? fmt((classified[key]! / (main.areaM2 / 10000)) * 100, 2) + '%' : '—'}</td>
                          </tr>
                        ))}
                      {categories.every(([key]) => classified[key] === undefined) && (
                        <tr>
                          <td colSpan={3}>Nenhuma área ambiental classificada no projeto.</td>
                        </tr>
                      )}
                      <tr>
                        <th>Área do perímetro</th>
                        <td>{main ? fmt(main.areaM2 / 10000, 4) : '—'}</td>
                        <td>100%</td>
                      </tr>
                    </tbody>
                  </table>
                  {technicalNotes.trim() && (
                    <>
                      <h2>PARECER E CONSIDERAÇÕES TÉCNICAS</h2>
                      <p style={{ lineHeight: 1.5, textAlign: 'justify', margin: '6px 0 14px' }}>{technicalNotes}</p>
                    </>
                  )}
                  <div className="env-signatures">
                    <div>
                      {includeSignature && activeSignature && <img src={activeSignature} alt="Assinatura do responsável pela análise" />}
                      <div className="env-sign-line" />
                      <strong>{tech}</strong>
                      <small>RESPONSÁVEL PELA ANÁLISE</small>
                    </div>
                    <div>
                      <div className="env-sign-line" />
                      <strong>{tech}</strong>
                      <small>RESPONSÁVEL TÉCNICO</small>
                    </div>
                  </div>
                  <footer className="env-footer">
                    Responsável técnico: {tech}
                    {text(prefs.professionalRegistry) ? ` — ${text(prefs.professionalRegistry)}` : ''}
                  </footer>
                </div>
              )}
            </div>
          </div>
        </div>
        {error && (
          <div className="doc-alert" role="alert">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
