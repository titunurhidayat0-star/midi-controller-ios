/* Pemilih tema setelah login. Hanya memanggil paSetMode() yang sudah ada; tidak mengubah fungsi lain. */
(function () {
  var ACC = { emas: ['212 175 55','229 207 135','212 175 55','180 149 47','144 119 37','81 67 21','59 49 15','32 26 8'], cyan: ['34 211 238','103 232 249','34 211 238','6 182 212','8 145 178','22 78 99','8 51 68','4 30 42'], ungu: ['167 139 250','196 181 253','167 139 250','139 92 246','124 58 237','91 33 182','76 29 149','46 16 101'], mawar: ['251 113 133','253 164 175','251 113 133','244 63 94','225 29 72','159 18 57','136 19 55','76 5 25'], hijau: ['52 211 153','110 231 183','52 211 153','16 185 129','5 150 105','6 95 70','6 78 59','2 44 34'] };
  var VARS = ['--accent-rgb', '--ac-300', '--ac-400', '--ac-500', '--ac-600', '--ac-800', '--ac-900', '--ac-950'];
  function applyAcc(k) { var a = ACC[k]; if (!a) return; VARS.forEach(function (v, i) { document.documentElement.style.setProperty(v, a[i]); }); try { localStorage.setItem('mrAccent', k); } catch (e) {} try { if (localStorage.getItem('mrLcd') === 'accent' && window.mrApplyLcd) window.mrApplyLcd('accent'); } catch (e) {} }
  function curAcc() { try { return localStorage.getItem('mrAccent') || 'emas'; } catch (e) { return 'emas'; } }
  applyAcc(curAcc());
  function cur() { try { return localStorage.getItem('mrViewMode') === 'pa' ? 'pa' : 'classic'; } catch (e) { return 'classic'; } }
  function isEn() { try { return currentLang === 'en'; } catch (e) { return false; } }
  function T(a, b) { return isEn() ? b : a; }
  function rep(n, h) { var s = ''; for (var i = 0; i < n; i++) s += h.replace(/\{n\}/g, i); return s; }
  var SVG_C = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>';
  var SVG_P = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="16" rx="2"/><path d="M8.5 4v16M15.5 4v16"/><path d="M6 4v9M12 4v9M18 4v9" stroke-width="3.2"/></svg>';

  window.mrShowThemePicker = function () {
    if (document.getElementById('tpOverlay')) return;
    var last = cur(), o = document.createElement('div'); o.id = 'tpOverlay';
    var em = ''; try { em = (typeof auth !== 'undefined' && auth.currentUser && auth.currentUser.email) || ''; } catch (e) {}
    var hi = em ? '<div class="tp-hi">' + T('Selamat datang, ', 'Welcome, ') + em.replace(/[<>&"]/g, '') + '</div>' : '';
    var ca = curAcc(), sw = Object.keys(ACC).map(function (k) { return '<button type="button" data-acc="' + k + '" title="' + k + '" class="' + (k === ca ? 'on' : '') + '" style="--s:' + ACC[k][0] + '"></button>'; }).join('');
    function card(k, cls, svg, title, desc, prev) {
      return '<button type="button" class="tp-card ' + cls + (last === k ? ' last' : '') + '" data-m="' + k + '">' +
        '<div class="tp-top"><div class="tp-ico">' + svg + '</div><div><div class="tp-t">' + title + '</div><div class="tp-d">' + desc + '</div></div>' +
        (last === k ? '<span class="tp-badge">' + T('TERAKHIR DIPAKAI', 'LAST USED') + '</span>' : '') + '</div>' + prev +
        '<div class="tp-go">' + T('PAKAI TAMPILAN INI', 'USE THIS VIEW') + ' ▶</div></button>';
    }
    var pvC = '<div class="tp-pv pv-c">' + rep(8, '<i style="--n:{n}"></i>') + '</div>';
    var pvP = '<div class="tp-pv pv-p"><div class="scr"><span class="nm">GRAND PIANO</span><div class="up">' + rep(3, '<i style="--n:{n}"></i>') + '</div></div><div class="bt">' + rep(8, '<i style="--n:{n}"></i>') + '</div><div class="tb">' + rep(6, '<i style="--n:{n}"></i>') + '</div></div>';
    o.innerHTML = '<div class="tp-head"><h2>' + T('PILIH TAMPILAN', 'CHOOSE A VIEW') + '</h2><p>' + T('Semua fungsi sama. Hanya tampilannya yang berbeda.', 'Same functions in both. Only the look is different.') + '</p>' + hi + '</div>' +
      '<div class="tp-row">' +
        card('classic', 'c', SVG_C, T('KLASIK', 'CLASSIC'), T('Tile voice besar, mudah disentuh. Tampilan asli aplikasi.', 'Large voice tiles, easy to touch. The original app view.'), pvC) +
        card('pa', 'p', SVG_P, 'PA5X', T('Layar seperti Korg Pa5X: Keys, Control, Scale Tuning, Style.', 'A Korg Pa5X-style screen: Keys, Control, Scale Tuning, Style.'), pvP) +
      '</div><div class="tp-sw">' + T('WARNA AKSEN ', 'ACCENT COLOR ') + sw + '</div><div class="tp-foot">' + T('Bisa diganti kapan saja di Pengaturan › Mode Tampilan', 'You can change it any time in Settings › View Mode') + '</div>';
    document.body.appendChild(o);
    o.addEventListener('click', function (e) {
      var ac = e.target.closest('[data-acc]');
      if (ac) { applyAcc(ac.dataset.acc); o.querySelectorAll('[data-acc]').forEach(function (x) { x.classList.toggle('on', x === ac); }); return; }
      var b = e.target.closest('[data-m]'); if (!b) return;
      if (window.mrChooseView) window.mrChooseView(b.dataset.m); else if (window.paSetMode) window.paSetMode(b.dataset.m);
      o.classList.add('out'); setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); }, 350);
    });
  };

  /* splash singkat saat aplikasi dibuka */
  (function () {
    var s = document.createElement('div'); s.id = 'tpSplash';
    s.innerHTML = '<div class="lg">' + SVG_P + '</div><h1>MIDI ROYALE PRO</h1><div class="bar"><i></i></div>';
    document.body.appendChild(s); setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 2200);
  })();

  /* tombol lihat/sembunyikan password */
  window.addEventListener('DOMContentLoaded', function () {
    var pw = document.getElementById('authPassword'); if (!pw || pw.parentNode.classList.contains('tp-pwbox')) return;
    var w = document.createElement('div'); w.className = 'tp-pwbox'; pw.parentNode.insertBefore(w, pw); w.appendChild(pw);
    var b = document.createElement('button'); b.type = 'button'; b.className = 'tp-eye'; b.setAttribute('aria-label', 'Tampilkan password');
    var eye = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
    b.innerHTML = eye;
    b.onclick = function () { var sh = pw.type === 'password'; pw.type = sh ? 'text' : 'password'; b.classList.toggle('on', sh); };
    w.appendChild(b);
  });

  /* hiasan equalizer di layar login */
  window.addEventListener('DOMContentLoaded', function () {
    var p = document.querySelector('#authModal>.glass-card>div:nth-child(1)');
    if (p && !p.querySelector('.tp-eq')) { var d = document.createElement('div'); d.className = 'tp-eq'; d.innerHTML = rep(9, '<i style="--n:{n}"></i>'); p.appendChild(d); }
  });

  /* chip status Klasik, warna cent, mode panggung, getar sentuh */
  function sg(n) { return (n > 0 ? '+' : '') + n; }
  function chipTick() { chipUpdate(); setTimeout(chipTick, window.mrGfxSlow && window.mrGfxSlow() ? 1800 : 600); }
  setTimeout(chipTick, 600);
  function chipUpdate() {
    try {
      var fp = document.getElementById('fpsDisplay'), c = document.getElementById('kChips');
      if (fp && !c) { c = document.createElement('span'); c.id = 'kChips'; c.className = 'k-chips'; fp.parentNode.appendChild(c); }
      if (c) {
        var sp = window.MRPRO && MRPRO.state && MRPRO.state.splitOn;
        var h = '<b>TR ' + sg(transposeSemis) + '</b><b>OCT ' + sg(octaveShift) + '</b>' + (dualEnabled ? '<b class="a">DUAL</b>' : '') + (sp ? '<b class="b">SPLIT</b>' : '');
        if (c.dataset.k !== h) { c.dataset.k = h; c.innerHTML = h; }
      }
    } catch (e) {}
    document.querySelectorAll('.qt-cent').forEach(function (e) { var v = parseFloat(e.textContent); e.classList.toggle('neg', v < 0); e.classList.toggle('pos', v > 0); });
  }
  function stage(on) { document.body.classList.toggle('stage', on); try { localStorage.setItem('mrStage', on ? '1' : '0'); } catch (e) {} var b = document.getElementById('tpStageBtn'); if (b) b.textContent = T('Panggung: ', 'Stage: ') + (on ? 'ON' : 'OFF'); }
  window.addEventListener('DOMContentLoaded', function () {
    var sel = document.getElementById('settingViewMode'), pk = sel && sel.nextElementSibling; if (!pk) return;
    var b = document.createElement('button'); b.type = 'button'; b.id = 'tpStageBtn'; b.className = 'set-select font-mono'; b.style.cssText = 'margin-left:.4rem;cursor:pointer';
    b.onclick = function () { stage(!document.body.classList.contains('stage')); }; pk.after(b);
    var on = false; try { on = localStorage.getItem('mrStage') === '1'; } catch (e) {} stage(on);
  });
  document.addEventListener('pointerdown', function (e) {
    if (navigator.vibrate && e.target.closest && e.target.closest('#paRoot button,.voice-tile,.style-btn,.main-tab-btn')) { try { navigator.vibrate(6); } catch (x) {} }
  }, true);

  /* ukuran panel + slider Pitch Bend & Triple Controller bisa diatur sendiri (tersimpan) */
  var CS_KEY = 'mrCtrlSize', CS_DEF = { pbW: 100, pbP: 0, pbH: 0, trW: 100, trP: 0, trH: 0 };
  function csLoad() { var o = {}; try { o = JSON.parse(localStorage.getItem(CS_KEY) || '{}'); } catch (e) {} var s = {}; for (var k in CS_DEF) s[k] = typeof o[k] === 'number' ? o[k] : CS_DEF[k]; return s; }
  function csSet(el, p, v) { if (!el) return; if (v) el.style.setProperty(p, v, 'important'); else el.style.removeProperty(p); }
  function csApply(s) {
    var cards = document.querySelectorAll('#panelCtrl>.glass-card'), tk = [document.getElementById('pitchTouchTrack'), document.getElementById('tripleTouchTrack')];
    [['pb', 0], ['tr', 1]].forEach(function (g) {
      var c = cards[g[1]], w = s[g[0] + 'W'], p = s[g[0] + 'P'], h = s[g[0] + 'H'];
      csSet(c, 'width', w < 100 ? w + '%' : ''); csSet(c, 'justify-self', w < 100 ? 'center' : '');
      csSet(c, 'height', p >= 120 ? p + 'px' : ''); csSet(c, 'align-self', p >= 120 ? 'start' : '');
      csSet(tk[g[1]], 'height', h >= 40 ? h + 'px' : '');
    });
  }
  function csOpen() {
    if (document.getElementById('csPanel')) return;
    var s = csLoad(), d = document.createElement('div'); d.id = 'csPanel';
    function row(k, lb, mn, mx, st, unit) {
      return '<label class="cs-r"><span>' + lb + '</span><input type="range" data-k="' + k + '" min="' + mn + '" max="' + mx + '" step="' + st + '" value="' + s[k] + '"><em data-v="' + k + '"></em></label>';
    }
    function grp(t, p) { return '<div><h4>' + t + '</h4>' + row(p + 'W', T('Lebar panel', 'Panel width'), 40, 100, 5) + row(p + 'P', T('Tinggi panel', 'Panel height'), 0, 600, 10) + row(p + 'H', T('Tinggi slider', 'Slider height'), 0, 360, 10) + '</div>'; }
    d.innerHTML = '<div class="cs-head"><b>' + T('UKURAN KONTROL', 'CONTROL SIZE') + '</b><span>' + T('geser, hasil langsung terlihat · 0 = otomatis', 'drag, changes show at once · 0 = auto') + '</span><button type="button" data-a="reset">Reset</button><button type="button" data-a="ok">' + T('Selesai', 'Done') + '</button></div><div class="cs-grid">' + grp('PITCH BEND', 'pb') + grp('TRIPLE CONTROLLER', 'tr') + '</div>';
    document.body.appendChild(d);
    function show() { d.querySelectorAll('[data-v]').forEach(function (e) { var k = e.dataset.v, v = s[k]; e.textContent = k.slice(2) === 'W' ? v + '%' : (v < (k.slice(2) === 'P' ? 120 : 40) ? 'Auto' : v + 'px'); }); }
    function save() { try { localStorage.setItem(CS_KEY, JSON.stringify(s)); } catch (e) {} csApply(s); show(); }
    d.addEventListener('input', function (e) { var k = e.target.dataset && e.target.dataset.k; if (!k) return; s[k] = +e.target.value; save(); });
    d.addEventListener('click', function (e) {
      var a = e.target.dataset && e.target.dataset.a; if (!a) return;
      if (a === 'reset') { for (var k in CS_DEF) s[k] = CS_DEF[k]; d.querySelectorAll('[data-k]').forEach(function (i) { i.value = s[i.dataset.k]; }); save(); }
      else d.remove();
    });
    show();
  }
  window.mrCtrlSizeOpen = csOpen;
  window.addEventListener('DOMContentLoaded', function () {
    ['pitchValDisplay', 'tripleValDisplay'].forEach(function (id) {
      var v = document.getElementById(id); if (!v || v.parentNode.querySelector('.cs-gear')) return;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'cs-gear'; b.textContent = T('⚙ Ukuran', '⚙ Size'); b.onclick = csOpen; v.parentNode.insertBefore(b, v);
    });
    csApply(csLoad());
  });

  /* export/import: seluruh pengaturan tampilan & kontrol ikut tersimpan di file preset */
  var LSK = ['mrViewMode', 'mrAccent', 'mrStage', 'mrCtrlSize', 'MR_UI', 'MR_PRO_UI', 'mrOutName', 'mrDim', 'mrLcd', 'mrKeysCols', 'mrKeysFont'], CHK = ['pitchAutoCenter', 'enableModCc', 'enableExpCc', 'enableVelCc'];
  function lsGetS(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  window.mrCollectSettings = function () {
    var o = { v: 1, ls: {}, rt: {}, chk: {} };
    LSK.forEach(function (k) { var v = lsGetS(k); if (v !== null) o.ls[k] = v; });
    try { o.rt = { synth: !!isSynthEnabled, pbRange: pitchBendRangeSemitones, transpose: transposeSemis, octave: octaveShift, dual: !!dualEnabled }; } catch (e) {}
    CHK.forEach(function (id) { var e = document.getElementById(id); if (e) o.chk[id] = !!e.checked; });
    return o;
  };
  function okJson(s, max) { try { if (typeof s !== 'string' || s.length > max) return null; var j = JSON.parse(s); return j && typeof j === 'object' && !Array.isArray(j) ? j : null; } catch (e) { return null; } }
  window.mrApplySettings = function (o) {
    if (!o || typeof o !== 'object') return;
    var ls = o.ls && typeof o.ls === 'object' ? o.ls : {}, needReload = false, clean = {};
    if (ls.mrViewMode === 'pa' || ls.mrViewMode === 'classic') clean.mrViewMode = ls.mrViewMode;
    if (ACC[ls.mrAccent]) clean.mrAccent = ls.mrAccent;
    if (['green', 'amber', 'ice', 'cyan', 'violet', 'rose', 'red', 'accent'].indexOf(ls.mrLcd) >= 0 || /^#[0-9a-f]{6}$/i.test(ls.mrLcd || '')) clean.mrLcd = ls.mrLcd;
    if (/^\d{1,2}$/.test(String(ls.mrDim)) && +ls.mrDim <= 70) clean.mrDim = String(ls.mrDim);
    if (['1', '2', '3'].indexOf(String(ls.mrKeysCols)) >= 0) clean.mrKeysCols = String(ls.mrKeysCols);
    if (['', 's', 'm', 'l'].indexOf(ls.mrKeysFont) >= 0) clean.mrKeysFont = ls.mrKeysFont;
    if (ls.mrStage === '0' || ls.mrStage === '1') clean.mrStage = ls.mrStage;
    var cs = okJson(ls.mrCtrlSize, 500); if (cs) { var c2 = {}; for (var k in CS_DEF) if (typeof cs[k] === 'number' && isFinite(cs[k])) c2[k] = Math.max(0, Math.min(600, cs[k])); clean.mrCtrlSize = JSON.stringify(c2); }
    var mu = okJson(ls.MR_UI, 500); if (mu) clean.MR_UI = JSON.stringify({ size: Math.max(0, Math.min(2, parseInt(mu.size, 10) || 0)) });
    var pu = okJson(ls.MR_PRO_UI, 2000); if (pu) { var p2 = {}; for (var pk in pu) if (/^[A-Za-z0-9_]{1,24}$/.test(pk) && (typeof pu[pk] === 'string' || typeof pu[pk] === 'number' || typeof pu[pk] === 'boolean') && String(pu[pk]).length < 40) p2[pk] = pu[pk]; clean.MR_PRO_UI = JSON.stringify(p2); }
    if (typeof ls.mrOutName === 'string' && ls.mrOutName.length <= 120) clean.mrOutName = ls.mrOutName;
    for (var key in clean) { if ((key === 'MR_PRO_UI' || key === 'mrOutName') && lsGetS(key) !== clean[key]) needReload = true; try { localStorage.setItem(key, clean[key]); } catch (e) {} }
    if (clean.mrAccent) applyAcc(clean.mrAccent);
    if (clean.mrStage) stage(clean.mrStage === '1');
    if (clean.mrLcd) applyLcd(clean.mrLcd);
    if (clean.mrDim !== undefined) applyDim(+clean.mrDim);
    if (window.paKeysView && (clean.mrKeysCols || clean.mrKeysFont !== undefined)) window.paKeysView(+clean.mrKeysCols || 2, clean.mrKeysFont || '');
    if (clean.mrCtrlSize) csApply(csLoad());
    if (clean.MR_UI && window.mrSetFontSize) { var fz = JSON.parse(clean.MR_UI).size; window.mrSetFontSize(fz); var fs = document.getElementById('settingFontSize'); if (fs) fs.value = String(fz); }
    var rt = o.rt && typeof o.rt === 'object' ? o.rt : {};
    try {
      if (typeof rt.synth === 'boolean' && rt.synth !== isSynthEnabled) toggleAudioSynth();
      var pb = parseInt(rt.pbRange, 10); if ([1, 2, 4, 8, 12].indexOf(pb) >= 0) setPitchBendRange(pb);
      if (typeof rt.dual === 'boolean' && rt.dual !== dualEnabled) setDual(rt.dual);
      var tr = Math.max(-12, Math.min(12, parseInt(rt.transpose, 10) || 0)), n = 0; while (transposeSemis !== tr && n++ < 30) stepTranspose(tr > transposeSemis ? 1 : -1);
      var oc = Math.max(-3, Math.min(3, parseInt(rt.octave, 10) || 0)); n = 0; while (octaveShift !== oc && n++ < 10) stepOctave(oc > octaveShift ? 1 : -1);
    } catch (e) {}
    var ch = o.chk && typeof o.chk === 'object' ? o.chk : {};
    CHK.forEach(function (id) { var e = document.getElementById(id); if (e && typeof ch[id] === 'boolean' && e.checked !== ch[id]) { e.checked = ch[id]; e.dispatchEvent(new Event('change', { bubbles: true })); } });
    if (clean.mrViewMode && window.paSetMode) window.paSetMode(clean.mrViewMode);
    if (needReload) setTimeout(function () { location.reload(); }, 400);
  };

  /* label dua bahasa untuk baris Pengaturan dan tombol ⚙ Ukuran */
  var TPL = { lcdT: ['Warna Layar Pa5X', 'Pa5X Screen Color'], lcdD: ['Warna LCD tampilan Pa5X. Utama hijau; KLASIK = ikut warna tema Klasik; ✎ = pilih warna sendiri.', 'LCD color of the Pa5X view. Green by default; CLASSIC = follow the Classic theme color; ✎ = pick your own.'], lcdAcc: ['KLASIK', 'CLASSIC'],
    dimT: ['Redup Layar (Dimmer)', 'Screen Dimmer'], dimD: ['Meredupkan layar untuk panggung gelap dan hemat baterai.', 'Dims the screen for dark stages and saves battery.'] };
  function tpLabels() {
    document.querySelectorAll('[data-tpl]').forEach(function (e) { var v = TPL[e.dataset.tpl]; if (v) e.textContent = T(v[0], v[1]); });
    document.querySelectorAll('.cs-gear').forEach(function (b) { b.textContent = T('⚙ Ukuran', '⚙ Size'); });
    var sb = document.getElementById('tpStageBtn'); if (sb) sb.textContent = T('Panggung: ', 'Stage: ') + (document.body.classList.contains('stage') ? 'ON' : 'OFF');
    var v = document.getElementById('tpDimVal'); var r = document.getElementById('tpDimRange'); if (v && r) v.textContent = +r.value ? r.value + '%' : 'Normal';
  }
  (window.mrLangHooks = window.mrLangHooks || []).push(tpLabels);

  /* warna LCD Pa5X + dimmer layar (di Pengaturan) */
  /* Warna layar Pa5X: dasar HIJAU. Warna lain = geser hue (+ saturasi) dari hijau.
     Preset, 'accent' (ikut warna tema Klasik), atau '#rrggbb' (custom). */
  var LCDP = { green: '#00ff66', amber: '#ffb000', ice: '#38bdf8', cyan: '#22d3ee', violet: '#a78bfa', rose: '#fb7185', red: '#ef4444' };
  function hexHsl(hex) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || ''); if (!m) return null;
    var r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, hh = 0, l = (mx + mn) / 2;
    if (d) { hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh *= 60; if (hh < 0) hh += 360; }
    var sat = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
    return { h: hh, s: sat };
  }
  function accHex() { var a = (ACC[curAcc()] || ACC.emas)[0].split(' ').map(Number); return '#' + a.map(function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
  function lcdHex(k) { if (k === 'accent') return accHex(); if (LCDP[k]) return LCDP[k]; return /^#[0-9a-f]{6}$/i.test(k) ? k : LCDP.green; }
  function applyLcd(k) {
    if (!k || (!LCDP[k] && k !== 'accent' && !/^#[0-9a-f]{6}$/i.test(k))) k = 'green';
    var h = document.documentElement; h.classList.remove('lcd-amber', 'lcd-ice', 'lcd-x');
    var c = hexHsl(lcdHex(k)), base = 144, rot = Math.round(c.h - base);
    if (k !== 'green' && (Math.abs(rot) > 2 || c.s < .9)) {
      h.classList.add('lcd-x');
      h.style.setProperty('--lcd-rot', rot + 'deg');
      h.style.setProperty('--lcd-sat', Math.max(0, Math.min(1, c.s)).toFixed(2));
    }
    try { localStorage.setItem('mrLcd', k); } catch (e) {}
    document.querySelectorAll('.tp-lcd-btn').forEach(function (b) { b.classList.toggle('on', b.dataset.l === k || (b.dataset.l === 'custom' && /^#/.test(k))); });
    var ci = document.getElementById('tpLcdColor'); if (ci && /^#/.test(k)) ci.value = k;
  }
  window.mrApplyLcd = applyLcd;
  function applyDim(n) {
    n = Math.max(0, Math.min(70, n | 0)); var d = document.getElementById('mrDim');
    if (!d) { d = document.createElement('div'); d.id = 'mrDim'; document.body.appendChild(d); }
    d.style.opacity = n / 100; try { localStorage.setItem('mrDim', String(n)); } catch (e) {}
    var r = document.getElementById('tpDimRange'); if (r && +r.value !== n) r.value = n; var v = document.getElementById('tpDimVal'); if (v) v.textContent = n ? n + '%' : 'Normal';
  }
  window.addEventListener('DOMContentLoaded', function () {
    var l0 = 'green', d0 = 0; try { l0 = localStorage.getItem('mrLcd') || 'green'; d0 = parseInt(localStorage.getItem('mrDim'), 10) || 0; } catch (e) {}
    applyLcd(l0); applyDim(d0);
    var sel = document.getElementById('settingViewMode'), row = sel && sel.parentNode; if (!row || document.getElementById('tpDimRange')) return;
    var cls = row.className;
    var r1 = document.createElement('div'); r1.className = cls;
    r1.innerHTML = '<div><span class="font-bold text-slate-200 block" data-tpl="lcdT"></span><span class="text-[10px] text-slate-400" data-tpl="lcdD"></span></div><div class="tp-lcd">' +
      Object.keys(LCDP).map(function (k) { return '<button type="button" class="tp-lcd-btn" data-l="' + k + '" style="--s:' + LCDP[k] + '" aria-label="' + k + '" title="' + k + '"></button>'; }).join('') +
      '<button type="button" class="tp-lcd-btn tp-lcd-acc" data-l="accent" title="Klasik"><span data-tpl="lcdAcc"></span></button>' +
      '<label class="tp-lcd-btn tp-lcd-cus" data-l="custom" title="Custom"><input type="color" id="tpLcdColor" value="#00ff66" aria-label="Custom"><span>✎</span></label></div>';
    var r2 = document.createElement('div'); r2.className = cls;
    r2.innerHTML = '<div><span class="font-bold text-slate-200 block" data-tpl="dimT"></span><span class="text-[10px] text-slate-400" data-tpl="dimD"></span></div><div class="tp-dim"><input type="range" id="tpDimRange" min="0" max="70" step="5" value="' + d0 + '"><em id="tpDimVal"></em></div>';
    row.after(r1); r1.after(r2);
    tpLabels();
    r1.addEventListener('click', function (e) { var b = e.target.closest('[data-l]'); if (b && b.dataset.l !== 'custom') applyLcd(b.dataset.l); });
    var ci = document.getElementById('tpLcdColor'); if (ci) ci.addEventListener('input', function () { applyLcd(ci.value.toLowerCase()); });
    r2.querySelector('input').addEventListener('input', function (e) { applyDim(+e.target.value); });
    applyLcd(l0); applyDim(d0);
  });
})();
