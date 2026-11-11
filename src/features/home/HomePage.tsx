import { Link, useNavigate } from 'react-router-dom';
export function HomePage(){
 const navigate=useNavigate();
 return <main className="home-main"><div className="hero-wrap"><section className="hero-copy">
  <span className="eyebrow">INÍCIO</span><span className="hero-accent" aria-hidden="true"/><h1>Bem-vindo ao Surveyor</h1>
  <p>Georreferenciamento e gestão técnica de imóveis rurais.</p>
  <div className="hero-actions"><button className="button primary" type="button" onClick={()=>navigate('/mapa/')}>Abrir mapa de trabalho</button><Link className="hero-project-link" to="/nuvem/">Meus projetos <span aria-hidden="true">→</span></Link></div>
 </section><div className="hero-art" aria-hidden="true">
  <svg className="hero-parcel" viewBox="0 0 500 420" role="presentation">
   <g className="parcel-context" fill="none" stroke="#cbd6e3" strokeWidth="1.5">
    <path d="M34 247c48-10 40-72 102-83 42-7 74 18 118 4 48-15 48-67 105-76 34-5 61 3 94-24"/>
    <path d="M45 336c47-44 42-87 94-104m192-158c-18 44-14 73-1 104m60 168c26-20 61-22 88-47"/>
    <path d="M383 59c-20 44-22 82-9 119m-4 130c28-36 55-52 101-59" strokeDasharray="7 8"/>
   </g>
   <path className="parcel-boundary" d="M127 92 249 68 356 104 333 232 286 226 251 323 127 297 86 190Z" fill="#fff9e8" fillOpacity=".72" stroke="#135bc1" strokeWidth="4" strokeLinejoin="round"/>
   <g className="parcel-vertices" fill="#fff" stroke="#0963d2" strokeWidth="3">
    <circle cx="127" cy="92" r="7"/><circle cx="249" cy="68" r="7"/><circle cx="356" cy="104" r="7"/>
    <circle cx="333" cy="232" r="7"/><circle cx="286" cy="226" r="7"/><circle cx="251" cy="323" r="7"/>
    <circle cx="127" cy="297" r="7"/><circle cx="86" cy="190" r="7"/>
   </g>
   <g fill="none" stroke="#d7e5b2" strokeWidth="2">
    <path d="M120 260c50-42 37-76 91-96 38-14 73-7 112-50"/>
    <path d="M112 228c42-34 44-61 91-77 39-13 64-9 97-39"/>
   </g>
  </svg>
 </div></div></main>;
}
