/** Reproject document-space annotations whenever the geographic map zoom changes.
 * The actual GeoJSON and WGS84 overlay points remain unchanged. Coordinates inside
 * the SVG are affine because both layouts use the same WebMercator projection.
 */
import type {SurveyPolygon} from '../memorial/memorialEngine';
import {frameCoordinates,layoutForCroqui,legacyLayoutForCroqui,type CroquiSettings} from '../memorial/croquiRenderer';
import type {ProjectDivision} from './projectDivisions';

type Point={x:number;y:number};
function betweenLayouts(current:CroquiSettings,before:ReturnType<typeof layoutForCroqui>,after:ReturnType<typeof layoutForCroqui>):CroquiSettings{
 const oldPoint=frameCoordinates(before)[0],newPoint=frameCoordinates(after)[0];
 if(!oldPoint||!newPoint)return current;
 const factor=2**(after.zoom-before.zoom);
 const position=(p:Point):Point=>({x:newPoint.x+(p.x-oldPoint.x)*factor,y:newPoint.y+(p.y-oldPoint.y)*factor});
 const offset=(p:{dx:number;dy:number})=>({dx:p.dx*factor,dy:p.dy*factor});
 const positions=(items:Record<string,Point>|undefined)=>Object.fromEntries(Object.entries(items||{}).map(([key,p])=>[key,position(p)]));
 const offsets=(items:Record<string,{dx:number;dy:number}>)=>Object.fromEntries(Object.entries(items).map(([key,p])=>[key,offset(p)]));
 return {...current,
  absoluteLabels:positions(current.absoluteLabels),
  confrontantPins:positions(current.confrontantPins),
  labelOffsets:offsets(current.labelOffsets),
  vertexOffsets:current.vertexOffsets.map(offset),
  lines:current.lines.map(line=>({...line,start:line.start?position(line.start):undefined,...position({x:line.x,y:line.y})})),
  easements:current.easements.map(road=>({...road,points:road.points.map(position),
   // Legacy drawings without geodetic anchors must scale together with the map.
   width:road.geoPoints?road.width:Math.max(1,road.width*factor),
   sourceEdges:road.sourceEdges?{left:road.sourceEdges.left.map(position),right:road.sourceEdges.right.map(position)}:undefined
  }))
 };
}

export function zoomCroquiOverlays(poly:SurveyPolygon,current:CroquiSettings,nextZoom:number,divisions:readonly ProjectDivision[]=[]):CroquiSettings{
 if(!Number.isFinite(nextZoom)||nextZoom===current.zoom)return current;
 const transformed=betweenLayouts(current,layoutForCroqui(poly,current,divisions),layoutForCroqui(poly,{...current,zoom:nextZoom},divisions));
 return {...transformed,zoom:nextZoom};
}
/** Converte o desenho feito antes do ajuste contínuo para a mesma posição
 * geográfica no novo enquadramento. Nunca movimenta vértices/GeoJSON. */
export function migrateCroquiFrame(poly:SurveyPolygon,settings:CroquiSettings,divisions:readonly ProjectDivision[]=[]):CroquiSettings{
 if(settings.frameVersion===2)return settings;
 const before=legacyLayoutForCroqui(poly,settings,divisions);
 const after=layoutForCroqui(poly,settings,divisions);
 return {...betweenLayouts(settings,before,after),frameVersion:2};
}
