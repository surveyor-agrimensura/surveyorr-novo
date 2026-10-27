import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Executa a funcao real que reconstrói o menu, em um DOM mínimo. Ela não
// pode descartar um item que veio do layout com a permissão já aplicada.
const ui = fs.readFileSync('assets/js/core/ui.js', 'utf8');
const start = ui.indexOf('  function modernizeToolsMenu() {');
const end = ui.indexOf('\n  function usageQuotaLabel(', start);
assert.ok(start > 0 && end > start, 'Localizar controlador atual do menu Ferramentas');
const source = ui.slice(start, end).trim();

function makeMenu(initialPaths) {
  const links = initialPaths.map((path) => ({
    href: `https://surveyorr.test${path}/`,
    dataset: {},
    setAttribute() {}
  }));
  const menu = {
    dataset: {}, sections: [],
    querySelector(selector) {
      const path = /consulta-car/.test(selector) ? '/consulta-car' : /central-lotes/.test(selector) ? '/central-lotes' : '__not_found__';
      return this.querySelectorAll('a').find((anchor) => new URL(anchor.href, 'https://surveyorr.test/').pathname.replace(/\/$/, '') === path) || null;
    },
    querySelectorAll(selector) {
      assert.equal(selector, 'a');
      return this.sections.length ? this.sections.flatMap((s) => s.links) : links;
    },
    set innerHTML(value) {
      assert.equal(value, '');
      this.sections = [];
    },
    appendChild(section) { this.sections.push(section); }
  };
  const document = {
    getElementById(id) { return id === 'svHomeToolsMenu' ? menu : null; },
    querySelectorAll() { return []; },
    createElement(name) {
      if (name === 'section') return { links: [], set innerHTML(value) { this.heading = value; }, appendChild(link) { this.links.push(link); } };
      if (name === 'a') return {dataset:{},setAttribute(name,value){this[name]=value;},set innerHTML(value){this.labelMarkup=value;}};
      throw new Error(`Elemento inesperado ${name}`);
    }
  };
  const ctx = { document, location: {href: 'https://surveyorr.test/'}, URL, deployBase: () => '', friendlyIcon: () => '<svg />' };
  const modernizeToolsMenu = vm.runInNewContext(`(${source})`, ctx);
  return {menu, modernizeToolsMenu};
}

const pro = makeMenu(['/mapa','/consulta-car','/memorial','/nuvem','/central-lotes']);
pro.modernizeToolsMenu();
let visible = pro.menu.querySelectorAll('a');
assert.equal(visible.filter(a => a.dataset.toolRoute === '/central-lotes').length, 1,
  'Plano Pro: Central de Lotes deve sobreviver ao agrupamento visual do menu');
assert.ok(visible.find(a => a.dataset.toolRoute === '/central-lotes')?.labelMarkup.includes('Central de Lotes'));
assert.ok(visible.find(a => a.dataset.toolRoute === '/central-lotes')?.href.endsWith('/central-lotes/'));
assert.equal(pro.menu.querySelectorAll('a').filter(a => a.dataset.toolRoute === '/consulta-car').length, 1);
pro.modernizeToolsMenu();
assert.equal(pro.menu.querySelectorAll('a').filter(a => a.dataset.toolRoute === '/central-lotes').length, 1,
  'Não duplicar item com MutationObserver');

const basic = makeMenu(['/mapa','/consulta-car','/memorial','/nuvem']);
basic.modernizeToolsMenu();
assert.equal(basic.menu.querySelectorAll('a').filter(a => a.dataset.toolRoute === '/central-lotes').length, 0,
  'Não conceder permissão da Central pelo agrupamento do menu');
console.log('PASS central-lotes-menu-integration: menu real, permissão Pro, plano sem permissão e sem duplicação.');
