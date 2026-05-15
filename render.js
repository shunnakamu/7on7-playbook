// ============================================================
// 7on7 Playbook — Shared Rendering Module
// ============================================================

window.PlaybookRenderer = (() => {
  'use strict';

  // ---- Constants ----
  const FIELD_WIDTH = 700;
  const FIELD_HEIGHT = 450;
  const YARD_LINES = 9;
  const ENDZONE_HEIGHT = 50;
  const PLAYER_RADIUS = 22;
  const SNAP_THRESHOLD = PLAYER_RADIUS + 4;

  // Flip Y for defense view (defense perspective: end zone at top)
  function fy(y) { return FIELD_HEIGHT - y; }

  // ---- Zone Defense Definitions ----
  const ZONE_TYPES = {
    'deep-half-left':       { label: '\u00bd L',    category: 'deep',    color: '#4d96ff' },
    'deep-half-right':      { label: '\u00bd R',    category: 'deep',    color: '#4d96ff' },
    'deep-third-left':      { label: '\u2153 L',    category: 'deep',    color: '#6bcb77' },
    'deep-third-middle':    { label: '\u2153 M',    category: 'deep',    color: '#6bcb77' },
    'deep-third-right':     { label: '\u2153 R',    category: 'deep',    color: '#6bcb77' },
    'deep-quarter-left':    { label: '\u00bc L',    category: 'deep',    color: '#cc5de8' },
    'deep-quarter-left-c':  { label: '\u00bc LC',   category: 'deep',    color: '#cc5de8' },
    'deep-quarter-right-c': { label: '\u00bc RC',   category: 'deep',    color: '#cc5de8' },
    'deep-quarter-right':   { label: '\u00bc R',    category: 'deep',    color: '#cc5de8' },
    'flat-left':            { label: 'Flat L',  category: 'under',   color: '#ff6b6b' },
    'flat-right':           { label: 'Flat R',  category: 'under',   color: '#ff6b6b' },
    'curl-left':            { label: 'Curl L',  category: 'under',   color: '#ffd93d' },
    'curl-right':           { label: 'Curl R',  category: 'under',   color: '#ffd93d' },
    'hook-left':            { label: 'Hook L',  category: 'under',   color: '#ff922b' },
    'hook-right':           { label: 'Hook R',  category: 'under',   color: '#ff922b' },
    'hook-middle':          { label: 'Hook M',  category: 'under',   color: '#ff922b' },
    // Equal-width under zone divisions
    'under-5-1':            { label: '\u2155 L',    category: 'under',   color: '#ff6b6b' },
    'under-5-2':            { label: '\u2155 LC',   category: 'under',   color: '#ff6b6b' },
    'under-5-3':            { label: '\u2155 M',    category: 'under',   color: '#ff6b6b' },
    'under-5-4':            { label: '\u2155 RC',   category: 'under',   color: '#ff6b6b' },
    'under-5-5':            { label: '\u2155 R',    category: 'under',   color: '#ff6b6b' },
    'under-4-1':            { label: 'U\u00bc L',   category: 'under',   color: '#ffa94d' },
    'under-4-2':            { label: 'U\u00bc LC',  category: 'under',   color: '#ffa94d' },
    'under-4-3':            { label: 'U\u00bc RC',  category: 'under',   color: '#ffa94d' },
    'under-4-4':            { label: 'U\u00bc R',   category: 'under',   color: '#ffa94d' },
    'under-3-1':            { label: 'U\u2153 L',   category: 'under',   color: '#ffd93d' },
    'under-3-2':            { label: 'U\u2153 M',   category: 'under',   color: '#ffd93d' },
    'under-3-3':            { label: 'U\u2153 R',   category: 'under',   color: '#ffd93d' },
    'spy':                  { label: 'Spy',     category: 'special', color: '#20c997' },
    'man':                  { label: 'Man',     category: 'special', color: '#adb5bd' },
    'blitz':                { label: 'Blitz',   category: 'special', color: '#e94560' },
  };

  const ZONE_SHAPES = {
    'deep-half-left':       los => [[0, 0], [350, 0], [350, los - 70], [0, los - 70]],
    'deep-half-right':      los => [[350, 0], [700, 0], [700, los - 70], [350, los - 70]],
    'deep-third-left':      los => [[0, 0], [233, 0], [233, los - 70], [0, los - 70]],
    'deep-third-middle':    los => [[233, 0], [467, 0], [467, los - 70], [233, los - 70]],
    'deep-third-right':     los => [[467, 0], [700, 0], [700, los - 70], [467, los - 70]],
    'deep-quarter-left':    los => [[0, 0], [175, 0], [175, los - 70], [0, los - 70]],
    'deep-quarter-left-c':  los => [[175, 0], [350, 0], [350, los - 70], [175, los - 70]],
    'deep-quarter-right-c': los => [[350, 0], [525, 0], [525, los - 70], [350, los - 70]],
    'deep-quarter-right':   los => [[525, 0], [700, 0], [700, los - 70], [525, los - 70]],
    'flat-left':            los => [[0, los - 70], [140, los - 70], [140, los], [0, los]],
    'flat-right':           los => [[560, los - 70], [700, los - 70], [700, los], [560, los]],
    'curl-left':            los => [[140, los - 70], [310, los - 70], [310, los], [140, los]],
    'curl-right':           los => [[390, los - 70], [560, los - 70], [560, los], [390, los]],
    'hook-left':            los => [[310, los - 70], [350, los - 70], [350, los], [310, los]],
    'hook-right':           los => [[350, los - 70], [390, los - 70], [390, los], [350, los]],
    'hook-middle':          los => [[310, los - 70], [390, los - 70], [390, los], [310, los]],
    // Equal-width under zone divisions (5-way: 700/5=140, 4-way: 700/4=175, 3-way: 700/3≈233)
    'under-5-1':            los => [[0, los - 70], [140, los - 70], [140, los], [0, los]],
    'under-5-2':            los => [[140, los - 70], [280, los - 70], [280, los], [140, los]],
    'under-5-3':            los => [[280, los - 70], [420, los - 70], [420, los], [280, los]],
    'under-5-4':            los => [[420, los - 70], [560, los - 70], [560, los], [420, los]],
    'under-5-5':            los => [[560, los - 70], [700, los - 70], [700, los], [560, los]],
    'under-4-1':            los => [[0, los - 70], [175, los - 70], [175, los], [0, los]],
    'under-4-2':            los => [[175, los - 70], [350, los - 70], [350, los], [175, los]],
    'under-4-3':            los => [[350, los - 70], [525, los - 70], [525, los], [350, los]],
    'under-4-4':            los => [[525, los - 70], [700, los - 70], [700, los], [525, los]],
    'under-3-1':            los => [[0, los - 70], [233, los - 70], [233, los], [0, los]],
    'under-3-2':            los => [[233, los - 70], [467, los - 70], [467, los], [233, los]],
    'under-3-3':            los => [[467, los - 70], [700, los - 70], [700, los], [467, los]],
  };

  // Index: [0]LCB [1]LDT [2]RDT [3]RCB [4]LB [5]LS [6]RS
  const COVERAGE_SCHEMES = {
    cover1:    { label: 'Cover 1 (Man Free)',  defaults: ['man', 'man', 'man', 'man', 'hook-middle', 'man', 'deep-half-left'] },
    cover2:    { label: 'Cover 2 (5U/2D)',     defaults: ['under-5-1', 'under-5-2', 'under-5-4', 'under-5-5', 'under-5-3', 'deep-half-left', 'deep-half-right'] },
    cover2man: { label: 'Cover 2 Man (5U/2D)', defaults: ['man', 'man', 'man', 'man', 'man', 'deep-half-left', 'deep-half-right'] },
    cover3:    { label: 'Cover 3 (4U/3D)',     defaults: ['deep-third-left', 'under-4-1', 'under-4-4', 'deep-third-right', 'under-4-3', 'under-4-2', 'deep-third-middle'] },
    cover3sky: { label: 'Cover 3 Sky (4U/3D)', defaults: ['deep-third-left', 'under-4-2', 'under-4-4', 'deep-third-right', 'under-4-3', 'under-4-1', 'deep-third-middle'] },
    cover4:    { label: 'Cover 4 (3U/4D)',     defaults: ['deep-quarter-left', 'deep-quarter-left-c', 'deep-quarter-right-c', 'deep-quarter-right', 'under-3-2', 'under-3-1', 'under-3-3'] },
    cover6:    { label: 'Cover 6 (Hybrid)',    defaults: ['deep-quarter-left', 'deep-quarter-left-c', 'under-4-3', 'under-4-4', 'under-4-2', 'under-4-1', 'deep-half-right'] },
  };

  const BUILTIN_DEF_FORMATIONS = [
    { value: '4-2-1', label: '4-2-1 (Base)' },
    { value: '3-3-1', label: '3-3-1 (Nickel)' },
    { value: '2-4-1', label: '2-4-1 (Cover 2 Shell)' },
    { value: '5-1-1', label: '5-1-1 (Man Press)' },
    { value: '3-2-2', label: '3-2-2 (2-High)' },
    { value: '4-1-2', label: '4-1-2 (Cover 4 Shell)' },
  ];

  const BUILTIN_FORMATIONS = [
    { value: 'spread', label: 'Spread' },
    { value: 'trips-r', label: 'Trips Right' },
    { value: 'trips-l', label: 'Trips Left' },
    { value: 'bunch-r', label: 'Bunch Right' },
    { value: 'bunch-l', label: 'Bunch Left' },
    { value: 'empty', label: 'Empty' },
    { value: 'stack-r', label: 'Stack Right' },
    { value: 'stack-l', label: 'Stack Left' },
    { value: 'bunch5-r', label: '5 Bunch Right' },
    { value: 'bunch5-l', label: '5 Bunch Left' },
  ];

  const COLORS_O = [
    '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff',
    '#ff922b', '#cc5de8', '#20c997'
  ];
  const COLOR_D = '#adb5bd';

  // ---- Helper Functions ----

  // Defender order: [0]LCB [1]LDT [2]RDT [3]RCB [4]LB [5]LS [6]RS
  function formationDefense(name) {
    const cx = FIELD_WIDTH / 2;
    const losY = FIELD_HEIGHT - ENDZONE_HEIGHT - 124;
    const templates = {
      '4-2-1': [
        { x: cx - 240, y: losY - 50,  label: 'LCB' },
        { x: cx - 100, y: losY - 50,  label: 'LDT' },
        { x: cx + 100, y: losY - 50,  label: 'RDT' },
        { x: cx + 240, y: losY - 50,  label: 'RCB' },
        { x: cx,       y: losY - 70,  label: 'LB' },
        { x: cx - 80,  y: losY - 89, label: 'LS' },
        { x: cx + 80,  y: losY - 89, label: 'RS' },
      ],
      '3-3-1': [
        { x: cx - 240, y: losY - 20, label: 'LCB' },
        { x: cx,       y: losY - 25, label: 'LDT' },
        { x: cx + 120, y: losY - 70, label: 'RDT' },
        { x: cx + 240, y: losY - 20, label: 'RCB' },
        { x: cx - 120, y: losY - 70, label: 'LB' },
        { x: cx,       y: losY - 70, label: 'LS' },
        { x: cx,       y: losY - 89, label: 'RS' },
      ],
      '2-4-1': [
        { x: cx - 240, y: losY - 20, label: 'LCB' },
        { x: cx - 150, y: losY - 60, label: 'LDT' },
        { x: cx + 150, y: losY - 60, label: 'RDT' },
        { x: cx + 240, y: losY - 20, label: 'RCB' },
        { x: cx - 50,  y: losY - 60, label: 'LB' },
        { x: cx + 50,  y: losY - 60, label: 'LS' },
        { x: cx,       y: losY - 89, label: 'RS' },
      ],
      '5-1-1': [
        { x: cx - 260, y: losY - 15, label: 'LCB' },
        { x: cx - 120, y: losY - 15, label: 'LDT' },
        { x: cx + 120, y: losY - 15, label: 'RDT' },
        { x: cx + 260, y: losY - 15, label: 'RCB' },
        { x: cx,       y: losY - 15, label: 'LB' },
        { x: cx,       y: losY - 70, label: 'LS' },
        { x: cx,       y: losY - 89, label: 'RS' },
      ],
      '3-2-2': [
        { x: cx - 240, y: losY - 20, label: 'LCB' },
        { x: cx,       y: losY - 30, label: 'LDT' },
        { x: cx + 100, y: losY - 70, label: 'RDT' },
        { x: cx + 240, y: losY - 20, label: 'RCB' },
        { x: cx - 100, y: losY - 70, label: 'LB' },
        { x: cx - 100, y: losY - 89, label: 'LS' },
        { x: cx + 100, y: losY - 89, label: 'RS' },
      ],
      '4-1-2': [
        { x: cx - 240, y: losY - 20, label: 'LCB' },
        { x: cx - 100, y: losY - 25, label: 'LDT' },
        { x: cx + 100, y: losY - 25, label: 'RDT' },
        { x: cx + 240, y: losY - 20, label: 'RCB' },
        { x: cx,       y: losY - 70, label: 'LB' },
        { x: cx - 120, y: losY - 89, label: 'LS' },
        { x: cx + 120, y: losY - 89, label: 'RS' },
      ],
    };
    return templates[name] || templates['4-2-1'];
  }

  function getFormationLabel(key) {
    if (!key) return 'Other';
    const builtin = BUILTIN_FORMATIONS.find(f => f.value === key);
    if (builtin) return builtin.label;
    if (key.startsWith('custom:')) return key.slice(7);
    return key;
  }

  function getDefFormationLabel(key) {
    const f = BUILTIN_DEF_FORMATIONS.find(f => f.value === key);
    return f ? f.label : key;
  }

  // ---- Formation Templates ----
  function formationOffense(name) {
    const cx = FIELD_WIDTH / 2;
    const losY = FIELD_HEIGHT - ENDZONE_HEIGHT - 124;
    const base = { C: { x: cx, y: losY + 5 }, QB: { x: cx, y: losY + 30 } };
    const templates = {
      'spread': {
        X: { x: cx - 260, y: losY }, Z: { x: cx + 260, y: losY },
        Y: { x: cx - 110, y: losY }, H: { x: cx + 110, y: losY },
        R: { x: cx, y: losY + 55 }
      },
      'trips-r': {
        X: { x: cx - 260, y: losY }, Z: { x: cx + 260, y: losY },
        Y: { x: cx + 160, y: losY }, H: { x: cx + 80, y: losY },
        R: { x: cx, y: losY + 55 }
      },
      'trips-l': {
        X: { x: cx + 260, y: losY }, Z: { x: cx - 260, y: losY },
        Y: { x: cx - 160, y: losY }, H: { x: cx - 80, y: losY },
        R: { x: cx, y: losY + 55 }
      },
      'bunch-r': {
        X: { x: cx - 260, y: losY }, Z: { x: cx + 180, y: losY },
        Y: { x: cx + 160, y: losY - 25 }, H: { x: cx + 160, y: losY + 25 },
        R: { x: cx, y: losY + 55 }
      },
      'bunch-l': {
        X: { x: cx + 260, y: losY }, Z: { x: cx - 180, y: losY },
        Y: { x: cx - 160, y: losY - 25 }, H: { x: cx - 160, y: losY + 25 },
        R: { x: cx, y: losY + 55 }
      },
      'empty': {
        X: { x: cx - 260, y: losY }, Z: { x: cx + 260, y: losY },
        Y: { x: cx - 120, y: losY }, H: { x: cx + 120, y: losY },
        R: { x: cx + 40, y: losY }
      },
      'stack-r': {
        X: { x: cx - 260, y: losY }, Z: { x: cx + 200, y: losY },
        Y: { x: cx + 200, y: losY - 30 }, H: { x: cx + 100, y: losY },
        R: { x: cx, y: losY + 55 }
      },
      'stack-l': {
        X: { x: cx + 260, y: losY }, Z: { x: cx - 200, y: losY },
        Y: { x: cx - 200, y: losY - 30 }, H: { x: cx - 100, y: losY },
        R: { x: cx, y: losY + 55 }
      },
      'bunch5-r': {
        X: { x: cx + 170, y: losY },      // diamond top
        Z: { x: cx + 200, y: losY + 25 }, // diamond right
        Y: { x: cx + 140, y: losY + 25 }, // diamond left
        H: { x: cx + 170, y: losY + 50 }, // diamond bottom
        R: { x: cx + 70, y: losY }        // C side
      },
      'bunch5-l': {
        X: { x: cx - 170, y: losY },      // diamond top
        Z: { x: cx - 200, y: losY + 25 }, // diamond left
        Y: { x: cx - 140, y: losY + 25 }, // diamond right
        H: { x: cx - 170, y: losY + 50 }, // diamond bottom
        R: { x: cx - 70, y: losY }        // C side
      },
    };
    const t = templates[name];
    if (!t) return null;
    return [
      { ...base.C, label: 'C' },
      { ...base.QB, label: 'QB' },
      { ...t.X, label: 'X' },
      { ...t.Z, label: 'Z' },
      { ...t.Y, label: 'Y' },
      { ...t.H, label: 'H' },
      { ...t.R, label: 'R' },
    ];
  }

  // ---- Color Drawing Functions ----

  function drawFieldTo(c) {
    const w = FIELD_WIDTH, h = FIELD_HEIGHT;
    const ft = 0, fb = h - ENDZONE_HEIGHT, fh = fb - ft;

    c.fillStyle = '#2d6a4f';
    c.fillRect(0, 0, w, h);

    // Bottom end zone only
    c.fillStyle = '#1b4332';
    c.fillRect(0, fb, w, ENDZONE_HEIGHT);

    c.fillStyle = 'rgba(255,255,255,0.15)';
    c.font = 'bold 30px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('END ZONE', w / 2, fb + ENDZONE_HEIGHT / 2);

    // Yard lines
    c.strokeStyle = 'rgba(255,255,255,0.4)';
    c.lineWidth = 1;
    for (let i = 0; i <= YARD_LINES; i++) {
      const y = ft + (fh / YARD_LINES) * i;
      c.beginPath(); c.moveTo(20, y); c.lineTo(w - 20, y); c.stroke();
      if (i > 0 && i < YARD_LINES) {
        // 0yd at scrimmage (i=6), increasing toward end zone
        const yard = (7 - i) * 5;
        if (yard >= 0 && yard <= 25) {
          c.fillStyle = 'rgba(255,255,255,0.3)';
          c.font = '12px sans-serif';
          c.textAlign = 'left'; c.fillText(`${yard}`, 4, y - 3);
          c.textAlign = 'right'; c.fillText(`${yard}`, w - 4, y - 3);
        }
      }
    }

    // Hash marks
    const hl = w * 0.35, hr = w * 0.65;
    c.strokeStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i <= YARD_LINES; i++) {
      const y = ft + (fh / YARD_LINES) * i;
      for (let j = 1; j < 5; j++) {
        const yy = y + (fh / YARD_LINES) * (j / 5);
        if (yy >= fb) continue;
        c.beginPath(); c.moveTo(hl - 4, yy); c.lineTo(hl + 4, yy); c.stroke();
        c.beginPath(); c.moveTo(hr - 4, yy); c.lineTo(hr + 4, yy); c.stroke();
      }
    }

    // Center zone (C must line up within 3yd of QB tee; no catch within 3yd beyond LOS)
    const yardV = fh / (YARD_LINES * 5); // pixels per yard vertically
    const yardHoriz = w / (160 / 3);     // pixels per yard horizontally (160ft field)
    const losLineY = ft + (fh / YARD_LINES) * 7; // LOS at i=7
    const czW = 3 * yardHoriz;  // 3 yards horizontal
    const czH = 3 * yardV;      // 3 yards vertical

    c.strokeStyle = 'rgba(255,255,255,0.3)';
    c.lineWidth = 1;
    c.setLineDash([4, 4]);
    c.strokeRect(w / 2 - czW, losLineY - czH, czW * 2, czH);
    c.setLineDash([]);
    c.fillStyle = 'rgba(255,255,255,0.3)';
    c.font = '10px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'bottom';
    c.fillText('C ZONE (3yd)', w / 2, losLineY - czH - 2);

    c.strokeStyle = 'rgba(255,255,255,0.6)';
    c.lineWidth = 2;
    c.strokeRect(1, ft, w - 2, fh);
    c.strokeStyle = '#fff';
    c.strokeRect(0, 0, w, h);
  }

  function drawArrow(c, fx, fy, tx, ty, color) {
    const angle = Math.atan2(ty - fy, tx - fx);
    const hl = 12;
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(tx, ty);
    c.lineTo(tx - hl * Math.cos(angle - Math.PI / 6), ty - hl * Math.sin(angle - Math.PI / 6));
    c.lineTo(tx - hl * Math.cos(angle + Math.PI / 6), ty - hl * Math.sin(angle + Math.PI / 6));
    c.closePath();
    c.fill();
  }

  // Draw a wavy line between two points
  function drawWavyLine(c, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const waves = Math.max(3, Math.round(len / 12));
    const amp = 5;
    const ux = dx / len, uy = dy / len;
    const nx = -uy, ny = ux;

    c.beginPath();
    c.moveTo(x1, y1);
    for (let i = 1; i <= waves; i++) {
      const t = i / waves;
      const mx = x1 + dx * (t - 0.5 / waves);
      const my = y1 + dy * (t - 0.5 / waves);
      const dir = (i % 2 === 0) ? 1 : -1;
      const cx1 = mx + nx * amp * dir;
      const cy1 = my + ny * amp * dir;
      const ex = x1 + dx * t;
      const ey = y1 + dy * t;
      c.quadraticCurveTo(cx1, cy1, ex, ey);
    }
    c.stroke();
  }

  // Quadratic Bezier control point for a curved segment A→B with curve value c
  function getCurveControlPoint(A, B, c) {
    const mx = (A.x + B.x) / 2;
    const my = (A.y + B.y) / 2;
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return { x: mx, y: my };
    const px = -dy / len;
    const py = dx / len;
    return { x: mx + px * c, y: my + py * c };
  }

  // Per-segment flatten: straight segments pass through, curved segments are interpolated
  function flattenMixedRoute(wps) {
    if (wps.length < 2) return wps.slice();
    const result = [wps[0]];
    for (let i = 1; i < wps.length; i++) {
      const A = wps[i - 1];
      const B = wps[i];
      const c = B.curve || 0;
      if (c === 0) {
        result.push(B);
      } else {
        const cp = getCurveControlPoint(A, B, c);
        const segs = 16;
        for (let t = 1; t <= segs; t++) {
          const tt = t / segs;
          const u = 1 - tt;
          result.push({
            x: u * u * A.x + 2 * u * tt * cp.x + tt * tt * B.x,
            y: u * u * A.y + 2 * u * tt * cp.y + tt * tt * B.y
          });
        }
      }
    }
    return result;
  }

  function routeLabel(play, route) {
    const players = route.type === 'offense' ? play.offense : play.defense;
    const p = players[route.playerIndex];
    return p ? p.label : '';
  }

  // Flatten a single segment A→B (returns array of points)
  function flattenSegment(A, B) {
    const cv = B.curve || 0;
    if (cv === 0) return [A, B];
    const cp = getCurveControlPoint(A, B, cv);
    const pts = [A];
    const segs = 16;
    for (let t = 1; t <= segs; t++) {
      const tt = t / segs;
      const u = 1 - tt;
      pts.push({
        x: u * u * A.x + 2 * u * tt * cp.x + tt * tt * B.x,
        y: u * u * A.y + 2 * u * tt * cp.y + tt * tt * B.y
      });
    }
    return pts;
  }

  // Compute the display position of a cross number on segment [i-1] -> [i]
  // t=0.0 is at rawWps[i-1], t=1.0 is at rawWps[i]
  function crossNumberPosition(rawWps, waypointIndex, t) {
    const A = rawWps[waypointIndex - 1];
    const B = rawWps[waypointIndex];
    const segPts = flattenSegment(A, B);
    const segLen = totalLength(segPts);
    const targetLen = segLen * Math.max(0, Math.min(1, t));
    return pointAtLength(segPts, targetLen);
  }

  function drawCrossNumbers(c, rawWps, color, isBW) {
    for (let i = 1; i < rawWps.length; i++) {
      const wp = rawWps[i];
      if (!wp.crossNumber) continue;
      const t = (wp.crossT !== undefined) ? wp.crossT : 1.0;
      const pos = crossNumberPosition(rawWps, i, t);
      const radius = 14;
      c.beginPath();
      c.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      c.fillStyle = isBW ? '#000' : color;
      c.fill();
      c.strokeStyle = '#fff';
      c.lineWidth = 1.5;
      c.stroke();
      c.font = 'bold 16px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = '#fff';
      c.fillText(String(wp.crossNumber), pos.x, pos.y);
    }
  }

  function drawRoutesTo(c, play, progress) {
    const clip = typeof progress === 'number'; // animation mode
    play.routes.forEach(route => {
      if (route.waypoints.length < 2) return;
      const color = route.type === 'offense'
        ? COLORS_O[route.playerIndex % COLORS_O.length]
        : COLOR_D;

      c.strokeStyle = color;

      const rawWps = route.waypoints;
      const hasCurve = rawWps.some(wp => wp.curve);
      const wps = hasCurve ? flattenMixedRoute(rawWps) : rawWps;
      const total = totalLength(wps);
      const drawLen = clip ? total * progress : total;

      // Segment-by-segment rendering (supports mixed motion/route)
      let drawn = 0;
      let inRoutePath = false;

      for (let i = 0; i < rawWps.length - 1 && drawn < drawLen; i++) {
        const A = rawWps[i];
        const B = rawWps[i + 1];
        const segMotion = !!B.isMotion;
        const segPts = flattenSegment(A, B);
        const segLen = totalLength(segPts);
        const segDrawLen = Math.min(segLen, drawLen - drawn);

        if (segMotion) {
          // End any ongoing route path first
          if (inRoutePath) { c.stroke(); c.setLineDash([]); inRoutePath = false; }

          c.strokeStyle = color;
          c.lineWidth = 2.5;
          c.setLineDash([]);
          let segDrawn = 0;
          for (let j = 0; j < segPts.length - 1 && segDrawn < segDrawLen; j++) {
            const subLen = Math.hypot(segPts[j + 1].x - segPts[j].x, segPts[j + 1].y - segPts[j].y);
            if (subLen === 0) continue;
            const subDraw = Math.min(subLen, segDrawLen - segDrawn);
            const ratio = subDraw / subLen;
            const ex = segPts[j].x + (segPts[j + 1].x - segPts[j].x) * ratio;
            const ey = segPts[j].y + (segPts[j + 1].y - segPts[j].y) * ratio;
            drawWavyLine(c, segPts[j].x, segPts[j].y, ex, ey);
            segDrawn += subDraw;
          }
        } else {
          // Start route path if not already in one
          if (!inRoutePath) {
            c.lineWidth = 3;
            c.strokeStyle = color;
            if (route.style === 'dashed') c.setLineDash([8, 6]);
            else c.setLineDash([]);
            c.beginPath();
            c.moveTo(segPts[0].x, segPts[0].y);
            inRoutePath = true;
          }
          let segDrawn = 0;
          for (let j = 0; j < segPts.length - 1; j++) {
            const subLen = Math.hypot(segPts[j + 1].x - segPts[j].x, segPts[j + 1].y - segPts[j].y);
            if (segDrawn + subLen <= segDrawLen) {
              c.lineTo(segPts[j + 1].x, segPts[j + 1].y);
              segDrawn += subLen;
            } else {
              const remain = segDrawLen - segDrawn;
              if (subLen > 0) {
                const ratio = remain / subLen;
                c.lineTo(
                  segPts[j].x + (segPts[j + 1].x - segPts[j].x) * ratio,
                  segPts[j].y + (segPts[j + 1].y - segPts[j].y) * ratio
                );
              }
              segDrawn = segDrawLen;
              break;
            }
          }
        }
        drawn += segDrawLen;
      }
      // End any ongoing route path
      if (inRoutePath) { c.stroke(); c.setLineDash([]); }

      // Arrow at endpoint
      const end = pointAtLength(wps, drawLen);
      const prev = pointAtLength(wps, Math.max(0, drawLen - 5));
      if (end && prev) drawArrow(c, prev.x, prev.y, end.x, end.y, color);

      // Label at route end: direction from last joint to arrow tip
      if (!clip) {
        const label = routeLabel(play, route);
        if (label) {
          const endPt = rawWps[rawWps.length - 1];
          let prevPt;
          if (rawWps.length >= 3) {
            prevPt = rawWps[rawWps.length - 2];
          } else {
            prevPt = wps.length >= 2 ? wps[wps.length - 2] : endPt;
          }
          const angle = Math.atan2(endPt.y - prevPt.y, endPt.x - prevPt.x);
          const labelDist = 22;
          const lx = endPt.x + Math.cos(angle) * labelDist;
          const ly = endPt.y + Math.sin(angle) * labelDist;
          c.font = 'bold 24px sans-serif';
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.strokeStyle = 'white';
          c.lineWidth = 7;
          c.lineJoin = 'round';
          c.strokeText(label, lx, ly);
          c.fillStyle = color;
          c.fillText(label, lx, ly);
        }
      }

      // Cross order numbers
      if (!clip) drawCrossNumbers(c, rawWps, color, false);
    });
  }

  function totalLength(wps) {
    let len = 0;
    for (let i = 0; i < wps.length - 1; i++)
      len += Math.hypot(wps[i + 1].x - wps[i].x, wps[i + 1].y - wps[i].y);
    return len;
  }

  function pointAtLength(wps, targetLen) {
    let len = 0;
    for (let i = 0; i < wps.length - 1; i++) {
      const seg = Math.hypot(wps[i + 1].x - wps[i].x, wps[i + 1].y - wps[i].y);
      if (len + seg >= targetLen) {
        const ratio = seg > 0 ? (targetLen - len) / seg : 0;
        return {
          x: wps[i].x + (wps[i + 1].x - wps[i].x) * ratio,
          y: wps[i].y + (wps[i + 1].y - wps[i].y) * ratio,
        };
      }
      len += seg;
    }
    return wps[wps.length - 1];
  }

  function drawPlayersTo(c, play) {
    play.offense.forEach((p, i) => {
      c.beginPath();
      c.arc(p.x, p.y, PLAYER_RADIUS, 0, Math.PI * 2);
      c.fillStyle = COLORS_O[i % COLORS_O.length];
      c.fill();
      c.strokeStyle = '#fff';
      c.lineWidth = 2;
      c.stroke();
      c.fillStyle = '#fff';
      c.font = 'bold 18px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(p.label, p.x, p.y);
    });

    play.defense.forEach(p => {
      const r = PLAYER_RADIUS - 2;
      c.strokeStyle = COLOR_D;
      c.lineWidth = 3;
      c.beginPath(); c.moveTo(p.x - r, p.y - r); c.lineTo(p.x + r, p.y + r); c.stroke();
      c.beginPath(); c.moveTo(p.x + r, p.y - r); c.lineTo(p.x - r, p.y + r); c.stroke();
      c.fillStyle = COLOR_D;
      c.font = 'bold 16px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'top';
      c.fillText(p.label, p.x, p.y + r + 2);
    });
  }

  // ---- Filtered Color Renderers (for split formations) ----

  // Draw only routes belonging to players in visibleLabels
  function drawRoutesFilteredTo(c, play, visibleLabels, progress) {
    const visSet = new Set(visibleLabels);
    const filtered = {
      ...play,
      routes: play.routes.filter(r => {
        const players = r.type === 'offense' ? play.offense : play.defense;
        const p = players[r.playerIndex];
        return p && visSet.has(p.label);
      })
    };
    drawRoutesTo(c, filtered, progress);
  }

  // Draw players: visible = normal color, others = ghost, QB always visible
  function drawPlayersFilteredTo(c, play, visibleLabels) {
    const visSet = new Set(visibleLabels);
    play.offense.forEach((p, i) => {
      const isVisible = visSet.has(p.label) || p.label === 'QB';
      c.beginPath();
      c.arc(p.x, p.y, PLAYER_RADIUS, 0, Math.PI * 2);
      if (isVisible) {
        c.fillStyle = COLORS_O[i % COLORS_O.length];
        c.fill();
        c.strokeStyle = '#fff';
        c.lineWidth = 2;
        c.stroke();
        c.fillStyle = '#fff';
      } else {
        c.fillStyle = 'rgba(60,60,80,0.35)';
        c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.25)';
        c.lineWidth = 2;
        c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.4)';
      }
      c.font = 'bold 18px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(p.label, p.x, p.y);
    });

    play.defense.forEach(p => {
      const r = PLAYER_RADIUS - 2;
      c.strokeStyle = 'rgba(173,181,189,0.3)';
      c.lineWidth = 3;
      c.beginPath(); c.moveTo(p.x - r, p.y - r); c.lineTo(p.x + r, p.y + r); c.stroke();
      c.beginPath(); c.moveTo(p.x + r, p.y - r); c.lineTo(p.x - r, p.y + r); c.stroke();
      c.fillStyle = 'rgba(173,181,189,0.3)';
      c.font = 'bold 16px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'top';
      c.fillText(p.label, p.x, p.y + r + 2);
    });
  }

  // ---- Defense Drawing Functions ----

  // ---- Defense Field (flipped: end zone at top) ----
  function drawFieldDefenseTo(c) {
    const w = FIELD_WIDTH, h = FIELD_HEIGHT;
    const ft = ENDZONE_HEIGHT, fb = h, fh = fb - ft;

    c.fillStyle = '#2d6a4f';
    c.fillRect(0, 0, w, h);

    // Top end zone
    c.fillStyle = '#1b4332';
    c.fillRect(0, 0, w, ENDZONE_HEIGHT);
    c.fillStyle = 'rgba(255,255,255,0.15)';
    c.font = 'bold 30px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('END ZONE', w / 2, ENDZONE_HEIGHT / 2);

    // Yard lines
    c.strokeStyle = 'rgba(255,255,255,0.4)';
    c.lineWidth = 1;
    for (let i = 0; i <= YARD_LINES; i++) {
      const y = ft + (fh / YARD_LINES) * i;
      c.beginPath(); c.moveTo(20, y); c.lineTo(w - 20, y); c.stroke();
      if (i > 0 && i < YARD_LINES) {
        const yard = (i - 2) * 5; // LOS at i=2 in flipped view
        if (yard >= 0 && yard <= 25) {
          c.fillStyle = 'rgba(255,255,255,0.3)';
          c.font = '12px sans-serif';
          c.textAlign = 'left'; c.fillText(`${yard}`, 4, y - 3);
          c.textAlign = 'right'; c.fillText(`${yard}`, w - 4, y - 3);
        }
      }
    }

    // Hash marks
    const hl = w * 0.35, hr = w * 0.65;
    c.strokeStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i <= YARD_LINES; i++) {
      const y = ft + (fh / YARD_LINES) * i;
      for (let j = 1; j < 5; j++) {
        const yy = y + (fh / YARD_LINES) * (j / 5);
        if (yy >= fb) continue;
        c.beginPath(); c.moveTo(hl - 4, yy); c.lineTo(hl + 4, yy); c.stroke();
        c.beginPath(); c.moveTo(hr - 4, yy); c.lineTo(hr + 4, yy); c.stroke();
      }
    }

    // C zone
    const yardV = fh / (YARD_LINES * 5);
    const yardHoriz = w / (160 / 3);
    const losLineY = ft + (fh / YARD_LINES) * 2;
    const czW = 3 * yardHoriz;
    const czH = 3 * yardV;
    c.strokeStyle = 'rgba(255,255,255,0.3)';
    c.lineWidth = 1;
    c.setLineDash([4, 4]);
    c.strokeRect(w / 2 - czW, losLineY, czW * 2, czH);
    c.setLineDash([]);
    c.fillStyle = 'rgba(255,255,255,0.3)';
    c.font = '10px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'top';
    c.fillText('C ZONE (3yd)', w / 2, losLineY + czH + 2);

    // Border
    c.strokeStyle = 'rgba(255,255,255,0.6)';
    c.lineWidth = 2;
    c.strokeRect(1, ft, w - 2, fh);
    c.strokeStyle = '#fff';
    c.strokeRect(0, 0, w, h);
  }

  function drawFieldDefenseBW(c) {
    const w = FIELD_WIDTH, h = FIELD_HEIGHT;
    const ft = ENDZONE_HEIGHT, fb = h, fh = fb - ft;

    c.fillStyle = '#fff';
    c.fillRect(0, 0, w, h);

    c.fillStyle = '#eee';
    c.fillRect(0, 0, w, ENDZONE_HEIGHT);
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.font = 'bold 30px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('END ZONE', w / 2, ENDZONE_HEIGHT / 2);

    c.strokeStyle = 'rgba(0,0,0,0.4)';
    c.lineWidth = 1;
    for (let i = 0; i <= YARD_LINES; i++) {
      const y = ft + (fh / YARD_LINES) * i;
      c.beginPath(); c.moveTo(20, y); c.lineTo(w - 20, y); c.stroke();
      if (i > 0 && i < YARD_LINES) {
        const yard = (i - 2) * 5;
        if (yard >= 0 && yard <= 25) {
          c.fillStyle = 'rgba(0,0,0,0.4)';
          c.font = '12px sans-serif';
          c.textAlign = 'left'; c.fillText(`${yard}`, 4, y - 3);
          c.textAlign = 'right'; c.fillText(`${yard}`, w - 4, y - 3);
        }
      }
    }

    const hl = w * 0.35, hr = w * 0.65;
    c.strokeStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i <= YARD_LINES; i++) {
      const y = ft + (fh / YARD_LINES) * i;
      for (let j = 1; j < 5; j++) {
        const yy = y + (fh / YARD_LINES) * (j / 5);
        if (yy >= fb) continue;
        c.beginPath(); c.moveTo(hl - 4, yy); c.lineTo(hl + 4, yy); c.stroke();
        c.beginPath(); c.moveTo(hr - 4, yy); c.lineTo(hr + 4, yy); c.stroke();
      }
    }

    const yardV = fh / (YARD_LINES * 5);
    const yardHoriz = w / (160 / 3);
    const losLineY = ft + (fh / YARD_LINES) * 2;
    const czW = 3 * yardHoriz;
    const czH = 3 * yardV;
    c.strokeStyle = 'rgba(0,0,0,0.35)';
    c.lineWidth = 1;
    c.setLineDash([4, 4]);
    c.strokeRect(w / 2 - czW, losLineY, czW * 2, czH);
    c.setLineDash([]);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.font = '10px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'top';
    c.fillText('C ZONE (3yd)', w / 2, losLineY + czH + 2);

    c.strokeStyle = 'rgba(0,0,0,0.6)';
    c.lineWidth = 2;
    c.strokeRect(1, ft, w - 2, fh);
    c.strokeStyle = '#000';
    c.strokeRect(0, 0, w, h);
  }

  // ---- Defense Mode Drawing ----
  function drawZonesTo(c, play) {
    const losY = FIELD_HEIGHT - ENDZONE_HEIGHT - 124;
    // Draw zone polygons (flipped y)
    play.defenders.forEach(d => {
      const zk = d.zone;
      if (!zk || !ZONE_SHAPES[zk]) return;
      const zt = ZONE_TYPES[zk];
      const verts = ZONE_SHAPES[zk](losY).map(v => [v[0], fy(v[1])]);
      c.globalAlpha = 0.18;
      c.fillStyle = zt.color;
      c.beginPath();
      c.moveTo(verts[0][0], verts[0][1]);
      for (let i = 1; i < verts.length; i++) c.lineTo(verts[i][0], verts[i][1]);
      c.closePath();
      c.fill();
      c.globalAlpha = 0.35;
      c.strokeStyle = zt.color;
      c.lineWidth = 1;
      c.setLineDash([4, 4]);
      c.stroke();
      c.setLineDash([]);
      c.globalAlpha = 1.0;
    });
    // Draw zone labels in center of each polygon
    const losYc = FIELD_HEIGHT - ENDZONE_HEIGHT - 124;
    play.defenders.forEach(d => {
      const zk = d.zone;
      if (!zk) return;
      const zt = ZONE_TYPES[zk];
      if (!zt) return;
      if (!ZONE_SHAPES[zk]) {
        // Special zones: label below defender (flipped)
        c.font = 'bold 16px sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'top';
        c.fillStyle = zt.color;
        c.fillText(zt.label, d.x, fy(d.y) + PLAYER_RADIUS + 3);
        return;
      }
      const verts = ZONE_SHAPES[zk](losYc).map(v => [v[0], fy(v[1])]);
      const cx = verts.reduce((s, v) => s + v[0], 0) / verts.length;
      const cy = verts.reduce((s, v) => s + v[1], 0) / verts.length;
      c.font = 'bold 18px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.globalAlpha = 0.5;
      c.fillStyle = zt.color;
      c.fillText(zt.label, cx, cy);
      c.globalAlpha = 1.0;
    });
  }

  // Ghost offense players (Spread) shown on defense view
  function drawGhostOffense(c) {
    const players = formationOffense('spread');
    if (!players) return;
    c.globalAlpha = 0.25;
    players.forEach(p => {
      const py = fy(p.y);
      c.beginPath();
      c.arc(p.x, py, PLAYER_RADIUS, 0, Math.PI * 2);
      c.fillStyle = '#888';
      c.fill();
      c.strokeStyle = '#aaa';
      c.lineWidth = 1.5;
      c.stroke();
      c.fillStyle = '#ccc';
      c.font = 'bold 16px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(p.label, p.x, py);
    });
    c.globalAlpha = 1.0;
  }

  // Madden-like: arrow from defender to zone drop point
  function drawZoneAssignmentLines(c, play) {
    const losY = FIELD_HEIGHT - ENDZONE_HEIGHT - 124;
    play.defenders.forEach(d => {
      const zk = d.zone;
      if (!zk || !ZONE_SHAPES[zk]) return;
      const zt = ZONE_TYPES[zk];
      const verts = ZONE_SHAPES[zk](losY).map(v => [v[0], fy(v[1])]);
      const zx = verts.reduce((s, v) => s + v[0], 0) / verts.length;
      let zy;
      if (zt.category === 'deep') {
        // Deep: drop point ~12yd from LOS (7on7: 40yd field + 4sec clock)
        const boundary = fy(losY - 70); // under/deep boundary ~8yd
        zy = boundary + 37; // ~12yd from LOS (past boundary into deep zone)
      } else {
        zy = verts.reduce((s, v) => s + v[1], 0) / verts.length;
      }
      const dx = d.x, dy = fy(d.y);
      const angle = Math.atan2(zy - dy, zx - dx);
      const startX = dx + Math.cos(angle) * (PLAYER_RADIUS + 2);
      const startY = dy + Math.sin(angle) * (PLAYER_RADIUS + 2);
      c.strokeStyle = zt.color;
      c.lineWidth = 2;
      c.globalAlpha = 0.6;
      c.setLineDash([6, 3]);
      c.beginPath();
      c.moveTo(startX, startY);
      c.lineTo(zx, zy);
      c.stroke();
      c.setLineDash([]);
      drawArrow(c, startX, startY, zx, zy, zt.color);
      c.globalAlpha = 1.0;
    });
  }

  function drawDefendersDefMode(c, play) {
    play.defenders.forEach(d => {
      const zt = d.zone ? ZONE_TYPES[d.zone] : null;
      const color = zt ? zt.color : '#adb5bd';
      const dy = fy(d.y);
      c.beginPath();
      c.arc(d.x, dy, PLAYER_RADIUS, 0, Math.PI * 2);
      c.fillStyle = color;
      c.globalAlpha = 0.85;
      c.fill();
      c.globalAlpha = 1.0;
      c.strokeStyle = '#fff';
      c.lineWidth = 2;
      c.stroke();
      c.fillStyle = '#fff';
      c.font = 'bold 18px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(d.label, d.x, dy);
    });
  }

  // ---- BW Print Drawing Functions ----

  // BW versions for print
  function drawZonesBW(c, play) {
    const losY = FIELD_HEIGHT - ENDZONE_HEIGHT - 124;
    play.defenders.forEach(d => {
      const zk = d.zone;
      if (!zk || !ZONE_SHAPES[zk]) return;
      const verts = ZONE_SHAPES[zk](losY).map(v => [v[0], fy(v[1])]);
      c.globalAlpha = 0.12;
      c.fillStyle = '#000';
      c.beginPath();
      c.moveTo(verts[0][0], verts[0][1]);
      for (let i = 1; i < verts.length; i++) c.lineTo(verts[i][0], verts[i][1]);
      c.closePath();
      c.fill();
      c.globalAlpha = 0.65;
      c.strokeStyle = '#000';
      c.lineWidth = 2;
      c.setLineDash([]);
      c.stroke();
      c.globalAlpha = 1.0;
    });
    // Deep / Under dividing line
    const divY = fy(losY - 70);
    c.globalAlpha = 0.5;
    c.strokeStyle = '#000';
    c.lineWidth = 2;
    c.setLineDash([]);
    c.beginPath();
    c.moveTo(0, divY);
    c.lineTo(FIELD_WIDTH, divY);
    c.stroke();
    c.globalAlpha = 1.0;
    play.defenders.forEach(d => {
      const zk = d.zone;
      if (!zk) return;
      const zt = ZONE_TYPES[zk];
      if (!zt) return;
      if (!ZONE_SHAPES[zk]) {
        c.font = 'bold 16px sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'top';
        c.fillStyle = '#000';
        c.fillText(zt.label, d.x, fy(d.y) + PLAYER_RADIUS + 3);
        return;
      }
      const verts = ZONE_SHAPES[zk](FIELD_HEIGHT - ENDZONE_HEIGHT - 124).map(v => [v[0], fy(v[1])]);
      const cx = verts.reduce((s, v) => s + v[0], 0) / verts.length;
      const cy = verts.reduce((s, v) => s + v[1], 0) / verts.length;
      c.font = 'bold 20px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.globalAlpha = 0.6;
      c.fillStyle = '#000';
      c.fillText(zt.label, cx, cy);
      c.globalAlpha = 1.0;
    });
  }

  function drawDefendersDefModeBW(c, play) {
    play.defenders.forEach(d => {
      const dy = fy(d.y);
      const zt = d.zone ? ZONE_TYPES[d.zone] : null;
      const cat = zt ? zt.category : null;
      const isDeep = cat === 'deep';
      c.beginPath();
      c.arc(d.x, dy, PLAYER_RADIUS, 0, Math.PI * 2);
      c.fillStyle = isDeep ? '#fff' : '#444';
      c.fill();
      c.strokeStyle = '#000';
      c.lineWidth = isDeep ? 2.5 : 2;
      c.stroke();
      c.fillStyle = isDeep ? '#000' : '#fff';
      c.font = 'bold 18px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(d.label, d.x, dy);
    });
  }

  function drawFieldBW(c) {
    const w = FIELD_WIDTH, h = FIELD_HEIGHT;
    const ft = 0, fb = h - ENDZONE_HEIGHT, fh = fb - ft;

    c.fillStyle = '#fff';
    c.fillRect(0, 0, w, h);

    // Bottom end zone
    c.fillStyle = '#eee';
    c.fillRect(0, fb, w, ENDZONE_HEIGHT);

    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.font = 'bold 30px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('END ZONE', w / 2, fb + ENDZONE_HEIGHT / 2);

    // Yard lines
    c.strokeStyle = 'rgba(0,0,0,0.4)';
    c.lineWidth = 1;
    for (let i = 0; i <= YARD_LINES; i++) {
      const y = ft + (fh / YARD_LINES) * i;
      c.beginPath(); c.moveTo(20, y); c.lineTo(w - 20, y); c.stroke();
      if (i > 0 && i < YARD_LINES) {
        const yard = (7 - i) * 5;
        if (yard >= 0 && yard <= 25) {
          c.fillStyle = 'rgba(0,0,0,0.4)';
          c.font = '12px sans-serif';
          c.textAlign = 'left'; c.fillText(`${yard}`, 4, y - 3);
          c.textAlign = 'right'; c.fillText(`${yard}`, w - 4, y - 3);
        }
      }
    }

    // Hash marks
    const hl = w * 0.35, hr = w * 0.65;
    c.strokeStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i <= YARD_LINES; i++) {
      const y = ft + (fh / YARD_LINES) * i;
      for (let j = 1; j < 5; j++) {
        const yy = y + (fh / YARD_LINES) * (j / 5);
        if (yy >= fb) continue;
        c.beginPath(); c.moveTo(hl - 4, yy); c.lineTo(hl + 4, yy); c.stroke();
        c.beginPath(); c.moveTo(hr - 4, yy); c.lineTo(hr + 4, yy); c.stroke();
      }
    }

    // C zone
    const yardV = fh / (YARD_LINES * 5);
    const yardHoriz = w / (160 / 3);
    const losLineY = ft + (fh / YARD_LINES) * 7;
    const czW = 3 * yardHoriz;
    const czH = 3 * yardV;

    c.strokeStyle = 'rgba(0,0,0,0.35)';
    c.lineWidth = 1;
    c.setLineDash([4, 4]);
    c.strokeRect(w / 2 - czW, losLineY - czH, czW * 2, czH);
    c.setLineDash([]);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.font = '10px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'bottom';
    c.fillText('C ZONE (3yd)', w / 2, losLineY - czH - 2);

    // Border
    c.strokeStyle = 'rgba(0,0,0,0.6)';
    c.lineWidth = 2;
    c.strokeRect(1, ft, w - 2, fh);
    c.strokeStyle = '#000';
    c.strokeRect(0, 0, w, h);
  }

  function drawRoutesBW(c, play) {
    play.routes.forEach(route => {
      if (route.waypoints.length < 2) return;
      const color = '#000';

      c.strokeStyle = color;

      const rawWps = route.waypoints;
      const hasCurve = rawWps.some(wp => wp.curve);
      const wps = hasCurve ? flattenMixedRoute(rawWps) : rawWps;

      // Segment-by-segment rendering (supports mixed motion/route)
      let inRoutePath = false;
      for (let i = 0; i < rawWps.length - 1; i++) {
        const A = rawWps[i];
        const B = rawWps[i + 1];
        const segMotion = !!B.isMotion;
        const segPts = flattenSegment(A, B);

        if (segMotion) {
          if (inRoutePath) { c.stroke(); c.setLineDash([]); inRoutePath = false; }
          c.strokeStyle = color;
          c.lineWidth = 2.5;
          c.setLineDash([]);
          for (let j = 0; j < segPts.length - 1; j++) {
            drawWavyLine(c, segPts[j].x, segPts[j].y, segPts[j + 1].x, segPts[j + 1].y);
          }
        } else {
          if (!inRoutePath) {
            c.lineWidth = 3;
            c.strokeStyle = color;
            if (route.style === 'dashed') c.setLineDash([8, 6]);
            else c.setLineDash([]);
            c.beginPath();
            c.moveTo(segPts[0].x, segPts[0].y);
            inRoutePath = true;
          }
          for (let j = 0; j < segPts.length - 1; j++) {
            c.lineTo(segPts[j + 1].x, segPts[j + 1].y);
          }
        }
      }
      if (inRoutePath) { c.stroke(); c.setLineDash([]); }

      // Arrow at endpoint
      const tLen = totalLength(wps);
      const end = pointAtLength(wps, tLen);
      const prev = pointAtLength(wps, Math.max(0, tLen - 5));
      if (end && prev) drawArrow(c, prev.x, prev.y, end.x, end.y, color);

      // Label at route end
      const label = routeLabel(play, route);
      if (label) {
        const endPt = rawWps[rawWps.length - 1];
        let prevPt;
        if (rawWps.length >= 3) {
          prevPt = rawWps[rawWps.length - 2];
        } else {
          prevPt = wps.length >= 2 ? wps[wps.length - 2] : endPt;
        }
        const angle = Math.atan2(endPt.y - prevPt.y, endPt.x - prevPt.x);
        const labelDist = 22;
        const lx = endPt.x + Math.cos(angle) * labelDist;
        const ly = endPt.y + Math.sin(angle) * labelDist;
        c.font = 'bold 24px sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.strokeStyle = 'white';
        c.lineWidth = 7;
        c.lineJoin = 'round';
        c.strokeText(label, lx, ly);
        c.fillStyle = color;
        c.fillText(label, lx, ly);
      }

      // Cross order numbers
      drawCrossNumbers(c, rawWps, color, true);
    });
  }

  function drawPlayersBW(c, play) {
    play.offense.forEach(p => {
      c.beginPath();
      c.arc(p.x, p.y, PLAYER_RADIUS, 0, Math.PI * 2);
      c.fillStyle = '#000';
      c.fill();
      c.strokeStyle = '#000';
      c.lineWidth = 2;
      c.stroke();
      c.fillStyle = '#fff';
      c.font = 'bold 18px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(p.label, p.x, p.y);
    });

    play.defense.forEach(p => {
      const r = PLAYER_RADIUS - 2;
      c.strokeStyle = '#aaa';
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(p.x - r, p.y - r); c.lineTo(p.x + r, p.y + r); c.stroke();
      c.beginPath(); c.moveTo(p.x + r, p.y - r); c.lineTo(p.x - r, p.y + r); c.stroke();
      c.fillStyle = '#aaa';
      c.font = 'bold 16px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'top';
      c.fillText(p.label, p.x, p.y + r + 2);
    });
  }

  function renderPlayToCanvasBW(c, play) {
    drawFieldBW(c);
    drawRoutesBW(c, play);
    drawPlayersBW(c, play);
  }

  // Filtered BW render: only draw routes/players in visibleLabels, ghost the rest
  function renderPlayToCanvasBWFiltered(c, play, visibleLabels) {
    drawFieldBW(c);

    const visSet = new Set(visibleLabels);

    // Draw only routes for visible players
    play.routes.forEach(route => {
      if (route.waypoints.length < 2) return;
      const players = route.type === 'offense' ? play.offense : play.defense;
      const p = players[route.playerIndex];
      if (!p || !visSet.has(p.label)) return;
      // Reuse BW route drawing for this single route
      drawRoutesBW(c, { ...play, routes: [route] });
    });

    // Draw players: visible = black, others = ghost (light gray)
    play.offense.forEach(p => {
      const isVisible = visSet.has(p.label) || p.label === 'QB';
      c.beginPath();
      c.arc(p.x, p.y, PLAYER_RADIUS, 0, Math.PI * 2);
      c.fillStyle = isVisible ? '#000' : '#ddd';
      c.fill();
      c.strokeStyle = isVisible ? '#000' : '#ccc';
      c.lineWidth = 2;
      c.stroke();
      c.fillStyle = isVisible ? '#fff' : '#aaa';
      c.font = 'bold 18px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(p.label, p.x, p.y);
    });

    // Defense: always ghost in split view
    play.defense.forEach(p => {
      const r = PLAYER_RADIUS - 2;
      c.strokeStyle = '#ddd';
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(p.x - r, p.y - r); c.lineTo(p.x + r, p.y + r); c.stroke();
      c.beginPath(); c.moveTo(p.x + r, p.y - r); c.lineTo(p.x - r, p.y + r); c.stroke();
      c.fillStyle = '#ddd';
      c.font = 'bold 16px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'top';
      c.fillText(p.label, p.x, p.y + r + 2);
    });
  }

  function drawGhostOffenseBW(c) {
    const players = formationOffense('spread');
    if (!players) return;
    c.globalAlpha = 0.22;
    players.forEach(p => {
      const py = fy(p.y);
      c.beginPath();
      c.arc(p.x, py, PLAYER_RADIUS, 0, Math.PI * 2);
      c.fillStyle = '#bbb';
      c.fill();
      c.strokeStyle = '#999';
      c.lineWidth = 1;
      c.stroke();
      c.fillStyle = '#666';
      c.font = 'bold 16px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(p.label, p.x, py);
    });
    c.globalAlpha = 1.0;
  }

  function drawZoneAssignmentLinesBW(c, play) {
    const losY = FIELD_HEIGHT - ENDZONE_HEIGHT - 124;
    play.defenders.forEach(d => {
      const zk = d.zone;
      if (!zk || !ZONE_SHAPES[zk]) return;
      const zt = ZONE_TYPES[zk];
      const verts = ZONE_SHAPES[zk](losY).map(v => [v[0], fy(v[1])]);
      const zx = verts.reduce((s, v) => s + v[0], 0) / verts.length;
      let zy;
      if (zt && zt.category === 'deep') {
        const boundary = fy(losY - 70);
        zy = boundary + 37;
      } else {
        zy = verts.reduce((s, v) => s + v[1], 0) / verts.length;
      }
      const dx = d.x, dy = fy(d.y);
      const angle = Math.atan2(zy - dy, zx - dx);
      const startX = dx + Math.cos(angle) * (PLAYER_RADIUS + 2);
      const startY = dy + Math.sin(angle) * (PLAYER_RADIUS + 2);
      c.strokeStyle = '#000';
      c.lineWidth = 2;
      c.globalAlpha = 0.55;
      c.setLineDash([5, 3]);
      c.beginPath();
      c.moveTo(startX, startY);
      c.lineTo(zx, zy);
      c.stroke();
      c.setLineDash([]);
      drawArrow(c, startX, startY, zx, zy, '#000');
      c.globalAlpha = 1.0;
    });
  }

  function renderDefPlayToCanvasBW(c, play) {
    drawFieldDefenseBW(c);
    drawZonesBW(c, play);
    drawZoneAssignmentLinesBW(c, play);
    drawGhostOffenseBW(c);
    drawDefendersDefModeBW(c, play);
  }

  // ---- Composite Renderers ----

  function renderPlayToCanvas(c, play) {
    drawFieldTo(c);
    drawRoutesTo(c, play);
    drawPlayersTo(c, play);
  }

  function renderDefPlayToCanvas(c, play) {
    drawFieldDefenseTo(c);
    drawZonesTo(c, play);
    drawZoneAssignmentLines(c, play);
    drawGhostOffense(c);
    drawDefendersDefMode(c, play);
  }

  // ---- Public API ----
  return {
    // Constants
    FIELD_WIDTH, FIELD_HEIGHT, YARD_LINES, ENDZONE_HEIGHT, PLAYER_RADIUS, SNAP_THRESHOLD,
    ZONE_TYPES, ZONE_SHAPES, COVERAGE_SCHEMES,
    BUILTIN_DEF_FORMATIONS, BUILTIN_FORMATIONS,
    COLORS_O, COLOR_D,
    // Helpers
    fy, formationOffense, formationDefense, getFormationLabel, getDefFormationLabel,
    // Drawing utilities
    drawArrow, drawWavyLine, getCurveControlPoint, flattenMixedRoute, flattenSegment,
    routeLabel, totalLength, pointAtLength, crossNumberPosition,
    // Color renderers
    drawFieldTo, drawRoutesTo, drawPlayersTo, drawRoutesFilteredTo, drawPlayersFilteredTo,
    drawFieldDefenseTo, drawZonesTo, drawGhostOffense,
    drawZoneAssignmentLines, drawDefendersDefMode,
    renderPlayToCanvas, renderDefPlayToCanvas,
    // BW renderers
    drawFieldBW, drawRoutesBW, drawPlayersBW, renderPlayToCanvasBW, renderPlayToCanvasBWFiltered,
    drawFieldDefenseBW, drawZonesBW, drawDefendersDefModeBW,
    drawGhostOffenseBW, drawZoneAssignmentLinesBW, renderDefPlayToCanvasBW,
  };
})();
