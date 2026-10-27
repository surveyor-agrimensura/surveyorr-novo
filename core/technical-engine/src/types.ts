export type LngLat = readonly [number, number];

export interface PolygonGeometry { type: 'Polygon'; coordinates: number[][][]; }
export interface MultiPolygonGeometry { type: 'MultiPolygon'; coordinates: number[][][][]; }
export type TechnicalGeometry = PolygonGeometry | MultiPolygonGeometry;

export interface TechnicalProject {
  id: string;
  title: string;
  owner: string;
  city: string;
  uf: string;
  registration: string;
  technician: string;
  district: string;
  registryOffice: string;
  incra: string;
  geometry: TechnicalGeometry;
  hiddenVertexKeys?: string[];
}

export interface PageSpec {
  widthMm: number;
  heightMm: number;
  marginMm: number;
  sidebarMm: number;
}

export interface TechnicalGuide {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label?: string;
  style?: 'dashed' | 'solid';
  showLabel?: boolean;
}

export interface EngineOptions {
  title: string;
  scaleText: string;
  sheetNumber: string;
  vertexScale: number;
  polygonFill: boolean;
  showVertices: boolean;
  showScale: boolean;
  showNorth: boolean;
  textScale: number;
  lineScale: number;
  mapScale: number;
  mapOffsetX: number;
  mapOffsetY: number;
  guides: TechnicalGuide[];
  guideLabelScale: number;
  page: PageSpec;
}

export interface LabelOffset { dx: number; dy: number; }
export type LabelOffsetMap = Record<string, LabelOffset>;

export interface TechnicalMetrics {
  areaHa: number;
  perimeterM: number;
  vertexCount: number;
}

export interface EngineScene {
  svg: string;
  metrics: TechnicalMetrics;
  labelOffsets: LabelOffsetMap;
}
