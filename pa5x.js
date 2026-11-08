/* Mode tampilan Pa5X: lapisan tampilan terpisah. Semua tombol memanggil fungsi aplikasi yang sama.
   Layout MAIN / Keys / Control / Scale Tuning / Style mengikuti desain Pa5X.
   Fitur Klasik yang tidak punya tempat di layout tersebut dikumpulkan di tab TOOLS. */
(function () {
  var $ = function (i) { return document.getElementById(i); };
  var root = null, mode = 'classic', timer = null, moved = [], lpTimer = null;
  var SLOTS = { kset: 'panelKset', control: 'panelCtrl', scale: 'panelQt', style: 'panelStyle' };
  var TABS = [['main', 'MAIN'], ['keys', 'Keys'], ['kset', 'Performance'], ['control', 'Control'], ['scale', 'Scale Tuning'], ['style', 'Style'], ['tools', 'Tools']];
  var ICON = { main: 'home', keys: 'keyboard-music', kset: 'layers', control: 'sliders-horizontal', scale: 'activity', style: 'play-circle', tools: 'wrench' };
  function ic(n) { return '<i data-lucide="' + n + '"></i>'; }
  function isEn() { try { return currentLang === 'en'; } catch (e) { return false; } }
  function T(a, b) { return isEn() ? b : a; }
  // Teks statis Pa5X (dua bahasa). Elemen bertanda data-pt diisi ulang saat bahasa diganti.
  var PT = {
    hint: ['Ketuk untuk memilih voice', 'Tap to choose a voice'],
    khint: ['EDIT ON: ketuk voice untuk ubah nama, kategori, ikon, Bank MSB, LSB, dan Program PC. Tahan baris 0,6 dtk = langsung edit.', 'EDIT ON: tap a voice to change its name, category, icon, Bank MSB, LSB and Program PC. Hold a row 0.6 s = edit at once.'],
    addtile: ['TAMBAH TILE', 'ADD TILE'],
    data: ['DATA &amp; AKUN', 'DATA &amp; ACCOUNT'],
    dinfo: ['Export/Import memakai file preset JSON yang sama dengan tampilan Klasik.', 'Export/Import use the same JSON preset file as the Classic view.'],
    reg: ['REGISTRATION · MEM 1-8 · tekan MEM lalu nomor untuk simpan, tahan 0,7 dtk untuk ganti nama', 'REGISTRATION · MEM 1-8 · tap MEM then a number to store, hold 0.7 s to rename'],
    classic: ['KLASIK', 'CLASSIC']
  };
  function pt(k) { return '<span data-pt="' + k + '">' + PT[k][isEn() ? 1 : 0] + '</span>'; }
  function relabel() {
    if (!root) return;
    root.querySelectorAll('[data-pt]').forEach(function (e) { var v = PT[e.dataset.pt]; if (v) e.innerHTML = v[isEn() ? 1 : 0]; });
    var sx = $('paSearch'); if (sx) sx.placeholder = T('Cari voice...', 'Search voice...');
    refresh();
  }
  (window.mrLangHooks = window.mrLangHooks || []).push(function () { relabel(); });
  function kbdArt() {
    var w = '', b = '', k = [0, 1, 3, 4, 5, 7, 8, 10, 11, 12], i;
    for (i = 0; i < 14; i++) w += '<rect x="' + (i * 20) + '" y="1" width="19" height="68" rx="2"/>';
    for (i = 0; i < k.length; i++) b += '<rect x="' + (k[i] * 20 + 14) + '" y="1" width="12" height="40" rx="2"/>';
    return '<svg class="kbd-art" viewBox="0 0 280 70" preserveAspectRatio="xMidYMax meet"><g class="w">' + w + '</g><g class="b">' + b + '</g></svg>';
  }
  function hue(s) { var h = 0; s = String(s); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
  function fitVoice(el) { el.style.fontSize = ''; var fs = parseFloat(getComputedStyle(el).fontSize), n = 0; while (el.scrollWidth > el.clientWidth + 1 && fs > 14 && n++ < 30) { fs -= 2; el.style.fontSize = fs + 'px'; } }
  var WM = [0, -1, 1, -1, 2, 3, -1, 4, -1, 5, -1, 6], BM = [-1, 0, -1, 1, -1, -1, 2, -1, 3, -1, 4, -1];
  // Tuts dari keyboard menyala pada oktaf yang benar: gambar 2 oktaf mengikuti rentang keyboard virtual (kbBase).
  function lightKey(note, on) {
    var base = 48; try { if (typeof kbBase === 'number') base = kbBase; } catch (e) {}
    var rel = note - base; if (rel < 0 || rel >= 24) return;
    var o = rel >= 12 ? 1 : 0, n = rel % 12, svg = document.querySelector('#paRoot .kbd-art'); if (!svg) return;
    var r = WM[n] >= 0 ? svg.querySelectorAll('.w rect')[o * 7 + WM[n]] : svg.querySelectorAll('.b rect')[o * 5 + BM[n]];
    if (r) r.classList.toggle('lit', on);
  }
  function onMidiNote(e) {
    var d = e.data; if (!d || d.length < 2) return; var st = d[0] & 0xF0;
    if ((d[0] & 0x0F) === 9 && st !== 0xB0) return;   // channel 10 (drum) diabaikan
    if (window.mrKeysChordOn && !window.mrKeysChordOn()) return;
    if (st === 0x90 && d[2] > 0) lightKey(d[1], true);
    else if (st === 0x80 || st === 0x90) lightKey(d[1], false);
    else if (st === 0xB0 && (d[1] === 123 || d[1] === 120)) document.querySelectorAll('#paRoot .kbd-art .lit').forEach(function (x) { x.classList.remove('lit'); });
  }
  // MIDI IN lewat pintu terpusat (index.html: onMidiInput), tetap terpasang walau port dipindai ulang
  if (typeof window.onMidiInput === 'function') window.onMidiInput(onMidiNote);
  var rowLp = 0;
  var lastTap = { id: '', t: 0 }, keysCols = 2, keysFont = '', recent = [], lastActive = null;
  function lsg(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lss(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function keysView(c, f) {
    keysCols = Math.max(1, Math.min(3, c | 0)) || 2; keysFont = f === 's' || f === 'm' || f === 'l' ? f : '';
    lss('mrKeysCols', String(keysCols)); lss('mrKeysFont', keysFont);
    var l = $('paList'); if (l) { l.style.setProperty('--kc', keysCols); l.className = l.className.replace(/\s*kf-[sml]/g, '') + (keysFont ? ' kf-' + keysFont : ''); }
    var b = $('paKcols'); if (b) b.textContent = '▦ ' + keysCols; b = $('paKfont'); if (b) b.textContent = 'Aa' + (keysFont ? ' ' + keysFont.toUpperCase() : '');
  }
  window.paKeysView = keysView;
  try { recent = JSON.parse(lsg('mrRecentVoices') || '[]'); if (!Array.isArray(recent)) recent = []; } catch (e) { recent = []; }
  function vIcon(t) { if (!t) return ''; if (t.customImg) return '<img src="' + esc(t.customImg) + '" alt="">'; try { return svgIconPresets[t.iconKey] || svgIconPresets.piano || ''; } catch (e) { return ''; } }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function sgn(n) { return (n > 0 ? '+' : '') + n; }
  function setTxt(el, v) { if (el && el.textContent !== v) el.textContent = v; }
  function setCls(el, c, on) { if (el) el.classList.toggle(c, !!on); }

  /* Render ulang daftar Keys setiap kali daftar voice di aplikasi utama berubah (tambah/edit/favorit). */
  var baseRender = window.renderVoiceTiles;
  if (typeof baseRender === 'function') {
    window.renderVoiceTiles = function () {
      var r = baseRender.apply(this, arguments);
      if (mode === 'pa' && root) renderKeys();
      return r;
    };
  }

  /* Aplikasi utama kadang memanggil switchMainPanel (impor preset, ganti bahasa, dsb) yang menyembunyikan panel.
     Di mode Pa5X panel itu menjadi isi tab, jadi harus selalu ditampilkan lagi. */
  function showSlots() {
    Object.keys(SLOTS).forEach(function (k) { var p = $(SLOTS[k]); if (p && p.classList.contains('hidden')) p.classList.remove('hidden'); });
  }
  var baseSwitch = window.switchMainPanel;
  if (typeof baseSwitch === 'function') {
    window.switchMainPanel = function () {
      var r = baseSwitch.apply(this, arguments);
      if (mode === 'pa') showSlots();
      return r;
    };
  }

  function build() {
    root = document.createElement('div'); root.id = 'paRoot';
    var regs = ''; for (var i = 0; i < 8; i++) regs += '<button data-reg="' + i + '">' + ic('keyboard-music') + '<span>REG ' + (i + 1) + '</span></button>';
    root.innerHTML =
      '<div class="pa-top"><button class="pa-home" data-go="main">' + ic('home') + 'HOME</button><div class="pa-brand"><b>MIDI ROYALE PRO</b><span><span class="pa-dot" id="paDot"></span><em class="mr-author">KING TITU</em></span></div><span id="paMidiSlot"></span>' +
      '<button type="button" class="pa-kbchip" data-act="kbmodel" id="paKbChip">' + ic('keyboard-music') + '<span>KEYBOARD</span></button><span class="sp"></span>' +
      '<span class="pa-chord" id="paChord"><small>CHORD</small><b>&ndash;</b></span>' +
      '<span class="pa-beat" id="paBeat" title="Tempo dari keyboard"><i></i><b>---</b></span><span class="pa-readout" id="paRead"></span><button data-act="panic">' + ic('octagon-alert') + 'PANIC</button><button data-act="lock" id="paLockBtn">' + ic('lock') + 'LOCK</button><button data-act="settings">⚙ SETTINGS</button><button data-act="classic">' + pt('classic') + '</button></div>' +
      '<div class="pa-body">' +
      '<div class="pa-scr on" id="paScr-main">' +
        '<div class="pa-card pa-keys" data-go="keys"><div class="ico-box" id="paVIco">' + ic('keyboard-music') + '</div><div class="info"><div class="k" id="paKLbl">' + ic('music-2') + '<span>UPPER 1 · SOUND</span></div><div class="sub" id="paVoiceSub"></div><div class="pa-kset" id="paKsetName"></div>' +
          '<div class="vrow"><div class="big" id="paVoice">-</div></div><div class="hint">' + pt('hint') + ' ' + ic('chevron-right') + '</div><div class="pa-uplist" id="paUpList"></div><div class="recent" id="paRecent"></div>' +
          '<div class="pa-vnav"><button type="button" class="vnav" data-act="prev" aria-label="Voice sebelumnya"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg></button><button type="button" class="vnav" data-act="next" aria-label="Voice berikutnya"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button></div></div>' +
          '<div class="pa-ups"><div class="pa-up on" id="paUp1">UP1<i></i></div><div class="pa-up" id="paUp2">UP2<i></i></div><div class="pa-up" id="paUp3">UP3<i></i></div><div class="pa-up" id="paLwr">LWR<i></i></div></div>' + kbdArt() + '<div class="deco">' + new Array(15).join('<i></i>') + '</div></div>' +
        '<div class="pa-stat" id="paStat"></div>' +
        '<div class="pa-card pa-ctl pa-ctl2">' +
          '<div class="pa-step"><button data-act="tr-" aria-label="Transpose -"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h12"/></svg></button><button data-act="trreset" class="val"><small>TRANSPOSE</small><b id="paTr">0</b></button><button data-act="tr+" aria-label="Transpose +"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v12M6 12h12"/></svg></button></div>' +
          '<div class="pa-step"><button data-act="oc-" aria-label="Octave -"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7l5 5 5-5"/><path d="M7 13l5 5 5-5"/></svg></button><button data-act="ocreset" class="val"><small>OCTAVE</small><b id="paOc">0</b></button><button data-act="oc+" aria-label="Octave +"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17l5-5 5 5"/><path d="M7 11l5-5 5 5"/></svg></button></div>' +
          '<span class="pa-csp"></span>' +
          '<button data-act="dual" id="paDual" class="pa-pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg><span>DUAL</span></button><button data-act="regstore" id="paMem" class="pa-pill mem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h8V3"/><path d="M8 21v-7h8v7"/></svg><span>MEM</span></button></div>' +
      '</div>' +
      '<div class="pa-scr" id="paScr-keys"><div class="pa-kb"><button class="badge" data-go="main">&lt; EXIT</button>' +
        '<button data-act="pick1" id="paPick1">UPPER 1</button><button data-act="pick2" id="paPick2">UPPER 2</button><button data-act="pick3" id="paPick3">UPPER 3</button>' +
        '<button data-act="kcols" id="paKcols">▦ 2</button><button data-act="kfont" id="paKfont">Aa</button>' +
        '<button data-act="kedit" id="paKEdit" class="pa-kedit">✎ EDIT</button><button data-act="addtile" class="pa-kadd">+ VOICE</button><button type="button" class="pa-klib" onclick="if(window.mrOpenVoiceLib)mrOpenVoiceLib()">📚 LIBRARY</button><input id="paSearch" type="search" placeholder="' + T('Cari voice...', 'Search voice...') + '"></div>' +
        '<div class="pa-khint" id="paKHint">' + pt('khint') + '</div>' +
        '<div class="pa-split"><div class="pa-cats" id="paCats"></div><div class="pa-list" id="paList"></div></div><div class="pa-banks" id="paBanks"></div></div>' +
      '<div class="pa-scr pa-slot" id="paScr-kset"></div><div class="pa-scr pa-slot" id="paScr-control"></div><div class="pa-scr pa-slot" id="paScr-scale"></div><div class="pa-scr pa-slot" id="paScr-style"></div>' +
      '<div class="pa-scr pa-tools" id="paScr-tools">' +
        '<div class="pa-card pa-tcard"><span class="pa-ttl">' + ic('music-2') + 'VOICE</span>' +
          '<div class="pa-trow"><button data-act="prev">' + ic('chevron-left') + ' PREV</button><button class="pa-tname" data-go="keys" id="paToolVoice">-</button><button data-act="next">NEXT ' + ic('chevron-right') + '</button></div>' +
          '<div class="pa-trow"><button data-act="addtile">' + ic('plus') + ' ' + pt('addtile') + '</button><button data-act="edit" id="paEdit">EDIT: OFF</button><button data-act="fs" id="paFs">⛶ FULLSCREEN</button></div>' +
          '<div class="pa-tinfo" id="paToolInfo"></div></div>' +
        '<div class="pa-card pa-tcard"><span class="pa-ttl">' + ic('database') + pt('data') + '</span>' +
          '<div class="pa-trow"><button data-act="export">' + ic('download') + ' EXPORT</button><label class="pa-fbtn">' + ic('upload') + ' IMPORT<input type="file" id="paImport" accept=".json,application/json"></label><button data-act="logout" class="warn">' + ic('log-out') + ' LOGOUT</button></div>' +
          '<div class="pa-tinfo">' + pt('dinfo') + '</div></div>' +
        '<div class="pa-card pa-tcard pa-wide pa-regcard"><span class="pa-ttl">' + ic('list-music') + pt('reg') + '</span><div class="pa-regs">' + regs + '</div></div>' +
        '<div class="pa-card pa-tcard pa-wide"><span class="pa-ttl">' + ic('gauge') + 'PERFORMANCE</span>' +
          '<div class="pa-trow" id="paProSlot"></div>' +
          '<div class="pa-trow"><button data-act="kbd" id="paKbd">KEYS · KEYBOARD</button></div>' +
          '<div class="pa-tinfo" id="paRegInfo"></div></div>' +
      '</div>' +
      '</div>' +
      '<div id="paVk"></div>' +
      '<div class="pa-tabs">' + TABS.map(function (t) { return '<button data-go="' + t[0] + '"><i data-lucide="' + ICON[t[0]] + '"></i><span>' + t[1] + '</span><b class="tdot"></b></button>'; }).join('') + '</div>';
    document.body.appendChild(root);
    try { if (window.mrSetUserLabel && typeof auth !== 'undefined') mrSetUserLabel(auth.currentUser); } catch (e) {}
    try { if (window.lucide && lucide.createIcons) lucide.createIcons(); } catch (e) {}
    root.addEventListener('click', onClick);
    keysView(parseInt(lsg('mrKeysCols'), 10) || 2, lsg('mrKeysFont') || '');

    /* REG 1-8: tekan = pilih registrasi, tahan 0,7 detik = ubah nama (sama seperti tombol Mem di Klasik) */
    root.addEventListener('pointerdown', function (e) {
      var b = e.target.closest('[data-reg]'); if (!b) return;
      e.preventDefault();
      var i = parseInt(b.dataset.reg, 10);
      regPress(i); refresh();
      clearTimeout(lpTimer);
      lpTimer = setTimeout(function () { lpTimer = null; renameReg(i); }, 700);
    });
    // tahan baris voice 0,6 detik = langsung buka editor (nama, MSB, LSB, PC)
    var rowT = null, rowP = null;
    root.addEventListener('pointerdown', function (e) {
      var r = e.target.closest('.pa-row[data-id]'); if (!r) return;
      clearTimeout(rowT);
      rowP = { x: e.clientX, y: e.clientY, id: r.dataset.id };
      rowT = setTimeout(function () { rowT = null; rowLp = Date.now(); openEditTileModal(rowP.id); }, 600);
    });
    root.addEventListener('pointermove', function (e) { if (rowT && rowP && Math.abs(e.clientX - rowP.x) + Math.abs(e.clientY - rowP.y) >= 10) { clearTimeout(rowT); rowT = null; } });
    ['pointerup', 'pointercancel'].forEach(function (n) { root.addEventListener(n, function () { clearTimeout(rowT); rowT = null; }); });
    root.querySelectorAll('[data-reg]').forEach(function (b) {
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (n) { b.addEventListener(n, function () { clearTimeout(lpTimer); lpTimer = null; }); });
    });

    $('paSearch').addEventListener('input', function () { searchQuery = this.value.trim().toLowerCase(); renderKeys(); });
    $('paImport').addEventListener('change', function (e) { importPresets(e); });
  }

  function renameReg(i) {
    try {
      if (!regBanks[i]) return;
      mrInput(T('Nama Mem ', 'Mem name ') + (i + 1), regBanks[i].name || '', function (n) {
        if (!regBanks[i]) return;
        regBanks[i].name = String(n).trim().slice(0, 24);
        saveLocalStoragePreset(); updateRegUI(); refresh();
      });
    } catch (e) {}
  }

  function perfOn() { return !!(window.mrPerfOn && window.mrPerfOn()); }
  function onClick(e) {
    var up = e.target.closest('[data-up]');
    if (up && window.mrPerfPick) { e.stopPropagation(); window.mrPerfPick(parseInt(up.dataset.up, 10)); return; }
    var ps = e.target.closest('[data-psave]');
    if (ps && window.mrPerfSave) { e.stopPropagation(); window.mrPerfSave(); refresh(); return; }
    var bk = e.target.closest('[data-bank]');
    if (bk && window.mrSetBank) { e.stopPropagation(); window.mrSetBank(bk.dataset.bank); renderKeys(); return; }
    var vn = e.target.closest('.vnav[data-act]');
    if (vn && perfOn() && window.MRKSET) { e.stopPropagation(); MRKSET.step(vn.dataset.act === 'prev' ? -1 : 1); refresh(); return; }
    if (perfOn() && e.target.closest('#paScr-main .pa-keys') && !e.target.closest('[data-rec]')) { go('kset'); return; }
    var fv = e.target.closest('[data-fav]');
    if (fv) { e.stopPropagation(); toggleFavorite(fv.dataset.fav); return; }
    var ed = e.target.closest('[data-edit]');
    if (ed) { e.stopPropagation(); openEditTileModal(ed.dataset.edit); return; }
    var el = e.target.closest('[data-go],[data-act],[data-cat],[data-id],[data-sty],[data-rec]');
    if (!el || el.closest('.pa-slot')) return;
    if (el.dataset.sty) { try { triggerStyleCommand(el.dataset.sty); } catch (x) {} return refresh(); }
    if (el.dataset.rec) { selectVoiceTile(el.dataset.rec); return refresh(); }
    if (el.dataset.go) return go(el.dataset.go);
    if (el.dataset.cat) { activeCategory = el.dataset.cat; searchQuery = ''; $('paSearch').value = ''; if (window.renderVoiceTiles) renderVoiceTiles(); else renderKeys(); return; }
    if (el.dataset.id) {
      if (rowLp && Date.now() - rowLp < 700) { rowLp = 0; return; }        // baru saja dibuka lewat tahan lama
      if (isEditMode) { openEditTileModal(el.dataset.id); return; }
      var nowT = Date.now(), dbl = lastTap.id === el.dataset.id && nowT - lastTap.t < 450;
      lastTap = { id: el.dataset.id, t: nowT };
      selectVoiceTile(el.dataset.id); renderKeys(); refresh();
      if (dbl) { lastTap = { id: '', t: 0 }; go('main'); }
      return;
    }
    var a = el.dataset.act;
    if (a === 'kcols') { keysView((keysCols % 3) + 1, keysFont); return; } if (a === 'kfont') { keysView(keysCols, { '': 's', s: 'm', m: 'l', l: '' }[keysFont]); return; }
    if (a === 'tr-') stepTranspose(-1); else if (a === 'tr+') stepTranspose(1); else if (a === 'trreset') resetTranspose();
    else if (a === 'oc-') stepOctave(-1); else if (a === 'oc+') stepOctave(1); else if (a === 'ocreset') resetOctave();
    else if (a === 'dual') toggleDual(); else if (a === 'regstore') toggleRegStore();
    else if (a === 'pick1' || a === 'pick2' || a === 'pick3') {
      var pn = parseInt(a.slice(4), 10);
      if (perfOn() && window.mrPerfPick) window.mrPerfPick(pn);
      else if (pn === 1) { layerPickArmed = false; try { updateDualUI(); } catch (x) {} }
      else if (pn === 2) toggleLayerPick(); else toggleLayer3Pick();
    }
    else if (a === 'settings') openSettingsModal(); else if (a === 'classic') window.paSetMode('classic');
    else if (a === 'lock') { if (window.mrLock) window.mrLock(true); }
    else if (a === 'kbmodel') { if (window.mrOpenKbPicker) window.mrOpenKbPicker(); }
    else if (a === 'panic') { if (window.MRPRO && MRPRO.panic) MRPRO.panic(); else { var pb = $('proPanicBtn'); if (pb) pb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); } }
    else if (a === 'prev') mrStep(-1); else if (a === 'next') mrStep(1);
    else if (a === 'addtile') openAddInstrumentModal(); else if (a === 'edit' || a === 'kedit') toggleEditMode();
    else if (a === 'fs') mrFullscreen(); else if (a === 'kbd') toggleKeyboardDock();
    else if (a === 'export') exportPresets(); else if (a === 'logout') handleLogout();
    refresh();
  }

  function go(tab) {
    TABS.forEach(function (t) { var s = $('paScr-' + t[0]); if (s) s.classList.toggle('on', t[0] === tab); });
    root.querySelectorAll('.pa-tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.go === tab); });
    if (tab === 'keys') renderKeys();
    else if (window.mrPerfEndPick) window.mrPerfEndPick();
    if (tab === 'kset' && window.ksRender) window.ksRender();
    refresh();
  }
  window.paGo = function (t) { if (root && mode === 'pa') go(t); };
  window.paRenderKeys = function () { if (root && mode === 'pa') renderKeys(); };

  function renderKeys() {
    if (!root) return;
    $('paCats').innerHTML = categories.map(function (c) { return '<button data-cat="' + c.id + '" style="--h:' + hue(c.id) + '" class="' + (activeCategory === c.id && !searchQuery ? 'on' : '') + '">' + esc(c.name) + '</button>'; }).join('');
    var f = voiceTiles;
    if (searchQuery) f = voiceTiles.filter(function (t) { return (String(t.name) + ' ' + catNameOf(t.category)).toLowerCase().indexOf(searchQuery) >= 0; });
    else {
      if (window.mrBankOk) f = f.filter(window.mrBankOk);
      if (activeCategory === 'fav') f = f.filter(function (t) { return t.fav; });
      else if (activeCategory !== 'all') f = f.filter(function (t) { return t.category === activeCategory; });
    }
    var bb = $('paBanks'); if (bb && window.mrBankTabs) { var bh = window.mrBankTabs(); if (bb.dataset.k !== bh) { bb.dataset.k = bh; bb.innerHTML = bh; } }
    var onId = String(window.mrKeysOnId ? window.mrKeysOnId() : activeTileId);
    if (!f.length) { $('paList').innerHTML = '<div class="pa-empty">' + T('Tidak ada sound di bank / kategori ini', 'No sounds in this bank / category') + '</div>'; return; }
    $('paList').innerHTML = f.map(function (t) {
      return '<button class="pa-row' + (String(t.id) === onId ? ' on' : '') + '" data-id="' + esc(t.id) + '" style="--h:' + hue(t.category) + '"><span class="ico">KSC</span><span class="nm">' + esc(t.name) + '</span>' +
        (isEditMode ? '<span class="ed" data-edit="' + esc(t.id) + '">✎</span>' : '') +
        '<span class="fav' + (t.fav ? ' on' : '') + '" data-fav="' + esc(t.id) + '">' + (t.fav ? '★' : '☆') + '</span></button>';
    }).join('');
  }

  function refresh() {
    if (!root || mode !== 'pa') return;
    showSlots();
    var pin = perfOn() && window.mrPerfInfo ? window.mrPerfInfo() : null;
    var d = $('midiStatusDot'); setCls($('paDot'), 'ok', d && /emerald/.test(d.className));
    setTxt($('paRead'), 'TR ' + sgn(transposeSemis) + '  OCT ' + sgn(octaveShift));
    setTxt($('paTr'), sgn(transposeSemis)); setTxt($('paOc'), sgn(octaveShift));
    setCls($('paDual'), 'on', dualEnabled); setCls($('paMem'), 'on', regStoreArmed);
    var tl = voiceTiles.find(function (x) { return String(x.id) === String(activeTileId); });
    setTxt($('paVoice'), tl ? tl.name : '-'); setTxt($('paVoiceSub'), tl ? catNameOf(tl.category) : '');
    var vi = $('paVIco');
    if (vi && pin && !pin.ups[0].tile) {
      if (vi.dataset.k !== 'perf') { vi.dataset.k = 'perf'; vi.setAttribute('data-cat', ''); vi.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/><path d="M3 17.5l9 5 9-5" opacity=".5"/></svg>'; }
    } else if (vi) {
      if (pin) tl = pin.ups[0].tile;
      var ik = tl ? (tl.customImg ? 'img:' + tl.customImg : 'ic:' + (tl.iconKey || 'piano')) + '|' + tl.category : '';
      if (vi.dataset.k !== ik) {
        vi.dataset.k = ik;
        if (tl && tl.customImg) vi.innerHTML = '<img src="' + esc(tl.customImg) + '" alt="">';
        else if (tl) vi.innerHTML = (typeof svgIconPresets !== 'undefined' && (svgIconPresets[tl.iconKey] || svgIconPresets.piano)) || ic('keyboard-music');
        vi.setAttribute('data-cat', tl ? tl.category : '');
        vi.classList.remove('chg'); void vi.offsetWidth; vi.classList.add('chg');
      }
    }
    setCls($('paScr-main'), 'perf', !!pin);
    var kl = $('paKLbl'); if (kl) { var ks0 = kl.querySelector('span'); setTxt(ks0, pin ? 'PERFORMANCE' + (pin.idx ? ' · ' + pin.idx : '') : 'UPPER 1 · SOUND'); }
    if (pin) {
      setTxt($('paVoice'), pin.name); setTxt($('paVoiceSub'), pin.sub);
      var ht = root.querySelector('#paScr-main .hint [data-pt]'); if (ht) setTxt(ht, T('Ketuk nama Upper untuk ganti sound · ketuk layar untuk daftar Performance', 'Tap an Upper name to change its sound · tap the screen for the Performance list'));
    } else { var ht2 = root.querySelector('#paScr-main .hint [data-pt]'); if (ht2) setTxt(ht2, PT.hint[isEn() ? 1 : 0]); }
    var ksA = (window.MRKSET && MRKSET.state.lastAction === 'kset' && MRKSET.state.activeId) ? ((MRKSET.state.list.filter(function (k) { return k.id === MRKSET.state.activeId; })[0]) || {}).name : '';
    var kn = $('paKsetName'); if (kn) { setTxt(kn, pin ? '' : ksA ? 'PERFORMANCE · ' + ksA : (window.MRKSET && MRKSET.state.lastAction === 'sts' ? 'STS' : '')); setCls(kn, 'on', !!ksA); }
    var kc = $('paKbChip'); if (kc && window.mrKbChipName) { var kcs = kc.querySelector('span'); if (kcs) setTxt(kcs, window.mrKbChipName()); }
    var pv = $('paVoice'); if (pv && pv.clientWidth > 0 && pv.dataset.k !== pv.textContent) { pv.dataset.k = pv.textContent; fitVoice(pv); pv.classList.remove('chg'); void pv.offsetWidth; pv.classList.add('chg'); }
    if (pin) { setCls($('paUp1'), 'on', !!pin.ups[0].name); setCls($('paUp2'), 'on', !!pin.ups[1].name); setCls($('paUp3'), 'on', !!pin.ups[2].name); } else { setCls($('paUp1'), 'on', true); setCls($('paUp2'), 'on', dualEnabled); setCls($('paUp3'), 'on', dualEnabled && upper3Channel > 0); }
    setCls($('paLwr'), 'on', window.MRPRO && MRPRO.state && MRPRO.state.splitOn);
    root.querySelectorAll('[data-reg]').forEach(function (b) { var i = parseInt(b.dataset.reg, 10); setCls(b, 'has', regBanks[i]); setCls(b, 'on', activeRegIndex === i); });
    var pk = pin && window.mrPerfPicking ? window.mrPerfPicking() : -1;
    if (pk >= 0) { setCls($('paPick1'), 'on', pk === 1 || pk === 0); setCls($('paPick2'), 'on', pk === 2); setCls($('paPick3'), 'on', pk === 3); }
    else { setCls($('paPick1'), 'on', !layerPickArmed); setCls($('paPick2'), 'on', layerPickArmed && layerPickTarget === 2); setCls($('paPick3'), 'on', layerPickArmed && layerPickTarget === 3); }

    var rg0 = regBanks[activeRegIndex], lw = window.MRPRO && MRPRO.state && MRPRO.state.splitOn, midiOn = d && /emerald/.test(d.className);
    var st = '<span class="chip ' + (midiOn ? 'ok' : 'off') + '"><i class="dd"></i>MIDI ' + (midiOn ? T('TERHUBUNG', 'CONNECTED') : T('TERPUTUS', 'DISCONNECTED')) + '</span>' +
      (window.MRKSET && MRKSET.state.lastAction === 'kset' && MRKSET.state.activeId ? '<span class="chip ok2">KSET · ' + esc(((MRKSET.state.list.filter(function (k) { return k.id === MRKSET.state.activeId; })[0]) || {}).name || '') + '</span>' : '') + '<span class="chip' + (rg0 ? ' ok2' : '') + '">REG ' + (activeRegIndex >= 0 ? activeRegIndex + 1 : '-') + (rg0 && rg0.name ? ' · ' + esc(rg0.name) : '') + '</span>' +
      '<span class="chip' + (dualEnabled ? ' ok3' : '') + '">DUAL ' + (dualEnabled ? 'ON' : 'OFF') + '</span><span class="chip' + (lw ? ' ok4' : '') + '">SPLIT ' + (lw ? 'ON' : 'OFF') + '</span>';
    var runSt = window.mrStyleRunning ? !!window.mrStyleRunning() : (function () { var a = $('activeStyleDisplay'); return !!(a && a.textContent.trim() && !/STOPPED/i.test(a.textContent)); })();
    var sty = window.mrStyleLabel ? window.mrStyleLabel() : '';
    if (runSt || sty) st += '<span class="chip' + (runSt ? ' ok5' : '') + '">STYLE ' + (runSt ? '▶' : '■') + (sty ? ' · ' + esc(sty) : '') + '</span>';
    /* Upper 2 / Upper 3 di MAIN, seperti layar Pa5X asli */
    var ul = $('paUpList');
    if (ul && pin) { var ph = window.mrPerfUpsHtml(pin); if (ul.dataset.k !== ph) { ul.dataset.k = ph; ul.innerHTML = ph; } }
    else if (ul) {
      var u2 = dualEnabled && layerVoice, u3 = dualEnabled && upper3Channel > 0 && typeof upper3Voice !== 'undefined' && upper3Voice;
      var uh = '<div class="' + (u2 ? 'on' : '') + '"><em>UP2</em><span class="ui">' + (u2 ? vIcon(layerVoice) : '') + '</span><b>' + esc(u2 ? layerVoice.name : (dualEnabled ? '—' : 'OFF')) + '</b><small>' + (u2 ? 'CH ' + layerChannel : '') + '</small></div>' +
        '<div class="' + (u3 ? 'on' : '') + '"><em>UP3</em><span class="ui">' + (u3 ? vIcon(upper3Voice) : '') + '</span><b>' + esc(u3 ? upper3Voice.name : 'OFF') + '</b><small>' + (u3 ? 'CH ' + upper3Channel : '') + '</small></div>';
      if (ul.dataset.k !== uh) { ul.dataset.k = uh; ul.innerHTML = uh; }
    }
    var tb = root.querySelector('.pa-tabs [data-go="style"]'); if (tb) setCls(tb, 'dotOn', runSt);
    tb = root.querySelector('.pa-tabs [data-go="keys"]'); if (tb) setCls(tb, 'dotOn', !!(dualEnabled || lw));
    root.querySelectorAll('[data-sty]').forEach(function (b) { var o = document.querySelector('#panelStyle button[onclick*="\'' + b.dataset.sty + '\'"]'); setCls(b, 'on', !!(o && o.classList.contains('active-style'))); });
    if (activeTileId !== lastActive && activeTileId != null) {
      lastActive = activeTileId; recent = [String(activeTileId)].concat(recent.filter(function (x) { return x !== String(activeTileId); })).slice(0, 6); lss('mrRecentVoices', JSON.stringify(recent));
    }
    var rc = $('paRecent'); if (rc && pin) { if (rc.dataset.k !== '') { rc.dataset.k = ''; rc.innerHTML = ''; } }
    else if (rc) {
      var rh = recent.filter(function (x) { return x !== String(activeTileId); }).map(function (x) { return voiceTiles.find(function (t) { return String(t.id) === x; }); }).filter(Boolean).slice(0, 3)
        .map(function (t) { return '<button type="button" data-rec="' + esc(t.id) + '">' + esc(t.name) + '</button>'; }).join('');
      if (rc.dataset.k !== rh) { rc.dataset.k = rh; rc.innerHTML = rh; }
    }
    var se = $('paStat'); if (se && se.dataset.k !== st) { se.dataset.k = st; se.innerHTML = st; }

    /* TOOLS */
    setTxt($('paToolVoice'), tl ? tl.name : '-');
    setTxt($('paEdit'), 'EDIT: ' + (isEditMode ? 'ON' : 'OFF')); setCls($('paEdit'), 'on', isEditMode);
    setTxt($('paKEdit'), '✎ EDIT: ' + (isEditMode ? 'ON' : 'OFF')); setCls($('paKEdit'), 'on', isEditMode); setCls($('paScr-keys'), 'editing', isEditMode);
    setCls($('paKbd'), 'on', kbVisible);
    var cb = $('voiceCountBadge');
    var info = (cb ? cb.textContent + ' voice' : '') + (dualEnabled && layerVoice ? '  ·  LAYER: ' + layerVoice.name + ' (CH ' + layerChannel + ')' : '') + (dualEnabled && upper3Channel > 0 ? '  ·  UPPER 3 CH ' + upper3Channel : '');
    setTxt($('paToolInfo'), info);
    var rg = regBanks[activeRegIndex];
    setTxt($('paRegInfo'), rg ? 'REG ' + (activeRegIndex + 1) + ': ' + (rg.name || T('(tanpa nama)', '(no name)')) + '  ·  ' + T('tahan tombol REG 0,7 detik untuk mengubah nama', 'hold a REG button 0.7 s to rename') : T('Tahan tombol REG 0,7 detik untuk mengubah nama registrasi', 'Hold a REG button 0.7 s to rename a registration'));
  }

  function mv(el, dest) { var ph = document.createComment('pa'); el.parentNode.insertBefore(ph, el); moved.push({ el: el, ph: ph }); dest.appendChild(el); }
  function restore() { moved.reverse().forEach(function (m) { m.ph.parentNode.insertBefore(m.el, m.ph); m.ph.remove(); }); moved = []; }

  window.paSetMode = function (m) {
    m = m === 'pa' ? 'pa' : 'classic';
    try { localStorage.setItem('mrViewMode', m); } catch (e) {}
    var sel = $('settingViewMode'); if (sel) sel.value = m;
    if (m === mode) return;
    mode = m;
    if (m === 'pa') {
      if (!root) build();
      Object.keys(SLOTS).forEach(function (k) { var p = $(SLOTS[k]); if (p) mv(p, $('paScr-' + k)); });
      showSlots();
      var sel2 = $('midiOutSelect'); if (sel2) mv(sel2, $('paMidiSlot'));
      var ps = $('proStrip'); if (ps) mv(ps, $('paProSlot'));
      var vk = $('vkDock'); if (vk) mv(vk, $('paVk'));
      document.body.classList.add('pa-mode');
      go('main');
      // mode grafis Low: layar Pa5X diperbarui lebih jarang (hemat baterai)
      var tick = function () { if (mode !== 'pa') return; refresh(); timer = setTimeout(tick, window.mrGfxSlow && window.mrGfxSlow() ? 1200 : 400); };
      clearTimeout(timer); tick();
    } else {
      clearTimeout(timer); timer = null;
      document.body.classList.remove('pa-mode');
      restore();
      searchQuery = '';
      if (window.switchMainPanel) switchMainPanel('voice');
      if (window.renderVoiceTiles) renderVoiceTiles();
    }
  };

  window.addEventListener('load', function () {
    setTimeout(function () {
      var s = null; try { s = localStorage.getItem('mrViewMode'); } catch (e) {}
      var sel = $('settingViewMode'); if (sel) sel.value = s === 'pa' ? 'pa' : 'classic';
      if (s === 'pa') window.paSetMode('pa');
    }, 400);
  });
})();
