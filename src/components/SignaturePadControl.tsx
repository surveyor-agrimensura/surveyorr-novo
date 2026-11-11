import { useRef, useState } from 'react';
import { Eraser, PenLine } from 'lucide-react';

export function SignaturePadControl({
  onApply,
  label = 'Desenhar assinatura na tela'
}: {
  onApply: (dataUrl: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasStroke(false);
    }
  };

  const apply = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStroke) return;
    onApply(canvas.toDataURL('image/png'));
    setOpen(false);
  };

  return (
    <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
      <button
        type="button"
        className="doc-outline"
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, padding: '6px 10px' }}
        onClick={() => setOpen(v => !v)}
      >
        <PenLine size={14} /> {open ? 'Fechar quadro de assinatura' : label}
      </button>
      {open && (
        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8, padding: 8, display: 'grid', gap: 6 }}>
          <small style={{ fontSize: 11, color: '#64748b' }}>Assine com o mouse ou toque no quadro abaixo:</small>
          <canvas
            ref={canvasRef}
            width={320}
            height={110}
            style={{ width: '100%', height: 100, background: '#f8fafc', border: '1px dashed #94a3b8', borderRadius: 6, touchAction: 'none', cursor: 'crosshair' }}
            onPointerDown={e => {
              const canvas = canvasRef.current;
              const ctx = canvas?.getContext('2d');
              if (!canvas || !ctx) return;
              const rect = canvas.getBoundingClientRect();
              const sx = canvas.width / rect.width;
              const sy = canvas.height / rect.height;
              drawingRef.current = true;
              ctx.strokeStyle = '#0f172a';
              ctx.lineWidth = 2.2;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.beginPath();
              ctx.moveTo((e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy);
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={e => {
              if (!drawingRef.current) return;
              const canvas = canvasRef.current;
              const ctx = canvas?.getContext('2d');
              if (!canvas || !ctx) return;
              const rect = canvas.getBoundingClientRect();
              const sx = canvas.width / rect.width;
              const sy = canvas.height / rect.height;
              ctx.lineTo((e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy);
              ctx.stroke();
              setHasStroke(true);
            }}
            onPointerUp={() => {
              drawingRef.current = false;
            }}
            onPointerCancel={() => {
              drawingRef.current = false;
            }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="doc-outline" style={{ flex: 1, fontSize: 11, padding: '5px 8px' }} onClick={clear}>
              <Eraser size={13} /> Limpar
            </button>
            <button type="button" className="doc-primary" style={{ flex: 1, fontSize: 11, padding: '5px 8px' }} disabled={!hasStroke} onClick={apply}>
              Usar esta assinatura
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
