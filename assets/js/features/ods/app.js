(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  if (!$('sheetProjectSelect')) return;

  let projects = [];
  let rows = [];
  let current = null;

  const select = $('sheetProjectSelect');
  const toast = (message, type = 'error') => { if (window.GeoRuralSuite?.toast) return window.GeoRuralSuite.toast(message, type); if (window.SurveyorToast) return window.SurveyorToast(message, type); console[type === 'error' ? 'error' : 'log'](message); };
  const escapeHtml = (value = '') => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const escapeXml = escapeHtml;

  const appendProjectOption = (project) => {
    if (!project?.id) return;
    const title = project.title || project.name || project.propertyName || 'Projeto sem nome';
    const city = project.city || project.municipality || '';
    const uf = project.uf || project.stateCode || '';
    if (![...select.options].some((option) => option.value === project.id)) {
      select.add(new Option(`${title}${city ? ` — ${city}/${uf || ''}` : ''}`, project.id));
    }
  };

  async function loadProjects() {
    projects = await window.GeoRuralProjects.list({ full: false, refresh: false });
    projects.forEach(appendProjectOption);
    const requested = new URLSearchParams(location.search).get('project');
    if (requested && [...select.options].some((option) => option.value === requested)) {
      select.value = requested;
      select.dispatchEvent(new Event('change'));
    } else if (select.options.length > 1) {
      select.selectedIndex = 1;
      select.dispatchEvent(new Event('change'));
    }
  }

  async function resolveProject(id) {
    if (!id) return null;
    let project = projects.find((item) => item.id === id && item.geojson);
    if (!project) {
      project = await window.GeoRuralProjects.get(id);
      if (!project) return null;
      const index = projects.findIndex((item) => item.id === id);
      if (index >= 0) projects[index] = project; else projects.push(project);
      appendProjectOption(project);
    }
    return globalThis.SurveyorDocumentScope?.apply?.(project) || project;
  }

  const perimeter = (project) => globalThis.SurveyorProjectGeometry?.resolvePerimeter?.(project)
    || project?.geojson?.features?.filter((feature) => /Polygon/.test(feature?.geometry?.type || '')).sort((a,b)=>(globalThis.turf?.area?.(b)||0)-(globalThis.turf?.area?.(a)||0))[0] || null;

  const ring = (project) => perimeter(project)?.geometry?.coordinates?.[0] || [];
  const hav = (a, b) => {
    const R = 6371008.8;
    const r = (x) => x * Math.PI / 180;
    const dlat = r(b[1] - a[1]);
    const dlon = r(b[0] - a[0]);
    const q = Math.sin(dlat / 2) ** 2 + Math.cos(r(a[1])) * Math.cos(r(b[1])) * Math.sin(dlon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(q));
  };
  const bearing = (a, b) => {
    const r = (x) => x * Math.PI / 180;
    const d = (x) => (x * 180 / Math.PI + 360) % 360;
    const y = Math.sin(r(b[0] - a[0])) * Math.cos(r(b[1]));
    const x = Math.cos(r(a[1])) * Math.sin(r(b[1])) - Math.sin(r(a[1])) * Math.cos(r(b[1])) * Math.cos(r(b[0] - a[0]));
    return d(Math.atan2(y, x));
  };
  const dms = (v, secDigits = 2) => {
    const sign = v < 0 ? '-' : '';
    const a = Math.abs(v);
    const d = Math.floor(a);
    const m = Math.floor((a - d) * 60);
    const s = ((a - d - m / 60) * 3600).toFixed(secDigits);
    return `${sign}${d}° ${String(m).padStart(2, '0')}' ${s.padStart(2 + secDigits + 1, '0')}"`;
  };
  const utm = (lng, lat) => {
    const zone = Math.floor((lng + 180) / 6) + 1;
    const south = lat < 0;
    const proj = `+proj=utm +zone=${zone} ${south ? '+south ' : ''}+datum=WGS84 +units=m +no_defs`;
    const out = window.proj4 ? proj4('EPSG:4326', proj, [lng, lat]) : [0, 0];
    return { e: out[0], n: out[1], zone: `${zone}${south ? 'S' : 'N'}` };
  };

  function formatCoord(row, format) {
    const u = utm(row.lng, row.lat);
    if (format === 'graus') return { lon: row.lng.toFixed(8), lat: row.lat.toFixed(8), e: '—', n: '—', quad: u.zone };
    if (format === 'gms') return { lon: dms(row.lng, 0), lat: dms(row.lat, 0), e: '—', n: '—', quad: u.zone };
    if (format === 'gmsss') return { lon: dms(row.lng, 2), lat: dms(row.lat, 2), e: '—', n: '—', quad: u.zone };
    return {
      lon: row.lng.toFixed(8),
      lat: row.lat.toFixed(8),
      e: u.e.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      n: u.n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      quad: u.zone
    };
  }

  function buildRows(project) {
    const coords = ring(project);
    const sameCoord = (a, b, eps = 1e-7) => Array.isArray(a) && Array.isArray(b)
      && Math.abs(Number(a[0]) - Number(b[0])) <= eps
      && Math.abs(Number(a[1]) - Number(b[1])) <= eps;
    // GeoJSON fecha anéis repetindo a primeira coordenada. Alguns projetos
    // históricos possuem pequenas diferenças de ponto flutuante nesse fechamento;
    // para a planilha isso NÃO é um quinto vértice técnico.
    const open = coords.length > 1 && sameCoord(coords[0], coords.at(-1)) ? coords.slice(0, -1) : coords;
    const confrontantes = perimeter(project)?.properties?.confrontantes || [];
    return open.map((coord, i) => {
      const next = open[(i + 1) % open.length] || coord;
      const link = confrontantes.find((item) => Number(item.segmentIndex) === i) || confrontantes[i] || {};
      return {
        code: `Vértice-${i + 1}`,
        lng: coord[0],
        lat: coord[1],
        az: open.length > 1 ? bearing(coord, next) : 0,
        distance: open.length > 1 ? hav(coord, next) : 0,
        neighbor: link.nome || '',
        limit: link.tipoLimite || ''
      };
    });
  }

  function setEmptyState(message = 'Selecione um projeto.') {
    $('sheetBody').innerHTML = '';
    $('sheetArea').textContent = '0,0000';
    $('sheetPerimeter').textContent = '0,00';
    $('ownerSummary').textContent = message;
    $('neighborsBody').innerHTML = `<tr><td colspan="5">${escapeHtml(message)}</td></tr>`;
    $('odsStatus').textContent = message;
  }

  function render() {
    if (!current) {
      setEmptyState();
      return;
    }
    const format = $('coordinateFormat')?.value || 'sigef';
    const body = rows.map((row) => {
      const c = formatCoord(row, format);
      return `<tr><td>${escapeHtml(row.code)}</td><td>${escapeHtml(c.lon)}</td><td>${escapeHtml(c.lat)}</td><td>${escapeHtml(c.e)}</td><td>${escapeHtml(c.n)}</td><td>${escapeHtml(c.quad)}</td><td>${row.az.toFixed(4)}°</td><td>${row.distance.toFixed(2)}</td><td>${escapeHtml(row.neighbor || '—')}</td><td>${escapeHtml(row.limit || '—')}</td></tr>`;
    }).join('');
    $('sheetBody').innerHTML = body || '<tr><td colspan="10">O projeto selecionado ainda não possui perímetro desenhado.</td></tr>';
    $('sheetArea').textContent = perimeter(current) && window.turf
      ? (turf.area(perimeter(current)) / 10000).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
      : '0,0000';
    $('sheetPerimeter').textContent = rows.reduce((sum, row) => sum + row.distance, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const ownerName = window.GeoRuralProjects?.ownerNames?.(current) || current.owner || current.ownerName || current.metadata?.owner || 'Não informado';
    const propertyName = current.propertyName || current.title || current.name || 'Não informado';
    const city = current.city || current.municipality || current.metadata?.city || current.metadata?.municipality || '';
    const uf = current.uf || current.stateCode || current.metadata?.uf || current.metadata?.stateCode || '';
    $('ownerSummary').innerHTML = `<div class="sheet-owner-grid"><div><span>Proprietário / possuidor</span><strong>${escapeHtml(ownerName)}</strong></div><div><span>Imóvel</span><strong>${escapeHtml(propertyName)}</strong></div><div><span>Município</span><strong>${escapeHtml(city || 'Não informado')}</strong></div><div><span>UF</span><strong>${escapeHtml(uf || 'Não informado')}</strong></div><div><span>Área</span><strong>${escapeHtml($('sheetArea').textContent)} ha</strong></div><div><span>Perímetro</span><strong>${escapeHtml($('sheetPerimeter').textContent)} m</strong></div></div>`;
    const mapLink = $('sheetGoMap');
    const memorialLink = $('sheetGoMemorial');
    if (mapLink) mapLink.href = `/mapas/?project=${encodeURIComponent(current.id)}`;
    if (memorialLink) memorialLink.href = `/memorial/?project=${encodeURIComponent(current.id)}`;
    $('neighborsBody').innerHTML = rows.length
      ? rows.map((row) => `<tr><td>${escapeHtml(row.code)}</td><td>${escapeHtml(row.neighbor || 'Não informado')}</td><td>${escapeHtml(row.limit || 'Não informado')}</td><td>${row.az.toFixed(4)}°</td><td>${row.distance.toFixed(2)} m</td></tr>`).join('')
      : '<tr><td colspan="5">Nenhum trecho disponível.</td></tr>';
    $('odsStatus').textContent = rows.length
      ? `${rows.length >= 3 ? 'Projeto pronto para exportação.' : 'Perímetro incompleto: mínimo de 3 vértices.'} ${rows.length} vértice(s) carregado(s).`
      : 'Projeto carregado, mas sem perímetro suficiente para gerar planilha.';
    const editLink = $('editVertices');
    if (editLink) editLink.href = `/mapa/?project=${encodeURIComponent(current.id)}`;
  }

  let projectLoadToken = 0;
  select.addEventListener('change', async () => {
    const token = ++projectLoadToken;
    const requestedId = select.value;
    const legacy = document.getElementById('projectSelect');
    if (legacy) {
      legacy.value = select.value;
      legacy.dispatchEvent(new Event('change', { bubbles: true }));
    }
    try {
      const loaded = await resolveProject(requestedId);
      if (token !== projectLoadToken || select.value !== requestedId) return;
      current = loaded;
      if (current) {
        if (legacy && !Array.from(legacy.options).some((option) => option.value === current.id)) legacy.add(new Option(current.title || current.name || 'Projeto', current.id));
        if (legacy) { legacy.value = current.id; legacy.dispatchEvent(new Event('change', { bubbles: true })); }
      }
      rows = current ? buildRows(current) : [];
      render();
    } catch (error) {
      if (token !== projectLoadToken) return;
      current = null;
      rows = [];
      setEmptyState(error.message || 'Não foi possível carregar o projeto.');
      toast(error.message || 'Não foi possível carregar o projeto.', 'error');
    }
  });

  $('coordinateFormat')?.addEventListener('change', render);
  document.querySelectorAll('[data-sheet-tab]').forEach((btn) => btn.addEventListener('click', () => {
    document.querySelectorAll('[data-sheet-tab]').forEach((item) => item.classList.toggle('active', item === btn));
    document.querySelectorAll('.sheet-tab-panel').forEach((panel) => panel.classList.toggle('active', panel.id === `sheet-${btn.dataset.sheetTab}`));
  }));

  function kml() {
    if (!current) return '';
    return `<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><name>${escapeXml(current.title || 'Projeto')}</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${ring(current).map((coord) => `${coord[0]},${coord[1]},0`).join(' ')}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></Document></kml>`;
  }
  function download(name, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  $('downloadKmlSheet').addEventListener('click', () => current && rows.length >= 3 && perimeter(current)
    ? download(`${current.title || 'projeto'}.kml`, kml(), 'application/vnd.google-earth.kml+xml')
    : toast('Selecione um projeto com perímetro válido antes de gerar KML.', 'error'));

  function excelColumn(index) {
    let n = Number(index) + 1;
    let out = '';
    while (n > 0) {
      n -= 1;
      out = String.fromCharCode(65 + (n % 26)) + out;
      n = Math.floor(n / 26);
    }
    return out;
  }

  function xlsxCell(ref, value, style = 0, numeric = false) {
    if (numeric && Number.isFinite(Number(value))) return `<c r="${ref}" s="${style}"><v>${Number(value)}</v></c>`;
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value ?? '')}</t></is></c>`;
  }

  function xlsxSheetXml(matrix, options = {}) {
    const rowsXml = matrix.map((row, rowIndex) => {
      const cells = row.map((entry, colIndex) => {
        const data = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : { value: entry };
        return xlsxCell(`${excelColumn(colIndex)}${rowIndex + 1}`, data.value, data.style || 0, Boolean(data.numeric));
      }).join('');
      const height = rowIndex === 0 && options.title ? ' ht="24" customHeight="1"' : '';
      return `<row r="${rowIndex + 1}"${height}>${cells}</row>`;
    }).join('');
    const widths = (options.widths || []).map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${Number(width)}" customWidth="1"/>`).join('');
    const merge = options.merge ? `<mergeCells count="1"><mergeCell ref="${options.merge}"/></mergeCells>` : '';
    const autoFilter = options.autoFilter ? `<autoFilter ref="${options.autoFilter}"/>` : '';
    const freeze = options.freezeRow ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${options.freezeRow}" topLeftCell="A${options.freezeRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${freeze}<sheetFormatPr defaultRowHeight="15"/><cols>${widths}</cols><sheetData>${rowsXml}</sheetData>${merge}${autoFilter}</worksheet>`;
  }

  async function styledXlsxBlob() {
    if (!window.JSZip) throw new Error('O módulo de planilha Excel ainda não foi carregado.');
    const zip = new JSZip();
    const ownerName = window.GeoRuralProjects?.ownerNames?.(current) || current.owner || current.ownerName || current.metadata?.owner || 'Não informado';
    const propertyName = current.propertyName || current.title || current.name || 'Não informado';
    const city = current.city || current.municipality || current.metadata?.city || current.metadata?.municipality || '';
    const uf = current.uf || current.stateCode || current.metadata?.uf || current.metadata?.stateCode || '';
    const format = $('coordinateFormat')?.value || 'sigef';
    const vertexHeader = ['Código','Longitude','Latitude','Coord E(m)','Coord N(m)','Quadrante','Azimute','Distância (m)','Confrontante','Limite'];
    const vertexRows = rows.map((row, index) => {
      const c = formatCoord(row, format);
      const u = utm(row.lng, row.lat);
      const style = index % 2 ? 4 : 0;
      return [
        { value: row.code, style }, { value: row.lng, style, numeric: true }, { value: row.lat, style, numeric: true },
        { value: u.e, style, numeric: true }, { value: u.n, style, numeric: true }, { value: c.quad, style },
        { value: row.az, style, numeric: true }, { value: row.distance, style, numeric: true },
        { value: row.neighbor || 'Não informado', style }, { value: row.limit || 'Não informado', style }
      ];
    });
    const vertices = [
      [{ value: `SURVEYOR — PLANILHA TÉCNICA — ${propertyName}`, style: 1 }, ...Array(9).fill({ value: '', style: 1 })],
      [{ value: `Área: ${$('sheetArea').textContent} ha`, style: 2 }, { value: `Perímetro: ${$('sheetPerimeter').textContent} m`, style: 2 }, ...Array(8).fill({ value: '', style: 2 })],
      vertexHeader.map((value) => ({ value, style: 3 })),
      ...vertexRows
    ];
    const owners = [
      [{ value: 'PROPRIETÁRIO E IMÓVEL', style: 1 }, { value: '', style: 1 }],
      [{ value: 'Campo', style: 3 }, { value: 'Informação', style: 3 }],
      [{ value: 'Proprietário / possuidor', style: 5 }, { value: ownerName }],
      [{ value: 'Imóvel', style: 5 }, { value: propertyName }],
      [{ value: 'Município', style: 5 }, { value: city || 'Não informado' }],
      [{ value: 'UF', style: 5 }, { value: uf || 'Não informado' }],
      [{ value: 'Área (ha)', style: 5 }, { value: Number(String($('sheetArea').textContent).replace(/\./g,'').replace(',','.')) || 0, numeric: true }],
      [{ value: 'Perímetro (m)', style: 5 }, { value: Number(String($('sheetPerimeter').textContent).replace(/\./g,'').replace(',','.')) || 0, numeric: true }]
    ];
    const neighbors = [
      [{ value: 'CONFRONTANTES POR TRECHO', style: 1 }, ...Array(4).fill({ value: '', style: 1 })],
      ['Trecho','Confrontante','Tipo de limite','Azimute','Distância (m)'].map((value) => ({ value, style: 3 })),
      ...rows.map((row,index) => {
        const style = index % 2 ? 4 : 0;
        return [{value:row.code,style},{value:row.neighbor||'Não informado',style},{value:row.limit||'Não informado',style},{value:row.az,style,numeric:true},{value:row.distance,style,numeric:true}];
      })
    ];

    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
    zip.folder('_rels').file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
    const xl = zip.folder('xl');
    xl.file('workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Vértices" sheetId="1" r:id="rId1"/><sheet name="Proprietário" sheetId="2" r:id="rId2"/><sheet name="Confrontantes" sheetId="3" r:id="rId3"/></sheets></workbook>`);
    xl.folder('_rels').file('workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
    xl.file('styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="13"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F63E9"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF2FF"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF5F9FF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFB8C8DA"/></left><right style="thin"><color rgb="FFB8C8DA"/></right><top style="thin"><color rgb="FFB8C8DA"/></top><bottom style="thin"><color rgb="FFB8C8DA"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyBorder="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="2" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="4" borderId="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="3" borderId="1" applyFill="1" applyBorder="1"><alignment wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
    const sheets = xl.folder('worksheets');
    sheets.file('sheet1.xml', xlsxSheetXml(vertices, { title:true, merge:'A1:J1', widths:[16,16,16,16,16,12,14,16,25,22], freezeRow:3, autoFilter:`A3:J${Math.max(3,vertices.length)}` }));
    sheets.file('sheet2.xml', xlsxSheetXml(owners, { title:true, merge:'A1:B1', widths:[28,48], freezeRow:2, autoFilter:`A2:B${owners.length}` }));
    sheets.file('sheet3.xml', xlsxSheetXml(neighbors, { title:true, merge:'A1:E1', widths:[18,32,25,16,18], freezeRow:2, autoFilter:`A2:E${Math.max(2,neighbors.length)}` }));
    const props = zip.folder('docProps');
    const now = new Date().toISOString();
    props.file('core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Planilha técnica — ${escapeXml(propertyName)}</dc:title><dc:creator>Surveyor</dc:creator><cp:lastModifiedBy>Surveyor</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`);
    props.file('app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Surveyor</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><Company>Surveyor</Company><AppVersion>1.0</AppVersion></Properties>`);
    return zip.generateAsync({ type:'blob', mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', compression:'DEFLATE', compressionOptions:{ level:6 } });
  }

  // O menu ODS já existia, mas o botão interno não tinha um manipulador.
  // Planilha técnica editável, distinta do modelo oficial de envio ao SIGEF.
  function makeOfficialOdsWorkbook() {
    if (!current || rows.length < 3 || !perimeter(current)) throw new Error('Projeto sem perímetro válido para a planilha.');
    if (!globalThis.XLSX?.utils?.book_new || !globalThis.XLSX?.write) throw new Error('Biblioteca de planilhas indisponível.');
    const format = $('coordinateFormat')?.value || 'sigef';
    const vertices = [['Código','Longitude','Latitude','Coord E (m)','Coord N (m)','Fuso','Azimute (°)','Distância (m)','Confrontante','Limite'],
      ...rows.map(row => {
        const formatted = formatCoord(row, format);
        const projected = utm(row.lng, row.lat);
        return [row.code, row.lng, row.lat, projected.e, projected.n, projected.zone, row.az, row.distance, row.neighbor || '', row.limit || ''];
      })];
    const owner = [['Campo','Informação'], ['Projeto',current.title || current.propertyName || current.name || ''],
      ['Proprietário',window.GeoRuralProjects?.ownerNames?.(current) || current.owner || current.ownerName || ''], ['Município',current.city || current.municipality || ''],
      ['UF',current.uf || current.stateCode || ''], ['Área (ha)', $('sheetArea')?.textContent || ''],
      ['Perímetro (m)', $('sheetPerimeter')?.textContent || '']];
    const neighbors = [['Trecho','Confrontante','Limite','Azimute (°)','Distância (m)'],
      ...rows.map(row => [row.code,row.neighbor || '',row.limit || '',row.az,row.distance])];
    const workbook = XLSX.utils.book_new();
    for (const [name, data] of [['Vértices',vertices],['Proprietário',owner],['Confrontantes',neighbors]]) {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(data), name);
    }
    return workbook;
  }
  $('generateOds')?.addEventListener('click', () => {
    try {
      const workbook = makeOfficialOdsWorkbook();
      const name = String(current.propertyName || current.title || current.name || 'projeto').normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g,'').slice(0,80) || 'projeto';
      XLSX.writeFile(workbook, `${name}-planilha.ods`, { bookType:'ods' });
      toast('Planilha ODS técnica gerada. Não substitui a validação SIGEF.', 'success');
    } catch (error) {
      console.error('[Surveyor] Falha ao exportar ODS:', error);
      toast(error?.message || 'Não foi possível gerar a planilha ODS.', 'error');
    }
  });
  if (window.SurveyorBatchDocumentContext?.active) {
    window.SurveyorOfficialBatchOds = Object.freeze({
      async ods() {
        const id = String(window.SurveyorBatchDocumentContext.projectId);
        const select = $('sheetProjectSelect');
        if (![...select.options].some(option => option.value === id)) select.add(new Option('Lote selecionado', id));
        select.value = id;
        const p = await resolveProject(id);
        if (!p) throw new Error('Projeto indisponível para exportação ODS.');
        current = p;
        rows = buildRows(p);
        render();
        const workbook = makeOfficialOdsWorkbook();
        return XLSX.write(workbook, { bookType: 'ods', type: 'array' });
      }
    });
  }

  $('downloadXlsx').addEventListener('click', async () => {
    if (!current || rows.length < 3 || !perimeter(current)) {
      toast('Selecione um projeto com perímetro válido (mínimo 3 vértices).', 'error');
      return;
    }
    try {
      const blob = await styledXlsxBlob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${current.propertyName || current.title || current.name || 'projeto'}-planilha.xlsx`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast('Planilha Excel formatada gerada com sucesso.', 'success');
    } catch (error) {
      console.error(error);
      toast(error.message || 'Não foi possível gerar a planilha Excel.', 'error');
    }
  });

  loadProjects().catch((error) => {
    setEmptyState(error.message || 'Não foi possível carregar os projetos da nuvem.');
    toast(error.message || 'Não foi possível carregar os projetos da nuvem.', 'error');
  });
})();
