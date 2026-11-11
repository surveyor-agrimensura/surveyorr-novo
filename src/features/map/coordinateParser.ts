export type CoordinateFormat='DD'|'DMS'|'DDM'|'UTM'|'EPSG';
const verify=(lat:number,lon:number):[number,number]=>{if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)throw new Error('Latitude ou longitude fora do intervalo.');return [lat,lon];};
const degreePart=(part:string,format:'DMS'|'DDM',axis:'latitude'|'longitude')=>{
 const input=part.trim();
 const hemispheres=input.match(/[NSEWO]/ig)||[];
 if(hemispheres.length>1)throw new Error('Informe apenas um hemisfério por coordenada.');
 const hemi=hemispheres[0]?.toUpperCase();
 const rawNumbers=input.replace(/[NSEWO]/ig,'').match(/[+-]?\d+(?:[.,]\d+)?/g)||[];
 const expectedCount=format==='DMS'?3:2;
 if(rawNumbers.length!==expectedCount)throw new Error(`Use ${format}: graus, minutos${format==='DMS'?' e segundos':''}, com direção N/S/E/W.`);
 const residue=input.replace(/[NSEWO]/ig,'').replace(/[+-]?\d+(?:[.,]\d+)?/g,'').replace(/[°º'′"″:\s]/g,'');
 if(residue)throw new Error(`Formato ${format} inválido.`);
 if(rawNumbers.slice(1).some(value=>/^[+-]/.test(value)))throw new Error('Sinal negativo só pode aparecer antes dos graus.');
 const nums=rawNumbers.map(x=>Number(x.replace(',','.')));
 const allowed=axis==='latitude'?['N','S']:['E','W','O'];
 if(hemi&&!allowed.includes(hemi))throw new Error(`Hemisfério incompatível: latitude usa N/S e longitude usa E/W.`);
 if(nums[1]>=60||(format==='DMS'&&nums[2]>=60))throw new Error('Minutos e segundos devem estar entre 0 e 59.999…');
 const explicitSign=rawNumbers[0][0]==='-'?-1:rawNumbers[0][0]==='+'?1:0;
 const hemisphereSign=hemi==='S'||hemi==='W'||hemi==='O'?-1:hemi?1:0;
 if(explicitSign&&hemisphereSign&&explicitSign!==hemisphereSign)throw new Error('Sinal numérico incompatível com o hemisfério informado.');
 const degrees=Math.abs(nums[0])+nums[1]/60+(format==='DMS'?nums[2]/3600:0);
 return (hemisphereSign||explicitSign||1)*degrees;
};
function utmToWgs84(zone:number,easting:number,northing:number,hemisphere:'N'|'S'):[number,number]{
 if(zone<1||zone>60||easting<100000||easting>900000||northing<0||northing>10000000)throw new Error('UTM fora da faixa válida.');
 const a=6378137,e=0.081819190842622,k0=0.9996,ep2=e*e/(1-e*e),e1=(1-Math.sqrt(1-e*e))/(1+Math.sqrt(1-e*e));
 const x=easting-500000,y=(hemisphere==='S'?northing-10000000:northing);
 const M=y/k0,mu=M/(a*(1-e*e/4-3*e**4/64-5*e**6/256));
 const phi=mu+(3*e1/2-27*e1**3/32)*Math.sin(2*mu)+(21*e1**2/16-55*e1**4/32)*Math.sin(4*mu)+(151*e1**3/96)*Math.sin(6*mu);
 const n1=a/Math.sqrt(1-e*e*Math.sin(phi)**2),t1=Math.tan(phi)**2,c1=ep2*Math.cos(phi)**2,r1=a*(1-e*e)/(1-e*e*Math.sin(phi)**2)**1.5,d=x/(n1*k0);
 const lat=phi-(n1*Math.tan(phi)/r1)*(d*d/2-(5+3*t1+10*c1-4*c1*c1-9*ep2)*d**4/24+(61+90*t1+298*c1+45*t1*t1-252*ep2-3*c1*c1)*d**6/720);
 const lon0=(zone*6-183)*Math.PI/180;
 const lon=lon0+(d-(1+2*t1+c1)*d**3/6+(5-2*c1+28*t1-3*c1*c1+8*ep2+24*t1*t1)*d**5/120)/Math.cos(phi);
 return verify(lat*180/Math.PI,lon*180/Math.PI);
}
export function parseMapCoordinates(text:string,format:CoordinateFormat):[number,number]{
 if(format==='DD'){const items=text.trim().split(/[;\s,]+/).map(Number);if(items.length!==2)return (()=>{throw new Error('Informe latitude, longitude. Ex.: -13.0312, -39.6059');})();return verify(items[0],items[1]);}
 if(format==='EPSG'){const m=text.trim().match(/^(?:EPSG:)?(4326|4674)\s*[;, ]\s*(-?\d+(?:[.,]\d+)?)\s*[,; ]\s*(-?\d+(?:[.,]\d+)?)$/i);if(!m)throw new Error('EPSG: informe 4326 ou 4674, latitude e longitude. Ex.: EPSG:4674; -13.03; -39.60');return verify(Number(m[2].replace(',','.')),Number(m[3].replace(',','.')));}
 if(format==='UTM'){
  const m=text.trim().match(/^(\d{1,2})([NS])?\s*[,; ]\s*(\d+(?:[.,]\d+)?)\s*[,; ]\s*(\d+(?:[.,]\d+)?)\s*([NS])?$/i);
  if(!m)throw new Error('UTM: zona e hemisfério, Leste e Norte. Ex.: 24S, 428507, 8562755');
  return utmToWgs84(Number(m[1]),Number(m[3].replace(',','.')),Number(m[4].replace(',','.')),(m[2]||m[5]||'S').toUpperCase() as 'N'|'S');
 }
 const parts=text.split(/\s*;\s*|\s*\|\s*|\s*,\s*(?=[-+]?\d+\s*[°º])/);
 if(parts.length!==2)throw new Error('Separe latitude e longitude por ponto e vírgula. Ex.: 13°01\'52"S; 39°36\'21"W');
 return verify(degreePart(parts[0],format,'latitude'),degreePart(parts[1],format,'longitude'));
}
