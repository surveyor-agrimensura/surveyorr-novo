import {polygonSourceColors} from '../../lib/polygonSourceColors';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, Download, FileSpreadsheet, FileText, FolderKanban, Map, PanelsTopLeft, Printer, RefreshCw, Sparkles, Square } from 'lucide-react';
import { GlobalLoading } from '../../components/GlobalLoading';
import { DocumentWorkflowBar } from '../../components/layout/DocumentWorkflowBar';
import { ProjectSourcePicker } from '../../components/ProjectSourcePicker';
import { useAuth } from '../auth/AuthContext';
import { getDocumentCustomization } from '../customization/customizationApi';
import { listProjects, getProject, projectTitle, type Project, type ProjectFull } from '../projects/projectsApi';
import { projectOwners } from '../projects/projectOwners';
import { getPolygons, record, text, fmt, distance, azimuth, formatAzimuth, memorialNarrative, type SurveyPolygon } from '../memorial/memorialEngine';
import { croquiVertexNames, defaultCroquiSettings, renderCroqui } from '../memorial/croquiRenderer';
import { readSharedConfrontants, readSharedCroquiSettings, hasPendingCroquiDraft, combineCroquiConfrontants } from '../croqui/sharedCroquiSettings';
import { mergeConfrontantsIntoProperties } from '../documents/confrontantRegistry';
import { readConfrontation, groupConfrontations } from '../croqui/croquiGeometry';
import { readProjectDivisions } from '../croqui/projectDivisions';
import { defaultSheetForPolygon, normalizeSheet, renderTechnicalSheet, type SheetSettings } from '../documents/technicalSheet';
import { parseLocalSheetDraft, selectSheetDraft, sheetDraftKey } from '../documents/sheetDraftState';
import { generateOds, type OdsSheet } from '../documents/odsWriter';
import { toShapefileZip } from '../map/shapefileExport';
import { toKml } from '../map/mapFormats';
import {buildPublicMapUrl} from '../public/publicMapData';
import {qrCodeDataUrl} from '../../lib/qrCode';
import { LatestRequestSequence } from '../../lib/latestRequestSequence';
import { docxBytes, downloadBytes, makeZip } from './exportOffice';
import '../documents/documents.css';

type DocKey = 'memorialDocx' | 'memorialTxt' | 'pranchaSvg' | 'pranchaHtml' | 'croquiSvg' | 'croquiHtml' | 'confrontantesHtml' | 'ods' | 'csv' | 'geojson' | 'kml' | 'dxf' | 'shp';

const DOC_OPTIONS: { key: DocKey; label: string; summary: string; defaultChecked: boolean }[] = [
  { key: 'pranchaSvg', label: 'Prancha Técnica (SVG vetorial)', summary: 'Planta oficial na cor da gleba com grade UTM, vértices e carimbo', defaultChecked: true },
  { key: 'pranchaHtml', label: 'Prancha Técnica (HTML / Pronto para PDF)', summary: 'Folha A4/A3 pronta para impressão ou PDF individual', defaultChecked: true },
  { key: 'croquiSvg', label: 'Mapa / Croqui (SVG vetorial)', summary: 'Croqui oficial com satélite/ruas, cotas e confrontantes', defaultChecked: true },
  { key: 'croquiHtml', label: 'Mapa / Croqui (HTML / Pronto para PDF)', summary: 'Página de croqui pronta para impressão', defaultChecked: false },
  { key: 'memorialDocx', label: 'Memorial Descritivo (.docx Word)', summary: 'Documento editável no Word com narrativa técnica e coordenadas', defaultChecked: true },
  { key: 'memorialTxt', label: 'Memorial Descritivo (.txt)', summary: 'Texto puro com descrição perimetral e tabela de vértices', defaultChecked: false },
  { key: 'confrontantesHtml', label: 'Cartas de Confrontação (HTML / PDF)', summary: 'Declarações de anuência preenchidas para cada confrontante da gleba', defaultChecked: true },
  { key: 'ods', label: 'Planilha Técnica (.ods)', summary: 'Planilha OpenDocument com abas Projeto, Vértices e Confrontantes', defaultChecked: true },
  { key: 'csv', label: 'Coordenadas, Azimutes e Distâncias (.csv)', summary: 'Tabela completa de vértices e trechos compatível com Excel', defaultChecked: true },
  { key: 'geojson', label: 'Geometria Individual (.geojson)', summary: 'Feição geográfica isolada com metadados e cores preservadas', defaultChecked: true },
  { key: 'kml', label: 'Geometria Google Earth (.kml)', summary: 'Arquivo KML individual para navegação em campo / celular / Google Earth', defaultChecked: true },
  { key: 'dxf', label: 'Desenho CAD (.dxf)', summary: 'Polilinha fechada em graus e projeção métrica local para AutoCAD/Civil 3D', defaultChecked: true },
  { key: 'shp', label: 'Shapefile SIG (.zip com .shp/.dbf/.shx/.prj)', summary: 'Pacote Shapefile completo da gleba para QGIS, ArcGIS, CAR e SEIA', defaultChecked: false }
];

function safeSlug(input: string, fallback = 'gleba') {
  return String(input || fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || fallback;
}

function polygonToDxf(poly: SurveyPolygon, vertexNames: string[]): string {
  const lon0 = poly.vertices.reduce((s, v) => s + v[0], 0) / Math.max(1, poly.vertices.length);
  const lat0 = poly.vertices.reduce((s, v) => s + v[1], 0) / Math.max(1, poly.vertices.length);
  const rad = Math.PI / 180;
  const cos = Math.cos(lat0 * rad) || 1;
  const R = 6371008.8;
  const xy = poly.vertices.map(([lon, lat]) => [
    ((lon - lon0) * rad) * R * cos,
    ((lat - lat0) * rad) * R
  ] as [number, number]);
  const layer = safeSlug(poly.name, 'PERIMETRO').toUpperCase();
  const lines = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1015', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES'];
  lines.push('0', 'LWPOLYLINE', '8', layer, '90', String(xy.length), '70', '1');
  for (const [x, y] of xy) {
    lines.push('10', x.toFixed(4), '20', y.toFixed(4));
  }
  xy.forEach(([x, y], i) => {
    lines.push('0', 'TEXT', '8', `${layer}_VERTICES`, '10', (x + 1.5).toFixed(4), '20', (y + 1.5).toFixed(4), '40', '2.5', '1', vertexNames[i] || `V-${i + 1}`);
  });
  lines.push('0', 'ENDSEC', '0', 'EOF');
  return lines.join('\r\n');
}

export function LotCenterPage() {
  const { session } = useAuth();
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [full, setFull] = useState<ProjectFull | null>(null);
  const [prefs, setPrefs] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<Record<DocKey, boolean>>(() =>
    Object.fromEntries(DOC_OPTIONS.map(d => [d.key, d.defaultChecked])) as Record<DocKey, boolean>
  );
  const [currentStep, setCurrentStep] = useState(0);
  const [framingMode, setFramingMode] = useState<'single' | 'context'>('single');
  const [message, setMessage] = useState('');
  const [results, setResults] = useState<{ lotName: string; filesCount: number; areaHa: string; color: string }[]>([]);
  const projectLoads = useRef(new LatestRequestSequence());
  const projectPanelRef = useRef<HTMLDivElement>(null);
  const documentsRef = useRef<HTMLElement>(null);
  const zipActionRef = useRef<HTMLButtonElement>(null);

  const userId = String(session?.user?.id || session?.user?.email || 'local');

  useEffect(() => {
    if (!session) return;
    let active = true;
    setLoadingProjects(true);
    Promise.allSettled([listProjects(session), getDocumentCustomization(session)])
      .then(([pr, cu]) => {
        if (!active) return;
        if (pr.status === 'fulfilled') setProjects(pr.value);
        else setMessage('Não foi possível listar seus projetos salvos.');
        if (cu.status === 'fulfilled') setPrefs(record(cu.value.customization));
      })
      .finally(() => {
        if (active) setLoadingProjects(false);
      });
    return () => { active = false; };
  }, [session]);

  const polygons = useMemo(() => getPolygons(full?.features || []), [full]);
  const allDivisions = useMemo(() => readProjectDivisions(full?.features || []), [full]);

  const openProject = useCallback(async (id: string) => {
    const request = projectLoads.current.begin();
    setProjectId(id);
    setFull(null);
    setResults([]);
    setMessage('');
    if (!id || !session) {
      setSelectedIds([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [data, cu] = await Promise.all([getProject(session, id), getDocumentCustomization(session).catch(() => null)]);
      if (!projectLoads.current.isCurrent(request)) return;
      if (cu) setPrefs(record(cu.customization));
      setFull(data);
      const polys = getPolygons(data.features);
      setSelectedIds(polys.map(p => p.id));
      setMessage(`${polys.length} área(s) / gleba(s) pronta(s) para geração individual em lote.`);
    } catch (e) {
      if (projectLoads.current.isCurrent(request)) setMessage(e instanceof Error ? e.message : 'Falha ao carregar o projeto.');
    } finally {
      if (projectLoads.current.isCurrent(request)) setLoading(false);
    }
  }, [session]);

  const loadLocalProject = useCallback((data: ProjectFull, fileName: string) => {
    projectLoads.current.begin();
    const id = data.project?.id || '';
    const localPolygons = getPolygons(data.features);
    setProjectId(id);
    setFull(data);
    setResults([]);
    setSelectedIds(localPolygons.map(polygon => polygon.id));
    setLoading(false);
    setMessage(`${fileName} importado e salvo neste navegador.`);
  }, []);

  const togglePolygon = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAllPolygons = () => {
    if (selectedIds.length === polygons.length) setSelectedIds([]);
    else setSelectedIds(polygons.map(p => p.id));
  };

  const toggleDoc = (key: DocKey) => {
    setSelectedDocs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const chosenPolygons = useMemo(() => polygons.filter(p => selectedIds.includes(p.id)), [polygons, selectedIds]);
  const activeDocKeys = useMemo(() => DOC_OPTIONS.filter(d => selectedDocs[d.key]).map(d => d.key), [selectedDocs]);
  const projectReady = Boolean(projectId && full);

  const goToWorkflowStep = (step: number) => {
    const nextStep = Math.max(0, Math.min(2, step));
    if (nextStep > 0 && !projectReady) return;
    if (nextStep > 1 && !chosenPolygons.length) return;
    setCurrentStep(nextStep);
    requestAnimationFrame(() => {
      if (nextStep === 2) {
        documentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        documentsRef.current?.focus({ preventScroll: true });
      } else {
        projectPanelRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        projectPanelRef.current?.focus({ preventScroll: true });
      }
    });
  };

  const buildPolygonPackage = (poly: SurveyPolygon, index: number) => {
    if (!full) throw new Error('Projeto não carregado.');
    const options = record(prefs.options);
    const technician = text(prefs.responsibleTechnician);
    const company = text(prefs.companyName) || 'Surveyor Agrimensura';
    const logo = text(prefs.logoDataUrl);
    const basePropertyName = projectTitle(full.project || { id: projectId });
    const gName = poly.name?.trim() || `Gleba ${String(index + 1).padStart(2, '0')}`;
    const fullDocTitle = polygons.length > 1 && gName.toLowerCase() !== basePropertyName.toLowerCase()
      ? `${basePropertyName} — ${gName}`
      : basePropertyName;
    const municipality = [text(full.project?.municipality || full.project?.city), text(full.project?.stateCode || full.project?.uf)].filter(Boolean).join(' / ');
    const ownersList = projectOwners(full.project).map(o => o.name);
    const ownerPrimary = ownersList[0] || text(full.project?.ownerName || full.project?.owner) || 'Não informado';
    const dateStr = new Date().toLocaleDateString('pt-BR');

    // Sincronização com Mapas e Croquis
    const loadedCroqui = readSharedCroquiSettings(options, projectId, poly.id, userId, technician, polygons.length === 1);
    const baseCroqui = loadedCroqui || defaultCroquiSettings(technician);
    const pProps = record(poly.properties);
    const {fill:mapFill,stroke:mapStroke} = polygonSourceColors(pProps);
    if (!loadedCroqui) {
      if (mapFill) baseCroqui.polygonFill = mapFill;
      if (mapStroke) baseCroqui.polygonStroke = mapStroke;
    }
    const commonConfrontants = readSharedConfrontants(options, projectId, poly.id);
    const pendingCroqui = hasPendingCroquiDraft(userId, projectId, poly.id);
    const croquiSettings = combineCroquiConfrontants(poly, baseCroqui, commonConfrontants, pendingCroqui);
    const vNames = croquiVertexNames(poly, croquiSettings);

    // Sincronização com Prancha Técnica
    const rawSheets = record(record(options.technicalSheets)[projectId]);
    const cloudSheetRaw = rawSheets[poly.id] ?? (polygons.length === 1 ? rawSheets.default : undefined);
    const baseSheet = cloudSheetRaw ? normalizeSheet(cloudSheetRaw) : defaultSheetForPolygon(poly, technician);
    if (!baseSheet.technician.trim() && technician) baseSheet.technician = technician;
    const localDraft = (() => {
      try { return parseLocalSheetDraft(localStorage.getItem(sheetDraftKey(userId, projectId, poly.id))); }
      catch { return null; }
    })();
    const sheetSettings: SheetSettings = selectSheetDraft(baseSheet, localDraft).settings;

    const publicUrl = (() => {
      const rings=[poly.vertices,...(poly.holes||[])].map(ring=>ring.map(v=>[Number(v[0].toFixed(7)),Number(v[1].toFixed(7))] as [number,number]));
      return buildPublicMapUrl(window.location.origin,fullDocTitle,[rings]);
    })();
    const qr = qrCodeDataUrl(publicUrl,2);

    const divisionsForPoly = framingMode === 'context'
      ? allDivisions
      : allDivisions.filter(d => d.featureId === String(poly.properties.sourceFeatureId || poly.id) && d.partIndex === Number(poly.properties.partIndex || 0));

    const pranchaSvg = renderTechnicalSheet(poly, sheetSettings, {
      municipality: municipality || 'Não informado',
      owner: ownerPrimary,
      owners: ownersList,
      company,
      date: dateStr,
      publicUrl,
      logo,
      croqui: croquiSettings,
      projectTitle: fullDocTitle,
      divisions: divisionsForPoly,
      composite: false
    });

    const croquiSvg = renderCroqui(poly, croquiSettings, {
      company,
      mapLink: publicUrl,
      municipality,
      qr,
      logo,
      owners: ownersList,
      propertyName: fullDocTitle,
      glebas: [],
      divisions: divisionsForPoly,
      markers: []
    });

    return {
      poly,
      gName,
      fullDocTitle,
      municipality,
      ownersList,
      ownerPrimary,
      company,
      technician,
      dateStr,
      vNames,
      croquiSettings,
      sheetSettings,
      pranchaSvg,
      croquiSvg,
      color: sheetSettings.polygonFill || mapFill || '#0f766e'
    };
  };

  const generateAllZip = async () => {
    if (!full || !chosenPolygons.length || !activeDocKeys.length) return;
    setGenerating(true);
    setMessage('Gerando dossiê completo lote por lote...');
    try {
      const zipEntries: { name: string; content: string | Uint8Array }[] = [];
      const summaryRows: (string | number | null)[][] = [
        ['ORDEM', 'GLEBA / LOTE', 'ÁREA (HA)', 'ÁREA (M²)', 'PERÍMETRO (M)', 'VÉRTICES', 'COR NO MAPA']
      ];
      const batchSummary: { lotName: string; filesCount: number; areaHa: string; color: string }[] = [];

      for (let i = 0; i < chosenPolygons.length; i++) {
        const poly = chosenPolygons[i];
        const pkg = buildPolygonPackage(poly, i);
        const folder = `${String(i + 1).padStart(2, '0')}-${safeSlug(pkg.gName)}`;
        const slug = safeSlug(pkg.gName);
        let lotFiles = 0;

        summaryRows.push([
          i + 1,
          pkg.gName,
          Number((poly.areaM2 / 10000).toFixed(4)),
          Number(poly.areaM2.toFixed(2)),
          Number(poly.perimeterM.toFixed(2)),
          poly.vertices.length,
          pkg.color
        ]);

        if (selectedDocs.pranchaSvg) {
          zipEntries.push({ name: `${folder}/01_Prancha_Tecnica_${slug}.svg`, content: pkg.pranchaSvg });
          lotFiles++;
        }
        if (selectedDocs.pranchaHtml) {
          const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Prancha Técnica — ${pkg.fullDocTitle}</title><style>@page{size:${pkg.sheetSettings.paper} landscape;margin:0}html,body{margin:0;padding:0;background:#fff}svg{width:100%;height:auto;display:block}@media print{*{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>${pkg.pranchaSvg}</body></html>`;
          zipEntries.push({ name: `${folder}/01_Prancha_Tecnica_${slug}.html`, content: html });
          lotFiles++;
        }
        if (selectedDocs.croquiSvg) {
          zipEntries.push({ name: `${folder}/02_Croqui_Planta_${slug}.svg`, content: pkg.croquiSvg });
          lotFiles++;
        }
        if (selectedDocs.croquiHtml) {
          const page = pkg.croquiSettings.paper === 'A3' ? 'A3 landscape' : 'A4 portrait';
          const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Croqui — ${pkg.fullDocTitle}</title><style>@page{size:${page};margin:0}html,body{margin:0;padding:0;background:#fff}svg{width:100%;height:auto;display:block}@media print{*{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>${pkg.croquiSvg}</body></html>`;
          zipEntries.push({ name: `${folder}/02_Croqui_Planta_${slug}.html`, content: html });
          lotFiles++;
        }

        const mergedProps = mergeConfrontantsIntoProperties(
          poly.properties,
          poly.vertices.length,
           { neighbors: pkg.croquiSettings.neighbors, details: pkg.croquiSettings.neighborDetails }
        );
        const polyWithNeighbors: SurveyPolygon = { ...poly, properties: mergedProps };
        const narrative = memorialNarrative(polyWithNeighbors, pkg.vNames);

        if (selectedDocs.memorialDocx || selectedDocs.memorialTxt) {
          const lines = [
            'MEMORIAL DESCRITIVO',
            `Imóvel: ${pkg.fullDocTitle}`,
            `Município / UF: ${pkg.municipality || 'Não informado'}`,
            `Proprietário(s): ${pkg.ownersList.join(', ') || pkg.ownerPrimary}`,
            `Área cartográfica aproximada: ${fmt(poly.areaM2 / 10000, 4)} ha (${fmt(poly.areaM2, 2)} m²)`,
            `Perímetro aproximado: ${fmt(poly.perimeterM, 2)} m`,
            `Responsável Técnico: ${pkg.technician || 'Não informado'}`,
            `Data de emissão: ${pkg.dateStr}`,
            '',
            'DESCRIÇÃO DO PERÍMETRO',
            narrative,
            '',
            'QUADRO DE VÉRTICES E TRECHOS (WGS 84 / SIRGAS 2000)',
            ...poly.vertices.map((v, idx) => {
              const next = poly.vertices[(idx + 1) % poly.vertices.length];
              const neigh = pkg.croquiSettings.neighbors[idx] || readConfrontation(mergedProps, idx, poly.vertices.length) || 'Confrontante não informado';
              return `${pkg.vNames[idx]} -> ${pkg.vNames[(idx + 1) % poly.vertices.length]}: Lat ${v[1].toFixed(7)}°, Lon ${v[0].toFixed(7)}° | Azimute ${formatAzimuth(azimuth(v, next))} | Distância ${fmt(distance(v, next), 2)} m | Confrontante: ${neigh}`;
            })
          ];
          if (selectedDocs.memorialDocx) {
            zipEntries.push({ name: `${folder}/03_Memorial_Descritivo_${slug}.docx`, content: docxBytes(lines) });
            lotFiles++;
          }
          if (selectedDocs.memorialTxt) {
            zipEntries.push({ name: `${folder}/03_Memorial_Descritivo_${slug}.txt`, content: lines.join('\r\n') });
            lotFiles++;
          }
        }

        if (selectedDocs.confrontantesHtml) {
          const groups = groupConfrontations(Array.from({ length: poly.vertices.length }, (_, k) => pkg.croquiSettings.neighbors[k] || readConfrontation(mergedProps, k, poly.vertices.length)));
          const letters = groups.map(group => {
            const start = group.start;
            const end = (group.indices.at(-1)! + 1) % poly.vertices.length;
            const detail = record(record(mergedProps.confrontantDetails)[String(start)]);
            const confName = text(detail.owner) || group.label || '________________________________';
            const confCpf = text(detail.cpf);
            const confProp = text(detail.property) || group.label || 'Imóvel confrontante';
            const limitType = text(detail.limitType) || 'divisa consolidada';
            return `<section class="letter-page" style="page-break-after:always;box-sizing:border-box;width:210mm;min-height:280mm;padding:15mm;margin:auto;font-family:Arial,sans-serif;color:#182332">
              <h2 style="text-align:center;border-bottom:2px solid #1e293b;padding-bottom:8px">CARTA DE ANUÊNCIA E CONFRONTAÇÃO</h2>
              <p style="text-align:justify;line-height:1.6;margin-top:24px">Eu, <strong>${confName}</strong>${confCpf ? `, CPF/CNPJ nº <strong>${confCpf}</strong>` : ''}, responsável pelo imóvel confrontante <strong>${confProp}</strong>, declaro para os devidos fins que reconheço e concordo com os limites divisórios do imóvel <strong>${pkg.fullDocTitle}</strong>, de propriedade de <strong>${pkg.ownerPrimary}</strong>, situado em <strong>${pkg.municipality || '________________'}</strong>.</p>
              <p style="text-align:justify;line-height:1.6">O trecho confrontado inicia-se no vértice <strong>${pkg.vNames[start]}</strong> e segue até o vértice <strong>${pkg.vNames[end]}</strong>, caracterizado por <strong>${limitType}</strong>.</p>
              <p style="margin-top:36px">${pkg.municipality || 'Local'}, ${pkg.dateStr}.</p>
              <div style="margin:64px auto 16px;width:320px;border-top:1px solid #1e293b;text-align:center;padding-top:6px"><strong>${confName}</strong><br/><small>Confrontante (${pkg.vNames[start]} a ${pkg.vNames[end]})</small></div>
              <footer style="margin-top:48px;border-top:1px solid #cbd5e1;padding-top:8px;font-size:12px;color:#475569">Responsável Técnico: ${pkg.technician || pkg.company}</footer>
            </section>`;
          }).join('');
          const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Cartas de Confrontação — ${pkg.fullDocTitle}</title></head><body style="margin:0;background:#fff">${letters}</body></html>`;
          zipEntries.push({ name: `${folder}/04_Cartas_Confrontacao_${slug}.html`, content: html });
          lotFiles++;
        }

        if (selectedDocs.ods) {
          const sheetProj: OdsSheet = {
            name: 'Imovel',
            rows: [
              ['CAMPO', 'VALOR'],
              ['Imóvel / Gleba', pkg.fullDocTitle],
              ['Proprietário', pkg.ownerPrimary],
              ['Município / UF', pkg.municipality],
              ['Área (ha)', Number((poly.areaM2 / 10000).toFixed(4))],
              ['Área (m²)', Number(poly.areaM2.toFixed(2))],
              ['Perímetro (m)', Number(poly.perimeterM.toFixed(2))],
              ['Vértices', poly.vertices.length]
            ]
          };
          const sheetVerts: OdsSheet = {
            name: 'Vertices',
            rows: [
              ['VÉRTICE', 'VÉRTICE SEGUINTE', 'LATITUDE (DD)', 'LONGITUDE (DD)', 'DISTÂNCIA (M)', 'AZIMUTE (°)', 'CONFRONTANTE'],
              ...poly.vertices.map((v, k) => {
                const next = poly.vertices[(k + 1) % poly.vertices.length];
                const neigh = pkg.croquiSettings.neighbors[k] || readConfrontation(mergedProps, k, poly.vertices.length);
                return [pkg.vNames[k], pkg.vNames[(k + 1) % poly.vertices.length], v[1], v[0], Number(distance(v, next).toFixed(2)), Number(azimuth(v, next).toFixed(5)), neigh];
              })
            ]
          };
          const odsBlob = generateOds([sheetProj, sheetVerts]);
          const odsBytes = new Uint8Array(await odsBlob.arrayBuffer());
          zipEntries.push({ name: `${folder}/05_Planilha_Tecnica_${slug}.ods`, content: odsBytes });
          lotFiles++;
        }

        if (selectedDocs.csv) {
          const quote = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;
          const csvLines = [
            ['Vertice_De', 'Vertice_Para', 'Latitude_WGS84', 'Longitude_WGS84', 'Azimute_Graus', 'Azimute_GMS', 'Distancia_m', 'Confrontante'].map(quote).join(';'),
            ...poly.vertices.map((v, k) => {
              const next = poly.vertices[(k + 1) % poly.vertices.length];
              const az = azimuth(v, next);
              const dist = distance(v, next);
              const neigh = pkg.croquiSettings.neighbors[k] || readConfrontation(mergedProps, k, poly.vertices.length);
              return [
                pkg.vNames[k],
                pkg.vNames[(k + 1) % poly.vertices.length],
                v[1].toFixed(7),
                v[0].toFixed(7),
                az.toFixed(5),
                formatAzimuth(az),
                dist.toFixed(2),
                neigh
              ].map(quote).join(';');
            })
          ];
          zipEntries.push({ name: `${folder}/06_Coordenadas_Azimutes_${slug}.csv`, content: '\ufeff' + csvLines.join('\r\n') });
          lotFiles++;
        }

        const closedRing = [...poly.vertices, poly.vertices[0]];
        const geoFeature = {
          type: 'Feature' as const,
          id: poly.id,
          properties: {
            ...poly.properties,
            name: pkg.gName,
            propertyName: pkg.fullDocTitle,
            fillColor: pkg.color,
            strokeColor: pkg.color,
            areaHa: Number((poly.areaM2 / 10000).toFixed(4)),
            perimeterM: Number(poly.perimeterM.toFixed(2))
          },
          geometry: {
            type: 'Polygon' as const,
            coordinates: [closedRing]
          }
        };

        if (selectedDocs.geojson) {
          zipEntries.push({
            name: `${folder}/07_Geometria_${slug}.geojson`,
            content: JSON.stringify({ type: 'FeatureCollection', features: [geoFeature] }, null, 2)
          });
          lotFiles++;
        }

        if (selectedDocs.kml) {
          zipEntries.push({
            name: `${folder}/08_Google_Earth_${slug}.kml`,
            content: toKml([geoFeature])
          });
          lotFiles++;
        }

        if (selectedDocs.dxf) {
          zipEntries.push({
            name: `${folder}/09_CAD_${slug}.dxf`,
            content: polygonToDxf(poly, pkg.vNames)
          });
          lotFiles++;
        }

        if (selectedDocs.shp) {
          const shpZip = toShapefileZip([geoFeature], 'qgis-arcgis');
          zipEntries.push({
            name: `${folder}/10_Shapefile_${slug}.zip`,
            content: shpZip
          });
          lotFiles++;
        }

        batchSummary.push({
          lotName: pkg.gName,
          filesCount: lotFiles,
          areaHa: `${fmt(poly.areaM2 / 10000, 4)} ha`,
          color: pkg.color
        });
      }

      // Quadro geral do projeto na raiz do ZIP
      const summaryOds = generateOds([{ name: 'Resumo_Geral_Glebas', rows: summaryRows }]);
      zipEntries.push({
        name: '00_QUADRO_GERAL_DE_AREAS.ods',
        content: new Uint8Array(await summaryOds.arrayBuffer())
      });

      const allGeoFeatures = chosenPolygons.map((poly, idx) => ({
        type: 'Feature' as const,
        id: poly.id,
        properties: { ...poly.properties, name: poly.name || `Gleba ${idx + 1}` },
        geometry: { type: 'Polygon' as const, coordinates: [[...poly.vertices, poly.vertices[0]]] }
      }));
      zipEntries.push({
        name: '00_TODAS_AS_GLEBAS_UNIFICADAS.geojson',
        content: JSON.stringify({ type: 'FeatureCollection', features: allGeoFeatures }, null, 2)
      });
      zipEntries.push({
        name: '00_TODAS_AS_GLEBAS_GOOGLE_EARTH.kml',
        content: toKml(allGeoFeatures)
      });

      const projSlug = safeSlug(projectTitle(full.project || { id: projectId }), 'projeto');
      downloadBytes(makeZip(zipEntries), `SURVEYOR_CENTRAL_DE_LOTES_${projSlug}.zip`, 'application/zip');
      setResults(batchSummary);
      setMessage(`Pacote ZIP gerado com sucesso! ${batchSummary.length} área(s) processada(s) 1 por 1.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Erro ao gerar pacote da Central de Lotes.');
    } finally {
      setGenerating(false);
    }
  };

  const printAllCombined = (kind: 'pranchas' | 'croquis') => {
    if (!full || !chosenPolygons.length) return;
    const pkgs = chosenPolygons.map((poly, idx) => buildPolygonPackage(poly, idx));
    const pages = pkgs.map((pkg, idx) => {
      const svg = kind === 'pranchas' ? pkg.pranchaSvg : pkg.croquiSvg;
      return `<section class="batch-print-page"${idx < pkgs.length - 1 ? ' style="page-break-after:always;break-after:page"' : ''}>${svg}</section>`;
    }).join('');
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${kind === 'pranchas' ? 'Pranchas Técnicas' : 'Mapas e Croquis'} (1 por 1)</title><style>@page{size:A4 landscape;margin:0}html,body{margin:0;padding:0;background:#fff}.batch-print-page{display:grid;place-items:center;min-height:100vh}svg{width:100%;max-width:297mm;max-height:210mm;height:auto;display:block}@media print{*{print-color-adjust:exact;-webkit-print-color-adjust:exact}.batch-print-page{min-height:auto}}</style></head><body>${pages}</body></html>`;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    document.body.append(iframe);
    const d = iframe.contentDocument;
    if (!d) { iframe.remove(); return; }
    d.open();
    d.write(html);
    d.close();
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      window.setTimeout(() => iframe.remove(), 12000);
    };
  };

  return (
    <main className="workspace-main doc-root lot-center-page">
      <GlobalLoading active={loading || loadingProjects || generating} />
      <DocumentWorkflowBar
        label="Central de lotes"
        variant="croqui"
        steps={['Projeto', 'Glebas', 'Personalização']}
        currentStep={currentStep}
        startActions={(
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="doc-workflow-action"
              title="Imprimir / PDF todas as pranchas, uma por gleba"
              aria-label="Imprimir ou gerar PDF de todas as pranchas, uma por gleba"
              disabled={!chosenPolygons.length || currentStep < 2}
              onClick={() => printAllCombined('pranchas')}
            >
              <Printer size={15} /> PDF Pranchas
            </button>
            <button
              type="button"
              className="doc-workflow-action"
              title="Imprimir / PDF todos os croquis, um por gleba"
              aria-label="Imprimir ou gerar PDF de todos os croquis, um por gleba"
              disabled={!chosenPolygons.length || currentStep < 2}
              onClick={() => printAllCombined('croquis')}
            >
              <Printer size={15} /> PDF Croquis
            </button>
            <button ref={zipActionRef} type="button" className="doc-workflow-action doc-primary" disabled={!chosenPolygons.length || !activeDocKeys.length || generating || currentStep < 2} onClick={() => void generateAllZip()}>
              <Download size={15} /> {generating ? 'Gerando ZIP…' : 'Gerar pacote ZIP'}
            </button>
          </div>
        )}
      />
      <div className="workspace-container doc-container">
        {message && (
          <div className="doc-alert" role="status">
            <span>{message}</span>
            <button type="button" onClick={() => setMessage('')}>×</button>
          </div>
        )}

        <div className="doc-layout" style={{ gridTemplateColumns: 'minmax(280px, 320px) minmax(0, 1fr)', gap: 12 }}>
          <aside className="doc-sidebar" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div ref={projectPanelRef} tabIndex={-1} className="doc-panel" style={{ display: 'grid', gap: 14, flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
              {currentStep === 0 && <>
                <strong>1. Projeto</strong>
                <ProjectSourcePicker
                  scope="lot-center"
                  projects={projects}
                  projectId={projectId}
                  loading={loading || loadingProjects}
                  onProjectChange={id => void openProject(id)}
                  onImport={loadLocalProject}
                  onClearImport={() => void openProject('')}
                />
                {full ? (
                  <div className="doc-status-card">
                    <strong>{projectTitle(full.project || { id: projectId })}</strong>
                    <span>{polygons.length} gleba(s) encontrada(s). Avance para escolher quais serão geradas.</span>
                  </div>
                ) : (
                  <p className="doc-hint">Selecione um projeto salvo ou arraste um arquivo GeoJSON/KML para começar.</p>
                )}
              </>}

              {currentStep === 1 && <>
                <strong>2. Glebas e perímetros</strong>
                {full && <>
                  <label>
                    Enquadramento nas Pranchas e Croquis
                    <select value={framingMode} onChange={e => setFramingMode(e.target.value as 'single' | 'context')}>
                      <option value="single">Isolado (1 por 1 puro — apenas a gleba da folha)</option>
                      <option value="context">Contextual (destaca a gleba e mostra as vizinhas)</option>
                    </select>
                  </label>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                      Áreas encontradas ({selectedIds.length}/{polygons.length})
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" className="doc-mini-btn" onClick={toggleAllPolygons} disabled={!polygons.length} style={{ fontSize: 11, padding: '4px 8px' }}>
                        {selectedIds.length === polygons.length ? 'Desmarcar todas' : 'Marcar todas'}
                      </button>
                      {!projectId.startsWith('local-upload:') && <button type="button" className="doc-mini-btn" onClick={() => void openProject(projectId)} title="Recarregar projeto" style={{ fontSize: 11, padding: '4px 8px' }}>
                        <RefreshCw size={12} />
                      </button>}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: 6, maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
                    {polygons.map((poly, idx) => {
                      const checked = selectedIds.includes(poly.id);
                      const pProps = record(poly.properties);
                      const color = polygonSourceColors(pProps).fill || '#0f766e';
                      return (
                        <label
                          key={poly.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 10px',
                            borderRadius: 8,
                            border: checked ? '1px solid #0284c7' : '1px solid #e2e8f0',
                            background: checked ? 'rgba(14,165,233,0.06)' : '#f8fafc',
                            cursor: 'pointer'
                          }}
                        >
                          <input type="checkbox" checked={checked} onChange={() => togglePolygon(poly.id)} />
                          <span style={{ width: 14, height: 14, borderRadius: 4, background: color, border: '1px solid rgba(0,0,0,0.2)', flexShrink: 0 }} />
                          <div style={{ display: 'grid', flex: 1, minWidth: 0 }}>
                            <strong style={{ fontSize: 13, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {idx + 1}. {poly.name}
                            </strong>
                            <small style={{ fontSize: 11, color: '#64748b' }}>
                              {fmt(poly.areaM2 / 10000, 4)} ha · {fmt(poly.perimeterM, 1)} m · {poly.vertices.length} vértices
                            </small>
                          </div>
                        </label>
                      );
                    })}
                    {!polygons.length && (
                      <p style={{ fontSize: 12, color: '#64748b' }}>
                        Nenhum polígono encontrado neste projeto. <Link to="/mapa/trabalho/">Abra o mapa</Link> para desenhar ou dividir glebas.
                      </p>
                    )}
                  </div>
                </>}
              </>}

              {currentStep === 2 && <>
                <strong>3. Personalização dos documentos</strong>
                <div className="doc-status-card">
                  <strong>{projectTitle(full?.project || { id: projectId })}</strong>
                  <span>{chosenPolygons.length} gleba(s) selecionada(s) · {activeDocKeys.length} tipo(s) de documento marcado(s).</span>
                </div>
                <p className="doc-hint">Escolha as peças técnicas no painel ao lado. Depois, gere o pacote ZIP por aqui.</p>
              </>}
            </div>

            <div className="doc-toolbar" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: '10px 12px', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ display: 'grid', gap: 2 }}>
                <span className="doc-hint">Etapa {currentStep + 1} de 3</span>
                {currentStep === 2 && <span className="doc-hint">{chosenPolygons.length} gleba(s) · {activeDocKeys.length} documento(s)</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {currentStep > 0 && <button type="button" className="doc-outline" onClick={() => goToWorkflowStep(currentStep - 1)}>Anterior</button>}
                {currentStep < 2 ? (
                  <button
                    type="button"
                    className="doc-primary"
                    disabled={currentStep === 0 ? !projectReady : !chosenPolygons.length}
                    onClick={() => goToWorkflowStep(currentStep + 1)}
                  >
                    Próximo →
                  </button>
                ) : (
                  <button
                    type="button"
                    className="doc-primary"
                    disabled={!chosenPolygons.length || !activeDocKeys.length || generating}
                    onClick={() => void generateAllZip()}
                  >
                    <Download size={15} /> {generating ? 'Gerando…' : 'Gerar ZIP'}
                  </button>
                )}
              </div>
            </div>
          </aside>

          <div className="doc-main" style={{ minWidth: 0, padding: 12, overflowY: 'auto' }}>
            {currentStep === 2 ? <>
            <section ref={documentsRef} tabIndex={-1} style={{ minWidth: 0, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 16, display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 17, color: '#0f172a' }}>3. Personalização dos documentos</h2>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                    Cada gleba selecionada terá sua própria pasta numerada dentro do ZIP com todas as peças marcadas abaixo, respeitando as cores, vértices e confrontantes.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="doc-mini-btn"
                    onClick={() => setSelectedDocs(Object.fromEntries(DOC_OPTIONS.map(d => [d.key, true])) as Record<DocKey, boolean>)}
                  >
                    <CheckSquare size={14} /> Marcar tudo
                  </button>
                  <button
                    type="button"
                    className="doc-mini-btn"
                    onClick={() => setSelectedDocs(Object.fromEntries(DOC_OPTIONS.map(d => [d.key, false])) as Record<DocKey, boolean>)}
                  >
                    <Square size={14} /> Limpar
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 10 }}>
                {DOC_OPTIONS.map(doc => {
                  const active = selectedDocs[doc.key];
                  return (
                    <label
                      key={doc.key}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: active ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                        background: active ? 'rgba(14,165,233,0.05)' : '#fff',
                        cursor: 'pointer'
                      }}
                    >
                      <input type="checkbox" checked={active} onChange={() => toggleDoc(doc.key)} style={{ marginTop: 3 }} />
                      <div style={{ display: 'grid', gap: 2 }}>
                        <strong style={{ fontSize: 13, color: '#0f172a' }}>{doc.label}</strong>
                        <small style={{ fontSize: 11.5, color: '#64748b', lineHeight: 1.35 }}>{doc.summary}</small>
                      </div>
                    </label>
                  );
                })}
              </div>

            </section>

            {results.length > 0 && (
              <section style={{ marginTop: 18, background: '#fff', borderRadius: 12, border: '1px solid #cbd5e1', padding: 18 }}>
                <h3 style={{ margin: '0 0 10px', fontSize: 15, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={16} color="#0284c7" /> Resumo das pastas geradas no ZIP
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                  {results.map((r, idx) => (
                    <div key={idx} style={{ padding: 10, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 16, height: 16, borderRadius: 4, background: r.color, flexShrink: 0 }} />
                      <div>
                        <strong style={{ display: 'block', fontSize: 13, color: '#0f172a' }}>{idx + 1}. {r.lotName}</strong>
                        <small style={{ fontSize: 11.5, color: '#475569' }}>{r.areaHa} · {r.filesCount} arquivo(s)</small>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              <Link to="/pranchas/" style={{ textDecoration: 'none', padding: 14, borderRadius: 10, background: '#fff', border: '1px solid #e2e8f0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 }}>
                <PanelsTopLeft size={18} color="#0284c7" />
                <div><strong style={{ display: 'block', fontSize: 13 }}>Abrir Pranchas Técnicas</strong><small style={{ color: '#64748b', fontSize: 11 }}>Ajustar rótulos ou cores</small></div>
              </Link>
              <Link to="/mapas/" style={{ textDecoration: 'none', padding: 14, borderRadius: 10, background: '#fff', border: '1px solid #e2e8f0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Map size={18} color="#0284c7" />
                <div><strong style={{ display: 'block', fontSize: 13 }}>Abrir Mapas e Croquis</strong><small style={{ color: '#64748b', fontSize: 11 }}>Satélite, linhas e servidões</small></div>
              </Link>
              <Link to="/memorial/" style={{ textDecoration: 'none', padding: 14, borderRadius: 10, background: '#fff', border: '1px solid #e2e8f0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 }}>
                <FileText size={18} color="#0284c7" />
                <div><strong style={{ display: 'block', fontSize: 13 }}>Abrir Memorial Descritivo</strong><small style={{ color: '#64748b', fontSize: 11 }}>Narrativa e proprietários</small></div>
              </Link>
              <Link to="/ods/" style={{ textDecoration: 'none', padding: 14, borderRadius: 10, background: '#fff', border: '1px solid #e2e8f0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 }}>
                <FileSpreadsheet size={18} color="#0284c7" />
                <div><strong style={{ display: 'block', fontSize: 13 }}>Abrir Planilha ODS / SIGEF</strong><small style={{ color: '#64748b', fontSize: 11 }}>Auditoria de vértices</small></div>
              </Link>
              <Link to="/mapa/trabalho/" style={{ textDecoration: 'none', padding: 14, borderRadius: 10, background: '#fff', border: '1px solid #e2e8f0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 }}>
                <FolderKanban size={18} color="#0284c7" />
                <div><strong style={{ display: 'block', fontSize: 13 }}>Editor de Mapa</strong><small style={{ color: '#64748b', fontSize: 11 }}>Desenho e camadas GIS</small></div>
              </Link>
            </section>
            </> : (
              <section className="doc-empty" style={{ flex: 1, minHeight: 220, padding: 24, borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff' }}>
                <div>
                  <strong style={{ display: 'block', marginBottom: 8, color: '#173a66', fontSize: 15 }}>
                    {currentStep === 0 ? 'Etapa 1 · Projeto' : 'Etapa 2 · Glebas'}
                  </strong>
                  <span style={{ color: '#64748b', fontSize: 13 }}>
                    {currentStep === 0
                      ? 'Selecione ou importe um projeto no painel à esquerda para começar.'
                      : 'Marque as glebas que deseja gerar e avance para personalizar os documentos.'}
                  </span>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
      <div className="doc-toolbar">
        <div className="doc-toolbar-left">
          <span className="doc-hint">{chosenPolygons.length} gleba(s) · {activeDocKeys.length} tipo(s) de documento</span>
        </div>
      </div>
    </main>
  );
}
