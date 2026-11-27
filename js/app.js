/* CEN464 Group 8 – walkthrough controller and interactive labs */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const FS = DSP.FS, C = Charts.C;
  const fmt2 = v => (+v).toFixed(2), fmt3 = v => (+v).toFixed(3), pct = v => (100 * v).toFixed(1) + '%';

  /* ------------------------------------------------------------------ data */
  const RECS = window.RECORDINGS.map(r => ({
    ...r, raw: DSP.decodeInt16(r.raw, 1), filt: DSP.decodeInt16(r.filt, r.filtScale), hil: DSP.decodeInt16(r.hil, r.hilScale)
  }));
  const CY = window.CYCLES, MU = CY.mu, SD = CY.sd;
  const OUR = { cols: [0, 1], T: 0.5, frac: 0.5 };
  RECS.forEach(r => ['raw', 'filt'].forEach(k => { const a = Float32Array.from(r[k], Math.abs).sort(); r[k + 'P'] = a[Math.floor(a.length * 0.998)]; }));
  const firstAnn = r => { const c = DSP.completeCycles(r.ann); return c.length ? Math.max(0, r.ann[c[0]][0] - 0.05) : 0; };
  const recLabel = r => `${r.id} · ${r.group === 'normal' ? 'Normal' : `Murmur, ${r.timing.toLowerCase()}, grade ${r.grade}`}`;
  const devById = Object.fromEntries(CY.sets.dev.map(d => [d.rec, d]));

  function fillRecSelect(sel, def) {
    sel.innerHTML = RECS.map((r, i) => `<option value="${i}">${recLabel(r)}</option>`).join('');
    sel.value = def || 0;
  }
  function seg(id, cb) {
    const s = $('#' + id);
    s.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      $$('button', s).forEach(x => x.classList.toggle('on', x === b)); cb(b.dataset.v);
    });
    return () => $('button.on', s).dataset.v;
  }
  function setSeg(id, v) { $$('#' + id + ' button').forEach(b => b.classList.toggle('on', b.dataset.v === String(v))); }

  // complete cycles with their segment times (same rule as segMask / cycleFeatures)
  function cyclesOf(rec) {
    return DSP.completeCycles(rec.ann).map(i => ({ s1: rec.ann[i], sys: rec.ann[i + 1], s2: rec.ann[i + 2], dia: rec.ann[i + 3] }))
      .filter(c => Math.floor(c.sys[1] * FS) - Math.floor(c.sys[0] * FS) >= 20 && Math.floor(c.dia[1] * FS) - Math.floor(c.dia[0] * FS) >= 20);
  }

  /* -------------------------------------------------------- waveform canvas */
  const ANN_COL = { 1: 'rgba(31,95,173,.16)', 2: 'rgba(238,39,55,.13)', 3: 'rgba(22,160,133,.16)', 4: 'rgba(224,161,0,.18)' };
  function prepCanvas(cv) {
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }
  function drawWave(cv, rec, o) {
    const { ctx, w, h } = prepCanvas(cv), padB = 22, ph = h - padB;
    const t0 = o.t0 || 0, t1 = t0 + o.dur, X = t => ((t - t0) / o.dur) * w;
    if (o.shade !== false) rec.ann.forEach(a => {
      if (a[1] < t0 || a[0] > t1 || !ANN_COL[a[2]]) return;
      ctx.fillStyle = ANN_COL[a[2]]; ctx.fillRect(X(a[0]), 0, X(a[1]) - X(a[0]), ph);
    });
    (o.flagged || []).forEach(f => {
      if (f[1] < t0 || f[0] > t1) return;
      ctx.fillStyle = 'rgba(238,39,55,.28)'; ctx.fillRect(X(f[0]), 0, X(f[1]) - X(f[0]), 6);
    });
    const traces = o.traces || [];
    traces.forEach(tr => {
      const x = tr.data, i0 = Math.max(0, Math.floor(t0 * FS)), i1 = Math.min(x.length, Math.ceil(t1 * FS));
      let peak = tr.scale || 0; if (!peak) for (let i = i0; i < i1; i++) peak = Math.max(peak, Math.abs(x[i]));
      peak = peak || 1;
      const mid = tr.baseline != null ? tr.baseline * ph : ph / 2, amp = tr.amp != null ? tr.amp * ph : ph / 2 - 6;
      ctx.strokeStyle = tr.color; ctx.lineWidth = tr.width || 1; ctx.globalAlpha = tr.alpha || 1; ctx.beginPath();
      const spp = (i1 - i0) / w;
      if (spp > 2) {
        for (let px = 0; px < w; px++) {
          const a = i0 + Math.floor(px * spp), b = Math.min(i1, i0 + Math.floor((px + 1) * spp));
          let mn = Infinity, mx = -Infinity; for (let i = a; i < b; i++) { if (x[i] < mn) mn = x[i]; if (x[i] > mx) mx = x[i]; }
          const cl = v => Math.max(-1.08, Math.min(1.08, v));
          if (tr.positive) { ctx.lineTo(px, mid - cl(mx / peak) * amp); }
          else { ctx.moveTo(px + .5, mid - cl(mx / peak) * amp); ctx.lineTo(px + .5, mid - cl(mn / peak) * amp + 0.5); }
        }
      } else {
        for (let i = i0; i < i1; i++) { const px = X(i / FS), py = mid - Math.max(-1.08, Math.min(1.08, x[i] / peak)) * amp; i === i0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
      }
      ctx.stroke(); ctx.globalAlpha = 1;
    });
    if (o.hline) { ctx.strokeStyle = '#9AA5B5'; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(0, o.hline); ctx.lineTo(w, o.hline); ctx.stroke(); ctx.setLineDash([]); }
    (o.marks || []).forEach(m => {
      if (m.t < t0 || m.t > t1) return;
      const x = X(m.t);
      ctx.fillStyle = m.color; ctx.font = 'bold 14px system-ui';
      if (m.cross) { ctx.fillText('✕', x - 5, m.y + 5); }
      else { ctx.beginPath(); ctx.moveTo(x - 6, m.y - 8); ctx.lineTo(x + 6, m.y - 8); ctx.lineTo(x, m.y + 2); ctx.closePath(); ctx.fill(); }
    });
    // axis
    ctx.fillStyle = '#6B778A'; ctx.font = '11px system-ui'; ctx.strokeStyle = '#C9D1DD'; ctx.beginPath(); ctx.moveTo(0, ph + .5); ctx.lineTo(w, ph + .5); ctx.stroke();
    const step = o.dur > 6 ? 1 : o.dur > 2.5 ? 0.5 : 0.25;
    for (let t = Math.ceil(t0 / step) * step; t <= t1 + 1e-9; t += step) { const x = X(t); ctx.fillText(t.toFixed(step < 1 ? 2 : 0).replace(/\.?0+$/, '') + ' s', Math.min(w - 26, x + 2), h - 6); ctx.fillRect(x, ph, 1, 4); }
    if (o.playhead != null) { ctx.fillStyle = '#EE2737'; ctx.fillRect(X(o.playhead) - 1, 0, 2, ph); }
  }

  /* -------------------------------------------------------- navigation */
  const steps = $$('.step');
  const sidebar = $('#sidebar');
  let cur = -1; const inited = {}, redraw = {}, visited = new Set();
  (function buildSidebar() {
    let html = '', grp = null;
    steps.forEach((s, i) => {
      if (s.dataset.group !== grp) { if (grp !== null) html += '</div>'; grp = s.dataset.group; html += `<div class="side-group"><h4>${grp}</h4>`; }
      html += `<button class="side-item" data-i="${i}"><span class="num">${i + 1}</span><span>${s.dataset.title}</span></button>`;
    });
    sidebar.innerHTML = html + '</div>';
    sidebar.addEventListener('click', e => { const b = e.target.closest('.side-item'); if (b) { go(+b.dataset.i); document.body.classList.remove('menu-open'); } });
  })();
  function go(i, noHash) {
    i = Math.max(0, Math.min(steps.length - 1, i));
    if (i === cur) return;
    DSP.stop(); const pp = document.getElementById('pop'); if (pp) pp.style.display = 'none';
    if (cur >= 0) { steps[cur].classList.remove('active'); visited.add(cur); }
    cur = i; const s = steps[i]; s.classList.add('active');
    $$('.side-item').forEach((b, j) => { b.classList.toggle('active', j === i); b.classList.toggle('done', visited.has(j) && j !== i); });
    $('#stepCount').textContent = `Step ${i + 1} of ${steps.length}`;
    $('#progressBar').style.width = ((i + 1) / steps.length) * 100 + '%';
    $('#prevBtn').disabled = i === 0;
    const last = i === steps.length - 1;
    $('#nextBtn').textContent = last ? 'Finish ✓' : 'Next →';
    $('#nextTitle').innerHTML = last ? '' : `Up next<b>${steps[i + 1].dataset.title}</b>`;
    if (!noHash) history.replaceState(null, '', '#' + s.dataset.id);
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    const id = s.dataset.id;
    requestAnimationFrame(() => {
      if (!inited[id] && INIT[id]) { inited[id] = true; INIT[id](); }
      else if (redraw[id]) redraw[id]();
    });
    const a = $('.side-item.active'); if (a) a.scrollIntoView({ block: 'nearest' });
  }
  const idx = id => steps.findIndex(s => s.dataset.id === id);
  $('#prevBtn').onclick = () => go(cur - 1);
  $('#nextBtn').onclick = () => (cur === steps.length - 1 ? go(0) : go(cur + 1));
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-goto]'); if (!g) return;
    const t = g.dataset.goto; go(t === 'next' ? cur + 1 : idx(t));
  });
  document.addEventListener('keydown', e => {
    if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (e.key === 'ArrowRight') go(cur + 1); else if (e.key === 'ArrowLeft') go(cur - 1);
    else if (e.key === 'Escape') { $('#lightbox').classList.remove('on'); $('#pop').style.display = 'none'; closeGloss(); }
  });
  $('#menuBtn').onclick = () => document.body.classList.toggle('menu-open');
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { const id = steps[cur].dataset.id; redraw[id] && redraw[id](); }, 150); });

  // lightbox
  document.addEventListener('click', e => {
    const img = e.target.closest('figure.fig img');
    if (img) { const lb = $('#lightbox'); $('img', lb).src = img.src; lb.classList.add('on'); }
  });
  $('#lightbox').onclick = () => $('#lightbox').classList.remove('on');

  /* -------------------------------------------------------- glossary */
  const GLOSS = {
    'PCG': 'Phonocardiogram: a digital recording of heart sounds made with an electronic stethoscope.',
    'DSP': 'Digital Signal Processing: filtering, transforming and measuring sampled signals with algorithms.',
    'Murmur': 'An extra sound made by turbulent blood flow. In CirCor most murmurs occur in systole. Graded I/VI (faint) to VI/VI (very loud).',
    'S1': 'First heart sound, made when the mitral and tricuspid valves close. Marks the start of systole.',
    'S2': 'Second heart sound, made when the aortic and pulmonary valves close. Marks the start of diastole.',
    'Systole': 'The interval from the end of S1 to the start of S2, when the heart contracts. Normally quiet, and where systolic murmurs live.',
    'Diastole': 'The interval from the end of S2 to the next S1, when the heart refills. Usually the longest and quietest part, so a good per-cycle "noise reference".',
    'FIR': 'Finite Impulse Response filter. With a symmetric design it has linear phase: every frequency is delayed by the same amount, so the delay can be removed exactly.',
    'IIR': 'Infinite Impulse Response filter (here Butterworth). Very efficient, but its phase is not linear, so different frequencies are delayed by different amounts.',
    'PSD': 'Power Spectral Density: how a signal\'s power is spread over frequency. Welch\'s method averages the spectra of overlapping windowed pieces.',
    'Envelope': 'A smooth curve that follows the loudness of the signal. Hilbert envelope = magnitude of the analytic signal; Shannon envelope = −x²·log(x²), which favours medium-loud sounds.',
    "Cohen's d": 'Effect size: difference of the two group means divided by their pooled standard deviation. d ≈ 0.5 is medium, ≥ 0.8 is large.',
    'STFT': 'Short-Time Fourier Transform: a spectrum computed in a sliding window. Shown as a spectrogram (time × frequency × energy). Window type, length and overlap set the trade-offs.',
    'z-score': 'How many standard deviations a value is from the normal reference mean: (x − μ_normal) / σ_normal.',
    'AUC': 'Area under the ROC curve. Here: the probability that a random murmur cycle scores higher than a random normal cycle. 0.5 = chance, 1 = perfect.',
    'Balanced accuracy': 'Mean of sensitivity and specificity. Fair when classes are balanced or when both kinds of error matter equally.',
    'Auscultation location': 'Where the stethoscope is placed: AV (aortic), PV (pulmonary), TV (tricuspid), MV (mitral).',
    'Sensitivity': 'Share of murmur cases the detector catches (TP / (TP + FN)). Also called recall.',
    'Specificity': 'Share of normal cases correctly left unflagged (TN / (TN + FP)).',
    'Precision': 'When the detector says "murmur", how often it is right (TP / (TP + FP)). Called PPV for the S1/S2 detector.',
    'F1': 'Harmonic mean of precision and sensitivity.'
  };
  const pop = $('#pop');
  document.addEventListener('click', e => {
    const t = e.target.closest('.term');
    if (!t) { if (!e.target.closest('#pop')) pop.style.display = 'none'; return; }
    const k = t.dataset.term; pop.innerHTML = `<b>${k}</b>${GLOSS[k] || ''}`; pop.style.display = 'block';
    const r = t.getBoundingClientRect(), pr = pop.getBoundingClientRect();
    pop.style.left = Math.min(innerWidth - pr.width - 10, Math.max(10, r.left)) + 'px';
    pop.style.top = (r.bottom + 8 + pr.height > innerHeight ? r.top - pr.height - 8 : r.bottom + 8) + 'px';
  });
  const gl = document.createElement('div'); gl.className = 'lightbox'; gl.style.cursor = 'default';
  gl.innerHTML = `<div class="card" style="max-width:720px;max-height:80vh;overflow:auto;cursor:auto"><div class="flex" style="justify-content:space-between"><h3 class="mt0" style="margin:0">Glossary</h3><button class="btn btn-ghost" id="glClose" style="padding:6px 12px">Close</button></div>${Object.entries(GLOSS).map(([k, v]) => `<p class="mt16"><b style="color:var(--navy)">${k}</b><br><span class="small">${v}</span></p>`).join('')}</div>`;
  document.body.appendChild(gl);
  function closeGloss() { gl.classList.remove('on'); }
  $('#glossBtn').onclick = () => gl.classList.add('on');
  gl.addEventListener('click', e => { if (e.target === gl || e.target.id === 'glClose') closeGloss(); });

  /* ================================================================ STEPS */
  const INIT = {};

  // ---- hero wave
  (function hero() {
    const r = RECS[1], x = r.filt, i0 = Math.floor(2.0 * FS), n = Math.floor(6 * FS);
    let d = '', d2 = '', peak = 0; for (let i = i0; i < i0 + n; i++) peak = Math.max(peak, Math.abs(x[i]));
    for (let k = 0; k < 600; k++) {/*hero*/
      const a = i0 + Math.floor((k / 600) * n), b = i0 + Math.floor(((k + 1) / 600) * n);
      let mx = -1, mn = 1; for (let i = a; i < b; i++) { mx = Math.max(mx, x[i]); mn = Math.min(mn, x[i]); }
      d += `${k ? 'L' : 'M'}${k},${130 - (mx / peak) * 110}L${k},${130 - (mn / peak) * 110}`;
      d2 += `${k ? 'L' : 'M'}${k},${130 - ((mx + mn) / 2 / peak) * 40}`;
    }
    $('#heroWave').setAttribute('d', d); $('#heroWave2').setAttribute('d', d2);
  })();

  // ---- dataset
  INIT['dataset'] = () => {
    const devIds = new Set(CY.sets.dev.map(d => d.rec));
    const count = (arr, f) => arr.reduce((m, d) => ((m[f(d)] = (m[f(d)] || 0) + 1), m), {});
    const other = CY.sets.loc.filter(d => !devIds.has(d.rec));
    const info = {
      dev: { title: 'Development set: 60 recordings, 60 patients', text: '30 systolic-murmur patients, each recorded at the location where the murmur is most audible, plus 30 normal patients with the same location mix. Random selection with seed 42 (<code>select_patients.py</code>). Used for Phases 1–3 and to choose every Phase 4 parameter.', data: CY.sets.dev, key: 'cls' },
      test: { title: 'Test set: 100 recordings, 100 new patients', text: '50 new murmur and 50 new normal patients with no overlap with development. Seed 2026 (<code>select_extra.py</code>). Kept sealed and used exactly once, after every parameter was frozen.', data: CY.sets.test, key: 'cls' },
      loc: { title: 'Other locations: 153 recordings of the 60 development patients', text: 'The remaining auscultation locations of the development patients, each with a MurmurHere flag: 55 murmur audible, 17 murmur not audible, 81 normal. Used to study how location affects features and detection.', data: other, key: 'cls' }
    };
    function show(k) {
      const it = info[k], locs = ['AV', 'PV', 'TV', 'MV'];
      const cls = [...new Set(it.data.map(d => d.cls))].sort((a, b) => ['murmur', 'notaudible', 'normal'].indexOf(a) - ['murmur', 'notaudible', 'normal'].indexOf(b));
      const names = { murmur: 'Murmur (audible)', normal: 'Normal', notaudible: 'Murmur not audible here' }, cols = { murmur: C.murmur, normal: C.normal, notaudible: '#9AA5B5' };
      $('#setDetail').innerHTML = `<b style="color:var(--navy);font-size:17px">${it.title}</b><p class="mt8">${it.text}</p><div id="setChart"></div><div class="legend">${cls.map(c => `<span><i style="background:${cols[c]}"></i>${names[c]}: ${it.data.filter(d => d.cls === c).length}</span>`).join('')}</div>`;
      Charts.bars($('#setChart'), {
        categories: locs, height: 210, yLabel: 'Recordings',
        series: cls.map(c => ({ name: names[c], color: cols[c], values: locs.map(l => it.data.filter(d => d.cls === c && d.loc === l).length) })), labels: true
      });
    }
    $('#setCards').addEventListener('click', e => { const b = e.target.closest('.setcard'); if (!b) return; $$('.setcard').forEach(x => x.classList.toggle('on', x === b)); show(b.dataset.set); });
    show('dev');
  };

  // ---- P1 signal explorer
  INIT['p1-signal'] = () => {
    const sel = $('#exRec'); fillRecSelect(sel, 1);
    let sig = 'raw', playing = null;
    const getSig = seg('exSig', v => { sig = v; draw(); });
    function draw(ph) {
      const r = RECS[sel.value], t0 = +$('#exStart').value;
      drawWave($('#exCanvas'), r, { t0, dur: 3, traces: [{ data: sig === 'raw' ? r.raw : r.filt, scale: sig === 'raw' ? r.rawP : r.filtP, color: '#0B1424', width: 1 }], playhead: ph });
    }
    function info() {
      const r = RECS[sel.value], dec = DSP.decide(IMP.G[r.id].map(q => [q[0], q[1], -q[2]]), [0, 1, 2], IMU, ISD, IMP.T, IMP.frac);
      const ok = dec.isMurmur === (r.group === 'murmur');
      $('#exStart').max = Math.max(0, r.n / FS - 3);
      $('#exInfo').innerHTML = `<b>About this recording</b>${r.group === 'normal' ? 'Normal patient' : `Murmur patient: <b>${r.timing}</b>, grade <b>${r.grade}</b>, ${r.pitch.toLowerCase()} pitch`} · ${r.age} · location ${r.loc}. ` +
        `${r.group === 'normal' ? 'Notice the quiet systole between S1 and S2.' : r.timing === 'Holosystolic' ? 'Notice how the whole systole (pink) is filled with noise-like sound.' : r.timing === 'Early-systolic' ? 'The murmur is short and faint, just after S1: hard to see, and hard for a detector.' : 'The murmur sits in the middle of systole.'}` +
        `<br><span class="small">Our final detector on the full recording: <b>${dec.flags.filter(Boolean).length} of ${dec.flags.length}</b> cycles flagged → <b>${dec.isMurmur ? 'murmur' : 'normal'}</b> <span class="pill ${ok ? 'ok' : 'red'}">${ok ? 'correct' : 'missed'}</span></span>`;
    }
    const resetStart = () => { const t = firstAnn(RECS[sel.value]); $('#exStart').value = t; $('#exStartV').textContent = t.toFixed(1) + ' s'; };
    sel.onchange = () => { info(); resetStart(); draw(); };
    $('#exStart').oninput = e => { $('#exStartV').textContent = (+e.target.value).toFixed(1) + ' s'; draw(); };
    $('#exPlay').onclick = () => {
      if (playing) { DSP.stop(); cancelAnimationFrame(playing); playing = null; $('#exPlay').textContent = '▶ Play 3 s'; draw(); return; }
      const r = RECS[sel.value], t0 = +$('#exStart').value, x = (sig === 'raw' ? r.raw : r.filt).subarray(Math.floor(t0 * FS), Math.floor((t0 + 3) * FS));
      const start = DSP.play(x, () => { cancelAnimationFrame(playing); playing = null; $('#exPlay').textContent = '▶ Play 3 s'; draw(); });
      $('#exPlay').textContent = '■ Stop';
      const tick = () => { draw(t0 + (DSP.audioTime() - start)); playing = requestAnimationFrame(tick); }; tick();
    };
    info(); resetStart(); draw();
    Charts.bars($('#durChart'), {
      categories: ['S1', 'Systole', 'S2', 'Diastole'], yLabel: 'Duration (ms)', height: 260, labels: true, fmt: v => Math.round(v),
      series: [{ name: 'Normal', color: C.normal, values: [118, 146, 105, 239] }, { name: 'Murmur', color: C.murmur, values: [109, 138, 93, 219] }],
      tipExtra: (ci, si) => `<br><span class="mut">± ${[[20, 26, 20, 87], [23, 30, 18, 86]][si][ci]} ms SD</span>`
    });
    redraw['p1-signal'] = draw;
  };

  // ---- P1 pipeline
  INIT['p1-pipeline'] = () => {
    const B = [
      { t: 'Normalise', s: 'DC removed, unit peak', q: 'How to make recordings comparable?', a: 'Remove the mean, divide by the peak (<code>loadPCG</code>). Every recording then lives on the same −1…1 scale.', go: 'p1-signal' },
      { t: 'Bandpass filter', s: 'FIR 25–500 Hz', q: 'FIR or IIR? Which cutoffs and order?', a: 'FIR, Hamming window, order 400, 25–500 Hz, zero delay (shifted by 200 samples). Chosen by the PSD, the FIR/IIR comparison and the cutoff/order sweep.', go: 'p2-filters' },
      { t: 'Segment cycles', s: 'S1–sys–S2–dia', q: 'How to cut the signal into heartbeats?', a: 'Use the annotations, keeping only complete S1 → systole → S2 → diastole cycles (<code>segMask</code>).', go: 'dataset' },
      { t: 'S1/S2 detector', s: 'check without labels', q: 'Can we segment without annotations?', a: 'Hilbert envelope, 50 ms smoothing, threshold 0.2, 150 ms minimum peak spacing, labels by interval length, scored at ±60 ms. F1 0.724 (dev) / 0.752 (test).', go: 'p2-s1s2' },
      { t: 'Cycle features', s: 'Systole − diastole', q: 'Which measures separate murmur from normal?', a: 'Systole minus diastole of the same cycle. First studied: ΔRMS (dB), ΔZCR (1/s), ΔBER (dB). Final detector: early-third ΔRMS, loudest-third ΔRMS and envelope steadiness.', go: 'p3-features' },
      { t: 'STFT', s: 'Blackman 256, 75%', q: 'Which window type, length and overlap?', a: 'Blackman, 256 samples (64 ms, 15.6 Hz), 75% overlap. Used for visualisation and in the GUI.', go: 'p3-stft' },
      { t: 'Murmur decision', s: 'score > T, vote ≥ frac', q: 'How to turn features into a decision?', a: 'Early-third ΔRMS, loudest-third ΔRMS and steady-envelope z-scores against normal development cycles, averaged. A cycle is flagged if its score > T = 0.00; the recording is murmur if at least 65% of its cycles are flagged. Flagged systoles are the detected murmur regions.', go: 'p4-final' }
    ];
    const host = $('#pipe');
    host.innerHTML = B.map((b, i) => `${i ? '<span class="pipe-arrow">→</span>' : ''}<button class="pipe-block" data-i="${i}"><div class="pi">BLOCK ${i + 1}</div><b>${b.t}</b><span>${b.s}</span></button>`).join('');
    function show(i) {
      $$('.pipe-block').forEach((x, j) => x.classList.toggle('on', j === i));
      const b = B[i];
      $('#pipeDetail').innerHTML = `<div class="eyebrow">Block ${i + 1} · ${b.t}</div><p class="mt8"><b>Open question in Phase 1:</b> ${b.q}</p><p><b>Final answer:</b> ${b.a}</p><button class="btn btn-ghost" data-goto="${b.go}" style="padding:8px 14px">See the evidence →</button>`;
    }
    host.addEventListener('click', e => { const b = e.target.closest('.pipe-block'); if (b) show(+b.dataset.i); });
    show(0);
  };

  // ---- P2 PSD
  INIT['p2-psd'] = () => {
    const sel = $('#psdRec'); fillRecSelect(sel, 1); let sig = 'raw';
    seg('psdSig', v => { sig = v; draw(); });
    function gather(r, x, labs) {
      const parts = [];
      for (const i of DSP.completeCycles(r.ann)) for (let j = i; j < i + 4; j++) if (labs.includes(r.ann[j][2])) {
        const a = Math.floor(r.ann[j][0] * FS), b = Math.min(x.length, Math.floor(r.ann[j][1] * FS)); parts.push(x.subarray(a, b));
      }
      const n = parts.reduce((s, p) => s + p.length, 0), out = new Float32Array(n); let o = 0; parts.forEach(p => { out.set(p, o); o += p.length; }); return out;
    }
    function draw() {
      const r = RECS[sel.value], x = sig === 'raw' ? r.raw : r.filt;
      const P = [[1, 3], [2], [4]].map(l => DSP.welch(gather(r, x, l), 256));
      const ref = Math.max(...P.flatMap(p => p.map(q => q[1])));
      const keep = P[0].map((q, k) => k).filter(k => P[0][k][0] <= 1000);
      Charts.lines($('#psdChart'), {
        x: keep.map(k => P[0][k][0]), xLabel: 'Frequency (Hz)', yLabel: 'Power (dB, rel. max)', yMin: -70, yMax: 5, height: 300,
        bands: [{ x0: 25, x1: 500 }], xTipFmt: v => v.toFixed(1) + ' Hz', fmt: v => (+v).toFixed(1),
        series: [{ name: 'S1 + S2', color: C.normal }, { name: 'Systole', color: C.murmur }, { name: 'Diastole', color: C.third }]
          .map((s, i) => ({ ...s, values: keep.map(k => 10 * Math.log10(P[i][k][1] / ref + 1e-12)) }))
      });
    }
    sel.onchange = draw; draw(); redraw['p2-psd'] = draw;
  };

  // ---- P2 filters
  INIT['p2-filters'] = () => {
    const M = [
      { cats: ['Raw', 'FIR', 'IIR'], vals: [1.5, 0.1, 0.1], y: 'Energy below 20 Hz (%)', f: v => v + '%', note: 'Both filters remove almost all low-frequency drift and movement noise (1.5% → 0.1%). A tie.' },
      { cats: ['Raw', 'FIR', 'IIR'], vals: [4.6, 5.7, 5.7], y: 'Murmur–normal systolic gap (dB)', f: v => v + ' dB', note: 'Both filters make murmurs stand out by about 1 dB more than in the raw signal. Another tie.' },
      { cats: ['FIR', 'IIR'], vals: [0, 3.3], y: 'Energy left above 500 Hz (%)', f: v => v + '%', note: 'The FIR has more than 50 dB stopband attenuation, so nothing is left above 500 Hz. The IIR leaves 3.3%.' },
      { cats: ['25 Hz', '200 Hz'], series: [{ name: 'FIR (after shift)', color: C.normal, values: [0, 0] }, { name: 'IIR', color: C.murmur, values: [26, 1] }], y: 'Delay (ms)', f: v => v + ' ms', note: 'The deciding measure. The FIR delays every frequency by exactly 200 samples, which we cancel. The IIR delays 25 Hz by 26 ms but 200 Hz by only 1 ms, distorting the shape and timing of S1/S2.' }
    ];
    const draw = i => {
      const m = M[i];
      Charts.bars($('#filtChart'), { categories: m.cats, yLabel: m.y, fmt: m.f, height: 250, labels: true, yMin: 0,
        series: m.series || [{ name: m.y, color: '#24467A', values: m.vals }] });
      $('#filtNote').textContent = m.note;
      if (m.series) $('#filtChart').insertAdjacentHTML('beforeend', `<div class="legend">${m.series.map(s => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join('')}</div>`);
    };
    let mi = 0; seg('fMetric', v => { mi = +v; draw(mi); }); draw(0);

    // filter lab
    const sel = $('#flRec'); fillRecSelect(sel, 1);
    let h, y;
    function compute() {
      const lo = +$('#flLo').value, hi = +$('#flHi').value, N = +$('#flN').value;
      $('#flLoV').textContent = lo + ' Hz'; $('#flHiV').textContent = hi + ' Hz'; $('#flNV').textContent = N;
      h = DSP.firDesign(N, lo, hi); const r = RECS[sel.value];
      y = DSP.firApply(h, r.raw.subarray(0, 8 * FS));
      const R = DSP.freqResp(h, 241).filter(p => p[0] <= 1200);
      Charts.lines($('#flResp'), { x: R.map(p => p[0]), xLabel: 'Frequency (Hz)', yLabel: 'Gain (dB)', yMin: -80, yMax: 5, height: 230, bands: [{ x0: lo, x1: hi }],
        series: [{ name: 'Gain', color: C.murmur, values: R.map(p => Math.max(-80, p[1])) }], fmt: v => (+v).toFixed(1), xTipFmt: v => v.toFixed(0) + ' Hz' });
      const e20 = x => { const P = DSP.welch(x, 512); const tot = P.reduce((s, p) => s + p[1], 0); return P.filter(p => p[0] < 20).reduce((s, p) => s + p[1], 0) / tot; };
      $('#flStat').innerHTML = `Energy below 20 Hz: raw <b>${pct(e20(r.raw.subarray(0, 8 * FS)))}</b> → filtered <b>${pct(e20(y))}</b>`;
      drawW();
    }
    function drawW() {
      const r = RECS[sel.value];
      drawWave($('#flWave'), r, { t0: 0, dur: 2, traces: [{ data: r.raw, color: '#9AA5B5', width: 1, baseline: .3, amp: .27 }, { data: y, color: '#0C2340', width: 1, baseline: .74, amp: .24 }] });
      const { ctx } = { ctx: $('#flWave').getContext('2d') };
      ctx.fillStyle = '#6B778A'; ctx.font = 'bold 11px system-ui'; ctx.fillText('RAW', 6, 14); ctx.fillText('FILTERED', 6, $('#flWave').clientHeight * 0.5);
    }
    ['flLo', 'flHi', 'flN'].forEach(id => $('#' + id).addEventListener('input', () => { clearTimeout(compute.t); compute.t = setTimeout(compute, 60); }));
    sel.onchange = compute;
    $('#flReset').onclick = () => { $('#flLo').value = 25; $('#flHi').value = 500; $('#flN').value = 400; compute(); };
    $('#flPlayRaw').onclick = () => DSP.play(RECS[sel.value].raw.subarray(0, 4 * FS));
    $('#flPlayF').onclick = () => DSP.play(y.subarray(0, 4 * FS));
    compute();
    redraw['p2-filters'] = () => { draw(mi); compute(); };
  };

  // ---- P2 sweep heatmaps
  INIT['p2-sweep'] = () => {
    const rows = ['15', '20', '25', '40'], cols = ['400', '500', '600', '800'];
    const gain = [[1.25, 0.95, 0.77, 0.53], [1.28, 0.98, 0.79, 0.55], [1.28, 0.97, 0.78, 0.53], [1.01, 0.68, 0.47, 0.21]];
    const gap = [[5.30, 5.44, 5.43, 5.03], [5.44, 5.57, 5.55, 5.13], [5.58, 5.71, 5.68, 5.24], [6.00, 6.11, 6.06, 5.55]];
    const tx = (ri, ci) => `<br><span class="mut">Other measure: ${gain[ri][ci].toFixed(2)} dB gain · ${gap[ri][ci].toFixed(2)} dB gap</span>`;
    Charts.heat($('#heatGain'), { rows, cols, values: gain, title: 'S1+S2 / diastole gain, normal (dB)', rowTitle: 'Lower cutoff (Hz)', colTitle: 'Upper cutoff (Hz)', highlight: [2, 1], tipExtra: tx });
    Charts.heat($('#heatGap'), { rows, cols, values: gap, title: 'Murmur–normal systolic gap (dB)', rowTitle: 'Lower cutoff (Hz)', colTitle: 'Upper cutoff (Hz)', highlight: [2, 1], tipExtra: tx });
  };

  // ---- P2 S1/S2 lab
  INIT['p2-s1s2'] = () => {
    const sel = $('#sdRec'); fillRecSelect(sel, 0);
    const st = { m: 'Hilbert', s: 50, t: 0.2 }; let res;
    seg('sdM', v => { st.m = v; run(); }); seg('sdS', v => { st.s = +v; run(); }); seg('sdT', v => { st.t = +v; run(); });
    function run() {
      const r = RECS[sel.value];
      const d = DSP.detectS1S2(r, st.m, st.s, st.t);
      const sc = DSP.scoreS1S2(d.det, r.ann, r.n);
      res = { d, sc };
      const sens = sc.tp / sc.nref, ppv = sc.tp / (sc.ndet || 1), f1 = (2 * sc.tp) / (sc.nref + sc.ndet || 1);
      const mae = sc.err.length ? sc.err.reduce((s, e) => s + Math.abs(e), 0) / sc.err.length : 0;
      $('#sdRecM').innerHTML = [['Sensitivity', pct(sens)], ['PPV', pct(ppv)], ['F1', pct(f1)], ['Annotated S1+S2', sc.nref], ['Detections', sc.ndet], ['Timing error', mae.toFixed(1) + ' ms']]
        .map(([k, v]) => `<div class="metric"><div class="v">${v}</div><div class="k">${k}</div></div>`).join('');
      const g = S1S2GRID.find(q => q.m === st.m && q.sm === st.s && Math.abs(q.th - st.t) < 1e-6);
      const best = st.m === 'Hilbert' && st.s === 50 && st.t === 0.2;
      $('#sdDevM').innerHTML = [['Sensitivity', g.sens + '%'], ['PPV', g.ppv + '%'], ['F1', g.f1 + '%']]
        .map(([k, v]) => `<div class="metric" style="${best ? 'background:#FDECEE' : ''}"><div class="v">${v}</div><div class="k">${k}${best && k === 'F1' ? ' · best' : ''}</div></div>`).join('') +
        `<div class="metric" style="grid-column:span 3"><div class="k">Mean absolute timing error ${g.mae} ms · ${best ? '<b style="color:var(--red)">this is the setting we chose</b>' : `our choice: F1 72.4% (${(g.f1 - 72.4 >= 0 ? '+' : '') + (g.f1 - 72.4).toFixed(1)} pts)`}</div></div>`;
      draw();
      drawGrid();
    }
    function draw() {
      const r = RECS[sel.value], t0 = +$('#sdStart').value, cv = $('#sdCanvas'), H = cv.clientHeight - 22;
      $('#sdStart').max = Math.max(0, r.n / FS - 4);
      const env = res.d.env, base = 0.92, amp = 0.62;
      const marks = []; let si = 0;
      res.d.det.forEach(d => {
        const stt = res.sc.status[si++];
        const y = base * H - (Math.min(env[d.i], 1.4) / 1) * amp * H - 10;
        if (stt === 'out') marks.push({ t: d.i / FS, y, color: '#B8C1CE' });
        else if (stt === 'tp') marks.push({ t: d.i / FS, y, color: d.lab === 1 ? '#1F5FAD' : '#16A085' });
        else marks.push({ t: d.i / FS, y, color: '#EE2737', cross: true });
      });
      drawWave(cv, r, {
        t0, dur: 4, traces: [
          { data: r.filt, scale: r.filtP, color: '#9AA5B5', width: 1, baseline: 0.92, amp: 0.14, alpha: .9 },
          { data: env, color: '#0C2340', width: 2, baseline: base, amp: amp, scale: 1, positive: true }
        ], hline: base * H - st.t * amp * H, marks
      });
    }
    function drawGrid() {
      ['Hilbert', 'Shannon'].forEach(m => {
        const rows = [20, 50, 100], cols = [0.1, 0.2, 0.3, 0.4];
        const vals = rows.map(s => cols.map(t => S1S2GRID.find(q => q.m === m && q.sm === s && Math.abs(q.th - t) < 1e-6).f1));
        Charts.heat($(m === 'Hilbert' ? '#gridH' : '#gridS'), {
          rows: rows.map(s => s + ' ms'), cols: cols.map(String), values: vals, fmt: v => v.toFixed(1), title: `${m} envelope · F1 (%)`, rowTitle: 'Smoothing', colTitle: 'Threshold',
          highlight: st.m === m ? [rows.indexOf(st.s), cols.indexOf(st.t)] : null,
          tipExtra: (ri, ci) => { const q = S1S2GRID.find(q => q.m === m && q.sm === rows[ri] && Math.abs(q.th - cols[ci]) < 1e-6); return `<br>Sens ${q.sens}% · PPV ${q.ppv}% · error ${q.mae} ms<br><span class="mut">click to try it above</span>`; },
          onClick: (ri, ci) => { st.m = m; st.s = rows[ri]; st.t = cols[ci]; setSeg('sdM', m); setSeg('sdS', st.s); setSeg('sdT', st.t); run(); }
        });
      });
    }
    const rs = () => { const t = firstAnn(RECS[sel.value]); $('#sdStart').value = t; $('#sdStartV').textContent = t.toFixed(1) + ' s'; };
    sel.onchange = () => { rs(); run(); };
    rs();
    $('#sdStart').oninput = e => { $('#sdStartV').textContent = (+e.target.value).toFixed(1) + ' s'; draw(); };
    run(); redraw['p2-s1s2'] = run;
  };

  // ---- P3 features
  INIT['p3-features'] = () => {
    const cats = ['ΔRMS', 'ΔEnvelope', 'ΔZCR', 'ΔCentroid', 'ΔBER', 'Entropy'];
    const d = [1.33, 1.34, 1.32, 0.74, 0.73, 0.48];
    const status = ['Kept', 'Dropped: r = 0.98 with ΔRMS', 'Kept', 'Dropped: r = 0.91 with ΔBER', 'Kept', 'Not significant (p = 0.067)'];
    const pass = ['p < 0.001, passes Bonferroni', 'p < 0.001, passes Bonferroni', 'p < 0.001, passes Bonferroni', 'does not pass Bonferroni', 'p = 0.006, does not pass Bonferroni', 'p = 0.067'];
    const kept = [true, false, true, false, true, false];
    function chart() {
      Charts.bars($('#featChart'), {
        categories: cats, yLabel: "Cohen's d (normal vs murmur)", yMin: 0, yMax: 1.6, height: 290, labels: true, fmt: v => (+v).toFixed(2),
        series: [{ name: 'Effect size d', color: C.murmur, values: d, dim: kept.map(k => !k) }],
        refLines: [{ y: 0.8, label: 'large effect (0.8)' }],
        tipExtra: ci => `<br>${pass[ci]}<br><b>${status[ci]}</b>`
      });
    }
    $('#featSel').innerHTML = `<div class="grid g3 mt8">
      <div class="card"><div class="eyebrow">Step 1 · Measure</div><p class="small mt8">Time features (RMS, envelope, ZCR, duration) and spectral features from the Welch PSD (centroid, bandwidth, entropy, band-energy ratio, dominant frequency), all in systole and in diastole.</p></div>
      <div class="card"><div class="eyebrow">Step 2 · Test</div><p class="small mt8">Welch t-test and Cohen's d for normal vs murmur, Bonferroni-corrected over 27 tests. Diastole: nothing differs. Δ form: ΔRMS, Δenvelope and ΔZCR pass with d ≈ 1.3.</p></div>
      <div class="card"><div class="eyebrow">Step 3 · Remove duplicates</div><p class="small mt8">Δenvelope ≈ ΔRMS (r = 0.98) and Δcentroid ≈ ΔBER (r = 0.91). Keep one of each pair. Final three: ΔRMS, ΔZCR, ΔBER, with r = 0.40–0.44 between them.</p></div></div>`;
    seg('featView', v => { $('#featChart').style.display = v === 'd' ? '' : 'none'; $('#featSel').style.display = v === 'd' ? 'none' : ''; });
    chart(); redraw['p3-features'] = chart;
  };

  // ---- P3 STFT lab
  INIT['p3-stft'] = () => {
    const sel = $('#stRec'); fillRecSelect(sel, 1);
    const st = { w: 'blackman', L: 256, o: 0.75 };
    seg('stW', v => { st.w = v; draw(); }); seg('stL', v => { st.L = +v; draw(); }); seg('stO', v => { st.o = +v; draw(); });
    const cmap = t => { // navy -> blue -> red -> warm white
      const stops = [[12, 35, 64], [36, 70, 122], [238, 39, 55], [255, 196, 120], [255, 252, 245]];
      t = Math.max(0, Math.min(1, t)) * (stops.length - 1); const i = Math.min(stops.length - 2, Math.floor(t)), f = t - i;
      return stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f));
    };
    function draw() {
      const r = RECS[sel.value], dur = 3, ts = firstAnn(r), x = r.filt.subarray(Math.floor(ts * FS), Math.floor((ts + dur) * FS));
      const S = DSP.stft(x, st.w, st.L, st.o);
      const cv = $('#stCanvas'), { ctx, w, h } = prepCanvas(cv), top = 16, bot = 22, left = 44, ph = h - top - bot, pw = w - left;
      const fMax = 600, kMax = Math.round((fMax / FS) * S.nfft);
      let mx = -Infinity; S.frames.forEach(c => { for (let k = 0; k <= kMax; k++) mx = Math.max(mx, c[k]); });
      const img = ctx.createImageData(Math.max(1, Math.round(pw)), Math.max(1, Math.round(ph))), W = img.width, H = img.height;
      for (let px = 0; px < W; px++) {
        const t = (px / W) * dur; let fi = 0, bd = Infinity; S.times.forEach((tt, j) => { const dd = Math.abs(tt - t); if (dd < bd) { bd = dd; fi = j; } });
        const col = S.frames[fi];
        for (let py = 0; py < H; py++) {
          const f = (1 - py / H) * fMax, k = Math.round((f / FS) * S.nfft);
          const v = (col[Math.min(k, col.length - 1)] - (mx - 60)) / 60, c = cmap(v), o = (py * W + px) * 4;
          img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
        }
      }
      const dpr = window.devicePixelRatio || 1;
      const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H; tmp.getContext('2d').putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true; ctx.drawImage(tmp, left, top, pw, ph);
      // annotation strip
      r.ann.forEach(a => { const a0 = Math.max(0, a[0] - ts), a1 = Math.min(dur, a[1] - ts); if (a1 <= a0 || !ANN_COL[a[2]]) return; ctx.fillStyle = ANN_COL[a[2]].replace(/[\d.]+\)$/, '.85)'); ctx.fillRect(left + (a0 / dur) * pw, 2, ((a1 - a0) / dur) * pw, 10); });
      ctx.fillStyle = '#6B778A'; ctx.font = '11px system-ui';
      [0, 200, 400, 600].forEach(f => ctx.fillText(f + ' Hz', 0, top + ph - (f / fMax) * ph + 4));
      for (let t = 0; t <= dur; t += 0.5) ctx.fillText((ts + t).toFixed(1) + ' s', Math.min(w - 24, left + (t / dur) * pw), h - 6);
      const res = FS / st.L;
      $('#stInfo').innerHTML = `Window ${st.L} samples = <b>${(st.L / FS * 1000).toFixed(0)} ms</b> · frequency resolution <b>${res.toFixed(1)} Hz</b> · hop ${S.hop} samples · <b>${S.frames.length}</b> frames in 3 s. Strip on top = annotations (blue S1, pink systole, green S2, yellow diastole).`;
      verdict();
    }
    function verdict() {
      let t;
      const ours = st.w === 'blackman' && st.L === 256 && st.o === 0.75;
      if (ours) t = '<b>Our choice</b>Blackman, 256, 75%: S1 timing error 9.0 ms and murmur separation d = 0.99. Sharp enough in time to place S1/S2, fine enough in frequency (15.6 Hz) to see murmur energy.';
      else if (st.w === 'rect') t = '<b>Rectangular window</b>Worst of the four types: at 256 samples its S1 timing error was 14.6 ms, against about 9 ms for the tapered windows, and its murmur separation dropped fastest with length. Look for the vertical smearing.';
      else if (st.L === 512) t = '<b>512 samples (128 ms)</b>Too long for heart sounds that last about 100 ms. Blackman timing error rose to 12.4 ms and murmur separation fell to d = 0.84.';
      else if (st.L === 64) t = '<b>64 samples (16 ms)</b>Best timing (5.5 ms with Blackman) but only 62.5 Hz frequency resolution, so spectral detail is coarse.';
      else if (st.o === 0.5) t = '<b>50% overlap</b>Compared with 75%: murmur separation d 0.91 instead of 0.99, and timing error 12.5 ms instead of 9.0 ms.';
      else if (st.o === 0.9) t = '<b>90% overlap</b>Timing error improves to 7.4 ms, but with 2.5× more frames and no gain in murmur separation. Not worth the cost.';
      else t = `<b>${st.w[0].toUpperCase() + st.w.slice(1)}, ${st.L} samples</b>Hann, Hamming and Blackman behave very similarly on timing. Blackman kept the highest murmur separation, which is why we chose it.`;
      $('#stVerdict').innerHTML = t;
    }
    sel.onchange = draw; draw(); redraw['p3-stft'] = draw;
  };

  // ---- P4 score histogram
  const getCols = host => $$('input:checked', host).map(i => +i.value);
  INIT['p4-score'] = () => {
    const devF = CY.sets.dev;
    function draw() {
      let cols = getCols($('#scFeat')); if (!cols.length) { $('#scFeat input').checked = true; cols = [0]; }
      const T = +$('#scT').value; $('#scTV').textContent = T.toFixed(2);
      const sN = [], sM = [];
      devF.forEach(d => DSP.cycleScores(d.F, cols, MU, SD).forEach(s => (d.cls === 'murmur' ? sM : sN).push(s)));
      Charts.hist($('#scHist'), { lo: -2, hi: 4, bin: 0.25, T, xLabel: 'Cycle murmur score (mean z-score)', groups: [{ name: 'Normal cycles', color: C.normal, values: sN }, { name: 'Murmur cycles', color: C.murmur, values: sM }] });
      const mean = a => a.reduce((s, x) => s + x, 0) / a.length, sd = a => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
      const fN = sN.filter(s => s > T).length / sN.length, fM = sM.filter(s => s > T).length / sM.length;
      $('#scStats').innerHTML = [
        ['Murmur cycles flagged', pct(fM)], ['Normal cycles flagged', pct(fN)], ["Score separation d", DSP.cohenD(sN, sM).toFixed(2)],
        ['Normal score', `${mean(sN).toFixed(2)} ± ${sd(sN).toFixed(2)}`], ['Murmur score', `${mean(sM).toFixed(2)} ± ${sd(sM).toFixed(2)}`], ['Cycle AUC', DSP.auc(sN, sM).toFixed(3)]
      ].map(([k, v]) => `<div class="metric"><div class="v">${v}</div><div class="k">${k}</div></div>`).join('');
    }
    $('#scFeat').addEventListener('change', draw); $('#scT').addEventListener('input', draw);
    draw(); redraw['p4-score'] = draw;
  };

  // ---- shared evaluation
  function evaluate(set, cols, T, frac, mu = MU, sd = SD) {
    let tp = 0, fn = 0, tn = 0, fp = 0, ctp = 0, cfn = 0, ctn = 0, cfp = 0, naFlag = 0, naN = 0; const per = [];
    set.forEach(d => {
      const r = DSP.decide(d.F, cols, mu, sd, T, frac); per.push(r);
      const nf = r.flags.filter(Boolean).length;
      if (d.cls === 'murmur') { r.isMurmur ? tp++ : fn++; ctp += nf; cfn += r.flags.length - nf; }
      else if (d.cls === 'normal') { r.isMurmur ? fp++ : tn++; cfp += nf; ctn += r.flags.length - nf; }
      else { naN++; if (r.isMurmur) naFlag++; }
    });
    const m = (tp, fn, tn, fp) => { const se = tp / (tp + fn), sp = tn / (tn + fp), pr = tp / (tp + fp || 1); return { tp, fn, tn, fp, se, sp, pr, f1: (2 * pr * se) / (pr + se || 1), ba: (se + sp) / 2, fpr: 1 - sp, fnr: 1 - se }; };
    return { rec: m(tp, fn, tn, fp), cyc: m(ctp, cfn, ctn, cfp), per, naFlag, naN };
  }
  function cmHTML(r) {
    return `<div></div><div class="h">Detector: murmur</div><div class="h">Detector: normal</div>
      <div class="r">Truly murmur</div><div class="c good">${r.tp}<small>TP</small></div><div class="c bad">${r.fn}<small>FN · missed</small></div>
      <div class="r">Truly normal</div><div class="c bad">${r.fp}<small>FP · false alarm</small></div><div class="c good">${r.tn}<small>TN</small></div>`;
  }
  const metricHTML = (arr, ref) => arr.map(([k, v, key]) => {
    const dlt = ref && key ? v - ref[key] : 0;
    return `<div class="metric"><div class="v">${fmt3(v)}${ref && key && Math.abs(dlt) > 1e-9 ? `<span style="display:block;font-size:12px;font-weight:700;line-height:1.2;color:${dlt > 0 ? '#1E7B34' : '#C81B2A'}">${dlt > 0 ? '+' : ''}${dlt.toFixed(3)} vs ours</span>` : ''}</div><div class="k">${k}</div></div>`;
  }).join('');

  // ---- P4 params + lab
  INIT['p4-params'] = () => {
    // AUC chart
    const sets = [[0], [1], [2], [0, 1], [0, 2], [1, 2], [0, 1, 2]], names = ['R', 'Z', 'B', 'R+Z', 'R+B', 'Z+B', 'All'];
    const aucs = sets.map(cols => {
      const sN = [], sM = []; CY.sets.dev.forEach(d => DSP.cycleScores(d.F, cols, MU, SD).forEach(s => (d.cls === 'murmur' ? sM : sN).push(s)));
      return DSP.auc(sN, sM);
    });
    const drawAuc = () => Charts.bars($('#aucChart'), { categories: names, yMin: 0.45, yMax: 0.85, height: 250, labels: true, fmt: fmt3, highlight: 3, yLabel: 'Cycle AUC',
      series: [{ name: 'FIR cycle AUC', color: C.murmur, values: aucs }], tipExtra: ci => `<br><span class="mut">R = ΔRMS, Z = ΔZCR, B = ΔBER</span>${ci === 3 ? '<br><b>Best of the first features</b>' : ''}` });
    drawAuc();

    let setK = 'dev', frac = 0.65, selRec = null;
    const MU6 = MU.concat(IMU), SD6 = SD.concat(ISD);
    const LSETS = {}; ['dev', 'test', 'loc'].forEach(k => { LSETS[k] = CY.sets[k].map(d => ({ ...d, F: d.F.map((r, j) => { const g = IMP.G[d.rec][j]; return [r[0], r[1], r[2], g[0], g[1], -g[2]]; }) })); });
    seg('labSet', v => { setK = v; selRec = null; $('#labRecDetail').innerHTML = '<span class="muted small">Click a square to see that recording\'s cycle scores and how its vote went.</span>'; run(); });
    seg('labF', v => { frac = +v; run(); });
    function run() {
      let cols = getCols($('#labFeat')); if (!cols.length) { $('#labFeat input').checked = true; cols = [0]; }
      const T = +$('#labT').value; $('#labTV').textContent = T.toFixed(2);
      const set = LSETS[setK], E = evaluate(set, cols, T, frac, MU6, SD6);
      const isOurs = cols.join() === '3,4,5' && Math.abs(T) < 1e-9 && frac === 0.65;
      $('#labCM').innerHTML = cmHTML(E.rec);
      $('#labM').innerHTML = metricHTML([['Sensitivity', E.rec.se, 'se'], ['Specificity', E.rec.sp, 'sp'], ['Balanced acc.', E.rec.ba, 'ba'], ['Precision', E.rec.pr, 'pr'], ['F1', E.rec.f1, 'f1'], ['FPR', E.rec.fpr, 'fpr']], null) +
        `<div class="metric" style="grid-column:span 3;${isOurs ? 'background:#FDECEE' : ''}"><div class="k">${isOurs ? '<b style="color:var(--red)">This is our final detector.</b>' : 'Move the controls to see how features, T and frac trade sensitivity against specificity.'}${setK === 'loc' ? ` Murmur not audible at this location: flagged ${E.naFlag} of ${E.naN}.` : ''}</div></div>`;
      $('#labMC').innerHTML = metricHTML([['Cycle sensitivity', E.cyc.se], ['Cycle specificity', E.cyc.sp], ['Cycle bal. acc.', E.cyc.ba]]);
      $('#labNaLeg').style.display = setK === 'loc' ? '' : 'none';
      $('#labTiles').innerHTML = set.map((d, i) => {
        const r = E.per[i], truth = d.cls === 'murmur', ok = d.cls === 'notaudible' ? !r.isMurmur : r.isMurmur === truth;
        return `<button class="${d.cls === 'murmur' ? 't-m' : d.cls === 'normal' ? 't-n' : 't-na'} ${ok ? '' : 'wrong'} ${selRec === i ? 'sel' : ''}" data-i="${i}" title="${d.rec}"></button>`;
      }).join('');
      lab.E = E; lab.cols = cols; lab.T = T;
      if (selRec != null) detail(selRec);
    }
    const lab = {};
    function detail(i) {
      const d = CY.sets[setK][i], r = lab.E.per[i], nf = r.flags.filter(Boolean).length;
      const truthTxt = d.cls === 'murmur' ? `Murmur${d.timing ? `, ${d.timing.toLowerCase()}, grade ${d.grade}` : ''}` : d.cls === 'normal' ? 'Normal' : 'Murmur patient, murmur not audible here';
      const ok = d.cls === 'notaudible' ? !r.isMurmur : r.isMurmur === (d.cls === 'murmur');
      $('#labRecDetail').innerHTML = `<div class="flex" style="justify-content:space-between"><b style="color:var(--navy)">${d.rec}</b><span class="pill ${ok ? 'ok' : 'red'}">${ok ? 'correct' : 'wrong'}</span></div>
        <div class="small">Reference: ${truthTxt} · location ${d.loc}</div><div id="labRecChart"></div>
        <div class="small"><b>${nf}</b> of <b>${r.flags.length}</b> cycles above T (${pct(r.fracFlagged)}) ${r.fracFlagged >= frac ? '≥' : '<'} frac ${frac} → detector says <b>${r.isMurmur ? 'murmur' : 'normal'}</b></div>`;
      const S = r.S;
      Charts.bars($('#labRecChart'), { categories: S.map((s, k) => k + 1), yLabel: 'Cycle score', height: 200, fmt: fmt2,
        yMin: Math.min(-1, ...S) - 0.2, yMax: Math.max(1.5, ...S) + 0.2, refLines: [{ y: lab.T, label: 'T' }],
        series: [{ name: 'Score', color: C.murmur, values: S, dim: S.map(s => s <= lab.T) }], tipExtra: () => '' });
      $$('#labRecChart svg text').forEach(t => { if (S.length > 24 && /^\d+$/.test(t.textContent) && +t.textContent % 5) t.textContent = ''; });
    }
    $('#labTiles').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; selRec = +b.dataset.i; $$('#labTiles button').forEach(x => x.classList.toggle('sel', x === b)); detail(selRec); });
    $('#labFeat').addEventListener('change', run); $('#labT').addEventListener('input', run);
    $('#labReset').onclick = () => { $$('#labFeat input').forEach(i => (i.checked = +i.value >= 3)); $('#labT').value = 0; frac = 0.65; setSeg('labF', '0.65'); run(); };
    run(); redraw['p4-params'] = () => { drawAuc(); run(); };
  };

  // ---- P4 test
  INIT['p4-test'] = () => {
    const E = { dev: evalWith(ISETS.dev, [0, 1, 2], IMU, ISD, IMP.T, IMP.frac), test: evalWith(ISETS.test, [0, 1, 2], IMU, ISD, IMP.T, IMP.frac) };
    function show(k) {
      const r = E[k].rec; $('#tCM').innerHTML = cmHTML(r);
      $('#tM').innerHTML = metricHTML([['Sensitivity', r.se], ['Specificity', r.sp], ['Balanced acc.', r.ba]]);
    }
    seg('tSet', show); show('test');
    const draw = () => {
      const keys = [['Sensitivity', 'se'], ['Specificity', 'sp'], ['Precision', 'pr'], ['F1', 'f1'], ['Bal. acc.', 'ba']];
      Charts.bars($('#tCompare'), { categories: keys.map(k => k[0]), yMin: 0, yMax: 1, height: 250, labels: true, fmt: v => (+v).toFixed(2),
        series: [{ name: 'Development', color: C.normal, values: keys.map(k => E.dev.rec[k[1]]) }, { name: 'Test', color: C.murmur, values: keys.map(k => E.test.rec[k[1]]) }] });
      $('#tCompare').insertAdjacentHTML('beforeend', '<div class="legend"><span><i style="background:var(--c-normal)"></i>Development</span><span><i style="background:var(--c-murmur)"></i>Test</span></div>');
      const grp = (key, order) => order.map(v => { const ix = CY.sets.test.map((d, i) => i).filter(i => CY.sets.test[i].cls === 'murmur' && CY.sets.test[i][key] === v); return [ix.filter(i => E.test.per[i].isMurmur).length, ix.length]; });
      const g = grp('grade', ['I/VI', 'II/VI', 'III/VI']), t = grp('timing', ['Early-systolic', 'Mid-systolic', 'Holosystolic']);
      const mk = (host, cats, a) => Charts.bars(host, { categories: cats, yMin: 0, yMax: 1, height: 230, fmt: v => Math.round(v * 100) + '%', yLabel: 'Detected',
        series: [{ name: 'Detected', color: C.murmur, values: a.map(x => x[0] / x[1]) }], tipExtra: ci => `<br>${a[ci][0]} of ${a[ci][1]} recordings`, labels: false });
      mk($('#tGrade'), g.map((x, i) => `${['I/VI', 'II/VI', 'III/VI'][i]} (${x[0]}/${x[1]})`), g);
      mk($('#tTiming'), t.map((x, i) => `${['Early', 'Mid', 'Holo'][i]} (${x[0]}/${x[1]})`), t);
      Charts.bars($('#locChart'), { categories: ['AV', 'PV', 'TV', 'MV', 'All'], yMin: 0, yMax: 1.05, height: 270, labels: true, fmt: v => (+v).toFixed(3), highlight: 4,
        series: [{ name: 'Sensitivity', color: C.murmur, values: [0.947, 0.833, 0.905, 0.852, 0.882] }, { name: 'Specificity', color: C.normal, values: [0.769, 0.786, 0.815, 0.867, 0.811] }],
        tipExtra: (ci, si) => `<br><span class="mut">${si === 0 ? ['19', '18', '21', '27', '85'][ci] + ' murmur-audible recordings' : ['26', '28', '27', '30', '111'][ci] + ' normal recordings'}</span>` });
    };
    draw(); redraw['p4-test'] = draw;
  };

  // ---- P4 regions & locations
  INIT['p4-regions'] = () => {
    const draw = () => {
      Charts.bars($('#regChart'), { categories: ['Early third', 'Mid third', 'Late third'], yLabel: 'Systole RMS − diastole RMS (dB)', height: 290, labels: true, fmt: v => (+v).toFixed(2),
        series: [{ name: 'Normal (80)', color: '#9AA5B5', values: [-0.88, -1.46, -1.23] }, { name: 'Early-systolic (22)', color: C.third, values: [3.46, 0.91, -0.44] },
          { name: 'Mid-systolic (11)', color: C.normal, values: [7.75, 8.84, 7.22] }, { name: 'Holosystolic (47)', color: C.murmur, values: [8.13, 8.06, 7.50] }] });
    };
    draw(); redraw['p4-regions'] = draw;
  };

  // ---- P5 evaluation
  INIT['p5-eval'] = () => {
    const ROWS = [
      ['S1/S2', 'Dev', 0.691, null, 0.761, 0.724, null, 0.309, null], ['S1/S2', 'Test', 0.738, null, 0.767, 0.752, null, 0.262, null],
      ['Murmur, recordings', 'Dev', 0.933, 0.833, 0.848, 0.889, 0.167, 0.067, 0.883], ['Murmur, recordings', 'Test', 0.900, 0.860, 0.865, 0.882, 0.140, 0.100, 0.880],
      ['Murmur, cycles', 'Dev', 0.894, 0.491, 0.721, 0.798, 0.509, 0.106, 0.692], ['Murmur, cycles', 'Test', 0.911, 0.534, 0.673, 0.774, 0.466, 0.089, 0.723]
    ];
    $('#evTable tbody').innerHTML = ROWS.map(r => `<tr class="${r[0] === 'Murmur, recordings' && r[1] === 'Test' ? 'hl' : ''}"><td>${r[0]}</td><td>${r[1]}</td>${r.slice(2).map(v => `<td class="n">${v == null ? '–' : v.toFixed(3)}</td>`).join('')}</tr>`).join('');
    const names = ['Sens.', 'Spec.', 'Prec.', 'F1', 'FPR', 'FNR', 'Bal. acc.'];
    let det = 1;
    const draw = () => {
      const a = ROWS[det * 2].slice(2), b = ROWS[det * 2 + 1].slice(2);
      const keep = names.map((n, i) => i).filter(i => a[i] != null);
      Charts.bars($('#evChart'), { categories: keep.map(i => names[i]), yMin: 0, yMax: 1, height: 270, labels: true, fmt: v => (+v).toFixed(2),
        series: [{ name: 'Development', color: C.normal, values: keep.map(i => a[i]) }, { name: 'Test', color: C.murmur, values: keep.map(i => b[i]) }] });
      Charts.bars($('#p5Loc'), { categories: ['AV (26 / 19)', 'PV (28 / 18)', 'TV (27 / 21)', 'MV (30 / 27)'], yMin: 0, yMax: 1.8, height: 260, labels: true, fmt: fmt2, yLabel: "Cohen's d",
        series: [{ name: 'ΔRMS', color: C.murmur, values: [1.56, 1.26, 1.51, 1.19] }, { name: 'ΔZCR', color: C.normal, values: [0.56, 0.70, 1.21, 0.85] }, { name: 'ΔBER', color: C.third, values: [0.82, 0.88, 1.13, 0.93] }],
        refLines: [{ y: 0.8, label: 'large (0.8)' }], tipExtra: (ci, si) => (si === 1 && ci === 0 ? '<br>p = 0.11, not significant' : si === 1 && ci === 1 ? '<br>p = 0.053, borderline' : '') + '<br><span class="mut">(normal / murmur-audible recordings)</span>' });
    };
    seg('evDet', v => { det = +v; draw(); }); draw();

    const OMC = {
      'Filtering': ['Raw recordings carry slow drift and movement noise; heart-sound energy sits below 500 Hz.', 'Energy below 20 Hz 1.5% → 0.1% with both filters; murmur gap 4.6 → 5.7 dB; IIR leaves 3.3% above 500 Hz and delays 25 Hz by 26 ms.', 'FIR (Hamming, order 400, 25–500 Hz) gives the same noise reduction as IIR without timing distortion.'],
      'Time domain': ['Murmur systoles look louder and denser than normal ones; diastole looks the same.', 'ΔRMS d = 1.33, ΔZCR d = 1.32 (p < 0.001, pass Bonferroni); diastole features all p > 0.1.', 'Systole-minus-diastole features are the right representation; ΔRMS and ΔZCR are selected.'],
      'Frequency domain': ['Murmurs add energy at higher frequencies inside systole.', 'ΔBER d = 0.73, Δcentroid d = 0.74 (not Bonferroni-significant); entropy d = 0.48, p = 0.067.', 'ΔBER is kept as a complementary feature; the "higher entropy" hypothesis is only partly supported.'],
      'Time-frequency': ['Long windows smear S1/S2; rectangular windows leak.', 'Blackman 256 / 75%: timing error 9.0 ms, d = 0.99; rectangular 14.6 ms; 512 samples d = 0.84.', 'Blackman, 256 samples, 75% overlap is the best balance of timing and separation.'],
      'Cardiac cycles': ['Murmur patients have slightly shorter segments and faster heart rate (111 vs 102 bpm).', 'S1/S2 detector: sensitivity 69.1%, PPV 76.1%, F1 72.4% (dev), F1 75.2% (test), timing error ≈ 19 ms.', 'Envelope detection finds most heart sounds but is not reliable enough to replace the annotations for murmur detection.'],
      'Auscultation locations': ['Murmurs are not equally visible at all four valves.', 'ΔRMS d = 1.19–1.56 everywhere; ΔZCR d = 0.56 (AV) to 1.21 (TV); S1/S2 F1 lowest at AV (0.592).', 'ΔRMS is the most robust feature; ΔZCR is location dependent; AV is the hardest location to segment.'],
      'Murmur detection': ['Single cycle scores overlap heavily between groups.', 'Final features: cycle AUC 0.840; recording bal. acc. 0.883 (dev), 0.880 (test), 0.889 cross-validated.', 'Voting over many cycles turns a moderate cycle detector into a reliable recording detector.'],
      'Overall evaluation': ['Development and test results look alike.', 'Test: sensitivity 0.90, specificity 0.86, F1 0.882, FPR 0.14, FNR 0.10.', 'The pipeline generalises: it catches 9 in 10 murmurs with about 1 false alarm in 7 normal recordings.']
    };
    const keys = Object.keys(OMC);
    $('#omcTab').innerHTML = keys.map((k, i) => `<button data-v="${k}" class="${i === 6 ? 'on' : ''}">${k}</button>`).join('');
    const showO = k => { const o = OMC[k]; $('#omcBox').innerHTML = `<div class="o"><h6>Observed</h6><p>${o[0]}</p></div><div class="m"><h6>Measured</h6><p>${o[1]}</p></div><div class="c"><h6>Conclusion</h6><p>${o[2]}</p></div>`; };
    seg('omcTab', showO); showO(keys[6]);
    redraw['p5-eval'] = draw;
  };

  // ---- P6 GUI
  INIT['p6-gui'] = () => {
    const L = [
      ['Recording set & search', 'A dropdown picks the set (development, test, other locations) and a search box filters the recording list. Select any recording to load it.'],
      ['View length & slider', 'Choose how many seconds to show and scroll through the recording with a slider. All six plots stay in sync.'],
      ['Result badge', 'Green when the murmur detector agrees with the reference annotation, red when it is wrong. You see immediately whether the recording is a success or a failure case.'],
      ['Patient info', 'Age, location, murmur status, timing, grade and pitch from the CirCor metadata.'],
      ['Measures table', 'S1/S2 precision, recall, F1 and timing error for this recording; number of complete and flagged cycles; mean feature values.'],
      ['Save screenshot', 'Exports the whole app window (exportapp), which we used for the report figures.']
    ];
    const P = [
      ['1 · Raw PCG + annotations', 'The raw signal with the reference S1, systole, S2 and diastole shaded.', 'M0,22 L10,22 12,5 14,38 16,22 40,22 42,10 44,34 46,22 70,22 72,6 74,38 76,22 100,22'],
      ['2 · Filtered + envelope + S1/S2', 'Filtered signal and envelope. Detected S1/S2 on top (filled) vs annotated at the bottom (outlined). Flagged systoles shaded red.', 'M0,30 C8,30 10,8 14,8 C18,8 18,30 24,30 L38,30 C42,30 42,16 46,16 C50,16 50,30 56,30 L70,30 C74,30 76,8 80,8 C84,8 84,30 90,30 L100,30'],
      ['3 · Spectrogram', 'STFT with our settings: Blackman, 256 samples, 75% overlap.', ''],
      ['4 · Murmur score per cycle', 'Each cycle\'s score as a bar against the threshold T. Orange bars are flagged cycles.', ''],
      ['5 · Welch spectrum', 'Spectrum of systole vs diastole for this recording, showing where a murmur adds energy.', 'M0,8 C20,6 30,20 50,28 C70,36 85,40 100,42 M0,14 C20,14 30,30 50,36 C70,40 85,42 100,43'],
      ['6 · Feature z-scores', 'This recording\'s feature z-scores compared with the normal development cycles.', '']
    ];
    $('#gui').innerHTML = `<div class="gui-left">${L.map((l, i) => `<button data-k="L${i}" class="${i === 2 ? 'badge-ok' : ''}">${l[0]}</button>`).join('')}</div>
      <div class="gui-plots">${P.map((p, i) => `<button class="gui-plot" data-k="P${i}"><span>${p[0]}</span><svg viewBox="0 0 100 44" preserveAspectRatio="none">${
        i === 2 ? Array.from({ length: 20 }, (_, k) => `<rect x="${k * 5}" y="${k % 5 === 1 ? 4 : 18}" width="5" height="${k % 5 === 1 ? 40 : 26}" fill="${k % 5 === 1 ? '#EE2737' : '#24467A'}" opacity="${0.3 + (k % 3) * 0.2}"/>`).join('')
        : i === 3 ? Array.from({ length: 12 }, (_, k) => { const v = [10, 30, 8, 34, 28, 6, 32, 12, 30, 26, 9, 33][k]; return `<rect x="${k * 8 + 1}" y="${44 - v}" width="6" height="${v}" fill="${v > 20 ? '#E0A100' : '#1F5FAD'}"/>`; }).join('') + '<line x1="0" x2="100" y1="24" y2="24" stroke="#0C2340" stroke-dasharray="3 2"/>'
        : i === 5 ? [18, 30, 12].map((v, k) => `<rect x="${k * 33 + 6}" y="${44 - v}" width="22" height="${v}" rx="2" fill="${['#EE2737', '#1F5FAD', '#E0A100'][k]}"/>`).join('')
        : `<path d="${p[2]}" fill="none" stroke="${i === 4 ? '#EE2737' : '#0C2340'}" stroke-width="1.5"/>`}</svg></button>`).join('')}</div>`;
    const show = k => {
      $$('#gui [data-k]').forEach(b => b.classList.toggle('on', b.dataset.k === k));
      const it = k[0] === 'L' ? L[+k.slice(1)] : P[+k.slice(1)];
      $('#guiDetail').innerHTML = `<div class="eyebrow">${k[0] === 'L' ? 'Left panel' : 'Plot'}</div><h3 class="mt8" style="margin-top:6px">${it[0]}</h3><p>${it[1]}</p><p class="muted small">Click other parts of the layout to explore.</p>`;
    };
    $('#gui').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) show(b.dataset.k); });
    show('P1');
    $('#guiReq tbody').innerHTML = [
      ['Select a PCG recording', 'Recording set dropdown, search box and list'], ['View raw and processed signals', 'Plots 1 and 2'], ['View cardiac-cycle / S1/S2 information', 'Plot 2 and the measures table'],
      ['View time- and frequency-domain analyses', 'Plots 5 and 6, mean features in the table'], ['Display the spectrogram', 'Plot 3'], ['Display detected murmur regions', 'Red-shaded systoles in plot 2, plot 4'], ['Compare with the reference annotations', 'Plot 1 shading, plot 2 outlined markers, result badge']
    ].map(r => `<tr><td>${r[0]}</td><td><span class="pill ok">✓</span> ${r[1]}</td></tr>`).join('');
  };

  // ---- wrap-up code map
  INIT['wrap'] = () => {
    const rows = [
      ['p1_annotation_check', 'Printed summary, Table I', 'dataset'], ['p1_plot_annotations', 'fig_annotations.png', 'p1-signal'],
      ['p2_spectrum', 'psd.png', 'p2-psd'], ['p2_fir_vs_iir', 'filters.png, Tables II–III', 'p2-filters'], ['p2_cutoff_order_sweep', 'sweep.png', 'p2-sweep'], ['p2_s1s2_detection', 'detect.png, Tables IV–V', 'p2-s1s2'],
      ['p3_features', 'features.png, Table VI', 'p3-features'], ['p3_stft_settings', 'stft_sweep.png, stft.png, Table VII', 'p3-stft'],
      ['p4_detector', 'score_hist.png, p4_reference.mat', 'p4-score'], ['p4_parameter_study', 'p4_params.png, p4_params.mat', 'p4-params'], ['p4_evaluate', 'p4_locations.png', 'p4-test'], ['p4_regions', 'p4_regions.png', 'p4-regions'],
      ['p5_locations', 'p5_locations.png', 'p5-eval'], ['p5_summary', 'Printed performance table', 'p5-eval'], ['demoGUI', 'GUI with the final detector (R2020b+)', 'p6-gui']
    ];
    $('#codeMap').innerHTML = rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td><a href="#${r[2]}" data-goto="${r[2]}">${steps[idx(r[2])].dataset.title} →</a></td></tr>`).join('');
  };


  /* ------------------------------------------------ final detector */
  const IMP = window.IMPROVED;
  const IMU = [IMP.mu[0], IMP.mu[1], -IMP.mu[2]], ISD = IMP.sd;
  const impSet = set => set.map(d => ({ ...d, F: IMP.G[d.rec].map(r => [r[0], r[1], -r[2]]) }));
  const ISETS = { dev: impSet(CY.sets.dev), test: impSet(CY.sets.test) };
  function evalWith(set, cols, mu, sd, T, frac) {
    let tp = 0, fn = 0, tn = 0, fp = 0; const per = [];
    set.forEach(d => { const r = DSP.decide(d.F, cols, mu, sd, T, frac); per.push(r); if (d.cls === 'murmur') r.isMurmur ? tp++ : fn++; else r.isMurmur ? fp++ : tn++; });
    const se = tp / (tp + fn), sp = tn / (tn + fp), pr = tp / (tp + fp || 1);
    return { rec: { tp, fn, tn, fp, se, sp, pr, f1: 2 * pr * se / (pr + se || 1), ba: (se + sp) / 2 }, per };
  }

  INIT['p4-final'] = () => {
    const sN = [], sM = [];
    ISETS.dev.forEach(d => DSP.cycleScores(d.F, [0, 1, 2], IMU, ISD).forEach(s => (d.cls === 'murmur' ? sM : sN).push(s)));
    const single = k => { const n = [], m = []; ISETS.dev.forEach(d => d.F.forEach(r => (d.cls === 'murmur' ? m : n).push(r[k]))); return DSP.auc(n, m); };
    const aucs = [single(0), single(1), single(2), DSP.auc(sN, sM)];
    const drawAuc = () => Charts.bars($('#impAuc'), { categories: ['Early third', 'Loudest third', 'Steady envelope', 'All three'], yMin: 0.5, yMax: 0.9, height: 260, labels: true, fmt: fmt3, highlight: 3, yLabel: 'Cycle AUC',
      series: [{ name: 'Cycle AUC', color: C.murmur, values: aucs }] });
    drawAuc(); redraw['p4-final'] = drawAuc;
  };

  /* -------------------------------------------------------- start */
  const h = location.hash.slice(1), start = idx(h);
  go(start >= 0 ? start : 0, true);
  window.addEventListener('hashchange', () => { const i = idx(location.hash.slice(1)); if (i >= 0) go(i, true); });
})();
