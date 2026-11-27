// PCG murmur detector, ported from the MATLAB code (FIR 25-500 Hz, Hilbert S1/S2, delta features)
const PCG = (() => {
  const FS = 4000;
  const FIR = [-0.000127427708, -0.0002186821128, -0.000257762202, -0.0002213526442, -0.000129884587, -3.640244209e-05, 3.722355596e-06, -3.488948252e-05, -0.0001319643817, -0.0002321291106, -0.0002763269703, -0.000236455917, -0.0001330879426, -2.523315087e-05, 2.298713944e-05, -1.985402515e-05, -0.0001322981258, -0.0002502000527, -0.0003027915566, -0.0002545493697, -0.0001282919976, 5.279517416e-06, 6.725276944e-05, 1.737666362e-05, -0.0001194814669, -0.000264371209, -0.0003284565959, -0.0002658847828, -0.000104080919, 6.819625378e-05, 0.0001505440789, 9.082147483e-05, -8.021895632e-05, -0.0002621365391, -0.0003410005682, -0.0002574265055, -4.606996673e-05, 0.0001792096945, 0.0002891219485, 0.00021625889, -1.555268366e-18, -0.0002303447243, -0.0003280021717, -0.0002165322329, 5.927959587e-05, 0.0003527072523, 0.0004974207329, 0.0004070275925, 0.0001325580934, -0.0001596766071, -0.0002815237632, -0.000135603112, 0.0002199786327, 0.0005970741591, 0.0007833310615, 0.0006692717461, 0.0003209066895, -4.948609567e-05, -0.0002029519624, -1.687134212e-05, 0.0004338214207, 0.000910123268, 0.001143736518, 0.0009975553838, 0.0005562369478, 8.793787177e-05, -0.000107145477, 0.0001236340035, 0.0006846597022, 0.001275629453, 0.001561284353, 0.001371820231, 0.0008145867021, 0.0002246329002, -2.496106073e-05, 0.0002538603711, 0.0009405481072, 0.001661866602, 0.002003270141, 0.001756537958, 0.001056195661, 0.0003165186079, -3.426031635e-06, 0.0003259448791, 0.00115443675, 0.002022797542, 0.002423251755, 0.002102622432, 0.001227611851, 0.0003056823857, -0.0001031800533, 0.0002791998522, 0.001267711213, 0.002302185961, 0.002765617708, 0.00235226151, 0.001266624746, 0.0001253825169, -0.0003932734406, 4.573471801e-05, 0.001216417452, 0.002440445758, 0.002972884321, 0.002446368287, 0.001109621278, -0.0002927446011, -0.0009439198256, -0.0004419235974, 0.0009395331983, 0.002383598253, 0.002995070587, 0.002333922921, 0.0007005085629, -0.001010266325, -0.001818290085, -0.001242314116, 0.0003882384695, 0.002093362769, 0.002800196454, 0.001982171135, -6.985902718e-18, -0.002073716933, -0.003064852054, -0.002397104275, -0.0004651312549, 0.001557257436, 0.00238487783, 0.001386561734, -0.001006115972, -0.003508227961, -0.00471210652, -0.003925477907, -0.001619841356, 0.0007977423679, 0.001784287454, 0.0005795581015, -0.002301073307, -0.005314954314, -0.006767955419, -0.005822850652, -0.003042474857, -0.000119940224, 0.001081659446, -0.0003617584818, -0.003834692958, -0.007474648429, -0.009226740839, -0.008066462606, -0.004666513272, -0.00108010848, 0.0004196493233, -0.001307575315, -0.005525080155, -0.00996104482, -0.01208934472, -0.01063217138, -0.006396176597, -0.001904592095, 2.112493901e-05, -0.002060635277, -0.007264556606, -0.01277216819, -0.01540933531, -0.01353285151, -0.008114320472, -0.002322161166, 0.0002423012898, -0.002316074614, -0.00892932163, -0.01600376535, -0.0194053496, -0.01691144651, -0.009693592473, -0.001871876122, 0.001737241422, -0.001529237177, -0.0103917756, -0.02005746857, -0.02479818489, -0.02132412864, -0.01100954654, 0.0004649506151, 0.00609085248, 0.00162241533, -0.01153401404, -0.02647583744, -0.03426057502, -0.02902165666, -0.01195408478, 0.008296449251, 0.0195544342, 0.01271916481, -0.01226078013, -0.04440986989, -0.06535593467, -0.05740094285, -0.01244749441, 0.06257425904, 0.1467539884, 0.2127434465, 0.2376935335, 0.2127434465, 0.1467539884, 0.06257425904, -0.01244749441, -0.05740094285, -0.06535593467, -0.04440986989, -0.01226078013, 0.01271916481, 0.0195544342, 0.008296449251, -0.01195408478, -0.02902165666, -0.03426057502, -0.02647583744, -0.01153401404, 0.00162241533, 0.00609085248, 0.0004649506151, -0.01100954654, -0.02132412864, -0.02479818489, -0.02005746857, -0.0103917756, -0.001529237177, 0.001737241422, -0.001871876122, -0.009693592473, -0.01691144651, -0.0194053496, -0.01600376535, -0.00892932163, -0.002316074614, 0.0002423012898, -0.002322161166, -0.008114320472, -0.01353285151, -0.01540933531, -0.01277216819, -0.007264556606, -0.002060635277, 2.112493901e-05, -0.001904592095, -0.006396176597, -0.01063217138, -0.01208934472, -0.00996104482, -0.005525080155, -0.001307575315, 0.0004196493233, -0.00108010848, -0.004666513272, -0.008066462606, -0.009226740839, -0.007474648429, -0.003834692958, -0.0003617584818, 0.001081659446, -0.000119940224, -0.003042474857, -0.005822850652, -0.006767955419, -0.005314954314, -0.002301073307, 0.0005795581015, 0.001784287454, 0.0007977423679, -0.001619841356, -0.003925477907, -0.00471210652, -0.003508227961, -0.001006115972, 0.001386561734, 0.00238487783, 0.001557257436, -0.0004651312549, -0.002397104275, -0.003064852054, -0.002073716933, -6.985902718e-18, 0.001982171135, 0.002800196454, 0.002093362769, 0.0003882384695, -0.001242314116, -0.001818290085, -0.001010266325, 0.0007005085629, 0.002333922921, 0.002995070587, 0.002383598253, 0.0009395331983, -0.0004419235974, -0.0009439198256, -0.0002927446011, 0.001109621278, 0.002446368287, 0.002972884321, 0.002440445758, 0.001216417452, 4.573471801e-05, -0.0003932734406, 0.0001253825169, 0.001266624746, 0.00235226151, 0.002765617708, 0.002302185961, 0.001267711213, 0.0002791998522, -0.0001031800533, 0.0003056823857, 0.001227611851, 0.002102622432, 0.002423251755, 0.002022797542, 0.00115443675, 0.0003259448791, -3.426031635e-06, 0.0003165186079, 0.001056195661, 0.001756537958, 0.002003270141, 0.001661866602, 0.0009405481072, 0.0002538603711, -2.496106073e-05, 0.0002246329002, 0.0008145867021, 0.001371820231, 0.001561284353, 0.001275629453, 0.0006846597022, 0.0001236340035, -0.000107145477, 8.793787177e-05, 0.0005562369478, 0.0009975553838, 0.001143736518, 0.000910123268, 0.0004338214207, -1.687134212e-05, -0.0002029519624, -4.948609567e-05, 0.0003209066895, 0.0006692717461, 0.0007833310615, 0.0005970741591, 0.0002199786327, -0.000135603112, -0.0002815237632, -0.0001596766071, 0.0001325580934, 0.0004070275925, 0.0004974207329, 0.0003527072523, 5.927959587e-05, -0.0002165322329, -0.0003280021717, -0.0002303447243, -1.555268366e-18, 0.00021625889, 0.0002891219485, 0.0001792096945, -4.606996673e-05, -0.0002574265055, -0.0003410005682, -0.0002621365391, -8.021895632e-05, 9.082147483e-05, 0.0001505440789, 6.819625378e-05, -0.000104080919, -0.0002658847828, -0.0003284565959, -0.000264371209, -0.0001194814669, 1.737666362e-05, 6.725276944e-05, 5.279517416e-06, -0.0001282919976, -0.0002545493697, -0.0003027915566, -0.0002502000527, -0.0001322981258, -1.985402515e-05, 2.298713944e-05, -2.523315087e-05, -0.0001330879426, -0.000236455917, -0.0002763269703, -0.0002321291106, -0.0001319643817, -3.488948252e-05, 3.722355596e-06, -3.640244209e-05, -0.000129884587, -0.0002213526442, -0.000257762202, -0.0002186821128, -0.000127427708];
  const REF = {
    base: { mu: [-0.38973564689932655, 11.81194026693669], sd: [5.0854538873224024, 103.85031858695326], sign: [1, 1], T: 0.5, frac: 0.5 },
    imp: { mu: [-0.6623589090620977, 1.4954454593114521, -0.08546868832881353], sd: [5.631681235631369, 5.528427200233761, 0.40223908049945156], sign: [1, 1, -1], T: 0.0, frac: 0.65 }
  };

  function parseWav(buf) {
    const v = new DataView(buf);
    const tag = (o) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
    if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;
    let o = 12, fmt = null, data = null;
    while (o + 8 <= v.byteLength) {
      const id = tag(o), size = v.getUint32(o + 4, true);
      if (id === 'fmt ') fmt = { format: v.getUint16(o + 8, true), ch: v.getUint16(o + 10, true), fs: v.getUint32(o + 12, true), bits: v.getUint16(o + 22, true) };
      if (id === 'data') { data = { start: o + 8, size: Math.min(size, v.byteLength - o - 8) }; break; }
      o += 8 + size + (size % 2);
    }
    if (!fmt || !data) return null;
    const bps = fmt.bits / 8, n = Math.floor(data.size / (bps * fmt.ch)), x = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const p = data.start + i * bps * fmt.ch;
      let s;
      if (fmt.format === 3 && fmt.bits === 32) s = v.getFloat32(p, true);
      else if (fmt.bits === 16) s = v.getInt16(p, true) / 32768;
      else if (fmt.bits === 24) { let t = v.getUint8(p) | (v.getUint8(p + 1) << 8) | (v.getUint8(p + 2) << 16); if (t & 0x800000) t -= 0x1000000; s = t / 8388608; }
      else if (fmt.bits === 32) s = v.getInt32(p, true) / 2147483648;
      else if (fmt.bits === 8) s = (v.getUint8(p) - 128) / 128;
      else return null;
      x[i] = s;
    }
    return { fs: fmt.fs, x };
  }

  function resample(x, fsIn) {
    if (fsIn === FS) return x;
    const n = Math.floor(x.length * FS / fsIn), y = new Float64Array(n), r = fsIn / FS;
    for (let i = 0; i < n; i++) { const p = i * r, k = Math.floor(p), f = p - k; y[i] = (x[k] || 0) * (1 - f) + (x[k + 1] || 0) * f; }
    return y;
  }

  function normalise(x) {
    let m = 0; for (const v of x) m += v; m /= x.length;
    let pk = 0; const y = new Float64Array(x.length);
    for (let i = 0; i < x.length; i++) { y[i] = x[i] - m; pk = Math.max(pk, Math.abs(y[i])); }
    for (let i = 0; i < y.length; i++) y[i] /= pk || 1;
    return y;
  }

  // FIR with the 200-sample group delay removed, as in firBandpass.m
  function filter(x) {
    const N = FIR.length, h = (N - 1) / 2, y = new Float64Array(x.length);
    for (let n = 0; n < x.length; n++) {
      const m = n + h; let s = 0;
      const k0 = Math.max(0, m - x.length + 1), k1 = Math.min(N - 1, m);
      for (let k = k0; k <= k1; k++) s += FIR[k] * x[m - k];
      y[n] = s;
    }
    return y;
  }

  function fft(re, im, inv) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
      if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const a = (inv ? 2 : -2) * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const ur = re[i + k], ui = im[i + k], j = i + k + len / 2;
          const vr = re[j] * cr - im[j] * ci, vi = re[j] * ci + im[j] * cr;
          re[i + k] = ur + vr; im[i + k] = ui + vi; re[j] = ur - vr; im[j] = ui - vi;
          const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
    if (inv) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  }

  // exact length-N analytic signal (direct DFT), used on short segments
  function hilbertAbsExact(x) {
    const N = x.length, c = new Float64Array(N), s = new Float64Array(N);
    for (let k = 0; k < N; k++) { c[k] = Math.cos(2 * Math.PI * k / N); s[k] = Math.sin(2 * Math.PI * k / N); }
    const Xr = new Float64Array(N), Xi = new Float64Array(N);
    for (let k = 0; k < N; k++) { let r = 0, im = 0; for (let n = 0, idx = 0; n < N; n++, idx = (idx + k) % N) { r += x[n] * c[idx]; im -= x[n] * s[idx]; } Xr[k] = r; Xi[k] = im; }
    const h = new Float64Array(N); h[0] = 1;
    if (N % 2 === 0) { h[N / 2] = 1; for (let k = 1; k < N / 2; k++) h[k] = 2; } else for (let k = 1; k <= (N - 1) / 2; k++) h[k] = 2;
    const out = new Float64Array(N);
    for (let n = 0; n < N; n++) { let r = 0, im = 0; for (let k = 0, idx = 0; k < N; k++, idx = (idx + n) % N) { const a = Xr[k] * h[k], b = Xi[k] * h[k]; r += a * c[idx] - b * s[idx]; im += a * s[idx] + b * c[idx]; } out[n] = Math.hypot(r, im) / N; }
    return out;
  }

  // whole-recording envelope (power-of-two FFT, display and S1/S2 detection)
  function hilbertAbs(x) {
    let n = 1; while (n < x.length) n <<= 1;
    const re = new Float64Array(n), im = new Float64Array(n); re.set(x);
    fft(re, im, false);
    for (let k = 1; k < n / 2; k++) { re[k] *= 2; im[k] *= 2; }
    for (let k = n / 2 + 1; k < n; k++) { re[k] = 0; im[k] = 0; }
    fft(re, im, true);
    const e = new Float64Array(x.length); for (let i = 0; i < x.length; i++) e[i] = Math.hypot(re[i], im[i]);
    return e;
  }

  function movmean(x, k) {
    const n = x.length, cs = new Float64Array(n + 1), y = new Float64Array(n);
    for (let i = 0; i < n; i++) cs[i + 1] = cs[i] + x[i];
    const b = Math.floor(k / 2), a = k - b - 1;
    for (let i = 0; i < n; i++) { const lo = Math.max(0, i - b), hi = Math.min(n - 1, i + a); y[i] = (cs[hi + 1] - cs[lo]) / (hi - lo + 1); }
    return y;
  }

  function detectS1S2(y) {
    let env = movmean(hilbertAbs(y), Math.round(0.05 * FS));
    const srt = Float64Array.from(env).sort(); const scale = srt[Math.round(0.99 * srt.length) - 1] || 1;
    env = env.map((v) => v / scale);
    const cand = [];
    for (let i = 1; i < env.length - 1; i++) if (env[i] > env[i - 1] && env[i] >= env[i + 1] && env[i] > 0.2) cand.push(i);
    cand.sort((p, q) => env[q] - env[p]);
    const dmin = Math.round(0.15 * FS), kept = [];
    for (const p of cand) if (kept.every((q) => Math.abs(q - p) >= dmin)) kept.push(p);
    kept.sort((p, q) => p - q);
    const locs = [], lab = [];
    for (let i = 1; i < kept.length - 1; i++) { locs.push(kept[i]); lab.push(kept[i + 1] - kept[i] < kept[i] - kept[i - 1] ? 1 : 3); }
    return { locs, lab, env };
  }

  // approximate segments from detected sounds when no annotation file is given
  function autoSegments(det) {
    const hw = 0.05, rows = [];
    for (let i = 0; i + 2 < det.locs.length; i++) {
      if (det.lab[i] !== 1 || det.lab[i + 1] !== 3 || det.lab[i + 2] !== 1) continue;
      const s1 = det.locs[i] / FS, s2 = det.locs[i + 1] / FS, n1 = det.locs[i + 2] / FS;
      if (s2 - s1 < 2 * hw + 0.02 || n1 - s2 < 2 * hw + 0.02) continue;
      rows.push([s1 - hw, s1 + hw, 1], [s1 + hw, s2 - hw, 2], [s2 - hw, s2 + hw, 3], [s2 + hw, n1 - hw, 4]);
    }
    return rows;
  }

  function parseTsv(text) {
    return text.trim().split(/\r?\n/).map((l) => l.trim().split(/[\t ,;]+/).map(Number)).filter((r) => r.length >= 3 && r.every((v) => !isNaN(v)));
  }

  const rms = (v) => { let s = 0; for (const x of v) s += x * x; return Math.sqrt(s / v.length); };
  const zcr = (v) => { let c = 0; for (let i = 1; i < v.length; i++) if (Math.abs(Math.sign(v[i]) - Math.sign(v[i - 1])) > 0) c++; return c / (v.length / FS); };
  const envVar = (v) => { const e = hilbertAbsExact(v); let m = 0; for (const x of e) m += x; m /= e.length; let s = 0; for (const x of e) s += (x - m) ** 2; return Math.sqrt(s / e.length) / m; };

  // one row per complete S1-systole-S2-diastole cycle
  function cycles(y, t) {
    const out = [];
    const seg = (a, b) => y.subarray(Math.max(0, Math.floor(a * FS)), Math.min(y.length, Math.floor(b * FS)));
    for (let j = 0; j + 3 < t.length; j++) {
      if (t[j][2] !== 1 || t[j + 1][2] !== 2 || t[j + 2][2] !== 3 || t[j + 3][2] !== 4) continue;
      const s = seg(t[j + 1][0], t[j + 1][1]), d = seg(t[j + 3][0], t[j + 3][1]);
      if (s.length < 20 || d.length < 20) continue;
      const n = Math.floor(s.length / 3), th = [s.subarray(0, n), s.subarray(n, 2 * n), s.subarray(2 * n)];
      const rd = rms(d), R = (v) => 20 * Math.log10(rms(v) / rd);
      const r3 = th.map(R);
      out.push({ start: t[j + 1][0], end: t[j + 1][1], dRMS: R(s), dZCR: zcr(s) - zcr(d), early: r3[0], loudest: Math.max(...r3), envVar: envVar(s) - envVar(d) });
    }
    return out;
  }

  function decide(cyc, which) {
    const r = REF[which], keys = which === 'base' ? ['dRMS', 'dZCR'] : ['early', 'loudest', 'envVar'];
    const scores = cyc.map((c) => keys.reduce((a, k, i) => a + (c[k] - r.mu[i]) / r.sd[i] * r.sign[i], 0) / keys.length);
    const flags = scores.map((s) => s > r.T);
    const fraction = flags.length ? flags.filter(Boolean).length / flags.length : 0;
    const z = keys.map((k, i) => cyc.length ? cyc.reduce((a, c) => a + (c[k] - r.mu[i]) / r.sd[i] * r.sign[i], 0) / cyc.length : 0);
    return { scores, flags, fraction, murmur: flags.length > 0 && fraction >= r.frac, T: r.T, frac: r.frac, keys, z };
  }

  function analyse(x, fsIn, tsvText) {
    const y = filter(normalise(resample(x, fsIn)));
    const det = detectS1S2(y);
    const auto = !tsvText;
    const t = auto ? autoSegments(det) : parseTsv(tsvText);
    const cyc = cycles(y, t);
    return { y, det, t, auto, cyc, base: decide(cyc, 'base'), imp: decide(cyc, 'imp'), dur: y.length / FS };
  }

  return { FS, parseWav, analyse };
})();

