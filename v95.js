/* =====================================================================
   MIDI ROYALE PRO 9.5
   - Preset Quartertone buatan pengguna (simpan, nama bebas, tahan = kelola, pedal ◀ ▶)
   - Reset Triple Controller saat ganti voice (Mod 0, Exp 127, Velocity 100)
   - Klasik: pilihan grid 2x2..5x5, panel kiri dipisah (CHORD/TR/OCT | voice), tile aktif menonjol,
     nama tile tidak terpotong, tab kategori berwarna + jumlah, tab STYLE berkedip saat style jalan
   - Umum: toast di atas, garis merah saat MIDI terputus, efek tekan tombol
   - Pa5X: status style + tempo dari keyboard (MIDI clock)
   Dimuat (defer) setelah index.html, v9.js, pa5x.js. Hanya membungkus fungsi yang sudah ada.
   ===================================================================== */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function en() { try { return currentLang === 'en'; } catch (e) { return false; } }
  function T(a, b) { return en() ? b : a; }
  function note(m) { try { toast(m); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function persist() { try { saveLocalStoragePreset(); } catch (e) {} }
  var NN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  /* ---------------- STATE (ikut Export / Import / Cloud) ---------------- */
  var S = { qt: [], qtCur: -1, trReset: true, grid: { on: false, c: 4, r: 2 } };
  function cleanGrid(g) { var o = { on: false, c: 4, r: 2 }; if (g && typeof g === 'object') { o.on = !!g.on; o.c = Math.max(1, Math.min(8, parseInt(g.c, 10) || 4)); o.r = Math.max(1, Math.min(8, parseInt(g.r, 10) || 2)); } return o; }
  function cleanQt(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, 60).map(function (p) {
      if (!p || typeof p !== 'object') return null;
      var name = String(p.name || '').trim().slice(0, 40); if (!name) return null;
      var q = {};
      if (p.qt && typeof p.qt === 'object') Object.keys(p.qt).forEach(function (k) {
        var i = parseInt(k, 10), c = Number(p.qt[k]);
        if (i >= 0 && i < 12 && isFinite(c)) q[i] = Math.max(-100, Math.min(100, Math.round(c)));
      });
      return { id: String(p.id || ('q' + Math.random().toString(36).slice(2, 8))).slice(0, 20), name: name, qt: q };
    }).filter(Boolean);
  }
  var _xp = window.extraPersist;
  window.extraPersist = function () { var o = _xp ? _xp() : {}; o.v95 = { qt: S.qt, trReset: S.trReset, grid: S.grid }; return o; };
  var _ap = window.applyExtraPersist;
  window.applyExtraPersist = function (p) {
    if (_ap) _ap(p);
    if (!p || typeof p !== 'object' || !p.v95 || typeof p.v95 !== 'object') return;
    S.qt = cleanQt(p.v95.qt);
    if (typeof p.v95.trReset === 'boolean') S.trReset = p.v95.trReset;
    S.grid = cleanGrid(p.v95.grid);
    if (booted) { renderQt(); renderTrRow(); gridApply(); }
  };
  // data yang sudah tersimpan di perangkat (localStorage dimuat sebelum file ini)
  try {
    var saved = JSON.parse(localStorage.getItem('MIDI_ROYALE_PRO_DATA') || '{}');
    if (saved && saved.v95) { S.qt = cleanQt(saved.v95.qt); if (typeof saved.v95.trReset === 'boolean') S.trReset = saved.v95.trReset; S.grid = cleanGrid(saved.v95.grid); }
  } catch (e) {}
  var booted = false;

  /* =====================================================================
     1. PRESET QUARTERTONE BUATAN PENGGUNA
     ===================================================================== */
  function curQt() { var q = {}; try { Object.keys(activeQuartertones).forEach(function (k) { q[k] = activeQuartertones[k]; }); } catch (e) {} return q; }
  function sameQt(a, b) {
    var ka = Object.keys(a), kb = Object.keys(b); if (ka.length !== kb.length) return false;
    return ka.every(function (k) { return b[k] !== undefined && +b[k] === +a[k]; });
  }
  function qtText(q) {
    var k = Object.keys(q).map(Number).sort(function (a, b) { return a - b; });
    if (!k.length) return T('tanpa quartertone', 'no quartertone');
    return k.map(function (i) { return NN[i] + (q[i] !== -50 ? ' ' + q[i] + '¢' : ''); }).join(' · ');
  }
  function applyQt(i) {
    var p = S.qt[i]; if (!p) return;
    try {
      activeQuartertones = {};
      Object.keys(p.qt).forEach(function (k) { activeQuartertones[k] = p.qt[k]; });
      renderPianoTuts(); sendQuartertoneSysEx(); persist();
    } catch (e) { console.error(e); }
    S.qtCur = i; markQt();
    note('♪ ' + p.name + ' · ' + qtText(p.qt));
  }
  window.mrQtPresetStep = function (d) {
    if (!S.qt.length) { note(T('Belum ada preset quartertone buatanmu', 'No custom quartertone presets yet')); return; }
    var i = S.qtCur < 0 ? (d > 0 ? 0 : S.qt.length - 1) : (S.qtCur + d + S.qt.length) % S.qt.length;
    applyQt(i);
  };
  function saveNew() {
    var q = curQt();
    if (!Object.keys(q).length) { note(T('Ketuk nada di piano dulu (mis. E dan A), lalu simpan', 'Tap notes on the piano first (e.g. E and A), then save')); return; }
    if (S.qt.length >= 60) { note(T('Maksimal 60 preset', 'Maximum 60 presets')); return; }
    mrInput(T('Nama preset (mis. C Bayati)', 'Preset name (e.g. C Bayati)'), '', function (n) {
      n = String(n).trim().slice(0, 40); if (!n) { note(T('Nama belum diisi', 'Name is empty')); return; }
      S.qt.push({ id: 'q' + Date.now().toString(36), name: n, qt: q });
      S.qtCur = S.qt.length - 1;
      persist(); renderQt();
      note(T('Preset disimpan: ', 'Preset saved: ') + n);
    });
  }
  function manage(i) {
    var p = S.qt[i]; if (!p) return;
    var m = $('qtMgr');
    if (!m) { m = document.createElement('div'); m.id = 'qtMgr'; m.className = 'v9-modal v9-hide'; document.body.appendChild(m); m.addEventListener('click', onMgr); }
    m.dataset.i = i;
    m.innerHTML = '<div class="v9-card qtm-card"><div class="v9-head"><b>♪ ' + esc(p.name) + '</b><button type="button" class="v9-x" data-q="x">✕</button></div>' +
      '<p class="v9-p dim">' + esc(qtText(p.qt)) + '</p>' +
      '<div class="qtm-acts">' +
      '<button type="button" class="v9-btn pri" data-q="use">▶ ' + T('PAKAI', 'USE') + '</button>' +
      '<button type="button" class="v9-btn" data-q="ren">✎ ' + T('GANTI NAMA', 'RENAME') + '</button>' +
      '<button type="button" class="v9-btn" data-q="over">⟳ ' + T('TIMPA DENGAN TUNING SEKARANG', 'REPLACE WITH CURRENT TUNING') + '</button>' +
      '<button type="button" class="v9-btn" data-q="up">↑ ' + T('GESER KIRI', 'MOVE LEFT') + '</button>' +
      '<button type="button" class="v9-btn bad" data-q="del">✕ ' + T('HAPUS', 'DELETE') + '</button></div></div>';
    m.classList.remove('v9-hide');
  }
  function onMgr(e) {
    var m = $('qtMgr'); if (e.target === m) { m.classList.add('v9-hide'); return; }
    var b = e.target.closest('[data-q]'); if (!b) return;
    var i = parseInt(m.dataset.i, 10), p = S.qt[i], a = b.dataset.q;
    if (!p) { m.classList.add('v9-hide'); return; }
    if (a === 'use') applyQt(i);
    else if (a === 'ren') { mrInput(T('Nama baru', 'New name'), p.name, function (n) { if (String(n).trim()) { p.name = String(n).trim().slice(0, 40); persist(); renderQt(); } }); }
    else if (a === 'over') {
      var q = curQt();
      if (!Object.keys(q).length) { note(T('Tuning sekarang kosong', 'Current tuning is empty')); return; }
      mrAsk(T('Timpa "' + p.name + '" dengan tuning sekarang (' + qtText(q) + ')?', 'Replace "' + p.name + '" with the current tuning (' + qtText(q) + ')?'), function () { p.qt = q; persist(); renderQt(); note(T('Preset diperbarui', 'Preset updated')); });
    }
    else if (a === 'up') { if (i > 0) { S.qt.splice(i - 1, 0, S.qt.splice(i, 1)[0]); persist(); } }
    else if (a === 'del') { mrAsk(T('Hapus preset "' + p.name + '"?', 'Delete preset "' + p.name + '"?'), function () { S.qt.splice(S.qt.indexOf(p), 1); S.qtCur = -1; persist(); renderQt(); }, { ok: T('HAPUS', 'DELETE'), danger: true }); }
    m.classList.add('v9-hide'); renderQt();
  }
  function qtRow() {
    var b = document.querySelector('#panelQt button[onclick*="applyScalePreset(\'nahawand\')"]');
    return b ? b.parentElement : null;
  }
  function renderQt() {
    var row = qtRow(); if (!row) return;
    var box = $('qtUser');
    if (!box) {
      box = document.createElement('div'); box.id = 'qtUser'; box.className = 'qt-user';
      var reset = row.querySelector('button[onclick^="resetAllQuartertones"]');
      row.insertBefore(box, reset || null);
      bindPress(box);
    }
    box.innerHTML = S.qt.map(function (p, i) { return '<button type="button" class="qt-up" data-qi="' + i + '" title="' + esc(qtText(p.qt)) + '">' + esc(p.name) + '</button>'; }).join('') +
      '<button type="button" class="qt-save" data-qs="1">＋ ' + T('SIMPAN', 'SAVE') + '</button>';
    markQt();
  }
  function markQt() {
    var q = curQt();
    document.querySelectorAll('#qtUser .qt-up').forEach(function (b) { var p = S.qt[+b.dataset.qi]; b.classList.toggle('on', !!(p && Object.keys(q).length && sameQt(q, p.qt))); });
  }
  // ketuk = pakai, tahan 0,6 dtk = kelola
  function bindPress(box) {
    var tm = null, long = false;
    box.addEventListener('pointerdown', function (e) {
      var b = e.target.closest('.qt-up'); if (!b) return;
      long = false; clearTimeout(tm);
      tm = setTimeout(function () { long = true; manage(+b.dataset.qi); }, 600);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { box.addEventListener(ev, function () { clearTimeout(tm); }); });
    box.addEventListener('click', function (e) {
      if (e.target.closest('[data-qs]')) { saveNew(); return; }
      var b = e.target.closest('.qt-up'); if (!b) return;
      if (long) { long = false; return; }
      applyQt(+b.dataset.qi);
    });
    box.addEventListener('contextmenu', function (e) { if (e.target.closest('.qt-up')) e.preventDefault(); });
  }
  // tandai preset aktif setiap kali tuning berubah
  ['renderPianoTuts'].forEach(function (fn) {
    var o = window[fn]; if (typeof o !== 'function') return;
    window[fn] = function () { var r = o.apply(this, arguments); try { markQt(); } catch (e) {} return r; };
  });

  /* =====================================================================
     2. RESET TRIPLE CONTROLLER SAAT GANTI VOICE (Mod 0, Exp 127, Velocity 100)
     ===================================================================== */
  var REST = 100;
  function tripleReset() {
    try {
      var chs = targetChannels();
      var m = $('enableModCc'), x = $('enableExpCc');
      if (m && m.checked) chs.forEach(function (c) { sendMidiMessage([0xB0 | c, 1, 0]); });
      if (x && x.checked) chs.forEach(function (c) { sendMidiMessage([0xB0 | c, 11, 127]); });
      lastSentMod = 0; lastSentExp = 127;
      tripleArmed = false;                     // slider kembali "diam": belum mengirim sampai disentuh lagi
      targetTriple = REST; currentTriple = REST;
      renderTripleVisuals(REST);               // velocity 100
    } catch (e) { console.error(e); }
  }
  window.mrTripleReset = tripleReset;
  // Reset bila voice ATAU Keyboard Set/Performance berganti (9.9.4: Performance juga ikut).
  function trKey() {
    var k = ''; try { k = String(activeTileId); } catch (e) {}
    try { if (window.MRKSET && MRKSET.state.lastAction === 'kset') k += '|' + MRKSET.state.activeId; } catch (e) {}
    return k;
  }
  var lastKey = null;
  function trCheck() {
    var k = trKey();
    if (lastKey === null) { lastKey = k; return; }
    if (k === lastKey) return;
    lastKey = k;
    if (S.trReset) tripleReset();
  }
  var _sel = window.selectVoiceTile;
  if (typeof _sel === 'function') {
    window.selectVoiceTile = function (id) {
      if (lastKey === null) lastKey = trKey();
      var r = _sel.apply(this, arguments);
      try { trCheck(); } catch (e) {}
      return r;
    };
  }
  try { if (window.MRKSET && MRKSET.onChange) MRKSET.onChange(function () { try { trCheck(); } catch (e) {} }); } catch (e) {}
  setTimeout(function () { if (lastKey === null) lastKey = trKey(); }, 0);
  function renderTrRow() {
    var b = $('trResetBtn'), n = $('trNowBtn');
    if (n) { n.textContent = '↺ ' + T('RESET', 'RESET'); n.title = T('Kembalikan sekarang: Modulation 0 · Expression 127 · Velocity 100', 'Reset now: Modulation 0 · Expression 127 · Velocity 100'); }
    if (!b) return;
    b.textContent = 'AUTO ' + (S.trReset ? 'ON' : 'OFF');
    b.classList.toggle('on', S.trReset);
    b.title = S.trReset ? T('Reset otomatis saat ganti voice / Performance: Modulation 0 · Expression 127 · Velocity 100', 'Auto reset on voice / Performance change: Modulation 0 · Expression 127 · Velocity 100') : T('Reset otomatis MATI: nilai terakhir terbawa ke voice baru', 'Auto reset OFF: last values carry over to the next voice');
  }
  function trRow() {
    var v = $('tripleValDisplay'); if (!v || $('trResetBtn')) return;
    var n = document.createElement('button'); n.type = 'button'; n.id = 'trNowBtn'; n.className = 'tr-chip tr-now';
    var b = document.createElement('button'); b.type = 'button'; b.id = 'trResetBtn'; b.className = 'tr-chip';
    v.parentNode.insertBefore(n, v);
    v.parentNode.insertBefore(b, v);
    n.onclick = function () { tripleReset(); note(T('Triple Controller direset: Mod 0 · Exp 127 · Velocity 100', 'Triple Controller reset: Mod 0 · Exp 127 · Velocity 100')); };
    b.onclick = function () { S.trReset = !S.trReset; persist(); renderTrRow(); note(b.title); };
    renderTrRow();
  }

  /* =====================================================================
     3. KLASIK: GRID 2x2..5x5 (kolom + baris mengisi panel)
     ===================================================================== */
  function gridSeg() {
    var eb = $('toggleEditModeBtn'); if (!eb || $('mrGridSeg')) return;
    var g = document.createElement('div'); g.id = 'mrGridSeg'; g.className = 'mr-gseg'; g.setAttribute('role', 'group');
    g.innerHTML = '<span class="gi" aria-hidden="true">▦</span>' + ['auto', '2', '3', '4', '5'].map(function (v) {
      return '<button type="button" data-g="' + v + '">' + (v === 'auto' ? 'AUTO' : v + '×' + v) + '</button>';
    }).join('') + '<button type="button" data-g="custom" id="mrGridCustom">' + T('ATUR', 'CUSTOM') + '</button>';
    eb.insertAdjacentElement('afterend', g);
    g.addEventListener('click', function (e) {
      var b = e.target.closest('[data-g]'); if (!b) return;
      if (b.dataset.g === 'custom') { gridPop(b); return; }
      S.grid.on = false; persist();
      try { changeGridCols(b.dataset.g); } catch (x) {}
    });
  }
  // Template 2..5: N kolom, KARTU TEGAK (tinggi ±1,3x lebar, maks. setinggi panel), baris lain digeser.
  // ATUR (custom): kolom x baris pilihan pengguna, kartu mengisi panel persis.
  function gridApply() {
    var grid = $('voiceTilesGrid'); if (!grid) return;
    var v = 'auto'; try { v = String(currentGridCols); } catch (e) {}
    var n = parseInt(v, 10), cust = S.grid.on;
    ['mr-g', 'mr-gbig', 'mr-gmid'].forEach(function (c) { grid.classList.remove(c); });
    document.querySelectorAll('#mrGridSeg [data-g]').forEach(function (b) { b.classList.toggle('on', cust ? b.dataset.g === 'custom' : b.dataset.g === v); });
    var cb = $('mrGridCustom'); if (cb) cb.textContent = cust ? S.grid.c + '×' + S.grid.r : T('ATUR', 'CUSTOM');
    if ((!cust && !(n >= 2 && n <= 5)) || document.body.classList.contains('pa-mode')) { grid.style.removeProperty('--mr-row'); grid.style.removeProperty('--mr-cols'); return; }
    var cs = getComputedStyle(grid), gap = parseFloat(cs.rowGap) || 6, cgap = parseFloat(cs.columnGap) || gap;
    var h = grid.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);
    var w = grid.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    var cols = cust ? S.grid.c : n, row;
    if (cust) row = Math.floor((h - gap * (S.grid.r - 1)) / S.grid.r);
    else row = Math.min(Math.floor(((w - cgap * (cols - 1)) / cols) * 1.3), Math.floor(h));
    row = Math.max(46, row);
    grid.style.setProperty('--mr-cols', cols);
    grid.style.setProperty('--mr-row', row + 'px');
    grid.classList.add('mr-g');
    if (row >= 110) grid.classList.add('mr-gbig'); else if (row >= 72) grid.classList.add('mr-gmid');
  }
  function gridPop(anchor) {
    var p = $('mrGridPop');
    if (p) { p.remove(); return; }
    var t = { c: S.grid.c, r: S.grid.r };
    p = document.createElement('div'); p.id = 'mrGridPop'; p.className = 'mr-gpop';
    var draw = function () {
      p.innerHTML = '<h5>▦ ' + T('ATUR GRID SENDIRI', 'CUSTOM GRID') + '</h5>' +
        '<div class="row">' + T('Kolom', 'Columns') + '<span class="st"><button type="button" data-d="c-">−</button><b>' + t.c + '</b><button type="button" data-d="c+">+</button></span></div>' +
        '<div class="row">' + T('Baris', 'Rows') + '<span class="st"><button type="button" data-d="r-">−</button><b>' + t.r + '</b><button type="button" data-d="r+">+</button></span></div>' +
        '<div class="pv" style="grid-template-columns:repeat(' + t.c + ',1fr);grid-template-rows:repeat(' + t.r + ',1fr)">' + new Array(t.c * t.r + 1).join('<i></i>') + '</div>' +
        '<button type="button" class="ok" data-d="ok">' + T('PAKAI', 'APPLY') + ' ' + t.c + '×' + t.r + '</button>';
    };
    draw();
    document.body.appendChild(p);
    var r = anchor.getBoundingClientRect();
    p.style.top = Math.min(innerHeight - p.offsetHeight - 8, r.bottom + 6) + 'px';
    p.style.left = Math.max(8, Math.min(innerWidth - p.offsetWidth - 8, r.right - p.offsetWidth)) + 'px';
    p.addEventListener('click', function (e) {
      var b = e.target.closest('[data-d]'); if (!b) return; var d = b.dataset.d;
      if (d === 'ok') { S.grid = { on: true, c: t.c, r: t.r }; persist(); p.remove(); try { renderVoiceTiles(); } catch (x) {} gridApply(); fitNames(); return; }
      if (d[0] === 'c') t.c = Math.max(1, Math.min(8, t.c + (d[1] === '+' ? 1 : -1)));
      else t.r = Math.max(1, Math.min(8, t.r + (d[1] === '+' ? 1 : -1)));
      draw();
    });
    setTimeout(function () {
      document.addEventListener('pointerdown', function off(e) { if (!p.parentNode) { document.removeEventListener('pointerdown', off, true); return; } if (!p.contains(e.target) && e.target.id !== 'mrGridCustom') { p.remove(); document.removeEventListener('pointerdown', off, true); } }, true);
    }, 0);
  }
  var _cg = window.changeGridCols;
  if (typeof _cg === 'function') window.changeGridCols = function () { var r = _cg.apply(this, arguments); gridApply(); fitNames(); return r; };

  /* =====================================================================
     4. KLASIK: TILE AKTIF / UP2 / UP3, NAMA TIDAK TERPOTONG
     ===================================================================== */
  function markTiles() {
    var u3 = null; try { u3 = (dualEnabled && upper3Channel > 0 && upper3Voice) ? upper3Voice.id : null; } catch (e) {}
    document.querySelectorAll('#voiceTilesGrid .voice-tile').forEach(function (c) {
      var ed = false; try { ed = isEditMode; } catch (e) {}
      var bd = ed ? '' : c.classList.contains('active-tile') ? T('AKTIF', 'ACTIVE') : c.classList.contains('layer-tile') ? 'UP2' : '';
      c.classList.remove('u3-tile');
      if (!bd && !ed && u3 != null) {
        var h = c.querySelector('h4');
        try { var t = voiceTiles.find(function (x) { return x.id === u3; }); if (t && h && h.textContent === String(t.name)) { bd = 'UP3'; c.classList.add('u3-tile'); } } catch (e) {}
      }
      var old = c.querySelector('.mr-badge'); if (old) old.remove();
      if (bd) { var sp = document.createElement('span'); sp.className = 'mr-badge'; sp.textContent = bd; c.appendChild(sp); }
    });
  }
  function fitNames() {
    var hs = document.querySelectorAll('#voiceTilesGrid .voice-tile h4');
    hs.forEach(function (h) { h.classList.remove('mr-fit2'); h.style.removeProperty('font-size'); });
    hs.forEach(function (h) {
      if (h.scrollWidth <= h.clientWidth) return;
      var fs0 = parseFloat(getComputedStyle(h).fontSize) || 10, fs = fs0, n = 0;
      // 1) kecilkan huruf di satu baris (maks. ±30%)
      while (h.scrollWidth > h.clientWidth && fs > Math.max(7, fs0 * 0.68) && n++ < 12) { fs -= 0.5; h.style.setProperty('font-size', fs + 'px', 'important'); }
      if (h.scrollWidth <= h.clientWidth) return;
      // 2) masih kepanjangan: dua baris
      h.style.removeProperty('font-size'); fs = fs0; n = 0;
      h.classList.add('mr-fit2');
      while (h.scrollHeight > h.clientHeight + 1 && fs > 7 && n++ < 12) { fs -= 0.5; h.style.setProperty('font-size', fs + 'px', 'important'); }
    });
  }

  /* =====================================================================
     5. KLASIK: TAB KATEGORI BERWARNA + JUMLAH VOICE
     ===================================================================== */
  var CATC = { all: '212 175 55', fav: '250 204 21', keys: '34 211 238', orchestral: '167 139 250', ethnic: '251 146 60', brass: '245 158 11', guitar: '163 230 53', percussion: '251 113 133' };
  function colorCats() {
    var box = $('categoryTabs'); if (!box) return;
    var btns = box.querySelectorAll('.category-tab');
    try {
      categories.forEach(function (c, i) {
        var b = btns[i]; if (!b) return;
        b.style.setProperty('--cc', CATC[c.id] || '148 163 184');
        b.classList.add('mr-cc');
        var n = c.id === 'all' ? voiceTiles.length : c.id === 'fav' ? voiceTiles.filter(function (t) { return t.fav; }).length : voiceTiles.filter(function (t) { return t.category === c.id; }).length;
        var s = b.querySelector('.mr-cn'); if (!s) { s = document.createElement('span'); s.className = 'mr-cn'; b.appendChild(s); }
        s.textContent = n;
      });
    } catch (e) {}
  }
  var _rct = window.renderCategoryTabs;
  if (typeof _rct === 'function') window.renderCategoryTabs = function () { var r = _rct.apply(this, arguments); colorCats(); return r; };
  var _rvt = window.renderVoiceTiles;
  if (typeof _rvt === 'function') window.renderVoiceTiles = function () {
    var r = _rvt.apply(this, arguments);
    try { markTiles(); gridApply(); colorCats(); requestAnimationFrame(fitNames); } catch (e) {}
    return r;
  };

  /* =====================================================================
     6. STATUS STYLE (perkiraan) + TEMPO DARI KEYBOARD (MIDI clock)
     ===================================================================== */
  var run = false, endT = null, clk = { n: 0, last: 0, t0: 0, bpm: 0, beat: 0 };
  function setRun(v) { run = !!v; clearTimeout(endT); paintRun(); }
  window.mrStyleRunning = function () { return run || (clk.last && performance.now() - clk.last < 1500 && clk.play); };
  window.mrStyleLabel = function () {
    var d = $('activeStyleDisplay'); var t = d ? d.textContent.trim() : '';
    var m = t.match(/^(?:ACTIVE|AKTIF)\s*:\s*(.+)$/i); return m ? m[1].trim().slice(0, 16) : '';
  };
  var _tsc = window.triggerStyleCommand;
  if (typeof _tsc === 'function') window.triggerStyleCommand = function (k) {
    var r = _tsc.apply(this, arguments);
    try {
      if (k === 'START_STOP') setRun(!run);
      else if (/^ENDING/.test(k)) { clearTimeout(endT); endT = setTimeout(function () { run = false; paintRun(); }, 4000); }
      else if (/^(VAR|INTRO|FILL|BREAK|COUNT)/.test(k) && /^INTRO|^COUNT/.test(k) === false) { /* VAR/FILL tidak mengubah status */ }
    } catch (e) {}
    return r;
  };
  var _mo = window.mrOnPanic;
  window.mrOnPanic = function () { try { if (_mo) _mo.apply(this, arguments); } catch (e) {} setRun(false); };
  window.mrClockHook = function (b, now) {
    if (b === 0xFA || b === 0xFB) { clk.play = true; clk.n = 0; setRun(true); return; }
    if (b === 0xFC) { clk.play = false; setRun(false); return; }
    clk.last = now;
    if (clk.n % 24 === 0) {
      if (clk.t0) { var ms = now - clk.t0; if (ms > 150 && ms < 3000) { var bpm = 60000 / ms; clk.bpm = clk.bpm ? clk.bpm * 0.6 + bpm * 0.4 : bpm; } }
      clk.t0 = now; clk.beat++;
      beatFlash();
    }
    clk.n++;
  };
  function beatFlash() {
    var b = $('paBeat'); if (!b) return;
    b.classList.add('on'); b.classList.toggle('down', clk.beat % 4 === 1);
    var v = b.querySelector('b'); if (v && clk.bpm) v.textContent = Math.round(clk.bpm);
    var i = b.querySelector('i'); if (i) { i.classList.remove('hit'); void i.offsetWidth; i.classList.add('hit'); }
  }
  function paintRun() {
    var on = window.mrStyleRunning();
    var nb = $('navStyleBtn'); if (nb) nb.classList.toggle('mr-run', !!on);
  }
  setInterval(function () {
    paintRun();
    var b = $('paBeat'); if (b && !(clk.last && performance.now() - clk.last < 1500)) b.classList.remove('on');
  }, 600);

  /* =====================================================================
     7. UMUM: GARIS MERAH SAAT MIDI TERPUTUS, EFEK TEKAN, TOAST DI ATAS
     ===================================================================== */
  var everOn = false, offBanner = null;
  function midiWatch() {
    var d = $('midiStatusDot'); if (!d) return;
    var check = function () {
      var on = /emerald|green/.test(d.className) && !/red/.test(d.className);
      if (on) everOn = true;
      var lost = everOn && !on;
      document.body.classList.toggle('mr-midi-lost', lost);
      if (lost && !offBanner) {
        offBanner = document.createElement('div'); offBanner.className = 'mr-lost-pill';
        offBanner.textContent = T('MIDI TERPUTUS · cek kabel / Bluetooth', 'MIDI DISCONNECTED · check cable / Bluetooth');
        document.body.appendChild(offBanner);
        setTimeout(function () { if (offBanner) offBanner.classList.add('fade'); }, 4500);
      } else if (!lost && offBanner) { offBanner.remove(); offBanner = null; }
    };
    new MutationObserver(check).observe(d, { attributes: true, attributeFilter: ['class'] });
    check();
  }
  var PRESS = '.voice-tile, .style-btn, .reg-btn, .ptoggle, .pstep, .main-tab-btn, .category-tab, .mr-nav, .mr-to-pa, .qt-up, .qt-save, #paRoot button, .mr-gseg button';
  document.addEventListener('pointerdown', function (e) {
    var b = e.target.closest && e.target.closest(PRESS); if (!b) return;
    if (b.closest('#panelStyle')) return;      // tombol style memakai umpan balik instan sendiri (lebih ringan)
    b.classList.remove('mr-press'); void b.offsetWidth; b.classList.add('mr-press');
    setTimeout(function () { b.classList.remove('mr-press'); }, 260);
  }, { passive: true });

  /* =====================================================================
     8. KLASIK: PANEL KIRI DIPISAH (CHORD/TR/OCT di atas, kotak voice di bawah)
     ===================================================================== */
  function splitHero() {
    var hero = $('mrHero'); if (!hero || hero.classList.contains('mr-split')) return;
    var stat = $('mrHeroStat'); if (!stat) return;
    var box = document.createElement('div'); box.className = 'mr-vbox';
    Array.prototype.slice.call(hero.children).forEach(function (c) { if (c !== stat) box.appendChild(c); });
    hero.appendChild(box);
    hero.classList.add('mr-split');
  }

  /* =====================================================================
     9. Pa5X ANIMASI: penanda tab meluncur, layar menyala, angka bergulir, akor muncul,
        tempo untuk tombol style "bernapas", garis LCD bergerak
     ===================================================================== */
  function paTabInd() {
    var tabs = document.querySelector('#paRoot .pa-tabs'); if (!tabs) return;
    var ind = tabs.querySelector('.pa-tind');
    if (!ind) { ind = document.createElement('i'); ind.className = 'pa-tind'; tabs.appendChild(ind); }
    var on = tabs.querySelector('button.on'); if (!on) { ind.style.width = '0'; return; }
    ind.style.left = (on.offsetLeft + on.offsetWidth * 0.18) + 'px';
    ind.style.width = (on.offsetWidth * 0.64) + 'px';
  }
  function rollOn(el) {
    if (!el || el.__roll) return; el.__roll = 1;
    var last = el.textContent;
    new MutationObserver(function () {
      var t = el.textContent; if (t === last) return; last = t;
      el.classList.remove('mr-roll'); void el.offsetWidth; el.classList.add('mr-roll');
    }).observe(el, { childList: true, characterData: true, subtree: true });
  }
  function popOn(el) {
    if (!el || el.__pop) return; el.__pop = 1;
    var last = el.textContent;
    new MutationObserver(function () {
      var t = el.textContent; if (t === last) return; last = t;
      if (/^[–-]$/.test(t.trim())) return;
      el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    }).observe(el, { childList: true, characterData: true, subtree: true });
  }
  var paHooked = false;
  function paHook() {
    var root = $('paRoot'); if (!root) return;
    if (!paHooked) {
      paHooked = true;
      var tabs = root.querySelector('.pa-tabs');
      if (tabs) new MutationObserver(paTabInd).observe(tabs, { attributes: true, subtree: true, attributeFilter: ['class'] });
      window.addEventListener('resize', function () { setTimeout(paTabInd, 60); });
      ['paTr', 'paOc'].forEach(function (id) { rollOn($(id)); });   // angka slider (pitch/triple) TANPA animasi
      popOn(root.querySelector('#paChord b')); popOn(document.querySelector('#chordPill b'));
      var keys = root.querySelector('.pa-keys');
      if (keys && !keys.querySelector('.mr-sweep')) { var sw = document.createElement('i'); sw.className = 'mr-sweep'; sw.setAttribute('aria-hidden', 'true'); keys.appendChild(sw); }
    }
    setTimeout(paTabInd, 30);
  }
  function paBoot() {
    var root = $('paRoot'); if (!root) return;
    paHook();
    root.classList.remove('pa-boot'); void root.offsetWidth; root.classList.add('pa-boot');
    setTimeout(function () { root.classList.remove('pa-boot'); }, 900);
  }
  var wasPa = document.body.classList.contains('pa-mode');
  new MutationObserver(function () {
    var is = document.body.classList.contains('pa-mode');
    if (is && !wasPa) setTimeout(paBoot, 20);
    wasPa = is;
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  // tempo dari MIDI clock -> kecepatan "napas" tombol style aktif
  setInterval(function () {
    var r = $('paRoot'); if (!r) return;
    if (clk.bpm && clk.last && performance.now() - clk.last < 1500) r.style.setProperty('--beat', (60 / clk.bpm).toFixed(3) + 's');
    else r.style.removeProperty('--beat');
  }, 1000);

  /* =====================================================================
     10. STYLE PLAY RESPONSIF (live): perintah dikirim SAAT JARI MENYENTUH (pointerdown),
         bukan saat jari diangkat. Geser jari sedikit tidak membatalkan. Klik susulan diabaikan.
     ===================================================================== */
  var styleFired = new WeakMap();
  function styleCmdOf(b) { var m = /triggerStyleCommand\('([A-Z0-9_]+)'\)/.exec(b.getAttribute('onclick') || ''); return m ? m[1] : null; }
  document.addEventListener('pointerdown', function (e) {
    if (e.button > 0) return;
    var b = e.target.closest && e.target.closest('#panelStyle button[onclick*="triggerStyleCommand"]'); if (!b) return;
    var cmd = styleCmdOf(b); if (!cmd) return;
    e.preventDefault();                                  // cegah fokus/scroll menunda kirim
    var now = performance.now(), last = styleFired.get(b) || 0;
    if (now - last < 35) return;                         // pantulan jari ganda (bounce)
    styleFired.set(b, now);
    b.classList.add('mr-hit'); setTimeout(function () { b.classList.remove('mr-hit'); }, 140);
    try { triggerStyleCommand(cmd); } catch (x) { console.error(x); }
    try { haptic(8); } catch (x) {}                    // ikut setelan Haptic
  }, true);
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#panelStyle button[onclick*="triggerStyleCommand"]'); if (!b) return;
    var t = styleFired.get(b);
    if (t && performance.now() - t < 1500) { e.preventDefault(); e.stopImmediatePropagation(); }   // sudah terkirim saat disentuh
  }, true);

  /* ---------------- BAHASA ---------------- */
  (window.mrLangHooks = window.mrLangHooks || []).push(function () {
    renderQt(); renderTrRow(); markTiles(); gridApply();
    if (offBanner) offBanner.textContent = T('MIDI TERPUTUS · cek kabel / Bluetooth', 'MIDI DISCONNECTED · check cable / Bluetooth');
  });

  /* ---------------- MULAI ---------------- */
  function boot() {
    if (booted) return; booted = true;
    try { splitHero(); } catch (e) { console.error(e); }
    try { gridSeg(); } catch (e) { console.error(e); }
    try { renderQt(); trRow(); midiWatch(); } catch (e) { console.error(e); }
    try { colorCats(); markTiles(); gridApply(); fitNames(); } catch (e) { console.error(e); }
    try { if (document.body.classList.contains('pa-mode')) paBoot(); popOn(document.querySelector('#chordPill b')); } catch (e) { console.error(e); }
    var grid = $('voiceTilesGrid');
    if (grid && window.ResizeObserver) { var rt = null; new ResizeObserver(function () { clearTimeout(rt); rt = setTimeout(function () { gridApply(); fitNames(); }, 120); }).observe(grid); }
  }
  if (document.readyState === 'complete') setTimeout(boot, 50); else window.addEventListener('load', function () { setTimeout(boot, 50); });

  window.MRV95 = { state: S, applyQt: applyQt, saveNew: saveNew, manage: manage, tripleReset: tripleReset, gridApply: gridApply, fitNames: fitNames, clock: clk, setRun: setRun };
})();
