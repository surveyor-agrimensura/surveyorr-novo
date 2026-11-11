/** Lê somente geometrias REAIS provenientes de fontes GeoJSON antigas e atuais. */
export type RawPolygonGeometry={type:'Polygon'|'MultiPolygon';coordinates:unknown};
export function projectPolygonGeometries(value:unknown):RawPolygonGeometry[]{
 if(typeof value==='string'){
  try{return projectPolygonGeometries(JSON.parse(value) as unknown);}catch{return [];}
 }
 if(!value||typeof value!=='object'||Array.isArray(value))return [];
 const node=value as Record<string,unknown>;
 if(node.type==='Polygon'||node.type==='MultiPolygon')return [{type:node.type,coordinates:node.coordinates} as RawPolygonGeometry];
 if(node.type==='Feature')return projectPolygonGeometries(node.geometry);
 if(node.type==='FeatureCollection'&&Array.isArray(node.features))return node.features.flatMap(projectPolygonGeometries);
 if(node.type==='GeometryCollection'&&Array.isArray(node.geometries))return node.geometries.flatMap(projectPolygonGeometries);
 return [];
}
