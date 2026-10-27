    (() => {
      const panel = document.getElementById('geoSidePanel');
      const workspace = document.querySelector('.geo-workspace');
      const collapseButton = document.getElementById('sidePanelCollapse');
      const floatingToggle = document.getElementById('sidePanelFloatToggle');
      const setCollapsed = collapsed => {
        panel.classList.toggle('collapsed', collapsed);
        workspace.classList.toggle('panel-collapsed', collapsed);
        document.body.classList.toggle('map-panel-collapsed', collapsed);
        collapseButton.textContent = collapsed ? '›' : '‹';
        collapseButton.title = collapsed ? 'Expandir painel' : 'Recolher painel';
        collapseButton.setAttribute('aria-label', collapsed ? 'Expandir painel lateral' : 'Recolher painel lateral');
        if (floatingToggle) {
          floatingToggle.classList.toggle('visible', collapsed);
          floatingToggle.setAttribute('aria-hidden', collapsed ? 'false' : 'true');
          floatingToggle.querySelector('span').textContent = collapsed ? '›' : '‹';
          floatingToggle.title = collapsed ? 'Mostrar painel lateral' : 'Recolher painel lateral';
        }
        setTimeout(() => window.dispatchEvent(new Event('resize')), 230);
      };
      collapseButton?.addEventListener('click', () => setCollapsed(!panel.classList.contains('collapsed')));
      floatingToggle?.addEventListener('click', () => setCollapsed(false));
      setCollapsed(panel.classList.contains('collapsed'));
      document.querySelectorAll('[data-side-tab]').forEach(btn => btn.addEventListener('click', () => {
        document.querySelectorAll('[data-side-tab]').forEach(x => x.classList.toggle('active', x === btn));
        document.querySelectorAll('[data-side-panel]').forEach(x => x.classList.toggle('active', x.dataset.sidePanel === btn.dataset.sideTab));
      }));
      document.querySelectorAll('.collapse-btn').forEach(btn => btn.addEventListener('click', () => {
        const fields = btn.closest('.compact-section').querySelector('.compact-fields');
        const hidden = fields.style.display === 'none';
        fields.style.display = hidden ? '' : 'none';
        btn.textContent = hidden ? '−' : '+';
      }));
      const syncMapChromeOffsets = () => {
        const header = document.querySelector('.geo-brandbar.map-onebar');
        if (!header) return;
        const offset = Math.ceil(header.getBoundingClientRect().height) + 10;
        document.documentElement.style.setProperty('--map-top-offset', `${offset}px`);
      };
      window.addEventListener('resize', syncMapChromeOffsets);
      if ('ResizeObserver' in window) {
        const header = document.querySelector('.geo-brandbar.map-onebar');
        header && new ResizeObserver(syncMapChromeOffsets).observe(header);
      }
      requestAnimationFrame(syncMapChromeOffsets);
      setTimeout(syncMapChromeOffsets, 260);
      document.getElementById('logoutMapButton')?.addEventListener('click', () => window.GeoRuralAuth?.logout());
    })();
  
