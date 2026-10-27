(() => {
  'use strict';

  const VERSION = '1.0.0-rc.185.74';
  const geometry = () => globalThis.SurveyorProjectGeometry || null;
  const pageKey = () => String(location.pathname || '/').replace(/\/+$/,'') || '/';
  const clone = (value) => { try { return JSON.parse(JSON.stringify(value)); } catch { return value; } };
  const state = { projectId: '', scopeId: 'property', scopeLabel: 'Imóvel completo', project: null, select: null, scopeSelect: null };

  function projectSelect() {
    return document.getElementById('sheetProjectSelect') || document.getElementById('projectSelect');
  }

  function storageKey(projectId) {
    return `surveyor.documentScope.${pageKey()}.${String(projectId || '')}`;
  }

  function storedScope(projectId) {
    if (!projectId) return 'property';
    try { return sessionStorage.getItem(storageKey(projectId)) || 'property'; } catch { return 'property'; }
  }

  function persistScope(projectId, scopeId) {
    if (!projectId) return;
    try { sessionStorage.setItem(storageKey(projectId), String(scopeId || 'property')); } catch {}
  }

  async function loadProject(id) {
    if (!id || !globalThis.GeoRuralProjects) return null;
    try {
      const direct = await globalThis.GeoRuralProjects.get?.(id, true);
      if (direct) return direct;
    } catch {}
    try {
      const all = await globalThis.GeoRuralProjects.list?.({ full: true, refresh: true });
      return (all || []).find((item) => String(item?.id || '') === String(id)) || null;
    } catch { return null; }
  }

  function fieldHost(select) {
    if (!select) return null;
    return select.closest('label') || select.parentElement || null;
  }

  function installStyle() {
    if (document.getElementById('surveyor-document-scope-style')) return;
    const style = document.createElement('style');
    style.id = 'surveyor-document-scope-style';
    style.textContent = `
      .surveyor-document-scope-field{display:grid;gap:6px;min-width:0}
      .surveyor-document-scope-field select{width:100%;min-height:38px}
      .surveyor-document-scope-field small{color:#64748b;font-size:11px;line-height:1.35}
      .surveyor-document-scope-field.is-gleba select{border-color:#145edb;box-shadow:0 0 0 2px rgba(20,94,219,.08)}
    `;
    document.head.appendChild(style);
  }

  function ensureScopeSelect() {
    if (state.scopeSelect?.isConnected) return state.scopeSelect;
    const select = projectSelect();
    if (!select) return null;
    const existing = document.getElementById('documentScopeSelect');
    if (existing) { state.scopeSelect = existing; return existing; }
    installStyle();
    const label = document.createElement('label');
    label.className = 'surveyor-document-scope-field';
    label.innerHTML = '<span>Gerar para</span><select id="documentScopeSelect"><option value="property">Imóvel completo</option></select><small>Escolha uma gleba para gerar o documento exclusivamente dela.</small>';
    const host = fieldHost(select);
    if (host?.parentElement) host.insertAdjacentElement('afterend', label);
    else select.insertAdjacentElement('afterend', label);
    state.scopeSelect = label.querySelector('select');
    state.scopeSelect.addEventListener('change', () => {
      const id = String(projectSelect()?.value || state.projectId || '');
      const scopeId = String(state.scopeSelect.value || 'property');
      persistScope(id, scopeId);
      state.projectId = id;
      state.scopeId = scopeId;
      state.scopeLabel = state.scopeSelect.selectedOptions?.[0]?.textContent?.trim() || 'Imóvel completo';
      label.classList.toggle('is-gleba', scopeId !== 'property');
      globalThis.dispatchEvent(new CustomEvent('surveyor:document-scope-changed', { detail: { projectId: id, scopeId, label: state.scopeLabel } }));
      const projectEl = projectSelect();
      if (projectEl) projectEl.dispatchEvent(new Event('change', { bubbles: true }));
    });
    return state.scopeSelect;
  }

  function fillScopes(project) {
    const scopeSelect = ensureScopeSelect();
    if (!scopeSelect) return;
    const projectId = String(project?.id || projectSelect()?.value || '');
    const entries = geometry()?.listGlebas?.(project) || [];
    const saved = storedScope(projectId);
    scopeSelect.innerHTML = '<option value="property">Imóvel completo</option>';
    entries.forEach((entry) => scopeSelect.add(new Option(entry.label, entry.id)));
    const exists = [...scopeSelect.options].some((option) => option.value === saved);
    scopeSelect.value = exists ? saved : 'property';
    state.projectId = projectId;
    state.scopeId = scopeSelect.value;
    state.scopeLabel = scopeSelect.selectedOptions?.[0]?.textContent?.trim() || 'Imóvel completo';
    state.project = project || null;
    const field = scopeSelect.closest('.surveyor-document-scope-field');
    field?.classList.toggle('is-gleba', state.scopeId !== 'property');
    // UX comercial: a escolha de escopo só faz sentido quando o projeto possui glebas.
    // Em imóvel único o campo some completamente, evitando espaço e opção redundantes.
    if (field) field.hidden = !entries.length;
    scopeSelect.disabled = !entries.length;
    const help = field?.querySelector('small');
    if (help) help.textContent = entries.length
      ? `${entries.length} gleba(s) disponível(is). Escolha uma gleba ou mantenha “Imóvel completo”.`
      : '';
  }

  async function refreshForProject() {
    const select = projectSelect();
    if (!select) return;
    const id = String(select.value || '');
    if (!id) {
      fillScopes(null);
      return;
    }
    if (state.project?.id === id && state.project?.geojson?.features?.length) {
      fillScopes(state.project);
      return;
    }
    const project = await loadProject(id);
    fillScopes(project);
  }

  function currentScopeId(project) {
    const id = String(project?.id || state.projectId || '');
    if (!id) return state.scopeId || 'property';
    return storedScope(id);
  }

  function apply(project) {
    if (!project) return project;
    if (window.SurveyorBatchDocumentContext?.active) return project;
    const scopeId = currentScopeId(project);
    if (!scopeId || scopeId === 'property') return project;
    const g = geometry();
    const entry = (g?.listGlebas?.(project) || []).find((item) => item.id === scopeId);
    if (!entry?.feature) return project;

    const copy = clone(project);
    const label = entry.label || 'Gleba selecionada';
    const scopedFeature = g?.normalizeScopedGleba?.(entry.feature, label) || clone(entry.feature);
    if (!scopedFeature?.geometry) return project;
    scopedFeature.properties = {
      ...(scopedFeature.properties || {}),
      category: 'perimetro',
      documentScope: 'gleba',
      scopeLabel: label
    };

    copy.geojson = { type: 'FeatureCollection', features: [scopedFeature] };
    const baseTitle = String(project.propertyName || project.title || project.name || 'Imóvel rural').trim();
    const scopedTitle = `${baseTitle} — ${label}`;
    copy.propertyName = scopedTitle;
    copy.title = scopedTitle;
    copy.name = scopedTitle;
    copy.documentScope = { type: 'gleba', id: scopeId, label, sourceProjectId: project.id || '' };
    copy.metadata = { ...(copy.metadata || {}), documentScope: copy.documentScope };
    const scopedOwner = String(scopedFeature.properties?.owner || scopedFeature.properties?.heir || '').trim();
    if (scopedOwner) {
      copy.owner = scopedOwner;
      copy.ownerName = scopedOwner;
    }
    return copy;
  }

  function boot() {
    const select = projectSelect();
    if (!select || select.dataset.documentScopeBound === '1') return;
    select.dataset.documentScopeBound = '1';
    state.select = select;
    ensureScopeSelect();
    select.addEventListener('change', () => { setTimeout(refreshForProject, 0); });
    const observer = new MutationObserver(() => {
      if (select.value && select.value !== state.projectId) refreshForProject();
    });
    observer.observe(select, { childList: true, subtree: true });
    refreshForProject();
  }

  globalThis.SurveyorDocumentScope = Object.freeze({
    version: VERSION,
    apply,
    getScopeId: currentScopeId,
    refresh: refreshForProject,
    getState: () => ({ projectId: state.projectId, scopeId: state.scopeId, scopeLabel: state.scopeLabel }),
    getLabel: () => state.scopeLabel
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
