const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
const vm=require('node:vm');
const raw=fs.readFileSync('src/lib/satelliteSvg.ts','utf8');
const testModule={exports:{}};
class Reader{
 readAsDataURL(){this.result='data:image/jpeg;base64,VEVTVA==';this.onload();}
}
let requests=0;
const context={exports:testModule.exports,require,URL,Map,Set,Promise,console,AbortController,setTimeout,clearTimeout,FileReader:Reader,fetch:async()=>{requests++;return {ok:true,headers:{get:()=> 'image/jpeg'},blob:async()=>({size:10})};}};
vm.runInNewContext(ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
(async()=>{
 const input='<svg><image href="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/17/500/300" x="10"/></svg>';
 const one=await testModule.exports.embedSvgSatellite(input);
 assert.equal(one.missing,0);
 assert.equal(one.total,1);
 assert.match(one.svg,/data:image\/jpeg;base64,VEVTVA==/);
 const two=await testModule.exports.embedSvgSatellite(input);
 assert.equal(requests,1);
 assert.equal(two.svg,one.svg);
 const denied=await testModule.exports.embedSvgSatellite('<svg><image href="https://untrusted.example/tile"/></svg>');
 assert.equal(denied.total,0);
 console.log('SURVEYOR: satélite incorporado ao SVG e cache de imagens aprovados.');
})().catch(err=>{console.error(err);process.exitCode=1;});
