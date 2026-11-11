import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, Cookie, Crown, Database, Folder, GraduationCap, Grid2X2, Headphones, LogOut, Map, Search, ShieldCheck, UserRound, X } from 'lucide-react';
import { RoundLogo } from '../Brand';
import { useAuth } from '../../features/auth/AuthContext';
import { InstallPwaButton } from '../../features/pwa/InstallPwaButton';
import { filterToolGroups, toolGroups, type ToolItem } from '../../data/navigation';
import {NotificationCenter} from './NotificationCenter';
import { openCookiePreferences } from '../CookiePreferences';
import { dispatchRouteTransitionRequest, requestRouteTransition, resolveRouteTransitionRequest } from '../../lib/routeTransitions';

const initials = (text: string) => (text.match(/[A-Za-zÀ-ÖØ-öø-ÿ0-9]+/g)?.slice(0,2).map(w=>w[0]).join('') || 'U').toUpperCase();
const firstName = (text: string) => (text.trim().split(/\s+/)[0] || 'usuário').toUpperCase();
const adminToolGroup = { label: 'GESTÃO', tools: [{ label: 'Administração', summary: 'Controle de equipe e planos', icon: ShieldCheck, href: '/admin/' }] };
function planTitle(text: string) {
  const lower = text.toLowerCase();
  return lower.includes('pro') ? `Plano Pro${/annual|anual/.test(lower) ? ' Anual' : ''}` : lower.includes('plus') ? 'Plano Plus' : text || 'Meu plano';
}
function planDate(date?: string) {
  if (!date) return 'Informações do plano';
  const value = new Date(date);
  return Number.isNaN(value.getTime()) ? 'Informações do plano' : `Ativo até ${value.toLocaleDateString('pt-BR')}`;
}

const menus = [
  { key: 'tools', title: 'Ferramentas', icon: Grid2X2 },
  { key: 'map', title: 'Mapa', icon: Map, href: '/mapa/' },
  { key: 'projects', title: 'Projetos', icon: Folder, href: '/nuvem/' },
  { key: 'official', title: 'Acervos oficiais', icon: Database, href: '/acervos/' },
  { key: 'courses', title: 'Cursos', icon: GraduationCap, href: '/cursos/' },
  { key: 'support', title: 'Suporte', icon: Headphones, href: '/suporte/' }
];
export function WorkspaceLayout({ children, home = false }: { children: ReactNode; home?: boolean }) {
  const { session, signOut } = useAuth();
  const [toolsOpen, setToolsOpen] = useState(false);
  const [toolSearch, setToolSearch] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [expandedShortcut, setExpandedShortcut] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isTerritorialMap = location.pathname === '/mapa/' || location.pathname === '/mapa';
  const isMemorialWorkspace = location.pathname.startsWith('/memorial/');
  const isCroquiWorkspace = location.pathname.startsWith('/mapas/');
  const isAdminWorkspace = location.pathname.startsWith('/admin/');
  const isDocumentWorkflow = ['/pranchas/', '/confrontacao/', '/ods/', '/ambiental/', '/planialtimetria/', '/central-lotes/', '/perimetro-azimute/', '/loteamento-reurb/'].some(path => location.pathname.startsWith(path));
  const headerRef = useRef<HTMLElement>(null);
  const user = session?.user;
  const name = user?.name || user?.email?.split('@')[0] || 'usuário';
  // O painel administrativo deve ser apresentado somente a contas com papel admin,
  // conforme o perfil retornado pela API autenticada. A API protege os dados/ações.
  const isAdministrator = String(user?.role || '').trim().toLowerCase() === 'admin';
  const activeTool = toolGroups.flatMap(group => group.tools).find(tool => location.pathname.startsWith(tool.href));
  const activeGenerator = ['/memorial/', '/mapas/', '/pranchas/', '/confrontacao/', '/ods/', '/consulta-car/', '/ambiental/', '/planialtimetria/', '/perimetro-azimute/', '/loteamento-reurb/', '/central-lotes/', '/customizacao/', '/admin/'].some(path => location.pathname.startsWith(path));
  const catalogGroups = isAdministrator ? [...toolGroups, adminToolGroup] : toolGroups;
  const visibleToolGroups = filterToolGroups(catalogGroups, toolSearch);
  const visibleToolCount = visibleToolGroups.reduce((count, group) => count + group.tools.length, 0);

  // Apenas um atalho ocupa a largura expandida. Os demais se deslocam naturalmente.
  const activeShortcut = expandedShortcut ?? (toolsOpen ? 'tools' : null);

  function guardWorkspaceLink(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest<HTMLAnchorElement>('a[href]');
    if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
    const destination = new URL(anchor.href, window.location.href);
    if (destination.origin !== window.location.origin ||
        destination.pathname === location.pathname && destination.search === location.search) return;
    const request=dispatchRouteTransitionRequest();
    if(request.allowed&&!request.confirmations.length)return;
    event.preventDefault();
    event.stopPropagation();
    void resolveRouteTransitionRequest(request).then(allowed=>{
      if(allowed)navigate(`${destination.pathname}${destination.search}${destination.hash}`);
    });
  }

  useEffect(() => {
    setToolsOpen(false);
    setProfileOpen(false);
    setExpandedShortcut(null);
  }, [location.pathname]);

  useEffect(() => {
    if (!toolsOpen && !profileOpen) return;
    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setToolsOpen(false);
        setProfileOpen(false);
        setExpandedShortcut(null);
      }
    }
    function onOutside(event: PointerEvent) {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setToolsOpen(false);
        setProfileOpen(false);
        setExpandedShortcut(null);
      }
    }
    document.addEventListener('keydown', onEscape);
    document.addEventListener('pointerdown', onOutside);
    return () => {
      document.removeEventListener('keydown', onEscape);
      document.removeEventListener('pointerdown', onOutside);
    };
  }, [toolsOpen, profileOpen]);

  async function logout() {
    if (!await requestRouteTransition()) return;
    setBusy(true);
    try {
      await signOut();
      navigate('/login/', { replace: true });
    } finally {
      setBusy(false);
    }
  }
  function activate(tool: ToolItem) {
    void requestRouteTransition().then(allowed=>{
      if(!allowed)return;
      setToolsOpen(false);
      navigate(tool.href);
    });
  }
  function toggleTools() {
    setToolSearch('');
    setToolsOpen(current => !current);
    setProfileOpen(false);
  }

  return <div className={`app-shell workspace-shell ${home ? 'home-shell' : ''} ${isTerritorialMap ? 'map-entry-workspace' : ''} ${isMemorialWorkspace ? 'memorial-workspace' : ''} ${isCroquiWorkspace ? 'croqui-workspace' : ''} ${isDocumentWorkflow ? 'document-workflow' : ''} ${isAdminWorkspace ? 'admin-workspace' : ''}`} onClickCapture={guardWorkspaceLink}>
    {!isTerritorialMap && <>
    <header className="home-header workspace-header" ref={headerRef}>
      <Link className="home-header-brand workspace-header-brand home-brand" to="/" aria-label="Surveyor — Georreferenciamento e Agrimensura">
        <RoundLogo className="home-brand-logo" />
        <span className="home-brand-copy"><strong>SURVEYOR</strong><small>Georreferenciamento e Agrimensura</small></span>
      </Link>
      <nav className="global-shortcuts" aria-label="Navegação principal" onMouseLeave={() => setExpandedShortcut(null)}>
        {menus.map(({ title, icon: Icon, href, key }) => {
          const isActive = href ? location.pathname === href : key === 'tools' && toolsOpen;
          const isExpanded = activeShortcut === key || (key === 'tools' && activeGenerator);
          const visibleTitle = key === 'tools' && activeGenerator ? (activeTool?.label || 'Ferramentas') : title;
          const content = <>
            <Icon className="shortcut-icon" size={19} strokeWidth={1.9} aria-hidden="true" />
            <span className="shortcut-label" aria-hidden={!isExpanded}>{visibleTitle}</span>
            {key === 'tools' && <span className="shortcut-disclosure" aria-hidden="true">{toolsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>}
          </>;
          const className = `shortcut expandable-shortcut ${isActive || key === 'tools' && activeGenerator ? 'is-active' : ''} ${isExpanded ? 'is-expanded' : ''} ${key === 'tools' && activeGenerator ? 'is-generator' : ''}`;
          const interactions = {
            onMouseEnter: () => setExpandedShortcut(key),
            onFocus: () => setExpandedShortcut(key),
            onBlur: () => setExpandedShortcut(null)
          };
          if (href) return <Link key={key} className={className} to={href} aria-label={title} aria-current={isActive ? 'page' : undefined} {...interactions}>{content}</Link>;
          return <button key={key} type="button" className={className} aria-label={visibleTitle} aria-expanded={key === 'tools' ? toolsOpen : undefined} aria-controls={key === 'tools' ? 'surveyor-tools-panel' : undefined} onClick={() => key === 'tools' ? toggleTools() : setToolsOpen(false)} {...interactions}>{content}</button>;
        })}
      </nav>
      <div className="header-actions">
        <InstallPwaButton iconOnly />
        <NotificationCenter session={session}/>
        {!home && <div className="plan-pill"><Crown size={16} fill="#ffd36d" color="#ffd36d" /><span><b>{planTitle(user?.planName || user?.planSlug || user?.plan || '')}</b><small>{planDate(user?.expiresAt)}</small></span></div>}
        <div className="account">
          <button className="account-trigger" type="button" onClick={() => { setProfileOpen(value => !value); setToolsOpen(false); }} aria-expanded={profileOpen} aria-haspopup="menu"><span className="avatar">{initials(name)}</span><span className="account-name">Olá, {firstName(name)}</span><ChevronDown size={14} className={profileOpen ? 'up' : ''} /></button>
          {profileOpen && <div className="account-popover" role="menu"><div className="account-profile"><span className="account-profile-avatar"><UserRound size={22} /></span><div><strong>{name}</strong><small>{user?.email || ''}</small></div></div><button role="menuitem" type="button" className="privacy-menu-action" onClick={openCookiePreferences}><Cookie size={16}/> Privacidade e cookies</button><button role="menuitem" type="button" className="logout-action" disabled={busy} onClick={() => void logout()}><LogOut size={17} />{busy ? 'Saindo...' : 'Sair da conta'}</button></div>}
        </div>
      </div>
      {toolsOpen && <div className="tools-panel" id="surveyor-tools-panel" aria-label="Ferramentas do Surveyor">
        <div className="tools-search-row">
          <label className="tools-search"><Search size={17} aria-hidden="true"/><input value={toolSearch} onChange={event => setToolSearch(event.target.value)} placeholder="Buscar ferramenta" aria-label="Buscar ferramenta pelo nome ou descrição"/>{toolSearch&&<button type="button" onClick={()=>setToolSearch('')} aria-label="Limpar busca"><X size={15}/></button>}</label>
          <span className="tools-search-count" role="status" aria-live="polite">{visibleToolCount} {visibleToolCount===1?'ferramenta':'ferramentas'}</span>
        </div>
        <div className={`tools-panel-groups ${isAdministrator ? "" : "without-admin"}`}>
          {visibleToolGroups.map(group => <section className={`tool-group${group.label==='GESTÃO'?' tool-group-admin':''}`} key={group.label} aria-label={group.label==='GESTÃO'?'Gestão':undefined}>
            <h2>{group.label}</h2>
            <div className="tool-group-list">
              {group.tools.map(tool => <button
                className="tool-entry" type="button" key={tool.label}
                onClick={() => activate(tool)}
                title={tool.summary}
                aria-label={`${tool.label}: ${tool.summary}`}>
                <span className="tool-entry-icon"><tool.icon size={20} strokeWidth={1.8} aria-hidden="true" /></span>
                <span className="tool-entry-copy"><strong>{tool.label}</strong><small>{tool.summary}</small></span>
              </button>)}
            </div>
          </section>)}
          {!visibleToolCount&&<p className="tools-empty" role="status">Nenhuma ferramenta corresponde a “{toolSearch.trim()}”.</p>}
        </div>
      </div>}
    </header>
    </>}
    {children}
  </div>;
}
