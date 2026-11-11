/** Formatação de exibição; não valida se o documento pertence à pessoa. */
export function formatBrazilianDocument(raw:unknown):string {
 const value=String(raw??'').trim();
 const digits=value.replace(/\D/g,'');
 if(digits.length===11)return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4');
 if(digits.length===14)return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5');
 return value;
}
export function isDocumentFieldFilled(value:unknown){return String(value??'').trim().length>0;}

/** Máscara progressiva de CPF/CNPJ: apenas apresentação, sem validar titularidade. */
export function maskBrazilianDocumentInput(input:string):string {
 const digits=input.replace(/\D/g,'').slice(0,14);
 if(digits.length>11){const p=digits;return [p.slice(0,2),p.slice(2,5),p.slice(5,8)].filter(Boolean).join('.')+(p.length>8?'/'+p.slice(8,12):'')+(p.length>12?'-'+p.slice(12,14):'');}
 const p=digits;
 return [p.slice(0,3),p.slice(3,6),p.slice(6,9)].filter(Boolean).join('.')+(p.length>9?'-'+p.slice(9,11):'');
}
/** RG não possui formato nacional único. Aplica o formato comum de 9 dígitos somente quando cabível. */
export function formatBrazilianRg(input:string):string {
 const v=String(input||'').trim().toUpperCase();const d=v.replace(/\D/g,'');
 return /^\d{9}$/.test(d)?d.replace(/(\d{2})(\d{3})(\d{3})(\d)/,'$1.$2.$3-$4'):v;
}
