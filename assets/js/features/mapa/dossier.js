(() => {
  'use strict';

  const runtime = () => window.SurveyorMapRuntime;

  function safeName(value, fallback = 'projeto') {
    return String(value || fallback)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || fallback;
  }

  function props(feature) { return feature?.properties || {}; }
  function featureName(feature, index = 0) { return String(props(feature).name || `Elemento ${index + 1}`); }

  async function ensureJsPdf() {
    if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
    await new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-surveyor-jspdf]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.dataset.surveyorJspdf = '1';
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Não foi possível carregar o gerador de PDF.'));
      document.head.appendChild(script);
    });
    if (!window.jspdf?.jsPDF) throw new Error('Gerador de PDF indisponível.');
    return window.jspdf.jsPDF;
  }

  function addPdfHeader(doc, title, subtitle = '') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('SURVEYOR', 14, 16);
    doc.setFontSize(13);
    doc.text(title, 14, 25);
    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(subtitle, 14, 31);
    }
    doc.setDrawColor(180);
    doc.line(14, 35, doc.internal.pageSize.getWidth() - 14, 35);
  }

  function addWrapped(doc, text, x, y, width, options = {}) {
    const fontSize = Number(options.fontSize || 10);
    const lineHeight = Number(options.lineHeight || 5);
    doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(String(text || ''), width);
    doc.text(lines, x, y);
    return y + Math.max(1, lines.length) * lineHeight;
  }

  function areaHa(feature) {
    try { return Number(window.turf?.area?.(feature) || 0) / 10000; } catch { return 0; }
  }

  function perimeterM(feature) {
    try {
      if (feature?.geometry?.type === 'Polygon') return turf.length(turf.polygonToLine(feature), { units: 'kilometers' }) * 1000;
      if (feature?.geometry?.type === 'MultiPolygon') return turf.flatten(feature).features.reduce((sum, f) => sum + turf.length(turf.polygonToLine(f), { units: 'kilometers' }) * 1000, 0);
      if (/LineString/i.test(String(feature?.geometry?.type || ''))) return turf.length(feature, { units: 'kilometers' }) * 1000;
    } catch {}
    return 0;
  }

  function outerVertices(feature) {
    const type = feature?.geometry?.type;
    let ring = type === 'Polygon' ? (feature.geometry.coordinates?.[0] || []) : [];
    if (ring.length > 1) {
      const a = ring[0], b = ring[ring.length - 1];
      if (a && b && Math.abs(Number(a[0]) - Number(b[0])) < 1e-12 && Math.abs(Number(a[1]) - Number(b[1])) < 1e-12) ring = ring.slice(0, -1);
    }
    return ring;
  }

  function distanceMeters(a, b) {
    try { return turf.distance(turf.point(a), turf.point(b), { units: 'kilometers' }) * 1000; } catch { return 0; }
  }

  function bearingDegrees(a, b) {
    try { return (Number(turf.bearing(turf.point(a), turf.point(b))) + 360) % 360; } catch { return 0; }
  }

  async function reportPdf(data, audit) {
    const JsPdf = await ensureJsPdf();
    const doc = new JsPdf({ unit: 'mm', format: 'a4' });
    addPdfHeader(doc, 'Relatório do imóvel', `Gerado em ${new Date().toLocaleString('pt-BR')}`);
    const project = data.project || {};
    let y = 45;
    const rows = [
      ['Imóvel', project.propertyName || project.name || 'Não informado'],
      ['Proprietário', window.GeoRuralProjects?.ownerNames?.(project) || project.ownerName || 'Não informado'],
      ['Município/UF', [project.municipality, project.stateCode].filter(Boolean).join('/') || 'Não informado'],
      ['Elementos', String(data.featureCollection?.features?.length || 0)],
      ['Nota técnica', `${audit.score}/100 — ${audit.status}`]
    ];
    rows.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(`${label}:`, 14, y);
      doc.setFont('helvetica', 'normal'); doc.text(String(value), 48, y); y += 7;
    });
    const polygons = (data.featureCollection?.features || []).filter((f) => /Polygon/i.test(String(f.geometry?.type || '')));
    const totalArea = polygons.reduce((sum, f) => sum + areaHa(f), 0);
    y += 3;
    y = addWrapped(doc, `Área poligonal total: ${totalArea.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} ha.`, 14, y, 180, { bold: true });
    y += 5;
    addWrapped(doc, 'Este relatório é um resumo técnico gerado pelo SURVEYOR. A validação oficial perante SIGEF, INCRA, SICAR, SEIA ou CEFIR depende dos requisitos de cada órgão e da responsabilidade técnica aplicável.', 14, y, 180, { fontSize: 8, lineHeight: 4 });
    return doc.output('blob');
  }

  async function croquiPdf(data) {
    const JsPdf = await ensureJsPdf();
    const doc = new JsPdf({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const features = (data.featureCollection?.features || []).filter((f) => f.geometry?.type === 'Polygon');
    addPdfHeader(doc, 'Croqui técnico', data.project?.propertyName || data.project?.name || 'Projeto');
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    const box = { x: 18, y: 43, w: W - 36, h: H - 68 };
    doc.setDrawColor(190); doc.rect(box.x, box.y, box.w, box.h);
    if (!features.length) {
      doc.setFontSize(11); doc.text('Nenhum polígono disponível para o croqui.', box.x + 8, box.y + 15);
      return doc.output('blob');
    }
    const all = features.flatMap((f) => outerVertices(f));
    const xs = all.map((c) => Number(c[0])), ys = all.map((c) => Number(c[1]));
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const dx = Math.max(1e-12, maxX - minX), dy = Math.max(1e-12, maxY - minY);
    const scale = Math.min((box.w - 20) / dx, (box.h - 20) / dy);
    const toPage = ([x, y]) => [box.x + 10 + (x - minX) * scale, box.y + box.h - 10 - (y - minY) * scale];
    features.forEach((feature, featureIndex) => {
      const ring = outerVertices(feature);
      if (ring.length < 3) return;
      doc.setDrawColor(30 + (featureIndex % 3) * 45, 80, 140);
      doc.setLineWidth(0.5);
      for (let i = 0; i < ring.length; i += 1) {
        const a = toPage(ring[i]), b = toPage(ring[(i + 1) % ring.length]);
        doc.line(a[0], a[1], b[0], b[1]);
        if (featureIndex === 0) {
          doc.setFontSize(7); doc.text(`V-${String(i + 1).padStart(2, '0')}`, a[0] + 1.5, a[1] - 1.5);
        }
      }
    });
    doc.setDrawColor(20); doc.setLineWidth(0.6);
    const nx = W - 28, ny = 50;
    doc.line(nx, ny + 18, nx, ny);
    doc.line(nx, ny, nx - 3, ny + 6); doc.line(nx, ny, nx + 3, ny + 6);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('N', nx - 2, ny - 2);
    const primary = features[0];
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(`Área: ${areaHa(primary).toLocaleString('pt-BR', { maximumFractionDigits: 4 })} ha  |  Perímetro: ${perimeterM(primary).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m`, 18, H - 13);
    return doc.output('blob');
  }

  async function memorialPdf(data) {
    const JsPdf = await ensureJsPdf();
    const doc = new JsPdf({ unit: 'mm', format: 'a4' });
    addPdfHeader(doc, 'Memorial descritivo — quadro de vértices', data.project?.propertyName || data.project?.name || 'Projeto');
    const perimeters = (data.featureCollection?.features || []).filter((f) => f.geometry?.type === 'Polygon' && String(props(f).category || '').toLowerCase() === 'perimetro');
    const source = perimeters.length ? perimeters : (data.featureCollection?.features || []).filter((f) => f.geometry?.type === 'Polygon');
    let y = 43;
    source.forEach((feature, featureIndex) => {
      const vertices = outerVertices(feature);
      if (!vertices.length) return;
      if (y > 250) { doc.addPage(); addPdfHeader(doc, 'Memorial descritivo — continuação'); y = 43; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(featureName(feature, featureIndex), 14, y); y += 7;
      doc.setFontSize(8); doc.text('Vértice', 14, y); doc.text('Latitude', 36, y); doc.text('Longitude', 78, y); doc.text('Distância', 126, y); doc.text('Azimute', 162, y); y += 5;
      doc.setFont('helvetica', 'normal');
      vertices.forEach((coord, i) => {
        if (y > 282) { doc.addPage(); addPdfHeader(doc, 'Memorial descritivo — continuação'); y = 43; }
        const next = vertices[(i + 1) % vertices.length];
        doc.text(`V-${String(i + 1).padStart(2, '0')}`, 14, y);
        doc.text(Number(coord[1]).toFixed(7), 36, y);
        doc.text(Number(coord[0]).toFixed(7), 78, y);
        doc.text(`${distanceMeters(coord, next).toFixed(2)} m`, 126, y);
        doc.text(`${bearingDegrees(coord, next).toFixed(2)}°`, 162, y);
        y += 5;
      });
      const confrontation = confrontantesFor(feature);
      if (confrontation.length) {
        y += 3;
        for (const item of confrontation) {
          if (y > 276) { doc.addPage(); addPdfHeader(doc, 'Memorial descritivo — continuação'); y = 43; }
          y = addWrapped(doc, `${item.from} ao ${item.to}: ${item.nome || 'Confrontante não informado'}${item.propriedade ? ' (' + item.propriedade + ')' : ''}${item.tipoLimite ? ' · ' + item.tipoLimite : ''}`, 14, y, 179, {fontSize:8,lineHeight:4});
        }
      }
      y += 5;
    });
    if (!source.length) addWrapped(doc, 'Nenhum polígono encontrado para gerar o memorial.', 14, y, 180);
    return doc.output('blob');
  }

  function confrontantesFor(feature) {
    const properties = props(feature);
    const trechos = Array.isArray(properties.confrontanteTrechos) ? properties.confrontanteTrechos : [];
    const list = trechos.length ? trechos : (Array.isArray(properties.confrontantes) ? properties.confrontantes : []);
    return list.filter((item) => item && (item.nome || item.tipoLimite || item.propriedade)).map((item, index) => ({
      ...item,
      from: item.from || (item.startVertex ? `V-${String(item.startVertex).padStart(2,'0')}` : `Trecho ${index + 1}`),
      to: item.to || (item.endVertex ? `V-${String(item.endVertex).padStart(2,'0')}` : '')
    }));
  }

  async function confrontantesPdf(data) {
    const JsPdf = await ensureJsPdf();
    const doc = new JsPdf({ unit: 'mm', format: 'a4' });
    addPdfHeader(doc, 'Confrontantes', data.project?.propertyName || data.project?.name || 'Projeto');
    let y = 43, count = 0;
    (data.featureCollection?.features || []).forEach((feature, featureIndex) => {
      const list = confrontantesFor(feature);
      if (!list.length) return;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(featureName(feature, featureIndex), 14, y); y += 6;
      list.forEach((item, index) => {
        if (y > 278) { doc.addPage(); addPdfHeader(doc, 'Confrontantes — continuação'); y = 43; }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text(`${item.from || `V-${index + 1}`} → ${item.to || ''}`, 14, y);
        doc.setFont('helvetica', 'normal');
        y = addWrapped(doc, `${item.nome || 'Não informado'}${item.tipoLimite ? ` · ${item.tipoLimite}` : ''}${item.orientacao ? ` · ${item.orientacao}` : ''}${item.observacao ? ` · ${item.observacao}` : ''}`, 42, y, 150, { fontSize: 8, lineHeight: 4 });
        y += 2; count += 1;
      });
      y += 3;
    });
    if (!count) addWrapped(doc, 'Nenhum confrontante foi informado no projeto atual.', 14, y, 180);
    return doc.output('blob');
  }

  async function carSigefPdf(data) {
    const JsPdf = await ensureJsPdf();
    const doc = new JsPdf({ unit: 'mm', format: 'a4' });
    addPdfHeader(doc, 'Resumo CAR / SIGEF', data.project?.propertyName || data.project?.name || 'Projeto');
    const refs = Array.isArray(data.referenceLayers) ? data.referenceLayers : [];
    const relevant = refs.filter((item) => /(car|sicar|cefir|sigef|incra)/i.test(String(item.name || '')));
    let y = 45;
    if (!relevant.length) {
      y = addWrapped(doc, 'Não há evidência de camada CAR/SICAR/CEFIR ou SIGEF/INCRA adicionada ao projeto nesta sessão.', 14, y, 180);
    } else {
      relevant.forEach((item) => {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('•', 14, y);
        doc.setFont('helvetica', 'normal'); doc.text(String(item.name || 'Camada oficial'), 20, y); y += 6;
      });
    }
    y += 5;
    addWrapped(doc, 'Este documento registra somente as referências presentes no mapa no momento da geração. Ele não substitui certidão, recibo, certificação ou consulta oficial emitida pelo órgão responsável.', 14, y, 180, { fontSize: 8, lineHeight: 4 });
    return doc.output('blob');
  }

  function coordinatesCsv(data) {
    const rows = ['elemento;categoria;vertice;latitude;longitude;distancia_proximo_m;azimute_proximo_graus'];
    (data.featureCollection?.features || []).forEach((feature, featureIndex) => {
      const vertices = feature.geometry?.type === 'Polygon' ? outerVertices(feature) : [];
      vertices.forEach((coord, i) => {
        const next = vertices[(i + 1) % vertices.length] || coord;
        rows.push([featureName(feature, featureIndex), props(feature).category || '', `V-${String(i + 1).padStart(2, '0')}`, Number(coord[1]).toFixed(7), Number(coord[0]).toFixed(7), distanceMeters(coord, next).toFixed(3), bearingDegrees(coord, next).toFixed(3)].map(csvCell).join(';'));
      });
    });
    return rows.join('\n');
  }

  function csvCell(value) {
    const text = String(value ?? '');
    return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function kml(data) {
    const escape = (v) => String(v ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const placemarks = (data.featureCollection?.features || []).map((feature, index) => {
      const name = escape(featureName(feature, index));
      const type = feature.geometry?.type;
      if (type === 'Point') return `<Placemark><name>${name}</name><Point><coordinates>${feature.geometry.coordinates.join(',')}</coordinates></Point></Placemark>`;
      if (type === 'LineString') return `<Placemark><name>${name}</name><LineString><tessellate>1</tessellate><coordinates>${feature.geometry.coordinates.map((c) => c.join(',')).join(' ')}</coordinates></LineString></Placemark>`;
      if (type === 'Polygon') return `<Placemark><name>${name}</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${(feature.geometry.coordinates?.[0] || []).map((c) => c.join(',')).join(' ')}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`;
      return '';
    }).join('');
    return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${escape(data.project?.propertyName || data.project?.name || 'Projeto Surveyor')}</name>${placemarks}</Document></kml>`;
  }

  async function addShapefileFolder(zip, data, baseName) {
    const exporter = window.SurveyorShapefileExport;
    if (!exporter?.exportWithProfile) {
      zip.file('09 - Shapefile/README.txt', 'Exportador Shapefile indisponível nesta sessão.');
      return;
    }
    try {
      const result = await exporter.exportWithProfile({
        featureCollection: data.featureCollection,
        baseName,
        context: { propertyName: data.project?.propertyName || data.project?.name || baseName, uf: data.project?.stateCode || '' },
        download: false
      }, 'qgis-arcgis');
      const shpZip = await JSZip.loadAsync(result.blob);
      const folder = zip.folder('09 - Shapefile');
      for (const entry of Object.values(shpZip.files || {})) {
        if (entry.dir) continue;
        folder.file(entry.name.split('/').pop(), await entry.async('uint8array'));
      }
    } catch (error) {
      zip.file('09 - Shapefile/ERRO.txt', `Não foi possível gerar o Shapefile: ${error?.message || error}`);
    }
  }

  async function generate() {
    if (!window.JSZip) throw new Error('Biblioteca ZIP não carregada.');
    const rt = runtime();
    const data = rt?.getProjectData?.();
    if (!data) throw new Error('Dados do projeto indisponíveis.');
    if (!(data.featureCollection?.features || []).length) throw new Error('Adicione pelo menos uma geometria antes de gerar o dossiê.');
    const audit = window.SurveyorProjectAudit?.evaluate?.() || { score: 0, status: 'Não verificado', results: [], errors: 0, warnings: 0 };
    const auditJson = window.SurveyorProjectAudit?.serializable?.(audit) || audit;
    const base = safeName(data.project?.propertyName || data.project?.name || rt.getFileBase?.() || 'projeto');
    const zip = new JSZip();

    rt.toast?.('Gerando dossiê técnico...', 'success');
    const [report, croqui, memorial, confrontantes, carSigef] = await Promise.all([
      reportPdf(data, audit), croquiPdf(data), memorialPdf(data), confrontantesPdf(data), carSigefPdf(data)
    ]);
    zip.file('01 - Relatório do imóvel.pdf', report);
    zip.file('02 - Croqui.pdf', croqui);
    zip.file('03 - Memorial descritivo.pdf', memorial);
    zip.file('04 - Tabela de coordenadas.csv', '\ufeff' + coordinatesCsv(data));
    zip.file('05 - Confrontantes.pdf', confrontantes);
    zip.file('06 - CAR-SIGEF.pdf', carSigef);
    zip.file('07 - Projeto.geojson', JSON.stringify(data.featureCollection, null, 2));
    zip.file('08 - Projeto.kml', kml(data));
    await addShapefileFolder(zip, data, base);
    zip.file('10 - Fotos de campo/README.txt', 'Nenhuma foto de campo está anexada ao mapa nesta versão do projeto.');
    zip.file('11 - Metadados/projeto.json', JSON.stringify(data.project || {}, null, 2));
    zip.file('11 - Metadados/checklist-tecnico.json', JSON.stringify(auditJson, null, 2));
    zip.file('11 - Metadados/manifesto.json', JSON.stringify({ generatedAt: new Date().toISOString(), generator: 'SURVEYOR', dossierVersion: '1.0', files: ['relatorio','croqui','memorial','coordenadas','confrontantes','car-sigef','geojson','kml','shapefile','fotos','metadados'] }, null, 2));
    zip.file('LEIA-ME.txt', 'Dossiê Técnico SURVEYOR. Revise os documentos e valide as exigências do órgão competente antes de protocolar.');

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${base}-Dossie-Surveyor.zip`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    rt.toast?.('Dossiê técnico gerado com sucesso.', 'success');
    return { blob, filename: `${base}-Dossie-Surveyor.zip`, audit: auditJson };
  }

  function lotOds(data) {
    const XLSX = window.XLSX;
    if (!XLSX?.utils?.book_new || !XLSX?.write) throw new Error('Biblioteca de planilhas ODS indisponível. Verifique a conexão.');
    const feature = data.featureCollection?.features?.[0];
    const coords = outerVertices(feature);
    const workbook = XLSX.utils.book_new();
    const vertices = [['Vértice','Longitude (°)','Latitude (°)','Distância próximo (m)','Azimute (°)'],
      ...coords.map((point, index) => {
        const next = coords[(index + 1) % coords.length];
        return [`V-${String(index + 1).padStart(2,'0')}`,point[0],point[1],distanceMeters(point,next),bearingDegrees(point,next)];
      })];
    const info = [['Campo','Informação'], ['Lote', data.project?.propertyName || ''],['Proprietário',window.GeoRuralProjects?.ownerNames?.(data.project) || data.project?.ownerName || ''],
      ['Município',data.project?.municipality || ''],['UF',data.project?.stateCode || ''],['Área (ha)',areaHa(feature)],['Perímetro (m)',perimeterM(feature)],
      ['Nota','Planilha técnica experimental. Não é modelo oficial SIGEF.']];
    const list = confrontantesFor(feature);
    const confrontantes = [['Trecho','Confrontante','Tipo de limite'], ...list.map((item)=>[`${item.from || ''} - ${item.to || ''}`,item.nome || '',item.tipoLimite || ''])];
    for(const [name,rows] of [['Vértices',vertices],['Identificação',info],['Confrontantes',confrontantes]]) {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
    }
    return XLSX.write(workbook, {bookType:'ods',type:'array'});
  }

  // Reaproveita o motor do dossiê por geometria isolada; nunca mistura vértices de outros lotes.
  async function lotPreliminarySheetPdf(data) {
    const JsPdf = await ensureJsPdf();
    const doc = new JsPdf({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    const feature = data.featureCollection?.features?.[0];
    const ring = outerVertices(feature);
    if (ring.length < 3) throw new Error('Polígono insuficiente para montar a prancha.');
    doc.setDrawColor(45,80,118); doc.setLineWidth(0.6); doc.rect(9, 9, W-18, H-18);
    doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.text('SURVEYOR · PRANCHA PRELIMINAR', 17, 20);
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.text('Sem escala cartográfica certificada · Conferir no editor oficial antes de protocolar', 17, 27);
    const box={x:17,y:35,w:W-86,h:H-56}; doc.setDrawColor(185); doc.rect(box.x,box.y,box.w,box.h);
    // Visualização local aproximadamente métrica; NÃO representa projeção certificada ou escala de prancha.
    const meanLat = ring.reduce((sum, p) => sum + Number(p[1]), 0) / ring.length;
    const xFactor = Math.max(0.01, Math.cos(meanLat * Math.PI / 180));
    const xs=ring.map((p)=>p[0]*xFactor),ys=ring.map((p)=>p[1]);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const scale=Math.min((box.w-26)/Math.max(1e-12,maxX-minX),(box.h-26)/Math.max(1e-12,maxY-minY));
    const toPage=([x,y])=>[box.x+13+(x*xFactor-minX)*scale,box.y+box.h-13-(y-minY)*scale];
    doc.setDrawColor(22,87,161);doc.setLineWidth(.8);
    for(let i=0;i<ring.length;i++){
      const a=toPage(ring[i]),b=toPage(ring[(i+1)%ring.length]);
      doc.line(a[0],a[1],b[0],b[1]); doc.setFont('helvetica','bold');doc.setFontSize(7);doc.text(`V-${String(i+1).padStart(2,'0')}`,a[0]+1.4,a[1]-1.4);
    }
    const x=W-62; doc.setDrawColor(185);doc.line(x-5,35,x-5,H-21);
    doc.setFont('helvetica','bold');doc.setFontSize(12); doc.text('IDENTIFICAÇÃO',x,45);
    doc.setFontSize(9); doc.setFont('helvetica','normal');
    let y=56;
    for(const [label,val] of [['LOTE',data.project?.propertyName],['PROPRIETÁRIO',window.GeoRuralProjects?.ownerNames?.(data.project) || data.project?.ownerName],['MUNICÍPIO / UF',`${data.project?.municipality||''} / ${data.project?.stateCode||''}`],['ÁREA',`${areaHa(feature).toLocaleString('pt-BR',{maximumFractionDigits:4})} ha`],['PERÍMETRO',`${perimeterM(feature).toLocaleString('pt-BR',{maximumFractionDigits:2})} m`],['VÉRTICES',String(ring.length)]]){
      doc.setFont('helvetica','bold');doc.setFontSize(7);doc.text(label,x,y);
      doc.setFont('helvetica','normal');doc.setFontSize(8);const lines=doc.splitTextToSize(String(val||'Não informado'),54);doc.text(lines,x,y+5);y+=12+Math.min(3,lines.length)*3;
    }
    return doc.output('blob');
  }
  async function lotDocuments(data, selected) {
    if (!data?.featureCollection?.features?.length) throw new Error('Sem geometria para este lote.');
    const wants = new Set(selected || []), result = {};
    if (wants.has('memorial')) result['Memorial - Quadro de vertices.pdf'] = await memorialPdf(data);
    if (wants.has('prancha')) result['Prancha preliminar.pdf'] = await lotPreliminarySheetPdf(data);
    if (wants.has('croqui')) result['Croqui.pdf'] = await croquiPdf(data);
    if (wants.has('confrontantes')) result['Confrontantes.pdf'] = await confrontantesPdf(data);
    if (wants.has('ods')) result['Planilha tecnica.ods'] = lotOds(data);
    if (wants.has('coordenadas')) result['Coordenadas.csv'] = '\ufeff' + coordinatesCsv(data);
    if (wants.has('geojson')) result['Geometria.geojson'] = JSON.stringify(data.featureCollection, null, 2);
    if (wants.has('kml')) result['Geometria.kml'] = kml(data);
    return result;
  }

  function mount() {
    if (document.getElementById('svDossierBtn')) return true;
    const menu = document.querySelector('.sv-map-export-menu');
    if (!menu) return false;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'svDossierBtn';
    button.className = 'sv-dossier-export-btn';
    button.textContent = 'Dossiê técnico (ZIP)';
    button.title = 'Gerar relatório, croqui, memorial, coordenadas, confrontantes, CAR/SIGEF, GeoJSON, KML, Shapefile e metadados.';
    button.addEventListener('click', async () => {
      const previous = button.textContent;
      button.disabled = true; button.textContent = 'Gerando dossiê...';
      try { await generate(); }
      catch (error) { console.error(error); runtime()?.toast?.(error?.message || 'Falha ao gerar dossiê técnico.', 'error'); }
      finally { button.disabled = false; button.textContent = previous; document.querySelector('.sv-map-export-clean')?.removeAttribute('open'); }
    });
    menu.appendChild(button);
    const legacy = document.getElementById('exportZipBtn');
    if (legacy?.parentElement && !document.getElementById('dossierLegacyBtn')) {
      const clone = document.createElement('button'); clone.type = 'button'; clone.id = 'dossierLegacyBtn'; clone.textContent = 'Gerar dossiê técnico';
      clone.addEventListener('click', () => button.click());
      legacy.insertAdjacentElement('afterend', clone);
    }
    return true;
  }

  window.SurveyorProjectDossier = Object.freeze({ generate, lotDocuments });
  let attempts = 0;
  const timer = setInterval(() => { if (mount() || ++attempts > 40) clearInterval(timer); }, 120);
  mount();
})();
