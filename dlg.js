/* MIDI ROYALE PRO - kotak dialog di dalam aplikasi.
   Pengganti window.confirm / window.prompt: di aplikasi APK (TWA/WebView) kotak bawaan browser bisa
   diblokir sehingga langsung dianggap "Batal" (contoh: LOGOUT di Pengaturan tidak berfungsi).
   mrAsk(pesan, lanjut, opsi)        -> lanjut() dipanggil bila OK
   mrInput(pesan, nilai, lanjut)     -> lanjut(teks) dipanggil bila OK (teks boleh kosong) */
(function () {
  'use strict';
  function en() { try { return currentLang === 'en'; } catch (e) { return false; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var box = null, cb = null, inp = false;
  function css() {
    if (document.getElementById('mrDlgCss')) return;
    var s = document.createElement('style'); s.id = 'mrDlgCss';
    s.textContent = '#mrDlg{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:1rem;background:rgba(0,0,0,.72)}' +
      '#mrDlg.off{display:none}' +
      '#mrDlg .dl-card{width:min(440px,100%);display:flex;flex-direction:column;gap:.8rem;padding:1rem;border-radius:1rem;background:#0d1019;border:1px solid rgb(var(--accent-rgb,212 175 55)/.55);color:#e2e8f0;box-shadow:0 18px 50px rgba(0,0,0,.7);font:600 .9rem/1.45 system-ui,sans-serif}' +
      '#mrDlg .dl-msg{white-space:pre-line;word-break:break-word}' +
      '#mrDlg input{min-height:46px;border-radius:.7rem;border:1px solid #334155;background:#0f172a;color:#f8fafc;padding:0 .8rem;font-size:1rem;user-select:text;-webkit-user-select:text}' +
      '#mrDlg input:focus{outline:none;border-color:rgb(var(--accent-rgb,212 175 55))}' +
      '#mrDlg .dl-acts{display:flex;gap:.5rem;justify-content:flex-end}' +
      '#mrDlg button{min-height:46px;min-width:96px;padding:0 1rem;border-radius:.75rem;border:1px solid #334155;background:#111827;color:#e2e8f0;font:800 .75rem Orbitron,sans-serif;letter-spacing:.04em}' +
      '#mrDlg button.ok{border-color:rgb(var(--accent-rgb,212 175 55));background:rgb(var(--accent-rgb,212 175 55)/.18);color:rgb(var(--ac-300,240 210 120))}' +
      '#mrDlg button.ok.bad{border-color:#ef4444;background:rgba(239,68,68,.15);color:#fca5a5}' +
      'body.pa-mode #mrDlg .dl-card{border-color:#00ff66;background:#03140a;color:#b6ffd2}';
    document.head.appendChild(s);
  }
  function build() {
    if (box) return box;
    css();
    box = document.createElement('div'); box.id = 'mrDlg'; box.className = 'off';
    box.innerHTML = '<div class="dl-card" role="dialog" aria-modal="true"><div class="dl-msg"></div><input type="text" maxlength="80"><div class="dl-acts"><button type="button" class="no"></button><button type="button" class="ok"></button></div></div>';
    document.body.appendChild(box);
    box.addEventListener('click', function (e) {
      if (e.target === box || e.target.closest('.no')) close(false);
      else if (e.target.closest('.ok')) close(true);
    });
    box.querySelector('input').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); close(true); } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && box && !box.classList.contains('off')) close(false); });
    return box;
  }
  function close(ok) {
    if (!box) return;
    var f = cb, v = box.querySelector('input').value;
    box.classList.add('off'); cb = null;
    if (ok && f) { try { inp ? f(v) : f(); } catch (e) { console.error(e); } }
  }
  function show(msg, isInput, val, fn, o) {
    o = o || {};
    build();
    inp = isInput; cb = fn;
    box.querySelector('.dl-msg').innerHTML = esc(msg);
    var i = box.querySelector('input');
    i.style.display = isInput ? '' : 'none'; i.value = val == null ? '' : String(val);
    var ok = box.querySelector('.ok');
    ok.textContent = o.ok || 'OK'; ok.classList.toggle('bad', !!o.danger);
    box.querySelector('.no').textContent = o.no || (en() ? 'CANCEL' : 'BATAL');
    box.classList.remove('off');
    if (isInput) setTimeout(function () { try { i.focus(); i.select(); } catch (e) {} }, 30);
    else setTimeout(function () { try { ok.focus(); } catch (e) {} }, 30);
  }
  window.mrAsk = function (msg, fn, o) { show(msg, false, '', fn, o); };
  window.mrInput = function (msg, val, fn, o) { show(msg, true, val, fn, o); };
})();
