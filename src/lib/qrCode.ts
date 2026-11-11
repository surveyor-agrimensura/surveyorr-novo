import qrcode from 'qrcode-generator';

/** Gera o QR localmente para que URLs com coordenadas não sejam enviadas a terceiros. */
export function qrCodeDataUrl(value:string,cellSize=3):string{
 if(!value)return '';
 try{
  const code=qrcode(0,'M');
  code.addData(value);
  code.make();
  return code.createDataURL(Math.max(1,Math.min(8,Math.round(cellSize))),0);
 }catch{return '';}
}
