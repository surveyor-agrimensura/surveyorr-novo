// Catálogos oficiais do SURVEYOR 1.0.

export const INCRA_OFFICIAL_GROUP = {
  id: 'incra-acervo-fundiario-oficial',
  name: 'INCRA / Acervo Fundiário',
  slug: 'incra-acervo-fundiario',
  description: 'Camadas oficiais de consulta fundiária do INCRA: SIGEF e SNCI. A visualização/consulta é feita pelo Cloudflare Worker brasileiro.',
  sortOrder: 40,
  status: 'active',
  createdAt: '2026-07-02T00:00:00.000Z',
  updatedAt: '2026-07-02T00:00:00.000Z'
};

export const INCRA_OFFICIAL_CATALOG = [
  {
    id: 'incra-sigef-particular-ba',
    name: 'SIGEF - Imóveis certificados particulares (BA)',
    layer: 'certificada_sigef_particular_ba',
    registrySystem: 'sigef',
    color: '#2563eb',
    fillColor: '#3b82f6',
    opacity: 0.62,
    description: 'Parcelas certificadas no SIGEF/INCRA — imóveis particulares na Bahia.'
  },
  {
    id: 'incra-sigef-publico-ba',
    name: 'SIGEF - Imóveis certificados públicos (BA)',
    layer: 'certificada_sigef_publico_ba',
    registrySystem: 'sigef',
    color: '#1d4ed8',
    fillColor: '#60a5fa',
    opacity: 0.58,
    description: 'Parcelas certificadas no SIGEF/INCRA — imóveis públicos na Bahia.'
  },
  {
    id: 'incra-snci-privado-ba',
    name: 'SNCI - Imóveis certificados privados (BA)',
    layer: 'imoveiscertificados_privado_ba',
    registrySystem: 'snci',
    color: '#7c3aed',
    fillColor: '#a78bfa',
    opacity: 0.56,
    description: 'Imóveis certificados/registrados no SNCI/INCRA — domínio privado na Bahia.'
  },
  {
    id: 'incra-snci-publico-ba',
    name: 'SNCI - Imóveis certificados públicos (BA)',
    layer: 'imoveiscertificados_publico_ba',
    registrySystem: 'snci',
    color: '#9333ea',
    fillColor: '#c084fc',
    opacity: 0.54,
    description: 'Imóveis certificados/registrados no SNCI/INCRA — domínio público na Bahia.'
  }
];

export const SICAR_PROPERTY_GROUP = {
  id: 'sicar-car-limites-propriedade',
  name: 'CAR / SICAR — Limites de Propriedade',
  slug: 'car-sicar-limites-propriedade',
  description: 'Limites oficiais de imóveis rurais publicados pelo CAR/SICAR por unidade federativa.',
  sortOrder: 30,
  status: 'active',
  createdAt: '2026-09-15T00:00:00.000Z',
  updatedAt: '2026-09-15T00:00:00.000Z'
};

export const GEOBAHIA_OFFICIAL_CATALOG = [
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
