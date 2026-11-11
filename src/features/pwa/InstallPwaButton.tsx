import { useEffect, useState } from 'react';
import { CloudDownload, Trash2, X } from 'lucide-react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
}

let pendingPrompt: InstallPromptEvent | null = null;
let installedInSession = false;
const subscribers = new Set<() => void>();
const signal = () => subscribers.forEach((subscriber) => subscriber());

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

function isInstalled() {
  return installedInSession || isStandalone();
}

function removalInstructions() {
  const agent = window.navigator.userAgent;
  if (/Android/i.test(agent)) {
    return 'No Android, mantenha pressionado o ícone do SURVEYOR na tela inicial e escolha “Desinstalar” ou “Remover”.';
  }
  if (/iPhone|iPad|iPod/i.test(agent)) {
    return 'No iPhone ou iPad, mantenha pressionado o ícone do SURVEYOR, toque em “Remover App” e confirme “Apagar App”.';
  }
  if (/Windows/i.test(agent)) {
    return 'No Windows, abra Configurações → Aplicativos → Aplicativos instalados, localize SURVEYOR e escolha “Desinstalar”. Também é possível usar o menu do aplicativo instalado no Chrome ou Edge.';
  }
  return 'Abra as configurações do dispositivo, localize SURVEYOR na lista de aplicativos instalados e escolha “Remover” ou “Desinstalar”.';
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    pendingPrompt = event as InstallPromptEvent;
    installedInSession = false;
    signal();
  });

  window.addEventListener('appinstalled', () => {
    pendingPrompt = null;
    installedInSession = true;
    signal();
  });
}

export function InstallPwaButton({ compact = false, iconOnly = false }: { compact?: boolean; iconOnly?: boolean }) {
  const [ready, setReady] = useState(Boolean(pendingPrompt));
  const [present, setPresent] = useState(isInstalled);
  const [hint, setHint] = useState<'install' | 'remove' | null>(null);

  useEffect(() => {
    const update = () => {
      setReady(Boolean(pendingPrompt));
      setPresent(isInstalled());
    };
    subscribers.add(update);
    const media = window.matchMedia('(display-mode: standalone)');
    media.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      subscribers.delete(update);
      media.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  const action = async () => {
    if (present) {
      setHint('remove');
      return;
    }
    if (!pendingPrompt) {
      setHint('install');
      return;
    }

    const event = pendingPrompt;
    pendingPrompt = null;
    setReady(false);
    try {
      await event.prompt();
      await event.userChoice;
    } catch {
      // Se a oferta falhar, a ajuda explica a instalação manual sem inventar uma API.
      setHint('install');
    }
  };

  return (
    <div className={`surveyor-pwa-control ${compact ? 'compact' : ''}`}>
      {(ready || present || iconOnly) && (
        <button
          type="button"
          className={iconOnly ? 'surveyor-pwa-icon' : 'surveyor-install-button'}
          title={present ? 'Remover o SURVEYOR instalado' : ready ? 'Instalar SURVEYOR' : 'Ver opções de instalação do SURVEYOR'}
          aria-label={present ? 'Remover o SURVEYOR instalado' : ready ? 'Instalar SURVEYOR' : 'Ver opções de instalação do SURVEYOR'}
          aria-haspopup="dialog"
          onClick={() => void action()}
        >
          {present ? <Trash2 size={19} aria-hidden="true" /> : <CloudDownload size={19} aria-hidden="true" />}
          {!iconOnly && <span>{present ? 'Aplicativo instalado' : 'Instalar aplicativo'}</span>}
        </button>
      )}
      {hint && (
        <div className="surveyor-pwa-hint" role="dialog" aria-label={hint === 'remove' ? 'Como remover o SURVEYOR' : 'Ajuda para instalar o SURVEYOR'}>
          <button type="button" className="surveyor-pwa-close" aria-label="Fechar instruções" onClick={() => setHint(null)}>
            <X size={15} />
          </button>
          <strong>{hint === 'remove' ? 'Como remover o SURVEYOR' : 'Instalar o SURVEYOR'}</strong>
          {hint === 'remove' ? (
            <p>Esta página não consegue desinstalar o aplicativo. Remova o SURVEYOR pelas configurações do sistema operacional ou pelo menu do navegador que o instalou. {removalInstructions()}</p>
          ) : (
            <p>A instalação direta não ficou disponível agora. Tente pelo menu do navegador, em “Instalar SURVEYOR” ou “Adicionar à tela inicial”. A instalação depende do suporte do navegador e de uma conexão segura (HTTPS; localhost durante o desenvolvimento).</p>
          )}
        </div>
      )}
    </div>
  );
}
