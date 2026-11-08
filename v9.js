/* =====================================================================
   MIDI ROYALE PRO - FEATURE PACK v9
   1) Merek & model keyboard (KORG / YAMAHA / ROLAND / MIDI umum, ~58 model) + pemilih layar penuh
   2) Tuts & akor dari keyboard (MIDI IN -> keyboard virtual hijau + nama akor)
   3) Fitur panggung: kontrol dari pedal/tombol keyboard (MIDI Learn), kunci layar, pengingat backup
   4) Pengaturan grafis (Otomatis / Low / Medium / High / Ultra) + indikator beban
   5) Versi & CEK UPDATE, Panduan Setup 5 langkah
   6) Koneksi: Cek Keyboard (Device Inquiry), bunyi & getar koneksi, pulih setelah layar terkunci
   Dimuat setelah kset.js. Memakai fungsi global yang sudah ada dan membungkusnya.
   ===================================================================== */
(function () {
  'use strict';

  /* ---------------------------------------------------------------
     Bantuan umum
     --------------------------------------------------------------- */
  function $(id) { return document.getElementById(id); }
  function en() { try { return currentLang === 'en'; } catch (e) { return false; } }
  function T(id, eng) { return en() ? eng : id; }
  function note(m) { try { toast(m); } catch (e) {} }
  function persist() { try { saveLocalStoragePreset(); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function cl(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
  var NN = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  function noteName(n) { return NN[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1); }
  (window.mrLangHooks = window.mrLangHooks || []);

  // Pengguna lama (sudah punya data) tidak dipaksa ganti channel saat memilih model pertama kali
  var HAD_DATA = !!lsGet('MIDI_ROYALE_PRO_DATA');

  /* ---------------------------------------------------------------
     STATE v9 (ikut Export / Import / Cloud lewat extraPersist)
     --------------------------------------------------------------- */
  var V = {
    kb: { model: '', styleMode: 'auto' },
    gfx: { mode: 'auto', meter: false },
    remote: { on: true, map: {} },
    connSound: 2,               // 0 OFF, 1 KECIL, 2 SEDANG, 3 KERAS
    keysChord: true,
    autoCloud: true,            // backup cloud otomatis harian
    errLog: true                // laporan error otomatis
  };

  /* =================================================================
     1) MEREK & MODEL KEYBOARD
     ================================================================= */
  // ch = [Upper 1, Upper 2, Upper 3 (0 = tidak dipakai), Control]
  // pc = penomoran Program Change (0 = apa adanya, 1 = daftar mulai dari 1, dikirim nomor - 1)
  // sx = SysEx Engine quartertone, st = cara tombol Style Play mengirim pesan
  var PROF = {
    korgPa:  { ch: [1, 2, 3, 16], pc: 0, sx: 'korg_universal', st: 'korg', kind: 'arr' },
    korgArr: { ch: [1, 2, 3, 16], pc: 0, sx: 'universal', st: 'korg', kind: 'arr' },
    korgSyn: { ch: [1, 2, 0, 16], pc: 0, sx: 'universal', st: 'none', kind: 'syn' },
    yamArr:  { ch: [1, 2, 3, 16], pc: 1, sx: 'yamaha', st: 'yamaha', kind: 'arr' },
    yamE:    { ch: [1, 2, 0, 16], pc: 1, sx: 'yamaha', st: 'yamaha', kind: 'arr' },
    yamSyn:  { ch: [1, 2, 0, 16], pc: 1, sx: 'universal', st: 'none', kind: 'syn' },
    rolEA:   { ch: [1, 2, 3, 16], pc: 1, sx: 'roland', st: 'startstop', kind: 'arr' },
    rolBK:   { ch: [1, 2, 3, 10], pc: 1, sx: 'roland', st: 'bk', kind: 'arr' },
    rolSyn:  { ch: [1, 2, 0, 16], pc: 1, sx: 'universal', st: 'none', kind: 'syn' },
    rolPno:  { ch: [1, 2, 0, 16], pc: 1, sx: 'universal', st: 'none', kind: 'piano' },
    gen:     { ch: [1, 2, 0, 16], pc: 1, sx: 'universal', st: 'none', kind: 'gen' },
    genGS:   { ch: [1, 2, 3, 16], pc: 1, sx: 'roland', st: 'none', kind: 'gen' },
    genXG:   { ch: [1, 2, 3, 16], pc: 1, sx: 'yamaha', st: 'none', kind: 'gen' }
  };
  var BRANDS = [
    { id: 'korg', name: 'KORG', sub: 'Pa · i3 · Kronos' },
    { id: 'yamaha', name: 'YAMAHA', sub: 'Genos · PSR · CVP · MONTAGE' },
    { id: 'roland', name: 'ROLAND', sub: 'E-A7 · BK · FANTOM · JUNO' },
    { id: 'generic', name: 'MIDI UMUM', sub: 'GM / GS / XG / USB' }
  ];
  // [id, merek, seri, nama, profil]
  var MODELS = [
    ['korg_pa5x', 'korg', 'Pa Series', 'Pa5X', 'korgPa'], ['korg_pa4x', 'korg', 'Pa Series', 'Pa4X', 'korgPa'],
    ['korg_pa3x', 'korg', 'Pa Series', 'Pa3X', 'korgPa'], ['korg_pa2x', 'korg', 'Pa Series', 'Pa2X', 'korgPa'],
    ['korg_pa1000', 'korg', 'Pa Series', 'Pa1000', 'korgPa'], ['korg_pa900', 'korg', 'Pa Series', 'Pa900', 'korgPa'],
    ['korg_pa800', 'korg', 'Pa Series', 'Pa800', 'korgPa'], ['korg_pa700', 'korg', 'Pa Series', 'Pa700', 'korgPa'],
    ['korg_pa600', 'korg', 'Pa Series', 'Pa600', 'korgPa'], ['korg_pa500', 'korg', 'Pa Series', 'Pa500', 'korgPa'],
    ['korg_pa300', 'korg', 'Pa Series', 'Pa300', 'korgPa'],
    ['korg_i3', 'korg', 'Arranger', 'i3', 'korgArr'], ['korg_ek50', 'korg', 'Arranger', 'EK-50', 'korgArr'],
    ['korg_kronos', 'korg', 'Workstation', 'Kronos', 'korgSyn'], ['korg_nautilus', 'korg', 'Workstation', 'Nautilus', 'korgSyn'],
    ['korg_krome', 'korg', 'Workstation', 'Krome EX', 'korgSyn'], ['korg_kross2', 'korg', 'Workstation', 'Kross 2', 'korgSyn'],

    ['yam_genos2', 'yamaha', 'Genos', 'Genos2', 'yamArr'], ['yam_genos', 'yamaha', 'Genos', 'Genos', 'yamArr'],
    ['yam_tyros5', 'yamaha', 'Tyros', 'Tyros5', 'yamArr'], ['yam_tyros4', 'yamaha', 'Tyros', 'Tyros4', 'yamArr'],
    ['yam_sx920', 'yamaha', 'PSR-SX', 'PSR-SX920', 'yamArr'], ['yam_sx900', 'yamaha', 'PSR-SX', 'PSR-SX900', 'yamArr'],
    ['yam_sx720', 'yamaha', 'PSR-SX', 'PSR-SX720', 'yamArr'], ['yam_sx700', 'yamaha', 'PSR-SX', 'PSR-SX700', 'yamArr'],
    ['yam_sx600', 'yamaha', 'PSR-SX', 'PSR-SX600', 'yamArr'],
    ['yam_s975', 'yamaha', 'PSR-S', 'PSR-S975', 'yamArr'], ['yam_s970', 'yamaha', 'PSR-S', 'PSR-S970', 'yamArr'],
    ['yam_s775', 'yamaha', 'PSR-S', 'PSR-S775', 'yamArr'], ['yam_s670', 'yamaha', 'PSR-S', 'PSR-S670', 'yamArr'],
    ['yam_e473', 'yamaha', 'PSR-E', 'PSR-E473', 'yamE'], ['yam_ew425', 'yamaha', 'PSR-E', 'PSR-EW425', 'yamE'],
    ['yam_e383', 'yamaha', 'PSR-E', 'PSR-E383', 'yamE'],
    ['yam_cvp909', 'yamaha', 'Clavinova CVP', 'CVP-909', 'yamArr'], ['yam_cvp809', 'yamaha', 'Clavinova CVP', 'CVP-809', 'yamArr'],
    ['yam_montagem', 'yamaha', 'Synth', 'MONTAGE M', 'yamSyn'], ['yam_montage', 'yamaha', 'Synth', 'MONTAGE', 'yamSyn'],
    ['yam_modx', 'yamaha', 'Synth', 'MODX+', 'yamSyn'],

    ['rol_ea7', 'roland', 'Arranger', 'E-A7', 'rolEA'], ['rol_ex50', 'roland', 'Arranger', 'E-X50', 'rolEA'],
    ['rol_ex30', 'roland', 'Arranger', 'E-X30', 'rolEA'], ['rol_ex20', 'roland', 'Arranger', 'E-X20', 'rolEA'],
    ['rol_bk9', 'roland', 'BK Series', 'BK-9', 'rolBK'], ['rol_bk7m', 'roland', 'BK Series', 'BK-7m', 'rolBK'],
    ['rol_bk5', 'roland', 'BK Series', 'BK-5', 'rolBK'], ['rol_bk3', 'roland', 'BK Series', 'BK-3', 'rolBK'],
    ['rol_fantom', 'roland', 'Synth', 'FANTOM', 'rolSyn'], ['rol_junox', 'roland', 'Synth', 'JUNO-X', 'rolSyn'],
    ['rol_junods', 'roland', 'Synth', 'JUNO-DS', 'rolSyn'],
    ['rol_rd2000', 'roland', 'Stage Piano', 'RD-2000', 'rolPno'], ['rol_rd88', 'roland', 'Stage Piano', 'RD-88', 'rolPno'],
    ['rol_fp90x', 'roland', 'Digital Piano', 'FP-90X', 'rolPno'], ['rol_fp60x', 'roland', 'Digital Piano', 'FP-60X', 'rolPno'],
    ['rol_fp30x', 'roland', 'Digital Piano', 'FP-30X', 'rolPno'],

    ['gen_gm', 'generic', 'Umum', 'Keyboard MIDI umum (GM)', 'gen'], ['gen_gs', 'generic', 'Umum', 'Modul GM/GS', 'genGS'],
    ['gen_xg', 'generic', 'Umum', 'Modul XG', 'genXG'], ['gen_usb', 'generic', 'Umum', 'Controller USB (tanpa suara)', 'gen']
  ];
  function modelById(id) {
    for (var i = 0; i < MODELS.length; i++) if (MODELS[i][0] === id) { var m = MODELS[i]; return { id: m[0], brand: m[1], series: m[2], name: m[3], p: PROF[m[4]], pk: m[4] }; }
    return null;
  }
  function brandName(b) { for (var i = 0; i < BRANDS.length; i++) if (BRANDS[i].id === b) return BRANDS[i].name; return ''; }
  function curModel() { return modelById(V.kb.model); }
  function shortName(m) { m = m || curModel(); if (!m) return T('PILIH KEYBOARD', 'PICK KEYBOARD'); return m.brand === 'generic' ? T('MIDI UMUM', 'GENERIC MIDI') : brandName(m.brand) + ' ' + m.name; }
  window.mrKbShortName = function () { return shortName(); };
  // nama ringkas untuk chip sempit (bar LCD Pa5X)
  window.mrKbChipName = function () { var m = curModel(); return m ? (m.brand === 'generic' ? T('MIDI UMUM', 'GENERIC') : m.name) : 'KEYBOARD'; };
  window.mrKbModel = function () { return curModel(); };
  window.mrKbBrand = function () { var m = curModel(); return m ? m.brand : 'korg'; };

  var SX_LABEL = { korg_universal: 'KORG Pa', yamaha: 'Yamaha XG', roland: 'Roland GS', universal: 'Universal MTS', all: 'Semua' };
  var ST_MODES = ['auto', 'korg', 'yamaha', 'startstop', 'bk', 'none'];
  function stLabel(st) {
    return {
      korg: T('Program Change (Korg)', 'Program Change (Korg)'),
      yamaha: T('SysEx Section Control (Yamaha)', 'SysEx Section Control (Yamaha)'),
      startstop: T('Start/Stop saja (Roland E-A7)', 'Start/Stop only (Roland E-A7)'),
      bk: T('Kode Bank + Program (Roland BK)', 'Bank + Program codes (Roland BK)'),
      none: T('Mati (tanpa style)', 'Off (no style)')
    }[st] || st;
  }
  function styleMode() {
    if (V.kb.styleMode && V.kb.styleMode !== 'auto') return V.kb.styleMode;
    var m = curModel();
    return m ? m.p.st : 'korg';
  }
  function profSummary(m) {
    var p = m.p;
    return 'Upper 1/2/3 = CH ' + p.ch[0] + '/' + p.ch[1] + '/' + (p.ch[2] || '–') + ' · Control CH ' + p.ch[3] +
      ' · PC ' + (p.pc ? T('mulai 1', 'from 1') : T('mulai 0', 'from 0')) + ' · SysEx ' + SX_LABEL[p.sx] + ' · Style: ' + stLabel(p.st);
  }

  function applyModel(id, withCh, quiet) {
    var m = modelById(id);
    if (!m) return false;
    V.kb.model = id;
    var p = m.p;
    try {
      if (withCh) {
        try { releaseAllVk(); } catch (e) {}
        var before = targetChannels().slice();
        globalChannel = p.ch[0];
        layerChannel = p.ch[1];
        upper3Channel = p.ch[2];
        styleCtrlChannel = p.ch[3];
        ensureLayerChannelValid();
        initMidiChannelSelect();
        syncChannelSelects();
        var now = targetChannels();
        if (selectedMidiOutput) before.forEach(function (c) { if (now.indexOf(c) < 0) silenceChannel(c); });
        invalidateSent();
      }
      setPcBase(p.pc);
      changeSysexBrand(p.sx);
      refreshFeatureUI();
    } catch (e) { console.error('applyModel', e); }
    persist();
    updateKbChips();
    if (!quiet) note(T('Keyboard: ', 'Keyboard: ') + shortName(m) + (withCh ? T(' · channel diatur', ' · channels set') : ''));
    return true;
  }
  function updateKbChips() {
    var cm = curModel();
    var t = $('kbModelChipTxt');
    if (t) t.innerHTML = cm ? '<small>' + esc(cm.brand === 'generic' ? 'MIDI' : brandName(cm.brand)) + '</small>' + esc(cm.brand === 'generic' ? T('UMUM', 'GENERIC') : cm.name) : esc(T('PILIH KEYBOARD', 'PICK KEYBOARD'));
    var c = $('kbModelChip'); if (c) { c.classList.toggle('unset', !cm); c.title = shortName(cm); }
    var pc = $('paKbChip'); if (pc) { var s = pc.querySelector('span'); if (s) s.textContent = window.mrKbChipName(); pc.title = shortName(cm); }
    renderSettings();
  }

  // ---------- Layar pemilih keyboard (gaya sama dengan pemilih tampilan Klasik / Pa5X) ----------
  var BRAND_C = { korg: '248 113 113', yamaha: '167 139 250', roland: '251 146 60', generic: '34 211 238' };
  var BRAND_DESC = {
    korg: ['Pa Series, i3, EK-50, Kronos, Nautilus, Krome, Kross', 'Pa Series, i3, EK-50, Kronos, Nautilus, Krome, Kross'],
    yamaha: ['Genos, Tyros, PSR-SX, PSR-S, PSR-E, Clavinova, MONTAGE', 'Genos, Tyros, PSR-SX, PSR-S, PSR-E, Clavinova, MONTAGE'],
    roland: ['E-A7, E-X, BK, FANTOM, JUNO, RD, FP', 'E-A7, E-X, BK, FANTOM, JUNO, RD, FP'],
    generic: ['Keyboard / modul GM, GS, XG, controller USB, merek lain', 'GM, GS, XG keyboards / modules, USB controllers, other brands']
  };
  var ICO = {
    arr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="16" rx="2"/><path d="M8.5 4v16M15.5 4v16"/><path d="M6 4v9M12 4v9M18 4v9" stroke-width="3.2"/></svg>',
    syn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="16" rx="2"/><path d="M5 10c1.5-3 3-3 4.5 0s3 3 4.5 0 3-3 4.5 0"/><path d="M6 15h12"/></svg>',
    piano: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18h18"/><path d="M4 18V9a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v9"/><path d="M8 18v-5M12 18v-5M16 18v-5"/></svg>',
    gen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><circle cx="8" cy="11" r="1" fill="currentColor"/><circle cx="16" cy="11" r="1" fill="currentColor"/><circle cx="10" cy="15" r="1" fill="currentColor"/><circle cx="14" cy="15" r="1" fill="currentColor"/><circle cx="12" cy="8" r="1" fill="currentColor"/></svg>'
  };
  var KIND_TAG = { arr: 'ARRANGER', syn: 'SYNTH', piano: 'PIANO', gen: 'MIDI' };
  var pk = null;   // { step, brand, series, model, withCh, onDone }
  window.mrOpenKbPicker = function (opts) {
    opts = opts || {};
    var cm = curModel();
    pk = {
      brand: opts.brand || (cm ? cm.brand : 'korg'),
      series: '',
      model: cm && (!opts.brand || opts.brand === cm.brand) ? cm.id : '',
      withCh: opts.withCh !== undefined ? !!opts.withCh : (!cm && !HAD_DATA),
      onDone: opts.onDone || null,
      first: !!opts.first
    };
    pk.step = (opts.brand || cm) ? 'model' : 'brand';
    if (pk.model) pk.series = modelById(pk.model).series;
    var o = $('kbPick');
    if (!o) {
      o = el('div', 'kbp-ov'); o.id = 'kbPick';
      document.body.appendChild(o);
      o.addEventListener('click', onPickClick);
      o.addEventListener('change', function (e) { if (e.target && e.target.id === 'kbpWithCh') pk.withCh = e.target.checked; });
    }
    o.classList.remove('kbp-hide');
    renderPicker();
  };
  function seriesOf(b) { var a = []; MODELS.forEach(function (m) { if (m[1] === b && a.indexOf(m[2]) < 0) a.push(m[2]); }); return a; }
  function brandLabel(b) { return b === 'generic' ? T('MIDI UMUM', 'GENERIC MIDI') : brandName(b); }
  function renderPicker() {
    var o = $('kbPick'); if (!o || !pk) return;
    var cm = curModel();
    var closeTxt = cm ? T('TUTUP', 'CLOSE') : T('LEWATI', 'SKIP');
    if (pk.step === 'brand') {
      o.innerHTML =
        '<div class="kbp-head2"><h2>' + T('PILIH KEYBOARD KAMU', 'PICK YOUR KEYBOARD') + '</h2><p>' + T('Channel, penomoran Program Change, SysEx quartertone, dan Style Play langsung diatur sesuai model', 'Channels, Program Change numbering, quartertone SysEx and Style Play are set to match the model') + '</p></div>' +
        '<div class="kbp-brow">' + BRANDS.map(function (b, i) {
          var ser = seriesOf(b.id), n = MODELS.filter(function (m) { return m[1] === b.id; }).length;
          var cur = cm && cm.brand === b.id;
          return '<button type="button" class="kbp-bcard' + (cur ? ' last' : '') + '" data-brand="' + b.id + '" style="--c:' + BRAND_C[b.id] + ';--i:' + i + '">' +
            '<div class="kbp-btop"><div class="kbp-bico">' + ICO[b.id === 'generic' ? 'gen' : 'arr'] + '</div>' +
            '<div><div class="kbp-bt">' + brandLabel(b.id) + '</div><div class="kbp-bd">' + esc(BRAND_DESC[b.id][en() ? 1 : 0]) + '</div></div>' +
            (cur ? '<span class="kbp-badge">' + esc(cm.name) + '</span>' : '') + '</div>' +
            '<div class="kbp-bser">' + ser.map(function (x) { return '<i>' + esc(x === 'Umum' ? T('Umum', 'General') : x) + '</i>'; }).join('') + '</div>' +
            '<div class="kbp-bgo">' + n + ' MODEL · ' + T('PILIH', 'PICK') + ' ▶</div></button>';
        }).join('') + '</div>' +
        '<div class="kbp-bfoot"><button type="button" class="kbp-link" data-k="wizard">' + T('PANDUAN SETUP', 'SETUP GUIDE') + '</button><button type="button" class="kbp-link" data-k="skip">' + closeTxt + '</button></div>';
      o.className = 'kbp-ov step-brand';
      return;
    }
    var ser = seriesOf(pk.brand);
    if (ser.indexOf(pk.series) < 0) pk.series = ser[0];
    var models = MODELS.filter(function (m) { return m[1] === pk.brand && m[2] === pk.series; });
    var sel = pk.model ? modelById(pk.model) : null;
    var c = BRAND_C[pk.brand];
    var side;
    if (sel) {
      var p = sel.p;
      var rowsP = [['Upper 1 / 2 / 3', 'CH ' + p.ch[0] + ' / ' + p.ch[1] + ' / ' + (p.ch[2] || '–')], ['Control', 'CH ' + p.ch[3]], [T('Nomor PC', 'PC numbers'), p.pc ? T('mulai 1', 'from 1') : T('mulai 0', 'from 0')], ['Quartertone', SX_LABEL[p.sx]], ['Style Play', { korg: 'Program Change', yamaha: 'SysEx Section', startstop: 'Start / Stop', bk: 'Bank + Program', none: T('Mati', 'Off') }[p.st]]];
      side = '<div class="kbp-kb" aria-hidden="true"><div class="kbp-lcd"><small>' + esc(brandLabel(sel.brand)) + '</small><b>' + esc(sel.name) + '</b><i>' + KIND_TAG[p.kind] + '</i></div><div class="kbp-keys">' + new Array(22).join('<u></u>') + '</div></div>' +
        '<div class="kbp-sname"><div class="kbp-sico">' + ICO[p.kind] + '</div><div><small>' + esc(brandLabel(sel.brand)) + ' · ' + KIND_TAG[p.kind] + '</small><b>' + esc(sel.name) + '</b></div></div>' +
        '<div class="kbp-prof">' + rowsP.map(function (r) { return '<div><span>' + r[0] + '</span><b>' + esc(r[1]) + '</b></div>'; }).join('') + '</div>' +
        '<label class="kbp-chk"><input type="checkbox" id="kbpWithCh"' + (pk.withCh ? ' checked' : '') + '> ' + T('Atur channel otomatis', 'Set channels automatically') + '</label>' +
        '<button type="button" class="kbp-go" data-k="use">' + T('PAKAI MODEL INI', 'USE THIS MODEL') + ' ▶</button>';
    } else {
      side = '<div class="kbp-kb idle" aria-hidden="true"><div class="kbp-lcd"><small>' + esc(brandLabel(pk.brand)) + '</small><b>· · ·</b><i>' + T('PILIH MODEL', 'PICK A MODEL') + '</i></div><div class="kbp-keys">' + new Array(22).join('<u></u>') + '</div></div><div class="kbp-empty"><p>' + T('Ketuk salah satu model. Tidak ada di daftar? Pilih model yang paling mirip dari merek yang sama, atau MIDI UMUM.', 'Tap a model. Not listed? Pick the closest model of the same brand, or GENERIC MIDI.') + '</p></div>' +
        '<button type="button" class="kbp-go" data-k="use" disabled>' + T('PAKAI MODEL INI', 'USE THIS MODEL') + ' ▶</button>';
    }
    var ak = pk.brand + '|' + pk.series, anim = pk._ak !== ak; pk._ak = ak;
    var selAnim = pk._sm !== pk.model; pk._sm = pk.model;
    o.className = 'kbp-ov step-model' + (anim ? ' anim' : '') + (selAnim && sel ? ' selanim' : '');
    o.style.setProperty('--c', c);
    o.innerHTML =
      '<div class="kbp-panel" style="--c:' + c + '">' +
        '<div class="kbp-top"><button type="button" class="kbp-back" data-k="back">◀ ' + T('MEREK', 'BRANDS') + '</button>' +
          '<div class="kbp-tabs">' + BRANDS.map(function (b) { return '<button type="button" class="kbp-tab' + (b.id === pk.brand ? ' on' : '') + '" data-brand="' + b.id + '" style="--c:' + BRAND_C[b.id] + '">' + brandLabel(b.id) + '</button>'; }).join('') + '</div>' +
          '<button type="button" class="kbp-x" data-k="close" aria-label="Tutup">✕</button></div>' +
        '<div class="kbp-series"><div class="kbp-bname">' + brandLabel(pk.brand) + '<small>' + MODELS.filter(function (m) { return m[1] === pk.brand; }).length + ' MODEL</small></div>' + ser.map(function (x) { return '<button type="button" class="kbp-ser' + (x === pk.series ? ' on' : '') + '" data-series="' + esc(x) + '">' + esc(x === 'Umum' ? T('Umum', 'General') : x) + '</button>'; }).join('') + '</div>' +
        '<div class="kbp-main">' +
          '<div class="kbp-models">' + models.map(function (m, i) {
            var kind = PROF[m[4]].kind;
            return '<button type="button" class="kbp-model' + (m[0] === pk.model ? ' on' : '') + (m[0] === V.kb.model ? ' cur' : '') + '" data-model="' + m[0] + '" style="--i:' + i + '"><span class="kbp-mico">' + ICO[kind] + '</span><b>' + esc(m[3]) + '</b><small>' + KIND_TAG[kind] + (m[0] === V.kb.model ? ' · ' + T('DIPAKAI', 'IN USE') : '') + '</small><i class="kbp-ck">✓</i><span class="kbp-bed"></span></button>';
          }).join('') + '</div>' +
          '<div class="kbp-side">' + side +
            '<div class="kbp-sacts"><button type="button" class="kbp-link" data-k="wizard">' + T('PANDUAN SETUP', 'SETUP GUIDE') + '</button><button type="button" class="kbp-link" data-k="skip">' + closeTxt + '</button></div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }
  function closePicker(applied) {
    var o = $('kbPick'); if (o) o.classList.add('kbp-hide');
    var cb = pk && pk.onDone; pk = null;
    if (cb) { try { cb(applied); } catch (e) { console.error(e); } }
  }
  function onPickClick(e) {
    var o = $('kbPick');
    if (e.target === o && pk && pk.step === 'model') return;
    var b = e.target.closest('[data-brand]');
    if (b) { if (pk.brand !== b.dataset.brand) { pk.series = ''; pk.model = ''; } pk.brand = b.dataset.brand; pk.step = 'model'; renderPicker(); return; }
    var s = e.target.closest('[data-series]');
    if (s) { pk.series = s.dataset.series; renderPicker(); return; }
    var m = e.target.closest('[data-model]');
    if (m) { pk.model = m.dataset.model; renderPicker(); try { haptic(8); } catch (x) {} return; }
    var k = e.target.closest('[data-k]');
    if (!k) return;
    var a = k.dataset.k;
    if (a === 'close' || a === 'skip') closePicker(false);
    else if (a === 'back') { pk.step = 'brand'; renderPicker(); }
    else if (a === 'use' && pk.model) { applyModel(pk.model, pk.withCh); closePicker(true); }
    else if (a === 'wizard') { var keep = pk.model; if (keep) applyModel(keep, pk.withCh, true); closePicker(!!keep); openWizard(keep ? 1 : 0); }
  }

  // Setelah login: pemilih keyboard dulu, lalu pemilih tema (bila baru login)
  // Pengguna baru: pemilih keyboard → pemilih tampilan → Panduan Setup (langkah kabel) otomatis, sekali saja
  var pendingWizard = false;
  window.mrAfterLogin = function (just) {
    var needKb = just || !V.kb.model;
    var after = function (applied) {
      var fresh = applied && !HAD_DATA && !lsGet('mrWizardDone');
      if (just && window.mrShowThemePicker) { pendingWizard = fresh; window.mrShowThemePicker(); }
      else if (fresh) setTimeout(function () { openWizard(1); }, 300);
    };
    if (needKb) setTimeout(function () { window.mrOpenKbPicker({ first: true, onDone: after }); }, 60);
    else after(false);
  };

  // ---------- Style Play sesuai merek ----------
  var YAM_SEC = { INTRO_1: 0x00, INTRO_2: 0x01, COUNT_IN: 0x02, VAR_1: 0x08, VAR_2: 0x09, VAR_3: 0x0A, VAR_4: 0x0B, FILL_1: 0x10, FILL_2: 0x11, FILL_3: 0x12, FILL_4: 0x13, BREAK: 0x18, ENDING_1: 0x20, ENDING_2: 0x21, ENDING_3: 0x22 };
  // Roland BK: Bank MSB 42H + LSB 42H + Program di channel Control (dari laporan pengguna BK-7m; Fill/Break belum diketahui)
  var BK_PC = { INTRO_1: 0x41, INTRO_2: 0x41, COUNT_IN: 0x41, VAR_1: 0x00, VAR_2: 0x01, VAR_3: 0x08, VAR_4: 0x09, ENDING_1: 0x49, ENDING_2: 0x49, ENDING_3: 0x49 };
  var styleRunning = false;
  function lbl(cmd) { try { return styleCommandsMap[cmd].label; } catch (e) { return cmd; } }
  function startStop(useSysex) {
    styleRunning = !styleRunning;
    if (useSysex) sendMidiMessage(styleRunning ? [0xF0, 0x43, 0x60, 0x7A, 0xF7] : [0xF0, 0x43, 0x60, 0x7D, 0xF7]);
    else sendMidiMessage([styleRunning ? 0xFA : 0xFC]);
    return { text: styleRunning ? 'PLAYING' : 'READY / STOPPED' };
  }
  window.mrStyleSend = function (cmd) {
    var mode = styleMode();
    if (mode === 'korg') return false;
    if (mode === 'none') { note(T('Model ini tidak punya style/arranger. Ubah di Pengaturan › Style Play bila perlu.', 'This model has no style/arranger. Change it in Settings › Style Play if needed.')); return 'blocked'; }
    if (mode === 'yamaha') {
      if (window.__sysexBlocked) { note(T('SysEx ditolak browser: Style Yamaha tidak bisa dikirim', 'SysEx denied by the browser: Yamaha style control unavailable')); return 'blocked'; }
      if (cmd === 'START_STOP') return startStop(true);
      var ss = YAM_SEC[cmd]; if (ss === undefined) return 'blocked';
      sendMidiMessage([0xF0, 0x43, 0x7E, 0x00, ss, 0x7F, 0xF7]);
      return { text: 'ACTIVE: ' + lbl(cmd) };
    }
    if (mode === 'startstop') {
      if (cmd === 'START_STOP') return startStop(false);
      note(T('Model ini hanya menerima START/STOP lewat MIDI. Pilih bagian style di panel keyboard.', 'This model only accepts START/STOP over MIDI. Pick style sections on the keyboard panel.'));
      return 'blocked';
    }
    if (mode === 'bk') {
      if (cmd === 'START_STOP') return startStop(false);
      var pc = BK_PC[cmd];
      if (pc === undefined) { note(T('FILL / BREAK belum didukung untuk Roland BK lewat MIDI', 'FILL / BREAK is not supported for Roland BK over MIDI yet')); return 'blocked'; }
      var ch = (styleCtrlChannel - 1) & 0x0F;
      var clash = ch === mainIdx() || targetChannels().indexOf(ch) >= 0;
      if (clash) { note(T('Channel Control (' + styleCtrlChannel + ') bentrok dengan channel Upper. Ubah di Pengaturan.', 'Control channel (' + styleCtrlChannel + ') clashes with an Upper channel. Change it in Settings.')); return 'blocked'; }
      sendMidiBatch([[0xB0 | ch, 0, 0x42], [0xB0 | ch, 32, 0x42], [0xC0 | ch, pc]]);
      return { text: 'ACTIVE: ' + lbl(cmd) };
    }
    return false;
  };

  /* =================================================================
     2) TUTS & AKOR DARI KEYBOARD
     ================================================================= */
  var held = {};          // 'ch:note' -> note
  var heldCount = 0;
  var lastChord = '', chordIdle = true, keysTimer = null;
  var TPL = [
    ['', [0, 4, 7]], ['m', [0, 3, 7]], ['dim', [0, 3, 6]], ['aug', [0, 4, 8]], ['sus2', [0, 2, 7]], ['sus4', [0, 5, 7]], ['5', [0, 7]],
    ['6', [0, 4, 7, 9]], ['m6', [0, 3, 7, 9]], ['7', [0, 4, 7, 10]], ['maj7', [0, 4, 7, 11]], ['m7', [0, 3, 7, 10]], ['mMaj7', [0, 3, 7, 11]],
    ['m7b5', [0, 3, 6, 10]], ['dim7', [0, 3, 6, 9]], ['7sus4', [0, 5, 7, 10]], ['7#5', [0, 4, 8, 10]], ['maj7#5', [0, 4, 8, 11]], ['7b5', [0, 4, 6, 10]],
    ['add9', [0, 2, 4, 7]], ['madd9', [0, 2, 3, 7]], ['6/9', [0, 2, 4, 7, 9]], ['9', [0, 2, 4, 7, 10]], ['maj9', [0, 2, 4, 7, 11]], ['m9', [0, 2, 3, 7, 10]],
    ['7b9', [0, 1, 4, 7, 10]], ['7#9', [0, 3, 4, 7, 10]], ['9sus4', [0, 2, 5, 7, 10]], ['11', [0, 2, 4, 5, 7, 10]], ['m11', [0, 2, 3, 5, 7, 10]],
    ['7#11', [0, 4, 6, 7, 10]], ['13', [0, 2, 4, 7, 9, 10]], ['maj13', [0, 2, 4, 7, 9, 11]], ['m13', [0, 2, 3, 7, 9, 10]]
  ];
  var TPLM = TPL.map(function (t) { var m = 0; t[1].forEach(function (i) { m |= 1 << i; }); return { s: t[0], m: m, n: t[1].length, no5: (t[1].length >= 4 && (m & 128)) ? (m & ~128) : -1 }; });
  // Nama akor dari daftar nada MIDI. '' bila tidak dikenali (nada tunggal / kombinasi lain).
  function detectChord(notes) {
    if (!notes || notes.length < 2) return '';
    var sorted = notes.slice().sort(function (a, b) { return a - b; });
    var bass = sorted[0] % 12, pcs = [];
    sorted.forEach(function (n) { var p = n % 12; if (pcs.indexOf(p) < 0) pcs.push(p); });
    if (pcs.length < 2) return '';
    var best = null;
    pcs.forEach(function (r) {
      var m = 0; pcs.forEach(function (p) { m |= 1 << ((p - r + 12) % 12); });
      TPLM.forEach(function (t, i) {
        var sc = -1;
        if (t.m === m) sc = 100 - i;
        else if (t.no5 === m && pcs.length >= 3) sc = 60 - i;
        if (sc < 0) return;
        if (r === bass) sc += 30;
        if (!best || sc > best.sc) best = { sc: sc, r: r, s: t.s };
      });
    });
    if (!best) return '';
    return NN[best.r] + best.s + (best.r !== bass ? '/' + NN[bass] : '');
  }
  window.mrDetectChord = detectChord;
  window.mrKeysChordOn = function () { return !!V.keysChord; };
  function heldNotes() { var a = []; for (var k in held) if (a.indexOf(held[k]) < 0) a.push(held[k]); return a; }
  function vkMarks() {
    var host = $('vkKeys'); if (!host) return;
    var on = {}; heldNotes().forEach(function (n) { on[n] = 1; });
    host.querySelectorAll('.vk-white, .vk-black').forEach(function (k) { k.classList.toggle('vk-in', !!on[parseInt(k.dataset.note, 10)]); });
  }
  function chordUi() {
    var txt = lastChord || '–';
    var idle = chordIdle || !heldCount;
    [['chordPill', 'b'], ['paChord', 'b'], ['styleChord', 'b']].forEach(function (x) {
      var p = $(x[0]); if (!p) return;
      var b = p.querySelector(x[1]); if (b && b.textContent !== txt) b.textContent = txt;
      p.classList.toggle('idle', idle); p.classList.toggle('has', !!lastChord);
      p.classList.toggle('off', !V.keysChord);
    });
    var h = $('mrHeroChord');
    if (h) { h.textContent = lastChord ? 'CHORD ' + lastChord : ''; h.classList.toggle('idle', idle); h.style.display = (V.keysChord && lastChord) ? '' : 'none'; }
  }
  function keysUpdate() {
    keysTimer = null;
    vkMarks();
    var c = detectChord(heldNotes());
    if (c) { lastChord = c; chordIdle = false; }
    else if (!heldCount) chordIdle = true;
    chordUi();
  }
  function keysSchedule() { if (!keysTimer) keysTimer = setTimeout(keysUpdate, 16); }
  function keysClear(all) {
    held = {}; heldCount = 0;
    if (all) lastChord = '';
    chordIdle = true;
    keysSchedule();
  }
  window.mrOnPanic = function () { keysClear(true); };
  if (typeof window.onMidiInput === 'function') window.onMidiInput(function (e) {
    if (!V.keysChord) return;
    var d = e.data; if (!d || d.length < 2 || d[0] >= 0xF0) return;
    var st = d[0] & 0xF0, ch = d[0] & 0x0F;
    if (st === 0xB0 && (d[1] === 123 || d[1] === 120)) {
      for (var k in held) if (k.indexOf(ch + ':') === 0) { delete held[k]; heldCount--; }
      keysSchedule(); return;
    }
    if (ch === 9) return;   // channel 10 (drum) diabaikan
    if (st !== 0x90 && st !== 0x80) return;
    var key = ch + ':' + d[1];
    if (st === 0x90 && d[2] > 0) { if (!held[key]) { held[key] = d[1]; heldCount++; } }
    else if (held[key] !== undefined) { delete held[key]; heldCount--; }
    keysSchedule();
  });
  // keyboard virtual dibangun ulang saat oktaf digeser: tandai lagi nada dari keyboard
  var _buildVk = window.buildVk;
  if (typeof _buildVk === 'function') window.buildVk = function () { var r = _buildVk.apply(this, arguments); vkMarks(); return r; };
  function setKeysChord(on) {
    V.keysChord = !!on;
    keysClear(true);
    document.querySelectorAll('#paRoot .kbd-art .lit').forEach(function (x) { x.classList.remove('lit'); });
    chordUi(); persist(); renderSettings();
  }

  /* =================================================================
     3a) KONTROL DARI KEYBOARD (MIDI LEARN)
     ================================================================= */
  var ACTIONS = [
    ['ksPrev', 'Performance ◀', 'Performance ◀', function () { if (window.MRKSET) MRKSET.step(-1); }],
    ['ksNext', 'Performance ▶', 'Performance ▶', function () { if (window.MRKSET) MRKSET.step(1); }],
    ['songPrev', 'Lagu Setlist ◀', 'Setlist song ◀', function () { if (window.MRPRO) MRPRO.songStep(-1); }],
    ['songNext', 'Lagu Setlist ▶', 'Setlist song ▶', function () { if (window.MRPRO) MRPRO.songStep(1); }],
    ['voicePrev', 'Voice ◀', 'Voice ◀', function () { if (window.mrStep) mrStep(-1); }],
    ['voiceNext', 'Voice ▶', 'Voice ▶', function () { if (window.mrStep) mrStep(1); }],
    ['panic', 'PANIC', 'PANIC', function () { if (window.MRPRO) MRPRO.panic(); }],
    ['qtPrev', 'Preset Quartertone ◀', 'Quartertone preset ◀', function () { if (window.mrQtPresetStep) mrQtPresetStep(-1); }],
    ['qtNext', 'Preset Quartertone ▶', 'Quartertone preset ▶', function () { if (window.mrQtPresetStep) mrQtPresetStep(1); }]
  ];
  for (var ri = 0; ri < 8; ri++) (function (i) { ACTIONS.push(['reg' + (i + 1), 'REG ' + (i + 1), 'REG ' + (i + 1), function () { try { recallReg(i); updateRegUI(); } catch (e) {} }]); })(ri);
  function actById(id) { for (var i = 0; i < ACTIONS.length; i++) if (ACTIONS[i][0] === id) return ACTIONS[i]; return null; }
  function mapText(m) {
    if (!m) return T('belum dipasang', 'not set');
    var ch = ' · CH ' + (m.ch + 1);
    if (m.t === 'cc') return 'CC ' + m.n + (m.n === 64 ? ' (Sustain)' : '') + ch;
    if (m.t === 'pc') return 'PC ' + m.n + ch;
    return T('TUTS ', 'KEY ') + noteName(m.n) + ch;
  }
  function mapWarn(m) {
    if (!m) return '';
    if (m.t === 'note') return T('Ini tuts keyboard: setiap kali tuts ' + noteName(m.n) + ' dimainkan, aksi ikut jalan. Lebih aman pakai pedal / tombol yang mengirim CC.', 'This is a keyboard key: every time ' + noteName(m.n) + ' is played, the action runs. A pedal / button that sends CC is safer.');
    if (m.t === 'cc' && m.n === 64) return T('Ini pedal SUSTAIN (CC64): setiap kali sustain diinjak, aksi ikut jalan. Pakai pedal lain bila sustain tetap dibutuhkan.', 'This is the SUSTAIN pedal (CC64): every press runs the action. Use another pedal if you still need sustain.');
    return '';
  }
  var ccState = {}, ccRel = {}, lastFire = {};
  var learn = null;    // { id, off, timer }
  function fire(id) {
    var now = performance.now();
    if (lastFire[id] && now - lastFire[id] < 140) return;
    lastFire[id] = now;
    var a = actById(id); if (!a) return;
    try { a[3](); } catch (e) { console.error('remote', id, e); }
    flashRemote(en() ? a[2] : a[1]);
  }
  var flashT = null;
  function flashRemote(txt) {
    var f = $('rmFlash');
    if (!f) { f = el('div', 'rm-flash'); f.id = 'rmFlash'; document.body.appendChild(f); }
    f.textContent = '⏵ ' + txt; f.classList.add('show');
    clearTimeout(flashT); flashT = setTimeout(function () { f.classList.remove('show'); }, 900);
  }
  if (typeof window.onMidiInput === 'function') window.onMidiInput(function (e) {
    var d = e.data; if (!d || d.length < 2 || d[0] >= 0xF0) return;
    var st = d[0] & 0xF0, ch = d[0] & 0x0F;
    if (learn) { learnCapture(st, ch, d); return; }
    if (!V.remote.on) return;
    var map = V.remote.map;
    if (st === 0xB0) {
      var key = ch + '_' + d[1], v = d[2], prev = ccState[key] || 0;
      ccState[key] = v;
      if (v < 64) { ccRel[key] = true; return; }
      if (prev >= 64 && ccRel[key]) return;     // masih ditekan (pedal momentary)
      for (var k in map) { var m = map[k]; if (m && m.t === 'cc' && m.ch === ch && m.n === d[1]) fire(k); }
    } else if (st === 0xC0) {
      for (var k2 in map) { var m2 = map[k2]; if (m2 && m2.t === 'pc' && m2.ch === ch && m2.n === d[1]) fire(k2); }
    } else if (st === 0x90 && d[2] > 0) {
      for (var k3 in map) { var m3 = map[k3]; if (m3 && m3.t === 'note' && m3.ch === ch && m3.n === d[1]) fire(k3); }
    }
  });
  var SKIP_LEARN_CC = { 0: 1, 32: 1, 6: 1, 38: 1, 98: 1, 99: 1, 100: 1, 101: 1, 120: 1, 121: 1, 122: 1, 123: 1, 124: 1, 125: 1, 126: 1, 127: 1 };
  function learnCapture(st, ch, d) {
    var m = null;
    if (st === 0xB0 && !SKIP_LEARN_CC[d[1]] && d[2] > 0) m = { t: 'cc', ch: ch, n: d[1] };
    else if (st === 0xC0) m = { t: 'pc', ch: ch, n: d[1] };
    else if (st === 0x90 && d[2] > 0) m = { t: 'note', ch: ch, n: d[1] };
    if (!m) return;
    var id = learn.id;
    learnStop();
    // satu pesan hanya untuk satu aksi
    for (var k in V.remote.map) { var o = V.remote.map[k]; if (o && o.t === m.t && o.ch === m.ch && o.n === m.n && k !== id) { delete V.remote.map[k]; note(T('Dipindah dari ', 'Moved from ') + (actById(k) || [, k])[1]); } }
    V.remote.map[id] = m;
    if (m.t === 'cc') { ccState[m.ch + '_' + m.n] = d[2]; }
    persist();
    renderRemote(id);
    var w = mapWarn(m);
    note((actById(id) || [, id])[1] + ' = ' + mapText(m) + (w ? ' ⚠' : ''));
  }
  function learnStart(id) {
    learnStop();
    if (typeof midiAccess === 'undefined' || !midiAccess) { note(T('MIDI belum aktif. Sambungkan keyboard dulu.', 'MIDI not active yet. Connect the keyboard first.')); return; }
    if (!attachMidiInputs()) { note(T('Tidak ada MIDI IN dari keyboard. Kontrol dari keyboard butuh pesan masuk.', 'No MIDI IN from the keyboard. Keyboard control needs incoming messages.')); return; }
    learn = { id: id, timer: setTimeout(function () { learnStop(); renderRemote(); note(T('Learn berakhir: tidak ada pesan dari keyboard', 'Learn ended: nothing received from the keyboard')); }, 15000) };
    renderRemote();
  }
  function learnStop() { if (learn) { clearTimeout(learn.timer); learn = null; } }
  function remoteCount() { var n = 0; for (var k in V.remote.map) if (V.remote.map[k]) n++; return n; }
  function openRemote() {
    var m = $('rmModal');
    if (!m) {
      m = el('div', 'v9-modal v9-hide'); m.id = 'rmModal';
      document.body.appendChild(m);
      m.addEventListener('click', function (e) {
        if (e.target === m) { closeRemote(); return; }
        var b = e.target.closest('[data-rm]'); if (!b) return;
        var a = b.dataset.rm, id = b.dataset.id;
        if (a === 'close') closeRemote();
        else if (a === 'learn') { if (learn && learn.id === id) { learnStop(); renderRemote(); } else learnStart(id); }
        else if (a === 'clear') { delete V.remote.map[id]; persist(); renderRemote(); }
        else if (a === 'toggle') { V.remote.on = !V.remote.on; persist(); renderRemote(); renderSettings(); }
        else if (a === 'clearall') { mrAsk(T('Hapus semua kontrol dari keyboard?', 'Remove every keyboard control?'), function () { V.remote.map = {}; persist(); renderRemote(); }, { danger: true }); }
        else if (a === 'help') { closeRemote(); if (window.openGuide) openGuide('remote'); }
      });
    }
    m.classList.remove('v9-hide');
    renderRemote();
  }
  function closeRemote() { learnStop(); var m = $('rmModal'); if (m) m.classList.add('v9-hide'); renderSettings(); }
  function renderRemote(justId) {
    var m = $('rmModal'); if (!m || m.classList.contains('v9-hide')) return;
    var rows = ACTIONS.map(function (a) {
      var mp = V.remote.map[a[0]], w = mapWarn(mp), lr = learn && learn.id === a[0];
      return '<div class="rm-row' + (lr ? ' learning' : '') + (justId === a[0] ? ' just' : '') + '"><span class="rm-act">' + esc(en() ? a[2] : a[1]) + '</span>' +
        '<span class="rm-map' + (mp ? ' set' : '') + '">' + (lr ? T('Injak pedal / tekan tombol di keyboard…', 'Press a pedal / button on the keyboard…') : esc(mapText(mp))) + '</span>' +
        '<button type="button" class="v9-btn' + (lr ? ' pri' : '') + '" data-rm="learn" data-id="' + a[0] + '">' + (lr ? T('BATAL', 'CANCEL') : 'LEARN') + '</button>' +
        '<button type="button" class="v9-btn sm" data-rm="clear" data-id="' + a[0] + '"' + (mp ? '' : ' disabled') + ' aria-label="Hapus">✕</button>' +
        (w ? '<div class="rm-warn">⚠ ' + esc(w) + '</div>' : '') + '</div>';
    }).join('');
    m.innerHTML = '<div class="v9-card"><div class="v9-head"><b>' + T('KONTROL DARI KEYBOARD', 'KEYBOARD CONTROL') + '</b><button type="button" class="v9-x" data-rm="close">✕</button></div>' +
      '<p class="v9-p">' + T('Pasang pedal atau tombol keyboard untuk menjalankan aksi aplikasi tanpa menyentuh layar (tetap jalan saat layar dikunci). Tekan LEARN, lalu injak pedal / tekan tombol di keyboard. Pakai pedal tipe <b>momentary</b> yang mengirim CC (mis. CC 66, 67, 80-83).', 'Assign a pedal or keyboard button to run app actions without touching the screen (still works while the screen is locked). Press LEARN, then press a pedal / button on the keyboard. Use a <b>momentary</b> pedal that sends CC (e.g. CC 66, 67, 80-83).') + '</p>' +
      '<div class="v9-row"><button type="button" class="v9-btn' + (V.remote.on ? ' pri' : '') + '" data-rm="toggle">' + T('Kontrol dari keyboard: ', 'Keyboard control: ') + (V.remote.on ? 'ON' : 'OFF') + '</button><span class="v9-sp"></span><button type="button" class="v9-btn" data-rm="help">?</button><button type="button" class="v9-btn bad" data-rm="clearall">' + T('HAPUS SEMUA', 'CLEAR ALL') + '</button></div>' +
      '<div class="rm-list">' + rows + '</div></div>';
  }
  window.mrOpenRemote = openRemote;

  /* =================================================================
     3b) KUNCI LAYAR
     ================================================================= */
  var locked = false, holdT = null, holdIv = null;
  function lockUi() {
    var o = $('lkOv');
    if (!o) {
      o = el('div', 'lk-ov'); o.id = 'lkOv';
      o.innerHTML = '<div class="lk-bar"><span class="lk-ico">🔒</span><div class="lk-txt"><b id="lkTitle"></b><small id="lkInfo"></small></div>' +
        '<button type="button" class="lk-panic" id="lkPanic">PANIC</button>' +
        '<button type="button" class="lk-hold" id="lkHold"><i id="lkFill"></i><span id="lkHoldTxt"></span></button></div>';
      document.body.appendChild(o);
      var stop = function (e) { e.preventDefault(); e.stopPropagation(); };
      ['pointerdown', 'pointerup', 'click', 'touchstart', 'touchend', 'contextmenu', 'wheel'].forEach(function (n) {
        o.addEventListener(n, function (e) { if (!e.target.closest('#lkHold, #lkPanic')) stop(e); }, { passive: false });
      });
      $('lkPanic').addEventListener('pointerdown', function (e) { e.preventDefault(); if (window.MRPRO) MRPRO.panic(); });
      var hb = $('lkHold');
      hb.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        try { hb.setPointerCapture(e.pointerId); } catch (x) {}
        var t0 = performance.now();
        clearInterval(holdIv);
        holdIv = setInterval(function () {
          var p = cl((performance.now() - t0) / 2000, 0, 1);
          $('lkFill').style.width = (p * 100) + '%';
          if (p >= 1) { clearInterval(holdIv); holdIv = null; setLock(false); try { navigator.vibrate && navigator.vibrate(30); } catch (x) {} }
        }, 30);
      });
      var cancel = function () { if (holdIv) { clearInterval(holdIv); holdIv = null; } var f = $('lkFill'); if (f) f.style.width = '0%'; };
      ['pointerup', 'pointercancel', 'lostpointercapture', 'pointerleave'].forEach(function (n) { hb.addEventListener(n, cancel); });
      hb.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    }
    $('lkTitle').textContent = T('LAYAR TERKUNCI', 'SCREEN LOCKED');
    $('lkHoldTxt').textContent = T('TAHAN 2 DTK UNTUK BUKA', 'HOLD 2 S TO UNLOCK');
    return o;
  }
  function lockInfo() {
    var i = $('lkInfo'); if (!i) return;
    var parts = [];
    try { var tl = voiceTiles.find(function (x) { return x.id === activeTileId; }); if (tl) parts.push(tl.name); } catch (e) {}
    try { if (window.MRKSET && MRKSET.state.lastAction === 'kset') { var k = MRKSET.state.list.filter(function (x) { return x.id === MRKSET.state.activeId; })[0]; if (k) parts.push('KBD SET ' + k.name); } } catch (e) {}
    try { var sn = $('proSongName'); if (sn && sn.textContent && sn.textContent !== 'SETLIST') parts.push(sn.textContent); } catch (e) {}
    if (V.remote.on && remoteCount()) parts.push(T('kontrol keyboard aktif', 'keyboard control on'));
    i.textContent = parts.join(' · ');
  }
  var lockInfoT = null;
  function setLock(on) {
    locked = !!on;
    var o = lockUi();
    o.classList.toggle('on', locked);
    document.body.classList.toggle('mr-locked', locked);
    clearInterval(lockInfoT);
    if (locked) {
      try { releaseAllVk(); } catch (e) {}
      ['settingsModal', 'tileModal'].forEach(function (id) { var m = $(id); if (m) m.classList.add('hidden'); });
      lockInfo(); lockInfoT = setInterval(lockInfo, 1000);
      note(T('Layar dikunci. Tahan tombol 2 detik untuk membuka.', 'Screen locked. Hold the button 2 seconds to unlock.'));
    } else note(T('Layar dibuka', 'Screen unlocked'));
    var b = $('mrLockBtn'); if (b) b.classList.toggle('on', locked);
  }
  window.mrLock = setLock;
  window.mrIsLocked = function () { return locked; };

  /* =================================================================
     3c) PENGINGAT BACKUP
     ================================================================= */
  var BK_KEY = 'MR_V9_BACKUP';
  var BK = { days: 7, last: 0, snooze: 0, changed: 0 };
  try { var b0 = JSON.parse(lsGet(BK_KEY) || '{}'); if (b0 && typeof b0 === 'object') { BK.days = [0, 1, 3, 7, 14, 30].indexOf(b0.days) >= 0 ? b0.days : 7; BK.last = +b0.last || 0; BK.snooze = +b0.snooze || 0; BK.changed = +b0.changed || 0; BK.lastCloud = +b0.lastCloud || 0; } } catch (e) {}
  if (!BK.last) BK.last = Date.now();     // pengguna baru: hitung mulai sekarang (tidak langsung diingatkan)
  function bkSave() { lsSet(BK_KEY, JSON.stringify(BK)); }
  bkSave();
  window.mrOnBackup = function (how) { BK.last = Date.now(); if (how === 'cloud') BK.lastCloud = BK.last; BK.snooze = 0; bkSave(); renderSettings(); var m = $('bkModal'); if (m) m.classList.add('v9-hide'); };
  // Backup cloud otomatis: sekali sehari saat online, login, dan ada perubahan sejak backup terakhir
  function autoCloudCheck() {
    try {
      if (!V.autoCloud || document.hidden || (navigator.onLine === false)) return;
      var u = (typeof auth !== 'undefined') ? auth.currentUser : null; if (!u) return;
      if (!(BK.changed && BK.changed > BK.last)) return;
      if (Date.now() - (BK.lastCloud || 0) < 20 * 3600000) return;
      if (!window.MRPRO || !MRPRO.cloudSave) return;
      BK.lastCloud = Date.now(); bkSave();
      Promise.resolve(MRPRO.cloudSave()).then(function (ok) { if (ok) note(T('Backup cloud otomatis tersimpan', 'Automatic cloud backup saved')); });
    } catch (e) {}
  }
  window.addEventListener('online', function () { setTimeout(autoCloudCheck, 5000); });
  var _save = window.saveLocalStoragePreset;
  var bkMarkT = null;
  if (typeof _save === 'function') window.saveLocalStoragePreset = function () {
    var r = _save.apply(this, arguments);
    if (!bkMarkT) bkMarkT = setTimeout(function () { bkMarkT = null; BK.changed = Date.now(); bkSave(); }, 1500);
    return r;
  };
  var _export = window.exportPresets;
  if (typeof _export === 'function') window.exportPresets = function () { var r = _export.apply(this, arguments); window.mrOnBackup('file'); return r; };
  function daysSince(ts) { return Math.floor((Date.now() - ts) / 86400000); }
  function bkDue() {
    if (!BK.days) return false;
    if (Date.now() < BK.snooze) return false;
    if (BK.changed && BK.changed < BK.last) return false;      // tidak ada perubahan sejak backup terakhir
    return Date.now() - BK.last >= BK.days * 86400000;
  }
  function bkCheck() {
    if (locked || document.hidden) return;
    var auth0 = $('authModal'); if (auth0 && !auth0.classList.contains('hidden')) return;
    if ($('kbPick') && !$('kbPick').classList.contains('kbp-hide')) return;
    if (bkDue()) bkShow();
  }
  function bkShow() {
    var m = $('bkModal');
    if (!m) {
      m = el('div', 'v9-modal v9-hide'); m.id = 'bkModal';
      document.body.appendChild(m);
      m.addEventListener('click', function (e) {
        var b = e.target.closest('[data-bk]'); if (!b) { if (e.target === m) bkLater(); return; }
        var a = b.dataset.bk;
        if (a === 'cloud') {
          b.disabled = true; b.textContent = T('MENYIMPAN…', 'SAVING…');
          var p = (window.MRPRO && MRPRO.cloudSave) ? MRPRO.cloudSave() : null;
          Promise.resolve(p).then(function (ok) {
            if (ok) note(T('Backup cloud tersimpan', 'Cloud backup saved'));
            else { var s = $('proCloudStatus'); note(T('Gagal simpan ke cloud', 'Cloud save failed') + (s && s.textContent ? ': ' + s.textContent : '')); b.disabled = false; b.textContent = T('SIMPAN KE CLOUD', 'SAVE TO CLOUD'); }
          });
        } else if (a === 'file') { try { exportPresets(); } catch (x) {} }
        else if (a === 'later') bkLater();
      });
    }
    var d = daysSince(BK.last);
    m.innerHTML = '<div class="v9-card sm"><div class="v9-head"><b>💾 ' + T('WAKTUNYA BACKUP', 'TIME TO BACK UP') + '</b></div>' +
      '<p class="v9-p">' + T('Sudah ' + d + ' hari sejak backup terakhir, dan ada perubahan (voice, REG, setlist, Performance). Simpan sekarang supaya data aman bila HP hilang atau rusak.', d + ' days since the last backup, and there are changes (voices, REG, setlist, Performances). Save now so your data is safe if the phone is lost or broken.') + '</p>' +
      '<div class="v9-row wrap"><button type="button" class="v9-btn pri" data-bk="cloud">' + T('SIMPAN KE CLOUD', 'SAVE TO CLOUD') + '</button><button type="button" class="v9-btn" data-bk="file">' + T('EXPORT FILE', 'EXPORT FILE') + '</button><span class="v9-sp"></span><button type="button" class="v9-btn" data-bk="later">' + T('NANTI', 'LATER') + '</button></div>' +
      '<p class="v9-p dim">' + T('Interval pengingat bisa diubah di Pengaturan › Pengingat backup.', 'Change the interval in Settings › Backup reminder.') + '</p></div>';
    m.classList.remove('v9-hide');
  }
  function bkLater() { BK.snooze = Date.now() + 86400000; bkSave(); var m = $('bkModal'); if (m) m.classList.add('v9-hide'); }
  function bkSetDays(d) { d = parseInt(d, 10); BK.days = [0, 1, 3, 7, 14, 30].indexOf(d) >= 0 ? d : 7; BK.snooze = 0; bkSave(); renderSettings(); }

  /* =================================================================
     4) GRAFIS
     ================================================================= */
  var LV = ['low', 'medium', 'high', 'ultra'];
  var gfxEff = 'high', gfxCool = 0;
  function lvName(l) { return { low: 'Low', medium: 'Medium', high: 'High', ultra: 'Ultra', auto: T('Otomatis', 'Auto') }[l] || l; }
  function applyLevel(lv) {
    gfxEff = lv;
    var h = document.documentElement;
    LV.forEach(function (x) { h.classList.toggle('gfx-' + x, x === lv); });
    try { currentFps = lv === 'low' ? 30 : (lv === 'medium' ? 60 : 120); } catch (e) {}
    window.__mrFpsCap = lv === 'high' ? 120 : 0;
    try { kickAnimation(); } catch (e) {}
    renderGfxNow();
  }
  window.mrGfxSlow = function () { return gfxEff === 'low'; };
  window.mrSetGfx = function (mode) {
    if (['auto'].concat(LV).indexOf(mode) < 0) mode = 'auto';
    V.gfx.mode = mode;
    fr.bad = 0; lagBad = 0;
    applyLevel(mode === 'auto' ? 'high' : mode);
    var s = $('settingGfx'); if (s) s.value = mode;
    persist();
  };
  function downgrade(why) {
    if (V.gfx.mode !== 'auto') return;
    var now = performance.now();
    if (now < gfxCool) return;
    var i = LV.indexOf(gfxEff);
    if (i <= 0) return;
    var next = LV[Math.min(i - 1, 1)];          // ultra/high -> medium -> low
    gfxCool = now + 15000;
    applyLevel(next);
    note(T('Grafis otomatis turun ke ', 'Graphics lowered to ') + lvName(next) + T(' (HP terasa berat)', ' (device is struggling)'));
  }
  // frame dari animasi slider (index.html memanggil mrGfxFrame tiap frame yang digambar)
  var fr = { n: 0, t0: 0, last: 0, bad: 0 };
  window.mrGfxFrame = function (now) {
    if (V.gfx.mode !== 'auto') return;
    if (!fr.t0 || now - fr.last > 250) { fr.t0 = now; fr.n = 0; }
    fr.n++; fr.last = now;
    var dt = now - fr.t0;
    if (dt >= 1000) {
      var fps = fr.n * 1000 / dt, want = Math.min(currentFps || 60, 60);
      if (fps < want * 0.6) fr.bad++; else fr.bad = Math.max(0, fr.bad - 1);
      fr.t0 = now; fr.n = 0;
      if (fr.bad >= 2) { fr.bad = 0; downgrade('fps'); }
    }
  };
  // probe beban main thread: keterlambatan timer (ringan, jalan terus)
  var lagBad = 0, probeLast = performance.now(), probeMs = 500, lagSum = 0, lagWin0 = performance.now(), cpuEst = 0, longSum = 0;
  function probe() {
    var now = performance.now(), lag = Math.max(0, now - probeLast - probeMs);
    probeLast = now;
    if (!document.hidden) {
      lagSum += lag;
      if (V.gfx.mode === 'auto' && probeMs === 500) {
        if (lag > 120) lagBad++; else lagBad = Math.max(0, lagBad - 0.5);
        if (lagBad >= 4) { lagBad = 0; downgrade('lag'); }
      }
      var w = now - lagWin0;
      if (w >= 1000) { cpuEst = cl(Math.round(((lagSum + longSum) / w) * 100), 0, 99); lagSum = 0; longSum = 0; lagWin0 = now; }
    } else { lagSum = 0; longSum = 0; lagWin0 = now; }
    setTimeout(probe, probeMs);
  }
  setTimeout(probe, probeMs);
  document.addEventListener('visibilitychange', function () { probeLast = performance.now(); fr.t0 = 0; });
  try {
    if (window.PerformanceObserver && PerformanceObserver.supportedEntryTypes && PerformanceObserver.supportedEntryTypes.indexOf('longtask') >= 0) {
      new PerformanceObserver(function (list) { list.getEntries().forEach(function (en0) { longSum += Math.max(0, en0.duration - 50); }); }).observe({ entryTypes: ['longtask'] });
    }
  } catch (e) {}
  // indikator beban
  var meterRaf = null, meterFrames = 0, meterT0 = 0, meterFps = 0, meterUiT = null;
  function meterLoop(now) {
    meterFrames++;
    if (!meterT0) meterT0 = now;
    if (now - meterT0 >= 1000) { meterFps = Math.round(meterFrames * 1000 / (now - meterT0)); meterFrames = 0; meterT0 = now; }
    meterRaf = requestAnimationFrame(meterLoop);
  }
  function meterShow(on) {
    var m = $('gfxMeter');
    if (on) {
      if (!m) { m = el('div', 'gfx-meter'); m.id = 'gfxMeter'; document.body.appendChild(m); m.addEventListener('click', function () { window.mrToggleGfxMeter(); }); }
      m.style.display = '';
      probeMs = 100;
      if (!meterRaf) { meterT0 = 0; meterFrames = 0; meterRaf = requestAnimationFrame(meterLoop); }
      clearInterval(meterUiT);
      meterUiT = setInterval(function () {
        var cls = cpuEst > 60 ? 'bad' : (cpuEst > 30 ? 'mid' : 'ok');
        m.className = 'gfx-meter ' + cls;
        m.innerHTML = '<b>CPU ~' + cpuEst + '%</b><span>' + meterFps + ' FPS</span><em>' + lvName(gfxEff).toUpperCase() + (V.gfx.mode === 'auto' ? ' · AUTO' : '') + '</em>';
      }, 500);
    } else {
      if (m) m.style.display = 'none';
      probeMs = 500;
      if (meterRaf) cancelAnimationFrame(meterRaf); meterRaf = null;
      clearInterval(meterUiT); meterUiT = null;
    }
  }
  window.mrToggleGfxMeter = function () { V.gfx.meter = !V.gfx.meter; meterShow(V.gfx.meter); renderGfxNow(); persist(); };
  function renderGfxNow() {
    var n = $('gfxNow'); if (n) n.textContent = T('Sekarang: ', 'Now: ') + lvName(gfxEff) + ' · ' + (gfxEff === 'ultra' ? T('tanpa batas fps', 'no fps cap') : T('maks ', 'max ') + (gfxEff === 'low' ? 30 : gfxEff === 'medium' ? 60 : 120) + ' fps');
    var b = $('gfxMeterBtn'); if (b) { b.textContent = T('Indikator beban: ', 'Load meter: ') + (V.gfx.meter ? 'ON' : 'OFF'); b.classList.toggle('on', V.gfx.meter); }
    var s = $('settingGfx'); if (s && s.value !== V.gfx.mode) s.value = V.gfx.mode;
  }

  /* =================================================================
     5) VERSI & UPDATE
     ================================================================= */
  function cmpVer(a, b) {
    var x = String(a || '0').split('.'), y = String(b || '0').split('.');
    for (var i = 0; i < Math.max(x.length, y.length); i++) { var d = (parseInt(x[i], 10) || 0) - (parseInt(y[i], 10) || 0); if (d) return d > 0 ? 1 : -1; }
    return 0;
  }
  var updLast = 0, swHadController = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
  function updBanner(ver) {
    var b = $('updBanner');
    if (!b) {
      b = el('div', 'upd-banner'); b.id = 'updBanner';
      document.body.appendChild(b);
      b.addEventListener('click', function (e) {
        var a = e.target.closest('[data-up]'); if (!a) return;
        if (a.dataset.up === 'reload') {
          a.textContent = T('MEMUAT…', 'LOADING…');
          var go = function () { location.reload(); };
          try { if (navigator.serviceWorker) navigator.serviceWorker.getRegistration().then(function (r) { if (r) return r.update(); }).then(go, go); else go(); } catch (x) { go(); }
          setTimeout(go, 2500);
        } else b.classList.remove('show');
      });
    }
    b.innerHTML = '<span>⬆ ' + T('Versi baru tersedia', 'New version available') + (ver ? ' <b>' + esc(ver) + '</b>' : '') + '</span><button type="button" data-up="reload">' + T('MUAT ULANG', 'RELOAD') + '</button><button type="button" class="x" data-up="x" aria-label="Tutup">✕</button>';
    b.classList.add('show');
  }
  function checkUpdate(manual) {
    updLast = Date.now();
    try { if (navigator.serviceWorker) navigator.serviceWorker.getRegistration().then(function (r) { if (r) r.update().catch(function () {}); }).catch(function () {}); } catch (e) {}
    var cur = String(window.MR_VERSION || '0');
    return fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (j) {
      var rv = String((j && j.version) || '');
      if (rv && cmpVer(rv, cur) > 0) { updBanner(rv); return 'new'; }
      if (manual) note(T('Sudah versi terbaru (', 'Already up to date (') + cur + ')');
      return 'same';
    }).catch(function () { if (manual) note(T('Gagal cek update. Periksa internet.', 'Update check failed. Check the internet connection.')); return 'fail'; });
  }
  // Menu update dimatikan (update hanya untuk pelanggan; metode distribusi menyusul). Fungsi tetap ada untuk pengujian.
  if (navigator.serviceWorker) {
    try {
      navigator.serviceWorker.addEventListener('controllerchange', function () { if (swHadController) { try { updBanner(''); } catch (e) {} } swHadController = true; });
    } catch (e) {}
  }

  /* =================================================================
     6) KONEKSI: Cek Keyboard, bunyi koneksi, pulih dari latar belakang
     ================================================================= */
  var MFR = { 0x42: 'KORG', 0x43: 'YAMAHA', 0x41: 'ROLAND', 0x44: 'CASIO', 0x40: 'KAWAI', 0x47: 'AKAI', 0x26: 'KETRON' };
  var MFR_BRAND = { KORG: 'korg', YAMAHA: 'yamaha', ROLAND: 'roland' };
  var inquiry = null;   // hasil terakhir { name, brand, fam, mem, ver }
  function hex2(n) { return ('0' + (n & 0x7F).toString(16).toUpperCase()).slice(-2); }
  window.mrDeviceInquiry = function (cb) {
    var done = function (r) { if (cb) { try { cb(r); } catch (e) {} } };
    if (!selectedMidiOutput) { note(T('Belum ada MIDI Out terhubung', 'No MIDI Out connected')); done(null); return; }
    if (window.__sysexBlocked) { note(T('SysEx ditolak browser: Cek Keyboard tidak bisa dipakai', 'SysEx denied by the browser: Check Keyboard unavailable')); done(null); return; }
    if (!attachMidiInputs()) { note(T('Cek Keyboard butuh MIDI IN dari keyboard', 'Check Keyboard needs MIDI IN from the keyboard')); done(null); return; }
    var off = null, timer = null;
    off = window.onMidiInput(function (e) {
      var d = e.data;
      if (!d || d[0] !== 0xF0 || d[1] !== 0x7E || d[3] !== 0x06 || d[4] !== 0x02) return;
      off(); clearTimeout(timer);
      var i = 5, id = d[5], name;
      if (id === 0) { name = 'ID 00 ' + hex2(d[6]) + ' ' + hex2(d[7]); i = 8; } else { name = MFR[id] || ('ID ' + hex2(id)); i = 6; }
      var fam = (d[i] | 0) + ((d[i + 1] | 0) << 7), mem = (d[i + 2] | 0) + ((d[i + 3] | 0) << 7);
      var ver = Array.prototype.slice.call(d, i + 4, i + 8).map(function (x) { return x | 0; }).join('.');
      inquiry = { name: name, brand: MFR_BRAND[name] || '', fam: fam, mem: mem, ver: ver, at: Date.now() };
      note(T('Keyboard terdeteksi: ', 'Keyboard found: ') + name + ' (family ' + fam + ', model ' + mem + ')');
      try { renderMidiDiag(); } catch (x) {}
      var cm = curModel();
      if (inquiry.brand && (!cm || cm.brand !== inquiry.brand) && !cb) {
        setTimeout(function () {
          mrAsk(T('Keyboard terdeteksi: ' + name + '. Model yang dipilih: ' + shortName() + '. Buka pemilih model ' + name + '?', 'Keyboard found: ' + name + '. Selected model: ' + shortName() + '. Open the ' + name + ' model picker?'), function () { window.mrOpenKbPicker({ brand: inquiry.brand }); });
        }, 200);
      }
      done(inquiry);
    });
    timer = setTimeout(function () {
      off();
      inquiry = { name: '', none: true, at: Date.now() };
      note(T('Keyboard tidak menjawab. Bisa jadi tidak mendukung Device Inquiry, SysEx difilter, atau MIDI IN tidak tersambung.', 'The keyboard did not answer. It may not support Device Inquiry, SysEx may be filtered, or MIDI IN is not connected.'));
      try { renderMidiDiag(); } catch (x) {}
      done(null);
    }, 2500);
    sendMidiMessage([0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7]);
    note(T('Bertanya identitas keyboard…', 'Asking the keyboard for its identity…'));
  };
  window.mrDiagExtra = function () {
    var L = [];
    var cm = curModel();
    L.push(T('Model dipilih: ', 'Selected model: ') + '<b>' + esc(shortName(cm)) + '</b> · Style: ' + esc(stLabel(styleMode())));
    if (inquiry) L.push(inquiry.none ? T('Cek Keyboard: tidak ada jawaban', 'Check Keyboard: no answer') : T('Cek Keyboard: ', 'Check Keyboard: ') + '<b class="dg-ok">' + esc(inquiry.name) + '</b> · family ' + inquiry.fam + ' · model ' + inquiry.mem + ' · v' + esc(inquiry.ver));
    return L;
  };

  // ---------- bunyi & getar koneksi ----------
  var actx = null;
  function unlockAudio() {
    try {
      if (!actx) { var C = window.AudioContext || window.webkitAudioContext; if (C) actx = new C(); }
      if (actx && actx.state === 'suspended') actx.resume();
    } catch (e) {}
  }
  document.addEventListener('pointerdown', unlockAudio, { capture: true, passive: true });
  var SND_GAIN = [0, 0.05, 0.13, 0.28];
  function beep(freqs, dur) {
    var g0 = SND_GAIN[V.connSound] || 0;
    if (!g0 || !actx || actx.state !== 'running') return;
    try {
      var t = actx.currentTime;
      freqs.forEach(function (f, i) {
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        var s = t + i * dur;
        g.gain.setValueAtTime(0.0001, s);
        g.gain.exponentialRampToValueAtTime(g0, s + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, s + dur * 0.95);
        o.connect(g); g.connect(actx.destination);
        o.start(s); o.stop(s + dur);
      });
    } catch (e) {}
  }
  function connFeedback(up) {
    if (!V.connSound) return;
    if (up) beep([880, 1320], 0.09); else beep([660, 392], 0.14);
    try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(up ? [25, 45, 25] : [140]); } catch (e) {}
  }
  window.mrConnHook = function (real) { connFeedback(real); };
  var SND_NAMES = function () { return [T('OFF', 'OFF'), T('KECIL', 'LOW'), T('SEDANG', 'MEDIUM'), T('KERAS', 'LOUD')]; };
  window.mrCycleConnSound = function () {
    unlockAudio();
    V.connSound = (V.connSound + 1) % 4;
    persist(); renderConnBtn();
    setTimeout(function () { connFeedback(true); }, 30);
  };
  function renderConnBtn() { var b = $('connSoundBtn'); if (b) { b.textContent = T('Bunyi: ', 'Sound: ') + SND_NAMES()[V.connSound]; b.classList.toggle('on', V.connSound > 0); } }

  // ---------- pulih setelah layar terkunci / aplikasi di latar belakang ----------
  var hiddenAt = 0;
  function onResume() {
    if (document.hidden) { hiddenAt = Date.now(); try { if (window.MRPRO && MRPRO.state && MRPRO.state.susDown) MRPRO.susSet(false); } catch (e) {} return; }
    var away = hiddenAt ? Date.now() - hiddenAt : 0;
    hiddenAt = 0;
    if (!away) return;
    var wasReal = false; try { wasReal = __midiWasReal; } catch (e) {}
    try { if (midiAccess) rescanMidi(true); else initWebMidi(); } catch (e) {}
    if (away > 45000) {
      setTimeout(function () {
        try { if (__midiWasReal && wasReal) { mrResync(false); note(T('Kembali dari latar belakang: setelan dikirim ulang', 'Back from background: settings resent')); } } catch (e) {}
      }, 900);
    }
    setTimeout(bkCheck, 4000);
    setTimeout(autoCloudCheck, 8000);
  }
  document.addEventListener('visibilitychange', onResume);
  window.addEventListener('pageshow', function (e) { if (e.persisted) { hiddenAt = hiddenAt || (Date.now() - 60000); onResume(); } });
  document.addEventListener('freeze', function () { hiddenAt = Date.now(); });
  document.addEventListener('resume', onResume);

  /* =================================================================
     LAPORAN ERROR OTOMATIS (Firestore: error_logs). Maks 5 laporan per sesi, tanpa email.
     ================================================================= */
  var errSent = 0, errSeen = {};
  function logError(msg, stack, src) {
    try {
      if (!V.errLog || errSent >= 5) return;
      msg = String(msg || '').slice(0, 500);
      if (!msg || /ResizeObserver loop|^Script error\.?$|extension:\/\//.test(msg)) return;
      var key = msg.slice(0, 120); if (errSeen[key]) return; errSeen[key] = 1;
      var u = (typeof auth !== 'undefined') ? auth.currentUser : null; if (!u || typeof db === 'undefined') return;
      errSent++;
      var port = ''; try { port = (selectedMidiOutput && selectedMidiOutput.name) || ''; } catch (e) {}
      db.collection('error_logs').add({
        uid: u.uid, v: String(window.MR_VERSION || ''), msg: msg, stack: String(stack || '').slice(0, 1500), src: String(src || '').slice(0, 200),
        ua: String(navigator.userAgent || '').slice(0, 300), model: V.kb.model || '', view: document.body.classList.contains('pa-mode') ? 'pa' : 'classic',
        port: String(port).slice(0, 80), lang: en() ? 'en' : 'id', at: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(function () {});
    } catch (e) {}
  }
  window.mrLogError = logError;
  window.addEventListener('error', function (e) { logError(e.message, e.error && e.error.stack, (e.filename || '').split('/').pop() + ':' + e.lineno + ':' + e.colno); });
  window.addEventListener('unhandledrejection', function (e) { var r = e.reason; logError((r && r.message) || String(r), r && r.stack, 'promise'); });

  /* =================================================================
     PANDUAN SETUP 5 LANGKAH
     ================================================================= */
  var wz = { step: 0, timer: null, sent: false, inOk: null, inMsg: '', inq: null };
  function openWizard(step) {
    lsSet('mrWizardDone', '1');
    wz.step = step || 0; wz.sent = false; wz.inOk = null; wz.inMsg = '';
    var m = $('wzModal');
    if (!m) {
      m = el('div', 'v9-modal v9-hide wz'); m.id = 'wzModal';
      document.body.appendChild(m);
      m.addEventListener('click', onWzClick);
    }
    m.classList.remove('v9-hide');
    renderWizard();
    clearInterval(wz.timer);
    wz.timer = setInterval(function () { if (wz.step === 1 || wz.step === 3) renderWizardBody(); if ($('wzModal').classList.contains('v9-hide')) clearInterval(wz.timer); }, 1200);
  }
  window.mrOpenSetupWizard = function (s) { openWizard(s || 0); };
  function closeWizard() { var m = $('wzModal'); if (m) m.classList.add('v9-hide'); clearInterval(wz.timer); if (wz.inOff) { wz.inOff(); wz.inOff = null; } }
  var WZ_STEPS = function () { return [T('Keyboard', 'Keyboard'), T('Kabel', 'Cable'), T('Channel', 'Channels'), T('Tes', 'Test'), T('Selesai', 'Done')]; };
  function renderWizard() {
    var m = $('wzModal'); if (!m) return;
    var steps = WZ_STEPS();
    m.innerHTML = '<div class="v9-card wide"><div class="v9-head"><b>' + T('PANDUAN SETUP', 'SETUP GUIDE') + '</b><button type="button" class="v9-x" data-wz="close">✕</button></div>' +
      '<div class="wz-steps">' + steps.map(function (s, i) { return '<button type="button" class="wz-st' + (i === wz.step ? ' on' : '') + (i < wz.step ? ' done' : '') + '" data-wz="go" data-i="' + i + '"><i>' + (i < wz.step ? '✓' : i + 1) + '</i><span>' + s + '</span></button>'; }).join('') + '</div>' +
      '<div class="wz-body" id="wzBody"></div>' +
      '<div class="v9-row"><button type="button" class="v9-btn" data-wz="prev"' + (wz.step ? '' : ' disabled') + '>◀ ' + T('KEMBALI', 'BACK') + '</button><span class="v9-sp"></span>' +
      (wz.step < 4 ? '<button type="button" class="v9-btn pri" data-wz="next">' + T('LANJUT', 'NEXT') + ' ▶</button>' : '<button type="button" class="v9-btn pri" data-wz="close">' + T('SELESAI', 'FINISH') + ' ✓</button>') + '</div></div>';
    renderWizardBody();
  }
  function portsHtml() {
    var outs = [], ins = [];
    try { outs = midiList(midiAccess && midiAccess.outputs).filter(function (o) { return o.state !== 'disconnected'; }); ins = midiList(midiAccess && midiAccess.inputs).filter(function (o) { return o.state !== 'disconnected'; }); } catch (e) {}
    var real = false; try { real = midiIsReal(selectedMidiOutput); } catch (e) {}
    return '<div class="wz-status ' + (real ? 'ok' : 'bad') + '"><b>' + (real ? '● ' + T('TERSAMBUNG', 'CONNECTED') : '○ ' + T('BELUM TERSAMBUNG', 'NOT CONNECTED')) + '</b>' +
      '<span>OUT: ' + (outs.length ? outs.map(function (o) { return esc(o.name || '?'); }).join(', ') : '–') + '</span><span>IN: ' + (ins.length ? ins.map(function (o) { return esc(o.name || '?'); }).join(', ') : '–') + '</span>' +
      '<button type="button" class="v9-btn sm" data-wz="rescan">' + T('PINDAI ULANG', 'RESCAN') + '</button></div>';
  }
  function chanTable() {
    var u3 = upper3Channel > 0 ? upper3Channel : '–';
    return '<table class="wz-tbl"><tr><th>' + T('Bagian', 'Part') + '</th><th>' + T('Channel di aplikasi', 'App channel') + '</th></tr>' +
      '<tr><td>Upper 1 / Right 1</td><td>CH ' + globalChannel + '</td></tr><tr><td>Upper 2 / Right 2</td><td>CH ' + layerChannel + '</td></tr>' +
      '<tr><td>Upper 3 / Right 3</td><td>' + (u3 === '–' ? '–' : 'CH ' + u3) + '</td></tr><tr><td>Control (Style / PERFORMANCE)</td><td>CH ' + styleCtrlChannel + '</td></tr></table>';
  }
  function brandChannelSteps(b) {
    if (b === 'korg') return T('<ol><li>Tekan <b>GLOBAL › MIDI</b> (Pa600/700/1000: <b>GLOBAL › MIDI › MIDI In Channels</b>).</li><li>Isi channel <b>Upper 1, Upper 2, Upper 3</b> sama dengan tabel di bawah. Isi <b>Control</b> = channel Control.</li><li>Halaman <b>MIDI Out Channels</b>: isi sama (supaya tuts, akor, dan LEARN UPPER Performance terbaca aplikasi).</li><li><b>Filters</b>: pastikan Program Change, Control Change, dan SysEx tidak difilter.</li><li>Simpan dengan <b>Write Global</b> supaya tidak hilang saat keyboard dimatikan.</li></ol>',
      '<ol><li>Press <b>GLOBAL › MIDI</b> (Pa600/700/1000: <b>GLOBAL › MIDI › MIDI In Channels</b>).</li><li>Set <b>Upper 1, Upper 2, Upper 3</b> to the channels in the table below. Set <b>Control</b> = the Control channel.</li><li><b>MIDI Out Channels</b> page: set the same (so keys, chords and Performance LEARN UPPER reach the app).</li><li><b>Filters</b>: make sure Program Change, Control Change and SysEx are not filtered.</li><li>Save with <b>Write Global</b> so it survives power-off.</li></ol>');
    if (b === 'yamaha') return T('<ol><li>Buka <b>Menu › MIDI</b> (PSR-SX/Genos) lalu pilih template <b>Keyboard</b> atau <b>Off</b> (bukan Clavinova/All Parts) sebagai titik awal.</li><li>Halaman <b>Receive</b>: ubah Ch 1 = <b>RIGHT 1</b>, Ch 2 = <b>RIGHT 2</b>, Ch 3 = <b>RIGHT 3</b> (sesuai tabel). Port = USB.</li><li>Centang kolom <b>Note, CC, PC, PB</b> di halaman Receive.</li><li>Halaman <b>Transmit</b>: nyalakan RIGHT 1/2/3 dan LEFT supaya tuts &amp; akor terbaca aplikasi.</li><li>Style Play memakai SysEx Section Control: pastikan <b>System Exclusive</b> diterima (Receive › SysEx = ON).</li></ol>',
      '<ol><li>Open <b>Menu › MIDI</b> (PSR-SX/Genos) and pick the <b>Keyboard</b> or <b>Off</b> template (not Clavinova/All Parts) as a start.</li><li><b>Receive</b> page: set Ch 1 = <b>RIGHT 1</b>, Ch 2 = <b>RIGHT 2</b>, Ch 3 = <b>RIGHT 3</b> (see table). Port = USB.</li><li>Tick <b>Note, CC, PC, PB</b> on the Receive page.</li><li><b>Transmit</b> page: turn on RIGHT 1/2/3 and LEFT so keys &amp; chords reach the app.</li><li>Style Play uses SysEx Section Control: make sure <b>System Exclusive</b> is received.</li></ol>');
    if (b === 'roland') return T('<ol><li>Buka <b>Menu › System › MIDI</b> (E-A7/BK) atau <b>SYSTEM › MIDI</b> (FANTOM/JUNO).</li><li>Atur <b>Rx Channel</b> part Upper 1/2/3 sama dengan tabel. BK: <b>Basic/Control Channel</b> = channel Control.</li><li>Nyalakan <b>Rx Program Change, Rx Bank Select, Rx Exclusive</b>.</li><li>Nyalakan <b>Tx</b> untuk part keyboard supaya tuts &amp; akor terbaca aplikasi.</li><li>Simpan dengan <b>Write / System Write</b>.</li></ol>',
      '<ol><li>Open <b>Menu › System › MIDI</b> (E-A7/BK) or <b>SYSTEM › MIDI</b> (FANTOM/JUNO).</li><li>Set the <b>Rx Channel</b> of Upper 1/2/3 to the table. BK: <b>Basic/Control Channel</b> = the Control channel.</li><li>Turn on <b>Rx Program Change, Rx Bank Select, Rx Exclusive</b>.</li><li>Turn on <b>Tx</b> for the keyboard parts so keys &amp; chords reach the app.</li><li>Save with <b>Write / System Write</b>.</li></ol>');
    return T('<ol><li>Cari menu <b>MIDI</b> di keyboard / modul.</li><li>Samakan <b>channel terima</b> (Receive / Rx) dengan tabel.</li><li>Pastikan Bank Select, Program Change, Control Change, Pitch Bend, dan SysEx tidak diblokir.</li><li>Nyalakan <b>Local / Transmit</b> bila ingin tuts &amp; akor tampil di aplikasi.</li></ol>',
      '<ol><li>Find the <b>MIDI</b> menu on the keyboard / module.</li><li>Match the <b>receive channel</b> (Receive / Rx) to the table.</li><li>Make sure Bank Select, Program Change, Control Change, Pitch Bend and SysEx are not blocked.</li><li>Turn on <b>Transmit</b> if you want keys &amp; chords shown in the app.</li></ol>');
  }
  function renderWizardBody() {
    var b = $('wzBody'); if (!b) return;
    var cm = curModel(), brand = cm ? cm.brand : 'generic';
    var h = '';
    if (wz.step === 0) {
      h = '<h4>1 · ' + T('PILIH KEYBOARD', 'PICK THE KEYBOARD') + '</h4><p>' + T('Model menentukan channel, penomoran Program Change, SysEx quartertone, dan cara tombol Style Play bekerja.', 'The model decides channels, Program Change numbering, quartertone SysEx and how the Style Play buttons work.') + '</p>' +
        '<div class="wz-model"><b>' + esc(shortName(cm)) + '</b>' + (cm ? '<span>' + esc(profSummary(cm)) + '</span>' : '') + '<button type="button" class="v9-btn pri" data-wz="pick">' + (cm ? T('GANTI MODEL', 'CHANGE MODEL') : T('PILIH MODEL', 'PICK MODEL')) + '</button></div>';
    } else if (wz.step === 1) {
      h = '<h4>2 · ' + T('SAMBUNGKAN KABEL', 'CONNECT THE CABLE') + '</h4>' + portsHtml() + '<div class="wz-cards">' +
        '<div class="wz-c"><b>USB</b><p>' + T('Kabel USB dari port <b>USB TO HOST / USB Device</b> keyboard ke HP (Android: adaptor OTG; iPhone/iPad: adaptor kamera Lightning/USB-C). Satu kabel membawa MIDI IN &amp; OUT.', 'USB cable from the keyboard&rsquo;s <b>USB TO HOST / USB Device</b> port to the phone (Android: OTG adapter; iPhone/iPad: Lightning/USB-C camera adapter). One cable carries MIDI IN &amp; OUT.') + '</p></div>' +
        '<div class="wz-c"><b>MIDI 5-PIN</b><p>' + T('Interface USB-MIDI (UM-ONE, iRig, CME, dll.). Butuh 2 kabel: <b>OUT interface → MIDI IN keyboard</b> (kirim) dan <b>MIDI OUT keyboard → IN interface</b> (tuts, akor, rekam, kontrol pedal).', 'USB-MIDI interface (UM-ONE, iRig, CME, etc.). Needs 2 cables: <b>interface OUT → keyboard MIDI IN</b> (send) and <b>keyboard MIDI OUT → interface IN</b> (keys, chords, recording, pedal control).') + '</p></div>' +
        '<div class="wz-c"><b>BLUETOOTH</b><p>' + T('Adaptor BLE-MIDI (WIDI, dll.) atau Bluetooth MIDI bawaan keyboard. Android: pasangkan dari aplikasi pembuat adaptor dulu. iPhone: pasangkan lewat aplikasi Bluetooth MIDI, lalu buka aplikasi ini lagi.', 'BLE-MIDI adapter (WIDI, etc.) or built-in Bluetooth MIDI. Android: pair it from the adapter maker&rsquo;s app first. iPhone: pair through a Bluetooth MIDI app, then reopen this app.') + '</p></div></div>' +
        '<p class="dim">' + T('Pilih port keyboard di menu MIDI Out (header). Aplikasi memilih otomatis bila hanya ada satu.', 'Pick the keyboard port in the MIDI Out menu (header). The app picks it automatically when there is only one.') + '</p>';
    } else if (wz.step === 2) {
      h = '<h4>3 · ' + T('ATUR CHANNEL DI KEYBOARD', 'SET CHANNELS ON THE KEYBOARD') + ' (' + esc(brand === 'generic' ? T('MIDI umum', 'generic MIDI') : brandName(brand)) + ')</h4><div class="wz-two"><div>' + brandChannelSteps(brand) + '</div><div>' + chanTable() +
        '<p class="dim">' + T('Channel aplikasi bisa diubah di Pengaturan (Global / Layer / Upper 3 / Style Control Channel).', 'App channels can be changed in Settings (Global / Layer / Upper 3 / Style Control Channel).') + '</p></div></div>';
    } else if (wz.step === 3) {
      var ok = '<b class="dg-ok">✓</b> ', bad = '<b class="dg-bad">✗</b> ', wait = '<b>…</b> ';
      h = '<h4>4 · ' + T('TES', 'TEST') + '</h4>' + portsHtml() +
        '<div class="wz-tests">' +
        '<div class="wz-t"><button type="button" class="v9-btn pri" data-wz="c4">' + T('KIRIM C4', 'SEND C4') + '</button><span>' + (wz.sent ? ok + T('Terkirim. Keyboard harus berbunyi nada C4.', 'Sent. The keyboard should play a C4.') : T('Kirim nada C4 ke Upper 1.', 'Send a C4 note to Upper 1.')) + '</span></div>' +
        '<div class="wz-t"><button type="button" class="v9-btn pri" data-wz="in">' + T('TES IN', 'IN TEST') + '</button><span>' + (wz.inOk === true ? ok + esc(wz.inMsg) : wz.inOk === false ? bad + T('Tidak ada pesan masuk dalam 10 detik.', 'Nothing arrived within 10 seconds.') : wz.inOk === 0 ? wait + T('Tekan satu tuts di keyboard…', 'Press a key on the keyboard…') : T('Tekan TES IN lalu satu tuts di keyboard.', 'Press IN TEST, then a key on the keyboard.')) + '</span></div>' +
        '<div class="wz-t"><button type="button" class="v9-btn" data-wz="inq">' + T('CEK KEYBOARD', 'CHECK KEYBOARD') + '</button><span>' + (inquiry ? (inquiry.none ? bad + T('Tidak menjawab (tidak masalah bila C4 dan IN sudah OK).', 'No answer (fine if C4 and IN already work).') : ok + esc(inquiry.name) + ' · family ' + inquiry.fam + ' · model ' + inquiry.mem) : T('Tanya identitas keyboard (butuh SysEx).', 'Ask the keyboard for its identity (needs SysEx).')) + '</span></div></div>';
    } else {
      var real = false; try { real = midiIsReal(selectedMidiOutput); } catch (e) {}
      h = '<h4>5 · ' + T('SELESAI', 'DONE') + '</h4><ul class="wz-sum">' +
        '<li>' + T('Keyboard: ', 'Keyboard: ') + '<b>' + esc(shortName(cm)) + '</b></li>' +
        '<li>MIDI: ' + (real ? '<b class="dg-ok">' + esc(selectedMidiOutput.name || 'OK') + '</b>' : '<b class="dg-bad">' + T('belum tersambung', 'not connected') + '</b>') + '</li>' +
        '<li>Channel: Upper 1 = ' + globalChannel + ', Upper 2 = ' + layerChannel + ', Upper 3 = ' + (upper3Channel || '–') + ', Control = ' + styleCtrlChannel + '</li>' +
        '<li>' + T('Tes C4: ', 'C4 test: ') + (wz.sent ? 'OK' : '–') + ' · ' + T('Tes IN: ', 'IN test: ') + (wz.inOk === true ? 'OK' : '–') + '</li></ul>' +
        '<p>' + T('Berikutnya: pilih voice di tab VOICE, cari nomor Performance di tab PERFORMANCE, dan pasang pedal di Pengaturan › Kontrol dari keyboard.', 'Next: pick voices in the VOICE tab, find Performance numbers in the PERFORMANCE tab, and assign pedals in Settings › Keyboard control.') + '</p>' +
        '<div class="v9-row wrap"><button type="button" class="v9-btn pri" data-wz="vlib">📚 ' + T('LIBRARY VOICE', 'VOICE LIBRARY') + '</button><button type="button" class="v9-btn" data-wz="guide">' + T('BUKU PANDUAN', 'USER GUIDE') + '</button></div>';
    }
    b.innerHTML = h;
  }
  function onWzClick(e) {
    var m = $('wzModal');
    if (e.target === m) { closeWizard(); return; }
    var b = e.target.closest('[data-wz]'); if (!b) return;
    var a = b.dataset.wz;
    if (a === 'close') closeWizard();
    else if (a === 'next') { wz.step = Math.min(4, wz.step + 1); renderWizard(); }
    else if (a === 'prev') { wz.step = Math.max(0, wz.step - 1); renderWizard(); }
    else if (a === 'go') { wz.step = parseInt(b.dataset.i, 10) || 0; renderWizard(); }
    else if (a === 'pick') window.mrOpenKbPicker({ onDone: function () { renderWizard(); } });
    else if (a === 'rescan') { try { rescanMidi(true); } catch (x) {} setTimeout(renderWizardBody, 600); }
    else if (a === 'c4') { try { sendMidiTest(); wz.sent = !!selectedMidiOutput; } catch (x) {} renderWizardBody(); }
    else if (a === 'in') {
      try { if (!midiAccess || !attachMidiInputs()) { wz.inOk = false; renderWizardBody(); note(T('Tidak ada port MIDI IN', 'No MIDI IN port')); return; } } catch (x) { return; }
      if (wz.inOff) wz.inOff();
      wz.inOk = 0; renderWizardBody();
      var to = setTimeout(function () { if (wz.inOff) { wz.inOff(); wz.inOff = null; } wz.inOk = false; renderWizardBody(); }, 10000);
      wz.inOff = window.onMidiInput(function (ev) {
        if (wz.inOff) { wz.inOff(); wz.inOff = null; } clearTimeout(to);
        wz.inOk = true; wz.inMsg = 'MIDI IN OK: ' + midiDescribe(ev.data); renderWizardBody();
      });
    }
    else if (a === 'inq') window.mrDeviceInquiry(function () { renderWizardBody(); });
    else if (a === 'guide') { closeWizard(); if (window.openGuide) openGuide('wizard'); }
    else if (a === 'vlib') { closeWizard(); if (window.mrOpenVoiceLib) mrOpenVoiceLib(); }
  }

  /* =================================================================
     PENGATURAN (baris v9 di modal Pengaturan)
     ================================================================= */
  function row(label, desc, ctrl, sec) {
    return '<div class="v9-srow" data-sec="' + (sec || 'kb') + '"><div><span class="font-bold text-slate-200 block">' + label + '</span><span class="text-[10px] text-slate-400">' + desc + '</span></div>' + (ctrl ? '<div class="v9-sctl">' + ctrl + '</div>' : '') + '</div>';
  }
  function opt(v, t, cur) { return '<option value="' + v + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + t + '</option>'; }
  function renderSettings() {
    var host = $('v9Set'); if (!host) return;
    var cm = curModel();
    var sm = V.kb.styleMode || 'auto';
    var bkTxt = BK.last ? T('Backup terakhir: ', 'Last backup: ') + (daysSince(BK.last) === 0 ? T('hari ini', 'today') : daysSince(BK.last) + T(' hari lalu', ' days ago')) : '';
    host.innerHTML =
      row(T('Keyboard (merek &amp; model)', 'Keyboard (brand &amp; model)'), cm ? esc(profSummary(cm)) : T('Belum dipilih. Pilih supaya channel, PC, SysEx, dan Style Play cocok.', 'Not chosen yet. Pick one so channels, PC, SysEx and Style Play match.'),
        '<button type="button" class="v9-btn pri" data-v9="kb">' + esc(shortName(cm)) + '</button><button type="button" class="v9-btn" data-v9="wizard">' + T('PANDUAN SETUP', 'SETUP GUIDE') + '</button>', 'kb') +
      row(T('Library voice', 'Voice library'), T('Tambah voice tanpa mengetik angka: 128 voice GM2 + drum kit untuk semua keyboard, atau daftar sound model kamu.', 'Add voices without typing numbers: 128 GM2 voices + drum kits for any keyboard, or your model&rsquo;s sound list.'),
        '<button type="button" class="v9-btn pri" data-v9="vlib">📚 ' + T('BUKA', 'OPEN') + '</button>', 'kb') +
      row('Style Play', T('Cara tombol Style Play mengirim pesan. Otomatis = sesuai model.', 'How the Style Play buttons send messages. Auto = from the model.'),
        '<select class="set-select" data-v9="st">' + ST_MODES.map(function (s) { return opt(s, s === 'auto' ? T('Otomatis', 'Auto') + ' (' + stLabel(cm ? cm.p.st : 'korg') + ')' : stLabel(s), sm); }).join('') + '</select>', 'kb') +
      row(T('Tuts &amp; akor dari keyboard', 'Keys &amp; chords from the keyboard'), T('Nada dari MIDI IN menyalakan keyboard virtual (hijau) dan menampilkan nama akor. Hanya tampilan.', 'Notes from MIDI IN light the virtual keyboard (green) and show the chord name. Display only.'),
        '<button type="button" class="v9-btn' + (V.keysChord ? ' pri' : '') + '" data-v9="keys">' + (V.keysChord ? 'ON' : 'OFF') + '</button>', 'stage') +
      row(T('Kontrol dari keyboard', 'Keyboard control'), T('Pedal / tombol keyboard menjalankan Performance ◀▶, Setlist ◀▶, Voice ◀▶, PANIC, REG 1-8. ', 'Pedals / keyboard buttons run Performance ◀▶, Setlist ◀▶, Voice ◀▶, PANIC, REG 1-8. ') + remoteCount() + T(' aksi terpasang.', ' actions assigned.'),
        '<button type="button" class="v9-btn' + (V.remote.on ? ' pri' : '') + '" data-v9="rmtoggle">' + (V.remote.on ? 'ON' : 'OFF') + '</button><button type="button" class="v9-btn" data-v9="remote">' + T('ATUR…', 'SET UP…') + '</button>', 'stage') +
      row(T('Kunci layar panggung', 'Stage screen lock'), T('Mencegah sentuhan tak sengaja. Buka dengan menahan tombol 2 detik. PANIC dan kontrol dari keyboard tetap jalan.', 'Prevents accidental touches. Unlock by holding the button 2 seconds. PANIC and keyboard control keep working.'),
        '<button type="button" class="v9-btn" data-v9="lock">🔒 ' + T('KUNCI', 'LOCK') + '</button>', 'stage') +
      row(T('Data preset', 'Preset data'), T('Export / Import file JSON (voice, REG, setlist, Performance, semua setelan). Cloud = simpan ke akunmu.', 'Export / Import a JSON file (voices, REG, setlist, Performances, all settings). Cloud = save to your account.'),
        '<button type="button" class="v9-btn pri" data-v9="export">EXPORT</button><button type="button" class="v9-btn" data-v9="import">IMPORT</button><button type="button" class="v9-btn" data-v9="cloud">CLOUD</button>', 'data') +
      row(T('Backup cloud otomatis', 'Automatic cloud backup'), T('Sekali sehari saat online, hanya bila ada perubahan. ', 'Once a day when online, only if something changed. ') + (BK.lastCloud ? T('Terakhir: ', 'Last: ') + new Date(BK.lastCloud).toLocaleDateString(en() ? 'en-GB' : 'id-ID') : ''),
        '<button type="button" class="v9-btn' + (V.autoCloud ? ' pri' : '') + '" data-v9="autocloud">' + (V.autoCloud ? 'ON' : 'OFF') + '</button>', 'data') +
      row(T('Pengingat backup', 'Backup reminder'), esc(bkTxt),
        '<select class="set-select" data-v9="bk">' + [[0, T('Mati', 'Off')], [1, T('Tiap hari', 'Daily')], [3, T('Tiap 3 hari', 'Every 3 days')], [7, T('Tiap minggu', 'Weekly')], [14, T('Tiap 2 minggu', 'Every 2 weeks')], [30, T('Tiap bulan', 'Monthly')]].map(function (x) { return opt(x[0], x[1], BK.days); }).join('') + '</select>', 'data') +
      row(T('Akun', 'Account'), (function () { try { return esc((auth.currentUser && auth.currentUser.email) || '-'); } catch (e) { return '-'; } })(),
        '<button type="button" class="v9-btn bad" data-v9="logout">LOGOUT</button>', 'data') +
      row(T('Laporan error otomatis', 'Automatic error reports'), T('Bila aplikasi error, pesan teknis (tanpa email/data pribadi) dikirim ke pengembang supaya cepat diperbaiki.', 'When the app hits an error, a technical message (no email/personal data) is sent to the developer so it can be fixed fast.'),
        '<button type="button" class="v9-btn' + (V.errLog ? ' pri' : '') + '" data-v9="errlog">' + (V.errLog ? 'ON' : 'OFF') + '</button>', 'data') +
      row(T('Kebijakan Privasi', 'Privacy Policy'), T('Data apa yang disimpan aplikasi dan cara menghapusnya.', 'What data the app stores and how to delete it.'),
        '<button type="button" class="v9-btn" data-v9="privacy">' + T('BUKA', 'OPEN') + '</button>', 'data') +
      row(T('Versi aplikasi', 'App version'), 'MIDI ROYALE PRO <b>' + esc(window.MR_VERSION || '') + '</b> · KING TITU', '', 'data');
    renderGfxNow(); renderConnBtn();
    applySec();
  }
  // ---------- Pengaturan per bagian (sama untuk Klasik & Pa5X) ----------
  var SECS = [
    ['kb', '🎹', 'KEYBOARD & MIDI', 'KEYBOARD & MIDI'],
    ['view', '🎨', 'TAMPILAN', 'DISPLAY'],
    ['stage', '🎤', 'PANGGUNG', 'STAGE'],
    ['diag', '🔌', 'KONEKSI', 'CONNECTION'],
    ['data', '💾', 'DATA & INFO', 'DATA & INFO']
  ];
  var curSec = lsGet('mrSetSec') || 'kb';
  function setBody() { var h = $('v9Set'); return h ? h.parentElement : null; }
  function classifyRows() {
    var body = setBody(); if (!body) return;
    Array.prototype.forEach.call(body.children, function (r) {
      if (r.id === 'v9Set') return;
      var has = function (id) { return !!r.querySelector('#' + id); };
      var sec = 'kb';
      if (has('settingLang') || has('settingFontSize') || has('settingGfx') || has('settingViewMode') || has('settingMainMode') || has('settingKsColor') || has('settingKsSize') || has('tpDimRange') || r.querySelector('.tp-lcd') || has('themeSwatches') || has('hapticToggle')) sec = 'view';
      else if (has('midiDiagBox')) sec = 'diag';
      else if (has('settingGuideBtn')) sec = 'data';
      r.dataset.sec = sec;
    });
  }
  function applySec() {
    var body = setBody(); if (!body) return;
    if (SECS.every(function (x) { return x[0] !== curSec; })) curSec = 'kb';
    body.querySelectorAll('[data-sec]').forEach(function (r) { r.classList.toggle('sec-hide', r.dataset.sec !== curSec); });
    var nav = $('setNav');
    if (nav) nav.querySelectorAll('[data-sec-go]').forEach(function (b) { b.classList.toggle('on', b.dataset.secGo === curSec); });
  }
  function renderNav() {
    var nav = $('setNav'); if (!nav) return;
    nav.innerHTML = SECS.map(function (x) { return '<button type="button" data-sec-go="' + x[0] + '"><i>' + x[1] + '</i><span>' + (en() ? x[3] : x[2]) + '</span></button>'; }).join('');
    applySec();
  }
  function goSec(sec) { curSec = sec; lsSet('mrSetSec', sec); applySec(); var b = setBody(); if (b) b.scrollTop = 0; }
  window.mrSettingsSection = goSec;
  function settingsInit() {
    if ($('v9Set')) return;
    var g = $('settingGuideBtn'); if (!g) return;
    var rowEl = g.closest('.flex'); if (!rowEl) return;
    var host = el('div', 'v9-set'); host.id = 'v9Set';
    rowEl.insertAdjacentElement('afterend', host);
    var body = host.parentElement; body.id = 'setBody';
    var card = body.parentElement; card.classList.add('set-card');
    var nav = el('nav', 'set-nav'); nav.id = 'setNav';
    card.insertBefore(nav, body);
    nav.addEventListener('click', function (e) { var b = e.target.closest('[data-sec-go]'); if (b) goSec(b.dataset.secGo); });
    host.addEventListener('click', function (e) {
      var b = e.target.closest('[data-v9]'); if (!b || b.tagName === 'SELECT') return;
      var a = b.dataset.v9;
      if (a === 'kb') window.mrOpenKbPicker();
      else if (a === 'wizard') { openWizard(0); }
      else if (a === 'keys') setKeysChord(!V.keysChord);
      else if (a === 'remote') openRemote();
      else if (a === 'rmtoggle') { V.remote.on = !V.remote.on; persist(); renderSettings(); }
      else if (a === 'lock') { try { closeSettingsModal(); } catch (x) {} setLock(true); }
      else if (a === 'export') { try { exportPresets(); } catch (x) {} }
      else if (a === 'autocloud') { V.autoCloud = !V.autoCloud; persist(); renderSettings(); if (V.autoCloud) autoCloudCheck(); }
      else if (a === 'errlog') { V.errLog = !V.errLog; persist(); renderSettings(); }
      else if (a === 'vlib') { try { closeSettingsModal(); } catch (x) {} if (window.mrOpenVoiceLib) mrOpenVoiceLib(); }
      else if (a === 'privacy') { window.open('privacy.html' + (en() ? '#en' : '#id'), '_blank'); }
      else if (a === 'import') { var f = $('importFileInput'); if (f) f.click(); }
      else if (a === 'cloud') { try { closeSettingsModal(); } catch (x) {} if (window.MRPRO) MRPRO.openModal('cloud'); }
      else if (a === 'logout') { mrAsk(T('Keluar dari akun?', 'Log out?'), function () { try { closeSettingsModal(); } catch (x) {} handleLogout(); }, { ok: 'LOGOUT', danger: true }); }
    });
    host.addEventListener('change', function (e) {
      var s = e.target; if (!s || !s.dataset) return;
      if (s.dataset.v9 === 'st') { V.kb.styleMode = ST_MODES.indexOf(s.value) >= 0 ? s.value : 'auto'; persist(); note('Style Play: ' + stLabel(styleMode())); }
      else if (s.dataset.v9 === 'bk') bkSetDays(s.value);
    });
    renderNav();
    renderSettings();
  }
  var _openSettings = window.openSettingsModal;
  if (typeof _openSettings === 'function') window.openSettingsModal = function () {
    if (locked) return;
    var r = _openSettings.apply(this, arguments);
    settingsInit(); classifyRows(); renderSettings(); renderNav();
    return r;
  };

  /* =================================================================
     Persistensi (Export / Import / Cloud)
     ================================================================= */
  function cleanMap(m) {
    var out = {};
    if (!m || typeof m !== 'object') return out;
    ACTIONS.forEach(function (a) {
      var x = m[a[0]];
      if (!x || typeof x !== 'object' || ['cc', 'pc', 'note'].indexOf(x.t) < 0) return;
      var ch = parseInt(x.ch, 10), n = parseInt(x.n, 10);
      if (isNaN(ch) || isNaN(n)) return;
      out[a[0]] = { t: x.t, ch: cl(ch, 0, 15), n: cl(n, 0, 127) };
    });
    return out;
  }
  var _extraPersist = window.extraPersist;
  window.extraPersist = function () {
    var o = _extraPersist();
    o.v9 = { kb: { model: V.kb.model, styleMode: V.kb.styleMode }, gfx: { mode: V.gfx.mode, meter: V.gfx.meter }, remote: { on: V.remote.on, map: V.remote.map }, connSound: V.connSound, keysChord: V.keysChord, autoCloud: V.autoCloud, errLog: V.errLog };
    return o;
  };
  var _applyExtraPersist = window.applyExtraPersist;
  window.applyExtraPersist = function (p) {
    _applyExtraPersist(p);
    if (!p || typeof p !== 'object') return;
    if (!p.v9 || typeof p.v9 !== 'object') {
      // data versi lama: Frame Rate 30/60 Hz menjadi mode grafis Low/Medium
      var f = parseInt(p.currentFps, 10);
      if (f === 30) V.gfx.mode = 'low'; else if (f === 60) V.gfx.mode = 'medium';
      if (booted) applyAll();
      return;
    }
    var q = p.v9;
    if (q.kb && typeof q.kb === 'object') {
      if (typeof q.kb.model === 'string' && (q.kb.model === '' || modelById(q.kb.model))) V.kb.model = q.kb.model;
      if (ST_MODES.indexOf(q.kb.styleMode) >= 0) V.kb.styleMode = q.kb.styleMode;
    }
    if (q.gfx && typeof q.gfx === 'object') {
      if (['auto'].concat(LV).indexOf(q.gfx.mode) >= 0) V.gfx.mode = q.gfx.mode;
      V.gfx.meter = !!q.gfx.meter;
    }
    if (q.remote && typeof q.remote === 'object') { V.remote.on = q.remote.on !== false; V.remote.map = cleanMap(q.remote.map); }
    var cs = parseInt(q.connSound, 10); if (cs >= 0 && cs <= 3) V.connSound = cs;
    if (typeof q.keysChord === 'boolean') V.keysChord = q.keysChord;
    if (typeof q.autoCloud === 'boolean') V.autoCloud = q.autoCloud;
    if (typeof q.errLog === 'boolean') V.errLog = q.errLog;
    if (booted) applyAll();
  };
  function applyAll() {
    applyLevel(V.gfx.mode === 'auto' ? (LV.indexOf(gfxEff) >= 0 ? gfxEff : 'high') : V.gfx.mode);
    meterShow(V.gfx.meter);
    updateKbChips();
    chordUi();
    renderSettings();
  }

  /* =================================================================
     ☰ MENU (Klasik): panel bawah sebagai jendela kecil di semua tab
     ================================================================= */
  function proMenu(open) {
    var ps = $('proStrip'), btn = $('mrMenuBtn');
    if (!ps || document.body.classList.contains('pa-mode')) return;
    var bg = $('proPopBg');
    if (!bg) { bg = el('div', 'pro-pop-bg'); bg.id = 'proPopBg'; document.body.appendChild(bg); bg.addEventListener('pointerdown', function (e) { e.preventDefault(); proMenu(false); }); }
    if (open === undefined) open = !document.body.classList.contains('pro-pop');
    document.body.classList.toggle('pro-pop', open);
    if (btn) btn.classList.toggle('on', open);
    if (open && btn) {
      var r = btn.getBoundingClientRect(), w = ps.offsetWidth || 400;
      ps.style.top = Math.round(r.bottom + 6) + 'px';
      ps.style.left = Math.round(cl(r.right - w, 8, window.innerWidth - w - 8)) + 'px';
      ps.style.right = 'auto';
    } else { ps.style.top = ''; ps.style.right = ''; ps.style.left = ''; }
  }
  window.mrToggleProMenu = function () { proMenu(); };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.body.classList.contains('pro-pop')) proMenu(false); });
  // tombol yang membuka jendela lain menutup menu (SUS / SPLIT / REC / ◀▶ tetap terbuka)
  document.addEventListener('click', function (e) {
    if (!document.body.classList.contains('pro-pop')) return;
    if (e.target.closest && e.target.closest('#proOpenBtn, #proGearBtn, #mrLockBtn, #proSongName')) setTimeout(function () { proMenu(false); }, 0);
  }, true);

  /* =================================================================
     UI tambahan: chord di panel voice, tombol kunci di strip PRO
     ================================================================= */
  /* Nama di header (di samping titik status MIDI) = username akun yang login.
     displayName Firebase bila ada, kalau tidak bagian email sebelum @. Belum login = KING TITU. */
  function userLabel(u) {
    if (!u) return 'KING TITU';
    var n = String(u.displayName || '').trim();
    if (!n && u.email) n = String(u.email).split('@')[0];
    n = n.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
    return (n || 'KING TITU').toUpperCase().slice(0, 24);
  }
  function setUserLabel(u) {
    document.querySelectorAll('.mr-author').forEach(function (e) { e.textContent = userLabel(u); e.title = u && u.email ? u.email : ''; });
  }
  window.mrSetUserLabel = setUserLabel;
  function authLabelInit() {
    try { if (typeof auth !== 'undefined' && auth.onAuthStateChanged) { auth.onAuthStateChanged(setUserLabel); setUserLabel(auth.currentUser); } } catch (e) {}
  }
  function uiInit() {
    authLabelInit();
    // CHORD + TR/OCT pindah dari header ke atas tampilan voice (nama pembuat di header tetap terlihat di HP kecil)
    var hero = $('mrHero');
    if (hero && !$('mrHeroStat')) {
      var stat = el('div', 'mr-hstat'); stat.id = 'mrHeroStat';
      hero.insertBefore(stat, hero.firstChild);
      var pill0 = $('chordPill'); if (pill0) stat.appendChild(pill0);
      var kc = $('kChips'); if (!kc) { kc = el('span', 'k-chips'); kc.id = 'kChips'; }
      stat.appendChild(kc);
    }
    // CHORD juga di tab STYLE (berguna saat memainkan style)
    var sd = $('activeStyleDisplay');
    if (sd && !$('styleChord')) {
      var sc = el('span', 'chord-pill style-chord', '<small>CHORD</small><b>&ndash;</b>'); sc.id = 'styleChord';
      sd.parentNode.insertBefore(sc, sd);
    }
    var ps = $('proStrip');
    if (ps && !$('mrLockBtn')) {
      var lb = el('button', 'ptoggle lock-btn', '🔒'); lb.type = 'button'; lb.id = 'mrLockBtn'; lb.title = T('Kunci layar', 'Lock screen');
      lb.addEventListener('click', function () { setLock(true); });
      var pan = $('proPanicBtn');
      if (pan && pan.nextSibling) ps.insertBefore(lb, pan.nextSibling); else ps.appendChild(lb);
    }
    var pill = $('chordPill');
    if (pill && !pill.dataset.v9) { pill.dataset.v9 = '1'; pill.addEventListener('click', function () { setKeysChord(!V.keysChord); note(T('Tuts & akor: ', 'Keys & chords: ') + (V.keysChord ? 'ON' : 'OFF')); }); }
  }

  // Bahasa: perbarui semua bagian v9
  window.mrLangHooks.push(function () {
    updateKbChips(); renderSettings(); renderNav(); chordUi();
    if ($('kbPick') && !$('kbPick').classList.contains('kbp-hide')) renderPicker();
    if ($('rmModal') && !$('rmModal').classList.contains('v9-hide')) renderRemote();
    if ($('wzModal') && !$('wzModal').classList.contains('v9-hide')) renderWizard();
    if (locked) lockUi();
  });

  var booted = false;
  function wrapViewMode() {
    var base = window.paSetMode;
    if (typeof base !== 'function' || base.__v9) return;
    var w = function (m) {
      var fromUser = !!w.__force || !!(window.event && window.event.isTrusted && /^(change|click|pointerup)$/.test(window.event.type));
      w.__force = false;
      var r = base.apply(this, arguments);
      proMenu(false);
      try { chordUi(); updateKbChips(); } catch (e) {}
      if (pendingWizard) { pendingWizard = false; setTimeout(function () { openWizard(1); }, 450); }
      if (fromUser) {
        try { var sm = $('settingsModal'); if (sm && !sm.classList.contains('hidden')) closeSettingsModal(); } catch (e) {}
        try { if (m === 'pa') { var t = document.querySelector('#paRoot .pa-tabs [data-go="main"]'); if (t) t.click(); } else switchMainPanel('voice'); } catch (e) {}
      }
      return r;
    };
    w.__v9 = true;
    window.paSetMode = w;
    window.mrChooseView = function (m) { w.__force = true; window.paSetMode(m); };
  }
  var _switch = window.switchMainPanel;
  if (typeof _switch === 'function') window.switchMainPanel = function () { var r = _switch.apply(this, arguments); proMenu(false); return r; };
  window.addEventListener('load', function () {
    booted = true;
    wrapViewMode();
    uiInit();
    applyAll();
    settingsInit();
    setTimeout(bkCheck, 20000);
    setInterval(bkCheck, 30 * 60000);
    setTimeout(autoCloudCheck, 60000);
    setInterval(autoCloudCheck, 30 * 60000);
  });

  // Dipakai pengujian dan konsol
  window.MRV9 = {
    state: V, models: MODELS, modelById: modelById, applyModel: applyModel, detectChord: detectChord, styleMode: styleMode,
    setLock: setLock, openRemote: openRemote, openWizard: openWizard, bk: BK, bkShow: bkShow, bkDue: bkDue,
    gfx: function () { return { mode: V.gfx.mode, eff: gfxEff, cpu: cpuEst }; }, autoCloudCheck: autoCloudCheck, logError: logError, downgrade: downgrade, checkUpdate: checkUpdate, cmpVer: cmpVer,
    heldNotes: heldNotes, lastChord: function () { return lastChord; }
  };
})();
