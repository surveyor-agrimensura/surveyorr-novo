import { useMemo,useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import { officialEntries,type OfficialCategory } from './officialRegistry';
const options=['Todos','Imóveis rurais','Ambiente','Cartografia','Outros'] as const;
export function OfficialPage(){
 const [search,setSearch]=useState('');const [filter,setFilter]=useState<'Todos'|OfficialCategory>('Todos');
 const entries=useMemo(()=>officialEntries.filter(e=>(filter==='Todos'||e.category===filter)&&`${e.name} ${e.description}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR').trim())),[search,filter]);
 return <main className="workspace-main"><div className="workspace-container official-container"><div className="official-toolbar"><label className="search-box"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar acervo, base ou descrição..." aria-label="Pesquisar acervos"/></label>
  <div className="official-filters" role="group" aria-label="Categorias">{options.map(v=><button type="button" key={v} className={filter===v?'selected':''} aria-pressed={filter===v} onClick={()=>setFilter(v)}>{v}</button>)}</div></div>
  <div className="official-grid">{entries.map(e=><article className="official-card" key={e.name}><span className="official-badge">OFICIAL</span><div className="official-logo"><img src={`/official-logos/${e.logo}`} alt={`Logotipo ${e.name}`} loading="lazy"/></div><div className="official-card-content"><h2>{e.name}</h2><p>{e.description}</p></div><a className="official-open" href={e.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={12}/>{e.action}</a></article>)}</div>
  {!entries.length&&<div className="empty-state">Nenhum acervo encontrado para essa pesquisa.</div>}
 </div></main>;
}
