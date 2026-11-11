import { GlobalLoading } from '../../components/GlobalLoading';
import { ProjectSourcePicker } from '../../components/ProjectSourcePicker';
import {requestConfirmation} from '../../components/ConfirmDialogHost';
import { DocumentWorkflowBar } from '../../components/layout/DocumentWorkflowBar';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { ChevronDown, Download, Printer, RotateCcw, Save } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { getDocumentCustomization } from '../customization/customizationApi';
import { listProjects, getProject, projectTitle, type Project, type ProjectFull } from '../projects/projectsApi';
import { record, text, getPolygons } from '../memorial/memorialEngine';
import { readConfrontants, mergeConfrontantsIntoProperties } from './confrontantRegistry';
import { readConfrontation, groupConfrontations } from '../croqui/croquiGeometry';
import { readDocumentDraft, saveDocumentDraft } from './cloudDraft';
import { formatBrazilianDocument, maskBrazilianDocumentInput } from '../../lib/documentIdentity';
import { LatestRequestSequence } from '../../lib/latestRequestSequence';
import { writeOfflineDraft } from '../../lib/offlineDraftStore';
import { buildConfrontationLettersHtml } from './confrontationLetterHtml';
import { docxBytes, downloadBytes } from '../generations/exportOffice';
import './documents.css';

type Fields = {
  location: string;
  date: string;
  name: string;
  cpf: string;
  from: string;
  to: string;
  boundary: string;
  notes: string;
  owner: string;
  property: string;
  technician: string;
  registry: string;
  company: string;
  companyAddress: string;
  customBody: string;
};

type FieldProps = {
  name: string;
  id: keyof Fields;
  value: string;
  onChange: (key: keyof Fields, value: string) => void;
  placeholder?: string;
  type?: string;
};

function LetterField({ name, id, value, onChange, placeholder, type = 'text' }: FieldProps) {
  return (
    <label>
      {name}
      <input id={id} type={type} placeholder={placeholder} value={value} onChange={e => onChange(id, e.target.value)} />
    </label>
  );
}

const today = () => new Date().toISOString().slice(0, 10);
const empty = (): Fields => ({
  location: '',
  date: today(),
  name: '',
  cpf: '',
  from: '',
  to: '',
  boundary: '',
  notes: '',
  owner: '',
  property: '',
  technician: '',
  registry: '',
  company: '',
  companyAddress: '',
  customBody: ''
});

const formatDate = (raw: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const [y, m, d] = raw.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d))
  );
};

const docCss = `@page{size:A4 portrait;margin:0}html,body{margin:0;background:#fff;font-family:Arial,sans-serif;color:#182332} .letter-page{box-sizing:border-box;width:210mm;min-height:297mm;padding:12mm 12mm 16mm;background:white;margin:auto;page-break-after:always;} .letter-page:last-child{page-break-after:auto;} .letter-header{display:flex;align-items:flex-start;justify-content:space-between;min-height:25mm;border-bottom:1px solid #3c5565;gap:24px;} .letter-header img{width:44mm;max-height:22mm;object-fit:contain;object-position:left top} .letter-header .letter-company{text-align:right;font-size:11pt;font-weight:bold}.letter-header .letter-address{font-size:8pt;font-weight:normal;color:#5b6b7c;margin-top:4px}.letter-title{text-align:center;font-weight:600;font-size:11pt;margin:7mm 0 2mm}.letter-text{font-size:10.3pt;line-height:1.38;text-align:justify}.letter-text p{margin:0 0 2mm}.letter-date{margin-top:9mm;font-size:10.2pt}.letter-sign{margin:16mm auto 8mm;width:88mm;text-align:center;font-size:10pt}.letter-sign .line{border-bottom:1px solid #354858;margin-bottom:2mm}.letter-footer{border-top:1px solid #abb6bf;padding-top:3mm;margin-top:10mm;font-size:8pt;color:#506275} .letter-notes{margin-top:4mm;white-space:pre-wrap}.letter-empty{color:#8993a1;font-style:italic}@media print{body{margin:0}.letter-page{box-shadow:none}}`;

export function ConfrontationPage() {
  const [loadingProjects, setLoadingProjects] = useState(true);
  const { session } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [full, setFull] = useState<ProjectFull | null>(null);
  const [projectId, setProjectId] = useState('');
  const [prefs, setPrefs] = useState<Record<string, unknown>>({});
  const [fields, setFields] = useState<Fields>(empty);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const original = useRef<Fields>(empty());
  const projectLoads = useRef(new LatestRequestSequence());
  const sidebarRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [choice, setChoice] = useState('');
  const [selectedPolygonId, setSelectedPolygonId] = useState('all');

  const logo = text(prefs.logoDataUrl) || '/brand/agr-logo-referencia.png';
  const set = (k: keyof Fields, v: string) => {
    setFields(f => ({ ...f, [k]: k === 'cpf' ? maskBrazilianDocumentInput(v) : v }));
    setDirty(true);
    setMessage('');
  };

  useEffect(() => {
    if (!session) return;
    let valid = true;
    setLoadingProjects(true);
    Promise.allSettled([listProjects(session), getDocumentCustomization(session)])
      .then(([a, b]) => {
        if (!valid) return;
        if (a.status === 'fulfilled') setProjects(a.value);
        else setMessage('Falha ao carregar os projetos da nuvem.');
        if (b.status === 'fulfilled') setPrefs(record(b.value.customization));
        else setMessage('Personalização da conta indisponível.');
      })
      .finally(() => {
        if (valid) setLoadingProjects(false);
      });
    return () => {
      valid = false;
    };
  }, [session]);

  const polygons = useMemo(() => (full ? getPolygons(full.features) : []), [full]);

  const choices = useMemo(() => {
    if (!full || !projectId) return [];
    const opts = record(prefs.options);
    const activePolys = selectedPolygonId === 'all' ? polygons : polygons.filter(p => p.id === selectedPolygonId);
    return activePolys.flatMap(poly => {
      const shared = readConfrontants(opts, projectId, poly.id);
      const props = mergeConfrontantsIntoProperties(poly.properties, poly.vertices.length, shared);
      const n = poly.vertices.length;
      return groupConfrontations(Array.from({ length: n }, (_, i) => readConfrontation(props, i, n))).map(group => {
        const start = group.start;
        const end = (group.indices.at(-1)! + 1) % n;
        const detail = record(record(props.confrontantDetails)[String(start)]);
        const owner = text(detail.owner);
        const property = text(detail.property) || group.label;
        const polyPrefix = polygons.length > 1 ? `[${poly.name}] ` : '';
        return {
          id: `${poly.id}:${start}`,
          polygonId: poly.id,
          polygonName: poly.name,
          label: `${polyPrefix}${property}${owner ? ' — ' + owner : ''} (V-${String(start + 1).padStart(2, '0')} a V-${String(end + 1).padStart(2, '0')})`,
          name: owner || group.label,
          cpf: text(detail.cpf),
          from: `V-${String(start + 1).padStart(2, '0')}`,
          to: `V-${String(end + 1).padStart(2, '0')}`,
          boundary: text(detail.limitType) || 'Não informado',
          property
        };
      });
    });
  }, [full, prefs, projectId, polygons, selectedPolygonId]);

  const selectConfrontant = (key: string) => {
    setChoice(key);
    const option = choices.find(item => item.id === key);
    if (!option) return;
    const baseTitle = projectTitle(full?.project || { id: projectId });
    const propName = polygons.length > 1 && option.polygonName ? `${baseTitle} — ${option.polygonName}` : baseTitle;
    setFields(current => ({
      ...current,
      name: option.name,
      cpf: formatBrazilianDocument(option.cpf),
      from: option.from,
      to: option.to,
      boundary: option.boundary === 'Não informado' ? '' : option.boundary,
      property: propName
    }));
    setDirty(true);
    setMessage('');
  };

  const open = useCallback(
    async (id: string, local?: ProjectFull) => {
      if (saving) {
        setMessage('Aguarde a confirmação do salvamento antes de trocar de projeto.');
        return;
      }
      if (dirty && !await requestConfirmation({title:'Trocar de projeto?',message:'Há alterações não salvas na carta. Descartar e trocar de projeto?',confirmLabel:'Descartar e trocar',destructive:true})) return;
      const request = projectLoads.current.begin();
      setProjectId(id);
      setChoice('');
      setSelectedPolygonId('all');
      setFull(null);
      const blankFields = empty();
      setFields(blankFields);
      original.current = structuredClone(blankFields);
      setDirty(false);
      setMessage('');
      if (!id || (!session && !local)) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = local || await getProject(session!, id);
        if (!projectLoads.current.isCurrent(request)) return;
        setFull(data);
        const defaults = empty();
        defaults.location = [text(data.project?.municipality || data.project?.city), text(data.project?.stateCode || data.project?.uf)]
          .filter(Boolean)
          .join('/');
        defaults.owner = text(data.project?.ownerName || data.project?.owner);
        defaults.property = projectTitle(data.project || { id });
        defaults.technician = text(prefs.responsibleTechnician);
        defaults.registry = text(prefs.professionalRegistry);
        defaults.company = text(prefs.companyName) || 'SURVEYOR';
        defaults.companyAddress = text(prefs.addressText);
        const draft = readDocumentDraft(record(prefs.options), 'confrontationLetters', id);
        const result = Object.keys(draft).length ? ({ ...defaults, ...draft } as Fields) : defaults;
        setFields(result);
        original.current = structuredClone(result);
      } catch (err) {
        if (projectLoads.current.isCurrent(request)) setMessage(err instanceof Error ? err.message : 'Não foi possível abrir o projeto.');
      } finally {
        if (projectLoads.current.isCurrent(request)) setLoading(false);
      }
    },
    [session, prefs, dirty, saving]
  );

  const save = async () => {
    if (!session || !projectId || !dirty) return;
    if (projectId.startsWith('local-upload:')) {
      const saved = await writeOfflineDraft(`surveyor-local-document-v1:confrontation:${projectId}`, fields);
      setDirty(!saved);
      setMessage(saved ? 'Carta salva neste navegador junto com o projeto importado.' : 'Não foi possível salvar a carta neste navegador.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      await saveDocumentDraft(session, 'confrontationLetters', projectId, fields as unknown as Record<string, unknown>);
      const remote = await getDocumentCustomization(session);
      const actual=readDocumentDraft(record(remote.customization?.options),'confrontationLetters',projectId);
      if(JSON.stringify(actual)!==JSON.stringify(fields))throw new Error('A nuvem não confirmou a carta. A edição local foi preservada.');
      original.current = structuredClone(fields);
      setDirty(false);
      setPrefs(record(remote.customization));
      setMessage('Carta salva e confirmada na nuvem.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Falha no salvamento.');
    } finally {
      setSaving(false);
    }
  };

  const restore = () => {
    setFields(structuredClone(original.current));
    setDirty(false);
    setMessage('Edições não salvas descartadas.');
  };

  const goToStep = (step: number) => {
    const next = Math.max(0, Math.min(3, currentStep + 1, step));
    if (next > 0 && (!projectId || !full || loading)) {
      setMessage('Selecione ou aguarde o carregamento do projeto antes de continuar.');
      setCurrentStep(0);
      return;
    }
    setCurrentStep(next);
    if (next !== 3) setDownloadOpen(false);
    if (next === 0) {
      sidebarRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      sidebarRef.current?.querySelector<HTMLSelectElement>('.project-source-select select')?.focus({ preventScroll: true });
      return;
    }
    if (next === 1 || next === 2) {
      const field = document.getElementById(next === 1 ? 'name' : 'from');
      field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      field?.focus({ preventScroll: true });
      return;
    }
    previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    previewRef.current?.focus({ preventScroll: true });
  };

  const isFilled = (value: string) => value.trim() || '________________________________';

  const exportHtml = () => {
    const paper = document.querySelector('.letter-page')?.outerHTML;
    if (!paper) return '';
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Carta de confrontação</title><style>${docCss}</style></head><body>${paper}</body></html>`;
  };

  const buildAllLettersHtml = () => {
    if (!choices.length) return exportHtml();
    const baseTitle = projectTitle(full?.project || { id: projectId });
    return buildConfrontationLettersHtml({ choices, polygonCount: polygons.length, baseTitle, fields, logo, docCss, formatDate });
  };

  const download = (format: 'html' | 'doc' | 'docx' | 'pdf' | 'batch-pdf' | 'batch-docx') => {
    if (!projectId) return;
    setDownloadOpen(false);
    if (format === 'pdf' || format === 'batch-pdf') {
      const htmlContent = format === 'batch-pdf' ? buildAllLettersHtml() : exportHtml();
      const win = window.open('', '_blank');
      if (!win) {
        setMessage('Permita pop-ups para imprimir em PDF.');
        return;
      }
      win.document.write(htmlContent);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 600);
      return;
    }
    if (format === 'docx') {
      const bodyParagraphs = fields.customBody.trim()
        ? fields.customBody.split(/\r?\n/).filter(Boolean)
        : [
            `Eu, ${isFilled(fields.name)}${fields.cpf.trim() ? `, inscrito(a) no CPF/CNPJ sob o nº ${formatBrazilianDocument(fields.cpf)}` : ''}, declaro, para os devidos fins, que fui cientificado(a) acerca dos limites do imóvel rural ${isFilled(fields.property)}, de responsabilidade de ${isFilled(fields.owner)}, situado em ${isFilled(fields.location)}.`,
            `O trecho confrontado corresponde a ${isFilled(fields.from)} a ${isFilled(fields.to)}, tendo como referência de limite: ${isFilled(fields.boundary)}.`
          ];
      if (fields.notes.trim()) bodyParagraphs.push(fields.notes.trim());
      bodyParagraphs.push(`${fields.location || 'Local da emissão'}, ${formatDate(fields.date)}.`);
      bodyParagraphs.push(`____________________________________________________`);
      bodyParagraphs.push(`${fields.name || 'Confrontante'}`);
      if (fields.technician) bodyParagraphs.push(`Responsável Técnico: ${fields.technician} ${fields.registry ? `— ${fields.registry}` : ''}`);
      downloadBytes(docxBytes(['CARTA DE CONFRONTAÇÃO', ...bodyParagraphs]), 'carta-confrontacao.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      return;
    }
    if (format === 'batch-docx') {
      const baseTitle = projectTitle(full?.project || { id: projectId });
      const paragraphs: string[] = ['CARTAS DE CONFRONTAÇÃO (LOTE COMPLETO)'];
      choices.forEach((c, idx) => {
        const propName = polygons.length > 1 && c.polygonName ? `${baseTitle} — ${c.polygonName}` : fields.property || baseTitle;
        if (idx > 0) paragraphs.push('================================================================');
        paragraphs.push(`CARTA DE CONFRONTAÇÃO Nº ${idx + 1} — ${propName}`);
        paragraphs.push(
          `Eu, ${isFilled(c.name)}${c.cpf.trim() ? `, inscrito(a) no CPF/CNPJ sob o nº ${formatBrazilianDocument(c.cpf)}` : ''}, declaro, para os devidos fins, que fui cientificado(a) acerca dos limites do imóvel rural ${isFilled(propName)}, de responsabilidade de ${isFilled(fields.owner)}, situado em ${isFilled(fields.location)}.`
        );
        paragraphs.push(
          `O trecho confrontado corresponde a ${isFilled(c.from)} a ${isFilled(c.to)}, tendo como referência de limite: ${isFilled(c.boundary === 'Não informado' ? fields.boundary : c.boundary)}.`
        );
        if (fields.notes.trim()) paragraphs.push(fields.notes.trim());
        paragraphs.push(`${fields.location || 'Local da emissão'}, ${formatDate(fields.date)}.`);
        paragraphs.push(`Assinatura do Confrontante: ${c.name || '________________________________'}`);
      });
      downloadBytes(docxBytes(paragraphs), 'cartas-confrontacao-1-por-1.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      return;
    }
    const file = new Blob([exportHtml()], { type: format === 'doc' ? 'application/msword' : 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = `carta-confrontacao.${format}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  return (
    <main className="workspace-main doc-root confrontation-page">
      <GlobalLoading active={loading || loadingProjects} />
      <DocumentWorkflowBar
        label="Carta de confrontação"
        variant="croqui"
        steps={['Projeto', 'Confrontante', 'Trecho', 'Carta']}
        currentStep={currentStep}
        onStepChange={goToStep}
        startActions={(
          <>
            <div className="doc-menu-wrap">
              <button type="button" className="doc-workflow-action" disabled={!full || currentStep !== 3 || loading} onClick={() => setDownloadOpen(v => !v)} aria-haspopup="menu" aria-expanded={downloadOpen}>
                <Download size={15} /> Baixar <ChevronDown size={14} />
              </button>
              {downloadOpen && (
                <div className="doc-download-menu" role="menu">
                  <button role="menuitem" onClick={() => download('pdf')}><Printer size={14} /> Imprimir / PDF (Atual)</button>
                  <button role="menuitem" onClick={() => download('docx')}>Word Oficial (.docx)</button>
                  <button role="menuitem" onClick={() => download('doc')}>Word Clássico (.doc)</button>
                  <button role="menuitem" onClick={() => download('html')}>HTML</button>
                  {choices.length > 1 && <>
                    <button role="menuitem" onClick={() => download('batch-pdf')}>Imprimir todas 1 por 1 (PDF · {choices.length} cartas)</button>
                    <button role="menuitem" onClick={() => download('batch-docx')}>Word (.docx) de todas as cartas ({choices.length})</button>
                  </>}
                </div>
              )}
            </div>
            <button type="button" className="doc-workflow-action" disabled={!dirty} onClick={restore}>
              <RotateCcw size={15} /> Restaurar rascunho
            </button>
          </>
        )}
        actions={(
          <>
            <button type="button" className="doc-workflow-action doc-primary" disabled={!dirty || !projectId || saving} onClick={() => void save()}>
              <Save size={15} /> {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </>
        )}
      />
      <div className="workspace-container doc-container">
        {message && (
          <div className="doc-alert" role="status">
            {message}
            <button onClick={() => setMessage('')}>×</button>
          </div>
        )}
        <div className="doc-layout">
          <aside className="doc-sidebar doc-sidebar--workflow confrontation-editor" ref={sidebarRef}>
            <div className="doc-panel doc-panel--workflow confrontation-panel">
              {currentStep === 0 && <section className="confrontation-section">
                <h2>Projeto e imóvel</h2>
                <ProjectSourcePicker scope="confrontation" projects={projects} projectId={projectId} loading={loadingProjects||loading} onProjectChange={next => void open(next)} onImport={(data,fileName) => void open(data.project?.id||`local-upload:confrontation:${encodeURIComponent(fileName)}`,data)} onClearImport={() => void open('')} />
                {polygons.length > 1 && (
                  <label>
                    Gleba / perímetro
                    <select value={selectedPolygonId} onChange={e => { setSelectedPolygonId(e.target.value); setChoice(''); }}>
                      <option value="all">Todas as glebas ({polygons.length})</option>
                      {polygons.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </section>}

              {currentStep === 1 && <section className="confrontation-section">
                <h2>Confrontante</h2>
                <label>
                  Cadastrado ({choices.length})
                  <select value={choice} onChange={e => selectConfrontant(e.target.value)}>
                    <option value="">Preenchimento manual</option>
                    {choices.map(item => (
                      <option value={item.id} key={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="doc-two">
                  <LetterField id="location" name="Local da emissão" value={fields.location} onChange={set} placeholder="Ex.: Amargosa/BA" />
                  <LetterField id="date" name="Data da emissão" value={fields.date} onChange={set} type="date" />
                </div>
                <div className="doc-two">
                  <LetterField id="name" name="Nome do confrontante" value={fields.name} onChange={set} placeholder="Nome completo" />
                  <LetterField id="cpf" name="CPF/CNPJ do confrontante" value={fields.cpf} onChange={set} placeholder="Opcional" />
                </div>
              </section>}

              {currentStep === 2 && <section className="confrontation-section">
                <h2>Trecho confrontado</h2>
                <div className="doc-two">
                  <LetterField id="from" name="Vértice inicial" value={fields.from} onChange={set} placeholder="V-01" />
                  <LetterField id="to" name="Vértice final" value={fields.to} onChange={set} placeholder="V-02" />
                </div>
                <LetterField id="boundary" name="Descrição do limite" value={fields.boundary} onChange={set} placeholder="Cerca, estrada, rio..." />
                <label>
                  Observações
                  <textarea rows={2} placeholder="Informações adicionais" value={fields.notes} onChange={e => set('notes', e.target.value)} />
                </label>
              </section>}

              {currentStep === 3 && <><section className="confrontation-section">
                <h2>Texto da declaração</h2>
                <label>
                  Texto personalizado (opcional)
                  <textarea
                    rows={4}
                    placeholder="Deixe em branco para usar a redação automática ou digite aqui o texto personalizado da carta..."
                    value={fields.customBody}
                    onChange={e => set('customBody', e.target.value)}
                  />
                </label>
              </section>

              <details className="confrontation-details">
                <summary>Identificação complementar</summary>
                <div className="confrontation-details-fields">
                  <LetterField id="property" name="Imóvel" value={fields.property} onChange={set} />
                  <LetterField id="owner" name="Responsável / proprietário" value={fields.owner} onChange={set} />
                  <LetterField id="technician" name="Responsável técnico" value={fields.technician} onChange={set} />
                  <LetterField id="registry" name="Registro profissional" value={fields.registry} onChange={set} />
                  <LetterField id="company" name="Empresa" value={fields.company} onChange={set} />
                  <LetterField id="companyAddress" name="Endereço comercial" value={fields.companyAddress} onChange={set} />
                </div>
              </details>
              </>}
              <nav className="doc-step-navigation" aria-label="Navegação da carta">
                <button type="button" className="doc-workflow-action doc-outline" disabled={currentStep === 0} onClick={() => goToStep(currentStep - 1)}>Anterior</button>
                <span>Etapa {currentStep + 1} de 4</span>
                {currentStep < 3 ? (
                  <button type="button" className="doc-workflow-action doc-primary" disabled={!full || loading} onClick={() => goToStep(currentStep + 1)}>Próximo</button>
                ) : (
                  <button type="button" className="doc-workflow-action doc-primary" disabled={!projectId || saving} onClick={() => void save()}>{saving ? 'Salvando...' : 'Concluir e salvar'}</button>
                )}
              </nav>
            </div>
          </aside>
          <div className="doc-main">
            <div className="confrontation-preview-heading">
              <strong>Prévia da carta</strong>
              <span>A4 · atualização em tempo real</span>
            </div>
            <div className="doc-viewer doc-letter-stage" ref={previewRef} tabIndex={-1}>
              {loading ? (
                <div className="doc-empty">Carregando projeto...</div>
              ) : projectId && full ? (
                <div className="letter-page">
                  <header className="letter-header">
                    <img alt="Logotipo da empresa" src={logo} />
                    <div className="letter-company">
                      {fields.company || 'SURVEYOR'}
                      <div className="letter-address">{fields.companyAddress}</div>
                    </div>
                  </header>
                  <div className="letter-title">CARTA DE CONFRONTAÇÃO</div>
                  <section className="letter-text">
                    {fields.customBody.trim() ? (
                      fields.customBody.split(/\r?\n/).map((line, i) => <p key={i}>{line}</p>)
                    ) : (
                      <>
                        <p>
                          Eu, <strong>{isFilled(fields.name)}</strong>
                          {fields.cpf.trim() ? (
                            <>
                              , inscrito(a) no CPF/CNPJ sob o nº <strong>{formatBrazilianDocument(fields.cpf)}</strong>,
                            </>
                          ) : (
                            ','
                          )}{' '}
                          declaro, para os devidos fins, que fui cientificado(a) acerca dos limites do imóvel rural{' '}
                          <strong>{isFilled(fields.property)}</strong>, de responsabilidade de <strong>{isFilled(fields.owner)}</strong>,
                          situado em <strong>{isFilled(fields.location)}</strong>.
                        </p>
                        <p>
                          O trecho confrontado corresponde a{' '}
                          <strong>
                            {isFilled(fields.from)} a {isFilled(fields.to)}
                          </strong>
                          , tendo como referência de limite: <strong>{isFilled(fields.boundary)}</strong>.
                        </p>
                      </>
                    )}
                    {fields.notes && <p className="letter-notes">{fields.notes}</p>}
                  </section>
                  <div className="letter-date">
                    {fields.location || 'Local da emissão'}, {formatDate(fields.date)}.
                  </div>
                  <div className="letter-sign">
                    <div className="line" />
                    <strong>{fields.name || 'Nome do confrontante'}</strong>
                    <div>Confrontante</div>
                  </div>
                  <footer className="letter-footer">
                    {fields.technician && (
                      <>
                        <strong>Responsável técnico:</strong> {fields.technician} {fields.registry && `— ${fields.registry}`}
                      </>
                    )}
                  </footer>
                </div>
              ) : (
                <div className="doc-empty">Selecione um projeto para visualizar o documento.</div>
              )}
            </div>
          </div>
        </div>
      </div>
      <style>{`
        .confrontation-page .confrontation-panel {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .confrontation-page .doc-step-navigation {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding-top: 4px;
        }
        .confrontation-page .doc-step-navigation span { color: #64748b; font-size: 12px; }
        .confrontation-page .confrontation-section {
          display: grid;
          gap: 12px;
          padding: 14px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background: #fff;
        }
        .confrontation-page .confrontation-section h2 {
          margin: 0;
          color: #17365b;
          font-size: 15px;
          font-weight: 700;
          line-height: 1.35;
        }
        .confrontation-page .confrontation-section label,
        .confrontation-page .confrontation-details-fields label {
          min-width: 0;
          margin: 0;
        }
        .confrontation-page .confrontation-section .doc-two {
          margin: 0;
        }
        .confrontation-page .confrontation-details {
          padding: 12px 14px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background: #f8fafc;
        }
        .confrontation-page .confrontation-details summary {
          color: #17365b;
          font-weight: 700;
          cursor: pointer;
        }
        .confrontation-page .confrontation-details-fields {
          display: grid;
          gap: 12px;
          margin-top: 14px;
        }
        .confrontation-page .confrontation-preview-heading {
          display: flex;
          min-height: 48px;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 0 16px;
          border-bottom: 1px solid #cbd5e1;
          background: #fff;
          color: #17365b;
        }
        .confrontation-page .confrontation-preview-heading span {
          color: #64748b;
          font-size: 12px;
        }
        .confrontation-page .doc-main {
          display: flex;
          min-width: 0;
          flex-direction: column;
        }
        .confrontation-page .doc-viewer {
          flex: 1;
          min-height: 0;
        }
        @media (max-width: 720px) {
          .confrontation-page .confrontation-preview-heading {
            align-items: flex-start;
            flex-direction: column;
            justify-content: center;
            gap: 2px;
            padding: 8px 12px;
          }
        }
      `}</style>
    </main>
  );
}
