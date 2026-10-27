(() => {
  'use strict';
  const USER_KEY = 'surveyor_memorial_template_selected_v398';
  const GLOBAL_KEY = 'surveyor_memorial_template_selected_global_v398';
  const LEGACY_KEYS = [
    'surveyor_memorial_template_preference_v3',
    'surveyor_memorial_template_preference_v2',
    'surveyor_memorial_template_preference_v1',
    'surveyor_memorial_template_last_explicit_v3'
  ];

  function auth(){ return window.SurveyorAuth || window.GeoRuralAuth; }
  function userKey(){
    const user = auth()?.currentUser?.() || {};
    return String(user.ownerUserId || user.workspaceOwnerUserId || user.id || user.$id || user.userId || user.email || 'anonymous').toLowerCase();
  }
  function scopedKey(){ return `${USER_KEY}::${userKey()}`; }
  function valid(id){
    return Boolean(window.SurveyorMemorialTemplates?.items?.some((item) => item.id === id));
  }
  function parse(raw){
    if (!raw) return null;
    try {
      const value = String(raw).trim().startsWith('{') ? JSON.parse(raw) : { id: String(raw).trim() };
      if (!valid(value?.id)) return null;
      return {
        id: value.id,
        updatedAt: String(value.updatedAt || ''),
        explicit: value.explicit !== false,
        source: String(value.source || 'local')
      };
    } catch { return null; }
  }
  function read(){
    const candidates = [];
    try { candidates.push(localStorage.getItem(scopedKey())); } catch {}
    try { candidates.push(localStorage.getItem(GLOBAL_KEY)); } catch {}
    for (const legacy of LEGACY_KEYS) {
      try {
        candidates.push(localStorage.getItem(`${legacy}::${userKey()}`));
        candidates.push(localStorage.getItem(legacy));
      } catch {}
    }
    for (const raw of candidates) {
      const parsed = parse(raw);
      if (parsed) return parsed;
    }
    return { id: '', updatedAt: '', explicit: false, source: '' };
  }
  function write(id, options = {}){
    if (!valid(id)) return read();
    const value = {
      id,
      updatedAt: String(options.updatedAt || new Date().toISOString()),
      explicit: options.explicit !== false,
      source: String(options.source || 'user')
    };
    const raw = JSON.stringify(value);
    try { localStorage.setItem(scopedKey(), raw); } catch {}
    try { localStorage.setItem(GLOBAL_KEY, raw); } catch {}
    return value;
  }
  function remotePreference(customization = {}){
    const options = customization?.options && typeof customization.options === 'object' ? customization.options : {};
    const id = valid(options.memorialTemplateId) ? options.memorialTemplateId : '';
    return {
      id,
      updatedAt: String(options.memorialTemplateUpdatedAt || customization?.updatedAt || ''),
      explicit: Boolean(id),
      source: id ? 'appwrite' : ''
    };
  }
  function resolve(customization = {}){
    const local = read();
    const remote = remotePreference(customization);
    // A nuvem é a fonte de verdade da equipe. Isso garante que titular e membros usem
    // o mesmo modelo em qualquer computador, sem uma preferência antiga do navegador
    // substituir silenciosamente a personalização já salva no workspace.
    if (remote.id) {
      const saved = write(remote.id, { updatedAt: remote.updatedAt || new Date().toISOString(), explicit: true, source: 'appwrite' });
      return { ...saved, local, remote };
    }
    if (local.id && local.explicit) return { ...local, local, remote };
    return { id: 'standard', updatedAt: '', explicit: false, source: 'default', local, remote };
  }

  function payloadFields(id){
    const saved = write(id, { explicit: true, source: 'user' });
    return {
      memorialTemplateId: id,
      memorialTemplateMode: id === 'standard' ? 'standard' : 'custom',
      memorialTemplateUpdatedAt: saved.updatedAt
    };
  }

  window.SurveyorMemorialPreference = { read, write, resolve, remotePreference, payloadFields, valid, userKey };
})();
