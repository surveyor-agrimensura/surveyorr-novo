(() => {
  'use strict';

  const runtime = () => window.SurveyorMapRuntime;
  const levelWeight = { error: 15, warn: 5, info: 0, ok: 0 };

  function props(layer) { return layer?.feature?.properties || layer?.__geoMeta || {}; }
  function geo(layer) { try { return layer?.toGeoJSON?.() || null; } catch { return null; } }
  function layerName(layer, index = 0) { return String(props(layer).name || `Elemento ${index + 1}`); }

  function polygonRing(feature) {
    if (feature?.geometry?.type === 'Polygon') return feature.geometry.coordinates?.[0] || [];
    return [];
  }

  function uniqueRing(ring = []) {
    const out = ring.slice();
    if (out.length > 1) {
      const a = out[0], b = out[out.length - 1];
      if (a && b && Math.abs(Number(a[0]) - Number(b[0])) < 1e-12 && Math.abs(Number(a[1]) - Number(b[1])) < 1e-12) out.pop();
    }
    return out;
  }

  function meters(a, b) {
    try {
      if (window.turf?.distance) return turf.distance(turf.point(a), turf.point(b), { units: 'kilometers' }) * 1000;
    } catch {}
    const R = 6371008.8;
    const p1 = Number(a[1]) * Math.PI / 180, p2 = Number(b[1]) * Math.PI / 180;
    const dp = (Number(b[1]) - Number(a[1])) * Math.PI / 180;
    const dl = (Number(b[0]) - Number(a[0])) * Math.PI / 180;
    const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
  }

  function allCoordsValid(feature) {
    let valid = true, count = 0;
    const walk = (value) => {
      if (!Array.isArray(value)) return;
      if (value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))) {
        count += 1;
        const lng = Number(value[0]), lat = Number(value[1]);
        if (lng < -180 || lng > 180 || lat < -90 || lat > 90) valid = false;
        return;
      }
      value.forEach(walk);
    };
    walk(feature?.geometry?.coordinates);
    return valid && count > 0;
  }

  function auditItem(level, title, text, options = {}) {
    return { level, title, text, ...options };
  }

  function evaluate() {
    const rt = runtime();
    const map = rt?.map;
    const drawn = rt?.drawn;
    const projectData = rt?.getProjectData?.() || {};
    const project = projectData.project || {};
    const layers = drawn?.getLayers?.() || [];
    const results = [];

    results.push(project.propertyName || project.name
      ? auditItem('ok', 'Imóvel identificado', String(project.propertyName || project.name))
      : auditItem('error', 'Nome do imóvel ausente', 'Informe o nome do imóvel antes de finalizar.', { action: 'property-name' }));

    results.push(project.municipality
      ? auditItem('ok', 'Município definido', `${project.municipality}${project.stateCode ? `/${project.stateCode}` : ''}`)
      : auditItem('warn', 'Município não definido', 'Informe o município para completar os documentos e exportações.', { action: 'municipality' }));

    if (!layers.length) {
      results.push(auditItem('error', 'Nenhuma geometria', 'Desenhe ou importe pelo menos um perímetro.', { action: 'draw-polygon' }));
    } else {
      results.push(auditItem('ok', 'Geometrias presentes', `${layers.length} elemento(s) no projeto.`));
    }

    const perimeters = layers.filter((layer) => String(props(layer).category || '').toLowerCase() === 'perimetro' && /Polygon/i.test(String(geo(layer)?.geometry?.type || '')));
    if (perimeters.length === 1) results.push(auditItem('ok', 'Perímetro principal', 'Um perímetro principal identificado.'));
    else if (perimeters.length === 0) results.push(auditItem('warn', 'Perímetro principal não identificado', 'Defina um polígono com categoria Perímetro do imóvel.', { action: 'layers' }));
    else results.push(auditItem('warn', 'Múltiplos perímetros principais', `${perimeters.length} polígonos estão marcados como perímetro. Confirme qual representa o imóvel.`, { action: 'layers' }));

    let crsOk = layers.length > 0;
    layers.forEach((layer, index) => {
      const feature = geo(layer);
      if (!feature?.geometry) return;
      crsOk = crsOk && allCoordsValid(feature);
      if (/Polygon/i.test(String(feature.geometry.type || ''))) {
        const name = layerName(layer, index);
        let areaHa = 0;
        try { areaHa = Number(turf.area(feature) || 0) / 10000; } catch {}
        if (areaHa > 0) results.push(auditItem('ok', `${name}: área válida`, `${areaHa.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} ha.`));
        else results.push(auditItem('error', `${name}: área inválida`, 'O polígono não possui área positiva.', { action: 'focus-layer', layer }));

        try {
          const crossings = window.turf?.kinks ? turf.kinks(feature).features.length : 0;
          results.push(crossings
            ? auditItem('error', `${name}: autointerseção`, `${crossings} cruzamento(s) encontrado(s).`, { action: 'edit-layer', layer })
            : auditItem('ok', `${name}: sem autointerseções`, 'Nenhum cruzamento interno detectado.'));
        } catch {
          results.push(auditItem('warn', `${name}: topologia parcial`, 'Não foi possível executar toda a verificação de autointerseção.', { action: 'focus-layer', layer }));
        }

        if (feature.geometry.type === 'Polygon') {
          const ring = polygonRing(feature);
          const closed = ring.length >= 4 && Math.abs(Number(ring[0]?.[0]) - Number(ring[ring.length - 1]?.[0])) < 1e-12 && Math.abs(Number(ring[0]?.[1]) - Number(ring[ring.length - 1]?.[1])) < 1e-12;
          results.push(closed
            ? auditItem('ok', `${name}: perímetro fechado`, `${Math.max(0, ring.length - 1)} vértice(s).`)
            : auditItem('error', `${name}: perímetro aberto`, 'O anel externo não está fechado.', { action: 'edit-layer', layer }));

          const vertices = uniqueRing(ring);
          let closest = null;
          for (let i = 0; i < vertices.length; i += 1) {
            for (let j = i + 1; j < vertices.length; j += 1) {
              const d = meters(vertices[i], vertices[j]);
              if (d > 0 && d < 0.20 && (!closest || d < closest.distance)) closest = { i, j, distance: d };
            }
          }
          if (closest) {
            results.push(auditItem('warn', `${name}: vértices muito próximos`, `V-${String(closest.i + 1).padStart(2, '0')} e V-${String(closest.j + 1).padStart(2, '0')} estão a ${closest.distance.toFixed(2)} m.`, { action: 'edit-layer', layer }));
          }
        }

        if (String(props(layer).category || '').toLowerCase() === 'gleba' && areaHa > 0 && areaHa < 0.01) {
          results.push(auditItem('warn', `${name}: gleba muito pequena`, `Área de ${areaHa.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} ha. Confira se a divisão é intencional.`, { action: 'focus-layer', layer }));
        }
      }
    });

    results.push(crsOk
      ? auditItem('ok', 'Sistema de coordenadas identificado', 'Geometrias válidas em longitude/latitude (EPSG:4326); exportações oficiais podem converter para SIRGAS 2000 quando necessário.')
      : auditItem('error', 'Sistema de coordenadas inconsistente', 'Há coordenadas fora dos limites geográficos. Revise o CRS da importação.', { action: 'layers' }));

    perimeters.forEach((layer, index) => {
      const name = layerName(layer, index);
      const list = Array.isArray(props(layer).confrontantes) ? props(layer).confrontantes : [];
      const vertices = uniqueRing(polygonRing(geo(layer))).length;
      const filled = list.filter((item) => String(item?.nome || item?.name || '').trim()).length;
      const expected = Math.max(vertices, list.length);
      if (expected > 0 && filled >= expected) results.push(auditItem('ok', `${name}: confrontantes completos`, `${filled}/${expected} trechos identificados.`));
      else results.push(auditItem('warn', `${name}: confrontantes incompletos`, `${filled}/${expected || vertices} trecho(s) possuem nome de confrontante.`, { action: 'focus-layer', layer }));
    });

    const references = Array.isArray(projectData.referenceLayers) ? projectData.referenceLayers : [];
    const refNames = references.map((item) => String(item.name || '')).join(' ').toLowerCase();
    const carEvidence = /(\bcar\b|sicar|cefir)/i.test(refNames);
    const sigefEvidence = /(sigef|incra)/i.test(refNames);
    results.push(carEvidence
      ? auditItem('ok', 'CAR consultado/adicionado', 'Há referência CAR/SICAR/CEFIR no projeto atual.')
      : auditItem('warn', 'CAR sem evidência no projeto', 'Nenhuma camada ou referência CAR/SICAR/CEFIR está registrada no mapa atual.', { action: 'layers' }));
    results.push(sigefEvidence
      ? auditItem('ok', 'SIGEF/INCRA consultado/adicionado', 'Há referência SIGEF/INCRA no projeto atual.')
      : auditItem('warn', 'SIGEF/INCRA sem evidência no projeto', 'Nenhuma camada ou referência SIGEF/INCRA está registrada no mapa atual.', { action: 'layers' }));

    const penalty = results.reduce((sum, item) => sum + (levelWeight[item.level] || 0), 0);
    const score = Math.max(0, Math.min(100, 100 - penalty));
    const errors = results.filter((item) => item.level === 'error').length;
    const warnings = results.filter((item) => item.level === 'warn').length;
    const status = errors === 0 && score >= 85 ? 'PROJETO PRONTO PARA ENTREGA' : 'PROJETO REQUER REVISÃO';
    return { score, errors, warnings, status, results, generatedAt: new Date().toISOString() };
  }

  function runAction(item) {
    const rt = runtime();
    if (!item) return;
    const action = item.action;
    if (action === 'property-name') return document.getElementById('propertyName')?.focus();
    if (action === 'municipality') return document.getElementById('city')?.focus();
    if (action === 'draw-polygon') return document.getElementById('topQuickPolygonBtn')?.click();
    if (action === 'layers') return document.querySelector('[data-side-tab="layers"]')?.click();
    if (action === 'focus-layer' && item.layer) return rt?.focusLayer?.(item.layer);
    if (action === 'edit-layer' && item.layer) return rt?.beginEditLayer?.(item.layer);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  }

  function renderAudit(audit) {
    const dialog = document.getElementById('validationDialog');
    const list = document.getElementById('validationList');
    if (!dialog || !list) return false;
    dialog.classList.add('surveyor-project-audit-dialog');
    const title = dialog.querySelector('h2');
    const eyebrow = dialog.querySelector('.eyebrow');
    if (title) title.textContent = 'Verificar Projeto';
    if (eyebrow) eyebrow.textContent = 'CHECKLIST TÉCNICO';
    const valid = audit.results.filter((item) => item.level === 'ok').length;
    const total = audit.results.length;
    list.innerHTML = `
      <section class="sv-audit-summary">
        <div><strong>${escapeHtml(audit.status)}</strong><span>${audit.errors} erro(s) · ${audit.warnings} alerta(s) · ${valid} item(ns) válido(s)</span></div>
        <div class="sv-audit-score" aria-label="Nota técnica ${audit.score} de 100"><b>${audit.score}</b><small>/100</small><em>Pontuação técnica</em></div>
      </section>
      <section class="sv-audit-counters" aria-label="Resumo das verificações">
        <div class="is-error"><span>✕</span><b>${audit.errors}</b><small>Erro${audit.errors === 1 ? ' crítico' : 's críticos'}</small></div>
        <div class="is-warn"><span>⚠</span><b>${audit.warnings}</b><small>Alertas</small></div>
        <div class="is-ok"><span>✓</span><b>${valid}</b><small>Itens válidos</small></div>
        <div class="is-total"><b>${total}</b><small>Total de verificações</small></div>
      </section>
      <div class="sv-audit-list-head"><h3>Verificações do projeto</h3><select id="svAuditFilter" aria-label="Filtrar verificações"><option value="all">Todos (${total})</option><option value="error">Erros (${audit.errors})</option><option value="warn">Alertas (${audit.warnings})</option><option value="ok">Válidos (${valid})</option></select></div>
      <div class="sv-audit-items"></div>`;
    const host = list.querySelector('.sv-audit-items');
    audit.results.forEach((item) => {
      const row = document.createElement('article');
      row.className = `sv-audit-item is-${item.level}`;
      row.dataset.auditLevel = item.level;
      const icon = item.level === 'ok' ? '✓' : item.level === 'error' ? '✕' : item.level === 'warn' ? '⚠' : '•';
      row.innerHTML = `<span class="sv-audit-icon" aria-hidden="true">${icon}</span><div class="sv-audit-copy"><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.text)}</small></div>`;
      if (item.action) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'sv-audit-fix';
        button.textContent = 'Corrigir';
        button.addEventListener('click', () => { try { dialog.close(); } catch {} runAction(item); });
        row.appendChild(button);
      }
      host.appendChild(row);
    });
    const filter = list.querySelector('#svAuditFilter');
    filter?.addEventListener('change', () => {
      const value = filter.value;
      host.querySelectorAll('.sv-audit-item').forEach((row) => {
        row.hidden = value !== 'all' && row.dataset.auditLevel !== value;
      });
    });
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    return true;
  }

  function open() {
    const audit = evaluate();
    renderAudit(audit);
    return audit;
  }

  function serializable(audit = evaluate()) {
    return {
      score: audit.score,
      errors: audit.errors,
      warnings: audit.warnings,
      status: audit.status,
      generatedAt: audit.generatedAt,
      results: audit.results.map(({ level, title, text, action }) => ({ level, title, text, action: action || null }))
    };
  }

  window.SurveyorProjectAudit = Object.freeze({ evaluate, open, serializable });

  const legacy = document.getElementById('validateBtn');
  if (legacy) legacy.onclick = open;
})();
