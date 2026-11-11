import { useEffect, useState, type DragEvent } from 'react';
import { FileText, Trash2, UploadCloud } from 'lucide-react';
import { readOfflineDraft, removeOfflineDraft, writeOfflineDraft } from '../lib/offlineDraftStore';
import type { Project, ProjectFeature, ProjectFull } from '../features/projects/projectsApi';
import { FileUploadField, type UploadProgressReporter } from './FileUploadField';
import './ProjectSourcePicker.css';

type StoredProject = { name: string; full: ProjectFull };
type Props = {
  scope: string;
  projects: Project[];
  projectId: string;
  onProjectChange: (id: string) => void;
  onImport: (project: ProjectFull, fileName: string) => void;
  onClearImport: () => void;
  loading?: boolean;
};

const localId = (scope: string, name: string) => `local-upload:${scope}:${encodeURIComponent(name)}`;

function normalizeProject(raw: unknown, fileName: string, scope: string): ProjectFull {
  const parsed = raw as Record<string, unknown>;
  const projectRaw = parsed.project && typeof parsed.project === 'object' ? parsed.project as Record<string, unknown> : parsed;
  const sourceFeatures = Array.isArray(parsed.features)
    ? parsed.features
    : parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)
      ? parsed.features
      : parsed.type === 'Feature' ? [parsed] : parsed.geometry ? [parsed] : [];
  const features: ProjectFeature[] = sourceFeatures.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const feature = item as Record<string, unknown>;
    const geometry = feature.geoJson || feature.geometry || (feature.type && feature.coordinates ? feature : null);
    if (!geometry || typeof geometry !== 'object') return [];
    const properties = feature.properties && typeof feature.properties === 'object' ? feature.properties as Record<string, unknown> : {};
    return [{ id: String(feature.id || `import-${index + 1}`), name: String(feature.name || properties.name || `Feição ${index + 1}`), geoJson: geometry as ProjectFeature['geoJson'], properties }];
  });
  const extension = fileName.toLowerCase().split('.').pop();
  if (!features.length && extension === 'kml') {
    const xml = new DOMParser().parseFromString(String(raw), 'application/xml');
    if (xml.querySelector('parsererror')) throw new Error('O arquivo KML está inválido.');
    xml.querySelectorAll('Placemark').forEach((placemark, index) => {
      const coordinates = placemark.querySelector('Polygon coordinates, LineString coordinates, Point coordinates')?.textContent?.trim();
      if (!coordinates) return;
      const coords = coordinates.split(/\s+/).map(pair => pair.split(',').map(Number)).filter(pair => pair.length >= 2 && pair.slice(0, 2).every(Number.isFinite));
      if (!coords.length) return;
      const type = placemark.querySelector('Polygon') ? 'Polygon' : placemark.querySelector('LineString') ? 'LineString' : 'Point';
      const geometry = type === 'Polygon' ? { type, coordinates: [coords] } : type === 'Point' ? { type, coordinates: coords[0] } : { type, coordinates: coords };
      const name = placemark.querySelector('name')?.textContent?.trim() || `Feição ${index + 1}`;
      features.push({ id: `kml-${index + 1}`, name, geoJson: geometry, properties: { name } });
    });
  }
  if (!features.length) throw new Error('Não encontrei geometrias no arquivo. Envie um projeto GeoJSON ou KML válido.');
  const name = String(projectRaw.propertyName || projectRaw.title || projectRaw.name || fileName.replace(/\.[^.]+$/, ''));
  const id = localId(scope, fileName);
  const project: Project = {
    id,
    name,
    propertyName: name,
    ownerName: String(projectRaw.ownerName || projectRaw.owner || ''),
    municipality: String(projectRaw.municipality || projectRaw.city || ''),
    stateCode: String(projectRaw.stateCode || projectRaw.uf || ''),
    areaHa: Number(projectRaw.areaHa) || undefined,
    perimeterM: Number(projectRaw.perimeterM) || undefined,
    metadata: { ...(projectRaw.metadata && typeof projectRaw.metadata === 'object' ? projectRaw.metadata as Record<string, unknown> : {}), localImport: true, importedFileName: fileName }
  };
  return { project, features };
}

export function ProjectSourcePicker({ scope, projects, projectId, onProjectChange, onImport, onClearImport, loading = false }: Props) {
  const key = `surveyor-local-project-v1:${scope}`;
  const [localName, setLocalName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void readOfflineDraft<StoredProject>(key).then(saved => {
      if (!active || !saved?.full?.project || !Array.isArray(saved.full.features)) return;
      setLocalName(saved.name);
      onImport(saved.full, saved.name);
    });
    return () => { active = false; };
    // A scope has one remembered import; the callback identity is intentionally not a reload trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const handleFile = async (file: File, reportProgress: UploadProgressReporter = () => {}) => {
    setError('');
    let content: string;
    if (file.name.toLowerCase().endsWith('.kml')) {
      content = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onprogress = event => { if (event.lengthComputable) reportProgress(file, event.loaded, event.total); };
        reader.onerror = () => reject(reader.error || new Error('Não foi possível ler o arquivo.'));
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Arquivo KML ilegível.'));
        reader.readAsText(file);
      });
    } else {
      content = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onprogress = event => { if (event.lengthComputable) reportProgress(file, event.loaded, event.total); };
        reader.onerror = () => reject(reader.error || new Error('Não foi possível ler o arquivo.'));
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Arquivo JSON ilegível.'));
        reader.readAsText(file);
      });
    }
    let raw: unknown = content;
    if (!file.name.toLowerCase().endsWith('.kml')) {
      try { raw = JSON.parse(content); } catch { throw new Error('O arquivo não contém JSON válido.'); }
    }
    const full = normalizeProject(raw, file.name, scope);
    const stored = { name: file.name, full };
    if (!await writeOfflineDraft(key, stored)) throw new Error('Não foi possível salvar o projeto neste navegador. Verifique o espaço disponível.');
    setLocalName(file.name);
    onProjectChange('');
    onImport(full, file.name);
  };

  const clearImport = () => {
    setLocalName('');
    setError('');
    void removeOfflineDraft(key);
    onClearImport();
  };

  const hasCloudProject = Boolean(projectId && !projectId.startsWith('local-upload:'));
  const hasLocalProject = Boolean(localName || projectId.startsWith('local-upload:'));
  return <section className="project-source-picker" aria-label="Origem do projeto">
    {!hasLocalProject && <label className="project-source-select">Projeto salvo no mapa
      <select value={hasCloudProject ? projectId : ''} disabled={loading} onChange={event => {
        const next = event.target.value;
        if (next) { setLocalName(''); void removeOfflineDraft(key); }
        onProjectChange(next);
      }}>
        <option value="">Selecione um projeto</option>
        {projects.map(project => <option key={project.id} value={project.id}>{project.propertyName || project.title || project.name || 'Projeto sem nome'}</option>)}
      </select>
    </label>}
    {hasLocalProject ? <div className="project-source-local">
      <div><FileText size={17}/><span><strong>{localName || 'Projeto importado'}</strong><small>Salvo neste navegador</small></span></div>
      <button type="button" onClick={clearImport} aria-label="Remover projeto importado"><Trash2 size={15}/> Remover arquivo</button>
    </div> : !hasCloudProject && <>
      <div className={`project-import-dropzone${dragging ? ' is-dragging' : ''}`} onDragEnter={event => { event.preventDefault(); setDragging(true); }} onDragOver={event => event.preventDefault()} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }} onDrop={(event: DragEvent<HTMLDivElement>) => { if ((event.target as HTMLElement).closest('.file-upload-field')) return; event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) void handleFile(file).catch(reason => setError(reason instanceof Error ? reason.message : 'Falha ao importar o projeto.')); }}>
        <UploadCloud size={19}/><div><strong>Importar projeto do dispositivo</strong><small>Arraste um GeoJSON ou KML até aqui, ou escolha um arquivo.</small></div>
        <FileUploadField className="project-import-control" label="Selecionar arquivo" accept=".json,.geojson,.kml,application/json,application/geo+json,application/vnd.google-earth.kml+xml" maxBytes={50 * 1024 * 1024} onFile={handleFile} onRemove={clearImport}/>
      </div>
      {error && <p className="project-import-error" role="alert">{error}</p>}
    </>}
  </section>;
}
