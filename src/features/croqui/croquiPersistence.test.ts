import { describe, expect, it } from 'vitest';
import { defaultCroquiSettings, normalizeCroquiSettings, renderCroqui } from '../memorial/croquiRenderer';
import { cloudCroquiDraft, withSavedCroquiSettings } from './sharedCroquiSettings';
import type { SurveyPolygon } from '../memorial/memorialEngine';

// Regressão da Etapa 68: o Memorial não pode limitar um texto que foi
// arrastado para longe do limite da gleba no editor de Mapas e Croquis.
const polygon: SurveyPolygon = {
  id: 'gleba-3-poligono', name: 'GLEBA 3',
  vertices: [[-39.500,-13.500],[-39.496,-13.501],[-39.496,-13.503],[-39.499,-13.504]],
  areaM2: 40000, perimeterM: 800, properties: {},
};
const info = { company: 'AGR', municipality: 'Amargosa / BA', mapLink: '', propertyName: 'GLEBA 3' };
const labelX = (svg: string, key: string) => {
  const safeKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = svg.match(new RegExp(`data-croqui-label="${safeKey}"[^>]* x="(-?[0-9.]+)"`));
  if (!match) throw new Error(`Não foi possível localizar o rótulo ${key}`);
  return Number(match[1]);
};

describe('posição de confrontante salva no editor e reutilizada pelo Memorial', () => {
  it('preserva deslocamentos longos depois da ida e volta pela nuvem', () => {
    const settings = defaultCroquiSettings();
    settings.background = 'none';
    settings.neighbors = ['VALDEMIR MOTA DOS SANTOS - 669.560.485-15', 'MARIA DO CARMO', '', ''];
    settings.labelOffsets = { 'neighbor:0': { dx: -420, dy: 38 } };
    settings.labelAngles = { 'neighbor:0': 0 };
    const cloud = withSavedCroquiSettings({ options: {} }, 'proj-gleba-3', polygon.id, settings);
    const fetched = cloudCroquiDraft(cloud.options, 'proj-gleba-3', polygon.id);
    const restored = normalizeCroquiSettings(fetched);
    expect(restored.labelOffsets['neighbor:0']).toEqual({dx:-420, dy:38});
    expect(restored.neighbors).toEqual(settings.neighbors);
    expect(restored.background).toBe('none');
    const editorSvg = renderCroqui(polygon, settings, info);
    const memorialSvg = renderCroqui(polygon, restored, info);
    expect(labelX(memorialSvg,'neighbor:0')).toBeCloseTo(labelX(editorSvg,'neighbor:0'),1);
    expect(memorialSvg).toBe(editorSvg);
  });

  it('não aplica o antigo corte de 150px à posição manual', () => {
    const settings = defaultCroquiSettings();
    settings.neighbors=['VALDEMIR MOTA DOS SANTOS - 669.560.485-15','','',''];
    const centered = {...settings,labelOffsets:{'neighbor:0':{dx:0,dy:0}}};
    const shifted = {...settings,labelOffsets:{'neighbor:0':{dx:-320,dy:0}}};
    const a = labelX(renderCroqui(polygon, centered, info),'neighbor:0');
    const b = labelX(renderCroqui(polygon, normalizeCroquiSettings(shifted), info),'neighbor:0');
    expect(a-b).toBeCloseTo(320,1);
  });
});
