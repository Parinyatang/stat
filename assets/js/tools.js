/* ============================================================
   tools.js — เครื่องมือคำนวณและจำลองเชิงโต้ตอบ
   ============================================================ */
(function (global) {
'use strict';
const S = global.Stats;
const f = S.fmt, fp = S.fmtP;

/* ---------- ตัวช่วยสร้าง DOM ---------- */
function css(v){ return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }

function num(id, label, val, step, extra) {
  return '<div class="field"><label>' + label + '</label>' +
    '<input type="number" id="' + id + '" value="' + val + '" step="' + (step || 'any') + '" ' +
    (extra || '') + '></div>';
}
function sel(id, label, opts, cur) {
  let h = '<div class="field"><label>' + label + '</label><select id="' + id + '">';
  opts.forEach(o => {
    h += '<option value="' + o[0] + '"' + (o[0] === cur ? ' selected' : '') + '>' + o[1] + '</option>';
  });
  return h + '</select></div>';
}
function ta(id, label, val, ph) {
  return '<div class="field"><label>' + label + '</label>' +
    '<textarea id="' + id + '" placeholder="' + (ph || '') + '">' + (val || '') + '</textarea></div>';
}
function row(k, v) { return '<div class="rline"><span>' + k + '</span><b>' + v + '</b></div>'; }
function $(id) { return document.getElementById(id); }
function V(id) { return parseFloat($(id).value); }
function T(id) { return $(id).value; }

function bindAll(ids, fn) {
  ids.forEach(i => {
    const el = $(i);
    if (!el) return;
    el.addEventListener('input', fn);
    el.addEventListener('change', fn);
  });
  fn();
}

function segment(id, opts, cur, onPick) {
  let h = '<div class="seg" id="' + id + '">';
  opts.forEach(o => h += '<button data-v="' + o[0] + '"' + (o[0] === cur ? ' class="on"' : '') + '>' + o[1] + '</button>');
  return h + '</div>';
}
function wireSeg(id, cb) {
  const w = $(id);
  if (!w) return;
  w.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    w.querySelectorAll('button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    cb(b.dataset.v);
  });
}
function segVal(id) {
  const b = $(id) && $(id).querySelector('button.on');
  return b ? b.dataset.v : null;
}

/* ---------- ตัวช่วยวาดกราฟบน canvas ---------- */
function Plot(canvas, opt) {
  opt = opt || {};
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 600, h = opt.h || 260;
  canvas.width = w * dpr; canvas.height = h * dpr;
  canvas.style.height = h + 'px';
  const c = canvas.getContext('2d');
  c.scale(dpr, dpr);
  c.clearRect(0, 0, w, h);
  const pad = { l: 48, r: 14, t: 14, b: 34 };
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const o = {
    c, w, h, pad, iw, ih,
    xmin: 0, xmax: 1, ymin: 0, ymax: 1,
    X(v) { return pad.l + (v - this.xmin) / (this.xmax - this.xmin) * iw; },
    Y(v) { return pad.t + ih - (v - this.ymin) / (this.ymax - this.ymin) * ih; },
    domain(x0, x1, y0, y1) { this.xmin = x0; this.xmax = x1; this.ymin = y0; this.ymax = y1; return this; },
    axes(xlab, ylab, xticks) {
      const tx = css('--text-3'), bd = css('--border');
      c.strokeStyle = bd; c.lineWidth = 1; c.font = '11px system-ui'; c.fillStyle = tx;
      // grid y
      for (let i = 0; i <= 4; i++) {
        const v = this.ymin + (this.ymax - this.ymin) * i / 4, y = this.Y(v);
        c.strokeStyle = css('--border-soft');
        c.beginPath(); c.moveTo(pad.l, y); c.lineTo(w - pad.r, y); c.stroke();
        c.textAlign = 'right'; c.textBaseline = 'middle';
        c.fillText(Math.abs(v) < 1e-9 ? '0'
          : (Math.abs(v) >= 1e4 || Math.abs(v) < 1e-3) ? v.toExponential(1)
            : String(+v.toPrecision(3)), pad.l - 7, y);
      }
      c.strokeStyle = bd;
      c.beginPath(); c.moveTo(pad.l, pad.t); c.lineTo(pad.l, pad.t + ih);
      c.lineTo(w - pad.r, pad.t + ih); c.stroke();
      const nt = xticks || 6;
      c.textAlign = 'center'; c.textBaseline = 'top';
      for (let i = 0; i <= nt; i++) {
        const v = this.xmin + (this.xmax - this.xmin) * i / nt;
        c.fillText(Math.abs(v) >= 1000 ? v.toExponential(1) : (+v.toFixed(2)), this.X(v), pad.t + ih + 7);
      }
      if (xlab) { c.fillText(xlab, pad.l + iw / 2, pad.t + ih + 20); }
      return this;
    },
    curve(fn, color, fill, lo, hi) {
      const n = 360;
      c.beginPath();
      for (let i = 0; i <= n; i++) {
        const x = this.xmin + (this.xmax - this.xmin) * i / n;
        const y = fn(x);
        if (i === 0) c.moveTo(this.X(x), this.Y(y)); else c.lineTo(this.X(x), this.Y(y));
      }
      c.strokeStyle = color; c.lineWidth = 2; c.stroke();
      if (fill !== undefined && lo !== undefined) {
        c.beginPath();
        const a = Math.max(lo, this.xmin), b = Math.min(hi, this.xmax);
        c.moveTo(this.X(a), this.Y(0));
        for (let i = 0; i <= n; i++) {
          const x = a + (b - a) * i / n;
          c.lineTo(this.X(x), this.Y(fn(x)));
        }
        c.lineTo(this.X(b), this.Y(0)); c.closePath();
        c.fillStyle = fill; c.fill();
      }
      return this;
    },
    bars(items, color, hiColor, isHi) {
      const bw = Math.max(1, this.iw / items.length - 2);
      items.forEach(it => {
        const x = this.X(it.x), y = this.Y(it.y), y0 = this.Y(0);
        c.fillStyle = (isHi && isHi(it.x)) ? (hiColor || color) : color;
        c.fillRect(x - bw / 2, y, bw, Math.max(0, y0 - y));
      });
      return this;
    },
    vline(x, color, label) {
      c.strokeStyle = color; c.lineWidth = 1.6; c.setLineDash([5, 4]);
      c.beginPath(); c.moveTo(this.X(x), pad.t); c.lineTo(this.X(x), pad.t + ih); c.stroke();
      c.setLineDash([]);
      if (label) {
        c.fillStyle = color; c.font = '600 11px system-ui'; c.textAlign = 'center'; c.textBaseline = 'bottom';
        c.fillText(label, this.X(x), pad.t + 11);
      }
      return this;
    },
    points(xs, ys, color) {
      c.fillStyle = color;
      for (let i = 0; i < xs.length; i++) {
        c.beginPath(); c.arc(this.X(xs[i]), this.Y(ys[i]), 3.6, 0, 7); c.fill();
      }
      return this;
    },
    line(x0, y0, x1, y1, color) {
      c.strokeStyle = color; c.lineWidth = 2;
      c.beginPath(); c.moveTo(this.X(x0), this.Y(y0)); c.lineTo(this.X(x1), this.Y(y1)); c.stroke();
      return this;
    },
    hist(data, nbins, color) {
      const mn = Math.min.apply(null, data), mx = Math.max.apply(null, data);
      const bw = (mx - mn) / nbins || 1;
      const bins = new Array(nbins).fill(0);
      data.forEach(v => {
        let i = Math.floor((v - mn) / bw); if (i >= nbins) i = nbins - 1; if (i < 0) i = 0;
        bins[i]++;
      });
      const ymax = Math.max.apply(null, bins) * 1.12;
      this.domain(mn, mx, 0, ymax);
      this.axes();
      const pw = this.iw / nbins;
      bins.forEach((b, i) => {
        const x = pad.l + i * pw, y = this.Y(b);
        c.fillStyle = color; c.fillRect(x + 1, y, pw - 2, this.Y(0) - y);
      });
      return { bins, mn, mx, bw, ymax };
    }
  };
  return o;
}

function verdict(reject, txt) {
  return '<div class="verdict ' + (reject ? 'reject' : 'accept') + '">' +
    (reject ? '✕ ปฏิเสธ H₀ — ' : '✓ ไม่ปฏิเสธ H₀ — ') + txt + '</div>';
}
function tailName(t) { return t === 'two' ? 'สองหาง' : (t === 'left' ? 'หางซ้าย' : 'หางขวา'); }

/* ============================================================
   ทะเบียนเครื่องมือ
   ============================================================ */
const TOOLS = {};

/* ---------- 1. สถิติพรรณนา ---------- */
TOOLS.desc = {
  name: 'สถิติพรรณนา', icon: '📊', cat: 'พื้นฐาน',
  desc: 'ค่ากลาง การกระจาย ควอร์ไทล์ และฮิสโทแกรม จากข้อมูลดิบ',
  render(el) {
    el.innerHTML =
      '<div class="card">' +
      ta('dData', 'ข้อมูล (คั่นด้วยเว้นวรรค จุลภาค หรือขึ้นบรรทัดใหม่)',
        '82 76 91 68 88 73 95 79 84 70 86 77 92 81 74 89 83 78 90 85',
        'เช่น 12 15 18 20') +
      '<div style="display:flex;gap:9px;flex-wrap:wrap"><button class="btn sm ghost" id="dSample">ข้อมูลตัวอย่าง</button>' +
      '<button class="btn sm ghost" id="dRand">สุ่มข้อมูลใหม่</button></div>' +
      '</div>' +
      '<div id="dOut"></div>';

    function go() {
      const a = S.parse(T('dData'));
      const o = $('dOut');
      if (a.length < 2) { o.innerHTML = '<div class="result empty">กรุณาใส่ข้อมูลอย่างน้อย 2 ค่า</div>'; return; }
      const s = S.summary(a);
      const sk = S.skewness(a);
      o.innerHTML =
        '<div class="grid g4" style="margin-bottom:14px">' +
        '<div class="tile acc"><div class="k">จำนวน (n)</div><div class="v">' + s.n + '</div></div>' +
        '<div class="tile acc"><div class="k">ค่าเฉลี่ย x̄</div><div class="v">' + f(s.mean, 3) + '</div></div>' +
        '<div class="tile"><div class="k">มัธยฐาน</div><div class="v">' + f(s.median, 3) + '</div></div>' +
        '<div class="tile"><div class="k">ส่วนเบี่ยงเบน S</div><div class="v">' + f(s.sd, 3) + '</div></div>' +
        '</div>' +
        '<div class="grid g2">' +
        '<div class="card"><div class="card-t">ค่ากลางและการกระจาย</div>' +
        row('ฐานนิยม', s.mode.length ? s.mode.join(', ') : 'ไม่มี') +
        row('ความแปรปรวน S²', f(s.variance, 4)) +
        row('ความคลาดเคลื่อนมาตรฐาน SE', f(s.se, 4)) +
        row('สัมประสิทธิ์การแปรผัน CV', f(s.cv, 2) + ' %') +
        row('ความเบ้ (Skewness)', f(sk, 3) + ' <small style="color:var(--text-3)">(' +
          (Math.abs(sk) < 0.5 ? 'เกือบสมมาตร' : (sk > 0 ? 'เบ้ขวา' : 'เบ้ซ้าย')) + ')</small>') +
        '</div>' +
        '<div class="card"><div class="card-t">ตำแหน่งและพิสัย</div>' +
        row('ค่าต่ำสุด', f(s.min, 3)) +
        row('ควอร์ไทล์ที่ 1 (Q1)', f(s.q1, 3)) +
        row('ควอร์ไทล์ที่ 3 (Q3)', f(s.q3, 3)) +
        row('ค่าสูงสุด', f(s.max, 3)) +
        row('พิสัย (Range)', f(s.range, 3)) +
        row('พิสัยควอร์ไทล์ (IQR)', f(s.iqr, 3)) +
        '</div></div>' +
        '<div class="card"><div class="card-t">ฮิสโทแกรม</div><canvas id="dCv"></canvas>' +
        '<div class="plot-legend"><span><i style="background:' + css('--accent') + '"></i>ความถี่</span>' +
        '<span><i style="background:' + css('--danger') + '"></i>ค่าเฉลี่ย</span></div></div>';

      const nb = Math.min(14, Math.max(5, Math.ceil(Math.sqrt(a.length))));
      const p = Plot($('dCv'), { h: 250 });
      p.hist(a, nb, css('--accent'));
      p.vline(s.mean, css('--danger'), 'x̄');
    }
    $('dSample').onclick = () => { $('dData').value = '82 76 91 68 88 73 95 79 84 70 86 77 92 81 74 89 83 78 90 85'; go(); };
    $('dRand').onclick = () => {
      const n = 30 + Math.floor(Math.random() * 20);
      const arr = []; for (let i = 0; i < n; i++) arr.push(Math.round(S.randNorm(75, 11) * 10) / 10);
      $('dData').value = arr.join(' '); go();
    };
    bindAll(['dData'], go);
  }
};

/* ---------- 2. เทคนิคการนับ ---------- */
TOOLS.count = {
  name: 'เทคนิคการนับ', icon: '🔢', cat: 'บทที่ 1',
  desc: 'แฟกทอเรียล การเรียงสับเปลี่ยน และการจัดหมู่',
  render(el) {
    el.innerHTML =
      '<div class="card"><div class="grid g2">' +
      num('cN', 'n (จำนวนสิ่งของทั้งหมด)', 10, 1, 'min="0"') +
      num('cR', 'r (จำนวนที่เลือก)', 3, 1, 'min="0"') +
      '</div><div id="cOut"></div></div>' +
      '<div class="note key"><b>เลือกใช้อย่างไร</b><p>สลับตำแหน่งแล้ว<b>ผลเปลี่ยน</b> → ใช้ P(n,r) · สลับแล้ว<b>เหมือนเดิม</b> → ใช้ C(n,r)</p></div>';
    function go() {
      const n = V('cN'), r = V('cR');
      const o = $('cOut');
      if (isNaN(n) || isNaN(r) || n < 0 || r < 0) { o.innerHTML = ''; return; }
      const big = x => x > 1e15 ? x.toExponential(6) : x.toLocaleString('en-US');
      o.innerHTML = '<div class="result">' +
        row('n! = ' + n + '!', n > 170 ? '∞ (ใหญ่เกินไป)' : big(S.factorial(n))) +
        row('P(' + n + ',' + r + ') เรียงสับเปลี่ยน', r > n ? '0 (r > n)' : big(S.permut(n, r))) +
        row('C(' + n + ',' + r + ') จัดหมู่', r > n ? '0 (r > n)' : big(S.combin(n, r))) +
        row('จำนวนสับเซตทั้งหมด 2^n', n > 50 ? Math.pow(2, n).toExponential(4) : big(Math.pow(2, n))) +
        '</div>';
    }
    bindAll(['cN', 'cR'], go);
  }
};

/* ---------- 3. ทฤษฎีบทเบส์ ---------- */
TOOLS.bayes = {
  name: 'ทฤษฎีบทของเบส์', icon: '🔄', cat: 'บทที่ 1',
  desc: 'คำนวณความน่าจะเป็นย้อนกลับ พร้อมตัวอย่างการตรวจโรค',
  render(el) {
    el.innerHTML =
      '<div class="card"><div class="card-t">กำหนดค่า</div><div class="grid g3">' +
      num('bP', 'P(B) — อัตราการเกิดเหตุการณ์ B', 0.01, 0.001, 'min="0" max="1"') +
      num('bS', 'P(A|B) — ความไว (sensitivity)', 0.99, 0.01, 'min="0" max="1"') +
      num('bF', "P(A|B') — อัตราผลบวกลวง", 0.05, 0.01, 'min="0" max="1"') +
      '</div><div id="bOut"></div></div>' +
      '<div class="card"><div class="card-t">ภาพประกอบจาก 10,000 คน</div><div id="bVis"></div></div>';
    function go() {
      const pb = V('bP'), s = V('bS'), fp2 = V('bF');
      if ([pb, s, fp2].some(isNaN)) return;
      const pa = pb * s + (1 - pb) * fp2;
      const post = pb * s / pa;
      $('bOut').innerHTML = '<div class="result">' +
        row("P(A) = P(B)P(A|B) + P(B')P(A|B')", f(pa, 6)) +
        row('<b>P(B|A) — ความน่าจะเป็นภายหลัง</b>', '<b style="color:var(--accent)">' + f(post, 6) + '</b>') +
        row('คิดเป็นร้อยละ', f(post * 100, 2) + ' %') +
        row('ตัวคูณจากความน่าจะเป็นก่อนหน้า', f(post / pb, 2) + ' เท่า') +
        '</div>';
      const N = 10000;
      const hasB = Math.round(N * pb), noB = N - hasB;
      const tp = Math.round(hasB * s), fpos = Math.round(noB * fp2);
      $('bVis').innerHTML = '<div class="tbl-wrap"><table class="tbl-mini">' +
        '<thead><tr><th></th><th class="num">ผลบวก (A)</th><th class="num">ผลลบ</th><th class="num">รวม</th></tr></thead><tbody>' +
        '<tr><td><b>เกิด B จริง</b></td><td class="num" style="color:var(--ok)">' + tp + '</td><td class="num">' + (hasB - tp) + '</td><td class="num">' + hasB + '</td></tr>' +
        '<tr><td><b>ไม่เกิด B</b></td><td class="num" style="color:var(--danger)">' + fpos + '</td><td class="num">' + (noB - fpos) + '</td><td class="num">' + noB + '</td></tr>' +
        '<tr><td><b>รวม</b></td><td class="num"><b>' + (tp + fpos) + '</b></td><td class="num">' + (N - tp - fpos) + '</td><td class="num">' + N + '</td></tr>' +
        '</tbody></table></div>' +
        '<p style="font-size:13.5px;color:var(--text-2);margin:10px 0 0">ในกลุ่มที่ได้ผลบวกทั้งหมด <b>' + (tp + fpos) +
        '</b> คน มีที่เกิด B จริงเพียง <b>' + tp + '</b> คน คิดเป็น <b>' + f(tp / (tp + fpos) * 100, 1) + '%</b></p>';
    }
    bindAll(['bP', 'bS', 'bF'], go);
  }
};

/* ---------- 4. เครื่องคิดเลขการแจกแจง ---------- */
TOOLS.dist = {
  name: 'การแจกแจงความน่าจะเป็น', icon: '📈', cat: 'บทที่ 2',
  desc: 'คำนวณความน่าจะเป็นของการแจกแจงสำคัญ พร้อมกราฟ',
  render(el) {
    el.innerHTML =
      '<div class="card">' +
      sel('dkType', 'เลือกการแจกแจง', [
        ['binom', 'ทวินาม (Binomial)'], ['poisson', 'ปัวซง (Poisson)'],
        ['hyper', 'ไฮเปอร์เรขาคณิต (Hypergeometric)'], ['geom', 'เรขาคณิต (Geometric)'],
        ['normal', 'ปรกติ (Normal)'], ['exp', 'เลขชี้กำลัง (Exponential)'],
        ['uniform', 'สม่ำเสมอ (Uniform)']
      ], 'binom') +
      '<div id="dkPar" class="grid g3"></div>' +
      '<div class="field"><label>ต้องการหา</label>' +
      segment('dkOp', [['eq', 'P(X = k)'], ['le', 'P(X ≤ k)'], ['ge', 'P(X ≥ k)'], ['bw', 'P(a ≤ X ≤ b)']], 'le') + '</div>' +
      '<div id="dkVal" class="grid g2"></div>' +
      '<div id="dkOut"></div></div>' +
      '<div class="card"><div class="card-t">กราฟการแจกแจง</div><canvas id="dkCv"></canvas></div>';

    const PAR = {
      binom: [['n', 'n — จำนวนครั้ง', 20, 1], ['p', 'p — ความน่าจะเป็นสำเร็จ', 0.3, 0.01]],
      poisson: [['lam', 'λ — ค่าเฉลี่ย', 4, 0.1]],
      hyper: [['N', 'N — ขนาดประชากร', 50, 1], ['K', 'K — จำนวนที่สนใจ', 10, 1], ['n', 'n — ขนาดตัวอย่าง', 8, 1]],
      geom: [['p', 'p — ความน่าจะเป็นสำเร็จ', 0.25, 0.01]],
      normal: [['mu', 'μ — ค่าเฉลี่ย', 100, 1], ['sd', 'σ — ส่วนเบี่ยงเบน', 15, 0.1]],
      exp: [['lam', 'λ — อัตรา', 0.5, 0.01]],
      uniform: [['a', 'a — ค่าต่ำสุด', 0, 0.1], ['b', 'b — ค่าสูงสุด', 10, 0.1]]
    };
    const DISC = { binom: 1, poisson: 1, hyper: 1, geom: 1 };

    function build() {
      const t = T('dkType');
      $('dkPar').innerHTML = PAR[t].map(p => num('dk_' + p[0], p[1], p[2], p[3])).join('');
      const d = DISC[t];
      $('dkVal').innerHTML = num('dkA', d ? 'k (หรือ a)' : 'x (หรือ a)', d ? 5 : (t === 'normal' ? 120 : 2), d ? 1 : 0.1) +
        num('dkB', 'b (ใช้เมื่อเลือกช่วง)', d ? 8 : 5, d ? 1 : 0.1);
      bindAll(PAR[t].map(p => 'dk_' + p[0]).concat(['dkA', 'dkB']), go);
      go();
    }

    function go() {
      const t = T('dkType'), op = segVal('dkOp') || 'le';
      const P = {}; PAR[t].forEach(p => P[p[0]] = V('dk_' + p[0]));
      const a = V('dkA'), b = V('dkB');
      if (Object.values(P).some(isNaN) || isNaN(a)) return;
      const d = !!DISC[t];
      let pmf, cdf, mean, varr, lo = 0, hi = 10, label = '';

      if (t === 'binom') {
        if (P.p < 0 || P.p > 1 || P.n < 1) return;
        pmf = k => S.binomPmf(k, P.n, P.p); cdf = k => S.binomCdf(k, P.n, P.p);
        mean = P.n * P.p; varr = P.n * P.p * (1 - P.p); lo = 0; hi = P.n; label = 'B(' + P.n + ', ' + P.p + ')';
      } else if (t === 'poisson') {
        pmf = k => S.poissonPmf(k, P.lam); cdf = k => S.poissonCdf(k, P.lam);
        mean = P.lam; varr = P.lam; lo = 0; hi = Math.max(10, Math.ceil(P.lam + 4 * Math.sqrt(P.lam))); label = 'Poisson(' + P.lam + ')';
      } else if (t === 'hyper') {
        pmf = k => S.hyperPmf(k, P.N, P.K, P.n);
        cdf = k => { let s = 0; for (let i = 0; i <= k; i++) s += pmf(i); return Math.min(1, s); };
        mean = P.n * P.K / P.N; varr = mean * (1 - P.K / P.N) * (P.N - P.n) / (P.N - 1);
        lo = 0; hi = Math.min(P.n, P.K); label = 'Hypergeom(' + P.N + ', ' + P.K + ', ' + P.n + ')';
      } else if (t === 'geom') {
        pmf = k => S.geomPmf(k, P.p);
        cdf = k => k < 1 ? 0 : 1 - Math.pow(1 - P.p, Math.floor(k));
        mean = 1 / P.p; varr = (1 - P.p) / (P.p * P.p);
        lo = 1; hi = Math.max(10, Math.ceil(mean + 4 * Math.sqrt(varr))); label = 'Geometric(' + P.p + ')';
      } else if (t === 'normal') {
        pmf = x => S.normPdf(x, P.mu, P.sd); cdf = x => S.normCdf(x, P.mu, P.sd);
        mean = P.mu; varr = P.sd * P.sd; lo = P.mu - 4 * P.sd; hi = P.mu + 4 * P.sd;
        label = 'N(' + P.mu + ', ' + f(varr, 2) + ')';
      } else if (t === 'exp') {
        pmf = x => S.expPdf(x, P.lam); cdf = x => S.expCdf(x, P.lam);
        mean = 1 / P.lam; varr = 1 / (P.lam * P.lam); lo = 0; hi = mean * 5; label = 'Exp(' + P.lam + ')';
      } else {
        pmf = x => S.uniPdf(x, P.a, P.b); cdf = x => S.uniCdf(x, P.a, P.b);
        mean = (P.a + P.b) / 2; varr = Math.pow(P.b - P.a, 2) / 12;
        lo = P.a - (P.b - P.a) * 0.15; hi = P.b + (P.b - P.a) * 0.15; label = 'U(' + P.a + ', ' + P.b + ')';
      }

      let res = 0, txt = '';
      if (op === 'eq') { res = d ? pmf(a) : 0; txt = 'P(X = ' + a + ')'; if (!d) txt += ' = 0 (ต่อเนื่อง)'; }
      else if (op === 'le') { res = cdf(a); txt = 'P(X ≤ ' + a + ')'; }
      else if (op === 'ge') { res = d ? 1 - cdf(a - 1) : 1 - cdf(a); txt = 'P(X ≥ ' + a + ')'; }
      else { res = d ? cdf(b) - cdf(a - 1) : cdf(b) - cdf(a); txt = 'P(' + a + ' ≤ X ≤ ' + b + ')'; }

      $('dkOut').innerHTML = '<div class="result">' +
        row('การแจกแจง', label) +
        row('ค่าเฉลี่ย μ', f(mean, 4)) +
        row('ความแปรปรวน σ²', f(varr, 4)) +
        row('ส่วนเบี่ยงเบนมาตรฐาน σ', f(Math.sqrt(varr), 4)) +
        row('<b>' + txt + '</b>', '<b style="color:var(--accent)">' + f(res, 6) + '</b>') +
        '</div>';

      const pl = Plot($('dkCv'), { h: 250 });
      const inSel = x => {
        if (op === 'eq') return x === a;
        if (op === 'le') return x <= a;
        if (op === 'ge') return x >= a;
        return x >= a && x <= b;
      };
      if (d) {
        const items = [];
        let ymax = 0;
        for (let k = lo; k <= hi; k++) { const y = pmf(k); items.push({ x: k, y }); ymax = Math.max(ymax, y); }
        pl.domain(lo - 0.6, hi + 0.6, 0, ymax * 1.12).axes('x', '', Math.min(10, hi - lo));
        pl.bars(items, css('--border'), css('--accent'), inSel);
      } else {
        let ymax = 0;
        for (let i = 0; i <= 200; i++) ymax = Math.max(ymax, pmf(lo + (hi - lo) * i / 200));
        pl.domain(lo, hi, 0, ymax * 1.15).axes('x');
        let fa = op === 'le' ? lo : a, fb = op === 'ge' ? hi : (op === 'le' ? a : b);
        if (op === 'eq') { fa = a; fb = a; }
        pl.curve(pmf, css('--accent'), css('--accent-soft'), fa, fb);
      }
    }
    $('dkType').onchange = build;
    wireSeg('dkOp', go);
    build();
  }
};

/* ---------- 5. เส้นโค้งปรกติ ---------- */
TOOLS.normal = {
  name: 'เส้นโค้งปรกติ', icon: '🔔', cat: 'บทที่ 2',
  desc: 'หาพื้นที่ใต้เส้นโค้งปรกติ และแปลงค่า Z',
  render(el) {
    el.innerHTML =
      '<div class="card"><div class="grid g2">' +
      num('nMu', 'μ — ค่าเฉลี่ย', 0, 0.1) + num('nSd', 'σ — ส่วนเบี่ยงเบน', 1, 0.1) +
      '</div><div class="field"><label>รูปแบบพื้นที่</label>' +
      segment('nOp', [['lt', 'P(X < a)'], ['gt', 'P(X > a)'], ['bw', 'P(a < X < b)'], ['out', 'นอกช่วง']], 'lt') + '</div>' +
      '<div class="grid g2">' + num('nA', 'a', -1.96, 0.01) + num('nB', 'b', 1.96, 0.01) + '</div>' +
      '<div id="nOut"></div></div>' +
      '<div class="card"><div class="card-t">กราฟ</div><canvas id="nCv"></canvas></div>' +
      '<div class="card"><div class="card-t">หาค่าวิกฤตย้อนกลับ (Inverse)</div>' +
      num('nP', 'ความน่าจะเป็นสะสม P(X ≤ x)', 0.975, 0.001, 'min="0.0001" max="0.9999"') +
      '<div id="nInv"></div></div>';

    function go() {
      const mu = V('nMu'), sd = V('nSd'), a = V('nA'), b = V('nB'), op = segVal('nOp') || 'lt';
      if ([mu, sd, a].some(isNaN) || sd <= 0) return;
      const za = (a - mu) / sd, zb = (b - mu) / sd;
      let res, txt, fa, fb;
      if (op === 'lt') { res = S.normCdf(a, mu, sd); txt = 'P(X < ' + a + ')'; fa = mu - 5 * sd; fb = a; }
      else if (op === 'gt') { res = 1 - S.normCdf(a, mu, sd); txt = 'P(X > ' + a + ')'; fa = a; fb = mu + 5 * sd; }
      else if (op === 'bw') { res = S.normCdf(b, mu, sd) - S.normCdf(a, mu, sd); txt = 'P(' + a + ' < X < ' + b + ')'; fa = a; fb = b; }
      else { res = S.normCdf(a, mu, sd) + 1 - S.normCdf(b, mu, sd); txt = 'P(X < ' + a + ' หรือ X > ' + b + ')'; fa = a; fb = b; }

      $('nOut').innerHTML = '<div class="result">' +
        row('Z ของ a', f(za, 4)) +
        (op === 'bw' || op === 'out' ? row('Z ของ b', f(zb, 4)) : '') +
        row('<b>' + txt + '</b>', '<b style="color:var(--accent)">' + f(res, 6) + '</b>') +
        row('คิดเป็นร้อยละ', f(res * 100, 3) + ' %') +
        '</div>';

      const lo = mu - 4 * sd, hi = mu + 4 * sd;
      const pl = Plot($('nCv'), { h: 250 });
      const pdf = x => S.normPdf(x, mu, sd);
      pl.domain(lo, hi, 0, pdf(mu) * 1.18).axes('x');
      if (op === 'out') {
        pl.curve(pdf, css('--accent'), css('--accent-soft'), lo, a);
        pl.curve(pdf, css('--accent'), css('--accent-soft'), b, hi);
      } else pl.curve(pdf, css('--accent'), css('--accent-soft'), fa, fb);
      pl.vline(mu, css('--text-3'), 'μ');
      if (op !== 'lt' || true) pl.vline(a, css('--danger'), 'a');
      if (op === 'bw' || op === 'out') pl.vline(b, css('--danger'), 'b');
    }
    function goInv() {
      const p = V('nP'), mu = V('nMu'), sd = V('nSd');
      if (isNaN(p) || p <= 0 || p >= 1) { $('nInv').innerHTML = ''; return; }
      $('nInv').innerHTML = '<div class="result">' +
        row('z ที่สอดคล้อง', f(S.normInv(p), 5)) +
        row('x = μ + zσ', f(S.normInv(p, mu, sd), 5)) +
        '</div>';
    }
    wireSeg('nOp', go);
    bindAll(['nMu', 'nSd', 'nA', 'nB'], () => { go(); goInv(); });
    bindAll(['nP'], goInv);
  }
};

/* ---------- 6. ตารางสถิติ ---------- */
TOOLS.table = {
  name: 'ตารางค่าวิกฤต', icon: '📋', cat: 'เครื่องมือสอบ',
  desc: 'ค่าวิกฤต Z, t, Chi-square และ F คำนวณสด ไม่ต้องเปิดหนังสือ',
  render(el) {
    el.innerHTML =
      '<div class="card">' +
      '<div class="field"><label>เลือกตาราง</label>' +
      segment('tbT', [['z', 'Z'], ['t', 't'], ['chi', 'χ²'], ['f', 'F']], 't') + '</div>' +
      '<div id="tbPar" class="grid g3"></div><div id="tbOut"></div></div>' +
      '<div class="card"><div class="card-t">ตารางอ้างอิง</div><div id="tbRef"></div></div>';

    function build() {
      const t = segVal('tbT');
      let h = num('tbA', 'α (พื้นที่หางขวา)', 0.05, 0.005, 'min="0.0001" max="0.5"');
      if (t === 't' || t === 'chi') h += num('tbDf', 'องศาอิสระ (df)', 20, 1, 'min="1"');
      if (t === 'f') h += num('tbD1', 'df ตัวเศษ (df₁)', 3, 1, 'min="1"') + num('tbD2', 'df ตัวส่วน (df₂)', 20, 1, 'min="1"');
      $('tbPar').innerHTML = h;
      bindAll(['tbA', 'tbDf', 'tbD1', 'tbD2'], go);
      go();
    }

    function go() {
      const t = segVal('tbT'), a = V('tbA');
      if (isNaN(a) || a <= 0 || a >= 1) return;
      let out = '', ref = '';
      if (t === 'z') {
        out = row('z<sub>α</sub> (หางเดียว)', f(S.normInv(1 - a), 5)) +
          row('z<sub>α/2</sub> (สองหาง)', f(S.normInv(1 - a / 2), 5));
        ref = '<div class="tbl-wrap"><table class="tbl-mini"><thead><tr><th>α</th><th class="num">หางเดียว z<sub>α</sub></th><th class="num">สองหาง z<sub>α/2</sub></th></tr></thead><tbody>' +
          [0.10, 0.05, 0.025, 0.01, 0.005].map(x =>
            '<tr><td class="num">' + x + '</td><td class="num">' + f(S.normInv(1 - x), 4) + '</td><td class="num">' + f(S.normInv(1 - x / 2), 4) + '</td></tr>').join('') +
          '</tbody></table></div>';
      } else if (t === 't') {
        const df = V('tbDf'); if (isNaN(df) || df < 1) return;
        out = row('t<sub>α, df</sub> (หางเดียว)', f(S.tInv(1 - a, df), 5)) +
          row('t<sub>α/2, df</sub> (สองหาง)', f(S.tInv(1 - a / 2, df), 5));
        ref = '<div class="tbl-wrap"><table class="tbl-mini"><thead><tr><th>df</th>' +
          [0.10, 0.05, 0.025, 0.01, 0.005].map(x => '<th class="num">' + x + '</th>').join('') + '</tr></thead><tbody>' +
          [1, 2, 3, 5, 10, 15, 20, 25, 30, 60, 120].map(d =>
            '<tr><td class="num"><b>' + d + '</b></td>' +
            [0.10, 0.05, 0.025, 0.01, 0.005].map(x => '<td class="num">' + f(S.tInv(1 - x, d), 3) + '</td>').join('') + '</tr>').join('') +
          '<tr><td class="num"><b>∞</b></td>' + [0.10, 0.05, 0.025, 0.01, 0.005].map(x => '<td class="num">' + f(S.normInv(1 - x), 3) + '</td>').join('') + '</tr>' +
          '</tbody></table></div>';
      } else if (t === 'chi') {
        const df = V('tbDf'); if (isNaN(df) || df < 1) return;
        out = row('χ²<sub>α, df</sub> (หางขวา)', f(S.chiInv(1 - a, df), 5)) +
          row('χ²<sub>1−α, df</sub> (หางซ้าย)', f(S.chiInv(a, df), 5)) +
          row('สองหาง: χ²<sub>α/2</sub> (บน)', f(S.chiInv(1 - a / 2, df), 5)) +
          row('สองหาง: χ²<sub>1−α/2</sub> (ล่าง)', f(S.chiInv(a / 2, df), 5));
        ref = '<div class="tbl-wrap"><table class="tbl-mini"><thead><tr><th>df</th>' +
          [0.995, 0.975, 0.05, 0.025, 0.01].map(x => '<th class="num">' + x + '</th>').join('') + '</tr></thead><tbody>' +
          [1, 2, 3, 5, 10, 15, 20, 25, 30].map(d =>
            '<tr><td class="num"><b>' + d + '</b></td>' +
            [0.995, 0.975, 0.05, 0.025, 0.01].map(x => '<td class="num">' + f(S.chiInv(1 - x, d), 3) + '</td>').join('') + '</tr>').join('') +
          '</tbody></table></div>';
      } else {
        const d1 = V('tbD1'), d2 = V('tbD2'); if (isNaN(d1) || isNaN(d2)) return;
        out = row('F<sub>α</sub>(' + d1 + ', ' + d2 + ')', f(S.fInv(1 - a, d1, d2), 5)) +
          row('F<sub>1−α</sub>(' + d1 + ', ' + d2 + ')', f(S.fInv(a, d1, d2), 5));
        ref = '<p style="font-size:13.5px;color:var(--text-2)">ค่าวิกฤต F ที่ α = ' + a + ' (หางขวา) · แถว = df₂, คอลัมน์ = df₁</p>' +
          '<div class="tbl-wrap"><table class="tbl-mini"><thead><tr><th>df₂ \\ df₁</th>' +
          [1, 2, 3, 4, 5, 10].map(x => '<th class="num">' + x + '</th>').join('') + '</tr></thead><tbody>' +
          [5, 10, 15, 20, 30, 60].map(r =>
            '<tr><td class="num"><b>' + r + '</b></td>' +
            [1, 2, 3, 4, 5, 10].map(cc => '<td class="num">' + f(S.fInv(1 - a, cc, r), 2) + '</td>').join('') + '</tr>').join('') +
          '</tbody></table></div>';
      }
      $('tbOut').innerHTML = '<div class="result">' + out + '</div>';
      $('tbRef').innerHTML = ref;
    }
    wireSeg('tbT', build);
    build();
  }
};

/* ---------- 7. จำลอง CLT ---------- */
TOOLS.clt = {
  name: 'จำลองทฤษฎีบทขีดจำกัดกลาง', icon: '🎲', cat: 'บทที่ 3',
  desc: 'ดูการแจกแจงของค่าเฉลี่ยตัวอย่างค่อย ๆ กลายเป็นระฆังคว่ำ',
  render(el) {
    el.innerHTML =
      '<div class="card"><div class="grid g3">' +
      sel('clPop', 'การแจกแจงของประชากร', [
        ['exp', 'เลขชี้กำลัง (เบ้ขวามาก)'], ['unif', 'สม่ำเสมอ'],
        ['bi', 'สองยอด (Bimodal)'], ['pois', 'ปัวซง'], ['norm', 'ปรกติ']
      ], 'exp') +
      num('clN', 'ขนาดตัวอย่าง n', 2, 1, 'min="1" max="200"') +
      num('clK', 'จำนวนครั้งที่สุ่มซ้ำ', 2000, 100, 'min="100" max="20000"') +
      '</div>' +
      '<div class="field"><label>เลื่อนปรับ n ได้ที่นี่ — สังเกตรูปร่างที่เปลี่ยนไป</label>' +
      '<input type="range" id="clR" min="1" max="60" value="2"></div>' +
      '<button class="btn" id="clGo">สุ่มใหม่</button></div>' +
      '<div class="grid g2">' +
      '<div class="card"><div class="card-t">การแจกแจงของประชากร</div><canvas id="clC1"></canvas></div>' +
      '<div class="card"><div class="card-t">การแจกแจงของค่าเฉลี่ย x̄</div><canvas id="clC2"></canvas></div>' +
      '</div><div id="clOut"></div>';

    function draw() {
      const pop = T('clPop'), n = Math.max(1, Math.round(V('clN'))), K = Math.round(V('clK'));
      if (isNaN(n) || isNaN(K)) return;
      const gen = {
        exp: () => S.randExp(0.5),
        unif: () => S.randUnif(0, 10),
        bi: () => Math.random() < 0.5 ? S.randNorm(2, 0.9) : S.randNorm(8, 0.9),
        pois: () => S.randPoisson(3),
        norm: () => S.randNorm(5, 1.6)
      }[pop];
      const theo = {
        exp: { m: 2, s: 2 }, unif: { m: 5, s: 10 / Math.sqrt(12) },
        bi: { m: 5, s: Math.sqrt(9 + 0.81) }, pois: { m: 3, s: Math.sqrt(3) }, norm: { m: 5, s: 1.6 }
      }[pop];

      const raw = []; for (let i = 0; i < 3000; i++) raw.push(gen());
      const means = [];
      for (let i = 0; i < K; i++) {
        let s = 0; for (let j = 0; j < n; j++) s += gen();
        means.push(s / n);
      }
      Plot($('clC1'), { h: 215 }).hist(raw, 28, css('--text-3'));
      const p2 = Plot($('clC2'), { h: 215 });
      p2.hist(means, 28, css('--accent'));
      p2.vline(S.mean(means), css('--danger'), 'x̄');

      const seT = theo.s / Math.sqrt(n);
      $('clOut').innerHTML = '<div class="card"><div class="card-t">เปรียบเทียบค่าทฤษฎีกับค่าจากการจำลอง</div>' +
        '<div class="grid g4">' +
        '<div class="tile"><div class="k">μ ทฤษฎี</div><div class="v">' + f(theo.m, 3) + '</div></div>' +
        '<div class="tile acc"><div class="k">ค่าเฉลี่ยของ x̄</div><div class="v">' + f(S.mean(means), 3) + '</div></div>' +
        '<div class="tile"><div class="k">σ/√n ทฤษฎี</div><div class="v">' + f(seT, 3) + '</div></div>' +
        '<div class="tile acc"><div class="k">SD ของ x̄ ที่สุ่มได้</div><div class="v">' + f(S.sd(means), 3) + '</div></div>' +
        '</div>' +
        '<p style="font-size:13.5px;color:var(--text-2);margin:13px 0 0">ความเบ้ของ x̄ = <b>' + f(S.skewness(means), 3) +
        '</b> — ยิ่งใกล้ 0 ยิ่งใกล้การแจกแจงปรกติ' + (n >= 30 ? ' <b style="color:var(--ok)">(n ≥ 30 ตามเกณฑ์ CLT)</b>' : ' <b style="color:var(--warn)">(ลองเพิ่ม n ให้ถึง 30)</b>') + '</p></div>';
    }
    $('clGo').onclick = draw;
    $('clR').oninput = () => { $('clN').value = $('clR').value; draw(); };
    $('clN').oninput = () => { $('clR').value = Math.min(60, V('clN')); draw(); };
    $('clPop').onchange = draw; $('clK').onchange = draw;
    draw();
  }
};

/* ---------- 8. ช่วงความเชื่อมั่น ---------- */
TOOLS.ci = {
  name: 'ช่วงความเชื่อมั่น', icon: '📐', cat: 'บทที่ 4',
  desc: 'สร้างช่วงความเชื่อมั่นของค่าเฉลี่ย สัดส่วน และความแปรปรวน',
  render(el) {
    el.innerHTML =
      '<div class="card">' +
      '<div class="field"><label>ชนิดของพารามิเตอร์</label>' +
      segment('ciT', [['mean', 'ค่าเฉลี่ย μ'], ['prop', 'สัดส่วน p'], ['var', 'ความแปรปรวน σ²'], ['diff', 'ผลต่าง μ₁−μ₂']], 'mean') +
      '</div><div id="ciPar"></div>' +
      sel('ciL', 'ระดับความเชื่อมั่น', [['0.90', '90%'], ['0.95', '95%'], ['0.99', '99%']], '0.95') +
      '<div id="ciOut"></div></div>';

    function build() {
      const t = segVal('ciT');
      let h = '';
      if (t === 'mean') h = '<div class="grid g4">' + num('ciN', 'n', 25, 1) + num('ciM', 'x̄', 52.3, 0.1) +
        num('ciS', 'S (หรือ σ)', 6.4, 0.1) + sel('ciK', 'ทราบ σ หรือไม่', [['t', 'ไม่ทราบ → ใช้ t'], ['z', 'ทราบ → ใช้ Z']], 't') + '</div>';
      else if (t === 'prop') h = '<div class="grid g2">' + num('ciN', 'n', 400, 1) + num('ciX', 'x (จำนวนที่สนใจ)', 232, 1) + '</div>';
      else if (t === 'var') h = '<div class="grid g2">' + num('ciN', 'n', 20, 1) + num('ciS', 'S', 4.5, 0.1) + '</div>';
      else h = '<div class="grid g3">' + num('ciN1', 'n₁', 20, 1) + num('ciM1', 'x̄₁', 48.2, 0.1) + num('ciS1', 'S₁', 5.1, 0.1) +
        num('ciN2', 'n₂', 22, 1) + num('ciM2', 'x̄₂', 44.6, 0.1) + num('ciS2', 'S₂', 4.8, 0.1) + '</div>';
      $('ciPar').innerHTML = h;
      bindAll(['ciN', 'ciM', 'ciS', 'ciK', 'ciX', 'ciN1', 'ciM1', 'ciS1', 'ciN2', 'ciM2', 'ciS2', 'ciL'], go);
      go();
    }

    function go() {
      const t = segVal('ciT'), lv = parseFloat(T('ciL')), al = 1 - lv;
      let out = '';
      try {
        if (t === 'mean') {
          const n = V('ciN'), m = V('ciM'), s = V('ciS'), k = T('ciK');
          if ([n, m, s].some(isNaN) || n < 2) return;
          const se = s / Math.sqrt(n);
          const cv = k === 'z' ? S.normInv(1 - al / 2) : S.tInv(1 - al / 2, n - 1);
          const E = cv * se;
          out = row('ความคลาดเคลื่อนมาตรฐาน SE', f(se, 5)) +
            row('ค่าวิกฤต ' + (k === 'z' ? 'z' : 't(' + (n - 1) + ')'), f(cv, 5)) +
            row('ความคลาดเคลื่อน E', f(E, 5)) +
            row('<b>ช่วงความเชื่อมั่น ' + (lv * 100) + '%</b>',
              '<b style="color:var(--accent)">(' + f(m - E, 4) + ' , ' + f(m + E, 4) + ')</b>') +
            row('ความกว้างของช่วง', f(2 * E, 5));
        } else if (t === 'prop') {
          const n = V('ciN'), x = V('ciX');
          if ([n, x].some(isNaN) || n < 1) return;
          const ph = x / n, se = Math.sqrt(ph * (1 - ph) / n), z = S.normInv(1 - al / 2), E = z * se;
          const ok = n * ph >= 5 && n * (1 - ph) >= 5;
          out = row('p̂ = x/n', f(ph, 5)) + row('SE', f(se, 5)) + row('z', f(z, 4)) + row('E', f(E, 5)) +
            row('<b>ช่วงความเชื่อมั่น ' + (lv * 100) + '%</b>',
              '<b style="color:var(--accent)">(' + f(Math.max(0, ph - E), 4) + ' , ' + f(Math.min(1, ph + E), 4) + ')</b>') +
            row('เงื่อนไข np̂ ≥ 5 และ n(1−p̂) ≥ 5', ok ? '<span style="color:var(--ok)">ผ่าน</span>' : '<span style="color:var(--danger)">ไม่ผ่าน</span>');
        } else if (t === 'var') {
          const n = V('ciN'), s = V('ciS');
          if ([n, s].some(isNaN) || n < 2) return;
          const df = n - 1, ss = (df) * s * s;
          const cu = S.chiInv(1 - al / 2, df), cl = S.chiInv(al / 2, df);
          const lo = ss / cu, hi = ss / cl;
          out = row('df', df) + row('(n−1)S²', f(ss, 5)) +
            row('χ²<sub>α/2</sub> (บน)', f(cu, 4)) + row('χ²<sub>1−α/2</sub> (ล่าง)', f(cl, 4)) +
            row('<b>ช่วงของ σ²</b>', '<b style="color:var(--accent)">(' + f(lo, 4) + ' , ' + f(hi, 4) + ')</b>') +
            row('<b>ช่วงของ σ</b>', '<b>(' + f(Math.sqrt(lo), 4) + ' , ' + f(Math.sqrt(hi), 4) + ')</b>');
        } else {
          const n1 = V('ciN1'), m1 = V('ciM1'), s1 = V('ciS1'), n2 = V('ciN2'), m2 = V('ciM2'), s2 = V('ciS2');
          if ([n1, m1, s1, n2, m2, s2].some(isNaN)) return;
          const sp2 = ((n1 - 1) * s1 * s1 + (n2 - 1) * s2 * s2) / (n1 + n2 - 2);
          const se = Math.sqrt(sp2 * (1 / n1 + 1 / n2));
          const df = n1 + n2 - 2, cv = S.tInv(1 - al / 2, df), E = cv * se, d = m1 - m2;
          const cross = (d - E) * (d + E) < 0;
          out = row('S²ร่วม (pooled)', f(sp2, 5)) + row('SE', f(se, 5)) +
            row('t(' + df + ')', f(cv, 4)) + row('ผลต่าง x̄₁ − x̄₂', f(d, 4)) +
            row('<b>ช่วงความเชื่อมั่น ' + (lv * 100) + '%</b>',
              '<b style="color:var(--accent)">(' + f(d - E, 4) + ' , ' + f(d + E, 4) + ')</b>') +
            row('ช่วงคร่อมศูนย์หรือไม่', cross ?
              '<span style="color:var(--warn)">คร่อม → ยังสรุปไม่ได้ว่าต่างกัน</span>' :
              '<span style="color:var(--ok)">ไม่คร่อม → ต่างกันอย่างมีนัยสำคัญ</span>');
        }
      } catch (e) { out = '<div style="color:var(--danger)">ข้อมูลไม่ถูกต้อง</div>'; }
      $('ciOut').innerHTML = '<div class="result">' + out + '</div>';
    }
    wireSeg('ciT', build);
    build();
  }
};

/* ---------- 9. ขนาดตัวอย่าง ---------- */
TOOLS.n = {
  name: 'คำนวณขนาดตัวอย่าง', icon: '👥', cat: 'บทที่ 4',
  desc: 'หาว่าต้องเก็บข้อมูลกี่ตัว จึงได้ความแม่นยำตามต้องการ',
  render(el) {
    el.innerHTML =
      '<div class="card">' +
      '<div class="field"><label>ต้องการประมาณ</label>' +
      segment('snT', [['mean', 'ค่าเฉลี่ย μ'], ['prop', 'สัดส่วน p']], 'prop') + '</div>' +
      '<div class="grid g3">' +
      sel('snL', 'ระดับความเชื่อมั่น', [['0.90', '90%'], ['0.95', '95%'], ['0.99', '99%']], '0.95') +
      num('snE', 'ความคลาดเคลื่อนที่ยอมรับได้ E', 0.03, 0.001) +
      '<div id="snX"></div></div>' +
      '<div id="snOut"></div></div>' +
      '<div class="card"><div class="card-t">ตารางเปรียบเทียบ</div><div id="snTab"></div></div>';

    function build() {
      const t = segVal('snT');
      $('snX').innerHTML = t === 'mean'
        ? num('snS', 'σ — ส่วนเบี่ยงเบนที่คาดไว้', 10, 0.1)
        : num('snP', 'p ที่คาดไว้ (ไม่ทราบใช้ 0.5)', 0.5, 0.01, 'min="0" max="1"');
      if (t === 'mean' && V('snE') < 1) $('snE').value = 2;
      if (t === 'prop' && V('snE') > 0.5) $('snE').value = 0.03;
      bindAll(['snL', 'snE', 'snS', 'snP'], go);
      go();
    }
    function calc(t, lv, E, x) {
      const z = S.normInv(1 - (1 - lv) / 2);
      return t === 'mean' ? Math.pow(z * x / E, 2) : z * z * x * (1 - x) / (E * E);
    }
    function go() {
      const t = segVal('snT'), lv = parseFloat(T('snL')), E = V('snE');
      const x = t === 'mean' ? V('snS') : V('snP');
      if ([lv, E, x].some(isNaN) || E <= 0) return;
      const z = S.normInv(1 - (1 - lv) / 2), raw = calc(t, lv, E, x);
      $('snOut').innerHTML = '<div class="result">' +
        row('ค่าวิกฤต z', f(z, 4)) +
        row('n ที่คำนวณได้', f(raw, 2)) +
        row('<b>ขนาดตัวอย่างที่ต้องใช้ (ปัดขึ้น)</b>',
          '<b style="color:var(--accent);font-size:17px">' + Math.ceil(raw).toLocaleString() + '</b>') +
        '</div>';
      const Es = t === 'mean' ? [1, 2, 3, 5] : [0.01, 0.02, 0.03, 0.05];
      $('snTab').innerHTML = '<div class="tbl-wrap"><table class="tbl-mini"><thead><tr><th>E</th>' +
        ['0.90', '0.95', '0.99'].map(l => '<th class="num">' + (parseFloat(l) * 100) + '%</th>').join('') +
        '</tr></thead><tbody>' +
        Es.map(e => '<tr><td class="num"><b>' + e + '</b></td>' +
          ['0.90', '0.95', '0.99'].map(l => '<td class="num">' + Math.ceil(calc(t, parseFloat(l), e, x)).toLocaleString() + '</td>').join('') +
          '</tr>').join('') + '</tbody></table></div>' +
        '<p style="font-size:13px;color:var(--text-3);margin:9px 0 0">สังเกตว่าการลด E ครึ่งหนึ่ง ทำให้ n เพิ่มขึ้น 4 เท่า</p>';
    }
    wireSeg('snT', build);
    build();
  }
};

/* ---------- 10. ตัวช่วยทดสอบสมมติฐาน ---------- */
TOOLS.ttest = {
  name: 'ทดสอบสมมติฐาน', icon: '⚖️', cat: 'บทที่ 5',
  desc: 'Z-test, t-test กลุ่มเดียว สองกลุ่ม ข้อมูลคู่ สัดส่วน และความแปรปรวน',
  render(el) {
    el.innerHTML =
      '<div class="card">' +
      sel('htT', 'เลือกการทดสอบ', [
        ['z1', 'Z-test ค่าเฉลี่ยกลุ่มเดียว (ทราบ σ)'],
        ['t1', 't-test ค่าเฉลี่ยกลุ่มเดียว (ไม่ทราบ σ)'],
        ['t2', 't-test สองกลุ่มอิสระ'],
        ['tp', 't-test ข้อมูลคู่ (paired)'],
        ['p1', 'Z-test สัดส่วนกลุ่มเดียว'],
        ['p2', 'Z-test สัดส่วนสองกลุ่ม'],
        ['v1', 'Chi-square ความแปรปรวนกลุ่มเดียว'],
        ['v2', 'F-test ความแปรปรวนสองกลุ่ม']
      ], 't1') +
      '<div id="htPar"></div>' +
      '<div class="grid g2">' +
      '<div class="field"><label>รูปแบบสมมติฐาน H₁</label>' +
      segment('htTail', [['two', '≠ (สองหาง)'], ['right', '> (หางขวา)'], ['left', '< (หางซ้าย)']], 'two') + '</div>' +
      sel('htA', 'ระดับนัยสำคัญ α', [['0.10', '0.10'], ['0.05', '0.05'], ['0.01', '0.01']], '0.05') +
      '</div><div id="htOut"></div></div>' +
      '<div class="card"><div class="card-t">กราฟเขตวิกฤต</div><canvas id="htCv"></canvas></div>';

    const FORM = {
      z1: () => '<div class="grid g4">' + num('h_n', 'n', 36, 1) + num('h_m', 'x̄', 495, 0.1) + num('h_s', 'σ (ทราบ)', 20, 0.1) + num('h_0', 'μ₀', 500, 0.1) + '</div>',
      t1: () => '<div class="grid g4">' + num('h_n', 'n', 25, 1) + num('h_m', 'x̄', 970, 0.1) + num('h_s', 'S', 80, 0.1) + num('h_0', 'μ₀', 1000, 0.1) + '</div>' +
        ta('h_raw', 'หรือวางข้อมูลดิบ (ถ้ามี ระบบจะใช้ข้อมูลนี้แทน)', '', 'เช่น 12 15 18 20'),
      t2: () => '<div class="grid g3">' + num('h_n1', 'n₁', 20, 1) + num('h_m1', 'x̄₁', 48.2, 0.1) + num('h_s1', 'S₁', 5.1, 0.1) +
        num('h_n2', 'n₂', 22, 1) + num('h_m2', 'x̄₂', 44.6, 0.1) + num('h_s2', 'S₂', 4.8, 0.1) + '</div>' +
        sel('h_eq', 'สมมติความแปรปรวน', [['y', 'เท่ากัน (pooled)'], ['n', 'ไม่เท่ากัน (Welch)']], 'y'),
      tp: () => ta('h_x', 'ข้อมูลชุดที่ 1 (ก่อน)', '68 72 65 80 75 70 78 66 74 71') +
        ta('h_y', 'ข้อมูลชุดที่ 2 (หลัง)', '72 75 70 83 79 74 80 69 78 76'),
      p1: () => '<div class="grid g3">' + num('h_n', 'n', 400, 1) + num('h_x', 'x (จำนวนสำเร็จ)', 232, 1) + num('h_0', 'p₀', 0.55, 0.01) + '</div>',
      p2: () => '<div class="grid g4">' + num('h_n1', 'n₁', 200, 1) + num('h_x1', 'x₁', 120, 1) + num('h_n2', 'n₂', 250, 1) + num('h_x2', 'x₂', 130, 1) + '</div>',
      v1: () => '<div class="grid g3">' + num('h_n', 'n', 20, 1) + num('h_s', 'S', 4.5, 0.1) + num('h_0', 'σ₀', 4, 0.1) + '</div>',
      v2: () => '<div class="grid g4">' + num('h_n1', 'n₁', 16, 1) + num('h_s1', 'S₁', 6.2, 0.1) + num('h_n2', 'n₂', 21, 1) + num('h_s2', 'S₂', 4.1, 0.1) + '</div>'
    };

    function build() {
      const t = T('htT');
      $('htPar').innerHTML = FORM[t]();
      bindAll(['h_n', 'h_m', 'h_s', 'h_0', 'h_raw', 'h_n1', 'h_m1', 'h_s1', 'h_n2', 'h_m2', 'h_s2',
        'h_eq', 'h_x', 'h_y', 'h_x1', 'h_x2', 'htA'], go);
      go();
    }

    function go() {
      const t = T('htT'), tail = segVal('htTail') || 'two', al = parseFloat(T('htA'));
      let stat, df, p, crit, label, extra = '', dist = 't', h0txt = '', h1txt = '';
      try {
        if (t === 'z1') {
          const n = V('h_n'), m = V('h_m'), s = V('h_s'), m0 = V('h_0');
          if ([n, m, s, m0].some(isNaN)) return;
          const se = s / Math.sqrt(n);
          stat = (m - m0) / se; dist = 'z'; p = S.pFromZ(stat, tail);
          crit = tail === 'two' ? S.normInv(1 - al / 2) : S.normInv(1 - al);
          label = 'Z'; h0txt = 'μ = ' + m0; h1txt = 'μ ' + sym(tail) + ' ' + m0;
          extra = row('SE = σ/√n', f(se, 5));
        } else if (t === 't1') {
          let n = V('h_n'), m = V('h_m'), s = V('h_s');
          const raw = S.parse(T('h_raw') || '');
          if (raw.length >= 2) { n = raw.length; m = S.mean(raw); s = S.sd(raw); }
          const m0 = V('h_0');
          if ([n, m, s, m0].some(isNaN) || n < 2) return;
          const se = s / Math.sqrt(n);
          stat = (m - m0) / se; df = n - 1; p = S.pFromT(stat, df, tail);
          crit = tail === 'two' ? S.tInv(1 - al / 2, df) : S.tInv(1 - al, df);
          label = 't'; h0txt = 'μ = ' + m0; h1txt = 'μ ' + sym(tail) + ' ' + m0;
          extra = (raw.length >= 2 ? row('จากข้อมูลดิบ: n, x̄, S', n + ', ' + f(m, 4) + ', ' + f(s, 4)) : '') +
            row('SE = S/√n', f(se, 5)) + row('df', df);
        } else if (t === 't2') {
          const n1 = V('h_n1'), m1 = V('h_m1'), s1 = V('h_s1'), n2 = V('h_n2'), m2 = V('h_m2'), s2 = V('h_s2');
          if ([n1, m1, s1, n2, m2, s2].some(isNaN)) return;
          let se;
          if (T('h_eq') === 'y') {
            const sp2 = ((n1 - 1) * s1 * s1 + (n2 - 1) * s2 * s2) / (n1 + n2 - 2);
            se = Math.sqrt(sp2 * (1 / n1 + 1 / n2)); df = n1 + n2 - 2;
            extra = row('S²ร่วม', f(sp2, 5));
          } else {
            const a1 = s1 * s1 / n1, a2 = s2 * s2 / n2;
            se = Math.sqrt(a1 + a2);
            df = Math.pow(a1 + a2, 2) / (a1 * a1 / (n1 - 1) + a2 * a2 / (n2 - 1));
            extra = row('df (Welch)', f(df, 3));
          }
          stat = (m1 - m2) / se; p = S.pFromT(stat, df, tail);
          crit = tail === 'two' ? S.tInv(1 - al / 2, df) : S.tInv(1 - al, df);
          label = 't'; h0txt = 'μ₁ = μ₂'; h1txt = 'μ₁ ' + sym(tail) + ' μ₂';
          extra += row('ผลต่าง x̄₁ − x̄₂', f(m1 - m2, 4)) + row('SE', f(se, 5)) + row('df', f(df, 3));
        } else if (t === 'tp') {
          const x = S.parse(T('h_x')), y = S.parse(T('h_y'));
          if (x.length < 2 || x.length !== y.length) {
            $('htOut').innerHTML = '<div class="result empty">ข้อมูลสองชุดต้องมีจำนวนเท่ากันและอย่างน้อย 2 คู่</div>'; return;
          }
          const d = x.map((v, i) => v - y[i]);
          const n = d.length, md = S.mean(d), sd = S.sd(d), se = sd / Math.sqrt(n);
          stat = md / se; df = n - 1; p = S.pFromT(stat, df, tail);
          crit = tail === 'two' ? S.tInv(1 - al / 2, df) : S.tInv(1 - al, df);
          label = 't'; h0txt = 'μ_d = 0'; h1txt = 'μ_d ' + sym(tail) + ' 0';
          extra = row('จำนวนคู่ n', n) + row('ผลต่างเฉลี่ย d̄', f(md, 5)) +
            row('S_d', f(sd, 5)) + row('SE', f(se, 5)) + row('df', df);
        } else if (t === 'p1') {
          const n = V('h_n'), x = V('h_x'), p0 = V('h_0');
          if ([n, x, p0].some(isNaN)) return;
          const ph = x / n, se = Math.sqrt(p0 * (1 - p0) / n);
          stat = (ph - p0) / se; dist = 'z'; p = S.pFromZ(stat, tail);
          crit = tail === 'two' ? S.normInv(1 - al / 2) : S.normInv(1 - al);
          label = 'Z'; h0txt = 'p = ' + p0; h1txt = 'p ' + sym(tail) + ' ' + p0;
          extra = row('p̂', f(ph, 5)) + row('SE (ใช้ p₀)', f(se, 5)) +
            row('เงื่อนไข np₀ ≥ 5, n(1−p₀) ≥ 5', (n * p0 >= 5 && n * (1 - p0) >= 5) ?
              '<span style="color:var(--ok)">ผ่าน</span>' : '<span style="color:var(--danger)">ไม่ผ่าน</span>');
        } else if (t === 'p2') {
          const n1 = V('h_n1'), x1 = V('h_x1'), n2 = V('h_n2'), x2 = V('h_x2');
          if ([n1, x1, n2, x2].some(isNaN)) return;
          const p1 = x1 / n1, p2v = x2 / n2, pp = (x1 + x2) / (n1 + n2);
          const se = Math.sqrt(pp * (1 - pp) * (1 / n1 + 1 / n2));
          stat = (p1 - p2v) / se; dist = 'z'; p = S.pFromZ(stat, tail);
          crit = tail === 'two' ? S.normInv(1 - al / 2) : S.normInv(1 - al);
          label = 'Z'; h0txt = 'p₁ = p₂'; h1txt = 'p₁ ' + sym(tail) + ' p₂';
          extra = row('p̂₁', f(p1, 5)) + row('p̂₂', f(p2v, 5)) + row('p̂ ร่วม (pooled)', f(pp, 5)) + row('SE', f(se, 5));
        } else if (t === 'v1') {
          const n = V('h_n'), s = V('h_s'), s0 = V('h_0');
          if ([n, s, s0].some(isNaN) || n < 2) return;
          df = n - 1; stat = df * s * s / (s0 * s0); dist = 'chi';
          p = S.pFromChi(stat, df, tail);
          crit = tail === 'left' ? S.chiInv(al, df) : (tail === 'two' ? S.chiInv(1 - al / 2, df) : S.chiInv(1 - al, df));
          label = 'χ²'; h0txt = 'σ² = ' + f(s0 * s0, 3); h1txt = 'σ² ' + sym(tail) + ' ' + f(s0 * s0, 3);
          extra = row('df', df) + row('S²', f(s * s, 5)) + row('σ₀²', f(s0 * s0, 5)) +
            (tail === 'two' ? row('เขตวิกฤตล่าง / บน', f(S.chiInv(al / 2, df), 4) + ' / ' + f(S.chiInv(1 - al / 2, df), 4)) : '');
        } else {
          const n1 = V('h_n1'), s1 = V('h_s1'), n2 = V('h_n2'), s2 = V('h_s2');
          if ([n1, s1, n2, s2].some(isNaN)) return;
          stat = (s1 * s1) / (s2 * s2); dist = 'f';
          const d1 = n1 - 1, d2 = n2 - 1; df = [d1, d2];
          p = S.pFromF(stat, d1, d2, tail);
          crit = tail === 'left' ? S.fInv(al, d1, d2) : (tail === 'two' ? S.fInv(1 - al / 2, d1, d2) : S.fInv(1 - al, d1, d2));
          label = 'F'; h0txt = 'σ₁² = σ₂²'; h1txt = 'σ₁² ' + sym(tail) + ' σ₂²';
          extra = row('df₁, df₂', d1 + ', ' + d2) + row('S₁²', f(s1 * s1, 5)) + row('S₂²', f(s2 * s2, 5));
        }
      } catch (e) { return; }

      const rej = p <= al;
      $('htOut').innerHTML = '<div class="result">' +
        row('H₀', h0txt) + row('H₁', h1txt + ' <small style="color:var(--text-3)">(' + tailName(tail) + ')</small>') +
        extra +
        row('<b>ค่าสถิติทดสอบ ' + label + '</b>', '<b>' + f(stat, 5) + '</b>') +
        row('ค่าวิกฤต', (tail === 'left' && dist !== 'chi' && dist !== 'f' ? '−' : '') + f(crit, 5)) +
        row('<b>p-value</b>', '<b style="color:' + (rej ? 'var(--danger)' : 'var(--ok)') + '">' + fp(p) + '</b>') +
        row('α', al) +
        verdict(rej, rej
          ? 'p-value ≤ α จึงมีหลักฐานเพียงพอที่จะสรุปว่า ' + h1txt
          : 'p-value > α หลักฐานไม่เพียงพอที่จะสรุปว่า ' + h1txt) +
        '</div>';

      drawCrit(dist, stat, df, al, tail);
    }

    function sym(t) { return t === 'two' ? '≠' : (t === 'right' ? '>' : '<'); }

    function drawCrit(dist, stat, df, al, tail) {
      const cv = $('htCv'); if (!cv) return;
      let pdf, lo, hi;
      if (dist === 'z') { pdf = x => S.normPdf(x, 0, 1); lo = -4.2; hi = 4.2; }
      else if (dist === 't') { const d = Array.isArray(df) ? df[0] : (df || 20); pdf = x => S.tPdf(x, d); lo = -4.5; hi = 4.5; }
      else if (dist === 'chi') { const d = df || 10; pdf = x => S.chiPdf(x, d); lo = 0; hi = Math.max(S.chiInv(0.999, d), stat * 1.25); }
      else { const d = df || [3, 20]; pdf = x => S.fPdf(x, d[0], d[1]); lo = 0; hi = Math.max(S.fInv(0.999, d[0], d[1]), stat * 1.25); }

      let ymax = 0;
      for (let i = 1; i <= 300; i++) ymax = Math.max(ymax, pdf(lo + (hi - lo) * i / 300));
      const pl = Plot(cv, { h: 250 });
      pl.domain(lo, hi, 0, ymax * 1.18).axes(dist === 'z' ? 'Z' : (dist === 't' ? 't' : (dist === 'chi' ? 'χ²' : 'F')));

      const sym2 = (dist === 'z' || dist === 't');
      if (tail === 'two') {
        if (sym2) {
          const c = dist === 'z' ? S.normInv(1 - al / 2) : S.tInv(1 - al / 2, Array.isArray(df) ? df[0] : df);
          pl.curve(pdf, css('--accent'), css('--danger-soft'), lo, -c);
          pl.curve(pdf, css('--accent'), css('--danger-soft'), c, hi);
          pl.vline(-c, css('--danger')); pl.vline(c, css('--danger'), 'เขตวิกฤต');
        } else {
          const d = dist === 'chi' ? df : df;
          const cl = dist === 'chi' ? S.chiInv(al / 2, d) : S.fInv(al / 2, d[0], d[1]);
          const cu = dist === 'chi' ? S.chiInv(1 - al / 2, d) : S.fInv(1 - al / 2, d[0], d[1]);
          pl.curve(pdf, css('--accent'), css('--danger-soft'), lo, cl);
          pl.curve(pdf, css('--accent'), css('--danger-soft'), cu, hi);
          pl.vline(cl, css('--danger')); pl.vline(cu, css('--danger'), 'เขตวิกฤต');
        }
      } else if (tail === 'right') {
        const c = dist === 'z' ? S.normInv(1 - al) : dist === 't' ? S.tInv(1 - al, Array.isArray(df) ? df[0] : df) :
          dist === 'chi' ? S.chiInv(1 - al, df) : S.fInv(1 - al, df[0], df[1]);
        pl.curve(pdf, css('--accent'), css('--danger-soft'), c, hi);
        pl.vline(c, css('--danger'), 'เขตวิกฤต');
      } else {
        const c = dist === 'z' ? -S.normInv(1 - al) : dist === 't' ? -S.tInv(1 - al, Array.isArray(df) ? df[0] : df) :
          dist === 'chi' ? S.chiInv(al, df) : S.fInv(al, df[0], df[1]);
        pl.curve(pdf, css('--accent'), css('--danger-soft'), lo, c);
        pl.vline(c, css('--danger'), 'เขตวิกฤต');
      }
      if (stat >= lo && stat <= hi) pl.vline(stat, css('--violet'), 'สถิติ = ' + f(stat, 3));
    }

    $('htT').onchange = build;
    wireSeg('htTail', go);
    build();
  }
};

/* ---------- 11. ANOVA ---------- */
TOOLS.anova = {
  name: 'การวิเคราะห์ความแปรปรวน', icon: '📶', cat: 'บทที่ 5',
  desc: 'One-way ANOVA พร้อมการเปรียบเทียบพหุคูณด้วย LSD',
  render(el) {
    el.innerHTML =
      '<div class="card"><div class="card-t">ใส่ข้อมูล — หนึ่งกลุ่มต่อหนึ่งบรรทัด</div>' +
      ta('avD', 'แต่ละบรรทัดคือหนึ่งกลุ่ม ค่าคั่นด้วยเว้นวรรคหรือจุลภาค',
        '85 88 90 87 92\n78 82 80 79 83\n91 94 89 93 95',
        'กลุ่ม 1: 85 88 90\nกลุ่ม 2: 78 82 80') +
      sel('avA', 'ระดับนัยสำคัญ α', [['0.10', '0.10'], ['0.05', '0.05'], ['0.01', '0.01']], '0.05') +
      '</div><div id="avOut"></div>';

    function go() {
      const lines = T('avD').split('\n').map(l => S.parse(l)).filter(a => a.length >= 2);
      const o = $('avOut');
      if (lines.length < 2) { o.innerHTML = '<div class="result empty">ต้องมีอย่างน้อย 2 กลุ่ม กลุ่มละ 2 ค่าขึ้นไป</div>'; return; }
      const al = parseFloat(T('avA'));
      const a = S.anova1(lines);
      const fc = S.fInv(1 - al, a.dfb, a.dfw);
      const rej = a.p <= al;

      let h = '<div class="card"><div class="card-t">สถิติรายกลุ่ม</div><div class="tbl-wrap"><table class="tbl-mini">' +
        '<thead><tr><th>กลุ่ม</th><th class="num">n</th><th class="num">ค่าเฉลี่ย</th><th class="num">S</th><th class="num">SS ภายใน</th></tr></thead><tbody>' +
        a.detail.map((d, i) => '<tr><td>กลุ่มที่ ' + (i + 1) + '</td><td class="num">' + d.n + '</td><td class="num">' +
          f(d.mean, 4) + '</td><td class="num">' + f(d.sd, 4) + '</td><td class="num">' + f(d.ss, 4) + '</td></tr>').join('') +
        '<tr style="background:var(--surface-2)"><td><b>รวม</b></td><td class="num"><b>' + a.N + '</b></td><td class="num"><b>' +
        f(a.grand, 4) + '</b></td><td class="num">—</td><td class="num">—</td></tr>' +
        '</tbody></table></div></div>';

      h += '<div class="card"><div class="card-t">ตาราง ANOVA</div><div class="tbl-wrap"><table class="tbl-tight">' +
        '<thead><tr><th>แหล่งความแปรผัน</th><th class="num">SS</th><th class="num">df</th><th class="num">MS</th><th class="num">F</th><th class="num">p-value</th></tr></thead><tbody>' +
        '<tr><td>ระหว่างกลุ่ม</td><td class="num">' + f(a.ssb, 4) + '</td><td class="num">' + a.dfb + '</td><td class="num">' +
        f(a.msb, 4) + '</td><td class="num"><b>' + f(a.F, 4) + '</b></td><td class="num"><b style="color:' +
        (rej ? 'var(--danger)' : 'var(--ok)') + '">' + fp(a.p) + '</b></td></tr>' +
        '<tr><td>ภายในกลุ่ม (Error)</td><td class="num">' + f(a.ssw, 4) + '</td><td class="num">' + a.dfw + '</td><td class="num">' +
        f(a.msw, 4) + '</td><td class="num">—</td><td class="num">—</td></tr>' +
        '<tr style="background:var(--surface-2)"><td><b>รวม</b></td><td class="num"><b>' + f(a.sst, 4) + '</b></td><td class="num"><b>' +
        a.dft + '</b></td><td class="num">—</td><td class="num">—</td><td class="num">—</td></tr>' +
        '</tbody></table></div>' +
        '<div class="result" style="margin-top:12px">' +
        row('ค่าวิกฤต F<sub>' + al + '</sub>(' + a.dfb + ', ' + a.dfw + ')', f(fc, 4)) +
        row('η² (สัดส่วนความแปรผันที่อธิบายได้)', f(a.eta2, 4) + ' = ' + f(a.eta2 * 100, 1) + '%') +
        verdict(rej, rej
          ? 'มีค่าเฉลี่ยอย่างน้อยหนึ่งคู่ที่แตกต่างกันอย่างมีนัยสำคัญ'
          : 'หลักฐานไม่เพียงพอที่จะสรุปว่าค่าเฉลี่ยของกลุ่มต่างกัน') +
        '</div></div>';

      if (rej) {
        const l = S.lsd(a, al);
        h += '<div class="card"><div class="card-t">การเปรียบเทียบพหุคูณ (LSD)</div><div class="tbl-wrap"><table class="tbl-mini">' +
          '<thead><tr><th>คู่เปรียบเทียบ</th><th class="num">ผลต่างค่าเฉลี่ย</th><th class="num">LSD</th><th>ผลสรุป</th></tr></thead><tbody>' +
          l.map(x => '<tr><td>กลุ่ม ' + x.i + ' กับ ' + x.j + '</td><td class="num">' + f(x.diff, 4) + '</td><td class="num">' +
            f(x.lsd, 4) + '</td><td>' + (x.sig ?
              '<span style="color:var(--danger);font-weight:600">แตกต่าง *</span>' :
              '<span style="color:var(--text-3)">ไม่แตกต่าง</span>') + '</td></tr>').join('') +
          '</tbody></table></div><p style="font-size:12.5px;color:var(--text-3);margin:9px 0 0">* แตกต่างอย่างมีนัยสำคัญที่ α = ' + al + '</p></div>';
      }

      h += '<div class="card"><div class="card-t">ค่าเฉลี่ยรายกลุ่ม</div><canvas id="avCv"></canvas></div>';
      o.innerHTML = h;

      // กราฟแท่งค่าเฉลี่ย ± 1 SD
      const cv = $('avCv'), pl = Plot(cv, { h: 240 });
      const mx = Math.max.apply(null, a.detail.map(d => d.mean + d.sd));
      const mn = Math.min.apply(null, a.detail.map(d => d.mean - d.sd));
      const pad0 = (mx - mn) * 0.15;
      pl.domain(0.4, a.k + 0.6, Math.max(0, mn - pad0), mx + pad0).axes('กลุ่ม', '', a.k);
      const c = pl.c, bw = pl.iw / a.k * 0.5;
      a.detail.forEach((d, i) => {
        const x = pl.X(i + 1), y = pl.Y(d.mean), y0 = pl.Y(pl.ymin);
        c.fillStyle = css('--accent'); c.fillRect(x - bw / 2, y, bw, y0 - y);
        c.strokeStyle = css('--text'); c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(x, pl.Y(d.mean - d.sd)); c.lineTo(x, pl.Y(d.mean + d.sd));
        c.moveTo(x - 7, pl.Y(d.mean - d.sd)); c.lineTo(x + 7, pl.Y(d.mean - d.sd));
        c.moveTo(x - 7, pl.Y(d.mean + d.sd)); c.lineTo(x + 7, pl.Y(d.mean + d.sd));
        c.stroke();
      });
      c.strokeStyle = css('--danger'); c.setLineDash([5, 4]); c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(pl.pad.l, pl.Y(a.grand)); c.lineTo(pl.w - pl.pad.r, pl.Y(a.grand)); c.stroke();
      c.setLineDash([]);
    }
    bindAll(['avD', 'avA'], go);
  }
};

/* ---------- 12. ไคกำลังสอง ---------- */
TOOLS.chi = {
  name: 'การทดสอบไคกำลังสอง', icon: '⊞', cat: 'บทที่ 5',
  desc: 'ทดสอบความเป็นอิสระ และภาวะสารูปสนิทดี',
  render(el) {
    el.innerHTML =
      '<div class="card">' +
      '<div class="field"><label>ชนิดการทดสอบ</label>' +
      segment('xcT', [['ind', 'ความเป็นอิสระ (ตารางการณ์จร)'], ['gof', 'ภาวะสารูปสนิทดี']], 'ind') + '</div>' +
      '<div id="xcPar"></div>' +
      sel('xcA', 'ระดับนัยสำคัญ α', [['0.10', '0.10'], ['0.05', '0.05'], ['0.01', '0.01']], '0.05') +
      '</div><div id="xcOut"></div>';

    function build() {
      $('xcPar').innerHTML = segVal('xcT') === 'ind'
        ? ta('xcD', 'ตารางความถี่ — หนึ่งแถวต่อหนึ่งบรรทัด', '45 35 20\n30 40 30', '45 35 20\n30 40 30')
        : ta('xcD', 'ความถี่ที่สังเกตได้ (บรรทัดที่ 1) และความถี่คาดหวังหรือสัดส่วน (บรรทัดที่ 2 — เว้นว่างได้)',
          '30 25 20 25\n', '30 25 20 25');
      bindAll(['xcD', 'xcA'], go);
      go();
    }

    function go() {
      const t = segVal('xcT'), al = parseFloat(T('xcA')), o = $('xcOut');
      const lines = T('xcD').split('\n').map(l => S.parse(l)).filter(a => a.length);
      if (!lines.length) { o.innerHTML = '<div class="result empty">กรุณาใส่ข้อมูล</div>'; return; }

      if (t === 'ind') {
        if (lines.length < 2 || !lines.every(l => l.length === lines[0].length) || lines[0].length < 2) {
          o.innerHTML = '<div class="result empty">ต้องมีอย่างน้อย 2 แถว 2 คอลัมน์ และทุกแถวมีจำนวนคอลัมน์เท่ากัน</div>'; return;
        }
        const r = S.chiIndep(lines);
        const cvv = S.chiInv(1 - al, r.df), rej = r.p <= al;
        let h = '<div class="card"><div class="card-t">ความถี่ที่สังเกตได้ (O) และคาดหวัง (E)</div><div class="tbl-wrap"><table class="tbl-mini"><thead><tr><th></th>' +
          lines[0].map((_, j) => '<th class="num">คอลัมน์ ' + (j + 1) + '</th>').join('') + '<th class="num">รวม</th></tr></thead><tbody>';
        lines.forEach((rw, i) => {
          h += '<tr><td><b>แถว ' + (i + 1) + '</b></td>' + rw.map((v, j) =>
            '<td class="num">' + v + '<br><small style="color:' + (r.exp[i][j] < 5 ? 'var(--danger)' : 'var(--text-3)') + '">(' +
            f(r.exp[i][j], 2) + ')</small></td>').join('') + '<td class="num">' + r.rowT[i] + '</td></tr>';
        });
        h += '<tr style="background:var(--surface-2)"><td><b>รวม</b></td>' + r.colT.map(v => '<td class="num"><b>' + v + '</b></td>').join('') +
          '<td class="num"><b>' + r.n + '</b></td></tr></tbody></table></div>' +
          '<p style="font-size:12.5px;color:var(--text-3);margin:9px 0 0">ตัวเลขในวงเล็บคือความถี่คาดหวัง E = (ผลรวมแถว × ผลรวมคอลัมน์) / n</p></div>';

        h += '<div class="card"><div class="result">' +
          row('H₀', 'ตัวแปรทั้งสองเป็นอิสระต่อกัน') +
          row('H₁', 'ตัวแปรทั้งสองมีความสัมพันธ์กัน') +
          row('ขนาดตาราง', lines.length + ' × ' + lines[0].length) +
          row('<b>χ²</b>', '<b>' + f(r.chi, 5) + '</b>') +
          row('df = (r−1)(c−1)', r.df) +
          row('ค่าวิกฤต χ²<sub>' + al + '</sub>', f(cvv, 4)) +
          row('<b>p-value</b>', '<b style="color:' + (rej ? 'var(--danger)' : 'var(--ok)') + '">' + fp(r.p) + '</b>') +
          row("Cramer's V (ความแรงของความสัมพันธ์)", f(r.cramerV, 4)) +
          row('ช่องที่ E < 5', r.lowCells + ' จาก ' + (lines.length * lines[0].length) +
            (r.lowCells > 0 ? ' <span style="color:var(--warn)">— ควรรวมช่องหรือใช้ Fisher Exact</span>' : ' <span style="color:var(--ok)">— ผ่านเงื่อนไข</span>')) +
          verdict(rej, rej ? 'ตัวแปรทั้งสองมีความสัมพันธ์กันอย่างมีนัยสำคัญ' : 'หลักฐานไม่เพียงพอที่จะสรุปว่าตัวแปรสัมพันธ์กัน') +
          '</div></div>';
        o.innerHTML = h;
      } else {
        const obs = lines[0];
        let exp = lines[1] && lines[1].length === obs.length ? lines[1] : null;
        if (obs.length < 2) { o.innerHTML = '<div class="result empty">ต้องมีอย่างน้อย 2 ประเภท</div>'; return; }
        const r = S.chiGof(obs, exp);
        const cvv = S.chiInv(1 - al, r.df), rej = r.p <= al;
        let h = '<div class="card"><div class="card-t">ตารางคำนวณ</div><div class="tbl-wrap"><table class="tbl-mini">' +
          '<thead><tr><th>ประเภท</th><th class="num">O</th><th class="num">E</th><th class="num">O−E</th><th class="num">(O−E)²/E</th></tr></thead><tbody>' +
          obs.map((v, i) => '<tr><td>ประเภท ' + (i + 1) + '</td><td class="num">' + v + '</td><td class="num">' +
            f(r.exp[i], 3) + '</td><td class="num">' + f(v - r.exp[i], 3) + '</td><td class="num">' +
            f(Math.pow(v - r.exp[i], 2) / r.exp[i], 4) + '</td></tr>').join('') +
          '<tr style="background:var(--surface-2)"><td><b>รวม</b></td><td class="num"><b>' + obs.reduce((a, b) => a + b, 0) +
          '</b></td><td class="num"><b>' + f(r.exp.reduce((a, b) => a + b, 0), 2) + '</b></td><td class="num">—</td><td class="num"><b>' +
          f(r.chi, 4) + '</b></td></tr></tbody></table></div></div>';
        h += '<div class="card"><div class="result">' +
          row('H₀', 'ข้อมูลเป็นไปตามสัดส่วนที่กำหนด') +
          row('<b>χ²</b>', '<b>' + f(r.chi, 5) + '</b>') +
          row('df = k − 1', r.df) +
          row('ค่าวิกฤต', f(cvv, 4)) +
          row('<b>p-value</b>', '<b style="color:' + (rej ? 'var(--danger)' : 'var(--ok)') + '">' + fp(r.p) + '</b>') +
          verdict(rej, rej ? 'ข้อมูลไม่เป็นไปตามสัดส่วนที่กำหนด' : 'ข้อมูลสอดคล้องกับสัดส่วนที่กำหนด') +
          '</div></div>';
        o.innerHTML = h;
      }
    }
    wireSeg('xcT', build);
    build();
  }
};

/* ---------- 13. สถิติไม่อิงพารามิเตอร์ ---------- */
TOOLS.nonpar = {
  name: 'สถิติไม่อิงพารามิเตอร์', icon: '🔗', cat: 'บทที่ 6',
  desc: 'Sign test, Wilcoxon, Mann–Whitney, Kruskal–Wallis และ Spearman',
  render(el) {
    el.innerHTML =
      '<div class="card">' +
      sel('npT', 'เลือกการทดสอบ', [
        ['sign', 'การทดสอบเครื่องหมาย (Sign test)'],
        ['wilcox', 'Wilcoxon Signed-Rank (ข้อมูลคู่)'],
        ['mw', 'Mann–Whitney U (สองกลุ่มอิสระ)'],
        ['kw', 'Kruskal–Wallis (สามกลุ่มขึ้นไป)'],
        ['sp', "Spearman's rho (สหสัมพันธ์อันดับ)"],
        ['runs', 'Runs Test (ความเป็นสุ่ม)']
      ], 'mw') +
      '<div id="npPar"></div>' +
      sel('npA', 'ระดับนัยสำคัญ α', [['0.10', '0.10'], ['0.05', '0.05'], ['0.01', '0.01']], '0.05') +
      '</div><div id="npOut"></div>';

    const F2 = {
      sign: () => ta('np1', 'ข้อมูลชุดที่ 1', '68 72 65 80 75 70 78 66 74 71') +
        ta('np2', 'ข้อมูลชุดที่ 2', '72 75 70 83 79 74 80 69 78 76'),
      wilcox: () => ta('np1', 'ข้อมูลชุดที่ 1', '68 72 65 80 75 70 78 66 74 71') +
        ta('np2', 'ข้อมูลชุดที่ 2', '72 75 70 83 79 74 80 69 78 76'),
      mw: () => ta('np1', 'กลุ่มที่ 1', '85 88 90 87 92 86 89') +
        ta('np2', 'กลุ่มที่ 2', '78 82 80 79 83 81 77'),
      kw: () => ta('np1', 'ข้อมูล — หนึ่งกลุ่มต่อหนึ่งบรรทัด', '85 88 90 87\n78 82 80 79\n91 94 89 93'),
      sp: () => ta('np1', 'ตัวแปร X', '12 15 18 20 22 25 28 30') +
        ta('np2', 'ตัวแปร Y', '20 24 25 30 33 35 40 42'),
      runs: () => ta('np1', 'ลำดับข้อมูล 0 และ 1', '1 1 0 1 0 0 1 1 1 0 1 0 0 1 0 1 1 0 0 1')
    };

    function build() {
      $('npPar').innerHTML = F2[T('npT')]();
      bindAll(['np1', 'np2', 'npA'], go);
      go();
    }

    function go() {
      const t = T('npT'), al = parseFloat(T('npA')), o = $('npOut');
      const a1 = S.parse(T('np1') || '');
      const a2 = $('np2') ? S.parse(T('np2')) : [];
      let h = '';
      try {
        if (t === 'sign') {
          if (a1.length < 2 || a1.length !== a2.length) throw 0;
          const d = a1.map((v, i) => v - a2[i]);
          const plus = d.filter(v => v > 0).length, minus = d.filter(v => v < 0).length;
          const zero = d.filter(v => v === 0).length;
          const r = S.signTest(plus, minus, 'two');
          const rej = r.p <= al;
          h = '<div class="card"><div class="result">' +
            row('จำนวนคู่ทั้งหมด', d.length) + row('ผลต่างเป็นศูนย์ (ตัดทิ้ง)', zero) +
            row('n ที่ใช้', r.n) + row('เครื่องหมายบวก', plus) + row('เครื่องหมายลบ', minus) +
            row('<b>p-value (แบบแม่นตรง จาก Binomial)</b>', '<b style="color:' + (rej ? 'var(--danger)' : 'var(--ok)') + '">' + fp(r.p) + '</b>') +
            row('Z (การประมาณด้วยปรกติ)', f(r.z, 4)) +
            verdict(rej, rej ? 'ค่ามัธยฐานของผลต่างแตกต่างจากศูนย์อย่างมีนัยสำคัญ' : 'หลักฐานไม่เพียงพอที่จะสรุปว่ามัธยฐานของผลต่างต่างจากศูนย์') +
            '</div></div>';
        } else if (t === 'wilcox') {
          if (a1.length < 2 || a1.length !== a2.length) throw 0;
          const d = a1.map((v, i) => v - a2[i]);
          const r = S.wilcoxonSigned(d);
          const rej = r.p <= al;
          h = '<div class="card"><div class="result">' +
            row('n (ไม่นับผลต่างศูนย์)', r.n) +
            row('W⁺ (ผลรวมอันดับของผลต่างบวก)', f(r.wPlus, 2)) +
            row('W⁻ (ผลรวมอันดับของผลต่างลบ)', f(r.wMinus, 2)) +
            row('<b>W = min(W⁺, W⁻)</b>', '<b>' + f(r.W, 2) + '</b>') +
            row('μ_W = n(n+1)/4', f(r.mu, 4)) + row('σ_W', f(r.sd, 4)) +
            row('Z', f(r.z, 4)) +
            row('<b>p-value (ประมาณด้วยปรกติ)</b>', '<b style="color:' + (rej ? 'var(--danger)' : 'var(--ok)') + '">' + fp(r.p) + '</b>') +
            verdict(rej, rej ? 'ค่ากลางของทั้งสองชุดแตกต่างกันอย่างมีนัยสำคัญ' : 'หลักฐานไม่เพียงพอที่จะสรุปว่าค่ากลางต่างกัน') +
            (r.n < 10 ? '<p style="font-size:12.5px;color:var(--warn);margin:9px 0 0">n น้อยกว่า 10 ควรเทียบกับตาราง Wilcoxon แบบแม่นตรงแทนการประมาณด้วยปรกติ</p>' : '') +
            '</div></div>';
        } else if (t === 'mw') {
          if (a1.length < 2 || a2.length < 2) throw 0;
          const r = S.mannWhitney(a1, a2);
          const rej = r.p <= al;
          h = '<div class="card"><div class="result">' +
            row('n₁ , n₂', r.n1 + ' , ' + r.n2) +
            row('ผลรวมอันดับกลุ่ม 1 (R₁)', f(r.r1, 2)) +
            row('U₁', f(r.u1, 2)) + row('U₂', f(r.u2, 2)) +
            row('<b>U = min(U₁, U₂)</b>', '<b>' + f(r.U, 2) + '</b>') +
            row('μ_U = n₁n₂/2', f(r.mu, 3)) + row('σ_U', f(r.sd, 4)) +
            row('Z', f(r.z, 4)) +
            row('<b>p-value</b>', '<b style="color:' + (rej ? 'var(--danger)' : 'var(--ok)') + '">' + fp(r.p) + '</b>') +
            row('มัธยฐานกลุ่ม 1 / กลุ่ม 2', f(S.median(a1), 3) + ' / ' + f(S.median(a2), 3)) +
            verdict(rej, rej ? 'ค่ากลางของสองกลุ่มแตกต่างกันอย่างมีนัยสำคัญ' : 'หลักฐานไม่เพียงพอที่จะสรุปว่าสองกลุ่มต่างกัน') +
            '</div></div>';
        } else if (t === 'kw') {
          const gs = T('np1').split('\n').map(l => S.parse(l)).filter(x => x.length >= 2);
          if (gs.length < 2) throw 0;
          const r = S.kruskal(gs);
          const cvv = S.chiInv(1 - al, r.df), rej = r.p <= al;
          h = '<div class="card"><div class="card-t">ผลรวมอันดับรายกลุ่ม</div><div class="tbl-wrap"><table class="tbl-mini">' +
            '<thead><tr><th>กลุ่ม</th><th class="num">n</th><th class="num">ผลรวมอันดับ</th><th class="num">อันดับเฉลี่ย</th><th class="num">มัธยฐาน</th></tr></thead><tbody>' +
            gs.map((g, i) => '<tr><td>กลุ่มที่ ' + (i + 1) + '</td><td class="num">' + g.length + '</td><td class="num">' +
              f(r.rsum[i], 2) + '</td><td class="num">' + f(r.rsum[i] / g.length, 3) + '</td><td class="num">' + f(S.median(g), 3) + '</td></tr>').join('') +
            '</tbody></table></div>' +
            '<div class="result" style="margin-top:12px">' +
            row('<b>H</b>', '<b>' + f(r.H, 5) + '</b>') + row('df = k − 1', r.df) +
            row('ค่าวิกฤต χ²', f(cvv, 4)) +
            row('<b>p-value</b>', '<b style="color:' + (rej ? 'var(--danger)' : 'var(--ok)') + '">' + fp(r.p) + '</b>') +
            verdict(rej, rej ? 'มีกลุ่มอย่างน้อยหนึ่งคู่ที่ค่ากลางแตกต่างกัน' : 'หลักฐานไม่เพียงพอที่จะสรุปว่ากลุ่มต่างกัน') +
            '</div></div>';
        } else if (t === 'sp') {
          if (a1.length < 3 || a1.length !== a2.length) throw 0;
          const rs = S.spearman(a1, a2), n = a1.length;
          const tst = rs * Math.sqrt((n - 2) / (1 - rs * rs));
          const p = S.pFromT(tst, n - 2, 'two'), rej = p <= al;
          const rp = S.pearson(a1, a2);
          h = '<div class="card"><div class="result">' +
            row('n', n) +
            row('<b>Spearman r_s</b>', '<b style="color:var(--accent)">' + f(rs, 5) + '</b>') +
            row('เทียบกับ Pearson r', f(rp, 5)) +
            row('t = r_s√((n−2)/(1−r_s²))', f(tst, 4)) + row('df', n - 2) +
            row('<b>p-value</b>', '<b style="color:' + (rej ? 'var(--danger)' : 'var(--ok)') + '">' + fp(p) + '</b>') +
            verdict(rej, rej ? 'มีความสัมพันธ์เชิงอันดับอย่างมีนัยสำคัญ' : 'หลักฐานไม่เพียงพอที่จะสรุปว่ามีความสัมพันธ์') +
            '</div></div>';
        } else {
          const seq = a1.map(v => v > 0 ? 1 : 0);
          if (seq.length < 5) throw 0;
          const r = S.runsTest(seq), rej = r.p <= al;
          h = '<div class="card"><div class="result">' +
            row('จำนวนข้อมูลทั้งหมด', seq.length) + row('n₁ (จำนวน 1)', r.n1) + row('n₂ (จำนวน 0)', r.n2) +
            row('<b>จำนวน Run ที่สังเกตได้</b>', '<b>' + r.runs + '</b>') +
            row('μ_R ที่คาดหวัง', f(r.mu, 4)) + row('σ_R', f(r.sd, 4)) + row('Z', f(r.z, 4)) +
            row('<b>p-value</b>', '<b style="color:' + (rej ? 'var(--danger)' : 'var(--ok)') + '">' + fp(r.p) + '</b>') +
            verdict(rej, rej ? 'ลำดับข้อมูลไม่เป็นสุ่ม (' + (r.runs < r.mu ? 'run น้อยเกินไป — จับกลุ่มกัน' : 'run มากเกินไป — สลับเป็นระบบ') + ')'
              : 'ลำดับข้อมูลเป็นสุ่ม') +
            '</div></div>';
        }
      } catch (e) {
        h = '<div class="result empty">ข้อมูลไม่ถูกต้องหรือไม่เพียงพอ กรุณาตรวจสอบจำนวนค่าในแต่ละชุด</div>';
      }
      o.innerHTML = h;
    }
    $('npT').onchange = build;
    build();
  }
};

/* ---------- 14. การถดถอยและสหสัมพันธ์ ---------- */
TOOLS.reg = {
  name: 'การถดถอยและสหสัมพันธ์', icon: '📉', cat: 'บทที่ 7',
  desc: 'สมการถดถอย ตาราง ANOVA แผนภาพการกระจาย และกราฟเศษเหลือ',
  render(el) {
    el.innerHTML =
      '<div class="card"><div class="grid g2">' +
      ta('rgX', 'ตัวแปรอิสระ X', '2 3 4 5 5 6 7 8 9 10') +
      ta('rgY', 'ตัวแปรตาม Y', '55 58 65 68 70 72 78 82 85 90') +
      '</div><div class="grid g2">' +
      sel('rgA', 'ระดับนัยสำคัญ α', [['0.10', '0.10'], ['0.05', '0.05'], ['0.01', '0.01']], '0.05') +
      num('rgP', 'ค่า X ที่ต้องการพยากรณ์', 7, 0.1) +
      '</div></div><div id="rgOut"></div>';

    function go() {
      const x = S.parse(T('rgX')), y = S.parse(T('rgY')), o = $('rgOut');
      if (x.length < 3 || x.length !== y.length) {
        o.innerHTML = '<div class="result empty">ต้องมีข้อมูลอย่างน้อย 3 คู่ และจำนวน X กับ Y ต้องเท่ากัน</div>'; return;
      }
      const al = parseFloat(T('rgA')), x0 = V('rgP');
      const r = S.linreg(x, y);
      const tc = S.tInv(1 - al / 2, r.df);
      const rej = r.pB1 <= al;
      const strength = Math.abs(r.r) >= 0.8 ? 'สูงมาก' : Math.abs(r.r) >= 0.6 ? 'สูง' :
        Math.abs(r.r) >= 0.4 ? 'ปานกลาง' : Math.abs(r.r) >= 0.2 ? 'ต่ำ' : 'ต่ำมาก';

      let h = '<div class="grid g4" style="margin-bottom:14px">' +
        '<div class="tile acc"><div class="k">สหสัมพันธ์ r</div><div class="v">' + f(r.r, 4) + '</div><div class="s">' +
        (r.r > 0 ? 'ทางบวก' : 'ทางลบ') + ' · ' + strength + '</div></div>' +
        '<div class="tile acc"><div class="k">R²</div><div class="v">' + f(r.r2, 4) + '</div><div class="s">อธิบายได้ ' + f(r.r2 * 100, 1) + '%</div></div>' +
        '<div class="tile"><div class="k">ความชัน b₁</div><div class="v">' + f(r.b1, 4) + '</div></div>' +
        '<div class="tile"><div class="k">จุดตัดแกน b₀</div><div class="v">' + f(r.b0, 4) + '</div></div>' +
        '</div>';

      h += '<div class="card"><div class="card-t">สมการถดถอย</div>' +
        '<div class="fml" style="text-align:center;font-family:var(--mono);font-size:17px;font-weight:600;color:var(--accent)">' +
        'Ŷ = ' + f(r.b0, 4) + ' ' + (r.b1 >= 0 ? '+' : '−') + ' ' + f(Math.abs(r.b1), 4) + ' X</div>' +
        '<p style="font-size:14px;margin:4px 0 0">เมื่อ X เพิ่มขึ้น 1 หน่วย Y เปลี่ยนแปลงโดยเฉลี่ย <b>' + f(r.b1, 4) + '</b> หน่วย</p></div>';

      h += '<div class="grid g2">' +
        '<div class="card"><div class="card-t">ผลรวมกำลังสอง</div>' +
        row('SSxx', f(r.sxx, 4)) + row('SSyy (= SST)', f(r.syy, 4)) + row('SSxy', f(r.sxy, 4)) +
        row('SSR (อธิบายได้)', f(r.ssr, 4)) + row('SSE (เหลือ)', f(r.sse, 4)) +
        row('S(Y·X) = √MSE', f(r.s, 5)) + '</div>' +
        '<div class="card"><div class="card-t">ทดสอบความชัน β₁</div>' +
        row('H₀ : β₁ = 0', 'ไม่มีความสัมพันธ์เชิงเส้น') +
        row('S(b₁)', f(r.seB1, 5)) + row('t = b₁ / S(b₁)', f(r.tB1, 4)) + row('df', r.df) +
        row('ค่าวิกฤต t', '±' + f(tc, 4)) +
        row('<b>p-value</b>', '<b style="color:' + (rej ? 'var(--danger)' : 'var(--ok)') + '">' + fp(r.pB1) + '</b>') +
        row('CI ' + ((1 - al) * 100) + '% ของ β₁', '(' + f(r.b1 - tc * r.seB1, 4) + ' , ' + f(r.b1 + tc * r.seB1, 4) + ')') +
        '</div></div>';

      h += '<div class="card"><div class="card-t">ตาราง ANOVA ของการถดถอย</div><div class="tbl-wrap"><table class="tbl-tight">' +
        '<thead><tr><th>แหล่งความแปรผัน</th><th class="num">SS</th><th class="num">df</th><th class="num">MS</th><th class="num">F</th><th class="num">p</th></tr></thead><tbody>' +
        '<tr><td>การถดถอย</td><td class="num">' + f(r.ssr, 4) + '</td><td class="num">1</td><td class="num">' + f(r.ssr, 4) +
        '</td><td class="num"><b>' + f(r.F, 4) + '</b></td><td class="num">' + fp(r.pF) + '</td></tr>' +
        '<tr><td>ความคลาดเคลื่อน</td><td class="num">' + f(r.sse, 4) + '</td><td class="num">' + r.df + '</td><td class="num">' +
        f(r.mse, 4) + '</td><td class="num">—</td><td class="num">—</td></tr>' +
        '<tr style="background:var(--surface-2)"><td><b>รวม</b></td><td class="num"><b>' + f(r.sst, 4) + '</b></td><td class="num"><b>' +
        (r.n - 1) + '</b></td><td class="num">—</td><td class="num">—</td><td class="num">—</td></tr>' +
        '</tbody></table></div>' +
        '<p style="font-size:13px;color:var(--text-3);margin:9px 0 0">ในการถดถอยอย่างง่าย F = t² = ' + f(r.tB1 * r.tB1, 4) + '</p>' +
        verdict(rej, rej ? 'ตัวแบบการถดถอยมีนัยสำคัญ — X ทำนาย Y ได้' : 'ตัวแบบยังไม่มีนัยสำคัญทางสถิติ') + '</div>';

      // พยากรณ์
      if (!isNaN(x0)) {
        const yh = r.predict(x0), mx = S.mean(x);
        const ciSe = r.s * Math.sqrt(1 / r.n + Math.pow(x0 - mx, 2) / r.sxx);
        const piSe = r.s * Math.sqrt(1 + 1 / r.n + Math.pow(x0 - mx, 2) / r.sxx);
        const out = x0 < Math.min.apply(null, x) || x0 > Math.max.apply(null, x);
        h += '<div class="card"><div class="card-t">การพยากรณ์ที่ X = ' + x0 + '</div><div class="result">' +
          row('<b>ค่าพยากรณ์ Ŷ</b>', '<b style="color:var(--accent)">' + f(yh, 4) + '</b>') +
          row('CI ' + ((1 - al) * 100) + '% ของค่าเฉลี่ย Y', '(' + f(yh - tc * ciSe, 4) + ' , ' + f(yh + tc * ciSe, 4) + ')') +
          row('PI ' + ((1 - al) * 100) + '% ของ Y รายตัว', '(' + f(yh - tc * piSe, 4) + ' , ' + f(yh + tc * piSe, 4) + ')') +
          '</div>' + (out ? '<p style="font-size:13px;color:var(--warn);margin:9px 0 0">⚠ ค่า X นี้อยู่นอกช่วงข้อมูลที่เก็บมา (extrapolation) ผลพยากรณ์อาจเชื่อถือไม่ได้</p>' : '') +
          '</div>';
      }

      h += '<div class="grid g2">' +
        '<div class="card"><div class="card-t">แผนภาพการกระจายและเส้นถดถอย</div><canvas id="rgC1"></canvas></div>' +
        '<div class="card"><div class="card-t">กราฟเศษเหลือ (Residual Plot)</div><canvas id="rgC2"></canvas>' +
        '<p style="font-size:12.5px;color:var(--text-3);margin:9px 0 0">ควรเห็นจุดกระจายสุ่มรอบเส้นศูนย์ ถ้าเห็นรูปโค้งหรือรูปกรวย แสดงว่าผิดข้อตกลง</p></div>' +
        '</div>';
      o.innerHTML = h;

      // แผนภาพการกระจาย
      const xmin = Math.min.apply(null, x), xmax = Math.max.apply(null, x);
      const ymin = Math.min.apply(null, y), ymax = Math.max.apply(null, y);
      const px = (xmax - xmin) * 0.08 || 1, py = (ymax - ymin) * 0.1 || 1;
      const p1 = Plot($('rgC1'), { h: 265 });
      p1.domain(xmin - px, xmax + px, ymin - py, ymax + py).axes('X');
      p1.line(xmin - px, r.predict(xmin - px), xmax + px, r.predict(xmax + px), css('--danger'));
      p1.points(x, y, css('--accent'));

      const res = y.map((v, i) => v - r.predict(x[i]));
      const fit = x.map(v => r.predict(v));
      const fmin = Math.min.apply(null, fit), fmax = Math.max.apply(null, fit);
      const rmax = Math.max.apply(null, res.map(Math.abs)) * 1.25 || 1;
      const p2 = Plot($('rgC2'), { h: 265 });
      p2.domain(fmin - (fmax - fmin) * 0.08, fmax + (fmax - fmin) * 0.08, -rmax, rmax).axes('ค่าพยากรณ์ Ŷ');
      const c2 = p2.c;
      c2.strokeStyle = css('--danger'); c2.setLineDash([5, 4]); c2.lineWidth = 1.4;
      c2.beginPath(); c2.moveTo(p2.pad.l, p2.Y(0)); c2.lineTo(p2.w - p2.pad.r, p2.Y(0)); c2.stroke();
      c2.setLineDash([]);
      p2.points(fit, res, css('--violet'));
    }
    bindAll(['rgX', 'rgY', 'rgA', 'rgP'], go);
  }
};

/* ---------- 15. ตัวช่วยเลือกสถิติ ---------- */
TOOLS.picker = {
  name: 'ตัวช่วยเลือกสถิติทดสอบ', icon: '🧭', cat: 'เครื่องมือสอบ',
  desc: 'ตอบคำถามไม่กี่ข้อ แล้วระบบจะบอกว่าควรใช้สถิติตัวไหน',
  render(el) {
    el.innerHTML =
      '<div class="card">' +
      '<div class="field"><label>1. ต้องการศึกษาอะไร</label>' +
      segment('pk1', [['center', 'ค่ากลาง'], ['prop', 'สัดส่วน'], ['var', 'ความแปรปรวน'], ['assoc', 'ความสัมพันธ์']], 'center') + '</div>' +
      '<div id="pkQ"></div><div id="pkOut"></div></div>';

    function build() {
      const q1 = segVal('pk1');
      let h = '';
      if (q1 === 'center') {
        h = '<div class="field"><label>2. มีกี่กลุ่ม</label>' +
          segment('pk2', [['1', '1 กลุ่ม'], ['2', '2 กลุ่ม'], ['3', '3 กลุ่มขึ้นไป']], '2') + '</div>' +
          '<div class="field"><label>3. กลุ่มเป็นอิสระต่อกันหรือไม่</label>' +
          segment('pk3', [['ind', 'อิสระ'], ['dep', 'สัมพันธ์กัน (คู่)']], 'ind') + '</div>' +
          '<div class="field"><label>4. ข้อมูลแจกแจงปรกติ และ n เพียงพอหรือไม่</label>' +
          segment('pk4', [['y', 'ใช่'], ['n', 'ไม่ใช่ / ไม่แน่ใจ']], 'y') + '</div>' +
          '<div class="field"><label>5. ทราบ σ ของประชากรหรือไม่</label>' +
          segment('pk5', [['n', 'ไม่ทราบ'], ['y', 'ทราบ']], 'n') + '</div>';
      } else if (q1 === 'prop') {
        h = '<div class="field"><label>2. มีกี่กลุ่ม</label>' +
          segment('pk2', [['1', '1 กลุ่ม'], ['2', '2 กลุ่ม'], ['3', 'หลายกลุ่ม / ตาราง']], '1') + '</div>';
      } else if (q1 === 'var') {
        h = '<div class="field"><label>2. มีกี่กลุ่ม</label>' +
          segment('pk2', [['1', '1 กลุ่ม'], ['2', '2 กลุ่ม'], ['3', '3 กลุ่มขึ้นไป']], '1') + '</div>';
      } else {
        h = '<div class="field"><label>2. ระดับการวัดของตัวแปร</label>' +
          segment('pk2', [['num', 'เชิงปริมาณทั้งคู่'], ['ord', 'เรียงอันดับ'], ['cat', 'เชิงจำแนก (นามบัญญัติ)']], 'num') + '</div>';
      }
      $('pkQ').innerHTML = h;
      ['pk2', 'pk3', 'pk4', 'pk5'].forEach(i => wireSeg(i, go));
      go();
    }

    function go() {
      const q1 = segVal('pk1'), q2 = segVal('pk2'), q3 = segVal('pk3'), q4 = segVal('pk4'), q5 = segVal('pk5');
      let name = '', why = '', link = '', formula = '';
      if (q1 === 'center') {
        if (q4 === 'n') {
          if (q2 === '1' || (q2 === '2' && q3 === 'dep')) {
            name = 'Wilcoxon Signed-Rank Test'; link = 'nonpar';
            why = 'ข้อมูลไม่ปรกติและเป็นข้อมูลคู่ จึงใช้วิธีอิงอันดับ (หรือ Sign test ถ้าสนใจแค่ทิศทาง)';
            formula = 'W=\\min(W^+,W^-)';
          } else if (q2 === '2') {
            name = 'Mann–Whitney U Test'; link = 'nonpar';
            why = 'สองกลุ่มอิสระที่ข้อมูลไม่ปรกติ — คู่เทียบไม่อิงพารามิเตอร์ของ independent t-test';
            formula = 'U=n_1n_2+\\frac{n_1(n_1+1)}{2}-R_1';
          } else {
            name = 'Kruskal–Wallis Test'; link = 'nonpar';
            why = 'สามกลุ่มขึ้นไปที่ข้อมูลไม่ปรกติ — คู่เทียบไม่อิงพารามิเตอร์ของ One-way ANOVA';
            formula = 'H=\\frac{12}{N(N+1)}\\sum\\frac{R_i^2}{n_i}-3(N+1)';
          }
        } else if (q2 === '1') {
          if (q5 === 'y') { name = 'Z-test (กลุ่มเดียว)'; formula = 'Z=\\frac{\\bar X-\\mu_0}{\\sigma/\\sqrt n}'; why = 'ทราบ σ ของประชากร จึงใช้การแจกแจงปรกติมาตรฐานได้โดยตรง'; }
          else { name = 't-test (กลุ่มเดียว)'; formula = 't=\\frac{\\bar X-\\mu_0}{S/\\sqrt n},\\ df=n-1'; why = 'ไม่ทราบ σ ต้องใช้ S แทน จึงเป็นการแจกแจง t ที่ df = n−1'; }
          link = 'ttest';
        } else if (q2 === '2') {
          if (q3 === 'dep') { name = 'Paired t-test'; formula = 't=\\frac{\\bar d}{S_d/\\sqrt n},\\ df=n-1'; why = 'ข้อมูลจับคู่จากหน่วยเดียวกัน ต้องหาผลต่างรายคู่ก่อน ซึ่งช่วยตัดความแปรปรวนระหว่างบุคคลออก'; }
          else { name = 'Independent t-test'; formula = 't=\\frac{\\bar X_1-\\bar X_2}{S_p\\sqrt{1/n_1+1/n_2}}'; why = 'สองกลุ่มอิสระ ควรตรวจสอบความเท่ากันของความแปรปรวนด้วย F-test ก่อน ถ้าไม่เท่าใช้ Welch'; }
          link = 'ttest';
        } else {
          name = 'One-way ANOVA (F-test)'; link = 'anova';
          formula = 'F=\\frac{MSB}{MSW}';
          why = 'สามกลุ่มขึ้นไป ใช้ ANOVA เพื่อคุมความคลาดเคลื่อนแบบที่ 1 ถ้าปฏิเสธ H₀ ต้องทำ post-hoc (LSD / Tukey) ต่อ';
        }
      } else if (q1 === 'prop') {
        if (q2 === '1') { name = 'Z-test สัดส่วนกลุ่มเดียว'; formula = 'Z=\\frac{\\hat p-p_0}{\\sqrt{p_0(1-p_0)/n}}'; link = 'ttest'; why = 'ตรวจเงื่อนไข np₀ ≥ 5 และ n(1−p₀) ≥ 5 ก่อนใช้'; }
        else if (q2 === '2') { name = 'Z-test สัดส่วนสองกลุ่ม'; formula = 'Z=\\frac{\\hat p_1-\\hat p_2}{\\sqrt{\\hat p(1-\\hat p)(1/n_1+1/n_2)}}'; link = 'ttest'; why = 'ใช้สัดส่วนร่วม (pooled) ในตัวส่วน เพราะคำนวณภายใต้ H₀ ว่าสัดส่วนเท่ากัน'; }
        else { name = 'Chi-square Test of Homogeneity'; formula = '\\chi^2=\\sum\\frac{(O-E)^2}{E}'; link = 'chi'; why = 'เปรียบเทียบสัดส่วนหลายกลุ่มพร้อมกันผ่านตารางความถี่'; }
      } else if (q1 === 'var') {
        if (q2 === '1') { name = 'Chi-square Test ความแปรปรวน'; formula = '\\chi^2=\\frac{(n-1)S^2}{\\sigma_0^2}'; link = 'ttest'; why = 'ต้องการให้ประชากรแจกแจงปรกติอย่างเคร่งครัด การทดสอบนี้ไวต่อการละเมิดข้อตกลงมาก'; }
        else if (q2 === '2') { name = 'F-test ความแปรปรวนสองกลุ่ม'; formula = 'F=\\frac{S_1^2}{S_2^2}'; link = 'ttest'; why = 'จัดความแปรปรวนที่มากกว่าไว้ตัวเศษ จะได้เปิดตารางหางขวาได้ตรง'; }
        else { name = "Levene's Test / Bartlett's Test"; formula = ''; link = 'anova'; why = 'ใช้ตรวจสอบข้อตกลงความเท่ากันของความแปรปรวนก่อนทำ ANOVA (Levene ทนต่อข้อมูลไม่ปรกติได้ดีกว่า)'; }
      } else {
        if (q2 === 'num') { name = 'Pearson r และการถดถอยเชิงเส้น'; formula = 'r=\\frac{SS_{xy}}{\\sqrt{SS_{xx}SS_{yy}}}'; link = 'reg'; why = 'ดูแผนภาพการกระจายก่อนเสมอ เพื่อยืนยันว่าความสัมพันธ์เป็นเชิงเส้นจริง'; }
        else if (q2 === 'ord') { name = "Spearman's rho"; formula = 'r_s=1-\\frac{6\\sum d_i^2}{n(n^2-1)}'; link = 'nonpar'; why = 'ข้อมูลเรียงอันดับ หรือความสัมพันธ์เป็นแบบทางเดียวแต่ไม่เป็นเส้นตรง'; }
        else { name = 'Chi-square Test of Independence'; formula = '\\chi^2=\\sum\\frac{(O-E)^2}{E},\\ df=(r-1)(c-1)'; link = 'chi'; why = "ตัวแปรเชิงจำแนกสองตัว วัดความแรงด้วย Cramer's V เพิ่มเติม"; }
      }

      $('pkOut').innerHTML =
        '<div class="note key" style="margin-top:18px"><b>สถิติทดสอบที่แนะนำ</b>' +
        '<p style="font-size:19px;font-weight:600;color:var(--accent);margin:7px 0 10px">' + name + '</p>' +
        (formula ? '<div class="fml" style="background:var(--surface);margin:0 0 11px">$$' + formula + '$$</div>' : '') +
        '<p style="margin:0"><b>เหตุผล:</b> ' + why + '</p>' +
        '<p style="margin:11px 0 0"><a href="#/tools/' + link + '" class="btn sm">เปิดเครื่องมือคำนวณ →</a></p></div>';
      if (global.renderMathInElement) {
        try {
          global.renderMathInElement($('pkOut'), {
            delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }],
            throwOnError: false
          });
        } catch (e) { }
      }
    }
    wireSeg('pk1', build);
    build();
  }
};

global.TOOLS = TOOLS;
global.PlotHelper = Plot;
/* ส่งออกตัวช่วยสร้าง UI ให้ labs.js ใช้ร่วมกัน ไม่ต้องเขียนซ้ำ */
global.ToolUI = {
  css, num, sel, ta, row, $, V, T, bindAll,
  segment, wireSeg, segVal, verdict, tailName
};
})(window);
