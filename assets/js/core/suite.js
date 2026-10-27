
(() => {'use strict';const $=id=>document.getElementById(id);let projectCache=[];const cats={perimetro:['Perímetro do imóvel','#35c982'],reserva:['Reserva Legal','#15803d'],app:['APP','#ef4444'],produtiva:['Área produtiva','#f59e0b'],vegetacao:['Vegetação nativa','#22c55e'],consolidada:['Área consolidada','#a855f7'],estrada:['Estrada/servidão','#f97316'],agua:['Nascente/curso d’água','#38bdf8'],benfeitoria:['Benfeitoria','#eab308'],outros:['Outros','#94a3b8']};let lastText='',lastHtml='',lastSvg='',azFc=null,elevData=[];function projects(){return projectCache}function project(id){return projectCache.find(p=>p.id===id)}async function loadSelectedProject(id){
  if(!id)return null;
  let p=project(id);
  const hasGeometry=(value)=>Array.isArray(value?.geojson?.features)&&value.geojson.features.some((feature)=>feature?.geometry&&/Polygon/i.test(String(feature.geometry.type||'')));
  if(hasGeometry(p))return p;
  try{
    // Primeiro reutiliza o cache completo/in-flight central. Só força rede se a
    // resposta ainda vier sem geometria, evitando duas leituras concorrentes do mesmo projeto.
    let full=await window.GeoRuralProjects.get(id,false);
    if(!hasGeometry(full)) full=await window.GeoRuralProjects.get(id,true);
    if(full){
      const i=projectCache.findIndex(x=>x.id===id);
      if(i>=0)projectCache[i]=full;else projectCache.push(full);
      return full;
    }
  }catch(error){
    console.error(error);
    toast(error.message||'Não foi possível carregar os dados completos do projeto.','error');
  }
  return p||null;
}function populateProjectSelects(items,{preserveSelection=true,requested=''}={}){
  const list=Array.isArray(items)?items:[];
  document.querySelectorAll('#projectSelect').forEach((sel)=>{
    const explicit=sel.dataset.projectChoiceExplicit==='1';
    const current=preserveSelection?(requested||String(sel.value||'')):(requested||'');
    [...sel.options].slice(1).forEach((option)=>option.remove());
    list.forEach((project)=>{
      const title=project?.title||project?.name||project?.propertyName||'Projeto sem nome';
      const city=project?.city||project?.municipality||'';
      const uf=project?.uf||project?.stateCode||'';
      sel.add(new Option(`${title}${city?' — '+city+'/'+uf:''}`,project.id));
    });
    const target=(explicit||requested)?current:'';
    sel.value=target&&[...sel.options].some((option)=>option.value===target)?target:'';
    if(!sel.dataset.geoProjectBound){
      sel.dataset.geoProjectBound='1';
      sel.addEventListener('change',async()=>{
        sel.dataset.projectChoiceExplicit='1';
        const full=await loadSelectedProject(sel.value);
        applyProjectToCurrentPage(full);
      });
    }
  });
  try{window.dispatchEvent(new CustomEvent('surveyor:projects-ready',{detail:{projects:list}}));}catch(_error){}
}
async function setupProjects(){
  const requested=new URLSearchParams(location.search).get('project')||'';
  document.querySelectorAll('#projectSelect').forEach((sel)=>{
    if(sel.options.length===1){
      const loading=new Option('Carregando projetos…','');
      loading.disabled=true;loading.dataset.projectLoading='1';
      sel.add(loading);
    }
  });
  try{
    const cached=await window.GeoRuralProjects.list({full:false,refresh:false,cacheOnly:true});
    projectCache=Array.isArray(cached)?cached:[];
    if(projectCache.length)populateProjectSelects(projectCache,{preserveSelection:false,requested});
    if(requested){
      const selected=await loadSelectedProject(requested);
      if(selected)applyProjectToCurrentPage(selected);
    }
  }catch(error){
    console.warn('[projetos] cache inicial indisponível; tentando atualização remota.',error);
  }
  window.GeoRuralProjects.list({full:false,refresh:true}).then((fresh)=>{
    projectCache=Array.isArray(fresh)?fresh:projectCache;
    populateProjectSelects(projectCache,{preserveSelection:true,requested});
    if(!projectCache.length){
      document.querySelectorAll('#projectSelect').forEach((sel)=>{
        const empty=new Option('Nenhum projeto salvo','');empty.disabled=true;sel.add(empty);
      });
    }
  }).catch((error)=>{
    console.error(error);
    if(!projectCache.length)toast(error.message||'Não foi possível carregar os projetos da nuvem.','error');
  });
}
function applyProjectToCurrentPage(p){
  if(!p)return;
  const coords=ring(p);
  if($('elevationPoints')&&coords.length){
    const open=coords.length>1&&coords[0][0]===coords.at(-1)[0]&&coords[0][1]===coords.at(-1)[1]?coords.slice(0,-1):coords;
    $('elevationPoints').value=open.map((c,i)=>`V-${String(i+1).padStart(2,'0')};${Number(c[1]).toFixed(8)};${Number(c[0]).toFixed(8)};${Number.isFinite(Number(c[2]))?Number(c[2]).toFixed(3):''}`).join('\n');
    const center=open.reduce((a,c)=>[a[0]+Number(c[0]),a[1]+Number(c[1])],[0,0]).map(v=>v/Math.max(1,open.length));
    if($('idwLat'))$('idwLat').value=center[1].toFixed(8);
    if($('idwLng'))$('idwLng').value=center[0].toFixed(8);
    elevData=[];
    $('elevCount').textContent='0';
    $('elevMin').textContent='—';$('elevMax').textContent='—';$('elevRange').textContent='—';
    $('elevationPreview').innerHTML='<p>Coordenadas do projeto carregadas. Preencha a altitude de cada vértice e clique em analisar.</p>';
  }
  if($('startLat')&&coords.length>=2){
    const ss=segments(coords);
    $('startLat').value=Number(ss[0].a[1]).toFixed(8);
    $('startLng').value=Number(ss[0].a[0]).toFixed(8);
    $('azProjectName').value=p.propertyName||p.title||p.name||'Perímetro do projeto';
    $('azimuthLines').value=ss.map(item=>`${item.az.toFixed(8)};${item.distance.toFixed(3)}`).join('\n');
    $('azimuthPreview').innerHTML='<p>Perímetro convertido em azimutes e distâncias. Clique em calcular para conferir o fechamento.</p>';
    $('azimuthTable').innerHTML='';
    $('azVertices').textContent='0';$('azDistance').textContent='0 m';$('azClosure').textContent='—';$('azArea').textContent='—';
    azFc=null;
  }
}
function perimeter(p){return globalThis.SurveyorProjectGeometry?.resolvePerimeter?.(p)||p?.geojson?.features?.filter(f=>f?.geometry?.type?.includes('Polygon')).sort((a,b)=>(globalThis.turf?.area?.(b)||0)-(globalThis.turf?.area?.(a)||0))[0]||null}function ring(p){const f=perimeter(p);return globalThis.SurveyorProjectGeometry?.perimeterRing?.(p)||(f?.geometry?.type==='MultiPolygon'?f?.geometry?.coordinates?.[0]?.[0]:f?.geometry?.coordinates?.[0])||[]}function num(v,d=2){return Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d})}function hav(a,b){const R=6371008.8,rad=x=>x*Math.PI/180,dlat=rad(b[1]-a[1]),dlon=rad(b[0]-a[0]),x=Math.sin(dlat/2)**2+Math.cos(rad(a[1]))*Math.cos(rad(b[1]))*Math.sin(dlon/2)**2;return 2*R*Math.asin(Math.sqrt(x))}function bearing(a,b){const r=x=>x*Math.PI/180,d=x=>(x*180/Math.PI+360)%360,y=Math.sin(r(b[0]-a[0]))*Math.cos(r(b[1])),x=Math.cos(r(a[1]))*Math.sin(r(b[1]))-Math.sin(r(a[1]))*Math.cos(r(b[1]))*Math.cos(r(b[0]-a[0]));return d(Math.atan2(y,x))}function area(f){try{return turf.area(f)}catch{return 0}}function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}function slug(s){return(String(s||'arquivo').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()||'arquivo')}function download(name,content,type){const b=new Blob([content],{type}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);toast(`${name} gerado.`,'success')}let tt;function toast(m,t=''){const e=$('suiteToast');if(!e)return;clearTimeout(tt);e.textContent=m;e.className=`toast show ${t}`;tt=setTimeout(()=>e.className='toast',2800)}function selectedProject(){const id=$('projectSelect')?.value,p=project(id);if(!p){toast('Selecione um projeto salvo no mapa.','error');return null}if(!p.geojson?.features){toast('Carregando dados completos do projeto. Aguarde alguns segundos e tente novamente.','warning');loadSelectedProject(id);return null}return globalThis.SurveyorDocumentScope?.apply?.(p)||p}async function selectedProjectReady(){const id=$('projectSelect')?.value;if(!id){toast('Selecione um projeto salvo no mapa.','error');return null}let p=project(id);if(!p?.geojson?.features?.length){toast('Carregando a versão mais recente do projeto...','info');p=await loadSelectedProject(id)}if(!p?.geojson?.features?.length){toast('O projeto salvo não possui geometria disponível para geração.','error');return null}return globalThis.SurveyorDocumentScope?.apply?.(p)||p}function segments(coords){const ring=coords.length>1&&coords[0][0]===coords.at(-1)[0]&&coords[0][1]===coords.at(-1)[1]?coords:coords.concat([coords[0]]);return ring.slice(0,-1).map((a,i)=>({i:i+1,a,b:ring[i+1],distance:hav(a,ring[i+1]),az:bearing(a,ring[i+1])}))}function confrontanteForSegment(p,index){const f=perimeter(p),list=Array.isArray(f?.properties?.confrontantes)?f.properties.confrontantes:[];return list.find(item=>Number(item.segmentIndex)===index)||list[index]||{nome:'',cpfCnpj:'',tipoLimite:'',orientacao:'',observacao:''}}
function confrontationPhrase(item){if(!item)return'';const parts=[];if(String(item.nome||'').trim())parts.push(`confrontando neste trecho com <b>${escapeHtml(item.nome)}</b>`);if(String(item.tipoLimite||'').trim())parts.push(`tendo como limite ${escapeHtml(item.tipoLimite.toLowerCase())}`);if(String(item.orientacao||'').trim())parts.push(`na orientação ${escapeHtml(item.orientacao)}`);if(String(item.observacao||'').trim())parts.push(escapeHtml(item.observacao));return parts.length?`, ${parts.join(', ')}`:''}
function confrontationText(item){if(!item)return'';const parts=[];if(String(item.nome||'').trim())parts.push(`confrontando neste trecho com ${item.nome}`);if(String(item.tipoLimite||'').trim())parts.push(`tendo como limite ${item.tipoLimite.toLowerCase()}`);if(String(item.orientacao||'').trim())parts.push(`na orientação ${item.orientacao}`);if(String(item.observacao||'').trim())parts.push(item.observacao);return parts.length?`, ${parts.join(', ')}`:''}

function svgFromProject(p,title='PLANTA DO IMÓVEL RURAL',environmental=false){
  const editFs=(p?.geojson?.features||[]).filter(f=>f?.geometry);
  const refLayers=Array.isArray(p?.referenceLayers)?p.referenceLayers:[];
  if(!editFs.length)return'<p>Nenhum polígono disponível.</p>';

  const coordsFromGeom=g=>{
    if(!g)return[];
    if(g.type==='Polygon')return g.coordinates?.[0]||[];
    if(g.type==='MultiPolygon')return g.coordinates?.flatMap(poly=>poly[0]||[])||[];
    if(g.type==='LineString')return g.coordinates||[];
    if(g.type==='Point')return[g.coordinates];
    return[];
  };

  const fs=editFs;
  const pts=fs.flatMap(f=>coordsFromGeom(f.geometry));
  const xs=pts.map(pt=>pt[0]), ys=pts.map(pt=>pt[1]);
  const minx=Math.min(...xs), maxx=Math.max(...xs), miny=Math.min(...ys), maxy=Math.max(...ys);

  const W=1280, H=920;
  const frame={x:26,y:20,w:1228,h:876};
  const mapBox={x:92,y:92,w:820,h:560};
  const rightBox={x:948,y:92,w:252,h:560};
  const footerBox={x:92,y:690,w:1108,h:150};
  const insetBox={x:968,y:510,w:210,h:120};
  const sx=mapBox.w/(maxx-minx||1), sy=mapBox.h/(maxy-miny||1), s=Math.min(sx,sy);
  const usedW=(maxx-minx||1)*s, usedH=(maxy-miny||1)*s;
  const ox=mapBox.x+(mapBox.w-usedW)/2, oy=mapBox.y+(mapBox.h-usedH)/2;
  const projectPt=([x,y])=>[ox+(x-minx)*s, oy+usedH-(y-miny)*s];
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

  const perFeature=perimeter(p), perArea=perFeature?area(perFeature)/10000:0;
  // O total do imóvel é sempre o perímetro principal resolvido. Glebas são subdivisões
  // internas e nunca podem ser somadas novamente ao total da propriedade.
  const totalAreaHa=perArea;
  const areaRows=editFs.filter(f=>f.geometry?.type?.includes('Polygon')).map(f=>({
    name:f.properties?.name||'Área',
    ha:area(f)/10000,
    color:(cats[f.properties?.category]?.[1]||'#64748b')
  }));

  const drawFeature=(f)=>{
    const g=f.geometry, cat=f.properties?.category||'outros';
    const c=(cats[cat]?.[1]||'#64748b');
    const fill=c, fillOpacity=environmental?0.42:0.22;
    if(g.type==='Polygon'){
      const points=(g.coordinates?.[0]||[]).map(pt=>projectPt(pt).join(',')).join(' ');
      return `<polygon points="${points}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${c}" stroke-width="3"/>`;
    }
    if(g.type==='LineString'){
      const points=(g.coordinates||[]).map(pt=>projectPt(pt).join(',')).join(' ');
      return `<polyline points="${points}" fill="none" stroke="${c}" stroke-width="2.6"/>`;
    }
    if(g.type==='Point'){
      const q=projectPt(g.coordinates);
      return `<circle cx="${q[0]}" cy="${q[1]}" r="5" fill="${fill}" stroke="${c}" stroke-width="1.5"/>`;
    }
    return '';
  };

  const editSvg=editFs.map(f=>drawFeature(f)).join('');
  const nonPerimeterLabels=editFs.filter(f=>f.geometry?.type==='Polygon'&&f.properties?.category!=='perimetro').map((f,idx)=>{
    const pt=(f.geometry.coordinates?.[0]||[])[0]; if(!pt)return'';
    const q=projectPt(pt);
    return `<text x="${q[0]+10}" y="${q[1]-8}" font-size="15" fill="#172033" style="paint-order:stroke;stroke:#fff;stroke-width:4px">${escapeHtml(f.properties?.name||`Área ${idx+1}`)}</text>`;
  }).join('');

  const raw=perFeature?.geometry?.coordinates?.[0]||[];
  const ring=raw.length>1&&raw[0][0]===raw.at(-1)[0]&&raw[0][1]===raw.at(-1)[1]?raw.slice(0,-1):raw;
  const centroid=ring.length?projectPt([
    ring.reduce((a,c)=>a+c[0],0)/ring.length,
    ring.reduce((a,c)=>a+c[1],0)/ring.length
  ]):[mapBox.x+mapBox.w/2,mapBox.y+mapBox.h/2];

  const vertexSvg=ring.map((pt,i)=>{
    const q=projectPt(pt);
    return `<circle cx="${q[0]}" cy="${q[1]}" r="6.5" fill="#1d4ed8" stroke="#fff" stroke-width="2.2"/><text x="${q[0]+10}" y="${q[1]-10}" font-size="13" font-weight="700" fill="#172033" style="paint-order:stroke;stroke:#fff;stroke-width:4px">V-${String(i+1).padStart(2,'0')}</text>`;
  }).join('');

  const confrontationSvg=ring.map((a,i)=>{
    const b=ring[(i+1)%ring.length], item=confrontanteForSegment(p,i), label=[item.nome,item.tipoLimite].filter(Boolean).join(' — ');
    if(!label)return'';
    const qa=projectPt(a), qb=projectPt(b), mx=(qa[0]+qb[0])/2, my=(qa[1]+qb[1])/2, dx=qb[0]-qa[0], dy=qb[1]-qa[1];
    const segLen=Math.hypot(dx,dy)||1, nx=-dy/segLen, ny=dx/segLen, offset=clamp(segLen*0.18,34,54);
    const posA=[mx+nx*offset,my+ny*offset], posB=[mx-nx*offset,my-ny*offset];
    const distA=(posA[0]-centroid[0])**2+(posA[1]-centroid[1])**2, distB=(posB[0]-centroid[0])**2+(posB[1]-centroid[1])**2;
    const anchor=distA>distB?posA:posB, outward=distA>distB?[nx,ny]:[-nx,-ny];
    const fontSize=clamp((segLen-10)/Math.max(10,label.length*0.56),8.2,12.5), textW=Math.max(76,label.length*fontSize*0.57+18), textH=fontSize+9;
    let rx=anchor[0]-textW/2, ry=anchor[1]-textH/2, textX=anchor[0], textY=anchor[1]+fontSize*0.34, anchorMode='middle';
    if(Math.abs(outward[0])>=Math.abs(outward[1])){
      if(outward[0]>=0){rx=anchor[0]+10; textX=rx+8; anchorMode='start'}
      else{rx=anchor[0]-textW-10; textX=rx+textW-8; anchorMode='end'}
      ry=anchor[1]-textH/2;
    } else {
      rx=anchor[0]-textW/2;
      if(outward[1]>=0){ry=anchor[1]+10; textY=ry+fontSize+1}
      else{ry=anchor[1]-textH-10; textY=ry+fontSize+1}
      anchorMode='middle'; textX=rx+textW/2;
    }
    rx=clamp(rx,mapBox.x+8,mapBox.x+mapBox.w-textW-8); ry=clamp(ry,mapBox.y+8,mapBox.y+mapBox.h-textH-8);
    if(anchorMode==='start')textX=rx+8; if(anchorMode==='end')textX=rx+textW-8; if(anchorMode==='middle')textX=rx+textW/2;
    textY=clamp(textY,ry+fontSize,ry+textH-3);
    const boxCx=anchorMode==='start'?rx:anchorMode==='end'?rx+textW:(rx+textW/2), boxCy=ry+textH/2;
    return `<g><line x1="${mx}" y1="${my}" x2="${boxCx}" y2="${boxCy}" stroke="#b45309" stroke-width="1.1" stroke-dasharray="3 2" opacity=".8"/><rect x="${rx}" y="${ry}" width="${textW}" height="${textH}" rx="6" fill="rgba(255,255,255,.95)" stroke="#b45309" stroke-width="1"/><text x="${textX}" y="${textY}" text-anchor="${anchorMode}" font-size="${fontSize}" font-weight="700" fill="#7c2d12">${escapeHtml(label)}</text></g>`;
  }).join('');

  const legendItems=Array.from(new Map(editFs.map(f=>[
    f.properties?.category||'outros',
    {label:cats[f.properties?.category||'outros']?.[0]||f.properties?.category||'Outros', fill:cats[f.properties?.category||'outros']?.[1]||'#64748b', stroke:cats[f.properties?.category||'outros']?.[1]||'#64748b'}
  ])).values());
  const legendSvg=legendItems.map((item,i)=>`<g transform="translate(${rightBox.x+20},${rightBox.y+30+i*28})"><rect width="18" height="14" rx="3" fill="${item.fill}" fill-opacity="0.28" stroke="${item.stroke}" stroke-width="1.5"/><text x="28" y="11" font-size="13">${escapeHtml(item.label)}</text></g>`).join('');
  const areaTable=areaRows.slice(0,7).map((r,i)=>`<text x="${rightBox.x+22}" y="${rightBox.y+272+i*22}" font-size="12.5">${escapeHtml(r.name)}</text><text x="${rightBox.x+214}" y="${rightBox.y+272+i*22}" font-size="12.5" text-anchor="end">${num(r.ha,4)} ha</text>`).join('');

  const satPts=ring.length?ring:pts, satXs=satPts.map(pt=>pt[0]), satYs=satPts.map(pt=>pt[1]);
  const satMinX=Math.min(...satXs), satMaxX=Math.max(...satXs), satMinY=Math.min(...satYs), satMaxY=Math.max(...satYs);
  const satPadX=Math.max((satMaxX-satMinX)*0.35,.0025), satPadY=Math.max((satMaxY-satMinY)*0.35,.0025);
  const satBBox=[satMinX-satPadX,satMinY-satPadY,satMaxX+satPadX,satMaxY+satPadY];
  const satUrl=`https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${satBBox[0]},${satBBox[1]},${satBBox[2]},${satBBox[3]}&bboxSR=4326&imageSR=4326&size=600,360&format=png32&transparent=false&f=image`;
  const satUrlEsc=satUrl.replace(/&/g,'&amp;');
  const insetMap={x:insetBox.x+1,y:insetBox.y+20,w:insetBox.w-2,h:insetBox.h-21};
  const insetProject=([x,y])=>[
    insetMap.x+((x-satBBox[0])/(satBBox[2]-satBBox[0]||1))*insetMap.w,
    insetMap.y+insetMap.h-((y-satBBox[1])/(satBBox[3]-satBBox[1]||1))*insetMap.h
  ];
  const insetOverlay=editFs.map(f=>{
    const g=f.geometry, cat=f.properties?.category||'outros';
    const color=(cats[cat]?.[1]||'#64748b');
    const fillOpacity=cat==='perimetro'?0.08:0.12;
    if(g.type==='Polygon'){
      const points=(g.coordinates?.[0]||[]).map(pt=>insetProject(pt).join(',')).join(' ');
      return `<polygon points="${points}" fill="${color}" fill-opacity="${fillOpacity}" stroke="${color}" stroke-width="1.8"/>`;
    }
    if(g.type==='LineString'){
      const points=(g.coordinates||[]).map(pt=>insetProject(pt).join(',')).join(' ');
      return `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.6"/>`;
    }
    return '';
  }).join('');

  return `<svg id="generatedSvg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="background:#f5f5f5">
    <rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.h}" fill="#fff" stroke="#111827" stroke-width="2"/>
    <text x="${frame.x+34}" y="${frame.y+34}" font-size="28" font-weight="700">${escapeHtml(title)}</text>
    <text x="${frame.x+34}" y="${frame.y+60}" font-size="15">${escapeHtml(p.title||'Imóvel rural')} — ${escapeHtml([p.city,p.uf].filter(Boolean).join('/'))}</text>
    <rect x="${mapBox.x}" y="${mapBox.y}" width="${mapBox.w}" height="${mapBox.h}" fill="#fafafa" stroke="#9ca3af"/>
    ${Array.from({length:7}).map((_,i)=>`<line x1="${mapBox.x+(i*mapBox.w/6)}" y1="${mapBox.y}" x2="${mapBox.x+(i*mapBox.w/6)}" y2="${mapBox.y+mapBox.h}" stroke="#e5e7eb"/>`).join('')}
    ${Array.from({length:6}).map((_,i)=>`<line x1="${mapBox.x}" y1="${mapBox.y+(i*mapBox.h/5)}" x2="${mapBox.x+mapBox.w}" y2="${mapBox.y+(i*mapBox.h/5)}" stroke="#e5e7eb"/>`).join('')}
    ${editSvg}${nonPerimeterLabels}${confrontationSvg}${vertexSvg}
    <g transform="translate(${frame.x+95},${frame.y+96})">
      <circle cx="0" cy="0" r="28" fill="none" stroke="#111" stroke-width="1.4"/>
      <circle cx="0" cy="0" r="2.4" fill="#111"/>
      <polygon points="0,-34 5,-10 0,-14 -5,-10" fill="#111"/>
      <polygon points="0,34 5,10 0,14 -5,10" fill="#fff" stroke="#111" stroke-width="1"/>
      <polygon points="34,0 10,5 14,0 10,-5" fill="#fff" stroke="#111" stroke-width="1"/>
      <polygon points="-34,0 -10,5 -14,0 -10,-5" fill="#fff" stroke="#111" stroke-width="1"/>
      <polygon points="24,-24 8,-6 6,-8" fill="#111" opacity="0.8" transform="rotate(45)"/>
      <line x1="0" y1="-28" x2="0" y2="28" stroke="#111" stroke-width="1"/>
      <line x1="-28" y1="0" x2="28" y2="0" stroke="#111" stroke-width="1"/>
      <text x="0" y="-40" text-anchor="middle" font-size="12" font-weight="700">N</text>
      <text x="0" y="46" text-anchor="middle" font-size="10">S</text>
      <text x="-38" y="4" text-anchor="middle" font-size="10">W</text>
      <text x="38" y="4" text-anchor="middle" font-size="10">E</text>
    </g>
    <rect x="${rightBox.x}" y="${rightBox.y}" width="${rightBox.w}" height="${rightBox.h}" fill="#fff" stroke="#9ca3af"/>
    <text x="${rightBox.x+18}" y="${rightBox.y+24}" font-size="15" font-weight="700">Convenções</text>
    ${legendSvg}
    <line x1="${rightBox.x+18}" y1="${rightBox.y+238}" x2="${rightBox.x+234}" y2="${rightBox.y+238}" stroke="#d1d5db"/>
    <text x="${rightBox.x+18}" y="${rightBox.y+258}" font-size="15" font-weight="700">Quadro de áreas</text>
    ${areaTable}
    <text x="${rightBox.x+22}" y="${rightBox.y+440}" font-size="12.5" font-weight="700">Área total do projeto</text>
    <text x="${rightBox.x+214}" y="${rightBox.y+440}" font-size="12.5" text-anchor="end">${num(totalAreaHa,4)} ha</text>
    <text x="${rightBox.x+22}" y="${rightBox.y+462}" font-size="12.5" font-weight="700">Perímetro principal</text>
    <text x="${rightBox.x+214}" y="${rightBox.y+462}" font-size="12.5" text-anchor="end">${num(perArea,4)} ha</text>
    <defs><clipPath id="insetClip"><rect x="${insetMap.x}" y="${insetMap.y}" width="${insetMap.w}" height="${insetMap.h}" rx="2"/></clipPath></defs>
    <rect x="${insetBox.x}" y="${insetBox.y}" width="${insetBox.w}" height="${insetBox.h}" fill="#f8fafc" stroke="#cbd5e1"/>
    <text x="${insetBox.x+10}" y="${insetBox.y+16}" font-size="11" font-weight="700">Planta de localização</text>
    <image href="${satUrlEsc}" x="${insetMap.x}" y="${insetMap.y}" width="${insetMap.w}" height="${insetMap.h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#insetClip)"/>
    <g clip-path="url(#insetClip)">${insetOverlay}</g>
    <rect x="${footerBox.x}" y="${footerBox.y}" width="${footerBox.w}" height="${footerBox.h}" fill="#fff" stroke="#9ca3af"/>
    <line x1="${footerBox.x+540}" y1="${footerBox.y}" x2="${footerBox.x+540}" y2="${footerBox.y+150}" stroke="#d1d5db"/>
    <line x1="${footerBox.x+860}" y1="${footerBox.y}" x2="${footerBox.x+860}" y2="${footerBox.y+150}" stroke="#d1d5db"/>
    <text x="${footerBox.x+18}" y="${footerBox.y+28}" font-size="13" font-weight="700">Proprietário/Possuidor</text>
    <text x="${footerBox.x+18}" y="${footerBox.y+52}" font-size="17">${escapeHtml(p.owner||'Não informado')}</text>
    <text x="${footerBox.x+18}" y="${footerBox.y+86}" font-size="13" font-weight="700">Observações</text>
    <text x="${footerBox.x+18}" y="${footerBox.y+110}" font-size="12.5">Confrontantes e vértices identificados no croqui técnico.</text>
    <text x="${footerBox.x+558}" y="${footerBox.y+28}" font-size="13" font-weight="700">Descrição técnica</text>
    <text x="${footerBox.x+558}" y="${footerBox.y+52}" font-size="12.5">Levantamento planimétrico / croqui demonstrativo</text>
    <text x="${footerBox.x+558}" y="${footerBox.y+78}" font-size="12.5">Município/UF: ${escapeHtml([p.city,p.uf].filter(Boolean).join('/'))}</text>
    <text x="${footerBox.x+558}" y="${footerBox.y+104}" font-size="12.5">Quantidade de vértices: ${ring.length}</text>
    <text x="${footerBox.x+878}" y="${footerBox.y+28}" font-size="13" font-weight="700">Resumo</text>
    <text x="${footerBox.x+878}" y="${footerBox.y+52}" font-size="12.5">Camadas de referência: ocultas no croqui</text>
    <text x="${footerBox.x+878}" y="${footerBox.y+78}" font-size="12.5">Escala gráfica: ajuste automático</text>
    <text x="${footerBox.x+878}" y="${footerBox.y+104}" font-size="12.5">Sistema: Surveyor</text>
  </svg>`;
}
async function projectPublicAccess(p){
  const id=String(p?.id||'');
  if(!/^[0-9a-f-]{36}$/i.test(id))return{url:'',qr:''};
  try{
    let share=await window.GeoRuralAuth.getProjectShare(id).catch(()=>null);
    if(!share?.active||!share?.token)share=await window.GeoRuralAuth.createProjectShare(id,null);
    const url=new URL(`/public-project/#token=${encodeURIComponent(share.token)}`,location.href).href;
    const qrLib=window.GeoRuralQR||window.QRCode;const qr=qrLib?.toDataURL?await qrLib.toDataURL(url,{width:260,margin:1,errorCorrectionLevel:'M'}):'';
    return{url,qr};
  }catch(error){
    console.error('Falha ao gerar acesso público do projeto:',error);
    return{url:'',qr:'',error:error?.message||'Falha ao gerar link público.'};
  }
}
async function memorialSatelliteMap(p){
  const feature=perimeter(p),coords=ring(p);
  if(!feature||coords.length<4)return'';
  const open=coords.length>1&&coords[0][0]===coords.at(-1)[0]&&coords[0][1]===coords.at(-1)[1]?coords.slice(0,-1):coords;
  const xs=open.map(c=>Number(c[0])),ys=open.map(c=>Number(c[1]));
  const minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys),dx=Math.max(.0002,maxx-minx),dy=Math.max(.0002,maxy-miny);
  const bbox={minx:minx-dx*.35,miny:miny-dy*.35,maxx:maxx+dx*.35,maxy:maxy+dy*.35};
  const W=1000,H=280,project=([x,y])=>[(x-bbox.minx)/(bbox.maxx-bbox.minx)*W,H-(y-bbox.miny)/(bbox.maxy-bbox.miny)*H];
  const params=new URLSearchParams({bbox:`${bbox.minx},${bbox.miny},${bbox.maxx},${bbox.maxy}`,bboxSR:'4326',imageSR:'4326',size:`${W},${H}`,format:'png32',transparent:'false',f:'image'});
  const raw=`https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?${params}`;
  let image=raw;
  try{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000),response=await fetch(raw,{mode:'cors',cache:'force-cache',signal:controller.signal});
    clearTimeout(timer);
    if(response.ok){const blob=await response.blob();image=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=reject;reader.readAsDataURL(blob)})}
  }catch(error){console.warn('Imagem de satélite do memorial não foi incorporada:',error)}
  const points=open.map(project).map(pt=>pt.join(',')).join(' '),vertices=open.map((c,i)=>{const q=project(c);return`<circle cx="${q[0]}" cy="${q[1]}" r="5" fill="#ef4444" stroke="#fff" stroke-width="2"/><text x="${q[0]+8}" y="${q[1]-7}" fill="#fff" stroke="#111827" stroke-width="3" paint-order="stroke" font-size="11" font-weight="700">V-${String(i+1).padStart(2,'0')}</text>`}).join('');
  return`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:auto"><image href="${escapeHtml(image)}" width="${W}" height="${H}" preserveAspectRatio="none"/><polygon points="${points}" fill="#ef261f" fill-opacity=".30" stroke="#ff1f13" stroke-width="5"/>${vertices}<rect x="12" y="242" width="260" height="26" rx="4" fill="#fff" fill-opacity=".85"/><text x="22" y="260" font-size="12">Imagem de referência • SIRGAS 2000</text></svg>`;
}
async function memorialHtml(p,ss,intro,reg,tech,publicAccess={}){
  const perimeterFeature=perimeter(p),areaHa=area(perimeterFeature)/10000,totalPerimeter=ss.reduce((a,item)=>a+item.distance,0);
  const coords=ss.map(item=>{const c=confrontanteForSegment(p,item.i-1);return`<tr><td>V-${String(item.i).padStart(2,'0')}</td><td>${item.a[1].toFixed(7)}</td><td>${item.a[0].toFixed(7)}</td><td>${num(item.az,4)}°</td><td>${num(item.distance,3)} m</td><td>${escapeHtml(c.nome||'Não informado')}</td><td>${escapeHtml(c.tipoLimite||'Não informado')}</td></tr>`}).join('');
  const narrative=ss.map(item=>{const c=confrontanteForSegment(p,item.i-1);return`<p style="text-align:justify;line-height:1.62;margin:0 0 10px">Do vértice <b>V-${String(item.i).padStart(2,'0')}</b>, de coordenadas geográficas ${item.a[1].toFixed(7)} de latitude e ${item.a[0].toFixed(7)} de longitude, segue-se com azimute de <b>${num(item.az,4)}°</b> e distância de <b>${num(item.distance,3)} m</b> até o vértice <b>V-${String(item.i+1>ss.length?1:item.i+1).padStart(2,'0')}</b>${confrontationPhrase(c)}.</p>`}).join('');
  const satellite=await memorialSatelliteMap(p);
  const title=p.propertyName||p.title||p.name||'Não informado',owner=p.owner||p.ownerName||'Não informado',city=p.city||p.municipality||'Não informado',uf=p.uf||p.stateCode||'';
  const today=new Date().toLocaleDateString('pt-BR');
  const qrBox=publicAccess.url&&publicAccess.qr
    ? `<div style="display:grid;place-items:center;gap:6px"><img src="${publicAccess.qr}" width="102" height="102" alt="QR Code do mapa público" style="display:block;background:#fff;border:1px solid #cbd5e1;padding:3px"><div style="font-size:10px;font-weight:700">Mapa público</div></div>`
    : `<div style="display:grid;place-items:center;width:110px;height:110px;border:1px solid #cbd5e1;background:#f8fafc;color:#64748b;font-size:10px;text-align:center">QR indisponível</div>`;
  const northArrow=`<svg viewBox="0 0 90 120" xmlns="http://www.w3.org/2000/svg" style="width:68px;height:auto"><text x="45" y="20" text-anchor="middle" font-size="18" font-weight="700" fill="#111827">N</text><polygon points="45,28 25,98 45,82 65,98" fill="#111827"/><polygon points="45,28 33,84 45,72" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.2"/></svg>`;
  const footerPanel=`<section style="border:2px solid #111827;margin-top:12px;page-break-inside:avoid;background:#fff"><div style="border-bottom:2px solid #111827">${satellite}</div><div style="display:grid;grid-template-columns:1fr 1.45fr"><div style="border-right:2px solid #111827;padding:10px 12px;display:grid;grid-template-rows:auto auto;gap:10px"><div><div style="font-size:14px;font-weight:700;text-align:center;margin-bottom:8px">Sist. de Coordenadas Geográficas</div><div style="display:grid;grid-template-columns:80px 1fr;gap:10px;align-items:center">${northArrow}<div><div style="font-size:13px"><b>Datum:</b></div><div style="font-size:12px;line-height:1.5">${escapeHtml($('memDatum').value)}</div></div></div></div><div style="display:grid;grid-template-columns:110px 1fr;gap:12px;align-items:start;border-top:1px solid #cbd5e1;padding-top:10px">${qrBox}<div><div style="font-size:14px;font-weight:700;margin-bottom:8px">LEGENDAS</div><div style="display:grid;gap:7px;font-size:12px"><div style="display:flex;align-items:center;gap:8px"><span style="display:inline-block;width:28px;height:16px;border:1px solid #475569;background:#e5e7eb"></span><span>- Perímetro</span></div><div style="display:flex;align-items:center;gap:8px"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#ef4444"></span><span>- Vértices</span></div></div></div></div></div><div style="padding:10px 12px;display:grid;grid-template-rows:auto auto;gap:10px"><div style="border:1px solid #111827;padding:10px 12px"><div style="text-align:center;font-size:14px;font-weight:700;margin-bottom:8px">DADOS DO IMÓVEL</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;font-size:12px;line-height:1.45"><div style="grid-column:1/-1"><b>Imóvel:</b> ${escapeHtml(title)}</div><div><b>Matrícula:</b> ${escapeHtml(reg||'Não informada')}</div><div><b>Município/UF:</b> ${escapeHtml(city)}/${escapeHtml(uf)}</div><div><b>Área:</b> ${num(areaHa,4)} ha</div><div><b>Perímetro:</b> ${num(totalPerimeter,3)} m</div></div></div><div style="border:1px solid #111827;padding:10px 12px;display:grid;grid-template-columns:96px 1fr;gap:12px;align-items:center"><img src="/assets/logo.png" alt="Surveyor" style="display:block;max-width:96px;width:100%;height:auto"><div style="font-size:12px;line-height:1.55"><div><b>Proprietário(a):</b> ${escapeHtml(owner)}</div><div><b>Responsável Técnico(a):</b> ${escapeHtml(tech||'Não informado')}</div><div><b>Data:</b> ${today}</div>${publicAccess.url?`<div style="margin-top:6px;font-size:10px;word-break:break-all"><b>Link público:</b> ${escapeHtml(publicAccess.url)}</div>`:''}</div></div></div></div></section>`;
  return`<article style="max-width:1040px;margin:auto;background:#fff;color:#172033;padding:34px;border:1px solid #cbd5e1;font-family:Arial,sans-serif">
    <header style="text-align:center;border-bottom:2px solid #1e3a5f;padding-bottom:14px;margin-bottom:18px"><h1 style="margin:0;font-size:27px;letter-spacing:.7px">MEMORIAL DESCRITIVO</h1><p style="margin:7px 0 0;color:#475569">Descrição perimétrica, confrontações e quadro técnico do imóvel rural</p></header>
    <section style="display:grid;grid-template-columns:1.15fr .85fr;border:1px solid #334155;margin-bottom:20px;page-break-inside:avoid"><div style="padding:14px;border-right:1px solid #334155;line-height:1.65"><b>Imóvel:</b> ${escapeHtml(title)}<br><b>Proprietário/Possuidor:</b> ${escapeHtml(owner)}<br><b>Município/UF:</b> ${escapeHtml(city)}/${escapeHtml(uf)}<br><b>Matrícula/Referência:</b> ${escapeHtml(reg||'Não informada')}</div><div style="padding:14px;line-height:1.65"><b>Responsável técnico:</b> ${escapeHtml(tech||'Não informado')}<br><b>Sistema geodésico:</b> ${escapeHtml($('memDatum').value)}<br><b>Área:</b> ${num(areaHa,4)} ha<br><b>Perímetro:</b> ${num(totalPerimeter,3)} m</div></section>
    <h2 style="font-size:18px;border-bottom:1px solid #94a3b8;padding-bottom:6px">1. Descrição do perímetro</h2><p style="text-align:justify;line-height:1.62">${escapeHtml(intro)}</p>${narrative}
    <h2 style="font-size:18px;border-bottom:1px solid #94a3b8;padding-bottom:6px;margin-top:24px">2. Quadro de vértices e confrontantes</h2><div style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:11px;min-width:880px"><thead><tr>${['Vértice','Latitude','Longitude','Azimute','Distância','Confrontante','Limite'].map(h=>`<th style="border:1px solid #94a3b8;background:#e2e8f0;padding:7px;text-align:left">${h}</th>`).join('')}</tr></thead><tbody>${coords.replaceAll('<td>','<td style="border:1px solid #cbd5e1;padding:6px">')}</tbody></table></div>
    <h2 style="font-size:18px;border-bottom:1px solid #94a3b8;padding-bottom:6px;margin-top:24px">3. Mapa de localização</h2><p style="font-size:12px;color:#475569">Layout redesenhado com quadro técnico inferior no padrão croqui, incluindo QR Code, norte, legendas e dados resumidos do imóvel.</p>${footerPanel}
  </article>`;
}
function initMemorial(){if(document.body?.dataset?.page==='memorial.html')return;const b=$('generateMemorial');if(!b)return;b.onclick=async()=>{const p=await selectedProjectReady();if(!p)return;const c=ring(p);if(c.length<4)return toast('O projeto não possui perímetro válido.','error');const originalText=b.textContent;b.disabled=true;b.textContent='Gerando link e QR Code...';try{const ss=segments(c),intro=$('memIntro').value.trim(),reg=$('memRegistration').value.trim(),tech=$('memTechnician').value.trim(),publicAccess=await projectPublicAccess(p);lastText=`MEMORIAL DESCRITIVO\n\nIMÓVEL: ${p.title}\nPROPRIETÁRIO/POSSUIDOR: ${p.owner||'Não informado'}\nMUNICÍPIO/UF: ${p.city||'Não informado'}/${p.uf||''}\nREFERÊNCIA: ${reg||'Não informada'}\nRESPONSÁVEL TÉCNICO: ${tech||'Não informado'}\nSISTEMA: ${$('memDatum').value}\n${publicAccess.url?`LINK PÚBLICO DA DEMARCAÇÃO: ${publicAccess.url}\n`:''}\n${intro}\n\n`+ss.map(s=>{const cf=confrontanteForSegment(p,s.i-1);return`Do vértice V-${String(s.i).padStart(2,'0')} (${s.a[1].toFixed(7)}, ${s.a[0].toFixed(7)}) segue-se com azimute de ${num(s.az,4)}° e distância de ${num(s.distance,3)} m até o vértice V-${String(s.i+1>ss.length?1:s.i+1).padStart(2,'0')}${confrontationText(cf)}.`}).join('\n')+`\n\nÁrea calculada: ${num(area(perimeter(p))/10000,4)} ha.\nPerímetro calculado: ${num(ss.reduce((a,s)=>a+s.distance,0),3)} m.\n\nO mapa do terreno, os vértices e os confrontantes acompanham a versão HTML/impresa deste memorial.\n\nDocumento demonstrativo. Deve ser conferido e assinado por profissional habilitado.`;lastHtml=await memorialHtml(p,ss,intro,reg,tech,publicAccess);$('memorialOutput').innerHTML=(window.GeoRuralDocumentTheme?.headerHtml('Memorial descritivo')||'')+lastHtml+(window.GeoRuralDocumentTheme?.footerHtml()||'');toast(publicAccess.url&&publicAccess.qr?'Memorial gerado com QR Code e link público.':publicAccess.url?'Memorial gerado com link público; não foi possível desenhar o QR Code.':'Memorial gerado. Não foi possível criar o compartilhamento.','success')}catch(error){console.error(error);toast(error.message||'Não foi possível gerar o memorial.','error')}finally{b.disabled=false;b.textContent=originalText}};$('downloadMemorial').onclick=()=>lastText?download(`${slug(selectedProject()?.title)}-memorial.txt`,lastText,'text/plain;charset=utf-8'):toast('Gere o memorial primeiro.','error');$('downloadMemorialHtml')?.addEventListener('click',()=>lastHtml?download(`${slug(selectedProject()?.title)}-memorial.html`,window.GeoRuralDocumentTheme?.wrapHtml(lastHtml,'Memorial descritivo')||`<!doctype html><meta charset="utf-8"><body>${lastHtml}</body>`,'text/html;charset=utf-8'):toast('Gere o memorial primeiro.','error'))}
function xmlEsc(s){return escapeHtml(s)}function odsCell(v){return`<table:table-cell office:value-type="string"><text:p>${xmlEsc(v)}</text:p></table:table-cell>`}async function initOds(){const b=$('generateOds');if(!b)return;b.onclick=async()=>{const p=await selectedProjectReady();if(!p)return;if(!window.JSZip)return toast('Biblioteca ODS não carregada.','error');const f=perimeter(p),coords=ring(p).slice(0,-1),ss=segments(ring(p));const sheets=[['Imovel',[['Campo','Valor'],['Nome',p.title],['Proprietário',p.owner||''],['Município',p.city||''],['UF',p.uf||''],['Código',$('odsCode').value],['Responsável técnico',$('odsTechnician').value],['Registro profissional',$('odsArt').value],['Área ha',num(area(f)/10000,6)]]],['Vertices',[['Vértice','Latitude','Longitude','Azimute','Distância m'],...coords.map((c,i)=>[`V-${String(i+1).padStart(2,'0')}`,c[1].toFixed(8),c[0].toFixed(8),ss[i]?ss[i].az.toFixed(6):'',ss[i]?ss[i].distance.toFixed(3):''])]],['Areas',[['Nome','Categoria','Área ha'],...(p.geojson?.features||[]).filter(x=>x.geometry?.type.includes('Polygon')).map(x=>[x.properties?.name||'',cats[x.properties?.category]?.[0]||x.properties?.category||'',(area(x)/10000).toFixed(6)])]]];const content=`<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2"><office:body><office:spreadsheet>${sheets.map(([name,rows])=>`<table:table table:name="${xmlEsc(name)}">${rows.map(r=>`<table:table-row>${r.map(odsCell).join('')}</table:table-row>`).join('')}</table:table>`).join('')}</office:spreadsheet></office:body></office:document-content>`;const manifest=`<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>`;const z=new JSZip();z.file('mimetype','application/vnd.oasis.opendocument.spreadsheet',{compression:'STORE'});z.file('content.xml',content);z.folder('META-INF').file('manifest.xml',manifest);const blob=await z.generateAsync({type:'blob',mimeType:'application/vnd.oasis.opendocument.spreadsheet'});const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=`${slug(p.title)}-georreferenciamento.ods`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);$('odsStatus').textContent=`ODS gerado com ${coords.length} vértices e ${(p.geojson?.features||[]).length} elemento(s).`;toast('Planilha ODS gerada.','success')}}
function formatLongDate(value){const d=value?new Date(`${value}T12:00:00`):new Date();if(Number.isNaN(d.getTime()))return new Date().toLocaleDateString('pt-BR');return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})}
function projectPlace(p){const city=(p?.city||p?.municipality||p?.metadata?.city||p?.metadata?.municipality||'Amargosa').trim?.()||'Amargosa';const uf=(p?.uf||p?.stateCode||p?.state||p?.metadata?.uf||p?.metadata?.stateCode||'BA').trim?.()||'BA';return `${city}/${uf}`}
function fillLetterPlaceDate(p){if($('letterPlace')&&!$('letterPlace').value.trim())$('letterPlace').value=projectPlace(p||selectedProject?.()||{});if($('letterDate')&&!$('letterDate').value)$('letterDate').value=new Date().toISOString().slice(0,10)}
function letterPlaceDate(p){fillLetterPlaceDate(p);const place=($('letterPlace')?.value||projectPlace(p)).trim();const date=($('letterDate')?.value||new Date().toISOString().slice(0,10));return `${place}, ${formatLongDate(date)}.`}
function initLetter(){
  const b=$('generateLetter');if(!b)return;
  let liveTimer=0;
  const renderLetter=async({strict=true}={})=>{
    const p=await selectedProjectReady();if(!p)return false;
    fillLetterPlaceDate(p);
    const typed=$('neighborName')?.value?.trim()||'';
    if(strict&&!typed){toast('Informe o confrontante.','error');return false}
    const n=typed||'Confrontante a informar';
    const localData=letterPlaceDate(p);
    lastHtml=`<h1 style="text-align:center">CARTA DE CONFRONTAÇÃO</h1><p>Eu, <b>${escapeHtml(n)}</b>, ${$('neighborDoc').value?`inscrito(a) no CPF/CNPJ sob nº ${escapeHtml($('neighborDoc').value)}, `:''}declaro, para os devidos fins, que fui cientificado(a) acerca dos limites do imóvel rural <b>${escapeHtml(p.title||p.propertyName||p.name||'não informado')}</b>, de responsabilidade de <b>${escapeHtml(p.owner||p.ownerName||'não informado')}</b>, situado em ${escapeHtml(p.city||p.municipality||'município não informado')}/${escapeHtml(p.uf||p.stateCode||'')}.</p><p>O trecho confrontado corresponde a: <b>${escapeHtml($('neighborSide').value||'a informar')}</b>, tendo como referência de limite: <b>${escapeHtml($('neighborLimit').value||'a informar')}</b>.</p><p>${escapeHtml($('neighborNotes').value||'Declaro estar ciente da confrontação representada na planta e no memorial apresentados.')}</p><p style="text-align:left;margin:26px 0 34px">${escapeHtml(localData)}</p><p style="text-align:center">________________________________________<br>${escapeHtml(n)}<br>Confrontante</p>`;
    const letterPreviewHtml=(window.GeoRuralDocumentTheme?.headerHtml('Carta de confrontação')||'')+lastHtml+(window.GeoRuralDocumentTheme?.footerHtml()||'');
    const letterOutput=$('letterOutput');if(letterOutput){letterOutput.hidden=false;letterOutput.innerHTML=letterPreviewHtml;letterOutput.classList.add('document-preview-visible')}
    try{window.dispatchEvent(new CustomEvent('surveyor:document-generation-finished',{detail:{page:'confrontacao.html'}}))}catch(_error){}
    return true;
  };
  const schedule=()=>{if(!$('projectSelect')?.value)return;clearTimeout(liveTimer);liveTimer=setTimeout(()=>renderLetter({strict:false}).catch(console.error),360)};
  $('projectSelect')?.addEventListener('change',()=>setTimeout(()=>{const p=project($('projectSelect')?.value);if(p){if($('letterPlace'))$('letterPlace').value=projectPlace(p);fillLetterPlaceDate(p);renderLetter({strict:false}).catch(console.error)}},150));
  ['letterPlace','letterDate','neighborName','neighborDoc','neighborSide','neighborLimit','neighborNotes'].forEach((id)=>{const c=$(id);c?.addEventListener('input',schedule);c?.addEventListener('change',schedule)});
  b.onclick=()=>renderLetter({strict:true});
  $('downloadLetter').onclick=()=>lastHtml?download('carta-confrontacao.html',window.GeoRuralDocumentTheme?.wrapHtml(lastHtml,'Carta de confrontação')||`<!doctype html><meta charset="utf-8"><body>${lastHtml}</body>`,'text/html;charset=utf-8'):toast('Gere a carta primeiro.','error')
}
function initMap(){const b=$('generateMap');if(!b)return;b.onclick=async()=>{const p=await selectedProjectReady();if(!p)return;lastSvg=svgFromProject(p,$('mapTitle').value,$('mapLayout').value==='environmental');$('mapPreview').innerHTML=lastSvg};$('downloadSvg').onclick=()=>lastSvg?download('mapa-automatico.svg',lastSvg,'image/svg+xml;charset=utf-8'):toast('Gere a prancha primeiro.','error')}
function parseElev(){return $('elevationPoints').value.split(/\r?\n/).map(l=>l.trim()).filter(Boolean).map(l=>{const p=l.split(/[;\t]/);return{name:p[0],lat:+String(p[1]).replace(',','.'),lng:+String(p[2]).replace(',','.'),alt:+String(p[3]).replace(',','.')}}).filter(p=>[p.lat,p.lng,p.alt].every(Number.isFinite))}function elevSvg(ps){const W=900,H=520,pad=70,xs=ps.map(p=>p.lng),ys=ps.map(p=>p.lat),as=ps.map(p=>p.alt),minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys),mina=Math.min(...as),maxa=Math.max(...as),proj=p=>[pad+(p.lng-minx)/(maxx-minx||1)*(W-2*pad),H-pad-(p.lat-miny)/(maxy-miny||1)*(H-2*pad)],color=a=>{const t=(a-mina)/(maxa-mina||1),r=Math.round(40+210*t),g=Math.round(150-70*t),b=Math.round(240-180*t);return`rgb(${r},${g},${b})`};const lines=ps.slice(1).map((p,i)=>{const a=proj(ps[i]),b=proj(p);return`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#64748b" stroke-width="2"/>`}).join(''),dots=ps.map(p=>{const q=proj(p);return`<circle cx="${q[0]}" cy="${q[1]}" r="10" fill="${color(p.alt)}" stroke="#fff" stroke-width="2"/><text x="${q[0]+13}" y="${q[1]-5}" font-size="13">${escapeHtml(p.name)} — ${p.alt.toFixed(2)} m</text>`}).join('');return`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f8fafc"/><text x="35" y="40" font-size="24" font-weight="700">Mapa planialtimétrico demonstrativo</text>${lines}${dots}<text x="35" y="495" font-size="12">Altitudes informadas pelo usuário. Não consultadas automaticamente.</text></svg>`}function initElevation(){if(!$('analyzeElevation'))return;$('analyzeElevation').onclick=()=>{elevData=parseElev();if(elevData.length<2)return toast('Informe ao menos dois pontos válidos.','error');const al=elevData.map(p=>p.alt),mi=Math.min(...al),ma=Math.max(...al);$('elevCount').textContent=elevData.length;$('elevMin').textContent=`${num(mi,2)} m`;$('elevMax').textContent=`${num(ma,2)} m`;$('elevRange').textContent=`${num(ma-mi,2)} m`;$('elevationPreview').innerHTML=elevSvg(elevData)};$('calculateIdw').onclick=()=>{if(!elevData.length)elevData=parseElev();const lat=+$('idwLat').value,lng=+$('idwLng').value,pow=+$('idwPower').value||2;if(!Number.isFinite(lat)||!Number.isFinite(lng)||!elevData.length)return toast('Dados insuficientes.','error');let n=0,d=0;for(const p of elevData){const dist=Math.max(hav([lng,lat],[p.lng,p.lat]),.001),w=1/(dist**pow);n+=w*p.alt;d+=w}$('idwOutput').textContent=`Altitude ponderada por IDW: ${num(n/d,3)} m. Foram utilizados ${elevData.length} pontos e potência ${pow}.`}}
function destination(lat,lng,az,dist){const R=6371008.8,d=dist/R,t=az*Math.PI/180,p1=lat*Math.PI/180,l1=lng*Math.PI/180,p2=Math.asin(Math.sin(p1)*Math.cos(d)+Math.cos(p1)*Math.sin(d)*Math.cos(t)),l2=l1+Math.atan2(Math.sin(t)*Math.sin(d)*Math.cos(p1),Math.cos(d)-Math.sin(p1)*Math.sin(p2));return[p2*180/Math.PI,((l2*180/Math.PI+540)%360)-180]}function initAzimuth(){if(!$('generateAzimuth'))return;$('generateAzimuth').onclick=()=>{let lat=+$('startLat').value,lng=+$('startLng').value;if(!Number.isFinite(lat)||!Number.isFinite(lng))return toast('Coordenada inicial inválida.','error');const rows=$('azimuthLines').value.split(/\r?\n/).map(l=>l.trim()).filter(Boolean).map(l=>l.split(/[;\t,]/).map(v=>+String(v).replace(',','.'))).filter(r=>Number.isFinite(r[0])&&Number.isFinite(r[1])&&r[1]>0);if(!rows.length)return toast('Informe azimutes e distâncias.','error');const coords=[[lng,lat]],records=[];let total=0;rows.forEach((r,i)=>{const start=[lng,lat],[nl,nlo]=destination(lat,lng,r[0],r[1]);records.push({i:i+1,start,az:r[0],dist:r[1]});lat=nl;lng=nlo;coords.push([lng,lat]);total+=r[1]});const closure=hav(coords.at(-1),coords[0]);coords.push(coords[0]);azFc={type:'FeatureCollection',features:[{type:'Feature',properties:{name:$('azProjectName').value||'Perímetro por azimutes',category:'perimetro'},geometry:{type:'Polygon',coordinates:[coords]}}]};$('azVertices').textContent=records.length;$('azDistance').textContent=`${num(total,3)} m`;$('azClosure').textContent=`${num(closure,3)} m`;$('azArea').textContent=`${num(area(azFc.features[0])/10000,4)} ha`;$('azimuthTable').innerHTML=records.map(r=>`<tr><td>V-${String(r.i).padStart(2,'0')}</td><td>${r.start[1].toFixed(8)}</td><td>${r.start[0].toFixed(8)}</td><td>${r.az.toFixed(4)}°</td><td>${r.dist.toFixed(3)} m</td></tr>`).join('');$('azimuthPreview').innerHTML=svgStandalone(azFc,$('azProjectName').value)};$('downloadAzimuthGeojson').onclick=()=>azFc?download('perimetro-azimutes.geojson',JSON.stringify(azFc,null,2),'application/geo+json'):toast('Calcule o perímetro primeiro.','error');$('saveAzimuthProject').onclick=async()=>{if(!azFc)return toast('Calcule o perímetro primeiro.','error');const coords=azFc.features[0].geometry.coordinates[0],cent=coords.reduce((a,c)=>[a[0]+c[0],a[1]+c[1]],[0,0]).map(v=>v/coords.length);try{const saved=await window.GeoRuralProjects.saveLegacy({title:$('azProjectName').value||'Perímetro por azimutes',owner:'',city:'',uf:'BA',geojson:azFc,metadata:{module:'azimuth'},view:{center:{lat:cent[1],lng:cent[0]},zoom:15}});projectCache.unshift(saved);toast('Projeto salvo no Appwrite. Abra o módulo de mapa.','success')}catch(error){console.error(error);toast(error.message||'Falha ao salvar o projeto na nuvem.','error')}}}function svgStandalone(fc,title){const p={title,city:'',uf:'',owner:'',geojson:fc};return svgFromProject(p,title)}
function environmentalReportCss(){return `
  @page{size:A4 portrait;margin:13mm 13mm 14mm}
  *{box-sizing:border-box}
  body{margin:0;background:#fff;color:#111827;font-family:Arial,Helvetica,sans-serif;font-size:10.2pt;line-height:1.34}
  .env-report-sheet{max-width:186mm;margin:0 auto;background:#fff;color:#111827}
  .env-report-sheet h1{text-align:center;font-size:17.5pt;letter-spacing:.8px;margin:8px 0 3px;color:#111827;text-transform:uppercase;font-weight:800;border-bottom:2px solid #111827;padding-bottom:8px}
  .env-report-subtitle{text-align:center;margin:0 0 12px;color:#334155;font-size:9.5pt}
  .env-report-meta{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1.5px solid #111827;border-right:0;border-bottom:0;border-radius:0;padding:0;margin:12px 0 12px;background:#fff}
  .env-report-meta div{min-height:32px;border-right:1px solid #111827;border-bottom:1px solid #111827;padding:7px 9px;background:#fff}.env-report-meta strong{font-weight:850;color:#111827}
  .env-summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin:10px 0 12px;border:1px solid #94a3b8;border-right:0}
  .env-summary-card{border:0;border-right:1px solid #94a3b8;border-radius:0;padding:8px 8px;background:#fff;min-height:50px}
  .env-summary-card b{display:block;font-size:8pt;color:#334155;text-transform:uppercase;margin-bottom:4px}.env-summary-card span{font-size:12.5pt;font-weight:850;color:#111827}
  .env-report-section{margin:12px 0 16px}.env-report-section h2{font-size:12pt;margin:0 0 7px;color:#111827;border-bottom:1px solid #111827;padding-bottom:5px;text-transform:uppercase;letter-spacing:.02em}
  .env-table{width:100%;border-collapse:collapse;font-size:9.2pt;background:#fff}.env-table th,.env-table td{border:1px solid #94a3b8;padding:7px 8px;text-align:left;vertical-align:top}.env-table th{background:#eef2f7;color:#111827;font-weight:850;text-transform:uppercase;font-size:8pt}.env-table td.num{text-align:right;font-variant-numeric:tabular-nums}
  .env-color-dot{display:inline-block;width:8px;height:8px;border-radius:0;margin-right:7px;vertical-align:0;border:1px solid rgba(15,23,42,.35)}
  .env-note-box{border:1px solid #94a3b8;background:#fff;border-radius:0;padding:9px 10px;margin:8px 0;color:#111827}
  .env-alert-box{border:1px solid #94a3b8;background:#fff;border-radius:0;padding:9px 10px;margin:8px 0;color:#111827}
  .env-signature{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:34px;break-inside:avoid;page-break-inside:avoid}.env-signature div{border-top:1.5px solid #111827;text-align:center;padding-top:7px;font-size:9.2pt;min-height:52px}.env-signature-name{display:block;min-height:17px;color:#111827}.env-signature b{font-size:8.5pt;text-transform:uppercase;letter-spacing:.03em;color:#111827}
  .georural-custom-header{margin-bottom:12px!important;padding-bottom:10px!important}.georural-custom-footer{margin-top:14px!important}
  @media print{body{background:#fff}.env-report-sheet{max-width:none}.env-report-section,.env-summary-grid,.env-report-meta{break-inside:avoid;page-break-inside:avoid}}
`}
function environmentalReportBody(p,totals,perimeterArea){const analystRaw=String($('environmentAnalyst')?.value||'').trim(),analyst=escapeHtml(analystRaw||''),rawNotes=String($('environmentNotes')?.value||'').trim(),notes=escapeHtml(rawNotes),title=escapeHtml(p.title||p.propertyName||p.name||'Não informado'),owner=escapeHtml(p.owner||p.proprietario||p.ownerName||'Não informado'),city=escapeHtml(p.city||p.municipality||''),uf=escapeHtml(p.uf||p.stateCode||''),date=new Date().toLocaleDateString('pt-BR');const entries=Object.entries(totals).filter(([c,a])=>c!=='perimetro'&&Number(a)>0);const header=window.GeoRuralDocumentTheme?.headerHtml?.('Surveyor')||'';const footer=window.GeoRuralDocumentTheme?.footerHtml?.()||'';const tech=escapeHtml(window.GeoRuralDocumentTheme?.get?.()?.responsibleTechnician||'');const notesSection=rawNotes?`<section class="env-report-section"><h2>Observações técnicas</h2><div class="env-note-box">${notes}</div></section>`:'';return `<main class="env-report-sheet">${header}<h1>RELATÓRIO AMBIENTAL PRELIMINAR</h1><p class="env-report-subtitle">APP, Reserva Legal, vegetação e áreas produtivas do projeto.</p><section class="env-report-meta"><div><strong>IMÓVEL:</strong> ${title}</div><div><strong>PROPRIETÁRIO:</strong> ${owner}</div><div><strong>LOCALIZAÇÃO:</strong> ${city}${city&&uf?'/':''}${uf}</div><div><strong>RESPONSÁVEL PELA ANÁLISE:</strong> ${analyst||'A preencher'}</div><div><strong>DATA:</strong> ${date}</div><div><strong>ÁREA DO PERÍMETRO:</strong> ${num(perimeterArea,4)} ha</div></section><section class="env-summary-grid"><div class="env-summary-card"><b>APP</b><span>${num(totals.app||0,4)} ha</span></div><div class="env-summary-card"><b>Reserva Legal</b><span>${num(totals.reserva||0,4)} ha</span></div><div class="env-summary-card"><b>Vegetação nativa</b><span>${num(totals.vegetacao||0,4)} ha</span></div><div class="env-summary-card"><b>Área produtiva</b><span>${num(totals.produtiva||0,4)} ha</span></div></section><section class="env-report-section"><h2>Quadro de áreas ambientais</h2><table class="env-table"><thead><tr><th>Categoria</th><th>Área (ha)</th><th>% do perímetro</th></tr></thead><tbody>${entries.map(([c,a])=>`<tr><td><span class="env-color-dot" style="background:${cats[c]?.[1]||'#94a3b8'}"></span>${escapeHtml(cats[c]?.[0]||c)}</td><td class="num">${num(a,4)}</td><td class="num">${perimeterArea?num(a/perimeterArea*100,2):'—'}%</td></tr>`).join('')||'<tr><td colspan="3">Nenhuma área ambiental classificada foi encontrada no projeto.</td></tr>'}<tr><td><b>Área do perímetro</b></td><td class="num"><b>${num(perimeterArea,4)}</b></td><td></td></tr></tbody></table></section>${notesSection}<section class="env-signature"><div><span class="env-signature-name">${analyst}</span><b>Responsável pela análise</b></div><div><span class="env-signature-name">${tech}</span><b>Responsável técnico</b></div></section>${footer}</main>`}
function environmentalFullHtml(body){return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório ambiental</title><style>${environmentalReportCss()}</style></head><body>${body}</body></html>`}
function environmentalPrint(){if(!lastHtml)return toast('Gere o relatório primeiro.','error');const state=window.SurveyorPdfPreview?.getState?.('environmentOutput');if(state?.url){const pdfWindow=window.open(state.url,'_blank','noopener,noreferrer');if(!pdfWindow)return toast('O navegador bloqueou a janela do PDF.','error');return;}const w=window.open('','_blank','width=1100,height=780');if(!w){window.print();return;}w.addEventListener('load',()=>setTimeout(()=>w.print(),350),{once:true});w.document.open();w.document.write(environmentalFullHtml(lastHtml));w.document.close()}
function environmentalWord(){if(!lastHtml)return toast('Gere o relatório primeiro.','error');download('relatorio-ambiental.doc',environmentalFullHtml(lastHtml),'application/msword;charset=utf-8')}
function initEnvironmental(){
  if(!$('generateEnvironmental'))return;
  let liveTimer=0;
  const ensureWordButton=()=>{let b=$('grDownloadWordGlobal')||$('downloadEnvironmentalWord');if(!b){b=document.createElement('button');b.id='grDownloadWordGlobal';b.type='button';b.className='btn export-hidden';b.textContent='Word ambiental';$('downloadEnvironmental')?.after(b)}b.onclick=environmentalWord;};
  ensureWordButton();
  const renderEnvironmental=async()=>{const p=await selectedProjectReady();if(!p)return false;const fs=p.geojson?.features?.filter(f=>f.geometry?.type.includes('Polygon'))||[],totals={};fs.forEach(f=>{const c=f.properties?.category||'outros';if(c==='gleba'||f.properties?.generatedBy==='map-glebas')return;totals[c]=(totals[c]||0)+area(f)/10000});const perimeterArea=area(perimeter(p))/10000;totals.perimetro=perimeterArea;lastHtml=environmentalReportBody(p,totals,perimeterArea);const preview=$('environmentOutput'),source=`<style>${environmentalReportCss()}</style>${lastHtml}`;if(preview){preview.hidden=false;preview.innerHTML=source;preview.classList.add('document-preview-visible')}try{window.dispatchEvent(new CustomEvent('surveyor:document-generation-finished',{detail:{page:'ambiental.html'}}))}catch(_error){}return true;};
  const schedule=()=>{if(!$('projectSelect')?.value)return;clearTimeout(liveTimer);liveTimer=setTimeout(()=>renderEnvironmental().catch(console.error),360)};
  $('projectSelect')?.addEventListener('change',schedule);
  ['environmentAnalyst','environmentNotes'].forEach((id)=>{const c=$(id);c?.addEventListener('input',schedule);c?.addEventListener('change',schedule)});
  $('generateEnvironmental').onclick=renderEnvironmental;
  $('downloadEnvironmental').onclick=()=>lastHtml?download('relatorio-ambiental.html',environmentalFullHtml(lastHtml),'text/html;charset=utf-8'):toast('Gere o relatório primeiro.','error');
  $('printOutput').onclick=(event)=>{event?.preventDefault?.();environmentalPrint()};
}
function initCommon(){if(document.querySelector('#projectSelect')){if(window.GeoRuralProjects?.list)setupProjects();else toast('O módulo de projetos não foi carregado nesta página.','error')}$('mobileToggle')?.addEventListener('click',()=>$('side')?.classList.toggle('open'));if(document.body?.dataset?.page!=='memorial.html')document.querySelectorAll('#printOutput,#printPreview').forEach(b=>b.onclick=()=>window.print())}
initCommon();initMemorial();initOds();initLetter();initMap();initElevation();initAzimuth();initEnvironmental();})();
