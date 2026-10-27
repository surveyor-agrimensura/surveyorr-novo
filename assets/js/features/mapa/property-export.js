(() => {
  'use strict';

  function create(deps = {}) {
    const { registryProperty, propertyNameAliases, formatWmsPropertyLabel, formatWmsPropertyValue } = deps;
    const CEFIR_PROPERTY_NAME_ALIASES = propertyNameAliases || [];

    function ruralPropertyDownloadSlug(value) {
    return String(value || 'imovel-rural')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 72) || 'imovel-rural';
  }

    function ruralPropertyScalar(properties, aliases = []) {
    const hit = registryProperty(properties || {}, aliases);
    const value = hit?.value;
    if (value === undefined || value === null || String(value).trim() === '') return '';
    return String(value).trim();
  }

    function ruralPropertyGeometryAreaHa(feature) {
    try {
      const value = Number(window.turf?.area?.(feature));
      if (Number.isFinite(value) && value >= 0) return value / 10000;
    } catch {}
    return null;
  }

    function ruralPropertyGeometryRings(feature) {
    const geometry = feature?.geometry || {};
    const polygons = geometry.type === 'Polygon'
      ? [geometry.coordinates || []]
      : geometry.type === 'MultiPolygon'
        ? (geometry.coordinates || [])
        : [];
    const rings = [];
    polygons.forEach((polygon, polygonIndex) => {
      (polygon || []).forEach((ring, ringIndex) => {
        const coords = (ring || []).map((coord) => [Number(coord?.[0]), Number(coord?.[1])]).filter((coord) => coord.every(Number.isFinite));
        if (coords.length >= 3) rings.push({ polygonIndex, ringIndex, coords });
      });
    });
    return rings;
  }

    function ruralPropertyFeatureCollection(context) {
    if (!context?.feature?.geometry) return null;
    return {
      type: 'FeatureCollection',
      properties: {
        source: context.sourceLabel || '',
        exportedAt: new Date().toISOString()
      },
      features: [{
        type: 'Feature',
        id: context.feature.id || undefined,
        properties: { ...(context.properties || context.feature.properties || {}) },
        geometry: JSON.parse(JSON.stringify(context.feature.geometry))
      }]
    };
  }

    function ruralPropertyKml(context) {
    const feature = ruralPropertyFeatureCollection(context)?.features?.[0];
    if (!feature) return '';
    const esc = (value) => String(value || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const name = context.name || ruralPropertyScalar(feature.properties, CEFIR_PROPERTY_NAME_ALIASES) || 'Imóvel rural';
    const polygonXml = (polygon) => {
      if (!Array.isArray(polygon?.[0])) return '';
      const ringXml = (ring) => (ring || []).map((coord) => `${Number(coord[0])},${Number(coord[1])},0`).join(' ');
      const outer = `<outerBoundaryIs><LinearRing><coordinates>${ringXml(polygon[0])}</coordinates></LinearRing></outerBoundaryIs>`;
      const inners = polygon.slice(1).map((ring) => `<innerBoundaryIs><LinearRing><coordinates>${ringXml(ring)}</coordinates></LinearRing></innerBoundaryIs>`).join('');
      return `<Polygon>${outer}${inners}</Polygon>`;
    };
    const geometry = feature.geometry || {};
    let body = '';
    if (geometry.type === 'Polygon') body = polygonXml(geometry.coordinates || []);
    else if (geometry.type === 'MultiPolygon') body = `<MultiGeometry>${(geometry.coordinates || []).map(polygonXml).join('')}</MultiGeometry>`;
    return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(name)}</name><Placemark><name>${esc(name)}</name>${body}</Placemark></Document></kml>`;
  }

    function ruralPropertyWkt(feature) {
    const fmtRing = (ring) => `(${(ring || []).map((coord) => `${Number(coord[0])} ${Number(coord[1])}`).join(', ')})`;
    const geometry = feature?.geometry || {};
    if (geometry.type === 'Polygon') return `POLYGON(${(geometry.coordinates || []).map(fmtRing).join(', ')})`;
    if (geometry.type === 'MultiPolygon') return `MULTIPOLYGON(${(geometry.coordinates || []).map((polygon) => `(${(polygon || []).map(fmtRing).join(', ')})`).join(', ')})`;
    return '';
  }

    function ruralPropertyVerticesCsv(feature) {
    const rows = ['poligono;anel;vertice;latitude;longitude'];
    ruralPropertyGeometryRings(feature).forEach(({ polygonIndex, ringIndex, coords }) => {
      coords.forEach((coord, index) => rows.push(`${polygonIndex + 1};${ringIndex + 1};${index + 1};${coord[1].toFixed(8)};${coord[0].toFixed(8)}`));
    });
    return `\uFEFF${rows.join('\r\n')}`;
  }

    function dxfProjectionForCoordinates(coords = []) {
    const valid = coords.filter((coord) => Array.isArray(coord) && Number.isFinite(Number(coord[0])) && Number.isFinite(Number(coord[1])));
    if (!valid.length) return null;
    if (!window.GeoRuralCRS?.projectToSirgasUtm) throw new Error('Módulo CRS indisponível para exportação DXF georreferenciada.');
    const centerLng = valid.reduce((sum, coord) => sum + Number(coord[0]), 0) / valid.length;
    const centerLat = valid.reduce((sum, coord) => sum + Number(coord[1]), 0) / valid.length;
    const reference = window.GeoRuralCRS.projectToSirgasUtm(centerLng, centerLat);
    return {
      ...reference,
      project(coord) {
        const projected = window.GeoRuralCRS.projectToSirgasUtm(Number(coord[0]), Number(coord[1]), reference.epsg);
        return [projected.easting, projected.northing];
      }
    };
  }

    function surveyorDxf(features = [], options = {}) {
    const source = Array.isArray(features) ? features : [];
    const allCoords = [];
    source.forEach((feature) => {
      const geometry = feature?.geometry || {};
      if (geometry.type === 'Polygon') (geometry.coordinates || []).flat().forEach((coord) => allCoords.push(coord));
      else if (geometry.type === 'MultiPolygon') (geometry.coordinates || []).flat(2).forEach((coord) => allCoords.push(coord));
      else if (geometry.type === 'LineString') (geometry.coordinates || []).forEach((coord) => allCoords.push(coord));
      else if (geometry.type === 'MultiLineString') (geometry.coordinates || []).flat().forEach((coord) => allCoords.push(coord));
      else if (geometry.type === 'Point' && geometry.coordinates) allCoords.push(geometry.coordinates);
    });
    const rows = Array.isArray(options.rows) ? options.rows : [];
    if (!allCoords.length) rows.forEach((row) => allCoords.push([Number(row.lng), Number(row.lat)]));
    const projection = dxfProjectionForCoordinates(allCoords);
    if (!projection) return '';

    const entities = [];
    const same = (a, b) => Array.isArray(a) && Array.isArray(b)
      && Math.abs(Number(a[0]) - Number(b[0])) <= 1e-12
      && Math.abs(Number(a[1]) - Number(b[1])) <= 1e-12;
    const line = (x1, y1, x2, y2, layer = 'SURVEYOR') => entities.push(`0\nLINE\n8\n${layer}\n10\n${x1.toFixed(4)}\n20\n${y1.toFixed(4)}\n30\n0\n11\n${x2.toFixed(4)}\n21\n${y2.toFixed(4)}\n31\n0`);
    const polyline = (coords, layer, closed = false) => {
      const clean = closed && coords.length > 1 && same(coords[0], coords[coords.length - 1]) ? coords.slice(0, -1) : coords.slice();
      const converted = clean.map(projection.project);
      if (converted.length < 2) return;
      const vertices = converted.map(([x, y]) => `10\n${x.toFixed(4)}\n20\n${y.toFixed(4)}`).join('\n');
      entities.push(`0\nLWPOLYLINE\n8\n${layer}\n90\n${converted.length}\n70\n${closed ? 1 : 0}\n${vertices}`);
    };

    source.forEach((feature, featureIndex) => {
      const geometry = feature?.geometry || {};
      if (geometry.type === 'Polygon') {
        (geometry.coordinates || []).forEach((ring, ringIndex) => polyline(ring || [], `POLIGONO_${featureIndex + 1}_${ringIndex + 1}`, true));
      } else if (geometry.type === 'MultiPolygon') {
        (geometry.coordinates || []).forEach((polygon, polygonIndex) => (polygon || []).forEach((ring, ringIndex) => polyline(ring || [], `POLIGONO_${featureIndex + 1}_${polygonIndex + 1}_${ringIndex + 1}`, true)));
      } else if (geometry.type === 'LineString') {
        polyline(geometry.coordinates || [], `LINHA_${featureIndex + 1}`, false);
      } else if (geometry.type === 'MultiLineString') {
        (geometry.coordinates || []).forEach((lineCoords, lineIndex) => polyline(lineCoords || [], `LINHA_${featureIndex + 1}_${lineIndex + 1}`, false));
      } else if (geometry.type === 'Point' && Array.isArray(geometry.coordinates)) {
        const [x, y] = projection.project(geometry.coordinates);
        line(x - 1, y, x + 1, y, `PONTO_${featureIndex + 1}`);
        line(x, y - 1, x, y + 1, `PONTO_${featureIndex + 1}`);
      }
    });

    const gridSpacing = Number(options.gridSpacing || 0);
    if (gridSpacing > 0 && rows.length) {
      const projectedRows = rows
        .filter((row) => Number.isFinite(Number(row.lng)) && Number.isFinite(Number(row.lat)))
        .map((row) => projection.project([Number(row.lng), Number(row.lat)]));
      if (projectedRows.length) {
        const xs = projectedRows.map((point) => point[0]);
        const ys = projectedRows.map((point) => point[1]);
        const minX = Math.floor(Math.min(...xs) / gridSpacing) * gridSpacing - gridSpacing;
        const maxX = Math.ceil(Math.max(...xs) / gridSpacing) * gridSpacing + gridSpacing;
        const minY = Math.floor(Math.min(...ys) / gridSpacing) * gridSpacing - gridSpacing;
        const maxY = Math.ceil(Math.max(...ys) / gridSpacing) * gridSpacing + gridSpacing;
        for (let x = minX; x <= maxX; x += gridSpacing) line(x, minY, x, maxY, `GRADE_${gridSpacing}M`);
        for (let y = minY; y <= maxY; y += gridSpacing) line(minX, y, maxX, y, `GRADE_${gridSpacing}M`);
      }
    }

    return `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n9\n$INSUNITS\n70\n6\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n999\nSURVEYOR - ${projection.epsg} SIRGAS 2000 / UTM zona ${projection.zone}S\n${entities.join('\n')}\n0\nENDSEC\n0\nEOF`;
  }

    function ruralPropertyDxf(feature) {
    return surveyorDxf(feature ? [feature] : []);
  }

    function ruralPropertyInformationText(context) {
    const properties = context?.properties || context?.feature?.properties || {};
    const feature = context?.feature || null;
    const name = context?.name || ruralPropertyScalar(properties, CEFIR_PROPERTY_NAME_ALIASES) || 'Não informado';
    const car = ruralPropertyScalar(properties, ['numero_car','num_sicar','numero_sicar','registro_car','cod_car','cod_imovel','codigo_imovel','codigoimovel','car']);
    const municipality = ruralPropertyScalar(properties, ['municipio','nom_munici','nome_municipio','municipio_nome','nommun']);
    const uf = ruralPropertyScalar(properties, ['uf','sigla_uf','estado']) || String(context?.stateCode || '').toUpperCase();
    const informedArea = ruralPropertyScalar(properties, ['area_regis','area_registrada','area','num_area','area_ha','areahectares','area_hectares']);
    const calculatedArea = ruralPropertyGeometryAreaHa(feature);
    const cityCode = ruralPropertyScalar(properties, ['cod_municipio_ibge','cod_munici','cod_municipio','codigo_municipio','codmun','geocodigo']);
    const created = ruralPropertyScalar(properties, ['data_criacao','dt_criacao','datacriacao','data_cadastro','dt_cadastro']);
    const updated = ruralPropertyScalar(properties, ['data_atualizacao','dt_atualizacao','dataalteracao','dt_alteracao','data_modificacao']);
    const idValue = ruralPropertyScalar(properties, ['ide_imovel','id_imovel','objectid','fid','id']);
    const sigef = ruralPropertyScalar(properties, ['sigef','codigo_parcela','parcela_codigo','parcelacodigo','certificac','certif']);
    const project = context?.project || {};
    const projectName = project.propertyName || project.name || '';
    const projectOwner = window.GeoRuralProjects?.ownerNames?.(project) || project.ownerName || '';
    const projectMunicipality = project.municipality || '';
    const projectUf = String(project.stateCode || '').toUpperCase();
    const lines = [
      'SURVEYOR — DOSSIÊ DO IMÓVEL RURAL',
      '==================================',
      '',
      'SISTEMA E PROJETO',
      '-----------------',
      'Sistema: SURVEYOR — Georreferenciamento e Agrimensura',
      'Módulo: Mapa e Cadastro',
      `Projeto: ${projectName || 'Não informado'}`,
      `ID do projeto: ${project.id || 'Não informado'}`,
      `Proprietário/possuidor do projeto: ${projectOwner || 'Não informado'}`,
      `Município/UF do projeto: ${projectMunicipality || 'Não informado'}${projectUf ? `/${projectUf}` : ''}`,
      `Descrição do projeto: ${project.description || 'Não informada'}`,
      '',
      'IMÓVEL CONSULTADO',
      '-----------------',
      `Nome do imóvel: ${name}`,
      `Número CAR: ${car || 'Não informado'}`,
      `Área informada: ${informedArea ? `${informedArea} ha` : 'Não informada'}`,
      `Área calculada pela geometria: ${Number.isFinite(calculatedArea) ? `${calculatedArea.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 6 })} ha` : 'Não calculada'}`,
      `Município: ${municipality || 'Não informado'}`,
      `UF: ${uf || 'Não informada'}`,
      `Código do município: ${cityCode || 'Não informado'}`,
      `Código/ID do imóvel: ${idValue || 'Não informado'}`,
      `SIGEF / parcela / certificação: ${sigef || 'Não informado'}`,
      `Data de criação/cadastro: ${created || 'Não informada'}`,
      `Data de atualização: ${updated || 'Não informada'}`,
      `Fonte da geometria: ${context?.sourceLabel || 'Camada oficial de Limites de Propriedade'}`,
      `Coordenada consultada: ${context?.latlng ? `${Number(context.latlng.lat).toFixed(8)}, ${Number(context.latlng.lng).toFixed(8)}` : 'Não informada'}`,
      `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
      '',
      'ATRIBUTOS OFICIAIS DISPONÍVEIS',
      '--------------------------------'
    ];
    Object.entries(properties)
      .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '' && typeof value !== 'object')
      .sort(([a], [b]) => String(a).localeCompare(String(b), 'pt-BR'))
      .forEach(([key, value]) => lines.push(`${formatWmsPropertyLabel(key)}: ${formatWmsPropertyValue(key, value)}`));
    return `\uFEFF${lines.join('\r\n')}`;
  }


    return Object.freeze({ ruralPropertyDownloadSlug, ruralPropertyScalar, ruralPropertyGeometryAreaHa, ruralPropertyGeometryRings, ruralPropertyFeatureCollection, ruralPropertyKml, ruralPropertyWkt, ruralPropertyVerticesCsv, surveyorDxf, ruralPropertyDxf, ruralPropertyInformationText });
  }

  window.SurveyorPropertyExport = Object.freeze({ create });
})();
