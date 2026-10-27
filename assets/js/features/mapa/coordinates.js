(() => {
  'use strict';

  function normalizeLocalizedNumber(value, { projected = false } = {}) {
    let text = String(value ?? '').trim().replace(/\s+/g, '');
    if (!text) return NaN;
    const sign = /^[+-]/.test(text) ? text[0] : '';
    if (sign) text = text.slice(1);
    if (!/^\d+(?:[.,]\d+)*$/.test(text)) return NaN;

    const commaCount = (text.match(/,/g) || []).length;
    const dotCount = (text.match(/\./g) || []).length;

    // Regra oficial do SURVEYOR: vírgula isolada é decimal. Nunca transformar
    // 500,250 em 500250. Milhar só é reconhecido quando a notação é inequívoca.
    if (commaCount && dotCount) {
      const decimalSep = text.lastIndexOf(',') > text.lastIndexOf('.') ? ',' : '.';
      const thousandsSep = decimalSep === ',' ? '.' : ',';
      text = text.split(thousandsSep).join('');
      const last = text.lastIndexOf(decimalSep);
      text = `${text.slice(0, last).split(decimalSep).join('')}.${text.slice(last + 1)}`;
    } else if (commaCount === 1) {
      text = text.replace(',', '.');
    } else if (commaCount > 1) {
      const parts = text.split(',');
      if (parts.slice(1).every((part) => part.length === 3)) text = parts.join('');
      else return NaN;
    } else if (dotCount > 1) {
      const parts = text.split('.');
      if (parts.slice(1).every((part) => part.length === 3)) text = parts.join('');
      else {
        const decimal = parts.pop();
        text = `${parts.join('')}.${decimal}`;
      }
    }

    const parsed = Number(`${sign}${text}`);
    if (!Number.isFinite(parsed)) return NaN;
    if (projected && Math.abs(parsed) > 1e9) return NaN;
    return parsed;
  }

  function parseFlexibleNumber(value) {
    return normalizeLocalizedNumber(value, { projected: false });
  }

  function parseProjectedNumber(value) {
    return normalizeLocalizedNumber(value, { projected: true });
  }

  function dmsPartToDecimal(degrees, minutes, seconds, hemisphere) {
    const d = Math.abs(parseFlexibleNumber(degrees));
    const m = minutes == null || minutes === '' ? 0 : Math.abs(parseFlexibleNumber(minutes));
    const s = seconds == null || seconds === '' ? 0 : Math.abs(parseFlexibleNumber(seconds));
    if (![d, m, s].every(Number.isFinite) || m >= 60 || s >= 60) return NaN;
    let value = d + m / 60 + s / 3600;
    const hemi = String(hemisphere || '').toUpperCase();
    if (hemi === 'S' || hemi === 'W' || hemi === 'O') value *= -1;
    return value;
  }

  function parseDmsCoordinate(value) {
    const raw = String(value || '').trim();
    if (!/[NSEWO]/i.test(raw)) return null;
    const pattern = /([+-]?\d{1,3}(?:[.,]\d+)?)\s*(?:[°º])?\s*(?:(\d{1,2}(?:[.,]\d+)?)\s*(?:['’′]|\bmin\b)?)?\s*(?:(\d{1,2}(?:[.,]\d+)?)\s*(?:["”″]|\bseg\b)?)?\s*([NSEWO])/gi;
    const matches = [...raw.matchAll(pattern)];
    if (matches.length < 2) return null;
    let lat = NaN;
    let lng = NaN;
    for (const match of matches) {
      const hemi = String(match[4] || '').toUpperCase();
      const decimal = dmsPartToDecimal(match[1], match[2], match[3], hemi);
      if (!Number.isFinite(decimal)) continue;
      if ((hemi === 'N' || hemi === 'S') && !Number.isFinite(lat)) lat = decimal;
      if ((hemi === 'E' || hemi === 'W' || hemi === 'O') && !Number.isFinite(lng)) lng = decimal;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng, format: 'DMS/DDM' };
  }

  function utmHemisphereFromBand(letter) {
    const band = String(letter || '').toUpperCase();
    if (band === 'S') return 'S';
    if (band === 'N') return 'N';
    if (!/^[C-HJ-NP-X]$/.test(band)) return '';
    return band < 'N' ? 'S' : 'N';
  }

  function utmProjectionDefinition(zone, hemisphere, datum = 'WGS84') {
    const datumDef = datum === 'SIRGAS2000'
      ? '+ellps=GRS80'
      : datum === 'SAD69'
        ? '+ellps=aust_SA +towgs84=-66.87,4.37,-38.52,0,0,0,0'
        : '+datum=WGS84';
    return `+proj=utm +zone=${zone} ${hemisphere === 'S' ? '+south ' : ''}${datumDef} +units=m +no_defs +type=crs`;
  }

  function parseProjectedPair(sourceCrs, easting, northing, label) {
    if (!window.proj4) return null;
    try {
      const out = window.proj4(sourceCrs, 'EPSG:4326', [Number(easting), Number(northing)]);
      const lng = Number(out?.[0]);
      const lat = Number(out?.[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
      return { lat, lng, format: label || 'Coordenada projetada' };
    } catch (error) {
      console.debug?.('[Surveyor] Falha ao converter busca projetada:', error);
      return null;
    }
  }

  function epsgToUtmContext(code) {
    const epsg = Number(code);
    if (epsg >= 31978 && epsg <= 31985) return { zone: epsg - 31960, hemisphere: 'S', datum: 'SIRGAS2000', label: `SIRGAS 2000 / UTM ${epsg - 31960}S` };
    if (epsg >= 32718 && epsg <= 32725) return { zone: epsg - 32700, hemisphere: 'S', datum: 'WGS84', label: `WGS 84 / UTM ${epsg - 32700}S` };
    if (epsg >= 29188 && epsg <= 29195) return { zone: epsg - 29170, hemisphere: 'S', datum: 'SAD69', label: `SAD69 / UTM ${epsg - 29170}S` };
    if (epsg >= 32601 && epsg <= 32660) return { zone: epsg - 32600, hemisphere: 'N', datum: 'WGS84', label: `WGS 84 / UTM ${epsg - 32600}N` };
    return null;
  }

  function parseEpsgCoordinate(value) {
    const raw = String(value || '').trim();
    const epsgMatch = raw.match(/\bEPSG\s*[:=/ -]?\s*(\d{4,5})\b/i);
    if (!epsgMatch) return null;
    const code = Number(epsgMatch[1]);
    const cleaned = raw.replace(epsgMatch[0], ' ');
    const rawValues = cleaned.match(/[+-]?\d[\d.,]*/g) || [];
    if (rawValues.length < 2) return null;
    const utm = epsgToUtmContext(code);
    const values = rawValues.map(utm || code === 3857 ? parseProjectedNumber : parseFlexibleNumber).filter(Number.isFinite);
    if (values.length < 2) return null;
    const first = values[0];
    const second = values[1];


    if (utm) {
      if (first < 100000 || first > 900000 || second < 0 || second > 10000000) return null;
      return parseProjectedPair(utmProjectionDefinition(utm.zone, utm.hemisphere, utm.datum), first, second, `EPSG:${code} · ${utm.label}`);
    }
    if (code === 4326 || code === 4674) {
      let lng = first;
      let lat = second;
      if (Math.abs(lng) <= 90 && Math.abs(lat) > 90) [lat, lng] = [lng, lat];
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
      return { lat, lng, format: `EPSG:${code}` };
    }
    if (code === 3857) return parseProjectedPair('EPSG:3857', first, second, 'EPSG:3857 · Web Mercator');
    return null;
  }

  function parseUtmCoordinate(value) {
    const raw = String(value || '').trim();
    if (!/(?:\bUTM\b|\bZONA\b|\bZONE\b|\bSIRGAS\b|\bWGS\b|\b\d{1,2}\s*[C-HJ-NP-X]\b)/i.test(raw)) return null;

    const epsgResult = parseEpsgCoordinate(raw);
    if (epsgResult) return epsgResult;

    let zone = NaN;
    let hemisphere = '';
    let zoneToken = '';
    const zoneMatch = raw.match(/(?:\bUTM\b\s*)?(?:\bZONA\b|\bZONE\b|\bFUSO\b)?\s*(\d{1,2})\s*([C-HJ-NP-X])\b/i);
    if (zoneMatch) {
      zone = Number(zoneMatch[1]);
      hemisphere = utmHemisphereFromBand(zoneMatch[2]);
      zoneToken = zoneMatch[0];
    } else {
      const numericZone = raw.match(/(?:\bUTM\b\s*)?(?:\bZONA\b|\bZONE\b|\bFUSO\b)\s*(\d{1,2})\b/i);
      if (numericZone) {
        zone = Number(numericZone[1]);
        zoneToken = numericZone[0];
        if (/\bSUL\b|\bSOUTH\b/i.test(raw)) hemisphere = 'S';
        else if (/\bNORTE\b|\bNORTH\b/i.test(raw)) hemisphere = 'N';
        else if (/\bSIRGAS\b|\bBRASIL\b|\bBAHIA\b/i.test(raw)) hemisphere = 'S';
      }
    }
    if (!Number.isInteger(zone) || zone < 1 || zone > 60 || !hemisphere) return null;

    let easting = NaN;
    let northing = NaN;
    const eastingMatch = raw.match(/(?:\bE\b|\bESTE\b|\bEASTING\b|\bLESTE\b)\s*[:=]?\s*([+-]?\d[\d.,]*)/i);
    const northingMatch = raw.match(/(?:\bN\b|\bNORTE\b|\bNORTHING\b)\s*[:=]?\s*([+-]?\d[\d.,]*)/i);
    if (eastingMatch) easting = parseProjectedNumber(eastingMatch[1]);
    if (northingMatch) northing = parseProjectedNumber(northingMatch[1]);

    if (!Number.isFinite(easting) || !Number.isFinite(northing)) {
      let cleaned = raw;
      if (zoneToken) cleaned = cleaned.replace(zoneToken, ' ');
      cleaned = cleaned
        .replace(/\b(?:UTM|SIRGAS|WGS|WGS84|WGS 84|ZONA|ZONE|FUSO|SUL|SOUTH|NORTE|NORTH|BAHIA|BRASIL|EASTING|NORTHING|ESTE|LESTE)\b/gi, ' ')
        .replace(/\bEPSG\s*[:=/ -]?\s*\d{4,5}\b/gi, ' ');
      const nums = (cleaned.match(/[+-]?\d[\d.,]*/g) || []).map(parseProjectedNumber).filter(Number.isFinite);
      if (!Number.isFinite(easting)) easting = nums.find((number) => number >= 100000 && number <= 900000);
      if (!Number.isFinite(northing)) northing = nums.find((number) => number >= 1000000 && number <= 10000000 && number !== easting);
    }
    if (!Number.isFinite(easting) || !Number.isFinite(northing) || easting < 100000 || easting > 900000 || northing < 0 || northing > 10000000) return null;

    const datum = /\bSIRGAS\b/i.test(raw) ? 'SIRGAS2000' : /\bSAD(?:69)?\b/i.test(raw) ? 'SAD69' : 'WGS84';
    const datumLabel = datum === 'SIRGAS2000' ? 'SIRGAS 2000' : datum === 'SAD69' ? 'SAD69' : 'WGS 84';
    const label = `${datumLabel} / UTM ${zone}${hemisphere}`;
    return parseProjectedPair(utmProjectionDefinition(zone, hemisphere, datum), easting, northing, label);
  }

  function parseCoordinate(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;

    const epsg = parseEpsgCoordinate(raw);
    if (epsg) return epsg;
    const utm = parseUtmCoordinate(raw);
    if (utm) return utm;
    const dms = parseDmsCoordinate(raw);
    if (dms) return dms;

    const parts = raw.match(/-?\d+(?:[.,]\d+)?/g);
    if (!parts || parts.length < 2) return null;
    let first = Number(parts[0].replace(',', '.'));
    let second = Number(parts[1].replace(',', '.'));
    if (!Number.isFinite(first) || !Number.isFinite(second)) return null;

    const lower = raw.toLowerCase();
    const longitudeFirst = /(?:longitude|\blon\b|\blng\b)[^0-9-]*-?\d/i.test(lower)
      && lower.search(/(?:longitude|\blon\b|\blng\b)/i) < lower.search(/(?:latitude|\blat\b)/i);
    if (longitudeFirst || Math.abs(first) > 90) [first, second] = [second, first];

    const normalInBrazil = first >= -35 && first <= 7 && second >= -75 && second <= -30;
    const swappedInBrazil = second >= -35 && second <= 7 && first >= -75 && first <= -30;
    if (!normalInBrazil && swappedInBrazil) [first, second] = [second, first];

    const lat = first;
    const lng = second;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng, format: 'Graus decimais' };
  }

  // 2026-08-28 — busca inteligente: CAR e formatos de coordenadas.
  // O campo continua único, mas identifica a intenção antes do submit para
  // evitar geocodificação concorrente e para orientar a digitação técnica.
  const SMART_COORDINATE_FORMATS = [
    { id: 'dd', short: 'DD', label: 'Graus decimais', example: '-13.031785, -39.602848', placeholder: 'Ex.: -13.031785, -39.602848' },
    { id: 'dms', short: 'DMS', label: 'Graus, minutos e segundos', example: '13°01\'54.43" S, 39°36\'10.25" W', placeholder: 'Ex.: 13 01 54.43 39 36 10.25' },
    { id: 'ddm', short: 'DDM', label: 'Graus e minutos decimais', example: '13°01.907\' S, 39°36.171\' W', placeholder: 'Ex.: 13 01.907 39 36.171' },
    { id: 'utm', short: 'UTM', label: 'UTM / SIRGAS 2000', example: '24S · E 434634 · N 8559272', placeholder: 'Ex.: 24S 434634 8559272' },
    { id: 'epsg', short: 'EPSG', label: 'EPSG / coordenada projetada', example: 'EPSG:31984 434634 8559272', placeholder: 'Ex.: EPSG:31984 434634 8559272' }
  ];
  const DEFAULT_SMART_SEARCH_PLACEHOLDER = 'Cidade, imóvel, CAR, UTM ou coordenadas — ex.: Sítio Deus é Fiel';
  let selectedCoordinateInputMode = '';
  let smartSearchFormatTimer = null;
  let carAutoSearchTimer = null;
  let lastAutoCarValue = '';

  const SICAR_STATE_CODES = new Set(['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']);

  function carStateCodeFromDraft(value) {
    const raw = String(value || '').trim().toUpperCase();
    // Duas letras isoladas nunca bastam para assumir CAR: cidades como
    // Amargosa (AM...) não podem ser sequestradas pelo código de UF.
    // O modo CAR só começa com UF seguida de separador ou dígito.
    const match = raw.match(/^([A-Z]{2})(?:(?:[-.\s]+)(?=\d)|(?=\d))/);
    const code = String(match?.[1] || '').toUpperCase();
    return SICAR_STATE_CODES.has(code) ? code : '';
  }

  function isCarDraft(value) {
    return Boolean(carStateCodeFromDraft(value));
  }

  function normalizeCarDraft(value) {
    const compact = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const stateCode = compact.slice(0, 2);
    if (!SICAR_STATE_CODES.has(stateCode)) return '';
    const payload = compact.slice(2);
    if (payload.length < 7 || !/^\d{7}/.test(payload)) return `${stateCode}-${payload}`;
    return `${stateCode}-${payload.slice(0, 7)}-${payload.slice(7, 39)}`;
  }

  function isCompleteCarDraft(value) {
    const normalized = normalizeCarDraft(value);
    return /^[A-Z]{2}-\d{7}-[A-Z0-9]{32}$/.test(normalized) && SICAR_STATE_CODES.has(normalized.slice(0, 2));
  }

  function looksLikeCoordinateDraft(value) {
    const raw = String(value || '').trim();
    if (!raw || isCarDraft(raw)) return false;

    // Coordenadas precisam conter valor numérico. Isso impede textos comuns
    // como "SÍTIO DEUS E FIEL" de entrarem no modo COORD só porque possuem
    // a palavra isolada "E" (antes interpretada como hemisfério East).
    const hasDigit = /\d/.test(raw);
    if (!hasDigit) return false;

    // Prefixos técnicos continuam válidos, mas apenas acompanhados de números.
    if (/\b(?:EPSG|UTM|SIRGAS|WGS\s*84?|ZONA|ZONE|FUSO)\b/i.test(raw)) return true;

    // Hemisfério no início é aceito somente quando seguido por coordenada.
    // Hemisférios ao final de números continuam cobertos pelo caminho numérico.
    if (/^[NSEWO]\s*[+-]?\d/i.test(raw)) return true;
    if (/^\d{1,2}\s*[C-HJ-NP-XNS]$/i.test(raw)) return true;

    // Entrada livre de coordenadas geográficas deve começar por número/sinal.
    if (!/^[+-]?\d/.test(raw)) return false;
    const nums = raw.match(/[+-]?\d+(?:[.,]\d+)?/g) || [];
    if (nums.length >= 2) return true;
    return /^[+-]?\d{1,3}(?:[.,]\d*)?$/.test(raw);
  }

  function isCoordinateModeDraft(value) {
    const raw = String(value || '').trim();
    if (!raw) return true;
    if (!/\d/.test(raw)) return false;
    return /^[+-]?\d/.test(raw) || /^(?:EPSG|UTM|SIRGAS|WGS|ZONA|ZONE|FUSO)\b/i.test(raw);
  }

  function smartNumbers(value) {
    return (String(value || '').match(/[+-]?\d+(?:[.,]\d+)?/g) || [])
      .map((token) => Number(token.replace(',', '.')))
      .filter(Number.isFinite);
  }

  function trimSmartNumber(value, maxDecimals = 4) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    return n.toFixed(maxDecimals).replace(/\.?0+$/, '');
  }

  function smartHemisphere(raw, axis, signedDegree) {
    const text = String(raw || '').toUpperCase();
    if (axis === 'lat') {
      if (/(?:^|\s)N(?:\s|,|;|$)/.test(text)) return 'N';
      if (/(?:^|\s)S(?:\s|,|;|$)/.test(text)) return 'S';
      if (Number(signedDegree) < 0) return 'S';
      // Surveyor opera majoritariamente no Brasil; sem hemisfério explícito,
      // DMS/DDM positivos são formatados como Sul para reduzir digitação.
      return 'S';
    }
    if (/(?:^|\s)E(?:\s|,|;|$)/.test(text)) return 'E';
    if (/(?:^|\s)(?:W|O)(?:\s|,|;|$)/.test(text)) return 'W';
    if (Number(signedDegree) < 0) return 'W';
    return 'W';
  }

  function formatSmartDd(raw) {
    const nums = smartNumbers(raw);
    if (nums.length < 2) return '';
    const lat = nums[0], lng = nums[1];
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return '';
    return `${trimSmartNumber(lat, 7)}, ${trimSmartNumber(lng, 7)}`;
  }

  function formatSmartDms(raw, decimalMinutes = false) {
    const nums = smartNumbers(raw);
    const needed = decimalMinutes ? 4 : 6;
    if (nums.length < needed) return '';
    const latDeg = nums[0], latMin = Math.abs(nums[1]);
    const lonOffset = decimalMinutes ? 2 : 3;
    const lonDeg = nums[lonOffset], lonMin = Math.abs(nums[lonOffset + 1]);
    const latSec = decimalMinutes ? 0 : Math.abs(nums[2]);
    const lonSec = decimalMinutes ? 0 : Math.abs(nums[5]);
    if (Math.abs(latDeg) > 90 || Math.abs(lonDeg) > 180 || latMin >= 60 || lonMin >= 60 || latSec >= 60 || lonSec >= 60) return '';
    const latH = smartHemisphere(raw, 'lat', latDeg);
    const lonH = smartHemisphere(raw, 'lng', lonDeg);
    if (decimalMinutes) {
      return `${Math.abs(Math.trunc(latDeg))}°${trimSmartNumber(latMin, 5)}' ${latH}, ${Math.abs(Math.trunc(lonDeg))}°${trimSmartNumber(lonMin, 5)}' ${lonH}`;
    }
    return `${Math.abs(Math.trunc(latDeg))}°${String(Math.trunc(latMin)).padStart(2, '0')}'${trimSmartNumber(latSec, 4)}" ${latH}, ${Math.abs(Math.trunc(lonDeg))}°${String(Math.trunc(lonMin)).padStart(2, '0')}'${trimSmartNumber(lonSec, 4)}" ${lonH}`;
  }

  function formatSmartUtm(raw) {
    const text = String(raw || '').trim();
    let zone = NaN;
    let hemisphere = 'S';
    const explicitZone = text.match(/(?:\bUTM\b\s*)?(?:\bZONA\b|\bZONE\b|\bFUSO\b)?\s*(\d{1,2})\s*([C-HJ-NP-X]|[NS])\b/i);
    if (explicitZone) {
      zone = Number(explicitZone[1]);
      hemisphere = utmHemisphereFromBand(explicitZone[2]) || String(explicitZone[2] || 'S').toUpperCase();
    }
    const nums = smartNumbers(text);
    if (!Number.isFinite(zone) && nums.length >= 3 && Number.isInteger(nums[0]) && nums[0] >= 1 && nums[0] <= 60) zone = nums[0];
    if (!Number.isInteger(zone) || zone < 1 || zone > 60) return '';
    const projected = nums.filter((number, index) => !(index === 0 && number === zone));
    const easting = projected.find((number) => number >= 100000 && number <= 900000);
    const northing = projected.find((number) => number >= 1000000 && number <= 10000000 && number !== easting);
    if (!Number.isFinite(easting) || !Number.isFinite(northing)) return '';
    return `SIRGAS 2000 / UTM ${zone}${hemisphere === 'N' ? 'N' : 'S'} · E ${Math.round(easting)} · N ${Math.round(northing)}`;
  }

  function formatSmartEpsg(raw) {
    const text = String(raw || '').trim();
    const epsg = text.match(/\bEPSG\s*[:=/ -]?\s*(\d{4,5})\b/i);
    if (!epsg) return '';
    const cleaned = text.replace(epsg[0], ' ');
    const nums = smartNumbers(cleaned);
    if (nums.length < 2) return '';
    return `EPSG:${epsg[1]} ${trimSmartNumber(nums[0], 4)} ${trimSmartNumber(nums[1], 4)}`;
  }

  function formatCoordinateDraft(raw, mode) {
    if (mode === 'dd') return formatSmartDd(raw);
    if (mode === 'dms') return formatSmartDms(raw, false);
    if (mode === 'ddm') return formatSmartDms(raw, true);
    if (mode === 'utm') return formatSmartUtm(raw);
    if (mode === 'epsg') return formatSmartEpsg(raw);
    return '';
  }

  function smartDraftEndedComponent(raw) {
    return /(?:\s|;)$/.test(String(raw || ''));
  }

  // Máscaras progressivas também para digitação contínua (somente números).
  // Isso evita o comportamento antigo em que DMS/DDM/DD só eram formatados
  // depois que o usuário digitava espaço ou outro separador.
  function smartMaskDigits(raw) {
    return String(raw || '').replace(/\D/g, '');
  }

  function smartCanUseContinuousMask(raw) {
    const text = String(raw || '');
    if (!text.trim()) return false;
    // Se já há símbolos inseridos pela própria máscara, continue remascarando
    // a partir dos dígitos para manter o cursor no fim e suportar backspace.
    if (/[°º'’′"”″]|(?:^|\s)[NSWE](?:\s|,|;|$)/i.test(text)) return true;
    // Na primeira digitação, só entre neste caminho quando o usuário realmente
    // estiver digitando uma sequência contínua. Entradas separadas por espaço
    // continuam usando os formatadores livres/colagem existentes.
    if (/^-?\d{1,2}\.\d*(?:,\s*-?\d*)?$/.test(text)) return true;
    return !/\s/.test(text);
  }

  function maskContinuousDd(raw) {
    if (!smartCanUseContinuousMask(raw)) return '';
    const digits = smartMaskDigits(raw).slice(0, 18);
    if (!digits) return '';
    const one = (chunk) => {
      if (!chunk) return '';
      if (chunk.length <= 2) return `-${chunk}${chunk.length === 2 ? '.' : ''}`;
      return `-${chunk.slice(0, 2)}.${chunk.slice(2, 9)}`;
    };
    if (digits.length < 9) return one(digits);
    if (digits.length === 9) return `${one(digits)}, -`;
    return `${one(digits.slice(0, 9))}, ${one(digits.slice(9))}`;
  }

  function maskContinuousDms(raw) {
    if (!smartCanUseContinuousMask(raw)) return '';
    const digits = smartMaskDigits(raw).slice(0, 16);
    if (!digits) return '';
    const one = (chunk, hemi) => {
      if (!chunk) return '';
      let out = chunk.slice(0, 2);
      if (chunk.length >= 2) out += '°';
      if (chunk.length > 2) out += chunk.slice(2, 4);
      if (chunk.length >= 4) out += "'";
      if (chunk.length > 4) out += chunk.slice(4, 6);
      if (chunk.length >= 6) out += '.';
      if (chunk.length > 6) out += chunk.slice(6, 8);
      if (chunk.length >= 8) out += `" ${hemi}`;
      return out;
    };
    if (digits.length <= 8) {
      const lat = one(digits, 'S');
      return digits.length === 8 ? `${lat}, ` : lat;
    }
    return `${one(digits.slice(0, 8), 'S')}, ${one(digits.slice(8), 'W')}`;
  }

  function maskContinuousDdm(raw) {
    if (!smartCanUseContinuousMask(raw)) return '';
    const digits = smartMaskDigits(raw).slice(0, 14);
    if (!digits) return '';
    const one = (chunk, hemi) => {
      if (!chunk) return '';
      let out = chunk.slice(0, 2);
      if (chunk.length >= 2) out += '°';
      if (chunk.length > 2) out += chunk.slice(2, 4);
      if (chunk.length >= 4) out += '.';
      if (chunk.length > 4) out += chunk.slice(4, 7);
      if (chunk.length >= 7) out += `' ${hemi}`;
      return out;
    };
    if (digits.length <= 7) {
      const lat = one(digits, 'S');
      return digits.length === 7 ? `${lat}, ` : lat;
    }
    return `${one(digits.slice(0, 7), 'S')}, ${one(digits.slice(7), 'W')}`;
  }

  function maskContinuousUtm(raw) {
    if (!smartCanUseContinuousMask(raw)) return '';
    const digits = smartMaskDigits(raw).slice(0, 15);
    if (!digits) return '';
    if (digits.length < 2) return digits;
    const zone = digits.slice(0, 2);
    const east = digits.slice(2, 8);
    const north = digits.slice(8, 15);
    let out = `UTM ${zone}S · E `;
    out += east;
    if (digits.length >= 8) out += ' · N ';
    out += north;
    return out;
  }

  function formatSmartDdProgressive(raw) {
    const source = String(raw || '');
    const full = formatSmartDd(source);
    const nums = smartNumbers(source);
    if (nums.length >= 2 && full) return full;
    if (nums.length === 1 && smartDraftEndedComponent(source) && Math.abs(nums[0]) <= 90) {
      return `${trimSmartNumber(nums[0], 7)}, `;
    }
    return source;
  }

  function formatSmartDmsProgressive(raw, decimalMinutes = false) {
    const source = String(raw || '');
    const full = formatSmartDms(source, decimalMinutes);
    if (full) return full;
    if (!smartDraftEndedComponent(source)) return source;
    const nums = smartNumbers(source);
    if (!nums.length) return source;

    const latDeg = nums[0];
    if (Math.abs(latDeg) > 90) return source;
    const latH = smartHemisphere(source, 'lat', latDeg);
    const degLat = `${Math.abs(Math.trunc(latDeg))}°`;

    if (decimalMinutes) {
      if (nums.length === 1) return degLat;
      const latMin = Math.abs(nums[1]);
      if (latMin >= 60) return source;
      const latText = `${degLat}${trimSmartNumber(latMin, 5)}' ${latH}`;
      if (nums.length === 2) return `${latText}, `;
      const lonDeg = nums[2];
      if (Math.abs(lonDeg) > 180) return source;
      const lonH = smartHemisphere(source, 'lng', lonDeg);
      const lonBase = `${Math.abs(Math.trunc(lonDeg))}°`;
      if (nums.length === 3) return `${latText}, ${lonBase}`;
      const lonMin = Math.abs(nums[3]);
      if (lonMin >= 60) return source;
      return `${latText}, ${lonBase}${trimSmartNumber(lonMin, 5)}' ${lonH}`;
    }

    if (nums.length === 1) return degLat;
    const latMin = Math.abs(nums[1]);
    if (latMin >= 60) return source;
    const latBase = `${degLat}${String(Math.trunc(latMin)).padStart(2, '0')}'`;
    if (nums.length === 2) return latBase;
    const latSec = Math.abs(nums[2]);
    if (latSec >= 60) return source;
    const latText = `${latBase}${trimSmartNumber(latSec, 4)}" ${latH}`;
    if (nums.length === 3) return `${latText}, `;
    const lonDeg = nums[3];
    if (Math.abs(lonDeg) > 180) return source;
    const lonH = smartHemisphere(source, 'lng', lonDeg);
    const lonBase = `${Math.abs(Math.trunc(lonDeg))}°`;
    if (nums.length === 4) return `${latText}, ${lonBase}`;
    const lonMin = Math.abs(nums[4]);
    if (lonMin >= 60) return source;
    const lonMinuteBase = `${lonBase}${String(Math.trunc(lonMin)).padStart(2, '0')}'`;
    if (nums.length === 5) return `${latText}, ${lonMinuteBase}`;
    const lonSec = Math.abs(nums[5]);
    if (lonSec >= 60) return source;
    return `${latText}, ${lonMinuteBase}${trimSmartNumber(lonSec, 4)}" ${lonH}`;
  }

  function formatSmartUtmProgressive(raw) {
    const source = String(raw || '');
    const full = formatSmartUtm(source);
    if (full) return full;
    if (!smartDraftEndedComponent(source)) return source;
    const nums = smartNumbers(source);
    const explicit = source.match(/(?:\bUTM\b\s*)?(?:\bZONA\b|\bZONE\b|\bFUSO\b)?\s*(\d{1,2})\s*([C-HJ-NP-X]|[NS])?\b/i);
    let zone = explicit ? Number(explicit[1]) : Number(nums[0]);
    if (!Number.isInteger(zone) || zone < 1 || zone > 60) return source;
    const band = explicit?.[2] || 'S';
    const hemisphere = utmHemisphereFromBand(band) || (String(band).toUpperCase() === 'N' ? 'N' : 'S');
    const projected = nums.filter((number, index) => !(index === 0 && number === zone));
    if (!projected.length) return `UTM ${zone}${hemisphere} · E `;
    const easting = projected.find((number) => number >= 0 && number <= 900000);
    if (!Number.isFinite(easting)) return source;
    if (projected.length === 1) return `UTM ${zone}${hemisphere} · E ${trimSmartNumber(easting, 2)} · N `;
    return source;
  }

  function formatSmartEpsgProgressive(raw) {
    const source = String(raw || '');
    const full = formatSmartEpsg(source);
    if (full) return full;
    if (!smartDraftEndedComponent(source)) return source;
    const epsg = source.match(/\bEPSG\s*[:=/ -]?\s*(\d{4,5})\b/i);
    const nums = smartNumbers(source);
    if (!epsg && nums.length === 1 && Number.isInteger(nums[0]) && nums[0] >= 1000 && nums[0] <= 99999) {
      return `EPSG:${nums[0]} `;
    }
    if (epsg) {
      const cleaned = source.replace(epsg[0], ' ');
      const coords = smartNumbers(cleaned);
      if (coords.length === 1) return `EPSG:${epsg[1]} ${trimSmartNumber(coords[0], 4)} `;
    }
    return source;
  }

  function formatCoordinateDraftProgressive(raw, mode) {
    // Uma coordenada já completa/separada tem prioridade. Isso preserva
    // colagens e digitação livre. A máscara contínua entra quando há apenas
    // uma sequência de dígitos (ou a própria máscara parcial).
    const complete = formatCoordinateDraft(raw, mode);
    if (complete) return complete;
    // Ex.: DMS 1300421539370435 -> 13°00'42.15" S, 39°37'04.35" W.
    if (mode === 'dd') return maskContinuousDd(raw) || formatSmartDdProgressive(raw);
    if (mode === 'dms') return maskContinuousDms(raw) || formatSmartDmsProgressive(raw, false);
    if (mode === 'ddm') return maskContinuousDdm(raw) || formatSmartDmsProgressive(raw, true);
    if (mode === 'utm') return maskContinuousUtm(raw) || formatSmartUtmProgressive(raw);
    if (mode === 'epsg') return formatSmartEpsgProgressive(raw);
    return String(raw || '');
  }


  window.SurveyorCoordinates = Object.freeze({
    SMART_COORDINATE_FORMATS, DEFAULT_SMART_SEARCH_PLACEHOLDER,
    parseFlexibleNumber, parseProjectedNumber, dmsPartToDecimal, parseDmsCoordinate, utmHemisphereFromBand, utmProjectionDefinition, parseProjectedPair, epsgToUtmContext, parseEpsgCoordinate, parseUtmCoordinate, parseCoordinate, carStateCodeFromDraft, isCarDraft, normalizeCarDraft, isCompleteCarDraft, looksLikeCoordinateDraft, isCoordinateModeDraft, smartNumbers, trimSmartNumber, smartHemisphere, formatSmartDd, formatSmartDms, formatSmartUtm, formatSmartEpsg, formatCoordinateDraft, smartDraftEndedComponent, smartMaskDigits, smartCanUseContinuousMask, maskContinuousDd, maskContinuousDms, maskContinuousDdm, maskContinuousUtm, formatSmartDdProgressive, formatSmartDmsProgressive, formatSmartUtmProgressive, formatSmartEpsgProgressive, formatCoordinateDraftProgressive
  });
})();
