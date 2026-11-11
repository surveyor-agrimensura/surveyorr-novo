import {polygonSourceColors} from '../../lib/polygonSourceColors';
import { projectOwners } from '../projects/projectOwners';
import {GlobalLoading} from '../../components/GlobalLoading';
import { FileUploadField } from '../../components/FileUploadField';
import { ProjectSourcePicker } from '../../components/ProjectSourcePicker';
import { readOfflineDraft, writeOfflineDraft } from '../../lib/offlineDraftStore';
import { readFileAsDataUrl } from '../../lib/readFileAsDataUrl';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, ChevronDown, Download, Expand, FileText, MapPinned, RotateCcw, Save, Settings, Signature } from 'lucide-react';
import { PortableCroquiSvg } from '../../components/PortableCroquiSvg';
import { useAuth } from '../auth/AuthContext';
import { getDocumentCustomization, updateDocumentCustomization } from '../customization/customizationApi';
import { getProject, listProjects, projectTitle, type Project, type ProjectFull } from '../projects/projectsApi';
import {
  azimuth,
  distance,
  fmt,
  formatAzimuth,
  getPolygons,
  initialFields,
  mapLayout,
  memorialNarrative,
  record,
  segmentNeighbor,
  text,
  vertexName,
  type CoordinateDisplayMode,
  type MapLayout,
  type MemorialFields,
  type SurveyPolygon
} from './memorialEngine';
import { utmFromWgs84 } from '../documents/utmGrid';
import { docxBytes, downloadBytes, makeZip } from '../generations/exportOffice';
import { SignaturePadControl } from '../../components/SignaturePadControl';
import { renderCroqui, croquiVertexNames, defaultCroquiSettings, layoutForCroqui, type CroquiSettings } from './croquiRenderer';
import { readProjectDivisions } from '../croqui/projectDivisions';
import {applySheetLayout,sheetLayoutForProject,readSheetLayout} from '../croqui/sheetPresentationSync';
import { readSharedCroquiSettings, resolveSharedCroquiSettings, combineCroquiConfrontants, readSharedConfrontants, hasPendingCroquiDraft, writePendingCroquiDraft, clearPendingCroquiDraft, withSavedCroquiSettings, stampCroquiRevision, cloudCroquiDraft } from '../croqui/sharedCroquiSettings';
import { readDocumentDraft, saveDocumentDraft, readProjectDocumentIdentity } from '../documents/cloudDraft';
import { formatBrazilianDocument, maskBrazilianDocumentInput, formatBrazilianRg } from '../../lib/documentIdentity';
import { mergeConfrontantsIntoProperties } from '../documents/confrontantRegistry';
import {parsePublicMapData,publicMapUrlForProject} from '../public/publicMapData';
import {qrCodeDataUrl} from '../../lib/qrCode';
import './memorial.css';
import officialCroquiTemplate from './official-croqui-template.svg?raw';

type Prefs = {
  companyName?: string;
  addressText?: string;
  addressNumber?: string;
  phoneNumber?: string;
  whatsappNumber?: string;
  websiteUrl?: string;
  emailAddress?: string;
  footerText?: string;
  responsibleTechnician?: string;
  professionalRegistry?: string;
  professionalTitle?: string;
  logoDataUrl?: string;
  planDocumentSignatureDataUrl?: string;
  options?: Record<string, unknown>;
};

const visualModels: Record<string, { label: string; color: string; dark: string; light: string }> = {
  standard: { label: 'Padrão do Surveyor', color: '#155bc0', dark: '#102a47', light: '#eff5fd' },
  dourado: { label: 'Dourado', color: '#b8860b', dark: '#68500f', light: '#f9f5e8' },
  ciano: { label: 'Ciano', color: '#009eb6', dark: '#07596c', light: '#eafbfd' },
  verde: { label: 'Verde', color: '#188b38', dark: '#164c2d', light: '#edf8f0' },
  amarelo: { label: 'Amarelo', color: '#e2a000', dark: '#6e5000', light: '#fff8e3' },
  'agro-mais': { label: 'Agro+', color: '#779824', dark: '#345016', light: '#f0f5e9' }
};

const draftId = (userId: string, projectId: string, featureId = '') => `surveyor-memorial-draft-v2:${userId}:${projectId}${featureId ? `:${encodeURIComponent(featureId)}` : ''}`;
const defaultOptions = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback;
const site = (raw: unknown) => /^https?:\/\//i.test(text(raw)) ? text(raw) : '';
const isImage = (raw: unknown) => /^data:image\/(png|jpeg|webp);base64,/i.test(text(raw));

function Field({ name, value, onChange, placeholder }: { name: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <label className="mem-field"><span>{name}</span><input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

function Paper({ children, className = '', tone }: { children: ReactNode; className?: string; tone: string }) {
  return <article className={`mem-paper ${className}`} style={{ '--mem-tone': tone } as CSSProperties}>{children}</article>;
}

const TECH_MAP_WIDTH = 900;
const TECH_MAP_HEIGHT = 470;

function publicMapUrl(project: ProjectFull | null, polygon: SurveyPolygon, prefs: Prefs, composite = false) {
  const projectMeta = record(project?.project?.metadata);
  const explicitUrl = text(projectMeta.publicUrl || projectMeta.shareUrl || projectMeta.publicLink);
  if(!composite)try{
    const saved=new URL(explicitUrl);
    if(/^https?:$/.test(saved.protocol)&&parsePublicMapData(saved.searchParams.get('dados')))return saved.href;
  }catch{/* Gera um link no formato público atual quando a URL salva é antiga ou inválida. */}
  const origin = site(prefs.websiteUrl) || 'https://surveyor.com.br';
  const polygons=getPolygons(project?.features||[]);
  return publicMapUrlForProject(origin,projectTitle(project?.project||{id:'imovel'}),polygons,polygon,composite,explicitUrl);
}

function generationDate() {
  return new Date().toLocaleDateString('pt-BR');
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapSvgLines(value: string, max = 28) {
  const words = text(value).split(/\s+/).filter(Boolean);
  if (!words.length) return ['Não informado'];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 4);
}


const OFFICIAL_MAP_X = 44;
const OFFICIAL_MAP_Y = 74;
const OFFICIAL_MAP_WIDTH = 1112;
const OFFICIAL_MAP_HEIGHT = 590;

const OFFICIAL_NORTH_ROSE_SVG = `
      <g class="sv-live-element-layer sv-live-element-north" data-live-element="north" aria-hidden="false"><g transform="translate(102,138)">
      <circle cx="0" cy="0" r="31" fill="none" stroke="#111827" stroke-width="1.6"/>
      <circle cx="0" cy="0" r="27.4" fill="none" stroke="#111827" stroke-width="1.1"/>
      <polygon points="0,-29 4.3,-10.8 0,0 -4.3,-10.8" fill="#111827"/>
      <polygon points="29,0 10.8,4.3 0,0 10.8,-4.3" fill="#111827"/>
      <polygon points="0,29 4.3,10.8 0,0 -4.3,10.8" fill="#111827"/>
      <polygon points="-29,0 -10.8,4.3 0,0 -10.8,-4.3" fill="#111827"/>
      <polygon points="0,-18.8 8.1,-8.1 0,0 -8.1,-8.1" fill="#ffffff" stroke="#111827" stroke-width="1"/>
      <polygon points="18.8,0 8.1,8.1 0,0 8.1,-8.1" fill="#ffffff" stroke="#111827" stroke-width="1"/>
      <polygon points="0,18.8 8.1,8.1 0,0 -8.1,8.1" fill="#ffffff" stroke="#111827" stroke-width="1"/>
      <polygon points="-18.8,0 -8.1,8.1 0,0 -8.1,-8.1" fill="#ffffff" stroke="#111827" stroke-width="1"/>
      <text x="0" y="-43" text-anchor="middle" font-size="15" font-family="Georgia, 'Times New Roman', serif" font-weight="700" fill="#111827">N</text>
      <text x="43" y="5" text-anchor="middle" font-size="15" font-family="Georgia, 'Times New Roman', serif" font-weight="700" fill="#111827">E</text>
      <text x="0" y="50" text-anchor="middle" font-size="15" font-family="Georgia, 'Times New Roman', serif" font-weight="700" fill="#111827">S</text>
      <text x="-43" y="5" text-anchor="middle" font-size="15" font-family="Georgia, 'Times New Roman', serif" font-weight="700" fill="#111827">W</text>
    </g></g>`;

function svgLabelWidth(value: string, fontSize = 11) {
  return Math.max(28, Math.round(text(value).length * fontSize * 0.62));
}

function buildOfficialMapSection(args: { map: MapLayout; polygon: SurveyPolygon; base: 'satellite' | 'street'; showConfrontants: boolean }) {
  const scaleX = OFFICIAL_MAP_WIDTH / TECH_MAP_WIDTH;
  const scaleY = OFFICIAL_MAP_HEIGHT / TECH_MAP_HEIGHT;
  const points = args.map.points.map(point => ({
    x: OFFICIAL_MAP_X + point.x * scaleX,
    y: OFFICIAL_MAP_Y + point.y * scaleY,
    name: point.name
  }));
  const polygonPath=`M ${points.map(point=>`${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' L ')} Z`;
  const holePaths=args.map.holePoints.map(ring=>{
    const mapped=ring.map(point=>({x:OFFICIAL_MAP_X+point.x*scaleX,y:OFFICIAL_MAP_Y+point.y*scaleY}));
    return mapped.length>=3?`M ${mapped.map(point=>`${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' L ')} Z`:'';
  }).join(' ');
  const perimeterPath=`${polygonPath} ${holePaths}`;
  const tiles = args.map.tiles.map(tile => {
    const x = OFFICIAL_MAP_X + tile.left * scaleX;
    const y = OFFICIAL_MAP_Y + tile.top * scaleY;
    const tileSize=tile.tileSize||256;
    return `<image href="${escapeXml(tile.url)}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${(tileSize * scaleX).toFixed(2)}" height="${(tileSize * scaleY).toFixed(2)}" preserveAspectRatio="none" />`;
  }).join('');

  const signedArea = points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0) / 2;
  const clockwise = signedArea > 0;

  const overlay = points.map((point, index) => {
    const nextPoint = points[(index + 1) % points.length];
    const dx = nextPoint.x - point.x;
    const dy = nextPoint.y - point.y;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const nx = clockwise ? dy / length : -dy / length;
    const ny = clockwise ? -dx / length : dx / length;
    const dimOffset = 22;
    const textOffset = 14;
    const neighborOffset = 29;
    const p1x = point.x + nx * dimOffset;
    const p1y = point.y + ny * dimOffset;
    const p2x = nextPoint.x + nx * dimOffset;
    const p2y = nextPoint.y + ny * dimOffset;
    const midX = (p1x + p2x) / 2;
    const midY = (p1y + p2y) / 2;
    const rotation = lineAngle(point, nextPoint);
    const segmentLength = `${fmt(distance(args.polygon.vertices[index], args.polygon.vertices[(index + 1) % args.polygon.vertices.length]), 1)} m`;
    const neighbor = args.showConfrontants ? segmentNeighbor(args.polygon, index) : '';
    const textX = midX + nx * textOffset;
    const textY = midY + ny * textOffset;
    const neighborX = midX + nx * neighborOffset;
    const neighborY = midY + ny * neighborOffset;
    const vertexLabelX = point.x + nx * 9 + ux * 5;
    const vertexLabelY = point.y + ny * 9 + uy * 5;
    const neighborText = neighbor
      ? `<g transform="rotate(${rotation.toFixed(2)} ${neighborX.toFixed(1)} ${neighborY.toFixed(1)})"><text x="${neighborX.toFixed(1)}" y="${neighborY.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="10.4" font-weight="700" fill="#101827">${escapeXml(neighbor)}</text></g>`
      : '';
    return `<g>
      <line x1="${point.x.toFixed(1)}" y1="${point.y.toFixed(1)}" x2="${p1x.toFixed(1)}" y2="${p1y.toFixed(1)}" stroke="#101827" stroke-width="1.1" />
      <line x1="${nextPoint.x.toFixed(1)}" y1="${nextPoint.y.toFixed(1)}" x2="${p2x.toFixed(1)}" y2="${p2y.toFixed(1)}" stroke="#101827" stroke-width="1.1" />
      <line x1="${p1x.toFixed(1)}" y1="${p1y.toFixed(1)}" x2="${p2x.toFixed(1)}" y2="${p2y.toFixed(1)}" stroke="#101827" stroke-width="1.15" />
      <g transform="rotate(${rotation.toFixed(2)} ${textX.toFixed(1)} ${textY.toFixed(1)})">
        <text x="${textX.toFixed(1)}" y="${textY.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="11.2" font-weight="700" fill="#101827">${escapeXml(segmentLength)}</text>
      </g>
      ${neighborText}
      <circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="4.2" fill="#ffffff" stroke="#17212b" stroke-width="1.6" />
      <text x="${vertexLabelX.toFixed(1)}" y="${vertexLabelY.toFixed(1)}" font-size="10.5" font-weight="700" fill="#101827">${escapeXml(point.name)}</text>
    </g>`;
  }).join('');
  return `
      <defs><clipPath id="svOfficialMapClip"><rect x="${OFFICIAL_MAP_X}" y="${OFFICIAL_MAP_Y}" width="${OFFICIAL_MAP_WIDTH}" height="${OFFICIAL_MAP_HEIGHT}" /></clipPath></defs>
      <rect x="${OFFICIAL_MAP_X}" y="${OFFICIAL_MAP_Y}" width="${OFFICIAL_MAP_WIDTH}" height="${OFFICIAL_MAP_HEIGHT}" fill="#fff"/>
      <g clip-path="url(#svOfficialMapClip)">
        ${tiles}
        <path d="${perimeterPath}" fill="#ff1f17" fill-opacity="0.88" fill-rule="evenodd" stroke="#fa0000" stroke-width="2.4" stroke-linejoin="round"/>
        ${overlay}
      </g>
      ${OFFICIAL_NORTH_ROSE_SVG}`;
}

function memorialOwnerDetails(full: ProjectFull|null, fields: MemorialFields){
 return projectOwners(full?.project,fields.owner).map((owner,index)=>({
  ...owner,
  cpf:index===0 && fields.ownerDocument.trim()?formatBrazilianDocument(fields.ownerDocument):owner.cpf,
  rg:index===0 && fields.ownerRg.trim()?formatBrazilianRg(fields.ownerRg):owner.rg
 }));
}

function ownerNames(project:ProjectFull|null,fallbackOwner:string){
 return projectOwners(project?.project,fallbackOwner).map(entry=>entry.name);
}

function svgLabelRectWidth(value: string, fontSize = 12.5, padding = 8) {
  return Math.max(26, value.length * fontSize * 0.62 + padding * 2);
}

export function buildOfficialCroquiLiveMap(map: MapLayout, polygon: SurveyPolygon, showConfrontants: boolean) {
  const mapX = 44;
  const mapY = 74;
  const mapW = 1112;
  const mapH = 590;
  const points = map.points.map(point => ({ ...point, x: mapX + point.x, y: mapY + point.y }));
  const outerPath=`M ${points.map(point=>`${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' L ')} Z`;
  const holePaths=map.holePoints.map(ring=>{
    const mapped=ring.map(point=>({x:mapX+point.x,y:mapY+point.y}));
    return mapped.length>=3?`M ${mapped.map(point=>`${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' L ')} Z`:'';
  }).join(' ');
  const perimeterPath=`${outerPath} ${holePaths}`;
  const tiles = map.tiles.map(tile => `<image href="${escapeXml(tile.url)}" x="${mapX + tile.left}" y="${mapY + tile.top}" width="${tile.tileSize||256}" height="${tile.tileSize||256}" preserveAspectRatio="none"/>`).join('');
  const labels = points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    const rotation = lineAngle({ x: point.x, y: point.y }, { x: next.x, y: next.y });
    const midX = (point.x + next.x) / 2;
    const midY = (point.y + next.y) / 2;
    const segmentLength = `${fmt(distance(polygon.vertices[index], polygon.vertices[(index + 1) % polygon.vertices.length]), 1)} m`;
    const neighbor = showConfrontants ? segmentNeighbor(polygon, index) : '';
    const neighborWidth = svgLabelRectWidth(neighbor, 12.5, 9);
    const neighborX = midX;
    const neighborY = midY + 18;
    return `
      <g>
        <g transform="rotate(${rotation.toFixed(2)} ${midX.toFixed(2)} ${midY.toFixed(2)})">
          <text x="${midX.toFixed(2)}" y="${(midY - 8).toFixed(2)}" text-anchor="middle" font-size="12.8" font-weight="700" fill="#111827">${escapeXml(segmentLength)}</text>
        </g>
        ${neighbor ? `<g transform="rotate(${rotation.toFixed(2)} ${neighborX.toFixed(2)} ${neighborY.toFixed(2)})"><rect x="${(neighborX - neighborWidth / 2).toFixed(2)}" y="${(neighborY - 10).toFixed(2)}" width="${neighborWidth.toFixed(2)}" height="18" rx="3" ry="3" fill="#ffffff" fill-opacity="0.96"/><text x="${neighborX.toFixed(2)}" y="${(neighborY + 4).toFixed(2)}" text-anchor="middle" font-size="12.5" font-weight="750" fill="#111827">${escapeXml(neighbor)}</text></g>` : ''}
        <circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="4.3" fill="#fff" stroke="#17212b" stroke-width="1.6" />
        <text x="${(point.x + 8).toFixed(2)}" y="${(point.y - 8).toFixed(2)}" font-size="10.8" font-weight="700" fill="#101827">${escapeXml(point.name)}</text>
      </g>`;
  }).join('');
  return `
    <defs><clipPath id="sv-map-clip-dynamic"><rect x="${mapX}" y="${mapY}" width="${mapW}" height="${mapH}" /></clipPath></defs>
    <g clip-path="url(#sv-map-clip-dynamic)">
      <rect x="${mapX}" y="${mapY}" width="${mapW}" height="${mapH}" fill="#eef2f6"/>
      ${tiles}
      <path d="${perimeterPath}" fill="#ff0000" fill-opacity="1" fill-rule="evenodd" stroke="none"/>
      <path d="${perimeterPath}" fill="none" stroke="#1f2937" stroke-width="7.19" stroke-linejoin="round" stroke-linecap="round" opacity="0.18"/>
      <path d="${perimeterPath}" fill="none" stroke="#fa0000" stroke-width="6.20" stroke-linejoin="round" stroke-linecap="round"/>
      ${labels}
    </g>`;
}

export function buildOfficialCroquiSvg(args: {
  documentName: string;
  municipalityUf: string;
  areaHa: string;
  perimeterM: string;
  responsible: string;
  generationDate: string;
  companyName: string;
  mapLink: string;
  qrCodeUrl: string;
  zoom: number;
  base: 'satellite' | 'street';
  map: MapLayout;
  polygon: SurveyPolygon;
  showConfrontants: boolean;
}) {
  const data = args;
  const linkLines = wrapSvgLines(data.mapLink, 30)
    .map((line, index) => `<tspan x="887" dy="${index ? 11.5 : 0}">${escapeXml(line)}</tspan>`)
    .join('');
  const mapSection = buildOfficialMapSection({
    map: data.map,
    polygon: data.polygon,
    base: data.base,
    showConfrontants: data.showConfrontants
  });
  let svg = officialCroquiTemplate;
  svg = svg.replace(/<rect x="44" y="74" width="1112" height="590" fill="#fff"\/>[\s\S]*?<g class="sv-map-coordinate-reference">/, `${mapSection}
      <g class="sv-map-coordinate-reference">`);
  svg = svg.replace(/<text x="514" y="737"[\s\S]*?<\/text>/, `<text x="514" y="737" text-anchor="start" font-size="12" font-weight="400"><tspan x="514" dy="0">${escapeXml(data.documentName || 'Não informado')}</tspan></text>`);
  svg = svg.replace(/<text x="454" y="791"[\s\S]*?<\/text>/, `<text x="454" y="791" font-size="13"><tspan font-weight="600">Município/UF:</tspan> ${escapeXml(data.municipalityUf || 'Não informado')}</text>`);
  svg = svg.replace(/<text x="454" y="816"[\s\S]*?<\/text>/, `<text x="454" y="816" font-size="13"><tspan font-weight="600">Área:</tspan> ${escapeXml(data.areaHa)} ha</text>`);
  svg = svg.replace(/<text x="659" y="816"[\s\S]*?<\/text>/, `<text x="659" y="816" font-size="13"><tspan font-weight="600">Perímetro:</tspan> ${escapeXml(data.perimeterM)} m</text>`);
  svg = svg.replace(/<text x="654" y="858"[^>]*>Responsável técnico\(a\):<\/text><text x="654" y="876"[\s\S]*?<\/text>/, `<text x="654" y="858" font-size="13" font-weight="600">Responsável técnico(a):</text><text x="654" y="876" text-anchor="start" font-size="11.5" font-weight="400"><tspan x="654" dy="0">${escapeXml(data.responsible || 'Não informado')}</tspan></text>`);
  svg = svg.replace(/<text x="454" y="912"[\s\S]*?<\/text>/, `<text x="454" y="912" font-size="12"><tspan font-weight="600">Data:</tspan> ${escapeXml(data.generationDate)}</text>`);
  svg = svg.replace(/<text x="1012\.5" y="792"[\s\S]*?<\/text>/, `<text x="1012.5" y="792" text-anchor="middle" font-size="12" font-weight="700"><tspan x="1012.5" dy="0">${escapeXml(data.companyName || 'Surveyor Agrimensura')}</tspan></text>`);
  svg = svg.replace(/<text x="887" y="870"[\s\S]*?<\/text>/, `<text x="887" y="870" text-anchor="start" font-size="9.5" font-weight="400">${linkLines}</text>`);
  svg = svg.replace(/<g class="sv-map-coordinate-reference">[\s\S]*?<\/g>/, '');
  svg = svg.replace(/>Zoom \d+</, `>Zoom ${Math.round(data.zoom)}<`);
  if(data.qrCodeUrl){
    svg = svg.replace(/(<image href=")[^"]+(" x="68" y="790" width="100" height="100")/, `$1${escapeXml(data.qrCodeUrl)}$2`);
  }else{
    const qrFallback=/^https?:\/\//i.test(data.mapLink)?'Sem QR; utilize o link completo ao lado':'Sem link público';
    svg = svg.replace(/<image\b[^>]*x="68" y="790" width="100" height="100"[^>]*\/>/, `<text x="76" y="842" font-size="11" fill="#64748b">${escapeXml(qrFallback)}</text>`);
  }
  return svg;
}

function lineAngle(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
}

function CompassRose() {
  return <div className="mem-compass" aria-hidden="true">
    <svg viewBox="0 0 72 72" role="presentation">
      <circle cx="36" cy="36" r="30" fill="rgba(255,255,255,0.82)" stroke="#1b2430" strokeWidth="2" />
      <circle cx="36" cy="36" r="6" fill="#fff" stroke="#1b2430" strokeWidth="1.8" />
      <path d="M36 8 L42 30 L36 36 L30 30 Z" fill="#1b2430" />
      <path d="M64 36 L42 42 L36 36 L42 30 Z" fill="#9fb4c8" />
      <path d="M36 64 L30 42 L36 36 L42 42 Z" fill="#9fb4c8" />
      <path d="M8 36 L30 30 L36 36 L30 42 Z" fill="#1b2430" />
      <text x="36" y="7" textAnchor="middle">N</text>
      <text x="69" y="39" textAnchor="middle">E</text>
      <text x="36" y="70" textAnchor="middle">S</text>
      <text x="3" y="39" textAnchor="middle">W</text>
    </svg>
  </div>;
}

export function TileMap({ polygon, zoom, base, showConfrontants }: { polygon: SurveyPolygon; zoom: number; base: 'satellite' | 'street'; showConfrontants: boolean }) {
  const map: MapLayout = useMemo(() => mapLayout(polygon, TECH_MAP_WIDTH, TECH_MAP_HEIGHT, zoom, base), [polygon, zoom, base]);
  const perimeterPath=`M ${map.points.map(point=>`${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' L ')} Z ${map.holePoints.map(ring=>ring.length>=3?`M ${ring.map(point=>`${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' L ')} Z`:'').join(' ')}`;
  return <div className="mem-tile-map mem-tile-map-technical" aria-label="Croqui técnico de localização do imóvel com perímetro destacado">
    {map.tiles.map(tile => <img alt="" loading="eager" key={`${tile.x}-${tile.y}`} src={tile.url} style={{ left: `${tile.left / TECH_MAP_WIDTH * 100}%`, top: `${tile.top / TECH_MAP_HEIGHT * 100}%`, width:`${(tile.tileSize||256)/TECH_MAP_WIDTH*100}%` }} />)}
    <svg viewBox={`0 0 ${TECH_MAP_WIDTH} ${TECH_MAP_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
      {map.points.length > 2 && <path d={perimeterPath} fill="rgba(255,0,0,.86)" fillRule="evenodd" stroke="#59636e" strokeWidth="5" strokeLinejoin="round" />}
      {map.points.map((point, index) => {
        const nextPoint = map.points[(index + 1) % map.points.length];
        const midX = (point.x + nextPoint.x) / 2;
        const midY = (point.y + nextPoint.y) / 2;
        const rotation = lineAngle(point, nextPoint);
        const segmentLength = `${fmt(distance(polygon.vertices[index], polygon.vertices[(index + 1) % polygon.vertices.length]), 1)} m`;
        const neighbor = showConfrontants ? segmentNeighbor(polygon, index) : '';
        const neighborWidth = svgLabelWidth(neighbor, 10);
        return <g key={`${point.name}-${index}`}>
          <g transform={`translate(${midX} ${midY}) rotate(${rotation})`}>
            <text x="0" y="-8" textAnchor="middle" fontSize="11" fontWeight="700" fill="#0f1722">{segmentLength}</text>
          </g>
          {neighbor && <>
            <rect x={midX - neighborWidth / 2 - 6} y={midY + 4} width={neighborWidth + 12} height="17" rx="3" fill="rgba(255,255,255,.92)" />
            <text x={midX} y={midY + 16} textAnchor="middle" fontSize="10" fontWeight="700" fill="#173456">{neighbor}</text>
          </>}
          <circle cx={point.x} cy={point.y} r="4.3" fill="#fff" stroke="#17212b" strokeWidth="1.8" />
          <text x={point.x + 8} y={point.y - 8} fontSize="10.5" fontWeight="700" fill="#101827">{point.name}</text>
        </g>;
      })}
    </svg>
    <CompassRose />
    <div className="mem-map-banner">{base === 'satellite' ? 'IMAGEM DE SATÉLITE (MESMA BASE DO MAPA)' : 'MAPA VIÁRIO (MESMA BASE DO MAPA)'} • COORDENADAS DD • SIRGAS 2000 • ZOOM {map.zoom}</div>
  </div>;
}

function Stamp({ prefs }: { prefs: Prefs }) {
  return <div className="mem-stamp">
    <div className="mem-stamp-mark">{isImage(prefs.logoDataUrl) ? <img src={prefs.logoDataUrl} alt="Logotipo cadastrado" /> : <span className="mem-brand-no-logo" />}</div>
    <div>
      <strong>{prefs.companyName || 'SURVEYOR'}</strong>
      <small>{[prefs.addressText, prefs.addressNumber].filter(Boolean).join(', ')}</small>
      <small>{[prefs.phoneNumber, prefs.emailAddress].filter(Boolean).join(' · ')}</small>
      {site(prefs.websiteUrl) && <small>{site(prefs.websiteUrl)}</small>}
    </div>
  </div>;
}

function SignatureBox({ prefs, custom, scale, position, onMove }: { prefs: Prefs; custom: string; scale: number; position:{x:number;y:number}; onMove:(p:{x:number;y:number})=>void }) {
  const image = custom || text(prefs.planDocumentSignatureDataUrl);
  const gesture=useRef<{pointer:number;startX:number;startY:number;x:number;y:number}|null>(null);
  return <div className="mem-signature">
    <div className="mem-signature-draw" style={{height:`${Math.max(48,Math.round(scale*.85))}px`}}>{isImage(image) && <img src={image} alt="Assinatura (arraste para posicionar)" draggable={false} title="Clique e arraste para reposicionar" style={{width:`${Math.max(85,Math.round(scale*2.55))}px`,height:`${Math.max(42,Math.round(scale*.85))}px`,maxWidth:'none',maxHeight:'none',touchAction:'none',cursor:'grab',objectFit:'contain',transform:`translate(${position.x}px,${position.y}px)`}} onPointerDown={e=>{e.preventDefault();gesture.current={pointer:e.pointerId,startX:e.clientX,startY:e.clientY,x:position.x,y:position.y};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{const g=gesture.current;if(g?.pointer===e.pointerId)onMove({x:Math.max(-260,Math.min(260,g.x+e.clientX-g.startX)),y:Math.max(-150,Math.min(150,g.y+e.clientY-g.startY))});}} onPointerUp={e=>{gesture.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}} onPointerCancel={()=>{gesture.current=null;}} />}</div>
    <div className="mem-signature-line" />
    <b>{prefs.responsibleTechnician || 'Responsável técnico'}</b>
    <small>{[prefs.professionalTitle, prefs.professionalRegistry].filter(Boolean).join(' · ')}</small>
  </div>;
}

function OwnerSignature({ name, signature, scale = 70, position = {x:0,y:0} }: { name: string; signature?: string; scale?: number; position?: {x:number;y:number} }) {
  return <div className="mem-owner-signature" style={{ transform: `translate(${position.x}px,${position.y}px)` }}>
    <div className="mem-owner-signature-draw">{isImage(signature) && <img src={signature} alt={`Assinatura de ${name || 'proprietário'}`} style={{width:`${scale}%`}} />}</div>
    <div className="mem-signature-line" />
    <b>{name || 'Proprietário / requerente'}</b>
    <small>Assinatura do proprietário</small>
  </div>;
}

function downloadContent(name: string, content: string, kind: string) {
  const blob = new Blob(['\ufeff', content], { type: kind });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

const exportCss = `
@page{size:A4;margin:0}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:#17253a;font:12px Arial,sans-serif}
.mem-paper{width:210mm;min-height:297mm;margin:0 auto;padding:19mm 16mm 17mm;background:#fff;break-after:page;position:relative;--mem-tone:#155bc0}
.mem-paper:last-child{break-after:auto}
.mem-paper h2{text-align:center;font-size:15px;letter-spacing:1px;margin:18px 0 14px}
.mem-stamp{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid var(--mem-tone);padding-bottom:13px;gap:20px}.mem-stamp-mark{width:172px;min-height:108px;flex-shrink:0;display:flex;align-items:center;justify-content:center}.mem-stamp-mark img{width:166px;height:106px;object-fit:contain}.mem-stamp>div:last-child{text-align:right;display:flex;flex-direction:column;gap:3px}.mem-stamp strong{font-size:14px}.mem-stamp small{font-size:9px}
.mem-simple-header{font-size:13px;font-weight:800;text-align:right;border-bottom:2px solid var(--mem-tone);padding:15px}
.mem-meta{display:grid;grid-template-columns:1fr 1fr;background:#f2f5fa;border-radius:6px;gap:9px;padding:13px;margin-bottom:15px;font-size:10px}.mem-meta div{display:flex;gap:6px}.mem-meta b{min-width:84px}
.mem-meta .mem-meta-owners{grid-column:1/-1;display:flex;align-items:flex-start;gap:10px;break-inside:avoid}
.mem-meta .mem-meta-owners>b{min-width:108px;flex-shrink:0}
.mem-meta .mem-meta-owner-list{display:flex;flex-direction:column;gap:5px;flex:1;min-width:0}
.mem-meta .mem-meta-owner{display:flex;flex-direction:column;gap:1px;min-width:0}
.mem-meta .mem-meta-owner span{overflow-wrap:anywhere}
.mem-meta .mem-meta-document-values{display:flex;flex-direction:column;gap:5px;min-width:0}
.mem-meta .mem-meta-document-values span{overflow-wrap:anywhere;line-height:1.45}
.mem-meta .mem-meta-documents{align-items:flex-start;break-inside:avoid}
.mem-meta .mem-meta-owners{grid-column:1/-1}
.mem-codes{display:flex;flex-wrap:wrap;gap:8px;font-size:10px;margin-top:8px}
.mem-section-title{font:bold 13px Arial;border-bottom:1px solid #b8c7d8;margin:20px 0 10px;padding-bottom:6px}
.mem-description{text-align:justify;line-height:1.85;white-space:pre-wrap}.mem-description p{margin:0}
.mem-notes{text-align:justify;white-space:pre-wrap;font-size:11px}
.mem-paper table{border-collapse:collapse;width:100%;font-size:10px;margin:14px 0}.mem-paper td,.mem-paper th{border:1px solid #cbd5e1;padding:7px;text-align:left}.mem-paper th{background:#eff4fa}.mem-corners{page-break-inside:avoid}
.mem-signature{width:240px;margin:16px auto 0;display:flex;flex-direction:column;align-items:center;text-align:center;gap:3px}.mem-signature-draw{height:55px;display:flex;align-items:end}.mem-signature-draw img{max-height:53px;object-fit:contain}.mem-signature-line{border-top:1px solid #333;width:100%}.mem-signature small{font-size:9px}
.mem-map-frame{border:2px solid #2c3643;padding:8px;margin-top:8px;background:#fff}.mem-map-frame-technical{padding:6px}
.mem-tile-map{position:relative;width:100%;overflow:hidden;background:#d9e2e8;aspect-ratio:900 / 470}.mem-tile-map>img{position:absolute;width:28.444%;height:auto;max-width:none}.mem-tile-map>svg{position:absolute;inset:0;width:100%;height:100%}
.mem-tile-map-technical{background:#e9eef2}.mem-compass{position:absolute;left:18px;top:18px;width:72px;height:72px;z-index:2}.mem-compass svg{width:100%;height:100%}.mem-compass text{font:700 13px Arial;fill:#101827}
.mem-map-banner{position:absolute;left:16px;bottom:14px;padding:7px 12px;border-radius:5px;background:rgba(255,255,255,.92);font-size:10px;font-weight:700;color:#1b2531;z-index:2}
.mem-caption{text-align:center;font-size:10px;color:#5d708b;margin:0 0 10px}
.mem-technical-sheet{margin-top:10px;border:2px solid #2c3643;display:grid;grid-template-columns:1.02fr 1.15fr .83fr;background:#fff}.mem-technical-side{display:grid;grid-template-rows:auto auto;border-right:2px solid #2c3643}.mem-technical-side .mem-tech-box + .mem-tech-box{border-top:1px solid #2c3643}.mem-tech-box{padding:10px 12px}.mem-tech-box h3{margin:0 0 10px;font-size:11px;line-height:1.25;text-align:center}.mem-tech-grid{display:grid;gap:6px;font-size:10px}.mem-tech-grid div{display:flex;gap:5px}.mem-tech-grid b{min-width:48px}
.mem-tech-legend-box{display:flex;gap:12px;align-items:center}.mem-technical-qr{width:110px;flex:0 0 110px;display:flex;flex-direction:column;align-items:center;gap:5px;text-align:center;color:#17253a;text-decoration:none}.mem-technical-qr img{width:96px;height:96px;object-fit:contain}.mem-technical-qr small{font-size:9px}.mem-tech-legend{flex:1}.mem-tech-legend-item{display:flex;align-items:center;gap:8px;font-size:10.5px;margin-top:7px}.legend-line{display:inline-block;width:20px;height:0;border-top:3px solid #e11d2f}.legend-measure{border-top-width:1px;border-top-color:#1f2937}.legend-vertex{width:11px;height:11px;border:2px solid #17212b;border-radius:50%;background:#fff}.legend-neighbor{width:22px;height:0;border-top:2px dashed #1b4d75}
.mem-tech-data{display:flex;flex-direction:column;gap:10px;border-right:2px solid #2c3643}.mem-tech-data-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;font-size:10px}.mem-tech-data-grid div{display:flex;gap:5px}.mem-tech-data-grid b{min-width:68px}.mem-tech-data-wide{grid-column:1/-1}.mem-tech-divider{border-top:1px solid #2c3643}.mem-tech-person,.mem-tech-date{font-size:10px;display:flex;gap:5px;align-items:flex-start}.mem-tech-date{margin-top:auto}
.mem-tech-brand{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:8px}.mem-tech-brand-mark img{width:52px;height:52px;object-fit:contain}.mem-tech-brand strong{font-size:12px}.mem-tech-brand span{font-size:10px}.mem-tech-link{width:100%;text-align:left;font-size:9px;line-height:1.3}.mem-tech-link span{display:block;overflow-wrap:anywhere}
.mem-page-footer{position:absolute;bottom:12mm;left:16mm;right:16mm;border-top:1px solid #d4deea;padding-top:7px;display:flex;justify-content:space-between;font-size:8px;color:#677891}
.mem-footer-brand{height:13mm;position:absolute;bottom:0;left:0;right:0;opacity:.36;overflow:hidden}.mem-title-mark{width:100%;height:16mm;position:absolute;top:0;left:0;right:0;overflow:hidden}.mem-title-mark svg,.mem-footer-brand svg{width:100%;height:100%}
.mem-skin-standard .mem-meta{background:#f4f7fa}.mem-skin-dourado .mem-meta{background:#faf6ec}.mem-skin-ciano .mem-meta{background:#eaf8fa}.mem-skin-verde .mem-meta{background:#edf8ed}.mem-skin-amarelo .mem-meta{background:#fff9e8}.mem-skin-agro-mais .mem-meta{background:#f0f7e8}
.mem-paper-croqui-official{padding:8mm 8mm 10mm;background:#fff;box-shadow:none}.mem-paper-croqui-official .mem-stamp,.mem-paper-croqui-official .mem-simple-header,.mem-paper-croqui-official .mem-page-footer,.mem-paper-croqui-official .mem-title-mark,.mem-paper-croqui-official .mem-footer-brand{display:none}.mem-official-sheet{background:#fff;padding:0}.mem-official-sheet-svg{display:flex;flex-direction:column;gap:8px}.mem-official-svg{width:100%;background:#fff}.mem-official-svg svg{display:block;width:100%;height:auto}.mem-croqui-signatures{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}.mem-croqui-signatures .mem-signature,.mem-owner-signature{width:auto;min-height:120px;margin:0;border:none !important;border-radius:0 !important;box-shadow:none !important;outline:none !important;padding:8px 12px;background:transparent !important}.mem-croqui-signatures .mem-signature-draw,.mem-owner-signature-draw{height:55px;display:flex;align-items:end;justify-content:center}.mem-owner-signature{display:flex;flex-direction:column;justify-content:flex-end;align-items:center;text-align:center;gap:4px}.mem-paper-croqui-official h2{margin:2mm 0 4mm;font-size:17px;letter-spacing:0}.mem-map-frame-official{border:2px solid #111827;padding:0;margin-top:0;background:#fff}.mem-map-frame-official .mem-tile-map{aspect-ratio:1112 / 590;background:#e5ebf0}.mem-map-frame-official .mem-map-banner{left:14px;bottom:10px;padding:6px 10px;border-radius:4px;font-size:9px}.mem-paper-croqui-official .mem-compass{left:16px;top:14px;width:68px;height:68px}.mem-technical-sheet-official{margin-top:4px;border:2px solid #111827;grid-template-columns:35% 39% 26%}.mem-technical-sheet-official .mem-technical-side{border-right:2px solid #111827}.mem-technical-sheet-official .mem-tech-data{border-right:2px solid #111827}.mem-technical-sheet-official .mem-tech-box{padding:8px 10px}.mem-technical-sheet-official .mem-tech-box h3{font-size:10px;margin:0 0 8px}.mem-technical-sheet-official .mem-tech-grid,.mem-technical-sheet-official .mem-tech-data-grid,.mem-technical-sheet-official .mem-tech-person,.mem-technical-sheet-official .mem-tech-date,.mem-technical-sheet-official .mem-tech-link{font-size:9px}.mem-technical-sheet-official .mem-tech-legend-item{font-size:9.5px}.mem-technical-sheet-official .mem-technical-qr{width:105px;flex-basis:105px}.mem-technical-sheet-official .mem-technical-qr img{width:92px;height:92px}.mem-technical-sheet-official .mem-tech-brand strong{font-size:11px}.mem-technical-sheet-official .mem-tech-brand span{font-size:9px}
`;

export function MemorialPage() {
  const { session } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [full, setFull] = useState<ProjectFull | null>(null);
  const [prefs, setPrefs] = useState<Prefs>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [workflowStep, setWorkflowStep] = useState<1 | 2 | 3>(1);
  const [sub, setSub] = useState<'memorial' | 'signature'>('memorial');
  const [fitToScreen, setFitToScreen] = useState(true);
  const [fields, setFields] = useState<MemorialFields>(initialFields({ id: '' }));
  const [featureId, setFeatureId] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [mapOverride, setMapOverride] = useState<boolean | null>(null);
  const [vertexTableOverride, setVertexTableOverride] = useState<boolean | null>(null);
  const [signatureOverride, setSignatureOverride] = useState<boolean | null>(null);
  const [signatureData, setSignatureData] = useState('');
  const [signatureSize, setSignatureSize] = useState(70);
  const [signaturePosition,setSignaturePosition]=useState({x:0,y:0});
  const [signatureFileName, setSignatureFileName] = useState('Nenhum arquivo selecionado');
  const [ownerSignatureData, setOwnerSignatureData] = useState('');
  const [ownerSignatureFileName, setOwnerSignatureFileName] = useState('Nenhum arquivo selecionado');
  const [ownerSignatureEnabled, setOwnerSignatureEnabled] = useState(false);
  const [ownerSignaturePerson, setOwnerSignaturePerson] = useState('');
  const [ownerSignatureSize, setOwnerSignatureSize] = useState(70);
  const [ownerSignaturePosition, setOwnerSignaturePosition] = useState({x:0,y:0});
  const signatureOwnerChoices = ownerNames(full,fields.owner);
  const effectiveOwnerSignaturePerson = ownerSignaturePerson || (signatureOwnerChoices.length===1?signatureOwnerChoices[0]:'');
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingDraft,setSavingDraft]=useState(false);
  const [croquiReload]=useState(0);
  const [coordMode, setCoordMode] = useState<CoordinateDisplayMode>('wgs84');
  const [customNarratives, setCustomNarratives] = useState<Record<string, string>>({});
  const mapDragRef = useRef<{
    pointerId:number;key:string;svg:SVGSVGElement;start:{x:number;y:number};offset:{dx:number;dy:number};
    originalTransform:string;target:SVGTextElement;polygon:SurveyPolygon;polygonId:string;projectId:string;settings:CroquiSettings;zoom:number;
  }|null>(null);

  const pointInSvg=(svg:SVGSVGElement,clientX:number,clientY:number)=>{
    const matrix=svg.getScreenCTM();if(!matrix)return null;
    const point=svg.createSVGPoint();point.x=clientX;point.y=clientY;
    const converted=point.matrixTransform(matrix.inverse());
    return Number.isFinite(converted.x)&&Number.isFinite(converted.y)?{x:converted.x,y:converted.y}:null;
  };
  const beginMapLabelDrag=(event:ReactPointerEvent<HTMLDivElement>,polygon:SurveyPolygon,settings:CroquiSettings)=>{
    if(event.button!==0||!event.isPrimary)return;
    const target=event.target instanceof Element?event.target.closest<SVGTextElement>('[data-croqui-label]'):null;
    const svg=event.currentTarget.querySelector('svg');
    const key=target?.getAttribute('data-croqui-label')||'';
    const start=svg?pointInSvg(svg,event.clientX,event.clientY):null;
    if(!target||!svg||!key||!start)return;
    const rawOffset=settings.labelOffsets[key]||{dx:0,dy:0};
    const offset={dx:Number(rawOffset.dx)||0,dy:Number(rawOffset.dy)||0};
    mapDragRef.current={pointerId:event.pointerId,key,svg,start,offset,originalTransform:target.getAttribute('transform')||'',target,polygon,polygonId:polygon.id,projectId,settings,zoom:layoutForCroqui(polygon,settings,projectDivisions).zoom};
    event.currentTarget.setPointerCapture(event.pointerId);event.preventDefault();
  };
  const moveMapLabelDrag=(event:ReactPointerEvent<HTMLDivElement>)=>{
    const drag=mapDragRef.current;if(!drag||drag.pointerId!==event.pointerId||!event.isPrimary)return;
    const current=pointInSvg(drag.svg,event.clientX,event.clientY);if(!current)return;
    const dx=current.x-drag.start.x,dy=current.y-drag.start.y;
    drag.target.setAttribute('transform',`translate(${dx} ${dy}) ${drag.originalTransform}`.trim());
  };
  const releaseMapLabelCapture=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const cancelMapLabelDrag=(event:ReactPointerEvent<HTMLDivElement>)=>{
    const drag=mapDragRef.current;if(!drag||drag.pointerId!==event.pointerId)return;
    drag.target.setAttribute('transform',drag.originalTransform);
    mapDragRef.current=null;
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const finishMapLabelDrag=async(event:ReactPointerEvent<HTMLDivElement>)=>{
    const drag=mapDragRef.current;if(!drag||drag.pointerId!==event.pointerId)return;
    const current=pointInSvg(drag.svg,event.clientX,event.clientY);
    mapDragRef.current=null;releaseMapLabelCapture(event);
    if(!current)return;
    const dx=current.x-drag.start.x,dy=current.y-drag.start.y;
    if(Math.hypot(dx,dy)<0.5){drag.target.setAttribute('transform',drag.originalTransform);return;}
    let nextSettings:CroquiSettings;
    if(drag.key.startsWith('map-name:')){
      const id=drag.key.slice('map-name:'.length),worldSize=256*2**drag.zoom;
      nextSettings={...drag.settings,mapNames:drag.settings.mapNames.map(item=>{
        if(item.id!==id)return item;
        const latRadians=item.lat*Math.PI/180;
        const mx=(item.lon+180)/360*worldSize+dx;
        const my=(1-Math.asinh(Math.tan(latRadians))/Math.PI)/2*worldSize+dy;
        return {...item,lon:Math.max(-180,Math.min(180,mx/worldSize*360-180)),lat:Math.max(-85,Math.min(85,Math.atan(Math.sinh(Math.PI*(1-2*my/worldSize)))*180/Math.PI))};
      })};
    }else{
      nextSettings={...drag.settings,labelOffsets:{...drag.settings.labelOffsets,[drag.key]:{dx:drag.offset.dx+dx,dy:drag.offset.dy+dy}}};
    }
    const stamped=stampCroquiRevision(nextSettings);
    if(!writePendingCroquiDraft(croquiUserKey,drag.projectId,drag.polygonId,stamped)){
      drag.target.setAttribute('transform',drag.originalTransform);
      setMessage('Não foi possível preservar o rótulo neste dispositivo.');return;
    }
    setPrefs(currentPrefs=>({...currentPrefs,...withSavedCroquiSettings(currentPrefs as Record<string,unknown>,drag.projectId,drag.polygonId,stamped)} as Prefs));
    setSaved(false);
    if(!session){setMessage('Rótulo preservado neste navegador. Entre na conta para sincronizar com a nuvem.');return;}
    try{
      const result=await updateDocumentCustomization(session,current=>withSavedCroquiSettings(current,drag.projectId,drag.polygonId,stamped));
      if(!result.saved.customization)throw new Error('O servidor não confirmou a gravação.');
      const confirmed=await getDocumentCustomization(session);
      const actual=cloudCroquiDraft(record(confirmed.customization?.options),drag.projectId,drag.polygonId);
      const expected=cloudCroquiDraft(record(withSavedCroquiSettings(result.current,drag.projectId,drag.polygonId,stamped).options),drag.projectId,drag.polygonId);
      if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error('A releitura não confirmou a posição do rótulo.');
      clearPendingCroquiDraft(croquiUserKey,drag.projectId,drag.polygonId);
      setPrefs(record(confirmed.customization) as Prefs);
      setMessage('Posição do rótulo salva na nuvem e compartilhada com o Croqui e a Prancha Técnica.');
    }catch(error){
      setMessage(`Rótulo mantido neste navegador; a nuvem não confirmou a gravação: ${error instanceof Error?error.message:'falha de sincronização'}`);
    }
  };

  const polygons = useMemo(() => {
   const source=getPolygons(full?.features||[]);
   return source.map(p=>{
    const entry=readSharedConfrontants(record(prefs.options),projectId,p.id);
    const saved=readSharedCroquiSettings(record(prefs.options),projectId,p.id,
      text(session?.user?.id||session?.user?.email||'local'),text(prefs.responsibleTechnician),source.length===1);
    const pending=hasPendingCroquiDraft(text(session?.user?.id||session?.user?.email||'local'),projectId,p.id);
    const confrontants=pending&&saved?{neighbors:saved.neighbors,details:saved.neighborDetails}:entry||(saved&&saved.neighbors.length?{neighbors:saved.neighbors,details:saved.neighborDetails}:null);
    return confrontants?{...p,properties:mergeConfrontantsIntoProperties(p.properties,p.vertices.length,confrontants)}:p;
   });
  }, [full,prefs.options,prefs.responsibleTechnician,projectId,session?.user?.id,session?.user?.email,croquiReload]);
  const croquiUserKey = text(session?.user?.id || session?.user?.email || 'local');
  const userKey = text(session?.user?.id || session?.user?.email || 'account');
  const chosen = useMemo(() => polygons.filter(item => showAll || item.id === featureId), [polygons, showAll, featureId]);
  const projectDivisions=useMemo(()=>readProjectDivisions(full?.features||[]),[full]);
  const opt = record(prefs.options);
  const mem = record(opt.memorial);
  const savedModel = text(opt.memorialTemplateId) || 'standard';
  const template = visualModels[savedModel] || visualModels.standard;
  const modelAllowed = savedModel !== 'agro-mais' || (Array.isArray(opt.allowedMemorialTemplateIds) && opt.allowedMemorialTemplateIds.includes(savedModel));
  const applied = modelAllowed ? template : visualModels.standard;
  const showMap = mapOverride ?? defaultOptions(mem.showMap, true);
  const showVertexTable = vertexTableOverride ?? defaultOptions(mem.showVertexTable, true);
  const showLogo = defaultOptions(mem.showLogo, true);
  const showQr = defaultOptions(mem.showQr, true);
  const hasSignature = signatureOverride ?? Boolean(isImage(signatureData) || isImage(prefs.planDocumentSignatureDataUrl));

  useEffect(() => {
    if (!session) return;
    let done = false;
    setLoading(true);
    Promise.allSettled([listProjects(session), getDocumentCustomization(session)]).then(result => {
      if (done) return;
      if (result[0].status === 'fulfilled') setProjects(result[0].value);
      else setMessage('Não foi possível carregar os projetos da nuvem.');
      if (result[1].status === 'fulfilled') {
        const pref = record(result[1].value.customization) as Prefs;
        setPrefs(pref);
      } else {
        const reason = result[1].reason;
        setMessage(current => `${current} Não foi possível carregar a personalização da conta: ${reason instanceof Error ? reason.message : 'a API não confirmou a consulta.'}`.trim());
      }
    }).finally(() => {
      if (!done) setLoading(false);
    });
    return () => { done = true; };
  }, [session]);

  const selectProject = useCallback(async (id: string) => {
    setProjectId(id);
    setFull(null);
    setMessage('');
    setFeatureId('');
    setOwnerSignatureData('');
    setOwnerSignatureFileName('Nenhum arquivo selecionado');
    setOwnerSignatureEnabled(false);
    setOwnerSignaturePerson('');
    setOwnerSignatureSize(70);
    setOwnerSignaturePosition({x:0,y:0});
    setSignaturePosition({x:0,y:0});
    setShowAll(false);
    setSaved(false);
    if (!id || !session) return;
    setLoading(true);
    try {
      const [projectResult,latestPrefsResult]=await Promise.allSettled([getProject(session,id),getDocumentCustomization(session)]);
      if(projectResult.status==='rejected')throw projectResult.reason;
      const data=projectResult.value;
      const customization=latestPrefsResult.status==='fulfilled'?record(latestPrefsResult.value.customization):record(prefs);
      if(latestPrefsResult.status==='fulfilled')setPrefs(customization as Prefs);
      else setMessage(`Projeto aberto, mas a personalização da conta não carregou: ${latestPrefsResult.reason instanceof Error?latestPrefsResult.reason.message:'a API não confirmou a consulta.'}`);
      setFull(data);
      const defaults=initialFields(data.project||{id});
      const identity=readProjectDocumentIdentity(record(customization.options),id);
      // Owner identity belongs to the project; a blank/stale document draft must not erase it.
      const ownerIdentity={owner:defaults.owner||text(identity.owner),
       ownerDocument:defaults.ownerDocument||text(identity.ownerDocument),ownerRg:defaults.ownerRg||text(identity.ownerRg)};
      setFields({...defaults,...identity,...ownerIdentity} as MemorialFields);
      const localPolygons = getPolygons(data.features);
      const firstFeature=localPolygons[0]?.id||'';
      const sharedDraft=readDocumentDraft(record(customization.options),'memorial',id,firstFeature,localPolygons.length===1);
      if(Object.keys(sharedDraft).length){
       const savedFields=record(sharedDraft.fields);
       setFields(current=>({...current,...savedFields,...ownerIdentity} as MemorialFields));
       const signatureOffset=record(sharedDraft.signaturePosition);
       if(Number.isFinite(signatureOffset.x)&&Number.isFinite(signatureOffset.y))setSignaturePosition({x:Number(signatureOffset.x),y:Number(signatureOffset.y)});
        if(typeof sharedDraft.ownerSignatureData==='string'&&isImage(sharedDraft.ownerSignatureData))setOwnerSignatureData(sharedDraft.ownerSignatureData);
        if(typeof sharedDraft.ownerSignatureFileName==='string')setOwnerSignatureFileName(sharedDraft.ownerSignatureFileName);
        setOwnerSignatureEnabled(sharedDraft.ownerSignatureEnabled===true);
        if(typeof sharedDraft.ownerSignaturePerson==='string')setOwnerSignaturePerson(sharedDraft.ownerSignaturePerson);
        if(typeof sharedDraft.ownerSignatureSize==='number')setOwnerSignatureSize(Math.max(30,Math.min(180,sharedDraft.ownerSignatureSize)));
        const ownerOffset=record(sharedDraft.ownerSignaturePosition);if(Number.isFinite(ownerOffset.x)&&Number.isFinite(ownerOffset.y))setOwnerSignaturePosition({x:Number(ownerOffset.x),y:Number(ownerOffset.y)});
       if(typeof sharedDraft.signatureSize==='number')setSignatureSize(sharedDraft.signatureSize);
       if(sharedDraft.coordMode==='wgs84'||sharedDraft.coordMode==='utm'||sharedDraft.coordMode==='both')setCoordMode(sharedDraft.coordMode);
       if(sharedDraft.customNarratives&&typeof sharedDraft.customNarratives==='object')setCustomNarratives(record(sharedDraft.customNarratives) as Record<string,string>);
      }
      if (localPolygons.length) setFeatureId(localPolygons[0].id);
      setShowAll(localPolygons.length > 1);
      const localKey = draftId(userKey, id, firstFeature);
      let raw = localStorage.getItem(localKey) || (localPolygons.length===1?localStorage.getItem(draftId(userKey,id)):null);
      if(!raw){const recovered=await readOfflineDraft<Record<string,unknown>>(localKey)||(localPolygons.length===1?await readOfflineDraft<Record<string,unknown>>(draftId(userKey,id)):null);if(recovered)raw=JSON.stringify(recovered);}
      if (raw && !Object.keys(sharedDraft).length) {
        try {
          const draft = JSON.parse(raw) as {
            fields?: Partial<MemorialFields>;
            featureId?: string;
            showAll?: boolean;
            mapOverride?: boolean | null;
            vertexTableOverride?: boolean | null;
            signatureOverride?: boolean | null;
            signatureSize?: number;
            signaturePosition?: {x:number;y:number};
             ownerSignatureData?: string;
             ownerSignatureFileName?: string;
             ownerSignatureEnabled?: boolean;
             ownerSignaturePerson?: string;
             ownerSignatureSize?: number;
             ownerSignaturePosition?: {x:number;y:number};
          };
          if (draft.fields && !Object.keys(sharedDraft).length) setFields(current => ({ ...current, ...draft.fields, ...ownerIdentity }));
          if (draft.featureId && localPolygons.some(item => item.id === draft.featureId)) setFeatureId(draft.featureId);
          if (draft.showAll) setShowAll(true);
          if (typeof draft.mapOverride === 'boolean') setMapOverride(draft.mapOverride);
          if (typeof draft.vertexTableOverride === 'boolean') setVertexTableOverride(draft.vertexTableOverride);
          if (typeof draft.signatureOverride === 'boolean') setSignatureOverride(draft.signatureOverride);
          if (typeof draft.signatureSize === 'number') setSignatureSize(draft.signatureSize);
           if (typeof draft.ownerSignatureData === 'string' && isImage(draft.ownerSignatureData)) setOwnerSignatureData(draft.ownerSignatureData);
           if (typeof draft.ownerSignatureFileName === 'string') setOwnerSignatureFileName(draft.ownerSignatureFileName);
            setOwnerSignatureEnabled(draft.ownerSignatureEnabled === true);
            if(typeof draft.ownerSignaturePerson==='string')setOwnerSignaturePerson(draft.ownerSignaturePerson);
            if(typeof draft.ownerSignatureSize==='number')setOwnerSignatureSize(Math.max(30,Math.min(180,draft.ownerSignatureSize)));
            if(draft.ownerSignaturePosition&&Number.isFinite(draft.ownerSignaturePosition.x)&&Number.isFinite(draft.ownerSignaturePosition.y))setOwnerSignaturePosition(draft.ownerSignaturePosition);
          if(draft.signaturePosition&&Number.isFinite(draft.signaturePosition.x)&&Number.isFinite(draft.signaturePosition.y))setSignaturePosition(draft.signaturePosition);else setSignaturePosition({x:0,y:0});
          // Rascunhos antigos podem conter preferências do croqui, agora gerenciadas em Mapas e Croquis.
        } catch {
          // Cache inválido não deve interromper o fluxo.
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível abrir este projeto.');
    } finally {
      setLoading(false);
    }
  }, [session, userKey, prefs]);

  const setField = (key: keyof MemorialFields, value: string) => {
    setFields(current => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const saveDraft = async () => {
    if (!projectId || !session || savingDraft) return;
    setSavingDraft(true);setMessage('');
    const payload={fields,featureId,showAll,mapOverride,vertexTableOverride,signatureOverride,
      signatureSize,signaturePosition,coordMode,customNarratives,ownerSignatureData,ownerSignatureFileName,ownerSignatureEnabled,ownerSignaturePerson:effectiveOwnerSignaturePerson,ownerSignatureSize,ownerSignaturePosition};
    try{const key=draftId(userKey,projectId,featureId);localStorage.setItem(key,JSON.stringify(payload));void writeOfflineDraft(key,payload);}
    catch{setMessage('O navegador não conseguiu preservar o rascunho.');setSavingDraft(false);return;}
    try{
     await saveDocumentDraft(session,'memorial',projectId,payload,featureId);
     const updated=await getDocumentCustomization(session);
     const stored=readDocumentDraft(record(updated.customization?.options),'memorial',projectId,featureId,false);
     if(JSON.stringify(stored)!==JSON.stringify(payload))throw new Error('A releitura da nuvem não confirmou o memorial. O rascunho local continua disponível.');
     setPrefs(record(updated.customization) as Prefs);
     setSaved(true);setMessage('Alterações do memorial confirmadas na nuvem.');
    }catch(error){
     setSaved(false);setMessage(`Rascunho local preservado, porém a nuvem não confirmou: ${error instanceof Error?error.message:'erro de conexão'}`);
    }finally{setSavingDraft(false);}
  };

  const readImage = async (file: File, reportProgress: (file: File, loaded: number, total: number) => void, signal: AbortSignal) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 2 * 1024 * 1024) throw new Error('Selecione uma imagem PNG, JPEG ou WEBP de até 2 MB.');
    setSignatureData(await readFileAsDataUrl(file, reportProgress, signal));
    setSignatureOverride(true);
    setSignatureFileName(file.name);
    setSaved(false);
  };

  const readOwnerImage = async (file: File, reportProgress: (file: File, loaded: number, total: number) => void, signal: AbortSignal) => {
    if(!effectiveOwnerSignaturePerson)throw new Error('Selecione o proprietário que assina este documento.');
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 2 * 1024 * 1024) throw new Error('Selecione uma imagem PNG, JPEG ou WEBP de até 2 MB.');
    const dataUrl = await readFileAsDataUrl(file, reportProgress, signal);
    if (!isImage(dataUrl)) throw new Error('Não foi possível carregar a imagem da assinatura.');
    setOwnerSignatureData(dataUrl);
    setOwnerSignaturePerson(effectiveOwnerSignaturePerson);
    setOwnerSignatureFileName(file.name);
    setSaved(false);
    setMessage('');
  };

  const documentName = full?.project ? projectTitle(full.project) : 'Imóvel rural';

  const getPolygonNarrative = (poly: SurveyPolygon, names: string[]) => {
    const custom = customNarratives[poly.id];
    return typeof custom === 'string' && custom.trim() ? custom : memorialNarrative(poly, names, coordMode);
  };

  const download = (format: 'pdf' | 'docx' | 'doc' | 'html' | 'txt' | 'zip-1a1') => {
    setDownloadOpen(false);
    if (!chosen.length) return;
    if (format === 'pdf') {
      window.print();
      return;
    }
    const slug = (documentName || 'memorial').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-]/gi, '_').slice(0, 60);
    if (format === 'docx') {
      const paragraphs: string[] = [];
      if (showAll && chosen.length > 1) {
        const totalArea = chosen.reduce((total, poly) => total + poly.areaM2, 0);
        const totalPerimeter = chosen.reduce((total, poly) => total + poly.perimeterM, 0);
        paragraphs.push(
          `MEMORIAL DESCRITIVO DO IMÓVEL COMPLETO — ${documentName}`,
          `Município / UF: ${full?.project?.municipality || full?.project?.city || ''} / ${full?.project?.stateCode || full?.project?.uf || ''}`,
          `Proprietários: ${memorialOwnerDetails(full, fields).map(owner => owner.name).filter(Boolean).join('; ') || fields.owner || 'Não informado'}`,
          `Soma das áreas cadastradas: ${fmt(totalArea / 10000, 4)} ha`,
          `Soma dos perímetros cadastrados: ${fmt(totalPerimeter)} m`,
          'QUADRO DAS ÁREAS DO PROJETO',
          ...chosen.map(poly => `${poly.name}: ${fmt(poly.areaM2 / 10000, 4)} ha · ${fmt(poly.perimeterM)} m`),
          'A soma das áreas cadastradas pode diferir da área da união geométrica quando houver sobreposição ou perímetro-base duplicado. Confira a topologia antes do uso oficial.',
          'DESCRIÇÃO DOS PERÍMETROS COMPONENTES'
        );
        chosen.forEach((poly, i) => {
          const draft = readSharedCroquiSettings(record(prefs.options), projectId, poly.id, croquiUserKey, text(prefs.responsibleTechnician), polygons.length === 1);
          const names = draft ? croquiVertexNames(poly, draft) : poly.vertices.map((_, idx) => vertexName(idx));
          paragraphs.push(`${i + 1}. ${poly.name}`, getPolygonNarrative(poly, names));
        });
        paragraphs.push('MEMORIAIS INDIVIDUAIS DAS ÁREAS');
      }
      chosen.forEach((poly, i) => {
        const draft = readSharedCroquiSettings(record(prefs.options), projectId, poly.id, croquiUserKey, text(prefs.responsibleTechnician), polygons.length === 1);
        const names = draft ? croquiVertexNames(poly, draft) : poly.vertices.map((_, idx) => vertexName(idx));
        const gName = poly.name?.trim() || `Gleba ${i + 1}`;
        const pTitle = polygons.length > 1 && gName.toLowerCase() !== documentName.toLowerCase() ? `${documentName} — ${gName}` : documentName;
        const owners = memorialOwnerDetails(full, fields);
        if (i > 0) paragraphs.push('================================================================');
        paragraphs.push(`Imóvel: ${pTitle}`);
        paragraphs.push(`Município / UF: ${full?.project?.municipality || full?.project?.city || ''} / ${full?.project?.stateCode || full?.project?.uf || ''}`);
        if (owners.length) paragraphs.push(`Proprietários: ${owners.map(o => `${o.name}${o.cpf ? ` (CPF/CNPJ: ${o.cpf})` : ''}`).join('; ')}`);
        if (fields.reference.trim()) paragraphs.push(`Documento: ${fields.kind} ${fields.reference}`);
        paragraphs.push(`Área cartográfica aproximada: ${fmt(poly.areaM2 / 10000, 4)} ha | Perímetro: ${fmt(poly.perimeterM)} m`);
        paragraphs.push('DESCRIÇÃO DO PERÍMETRO');
        paragraphs.push(getPolygonNarrative(poly, names));
        if (fields.notes.trim()) paragraphs.push(`Observações: ${fields.notes.trim()}`);
        if (showVertexTable) {
          paragraphs.push('QUADRO DE VÉRTICES');
          poly.vertices.forEach((v, idx) => {
            const next = poly.vertices[(idx + 1) % poly.vertices.length];
            let utmInfo = '';
            if (coordMode !== 'wgs84') {
              try { const u = utmFromWgs84([v[0], v[1]]); utmInfo = ` | E=${fmt(u.east, 3)}m N=${fmt(u.north, 3)}m (${u.zone}${u.hemisphere})`; } catch { /* ignore */ }
            }
            paragraphs.push(`${names[idx]}: Lat ${v[1].toFixed(7)}°, Lon ${v[0].toFixed(7)}°${utmInfo} -> ${fmt(distance(v, next))} m (${formatAzimuth(azimuth(v, next))})`);
          });
        }
        paragraphs.push(`Responsável Técnico: ${text(prefs.responsibleTechnician) || 'Não informado'} ${text(prefs.professionalRegistry) ? `— ${text(prefs.professionalRegistry)}` : ''}`);
      });
      downloadBytes(docxBytes(['MEMORIAL DESCRITIVO', ...paragraphs]), `Memorial_${slug}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      return;
    }
    if (format === 'zip-1a1') {
      const files: { name: string; content: Uint8Array | string }[] = [];
      polygons.forEach((poly, i) => {
        const draft = readSharedCroquiSettings(record(prefs.options), projectId, poly.id, croquiUserKey, text(prefs.responsibleTechnician), polygons.length === 1);
        const names = draft ? croquiVertexNames(poly, draft) : poly.vertices.map((_, idx) => vertexName(idx));
        const gName = poly.name?.trim() || `Gleba_${i + 1}`;
        const pSlug = gName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]/g, '_');
        const pTitle = polygons.length > 1 && gName.toLowerCase() !== documentName.toLowerCase() ? `${documentName} — ${gName}` : documentName;
        const narrativeText = getPolygonNarrative(poly, names);
        const docx = docxBytes([
          'MEMORIAL DESCRITIVO',
          `Imóvel: ${pTitle}`,
          `Município / UF: ${full?.project?.municipality || full?.project?.city || ''} / ${full?.project?.stateCode || full?.project?.uf || ''}`,
          `Área aproximada: ${fmt(poly.areaM2 / 10000, 4)} ha | Perímetro: ${fmt(poly.perimeterM)} m`,
          'DESCRIÇÃO DO PERÍMETRO',
          narrativeText,
          'QUADRO DE VÉRTICES',
          ...poly.vertices.map((v, idx) => `${names[idx]}: Lat ${v[1].toFixed(7)}°, Lon ${v[0].toFixed(7)}°`)
        ]);
        files.push({ name: `${String(i + 1).padStart(2, '0')}_${pSlug}/Memorial_${pSlug}.docx`, content: docx });
        files.push({ name: `${String(i + 1).padStart(2, '0')}_${pSlug}/Memorial_${pSlug}.txt`, content: `MEMORIAL DESCRITIVO\r\nImóvel: ${pTitle}\r\nÁrea: ${fmt(poly.areaM2 / 10000, 4)} ha\r\nPerímetro: ${fmt(poly.perimeterM)} m\r\n\r\n${narrativeText}\r\n` });
      });
      downloadBytes(makeZip(files), `Memoriais_1_por_1_${slug}.zip`, 'application/zip');
      return;
    }
    if (format === 'txt') {
      const lines = chosen.map(poly => {
        const draft=readSharedCroquiSettings(record(prefs.options),projectId,poly.id,croquiUserKey,
          text(prefs.responsibleTechnician),polygons.length===1);
        const names=draft?croquiVertexNames(poly,draft):poly.vertices.map((_,i)=>vertexName(i));
        const owners=memorialOwnerDetails(full,fields);
        const namesBlock=owners.map(owner=>owner.name).join('\n');
        const cpfBlock=owners.map(owner=>owner.cpf).filter(Boolean).join('\n');
        const rgBlock=owners.map(owner=>owner.rg).filter(Boolean).join('\n');
        return `MEMORIAL DESCRITIVO\nImóvel: ${documentName}\nMunicípio: ${full?.project?.municipality || full?.project?.city || ''} / ${full?.project?.stateCode || full?.project?.uf || ''}${namesBlock?'\nPROPRIETÁRIOS:\n'+namesBlock:''}${cpfBlock?'\nCPF/CNPJ:\n'+cpfBlock:''}${rgBlock?'\nRG:\n'+rgBlock:''}${fields.reference.trim()?'\nDocumento: '+fields.kind+' '+fields.reference:''}\nÁrea aproximada: ${fmt(poly.areaM2 / 10000, 4)} ha\nPerímetro aproximado: ${fmt(poly.perimeterM)} m\n\n${getPolygonNarrative(poly,names)}\n\nVÉRTICES\n${poly.vertices.map((vertex, index) => `${names[index]}: ${vertex[1].toFixed(7)}°, ${vertex[0].toFixed(7)}°`).join('\n')}`;
      });
      if (showAll && chosen.length > 1) {
        const totalArea = chosen.reduce((total, poly) => total + poly.areaM2, 0);
        const totalPerimeter = chosen.reduce((total, poly) => total + poly.perimeterM, 0);
        const overview = [`MEMORIAL DESCRITIVO DO IMÓVEL COMPLETO — ${documentName}`, `Município / UF: ${full?.project?.municipality || full?.project?.city || ''} / ${full?.project?.stateCode || full?.project?.uf || ''}`, `Soma das áreas cadastradas: ${fmt(totalArea / 10000, 4)} ha`, `Soma dos perímetros cadastrados: ${fmt(totalPerimeter)} m`, 'QUADRO DAS ÁREAS DO PROJETO', ...chosen.map(poly => `${poly.name}: ${fmt(poly.areaM2 / 10000, 4)} ha · ${fmt(poly.perimeterM)} m`), 'A soma das áreas cadastradas pode diferir da área da união geométrica quando houver sobreposição ou perímetro-base duplicado. Confira a topologia antes do uso oficial.', 'DESCRIÇÃO DOS PERÍMETROS COMPONENTES', ...chosen.flatMap((poly, i) => { const draft=readSharedCroquiSettings(record(prefs.options),projectId,poly.id,croquiUserKey,text(prefs.responsibleTechnician),polygons.length===1); const names=draft?croquiVertexNames(poly,draft):poly.vertices.map((_,index)=>vertexName(index)); return [`${i+1}. ${poly.name}`,getPolygonNarrative(poly,names)]; })].join('\n');
        lines.unshift(overview);
      }
      downloadContent(`Memorial_${slug}.txt`, lines.join('\n\n-----------------\n\n'), 'text/plain;charset=utf-8');
      return;
    }
    const pageNodes = [...document.querySelectorAll<HTMLElement>('.mem-paper')].map(element => element.outerHTML).join('');
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Memorial Descritivo</title><style>${exportCss}</style></head><body>${pageNodes}</body></html>`;
    downloadContent(`Memorial_${slug}.${format === 'doc' ? 'doc' : 'html'}`, html, format === 'doc' ? 'application/msword' : 'text/html;charset=utf-8');
  };

  const label = (value: unknown) => text(value).trim();

  const projectValid = Boolean(projectId && chosen.length);
  const currentStep = workflowStep - 1;

  return <main className="workspace-main memorial-main"><GlobalLoading active={loading} />
    <header className="memorial-workflow-bar" aria-label="Ações do memorial descritivo">
      <div className="memorial-workflow-start">
        <Link className="memorial-back" to="/" aria-label="Voltar à tela inicial" title="Sair do memorial e voltar à tela inicial"><ArrowLeft size={19} /></Link>
        <div className="mem-download memorial-workflow-download">
          <button className="mem-outline" aria-label="Baixar documento" aria-haspopup="menu" aria-expanded={downloadOpen} disabled={!chosen.length} onClick={() => setDownloadOpen(value => !value)}><Download size={16} /> Baixar <ChevronDown size={14} /></button>
          {downloadOpen && <div className="mem-download-menu" role="menu">
            <button role="menuitem" onClick={() => download('pdf')}>PDF</button>
            <button role="menuitem" onClick={() => download('docx')}>Word (.docx)</button>
            <button role="menuitem" onClick={() => download('doc')}>Word (.doc)</button>
            <button role="menuitem" onClick={() => download('html')}>HTML</button>
            <button role="menuitem" onClick={() => download('txt')}>TXT</button>
            {polygons.length > 1 && <button role="menuitem" onClick={() => download('zip-1a1')}>Memoriais por gleba (ZIP)</button>}
          </div>}
        </div>
      </div>
      <ol className="memorial-workflow-steps" aria-label="Etapas do documento">
        {['Projeto', 'Dados do memorial', 'Ajustes do documento'].map((step, index) => <li key={step} aria-label={step} className={index === currentStep ? 'is-current' : index < currentStep ? 'is-complete' : ''} aria-current={index === currentStep ? 'step' : undefined}>
          <span className="memorial-step-number">{index < currentStep ? <Check size={13} /> : index + 1}</span><span>{step}</span>
        </li>)}
      </ol>
      <div className="memorial-workflow-actions">
        <button className="mem-draft" onClick={() => void saveDraft()} disabled={!projectId || savingDraft}>
          <Save size={16} />{savingDraft ? 'Salvando…' : saved ? 'Rascunho salvo' : 'Salvar rascunho'}
        </button>
      </div>
    </header>
    <div className="workspace-container memorial-container">
      <div className="mem-body">
        {message && <div className="mem-notification" role="alert">{message}<button onClick={() => setMessage('')}>Fechar</button></div>}
        <div className="mem-grid">
          <aside className="mem-side">
            <div className="memorial-panel-scroll">
            {workflowStep < 3 ? <div className="mem-form">
              <h2 className="mem-panel-title">{workflowStep === 1 ? 'Seleção do projeto' : 'Dados do memorial'}</h2>
              {workflowStep === 1 && <>
              <div className="mem-section">
                <strong>Projeto</strong>
                <ProjectSourcePicker scope="memorial" projects={projects} projectId={projectId} loading={loading} onProjectChange={id => { setWorkflowStep(1); void selectProject(id); }} onImport={data => {
                  const id=data.project?.id||'';const localPolygons=getPolygons(data.features);
                  setWorkflowStep(1);
                  setProjectId(id);setFull(data);setFeatureId(localPolygons[0]?.id||'');setShowAll(localPolygons.length>1);
                  setFields(initialFields(data.project||{id}));setSaved(false);setMessage('Projeto importado e salvo neste navegador.');
                }} onClearImport={() => { setWorkflowStep(1); void selectProject(''); }} />
              </div>

              {!projectId && <div className="mem-project-empty">
                <MapPinned size={20} strokeWidth={1.8} aria-hidden="true" />
                <span>Selecione um projeto para carregar os dados do imóvel e as glebas.</span>
              </div>}
              {projectId && full && <section className="mem-project-identification">
                <span>Projeto selecionado</span>
                <strong>{projectTitle(full.project || {id: projectId})}</strong>
                <small>{[text(full.project?.municipality || full.project?.city), text(full.project?.stateCode || full.project?.uf)].filter(Boolean).join(' / ') || `${polygons.length} gleba${polygons.length === 1 ? '' : 's'} disponível${polygons.length === 1 ? '' : 'is'}`}</small>
              </section>}
              {projectId && full && !projectValid && <div className="mem-project-empty">
                <MapPinned size={20} strokeWidth={1.8} aria-hidden="true" />
                <span>Este projeto não contém polígonos válidos para gerar o memorial. Selecione outro projeto.</span>
              </div>}
              </>}

              {workflowStep === 2 && projectId && <>

                <div className="mem-section">
                  <strong>Identificação do imóvel</strong>
                  <label className="mem-field"><span>Gerar para</span><select value={showAll ? 'all' : featureId} onChange={event => {
                    const next=event.target.value;
                    setShowAll(next === 'all');
                    if(next!=='all' && next!==featureId){
                      const perFeature=readDocumentDraft(record(prefs.options),'memorial',projectId,next,polygons.length===1);
                      const basics=initialFields(full?.project||{id:projectId});
                      const shared=readProjectDocumentIdentity(record(prefs.options),projectId);
                      const owners={owner:basics.owner||text(shared.owner),ownerDocument:basics.ownerDocument||text(shared.ownerDocument),ownerRg:basics.ownerRg||text(shared.ownerRg)};
                      const nextFields=record(perFeature.fields);
                      setFields({...basics,...shared,...nextFields,...owners} as MemorialFields);
                      const offset=record(perFeature.signaturePosition);
                      setSignaturePosition({x:Number(offset.x)||0,y:Number(offset.y)||0});
                      setSignatureSize(typeof perFeature.signatureSize==='number'?perFeature.signatureSize:70);
                      setSaved(false);
                      setFeatureId(next);
                      setMessage('Rascunho individual desta gleba carregado. Confira e salve suas alterações antes de trocar novamente.');
                    }
                  }}>
                    <option value="all">Imóvel completo ({polygons.length} polígonos)</option>
                    {polygons.map(polygon => <option key={polygon.id} value={polygon.id}>{polygon.name}</option>)}
                  </select>
                  {!polygons.length && <small>Este projeto não contém polígonos válidos para o memorial.</small>}
                  </label>
                  <small>Projeto: {projectTitle(full?.project || {id: projectId})}</small>
                </div>
                <div className="mem-section">
                  <strong>Dados do documento e do imóvel</strong>
                  <div className="mem-fields">
                  <label className="mem-field">
                    <span>Tipo de documento</span>
                    <select value={fields.kind} onChange={event => setField('kind', event.target.value)}>
                      <option>Matrícula</option>
                      <option>Transcrição</option>
                      <option>Escritura</option>
                      <option>Posse declarada</option>
                      <option>Outro</option>
                    </select>
                  </label>
                  <Field name="Nº do documento / referência" value={fields.reference} onChange={value => setField('reference', value)} placeholder="Ex.: Matrícula 1234" />
                  <Field name="Proprietário / requerente" value={fields.owner} onChange={value => setField('owner', value)} />
                  <Field name="CPF/CNPJ do proprietário" value={fields.ownerDocument} onChange={value => setField('ownerDocument', maskBrazilianDocumentInput(value))} />
                  <details className="mem-advanced"><summary>Dados complementares e observações</summary><div className="mem-fields mem-advanced-body">
                    <Field name="Código INCRA" value={fields.incra} onChange={value => setField('incra', value)} />
                    <Field name="Número CIB" value={fields.cib} onChange={value => setField('cib', value)} />
                    <Field name="RG do proprietário" value={fields.ownerRg} onChange={value => setField('ownerRg', formatBrazilianRg(value))} />
                    <Field name="Comarca" value={fields.district} onChange={value => setField('district', value)} />
                    <label className="mem-field"><span>Observações complementares</span><textarea value={fields.notes} rows={3} onChange={event => setField('notes', event.target.value)} /></label>
                  </div></details>
                  </div>
                </div>
              </>}
            </div> : <div className="mem-custom">
              <div className="mem-custom-tabs">
                <button className={sub === 'memorial' ? 'active' : ''} onClick={() => setSub('memorial')}><FileText size={14} /> Memorial</button>
                <button className={sub === 'signature' ? 'active' : ''} onClick={() => setSub('signature')}><Signature size={14} /> Assinaturas</button>
              </div>

              {sub === 'memorial' && <div className="mem-fields">
                <div className="mem-model-state"><strong style={{color:applied.color}}>Modelo: {applied.label}</strong></div>
                <Link to="/customizacao/" className="mem-link"><Settings size={14} /> Alterar modelo da conta</Link>
                <label className="mem-field">
                  <span>Sistema de coordenadas no texto e tabela</span>
                  <select value={coordMode} onChange={e => { setCoordMode(e.target.value as CoordinateDisplayMode); setSaved(false); }}>
                    <option value="wgs84">Geográficas (Latitude / Longitude WGS 84)</option>
                    <option value="utm">Planas UTM (Este E / Norte N em metros)</option>
                    <option value="both">Ambos (Geográficas + Planas UTM)</option>
                  </select>
                </label>
                <label className="mem-check mem-check--compact"><input type="checkbox" checked={showMap} onChange={event => setMapOverride(event.target.checked)} /> Incluir página de croqui / mapa de localização</label>
                <label className="mem-check mem-check--compact"><input type="checkbox" checked={showVertexTable} onChange={event => setVertexTableOverride(event.target.checked)} /> Exibir quadro de vértices no memorial</label>
                {chosen.length > 0 && (() => {
                  const activePoly = chosen[0];
                  const draft = readSharedCroquiSettings(record(prefs.options), projectId, activePoly.id, croquiUserKey, text(prefs.responsibleTechnician), polygons.length === 1);
                  const names = draft ? croquiVertexNames(activePoly, draft) : activePoly.vertices.map((_, i) => vertexName(i));
                  const currentText = customNarratives[activePoly.id] ?? memorialNarrative(activePoly, names, coordMode);
                  const isCustom = Boolean(customNarratives[activePoly.id]?.trim());
                  return <div className="mem-field mem-narrative-field">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Texto descritivo do perímetro ({activePoly.name})</span>
                      {isCustom && <button type="button" className="mem-outline" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => {
                        setCustomNarratives(prev => { const next = { ...prev }; delete next[activePoly.id]; return next; });
                        setSaved(false);
                      }}>Restaurar automático</button>}
                    </div>
                    <textarea
                      className="mem-narrative-input"
                      rows={14}
                      value={currentText}
                      onChange={e => {
                        setCustomNarratives(prev => ({ ...prev, [activePoly.id]: e.target.value }));
                        setSaved(false);
                      }}
                    />
                  </div>;
                })()}
                
                
              </div>}

              {sub === 'signature' && <div className="mem-fields">
                <section className="mem-signature-group">
                  <div className="mem-signature-heading"><strong>Responsável técnico</strong></div>
                  <label className="mem-check"><input type="checkbox" checked={hasSignature} onChange={event => setSignatureOverride(event.target.checked)} /> Incluir assinatura do responsável técnico</label>
                  <FileUploadField label="Imagem da assinatura técnica" description={signatureFileName === 'Nenhum arquivo selecionado' ? 'PNG, JPEG ou WebP · até 2 MB' : signatureFileName} accept="image/png,image/jpeg,image/webp" maxBytes={2 * 1024 * 1024} cancellable onFile={readImage} onRemove={() => { setSignatureData(''); setSignatureFileName('Nenhum arquivo selecionado'); setSignatureOverride(false); setSaved(false); }}/>
                  <SignaturePadControl label="Desenhar assinatura" onApply={dataUrl => { setSignatureData(dataUrl); setSignatureOverride(true); setSignatureFileName('Assinatura desenhada na tela'); setSaved(false); }} />
                  <div className="mem-signature-controls">
                    <button type="button" className="mem-outline" disabled={!hasSignature} onClick={()=>setSignaturePosition({x:0,y:0})}>Centralizar assinatura</button>
                    <label className="mem-field"><span>Tamanho: {signatureSize}%</span><input type="range" min="30" max="180" value={signatureSize} disabled={!hasSignature} onChange={event => setSignatureSize(Number(event.target.value))} /></label>
                  </div>
                  {(signatureData || text(prefs.planDocumentSignatureDataUrl)) && <div className="mem-signature-thumb"><img src={signatureData || prefs.planDocumentSignatureDataUrl} alt="Assinatura selecionada" /></div>}
                  {(signatureData || text(prefs.planDocumentSignatureDataUrl)) && <button type="button" onClick={() => { setSignatureData(''); setSignatureOverride(false); setSignatureFileName('Nenhum arquivo selecionado'); }} className="mem-outline">Remover assinatura desta geração</button>}
                </section>
                <section className="mem-signature-group mem-owner-signature-note">
                  <div className="mem-signature-heading"><strong>Proprietário / requerente</strong></div>
                  <label className="mem-field"><span>Quem assina</span><select value={effectiveOwnerSignaturePerson} onChange={event=>{setOwnerSignaturePerson(event.target.value);setOwnerSignatureData('');setOwnerSignatureFileName('Nenhum arquivo selecionado');setOwnerSignatureEnabled(false);setSaved(false);}}><option value="">Selecione um proprietário</option>{signatureOwnerChoices.map((name,index)=><option key={`${name}-${index}`} value={name}>{name}</option>)}</select></label>
                  <FileUploadField key={effectiveOwnerSignaturePerson || 'owner-signature'} label="Assinatura do proprietário / requerente" description={ownerSignatureFileName === 'Nenhum arquivo selecionado' ? 'Importe ou arraste uma imagem PNG, JPEG ou WebP · até 2 MB' : ownerSignatureFileName} accept="image/png,image/jpeg,image/webp" maxBytes={2 * 1024 * 1024} cancellable onFile={readOwnerImage} onRemove={() => { setOwnerSignatureData(''); setOwnerSignatureFileName('Nenhum arquivo selecionado'); setOwnerSignatureEnabled(false); setSaved(false); }}/>
                  <label className="mem-check"><input type="checkbox" checked={ownerSignatureEnabled} disabled={!ownerSignatureData} onChange={event => { setOwnerSignatureEnabled(event.target.checked); setSaved(false); }} /> Incluir a assinatura do proprietário / requerente nos documentos deste projeto</label>
                  {ownerSignatureData && <>
                    <div className="mem-signature-thumb"><img src={ownerSignatureData} alt="Assinatura do proprietário ou cliente" /></div>
                    {!ownerSignatureEnabled && <small className="mem-signature-consent-note">A imagem fica apenas como prévia até você marcar a opção de inclusão.</small>}
                    <div className="mem-signature-controls">
                      <button type="button" className="mem-outline" onClick={()=>{setOwnerSignaturePosition({x:0,y:0});setSaved(false);}}>Centralizar assinatura do proprietário</button>
                      <label className="mem-field"><span>Tamanho: {ownerSignatureSize}%</span><input type="range" min="30" max="180" value={ownerSignatureSize} onChange={event=>{setOwnerSignatureSize(Number(event.target.value));setSaved(false);}}/></label>
                      <label className="mem-field"><span>Posição horizontal: {ownerSignaturePosition.x}px</span><input type="range" min="-100" max="100" value={ownerSignaturePosition.x} onChange={event=>{setOwnerSignaturePosition(current=>({...current,x:Number(event.target.value)}));setSaved(false);}}/></label>
                      <label className="mem-field"><span>Posição vertical: {ownerSignaturePosition.y}px</span><input type="range" min="-100" max="100" value={ownerSignaturePosition.y} onChange={event=>{setOwnerSignaturePosition(current=>({...current,y:Number(event.target.value)}));setSaved(false);}}/></label>
                    </div>
                    <button type="button" className="mem-outline" onClick={() => { setOwnerSignatureData(''); setOwnerSignatureFileName('Nenhum arquivo selecionado'); setOwnerSignatureEnabled(false); setSaved(false); }}>Remover assinatura do proprietário</button>
                  </>}
                </section>
              </div>}

            </div>}
            </div>
            <div className="memorial-panel-footer">
              <div className="memorial-panel-utility">
                {workflowStep < 3 && <button type="button" className="mem-outline" onClick={() => { if (projectId) void selectProject(projectId); }} disabled={!projectId || loading}><RotateCcw size={15} /> Restaurar rascunho</button>}
              </div>
              <div className="memorial-panel-actions">
                {workflowStep > 1 && <button type="button" className="mem-outline" onClick={() => setWorkflowStep(step => (step - 1) as 1 | 2)}>Anterior</button>}
                {workflowStep < 3 && <button type="button" className="memorial-next-button" disabled={!projectValid} onClick={() => setWorkflowStep(step => (step + 1) as 2 | 3)}>Próximo <span aria-hidden="true">→</span></button>}
              </div>
            </div>
          </aside>

          <main className="mem-stage">
            <div className="mem-stage-toolbar">
              <strong>Prévia do documento</strong>
              <div className="mem-stage-tools">
                <span className="mem-page-size"><FileText size={14} aria-hidden="true" /> A4 (Retrato)</span>
                <button type="button" className="mem-fit-button" aria-pressed={fitToScreen} onClick={() => setFitToScreen(value => !value)}>
                  <Expand size={14} aria-hidden="true" /> {fitToScreen ? 'Tamanho original' : 'Ajustar à tela'}
                </button>
              </div>
            </div>
            <div className={`mem-stage-scroll${fitToScreen ? ' is-fit' : ''}`}>
              {loading && <div className="mem-empty"><span className="loader" /> Carregando dados...</div>}
              {!loading && !chosen.length && <div className="mem-preview-empty-state">
                <FileText size={22} strokeWidth={1.8} aria-hidden="true" />
                <strong>{projectId ? 'Selecione uma gleba' : 'A prévia será exibida aqui'}</strong>
                <span>{projectId ? 'Escolha uma gleba válida para montar o memorial.' : 'Selecione um projeto para começar.'}</span>
              </div>}
              {!loading && showAll && chosen.length > 1 && (() => {
                const first = chosen[0];
                const totalArea = chosen.reduce((total, poly) => total + poly.areaM2, 0);
                const totalPerimeter = chosen.reduce((total, poly) => total + poly.perimeterM, 0);
                const summaryOwners = ownerNames(full, fields.owner);
                const municipality = text(full?.project?.municipality || full?.project?.city);
                const uf = text(full?.project?.stateCode || full?.project?.uf);
                const municipalityUf = [municipality, uf].filter(Boolean).join(' / ');
                const shared = readSharedCroquiSettings(record(prefs.options), projectId, '__imovel_completo__', croquiUserKey, text(prefs.responsibleTechnician), false)
                  || readSharedCroquiSettings(record(prefs.options), projectId, first.id, croquiUserKey, text(prefs.responsibleTechnician), false);
                const baseOverviewSettings=shared||{...defaultCroquiSettings(text(prefs.responsibleTechnician)),exteriorCotas:true};
                const overviewSettings=applySheetLayout(first,baseOverviewSettings,sheetLayoutForProject(record(prefs.options),projectId,'__imovel_completo__'),projectDivisions,true);
                const overviewExteriorCotas=baseOverviewSettings.memorialExteriorCotas??true;
                const settings={...overviewSettings,exteriorCotas:overviewExteriorCotas,memorialExteriorCotas:overviewExteriorCotas};
                const overviewMapLink=publicMapUrl(full,first,prefs,true);
                const overviewSvg = renderCroqui(first, settings, {
                  company: text(prefs.companyName) || 'Surveyor Agrimensura',
                  mapLink: overviewMapLink, municipality: municipalityUf,
                  logo: text(prefs.logoDataUrl), owners: summaryOwners, propertyName: `${documentName} — imóvel completo`,
                  qr: showQr ? qrCodeDataUrl(overviewMapLink,3) : '',
                   divisions: projectDivisions, composite: true, date: generationDate()
                });
                return <div className="mem-document mem-project-overview">
                  <Paper className={`mem-skin-${savedModel}`} tone={applied.color}>
                    {showLogo ? <Stamp prefs={prefs} /> : <div className="mem-simple-header">{prefs.companyName || 'SURVEYOR'}</div>}
                    <h2>MEMORIAL DESCRITIVO — IMÓVEL COMPLETO</h2>
                    <div className="mem-meta">
                      <div><b>IMÓVEL</b><span>{label(documentName)}</span></div>
                      {municipalityUf && <div><b>MUNICÍPIO/UF</b><span>{municipalityUf}</span></div>}
                      <div><b>ÁREA TOTAL</b><span>{fmt(totalArea / 10000, 4)} ha · soma cadastrada</span></div>
                      <div><b>PERÍMETROS</b><span>{fmt(totalPerimeter)} m · soma cadastrada</span></div>
                      {summaryOwners.length > 0 && <div className="mem-meta-owners"><b>PROPRIETÁRIOS</b><div className="mem-meta-owner-list">{summaryOwners.map((name, i) => <div className="mem-meta-owner" key={`${name}-${i}`}><span>{name}</span></div>)}</div></div>}
                    </div>
                    <h3 className="mem-section-title">QUADRO DAS ÁREAS DO PROJETO</h3>
                    <table><thead><tr><th>Área / gleba</th><th>Área aprox. (ha)</th><th>Perímetro aprox. (m)</th></tr></thead><tbody>
                      {chosen.map(poly => <tr key={poly.id}><td>{poly.name}</td><td>{fmt(poly.areaM2 / 10000, 4)}</td><td>{fmt(poly.perimeterM)}</td></tr>)}
                      <tr><td><b>Soma cadastrada</b></td><td><b>{fmt(totalArea / 10000, 4)}</b></td><td><b>{fmt(totalPerimeter)}</b></td></tr>
                    </tbody></table>
                    <small>Os totais são somas das áreas e perímetros cadastrados. Eles podem diferir da união geométrica quando houver sobreposições ou perímetro-base duplicado; confira a topologia antes do uso oficial.</small>
                    <h3 className="mem-section-title">DESCRIÇÃO DOS PERÍMETROS COMPONENTES</h3>
                    {chosen.map((poly, i) => {
                      const draft = readSharedCroquiSettings(record(prefs.options), projectId, poly.id, croquiUserKey, text(prefs.responsibleTechnician), polygons.length === 1);
                      const names = draft ? croquiVertexNames(poly, draft) : poly.vertices.map((_, idx) => vertexName(idx));
                      return <section key={poly.id} className="mem-description"><b>{i + 1}. {poly.name}</b><p>{getPolygonNarrative(poly, names)}</p></section>;
                    })}
                    {fields.notes && <><h3 className="mem-section-title">OBSERVAÇÕES</h3><p className="mem-notes">{fields.notes}</p></>}
                    <div className="mem-page-footer"><span>{prefs.footerText || 'SURVEYOR · Memorial descritivo'}</span><span>Imóvel completo</span></div>
                  </Paper>
                  {showMap && <Paper className={`mem-skin-${savedModel} mem-paper-croqui-official`} tone={applied.color}><section className="mem-official-sheet mem-official-sheet-svg"><PortableCroquiSvg svg={overviewSvg} /><div className="mem-croqui-signatures">{hasSignature && <SignatureBox prefs={prefs} custom={signatureData} scale={signatureSize} position={signaturePosition} onMove={offset => { setSignaturePosition(offset); setSaved(false); }} />}{ownerSignatureEnabled&&summaryOwners.map((name, i) => <OwnerSignature key={`${name}-${i}`} name={name} signature={name===effectiveOwnerSignaturePerson?ownerSignatureData:undefined} scale={ownerSignatureSize} position={ownerSignaturePosition} />)}</div></section></Paper>}
                </div>;
              })()}
              {!loading && chosen.map((polygon, index) => {
                const locationUrl = publicMapUrl(full, polygon, prefs);
                const qrCodeUrl = showQr ? qrCodeDataUrl(locationUrl,3) : '';
                const signatureOnFirstPage = hasSignature && !showMap;
                const municipality = text(full?.project?.municipality || full?.project?.city);
                const uf = text(full?.project?.stateCode || full?.project?.uf);
                const municipalityUf = [municipality, uf].filter(Boolean).join(' / ');
                const allOwners=memorialOwnerDetails(full,fields);
                const ownerCpfs=allOwners.map(owner=>owner.cpf).filter(Boolean);
                const ownerRgs=allOwners.map(owner=>owner.rg).filter(Boolean);
                const owners=ownerNames(full,fields.owner);
                const glebas = polygons.filter(item => item.id !== polygon.id && String(item.properties.category || '').toLowerCase() === 'gleba');
                const markers = polygon.vertices.flatMap((vertex, vertexIndex) => {
                  const feature = full?.features.find(item => {
                    const geometry = item.geoJson || item.geometry;
                    if (geometry?.type !== 'Point' || !Array.isArray(geometry.coordinates)) return false;
                    const position = geometry.coordinates as number[];
                    return Math.abs(Number(position[0]) - vertex[0]) < 0.000001 && Math.abs(Number(position[1]) - vertex[1]) < 0.000001;
                  });
                  return feature?.properties?.hasMonument === true ? [vertexIndex] : [];
                });
                // Cada polígono recupera seu próprio croqui, mesmo ao gerar 'Todos'.
                const syncedCroquiSettings = readSharedCroquiSettings(
                  record(prefs.options), projectId, polygon.id, croquiUserKey,
                  text(prefs.responsibleTechnician), polygons.length===1
                );
                const vertexNamesInMemorial = syncedCroquiSettings ? croquiVertexNames(polygon,syncedCroquiSettings) : polygon.vertices.map((_,i)=>vertexName(i));
                const baseCroquiSettings = syncedCroquiSettings || defaultCroquiSettings(text(prefs.responsibleTechnician));
                if (!syncedCroquiSettings) {
                  const pProps = record(polygon.properties);
                  const {fill:mapFill,stroke:mapStroke} = polygonSourceColors(pProps);
                  if (mapFill) baseCroquiSettings.polygonFill = mapFill;
                  if (mapStroke) baseCroquiSettings.polygonStroke = mapStroke;
                }
                const croquiSettings=combineCroquiConfrontants(polygon,
                  baseCroquiSettings,
                  readSharedConfrontants(record(prefs.options),projectId,polygon.id),
                  hasPendingCroquiDraft(croquiUserKey,projectId,polygon.id) ||
                  resolveSharedCroquiSettings(record(prefs.options),projectId,polygon.id,croquiUserKey).source==='local-newer');
                const gName = polygon.name?.trim() || `Gleba ${index + 1}`;
                const polyDocumentName = polygons.length > 1 && gName.toLowerCase() !== documentName.toLowerCase() ? `${documentName} — ${gName}` : documentName;
                // Preserve the style saved in Mapas e Croquis until this user explicitly selects another background.
                // A prancha salva fornece as personalizações comuns (rótulos, cores,
                // servidões, cotas e vértices) também para o croqui do Memorial.
                const sharedSheet=sheetLayoutForProject(record(prefs.options),projectId,polygon.id,polygons.length>1);
                const individualSheet=readSheetLayout(record(prefs.options),projectId,polygon.id);
                const sharedCroqui=applySheetLayout(polygon,croquiSettings,sharedSheet,readProjectDivisions(full?.features||[]),false,!individualSheet&&Boolean(sharedSheet));
                // O croqui salvo é a fonte de verdade para a aparência cartográfica.
                // A Prancha ainda contribui com elementos específicos de folha e sobreposições.
                const unifiedCroqui=syncedCroquiSettings?{...sharedCroqui,
                  polygonFill:croquiSettings.polygonFill,
                  polygonFillOpacity:croquiSettings.polygonFillOpacity,
                  polygonStroke:croquiSettings.polygonStroke,
                  polygonStrokeWidth:croquiSettings.polygonStrokeWidth,
                  featureStyles:{...sharedCroqui.featureStyles,...croquiSettings.featureStyles},
                  featureNames:{...sharedCroqui.featureNames,...croquiSettings.featureNames},
                  labelOffsets:{...sharedCroqui.labelOffsets,...croquiSettings.labelOffsets},
                  absoluteLabels:{...sharedCroqui.absoluteLabels,...croquiSettings.absoluteLabels},
                  labelColors:{...sharedCroqui.labelColors,...croquiSettings.labelColors},
                  labelAngles:{...sharedCroqui.labelAngles,...croquiSettings.labelAngles},
                  labelSizes:{...sharedCroqui.labelSizes,...croquiSettings.labelSizes},
                  mapNames:croquiSettings.mapNames,
                }:sharedCroqui;
                const configuredCroqui=unifiedCroqui;
                const visibleSettings=configuredCroqui;
                const individualDivisions=projectDivisions.filter(part=>part.featureId===String(polygon.properties.sourceFeatureId||polygon.id)&&part.partIndex===Number(polygon.properties.partIndex||0));
                const croquiSvg=renderCroqui(polygon,visibleSettings,{
                  company:text(prefs.companyName)||'Surveyor Agrimensura',mapLink:locationUrl,
                  municipality:municipalityUf,logo:text(prefs.logoDataUrl),owners,propertyName:polyDocumentName,qr:showQr?qrCodeUrl:'',
                   glebas,divisions:individualDivisions,markers,date:generationDate()
                });
                return <div key={`${polygon.id}-${index}`} className="mem-document">
                  <Paper className={`mem-skin-${savedModel}`} tone={applied.color}>
                    {savedModel !== 'standard' && <div className="mem-title-mark"><svg viewBox="0 0 800 80" preserveAspectRatio="none"><path d="M0 0 H800 V35 C530 66 230 18 0 55 Z" fill="var(--mem-tone)" opacity=".83" /><path d="M0 0 H800 V18 C530 50 230 8 0 31 Z" fill="var(--mem-tone)" /></svg></div>}
                    {showLogo ? <Stamp prefs={prefs} /> : <div className="mem-simple-header">{prefs.companyName || 'SURVEYOR'}</div>}
                    <h2>MEMORIAL DESCRITIVO</h2>
                    <div className="mem-meta">
                      <div><b>IMÓVEL</b><span>{label(polyDocumentName)}</span></div>
                      {municipalityUf&&<div><b>MUNICÍPIO/UF</b><span>{municipalityUf}</span></div>}
                      {allOwners.length > 0 && <div className="mem-meta-owners">
                        <b>PROPRIETÁRIOS</b>
                        <div className="mem-meta-owner-list">
                          {allOwners.map((owner, ownerIndex) => <div className="mem-meta-owner" key={`${owner.name}-${ownerIndex}`}>
                            <span>{owner.name}</span>
                          </div>)}
                        </div>
                      </div>}
                      {ownerCpfs.length>0&&<div className="mem-meta-documents"><b>CPF/CNPJ</b><div className="mem-meta-document-values">{ownerCpfs.map((cpf,index)=><span key={`${cpf}-${index}`}>{cpf}</span>)}</div></div>}
                      {ownerRgs.length>0&&<div className="mem-meta-documents"><b>RG</b><div className="mem-meta-document-values">{ownerRgs.map((rg,index)=><span key={`${rg}-${index}`}>{rg}</span>)}</div></div>}
                      {fields.reference.trim()&&<div><b>DOCUMENTO</b><span>{fields.kind} {fields.reference}</span></div>}
                      <div><b>ÁREA</b><span>{fmt(polygon.areaM2 / 10000, 4)} ha</span></div>
                      <div><b>PERÍMETRO</b><span>{fmt(polygon.perimeterM)} m</span></div>
                    </div>
                    {(fields.incra || fields.cib || fields.district) && <div className="mem-codes">
                      {fields.incra && <div><b>INCRA:</b> {fields.incra}</div>}
                      {fields.cib && <div><b>CIB:</b> {fields.cib}</div>}
                      {fields.district && <div><b>COMARCA:</b> {fields.district}</div>}
                    </div>}
                    <h3 className="mem-section-title">DESCRIÇÃO DO PERÍMETRO</h3>
                    <div className="mem-description"><p>{getPolygonNarrative(polygon,vertexNamesInMemorial)}</p></div>
                    {fields.notes && <><h3 className="mem-section-title">OBSERVAÇÕES</h3><p className="mem-notes">{fields.notes}</p></>}
                    {showVertexTable && <div className="mem-corners">
                      <h3 className="mem-section-title">QUADRO DE VÉRTICES</h3>
                      <table>
                        <thead><tr><th>Vértice</th>{coordMode !== 'utm' && <><th>Latitude (WGS 84)</th><th>Longitude (WGS 84)</th></>}{coordMode !== 'wgs84' && <><th>Este E (m)</th><th>Norte N (m)</th><th>Fuso</th></>}<th>Trecho seguinte</th></tr></thead>
                        <tbody>{polygon.vertices.map((vertex, vertexIndex) => {
                          let utm = { east: NaN, north: NaN, zone: 0, hemisphere: 'S' as 'S' | 'N' };
                          if (coordMode !== 'wgs84') {
                            try { utm = utmFromWgs84([vertex[0], vertex[1]]); } catch { /* fallback */ }
                          }
                          return <tr key={vertexIndex}>
                            <td>{vertexNamesInMemorial[vertexIndex]}</td>
                            {coordMode !== 'utm' && <><td>{vertex[1].toFixed(7)}°</td><td>{vertex[0].toFixed(7)}°</td></>}
                            {coordMode !== 'wgs84' && <><td>{Number.isFinite(utm.east) ? fmt(utm.east, 3) : '—'}</td><td>{Number.isFinite(utm.north) ? fmt(utm.north, 3) : '—'}</td><td>{utm.zone ? `${utm.zone}${utm.hemisphere}` : '—'}</td></>}
                            <td>{fmt(distance(vertex, polygon.vertices[(vertexIndex + 1) % polygon.vertices.length]))} m · {formatAzimuth(azimuth(vertex, polygon.vertices[(vertexIndex + 1) % polygon.vertices.length]))}</td>
                          </tr>;
                        })}</tbody>
                      </table>
                    </div>}
                    {signatureOnFirstPage && <SignatureBox prefs={prefs} custom={signatureData} scale={signatureSize} position={signaturePosition} onMove={offset=>{setSignaturePosition(offset);setSaved(false);}} />}
                    <div className="mem-page-footer"><span>{prefs.footerText || 'SURVEYOR · Memorial descritivo'}</span><span>Página 1 {showMap ? 'de 2' : 'de 1'}</span></div>
                    {savedModel !== 'standard' && <div className="mem-footer-brand"><svg viewBox="0 0 800 70" preserveAspectRatio="none"><path d="M0 46 C280 -8 570 48 800 8 L800 70 H0 Z" fill="var(--mem-tone)" /><path d="M0 57 C310 15 590 50 800 22 L800 70 H0 Z" fill="var(--mem-tone)" opacity=".55" /></svg></div>}
                  </Paper>

                  {showMap && <Paper className={`mem-skin-${savedModel} mem-paper-croqui-official`} tone={applied.color}>
                    <section className="mem-official-sheet mem-official-sheet-svg">
                      <PortableCroquiSvg svg={croquiSvg} onPointerDown={event=>beginMapLabelDrag(event,polygon,croquiSettings)} onPointerMove={moveMapLabelDrag} onPointerUp={finishMapLabelDrag} onPointerCancel={cancelMapLabelDrag}/>
                      <div className="mem-croqui-signatures">
                        {hasSignature && <SignatureBox prefs={prefs} custom={signatureData} scale={signatureSize} position={signaturePosition} onMove={offset=>{setSignaturePosition(offset);setSaved(false);}} />}
                        {ownerSignatureEnabled&&owners.map((name, ownerIndex) => <OwnerSignature key={`${name}-${ownerIndex}`} name={name} signature={name===effectiveOwnerSignaturePerson?ownerSignatureData:undefined} scale={ownerSignatureSize} position={ownerSignaturePosition} />)}
                      </div>
                    </section>
                  </Paper>}
                </div>;
              })}
            </div>
          </main>
        </div>
      </div>
    </div>
  </main>;
}
