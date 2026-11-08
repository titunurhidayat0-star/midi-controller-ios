/* =====================================================================
   MIDI ROYALE PRO - KLASIK: MAIN / VOICE / TOOLS terpisah (seperti Pa5X)
   - Tab MAIN: layar utama lega (akor, nama Performance/voice + ikon, UP1-3, ◀ ▶) +
     satu bilah rapi: TRANSPOSE, OCTAVE, DUAL, KEYS.
   - Tab VOICE: hanya daftar voice (cari, bank, kategori, grid).
   - Tab TOOLS: tombol yang jarang dipakai saat main: REG/MEM 1-8, SUS/SPLIT/REC/SETLIST/LOCK,
     port MIDI, model keyboard, layar penuh, Export/Import/Logout.
   - Header: logo, tab, Pa5X, PANIC, pengaturan.
   Hanya memindah elemen yang sudah ada (fungsi & id tetap sama). Dimuat paling akhir.
   ===================================================================== */
(function () {
  'use strict';
  var $ = function (i) { return document.getElementById(i); };
  function en() { try { return currentLang === 'en'; } catch (e) { return false; } }
  function T(a, b) { return en() ? b : a; }
  function isPa() { return document.body.classList.contains('pa-mode'); }
  var cur = 'main', built = false;

  function card(id, title) {
    var c = document.createElement('div'); c.className = 'cm-card'; c.id = id;
    c.innerHTML = '<div class="cm-ttl" data-cmt="' + id + '"></div><div class="cm-body"></div>';
    return c;
  }
  function body(id) { return $(id).querySelector('.cm-body'); }
  function titles() {
    var L = {
      cmReg: T('REGISTRATION · tekan MEM lalu nomor untuk simpan · tahan 0,7 dtk untuk ganti nama', 'REGISTRATION · tap MEM then a number to store · hold 0.7 s to rename'),
      cmPro: T('PANGGUNG · SUS, SPLIT, REC, SETLIST, LOCK', 'STAGE · SUS, SPLIT, REC, SETLIST, LOCK'),
      cmConn: T('KONEKSI & KEYBOARD', 'CONNECTION & KEYBOARD'),
      cmData: T('DATA & AKUN', 'DATA & ACCOUNT')
    };
    Object.keys(L).forEach(function (k) { var t = document.querySelector('[data-cmt="' + k + '"]'); if (t) t.textContent = L[k]; });
    var nm = $('navMainBtn'); if (nm) nm.querySelector('.tl-full').textContent = 'MAIN';
    var nt = $('navToolsBtn'); if (nt) nt.querySelector('.tl-full').textContent = 'TOOLS';
    var fs = $('cmFsBtn'); if (fs) fs.textContent = '⛶ ' + T('LAYAR PENUH', 'FULLSCREEN');
  }
  function navBtn(id, label, icon, panel) {
    var b = document.createElement('button');
    b.id = id; b.type = 'button';
    b.className = 'main-tab-btn py-2 px-1.5 rounded-xl flex items-center justify-center gap-1 font-orbitron font-bold text-[10px] sm:text-xs whitespace-nowrap min-w-0';
    b.innerHTML = icon + ' <span class="tl"><span class="tl-full">' + label + '</span><span class="tl-short" aria-hidden="true">' + label + '</span></span>';
    b.addEventListener('click', function () { window.switchMainPanel(panel); });
    return b;
  }
  var IC_HOME = '<svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>';
  var IC_TOOL = '<svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/></svg>';

  function build() {
    if (built) return true;
    var nav = document.querySelector('body > .sticky > nav'), pv = $('navVoiceBtn'), pk = $('navKsetBtn'), ps = $('perfStrip');
    if (!nav || !pv || !ps) return false;
    built = true;
    document.body.classList.add('cm');
    // ---- tab: MAIN, VOICE, PERFORMANCE, QUARTER, CONTROL, STYLE, TOOLS
    nav.classList.remove('grid-cols-5'); nav.classList.add('cm-nav');
    nav.insertBefore(navBtn('navMainBtn', 'MAIN', IC_HOME, 'main'), nav.firstChild);
    if (pk) nav.insertBefore(pk, pv.nextSibling);
    nav.appendChild(navBtn('navToolsBtn', 'TOOLS', IC_TOOL, 'tools'));
    // ---- header kanan: Pa5X, PANIC, pengaturan (port MIDI & data pindah ke TOOLS)
    var hr = document.querySelector('body > .sticky > header > div:last-child'), tools = hr && hr.querySelector('.mr-tools');
    var panic = $('mrPanicTop');
    if (tools && panic) { var pa = $('mrToPaBtn'); tools.insertBefore(panic, pa ? pa.nextSibling : tools.firstChild); }
    // ---- panel TOOLS
    var t = document.createElement('section'); t.id = 'panelTools'; t.className = 'hidden cm-tools';
    var reg = card('cmReg'), pro = card('cmPro'), conn = card('cmConn'), data = card('cmData');
    [reg, pro, conn, data].forEach(function (c) { t.appendChild(c); });
    var kset = $('panelKset') || $('panelStyle'); kset.parentNode.insertBefore(t, kset.nextSibling);
    var rg = $('regGroup'); if (rg) body('cmReg').appendChild(rg);
    var rn = $('mrRegName'); if (rn) body('cmReg').appendChild(rn);
    var pst = $('proStrip'); if (pst) body('cmPro').appendChild(pst);
    var sel = $('midiOutSelect'), selBox = sel && sel.parentElement; if (selBox) { selBox.classList.add('cm-port'); body('cmConn').appendChild(selBox); }
    var chip = $('kbModelChip'); if (chip) body('cmConn').appendChild(chip);
    var fs = document.createElement('button'); fs.type = 'button'; fs.id = 'cmFsBtn'; fs.className = 'cm-btn';
    fs.addEventListener('click', function () { if (window.mrFullscreen) mrFullscreen(); });
    body('cmConn').appendChild(fs);
    var ex = document.querySelector('button[onclick="exportPresets()"]'), im = $('importFileInput'), lo = document.querySelector('button[onclick="handleLogout()"]');
    [ex, im && im.parentElement, lo].forEach(function (e) { if (e) { e.classList.remove('mr-sec'); e.classList.add('cm-btn'); body('cmData').appendChild(e); } });
    var more = hr && hr.querySelector('.mr-more'); if (more) more.style.display = 'none';
    // tombol layar penuh lama di kotak voice dipindah ke TOOLS
    var ofs = $('mrFsBtn'); if (ofs && ofs.parentElement) ofs.parentElement.classList.add('cm-hide');
    // CHORD masuk ke kotak utama (tidak memakan satu baris sendiri)
    var st = $('mrHeroStat'), vb = document.querySelector('#mrHero .mr-vbox'); if (st && vb) vb.appendChild(st);
    titles();
    return true;
  }

  function setNav(p) {
    var map = { main: 'navMainBtn', voice: 'navVoiceBtn', kset: 'navKsetBtn', qt: 'navQtBtn', ctrl: 'navCtrlBtn', style: 'navStyleBtn', tools: 'navToolsBtn' };
    Object.keys(map).forEach(function (k) { var b = $(map[k]); if (b) b.classList.toggle('active', k === p); });
  }
  function apply(p) {
    cur = p;
    var b = document.body;
    b.classList.toggle('cm-main', p === 'main');
    b.classList.toggle('cm-voice', p === 'voice');
    b.classList.toggle('cm-tools', p === 'tools');
    var t = $('panelTools'); if (t) t.classList.toggle('hidden', p !== 'tools');
    setNav(p);
    try { if (window.lucide) lucide.createIcons(); } catch (e) {}
    if (p === 'voice') requestAnimationFrame(function () { try { renderVoiceTiles(); } catch (e) {} });
    if (p === 'main') heroIcon();
  }
  var _sw = window.switchMainPanel;
  window.switchMainPanel = function (p) {
    if (!built || isPa()) return _sw.apply(this, arguments);
    if (document.body.classList.contains('pro-pop') && window.mrToggleProMenu) { try { document.body.classList.remove('pro-pop'); } catch (e) {} }
    if (p === 'main') { _sw.call(this, 'voice'); apply('main'); return; }
    if (p === 'tools') { _sw.call(this, 'tools'); apply('tools'); return; }
    var r = _sw.apply(this, arguments);
    apply(p);
    return r;
  };
  window.mrClassicPanel = function () { return cur; };
  // nama voice/Performance di MAIN (mode SOUND) membuka tab VOICE, bukan layar penuh
  var _of = window.mrOpenFull;
  window.mrOpenFull = function () {
    if (built && !isPa()) { window.switchMainPanel('voice'); return; }
    if (_of) return _of.apply(this, arguments);
  };
  // memilih sound untuk Upper dari MAIN: setelah dipilih kembali ke MAIN
  var _sel = window.selectVoiceTile;
  window.selectVoiceTile = function (id) {
    var back = built && !isPa() && cur === 'voice' && window.mrPerfPicking && window.mrPerfPicking() > 0;
    var r = _sel.apply(this, arguments);
    if (back) setTimeout(function () { window.switchMainPanel('main'); }, 120);
    return r;
  };
  // kembali dari Pa5X: buka MAIN
  var _pm = window.paSetMode;
  if (typeof _pm === 'function') window.paSetMode = function (m) {
    var r = _pm.apply(this, arguments);
    if (m !== 'pa' && built) setTimeout(function () { window.switchMainPanel('main'); }, 0);
    return r;
  };

  // ikon sound Upper 1 di samping nama (seperti kotak ikon Pa5X)
  function heroIcon() {
    var nm = document.querySelector('#mrHero .mr-name'); if (!nm) return;
    var ic = nm.querySelector('.cm-ico');
    if (!ic) { ic = document.createElement('span'); ic.className = 'cm-ico'; nm.insertBefore(ic, nm.firstChild); }
    var t = null;
    try {
      if (window.mrPerfOn && mrPerfOn() && window.MRKSET) t = MRKSET.upTile(MRKSET.state.cur[1]);
      else t = voiceTiles.find(function (x) { return x.id === activeTileId; });
    } catch (e) {}
    var k = t ? (t.customImg ? 'i:' + t.customImg : 'k:' + (t.iconKey || 'piano')) : 'none';
    if (ic.dataset.k === k) return;
    ic.dataset.k = k;
    if (!t) ic.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg>';
    else if (t.customImg) { ic.innerHTML = ''; var im = document.createElement('img'); im.src = t.customImg; im.alt = ''; ic.appendChild(im); }
    else { try { ic.innerHTML = svgIconPresets[t.iconKey] || svgIconPresets.piano; } catch (e) {} }
  }
  var _rvt = window.renderVoiceTiles;
  if (typeof _rvt === 'function') window.renderVoiceTiles = function () { var r = _rvt.apply(this, arguments); try { heroIcon(); } catch (e) {} return r; };

  (window.mrLangHooks = window.mrLangHooks || []).push(function () { titles(); setNav(cur); });
  function boot() {
    if (!build()) return;
    if (window.MRKSET) MRKSET.onChange(heroIcon);
    if (!isPa()) window.switchMainPanel('main');
    heroIcon();
  }
  window.addEventListener('load', function () { setTimeout(boot, 60); });
})();
