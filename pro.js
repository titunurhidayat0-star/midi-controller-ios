/* =====================================================================
   MIDI ROYALE PRO - FEATURE PACK v6
   Panic, Sustain/Mixer CC, Split keyboard, Maqam + tonika, Setlist,
   Recorder + export .mid, Backup cloud, Layout tablet / mode panggung.
   Dimuat setelah script utama di index.html. Memakai fungsi/variabel global
   yang sudah ada dan membungkusnya (tanpa mengubah perilaku lama).
   ===================================================================== */
(function () {
  'use strict';

  var NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  function noteName(n) { return NOTE_NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1); }
  function $(id) { return document.getElementById(id); }
  function note(m) { try { toast(m); } catch (e) {} }
  function isEn() { try { return currentLang === 'en'; } catch (e) { return false; } }
  function T(a, b) { return isEn() ? b : a; }
  function persist() { try { saveLocalStoragePreset(); } catch (e) {} }
  function cl(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function pint(v, d) { var k = parseInt(v, 10); return isNaN(k) ? d : k; }
  function midi7(v, d) { return cl(pint(v, d), 0, 127); }

  var CC_DEFS = [[7, 'Volume', 100], [10, 'Pan', 64], [91, 'Reverb', 40], [93, 'Chorus', 0]];

  // Maqam: offset semitone (dari tonika) yang diturunkan seperempat nada.
  // Hijaz/Nahawand/Kurd/Ajam memakai nada 12-TET biasa (tanpa quartertone).
  var MAQAMS = [
    { id: 'rast', name: 'Rast', tonic: 0, qt: [4, 11], note: 'Nada ke-3 dan ke-7 turun setengah-flat', noteEn: '3rd and 7th lowered half-flat' },
    { id: 'bayati', name: 'Bayati', tonic: 2, qt: [2], note: 'Nada ke-2 turun setengah-flat', noteEn: '2nd lowered half-flat' },
    { id: 'saba', name: 'Saba', tonic: 2, qt: [2], note: 'Nada ke-2 turun setengah-flat', noteEn: '2nd lowered half-flat' },
    { id: 'hijaz', name: 'Hijaz', tonic: 2, qt: [], note: 'Tanpa quartertone (reset tuning)', noteEn: 'No quartertone (tuning reset)' },
    { id: 'nahawand', name: 'Nahawand', tonic: 0, qt: [], note: 'Tanpa quartertone (reset tuning)', noteEn: 'No quartertone (tuning reset)' },
    { id: 'kurd', name: 'Kurd', tonic: 2, qt: [], note: 'Tanpa quartertone (reset tuning)', noteEn: 'No quartertone (tuning reset)' },
    { id: 'ajam', name: 'Ajam', tonic: 0, qt: [], note: 'Tanpa quartertone (reset tuning)', noteEn: 'No quartertone (tuning reset)' }
  ];

  var PRO = {
    splitOn: false, splitPoint: 60, splitSetArmed: false,
    cc: { main: {}, layer: {} },
    susLatch: false, susDown: false, susChs: [],
    maqam: null,
    songs: [], songIdx: -1
  };

  var UIKEY = 'MR_PRO_UI';
  var ui = { layout: 'auto', big: false, stage: false };
  try { var u0 = JSON.parse(localStorage.getItem(UIKEY) || '{}'); if (u0 && typeof u0 === 'object') { ui.layout = ['auto', 'one', 'two'].indexOf(u0.layout) >= 0 ? u0.layout : 'auto'; ui.big = !!u0.big; ui.stage = !!u0.stage; } } catch (e) {}
  function saveUI() { try { localStorage.setItem(UIKEY, JSON.stringify(ui)); } catch (e) {} }

  /* ---------------------------------------------------------------
     Pembersih data (preset impor, localStorage, cloud)
     --------------------------------------------------------------- */
  function cleanCC(c) {
    var out = { main: {}, layer: {} };
    if (c && typeof c === 'object') {
      ['main', 'layer'].forEach(function (w) {
        var s = c[w];
        if (s && typeof s === 'object') CC_DEFS.forEach(function (d) {
          var v = parseInt(s[d[0]], 10);
          if (!isNaN(v)) out[w][d[0]] = cl(v, 0, 127);
        });
      });
    }
    return out;
  }
  function cleanMaqam(m) {
    if (!m || typeof m !== 'object') return null;
    var d = MAQAMS.filter(function (x) { return x.id === m.id; })[0];
    var t = parseInt(m.tonic, 10);
    return (d && !isNaN(t)) ? { id: d.id, tonic: ((t % 12) + 12) % 12 } : null;
  }
  function extras() {
    return {
      split: { on: PRO.splitOn, point: PRO.splitPoint },
      cc: { main: Object.assign({}, PRO.cc.main), layer: Object.assign({}, PRO.cc.layer) },
      maqam: PRO.maqam ? Object.assign({}, PRO.maqam) : null,
      kset: window.mrKsetForReg ? window.mrKsetForReg() : null
    };
  }

  // sanitizeReg: tambahkan field baru (split, cc, maqam)
  var _sanitizeReg = window.sanitizeReg;
  window.sanitizeReg = function (r) {
    var o = _sanitizeReg(r);
    if (!o) return o;
    var s = (r && r.split && typeof r.split === 'object') ? r.split : {};
    o.split = { on: !!s.on, point: midi7(s.point, 60) };
    o.cc = cleanCC(r.cc);
    o.maqam = cleanMaqam(r.maqam);
    o.name = String(o.name || '').slice(0, 60);
    return o;
  };

  // storeReg: simpan juga split/cc/maqam
  var _storeReg = window.storeReg;
  window.storeReg = function (i) {
    _storeReg(i);
    var r = regBanks[i];
    if (r) { regBanks[i] = window.sanitizeReg(Object.assign({}, r, extras())); persist(); }
  };

  // dipanggil dari applyRegData (index.html)
  var prevSplitLi = -1;
  window.proPreApply = function (r) {
    prevSplitLi = (PRO.splitOn && layerIdx() !== mainIdx()) ? layerIdx() : -1;
    var s = r.split || {};
    PRO.splitOn = !!s.on;
    PRO.splitPoint = midi7(s.point, 60);
    PRO.splitSetArmed = false;
    var c = cleanCC(r.cc);
    PRO.cc = c;
    PRO.maqam = cleanMaqam(r.maqam);
  };
  window.proPostApply = function () {
    var inUse = (PRO.splitOn || dualEnabled) && prevSplitLi === layerIdx();
    if (prevSplitLi >= 0 && prevSplitLi !== mainIdx() && !inUse) silenceChannel(prevSplitLi);
    prevSplitLi = -1;
    if (PRO.splitOn && layerVoice && layerIdx() !== mainIdx()) sendVoiceTo(layerVoice, layerIdx());
    resendCC('main');
    resendCC('layer');
    updateAll();
  };

  // Persistensi (ikut export/import/cloud)
  var _extraPersist = window.extraPersist;
  window.extraPersist = function () {
    var o = _extraPersist();
    o.pro = { songs: PRO.songs, cc: PRO.cc, split: { on: PRO.splitOn, point: PRO.splitPoint }, maqam: PRO.maqam, susLatch: PRO.susLatch };
    return o;
  };
  var _applyExtraPersist = window.applyExtraPersist;
  window.applyExtraPersist = function (p) {
    _applyExtraPersist(p);
    if (!p || typeof p !== 'object' || !p.pro || typeof p.pro !== 'object') return;
    var q = p.pro;
    PRO.songs = (Array.isArray(q.songs) ? q.songs : []).slice(0, 100).map(function (s) { return window.sanitizeReg(s); }).filter(Boolean);
    PRO.cc = cleanCC(q.cc);
    var s = q.split && typeof q.split === 'object' ? q.split : {};
    PRO.splitOn = !!s.on;
    PRO.splitPoint = midi7(s.point, 60);
    PRO.maqam = cleanMaqam(q.maqam);
    PRO.susLatch = !!q.susLatch;
    if (PRO.songIdx >= PRO.songs.length) PRO.songIdx = -1;
  };

  /* ---------------------------------------------------------------
     Routing channel (split) + pembungkus fungsi lama
     --------------------------------------------------------------- */
  window.targetChannels = function () {
    var a = [mainIdx()];
    if ((dualEnabled || PRO.splitOn || ksetMode) && layerIdx() !== a[0]) a.push(layerIdx());
    if ((dualEnabled || ksetMode) && upper3Channel > 0 && a.indexOf(upper3Idx()) < 0) a.push(upper3Idx());
    return a;
  };
  // channel tujuan nada dari keyboard virtual
  window.vkChannelsFor = function (n) {
    if (PRO.splitOn && layerIdx() !== mainIdx()) {
      if (n < PRO.splitPoint) return [layerIdx()];
      return dualEnabled ? window.targetChannels().slice() : [mainIdx()];
    }
    return window.targetChannels().slice();
  };
  // true = tekanan tombol dipakai untuk menentukan titik split (nada tidak dimainkan)
  window.proKeyHook = function (n) {
    if (!PRO.splitSetArmed) return false;
    PRO.splitSetArmed = false;
    PRO.splitPoint = cl(n, 0, 127);
    note(T('Titik split: ', 'Split point: ') + noteName(PRO.splitPoint));
    updateVkMarks();
    updateAll();
    persist();
    return true;
  };

  var _setDual = window.setDual;
  window.setDual = function (n) {
    var was = dualEnabled;
    _setDual(n);
    if (PRO.splitOn && was && !dualEnabled) { syncLayerChannel(); resendCC('layer'); }
  };
  var _changeLayerChannel = window.changeLayerChannel;
  window.changeLayerChannel = function (v) {
    var wasSplit = PRO.splitOn && !dualEnabled;
    var old = layerIdx();
    _changeLayerChannel(v);
    if (wasSplit && layerIdx() !== old) {
      releaseAllVk();
      if (old !== mainIdx()) silenceChannel(old);
      syncLayerChannel();
      resendCC('layer');
      invalidateSent();
    }
    updateAll();
  };
  var _assignLayerVoice = window.assignLayerVoice;
  window.assignLayerVoice = function (tile) {
    _assignLayerVoice(tile);
    if (PRO.splitOn && !dualEnabled && layerVoice && layerIdx() !== mainIdx()) sendVoiceTo(layerVoice, layerIdx());
    updateAll();
  };
  var _updateDualUI = window.updateDualUI;
  window.updateDualUI = function () {
    _updateDualUI();
    var bar = $('layerBar');
    if (bar) {
      bar.classList.toggle('is-hidden', !(dualEnabled || PRO.splitOn));
      var tag = bar.querySelector('.lb-tag');
      if (tag) tag.textContent = (PRO.splitOn && !dualEnabled) ? T('KIRI', 'LEFT') : 'LAYER';
    }
  };
  var _updateVkMarks = window.updateVkMarks;
  window.updateVkMarks = function () {
    _updateVkMarks();
    var host = $('vkKeys');
    if (!host) return;
    host.querySelectorAll('.vk-white, .vk-black').forEach(function (k) {
      k.classList.toggle('vk-split', PRO.splitOn && pint(k.dataset.note, -1) === PRO.splitPoint);
    });
  };
  var _refreshFeatureUI = window.refreshFeatureUI;
  window.refreshFeatureUI = function () { _refreshFeatureUI(); updateAll(); };

  function setSplit(on) {
    on = !!on;
    if (on === PRO.splitOn) return;
    releaseAllVk();
    if (on) {
      ensureLayerChannelValid();
      PRO.splitOn = true;
      syncLayerChannel();
      resendCC('layer');
      if (!layerVoice) {
        layerPickArmed = true;
        switchMainPanel('voice');
        note(T('Pilih voice untuk tangan kiri', 'Pick a voice for the left hand'));
      }
    } else {
      var li = layerIdx();
      PRO.splitOn = false;
      PRO.splitSetArmed = false;
      if (!dualEnabled && li !== mainIdx()) silenceChannel(li);
    }
    invalidateSent();
    updateDualUI();
    updateVkMarks();
    renderVoiceTiles();
    updateAll();
    persist();
  }

  /* ---------------------------------------------------------------
     CC: sustain, volume, pan, reverb, chorus
     --------------------------------------------------------------- */
  function ccChannel(w) { return w === 'main' ? mainIdx() : layerIdx(); }
  function sendCC(w, cc, val) {
    if (w === 'layer' && !(dualEnabled || PRO.splitOn)) return;
    if (w === 'layer' && layerIdx() === mainIdx()) return;
    sendMidiMessage([0xB0 | ccChannel(w), cc, val & 0x7F]);
  }
  function resendCC(w) {
    Object.keys(PRO.cc[w]).forEach(function (k) { sendCC(w, parseInt(k, 10), PRO.cc[w][k]); });
  }
  // SYNC penuh (Pengaturan > SYNC) ikut mengirim ulang nilai mixer
  (window.mrResyncHooks = window.mrResyncHooks || []).push(function (full) { if (full) { resendCC('main'); resendCC('layer'); } });
  function setCC(w, cc, val) {
    val = cl(pint(val, 0), 0, 127);
    PRO.cc[w][cc] = val;
    sendCC(w, cc, val);
    persist();
  }

  function susChannels() {
    return PRO.splitOn && layerIdx() !== mainIdx() ? [mainIdx(), layerIdx()] : window.targetChannels();
  }
  function susSet(on) {
    if (on) {
      PRO.susChs = susChannels().slice();
      PRO.susChs.forEach(function (c) { sendMidiMessage([0xB0 | c, 64, 127]); });
      PRO.susDown = true;
    } else {
      PRO.susChs.forEach(function (c) { sendMidiMessage([0xB0 | c, 64, 0]); });
      PRO.susDown = false;
      PRO.susChs = [];
    }
    updateAll();
  }

  function panic() {
    try { midiQueueClear(); } catch (e) {}
    releaseAllVk();
    recStopPlay(true);
    // dikirim BERTAHAP lewat antrean berjeda (midiBatch) supaya interface USB-MIDI murah tidak membuang pesan.
    // Channel aktif (Upper) lebih dulu, lalu channel lainnya.
    var first = []; try { first = window.targetChannels().slice(); } catch (e) {}
    var order = first.concat([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].filter(function (c) { return first.indexOf(c) < 0; }));
    var send = function () {
      order.forEach(function (ch) {
        sendMidiMessage([0xB0 | ch, 123, 0]);   // all notes off
        sendMidiMessage([0xB0 | ch, 120, 0]);   // all sound off
        sendMidiMessage([0xB0 | ch, 64, 0]);    // sustain off
        sendMidiMessage([0xE0 | ch, 0, 64]);    // pitch bend tengah
      });
    };
    if (typeof midiBatch === 'function') midiBatch(send); else send();
    if (window.mrOnPanic) { try { window.mrOnPanic(); } catch (e) {} }
    PRO.susDown = false;
    PRO.susChs = [];
    try { invalidateSent(); } catch (e) {}
    updateAll();
    note(T('PANIC: semua nada dimatikan', 'PANIC: all notes off'));
  }

  /* ---------------------------------------------------------------
     Maqam + tonika
     --------------------------------------------------------------- */
  function maqamDef(id) { return MAQAMS.filter(function (m) { return m.id === id; })[0]; }
  function applyMaqam(id, tonic) {
    var d = maqamDef(id);
    if (!d) return;
    tonic = ((pint(tonic, d.tonic) % 12) + 12) % 12;
    var cent = (typeof globalCentOffset === 'number' && globalCentOffset < 0) ? globalCentOffset : -50;
    activeQuartertones = {};
    d.qt.forEach(function (off) { activeQuartertones[(tonic + off) % 12] = cent; });
    PRO.maqam = { id: d.id, tonic: tonic };
    renderPianoTuts();
    sendQuartertoneSysEx();
    updateAll();
    persist();
    note(d.name + ' on ' + NOTE_NAMES[tonic]);
  }
  function shiftTuning(d) {
    var next = {};
    Object.keys(activeQuartertones).forEach(function (k) {
      next[(((pint(k, 0) + d) % 12) + 12) % 12] = activeQuartertones[k];
    });
    activeQuartertones = next;
    if (PRO.maqam) PRO.maqam.tonic = (((PRO.maqam.tonic + d) % 12) + 12) % 12;
    renderPianoTuts();
    sendQuartertoneSysEx();
    updateAll();
    persist();
  }
  // reset manual dari tombol lama menghapus label maqam
  var _resetAll = window.resetAllQuartertones;
  window.resetAllQuartertones = function () { PRO.maqam = null; _resetAll(); updateAll(); };
  var _applyScalePreset = window.applyScalePreset;
  window.applyScalePreset = function (t) { PRO.maqam = null; _applyScalePreset(t); updateAll(); };

  /* ---------------------------------------------------------------
     Setlist
     --------------------------------------------------------------- */
  function snapshot(name) {
    var tile = voiceTiles.find(function (x) { return x.id === activeTileId; });
    var q = {};
    Object.keys(activeQuartertones).forEach(function (k) { q[k] = activeQuartertones[k]; });
    return window.sanitizeReg(Object.assign({
      name: name || (tile ? tile.name : T('Lagu', 'Song')),
      voice: snapVoice(tile), layerVoice: layerVoice,
      dual: dualEnabled, channel: globalChannel, layerChannel: layerChannel,
      pbRange: pitchBendRangeSemitones, quartertones: q, globalCent: globalCentOffset,
      transpose: transposeSemis, octave: octaveShift
    }, extras()));
  }
  function songAdd(name) {
    name = String(name || '').trim().slice(0, 60);
    if (!name) { var tile = voiceTiles.find(function (x) { return x.id === activeTileId; }); name = tile ? tile.name : T('Lagu ', 'Song ') + (PRO.songs.length + 1); }
    if (PRO.songs.length >= 100) { note(T('Setlist penuh (maks 100 lagu)', 'Setlist full (max 100 songs)')); return; }
    PRO.songs.push(snapshot(name));
    PRO.songIdx = PRO.songs.length - 1;
    persist(); renderSongs(); updateAll();
    note(T('Lagu ditambahkan: ', 'Song added: ') + name);
  }
  function songPlay(i) {
    var s = PRO.songs[i];
    if (!s) return;
    activeRegIndex = -1;
    applyRegData(s);
    PRO.songIdx = i;
    updateRegUI();
    renderSongs(); updateAll();
    note((i + 1) + '. ' + s.name);
  }
  function songStep(d) {
    var n = PRO.songs.length;
    if (!n) { note(T('Setlist masih kosong. Buka PRO > SETLIST', 'Setlist is empty. Open PRO > SETLIST')); return; }
    var i = PRO.songIdx < 0 ? (d > 0 ? 0 : n - 1) : (PRO.songIdx + d + n) % n;
    songPlay(i);
  }
  function songMove(i, d) {
    var j = i + d;
    if (j < 0 || j >= PRO.songs.length) return;
    var t = PRO.songs[i]; PRO.songs[i] = PRO.songs[j]; PRO.songs[j] = t;
    if (PRO.songIdx === i) PRO.songIdx = j; else if (PRO.songIdx === j) PRO.songIdx = i;
    persist(); renderSongs(); updateAll();
  }
  function songDelete(i) {
    var s = PRO.songs[i];
    if (!s) return;
    mrAsk(T('Hapus "', 'Delete "') + s.name + T('" dari setlist?', '" from the setlist?'), function () {
      PRO.songs.splice(i, 1);
      if (PRO.songIdx === i) PRO.songIdx = -1; else if (PRO.songIdx > i) PRO.songIdx--;
      persist(); renderSongs(); updateAll();
    }, { ok: T('HAPUS', 'DELETE'), danger: true });
  }
  function songRename(i) {
    var s = PRO.songs[i]; if (!s) return;
    mrInput(T('Nama lagu', 'Song name'), s.name, function (n) {
      n = String(n).trim().slice(0, 60);
      if (n) { s.name = n; persist(); renderSongs(); updateAll(); }
    });
  }
  function songUpdate(i) {
    var s = PRO.songs[i]; if (!s) return;
    mrAsk(T('Ganti pengaturan "', 'Replace the settings of "') + s.name + T('" dengan kondisi sekarang?', '" with the current state?'), function () {
      PRO.songs[i] = snapshot(s.name);
      persist(); renderSongs();
      note(T('Lagu diperbarui', 'Song updated'));
    });
  }

  /* ---------------------------------------------------------------
     Recorder + export .mid
     --------------------------------------------------------------- */
  var rec = { on: false, playing: false, ev: [], t0: 0, dur: 0, idx: 0, p0: 0, tick: null, loop: false, used: {} };
  window.__mrTap = function (b) {
    if (!rec.on || rec.playing || !b || b.length < 2) return;
    var s = b[0];
    if (s < 0x80 || s >= 0xF0 || rec.ev.length >= 200000) return;
    var hi = s & 0xF0;
    var bytes = (hi === 0xC0 || hi === 0xD0) ? [s, b[1] & 0x7F] : [s, b[1] & 0x7F, (b[2] || 0) & 0x7F];
    rec.ev.push({ t: performance.now() - rec.t0, b: bytes });
  };
  function rawSend(b) { try { if (selectedMidiOutput) selectedMidiOutput.send(b); } catch (e) {} }

  function recStart() {
    if (rec.playing) recStopPlay(true);
    rec.ev = []; rec.dur = 0; rec.on = true; rec.t0 = performance.now();
    // catat voice yang sedang dipakai supaya file .mid terdengar benar
    var tile = voiceTiles.find(function (x) { return x.id === activeTileId; });
    function voiceEv(v, ch) {
      if (!v) return;
      rec.ev.push({ t: 0, b: [0xB0 | ch, 0, v.msb & 0x7F] });
      rec.ev.push({ t: 0, b: [0xB0 | ch, 32, v.lsb & 0x7F] });
      rec.ev.push({ t: 0, b: [0xC0 | ch, pcOut(v.pc)] });
    }
    voiceEv(tile, mainIdx());
    if ((dualEnabled || PRO.splitOn) && layerIdx() !== mainIdx()) voiceEv(layerVoice, layerIdx());
    startRecClock();
    updateAll();
    note(T('Merekam...', 'Recording...'));
  }
  function recStop() {
    if (!rec.on) return;
    rec.on = false;
    rec.dur = performance.now() - rec.t0;
    stopRecClock();
    updateAll();
    var n = rec.ev.filter(function (e) { return (e.b[0] & 0xF0) === 0x90; }).length;
    note(T('Rekaman selesai: ', 'Recording done: ') + n + T(' nada, ', ' notes, ') + fmtTime(rec.dur));
  }
  function recToggle() { if (rec.on) recStop(); else recStart(); }

  function recPlay() {
    if (!rec.ev.length) { note(T('Belum ada rekaman', 'No recording yet')); return; }
    if (!selectedMidiOutput) { note(T('Belum ada MIDI Out terhubung', 'No MIDI Out connected')); return; }
    if (rec.on) recStop();
    releaseAllVk();
    rec.playing = true; rec.idx = 0; rec.p0 = performance.now();
    rec.tick = setInterval(playTick, 5);
    updateAll();
  }
  function playTick() {
    var el = performance.now() - rec.p0;
    while (rec.idx < rec.ev.length && rec.ev[rec.idx].t <= el) { rawSend(rec.ev[rec.idx].b); rec.idx++; }
    if (rec.idx >= rec.ev.length && el > rec.dur) {
      if (rec.loop) { quietChannels(); rec.idx = 0; rec.p0 = performance.now(); }
      else recStopPlay(false);
    }
  }
  function quietChannels() {
    var seen = {};
    rec.ev.forEach(function (e) { seen[e.b[0] & 0x0F] = 1; });
    Object.keys(seen).forEach(function (c) { rawSend([0xB0 | +c, 123, 0]); rawSend([0xB0 | +c, 64, 0]); });
  }
  function recStopPlay(silent) {
    if (!rec.playing) return;
    clearInterval(rec.tick); rec.tick = null; rec.playing = false;
    quietChannels();
    updateAll();
    if (!silent) note(T('Putar ulang selesai', 'Playback finished'));
  }
  function recClear() {
    if (rec.on || rec.playing) { note(T('Hentikan rekaman/putar dulu', 'Stop recording/playback first')); return; }
    var go = function () { rec.ev = []; rec.dur = 0; updateAll(); };
    if (rec.ev.length) mrAsk(T('Hapus rekaman ini?', 'Delete this recording?'), go, { ok: T('HAPUS', 'DELETE'), danger: true }); else go();
  }

  var clockTimer = null;
  function startRecClock() { stopRecClock(); clockTimer = setInterval(updateAll, 250); }
  function stopRecClock() { if (clockTimer) clearInterval(clockTimer); clockTimer = null; }
  function fmtTime(ms) {
    var s = Math.floor(ms / 1000), m = Math.floor(s / 60);
    return (m < 10 ? '0' : '') + m + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
  }

  // Standard MIDI File, format 0, 480 PPQ, 120 BPM (1 ms = 0,96 tick)
  function vlq(n) {
    var out = [n & 0x7F]; n = Math.floor(n / 128);
    while (n > 0) { out.unshift((n & 0x7F) | 0x80); n = Math.floor(n / 128); }
    return out;
  }
  function buildMidi() {
    var tr = [];
    function push(a) { for (var i = 0; i < a.length; i++) tr.push(a[i]); }
    var nm = 'MIDI ROYALE PRO';
    tr.push(0x00, 0xFF, 0x03, nm.length);
    for (var i = 0; i < nm.length; i++) tr.push(nm.charCodeAt(i));
    push([0x00, 0xFF, 0x51, 0x03, 0x07, 0xA1, 0x20]);       // tempo 500000 us/qn
    push([0x00, 0xFF, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08]); // 4/4
    var last = 0;
    rec.ev.forEach(function (e) {
      var tick = Math.round(e.t * 0.96);
      push(vlq(Math.max(0, tick - last)));
      last = Math.max(last, tick);
      push(e.b);
    });
    var endTick = Math.max(last, Math.round(rec.dur * 0.96));
    push(vlq(endTick - last));
    push([0xFF, 0x2F, 0x00]);
    var len = tr.length;
    var head = [0x4D, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0x01, 0xE0,
      0x4D, 0x54, 0x72, 0x6B, (len >>> 24) & 255, (len >>> 16) & 255, (len >>> 8) & 255, len & 255];
    var out = new Uint8Array(head.length + len);
    out.set(head, 0);
    out.set(tr, head.length);
    return out;
  }
  function recExport() {
    if (!rec.ev.length) { note(T('Belum ada rekaman', 'No recording yet')); return; }
    if (rec.on) recStop();
    try {
      var blob = new Blob([buildMidi()], { type: 'audio/midi' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'MIDI_ROYALE_PRO_' + Date.now() + '.mid';
      a.style.display = 'none';
      document.body.appendChild(a); a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
    } catch (e) { alert(T('Gagal mengekspor file MIDI.', 'Failed to export the MIDI file.')); }
  }

  /* ---------------------------------------------------------------
     Backup cloud (Firestore: user_backups/{uid})
     --------------------------------------------------------------- */
  function buildPayload() {
    return Object.assign({
      appName: 'MIDI ROYALE PRO', author: 'KING TITU', version: String(window.MR_VERSION || '9.0'), timestamp: new Date().toISOString(),
      voiceTiles: voiceTiles, globalCentOffset: globalCentOffset, activeQuartertones: activeQuartertones,
      currentGridCols: currentGridCols, currentFps: currentFps, currentLang: currentLang,
      curveSettings: curveSettings, globalChannel: globalChannel
    }, window.extraPersist());
  }
  function cloudMsg(t, bad) {
    var el = $('proCloudStatus');
    if (el) { el.textContent = t; el.className = 'pro-status' + (bad ? ' bad' : ''); }
  }
  function cloudErr(e) {
    var c = e && e.code ? e.code : '';
    if (c === 'permission-denied') return T('Ditolak server. Pasang firestore.rules terbaru di Firebase Console.', 'Rejected by server. Deploy the latest firestore.rules in Firebase Console.');
    if (c === 'unavailable' || c === 'network-request-failed') return T('Tidak ada koneksi internet.', 'No internet connection.');
    return T('Gagal: ', 'Failed: ') + (e && e.message ? e.message : c || T('tidak diketahui', 'unknown'));
  }
  async function cloudSave() {
    var u = typeof auth !== 'undefined' ? auth.currentUser : null;
    if (!u) { cloudMsg(T('Belum login.', 'Not logged in.'), true); return false; }
    var payload;
    try { payload = JSON.stringify(buildPayload()); } catch (e) { cloudMsg(T('Data gagal dikemas.', 'Could not pack the data.'), true); return false; }
    if (payload.length > 900000) { cloudMsg(T('Data terlalu besar (', 'Data too large (') + Math.round(payload.length / 1024) + T(' KB, maks ~880 KB). Kurangi gambar custom pada tile.', ' KB, max ~880 KB). Remove some custom tile images.'), true); return false; }
    cloudMsg(T('Menyimpan...', 'Saving...'));
    try {
      await db.collection('user_backups').doc(u.uid).set({ payload: payload, updatedAt: firebase.firestore.FieldValue.serverTimestamp(), appVersion: String(window.MR_VERSION || '9.0') });
      cloudMsg(T('Backup tersimpan (', 'Backup saved (') + Math.round(payload.length / 1024) + ' KB).');
      if (window.mrOnBackup) { try { window.mrOnBackup('cloud'); } catch (x) {} }
      return true;
    } catch (e) { cloudMsg(cloudErr(e), true); return false; }
  }
  async function cloudLoad() {
    var u = typeof auth !== 'undefined' ? auth.currentUser : null;
    if (!u) { cloudMsg(T('Belum login.', 'Not logged in.'), true); return; }
    cloudMsg(T('Mengambil backup...', 'Fetching backup...'));
    try {
      var doc = await db.collection('user_backups').doc(u.uid).get();
      if (!doc.exists) { cloudMsg(T('Belum ada backup di cloud.', 'No backup in the cloud yet.'), true); return; }
      var d = doc.data();
      var when = d.updatedAt && d.updatedAt.toDate ? d.updatedAt.toDate().toLocaleString() : '';
      var okGo = await new Promise(function (res) { var done = false; mrAsk(T('Timpa data di perangkat ini dengan backup cloud', 'Overwrite the data on this device with the cloud backup') + (when ? ' (' + when + ')' : '') + '?', function () { done = true; res(true); }); var bx = document.getElementById('mrDlg'); var iv = setInterval(function () { if (!done && bx && bx.classList.contains('off')) { clearInterval(iv); res(false); } else if (done) clearInterval(iv); }, 200); });
      if (!okGo) { cloudMsg(T('Dibatalkan.', 'Cancelled.')); return; }
      var parsed = JSON.parse(d.payload);
      if (applyPresetObject(parsed)) cloudMsg(T('Backup dipulihkan', 'Backup restored') + (when ? ' (' + when + ')' : '') + '.');
      else cloudMsg(T('Isi backup tidak valid.', 'Backup content is invalid.'), true);
    } catch (e) { cloudMsg(e instanceof SyntaxError ? T('Isi backup rusak.', 'Backup content is corrupted.') : cloudErr(e), true); }
  }
  async function cloudInfo() {
    var u = typeof auth !== 'undefined' ? auth.currentUser : null;
    var em = $('proCloudUser');
    if (em) em.textContent = u && u.email ? u.email : '-';
    if (!u) return;
    try {
      var doc = await db.collection('user_backups').doc(u.uid).get();
      if (doc.exists) {
        var d = doc.data();
        var when = d.updatedAt && d.updatedAt.toDate ? d.updatedAt.toDate().toLocaleString() : '-';
        cloudMsg(T('Backup terakhir: ', 'Last backup: ') + when);
      } else cloudMsg(T('Belum ada backup.', 'No backup yet.'));
    } catch (e) { cloudMsg(cloudErr(e), true); }
  }

  /* ---------------------------------------------------------------
     Layout: tablet 2 panel, tombol besar, mode panggung
     --------------------------------------------------------------- */
  function activePanelName() {
    var map = { navVoiceBtn: 'voice', navQtBtn: 'qt', navCtrlBtn: 'ctrl', navStyleBtn: 'style', navKsetBtn: 'kset' };
    for (var k in map) { var b = $(k); if (b && b.classList.contains('active')) return map[k]; }
    return 'voice';
  }
  function ensureAux() {
    /* v7: mode dua-panel dinonaktifkan; tata letak grid landscape di index.html sudah dua kolom.
       Membuka panelCtrl di sini membuatnya menimpa panelVoice di grid yang sama. */
    return;
    if (!document.body.classList.contains('mr-two-pane')) return;
    var q = $('panelQt'), c = $('panelCtrl'), s = $('panelStyle');
    if (q && c && s && q.classList.contains('hidden') && c.classList.contains('hidden') && s.classList.contains('hidden')) c.classList.remove('hidden');
  }
  var _switchMainPanel = window.switchMainPanel;
  window.switchMainPanel = function (n) { _switchMainPanel(n); ensureAux(); };

  function applyLayout() {
    var b = document.body;
    var wide = window.innerWidth >= 980 && window.innerWidth > window.innerHeight;
    var two = ui.layout === 'two' || (ui.layout === 'auto' && wide);
    var was = b.classList.contains('mr-two-pane');
    b.classList.toggle('mr-two-pane', two);
    b.classList.toggle('mr-big', !!ui.big);
    b.classList.toggle('mr-stage', !!ui.stage);
    if (two) ensureAux();
    else if (was) _switchMainPanel(activePanelName());
    updateAll();
  }

  /* ---------------------------------------------------------------
     UI: strip cepat, modal PRO, kotak maqam
     --------------------------------------------------------------- */
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function btn(text, cls, fn, id) {
    var b = el('button', cls || 'pro-btn', text); b.type = 'button';
    if (id) b.id = id;
    if (fn) b.addEventListener('click', fn);
    return b;
  }

  function buildStrip() {
    var host = $('perfStrip');
    if (!host || $('proStrip')) return;
    var s = el('div', 'perf-strip pro-strip'); s.id = 'proStrip';

    var pan = btn('PANIC', 'ptoggle red', null, 'proPanicBtn');
    pan.addEventListener('pointerdown', function (e) { e.preventDefault(); panic(); });
    pan.addEventListener('click', function (e) { e.preventDefault(); });
    s.appendChild(pan);

    var sus = btn('SUS', 'ptoggle', null, 'proSusBtn');
    sus.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      try { sus.setPointerCapture(e.pointerId); } catch (x) {}
      if (PRO.susLatch) susSet(!PRO.susDown); else if (!PRO.susDown) susSet(true);
    });
    var susUp = function () { if (!PRO.susLatch && PRO.susDown) susSet(false); };
    sus.addEventListener('pointerup', susUp);
    sus.addEventListener('pointercancel', susUp);
    sus.addEventListener('lostpointercapture', susUp);
    sus.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    s.appendChild(sus);

    s.appendChild(btn('SPLIT', 'ptoggle', function () { setSplit(!PRO.splitOn); }, 'proSplitBtn'));
    s.appendChild(btn('● REC', 'ptoggle', recToggle, 'proRecBtn'));

    var song = el('div', 'pro-song');
    song.appendChild(btn('◀', 'pstep', function () { songStep(-1); }));
    song.appendChild(btn('SETLIST', 'pro-songname', function () { openModal('setlist'); }, 'proSongName'));
    song.appendChild(btn('▶', 'pstep', function () { songStep(1); }));
    s.appendChild(song);

    s.appendChild(btn('PRO', 'ptoggle', function () { openModal(); }, 'proOpenBtn'));
    s.appendChild(btn('⚙', 'ptoggle', function () { try { openSettingsModal(); } catch (e) {} }, 'proGearBtn'));
    host.insertAdjacentElement('afterend', s);
  }

  var TABS = [['setlist', 'SETLIST', 'SETLIST'], ['split', 'SPLIT', 'SPLIT'], ['mixer', 'MIXER', 'MIXER'], ['rec', 'REKAM', 'RECORD'], ['cloud', 'CLOUD', 'CLOUD'], ['view', 'TAMPILAN', 'VIEW']];
  var curTab = 'setlist';

  function buildModal() {
    if ($('proModal')) return;
    var m = el('div', 'pro-modal pro-hide'); m.id = 'proModal';
    m.addEventListener('pointerdown', function (e) { if (e.target === m) closeModal(); });
    var card = el('div', 'pro-card glass-card');
    var head = el('div', 'pro-head');
    head.appendChild(el('h3', 'pro-title', 'MIDI ROYALE PRO TOOLS'));
    head.appendChild(btn('✕', 'pro-x', closeModal));
    card.appendChild(head);
    var tabs = el('div', 'pro-tabs'); tabs.id = 'proTabs';
    TABS.forEach(function (t) { var b = btn(T(t[1], t[2]), 'pro-tab', function () { showTab(t[0]); }); b.dataset.tab = t[0]; tabs.appendChild(b); });
    card.appendChild(tabs);

    // ---- SETLIST
    var s1 = el('div', 'pro-sec'); s1.dataset.sec = 'setlist';
    s1.appendChild(el('p', 'pro-help', T('Simpan kondisi sekarang (voice, layer, tuning, transpose, split, mixer, maqam) sebagai satu lagu. Panggil dengan tombol ◀ ▶ di layar utama.', 'Save the current state (voice, layer, tuning, transpose, split, mixer, maqam) as one song. Recall it with the ◀ ▶ buttons on the main screen.')));
    var row = el('div', 'pro-row');
    var inp = el('input', 'pro-input'); inp.id = 'proSongInput'; inp.type = 'text'; inp.maxLength = 60; inp.placeholder = T('Nama lagu (kosong = nama voice)', 'Song name (empty = voice name)');
    row.appendChild(inp);
    row.appendChild(btn(T('+ TAMBAH', '+ ADD'), 'pro-btn pri', function () { songAdd(inp.value); inp.value = ''; }));
    s1.appendChild(row);
    var list = el('div', 'pro-list'); list.id = 'proSongList';
    s1.appendChild(list);
    card.appendChild(s1);

    // ---- SPLIT
    var s2 = el('div', 'pro-sec'); s2.dataset.sec = 'split';
    s2.appendChild(el('p', 'pro-help', T('Keyboard virtual dibagi dua: nada di bawah titik split memakai voice kiri (layer) di channel layer, sisanya memakai voice utama.', 'The virtual keyboard is split in two: notes below the split point use the left voice (layer) on the layer channel, the rest use the main voice.')));
    var r1 = el('div', 'pro-row');
    r1.appendChild(btn('SPLIT: OFF', 'pro-btn', function () { setSplit(!PRO.splitOn); }, 'proSplitToggle'));
    s2.appendChild(r1);
    var r2 = el('div', 'pro-row');
    r2.appendChild(el('span', 'pro-lbl', T('Titik split', 'Split point')));
    r2.appendChild(btn('−1', 'pro-btn sm', function () { stepSplit(-1); }));
    var sv = el('span', 'pro-val', 'C4'); sv.id = 'proSplitVal'; r2.appendChild(sv);
    r2.appendChild(btn('+1', 'pro-btn sm', function () { stepSplit(1); }));
    r2.appendChild(btn('−12', 'pro-btn sm', function () { stepSplit(-12); }));
    r2.appendChild(btn('+12', 'pro-btn sm', function () { stepSplit(12); }));
    s2.appendChild(r2);
    var r3 = el('div', 'pro-row');
    r3.appendChild(btn(T('SET DARI KEY', 'SET FROM KEY'), 'pro-btn', function () {
      PRO.splitSetArmed = !PRO.splitSetArmed;
      if (PRO.splitSetArmed) { if (!kbVisible) toggleKeyboardDock(); closeModal(); note(T('Tekan satu tombol di keyboard virtual', 'Press one key on the virtual keyboard')); }
      updateAll();
    }, 'proSplitArm'));
    r3.appendChild(btn(T('VOICE KIRI...', 'LEFT VOICE...'), 'pro-btn', function () {
      layerPickArmed = true; updateDualUI(); switchMainPanel('voice'); closeModal(); note(T('Pilih voice tangan kiri', 'Pick the left-hand voice'));
    }));
    s2.appendChild(r3);
    var r4 = el('div', 'pro-row');
    r4.appendChild(el('span', 'pro-lbl', T('Channel kiri', 'Left channel')));
    var chs = el('select', 'pro-input'); chs.id = 'proLeftCh';
    for (var c = 1; c <= 16; c++) { var o = el('option', '', 'Ch. ' + (c < 10 ? '0' : '') + c); o.value = c; chs.appendChild(o); }
    chs.addEventListener('change', function () { changeLayerChannel(chs.value); updateAll(); });
    r4.appendChild(chs);
    s2.appendChild(r4);
    var inf = el('p', 'pro-help'); inf.id = 'proSplitInfo'; s2.appendChild(inf);
    card.appendChild(s2);

    // ---- MIXER
    var s3 = el('div', 'pro-sec'); s3.dataset.sec = 'mixer';
    s3.appendChild(el('p', 'pro-help', T('Kontrol per channel (CC). Nilai yang kamu gerakkan ikut tersimpan di setlist dan REG.', 'Per-channel control (CC). Values you move are saved in the setlist and REG.')));
    var lat = el('label', 'pro-check');
    var lc = el('input'); lc.type = 'checkbox'; lc.id = 'proSusLatch';
    lc.addEventListener('change', function () { PRO.susLatch = lc.checked; if (!lc.checked && PRO.susDown) susSet(false); persist(); });
    lat.appendChild(lc); lat.appendChild(document.createTextNode(T(' Sustain mode kunci (tekan SUS = nyala/mati)', ' Sustain latch mode (tap SUS = on/off)')));
    s3.appendChild(lat);
    ['main', 'layer'].forEach(function (w) {
      var box = el('div', 'pro-mix');
      var h = el('div', 'pro-mixh', w === 'main' ? T('CHANNEL UTAMA', 'MAIN CHANNEL') : T('CHANNEL LAYER / KIRI', 'LAYER / LEFT CHANNEL')); h.dataset.mixh = w; box.appendChild(h);
      CC_DEFS.forEach(function (d) {
        var r = el('div', 'pro-row');
        r.appendChild(el('span', 'pro-lbl', d[1] + ' (CC' + d[0] + ')'));
        var rg = el('input', 'pro-range'); rg.type = 'range'; rg.min = 0; rg.max = 127; rg.step = 1; rg.value = d[2];
        rg.dataset.w = w; rg.dataset.cc = d[0];
        var vv = el('span', 'pro-val sm', String(d[2]));
        rg.addEventListener('input', function () { vv.textContent = rg.value; setCC(w, d[0], rg.value); });
        r.appendChild(rg); r.appendChild(vv);
        box.appendChild(r);
      });
      var rr = el('div', 'pro-row');
      rr.appendChild(btn(T('KIRIM ULANG', 'RESEND'), 'pro-btn sm', function () { resendCC(w); note(T('CC dikirim ulang', 'CC resent')); }));
      rr.appendChild(btn(T('RESET NILAI', 'RESET VALUES'), 'pro-btn sm', function () { PRO.cc[w] = {}; updateAll(); persist(); }));
      box.appendChild(rr);
      s3.appendChild(box);
    });
    card.appendChild(s3);

    // ---- REKAM
    var s4 = el('div', 'pro-sec'); s4.dataset.sec = 'rec';
    s4.appendChild(el('p', 'pro-help', T('Merekam semua nada, pitch bend, dan CC yang dikirim aplikasi ke MIDI Out. Ekspor sebagai file .mid (120 BPM).', 'Records every note, pitch bend and CC the app sends to MIDI Out. Export as a .mid file (120 BPM).')));
    var rr1 = el('div', 'pro-row');
    rr1.appendChild(btn(T('● REKAM', '● RECORD'), 'pro-btn', recToggle, 'proRecToggle'));
    rr1.appendChild(btn(T('▶ PUTAR', '▶ PLAY'), 'pro-btn', function () { if (rec.playing) recStopPlay(false); else recPlay(); }, 'proPlayToggle'));
    rr1.appendChild(btn(T('HAPUS', 'CLEAR'), 'pro-btn', recClear));
    s4.appendChild(rr1);
    var rr2 = el('div', 'pro-row');
    rr2.appendChild(btn(T('EKSPOR .MID', 'EXPORT .MID'), 'pro-btn pri', recExport));
    var lp = el('label', 'pro-check');
    var lpc = el('input'); lpc.type = 'checkbox'; lpc.id = 'proLoop';
    lpc.addEventListener('change', function () { rec.loop = lpc.checked; });
    lp.appendChild(lpc); lp.appendChild(document.createTextNode(T(' Ulangi', ' Loop')));
    rr2.appendChild(lp);
    s4.appendChild(rr2);
    var rs = el('p', 'pro-status'); rs.id = 'proRecStatus'; s4.appendChild(rs);
    card.appendChild(s4);

    // ---- CLOUD
    var s5 = el('div', 'pro-sec'); s5.dataset.sec = 'cloud';
    s5.appendChild(el('p', 'pro-help', T('Simpan seluruh preset (tile, tuning, REG, setlist, mixer) ke akunmu supaya aman kalau HP diganti.', 'Save all presets (tiles, tuning, REG, setlist, mixer) to your account so they are safe if you change phones.')));
    var cu = el('p', 'pro-help'); cu.appendChild(document.createTextNode(T('Akun: ', 'Account: '))); var cus = el('b', '', '-'); cus.id = 'proCloudUser'; cu.appendChild(cus);
    s5.appendChild(cu);
    var cr = el('div', 'pro-row');
    cr.appendChild(btn(T('SIMPAN KE CLOUD', 'SAVE TO CLOUD'), 'pro-btn pri', cloudSave));
    cr.appendChild(btn(T('PULIHKAN', 'RESTORE'), 'pro-btn', cloudLoad));
    s5.appendChild(cr);
    var cs = el('p', 'pro-status'); cs.id = 'proCloudStatus'; s5.appendChild(cs);
    card.appendChild(s5);

    // ---- TAMPILAN
    var s6 = el('div', 'pro-sec'); s6.dataset.sec = 'view';
    s6.appendChild(el('p', 'pro-help', T('Pengaturan ini hanya berlaku di perangkat ini.', 'These settings apply to this device only.')));
    var vr = el('div', 'pro-row');
    vr.appendChild(el('span', 'pro-lbl', T('Tata letak', 'Layout')));
    var ls = el('select', 'pro-input'); ls.id = 'proLayoutSel';
    [['auto', T('Otomatis (tablet = 2 panel)', 'Auto (tablet = 2 panels)')], ['one', T('Satu panel', 'One panel')], ['two', T('Dua panel', 'Two panels')]].forEach(function (p) { var o = el('option', '', p[1]); o.value = p[0]; ls.appendChild(o); });
    ls.addEventListener('change', function () { ui.layout = ls.value; saveUI(); applyLayout(); });
    vr.appendChild(ls);
    s6.appendChild(vr);
    [['proBigChk', 'big', T(' Tombol besar', ' Big buttons')], ['proStageChk', 'stage', T(' Mode panggung (sembunyikan header & footer)', ' Stage mode (hide header & footer)')]].forEach(function (p) {
      var lb = el('label', 'pro-check'); var ck = el('input'); ck.type = 'checkbox'; ck.id = p[0];
      ck.addEventListener('change', function () { ui[p[1]] = ck.checked; saveUI(); applyLayout(); });
      lb.appendChild(ck); lb.appendChild(document.createTextNode(p[2])); s6.appendChild(lb);
    });
    var tr = el('div', 'pro-row');
    tr.appendChild(btn(T('TEMA WARNA & BAHASA...', 'COLOR THEME & LANGUAGE...'), 'pro-btn', function () { closeModal(); try { openSettingsModal(); } catch (e) {} }));
    s6.appendChild(tr);
    card.appendChild(s6);

    m.appendChild(card);
    document.body.appendChild(m);
  }

  function stepSplit(d) {
    PRO.splitPoint = cl(PRO.splitPoint + d, 0, 127);
    updateVkMarks(); updateAll(); persist();
  }
  function showTab(t) {
    curTab = t;
    document.querySelectorAll('#proModal .pro-tab').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === t); });
    document.querySelectorAll('#proModal .pro-sec').forEach(function (s) { s.classList.toggle('pro-hide', s.dataset.sec !== t); });
    if (t === 'cloud') cloudInfo();
    if (t === 'setlist') renderSongs();
    updateAll();
  }
  function openModal(tab) {
    buildModal();
    $('proModal').classList.remove('pro-hide');
    showTab(tab || curTab);
  }
  function closeModal() { var m = $('proModal'); if (m) m.classList.add('pro-hide'); }

  function renderSongs() {
    var list = $('proSongList');
    if (!list) return;
    list.textContent = '';
    if (!PRO.songs.length) { list.appendChild(el('p', 'pro-help', T('Belum ada lagu. Atur voice/tuning, lalu tekan + TAMBAH.', 'No songs yet. Set the voice/tuning, then tap + ADD.'))); return; }
    PRO.songs.forEach(function (s, i) {
      var r = el('div', 'pro-song-row' + (i === PRO.songIdx ? ' cur' : ''));
      r.appendChild(el('span', 'pro-idx', String(i + 1)));
      var nm = btn(s.name || (T('Lagu ', 'Song ') + (i + 1)), 'pro-song-name', function () { songPlay(i); });
      r.appendChild(nm);
      r.appendChild(btn('↑', 'pro-btn sm', function () { songMove(i, -1); }));
      r.appendChild(btn('↓', 'pro-btn sm', function () { songMove(i, 1); }));
      r.appendChild(btn('✎', 'pro-btn sm', function () { songRename(i); }));
      r.appendChild(btn('⟳', 'pro-btn sm', function () { songUpdate(i); }));
      r.appendChild(btn('✕', 'pro-btn sm bad', function () { songDelete(i); }));
      list.appendChild(r);
    });
  }

  function buildMaqamBox() {
    var anchor = $('sysexBrandSelect');
    if (!anchor || $('proMaqamBox')) return;
    var row = anchor.parentElement;
    var box = el('div', 'pro-maqam'); box.id = 'proMaqamBox';
    var l = el('span', 'pro-lbl', 'MAQAM:'); box.appendChild(l);
    var ms = el('select', 'set-select'); ms.id = 'proMaqamSel';
    MAQAMS.forEach(function (m) { var o = el('option', '', m.name); o.value = m.id; ms.appendChild(o); });
    var ts = el('select', 'set-select'); ts.id = 'proTonicSel';
    NOTE_NAMES.forEach(function (n, i) { var o = el('option', '', n); o.value = i; ts.appendChild(o); });
    ms.addEventListener('change', function () { var d = maqamDef(ms.value); if (d) ts.value = d.tonic; showMaqamNote(); });
    box.appendChild(ms);
    box.appendChild(el('span', 'pro-lbl', T('TONIKA:', 'TONIC:')));
    box.appendChild(ts);
    box.appendChild(btn(T('TERAPKAN', 'APPLY'), 'pro-btn sm pri', function () { applyMaqam(ms.value, ts.value); }));
    box.appendChild(el('span', 'pro-lbl', T('GESER:', 'SHIFT:')));
    box.appendChild(btn('−½', 'pro-btn sm', function () { shiftTuning(-1); }));
    box.appendChild(btn('+½', 'pro-btn sm', function () { shiftTuning(1); }));
    var nt = el('div', 'pro-help full'); nt.id = 'proMaqamNote'; box.appendChild(nt);
    row.insertAdjacentElement('afterend', box);
    ts.value = MAQAMS[0].tonic;
    showMaqamNote();
  }
  function showMaqamNote() {
    var ms = $('proMaqamSel'), n = $('proMaqamNote');
    if (!ms || !n) return;
    var d = maqamDef(ms.value);
    var cur = PRO.maqam ? (maqamDef(PRO.maqam.id).name + ' on ' + NOTE_NAMES[PRO.maqam.tonic]) : '-';
    n.textContent = (d ? T(d.note, d.noteEn || d.note) + '. ' : '') + T('Aktif: ', 'Active: ') + cur + T('. "GESER" memindahkan seluruh tuning naik/turun satu semiton.', '. "SHIFT" moves the whole tuning up/down one semitone.');
  }

  /* ---------------------------------------------------------------
     Sinkron tampilan
     --------------------------------------------------------------- */
  function updateAll() {
    var sb = $('proSplitBtn');
    if (sb) { sb.classList.toggle('on', PRO.splitOn); sb.textContent = PRO.splitOn ? 'SPLIT ' + noteName(PRO.splitPoint) : 'SPLIT'; }
    var su = $('proSusBtn'); if (su) su.classList.toggle('on', PRO.susDown);
    var rb = $('proRecBtn');
    if (rb) {
      rb.classList.toggle('rec', rec.on);
      rb.textContent = rec.on ? '■ ' + fmtTime(performance.now() - rec.t0) : (rec.playing ? '▶ ...' : '● REC');
    }
    var sn = $('proSongName');
    if (sn) { var s = PRO.songs[PRO.songIdx]; sn.textContent = s ? (PRO.songIdx + 1) + '. ' + s.name : 'SETLIST'; }

    var m = $('proModal');
    if (m && !m.classList.contains('pro-hide')) {
      var t = $('proSplitToggle'); if (t) { t.textContent = PRO.splitOn ? 'SPLIT: ON' : 'SPLIT: OFF'; t.classList.toggle('pri', PRO.splitOn); }
      var v = $('proSplitVal'); if (v) v.textContent = noteName(PRO.splitPoint) + ' (' + PRO.splitPoint + ')';
      var a = $('proSplitArm'); if (a) a.classList.toggle('pri', PRO.splitSetArmed);
      var lc = $('proLeftCh'); if (lc) lc.value = layerChannel;
      var si = $('proSplitInfo');
      if (si) si.textContent = T('Kiri: ', 'Left: ') + (layerVoice ? layerVoice.name : T('(belum dipilih)', '(not chosen)')) + ' · CH ' + layerChannel + T(' → nada < ', ' → notes < ') + noteName(PRO.splitPoint) + T('. Kanan: voice utama · CH ', '. Right: main voice · CH ') + globalChannel + '.';
      var lat = $('proSusLatch'); if (lat) lat.checked = PRO.susLatch;
      document.querySelectorAll('#proModal .pro-range').forEach(function (rg) {
        var d = CC_DEFS.filter(function (x) { return x[0] === +rg.dataset.cc; })[0];
        var val = PRO.cc[rg.dataset.w][rg.dataset.cc];
        if (document.activeElement !== rg) { rg.value = val === undefined ? d[2] : val; if (rg.nextSibling) rg.nextSibling.textContent = rg.value; }
      });
      var rt = $('proRecToggle'); if (rt) { rt.textContent = rec.on ? T('■ STOP REKAM', '■ STOP RECORDING') : T('● REKAM', '● RECORD'); rt.classList.toggle('pri', rec.on); }
      var pt = $('proPlayToggle'); if (pt) { pt.textContent = rec.playing ? '■ STOP' : T('▶ PUTAR', '▶ PLAY'); pt.classList.toggle('pri', rec.playing); }
      var rs = $('proRecStatus');
      if (rs) {
        var nn = rec.ev.filter(function (e) { return (e.b[0] & 0xF0) === 0x90; }).length;
        rs.textContent = rec.on ? T('Merekam ', 'Recording ') + fmtTime(performance.now() - rec.t0) + ' · ' + nn + T(' nada', ' notes') : (rec.ev.length ? T('Tersimpan: ', 'Saved: ') + nn + T(' nada, ', ' notes, ') + fmtTime(rec.dur) : T('Belum ada rekaman', 'No recording yet'));
      }
      var lps = $('proLoop'); if (lps) lps.checked = rec.loop;
      var ly = $('proLayoutSel'); if (ly) ly.value = ui.layout;
      var bg = $('proBigChk'); if (bg) bg.checked = ui.big;
      var sg = $('proStageChk'); if (sg) sg.checked = ui.stage;
    }
    showMaqamNote();
    var ts = $('proTonicSel');
    if (ts && PRO.maqam && document.activeElement !== ts) { ts.value = PRO.maqam.tonic; var ms = $('proMaqamSel'); if (ms) ms.value = PRO.maqam.id; }
    var ex = $('proStageExit');
    if (ex) ex.classList.toggle('pro-hide', !ui.stage);
  }

  /* ---------------------------------------------------------------
     Init
     --------------------------------------------------------------- */
  function init() {
    buildStrip();
    buildMaqamBox();
    buildModal();
    if (!$('proStageExit')) {
      var ex = btn(T('KELUAR MODE PANGGUNG', 'EXIT STAGE MODE'), 'pro-stage-exit pro-hide', function () { ui.stage = false; saveUI(); applyLayout(); }, 'proStageExit');
      document.body.appendChild(ex);
    }
    window.addEventListener('resize', applyLayout);
    window.addEventListener('orientationchange', applyLayout);
    applyLayout();
    updateVkMarks();
    updateDualUI();
    renderSongs();
    updateAll();
  }
  buildStrip();
  buildMaqamBox();
  window.addEventListener('load', init);

  // Ganti bahasa: bangun ulang jendela PRO dan kotak maqam dengan teks baru
  (window.mrLangHooks = window.mrLangHooks || []).push(function () {
    var m = $('proModal'), wasOpen = m && !m.classList.contains('pro-hide');
    if (m) m.parentNode.removeChild(m);
    buildModal();
    if (wasOpen) openModal(curTab);
    var mb = $('proMaqamBox');
    if (mb) {
      var mv = $('proMaqamSel') ? $('proMaqamSel').value : null, tv = $('proTonicSel') ? $('proTonicSel').value : null;
      mb.parentNode.removeChild(mb); buildMaqamBox();
      if (mv !== null && $('proMaqamSel')) $('proMaqamSel').value = mv;
      if (tv !== null && $('proTonicSel')) $('proTonicSel').value = tv;
      showMaqamNote();
    }
    var ex = $('proStageExit'); if (ex) ex.textContent = T('KELUAR MODE PANGGUNG', 'EXIT STAGE MODE');
    renderSongs(); updateAll();
  });

  // Dipakai pengujian dan konsol
  window.MRPRO = { state: PRO, rec: rec, panic: panic, setSplit: setSplit, applyMaqam: applyMaqam, shiftTuning: shiftTuning,
    songAdd: songAdd, songPlay: songPlay, songStep: songStep, recStart: recStart, recStop: recStop, recPlay: recPlay,
    buildMidi: buildMidi, setCC: setCC, susSet: susSet, openModal: openModal, applyLayout: applyLayout, ui: ui,
    buildPayload: buildPayload, noteName: noteName, cloudSave: cloudSave, songCount: function () { return PRO.songs.length; } };
})();
