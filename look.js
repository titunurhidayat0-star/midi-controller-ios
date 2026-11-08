/* =====================================================================
   MIDI ROYALE PRO 9.9.3 - TAMPILAN PERFORMANCE: pilihan warna, ukuran, mode panggung, geser halaman
   - Pengaturan "Warna Performance": KATEGORI (tiap kategori berwarna) / HIJAU (polos ala Korg).
   - Pengaturan "Ukuran tombol Performance": BESAR / SEDANG / KECIL.
   - Tombol bulan (REDUP CEPAT) di header Pa5X dan Klasik: memakai "Redup Layar (Dimmer)" yang sudah ada
     (diset 40%) + Grafis LOW. Ditekan lagi = kembali ke setelan dimmer & grafis sebelumnya.
     (Tidak mengubah "Panggung: ON/OFF" yang lama, kuncinya mrStage tetap milik theme-pick.js.)
   - MAIN Pa5X: label PERFORMANCE dan garis layar ikut warna kategori Performance yang dipanggil.
   - Usap kiri/kanan di tombol Keyboard Set = pindah halaman P1-P6.
   Dimuat setelah kset.js, v9.js, pa5x.js, perf.js dan cmain.js.
   ===================================================================== */
(function () {
  'use strict';
  var $ = function (i) { return document.getElementById(i); };
  function en() { try { return currentLang === 'en'; } catch (e) { return false; } }
  function T(a, b) { return en() ? b : a; }
  function lsg(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lss(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  var H = document.documentElement;
  // warna kategori (sama dengan pa5x-skin.css / kset.css)
  var CC = ['251 191 36', '251 146 60', '244 114 182', '248 113 113', '250 204 21', '56 189 248', '45 212 191', '192 132 252', '163 230 53'];

  var L = {
    kc: lsg('mrKsColor') === 'green' ? 'green' : 'cat',
    sz: ['l', 'm', 's'].indexOf(lsg('mrKsSize')) >= 0 ? lsg('mrKsSize') : 'm',
    stage: lsg('mrQuickDim') === '1'
  };
  function applyCls() {
    H.classList.toggle('ks-green', L.kc === 'green');
    H.classList.toggle('ks-sz-l', L.sz === 'l');
    H.classList.toggle('ks-sz-s', L.sz === 's');
    H.classList.toggle('mr-stage', L.stage);
    ['paStageBtn', 'mrStageTop', 'paDimPill'].forEach(function (id) { var b = $(id); if (b) { b.classList.toggle('on', L.stage); b.setAttribute('aria-pressed', L.stage ? 'true' : 'false'); } });
    var a = $('settingKsColor'), b2 = $('settingKsSize');
    if (a) a.value = L.kc; if (b2) b2.value = L.sz;
  }
  window.mrSetKsColor = function (v) { L.kc = v === 'green' ? 'green' : 'cat'; lss('mrKsColor', L.kc); applyCls(); mainColor(); };
  window.mrSetKsSize = function (v) { L.sz = ['l', 'm', 's'].indexOf(v) >= 0 ? v : 'm'; lss('mrKsSize', L.sz); applyCls(); };
  // pakai Dimmer bawaan (theme-pick.js): geser slidernya agar tersimpan & tampil benar
  function dimNow() { var r = $('tpDimRange'); if (r) return +r.value || 0; return parseInt(lsg('mrDim'), 10) || 0; }
  function dimSet(n) {
    var r = $('tpDimRange');
    if (r) { r.value = String(n); r.dispatchEvent(new Event('input', { bubbles: true })); return; }
    var d = $('mrDim'); if (!d) { d = document.createElement('div'); d.id = 'mrDim'; document.body.appendChild(d); }
    d.style.opacity = n / 100; lss('mrDim', String(n));
  }
  var QUICK = 40;
  window.mrSetStage = function (on) {
    on = !!on;
    if (on === L.stage) { applyCls(); return; }
    L.stage = on; lss('mrQuickDim', on ? '1' : '0');
    try {
      if (on) { lss('mrQuickDimPrev', String(dimNow())); if (dimNow() < QUICK) dimSet(QUICK); }
      else dimSet(Math.min(70, parseInt(lsg('mrQuickDimPrev'), 10) || 0));
      if (window.MRV9 && window.mrSetGfx) {
        if (on) { var m = MRV9.gfx().mode; if (m !== 'low') lss('mrStagePrevGfx', m); window.mrSetGfx('low'); }
        else window.mrSetGfx(lsg('mrStagePrevGfx') || 'auto');
      }
    } catch (e) {}
    applyCls();
    try { toast(on ? T('REDUP NYALA: layar diredupkan, Grafis LOW', 'DIM ON: screen dimmed, Graphics LOW') : T('REDUP MATI: kembali ke setelan sebelumnya', 'DIM OFF: back to previous settings')); } catch (e) {}
  };
  window.mrStageOn = function () { return L.stage; };

  /* ---------- warna kategori Performance aktif (dipakai MAIN Pa5X) ---------- */
  function mainColor() {
    var c = -1;
    try {
      var S = MRKSET.state, a = MRKSET.active();
      if (a && a.pos && S.lastAction === 'kset' && !S.ext) c = a.pos.c;
    } catch (e) {}
    if (c >= 0 && c < CC.length) { H.style.setProperty('--kcat', CC[c]); H.setAttribute('data-mrkc', String(c)); }
    else { H.style.removeProperty('--kcat'); H.removeAttribute('data-mrkc'); }
  }

  /* ---------- tombol bulan (mode panggung) di header ---------- */
  var MOON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';
  function headerBtns() {
    var lk = $('paLockBtn');
    if (lk && !$('paStageBtn')) {
      var b = document.createElement('button'); b.type = 'button'; b.id = 'paStageBtn'; b.className = 'mr-stage-btn';
      b.innerHTML = MOON; b.title = T('Redup cepat (panggung gelap)', 'Quick dim (dark stage)'); b.setAttribute('aria-label', b.title);
      b.addEventListener('click', function (e) { e.stopPropagation(); window.mrSetStage(!L.stage); });
      lk.parentNode.insertBefore(b, lk);
    }
    // Pa5X layar sempit (HP): tombol REDUP di bilah bawah MAIN (header terlalu penuh)
    var du = $('paDual');
    if (du && !$('paDimPill')) {
      var q = document.createElement('button'); q.type = 'button'; q.id = 'paDimPill'; q.className = 'pa-pill mr-stage-btn';
      q.innerHTML = MOON + '<span>' + T('REDUP', 'DIM') + '</span>';
      q.addEventListener('click', function (e) { e.stopPropagation(); window.mrSetStage(!L.stage); });
      du.parentNode.insertBefore(q, du);
    }
    // Klasik: selalu tepat di sebelah PANIC atas (PANIC dipindah ke header oleh cmain.js)
    var pn = $('mrPanicTop'), c = $('mrStageTop');
    if (pn && !c) {
      c = document.createElement('button'); c.type = 'button'; c.id = 'mrStageTop'; c.className = 'mr-stage-btn';
      c.innerHTML = MOON; c.title = T('Redup cepat (panggung gelap)', 'Quick dim (dark stage)'); c.setAttribute('aria-label', c.title);
      c.addEventListener('click', function (e) { e.stopPropagation(); window.mrSetStage(!L.stage); });
    }
    if (pn && c && pn.nextSibling !== c) pn.parentNode.insertBefore(c, pn.nextSibling);
  }

  /* ---------- Pengaturan ---------- */
  function row(id, lbl, desc, opts) {
    var r = document.createElement('div');
    r.className = 'flex items-center justify-between bg-slate-950/60 p-2.5 rounded-xl border border-slate-800';
    r.innerHTML = '<div><span class="font-bold text-slate-200 block" id="' + id + 'Lbl"></span><span class="text-[10px] text-slate-400" id="' + id + 'Desc"></span></div>' +
      '<select id="' + id + '" class="set-select font-mono">' + opts.map(function (o) { return '<option value="' + o + '"></option>'; }).join('') + '</select>';
    return r;
  }
  function settingRows() {
    if ($('settingKsColor')) return;
    var mm = $('settingMainMode'), anchor = mm && mm.closest('.flex.items-center.justify-between');
    if (!anchor) { var vm = $('settingViewMode'); anchor = vm && vm.closest('.flex.items-center.justify-between'); }
    if (!anchor) return;
    var r1 = row('settingKsColor', '', '', ['cat', 'green']), r2 = row('settingKsSize', '', '', ['l', 'm', 's']);
    anchor.parentNode.insertBefore(r2, anchor.nextSibling);
    anchor.parentNode.insertBefore(r1, anchor.nextSibling);
    $('settingKsColor').addEventListener('change', function () { window.mrSetKsColor(this.value); });
    $('settingKsSize').addEventListener('change', function () { window.mrSetKsSize(this.value); });
    labels();
  }
  function setT(id, s) { var e = $(id); if (e) e.textContent = s; }
  function optT(id, arr) { var s = $(id); if (!s) return; for (var i = 0; i < s.options.length && i < arr.length; i++) s.options[i].textContent = arr[i]; }
  function labels() {
    setT('settingKsColorLbl', T('Warna Performance', 'Performance colors'));
    setT('settingKsColorDesc', T('KATEGORI = tiap kategori berwarna sendiri (juga di MAIN). HIJAU = polos seperti layar Korg.', 'CATEGORY = each category has its own color (also on MAIN). GREEN = plain, like the Korg screen.'));
    optT('settingKsColor', [T('KATEGORI', 'CATEGORY'), T('HIJAU', 'GREEN')]);
    setT('settingKsSizeLbl', T('Ukuran tombol Performance', 'Performance button size'));
    setT('settingKsSizeDesc', T('BESAR untuk HP (mudah ditekan), KECIL untuk tablet (lebih banyak info).', 'LARGE for phones (easy to tap), SMALL for tablets (more info).'));
    optT('settingKsSize', [T('BESAR', 'LARGE'), T('SEDANG', 'MEDIUM'), T('KECIL', 'SMALL')]);
    ['paStageBtn', 'mrStageTop', 'paDimPill'].forEach(function (id) { var b = $(id); if (b) { b.title = T('Redup cepat (panggung gelap)', 'Quick dim (dark stage)'); b.setAttribute('aria-label', b.title); } });
    var dp = $('paDimPill'); if (dp && dp.lastChild) dp.lastChild.textContent = T('REDUP', 'DIM');
    applyCls();
  }
  (window.mrLangHooks = window.mrLangHooks || []).push(labels);

  /* ---------- simpan / ekspor / impor ---------- */
  var _ep = window.extraPersist;
  if (typeof _ep === 'function') window.extraPersist = function () { var o = _ep.apply(this, arguments) || {}; o.look = { kc: L.kc, sz: L.sz, stage: L.stage }; return o; };
  var _ap = window.applyExtraPersist;
  if (typeof _ap === 'function') window.applyExtraPersist = function (p) {
    var r = _ap.apply(this, arguments);
    if (p && p.look && typeof p.look === 'object') {
      L.kc = p.look.kc === 'green' ? 'green' : 'cat'; lss('mrKsColor', L.kc);
      L.sz = ['l', 'm', 's'].indexOf(p.look.sz) >= 0 ? p.look.sz : 'm'; lss('mrKsSize', L.sz);
      applyCls(); mainColor();
    }
    return r;
  };

  /* ---------- usap kiri/kanan = pindah halaman P1-P6 ---------- */
  function swipe() {
    var g = $('ksGrid'); if (!g || g.dataset.sw) return;
    g.dataset.sw = '1';
    var d = null;
    g.addEventListener('pointerdown', function (e) { d = { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now() }; });
    g.addEventListener('pointercancel', function () { d = null; });
    g.addEventListener('pointerup', function (e) {
      if (!d || d.id !== e.pointerId) return;
      var dx = e.clientX - d.x, dy = e.clientY - d.y, dt = Date.now() - d.t; d = null;
      if (!g.classList.contains('ks-slots') || dt > 900 || Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      var S = MRKSET.state, np = S.page + (dx < 0 ? 1 : -1);
      if (np < 1 || np > 6) { slide(g, dx < 0 ? 'ks-bump-l' : 'ks-bump-r'); return; }
      var pb = document.querySelector('#ksPages [data-kpage="' + np + '"]');
      if (pb) { pb.click(); slide(g, dx < 0 ? 'ks-in-r' : 'ks-in-l'); }
    });
  }
  function slide(g, cls) {
    ['ks-in-l', 'ks-in-r', 'ks-bump-l', 'ks-bump-r'].forEach(function (c) { g.classList.remove(c); });
    void g.offsetWidth; g.classList.add(cls);
    clearTimeout(g._swT); g._swT = setTimeout(function () { g.classList.remove(cls); }, 320);
  }

  // header Pa5X baru dibuat saat pertama kali masuk Pa5X
  var _psm = window.paSetMode;
  if (typeof _psm === 'function') window.paSetMode = function () { var r = _psm.apply(this, arguments); try { headerBtns(); labels(); swipe(); mainColor(); } catch (e) {} return r; };

  function boot() {
    applyCls();
    headerBtns();
    settingRows();
    swipe();
    mainColor();
    if (window.MRKSET && MRKSET.onChange) MRKSET.onChange(function () { mainColor(); swipe(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.addEventListener('load', function () { setTimeout(function () { headerBtns(); settingRows(); swipe(); mainColor(); applyCls(); }, 500); });
})();
