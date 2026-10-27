import { hiddenVertexIndexes, largestRing, localMeters, metrics } from './geometry.js';
import type { EngineOptions, EngineScene, LabelOffsetMap, TechnicalGuide, TechnicalProject } from './types.js';

const escapeXml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch] || ch));

const fmt = (value: number, digits = 2) => Number(value || 0).toLocaleString('pt-BR', {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits
});

interface Pt { x: number; y: number; }
interface Box { x: number; y: number; w: number; h: number; }

function fitPoints(points: Pt[], box: Box, padding = 46): Pt[] {
  if (!points.length) return [];
  const xs = points.map((p) => p.x); const ys = points.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = Math.max(1e-9, maxX - minX), spanY = Math.max(1e-9, maxY - minY);
  const scale = Math.min((box.w - padding * 2) / spanX, (box.h - padding * 2) / spanY);
  const usedW = spanX * scale, usedH = spanY * scale;
  const ox = box.x + (box.w - usedW) / 2, oy = box.y + (box.h - usedH) / 2;
  return points.map((p) => ({ x: ox + (p.x - minX) * scale, y: oy + (p.y - minY) * scale }));
}

function transformMap(points: Pt[], box: Box, scale: number, dx: number, dy: number): Pt[] {
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  return points.map((p) => ({ x: cx + (p.x - cx) * scale + dx, y: cy + (p.y - cy) * scale + dy }));
}

function pathFrom(points: Pt[]): string {
  return points.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(3)} ${p.y.toFixed(3)}`).join(' ') + ' Z';
}

function wrapped(text: unknown, x: number, y: number, maxChars: number, size: number, opts: {anchor?: string; weight?: number; lines?: number; lineHeight?: number} = {}): string {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  const lines: string[] = []; let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxChars || !line) line = candidate;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  const maxLines = opts.lines ?? 2;
  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines && shown.length) shown[shown.length - 1] = shown[shown.length - 1].replace(/.{1,3}$/, '…');
  const lh = opts.lineHeight ?? size * 1.15;
  return `<text x="${x}" y="${y}" text-anchor="${opts.anchor || 'start'}" font-size="${size}" font-weight="${opts.weight || 400}" fill="#111827">${shown.map((ln, i) => `<tspan x="${x}" dy="${i ? lh : 0}">${escapeXml(ln)}</tspan>`).join('')}</text>`;
}

function northArrow(x: number, y: number, scale = 1): string {
  return `<g transform="translate(${x} ${y}) scale(${scale})"><text x="0" y="-36" text-anchor="middle" font-size="18" font-weight="600" fill="#111827">N</text><circle cx="0" cy="0" r="28" fill="#fff" stroke="#111827" stroke-width="2"/><path d="M0,-22 L9,0 L0,22 L-9,0 Z" fill="#fff" stroke="#111827" stroke-width="1.7"/><path d="M0,-22 L9,0 L0,5 L-9,0 Z" fill="#111827"/><text x="35" y="5" font-size="13">E</text><text x="-40" y="5" font-size="13">W</text><text x="-4" y="43" font-size="13">S</text></g>`;
}

function scaleBar(x: number, y: number, w: number): string {
  const seg = w / 4;
  return `<g><rect x="${x}" y="${y}" width="${seg}" height="10" fill="#111827"/><rect x="${x+seg}" y="${y}" width="${seg}" height="10" fill="#fff" stroke="#111827"/><rect x="${x+seg*2}" y="${y}" width="${seg}" height="10" fill="#111827"/><rect x="${x+seg*3}" y="${y}" width="${seg}" height="10" fill="#fff" stroke="#111827"/><line x1="${x}" y1="${y+10}" x2="${x+w}" y2="${y+10}" stroke="#111827"/><text x="${x}" y="${y+27}" font-size="9">0</text><text x="${x+seg}" y="${y+27}" font-size="9" text-anchor="middle">50</text><text x="${x+seg*2}" y="${y+27}" font-size="9" text-anchor="middle">100</text><text x="${x+seg*3}" y="${y+27}" font-size="9" text-anchor="middle">150</text><text x="${x+w}" y="${y+27}" font-size="9" text-anchor="end">200</text><text x="${x+w+24}" y="${y+10}" font-size="10">m</text></g>`;
}

function gridSvg(ring: readonly (readonly [number, number])[], mapBox: Box): string {
  const pts = ring.slice(0, -1);
  if (!pts.length) return '';
  const lons = pts.map((p) => p[0]), lats = pts.map((p) => p[1]);
  const minLon=Math.min(...lons), maxLon=Math.max(...lons), minLat=Math.min(...lats), maxLat=Math.max(...lats);
  let out = '<g class="te-grid" font-family="Arial,Helvetica,sans-serif">';
  for (let i=0;i<6;i++) {
    const t=i/5, x=mapBox.x+t*mapBox.w, lon=minLon+t*(maxLon-minLon);
    out += `<line x1="${x}" y1="${mapBox.y}" x2="${x}" y2="${mapBox.y+mapBox.h}" stroke="#8aa3bb" stroke-width="1" stroke-dasharray="7 8" opacity=".75"/><text x="${x}" y="${mapBox.y+mapBox.h+20}" text-anchor="middle" font-size="8.5" fill="#334155">${lon.toFixed(4).replace('.',',')}</text>`;
  }
  for (let i=0;i<6;i++) {
    const t=i/5, y=mapBox.y+t*mapBox.h, lat=maxLat-t*(maxLat-minLat);
    out += `<line x1="${mapBox.x}" y1="${y}" x2="${mapBox.x+mapBox.w}" y2="${y}" stroke="#8aa3bb" stroke-width="1" stroke-dasharray="7 8" opacity=".75"/><text x="${mapBox.x-14}" y="${y+3}" text-anchor="end" font-size="8.5" fill="#334155" transform="rotate(-90 ${mapBox.x-14} ${y+3})">${lat.toFixed(4).replace('.',',')}</text>`;
  }
  return out + '</g>';
}

function miniPath(local: Pt[], box: Box): string {
  const fitted = fitPoints(local, box, 24);
  return `<path d="${pathFrom(fitted)}" fill="#f3c410" fill-opacity=".10" stroke="#d39f00" stroke-width="1.5"/>`;
}

function renderGuides(guides: TechnicalGuide[], textScale: number): string {
  if (!Array.isArray(guides) || !guides.length) return '';
  return guides.map((guide) => {
    const x1 = Number(guide.x1) || 0;
    const y1 = Number(guide.y1) || 0;
    const x2 = Number(guide.x2) || 0;
    const y2 = Number(guide.y2) || 0;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const label = String(guide.label || '').trim();
    const labelSize = 11 * Math.max(0.75, Math.min(1.8, textScale || 1));
    const dash = guide.style === 'solid' ? '' : ' stroke-dasharray="8 6"';
    const text = guide.showLabel === false || !label ? '' : `<text x="${mx.toFixed(3)}" y="${(my - 6).toFixed(3)}" text-anchor="middle" font-size="${labelSize.toFixed(2)}" font-weight="500" fill="#1f2937" paint-order="stroke" stroke="#ffffff" stroke-width="3" stroke-linejoin="round">${escapeXml(label)}</text>`;
    return `<g class="te-guide" data-guide-id="${escapeXml(guide.id || '')}"><line x1="${x1.toFixed(3)}" y1="${y1.toFixed(3)}" x2="${x2.toFixed(3)}" y2="${y2.toFixed(3)}" stroke="#111827" stroke-width="1.35"${dash} />${text}</g>`;
  }).join('');
}

export function renderTechnicalSheet(project: TechnicalProject, options: EngineOptions, offsets: LabelOffsetMap = {}): EngineScene {
  const ring = largestRing(project.geometry);
  if (ring.length < 4) throw new Error('Projeto sem perímetro poligonal válido.');
  const local = localMeters(ring);
  const stats = metrics(project);
  const hidden = hiddenVertexIndexes(project, ring);

  // Mesma composição visual da prancha técnica original, mas renderizada pela engine V2.
  const W=1600, H=1000;
  const frame={x:18,y:18,w:1564,h:956};
  const fold={x:18,y:18,w:72,h:956};
  const mapBox={x:112,y:40,w:800,h:845};
  const panel={x:930,y:30,w:622,h:930};
  const base = fitPoints(local, mapBox, 70);
  const fitted = transformMap(base, mapBox, options.mapScale || 1, options.mapOffsetX || 0, options.mapOffsetY || 0);

  const textScale=Math.max(.75, Math.min(1.6, options.textScale || 1));
  const lineScale=Math.max(.65, Math.min(2, options.lineScale || 1));
  const vertexFont = 10.5 * Math.max(.65, Math.min(2.5, options.vertexScale || 1)) * textScale;
  const polygonFill = options.polygonFill ? '#f3c410' : 'none';
  const fillOpacity = options.polygonFill ? '.16' : '0';
  const guides = Array.isArray(options.guides) ? options.guides : [];

  const vertices = fitted.slice(0,-1).map((point,index)=>{
    if (hidden.has(index) || !options.showVertices) return '';
    const key=`V-${String(index+1).padStart(2,'0')}`;
    const o=offsets[key] || {dx:0,dy:0};
    const x=point.x+7+o.dx, y=point.y-7+o.dy;
    return `<g class="te-vertex" data-vertex="${key}"><circle cx="${point.x.toFixed(3)}" cy="${point.y.toFixed(3)}" r="1.8" fill="#111827"/><text class="te-vertex-label" data-label-key="${key}" data-base-x="${(point.x+7).toFixed(3)}" data-base-y="${(point.y-7).toFixed(3)}" x="${x.toFixed(3)}" y="${y.toFixed(3)}" font-size="${vertexFont.toFixed(2)}" font-weight="600" fill="#111827" paint-order="stroke" stroke="#ffffff" stroke-width="3" stroke-linejoin="round">${key}</text></g>`;
  }).join('');

  const property=project.title || 'Imóvel rural';
  const owner=project.owner || 'Não informado';
  const cityUf=[project.city,project.uf].filter(Boolean).join('/') || 'Não informado';
  const comarca=project.district || project.city || 'Não informado';
  const registry=project.registryOffice || 'Não informado';
  const incra=project.incra || 'Não informado';
  const date=new Date().toLocaleDateString('pt-BR');
  const title=(options.title || 'PLANTA DO IMÓVEL GEORREFERENCIADO').replace(/\s*[—-]\s*V2\s*$/i,'');
  const fs=(n:number)=>n*textScale;
  const mini={x:panel.x+28,y:634,w:330,h:180};

  const svg=`<svg class="georef-sheet-svg surveyor-technical-sheet-v2" xmlns="http://www.w3.org/2000/svg" width="297mm" height="185.625mm" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" font-family="Segoe UI,Arial,Helvetica,sans-serif" data-engine="technical-engine-v0.3">
    <rect width="${W}" height="${H}" fill="#f8fafc"/>
    <rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.h}" fill="#fff" stroke="#111827" stroke-width="3"/>
    <path d="M${fold.x},${fold.y+62} L${fold.x+64},${fold.y+6} L${fold.x+64},${fold.y+frame.h-6} L${fold.x},${fold.y+frame.h-62}" fill="#fff" stroke="#111827" stroke-width="1.5"/>
    <line x1="${fold.x}" y1="${fold.y+frame.h/2}" x2="${fold.x+64}" y2="${fold.y+frame.h/2}" stroke="#111827"/>

    <rect class="te-map-frame" data-map-x="${mapBox.x}" data-map-y="${mapBox.y}" data-map-w="${mapBox.w}" data-map-h="${mapBox.h}" x="${mapBox.x}" y="${mapBox.y}" width="${mapBox.w}" height="${mapBox.h}" fill="#f8fafc" stroke="#111827" stroke-width="1.4"/>
    ${gridSvg(ring,mapBox)}
    <defs><clipPath id="teMapClip"><rect x="${mapBox.x}" y="${mapBox.y}" width="${mapBox.w}" height="${mapBox.h}"/></clipPath></defs>
    <g clip-path="url(#teMapClip)" class="te-map-layer">
      <path d="${pathFrom(fitted)}" fill="${polygonFill}" fill-opacity="${fillOpacity}" stroke="#d39f00" stroke-width="${(1.55*lineScale).toFixed(2)}" stroke-linejoin="round"/>
      ${renderGuides(guides, options.guideLabelScale || textScale)}
      ${vertices}
    </g>
    ${options.showNorth ? northArrow(mapBox.x+72,mapBox.y+110,1) : ''}
    ${options.showScale ? `<text x="${mapBox.x+mapBox.w/2}" y="${mapBox.y+mapBox.h+31}" text-anchor="middle" font-size="${fs(13)}">Escala Gráfica ${escapeXml(options.scaleText)}</text>${scaleBar(mapBox.x+90,mapBox.y+mapBox.h+50,560)}` : ''}

    <rect x="${panel.x}" y="${panel.y}" width="${panel.w}" height="${panel.h}" fill="#fff" stroke="#111827" stroke-width="2"/>
    <rect x="${panel.x+34}" y="${panel.y+12}" width="410" height="76" rx="3" fill="#fff" stroke="#111827" stroke-width="1.2"/>
    ${wrapped('Surveyor',panel.x+239,panel.y+54,30,fs(18),{anchor:'middle',weight:700,lines:1})}
    <image href="/assets/georural-icon.png" x="${panel.x+482}" y="${panel.y+12}" width="86" height="76" preserveAspectRatio="xMidYMid meet"/>

    <rect x="${panel.x+16}" y="${panel.y+106}" width="430" height="84" rx="18" fill="#fff" stroke="#111827" stroke-width="2"/>
    <text x="${panel.x+231}" y="${panel.y+158}" text-anchor="middle" font-size="${fs(20)}" fill="#111827">${escapeXml(title)}</text>
    <rect x="${panel.x+462}" y="${panel.y+106}" width="142" height="84" rx="18" fill="#fff" stroke="#111827" stroke-width="2"/>
    <text x="${panel.x+533}" y="${panel.y+136}" text-anchor="middle" font-size="${fs(16)}">Folha:</text>
    <text x="${panel.x+533}" y="${panel.y+166}" text-anchor="middle" font-size="${fs(17)}" font-weight="600">${escapeXml(options.sheetNumber)}</text>

    <rect x="${panel.x+16}" y="${panel.y+206}" width="588" height="214" rx="18" fill="#fff" stroke="#111827" stroke-width="2"/>
    <g font-size="${fs(14)}" fill="#111827">
      <text x="${panel.x+34}" y="${panel.y+232}" font-weight="600">IMÓVEL:</text>${wrapped(property,panel.x+126,panel.y+232,38,fs(14),{lines:1})}
      <text x="${panel.x+34}" y="${panel.y+255}" font-weight="600">PROPRIETÁRIO:</text>${wrapped(owner,panel.x+176,panel.y+255,34,fs(14),{lines:1})}
      <text x="${panel.x+34}" y="${panel.y+278}" font-weight="600">MUNICÍPIO/UF:</text><text x="${panel.x+162}" y="${panel.y+278}">${escapeXml(cityUf)}</text>
      <text x="${panel.x+34}" y="${panel.y+301}" font-weight="600">COMARCA:</text><text x="${panel.x+130}" y="${panel.y+301}">${escapeXml(comarca)}</text>
      <text x="${panel.x+34}" y="${panel.y+324}" font-weight="600">CARTÓRIO:</text>${wrapped(registry,panel.x+130,panel.y+324,42,fs(14),{lines:1})}
      <text x="${panel.x+34}" y="${panel.y+347}" font-weight="600">DOCUMENTO:</text><text x="${panel.x+150}" y="${panel.y+347}">${escapeXml(project.registration || 'Não informado')}</text>
      <text x="${panel.x+34}" y="${panel.y+370}" font-weight="600">CÓDIGO INCRA:</text><text x="${panel.x+174}" y="${panel.y+370}">${escapeXml(incra)}</text>
      <line x1="${panel.x+28}" y1="${panel.y+384}" x2="${panel.x+592}" y2="${panel.y+384}" stroke="#111827" stroke-opacity=".45"/>
      <text x="${panel.x+34}" y="${panel.y+402}" font-weight="600">ÁREA:</text><text x="${panel.x+94}" y="${panel.y+402}">${fmt(stats.areaHa,4)} ha</text>
      <text x="${panel.x+290}" y="${panel.y+402}" font-weight="600">PERÍMETRO:</text><text x="${panel.x+405}" y="${panel.y+402}">${fmt(stats.perimeterM,2)} m</text>
      <text x="${panel.x+34}" y="${panel.y+416}" font-size="${fs(13)}" font-weight="600">DATA:</text><text x="${panel.x+92}" y="${panel.y+416}" font-size="${fs(13)}">${date}</text>
      <text x="${panel.x+290}" y="${panel.y+416}" font-size="${fs(13)}" font-weight="600">ESCALA:</text><text x="${panel.x+366}" y="${panel.y+416}" font-size="${fs(13)}">${escapeXml(options.scaleText)}</text>
    </g>

    <rect x="${panel.x+16}" y="${panel.y+438}" width="588" height="112" rx="18" fill="#fff" stroke="#111827" stroke-width="2"/>
    <text x="${panel.x+32}" y="${panel.y+462}" font-size="${fs(13)}">Quadro de Assinaturas Proprietário(s):</text>
    <line x1="${panel.x+142}" y1="${panel.y+506}" x2="${panel.x+478}" y2="${panel.y+506}" stroke="#111827"/>
    ${wrapped(owner,panel.x+310,panel.y+536,44,fs(12),{anchor:'middle',lines:1})}

    <rect x="${panel.x+16}" y="${panel.y+570}" width="366" height="270" rx="18" fill="#fff" stroke="#111827" stroke-width="2"/>
    <text x="${panel.x+199}" y="${panel.y+594}" text-anchor="middle" font-size="${fs(15)}" font-weight="600">PLANTA DE SITUAÇÃO</text>
    <rect x="${mini.x}" y="${mini.y}" width="${mini.w}" height="${mini.h}" fill="#f8fafc" stroke="#111827" stroke-width="1.5"/>
    ${miniPath(local,mini)}
    <text x="${mini.x+8}" y="${mini.y+mini.h-9}" font-size="${fs(9)}" fill="#334155">Referência cartográfica</text>

    <rect x="${panel.x+396}" y="${panel.y+570}" width="208" height="270" rx="18" fill="#fff" stroke="#111827" stroke-width="2"/>
    <text x="${panel.x+500}" y="${panel.y+590}" text-anchor="middle" font-size="${fs(11)}" font-weight="600">Quadro de Áreas</text>
    <text x="${panel.x+500}" y="${panel.y+604}" text-anchor="middle" font-size="${fs(11)}" font-weight="600">e Perímetros</text>
    <text x="${panel.x+422}" y="${panel.y+630}" font-size="${fs(12)}">Área(ha)</text><text x="${panel.x+512}" y="${panel.y+630}" font-size="${fs(12)}">Perímetro(m)</text>
    <text x="${panel.x+414}" y="${panel.y+654}" font-size="${fs(12)}">Total:</text><text x="${panel.x+460}" y="${panel.y+654}" font-size="${fs(12)}">${fmt(stats.areaHa,4)}</text><text x="${panel.x+536}" y="${panel.y+654}" font-size="${fs(12)}">${fmt(stats.perimeterM,2)}</text>
    <text x="${panel.x+414}" y="${panel.y+724}" font-size="${fs(10.5)}">Resp. Técnico:</text>
    <line x1="${panel.x+430}" y1="${panel.y+766}" x2="${panel.x+574}" y2="${panel.y+766}" stroke="#111827"/>
    ${wrapped(project.technician || 'Não informado',panel.x+502,panel.y+810,20,fs(11),{anchor:'middle',weight:600,lines:1})}

    <rect x="${panel.x+16}" y="${panel.y+856}" width="588" height="86" rx="18" fill="#fff" stroke="#111827" stroke-width="2"/>
    <text x="${panel.x+36}" y="${panel.y+880}" font-size="${fs(12)}" font-weight="600">Local do Imóvel:</text>
    <rect x="${panel.x+36}" y="${panel.y+890}" width="44" height="44" fill="#fff" stroke="#cbd5e1"/>
    <text x="${panel.x+58}" y="${panel.y+916}" text-anchor="middle" font-size="${fs(8)}" fill="#64748b">QR V2</text>
    <text x="${panel.x+96}" y="${panel.y+900}" font-size="${fs(8.5)}" font-weight="600">Link público:</text>
    <text x="${panel.x+96}" y="${panel.y+916}" font-size="${fs(7.4)}" fill="#475569">Engine V2 — integração pública será reutilizada da prancha oficial</text>
  </svg>`;

  return { svg, metrics: stats, labelOffsets: offsets };
}
