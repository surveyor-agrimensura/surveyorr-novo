import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('assets/css/core/documents.css','utf8');
const editor = fs.readFileSync('assets/js/core/technical-document-editor.js','utf8');

// Guard against a visually-only title in pseudo-content: a real, readable caption
// must exist in the DOM after dynamic editor navigation is mounted.
assert.match(editor, /function mountInlineToolCaptions\(\)/);
assert.match(editor, /document\.createElement\('span'\)/);
assert.match(editor, /mountStandardInlineNavigation\(\);\s*mountInlineToolCaptions\(\);/);
assert.match(css, /\.sv-editor-tool-caption\s*\{[^}]*font-size:\s*1[01]/);
assert.doesNotMatch(css, /content:attr\(title\)/, 'Visible toolbar labels must not rely on CSS generated content.');

// The canonical two-column layout is declared near the end of the stylesheet.
// The mobile override must come AFTER it or the mobile one-column rule loses.
const canonical = css.lastIndexOf('grid-template-columns:clamp(330px,24vw,365px) minmax(0,1fr)');
const mobile = css.lastIndexOf('grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(360px,60vh)');
assert(canonical >= 0 && mobile > canonical, 'Mobile stacked layout must override the later canonical two-column rule.');
assert.match(css.slice(mobile-750), /@media\s*\(max-width:900px\)/);

const toolSection = css.slice(css.indexOf('/* Coluna esquerda:'), css.indexOf('/* Coluna direita:'));
assert.match(toolSection, /\.sv-editor-tool-label\s*\{\s*font-size:11px/);
assert.match(toolSection, /height:34px;border-radius:4px;font-size:11px/);
assert.match(toolSection, /\.sv-editor-tool-hint\s*\{\s*font-size:10px/);
assert(!css.includes('!important'));
console.log('PASS: editor integrado com texto legível, rótulos reais e responsividade após regra canônica.');
