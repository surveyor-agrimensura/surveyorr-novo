import type {ProjectFeature} from '../projects/projectsApi';
/** Correspondência de um vértice com ponto importado, mantendo a tolerância histórica. */
export function findPointFeatureAtVertex(features:readonly ProjectFeature[],vertex:readonly [number,number]):ProjectFeature|undefined{
 return features.find(f=>{
  const geom=f.geoJson||f.geometry;
  if(geom?.type!=='Point'||!Array.isArray(geom.coordinates))return false;
  const position=geom.coordinates as number[];
  return Math.abs(Number(position[0])-vertex[0])<0.000001&&Math.abs(Number(position[1])-vertex[1])<0.000001;
 });
}
