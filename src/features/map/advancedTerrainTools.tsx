import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Compass, Download, Globe2, Layers3, MapPin, Mountain, PanelRightClose, RefreshCw, Route, Scissors, Sparkles, X } from 'lucide-react';
import { makeProjection, polygonArea, bounds, type GeoPoint } from '../generations/geometry';
import { idw, makeContours, stitchContours, triangulate, type ZPoint } from '../generations/mdtEngine';
import { haversine } from './geoServices';
import { openRing } from './vertexEditing';
import { downloadText, toKml } from './mapFormats';
import {
  buildBufferPolygon,
  autoClassifySides,
  queryElevations,
  pointInPolygonXY,
  type MapFeature,
  type SegmentSide,
  type AdvancedToolKind,
} from './terrainTools';

// A lógica geométrica pura vive em ./terrainTools. Reexportada aqui para manter
// compatíveis os imports existentes (OperationalMap, MapWorkPanels).
export {
  reversePolygonRing,
  rotatePolygonStartVertex,
  buildBufferPolygon,
  featuresToDxf,
  autoClassifySides,
  queryElevations,
  type MapFeature,
  type AdvancedToolKind,
  type SegmentSide,
} from './terrainTools';

export function AdvancedTerrainModal({
  tool,
  features,
  selectedFeatureId,
  onSelectFeature,
  onAddFeatures,
  onUpdateFeature,
  onClose,
  notify
}: {
  tool: AdvancedToolKind;
  features: MapFeature[];
  selectedFeatureId: string | null;
  onSelectFeature: (id: string) => void;
  onAddFeatures: (newFeatures: MapFeature[]) => void;
  onUpdateFeature: (id: string, patch: Partial<MapFeature>) => void;
  onClose: () => void;
  notify: (msg: string) => void;
}) {
  const polygons = useMemo(() => features.filter(f => f.geometry.type === 'Polygon' && f.properties?.hidden !== true), [features]);
  const linesAndPolys = useMemo(() => features.filter(f => (f.geometry.type === 'LineString' || f.geometry.type === 'Polygon') && f.properties?.hidden !== true), [features]);

  const activeFeature = useMemo(() => {
    const pool = tool === 'profile' ? linesAndPolys : polygons;
    return pool.find(f => String(f.id) === selectedFeatureId) || pool[0] || null;
  }, [tool, linesAndPolys, polygons, selectedFeatureId]);

  const [busy, setBusy] = useState(false);
  const [elevSource, setElevSource] = useState<'open-meteo' | null>(null);
  const [elevationError, setElevationError] = useState<string | null>(null);
  const elevationRequestRef = useRef(0);

  // 1. Front / Back state
  const openCoords = useMemo(() => {
    if (!activeFeature || activeFeature.geometry.type !== 'Polygon') return [];
    return openRing(activeFeature.geometry.coordinates[0]);
  }, [activeFeature]);

  const [sides, setSides] = useState<SegmentSide[]>([]);
  useEffect(() => {
    if (!openCoords.length) {
      setSides([]);
      return;
    }
    const existing = activeFeature?.properties?.segmentSides as Record<string, SegmentSide> | undefined;
    const auto = autoClassifySides(openCoords);
    setSides(openCoords.map((_, i) => existing?.[String(i)] || auto[i] || 'divisa'));
  }, [activeFeature, openCoords]);

  // 2. Profile state
  const [profileSamples, setProfileSamples] = useState<{ dist: number; z: number; lat: number; lon: number; label: string }[]>([]);
  const [sampleCount, setSampleCount] = useState(24);

  // 3. Cut / Fill & Contours & Spot & 3D grid state
  const [gridPoints, setGridPoints] = useState<(GeoPoint & { x: number; y: number; z: number })[]>([]);
  const [targetQuota, setTargetQuota] = useState<number>(0);
  const [contourSpacing, setContourSpacing] = useState<number>(1);
  const [spotStep, setSpotStep] = useState<number>(5);
  const [bufferMeters, setBufferMeters] = useState<number>(15);

  // 4. 3D viewer controls
  const [yaw, setYaw] = useState(38);
  const [pitch, setPitch] = useState(52);
  const [zExaggeration, setZExaggeration] = useState(2.5);
  const canvas3dRef = useRef<HTMLCanvasElement | null>(null);
  const orbitPointerRef = useRef<{ id: number; x: number; y: number } | null>(null);

  const loadProfileData = async () => {
    if (!activeFeature) return;
    const requestId = ++elevationRequestRef.current;
    setBusy(true);
    setElevationError(null);
    setElevSource(null);
    setProfileSamples([]);
    try {
      let rawPts: number[][];
      if (activeFeature.geometry.type === 'LineString') rawPts = activeFeature.geometry.coordinates;
      else if (activeFeature.geometry.type === 'Polygon') {
        const ring = openRing(activeFeature.geometry.coordinates[0]);
        rawPts = ring.length ? [...ring, ring[0]] : [];
      } else rawPts = [];
      if (rawPts.length < 2) throw new Error('A feição precisa ter ao menos dois pontos para gerar o perfil.');
      const totalSegs = Math.max(8, Math.min(80, sampleCount));
      const sampled: { lat: number; lon: number; dist: number; label: string }[] = [];
      let cumDist = 0;
      const cumArray = [0];
      for (let i = 1; i < rawPts.length; i++) {
        cumDist += haversine([rawPts[i - 1][1], rawPts[i - 1][0]], [rawPts[i][1], rawPts[i][0]]);
        cumArray.push(cumDist);
      }
      for (let s = 0; s <= totalSegs; s++) {
        const targetD = (cumDist * s) / totalSegs;
        let segIdx = 0;
        while (segIdx < cumArray.length - 2 && cumArray[segIdx + 1] < targetD) segIdx++;
        const d0 = cumArray[segIdx];
        const d1 = cumArray[segIdx + 1];
        const t = d1 > d0 ? (targetD - d0) / (d1 - d0) : 0;
        const lon = rawPts[segIdx][0] + (rawPts[segIdx + 1][0] - rawPts[segIdx][0]) * t;
        const lat = rawPts[segIdx][1] + (rawPts[segIdx + 1][1] - rawPts[segIdx][1]) * t;
        sampled.push({ lat, lon, dist: targetD, label: `E-${s + 1}` });
      }
      const { elevations, source } = await queryElevations(sampled);
      if (requestId !== elevationRequestRef.current) return;
      setElevSource(source);
      setProfileSamples(sampled.map((item, i) => ({ ...item, z: elevations[i] })));
    } catch (error) {
      if (requestId === elevationRequestRef.current) {
        setElevationError(error instanceof Error ? error.message : 'Não foi possível carregar as elevações.');
      }
    } finally {
      if (requestId === elevationRequestRef.current) setBusy(false);
    }
  };

  const loadPolygonSurfaceGrid = async (density = 7) => {
    if (!activeFeature || activeFeature.geometry.type !== 'Polygon') return;
    const requestId = ++elevationRequestRef.current;
    const ring = openRing(activeFeature.geometry.coordinates[0]);
    setBusy(true);
    setElevationError(null);
    setElevSource(null);
    setGridPoints([]);
    if (ring.length < 3) {
      setElevationError('O polígono precisa ter ao menos três vértices válidos para consultar a elevação.');
      setBusy(false);
      return;
    }
    try {
      const pr = makeProjection(ring[0][0], ring[0][1]);
      const polyXY = ring.map(([lon, lat]) => pr.toXY({ lon, lat }));
      const b = bounds(polyXY);
      const candidates: { lon: number; lat: number; x: number; y: number; id: string }[] = [];
      // Always include polygon vertices
      ring.forEach(([lon, lat], i) => {
        const xy = pr.toXY({ lon, lat });
        candidates.push({ lon, lat, x: xy.x, y: xy.y, id: `V-${String(i + 1).padStart(2, '0')}` });
      });
      // Add interior grid
      const nx = Math.max(3, Math.min(11, density));
      const ny = Math.max(3, Math.min(11, density));
      let count = 1;
      for (let iy = 0; iy <= ny; iy++) {
        for (let ix = 0; ix <= nx; ix++) {
          const x = b.minX + (b.width * ix) / nx;
          const y = b.minY + (b.height * iy) / ny;
          if (pointInPolygonXY({ x, y }, polyXY)) {
            const g = pr.toGeo({ x, y });
            candidates.push({ lon: g.lon, lat: g.lat, x, y, id: `PC-${String(count++).padStart(2, '0')}` });
          }
        }
      }
      const { elevations, source } = await queryElevations(candidates);
      if (requestId !== elevationRequestRef.current) return;
      setElevSource(source);
      const pts = candidates.map((c, i) => ({ ...c, z: elevations[i] }));
      setGridPoints(pts);
      const avg = pts.reduce((acc, p) => acc + p.z, 0) / Math.max(1, pts.length);
      setTargetQuota(Number(avg.toFixed(2)));
    } catch (error) {
      if (requestId === elevationRequestRef.current) {
        setElevationError(error instanceof Error ? error.message : 'Não foi possível carregar as elevações.');
      }
    } finally {
      if (requestId === elevationRequestRef.current) setBusy(false);
    }
  };

  useEffect(() => {
    elevationRequestRef.current += 1;
    setBusy(false);
    setElevSource(null);
    setElevationError(null);
    setProfileSamples([]);
    setGridPoints([]);
    setTargetQuota(0);
    if (!activeFeature) return;
    if (tool === 'profile') {
      void loadProfileData();
    } else if (['cutfill', 'contours', 'spot', 'earth3d'].includes(tool)) {
      void loadPolygonSurfaceGrid(tool === 'spot' ? Math.max(3, Math.min(10, Math.round(12 - spotStep))) : 7);
    }
    return () => { elevationRequestRef.current += 1; };
  }, [tool, activeFeature?.id]);

  // Render 3D canvas when tool === 'earth3d'
  useEffect(() => {
    if (tool !== 'earth3d' || !canvas3dRef.current || !activeFeature || activeFeature.geometry.type !== 'Polygon') return;
    const canvas = canvas3dRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0f172a');
    sky.addColorStop(1, '#1e293b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const ring = openRing(activeFeature.geometry.coordinates[0]);
    if (ring.length < 3) return;
    const pr = makeProjection(ring[0][0], ring[0][1]);
    const polyXY = ring.map(([lon, lat]) => pr.toXY({ lon, lat }));
    const b = bounds(polyXY);
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    const span = Math.max(b.width, b.height, 1);

    const minZ = gridPoints.length ? Math.min(...gridPoints.map(p => p.z)) : 100;
    const maxZ = gridPoints.length ? Math.max(...gridPoints.map(p => p.z)) : 120;
    const midZ = (minZ + maxZ) / 2;

    const radYaw = (yaw * Math.PI) / 180;
    const radPitch = (pitch * Math.PI) / 180;
    const scale = Math.min(w, h) * 0.62 / span;

    const project3D = (x: number, y: number, z: number) => {
      const dx = x - cx;
      const dy = y - cy;
      const dz = (z - midZ) * zExaggeration;
      const rx = dx * Math.cos(radYaw) - dy * Math.sin(radYaw);
      const ry = dx * Math.sin(radYaw) + dy * Math.cos(radYaw);
      const sx = w / 2 + rx * scale;
      const sy = h * 0.56 - (ry * Math.cos(radPitch) + dz) * scale;
      return { x: sx, y: sy };
    };

    // Draw reference base grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
    ctx.lineWidth = 1;
    for (let i = -5; i <= 5; i++) {
      const g1 = project3D(cx + (i * span) / 8, cy - span * 0.65, minZ - 4);
      const g2 = project3D(cx + (i * span) / 8, cy + span * 0.65, minZ - 4);
      ctx.beginPath();
      ctx.moveTo(g1.x, g1.y);
      ctx.lineTo(g2.x, g2.y);
      ctx.stroke();

      const h1 = project3D(cx - span * 0.65, cy + (i * span) / 8, minZ - 4);
      const h2 = project3D(cx + span * 0.65, cy + (i * span) / 8, minZ - 4);
      ctx.beginPath();
      ctx.moveTo(h1.x, h1.y);
      ctx.lineTo(h2.x, h2.y);
      ctx.stroke();
    }

    // Draw TIN surface triangles if gridPoints available
    if (gridPoints.length >= 3) {
      const tris = triangulate(gridPoints);
      for (const [i0, i1, i2] of tris) {
        const p0 = gridPoints[i0];
        const p1 = gridPoints[i1];
        const p2 = gridPoints[i2];
        const avgZ = (p0.z + p1.z + p2.z) / 3;
        const norm = Math.max(0, Math.min(1, (avgZ - minZ) / Math.max(0.5, maxZ - minZ)));
        const s0 = project3D(p0.x, p0.y, p0.z);
        const s1 = project3D(p1.x, p1.y, p1.z);
        const s2 = project3D(p2.x, p2.y, p2.z);
        ctx.beginPath();
        ctx.moveTo(s0.x, s0.y);
        ctx.lineTo(s1.x, s1.y);
        ctx.lineTo(s2.x, s2.y);
        ctx.closePath();
        const r = Math.round(34 + norm * 165);
        const g = Math.round(139 + (1 - Math.abs(norm - 0.5) * 1.4) * 65);
        const bCol = Math.round(95 - norm * 55);
        ctx.fillStyle = `rgba(${r}, ${g}, ${bCol}, 0.52)`;
        ctx.fill();
        ctx.strokeStyle = 'rgba(226, 232, 240, 0.25)';
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
    }

    // Draw extruded parcel walls & top boundary
    const vertexElevs = polyXY.map(pt => (gridPoints.length >= 3 ? idw(gridPoints, pt.x, pt.y, 2) : midZ));
    const topPts = polyXY.map((pt, i) => project3D(pt.x, pt.y, vertexElevs[i]));
    const basePts = polyXY.map(pt => project3D(pt.x, pt.y, minZ - 4));

    const fillHex = String(activeFeature.properties?.fillColor || activeFeature.properties?.lotColor || '#38bdf8');
    // Walls
    for (let i = 0; i < topPts.length; i++) {
      const next = (i + 1) % topPts.length;
      ctx.beginPath();
      ctx.moveTo(basePts[i].x, basePts[i].y);
      ctx.lineTo(basePts[next].x, basePts[next].y);
      ctx.lineTo(topPts[next].x, topPts[next].y);
      ctx.lineTo(topPts[i].x, topPts[i].y);
      ctx.closePath();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Top perimeter
    ctx.beginPath();
    topPts.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.closePath();
    ctx.strokeStyle = fillHex;
    ctx.lineWidth = 2.6;
    ctx.stroke();

    // Vertices and labels
    topPts.forEach((pt, i) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3.8, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      if (topPts.length <= 24 || i % Math.ceil(topPts.length / 12) === 0) {
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 10px Inter, Arial, sans-serif';
        ctx.fillText(`V-${String(i + 1).padStart(2, '0')} (${vertexElevs[i].toFixed(1)}m)`, pt.x + 6, pt.y - 5);
      }
    });
  }, [tool, activeFeature, gridPoints, yaw, pitch, zExaggeration]);

  const cutFillMetrics = useMemo(() => {
    if (!activeFeature || activeFeature.geometry.type !== 'Polygon') {
      return { areaM2: 0, cutM3: 0, fillM3: 0, netM3: 0, minZ: 0, maxZ: 0, avgZ: 0 };
    }
    const ring = openRing(activeFeature.geometry.coordinates[0]);
    if (ring.length < 3) return { areaM2: 0, cutM3: 0, fillM3: 0, netM3: 0, minZ: 0, maxZ: 0, avgZ: 0 };
    const pr = makeProjection(ring[0][0], ring[0][1]);
    const polyXY = ring.map(([lon, lat]) => pr.toXY({ lon, lat }));
    const areaM2 = polygonArea(polyXY);
    if (gridPoints.length < 3) {
      return { areaM2, cutM3: 0, fillM3: 0, netM3: 0, minZ: 0, maxZ: 0, avgZ: 0 };
    }
    const b = bounds(polyXY);
    const nx = 22;
    const ny = 22;
    const cellArea = (b.width / nx) * (b.height / ny);
    let cutM3 = 0;
    let fillM3 = 0;
    let insideCells = 0;
    for (let iy = 0; iy < ny; iy++) {
      for (let ix = 0; ix < nx; ix++) {
        const cx = b.minX + ((ix + 0.5) * b.width) / nx;
        const cy = b.minY + ((iy + 0.5) * b.height) / ny;
        if (!pointInPolygonXY({ x: cx, y: cy }, polyXY)) continue;
        insideCells++;
        const z = idw(gridPoints, cx, cy, 2);
        const diff = z - targetQuota;
        if (diff > 0) cutM3 += diff * cellArea;
        else fillM3 += Math.abs(diff) * cellArea;
      }
    }
    const scaleFactor = insideCells > 0 ? areaM2 / (insideCells * cellArea) : 1;
    cutM3 *= scaleFactor;
    fillM3 *= scaleFactor;
    const zs = gridPoints.map(p => p.z);
    return {
      areaM2,
      cutM3,
      fillM3,
      netM3: cutM3 - fillM3,
      minZ: Math.min(...zs),
      maxZ: Math.max(...zs),
      avgZ: zs.reduce((a, b) => a + b, 0) / zs.length
    };
  }, [activeFeature, gridPoints, targetQuota]);

  const applyFrontBack = () => {
    if (!activeFeature || activeFeature.geometry.type !== 'Polygon') return;
    const n = openCoords.length;
    const sideLabels: Record<SegmentSide, string> = {
      frente: 'Frente (Testada Principal)',
      fundo: 'Fundo',
      direita: 'Lateral Direita',
      esquerda: 'Lateral Esquerda',
      divisa: 'Divisa'
    };
    const nextConfrontants = { ...((activeFeature.properties?.confrontants as Record<string, string>) || {}) };
    const segmentSides: Record<string, SegmentSide> = {};
    sides.forEach((side, i) => {
      segmentSides[String(i)] = side;
      const k = `${Math.min(i, (i + 1) % n)}-${Math.max(i, (i + 1) % n)}`;
      const current = nextConfrontants[k] || '';
      const prefix = `[${sideLabels[side]}]`;
      if (!current.startsWith('[')) {
        nextConfrontants[k] = current ? `${prefix} ${current}` : sideLabels[side];
      } else {
        nextConfrontants[k] = current.replace(/^\[[^\]]+\]\s*/, `${prefix} `);
      }
    });
    onUpdateFeature(String(activeFeature.id), {
      properties: {
        ...activeFeature.properties,
        segmentSides,
        confrontants: nextConfrontants
      }
    });
    notify('Classificação de Frente, Fundo e Laterais aplicada ao perímetro e confrontações.');
    onClose();
  };

  const generateMapContours = () => {
    if (!activeFeature || activeFeature.geometry.type !== 'Polygon' || gridPoints.length < 3) return;
    const ring = openRing(activeFeature.geometry.coordinates[0]);
    const pr = makeProjection(ring[0][0], ring[0][1]);
    const polyXY = ring.map(([lon, lat]) => pr.toXY({ lon, lat }));
    const b = bounds(polyXY);
    const denseGrid: ZPoint[] = [];
    const nx = 18;
    const ny = 18;
    for (let iy = 0; iy <= ny; iy++) {
      for (let ix = 0; ix <= nx; ix++) {
        const x = b.minX + (b.width * ix) / nx;
        const y = b.minY + (b.height * iy) / ny;
        denseGrid.push({ x, y, z: idw(gridPoints, x, y, 2) });
      }
    }
    const tris = triangulate(denseGrid);
    const segments = makeContours(denseGrid, tris, Math.max(0.2, contourSpacing));
    const filtered = segments.filter(seg => {
      const mid = { x: (seg.a.x + seg.b.x) / 2, y: (seg.a.y + seg.b.y) / 2 };
      return pointInPolygonXY(mid, polyXY);
    });
    if (!filtered.length) {
      notify('Nenhuma curva encontrada para o desnível informado. Reduza o espaçamento (ex.: 0.5 m).');
      return;
    }
    const contourLines = stitchContours(filtered);
    const created: MapFeature[] = contourLines.slice(0, 250).map(line => {
      const isMaster = Math.abs((line.level / (contourSpacing * 5)) - Math.round(line.level / (contourSpacing * 5))) < 1e-3;
      return {
        type: 'Feature',
        id: crypto.randomUUID(),
        properties: {
          source: 'surveyor-contour',
          category: 'Curva de nível',
          name: `Curva ${line.level.toFixed(1)} m`,
          elevationM: line.level,
          elevationSource: 'Open-Meteo Elevation API',
          elevationWarning: 'Cota de modelo digital; conferir com levantamento de campo antes de uso executivo.',
          strokeColor: isMaster ? '#92400e' : '#d97706',
          lineWeight: isMaster ? 2.4 : 1.3
        },
        geometry: {
          type: 'LineString',
          coordinates: line.points.map(point => {
            const geo = pr.toGeo(point);
            return [geo.lon, geo.lat];
          })
        }
      };
    });
    onAddFeatures(created);
    notify(`${created.length} linhas de curvas de nível adicionadas ao mapa${contourLines.length > created.length ? `; ${contourLines.length - created.length} omitidas pelo limite. Aumente o intervalo para reduzir a densidade.` : ''}.`);
    onClose();
  };

  const generateSpotPoints = () => {
    if (!gridPoints.length) return;
    const created: MapFeature[] = gridPoints.map((pt, idx) => ({
      type: 'Feature',
      id: crypto.randomUUID(),
      properties: {
        source: 'surveyor-spot',
        category: 'Ponto cotado',
        pointOrigin: 'mapa',
        pointClass: 'P',
        elevationM: pt.z,
        elevationSource: 'Open-Meteo Elevation API',
        elevationWarning: 'Cota de modelo digital; conferir com levantamento de campo antes de uso executivo.',
        name: `${pt.id || `PC-${idx + 1}`} (${pt.z.toFixed(2)}m)`
      },
      geometry: {
        type: 'Point',
        coordinates: [pt.lon, pt.lat, pt.z]
      }
    }));
    onAddFeatures(created);
    notify(`${created.length} pontos cotados com altitude Z inseridos no mapa.`);
    onClose();
  };

  const titles: Record<AdvancedToolKind, { title: string; subtitle: string; icon: ReactNode }> = {
    frontback: { title: 'Frente, Fundo e Laterais do Imóvel', subtitle: 'Classificação técnica das testadas e divisas por trecho perimetral', icon: <PanelRightClose size={19} /> },
    profile: { title: 'Perfil Longitudinal do Terreno', subtitle: 'Amostragem altimétrica contínua, declividade e gráfico vetorial', icon: <Route size={19} /> },
    cutfill: { title: 'Cálculo de Terraplenagem · Corte e Aterro', subtitle: 'Cubagem de volumes em m³ por malha ponderada sobre cota de platô', icon: <Scissors size={19} /> },
    contours: { title: 'Geração de Curvas de Nível no Mapa', subtitle: 'Interpolação altimétrica e traçado direto de isoípsas sobre o polígono', icon: <Layers3 size={19} /> },
    spot: { title: 'Malha de Pontos Cotados (Altimetria)', subtitle: 'Geração de vértices e pontos internos com cota ortométrica aproximada (Z)', icon: <MapPin size={19} /> },
    earth3d: { title: 'Visualização 3D Interativa · Earth 3D', subtitle: 'Perspectiva tridimensional do relevo e extrusão do imóvel rural/urbano', icon: <Globe2 size={19} /> },
    buffer: { title: 'Faixa Paralela / Buffer / Recuo Técnico', subtitle: 'Geração geométrica de faixa de domínio, servidão ou recuo perimetral em metros', icon: <Compass size={19} /> }
  };

  const head = titles[tool];
  const hasElevationData = elevSource === 'open-meteo' && gridPoints.length >= 3;

  return (
    <div className="map-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="map-validation-dialog" role="dialog" aria-modal="true" aria-label={head.title} style={{ width: 'min(840px, 95vw)', maxHeight: '90dvh', display: 'flex', flexDirection: 'column' }}>
        <header className="map-dialog-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {head.icon}
            <div>
              <strong>{head.title}</strong>
              <small style={{ display: 'block' }}>{head.subtitle}</small>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </header>

          <div style={{ padding: '14px 18px', overflowY: 'auto', display: 'grid', gap: 14 }}>
          {busy && <p role="status" style={{ margin: 0, padding: '9px 12px', borderRadius: 8, background: '#eff6ff', color: '#1d4ed8', fontSize: 12 }}>Consultando a fonte de elevação. Os resultados serão liberados quando os dados forem recebidos.</p>}
          {elevationError && <p role="alert" style={{ margin: 0, padding: '9px 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', fontSize: 12 }}>{elevationError}</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'grid', gap: 4, flex: '1 1 260px', fontSize: 12, fontWeight: 600 }}>
              <span>Feição selecionada para o cálculo</span>
              <select
                value={String(activeFeature?.id || '')}
                onChange={e => onSelectFeature(e.target.value)}
                style={{ height: 36, borderRadius: 8, border: '1px solid #cbd5e1', padding: '0 10px' }}
              >
                {(tool === 'profile' ? linesAndPolys : polygons).map((f, i) => (
                  <option key={String(f.id)} value={String(f.id)}>
                    {String(f.properties?.name || `Feição ${i + 1}`)} ({f.geometry.type === 'Polygon' ? 'Polígono' : 'Linha'})
                  </option>
                ))}
              </select>
            </label>
            {elevSource && (
              <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, background: elevSource === 'open-meteo' ? '#dcfce7' : '#fef3c7', color: elevSource === 'open-meteo' ? '#166534' : '#92400e', fontWeight: 600 }}>
                Fonte altimétrica: DEM Open-Meteo (SRTM/Copernicus)
              </span>
            )}
          </div>

          {!activeFeature ? (
            <p style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
              Desenhe ou selecione primeiro um polígono no mapa para usar esta ferramenta.
            </p>
          ) : (
            <>
              {tool === 'frontback' && (
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <small style={{ color: '#475569' }}>Defina a posição de cada segmento (Frente/Testada, Fundo, Direita ou Esquerda) ou use a detecção automática por orientação solar/azimutal.</small>
                    <button type="button" className="button" onClick={() => setSides(autoClassifySides(openCoords))}>
                      <Sparkles size={14} /> Auto-classificar por azimute
                    </button>
                  </div>
                  <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                    <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                          <th style={{ padding: 8 }}>Trecho</th>
                          <th style={{ padding: 8 }}>Distância (m)</th>
                          <th style={{ padding: 8 }}>Classificação da Testada / Divisa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {openCoords.map((pt, i) => {
                          const next = openCoords[(i + 1) % openCoords.length];
                          const dist = haversine([pt[1], pt[0]], [next[1], next[0]]);
                          return (
                            <tr key={i} style={{ borderTop: '1px solid #e2e8f0' }}>
                              <td style={{ padding: 8, fontWeight: 700 }}>V-{String(i + 1).padStart(2, '0')} → V-{String(((i + 1) % openCoords.length) + 1).padStart(2, '0')}</td>
                              <td style={{ padding: 8 }}>{dist.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m</td>
                              <td style={{ padding: 8 }}>
                                <select
                                  value={sides[i] || 'divisa'}
                                  onChange={e => {
                                    const nextSides = [...sides];
                                    nextSides[i] = e.target.value as SegmentSide;
                                    setSides(nextSides);
                                  }}
                                  style={{ height: 30, borderRadius: 6, border: '1px solid #cbd5e1', padding: '0 8px', width: '100%' }}
                                >
                                  <option value="frente">Frente (Testada Principal)</option>
                                  <option value="fundo">Fundo</option>
                                  <option value="direita">Lateral Direita</option>
                                  <option value="esquerda">Lateral Esquerda</option>
                                  <option value="divisa">Divisa Geral</option>
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button type="button" className="button" onClick={onClose}>Cancelar</button>
                    <button type="button" className="button primary" onClick={applyFrontBack}>Aplicar Frente / Fundo ao Imóvel</button>
                  </div>
                </div>
              )}

              {tool === 'buffer' && (
                <div style={{ display: 'grid', gap: 12 }}>
                  <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600 }}>
                    <span>Distância da faixa paralela / recuo (em metros — positivo para expandir, negativo para recuo interno)</span>
                    <input
                      type="number"
                      step="1"
                      value={bufferMeters}
                      onChange={e => setBufferMeters(Number(e.target.value) || 0)}
                      style={{ height: 38, borderRadius: 8, border: '1px solid #cbd5e1', padding: '0 10px' }}
                    />
                  </label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[-30, -15, -5, 5, 15, 30, 50].map(val => (
                      <button key={val} type="button" className="button" onClick={() => setBufferMeters(val)}>
                        {val > 0 ? `+${val} m (Externo)` : `${val} m (Recuo interno)`}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button type="button" className="button" onClick={onClose}>Cancelar</button>
                    <button
                      type="button"
                      className="button primary"
                      onClick={() => {
                        const created = buildBufferPolygon(activeFeature, bufferMeters);
                        if (!created) {
                          notify('Informe uma distância válida em metros.');
                          return;
                        }
                        onAddFeatures([created]);
                        notify(`Faixa paralela (${bufferMeters} m) gerada no mapa.`);
                        onClose();
                      }}
                    >
                      Gerar Polígono de Buffer no Mapa
                    </button>
                  </div>
                </div>
              )}

              {tool === 'profile' && (
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600 }}>
                      Estacas de amostragem:
                      <input type="number" min={8} max={80} value={sampleCount} onChange={e => setSampleCount(Number(e.target.value) || 24)} style={{ width: 70, height: 32, borderRadius: 6, border: '1px solid #cbd5e1', padding: '0 8px' }} />
                    </label>
                    <button type="button" className="button" disabled={busy} onClick={() => void loadProfileData()}>
                      <RefreshCw size={14} /> {busy ? 'Calculando...' : 'Recalcular perfil'}
                    </button>
                  </div>

                  {profileSamples.length >= 2 && (() => {
                    const minZ = Math.min(...profileSamples.map(p => p.z));
                    const maxZ = Math.max(...profileSamples.map(p => p.z));
                    const maxD = Math.max(1, profileSamples[profileSamples.length - 1].dist);
                    const spanZ = Math.max(1, maxZ - minZ);
                    const w = 720;
                    const h = 230;
                    const padL = 54, padR = 20, padT = 24, padB = 34;
                    const plotW = w - padL - padR;
                    const plotH = h - padT - padB;
                    const pts = profileSamples.map(p => ({
                      x: padL + (p.dist / maxD) * plotW,
                      y: padT + plotH - ((p.z - minZ) / spanZ) * plotH
                    }));
                    const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
                    const areaD = `${pathD} L${pts[pts.length - 1].x.toFixed(1)},${(padT + plotH).toFixed(1)} L${pts[0].x.toFixed(1)},${(padT + plotH).toFixed(1)} Z`;
                    const avgSlope = profileSamples.slice(1).reduce((acc, cur, idx) => {
                      const prev = profileSamples[idx];
                      const dd = Math.max(0.1, cur.dist - prev.dist);
                      return acc + (Math.abs(cur.z - prev.z) / dd) * 100;
                    }, 0) / Math.max(1, profileSamples.length - 1);

                    return (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: 8 }}>
                          <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}><small style={{ display: 'block', color: '#64748b', fontSize: 11 }}>Extensão Total</small><strong>{maxD.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m</strong></div>
                          <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}><small style={{ display: 'block', color: '#64748b', fontSize: 11 }}>Cota Mín / Máx</small><strong>{minZ.toFixed(1)}m / {maxZ.toFixed(1)}m</strong></div>
                          <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}><small style={{ display: 'block', color: '#64748b', fontSize: 11 }}>Desnível Total</small><strong>{(maxZ - minZ).toFixed(2)} m</strong></div>
                          <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}><small style={{ display: 'block', color: '#64748b', fontSize: 11 }}>Declividade Média</small><strong>{avgSlope.toFixed(2)} %</strong></div>
                        </div>
                        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 10 }}>
                          {[0, 0.25, 0.5, 0.75, 1].map((t, idx) => {
                            const y = padT + plotH * (1 - t);
                            const val = minZ + spanZ * t;
                            return (
                              <g key={idx}>
                                <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
                                <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#475569">{val.toFixed(1)}m</text>
                              </g>
                            );
                          })}
                          <path d={areaD} fill="rgba(14, 165, 233, 0.18)" />
                          <path d={pathD} fill="none" stroke="#0284c7" strokeWidth="2.5" />
                          {pts.map((pt, i) => (
                            <circle key={i} cx={pt.x} cy={pt.y} r="3" fill="#0369a1" />
                          ))}
                          <text x={padL} y={h - 10} fontSize="10" fill="#475569">0 m</text>
                          <text x={w / 2} y={h - 10} textAnchor="middle" fontSize="10" fill="#475569">{(maxD / 2).toFixed(1)} m</text>
                          <text x={w - padR} y={h - 10} textAnchor="end" fontSize="10" fill="#475569">{maxD.toFixed(1)} m</text>
                        </svg>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                          <button
                            type="button"
                            className="button"
                            onClick={() => {
                              const csv = '\ufeffFonteAltimetrica;Open-Meteo Elevation API\r\nAviso;Cotas de modelo digital; conferir com levantamento de campo antes de uso executivo.\r\nEstaca;Distancia_m;Altitude_m;Latitude;Longitude\r\n' +
                                profileSamples.map(s => `${s.label};${s.dist.toFixed(2)};${s.z.toFixed(2)};${s.lat.toFixed(7)};${s.lon.toFixed(7)}`).join('\r\n');
                              downloadText('perfil-longitudinal.csv', csv, 'text/csv;charset=utf-8');
                            }}
                          >
                            <Download size={14} /> Baixar Tabela CSV do Perfil
                          </button>
                        </div>
                      </>
                    );
                  })()}
                  {profileSamples.length < 2 && <p role="status" style={{ margin: 0, padding: 12, borderRadius: 8, background: '#f8fafc', color: '#475569', fontSize: 12 }}>{busy ? 'Aguardando as elevações da fonte selecionada…' : 'O perfil aparecerá depois que as elevações forem carregadas.'}</p>}
                </div>
              )}

              {tool === 'cutfill' && (
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                    <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 600 }}>
                      <span>Cota do platô de projeto (m)</span>
                      <input
                        type="number"
                        step="0.25"
                        value={targetQuota}
                        onChange={e => setTargetQuota(Number(e.target.value) || 0)}
                        style={{ height: 36, borderRadius: 8, border: '1px solid #cbd5e1', padding: '0 10px', width: 160 }}
                      />
                    </label>
                    <button type="button" className="button" disabled={!hasElevationData} onClick={() => setTargetQuota(Number(cutFillMetrics.avgZ.toFixed(2)))}>
                      Usar cota de compensação ({hasElevationData ? `${cutFillMetrics.avgZ.toFixed(2)} m` : '—'})
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: 10 }}>
                    <div style={{ background: '#fef2f2', padding: 12, borderRadius: 10, border: '1px solid #fecaca' }}>
                      <small style={{ color: '#991b1b', fontWeight: 700, fontSize: 11 }}>VOLUME DE CORTE</small>
                      <strong style={{ display: 'block', fontSize: 18, color: '#dc2626', marginTop: 4 }}>
                        {hasElevationData ? `${cutFillMetrics.cutM3.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m³` : '—'}
                      </strong>
                    </div>
                    <div style={{ background: '#eff6ff', padding: 12, borderRadius: 10, border: '1px solid #bfdbfe' }}>
                      <small style={{ color: '#1e40af', fontWeight: 700, fontSize: 11 }}>VOLUME DE ATERRO</small>
                      <strong style={{ display: 'block', fontSize: 18, color: '#2563eb', marginTop: 4 }}>
                        {hasElevationData ? `${cutFillMetrics.fillM3.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m³` : '—'}
                      </strong>
                    </div>
                    <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10, border: '1px solid #cbd5e1' }}>
                      <small style={{ color: '#334155', fontWeight: 700, fontSize: 11 }}>SALDO LÍQUIDO (Bota-fora/Empréstimo)</small>
                      <strong style={{ display: 'block', fontSize: 18, color: '#0f172a', marginTop: 4 }}>
                        {hasElevationData ? `${cutFillMetrics.netM3 >= 0 ? '+' : ''}${cutFillMetrics.netM3.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m³` : '—'}
                      </strong>
                    </div>
                    <div style={{ background: '#f0fdf4', padding: 12, borderRadius: 10, border: '1px solid #bbf7d0' }}>
                      <small style={{ color: '#166534', fontWeight: 700, fontSize: 11 }}>ÁREA DO POLÍGONO</small>
                      <strong style={{ display: 'block', fontSize: 18, color: '#15803d', marginTop: 4 }}>
                        {(cutFillMetrics.areaM2 / 10000).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} ha
                      </strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button
                      type="button"
                      className="button"
                      disabled={busy || !hasElevationData}
                      onClick={() => {
                        const report = [
                          `MEMÓRIA PRELIMINAR DE CORTE E ATERRO — SURVEYOR`,
                          `Imóvel / Gleba: ${String(activeFeature.properties?.name || 'Polígono')}`,
                          `Área projetada: ${(cutFillMetrics.areaM2 / 10000).toFixed(4)} ha (${cutFillMetrics.areaM2.toFixed(2)} m²)`,
                          `Fonte altimétrica: Open-Meteo Elevation API (modelo digital; conferir em campo antes de uso executivo)`,
                          `Cota mínima: ${cutFillMetrics.minZ.toFixed(2)} m | Cota máxima: ${cutFillMetrics.maxZ.toFixed(2)} m | Cota média: ${cutFillMetrics.avgZ.toFixed(2)} m`,
                          `Cota de projeto (platô): ${targetQuota.toFixed(2)} m`,
                          `Volume estimado de Corte: ${cutFillMetrics.cutM3.toFixed(2)} m³`,
                          `Volume estimado de Aterro: ${cutFillMetrics.fillM3.toFixed(2)} m³`,
                          `Balanço líquido: ${cutFillMetrics.netM3.toFixed(2)} m³`
                        ].join('\r\n');
                        downloadText('relatorio-corte-aterro.txt', report, 'text/plain;charset=utf-8');
                      }}
                    >
                      <Download size={14} /> Exportar Memória de Cálculo (.txt)
                    </button>
                  </div>
                </div>
              )}

              {tool === 'contours' && (
                <div style={{ display: 'grid', gap: 12 }}>
                  <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600 }}>
                    <span>Eqüidistância vertical entre curvas de nível (metros)</span>
                    <input
                      type="number"
                      min="0.2"
                      max="50"
                      step="0.5"
                      value={contourSpacing}
                      onChange={e => setContourSpacing(Math.max(0.2, Number(e.target.value) || 1))}
                      style={{ height: 38, borderRadius: 8, border: '1px solid #cbd5e1', padding: '0 10px' }}
                    />
                  </label>
                  <p style={{ margin: 0, fontSize: 12, color: '#475569' }}>
                    Cota mínima amostrada: <b>{hasElevationData ? `${cutFillMetrics.minZ.toFixed(2)} m` : '—'}</b> · Cota máxima: <b>{hasElevationData ? `${cutFillMetrics.maxZ.toFixed(2)} m` : '—'}</b> · Desnível: <b>{hasElevationData ? `${(cutFillMetrics.maxZ - cutFillMetrics.minZ).toFixed(2)} m` : '—'}</b>.
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button type="button" className="button" onClick={onClose}>Cancelar</button>
                    <button type="button" className="button primary" disabled={busy || !hasElevationData} onClick={generateMapContours}>
                      <Layers3 size={15} /> Inserir Curvas de Nível no Mapa
                    </button>
                  </div>
                </div>
              )}

              {tool === 'spot' && (
                <div style={{ display: 'grid', gap: 12 }}>
                  <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600 }}>
                    <span>Densidade da malha de pontos cotados</span>
                    <select
                      value={spotStep}
                      onChange={e => {
                        const v = Number(e.target.value);
                        setSpotStep(v);
                        void loadPolygonSurfaceGrid(Math.max(3, Math.min(10, Math.round(12 - v))));
                      }}
                      style={{ height: 38, borderRadius: 8, border: '1px solid #cbd5e1', padding: '0 10px' }}
                    >
                      <option value={8}>Esparsa (Vértices + malha ampla)</option>
                      <option value={5}>Média (Padrão topográfico)</option>
                      <option value={3}>Densa (Malha detalhada)</option>
                    </select>
                  </label>
                  <p style={{ margin: 0, fontSize: 12, color: '#475569' }}>
                    {hasElevationData ? <>Total pronto para inserção: <b>{gridPoints.length} pontos cotados</b> com altitude Z entre <b>{cutFillMetrics.minZ.toFixed(2)} m</b> e <b>{cutFillMetrics.maxZ.toFixed(2)} m</b>.</> : busy ? 'Consultando elevações reais…' : 'Pontos cotados indisponíveis sem dados altimétricos reais.'}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button type="button" className="button" onClick={onClose}>Cancelar</button>
                    <button type="button" className="button primary" disabled={busy || !hasElevationData} onClick={generateSpotPoints}>
                      <MapPin size={15} /> Gerar {gridPoints.length} Pontos Cotados no Mapa
                    </button>
                  </div>
                </div>
              )}

              {tool === 'earth3d' && (
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>
                      Rotação Horizontal ({yaw}°)
                      <input type="range" min={0} max={360} value={yaw} disabled={!hasElevationData} onChange={e => setYaw(Number(e.target.value))} style={{ width: '100%' }} />
                    </label>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>
                      Inclinação / Pitch ({pitch}°)
                      <input type="range" min={15} max={85} value={pitch} disabled={!hasElevationData} onChange={e => setPitch(Number(e.target.value))} style={{ width: '100%' }} />
                    </label>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>
                      Exagero Vertical ({zExaggeration.toFixed(1)}x)
                      <input type="range" min={1} max={8} step={0.5} value={zExaggeration} disabled={!hasElevationData} onChange={e => setZExaggeration(Number(e.target.value))} style={{ width: '100%' }} />
                    </label>
                  </div>
                  {hasElevationData ? <canvas
                    ref={canvas3dRef}
                    width={760}
                    height={360}
                    aria-label="Visualização tridimensional do relevo. Arraste para orbitar."
                    style={{ width: '100%', height: 'auto', borderRadius: 12, border: '1px solid #334155', cursor: 'grab', touchAction: 'none' }}
                    onPointerDown={e => {
                      orbitPointerRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
                      e.currentTarget.setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={e => {
                      const pointer = orbitPointerRef.current;
                      if (!pointer || pointer.id !== e.pointerId) return;
                      const dx = e.clientX - pointer.x;
                      const dy = e.clientY - pointer.y;
                      pointer.x = e.clientX;
                      pointer.y = e.clientY;
                      setYaw(y => (y + dx + 360) % 360);
                      setPitch(p => Math.max(15, Math.min(85, p - dy * 0.5)));
                    }}
                    onPointerUp={e => {
                      if (orbitPointerRef.current?.id === e.pointerId) orbitPointerRef.current = null;
                      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
                    }}
                    onPointerCancel={e => {
                      if (orbitPointerRef.current?.id === e.pointerId) orbitPointerRef.current = null;
                      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
                    }}
                  /> : <p role="status" style={{ margin: 0, minHeight: 160, display: 'grid', placeItems: 'center', borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontSize: 12 }}>{busy ? 'Aguardando dados de elevação para montar o relevo…' : 'A visualização do relevo requer elevações reais disponíveis.'}</p>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <small style={{ color: '#475569' }}>Arraste o mouse sobre a tela 3D para orbitar o bloco-diagrama do imóvel.</small>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="button"
                        onClick={() => {
                          downloadText('imovel-3d.kml', toKml([activeFeature]), 'application/vnd.google-earth.kml+xml');
                        }}
                      >
                        <Download size={14} /> Baixar KML para Google Earth
                      </button>
                      <button
                        type="button"
                        className="button primary"
                        onClick={() => {
                          const ring = activeFeature.geometry.type === 'Polygon' ? openRing(activeFeature.geometry.coordinates[0]) : [];
                          const [lon, lat] = ring[0] || [-41.5, -12.9];
                          window.open(`https://earth.google.com/web/@${lat.toFixed(6)},${lon.toFixed(6)},400a,1200d,35y,0h,60t,0r`, '_blank', 'noopener');
                        }}
                      >
                        <Mountain size={14} /> Abrir Coordenada no Google Earth Web
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
