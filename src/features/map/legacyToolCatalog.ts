// Lista auditada no SURVEYOR RC185.72: assets/js/features/mapa/ux.js, quickToolDefinitions().
export const legacyMapTools = [
 {id:'pan',label:'Selecionar',icon:'pointer'},
 {id:'polygon',label:'Desenhar polígono',icon:'pentagon'},
 {id:'line',label:'Desenhar linha',icon:'route'},
 {id:'rectangle',label:'Retângulo',icon:'square'},
 {id:'circle',label:'Círculo',icon:'circle'},
 {id:'arc',label:'Arco',icon:'arc'},
 {id:'point',label:'Ponto desenhado',icon:'pin'},
 {id:'edit',label:'Editar vértices',icon:'edit'},
 {id:'auto-points',label:'Pontos automáticos',icon:'points'},
 {id:'snap',label:'Snap em vértices/segmentos',icon:'coordinate'},
 {id:'hide-vertex',label:'Remover vértice',icon:'minus'},
 {id:'delete',label:'Excluir desenho',icon:'trash'},
 {id:'refresh',label:'Atualizar mapa',icon:'refresh'},
 {id:'measure',label:'Medir',icon:'ruler'},
 {id:'mark',label:'Marcar ponto GPS',icon:'pin'},
 {id:'coordinates',label:'Coordenadas',icon:'coordinate'},
 {id:'cotas',label:'Cotas',icon:'measure'},
 {id:'frontback',label:'Frente / fundo',icon:'split'},
 {id:'terrain',label:'Terreno',icon:'terrain'},
 {id:'profile',label:'Perfil do terreno',icon:'profile'},
 {id:'cutfill',label:'Corte / aterro',icon:'cutfill'},
 {id:'contours',label:'Curvas de nível',icon:'contours'},
 {id:'spot',label:'Pontos cotados',icon:'spot'},
 {id:'earth3d',label:'Earth 3D',icon:'earth'},
 {id:'cancel',label:'Cancelar ferramenta',icon:'x'}
] as const;
export type LegacyToolId = typeof legacyMapTools[number]['id'];

export type LegacyToolSelectionState = {
 tool:string;
 activeLegacy:string;
 autoPoints:boolean;
 snap:boolean;
 vertexRemoval:boolean;
 showMeasures:boolean;
 basemap:string;
};

export function isLegacyToolSelected(id:LegacyToolId,state:LegacyToolSelectionState):boolean{
 switch(id){
  case 'auto-points':return state.autoPoints;
  case 'snap':return state.snap;
  case 'hide-vertex':return state.vertexRemoval;
  case 'cotas':return state.showMeasures;
  case 'terrain':return state.basemap==='topo';
  default:return state.tool===id||state.activeLegacy===id;
 }
}

export type MoreToolsSelectionState = {
 paletteOpen:boolean;
 vertexRemoval:boolean;
 autoPoints:boolean;
 snap:boolean;
 activeLegacy:string;
 tool:string;
};

export function isMoreToolsSelected(state:MoreToolsSelectionState):boolean{
 return state.paletteOpen||state.vertexRemoval||state.autoPoints||state.snap||
  (state.activeLegacy!=='pan'&&state.tool!=='point'&&state.tool!=='polygon'&&state.activeLegacy!=='point'&&state.activeLegacy!=='polygon');
}
