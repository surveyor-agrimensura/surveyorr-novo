import {xmlEscape} from './geometry';
const enc=new TextEncoder();
function u16(v:number){return [v&255,(v>>>8)&255]}
function u32(v:number){return [v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255]}
const tab=(()=>{const t:number[]=[];for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[i]=c>>>0;}return t})();
function crc32(bytes:Uint8Array){let crc=0xFFFFFFFF;for(const b of bytes)crc=tab[(crc^b)&255]^(crc>>>8);return (crc^0xFFFFFFFF)>>>0;}
export function makeZip(files:{name:string;content:string|Uint8Array}[]):Uint8Array{
 const chunks:Uint8Array[]=[];const directories:Uint8Array[]=[];let offset=0;
 for(const {name,content} of files){
  const nb=enc.encode(name),data=typeof content==='string'?enc.encode(content):content,crc=crc32(data),n=data.length;
  const header=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0x800),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(n),...u32(n),...u16(nb.length),...u16(0)]);
  chunks.push(header,nb,data);
  directories.push(new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0x800),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(n),...u32(n),...u16(nb.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...nb]));
  offset+=header.length+nb.length+data.length;
 }
 const centralSize=directories.reduce((n,b)=>n+b.length,0);
 const end=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(centralSize),...u32(offset),...u16(0)]);
 const all=[...chunks,...directories,end];const result=new Uint8Array(all.reduce((n,b)=>n+b.length,0));let pos=0;for(const chunk of all){result.set(chunk,pos);pos+=chunk.length;}return result;
}
export function downloadBytes(bytes:Uint8Array,name:string,mime:string){const blob=new Blob([new Uint8Array(bytes).buffer],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function paragraph(str:string){return `<w:p><w:pPr><w:spacing w:after="180"/></w:pPr><w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${xmlEscape(str)}</w:t></w:r></w:p>`;}
export function docxBytes(lines:string[]){const document=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${lines.flatMap(line=>line.split('\n').map(paragraph)).join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417"/></w:sectPr></w:body></w:document>`;const files=[{name:'[Content_Types].xml',content:'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'},{name:'_rels/.rels',content:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'},{name:'word/document.xml',content:document}];return makeZip(files);}
export function downloadDocx(lines:string[],filename:string){downloadBytes(docxBytes(lines),filename,'application/vnd.openxmlformats-officedocument.wordprocessingml.document');}
