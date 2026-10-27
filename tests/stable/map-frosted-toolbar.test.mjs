import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../../assets/css/features/mapa/app.css', import.meta.url), 'utf8').replace(/!important/g,'');
const workspace = fs.readFileSync(new URL('../../assets/css/features/mapa/app.css', import.meta.url), 'utf8').replace(/!important/g,'');

assert.match(app, /not\(\.surveyor-territorial-mode\) \.geo-app\{[\s\S]*grid-template-rows:minmax\(0,1fr\);/);
assert.match(app, /not\(\.surveyor-territorial-mode\) \.geo-workspace\{[\s\S]*grid-row:1;[\s\S]*min-height:100vh;/);
assert.match(app, /sv-map-toolbar-item,[\s\S]*sv-map-export-clean,[\s\S]*sv-map-basemap-clean\{[\s\S]*background:rgba\(255,255,255,\.97\);/);
assert.match(app, /sv-map-search-host #coordSearch\{[\s\S]*background:rgba\(255,255,255,\.97\);/);

assert.match(workspace, /not\(\.surveyor-territorial-mode\) \.geo-brandbar\.map-onebar\{[\s\S]*position:fixed;[\s\S]*background:rgba\(244,248,251,\.28\);[\s\S]*backdrop-filter:blur\(12px\) saturate\(110%\);/);
assert.match(workspace, /geo-brandbar\.map-onebar::before\{[\s\S]*content:none;[\s\S]*display:none;/);
assert.match(workspace, /leaflet-top\.leaflet-right \.surveyor-orientation-control\{[\s\S]*margin-top:68px;/);
assert.match(workspace, /geo-sidepanel:not\(\.collapsed\)\{[\s\S]*margin-top:var\(--sv-map-operational-toolbar-height\);[\s\S]*height:calc\(100vh - var\(--sv-map-operational-toolbar-height\)\);/);
assert.doesNotMatch(workspace, /geo-brandbar\.map-onebar\{[\s\S]{0,240}background:#ffffff;/);
assert.doesNotMatch(workspace, /geo-brandbar\.map-onebar::before\{[\s\S]{0,180}background:#ffffff/);
console.log('map frosted toolbar: ok');
