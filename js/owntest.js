/* Test your own: runs the submitted and improved detectors on a user's recording */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const view = $('#own');
  let last = null, viewAll = false, pos = 0, started = false;

  /* ---------- open and close the separate view */
  function open(push) {
    view.hidden = false; document.body.classList.add('own-mode');
    if (push !== false) history.replaceState(null, '', '#test-own');
    window.scrollTo(0, 0);
    if (!started) { started = true; loadExample(Object.keys(window.EXAMPLES)[0]); } else if (last) draw();
  }
  function close() {
    DSP.stop(); view.hidden = true; document.body.classList.remove('own-mode');
    const a = document.querySelector('.step.active');
    history.replaceState(null, '', '#' + (a ? a.dataset.id : 'welcome'));
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-own]'); if (!b) return;
    e.preventDefault(); b.dataset.own === 'close' ? close() : open();
  });
  $('#ownBtn').addEventListener('click', () => (view.hidden ? open() : close()));
  document.addEventListener('click', e => { if (!view.hidden && e.target.closest('[data-goto], .side-item')) close(); }, true);
  window.addEventListener('hashchange', () => { if (location.hash === '#test-own') open(false); });
  if (location.hash === '#test-own') open(false);

  /* ---------- inputs */
  $('#ownEx').innerHTML = Object.entries(window.EXAMPLES).map(([k, v], i) => `<button type="button" data-v="${k}" title="${v.label}">${v.label.split(' · ')[0]}</button>`).join('');
  $('#ownEx').addEventListener('click', e => { const b = e.target.closest('button'); if (b) loadExample(b.dataset.v); });
  $('#ownFile').addEventListener('change', e => handleFiles(e.target.files));
  const drop = $('#ownDrop');
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => handleFiles(e.dataTransfer.files));
  $('#ownView').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('#ownView button').forEach(x => x.classList.toggle('on', x === b)); viewAll = b.dataset.v === 'all'; $('#ownPos').disabled = viewAll; draw(); });
  $('#ownPos').addEventListener('input', e => { pos = +e.target.value; draw(); });
  $('#ownPlay').addEventListener('click', () => {
    if (!last) return;
    const [t0, t1] = win();
    DSP.play(last.y.subarray(Math.floor(t0 * PCG.FS), Math.floor(t1 * PCG.FS)));
  });
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => !view.hidden && last && draw(), 150); });

  const status = t => { $('#ownStatus').textContent = t; };
  function b64(s) { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
  function loadExample(id) {
    $$('#ownEx button').forEach(b => b.classList.toggle('on', b.dataset.v === id));
    const ex = window.EXAMPLES[id];
    run(`${id} · ${ex.label}`, b64(ex.wav), ex.tsv);
  }
  async function handleFiles(files) {
    const list = Array.from(files);
    const wav = list.find(f => /\.wav$/i.test(f.name) || (f.type || '').startsWith('audio'));
    const tsv = list.find(f => /\.(tsv|txt)$/i.test(f.name));
    if (!wav) { status('Choose a .wav recording, optionally together with its .tsv annotation file.'); return; }
    $$('#ownEx button').forEach(b => b.classList.remove('on'));
    run(wav.name + (tsv ? ' + ' + tsv.name : ''), await wav.arrayBuffer(), tsv ? await tsv.text() : null);
  }
  async function run(name, buf, tsv) {
    DSP.stop(); status('Analysing ' + name + '…');
    await new Promise(r => setTimeout(r, 30));
    let w = PCG.parseWav(buf);
    if (!w) {
      try { const ctx = new OfflineAudioContext(1, 1, 8000); const ab = await ctx.decodeAudioData(buf.slice(0)); w = { fs: ab.sampleRate, x: Float64Array.from(ab.getChannelData(0)) }; }
      catch (e) { status('That file could not be read. Use a PCM .wav recording.'); return; }
    }
    if (w.x.length < w.fs) { status('The recording is shorter than one second. Use a longer recording.'); return; }
    const res = PCG.analyse(w.x, w.fs, tsv);
    last = res; pos = 0; $('#ownPos').value = 0;
    $('#ownWarn').hidden = !res.auto;
    verdict($('#ownImp'), res.imp);
    const names = { dRMS: 'ΔRMS', dZCR: 'ΔZCR', early: 'Early-third ΔRMS', loudest: 'Loudest-third ΔRMS', envVar: 'Steady envelope' };
    const rows = res.imp.keys.map((k, i) => [names[k], res.imp.z[i]]);
    $('#ownZ tbody').innerHTML = rows.map(([a, z]) => `<tr><td>${a}</td><td class="n">${z >= 0 ? '+' : ''}${z.toFixed(2)}</td></tr>`).join('');
    status(`${name} · ${res.dur.toFixed(1)} s · ${res.cyc.length} complete heartbeats from ${res.auto ? 'our automatic S1/S2 detector' : 'the annotation file'}.` + (res.cyc.length ? '' : ' No complete heartbeats: add the .tsv annotation file.'));
    draw();
  }
  function verdict(el, d) {
    el.classList.toggle('murmur', d.murmur); el.classList.toggle('normal', !d.murmur);
    $('.call', el).textContent = d.flags.length ? (d.murmur ? 'Murmur' : 'Normal') : 'No cycles';
    $('.vbar i', el).style.width = (100 * d.fraction).toFixed(0) + '%';
    $('.vbar s', el).style.left = (100 * d.frac).toFixed(0) + '%';
    $('.detail', el).textContent = d.flags.length ? `${d.flags.filter(Boolean).length} of ${d.flags.length} cycles flagged (${(100 * d.fraction).toFixed(0)}%); a murmur needs ${(100 * d.frac).toFixed(0)}%.` : 'No complete heartbeats were found.';
  }

  /* ---------- plots */
  function win() {
    if (viewAll) return [0, last.dur];
    const L = Math.min(10, last.dur), a = pos * (last.dur - L); return [a, a + L];
  }
  function canvas(c) {
    const r = window.devicePixelRatio || 1, w = c.clientWidth, h = +c.getAttribute('height');
    c.width = Math.round(w * r); c.height = Math.round(h * r); c.style.height = h + 'px';
    const g = c.getContext('2d'); g.setTransform(r, 0, 0, r, 0, 0); return { g, w, h };
  }
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function timeAxis(g, L, T, pw, ph, t0, t1, title) {
    g.strokeStyle = '#C9D1DD'; g.lineWidth = 1; g.strokeRect(L + 0.5, T + 0.5, pw, ph);
    g.fillStyle = '#6B778A'; g.font = '11px Inter, "Segoe UI", sans-serif'; g.textAlign = 'center';
    const span = t1 - t0, step = [0.5, 1, 2, 5, 10, 20].find(v => pw / (span / v) >= 56) || 20;
    for (let s = Math.ceil(t0 / step) * step; s <= t1 + 1e-9; s += step) g.fillText(+s.toFixed(1) + ' s', L + ((s - t0) / span) * pw, T + ph + 16);
    g.textAlign = 'left'; g.fillStyle = '#0C2340'; g.font = '600 12px Inter, "Segoe UI", sans-serif'; g.fillText(title, L, 13);
  }
  function draw() {
    if (!last || view.hidden) return;
    const res = last, [t0, t1] = win(), FS = PCG.FS;
    { // waveform
      const { g, w, h } = canvas($('#ownWave'));
      const L = 46, R = 10, T = 26, B = 24, pw = w - L - R, ph = h - T - B, X = t => L + ((t - t0) / (t1 - t0)) * pw;
      g.clearRect(0, 0, w, h); g.save(); g.beginPath(); g.rect(L, T, pw, ph); g.clip();
      const segC = { 1: css('--a-s1'), 2: css('--a-sys'), 3: css('--a-s2'), 4: css('--a-dia') };
      for (const [a, b, lab] of res.t) if (segC[lab] && b > t0 && a < t1) { g.fillStyle = segC[lab]; g.fillRect(X(a), T, Math.max(1, X(b) - X(a)), ph); }
      g.fillStyle = 'rgba(224,161,0,.55)';
      res.cyc.forEach((c, i) => { if (res.imp.flags[i] && c.end > t0 && c.start < t1) g.fillRect(X(c.start), T, Math.max(2, X(c.end) - X(c.start)), ph); });
      let m = 0; const i0 = Math.floor(t0 * FS), i1 = Math.min(res.y.length, Math.floor(t1 * FS));
      for (let i = i0; i < i1; i++) m = Math.max(m, Math.abs(res.y[i]));
      const mid = T + ph / 2, A = (ph / 2) * 0.9 / (m || 1), span = i1 - i0;
      g.strokeStyle = '#0B1424'; g.lineWidth = 1; g.beginPath();
      for (let px = 0; px < pw; px++) {
        const a = i0 + Math.floor(px / pw * span), b = Math.max(a + 1, i0 + Math.floor((px + 1) / pw * span));
        let lo = Infinity, hi = -Infinity; for (let i = a; i < b && i < i1; i++) { lo = Math.min(lo, res.y[i]); hi = Math.max(hi, res.y[i]); }
        if (hi > -Infinity) { g.moveTo(L + px + 0.5, mid - hi * A); g.lineTo(L + px + 0.5, mid - lo * A); }
      }
      g.stroke();
      const e = res.det.env; let em = 0; for (let i = i0; i < i1; i++) em = Math.max(em, e[i]);
      g.strokeStyle = '#1E7B34'; g.lineWidth = 1.5; g.beginPath();
      for (let px = 0; px < pw; px++) { const v = mid - (e[Math.min(e.length - 1, i0 + Math.floor(px / pw * span))] / (em || 1)) * (ph / 2) * 0.9; px ? g.lineTo(L + px, v) : g.moveTo(L + px, v); }
      g.stroke(); g.restore();
      res.det.locs.forEach((p, i) => { const x = X(p / FS); if (x < L || x > L + pw) return; g.fillStyle = res.det.lab[i] === 1 ? '#EE2737' : '#1F5FAD'; g.beginPath(); g.moveTo(x - 4, T - 9); g.lineTo(x + 4, T - 9); g.lineTo(x, T - 2); g.fill(); });
      timeAxis(g, L, T, pw, ph, t0, t1, w < 600 ? 'Filtered signal and S1/S2' : 'Filtered signal (FIR 25–500 Hz), segments and detected S1/S2');
    }
    { // cycle scores
      const { g, w, h } = canvas($('#ownScore'));
      const L = 46, R = 10, T = 26, B = 24, pw = w - L - R, ph = h - T - B, X = t => L + ((t - t0) / (t1 - t0)) * pw;
      g.clearRect(0, 0, w, h);
      const all = res.imp.scores;
      const lo = Math.min(-1.5, ...all) - 0.2, hi = Math.max(2, ...all) + 0.2, Y = v => T + ph - (v - lo) / (hi - lo) * ph;
      g.font = '11px Inter, "Segoe UI", sans-serif'; g.textAlign = 'right';
      for (let v = Math.ceil(lo); v <= hi; v++) { g.strokeStyle = '#EEF1F5'; g.beginPath(); g.moveTo(L, Y(v) + 0.5); g.lineTo(L + pw, Y(v) + 0.5); g.stroke(); g.fillStyle = '#6B778A'; g.fillText(v, L - 6, Y(v) + 4); }
      g.setLineDash([6, 4]); g.lineWidth = 1.5;
      [[res.imp.T, '#0C2340']].forEach(([v, c]) => { g.strokeStyle = c; g.beginPath(); g.moveTo(L, Y(v)); g.lineTo(L + pw, Y(v)); g.stroke(); });
      g.setLineDash([]);
      res.cyc.forEach((c, i) => {
        if (c.end < t0 || c.start > t1) return;
        const x0 = X(c.start), x1 = Math.max(x0 + 3, X(c.end));
        g.fillStyle = res.imp.flags[i] ? '#EE2737' : '#1F5FAD'; g.fillRect(x0, Y(res.imp.scores[i]) - 3, x1 - x0, 6);
      });
      timeAxis(g, L, T, pw, ph, t0, t1, w < 600 ? 'Score per cycle (dashed: T = 0)' : 'Murmur score per cycle (dashed: threshold T = 0.00)');
    }
  }
})();
