/** Leitura de anéis GeoJSON WGS84 compartilhada entre Croqui e Memorial.
 * Não converte CRS nem arredonda coordenadas. */
export type LonLat = [number,number];

/** Mantém a mesma tolerância de entrada do projeto (aceita números em texto). */
export const isValidLonLat = (point:unknown):point is LonLat =>
 Array.isArray(point)&&point.length>=2&&Number.isFinite(Number(point[0]))&&Number.isFinite(Number(point[1]))&&
 Math.abs(Number(point[0]))<=180&&Math.abs(Number(point[1]))<=90;

/** Converte para números e remove só o último ponto quando fecha explicitamente o anel. */
export function readOpenLonLatRing(raw:unknown):LonLat[]{
 if(!Array.isArray(raw))return [];
 const vertices=raw.filter(isValidLonLat).map(point=>[Number(point[0]),Number(point[1])] as LonLat);
 if(vertices.length>3&&vertices[0][0]===vertices[vertices.length-1][0]&&vertices[0][1]===vertices[vertices.length-1][1])vertices.pop();
 return vertices.length>=3?vertices:[];
}
