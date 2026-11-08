/* =====================================================================
   MIDI ROYALE PRO - LIBRARY VOICE (v9.2)
   1) Library GM2 bawaan: 128 voice standar + 9 drum kit (Bank MSB 121 / drum 120, LSB 0).
      Dikenali hampir semua keyboard modern (Korg Pa, Yamaha Genos/PSR, Roland E-A7/BK, modul GM/GS/XG).
      Nomor PC otomatis menyesuaikan penomoran model (Korg mulai 0, Yamaha/Roland mulai 1).
   2) Daftar per model: tempel daftar "Nama, MSB, LSB, PC" (atau "121.000.014 Nama") sekali,
      tersimpan per model keyboard dan ikut Export/Import/Cloud.
   Pilih banyak voice sekaligus lalu tambahkan sebagai tile. Tombol ▶ mencoba voice di Upper 1.
   ===================================================================== */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function en() { try { return currentLang === 'en'; } catch (e) { return false; } }
  function T(id, eng) { return en() ? eng : id; }
  function note(m) { try { toast(m); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function cl(v, a, b) { return Math.max(a, Math.min(b, v)); }

  var GM = ['Acoustic Grand Piano', 'Bright Acoustic Piano', 'Electric Grand Piano', 'Honky-tonk Piano', 'Electric Piano 1', 'Electric Piano 2', 'Harpsichord', 'Clavi',
    'Celesta', 'Glockenspiel', 'Music Box', 'Vibraphone', 'Marimba', 'Xylophone', 'Tubular Bells', 'Dulcimer',
    'Drawbar Organ', 'Percussive Organ', 'Rock Organ', 'Church Organ', 'Reed Organ', 'Accordion', 'Harmonica', 'Tango Accordion',
    'Nylon Guitar', 'Steel Guitar', 'Jazz Guitar', 'Clean Guitar', 'Muted Guitar', 'Overdriven Guitar', 'Distortion Guitar', 'Guitar Harmonics',
    'Acoustic Bass', 'Finger Bass', 'Pick Bass', 'Fretless Bass', 'Slap Bass 1', 'Slap Bass 2', 'Synth Bass 1', 'Synth Bass 2',
    'Violin', 'Viola', 'Cello', 'Contrabass', 'Tremolo Strings', 'Pizzicato Strings', 'Orchestral Harp', 'Timpani',
    'String Ensemble 1', 'String Ensemble 2', 'Synth Strings 1', 'Synth Strings 2', 'Choir Aahs', 'Voice Oohs', 'Synth Voice', 'Orchestra Hit',
    'Trumpet', 'Trombone', 'Tuba', 'Muted Trumpet', 'French Horn', 'Brass Section', 'Synth Brass 1', 'Synth Brass 2',
    'Soprano Sax', 'Alto Sax', 'Tenor Sax', 'Baritone Sax', 'Oboe', 'English Horn', 'Bassoon', 'Clarinet',
    'Piccolo', 'Flute', 'Recorder', 'Pan Flute', 'Blown Bottle', 'Shakuhachi', 'Whistle', 'Ocarina',
    'Square Lead', 'Saw Lead', 'Calliope Lead', 'Chiff Lead', 'Charang Lead', 'Voice Lead', 'Fifths Lead', 'Bass + Lead',
    'New Age Pad', 'Warm Pad', 'Polysynth Pad', 'Choir Pad', 'Bowed Pad', 'Metallic Pad', 'Halo Pad', 'Sweep Pad',
    'FX Rain', 'FX Soundtrack', 'FX Crystal', 'FX Atmosphere', 'FX Brightness', 'FX Goblins', 'FX Echoes', 'FX Sci-fi',
    'Sitar', 'Banjo', 'Shamisen', 'Koto', 'Kalimba', 'Bagpipe', 'Fiddle', 'Shanai',
    'Tinkle Bell', 'Agogo', 'Steel Drums', 'Woodblock', 'Taiko Drum', 'Melodic Tom', 'Synth Drum', 'Reverse Cymbal',
    'Guitar Fret Noise', 'Breath Noise', 'Seashore', 'Bird Tweet', 'Telephone Ring', 'Helicopter', 'Applause', 'Gunshot'];
  // [nama grup ID, EN, kategori tile, glow]
  var FAM = [['Piano', 'Piano', 'keys', 'glow-cyan'], ['Kromatik', 'Chromatic', 'keys', 'glow-cyan'], ['Organ & Akordeon', 'Organ & Accordion', 'keys', 'glow-amber'],
    ['Gitar', 'Guitar', 'guitar', 'glow-orange'], ['Bass', 'Bass', 'guitar', 'glow-orange'], ['Strings', 'Strings', 'orchestral', 'glow-purple'],
    ['Ensemble & Choir', 'Ensemble & Choir', 'orchestral', 'glow-purple'], ['Brass', 'Brass', 'brass', 'glow-amber'], ['Reed / Sax', 'Reed / Sax', 'brass', 'glow-cyan'],
    ['Flute / Pipe', 'Flute / Pipe', 'orchestral', 'glow-purple'], ['Synth Lead', 'Synth Lead', 'brass', 'glow-cyan'], ['Synth Pad', 'Synth Pad', 'brass', 'glow-purple'],
    ['Synth FX', 'Synth FX', 'brass', 'glow-rose'], ['Etnik', 'Ethnic', 'ethnic', 'glow-orange'], ['Perkusi', 'Percussive', 'percussion', 'glow-orange'],
    ['Efek Suara', 'Sound FX', 'percussion', 'glow-rose'], ['Drum Kit', 'Drum Kit', 'percussion', 'glow-rose']];
  var DRUMS = [['Standard Kit', 1], ['Room Kit', 9], ['Power Kit', 17], ['Electronic Kit', 25], ['Analog Kit', 26], ['Jazz Kit', 33], ['Brush Kit', 41], ['Orchestra Kit', 49], ['SFX Kit', 57]];

  function iconFor(name, cat) {
    var n = name.toLowerCase();
    var map = [[/electric piano|e\.?piano|rhodes|clav/, 'epiano'], [/piano|harpsi|celesta|glock|music box|vibra|marimba|xylo|bell|dulcimer|kalimba/, 'piano'], [/accord/, 'accordion'], [/harmonica/, 'harmonica'],
      [/organ/, 'organ'], [/oud|gambus/, 'oud'], [/qanun|kanun|koto|zither/, 'kanun'], [/saz|baglama|bouzouki|sitar|banjo|shamisen/, 'saz'], [/ney|flute|pipe|piccolo|recorder|bottle|shakuhachi|whistle|ocarina|shanai|suling/, 'flute'],
      [/cello|contrabass|double bass/, 'cello'], [/violin|viola|fiddle|rebab|kemenche/, 'violin'], [/harp/, 'harp'], [/string|choir|voice|aahs|oohs|ensemble|orchestra/, 'strings'],
      [/trumpet|tuba|horn|brass/, 'trumpet'], [/trombone/, 'trombone'], [/sax/, 'sax'], [/clarinet|oboe|bassoon|reed/, 'clarinet'],
      [/bass/, 'cello'], [/nylon|acoustic guitar|steel guitar|classic guitar/, 'acguitar'], [/guitar/, 'elguitar'],
      [/darbuka|tabla|kendang|dumbek/, 'darbuka'], [/riq|tambourine|daf/, 'riq'], [/drum|kit|perc|timpani|taiko|tom|agogo|woodblock|cymbal/, 'drums'],
      [/synth|pad|lead|fx|sweep|halo/, 'synth']];
    for (var i = 0; i < map.length; i++) if (map[i][0].test(n)) return map[i][1];
    return cat === 'percussion' ? 'drums' : (cat === 'ethnic' ? 'oud' : 'piano');
  }
  function guessCat(name) {
    var n = name.toLowerCase();
    if (/oud|gambus|qanun|kanun|ney|saz|baglama|bouzouki|sitar|arab|turk|maqam|rebab|kemenche|zurna|mizmar|duduk|suling|gamelan|ethnic|oriental|koto|shamisen|shanai|bagpipe|kendang/.test(n)) return 'ethnic';
    if (/drum|kit|perc|darbuka|tabla|riq|daf|tambourine|timpani|conga|bongo|cymbal|tom\b/.test(n)) return 'percussion';
    if (/guitar|bass|banjo|ukulele|mandolin/.test(n)) return 'guitar';
    if (/string|violin|viola|cello|contrabass|harp|choir|voice|orchestra|ensemble|flute|piccolo|oboe/.test(n)) return 'orchestral';
    if (/sax|trumpet|trombone|horn|brass|tuba|clarinet|synth|pad|lead|fx/.test(n)) return 'brass';
    return 'keys';
  }

  // Library GM2 sebagai daftar {name, fam, msb, lsb, n(1-128)}
  var GM2 = GM.map(function (name, i) { return { name: name, fam: Math.floor(i / 8), msb: 121, lsb: 0, n: i + 1 }; })
    .concat(DRUMS.map(function (d) { return { name: d[0], fam: 16, msb: 120, lsb: 0, n: d[1] }; }));

  // Daftar per model (ditempel pengguna), ikut Export/Import/Cloud
  var LIBS = {};     // modelId -> [{name, msb, lsb, pc, cat}]
  var _extraPersist = window.extraPersist;
  window.extraPersist = function () { var o = _extraPersist(); o.vlib = LIBS; return o; };
  var _applyExtraPersist = window.applyExtraPersist;
  window.applyExtraPersist = function (p) {
    _applyExtraPersist(p);
    if (p && typeof p === 'object' && p.vlib && typeof p.vlib === 'object') LIBS = cleanLibs(p.vlib);
  };
  function cleanLibs(o) {
    var out = {};
    Object.keys(o).slice(0, 80).forEach(function (k) {
      if (!/^[a-z0-9_]{1,40}$/.test(k) || !Array.isArray(o[k])) return;
      out[k] = o[k].slice(0, 3000).map(function (v) {
        if (!v || typeof v !== 'object') return null;
        var m = parseInt(v.msb, 10), l = parseInt(v.lsb, 10), p = parseInt(v.pc, 10);
        if (isNaN(m) || isNaN(l) || isNaN(p)) return null;
        var name = String(v.name || '').trim().slice(0, 60); if (!name) return null;
        var cats = ['keys', 'orchestral', 'ethnic', 'brass', 'guitar', 'percussion'];
        return { name: name, msb: cl(m, 0, 127), lsb: cl(l, 0, 127), pc: cl(p, 0, 128), cat: cats.indexOf(v.cat) >= 0 ? v.cat : guessCat(name) };
      }).filter(Boolean);
    });
    return out;
  }
  // "Nama, MSB, LSB, PC"  |  "MSB.LSB.PC Nama"  |  "MSB LSB PC Nama"
  function parseList(txt) {
    var out = [], bad = 0;
    String(txt || '').split(/\r?\n/).forEach(function (line) {
      line = line.trim(); if (!line || /^#|^\/\//.test(line)) return;
      var m = line.match(/^(\d{1,3})[.\s,;:\/-]+(\d{1,3})[.\s,;:\/-]+(\d{1,3})\s*[,;:\t-]?\s*(.+)$/);
      var r = null;
      if (m) r = { name: m[4], msb: +m[1], lsb: +m[2], pc: +m[3] };
      else {
        m = line.match(/^(.+?)[,;\t]+\s*(\d{1,3})\s*[,;\t.]+\s*(\d{1,3})\s*[,;\t.]+\s*(\d{1,3})\s*$/);
        if (m) r = { name: m[1], msb: +m[2], lsb: +m[3], pc: +m[4] };
      }
      if (!r || r.msb > 127 || r.lsb > 127 || r.pc > 128) { bad++; return; }
      r.name = r.name.replace(/^[\s"'-]+|[\s"']+$/g, '').slice(0, 60);
      if (!r.name) { bad++; return; }
      r.cat = guessCat(r.name);
      out.push(r);
    });
    return { list: out, bad: bad };
  }

  /* ---------------- UI ---------------- */
  var S = { src: 'gm', fam: 0, q: '', sel: {}, mode: 'list' };
  function model() { try { return window.mrKbModel ? window.mrKbModel() : null; } catch (e) { return null; } }
  function pcB() { try { return pcBase === 1 ? 1 : 0; } catch (e) { return 0; } }
  // voice library -> nilai tile (pc sesuai penomoran yang dipakai aplikasi)
  function toTile(v) {
    if (S.src === 'gm') return { name: v.name.toUpperCase(), msb: v.msb, lsb: v.lsb, pc: pcB() ? v.n : v.n - 1, cat: FAM[v.fam][2], glow: FAM[v.fam][3] };
    return { name: v.name.toUpperCase(), msb: v.msb, lsb: v.lsb, pc: v.pc, cat: v.cat, glow: { keys: 'glow-cyan', orchestral: 'glow-purple', ethnic: 'glow-orange', brass: 'glow-amber', guitar: 'glow-orange', percussion: 'glow-rose' }[v.cat] || 'glow-cyan' };
  }
  function items() {
    var q = S.q.toLowerCase();
    if (S.src === 'gm') return GM2.map(function (v, i) { v.k = 'g' + i; return v; }).filter(function (v) { return q ? v.name.toLowerCase().indexOf(q) >= 0 : v.fam === S.fam; });
    var m = model(), L = (m && LIBS[m.id]) || [];
    return L.map(function (v, i) { v.k = 'm' + i; return v; }).filter(function (v) { return !q || v.name.toLowerCase().indexOf(q) >= 0; });
  }
  function exists(t) { try { return voiceTiles.some(function (x) { return x.msb === t.msb && x.lsb === t.lsb && +x.pc === +t.pc; }); } catch (e) { return false; } }
  function code(t) { return t.msb + '.' + String(t.lsb).padStart(3, '0') + '.' + String(t.pc).padStart(3, '0'); }

  function open() {
    var m = $('vlModal');
    if (!m) {
      m = document.createElement('div'); m.id = 'vlModal'; m.className = 'v9-modal v9-hide vl';
      document.body.appendChild(m);
      m.addEventListener('click', onClick);
      m.addEventListener('input', function (e) { if (e.target.id === 'vlSearch') { S.q = e.target.value; renderList(); } });
    }
    var md = model();
    if (S.src === 'model' && !(md && LIBS[md.id] && LIBS[md.id].length)) S.src = 'gm';
    S.sel = {}; S.mode = 'list';
    m.classList.remove('v9-hide');
    render();
  }
  window.mrOpenVoiceLib = open;
  function close() { var m = $('vlModal'); if (m) m.classList.add('v9-hide'); }

  function render() {
    var m = $('vlModal'); if (!m) return;
    var md = model(), mName = md ? (md.brand === 'generic' ? 'MIDI' : md.name) : T('model', 'model');
    var mCount = (md && LIBS[md.id]) ? LIBS[md.id].length : 0;
    var head = '<div class="v9-head"><b>📚 ' + T('LIBRARY VOICE', 'VOICE LIBRARY') + '</b><button type="button" class="v9-x" data-vl="close">✕</button></div>' +
      '<div class="vl-src"><button type="button" data-vl="src" data-v="gm" class="' + (S.src === 'gm' && S.mode === 'list' ? 'on' : '') + '">GM2 · ' + T('semua keyboard', 'all keyboards') + ' <small>137</small></button>' +
      '<button type="button" data-vl="src" data-v="model" class="' + (S.src === 'model' && S.mode === 'list' ? 'on' : '') + '"' + (md ? '' : ' disabled') + '>' + T('Daftar ', 'List ') + esc(mName) + ' <small>' + mCount + '</small></button>' +
      '<button type="button" data-vl="import" class="' + (S.mode === 'import' ? 'on' : '') + '"' + (md ? '' : ' disabled') + '>＋ ' + T('IMPOR DAFTAR', 'IMPORT LIST') + '</button></div>';
    if (S.mode === 'import') {
      m.innerHTML = '<div class="v9-card wide vl-card">' + head +
        '<p class="v9-p">' + T('Tempel daftar sound <b>' + esc(mName) + '</b>, satu per baris. Format: <kbd>Nama, MSB, LSB, PC</kbd> atau seperti layar Korg <kbd>121.000.014 Nama</kbd>. Nomor PC ditulis persis seperti di daftar keyboard (penomoran PC model sudah diatur otomatis).', 'Paste the <b>' + esc(mName) + '</b> sound list, one per line. Format: <kbd>Name, MSB, LSB, PC</kbd> or like a Korg screen <kbd>121.000.014 Name</kbd>. Write PC exactly as in the keyboard list (the model&rsquo;s PC numbering is already set).') + '</p>' +
        '<textarea id="vlText" class="vl-text" placeholder="Oud Solo, 121, 12, 105&#10;121.008.107 Qanun Live&#10;Ney Flute;121;2;73"></textarea>' +
        '<div class="v9-row wrap"><span class="v9-p dim" id="vlParse"></span><span class="v9-sp"></span>' +
        (mCount ? '<button type="button" class="v9-btn bad" data-vl="clearlib">' + T('HAPUS DAFTAR', 'CLEAR LIST') + '</button>' : '') +
        '<button type="button" class="v9-btn" data-vl="back">' + T('BATAL', 'CANCEL') + '</button><button type="button" class="v9-btn pri" data-vl="saveimp">' + T('SIMPAN DAFTAR', 'SAVE LIST') + '</button></div></div>';
      var ta = $('vlText');
      ta.addEventListener('input', function () { var r = parseList(ta.value); $('vlParse').textContent = r.list.length + T(' voice terbaca', ' voices read') + (r.bad ? ' · ' + r.bad + T(' baris dilewati', ' lines skipped') : ''); });
      return;
    }
    var fams = S.src === 'gm' ? '<div class="vl-fams">' + FAM.map(function (f, i) { return '<button type="button" data-vl="fam" data-v="' + i + '" class="' + (i === S.fam && !S.q ? 'on' : '') + '">' + esc(en() ? f[1] : f[0]) + '</button>'; }).join('') + '</div>' : '';
    m.innerHTML = '<div class="v9-card wide vl-card">' + head + fams +
      '<div class="vl-bar"><input id="vlSearch" type="search" placeholder="' + T('Cari voice…', 'Search voices…') + '" value="' + esc(S.q) + '"><button type="button" class="v9-btn sm" data-vl="all">' + T('PILIH SEMUA', 'SELECT ALL') + '</button></div>' +
      '<div class="vl-list" id="vlList"></div>' +
      '<div class="v9-row"><span class="v9-p dim" id="vlCount"></span><span class="v9-sp"></span><button type="button" class="v9-btn pri" data-vl="add" id="vlAdd">' + T('TAMBAH SEBAGAI TILE', 'ADD AS TILES') + '</button></div></div>';
    renderList();
  }
  function renderList() {
    var box = $('vlList'); if (!box) return;
    var it = items();
    if (!it.length) {
      box.innerHTML = '<div class="vl-empty">' + (S.src === 'model' ? T('Daftar model ini masih kosong. Tekan <b>＋ IMPOR DAFTAR</b> untuk menempel daftar sound dari manual / layar keyboard.', 'This model&rsquo;s list is empty. Press <b>＋ IMPORT LIST</b> to paste the sound list from the manual / keyboard screen.') : T('Tidak ada voice yang cocok.', 'No matching voice.')) + '</div>';
    } else {
      box.innerHTML = it.map(function (v) {
        var t = toTile(v), on = !!S.sel[v.k], have = exists(t);
        return '<div class="vl-row' + (on ? ' on' : '') + (have ? ' have' : '') + '" data-k="' + v.k + '"><span class="vl-chk">' + (on ? '✓' : '') + '</span><span class="vl-nm">' + esc(v.name) + '</span>' +
          (have ? '<em>' + T('SUDAH ADA', 'ADDED') + '</em>' : '') + '<span class="vl-code">' + code(t) + '</span><button type="button" class="vl-try" data-try="' + v.k + '" aria-label="Coba">▶</button></div>';
      }).join('');
    }
    var n = Object.keys(S.sel).length;
    var c = $('vlCount'); if (c) c.textContent = n + T(' dipilih', ' selected') + (S.src === 'gm' ? ' · Bank ' + (S.fam === 16 ? '120' : '121') + ' · PC ' + (pcB() ? T('mulai 1', 'from 1') : T('mulai 0', 'from 0')) : '');
    var a = $('vlAdd'); if (a) a.disabled = !n;
  }
  function findItem(k) { var all = S.src === 'gm' ? GM2 : ((model() && LIBS[model().id]) || []); var i = parseInt(k.slice(1), 10); return all[i] || null; }
  function onClick(e) {
    var m = $('vlModal');
    if (e.target === m) { close(); return; }
    var tr = e.target.closest('[data-try]');
    if (tr) {
      var v0 = findItem(tr.dataset.try); if (!v0) return;
      var t0 = toTile(v0);
      try { sendVoiceTo({ msb: t0.msb, lsb: t0.lsb, pc: t0.pc }, mainIdx()); note('▶ ' + v0.name + ' · ' + code(t0)); } catch (x) {}
      return;
    }
    var row = e.target.closest('.vl-row[data-k]');
    if (row) { var k = row.dataset.k; if (S.sel[k]) delete S.sel[k]; else S.sel[k] = 1; renderList(); return; }
    var b = e.target.closest('[data-vl]'); if (!b || b.disabled) return;
    var a = b.dataset.vl;
    if (a === 'close') close();
    else if (a === 'src') { S.src = b.dataset.v; S.mode = 'list'; S.sel = {}; S.q = ''; render(); }
    else if (a === 'fam') { S.fam = parseInt(b.dataset.v, 10) || 0; S.q = ''; S.sel = S.sel; render(); }
    else if (a === 'all') { var it = items(), allOn = it.every(function (v) { return S.sel[v.k]; }); it.forEach(function (v) { if (allOn) delete S.sel[v.k]; else S.sel[v.k] = 1; }); renderList(); }
    else if (a === 'add') addSelected();
    else if (a === 'import') { S.mode = 'import'; render(); }
    else if (a === 'back') { S.mode = 'list'; render(); }
    else if (a === 'saveimp') {
      var md = model(); if (!md) return;
      var r = parseList($('vlText').value);
      if (!r.list.length) { note(T('Tidak ada baris yang terbaca. Cek formatnya.', 'No lines could be read. Check the format.')); return; }
      LIBS[md.id] = (LIBS[md.id] || []).concat(r.list).slice(0, 3000);
      try { saveLocalStoragePreset(); } catch (x) {}
      S.src = 'model'; S.mode = 'list'; S.sel = {}; render();
      note(r.list.length + T(' voice disimpan ke daftar ', ' voices saved to the list of ') + md.name);
    }
    else if (a === 'clearlib') {
      var md2 = model(); if (!md2) return;
      mrAsk(T('Hapus daftar voice ' + md2.name + '?', 'Clear the ' + md2.name + ' voice list?'), function () { delete LIBS[md2.id]; try { saveLocalStoragePreset(); } catch (x) {} S.src = 'gm'; S.mode = 'list'; render(); }, { danger: true });
    }
  }
  function addSelected() {
    var keys = Object.keys(S.sel); if (!keys.length) return;
    var added = 0, skip = 0, base = Date.now();
    keys.forEach(function (k, i) {
      var v = findItem(k); if (!v) return;
      var t = toTile(v);
      if (exists(t)) { skip++; return; }
      voiceTiles.push({ id: 'lib' + base.toString(36) + i, name: t.name.slice(0, 60), category: t.cat, iconKey: iconFor(v.name, t.cat), customImg: '', msb: t.msb, lsb: t.lsb, pc: t.pc, glow: t.glow, bank: S.src === 'gm' ? 'gm' : 'factory', fav: false });
      added++;
    });
    try { renderVoiceTiles(); saveLocalStoragePreset(); } catch (x) {}
    S.sel = {}; renderList();
    note(T(added + ' voice ditambahkan', added + ' voices added') + (skip ? T(' · ' + skip + ' sudah ada', ' · ' + skip + ' already there') : ''));
  }
  (window.mrLangHooks = window.mrLangHooks || []).push(function () { var m = $('vlModal'); if (m && !m.classList.contains('v9-hide')) render(); });
  window.MRVLIB = { GM2: GM2, parseList: parseList, guessCat: guessCat, iconFor: iconFor, libs: function () { return LIBS; }, open: open };
})();
