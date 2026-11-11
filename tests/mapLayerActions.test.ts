import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('ações das camadas oficiais do mapa', () => {
  const panel = readSource('src/features/map/MapWorkPanels.tsx');
  const page = readSource('src/features/map/OperationalMap.tsx');
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

  it('oferece o índice municipal uma vez no painel geral e limita a ação à Bahia', () => {
    const actions = panel.match(/<div className="map-layer-actions">([\s\S]*?)<\/div>/)?.[1] ?? '';

    expect(actions).not.toContain('Índice municipal');
    expect(panel).toContain('Guardar índice no navegador · Bahia');
    expect(panel).toContain("disabled={project.uf.toUpperCase()!=='BA'}");
    expect(panel).toContain('onClick={()=>setMunicipalIndexOpen(true)}');
    expect(panel).toContain('<LayerIndexDownload uf={project.uf}');
    expect(css).toContain('.map-layer-global-actions button{width:100%}');
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
});
