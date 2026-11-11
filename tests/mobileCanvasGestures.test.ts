import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('gestos dos editores em telas de toque', () => {
  it('mantém o mapa navegável e restringe o gesto às alças de arraste', () => {
    const css = readSource('src/features/map/map.css');
    const page = readSource('src/features/map/OperationalMap.tsx');

    expect(css).toMatch(/\.map-point-draggable\s*\{[^}]*touch-action:\s*auto/);
    expect(css).toMatch(/\.map-point-draggable\s+\.map-drag-handle\s*\{[^}]*touch-action:\s*none/);
    expect(css).toMatch(/\.map-grab-edge\s*\{[^}]*touch-action:\s*none/);
    expect(css).toMatch(/@media\(max-width:700px\)\{\.map-tools-group\{height:44px\}\.map-tool\{min-height:44px;min-width:44px;font-size:9px\}/);
    expect(css).toMatch(/\.map-work-sidebar button,\.map-work-sidebar summary,\.map-feature-details button,\.map-point-dialog button,\.map-modal-backdrop button,\.map-index-modal-backdrop button,\.map-municipality-download button\{min-height:44px\}/);
    expect(css).toMatch(/\.map-operational-search\{height:44px\}\.map-operational-search button\{width:44px;height:44px;flex:none\}/);
    expect(css).toMatch(/\.map-feature-context button,\.map-basemap-popover button,\.map-export-popover button,\.map-flyout-head button,\.map-flyout-body>button,\.map-point-batch-menu>button,\.map-legacy-tool\{min-height:44px/);
    expect(css).toMatch(/\.map-work-sidebar\{top:114px\}\.map-tools-palette\{top:116px\}/);
    expect(page).toMatch(/if\(e\.key!=='Escape'\)return;/);
    expect(page).toMatch(/if\(mapContext\|\|contextAt\)\{setMapContext\(null\);setContextAt\(null\);return;\}/);
    expect(page).toMatch(/if\(terrainModal\)\{setTerrainModal\(null\);return;\}/);
    expect(page).toMatch(/if\(modal\)\{setModal\(null\);return;\}/);
  });

  it('remove a faixa de desenho e mantém controles contextuais acessíveis', () => {
    const css = readSource('src/features/map/map.css');
    const page = readSource('src/features/map/OperationalMap.tsx');

    expect(page).toContain("const mapToolLabels:Record<Tool,string>={pan:'Mapa',point:'Pontos',line:'Linha',polygon:'Polígono',rectangle:'Retângulo',circle:'Círculo',arc:'Arco',measure:'Medição'}");
    expect(page).not.toContain('className="map-drawing-bar"');
    expect(page).toContain('Ações da ferramenta ${mapToolLabels[tool]}');
    expect(page).toContain('Finalizar desenho');
    expect(page).toContain('Cancelar ferramenta atual');
    expect(page).toContain("aria-label={draft.length?'Desfazer último vértice':'Desfazer última alteração'}");
    expect(page).toContain('disabled={!draft.length&&!historyCount.undo} onClick={undo}');
    expect(css).toMatch(/\.map-measure-readout\{position:absolute;bottom:110px/);
    expect(css).toMatch(/@media\(max-width:700px\)\{\.map-measure-readout span\{display:none\}\}/);
  });

  it('abre as opções dos vértices por toque e permite arrastá-los no mapa móvel', () => {
    const css = readSource('src/features/map/map.css');
    const page = readSource('src/features/map/OperationalMap.tsx');

    expect(css).toMatch(/\.surveyor-edit-handle\{[^}]*touch-action:none/);
    expect(css).toMatch(/\.surveyor-edit-midpoint\{display:grid;place-items:center;touch-action:none/);
    expect(page).toMatch(/const showVertexAppearance=/);
    expect(page).toMatch(/const coarsePointer=typeof window!=='undefined'&&\(\(typeof window\.matchMedia==='function'&&window\.matchMedia\('\(any-pointer: coarse\)'\)\.matches\)\|\|\(typeof navigator!=='undefined'&&navigator\.maxTouchPoints>0\)\)/);
    expect(page).toMatch(/const vertexHitSize=coarsePointer\?44:28/);
    expect(page).toMatch(/const midpointHitSize=coarsePointer\?44:16/);
    expect(page).toMatch(/iconSize:\[vertexHitSize,vertexHitSize\],iconAnchor:\[vertexHitSize\/2,vertexHitSize\/2\]/);
    expect(page).toMatch(/iconSize:\[midpointHitSize,midpointHitSize\],iconAnchor:\[midpointHitSize\/2,midpointHitSize\/2\]/);
    expect(page).toMatch(/circle\.on\('click',\(event:L\.LeafletMouseEvent\)=>showVertexAppearance\(selectedFeature,i,event\)\)/);
    expect(page).toMatch(/if\(!vertexRemovalMode\)marker\.on\('click',\(event:L\.LeafletMouseEvent\)=>showVertexAppearance\(editingFeature,index,event\)\)/);
  });

  it('permite rolar o croqui fora do desenho e mantém alças editáveis', () => {
    const css = readSource('src/features/croqui/croqui.css');

    expect(css).toMatch(/\.cq-paper\s*\{[^}]*touch-action:\s*pan-x\s+pan-y/);
    expect(css).toMatch(/\.cq-paper\.cq-interaction-mode\s*\{[^}]*touch-action:\s*none/);
    expect(css).toMatch(/\.cq-svg\s+\[data-croqui-handle\][^}]*touch-action:\s*none/);
    expect(css).toMatch(/\.cq-svg\s+\[data-croqui-label\][^}]*touch-action:\s*none/);
    expect(css).toMatch(/\.cq-svg\s+\[data-croqui-road-handle\][^}]*touch-action:\s*none/);
    expect(css).toMatch(/\.cq-svg\s+\[data-croqui-road-body\][^}]*touch-action:\s*none/);
    expect(css).toMatch(/\.cq-subtabs button,\.cq-bottom button\{min-height:44px\}/);
    expect(css).toMatch(/\.cq-accordion>summary\{min-height:44px/);
    expect(css).toMatch(/\.cq-more\{min-width:44px;min-height:44px\}/);
    expect(css).toMatch(/\.cq-field>input:not\(\[type=range\]\):not\(\[type=file\]\),\.cq-field>select,\.cq-neighbor-row input,\.cq-neighbor-row details summary\{min-height:44px/);
    expect(css).toMatch(/\.cq-toolrow button,\.cq-actions button,\.cq-zoom button,\.cq-export>\.cq-outline,\.cq-menu button,\.cq-message button,\.cq-context-head button,\.cq-segment-tools button,\.cq-numbering-actions button,\.cq-road-actions>button,\.cq-signature-upload-button\{min-height:44px/);
    expect(css).toMatch(/@media screen and \(max-width:650px\)\{\s*\.cq-side\{[^}]*max-height:min\(38dvh,330px\)\}\s*\.cq-workspace\{flex:1 1 0;min-height:0\}\s*\.cq-viewer\{flex:1 1 0;min-height:0\}\s*\.cq-bottom\{flex:0 0 auto\}/);
    expect(readSource('src/features/croqui/CroquiPage.tsx')).toMatch(/event\.button!==0\|\|!event\.isPrimary/);
  });

  it('abre a edição de rótulo do Croqui com toque sem transformar o toque em arraste', () => {
    const page = readSource('src/features/croqui/CroquiPage.tsx');

    expect(page).toContain('gesture.current={kind:\'label\',key,begin:pos,offset:settings.labelOffsets[key]||{dx:0,dy:0},startClientX:event.clientX,startClientY:event.clientY,moved:false};');
    expect(page).toMatch(/if\(!g\.moved&&Math\.hypot\(event\.clientX-g\.startClientX,event\.clientY-g\.startClientY\)<8\)return/);
    expect(page).toMatch(/if\(g\.kind==='label'&&pos&&!g\.moved&&Math\.hypot\(event\.clientX-g\.startClientX,event\.clientY-g\.startClientY\)<8\)\{[\s\S]*setCroquiContext\(\{kind:'label',key:g\.key/);
    expect(page).toContain('g.moved=true;');
    expect(page).toContain('Toque em um rótulo para personalizar; arraste para reposicionar.');
    expect(readSource('src/features/croqui/croqui.css')).toContain('.cq-mobile-edit-hint{position:sticky;top:0');
  });

  it('permite navegar pela prancha sem interromper a edição de linhas e servidões', () => {
    const css = readSource('src/features/documents/documents.css');
    const page = readSource('src/features/documents/TechnicalSheetsPage.tsx');

    expect(css).toMatch(/\.doc-svg-paper\s*\{[^}]*touch-action:\s*pan-x\s+pan-y/);
    expect(css).toMatch(/\.doc-svg-paper\.doc-interaction-mode\s*\{[^}]*touch-action:\s*none/);
    expect(css).toMatch(/\[data-sheet-line-handle\][^}]*touch-action:\s*none/);
    expect(css).toMatch(/\[data-sheet-road-handle\][^}]*touch-action:\s*none/);
    expect(css).toMatch(/\.doc-svg-paper\s+\[data-sheet-label\][^}]*touch-action:\s*none/);
    expect(css).toMatch(/\.doc-top-tabs button,\.doc-toolbar button,\.doc-download-menu button\{min-height:44px\}/);
    expect(css).toMatch(/\.doc-subtabs button,\.doc-tool-row button,\.doc-servitude-action,\.doc-panel \.doc-element>button,\.doc-sketch-tools button,\.doc-servitude-draft-actions button,\.doc-saved-road button,\.doc-dialog header button,\.doc-dialog footer button,\.doc-sheet-context header button,\.doc-panel details summary\{min-height:44px/);
    expect(css).toMatch(/\.doc-panel \.doc-neighbor-edit button\{width:44px;height:44px\}/);
    expect(css).toMatch(/\.doc-panel input:not\(\[type=checkbox\]\):not\(\[type=color\]\):not\(\[type=file\]\):not\(\[type=range\]\),\.doc-panel select,\.doc-panel textarea\{min-height:44px\}/);
    expect(page).toMatch(/const cancelPointerGesture\s*=\s*\(e:ReactPointerEvent<HTMLDivElement>\)/);
    expect(page).toMatch(/onPointerCancel=\{cancelPointerGesture\}/);
    expect(page).not.toMatch(/onPointerCancel=\{onPointerUp\}/);
    expect(page).toMatch(/e\.button!==0\|\|!e\.isPrimary/);
    expect(page).toMatch(/moved:false/);
    expect(page).toMatch(/if\(!d\.moved&&Math\.hypot\(e\.clientX-d\.startClientX,e\.clientY-d\.startClientY\)<8\)return;/);
    expect(page).toMatch(/Math\.hypot\(e\.clientX-labelGesture\.startClientX,e\.clientY-labelGesture\.startClientY\)>=8/);
    expect(page).toMatch(/if\(labelGesture&&pos&&!labelMoved\)\{[\s\S]*setSheetContext\(\{kind:'label',key:labelGesture\.key/);
    expect(page).toContain('Toque em um rótulo para personalizar sua aparência; arraste para reposicioná-lo.');
  });

  it('mantém os elementos móveis das pranchas geradas arrastáveis por toque', () => {
    const css = readSource('src/features/generations/generations.css');
    const page = readSource('src/features/generations/GenerationLayout.tsx');

    expect(css).toMatch(/\.gen-viewer svg\{[^}]*touch-action:pan-x pan-y/);
    expect(css).toMatch(/\.gen-draggable\s*\{[^}]*touch-action:\s*none/);
    expect(css).toMatch(/\.gen-draggable\s*\{[^}]*user-select:\s*none/);
    expect(page).toMatch(/setPointerCapture\(e\.pointerId\)/);
    expect(page).toMatch(/onPointerCancel=\{\(\)=>\{activeDrag\.current=null\}\}/);
    expect(css).toContain('@media screen and (max-width:650px)');
    expect(css).toMatch(/\.gen-columns\{display:flex;flex-direction:column\}/);
    expect(css).toMatch(/\.gen-sidebar\{max-height:65dvh/);
    expect(css).toMatch(/\.gen-viewer\{min-height:420px\}/);
    expect(css).toMatch(/\.gen-toolbar button,\.gen-subtabs button,\.gen-controls>button\{min-height:44px\}/);
    expect(css).toMatch(/\.gen-switch\{min-height:44px\}/);
  });

  it('permite orbitar o relevo 3D por toque e encerra o gesto cancelado', () => {
    const page = readSource('src/features/map/advancedTerrainTools.tsx');

    expect(page).toMatch(/onPointerDown=\{e\s*=>\s*\{\s*orbitPointerRef\.current/);
    expect(page).toMatch(/onPointerMove=\{e\s*=>\s*\{/);
    expect(page).toMatch(/onPointerCancel=\{e\s*=>\s*\{/);
    expect(page).toMatch(/touchAction:\s*'none'/);
    expect(page).not.toMatch(/onMouseMove=\{e\s*=>/);
  });

  it('não mostra avisos internos de funções pendentes na interface do mapa', () => {
    const page = readSource('src/features/map/OperationalMap.tsx');
    const css = readSource('src/features/map/map.css');

    expect(page).toMatch(/className="map-compass-control map-compass-safe map-compass-pad" role="group" aria-label=\{`Rotação do mapa, rumo/);
    expect(page).toMatch(/aria-label="Orientar o mapa para norte"/);
    expect(page).toMatch(/aria-label="Orientar o mapa para leste"/);
    expect(page).toMatch(/aria-label="Orientar o mapa para sul"/);
    expect(page).toMatch(/aria-label="Orientar o mapa para oeste"/);
    expect(page).not.toMatch(/Motor em migração|temporariamente desativada|map-legacy-pending/);
    expect(css).not.toMatch(/map-legacy-pending|map-pending-dot|map-north-reset|map-export-pending/);
  });

  it('dá nomes acessíveis aos controles de ícone do Croqui', () => {
    const page = readSource('src/features/croqui/CroquiPage.tsx');

    expect(page).toMatch(/aria-label="Desenhar linha" aria-pressed=\{mode==='line'\}/);
    expect(page).toMatch(/aria-label="Editar linhas" aria-pressed=\{mode==='edit'\}/);
    expect(page).toMatch(/aria-label="Opções de exportação do croqui" aria-expanded=\{exportOpen\}/);
  });

  it('limpa o arraste cancelado no mapa de localização do Memorial', () => {
    const page = readSource('src/features/memorial/MemorialPage.tsx');

    expect(page).toMatch(/if\(event\.button!==0\|\|!event\.isPrimary\)return;/);
    expect(page).toMatch(/pointerId:event\.pointerId,key,svg,start,offset/);
    expect(page).toMatch(/onPointerCancel=\{cancelMapLabelDrag\}/);
    expect(page).toMatch(/const cancelMapLabelDrag=[\s\S]*?mapDragRef\.current=null;[\s\S]*?releasePointerCapture/);
  });

  it('explica quando a localização do dispositivo não pode ser usada', () => {
    const page = readSource('src/features/map/OperationalMap.tsx');

    expect(page).toMatch(/if\(!navigator\.geolocation\)\{notify\('A localização não está disponível neste navegador\.'/);
    expect(page).toMatch(/A permissão para acessar a localização foi negada/);
    expect(page).toMatch(/Não foi possível determinar a localização deste dispositivo/);
    expect(page).toMatch(/timeout:12000,maximumAge:60000/);
    expect(page).toMatch(/aria-label="Minha localização" title="Minha localização" onClick=\{locateUser\}/);
  });

  it('quebra títulos públicos longos e empilha a Prancha na faixa de tablet estreita', () => {
    const publicCss = readSource('src/features/public/public-map.css');
    const documentCss = readSource('src/features/documents/documents.css');
    const tabletColumns = documentCss.indexOf('@media screen and (max-width:850px)');
    const tabletStack = documentCss.indexOf('@media screen and (min-width:661px) and (max-width:980px)');

    expect(publicCss).toMatch(/\.public-heading>div\{[^}]*min-width:0/);
    expect(publicCss).toMatch(/\.public-heading h1\{[^}]*overflow-wrap:anywhere/);
    expect(tabletColumns).toBeGreaterThanOrEqual(0);
    expect(tabletStack).toBeGreaterThan(tabletColumns);
    expect(documentCss.slice(tabletStack)).toContain(
      '.doc-layout{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(180px,min(34dvh,260px)) minmax(0,1fr)}'
    );
    expect(documentCss.slice(tabletStack)).toContain('.doc-sidebar{max-height:none}');
    expect(documentCss).toMatch(/@media screen and \(min-width:661px\) and \(max-width:980px\) and \(max-height:800px\)\{\.doc-root\.workspace-main\{[^}]*overflow-y:auto\}[^}]*\.doc-container\.workspace-container\{height:auto/);
    expect(documentCss).toContain('.doc-layout{flex:none;min-height:573px;overflow:visible;grid-template-rows:minmax(180px,min(34dvh,260px)) minmax(393px,1fr)}');
    expect(documentCss).toContain('.doc-main{min-height:393px}.doc-viewer{min-height:340px}');
  });
});
