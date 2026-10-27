/* Surveyor UI runtime consolidado. */

/* ===== Compatibilidade de interface consolidada ===== */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const page = document.body?.dataset?.page || location.pathname.split('/').pop() || '';

  function setupExclusiveTabs(buttonSelector, panelSelector, panelKeyPrefix, dataName) {
    const buttons = $$(buttonSelector);
    const panels = $$(panelSelector);
    if (!buttons.length || !panels.length) return;
    buttons.forEach((button) => {
      if (button.dataset.repairTabBound === 'true') return;
      button.dataset.repairTabBound = 'true';
      button.addEventListener('click', () => {
        const key = button.dataset[dataName];
        buttons.forEach((item) => item.classList.toggle('active', item === button));
        panels.forEach((panel) => panel.classList.toggle('active', panel.id === `${panelKeyPrefix}${key}` || panel.dataset.sidePanel === key));
        setTimeout(() => window.dispatchEvent(new Event('resize')), 120);
      });
    });
  }

  function setupMapPanelSafety() {
    if (page !== 'mapa.html') return;
    setupExclusiveTabs('[data-side-tab]', '[data-side-panel]', '', 'sideTab');
    const panel = $('#geoSidePanel');
    const workspace = $('.geo-workspace');
    const collapse = $('#sidePanelCollapse');
    let floating = $('#sidePanelFloatToggle');
    if (!panel || !workspace) return;
    if (!floating) {
      floating = document.createElement('button');
      floating.id = 'sidePanelFloatToggle';
      floating.className = 'sidepanel-floating-toggle';
      floating.type = 'button';
      floating.title = 'Mostrar painel lateral';
      floating.setAttribute('aria-label', 'Mostrar painel lateral');
      floating.innerHTML = '<span>☰</span><b>Painel</b>';
      workspace.insertBefore(floating, workspace.querySelector('.geo-map-stage'));
    }
    const sync = () => {
      const collapsed = panel.classList.contains('collapsed');
      workspace.classList.toggle('panel-collapsed', collapsed);
      floating.classList.toggle('visible', collapsed);
      floating.setAttribute('aria-hidden', collapsed ? 'false' : 'true');
      if (collapse) {
        collapse.textContent = collapsed ? '›' : '‹';
        collapse.title = collapsed ? 'Expandir painel' : 'Recolher painel';
      }
      setTimeout(() => window.dispatchEvent(new Event('resize')), 120);
    };
    if (collapse && collapse.dataset.repairBound !== 'true') {
      collapse.dataset.repairBound = 'true';
      collapse.addEventListener('click', () => setTimeout(sync, 0));
    }
    if (floating.dataset.repairBound !== 'true') {
      floating.dataset.repairBound = 'true';
      floating.addEventListener('click', () => {
        panel.classList.remove('collapsed');
        sync();
      });
    }
    sync();
  }

  function setupPortalTabs() {
    setupExclusiveTabs('[data-car-tab]', '.car-tab-panel', 'car-', 'carTab');
    setupExclusiveTabs('[data-sheet-tab]', '.sheet-tab-panel', 'sheet-', 'sheetTab');
  }

  function makePanelAccordions() {
    // Loteamentos/REURB agora usa o workspace documental por abas.
    // O acordeão legado duplicava o título da etapa e deixava uma seta solta.
    // Não transformar os painéis desta página antes do documents.js.
    if (['loteamentos-reurb.html','nuvem.html','acervos.html','customizacao.html'].includes(page)) return;
    const panels = $$('.main > section.panel');
    panels.forEach((panel, index) => {
      if (panel.dataset.accordionReady === 'true') return;
      const heading = panel.querySelector('.panel-heading h2, h2');
      const desc = panel.querySelector('.panel-heading .panel-desc, .panel-desc, p');
      const title = heading?.textContent?.trim() || `Etapa ${index + 1}`;
      const subtitle = desc?.textContent?.trim() || '';
      const body = document.createElement('div');
      body.className = 'module-accordion-body';
      while (panel.firstChild) body.append(panel.firstChild);
      const toggle = document.createElement('button');
      toggle.className = 'module-accordion-toggle';
      toggle.type = 'button';
      toggle.innerHTML = `<span><b>${title}</b>${subtitle ? `<small>${subtitle}</small>` : ''}</span><span>⌄</span>`;
      panel.classList.add('module-accordion-panel');
      if (index > 0) panel.classList.add('is-collapsed');
      panel.append(toggle, body);
      panel.dataset.accordionReady = 'true';
      toggle.addEventListener('click', () => panel.classList.toggle('is-collapsed'));
    });
  }

  function fixMemorialPrint() {
    // O Memorial possui gerador e impressão dedicados. Não substituir seus handlers.
    if (page === 'memorial.html') return;
    let host = $('.memorial-print-host');
    if (!host) {
      host = document.createElement('section');
      host.className = 'memorial-print-host';
      document.querySelector('.main')?.append(host);
    }
    const btn = $('#printOutput');
    if (!btn) return;
    btn.onclick = (event) => {
      event.preventDefault();
      const output = $('#memorialOutput');
      const html = output?.innerHTML?.trim();
      if (!html) {
        window.alert('Gere o memorial primeiro.');
        return;
      }
      host.innerHTML = `<article class="memorial-clean-document">${html}</article>`;
      const printWindow = window.open('', '_blank', 'width=960,height=720');
      if (!printWindow) {
        window.print();
        return;
      }
      printWindow.addEventListener('load', () => setTimeout(() => printWindow.print(), 250), { once: true });
      printWindow.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Memorial descritivo</title><style>
        body{margin:0;background:#fff;color:#111;font-family:Arial,sans-serif;line-height:1.55;padding:28px}
        .memorial-clean-document,.memorial-profissional{max-width:900px;margin:0 auto;background:#fff;color:#111}
        h1,h2,h3,p,b,span,small,td,th,li{color:#111!important}
        table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #cbd5e1;padding:6px;text-align:left}
        img,svg{max-width:100%;height:auto}.croqui-preview{background:#fff!important;padding:0!important}
        @page{margin:16mm} @media print{body{padding:0}}
      </style></head><body><article class="memorial-clean-document">${html}</article></body></html>`);
      printWindow.document.close();
    };
  }

  function markHeaderDisabledLinks() {
    $$('a.link-btn').forEach((link) => {
      if (link.textContent.trim().toLowerCase() === 'início' && link.href === location.href) link.classList.add('disabled');
    });
  }

  function triggerPreviewOnLoad() {
    if (page !== 'customizacao.html') return;
    setTimeout(() => $('#customizationForm')?.dispatchEvent(new Event('input', { bubbles: true })), 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  function init() {
    setupMapPanelSafety();
    setupPortalTabs();
    makePanelAccordions();
    fixMemorialPrint();
    markHeaderDisabledLinks();
    triggerPreviewOnLoad();
  }
})();


/* detalhes roláveis e reforço de desenho */
(() => {
  'use strict';
  function ready(fn){ document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn, { once:true }) : fn(); }
  ready(() => {
    const panel = document.getElementById('geoSidePanel');
    const workspace = document.querySelector('.geo-workspace');
    const collapse = document.getElementById('sidePanelCollapse');
    const float = document.getElementById('sidePanelFloatToggle');
    const sync = () => {
      const collapsed = panel?.classList.contains('collapsed');
      document.body.classList.toggle('map-panel-collapsed', !!collapsed);
      workspace?.classList.toggle('panel-collapsed', !!collapsed);
      if (collapse) {
        collapse.textContent = collapsed ? '›' : '‹';
        collapse.title = collapsed ? 'Expandir painel' : 'Recolher painel';
      }
      if (float) {
        float.innerHTML = '<span aria-hidden="true">›</span>';
        float.classList.toggle('visible', !!collapsed);
        float.setAttribute('aria-hidden', collapsed ? 'false' : 'true');
      }
    };
    collapse?.addEventListener('click', () => setTimeout(sync, 0));
    float?.addEventListener('click', () => setTimeout(sync, 0));
    sync();

    const details = document.getElementById('details');
    if (details && !details.querySelector('.details-handle')) {
      const handle = document.createElement('div');
      handle.className = 'details-handle';
      const title = document.createElement('div');
      title.className = 'details-handle-title';
      const swatch = document.createElement('span');
      swatch.className = 'details-color-swatch';
      swatch.setAttribute('aria-hidden', 'true');
      const label = document.createElement('b');
      label.textContent = 'Detalhes do elemento';
      title.append(swatch, label);
      const close = document.getElementById('closeDetails');
      handle.append(title);
      if (close) handle.append(close);
      details.prepend(handle);
    }
  });
})();


/* reforço visual do desenho */
(() => {
  'use strict';
  function ready(fn){ document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn, { once:true }) : fn(); }

  function enhanceDrawVisualState() {
    const map = document.getElementById('map');
    if (!map || map.dataset.drawRepair65 === 'true') return;
    map.dataset.drawRepair65 = 'true';

    const markDrawing = () => {
      document.body.classList.add('drawing-active');
      map.classList.add('is-drawing-live');
    };
    const unmarkDrawing = () => {
      map.classList.remove('is-drawing-live');
      setTimeout(() => {
        if (!document.querySelector('.leaflet-draw-guide-dash')) document.body.classList.remove('drawing-active');
      }, 150);
    };

    ['draw:drawstart','draw:editstart','draw:deletestart'].forEach((eventName) => {
      window.L && window.georuralMapInstance?.on?.(eventName, markDrawing);
    });

    ['draw:created','draw:drawstop','draw:edited','draw:editstop','draw:deleted','draw:deletestop'].forEach((eventName) => {
      window.L && window.georuralMapInstance?.on?.(eventName, unmarkDrawing);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') unmarkDrawing();
    });
  }

  ready(() => {
    enhanceDrawVisualState();
  });
})();


/* ===== Formulários inteligentes ===== */
(() => {
  'use strict';

  const MUNICIPALITY_API = 'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome';
  const CACHE_KEY = 'surveyor:municipios-br:v2';
  const CACHE_TTL = 1000 * 60 * 60 * 24 * 30;
  const ALL_UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

  const municipalityRules = new Map([
    ['carMunicipality', { ufTarget: 'carState' }],
    ['lotCity', { ufTarget: 'lotUf' }],
    ['city', { ufTarget: 'uf' }],
    ['planDocCity', { combined: true }],
    ['letterPlace', { combined: true }]
  ]);

  const maskRules = new Map([
    ['planDocClientDocument', 'cpfcnpj'],
    ['registrantDocument', 'cpfcnpj'],
    ['neighborDoc', 'cpfcnpj'],
    ['memOwnerCpf', 'cpfcnpj'],
    ['ownerCpf', 'cpfcnpj'],
    ['ownerRg', 'rg'],
    ['memOwnerRg', 'rg'],
    ['techRg', 'rg'],
    ['techDoc', 'cpfcnpj'],
    ['confrontanteDocumento', 'cpfcnpj'],

    ['planDocClientPhone', 'phone'],
    ['techPhone', 'phone'],
    ['phoneNumber', 'phone'],
    ['whatsappNumber', 'phone'],
    ['userWhatsapp', 'phone'],

    ['planDocClientEmail', 'email'],
    ['planDocAccessEmail', 'email'],
    ['planDocSupportEmail', 'email'],
    ['userEmail', 'email'],
    ['registrantEmail', 'email'],
    ['techEmail', 'email'],
    ['emailAddress', 'email'],
    ['supportEmail', 'email'],
    ['loginEmail', 'email'],
    ['loginSupportEmail', 'email'],

    ['carRegistration', 'registration'],
    ['memRegistration', 'registration'],
    ['memIncra', 'registration'],
    ['memCnib', 'registration'],
    ['mapRegistration', 'registration'],
    ['mapIncra', 'registration'],
    ['mapCnib', 'registration'],
    ['professionalRegistry', 'registration'],
    ['techCouncilNumber', 'registration'],
    ['techRt', 'registration']
  ]);

  const dynamicMaskRules = [
    ['.owner-doc', 'cpfcnpj'],
    ['input[id$=Cpf], input[id$=CPF], input[id$=Cnpj], input[id$=CNPJ]', 'cpfcnpj'],
    ['input[id$=Rg], input[id$=RG]', 'rg'],
    ['[data-registration-field="cpfCnpj"]', 'cpfcnpj']
  ];

  let municipalityPromise = null;
  let municipalityList = [];
  let activeInput = null;
  let activeIndex = -1;
  let requestSerial = 0;

  const dropdown = document.createElement('div');
  dropdown.className = 'sv-municipality-suggestions';
  dropdown.setAttribute('role', 'listbox');
  dropdown.setAttribute('aria-label', 'Sugestões de municípios');

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const onlyDigits = (value, max) => String(value || '').replace(/\D/g, '').slice(0, max);

  function getUf(item) {
    return item?.microrregiao?.mesorregiao?.UF?.sigla
      || item?.['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla
      || item?.uf
      || '';
  }

  function readCache() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (!parsed || !Array.isArray(parsed.items) || !parsed.savedAt) return null;
      if ((Date.now() - parsed.savedAt) > CACHE_TTL) return null;
      return parsed.items;
    } catch (_) {
      return null;
    }
  }

  function writeCache(items) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), items }));
    } catch (_) {}
  }

  async function loadMunicipalities() {
    if (municipalityList.length) return municipalityList;

    const cached = readCache();
    if (cached?.length) {
      municipalityList = cached;
      return municipalityList;
    }

    if (municipalityPromise) return municipalityPromise;

    municipalityPromise = fetch(MUNICIPALITY_API, { headers: { Accept: 'application/json' } })
      .then((response) => {
        if (!response.ok) throw new Error(`Falha ao carregar municípios (${response.status})`);
        return response.json();
      })
      .then((items) => items.map((item) => ({
        id: item.id,
        nome: item.nome,
        uf: getUf(item)
      })).filter((item) => item.nome && item.uf))
      .then((items) => {
        municipalityList = items;
        writeCache(items);
        return items;
      })
      .catch(() => municipalityList)
      .finally(() => { municipalityPromise = null; });

    return municipalityPromise;
  }

  function ensureUfOptions(field) {
    if (!(field instanceof HTMLSelectElement)) return;
    const existing = new Set(Array.from(field.options).map((option) => String(option.value || '').toUpperCase()));
    ALL_UFS.forEach((uf) => {
      if (existing.has(uf)) return;
      const option = document.createElement('option');
      option.value = uf;
      option.textContent = uf;
      field.appendChild(option);
    });
  }

  function setUf(input, rule, uf) {
    if (!uf) return;

    if (rule.combined) {
      input.value = `${input.dataset.svMunicipalityName || input.value.replace(/\/.*$/, '').trim()}/${uf}`;
      return;
    }

    const field = document.getElementById(rule.ufTarget || input.dataset.ufTarget || '');
    if (!field) return;
    ensureUfOptions(field);
    field.value = uf;
    if (field.value !== uf && field instanceof HTMLSelectElement) {
      const option = document.createElement('option');
      option.value = uf;
      option.textContent = uf;
      field.appendChild(option);
      field.value = uf;
    }
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function clearUf(input, rule) {
    if (rule.combined) return;
    const field = document.getElementById(rule.ufTarget || input.dataset.ufTarget || '');
    if (!field) return;
    field.value = '';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function positionDropdown(input) {
    const rect = input.getBoundingClientRect();
    dropdown.style.left = `${Math.round(rect.left)}px`;
    dropdown.style.top = `${Math.round(rect.bottom + 4)}px`;
    dropdown.style.width = `${Math.round(rect.width)}px`;
  }

  function closeDropdown() {
    dropdown.classList.remove('is-open');
    dropdown.replaceChildren();
    activeInput = null;
    activeIndex = -1;
  }

  function selectMunicipality(input, rule, item) {
    input.dataset.svSelecting = '1';
    input.dataset.municipalityId = String(item.id || '');
    input.dataset.uf = item.uf;
    input.dataset.svMunicipalityName = item.nome;
    input.value = rule.combined ? `${item.nome}/${item.uf}` : item.nome;
    setUf(input, rule, item.uf);
    closeDropdown();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    queueMicrotask(() => { delete input.dataset.svSelecting; });
  }

  function renderSuggestions(input, rule, items, serial) {
    if (serial !== requestSerial || document.activeElement !== input) return;
    dropdown.replaceChildren();
    activeIndex = -1;

    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'sv-municipality-empty';
      empty.textContent = 'Nenhum município encontrado.';
      dropdown.appendChild(empty);
    } else {
      items.forEach((item) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'sv-municipality-option';
        button.setAttribute('role', 'option');

        const strong = document.createElement('strong');
        strong.textContent = item.nome;
        const small = document.createElement('small');
        small.textContent = item.uf;
        button.append(strong, small);

        button.addEventListener('mousedown', (event) => {
          event.preventDefault();
          selectMunicipality(input, rule, item);
        });
        dropdown.appendChild(button);
      });
    }

    activeInput = input;
    positionDropdown(input);
    dropdown.classList.add('is-open');
  }

  async function updateSuggestions(input, rule) {
    if (input.dataset.svSelecting === '1') return;
    const raw = input.value.replace(/\/.*$/, '').trim();
    if (raw.length < 2) {
      closeDropdown();
      return;
    }

    const serial = ++requestSerial;
    const items = await loadMunicipalities();
    if (serial !== requestSerial || document.activeElement !== input) return;

    const query = normalize(raw);
    const starts = [];
    const contains = [];
    for (const item of items) {
      const name = normalize(item.nome);
      if (name.startsWith(query)) starts.push(item);
      else if (name.includes(query)) contains.push(item);
      if ((starts.length + contains.length) >= 30) break;
    }
    renderSuggestions(input, rule, starts.concat(contains).slice(0, 12), serial);
  }

  function handleMunicipalityKeydown(event) {
    if (!dropdown.classList.contains('is-open')) return;
    const options = Array.from(dropdown.querySelectorAll('.sv-municipality-option'));
    if (!options.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeIndex = Math.min(options.length - 1, activeIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeIndex = Math.max(0, activeIndex - 1);
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      options[activeIndex].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      return;
    } else if (event.key === 'Escape') {
      closeDropdown();
      return;
    } else {
      return;
    }

    options.forEach((option, index) => option.classList.toggle('is-active', index === activeIndex));
    options[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }

  function enhanceMunicipality(input, rule) {
    if (!(input instanceof HTMLInputElement) || input.dataset.svMunicipality === '1') return;
    input.dataset.svMunicipality = '1';
    input.autocomplete = 'off';
    input.setAttribute('aria-autocomplete', 'list');

    input.addEventListener('focus', () => updateSuggestions(input, rule));
    input.addEventListener('input', () => {
      if (input.dataset.svSelecting === '1') return;
      const selectedName = normalize(input.dataset.svMunicipalityName || '');
      const typedName = normalize(input.value.replace(/\/.*$/, ''));
      if (selectedName && typedName !== selectedName) {
        delete input.dataset.municipalityId;
        delete input.dataset.uf;
        delete input.dataset.svMunicipalityName;
        clearUf(input, rule);
      }
      updateSuggestions(input, rule);
    });
    input.addEventListener('keydown', handleMunicipalityKeydown);
    input.addEventListener('blur', () => window.setTimeout(() => {
      if (activeInput === input) closeDropdown();
    }, 150));
  }

  const formatCpfCnpj = (value) => {
    const digits = onlyDigits(value, 14);
    if (digits.length <= 11) {
      return digits
        .replace(/^(\d{3})(\d)/, '$1.$2')
        .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1-$2');
    }
    return digits
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\/\d{4})(\d)/, '$1-$2');
  };

  // RG não possui um padrão nacional único. Aplica pontuação paulista
  // apenas a números com 8-9 dígitos; demais formatos ficam preservados.
  const formatRg = (value) => {
    const normalized = String(value || '').toUpperCase().replace(/[^0-9X]/g, '').slice(0, 12);
    if (!/^[0-9]{1,8}[0-9X]?$/.test(normalized)) return normalized;
    if (normalized.length < 8) return normalized;
    return normalized.replace(/^([0-9]{2})([0-9]{3})([0-9]{3})([0-9X]?)$/, (all,a,b,c,d) => `${a}.${b}.${c}${d ? '-' + d : ''}`);
  };

  const formatPhone = (value) => {
    const digits = onlyDigits(value, 11);
    if (digits.length <= 10) {
      return digits
        .replace(/^(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    }
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2');
  };

  const formatCep = (value) => onlyDigits(value, 8).replace(/^(\d{5})(\d)/, '$1-$2');

  const formatFlexibleRegistration = (value) => String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9À-Üºª .,:;\-\/_]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trimStart();

  function validateEmail(input) {
    const value = input.value.trim().toLowerCase();
    input.value = value;
    if (!value) {
      input.classList.remove('sv-input-invalid', 'sv-input-valid');
      return;
    }
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
    input.classList.toggle('sv-input-invalid', !valid);
    input.classList.toggle('sv-input-valid', valid);
  }

  function maskFor(input) {
    if (input.dataset.svMaskType) return input.dataset.svMaskType;
    if (input.id && maskRules.has(input.id)) return maskRules.get(input.id);
    for (const [selector, mask] of dynamicMaskRules) {
      if (input.matches(selector)) return mask;
    }
    return '';
  }

  function applyValidation(input, mask) {
    if (mask === 'cpfcnpj') {
      const count = onlyDigits(input.value, 14).length;
      const valid = !count || count === 11 || count === 14;
      input.classList.toggle('sv-input-invalid', !valid);
      input.classList.toggle('sv-input-valid', valid && count > 0);
    } else if (mask === 'phone') {
      const count = onlyDigits(input.value, 11).length;
      const valid = !count || count === 10 || count === 11;
      input.classList.toggle('sv-input-invalid', !valid);
      input.classList.toggle('sv-input-valid', valid && count > 0);
    }
  }

  function enhanceMaskedField(input) {
    if (!(input instanceof HTMLInputElement) || input.dataset.svMask === '1') return;
    if (['hidden','file','checkbox','radio','button','submit','reset','date','number','range','color','password'].includes(input.type)) return;

    const mask = maskFor(input);
    if (!mask) return;

    input.dataset.svMask = '1';
    input.dataset.svMaskType = mask;

    if (mask === 'email') {
      input.type = 'email';
      input.autocomplete = 'email';
      if (input.value) validateEmail(input);
      input.addEventListener('blur', () => validateEmail(input));
      return;
    }

    if (mask === 'cpfcnpj' || mask === 'rg' || mask === 'phone' || mask === 'cep') input.inputMode = 'numeric';
    const formatter = mask === 'cpfcnpj' ? formatCpfCnpj
      : mask === 'rg' ? formatRg
      : mask === 'phone' ? formatPhone
      : mask === 'cep' ? formatCep
      : formatFlexibleRegistration;

    if (input.value) input.value = formatter(input.value);

    input.addEventListener('input', () => {
      const cursorAtEnd = input.selectionStart === input.value.length;
      input.value = formatter(input.value);
      if (cursorAtEnd) input.setSelectionRange?.(input.value.length, input.value.length);
      input.classList.remove('sv-input-invalid');
    });

    input.addEventListener('blur', () => {
      input.value = formatter(input.value).trim();
      applyValidation(input, mask);
    });
  }

  function markCompactPanels(root = document) {
    root.querySelectorAll?.('.main > .panel').forEach((panel) => {
      if (panel.querySelector('input, select, textarea, .form-grid')) panel.classList.add('sv-form-panel');
    });
  }

  function enhance(root = document) {
    for (const [id, rule] of municipalityRules) {
      const input = root === document ? document.getElementById(id) : root.querySelector?.(`#${CSS.escape(id)}`);
      if (input) enhanceMunicipality(input, rule);
      if (rule.ufTarget) ensureUfOptions(document.getElementById(rule.ufTarget));
    }

    root.querySelectorAll?.('input').forEach(enhanceMaskedField);
    markCompactPanels(root);
  }

  function init() {
    document.body.appendChild(dropdown);
    enhance(document);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (node.matches?.('input')) enhanceMaskedField(node);
          enhance(node);
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', () => activeInput && positionDropdown(activeInput));
    window.addEventListener('scroll', () => activeInput && positionDropdown(activeInput), true);
    document.addEventListener('mousedown', (event) => {
      if (!dropdown.contains(event.target) && event.target !== activeInput) closeDropdown();
    });
  }

  window.SurveyorSmartForms = Object.freeze({
    formatCpfCnpj,
    formatPhone,
    formatCep,
    formatRegistration: formatFlexibleRegistration,
    refresh: enhance
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();


/* ===== Regras comerciais de interface ===== */
(() => {
  'use strict';
  const BANNER_ID = 'surveyorRuntimeBanner';
  let readyTimer = 0;
  let lastHealthFailureAt = 0;

  function banner(message, kind = 'warning', options = {}) {
    let node = document.getElementById(BANNER_ID);
    if (!node) {
      node = document.createElement('div');
      node.id = BANNER_ID;
      node.className = 'surveyor-runtime-banner';
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      node.innerHTML = '<span class="surveyor-runtime-banner__message"></span><button type="button" aria-label="Fechar aviso">×</button>';
      node.querySelector('button').addEventListener('click', () => node.remove());
      document.body.appendChild(node);
    }
    node.dataset.kind = kind;
    node.querySelector('.surveyor-runtime-banner__message').textContent = String(message || '');
    if (options.sticky !== true) {
      clearTimeout(node._hideTimer);
      node._hideTimer = setTimeout(() => node.remove(), Number(options.duration || 7000));
    }
    return node;
  }

  function apiBase() {
    return String(window.GEORURAL_CONFIG?.apiBaseUrl || 'https://api.surveyorr.com.br').replace(/\/$/, '');
  }

  async function checkReadiness() {
    if (!navigator.onLine) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch(`${apiBase()}/api/health`, { cache: 'no-store', credentials: 'omit', signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (lastHealthFailureAt) {
        document.getElementById(BANNER_ID)?.remove();
        if (Date.now() - lastHealthFailureAt < 10 * 60_000) banner('Conexão com o Surveyor restabelecida.', 'success', { duration: 3600 });
      }
      lastHealthFailureAt = 0;
    } catch {
      lastHealthFailureAt = Date.now();
      banner('A API do Surveyor está temporariamente indisponível. Não feche a página: alterações ainda não enviadas permanecem guardadas neste navegador.', 'danger', { sticky: true });
    } finally { clearTimeout(timeout); }
  }

  function normalizeExternalLinks() {
    document.querySelectorAll('a[target="_blank"]').forEach((link) => {
      const values = new Set(String(link.rel || '').split(/\s+/).filter(Boolean));
      values.add('noopener'); values.add('noreferrer');
      link.rel = [...values].join(' ');
    });
  }

  function improveIconButtons(root = document) {
    root.querySelectorAll('button,[role="button"]').forEach((button) => {
      if (button.getAttribute('aria-label') || button.getAttribute('aria-labelledby')) return;
      const text = String(button.textContent || '').trim();
      const title = String(button.getAttribute('title') || '').trim();
      if (!text && title) button.setAttribute('aria-label', title);
    });
  }

  function stripSensitiveQuery() {
    const url = new URL(location.href);
    const sensitive = ['token', 'password', 'senha', 'refresh_token', 'access_token'];
    let changed = false;
    sensitive.forEach((key) => { if (url.searchParams.has(key)) { url.searchParams.delete(key); changed = true; } });
    if (changed && !location.pathname.includes('/public-project')) history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }

  window.addEventListener('offline', () => banner('Sem conexão com a internet. Continue com cuidado: o Surveyor tentará sincronizar quando a conexão voltar.', 'warning', { sticky: true }));
  window.addEventListener('online', () => { document.getElementById(BANNER_ID)?.remove(); clearTimeout(readyTimer); readyTimer = setTimeout(checkReadiness, 400); });
  window.addEventListener('georural:edit-conflict', () => banner('Este projeto foi alterado em outra sessão. A sua edição foi preservada como rascunho local; recarregue o projeto antes de decidir qual versão manter.', 'danger', { sticky: true }));
  window.addEventListener('georural:save-pending', () => banner('Não foi possível sincronizar agora. Uma cópia temporária da edição foi preservada neste navegador.', 'warning', { sticky: true }));
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason || {};
    if (reason?.requestId) console.error(`[Surveyor] erro não tratado. Identificador: ${reason.requestId}`, reason);
  });

  document.addEventListener('DOMContentLoaded', () => {
    stripSensitiveQuery();
    normalizeExternalLinks();
    improveIconButtons();
    const observer = new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => { if (node.nodeType === 1) { normalizeExternalLinks(); improveIconButtons(node); } })));
    observer.observe(document.documentElement, { childList: true, subtree: true });
    if (!navigator.onLine) banner('Sem conexão com a internet. Alterações não sincronizadas permanecerão apenas neste navegador.', 'warning', { sticky: true });
    else readyTimer = setTimeout(checkReadiness, 1200);
  });
})();

// Commercial readiness: substitui handlers HTML inline por delegação segura.
(() => {
  'use strict';
  if (globalThis.__SURVEYOR_SAFE_EVENT_BRIDGES__) return;
  globalThis.__SURVEYOR_SAFE_EVENT_BRIDGES__ = true;
  document.addEventListener('click', (event) => {
    const bridge = event.target?.closest?.('[data-click-target]');
    if (!bridge) return;
    const id = String(bridge.getAttribute('data-click-target') || '').trim();
    if (!id) return;
    const target = document.getElementById(id);
    if (!target || target === bridge) return;
    event.preventDefault();
    target.click();
  });
  document.addEventListener('error', (event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || image.getAttribute('data-hide-on-error') !== '1') return;
    image.style.display = 'none';
  }, true);
})();


/* ===== Runtime visual moderno ===== */
(() => {
  'use strict';
  const page = document.body?.dataset?.page || '';
  const $ = (id) => document.getElementById(id);
  const friendlyIcon = (name) => {
    const paths = {
      inicio:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5M9.5 20v-5.5h5V20"/>',
      projetos:'<path d="M4 6h6l2 2h8v11H4V6Z"/><path d="M8 12h8M8 15h5"/>',
      acervos:'<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
      memorial:'<path d="M6 3h9l4 4v14H6V3Z"/><path d="M15 3v5h5M9 12h7M9 16h7"/>',
      'assinatura-digital':'<path d="M6 3h9l4 4v14H6V3Z"/><path d="M15 3v5h5"/><path d="m8 16 2-2 2 2 4-5"/><path d="M8 19h8"/>',
      ods:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M10 4v16M15 4v16"/>',
      mapas:'<path d="m3 6 5-2 8 3 5-2v13l-5 2-8-3-5 2V6Z"/><path d="M8 4v13M16 7v13"/>',
      pranchas:'<path d="M4 4h16v16H4V4Z"/><path d="M7 8h10M7 12h4M14 12h3M7 16h10"/>',
      planialtimetria:'<path d="M4 18 9 12l3 3 4-7 4 10"/><path d="M4 20h16"/>',
      perimetros:'<circle cx="12" cy="12" r="8"/><path d="m8 15 3-7 5 3-4 5-4-1Z"/>',
      confrontacao:'<path d="M5 3h10l4 4v14H5V3Z"/><path d="M15 3v5h5M8 11h8M8 15h5"/><path d="m14.5 18.5 4-4 1.5 1.5-4 4-2 .5.5-2Z"/>',
      ambiental:'<path d="M19 4C11 4 5 8 5 14c0 3 2 5 5 5 6 0 9-7 9-15Z"/><path d="M5 19c2-5 5-8 10-11"/>',
      'consulta-car':'<path d="M4 6.5 12 3l8 3.5V12c0 4.6-3.1 7.4-8 9-4.9-1.6-8-4.4-8-9V6.5Z"/><path d="M8 12.5c2.8-4 6.1-4.9 9-4.5-1 4.2-3.4 7-7.2 7.1"/><path d="M8 17c1.1-2.4 2.8-4.2 5.5-5.6"/>',
      glebas:'<path d="M4 4h7v7H4V4ZM13 4h7v7h-7V4ZM4 13h7v7H4v-7ZM13 13h7v7h-7v-7Z"/><path d="M11 7h2M7 11v2M17 11v2M11 17h2"/>',
      'earth-3d':'<path d="M3 17 8 9l4 5 3-4 6 7"/><path d="M4 20h16"/><path d="M7 6c3-2 7-2 10 0"/><path d="M9 4c2-.8 4-.8 6 0"/>',
      loteamentos:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 4v16M15 4v16M4 10h16M4 15h16"/>',
      customizacao:'<path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M8 14v6"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
      admin:'<path d="M12 3 20 6v5c0 5-3.3 8.2-8 10-4.7-1.8-8-5-8-10V6l8-3Z"/><path d="M9.5 12 11 13.5l3.5-4"/>',
      suporte:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.7 2.7 0 1 1 4.8 1.7c-.9 1-2.3 1.2-2.3 2.6M12 17h.01"/>'
    };
    return `<svg class="sv-friendly-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.inicio}</svg>`;
  };

  function ensureHeader(main, title, subtitle, actionHtml = '') {
    if (!main || main.querySelector(':scope > header.top')) return;
    const head = document.createElement('header');
    head.className = 'top sv-modern-generated-head';
    head.innerHTML = `<div><h1>${title}</h1><p>${subtitle}</p></div>${actionHtml ? `<div class="top-actions">${actionHtml}</div>` : ''}`;
    main.prepend(head);
  }

  function updateSimpleHeaders() {
    const main = document.querySelector('.main');
    if (page === 'nuvem.html') ensureHeader(main, 'Projetos', 'Gerencie seus projetos de campo, dados topográficos e arquivos sincronizados com a nuvem.', '<a class="sv-projects-new-btn" href="/mapa/">＋&nbsp; Novo projeto</a>');
    if (page === 'acervos.html') ensureHeader(main, 'Acervos Oficiais', 'Acesse bases, cadastros e portais públicos utilizados no fluxo técnico do Surveyor.');
    if (page === 'suporte.html') {
      const h1 = main?.querySelector('.top h1'); const p = main?.querySelector('.top p');
      if (h1) h1.textContent = 'Central de Suporte';
      if (p) p.textContent = 'Atendimento técnico especializado para agrimensura, georreferenciamento e uso do Surveyor.';
    }
    if (page === 'admin.html') {
      const h1 = main?.querySelector('.top h1'); const p = main?.querySelector('.top p');
      if (h1) h1.textContent = 'Administração do Sistema';
      if (p) p.textContent = 'Gestão administrativa completa do Surveyor.';
    }
  }

  function enhanceProjects() {
    if (page !== 'nuvem.html') return;
    const toolbar = document.querySelector('.projects-toolbar');
    if (toolbar && !toolbar.querySelector('.sv-projects-live-count')) {
      const count = document.createElement('span'); count.className = 'sv-projects-live-count';
      const sync = () => { const value = $('projectsCount')?.textContent || '0'; count.textContent = `${value} projeto${value === '1' ? '' : 's'} encontrado${value === '1' ? '' : 's'}`; };
      toolbar.appendChild(count); sync();
      const target = $('projectsCount'); if (target) new MutationObserver(sync).observe(target,{childList:true,subtree:true,characterData:true});
    }
  }

  function modernizeSupport() {
    if (page !== 'suporte.html') return;
    const layout = document.querySelector('.support-layout');
    const old = layout?.querySelector('.support-info-card');
    if (!layout || !old || layout.querySelector('.support-info-stack')) return;
    const stack = document.createElement('aside');
    stack.className = 'support-info-stack';
    stack.innerHTML = `
      <article class="support-mini-card"><span class="support-mini-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg></span><div><strong>E-mail Direto</strong><a href="mailto:suporte@surveyorr.com.br">suporte@surveyorr.com.br</a></div></article>
      <article class="support-mini-card"><span class="support-mini-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H20v17H7.5A3.5 3.5 0 0 0 4 22V5.5Z"/><path d="M4 18.5A3.5 3.5 0 0 1 7.5 15H20"/></svg></span><div><strong>Manuais Técnicos</strong><span>Guias passo a passo do sistema e dos módulos técnicos.</span></div></article>
      <article class="support-mini-card"><span class="support-mini-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span><div><strong>Horário de Atendimento</strong><span>Segunda a Sexta, das 08h às 18h (Horário de Brasília).</span></div></article>`;
    old.replaceWith(stack);
  }


  function deployBase() {
    const meta = document.querySelector('meta[name="surveyor-deploy-base"]')?.content;
    if (meta) return String(meta).replace(/\/$/, '');
    const parts = location.pathname.split('/').filter(Boolean);
    if (/github\.io$/i.test(location.hostname) && parts.length) return `/${parts[0]}`;
    return '';
  }
  function modernizeToolsMenu() {
    const menu = document.getElementById('svHomeToolsMenu');
    if (!menu) return;
    // A lista inicial vem do layout.js com as permissões aplicadas. O agrupamento
    // não pode descartar a Central de Lotes nem reintroduzir links não autorizados.
    const consultaPresent = Boolean(menu.querySelector('a[data-tool-route="/consulta-car"], a[href$="/consulta-car/"]'));
    if (menu.dataset.modernGrouped === '3' && consultaPresent) return;
    const base = deployBase();
    const pathOf = (a) => { try { return new URL(a.href, location.href).pathname.replace(base, '').replace(/\/$/, '') || '/'; } catch { return ''; } };
    const originals = new Map([...menu.querySelectorAll('a')].map(a => [pathOf(a), a]));
    const quick = new Set([...document.querySelectorAll('.sv-home-nav a')].map(pathOf));
    const allowed = (path) => path === '/consulta-car' || originals.has(path) || quick.has(path);
    const definitions = [
      ['Produção técnica', [
        ['/mapa','mapa-cadastro','Mapa e Cadastro','GIS, edição vetorial e camadas'],
        ['/memorial','memorial','Memorial Descritivo','Normas INCRA / SIGEF / CRI'],
        ['/mapas','mapas','Mapas e Croquis','Pranchas técnicas de satélite'],
        ['/pranchas','pranchas','Pranchas Técnicas','Layouts A0, A1, A2, A3 e A4'],
        ['/planialtimetria','planialtimetria','Planialtimetria / MDT','Curvas de nível e relevo']
      ]],
      ['Documentos e consulta', [
        ['/perimetros','perimetros','Perímetros por Azimute','Cálculo de fechamento e rumo'],
        ['/confrontacao','confrontacao','Cartas de Confrontação','Notificação de confrontantes'],
        ['/consulta-car','consulta-car','Consulta Pública CAR','Pesquisa em dados públicos do Cadastro Ambiental Rural'],
        ['/ods','ods','Planilha ODS','Planilha técnica de vértices'],
        ['/ambiental','ambiental','Relatório Ambiental','Sobreposição de APPs e reserva']
      ]],
      ['Análise e campo', [
        ['/nuvem','nuvem','Projetos','Armazenamento na nuvem'],
        ['/central-lotes','loteamentos','Central de Lotes','Gerar peças individuais por lote em ZIP'],
        ['/acervos','acervos','Acervos Oficiais','SIGEF, INCRA e portais públicos'],
        ['/loteamentos-reurb','loteamentos','Loteamentos / REURB','Regularização fundiária'],
        ['/customizacao','customizacao','Personalização','Logotipo e modelos da empresa']
      ]],
      ['Gestão', [
        ['/admin','admin','Administração','Controle de equipe e planos']
      ]]
    ];
    menu.innerHTML = '';
    definitions.forEach(([title, items]) => {
      const visible = items.filter(([path]) => allowed(path));
      if (!visible.length) return;
      const section = document.createElement('section');
      section.innerHTML = `<h3>${title}</h3>`;
      visible.forEach(([path, icon, label, desc]) => {
        const a = document.createElement('a'); a.href = `${base}${path}/`; a.setAttribute('role','menuitem');
        a.dataset.toolRoute = path;
        const iconKey = ({'mapa-cadastro':'mapas','nuvem':'projetos'}[icon] || icon);
        a.innerHTML = `<span class="tool-icon"><span class="module-icon-safe">${friendlyIcon(iconKey)}</span></span><span><b>${label}</b><small>${desc}</small></span>`;
        section.appendChild(a);
      });
      menu.appendChild(section);
    });
    menu.dataset.modernGrouped = '3';
  }

  function usageQuotaLabel(used, limit) {
    const consumed = Math.max(0, Number(used || 0));
    if (limit == null) return { main: 'Ilimitado', detail: `${consumed} usado(s) hoje` };
    const cap = Math.max(0, Number(limit || 0));
    const remaining = Math.max(0, cap - consumed);
    return { main: `${remaining} restante(s)`, detail: `${consumed} de ${cap} usado(s)` };
  }

  function usageDateLabel(usage) {
    const raw = String(usage?.day || '').trim();
    if (!raw) return 'Hoje';
    const date = new Date(`${raw}T12:00:00`);
    if (!Number.isFinite(date.getTime())) return 'Hoje';
    return new Intl.DateTimeFormat('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' }).format(date);
  }

  function renderAccountUsage(usage) {
    document.querySelectorAll('.workspace-account-usage').forEach((host) => {
      const downloads = usageQuotaLabel(usage?.downloads, usage?.downloadLimit);
      const exports = usageQuotaLabel(usage?.exports, usage?.exportLimit);
      host.querySelector('[data-account-usage-date]').textContent = usageDateLabel(usage);
      host.querySelector('[data-account-download-main]').textContent = usage ? downloads.main : 'Carregando…';
      host.querySelector('[data-account-download-detail]').textContent = usage ? downloads.detail : 'Consultando a franquia atual';
      host.querySelector('[data-account-export-main]').textContent = usage ? exports.main : 'Carregando…';
      host.querySelector('[data-account-export-detail]').textContent = usage ? exports.detail : 'Consultando a franquia atual';
    });
  }

  async function refreshAccountUsage() {
    const auth = window.GeoRuralAuth || window.SurveyorAuth;
    if (!auth?.loadUsageStatus) return;
    try {
      const usage = await auth.loadUsageStatus();
      window.__surveyorDailyUsage = usage || null;
      renderAccountUsage(usage || null);
    } catch {
      renderAccountUsage(window.__surveyorDailyUsage || null);
    }
  }

  function setupAccountMenu() {
    document.querySelectorAll('.account-zone.workspace-topbar-account').forEach((zone) => {
      if (zone.dataset.modernAccount === '2') return;
      zone.dataset.modernAccount = '2';
      const logout = zone.querySelector('.account-logout');
      if (!logout) return;

      zone.querySelector('.account-menu-toggle')?.remove();
      zone.querySelector('.workspace-account-menu')?.remove();

      const menu = document.createElement('div');
      menu.className = 'workspace-account-menu hidden';
      menu.setAttribute('role', 'menu');

      const usage = document.createElement('section');
      usage.className = 'workspace-account-usage';
      usage.innerHTML = `
        <div class="workspace-account-usage-head"><strong>Franquias de hoje</strong><span data-account-usage-date>Hoje</span></div>
        <div class="workspace-account-usage-row"><span class="workspace-account-usage-icon" aria-hidden="true">↓</span><span><b>Downloads</b><small data-account-download-detail>Consultando a franquia atual</small></span><strong data-account-download-main>Carregando…</strong></div>
        <div class="workspace-account-usage-row"><span class="workspace-account-usage-icon is-export" aria-hidden="true">↑</span><span><b>Exportações</b><small data-account-export-detail>Consultando a franquia atual</small></span><strong data-account-export-main>Carregando…</strong></div>`;

      const divider = document.createElement('div');
      divider.className = 'workspace-account-menu-divider';
      const support = document.createElement('a');
      support.href = '/suporte/';
      support.textContent = 'Central de Suporte';
      support.setAttribute('role', 'menuitem');
      logout.remove();
      logout.setAttribute('role', 'menuitem');
      menu.append(usage, divider, support, logout);
      zone.appendChild(menu);

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'account-menu-toggle';
      toggle.setAttribute('aria-label', 'Abrir menu da conta');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.innerHTML = '<span aria-hidden="true">⌄</span>';
      zone.insertBefore(toggle, menu);

      const close = () => { menu.classList.add('hidden'); toggle.setAttribute('aria-expanded','false'); };
      toggle.addEventListener('click', (event) => {
        event.stopPropagation();
        const willOpen = menu.classList.contains('hidden');
        document.querySelectorAll('.workspace-account-menu:not(.hidden)').forEach((other) => { if (other !== menu) other.classList.add('hidden'); });
        menu.classList.toggle('hidden', !willOpen);
        toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        if (willOpen) {
          renderAccountUsage(window.__surveyorDailyUsage || null);
          refreshAccountUsage();
        }
      });
      document.addEventListener('click', (event) => { if (!zone.contains(event.target)) close(); });
      renderAccountUsage(window.__surveyorDailyUsage || null);
    });

    if (!window.__surveyorAccountUsageBound) {
      window.__surveyorAccountUsageBound = true;
      window.addEventListener('surveyor:usage-updated', (event) => renderAccountUsage(event.detail || null));
      window.addEventListener('surveyor:usage-rendered', (event) => renderAccountUsage(event.detail || null));
    }
  }

  function setupAdminTeamsTab() {
    if (page !== 'admin.html') return;
    const tabs = document.querySelector('.admin-tabs');
    const usersPanel = $('tab-users');
    if (!tabs || !usersPanel || tabs.querySelector('[data-tab="teams-modern"]')) return;
    const tab = document.createElement('button'); tab.type='button'; tab.dataset.tab='teams-modern'; tab.textContent='Equipes';
    const first = tabs.querySelector('button'); first?.insertAdjacentElement('afterend',tab);
    const panel = document.createElement('section'); panel.id='tab-teams-modern'; panel.className='panel admin-panel';
    panel.innerHTML='<div><span class="eyebrow">EQUIPES</span><h2>Equipes / Subusuários</h2><p class="panel-desc">Selecione a conta principal para gerenciar seus subusuários.</p></div><div id="svAdminTeamGrid" class="sv-admin-team-grid"></div>';
    usersPanel.insertAdjacentElement('afterend',panel);
    const activate = () => { tabs.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===tab)); document.querySelectorAll('.admin-panel').forEach(p=>p.classList.toggle('active',p===panel)); render(); };
    tab.addEventListener('click',activate);
    const render = () => {
      const grid = $('svAdminTeamGrid'); if (!grid) return;
      const buttons = [...document.querySelectorAll('#adminUsersTable [data-user-action="team"]')];
      if (!buttons.length) { grid.innerHTML='<div class="empty-box">Nenhuma conta principal disponível para equipe.</div>'; return; }
      grid.innerHTML='';
      buttons.forEach((source,index)=>{
        const row=source.closest('tr');
        const label=(row?.querySelector('.user-name')?.textContent || `Conta ${index+1}`).trim();
        const b=document.createElement('button'); b.type='button'; b.className='sv-admin-team-owner'; b.textContent=label; b.addEventListener('click',()=>source.click()); grid.appendChild(b);
      });
    };
    const table=$('adminUsersTable'); if(table) new MutationObserver(()=>{if(panel.classList.contains('active')) render()}).observe(table,{childList:true,subtree:true});
  }

  function mapItem(node,label,extra='') {
    if(!node) return null;
    node.classList.add('sv-map-toolbar-item'); if(extra) node.classList.add(extra);
    [...node.childNodes].forEach((child) => { if (child.nodeType === Node.TEXT_NODE) child.textContent = ''; });
    node.querySelectorAll(':scope > span:not(.sv-map-label), :scope > b').forEach((child) => child.remove());
    let labelNode=node.querySelector('.sv-map-label');
    if(!labelNode){ labelNode=document.createElement('span'); labelNode.className='sv-map-label'; node.appendChild(labelNode); }
    labelNode.textContent=label; return node;
  }

  function proxyButton(label, svg, click) {
    const b=document.createElement('button'); b.type='button'; b.className='sv-map-toolbar-item'; b.innerHTML=`${svg}<span class="sv-map-label">${label}</span>`; b.addEventListener('click',click); return b;
  }

  function modernizeMapNav() {
    if (page !== 'mapa.html') return;
    const mapNav=$('mapGlobalNav');
    if (!mapNav) return;
    const nav=mapNav?.querySelector('.nav');
    const alreadyModern = mapNav.dataset.modernFriendlyNav === '1'
      && nav
      && [...nav.querySelectorAll(':scope > a')].every((a) => a.dataset.svModernNav === '1')
      && !nav.querySelector('.nav-icon-image');
    if (alreadyModern) return;
    const brand=mapNav.querySelector('.brand');
    if (brand) {
      brand.innerHTML = `<a class="sv-map-brand-wordmark" href="/" aria-label="Surveyor, página inicial"><img src="/assets/nome.png" alt="SURVEYOR"></a><button id="mapGlobalNavClose" class="map-global-nav-close" type="button" aria-label="Fechar menu">×</button>`;
      brand.querySelector('#mapGlobalNavClose')?.addEventListener('click',(event)=>{event.preventDefault();event.stopPropagation();document.body.classList.remove('map-nav-open');mapNav?.classList.remove('open');});
    }
    if(!nav) return;
    const base=deployBase();
    const defs=[
      ['/','inicio','Início'],['/nuvem','projetos','Projetos'],['/acervos','acervos','Acervos oficiais'],['/memorial','memorial','Memorial descritivo'],
      ['/ods','ods','Planilha ODS'],['/mapas','mapas','Mapas e croquis'],['/pranchas','pranchas','Pranchas técnicas'],
      ['/planialtimetria','planialtimetria','Planialtimetria'],['/perimetros','perimetros','Perímetros por azimute'],['/ambiental','ambiental','Relatório ambiental'],
      ['/loteamentos-reurb','loteamentos','Loteamentos / REURB'],['/customizacao','customizacao','Personalização'],['/suporte','suporte','Suporte']
    ];
    const oldPaths=new Set([...nav.querySelectorAll('a')].map(a=>{try{return new URL(a.href,location.href).pathname.replace(/\/$/,'')||'/'}catch{return ''}}));
    const frag=document.createDocumentFragment();
    defs.forEach(([path,icon,label])=>{
      if (path !== '/suporte' && path !== '/' && oldPaths.size && !oldPaths.has(path)) return;
      const a=document.createElement('a'); a.href=`${base}${path === '/' ? '/' : `${path}/`}`;
      a.dataset.svModernNav='1';
      a.innerHTML=`<span class="nav-icon">${friendlyIcon(icon)}</span><span>${label}</span>`; frag.appendChild(a);
    });
    nav.replaceChildren(frag);
    mapNav.dataset.modernFriendlyNav='1';

    // O portal autentica de forma assíncrona e pode reconstruir a navegação
    // depois desta rotina. Observe qualquer retorno do menu legado e refaça
    // imediatamente o drawer amigável, sem deixar os ícones azuis antigos.
    if (mapNav.dataset.modernNavObserver !== '1') {
      mapNav.dataset.modernNavObserver='1';
      let scheduled=false;
      const observer=new MutationObserver(()=>{
        if (scheduled) return;
        const currentNav=mapNav.querySelector('.nav');
        const legacyReturned=Boolean(currentNav?.querySelector('.nav-icon-image'))
          || Boolean(currentNav && [...currentNav.querySelectorAll(':scope > a')].some((a)=>a.dataset.svModernNav!=='1'));
        if (!legacyReturned) return;
        scheduled=true;
        requestAnimationFrame(()=>{
          scheduled=false;
          delete mapNav.dataset.modernFriendlyNav;
          modernizeMapNav();
        });
      });
      observer.observe(nav,{childList:true,subtree:true});
    }
  }

  window.SurveyorModernizeMapNav = () => {
    const mapNav=$('mapGlobalNav');
    if (mapNav) delete mapNav.dataset.modernFriendlyNav;
    modernizeMapNav();
  };
  document.addEventListener('surveyor:map-nav-source-updated', () => {
    requestAnimationFrame(() => window.SurveyorModernizeMapNav?.());
  });

  // Layout da bandeja compacta: usa as divisas REAIS, não um valor fixo.
  // Função sem dependência do DOM para facilitar os testes de alinhamento.
  function calculateMapQuickDrawerLayout(startEdge, endEdge, viewportWidth) {
    const viewport=Math.max(1, Math.round(Number(viewportWidth) || 0));
    const margin=8;
    let left=Math.round(Number(startEdge));
    let right=Math.round(Number(endEdge));
    if (!Number.isFinite(left) || !Number.isFinite(right) || left<margin || right>viewport-margin || right-left<300) {
      // Barra horizontalmente rolável ou viewport pequeno: posicionar dentro
      // da janela sem cortar comandos, em vez de tentar alinhar divisas ocultas.
      const fallbackWidth=Math.max(1,Math.min(620,viewport-2*margin));
      left=Math.max(margin, Math.min(Number.isFinite(left) ? left : margin,viewport-margin-fallbackWidth));
      right=left+fallbackWidth;
    }
    const width=Math.max(1,right-left);
    const innerWidth=Math.max(1,width-22); // 10px de padding em cada lado + bordas
    const columns=Math.max(1,Math.min(13,Math.floor((innerWidth+6)/46)));
    return {left,width,columns};
  }

  function modernizeMap() {
    if (page !== 'mapa.html') return;
    modernizeMapNav();
    const header=document.querySelector('.geo-brandbar.map-onebar');
    const toolstrip=header?.querySelector('.geo-toolstrip');
    if(!header||!toolstrip) return;

    // Never move the legacy controls into the modern bar. The legacy map CSS
    // assigns widths/positions to them and would break the new one-line header.
    // Keep them hidden in place and use clean proxy buttons that call the same
    // already-tested handlers.
    if (header.querySelector('.sv-map-toolbar-modern')) return;

    const svgOf=(node,fallback='') => node?.querySelector?.('svg')?.outerHTML || fallback;
    const proxyFrom=(source,label,fallbackSvg,extra='') => {
      if(!source) return null;
      const b=proxyButton(label,svgOf(source,fallbackSvg),()=>source.click());
      if(extra) b.classList.add(extra);
      b.dataset.proxyFor=source.id || '';
      return b;
    };
    const sep=()=>{const s=document.createElement('i');s.className='sv-map-toolbar-separator';s.setAttribute('aria-hidden','true');return s};

    const center=document.createElement('div');
    center.className='sv-map-toolbar-modern';
    center.setAttribute('aria-label','Ferramentas principais do mapa');

    const save=proxyFrom($('saveBtn'),'Salvar','<svg viewBox="0 0 24 24"><path d="M5 4h12l2 2v14H5V4Zm3 0v6h8V4M8 20v-7h8v7"/></svg>');
    const versions=proxyFrom($('projectVersionsBtn'),'Versões','<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>');
    const layers=proxyButton('Camadas','<svg viewBox="0 0 24 24"><path d="m12 3 8 4-8 4-8-4 8-4Zm8 8-8 4-8-4m16 4-8 4-8-4"/></svg>',()=>document.querySelector('[data-side-tab="layers"]')?.click());
    const poly=proxyFrom($('topQuickPolygonBtn'),'Polígono','<svg viewBox="0 0 24 24"><path d="M5 5l12 2 2 10-10 2-5-8Z"/></svg>');
    const point=proxyFrom($('topQuickMarkPointBtn'),'Marcar ponto','<svg viewBox="0 0 24 24"><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></svg>');
    // Cada controle declara seu comportamento visual. A barra não pode
    // confundir um clique pontual (Versões, Importar, Compartilhar, Verificar)
    // com um modo persistente de trabalho.
    if(save) save.dataset.svActivation='panel';
    if(versions) versions.dataset.svActivation='action';
    if(layers) layers.dataset.svActivation='panel';
    if(poly) poly.dataset.svActivation='tool';
    if(point) point.dataset.svActivation='dialog';

    const legacyMore=$('mapQuickToolsToggle');
    let drawer=$('mapQuickToolsDrawer');
    const closeQuickDrawer=()=>{
      if(!drawer) return;
      drawer.classList.add('hidden');
      drawer.setAttribute('aria-hidden','true');
      legacyMore?.setAttribute('aria-expanded','false');
    };
    const more=proxyButton('','<svg class="sv-more-down" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg><svg class="sv-more-up" viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>',(event)=>{
      event?.preventDefault?.();
      event?.stopPropagation?.();
      // Ferramentas e menus do mapa são painéis alternativos. Fechar os
      // details antes de abrir a bandeja evita que Mapa fique por cima das
      // ferramentas, como ocorria quando ambos permaneciam abertos.
      center.querySelectorAll('details[open]').forEach((item)=>{ item.open=false; });
      if (legacyMore) {
        legacyMore.click();
      } else if (drawer) {
        const shouldOpen = drawer.classList.contains('hidden');
        drawer.classList.toggle('hidden',!shouldOpen);
        drawer.setAttribute('aria-hidden', String(!shouldOpen));
      }
      requestAnimationFrame(() => {
        const open = Boolean(drawer && !drawer.classList.contains('hidden'));
        legacyMore?.setAttribute('aria-expanded', String(open));
        more.setAttribute('aria-expanded', String(open));
        if (open) requestAnimationFrame(positionQuickDrawer);
      });
    });
    more.classList.add('sv-map-toolbar-more');
    more.dataset.svActivation='drawer';
    more.setAttribute('title','Mais ferramentas');
    more.setAttribute('aria-label','Mais ferramentas');
    more.setAttribute('aria-expanded','false');

    const basemap=document.createElement('details');
    basemap.className='sv-map-basemap-clean';
    basemap.dataset.svActivation='menu';
    basemap.innerHTML=`<summary title="Mapa base" aria-label="Escolher mapa base">${friendlyIcon('mapas')}<span class="sv-map-label">Mapa</span></summary><div class="sv-map-basemap-menu" role="menu"></div>`;
    const baseMenu=basemap.querySelector('.sv-map-basemap-menu');
    const baseSelect=$('baseMapSelect');
    const baseOptions=[['osm','Mapa padrão'],['sat','Satélite'],['hybrid','Satélite + vias'],['road','Ruas'],['terrain','Terreno'],['topo','Topográfico'],['topographicReal','Topográfico real'],['relief','Relevo']];
    const syncBaseButtons=()=>baseMenu?.querySelectorAll('[data-sv-basemap]').forEach(btn=>btn.classList.toggle('active',btn.dataset.svBasemap===baseSelect?.value));
    if (baseMenu) {
      const territorialBtn=document.createElement('button');
      territorialBtn.type='button';
      territorialBtn.className='sv-territorial-entry';
      territorialBtn.setAttribute('role','menuitem');
      territorialBtn.innerHTML='<span class="sv-basemap-swatch sv-territorial-thumb" aria-hidden="true"><img src="/assets/basemap-thumbs/territorial-brazil.webp" alt=""></span><span>Visão territorial</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
      territorialBtn.addEventListener('click',()=>{window.SurveyorTerritorialNavigator?.open?.();basemap.open=false;document.activeElement?.blur?.();});
      baseMenu.appendChild(territorialBtn);
    }
    baseOptions.forEach(([value,label])=>{
      const b=document.createElement('button'); b.type='button'; b.dataset.svBasemap=value; b.setAttribute('role','menuitem');
      b.innerHTML=`<span class="sv-basemap-swatch sv-basemap-${value}" aria-hidden="true"></span><span>${label}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 12 2 2 4-4"/></svg>`;
      b.addEventListener('click',()=>{if(baseSelect){baseSelect.value=value;baseSelect.dispatchEvent(new Event('change',{bubbles:true}));}syncBaseButtons();basemap.open=false;});
      baseMenu.appendChild(b);
    });
    baseSelect?.addEventListener('change',syncBaseButtons); syncBaseButtons();
    basemap.addEventListener('toggle',()=>{
      if(!basemap.open) return;
      closeQuickDrawer();
      more.setAttribute('aria-expanded','false');
    });

    const imp=proxyFrom($('openImportLayersBtn'),'Importar','<svg viewBox="0 0 24 24"><path d="M12 17V5m-4 4 4-4 4 4M5 19h14"/></svg>');
    if(imp) imp.dataset.svActivation='action';

    const exportDetails=document.createElement('details');
    exportDetails.className='sv-map-export-clean';
    exportDetails.dataset.svActivation='menu';
    exportDetails.innerHTML='<summary><svg viewBox="0 0 24 24"><path d="M12 3v11m-4-4 4 4 4-4M5 19h14"/></svg><span class="sv-map-label">Exportar</span></summary><div class="sv-map-export-menu"></div>';
    const exportMenu=exportDetails.querySelector('.sv-map-export-menu');
    [['KML','kmlBtn'],['TXT','txtBtn'],['GeoJSON','geojsonBtn'],['CSV','csvBtn'],['Shapefile','shpBtn']].forEach(([label,id])=>{
      const src=$(id); if(!src) return;
      const b=document.createElement('button'); b.type='button'; b.textContent=label;
      b.addEventListener('click',()=>{src.click();exportDetails.open=false});
      exportMenu.appendChild(b);
    });

    const share=proxyFrom($('secureShareBtn'),'Compartilhar','<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="m8 11 8-5M8 13l8 5"/></svg>');
    if(share) share.dataset.svActivation='action';
    const verify=proxyButton('Verificar','<svg viewBox="0 0 24 24"><path d="M9 12l2 2 4-5"/><path d="M12 3a9 9 0 1 0 9 9"/></svg>',()=>window.SurveyorProjectAudit?.open?.());
    verify.dataset.svActivation='action';
    verify.id='svVerifyProjectBtn';
    verify.title='Verificar projeto';
    verify.setAttribute('aria-label','Verificar projeto');

    // Histórico no topo, no estilo de editores como Word. Os botões visuais
    // são proxies dos comandos reais do mapa para manter uma única fonte de
    // verdade e acompanhar automaticamente o estado habilitado/desabilitado.
    const historyProxy=(source,label,svg)=>{
      if(!source) return null;
      const b=proxyButton('',svg,()=>source.click());
      b.classList.add('sv-map-history-action');
      b.dataset.proxyFor=source.id || '';
      b.dataset.svActivation='action';
      b.title=label;
      b.setAttribute('aria-label',label);
      const sync=()=>{
        b.disabled=Boolean(source.disabled);
        b.setAttribute('aria-disabled',String(Boolean(source.disabled)));
      };
      sync();
      new MutationObserver(sync).observe(source,{attributes:true,attributeFilter:['disabled']});
      return b;
    };
    const undo=historyProxy($('undoToolBtn'),'Desfazer (Ctrl+Z)','<span class="sv-map-history-glyph" aria-hidden="true">↶</span>');
    const redo=historyProxy($('redoToolBtn'),'Refazer (Ctrl+Y)','<span class="sv-map-history-glyph" aria-hidden="true">↷</span>');

    const group=(_caption,nodes)=>{
      const wrap=document.createElement('div'); wrap.className='sv-map-toolbar-group';
      const actions=document.createElement('div'); actions.className='sv-map-toolbar-group-actions';
      nodes.filter(Boolean).forEach(n=>actions.appendChild(n));
      wrap.append(actions); return wrap;
    };
    [
      group('Projeto',[save,versions]),sep(),
      group('Camadas',[layers]),sep(),
      group('Desenho',[poly,point,more]),sep(),
      group('Mapa',[basemap]),sep(),
      group('Dados',[imp,exportDetails]),sep(),
      group('Projeto',[share]),sep(),
      group('Histórico',[undo,redo])
    ].forEach(n=>center.appendChild(n));
    center.querySelectorAll('.sv-map-toolbar-group').forEach((node)=>{
      if((undo && node.contains(undo)) || (redo && node.contains(redo))) node.classList.add('sv-map-history-group');
    });
    // Verificação pertence ao grupo Projeto, mas é anexada depois para manter
    // compatibilidade estrutural com o toolbar legado e seus testes.
    share?.parentElement?.appendChild(verify);

    header.appendChild(center);

    // Put the existing search field in the right-hand host. It keeps all of its
    // original lookup/autocomplete functionality.
    const searchHost=document.createElement('div');
    searchHost.className='sv-map-search-host';
    const search=$('mapSearchBar');
    if(search){
      search.classList.remove('hidden');
      search.setAttribute('aria-hidden','false');
      searchHost.appendChild(search);
    }
    header.appendChild(searchHost);

    // Keep every legacy control in the DOM so its original event listeners and
    // state remain intact, but never let it participate in visual layout.
    toolstrip.setAttribute('aria-hidden','true');
    toolstrip.classList.add('sv-map-legacy-controls');

    // The real quick-tools drawer is reused because its buttons already call the
    // production map functions. Only its visual host changes.
    const positionQuickDrawer=()=>{
      if(!drawer || drawer.classList.contains('hidden')) return;
      const headerRect=header.getBoundingClientRect();
      const drawingGroup=more.closest('.sv-map-toolbar-group');
      const verifyGroup=verify.closest('.sv-map-toolbar-group');
      // Limites físicos da barra: divisória Camadas|Polígono até a
      // divisória após Verificar. Não usar larguras fixas nem o centro da seta.
      const startDivider=drawingGroup?.previousElementSibling;
      const endDivider=verifyGroup?.nextElementSibling;
      const startNode=startDivider?.classList.contains('sv-map-toolbar-separator') ? startDivider : drawingGroup;
      const endNode=endDivider?.classList.contains('sv-map-toolbar-separator') ? endDivider : verify;
      const leftEdge=startNode?.getBoundingClientRect().left ?? more.getBoundingClientRect().left;
      const rightEdge=endNode?.getBoundingClientRect().right ?? verify.getBoundingClientRect().right;
      const layout=calculateMapQuickDrawerLayout(leftEdge,rightEdge,document.documentElement.clientWidth || window.innerWidth);
      const grid=drawer.querySelector('.map-quick-tools-grid');
      drawer.style.setProperty('width',`${layout.width}px`,'important');
      drawer.style.setProperty('max-width',`${layout.width}px`,'important');
      drawer.style.setProperty('left',`${layout.left}px`,'important');
      drawer.style.setProperty('right','auto','important');
      drawer.style.setProperty('top',`${Math.round(headerRect.bottom+8)}px`,'important');
      drawer.style.setProperty('transform','none','important');
      // Todos os ícones dentro dos limites, com até 13 colunas de 40 px.
      // Em telas estreitas o número de colunas diminui, mantendo alvos de 40 px.
      if(grid){
        grid.style.gridTemplateColumns=`repeat(${layout.columns}, 40px)`;
        grid.style.gridAutoRows='40px';
        grid.style.gap='6px';
      }
    };
    if(drawer){
      drawer.classList.add('sv-map-modern-drawer');
      center.appendChild(drawer);
      const syncMore=()=>{
        const open=!drawer.classList.contains('hidden');
        more.setAttribute('aria-expanded',String(open));
        if(open) requestAnimationFrame(positionQuickDrawer);
      };
      new MutationObserver(syncMore).observe(drawer,{attributes:true,attributeFilter:['class']});
      window.addEventListener('resize',()=>requestAnimationFrame(positionQuickDrawer),{passive:true});
      window.addEventListener('scroll',()=>requestAnimationFrame(positionQuickDrawer),{passive:true});
      syncMore();
      document.addEventListener('pointerdown',(event)=>{
        if(drawer.classList.contains('hidden')) return;
        if(drawer.contains(event.target) || more.contains(event.target)) return;
        closeQuickDrawer(); more.setAttribute('aria-expanded','false');
      },true);
      document.addEventListener('keydown',(event)=>{
        if(event.key==='Escape' && !drawer.classList.contains('hidden')){closeQuickDrawer();more.setAttribute('aria-expanded','false');more.focus();}
      });
    }
    document.addEventListener('pointerdown',(event)=>{if(basemap.open && !basemap.contains(event.target)) basemap.open=false;});

  }

  function setupGenerationProgress() {
    // O workspace unificado de documentos usa progresso de completude (0-90%)
    // e conclui em 100% somente após a pré-visualização ser efetivamente gerada.
    if (['mapas.html','pranchas.html','memorial.html','planialtimetria.html','perimetros.html','ambiental.html','confrontacao.html','ods.html','loteamentos-reurb.html'].includes(page)) return;
    if (document.body.dataset.generationProgressBound === '1') return;
    const configs = {
      'mapas.html': [['generateMapV19','mapPreview','Gerando mapa e croqui…']],
      'pranchas.html': [['generateMapV19','mapPreview','Gerando prancha técnica…']],
      'planialtimetria.html': [['analyzeElevation','elevationPreview','Processando planialtimetria…'],['calculateIdw','idwOutput','Calculando altitude…']],
      'perimetros.html': [['generateAzimuth','azimuthPreview','Calculando perímetro…']],
      'ambiental.html': [['generateEnvironmental','environmentOutput','Gerando relatório ambiental…']],
      'confrontacao.html': [['generateLetter','letterOutput','Gerando carta de confrontação…']],
      'ods.html': [['sheetDownloadPdf','sheetBody','Preparando PDF da planilha…'],['sheetDownloadOds','odsStatus','Gerando planilha ODS…'],['sheetDownloadXlsx','sheetBody','Gerando planilha Excel…']],
      'loteamentos-reurb.html': [['downloadLotReportPdf','lotReportPreview','Gerando relatório do lote…']]
    };
    const items = configs[page] || [];
    if (!items.length) return;
    document.body.dataset.generationProgressBound = '1';
    let overlay = document.getElementById('svGenerationOverlay');
    if (!overlay) {
      overlay = document.createElement('div'); overlay.id='svGenerationOverlay'; overlay.className='sv-generation-overlay'; overlay.hidden=true;
      overlay.innerHTML='<div class="sv-generation-card"><div class="sv-generation-card-head"><span class="sv-generation-spinner"></span><div><strong id="svGenerationTitle">Gerando documento…</strong><small>O Surveyor está processando os dados reais do projeto.</small></div></div><div class="sv-generation-progress-row"><span id="svGenerationLabel">Preparando dados…</span><b id="svGenerationPercent">0%</b></div><div class="sv-generation-track"><span id="svGenerationBar"></span></div><div class="sv-generation-stage" id="svGenerationStage">Validando informações do projeto.</div></div>';
      document.body.appendChild(overlay);
    }
    const card=overlay.querySelector('.sv-generation-card'), title=overlay.querySelector('#svGenerationTitle'), label=overlay.querySelector('#svGenerationLabel'), pct=overlay.querySelector('#svGenerationPercent'), bar=overlay.querySelector('#svGenerationBar'), stage=overlay.querySelector('#svGenerationStage');
    let timer=0, closeTimer=0;
    const set=(value,text,detail)=>{const v=Math.max(0,Math.min(100,Math.round(value)));pct.textContent=`${v}%`;bar.style.width=`${v}%`;if(text)label.textContent=text;if(detail)stage.textContent=detail};
    const open=(heading)=>{clearInterval(timer);clearTimeout(closeTimer);card.classList.remove('is-done','is-error');title.textContent=heading;overlay.hidden=false;set(4,'Preparando dados…','Validando informações e geometria do projeto.');let v=4;timer=setInterval(()=>{v=Math.min(88,v+(v<35?8:v<65?5:2));const text=v<35?'Carregando projeto…':v<65?'Processando documento…':'Finalizando visualização…';const detail=v<35?'Lendo os dados reais salvos no Surveyor.':v<65?'Calculando e montando o conteúdo técnico.':'Preparando o resultado para exibição ou download.';set(v,text,detail)},260)};
    const done=()=>{clearInterval(timer);card.classList.add('is-done');set(100,'Concluído','Documento processado com sucesso.');closeTimer=setTimeout(()=>{overlay.hidden=true},650)};
    items.forEach(([buttonId,targetId,heading])=>{
      const button=$(buttonId); if(!button||button.dataset.generationBound==='1')return; button.dataset.generationBound='1';
      button.addEventListener('click',()=>{
        open(heading);
        const target=$(targetId); let finished=false;
        const finish=()=>{if(finished)return;finished=true;observer?.disconnect();done()};
        let observer=null;
        if(target){observer=new MutationObserver(()=>window.setTimeout(finish,80));observer.observe(target,{childList:true,subtree:true,characterData:true,attributes:true})}
        window.setTimeout(finish,2400);
      },true);
    });
  }

  function stabilizeVisibleUi() {
    if (document.body?.dataset?.videoUiStabilized === '1') return;
    document.body.dataset.videoUiStabilized = '1';

    const closeHomeTools = () => {
      const menu = document.getElementById('svHomeToolsMenu');
      const button = document.querySelector('.sv-home-tools-btn');
      menu?.classList.add('hidden');
      menu?.setAttribute('aria-hidden', 'true');
      button?.setAttribute('aria-expanded', 'false');
    };
    document.addEventListener('click', (event) => {
      const link = event.target.closest?.('#svHomeToolsMenu a');
      if (link) closeHomeTools();
    }, true);

    // Details/dropdowns used in the same toolbar should not remain piled on top
    // of each other after repeated clicks, which was visible in the review video.
    document.addEventListener('toggle', (event) => {
      const current = event.target;
      if (!(current instanceof HTMLDetailsElement) || !current.open) return;
      const host = current.closest('.workspace-topbar, .geo-brandbar, .sv-map-toolbar-modern');
      if (!host) return;
      host.querySelectorAll('details[open]').forEach((item) => {
        if (item !== current) item.open = false;
      });
    }, true);

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      closeHomeTools();
      document.querySelectorAll('details[open]').forEach((item) => { item.open = false; });
      const overlay = document.getElementById('svGenerationOverlay');
      if (overlay && !overlay.hidden) overlay.hidden = true;
    });
  }

  function observeMapChrome() {
    if (page !== 'mapa.html' || document.body.dataset.modernMapObserver === '1') return;
    document.body.dataset.modernMapObserver='1';
    let queued=false;
    const refresh=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;modernizeMap()})};
    new MutationObserver(refresh).observe(document.body,{childList:true,subtree:true});
    window.setTimeout(refresh,250); window.setTimeout(refresh,900);
  }

  function bootModernUi(){
    document.body?.classList.add('sv-modern-htmlcss');
    updateSimpleHeaders(); enhanceProjects(); modernizeSupport(); setupAdminTeamsTab(); modernizeMap(); observeMapChrome(); setupGenerationProgress();
    modernizeToolsMenu(); setupAccountMenu(); stabilizeVisibleUi();
    // Topbar/notifications can be rebuilt asynchronously after session refresh.
    const observer=new MutationObserver(()=>{ modernizeToolsMenu(); setupAccountMenu(); }); observer.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bootModernUi,{once:true}); else bootModernUi();
})();


/* ===== Acabamento comercial ===== */


/* ===== Acabamento comercial ===== */
(() => {
  'use strict';
  const page = document.body?.dataset?.page || '';
  const $ = (id) => document.getElementById(id);

  const icons = {
    project:'<svg viewBox="0 0 24 24"><path d="M4 6h6l2 2h8v11H4V6Z"/><path d="M8 12h8M8 15h5"/></svg>',
    doc:'<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6V3Z"/><path d="M15 3v5h5M9 12h7M9 16h7"/></svg>',
    user:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3"/><path d="M5 20c.8-4 3.2-6 7-6s6.2 2 7 6"/></svg>',
    settings:'<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M8 14v6"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>',
    map:'<svg viewBox="0 0 24 24"><path d="m3 6 5-2 8 3 5-2v13l-5 2-8-3-5 2V6Z"/><path d="M8 4v13M16 7v13"/></svg>',
    search:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
    grid:'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/></svg>',
    list:'<svg viewBox="0 0 24 24"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>',
    plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    layers:'<svg viewBox="0 0 24 24"><path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 11 8 4 8-4M4 15l8 4 8-4"/></svg>'
  };

  function makeStatusCard(label, value, icon='project') {
    const card = document.createElement('div');
    card.className = 'sv-doc-status-card';
    card.innerHTML = `<span class="sv-doc-status-icon">${icons[icon] || icons.project}</span><span><small>${label}</small><strong>${value}</strong></span>`;
    return card;
  }

  const docDefs = {
    'memorial.html': {
      title:'Memorial descritivo',
      sections:[
        ['Projeto',['projectSelect']],
        ['Documento',['memDocumentType','memIncra','memCnib','memRegistration']],
        ['Imóvel / Proprietário',['memOwnerName','memOwnerCpf','memOwnerRg','memComarca']],
        ['Mapa do memorial',['memMapZoom','memMapBackground']]
      ], model:'memorialTemplateSelect'
    },
    'ods.html': {
      title:'Planilha ODS',
      sections:[
        ['Projeto',['sheetProjectSelect','projectSelect']],
        ['Formato e identificação',['coordinateFormat','odsCode']]
      ]
    },
    'mapas.html': {
      title:'Mapas e croquis',
      sections:[
        ['Projeto',['projectSelect']],
        ['Configuração do mapa',['mapBackground','mapZoom','mapTitle','mapRegistration']]
      ]
    },
    'pranchas.html': {
      title:'Pranchas técnicas',
      sections:[
        ['Projeto',['projectSelect']],
        ['Folha e mapa',['mapSheetLayout','mapBackground','mapZoom','mapScale','mapSheetNumber']],
        ['Identificação',['mapTitle','mapRegistration','mapDistrict','mapRegistryOffice','mapIncra','mapCnib']]
      ]
    },
    'planialtimetria.html': {
      title:'Planialtimetria / MDT',
      sections:[
        ['Projeto',['projectSelect']],
        ['Dados de elevação',['elevationPoints']],
        ['Interpolação / consulta',['idwLat','idwLng','idwPower']]
      ]
    },
    'perimetros.html': {
      title:'Perímetros por azimute',
      sections:[
        ['Projeto',['projectSelect','azProjectName']],
        ['Ponto inicial',['startLat','startLng']],
        ['Percurso técnico',['azimuthLines']],
        ['Visualização',['azimuthMapZoom']]
      ]
    },
    'ambiental.html': {
      title:'Relatório ambiental',
      sections:[
        ['Projeto',['projectSelect']],
        ['Observações e conclusão',['environmentNotes']]
      ]
    },
    'confrontacao.html': {
      title:'Cartas de confrontação',
      sections:[
        ['Projeto',['projectSelect']],
        ['Emissão',['letterPlace','letterDate']],
        ['Confrontante',['neighborName','neighborDoc','neighborSide','neighborLimit']],
        ['Observações',['neighborNotes']]
      ]
    }
  };

  function fieldHost(id) {
    const el = $(id); if (!el) return null;
    return el.closest('label') || el.closest('.field') || el;
  }

  function decorateDocumentPage() {
    // As telas de geração agora são reconstruídas integralmente por core/documents.js.
    // Desativamos o polimento legado para evitar contexto antigo, cartões extras e cabeçalhos duplicados.
    return;
  }

  function polishProjects() {
    if (page !== 'nuvem.html' || document.body.dataset.svProjectsPolished === '1') return;
    document.body.dataset.svProjectsPolished='1';
    const main=document.querySelector('.main,.workspace-main');
    main?.classList.add('sv-projects-commercial');
    $('projectsList')?.classList.add('is-accordion-view');
    const toolbar=document.querySelector('.projects-toolbar');
    const sort=$('projectSort');
    if (toolbar && !toolbar.querySelector('.sv-project-controls')) {
      const controls=document.createElement('div'); controls.className='sv-project-controls';
      if (sort) {
        const sortWrap=document.createElement('label'); sortWrap.className='sv-project-sort'; sortWrap.innerHTML=`<span>Ordenar</span>`; sort.parentNode?.insertBefore(sortWrap,sort); sortWrap.appendChild(sort);
        controls.appendChild(sortWrap);
      }
      const add=document.createElement('a'); add.href='/mapa/'; add.className='sv-project-new'; add.innerHTML=`${icons.plus}<span>Novo projeto</span>`; controls.appendChild(add);
      toolbar.appendChild(controls);
    }
    toolbar?.querySelector('.sv-project-view-toggle')?.remove();
  }

  function enhanceAcervos() {
    if (page !== 'acervos.html' || document.body.dataset.svAcervosPolished === '1') return;
    document.body.dataset.svAcervosPolished='1';
    const grid=document.querySelector('.official-grid'); if(!grid)return;
    const cards=[...grid.querySelectorAll('.official-card')];
    const toolbar=document.createElement('div'); toolbar.className='sv-acervos-toolbar';
    toolbar.innerHTML=`<label class="sv-acervos-search">${icons.search}<input type="search" placeholder="Pesquisar acervo, base ou descrição..."></label><div class="sv-acervos-filters"><button class="active" data-filter="all">Todos</button><button data-filter="rural">Imóveis rurais</button><button data-filter="ambiente">Ambiente</button><button data-filter="cartografia">Cartografia</button><button data-filter="outros">Outros</button></div>`;
    grid.parentNode.insertBefore(toolbar,grid);
    const categoryOf=(text)=>{
      const normalized=String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
      if (/^(SIGEF|ACERVO FUNDIARIO DO INCRA|CONSULTA PUBLICA SNCR|DCR \/ INCRA|MEU IMOVEL RURAL|CNIR)/.test(normalized)) return 'rural';
      if (/^(SEIA \/ CEFIR BAHIA|CONSULTA PUBLICA CAR)/.test(normalized)) return 'ambiente';
      if (/^(TOPODATA \/ INPE|GOOGLE EARTH WEB)/.test(normalized)) return 'cartografia';
      return 'outros';
    };
    const logoOf=(title)=>{
      if(/SIGEF/i.test(title))return '/assets/official-logos/sigef.svg';
      if(/Acervo Fundi[aá]rio do INCRA/i.test(title))return '/assets/official-logos/incra-acervo.svg';
      if(/SNCR/i.test(title))return '/assets/official-logos/sncr.svg';
      if(/DCR/i.test(title))return '/assets/official-logos/dcr.svg';
      if(/Meu Im[oó]vel Rural/i.test(title))return '/assets/official-logos/meu-imovel-rural.svg';
      if(/SEIA/i.test(title))return '/assets/official-logos/seia-cefir.svg';
      if(/TOPODATA/i.test(title))return '/assets/official-logos/topodata.svg';
      if(/Consulta P[uú]blica CAR/i.test(title))return '/assets/official-logos/car.svg';
      if(/^CNIR/i.test(title))return '/assets/official-logos/cnir.svg';
      if(/Google Earth/i.test(title))return '/assets/official-logos/google-earth.svg';
      return '';
    };
    cards.forEach(card=>{
      const title=card.querySelector('h3')?.textContent?.trim()||'Acervo oficial';
      const cat=categoryOf(title); card.dataset.category=cat;
      card.querySelectorAll('.sv-official-badge,.sv-official-brand').forEach(node=>node.remove());
      const badge=document.createElement('span');badge.className='sv-official-badge';badge.textContent='OFICIAL';card.prepend(badge);
      const brand=document.createElement('div');brand.className='sv-official-brand';
      const logo=logoOf(title);
      brand.innerHTML = logo ? `<img class="sv-official-logo" src="${logo}" alt="${title}">` : `<strong>${title}</strong>`;
      card.insertBefore(brand,card.querySelector('h3'));
      const link=card.querySelector('a');
      if(link && !link.dataset.polished){ link.dataset.polished='1'; link.insertAdjacentHTML('afterbegin','<span aria-hidden="true">↗</span> '); }
    });
    grid.querySelectorAll('.official-card.sv-official-suggestion').forEach((node)=>node.remove());
    let current='all'; const search=toolbar.querySelector('input');
    const apply=()=>{const q=(search.value||'').toLowerCase().trim(); cards.forEach(card=>{const okCat=current==='all'||card.dataset.category===current;const okQ=!q||card.textContent.toLowerCase().includes(q);card.hidden=!(okCat&&okQ);});};
    search.addEventListener('input',apply);toolbar.querySelector('.sv-acervos-filters').addEventListener('click',e=>{const b=e.target.closest('button[data-filter]');if(!b)return;current=b.dataset.filter;toolbar.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));apply();});
  }

  function enhanceCustomization() {
    // A Central de personalização possui interface própria na v21.11.5.
    // Não criar um segundo dashboard por cima dela.
    if (page !== 'customizacao.html') return;
    document.body.dataset.svCustomPolished = '1';
  }


  function enhanceHome() {
    if(page!=='index.html'||document.body.dataset.svHomePolished==='1')return;
    document.body.dataset.svHomePolished='1';
    const card=document.querySelector('.home-hero-card'); if(!card)return;
    const title=card.querySelector('.home-hero-title'); if(title) title.textContent='Bem-vindo ao Surveyor';
    const sub=card.querySelector('.home-hero-subtitle'); if(sub) sub.innerHTML='Plataforma completa para georreferenciamento,<br>agrimensura e gestão técnica de imóveis rurais<br>em um único ambiente.';
    card.querySelectorAll('.sv-home-welcome').forEach((badge)=>badge.remove());
  }

  /* Modal próprio para confirmações importantes, evitando alertas nativos. */
  window.SurveyorConfirm = function(message, options={}){
    return new Promise(resolve=>{
      const overlay=document.createElement('div');overlay.className='sv-confirm-overlay';
      overlay.innerHTML=`<section class="sv-confirm-card" role="dialog" aria-modal="true"><span class="sv-confirm-icon">${icons.doc}</span><div><h2>${options.title||'Rascunho local encontrado'}</h2><p></p></div><div class="sv-confirm-actions"><button type="button" data-action="cancel">Agora não</button><button type="button" class="primary" data-action="confirm">${options.confirmText||'Restaurar rascunho'}</button></div></section>`;
      overlay.querySelector('p').textContent=message;document.body.appendChild(overlay);
      const done=(v)=>{overlay.remove();resolve(v)};
      overlay.addEventListener('click',e=>{if(e.target===overlay)done(false);const b=e.target.closest('[data-action]');if(b)done(b.dataset.action==='confirm');});
      document.addEventListener('keydown',function esc(e){if(e.key==='Escape'){document.removeEventListener('keydown',esc);done(false)}},{once:true});
      setTimeout(()=>overlay.querySelector('.primary')?.focus(),0);
    });
  };

  function bootCommercialPolish(){ document.body.classList.add('sv-commercial-polish'); if(page==='loteamentos-reurb.html'){document.body.classList.add('sv-document-workspace','sv-document-complex');document.querySelectorAll('.main>.panel,.workspace-main>.panel').forEach(p=>p.classList.add('sv-document-panel'));} decorateDocumentPage(); polishProjects(); enhanceAcervos(); enhanceCustomization(); enhanceHome(); }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootCommercialPolish,{once:true});else bootCommercialPolish();
})();



/* Reveal only after the current UI and the protected-route gate are stable.
   Protected pages stay invisible until Portal has validated the cached session and
   finished rebuilding the current shell. This avoids both the legacy-layout flash
   and the brief protected-page paint before redirecting to /login/. */
(() => {
  const html = document.documentElement;
  let revealQueued = false;

  const finalize = () => {
    html.classList.remove('surveyor-ui-booting', 'surveyor-auth-pending');
    html.style.removeProperty('visibility');
  };

  const revealStable = () => {
    if (revealQueued) return;
    revealQueued = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.setTimeout(finalize, 0);
    }));
  };

  const tryReveal = () => {
    const protectedPending = html.classList.contains('surveyor-auth-pending');
    if (protectedPending && html.dataset.portalReady !== 'true') return;
    revealStable();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryReveal, { once:true });
  } else {
    tryReveal();
  }
  window.addEventListener('surveyor:portal-ready', tryReveal, { once:true });

  // Safety fallback only reveals pages whose auth gate has already completed.
  window.setTimeout(() => {
    if (!html.classList.contains('surveyor-auth-pending') || html.dataset.portalReady === 'true') finalize();
  }, 3500);
})();


/* ===== 2026-08-18 — hotfix final: alinhamento + filtros de acervos ===== */
(() => {
  'use strict';
  const page = document.body?.dataset?.page || '';

  function ready(fn){
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once:true });
    else fn();
  }

  function categoryForCard(card){
    const text = `${card.querySelector('h3')?.textContent || ''} ${card.querySelector('p')?.textContent || ''}`.toLowerCase();
    if (/sigef|incra|sncr|dcr|imóvel|imovel|cnir/.test(text)) return 'rural';
    if (/seia|cefir|ambient|consulta pública car|consulta publica car|reserva legal|car/.test(text)) return 'ambiente';
    if (/topodata|google earth|cartografia|mapa|geoespacial|elevação|elevacao/.test(text)) return 'cartografia';
    return 'outros';
  }

  function patchAcervosFilters(){
    if (page !== 'acervos.html') return;
    const toolbar = document.querySelector('.sv-acervos-toolbar');
    const grid = document.querySelector('.official-grid');
    if (!toolbar || !grid) return;
    const search = toolbar.querySelector('input[type="search"], input');
    const filterHost = toolbar.querySelector('.sv-acervos-filters');
    const cards = Array.from(grid.querySelectorAll('.official-card'));
    if (!search || !filterHost || !cards.length) return;

    cards.forEach((card) => { card.dataset.category = categoryForCard(card); });
    filterHost.querySelectorAll('button[data-filter]').forEach((button) => {
      button.type = 'button';
      button.setAttribute('aria-pressed', button.classList.contains('active') ? 'true' : 'false');
    });

    const apply = (filter = filterHost.querySelector('button.active')?.dataset.filter || 'all') => {
      const query = String(search.value || '').trim().toLowerCase();
      cards.forEach((card) => {
        const hay = `${card.querySelector('h3')?.textContent || ''} ${card.querySelector('p')?.textContent || ''}`.toLowerCase();
        const okFilter = filter === 'all' || card.dataset.category === filter;
        const okQuery = !query || hay.includes(query);
        card.hidden = !(okFilter && okQuery);
      });
    };

    if (filterHost.dataset.boundFilters !== '1') {
      filterHost.dataset.boundFilters = '1';
      filterHost.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-filter]');
        if (!button) return;
        filterHost.querySelectorAll('button[data-filter]').forEach((item) => {
          const active = item === button;
          item.classList.toggle('active', active);
          item.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        apply(button.dataset.filter || 'all');
      });
    }

    if (search.dataset.boundInput !== '1') {
      search.dataset.boundInput = '1';
      search.addEventListener('input', () => apply());
    }

    apply();
  }

  function patchPageHeads(){
    if (!['nuvem.html','acervos.html','customizacao.html'].includes(page)) return;
    const head = document.querySelector('.main > .top, .workspace-main > .top, .workspace-page-head');
    if (!head) return;
    head.classList.add('sv-final-aligned-head');
  }

  ready(() => {
    patchPageHeads();
    patchAcervosFilters();
  });
})();
