import { useEffect, useRef } from 'react';
import { Layer, Stage, Text, Transformer } from 'react-konva';
import type Konva from 'konva';
import { svgTextOutline } from '../../lib/svgTextContrast';

type Props = {
 label: string;
 color: string;
 size: number;
 angle: number;
 onTransform: (size: number, angle: number) => void;
};
const limit = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const normAngle = (degrees: number) => ((Math.round(degrees) + 180) % 360 + 360) % 360 - 180;

/** Editor 2D complementar. O SVG técnico continua como fonte para impressão.
 * Os handles do Konva atualizam os MESMOS atributos usados no SVG. */
export default function KonvaLabelEditor({ label, color, size, angle, onTransform }: Props) {
 const text = useRef<Konva.Text>(null);
 const transform = useRef<Konva.Transformer>(null);
 useEffect(() => {
  if (!text.current || !transform.current) return;
  transform.current.nodes([text.current]);
  transform.current.getLayer()?.batchDraw();
 }, [label, size, angle]);
 const commitTransform = () => {
  const node = text.current;
  if (!node) return;
  const nextSize = limit(Math.round(size * Math.abs(node.scaleX())), 40, 250);
  const nextAngle = normAngle(node.rotation());
  node.scale({ x: 1, y: 1 });
  onTransform(nextSize, nextAngle);
 };
 const sample = (label.trim() || 'Rótulo selecionado').slice(0, 45);
 return <div className="cq-konva-label-editor" aria-label="Editor 2D Konva para dimensionar e girar o rótulo">
  <Stage width={255} height={140}>
   <Layer>
    <Text x={127} y={70} offsetX={90} offsetY={13} width={180} align="center"
     text={sample} fontFamily="Arial" fontStyle="bold" fontSize={limit(14 * size / 100, 8, 34)}
     rotation={angle} fill={color} stroke={svgTextOutline(color)} strokeWidth={2.6}
     fillAfterStrokeEnabled={true} ref={text} listening={true} onTransformEnd={commitTransform} />
    <Transformer ref={transform} rotateEnabled={true} keepRatio={true} flipEnabled={false}
     enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
     boundBoxFunc={(previous, next) => Math.abs(next.width) >= 28 && Math.abs(next.width) <= 400 ? next : previous}
     borderStroke="#2563eb" anchorStroke="#2563eb" anchorFill="#fff" anchorSize={7}/>
   </Layer>
  </Stage>
  <small>Arraste os cantos para redimensionar ou a alça para girar. A alteração é aplicada ao croqui SVG.</small>
 </div>;
}
