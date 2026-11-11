/** Mapas de detalhe compartilham coordenadas geográficas (WGS84).
 * Conversão sem arredondamento para não deslocar servidões entre editores. */
export type OverlayPoint={x:number;y:number};
export type OverlayGeoPoint=[number,number];
export type OverlayFrame={x:number;y:number;w:number;h:number};
export function framePointToGeo(point:OverlayPoint,frame:OverlayFrame,zoom:number,center:OverlayGeoPoint):OverlayGeoPoint{
 const world=256*2**zoom;
 const latitude=Math.max(-85,Math.min(85,center[1]))*Math.PI/180;
 const centerX=(center[0]+180)/360*world;
 const centerY=(1-Math.asinh(Math.tan(latitude))/Math.PI)/2*world;
 const x=centerX+point.x-(frame.x+frame.w/2);
 const y=centerY+point.y-(frame.y+frame.h/2);
 const longitude=x/world*360-180;
 const geoLatitude=Math.atan(Math.sinh(Math.PI*(1-2*y/world)))*180/Math.PI;
 return [longitude,geoLatitude];
}
export function validGeoPoints(points:unknown):points is OverlayGeoPoint[]{
 return Array.isArray(points)&&points.length>=2&&points.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=85);
}
