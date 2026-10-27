(() => {
  'use strict';

  const runtime = () => window.SurveyorMapRuntime;
  let baseline = '';
  let state = 'checking';
  let recoveryPending = false;
  let localRecoveryVerified = false;
  let pollTimer = null;
  let mountTimer = null;

  function signature() {
    try { return String(runtime()?.getContentSignature?.() || ''); } catch { return ''; }
  }

  function saveButton() {
    return document.querySelector('[data-proxy-for="saveBtn"]');
  }

  function mount() {
    const button = saveButton();
    if (!button) return null;
    let dot = button.querySelector('.sv-save-state-dot');
    if (!dot) {
      dot = document.createElement('span');
      dot.className = 'sv-save-state-dot';
      dot.setAttribute('aria-hidden', 'true');
      button.appendChild(dot);
    }
    button.classList.add('sv-save-state-aware');
    render();
    return button;
  }

  function setState(next) {
    state = next;
    render();
  }

  function effectiveState() {
    // Ausência de rede não comprova que uma cópia local foi gravada.
    if (!navigator.onLine && state === 'dirty' && localRecoveryVerified) return 'local';
    return state;
  }

  function render() {
    const button = saveButton() || mount();
    if (!button) return;
    const effective = effectiveState();
    const map = {
      checking: ['Verificando o estado do projeto', 'checking'],
      saved: ['Salvo', 'saved'],
      dirty: ['Alterações pendentes', 'dirty'],
      saving: ['Salvando...', 'saving'],
      local: ['Salvo localmente — aguardando conexão', 'local'],
      error: ['Não sincronizado', 'error']
    };
    const [text, key] = map[effective] || map.checking;
    button.dataset.saveState = key;
    button.dataset.saveStateLabel = text;
    button.title = `Salvar projeto — ${text}`;
    button.setAttribute('aria-label', `Salvar projeto. Estado: ${text}.`);
  }

  function persistLocal() {
    try { localRecoveryVerified = runtime()?.persistRecoveryNow?.() === true; }
    catch { localRecoveryVerified = false; }
    return localRecoveryVerified;
  }

  function inspect() {
    const current = signature();
    if (!current || state === 'saving') return;
    if (!baseline) {
      baseline = current;
      setState(recoveryPending ? (navigator.onLine ? 'dirty' : (persistLocal() ? 'local' : 'error')) : 'saved');
      return;
    }
    const dirty = recoveryPending || current !== baseline;
    if (!dirty) return setState('saved');
    if (!navigator.onLine) {
      setState(persistLocal() ? 'local' : 'error');
    } else {
      setState('dirty');
    }
  }

  function markBaseline() {
    baseline = signature();
    recoveryPending = false;
    localRecoveryVerified = false;
    setState('saved');
  }

  function scheduleInspect(delay = 40) {
    clearTimeout(pollTimer);
    pollTimer = setTimeout(inspect, delay);
  }

  window.addEventListener('surveyor:save-start', () => setState('saving'));
  window.addEventListener('surveyor:save-success', markBaseline);
  window.addEventListener('surveyor:save-error', () => {
    const persisted = persistLocal();
    setState(!navigator.onLine && persisted ? 'local' : 'error');
  });
  window.addEventListener('surveyor:project-loaded', () => setTimeout(markBaseline, 0));
  window.addEventListener('surveyor:project-new', () => setTimeout(markBaseline, 0));
  window.addEventListener('surveyor:recovery-restored', () => {
    recoveryPending = true;
    const persisted = persistLocal();
    setState(navigator.onLine ? 'dirty' : (persisted ? 'local' : 'error'));
  });
  window.addEventListener('surveyor:project-ready', () => recoveryPending ? scheduleInspect(0) : markBaseline());
  window.addEventListener('surveyor:history-changed', () => scheduleInspect());
  window.addEventListener('offline', () => {
    if (signature() !== baseline || recoveryPending) {
      const persisted = persistLocal();
      setState(persisted ? 'local' : 'error');
    } else render();
  });
  window.addEventListener('online', () => scheduleInspect(60));

  document.addEventListener('input', (event) => {
    if (event.target?.closest?.('#mapShell, .map-page, body.georural-map-page')) scheduleInspect(80);
  }, true);
  document.addEventListener('change', () => scheduleInspect(80), true);

  const start = () => {
    mount();
    const map = runtime()?.map;
    if (map?.on) {
      ['draw:created', 'draw:edited', 'draw:deleted', 'draw:editvertex'].forEach((eventName) => map.on(eventName, () => scheduleInspect(80)));
    }
    if (!baseline) baseline = signature();
    inspect();
    setInterval(inspect, 700);
    let attempts = 0;
    mountTimer = setInterval(() => {
      if (mount() || ++attempts > 30) clearInterval(mountTimer);
    }, 150);
  };

  if (runtime()) start();
  else window.addEventListener('surveyor:map-runtime-ready', start, { once: true });
})();
