import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

type Props = { children: ReactNode };
type State = { hasError: boolean; diagnostic: string };

/** Impede que um erro de renderização de um módulo apague a página inteira. */
export class PageErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, diagnostic: '' };

  static getDerivedStateFromError(error: Error): State {
    // Exibir apenas o nome e uma mensagem curta. Nunca incluir dados de sessão.
    const message = String(error?.message || 'Erro sem descrição')
      .replace(/Bearer\s+[^\s]+/gi, 'Bearer [oculto]')
      .replace(/(?:access_token|token|password|senha)=([^&\s]+)/gi, '$1=[oculto]')
      .slice(0, 240);
    return { hasError: true, diagnostic: `${error?.name || 'Erro'}: ${message}` };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Apenas informações de diagnóstico. Nunca registrar sessão, tokens ou dados de projetos.
    console.error('SURVEYOR: erro ao renderizar a página', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="workspace-main" role="alert">
        <div className="workspace-container page-recovery">
          <AlertTriangle aria-hidden="true" size={34} />
          <h1>Não foi possível exibir esta página.</h1>
          <p>Ocorreu um erro ao carregar o módulo. Você pode tentar novamente sem perder a navegação do SURVEYOR.</p>
          {import.meta.env.DEV && <details style={{ maxWidth: 620, width: '100%', textAlign: 'left', fontSize: 13 }}>
            <summary>Mostrar diagnóstico técnico</summary>
            <code style={{ display: 'block', overflowWrap: 'anywhere', padding: 12, marginTop: 8, background: '#e9f1fa', borderRadius: 8 }}>{this.state.diagnostic}</code>
          </details>}
          <div className="page-recovery-actions">
            <button type="button" className="button primary" onClick={() => window.location.reload()}>Tentar novamente</button>
            <a className="button outline" href="/">Voltar ao início</a>
          </div>
        </div>
      </main>
    );
  }
}
