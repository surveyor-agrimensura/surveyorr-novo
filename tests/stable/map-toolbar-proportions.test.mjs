import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../../assets/css/features/mapa/app.css', import.meta.url), 'utf8').replace(/!important/g,'');
const workspace = fs.readFileSync(new URL('../../assets/css/features/mapa/app.css', import.meta.url), 'utf8').replace(/!important/g,'');

assert.match(workspace, /button\.sv-map-toolbar-item\.sv-map-toolbar-more,[\s\S]*button\.sv-map-history-action\{[\s\S]*width:42px;[\s\S]*height:42px;[\s\S]*border-radius:10px;/);
assert.match(workspace, /sv-map-history-group \.sv-map-toolbar-group-actions\{[\s\S]*gap:4px;/);
assert.doesNotMatch(app, /sv-map-toolbar-group \.sv-map-toolbar-more\{[\s\S]{0,220}width:30px/);
assert.doesNotMatch(app, /button\.sv-map-history-action\{[\s\S]{0,220}width:34px/);
console.log('map toolbar proportions: ok');
