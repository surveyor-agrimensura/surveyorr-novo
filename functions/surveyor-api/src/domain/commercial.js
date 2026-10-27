// Regras comerciais oficiais do SURVEYOR. Fonte única para armazenamento e franquias.

export const SURVEYOR_STORE_URL = 'https://loja.surveyorr.com.br';
export const MB_BYTES = 1024 * 1024;
export const GB_BYTES = 1024 * 1024 * 1024;

export const COMMERCIAL_PLAN_RULES = Object.freeze({
  basic_monthly: { storageBaseBytes: 200 * MB_BYTES, storageMaxBytes: 2 * GB_BYTES, downloadDailyLimit: 5, exportDailyLimit: 5 },
  basic_annual:  { storageBaseBytes: 200 * MB_BYTES, storageMaxBytes: 2 * GB_BYTES, downloadDailyLimit: 5, exportDailyLimit: 5 },
  plus_monthly:  { storageBaseBytes: 500 * MB_BYTES, storageMaxBytes: 5 * GB_BYTES, downloadDailyLimit: 20, exportDailyLimit: 20 },
  plus_annual:   { storageBaseBytes: 500 * MB_BYTES, storageMaxBytes: 5 * GB_BYTES, downloadDailyLimit: 20, exportDailyLimit: 20 },
  pro_monthly:   { storageBaseBytes: 1 * GB_BYTES, storageMaxBytes: 10 * GB_BYTES, downloadDailyLimit: null, exportDailyLimit: null },
  pro_annual:    { storageBaseBytes: 1 * GB_BYTES, storageMaxBytes: 10 * GB_BYTES, downloadDailyLimit: null, exportDailyLimit: null }
});

export function commercialPlanRule(slug = '') {
  return COMMERCIAL_PLAN_RULES[String(slug || '').trim().toLowerCase()] || null;
}

function surveyorPrefs(appwriteUser = {}) {
  const prefs = appwriteUser?.prefs && typeof appwriteUser.prefs === 'object' ? appwriteUser.prefs : {};
  return prefs.surveyor && typeof prefs.surveyor === 'object' ? prefs.surveyor : {};
}

export function commercialStorageEntitlement(plan = {}, appwriteUser = {}) {
  const rule = commercialPlanRule(plan.slug || plan.id);
  const surveyor = surveyorPrefs(appwriteUser);
  if (!rule) {
    const current = plan.storageLimitBytes == null ? null : Math.max(0, Number(plan.storageLimitBytes) || 0);
    return { baseBytes: current, purchasedBytes: 0, effectiveBytes: current, maxBytes: current, storeUrl: SURVEYOR_STORE_URL };
  }
  const base = rule.storageBaseBytes;
  const max = rule.storageMaxBytes;
  const exactEntitlement = Math.max(0, Number(surveyor.storageEntitlementBytes || 0) || 0);
  const purchased = Math.max(0, Number(surveyor.storagePurchasedBytes || 0) || 0);
  const requested = exactEntitlement > 0 ? exactEntitlement : base + purchased;
  const effective = Math.min(max, Math.max(base, requested));
  return { baseBytes: base, purchasedBytes: Math.max(0, effective - base), effectiveBytes: effective, maxBytes: max, storeUrl: SURVEYOR_STORE_URL };
}

export function commercialUsageRule(plan = {}) {
  const rule = commercialPlanRule(plan.slug || plan.id);
  return { downloadDailyLimit: rule?.downloadDailyLimit ?? null, exportDailyLimit: rule?.exportDailyLimit ?? null };
}

export function commercialDayKey(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}
