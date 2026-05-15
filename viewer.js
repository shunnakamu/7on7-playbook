// ============================================================
// 7on7 Playbook Viewer — Read-Only
// ============================================================

(() => {
  'use strict';

  const R = window.PlaybookRenderer;
  const canvas = document.getElementById('field-canvas');
  const ctx = canvas.getContext('2d');
  const playListEl = document.getElementById('play-list');

  canvas.width = R.FIELD_WIDTH;
  canvas.height = R.FIELD_HEIGHT;

  let playbook = [];
  let defPlaybook = [];
  let currentPlayIndex = 0;
  let currentDefPlayIndex = 0;
  let currentMode = 'offense'; // 'offense' | 'defense'

  // Animation state
  let animating = false;
  let animProgress = 0;
  let animRAF = null;

  // ---- Canvas Resize ----
  function resizeCanvasDisplay() {
    const area = document.getElementById('canvas-area');
    const availW = area.clientWidth - 20;
    const availH = area.clientHeight - 40;
    const ratio = R.FIELD_WIDTH / R.FIELD_HEIGHT;
    let w = availW;
    let h = w / ratio;
    if (h > availH) {
      h = availH;
      w = h * ratio;
    }
    canvas.style.width = Math.floor(w) + 'px';
    canvas.style.height = Math.floor(h) + 'px';
  }

  resizeCanvasDisplay();
  window.addEventListener('resize', resizeCanvasDisplay);

  // ---- Render ----
  function render(progress) {
    ctx.clearRect(0, 0, R.FIELD_WIDTH, R.FIELD_HEIGHT);

    if (currentMode === 'defense') {
      const play = defPlaybook[currentDefPlayIndex];
      if (!play) return;
      R.renderDefPlayToCanvas(ctx, play);
    } else {
      const play = playbook[currentPlayIndex];
      if (!play) return;
      R.drawFieldTo(ctx);
      R.drawRoutesTo(ctx, play, progress);
      R.drawPlayersTo(ctx, play);
    }

    // Update play title
    const titleEl = document.getElementById('play-title');
    if (currentMode === 'defense') {
      const play = defPlaybook[currentDefPlayIndex];
      if (play) titleEl.textContent = play.name;
    } else {
      const play = playbook[currentPlayIndex];
      if (play) titleEl.textContent = play.name;
    }
  }

  // ---- Play List ----
  function renderPlayList() {
    playListEl.innerHTML = '';
    const collapsed = {};

    if (currentMode === 'defense') {
      renderDefPlayList();
      return;
    }

    // Group plays by formation
    const groups = {};
    const order = [];
    playbook.forEach((play, i) => {
      const key = play.formation || 'spread';
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(i);
    });

    order.forEach(fKey => {
      const label = R.getFormationLabel(fKey);
      // Formation group header
      const header = document.createElement('li');
      header.className = 'formation-header';
      header.innerHTML = `<span class="formation-label">${label}</span> <span class="formation-count">${groups[fKey].length}</span>`;
      playListEl.appendChild(header);

      groups[fKey].forEach(i => {
        const li = document.createElement('li');
        li.textContent = playbook[i].name;
        if (i === currentPlayIndex) li.classList.add('active');
        li.addEventListener('click', () => {
          currentPlayIndex = i;
          renderPlayList();
          stopAnimation();
          render();
        });
        playListEl.appendChild(li);
      });
    });
  }

  function renderDefPlayList() {
    const groups = {};
    const order = [];
    defPlaybook.forEach((play, i) => {
      const key = play.formation || '4-2-1';
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(i);
    });

    order.forEach(fKey => {
      const label = R.getDefFormationLabel(fKey);
      const header = document.createElement('li');
      header.className = 'formation-header';
      header.innerHTML = `<span class="formation-label">${label}</span> <span class="formation-count">${groups[fKey].length}</span>`;
      playListEl.appendChild(header);

      groups[fKey].forEach(i => {
        const li = document.createElement('li');
        li.textContent = defPlaybook[i].name;
        if (i === currentDefPlayIndex) li.classList.add('active');
        li.addEventListener('click', () => {
          currentDefPlayIndex = i;
          renderPlayList();
          stopAnimation();
          render();
        });
        playListEl.appendChild(li);
      });
    });
  }

  // ---- Tab Switching ----
  document.getElementById('tab-offense').addEventListener('click', () => {
    if (currentMode === 'offense') return;
    currentMode = 'offense';
    document.getElementById('tab-offense').classList.add('active');
    document.getElementById('tab-defense').classList.remove('active');
    stopAnimation();
    renderPlayList();
    render();
  });

  document.getElementById('tab-defense').addEventListener('click', () => {
    if (currentMode === 'defense') return;
    currentMode = 'defense';
    document.getElementById('tab-defense').classList.add('active');
    document.getElementById('tab-offense').classList.remove('active');
    stopAnimation();
    renderPlayList();
    render();
  });

  // ---- Animation ----
  function startAnimation() {
    if (currentMode === 'defense') return; // no animation for defense
    animating = true;
    animProgress = 0;
    const duration = 2000;
    const start = performance.now();
    function frame(ts) {
      animProgress = Math.min(1, (ts - start) / duration);
      render(animProgress);
      if (animProgress < 1) {
        animRAF = requestAnimationFrame(frame);
      } else {
        animating = false;
        animRAF = null;
        render(); // final frame without clipping
      }
    }
    animRAF = requestAnimationFrame(frame);
  }

  function stopAnimation() {
    if (animRAF) cancelAnimationFrame(animRAF);
    animating = false;
    animRAF = null;
  }

  document.getElementById('btn-animate').addEventListener('click', () => {
    if (animating) stopAnimation();
    else startAnimation();
    render();
  });

  // Space key for animation
  document.addEventListener('keydown', e => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (animating) stopAnimation();
      else startAnimation();
      render();
    }
  });

  // ---- Print ----
  document.getElementById('btn-print').addEventListener('click', () => {
    const printArea = document.getElementById('print-area');
    printArea.innerHTML = '';
    const isDefense = currentMode === 'defense';
    const pb = isDefense ? defPlaybook : playbook;

    const groups = {};
    const order = [];
    pb.forEach(play => {
      const key = play.formation || (isDefense ? '4-2-1' : 'spread');
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(play);
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'print-wrapper';

    order.forEach(formKey => {
      const label = isDefense ? R.getDefFormationLabel(formKey) : R.getFormationLabel(formKey);
      const section = document.createElement('div');
      section.className = 'print-section';
      const grid = document.createElement('div');
      grid.className = 'print-grid';

      groups[formKey].forEach(play => {
        const container = document.createElement('div');
        container.className = 'print-play';

        const fullCanvas = document.createElement('canvas');
        fullCanvas.width = R.FIELD_WIDTH;
        fullCanvas.height = R.FIELD_HEIGHT;
        if (isDefense) R.renderDefPlayToCanvasBW(fullCanvas.getContext('2d'), play);
        else R.renderPlayToCanvasBW(fullCanvas.getContext('2d'), play);

        const PRINT_CROP = 0;
        const cropY = isDefense ? R.ENDZONE_HEIGHT : 0;
        const cropH = R.FIELD_HEIGHT - PRINT_CROP;
        const LABEL_H = 30;
        const cropped = document.createElement('canvas');
        cropped.width = R.FIELD_WIDTH;
        cropped.height = cropH + LABEL_H;
        const cc = cropped.getContext('2d');

        cc.fillStyle = '#fff';
        cc.fillRect(0, 0, R.FIELD_WIDTH, LABEL_H);
        cc.fillStyle = '#000';
        cc.font = 'bold 20px sans-serif';
        cc.textAlign = 'center';
        cc.textBaseline = 'middle';
        cc.fillText(label + ' \u2014 ' + play.name, R.FIELD_WIDTH / 2, LABEL_H / 2);

        cc.drawImage(fullCanvas, 0, cropY, R.FIELD_WIDTH, cropH, 0, LABEL_H, R.FIELD_WIDTH, cropH);

        const img = document.createElement('img');
        img.src = cropped.toDataURL();
        img.style.width = '100%';
        container.appendChild(img);
        grid.appendChild(container);
      });

      section.appendChild(grid);
      wrapper.appendChild(section);
    });

    printArea.appendChild(wrapper);
    setTimeout(() => window.print(), 200);
  });

  // ---- Load Published Data ----
  async function loadPublished() {
    try {
      const res = await fetch('/api/published', { credentials: 'same-origin' });
      if (res.status === 401) {
        window.location.href = '/viewer/login';
        return;
      }
      if (!res.ok) {
        document.getElementById('play-title').textContent = 'No published version yet';
        return;
      }
      const data = await res.json();
      playbook = JSON.parse(data.offensePlaybook || '[]');
      defPlaybook = JSON.parse(data.defensePlaybook || '[]');

      // Version info
      const infoEl = document.getElementById('version-info');
      const date = data.published_at ? new Date(data.published_at + 'Z').toLocaleString() : '';
      infoEl.textContent = `v${data.id}${data.label ? ' — ' + data.label : ''} (${date})`;

      renderPlayList();
      render();
    } catch (e) {
      document.getElementById('play-title').textContent = 'Failed to load playbook';
      console.error('Load error:', e);
    }
  }

  loadPublished();
})();
