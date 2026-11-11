/** Diagnostico SOMENTE LEITURA. Requer APPWRITE_API_KEY em variavel de ambiente local.
 * Nao imprime a chave e nao modifica registros, atributos, buckets ou credenciais. */
const endpoint = String(process.env.APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1').replace(/\/+$/, '');
const project = String(process.env.APPWRITE_PROJECT_ID || 'surveyor-georural-pro');
const db = String(process.env.APPWRITE_DATABASE_ID || 'surveyor_db');
const collection = String(process.env.APPWRITE_COLLECTION_CUSTOMIZATION || 'customization');
const bucket = String(process.env.APPWRITE_BUCKET_USER_ASSETS || 'user_assets');
const apiKey = String(process.env.APPWRITE_API_KEY || process.env.APPWRITE_FUNCTION_API_KEY || '');
if (!apiKey) {console.error('Defina APPWRITE_API_KEY no terminal local para verificacao autenticada (nao inclua em arquivos ZIP).');process.exit(2);}
const headers={'X-Appwrite-Project':project,'X-Appwrite-Key':apiKey};
async function read(paths){let last=null;for(const path of paths){const response=await fetch(`${endpoint}${path}`,{headers,signal:AbortSignal.timeout(15000)});const result=await response.json().catch(()=>({}));if(response.ok)return result;last=`${response.status}: ${result.message||'Nao foi possivel ler o recurso'}`;if(![400,404,405].includes(response.status))break;}throw new Error(last||'Falha ao consultar Appwrite');}
let problems=0;
try {
 const schema=await read([`/databases/${encodeURIComponent(db)}/collections/${encodeURIComponent(collection)}`,`/tablesdb/${encodeURIComponent(db)}/tables/${encodeURIComponent(collection)}`]);
 const attrs=Array.isArray(schema.attributes)?schema.attributes:Array.isArray(schema.columns)?schema.columns:[];
 const opts=attrs.find(a=>(a.key||a.name)==='options');
 const type=String(opts?.type||'').toLowerCase();const size=Number(opts?.size||opts?.length||0);
 console.log(`Colecao: ${collection} | options: tipo=${type||'NAO ENCONTRADO'}, tamanho=${size||'NAO INFORMADO'}`);
 if(!opts||type!=='string'||size<65535){problems++;console.error('ERRO: customization.options precisa ser string com limite >= 65535 (atualmente incompatível).');}
 const userId=attrs.find(a=>(a.key||a.name)==='userId');
 if(!userId) {problems++;console.error('ERRO: atributo userId nao encontrado.');}
 const bucketInfo=await read([`/storage/buckets/${encodeURIComponent(bucket)}`]);
 console.log(`Bucket: ${bucket} | enabled=${bucketInfo.enabled} | maxFileSize=${bucketInfo.maximumFileSize??'nao informado'} | extensoes=${(bucketInfo.allowedFileExtensions||[]).join(',')||'sem restricao'}`);
 const formats=Array.isArray(bucketInfo.allowedFileExtensions)?bucketInfo.allowedFileExtensions:[];
 if(bucketInfo.enabled===false||formats.length&&!formats.includes('json')){problems++;console.error('ERRO: bucket desativado ou extensao .json proibida.');}
 if(Number(bucketInfo.maximumFileSize)>0&&Number(bucketInfo.maximumFileSize)<1024*1024)console.warn('AVISO: bucket menor que 1MB; fotos/assinaturas de croquis podem exceder o limite.');
 console.log(problems?`Falhou em ${problems} verificacao(oes).`:'Esquema minimo conferido. Teste autenticado de salvamento e reabertura ainda necessario.');
 process.exitCode=problems?1:0;
}catch(error){console.error('Nao foi possivel validar a configuracao real:',error.message);process.exitCode=2;}
