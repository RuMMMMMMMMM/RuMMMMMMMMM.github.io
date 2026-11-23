/* ============================================================
 * Charts.js —— 轻量 SVG 图表引擎（零依赖、离线可用）
 * 提供：折线/面积/置信区间、柱状/堆叠、环形、仪表、雷达、迷你走势
 * ============================================================ */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var CHAR_W = 7.2; // 中文字符近似宽度(px@12px字号)

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function textW(s, fs) {
    fs = fs || 12;
    var w = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      w += (c > 255) ? fs * 0.94 : fs * 0.56;
    }
    return w;
  }
  function fmt(v, unit) {
    if (v >= 10000) return (v / 10000).toFixed(1) + 'w';
    if (v >= 1000) return (v / 1000).toFixed(2) + 'k';
    return String(Math.round(v * 100) / 100);
  }
  function catmull2bezier(pts) {
    var d = 'M' + pts[0][0] + ',' + pts[0][1];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += 'C' + c1x + ',' + c1y + ' ' + c2x + ',' + c2y + ' ' + p2[0] + ',' + p2[1];
    }
    return d;
  }

  /* 全局悬浮提示 */
  var tip = null;
  function tipEl() {
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'chart-tip';
      document.body.appendChild(tip);
    }
    return tip;
  }
  function showTip(html, x, y) {
    var t = tipEl();
    t.innerHTML = html;
    t.style.display = 'block';
    var w = t.offsetWidth || 160;
    t.style.left = Math.min(window.innerWidth - w - 12, x + 14) + 'px';
    t.style.top = Math.max(8, y - t.offsetHeight - 10) + 'px';
  }
  function hideTip() { if (tip) tip.style.display = 'none'; }

  /* 轴刻度计算 */
  function ticks(min, max, n) {
    if (min === max) { min -= 1; max += 1; }
    var step = (max - min) / (n || 4), pow = Math.pow(10, Math.floor(Math.log10(step)));
    var norm = step / pow;
    var f = norm >= 5 ? 5 : norm >= 2 ? 2 : 1;
    step = f * pow;
    var start = Math.floor(min / step) * step;
    var out = [];
    for (var v = start; v <= max + step * 0.001; v += step) out.push(v);
    return { step: step, values: out };
  }

  /* 绘图区骨架 */
  function frame(container, opts) {
    container.innerHTML = '';
    var W = opts.w || container.clientWidth || 640;
    var H = opts.h || 300;
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'chart-svg', preserveAspectRatio: 'xMidYMid meet' });
    svg.style.width = '100%'; svg.style.height = 'auto';
    container.appendChild(svg);
    return { svg: svg, W: W, H: H };
  }
  function drawGrid(svg, W, H, pad, yt, xlabelPos, color) {
    color = color || '#EDF1EE';
    var g = el('g', {}, svg);
    yt.values.forEach(function (v) {
      var y = pad.t + (yt.max - v) / (yt.max - yt.min) * (H - pad.t - pad.b);
      el('line', { x1: pad.l, y1: y, x2: W - pad.r, y2: y, stroke: color, 'stroke-width': 1 }, g);
      el('text', { x: pad.l - 8, y: y + 4, 'text-anchor': 'end', class: 'chart-tick', 'font-size': 11 }, g).textContent = fmt(v);
    });
  }
  function drawXLabels(svg, W, H, pad, labels, step) {
    var g = el('g', {}, svg);
    var span = W - pad.l - pad.r;
    labels.forEach(function (lb, i) {
      if (i % step !== 0 && i !== labels.length - 1) return;
      var x = pad.l + span * (labels.length === 1 ? 0.5 : i / (labels.length - 1));
      el('text', { x: x, y: H - pad.b + 18, 'text-anchor': 'middle', class: 'chart-tick', 'font-size': 11 }, g).textContent = lb;
    });
  }

  /* 折线/面积图（支持多序列与置信区间带） */
  function line(container, opts) {
    var f = frame(container, opts);
    var W = f.W, H = f.H, svg = f.svg;
    var pad = opts.pad || { t: 24, r: 18, b: 30, l: 48 };
    var labels = opts.labels, series = opts.series;
    var all = [];
    series.forEach(function (s) { s.data.forEach(function (v) { if (v != null) all.push(v); }); });
    var min = opts.min != null ? opts.min : Math.min.apply(null, all);
    var max = opts.max != null ? opts.max : Math.max.apply(null, all);
    var yt = ticks(min - (max - min) * 0.08, max + (max - min) * 0.08, 4);
    drawGrid(svg, W, H, pad, yt);
    var xStep = (W - pad.l - pad.r) / Math.max(1, labels.length - 1);
    var lstep = Math.max(1, Math.floor(labels.length / 8));
    drawXLabels(svg, W, H, pad, labels, lstep);

    function X(i) { return pad.l + i * xStep; }
    function Y(v) { return pad.t + (yt.max - v) / (yt.max - yt.min) * (H - pad.t - pad.b); }

    /* 置信区间带 */
    if (opts.band) {
      var bg = opts.band, top = [], bot = [], xs = [];
      for (var i = 0; i < labels.length; i++) {
        var hv = bg.history[i], fv = bg.forecast[i];
        if (hv == null && fv == null) continue;
        var v = hv != null ? hv : fv, b = bg.band[i] || 0;
        xs.push(X(i)); top.push(Y(v + b)); bot.push(Y(v - b));
      }
      if (xs.length) {
        var d = 'M' + xs[0] + ',' + top[0];
        for (var j = 1; j < xs.length; j++) d += 'L' + xs[j] + ',' + top[j];
        for (var k = xs.length - 1; k >= 0; k--) d += 'L' + xs[k] + ',' + bot[k];
        d += 'Z';
        var gdefs = el('defs', {}, svg);
        var grad = el('linearGradient', { id: opts.band.id || 'bandg', x1: 0, y1: 0, x2: 1, y2: 0 }, gdefs);
        el('stop', { offset: '0%', 'stop-color': opts.band.color, 'stop-opacity': 0.02 }, grad);
        el('stop', { offset: opts.band.split || '60%', 'stop-color': opts.band.color, 'stop-opacity': 0.18 }, grad);
        el('stop', { offset: '100%', 'stop-color': opts.band.color, 'stop-opacity': 0.30 }, grad);
        el('path', { d: d, fill: 'url(#' + (opts.band.id || 'bandg') + ')', stroke: 'none' }, svg);
        /* 预测分界线 */
        var fi = opts.band.splitIdx != null ? opts.band.splitIdx : -1;
        if (fi >= 0) {
          var fx = X(fi);
          el('line', { x1: fx, y1: pad.t, x2: fx, y2: H - pad.b, stroke: '#B9C4BE', 'stroke-dasharray': '5,5', 'stroke-width': 1 }, svg);
          el('text', { x: fx + 6, y: pad.t + 14, class: 'chart-tick', 'font-size': 11, fill: '#8A9790' }, svg).textContent = '预测区间 →';
        }
      }
    }

    series.forEach(function (s, si) {
      var pts = [];
      s.data.forEach(function (v, i) { if (v != null) pts.push([X(i), Y(v)]); });
      if (!pts.length) return;
      var d = catmull2bezier(pts);
      /* 面积 */
      if (s.fill !== false) {
        var area = d + 'L' + pts[pts.length - 1][0] + ',' + (H - pad.b) + 'L' + pts[0][0] + ',' + (H - pad.b) + 'Z';
        var g2 = el('defs', {}, svg);
        var lg = el('linearGradient', { id: 'lg' + si + '_' + Math.floor(Math.random() * 1e6), x1: 0, y1: 0, x2: 0, y2: 1 }, g2);
        el('stop', { offset: '0%', 'stop-color': s.color, 'stop-opacity': s.fillOpacity || 0.22 }, lg);
        el('stop', { offset: '100%', 'stop-color': s.color, 'stop-opacity': 0.02 }, lg);
        el('path', { d: area, fill: 'url(#' + lg.getAttribute('id') + ')', stroke: 'none' }, svg);
      }
      var path = el('path', { d: d, fill: 'none', stroke: s.color, 'stroke-width': s.width || 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'chart-anim-line' }, svg);
      var L = path.getTotalLength ? path.getTotalLength() : 0;
      if (L && !opts.noAnim) {
        path.style.strokeDasharray = L; path.style.strokeDashoffset = L;
        path.getBoundingClientRect();
        path.style.transition = 'stroke-dashoffset 1.1s ease';
        path.style.strokeDashoffset = 0;
      }
      /* 悬浮点 */
      s.data.forEach(function (v, i) {
        if (v == null) return;
        var c = el('circle', { cx: X(i), cy: Y(v), r: 10, fill: 'transparent' }, svg);
        c.addEventListener('mousemove', function (ev) {
          showTip('<b>' + s.name + '</b><br>' + labels[i] + '：<b style="color:' + s.color + '">' + v + (opts.unit || '') + '</b>', ev.clientX, ev.clientY);
          el('circle', { cx: X(i), cy: Y(v), r: 4.5, fill: s.color, stroke: '#fff', 'stroke-width': 2 }, svg).classList.add('tmp-dot');
        });
        c.addEventListener('mouseleave', function () {
          hideTip();
          svg.querySelectorAll('.tmp-dot').forEach(function (n) { n.remove(); });
        });
      });
    });

    /* 图例 */
    if (opts.legend !== false) {
      var lg = el('g', { transform: 'translate(' + pad.l + ',8)' }, svg);
      var lx = 0;
      series.forEach(function (s) {
        el('rect', { x: lx, y: 0, width: 14, height: 4, rx: 2, fill: s.color }, lg);
        var t = el('text', { x: lx + 19, y: 9, 'font-size': 11, class: 'chart-legend' }, lg);
        t.textContent = s.name;
        lx += 19 + textW(s.name, 11) + 18;
      });
    }
  }

  /* 柱状图（分组/堆叠） */
  function bars(container, opts) {
    var f = frame(container, opts);
    var W = f.W, H = f.H, svg = f.svg;
    var pad = opts.pad || { t: 26, r: 18, b: 30, l: 48 };
    var labels = opts.labels, series = opts.series;
    var all = [];
    series.forEach(function (s) { s.data.forEach(function (v) { all.push(v); }); });
    var max = Math.max.apply(null, all);
    var yt = ticks(0, max * 1.1, 4);
    drawGrid(svg, W, H, pad, yt);
    var n = labels.length, m = series.length;
    var groupW = (W - pad.l - pad.r) / n;
    var bw = groupW * 0.66 / m;
    var lstep = Math.max(1, Math.floor(n / 10));
    drawXLabels(svg, W, H, pad, labels, lstep);
    function Y(v) { return pad.t + (yt.max - v) / (yt.max - yt.min) * (H - pad.t - pad.b); }

    if (opts.stacked) {
      labels.forEach(function (lb, i) {
        var acc = 0;
        series.forEach(function (s) {
          var v = s.data[i]; if (!v) return;
          var h = (H - pad.t - pad.b) * v / yt.max;
          var x = pad.l + groupW * i + groupW * 0.17;
          var r = el('rect', { x: x, y: Y(acc + v), width: groupW * 0.66, height: h, fill: s.color, rx: 2 }, svg);
          r.style.transformOrigin = (x + groupW * 0.33) + 'px ' + (H - pad.b) + 'px';
          if (!opts.noAnim) { r.style.transform = 'scaleY(0)'; r.getBoundingClientRect(); r.style.transition = 'transform .8s ease'; r.style.transform = 'scaleY(1)'; }
          acc += v;
        });
      });
    } else {
      labels.forEach(function (lb, i) {
        series.forEach(function (s, si) {
          var v = s.data[i];
          var h = (H - pad.t - pad.b) * v / yt.max;
          var x = pad.l + groupW * i + groupW * 0.17 + bw * si;
          var r = el('rect', { x: x, y: Y(v), width: Math.max(3, bw - 3), height: h, fill: s.color, rx: 2 }, svg);
          if (!opts.noAnim) { r.style.transform = 'scaleY(0)'; r.style.transformOrigin = (x + bw / 2) + 'px ' + (H - pad.b) + 'px'; r.getBoundingClientRect(); r.style.transition = 'transform .7s ease ' + (si * 0.06) + 's'; r.style.transform = 'scaleY(1)'; }
          r.addEventListener('mousemove', function (ev) {
            showTip('<b>' + s.name + '</b><br>' + lb + '：<b>' + v + (opts.unit || '') + '</b>', ev.clientX, ev.clientY);
          });
          r.addEventListener('mouseleave', hideTip);
        });
      });
    }
    if (opts.legend !== false) {
      var lg = el('g', { transform: 'translate(' + pad.l + ',8)' }, svg);
      var lx = 0;
      series.forEach(function (s) {
        el('rect', { x: lx, y: 0, width: 12, height: 12, rx: 3, fill: s.color }, lg);
        var t = el('text', { x: lx + 17, y: 11, 'font-size': 11, class: 'chart-legend' }, lg);
        t.textContent = s.name;
        lx += 17 + textW(s.name, 11) + 18;
      });
    }
  }

  /* 环形图 */
  function donut(container, opts) {
    var f = frame(container, opts);
    var W = f.W, H = f.H, svg = f.svg;
    var cx = opts.cx || W / 2, cy = opts.cy || H / 2;
    var R = opts.r || Math.min(W, H) / 2 - 14, r = R * (opts.inner || 0.62);
    var total = opts.data.reduce(function (a, b) { return a + b.value; }, 0);
    var g = el('g', {}, svg);
    var ang = -Math.PI / 2, gap = opts.gap || 0.015;
    opts.data.forEach(function (d, i) {
      var frac = d.value / total;
      var a2 = ang + Math.PI * 2 * Math.max(0, frac - gap);
      var large = (a2 - ang) > Math.PI ? 1 : 0;
      var p = el('path', {
        d: 'M' + (cx + R * Math.cos(ang)) + ',' + (cy + R * Math.sin(ang)) +
          'A' + R + ',' + R + ' 0 ' + large + ' 1 ' + (cx + R * Math.cos(a2)) + ',' + (cy + R * Math.sin(a2)) +
          'L' + (cx + r * Math.cos(a2)) + ',' + (cy + r * Math.sin(a2)) +
          'A' + r + ',' + r + ' 0 ' + large + ' 0 ' + (cx + r * Math.cos(ang)) + ',' + (cy + r * Math.sin(ang)) + 'Z',
        fill: d.color, stroke: '#fff', 'stroke-width': 1.5
      }, g);
      if (!opts.noAnim) {
        p.style.opacity = 0; p.style.transformOrigin = cx + 'px ' + cy + 'px'; p.style.transform = 'scale(.6)';
        p.getBoundingClientRect();
        p.style.transition = 'opacity .4s ease ' + (i * 0.05) + 's, transform .5s ease ' + (i * 0.05) + 's';
        p.style.opacity = 1; p.style.transform = 'scale(1)';
      }
      var mx = cx + (R + r) / 2 * Math.cos((ang + a2) / 2), my = cy + (R + r) / 2 * Math.sin((ang + a2) / 2);
      var pct = Math.round(frac * 100);
      if (pct >= (opts.minLabel || 5)) {
        var t = el('text', { x: mx, y: my + 4, 'text-anchor': 'middle', 'font-size': 12, fill: '#fff', 'font-weight': 600 }, g);
        t.textContent = pct + '%';
      }
      p.addEventListener('mousemove', function (ev) {
        showTip('<b>' + d.name + '</b><br>' + d.value + (opts.unit || '') + ' · 占比 ' + pct + '%', ev.clientX, ev.clientY);
      });
      p.addEventListener('mouseleave', hideTip);
      ang = a2 + gap * Math.PI * 2;
    });
    if (opts.center) {
      var c1 = el('text', { x: cx, y: cy - 2, 'text-anchor': 'middle', 'font-size': opts.centerSize || 22, 'font-weight': 700, fill: '#1A2B25' }, g);
      c1.textContent = opts.center;
      var c2 = el('text', { x: cx, y: cy + 18, 'text-anchor': 'middle', 'font-size': 11, fill: '#8A9790' }, g);
      c2.textContent = opts.centerSub || '';
    }
    if (opts.legend) {
      /* 图例由页面在外部以 HTML 渲染 */
    }
    return svg;
  }

  /* 仪表盘 */
  function gauge(container, opts) {
    var f = frame(container, opts);
    var W = f.W, H = f.H, svg = f.svg;
    var cx = W / 2, cy = H * 0.72, R = Math.min(W / 2 - 20, H * 0.62);
    var min = opts.min != null ? opts.min : 0, max = opts.max != null ? opts.max : 100;
    var val = Math.min(max, Math.max(min, opts.value));
    var a0 = Math.PI * 1.15, a1 = Math.PI * 1.85;
    var frac = (val - min) / (max - min);
    var segs = opts.segments || [
      { to: 40, color: '#2F6FED' }, { to: 60, color: '#F5C242' }, { to: 80, color: '#F59E0B' }, { to: 100, color: '#E5484D' }
    ];
    var prev = min;
    segs.forEach(function (s) {
      var f1 = (prev - min) / (max - min), f2 = (s.to - min) / (max - min);
      var arc = el('path', {
        d: arcPath(cx, cy, R, a0 + (a1 - a0) * f1, a0 + (a1 - a0) * f2),
        fill: 'none', stroke: s.color, 'stroke-width': 14, 'stroke-linecap': 'butt'
      }, svg);
      prev = s.to;
    });
    var ang = a0 + (a1 - a0) * frac;
    el('path', { d: arcPath(cx, cy, R * 0.99, a0, ang), fill: 'none', stroke: '#fff', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.35 }, svg);
    var nx = cx + (R - 22) * Math.cos(ang), ny = cy + (R - 22) * Math.sin(ang);
    var needle = el('g', {}, svg);
    el('line', { x1: cx, y1: cy, x2: nx, y2: ny, stroke: '#1A2B25', 'stroke-width': 3.5, 'stroke-linecap': 'round' }, needle);
    el('circle', { cx: cx, cy: cy, r: 7, fill: '#1A2B25' }, needle);
    if (!opts.noAnim) {
      needle.style.transformOrigin = cx + 'px ' + cy + 'px';
      needle.style.transform = 'rotate(' + (-120) + 'deg)';
      needle.getBoundingClientRect();
      needle.style.transition = 'transform 1s cubic-bezier(.2,.8,.2,1)';
      needle.style.transform = 'rotate(0deg)';
    }
    var v = el('text', { x: cx, y: H * 0.72 - 34, 'text-anchor': 'middle', 'font-size': 30, 'font-weight': 700, fill: opts.color || '#1A2B25' }, svg);
    v.textContent = opts.value;
    var u = el('text', { x: cx, y: H * 0.72 - 12, 'text-anchor': 'middle', 'font-size': 11, fill: '#8A9790' }, svg);
    u.textContent = opts.unit || '';
    var l1 = el('text', { x: cx - R * 0.95, y: cy + 26, 'font-size': 10, fill: '#8A9790', 'text-anchor': 'middle' }, svg); l1.textContent = min;
    var l2 = el('text', { x: cx + R * 0.95, y: cy + 26, 'font-size': 10, fill: '#8A9790', 'text-anchor': 'middle' }, svg); l2.textContent = max;
    return svg;
  }
  function arcPath(cx, cy, R, a1, a2) {
    var x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
    var x2 = cx + R * Math.cos(a2), y2 = cy + R * Math.sin(a2);
    var large = (a2 - a1) > Math.PI ? 1 : 0;
    return 'M' + x1 + ',' + y1 + ' A' + R + ',' + R + ' 0 ' + large + ' 1 ' + x2 + ',' + y2;
  }

  /* 迷你走势 */
  function spark(container, values, color) {
    container.innerHTML = '';
    var W = container.clientWidth || 160, H = 44;
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'chart-svg' });
    svg.style.width = '100%'; svg.style.height = '100%';
    container.appendChild(svg);
    var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    var pts = values.map(function (v, i) {
      return [4 + i * ((W - 8) / Math.max(1, values.length - 1)), H - 6 - (v - min) / Math.max(0.001, max - min) * (H - 14)];
    });
    var d = catmull2bezier(pts);
    var g2 = el('defs', {}, svg);
    var lg = el('linearGradient', { id: 'sp' + Math.floor(Math.random() * 1e6), x1: 0, y1: 0, x2: 0, y2: 1 }, g2);
    el('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': 0.3 }, lg);
    el('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': 0 }, lg);
    el('path', { d: d + 'L' + pts[pts.length - 1][0] + ',' + H + 'L' + pts[0][0] + ',' + H + 'Z', fill: 'url(#' + lg.getAttribute('id') + ')' }, svg);
    el('path', { d: d, fill: 'none', stroke: color, 'stroke-width': 2 }, svg);
  }

  /* 雷达图（两组对比） */
  function radar(container, opts) {
    var f = frame(container, opts);
    var W = f.W, H = f.H, svg = f.svg;
    var cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 34;
    var axes = opts.axes, series = opts.series;
    var n = axes.length;
    function pt(i, v) {
      var ang = -Math.PI / 2 + i * Math.PI * 2 / n;
      return [cx + R * v * Math.cos(ang), cy + R * v * Math.sin(ang)];
    }
    for (var ring = 1; ring <= 4; ring++) {
      var pts = [];
      for (var i = 0; i < n; i++) pts.push(pt(i, ring / 4).join(','));
      el('polygon', { points: pts.join(' '), fill: 'none', stroke: '#E3E9E5', 'stroke-width': 1 }, svg);
    }
    for (var i2 = 0; i2 < n; i2++) {
      var p = pt(i2, 1);
      el('line', { x1: cx, y1: cy, x2: p[0], y2: p[1], stroke: '#E3E9E5', 'stroke-width': 1 }, svg);
      var t = el('text', { x: p[0] * 1.06 - cx * 0.06, y: p[1] + 4, 'text-anchor': 'middle', 'font-size': 11, fill: '#5A6B63' }, svg);
      t.textContent = axes[i2];
    }
    series.forEach(function (s) {
      var pts = [];
      for (var i3 = 0; i3 < n; i3++) pts.push(pt(i3, (s.data[i3] || 0) / (s.max || 100)).join(','));
      el('polygon', { points: pts.join(' '), fill: s.color, 'fill-opacity': s.fillOpacity || 0.16, stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round' }, svg);
      for (var j = 0; j < n; j++) {
        var c = pt(j, (s.data[j] || 0) / (s.max || 100));
        el('circle', { cx: c[0], cy: c[1], r: 3.5, fill: s.color, stroke: '#fff', 'stroke-width': 1.5 }, svg);
      }
    });
    if (opts.legend) {
      var lg = el('g', { transform: 'translate(' + (W / 2 - 70) + ',' + 10 + ')' }, svg);
      var lx = 0;
      series.forEach(function (s) {
        el('rect', { x: lx, y: 0, width: 12, height: 12, rx: 3, fill: s.color }, lg);
        var t = el('text', { x: lx + 17, y: 11, 'font-size': 11, class: 'chart-legend' }, lg); t.textContent = s.name;
        lx += 17 + textW(s.name, 11) + 18;
      });
    }
  }

  /* 横向条形排行 */
  function hbars(container, opts) {
    var f = frame(container, opts);
    var W = f.W, H = f.H, svg = f.svg;
    var pad = { l: opts.padL || 86, r: 70, t: 14, b: 14 };
    var max = Math.max.apply(null, opts.data.map(function (d) { return d.value; }));
    var rowH = (H - pad.t - pad.b) / opts.data.length;
    opts.data.forEach(function (d, i) {
      var y = pad.t + i * rowH;
      var t = el('text', { x: pad.l - 10, y: y + rowH / 2 + 4, 'text-anchor': 'end', 'font-size': 12, fill: '#33443D' }, svg);
      t.textContent = d.label;
      var bw = (W - pad.l - pad.r) * d.value / max;
      var r = el('rect', { x: pad.l, y: y + rowH * 0.22, width: Math.max(2, bw), height: rowH * 0.56, fill: d.color, rx: 3 }, svg);
      if (!opts.noAnim) { r.style.transform = 'scaleX(0)'; r.style.transformOrigin = pad.l + 'px 0'; r.getBoundingClientRect(); r.style.transition = 'transform .7s ease ' + (i * 0.05) + 's'; r.style.transform = 'scaleX(1)'; }
      var v = el('text', { x: pad.l + bw + 8, y: y + rowH / 2 + 4, 'font-size': 12, 'font-weight': 600, fill: '#1A2B25' }, svg);
      v.textContent = d.value + (opts.unit || '');
    });
  }

  window.Charts = { line: line, bars: bars, donut: donut, gauge: gauge, spark: spark, radar: radar, hbars: hbars };
})();
