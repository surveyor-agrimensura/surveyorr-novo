import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const modern=read('assets/js/core/ui.js');
const css=read('assets/css/core/ui.css');
const mapCss=read('assets/css/features/mapa/app.css');
const app=read('assets/js/features/mapa/app.js');
const cloud=read('assets/js/features/cloud/app.js');
const mapHtml=read('mapa/index.html');
const nuvem=read('nuvem/index.html');
const assertions=[
  [modern.includes("sv-map-basemap-clean"),'toolbar has clean basemap popup'],
  [modern.includes("baseSelect.dispatchEvent(new Event('change'"),'basemap popup reuses production baseMapSelect handler'],
  [modern.includes("drawer.classList.toggle('hidden',!shouldOpen)"),'quick-tools popup toggles directly and repeatedly'],
  [modern.includes("friendlyIcon('mapas')"),'friendly icon system applied'],
  [css.includes('COMMERCIAL FRIENDLY POLISH 2026-08-18'),'global commercial polish stylesheet exists'],
  [mapCss.includes('COMMERCIAL SIDE PANEL POLISH 2026-08-18'),'map sidepanel commercial polish exists'],
  [app.includes('const liveOpacity = Math.max(0, Math.min(1, Number(livePref.opacity'),'catalog opacity no longer forced back to >=82%'],
  [!app.includes("setOpacity(Math.max(0.82, Number(pref.opacity"),'old opacity reset bug removed'],
  [cloud.includes('directCollections=[full?.geoJson,full?.geojson,p?.geoJson,p?.geojson'),'project previews parse real project GeoJSON'],
  [cloud.includes("projectUiIcon('place')"),'project metadata uses coherent SVG icons'],
  [mapHtml.includes('app.css?v=21.11.5-clean-current'),'map uses consolidated current toolbar bundle'],
  [nuvem.includes('ui.css?v=21.11.5-clean-current'),'projects use consolidated current UI bundle']
];
for(const [ok,msg] of assertions){if(!ok){console.error('FAIL',msg);process.exit(1)}console.log('OK',msg)}
console.log('OK commercial friendly UI regression');
