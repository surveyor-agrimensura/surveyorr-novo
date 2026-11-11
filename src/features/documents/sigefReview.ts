/** Preparação para conferência PRÉ-SIGEF. NÃO gera template homologado para envio. */
import type {SurveyPolygon} from '../memorial/memorialEngine';
import type {OdsSheet} from './odsWriter';
import {utmFromWgs84} from './utmGrid';
import {croquiVertexNames,normalizeCroquiSettings} from '../memorial/croquiRenderer';
import {cloudCroquiDraft} from '../croqui/sharedCroquiSettings';
export function reviewSigef(polys:SurveyPolygon[],options:Record<string,unknown>,projectId:string):{sheets:OdsSheet[];alerts:string[]}{
 const alerts:string[]=[];
 const rows:OdsSheet['rows']=[['IMÓVEL','VÉRTICE','TIPO M/P/V (CONFERIR)','LONGITUDE DD (WGS84)','LATITUDE DD (WGS84)','FUSO UTM','E (m) WGS84','N (m) WGS84','HEMISFÉRIO','MÉTODO POSICIONAMENTO (PREENCHER)','PRECISÃO HORIZONTAL (m) (PREENCHER)','PRECISÃO VERTICAL (m) (PREENCHER)','ALTITUDE / SISTEMA VERTICAL (PREENCHER)','OBSERVAÇÕES']];
 if(!polys.length)alerts.push('Nenhum perímetro disponível para pré-conferência.');
 for(const polygon of polys){
  const shared=cloudCroquiDraft(options,projectId,polygon.id);
  const names=croquiVertexNames(polygon,normalizeCroquiSettings(shared));
  if(!Object.keys(shared).length)alerts.push(`${polygon.name}: sem personalização do croqui salva na nuvem; confira a numeração dos vértices.`);
  const seen=new Set<string>();
  polygon.vertices.forEach(([lon,lat],i)=>{
   const name=names[i]||`V-${i+1}`;
   if(seen.has(name))alerts.push(`${polygon.name}: código de vértice duplicado (${name}).`);seen.add(name);
   let e=NaN,n=NaN,zone='',hemisphere='';
   try{const p=utmFromWgs84([lon,lat]);e=p.east;n=p.north;zone=String(p.zone);hemisphere=p.hemisphere;}catch{alerts.push(`${polygon.name}: vértice ${name} fora da cobertura UTM.`);}
   const type=/-(M|P|V)-/i.exec(name)?.[1]?.toUpperCase()||'';
   if(!type)alerts.push(`${polygon.name}: classifique tecnicamente o vértice ${name} antes de preparar documentação.`);
   rows.push([polygon.name,name,type,lon,lat,zone,Number.isFinite(e)?Number(e.toFixed(3)):null,Number.isFinite(n)?Number(n.toFixed(3)):null,hemisphere,'',null,null,'','Validar datum, métodos, precisões e documentos originais']);
  });
 }
 const instruction:OdsSheet={name:'LEIA-ME',rows:[
  ['SURVEYOR — CONFERÊNCIA PRÉ-SIGEF','Não é planilha oficial de submissão nem documento certificado.'],
  ['Origem','Geometrias em coordenadas geográficas WGS84 do projeto (não se deve presumir SIRGAS2000).'],
  ['Projeção','Colunas UTM calculadas em WGS84 apenas para facilitar conferência.'],
  ['Faltam dados','Métodos e incertezas posicionais, altitude e demais dados exigidos no modelo oficial vigente.'],
  ['ATENÇÃO','Transfira e valide os dados no modelo oficial disponibilizado pelo SIGEF/INCRA.'],
  ['LIMITAÇÃO','O SURVEYOR não confirma adequação normativa nem aprovação de certificação.'],
  ...alerts.map((alert,i)=>[`Alerta ${i+1}`,alert])
 ]};
 return {sheets:[instruction,{name:'Pré-conferência',rows}],alerts};
}
