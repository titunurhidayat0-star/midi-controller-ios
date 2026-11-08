/* =====================================================================
   MIDI ROYALE PRO - PERFORMANCE (KBD SET) v9.7
   Di Korg Pa: SOUND = satu suara di satu Upper. PERFORMANCE = "folder" berisi Upper 1/2/3
   + octave, efek, dll., dipilih lewat Bank Select (CC0/CC32) + Program Change di channel Control.

   - Performance (tipe 'ctrl'): yang dikirim HANYA nomor Performance di channel Control, jadi
     keyboard berpindah Performance (foldernya), bukan sekadar mengganti isinya.
   - Pa600 tidak mengirim nomor Performance lewat MIDI OUT. Nomornya dicari dengan mode CARI NOMOR:
     setiap tekan ◀ ▶ langsung dikirim, pengguna melihat layar keyboard, lalu SIMPAN.
   - Nama Upper 1/2/3 disimpan sebagai keterangan (untuk tampilan MAIN). Diisi otomatis dari MIDI IN
     saat tombol Performance yang sama ditekan di panel keyboard, atau dipilih dari daftar sound.
   - Tipe lama 'snap' (rekaman isi sound) tetap bisa dipakai, ditandai SNAPSHOT SOUND.

   Dimuat setelah pro.js. Memakai fungsi global yang sudah ada dan membungkusnya.
   ===================================================================== */
(function () {
  'use strict';

  var MAX_KS = 500, MAX_MSGS = 400, MAX_FOLDERS = 40;
  var COLORS = ['amber', 'cyan', 'purple', 'rose', 'emerald'];
  // Susunan Keyboard Set Library Pa600
  var BANKS_K = [['factory', 'Factory'], ['user', 'User'], ['direct', 'Direct']];
  var CATS_K = ['Piano & EP', 'Organ', 'Guitar', 'Strings', 'Brass', 'Trumpet', 'Sax & Wood.', 'Synth', 'Ethnic'];
  var CATS_L = 5, PAGES = 6, SLOTS = 8;
  var SKIP_CC = { 1: 1, 2: 1, 4: 1, 64: 1, 66: 1, 67: 1, 120: 1, 123: 1, 124: 1, 125: 1, 126: 1, 127: 1 };
  var CC_NAMES = { 7: 'Vol', 10: 'Pan', 11: 'Exp', 71: 'Reso', 72: 'Rel', 73: 'Atk', 74: 'Cutoff', 91: 'Rev', 93: 'Cho', 94: 'FX', 121: 'Reset' };

  var KS = {
    list: [], activeId: null, lastAction: 'voice', edit: false,
    folders: [], folder: 'all', q: '', cols: 3, view: 'factory', cat: 0, page: 1,
    cur: { 1: null, 2: null, 3: null },   // sound Upper 1-3 yang sedang terpasang di keyboard (perkiraan)
    dirty: {},                            // Upper yang diganti setelah Performance dipanggil
    ext: false                            // Performance diganti dari panel keyboard (tidak dikenal)
  };
  var cap = null;          // sesi rekam snapshot
  var editId = null;       // id yang sedang diedit (null = baru)
  var draft = null;        // salinan data di modal
  var finder = false;      // modal CARI NOMOR terbuka
  var booted = false;
  var hooks = [];

  function $(id) { return document.getElementById(id); }
  function note(m) { try { toast(m); } catch (e) {} }
  function persist() { try { saveLocalStoragePreset(); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function m7(v) { var k = parseInt(v, 10); return isNaN(k) ? 0 : Math.max(0, Math.min(127, k)); }
  function en() { try { return currentLang === 'en'; } catch (e) { return false; } }
  function T(id, eng) { return en() ? eng : id; }
  function uid() { return 'ks' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
  function find(id) { for (var i = 0; i < KS.list.length; i++) if (KS.list[i].id === id) return KS.list[i]; return null; }
  function ctrlCh() { return (styleCtrlChannel - 1) & 0x0F; }
  function lsg(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lss(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function pcB() { try { return pcBase | 0; } catch (e) { return 0; } }

  /* ---------------------------------------------------------------
     Tampilan utama: PERFORMANCE (bawaan) atau SOUND
     --------------------------------------------------------------- */
  function mainMode() { return lsg('mrMainMode') === 'sound' ? 'sound' : 'perf'; }
  window.mrMainMode = mainMode;
  window.mrSetMainMode = function (m) {
    lss('mrMainMode', m === 'sound' ? 'sound' : 'perf');
    var s = $('settingMainMode'); if (s) s.value = mainMode();
    changed();
  };

  /* ---------------------------------------------------------------
     Upper 1/2/3: keterangan sound
     u = { n: nama, m: CC0, l: CC32, p: PC yang dikirim (0-127), t: id tile voice bila ada }
     --------------------------------------------------------------- */
  function tiles() { try { return voiceTiles || []; } catch (e) { return []; } }
  function tileById(id) { if (id == null || id === '') return null; var a = tiles(); for (var i = 0; i < a.length; i++) if (String(a[i].id) === String(id)) return a[i]; return null; }
  function outPc(t) { try { return pcOut(t.pc); } catch (e) { return m7(t.pc); } }
  function tileByNums(m, l, p) { var a = tiles(); for (var i = 0; i < a.length; i++) { var t = a[i]; if ((m === null || t.msb === m) && (t.lsb | 0) === (l | 0) && outPc(t) === p) return t; } return null; }
  function upFromTile(t) { return t ? { n: String(t.name || '').slice(0, 60), m: m7(t.msb), l: m7(t.lsb), p: outPc(t), t: String(t.id) } : null; }
  function upFromNums(m, l, p) { var t = tileByNums(m, l, p); return t ? upFromTile(t) : { n: '', m: m7(m), l: m7(l), p: m7(p), t: '' }; }
  function cleanUp(u) {
    if (!u || typeof u !== 'object') return null;
    return { n: String(u.n == null ? '' : u.n).slice(0, 60), m: m7(u.m), l: m7(u.l), p: m7(u.p), t: String(u.t == null ? '' : u.t).slice(0, 40) };
  }
  function upTile(u) { if (!u) return null; var t = tileById(u.t); return t || tileByNums(u.m, u.l, u.p); }
  function upName(u) {
    if (!u) return '';
    var t = tileById(u.t); if (t) return String(t.name);
    if (u.n) return u.n;
    t = tileByNums(u.m, u.l, u.p); if (t) return String(t.name);
    return 'SOUND ' + u.m + '.' + u.l + '.' + (u.p + pcB());
  }
  function sameUp(a, b) { return !!(a && b && a.m === b.m && a.l === b.l && a.p === b.p); }
  function copyUp(u) { return u ? { n: u.n, m: u.m, l: u.l, p: u.p, t: u.t } : null; }
  function chOf(k) {
    try {
      if (k === 1) return mainIdx();
      if (k === 2) return layerIdx();
      if (k === 3) return upper3Channel > 0 ? upper3Idx() : -1;
    } catch (e) {}
    return -1;
  }
  function upperOf(ch) { for (var k = 1; k <= 3; k++) if (chOf(k) === ch) return k; return 0; }
  function chNo(k) { var c = chOf(k); return c < 0 ? 0 : c + 1; }

  /* ---------------------------------------------------------------
     Data & pembersih
     --------------------------------------------------------------- */
  function msgLen(st) { var h = st & 0xF0; return (h === 0xC0 || h === 0xD0) ? 2 : 3; }
  function cleanMsg(m) {
    if (!m || typeof m.length !== 'number' || !m.length) return null;
    var a = Array.prototype.map.call(m, function (x) { return x | 0; });
    if (a[0] === 0xF0) {
      if (a.length < 3 || a.length > 512 || a[a.length - 1] !== 0xF7) return null;
      for (var i = 1; i < a.length - 1; i++) if (a[i] < 0 || a[i] > 127) return null;
      return a;
    }
    if (a[0] < 0x80 || a[0] > 0xEF) return null;
    var n = msgLen(a[0]);
    if (a.length < n) return null;
    a = a.slice(0, n);
    for (var j = 1; j < n; j++) if (a[j] < 0 || a[j] > 127) return null;
    return a;
  }
  function cleanFolder(f) { return String(f == null ? '' : f).replace(/[\u0000-\u001f]/g, '').trim().slice(0, 24); }
  function cleanPos(p) {
    if (!p || typeof p !== 'object' || ['factory', 'user', 'direct'].indexOf(p.b) < 0) return null;
    var n = function (v, lo, hi) { v = parseInt(v, 10); return isNaN(v) ? lo : Math.max(lo, Math.min(hi, v)); };
    return { b: p.b, c: n(p.c, 0, CATS_K.length - 1), pg: n(p.pg, 1, PAGES), s: n(p.s, 1, SLOTS) };
  }
  function cleanKs(k, i) {
    if (!k || typeof k !== 'object') return null;
    var type = k.type === 'ctrl' ? 'ctrl' : 'snap';
    var o = {
      id: String(k.id == null || k.id === '' ? uid() + i : k.id).slice(0, 40),
      name: String(k.name == null ? '' : k.name).trim().slice(0, 40) || ('PERFORMANCE ' + (i + 1)),
      type: type,
      color: COLORS.indexOf(k.color) >= 0 ? k.color : 'amber',
      resend: k.resend !== false,
      folder: cleanFolder(k.folder),
      pos: cleanPos(k.pos)
    };
    if (type === 'ctrl') {
      var c = k.ctrl && typeof k.ctrl === 'object' ? k.ctrl : {};
      o.ctrl = { msb: m7(c.msb), lsb: m7(c.lsb), pc: m7(c.pc), pcOnly: !!c.pcOnly };
      var u = Array.isArray(k.uppers) ? k.uppers : [];
      o.uppers = [cleanUp(u[0]), cleanUp(u[1]), cleanUp(u[2])];
    } else {
      o.msgs = (Array.isArray(k.msgs) ? k.msgs : []).slice(0, MAX_MSGS).map(cleanMsg).filter(Boolean);
      if (!o.msgs.length) return null;
    }
    return o;
  }
  function cleanList(arr) {
    var out = [], seen = {};
    (Array.isArray(arr) ? arr : []).slice(0, MAX_KS).forEach(function (k, i) {
      var c = cleanKs(k, i);
      if (c && !seen[c.id]) { seen[c.id] = 1; out.push(c); }
    });
    return out;
  }
  function cleanFolders(arr, list) {
    var out = [];
    (Array.isArray(arr) ? arr : []).forEach(function (f) { f = cleanFolder(f); if (f && out.indexOf(f) < 0 && out.length < MAX_FOLDERS) out.push(f); });
    (list || []).forEach(function (k) { if (k.folder && out.indexOf(k.folder) < 0 && out.length < MAX_FOLDERS) out.push(k.folder); });
    return out;
  }

  // Tile voice lama yang berisi Keyboard Set (kpc) dipindah ke tab ini.
  function migrateTiles() {
    try {
      if (!Array.isArray(voiceTiles)) return 0;
      var ks = voiceTiles.filter(function (t) { return t && t.kpc !== undefined; });
      if (!ks.length) return 0;
      var keepAll = ks.length >= voiceTiles.length;
      ks.forEach(function (t) {
        var pcOnly = t.kpc >= 64 && t.kpc <= 67 && !t.kmsb && !t.klsb;
        var dup = KS.list.some(function (k) { return k.type === 'ctrl' && k.name === t.name && k.ctrl.pc === t.kpc && k.ctrl.msb === (t.kmsb | 0) && k.ctrl.lsb === (t.klsb | 0); });
        if (!dup && KS.list.length < MAX_KS) KS.list.push({ id: uid(), name: String(t.name || 'PERFORMANCE').slice(0, 40), type: 'ctrl', color: 'amber', resend: true, folder: '', ctrl: { msb: m7(t.kmsb), lsb: m7(t.klsb), pc: m7(t.kpc), pcOnly: pcOnly }, uppers: [null, null, null] });
      });
      if (keepAll) voiceTiles.forEach(function (t) { delete t.kpc; delete t.kmsb; delete t.klsb; });
      else {
        voiceTiles = voiceTiles.filter(function (t) { return t.kpc === undefined; });
        if (!voiceTiles.some(function (t) { return t.id === activeTileId; })) activeTileId = voiceTiles[0].id;
      }
      return ks.length;
    } catch (e) { return 0; }
  }

  /* ---------------------------------------------------------------
     Pembungkus fungsi lama: simpan/ekspor/impor/cloud, REG & setlist
     --------------------------------------------------------------- */
  var _extraPersist = window.extraPersist;
  window.extraPersist = function () {
    var o = _extraPersist();
    o.ksets = { list: KS.list, activeId: KS.activeId, folders: KS.folders };
    return o;
  };
  var _applyExtraPersist = window.applyExtraPersist;
  window.applyExtraPersist = function (p) {
    _applyExtraPersist(p);
    if (p && typeof p === 'object' && p.ksets && typeof p.ksets === 'object') {
      KS.list = cleanList(p.ksets.list);
      KS.folders = cleanFolders(p.ksets.folders, KS.list);
      KS.activeId = find(String(p.ksets.activeId || '')) ? String(p.ksets.activeId) : null;
      if (KS.folder !== 'all' && KS.folders.indexOf(KS.folder) < 0) KS.folder = 'all';
      var a = find(KS.activeId);
      if (a) { setCurFrom(a); if (mainMode() === 'perf' && KS.lastAction === 'voice' && !booted) KS.lastAction = 'kset'; }
    }
    if (!find(KS.activeId) || KS.lastAction !== 'kset') initCur();
    booted = true;
    var moved = migrateTiles();
    if (moved) { setTimeout(function () { persist(); note(moved + ' tile Keyboard Set lama dipindah ke tab PERFORMANCE'); }, 0); }
    render();
  };
  window.mrKsetForReg = function () { return (KS.lastAction === 'kset' && !KS.ext && find(KS.activeId)) ? KS.activeId : null; };
  var _sanitizeReg = window.sanitizeReg;
  window.sanitizeReg = function (r) {
    var o = _sanitizeReg(r);
    if (o && r && typeof r.kset === 'string' && r.kset) o.kset = r.kset.slice(0, 40);
    return o;
  };
  var _applyRegData = window.applyRegData;
  window.applyRegData = function (r) {
    _applyRegData(r);
    if (r && r.kset && find(r.kset)) recall(r.kset, { quiet: true });
  };
  // Memilih sound = Upper 1. Di tampilan PERFORMANCE, Performance tetap aktif dan Upper 1-nya berubah (seperti Korg).
  var _selectVoiceTile = window.selectVoiceTile;
  window.selectVoiceTile = function (id) {
    var armed = false; try { armed = layerPickArmed; } catch (e) {}
    var keep = !armed && mainMode() === 'perf' && KS.lastAction === 'kset' && (!!find(KS.activeId) || KS.ext);
    _selectVoiceTile(id);
    if (armed) {
      try { if (layerVoice) KS.cur[2] = upFromTile(layerVoice); if (upper3Channel > 0 && upper3Voice) KS.cur[3] = upFromTile(upper3Voice); } catch (e) {}
      changed(); return;
    }
    var t = tileById(id);
    if (t) KS.cur[1] = upFromTile(t);
    if (keep) { if (t) KS.dirty[1] = 1; }
    else { KS.lastAction = 'voice'; KS.ext = false; KS.dirty = {}; }
    renderActive(); changed();
  };
  window.mrKsetResync = function () {
    if (KS.lastAction !== 'kset' || KS.ext || !find(KS.activeId)) return false;
    recall(KS.activeId, { quiet: true, noResend: true });
    return true;
  };

  /* ---------------------------------------------------------------
     Memanggil Performance
     --------------------------------------------------------------- */
  function buildCtrl(c) {
    var ch = ctrlCh(), list = [];
    if (!c.pcOnly) { list.push([0xB0 | ch, 0, c.msb & 0x7F]); list.push([0xB0 | ch, 32, c.lsb & 0x7F]); }
    list.push([0xC0 | ch, c.pc & 0x7F]);
    return list;
  }
  function ctrlClash() {
    var ch = ctrlCh();
    try { return ch === mainIdx() || targetChannels().indexOf(ch) >= 0; } catch (e) { return false; }
  }
  function clashMsg() { return T('Channel Control (' + styleCtrlChannel + ') bentrok dengan channel Upper. Ubah di Pengaturan.', 'Control channel (' + styleCtrlChannel + ') clashes with an Upper channel. Change it in Settings.'); }
  function sendKsData(k) {
    if (k.type === 'ctrl') {
      if (ctrlClash()) { note(clashMsg()); return false; }
      sendMidiBatch(buildCtrl(k.ctrl));
    } else {
      sendMidiBatch(k.msgs);
    }
    return true;
  }
  function afterRecall(k, opts) {
    if (!k.resend || opts.noResend) return;
    setTimeout(function () {
      try { invalidateSent(); var c = targetChannels(); midiBatch(function () { sendPitchBendRangeRpn(c); sendTranspose(c); }); } catch (e) {}
    }, 400);
  }
  // Upper 1-3 dari rekaman snapshot
  function snapUppers(msgs) {
    var by = {};
    msgs.forEach(function (m) {
      if (m[0] === 0xF0) return;
      var ch = m[0] & 0x0F, h = m[0] & 0xF0, c = by[ch] || (by[ch] = { m: null, l: 0, p: null });
      if (h === 0xB0 && m[1] === 0) c.m = m[2];
      else if (h === 0xB0 && m[1] === 32) c.l = m[2];
      else if (h === 0xC0) c.p = m[1];
    });
    var out = [null, null, null];
    for (var k = 1; k <= 3; k++) { var c = by[chOf(k)]; if (c && c.p !== null) out[k - 1] = upFromNums(c.m === null ? 0 : c.m, c.l, c.p); }
    return out;
  }
  function uppersOf(k) { return !k ? [null, null, null] : k.type === 'ctrl' ? (k.uppers || [null, null, null]) : snapUppers(k.msgs); }
  // Tanpa Performance aktif: Upper 1-3 = sound yang dipilih di aplikasi
  function initCur() {
    try {
      KS.cur = { 1: upFromTile(tileById(activeTileId)), 2: layerVoice ? upFromTile(layerVoice) : null, 3: (upper3Channel > 0 && upper3Voice) ? upFromTile(upper3Voice) : null };
    } catch (e) {}
  }
  function setCurFrom(k) {
    var u = uppersOf(k);
    KS.cur = { 1: copyUp(u[0]), 2: copyUp(u[1]), 3: copyUp(u[2]) };
    KS.dirty = {}; KS.ext = false;
  }
  // Tampilan Voice lama ikut berubah bila Upper 1 cocok dengan tile voice (tanpa mengirim apa pun)
  function syncVoiceDisplay() {
    try {
      var t = upTile(KS.cur[1]);
      if (t && t.id !== activeTileId) { activeTileId = t.id; if (window.renderVoiceTiles) window.renderVoiceTiles(); }
    } catch (e) {}
  }
  function recall(id, opts) {
    opts = opts || {};
    var k = find(id);
    if (!k) return false;
    if (!selectedMidiOutput && !opts.quiet) note(T('Belum ada MIDI Out terhubung', 'No MIDI Out connected'));
    try { releaseAllVk(); } catch (e) {}
    if (!sendKsData(k)) return false;
    KS.activeId = k.id; KS.lastAction = 'kset';
    if (k.pos && !KS.q) { KS.view = k.pos.b; KS.cat = k.pos.c; KS.page = k.pos.pg; saveView(); renderList(); }
    setCurFrom(k);
    afterRecall(k, opts);
    syncVoiceDisplay();
    var d = $('activeVoiceDisplay'); if (d) d.innerText = 'PERF ' + k.name;
    try { haptic(10); } catch (e) {}
    if (!opts.quiet) note('PERFORMANCE: ' + k.name);
    persist();
    renderActive(); changed();
    return true;
  }
  function sendSts(n) {
    if (ctrlClash()) { note(clashMsg()); return; }
    try { releaseAllVk(); } catch (e) {}
    sendMidiBatch([[0xC0 | ctrlCh(), 63 + n]]);
    setTimeout(function () { try { invalidateSent(); var c = targetChannels(); midiBatch(function () { sendPitchBendRangeRpn(c); sendTranspose(c); }); } catch (e) {} }, 400);
    KS.lastAction = 'sts';
    note('STS ' + n + ' (Style aktif) · CH ' + styleCtrlChannel);
    renderActive(); changed();
  }
  // ◀ ▶ mengikuti daftar yang sedang tampil (folder / pencarian)
  function step(d) {
    var a = find(KS.activeId), l = (a && a.pos && !KS.q) ? inCat(a.pos.b, a.pos.c) : visible();
    if (!l.length) l = KS.list;
    if (!l.length) { note(T('Belum ada Performance', 'No Performances yet')); return; }
    var i = -1;
    for (var j = 0; j < l.length; j++) if (l[j].id === KS.activeId) i = j;
    i = i < 0 ? (d > 0 ? 0 : l.length - 1) : (i + d + l.length) % l.length;
    recall(l[i].id);
  }
  // Ganti sound salah satu Upper (Upper 2/3 langsung di channel-nya, tanpa perlu DUAL)
  function setUpper(k, tile) {
    if (!tile) return false;
    if (k === 1) { window.selectVoiceTile(tile.id); return true; }
    var ch = chOf(k);
    if (ch < 0) { note(T('Isi dulu Pengaturan › Upper 3 MIDI Channel', 'Set Settings › Upper 3 MIDI Channel first')); return false; }
    try { if (k === 2) layerVoice = snapVoice(tile); else upper3Voice = snapVoice(tile); } catch (e) {}
    try { sendVoiceTo(tile, ch); } catch (e) {}
    KS.cur[k] = upFromTile(tile);
    if (KS.lastAction === 'kset') KS.dirty[k] = 1;
    try { updateDualUI(); } catch (e) {}
    try { haptic(8); } catch (e) {}
    persist(); changed();
    return true;
  }
  // Simpan sound Upper yang sekarang ke Performance aktif (keterangan di aplikasi)
  function saveUppers() {
    var k = KS.ext ? null : find(KS.activeId);
    if (!k || KS.lastAction !== 'kset') { note(T('Pilih Performance dulu', 'Choose a Performance first')); return false; }
    if (k.type !== 'ctrl') { note(T('Ini SNAPSHOT SOUND. Ubah dulu jadi Performance (EDIT › JADIKAN PERFORMANCE).', 'This is a SOUND SNAPSHOT. Turn it into a Performance first (EDIT › MAKE PERFORMANCE).')); return false; }
    k.uppers = [copyUp(KS.cur[1]), copyUp(KS.cur[2]), copyUp(KS.cur[3])];
    KS.dirty = {};
    persist(); render(); changed();
    note(T('Upper tersimpan di "' + k.name + '". Di keyboard tekan WRITE supaya isinya sama.', 'Uppers saved to "' + k.name + '". Press WRITE on the keyboard so it matches.'));
    return true;
  }

  /* ---------------------------------------------------------------
     MIDI IN: ikuti sound Upper 1-3 yang dikirim keyboard, kenali Performance
     --------------------------------------------------------------- */
  var inBank = {}, extT = null, extHits = {};
  function onTrack(e) {
    var d = e.data; if (!d || d.length < 2) return;
    var st = d[0]; if (st >= 0xF0) return;
    var h = st & 0xF0, ch = st & 0x0F;
    if (h === 0xB0 && (d[1] === 0 || d[1] === 32)) { var b = inBank[ch] || (inBank[ch] = { m: null, l: 0 }); if (d[1] === 0) b.m = d[2]; else b.l = d[2]; return; }
    if (h !== 0xC0) return;
    var k = upperOf(ch); if (!k) return;
    var bb = inBank[ch] || { m: null, l: 0 };
    var m = bb.m === null ? (KS.cur[k] ? KS.cur[k].m : 0) : bb.m;
    KS.cur[k] = upFromNums(m, bb.l || 0, d[1]);
    extHits[k] = 1;
    if (finder && draft && $('ksLearnUp') && $('ksLearnUp').checked) { draft.uppers[k - 1] = copyUp(KS.cur[k]); fillUpperSelects(); flashLearn(k); }
    if (cap) return;
    clearTimeout(extT); extT = setTimeout(extDone, 300);
  }
  function matchPerf() {
    var best = [];
    KS.list.forEach(function (p) {
      if (p.type !== 'ctrl' || !p.uppers) return;
      var hit = 0, bad = 0;
      for (var k = 1; k <= 3; k++) { var u = p.uppers[k - 1], c = KS.cur[k]; if (!u || !c) continue; if (sameUp(u, c)) hit++; else bad++; }
      if (hit >= 2 && !bad) best.push(p);
    });
    if (!best.length) return null;
    for (var i = 0; i < best.length; i++) if (best[i].id === KS.activeId) return best[i];
    return best[0];
  }
  function extDone() {
    var ks = Object.keys(extHits); extHits = {};
    if (ks.length >= 2) {                         // tombol Performance ditekan di panel keyboard
      var p = matchPerf();
      KS.dirty = {};
      if (p) { KS.activeId = p.id; KS.ext = false; }
      else KS.ext = true;
      KS.lastAction = 'kset';
    } else if (KS.lastAction === 'kset') ks.forEach(function (k) { KS.dirty[k] = 1; });
    syncVoiceDisplay();
    renderActive(); changed();
  }
  if (typeof window.onMidiInput === 'function') window.onMidiInput(onTrack);

  function changed() {
    hooks.forEach(function (f) { try { f(); } catch (e) {} });
  }

  /* ---------------------------------------------------------------
     Ringkasan rekaman snapshot
     --------------------------------------------------------------- */
  function chLabel(ch) {
    try {
      if (ch === mainIdx()) return 'Upper 1';
      if (ch === layerIdx()) return 'Upper 2';
      if (upper3Channel > 0 && ch === upper3Idx()) return 'Upper 3';
      if (ch === ctrlCh()) return 'Control';
    } catch (e) {}
    return '';
  }
  function summarize(msgs) {
    var by = {}, order = [], sys = 0;
    msgs.forEach(function (m) {
      if (m[0] === 0xF0) { sys++; return; }
      var ch = m[0] & 0x0F, h = m[0] & 0xF0;
      var c = by[ch];
      if (!c) { c = by[ch] = { msb: null, lsb: null, pc: null, cc: {}, n: 0 }; order.push(ch); }
      c.n++;
      if (h === 0xB0) { if (m[1] === 0) c.msb = m[2]; else if (m[1] === 32) c.lsb = m[2]; else c.cc[m[1]] = m[2]; }
      else if (h === 0xC0) c.pc = m[1];
    });
    var lines = order.sort(function (a, b) { return a - b; }).map(function (ch) {
      var c = by[ch], parts = [], lb = chLabel(ch);
      if (c.pc !== null) {
        var t = tileByNums(c.msb, c.lsb || 0, c.pc);
        parts.push('Sound ' + (c.msb === null ? '-' : c.msb) + '.' + (c.lsb === null ? '-' : c.lsb) + '.' + c.pc + (t ? ' (' + t.name + ')' : ''));
      }
      var extra = 0;
      Object.keys(c.cc).forEach(function (k) { if (CC_NAMES[k]) parts.push(CC_NAMES[k] + ' ' + c.cc[k]); else extra++; });
      if (extra) parts.push('+' + extra + ' CC');
      return '<b>CH ' + (ch + 1) + (lb ? ' · ' + lb : '') + '</b> ' + esc(parts.join(' · ') || (c.n + ' pesan'));
    });
    if (sys) lines.push('<b>SysEx</b> ' + sys + ' pesan');
    return { lines: lines, chans: order, sys: sys };
  }
  function badge(k) {
    if (k.type === 'ctrl') {
      if (k.ctrl.pcOnly) return (k.ctrl.pc >= 64 && k.ctrl.pc <= 67 ? 'STS ' + (k.ctrl.pc - 63) : 'PC ' + k.ctrl.pc) + ' · CH' + styleCtrlChannel;
      return 'CH' + styleCtrlChannel + ' · ' + k.ctrl.msb + '.' + k.ctrl.lsb + '.' + k.ctrl.pc;
    }
    return T('SNAPSHOT SOUND', 'SOUND SNAPSHOT');
  }

  /* ---------------------------------------------------------------
     Panel PERFORMANCE seperti "Keyboard Set Library" Pa600:
     Factory / User / Direct · kategori kiri-kanan · 8 tombol (2 kolom) · halaman P1-P6
     --------------------------------------------------------------- */
  function bankLbl(b) { for (var i = 0; i < BANKS_K.length; i++) if (BANKS_K[i][0] === b) return BANKS_K[i][1]; return ''; }
  function posLabel(p) { return p ? bankLbl(p.b) + ' · ' + CATS_K[p.c] + ' · P' + p.pg + '-' + p.s : ''; }
  function samePos(a, b) { return !!(a && b && a.b === b.b && a.c === b.c && a.pg === b.pg && a.s === b.s); }
  function atPos(pos, exceptId) { for (var i = 0; i < KS.list.length; i++) { var k = KS.list[i]; if (k.id !== exceptId && samePos(k.pos, pos)) return k; } return null; }
  function sortPos(a, b) { return (a.pos.pg - b.pos.pg) || (a.pos.s - b.pos.s); }
  function inCat(b, c) { return KS.list.filter(function (k) { return k.pos && k.pos.b === b && k.pos.c === c; }).sort(sortPos); }
  function saveView() { lss('mrKsView', JSON.stringify({ v: KS.view, c: KS.cat, p: KS.page })); }
  function loadView() {
    try { var o = JSON.parse(lsg('mrKsView') || '{}'); if (['factory', 'user', 'direct', 'other'].indexOf(o.v) >= 0) KS.view = o.v; if (o.c >= 0 && o.c < CATS_K.length) KS.cat = o.c | 0; if (o.p >= 1 && o.p <= PAGES) KS.page = o.p | 0; } catch (e) {}
  }
  function visible() {
    var q = KS.q.toLowerCase();
    if (q) return KS.list.filter(function (k) { return (k.name + ' ' + k.folder + ' ' + posLabel(k.pos) + ' ' + uppersOf(k).map(upName).join(' ')).toLowerCase().indexOf(q) >= 0; });
    if (KS.view === 'other') return KS.list.filter(function (k) { return !k.pos; });
    return inCat(KS.view, KS.cat);
  }
  function flat() { return !!KS.q || KS.view === 'other'; }
  function build() {
    var p = $('panelKset');
    if (!p || p.dataset.built) return;
    p.dataset.built = '1';
    KS.cols = Math.max(1, Math.min(5, parseInt(lsg('mrKsCols'), 10) || 3));
    loadView();
    p.innerHTML =
      '<div class="glass-card ks-card ks-lib">' +
        '<div class="ks-head">' +
          '<div class="ks-title"><span class="ks-t1">KEYBOARD SET LIBRARY</span><small id="ksActive">-</small></div>' +
          '<div class="ks-acts">' +
            '<label class="ks-search"><span aria-hidden="true">&#128269;</span><input type="search" id="ksSearch" autocomplete="off" placeholder="' + T('Cari...', 'Search...') + '"></label>' +
            '<button type="button" class="ks-btn pri" data-ks="find">＋ <span>' + T('CARI NOMOR', 'FIND NUMBER') + '</span></button>' +
            '<button type="button" class="ks-btn" data-ks="edit" id="ksEditBtn">EDIT: OFF</button>' +
            '<button type="button" class="ks-btn" data-ks="help" aria-label="Bantuan">?</button>' +
          '</div>' +
        '</div>' +
        '<div class="ks-banks" id="ksBanks"></div>' +
        '<div class="ks-lib-body">' +
          '<div class="ks-cats" id="ksCatsL"></div>' +
          '<div class="ks-grid" id="ksGrid"></div>' +
          '<div class="ks-cats" id="ksCatsR"></div>' +
        '</div>' +
        '<div class="ks-pages" id="ksPages"></div>' +
      '</div>';
    p.addEventListener('click', onPanelClick);
    $('ksSearch').addEventListener('input', function () { KS.q = this.value.trim(); renderList(); });
    // tile: ketuk = panggil (jari bergeser = menggulir, tidak memanggil)
    var grid = $('ksGrid'), down = null;
    grid.addEventListener('pointerdown', function (e) { var t = e.target.closest('[data-kid],[data-slot]'); down = t ? { id: e.pointerId, x: e.clientX, y: e.clientY, kid: t.dataset.kid, slot: t.dataset.slot } : null; });
    grid.addEventListener('pointerup', function (e) {
      if (!down || down.id !== e.pointerId) return;
      var moved = Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y), d = down;
      down = null;
      if (moved > 12) return;
      if (d.slot) openFinder(null, { pos: { b: KS.view, c: KS.cat, pg: KS.page, s: parseInt(d.slot, 10) } });
      else if (KS.edit) openEditor(d.kid); else recall(d.kid);
    });
    grid.addEventListener('pointercancel', function () { down = null; });
  }
  function onPanelClick(e) {
    var s = e.target.closest('[data-sts]');
    if (s) { sendSts(parseInt(s.dataset.sts, 10)); return; }
    var bk = e.target.closest('[data-kbank]');
    if (bk) { KS.view = bk.dataset.kbank; clearQ(); saveView(); renderList(); return; }
    var ct = e.target.closest('[data-kcat]');
    if (ct) { KS.cat = parseInt(ct.dataset.kcat, 10); KS.page = 1; clearQ(); saveView(); renderList(); return; }
    var pg = e.target.closest('[data-kpage]');
    if (pg) { KS.page = parseInt(pg.dataset.kpage, 10); saveView(); renderList(); return; }
    var b = e.target.closest('[data-ks]');
    if (!b) return;
    var a = b.dataset.ks;
    if (a === 'find' || a === 'empty-find') openFinder(null, KS.view !== 'other' && !KS.q ? { pos: { b: KS.view, c: KS.cat, pg: KS.page, s: firstFree() } } : null);
    else if (a === 'learn') learnOpen(null);
    else if (a === 'edit') { KS.edit = !KS.edit; render(); }
    else if (a === 'cols') { KS.cols = KS.cols % 5 + 1; lss('mrKsCols', String(KS.cols)); render(); }
    else if (a === 'prev') step(-1);
    else if (a === 'next') step(1);
    else if (a === 'help') { if (window.openGuide) window.openGuide('kset'); }
  }
  function clearQ() { KS.q = ''; var sx = $('ksSearch'); if (sx) sx.value = ''; }
  function firstFree() { for (var s = 1; s <= SLOTS; s++) if (!atPos({ b: KS.view, c: KS.cat, pg: KS.page, s: s })) return s; return 1; }
  function folderNew(cb) {
    if (KS.folders.length >= MAX_FOLDERS) { note(T('Maksimal ' + MAX_FOLDERS + ' folder', 'Max ' + MAX_FOLDERS + ' folders')); return; }
    mrInput(T('Nama folder baru', 'New folder name'), '', function (n) {
      n = cleanFolder(n);
      if (!n) return;
      if (KS.folders.indexOf(n) < 0) KS.folders.push(n);
      if (cb) cb(n); else { persist(); render(); }
    });
  }
  function render() {
    build();
    if (!$('ksGrid')) return;
    var eb = $('ksEditBtn'); if (eb) { eb.textContent = 'EDIT: ' + (KS.edit ? 'ON' : 'OFF'); eb.classList.toggle('on', KS.edit); }
    renderList();
  }
  function renderNav() {
    var other = KS.list.filter(function (k) { return !k.pos; }).length;
    var bh = BANKS_K.map(function (b) { return '<button type="button" data-kbank="' + b[0] + '" class="ks-bank' + (KS.view === b[0] && !KS.q ? ' on' : '') + '">' + b[1] + '</button>'; }).join('') +
      '<button type="button" data-kbank="other" class="ks-bank ks-oth' + (KS.view === 'other' && !KS.q ? ' on' : '') + '">' + T('LAINNYA', 'OTHERS') + (other ? ' <small>' + other + '</small>' : '') + '</button>' +
      '<span class="ks-sp"></span>' +
      '<button type="button" class="ks-nav" data-ks="prev" aria-label="Prev">◀</button><button type="button" class="ks-nav" data-ks="next" aria-label="Next">▶</button>' +
      '<span class="ks-lbl">STS</span>' + [1, 2, 3, 4].map(function (n) { return '<button type="button" class="ks-sts" data-sts="' + n + '">' + n + '</button>'; }).join('');
    $('ksBanks').innerHTML = bh;
    var catBtn = function (i) {
      var n = KS.view === 'other' ? 0 : inCat(KS.view, i).length;
      return '<button type="button" data-kcat="' + i + '" class="ks-cat' + (KS.cat === i ? ' on' : '') + '">' + esc(CATS_K[i]) + (n ? '<i>' + n + '</i>' : '') + '</button>';
    };
    var L = '', R = '';
    for (var i = 0; i < CATS_K.length; i++) { if (i < CATS_L) L += catBtn(i); else R += catBtn(i); }
    $('ksCatsL').innerHTML = L; $('ksCatsR').innerHTML = R;
    var used = {};
    if (KS.view !== 'other') inCat(KS.view, KS.cat).forEach(function (k) { used[k.pos.pg] = 1; });
    var ph = '';
    for (var p = 1; p <= PAGES; p++) ph += '<button type="button" data-kpage="' + p + '" class="ks-page' + (KS.page === p ? ' on' : '') + (used[p] ? ' has' : '') + '">P' + p + '</button>';
    $('ksPages').innerHTML = ph;
  }
  function tileHtml(k, showPos, sn) {
    var u = uppersOf(k), ups = '';
    for (var j = 0; j < 3; j++) if (u[j]) ups += '<span><i>' + (j + 1) + '</i>' + esc(upName(u[j])) + '</span>';
    return '<button type="button" class="ks-tile c-' + k.color + (k.type === 'snap' ? ' snap' : '') + (k.id === KS.activeId && KS.lastAction === 'kset' && !KS.ext ? ' on' : '') + (KS.edit ? ' editing' : '') + '" data-kid="' + esc(k.id) + '">' +
      (sn ? '<span class="ks-sn">' + sn + '</span>' : '') + (showPos ? '<span class="ks-no">' + esc(k.pos ? posLabel(k.pos) : (k.folder || T('tanpa posisi', 'no position'))) + '</span>' : '') + (KS.edit ? '<span class="ks-ed">✎</span>' : '') +
      '<span class="ks-nm">' + esc(k.name) + '</span>' + (ups ? '<span class="ks-ups">' + ups + '</span>' : '') + '<span class="ks-bd">' + esc(badge(k)) + '</span></button>';
  }
  function renderList() {
    var card = document.querySelector('#panelKset .ks-lib'); if (!card) return;
    renderNav();
    var g = $('ksGrid'); if (!g) return;
    var fl = flat();
    card.classList.toggle('ks-flat', fl);
    g.classList.toggle('ks-slots', !fl);
    if (fl) {
      g.style.setProperty('--ksc', KS.cols);
      var l = visible();
      g.innerHTML = l.length ? l.map(function (k) { return tileHtml(k, true); }).join('') : '<div class="ks-empty"><b>' + (KS.q ? T('Tidak ditemukan', 'Nothing found') : T('Tidak ada Performance tanpa posisi', 'No Performances without a position')) + '</b></div>';
      renderActive();
      return;
    }
    var h = '', pred = null;
    for (var s = 1; s <= SLOTS; s++) {
      var pos = { b: KS.view, c: KS.cat, pg: KS.page, s: s }, k = atPos(pos);
      if (k) h += tileHtml(k, false, s);
      else {
        pred = predict(pos);
        h += '<button type="button" class="ks-slot" data-slot="' + s + '"><span class="ks-sn">' + s + '</span><b>＋</b><small>' + (pred && !pred.bad ? (pred.sure ? '' : '~') + pred.m + '.' + pred.l + '.' + pred.p : (T('kosong', 'empty'))) + '</small></button>';
      }
    }
    g.innerHTML = h;
    renderActive();
  }
  function renderActive() {
    var a = $('ksActive'), k = KS.ext ? null : find(KS.activeId);
    if (a) a.textContent = (KS.lastAction === 'kset' && k) ? (T('AKTIF: ', 'ACTIVE: ') + k.name + (Object.keys(KS.dirty).length ? ' *' : '')) : KS.ext ? T('Performance dari panel keyboard (belum disimpan)', 'Performance from the keyboard panel (not saved)') : (KS.lastAction === 'sts' ? T('STS dari Style aktif', 'STS of current Style') : T('Ketuk untuk memanggil · CH Control ' + styleCtrlChannel, 'Tap to recall · Control CH ' + styleCtrlChannel));
    document.querySelectorAll('#ksGrid .ks-tile').forEach(function (t) { t.classList.toggle('on', KS.lastAction === 'kset' && !KS.ext && t.dataset.kid === KS.activeId); });
    var tp = document.querySelector('#paRoot .pa-tabs [data-go="kset"]');
    if (tp) tp.classList.toggle('dotOn', KS.lastAction === 'kset' && !!k);
  }

  /* ---------------------------------------------------------------
     Menebak nomor dari posisi (dipelajari dari Performance yang sudah disimpan)
     Pola seperti Style Pa600: CC00 tetap per bank, CC32 per kategori, PC = urutan di kategori.
     --------------------------------------------------------------- */
  function posN(p) { return (p.pg - 1) * SLOTS + (p.s - 1); }
  function predict(pos, exceptId) {
    if (!pos) return null;
    var S = KS.list.filter(function (k) { return k.type === 'ctrl' && k.pos && k.pos.b === pos.b && !k.ctrl.pcOnly && k.id !== exceptId; });
    if (!S.length) return null;
    var n = posN(pos), m, l, p0, sure = false;
    var same = S.filter(function (k) { return k.pos.c === pos.c; });
    if (same.length) { var r = same[same.length - 1]; m = r.ctrl.msb; l = r.ctrl.lsb; p0 = r.ctrl.pc - posN(r.pos); sure = true; }
    else {
      var ord = S.map(function (k, i) { return { k: k, i: i }; }).sort(function (x, y) { return (Math.abs(x.k.pos.c - pos.c) - Math.abs(y.k.pos.c - pos.c)) || (y.i - x.i); });
      var r1 = ord[0].k, r2 = null;
      m = r1.ctrl.msb;
      for (var i = 1; i < ord.length; i++) if (ord[i].k.pos.c !== r1.pos.c) { r2 = ord[i].k; break; }
      var b1 = r1.ctrl.pc - posN(r1.pos);
      if (r2) {
        var dc = r2.pos.c - r1.pos.c, b2 = r2.ctrl.pc - posN(r2.pos);
        if (r2.ctrl.lsb !== r1.ctrl.lsb) { var st = (r2.ctrl.lsb - r1.ctrl.lsb) / dc; if (st !== Math.round(st)) st = 1; l = r1.ctrl.lsb + st * (pos.c - r1.pos.c); p0 = b1; }
        else if (r2.ctrl.msb !== r1.ctrl.msb) { var sm = (r2.ctrl.msb - r1.ctrl.msb) / dc; if (sm !== Math.round(sm)) sm = 1; m = r1.ctrl.msb + sm * (pos.c - r1.pos.c); l = r1.ctrl.lsb; p0 = b1; }
        else { var ps = (b2 - b1) / dc; if (ps !== Math.round(ps)) ps = 0; l = r1.ctrl.lsb; p0 = b1 + ps * (pos.c - r1.pos.c); }
      } else { l = r1.ctrl.lsb + (pos.c - r1.pos.c); p0 = b1; }
    }
    var p = p0 + n;
    if (m < 0 || m > 127 || l < 0 || l > 127 || p < 0 || p > 127) return { bad: true };
    return { m: m, l: l, p: p, sure: sure, from: S.length };
  }

  /* ---------------------------------------------------------------
     Modal
     --------------------------------------------------------------- */
  function modal() {
    var m = $('ksModal');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'ksModal'; m.className = 'ks-modal ks-hide';
    m.innerHTML = '<div class="ks-mcard"><div class="ks-mhead"><b id="ksMTitle"></b><button type="button" class="ks-x" data-m="close" aria-label="Tutup">✕</button></div><div class="ks-mbody" id="ksMBody"></div><div class="ks-mfoot" id="ksMFoot"></div></div>';
    m.addEventListener('click', onModalClick);
    m.addEventListener('input', onModalInput);
    m.addEventListener('change', onModalInput);
    document.body.appendChild(m);
    return m;
  }
  function showModal(title, wide) { var m = modal(); $('ksMTitle').textContent = title; m.classList.toggle('ks-wide', !!wide); m.classList.remove('ks-hide'); }
  function closeModal() {
    learnStop();
    finder = false;
    var m = $('ksModal'); if (m) m.classList.add('ks-hide');
    editId = null; draft = null;
  }
  function setFoot(html) { $('ksMFoot').innerHTML = html; }

  // ---------- CARI NOMOR (Performance lewat channel Control) ----------
  function numRow(key, label) {
    return '<div class="ks-num"><span>' + label + '</span><button type="button" data-step="' + key + ':-10">−10</button><button type="button" data-step="' + key + ':-1" class="big">◀</button><input type="number" inputmode="numeric" min="0" max="127" id="ksN_' + key + '" value="' + draft.ctrl[key] + '"><button type="button" data-step="' + key + ':1" class="big">▶</button><button type="button" data-step="' + key + ':10">+10</button></div>';
  }
  function bankName(b) { return { factory: 'FACTORY', legacy: 'LEGACY', gm: 'GM', user: 'USER' }[b] || 'FACTORY'; }
  function upperOptions(u) {
    var t = upTile(u), groups = { factory: [], legacy: [], gm: [], user: [] };
    tiles().forEach(function (x) { var b = groups[x.bank] ? x.bank : 'factory'; groups[b].push(x); });
    var h = '<option value="">— ' + T('kosong', 'empty') + ' —</option>';
    if (u && !t) h += '<option value="raw" selected>' + esc(upName(u)) + '</option>';
    ['factory', 'legacy', 'gm', 'user'].forEach(function (b) {
      if (!groups[b].length) return;
      h += '<optgroup label="' + bankName(b) + '">' + groups[b].map(function (x) { return '<option value="' + esc(x.id) + '"' + (t && String(t.id) === String(x.id) ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</optgroup>';
    });
    return h;
  }
  function fillUpperSelects() {
    for (var k = 1; k <= 3; k++) { var s = $('ksU' + k); if (s) s.innerHTML = upperOptions(draft.uppers[k - 1]); }
  }
  function flashLearn(k) {
    var r = document.querySelector('#ksModal .ks-up[data-k="' + k + '"]'); if (!r) return;
    r.classList.remove('hit'); void r.offsetWidth; r.classList.add('hit');
    var w = $('ksLearnSt'); if (w) w.textContent = T('Upper ' + k + ' diterima dari keyboard', 'Upper ' + k + ' received from the keyboard');
  }
  function folderSel(cur) {
    return '<select id="ksFold" class="ks-sel"><option value="">' + T('(tanpa folder)', '(no folder)') + '</option>' +
      KS.folders.map(function (f) { return '<option value="' + esc(f) + '"' + (f === cur ? ' selected' : '') + '>' + esc(f) + '</option>'; }).join('') +
      '<option value="__new">＋ ' + T('folder baru…', 'new folder…') + '</option></select>';
  }
  function nextName() { return 'PERFORMANCE ' + (KS.list.length + 1); }
  function openFinder(id, preset) {
    learnStop();
    var k = id ? find(id) : null;
    editId = k ? k.id : null;
    if (k && k.type === 'ctrl') draft = JSON.parse(JSON.stringify(k));
    else {
      var last = KS.list.filter(function (x) { return x.type === 'ctrl'; }).slice(-1)[0];
      draft = { id: null, name: nextName(), type: 'ctrl', color: 'amber', resend: true, folder: KS.folder !== 'all' ? KS.folder : '',
        ctrl: last ? { msb: last.ctrl.msb, lsb: last.ctrl.lsb, pc: Math.min(127, last.ctrl.pc + 1), pcOnly: last.ctrl.pcOnly } : { msb: 0, lsb: 0, pc: 0, pcOnly: false },
        uppers: [null, null, null] };
      draft.pos = null;
      if (preset) { if (preset.name) draft.name = preset.name; if (preset.uppers) draft.uppers = preset.uppers.map(copyUp); if (preset.folder != null) draft.folder = preset.folder; if (preset.color) draft.color = preset.color; if (preset.pos) draft.pos = cleanPos(preset.pos); }
      if (draft.pos) { draft.name = preset && preset.name ? preset.name : ''; var pr = predict(draft.pos); if (pr && !pr.bad) draft.ctrl = { msb: pr.m, lsb: pr.l, pc: pr.p, pcOnly: false }; }
    }
    if (draft.pos === undefined) draft.pos = null;
    finder = true;
    showModal(k ? T('EDIT PERFORMANCE', 'EDIT PERFORMANCE') : T('CARI NOMOR PERFORMANCE', 'FIND PERFORMANCE NUMBER'), true);
    var live = lsg('mrKsLive') !== '0';
    $('ksMBody').innerHTML =
      '<div class="ks-fz">' +
        '<div class="ks-fcol">' +
          posBox() +
          '<p class="ks-p">' + T('Setiap tekan ◀ ▶ langsung dikirim ke keyboard di <b>channel Control CH ' + styleCtrlChannel + '</b>. Lihat layar keyboard sampai Keyboard Set yang dicari muncul, lalu SIMPAN.', 'Every ◀ ▶ press is sent to the keyboard on the <b>Control channel CH ' + styleCtrlChannel + '</b>. Watch the keyboard screen until the Keyboard Set you want appears, then SAVE.') + '</p>' +
          numRow('msb', 'CC00 · Bank MSB') + numRow('lsb', 'CC32 · Bank LSB') + numRow('pc', 'PC · Program') +
          '<div class="ks-quick"><label class="ks-chk"><input type="checkbox" id="ksLive"' + (live ? ' checked' : '') + '> ' + T('Kirim langsung', 'Send instantly') + '</label>' +
          '<label class="ks-chk"><input type="checkbox" id="ksPcOnly"' + (draft.ctrl.pcOnly ? ' checked' : '') + '> ' + T('Hanya PC', 'PC only') + '</label>' +
          '<button type="button" data-m="try">↻ ' + T('KIRIM', 'SEND') + '</button></div>' +
          '<div class="ks-quick"><span>STS:</span>' + [1, 2, 3, 4].map(function (n) { return '<button type="button" data-qsts="' + n + '">' + n + '</button>'; }).join('') + '</div>' +
        '</div>' +
        '<div class="ks-fcol">' +
          '<label class="ks-f"><span>' + T('Nama', 'Name') + '</span><input type="text" id="ksName" maxlength="40" value="' + esc(draft.name) + '" placeholder="' + T('nama di layar keyboard', 'name on the keyboard screen') + '"></label>' +
          '<div class="ks-f" id="ksFoldRow"><span>Folder</span>' + folderSel(draft.folder) + '</div>' +
          '<div class="ks-ups-ed">' +
            '<div class="ks-uh"><label class="ks-chk"><input type="checkbox" id="ksLearnUp" checked> <b>LEARN UPPER</b></label><small id="ksLearnSt">' + T('Tekan tombol Performance yang sama di panel keyboard: Upper 1/2/3 terisi sendiri.', 'Press the same Performance button on the keyboard panel: Upper 1/2/3 fill in by themselves.') + '</small></div>' +
            [1, 2, 3].map(function (n) { return '<div class="ks-up" data-k="' + n + '"><em>UP' + n + '</em><select id="ksU' + n + '" class="ks-sel"></select><small>' + (chNo(n) ? 'CH ' + chNo(n) : 'OFF') + '</small></div>'; }).join('') +
            '<button type="button" class="ks-take" data-m="take">⇩ ' + T('AMBIL DARI KEYBOARD SEKARANG', 'TAKE FROM KEYBOARD NOW') + '</button>' +
          '</div>' +
          colorRow() +
          '<label class="ks-chk"><input type="checkbox" id="ksResend"' + (draft.resend ? ' checked' : '') + '> ' + T('Setelah dipanggil, kirim ulang bend range & transpose aplikasi', 'After recall, resend the app\'s bend range & transpose') + '</label>' +
          (k ? '<div class="ks-quick"><span>' + T('Urutan:', 'Order:') + '</span><button type="button" data-m="up">◀ ' + T('Geser', 'Move') + '</button><button type="button" data-m="down">' + T('Geser', 'Move') + ' ▶</button><button type="button" data-m="dup">' + T('Duplikat', 'Duplicate') + '</button></div>' : '<button type="button" class="ks-link" data-m="snaplearn">' + T('Rekam SNAPSHOT SOUND (cara lama: hanya isi sound, bukan Performance)', 'Record a SOUND SNAPSHOT (old way: only the sounds, not the Performance)') + '</button>') +
        '</div>' +
      '</div>';
    fillUpperSelects();
    posStatus();
    setFoot((k ? '<button type="button" class="ks-btn bad" data-m="del">' + T('HAPUS', 'DELETE') + '</button>' : '') + '<span class="ks-sp"></span><button type="button" class="ks-btn" data-m="close">' + T('BATAL', 'CANCEL') + '</button>' +
      (k ? '' : '<button type="button" class="ks-btn" data-m="savenext">' + T('SIMPAN & LANJUT ▶', 'SAVE & NEXT ▶') + '</button>') + '<button type="button" class="ks-btn pri" data-m="save">' + T('SIMPAN', 'SAVE') + '</button>');
    try { attachMidiInputs(); } catch (e) {}
    if (!k && live) liveSend(true);
  }
  // ---------- posisi di Keyboard Set Library ----------
  function posBox() {
    var p = draft.pos || { b: '', c: KS.cat, pg: KS.page, s: 1 }, o = function (v, t, on) { return '<option value="' + v + '"' + (on ? ' selected' : '') + '>' + t + '</option>'; };
    var h = '<div class="ks-posbox"><div class="ks-ph"><b>' + T('POSISI DI KEYBOARD', 'POSITION ON THE KEYBOARD') + '</b><small>Keyboard Set Library</small></div><div class="ks-posrow">';
    h += '<select id="ksPB" class="ks-sel">' + o('', T('— tanpa posisi', '— no position'), !draft.pos) + BANKS_K.map(function (b) { return o(b[0], b[1], draft.pos && p.b === b[0]); }).join('') + '</select>';
    h += '<select id="ksPC" class="ks-sel">' + CATS_K.map(function (c, i) { return o(i, c, p.c === i); }).join('') + '</select>';
    var pg = ''; for (var i = 1; i <= PAGES; i++) pg += o(i, 'P' + i, p.pg === i);
    var sl = ''; for (var j = 1; j <= SLOTS; j++) sl += o(j, 'No. ' + j, p.s === j);
    h += '<select id="ksPP" class="ks-sel">' + pg + '</select><select id="ksPS" class="ks-sel">' + sl + '</select></div>';
    h += '<small id="ksPredSt" class="ks-pst"></small></div>';
    return h;
  }
  function readPos() {
    var b = $('ksPB'); if (!b || !draft) return;
    draft.pos = b.value ? cleanPos({ b: b.value, c: $('ksPC').value, pg: $('ksPP').value, s: $('ksPS').value }) : null;
    ['ksPC', 'ksPP', 'ksPS'].forEach(function (id) { $(id).disabled = !b.value; });
  }
  function posStatus(pr) {
    var st = $('ksPredSt'); if (!st || !draft) return;
    var fr = $('ksFoldRow'); if (fr) fr.style.display = draft.pos ? 'none' : '';
    ['ksPC', 'ksPP', 'ksPS'].forEach(function (id) { var x = $(id); if (x) x.disabled = !draft.pos; });
    if (!draft.pos) { st.className = 'ks-pst'; st.textContent = T('Tanpa posisi: cari nomor manual dengan ◀ ▶.', 'No position: find the number by hand with ◀ ▶.'); return; }
    if (pr === undefined) pr = predict(draft.pos, editId);
    var other = atPos(draft.pos, editId);
    var warn = other ? T(' Posisi ini sudah dipakai "' + other.name + '".', ' This position is already used by "' + other.name + '".') : '';
    if (!pr) { st.className = 'ks-pst new'; st.textContent = T('Belum ada contoh di bank ' + bankLbl(draft.pos.b) + '. Cari nomornya dengan ◀ ▶ sampai keyboard menampilkan posisi ini, lalu SIMPAN. Posisi lain di bank ini akan dihitung otomatis.', 'No example in the ' + bankLbl(draft.pos.b) + ' bank yet. Find the number with ◀ ▶ until the keyboard shows this position, then SAVE. Other positions in this bank will then be calculated.') + warn; return; }
    if (pr.bad) { st.className = 'ks-pst bad'; st.textContent = T('Hitungan di luar 0-127: cari manual dengan ◀ ▶.', 'Calculation is outside 0-127: find it by hand with ◀ ▶.') + warn; return; }
    st.className = 'ks-pst ' + (pr.sure ? 'ok' : 'guess');
    st.textContent = (pr.sure ? T('Dihitung dari contoh di kategori ini: ', 'Calculated from an example in this category: ') : T('TEBAKAN dari ' + pr.from + ' contoh di bank ini: ', 'GUESS from ' + pr.from + ' example(s) in this bank: ')) + pr.m + '.' + pr.l + '.' + pr.p + T('. Cek layar keyboard; bila salah, betulkan dengan ◀ ▶ lalu SIMPAN (tebakan berikutnya ikut membaik).', '. Check the keyboard screen; if wrong, fix it with ◀ ▶ and SAVE (later guesses improve).') + warn;
  }
  function applyPred() {
    readPos();
    var pr = draft.pos ? predict(draft.pos, editId) : null;
    if (pr && !pr.bad) {
      draft.ctrl = { msb: pr.m, lsb: pr.l, pc: pr.p, pcOnly: false };
      ['msb', 'lsb', 'pc'].forEach(function (k) { var x = $('ksN_' + k); if (x) x.value = draft.ctrl[k]; });
      var po = $('ksPcOnly'); if (po) po.checked = false;
      liveSend();
    }
    posStatus(pr);
  }
  function nextPos(p) {
    if (!p) return null;
    var s = p.s + 1, pg = p.pg;
    if (s > SLOTS) { s = 1; pg++; }
    if (pg > PAGES) return null;
    return { b: p.b, c: p.c, pg: pg, s: s };
  }
  // ---------- editor snapshot lama ----------
  function openEditor(id) {
    var k = find(id); if (!k) return;
    if (k.type === 'ctrl') { openFinder(id); return; }
    learnStop(); finder = false;
    editId = k.id; draft = JSON.parse(JSON.stringify(k));
    showModal(T('SNAPSHOT SOUND', 'SOUND SNAPSHOT'));
    var s = summarize(draft.msgs);
    $('ksMBody').innerHTML =
      '<div class="ks-warn">' + T('Ini rekaman <b>isi sound</b> (cara lama). Saat diketuk, yang berganti hanya sound Upper, <b>bukan Performance</b>-nya. Tekan <b>JADIKAN PERFORMANCE</b> untuk mencari nomor Performance aslinya.', 'This is a recording of the <b>sounds</b> (old way). Tapping it changes only the Upper sounds, <b>not the Performance</b>. Press <b>MAKE PERFORMANCE</b> to find the real Performance number.') + '</div>' +
      '<label class="ks-f"><span>' + T('Nama', 'Name') + '</span><input type="text" id="ksName" maxlength="40" value="' + esc(draft.name) + '"></label>' +
      '<div class="ks-f"><span>Folder</span>' + folderSel(draft.folder) + '</div>' + colorRow() +
      '<div class="ks-sum">' + s.lines.map(function (l) { return '<div>' + l + '</div>'; }).join('') + '</div>' +
      '<label class="ks-chk"><input type="checkbox" id="ksResend"' + (draft.resend ? ' checked' : '') + '> ' + T('Setelah dipanggil, kirim ulang bend range & transpose aplikasi', 'After recall, resend the app\'s bend range & transpose') + '</label>' +
      '<div class="ks-quick"><span>' + T('Urutan:', 'Order:') + '</span><button type="button" data-m="up">◀ ' + T('Geser', 'Move') + '</button><button type="button" data-m="down">' + T('Geser', 'Move') + ' ▶</button><button type="button" data-m="dup">' + T('Duplikat', 'Duplicate') + '</button><button type="button" data-m="relearn">' + T('Rekam ulang', 'Re-record') + '</button></div>';
    setFoot('<button type="button" class="ks-btn bad" data-m="del">' + T('HAPUS', 'DELETE') + '</button><span class="ks-sp"></span><button type="button" class="ks-btn" data-m="close">' + T('BATAL', 'CANCEL') + '</button><button type="button" class="ks-btn" data-m="toperf">' + T('JADIKAN PERFORMANCE', 'MAKE PERFORMANCE') + '</button><button type="button" class="ks-btn pri" data-m="save">' + T('SIMPAN', 'SAVE') + '</button>');
  }
  function colorRow() {
    return '<div class="ks-f"><span>' + T('Warna', 'Color') + '</span><div class="ks-colors">' + COLORS.map(function (c) { return '<button type="button" class="ks-col c-' + c + (draft.color === c ? ' on' : '') + '" data-col="' + c + '" aria-label="' + c + '"></button>'; }).join('') + '</div></div>';
  }
  function readForm() {
    if (!draft) return;
    var n = $('ksName'); if (n) draft.name = n.value.trim().slice(0, 40);
    var r = $('ksResend'); if (r) draft.resend = r.checked;
    var f = $('ksFold'); if (f && f.value !== '__new') draft.folder = f.value;
    if (draft.type === 'ctrl') {
      ['msb', 'lsb', 'pc'].forEach(function (k) { var i = $('ksN_' + k); if (i) draft.ctrl[k] = m7(i.value); });
      var po = $('ksPcOnly'); if (po) draft.ctrl.pcOnly = po.checked;
    }
  }
  function liveSend(force) {
    var l = $('ksLive');
    if (!draft || draft.type !== 'ctrl') return;
    if (!force && (!l || !l.checked)) return;
    if (ctrlClash()) { note(clashMsg()); return; }
    sendMidiBatch(buildCtrl(draft.ctrl));
    KS.ext = false;
  }
  function onModalInput(e) {
    if (!draft) return;
    var id = e.target && e.target.id;
    if (/^ksN_|ksPcOnly/.test(id)) { readForm(); if (e.type === 'change') liveSend(); }
    else if (/^ksP[BCPS]$/.test(id) && e.type === 'change') { readForm(); applyPred(); }
    else if (id === 'ksLive') lss('mrKsLive', e.target.checked ? '1' : '0');
    else if (/^ksU[123]$/.test(id) && e.type === 'change') {
      var k = parseInt(id.slice(3), 10), v = e.target.value;
      if (v === '') draft.uppers[k - 1] = null;
      else if (v !== 'raw') draft.uppers[k - 1] = upFromTile(tileById(v));
    }
    else if (id === 'ksFold' && e.type === 'change' && e.target.value === '__new') {
      var w = e.target.parentNode;
      e.target.value = draft.folder || '';
      folderNew(function (n) { readForm(); draft.folder = n; if (w.isConnected) w.innerHTML = '<span>Folder</span>' + folderSel(draft.folder); });
    }
  }
  function onModalClick(e) {
    var m = $('ksModal');
    if (e.target === m) { closeModal(); return; }
    var col = e.target.closest('[data-col]');
    if (col && draft) { draft.color = col.dataset.col; m.querySelectorAll('[data-col]').forEach(function (b) { b.classList.toggle('on', b === col); }); return; }
    var stp = e.target.closest('[data-step]');
    if (stp && draft && draft.ctrl) {
      readForm();
      var p = stp.dataset.step.split(':'); draft.ctrl[p[0]] = m7(draft.ctrl[p[0]] + parseInt(p[1], 10));
      var i = $('ksN_' + p[0]); if (i) i.value = draft.ctrl[p[0]];
      liveSend();
      return;
    }
    var q = e.target.closest('[data-qsts]');
    if (q && draft && draft.ctrl) {
      var n = parseInt(q.dataset.qsts, 10);
      draft.ctrl = { msb: 0, lsb: 0, pc: 63 + n, pcOnly: true };
      ['msb', 'lsb', 'pc'].forEach(function (k) { var x = $('ksN_' + k); if (x) x.value = draft.ctrl[k]; });
      var po = $('ksPcOnly'); if (po) po.checked = true;
      var nm = $('ksName'); if (nm && /^PERFORMANCE \d+$|^STS \d$/.test(nm.value)) { nm.value = 'STS ' + n; }
      liveSend(true);
      return;
    }
    var b = e.target.closest('[data-m]');
    if (!b) return;
    var a = b.dataset.m;
    if (a === 'close') closeModal();
    else if (a === 'relearn') { var keep = editId; readForm(); learnOpen(keep); }
    else if (a === 'snaplearn') { learnOpen(null); }
    else if (a === 'try') { readForm(); if (draft && sendKsData(draft)) note(T('Dikirim (belum disimpan)', 'Sent (not saved yet)')); }
    else if (a === 'take') { readForm(); for (var k = 1; k <= 3; k++) if (KS.cur[k]) draft.uppers[k - 1] = copyUp(KS.cur[k]); fillUpperSelects(); }
    else if (a === 'save') save(false);
    else if (a === 'savenext') save(true);
    else if (a === 'del') del();
    else if (a === 'up' || a === 'down') move(a === 'up' ? -1 : 1);
    else if (a === 'dup') dup();
    else if (a === 'toperf') { readForm(); var keepId = editId, pre = { name: draft.name, uppers: snapUppers(draft.msgs), folder: draft.folder, color: draft.color, pos: draft.pos }; openFinder(null, pre); editId = keepId; draft.id = keepId; posStatus(); }
  }
  function save(next) {
    readForm(); readPos();
    if (!draft) return;
    if (!draft.name) { note(T('Nama wajib diisi (lihat layar keyboard)', 'Name is required (see the keyboard screen)')); var ni = $('ksName'); if (ni) ni.focus(); return; }
    var c = cleanKs(Object.assign({}, draft, { id: editId || uid() }), KS.list.length);
    if (!c) { note(T('Data Performance tidak valid', 'Invalid Performance data')); return; }
    var other = c.pos ? atPos(c.pos, c.id) : null;
    if (other) {
      mrAsk(T('Posisi ' + posLabel(c.pos) + ' sudah dipakai "' + other.name + '". Ganti? ("' + other.name + '" pindah ke LAINNYA)', 'Position ' + posLabel(c.pos) + ' is used by "' + other.name + '". Replace? ("' + other.name + '" moves to OTHERS)'), function () { other.pos = null; doSave(c, next); });
      return;
    }
    doSave(c, next);
  }
  function doSave(c, next) {
    if (c.folder && KS.folders.indexOf(c.folder) < 0) KS.folders.push(c.folder);
    var i = -1;
    for (var j = 0; j < KS.list.length; j++) if (KS.list[j].id === c.id) i = j;
    if (i >= 0) KS.list[i] = c;
    else { if (KS.list.length >= MAX_KS) { note(T('Maksimal ' + MAX_KS + ' Performance', 'Max ' + MAX_KS + ' Performances')); return; } KS.list.push(c); }
    if (c.type === 'ctrl' && finder) { KS.activeId = c.id; KS.lastAction = 'kset'; KS.cur = { 1: copyUp(c.uppers[0]), 2: copyUp(c.uppers[1]), 3: copyUp(c.uppers[2]) }; KS.dirty = {}; KS.ext = false; }
    persist();
    render(); changed();
    note(T('Tersimpan: ', 'Saved: ') + c.name);
    if (next) {
      var keepFold = c.folder, keepCol = c.color, np = nextPos(c.pos);
      closeModal();
      openFinder(null, { folder: keepFold, color: keepCol, pos: np });
    } else closeModal();
  }
  function del() {
    if (!editId) return;
    var k = find(editId), id = editId;
    if (!k) return;
    mrAsk(T('Hapus "' + k.name + '"?', 'Delete "' + k.name + '"?'), function () {
      KS.list = KS.list.filter(function (x) { return x.id !== id; });
      if (KS.activeId === id) KS.activeId = null;
      closeModal(); persist(); render(); changed();
    }, { ok: T('HAPUS', 'DELETE'), danger: true });
  }
  function move(d) {
    var i = -1;
    for (var j = 0; j < KS.list.length; j++) if (KS.list[j].id === editId) i = j;
    var n = i + d;
    if (i < 0 || n < 0 || n >= KS.list.length) return;
    var t = KS.list[i]; KS.list[i] = KS.list[n]; KS.list[n] = t;
    persist(); render();
    note(T('Posisi: ', 'Position: ') + (n + 1));
  }
  function dup() {
    var k = find(editId);
    if (!k || KS.list.length >= MAX_KS) return;
    var c = JSON.parse(JSON.stringify(k)); c.id = uid(); c.name = (k.name + ' 2').slice(0, 40);
    var i = KS.list.indexOf(k);
    KS.list.splice(i + 1, 0, c);
    persist(); render(); openEditor(c.id);
  }

  // ---------- REKAM SNAPSHOT SOUND (cara lama) ----------
  function inPorts() { try { return midiList(midiAccess && midiAccess.inputs).filter(function (p) { return p.state !== 'disconnected'; }); } catch (e) { return []; } }
  function checklist() {
    var u1 = '-', u2 = '-', u3 = '-';
    try { u1 = globalChannel; u2 = layerChannel; u3 = upper3Channel > 0 ? upper3Channel : T('(channel lain, lalu isi juga Pengaturan › Upper 3 MIDI Channel)', '(another channel, then also set Settings › Upper 3 MIDI Channel)'); } catch (e) {}
    return '<details class="ks-help"><summary>' + T('Tidak ada pesan masuk? Cek ini di keyboard', 'Nothing arrives? Check this on the keyboard') + '</summary><ol>' +
      '<li>' + T('<b>Kabel</b>: USB membawa IN dan OUT sekaligus. Dengan interface 5-pin, perlu 2 kabel: <b>MIDI OUT keyboard → IN interface</b> (untuk rekam) dan <b>OUT interface → MIDI IN keyboard</b> (untuk memutar).', '<b>Cables</b>: USB carries IN and OUT. With a 5-pin interface you need 2 cables: <b>keyboard MIDI OUT → interface IN</b> (to record) and <b>interface OUT → keyboard MIDI IN</b> (to play back).') + '</li>' +
      '<li><b>GLOBAL › MIDI › MIDI Out Channels</b>: ' + T('isi Upper 1 = CH ', 'set Upper 1 = CH ') + u1 + ', Upper 2 = CH ' + u2 + ', Upper 3 = ' + (typeof u3 === 'number' ? 'CH ' + u3 : u3) + '.</li>' +
      '<li><b>GLOBAL › MIDI › MIDI In Channels</b>: ' + T('sama dengan Out (supaya rekaman bisa diputar), plus <b>Control</b> = CH ', 'same as Out (so recordings play back), plus <b>Control</b> = CH ') + styleCtrlChannel + '.</li>' +
      '<li><b>GLOBAL › MIDI › Filters</b>: ' + T('pastikan <b>Program Change</b> dan <b>Control Change</b> tidak difilter di MIDI Out.', 'make sure <b>Program Change</b> and <b>Control Change</b> are not filtered on MIDI Out.') + '</li>' +
      '<li>' + T('Uji dulu di Pengaturan › <b>Tes IN</b>: tekan satu tuts keyboard, harus muncul "MIDI IN OK".', 'Test first in Settings › <b>IN test</b>: press a keyboard key; "MIDI IN OK" must appear.') + '</li></ol></details>';
  }
  function learnOpen(targetId) {
    if (typeof midiAccess === 'undefined' || !midiAccess) { note(T('MIDI belum aktif. Sambungkan keyboard dulu.', 'MIDI not active yet. Connect the keyboard first.')); return; }
    learnStop();
    finder = false;
    editId = targetId || null;
    showModal(targetId ? T('REKAM ULANG SNAPSHOT SOUND', 'RE-RECORD SOUND SNAPSHOT') : T('REKAM SNAPSHOT SOUND', 'RECORD SOUND SNAPSHOT'));
    attachMidiInputs();
    var ins = inPorts();
    cap = { msgs: [], notes: 0, first: 0, timers: {}, off: null, t0: Date.now() };
    $('ksMBody').innerHTML =
      '<div class="ks-warn">' + T('Snapshot hanya merekam <b>isi sound</b> Upper 1-3. Untuk berpindah <b>Performance</b>, pakai <b>＋ CARI NOMOR</b>.', 'A snapshot records only the Upper 1-3 <b>sounds</b>. To switch <b>Performances</b>, use <b>＋ FIND NUMBER</b>.') + '</div>' +
      '<div class="ks-in">' + (ins.length ? 'MIDI IN: <b class="dg-ok">' + esc(ins.map(function (p) { return p.name || '?'; }).join(', ')) + '</b>' : '<b class="dg-bad">' + T('Tidak ada port MIDI IN.', 'No MIDI IN port.') + '</b> ' + T('Rekam butuh pesan dari keyboard ke aplikasi.', 'Recording needs messages from the keyboard.')) + '</div>' +
      '<div class="ks-wait" id="ksWait"><i class="ks-pulse"></i><div><b>' + T('Tekan tombol PERFORMANCE / STS di panel keyboard sekarang', 'Press a PERFORMANCE / STS button on the keyboard now') + '</b><small id="ksCount">' + T('Menunggu pesan...', 'Waiting for messages...') + '</small></div></div>' +
      '<div class="ks-sum" id="ksSum"></div>' + checklist();
    setFoot('<button type="button" class="ks-btn" data-m="close">' + T('BATAL', 'CANCEL') + '</button>');
    cap.off = onMidiInput(onCap);
    cap.timers.wait = setTimeout(function () { if (cap && !cap.first) learnFail(); }, 30000);
    cap.timers.tick = setInterval(function () { if (!cap || cap.first) return; var c = $('ksCount'); if (c) c.textContent = T('Menunggu pesan... ', 'Waiting... ') + Math.max(0, 30 - Math.round((Date.now() - cap.t0) / 1000)) + T(' dtk', ' s') + (cap.notes ? T(' · ' + cap.notes + ' nada diabaikan', ' · ' + cap.notes + ' notes ignored') : ''); }, 500);
  }
  function onCap(e) {
    if (!cap || cap.done) return;
    var d = e.data;
    if (!d || !d.length) return;
    var st = d[0], h = st & 0xF0;
    if (h === 0x80 || h === 0x90 || h === 0xA0 || h === 0xD0 || h === 0xE0) { cap.notes++; return; }
    if (st > 0xF0) return;
    if (h === 0xB0 && SKIP_CC[d[1]]) return;
    var cm = cleanMsg(d);
    if (!cm) return;
    var prev = cap.msgs[cap.msgs.length - 1];
    if (prev && prev.join(',') === cm.join(',')) return;
    if (cap.msgs.length >= MAX_MSGS) return;
    cap.msgs.push(cm);
    if (!cap.first) {
      cap.first = Date.now();
      clearTimeout(cap.timers.wait);
      cap.timers.hard = setTimeout(learnFinish, 6000);
    }
    clearTimeout(cap.timers.quiet);
    cap.timers.quiet = setTimeout(learnFinish, 1200);
    var c = $('ksCount'); if (c) c.textContent = T('Merekam... ', 'Recording... ') + cap.msgs.length + T(' pesan', ' messages');
    var s = $('ksSum'); if (s) s.innerHTML = summarize(cap.msgs).lines.map(function (l) { return '<div>' + l + '</div>'; }).join('');
  }
  function learnStop() {
    if (!cap) return;
    cap.done = true;
    if (cap.off) cap.off();
    Object.keys(cap.timers).forEach(function (k) { clearTimeout(cap.timers[k]); clearInterval(cap.timers[k]); });
    cap = null;
  }
  function learnFail() {
    var notes = cap ? cap.notes : 0;
    learnStop();
    var w = $('ksWait');
    if (w) w.innerHTML = '<div><b class="dg-bad">' + T('Tidak ada pesan pemilihan sound yang diterima.', 'No sound-selection messages received.') + '</b><small>' +
      (notes ? T('Ada ' + notes + ' pesan nada masuk, jadi kabel IN sudah benar. Cek MIDI Out Channels (Upper 1-3) dan Filters di keyboard.', notes + ' note messages arrived, so the IN cable works. Check MIDI Out Channels (Upper 1-3) and Filters on the keyboard.') : T('Tidak ada pesan sama sekali. Cek kabel / port MIDI IN, lalu coba lagi.', 'Nothing arrived at all. Check the cable / MIDI IN port and try again.')) + '</small></div>';
    var h = document.querySelector('#ksModal .ks-help'); if (h) h.open = true;
    setFoot('<button type="button" class="ks-btn" data-m="close">' + T('TUTUP', 'CLOSE') + '</button><button type="button" class="ks-btn pri" data-m="relearn">' + T('COBA LAGI', 'TRY AGAIN') + '</button>');
  }
  function learnFinish() {
    if (!cap) return;
    var msgs = cap.msgs.slice();
    learnStop();
    if (!msgs.length) { learnFail(); return; }
    var target = editId ? find(editId) : null;
    draft = target ? JSON.parse(JSON.stringify(target)) : { id: null, name: '', type: 'snap', color: 'amber', resend: false, folder: KS.folder !== 'all' ? KS.folder : '' };
    draft.type = 'snap'; draft.msgs = msgs; delete draft.ctrl; delete draft.uppers;
    if (!draft.name) draft.name = 'SNAPSHOT ' + (KS.list.length + 1);
    var s = summarize(msgs);
    $('ksMBody').innerHTML =
      '<div class="ks-ok">✓ ' + T('Terekam ', 'Recorded ') + msgs.length + T(' pesan', ' messages') + '</div>' +
      '<div class="ks-sum">' + s.lines.map(function (l) { return '<div>' + l + '</div>'; }).join('') + '</div>' +
      '<div class="ks-warn">' + T('Ingin berpindah <b>Performance</b> (bukan hanya isinya)? Tekan <b>JADIKAN PERFORMANCE</b>: nama Upper dari rekaman ini dipakai, tinggal cari nomornya.', 'Want to switch the <b>Performance</b> (not just its sounds)? Press <b>MAKE PERFORMANCE</b>: the Upper names from this recording are used, you only need to find the number.') + '</div>' +
      '<label class="ks-f"><span>' + T('Nama', 'Name') + '</span><input type="text" id="ksName" maxlength="40" value="' + esc(draft.name) + '"></label>' +
      '<div class="ks-f"><span>Folder</span>' + folderSel(draft.folder) + '</div>' + colorRow();
    setFoot('<button type="button" class="ks-btn" data-m="close">' + T('BATAL', 'CANCEL') + '</button><button type="button" class="ks-btn" data-m="relearn">' + T('ULANGI', 'REDO') + '</button><button type="button" class="ks-btn" data-m="toperf">' + T('JADIKAN PERFORMANCE', 'MAKE PERFORMANCE') + '</button><button type="button" class="ks-btn pri" data-m="save">' + T('SIMPAN SNAPSHOT', 'SAVE SNAPSHOT') + '</button>');
    var n = $('ksName'); if (n) { try { n.focus(); n.select(); } catch (e) {} }
  }

  /* ---------------------------------------------------------------
     Ekspor ke luar
     --------------------------------------------------------------- */
  window.ksRender = render;
  window.ksLearnOpen = function () { try { closeTileModal(); } catch (e) {} try { switchMainPanel('kset'); } catch (e) {} openFinder(null); };
  window.MRKSET = {
    state: KS, recall: recall, step: step, sendSts: sendSts, learnOpen: learnOpen, learnFinish: learnFinish, learnFail: learnFail,
    openEditor: openEditor, openFinder: openFinder, summarize: summarize, cleanKs: cleanKs, render: render,
    active: function () { return KS.lastAction === 'kset' && !KS.ext ? find(KS.activeId) : null; },
    uppersOf: uppersOf, upName: upName, upTile: upTile, setUpper: setUpper, saveUppers: saveUppers, chNo: chNo,
    badge: badge, posLabel: posLabel, predict: predict, onChange: function (f) { if (typeof f === 'function') hooks.push(f); }, MAX: MAX_KS
  };

  window.addEventListener('load', function () { if (!KS.cur[1] && KS.lastAction !== 'kset') initCur(); render(); changed(); });
  (window.mrLangHooks = window.mrLangHooks || []).push(function () {
    var p = $('panelKset');
    if (p && p.dataset.built) { p.removeEventListener('click', onPanelClick); p.removeAttribute('data-built'); p.innerHTML = ''; }
    render();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var m = $('ksModal'); if (m && !m.classList.contains('ks-hide')) closeModal(); } });
})();
