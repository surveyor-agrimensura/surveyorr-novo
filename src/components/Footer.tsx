import { RoundLogo } from './Brand';
import { OFFICIAL_SITE, SUPPORT_EMAIL } from '../lib/config';

export function Footer({ login = false }: { login?: boolean }) {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <RoundLogo className="footer-logo" />
          <span><strong>SURVEYOR</strong><small>{login ? 'Plataforma de Gestão Territorial' : 'Georreferenciamento e Agrimensura'}</small></span>
        </div>
        <div className="footer-support">
          <span>SUPORTE</span>
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          <small>Atendimento e ajuda técnica</small>
        </div>
        <div className="footer-legal">
          <nav aria-label="Informações legais">
            <a href={`${OFFICIAL_SITE}/privacidade/`} target="_blank" rel="noreferrer">Privacidade</a>
            <a href={`${OFFICIAL_SITE}/termos/`} target="_blank" rel="noreferrer">Termos de Uso</a>
            <a href={`${OFFICIAL_SITE}/seguranca/`} target="_blank" rel="noreferrer">Segurança</a>
          </nav>
          <small>© {new Date().getFullYear()} SURVEYOR · Todos os direitos reservados</small>
        </div>
      </div>
    </footer>
  );
}
