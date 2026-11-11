import {expect,it} from 'vitest';
import {propertyMatches} from '../src/features/map/propertySearch';
it('encontra Sítio de Deus pesquisando sitio deus',()=>{
 expect(propertyMatches({nome_imovel:'Sítio de Deus',codigo:'BA-123'},'sitio deus')).toBe(true);
});
it('busca por termos diferentes do mesmo registro',()=>{
 expect(propertyMatches({nome_imovel:'Boa Vista',municipio:'Amargosa'},'boa amargosa')).toBe(true);
});
it('nao devolve falso positivo',()=>{
 expect(propertyMatches({nome_imovel:'Sítio de Deus'},'fazenda das flores')).toBe(false);
});
