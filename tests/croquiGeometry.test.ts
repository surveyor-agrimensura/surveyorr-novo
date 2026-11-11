import {describe,it,expect} from 'vitest';
import {groupConfrontations,readConfrontation,neighborText,roadBoundaries,polylineMidpoint} from '../src/features/croqui/croquiGeometry';
describe('Agrupamento de confrontantes',()=>{
 it('exibe um só nome para dez segmentos do mesmo proprietário',()=>{expect(groupConfrontations(Array(10).fill('Josefina'))).toHaveLength(1);});
 it('agrupa corretamente segmentos que cruzam o fechamento',()=>{const g=groupConfrontations(['Maria','Ana','Ana','Maria']);expect(g).toHaveLength(2);expect(g.find(v=>v.label==='Maria')?.indices).toEqual([3,0]);});
 it('não expõe [object Object] nos campos',()=>{expect(neighborText({property:'Sítio Esperança'})).toBe('Sítio Esperança');});
 it('lê cadastro por chave do editor de mapa e por intervalo',()=>{expect(readConfrontation({confrontants:{'0-1':'Josefina'}},0,4)).toBe('Josefina');expect(readConfrontation({confrontants:{'0-9':{property:'Fazenda'} }},7,12)).toBe('Fazenda');});
 it('localiza o centro da confrontação pelo comprimento, não pelos vértices',()=>{const p=[{x:0,y:0},{x:100,y:0},{x:110,y:0}];expect(polylineMidpoint(p,[0,1])?.point.x).toBeCloseTo(55);});
});
describe('Faixa de servidão',()=>{
 it('gera duas bordas distintas ao longo de uma curva',()=>{const edges=roadBoundaries([{x:0,y:0},{x:20,y:10},{x:40,y:0}],18);expect(edges.left).toHaveLength(3);expect(edges.right).toHaveLength(3);expect(edges.left[1].y).not.toBe(edges.right[1].y);});
 it('altera a separação das bordas pela largura',()=>{const p=[{x:0,y:0},{x:30,y:0}];const a=roadBoundaries(p,8),b=roadBoundaries(p,28);expect(Math.abs(b.left[0].y-b.right[0].y)).toBeGreaterThan(Math.abs(a.left[0].y-a.right[0].y));});
});
