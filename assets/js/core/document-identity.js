(() => {
  'use strict';

  if (window.SurveyorDocumentIdentityAutoInstalled) return;
  window.SurveyorDocumentIdentityAutoInstalled = true;

  const $ = (id) => document.getElementById(id);
  const TECH_FIELD_IDS = [
    'memTechnician',
    'mapTechnician',
    'odsTechnician',
    'odsArt',
    'environmentAnalyst'
  ];
  const LOT_TECH_FIELD_IDS = [
    'techName','techCompany','techType','techDoc','techRg','techCouncil',
    'techCouncilNumber','techRt','techPhone','techEmail','techWebsite','techCouncilUf'
  ];

  function ensureVault() {
    let vault = document.getElementById('sv-document-identity-vault');
    if (vault) return vault;
    vault = document.createElement('div');
    vault.id = 'sv-document-identity-vault';
    vault.hidden = true;
    vault.setAttribute('aria-hidden', 'true');
    vault.style.display = 'none';
    document.body.appendChild(vault);
    return vault;
  }

  function moveFieldHostToVault(id) {
    const field = $(id);
    if (!field) return;
    const vault = ensureVault();
    const host = field.closest('label') || field;
    if (host.closest?.('#sv-document-identity-vault')) return;
    vault.appendChild(host);
  }

  function hideLegacyTechnicalInputs() {
    TECH_FIELD_IDS.forEach(moveFieldHostToVault);
    moveFieldHostToVault('memorialTemplateSelect');

    const lotTech = $('techName');
    const lotPanel = lotTech?.closest('section.panel');
    if (lotPanel && /respons[aá]vel\s+t[eé]cnico/i.test(lotPanel.querySelector('h2')?.textContent || '')) {
      lotPanel.hidden = true;
      lotPanel.setAttribute('aria-hidden', 'true');
      lotPanel.style.display = 'none';
    }
  }

  function setValue(id, value) {
    const field = $(id);
    if (!field) return;
    const next = String(value ?? '');
    if (field.tagName === 'SELECT') {
      const match = Array.from(field.options || []).find((option) => String(option.value).toLowerCase() === next.toLowerCase() || String(option.textContent).trim().toLowerCase() === next.toLowerCase());
      if (match) field.value = match.value;
      return;
    }
    field.value = next;
  }

  function parseRegistry(registryText) {
    const raw = String(registryText || '').trim();
    const councilMatch = raw.match(/\b(CREA|CAU|CFT)\b/i);
    const council = councilMatch ? councilMatch[1].toUpperCase() : '';
    const number = raw
      .replace(/\b(CREA|CAU|CFT)\b/ig, '')
      .replace(/^\s*[:\-–—/]\s*/, '')
      .trim();
    return { council, number };
  }

  function applyIdentity(customization = {}) {
    const name = String(customization.responsibleTechnician || '').trim();
    const registry = String(customization.professionalRegistry || '').trim();
    const company = String(customization.companyName || '').trim();
    const phone = String(customization.phoneNumber || customization.whatsappNumber || '').trim();
    const email = String(customization.emailAddress || '').trim();
    const website = String(customization.websiteUrl || '').trim();
    const { council, number } = parseRegistry(registry);

    setValue('memTechnician', name);
    setValue('mapTechnician', name);
    setValue('odsTechnician', name);
    // O campo legado continua existindo apenas para compatibilidade com a geração ODS.
    // Ele recebe o registro profissional centralizado em vez de pedir ART/TRT/RRT novamente.
    setValue('odsArt', registry);
    setValue('environmentAnalyst', name);

    setValue('techName', name);
    setValue('techCompany', company);
    if (council) setValue('techCouncil', council);
    setValue('techCouncilNumber', number || registry);
    setValue('techPhone', phone);
    setValue('techEmail', email);
    setValue('techWebsite', website);

    document.body.dataset.documentIdentitySource = name || registry ? 'personalizacao' : 'indisponivel';
  }

  async function readCustomization(forceRefresh = false) {
    let customization = window.GeoRuralDocumentTheme?.get?.() || {};
    try {
      if (window.GeoRuralDocumentTheme?.load) {
        customization = await window.GeoRuralDocumentTheme.load({ forceRefresh, noCache: forceRefresh }) || customization;
      }
    } catch (error) {
      console.warn('[Surveyor] Identidade técnica não pôde ser atualizada pelo tema:', error);
    }
    if (!String(customization?.responsibleTechnician || customization?.professionalRegistry || '').trim()) {
      const auth = window.SurveyorAuth || window.GeoRuralAuth;
      if (auth?.getDocumentCustomization) {
        try {
          customization = await auth.getDocumentCustomization({ forceRefresh, noCache: forceRefresh }) || customization;
        } catch (error) {
          console.warn('[Surveyor] Identidade técnica não pôde ser lida da conta:', error);
        }
      }
    }
    return customization || {};
  }

  async function refreshIdentity(forceRefresh = false) {
    hideLegacyTechnicalInputs();
    const customization = await readCustomization(forceRefresh);
    applyIdentity(customization);
    return customization;
  }

  hideLegacyTechnicalInputs();
  refreshIdentity(false);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => refreshIdentity(false), { once: true });
  }
  // Reaplica depois da reidratação de sessão e depois de módulos legados carregarem dados locais.
  setTimeout(() => refreshIdentity(false), 700);
  setTimeout(() => refreshIdentity(true), 2200);

  window.SurveyorDocumentIdentityAuto = { refresh: refreshIdentity, apply: applyIdentity };
})();
