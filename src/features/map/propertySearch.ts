/** Busca por prefixo, trechos do nome e pequena variação de digitação. */
const normalizeText=(s:string)=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const stopwords=new Set(['de','do','da','dos','das','e','o','a']);
const nameField=/(^|_)(nome|name|imovel|fazenda|sitio|propriedade|denominacao)(_|$)|^(nom|nm)[_]?/i;
function distanceAtMostOne(a:string,b:string){if(Math.abs(a.length-b.length)>1)return false;let i=0,j=0,errors=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++errors>1)return false;if(a.length>b.length)i++;else if(b.length>a.length)j++;else{i++;j++;}}return errors+(a.length-i)+(b.length-j)<=1;}
export function propertyMatches(record:Record<string,unknown>,query:string):boolean{
 const needle=normalizeText(query).split(' ').filter(x=>x.length>1&&!stopwords.has(x));
 if(!needle.length)return false;
 const names=Object.entries(record).filter(([k,v])=>nameField.test(k)&&(typeof v==='string'||typeof v==='number')).map(([,v])=>normalizeText(String(v)));
 // Busca de imóvel usa primeiro campos de nome; não confunde nome com números e endereços.
 const relevant=[...names,...Object.entries(record).filter(([k,v])=>!nameField.test(k)&&(typeof v==='string'||typeof v==='number')).map(([,v])=>normalizeText(String(v)))];
 const words=relevant.join(' ').split(' ').filter(Boolean);
 return needle.every(q=>words.some(w=>w.startsWith(q)||w.includes(q)||(q.length>=4&&w.length>=4&&distanceAtMostOne(q,w))));
}
