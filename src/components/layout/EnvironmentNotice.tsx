import { REMOTE_LOCAL_OPT_IN, SURVEYOR_ENV } from '../../lib/config';

export const ENVIRONMENT_NOTICE_VISIBLE = SURVEYOR_ENV === 'staging' || REMOTE_LOCAL_OPT_IN;

export function EnvironmentNotice() {
  if (!ENVIRONMENT_NOTICE_VISIBLE) return null;

  const remoteWarning = REMOTE_LOCAL_OPT_IN;
  const message = remoteWarning
    ? 'AMBIENTE LOCAL: conectado a serviços oficiais remotos. Requisições podem acessar dados fora deste computador.'
    : 'AMBIENTE DE STAGING: conectado aos serviços de homologação.';
  const compactMessage = remoteWarning
    ? 'AMBIENTE LOCAL · SERVIÇOS OFICIAIS REMOTOS'
    : 'AMBIENTE DE STAGING · HOMOLOGAÇÃO';

  return <aside
    role="status"
    aria-live="polite"
    aria-label={message}
    title={message}
    style={{
      boxSizing: 'border-box',
      minHeight: 22,
      padding: '2px 10px',
      background: remoteWarning ? '#fff1d6' : '#e8f1ff',
      color: '#493300',
      borderBottom: '1px solid #d8c18f',
      fontSize: 11,
      fontWeight: 600,
      lineHeight: '17px',
      textAlign: 'center',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }}
  >
    {compactMessage}
  </aside>;
}
