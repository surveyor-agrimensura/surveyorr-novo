import {GlobalLoading} from '../../components/GlobalLoading';
import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Cookie, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { Wordmark } from '../../components/Brand';
import { hasSavedPrivacyChoice, openCookiePreferences, PRIVACY_PREFERENCES_SAVED_EVENT } from '../../components/CookiePreferences';
import { useAuth } from './AuthContext';
import {
  completeFirstAccess, confirmPasswordReset, requestPasswordReset, verifyResetCode
} from './authService';
import { OFFICIAL_SITE, SUPPORT_EMAIL } from '../../lib/config';

type View = 'login' | 'verification' | 'first-access' | 'reset-email' | 'reset-code' | 'reset-password';
const errorText = (e: unknown) => e instanceof Error ? e.message : 'Não foi possível concluir a solicitação.';

export function LoginPage() {
  const navigate = useNavigate();
  const { session, status, signIn, confirmCode } = useAuth();
  const [view, setView] = useState<View>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [pendingToken, setPendingToken] = useState('');
  const [resetAuthorization, setResetAuthorization] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [verificationNote, setVerificationNote] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [privacyChoiceSaved, setPrivacyChoiceSaved] = useState(() => hasSavedPrivacyChoice());
  const [resendDelay, setResendDelay] = useState(0);
  useEffect(() => {
    const updatePrivacyChoice = () => setPrivacyChoiceSaved(hasSavedPrivacyChoice());
    window.addEventListener(PRIVACY_PREFERENCES_SAVED_EVENT, updatePrivacyChoice);
    return () => window.removeEventListener(PRIVACY_PREFERENCES_SAVED_EVENT, updatePrivacyChoice);
  }, []);
  useEffect(() => {
    if (resendDelay <= 0) return;
    const timer = window.setTimeout(() => setResendDelay(n => Math.max(0, n - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendDelay]);

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get('reason');
    if (reason === 'idle_timeout') setMessage('Sua sessão expirou após 30 minutos sem atividade. Entre novamente.');
    if (reason === 'session_revoked') setMessage('Sua sessão foi encerrada. Entre novamente para continuar.');
    if (reason === 'plan_expired') setMessage('Seu plano está expirado. Entre em contato com o suporte.');
  }, []);

  if (status === 'ready' && session) return <Navigate to="/" replace />;

  function go(viewName: View) { setError(''); setMessage(''); setView(viewName); }
  async function onLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('');
    if (!hasSavedPrivacyChoice()) {
      setPrivacyChoiceSaved(false);
      setError('Defina e salve suas preferências de cookies antes de entrar.');
      openCookiePreferences();
      return;
    }
    setWorking(true);
    try {
      const result = await signIn(email, password);
      if (result.kind === 'success') { navigate('/', { replace: true }); return; }
      if (result.kind === 'verification') {
        setPendingToken(result.token); setVerificationNote(result.message); setCode(''); go('verification');
      }
      if (result.kind === 'first-access') {
        setPendingToken(result.token); setNewPassword(''); setConfirmPassword(''); go('first-access');
      }
    } catch (e) { setError(errorText(e)); }
    finally { setWorking(false); }
  }
  async function onVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (!/^\d{6}$/.test(code)) { setError('Digite o código de 6 dígitos recebido por e-mail.'); return; }
    setWorking(true);
    try { await confirmCode(email, code, pendingToken); navigate('/', { replace: true }); }
    catch (e) { setError(errorText(e)); }
    finally { setWorking(false); }
  }
  async function onFirstAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (newPassword.length < 12) { setError('Use pelo menos 12 caracteres.'); return; }
    if (newPassword !== confirmPassword) { setError('As senhas não são iguais.'); return; }
    setWorking(true);
    try {
      await completeFirstAccess(pendingToken, newPassword);
      setPassword(''); go('login'); setMessage('Senha criada com sucesso. Entre com sua nova senha.');
    } catch (e) { setError(errorText(e)); }
    finally { setWorking(false); }
  }
  async function onResetRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setWorking(true); setError('');
    try {
      const response = await requestPasswordReset(recoveryEmail.trim().toLowerCase());
      setPendingToken(response.resetToken || ''); setCode(''); setResendDelay(30); setVerificationNote(response.message || 'Digite o código que foi enviado ao seu e-mail.');
      go('reset-code');
    } catch (e) { setError(errorText(e)); }
    finally { setWorking(false); }
  }
  async function onResetVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (!/^\d{6}$/.test(code)) { setError('Informe um código de 6 dígitos.'); return; }
    setWorking(true);
    try {
      const response = await verifyResetCode(recoveryEmail.trim().toLowerCase(), code, pendingToken);
      setResetAuthorization(response.resetAuthorization || ''); setNewPassword(''); setConfirmPassword(''); go('reset-password');
    } catch (e) { setError(errorText(e)); }
    finally { setWorking(false); }
  }
  async function onResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (newPassword.length < 12) { setError('A nova senha deve conter pelo menos 12 caracteres.'); return; }
    if (newPassword !== confirmPassword) { setError('As senhas não conferem.'); return; }
    setWorking(true);
    try {
      await confirmPasswordReset(recoveryEmail.trim().toLowerCase(), newPassword, resetAuthorization);
      setEmail(recoveryEmail); setPassword(''); go('login'); setMessage('Sua senha foi atualizada. Faça login para continuar.');
    } catch (e) { setError(errorText(e)); }
    finally { setWorking(false); }
  }
  async function resendReset() {
    setWorking(true); setError('');
    try {
      const response = await requestPasswordReset(recoveryEmail.trim().toLowerCase());
      setPendingToken(response.resetToken || ''); setCode(''); setResendDelay(30); setMessage('Enviamos um novo código para o seu e-mail.');
    } catch (e) { setError(errorText(e)); }
    finally { setWorking(false); }
  }

  const isLogin = view === 'login';
  return (
    <div className="app-shell login-shell">
      <GlobalLoading active={working || status==='checking'} />
      <main className="login-main">
        <aside className="login-visual" aria-label="Sobre o Surveyor">
          <div className="login-visual-copy">
            <Wordmark className="login-visual-wordmark" />
            <h2>Gestão territorial<br />com precisão</h2>
            <span className="login-visual-accent" aria-hidden="true" />
            <p>Plataforma de apoio ao levantamento, organização e gestão de informações territoriais rurais, com segurança, confiabilidade e precisão.</p>
          </div>
        </aside>
        <section className="login-content" aria-label="Acesso à conta">
          <div className="auth-card" aria-labelledby="login-title">
            {!isLogin && <button className="back-link" type="button" onClick={() => go('login')}><ArrowLeft size={16} /> Voltar ao login</button>}
            <h1 id="login-title">{({
              login: 'Entre na sua conta', verification: 'Confirme seu e-mail', 'first-access': 'Crie sua senha',
              'reset-email': 'Recuperar senha', 'reset-code': 'Verifique o código', 'reset-password': 'Defina uma nova senha'
            } as Record<View, string>)[view]}</h1>
            <p className="auth-subtitle">{({
              login: 'Use seu e-mail e senha para acessar o Surveyor.',
              verification: verificationNote || 'Digite o código que enviamos ao seu e-mail.',
              'first-access': 'Escolha uma senha segura para continuar.',
              'reset-email': 'Informe seu e-mail cadastrado para receber um código.',
              'reset-code': verificationNote || 'Digite o código enviado ao seu e-mail.',
              'reset-password': 'Sua nova senha deve conter pelo menos 12 caracteres.'
            } as Record<View, string>)[view]}</p>

            {isLogin && <form className="auth-form" onSubmit={onLogin}>
            <label className="form-field"><span>E-mail</span><input autoComplete="username" autoFocus type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@empresa.com" required /></label>
            <label className="form-field"><span>Senha</span><span className="password-input"><input autoComplete="current-password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Sua senha" required /><button aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword} type="button" onClick={() => setShowPassword(v => !v)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />} <span>{showPassword ? 'Ocultar' : 'Mostrar'}</span></button></span></label>
            <div className="forgot-row"><button type="button" onClick={() => { setRecoveryEmail(email); go('reset-email'); }}>Esqueci minha senha</button></div>
            {!privacyChoiceSaved&&<p className="privacy-login-required">Salve suas preferências de cookies para liberar o acesso.</p>}
            <button className="button primary submit-btn" disabled={working || !privacyChoiceSaved} type="submit">{working ? 'Entrando...' : 'Entrar'}</button>
          </form>}
            {view === 'verification' && <form className="auth-form" onSubmit={onVerify}>
            <label className="form-field"><span>Código de confirmação</span><input autoFocus type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} required /></label>
            <button className="button primary submit-btn" disabled={working} type="submit">{working ? 'Verificando...' : 'Confirmar e entrar'}</button>
          </form>}
            {view === 'first-access' && <form className="auth-form" onSubmit={onFirstAccess}>
            <label className="form-field"><span>Nova senha</span><input autoFocus type="password" autoComplete="new-password" minLength={12} value={newPassword} onChange={e => setNewPassword(e.target.value)} required /></label>
            <label className="form-field"><span>Confirme a senha</span><input type="password" autoComplete="new-password" minLength={12} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required /></label>
            <button className="button primary submit-btn" disabled={working} type="submit">{working ? 'Salvando...' : 'Salvar senha'}</button>
          </form>}
            {view === 'reset-email' && <form className="auth-form" onSubmit={onResetRequest}>
            <label className="form-field"><span>E-mail cadastrado</span><span className="icon-input"><Mail size={17} /><input autoFocus type="email" autoComplete="email" value={recoveryEmail} placeholder="voce@empresa.com" onChange={e => setRecoveryEmail(e.target.value)} required /></span></label>
            <button className="button primary submit-btn" disabled={working} type="submit">{working ? 'Enviando...' : 'Enviar código'}</button>
          </form>}
            {view === 'reset-code' && <form className="auth-form" onSubmit={onResetVerify}>
            <label className="form-field"><span>Código de 6 dígitos</span><input autoFocus type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" required /></label>
            <button className="button primary submit-btn" disabled={working} type="submit">{working ? 'Validando...' : 'Validar código'}</button>
            <button className="text-action" type="button" disabled={working || resendDelay > 0} onClick={() => void resendReset()}>{resendDelay > 0 ? `Reenviar em ${resendDelay}s` : 'Reenviar código'}</button>
          </form>}
            {view === 'reset-password' && <form className="auth-form" onSubmit={onResetPassword}>
            <label className="form-field"><span>Nova senha</span><span className="icon-input"><LockKeyhole size={17} /><input autoFocus type="password" autoComplete="new-password" minLength={12} value={newPassword} onChange={e => setNewPassword(e.target.value)} required /></span></label>
            <label className="form-field"><span>Confirmar senha</span><input type="password" autoComplete="new-password" minLength={12} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required /></label>
            <button className="button primary submit-btn" disabled={working} type="submit">{working ? 'Salvando...' : 'Atualizar senha'}</button>
          </form>}
            {error && <div className="auth-alert error" role="alert">{error}</div>}
            {message && <div className="auth-alert info" role="status">{message}</div>}
            {isLogin ? <div className="login-legal-links">
              <a href={`${OFFICIAL_SITE}/privacidade/`} target="_blank" rel="noreferrer"><LockKeyhole size={18} /> Política de Privacidade</a>
              <a href={`${OFFICIAL_SITE}/seguranca/`} target="_blank" rel="noreferrer"><span className="login-shield-icon" aria-hidden="true">✓</span> Segurança da Informação</a>
              <button className="privacy-preferences-link" type="button" onClick={openCookiePreferences}><Cookie size={17}/> Preferências</button>
            </div> : <p className="auth-terms">Ao continuar, você concorda com os <a href={`${OFFICIAL_SITE}/termos/`} target="_blank" rel="noreferrer">Termos de Uso</a> e a <a href={`${OFFICIAL_SITE}/privacidade/`} target="_blank" rel="noreferrer">Política de Privacidade</a>.</p>}
          </div>
          <p className="login-support-note">Suporte: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> · <a href={`${OFFICIAL_SITE}/termos/`} target="_blank" rel="noreferrer">Termos de Uso</a></p>
        </section>
      </main>
    </div>
  );
}
