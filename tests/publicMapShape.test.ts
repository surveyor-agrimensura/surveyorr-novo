import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {buildPublicMapUrl,parsePublicMapData,publicMapParts,publicMapUrlForProject,publicMapVertexCount} from '../src/features/public/publicMapData';

describe('Mapa público do imóvel',()=>{
 const first=[[-39.6,-13],[-39.59,-13],[-39.59,-12.99],[-39.6,-13]] as [number,number][];
 const second=[[-39.58,-13],[-39.57,-13],[-39.57,-12.99],[-39.58,-13]] as [number,number][];
 const hole=[[-39.598,-12.998],[-39.596,-12.998],[-39.596,-12.996],[-39.598,-12.998]] as [number,number][];
 it('inclui todas as glebas do imóvel completo no link compartilhável',()=>{
  const parts=publicMapParts([{vertices:first},{vertices:second}],{vertices:first},true);
  const url=buildPublicMapUrl('https://surveyor.example','Fazenda Exemplo',parts);
  const encoded=new URL(url).searchParams.get('dados');
  expect(parsePublicMapData(encoded)).toEqual({n:'Fazenda Exemplo',parts:[[first],[second]]});
 });
 it('prioriza glebas sobre o perímetro-base no mapa público composto',()=>{
  const parts=publicMapParts([
   {vertices:[[-39.6,-13],[-39.57,-13],[-39.57,-12.97],[-39.6,-13]],properties:{category:'Perímetro'}},
   {vertices:[[-39.6,-13],[-39.57,-13],[-39.57,-12.97],[-39.6,-13]],properties:{category:'Imóvel Completo'}},
   {vertices:first,properties:{category:'Gleba'}},
   {vertices:second,properties:{category:'Gleba'}}
  ],{vertices:first},true);
  expect(parts).toEqual([[first],[second]]);
 });
 it('preserva os vazios internos ao compartilhar uma gleba',()=>{
  const parts=publicMapParts([{vertices:first,holes:[hole]}],{vertices:first,holes:[hole]},false);
  const url=buildPublicMapUrl('https://surveyor.example','Fazenda com vazio',parts);
  expect(parsePublicMapData(new URL(url).searchParams.get('dados'))).toEqual({n:'Fazenda com vazio',parts:[[first,hole]]});
 });
 it('conta vértices distintos sem somar o ponto de fechamento dos anéis',()=>{
  expect(publicMapVertexCount([[first,hole],[second]])).toBe(9);
  expect(publicMapVertexCount([[[first[0],first[1],first[2]]]])).toBe(3);
 });
 it('gera link com todas as glebas mesmo quando existe URL antiga de uma só gleba',()=>{
  const url=publicMapUrlForProject('https://surveyor.example','Fazenda Exemplo',[{vertices:first},{vertices:second}],{vertices:first},true,'https://surveyor.example/publico/imovel/?dados=legado');
  expect(parsePublicMapData(new URL(url).searchParams.get('dados'))).toEqual({n:'Fazenda Exemplo',parts:[[first],[second]]});
 });
 it('usa o link composto no Croqui do Memorial de imóvel completo',()=>{
  const source=readFileSync(new URL('../src/features/memorial/MemorialPage.tsx',import.meta.url),'utf8');
  expect(source).toContain('const overviewMapLink=publicMapUrl(full,first,prefs,true)');
  expect(source).toContain('mapLink: overviewMapLink');
  expect(source).toContain('qr: showQr ? qrCodeDataUrl(overviewMapLink,3)');
 });
 it('preserva a URL pública cadastrada para uma única gleba',()=>{
  const saved=buildPublicMapUrl('https://surveyor.example','Fazenda Exemplo',[[first]]);
  expect(publicMapUrlForProject('https://surveyor.example','Fazenda Exemplo',[{vertices:first}],{vertices:first},false,saved)).toBe(saved);
 });
 it('substitui a rota pública antiga que não carrega os dados do perímetro',()=>{
  const old='https://surveyor.example/publico/imovel/projeto/gleba?lat=-13&lng=-39';
  const replacement=publicMapUrlForProject('https://surveyor.example','Fazenda Exemplo',[{vertices:first}],{vertices:first},false,old);
  expect(replacement).not.toBe(old);
  expect(parsePublicMapData(new URL(replacement).searchParams.get('dados'))).toEqual({n:'Fazenda Exemplo',parts:[[first]]});
 });
 it('mantém compatibilidade com links antigos de um único perímetro',()=>{
  expect(parsePublicMapData(JSON.stringify({n:'Legado',v:first}))).toEqual({n:'Legado',parts:[[first]]});
  expect(parsePublicMapData(JSON.stringify({n:'Legado parts',parts:[first,second]}))).toEqual({n:'Legado parts',parts:[[first],[second]]});
 });
 it('rejeita partes inválidas ou coordenadas fora do intervalo',()=>{
  expect(parsePublicMapData(JSON.stringify({parts:[[[0,0],[1,1]]]}))).toBeNull();
  expect(parsePublicMapData(JSON.stringify({parts:[[[181,0],[1,1],[2,2]]]}))).toBeNull();
  expect(parsePublicMapData(JSON.stringify({parts:[[[null,0],[1,1],[2,2]]]}))).toBeNull();
  expect(parsePublicMapData(JSON.stringify({parts:[[[[0,0],[1,1],[2,2]],[[181,0],[1,1],[2,2]]]]}))).toBeNull();
  expect(buildPublicMapUrl('https://surveyor.example','Inválido',[[[[Number.NaN,0],[1,1],[2,2]]]])).toBe('');
 });
});
