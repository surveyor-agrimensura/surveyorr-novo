import { Compass, Database, FilePenLine, FileText, Folder, FolderKanban, Grid3X3, Leaf, Map, MapPinned, Mountain, PanelsTopLeft, ShieldCheck, SlidersHorizontal, Table2, type LucideIcon } from 'lucide-react';

// Todos os módulos listados têm uma rota funcional.
export type ToolItem = { label: string; summary: string; icon: LucideIcon; href: string };
export type ToolGroup = { label: string; tools: ToolItem[] };
export const toolGroups: ToolGroup[] = [
  { label: 'PRODUÇÃO TÉCNICA', tools: [
    { label: 'Mapa e Cadastro', summary: 'GIS, edição vetorial, divisão de glebas, partilha e camadas', icon: MapPinned, href: '/mapa/' },
    { label: 'Memorial Descritivo', summary: 'Gerar documentos a partir de projetos', icon: FileText, href: '/memorial/' },
    { label: 'Mapas e Croquis', summary: 'Pranchas técnicas e satélite', icon: Map, href: '/mapas/' },
    { label: 'Pranchas Técnicas', summary: 'Plantas A4 e A3 editáveis (1 por 1 ou completo)', icon: PanelsTopLeft, href: '/pranchas/' },
    { label: 'Planialtimetria / MDT', summary: 'Curvas de nível, TIN/IDW e relevo', icon: Mountain, href: '/planialtimetria/' }
  ] },
  { label: 'DOCUMENTOS E CONSULTA', tools: [
    { label: 'Perímetros por Azimute', summary: 'Cálculo de fechamento, Bowditch e rumo', icon: Compass, href: '/perimetro-azimute/' },
    { label: 'Cartas de Confrontação', summary: 'Declarações de confrontantes', icon: FilePenLine, href: '/confrontacao/' },
    { label: 'Consulta Pública CAR', summary: 'Pesquisa em dados públicos do CAR', icon: ShieldCheck, href: '/consulta-car/' },
    { label: 'Planilha ODS', summary: 'Planilha técnica de vértices e pré-SIGEF', icon: Table2, href: '/ods/' },
    { label: 'Relatório Ambiental', summary: 'Sobreposição de APPs e reserva', icon: Leaf, href: '/ambiental/' }
  ] },
  { label: 'ANÁLISE E CAMPO', tools: [
    { label: 'Projetos', summary: 'Armazenamento na nuvem', icon: FolderKanban, href: '/nuvem/' },
    { label: 'Central de Lotes', summary: 'Gerar dossiê completo 1 por 1 por lote/gleba em ZIP', icon: Grid3X3, href: '/central-lotes/' },
    { label: 'Acervos Oficiais', summary: 'SIGEF, INCRA e portais públicos', icon: Database, href: '/acervos/' },
    { label: 'Loteamentos / REURB', summary: 'Regularização fundiária e quadras', icon: Folder, href: '/loteamento-reurb/' },
    { label: 'Personalização', summary: 'Logotipo, assinatura e modelos da empresa', icon: SlidersHorizontal, href: '/customizacao/' }
  ] }
];

const normalizeCatalogText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

export function filterToolGroups(groups: readonly ToolGroup[], query: string): ToolGroup[] {
  const normalizedQuery = normalizeCatalogText(query.trim());
  if (!normalizedQuery) return groups.map(group => ({ ...group, tools: [...group.tools] }));

  return groups.flatMap(group => {
    const tools = group.tools.filter(tool => normalizeCatalogText(`${tool.label} ${tool.summary}`).includes(normalizedQuery));
    return tools.length ? [{ ...group, tools }] : [];
  });
}
