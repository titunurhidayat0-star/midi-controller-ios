/* =====================================================================
   MIDI ROYALE PRO 9.7 - TAMPILAN UTAMA PERFORMANCE + BANK SOUND
   - Pengaturan "Tampilan utama": PERFORMANCE (bawaan) atau SOUND.
   - MAIN (Pa5X) dan kotak voice (Klasik) menampilkan nama Performance + Upper 1/2/3.
     Ketuk nama Upper = daftar sound untuk Upper itu, langsung di bank & kategori sound-nya.
   - Bank sound seperti Korg: FACTORY, LEGACY, GM, USER (sampling / sound sendiri).
   Dimuat paling akhir (setelah v95.js). Memakai fungsi global dan MRKSET (kset.js).
   ===================================================================== */
(function () {
  'use strict';
  var $ = function (i) { return document.getElementById(i); };
  function en() { try { return currentLang === 'en'; } catch (e) { return false; } }
  function T(a, b) { return en() ? b : a; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lsg(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lss(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function isPa() { return document.body.classList.contains('pa-mode'); }
  function tiles() { try { return voiceTiles || []; } catch (e) { return []; } }
  function tileById(id) { var a = tiles(); for (var i = 0; i < a.length; i++) if (String(a[i].id) === String(id)) return a[i]; return null; }

  /* =====================================================================
     1. BANK SOUND
     ===================================================================== */
  var BANKS = [['all', 'SEMUA', 'ALL'], ['factory', 'FACTORY', 'FACTORY'], ['legacy', 'LEGACY', 'LEGACY'], ['gm', 'GM', 'GM'], ['user', 'USER', 'USER']];
  var bank = lsg('mrBank'); if (!BANKS.some(function (b) { return b[0] === bank; })) bank = 'all';
  function bankOf(t) { return t && (t.bank === 'legacy' || t.bank === 'gm' || t.bank === 'user') ? t.bank : 'factory'; }
  window.mrBankOf = bankOf;
  window.mrBank = function () { return bank; };
  window.mrBankOk = function (t) { return bank === 'all' || bankOf(t) === bank; };
  window.mrBankTabs = function () {
    var n = { all: 0, factory: 0, legacy: 0, gm: 0, user: 0 };
    tiles().forEach(function (t) { n.all++; n[bankOf(t)]++; });
    return BANKS.map(function (b) { return '<button type="button" data-bank="' + b[0] + '" class="mr-bk' + (bank === b[0] ? ' on' : '') + (b[0] !== 'all' && !n[b[0]] ? ' empty' : '') + '">' + (en() ? b[2] : b[1]) + '<small>' + n[b[0]] + '</small></button>'; }).join('');
  };
  window.mrSetBank = function (b) {
    if (!BANKS.some(function (x) { return x[0] === b; })) b = 'all';
    bank = b; lss('mrBank', b);
    try { searchQuery = ''; var vs = $('voiceSearchInput'); if (vs) vs.value = ''; var ps = $('paSearch'); if (ps) ps.value = ''; } catch (e) {}
    try { renderCategoryTabs(); } catch (e) {}
    try { renderVoiceTiles(); } catch (e) {}
  };
  // Klasik: tab bank di depan tab kategori (ikut pindah saat daftar voice dibuka penuh)
  function classicBanks() {
    var ct = $('categoryTabs'); if (!ct) return;
    var box = ct.querySelector('.mr-bks');
    if (!box) { box = document.createElement('div'); box.className = 'mr-bks'; box.addEventListener('click', function (e) { var b = e.target.closest('[data-bank]'); if (b) { e.stopPropagation(); window.mrSetBank(b.dataset.bank); } }); }
    if (ct.firstChild !== box) ct.insertBefore(box, ct.firstChild);
    var h = window.mrBankTabs(); if (box.dataset.k !== h) { box.dataset.k = h; box.innerHTML = h; }
  }
  var _rct = window.renderCategoryTabs;
  if (typeof _rct === 'function') window.renderCategoryTabs = function () { var r = _rct.apply(this, arguments); classicBanks(); return r; };

  /* =====================================================================
     2. TAMPILAN UTAMA PERFORMANCE
     ===================================================================== */
  function perfOn() { return !!(window.MRKSET && window.mrMainMode && window.mrMainMode() === 'perf'); }
  window.mrPerfOn = perfOn;
  function icon(t) {
    if (!t) return '';
    if (t.customImg) return '<img src="' + esc(t.customImg) + '" alt="">';
    try { return svgIconPresets[t.iconKey] || svgIconPresets.piano || ''; } catch (e) { return ''; }
  }
  function info() {
    var S = MRKSET.state, a = MRKSET.active(), ups = [];
    for (var k = 1; k <= 3; k++) {
      var u = S.cur[k], ch = MRKSET.chNo(k);
      ups.push({ k: k, name: u ? MRKSET.upName(u) : '', tile: u ? MRKSET.upTile(u) : null, dirty: !!S.dirty[k], ch: ch });
    }
    var name = a ? a.name : S.ext ? T('DARI KEYBOARD', 'FROM KEYBOARD') : (S.list.length ? T('PILIH PERFORMANCE', 'CHOOSE A PERFORMANCE') : T('BELUM ADA PERFORMANCE', 'NO PERFORMANCE YET'));
    var sub = a ? ((a.pos && MRKSET.posLabel ? MRKSET.posLabel(a.pos) + ' · ' : a.folder ? a.folder + ' · ' : '') + MRKSET.badge(a)) : S.ext ? T('Belum disimpan di aplikasi', 'Not saved in the app') : (S.list.length ? T('Ketuk untuk daftar Performance', 'Tap for the Performance list') : T('Ketuk lalu ＋ CARI NOMOR', 'Tap, then ＋ FIND NUMBER'));
    return { a: a, name: name, sub: sub, ups: ups, dirty: Object.keys(S.dirty).length > 0, ext: S.ext, idx: a ? S.list.indexOf(a) + 1 : 0 };
  }
  window.mrPerfInfo = info;
  function upsHtml(inf) {
    var h = inf.ups.map(function (u) {
      return '<button type="button" class="mr-up' + (u.name ? ' on' : '') + (u.dirty ? ' dirty' : '') + (pick === u.k ? ' pk' : '') + '" data-up="' + u.k + '"><em>UP' + u.k + '</em><span class="ui">' + icon(u.tile) + '</span><b>' + esc(u.name || (u.ch ? '—' : 'OFF')) + '</b><small>' + (u.dirty ? '✎ ' : '') + (u.ch ? 'CH ' + u.ch : '') + '</small></button>';
    }).join('');
    if (inf.dirty && inf.a) h += '<button type="button" class="mr-psave" data-psave="1">' + T('SIMPAN KE PERFORMANCE', 'SAVE TO PERFORMANCE') + '</button>';
    else if (inf.ext) h += '<button type="button" class="mr-psave" data-psave="1">＋ ' + T('SIMPAN JADI PERFORMANCE', 'SAVE AS PERFORMANCE') + '</button>';
    return h;
  }
  window.mrPerfUpsHtml = upsHtml;
  window.mrPerfSave = function () {
    var S = MRKSET.state;
    if (S.ext || !MRKSET.active()) {
      try { switchMainPanel('kset'); } catch (e) {}
      if (isPa() && window.paGo) window.paGo('kset');
      MRKSET.openFinder(null, { uppers: [S.cur[1], S.cur[2], S.cur[3]] });
      return;
    }
    MRKSET.saveUppers();
  };

  /* ---------- memilih sound untuk Upper 1/2/3 ---------- */
  var pick = 0;
  window.mrKeysOnId = function () {
    if (pick === 2 || pick === 3) { var t = MRKSET.upTile(MRKSET.state.cur[pick]); return t ? t.id : ''; }
    return activeTileId;
  };
  function pickBar() {
    var b = $('mrPickBar');
    if (!pick) { if (b) b.classList.add('off'); return; }
    if (!b) {
      b = document.createElement('div'); b.id = 'mrPickBar'; b.className = 'mr-pickbar off';
      b.addEventListener('click', function (e) { if (e.target.closest('[data-x]')) endPick(true); });
      document.body.appendChild(b);
    }
    var u = MRKSET.state.cur[pick];
    b.innerHTML = '<span class="pk-k">UPPER ' + pick + '</span><span class="pk-t">' + T('PILIH SOUND', 'CHOOSE SOUND') + (u ? ' · ' + esc(MRKSET.upName(u)) : '') + '</span><button type="button" data-x="1">✕ ' + T('SELESAI', 'DONE') + '</button>';
    b.classList.remove('off');
  }
  function endPick(fromBar) {
    if (!pick) return;
    pick = 0; pickBar(); refreshAll();
    if (fromBar) { if (isPa() && window.paGo) window.paGo('main'); else if (window.mrClassicPanel) switchMainPanel('main'); else closeFull(); }
  }
  window.mrPerfEndPick = function () { endPick(false); };
  window.mrPerfPicking = function () { return pick; };
  function closeFull() { var c = document.querySelector('.mr-full .mr-close'); if (c) c.click(); }
  function openPick(k) {
    if (!window.MRKSET) return;
    if (k === 3 && !MRKSET.chNo(3)) { try { toast(T('Isi dulu Pengaturan › Upper 3 MIDI Channel', 'Set Settings › Upper 3 MIDI Channel first')); } catch (e) {} }
    pick = k;
    var t = MRKSET.upTile(MRKSET.state.cur[k]);
    if (t) { bank = bankOf(t); lss('mrBank', bank); try { activeCategory = t.category; } catch (e) {} }
    try { searchQuery = ''; var vs = $('voiceSearchInput'); if (vs) vs.value = ''; var ps = $('paSearch'); if (ps) ps.value = ''; } catch (e) {}
    pickBar();
    if (isPa()) { if (window.paGo) window.paGo('keys'); }
    else {
      try { switchMainPanel('voice'); } catch (e) {}
      try { renderCategoryTabs(); renderVoiceTiles(); } catch (e) {}
      if (window.mrOpenFull) window.mrOpenFull();
    }
    setTimeout(function () {
      var id = t ? String(t.id) : '';
      var el = id && (document.querySelector('#paList .pa-row[data-id="' + CSS.escape(id) + '"]') || document.querySelector('#voiceTilesGrid .voice-tile[data-id="' + CSS.escape(id) + '"]'));
      if (el && el.offsetParent) el.scrollIntoView({ block: 'nearest' });
    }, 80);
    refreshAll();
  }
  window.mrPerfPick = openPick;

  // pilihan sound diarahkan ke Upper yang dipilih
  var _sel = window.selectVoiceTile;
  window.selectVoiceTile = function (id) {
    var armed = false; try { armed = layerPickArmed; } catch (e) {}
    if (!armed && (pick === 2 || pick === 3) && window.MRKSET) {
      var t = tileById(id), k = pick;
      if (t) MRKSET.setUpper(k, t);
      if (!isPa()) { pick = 0; pickBar(); }
      else pickBar();
      try { renderVoiceTiles(); } catch (e) {}
      refreshAll();
      return;
    }
    var r = _sel.apply(this, arguments);
    if (pick === 1) { if (!isPa()) { pick = 0; } pickBar(); }
    refreshAll();
    return r;
  };

  /* ---------- Klasik: kotak voice menjadi kotak Performance ---------- */
  function voiceHero() {
    try {
      var t = tileById(activeTileId), ti = $('mrHeroTitle'), sb = $('mrHeroSub');
      if (ti) ti.textContent = t ? t.name : '-';
      if (sb) sb.textContent = t ? ('MSB ' + t.msb + ' · LSB ' + t.lsb + ' · PC ' + t.pc + (dualEnabled ? ' · DUAL' : '')) : '';
    } catch (e) {}
  }
  function heroUpd() {
    var hero = $('mrHero'); if (!hero) return;
    var on = perfOn();
    hero.classList.toggle('mr-perf', on);
    var ups = $('mrHeroUps');
    if (!on) { if (ups) ups.hidden = true; if (hero.dataset.wasPerf) { delete hero.dataset.wasPerf; voiceHero(); } return; }
    hero.dataset.wasPerf = '1';
    var nv = hero.querySelectorAll('.mr-nav'); if (nv.length === 2) { nv[0].classList.add('mr-prev'); nv[1].classList.add('mr-next'); }
    if (!ups) {
      ups = document.createElement('div'); ups.id = 'mrHeroUps'; ups.className = 'mr-hups';
      var nm = hero.querySelector('.mr-name');
      if (nm && nm.parentNode) nm.parentNode.insertBefore(ups, nm.nextSibling); else hero.appendChild(ups);
      ups.addEventListener('click', function (e) {
        var u = e.target.closest('[data-up]'); if (u) { openPick(parseInt(u.dataset.up, 10)); return; }
        if (e.target.closest('[data-psave]')) { window.mrPerfSave(); refreshAll(); }
      });
    }
    ups.hidden = false;
    var inf = info();
    var ti = $('mrHeroTitle'), sb = $('mrHeroSub');
    if (ti && ti.textContent !== inf.name) ti.textContent = inf.name;
    var s2 = (inf.idx ? '#' + inf.idx + ' · ' : '') + inf.sub;
    if (sb && sb.textContent !== s2) sb.textContent = s2;
    var h = upsHtml(inf); if (ups.dataset.k !== h) { ups.dataset.k = h; ups.innerHTML = h; }
  }
  // tombol PREV/NEXT dan nama di kotak Klasik: Performance (di tampilan PERFORMANCE)
  document.addEventListener('click', function (e) {
    if (!perfOn() || isPa()) return;
    var nav = e.target.closest('#mrHero .mr-nav');
    if (nav) {
      e.stopPropagation(); e.preventDefault();
      var navs = Array.prototype.slice.call(document.querySelectorAll('#mrHero .mr-nav'));
      MRKSET.step(navs.indexOf(nav) === 0 ? -1 : 1);
      return;
    }
    if (e.target.closest('#mrHero .mr-name')) { e.stopPropagation(); e.preventDefault(); try { switchMainPanel('kset'); } catch (x) {} }
  }, true);
  // Klasik: sorot sound milik Upper 2/3 yang sedang dipilih
  function markTarget() {
    document.querySelectorAll('#voiceTilesGrid .voice-tile.mr-tgt').forEach(function (c) { c.classList.remove('mr-tgt'); });
    if (pick !== 2 && pick !== 3) return;
    var id = window.mrKeysOnId(); if (!id) return;
    var c = document.querySelector('#voiceTilesGrid .voice-tile[data-id="' + CSS.escape(String(id)) + '"]');
    if (c) { c.classList.add('mr-tgt'); c.dataset.tgt = 'UP' + pick; }
  }
  var _rvt = window.renderVoiceTiles;
  if (typeof _rvt === 'function') window.renderVoiceTiles = function () {
    var r = _rvt.apply(this, arguments);
    try { classicBanks(); markTarget(); heroUpd(); } catch (e) {}
    return r;
  };
  // full-screen voice ditutup: selesai memilih
  document.addEventListener('click', function (e) { if (e.target.closest('.mr-full .mr-close') && pick && !isPa()) { pick = 0; pickBar(); refreshAll(); } });

  function refreshAll() {
    heroUpd();
    if (isPa() && window.paRenderKeys && document.querySelector('#paScr-keys.on')) window.paRenderKeys();
  }

  /* =====================================================================
     3. PENGATURAN: Tampilan utama
     ===================================================================== */
  function settingRow() {
    if ($('settingMainMode')) return;
    var vm = $('settingViewMode'), row = vm && vm.closest('.flex.items-center.justify-between');
    if (!row) return;
    var r = document.createElement('div');
    r.className = 'flex items-center justify-between bg-slate-950/60 p-2.5 rounded-xl border border-slate-800';
    r.innerHTML = '<div><span class="font-bold text-slate-200 block" id="mmLbl"></span><span class="text-[10px] text-slate-400" id="mmDesc"></span></div>' +
      '<select id="settingMainMode" class="set-select font-mono"><option value="perf">PERFORMANCE</option><option value="sound">SOUND</option></select>';
    row.parentNode.insertBefore(r, row.nextSibling);
    $('settingMainMode').addEventListener('change', function () { window.mrSetMainMode(this.value); refreshAll(); });
    labels();
  }
  function labels() {
    var l = $('mmLbl'), d = $('mmDesc'), s = $('settingMainMode');
    if (l) l.textContent = T('Tampilan utama', 'Main display');
    if (d) d.textContent = T('PERFORMANCE = nama Performance + Upper 1/2/3 (seperti Korg). SOUND = nama voice Upper 1 saja.', 'PERFORMANCE = Performance name + Upper 1/2/3 (like Korg). SOUND = Upper 1 voice name only.');
    if (s) s.value = window.mrMainMode ? window.mrMainMode() : 'perf';
  }
  (window.mrLangHooks = window.mrLangHooks || []).push(function () { labels(); classicBanks(); pickBar(); refreshAll(); });

  function boot() {
    settingRow();
    classicBanks();
    if (window.MRKSET) MRKSET.onChange(function () { refreshAll(); if (pick) pickBar(); });
    heroUpd();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.addEventListener('load', function () { setTimeout(function () { classicBanks(); heroUpd(); }, 450); });
})();
