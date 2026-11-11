/** Máscara de carregamento compartilhada pelas telas de produção técnica. */
export function GlobalLoading({active}:{active:boolean}){
 if(!active)return null;
 return <div className="surveyor-global-loading" role="status" aria-label="Carregando conteúdo" aria-live="polite"><span className="surveyor-global-loading-spinner" aria-hidden="true"/></div>;
}
