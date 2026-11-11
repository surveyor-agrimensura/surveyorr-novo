import {describe,it,expect} from 'vitest';
import {normalizeDocumentCustomization} from './customizationApi';

describe('resposta de preferências do Appwrite',()=>{
 it('expõe croqui e confrontantes do documentOptions onde a Function grava',()=>{
  const result=normalizeDocumentCustomization({customization:{options:{
   croquiDraftsByFeature:{projeto:{imovel:{neighbors:['versão antiga']}}},
   documentOptions:{croquiDraftsByFeature:{projeto:{imovel:{neighbors:['MARIA','MARIA']}}},
    confrontantRegistry:{projeto:{imovel:{neighbors:['MARIA','MARIA'],details:{}}}}}
  }}});
  const options=result.customization?.options as Record<string,unknown>;
  expect(options.croquiDraftsByFeature).toEqual({projeto:{imovel:{neighbors:['MARIA','MARIA']}}});
  expect(options.confrontantRegistry).toEqual({projeto:{imovel:{neighbors:['MARIA','MARIA'],details:{}}}});
 });
});
