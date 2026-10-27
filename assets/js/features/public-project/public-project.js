(() => {
  'use strict';
  const $=(id)=>document.getElementById(id);
  const queryParams=new URLSearchParams(location.search);
  const hashParams=new URLSearchParams(String(location.hash||'').replace(/^#/,'').replace(/^\?/,'') || '');
  const token=hashParams.get('token')||queryParams.get('token')||'';
  const snapshot=hashParams.get('snapshot')||queryParams.get('snapshot')||'';
  const shortCode=String(hashParams.get('code')||queryParams.get('code')||'').toUpperCase().replace(/[O]/g,'0').replace(/[IL]/g,'1').replace(/[^0-9A-HJKMNP-TV-Z]/g,'');
  const locationCode=String(hashParams.get('loc')||queryParams.get('loc')||queryParams.get('l')||'').toUpperCase().replace(/[O]/g,'0').replace(/[IL]/g,'1').replace(/[^0-9A-HJKMNP-TV-Z]/g,'');
  if(queryParams.has('token')) queryParams.delete('token');
  if(queryParams.has('code')) queryParams.delete('code');
  if(token||shortCode||locationCode){
    const cleanQuery=queryParams.toString();
    history.replaceState(null,'',`${location.pathname}${cleanQuery?`?${cleanQuery}`:''}`);
  }
  const base=String(window.GEORURAL_CONFIG?.apiBaseUrl||'').replace(/\/$/,'');
  const colors={perimetro:'#ef2626',reserva:'#15803d',app:'#ef4444',produtiva:'#f59e0b',vegetacao:'#22c55e',consolidada:'#a855f7',estrada:'#f97316',agua:'#38bdf8',benfeitoria:'#eab308',outros:'#64748b'};
  const labels={perimetro:'Perímetro do imóvel',reserva:'Reserva Legal',app:'APP',produtiva:'Área produtiva',vegetacao:'Vegetação nativa',consolidada:'Área consolidada',estrada:'Estrada/servidão',agua:'Nascente/curso d’água',benfeitoria:'Benfeitoria',outros:'Outros'};
  const escape=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeHttpUrl=(value)=>{const raw=String(value||'').trim();if(!/^https:\/\//i.test(raw))return'';try{const parsed=new URL(raw);return parsed.protocol==='https:'&&!parsed.username&&!parsed.password?parsed.href:''}catch{return''}};
  const osm=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:20,attribution:'&copy; OpenStreetMap'}),sat=L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{maxZoom:22,attribution:'&copy; Google'}),hybrid=L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',{maxZoom:22,attribution:'&copy; Google'}),terrain=L.tileLayer('https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',{maxZoom:22,attribution:'&copy; Google'});
  const bases={osm,sat,hybrid,terrain}; const map=L.map('publicMap',{center:[-13.0364,-39.6021],zoom:13,layers:[osm]}); const group=L.featureGroup().addTo(map); const layerEntries=[];
  function showError(message){$('publicError').textContent=message;$('publicError').classList.remove('hidden')}
  function askSharePassword(){
    return new Promise((resolve)=>{
      const overlay=document.createElement('div');
      overlay.className='public-password-overlay';
      overlay.innerHTML=`<form class="public-password-dialog" autocomplete="off"><h2>Projeto protegido</h2><p>Informe a senha definida pelo responsável pelo compartilhamento.</p><label>Senha<input name="password" type="password" autocomplete="current-password" required maxlength="200"></label><div><button type="button" data-cancel>Cancelar</button><button type="submit">Acessar projeto</button></div></form>`;
      document.body.appendChild(overlay);
      const form=overlay.querySelector('form');
      const input=form.elements.password;
      const finish=(value)=>{overlay.remove();resolve(value)};
      form.addEventListener('submit',(event)=>{event.preventDefault();finish(String(input.value||''))});
      overlay.querySelector('[data-cancel]').addEventListener('click',()=>finish(''));
      overlay.addEventListener('click',(event)=>{if(event.target===overlay)finish('')});
      setTimeout(()=>input.focus(),0);
    });
  }


  const PUBLIC_LOCATION_ALPHABET='0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  function decodePublicLocationCode(value){
    const code=String(value||'').toUpperCase().replace(/[O]/g,'0').replace(/[IL]/g,'1').replace(/[^0-9A-HJKMNP-TV-Z]/g,'');
    if(!/^[0-9A-HJKMNP-TV-Z]{10}$/.test(code))throw new Error('Código curto de localização inválido.');
    let packed=0n;
    for(const char of code){
      const index=PUBLIC_LOCATION_ALPHABET.indexOf(char);
      if(index<0)throw new Error('Código curto de localização inválido.');
      packed=(packed<<5n)|BigInt(index);
    }
    const mask=(1n<<25n)-1n;
    const lngQ=Number(packed&mask);
    const latQ=Number((packed>>25n)&mask);
    const max=Number(mask);
    const lat=(latQ/max)*180-90;
    const lng=(lngQ/max)*360-180;
    if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<-90||lat>90||lng<-180||lng>180)throw new Error('Localização pública inválida.');
    return{lat,lng};
  }

  function parseBase36Int(value){
    const raw=String(value||'').trim();
    if(!/^-?[0-9a-z]+$/i.test(raw))throw new Error('Snapshot público inválido.');
    const negative=raw.startsWith('-');
    const parsed=parseInt(negative?raw.slice(1):raw,36);
    if(!Number.isFinite(parsed))throw new Error('Snapshot público inválido.');
    return negative?-parsed:parsed;
  }
  function decodeSnapshot(raw){
    const value=String(raw||'').trim();
    if(!value.startsWith('v1:'))throw new Error('Versão do snapshot público não suportada.');
    const chunks=value.slice(3).split('.').filter(Boolean);
    if(chunks.length<3||chunks.length>500)throw new Error('Snapshot público incompleto.');
    const scale=1e6;let x=0,y=0;
    const ring=chunks.map((chunk,index)=>{
      const pair=chunk.split('~');if(pair.length!==2)throw new Error('Snapshot público inválido.');
      const a=parseBase36Int(pair[0]),b=parseBase36Int(pair[1]);
      if(index===0){x=a;y=b}else{x+=a;y+=b}
      const lng=x/scale,lat=y/scale;
      if(!Number.isFinite(lng)||!Number.isFinite(lat)||lng<-180||lng>180||lat<-90||lat>90)throw new Error('Coordenada inválida no snapshot público.');
      return[lng,lat];
    });
    ring.push([...ring[0]]);
    return{type:'Feature',properties:{name:hashParams.get('name')||queryParams.get('name')||'Perímetro do imóvel',category:'perimetro'},geometry:{type:'Polygon',coordinates:[ring]}};
  }
  function renderFeatures(features,meta={}){
    $('publicTitle').textContent=meta.title||'Imóvel compartilhado';
    $('publicLocation').textContent=meta.location||'Localização não informada';
    $('publicFeatureCount').textContent=features.length;
    features.forEach((feature,index)=>{const category=feature.properties?.category||'outros';const layer=L.geoJSON(feature,{style:()=>style(category),pointToLayer:(_f,ll)=>L.circleMarker(ll,{...style(category),radius:7})});layer.on('click',()=>details(feature));layer.addTo(group);layerEntries.push({layer,feature,index});});
    $('publicLayers').innerHTML=layerEntries.map(({feature},i)=>`<label class="public-layer-item"><input type="checkbox" data-index="${i}" checked><i style="background:${colors[feature.properties?.category]||colors.outros}"></i><span>${escape(feature.properties?.name||labels[feature.properties?.category]||'Feição')}</span></label>`).join('');
    const perimeter=globalThis.SurveyorProjectGeometry?.resolvePerimeter?.({geojson:{type:'FeatureCollection',features}})||features.filter(f=>/Polygon/.test(f?.geometry?.type||'')).sort((a,b)=>(globalThis.turf?.area?.(b)||0)-(globalThis.turf?.area?.(a)||0))[0];
    if(perimeter)$('publicArea').textContent=`${(turf.area(perimeter)/10000).toLocaleString('pt-BR',{minimumFractionDigits:4,maximumFractionDigits:4})} ha`;
    if(group.getBounds().isValid())map.fitBounds(group.getBounds().pad(.1));
  }

  function style(category){const c=colors[category]||colors.outros;return{color:c,fillColor:c,weight:category==='perimetro'?4:3,fillOpacity:category==='perimetro'?.16:.34,opacity:.95}}
  function details(feature){const p=feature.properties||{};let area='—',length='—';try{if(/Polygon/.test(feature.geometry?.type))area=`${(turf.area(feature)/10000).toLocaleString('pt-BR',{minimumFractionDigits:4,maximumFractionDigits:4})} ha`;if(/LineString/.test(feature.geometry?.type))length=`${(turf.length(feature,{units:'kilometers'})*1000).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})} m`}catch{}$('publicDetails').innerHTML=`<b>${escape(p.name||'Feição')}</b><br>Categoria: ${escape(labels[p.category]||p.category||'Outros')}<br>Área: ${area}<br>Comprimento: ${length}`}
  async function load(password=''){
    if(locationCode){
      try{
        const {lat,lng}=decodePublicLocationCode(locationCode);
        const feature={type:'Feature',properties:{name:'Local do imóvel',category:'outros'},geometry:{type:'Point',coordinates:[lng,lat]}};
        renderFeatures([feature],{title:'Local do imóvel',location:`${lat.toFixed(6)}, ${lng.toFixed(6)}`});
        map.setView([lat,lng],18);
        return;
      }catch(error){return showError(error.message||'Localização pública inválida.');}
    }
    if(snapshot){
      try{
        const feature=decodeSnapshot(snapshot);
        const title=hashParams.get('name')||queryParams.get('name')||feature.properties.name||'Imóvel compartilhado';
        const city=hashParams.get('city')||queryParams.get('city')||'';
        const uf=hashParams.get('uf')||queryParams.get('uf')||'';
        renderFeatures([feature],{title,location:[city,uf].filter(Boolean).join('/')||'Localização não informada'});
        return;
      }catch(error){return showError(error.message||'Snapshot público inválido.')}
    }
    if(!token&&!shortCode)return showError('O endereço não contém um código, token ou localização de compartilhamento.');
    if(shortCode&&!/^[0-9A-HJKMNP-TV-Z]{10}$/.test(shortCode))return showError('Código público curto inválido.');
    try{
      const headers=password?{'X-Share-Password':password}:{};
      const endpoint=shortCode?`${base}/api/public/short/${encodeURIComponent(shortCode)}`:`${base}/api/public/projects/${encodeURIComponent(token)}`;
      const response=await fetch(endpoint,{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',headers});
      const data=await response.json().catch(()=>({}));
      if(response.status===403&&(data.details?.passwordRequired||/senha/i.test(data.error||''))){
        const pass=await askSharePassword();
        if(pass)return load(pass);
        throw new Error('A senha é necessária para abrir este projeto.');
      }
      if(!response.ok)throw new Error(data.error||'Projeto não encontrado ou compartilhamento expirado.');
      const p=data.project,c=data.customization||{};
      $('publicTitle').textContent=p.propertyName||p.name;
      $('publicLocation').textContent=[p.municipality,p.stateCode].filter(Boolean).join('/')||'Localização não informada';
      $('publicFeatureCount').textContent=data.features.length;
      if(c.logoDataUrl)$('publicLogo').src=c.logoDataUrl;
      if(c.companyName)$('publicCompany').textContent=c.companyName;
      if(c.addressText)$('publicAddress').textContent=c.addressText;
      const safeWebsite=safeHttpUrl(c.websiteUrl);if(safeWebsite){$('publicWebsite').href=safeWebsite;$('publicWebsite').rel='noopener noreferrer';$('publicWebsite').classList.remove('hidden')}else{$('publicWebsite').removeAttribute('href');$('publicWebsite').classList.add('hidden')}
      $('publicFooter').innerHTML=[c.responsibleTechnician,c.professionalRegistry,c.footerText].filter(Boolean).map(escape).join('<br>');
      const features=data.features.map(f=>({type:'Feature',properties:{...(f.properties||{}),name:f.name,category:f.category,id:f.id},geometry:f.geoJson}));
      renderFeatures(features,{title:p.propertyName||p.name,location:[p.municipality,p.stateCode].filter(Boolean).join('/')||'Localização não informada'});
    }catch(error){showError(error.message)}
  }
  $('publicLayers').addEventListener('change',(event)=>{const input=event.target.closest('input[data-index]');if(!input)return;const entry=layerEntries[Number(input.dataset.index)];if(!entry)return;input.checked?entry.layer.addTo(group):group.removeLayer(entry.layer)});
  $('publicBaseMap').onchange=()=>{Object.values(bases).forEach(layer=>map.removeLayer(layer));bases[$('publicBaseMap').value].addTo(map)};$('fitPublicProject').onclick=()=>{if(group.getBounds().isValid())map.fitBounds(group.getBounds().pad(.1))};load();
})();
