export class GeometryWorkerClient {
  #worker=null; #pending=new Map(); #sequence=0;
  constructor({url='/assets/js/core/editor-engine/geometry-worker.js'}={}){
    if(typeof Worker==='undefined')return;
    this.#worker=new Worker(url,{type:'module',name:'surveyor-editor-geometry'});
    this.#worker.addEventListener('message',(event)=>{const msg=event.data||{};const pending=this.#pending.get(msg.id);if(!pending)return;this.#pending.delete(msg.id);msg.ok?pending.resolve(msg.result):pending.reject(new Error(msg.error||'Falha no worker geométrico.'));});
    this.#worker.addEventListener('error',(error)=>{this.#pending.forEach(({reject})=>reject(error));this.#pending.clear();});
  }
  get available(){return Boolean(this.#worker);}
  run(type,payload={}){if(!this.#worker)return Promise.reject(new Error('Web Worker indisponível.'));const id=`geo-${++this.#sequence}`;return new Promise((resolve,reject)=>{this.#pending.set(id,{resolve,reject});this.#worker.postMessage({id,type,payload});});}
  metrics(points){return this.run('metrics',{points});}
  distance(a,b){return this.run('distance',{a,b});}
  destroy(){this.#worker?.terminate();this.#worker=null;this.#pending.forEach(({reject})=>reject(new Error('Worker encerrado.')));this.#pending.clear();}
}
