(() => {
  'use strict';
  const ITEMS = [
    {id:'standard', name:'Modelo padrão do sistema', mode:'standard', color:'#145edb'},
    {id:'dourado', name:'Dourado', file:'01_Dourado.docx', preview:'01_Dourado.png', color:'#b8860b', previewPages:2, techOverlayPage:1, layout:'agroExact', headerHeightMm:33.4, footerHeightMm:36.12},
    {id:'ciano', name:'Ciano', file:'02_Ciano.docx', preview:'02_Ciano.png', color:'#009fb7', previewPages:1, techOverlayPage:1, layout:'agroExact', headerHeightMm:34.81, footerHeightMm:36.28},
    {id:'verde', name:'Verde', file:'03_Verde.docx', preview:'03_Verde.png', color:'#188b24', previewPages:1, techOverlayPage:1, layout:'agroExact', headerHeightMm:36.69, footerHeightMm:38.21},
    {id:'amarelo', name:'Amarelo', file:'04_Amarelo.docx', preview:'04_Amarelo.png', color:'#e9b000', previewPages:2, techOverlayPage:1, layout:'agroExact', headerHeightMm:33.87, footerHeightMm:39.67},
    {id:'agro-mais', name:'Agro+', file:'05_AgroMais.docx', preview:'05_AgroMais.png', color:'#8fbf22', previewPages:2, techOverlayPage:1, layout:'agroExact', headerHeightMm:28.66, footerHeightMm:32.87, restricted:true, fixedBranding:true}
  ];
  const byId = (id) => ITEMS.find((item) => item.id === id) || ITEMS[0];
  function allowedTemplateIds(customization={}){
    const raw=customization?.options?.allowedMemorialTemplateIds ?? customization?.allowedMemorialTemplateIds ?? [];
    const list=Array.isArray(raw)?raw:(typeof raw==='string'?raw.split(/[;,\s]+/):[]);
    return [...new Set(list.map((id)=>String(id||'').trim()).filter(Boolean))];
  }
  function canUse(id,customization={}){
    const item=byId(id);
    if(!item?.restricted) return true;
    return allowedTemplateIds(customization).includes(item.id);
  }
  function itemsForCustomization(customization={}){ return ITEMS.filter((item)=>canUse(item.id,customization)); }
  const xmlEscape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const xmlText = (value) => xmlEscape(value).replace(/\r?\n/g,'</w:t><w:br/><w:t xml:space="preserve">');
  const blobDownload = (blob, filename) => { const u=URL.createObjectURL(blob), a=document.createElement('a'); a.href=u; a.download=filename; a.hidden=true; document.body.appendChild(a); try{a.click();}finally{a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);} };
  function galleryHtml(selected='standard', includeStandard=true, customization={}){
    return itemsForCustomization(customization).filter((x)=>includeStandard || x.id!=='standard').map((item)=>`<button type="button" class="memorial-template-card ${selected===item.id?'active':''}" data-memorial-template-id="${item.id}" aria-pressed="${selected===item.id}">${item.preview?`<img src="/assets/memorial-template-previews/${item.preview}?v=1.0.0-rc.185.74" alt="Prévia ${item.name}" loading="lazy">`:`<span class="memorial-standard-preview"><b>MEMORIAL DESCRITIVO</b><small>Modelo branco padrão do Surveyor</small></span>`}<strong>${item.name}</strong><small>${item.id==='standard'?'Modelo simples e oficial':'Template personalizado do sistema'}</small></button>`).join('');
  }
  async function normalizeImageDataUrl(dataUrl){
    const source=String(dataUrl||'');
    if(!/^data:image\/webp;base64,/i.test(source)) return source;
    return await new Promise((resolve,reject)=>{
      const image=new Image();
      image.onload=()=>{ try{ const canvas=document.createElement('canvas'); canvas.width=image.naturalWidth||image.width; canvas.height=image.naturalHeight||image.height; canvas.getContext('2d').drawImage(image,0,0); resolve(canvas.toDataURL('image/png')); }catch(error){reject(error);} };
      image.onerror=()=>reject(new Error('Não foi possível converter o logotipo WEBP para PNG.'));
      image.src=source;
    });
  }
  function dataUrlBytes(dataUrl){
    const match=String(dataUrl||'').match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
    if(!match) return null;
    const raw=atob(match[2]);
    const bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++) bytes[i]=raw.charCodeAt(i);
    return {bytes,ext:/jpe?g/i.test(match[1])?'jpg':'png',contentType:/jpe?g/i.test(match[1])?'image/jpeg':'image/png'};
  }
  function replaceToken(xml,key,value){
    const source=String(xml||'');
    const marker=`{{${key}}}`;
    if(source.includes(marker)) return source.split(marker).join(xmlText(value));
    if(typeof DOMParser==='undefined' || typeof XMLSerializer==='undefined') return source;
    try{
      const documentXml=new DOMParser().parseFromString(source,'application/xml');
      if(documentXml.querySelector('parsererror')) return source;
      const paragraphs=[...documentXml.getElementsByTagNameNS('*','p')];
      let changed=false;
      for(const paragraph of paragraphs){
        const textNodes=[...paragraph.getElementsByTagNameNS('*','t')];
        if(!textNodes.length) continue;
        let full=textNodes.map((node)=>node.textContent||'').join('');
        let markerIndex=full.indexOf(marker);
        while(markerIndex>=0){
          const markerEnd=markerIndex+marker.length;
          let offset=0,startNode=-1,endNode=-1,startOffset=0,endOffset=0;
          for(let index=0;index<textNodes.length;index++){
            const length=(textNodes[index].textContent||'').length;
            if(startNode<0 && markerIndex>=offset && markerIndex<=offset+length){ startNode=index; startOffset=markerIndex-offset; }
            if(markerEnd>=offset && markerEnd<=offset+length){ endNode=index; endOffset=markerEnd-offset; break; }
            offset+=length;
          }
          if(startNode<0 || endNode<0) break;
          const cleanValue=String(value??'').replace(/\r?\n/g,' ');
          const startText=textNodes[startNode].textContent||'';
          const endText=textNodes[endNode].textContent||'';
          if(startNode===endNode){
            textNodes[startNode].textContent=startText.slice(0,startOffset)+cleanValue+startText.slice(endOffset);
          }else{
            textNodes[startNode].textContent=startText.slice(0,startOffset)+cleanValue;
            for(let index=startNode+1;index<endNode;index++) textNodes[index].textContent='';
            textNodes[endNode].textContent=endText.slice(endOffset);
          }
          changed=true;
          full=textNodes.map((node)=>node.textContent||'').join('');
          markerIndex=full.indexOf(marker);
        }
      }
      return changed?new XMLSerializer().serializeToString(documentXml):source;
    }catch{
      return source;
    }
  }
  function paragraphRangeContaining(xml, marker){
    const markerIndex=xml.indexOf(marker);
    if(markerIndex<0) return null;
    const before=xml.slice(0,markerIndex+1);
    const matches=[...before.matchAll(/<w:p(?:\s[^>]*)?>/g)];
    if(!matches.length) return null;
    const start=matches[matches.length-1].index;
    const closing=xml.indexOf('</w:p>',markerIndex);
    if(closing<0) return null;
    return {start,end:closing+'</w:p>'.length};
  }
  async function installLogo(zip,dataUrl){
    const normalized=await normalizeImageDataUrl(dataUrl);
    const image=dataUrlBytes(normalized);
    const headerName=Object.keys(zip.files).find((name)=>/^word\/header\d*\.xml$/i.test(name));
    if(!image || !headerName) return false;
    let header=await zip.file(headerName).async('string');
    const logoMarker=['{{LOGO_EMPRESA}}','{{LOGO_empresa}}','{{LOGO_Empresa}}'].find((marker)=>header.includes(marker));
    const range=logoMarker ? paragraphRangeContaining(header,logoMarker) : null;
    if(!range) return false;
    const mediaName=`word/media/surveyor-user-logo.${image.ext}`;
    zip.file(mediaName,image.bytes);
    const relsName=`word/_rels/${headerName.split('/').pop()}.rels`;
    let rels=zip.file(relsName) ? await zip.file(relsName).async('string') : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
    let index=1;
    while(rels.includes(`Id="rIdSurveyorLogo${index}"`)) index++;
    const rid=`rIdSurveyorLogo${index}`;
    rels=rels.replace('</Relationships>',`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/surveyor-user-logo.${image.ext}"/></Relationships>`);
    zip.file(relsName,rels);
    const imageParagraph=`<w:p><w:pPr><w:spacing w:before="80" w:after="0"/><w:jc w:val="center"/></w:pPr><w:r><w:pict><v:shape type="#_x0000_t75" style="width:86pt;height:52pt" stroked="f"><v:imagedata r:id="${rid}" o:title="Logotipo"/></v:shape></w:pict></w:r></w:p>`;
    header=header.slice(0,range.start)+imageParagraph+header.slice(range.end);
    zip.file(headerName,header);
    const contentTypes='[Content_Types].xml';
    let types=await zip.file(contentTypes).async('string');
    if(!new RegExp(`Extension="${image.ext}"`,'i').test(types)){
      types=types.replace('</Types>',`<Default Extension="${image.ext}" ContentType="${image.contentType}"/></Types>`);
      zip.file(contentTypes,types);
    }
    return true;
  }
  function stripAgroEmptyConfrontantSection(xml,item,replacements={}){
    if(item?.id!=='agro-mais') return xml;
    const hasConfrontant=[1,2,3,4].some((index)=>{
      const name=String(replacements[`CONFRONTANTE_${index}_NOME`]||'').trim();
      const doc=String(replacements[`CONFRONTANTE_${index}_DOC`]||'').trim();
      const clean=(value)=>!['','nao informado','não informado','nao informada','não informada','-'].includes(String(value||'').toLowerCase());
      return clean(name)||clean(doc);
    });
    if(hasConfrontant || typeof DOMParser==='undefined' || typeof XMLSerializer==='undefined') return xml;
    try{
      const doc=new DOMParser().parseFromString(String(xml||''),'application/xml');
      if(doc.querySelector('parsererror')) return xml;
      const children=[...doc.documentElement.getElementsByTagNameNS('*','body')[0]?.children||[]];
      const textOf=(node)=>[...node.getElementsByTagNameNS('*','t')].map((t)=>t.textContent||'').join('').replace(/\s+/g,' ').trim();
      const headingIndex=children.findIndex((node)=>/^CONFRONTANTE\s*\(S\)\s*:?$/i.test(textOf(node)) || /^CONFRONTANTE\s*\(/i.test(textOf(node)));
      if(headingIndex<0) return xml;
      let tableIndex=-1;
      for(let i=headingIndex+1;i<children.length;i++){
        if(String(children[i].localName||'').toLowerCase()==='tbl'){tableIndex=i;break;}
        if(i>headingIndex+6) break;
      }
      if(tableIndex<0) return xml;
      for(let i=tableIndex;i>=headingIndex;i--) children[i]?.parentNode?.removeChild(children[i]);
      return new XMLSerializer().serializeToString(doc);
    }catch{return xml;}
  }

  async function createDocx(templateId, replacements, filename){
    const item=byId(templateId);
    if(!item.file) throw new Error('O modelo padrão usa o gerador normal do Surveyor.');
    if(!window.JSZip) throw new Error('Biblioteca DOCX não carregada.');
    let templateBytes;
    if(item.restricted){
      const auth=window.SurveyorAuth||window.GeoRuralAuth;
      if(!auth?.apiFetch) throw new Error('Sessão autenticada necessária para este modelo.');
      const payload=await auth.apiFetch(`/api/memorial-templates/${encodeURIComponent(item.id)}`, {method:'GET', noCache:true});
      const raw=atob(String(payload?.contentBase64||''));
      if(!raw) throw new Error('O modelo restrito não foi liberado para esta conta.');
      const bytes=new Uint8Array(raw.length); for(let i=0;i<raw.length;i++) bytes[i]=raw.charCodeAt(i);
      templateBytes=bytes.buffer;
    }else{
      const response=await fetch(`/assets/memorial-templates/${encodeURIComponent(item.file)}`, {cache:'no-store'});
      if(!response.ok) throw new Error('Não foi possível carregar o template selecionado.');
      templateBytes=await response.arrayBuffer();
    }
    const zip=await JSZip.loadAsync(templateBytes);
    const logoInstalled=await installLogo(zip,replacements?.LOGO_EMPRESA_DATA_URL);
    const xmlFiles=Object.keys(zip.files).filter((name)=>/^word\/(document|header\d*|footer\d*)\.xml$/i.test(name));
    for(const name of xmlFiles){
      let xml=await zip.file(name).async('string');
      for(const [key,raw] of Object.entries(replacements||{})){
        if(key==='LOGO_EMPRESA_DATA_URL') continue;
        const value=(key==='LOGO_EMPRESA' && logoInstalled) ? '' : raw;
        xml=replaceToken(xml,key,value);
      }
      if(/^word\/document\.xml$/i.test(name)) xml=stripAgroEmptyConfrontantSection(xml,item,replacements||{});
      zip.file(name,xml);
    }
    const blob=await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
    blobDownload(blob,filename);
  }
  window.SurveyorMemorialTemplates={items:ITEMS, byId, galleryHtml, createDocx, allowedTemplateIds, canUse, itemsForCustomization};
})();
