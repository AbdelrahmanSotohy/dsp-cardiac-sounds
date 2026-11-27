/* Small DSP toolbox used by the interactive labs.
   Everything here mirrors the MATLAB helpers of the project (loadPCG, firBandpass,
   detectS1S2, scoreS1S2, cycleFeatures/murmurScore/detectMurmur, cycleAUC). */
(function (global) {
  const FS = 4000;

  function decodeInt16(b64, scale) {
    const bin = atob(b64);
    const n = bin.length >> 1;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
      if (v >= 32768) v -= 65536;
      out[i] = (v / 32767) * (scale || 1);
    }
    return out;
  }

  // ---------- windows (symmetric, like MATLAB) ----------
  function win(type, N) {
    const w = new Float64Array(N);
    for (let n = 0; n < N; n++) {
      const a = N > 1 ? (2 * Math.PI * n) / (N - 1) : 0;
      switch (type) {
        case 'hann': w[n] = 0.5 - 0.5 * Math.cos(a); break;
        case 'hamming': w[n] = 0.54 - 0.46 * Math.cos(a); break;
        case 'blackman': w[n] = 0.42 - 0.5 * Math.cos(a) + 0.08 * Math.cos(2 * a); break;
        default: w[n] = 1;
      }
    }
    return w;
  }

  // ---------- radix-2 FFT (in place) ----------
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const a = i + k, b = a + len / 2;
          const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
          const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
  }
  const nextPow2 = n => { let p = 1; while (p < n) p <<= 1; return p; };

  // ---------- FIR bandpass, Hamming window (= fir1 with hamming(N+1)) ----------
  function firDesign(N, f1, f2, fs) {
    fs = fs || FS;
    const a = f1 / fs, b = f2 / fs, M = N / 2, h = new Float64Array(N + 1), w = win('hamming', N + 1);
    const sinc = x => (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));
    for (let n = 0; n <= N; n++) {
      const m = n - M;
      h[n] = (2 * b * sinc(2 * b * m) - 2 * a * sinc(2 * a * m)) * w[n];
    }
    // fir1 scaling: unit gain at the centre of the passband
    const f0 = (a + b) / 2; let re = 0, im = 0;
    for (let n = 0; n <= N; n++) { re += h[n] * Math.cos(2 * Math.PI * f0 * n); im -= h[n] * Math.sin(2 * Math.PI * f0 * n); }
    const g = Math.hypot(re, im);
    for (let n = 0; n <= N; n++) h[n] /= g;
    return h;
  }
  // zero-delay FIR: filter then drop the first N/2 samples (as in firBandpass.m)
  function firApply(h, x) {
    const N = h.length - 1, M = N / 2, n = x.length, y = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const k0 = i + M; let s = 0;
      const jmin = Math.max(0, k0 - (n - 1)), jmax = Math.min(N, k0);
      for (let j = jmin; j <= jmax; j++) s += h[j] * x[k0 - j];
      y[i] = s;
    }
    return y;
  }
  function freqResp(h, nPts, fs) {
    fs = fs || FS; const out = [];
    for (let k = 0; k < nPts; k++) {
      const f = (k / (nPts - 1)) * fs / 2; let re = 0, im = 0;
      for (let n = 0; n < h.length; n++) { re += h[n] * Math.cos(2 * Math.PI * f / fs * n); im -= h[n] * Math.sin(2 * Math.PI * f / fs * n); }
      out.push([f, 20 * Math.log10(Math.max(1e-12, Math.hypot(re, im)))]);
    }
    return out;
  }

  // ---------- Welch PSD (Hann, nfft, 50 %) ----------
  function welch(x, nfft, fs) {
    nfft = nfft || 256; fs = fs || FS;
    const w = win('hann', nfft), hop = nfft / 2, P = new Float64Array(nfft / 2 + 1);
    let cnt = 0;
    for (let s = 0; s + nfft <= x.length; s += hop) {
      const re = new Float64Array(nfft), im = new Float64Array(nfft);
      for (let i = 0; i < nfft; i++) re[i] = x[s + i] * w[i];
      fft(re, im);
      for (let k = 0; k <= nfft / 2; k++) P[k] += re[k] * re[k] + im[k] * im[k];
      cnt++;
    }
    const out = [];
    for (let k = 0; k <= nfft / 2; k++) out.push([(k * fs) / nfft, P[k] / Math.max(1, cnt)]);
    return out;
  }

  // ---------- STFT magnitude (dB) ----------
  function stft(x, type, L, overlap) {
    const w = win(type, L), hop = Math.max(1, Math.round(L * (1 - overlap))), nfft = nextPow2(L);
    const frames = [], times = [];
    for (let s = 0; s + L <= x.length; s += hop) {
      const re = new Float64Array(nfft), im = new Float64Array(nfft);
      for (let i = 0; i < L; i++) re[i] = x[s + i] * w[i];
      fft(re, im);
      const col = new Float32Array(nfft / 2 + 1);
      for (let k = 0; k <= nfft / 2; k++) col[k] = 10 * Math.log10(re[k] * re[k] + im[k] * im[k] + 1e-12);
      frames.push(col); times.push((s + L / 2) / FS);
    }
    return { frames, times, nfft, hop };
  }

  // ---------- S1/S2 detector (detectS1S2.m) ----------
  function movmean(x, k) {
    const n = x.length, c = new Float64Array(n + 1), out = new Float64Array(n);
    for (let i = 0; i < n; i++) c[i + 1] = c[i] + x[i];
    let h1, h2; if (k % 2) { h1 = h2 = (k - 1) / 2; } else { h1 = k / 2; h2 = k / 2 - 1; }
    for (let i = 0; i < n; i++) { const a = Math.max(0, i - h1), b = Math.min(n, i + h2 + 1); out[i] = (c[b] - c[a]) / (b - a); }
    return out;
  }
  function findPeaks(x, height, distance) {
    const cand = [];
    let i = 1; const n = x.length;
    while (i < n - 1) {
      if (x[i - 1] < x[i]) {
        let ahead = i + 1;
        while (ahead < n - 1 && x[ahead] === x[i]) ahead++;
        if (x[ahead] < x[i]) { cand.push((i + ahead - 1) >> 1); i = ahead; }
      }
      i++;
    }
    const pk = cand.filter(p => x[p] >= height);
    const keep = new Array(pk.length).fill(true);
    const order = pk.map((p, j) => j).sort((a, b) => x[pk[a]] - x[pk[b]]);
    for (let oi = order.length - 1; oi >= 0; oi--) {
      const j = order[oi]; if (!keep[j]) continue;
      for (let k = j - 1; k >= 0 && pk[j] - pk[k] < distance; k--) keep[k] = false;
      for (let k = j + 1; k < pk.length && pk[k] - pk[j] < distance; k++) keep[k] = false;
    }
    return pk.filter((p, j) => keep[j]);
  }
  function envelope(rec, method, smoothMs) {
    let env;
    if (method === 'Hilbert') env = Float64Array.from(rec.hil);
    else {
      const y = rec.filt; let m = 0; for (const v of y) m = Math.max(m, Math.abs(v));
      env = new Float64Array(y.length);
      for (let i = 0; i < y.length; i++) { const q = (y[i] / m) ** 2; env[i] = -q * Math.log(q + 2.220446049250313e-16); }
    }
    env = movmean(env, Math.max(1, Math.round((smoothMs / 1000) * FS)));
    const s = Float64Array.from(env).sort();
    const p99 = s[Math.round(0.99 * s.length) - 1];
    for (let i = 0; i < env.length; i++) env[i] /= p99;
    return env;
  }
  function detectS1S2(rec, method, smoothMs, thr) {
    const env = envelope(rec, method, smoothMs);
    const locs = findPeaks(env, thr, Math.round(0.15 * FS));
    const out = [];
    for (let i = 1; i < locs.length - 1; i++) out.push({ i: locs[i], lab: locs[i + 1] - locs[i] < locs[i] - locs[i - 1] ? 1 : 3 });
    return { env, det: out };
  }
  function completeCycles(ann) {
    const c = [];
    for (let i = 0; i < ann.length - 3; i++)
      if (ann[i][2] === 1 && ann[i + 1][2] === 2 && ann[i + 2][2] === 3 && ann[i + 3][2] === 4) c.push(i);
    return c;
  }
  function scoreS1S2(det, ann, n, tol) {
    tol = tol || 0.06;
    const mask = new Uint8Array(n), ref = [], rlab = [];
    for (const i of completeCycles(ann)) {
      ref.push((ann[i][0] + ann[i][1]) / 2, (ann[i + 2][0] + ann[i + 2][1]) / 2); rlab.push(1, 3);
      for (let j = i; j < i + 4; j++) {
        const a = Math.max(1, Math.floor(ann[j][0] * FS) + 1) - 1, b = Math.min(n, Math.floor(ann[j][1] * FS));
        for (let k = a; k < b; k++) mask[k] = 1;
      }
    }
    const claimed = new Array(ref.length).fill(false);
    let tp = 0, ndet = 0; const err = [], status = [];
    for (const d of det) {
      if (!mask[Math.min(Math.max(d.i, 0), n - 1)]) { status.push('out'); continue; }
      ndet++;
      const td = d.i / FS; let best = -1, bd = Infinity;
      ref.forEach((r, j) => { const e = Math.abs(r - td); if (e < bd) { bd = e; best = j; } });
      if (best >= 0 && bd <= tol && !claimed[best]) {
        claimed[best] = true;
        if (d.lab === rlab[best]) { tp++; err.push((td - ref[best]) * 1000); status.push('tp'); }
        else status.push('wrong');
      } else status.push('fp');
    }
    return { tp, ndet, nref: ref.length, err, status, ref, rlab };
  }

  // ---------- murmur detector (murmurScore / detectMurmur / cycleAUC) ----------
  function cycleScores(F, cols, mu, sd) {
    return F.map(r => cols.reduce((s, c) => s + (r[c] - mu[c]) / sd[c], 0) / cols.length);
  }
  function decide(F, cols, mu, sd, T, frac) {
    const S = cycleScores(F, cols, mu, sd), flags = S.map(s => s > T);
    const f = flags.length ? flags.filter(Boolean).length / flags.length : 0;
    return { S, flags, fracFlagged: f, isMurmur: flags.length > 0 && f >= frac };
  }
  function auc(sN, sM) {
    // P(murmur > normal) + 0.5 P(tie), computed by ranking
    const all = sN.map(v => [v, 0]).concat(sM.map(v => [v, 1])).sort((a, b) => a[0] - b[0]);
    let rankSum = 0, i = 0;
    while (i < all.length) {
      let j = i; while (j + 1 < all.length && all[j + 1][0] === all[i][0]) j++;
      const r = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) if (all[k][1]) rankSum += r;
      i = j + 1;
    }
    const nM = sM.length, nN = sN.length;
    return (rankSum - (nM * (nM + 1)) / 2) / (nM * nN);
  }
  function cohenD(a, b) {
    const m = v => v.reduce((s, x) => s + x, 0) / v.length;
    const va = v => { const mm = m(v); return v.reduce((s, x) => s + (x - mm) ** 2, 0) / (v.length - 1); };
    const sp = Math.sqrt(((a.length - 1) * va(a) + (b.length - 1) * va(b)) / (a.length + b.length - 2));
    return (m(b) - m(a)) / sp;
  }

  // ---------- audio ----------
  let actx = null, src = null;
  function play(x, onEnd) {
    stop();
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const up = 4, rate = FS * up, n = x.length * up;
    let peak = 0; for (const v of x) peak = Math.max(peak, Math.abs(v));
    const buf = actx.createBuffer(1, n, rate), d = buf.getChannelData(0), g = 0.9 / (peak || 1);
    for (let i = 0; i < x.length - 1; i++) for (let k = 0; k < up; k++) d[i * up + k] = (x[i] + (x[i + 1] - x[i]) * (k / up)) * g;
    src = actx.createBufferSource(); src.buffer = buf; src.connect(actx.destination);
    src.onended = () => { src = null; onEnd && onEnd(); };
    src.start();
    return actx.currentTime;
  }
  function stop() { if (src) { try { src.onended = null; src.stop(); } catch (e) {} src = null; } }
  function audioTime() { return actx ? actx.currentTime : 0; }

  global.DSP = { FS, decodeInt16, win, fft, firDesign, firApply, freqResp, welch, stft, movmean, findPeaks,
    envelope, detectS1S2, completeCycles, scoreS1S2, cycleScores, decide, auc, cohenD, play, stop, audioTime };
})(window);
