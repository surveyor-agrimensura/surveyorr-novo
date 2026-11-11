import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';

type DocumentWorkflowBarProps = {
  label: string;
  variant?: 'default' | 'croqui';
  centerContent?: ReactNode;
  steps?: string[];
  currentStep?: number;
  onStepChange?: (index: number) => void;
  actions?: ReactNode;
  startActions?: ReactNode;
};

export function DocumentWorkflowBar({ label, variant = 'default', centerContent, steps, currentStep, onStepChange, actions, startActions }: DocumentWorkflowBarProps) {
  const visibleSteps = steps ?? [];
  const activeStep = currentStep ?? 0;
  return (
    <header className={`doc-workflow-bar${variant === 'croqui' ? ' doc-workflow-bar--croqui' : ''}${visibleSteps.length ? ' has-steps' : ''}${actions ? ' has-actions' : ''}`} aria-label={`Ações: ${label}`}>
      <div className="doc-workflow-start">
        <Link className="doc-workflow-back" to="/" aria-label="Voltar à tela inicial" title="Voltar à tela inicial">
          <ArrowLeft size={19} />
        </Link>
        {variant !== 'croqui' && <strong className="doc-workflow-title">{label}</strong>}
        {startActions && <div className="doc-workflow-start-actions">{startActions}</div>}
      </div>
      {centerContent && <div className="doc-workflow-center">{centerContent}</div>}
      {visibleSteps.length > 0 && <ol className="doc-workflow-steps" aria-label={`Etapas de ${label}`}>
        {visibleSteps.map((step, index) => {
          const content = <><span className="doc-workflow-number">{index < activeStep ? <Check size={13} /> : index + 1}</span><span>{step}</span></>;
          return (
            <li key={step} className={index === activeStep ? 'is-current' : index < activeStep ? 'is-complete' : ''} aria-current={index === activeStep ? 'step' : undefined}>
              {onStepChange ? <button type="button" onClick={() => onStepChange(index)}>{content}</button> : content}
            </li>
          );
        })}
      </ol>}
      {actions && <div className="doc-workflow-actions">{actions}</div>}
    </header>
  );
}
