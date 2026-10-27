const distance=(a,b)=>Math.hypot(Number(b?.x)-Number(a?.x),Number(b?.y)-Number(a?.y));
const area=(points=[])=>{if(points.length<3)return 0;let sum=0;for(let i=0;i<points.length;i+=1){const a=points[i],b=points[(i+1)%points.length];sum+=Number(a.x)*Number(b.y)-Number(b.x)*Number(a.y);}return Math.abs(sum)/2;};
const perimeter=(points=[])=>points.length<2?0:points.reduce((sum,p,i)=>sum+distance(p,points[(i+1)%points.length]),0);
self.onmessage=(event)=>{
  const {id,type,payload={}}=event.data||{};
  try{
    let result=null;
    if(type==='metrics')result={area:area(payload.points||[]),perimeter:perimeter(payload.points||[])};
    else if(type==='distance')result=distance(payload.a,payload.b);
    else throw new Error(`Operação geométrica não suportada: ${type}`);
    self.postMessage({id,ok:true,result});
  }catch(error){self.postMessage({id,ok:false,error:error?.message||String(error)});}
};
