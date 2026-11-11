export type OfficialCategory='Imóveis rurais'|'Ambiente'|'Cartografia'|'Outros';
export type OfficialEntry={name:string;description:string;logo:string;url:string;action:string;category:OfficialCategory};
// URLs transcritas do módulo oficial de acervos do projeto RC185.72.
export const officialEntries:OfficialEntry[]=[
 {name:'SIGEF — parcelas certificadas',description:'Consulta pública de parcelas e informações georreferenciadas certificadas.',logo:'sigef.svg',url:'https://sigef.incra.gov.br/',action:'Abrir SIGEF',category:'Imóveis rurais'},
 {name:'Acervo Fundiário do INCRA',description:'Acesso a coordenadas, mapas e arquivos geoespaciais disponíveis.',logo:'incra-acervo.svg',url:'https://acervofundiario.incra.gov.br/',action:'Abrir acervo',category:'Imóveis rurais'},
 {name:'Consulta pública SNCR',description:'Consulta pública de imóveis rurais cadastrados.',logo:'sncr.svg',url:'https://sncr.serpro.gov.br/sncr-web/consultaPublica.jsf',action:'Abrir SNCR',category:'Imóveis rurais'},
 {name:'DCR / INCRA',description:'Acesso ao serviço DCR do Sistema Nacional de Cadastro Rural.',logo:'dcr.svg',url:'https://sncr.serpro.gov.br/dcr/public/pages/index.jsf?windowId=d7f',action:'Abrir DCR / INCRA',category:'Imóveis rurais'},
 {name:'Meu Imóvel Rural',description:'Informações de CAR, SNCR e SIGEF do detentor.',logo:'meu-imovel-rural.svg',url:'https://meuimovelrural.sistema.gov.br/',action:'Abrir plataforma',category:'Imóveis rurais'},
 {name:'SEIA / CEFIR Bahia',description:'Sistema ambiental e cadastro rural da Bahia.',logo:'seia-cefir.svg',url:'https://sistema.seia.ba.gov.br/',action:'Abrir SEIA',category:'Ambiente'},
 {name:'TOPODATA / INPE',description:'Dados de elevação, declividade e variáveis derivadas do SRTM.',logo:'topodata.svg',url:'https://www.dsr.inpe.br/topodata/',action:'Abrir TOPODATA',category:'Cartografia'},
 {name:'Consulta Pública CAR',description:'Pesquisa e conferência cadastral no Cadastro Ambiental Rural.',logo:'car.svg',url:'https://consulta.car.gov.br/',action:'Abrir CAR',category:'Ambiente'},
 {name:'CNIR',description:'Cadastro Nacional de Imóveis Rurais.',logo:'cnir.svg',url:'https://cnir.serpro.gov.br/',action:'Abrir CNIR',category:'Imóveis rurais'},
 {name:'Google Earth Web',description:'Visualização externa do terreno e das coordenadas.',logo:'google-earth.svg',url:'https://earth.google.com/web/',action:'Abrir Google Earth',category:'Cartografia'}
];
