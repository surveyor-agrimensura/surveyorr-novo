(() => {
  'use strict';
  const auth = window.GeoRuralAuth;
  if (!auth?.requireAuth?.()) return;
  const $ = (id) => document.getElementById(id);
  const labels = { perimetro:'Perímetro do imóvel', reserva:'Reserva Legal', app:'APP', produtiva:'Área produtiva', vegetacao:'Vegetação nativa', consolidada:'Área consolidada', estrada:'Estrada/servidão', agua:'Nascente/curso d’água', arco:'Arco/curva técnica', circulo:'Círculo técnico', benfeitoria:'Benfeitoria', gleba:'Gleba / herança', outros:'Outros' };
  let currentProject = null;
  let currentFeatures = [];
  let intersections = [];
  let reportHtml = '';
  let carReadonlyMap = null;
  let carReadonlyLayers = new Map();

  function toast(message, type = '') { const el=$('suiteToast'); el.textContent=message; el.className=`toast show ${type}`; clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.className='toast',3200); }
  const escape = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = (v,d=2) => Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
  const slug = (v) => String(v||'projeto-car').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase();
  function ownerRow(value={}) { const row=document.createElement('div'); row.className='car-owner-row'; row.innerHTML=`<button type="button" class="btn danger" title="Limpar dados deste proprietário" aria-label="Limpar dados deste proprietário">×</button><input class="owner-name" placeholder="Nome completo" value="${escape(value.name||'')}"><input class="owner-doc" placeholder="CPF/CNPJ" value="${escape(value.document||'')}"><input class="owner-role" placeholder="Qualificação/participação" value="${escape(value.role||'Proprietário(a)')}">`; row.querySelector('button').onclick=()=>{ row.querySelectorAll('input').forEach((input)=>{input.value=input.classList.contains('owner-role')?'Proprietário(a)':'';}); toast('Dados do proprietário limpos. Clique em “Salvar proprietário” para confirmar.','success'); }; $('carOwners').appendChild(row); }
  function owners() { return [...document.querySelectorAll('.car-owner-row')].map((row)=>({name:row.querySelector('.owner-name').value.trim(),document:row.querySelector('.owner-doc').value.trim(),role:row.querySelector('.owner-role').value.trim()})).filter((o)=>o.name); }
  function formMetadata() { return { module:'car', car:{ registrant:{name:$('registrantName').value.trim(),document:$('registrantDocument').value.trim(),email:$('registrantEmail').value.trim()}, owners:owners(), property:{name:$('carPropertyName').value.trim(),registration:$('carRegistration').value.trim(),municipality:$('carMunicipality').value.trim(),stateCode:$('carState').value,zone:$('carZone').value}, municipalityIntersections:intersections, updatedAt:new Date().toISOString(), version:20 } }; }
  function payload() { const meta=formMetadata(); return { name:$('carProjectName').value.trim()||$('carPropertyName').value.trim()||'Projeto CAR', propertyName:$('carPropertyName').value.trim()||null, ownerName:owners().map((o)=>o.name).join('; ')||null, registrationNumber:$('carRegistration').value.trim()||null, municipality:$('carMunicipality').value.trim()||null, stateCode:$('carState').value, status:'active', description:'Projeto do módulo Cadastro Ambiental Rural do GeoRural Pro.', centerLatitude:currentProject?.centerLatitude??null, centerLongitude:currentProject?.centerLongitude??null, defaultZoom:currentProject?.defaultZoom??14, metadata:{...(currentProject?.metadata||{}),...meta} }; }
  function fill(project) { currentProject=project; const car=project?.metadata?.car||{}; const property=car.property||{}; $('carProjectName').value=project?.name||''; $('carPropertyName').value=project?.propertyName||property.name||''; $('carRegistration').value=project?.registrationNumber||property.registration||''; $('carMunicipality').value=project?.municipality||property.municipality||''; $('carState').value=project?.stateCode||property.stateCode||'BA'; $('carZone').value=property.zone||'rural'; $('registrantName').value=car.registrant?.name||''; $('registrantDocument').value=car.registrant?.document||''; $('registrantEmail').value=car.registrant?.email||''; intersections=car.municipalityIntersections||[]; $('carOwners').innerHTML=''; (car.owners?.length?car.owners:[{name:project?.ownerName||'',role:'Proprietário(a)'}]).forEach(ownerRow); updateLinks(); }
  function clear() { if ($('carMapViewerDialog')?.open) closeReadonlyMap(); currentProject=null; currentFeatures=[]; intersections=[]; fill({metadata:{car:{owners:[{}]}}}); $('carProjectSelect').value=''; $('carFeatureBody').innerHTML=''; $('carSaveState').textContent='Novo projeto ainda não salvo.'; renderFeatures(); reportHtml=''; $('carReportPreview').innerHTML='<p>Gere o relatório para visualizar.</p>'; $('carPublicUrl').value=''; const canvas=$('carQrCanvas'); canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height); }
  function updateLinks() { const id=currentProject?.id; $('openCarCroqui').href=id?`/mapas/?project=${encodeURIComponent(id)}`:'/mapas/'; }
  function featureToGeoJSON(f) { return {type:'Feature',properties:{...(f.properties||{}),name:f.name,category:f.category},geometry:f.geoJson}; }
  function featurePayload(f,index) { const feat=f.type==='Feature'?f:featureToGeoJSON(f); let areaHectares=null, perimeterMeters=null, vertexCount=0; try{ if(/Polygon/.test(feat.geometry.type)) areaHectares=turf.area(feat)/10000; if(feat.geometry.type==='Polygon'){ const ring=feat.geometry.coordinates?.[0]||[]; vertexCount=ring.length; perimeterMeters=turf.length(turf.lineString(ring),{units:'kilometers'})*1000; } else if(feat.geometry.type==='LineString'){ vertexCount=feat.geometry.coordinates?.length||0; perimeterMeters=turf.length(feat,{units:'kilometers'})*1000; } else if(feat.geometry.type==='Point') vertexCount=1; }catch{} return {name:feat.properties?.name||`Feição ${index+1}`,category:feat.properties?.category||'outros',geometryType:feat.geometry.type,geoJson:feat.geometry,areaHectares,perimeterMeters,vertexCount,style:feat.properties?.style||{},properties:feat.properties||{},sortOrder:index,isVisible:true}; }
  function perimeterFeature() { return currentFeatures.find((f)=>f.category==='perimetro'&&/Polygon/.test(f.geometryType))||currentFeatures.find((f)=>/Polygon/.test(f.geometryType)); }
  function renderFeatures() { const body=$('carFeatureBody'); if(!currentFeatures.length){body.innerHTML='<tr><td colspan="6">Nenhuma feição salva.</td></tr>'; $('carFeatureValidation').textContent=currentProject?'Este projeto ainda não possui feições cadastradas.':'Selecione um projeto para visualizar as feições.'; if ($('carMapViewerDialog')?.open) renderReadonlyMap(); return;} body.innerHTML=currentFeatures.map((f,i)=>`<tr><td>${i+1}</td><td>${escape(f.name)}</td><td>${escape(labels[f.category]||f.category)}</td><td>${escape(f.geometryType)}</td><td>${f.areaHectares==null?'—':num(f.areaHectares,4)}</td><td><button class="link-btn car-view-feature" type="button" data-feature-index="${i}">Ver</button></td></tr>`).join(''); const first=currentFeatures[0]; const valid=first?.category==='perimetro'&&/Polygon/.test(first.geometryType); $('carFeatureValidation').innerHTML=valid?'<b>✓ Feições prontas para conferência.</b> A primeira feição é o perímetro total.':'<b>⚠ Atenção:</b> a primeira feição deve ser um polígono da categoria “Perímetro do imóvel”.'; if ($('carMapViewerDialog')?.open) renderReadonlyMap(); }
  const readonlyColors = { perimetro:'#2563eb', reserva:'#15803d', app:'#ef4444', produtiva:'#f59e0b', vegetacao:'#22c55e', consolidada:'#a855f7', estrada:'#f97316', agua:'#38bdf8', arco:'#0ea5e9', circulo:'#8b5cf6', benfeitoria:'#eab308', gleba:'#2563eb', outros:'#94a3b8' };
  const readonlyBaseLabels = { satellite:'Satélite', map:'Mapa' };
  let carReadonlyBaseLayers = null;
  let carReadonlyActiveBase = 'satellite';

  function parseReadonlyJson(value) {
    if (value == null || value === '') return null;
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return null; }
  }

  function readonlyProperties(f) {
    const properties = parseReadonlyJson(f?.properties) || {};
    return properties && typeof properties === 'object' && !Array.isArray(properties) ? properties : {};
  }

  function normalizeReadonlyFeature(f) {
    const properties = readonlyProperties(f);
    let raw = parseReadonlyJson(f?.geoJson ?? f?.geojson ?? f?.geometry ?? f?.feature);
    if (!raw || typeof raw !== 'object') return null;
    const mergedProperties = {
      ...(raw.type === 'Feature' && raw.properties && typeof raw.properties === 'object' ? raw.properties : {}),
      ...properties,
      name: f?.name || properties.name || raw?.properties?.name || 'Feição',
      category: f?.category || properties.category || raw?.properties?.category || 'outros'
    };
    if (raw.type === 'FeatureCollection') {
      return {
        ...raw,
        features: (raw.features || []).map((feature) => ({
          ...feature,
          properties: { ...(feature?.properties || {}), ...mergedProperties }
        })).filter((feature) => feature?.geometry)
      };
    }
    if (raw.type === 'Feature') return { ...raw, properties: mergedProperties };
    if (raw.type && (raw.coordinates || raw.geometries)) return { type:'Feature', properties:mergedProperties, geometry:raw };
    if (raw.geometry) return { type:'Feature', properties:mergedProperties, geometry:raw.geometry };
    return null;
  }

  function readonlyGeometryType(f, feature = null) {
    const normalized = feature || normalizeReadonlyFeature(f);
    if (normalized?.type === 'FeatureCollection') return normalized.features?.[0]?.geometry?.type || f?.geometryType || '';
    return normalized?.geometry?.type || f?.geometryType || '';
  }

  function readonlySavedStyle(f, feature = null) {
    const properties = readonlyProperties(f);
    const propertyStyle = parseReadonlyJson(properties.style) || {};
    const savedStyle = parseReadonlyJson(f?.style) || {};
    const category = f?.category || properties.category || feature?.properties?.category || 'outros';
    const fallback = readonlyColors[category] || readonlyColors.outros;
    const color = properties.styleColor || properties.strokeColor || properties.color || propertyStyle.color || savedStyle.color || fallback;
    const fillColor = properties.fillColor || properties.fillStyleColor || propertyStyle.fillColor || savedStyle.fillColor || color;
    const opacityValue = properties.strokeOpacity ?? propertyStyle.opacity ?? savedStyle.opacity ?? .98;
    const fillOpacityValue = properties.styleOpacity ?? properties.fillOpacity ?? propertyStyle.fillOpacity ?? savedStyle.fillOpacity;
    const weightValue = properties.weight ?? propertyStyle.weight ?? savedStyle.weight ?? (category === 'perimetro' ? 3.2 : 2.4);
    const geometryType = readonlyGeometryType(f, feature);
    return {
      color,
      fillColor,
      opacity:Math.max(.15,Math.min(1,Number(opacityValue) || .98)),
      fillOpacity:/Polygon/i.test(geometryType) ? Math.max(.04,Math.min(1,Number(fillOpacityValue ?? .24))) : 0,
      weight:Math.max(1.5,Math.min(10,Number(weightValue) || 2.6)),
      dashArray:properties.dashArray || propertyStyle.dashArray || savedStyle.dashArray || null,
      lineCap:'round',
      lineJoin:'round',
      interactive:true
    };
  }


  function setReadonlyBase(mode) {
    if (!carReadonlyMap || !carReadonlyBaseLayers) return;
    const next = carReadonlyBaseLayers[mode] ? mode : 'satellite';
    Object.values(carReadonlyBaseLayers).forEach((layer) => {
      if (carReadonlyMap.hasLayer(layer)) carReadonlyMap.removeLayer(layer);
    });
    carReadonlyBaseLayers[next].addTo(carReadonlyMap);
    carReadonlyActiveBase = next;
    document.querySelectorAll('[data-car-basemap]').forEach((button) => {
      const active = button.dataset.carBasemap === next;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    $('carMapBaseStatus').textContent = readonlyBaseLabels[next];
    renderReadonlyDrawingOverlay();
  }

  function ensureReadonlyMap() {
    if (carReadonlyMap || !window.L) return carReadonlyMap;
    carReadonlyMap = L.map('carReadonlyMap', { zoomControl:true, attributionControl:true, minZoom:3 });
    carReadonlyBaseLayers = {
      map:L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:20, attribution:'&copy; OpenStreetMap' }),
      satellite:L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom:22, attribution:'&copy; Google' })
    };
    carReadonlyMap.on('move zoom resize moveend zoomend', renderReadonlyDrawingOverlay);
    setReadonlyBase(carReadonlyActiveBase);
    return carReadonlyMap;
  }

  function safeReadonlyColor(value, fallback='#2563eb') {
    const color=String(value||'').trim();
    return /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|[a-z]{3,24})$/i.test(color) ? color : fallback;
  }

  function safeReadonlyDash(value) {
    const dash=String(value||'').trim();
    return /^[\d\s.,-]+$/.test(dash) ? dash : '';
  }

  function projectReadonlyCoordinate(coordinate) {
    const lon=Number(coordinate?.[0]);
    const lat=Number(coordinate?.[1]);
    if(!Number.isFinite(lon)||!Number.isFinite(lat)||!carReadonlyMap)return null;
    const point=carReadonlyMap.latLngToContainerPoint([lat,lon]);
    return Number.isFinite(point.x)&&Number.isFinite(point.y)?point:null;
  }

  function readonlyLinePath(coordinates, close=false) {
    const points=(coordinates||[]).map(projectReadonlyCoordinate).filter(Boolean);
    if(!points.length)return '';
    const path=`M${points.map((point)=>`${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' L')}`;
    return close?`${path} Z`:path;
  }

  function readonlyGeometryMarkup(geometry, style, featureIndex) {
    if(!geometry||typeof geometry!=='object')return '';
    const color=safeReadonlyColor(style.color,readonlyColors.outros);
    const fillColor=safeReadonlyColor(style.fillColor,color);
    const opacity=Math.max(.15,Math.min(1,Number(style.opacity)||.98));
    const fillOpacity=Math.max(0,Math.min(1,Number(style.fillOpacity)||0));
    const weight=Math.max(1.5,Math.min(10,Number(style.weight)||2.6));
    const dash=safeReadonlyDash(style.dashArray);
    const common=`data-car-overlay-feature="${featureIndex}" vector-effect="non-scaling-stroke" stroke="${escape(color)}" stroke-width="${weight}" stroke-opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round"${dash?` stroke-dasharray="${escape(dash)}"`:''}`;
    const path=(d,filled=false)=>d?`<path class="car-readonly-feature-shape" ${common} d="${d}" fill="${filled?escape(fillColor):'none'}" fill-opacity="${filled?fillOpacity:0}" fill-rule="evenodd"></path>`:'';
    switch(geometry.type){
      case 'Polygon': return path((geometry.coordinates||[]).map((ring)=>readonlyLinePath(ring,true)).filter(Boolean).join(' '),true);
      case 'MultiPolygon': return (geometry.coordinates||[]).map((polygon)=>path((polygon||[]).map((ring)=>readonlyLinePath(ring,true)).filter(Boolean).join(' '),true)).join('');
      case 'LineString': return path(readonlyLinePath(geometry.coordinates||[]),false);
      case 'MultiLineString': return (geometry.coordinates||[]).map((line)=>path(readonlyLinePath(line),false)).join('');
      case 'Point': {
        const point=projectReadonlyCoordinate(geometry.coordinates);
        return point?`<circle class="car-readonly-feature-shape" ${common} cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="6" fill="${escape(fillColor)}" fill-opacity=".92"></circle>`:'';
      }
      case 'MultiPoint': return (geometry.coordinates||[]).map((coordinate)=>readonlyGeometryMarkup({type:'Point',coordinates:coordinate},style,featureIndex)).join('');
      case 'GeometryCollection': return (geometry.geometries||[]).map((item)=>readonlyGeometryMarkup(item,style,featureIndex)).join('');
      default:return '';
    }
  }

  function readonlyFeatureMarkup(feature, style, featureIndex) {
    if(feature?.type==='FeatureCollection') return (feature.features||[]).map((item)=>readonlyGeometryMarkup(item?.geometry,style,featureIndex)).join('');
    if(feature?.type==='Feature') return readonlyGeometryMarkup(feature.geometry,style,featureIndex);
    return readonlyGeometryMarkup(feature,style,featureIndex);
  }

  function renderReadonlyDrawingOverlay() {
    const overlay=$('carReadonlyDrawingOverlay');
    if(!overlay||!carReadonlyMap)return;
    const size=carReadonlyMap.getSize();
    overlay.setAttribute('viewBox',`0 0 ${Math.max(1,size.x)} ${Math.max(1,size.y)}`);
    overlay.setAttribute('width',String(Math.max(1,size.x)));
    overlay.setAttribute('height',String(Math.max(1,size.y)));
    overlay.innerHTML=[...carReadonlyLayers.entries()].map(([index,entry])=>entry.visible===false?'':readonlyFeatureMarkup(entry.feature,entry.style,index)).join('');
  }

  function visibleReadonlyBounds() {
    const visible=[];
    carReadonlyLayers.forEach((entry) => {
      if(entry.visible===false)return;
      const bounds=entry.boundsLayer?.getBounds?.();
      if(bounds?.isValid?.())visible.push(bounds);
      else if(entry.boundsLayer?.getLatLng){const point=entry.boundsLayer.getLatLng();visible.push(L.latLngBounds(point,point));}
    });
    if(!visible.length)return null;
    const merged=L.latLngBounds(visible[0].getSouthWest(),visible[0].getNorthEast());
    visible.slice(1).forEach((bounds)=>merged.extend(bounds));
    return merged;
  }

  function fitReadonlyMap() {
    const bounds=visibleReadonlyBounds();
    if(bounds?.isValid?.()) carReadonlyMap.fitBounds(bounds.pad(.12),{maxZoom:18});
    else if(Number.isFinite(Number(currentProject?.centerLatitude))&&Number.isFinite(Number(currentProject?.centerLongitude))) carReadonlyMap.setView([Number(currentProject.centerLatitude),Number(currentProject.centerLongitude)],Number(currentProject.defaultZoom)||14);
    else carReadonlyMap.setView([-12.7,-41.7],6);
    requestAnimationFrame(renderReadonlyDrawingOverlay);
  }

  function focusReadonlyFeature(index) {
    const entry=carReadonlyLayers.get(Number(index));
    if(!entry||!carReadonlyMap)return;
    entry.visible=true;
    const checkbox=$('carMapLayerList')?.querySelector(`input[data-feature-index="${index}"]`); if(checkbox)checkbox.checked=true;
    const bounds=entry.boundsLayer?.getBounds?.();
    if(bounds?.isValid?.())carReadonlyMap.fitBounds(bounds.pad(.18),{maxZoom:19});
    else if(entry.boundsLayer?.getLatLng)carReadonlyMap.setView(entry.boundsLayer.getLatLng(),18);
    requestAnimation(renderReadonlyDrawingOverlay);
  }

  function renderReadonlyLayerList() {
    const list=$('carMapLayerList');
    if(!currentFeatures.length){list.innerHTML='<div class="car-map-layer-empty">Nenhuma feição cadastrada.</div>';return;}
    list.innerHTML=currentFeatures.map((f,index)=>{
      const feature=normalizeReadonlyFeature(f);
      const style=readonlySavedStyle(f,feature);
      const available=Boolean(feature);
      const checked=f?.isVisible !== false && available;
      return `<div class="car-map-layer-row${available?'':' invalid'}"><label><input type="checkbox" data-feature-index="${index}" ${checked?'checked':''} ${available?'':'disabled'}><i class="car-map-style-swatch" style="--car-feature-color:${escape(style.color)}"></i><span><b>${escape(f.name||`Feição ${index+1}`)}</b><small>${escape(labels[f.category]||f.category||'Outros')}${f.areaHectares==null?'':` • ${num(f.areaHectares,4)} ha`}${available?'':' • geometria inválida'}</small></span></label><button type="button" data-focus-feature="${index}" ${available?'':'disabled'}>Ver</button></div>`;
    }).join('');
  }

  function renderReadonlyMap(focusIndex=null) {
    const map=ensureReadonlyMap(); if(!map)return;
    carReadonlyLayers.clear();
    $('carMapViewerTitle').textContent=currentProject?.propertyName||currentProject?.name||'Feições do imóvel';
    renderReadonlyLayerList();
    let validCount=0;
    currentFeatures.forEach((f,index)=>{
      const feature=normalizeReadonlyFeature(f);
      if(!feature)return;
      try{
        const style=readonlySavedStyle(f,feature);
        const boundsLayer=L.geoJSON(feature,{interactive:false});
        carReadonlyLayers.set(index,{feature,style,boundsLayer,visible:f?.isVisible!==false});
        validCount+=1;
      }catch(error){console.warn('Feição não pôde ser preparada no visualizador:',error)}
    });
    $('carMapEmpty').classList.toggle('hidden',validCount>0);
    $('carMapEmpty').textContent=currentFeatures.length?'As geometrias deste projeto não puderam ser exibidas.':'Este projeto ainda não possui feições cadastradas.';
    requestAnimationFrame(()=>{
      map.invalidateSize();
      setReadonlyBase(carReadonlyActiveBase);
      if(focusIndex!=null)focusReadonlyFeature(focusIndex); else fitReadonlyMap();
      renderReadonlyDrawingOverlay();
    });
  }

  function openReadonlyMap(focusIndex=null) {
    if(!currentProject)return toast('Selecione ou salve um projeto antes de abrir o mapa.','error');
    const dialog=$('carMapViewerDialog');
    if(!dialog.open)dialog.showModal();
    renderReadonlyMap(focusIndex);
  }
  function closeReadonlyMap(){ $('carMapViewerDialog')?.close(); }


  async function renderShareQr(url) {
    const canvas=$('carQrCanvas'),ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(!url)return;
    const qrLib=window.GeoRuralQR||window.QRCode;
    if(!qrLib?.toCanvas)throw new Error('Módulo local de QR Code não foi carregado.');
    await qrLib.toCanvas(canvas,url,{width:220,margin:1,errorCorrectionLevel:'M'});
  }
  async function loadProjectShare() {
    $('carPublicUrl').value='';
    await renderShareQr('');
    if(!currentProject?.id)return;
    try{
      const share=await auth.getProjectShare(currentProject.id).catch(()=>null);
      if(!share?.active||!share?.token)return;
      const url=new URL(`/public-project/#token=${encodeURIComponent(share.token)}`,location.href).href;
      $('carPublicUrl').value=url;
      await renderShareQr(url);
    }catch(error){console.warn('Compartilhamento existente não pôde ser carregado:',error)}
  }
  async function loadProjects(selectId=null) { const projects=await auth.listProjects(); const select=$('carProjectSelect'); const current=selectId||select.value; [...select.options].slice(1).forEach((o)=>o.remove()); const ordered=[...projects].sort((a,b)=>{ const aScore=(a.metadata?.module==='car'?2:0)+(a.featureCount?1:0); const bScore=(b.metadata?.module==='car'?2:0)+(b.featureCount?1:0); return bScore-aScore || String(a.propertyName||a.name||'').localeCompare(String(b.propertyName||b.name||'')); }); ordered.forEach((p)=>{ const suffix=p.metadata?.module==='car'?' • CAR':' • MAPA'; const label=`${p.propertyName||p.name}${p.municipality?` — ${p.municipality}/${p.stateCode||''}`:''}${suffix}`; select.add(new Option(label,p.id)); }); if(current&&[...select.options].some((o)=>o.value===current)){ select.value=current; await openProject(current); } }
  async function openProject(id) { if(!id) return clear(); $('carSaveState').textContent='Carregando projeto...'; const data=await auth.getProject(id); fill(data.project); currentFeatures=data.features||[]; renderFeatures(); await loadProjectShare(); $('carSaveState').textContent=`Salvo na nuvem • atualizado em ${new Date(data.project.updatedAt).toLocaleString('pt-BR')}`; }
  async function saveProject() { const p=payload(); if(!p.name.trim()) { toast('Informe o nome do projeto ou do imóvel.','error'); return false; } if(!p.propertyName) { toast('Informe o nome do imóvel.','error'); return false; } const button=$('saveCarProject'); button.disabled=true; try{ currentProject=currentProject?.id?await auth.updateProject(currentProject.id,{...p,expectedUpdatedAt:currentProject.revision||currentProject.updatedAt||''}):await auth.createProject(p); await loadProjects(currentProject.id); toast('Projeto CAR salvo no Appwrite.','success'); return true; }catch(error){console.error(error);toast(error.message||'Falha ao salvar o projeto.','error');return false;}finally{button.disabled=false} }
  async function persistMetadata() { if(!currentProject) return; currentProject=await auth.updateProject(currentProject.id,{...payload(),expectedUpdatedAt:currentProject.revision||currentProject.updatedAt||''}); }
  function validateProject() {
    const issues=[];
    const p=payload();
    if(!currentProject) issues.push('Selecione ou salve um projeto antes de validar.');
    if(!p.propertyName) issues.push('Nome do imóvel não informado.');
    if(!p.municipality||!p.stateCode) issues.push('Município/UF incompletos.');
    if(!owners().length) issues.push('Nenhum proprietário/possuidor cadastrado.');
    if(!$('registrantName').value.trim()) issues.push('Cadastrante não informado.');
    if(!currentFeatures.length) issues.push('Nenhuma feição cadastrada.');
    const first=currentFeatures[0];
    if(!first||first.category!=='perimetro'||!/Polygon/.test(first.geometryType)) issues.push('A primeira feição não é o perímetro total.');
    currentFeatures.forEach((f,i)=>{if(!f.geoJson) issues.push(`Feição ${i+1} sem geometria.`)});
    const per=perimeterFeature();
    if(per){ try{ const feature=featureToGeoJSON(per); const kinks=turf.kinks(feature); if(kinks.features.length) issues.push(`O perímetro possui ${kinks.features.length} auto-interseção(ões).`); }catch{} }
    const result=$('carValidationResult');
    if(result) result.innerHTML=issues.length
      ? `<div class="car-validation-summary warning"><b>${issues.length} pendência(s) encontrada(s)</b><p>Revise os itens abaixo antes de concluir o projeto.</p></div><ul>${issues.map((x)=>`<li>${escape(x)}</li>`).join('')}</ul>`
      : '<div class="car-validation-summary success"><b>✓ Validação preliminar concluída</b><p>Nenhuma pendência básica foi encontrada.</p></div>';
    $('carValidationDialog')?.showModal();
    return issues;
  }
  function areaTotals() {
    const totals = {};
    currentFeatures.forEach((f) => {
      if (f.areaHectares != null) totals[f.category] = (totals[f.category] || 0) + Number(f.areaHectares);
    });
    return totals;
  }
  function utmZone() {
    const per = perimeterFeature();
    if (!per) return '—';
    try {
      const c = turf.centroid(featureToGeoJSON(per)).geometry.coordinates;
      return `${Math.floor((c[0] + 180) / 6) + 1}${c[1] < 0 ? 'S' : 'N'}`;
    } catch { return '—'; }
  }
  function carReportOptions() {
    const custom = window.GeoRuralDocumentTheme?.get?.() || {};
    const opts = custom.options?.carReport || custom.options?.car || {};
    return {
      showSummaryCards: opts.showSummaryCards !== false,
      showFeatureTable: opts.showFeatureTable !== false,
      showTechnicalNotice: opts.showTechnicalNotice === true,
      showPublicQr: opts.showPublicQr !== false,
      showRegistrant: opts.showRegistrant !== false,
      showOwnerDocuments: opts.showOwnerDocuments === true,
      title: opts.title || 'RELATÓRIO PRELIMINAR - CADASTRO AMBIENTAL RURAL',
      subtitle: opts.subtitle || ''
    };
  }
  function pct(value, total) {
    const n = Number(value || 0), base = Number(total || 0);
    if (!base || !Number.isFinite(n)) return '—';
    return `${num((n / base) * 100, 2)}%`;
  }
  function reportLabel(category) { return labels[category] || category || 'Sem categoria'; }
  function reportTag(category) {
    return String(category || 'outros').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  }
  function professionalReportHtml(content, title) {
    const wrapped = window.GeoRuralDocumentTheme?.wrapHtml?.(content, title);
    if (wrapped) return wrapped.replace('</head>', `<style>${carReportCss()}</style></head>`);
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>${carReportCss()}</style></head><body>${content}</body></html>`;
  }
  function carReportCss() {
    const paper = (window.SurveyorPaperFormat?.get?.() || 'a4').toLowerCase() === 'a3' ? 'A3' : 'A4';
    const documentWidth = paper === 'A3' ? '270mm' : '190mm';
    return `
      @page{size:${paper};margin:14mm 13mm 16mm}
      *{box-sizing:border-box}
      body{background:#fff;color:#111827;font-family:Arial,Helvetica,sans-serif;line-height:1.36;font-size:10.5pt}
      .car-report-document{max-width:${documentWidth};margin:0 auto;background:#fff;color:#111827;border:0;border-radius:0;box-shadow:none;padding:0}
      .car-report-hero{padding:0 0 10px;margin:0 0 10px;border-bottom:2px solid #111827;color:#111827;background:#fff;position:relative;overflow:visible}
      .car-report-hero h1{font-size:19pt;line-height:1.12;margin:0;color:#111827;text-transform:uppercase;letter-spacing:.02em;font-weight:800;max-width:none;overflow:visible;white-space:normal}
      .car-report-hero p{margin:6px 0 0;color:#334155;font-size:9.5pt;max-width:none}
      .car-report-meta{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin:0 0 12px;padding:0;background:#fff;border:1px solid #111827;border-bottom:0}
      .car-report-meta div{background:#fff;border:0;border-right:1px solid #111827;border-bottom:1px solid #111827;border-radius:0;padding:7px 9px;min-height:44px}
      .car-report-meta div:nth-child(4n){border-right:0}
      .car-report-meta small{display:block;font-size:7.5pt;text-transform:uppercase;letter-spacing:.05em;color:#475569;font-weight:800;margin-bottom:3px}
      .car-report-meta b{display:block;font-size:9.3pt;color:#111827;word-break:break-word;font-weight:700}
      .car-report-section{padding:0;margin:12px 0 14px;border:0;page-break-inside:avoid}
      .car-report-section h2{margin:0 0 7px;color:#111827;font-size:12.5pt;text-transform:uppercase;letter-spacing:.02em;border-bottom:1px solid #94a3b8;padding-bottom:4px;display:block}
      .car-report-section h2:before{display:none}
      .car-report-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0;border:1px solid #cbd5e1;border-bottom:0;border-right:0}
      .car-info-card{border:0;border-right:1px solid #cbd5e1;border-bottom:1px solid #cbd5e1;border-radius:0;padding:8px 10px;background:#fff;min-height:48px}
      .car-info-card small{display:block;color:#475569;font-size:7.8pt;text-transform:uppercase;letter-spacing:.04em;font-weight:800;margin-bottom:3px}
      .car-info-card b,.car-info-card span{display:block;color:#111827;font-size:9.3pt;word-break:break-word}
      .car-summary-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;margin:0 0 10px;border:1px solid #cbd5e1;border-right:0}
      .car-summary-card{border:0;border-right:1px solid #cbd5e1;border-radius:0;padding:8px 10px;background:#fff;min-height:50px}
      .car-summary-card small{display:block;color:#475569;font-size:7.8pt;text-transform:uppercase;font-weight:800;margin-bottom:3px}.car-summary-card b{font-size:12.5pt;color:#111827}
      .car-report-table{width:100%;border-collapse:collapse;font-size:9.2pt;border:1px solid #94a3b8;background:#fff}
      .car-report-table th{background:#eef2f7;color:#111827;text-align:left;text-transform:uppercase;font-size:7.8pt;letter-spacing:.04em;padding:7px 8px;border:1px solid #94a3b8;font-weight:800}
      .car-report-table td{padding:7px 8px;border:1px solid #cbd5e1;vertical-align:top}
      .car-category-pill{display:inline;font-size:9pt;font-weight:700;background:transparent!important;color:#111827!important;white-space:normal;border-radius:0;padding:0}
      .car-report-qr{display:grid;grid-template-columns:110px 1fr;gap:14px;align-items:center;border:1px solid #94a3b8;background:#fff;border-radius:0;padding:10px;page-break-inside:avoid}
      .car-report-qr img{width:100px;height:100px;border-radius:0;background:#fff;border:1px solid #cbd5e1;padding:4px}
      .car-report-qr h3{margin:0 0 5px;color:#111827;text-transform:uppercase;font-size:11.5pt}.car-report-qr p{margin:0 0 5px}.car-report-url{font-size:8pt;word-break:break-all;color:#334155}
      .car-warning-box{display:none}
      .car-report-footer-note{display:none}
      .car-report-preview-shell{max-height:720px;overflow:auto;border-radius:0;border:1px solid #cbd5e1;background:#fff;padding:12px}
      .car-report-preview-shell .car-report-document{box-shadow:none;border-radius:0}
      @media(max-width:900px){.car-report-meta,.car-summary-cards{grid-template-columns:repeat(2,1fr)}.car-report-grid{grid-template-columns:1fr}.car-report-hero,.car-report-section,.car-report-meta,.car-report-footer-note{padding-left:0;padding-right:0}}
      @media print{body{background:#fff!important;margin:0}.car-report-document{max-width:none;border:0;border-radius:0;box-shadow:none}.car-report-preview-shell{max-height:none;overflow:visible;border:0;padding:0}.car-report-section,.car-report-qr,.car-summary-card{page-break-inside:avoid}.no-print,.btn,.link-btn,.top,.side,.toast,.export-menu{display:none!important}}
    `;
  }
  function buildReport() {
    if (!currentProject) throw new Error('Selecione um projeto.');
    const totals = areaTotals();
    const car = currentProject.metadata?.car || formMetadata().car;
    const opts = carReportOptions();
    const ownersList = (car.owners || owners()).filter((o) => o?.name);
    const publicUrl = $('carPublicUrl').value.trim();
    let qr = '';
    try { if (publicUrl) qr = $('carQrCanvas').toDataURL('image/png'); } catch {}
    const perimeter = totals.perimetro || currentFeatures.find((f) => f.category === 'perimetro')?.areaHectares || 0;
    const generatedAt = new Date().toLocaleString('pt-BR');
    const rows = Object.entries(totals)
      .sort(([a], [b]) => (a === 'perimetro' ? -1 : b === 'perimetro' ? 1 : reportLabel(a).localeCompare(reportLabel(b), 'pt-BR')))
      .map(([category, value]) => `<tr><td><span class="car-category-pill" data-category="${reportTag(category)}">${escape(reportLabel(category))}</span></td><td style="text-align:right"><b>${num(value,4)}</b></td><td style="text-align:right">${pct(value, perimeter)}</td></tr>`).join('');
    const featureRows = currentFeatures.map((f, i) => `<tr><td>${i + 1}</td><td>${escape(f.name || `Feição ${i + 1}`)}</td><td><span class="car-category-pill" data-category="${reportTag(f.category)}">${escape(reportLabel(f.category))}</span></td><td>${escape(f.geometryType || '—')}</td><td style="text-align:right">${f.areaHectares != null ? num(f.areaHectares, 4) : '—'}</td></tr>`).join('');
    const ownerText = ownersList.map((o) => opts.showOwnerDocuments && o.document ? `${o.name} (${o.document})` : o.name).join('; ') || 'Não informado';
    const content = `<article class="car-report-document">
      <section class="car-report-hero">
        <h1>${escape(opts.title)}</h1>
        ${opts.subtitle ? `<p>${escape(opts.subtitle)}</p>` : ''}
      </section>
      <section class="car-report-meta">
        <div><small>Projeto</small><b>${escape(currentProject.name || '—')}</b></div>
        <div><small>Imóvel</small><b>${escape(currentProject.propertyName || car.property?.name || '—')}</b></div>
        <div><small>Município/UF</small><b>${escape(currentProject.municipality || '')}/${escape(currentProject.stateCode || '')}</b></div>
        <div><small>Gerado em</small><b>${escape(generatedAt)}</b></div>
      </section>
      <section class="car-report-section">
        <h2>Identificação do cadastro</h2>
        <div class="car-report-grid">
          <div class="car-info-card"><small>Proprietário(s) / possuidor(es)</small><span>${escape(ownerText)}</span></div>
          <div class="car-info-card"><small>Matrícula / registro</small><span>${escape(currentProject.registration || car.property?.registration || 'Não informado')}</span></div>
          <div class="car-info-card"><small>Zona</small><span>${escape(car.property?.zone || $('carZone').value || 'rural')}</span></div>
          <div class="car-info-card"><small>Fuso UTM estimado</small><span>${escape(utmZone())}</span></div>
          <div class="car-info-card"><small>Municípios de intersecção</small><span>${escape(intersections.join(', ') || 'Não calculados')}</span></div>
          ${opts.showRegistrant ? `<div class="car-info-card"><small>Cadastrante</small><span>${escape(car.registrant?.name || 'Não informado')}${car.registrant?.document ? ` - ${escape(car.registrant.document)}` : ''}</span></div>` : ''}
        </div>
      </section>
      <section class="car-report-section">
        <h2>Quadro de áreas</h2>
        ${opts.showSummaryCards ? `<div class="car-summary-cards">
          <div class="car-summary-card"><small>Perímetro total</small><b>${num(totals.perimetro || 0, 4)} ha</b></div>
          <div class="car-summary-card"><small>APP</small><b>${num(totals.app || 0, 4)} ha</b></div>
          <div class="car-summary-card"><small>Reserva Legal</small><b>${num(totals.reserva || 0, 4)} ha</b></div>
          <div class="car-summary-card"><small>Área produtiva</small><b>${num(totals.produtiva || 0, 4)} ha</b></div>
        </div>` : ''}
        <table class="car-report-table"><thead><tr><th>Categoria</th><th style="text-align:right">Área (ha)</th><th style="text-align:right">% do perímetro</th></tr></thead><tbody>${rows || '<tr><td colspan="3">Nenhuma área calculada.</td></tr>'}</tbody></table>
      </section>
      ${opts.showFeatureTable ? `<section class="car-report-section"><h2>Feições cadastradas</h2><table class="car-report-table"><thead><tr><th>Ordem</th><th>Feição</th><th>Categoria</th><th>Geometria</th><th style="text-align:right">Área (ha)</th></tr></thead><tbody>${featureRows || '<tr><td colspan="5">Nenhuma feição cadastrada.</td></tr>'}</tbody></table></section>` : ''}
      ${opts.showPublicQr && publicUrl ? `<section class="car-report-section"><div class="car-report-qr">${qr ? `<img src="${qr}" alt="QR Code do mapa público">` : '<div></div>'}<div><h3>Mapa público e conferência</h3><p>Escaneie o QR Code para abrir a demarcação compartilhada.</p><div class="car-report-url">${escape(publicUrl)}</div></div></div></section>` : ''}

    </article>`;
    reportHtml = professionalReportHtml(content, 'Relatório CAR');
    window.__SurveyorCarReportHtml = reportHtml;
    $('carReportPreview').innerHTML = `<div class="car-report-preview-shell">${content}</div>`;
    return reportHtml;
  }
  function download(name,content,type='text/html;charset=utf-8'){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  async function createShare() { if(!currentProject) return toast('Selecione um projeto.','error'); try{ let share=await auth.getProjectShare(currentProject.id).catch(()=>null); if(!share?.active||!share?.token) share=await auth.createProjectShare(currentProject.id,null); const url=new URL(`/public-project/#token=${encodeURIComponent(share.token)}`,location.href).href; $('carPublicUrl').value=url; await renderShareQr(url); reportHtml=''; toast('Link público e QR Code gerados.','success'); }catch(error){console.error(error);toast(error.message||'Falha ao compartilhar.','error')} }
  async function exportPackage() { if(!currentProject) return toast('Selecione um projeto.','error'); if(!window.JSZip) return toast('Módulo ZIP não carregado.','error'); if(!reportHtml) buildReport(); const zip=new JSZip(); const car=currentProject.metadata?.car||formMetadata().car; zip.file('cadastro.car.json',JSON.stringify({project:currentProject,car,generatedAt:new Date().toISOString()},null,2)); zip.file('geometrias.prc.geojson',JSON.stringify({type:'FeatureCollection',features:currentFeatures.map(featureToGeoJSON)},null,2)); zip.file('relatorio-car.html',reportHtml); zip.file('LEIA-ME.txt','PACOTE TÉCNICO AUXILIAR DO GEORURAL PRO\n\nOs arquivos .car.json e .prc.geojson deste pacote NÃO são formatos proprietários oficiais do SICAR/CEFIR. Eles preservam o cadastro e as geometrias para conferência, intercâmbio e futura conversão por ferramenta compatível.'); const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE'}); const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${slug(currentProject.propertyName||currentProject.name)}-pacote-car.zip`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }

  $('addCarOwner').onclick=async()=>{const saved=await saveProject();if(saved)toast('Proprietário salvo no imóvel.','success');}; $('newCarProject').onclick=clear; $('saveCarProject').onclick=saveProject; $('openCarMap').onclick=()=>openReadonlyMap(); $('closeCarMapViewer').onclick=closeReadonlyMap; $('fitCarMap').onclick=fitReadonlyMap; $('carProjectSelect').onchange=()=>openProject($('carProjectSelect').value).catch((e)=>toast(e.message,'error')); $('validateCarProject').onclick=validateProject; $('closeCarValidation').onclick=()=>$('carValidationDialog')?.close(); $('generateCarReport').onclick=()=>{try{buildReport();toast('Relatório gerado.','success')}catch(e){toast(e.message,'error')}}; $('downloadCarReport').onclick=()=>{try{if(!reportHtml)buildReport();download(`${slug(currentProject.propertyName||currentProject.name)}-relatorio-car.html`,reportHtml)}catch(e){toast(e.message,'error')}}; $('createCarShare').onclick=createShare; $('copyCarPublicUrl').onclick=async()=>{if(!$('carPublicUrl').value)return;await navigator.clipboard.writeText($('carPublicUrl').value);toast('Link copiado.','success')}; $('disableCarShare').onclick=async()=>{if(!currentProject)return;await auth.disableProjectShare(currentProject.id);$('carPublicUrl').value='';await renderShareQr('');reportHtml='';toast('Link público desativado.','success')}; $('exportCarPackage').onclick=()=>exportPackage().catch((e)=>toast(e.message,'error')); $('mobileToggle')?.addEventListener('click',()=>$('side')?.classList.toggle('open'));
  document.querySelectorAll('[data-car-tab]').forEach((button)=>button.addEventListener('click',()=>{document.querySelectorAll('[data-car-tab]').forEach((x)=>x.classList.toggle('active',x===button));document.querySelectorAll('.car-tab-panel').forEach((panel)=>panel.classList.toggle('active',panel.id===`car-${button.dataset.carTab}`))}));
  $('carFeatureBody').addEventListener('click',(event)=>{const button=event.target.closest('[data-feature-index]');if(button)openReadonlyMap(Number(button.dataset.featureIndex));});
  $('carMapLayerList').addEventListener('change',(event)=>{const input=event.target.closest('input[data-feature-index]');if(!input)return;const entry=carReadonlyLayers.get(Number(input.dataset.featureIndex));if(!entry)return;entry.visible=input.checked;renderReadonlyDrawingOverlay();});
  $('carMapLayerList').addEventListener('click',(event)=>{const button=event.target.closest('[data-focus-feature]');if(button)focusReadonlyFeature(Number(button.dataset.focusFeature));});
  document.querySelectorAll('[data-car-basemap]').forEach((button)=>button.addEventListener('click',()=>setReadonlyBase(button.dataset.carBasemap)));
  $('carMapViewerDialog').addEventListener('click',(event)=>{if(event.target===$('carMapViewerDialog'))closeReadonlyMap();});
  const requested=new URLSearchParams(location.search).get('project'); clear(); loadProjects(requested).catch((error)=>toast(error.message||'Não foi possível carregar os projetos CAR.','error'));
})();
