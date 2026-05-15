// ============================================================
// 7on7 Playbook App — Full Featured
// ============================================================

(() => {
  'use strict';

  // ---- Import from shared renderer ----
  const {
    FIELD_WIDTH, FIELD_HEIGHT, YARD_LINES, ENDZONE_HEIGHT, PLAYER_RADIUS, SNAP_THRESHOLD,
    ZONE_TYPES, ZONE_SHAPES, COVERAGE_SCHEMES,
    BUILTIN_DEF_FORMATIONS, BUILTIN_FORMATIONS,
    COLORS_O, COLOR_D,
    fy, formationOffense, formationDefense, getFormationLabel, getDefFormationLabel,
    drawArrow, drawWavyLine, getCurveControlPoint, flattenMixedRoute, flattenSegment,
    routeLabel, totalLength, pointAtLength, crossNumberPosition,
    drawFieldTo, drawRoutesTo, drawPlayersTo,
    drawFieldDefenseTo, drawZonesTo, drawGhostOffense,
    drawZoneAssignmentLines, drawDefendersDefMode,
    renderPlayToCanvas,
    drawFieldBW, drawRoutesBW, drawPlayersBW, renderPlayToCanvasBW, renderPlayToCanvasBWFiltered,
    drawFieldDefenseBW, drawZonesBW, drawDefendersDefModeBW,
    drawGhostOffenseBW, drawZoneAssignmentLinesBW, renderDefPlayToCanvasBW,
    drawRoutesFilteredTo, drawPlayersFilteredTo,
  } = window.PlaybookRenderer;

  // (ZONE_TYPES, ZONE_SHAPES, COVERAGE_SCHEMES, etc. imported from render.js)


  function createDefensivePlay(name, formationKey, coverageKey) {
    formationKey = formationKey || '4-2-1';
    coverageKey = coverageKey || '';
    const defenders = formationDefense(formationKey).map(d => ({ ...d, zone: '' }));
    if (coverageKey && COVERAGE_SCHEMES[coverageKey]) {
      const defs = COVERAGE_SCHEMES[coverageKey].defaults;
      defenders.forEach((d, i) => { if (defs[i]) d.zone = defs[i]; });
    }
    return {
      name: name || `Defense ${defPlaybook.length + 1}`,
      formation: formationKey,
      coverageScheme: coverageKey,
      defenders,
    };
  }

  // ---- Custom Formations ----
  let customFormations = [];


  async function loadCustomFormations() {
    try {
      const res = await fetch('/api/store/7on7-custom-formations');
      if (res.ok) {
        const { value } = await res.json();
        if (value) { customFormations = JSON.parse(value); return; }
      }
    } catch {}
    try {
      const data = localStorage.getItem('7on7-custom-formations');
      customFormations = data ? JSON.parse(data) : [];
    } catch { customFormations = []; }
  }

  function handleAuthError(res) {
    if (res.status === 401) { window.location.href = '/editor/login'; }
  }

  function saveCustomFormations() {
    const json = JSON.stringify(customFormations);
    localStorage.setItem('7on7-custom-formations', json);
    fetch('/api/store/7on7-custom-formations', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: json })
    }).then(handleAuthError).catch(() => {});
  }

  function renderFormationSelect() {
    const sel = document.getElementById('formation-select');
    sel.innerHTML = '';
    // Default empty option
    const def = document.createElement('option');
    def.value = ''; def.textContent = 'Formation';
    sel.appendChild(def);
    // Built-in group
    const bg = document.createElement('optgroup');
    bg.label = 'Built-in';
    BUILTIN_FORMATIONS.forEach(f => {
      const o = document.createElement('option');
      o.value = f.value; o.textContent = f.label;
      bg.appendChild(o);
    });
    sel.appendChild(bg);
    // Custom group
    if (customFormations.length > 0) {
      const cg = document.createElement('optgroup');
      cg.label = 'Custom';
      customFormations.forEach(f => {
        const o = document.createElement('option');
        o.value = 'custom:' + f.name; o.textContent = f.name;
        cg.appendChild(o);
      });
      sel.appendChild(cg);
    }
  }


  function createDefaultPlayers() {
    return {
      offense: formationOffense('spread'),
      defense: defaultDefense()
    };
  }

  function defaultDefense() {
    const cx = FIELD_WIDTH / 2;
    const losY = FIELD_HEIGHT - ENDZONE_HEIGHT - 124;
    return [
      { x: cx - 220, y: losY - 30, label: 'CB' },
      { x: cx + 220, y: losY - 30, label: 'CB' },
      { x: cx - 100, y: losY - 25, label: 'NB' },
      { x: cx + 100, y: losY - 25, label: 'NB' },
      { x: cx, y: losY - 40, label: 'LB' },
      { x: cx - 60, y: losY - 80, label: 'S' },
      { x: cx + 60, y: losY - 80, label: 'S' },
    ];
  }

  function createPlay(name, formationKey) {
    formationKey = formationKey || 'spread';
    let offensePlayers;
    if (formationKey.startsWith('custom:')) {
      const cfName = formationKey.slice(7);
      const cf = customFormations.find(f => f.name === cfName);
      offensePlayers = cf ? JSON.parse(JSON.stringify(cf.offense)) : formationOffense('spread');
    } else {
      offensePlayers = formationOffense(formationKey) || formationOffense('spread');
    }
    return {
      name: name || `Play ${playbook.length + 1}`,
      formation: formationKey,
      offense: offensePlayers,
      defense: defaultDefense(),
      routes: [],   // { playerIndex, type, waypoints, style, isMotion }
    };
  }

  // ---- State ----
  let playbook = [];
  let currentPlayIndex = 0;
  let mode = 'move';       // 'move' | 'route' | 'motion' | 'eraser' | 'zone' | 'swap'
  let swapFirstPlayer = null; // { index: number } for swap mode
  let routeStyle = 'solid';
  let currentPlaybookMode = 'offense'; // 'offense' | 'defense'
  let defPlaybook = [];
  let currentDefPlayIndex = 0;

  // ---- Formation Splits ----
  // { 'bunch-r': [ { name: 'X side', labels: ['X','C'] }, { name: 'Bunch side', labels: ['Y','Z','R','H'] } ] }
  let formationSplits = {};

  // ---- Undo / Redo ----
  const MAX_UNDO = 50;
  let undoStack = [];
  let redoStack = [];
  let defUndoStack = [];
  let defRedoStack = [];
  let _lastPlaybookSnap = null;
  let _lastDefPlaybookSnap = null;
  let _isUndoing = false;


  let dragging = null;          // player drag: { playerIndex, type }
  let draggingWaypoint = null;  // waypoint drag: { routeIndex, waypointIndex }
  let draggingCurveHandle = null; // curve handle drag: { routeIndex, waypointIndex }
  let draggingCrossNumber = null; // cross number drag: { routeIndex, waypointIndex }
  let dragOffset = { x: 0, y: 0 };
  let routeDrawing = null;
  let hoveredRoute = -1;        // route index under cursor (for showing handles)

  // Animation state
  let animating = false;
  let animProgress = 0;
  let animRAF = null;

  // ---- DOM ----
  const canvas = document.getElementById('field-canvas');
  const ctx = canvas.getContext('2d');
  const playNameInput = document.getElementById('play-name');
  const playListEl = document.getElementById('play-list');
  const statusMode = document.getElementById('status-mode');
  const statusInfo = document.getElementById('status-info');
  const printArea = document.getElementById('print-area');

  canvas.width = FIELD_WIDTH;
  canvas.height = FIELD_HEIGHT;

  function resizeCanvasDisplay() {
    const area = document.getElementById('canvas-area');
    const availW = area.clientWidth - 20;   // padding
    const availH = area.clientHeight - 40;  // padding + status bar
    const ratio = FIELD_WIDTH / FIELD_HEIGHT;
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

  // (Color & BW drawing functions imported from render.js)

  function drawActiveRoute() {
    if (!routeDrawing || routeDrawing.waypoints.length < 1) return;
    const color = routeDrawing.type === 'offense'
      ? COLORS_O[routeDrawing.playerIndex % COLORS_O.length]
      : COLOR_D;

    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.5;

    const rawWps = routeDrawing.waypoints;

    // Segment-by-segment preview (supports mixed motion/route)
    let inRoutePath = false;
    for (let i = 0; i < rawWps.length - 1; i++) {
      const A = rawWps[i];
      const B = rawWps[i + 1];
      const segMotion = !!B.isMotion;

      if (segMotion) {
        if (inRoutePath) { ctx.stroke(); ctx.setLineDash([]); inRoutePath = false; }
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = color;
        drawWavyLine(ctx, A.x, A.y, B.x, B.y);
      } else {
        if (!inRoutePath) {
          ctx.lineWidth = 3;
          ctx.strokeStyle = color;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(A.x, A.y);
          inRoutePath = true;
        }
        ctx.lineTo(B.x, B.y);
      }
    }
    if (inRoutePath) { ctx.stroke(); ctx.setLineDash([]); }

    ctx.globalAlpha = 1.0;
    routeDrawing.waypoints.forEach((wp, i) => {
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = i > 0 && wp.isMotion ? '#ff922b' : color;
      ctx.fill();
    });
  }

  // Draw waypoint handles for a route (edit affordance)
  function drawWaypointHandles(c, play) {
    if (hoveredRoute < 0 || hoveredRoute >= play.routes.length) return;
    const route = play.routes[hoveredRoute];
    const color = route.type === 'offense'
      ? COLORS_O[route.playerIndex % COLORS_O.length]
      : COLOR_D;

    // Draw all waypoints except [0] (player origin)
    for (let i = 1; i < route.waypoints.length; i++) {
      const wp = route.waypoints[i];
      // Outer ring
      c.beginPath();
      c.arc(wp.x, wp.y, 6, 0, Math.PI * 2);
      c.fillStyle = '#fff';
      c.fill();
      // Inner dot: orange for motion segments, player color for route segments
      c.beginPath();
      c.arc(wp.x, wp.y, 4, 0, Math.PI * 2);
      c.fillStyle = wp.isMotion ? '#ff922b' : color;
      c.fill();
    }
  }

  // Draw curve control handles (diamond shape) for the hovered route
  function drawCurveHandles(c, play) {
    if (hoveredRoute < 0 || hoveredRoute >= play.routes.length) return;
    const route = play.routes[hoveredRoute];
    const wps = route.waypoints;

    for (let i = 1; i < wps.length; i++) {
      if (wps[i].isMotion) continue; // skip curve handles for motion segments
      const A = wps[i - 1];
      const B = wps[i];
      const cv = B.curve || 0;
      let hx, hy;
      if (cv !== 0) {
        const cp = getCurveControlPoint(A, B, cv);
        hx = cp.x; hy = cp.y;
      } else {
        hx = (A.x + B.x) / 2;
        hy = (A.y + B.y) / 2;
      }

      // Dashed guide line from midpoint to handle (only if curved)
      if (cv !== 0) {
        c.strokeStyle = 'rgba(255,255,255,0.3)';
        c.lineWidth = 1;
        c.setLineDash([3, 3]);
        c.beginPath();
        c.moveTo((A.x + B.x) / 2, (A.y + B.y) / 2);
        c.lineTo(hx, hy);
        c.stroke();
        c.setLineDash([]);
      }

      // Diamond shape
      const size = cv !== 0 ? 5 : 4;
      c.globalAlpha = cv !== 0 ? 0.8 : 0.4;
      c.fillStyle = '#ffd93d';
      c.beginPath();
      c.moveTo(hx, hy - size);
      c.lineTo(hx + size, hy);
      c.lineTo(hx, hy + size);
      c.lineTo(hx - size, hy);
      c.closePath();
      c.fill();
      c.strokeStyle = '#fff';
      c.lineWidth = 1;
      c.stroke();
      c.globalAlpha = 1.0;
    }
  }

  // Draw handles for ALL routes when dragging a waypoint
  function drawAllWaypointHandles(c, play) {
    play.routes.forEach(route => {
      const color = route.type === 'offense'
        ? COLORS_O[route.playerIndex % COLORS_O.length]
        : COLOR_D;
      for (let i = 1; i < route.waypoints.length; i++) {
        const wp = route.waypoints[i];
        c.beginPath();
        c.arc(wp.x, wp.y, 5, 0, Math.PI * 2);
        c.fillStyle = 'rgba(255,255,255,0.3)';
        c.fill();
      }
    });
    // Highlight the dragged route's handles
    if (draggingWaypoint) {
      const route = play.routes[draggingWaypoint.routeIndex];
      if (route) {
        const color = route.type === 'offense'
          ? COLORS_O[route.playerIndex % COLORS_O.length]
          : COLOR_D;
        for (let i = 1; i < route.waypoints.length; i++) {
          const wp = route.waypoints[i];
          c.beginPath();
          c.arc(wp.x, wp.y, 6, 0, Math.PI * 2);
          c.fillStyle = '#fff';
          c.fill();
          c.beginPath();
          c.arc(wp.x, wp.y, 4, 0, Math.PI * 2);
          c.fillStyle = i === draggingWaypoint.waypointIndex ? '#e94560' : (wp.isMotion ? '#ff922b' : color);
          c.fill();
        }
      }
    }
  }

  // ---- Render ----
  function render(progress) {
    ctx.clearRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

    if (currentPlaybookMode === 'defense') {
      drawFieldDefenseTo(ctx);
      const play = currentDefPlay();
      if (!play) return;
      drawZonesTo(ctx, play);
      drawZoneAssignmentLines(ctx, play);
      drawGhostOffense(ctx);
      drawDefendersDefMode(ctx, play);
      return;
    }

    drawFieldTo(ctx);
    const play = currentPlay();
    if (!play) return;
    const splitLabels = getSplitLabelsForPlay(play);
    if (splitLabels) {
      drawRoutesFilteredTo(ctx, play, splitLabels, progress);
    } else {
      drawRoutesTo(ctx, play, progress);
    }
    drawActiveRoute();
    // Show waypoint handles in move mode (on screen only)
    if (mode === 'move' && typeof progress === 'undefined') {
      if (draggingWaypoint) {
        drawAllWaypointHandles(ctx, play);
      } else if (draggingCurveHandle) {
        drawCurveHandles(ctx, play);
      } else {
        drawWaypointHandles(ctx, play);
        drawCurveHandles(ctx, play);
      }
    }
    if (splitLabels) {
      drawPlayersFilteredTo(ctx, play, splitLabels);
    } else {
      drawPlayersTo(ctx, play);
    }
    if (mode === 'swap' && swapFirstPlayer !== null) {
      const p = play.offense[swapFirstPlayer.index];
      ctx.beginPath();
      ctx.arc(p.x, p.y, PLAYER_RADIUS + 4, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffd93d';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  // ---- Sidebar ----
  function renderPlayList() {
    playListEl.innerHTML = '';

    if (currentPlaybookMode === 'defense') {
      renderDefPlayList();
      return;
    }

    // Group plays by formation
    const groups = {};
    const order = [];
    playbook.forEach((play, i) => {
      const key = play.formation || 'spread';
      if (!groups[key]) {
        groups[key] = [];
        order.push(key);
      }
      groups[key].push(i);
    });

    let collapsed = {};
    try {
      const c = localStorage.getItem('7on7-collapsed');
      collapsed = c ? JSON.parse(c) : {};
    } catch { collapsed = {}; }

    // Helper: swap two plays in playbook array
    function swapPlays(idxA, idxB) {
      [playbook[idxA], playbook[idxB]] = [playbook[idxB], playbook[idxA]];
      if (currentPlayIndex === idxA) currentPlayIndex = idxB;
      else if (currentPlayIndex === idxB) currentPlayIndex = idxA;
      savePlaybook();
      renderPlayList();
      render();
    }

    // Helper: create play <li> with optional ▲▼ buttons
    function makePlayLi(i, siblingIndices, extraStyle) {
      const play = playbook[i];
      const li = document.createElement('li');
      li.className = 'play-item';
      if (extraStyle) li.style.paddingLeft = extraStyle;
      if (i === currentPlayIndex) li.classList.add('active');

      const nameSpan = document.createElement('span');
      nameSpan.className = 'play-item-name';
      nameSpan.textContent = play.name;
      li.appendChild(nameSpan);

      const pos = siblingIndices.indexOf(i);
      const btns = document.createElement('span');
      btns.className = 'play-move-btns';
      if (pos > 0) {
        const up = document.createElement('button');
        up.className = 'play-move-btn';
        up.textContent = '\u25b2';
        up.title = 'Move up';
        up.addEventListener('click', (e) => { e.stopPropagation(); swapPlays(i, siblingIndices[pos - 1]); });
        btns.appendChild(up);
      }
      if (pos < siblingIndices.length - 1) {
        const dn = document.createElement('button');
        dn.className = 'play-move-btn';
        dn.textContent = '\u25bc';
        dn.title = 'Move down';
        dn.addEventListener('click', (e) => { e.stopPropagation(); swapPlays(i, siblingIndices[pos + 1]); });
        btns.appendChild(dn);
      }
      li.appendChild(btns);

      li.addEventListener('click', () => {
        stopAnimation();
        currentPlayIndex = i;
        playNameInput.value = play.name;
        cancelRoute();
        renderPlayList();
        render();
      });
      return li;
    }

    order.forEach(formKey => {
      const label = getFormationLabel(formKey);
      const indices = groups[formKey];
      const splits = formationSplits[formKey];

      const header = document.createElement('li');
      header.className = 'formation-header';
      const arrow = collapsed[formKey] ? '\u25b8' : '\u25be';
      header.innerHTML = `<span class="formation-arrow">${arrow}</span> ${label}` +
        (splits ? ' <span class="split-badge">SPLIT</span>' : '') +
        ` <span class="formation-count">(${indices.length})</span>`;
      header.addEventListener('click', () => {
        collapsed[formKey] = !collapsed[formKey];
        localStorage.setItem('7on7-collapsed', JSON.stringify(collapsed));
        renderPlayList();
      });
      playListEl.appendChild(header);

      if (!collapsed[formKey]) {
        if (splits) {
          splits.forEach((group, gi) => {
            const groupIndices = indices.filter(i => playbook[i].splitGroup === gi);
            const sgKey = formKey + ':sg' + gi;
            const sgArrow = collapsed[sgKey] ? '\u25b8' : '\u25be';
            const sgHeader = document.createElement('li');
            sgHeader.className = 'split-group-header';
            sgHeader.innerHTML = `<span class="formation-arrow">${sgArrow}</span> ${group.name} <span class="formation-count">(${groupIndices.length})</span>`;
            sgHeader.addEventListener('click', (e) => {
              e.stopPropagation();
              collapsed[sgKey] = !collapsed[sgKey];
              localStorage.setItem('7on7-collapsed', JSON.stringify(collapsed));
              renderPlayList();
            });
            playListEl.appendChild(sgHeader);
            if (!collapsed[sgKey]) {
              groupIndices.forEach(i => playListEl.appendChild(makePlayLi(i, groupIndices, '28px')));
            }
          });
          // Unsorted plays (no splitGroup assigned)
          const unsorted = indices.filter(i => playbook[i].splitGroup == null);
          unsorted.forEach(i => playListEl.appendChild(makePlayLi(i, unsorted)));
        } else {
          indices.forEach(i => playListEl.appendChild(makePlayLi(i, indices)));
        }
      }
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

    let collapsed = {};
    try {
      const c = localStorage.getItem('7on7-def-collapsed');
      collapsed = c ? JSON.parse(c) : {};
    } catch { collapsed = {}; }

    order.forEach(formKey => {
      const label = getDefFormationLabel(formKey);
      const indices = groups[formKey];
      const header = document.createElement('li');
      header.className = 'formation-header';
      const arrow = collapsed[formKey] ? '\u25b8' : '\u25be';
      header.innerHTML = `<span class="formation-arrow">${arrow}</span> ${label} <span class="formation-count">(${indices.length})</span>`;
      header.addEventListener('click', () => {
        collapsed[formKey] = !collapsed[formKey];
        localStorage.setItem('7on7-def-collapsed', JSON.stringify(collapsed));
        renderPlayList();
      });
      playListEl.appendChild(header);

      if (!collapsed[formKey]) {
        indices.forEach(i => {
          const play = defPlaybook[i];
          const li = document.createElement('li');
          li.className = 'play-item';
          li.textContent = play.name;
          if (i === currentDefPlayIndex) li.classList.add('active');
          li.addEventListener('click', () => {
            stopAnimation();
            currentDefPlayIndex = i;
            playNameInput.value = play.name;
            hideZonePicker(); hideWaypointPicker();
            renderPlayList();
            render();
            syncDefToolbar();
          });
          playListEl.appendChild(li);
        });
      }
    });
  }

  // Migrate legacy data to current format
  function migratePlaybook(pb) {
    pb.forEach(play => {
      play.routes.forEach(route => {
        // Legacy: global curved flag → per-waypoint curve
        if (route.curved) {
          for (let i = 1; i < route.waypoints.length; i++) {
            if (route.waypoints[i].curve === undefined) {
              route.waypoints[i].curve = 40;
            }
          }
          delete route.curved;
        }
        // Migrate route-level isMotion → per-waypoint isMotion
        if (route.waypoints.length >= 2) {
          const needsMigration = route.waypoints.slice(1).every(wp => wp.isMotion === undefined);
          if (needsMigration) {
            const motionVal = !!route.isMotion;
            for (let i = 1; i < route.waypoints.length; i++) {
              route.waypoints[i].isMotion = motionVal;
            }
          }
        }
      });
      if (!play.formation) {
        play.formation = 'spread';
      }
    });
    return pb;
  }

  // ---- Load / Save ----
  async function loadPlaybook() {
    // Check URL hash first
    if (window.location.hash.length > 1) {
      try {
        const decoded = decodeFromURL(window.location.hash.slice(1));
        if (decoded && decoded.length > 0) {
          playbook = migratePlaybook(decoded);
          currentPlayIndex = 0;
          history.replaceState(null, '', window.location.pathname);
          savePlaybook();
          return;
        }
      } catch { /* ignore, fall through */ }
    }

    // Try loading from server DB first
    try {
      const res = await fetch('/api/store/7on7-playbook');
      if (res.ok) {
        const { value } = await res.json();
        if (value) {
          playbook = migratePlaybook(JSON.parse(value));
          if (playbook.length === 0) playbook.push(createPlay());
          currentPlayIndex = 0;
          return;
        }
      }
    } catch {} // Server not available, fall through to localStorage

    // Fallback to localStorage
    try {
      const data = localStorage.getItem('7on7-playbook');
      if (data) {
        playbook = migratePlaybook(JSON.parse(data));
        if (playbook.length === 0) playbook.push(createPlay());
      } else {
        playbook = [createPlay()];
      }
    } catch {
      playbook = [createPlay()];
    }
    currentPlayIndex = 0;
  }

  function savePlaybook() {
    if (!_isUndoing && _lastPlaybookSnap !== null) {
      undoStack.push(_lastPlaybookSnap);
      if (undoStack.length > MAX_UNDO) undoStack.shift();
      redoStack = [];
      updateUndoButtons();
    }
    _lastPlaybookSnap = JSON.stringify({ pb: playbook, idx: currentPlayIndex });
    const json = JSON.stringify(playbook);
    localStorage.setItem('7on7-playbook', json);
    fetch('/api/store/7on7-playbook', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: json })
    }).then(handleAuthError).catch(() => {});
  }

  function currentPlay() {
    return playbook[currentPlayIndex];
  }

  function currentDefPlay() {
    return defPlaybook[currentDefPlayIndex];
  }

  // ---- Formation Split Helpers ----
  function getSplitLabelsForPlay(play) {
    if (play.splitGroup == null) return null;
    const splits = formationSplits[play.formation];
    if (!splits || !splits[play.splitGroup]) return null;
    return splits[play.splitGroup].labels;
  }

  function getSplitGroupName(play) {
    if (play.splitGroup == null) return null;
    const splits = formationSplits[play.formation];
    if (!splits || !splits[play.splitGroup]) return null;
    return splits[play.splitGroup].name;
  }

  // ---- Formation Splits Load / Save ----
  async function loadFormationSplits() {
    try {
      const res = await fetch('/api/store/7on7-formation-splits');
      if (res.ok) {
        const { value } = await res.json();
        if (value) { formationSplits = JSON.parse(value); return; }
      }
    } catch {}
    try {
      const data = localStorage.getItem('7on7-formation-splits');
      if (data) formationSplits = JSON.parse(data);
    } catch {}
  }

  function saveFormationSplits() {
    const json = JSON.stringify(formationSplits);
    localStorage.setItem('7on7-formation-splits', json);
    fetch('/api/store/7on7-formation-splits', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: json })
    }).then(handleAuthError).catch(() => {});
  }

  // ---- Defense Playbook Load / Save ----
  async function loadDefPlaybook() {
    try {
      const res = await fetch('/api/store/7on7-defensive-playbook');
      if (res.ok) {
        const { value } = await res.json();
        if (value) {
          defPlaybook = JSON.parse(value);
          if (defPlaybook.length === 0) defPlaybook.push(createDefensivePlay());
          currentDefPlayIndex = 0;
          return;
        }
      }
    } catch {}
    try {
      const data = localStorage.getItem('7on7-defensive-playbook');
      if (data) {
        defPlaybook = JSON.parse(data);
        if (defPlaybook.length === 0) defPlaybook.push(createDefensivePlay());
      } else {
        defPlaybook = [createDefensivePlay()];
      }
    } catch {
      defPlaybook = [createDefensivePlay()];
    }
    currentDefPlayIndex = 0;
  }

  function saveDefPlaybook() {
    if (!_isUndoing && _lastDefPlaybookSnap !== null) {
      defUndoStack.push(_lastDefPlaybookSnap);
      if (defUndoStack.length > MAX_UNDO) defUndoStack.shift();
      defRedoStack = [];
      updateUndoButtons();
    }
    _lastDefPlaybookSnap = JSON.stringify({ pb: defPlaybook, idx: currentDefPlayIndex });
    const json = JSON.stringify(defPlaybook);
    localStorage.setItem('7on7-defensive-playbook', json);
    fetch('/api/store/7on7-defensive-playbook', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: json })
    }).then(handleAuthError).catch(() => {});
  }

  // ============================================================
  // URL SHARING (compress playbook into URL hash)
  // ============================================================
  function encodeToURL(pb) {
    // Compact format: round coords to integers, strip unnecessary data
    const compact = pb.map(play => ({
      n: play.name,
      f: play.formation,
      o: play.offense.map(p => [Math.round(p.x), Math.round(p.y), p.label]),
      d: play.defense.map(p => [Math.round(p.x), Math.round(p.y), p.label]),
      r: play.routes.map(r => ({
        i: r.playerIndex,
        t: r.type === 'offense' ? 0 : 1,
        w: r.waypoints.map((w, wi) => {
          const arr = [Math.round(w.x), Math.round(w.y)];
          const hasCurve = !!w.curve;
          const hasMotion = wi > 0 && w.isMotion;
          const hasCross = !!w.crossNumber;
          const hasCrossT = hasCross && w.crossT !== undefined && w.crossT !== 1.0;
          if (hasCurve || hasMotion || hasCross || hasCrossT) arr.push(hasCurve ? Math.round(w.curve) : 0);
          if (hasMotion || hasCross || hasCrossT) arr.push(hasMotion ? 1 : 0);
          if (hasCross || hasCrossT) arr.push(w.crossNumber || 0);
          if (hasCrossT) arr.push(Math.round(w.crossT * 100) / 100);
          return arr;
        }),
        s: r.style === 'dashed' ? 1 : 0,
        m: r.isMotion ? 1 : 0,
      }))
    }));
    const json = JSON.stringify(compact);
    // Use base64
    return btoa(unescape(encodeURIComponent(json)));
  }

  function decodeFromURL(hash) {
    const json = decodeURIComponent(escape(atob(hash)));
    const compact = JSON.parse(json);
    return compact.map(c => ({
      name: c.n,
      formation: c.f || 'spread',
      offense: c.o.map(p => ({ x: p[0], y: p[1], label: p[2] })),
      defense: c.d.map(p => ({ x: p[0], y: p[1], label: p[2] })),
      routes: c.r.map(r => {
        const route = {
          playerIndex: r.i,
          type: r.t === 0 ? 'offense' : 'defense',
          waypoints: r.w.map((w, wi) => {
            const wp = { x: w[0], y: w[1] };
            if (w[2] !== undefined && w[2] !== 0) wp.curve = w[2];
            if (w[3] === 1 && wi > 0) wp.isMotion = true;
            if (w[4] !== undefined && w[4] > 0) wp.crossNumber = w[4];
            if (w[5] !== undefined) wp.crossT = w[5];
            return wp;
          }),
          style: r.s === 1 ? 'dashed' : 'solid',
          isMotion: r.m === 1,
        };
        // Legacy: global curved flag → per-waypoint curve
        if (r.c === 1) {
          for (let i = 1; i < route.waypoints.length; i++) {
            if (!route.waypoints[i].curve) route.waypoints[i].curve = 40;
          }
        }
        return route;
      })
    }));
  }

  // ============================================================
  // ANIMATION
  // ============================================================
  function startAnimation() {
    if (animating) { stopAnimation(); return; }
    animating = true;
    animProgress = 0;
    const btn = document.getElementById('btn-animate');
    btn.textContent = '⏹ Stop';
    btn.classList.add('playing');

    const duration = 2000; // ms
    const start = performance.now();
    function tick(now) {
      const elapsed = now - start;
      animProgress = Math.min(1, elapsed / duration);
      render(animProgress);
      if (animProgress < 1) {
        animRAF = requestAnimationFrame(tick);
      } else {
        stopAnimation();
      }
    }
    animRAF = requestAnimationFrame(tick);
  }

  function stopAnimation() {
    if (animRAF) cancelAnimationFrame(animRAF);
    animRAF = null;
    animating = false;
    animProgress = 0;
    const btn = document.getElementById('btn-animate');
    btn.textContent = '▶ Play';
    btn.classList.remove('playing');
    render();
  }

  // ============================================================
  // UNDO / REDO
  // ============================================================
  function updateUndoButtons() {
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    if (!btnUndo) return;
    if (currentPlaybookMode === 'defense') {
      btnUndo.disabled = defUndoStack.length === 0;
      btnRedo.disabled = defRedoStack.length === 0;
    } else {
      btnUndo.disabled = undoStack.length === 0;
      btnRedo.disabled = redoStack.length === 0;
    }
  }

  function undo() {
    stopAnimation();
    cancelRoute();
    hideZonePicker(); hideWaypointPicker();
    if (currentPlaybookMode === 'defense') {
      if (defUndoStack.length === 0) return;
      defRedoStack.push(JSON.stringify({ pb: defPlaybook, idx: currentDefPlayIndex }));
      const snap = JSON.parse(defUndoStack.pop());
      defPlaybook = snap.pb;
      currentDefPlayIndex = Math.min(snap.idx, defPlaybook.length - 1);
      _isUndoing = true; saveDefPlaybook(); _isUndoing = false;
      playNameInput.value = currentDefPlay().name;
      syncDefToolbar();
    } else {
      if (undoStack.length === 0) return;
      redoStack.push(JSON.stringify({ pb: playbook, idx: currentPlayIndex }));
      const snap = JSON.parse(undoStack.pop());
      playbook = snap.pb;
      currentPlayIndex = Math.min(snap.idx, playbook.length - 1);
      _isUndoing = true; savePlaybook(); _isUndoing = false;
      playNameInput.value = currentPlay().name;
    }
    hoveredRoute = -1;
    updateUndoButtons();
    renderPlayList();
    render();
  }

  function redo() {
    stopAnimation();
    cancelRoute();
    hideZonePicker(); hideWaypointPicker();
    if (currentPlaybookMode === 'defense') {
      if (defRedoStack.length === 0) return;
      defUndoStack.push(JSON.stringify({ pb: defPlaybook, idx: currentDefPlayIndex }));
      const snap = JSON.parse(defRedoStack.pop());
      defPlaybook = snap.pb;
      currentDefPlayIndex = Math.min(snap.idx, defPlaybook.length - 1);
      _isUndoing = true; saveDefPlaybook(); _isUndoing = false;
      playNameInput.value = currentDefPlay().name;
      syncDefToolbar();
    } else {
      if (redoStack.length === 0) return;
      undoStack.push(JSON.stringify({ pb: playbook, idx: currentPlayIndex }));
      const snap = JSON.parse(redoStack.pop());
      playbook = snap.pb;
      currentPlayIndex = Math.min(snap.idx, playbook.length - 1);
      _isUndoing = true; savePlaybook(); _isUndoing = false;
      playNameInput.value = currentPlay().name;
    }
    hoveredRoute = -1;
    updateUndoButtons();
    renderPlayList();
    render();
  }

  // ============================================================
  // HIT TESTING
  // ============================================================
  function findPlayerAt(x, y) {
    const play = currentPlay();
    const splitLabels = getSplitLabelsForPlay(play);
    const isRouteMode = mode === 'route' || mode === 'motion';
    for (let i = play.offense.length - 1; i >= 0; i--) {
      const p = play.offense[i];
      if ((p.x - x) ** 2 + (p.y - y) ** 2 <= SNAP_THRESHOLD ** 2) {
        // In route/motion mode with split, only allow group players
        if (isRouteMode && splitLabels && !splitLabels.includes(p.label)) continue;
        return { index: i, type: 'offense' };
      }
    }
    for (let i = play.defense.length - 1; i >= 0; i--) {
      const p = play.defense[i];
      if ((p.x - x) ** 2 + (p.y - y) ** 2 <= SNAP_THRESHOLD ** 2)
        return { index: i, type: 'defense' };
    }
    return null;
  }

  function findRouteAt(x, y) {
    const play = currentPlay();
    for (let i = play.routes.length - 1; i >= 0; i--) {
      const route = play.routes[i];
      const hasCurve = route.waypoints.some(wp => wp.curve);
      const wps = hasCurve ? flattenMixedRoute(route.waypoints) : route.waypoints;
      for (let j = 0; j < wps.length - 1; j++) {
        const a = wps[j], b = wps[j + 1];
        if (distToSeg(x, y, a.x, a.y, b.x, b.y) < 10) return i;
      }
    }
    return -1;
  }

  function performSwap(play, indexA, indexB) {
    const a = play.offense[indexA], b = play.offense[indexB];
    // Swap player coordinates
    const tmpX = a.x, tmpY = a.y;
    a.x = b.x; a.y = b.y;
    b.x = tmpX; b.y = tmpY;
    // Swap route ownership — routes stay in place on the field
    play.routes.forEach(r => {
      if (r.type === 'offense') {
        if (r.playerIndex === indexA) r.playerIndex = -(indexB + 1);
        else if (r.playerIndex === indexB) r.playerIndex = -(indexA + 1);
      }
    });
    play.routes.forEach(r => {
      if (r.playerIndex < 0) r.playerIndex = -(r.playerIndex + 1);
    });
  }

  const WP_HIT_RADIUS = 8;

  function findWaypointAt(x, y) {
    const play = currentPlay();
    // Search routes in reverse (top-most first), skip waypoint[0] (that's the player origin)
    for (let ri = play.routes.length - 1; ri >= 0; ri--) {
      const wps = play.routes[ri].waypoints;
      for (let wi = 1; wi < wps.length; wi++) {
        if ((wps[wi].x - x) ** 2 + (wps[wi].y - y) ** 2 <= WP_HIT_RADIUS ** 2)
          return { routeIndex: ri, waypointIndex: wi };
      }
    }
    return null;
  }

  const CURVE_HANDLE_HIT_RADIUS = 10;

  function findCurveHandleAt(x, y) {
    const play = currentPlay();
    for (let ri = play.routes.length - 1; ri >= 0; ri--) {
      const route = play.routes[ri];
      const wps = route.waypoints;
      for (let wi = 1; wi < wps.length; wi++) {
        if (wps[wi].isMotion) continue; // skip motion segments
        const A = wps[wi - 1];
        const B = wps[wi];
        const c = B.curve || 0;
        let hx, hy;
        if (c !== 0) {
          const cp = getCurveControlPoint(A, B, c);
          hx = cp.x; hy = cp.y;
        } else {
          hx = (A.x + B.x) / 2;
          hy = (A.y + B.y) / 2;
        }
        if ((hx - x) ** 2 + (hy - y) ** 2 <= CURVE_HANDLE_HIT_RADIUS ** 2) {
          return { routeIndex: ri, waypointIndex: wi };
        }
      }
    }
    return null;
  }

  function distToSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - ax, py - ay);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  // Project a point onto a polyline, returning t value (0..1) along total length
  function projectOntoPolyline(pts, px, py, tLen) {
    let bestDist = Infinity;
    let bestLen = 0;
    let cumLen = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i].x, ay = pts[i].y;
      const bx = pts[i + 1].x, by = pts[i + 1].y;
      const segLen = Math.hypot(bx - ax, by - ay);
      if (segLen === 0) continue;
      const dx = bx - ax, dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
      const dist = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      if (dist < bestDist) {
        bestDist = dist;
        bestLen = cumLen + t * segLen;
      }
      cumLen += segLen;
    }
    return tLen > 0 ? bestLen / tLen : 0;
  }

  const CROSS_HIT_RADIUS = 12;

  function findCrossNumberAt(x, y) {
    const play = currentPlay();
    for (let ri = play.routes.length - 1; ri >= 0; ri--) {
      const route = play.routes[ri];
      const rawWps = route.waypoints;
      for (let wi = 1; wi < rawWps.length; wi++) {
        const wp = rawWps[wi];
        if (!wp.crossNumber) continue;
        const t = (wp.crossT !== undefined) ? wp.crossT : 1.0;
        const pos = crossNumberPosition(rawWps, wi, t);
        if ((pos.x - x) ** 2 + (pos.y - y) ** 2 <= CROSS_HIT_RADIUS ** 2)
          return { routeIndex: ri, waypointIndex: wi };
      }
    }
    return null;
  }

  // ============================================================
  // CANVAS EVENTS
  // ============================================================
  function getPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
  }

  // Defense mode: find defender at position
  function findDefenderAt(x, y) {
    const play = currentDefPlay();
    if (!play) return -1;
    for (let i = play.defenders.length - 1; i >= 0; i--) {
      const d = play.defenders[i];
      const dy = fy(d.y);
      if ((d.x - x) ** 2 + (dy - y) ** 2 <= SNAP_THRESHOLD ** 2) return i;
    }
    return -1;
  }

  canvas.addEventListener('mousedown', (e) => {
    if (animating) return;
    const pos = getPos(e);

    // Defense mode handling
    if (currentPlaybookMode === 'defense') {
      const play = currentDefPlay();
      if (!play) return;
      const di = findDefenderAt(pos.x, pos.y);
      if (mode === 'move' && di >= 0) {
        const d = play.defenders[di];
        dragging = { playerIndex: di, type: 'defender' };
        dragOffset = { x: pos.x - d.x, y: pos.y - fy(d.y) };
        canvas.style.cursor = 'grabbing';
        hideZonePicker(); hideWaypointPicker();
      } else if (mode === 'zone' && di >= 0) {
        showZonePicker(di, pos);
      } else {
        hideZonePicker(); hideWaypointPicker();
      }
      return;
    }

    const play = currentPlay();
    hideWaypointPicker();

    if (mode === 'move') {
      // Priority: player > crossNumber > waypoint > curveHandle
      const hit = findPlayerAt(pos.x, pos.y);
      if (hit) {
        const p = hit.type === 'offense' ? play.offense[hit.index] : play.defense[hit.index];
        dragging = { playerIndex: hit.index, type: hit.type };
        dragOffset = { x: pos.x - p.x, y: pos.y - p.y };
        canvas.style.cursor = 'grabbing';
      } else {
        const crossHit = findCrossNumberAt(pos.x, pos.y);
        if (crossHit) {
          draggingCrossNumber = crossHit;
          canvas.style.cursor = 'grabbing';
        } else {
          const wpHit = findWaypointAt(pos.x, pos.y);
          if (wpHit) {
            draggingWaypoint = wpHit;
            canvas.style.cursor = 'grabbing';
          } else {
            const chHit = findCurveHandleAt(pos.x, pos.y);
            if (chHit) {
              draggingCurveHandle = chHit;
              hoveredRoute = chHit.routeIndex;
              canvas.style.cursor = 'grabbing';
            }
          }
        }
      }
    } else if (mode === 'route' || mode === 'motion') {
      if (!routeDrawing) {
        const hit = findPlayerAt(pos.x, pos.y);
        if (hit) {
          const p = hit.type === 'offense' ? play.offense[hit.index] : play.defense[hit.index];
          const isMotion = mode === 'motion';
          routeDrawing = {
            playerIndex: hit.index,
            type: hit.type,
            waypoints: [{ x: p.x, y: p.y }],
            isMotion: isMotion,
            currentSegmentMotion: isMotion
          };
          updateDrawingStatus();
        }
      } else {
        routeDrawing.waypoints.push({ x: pos.x, y: pos.y, isMotion: routeDrawing.currentSegmentMotion });
        render();
      }
    } else if (mode === 'eraser') {
      const ri = findRouteAt(pos.x, pos.y);
      if (ri >= 0) {
        play.routes.splice(ri, 1);
        savePlaybook();
        render();
      }
    } else if (mode === 'swap') {
      const hit = findPlayerAt(pos.x, pos.y);
      if (hit && hit.type === 'offense') {
        if (!swapFirstPlayer) {
          swapFirstPlayer = { index: hit.index };
          statusInfo.textContent = `Swap: ${play.offense[hit.index].label} selected. Click second player.`;
          render();
        } else if (hit.index !== swapFirstPlayer.index) {
          performSwap(play, swapFirstPlayer.index, hit.index);
          swapFirstPlayer = null;
          statusInfo.textContent = 'Swap complete. Click two players to swap again.';
          savePlaybook();
          render();
        }
      } else {
        swapFirstPlayer = null;
        statusInfo.textContent = 'Click first player to swap.';
        render();
      }
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (animating) return;
    const pos = getPos(e);

    // Defense mode drag
    if (currentPlaybookMode === 'defense') {
      if (mode === 'move' && dragging && dragging.type === 'defender') {
        const play = currentDefPlay();
        const d = play.defenders[dragging.playerIndex];
        d.x = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, pos.x - dragOffset.x));
        // Screen y → data y: unflip
        const screenY = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, pos.y - dragOffset.y));
        d.y = fy(screenY);
        render();
      } else {
        const di = findDefenderAt(pos.x, pos.y);
        canvas.style.cursor = di >= 0 ? (mode === 'zone' ? 'pointer' : 'grab') : 'default';
      }
      return;
    }

    if (mode === 'move' && dragging) {
      const play = currentPlay();
      const p = dragging.type === 'offense' ? play.offense[dragging.playerIndex] : play.defense[dragging.playerIndex];
      p.x = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, pos.x - dragOffset.x));
      p.y = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, pos.y - dragOffset.y));
      play.routes.forEach(route => {
        if (route.playerIndex === dragging.playerIndex && route.type === dragging.type) {
          route.waypoints[0] = { x: p.x, y: p.y };
        }
      });
      render();
    } else if (mode === 'move' && draggingWaypoint) {
      const play = currentPlay();
      const route = play.routes[draggingWaypoint.routeIndex];
      if (route) {
        const wp = route.waypoints[draggingWaypoint.waypointIndex];
        wp.x = Math.max(0, Math.min(FIELD_WIDTH, pos.x));
        wp.y = Math.max(0, Math.min(FIELD_HEIGHT, pos.y));
        render();
      }
    } else if (mode === 'move' && draggingCurveHandle) {
      const play = currentPlay();
      const route = play.routes[draggingCurveHandle.routeIndex];
      if (route) {
        const wi = draggingCurveHandle.waypointIndex;
        const A = route.waypoints[wi - 1];
        const B = route.waypoints[wi];
        const mx = (A.x + B.x) / 2;
        const my = (A.y + B.y) / 2;
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const len = Math.hypot(dx, dy);
        if (len > 0) {
          const px = -dy / len;
          const py = dx / len;
          const projLen = (pos.x - mx) * px + (pos.y - my) * py;
          B.curve = Math.abs(projLen) < 3 ? 0 : projLen;
        }
        hoveredRoute = draggingCurveHandle.routeIndex;
        render();
      }
    } else if (mode === 'move' && draggingCrossNumber) {
      const play = currentPlay();
      const route = play.routes[draggingCrossNumber.routeIndex];
      if (route) {
        const wi = draggingCrossNumber.waypointIndex;
        const A = route.waypoints[wi - 1];
        const B = route.waypoints[wi];
        const segPts = flattenSegment(A, B);
        const segLen = totalLength(segPts);
        const t = projectOntoPolyline(segPts, pos.x, pos.y, segLen);
        B.crossT = Math.max(0, Math.min(1, t));
        render();
      }
    } else if (mode === 'move') {
      // Update hover state for showing waypoint/curve handles
      const playerHit = findPlayerAt(pos.x, pos.y);
      if (playerHit) {
        hoveredRoute = -1;
        canvas.style.cursor = 'grab';
      } else {
        const crossHit = findCrossNumberAt(pos.x, pos.y);
        if (crossHit) {
          hoveredRoute = crossHit.routeIndex;
          canvas.style.cursor = 'grab';
        } else {
          const wpHit = findWaypointAt(pos.x, pos.y);
          if (wpHit) {
            hoveredRoute = wpHit.routeIndex;
            canvas.style.cursor = 'grab';
          } else {
            const chHit = findCurveHandleAt(pos.x, pos.y);
            if (chHit) {
              hoveredRoute = chHit.routeIndex;
              canvas.style.cursor = 'grab';
            } else {
              const routeHit = findRouteAt(pos.x, pos.y);
              if (routeHit >= 0 && hoveredRoute !== routeHit) {
                hoveredRoute = routeHit;
              } else if (routeHit < 0) {
                hoveredRoute = -1;
              }
              canvas.style.cursor = routeHit >= 0 ? 'pointer' : 'default';
            }
          }
        }
        render();
      }
    } else if (mode === 'route' || mode === 'motion') {
      canvas.style.cursor = routeDrawing ? 'crosshair' : 'pointer';
    } else if (mode === 'eraser') {
      canvas.style.cursor = findRouteAt(pos.x, pos.y) >= 0 ? 'pointer' : 'default';
    } else if (mode === 'swap') {
      const hit = findPlayerAt(pos.x, pos.y);
      canvas.style.cursor = (hit && hit.type === 'offense') ? 'pointer' : 'default';
    }
  });

  canvas.addEventListener('mouseup', () => {
    if (currentPlaybookMode === 'defense' && dragging && dragging.type === 'defender') {
      dragging = null;
      canvas.style.cursor = 'default';
      saveDefPlaybook();
      return;
    }
    if (dragging) {
      dragging = null;
      canvas.style.cursor = 'default';
      savePlaybook();
    }
    if (draggingWaypoint) {
      draggingWaypoint = null;
      canvas.style.cursor = 'default';
      savePlaybook();
      render();
    }
    if (draggingCurveHandle) {
      draggingCurveHandle = null;
      canvas.style.cursor = 'default';
      savePlaybook();
      render();
    }
    if (draggingCrossNumber) {
      draggingCrossNumber = null;
      canvas.style.cursor = 'default';
      savePlaybook();
      render();
    }
  });

  function finalizeRoute() {
    if (!routeDrawing) return;
    if (routeDrawing.waypoints.length >= 2) {
      const wps = [...routeDrawing.waypoints];
      // Route-level isMotion: true only if ALL segments are motion (backward compat)
      const allMotion = wps.slice(1).every(wp => wp.isMotion);
      currentPlay().routes.push({
        playerIndex: routeDrawing.playerIndex,
        type: routeDrawing.type,
        waypoints: wps,
        style: routeStyle,
        isMotion: allMotion,
      });
      savePlaybook();
    }
    routeDrawing = null;
    statusInfo.textContent = '';
    render();
  }

  canvas.addEventListener('dblclick', (e) => {
    if (animating) return;
    if ((mode === 'route' || mode === 'motion') && routeDrawing) {
      const pos = getPos(e);
      routeDrawing.waypoints.push({ x: pos.x, y: pos.y, isMotion: routeDrawing.currentSegmentMotion });
      finalizeRoute();
    }
  });

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (currentPlaybookMode === 'defense') {
      const pos = getPos(e);
      const di = findDefenderAt(pos.x, pos.y);
      if (di >= 0) showZonePicker(di, pos);
      return;
    }
    if ((mode === 'route' || mode === 'motion') && routeDrawing) {
      finalizeRoute();
    } else if (mode === 'move') {
      const pos = getPos(e);
      // Right-click on waypoint handle → show waypoint picker
      const wpHit = findWaypointAt(pos.x, pos.y);
      if (wpHit) {
        showWaypointPicker(wpHit.routeIndex, wpHit.waypointIndex, pos);
      } else {
        // Right-click to delete hovered route or route under cursor
        let target = hoveredRoute;
        if (target < 0) target = findRouteAt(pos.x, pos.y);
        if (target >= 0) {
          currentPlay().routes.splice(target, 1);
          hoveredRoute = -1;
          savePlaybook();
          render();
        }
      }
    }
  });

  function cancelRoute() {
    routeDrawing = null;
    statusInfo.textContent = '';
  }

  function updateDrawingStatus() {
    if (!routeDrawing) return;
    const segType = routeDrawing.currentSegmentMotion ? 'Motion' : 'Route';
    statusInfo.textContent = `Click: add point / T:Motion R:Route (current: ${segType}) / Dbl-click or Right-click: finish`;
  }

  // ---- Keyboard ----
  document.addEventListener('keydown', (e) => {
    // Undo / Redo (works even in input fields)
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Z')) { e.preventDefault(); redo(); return; }
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    // During active drawing, T/R toggle segment type without changing mode
    if (routeDrawing && (e.key === 't' || e.key === 'T')) {
      routeDrawing.currentSegmentMotion = true;
      updateDrawingStatus();
      return;
    }
    if (routeDrawing && (e.key === 'r' || e.key === 'R')) {
      routeDrawing.currentSegmentMotion = false;
      updateDrawingStatus();
      return;
    }
    if (e.key === 'Escape') { cancelRoute(); render(); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && mode === 'move' && hoveredRoute >= 0) {
      currentPlay().routes.splice(hoveredRoute, 1);
      hoveredRoute = -1;
      savePlaybook();
      render();
    }
    else if (e.key === 'm' || e.key === 'M') setMode('move');
    else if ((e.key === 'r' || e.key === 'R') && currentPlaybookMode === 'offense') setMode('route');
    else if ((e.key === 't' || e.key === 'T') && currentPlaybookMode === 'offense') setMode('motion');
    else if (e.key === 'e' || e.key === 'E') setMode('eraser');
    else if ((e.key === 's' || e.key === 'S') && currentPlaybookMode === 'offense') setMode('swap');
    else if ((e.key === 'z' || e.key === 'Z') && currentPlaybookMode === 'defense') setMode('zone');
    else if (e.key === ' ' && currentPlaybookMode === 'offense') { e.preventDefault(); startAnimation(); }
  });

  // ============================================================
  // TOOLBAR
  // ============================================================
  function setMode(m) {
    mode = m;
    cancelRoute();
    hoveredRoute = -1;
    swapFirstPlayer = null;
    hideZonePicker(); hideWaypointPicker();
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    const names = { move: 'Move', route: 'Route', motion: 'Motion', eraser: 'Eraser', zone: 'Zone', swap: 'Swap' };
    statusMode.textContent = `Mode: ${names[mode]}`;
    if (mode === 'route') statusInfo.textContent = 'Click player to start. Press T during drawing to switch to Motion.';
    else if (mode === 'motion') statusInfo.textContent = 'Click player to start. Press R during drawing to switch to Route.';
    else if (mode === 'move' && currentPlaybookMode === 'offense') statusInfo.textContent = 'Right-click waypoint to toggle Motion/Route.';
    else if (mode === 'zone') statusInfo.textContent = 'Click defender to assign zone. Right-click also works.';
    else if (mode === 'swap') statusInfo.textContent = 'Click first player to swap.';
    else statusInfo.textContent = '';
    const btn = document.getElementById('btn-' + mode);
    if (btn) btn.classList.add('active');
    render();
  }

  document.getElementById('btn-move').addEventListener('click', () => setMode('move'));
  document.getElementById('btn-route').addEventListener('click', () => setMode('route'));
  document.getElementById('btn-motion').addEventListener('click', () => setMode('motion'));
  document.getElementById('btn-zone').addEventListener('click', () => setMode('zone'));
  document.getElementById('btn-eraser').addEventListener('click', () => setMode('eraser'));
  document.getElementById('btn-swap').addEventListener('click', () => setMode('swap'));

  // Formation
  document.getElementById('formation-select').addEventListener('change', (e) => {
    const val = e.target.value;
    if (!val) return;
    let oPlayers;
    if (val.startsWith('custom:')) {
      const cfName = val.slice(7);
      const cf = customFormations.find(f => f.name === cfName);
      if (!cf) return;
      oPlayers = JSON.parse(JSON.stringify(cf.offense));
    } else {
      oPlayers = formationOffense(val);
      if (!oPlayers) return;
    }
    const play = currentPlay();
    play.formation = val;
    play.offense = oPlayers;
    play.routes = play.routes.filter(r => r.type !== 'offense');
    cancelRoute();
    savePlaybook();
    renderPlayList();
    render();
    e.target.value = '';
  });

  // Save Formation
  document.getElementById('btn-save-formation').addEventListener('click', () => {
    document.getElementById('formation-name-input').value = '';
    document.getElementById('save-formation-modal').style.display = 'flex';
    document.getElementById('formation-name-input').focus();
  });

  document.getElementById('btn-confirm-save-formation').addEventListener('click', () => {
    const nameInput = document.getElementById('formation-name-input');
    const name = nameInput.value.trim();
    if (!name) return;
    customFormations.push({
      name,
      offense: JSON.parse(JSON.stringify(currentPlay().offense))
    });
    saveCustomFormations();
    renderFormationSelect();
    document.getElementById('save-formation-modal').style.display = 'none';
  });

  document.getElementById('btn-cancel-save-formation').addEventListener('click', () => {
    document.getElementById('save-formation-modal').style.display = 'none';
  });

  // Manage Formations
  document.getElementById('btn-manage-formations').addEventListener('click', () => {
    renderFormationList();
    document.getElementById('manage-formations-modal').style.display = 'flex';
  });

  document.getElementById('btn-close-manage-formations').addEventListener('click', () => {
    document.getElementById('manage-formations-modal').style.display = 'none';
  });

  function renderFormationList() {
    const container = document.getElementById('formation-list');
    container.innerHTML = '';
    customFormations.forEach((f, i) => {
      const row = document.createElement('div');
      row.className = 'formation-list-item';
      row.innerHTML = `<span>${f.name}</span><div class="fl-actions">` +
        `<button class="fl-overwrite" data-idx="${i}">Overwrite</button>` +
        `<button class="fl-delete" data-idx="${i}">Delete</button></div>`;
      container.appendChild(row);
    });
    container.querySelectorAll('.fl-overwrite').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        customFormations[idx].offense = JSON.parse(JSON.stringify(currentPlay().offense));
        saveCustomFormations();
        renderFormationList();
        renderFormationSelect();
      });
    });
    container.querySelectorAll('.fl-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        customFormations.splice(idx, 1);
        saveCustomFormations();
        renderFormationList();
        renderFormationSelect();
      });
    });
  }

  // Apply formation positions to all plays with same formation
  document.getElementById('btn-apply-formation-all').addEventListener('click', () => {
    const play = currentPlay();
    if (!play || !play.formation) return;
    const formKey = play.formation;
    const affected = [];
    playbook.forEach((p, idx) => {
      if (idx !== currentPlayIndex && p.formation === formKey) affected.push(idx);
    });
    if (affected.length === 0) {
      alert('No other plays use this formation.');
      return;
    }
    const label = formKey.startsWith('custom:') ? formKey.slice(7) : getFormationLabel(formKey);
    document.getElementById('apply-formation-msg').textContent =
      `Update ${affected.length} play(s) using "${label}" to match current positions. Routes will be shifted accordingly.`;
    document.getElementById('apply-formation-modal').style.display = 'flex';
  });

  document.getElementById('btn-confirm-apply-formation').addEventListener('click', () => {
    const play = currentPlay();
    const formKey = play.formation;
    const newPos = play.offense;

    playbook.forEach((p, idx) => {
      if (idx === currentPlayIndex || p.formation !== formKey) return;
      const len = Math.min(newPos.length, p.offense.length);
      for (let i = 0; i < len; i++) {
        const dx = newPos[i].x - p.offense[i].x;
        const dy = newPos[i].y - p.offense[i].y;
        if (dx === 0 && dy === 0) continue;
        // Shift route waypoints for this player
        p.routes.forEach(route => {
          if (route.playerIndex === i && route.type === 'offense') {
            route.waypoints.forEach(wp => { wp.x += dx; wp.y += dy; });
          }
        });
        // Update player position
        p.offense[i].x = newPos[i].x;
        p.offense[i].y = newPos[i].y;
      }
    });

    // Update custom formation template if applicable
    if (formKey.startsWith('custom:')) {
      const cfName = formKey.slice(7);
      const cf = customFormations.find(f => f.name === cfName);
      if (cf) {
        cf.offense = JSON.parse(JSON.stringify(newPos));
        saveCustomFormations();
      }
    }

    savePlaybook();
    renderPlayList();
    render();
    document.getElementById('apply-formation-modal').style.display = 'none';
  });

  document.getElementById('btn-cancel-apply-formation').addEventListener('click', () => {
    document.getElementById('apply-formation-modal').style.display = 'none';
  });

  // ---- Split Formation ----
  let _splitAssignments = {}; // temp state: { label: 0|1 } during modal editing

  document.getElementById('btn-split-formation').addEventListener('click', () => {
    const play = currentPlay();
    if (!play) return;
    const formKey = play.formation;
    const label = formKey.startsWith('custom:') ? formKey.slice(7) : getFormationLabel(formKey);
    document.getElementById('split-modal-title').textContent = 'Split: ' + label;

    const existing = formationSplits[formKey];
    const positions = play.offense.map(p => p.label).filter(l => l !== 'QB');

    // Initialize assignments
    _splitAssignments = {};
    if (existing) {
      existing[0].labels.forEach(l => { _splitAssignments[l] = 0; });
      existing[1].labels.forEach(l => { _splitAssignments[l] = 1; });
      document.getElementById('split-group1-name').value = existing[0].name;
      document.getElementById('split-group2-name').value = existing[1].name;
      document.getElementById('btn-remove-split').style.display = '';
    } else {
      positions.forEach(l => { _splitAssignments[l] = 0; });
      document.getElementById('split-group1-name').value = '';
      document.getElementById('split-group2-name').value = '';
      document.getElementById('btn-remove-split').style.display = 'none';
    }

    renderSplitPositionButtons(positions);
    document.getElementById('split-formation-modal').style.display = 'flex';
  });

  function renderSplitPositionButtons(positions) {
    const g1 = document.getElementById('split-group1-positions');
    const g2 = document.getElementById('split-group2-positions');
    g1.innerHTML = '';
    g2.innerHTML = '';

    positions.forEach(label => {
      const btn = document.createElement('button');
      btn.className = 'split-pos-btn ' + (_splitAssignments[label] === 0 ? 'group1' : 'group2');
      btn.textContent = label;
      btn.addEventListener('click', () => {
        _splitAssignments[label] = _splitAssignments[label] === 0 ? 1 : 0;
        renderSplitPositionButtons(positions);
      });
      if (_splitAssignments[label] === 0) g1.appendChild(btn);
      else g2.appendChild(btn);
    });
  }

  document.getElementById('btn-confirm-split').addEventListener('click', () => {
    const play = currentPlay();
    if (!play) return;
    const formKey = play.formation;

    const g1Labels = Object.keys(_splitAssignments).filter(l => _splitAssignments[l] === 0);
    const g2Labels = Object.keys(_splitAssignments).filter(l => _splitAssignments[l] === 1);

    if (g1Labels.length === 0 || g2Labels.length === 0) {
      alert('Both groups must have at least one position.');
      return;
    }

    const g1Name = document.getElementById('split-group1-name').value.trim() || 'Group 1';
    const g2Name = document.getElementById('split-group2-name').value.trim() || 'Group 2';

    formationSplits[formKey] = [
      { name: g1Name, labels: g1Labels },
      { name: g2Name, labels: g2Labels }
    ];
    saveFormationSplits();

    // Assign existing plays that have this formation to group 0 if unset
    playbook.forEach(p => {
      if (p.formation === formKey && p.splitGroup == null) {
        p.splitGroup = 0;
      }
    });
    savePlaybook();
    renderPlayList();
    render();

    document.getElementById('split-formation-modal').style.display = 'none';
  });

  document.getElementById('btn-remove-split').addEventListener('click', () => {
    const play = currentPlay();
    if (!play) return;
    const formKey = play.formation;
    delete formationSplits[formKey];
    saveFormationSplits();

    // Remove splitGroup from all plays with this formation
    playbook.forEach(p => {
      if (p.formation === formKey) delete p.splitGroup;
    });
    savePlaybook();
    renderPlayList();
    render();

    document.getElementById('split-formation-modal').style.display = 'none';
  });

  document.getElementById('btn-cancel-split').addEventListener('click', () => {
    document.getElementById('split-formation-modal').style.display = 'none';
  });

  // ---- Split Group Picker (for new play creation) ----
  document.getElementById('btn-cancel-split-group-picker').addEventListener('click', () => {
    document.getElementById('split-group-picker-modal').style.display = 'none';
  });

  // Play management
  // New play: show formation picker modal
  function showNewPlayModal() {
    if (currentPlaybookMode === 'defense') {
      showNewDefPlayModal();
      return;
    }
    const grid = document.getElementById('new-play-formation-grid');
    grid.innerHTML = '';
    function handleFormationCardClick(formKey) {
      const splits = formationSplits[formKey];
      if (splits) {
        document.getElementById('new-play-modal').style.display = 'none';
        showSplitGroupPicker(formKey);
      } else {
        createNewPlayWithFormation(formKey);
      }
    }

    BUILTIN_FORMATIONS.forEach(f => {
      const card = document.createElement('div');
      card.className = 'formation-card';
      card.textContent = f.label + (formationSplits[f.value] ? ' \u2702' : '');
      card.addEventListener('click', () => handleFormationCardClick(f.value));
      grid.appendChild(card);
    });
    if (customFormations.length > 0) {
      const divider = document.createElement('div');
      divider.className = 'formation-grid-divider';
      divider.textContent = 'Custom';
      grid.appendChild(divider);
      customFormations.forEach(f => {
        const fk = 'custom:' + f.name;
        const card = document.createElement('div');
        card.className = 'formation-card';
        card.textContent = f.name + (formationSplits[fk] ? ' \u2702' : '');
        card.addEventListener('click', () => handleFormationCardClick(fk));
        grid.appendChild(card);
      });
    }
    document.getElementById('new-play-modal').style.display = 'flex';
  }

  function showNewDefPlayModal() {
    const grid = document.getElementById('new-play-formation-grid');
    grid.innerHTML = '';
    // Coverage scheme cards
    const coverageDiv = document.createElement('div');
    coverageDiv.className = 'formation-grid-divider';
    coverageDiv.textContent = 'Coverage Scheme';
    grid.appendChild(coverageDiv);
    Object.entries(COVERAGE_SCHEMES).forEach(([key, scheme]) => {
      const card = document.createElement('div');
      card.className = 'formation-card';
      card.textContent = scheme.label;
      card.addEventListener('click', () => createNewDefPlayWithFormation('4-2-1', key));
      grid.appendChild(card);
    });
    // Blank card
    const blankCard = document.createElement('div');
    blankCard.className = 'formation-card';
    blankCard.textContent = 'Blank';
    blankCard.addEventListener('click', () => createNewDefPlayWithFormation('4-2-1', ''));
    grid.appendChild(blankCard);
    document.getElementById('new-play-modal').style.display = 'flex';
  }

  function createNewDefPlayWithFormation(formationKey, coverageKey) {
    stopAnimation();
    const play = createDefensivePlay(null, formationKey, coverageKey);
    defPlaybook.push(play);
    currentDefPlayIndex = defPlaybook.length - 1;
    playNameInput.value = play.name;
    hideZonePicker(); hideWaypointPicker();
    saveDefPlaybook();
    renderPlayList();
    render();
    syncDefToolbar();
    document.getElementById('new-play-modal').style.display = 'none';
  }

  function createNewPlayWithFormation(formationKey, splitGroup) {
    stopAnimation();
    const play = createPlay(null, formationKey);
    if (splitGroup != null) play.splitGroup = splitGroup;
    playbook.push(play);
    currentPlayIndex = playbook.length - 1;
    playNameInput.value = play.name;
    cancelRoute();
    savePlaybook();
    renderPlayList();
    render();
    document.getElementById('new-play-modal').style.display = 'none';
    document.getElementById('split-group-picker-modal').style.display = 'none';
  }

  function showSplitGroupPicker(formKey) {
    const splits = formationSplits[formKey];
    if (!splits) return;
    const grid = document.getElementById('split-group-picker-grid');
    grid.innerHTML = '';
    splits.forEach((group, idx) => {
      const card = document.createElement('div');
      card.className = 'formation-card';
      card.textContent = group.name + ' (' + group.labels.join(', ') + ')';
      card.addEventListener('click', () => createNewPlayWithFormation(formKey, idx));
      grid.appendChild(card);
    });
    document.getElementById('split-group-picker-modal').style.display = 'flex';
  }

  document.getElementById('btn-new-play').addEventListener('click', showNewPlayModal);

  document.getElementById('btn-cancel-new-play').addEventListener('click', () => {
    document.getElementById('new-play-modal').style.display = 'none';
  });

  document.getElementById('btn-duplicate').addEventListener('click', () => {
    if (currentPlaybookMode === 'defense') {
      const dup = JSON.parse(JSON.stringify(currentDefPlay()));
      dup.name += ' (copy)';
      defPlaybook.push(dup);
      currentDefPlayIndex = defPlaybook.length - 1;
      playNameInput.value = dup.name;
      hideZonePicker(); hideWaypointPicker();
      saveDefPlaybook();
      renderPlayList();
      render();
      return;
    }
    const dup = JSON.parse(JSON.stringify(currentPlay()));
    dup.name += ' (copy)';
    playbook.push(dup);
    currentPlayIndex = playbook.length - 1;
    playNameInput.value = dup.name;
    cancelRoute();
    savePlaybook();
    renderPlayList();
    render();
  });

  document.getElementById('btn-delete-play').addEventListener('click', () => {
    if (currentPlaybookMode === 'defense') {
      if (defPlaybook.length <= 1) return;
      defPlaybook.splice(currentDefPlayIndex, 1);
      currentDefPlayIndex = Math.min(currentDefPlayIndex, defPlaybook.length - 1);
      playNameInput.value = currentDefPlay().name;
      hideZonePicker(); hideWaypointPicker();
      saveDefPlaybook();
      renderPlayList();
      render();
      return;
    }
    if (playbook.length <= 1) return;
    playbook.splice(currentPlayIndex, 1);
    currentPlayIndex = Math.min(currentPlayIndex, playbook.length - 1);
    playNameInput.value = currentPlay().name;
    cancelRoute();
    savePlaybook();
    renderPlayList();
    render();
  });

  document.getElementById('btn-add-offense').addEventListener('click', () => {
    currentPlay().offense.push({ x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, label: 'X' });
    savePlaybook();
    render();
  });

  document.getElementById('btn-add-defense').addEventListener('click', () => {
    if (currentPlaybookMode === 'defense') {
      const play = currentDefPlay();
      play.defenders.push({ x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2 - 40, label: 'DB', zone: '' });
      saveDefPlaybook();
      render();
      return;
    }
    currentPlay().defense.push({ x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2 - 40, label: 'DB' });
    savePlaybook();
    render();
  });

  document.getElementById('btn-clear').addEventListener('click', () => {
    if (!confirm('Reset this play?')) return;
    if (currentPlaybookMode === 'defense') {
      const play = currentDefPlay();
      const defs = formationDefense(play.formation);
      play.defenders = defs.map(d => ({ ...d, zone: '' }));
      play.coverageScheme = '';
      hideZonePicker(); hideWaypointPicker();
      saveDefPlaybook();
      render();
      syncDefToolbar();
      return;
    }
    const play = currentPlay();
    const def = createDefaultPlayers();
    play.offense = def.offense;
    play.defense = def.defense;
    play.routes = [];
    cancelRoute();
    savePlaybook();
    render();
  });

  document.getElementById('route-style').addEventListener('change', (e) => {
    routeStyle = e.target.value;
  });

  playNameInput.addEventListener('input', () => {
    if (currentPlaybookMode === 'defense') {
      currentDefPlay().name = playNameInput.value || 'Untitled';
      saveDefPlaybook();
      renderPlayList();
      return;
    }
    currentPlay().name = playNameInput.value || 'Untitled';
    savePlaybook();
    renderPlayList();
  });

  // Animation
  document.getElementById('btn-animate').addEventListener('click', startAnimation);

  // Share
  document.getElementById('btn-share').addEventListener('click', () => {
    const encoded = encodeToURL(playbook);
    const url = window.location.origin + window.location.pathname + '#' + encoded;
    document.getElementById('share-url').value = url;
    document.getElementById('share-modal').style.display = 'flex';
  });

  document.getElementById('btn-copy-url').addEventListener('click', () => {
    const textarea = document.getElementById('share-url');
    textarea.select();
    navigator.clipboard.writeText(textarea.value).then(() => {
      const btn = document.getElementById('btn-copy-url');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy URL'; }, 2000);
    });
  });

  document.getElementById('btn-close-modal').addEventListener('click', () => {
    document.getElementById('share-modal').style.display = 'none';
  });

  // Print
  document.getElementById('btn-print').addEventListener('click', () => {
    printArea.innerHTML = '';
    const isDefense = currentPlaybookMode === 'defense';
    const pb = isDefense ? defPlaybook : playbook;

    // Group by formation + split group
    const groups = {};
    const order = [];
    pb.forEach(play => {
      const formKey = play.formation || (isDefense ? '4-2-1' : 'spread');
      const splits = !isDefense && formationSplits[formKey];
      const key = splits && play.splitGroup != null
        ? formKey + ':sg' + play.splitGroup
        : formKey;
      if (!groups[key]) { groups[key] = { formKey, splitGroup: splits ? play.splitGroup : null, plays: [] }; order.push(key); }
      groups[key].plays.push(play);
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'print-wrapper';

    order.forEach(groupKey => {
      const group = groups[groupKey];
      const formLabel = isDefense ? getDefFormationLabel(group.formKey) : getFormationLabel(group.formKey);
      const splits = !isDefense && formationSplits[group.formKey];
      const sgName = splits && group.splitGroup != null ? splits[group.splitGroup]?.name : null;
      const label = sgName ? formLabel + ' — ' + sgName : formLabel;

      const section = document.createElement('div');
      section.className = 'print-section';

      const grid = document.createElement('div');
      grid.className = 'print-grid';

      group.plays.forEach(play => {
        const container = document.createElement('div');
        container.className = 'print-play';

        // Render to full-size canvas
        const fullCanvas = document.createElement('canvas');
        fullCanvas.width = FIELD_WIDTH;
        fullCanvas.height = FIELD_HEIGHT;
        const splitLabels = !isDefense ? getSplitLabelsForPlay(play) : null;
        if (isDefense) {
          renderDefPlayToCanvasBW(fullCanvas.getContext('2d'), play);
        } else if (splitLabels) {
          renderPlayToCanvasBWFiltered(fullCanvas.getContext('2d'), play, splitLabels);
        } else {
          renderPlayToCanvasBW(fullCanvas.getContext('2d'), play);
        }

        const PRINT_CROP = Math.round((FIELD_HEIGHT - ENDZONE_HEIGHT) / YARD_LINES); // ≈44px = 5yd
        const cropY = isDefense ? ENDZONE_HEIGHT : PRINT_CROP;
        const cropH = isDefense
          ? (FIELD_HEIGHT - ENDZONE_HEIGHT - PRINT_CROP)
          : (FIELD_HEIGHT - PRINT_CROP);
        const LABEL_H = 30;
        const cropped = document.createElement('canvas');
        cropped.width = FIELD_WIDTH;
        cropped.height = cropH + LABEL_H;
        const cc = cropped.getContext('2d');

        // Draw label bar at top
        cc.fillStyle = '#fff';
        cc.fillRect(0, 0, FIELD_WIDTH, LABEL_H);
        cc.fillStyle = '#000';
        cc.font = 'bold 20px sans-serif';
        cc.textAlign = 'center';
        cc.textBaseline = 'middle';
        cc.fillText(label + ' \u2014 ' + play.name, FIELD_WIDTH / 2, LABEL_H / 2);

        // Draw cropped field below label
        cc.drawImage(
          fullCanvas, 0, cropY, FIELD_WIDTH, cropH, 0, LABEL_H, FIELD_WIDTH, cropH
        );

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

  // ---- Publish ----
  document.getElementById('btn-publish').addEventListener('click', async () => {
    const label = prompt('Version label (optional):') || '';
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label })
      });
      if (res.ok) {
        const data = await res.json();
        alert('Published v' + data.id + (label ? ' (' + label + ')' : ''));
      } else {
        alert('Publish failed');
      }
    } catch (e) {
      alert('Publish failed: ' + e.message);
    }
  });

  // ============================================================
  // TODO LIST (dynamic)
  // ============================================================
  const DEFAULT_TODO_ITEMS = [
    { category: '5WR Bunch', text: 'Super High-Low + Snag' },
    { category: '5WR Bunch', text: 'モーション入りのトス' },
    { category: '', text: '1-4 Bunchの単騎' },
    { category: 'コンセプト', text: 'Inside系' },
    { category: 'コンセプト', text: 'Hook系' },
    { category: 'コンセプト', text: '4 Vertical' },
    { category: 'コンセプト', text: 'Slant/Wheel' },
    { category: 'Beater', text: '5-2 Beater' },
    { category: 'Beater', text: '4-3 Beater' },
    { category: 'Beater', text: 'Man-Beater' },
  ];

  let _todosCache = null;

  async function loadTodosAsync() {
    // Try server DB first
    try {
      const res = await fetch('/api/store/7on7-todos');
      if (res.ok) {
        const { value } = await res.json();
        if (value) { _todosCache = JSON.parse(value); return _todosCache; }
      }
    } catch {}
    // Fallback to localStorage
    return loadTodosSync();
  }

  function loadTodosSync() {
    if (_todosCache) return _todosCache;
    try {
      const d = localStorage.getItem('7on7-todos');
      if (d) { _todosCache = JSON.parse(d); return _todosCache; }
    } catch {}
    // First time: migrate from old format
    let oldDone = [];
    try {
      const d = localStorage.getItem('7on7-todo-done');
      oldDone = d ? JSON.parse(d) : [];
    } catch {}
    const items = DEFAULT_TODO_ITEMS.map((item, i) => ({
      text: item.text,
      category: item.category,
      done: oldDone.includes(i),
    }));
    saveTodos(items);
    _todosCache = items;
    return items;
  }

  function loadTodos() {
    return _todosCache || loadTodosSync();
  }

  function saveTodos(todos) {
    _todosCache = todos;
    const json = JSON.stringify(todos);
    localStorage.setItem('7on7-todos', json);
    fetch('/api/store/7on7-todos', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: json })
    }).then(handleAuthError).catch(() => {});
  }

  function renderTodoList() {
    const ul = document.getElementById('todo-list');
    ul.innerHTML = '';
    const todos = loadTodos();
    let lastCat = null;
    let remaining = 0;

    todos.forEach((item, i) => {
      if (item.done) return;
      remaining++;

      if (item.category && item.category !== lastCat) {
        lastCat = item.category;
        const catDiv = document.createElement('div');
        catDiv.className = 'todo-category';
        catDiv.textContent = item.category;
        ul.appendChild(catDiv);
      } else if (!item.category && lastCat !== null) {
        lastCat = null;
      }

      const li = document.createElement('li');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      const span = document.createElement('span');
      span.textContent = item.text;

      const delBtn = document.createElement('button');
      delBtn.className = 'todo-delete';
      delBtn.textContent = '\u00d7';
      delBtn.title = 'Delete';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const allTodos = loadTodos();
        allTodos.splice(i, 1);
        saveTodos(allTodos);
        renderTodoList();
      });

      li.appendChild(cb);
      li.appendChild(span);
      li.appendChild(delBtn);

      li.addEventListener('click', (e) => {
        if (e.target === cb || e.target === delBtn) return;
        cb.checked = true;
        cb.dispatchEvent(new Event('change'));
      });

      cb.addEventListener('change', () => {
        if (cb.checked) {
          li.classList.add('checked');
          const allTodos = loadTodos();
          allTodos[i].done = true;
          saveTodos(allTodos);
          setTimeout(() => renderTodoList(), 350);
        }
      });

      ul.appendChild(li);
    });

    const header = document.getElementById('todo-header');
    header.textContent = remaining > 0 ? `TODO (${remaining})` : 'TODO';
  }

  function setupTodoInput() {
    const input = document.getElementById('todo-input');
    const btn = document.getElementById('btn-add-todo');
    function addTodo() {
      const text = input.value.trim();
      if (!text) return;
      const todos = loadTodos();
      todos.push({ text, category: '', done: false });
      saveTodos(todos);
      input.value = '';
      renderTodoList();
    }
    btn.addEventListener('click', addTodo);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addTodo();
    });
  }

  // ============================================================
  // DEFENSE PLAYBOOK: Tabs, Zone Picker, Coverage/Formation
  // ============================================================

  function switchPlaybookMode(newMode) {
    if (newMode === currentPlaybookMode) return;
    currentPlaybookMode = newMode;
    stopAnimation();
    cancelRoute();
    hideZonePicker(); hideWaypointPicker();

    document.getElementById('app').dataset.mode = newMode;
    document.querySelectorAll('.pb-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(newMode === 'defense' ? 'tab-defense' : 'tab-offense').classList.add('active');

    if (newMode === 'defense') {
      if (defPlaybook.length === 0) defPlaybook.push(createDefensivePlay());
      playNameInput.value = currentDefPlay().name;
      setMode('move');
      syncDefToolbar();
    } else {
      playNameInput.value = currentPlay().name;
      setMode('move');
    }
    updateUndoButtons();
    renderPlayList();
    render();
  }

  document.getElementById('tab-offense').addEventListener('click', () => switchPlaybookMode('offense'));
  document.getElementById('tab-defense').addEventListener('click', () => switchPlaybookMode('defense'));

  // Sync defense toolbar dropdowns to current play
  function syncDefToolbar() {
    const play = currentDefPlay();
    if (!play) return;
    const covSel = document.getElementById('coverage-select');
    const scheme = play.coverageScheme || '';
    // If scheme is 'custom' or not in dropdown, select custom option
    if (scheme === 'custom' || (scheme && !COVERAGE_SCHEMES[scheme])) {
      covSel.value = 'custom';
    } else {
      covSel.value = scheme;
    }
    const defFormSel = document.getElementById('def-formation-select');
    defFormSel.value = play.formation || '4-2-1';
  }

  // Populate defense formation select
  function renderDefFormationSelect() {
    const sel = document.getElementById('def-formation-select');
    sel.innerHTML = '';
    BUILTIN_DEF_FORMATIONS.forEach(f => {
      const o = document.createElement('option');
      o.value = f.value; o.textContent = f.label;
      sel.appendChild(o);
    });
  }

  // Coverage scheme change
  document.getElementById('coverage-select').addEventListener('change', (e) => {
    const val = e.target.value;
    const play = currentDefPlay();
    if (!play) return;
    play.coverageScheme = val;
    if (val && COVERAGE_SCHEMES[val]) {
      const defs = COVERAGE_SCHEMES[val].defaults;
      play.defenders.forEach((d, i) => { d.zone = defs[i] || ''; });
    } else if (!val) {
      // None — clear all zones
      play.defenders.forEach(d => { d.zone = ''; });
    }
    hideZonePicker(); hideWaypointPicker();
    saveDefPlaybook();
    render();
  });

  // Defense formation change
  document.getElementById('def-formation-select').addEventListener('change', (e) => {
    const val = e.target.value;
    const play = currentDefPlay();
    if (!play) return;
    play.formation = val;
    const newDefs = formationDefense(val);
    play.defenders = newDefs.map((d, i) => {
      const oldZone = play.defenders[i] ? play.defenders[i].zone : '';
      return { ...d, zone: oldZone };
    });
    hideZonePicker(); hideWaypointPicker();
    saveDefPlaybook();
    renderPlayList();
    render();
  });

  // ---- Zone Picker ----
  let zonePickerTarget = -1; // index into current play's defenders

  function buildZonePickerContent() {
    const picker = document.getElementById('zone-picker');
    picker.innerHTML = '';
    const categories = [
      { key: 'deep', label: 'Deep' },
      { key: 'under', label: 'Underneath' },
      { key: 'special', label: 'Special' },
    ];
    categories.forEach(cat => {
      const section = document.createElement('div');
      section.className = 'zp-section';
      const lbl = document.createElement('div');
      lbl.className = 'zp-label';
      lbl.textContent = cat.label;
      section.appendChild(lbl);
      const opts = document.createElement('div');
      opts.className = 'zp-options';
      Object.entries(ZONE_TYPES).forEach(([key, zt]) => {
        if (zt.category !== cat.key) return;
        const btn = document.createElement('div');
        btn.className = 'zp-option';
        btn.textContent = zt.label;
        btn.style.background = zt.color;
        btn.dataset.zone = key;
        btn.addEventListener('click', () => {
          assignZone(zonePickerTarget, key);
          hideZonePicker(); hideWaypointPicker();
        });
        opts.appendChild(btn);
      });
      section.appendChild(opts);
      picker.appendChild(section);
    });
    const clearBtn = document.createElement('button');
    clearBtn.id = 'zp-clear';
    clearBtn.textContent = 'Clear Zone';
    clearBtn.addEventListener('click', () => {
      assignZone(zonePickerTarget, '');
      hideZonePicker(); hideWaypointPicker();
    });
    picker.appendChild(clearBtn);
  }

  function showZonePicker(defenderIndex, canvasPos) {
    const play = currentDefPlay();
    if (!play || defenderIndex < 0) return;
    zonePickerTarget = defenderIndex;

    const picker = document.getElementById('zone-picker');
    buildZonePickerContent();

    // Highlight current zone
    const currentZone = play.defenders[defenderIndex].zone;
    picker.querySelectorAll('.zp-option').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.zone === currentZone);
    });

    // Position picker near defender (convert canvas coords to CSS coords)
    const r = canvas.getBoundingClientRect();
    const area = document.getElementById('canvas-area').getBoundingClientRect();
    const scale = r.width / FIELD_WIDTH;
    let px = r.left - area.left + canvasPos.x * scale + 20;
    let py = r.top - area.top + canvasPos.y * scale - 60;
    // Keep in view
    if (px + 220 > area.width) px = px - 260;
    if (py < 0) py = 10;
    if (py + 300 > area.height) py = area.height - 310;
    picker.style.left = px + 'px';
    picker.style.top = py + 'px';
    picker.style.display = 'block';
  }

  function hideZonePicker() {
    document.getElementById('zone-picker').style.display = 'none';
    zonePickerTarget = -1;
  }

  // ---- Waypoint Picker (cross order numbers) ----
  let wpPickerTarget = null; // { routeIndex, waypointIndex } or null

  function buildWaypointPickerContent() {
    const picker = document.getElementById('waypoint-picker');
    picker.innerHTML = '';

    // Toggle Motion/Route button
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'wp-toggle-motion';
    toggleBtn.textContent = 'Toggle Motion / Route';
    toggleBtn.addEventListener('click', () => {
      if (!wpPickerTarget) return;
      const route = currentPlay().routes[wpPickerTarget.routeIndex];
      const wp = route.waypoints[wpPickerTarget.waypointIndex];
      wp.isMotion = !wp.isMotion;
      route.isMotion = route.waypoints.slice(1).every(w => w.isMotion);
      savePlaybook();
      render();
      hideWaypointPicker();
    });
    picker.appendChild(toggleBtn);

    // Delete Joint button (only for non-origin waypoints)
    if (wpPickerTarget && wpPickerTarget.waypointIndex > 0) {
      const deleteBtn = document.createElement('button');
      deleteBtn.id = 'wp-delete-joint';
      deleteBtn.textContent = 'Delete Joint';
      deleteBtn.style.cssText = 'background:#c0392b;color:#fff;margin-top:4px;';
      deleteBtn.addEventListener('click', () => {
        if (!wpPickerTarget) return;
        const ri = wpPickerTarget.routeIndex;
        const wi = wpPickerTarget.waypointIndex;
        const route = currentPlay().routes[ri];
        if (route.waypoints.length <= 2) {
          // Only origin + 1 point → delete entire route
          currentPlay().routes.splice(ri, 1);
        } else {
          route.waypoints.splice(wi, 1);
          route.isMotion = route.waypoints.slice(1).every(w => w.isMotion);
        }
        savePlaybook();
        render();
        hideWaypointPicker();
      });
      picker.appendChild(deleteBtn);
    }

    // Cross Number section
    const section = document.createElement('div');
    section.className = 'wp-section';
    const label = document.createElement('div');
    label.className = 'wp-label';
    label.textContent = 'Cross Order';
    section.appendChild(label);

    const opts = document.createElement('div');
    opts.className = 'wp-options';
    for (let n = 1; n <= 5; n++) {
      const btn = document.createElement('div');
      btn.className = 'wp-num-btn';
      btn.textContent = n;
      btn.dataset.num = n;
      btn.addEventListener('click', () => {
        if (!wpPickerTarget) return;
        const route = currentPlay().routes[wpPickerTarget.routeIndex];
        const wp = route.waypoints[wpPickerTarget.waypointIndex];
        wp.crossNumber = n;
        savePlaybook();
        render();
        hideWaypointPicker();
      });
      opts.appendChild(btn);
    }
    section.appendChild(opts);
    picker.appendChild(section);

    // Clear button
    const clearBtn = document.createElement('button');
    clearBtn.id = 'wp-clear-number';
    clearBtn.textContent = 'Clear Number';
    clearBtn.addEventListener('click', () => {
      if (!wpPickerTarget) return;
      const route = currentPlay().routes[wpPickerTarget.routeIndex];
      const wp = route.waypoints[wpPickerTarget.waypointIndex];
      delete wp.crossNumber;
      delete wp.crossT;
      savePlaybook();
      render();
      hideWaypointPicker();
    });
    picker.appendChild(clearBtn);
  }

  function showWaypointPicker(routeIndex, waypointIndex, canvasPos) {
    wpPickerTarget = { routeIndex, waypointIndex };
    const picker = document.getElementById('waypoint-picker');
    buildWaypointPickerContent();

    // Highlight current number
    const route = currentPlay().routes[routeIndex];
    const wp = route.waypoints[waypointIndex];
    if (wp.crossNumber) {
      picker.querySelectorAll('.wp-num-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.num) === wp.crossNumber);
      });
    }

    // Position near waypoint
    const r = canvas.getBoundingClientRect();
    const area = document.getElementById('canvas-area').getBoundingClientRect();
    const scale = r.width / FIELD_WIDTH;
    let px = r.left - area.left + canvasPos.x * scale + 20;
    let py = r.top - area.top + canvasPos.y * scale - 40;
    if (px + 180 > area.width) px = px - 220;
    if (py < 0) py = 10;
    if (py + 180 > area.height) py = area.height - 190;
    picker.style.left = px + 'px';
    picker.style.top = py + 'px';
    picker.style.display = 'block';
  }

  function hideWaypointPicker() {
    document.getElementById('waypoint-picker').style.display = 'none';
    wpPickerTarget = null;
  }

  function assignZone(defenderIndex, zoneKey) {
    const play = currentDefPlay();
    if (!play || defenderIndex < 0 || defenderIndex >= play.defenders.length) return;
    play.defenders[defenderIndex].zone = zoneKey;
    // Check if zones still match current scheme; if not, switch to Custom
    const scheme = play.coverageScheme;
    if (scheme && COVERAGE_SCHEMES[scheme]) {
      const defs = COVERAGE_SCHEMES[scheme].defaults;
      const matches = play.defenders.every((d, i) => d.zone === (defs[i] || ''));
      if (!matches) {
        play.coverageScheme = 'custom';
        document.getElementById('coverage-select').value = 'custom';
      }
    }
    saveDefPlaybook();
    render();
  }

  // ============================================================
  // MIGRATION: localStorage → Server DB
  // ============================================================
  async function migrateLocalStorageToDB() {
    const keys = ['7on7-playbook', '7on7-custom-formations', '7on7-todos', '7on7-defensive-playbook'];
    for (const key of keys) {
      const local = localStorage.getItem(key);
      if (!local) continue;
      try {
        const res = await fetch(`/api/store/${key}`);
        if (res.ok) {
          const { value } = await res.json();
          if (value) continue; // DB already has data
        }
      } catch { continue; }
      await fetch(`/api/store/${key}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: local })
      }).catch(() => {});
    }
  }

  // ============================================================
  // INIT
  // ============================================================
  // Undo / Redo buttons
  document.getElementById('btn-undo').addEventListener('click', undo);
  document.getElementById('btn-redo').addEventListener('click', redo);

  (async () => {
    await migrateLocalStorageToDB();
    await loadPlaybook();
    await loadCustomFormations();
    await loadFormationSplits();
    await loadDefPlaybook();
    await loadTodosAsync();
    renderFormationSelect();
    renderDefFormationSelect();
    document.getElementById('app').dataset.mode = 'offense';
    playNameInput.value = currentPlay().name;
    // Initialize undo snapshots
    _lastPlaybookSnap = JSON.stringify({ pb: playbook, idx: currentPlayIndex });
    _lastDefPlaybookSnap = JSON.stringify({ pb: defPlaybook, idx: currentDefPlayIndex });
    renderPlayList();
    render();
    renderTodoList();
    setupTodoInput();
  })();

})();
