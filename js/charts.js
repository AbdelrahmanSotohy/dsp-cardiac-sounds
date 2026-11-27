/* Tiny SVG chart kit (no external libraries, works offline). */
(function (global) {
  const NS = 'http://www.w3.org/2000/svg';
  const C = { normal: '#1F5FAD', murmur: '#EE2737', third: '#E0A100', navy: '#0C2340', grid: '#EEF1F5', axis: '#C9D1DD', ink: '#3B4658', mute: '#6B778A' };

  const tip = document.createElement('div'); tip.className = 'tip'; document.body.appendChild(tip);
  function showTip(e, html) { tip.innerHTML = html; tip.style.opacity = 1; moveTip(e); }
  function moveTip(e) {
    const r = tip.getBoundingClientRect(); let x = e.clientX + 14, y = e.clientY + 14;
    if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 14;
    if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 14;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip() { tip.style.opacity = 0; }
  function bindTip(node, html) {
    node.addEventListener('mouseenter', e => showTip(e, typeof html === 'function' ? html() : html));
    node.addEventListener('mousemove', moveTip);
    node.addEventListener('mouseleave', hideTip);
  }

  function el(tag, attrs, parent, text) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs || {}) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  const hostW = (host, def) => Math.max(340, Math.min(1100, Math.round(host.clientWidth || def)));
  function svg(host, w, h) {
    host.innerHTML = '';
    const s = el('svg', { viewBox: `0 0 ${w} ${h}`, class: 'chart', role: 'img' }, host);
    return s;
  }
  function niceTicks(lo, hi, n) {
    const span = hi - lo || 1, step0 = span / (n || 5), mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0);
    const out = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  }
  // rounded-top bar path anchored at baseline
  function barPath(x, y0, w, y1, r) {
    const top = Math.min(y0, y1), bot = Math.max(y0, y1), h = bot - top; r = Math.min(r, w / 2, h);
    if (y1 <= y0) return `M${x},${bot}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${bot}Z`;
    return `M${x},${top}V${bot - r}Q${x},${bot} ${x + r},${bot}H${x + w - r}Q${x + w},${bot} ${x + w},${bot - r}V${top}Z`;
  }

  /* grouped bar chart
     o = {categories, series:[{name,color,values}], yMin, yMax, yLabel, fmt, height, refLines:[{y,label}], highlight:idx, tipExtra(ci,si)} */
  function bars(host, o) {
    const W = hostW(host, 760), H = o.height || 300, m = { l: 56, r: 16, t: 18, b: o.rotate ? 70 : 44 };
    const s = svg(host, W, H), iw = W - m.l - m.r, ih = H - m.t - m.b;
    const all = o.series.flatMap(x => x.values).filter(v => v != null);
    const yMin = o.yMin != null ? o.yMin : Math.min(0, ...all), yMax = o.yMax != null ? o.yMax : Math.max(...all) * 1.12;
    const Y = v => m.t + ih - ((v - yMin) / (yMax - yMin)) * ih;
    const g = el('g', {}, s), fmt = o.fmt || (v => v);
    niceTicks(yMin, yMax, 5).forEach(t => {
      el('line', { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t), stroke: t === 0 ? C.axis : C.grid }, g);
      el('text', { x: m.l - 8, y: Y(t) + 4, 'text-anchor': 'end' }, g, fmt(t));
    });
    if (o.yLabel) el('text', { x: 14, y: m.t + ih / 2, transform: `rotate(-90 14 ${m.t + ih / 2})`, 'text-anchor': 'middle' }, g, o.yLabel);
    const nC = o.categories.length, nS = o.series.length, band = iw / nC, gap = 2;
    const bw = Math.min(46, (band * 0.72 - gap * (nS - 1)) / nS);
    const base = Y(Math.max(yMin, 0));
    o.categories.forEach((cat, ci) => {
      const gx = m.l + ci * band + (band - (bw * nS + gap * (nS - 1))) / 2;
      if (o.highlight === ci) el('rect', { x: m.l + ci * band + 2, y: m.t, width: band - 4, height: ih, fill: '#FDECEE', rx: 8 }, g);
      o.series.forEach((se, si) => {
        const v = se.values[ci]; if (v == null) return;
        const x = gx + si * (bw + gap);
        const p = el('path', { d: barPath(x, base, bw, Y(v), 4), fill: se.color, opacity: se.dim && se.dim[ci] ? 0.35 : 1 }, g);
        const hit = el('rect', { x: x - 2, y: m.t, width: bw + 4, height: ih, fill: 'transparent' }, g);
        bindTip(hit, () => `<b>${cat}</b><br>${se.name}: <b>${fmt(v)}</b>${o.tipExtra ? o.tipExtra(ci, si) : ''}`);
        hit.addEventListener('mouseenter', () => p.setAttribute('opacity', 0.8));
        hit.addEventListener('mouseleave', () => p.setAttribute('opacity', se.dim && se.dim[ci] ? 0.35 : 1));
        if (o.labels) el('text', { x: x + bw / 2, y: (v >= 0 ? Y(v) - 6 : Y(v) + 14), 'text-anchor': 'middle', style: 'font-size:11px;font-weight:600;fill:#0B1424' }, g, fmt(v));
      });
      const lx = m.l + ci * band + band / 2, ly = H - m.b + 18;
      if (o.rotate) el('text', { x: lx, y: ly, 'text-anchor': 'end', transform: `rotate(-30 ${lx} ${ly})` }, g, cat);
      else el('text', { x: lx, y: ly, 'text-anchor': 'middle', style: o.highlight === ci ? 'font-weight:700;fill:#0C2340' : '' }, g, cat);
    });
    (o.refLines || []).forEach(r => {
      el('line', { x1: m.l, x2: W - m.r, y1: Y(r.y), y2: Y(r.y), stroke: C.navy, 'stroke-dasharray': '5 4', 'stroke-width': 1.5 }, g);
      el('text', { x: W - m.r, y: Y(r.y) - 6, 'text-anchor': 'end', class: 'halo', style: 'font-size:11px;font-weight:700;fill:#0C2340' }, g, r.label);
    });
    return s;
  }

  /* line chart: o = {x:[..], xLabels, series:[{name,color,values,dash}], yMin,yMax,yLabel,xLabel,vline:{x,label},fmt,height,markers} */
  function lines(host, o) {
    const W = hostW(host, 760), H = o.height || 300, m = { l: 56, r: 20, t: 18, b: 46 };
    const s = svg(host, W, H), iw = W - m.l - m.r, ih = H - m.t - m.b;
    const xs = o.x, xMin = o.xMin != null ? o.xMin : Math.min(...xs), xMax = o.xMax != null ? o.xMax : Math.max(...xs);
    const all = o.series.flatMap(x => x.values);
    const yMin = o.yMin != null ? o.yMin : Math.min(...all), yMax = o.yMax != null ? o.yMax : Math.max(...all);
    const X = v => m.l + ((v - xMin) / (xMax - xMin || 1)) * iw, Y = v => m.t + ih - ((v - yMin) / (yMax - yMin || 1)) * ih;
    const g = el('g', {}, s), fmt = o.fmt || (v => v);
    niceTicks(yMin, yMax, 5).forEach(t => {
      el('line', { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t), stroke: C.grid }, g);
      el('text', { x: m.l - 8, y: Y(t) + 4, 'text-anchor': 'end' }, g, fmt(t));
    });
    (o.xTicks || niceTicks(xMin, xMax, 6)).forEach((t, i) => {
      el('text', { x: X(t), y: H - m.b + 18, 'text-anchor': 'middle' }, g, o.xTickFmt ? o.xTickFmt(t, i) : t);
    });
    el('line', { x1: m.l, x2: W - m.r, y1: m.t + ih, y2: m.t + ih, stroke: C.axis }, g);
    if (o.yLabel) el('text', { x: 14, y: m.t + ih / 2, transform: `rotate(-90 14 ${m.t + ih / 2})`, 'text-anchor': 'middle' }, g, o.yLabel);
    if (o.xLabel) el('text', { x: m.l + iw / 2, y: H - 6, 'text-anchor': 'middle' }, g, o.xLabel);
    (o.bands || []).forEach(b => el('rect', { x: X(b.x0), y: m.t, width: X(b.x1) - X(b.x0), height: ih, fill: b.fill || '#FDECEE' }, g));
    o.series.forEach(se => {
      const d = se.values.map((v, i) => (v == null ? null : `${X(xs[i])},${Y(Math.max(yMin, Math.min(yMax, v)))}`)).filter(Boolean);
      el('path', { d: 'M' + d.join('L'), fill: 'none', stroke: se.color, 'stroke-width': se.width || 2, 'stroke-dasharray': se.dash || '', 'stroke-linejoin': 'round' }, g);
      if (o.markers) se.values.forEach((v, i) => el('circle', { cx: X(xs[i]), cy: Y(v), r: 4.5, fill: se.color, stroke: '#fff', 'stroke-width': 2 }, g));
    });
    if (o.vline) {
      el('line', { x1: X(o.vline.x), x2: X(o.vline.x), y1: m.t, y2: m.t + ih, stroke: C.navy, 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }, g);
      if (o.vline.label) el('text', { x: X(o.vline.x) + 6, y: m.t + 12, style: 'font-size:11px;font-weight:700;fill:#0C2340' }, g, o.vline.label);
    }
    // crosshair
    const ch = el('line', { y1: m.t, y2: m.t + ih, stroke: C.mute, 'stroke-width': 1, opacity: 0 }, g);
    const hit = el('rect', { x: m.l, y: m.t, width: iw, height: ih, fill: 'transparent' }, g);
    hit.addEventListener('mousemove', e => {
      const pt = s.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const p = pt.matrixTransform(s.getScreenCTM().inverse());
      let bi = 0, bd = Infinity; xs.forEach((x, i) => { const d = Math.abs(X(x) - p.x); if (d < bd) { bd = d; bi = i; } });
      ch.setAttribute('x1', X(xs[bi])); ch.setAttribute('x2', X(xs[bi])); ch.setAttribute('opacity', 1);
      showTip(e, `<b>${o.xTipFmt ? o.xTipFmt(xs[bi]) : xs[bi]}</b>` + o.series.map(se => `<br><span style="color:${se.color}">■</span> ${se.name}: <b>${se.values[bi] == null ? '–' : fmt(se.values[bi])}</b>`).join(''));
    });
    hit.addEventListener('mouseleave', () => { ch.setAttribute('opacity', 0); hideTip(); });
    return { svg: s, X, Y };
  }

  /* heatmap: o={rows,cols,values,fmt,rowTitle,colTitle,title,highlight:[r,c],reverse} sequential navy ramp */
  function heat(host, o) {
    const W = Math.min(460, hostW(host, 380)), H = 300, m = { l: 64, r: 10, t: 30, b: 46 };
    const s = svg(host, W, H), iw = W - m.l - m.r, ih = H - m.t - m.b, g = el('g', {}, s);
    s.style.maxWidth = W + 'px';
    const flat = o.values.flat(), lo = Math.min(...flat), hi = Math.max(...flat);
    const cw = iw / o.cols.length, rh = ih / o.rows.length, fmt = o.fmt || (v => v.toFixed(2));
    const ramp = t => { // white-ish -> navy-blue
      const a = [238, 242, 248], b = [31, 95, 173]; return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
    };
    if (o.title) el('text', { x: m.l + iw / 2, y: 18, 'text-anchor': 'middle', class: 'ttl' }, g, o.title);
    o.rows.forEach((r, ri) => {
      el('text', { x: m.l - 8, y: m.t + ri * rh + rh / 2 + 4, 'text-anchor': 'end' }, g, r);
      o.cols.forEach((c, ci) => {
        const v = o.values[ri][ci], t = (v - lo) / (hi - lo || 1);
        const rc = el('rect', { x: m.l + ci * cw + 1, y: m.t + ri * rh + 1, width: cw - 2, height: rh - 2, rx: 6, fill: ramp(t) }, g);
        el('text', { x: m.l + ci * cw + cw / 2, y: m.t + ri * rh + rh / 2 + 5, 'text-anchor': 'middle', style: `font-size:14px;font-weight:700;fill:${t > 0.55 ? '#fff' : '#0B1424'}` }, g, fmt(v));
        if (o.highlight && o.highlight[0] === ri && o.highlight[1] === ci)
          el('rect', { x: m.l + ci * cw + 2, y: m.t + ri * rh + 2, width: cw - 4, height: rh - 4, rx: 6, fill: 'none', stroke: '#EE2737', 'stroke-width': 3.5 }, g);
        bindTip(rc, `${o.rowTitle} <b>${r}</b> · ${o.colTitle} <b>${c}</b><br>${o.title}: <b>${fmt(v)}</b>${o.tipExtra ? o.tipExtra(ri, ci) : ''}`);
        rc.style.cursor = 'pointer';
        if (o.onClick) rc.addEventListener('click', () => o.onClick(ri, ci));
      });
    });
    o.cols.forEach((c, ci) => el('text', { x: m.l + ci * cw + cw / 2, y: m.t + ih + 18, 'text-anchor': 'middle' }, g, c));
    el('text', { x: m.l + iw / 2, y: H - 4, 'text-anchor': 'middle' }, g, o.colTitle);
    el('text', { x: 12, y: m.t + ih / 2, transform: `rotate(-90 12 ${m.t + ih / 2})`, 'text-anchor': 'middle' }, g, o.rowTitle);
    return s;
  }

  /* histogram of two groups (percent), with movable threshold line */
  function hist(host, o) {
    const W = hostW(host, 760), H = o.height || 280, m = { l: 52, r: 16, t: 16, b: 44 };
    const s = svg(host, W, H), iw = W - m.l - m.r, ih = H - m.t - m.b, g = el('g', {}, s);
    const lo = o.lo, hi = o.hi, bw = o.bin, nb = Math.round((hi - lo) / bw);
    const count = arr => { const c = new Array(nb).fill(0); arr.forEach(v => { const k = Math.min(nb - 1, Math.max(0, Math.floor((v - lo) / bw))); c[k]++; }); return c.map(x => (100 * x) / arr.length); };
    const groups = o.groups.map(gr => ({ ...gr, pct: count(gr.values) }));
    const yMax = Math.max(...groups.flatMap(x => x.pct)) * 1.15;
    const X = v => m.l + ((v - lo) / (hi - lo)) * iw, Y = v => m.t + ih - (v / yMax) * ih;
    niceTicks(0, yMax, 4).forEach(t => { el('line', { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t), stroke: C.grid }, g); el('text', { x: m.l - 8, y: Y(t) + 4, 'text-anchor': 'end' }, g, t + '%'); });
    niceTicks(lo, hi, 8).forEach(t => el('text', { x: X(t), y: H - m.b + 18, 'text-anchor': 'middle' }, g, t));
    el('text', { x: m.l + iw / 2, y: H - 6, 'text-anchor': 'middle' }, g, o.xLabel || '');
    if (o.T != null) el('rect', { x: X(o.T), y: m.t, width: Math.max(0, X(hi) - X(o.T)), height: ih, fill: '#FDECEE' }, g);
    groups.forEach(gr => {
      let d = `M${X(lo)},${Y(0)}`;
      gr.pct.forEach((p, k) => { d += `L${X(lo + k * bw)},${Y(p)}L${X(lo + (k + 1) * bw)},${Y(p)}`; });
      d += `L${X(hi)},${Y(0)}`;
      el('path', { d, fill: gr.color, 'fill-opacity': 0.12, stroke: gr.color, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g);
    });
    el('line', { x1: m.l, x2: W - m.r, y1: Y(0), y2: Y(0), stroke: C.axis }, g);
    if (o.T != null) {
      el('line', { x1: X(o.T), x2: X(o.T), y1: m.t, y2: m.t + ih, stroke: C.navy, 'stroke-width': 2, 'stroke-dasharray': '5 4' }, g);
      el('text', { x: X(o.T) + 6, y: m.t + 12, style: 'font-size:12px;font-weight:700;fill:#0C2340' }, g, `T = ${o.T.toFixed(2)} → flagged`);
    }
    const hit = el('rect', { x: m.l, y: m.t, width: iw, height: ih, fill: 'transparent' }, g);
    hit.addEventListener('mousemove', e => {
      const pt = s.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const p = pt.matrixTransform(s.getScreenCTM().inverse());
      const k = Math.min(nb - 1, Math.max(0, Math.floor(((p.x - m.l) / iw) * nb)));
      showTip(e, `<b>score ${(lo + k * bw).toFixed(2)} … ${(lo + (k + 1) * bw).toFixed(2)}</b>` + groups.map(gr => `<br><span style="color:${gr.color}">■</span> ${gr.name}: <b>${gr.pct[k].toFixed(1)}%</b>`).join(''));
    });
    hit.addEventListener('mouseleave', hideTip);
    return s;
  }

  global.Charts = { C, bars, lines, heat, hist, el, svg, bindTip, showTip, hideTip, niceTicks };
})(window);
