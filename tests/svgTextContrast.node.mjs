import assert from 'node:assert/strict';
import {svgTextOutline} from '../src/lib/svgTextContrast.ts';
assert.equal(svgTextOutline('#ffffff'), '#142238');
assert.equal(svgTextOutline('#fefefe'), '#142238');
assert.equal(svgTextOutline('#0f172a'), '#ffffff');
assert.equal(svgTextOutline('#000000'), '#ffffff');
assert.equal(svgTextOutline('#ffff00'), '#142238');
assert.equal(svgTextOutline('#red'), '#ffffff');
console.log('OK: 6 verificações de contraste de texto SVG');
