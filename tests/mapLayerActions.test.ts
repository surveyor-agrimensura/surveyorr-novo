import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('ações das camadas oficiais do mapa', () => {
  const panel = readSource('src/features/map/MapWorkPanels.tsx');
  const page = readSource('src/features/map/OperationalMap.tsx');
  const featureDetails = readSource('src/features/map/FeatureDetailsPanel.tsx');
  const css = readSource('src/features/map/map.css');

  it('abre informações reais da camada e identifica o serviço WMS', () => {
    const actions = panel.match(/<div className="map-layer-actions">([\s\S]*?)<\/div>/)?.[1] ?? '';

    expect(actions).toContain('Informações');
    expect(actions).toContain('setDetailsLayer(layer)');
    expect(panel).toContain('<OfficialLayerDetailsDialog layer={detailsLayer}');
    expect(panel).toContain('role="dialog" aria-modal="true"');
    expect(panel).toContain('Identificador da camada');
    expect(panel).toContain('Endereço do serviço');
    expect(panel).toContain('Abrir serviço WMS');
  });

  it('mostra as camadas recomendadas e remove o atalho do índice municipal do painel', () => {
    expect(panel).toContain('Camadas recomendadas');
    expect(panel).toContain('recommendedLayersForUF(recommendationUF||project.uf)');
    expect(panel).toContain('onToggleRecommendedLayer(layer)');
    expect(panel).not.toContain('Guardar índice no navegador · Bahia');
    expect(panel).not.toContain('LayerIndexDownload');
    expect(css).toContain('.map-recommended-layer');
  });

  it('remove a camada recomendada da lista ativa ao desmarcar o checkbox', () => {
    expect(page).toContain('if(existing?.visible)return current.filter(item=>item.id!==layer.id)');
    expect(page).toContain("return existing?current.map(item=>item.id===layer.id?{...item,visible:true}:item):[...current,{...layer,visible:true,opacity:100,state:'carregando'}]");
  });

  it('permite atualizar apenas camada visível que não esteja carregando e reinicia seu estado', () => {
    const actions = panel.match(/<div className="map-layer-actions">([\s\S]*?)<\/div>/)?.[1] ?? '';

    expect(actions).toContain('Atualizar agora');
    expect(actions).toContain("disabled={!layer.visible||layer.state==='carregando'}");
    expect(page).toMatch(/const refreshOfficialLayer=\(id:string\)=>\{[\s\S]*?setOfficialLayers\(current=>current\.map\(layer=>layer\.id===id\?\{\.\.\.layer,state:'carregando'\}:layer\)\);tile\.redraw\(\)/);
    expect(page).toContain('onRefreshLayer={refreshOfficialLayer}');
  });

  it('mantém a ficha de informações confortável em tela estreita', () => {
    expect(css).toContain('.map-layer-details-dialog .map-dialog-head>div{min-width:0;overflow-wrap:anywhere}');
    expect(css).toContain('.map-layer-details-backdrop .map-dialog-head button{width:44px;height:44px;min-width:44px}');
    expect(css).toContain('.map-layer-details-content dl{grid-template-columns:1fr}');
    expect(css).toContain('.map-layer-details-actions>a,.map-layer-details-actions>button{min-height:44px;flex:1}');
    expect(css).toContain('.map-layer-actions button{flex:1 1 calc(50% - 4px);min-width:0;white-space:normal;overflow-wrap:anywhere;line-height:1.25;text-align:center}');
  });

  it('abre o seletor de destino ao exportar Shapefile pela ficha da feição', () => {
    expect(featureDetails).toContain("setShapeDialog(true)");
    expect(featureDetails).toContain('SEIA / CEFIR — Bahia');
    expect(featureDetails).toContain('toShapefileZip([feature], shapeProfile)');
    expect(featureDetails).not.toContain('toShapefileZip([feature]));');
  });

  it('usa o perfil de destino escolhido também no ZIP da feição pelo clique direito', () => {
    expect(page).toContain("toShapefileZip([selected],shapeProfile)");
    expect(page).toContain("useState<ShapeTarget>(()=>place?.uf?.toUpperCase()==='BA'?'seia-cefir-ba':'qgis-arcgis')");
  });

  it('oferece edição direta de vértices para polígonos desbloqueados selecionados no mapa', () => {
    expect(featureDetails).not.toContain('map-feature-edit-vertices');
    expect(page).toContain('Editar vértices</button>');
    expect(page).toContain('beginVertexEditing(contextAt.id)');
    expect(page).toContain('beginVertexEditing(String(mapContextEditFeature.id))');
    expect(page).toContain('setEditingFeature(id);setDetailsFeatureId(null);setContextAt(null);setMapContext(null);setPanel(null);');
  });

  it('expande o atalho ativo de Projetos mesmo sem hover', () => {
    const layout = readSource('src/components/layout/WorkspaceLayout.tsx');
    expect(layout).toContain("const normalizedPath = location.pathname.replace(/\\/+$/, '') || '/';");
    expect(layout).toContain("const activeRouteShortcut = menus.find(menu => menu.href?.replace(/\\/+$/, '') === normalizedPath)?.key ?? null;");
    expect(layout).toContain("const activeShortcut = expandedShortcut ?? (toolsOpen ? 'tools' : activeRouteShortcut);");
  });
});
