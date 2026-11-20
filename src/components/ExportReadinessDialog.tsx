import {AlertTriangle, CheckCircle2, X} from 'lucide-react';
import './exportReadinessDialog.css';

export type ExportReadinessIssue={
 id:string;
 severity:'error'|'warning';
 title:string;
 description:string;
 actionLabel?:string;
 action?:()=>void;
};

export function ExportReadinessDialog({title='Conferência antes de exportar',subtitle='Revise os pontos encontrados antes de gerar o arquivo.',issues,onClose,onContinue,continueLabel='Continuar exportação'}:{
 title?:string;
 subtitle?:string;
 issues:ExportReadinessIssue[];
 onClose:()=>void;
 onContinue:()=>void;
 continueLabel?:string;
}){
 const errors=issues.filter(issue=>issue.severity==='error').length;
 const warnings=issues.length-errors;
 return <div className="export-readiness-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
  <section className="export-readiness-dialog" role="dialog" aria-modal="true" aria-label={title}>
   <header><div><strong>{title}</strong><small>{subtitle}</small></div><button type="button" aria-label="Fechar conferência" onClick={onClose}><X size={18}/></button></header>
   <div className={`export-readiness-summary${errors?' has-errors':''}`}>
    <div>{errors?<AlertTriangle size={20}/>:issues.length?<AlertTriangle size={20}/>:<CheckCircle2 size={20}/>}<span>{errors?'Há itens que precisam de revisão':issues.length?'A conferência encontrou recomendações':'Nenhuma pendência automática encontrada'}<small>{errors} pendência(s) crítica(s) · {warnings} aviso(s) de dados</small></span></div>
    <b>{issues.length}</b>
   </div>
   <div className="export-readiness-list" aria-live="polite">
    {issues.length?issues.map(issue=><article key={issue.id} className={`export-readiness-item ${issue.severity}`}>
     <span className="export-readiness-mark" aria-hidden="true">{issue.severity==='error'?'!':'i'}</span>
     <div><strong>{issue.title}</strong><p>{issue.description}</p></div>
     {issue.action&&<button type="button" className="export-readiness-fix" onClick={()=>{onClose();issue.action?.();}}>{issue.actionLabel||'Corrigir'}</button>}
    </article>):<p className="export-readiness-clean">As verificações automáticas passaram. Confira os dados e requisitos do destino antes de usar o arquivo.</p>}
   </div>
   <footer><button type="button" className="export-readiness-back" onClick={onClose}>Voltar</button><button type="button" className="export-readiness-continue" onClick={onContinue}>{errors?'Exportar mesmo assim':continueLabel}</button></footer>
  </section>
 </div>;
}
