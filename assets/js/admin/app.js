(() => {
  'use strict';

  function showAdminRuntimeError(error) {
    const message = error?.message || String(error || 'Falha desconhecida ao iniciar o painel.');
    console.error('[GeoRural Admin]', error);
    const toast = document.getElementById('suiteToast');
    if (toast) {
      toast.textContent = `Falha ao carregar o painel: ${message}`;
      toast.className = 'toast show error';
      setTimeout(() => { toast.className = 'toast'; }, 7000);
    }
  }

  function bootstrapAdmin() {
    const auth = window.GeoRuralAuth;
    if (!auth || typeof auth.requireAdmin !== 'function') {
      showAdminRuntimeError(new Error('O módulo de autenticação não foi carregado. Atualize a página com Ctrl+F5.'));
      return;
    }

    const admin = auth.requireAdmin();
    if (!admin) return;

    try {
      const $ = (id) => document.getElementById(id);
      const AdminUsers = window.SurveyorAdminUsers;
      if (!AdminUsers) throw new Error('O módulo de usuários do painel administrativo não foi carregado.');
      const { generateStrongPassword } = AdminUsers;
  const escape = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const permissionGroups = {
    modulos: {
      title: 'Módulos principais',
      items: {
        mapa: 'Mapa e cadastro',
        car: 'Módulo CAR',
        loteamentos: 'Loteamentos / REURB',
        layers: 'Catálogo de camadas',
        cloud: 'Nuvem',
        customizacao: 'Personalização / papel timbrado',
        memorial: 'Memorial descritivo',
        ods: 'Planilha ODS',
        confrontacao: 'Cartas de confrontação',
        acervos: 'Acervos oficiais',
        mapas: 'Mapas e croquis',
        pranchas: 'Pranchas técnicas',
        planialtimetria: 'Planialtimetria / MDT',
        perimetros: 'Perímetros',
        ambiental: 'Relatório ambiental'
      }
    },

    oficiaisPlanos: {
      title: 'Planos oficiais Surveyor',
      items: {
        'map:access': 'Mapa e cadastro',
        'map:view': 'Mapa e cadastro (compat.)',
        'map:create-basic': 'Mapa: cadastro básico',
        'map:draw-basic': 'Mapa: desenho básico',
        'map:measure-basic': 'Mapa: medição básica',
        'map:create-full': 'Mapa: cadastro completo',
        'map:draw-full': 'Mapa: desenho completo',
        'map:measure-full': 'Mapa: medição completa',
        'map:coordinates': 'Coordenadas no mapa',
        'map:export-kml': 'Exportar KML pelo mapa',
        'map:export-geojson': 'Exportar GeoJSON pelo mapa',
        'projects:create': 'Projetos: criar',
        'projects:edit-own': 'Projetos: editar próprios',
        'projects:view-own': 'Projetos: ver próprios',
        'projects:export-basic': 'Projetos: exportação básica',
        'projects:export-full': 'Projetos: exportação completa',
        'projects:duplicate': 'Projetos: duplicar',
        'projects:version-basic': 'Projetos: versões básicas',
        'projects:version-full': 'Projetos: versões completas',
        'projects:trash': 'Projetos: lixeira',
        'projects:lock': 'Projetos: travar',
        'projects:templates': 'Projetos: modelos',
        'projects:export-zip': 'Projetos: exportar ZIP',
        'layers:view-basic': 'Camadas básicas',
        'layers:official-basic': 'Camadas oficiais básicas',
        'layers:view-full': 'Camadas completas',
        'layers:catalog-full': 'Catálogo completo',
        'layers:wms-wfs': 'WMS/WFS',
        'geometry:edit-basic': 'Geometria: edição básica',
        'geometry:offset': 'Geometria: offset',
        'geometry:rotate': 'Geometria: rotacionar',
        'geometry:scale': 'Geometria: escalar',
        'geometry:mirror': 'Geometria: espelhar',
        'geometry:vertices-edit': 'Geometria: editar vértices',
        'geometry:advanced': 'Geometria avançada',
        'sig:basic': 'SIG básico',
        'sig:advanced': 'SIG avançado',
        'terrain:basic': 'Terreno básico',
        'terrain:advanced': 'Terreno avançado',
        'car:full': 'Módulo CAR completo',
        'ambiental:basic': 'Relatório ambiental básico',
        'ambiental:full': 'Relatório ambiental completo',
        'loteamentos:basic': 'Loteamentos / REURB básico',
        'loteamentos:full': 'Loteamentos / REURB completo',
        'documents:memorial': 'Memorial descritivo',
        'documents:memorial-basic': 'Memorial descritivo (compat.)',
        'documents:ods': 'Planilha ODS',
        'documents:ods-basic': 'Planilha ODS (compat.)',
        'documents:confrontacao': 'Cartas de confrontação',
        'documents:confrontacao-basic': 'Cartas de confrontação (compat.)',
        'documents:mapas': 'Mapas e croquis',
        'documents:mapas-basic': 'Mapas e croquis (compat.)',
        'documents:pranchas': 'Pranchas técnicas',
        'documents:pranchas-basic': 'Pranchas técnicas (compat.)',
        'documents:memorial-full': 'Memorial descritivo completo (compat.)',
        'documents:ods-full': 'Planilha ODS completa (compat.)',
        'documents:confrontacao-full': 'Cartas de confrontação completas (compat.)',
        'documents:mapas-full': 'Mapas e croquis completos (compat.)',
        'documents:pranchas-full': 'Pranchas técnicas completas (compat.)',
        'documents:perimetros-full': 'Perímetros completos',
        'documents:planialtimetria-basic': 'Planialtimetria básica',
        'documents:download': 'Download de documentos',
        'planialtimetria:full': 'Planialtimetria completa',
        'sharing:readonly': 'Compartilhamento somente leitura',
        'sharing:password': 'Compartilhamento com senha',
        'sharing:expires': 'Compartilhamento com validade',
        'sharing:full': 'Compartilhamento completo',
        'sharing:revoke': 'Revogar compartilhamento',
        'sharing:access-limit': 'Limite de acesso em links',
        'admin:dashboard': 'Admin: dashboard',
        'admin:users': 'Admin: usuários',
        'admin:plans': 'Admin: planos',
        'admin:permissions': 'Admin: permissões',
        'admin:storage': 'Admin: armazenamento',
        'admin:licenses': 'Admin: licenças',
        'admin:audit': 'Admin: auditoria',
        'admin:logs': 'Admin: logs',
        'admin:sessions': 'Admin: sessões',
        'admin:notices': 'Admin: avisos',
        'security:monitoring': 'Segurança: monitoramento',
        'security:login-attempts': 'Segurança: tentativas de login',
        'security:ip-history': 'Segurança: histórico de IPs',
        'security:access-history': 'Segurança: histórico de acessos',
        'workspace:audit-own': 'Auditoria do próprio espaço',
        'company:settings': 'Configuração global da empresa',
        'white-label:basic': 'White label (adicional contratado)',
        'cloud:view-own': 'Nuvem: ver próprios arquivos',
        'cloud:basic': 'Nuvem básica',
        'cloud:plus': 'Nuvem Plus',
        'cloud:pro': 'Nuvem Pro',
        'support:standard': 'Suporte padrão',
        'support:priority-basic': 'Suporte prioridade leve',
        'support:priority': 'Suporte prioritário',
        'basic:*': 'Herda permissões do Básico',
        'plus:*': 'Herda permissões do Plus'
      }
    },
    memoriais: {
      title: 'Memoriais e documentos técnicos',
      items: {
        'memorial:pdf': 'Memorial PDF / SIGEF',
        'memorial:previo': 'Memorial prévio',
        'memorial:word': 'Memorial Word editável',
        'memorial:azimutes': 'Memorial com azimutes e distâncias',
        'memorial:coordenadas': 'Memorial com coordenadas',
        'memorial:altitudes': 'Memorial com altitudes',
        'calc:area-perimetro': 'Cálculo de área e perímetro',
        'assinatura:digital': 'Assinatura digital de documentos'
      }
    },
    croquis: {
      title: 'Croquis, pranchas e desenhos',
      items: {
        'croqui:simples': 'Croqui do imóvel',
        'croqui:confrontante': 'Croqui com trecho do confrontante',
        'croqui:a3a4': 'Croqui automático A3/A4',
        'croqui:customizacao': 'Customização do croqui automático',
        'croqui:ambiental': 'Croqui ambiental com APPs',
        'croqui:planialtimetrico': 'Croqui planialtimétrico',
        'desenho:satelite': 'Desenho sobre imagem de satélite',
        'escala:automatica': 'Cálculo automático de escala',
        'vertices:codificacao': 'Administrar codificação de vértices'
      }
    },
    cadastros: {
      title: 'Cadastros e banco de dados',
      items: {
        'cadastro:proprietarios': 'Cadastro de proprietários',
        'cadastro:confrontantes': 'Cadastro de confrontantes',
        'cadastro:responsavel-tecnico': 'Cadastro de responsável técnico',
        'cadastro:imoveis': 'Cadastro de imóveis',
        'banco:manipulacao': 'Manipulação de banco de dados'
      }
    },
    carAmbiental: {
      title: 'CAR, APP e consultas oficiais',
      items: {
        'car:cadastro': 'Módulo CAR - Cadastro Ambiental',
        'car:app': 'APP Ambiental',
        'car:intersecao': 'Cálculo de interseção com APP',
        'consulta:sigef': 'Consulta SIGEF',
        'consulta:snci': 'Consulta SNCI',
        'consulta:car': 'Consulta Pública CAR',
        'ambiental:relatorio': 'Relatório ambiental avançado'
      }
    },
    importacaoExportacao: {
      title: 'Importação, exportação e formatos',
      items: {
        'import:kml': 'Importar KML',
        'import:geojson': 'Importar GeoJSON/JSON',
        'import:csv': 'Importar CSV',
        'import:shapefile': 'Importar Shapefile',
        'export:kml': 'Exportar KML',
        'export:geojson': 'Exportar GeoJSON',
        'export:csv': 'Exportar CSV',
        'export:dxf': 'Exportar DXF',
        'export:shapefile': 'Exportar Shapefile',
        'export:zip-tecnico': 'Pacote técnico ZIP',
        'conversao:kml-dxf': 'Conversão KML ⇄ DXF',
        'dxf:planilhas': 'Gerar DXF a partir de planilhas'
      }
    },
    mdt: {
      title: 'Planialtimetria / MDT',
      items: {
        'mdt:mapa-automatico': 'Mapa planialtimétrico automático',
        'mdt:levantamento': 'Mapa planialtimétrico do levantamento',
        'mdt:ponderacao': 'Ponderação de pontos em MDT',
        'mdt:raster': 'Criação automática de MDT Raster',
        'mdt:pontos': 'Criação automática de MDT Pontos',
        'mdt:perfil': 'Criação automática de perfil de elevação',
        'mdt:volume': 'Cálculo de volume',
        'mdt:altitudes': 'Obter altitudes INPE/Google/SIGEF/Raster',
        'mdt:curvas': 'Gerar curvas de nível'
      }
    },
    perimetrosAvancados: {
      title: 'Perímetros e DXF avançado',
      items: {
        'perimetro:azimutes': 'Perímetros por azimutes e distâncias',
        'perimetro:rumos': 'Perímetros por rumos e distâncias',
        'perimetro:utm': 'Perímetros por coordenadas UTM',
        'perimetro:geograficas': 'Perímetros por coordenadas geográficas',
        'dxf:extrair-poligonos': 'Extrair coordenadas de polígonos DXF',
        'dxf:extrair-linhas': 'Extrair coordenadas de linhas DXF',
        'dxf:extrair-pontos': 'Extrair coordenadas de pontos DXF'
      }
    },
    documentos: {
      title: 'Peças, contratos e suporte',
      items: {
        'docs:anuencia-word': 'Cartas de anuência para Word',
        'docs:requerimentos': 'Gerar requerimentos',
        'docs:procuracoes': 'Gerar procurações',
        'docs:declaracoes': 'Gerar declarações',
        'docs:contratos': 'Gerar contratos',
        'docs:recibos': 'Gerar recibos',
        'suporte:tecnico': 'Suporte técnico',
        'videos:tutoriais': 'Vídeos tutoriais',
        'ferramentas:novas': 'Acesso a novas ferramentas'
      }
    },
    loteamentosGroup: {
      title: 'Loteamentos / REURB',
      items: {
        'loteamento:projetos': 'Projetos de loteamento/REURB',
        'loteamento:lotes': 'Cadastro/importação de lotes',
        'loteamento:confrontantes': 'Busca/edição de confrontantes',
        'loteamento:memoriais': 'Memoriais individuais em massa',
        'loteamento:croquis': 'Croquis individuais em massa',
        'loteamento:ortofotos': 'Ortofotos e compartilhamento do cliente'
      }
    }
  };

  const permissionLabels = Object.fromEntries(Object.values(permissionGroups).flatMap((group) => Object.entries(group.items)));
  Object.assign(permissionLabels, {
    '*': 'Acesso completo ao GeoRural Pro',
    'admin:all': 'Acesso administrativo completo',
    'memorial:*': 'Todos os recursos de memoriais',
    'croqui:*': 'Todos os recursos de croquis e pranchas',
    'cadastro:*': 'Todos os cadastros',
    'car:*': 'Todos os recursos CAR e APP',
    'consulta:*': 'Todas as consultas oficiais',
    'import:*': 'Todas as importações',
    'export:*': 'Todas as exportações',
    'mdt:*': 'Todos os recursos MDT/planialtimetria',
    'perimetro:*': 'Todos os perímetros técnicos',
    'dxf:*': 'Todos os recursos DXF',
    'docs:*': 'Todos os documentos técnicos',
    'loteamento:*': 'Todos os recursos de loteamentos/REURB'
  });

  let users = [];
  let plans = [];
  let layers = [];
  let layerGroups = [];
  let notices = [];
  const workspaceTeamState = { owner: null, team: null, editing: null, mode: 'existing', loading: false, nameDirty: false, savedNameOverride: null };
  let advancedDashboard = null;
  let advancedAuditLogs = [];
  let advancedSessions = [];
  let securitySettings = {};
  let securityAttempts = [];
  let layerImportBusy = false;
  let layerImportCompleted = false;
  let activeLayerUploadId = null;
  let layerUploadController = null;
  let layerRefreshTimer = null;
  let layerColorManuallyEdited = false;
  let layerFilterGroup = 'all';
  let layerFilterText = '';
  const userOnboardingState = {
    step: 1,
    startDate: '',
    endDate: '',
    amountCents: 0,
    signatureDataUrl: '',
    signaturePosition: { x: 50, y: 44, scale: 100 },
    signatureDragging: false,
    workspaceMembers: [],
    requestId: ''
  };


  const GEOBAHIA_WMS_BASE_URL = 'https://geoserver.inema.ba.gov.br/geoserver/ows';
  const GEOBAHIA_DEFAULT_TRANSPARENCY = 0.55;
  const geobahiaAutomaticCatalog = [
    {
        "group": "1. CEFIR — Imóveis Rurais",
        "name": "Imóveis Rurais - Área de Preservação Permanente",
        "layer": "Vetor_Recortes_Tematicos:cefir_imovel_rural_app_inema",
        "color": "#ef4444",
        "geometry": "polygon"
    },
    {
        "group": "1. CEFIR — Imóveis Rurais",
        "name": "Imóvel Rural - Reservas Legais",
        "layer": "Vetor_Recortes_Tematicos:cefir_imovel_rural_reserva_legal_inema",
        "color": "#15803d",
        "geometry": "polygon"
    },
    {
        "group": "1. CEFIR — Imóveis Rurais",
        "name": "Imóveis Rurais - Vegetação Nativa",
        "layer": "Vetor_Recortes_Tematicos:cefir_imovel_rural_vegetacao_nativa_inema",
        "color": "#22c55e",
        "geometry": "polygon"
    },
    {
        "group": "1. CEFIR — Imóveis Rurais",
        "name": "Imóveis Rurais - Atividade Desenvolvida",
        "layer": "Vetor_Recortes_Tematicos:cefir_imovel_rural_atividade_desenvolvida_inema",
        "color": "#f59e0b",
        "geometry": "polygon"
    },
    {
        "group": "1. CEFIR — Imóveis Rurais",
        "name": "Imóveis Rurais - RPPN",
        "layer": "Vetor_Recortes_Tematicos:cefir_imovel_rural_rppn_inema",
        "color": "#0ea5e9",
        "geometry": "polygon"
    },
    {
        "group": "1. CEFIR — Imóveis Rurais",
        "name": "Imóvel Rural - Áreas Degradadas em APP",
        "layer": "Vetor_Recortes_Tematicos:cefir_imovel_rural_area_degradada_app_inema",
        "color": "#b91c1c",
        "geometry": "polygon"
    },
    {
        "group": "1. CEFIR — Imóveis Rurais",
        "name": "Imóvel Rural - Áreas Degradadas em Reserva Legal",
        "layer": "Vetor_Recortes_Tematicos:cefir_imovel_rural_area_degradada_reserva_legal_inema",
        "color": "#713f12",
        "geometry": "polygon"
    },
    {
        "group": "2. CEFIR — Assentamentos",
        "name": "Assentamento - Limites de Assentamentos",
        "layer": "Vetor_Recortes_Tematicos:cefir_assentamento_limite_inema",
        "color": "#334155",
        "geometry": "polygon"
    },
    {
        "group": "2. CEFIR — Assentamentos",
        "name": "Assentamentos - Área de Preservação Permanente",
        "layer": "Vetor_Recortes_Tematicos:cefir_assentamento_app_inema",
        "color": "#ef4444",
        "geometry": "polygon"
    },
    {
        "group": "2. CEFIR — Assentamentos",
        "name": "Assentamentos - Reserva Legal",
        "layer": "Vetor_Recortes_Tematicos:cefir_assentamento_reserva_legal_inema",
        "color": "#15803d",
        "geometry": "polygon"
    },
    {
        "group": "2. CEFIR — Assentamentos",
        "name": "Assentamentos - Vegetação Nativa",
        "layer": "Vetor_Recortes_Tematicos:cefir_assentamento_vegetacao_nativa_inema",
        "color": "#22c55e",
        "geometry": "polygon"
    },
    {
        "group": "2. CEFIR — Assentamentos",
        "name": "Assentamento - Áreas Rurais Consolidadas",
        "layer": "Vetor_Recortes_Tematicos:cefir_assentamento_area_consolidada_inema",
        "color": "#a855f7",
        "geometry": "polygon"
    },
    {
        "group": "2. CEFIR — Assentamentos",
        "name": "Assentamentos - Atividade Desenvolvida",
        "layer": "Vetor_Recortes_Tematicos:cefir_assentamento_atividade_desenvolvida_inema",
        "color": "#f59e0b",
        "geometry": "polygon"
    },
    {
        "group": "2. CEFIR — Assentamentos",
        "name": "Assentamento - Áreas Degradadas em APP",
        "layer": "Vetor_Recortes_Tematicos:cefir_assentamento_area_degradada_app_inema",
        "color": "#b91c1c",
        "geometry": "polygon"
    },
    {
        "group": "2. CEFIR — Assentamentos",
        "name": "Assentamento - Áreas Degradadas em Reserva Legal",
        "layer": "Vetor_Recortes_Tematicos:cefir_assentamento_area_degradada_reserva_legal_inema",
        "color": "#713f12",
        "geometry": "polygon"
    },
    {
        "group": "3. CEFIR — PCT",
        "name": "PCT - Territórios",
        "layer": "Vetor_Recortes_Tematicos:cefir_pct_limite_inema",
        "color": "#7c3aed",
        "geometry": "polygon"
    },
    {
        "group": "3. CEFIR — PCT",
        "name": "PCT - Áreas de Preservação Permanente",
        "layer": "Vetor_Recortes_Tematicos:cefir_pct_app_inema",
        "color": "#ef4444",
        "geometry": "polygon"
    },
    {
        "group": "3. CEFIR — PCT",
        "name": "PCT - Reservas Legais",
        "layer": "Vetor_Recortes_Tematicos:cefir_pct_reserva_legal_inema",
        "color": "#15803d",
        "geometry": "polygon"
    },
    {
        "group": "3. CEFIR — PCT",
        "name": "PCT - Vegetações Nativas",
        "layer": "Vetor_Recortes_Tematicos:cefir_pct_vegetacao_nativa_inema",
        "color": "#22c55e",
        "geometry": "polygon"
    },
    {
        "group": "3. CEFIR — PCT",
        "name": "PCT - Áreas Rurais Consolidadas",
        "layer": "Vetor_Recortes_Tematicos:cefir_pct_area_consolidada_inema",
        "color": "#a855f7",
        "geometry": "polygon"
    },
    {
        "group": "3. CEFIR — PCT",
        "name": "PCT - Atividades Desenvolvidas",
        "layer": "Vetor_Recortes_Tematicos:cefir_pct_atividade_desenvolvida_inema",
        "color": "#f59e0b",
        "geometry": "polygon"
    },
    {
        "group": "4. Áreas Protegidas e Culturais",
        "name": "Sitios Arqueológicos IPHAN 2024 - Ponto",
        "layer": "Vetor_Recortes_Tematicos:sitios_arqueologicos_iphan_pt",
        "color": "#9333ea",
        "geometry": "point"
    },
    {
        "group": "4. Áreas Protegidas e Culturais",
        "name": "Sítios Arqueológicos IPHAN - Área",
        "layer": "Vetor_Recortes_Tematicos:sitios_arqueologicos_iphan_pol",
        "color": "#a855f7",
        "geometry": "polygon"
    },
    {
        "group": "4. Áreas Protegidas e Culturais",
        "name": "Áreas de Quilombolas - INCRA - 2024",
        "layer": "Vetor_Recortes_Tematicos:areas_quilombolas_incra",
        "color": "#8b5cf6",
        "geometry": "polygon"
    },
    {
        "group": "4. Áreas Protegidas e Culturais",
        "name": "Terra Indígena FUNAI - 2024",
        "layer": "Vetor_Recortes_Tematicos:terras_indigenas_funai",
        "color": "#d946ef",
        "geometry": "polygon"
    },
    {
        "group": "4. Áreas Protegidas e Culturais",
        "name": "Unidades de Conservação Estaduais - 2025",
        "layer": "Vetor_Recursos_Ambientais:uc_inema_2025",
        "color": "#059669",
        "geometry": "polygon"
    },
    {
        "group": "4. Áreas Protegidas e Culturais",
        "name": "Unidades de Conservação Municipais 2025",
        "layer": "Vetor_Recortes_Tematicos:uc_municipal",
        "color": "#10b981",
        "geometry": "polygon"
    },
    {
        "group": "4. Áreas Protegidas e Culturais",
        "name": "Unidades de Conservação Federais - 2024",
        "layer": "Vetor_Recortes_Tematicos:uc_federal",
        "color": "#047857",
        "geometry": "polygon"
    },
    {
        "group": "4. Áreas Protegidas e Culturais",
        "name": "RPPN ESTADUAL - INEMA - 2026",
        "layer": "Vetor_Recortes_Tematicos:rppn_estadual_inema",
        "color": "#0284c7",
        "geometry": "polygon"
    },
    {
        "group": "4. Áreas Protegidas e Culturais",
        "name": "RPPN FEDERAL - ICMBIO",
        "layer": "Vetor_Recortes_Tematicos:rppn_federal_icmbio",
        "color": "#0369a1",
        "geometry": "polygon"
    },
    {
        "group": "4. Áreas Protegidas e Culturais",
        "name": "Lei da Mata Atlântica",
        "layer": "Vetor_Recortes_Tematicos:lei_mata_atlantica",
        "color": "#166534",
        "geometry": "polygon"
    },
    {
        "group": "4. Áreas Protegidas e Culturais",
        "name": "Zonas de Amortecimento UC - 2021",
        "layer": "Vetor_Recortes_Tematicos:zona_amortecimento_uc",
        "color": "#84cc16",
        "geometry": "polygon"
    },
    {
        "group": "4. Áreas Protegidas e Culturais",
        "name": "Zonas de Amortecimento Federais - 2024",
        "layer": "Vetor_Recortes_Tematicos:zona_amortecimento_federal",
        "color": "#65a30d",
        "geometry": "polygon"
    },
    {
        "group": "5. Áreas de Restrição",
        "name": "Faixa de Servidão - Trechos de Dutos",
        "layer": "Vetor_Recortes_Tematicos:faixa_servidao_dutos",
        "color": "#dc2626",
        "geometry": "mixed"
    },
    {
        "group": "5. Áreas de Restrição",
        "name": "Faixa de Servidão de Trechos Rodoviários",
        "layer": "Vetor_Recortes_Tematicos:faixa_servidao_rodovias",
        "color": "#ea580c",
        "geometry": "mixed"
    },
    {
        "group": "5. Áreas de Restrição",
        "name": "Faixa de Servidão de Trecho Ferroviário",
        "layer": "Vetor_Recortes_Tematicos:faixa_servidao_ferrovias",
        "color": "#ca8a04",
        "geometry": "mixed"
    },
    {
        "group": "5. Áreas de Restrição",
        "name": "Áreas de Utilidade Pública",
        "layer": "Vetor_Recortes_Tematicos:areas_utilidade_publica",
        "color": "#475569",
        "geometry": "polygon"
    },
    {
        "group": "6. Zoneamentos de Unidades de Conservação",
        "name": "Zoneamentos 1:25.000",
        "layer": "Vetor_Recortes_Tematicos:zoneamento_25k",
        "color": "#fcd34d",
        "geometry": "polygon"
    },
    {
        "group": "6. Zoneamentos de Unidades de Conservação",
        "name": "Zoneamentos 1:50.000",
        "layer": "Vetor_Recortes_Tematicos:zoneamento_50k",
        "color": "#fbbf24",
        "geometry": "polygon"
    },
    {
        "group": "6. Zoneamentos de Unidades de Conservação",
        "name": "Zoneamentos 1:100.000",
        "layer": "Vetor_Recortes_Tematicos:zoneamento_100k",
        "color": "#f59e0b",
        "geometry": "polygon"
    },
    {
        "group": "6. Zoneamentos de Unidades de Conservação",
        "name": "Zoneamentos 1:250.000",
        "layer": "Vetor_Recortes_Tematicos:zoneamento_250k",
        "color": "#d97706",
        "geometry": "polygon"
    },
    {
        "group": "6. Zoneamentos de Unidades de Conservação",
        "name": "Zoneamento APA Gruta dos Brejões (2002)",
        "layer": "Vetor_Recortes_Tematicos:zoneamento_apa_gruta_brejoes",
        "color": "#14b8a6",
        "geometry": "polygon"
    },
    {
        "group": "6. Zoneamentos de Unidades de Conservação",
        "name": "Zoneamento APA Ilhas Tinharé/Boipeba (2016)",
        "layer": "Vetor_Recortes_Tematicos:zoneamento_apa_tinhare",
        "color": "#0d9488",
        "geometry": "polygon"
    },
    {
        "group": "7. Biodiversidade e Vegetação",
        "name": "Áreas Prioritárias para Conservação",
        "layer": "Vetor_Recortes_Tematicos:areas_prioritarias_conservacao",
        "color": "#84cc16",
        "geometry": "polygon"
    },
    {
        "group": "7. Biodiversidade e Vegetação",
        "name": "Sistema Costeiro Marinho",
        "layer": "Vetor_Recortes_Tematicos:sistema_costeiro_marinho",
        "color": "#06b6d4",
        "geometry": "polygon"
    },
    {
        "group": "7. Biodiversidade e Vegetação",
        "name": "Potencial Áreas Soltura Animais Silvestres",
        "layer": "Vetor_Recortes_Tematicos:areas_soltura_animais",
        "color": "#22c55e",
        "geometry": "polygon"
    },
    {
        "group": "7. Biodiversidade e Vegetação",
        "name": "Biomas IBGE 2019",
        "layer": "Vetor_Bases_Gerais:biomas_ibge_2019",
        "color": "#4ade80",
        "geometry": "polygon"
    },
    {
        "group": "7. Biodiversidade e Vegetação",
        "name": "Estagios Mata Atlântica - SSA",
        "layer": "Vetor_Recortes_Tematicos:estagios_mata_atlantica",
        "color": "#16a34a",
        "geometry": "polygon"
    },
    {
        "group": "7. Biodiversidade e Vegetação",
        "name": "Mapa Síntese Relevância Ambiental (2014)",
        "layer": "Vetor_Recortes_Tematicos:relevancia_ambiental_2014",
        "color": "#d946ef",
        "geometry": "polygon"
    },
    {
        "group": "7. Biodiversidade e Vegetação",
        "name": "Mapa Síntese Simplificado Relevância (2014)",
        "layer": "Vetor_Recortes_Tematicos:relevancia_ambiental_simp_2014",
        "color": "#c026d3",
        "geometry": "polygon"
    },
    {
        "group": "7. Biodiversidade e Vegetação",
        "name": "Vegetação",
        "layer": "Vetor_Bases_Gerais:vegetacao",
        "minZoom": 12,
        "color": "#15803d",
        "geometry": "polygon"
    },
    {
        "group": "8. Gestão Territorial e Malha",
        "name": "Divisão Político Administrativa - SEI",
        "layer": "Vetor_Bases_Gerais:municip_sei_2019",
        "color": "#555555",
        "geometry": "polygon"
    },
    {
        "group": "8. Gestão Territorial e Malha",
        "name": "Limite Estadual",
        "layer": "Vetor_Bases_Gerais:limite_estadual",
        "color": "#1c1917",
        "geometry": "polygon"
    },
    {
        "group": "8. Gestão Territorial e Malha",
        "name": "Território de Identidade 2024",
        "layer": "Vetor_Bases_Gerais:territorio_identidade",
        "color": "#78716c",
        "geometry": "polygon"
    },
    {
        "group": "8. Gestão Territorial e Malha",
        "name": "Zona Costeira - 2024",
        "layer": "Vetor_Bases_Gerais:zona_costeira_2024",
        "color": "#38bdf8",
        "geometry": "polygon"
    },
    {
        "group": "8. Gestão Territorial e Malha",
        "name": "Municípios da Zona Costeira - 2024",
        "layer": "Vetor_Bases_Gerais:municipios_zona_costeira_2024",
        "color": "#0284c7",
        "geometry": "polygon"
    },
    {
        "group": "9. Recursos Hídricos",
        "name": "Bacias Ottocodificadas - Bahia",
        "layer": "Vetor_Recursos_Hidricos:bacias_ottocodificadas",
        "minZoom": 12,
        "color": "#3b82f6",
        "geometry": "polygon"
    },
    {
        "group": "9. Recursos Hídricos",
        "name": "Bacias Otto Nível 4",
        "layer": "Vetor_Recursos_Hidricos:bacias_otto_nivel4",
        "minZoom": 12,
        "color": "#60a5fa",
        "geometry": "polygon"
    },
    {
        "group": "9. Recursos Hídricos",
        "name": "Trecho de Drenagem - INEMA",
        "layer": "Vetor_Recursos_Hidricos:trechos_drenagem",
        "color": "#2563eb",
        "geometry": "line"
    },
    {
        "group": "9. Recursos Hídricos",
        "name": "Massa Dágua - INEMA",
        "layer": "Vetor_Recursos_Hidricos:massa_dagua",
        "color": "#1d4ed8",
        "geometry": "polygon"
    },
    {
        "group": "9. Recursos Hídricos",
        "name": "Trecho Massa Dágua - INEMA",
        "layer": "Vetor_Recursos_Hidricos:trecho_massa_dagua",
        "color": "#1e3a8a",
        "geometry": "mixed"
    },
    {
        "group": "9. Recursos Hídricos",
        "name": "Regiões Planejamento Gestão Águas - RPGA",
        "layer": "Vetor_Recursos_Hidricos:rpga",
        "color": "#0284c7",
        "geometry": "polygon"
    },
    {
        "group": "9. Recursos Hídricos",
        "name": "Aquiferos da Bahia",
        "layer": "Vetor_Recursos_Hidricos:aquiferos",
        "color": "#0ea5e9",
        "geometry": "polygon"
    },
    {
        "group": "9. Recursos Hídricos",
        "name": "Zoneamento Hídrico Polo Camaçari",
        "layer": "Vetor_Recursos_Hidricos:zoneamento_hidrico_camacari",
        "color": "#38bdf8",
        "geometry": "polygon"
    },
    {
        "group": "9. Recursos Hídricos",
        "name": "Área Urbana/Periurbana - Mun. Lapão",
        "layer": "Vetor_Recursos_Hidricos:area_urbana_lapao",
        "color": "#cbd5e1",
        "geometry": "polygon"
    },
    {
        "group": "10. Recursos Naturais",
        "name": "Geologia 2004",
        "layer": "Vetor_Recursos_Naturais:geologia_2004",
        "minZoom": 12,
        "color": "#a8a29e",
        "geometry": "polygon"
    },
    {
        "group": "10. Recursos Naturais",
        "name": "Geomorfologia 2004",
        "layer": "Vetor_Recursos_Naturais:geomorfologia_2004",
        "minZoom": 12,
        "color": "#d6d3d1",
        "geometry": "polygon"
    },
    {
        "group": "10. Recursos Naturais",
        "name": "Solos",
        "layer": "Vetor_Recursos_Ambientais:solos",
        "minZoom": 12,
        "color": "#78350f",
        "geometry": "polygon"
    },
    {
        "group": "11. Monitoramento",
        "name": "Estações Fluviométricas - 2021",
        "layer": "Vetor_Recursos_Hidricos:estacoes_fluviometricas",
        "color": "#ef4444",
        "geometry": "point"
    },
    {
        "group": "11. Monitoramento",
        "name": "Rede de Monitoramento Qualidade da Água",
        "layer": "Vetor_Recursos_Hidricos:rede_qualidade_agua",
        "color": "#3b82f6",
        "geometry": "point"
    },
    {
        "group": "11. Monitoramento",
        "name": "Estações de Qualidade da Água - remoto",
        "layer": "Vetor_Recursos_Hidricos:estacoes_qualidade_agua_remoto",
        "color": "#60a5fa",
        "geometry": "point"
    },
    {
        "group": "11. Monitoramento",
        "name": "Estações Hidrológicas",
        "layer": "Vetor_Recursos_Hidricos:estacoes_hidrologicas",
        "color": "#2563eb",
        "geometry": "point"
    },
    {
        "group": "11. Monitoramento",
        "name": "Estações Meteorológicas",
        "layer": "Vetor_Bases_Gerais:estacoes_meteorologicas",
        "color": "#f59e0b",
        "geometry": "point"
    },
    {
        "group": "11. Monitoramento",
        "name": "Monitoramento Vegetação",
        "layer": "Vetor_Biodiversidade:monitoramento_vegetacao",
        "color": "#10b981",
        "geometry": "polygon"
    },
    {
        "group": "11. Monitoramento",
        "name": "Remanescente - T0",
        "layer": "Vetor_Biodiversidade:remanescente_t0",
        "color": "#059669",
        "geometry": "polygon"
    },
    {
        "group": "12. Projetos / Atos Autorizativos / Outros",
        "name": "Autorização de Supressão de Vegetação",
        "layer": "Vetor_Recortes_Tematicos:autorizacao_supressao_vegetacao",
        "color": "#dc2626",
        "geometry": "polygon"
    },
    {
        "group": "12. Projetos / Atos Autorizativos / Outros",
        "name": "Compensação Ambiental",
        "layer": "Vetor_Recortes_Tematicos:compensacao_ambiental",
        "color": "#84cc16",
        "geometry": "polygon"
    },
    {
        "group": "12. Projetos / Atos Autorizativos / Outros",
        "name": "Região de Referência do TCSA Porto Sul",
        "layer": "Vetor_Recortes_Tematicos:tcsa_porto_sul",
        "color": "#64748b",
        "geometry": "polygon"
    },
    {
        "group": "12. Projetos / Atos Autorizativos / Outros",
        "name": "Limite Semiárido Bahia - INSA (2024)",
        "layer": "Vetor_Bases_Gerais:limite_semiarido_insa",
        "color": "#fcd34d",
        "geometry": "polygon"
    },
    {
        "group": "12. Projetos / Atos Autorizativos / Outros",
        "name": "Plano Ação Territorial Chapada Diamantina",
        "layer": "Vetor_Recortes_Tematicos:plano_acao_chapada",
        "color": "#b45309",
        "geometry": "polygon"
    },
    {
        "group": "12. Projetos / Atos Autorizativos / Outros",
        "name": "Plano de Ação Nacional - Hileia Baiana",
        "layer": "Vetor_Recortes_Tematicos:plano_acao_hileia",
        "color": "#047857",
        "geometry": "polygon"
    },
    {
        "group": "13. Imagens Raster",
        "name": "Ortofoto Salvador 2016/2017",
        "layer": "Raster_ORTOFOTO:ortofoto_salvador_2016_2017",
        "color": "#64748b",
        "geometry": "raster",
        "forceWmsColor": false
    }
];
  const SQL_GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function normalizeBillingCycle(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (['mensal', 'monthly', 'month'].includes(normalized)) return 'mensal';
    if (['anual', 'annual', 'yearly', 'year'].includes(normalized)) return 'anual';
    if (['interno', 'internal', 'custom', 'free', 'gratuito'].includes(normalized)) return 'interno';
    return 'anual';
  }

  function validSqlGuid(value) {
    return SQL_GUID_RE.test(String(value || '').trim());
  }

  function slugify(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
      .replace(/[^a-z0-9_]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function normalizeHexColor(value, fallback = '#3974D8') {
    const raw = String(value || '').trim().toUpperCase();
    const short = raw.match(/^#?([0-9A-F]{3})$/);
    if (short) return `#${short[1].split('').map((char) => char + char).join('')}`;
    const full = raw.match(/^#?([0-9A-F]{6})$/);
    if (full) return `#${full[1]}`;
    return String(fallback || '#3974D8').toUpperCase();
  }

  function setLayerColorValue(value, { manual = false } = {}) {
    const color = normalizeHexColor(value, $('layerColor')?.value || '#3974D8');
    if ($('layerColor')) $('layerColor').value = color.toLowerCase();
    if ($('layerColorHex')) $('layerColorHex').value = color;
    if (manual) layerColorManuallyEdited = true;
    return color;
  }

  function inferWmsSymbolizer(value = '') {
    const text = String(value || '').toLowerCase();
    if (/nascente|ponto|point|marco|vértice|vertice/.test(text)) return 'point';
    if (/rio|hidro|linha|line|estrada|rodovia|via|curso d[’']?água|curso d[’']?agua/.test(text)) return 'line';
    return 'polygon';
  }

  function updateWmsStyleControls() {
    const fieldset = $('layerWmsStyleField');
    if (!fieldset) return;
    const serviceUrl = $('layerServiceUrl').value.trim();
    const isWms = $('layerSourceMode').value === 'url' && effectiveRemoteServiceType({
      serviceUrl,
      selectedType: $('layerRemoteType').value,
      layerName: $('layerWmsName').value
    }) === 'wms';
    const forceColor = isWms && $('layerForceWmsColor').checked;
    fieldset.classList.toggle('hidden', !isWms);
    fieldset.classList.toggle('is-off', isWms && !forceColor);
    $('layerWmsSymbolizer').disabled = !forceColor;
    $('layerWmsStyleName').disabled = !isWms || forceColor;
  }

  function notify(message, type = '') {
    const toast = $('suiteToast');
    if (!toast) return alert(message);
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => { toast.className = 'toast'; }, 3600);
  }




  function formatBytes(bytes = 0) {
    const value = Number(bytes || 0);
    if (!Number.isFinite(value) || value <= 0) return '0 MB';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = value;
    let index = 0;
    while (size >= 1024 && index < units.length - 1) { size /= 1024; index += 1; }
    return `${size.toLocaleString('pt-BR', { maximumFractionDigits: index < 2 ? 0 : 2 })} ${units[index]}`;
  }

  function formatAdvancedDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('pt-BR');
  }

  function compactUserAgent(value = '') {
    const text = String(value || '').trim();
    if (!text) return '—';
    const browser = /Edg\//.test(text) ? 'Edge' : /Chrome\//.test(text) ? 'Chrome' : /Firefox\//.test(text) ? 'Firefox' : /Safari\//.test(text) ? 'Safari' : 'Navegador';
    const os = /Windows/i.test(text) ? 'Windows' : /Android/i.test(text) ? 'Android' : /iPhone|iPad/i.test(text) ? 'iOS' : /Mac OS/i.test(text) ? 'macOS' : /Linux/i.test(text) ? 'Linux' : '';
    return `${browser}${os ? ' / ' + os : ''}`;
  }

  async function loadAdvancedAdminData() {
    // A 21.11.5 possui o painel organizado de Segurança e Sessões. Evita o loader legado
    // disparar as mesmas cinco chamadas novamente e sobrescrever a interface moderna.
    if (document.querySelector('.admin-security-organized')) return;
    const [dashboardRes, auditRes, sessionsRes, attemptsRes, settingsRes] = await Promise.allSettled([
      auth.apiFetch('/api/admin/dashboard', { method: 'GET', noCache: true }),
      auth.apiFetch('/api/admin/audit-logs?limit=2000', { method: 'GET', noCache: true }),
      auth.apiFetch('/api/admin/sessions', { method: 'GET', noCache: true }),
      auth.apiFetch('/api/admin/login-attempts?limit=200', { method: 'GET', noCache: true }),
      auth.apiFetch('/api/admin/security/settings', { method: 'GET', noCache: true })
    ]);
    if (dashboardRes.status === 'fulfilled') advancedDashboard = dashboardRes.value.dashboard || null;
    if (auditRes.status === 'fulfilled') advancedAuditLogs = auditRes.value.logs || [];
    if (sessionsRes.status === 'fulfilled') advancedSessions = sessionsRes.value.sessions || [];
    if (attemptsRes.status === 'fulfilled') securityAttempts = attemptsRes.value.attempts || [];
    if (settingsRes.status === 'fulfilled') securitySettings = settingsRes.value.settings || {};
    renderAdvancedAdmin();
    renderAdvancedSecurity();
  }

  function renderAdvancedAdmin() {
    if (!$('advProjectsCount')) return;
    const dash = advancedDashboard || {};
    const stats = dash.stats || {};
    const storage = dash.storage || {};
    const recent = dash.recent || {};
    $('advProjectsCount').textContent = Number(stats.projects || storage.projects || 0).toLocaleString('pt-BR');
    $('advDocumentsCount').textContent = Number(stats.documents || storage.documents || 0).toLocaleString('pt-BR');
    $('advStorageUsage').textContent = formatBytes(storage.totalBytes || 0);
    $('advAuditCount').textContent = Number(stats.auditLogs || advancedAuditLogs.length || 0).toLocaleString('pt-BR');
    const license = dash.licenses || {};
    const backups = dash.recent?.auditLogs?.filter?.((item) => /backup/i.test(item.action || '')) || [];
    $('advancedAuditTable').innerHTML = advancedAuditLogs.slice(0, 80).map((log) => `
      <tr><td>${formatAdvancedDateTime(log.createdAt)}</td><td><b>${escape(log.action || 'evento')}</b><small>${escape(log.message || compactUserAgent(log.userAgent) || '')}</small></td><td>${escape(log.actorEmail || log.email || log.actorUserId || '—')}</td><td>${escape(log.ip || '—')}</td><td><span class="status-pill ${log.status === 'failed' ? 'blocked' : 'active'}">${escape(log.status || 'ok')}</span></td></tr>`).join('') || '<tr><td colspan="5">Nenhum log registrado ainda.</td></tr>';
    $('advancedSessionsTable').innerHTML = advancedSessions.map((session) => `
      <tr><td><b>${escape(session.name || 'Usuário')}</b><small>${escape(session.email || '')}</small></td><td>${formatAdvancedDateTime(session.lastLoginAt)}</td><td>${formatAdvancedDateTime(session.lastLogoutAt || session.remoteLogoutAt)}</td><td><span class="status-pill ${escape(userStatusKey(session))}">${escape(userStatusLabel(session))}</span></td><td><button class="tiny-button danger-link" data-admin-logout-user="${escape(session.userId)}">Logout remoto</button></td></tr>`).join('') || '<tr><td colspan="5">Nenhuma sessão encontrada.</td></tr>';

    if ($('advStorageBreakdown')) {
      $('advStorageBreakdown').innerHTML = `
        <tr><td>Projetos</td><td>${Number(storage.projects || stats.projects || 0).toLocaleString('pt-BR')}</td><td>${formatBytes(storage.projectBytes || 0)}</td></tr>
        <tr><td>Documentos gerados</td><td>${Number(storage.documents || stats.documents || 0).toLocaleString('pt-BR')}</td><td>${formatBytes(storage.docBytes || 0)}</td></tr>
        <tr><td>Camadas</td><td>${Number(storage.layers || stats.layers || 0).toLocaleString('pt-BR')}</td><td>${formatBytes(storage.layerBytes || 0)}</td></tr>`;
    }
    if ($('advRecentProjectsTable')) {
      $('advRecentProjectsTable').innerHTML = (recent.projects || []).slice(0, 8).map((project) => `
        <tr><td><b>${escape(project.name || 'Projeto')}</b><small>${escape(project.municipality || '')}/${escape(project.state || '')}</small></td><td>${escape(project.ownerName || project.owner || '—')}</td><td>${formatAdvancedDateTime(project.updatedAt)}</td><td>${escape(project.status || 'ativo')}</td></tr>`).join('') || '<tr><td colspan="4">Nenhum projeto recente encontrado.</td></tr>';
    }
    if ($('advRecentDocumentsTable')) {
      $('advRecentDocumentsTable').innerHTML = (recent.documents || []).slice(0, 8).map((doc) => `
        <tr><td><b>${escape(doc.name || 'Documento')}</b><small>${escape(doc.id || '')}</small></td><td>${escape(doc.userId || '—')}</td><td>${formatAdvancedDateTime(doc.updatedAt)}</td></tr>`).join('') || '<tr><td colspan="3">Nenhum documento gerado encontrado.</td></tr>';
    }
  }

  function accessEventLabel(action = '') {
    const key = String(action || '').toLowerCase();
    if (key === 'login_success') return 'Entrou no sistema';
    if (key === 'login_failed') return 'Tentativa de login falhou';
    if (key === 'logout') return 'Saiu do sistema';
    if (key === 'remote_logout') return 'Saída remota pelo administrador';
    return action || 'Evento de acesso';
  }

  function renderAdvancedSecurity() {
    if (!$('securityAttemptsTable')) return;
    const attempts = Array.isArray(securityAttempts) ? securityAttempts : [];
    const failed = attempts.filter((item) => item.status === 'failed');
    const ips = Array.from(new Set(attempts.map((item) => String(item.ip || '').trim()).filter(Boolean)));
    $('securityAccessCount') && ($('securityAccessCount').textContent = `${attempts.length.toLocaleString('pt-BR')} evento(s)`);
    $('securityIpStatus') && ($('securityIpStatus').textContent = `${ips.length.toLocaleString('pt-BR')} IP(s)`);
    $('securityFailedCount') && ($('securityFailedCount').textContent = failed.length.toLocaleString('pt-BR'));
    $('securityLastEvent') && ($('securityLastEvent').textContent = attempts[0]?.createdAt ? formatAdvancedDateTime(attempts[0].createdAt) : '—');
    $('securityAttemptsTable').innerHTML = attempts.slice(0, 150).map((item) => `
      <tr><td>${formatAdvancedDateTime(item.createdAt)}</td><td>${escape(item.actorEmail || item.email || item.actorUserId || '—')}</td><td>${escape(accessEventLabel(item.action))}</td><td>${escape(item.ip || '—')}</td><td>${escape(compactUserAgent(item.userAgent))}</td><td><span class="status-pill ${item.status === 'failed' ? 'blocked' : 'active'}">${escape(item.status || 'ok')}</span></td></tr>`).join('') || '<tr><td colspan="6">Nenhuma tentativa registrada ainda.</td></tr>';
  }

  async function saveAdvancedSecuritySettings() {
    notify('A área de autenticação extra/assinatura digital está desativada por decisão do administrador. Use esta aba apenas para consulta de IPs, tentativas e status.', 'info');
  }

  async function createMetadataBackup() {
    const result = await auth.apiFetch('/api/admin/backups', { method: 'POST', body: JSON.stringify({}) });
    notify(`Inventário de metadados registrado: ${result.backup?.id || 'concluído'}. Isto não substitui um backup real do Appwrite/Google Drive.`);
    await loadAdvancedAdminData();
  }

  async function remoteLogoutUser(userId) {
    if (!userId || !confirm('Encerrar remotamente as sessões desse usuário? Ele precisará entrar novamente.')) return;
    await auth.apiFetch(`/api/admin/users/${encodeURIComponent(userId)}/logout-remote`, { method: 'POST', body: JSON.stringify({}) });
    notify('Logout remoto aplicado.');
    await loadAdvancedAdminData();
  }


  function setLayerImportProgress(visible, percent = 0, message = 'Aguardando arquivo...') {
    const box = $('layerImportProgress');
    if (!box) return;
    box.classList.toggle('hidden', !visible);
    $('layerImportProgressBar').value = Math.max(0, Math.min(100, Number(percent) || 0));
    $('layerImportProgressPercent').textContent = `${Math.max(0, Math.min(100, Math.round(Number(percent) || 0)))}%`;
    $('layerImportProgressText').textContent = message;
    $('cancelLayerImport').disabled = !layerImportBusy || percent >= 98;
  }

  function updateLayerImportProgress(progress = {}) {
    setLayerImportProgress(true, progress.percent || 0, progress.message || 'Processando camada...');
  }

  function renderStats() {
    $('adminUsersCount').textContent = users.length;
    $('adminActiveCount').textContent = users.filter((user) => user.status === 'active').length;
    $('adminPlansCount').textContent = plans.length;
    $('adminLayersCount').textContent = layers.filter((layer) => layer.status === 'ready' && layer.isPublic).length;
  }

  function userExpired(user = {}) {
    user = user && typeof user === 'object' ? user : {};
    if (!user.expiresAt) return false;
    const time = new Date(user.expiresAt).getTime();
    return Number.isFinite(time) && time < Date.now();
  }

  function userStatusKey(user = {}) {
    user = user && typeof user === 'object' ? user : {};
    const status = String(user.status || 'active').toLowerCase();
    if (status === 'blocked') return 'blocked';
    if (status === 'pending') return 'pending';
    if (status === 'expired' || userExpired(user)) return 'expired';
    return 'active';
  }

  function userStatusLabel(user = {}) {
    user = user && typeof user === 'object' ? user : {};
    return ({ active: 'Ativo', blocked: 'Bloqueado', expired: 'Expirado', pending: 'Pendente' }[userStatusKey(user)] || 'Ativo');
  }

  function userExpiryLabel(user = {}) {
    if (user?.isSubuser) {
      if (!user.expiresAt) return 'Compartilhado';
      const inherited = new Date(user.expiresAt);
      return Number.isNaN(inherited.getTime()) ? 'Compartilhado' : `Compartilhado · ${inherited.toLocaleDateString('pt-BR')}`;
    }
    if (!user.expiresAt) return 'Sem vencimento';
    const date = new Date(user.expiresAt);
    if (Number.isNaN(date.getTime())) return 'Data inválida';
    return date.toLocaleDateString('pt-BR');
  }

  function normalizeBrazilWhatsapp(value = '') {
    let digits = String(value || '').replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (!digits) return '';
    if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) digits = `55${digits}`;
    return digits.length === 12 || digits.length === 13 ? `+${digits}` : '';
  }

  function whatsappDisplay(user = {}) {
    return user.whatsappDisplay || user.phoneDisplay || user.whatsapp || user.phone || 'Não informado';
  }

  function whatsappHref(user = {}) {
    return String(user.whatsapp || user.phone || '').replace(/\D/g, '');
  }


  function userToggleLabel(user = {}) {
    user = user && typeof user === 'object' ? user : {};
    const status = userStatusKey(user);
    if (status === 'active') return 'Bloquear';
    if (status === 'blocked') return 'Desbloquear';
    return 'Ativar';
  }

  function userRoleLabel(user = {}) {
    if (user.isSubuser) {
      const workspaceRole = String(user.workspaceRole || 'collaborator').toLowerCase();
      return ({ manager: 'Gestor', technician: 'Técnico', collaborator: 'Colaborador' }[workspaceRole] || 'Colaborador');
    }
    return user.role === 'admin' ? 'Administrador' : user.role === 'manager' ? 'Gestor' : user.role === 'technician' ? 'Técnico' : 'Usuário';
  }

  function userIntegrityLabel(user = {}) {
    return ({
      auth_only: 'Conta criada parcialmente',
      profile_only: 'Perfil órfão',
      id_mismatch: 'Cadastro precisa ser reparado'
    }[user.integrityStatus] || '');
  }

  function userTeamCaption(user = {}) {
    if (user.profileIncomplete) return userIntegrityLabel(user) || 'Cadastro incompleto';
    if (user.isSubuser) return `Equipe: ${user.workspaceName || user.workspaceOwnerName || 'titular'}`;
    const summary = user.teamSummary || {};
    const included = summary.includedSeats == null ? '∞' : summary.includedSeats;
    return `Titular · ${summary.totalSeats || 1}/${included} licença(s)`;
  }

  const memorialModelRegistry = [
    { id:'standard', name:'Padrão do Surveyor', preview:'', restricted:false, description:'Modelo padrão disponível para todos os usuários com acesso ao Memorial.' },
    { id:'dourado', name:'Dourado', preview:'/assets/memorial-template-previews/01_Dourado.png', restricted:false, description:'Modelo personalizado oficial disponível para todos.' },
    { id:'ciano', name:'Ciano', preview:'/assets/memorial-template-previews/02_Ciano.png', restricted:false, description:'Modelo personalizado oficial disponível para todos.' },
    { id:'verde', name:'Verde', preview:'/assets/memorial-template-previews/03_Verde.png', restricted:false, description:'Modelo personalizado oficial disponível para todos.' },
    { id:'amarelo', name:'Amarelo', preview:'/assets/memorial-template-previews/04_Amarelo.png', restricted:false, description:'Modelo personalizado oficial disponível para todos.' },
    { id:'agro-mais', name:'Agro+', preview:'/assets/memorial-template-previews/05_AgroMais.png', restricted:true, description:'Modelo exclusivo com identidade visual Agro+ e página de assinaturas/confrontantes.' }
  ];

  function userMemorialTemplateIds(user={}){
    return Array.isArray(user.allowedMemorialTemplateIds) ? user.allowedMemorialTemplateIds.map(String) : [];
  }

  function renderMemorialModels(){
    const root=$('adminMemorialModels'); if(!root) return;
    root.innerHTML=memorialModelRegistry.map((model)=>{
      const eligibleUsers=users.filter((user)=>!user.isSubuser && user.id);
      const accessList=model.restricted
        ? `<div class="admin-model-access-list">${eligibleUsers.length?eligibleUsers.map((user)=>{
            const checked=userMemorialTemplateIds(user).includes(model.id);
            return `<label class="admin-model-user"><input type="checkbox" data-memorial-model-access="${escape(model.id)}" data-user-id="${escape(user.id)}" ${checked?'checked':''}><span><b>${escape(user.name||user.email||'Usuário')}</b><small>${escape(user.email||'')} · ${escape(user.planName||user.planSlug||'')}</small></span></label>`;
          }).join(''):'<p class="admin-empty-note">Nenhum usuário titular disponível.</p>'}</div>`
        : '<div class="admin-model-global-badge">Disponível para todos os usuários autorizados ao Memorial.</div>';
      return `<article class="admin-model-card ${model.restricted?'restricted':''}">
        <div class="admin-model-preview">${model.preview?`<img src="${model.preview}" alt="Prévia ${escape(model.name)}" loading="lazy">`:'<div class="admin-model-standard-preview">MEMORIAL<br>DESCRITIVO</div>'}</div>
        <div class="admin-model-body"><div class="admin-model-head"><div><span class="eyebrow">${model.restricted?'RESTRITO':'GLOBAL'}</span><h3>${escape(model.name)}</h3></div>${model.restricted?'<span class="admin-model-lock">Acesso individual</span>':''}</div><p>${escape(model.description)}</p>${accessList}</div>
      </article>`;
    }).join('');
  }

  function renderUsers() {
    const query = $('adminUserSearch').value.trim().toLowerCase();
    const filtered = users.filter((user) => !query || `${user.name} ${user.email} ${user.workspaceOwnerName || ''} ${user.whatsapp || user.phone || ''} ${user.whatsappDisplay || user.phoneDisplay || ''} ${userIntegrityLabel(user)}`.toLowerCase().includes(query));
    $('adminUsersTable').innerHTML = filtered.map((user) => {
      const planName = user.profileIncomplete
        ? 'Cadastro incompleto'
        : user.isSubuser
          ? 'Compartilhado'
          : (user.planName || plans.find((plan) => plan.id === user.planId)?.name || 'Sem plano');
      const planSlug = String(user.planSlug || plans.find((plan) => plan.id === user.planId)?.slug || '').toLowerCase();
      const workspaceAllowed = !user.profileIncomplete && (planSlug.startsWith('plus') || planSlug.startsWith('pro'));
      const authMissing = user.integrityStatus === 'profile_only';
      const editLabel = user.integrityStatus === 'auth_only'
        ? 'Concluir cadastro'
        : user.integrityStatus === 'id_mismatch'
          ? 'Reparar cadastro'
          : 'Renovar / editar';
      const teamButton = user.isSubuser
        ? `<button class="tiny-button" data-user-action="edit-subuser" data-id="${user.id}">Editar acesso</button>`
        : authMissing
          ? '<button class="tiny-button" type="button" disabled title="A conta de autenticação não existe">Conta ausente</button>'
          : `${workspaceAllowed
            ? `<button class="tiny-button primary-soft" data-user-action="team" data-id="${user.id}">Equipe</button>`
            : user.profileIncomplete
              ? ''
              : '<button class="tiny-button" type="button" disabled title="O plano Básico é individual">Plano individual</button>'}<button class="tiny-button" data-user-action="edit" data-id="${user.id}">${editLabel}</button>`;
      const emailChangeButton = !user.isSubuser && !authMissing && user.id !== admin.id
        ? `<button class="tiny-button email-change-button" data-user-action="change-email" data-id="${user.id}">Alterar e-mail</button>`
        : '';
      const removeButton = user.isSubuser
        ? `<button class="tiny-button danger-link" data-user-action="delete-subuser" data-id="${user.id}">Remover acesso</button>`
        : user.id !== admin.id
          ? `<button class="tiny-button danger-link" data-user-action="delete-user" data-id="${user.id}">Excluir usuário</button>`
          : '';
      const blockButton = !authMissing && user.id !== admin.id
        ? `<button class="tiny-button" data-user-action="toggle" data-id="${user.id}">${userToggleLabel(user)}</button>`
        : '';
      const verificationButton = !authMissing
        ? `<button class="tiny-button" data-user-action="verification" data-id="${user.id}" data-verified="${user.emailVerified ? '1' : '0'}">${user.emailVerified ? 'Resetar verificação' : 'Marcar verificado'}</button>`
        : '';
      const integrityBadge = user.profileIncomplete
        ? `<small class="user-integrity-badge">${escape(userIntegrityLabel(user) || 'Cadastro incompleto')}</small>`
        : '';
      return `<tr data-user-id="${escape(user.id)}" class="${user.isSubuser ? 'workspace-subuser-row' : 'workspace-owner-row'}${user.profileIncomplete ? ' user-integrity-warning' : ''}">
        <td><div class="user-cell"><span>${escape((user.name || '?').slice(0, 1).toUpperCase())}</span><div class="user-identity"><b class="user-name">${escape(user.name || 'Sem nome')}</b><small class="user-email">${escape(user.email || '')}</small>${integrityBadge}<small class="workspace-user-caption">${escape(userTeamCaption(user))}</small></div></div></td>
        <td><div class="whatsapp-cell">${whatsappHref(user) ? `<span class="phone-value">${escape(whatsappDisplay(user))}</span>` : '<span class="disabled-contact">Não informado</span>'}</div></td>
        <td>${escape(userRoleLabel(user))}</td>
        <td>${escape(planName)}${user.isSubuser ? `<small class="shared-plan-label">Assinatura e vencimento herdados de ${escape(user.workspaceOwnerName || 'titular')}</small>` : ''}</td>
        <td><span class="status-pill ${user.emailVerified ? 'active' : 'pending'}">${user.emailVerified ? 'Verificado' : 'Não verificado'}</span></td>
        <td>${userExpiryLabel(user)}</td>
        <td><div style="display:flex;flex-direction:column;gap:4px;align-items:flex-start"><span class="status-pill ${escape(userStatusKey(user))}">${escape(userStatusLabel(user))}</span></div></td>
        <td><div class="user-actions">${teamButton}${emailChangeButton}${blockButton}${verificationButton}${removeButton}</div></td>
      </tr>`;
    }).join('') || '<tr><td colspan="8">Nenhum usuário encontrado.</td></tr>';
  }


  function planBillingLabel(plan) {
    const value = String(plan.billing || plan.billingCycle || '').toLowerCase();
    if (value.includes('annual') || value.includes('anual')) return 'Anual';
    if (value.includes('month') || value.includes('mensal')) return 'Mensal';
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Plano';
  }

  const isDeprecatedPermission = (permission) => /^(orcamentos(?::|$)|docs:orcamentos$)/i.test(String(permission || ''));

  function planPermissionSummary(permissions = []) {
    const list = (Array.isArray(permissions) ? permissions : []).filter((permission) => !isDeprecatedPermission(permission));
    if (list.includes('*') || list.includes('admin:all')) return [{ label: 'Acesso completo', count: list.length || 1 }];
    const groups = [
      ['Mapa', /^map:/],
      ['Projetos', /^projects:/],
      ['Camadas', /^layers:/],
      ['Documentos', /^documents:/],
      ['Nuvem', /^cloud:/],
      ['CAR', /^car:/],
      ['SIG/Geometria', /^(sig:|geometry:)/],
      ['Terreno', /^(terrain:|planialtimetria:)/],
      ['Ambiental', /^ambiental:/],
      ['Loteamentos', /^loteamentos:/],
      ['Admin', /^admin:/],
      ['Segurança', /^security:/],
      ['Compartilhar', /^sharing:/],
      ['Suporte', /^support:/]
    ];
    const summary = [];
    const seen = new Set();
    for (const [label, pattern] of groups) {
      const matches = list.filter((permission) => pattern.test(String(permission)));
      if (matches.length) {
        summary.push({ label, count: matches.length });
        matches.forEach((permission) => seen.add(permission));
      }
    }
    const inherited = list.filter((permission) => /^(basic:\*|plus:\*)$/.test(String(permission)));
    if (inherited.length) summary.unshift({ label: inherited.includes('plus:*') ? 'Inclui Plus' : 'Inclui Básico', count: inherited.length });
    const otherCount = list.filter((permission) => !seen.has(permission) && !/^(basic:\*|plus:\*)$/.test(String(permission))).length;
    if (otherCount) summary.push({ label: 'Outras', count: otherCount });
    return summary.slice(0, 8);
  }

  function renderPlans() {
    $('plansGrid').innerHTML = plans.map((plan) => {
      const planPermissionList = (Array.isArray(plan.permissions) ? plan.permissions : []).filter((permission) => !isDeprecatedPermission(permission));
      const permissionSummary = planPermissionSummary(planPermissionList);
      const permissionBadges = permissionSummary.map((item) => `<span>${escape(item.label)} <b>${item.count}</b></span>`).join('');
      const allPermissionBadges = planPermissionList.slice(0, 80).map((permission) => `<span>${escape(permissionLabels[permission] || permission)}</span>`).join('');
      const storageText = plan.storageLimitBytes == null ? 'Sem limite' : `${(Number(plan.storageLimitBytes) / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} MB`;
      const projectText = plan.projectLimit == null ? '∞' : Number(plan.projectLimit).toLocaleString('pt-BR');
      const userText = plan.userLimit == null ? '∞' : Number(plan.userLimit).toLocaleString('pt-BR');
      const assignedUsers = users.filter((user) => !user.isSubuser && (user.planId === plan.id || user.planSlug === plan.slug || user.plan === plan.slug)).length;
      return `
      <article class="plan-card plan-card-v313 ${plan.active === false ? 'inactive-plan' : ''}" data-plan-id="${escape(plan.id)}">
        <div class="plan-top">
          <div class="plan-title-block">
            <span class="plan-billing-chip">${escape(planBillingLabel(plan))}</span>
            <h3>${escape(plan.name)}</h3>
          </div>
          <div class="plan-price-stack">
            <strong>${plan.price ? `R$ ${Number(plan.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Interno'}</strong>
            <small class="status-pill ${plan.active === false ? 'inactive' : 'active'}">${plan.active === false ? 'Inativo' : 'Ativo'}</small>
          </div>
        </div>
        <p class="plan-description">${escape(plan.description || 'Plano sem descrição.')}</p>
        <div class="plan-permission-summary">
          <strong>${planPermissionList.length || 0} permissões configuradas</strong>
          <div class="plan-permissions">${permissionBadges || '<span>Sem permissões específicas</span>'}</div>
        </div>
        ${planPermissionList.length ? `<details class="plan-permission-details"><summary>Ver permissões detalhadas</summary><div class="plan-permissions plan-permissions-detail">${allPermissionBadges}</div></details>` : ''}
        <div class="plan-meta">
          <small><b>${assignedUsers}</b> usuário(s)</small>
          <small><b>${projectText}</b> projetos</small>
          <small><b>${userText}</b> usuários</small>
          <small><b>${storageText}</b> armazenamento</small>
        </div>
        <div class="plan-actions">
          <button class="tiny-button" data-plan-action="edit">Editar</button>
          <button class="tiny-button ${plan.active === false ? '' : 'danger-link'}" data-plan-action="toggle">${plan.active === false ? 'Ativar' : 'Desativar'}</button>
          <button class="tiny-button danger" data-plan-action="delete">Excluir</button>
        </div>
      </article>`;
    }).join('') || '<div class="empty-box">Nenhum plano retornado pela API.</div>';
  }

  function normalizeLayerFilterText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function syncSelectedLayerGroupAction() {
    const groupButton = $('toggleSelectedLayerGroup');
    if (!groupButton) return;
    const selectedGroup = layerGroups.find((group) => String(group?.id) === String(layerFilterGroup));
    const visible = Boolean(selectedGroup && layerFilterGroup !== 'all');
    const systemManaged = Boolean(selectedGroup?.systemManaged || selectedGroup?.readOnly);
    groupButton.classList.toggle('hidden', !visible || systemManaged);
    groupButton.disabled = !visible || systemManaged;
    if (!visible || systemManaged) return;
    const published = String(selectedGroup.status || 'active') === 'active';
    groupButton.textContent = published ? 'Despublicar grupo' : 'Publicar grupo';
    groupButton.classList.toggle('danger', published);
    groupButton.classList.toggle('primary', !published);
    groupButton.dataset.groupPublished = String(published);
    groupButton.title = published
      ? `Ocultar o grupo ${selectedGroup.name || ''} e todas as camadas dos usuários`
      : `Publicar o grupo ${selectedGroup.name || ''} e suas camadas disponíveis`;
  }

  function populateLayerFilters() {
    const select = $('adminLayerGroupFilter');
    if (!select) return;
    const current = layerFilterGroup || select.value || 'all';
    const grouped = [...new Map(layerGroups.map((group) => [group.id, group])).values()]
      .filter((group) => group?.id)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
    select.innerHTML = `<option value="all">Todos os grupos</option>${grouped.map((group) => `<option value="${escape(group.id)}">${escape(group.name || 'Sem nome')}</option>`).join('')}`;
    select.value = grouped.some((group) => group.id === current) ? current : 'all';
    layerFilterGroup = select.value;
    syncSelectedLayerGroupAction();
  }

  function layerMatchesAdminFilter(layer) {
    if (layerFilterGroup !== 'all' && layer.groupId !== layerFilterGroup) return false;
    const term = normalizeLayerFilterText(layerFilterText);
    if (!term) return true;
    const metadata = layer.metadata || {};
    const searchText = normalizeLayerFilterText([
      layer.name,
      layer.slug,
      layer.groupName,
      layer.sourceName,
      layer.serviceType,
      layer.description,
      metadata.layerName,
      metadata.layers,
      metadata.officialWmsTitle,
      metadata.officialCatalogGroup,
      metadata.remoteOriginalServiceType
    ].filter(Boolean).join(' '));
    return searchText.includes(term);
  }

  function renderLayers() {
    const visibleLayers = layers.filter(layerMatchesAdminFilter);
    const count = $('adminLayerFilterCount');
    if (count) count.textContent = `${visibleLayers.length.toLocaleString('pt-BR')} de ${layers.length.toLocaleString('pt-BR')} camada(s)`;
    $('adminLayersList').innerHTML = visibleLayers.map((layer) => {
      const available = layer.status === 'ready' && layer.isPublic;
      const systemManaged = Boolean(layer.systemManaged || layer.readOnly || layer.metadata?.virtualOfficialLayer || layer.metadata?.managedBySystem);
      const upload = layer.sourceUpload;
      const processing = upload && ['uploading', 'queued', 'processing'].includes(upload.status);
      const spatial = layer.spatialIndex;
      const spatialProcessing = spatial && ['queued', 'building'].includes(spatial.status);
      const spatialReady = spatial?.status === 'ready';
      const size = layer.dataSizeBytes ? `${(layer.dataSizeBytes / 1024 / 1024).toFixed(2)} MB` : 'serviço externo';
      const statusText = processing
        ? `${upload.message || 'Processando camada...'} (${Number(upload.progress || 0)}%)`
        : upload?.status === 'error'
          ? `Erro no processamento: ${upload.error || upload.message || 'verifique o log da API'}`
          : spatialProcessing
            ? `${spatial.message || 'Criando índice espacial...'} (${Number(spatial.progress || 0)}%)`
            : spatial?.status === 'error'
              ? `Erro na otimização: ${spatial.error || spatial.message || 'tente novamente'}`
              : layer.dataAvailable
                ? `GeoJSON no Appwrite • ${size}${spatialReady ? ' • MAPA OTIMIZADO' : ' • precisa otimizar para o mapa'}`
                : layer.serviceUrl ? 'Serviço remoto configurado' : 'Aguardando arquivo ou URL';
      const stateLabel = systemManaged ? 'Oficial · Sistema' : available ? 'Publicada' : processing ? 'Processando' : upload?.status === 'error' ? 'Erro' : layer.status === 'draft' ? 'Rascunho' : escape(layer.status);
      return `<article class="admin-layer-card" data-id="${layer.id}">
        <span class="layer-color" style="background:${escape(layer.style?.color || layer.style?.fillColor || '#3974d8')}"></span>
        <div class="admin-layer-copy">
          <b>${escape(layer.name)}</b>
          <small>${escape(layer.groupName || 'Sem grupo')} • ${escape(layer.sourceName || 'GeoRural')} • ${escape(layer.serviceType)} • ${Number(layer.featureCount || 0).toLocaleString('pt-BR')} elemento(s)</small>
          <em class="${upload?.status === 'error' ? 'layer-error-text' : ''}">${escape(statusText)}</em>
          ${processing ? `<progress class="layer-card-progress" max="100" value="${Math.max(0, Math.min(100, Number(upload.progress || 0)))}"></progress>` : ''}
          ${spatialProcessing ? `<progress class="layer-card-progress" max="100" value="${Math.max(0, Math.min(100, Number(spatial.progress || 0)))}"></progress>` : ''}
        </div>
        <span class="layer-state ${systemManaged || available ? 'ready' : processing ? 'processing' : upload?.status === 'error' ? 'error' : 'planned'}">${stateLabel}</span>
        <div class="admin-layer-actions">
          ${systemManaged
            ? `<span class="admin-layer-system-note">Gerenciada pelo catálogo oficial • ${escape(layer.metadata?.stateCode || layer.metadata?.sourceSystem || 'Surveyor')}</span>`
            : `<button class="tiny-button" data-layer-action="edit" ${processing ? 'disabled' : ''}>Editar</button>
               <button class="tiny-button" data-layer-action="publish" ${processing || !layer.dataAvailable && !layer.serviceUrl ? 'disabled' : ''}>${available ? 'Despublicar' : 'Publicar'}</button>
               ${layer.dataAvailable && !spatialReady && !processing ? `<button class="tiny-button" data-layer-action="spatial-index" ${spatialProcessing ? 'disabled' : ''}>${spatialProcessing ? 'Otimizando...' : 'Otimizar mapa'}</button>` : ''}
               ${processing ? '<button class="tiny-button danger-link" data-layer-action="cancel-import">Cancelar importação</button>' : ''}
               ${spatialProcessing ? '<button class="tiny-button danger-link" data-layer-action="cancel-spatial">Cancelar otimização</button>' : ''}
               <button class="tiny-button danger-link" data-layer-action="archive">Arquivar</button>`}
        </div>
      </article>`;
    }).join('') || (layers.length ? '<div class="empty-box">Nenhuma camada encontrada com esse filtro. Tente outro grupo ou termo, como PCT, APP, assentamento ou nome técnico.</div>' : '<div class="empty-box">Nenhuma camada cadastrada. Crie um grupo e adicione a primeira camada.</div>');
  }



  function noticeTypeLabel(type) {
    return ({ info: 'Informação', success: 'Sucesso', warning: 'Aviso', danger: 'Urgente', maintenance: 'Manutenção' }[type] || 'Aviso');
  }

  function noticeDeliveryLabel(value) {
    return ({ notification: 'Sino/notificação', popup: 'Pop-up', banner: 'Faixa fixa', release: 'Novidades da versão', 'login-expiration': 'Aviso de login' }[value] || value || 'Notificação');
  }

  function noticeAudienceLabel(notice = {}) {
    if (notice.audience === 'plan') return `Plano: ${escape(notice.targetPlanSlug || 'não informado')}`;
    if (notice.audience === 'user') {
      const target = users.find((user) => user.id === notice.targetUserId);
      return `Usuário: ${escape(target?.name || notice.targetUserId || 'não informado')}`;
    }
    return ({ all: 'Todos', users: 'Usuários comuns', admins: 'Administradores' }[notice.audience] || 'Todos');
  }

  function formatDateTime(value) {
    if (!value) return 'Sem limite';
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Data inválida';
  }

  function toDateTimeLocal(value) {
    if (!value) return '';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }

  function readDateTimeLocal(id) {
    const value = $(id)?.value || '';
    if (!value) return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }

  const releaseSlideState = [];

  function normalizeReleaseSlides(slides = []) {
    return (Array.isArray(slides) ? slides : [])
      .map((slide, index) => ({
        id: slide.id || `slide-${index + 1}`,
        title: String(slide.title || '').trim(),
        description: String(slide.description || slide.text || '').trim(),
        imageDataUrl: String(slide.imageDataUrl || slide.imageUrl || '').trim(),
        imageName: String(slide.imageName || slide.fileName || '').trim(),
        eyebrow: String(slide.eyebrow || '').trim()
      }))
      .filter((slide) => slide.title || slide.description || slide.imageDataUrl);
  }

  function setNoticeMode(mode = 'notification') {
    const safeMode = ['notification', 'popup', 'banner', 'maintenance', 'release', 'login-expiration'].includes(mode) ? mode : 'notification';
    if ($('noticeComposerMode')) $('noticeComposerMode').value = safeMode;
    document.querySelectorAll('[data-notice-mode]').forEach((button) => button.classList.toggle('active', button.dataset.noticeMode === safeMode));
    const isRelease = safeMode === 'release';
    $('releaseNoticeBuilder')?.classList.toggle('hidden', !isRelease);
    if (safeMode === 'maintenance') {
      $('noticeType').value = 'maintenance';
      $('noticeDelivery').value = $('noticeBlocksApp')?.checked ? 'banner' : 'popup';
    } else if (isRelease) {
      $('noticeType').value = 'success';
      $('noticeDelivery').value = 'release';
      $('noticeRequiresAck').checked = true;
      $('noticeBlocksApp').checked = false;
      if (!$('noticeTitle').value.trim()) $('noticeTitle').value = 'Atualização concluída!';
      if (!$('noticeMessage').value.trim()) $('noticeMessage').value = 'Veja as principais novidades adicionadas ao Surveyor.';
      if (!$('releaseFinalButton').value.trim()) $('releaseFinalButton').value = 'Começar a usar';
      if (!releaseSlideState.length) addReleaseSlide({ title: 'Nova atualização disponível', description: 'Confira as melhorias desta versão.' });
    } else if (safeMode === 'login-expiration') {
      $('noticeType').value = 'warning';
      $('noticeDelivery').value = 'notification';
      $('noticeAudience').value = 'user';
      $('noticeRequiresAck').checked = false;
      $('noticeBlocksApp').checked = false;
      if (!$('noticeTitle').value.trim()) $('noticeTitle').value = 'Seu login está perto de expirar';
      if (!$('noticeMessage').value.trim()) $('noticeMessage').value = 'Olá, {nome}. Seu login/plano vence em {dias}. Se não quiser perder seu acesso, contate o administrador para renovar seu plano.';
      updateNoticeTargetVisibility();
    } else {
      $('noticeDelivery').value = safeMode;
      if ($('noticeType').value === 'maintenance') $('noticeType').value = 'info';
    }
    renderNotices();
  }

  function renderReleaseSlides() {
    const list = $('releaseSlidesList');
    if (!list) return;
    list.innerHTML = releaseSlideState.map((slide, index) => `
      <article class="release-slide-editor" data-release-slide-index="${index}">
        <div class="release-slide-number">${index + 1}</div>
        <div class="release-slide-fields">
          <label>Título do slide<input class="release-slide-title" value="${escape(slide.title || '')}" placeholder="Ex.: Acesse rapidamente os novos recursos"></label>
          <label>Texto do slide<textarea class="release-slide-description" rows="3" placeholder="Explique a novidade de forma objetiva...">${escape(slide.description || '')}</textarea></label>
          <label>Imagem/print<input class="release-slide-file" type="file" accept="image/png,image/jpeg,image/webp"><small>${slide.imageName ? `Imagem atual: ${escape(slide.imageName)}` : 'Envie um print leve da atualização.'}</small></label>
        </div>
        <div class="release-slide-preview ${slide.imageDataUrl ? '' : 'is-empty'}">${slide.imageDataUrl ? `<img src="${escape(slide.imageDataUrl)}" alt="Prévia do slide ${index + 1}">` : '<span>Sem imagem</span>'}</div>
        <div class="release-slide-actions"><button type="button" class="tiny-button" data-release-slide-up>↑</button><button type="button" class="tiny-button" data-release-slide-down>↓</button><button type="button" class="tiny-button danger-link" data-release-slide-remove>Remover</button></div>
      </article>
    `).join('') || '<div class="empty-box">Nenhum slide cadastrado. Clique em “Adicionar slide”.</div>';
  }

  function addReleaseSlide(slide = {}) {
    releaseSlideState.push({ id: slide.id || `slide-${Date.now()}-${releaseSlideState.length}`, title: slide.title || '', description: slide.description || '', imageDataUrl: slide.imageDataUrl || '', imageName: slide.imageName || '' });
    renderReleaseSlides();
  }

  function syncReleaseSlideFromInputs(row) {
    const index = Number(row?.dataset?.releaseSlideIndex);
    if (!Number.isInteger(index) || !releaseSlideState[index]) return null;
    releaseSlideState[index].title = row.querySelector('.release-slide-title')?.value || '';
    releaseSlideState[index].description = row.querySelector('.release-slide-description')?.value || '';
    return releaseSlideState[index];
  }

  function syncAllReleaseSlides() {
    document.querySelectorAll('[data-release-slide-index]').forEach(syncReleaseSlideFromInputs);
  }

  function fileToOptimizedDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve({ imageDataUrl: '', imageName: '' });
      if (!String(file.type || '').startsWith('image/')) return reject(new Error('Envie apenas imagens PNG, JPG ou WebP.'));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Imagem inválida.'));
        img.onload = () => {
          const maxWidth = 1400;
          const maxHeight = 900;
          const scale = Math.min(1, maxWidth / img.width, maxHeight / img.height);
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const imageDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          resolve({ imageDataUrl, imageName: file.name || 'imagem.jpg' });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function populateNoticeTargets() {
    if ($('noticePlan')) {
      $('noticePlan').innerHTML = plans.filter((plan) => plan.slug).map((plan) => `<option value="${escape(plan.slug)}">${escape(plan.name)}</option>`).join('');
    }
    if ($('noticeUser')) {
      $('noticeUser').innerHTML = users.map((user) => `<option value="${escape(user.id)}">${escape(user.name)} — ${escape(user.email)}</option>`).join('');
    }
  }

  function updateNoticeTargetVisibility() {
    const audience = $('noticeAudience')?.value || 'all';
    $('noticePlanWrap')?.classList.toggle('hidden', audience !== 'plan');
    $('noticeUserWrap')?.classList.toggle('hidden', audience !== 'user');
  }

  function clearNoticeForm() {
    $('editNoticeId').value = '';
    $('noticeTitle').value = '';
    $('noticeMessage').value = '';
    $('noticeType').value = 'info';
    $('noticeDelivery').value = 'notification';
    $('noticeAudience').value = 'all';
    $('noticeStarts').value = '';
    $('noticeEnds').value = '';
    $('noticeActive').value = '1';
    $('noticeRequiresAck').checked = false;
    $('noticeBlocksApp').checked = false;
    $('releaseVersion').value = '';
    $('releaseTheme').value = 'surveyor';
    $('releaseFinalButton').value = '';
    releaseSlideState.splice(0, releaseSlideState.length);
    renderReleaseSlides();
    $('noticeSubmitBtn').textContent = 'Enviar aviso';
    setNoticeMode('notification');
    updateNoticeTargetVisibility();
  }

  function openNotice(notice = null) {
    populateNoticeTargets();
    $('editNoticeId').value = notice?.id || '';
    $('noticeTitle').value = notice?.title || '';
    $('noticeMessage').value = notice?.message || '';
    $('noticeType').value = notice?.type || 'info';
    $('noticeDelivery').value = notice?.deliveryMode || 'notification';
    $('noticeAudience').value = notice?.audience || 'all';
    if ($('noticePlan') && notice?.targetPlanSlug) $('noticePlan').value = notice.targetPlanSlug;
    if ($('noticeUser') && notice?.targetUserId) $('noticeUser').value = notice.targetUserId;
    $('noticeStarts').value = toDateTimeLocal(notice?.startsAt);
    $('noticeEnds').value = toDateTimeLocal(notice?.endsAt);
    $('noticeActive').value = notice?.isActive === false ? '0' : '1';
    $('noticeRequiresAck').checked = Boolean(notice?.requiresAck);
    $('noticeBlocksApp').checked = Boolean(notice?.blocksApp);
    const metadata = notice?.metadata && typeof notice.metadata === 'object' ? notice.metadata : {};
    $('releaseVersion').value = metadata.releaseVersion || metadata.version || '';
    $('releaseTheme').value = metadata.releaseTheme || metadata.theme || 'surveyor';
    $('releaseFinalButton').value = metadata.releaseFinalButton || 'Começar a usar';
    releaseSlideState.splice(0, releaseSlideState.length, ...normalizeReleaseSlides(metadata.slides || []));
    renderReleaseSlides();
    $('noticeSubmitBtn').textContent = notice ? 'Salvar aviso' : 'Enviar aviso';
    setNoticeMode(notice?.deliveryMode === 'release' ? 'release' : (notice?.blocksApp ? 'maintenance' : notice?.deliveryMode || 'notification'));
    updateNoticeTargetVisibility();
    document.querySelector('[data-tab="notices"]')?.click();
    $('noticeTitle')?.focus();
  }

  function prefillMaintenanceNotice({ block = false } = {}) {
    populateNoticeTargets();
    clearNoticeForm();
    const now = new Date();
    const start = new Date(now);
    start.setHours(13, 30, 0, 0);
    if (start < now) start.setDate(start.getDate() + 1);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    $('noticeTitle').value = block ? 'Sistema em manutenção' : 'Manutenção programada';
    $('noticeMessage').value = block
      ? 'O GeoRural Pro está em manutenção para atualização. O acesso ficará temporariamente bloqueado. Previsão de início: 13:30.'
      : 'A manutenção do GeoRural Pro irá iniciar às 13:30. Salve seus projetos antes desse horário.';
    $('noticeType').value = 'maintenance';
    $('noticeDelivery').value = block ? 'banner' : 'popup';
    $('noticeAudience').value = 'users';
    $('noticeStarts').value = toDateTimeLocal(start.toISOString());
    $('noticeEnds').value = toDateTimeLocal(end.toISOString());
    $('noticeRequiresAck').checked = !block;
    $('noticeBlocksApp').checked = block;
    setNoticeMode('maintenance');
    updateNoticeTargetVisibility();
  }

  function noticePayloadFromForm() {
    const audience = $('noticeAudience').value;
    const composerMode = currentNoticeModeFilter();
    const deliveryMode = $('noticeBlocksApp').checked ? 'banner' : $('noticeDelivery').value;
    syncAllReleaseSlides();
    const isRelease = deliveryMode === 'release';
    const slides = normalizeReleaseSlides(releaseSlideState);
    const metadataBase = {
      createdFrom: 'admin-v21.9.281',
      noticeMode: composerMode,
      kind: composerMode === 'login-expiration' ? 'login_expiration' : (composerMode === 'maintenance' ? 'maintenance' : composerMode)
    };
    return {
      title: $('noticeTitle').value.trim(),
      message: $('noticeMessage').value.trim(),
      type: isRelease ? 'success' : $('noticeType').value,
      deliveryMode,
      audience,
      targetPlanSlug: audience === 'plan' ? $('noticePlan').value : null,
      targetUserId: audience === 'user' ? $('noticeUser').value : null,
      startsAt: readDateTimeLocal('noticeStarts'),
      endsAt: readDateTimeLocal('noticeEnds'),
      requiresAck: isRelease ? true : $('noticeRequiresAck').checked,
      blocksApp: isRelease ? false : $('noticeBlocksApp').checked,
      isActive: $('noticeActive').value === '1',
      metadata: isRelease ? {
        ...metadataBase,
        kind: 'release_notes',
        releaseVersion: $('releaseVersion').value.trim(),
        releaseTheme: $('releaseTheme').value || 'surveyor',
        releaseFinalButton: $('releaseFinalButton').value.trim() || 'Começar a usar',
        slides
      } : metadataBase
    };
  }

  function noticeModeForList(notice = {}) {
    const metadata = notice.metadata && typeof notice.metadata === 'object' ? notice.metadata : {};
    const storedMode = String(metadata.noticeMode || metadata.kind || '').toLowerCase().replace(/_/g, '-');
    const delivery = String(notice.deliveryMode || notice.delivery || 'notification').toLowerCase();
    const type = String(notice.type || '').toLowerCase();
    const title = String(notice.title || '').toLowerCase();
    const message = String(notice.message || '').toLowerCase();

    if (storedMode === 'release-notes' || storedMode === 'release' || delivery === 'release') return 'release';
    if (storedMode === 'login-expiration' || storedMode === 'login-expiration-auto' || delivery === 'login-expiration') return 'login-expiration';
    if (storedMode === 'maintenance' || notice.blocksApp || type === 'maintenance') return 'maintenance';
    if (!storedMode && delivery === 'notification' && (title.includes('login') || title.includes('plano') || message.includes('login/plano') || message.includes('renovar seu plano') || message.includes('expirar'))) return 'login-expiration';
    if (delivery === 'popup') return 'popup';
    if (delivery === 'banner') return 'banner';
    return 'notification';
  }

  function currentNoticeModeFilter() {
    const mode = $('noticeComposerMode')?.value || 'notification';
    return ['notification', 'popup', 'banner', 'maintenance', 'release', 'login-expiration'].includes(mode) ? mode : 'notification';
  }

  function filteredNoticesForCurrentMode() {
    const mode = currentNoticeModeFilter();
    return notices.filter((notice) => noticeModeForList(notice) === mode);
  }

  function renderNotices() {
    const table = $('adminNoticesTable');
    if (!table) return;
    const mode = currentNoticeModeFilter();
    const filtered = filteredNoticesForCurrentMode();
    const emptyText = `Nenhum aviso cadastrado para ${noticeDeliveryLabel(mode)}.`;
    table.innerHTML = filtered.map((notice) => `
      <tr data-notice-id="${escape(notice.id)}">
        <td><div class="notice-cell"><b>${escape(notice.title)}</b><small>${escape(notice.message).slice(0, 150)}${String(notice.message || '').length > 150 ? '...' : ''}</small></div></td>
        <td><span class="status-pill ${notice.blocksApp ? 'danger' : escape(noticeModeForList(notice) === 'release' ? 'success' : notice.type)}">${notice.blocksApp ? 'Bloqueio' : escape(noticeDeliveryLabel(noticeModeForList(notice)))}</span></td>
        <td>${noticeAudienceLabel(notice)}</td>
        <td><small>${escape(formatDateTime(notice.startsAt))}<br>até ${escape(formatDateTime(notice.endsAt))}</small></td>
        <td><span class="status-pill ${notice.isActive ? 'active' : 'blocked'}">${notice.isActive ? 'Ativo' : 'Inativo'}</span></td>
        <td class="notice-actions"><button class="tiny-button" data-notice-action="edit">Editar</button><button class="tiny-button" data-notice-action="toggle">${notice.isActive ? 'Desativar' : 'Ativar'}</button><button class="tiny-button danger-link" data-notice-action="archive">Arquivar</button><button class="tiny-button danger-link" data-notice-action="delete">Excluir</button></td>
      </tr>`).join('') || `<tr><td colspan="6">${escape(emptyText)}</td></tr>`;
  }


  function populatePlans() {
    const availablePlans = plans.filter((plan) => plan.active !== false && plan.slug);
    $('userPlan').innerHTML = availablePlans.map((plan) => `<option value="${escape(plan.slug)}">${escape(plan.name)}</option>`).join('');
  }

  function validLayerGroups() {
    return layerGroups.filter((group) => validSqlGuid(group?.id));
  }

  function populateLayerGroups() {
    const groups = validLayerGroups();
    $('layerGroup').innerHTML = groups.map((group) => `<option value="${escape(group.id)}">${escape(group.name)}</option>`).join('');
  }

  function populateAllowedPlans(selected = ['*']) {
    const values = Array.isArray(selected) && selected.length ? selected : ['*'];
    $('layerAllowedPlans').innerHTML = `
      <label><input type="checkbox" value="*" ${values.includes('*') ? 'checked' : ''}><span>Todos os planos</span></label>
      ${plans.filter((plan) => plan.slug !== 'administrador').map((plan) => `<label><input type="checkbox" value="${escape(plan.slug)}" ${values.includes(plan.slug) ? 'checked' : ''}><span>${escape(plan.name)}</span></label>`).join('')}`;
  }

  function bytesToMb(value) {
    return value == null ? '' : String(Math.round(Number(value) / 1024 / 1024));
  }

  function mbToBytes(value) {
    if (value == null || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number * 1024 * 1024) : null;
  }

  function validateNewUser(payload) {
    if (!payload.name || payload.name.length < 3) throw new Error('Informe o nome completo do usuário.');
    if (!payload.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) throw new Error('Informe um e-mail válido.');
    if (!payload.password || payload.password.length < 12) throw new Error('A senha deve ter pelo menos 12 caracteres.');
    if (!payload.planSlug) throw new Error('Selecione um plano para o usuário.');
    if (payload.whatsapp && !normalizeBrazilWhatsapp(payload.whatsapp)) throw new Error('Informe um WhatsApp válido com DDD.');
    if (payload.whatsappOptIn && !payload.whatsapp) throw new Error('Informe o WhatsApp ou desative a autorização de contato.');
  }

  function fillGeneratedUserPassword() {
    const field = $('userPassword');
    if (!field) return '';
    const password = generateStrongPassword(14);
    field.value = password;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.focus();
    field.select();
    notify('Senha temporária segura gerada. O usuário poderá entrar com ela e receberá um aviso fixo para alterá-la.', 'success');
    return password;
  }

  async function copyUserPassword() {
    const password = String($('userPassword')?.value || '');
    if (!password) throw new Error('Gere ou informe uma senha antes de copiar.');
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(password);
    else {
      const field = $('userPassword');
      field.focus(); field.select();
      if (!document.execCommand('copy')) throw new Error('Não foi possível copiar automaticamente.');
    }
    notify('Senha copiada.', 'success');
  }

  function openUserEmailChange(user = {}) {
    if (!user?.id || !user?.email) return notify('Não foi possível identificar a conta selecionada.', 'error');
    $('emailChangeUserId').value = user.id;
    $('emailChangeUserName').textContent = user.name || 'Usuário';
    $('emailChangeCurrent').textContent = user.email;
    $('emailChangeNew').value = '';
    $('emailChangeVerified').checked = true;
    $('emailChangeNotifyNew').checked = true;
    $('emailChangeNotifyOld').checked = true;
    $('emailChangeConfirm').checked = false;
    $('userEmailDialog').showModal();
    setTimeout(() => $('emailChangeNew')?.focus(), 50);
  }

  function checkedPermissions(containerId) {
    const checked = [...$(containerId).querySelectorAll('input:checked')].map((input) => input.value);
    return checked.includes('*') ? ['*'] : checked;
  }

  function setCheckedPermissions(containerId, values = []) {
    const selected = Array.isArray(values) ? values : [];
    const hasFullAccess = selected.includes('*');
    [...$(containerId).querySelectorAll('input')].forEach((input) => {
      input.checked = hasFullAccess ? input.value === '*' : selected.includes(input.value);
      input.disabled = hasFullAccess && input.value !== '*';
    });
  }

  function permissionValues(...groups) {
    return [...new Set(groups.flatMap((groupName) => Object.keys(permissionGroups[groupName]?.items || {})))];
  }

  const planPresets = {
    "basic_monthly": {
        "name": "Surveyor Básico Mensal (legado)",
        "slug": "basic_monthly",
        "priceCents": 3990,
        "billingCycle": "mensal",
        "projectLimit": null,
        "userLimit": 1,
        "storageLimitBytes": 209715200,
        "isActive": false,
        "description": "Plano de entrada: Mapa e cadastro, documentos técnicos, acervos oficiais e Nuvem. Google Drive é infraestrutura interna, não recurso comercial.",
        "permissions": [
                        "map:access",
            "map:view",
            "map:create-basic",
            "map:draw-basic",
            "map:measure-basic",
            "projects:access",
            "projects:create",
            "projects:edit-own",
            "projects:view-own",
            "projects:export",
            "projects:export-basic",
            
            "layers:official",
            "layers:official-basic",
            "layers:view-basic",
            "documents:memorial",
            "documents:memorial-basic",
            "documents:ods",
            "documents:ods-basic",
            "documents:confrontacao",
            "documents:confrontacao-basic",
            "documents:mapas",
            "documents:mapas-basic",
            "documents:pranchas",
            "documents:pranchas-basic",
            "documents:download",
            "cloud:access",
            "cloud:view-own",
            "cloud:basic",
            "support:standard"
        ]
    },
    "plus_monthly": {
        "name": "Surveyor Plus Mensal (legado)",
        "slug": "plus_monthly",
        "priceCents": 6990,
        "billingCycle": "mensal",
        "projectLimit": null,
        "userLimit": 2,
        "storageLimitBytes": 524288000,
        "isActive": false,
        "description": "Plano profissional: tudo do Básico, CAR, WMS/WFS, edição geométrica, SIG/terreno, ambiental, loteamentos/REURB e compartilhamento seguro.",
        "permissions": [
                        "basic:*",
            "car:access",
            "car:full",
            "layers:catalog",
            "layers:catalog-full",
            "layers:view-full",
            "layers:wms-wfs",
            "geometry:access",
            "geometry:edit-basic",
            "geometry:offset",
            "geometry:rotate",
            "geometry:scale",
            "geometry:mirror",
            "geometry:vertices-edit",
            "sig:access",
            "sig:basic",
            "terrain:access",
            "terrain:basic",
            "ambiental:access",
            "ambiental:basic",
            "loteamentos:access",
            "loteamentos:basic",
            "documents:perimetros",
            "documents:perimetros-full",
            "documents:planialtimetria",
            "documents:planialtimetria-basic",
            "sharing:readonly",
            "sharing:password",
            "sharing:expires"
        ]
    },
    "pro_monthly": {
        "name": "Surveyor Pro Mensal (legado)",
        "slug": "pro_monthly",
        "priceCents": 11990,
        "billingCycle": "mensal",
        "projectLimit": null,
        "userLimit": 4,
        "storageLimitBytes": 1073741824,
        "isActive": false,
        "description": "Plano completo para operação técnica: tudo do Plus, projetos ilimitados, até 4 acessos totais (titular + 3 membros) e 100 GB, gestão do próprio espaço de trabalho, versões, compartilhamento avançado e suporte prioritário. Adicionais e white label são contratados separadamente.",
        "permissions": [
            "plus:*",
            "projects:unlimited",
            "projects:trash",
            "projects:lock",
            "projects:version-full",
            "projects:templates",
            "projects:export-zip",
            "geometry:advanced",
            "sig:advanced",
            "terrain:advanced",
            "ambiental:full",
            "loteamentos:full",
            "planialtimetria:full",
            "sharing:full",
            "sharing:revoke",
            "sharing:access-limit",
            "workspace:members",
            "workspace:settings",
            "workspace:storage",
            "workspace:audit-own",
            "security:account-monitoring",
            "cloud:pro",
            "support:priority"
        ]
    },
    "basic_annual": {
        "name": "Surveyor Básico Anual",
        "slug": "basic_annual",
        "priceCents": 39900,
        "billingCycle": "anual",
        "projectLimit": null,
        "userLimit": 1,
        "storageLimitBytes": 209715200,
        "isActive": true,
        "description": "Plano anual de entrada: Mapa e cadastro, documentos técnicos, acervos oficiais e Nuvem. Google Drive é infraestrutura interna, não recurso comercial.",
        "permissions": [
                        "map:access",
            "map:view",
            "map:create-basic",
            "map:draw-basic",
            "map:measure-basic",
            "projects:access",
            "projects:create",
            "projects:edit-own",
            "projects:view-own",
            "projects:export",
            "projects:export-basic",
            
            "layers:official",
            "layers:official-basic",
            "layers:view-basic",
            "documents:memorial",
            "documents:memorial-basic",
            "documents:ods",
            "documents:ods-basic",
            "documents:confrontacao",
            "documents:confrontacao-basic",
            "documents:mapas",
            "documents:mapas-basic",
            "documents:pranchas",
            "documents:pranchas-basic",
            "documents:download",
            "cloud:access",
            "cloud:view-own",
            "cloud:basic",
            "support:standard"
        ]
    },
    "plus_annual": {
        "name": "Surveyor Plus Anual",
        "slug": "plus_annual",
        "priceCents": 69900,
        "billingCycle": "anual",
        "projectLimit": null,
        "userLimit": 2,
        "storageLimitBytes": 524288000,
        "isActive": true,
        "description": "Plano anual profissional: CAR, WMS/WFS, SIG/terreno, ambiental, loteamentos/REURB e compartilhamento seguro.",
        "permissions": [
                        "basic:*",
            "car:access",
            "car:full",
            "layers:catalog",
            "layers:catalog-full",
            "layers:view-full",
            "layers:wms-wfs",
            "geometry:access",
            "geometry:edit-basic",
            "geometry:offset",
            "geometry:rotate",
            "geometry:scale",
            "geometry:mirror",
            "geometry:vertices-edit",
            "sig:access",
            "sig:basic",
            "terrain:access",
            "terrain:basic",
            "ambiental:access",
            "ambiental:basic",
            "loteamentos:access",
            "loteamentos:basic",
            "documents:perimetros",
            "documents:perimetros-full",
            "documents:planialtimetria",
            "documents:planialtimetria-basic",
            "sharing:readonly",
            "sharing:password",
            "sharing:expires"
        ]
    },
    "pro_annual": {
        "name": "Surveyor Pro Anual",
        "slug": "pro_annual",
        "priceCents": 119900,
        "billingCycle": "anual",
        "projectLimit": null,
        "userLimit": 4,
        "storageLimitBytes": 1073741824,
        "isActive": true,
        "description": "Plano anual completo: tudo do Plus, projetos ilimitados, até 4 acessos totais (titular + 3 membros) e 100 GB, gestão do próprio espaço de trabalho, versões, compartilhamento avançado e suporte prioritário. Adicionais e white label são contratados separadamente.",
        "permissions": [
            "plus:*",
            "projects:unlimited",
            "projects:trash",
            "projects:lock",
            "projects:version-full",
            "projects:templates",
            "projects:export-zip",
            "geometry:advanced",
            "sig:advanced",
            "terrain:advanced",
            "ambiental:full",
            "loteamentos:full",
            "planialtimetria:full",
            "sharing:full",
            "sharing:revoke",
            "sharing:access-limit",
            "workspace:members",
            "workspace:settings",
            "workspace:storage",
            "workspace:audit-own",
            "security:account-monitoring",
            "cloud:pro",
            "support:priority"
        ]
    }
};

  function applyPlanPreset(key) {
    const preset = planPresets[key];
    if (!preset) return;
    if (!$('editPlanId').value) {
      $('planName').value = preset.name;
      $('planSlug').value = preset.slug;
      $('planPrice').value = (preset.priceCents / 100).toFixed(2);
      $('planBilling').value = preset.billingCycle;
      $('planProjectLimit').value = preset.projectLimit ?? '';
      $('planUserLimit').value = preset.userLimit ?? '';
      $('planStorageMb').value = bytesToMb(preset.storageLimitBytes);
      $('planDescription').value = preset.description;
      $('planActive').value = preset.isActive ? '1' : '0';
    }
    setCheckedPermissions('planPermissions', preset.permissions);
    notify(`Modelo ${preset.name} aplicado. Revise e salve o plano.`, 'success');
  }

  async function syncDefaultPlans() {
    const button = $('seedDefaultPlans');
    if (button) { button.disabled = true; button.textContent = 'Sincronizando...'; }
    try {
      const result = await auth.dedupePlans();
      notify(`6 planos oficiais sincronizados. Permissões atualizadas em ${Number(result?.usersUpdated || 0)} usuário(s). Removidos: ${Number(result?.deleted || 0)}.`, 'success');
      await refresh();
    } catch (error) {
      notify(error.message || 'Não foi possível sincronizar os planos padrão.', 'error');
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Criar/atualizar 6 planos oficiais'; }
    }
  }

  async function dedupePlansNow() {
    const button = $('dedupePlansBtn');
    if (button) { button.disabled = true; button.textContent = 'Corrigindo...'; }
    try {
      const result = await auth.dedupePlans();
      notify(`Planos deduplicados. Removidos: ${Number(result?.deleted || 0)}. Total atual: ${Number(result?.total || 0)}.`, 'success');
      await refresh();
    } catch (error) {
      notify(error.message || 'Não foi possível corrigir os planos duplicados.', 'error');
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Corrigir duplicados'; }
    }
  }

  function openPlan(plan = null) {
    $('editPlanId').value = plan?.id || '';
    $('planDialogTitle').textContent = plan ? 'Editar plano' : 'Novo plano';
    $('planSubmitBtn').textContent = plan ? 'Salvar plano' : 'Criar plano';
    $('planName').value = plan?.name || '';
    $('planSlug').value = plan?.slug || '';
    $('planPrice').value = Number(plan?.price ?? (Number(plan?.priceCents || 0) / 100) ?? 0).toFixed(2);
    $('planBilling').value = normalizeBillingCycle(plan?.billingCycle || plan?.billing || 'anual');
    $('planProjectLimit').value = plan?.projectLimit ?? '';
    $('planUserLimit').value = plan?.userLimit ?? '';
    $('planStorageMb').value = bytesToMb(plan?.storageLimitBytes ?? null);
    $('planActive').value = plan?.active === false || plan?.isActive === false ? '0' : '1';
    $('planDescription').value = plan?.description || '';
    setCheckedPermissions('planPermissions', plan?.permissions || []);
    $('planDialog').showModal();
  }

  function isoTodayLocal() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
  }

  function addCalendarCycle(dateValue, cycle) {
    const parts = String(dateValue || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some((value) => !Number.isInteger(value))) return '';
    const [year, month, day] = parts;
    const durationDays = cycle === 'mensal' ? 30 : (cycle === 'anual' ? 365 : 0);
    if (!durationDays) return '';
    const start = new Date(Date.UTC(year, month - 1, day, 12));
    if (!Number.isFinite(start.getTime())) return '';
    start.setUTCDate(start.getUTCDate() + durationDays);
    return `${String(start.getUTCFullYear()).padStart(4, '0')}-${String(start.getUTCMonth() + 1).padStart(2, '0')}-${String(start.getUTCDate()).padStart(2, '0')}`;
  }

  function formatUserDate(value) {
    if (!value) return 'Sem vencimento';
    const [year, month, day] = String(value).split('-').map(Number);
    if (!year || !month || !day) return 'Data inválida';
    return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month - 1, day, 12));
  }

  function formatUserCurrency(cents) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((Number(cents) || 0) / 100);
  }

  function selectedUserPlan() {
    const slug = $('userPlan')?.value || '';
    return plans.find((plan) => String(plan.slug || plan.id) === String(slug)) || null;
  }

  function updateUserPlanCalculationWithoutReview() {
    const plan = selectedUserPlan();
    const cycle = normalizeBillingCycle(plan?.billingCycle || plan?.billing || 'anual');
    const startDate = userOnboardingState.startDate || isoTodayLocal();
    const endDate = addCalendarCycle(startDate, cycle);
    const amountCents = Number(plan?.priceCents ?? Math.round(Number(plan?.price || 0) * 100)) || 0;
    userOnboardingState.startDate = startDate;
    userOnboardingState.endDate = endDate;
    userOnboardingState.amountCents = amountCents;
    if (!$('editUserId')?.value && $('userExpiry')) $('userExpiry').value = endDate || '';
    return { plan, cycle, startDate, endDate, amountCents };
  }

  function updateUserPlanCalculation() {
    const calculated = updateUserPlanCalculationWithoutReview();
    const { plan, cycle, startDate, endDate, amountCents } = calculated;
    if ($('userCalculatedAmount')) $('userCalculatedAmount').textContent = plan ? formatUserCurrency(amountCents) : '—';
    if ($('userCalculatedStart')) $('userCalculatedStart').textContent = formatUserDate(startDate);
    if ($('userCalculatedExpiry')) $('userCalculatedExpiry').textContent = endDate ? formatUserDate(endDate) : 'Sem vencimento';
    if ($('userCalculatedRule')) {
      $('userCalculatedRule').textContent = !plan
        ? 'Selecione um plano.'
        : cycle === 'anual'
          ? 'Vigência automática de 365 dias a partir da data de início.'
          : 'Plano interno sem vencimento automático e sem comprovante comercial.';
    }
    renderUserOnboardingReview();
    return calculated;
  }

  function userWorkspacePlanRules(plan = selectedUserPlan()) {
    const slug = String(plan?.slug || plan?.id || '').toLowerCase();
    const tier = slug.startsWith('pro') ? 'pro' : (slug.startsWith('plus') ? 'plus' : 'basic');
    const includedTotal = Math.max(1, Number(plan?.userLimit || 1));
    const includedSubusers = Math.max(0, includedTotal - 1);
    const extraSeatPriceCents = tier === 'pro' ? 6000 : (tier === 'plus' ? 3000 : 0);
    return {
      tier,
      allowed: ['plus', 'pro'].includes(tier),
      includedTotal,
      includedSubusers,
      extraSeatPriceCents,
      personalStorageLimitBytes: 5 * 1024 * 1024 * 1024
    };
  }

  function collectUserWorkspaceDrafts({ validate = false } = {}) {
    const rows = [...document.querySelectorAll('#userWorkspaceMemberDrafts .user-workspace-draft')];
    const members = rows.map((row, index) => ({
      name: row.querySelector('[data-member-field="name"]')?.value.trim() || '',
      email: row.querySelector('[data-member-field="email"]')?.value.trim().toLowerCase() || '',
      whatsapp: row.querySelector('[data-member-field="whatsapp"]')?.value.trim() || '',
      memberRole: row.querySelector('[data-member-field="role"]')?.value || 'collaborator',
      status: row.querySelector('[data-member-field="status"]')?.value || 'active',
      sendWelcomeEmail: Boolean(row.querySelector('[data-member-field="sendEmail"]')?.checked),
      index
    }));
    if (validate) {
      const rules = userWorkspacePlanRules();
      if (members.length && !rules.allowed) throw new Error('O plano Básico é individual. Selecione Plus ou Pro para cadastrar subusuários.');
      if (members.length > 12) throw new Error('Cadastre no máximo 12 subusuários por operação.');
      const seen = new Set([$('userEmail')?.value.trim().toLowerCase()]);
      members.forEach((member, index) => {
        if (member.name.length < 3) throw new Error(`Informe o nome completo do subusuário ${index + 1}.`);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email)) throw new Error(`Informe um e-mail válido para o subusuário ${index + 1}.`);
        if (seen.has(member.email)) throw new Error(`O e-mail ${member.email} está repetido no cadastro.`);
        seen.add(member.email);
        if (member.whatsapp && !normalizeBrazilWhatsapp(member.whatsapp)) throw new Error(`Informe um WhatsApp válido para o subusuário ${index + 1}.`);
      });
    }
    userOnboardingState.workspaceMembers = members.map(({ index, ...member }) => member);
    return userOnboardingState.workspaceMembers;
  }

  function renderUserWorkspaceDrafts({ preserveInputs = true } = {}) {
    const box = $('userWorkspaceMemberDrafts');
    const addButton = $('userAddWorkspaceMember');
    const ruleBox = $('userWorkspacePlanRule');
    if (!box || !addButton || !ruleBox) return;
    if (preserveInputs && box.querySelector('.user-workspace-draft')) collectUserWorkspaceDrafts();
    const rules = userWorkspacePlanRules();
    addButton.disabled = !rules.allowed || userOnboardingState.workspaceMembers.length >= 12;
    addButton.classList.toggle('workspace-plan-blocked', !rules.allowed);
    ruleBox.classList.toggle('is-basic', !rules.allowed);
    if (!rules.allowed) {
      ruleBox.innerHTML = '<b>Plano individual.</b> O Básico permite somente o titular e não aceita subusuários.';
    } else {
      const extraText = formatUserCurrency(rules.extraSeatPriceCents);
      ruleBox.innerHTML = `<b>${rules.tier === 'pro' ? 'Equipe Pro' : 'Acesso compartilhado Plus'}:</b> ${rules.includedTotal} acessos totais, contando o titular. ${rules.includedSubusers} subusuário(s) incluído(s); os seguintes custam ${escape(extraText)} conforme proposta comercial anual. Todos os membros usam a mesma franquia de armazenamento e projetos do titular, sem limite individual separado.`;
    }
    const members = userOnboardingState.workspaceMembers;
    if (!members.length) {
      box.innerHTML = '<div class="user-workspace-empty">Nenhum subusuário será criado agora. Você poderá adicioná-lo depois ao editar o titular.</div>';
      return;
    }
    box.innerHTML = members.map((member, index) => {
      const isExtra = index >= rules.includedSubusers;
      const licenseTitle = isExtra ? 'Acesso adicional · sob consulta' : 'Licença incluída';
      const licenseDetail = isExtra
        ? `Este é o acesso nº ${index + 2}, acima da franquia de ${rules.includedTotal}.`
        : `Este acesso está incluído no plano e compartilha os recursos do titular.`;
      return `<article class="user-workspace-draft" data-member-index="${index}">
        <div class="user-workspace-draft-head"><div><strong>Subusuário ${index + 1}</strong><small>Acesso próprio com projetos, documentos e armazenamento compartilhados pela equipe.</small></div><button class="tiny-button danger-link" type="button" data-remove-onboarding-member="${index}">Remover</button></div>
        <div class="user-workspace-draft-grid">
          <label>Nome completo<input data-member-field="name" value="${escape(member.name || '')}" autocomplete="name"/></label>
          <label>E-mail de acesso<input data-member-field="email" type="email" value="${escape(member.email || '')}" autocomplete="email"/></label>
          <label>WhatsApp<input data-member-field="whatsapp" type="tel" value="${escape(member.whatsapp || '')}" placeholder="(75) 99999-9999"/></label>
          <label>Perfil<select data-member-field="role"><option value="collaborator" ${member.memberRole === 'collaborator' ? 'selected' : ''}>Colaborador</option><option value="technician" ${member.memberRole === 'technician' ? 'selected' : ''}>Técnico</option><option value="manager" ${member.memberRole === 'manager' ? 'selected' : ''}>Gestor</option></select></label>
          <label>Status<select data-member-field="status"><option value="active" ${member.status !== 'pending' && member.status !== 'blocked' ? 'selected' : ''}>Ativo</option><option value="pending" ${member.status === 'pending' ? 'selected' : ''}>Pendente</option><option value="blocked" ${member.status === 'blocked' ? 'selected' : ''}>Bloqueado</option></select></label>
          <div class="user-workspace-license full ${isExtra ? 'is-extra' : ''}"><div><strong>${escape(licenseTitle)}</strong><small>${escape(licenseDetail)}</small></div></div>
          <label class="workspace-check full"><input data-member-field="sendEmail" type="checkbox" ${member.sendWelcomeEmail !== false ? 'checked' : ''}/><span><b>Enviar e-mail de boas-vindas</b><small>O subusuário receberá um link seguro para criar a própria senha.</small></span></label>
        </div>
      </article>`;
    }).join('');
  }

  function addUserWorkspaceDraft() {
    collectUserWorkspaceDrafts();
    const rules = userWorkspacePlanRules();
    if (!rules.allowed) return notify('O plano Básico é individual. Selecione Plus ou Pro.', 'error');
    if (userOnboardingState.workspaceMembers.length >= 12) return notify('Limite de 12 subusuários por cadastro atingido.', 'error');
    userOnboardingState.workspaceMembers.push({ name: '', email: '', whatsapp: '', memberRole: 'collaborator', status: 'active', sendWelcomeEmail: true });
    renderUserWorkspaceDrafts({ preserveInputs: false });
    $('userWorkspaceMemberDrafts')?.querySelector('[data-member-index]:last-child input')?.focus();
  }

  function setUserWizardStep(step) {
    const next = Math.max(1, Math.min(5, Number(step) || 1));
    userOnboardingState.step = next;
    document.querySelectorAll('[data-user-step]').forEach((panel) => panel.classList.toggle('active', Number(panel.dataset.userStep) === next));
    document.querySelectorAll('[data-user-step-target]').forEach((button) => {
      const target = Number(button.dataset.userStepTarget);
      button.classList.toggle('active', target === next);
      button.classList.toggle('complete', target < next);
    });
    $('userWizardBack')?.classList.toggle('hidden', next === 1);
    $('userWizardNext')?.classList.toggle('hidden', next === 5);
    $('userSaveButton')?.classList.toggle('hidden', next !== 5);
    if (next === 2) updateUserPlanCalculation();
    if (next === 3) renderUserWorkspaceDrafts();
    if (next === 4) loadUserOnboardingSignature().catch(() => null);
    if (next === 5) renderUserOnboardingReview();
  }

  function validateUserWizardStep(step) {
    const common = {
      name: $('userName').value.trim(),
      email: $('userEmail').value.trim().toLowerCase(),
      planSlug: $('userPlan').value,
      whatsapp: normalizeBrazilWhatsapp($('userWhatsapp').value),
      whatsappOptIn: false
    };
    if (step === 1) {
      if (!common.name || common.name.length < 3) throw new Error('Informe o nome completo do usuário.');
      if (!common.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(common.email)) throw new Error('Informe um e-mail válido.');
      if (!$('editUserId').value.trim() && String($('userPassword').value || '').length < 12) throw new Error('Informe ou gere uma senha temporária com pelo menos 12 caracteres.');
      if ($('userWhatsapp').value.trim() && !common.whatsapp) throw new Error('Informe um WhatsApp válido com DDD.');
    }
    if (step === 2) {
      const calculated = updateUserPlanCalculation();
      if (!calculated.plan) throw new Error('Selecione um plano para o usuário.');
      if (!['anual', 'interno'].includes(calculated.cycle)) throw new Error('O Surveyor aceita somente planos anuais ou internos.');
    }
    if (step === 3) collectUserWorkspaceDrafts({ validate: true });
    if (step === 4 && $('userSendWelcomeEmail')?.checked) {
      const calculated = updateUserPlanCalculation();
      if (!calculated.endDate) throw new Error('Planos internos não geram comprovante comercial automático.');
      if (!userOnboardingState.signatureDataUrl) throw new Error('Carregue ou selecione a assinatura administrativa antes de prosseguir.');
    }
    return true;
  }

  function renderUserOnboardingReview() {
    const box = $('userOnboardingReview');
    if (!box) return;
    const calculated = updateUserPlanCalculationWithoutReview();
    const roleLabel = ({ admin: 'Administrador', manager: 'Gestor', technician: 'Técnico', user: 'Usuário' }[$('userRole')?.value] || 'Usuário');
    const statusLabel = ({ active: 'Ativo', blocked: 'Bloqueado', expired: 'Expirado', pending: 'Pendente' }[$('userStatus')?.value] || 'Ativo');
    const members = collectUserWorkspaceDrafts();
    const workspaceRules = userWorkspacePlanRules(calculated.plan);
    const extraMembers = Math.max(0, members.length - workspaceRules.includedSubusers);
    const workspaceText = members.length
      ? `${members.length} subusuário(s): ${Math.min(members.length, workspaceRules.includedSubusers)} incluído(s)${extraMembers ? ` e ${extraMembers} adicional(is), sujeitos à proposta comercial anual` : ''}. Armazenamento e projetos são compartilhados por toda a equipe.`
      : 'Somente o titular será criado agora.';
    box.innerHTML = `
      <article><span>Cliente</span><strong>${escape($('userName')?.value.trim() || 'Não informado')}</strong></article>
      <article><span>E-mail</span><strong>${escape($('userEmail')?.value.trim() || 'Não informado')}</strong></article>
      <article><span>WhatsApp</span><strong>${escape($('userWhatsapp')?.value.trim() || 'Não informado')}</strong></article>
      <article><span>Senha temporária</span><strong>${$('editUserId')?.value ? ($('userPassword')?.value ? 'Será redefinida' : 'Será mantida') : 'Definida para o primeiro login'}</strong></article>
      <article><span>Perfil / status</span><strong>${escape(roleLabel)} · ${escape(statusLabel)}</strong></article>
      <article><span>Plano</span><strong>${escape(calculated.plan?.name || 'Não selecionado')}</strong></article>
      <article><span>Investimento</span><strong>${escape(formatUserCurrency(calculated.amountCents))}</strong></article>
      <article><span>Início</span><strong>${escape(formatUserDate(calculated.startDate))}</strong></article>
      <article><span>Vencimento</span><strong>${escape(formatUserDate(calculated.endDate))}</strong></article>
      <article class="full"><span>Equipe</span><strong>${escape(workspaceText)}</strong></article>
      <article class="full"><span>Envio automático</span><strong>${$('userSendWelcomeEmail')?.checked ? 'E-mail com link seguro de primeiro acesso e termo/comprovante PDF assinado' : 'Não enviar e-mail automaticamente'}</strong></article>`;
  }

  function normalizeUserSignaturePosition(value = {}) {
    return {
      x: Math.max(0, Math.min(100, Number(value.x ?? 50))),
      y: Math.max(4, Math.min(80, Number(value.y ?? 44))),
      scale: Math.max(70, Math.min(150, Number(value.scale ?? 100)))
    };
  }

  function updateUserSignatureEditor() {
    const image = $('userOnboardingSignatureImage');
    const placeholder = $('userOnboardingSignaturePlaceholder');
    const dataUrl = userOnboardingState.signatureDataUrl;
    if (image) {
      if (dataUrl) {
        image.src = dataUrl;
        image.classList.remove('hidden');
        image.style.left = `${userOnboardingState.signaturePosition.x}%`;
        image.style.top = `${userOnboardingState.signaturePosition.y}%`;
        image.style.width = `${220 * userOnboardingState.signaturePosition.scale / 100}px`;
      } else {
        image.removeAttribute('src');
        image.classList.add('hidden');
      }
    }
    placeholder?.classList.toggle('hidden', Boolean(dataUrl));
    if ($('userOnboardingSignatureScale')) $('userOnboardingSignatureScale').value = String(userOnboardingState.signaturePosition.scale);
    if ($('userOnboardingSignatureScaleOutput')) $('userOnboardingSignatureScaleOutput').textContent = `${Math.round(userOnboardingState.signaturePosition.scale)}%`;
    if ($('userSignatureStatus')) $('userSignatureStatus').textContent = dataUrl ? 'Assinatura pronta para o comprovante.' : 'Nenhuma assinatura carregada.';
  }

  async function loadUserOnboardingSignature({ forceOfficial = false } = {}) {
    if (userOnboardingState.signatureDataUrl && !forceOfficial) { updateUserSignatureEditor(); return; }
    const bridge = window.SurveyorPlanDocuments;
    const settings = bridge?.getOnboardingSignatureSettings?.() || {};
    if (!forceOfficial && settings.signatureDataUrl) {
      userOnboardingState.signatureDataUrl = settings.signatureDataUrl;
      userOnboardingState.signaturePosition = normalizeUserSignaturePosition(settings.signaturePosition);
      updateUserSignatureEditor();
      return;
    }
    const url = bridge?.officialSignatureUrl || '/assets/signatures/kaua-lucas-santos-franca.png';
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) throw new Error('Não foi possível carregar a assinatura oficial.');
    const blob = await response.blob();
    userOnboardingState.signatureDataUrl = await blobToUserDataUrl(blob);
    userOnboardingState.signaturePosition = { x: 50, y: 44, scale: 100 };
    updateUserSignatureEditor();
  }

  function blobToUserDataUrl(blob) {
    return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '')); reader.onerror = reject; reader.readAsDataURL(blob); });
  }

  async function userSignatureFileToPng(file) {
    const source = await blobToUserDataUrl(file);
    const image = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = source; });
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 900 / image.naturalWidth, 320 / image.naturalHeight);
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  }

  function pointerToUserSignature(event) {
    const zone = $('userOnboardingSignatureZone');
    if (!zone || !userOnboardingState.signatureDataUrl) return;
    const rect = zone.getBoundingClientRect();
    userOnboardingState.signaturePosition.x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    userOnboardingState.signaturePosition.y = Math.max(4, Math.min(80, ((event.clientY - rect.top) / rect.height) * 100));
    updateUserSignatureEditor();
  }


  function formatWorkspaceCurrency(cents = 0) {
    return Number(cents || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatWorkspaceBytes(bytes) {
    if (bytes == null) return 'Sem limite';
    const value = Math.max(0, Number(bytes) || 0);
    if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`;
    if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} MB`;
    return `${value.toLocaleString('pt-BR')} bytes`;
  }

  function workspaceMemberRoleLabel(role = '') {
    return ({ collaborator: 'Colaborador', technician: 'Técnico', manager: 'Gestor' }[role] || 'Colaborador');
  }

  function workspaceMemberStatusLabel(status = '') {
    return ({ active: 'Ativo', pending: 'Pendente', blocked: 'Bloqueado' }[status] || 'Ativo');
  }

  function workspaceEligibleExistingUsers() {
    const ownerId = String(workspaceTeamState.owner?.id || document.getElementById('workspaceOwnerUserId')?.value || '');
    const memberIds = new Set((workspaceTeamState.team?.members || []).map((item) => String(item.id || '')));
    return (Array.isArray(users) ? users : []).filter((user) => {
      const id = String(user?.id || '');
      if (!id || id === ownerId || memberIds.has(id)) return false;
      if (user?.isSubuser) return false;
      if (String(user?.role || '').toLowerCase() === 'admin') return false;
      return true;
    }).sort((a, b) => String(a.name || a.email || '').localeCompare(String(b.name || b.email || ''), 'pt-BR'));
  }

  function populateWorkspaceExistingUsers() {
    const select = document.getElementById('workspaceExistingUser');
    if (!select) return;
    const current = select.value;
    const eligible = workspaceEligibleExistingUsers();
    select.innerHTML = '<option value="">Selecione...</option>' + eligible.map((user) =>
      `<option value="${escape(user.id)}">${escape(user.name || user.email || 'Usuário')} · ${escape(user.email || '')}</option>`
    ).join('');
    if (eligible.some((user) => String(user.id) === String(current))) select.value = current;
  }

  function setWorkspaceMemberEditorOpen(open = true) {
    const form = document.getElementById('workspaceSubuserForm');
    if (!form) return;
    form.hidden = !open;
    document.getElementById('workspaceAddMemberToggle')?.classList.toggle('hidden', Boolean(open));
    if (open) requestAnimationFrame(() => form.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }

  function setWorkspaceMemberMode(mode = 'existing') {
    const editing = Boolean(workspaceTeamState.editing);
    const normalized = editing ? 'edit' : (mode === 'new' ? 'new' : 'existing');
    workspaceTeamState.mode = normalized;
    document.querySelectorAll('[data-workspace-member-mode]').forEach((button) => {
      button.classList.toggle('active', !editing && button.dataset.workspaceMemberMode === normalized);
      button.disabled = editing;
    });
    const existingBox = document.getElementById('workspaceExistingMemberBox');
    if (existingBox) existingBox.hidden = normalized !== 'existing';
    document.querySelectorAll('.workspace-new-member-field').forEach((field) => {
      field.hidden = normalized === 'existing';
    });
    const name = document.getElementById('subuserName');
    const email = document.getElementById('subuserEmail');
    const password = document.getElementById('subuserPassword');
    if (name) name.required = normalized === 'new';
    if (email) email.required = normalized === 'new';
    if (password) password.required = false;
    document.querySelectorAll('.workspace-edit-password-field').forEach((field) => { field.hidden = !editing; });
    const submit = document.getElementById('workspaceSubuserSubmit');
    if (submit) submit.textContent = editing ? 'Salvar alterações' : (normalized === 'existing' ? 'Adicionar à equipe' : 'Criar e adicionar');
    populateWorkspaceExistingUsers();
  }

  function workspaceFallbackTeam(owner = {}) {
    owner = owner && typeof owner === 'object' ? owner : {};
    const plan = plans.find((item) => String(item.id || '') === String(owner.planId || '') || String(item.slug || '').toLowerCase() === String(owner.planSlug || owner.plan || '').toLowerCase()) || {};
    const summary = owner.teamSummary && typeof owner.teamSummary === 'object' ? owner.teamSummary : {};
    return {
      name: '',
      owner,
      plan: {
        id: plan.id || owner.planId || '',
        slug: plan.slug || owner.planSlug || owner.plan || '',
        name: owner.planName || plan.name || 'Carregando plano...',
        projectLimit: owner.planLimits?.projectLimit ?? plan.projectLimit ?? null,
        userLimit: owner.planLimits?.userLimit ?? plan.userLimit ?? summary.includedSeats ?? null,
        storageLimitBytes: owner.planLimits?.storageLimitBytes ?? plan.storageLimitBytes ?? null
      },
      members: [],
      seats: {
        included: summary.includedSeats ?? owner.planLimits?.userLimit ?? plan.userLimit ?? null,
        total: summary.totalSeats || 1,
        members: summary.memberCount || 0
      },
      projects: { used: null, limit: owner.planLimits?.projectLimit ?? plan.projectLimit ?? null },
      storage: { usedBytes: null, limitBytes: owner.planLimits?.storageLimitBytes ?? plan.storageLimitBytes ?? null },
      partial: true
    };
  }

  function workspaceApiMessage(error, fallback = 'Não foi possível concluir a operação da equipe.') {
    const raw = String(error?.message || '').trim();
    const status = Number(error?.status || 0);
    const missingRoute = status === 404 || /rota n[aã]o encontrada|route not found|not found/i.test(raw);
    if (missingRoute) return 'A API de equipes do servidor está desatualizada. Publique a Function surveyor-api desta versão e tente novamente.';
    if (error?.code === 'WORKSPACE_SCHEMA_REQUIRED') return 'A estrutura de equipes no Appwrite ainda não está pronta. Publique/configure workspace_members e tente novamente.';
    if (/Cannot read properties|undefined|null.*reading|TypeError/i.test(raw)) return 'Não foi possível montar os dados da equipe. Atualize a página e tente novamente.';
    const message = raw || fallback;
    return error?.requestId ? `${message} Código: ${String(error.requestId).slice(0, 12)}.` : message;
  }

  function setWorkspaceTeamLoading(loading) {
    workspaceTeamState.loading = Boolean(loading);
    const dialog = $('workspaceTeamDialog');
    dialog?.classList.toggle('is-loading', Boolean(loading));
    if ($('workspaceTeamSaveName')) $('workspaceTeamSaveName').disabled = Boolean(loading) && !String($('workspaceOwnerUserId')?.value || '').trim();
  }

  function renderWorkspaceTeam(team = workspaceTeamState.team) {
    team = team && typeof team === 'object' ? team : null;
    workspaceTeamState.team = team;
    if (!team) return;
    const owner = (team.owner && typeof team.owner === 'object') ? team.owner : ((workspaceTeamState.owner && typeof workspaceTeamState.owner === 'object') ? workspaceTeamState.owner : {});
    workspaceTeamState.owner = owner;
    $('workspaceOwnerUserId').value = owner.id || '';
    const effectiveTeamName = workspaceTeamState.savedNameOverride !== null ? workspaceTeamState.savedNameOverride : (team.name || '');
    $('workspaceTeamTitle').textContent = effectiveTeamName || (team.partial ? 'Equipe da assinatura' : `Equipe de ${owner.name || 'titular'}`);
    if ($('workspaceTeamName') && !workspaceTeamState.nameDirty) $('workspaceTeamName').value = effectiveTeamName;
    $('workspaceTeamSubtitle').textContent = `${owner.email || ''} · assinatura, projetos e armazenamento compartilhados.`;
    $('workspaceTeamPlan').textContent = team.plan?.name || owner.planName || 'Carregando...';
    const included = team.seats?.included == null ? '—' : team.seats.included;
    $('workspaceTeamSeats').textContent = `${team.seats?.total || 1} de ${included}`;
    const projectLimit = team.projects?.limit == null ? 'ilimitados' : Number(team.projects.limit).toLocaleString('pt-BR');
    $('workspaceTeamProjects').textContent = team.projects?.used == null ? `Carregando... · limite ${projectLimit}` : `${Number(team.projects.used || 0).toLocaleString('pt-BR')} de ${projectLimit}`;
    $('workspaceTeamStorage').textContent = team.storage?.usedBytes == null ? `Carregando... · limite ${formatWorkspaceBytes(team.storage?.limitBytes)}` : `${formatWorkspaceBytes(team.storage.usedBytes)} de ${formatWorkspaceBytes(team.storage?.limitBytes)}`;
    if ($('workspaceTeamExtraCost')) $('workspaceTeamExtraCost').textContent = 'Sem adicional';
    const members = Array.isArray(team.members) ? team.members.filter((member) => member && typeof member === 'object') : [];
    const storageCell = () => `<div class="workspace-personal-storage shared"><span>Compartilhado</span><small>Mesmo espaço da equipe</small></div>`;
    $('workspaceMembersTable').innerHTML = `
      <tr class="workspace-owner-member"><td><b>${escape(owner.name || 'Titular')}</b><small>${escape(owner.email || '')}</small></td><td>Titular</td><td>Incluída</td><td><span class="workspace-shared-owner">Franquia compartilhada</span></td><td><span class="status-pill ${escape(userStatusKey(owner))}">${escape(userStatusLabel(owner))}</span></td><td>Assinatura principal</td></tr>`
      + (team.partial
        ? '<tr class="workspace-team-loading-row"><td colspan="6"><span class="workspace-inline-loader"></span> Carregando membros da equipe...</td></tr>'
        : members.map((member) => `<tr><td><b>${escape(member.name || 'Sem nome')}</b><small>${escape(member.email || '')}</small></td><td>${escape(workspaceMemberRoleLabel(member.workspaceRole))}</td><td>Compartilhada</td><td>${storageCell(member)}</td><td><span class="status-pill ${escape(userStatusKey(member))}">${escape(workspaceMemberStatusLabel(userStatusKey(member)))}</span></td><td><button class="tiny-button" type="button" data-workspace-action="edit" data-id="${member.id}">Editar</button><button class="tiny-button" type="button" data-workspace-action="toggle" data-id="${member.id}">${userToggleLabel(member)}</button><button class="tiny-button danger-link" type="button" data-workspace-action="delete" data-id="${member.id}">Remover</button></td></tr>`).join(''));
    updateWorkspaceSeatRule();
    populateWorkspaceExistingUsers();
  }

  function resetWorkspaceMemberForm(member = null, options = {}) {
    workspaceTeamState.editing = member || null;
    const shouldOpen = options.open === true || Boolean(member);
    $('editSubuserId').value = member?.id || '';
    $('workspaceSubuserFormTitle').textContent = member ? 'Editar membro' : 'Adicionar membro';
    $('workspaceSubuserCancelEdit').classList.toggle('hidden', !member);
    $('subuserName').value = member?.name || '';
    $('subuserEmail').value = member?.email || '';
    $('subuserEmail').readOnly = Boolean(member);
    $('subuserWhatsapp').value = member?.whatsappDisplay || member?.whatsapp || '';
    $('subuserPassword').value = '';
    $('subuserPasswordHelp').textContent = member ? 'Vazio mantém a senha atual. Use apenas para redefinição administrativa.' : 'Novos membros criam a própria senha pelo link seguro de primeiro acesso.';
    $('subuserRole').value = member?.workspaceRole || 'collaborator';
    $('subuserStatus').value = ['active', 'pending', 'blocked'].includes(userStatusKey(member || {})) ? userStatusKey(member) : 'active';
    $('subuserPaidExtra').checked = false;
    $('subuserSendWelcomeEmail').checked = !member;
    $('subuserSendWelcomeEmail').closest('label')?.classList.toggle('hidden', Boolean(member));
    if ($('workspaceExistingUser')) $('workspaceExistingUser').value = '';
    const defaultMode = workspaceEligibleExistingUsers().length ? 'existing' : 'new';
    setWorkspaceMemberMode(member ? 'edit' : defaultMode);
    updateWorkspaceSeatRule();
    setWorkspaceMemberEditorOpen(shouldOpen);
  }

  function updateWorkspaceSeatRule() {
    const team = workspaceTeamState.team;
    if (!team) return;
    const included = team.seats?.included;
    const total = Number(team.seats?.total || 1);
    $('subuserPaidExtra').checked = false;
    $('subuserPaidExtra').disabled = true;
    if ($('subuserSeatRule')) {
      $('subuserSeatRule').textContent = included == null
        ? `A equipe possui ${total} acesso(s). Todos usam o mesmo plano, projetos e armazenamento.`
        : `${total} de ${included} acesso(s) usados. O armazenamento é único e compartilhado.`;
    }
  }

  async function openWorkspaceTeam(userOrId, editMemberId = '') {
    const selected = typeof userOrId === 'string' ? users.find((item) => item.id === userOrId) : userOrId;
    const ownerId = selected?.isSubuser ? selected.workspaceOwnerUserId : selected?.id || String(userOrId || '');
    if (!ownerId) return notify('Não foi possível identificar o titular desta assinatura.', 'error');
    const ownerRecord = users.find((item) => item.id === ownerId) || selected || {};
    const ownerPlanSlug = String(ownerRecord.planSlug || plans.find((plan) => plan.id === ownerRecord.planId)?.slug || '').toLowerCase();
    if (!ownerRecord.isSubuser && !ownerPlanSlug.startsWith('plus') && !ownerPlanSlug.startsWith('pro')) {
      return notify('O plano Básico é individual e não permite subusuários.', 'error');
    }

    workspaceTeamState.owner = ownerRecord;
    workspaceTeamState.team = null;
    workspaceTeamState.nameDirty = false;
    workspaceTeamState.savedNameOverride = null;
    $('workspaceOwnerUserId').value = ownerId;
    if ($('workspaceTeamName')) {
      $('workspaceTeamName').value = '';
      $('workspaceTeamName').dataset.userDirty = '0';
    }
    renderWorkspaceTeam(workspaceFallbackTeam(ownerRecord));
    resetWorkspaceMemberForm();
    setWorkspaceTeamLoading(true);
    $('workspaceTeamDialog').showModal();

    let loadingTimer = 0;
    try {
      loadingTimer = setTimeout(() => {
        const row = $('workspaceMembersTable')?.querySelector('.workspace-team-loading-row td');
        if (row) row.innerHTML = '<span class="workspace-inline-loader"></span> A equipe está demorando para responder. Continuamos tentando...';
      }, 7000);
      const team = await auth.loadWorkspaceTeam(ownerId, { forceRefresh: true, timeoutMs: 12000 });
      if (!team) throw new Error('A API não retornou os dados da equipe.');
      renderWorkspaceTeam(team);
      setWorkspaceTeamLoading(false);
      if (editMemberId) {
        const member = team?.members?.find((item) => item.id === editMemberId);
        if (member) resetWorkspaceMemberForm(member);
      }
    } catch (error) {
      const publicMessage = workspaceApiMessage(error, 'Não foi possível carregar a equipe.');
      setWorkspaceTeamLoading(false);
      notify(publicMessage, 'error');
      const fallback = workspaceFallbackTeam(ownerRecord);
      renderWorkspaceTeam(fallback);
      $('workspaceMembersTable').innerHTML = `
        <tr class="workspace-owner-member"><td><b>${escape(ownerRecord.name || 'Titular')}</b><small>${escape(ownerRecord.email || '')}</small></td><td>Titular</td><td>Incluída</td><td><span class="workspace-shared-owner">Franquia compartilhada</span></td><td><span class="status-pill ${escape(userStatusKey(ownerRecord))}">${escape(userStatusLabel(ownerRecord))}</span></td><td>Assinatura principal</td></tr>
        <tr class="workspace-team-error-row"><td colspan="6">${escape(publicMessage)} <button class="tiny-button" type="button" data-workspace-retry="1">Tentar novamente</button></td></tr>`;
    } finally {
      if (loadingTimer) clearTimeout(loadingTimer);
    }
  }

  async function saveWorkspaceTeamName() {
    const ownerId = String($('workspaceOwnerUserId')?.value || '').trim();
    const input = $('workspaceTeamName');
    const button = $('workspaceTeamSaveName');
    const name = String(input?.value || '').trim().replace(/\s+/g, ' ').slice(0, 100);
    if (!ownerId) return notify('Abra novamente a equipe para identificar o titular.', 'error');
    if (name && name.length < 3) return notify('O nome da equipe deve ter pelo menos 3 caracteres.', 'error');
    button.disabled = true;
    try {
      const result = await auth.updateWorkspaceTeam(ownerId, { name });
      workspaceTeamState.savedNameOverride = name;
      if (result?.team) renderWorkspaceTeam(result.team);
      workspaceTeamState.nameDirty = false;
      if (input) input.dataset.userDirty = '0';
      notify(name ? 'Nome da equipe salvo.' : 'Nome personalizado removido.', 'success');
    } catch (error) {
      notify(workspaceApiMessage(error, 'Não foi possível salvar o nome da equipe.'), 'error');
    } finally {
      button.disabled = false;
    }
  }

  async function saveWorkspaceMember(event) {
    event.preventDefault();
    const ownerId = String($('workspaceOwnerUserId')?.value || '').trim();
    if (!ownerId) return notify('Abra novamente a equipe para identificar o titular.', 'error');
    const editId = $('editSubuserId').value;
    const mode = workspaceTeamState.mode;
    let payload;
    if (editId) {
      payload = {
        name: $('subuserName').value.trim(),
        whatsapp: $('subuserWhatsapp').value.trim(),
        password: $('subuserPassword').value,
        memberRole: $('subuserRole').value,
        status: $('subuserStatus').value
      };
    } else if (mode === 'existing') {
      const existingUserId = String($('workspaceExistingUser')?.value || '').trim();
      if (!existingUserId) return notify('Selecione um usuário existente.', 'error');
      const selected = users.find((item) => String(item.id) === existingUserId);
      if (!selected) return notify('Usuário não encontrado. Atualize a lista e tente novamente.', 'error');
      if (!confirm(`Adicionar ${selected.name || selected.email} à equipe? O plano atual deixa de valer enquanto ele estiver na equipe e os projetos/documentos existentes passam para o espaço compartilhado.`)) return;
      payload = {
        existingUserId,
        memberRole: $('subuserRole').value,
        status: $('subuserStatus').value
      };
    } else {
      payload = {
        name: $('subuserName').value.trim(),
        email: $('subuserEmail').value.trim(),
        whatsapp: $('subuserWhatsapp').value.trim(),
        memberRole: $('subuserRole').value,
        status: $('subuserStatus').value,
        paidExtraSeat: false,
        sendWelcomeEmail: $('subuserSendWelcomeEmail').checked
      };
    }
    const button = $('workspaceSubuserSubmit');
    button.disabled = true;
    try {
      const result = editId ? await auth.updateSubuser(editId, payload) : await auth.createSubuser(ownerId, payload);
      if (result?.team) {
        renderWorkspaceTeam(result.team);
      } else if (result?.user) {
        // A inclusão já foi confirmada pelo POST. Se a reconstrução do resumo
        // falhar no servidor, atualize o card imediatamente em vez de exibir erro.
        const currentTeam = workspaceTeamState.team && typeof workspaceTeamState.team === 'object'
          ? workspaceTeamState.team
          : workspaceFallbackTeam(workspaceTeamState.owner || {});
        const currentMembers = Array.isArray(currentTeam.members) ? currentTeam.members.filter(Boolean) : [];
        const nextMembers = currentMembers.filter((item) => String(item?.id || '') !== String(result.user?.id || ''));
        nextMembers.push(result.user);
        renderWorkspaceTeam({
          ...currentTeam,
          partial: false,
          members: nextMembers,
          seats: {
            ...(currentTeam.seats || {}),
            members: nextMembers.length,
            total: nextMembers.length + 1
          }
        });
        Promise.resolve(auth.loadWorkspaceTeam(ownerId, { forceRefresh: true, timeoutMs: 12000 })).then((freshTeam) => {
          if (freshTeam) renderWorkspaceTeam(freshTeam);
        }).catch((summaryError) => {
          console.warn('[Admin Equipe] vínculo salvo; resumo completo será atualizado na próxima abertura', summaryError);
        });
      }
      resetWorkspaceMemberForm(null, { open: false });

      // Atualizar a listagem administrativa é secundário. O vínculo já foi
      // salvo no servidor e deve permanecer visível mesmo se /admin/users tiver
      // algum cadastro legado inconsistente ou estiver temporariamente lento.
      Promise.resolve(auth.loadUsers({ forceRefresh: true })).then((freshUsers) => {
        if (Array.isArray(freshUsers)) users = freshUsers;
        renderUsers();
        renderPlans();
        populateWorkspaceExistingUsers();
      }).catch((refreshError) => {
        console.warn('[Admin Equipe] membro salvo; atualização da lista global falhou sem invalidar a operação', refreshError);
      });
      if (result?.migration && !editId) {
        const movedProjects = Number(result.migration.projects || 0);
        const movedDocuments = Number(result.migration.documents || 0);
        const failed = Number(result.migration.failed || 0);
        notify(failed
          ? `Usuário adicionado. ${movedProjects} projeto(s) e ${movedDocuments} documento(s) migrados; ${failed} item(ns) precisam de nova tentativa.`
          : `Usuário adicionado. ${movedProjects} projeto(s) e ${movedDocuments} documento(s) passaram para a equipe.`, failed ? 'error' : 'success');
      } else if (!editId && result.welcomeEmail?.sent === false && result.welcomeEmail?.skipped === false) {
        notify('Membro criado, mas o e-mail de boas-vindas não foi enviado.', 'error');
      } else {
        notify(editId ? 'Membro atualizado.' : 'Membro adicionado à equipe.', 'success');
      }
    } catch (error) {
      notify(workspaceApiMessage(error, 'Não foi possível salvar o membro.'), 'error');
    } finally {
      button.disabled = false;
    }
  }

  async function removeWorkspaceMember(member) {
    if (!member || !confirm(`Desvincular ${member.name} desta equipe? O login e a senha serão preservados. Os projetos já compartilhados continuarão com a equipe.`)) return;
    try {
      const result = await auth.deleteSubuser(member.id);
      renderWorkspaceTeam(result.team);
      resetWorkspaceMemberForm(null, { open: false });
      users = await auth.loadUsers({ forceRefresh: true });
      renderUsers();
      renderPlans();
      notify('Membro desvinculado. O login foi preservado e os projetos compartilhados permaneceram com a equipe.', 'success');
    } catch (error) { notify(error.message || 'Não foi possível desvincular o membro.', 'error'); }
  }

  function openUser(user = null) {
    populatePlans();
    if (!$('userPlan').options.length) {
      notify('Crie ou ative pelo menos um plano antes de cadastrar usuários.', 'error');
      return;
    }
    const editing = Boolean(user);
    const incomplete = Boolean(user?.profileIncomplete);
    $('userDialog').classList.toggle('editing-user', editing);
    $('userDialog').classList.toggle('incomplete-user', incomplete);
    $('editUserId').value = user?.id || '';
    $('userDialogTitle').textContent = !editing
      ? 'Criar usuário passo a passo'
      : user?.integrityStatus === 'auth_only'
        ? 'Concluir cadastro incompleto'
        : user?.integrityStatus === 'id_mismatch'
          ? 'Reparar cadastro do usuário'
          : 'Editar usuário';
    $('userDialogSubtitle').textContent = incomplete
      ? 'Revise os dados e salve para corrigir a conta criada parcialmente.'
      : 'Cadastro guiado, vigência automática e envio do comprovante.';
    $('userName').value = user?.name || '';
    $('userEmail').value = user?.email || '';
    $('userEmail').readOnly = editing;
    $('userWhatsapp').value = user?.whatsappDisplay || user?.phoneDisplay || user?.whatsapp || user?.phone || '';
    $('userDialog').dataset.originalWhatsapp = normalizeBrazilWhatsapp($('userWhatsapp').value || '');
    // A autorização de WhatsApp e os lembretes automáticos foram removidos do painel.
    // O telefone permanece apenas como dado de contato do cliente.
    $('userPassword').value = '';
    $('userPassword').required = !editing;
    if ($('userPasswordHelp')) $('userPasswordHelp').textContent = editing
      ? 'Deixe vazio para manter a senha atual. Se informar ou gerar outra, ela substituirá a senha anterior sem apagar dados.'
      : 'Obrigatória para uma nova conta. Digite uma senha ou use Gerar senha; ela funcionará no primeiro login e poderá ser alterada depois.';
    $('userRole').value = user?.role || 'user';
    const preferredPlan = user?.planSlug || plans.find((plan) => plan.id === user?.planId)?.slug || $('userPlan').options[0]?.value || '';
    $('userPlan').value = [...$('userPlan').options].some((option) => option.value === preferredPlan) ? preferredPlan : ($('userPlan').options[0]?.value || '');
    $('userExpiry').value = user?.expiresAt ? String(user.expiresAt).slice(0, 10) : '';
    $('userStatus').value = ['active', 'blocked', 'expired', 'pending'].includes(user?.status) ? user.status : 'active';
    $('userClientDocument').value = '';
    $('userPaymentMethod').value = 'Pix';
    $('userSendWelcomeEmail').checked = true;
    userOnboardingState.startDate = isoTodayLocal();
    userOnboardingState.endDate = '';
    userOnboardingState.amountCents = 0;
    userOnboardingState.workspaceMembers = [];
    userOnboardingState.requestId = editing ? '' : (crypto.randomUUID?.() || `admin-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const selectedPlanSlug = String(user?.planSlug || preferredPlan || '').toLowerCase();
    const canManageWorkspace = selectedPlanSlug.startsWith('plus') || selectedPlanSlug.startsWith('pro');
    if ($('userManageWorkspace')) {
      $('userManageWorkspace').disabled = !editing || !canManageWorkspace;
      $('userManageWorkspace').textContent = canManageWorkspace ? 'Gerenciar equipe' : 'Plano individual';
      $('userManageWorkspace').title = canManageWorkspace ? 'Abrir equipe compartilhada' : 'O plano Básico não permite subusuários';
    }
    if (editing) {
      document.querySelectorAll('[data-user-step]').forEach((panel) => panel.classList.remove('active'));
      $('userSaveButton').textContent = 'Salvar alterações';
    } else {
      $('userSaveButton').textContent = 'Criar usuário e enviar e-mail';
      setUserWizardStep(1);
      updateUserPlanCalculation();
      renderUserWorkspaceDrafts({ preserveInputs: false });
      loadUserOnboardingSignature().catch((error) => { console.warn('[cadastro de usuário] assinatura', error); updateUserSignatureEditor(); });
    }
    $('userDialog').showModal();
  }

  function inferServiceTypeFromUrl(value, explicit = 'auto') {
    if (explicit && explicit !== 'auto') return explicit;
    const text = String(value || '').toLowerCase();
    if (/\.pbf(?:\?|$)|mapbox-vector-tile|vector.?tile/.test(text) && /\{z\}.*\{x\}.*\{y\}|\{x\}.*\{y\}.*\{z\}/.test(text)) return 'mvt';
    if (/\{z\}.*\{x\}.*\{y\}|\{x\}.*\{y\}.*\{z\}/.test(text)) return 'xyz';
    if (/featureserver|mapserver/.test(text)) return 'arcgis';
    if (/service=wms|\/geoserver\/(?:wms|ows)(?:\?|$)|\/wms(?:\?|$)|request=getmap/.test(text)) return 'wms';
    if (/service=wfs|\/wfs(?:\?|$)|request=getfeature|typename=|typenames=/.test(text)) return 'wfs';
    if (/\.geojson(?:\?|$)|\.json(?:\?|$)|f=geojson|outputformat=.*json/.test(text)) return 'geojson';
    return 'api';
  }


  function effectiveRemoteServiceType({ serviceUrl, selectedType, layerName, metadata = {} }) {
    const declared = String(selectedType || 'auto').trim().toLowerCase();
    const url = String(serviceUrl || '').trim();
    const technicalName = String(layerName || metadata.layerName || metadata.layers || '').trim();

    if (declared === 'wms') return 'wms';
    if (['wfs', 'xyz', 'mvt'].includes(declared)) return declared;

    const wmsMetadata = metadata.directWms === true
      || String(metadata.format || '').toLowerCase() === 'image/png'
      || Boolean(metadata.wmsVersion);
    const wmsEndpoint = /(?:service=wms|request=getmap|\/geoserver\/(?:wms|ows)(?:\?|$)|\/wms(?:\?|$))/i.test(url);

    // O nome técnico mais um endpoint WMS prevalecem sobre classificações
    // antigas como geojson, arcgis ou api.
    if (technicalName && (wmsMetadata || wmsEndpoint)) return 'wms';
    return inferServiceTypeFromUrl(url, declared);
  }

  function automaticLayerColor() {
    const text = `${$('layerName').value} ${$('layerSourceName').value} ${$('layerGeometry').value} ${$('layerRemoteType').value} ${$('layerServiceUrl').value}`.toLowerCase();
    if (/preserva|app\b|vegetação|vegetacao/.test(text)) return '#22c55e';
    if (/reserva legal|floresta|mata/.test(text)) return '#15803d';
    if (/água|agua|rio|hidro|nascente/.test(text)) return '#0ea5e9';
    if (/estrada|rodovia|via|acesso/.test(text)) return '#f97316';
    if (/limite|propriedade|imóvel|imovel|cef(ir|ir)|car\b/.test(text)) return '#eab308';
    if (/munic[ií]pio|estado|divis[aã]o/.test(text)) return '#2563eb';
    const palette = ['#2563eb','#16a34a','#d97706','#7c3aed','#0891b2','#db2777','#65a30d','#ea580c','#0f766e','#9333ea'];
    let hash = 0;
    for (const char of text || 'georural') hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
    return palette[Math.abs(hash) % palette.length];
  }

  function applyAutomaticLayerColor(force = false) {
    if ($('layerSourceMode').value !== 'url') return;
    if (!layerColorManuallyEdited && (force || !$('editLayerId').value)) {
      setLayerColorValue(automaticLayerColor());
    }
    $('layerAutoColorHint')?.classList.remove('hidden');
  }

  function updateLayerSourceFields() {
    const remoteMode = $('layerSourceMode').value === 'url';
    const serviceUrl = $('layerServiceUrl').value.trim();
    const serviceType = remoteMode
      ? effectiveRemoteServiceType({
          serviceUrl,
          selectedType: $('layerRemoteType').value,
          layerName: $('layerWmsName').value
        })
      : null;
    const isWms = remoteMode && serviceType === 'wms';
    const progressiveArcGis = remoteMode && serviceType === 'arcgis';
    const mixedContentRisk = remoteMode && /^http:\/\//i.test(serviceUrl);

    document.querySelector('.geojson-file-field')?.classList.toggle('hidden', remoteMode);
    document.querySelector('.remote-type-field')?.classList.toggle('hidden', !remoteMode);
    document.querySelector('.service-url-field')?.classList.toggle('hidden', !remoteMode);
    document.querySelector('.remote-layer-name-field')?.classList.toggle('hidden', !remoteMode);
    $('layerWmsStyleField')?.classList.toggle('hidden', !isWms);
    document.querySelector('.remote-import-field')?.classList.toggle('hidden', !progressiveArcGis);
    $('layerMixedContentWarning')?.classList.toggle('hidden', !mixedContentRisk);

    $('layerServiceUrl').required = remoteMode;
    $('layerWmsName').required = isWms;
    // Arquivos nunca são obrigatórios quando a origem é URL/WMS.
    $('layerGeoJsonFile').required = false;
    $('layerColor').disabled = false;
    $('layerColorHex').disabled = false;
    $('layerAutoColorHint')?.classList.toggle('hidden', !remoteMode);

    if (remoteMode) {
      // Impede que um arquivo selecionado anteriormente seja processado
      // junto com o cadastro do serviço remoto.
      $('layerGeoJsonFile').value = '';
      if (['wms', 'xyz'].includes(serviceType)) $('layerGeometry').value = 'raster';
      applyAutomaticLayerColor();
    }
    updateWmsStyleControls();
  }

  function openLayer(layer = null) {
    layerColorManuallyEdited = false;
    layerImportBusy = false;
    layerImportCompleted = false;
    setLayerImportProgress(false);
    const groups = validLayerGroups();
    if (!groups.length) {
      notify('Crie primeiro um grupo de camadas válido.', 'error');
      $('layerGroupDialog').showModal();
      return;
    }
    populateLayerGroups();
    populateAllowedPlans(layer?.allowedPlans || ['*']);
    $('editLayerId').value = layer?.id || '';
    $('layerDialogTitle').textContent = layer ? 'Editar camada' : 'Cadastrar camada';
    const requestedGroupId = layer?.groupId;
    $('layerGroup').value = groups.some((group) => group.id === requestedGroupId) ? requestedGroupId : groups[0].id;
    $('layerName').value = layer?.name || '';
    $('layerSlug').value = layer?.slug || '';
    $('layerGeometry').value = layer?.geometryType || 'polygon';
    const remoteTypes = ['wms', 'wfs', 'xyz', 'api', 'arcgis', 'mvt'];
    const remoteMode = Boolean(layer?.serviceUrl) || remoteTypes.includes(layer?.serviceType);
    const currentRemoteType = effectiveRemoteServiceType({
      serviceUrl: layer?.serviceUrl || layer?.sourceUrl,
      selectedType: layer?.metadata?.remoteOriginalServiceType || layer?.serviceType || 'auto',
      layerName: layer?.metadata?.layerName || layer?.metadata?.layers,
      metadata: layer?.metadata || {}
    });
    $('layerSourceMode').value = remoteMode ? 'url' : 'file';
    $('layerRemoteType').value = remoteMode ? currentRemoteType : 'auto';
    $('layerSourceName').value = layer?.sourceName || '';
    $('layerDescription').value = layer?.description || '';
    $('layerServiceUrl').value = layer?.serviceUrl || '';
    $('layerWmsName').value = layer?.metadata?.layerName || '';
    $('layerGeoJsonFile').value = '';
    setLayerColorValue(layer?.style?.color || layer?.style?.fillColor || '#3974d8');
    $('layerForceWmsColor').checked = layer?.metadata?.forceWmsColor !== false;
    const inferredSymbolizer = inferWmsSymbolizer(`${layer?.name || ''} ${layer?.description || ''} ${layer?.metadata?.layerName || ''}`);
    $('layerWmsSymbolizer').value = ['polygon', 'line', 'point', 'mixed'].includes(layer?.metadata?.wmsSymbolizer)
      ? layer.metadata.wmsSymbolizer
      : inferredSymbolizer;
    $('layerWmsStyleName').value = layer?.metadata?.styles || layer?.metadata?.officialWmsStyle || '';
    $('layerOpacity').value = Number(layer?.style?.fillOpacity ?? layer?.style?.opacity ?? 0.55);
    $('layerMinZoom').value = layer?.minZoom ?? 0;
    $('layerMaxZoom').value = layer?.maxZoom ?? 22;
    $('layerImportRemoteToDatabase').checked = layer ? false : true;
    $('layerAutoPublishRemote').checked = layer?.metadata?.remoteImportAutoPublish !== false;
    $('layerRemoteBatchSize').value = String(layer?.metadata?.remoteImportBatchSize || 500);
    updateLayerSourceFields();
    updateWmsStyleControls();
    $('layerDialog').showModal();
  }


  function normalizeCatalogLayerKey(value) {
    return String(value || '').trim().toLowerCase();
  }

  function catalogLayerShortName(value) {
    return normalizeCatalogLayerKey(String(value || '').split(':').pop());
  }

  function geobahiaLegacyLayerNames(item = {}) {
    const fullName = String(item.layer || '').trim();
    const shortName = fullName.split(':').pop();
    const legacyPrefixes = [
      'Vetor_Recortes_Tematicos',
      'Vetor_Bases_Gerais',
      'Vetor_Recursos_Hidricos',
      'Vetor_Recursos_Naturais',
      'Vetor_Recursos_Ambientais',
      'Vetor_Biodiversidade',
      'Raster',
      'Raster_ORTOFOTO'
    ];
    const names = new Set([fullName, shortName, ...legacyPrefixes.map((prefix) => `${prefix}:${shortName}`)]);
    if (shortName === 'cefir_imovel_rural_limite_inema') {
      names.add('cefir_imovel_rural_propriedade_inema');
      names.add('Vetor_Recortes_Tematicos:cefir_imovel_rural_propriedade_inema');
    }
    // Alguns registros oficiais do GeoBahia mudaram de workspace/nome ao longo do tempo.
    // Mantemos aliases confirmados pelo catálogo oficial para o resolvedor localizar
    // a camada real via GetCapabilities sem quebrar cadastros existentes.
    const knownAliases = {
      uc_estadual: [
        'Vetor_Recursos_Ambientais:uc_inema_2025', 'uc_inema_2025',
        'Vetor_Recursos_Ambientais:uc_inema_2024', 'uc_inema_2024',
        'Vetor_Recursos_Ambientais:uc_inema_2023', 'uc_inema_2023',
        'Vetor_Recursos_Ambientais:uc_inema_2021', 'uc_inema_2021'
      ],
      uc_inema_2025: [
        'Vetor_Recursos_Ambientais:uc_inema_2024', 'uc_inema_2024',
        'Vetor_Recursos_Ambientais:uc_inema_2023', 'uc_inema_2023',
        'Vetor_Recursos_Ambientais:uc_inema_2021', 'uc_inema_2021',
        'Vetor_Recortes_Tematicos:uc_estadual', 'uc_estadual'
      ],
      uc_inema_2021: [
        'Vetor_Recursos_Ambientais:uc_inema_2025', 'uc_inema_2025',
        'Vetor_Recursos_Ambientais:uc_inema_2024', 'uc_inema_2024',
        'Vetor_Recursos_Ambientais:uc_inema_2023', 'uc_inema_2023',
        'Vetor_Recortes_Tematicos:uc_estadual', 'uc_estadual'
      ],
      faixa_servidao_ferrovias: [
        'Vetor_Recortes_Tematicos:faixa_dominio_ferrovia', 'faixa_dominio_ferrovia',
        'Vetor_Recortes_Tematicos:faixa_dominio_ferrovias', 'faixa_dominio_ferrovias',
        'Vetor_Recortes_Tematicos:faixa_dominio_ferroviario', 'faixa_dominio_ferroviario',
        'Vetor_Recortes_Tematicos:faixa_servidao_ferrovia', 'faixa_servidao_ferrovia',
        'Vetor_Recortes_Tematicos:faixa_servidao_ferroviaria', 'faixa_servidao_ferroviaria',
        'Vetor_Recortes_Tematicos:trecho_ferroviario', 'trecho_ferroviario'
      ],
      solos: [
        'Vetor_Recursos_Ambientais:solos'
      ]
    };
    for (const alias of (knownAliases[shortName] || [])) names.add(alias);
    return [...names].filter(Boolean);
  }

  function geobahiaLayerSlug(item) {
    // Slug estável pelo nome visível para corrigir cadastros antigos sem duplicar
    // quando o Nome Técnico real muda após leitura do GetCapabilities.
    return `geobahia-${slugify(item.name || item.layer)}`;
  }

  function geobahiaSymbolizer(item) {
    if (item.geometry === 'point') return 'point';
    if (item.geometry === 'line') return 'line';
    if (item.geometry === 'mixed') return 'mixed';
    if (item.geometry === 'raster') return 'mixed';
    return 'polygon';
  }

  function geobahiaGeometryType(item) {
    if (item.geometry === 'point') return 'point';
    if (item.geometry === 'line') return 'line';
    if (item.geometry === 'mixed') return 'mixed';
    if (item.geometry === 'raster') return 'raster';
    return 'polygon';
  }

  function geobahiaLayerPayload(item, groupId) {
    const color = normalizeHexColor(item.color || '#3974D8');
    const forceWmsColor = false;
    return {
      groupId,
      name: item.name,
      slug: geobahiaLayerSlug(item),
      description: `${item.group} • GeoBahia / INEMA • camada WMS oficial: ${item.layer}`,
      geometryType: geobahiaGeometryType(item),
      sourceName: 'GeoBahia / INEMA',
      sourceUrl: GEOBAHIA_WMS_BASE_URL,
      serviceType: 'wms',
      serviceUrl: GEOBAHIA_WMS_BASE_URL,
      minZoom: Number(item.minZoom ?? 0) || 0,
      maxZoom: 22,
      isPublic: true,
      allowedPlans: ['*'],
      style: {
        color,
        fillColor: color,
        opacity: item.opacity ?? GEOBAHIA_DEFAULT_TRANSPARENCY,
        fillOpacity: item.fillOpacity ?? GEOBAHIA_DEFAULT_TRANSPARENCY,
        weight: item.geometry === 'line' ? 3 : 2
      },
      metadata: {
        layerName: item.layer,
        layers: item.layer,
        legacyLayerNames: geobahiaLegacyLayerNames(item),
        remoteMode: true,
        autoSeed: 'geobahia-inema-v21.9.30-wms-oficial',
        officialCatalogGroup: item.group,
        officialWmsTitle: item.name,
        forceWmsColor,
        wmsSymbolizer: geobahiaSymbolizer(item),
        styles: '',
        officialWmsStyle: '',
        directWms: true,
        useOfficialFallback: false,
        forceStoredData: false,
        format: 'image/png',
        transparent: true,
        wmsVersion: '1.1.1',
        configuredAt: new Date().toISOString()
      }
    };
  }

  async function ensureGeobahiaGroups() {
    const groupNames = [...new Set(geobahiaAutomaticCatalog.map((item) => item.group))];
    const bySlug = new Map(layerGroups.map((group) => [slugify(group.slug || group.name), group]));
    const byName = new Map(layerGroups.map((group) => [String(group.name || '').trim().toLowerCase(), group]));
    const resolved = new Map();

    for (const [index, name] of groupNames.entries()) {
      const slug = slugify(name.replace(/^\d+\.\s*/, ''));
      let group = bySlug.get(slug) || byName.get(name.toLowerCase());
      if (!group || !validSqlGuid(group.id)) {
        group = await auth.createLayerGroup({
          name,
          slug,
          description: `Grupo automático do catálogo GeoBahia / INEMA WMS.`,
          sortOrder: 1000 + index
        });
        layerGroups.push(group);
        bySlug.set(slug, group);
        byName.set(name.toLowerCase(), group);
      }
      resolved.set(name, group);
    }
    layerGroups = await auth.loadLayerGroups().catch(() => layerGroups);
    return resolved;
  }

  function findExistingGeobahiaLayer(item) {
    const layerName = normalizeCatalogLayerKey(item.layer);
    const shortLayerName = catalogLayerShortName(item.layer);
    const legacyNames = new Set(geobahiaLegacyLayerNames(item).map(normalizeCatalogLayerKey));
    const desiredSlug = geobahiaLayerSlug(item);
    const titleKey = normalizeGeobahiaLookupText(item.name);
    return layers.find((layer) => {
      const stored = normalizeCatalogLayerKey(layer?.metadata?.layerName || layer?.metadata?.layers || '');
      const storedShort = catalogLayerShortName(stored);
      return stored === layerName || storedShort === shortLayerName || legacyNames.has(stored);
    })
      || layers.find((layer) => normalizeCatalogLayerKey(layer?.slug) === normalizeCatalogLayerKey(desiredSlug))
      || layers.find((layer) => normalizeGeobahiaLookupText(layer?.metadata?.officialWmsTitle || layer?.name) === titleKey)
      || null;
  }

  function normalizeGeobahiaLookupText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[–—]/g, '-')
      .replace(/[^a-z0-9]+/gi, ' ')
      .trim()
      .toLowerCase();
  }

  function geobahiaTitleAliases(title) {
    const clean = String(title || '').trim();
    const base = normalizeGeobahiaLookupText(clean);
    const aliases = new Set([base]);
    aliases.add(base.replace(/^imoveis rurais /, 'imovel rural '));
    aliases.add(base.replace(/^imovel rural /, 'imoveis rurais '));
    aliases.add(base.replace(/ areas /g, ' area '));
    aliases.add(base.replace(/ area /g, ' areas '));
    aliases.add(base.replace(/ vegetacoes /g, ' vegetacao '));
    aliases.add(base.replace(/ vegetacao /g, ' vegetacoes '));
    aliases.add(base.replace(/ rppn estadual inema 2026$/, 'rppn estadual inema'));
    return [...aliases].filter(Boolean);
  }

  async function loadGeobahiaCapabilities() {
    const data = await auth.apiFetch(`/api/geoservices/wms-capabilities?target=${encodeURIComponent(GEOBAHIA_WMS_BASE_URL)}`);
    const layersList = Array.isArray(data?.layers) ? data.layers : [];
    const byName = new Map();
    const byTitle = new Map();
    for (const layer of layersList) {
      const item = {
        name: String(layer.name || '').trim(),
        title: String(layer.title || '').trim(),
        workspace: String(layer.workspace || '').trim()
      };
      if (!item.name) continue;
      byName.set(normalizeCatalogLayerKey(item.name), item);
      geobahiaTitleAliases(item.title || item.name).forEach((alias) => {
        if (alias && !byTitle.has(alias)) byTitle.set(alias, item);
      });
    }
    return { count: layersList.length, byName, byTitle };
  }

  function resolveGeobahiaItemFromCapabilities(item, capabilities) {
    const exact = capabilities.byName.get(normalizeCatalogLayerKey(item.layer));
    if (exact?.name) return { ...item, layer: exact.name, resolvedTitle: exact.title, resolvedBy: 'nome técnico' };

    for (const alias of geobahiaTitleAliases(item.name)) {
      const byTitle = capabilities.byTitle.get(alias);
      if (byTitle?.name) return { ...item, layer: byTitle.name, resolvedTitle: byTitle.title, resolvedBy: 'título oficial' };
    }

    const shortName = normalizeCatalogLayerKey(String(item.layer || '').split(':').pop());
    const bySuffix = [...capabilities.byName.values()].find((layer) => normalizeCatalogLayerKey(String(layer.name || '').split(':').pop()) === shortName);
    if (bySuffix?.name) return { ...item, layer: bySuffix.name, resolvedTitle: bySuffix.title, resolvedBy: 'sufixo técnico' };

    return null;
  }

  async function archiveBrokenGeobahiaLayers(validLayerNames) {
    const valid = new Set([...validLayerNames].map(normalizeCatalogLayerKey));
    let archived = 0;
    for (const layer of layers) {
      const autoSeed = String(layer?.metadata?.autoSeed || '');
      if (!autoSeed.startsWith('geobahia-inema')) continue;
      const layerName = normalizeCatalogLayerKey(layer?.metadata?.layerName || layer?.metadata?.layers || '');
      if (!layerName || valid.has(layerName)) continue;
      try {
        await auth.updateLayer(layer.id, {
          isPublic: false,
          metadata: {
            ...(layer.metadata || {}),
            invalidatedBySeedAt: new Date().toISOString(),
            invalidReason: 'Nome técnico não encontrado no GetCapabilities atual do GeoBahia/INEMA.'
          }
        });
        archived += 1;
      } catch (error) {
        console.warn('[GeoBahia auto] não foi possível despublicar camada inválida:', layer?.name, error);
      }
    }
    return archived;
  }

  async function seedGeobahiaLayers() {
    const button = $('seedGeobahiaLayers');
    const statusBox = $('seedGeobahiaStatus');
    if (!button) return;
    if (!confirm(`Adicionar/corrigir automaticamente todos os grupos e camadas GeoBahia / INEMA no Appwrite?

O sistema vai criar os grupos das camadas, cadastrar as camadas WMS oficiais e atualizar as existentes sem duplicar.`)) return;

    button.disabled = true;
    const originalText = button.textContent;
    if (statusBox) statusBox.textContent = 'Iniciando cadastro automático de grupos e camadas GeoBahia no Appwrite...';
    let created = 0;
    let updated = 0;
    let published = 0;
    let skipped = 0;
    let restored = 0;
    const startedAt = new Date().toISOString();

    try {
      if (typeof auth.seedGeobahiaOfficialLayers === 'function') {
        try {
          button.textContent = 'Cadastrando grupos e camadas no Appwrite...';
          if (statusBox) statusBox.textContent = 'Criando grupos e cadastrando camadas GeoBahia no Appwrite. Aguarde...';
          const result = await auth.seedGeobahiaOfficialLayers();
          const successMessage = `GeoBahia cadastrado no Appwrite: ${Number(result.groupsCreated || 0)} grupo(s) criado(s), ${Number(result.groupsUpdated || 0)} grupo(s) atualizado(s), ${Number(result.created || 0)} camada(s) criada(s), ${Number(result.updated || 0)} camada(s) atualizada(s), ${Number(result.restored || 0)} restaurada(s), ${Number(result.skipped || 0)} ignorada(s).`;
          if (statusBox) statusBox.textContent = successMessage;
          notify(successMessage, 'success');
          await refresh();
          return;
        } catch (backendSeedError) {
          const seedMessage = String(backendSeedError?.message || '');
          if (!/Rota não encontrada|not found|404/i.test(seedMessage)) throw backendSeedError;
          console.warn('[GeoBahia auto] seed server-side indisponível, usando fallback do painel:', backendSeedError);
        }
      }

      button.textContent = 'Preparando grupos GeoBahia...';
      if (statusBox) statusBox.textContent = 'Rota automática da Function indisponível. Usando fallback do painel para criar grupos e camadas...';
      const groupMap = await ensureGeobahiaGroups();
      layers = await auth.loadAdminLayers().catch(() => layers);

      for (let index = 0; index < geobahiaAutomaticCatalog.length; index += 1) {
        const item = geobahiaAutomaticCatalog[index];
        const group = groupMap.get(item.group);
        if (!group?.id) { skipped += 1; continue; }

        const payload = geobahiaLayerPayload(item, group.id);
        payload.description = `${item.group} • GeoBahia / INEMA • WMS oficial GeoServer: ${item.layer}`;
        payload.metadata = {
          ...payload.metadata,
          resolvedByCapabilities: false,
          resolvedBy: 'catalogo-interno-v21.9.30-wms-oficial',
          officialWmsTitle: item.name,
          catalogSeededAt: startedAt,
          capabilitiesSkippedReason: 'GetCapabilities do GeoBahia/INEMA é pesado e pode exceder o tempo limite da API.'
        };

        const existing = findExistingGeobahiaLayer(item);
        button.textContent = `${index + 1}/${geobahiaAutomaticCatalog.length} • ${item.name.slice(0, 34)}...`;

        let saved = null;
        if (existing?.id) {
          const wasArchived = String(existing.status || '').toLowerCase() === 'archived' || existing.isPublic === false;
          saved = await auth.updateLayer(existing.id, {
            ...payload,
            isPublic: true,
            metadata: { ...(existing.metadata || {}), ...payload.metadata, updatedBySeedAt: new Date().toISOString() }
          });
          updated += 1;
          if (wasArchived) restored += 1;
        } else {
          saved = await auth.createLayer(payload);
          created += 1;
        }

        if (saved?.id && !(saved.status === 'ready' && saved.isPublic)) {
          await auth.publishLayer(saved.id, true).catch((error) => console.warn('[GeoBahia auto] publicação ignorada:', saved?.name, error));
          published += 1;
        }
      }

      const fallbackMessage = `GeoBahia corrigido com WMS oficial: ${created} criada(s), ${updated} atualizada(s), ${restored} restaurada(s), ${published} publicada(s), ${skipped} ignorada(s).`;
      if (statusBox) statusBox.textContent = fallbackMessage;
      notify(fallbackMessage, 'success');
      await refresh();
    } catch (error) {
      console.error('[GeoBahia auto]', error);
      const message = String(error?.message || 'Não foi possível adicionar o catálogo GeoBahia automaticamente.');
      if (statusBox) statusBox.textContent = `Falha ao cadastrar automaticamente: ${message}`;
      if (/GetCapabilities/i.test(message)) {
        notify('GeoBahia corrigido: esta versão não depende mais do GetCapabilities. Atualize a página com Ctrl+F5 e clique novamente.', 'error');
      } else {
        notify(message, 'error');
      }
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  async function refresh(options = {}) {
    const force = Boolean(options.forceRefresh);
    const hasProcessingBeforeRefresh = layers.some((layer) =>
      (layer.sourceUpload && ['uploading', 'queued', 'processing'].includes(layer.sourceUpload.status))
      || (layer.remoteImport && ['queued', 'running', 'processing'].includes(layer.remoteImport.status))
      || (layer.spatialIndex && ['queued', 'building'].includes(layer.spatialIndex.status))
    );
    const layerOptions = force || hasProcessingBeforeRefresh ? { forceRefresh: true } : {};
    const tasks = await Promise.allSettled([
      auth.loadPlans(force ? { forceRefresh: true } : {}),
      auth.loadUsers(force ? { forceRefresh: true } : {}),
      auth.loadAdminLayers(layerOptions),
      auth.loadLayerGroups(force ? { forceRefresh: true } : {}),
      auth.loadAdminNotices?.(force ? { forceRefresh: true } : {}) || Promise.resolve([])
    ]);

    if (tasks[0]?.status === 'fulfilled') plans = tasks[0].value;
    if (tasks[1]?.status === 'fulfilled') users = tasks[1].value;
    if (tasks[2]?.status === 'fulfilled') layers = tasks[2].value;
    if (tasks[3]?.status === 'fulfilled') layerGroups = tasks[3].value;
    if (tasks[4]?.status === 'fulfilled') notices = tasks[4].value || [];

    renderStats();
    renderUsers();
    renderMemorialModels();
    renderPlans();
    populateLayerFilters();
    renderLayers();
    populateNoticeTargets();
    renderNotices();
    await loadAdvancedAdminData().catch((error) => console.warn('[admin avançado]', error?.message || error));

    const failures = tasks
      .map((item, index) => item?.status === 'rejected' ? ({ index, error: item.reason }) : null)
      .filter(Boolean);
    if (failures.length) {
      failures.forEach(({ index, error }) => console.error(['planos', 'usuários', 'camadas', 'grupos de camadas', 'avisos'][index], error));
      const migrationFailure = failures.find(({ error }) => /migraç|LayerData|AllowedPlansJson|PublishedAt|DataFormat/i.test(error?.message || ''));
      notify(
        migrationFailure
          ? 'O painel carregou parcialmente. Verifique a configuração das coleções de camadas no Appwrite para liberar o catálogo.'
          : failures[0].error?.message || 'Parte do painel não pôde ser carregada.',
        'error'
      );
    }

    clearTimeout(layerRefreshTimer);
    const hasProcessingLayer = layers.some((layer) =>
      (layer.sourceUpload && ['uploading', 'queued', 'processing'].includes(layer.sourceUpload.status))
      || (layer.spatialIndex && ['queued', 'building'].includes(layer.spatialIndex.status))
    );
    if (hasProcessingLayer) layerRefreshTimer = setTimeout(() => refresh({ forceRefresh: true }), 5000);
  }

  document.querySelectorAll('.admin-tabs button').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('.admin-tabs button').forEach((item) => item.classList.toggle('active', item === button));
    document.querySelectorAll('.admin-panel').forEach((panel) => panel.classList.toggle('active', panel.id === `tab-${button.dataset.tab}`));
  }));

  const openRequestedAdminTab = () => {
    const requested = new URLSearchParams(location.search).get('tab');
    if (!requested) return;
    const button = document.querySelector(`.admin-tabs button[data-tab="${CSS.escape(requested)}"]`);
    if (button) button.click();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(openRequestedAdminTab, 0), { once:true });
  else setTimeout(openRequestedAdminTab, 0);


  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => {
    const target = button.dataset.close;
    if (target === 'layerDialog' && layerImportBusy) {
      notify('A conversão ou o envio ainda está em andamento. Use “Cancelar processamento” antes de fechar.', 'error');
      return;
    }
    $(target).close();
  }));
  $('openUserDialog')?.addEventListener('click', () => openUser());
  $('openUserDialogInline')?.addEventListener('click', () => openUser());
  $('adminUserSearch').addEventListener('input', renderUsers);
  $('adminMemorialModels')?.addEventListener('change', async (event) => {
    const input=event.target.closest('[data-memorial-model-access][data-user-id]');
    if(!input) return;
    const userId=String(input.dataset.userId||'');
    const modelId=String(input.dataset.memorialModelAccess||'');
    const user=users.find((item)=>String(item.id)===userId);
    if(!user) return;
    const before=userMemorialTemplateIds(user);
    const next=new Set(before);
    if(input.checked) next.add(modelId); else next.delete(modelId);
    input.disabled=true;
    try{
      const result=await auth.updateRemoteUser(userId,{allowedMemorialTemplateIds:[...next]});
      user.allowedMemorialTemplateIds=Array.isArray(result?.allowedMemorialTemplateIds)?result.allowedMemorialTemplateIds:[...next];
      notify(`${modelId==='agro-mais'?'Modelo Agro+':'Modelo'} ${input.checked?'liberado':'removido'} para ${user.name||user.email}.`,'success');
      renderMemorialModels();
    }catch(error){
      input.checked=!input.checked;
      notify(error?.message||'Não foi possível atualizar o acesso ao modelo.','error');
    }finally{ input.disabled=false; }
  });

  // REV14: o Assistente IA foi isolado em assets/js/admin/ai.js.

  $('refreshAdvancedAdmin')?.addEventListener('click', () => loadAdvancedAdminData().catch((error) => notify(error.message || 'Erro ao atualizar painel avançado.', 'error')));
  $('refreshAdvancedSecurity')?.addEventListener('click', () => loadAdvancedAdminData().catch((error) => notify(error.message || 'Erro ao atualizar segurança.', 'error')));
  $('saveAdvancedSecurity')?.addEventListener('click', () => saveAdvancedSecuritySettings().catch((error) => notify(error.message || 'Erro ao salvar segurança.', 'error')));
  $('createMetadataBackup')?.addEventListener('click', () => createMetadataBackup().catch((error) => notify(error.message || 'Erro ao criar backup.', 'error')));
  document.addEventListener('click', (event) => { const button = event.target.closest('[data-admin-logout-user]'); if (button) remoteLogoutUser(button.dataset.adminLogoutUser).catch((error) => notify(error.message || 'Erro no logout remoto.', 'error')); });
  $('addLayerButton').addEventListener('click', () => openLayer());
  $('addLayerGroupButton').addEventListener('click', () => $('layerGroupDialog').showModal());
  $('seedGeobahiaLayers')?.addEventListener('click', seedGeobahiaLayers);
  $('adminLayerGroupFilter')?.addEventListener('change', () => { layerFilterGroup = $('adminLayerGroupFilter').value || 'all'; syncSelectedLayerGroupAction(); renderLayers(); });
  $('adminLayerSearch')?.addEventListener('input', () => { layerFilterText = $('adminLayerSearch').value || ''; renderLayers(); });
  $('layerSourceMode').addEventListener('change', () => { updateLayerSourceFields(); applyAutomaticLayerColor(true); updateWmsStyleControls(); });
  $('layerRemoteType').addEventListener('change', () => { updateLayerSourceFields(); applyAutomaticLayerColor(true); updateWmsStyleControls(); });
  $('layerServiceUrl').addEventListener('input', () => { updateLayerSourceFields(); applyAutomaticLayerColor(true); updateWmsStyleControls(); });
  $('layerWmsName').addEventListener('input', () => {
    if (!layerColorManuallyEdited && !$('editLayerId').value) $('layerWmsSymbolizer').value = inferWmsSymbolizer($('layerWmsName').value);
    updateWmsStyleControls();
  });
  ['layerName','layerSourceName','layerGeometry'].forEach((id) => $(id).addEventListener('input', () => applyAutomaticLayerColor(true)));
  $('layerColor').addEventListener('input', () => setLayerColorValue($('layerColor').value, { manual: true }));
  $('layerColorHex').addEventListener('input', () => {
    const raw = $('layerColorHex').value.trim();
    if (/^#?[0-9a-f]{6}$/i.test(raw) || /^#?[0-9a-f]{3}$/i.test(raw)) setLayerColorValue(raw, { manual: true });
  });
  $('layerColorHex').addEventListener('blur', () => setLayerColorValue($('layerColorHex').value, { manual: true }));
  $('layerForceWmsColor').addEventListener('change', updateWmsStyleControls);
  $('cancelLayerImport').addEventListener('click', async () => {
    if (activeLayerUploadId) {
      layerUploadController?.abort();
      updateLayerImportProgress({ percent: 0, message: 'Cancelando upload e processamento...' });
      try { await auth.cancelLayerSourceUpload(activeLayerUploadId); } catch {}
      notify('Upload ou processamento cancelado.', 'error');
      return;
    }
    const cancelled = window.GeoRuralLayerImport?.cancelCurrentImport?.();
    if (cancelled) {
      updateLayerImportProgress({ percent: 0, message: 'Cancelando conversão...' });
      notify('Conversão cancelada.', 'error');
    } else {
      notify('Não há processamento ativo para cancelar.', 'error');
    }
  });
  $('layerName').addEventListener('input', () => { if (!$('editLayerId').value) $('layerSlug').value = slugify($('layerName').value); });
  $('layerGroupName').addEventListener('input', () => { $('layerGroupSlug').value = slugify($('layerGroupName').value); });

  $('adminUsersTable').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-user-action]');
    if (!button) return;
    const user = users.find((item) => item.id === button.dataset.id);
    if (!user) return;
    if (button.dataset.userAction === 'team') return openWorkspaceTeam(user);
    if (button.dataset.userAction === 'edit-subuser') return openWorkspaceTeam(user, user.id);
    if (button.dataset.userAction === 'delete-subuser') return removeWorkspaceMember(user);
    if (button.dataset.userAction === 'edit') return openUser(user);
    if (button.dataset.userAction === 'change-email') return openUserEmailChange(user);
    if (button.dataset.userAction === 'delete-user') {
      const label = user.email || user.name || user.id;
      const warning = user.profileIncomplete
        ? `Excluir definitivamente o cadastro incompleto de ${label}?`
        : `Excluir definitivamente o usuário ${label}? A exclusão só será permitida se ele não possuir projetos, documentos ou membros de equipe.`;
      if (!confirm(`${warning}

Para usuários com dados, use Bloquear para preservar o histórico.`)) return;
      const typed = prompt('Digite EXCLUIR para confirmar a remoção definitiva:');
      if (String(typed || '').trim().toUpperCase() !== 'EXCLUIR') {
        notify('Exclusão cancelada.', 'error');
        return;
      }
      button.disabled = true;
      try {
        const result = await auth.deleteRemoteUser(user.id);
        notify(result?.deletionMode === 'complete_without_data'
          ? 'Usuário sem dados excluído definitivamente.'
          : 'Cadastro incompleto excluído definitivamente.', 'success');
        await refresh({ forceRefresh: true });
      } catch (error) {
        notify(error.message || 'Não foi possível excluir o usuário. Use Bloquear quando houver dados vinculados.', 'error');
      } finally {
        button.disabled = false;
      }
      return;
    }
    if (button.dataset.userAction === 'toggle') {
      button.disabled = true;
      try {
        const nextStatus = userStatusKey(user) === 'active' ? 'blocked' : 'active';
        if (user.isSubuser) await auth.updateSubuser(user.id, { status: nextStatus });
        else await auth.updateRemoteUser(user.id, { status: nextStatus });
        notify(nextStatus === 'blocked' ? 'Usuário bloqueado.' : 'Usuário desbloqueado.', 'success');
        await refresh();
      } catch (error) {
        notify(error.message, 'error');
      } finally {
        button.disabled = false;
      }
    }
    if (button.dataset.userAction === 'verification') {
      const nextVerified = button.dataset.verified !== '1';
      const ok = nextVerified || confirm('Resetar a verificação deste usuário? No próximo acesso, ele precisará confirmar o e-mail novamente quando a proteção estiver ativada.');
      if (!ok) return;
      button.disabled = true;
      try {
        if (user.isSubuser) await auth.updateSubuser(user.id, { emailVerified: nextVerified });
        else await auth.updateRemoteUser(user.id, { emailVerified: nextVerified });
        notify(nextVerified ? 'Usuário marcado como verificado.' : 'Verificação do usuário resetada.', 'success');
        await refresh();
      } catch (error) {
        notify(error.message, 'error');
      } finally {
        button.disabled = false;
      }
    }
  });


  $('generateUserPassword')?.addEventListener('click', fillGeneratedUserPassword);
  $('copyUserPassword')?.addEventListener('click', () => copyUserPassword().catch((error) => notify(error.message || 'Não foi possível copiar a senha.', 'error')));
  $('openUserEmailChangeFromEditor')?.addEventListener('click', () => {
    const userId = String($('editUserId')?.value || '').trim();
    const user = users.find((item) => String(item.id) === userId);
    if (!user) return notify('Não foi possível localizar o usuário para alterar o e-mail.', 'error');
    $('userDialog')?.close();
    setTimeout(() => openUserEmailChange(user), 40);
  });
  $('userEmailForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = $('emailChangeSubmit');
    const userId = String($('emailChangeUserId')?.value || '').trim();
    const newEmail = String($('emailChangeNew')?.value || '').trim().toLowerCase();
    if (!userId) return notify('Usuário não identificado. Feche a janela e tente novamente.', 'error');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return notify('Informe um novo e-mail válido.', 'error');
    if (!$('emailChangeConfirm')?.checked) return notify('Confirme que deseja alterar o login do cliente.', 'error');
    submit.disabled = true;
    submit.textContent = 'Alterando e-mail...';
    try {
      const result = await auth.updateUserEmail(userId, {
        email: newEmail,
        emailVerified: Boolean($('emailChangeVerified')?.checked),
        notifyNewEmail: Boolean($('emailChangeNotifyNew')?.checked),
        notifyOldEmail: Boolean($('emailChangeNotifyOld')?.checked)
      });
      $('userEmailDialog').close();
      users = await auth.loadUsers({ forceRefresh: true });
      renderUsers();
      const failedNotifications = [result?.notifications?.newEmail, result?.notifications?.oldEmail]
        .filter((item) => item && item.requested && !item.sent);
      notify(failedNotifications.length
        ? 'E-mail de acesso alterado e dados preservados. Uma das notificações não pôde ser enviada.'
        : 'E-mail de acesso alterado. O cliente continuará com os mesmos dados e a mesma senha.', failedNotifications.length ? 'error' : 'success');
    } catch (error) {
      notify(error.message || 'Não foi possível alterar o e-mail de acesso.', 'error');
    } finally {
      submit.disabled = false;
      submit.textContent = 'Alterar e-mail de acesso';
    }
  });

  // Delegação canônica dos controles de equipe, independente da ordem de bootstrap dos módulos administrativos.
  document.addEventListener('click', (event) => {
    const add = event.target.closest('#workspaceAddMemberToggle');
    if (add) { event.preventDefault(); resetWorkspaceMemberForm(null, { open: true }); return; }
    const retry = event.target.closest('[data-workspace-retry]');
    if (retry) { event.preventDefault(); const ownerId = String($('workspaceOwnerUserId')?.value || ''); if (ownerId) openWorkspaceTeam(ownerId); }
  });

  $('workspaceTeamName')?.addEventListener('input', () => {
    workspaceTeamState.nameDirty = true;
    $('workspaceTeamName').dataset.userDirty = '1';
  });
  $('workspaceTeamName')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveWorkspaceTeamName();
    }
  });
  $('workspaceTeamSaveName')?.addEventListener('click', saveWorkspaceTeamName);
  $('workspaceSubuserForm')?.addEventListener('submit', saveWorkspaceMember);
  $('workspaceMemberMode')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-workspace-member-mode]');
    if (!button || workspaceTeamState.editing) return;
    setWorkspaceMemberMode(button.dataset.workspaceMemberMode);
  });
  $('workspaceSubuserCancelEdit')?.addEventListener('click', () => resetWorkspaceMemberForm(null, { open: false }));
  $('workspaceAddMemberToggle')?.addEventListener('click', () => resetWorkspaceMemberForm(null, { open: true }));
  $('workspaceMemberEditorCancel')?.addEventListener('click', () => resetWorkspaceMemberForm(null, { open: false }));
  $('workspaceMembersTable')?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-workspace-action]');
    if (!button) return;
    const member = workspaceTeamState.team?.members?.find((item) => item.id === button.dataset.id);
    if (!member) return;
    if (button.dataset.workspaceAction === 'edit') return resetWorkspaceMemberForm(member);
    if (button.dataset.workspaceAction === 'delete') return removeWorkspaceMember(member);
    if (button.dataset.workspaceAction === 'toggle') {
      button.disabled = true;
      try {
        const nextStatus = userStatusKey(member) === 'active' ? 'blocked' : 'active';
        const result = await auth.updateSubuser(member.id, { status: nextStatus });
        renderWorkspaceTeam(result.team);
        users = await auth.loadUsers({ forceRefresh: true });
        renderUsers();
        notify(nextStatus === 'blocked' ? 'Subusuário bloqueado.' : 'Subusuário ativado.', 'success');
      } catch (error) { notify(error.message || 'Não foi possível alterar o acesso.', 'error'); }
      finally { button.disabled = false; }
    }
  });

  function addDaysToUserExpiry(days) {
    const input = $('userExpiry');
    if (!input) return;
    const today = new Date(); today.setHours(0,0,0,0);
    const current = input.value ? new Date(`${input.value}T00:00:00`) : today;
    const base = Number.isFinite(current.getTime()) && current > today ? current : today;
    base.setDate(base.getDate() + Number(days || 0));
    input.value = base.toISOString().slice(0,10);
    $('userStatus').value = 'active';
  }
  $('userPlan')?.addEventListener('change', () => { updateUserPlanCalculation(); renderUserWorkspaceDrafts(); });
  $('userWizardNext')?.addEventListener('click', () => {
    try { validateUserWizardStep(userOnboardingState.step); setUserWizardStep(userOnboardingState.step + 1); }
    catch (error) { notify(error.message || 'Revise os dados desta etapa.', 'error'); }
  });
  $('userWizardBack')?.addEventListener('click', () => setUserWizardStep(userOnboardingState.step - 1));
  $('userAddWorkspaceMember')?.addEventListener('click', addUserWorkspaceDraft);
  $('userWorkspaceMemberDrafts')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-onboarding-member]');
    if (!button) return;
    collectUserWorkspaceDrafts();
    const index = Number(button.dataset.removeOnboardingMember);
    if (!Number.isInteger(index)) return;
    userOnboardingState.workspaceMembers.splice(index, 1);
    renderUserWorkspaceDrafts({ preserveInputs: false });
    renderUserOnboardingReview();
  });
  $('userManageWorkspace')?.addEventListener('click', () => {
    const ownerId = $('editUserId')?.value.trim();
    if (!ownerId) return;
    $('userDialog')?.close();
    openWorkspaceTeam(ownerId);
  });
  $('userSendWelcomeEmail')?.addEventListener('change', renderUserOnboardingReview);
  $('userUseOfficialSignature')?.addEventListener('click', () => loadUserOnboardingSignature({ forceOfficial: true }).then(() => notify('Assinatura oficial carregada.', 'success')).catch((error) => notify(error.message || 'Não foi possível carregar a assinatura.', 'error')));
  $('userClearOnboardingSignature')?.addEventListener('click', () => { userOnboardingState.signatureDataUrl = ''; updateUserSignatureEditor(); });
  $('userResetSignaturePosition')?.addEventListener('click', () => { userOnboardingState.signaturePosition = { x: 50, y: 44, scale: 100 }; updateUserSignatureEditor(); });
  $('userOnboardingSignatureScale')?.addEventListener('input', (event) => { userOnboardingState.signaturePosition.scale = Number(event.target.value || 100); updateUserSignatureEditor(); });
  $('userOnboardingSignatureFile')?.addEventListener('change', async (event) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;
      userOnboardingState.signatureDataUrl = await userSignatureFileToPng(file);
      updateUserSignatureEditor();
      notify('Assinatura carregada para o comprovante.', 'success');
    } catch (error) { notify(error.message || 'Não foi possível ler a assinatura.', 'error'); }
  });
  $('userOnboardingSignatureZone')?.addEventListener('pointerdown', (event) => { if (!userOnboardingState.signatureDataUrl) return; userOnboardingState.signatureDragging = true; event.currentTarget.setPointerCapture?.(event.pointerId); pointerToUserSignature(event); });
  $('userOnboardingSignatureZone')?.addEventListener('pointermove', (event) => { if (userOnboardingState.signatureDragging) pointerToUserSignature(event); });
  $('userOnboardingSignatureZone')?.addEventListener('pointerup', () => { userOnboardingState.signatureDragging = false; });
  $('userOnboardingSignatureZone')?.addEventListener('pointercancel', () => { userOnboardingState.signatureDragging = false; });

  $('renewUser30Days')?.addEventListener('click', () => addDaysToUserExpiry(30));
  $('renewUser365Days')?.addEventListener('click', () => addDaysToUserExpiry(365));
  $('reactivateUser')?.addEventListener('click', () => {
    const input = $('userExpiry');
    const current = input?.value ? new Date(`${input.value}T23:59:59`) : null;
    if (!current || !Number.isFinite(current.getTime()) || current.getTime() < Date.now()) addDaysToUserExpiry(30);
    $('userStatus').value = 'active';
  });

  function blobToBase64ForUser(blob) {
    return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '').split(',')[1] || ''); reader.onerror = reject; reader.readAsDataURL(blob); });
  }

  $('userForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = event.submitter || $('userSaveButton');
    if (submit) submit.disabled = true;
    const editId = $('editUserId').value.trim();
    if (editId && !/^[A-Za-z0-9._:-]{6,120}$/.test(editId)) {
      if (submit) submit.disabled = false;
      notify('O identificador do usuário é inválido. Atualize a página e tente novamente.', 'error');
      return;
    }
    const normalizedWhatsapp = normalizeBrazilWhatsapp($('userWhatsapp').value);
    const originalWhatsapp = normalizeBrazilWhatsapp($('userDialog').dataset.originalWhatsapp || '');
    const common = {
      name: $('userName').value.trim(),
      role: $('userRole').value,
      planSlug: $('userPlan').value,
      expiresAt: editId ? ($('userExpiry').value ? `${$('userExpiry').value}T23:59:59-03:00` : null) : null,
      status: $('userStatus').value
    };
    if (!editId || normalizedWhatsapp !== originalWhatsapp) {
      common.whatsapp = normalizedWhatsapp;
      common.phone = normalizedWhatsapp;
      common.whatsappOptIn = false;
      common.whatsappReminderDays = [];
    }
    if ($('userPassword').value) common.password = $('userPassword').value;
    try {
      if (editId) {
        const wasIncomplete = $('userDialog').classList.contains('incomplete-user');
        await auth.updateRemoteUser(editId, common);
        notify(wasIncomplete ? 'Cadastro incompleto corrigido e usuário liberado para edição normal.' : 'Usuário atualizado.', 'success');
      } else {
        [1, 2, 3, 4].forEach((step) => validateUserWizardStep(step));
        const calculated = updateUserPlanCalculationWithoutReview();
        common.expiresAt = calculated.endDate ? `${calculated.endDate}T23:59:59-03:00` : null;
        common.subscriptionStartedAt = `${calculated.startDate}T00:00:00-03:00`;
        common.paymentAmountCents = calculated.amountCents;
        common.paymentMethod = $('userPaymentMethod').value;
        common.clientDocument = $('userClientDocument').value.trim();
        const payload = {
          ...common,
          email: $('userEmail').value.trim().toLowerCase(),
          emailVerified: true,
          accountSource: 'admin',
          creationRequestId: userOnboardingState.requestId || (crypto.randomUUID?.() || `admin-${Date.now()}`)
        };
        payload.workspaceMembers = collectUserWorkspaceDrafts({ validate: true }).map((member) => ({
          ...member,
          whatsapp: member.whatsapp ? normalizeBrazilWhatsapp(member.whatsapp) : null
        }));
        validateNewUser(payload);
        if ($('userSendWelcomeEmail').checked) {
          const documentApi = window.SurveyorPlanDocuments;
          if (!documentApi?.createOnboardingPdf) throw new Error('O gerador do comprovante ainda não terminou de carregar. Atualize a página e tente novamente.');
          if (submit) submit.textContent = 'Gerando comprovante...';
          const pdf = await documentApi.createOnboardingPdf({
            planSlug: calculated.plan.slug,
            clientName: payload.name,
            clientDocument: common.clientDocument,
            clientEmail: payload.email,
            clientPhone: $('userWhatsapp').value.trim(),
            paymentMethod: common.paymentMethod,
            paymentDate: calculated.startDate,
            startDate: calculated.startDate,
            endDate: calculated.endDate,
            amountCents: calculated.amountCents,
            accessEmail: payload.email,
            signatureDataUrl: userOnboardingState.signatureDataUrl,
            signaturePosition: userOnboardingState.signaturePosition
          });
          payload.onboardingDocument = {
            sendEmail: true,
            documentType: 'receipt',
            filename: pdf.filename,
            contentBase64: await blobToBase64ForUser(pdf.blob),
            startDate: calculated.startDate,
            endDate: calculated.endDate,
            amountCents: calculated.amountCents,
            documentCode: pdf.data.code,
            planName: calculated.plan.name
          };
        } else payload.onboardingDocument = { sendEmail: false };
        if (submit) submit.textContent = 'Criando conta...';
        const result = await auth.createUser(payload);
        const workspaceCreated = Array.isArray(result?.workspaceSetup?.created) ? result.workspaceSetup.created.length : Number(result?.workspaceSetup?.created || 0);
        const workspaceFailed = Array.isArray(result?.workspaceSetup?.failed) ? result.workspaceSetup.failed : [];
        if (workspaceFailed.length) {
          notify(`Titular criado e ${workspaceCreated} subusuário(s) vinculado(s), mas ${workspaceFailed.length} acesso(s) falharam. Abra a equipe para concluir.`, 'error');
        } else if (result?.onboardingEmail?.sent) {
          notify(`Usuário criado, ${workspaceCreated} subusuário(s) vinculado(s) e comprovante enviado para ${payload.email}. A senha temporária já pode ser usada no login.`, 'success');
        } else if (result?.onboardingEmail?.error) {
          notify(`Usuário e equipe criados, mas o e-mail do titular não foi enviado: ${result.onboardingEmail.error}`, 'error');
        } else {
          notify(`Usuário criado no Appwrite${workspaceCreated ? ` com ${workspaceCreated} subusuário(s)` : ''}.`, 'success');
        }
      }
      $('userDialog').close();
      await refresh();
    } catch (error) {
      const message = String(error?.message || 'Não foi possível salvar o usuário.');
      const duplicateTarget = /same ID already exists|target.*already exists|already exists|já existe/i.test(message);
      if (!editId && duplicateTarget) {
        try {
          users = await auth.loadUsers({ forceRefresh: true });
          renderUsers();
          const email = $('userEmail').value.trim().toLowerCase();
          const recovered = users.find((item) => String(item.email || '').trim().toLowerCase() === email);
          if (recovered) {
            $('userDialog').close();
            notify('A conta já havia sido criada na primeira tentativa e foi recuperada na lista. Revise o cadastro antes de continuar.', 'success');
          } else {
            notify('Já existe uma conta com este e-mail. Atualize a lista e use Renovar / editar para concluir o cadastro.', 'error');
          }
        } catch {
          notify('Já existe uma conta com este e-mail. Atualize a página e use Renovar / editar para concluir o cadastro.', 'error');
        }
      } else if (editId && duplicateTarget) {
        notify('O telefone informado já está vinculado a outro acesso no Appwrite. Os demais dados não foram alterados. Use outro telefone ou deixe o telefone atual.', 'error');
      } else {
        notify(message, 'error');
      }
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = editId ? 'Salvar alterações' : 'Criar usuário e enviar e-mail';
      }
    }
  });

  $('layerGroupForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = event.submitter;
    submit.disabled = true;
    try {
      const group = await auth.createLayerGroup({
        name: $('layerGroupName').value.trim(),
        slug: $('layerGroupSlug').value.trim(),
        description: $('layerGroupDescription').value.trim() || null,
        sortOrder: layerGroups.length
      });
      layerGroups = await auth.loadLayerGroups();
      $('layerGroupDialog').close();
      $('layerGroupForm').reset();
      notify('Grupo de camadas criado.', 'success');
      const created = layerGroups.find((item) => item.id === group.id) || group;
      openLayer();
      if (created?.id) $('layerGroup').value = created.id;
    } catch (error) {
      notify(error.message || 'Não foi possível criar o grupo.', 'error');
    } finally {
      submit.disabled = false;
    }
  });

  $('layerForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = event.submitter;
    submit.disabled = true;
    submit.textContent = 'Salvando...';
    layerImportCompleted = false;
    const editId = $('editLayerId').value;
    const existingLayer = editId ? layers.find((item) => item.id === editId) : null;
    const allowedPlans = [...$('layerAllowedPlans').querySelectorAll('input:checked')].map((input) => input.value);
    const selectedGroupId = $('layerGroup').value;
    if (!validSqlGuid(selectedGroupId)) {
      submit.disabled = false;
      submit.textContent = 'Salvar camada';
      notify('Selecione um grupo de camadas válido ou crie um novo grupo.', 'error');
      return;
    }

    const remoteMode = $('layerSourceMode').value === 'url';
    const remoteUrl = remoteMode ? $('layerServiceUrl').value.trim() : '';
    const selectedRemoteType = remoteMode
      ? $('layerRemoteType').value
      : null;
    const wmsLayerName = $('layerWmsName').value.trim();
    const remoteType = remoteMode
      ? effectiveRemoteServiceType({
          serviceUrl: remoteUrl,
          selectedType: selectedRemoteType,
          layerName: wmsLayerName,
          metadata: existingLayer?.metadata || {}
        })
      : null;

    // Mantém a interface coerente com o tipo que será realmente persistido.
    if (remoteMode && remoteType === 'wms') $('layerRemoteType').value = 'wms';

    if (remoteMode && !remoteUrl) {
      submit.disabled = false;
      submit.textContent = 'Salvar camada';
      notify('Informe a URL da camada ou do geosserviço.', 'error');
      return;
    }

    if (remoteMode && remoteType === 'wms' && !wmsLayerName) {
      submit.disabled = false;
      submit.textContent = 'Salvar camada';
      notify('Informe o nome técnico da camada WMS, por exemplo workspace:camada.', 'error');
      return;
    }

    // Em modo URL/WMS, nenhum arquivo será processado ou enviado.
    const selectedFiles = remoteMode ? [] : [...$('layerGeoJsonFile').files];
    if (selectedFiles.length > 1) {
      submit.disabled = false;
      submit.textContent = 'Salvar camada';
      notify('Selecione somente um arquivo por vez.', 'error');
      return;
    }
    const selectedFile = selectedFiles[0] || null;
    const isZipUpload = Boolean(selectedFile?.name?.toLowerCase().endsWith('.zip'));
    if (selectedFile && selectedFile.size > 1 * 1024 * 1024 * 1024) {
      submit.disabled = false;
      submit.textContent = 'Salvar camada';
      notify('O ZIP ultrapassa o limite máximo de 1 GB.', 'error');
      return;
    }

    const selectedLayerColor = setLayerColorValue($('layerColorHex').value || $('layerColor').value);
    const mixedContentRisk = remoteMode && /^http:\/\//i.test(remoteUrl);
    const payload = {
      groupId: selectedGroupId,
      name: $('layerName').value.trim(),
      slug: slugify($('layerSlug').value),
      description: $('layerDescription').value.trim() || null,
      geometryType: remoteType === 'wms' ? 'raster' : $('layerGeometry').value,
      sourceName: $('layerSourceName').value.trim() || null,
      sourceUrl: remoteMode ? remoteUrl : null,
      serviceType: remoteMode ? remoteType : (isZipUpload ? 'shapefile' : 'geojson'),
      serviceUrl: remoteMode ? remoteUrl : null,
      minZoom: Number($('layerMinZoom').value),
      maxZoom: Number($('layerMaxZoom').value),
      isPublic: existingLayer ? Boolean(existingLayer.isPublic) : false,
      allowedPlans: allowedPlans.length ? allowedPlans : ['*'],
      style: {
        color: selectedLayerColor,
        fillColor: selectedLayerColor,
        opacity: Number($('layerOpacity').value),
        fillOpacity: Number($('layerOpacity').value),
        weight: 2
      },
      metadata: remoteMode ? {
        ...(existingLayer?.metadata || {}),
        layerName: wmsLayerName || null,
        remoteMode: true,
        autoColor: false,
        mixedContentRisk,
        forceWmsColor: remoteType === 'wms' ? $('layerForceWmsColor').checked : false,
        wmsSymbolizer: remoteType === 'wms' ? $('layerWmsSymbolizer').value : null,
        styles: remoteType === 'wms' ? $('layerWmsStyleName').value.trim() : '',
        officialWmsStyle: remoteType === 'wms' ? $('layerWmsStyleName').value.trim() : '',
        // Faz o mapa respeitar a URL cadastrada no painel e impede que o
        // registro seja substituído pelo fallback oficial legado.
        directWms: remoteType === 'wms',
        useOfficialFallback: false,
        forceStoredData: false,
        remoteImportAutoPublish: $('layerAutoPublishRemote').checked,
        remoteImportBatchSize: Number($('layerRemoteBatchSize').value || 500),
        ...(remoteType === 'wms' ? {
          format: 'image/png',
          transparent: true,
          wmsVersion: existingLayer?.metadata?.wmsVersion || '1.1.1'
        } : {}),
        configuredAt: new Date().toISOString()
      } : {}
    };

    try {
      let imported = null;
      if (selectedFile && !isZipUpload) {
        if (!window.GeoRuralLayerImport) throw new Error('O módulo de importação não foi carregado. Atualize a página.');
        layerImportBusy = true;
        submit.textContent = 'Convertendo arquivo...';
        updateLayerImportProgress({ percent: 1, message: 'Preparando conversão...' });
        imported = await window.GeoRuralLayerImport.filesToGeoJSON([selectedFile], (progress) => {
          updateLayerImportProgress(progress);
          submit.textContent = `${progress.message || 'Convertendo...'} ${Math.round(progress.percent || 0)}%`;
        });
        payload.serviceType = 'geojson';
        payload.serviceUrl = null;
        payload.metadata = {
          ...payload.metadata,
          originalFormat: imported.originalFormat,
          originalFiles: imported.fileNames,
          originalBytes: imported.originalBytes,
          convertedBytes: imported.bytes,
          convertedAt: new Date().toISOString(),
          uploadMode: imported.bytes > 18 * 1024 * 1024 ? 'chunked-gzip' : 'single-json'
        };
      }

      if (isZipUpload) {
        payload.metadata = {
          ...payload.metadata,
          originalFormat: 'shapefile-zip',
          originalFiles: [selectedFile.name],
          originalBytes: selectedFile.size,
          queuedAt: new Date().toISOString(),
          uploadMode: 'api-streaming-fast-1gb'
        };
      }

      if (payload.serviceType !== 'geojson' && payload.serviceType !== 'shapefile' && !payload.serviceUrl) {
        throw new Error('Informe a URL do serviço geográfico.');
      }

      const layer = editId ? await auth.updateLayer(editId, payload) : await auth.createLayer(payload);
      const progressiveRemoteImport = remoteMode && payload.serviceType === 'arcgis' && $('layerImportRemoteToDatabase').checked;

      if (progressiveRemoteImport) {
        submit.textContent = 'Iniciando importação...';
        updateLayerImportProgress({ percent: 1, message: 'A API está preparando a cópia completa da URL...' });
        await auth.startRemoteLayerImport(layer.id, {
          autoPublish: $('layerAutoPublishRemote').checked,
          batchSize: Number($('layerRemoteBatchSize').value || 500)
        });
        layerImportCompleted = true;
      } else if (isZipUpload) {
        layerImportBusy = true;
        activeLayerUploadId = layer.id;
        layerUploadController = new AbortController();
        submit.textContent = 'Enviando ZIP...';
        updateLayerImportProgress({ percent: 1, message: 'Preparando envio rápido do ZIP em blocos de 16 MB...' });
        await auth.uploadLayerSourceZip(layer.id, selectedFile, (progress) => {
          updateLayerImportProgress(progress);
          submit.textContent = `${progress.message || 'Processando...'} ${Math.round(progress.percent || 0)}%`;
        }, { signal: layerUploadController.signal });
        layerImportCompleted = true;
      } else if (imported) {
        const notes = `Importado de ${imported.originalFormat}: ${imported.fileNames.join(', ')}`;
        if (imported.bytes <= 18 * 1024 * 1024) {
          submit.textContent = 'Enviando camada...';
          updateLayerImportProgress({ percent: 98, message: 'Enviando camada ao Appwrite...' });
          await auth.uploadLayerGeoJson(layer.id, imported.geojson, notes);
        } else {
          const uploadSource = imported.jsonBlob || imported.geojson;
          imported.geojson = null;
          await auth.uploadLargeLayerGeoJson(layer.id, uploadSource, {
            originalFileName: imported.fileNames[0],
            originalBytes: imported.originalBytes,
            fileNames: imported.fileNames,
            featureCount: imported.featureCount,
            notes
          }, (progress) => {
            updateLayerImportProgress(progress);
            submit.textContent = `${progress.message} ${progress.percent || 0}%`;
          });
          imported.jsonBlob = null;
        }
        layerImportCompleted = true;
      }

      if (progressiveRemoteImport) {
        updateLayerImportProgress({ percent: 3, message: 'Importação iniciada. O painel continuará mostrando o progresso.' });
      } else if (remoteMode) {
        setLayerImportProgress(false);
      } else {
        updateLayerImportProgress({ percent: 100, message: isZipUpload ? 'ZIP processado pela API e camada pronta.' : 'Camada processada e enviada com sucesso.' });
      }
      $('layerDialog').close();
      notify(
        progressiveRemoteImport
          ? ($('layerAutoPublishRemote').checked
            ? 'Importação progressiva iniciada. A camada será publicada automaticamente quando chegar a 100%.'
            : 'Importação progressiva iniciada. Ao concluir, use “Publicar”.')
          : remoteMode
            ? 'URL cadastrada. Use “Publicar” para liberá-la aos usuários.'
            : 'Camada enviada. Use “Publicar” para liberá-la aos usuários.',
        'success'
      );
      await refresh();
    } catch (error) {
      const aborted = error?.name === 'AbortError';
      const message = aborted
        ? 'Upload cancelado.'
        : error instanceof RangeError || /invalid string length|string length/i.test(error?.message || '')
          ? 'A camada excedeu a memória disponível no navegador. Para Shapefile, envie o arquivo em ZIP para processamento pela API.'
          : (error.message || 'Não foi possível salvar a camada.');
      updateLayerImportProgress({ percent: 0, message });
      notify(message, 'error');
    } finally {
      layerImportBusy = false;
      activeLayerUploadId = null;
      layerUploadController = null;
      $('cancelLayerImport').disabled = true;
      submit.disabled = false;
      submit.textContent = 'Salvar camada';
      if (layerImportCompleted) setTimeout(() => setLayerImportProgress(false), 1600);
    }
  });


  $('plansGrid').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-plan-action]');
    const card = event.target.closest('[data-plan-id]');
    if (!button || !card) return;
    const plan = plans.find((item) => item.id === card.dataset.planId);
    if (!plan) return;
    if (button.dataset.planAction === 'edit') return openPlan(plan);
    if (button.dataset.planAction === 'delete') {
      const assignedUsers = users.filter((user) => !user.isSubuser && (user.planId === plan.id || user.planSlug === plan.slug || user.plan === plan.slug)).length;
      const message = assignedUsers
        ? `Excluir definitivamente o plano "${plan.name}"? Existem ${assignedUsers} usuário(s) vinculados. Depois, ajuste esses usuários para outro plano.`
        : `Excluir definitivamente o plano "${plan.name}" do banco de dados?`;
      if (!confirm(`${message} Essa ação não pode ser desfeita.`)) return;
      button.disabled = true;
      try {
        await auth.deletePlan(plan.id);
        notify('Plano excluído do banco de dados.', 'success');
        await refresh();
      } catch (error) {
        notify(error.message || 'Não foi possível excluir o plano.', 'error');
      } finally {
        button.disabled = false;
      }
      return;
    }
    if (button.dataset.planAction === 'toggle') {
      button.disabled = true;
      try {
        await auth.updatePlan(plan.id, { isActive: !(plan.active !== false) });
        notify(plan.active === false ? 'Plano reativado.' : 'Plano desativado.', 'success');
        await refresh();
      } catch (error) {
        notify(error.message || 'Não foi possível alterar o status do plano.', 'error');
      } finally {
        button.disabled = false;
      }
    }
  });

  $('toggleSelectedLayerGroup')?.addEventListener('click', async () => {
    const groupId = layerFilterGroup;
    const group = layerGroups.find((item) => item.id === groupId);
    if (!group) return notify('Selecione um grupo específico.', 'error');
    const currentlyPublished = String(group.status || 'active') === 'active';
    const nextPublished = !currentlyPublished;
    const action = nextPublished ? 'publicar' : 'despublicar';
    if (!confirm(`${action === 'publicar' ? 'Publicar' : 'Despublicar'} todo o grupo “${group.name}”? ${nextPublished ? 'As camadas prontas voltarão ao catálogo.' : 'O grupo e todas as suas camadas deixarão de aparecer para os usuários.'}`)) return;
    const button = $('toggleSelectedLayerGroup');
    button.disabled = true;
    try {
      const result = await auth.publishLayerGroup(groupId, nextPublished);
      group.status = nextPublished ? 'active' : 'unpublished';
      syncSelectedLayerGroupAction();
      notify(`${result.updatedLayers || 0} camada(s) do grupo foram ${nextPublished ? 'publicadas' : 'despublicadas'}.`, 'success');
      await refresh({ forceRefresh: true });
    } catch (error) {
      notify(error.message || `Não foi possível ${action} o grupo.`, 'error');
    } finally {
      button.disabled = false;
    }
  });

  $('adminLayersList').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-layer-action]');
    const card = event.target.closest('[data-id]');
    if (!button || !card) return;
    const layer = layers.find((item) => item.id === card.dataset.id);
    if (!layer) return;
    if (button.dataset.layerAction === 'edit') return openLayer(layer);

    button.disabled = true;
    try {
      if (button.dataset.layerAction === 'publish') {
        const published = !(layer.status === 'ready' && layer.isPublic);
        await auth.publishLayer(layer.id, published);
        const publicCatalog = await auth.loadLayers().catch(() => []);
        const stillVisible = publicCatalog.some((item) => item.id === layer.id);
        if (!published && stillVisible) {
          notify('Camada despublicada no admin, mas a API ainda a retornou no catálogo. Verifique o deploy/backend.', 'error');
        } else {
          notify(published ? 'Camada publicada para os usuários.' : 'Camada retirada do catálogo e removida das preferências dos usuários.', 'success');
        }
      }
      if (button.dataset.layerAction === 'cancel-import') {
        if (!confirm(`Cancelar a importação da camada “${layer.name}”?`)) return;
        await auth.cancelRemoteLayerImport(layer.id);
        notify('Importação cancelada.', 'success');
      }
      if (button.dataset.layerAction === 'spatial-index') {
        await auth.startLayerSpatialIndex(layer.id);
        notify('Otimização espacial iniciada. Depois dela, a camada abrirá quase instantaneamente.', 'success');
      }
      if (button.dataset.layerAction === 'cancel-spatial') {
        if (!confirm(`Cancelar a otimização espacial de “${layer.name}”?`)) return;
        await auth.cancelLayerSpatialIndex(layer.id);
        notify('Otimização espacial cancelada.', 'success');
      }
      if (button.dataset.layerAction === 'archive') {
        if (!confirm(`Arquivar a camada “${layer.name}”?`)) return;
        await auth.archiveLayer(layer.id);
        notify('Camada arquivada.', 'success');
      }
      await refresh();
    } catch (error) {
      notify(error.message || 'Não foi possível atualizar a camada.', 'error');
    } finally {
      button.disabled = false;
    }
  });

  $('layerAllowedPlans').addEventListener('change', (event) => {
    if (event.target.value === '*' && event.target.checked) {
      [...$('layerAllowedPlans').querySelectorAll('input')].forEach((input) => { if (input.value !== '*') input.checked = false; });
    } else if (event.target.checked) {
      const all = $('layerAllowedPlans').querySelector('input[value="*"]');
      if (all) all.checked = false;
    }
  });

  $('planPermissions').innerHTML = `
    <section class="permission-section permission-section-full" data-group="full-access">
      <div class="permission-section-head"><strong>Acesso completo</strong><span>Use somente para administradores internos; os planos oficiais usam permissões explícitas.</span></div>
      <div class="permission-grid-inner"><label class="permission-full-access"><input type="checkbox" value="*"><span>Acesso completo ao GeoRural Pro</span></label></div>
    </section>
    ${Object.entries(permissionGroups).map(([groupKey, group]) => `
    <section class="permission-section" data-group="${escape(groupKey)}">
      <div class="permission-section-head"><strong>${escape(group.title)}</strong><button type="button" class="tiny-button" data-permission-group="${escape(groupKey)}">Marcar grupo</button></div>
      <div class="permission-grid-inner">${Object.entries(group.items).map(([key, label]) => `<label><input type="checkbox" value="${key}"><span>${escape(label)}</span></label>`).join('')}</div>
    </section>`).join('')}`;
  $('openPlanDialog').addEventListener('click', () => openPlan());
  $('seedDefaultPlans')?.addEventListener('click', syncDefaultPlans);
  $('dedupePlansBtn')?.addEventListener('click', dedupePlansNow);
  $('planPermissions').addEventListener('click', (event) => {
    const fullAccessInput = event.target.closest('input[value="*"]');
    if (fullAccessInput) {
      const enabled = fullAccessInput.checked;
      [...$('planPermissions').querySelectorAll('input[type="checkbox"]')].forEach((input) => {
        if (input.value !== '*') {
          input.checked = false;
          input.disabled = enabled;
        }
      });
      return;
    }
    const clickedPermissionInput = event.target.closest('input[type="checkbox"]');
    if (clickedPermissionInput && clickedPermissionInput.value !== '*') {
      const full = $('planPermissions').querySelector('input[value="*"]');
      if (full?.checked) return;
    }
    const groupButton = event.target.closest('[data-permission-group]');
    if (!groupButton) return;
    const full = $('planPermissions').querySelector('input[value="*"]');
    if (full?.checked) return;
    const section = groupButton.closest('.permission-section');
    const inputs = [...(section?.querySelectorAll('input[type="checkbox"]') || [])];
    const shouldCheck = inputs.some((input) => !input.checked);
    inputs.forEach((input) => { input.checked = shouldCheck; });
  });
  document.getElementById('planPresetBasicAnnual')?.addEventListener('click', () => applyPlanPreset('basic_annual'));
  document.getElementById('planPresetPlusAnnual')?.addEventListener('click', () => applyPlanPreset('plus_annual'));
  document.getElementById('planPresetProAnnual')?.addEventListener('click', () => applyPlanPreset('pro_annual'));
  $('planName').addEventListener('input', () => {
    if (!$('editPlanId').value || !$('planSlug').value.trim()) $('planSlug').value = slugify($('planName').value);
  });
  $('planForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = event.submitter;
    if (submit) submit.disabled = true;
    const editId = $('editPlanId').value;
    if (editId && !validSqlGuid(editId)) {
      if (submit) submit.disabled = false;
      notify('O identificador do plano é inválido. Atualize a página e tente novamente.', 'error');
      return;
    }
    const payload = {
      name: $('planName').value.trim(),
      slug: slugify($('planSlug').value || $('planName').value),
      description: $('planDescription').value.trim() || null,
      priceCents: Math.round(Number($('planPrice').value || 0) * 100),
      billingCycle: normalizeBillingCycle($('planBilling').value),
      projectLimit: $('planProjectLimit').value === '' ? null : Number($('planProjectLimit').value),
      userLimit: $('planUserLimit').value === '' ? null : Number($('planUserLimit').value),
      storageLimitBytes: mbToBytes($('planStorageMb').value),
      permissions: checkedPermissions('planPermissions'),
      isActive: $('planActive').value === '1'
    };
    try {
      if (!payload.name || payload.name.length < 2) throw new Error('Informe o nome do plano.');
      if (!payload.slug) throw new Error('Informe um identificador válido para o plano.');
      if (editId) await auth.updatePlan(editId, payload);
      else await auth.createPlan(payload);
      $('planDialog').close();
      notify(editId ? 'Plano atualizado.' : 'Plano criado com sucesso.', 'success');
      await refresh();
    } catch (error) {
      notify(error.message || 'Não foi possível salvar o plano.', 'error');
    } finally {
      if (submit) submit.disabled = false;
    }
  });


  $('noticeAudience')?.addEventListener('change', updateNoticeTargetVisibility);
  $('noticeBlocksApp')?.addEventListener('change', () => {
    if ($('noticeBlocksApp').checked) {
      $('noticeType').value = 'maintenance';
      $('noticeDelivery').value = 'banner';
      setNoticeMode('maintenance');
    } else if ($('noticeComposerMode')?.value === 'maintenance') {
      $('noticeDelivery').value = 'popup';
    }
  });
  document.querySelectorAll('[data-notice-mode]').forEach((button) => button.addEventListener('click', () => setNoticeMode(button.dataset.noticeMode)));
  $('addReleaseSlide')?.addEventListener('click', () => addReleaseSlide({ title: `Novidade ${releaseSlideState.length + 1}`, description: '' }));
  $('releaseSlidesList')?.addEventListener('input', (event) => {
    const row = event.target.closest('[data-release-slide-index]');
    if (row) syncReleaseSlideFromInputs(row);
  });
  $('releaseSlidesList')?.addEventListener('change', async (event) => {
    const input = event.target.closest('.release-slide-file');
    if (!input) return;
    const row = input.closest('[data-release-slide-index]');
    const slide = syncReleaseSlideFromInputs(row);
    if (!slide || !input.files?.[0]) return;
    try {
      const optimized = await fileToOptimizedDataUrl(input.files[0]);
      slide.imageDataUrl = optimized.imageDataUrl;
      slide.imageName = optimized.imageName;
      renderReleaseSlides();
      notify('Imagem anexada ao slide.', 'success');
    } catch (error) {
      notify(error.message || 'Não foi possível anexar a imagem.', 'error');
    }
  });
  $('releaseSlidesList')?.addEventListener('click', (event) => {
    const row = event.target.closest('[data-release-slide-index]');
    if (!row) return;
    syncAllReleaseSlides();
    const index = Number(row.dataset.releaseSlideIndex);
    if (event.target.closest('[data-release-slide-remove]')) {
      releaseSlideState.splice(index, 1);
      renderReleaseSlides();
    }
    if (event.target.closest('[data-release-slide-up]') && index > 0) {
      [releaseSlideState[index - 1], releaseSlideState[index]] = [releaseSlideState[index], releaseSlideState[index - 1]];
      renderReleaseSlides();
    }
    if (event.target.closest('[data-release-slide-down]') && index < releaseSlideState.length - 1) {
      [releaseSlideState[index + 1], releaseSlideState[index]] = [releaseSlideState[index], releaseSlideState[index + 1]];
      renderReleaseSlides();
    }
  });
  $('prefillMaintenanceNotice')?.addEventListener('click', () => prefillMaintenanceNotice({ block: false }));
  $('prefillBlockNotice')?.addEventListener('click', () => prefillMaintenanceNotice({ block: true }));
  $('clearNoticeForm')?.addEventListener('click', clearNoticeForm);
  $('noticeForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = event.submitter;
    if (submit) submit.disabled = true;
    try {
      const id = $('editNoticeId').value;
      const payload = noticePayloadFromForm();
      if (!payload.title || payload.title.length < 3) throw new Error('Informe o título do aviso.');
      if (!payload.message || payload.message.length < 3) throw new Error('Informe a mensagem do aviso.');
      if (payload.audience === 'plan' && !payload.targetPlanSlug) throw new Error('Selecione o plano de destino.');
      if (payload.audience === 'user' && !payload.targetUserId) throw new Error('Selecione o usuário de destino.');
      if (payload.deliveryMode === 'release' && !payload.metadata.slides.length) throw new Error('Adicione pelo menos um slide para as novidades da versão.');
      if (id) await auth.updateSystemNotice(id, payload);
      else await auth.createSystemNotice(payload);
      notify(id ? 'Aviso atualizado.' : 'Aviso enviado aos usuários.', 'success');
      clearNoticeForm();
      await refresh();
      window.GeoRuralRefreshNotices?.(); window.SurveyorRefreshNotices?.();
    } catch (error) {
      notify(error.message || 'Não foi possível salvar o aviso.', 'error');
    } finally {
      if (submit) submit.disabled = false;
    }
  });
  $('adminNoticesTable')?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-notice-action]');
    if (!button) return;
    const row = button.closest('[data-notice-id]');
    const notice = notices.find((item) => item.id === row?.dataset.noticeId);
    if (!notice) return;
    const action = button.dataset.noticeAction;
    if (action === 'edit') return openNotice(notice);
    if (action === 'toggle') {
      button.disabled = true;
      try {
        await auth.updateSystemNotice(notice.id, { isActive: !notice.isActive });
        notify(notice.isActive ? 'Aviso desativado.' : 'Aviso ativado.', 'success');
        await refresh();
        window.GeoRuralRefreshNotices?.(); window.SurveyorRefreshNotices?.();
      } catch (error) {
        notify(error.message || 'Não foi possível alterar o aviso.', 'error');
      } finally { button.disabled = false; }
      return;
    }
    if (action === 'archive' && confirm(`Arquivar o aviso "${notice.title}"?`)) {
      button.disabled = true;
      try {
        await auth.archiveSystemNotice(notice.id);
        notify('Aviso arquivado.', 'success');
        await refresh();
        window.GeoRuralRefreshNotices?.(); window.SurveyorRefreshNotices?.();
      } catch (error) {
        notify(error.message || 'Não foi possível arquivar o aviso.', 'error');
      } finally { button.disabled = false; }
      return;
    }
    if (action === 'delete' && confirm(`Excluir definitivamente o aviso "${notice.title}"? Essa ação remove o registro do banco/API e não poderá ser desfeita.`)) {
      button.disabled = true;
      try {
        await auth.deleteSystemNotice(notice.id);
        notify('Aviso excluído definitivamente.', 'success');
        await refresh();
        window.GeoRuralRefreshNotices?.(); window.SurveyorRefreshNotices?.();
      } catch (error) {
        notify(error.message || 'Não foi possível excluir o aviso.', 'error');
      } finally { button.disabled = false; }
    }
  });

  function planDurationDefault(plan = {}) {
    const slug = String(plan.slug || plan.id || '').toLowerCase();
    const cycle = String(plan.billingCycle || '').toLowerCase();
    return slug.includes('annual') || slug.includes('anual') || cycle.includes('anual') ? 365 : 30;
  }

  $('adminExport').addEventListener('click', () => {
    const payload = { exportedAt: new Date().toISOString(), users, plans, layers, layerGroups };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'georural-configuracao.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

      document.documentElement.dataset.adminAppReady = 'true';
      refresh().catch(showAdminRuntimeError);
    } catch (error) {
      showAdminRuntimeError(error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapAdmin, { once: true });
  } else {
    bootstrapAdmin();
  }
})();
