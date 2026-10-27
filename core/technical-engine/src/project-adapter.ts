import type { TechnicalGeometry, TechnicalProject } from './types.js';

function pickGeometry(project: any): TechnicalGeometry | null {
  const helper = (globalThis as any).SurveyorProjectGeometry?.resolvePerimeter?.(project);
  if (helper?.geometry && /Polygon/i.test(helper.geometry.type || '')) return helper.geometry as TechnicalGeometry;
  const features = project?.geojson?.features || [];
  const polygons = features.filter((feature: any) => /Polygon/i.test(feature?.geometry?.type || ''));
  if (!polygons.length) return null;
  const perimeter = polygons.find((feature: any) => feature?.properties?.category === 'perimetro') || polygons[0];
  return (perimeter?.geometry || null) as TechnicalGeometry | null;
}

function hiddenVertexKeys(project: any): string[] {
  const helper = (globalThis as any).SurveyorProjectGeometry?.resolvePerimeter?.(project);
  const feature = helper || (project?.geojson?.features || []).find((item: any) => item?.properties?.category === 'perimetro');
  return Array.isArray(feature?.properties?.surveyorHiddenVertexKeys) ? feature.properties.surveyorHiddenVertexKeys.filter(Boolean) : [];
}

export function adaptProject(project: any, form: Record<string, string> = {}): TechnicalProject {
  const geometry = pickGeometry(project);
  if (!geometry) throw new Error('O projeto selecionado não possui perímetro poligonal válido.');
  return {
    id: String(project?.id || 'sem-id'),
    title: String(project?.propertyName || project?.title || project?.name || 'Imóvel rural'),
    owner: String(project?.owner || project?.ownerName || project?.metadata?.owner || 'Não informado'),
    city: String(project?.city || project?.municipality || ''),
    uf: String(project?.uf || project?.stateCode || ''),
    registration: String(form.registration || project?.registration || project?.metadata?.registration || ''),
    technician: String(form.technician || project?.technician || project?.responsibleTechnician || ''),
    district: String(form.district || project?.district || ''),
    registryOffice: String(form.registryOffice || project?.registryOffice || ''),
    incra: String(form.incra || project?.incra || project?.incraCode || ''),
    geometry,
    hiddenVertexKeys: hiddenVertexKeys(project)
  };
}
