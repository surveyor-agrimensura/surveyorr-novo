import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Cookie, Info, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';
import { getPrivacyPreferences, savePrivacyPreferences, type PrivacyPreferences } from '../features/auth/privacyPreferencesApi';
import './CookiePreferences.css';

const COOKIE_KEY = 'surveyor-cookie-preferences-v1';
const ACCOUNT_SYNC_COOKIE_KEY = 'surveyor-account-sync-consent-v1';
const OPEN_EVENT = 'surveyor:open-privacy-preferences';
export const PRIVACY_PREFERENCES_SAVED_EVENT = 'surveyor:privacy-preferences-saved';
type OptionalCategory = 'analytics' | 'personalization' | 'marketing';
type Preferences = PrivacyPreferences & { accountId?: string };
type Choices = Omit<PrivacyPreferences, 'updatedAt'>;
const defaults: Choices = { version: 1, necessary: true, analytics: false, personalization: false, marketing: false };

export function openCookiePreferences() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

function hasAccountSyncConsentCookie() {
  return typeof document !== 'undefined' && document.cookie.split('; ').some((part) => part.startsWith(`${ACCOUNT_SYNC_COOKIE_KEY}=accepted`));
}

export function hasSavedPrivacyChoice() {
  return Boolean(readPreferences() && hasAccountSyncConsentCookie());
}

function normalizePreferences(value: Partial<Preferences> | null | undefined): Preferences | null {
  if (!value || value.version !== 1 || value.necessary !== true) return null;
  const parsed = Date.parse(String(value.updatedAt || ''));
  return {
    ...defaults,
    analytics: value.analytics === true,
    personalization: value.personalization === true,
    marketing: value.marketing === true,
    updatedAt: Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString(),
    ...(value.accountId ? { accountId: String(value.accountId) } : {})
  };
}

function readPreferences(): Preferences | null {
  try {
    if (typeof document === 'undefined') return null;
    const encoded = document.cookie.split('; ').find((part) => part.startsWith(`${COOKIE_KEY}=`))?.slice(COOKIE_KEY.length + 1);
    const legacy = !encoded && typeof localStorage !== 'undefined' ? localStorage.getItem('surveyor-privacy-preferences-v1') : null;
    const value = JSON.parse(encoded ? decodeURIComponent(encoded) : legacy || 'null') as Partial<Preferences> | null;
    const normalized = normalizePreferences(value);
    // Migra apenas as preferências antigas. A permissão nova de sincronização
    // com a conta precisa ser escolhida explicitamente pelo usuário.
    if (normalized && !encoded) writePreferencesCookie(normalized, false);
    return normalized;
  } catch { return null; }
}

function writePreferencesCookie(value: Preferences, includeSyncConsent = true) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE_KEY}=${encodeURIComponent(JSON.stringify(value))}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  if (!document.cookie.split('; ').some((part) => part.startsWith(`${COOKIE_KEY}=`))) {
    throw new Error('O navegador não aceitou o cookie de preferências.');
  }
  if (!includeSyncConsent) return;
  document.cookie = `${ACCOUNT_SYNC_COOKIE_KEY}=accepted; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  if (!document.cookie.split('; ').some((part) => part.startsWith(`${ACCOUNT_SYNC_COOKIE_KEY}=accepted`))) {
    throw new Error('O navegador não aceitou o registro obrigatório para sincronizar as preferências da conta.');
  }
}

function apiPreferences(value: Preferences): PrivacyPreferences {
  const { accountId: _accountId, ...preferences } = value;
  void _accountId;
  return preferences;
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível sincronizar as preferências com a conta.';
}

export function CookiePreferences() {
  const { session, status } = useAuth();
  const userId = session?.user?.id || session?.user?.email || '';
  const scope = userId || 'anonymous';
  const [saved, setSaved] = useState<Preferences | null>(() => readPreferences());
  const [choices, setChoices] = useState<Choices>(defaults);
  const [accountSyncConsent, setAccountSyncConsent] = useState(() => hasSavedPrivacyChoice());
  const [open, setOpen] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [initializedFor, setInitializedFor] = useState('');
  const dialog = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const openPanel = () => { returnFocus.current = document.activeElement as HTMLElement; setChoices(saved ? apiPreferences(saved) : defaults); setAccountSyncConsent(hasSavedPrivacyChoice()); setOpen(true); };
    window.addEventListener(OPEN_EVENT, openPanel);
    return () => window.removeEventListener(OPEN_EVENT, openPanel);
  }, [saved]);

  useEffect(() => {
    if (status === 'checking') return;
    let active = true;
    const local = readPreferences();
    if (!session) {
      setSaved(local);
      setChoices(local ? apiPreferences(local) : defaults);
      setSaveError('');
      setSyncing(false);
      setInitializedFor('anonymous');
      return () => { active = false; };
    }

    const belongsToAccount = (value: Preferences | null) => Boolean(value && (!value.accountId || value.accountId === userId));
    setInitializedFor('');
    setSyncing(true);
    void (async () => {
      try {
        const remote = await getPrivacyPreferences(session);
        let resolved: Preferences | null = null;
        const localForAccount = belongsToAccount(local) ? local : null;
        if (remote) {
          const localTime = Date.parse(localForAccount?.updatedAt || '');
          const remoteTime = Date.parse(remote.updatedAt || '');
          if (localForAccount && localTime > remoteTime) {
            resolved = { ...localForAccount, accountId: userId };
            await savePrivacyPreferences(session, apiPreferences(resolved));
          } else {
            resolved = { ...remote, accountId: userId };
          }
        } else if (localForAccount) {
          resolved = { ...localForAccount, accountId: userId };
          await savePrivacyPreferences(session, apiPreferences(resolved));
        }
        if (resolved) writePreferencesCookie(resolved, hasAccountSyncConsentCookie());
        if (!active) return;
        setSaved(resolved);
        setChoices(resolved ? apiPreferences(resolved) : defaults);
        setSaveError('');
      } catch (error) {
        if (!active) return;
        const localForAccount = belongsToAccount(local) ? local : null;
        setSaved(localForAccount);
        setChoices(localForAccount ? apiPreferences(localForAccount) : defaults);
        setSaveError(`A escolha fica neste navegador, mas ainda não foi sincronizada com a conta: ${errorText(error)}`);
      } finally {
        if (active) { setSyncing(false); setInitializedFor(userId); }
      }
    })();
    return () => { active = false; };
  }, [session, status, userId]);

  useEffect(() => {
    // Uma sessão já ativa também precisa registrar a nova escolha obrigatória;
    // o diálogo bloqueia a tela até a pessoa confirmar essa preferência.
    if (session && initializedFor === scope && !hasSavedPrivacyChoice()) setOpen(true);
  }, [initializedFor, scope, session]);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (hasSavedPrivacyChoice()) setOpen(false); return; }
      if (event.key !== 'Tab' || !dialog.current) return;
      const focusable = Array.from(dialog.current.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href],[tabindex="0"]'));
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); returnFocus.current?.focus(); };
  }, [open, saved]);

  const save = useCallback(async (next: Choices, acceptAll = false) => {
    if (!acceptAll && !accountSyncConsent) {
      setSaveError('Marque o cookie obrigatório de sincronização da conta para continuar.');
      return;
    }
    setSaveError('');
    const value: Preferences = {
      ...next,
      updatedAt: new Date().toISOString(),
      ...(session && userId ? { accountId: userId } : {})
    };
    try { writePreferencesCookie(value); }
    catch (error) { setSaveError(errorText(error)); return; }
    window.dispatchEvent(new Event(PRIVACY_PREFERENCES_SAVED_EVENT));
    setSaved(value);
    setChoices(next);
    setOpen(false);
    if (!session) return;
    setSyncing(true);
    try {
      const confirmed = await savePrivacyPreferences(session, apiPreferences(value));
      const synchronized = { ...confirmed, accountId: userId };
      writePreferencesCookie(synchronized);
      setSaved(synchronized);
      setChoices(apiPreferences(synchronized));
      setSaveError('');
    } catch (error) {
      setSaveError(`Preferências salvas neste navegador, mas não sincronizadas com a conta: ${errorText(error)}`);
    } finally { setSyncing(false); }
  }, [accountSyncConsent, session, userId]);

  const retrySync = useCallback(async () => {
    if (!session || !saved) return;
    setSyncing(true);
    try {
      const confirmed = await savePrivacyPreferences(session, apiPreferences(saved));
      const synchronized = { ...confirmed, accountId: userId };
      writePreferencesCookie(synchronized);
      setSaved(synchronized);
      setChoices(apiPreferences(synchronized));
      setSaveError('');
    } catch (error) {
      setSaveError(`Preferências salvas neste navegador, mas não sincronizadas com a conta: ${errorText(error)}`);
    } finally { setSyncing(false); }
  }, [saved, session, userId]);

  const toggle = (category: OptionalCategory) => (event: ChangeEvent<HTMLInputElement>) => {
    setChoices((current) => ({ ...current, [category]: event.target.checked }));
  };
  const initialized = initializedFor === scope;

  return <>
    {initialized && !hasSavedPrivacyChoice() && <aside className="privacy-consent-banner" aria-label="Preferências de privacidade">
      <div className="privacy-consent-copy"><ShieldCheck size={22}/><div><strong>Respeitamos a sua privacidade</strong><p>Para continuar, aceite todos os cookies ou defina suas preferências e marque o cookie obrigatório de sincronização da conta.</p></div></div>
      {saveError&&<p className="privacy-save-error" role="alert">{saveError}</p>}
      <div className="privacy-consent-actions"><button type="button" className="privacy-button secondary" onClick={() => { setChoices(defaults); setAccountSyncConsent(false); setOpen(true); }}>Definir Cookies</button><button type="button" className="privacy-button primary" onClick={() => void save({ ...defaults, analytics: true, personalization: true, marketing: true }, true)}>Aceitar tudo</button></div>
    </aside>}
    {initialized && saved && <button className="privacy-reopen" type="button" aria-label="Abrir preferências de cookies e privacidade" title="Preferências de privacidade" onClick={() => { returnFocus.current = document.activeElement as HTMLElement; setChoices(apiPreferences(saved)); setAccountSyncConsent(hasSavedPrivacyChoice()); setOpen(true); }}><Cookie size={17}/></button>}
    {initialized && saveError && saved && <aside className="privacy-sync-toast" role="status"><span>{syncing ? 'Sincronizando preferências...' : saveError}</span>{session&&<button type="button" disabled={syncing} onClick={() => void retrySync()}>{syncing?'Aguarde':'Tentar sincronizar'}</button>}</aside>}
    {open && <div className="privacy-dialog-backdrop">
      <section className="privacy-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="privacy-dialog-title" aria-describedby="privacy-dialog-description">
        <header className="privacy-dialog-header"><div><h2 id="privacy-dialog-title">Respeitamos a sua privacidade</h2><small>{saved?.updatedAt ? `Última atualização: ${new Date(saved.updatedAt).toLocaleDateString('pt-BR')}` : 'Escolha como tecnologias opcionais podem ser usadas.'}</small></div>{hasSavedPrivacyChoice()&&<button ref={closeButton} type="button" className="privacy-close" aria-label="Fechar preferências" onClick={() => setOpen(false)}><X size={20}/></button>}</header>
        <p id="privacy-dialog-description" className="privacy-dialog-intro">Os cookies essenciais mantêm a sessão e a segurança. As categorias opcionais podem ser alteradas a qualquer momento em Preferências de privacidade.</p>
        <div className="privacy-category-list">
          <section className="privacy-category"><div className="privacy-category-heading"><div><strong>Estritamente necessários</strong><small>Autenticação, segurança e funcionamento básico.</small></div><span className="privacy-always-on">Sempre ativos</span></div><label className="privacy-toggle"><input type="checkbox" checked disabled readOnly/><span className="privacy-switch"/><span className="sr-only">Cookies necessários, sempre ativos</span></label></section>
          <section className="privacy-category"><div className="privacy-category-heading"><div><strong>Sincronização da conta (obrigatório)</strong><small>Registra sua escolha e permite salvar preferências na conta.</small></div><span className="privacy-always-on">Obrigatório para continuar</span></div><label className="privacy-toggle"><input type="checkbox" checked={accountSyncConsent} onChange={(event) => { setAccountSyncConsent(event.target.checked); setSaveError(''); }}/><span className="privacy-switch"/><span className="sr-only">Aceitar o cookie obrigatório de sincronização da conta</span></label></section>
          <section className="privacy-category"><div className="privacy-category-heading"><div><strong>Desempenho e funcionamento</strong><small>Preferências que ajudam a melhorar o funcionamento do serviço.</small></div></div><label className="privacy-toggle"><input type="checkbox" checked={choices.analytics} onChange={toggle('analytics')}/><span className="privacy-switch"/><span className="sr-only">Permitir cookies de desempenho e funcionamento</span></label></section>
          <section className="privacy-category"><div className="privacy-category-heading"><div><strong>Personalização</strong><small>Preferências opcionais de apresentação da experiência.</small></div></div><label className="privacy-toggle"><input type="checkbox" checked={choices.personalization} onChange={toggle('personalization')}/><span className="privacy-switch"/><span className="sr-only">Permitir personalização</span></label></section>
          <section className="privacy-category"><div className="privacy-category-heading"><div><strong>Marketing e publicidade</strong><small>Atualmente, não há publicidade carregada nesta interface.</small></div></div><label className="privacy-toggle"><input type="checkbox" checked={choices.marketing} onChange={toggle('marketing')}/><span className="privacy-switch"/><span className="sr-only">Permitir marketing e publicidade</span></label></section>
        </div>
        <p className="privacy-storage-note"><Info size={16}/> A escolha é salva neste navegador e, quando você entra na conta, sincronizada com a API. As personalizações do Memorial são salvas separadamente em Personalização da conta.</p>
        {saveError&&<p className="privacy-save-error" role="alert">{saveError}</p>}
        <footer className="privacy-dialog-actions"><button type="button" className="privacy-button secondary" disabled={syncing || !accountSyncConsent} onClick={() => void save(defaults)}>Somente essenciais</button><button type="button" className="privacy-button secondary" disabled={syncing || !accountSyncConsent} onClick={() => void save(choices)}>Salvar cookies</button><button type="button" className="privacy-button primary" onClick={() => void save({ ...defaults, analytics: true, personalization: true, marketing: true }, true)}>Aceitar tudo</button></footer>
      </section>
    </div>}
  </>;
}
