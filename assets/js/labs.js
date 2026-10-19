/* ============================================================
   labs.js — ห้องปฏิบัติการจำลองสถานการณ์ (Monte Carlo Simulation)
   แต่ละแลบคือการทดลองซ้ำหลายพันครั้ง เพื่อ "เห็น" ทฤษฎีเกิดขึ้นจริง
   ============================================================ */
(function (global) {
'use strict';
const S = global.Stats, Plot = global.PlotHelper, U = global.ToolUI;
const css = U.css, num = U.num, sel = U.sel, row = U.row;
const $ = U.$, V = U.V, T = U.T;
const segment = U.segment, wireSeg = U.wireSeg, segVal = U.segVal;
const f = S.fmt, fp = S.fmtP;

/* ---------- ตัวช่วยวาดเพิ่ม (ใช้ context ของ Plot โดยตรง) ---------- */
function polyline(p, xs, ys, color, w, dash) {
  const c = p.c;
  if (!xs.length) return p;
  c.save(); c.beginPath();
  c.strokeStyle = color; c.lineWidth = w || 2;
  if (dash) c.setLineDash(dash);
  c.moveTo(p.X(xs[0]), p.Y(ys[0]));
  for (let i = 1; i < xs.length; i++) c.lineTo(p.X(xs[i]), p.Y(ys[i]));
  c.stroke(); c.restore();
  return p;
}
function band(p, xs, lo, hi, fill) {
  const c = p.c;
  if (!xs.length) return p;
  c.save(); c.beginPath();
  c.moveTo(p.X(xs[0]), p.Y(hi[0]));
  for (let i = 1; i < xs.length; i++) c.lineTo(p.X(xs[i]), p.Y(hi[i]));
  for (let i = xs.length - 1; i >= 0; i--) c.lineTo(p.X(xs[i]), p.Y(lo[i]));
  c.closePath(); c.fillStyle = fill; c.fill(); c.restore();
  return p;
}
function hline(p, y, color, label, dash) {
  const c = p.c;
  c.save();
  c.strokeStyle = color; c.lineWidth = 1.5;
  c.setLineDash(dash || [5, 4]);
  c.beginPath(); c.moveTo(p.pad.l, p.Y(y)); c.lineTo(p.w - p.pad.r, p.Y(y)); c.stroke();
  c.setLineDash([]);
  if (label) {
    c.fillStyle = color; c.font = '600 11px system-ui';
    c.textAlign = 'left'; c.textBaseline = 'bottom';
    c.fillText(label, p.pad.l + 5, p.Y(y) - 3);
  }
  c.restore();
  return p;
}
/* ฮิสโทแกรมสเกลความหนาแน่น — ซ้อนทับเส้นโค้งทฤษฎีได้ตรง ๆ */
function densBins(data, nbins, mn, mx) {
  const bw = (mx - mn) / nbins;
  const bins = new Array(nbins).fill(0);
  let inside = 0;
  data.forEach(v => {
    let i = Math.floor((v - mn) / bw);
    if (i < 0 || i >= nbins) return;
    bins[i]++; inside++;
  });
  return { bins, dens: bins.map(b => b / (data.length * bw)), bw, mn, mx, inside };
}
function drawDens(p, d, color, alpha) {
  const c = p.c;
  c.save(); c.fillStyle = color; c.globalAlpha = alpha === undefined ? 0.34 : alpha;
  for (let i = 0; i < d.dens.length; i++) {
    const x0 = p.X(d.mn + i * d.bw), x1 = p.X(d.mn + (i + 1) * d.bw);
    const y = p.Y(d.dens[i]), y0 = p.Y(0);
    c.fillRect(x0 + 0.5, y, Math.max(1, x1 - x0 - 1), Math.max(0, y0 - y));
  }
  c.restore();
  return p;
}
function quietAxes(p, xlab, nt) { p.axes(xlab, '', nt || 6); return p; }

/* ---------- ตัวช่วยสร้าง UI ของแลบ ---------- */
function pct(x, d) { return f(x * 100, d === undefined ? 2 : d) + '%'; }
function tile(k, v, s, cls) {
  return '<div class="tile' + (cls ? ' ' + cls : '') + '"><div class="k">' + k + '</div>' +
    '<div class="v">' + v + '</div>' + (s ? '<div class="s">' + s + '</div>' : '') + '</div>';
}
function obs(html) {
  return '<div class="note tip"><b>สิ่งที่สังเกตได้จากรอบนี้</b>' + html + '</div>';
}
function runBar(id, label, extra) {
  return '<div class="lab-run"><button class="btn" id="' + id + '">' +
    (label || '▶ เริ่มการจำลอง') + '</button>' + (extra || '') + '</div>';
}
function legend(items) {
  return '<div class="plot-legend">' +
    items.map(i => '<span><i style="background:' + i[1] + '"></i>' + i[0] + '</span>').join('') +
    '</div>';
}
function meter(label, note, val, max, color) {
  const pc = Math.max(0, Math.min(100, val / max * 100));
  return '<div class="lab-meter"><div class="lab-meter-h"><span>' + label + '</span>' +
    '<b>' + note + '</b></div><div class="lab-meter-b">' +
    '<i style="width:' + pc.toFixed(2) + '%;background:' + color + '"></i></div></div>';
}
function slider(id, label, min, max, val, step) {
  return '<div class="field"><label>' + label + ' — <b id="' + id + 'V">' + val + '</b></label>' +
    '<input type="range" id="' + id + '" min="' + min + '" max="' + max + '" value="' + val +
    '" step="' + (step || 1) + '"></div>';
}
function wireSliders(ids, fn) {
  ids.forEach(id => {
    const el = $(id); if (!el) return;
    const lb = $(id + 'V');
    if (lb) lb.textContent = el.value;
    el.addEventListener('input', () => { if (lb) lb.textContent = el.value; fn(); });
  });
}
function mathify(el) {
  if (!el || !global.renderMathInElement) return;
  try {
    global.renderMathInElement(el, {
      delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }],
      throwOnError: false
    });
  } catch (e) { }
}
/* เดินการจำลองทีละช่วงด้วย rAF — หน้าไม่ค้าง และเห็นกราฟค่อย ๆ โต */
function animate(host, total, chunk, stepFn, drawFn) {
  if (host._labStop) host._labStop();
  let i = 0, alive = true;
  host._labStop = () => { alive = false; };
  (function tick() {
    if (!alive || !document.body.contains(host)) return;
    const end = Math.min(total, i + chunk);
    for (; i < end; i++) stepFn(i);
    drawFn(i, i >= total);
    if (i < total) requestAnimationFrame(tick);
  })();
}
function randFrom(pmf) {                 // pmf = [[ค่า, ความน่าจะเป็น], ...]
  const u = Math.random();
  let a = 0;
  for (let i = 0; i < pmf.length; i++) { a += pmf[i][1]; if (u <= a) return pmf[i][0]; }
  return pmf[pmf.length - 1][0];
}

/* ประชากรรูปร่างต่าง ๆ — ปรับให้ค่าเฉลี่ย 0 และ SD ≈ 1 ทุกแบบ เพื่อเทียบกันได้ยุติธรรม */
const SHAPES = {
  norm:  { n: 'ปรกติ (ระฆังคว่ำ)',        g: () => S.randNorm(0, 1) },
  unif:  { n: 'สม่ำเสมอ (หางสั้น)',        g: () => (Math.random() - 0.5) * Math.sqrt(12) },
  exp:   { n: 'เลขชี้กำลัง (เบ้ขวา)',      g: () => S.randExp(1) - 1 },
  lnorm: { n: 'ล็อกปรกติ (เบ้ขวาจัด)',     g: () => (Math.exp(S.randNorm(0, 1)) - 1.6487) / 2.1612 },
  heavy: { n: 'หางหนา (มีค่าผิดปกติ)',     g: () => (Math.random() < 0.9 ? S.randNorm(0, 0.6) : S.randNorm(0, 4)) / 1.3871 },
  bi:    { n: 'สองยอด (Bimodal)',         g: () => (Math.random() < 0.5 ? -1 : 1) * 0.84 + S.randNorm(0, 0.54) }
};
function shapeOpts(keys) {
  return (keys || Object.keys(SHAPES)).map(k => [k, SHAPES[k].n]);
}
function sampleShape(key, n, mu, sigma) {
  const g = SHAPES[key].g, a = new Array(n);
  for (let i = 0; i < n; i++) a[i] = mu + sigma * g();
  return a;
}

const LABS = {};

/* ============================================================
   แลบ 1 — กฎจำนวนมาก
   ============================================================ */
LABS.lln = {
  no: 1, ch: 1, cat: 'บทที่ 1', icon: '🪙',
  name: 'กฎจำนวนมาก',
  desc: 'ทอยซ้ำหลายพันครั้ง ดูความถี่สัมพัทธ์ค่อย ๆ ลู่เข้าหาความน่าจะเป็นจริง และดูว่าลู่เข้าช้าแค่ไหน',
  goal: 'ตรวจสอบด้วยการทดลองว่าเมื่อทดลองซ้ำมากขึ้น ความถี่สัมพัทธ์ของเหตุการณ์ลู่เข้าสู่ความน่าจะเป็นตามทฤษฎี และวัดว่าลู่เข้าเร็วเพียงใด',
  theory: `
<p>นิยามความน่าจะเป็นแบบความถี่สัมพัทธ์บอกว่า ถ้าทดลองซ้ำ $n$ ครั้งแล้วเหตุการณ์ $A$ เกิดขึ้น $x$ ครั้ง</p>
$$\\hat p = \\frac{x}{n} \\;\\xrightarrow[\\;n \\to \\infty\\;]{}\\; P(A)$$
<p>แต่ลู่เข้าเร็วแค่ไหน? เพราะ $x \\sim B(n,p)$ จึงได้</p>
$$E(\\hat p) = p, \\qquad SD(\\hat p) = \\sqrt{\\frac{p(1-p)}{n}}$$
<p>สังเกตว่าตัวส่วนเป็น $\\sqrt{n}$ ไม่ใช่ $n$ — ถ้าอยากให้ความคลาดเคลื่อนลดลงครึ่งหนึ่ง ต้องเพิ่มจำนวนครั้งเป็น <b>4 เท่า</b></p>`,
  steps: [
    'เลือกการทดลองและจำนวนครั้งที่จะทอย แล้วกด “เริ่มการจำลอง”',
    'ดูกราฟซ้าย — เส้นน้ำเงินคือ $\\hat p$ ที่คำนวณใหม่ทุกครั้งที่ทอย เส้นประแดงคือ $p$ ตามทฤษฎี',
    'แถบจางรอบเส้นแดงคือช่วง $p \\pm 2\\sqrt{p(1-p)/n}$ ให้สังเกตว่าเส้นน้ำเงินอยู่ในแถบนี้เกือบตลอดเวลา',
    'ดูกราฟขวา — ผลต่างระหว่างจำนวนครั้งที่เกิดจริงกับที่คาดหมาย คือ $|x - np|$',
    'กดเริ่มใหม่หลายรอบ แล้วลองเปลี่ยน $p$ ให้ใกล้ 0 ดูว่าต้องทอยกี่ครั้งกราฟจึงจะนิ่ง'
  ],
  questions: [
    { q: 'เมื่อ $n$ เพิ่มขึ้น เส้นสีน้ำเงินนิ่งลง แต่กราฟขวากลับโตขึ้นเรื่อย ๆ ขัดแย้งกันหรือไม่',
      a: 'ไม่ขัดแย้ง — สิ่งที่ลู่เข้าคือ<b>สัดส่วน</b> $x/n$ ไม่ใช่<b>ผลต่างสัมบูรณ์</b> $|x-np|$ ซึ่งโตด้วยอัตรา $\\sqrt{n}$ นี่คือจุดที่เข้าใจผิดบ่อยที่สุด เช่น ทอยเหรียญ 10,000 ครั้ง ได้หัวเกินมา 50 ครั้งถือว่าปกติมาก แต่คิดเป็นสัดส่วนเพียง 0.5%' },
    { q: 'ถ้าทอยเหรียญเที่ยงตรงออกก้อย 8 ครั้งติดกัน ครั้งที่ 9 โอกาสออกหัวมากขึ้นหรือไม่',
      a: 'ไม่ — ยังเป็น 0.5 เท่าเดิม เพราะการทอยแต่ละครั้ง<b>เป็นอิสระต่อกัน</b> เหรียญไม่มีความจำ กฎจำนวนมากไม่ได้ “แก้” ผลที่ผ่านมา แต่ผลที่ผ่านมาจะถูก<b>เจือจาง</b>ด้วย $n$ ที่มากขึ้น ความเข้าใจผิดนี้เรียกว่า Gambler’s Fallacy' },
    { q: 'ต้องทอยกี่ครั้งจึงจะประมาณ $p$ ให้คลาดเคลื่อนไม่เกิน 0.01 ที่ระดับความเชื่อมั่น 95%',
      a: 'ใช้ $$n \\ge \\frac{z_{\\alpha/2}^{2}\\,p(1-p)}{e^{2}}$$ กรณีแย่สุด $p=0.5$ ได้ $n \\ge \\dfrac{1.96^{2}(0.25)}{0.01^{2}} \\approx 9{,}604$ ครั้ง — ตรงกับที่เห็นว่า $n$ ระดับพันยังสั่นอยู่พอสมควร (ดูเครื่องมือ “คำนวณขนาดตัวอย่าง” ของบทที่ 4)' }
  ],
  render(el) {
    el.innerHTML =
      '<div class="card"><div class="grid g3">' +
      sel('llE', 'การทดลอง', [
        ['coin', 'เหรียญเที่ยงตรง — ออกหัว (p = 0.5)'],
        ['die', 'ลูกเต๋า 1 ลูก — ออกแต้ม 6 (p = 1/6)'],
        ['d7', 'ลูกเต๋า 2 ลูก — ผลรวมได้ 7 (p = 6/36)'],
        ['bias', 'เหรียญถ่วงน้ำหนัก — กำหนด p เอง']
      ], 'coin') +
      num('llN', 'จำนวนครั้งที่ทอย', 3000, 100, 'min="50" max="100000"') +
      num('llP', 'p (ใช้เมื่อเลือกเหรียญถ่วงน้ำหนัก)', 0.2, 0.01, 'min="0.01" max="0.99"') +
      '</div>' + runBar('llGo') + '</div>' +
      '<div class="grid g2">' +
      '<div class="card"><div class="card-t">ความถี่สัมพัทธ์ p̂ เทียบกับ p</div>' +
      '<canvas id="llC1"></canvas>' +
      legend([['p̂ จากการทอย', css('--accent')], ['p ทฤษฎี', css('--danger')]]) + '</div>' +
      '<div class="card"><div class="card-t">ผลต่างสัมบูรณ์ |x − np|</div>' +
      '<canvas id="llC2"></canvas>' +
      legend([['ผลต่างจริง', css('--violet')], ['√(np(1−p))', css('--text-3')]]) + '</div>' +
      '</div><div id="llOut"></div>';

    function go() {
      const kind = T('llE');
      const N = Math.max(50, Math.min(100000, Math.round(V('llN')) || 3000));
      const p = kind === 'coin' ? 0.5 : kind === 'die' ? 1 / 6 : kind === 'd7' ? 6 / 36
        : Math.max(0.01, Math.min(0.99, V('llP') || 0.2));
      const trial = kind === 'd7'
        ? () => (1 + Math.floor(Math.random() * 6)) + (1 + Math.floor(Math.random() * 6)) === 7
        : () => Math.random() < p;

      const keep = Math.max(1, Math.floor(N / 900));     // เก็บจุดกราฟไม่เกิน ~900 จุด
      const xs = [], ps = [], ds = [];
      let x = 0;

      animate(el, N, Math.max(150, Math.ceil(N / 70)),
        i => {
          if (trial()) x++;
          if ((i + 1) % keep === 0 || i === N - 1) {
            xs.push(i + 1); ps.push(x / (i + 1)); ds.push(Math.abs(x - (i + 1) * p));
          }
        },
        (done, fin) => {
          const lo = [], hi = [];
          xs.forEach(n => {
            const se = Math.sqrt(p * (1 - p) / n);
            lo.push(p - 2 * se); hi.push(p + 2 * se);
          });
          const spread = Math.max(0.05, 3.4 * Math.sqrt(p * (1 - p) / Math.max(40, xs[0] || 40)));
          const p1 = Plot($('llC1'), { h: 240 });
          p1.domain(0, N, Math.max(0, p - spread), Math.min(1, p + spread));
          quietAxes(p1, 'จำนวนครั้งที่ทอย (n)', 5);
          band(p1, xs, lo, hi, css('--accent-soft'));
          hline(p1, p, css('--danger'), 'p = ' + f(p, 4));
          polyline(p1, xs, ps, css('--accent'), 1.8);

          const dmax = Math.max(1, Math.max.apply(null, ds)) * 1.2;
          const p2 = Plot($('llC2'), { h: 240 });
          p2.domain(0, N, 0, dmax);
          quietAxes(p2, 'จำนวนครั้งที่ทอย (n)', 5);
          polyline(p2, xs, xs.map(n => Math.sqrt(n * p * (1 - p))), css('--text-3'), 1.6, [5, 4]);
          polyline(p2, xs, ds, css('--violet'), 1.8);

          const ph = x / done, se = Math.sqrt(p * (1 - p) / done);
          $('llOut').innerHTML =
            '<div class="grid g4" style="margin-bottom:14px">' +
            tile('ทอยไปแล้ว', done.toLocaleString('en-US'), fin ? 'ครบตามที่กำหนด' : 'กำลังทอย…') +
            tile('เกิดเหตุการณ์ (x)', x.toLocaleString('en-US'), 'คาดหมาย np = ' + f(done * p, 1)) +
            tile('p̂ = x / n', f(ph, 5), 'p ทฤษฎี = ' + f(p, 5), 'acc') +
            tile('คลาดเคลื่อน |p̂ − p|', f(Math.abs(ph - p), 5),
              'ขีดจำกัด 2 SD = ' + f(2 * se, 5), Math.abs(ph - p) <= 2 * se ? 'ok' : 'warn') +
            '</div>' +
            obs('<p>ที่ $n = ' + done.toLocaleString('en-US') + '$ ความคลาดเคลื่อนของ<b>สัดส่วน</b>เท่ากับ <b>' +
              f(Math.abs(ph - p), 5) + '</b> ขณะที่ผลต่าง<b>สัมบูรณ์</b> $|x - np|$ เท่ากับ <b>' +
              f(Math.abs(x - done * p), 1) + '</b> ครั้ง — ตัวแรกเล็กลงเรื่อย ๆ ตัวหลังโตขึ้นเรื่อย ๆ</p>' +
              '<p>ถ้าทอยเพิ่มเป็น 4 เท่า ($n = ' + (done * 4).toLocaleString('en-US') +
              '$) ทฤษฎีบอกว่า $SD(\\hat p)$ จะลดจาก ' + f(se, 5) + ' เหลือ ' + f(se / 2, 5) +
              ' — ดีขึ้นเพียง <b>ครึ่งหนึ่ง</b> แม้ลงแรงเพิ่ม 4 เท่า</p>');
          mathify($('llOut'));
        });
    }
    $('llGo').onclick = go;
    $('llE').onchange = go; $('llN').onchange = go; $('llP').onchange = go;
    go();
  }
};

/* ============================================================
   แลบ 2 — ปัญหามอนตีฮอลล์
   ============================================================ */
LABS.monty = {
  no: 2, ch: 1, cat: 'บทที่ 1', icon: '🚪',
  name: 'ปัญหามอนตีฮอลล์',
  desc: 'เปลี่ยนประตูดีกว่าจริงไหม — เล่นเกมซ้ำพันครั้งให้ตัวเลขตัดสิน พร้อมทดลองกรณีพิธีกรไม่รู้ว่ารถอยู่ประตูไหน',
  goal: 'ใช้การจำลองยืนยันว่าการเปลี่ยนประตูชนะ 2/3 ไม่ใช่ 1/2 และค้นหาว่า “ข้อมูลที่พิธีกรรู้” คือเงื่อนไขสำคัญที่ทำให้ตัวเลขนี้เปลี่ยน',
  theory: `
<p>มี 3 ประตู หลังประตูหนึ่งมีรถ อีกสองประตูมีแพะ ผู้เล่นเลือกประตูหนึ่ง จากนั้น<b>พิธีกรที่รู้ว่ารถอยู่ไหน</b> เปิดประตูที่เหลือซึ่งมีแพะ แล้วถามว่าจะเปลี่ยนประตูไหม</p>
<p>คิดจากความน่าจะเป็นก่อนเปิดประตู — ประตูที่เลือกแรกถูก $1/3$ ผิด $2/3$</p>
$$P(\\text{ชนะ} \\mid \\text{อยู่ประตูเดิม}) = \\tfrac13, \\qquad
P(\\text{ชนะ} \\mid \\text{เปลี่ยนประตู}) = \\tfrac23$$
<p>เพราะเมื่อเลือกผิดตั้งแต่แรก (ซึ่งเกิด $2/3$) การเปลี่ยนจะชนะ<b>เสมอ</b> การเปิดประตูของพิธีกรไม่ใช่เหตุการณ์สุ่มธรรมดา แต่เป็น<b>ข้อมูลเพิ่ม</b> เพราะพิธีกรเลี่ยงประตูที่มีรถอยู่</p>`,
  steps: [
    'กำหนดจำนวนเกมแล้วกด “เริ่มการจำลอง” ระบบจะเล่นทั้งสองกลยุทธ์บนเกมเดียวกันทุกเกม',
    'ดูเส้นสองเส้นว่าแยกไปหาระดับ 1/3 และ 2/3 ตามทฤษฎีหรือไม่',
    'เปลี่ยนตัวเลือก “พิธีกร” เป็นแบบที่พิธีกรไม่รู้ว่ารถอยู่ประตูไหน แล้วจำลองซ้ำ',
    'เทียบตัวเลขสองกรณี แล้วอธิบายว่าทำไมผลจึงต่างกัน ทั้งที่ผู้เล่นเห็นแพะเหมือนกัน'
  ],
  questions: [
    { q: 'หลังพิธีกรเปิดประตูแพะ เหลือ 2 ประตู ทำไมโอกาสไม่ใช่ 50-50',
      a: 'เพราะประตูสองบานนี้<b>ไม่สมมาตร</b> ประตูที่ผู้เล่นเลือกถูกล็อกความน่าจะเป็นไว้ที่ $1/3$ ตั้งแต่ก่อนพิธีกรเปิด และการเปิดของพิธีกรไม่ได้ให้ข้อมูลใหม่กับประตูนั้น ความน่าจะเป็น $2/3$ ที่เคยกระจายอยู่บนอีกสองประตูจึงไปรวมอยู่ที่ประตูที่เหลือบานเดียว' },
    { q: 'เมื่อเลือกกรณี “พิธีกรไม่รู้” อัตราชนะของการเปลี่ยนประตูเป็นเท่าไร และเพราะอะไร',
      a: 'ได้ประมาณ $1/2$ — เพราะในกรณีนี้การที่พิธีกรเปิดเจอแพะเป็นเรื่องบังเอิญ เมื่อ<b>ตัดเกมที่พิธีกรเปิดเจอรถออกไป</b> เกมที่เหลือมีรถอยู่ประตูเดิมและประตูอื่นเท่า ๆ กัน บทเรียนคือความน่าจะเป็นแบบมีเงื่อนไขขึ้นอยู่กับ<b>กลไกการได้ข้อมูล</b> ไม่ใช่แค่สิ่งที่เห็น' },
    { q: 'ถ้ามี 10 ประตูและพิธีกรเปิดแพะ 8 บาน การเปลี่ยนประตูชนะเท่าไร',
      a: '$9/10$ — ประตูเดิมยังเป็น $1/10$ ส่วนความน่าจะเป็น $9/10$ ที่เหลือไปกองที่ประตูสุดท้ายบานเดียว ยิ่งประตูมากยิ่งเห็นชัดว่าการเปลี่ยนได้เปรียบ' }
  ],
  render(el) {
    el.innerHTML =
      '<div class="card"><div class="grid g2">' +
      num('mtN', 'จำนวนเกมที่จะเล่น', 3000, 100, 'min="100" max="200000"') +
      sel('mtH', 'พิธีกร', [
        ['know', 'รู้ว่ารถอยู่ประตูไหน (เกมจริง)'],
        ['blind', 'ไม่รู้ — เปิดสุ่มจากสองประตูที่เหลือ']
      ], 'know') +
      '</div>' + runBar('mtGo') + '</div>' +
      '<div class="grid g2">' +
      '<div class="card"><div class="card-t">อัตราการชนะสะสม</div><canvas id="mtC1"></canvas>' +
      legend([['เปลี่ยนประตู', css('--accent')], ['อยู่ประตูเดิม', css('--danger')],
              ['เส้น 1/3 และ 2/3', css('--text-3')]]) + '</div>' +
      '<div class="card"><div class="card-t">ผลรวมทั้งหมด</div><div id="mtBars"></div></div>' +
      '</div><div id="mtOut"></div>';

    function go() {
      const N = Math.max(100, Math.min(200000, Math.round(V('mtN')) || 3000));
      const knows = T('mtH') === 'know';
      const keep = Math.max(1, Math.floor(N / 900));
      const xs = [], swR = [], stR = [];
      let stay = 0, sw = 0, played = 0, voided = 0;

      animate(el, N, Math.max(150, Math.ceil(N / 70)),
        i => {
          const car = Math.floor(Math.random() * 3);
          const pick = Math.floor(Math.random() * 3);
          let open;
          if (knows) {
            do { open = Math.floor(Math.random() * 3); } while (open === pick || open === car);
          } else {
            do { open = Math.floor(Math.random() * 3); } while (open === pick);
            if (open === car) { voided++; return; }   // พิธีกรเปิดเจอรถ — เกมนี้ใช้ไม่ได้
          }
          const other = 3 - pick - open;
          played++;
          if (pick === car) stay++;
          if (other === car) sw++;
          if (played % keep === 0 || i === N - 1) {
            xs.push(played); swR.push(sw / played); stR.push(stay / played);
          }
        },
        (done, fin) => {
          if (!played) return;
          if (!xs.length || xs[xs.length - 1] !== played) {
            xs.push(played); swR.push(sw / played); stR.push(stay / played);
          }
          const p1 = Plot($('mtC1'), { h: 250 });
          p1.domain(0, Math.max(played, 10), 0, 1);
          quietAxes(p1, 'จำนวนเกมที่นับได้', 5);
          hline(p1, 1 / 3, css('--text-3'), '1/3');
          hline(p1, 2 / 3, css('--text-3'), '2/3');
          polyline(p1, xs, stR, css('--danger'), 1.8);
          polyline(p1, xs, swR, css('--accent'), 1.8);

          const rs = sw / played, rt = stay / played;
          $('mtBars').innerHTML =
            meter('เปลี่ยนประตู', pct(rs) + ' (' + sw.toLocaleString('en-US') + ' เกม)', rs, 1, css('--accent')) +
            meter('อยู่ประตูเดิม', pct(rt) + ' (' + stay.toLocaleString('en-US') + ' เกม)', rt, 1, css('--danger')) +
            '<p style="font-size:13.5px;color:var(--text-2);margin:12px 0 0">' +
            'นับเกมที่ใช้ได้ ' + played.toLocaleString('en-US') + ' เกม' +
            (voided ? ' · ตัดออก ' + voided.toLocaleString('en-US') + ' เกมเพราะพิธีกรเปิดเจอรถ' : '') + '</p>';

          const theo = knows ? 2 / 3 : 0.5;
          $('mtOut').innerHTML =
            '<div class="grid g4" style="margin-bottom:14px">' +
            tile('เกมที่นับได้', played.toLocaleString('en-US'), fin ? 'ครบแล้ว' : 'กำลังเล่น…') +
            tile('ชนะเมื่อเปลี่ยน', pct(rs), 'ทฤษฎี ' + pct(theo), 'acc') +
            tile('ชนะเมื่ออยู่เดิม', pct(rt), 'ทฤษฎี ' + pct(knows ? 1 / 3 : 0.5)) +
            tile('เปลี่ยนดีกว่ากี่เท่า', f(rs / Math.max(rt, 1e-9), 2) + ' เท่า',
              knows ? 'คาดหมาย 2 เท่า' : 'คาดหมาย 1 เท่า', knows ? 'ok' : '') +
            '</div>' +
            obs(knows
              ? '<p>การเปลี่ยนประตูชนะ <b>' + pct(rs) + '</b> เทียบกับอยู่ประตูเดิม <b>' + pct(rt) +
                '</b> — ใกล้ $2/3$ กับ $1/3$ ตามทฤษฎี การเปลี่ยนประตูดีกว่าราว 2 เท่า</p>' +
                '<p>เหตุผล: เมื่อเลือกผิดตั้งแต่แรก (โอกาส $2/3$) พิธีกรถูกบังคับให้เปิดแพะอีกบาน ทำให้ประตูที่เหลือ<b>ต้อง</b>มีรถ การเปลี่ยนจึงชนะทุกครั้งในกรณีนี้</p>'
              : '<p>เมื่อพิธีกรไม่รู้ว่ารถอยู่ไหน อัตราชนะของการเปลี่ยนเหลือ <b>' + pct(rs) +
                '</b> ≈ 1/2 และมี ' + voided.toLocaleString('en-US') + ' เกมที่พิธีกรเปิดเจอรถจนเกมใช้ไม่ได้</p>' +
                '<p>ผู้เล่น “เห็น” แพะเหมือนเดิม แต่ผลลัพธ์ต่างกัน เพราะความน่าจะเป็นแบบมีเงื่อนไขขึ้นกับ<b>กลไกที่ทำให้ได้ข้อมูลนั้นมา</b> ไม่ใช่แค่สิ่งที่ปรากฏต่อสายตา</p>');
          mathify($('mtOut'));
        });
    }
    $('mtGo').onclick = go;
    $('mtN').onchange = go; $('mtH').onchange = go;
    go();
  }
};

/* ============================================================
   แลบ 3 — ทฤษฎีบทของเบส์กับการตรวจคัดกรองโรค
   ============================================================ */
LABS.screen = {
  no: 3, ch: 1, cat: 'บทที่ 1', icon: '🧪',
  name: 'เบส์กับการตรวจคัดกรองโรค',
  desc: 'ชุดตรวจแม่น 99% แต่ผลเป็นบวกแล้วป่วยจริงแค่ไหน — จำลองคนเป็นแสนคนเพื่อหาคำตอบ',
  goal: 'ใช้การจำลองประชากรขนาดใหญ่หาค่า $P(\\text{ป่วย} \\mid \\text{ผลบวก})$ เทียบกับค่าจากทฤษฎีบทของเบส์ และเข้าใจว่าความชุกของโรคมีผลต่อการแปลผลตรวจเพียงใด',
  theory: `
<p>ให้ $D$ = ป่วยจริง และ $+$ = ผลตรวจเป็นบวก คุณสมบัติของชุดตรวจคือ</p>
$$\\text{ความไว} = P(+\\mid D), \\qquad \\text{ความจำเพาะ} = P(-\\mid D^c)$$
<p>สิ่งที่คนไข้อยากรู้คือค่าที่<b>กลับทิศ</b> — จึงต้องใช้ทฤษฎีบทของเบส์</p>
$$P(D \\mid +) = \\frac{P(+\\mid D)\\,P(D)}{P(+\\mid D)\\,P(D) + P(+\\mid D^c)\\,P(D^c)}$$
<p>ตัวส่วนคือคนที่ได้ผลบวก<b>ทั้งหมด</b> ซึ่งรวมผลบวกลวงจากคนสุขภาพดีจำนวนมหาศาล เมื่อโรคหาได้ยาก กลุ่มคนสุขภาพดีใหญ่กว่ากลุ่มผู้ป่วยหลายเท่า ผลบวกลวงจึงท่วมผลบวกจริงได้</p>`,
  steps: [
    'ตั้งความชุกของโรค ความไว และความจำเพาะ แล้วกด “เริ่มการจำลอง” ระบบจะสุ่มคนทีละคนตามจำนวนที่กำหนด',
    'อ่านตารางสองทางที่ได้ แล้วเทียบ $P(D\\mid +)$ จากการจำลองกับค่าที่คำนวณจากเบส์',
    'ลดความชุกจาก 5% ลงเหลือ 0.1% โดยไม่แตะคุณภาพชุดตรวจ แล้วดูว่า $P(D\\mid +)$ เปลี่ยนไปอย่างไร',
    'ดูกราฟขวาซึ่งลากค่า $P(D\\mid +)$ ตามความชุกทุกระดับ จุดวงกลมคือค่าที่ตั้งไว้ปัจจุบัน'
  ],
  questions: [
    { q: 'ความไว 99% ความจำเพาะ 99% ความชุก 0.1% — ผลตรวจเป็นบวก มีโอกาสป่วยจริงเท่าไร',
      a: 'จากเบส์ $$P(D\\mid+) = \\frac{0.99 \\times 0.001}{0.99 \\times 0.001 + 0.01 \\times 0.999} \\approx 0.090$$ หรือเพียง <b>9%</b> เท่านั้น เพราะในคนล้านคนมีผู้ป่วย 1,000 คน (ตรวจเจอ 990) แต่คนสุขภาพดี 999,000 คนให้ผลบวกลวงถึงราว 9,990 คน' },
    { q: 'ทำไมการคัดกรองโรคหาได้ยากในคนทั่วไปจึงมักต้องตรวจยืนยันซ้ำ',
      a: 'เพราะผลบวกรอบแรกมีค่าทำนาย (PPV) ต่ำ การตรวจซ้ำด้วยวิธีที่จำเพาะสูงกว่าเป็นการทดสอบในกลุ่มที่<b>ความชุกสูงขึ้นแล้ว</b> (กลุ่มผลบวกรอบแรก) ทำให้ $P(D\\mid+)$ ของรอบสองสูงขึ้นมาก — เป็นการใช้เบส์ซ้ำสองชั้น' },
    { q: 'ถ้าอยากยก PPV ขึ้น ควรเพิ่มความไวหรือความจำเพาะ',
      a: 'เพิ่ม<b>ความจำเพาะ</b> มีผลมากกว่าเมื่อโรคหาได้ยาก เพราะตัวส่วนของเบส์ถูกครอบงำด้วยพจน์ $P(+\\mid D^c)P(D^c)$ ลองตั้งความจำเพาะเป็น 99.9% ในแลบนี้แล้วดูว่า PPV กระโดดขึ้นเท่าไร เทียบกับการเพิ่มความไวเป็น 100%' }
  ],
  render(el) {
    el.innerHTML =
      '<div class="card"><div class="grid g4">' +
      num('scPrev', 'ความชุกของโรค (%)', 0.5, 0.1, 'min="0.01" max="99" step="0.01"') +
      num('scSen', 'ความไว sensitivity (%)', 99, 0.1, 'min="1" max="100"') +
      num('scSpe', 'ความจำเพาะ specificity (%)', 99, 0.1, 'min="1" max="100"') +
      num('scN', 'จำนวนคนที่จำลอง', 200000, 10000, 'min="1000" max="2000000"') +
      '</div>' + runBar('scGo', '▶ จำลองประชากร') + '</div>' +
      '<div class="grid g2">' +
      '<div class="card"><div class="card-t">ตารางสองทางจากการจำลอง</div><div id="scTab"></div></div>' +
      '<div class="card"><div class="card-t">P(ป่วย | ผลบวก) ตามความชุก</div><canvas id="scC"></canvas>' +
      legend([['ค่าตามทฤษฎี', css('--accent')], ['ความชุกที่ตั้งไว้', css('--danger')]]) + '</div>' +
      '</div><div id="scOut"></div>';

    function go() {
      const prev = Math.max(0.0001, Math.min(0.99, (V('scPrev') || 0.5) / 100));
      const sen = Math.max(0.01, Math.min(1, (V('scSen') || 99) / 100));
      const spe = Math.max(0.01, Math.min(1, (V('scSpe') || 99) / 100));
      const N = Math.max(1000, Math.min(2000000, Math.round(V('scN')) || 200000));

      let tp = 0, fp = 0, fn = 0, tn = 0;
      for (let i = 0; i < N; i++) {
        if (Math.random() < prev) { if (Math.random() < sen) tp++; else fn++; }
        else { if (Math.random() < spe) tn++; else fp++; }
      }
      const pos = tp + fp, neg = tn + fn;
      const ppvSim = pos ? tp / pos : 0, npvSim = neg ? tn / neg : 0;
      const ppvTh = sen * prev / (sen * prev + (1 - spe) * (1 - prev));
      const npvTh = spe * (1 - prev) / (spe * (1 - prev) + (1 - sen) * prev);

      $('scTab').innerHTML =
        '<div class="tbl-wrap"><table class="tbl-mini"><thead><tr><th></th>' +
        '<th>ป่วยจริง</th><th>ไม่ป่วย</th><th>รวม</th></tr></thead><tbody>' +
        '<tr><td><b>ผลบวก (+)</b></td><td style="color:var(--ok)"><b>' + tp.toLocaleString('en-US') +
        '</b><br><small>บวกจริง</small></td><td style="color:var(--danger)"><b>' + fp.toLocaleString('en-US') +
        '</b><br><small>บวกลวง</small></td><td>' + pos.toLocaleString('en-US') + '</td></tr>' +
        '<tr><td><b>ผลลบ (−)</b></td><td style="color:var(--danger)"><b>' + fn.toLocaleString('en-US') +
        '</b><br><small>ลบลวง</small></td><td><b>' + tn.toLocaleString('en-US') +
        '</b><br><small>ลบจริง</small></td><td>' + neg.toLocaleString('en-US') + '</td></tr>' +
        '<tr><td><b>รวม</b></td><td>' + (tp + fn).toLocaleString('en-US') + '</td><td>' +
        (fp + tn).toLocaleString('en-US') + '</td><td>' + N.toLocaleString('en-US') + '</td></tr>' +
        '</tbody></table></div>' +
        meter('สัดส่วนผลบวกที่ป่วยจริง (PPV)', fp2(ppvSim), ppvSim, 1, css('--accent')) +
        '<p style="font-size:13.5px;color:var(--text-2);margin:10px 0 0">ในกลุ่มผลบวก ' +
        pos.toLocaleString('en-US') + ' คน ป่วยจริง <b>' + tp.toLocaleString('en-US') +
        '</b> คน และไม่ป่วย <b>' + fp.toLocaleString('en-US') + '</b> คน</p>';

      const p = Plot($('scC'), { h: 250 });
      p.domain(0, 20, 0, 1);
      quietAxes(p, 'ความชุกของโรค (%)', 5);
      p.curve(x => {
        const pr = x / 100;
        return sen * pr / (sen * pr + (1 - spe) * (1 - pr));
      }, css('--accent'));
      if (prev * 100 <= 20) {
        p.points([prev * 100], [ppvTh], css('--danger'));
        p.vline(prev * 100, css('--danger'), f(prev * 100, 2) + '%');
      }

      const fpPerTp = tp ? fp / tp : Infinity;
      $('scOut').innerHTML =
        '<div class="grid g4" style="margin-bottom:14px">' +
        tile('P(ป่วย | ผลบวก) จำลอง', fp2(ppvSim), 'ทฤษฎี ' + fp2(ppvTh), ppvSim < 0.5 ? 'warn' : 'ok') +
        tile('P(ไม่ป่วย | ผลลบ) จำลอง', f(npvSim * 100, 4) + '%', 'ทฤษฎี ' + f(npvTh * 100, 4) + '%', 'acc') +
        tile('ผลบวกลวงต่อผลบวกจริง', isFinite(fpPerTp) ? f(fpPerTp, 2) + ' : 1' : '—',
          'ยิ่งมากยิ่งแปลผลยาก') +
        tile('ผู้ป่วยที่ตรวจไม่เจอ', fn.toLocaleString('en-US') + ' คน',
          'จากผู้ป่วยทั้งหมด ' + (tp + fn).toLocaleString('en-US') + ' คน') +
        '</div>' +
        obs('<p>ชุดตรวจนี้ความไว ' + f(sen * 100, 1) + '% ความจำเพาะ ' + f(spe * 100, 1) +
          '% ฟังดูแม่นมาก แต่เมื่อความชุกเพียง ' + f(prev * 100, 2) +
          '% ผลตรวจเป็นบวกกลับหมายถึงป่วยจริงเพียง <b>' + fp2(ppvSim) + '</b></p>' +
          '<p>สาเหตุอยู่ที่ขนาดของกลุ่ม — คนไม่ป่วย ' + (fp + tn).toLocaleString('en-US') +
          ' คน แม้พลาดเพียง ' + f((1 - spe) * 100, 1) + '% ก็ให้ผลบวกลวงถึง ' + fp.toLocaleString('en-US') +
          ' คน เทียบกับผลบวกจริงเพียง ' + tp.toLocaleString('en-US') +
          ' คน นี่คือ <b>ความเข้าใจผิดเรื่องอัตราฐาน (base rate fallacy)</b></p>' +
          '<p>ค่าจากการจำลอง (' + fp2(ppvSim) + ') กับค่าจากทฤษฎีบทของเบส์ (' + fp2(ppvTh) +
          ') ต่างกันเพียง ' + f(Math.abs(ppvSim - ppvTh), 4) + ' — ยืนยันว่าสูตรเบส์ใช้ได้จริง</p>');
      mathify($('scOut'));
    }
    function fp2(x) { return f(x * 100, 2) + '%'; }
    $('scGo').onclick = go;
    ['scPrev', 'scSen', 'scSpe', 'scN'].forEach(id => { const e = $(id); if (e) e.onchange = go; });
    go();
  }
};

/* ============================================================
   แลบ 4 — ค่าคาดหมายกับความแปรปรวนในระยะยาว
   ============================================================ */
LABS.expect = {
  no: 4, ch: 2, cat: 'บทที่ 2', icon: '🎰',
  name: 'ค่าคาดหมายในระยะยาว',
  desc: 'เล่นเกมเสี่ยงโชคซ้ำหลายพันครั้ง ดูค่าเฉลี่ยที่ได้จริงลู่เข้าหา E(X) และดูว่าความแปรปรวนทำให้ผลของผู้เล่นแต่ละคนต่างกันแค่ไหน',
  goal: 'ตรวจสอบว่า $E(X)$ และ $V(X)$ ที่คำนวณจากการแจกแจงความน่าจะเป็นทำนายผลเฉลี่ยในระยะยาวได้จริง และเข้าใจว่า “ค่าคาดหมาย” ไม่ใช่สิ่งที่เกิดขึ้นในการเล่นครั้งเดียว',
  theory: `
<p>สำหรับตัวแปรเชิงสุ่มไม่ต่อเนื่อง $X$ ที่มีฟังก์ชันความน่าจะเป็น $p(x)$</p>
$$E(X) = \\sum x\\,p(x), \\qquad V(X) = \\sum (x - \\mu)^2 p(x) = E(X^2) - \\mu^2$$
<p>เมื่อเล่นซ้ำ $n$ ครั้งอย่างเป็นอิสระ กำไรเฉลี่ยต่อครั้ง $\\bar X$ มีสมบัติ</p>
$$E(\\bar X) = \\mu, \\qquad V(\\bar X) = \\frac{\\sigma^2}{n}$$
<p>ส่วนกำไร<b>รวม</b> $T = \\sum X_i$ นั้น $E(T) = n\\mu$ และ $SD(T) = \\sigma\\sqrt{n}$ — ค่าเฉลี่ยนิ่งขึ้นเมื่อ $n$ มาก แต่ยอดรวมเหวี่ยงกว้างขึ้นเรื่อย ๆ</p>`,
  steps: [
    'เลือกสถานการณ์ หรือเลือก “กำหนดเอง” แล้วพิมพ์คู่ (ค่า, ความน่าจะเป็น) บรรทัดละคู่',
    'กด “เริ่มการจำลอง” แล้วดูกราฟซ้าย — เส้นคือกำไรเฉลี่ยสะสม เส้นประคือ $E(X)$ ตามทฤษฎี',
    'เทียบตารางความน่าจะเป็นทฤษฎีกับความถี่สัมพัทธ์ที่สุ่มได้',
    'ดูกราฟขวา — ให้ผู้เล่นหลายคนเล่นคนละ n ครั้ง แล้วดูการกระจายของกำไรรวมต่อคน',
    'ลองเปลี่ยนจำนวนครั้งที่เล่นจาก 100 เป็น 10,000 แล้วสังเกตว่าอะไรนิ่งขึ้นและอะไรเหวี่ยงกว้างขึ้น'
  ],
  questions: [
    { q: 'ลอตเตอรี่มี $E(X) < 0$ ทำไมยังมีคนถูกรางวัลใหญ่',
      a: 'เพราะ $E(X)$ เป็นค่าเฉลี่ย<b>ระยะยาวของทั้งระบบ</b> ไม่ใช่ผลของคนคนเดียว การแจกแจงเบ้ขวาจัด: คนส่วนใหญ่ขาดทุนเล็กน้อยทุกงวด แต่มีคนจำนวนน้อยมากได้เงินก้อนใหญ่ ค่าเฉลี่ยที่ติดลบจึงอยู่ร่วมกับการมีผู้ถูกรางวัลได้' },
    { q: 'ถ้า $E(X) = -37.5$ บาทต่อใบ แล้วซื้อ 1,000 ใบจะเป็นอย่างไร',
      a: 'คาดหมายขาดทุน $1000 \\times 37.5 = 37{,}500$ บาท และ $SD(T) = \\sigma\\sqrt{1000}$ ซึ่งยังใหญ่มากเพราะ $\\sigma$ ของลอตเตอรี่สูง การซื้อมากขึ้นทำให้<b>ค่าเฉลี่ยต่อใบ</b>นิ่งขึ้น แต่ไม่ได้ลดการขาดทุนรวม — กลับเพิ่มขึ้นตาม $n$' },
    { q: 'บริษัทประกันขายกรมธรรม์ที่มี $E(X)$ เป็นบวกเพียงเล็กน้อย เพราะอะไรจึงยังอยู่รอด',
      a: 'เพราะขายกรมธรรม์จำนวนมากและความเสี่ยงเป็นอิสระต่อกัน ทำให้ $SD(\\bar X) = \\sigma/\\sqrt{n}$ เล็กลง กำไรเฉลี่ยต่อกรมธรรม์จึงเกือบแน่นอน — นี่คือการนำกฎจำนวนมากมาใช้เป็นแบบธุรกิจ แต่จะพังเมื่อความเสี่ยง<b>ไม่เป็นอิสระ</b> เช่น ภัยพิบัติที่เคลมพร้อมกันทั้งพื้นที่' }
  ],
  render(el) {
    el.innerHTML =
      '<div class="card"><div class="grid g3">' +
      sel('exS', 'สถานการณ์', [
        ['dice', 'ทอยลูกเต๋า 1 ลูก — ได้เงินเท่าแต้ม จ่ายค่าเล่น 4 บาท'],
        ['lotto', 'ลอตเตอรี่ (อย่างง่าย) — ใบละ 80 บาท'],
        ['insur', 'ประกันภัย — มองจากฝั่งบริษัท'],
        ['wheel', 'วงล้อเสี่ยงโชค — ลงทุน 10 บาท'],
        ['custom', 'กำหนดเอง']
      ], 'dice') +
      num('exN', 'จำนวนครั้งที่เล่น (ต่อผู้เล่น 1 คน)', 2000, 100, 'min="20" max="200000"') +
      num('exK', 'จำนวนผู้เล่นในกราฟขวา', 2000, 100, 'min="100" max="20000"') +
      '</div>' +
      '<div id="exCustom" style="display:none">' +
      '<div class="field"><label>กำหนดเอง — บรรทัดละ “ค่า ความน่าจะเป็น”</label>' +
      '<textarea id="exT" placeholder="เช่น\n100 0.1\n0 0.9">-10 0.5\n5 0.3\n30 0.2</textarea></div></div>' +
      runBar('exGo') + '</div>' +
      '<div class="grid g2">' +
      '<div class="card"><div class="card-t">กำไรเฉลี่ยสะสมต่อครั้ง</div><canvas id="exC1"></canvas>' +
      legend([['ค่าเฉลี่ยที่ได้จริง', css('--accent')], ['E(X) ทฤษฎี', css('--danger')]]) + '</div>' +
      '<div class="card"><div class="card-t">กำไรรวมของผู้เล่นแต่ละคน</div><canvas id="exC2"></canvas>' +
      legend([['จำนวนผู้เล่น', css('--violet')], ['จุดคุ้มทุน (0)', css('--text-3')]]) + '</div>' +
      '</div><div id="exOut"></div>';

    const SC = {
      dice: { lab: 'กำไรต่อการทอย (บาท)', pmf: [1, 2, 3, 4, 5, 6].map(v => [v - 4, 1 / 6]) },
      lotto: {
        lab: 'กำไรต่อใบ (บาท)',
        pmf: [[6000000 - 80, 1e-6], [100000 - 80, 5e-6], [4000 - 80, 0.004], [2000 - 80, 0.01],
              [-80, 1 - 1e-6 - 5e-6 - 0.004 - 0.01]]
      },
      insur: { lab: 'กำไรของบริษัทต่อกรมธรรม์ (บาท)', pmf: [[1200 - 100000, 0.008], [1200, 0.992]] },
      wheel: { lab: 'กำไรต่อการหมุน (บาท)', pmf: [[-10, 0.5], [0, 0.25], [10, 0.15], [40, 0.08], [100, 0.02]] }
    };
    function getPmf() {
      const k = T('exS');
      if (k !== 'custom') return SC[k];
      const rows = [];
      T('exT').split(/\n+/).forEach(line => {
        const m = line.trim().split(/[\s,]+/).map(Number);
        if (m.length >= 2 && isFinite(m[0]) && isFinite(m[1]) && m[1] > 0) rows.push([m[0], m[1]]);
      });
      const tot = rows.reduce((s, r) => s + r[1], 0);
      if (!rows.length || tot <= 0) return null;
      return { lab: 'ค่าของ X', pmf: rows.map(r => [r[0], r[1] / tot]) };
    }

    function go() {
      $('exCustom').style.display = T('exS') === 'custom' ? '' : 'none';
      const sc = getPmf();
      const out = $('exOut');
      if (!sc) { out.innerHTML = '<div class="result empty">กรุณาใส่ค่าและความน่าจะเป็นอย่างน้อย 1 บรรทัด</div>'; return; }
      const pmf = sc.pmf;
      const n = Math.max(20, Math.min(200000, Math.round(V('exN')) || 2000));
      const K = Math.max(100, Math.min(20000, Math.round(V('exK')) || 2000));

      const mu = pmf.reduce((s, r) => s + r[0] * r[1], 0);
      const ex2 = pmf.reduce((s, r) => s + r[0] * r[0] * r[1], 0);
      const varX = ex2 - mu * mu, sd = Math.sqrt(Math.max(0, varX));

      const keep = Math.max(1, Math.floor(n / 800));
      const xs = [], avg = [];
      const cnt = new Map();
      let sum = 0;

      // ผู้เล่นคนแรก — ติดตามค่าเฉลี่ยสะสมทีละครั้ง
      for (let i = 0; i < n; i++) {
        const v = randFrom(pmf);
        sum += v;
        cnt.set(v, (cnt.get(v) || 0) + 1);
        if ((i + 1) % keep === 0 || i === n - 1) { xs.push(i + 1); avg.push(sum / (i + 1)); }
      }
      // ผู้เล่นอีก K คน — แต่ละคนเล่น n ครั้ง เก็บกำไรรวม
      const nT = Math.min(n, 4000);                 // จำกัดงานคำนวณของกราฟขวา
      const totals = new Array(K);
      for (let k = 0; k < K; k++) {
        let t = 0;
        for (let i = 0; i < nT; i++) t += randFrom(pmf);
        totals[k] = t;
      }

      const sdAvg = sd / Math.sqrt(n);
      const p1 = Plot($('exC1'), { h: 250 });
      const lim = Math.max(Math.abs(mu) + 4.2 * sdAvg, Math.max.apply(null, avg.map(Math.abs)) * 1.15, 1);
      p1.domain(0, n, mu - lim, mu + lim);
      quietAxes(p1, 'จำนวนครั้งที่เล่น', 5);
      hline(p1, mu, css('--danger'), 'E(X) = ' + f(mu, 3));
      polyline(p1, xs, avg, css('--accent'), 1.8);

      const p2 = Plot($('exC2'), { h: 250 });
      const nb = Math.min(40, Math.max(12, Math.round(Math.sqrt(K))));
      p2.hist(totals, nb, css('--violet'));
      p2.vline(0, css('--text-3'), 'คุ้มทุน');
      p2.vline(nT * mu, css('--danger'), 'n·E(X)');

      const lossRate = totals.filter(t => t < 0).length / K;
      const relFreq = pmf.map(r => [r[0], r[1], (cnt.get(r[0]) || 0) / n]);
      const showRows = relFreq.length <= 12 ? relFreq
        : relFreq.slice().sort((a, b) => b[1] - a[1]).slice(0, 12);

      out.innerHTML =
        '<div class="grid g4" style="margin-bottom:14px">' +
        tile('E(X) ทฤษฎี', f(mu, 4), sc.lab, 'acc') +
        tile('ค่าเฉลี่ยที่ได้จริง', f(sum / n, 4), 'จาก ' + n.toLocaleString('en-US') + ' ครั้ง') +
        tile('V(X) ทฤษฎี', f(varX, 3), 'SD = ' + f(sd, 3)) +
        tile('SD ของค่าเฉลี่ย', f(sdAvg, 4), 'σ/√n เมื่อ n = ' + n.toLocaleString('en-US')) +
        '</div>' +
        '<div class="grid g2">' +
        '<div class="card"><div class="card-t">ความน่าจะเป็นทฤษฎีเทียบกับความถี่ที่สุ่มได้</div>' +
        '<div class="tbl-wrap"><table class="tbl-mini"><thead><tr><th>ค่า x</th><th>p(x) ทฤษฎี</th>' +
        '<th>ความถี่สัมพัทธ์</th></tr></thead><tbody>' +
        showRows.map(r => '<tr><td>' + r[0].toLocaleString('en-US') + '</td><td>' + f(r[1], 6) +
          '</td><td>' + f(r[2], 6) + '</td></tr>').join('') +
        '</tbody></table></div>' +
        (relFreq.length > 12 ? '<p style="font-size:12.5px;color:var(--text-3);margin:9px 0 0">แสดง 12 ค่าที่มีความน่าจะเป็นสูงสุด</p>' : '') +
        '</div>' +
        '<div class="card"><div class="card-t">ผลของผู้เล่น ' + K.toLocaleString('en-US') + ' คน (คนละ ' +
        nT.toLocaleString('en-US') + ' ครั้ง)</div>' +
        row('กำไรรวมเฉลี่ยต่อคน', f(S.mean(totals), 2)) +
        row('ค่าคาดหมายของกำไรรวม n·E(X)', f(nT * mu, 2)) +
        row('SD ของกำไรรวม (จำลอง)', f(S.sd(totals), 2)) +
        row('SD ทฤษฎี σ√n', f(sd * Math.sqrt(nT), 2)) +
        row('สัดส่วนผู้เล่นที่ขาดทุน', pct(lossRate)) +
        row('กำไรสูงสุด / ต่ำสุดที่พบ', f(Math.max.apply(null, totals), 0) + ' / ' + f(Math.min.apply(null, totals), 0)) +
        '</div></div>' +
        obs('<p>ค่าเฉลี่ยที่ได้จริงหลังเล่น ' + n.toLocaleString('en-US') + ' ครั้งคือ <b>' + f(sum / n, 4) +
          '</b> เทียบกับ $E(X) = ' + f(mu, 4) + '$ — ต่างกัน ' + f(Math.abs(sum / n - mu), 4) +
          ' ขณะที่ทฤษฎีบอกว่าควรเหวี่ยงราว ' + f(sdAvg, 4) + '</p>' +
          '<p>ในบรรดาผู้เล่น ' + K.toLocaleString('en-US') + ' คน มี <b>' + pct(lossRate) +
          '</b> ที่ขาดทุน ทั้งที่ทุกคนเล่นเกมเดียวกันและเล่นจำนวนครั้งเท่ากัน — ' +
          (mu < 0 ? 'เมื่อ $E(X)$ ติดลบ ยิ่งเล่นมากยิ่งเกือบแน่ว่าจะขาดทุน'
                  : 'เมื่อ $E(X)$ เป็นบวก ยิ่งเล่นมากยิ่งเกือบแน่ว่าจะได้กำไร') + '</p>' +
          '<p>ข้อสรุป: $E(X)$ ทำนาย<b>ค่าเฉลี่ยระยะยาว</b> ได้แม่น แต่ไม่ได้ทำนายผลของการเล่นครั้งเดียว ความแปรปรวนคือสิ่งที่ตัดสินว่าใครได้ใครเสีย</p>');
      mathify(out);
    }
    $('exGo').onclick = go;
    ['exS', 'exN', 'exK', 'exT'].forEach(id => { const e = $(id); if (e) e.onchange = go; });
    go();
  }
};

/* ============================================================
   แลบ 5 — ทำไมต้องใช้ t ไม่ใช่ Z
   ============================================================ */
LABS.tvsz = {
  no: 5, ch: 3, cat: 'บทที่ 3', icon: '🔔',
  name: 'ทำไมต้องใช้ t ไม่ใช่ Z',
  desc: 'สุ่มตัวอย่างซ้ำหลายพันชุด ดูการแจกแจงของ Z, t และ (n−1)S²/σ² พร้อมวัดว่าถ้าใช้ Z แทน t จะพลาดเพิ่มขึ้นกี่เปอร์เซ็นต์',
  goal: 'ตรวจสอบว่าสถิติทดสอบที่ใช้ $S$ แทน $\\sigma$ มีการแจกแจงหางหนากว่าปรกติ และวัดผลเสียเชิงตัวเลขของการใช้ค่าวิกฤต $Z$ เมื่อไม่ทราบ $\\sigma$',
  theory: `
<p>สุ่มตัวอย่างขนาด $n$ จากประชากรปรกติ $N(\\mu, \\sigma^2)$ จะได้สามข้อเท็จจริงสำคัญ</p>
$$Z = \\frac{\\bar X - \\mu}{\\sigma/\\sqrt n} \\sim N(0,1), \\qquad
\\frac{(n-1)S^2}{\\sigma^2} \\sim \\chi^2_{\\,n-1}$$
$$T = \\frac{\\bar X - \\mu}{S/\\sqrt n} \\sim t_{\\,n-1}$$
<p>ความต่างอยู่ที่ตัวส่วน — $Z$ หารด้วยค่าคงที่ $\\sigma$ แต่ $T$ หารด้วย $S$ ซึ่ง<b>สุ่มไปด้วย</b> ความไม่แน่นอนสองชั้นนี้ทำให้หางของ $t$ หนากว่า และต้องใช้ค่าวิกฤตที่กว้างกว่า</p>`,
  steps: [
    'ตั้งขนาดตัวอย่างเป็น $n = 5$ ก่อน แล้วกด “เริ่มการจำลอง”',
    'ดูกราฟ Z — ฮิสโทแกรมควรทับเส้นโค้ง $N(0,1)$ พอดี',
    'ดูกราฟ T — เทียบเส้นทึบ ($t_{n-1}$) กับเส้นประ ($N(0,1)$) สังเกตว่ายอดเตี้ยกว่าและหางหนากว่า',
    'ดูกราฟ $(n-1)S^2/\\sigma^2$ ว่าเบ้ขวาและตรงกับเส้นโค้งไคกำลังสอง $df = n-1$',
    'อ่านตาราง “ผลของการเลือกค่าวิกฤตผิด” แล้วค่อย ๆ เพิ่ม $n$ เป็น 10, 30, 100 ดูว่าช่องว่างแคบลงอย่างไร'
  ],
  questions: [
    { q: 'ที่ $n = 5$ ถ้าใช้ค่าวิกฤต 1.96 ทั้งที่ไม่ทราบ $\\sigma$ ความคลาดเคลื่อนแบบที่ 1 จริงเป็นเท่าไร',
      a: 'ประมาณ 11–12% ไม่ใช่ 5% (ค่าที่ถูกต้องคือ $t_{0.025,4} = 2.776$) การใช้ $Z$ ทำให้<b>ปฏิเสธ $H_0$ ง่ายเกินจริง</b> คือสรุปว่ามีผลต่างบ่อยกว่าที่ควร ซึ่งเป็นความผิดพลาดที่ร้ายแรงในงานวิจัย' },
    { q: 'ทำไม $E(S^2) = \\sigma^2$ แต่ $E(S) < \\sigma$',
      a: 'เพราะการหารด้วย $n-1$ ทำให้ $S^2$ ไม่เอนเอียง แต่รากที่สองเป็นฟังก์ชัน<b>เว้าลง</b> จากอสมการเจนเซน $E(\\sqrt{S^2}) < \\sqrt{E(S^2)} = \\sigma$ ดังนั้น $S$ เอนเอียงต่ำกว่า $\\sigma$ เล็กน้อยเสมอ เห็นได้จากตารางในแลบนี้' },
    { q: 'เมื่อ $n$ ใหญ่ขึ้น ทำไม $t$ จึงเข้าใกล้ $Z$',
      a: 'เพราะ $S$ ประมาณ $\\sigma$ ได้แม่นขึ้น ($V(S^2) = 2\\sigma^4/(n-1) \\to 0$) ตัวส่วนจึงเกือบเป็นค่าคงที่ ทำให้ $t_{n-1} \\to N(0,1)$ ในทางปฏิบัติที่ $n \\ge 30$ ค่าวิกฤตต่างกันไม่ถึง 4% แต่ที่ $n$ เล็กต่างกันมาก' }
  ],
  render(el) {
    el.innerHTML =
      '<div class="card"><div class="grid g3">' +
      num('tzN', 'ขนาดตัวอย่าง n', 5, 1, 'min="2" max="200"') +
      num('tzK', 'จำนวนตัวอย่างที่สุ่มซ้ำ', 8000, 1000, 'min="500" max="60000"') +
      sel('tzP', 'ประชากร', shapeOpts(['norm', 'unif', 'exp', 'lnorm']), 'norm') +
      '</div>' +
      slider('tzR', 'เลื่อนปรับ n', 2, 60, 5) +
      runBar('tzGo') + '</div>' +
      '<div class="grid g3">' +
      '<div class="card"><div class="card-t">Z = (x̄ − μ)/(σ/√n)</div><canvas id="tzC1"></canvas>' +
      legend([['จำลอง', css('--accent')], ['N(0,1)', css('--danger')]]) + '</div>' +
      '<div class="card"><div class="card-t">T = (x̄ − μ)/(S/√n)</div><canvas id="tzC2"></canvas>' +
      legend([['จำลอง', css('--violet')], ['t(n−1)', css('--danger')], ['N(0,1)', css('--text-3')]]) + '</div>' +
      '<div class="card"><div class="card-t">(n−1)S²/σ²</div><canvas id="tzC3"></canvas>' +
      legend([['จำลอง', css('--accent-2')], ['χ²(n−1)', css('--danger')]]) + '</div>' +
      '</div><div id="tzOut"></div>';

    function go() {
      const n = Math.max(2, Math.min(200, Math.round(V('tzN')) || 5));
      const K = Math.max(500, Math.min(60000, Math.round(V('tzK')) || 8000));
      const shape = T('tzP');
      const mu = 50, sg = 10, df = n - 1;

      const zs = [], ts = [], ws = [], s2s = [], sds = [];
      for (let k = 0; k < K; k++) {
        const a = sampleShape(shape, n, mu, sg);
        const m = S.mean(a), sd = S.sd(a);
        zs.push((m - mu) / (sg / Math.sqrt(n)));
        ts.push(sd > 0 ? (m - mu) / (sd / Math.sqrt(n)) : 0);
        ws.push(df * sd * sd / (sg * sg));
        s2s.push(sd * sd); sds.push(sd);
      }

      // Z กับ N(0,1)
      const p1 = Plot($('tzC1'), { h: 235 });
      const d1 = densBins(zs, 34, -4, 4);
      p1.domain(-4, 4, 0, Math.max(0.42, Math.max.apply(null, d1.dens)) * 1.12);
      quietAxes(p1, 'Z', 4);
      drawDens(p1, d1, css('--accent'));
      p1.curve(x => S.normPdf(x, 0, 1), css('--danger'));

      // T กับ t(df) และ N(0,1)
      const tl = Math.max(3.9, Math.min(5.5, S.tInv(0.995, df)));
      const p2 = Plot($('tzC2'), { h: 235 });
      const d2 = densBins(ts, 40, -tl, tl);
      p2.domain(-tl, tl, 0, Math.max(0.42, Math.max.apply(null, d2.dens)) * 1.12);
      quietAxes(p2, 'T', 4);
      drawDens(p2, d2, css('--violet'));
      p2.curve(x => S.normPdf(x, 0, 1), css('--text-3'));
      p2.curve(x => S.tPdf(x, df), css('--danger'));

      // (n−1)S²/σ² กับ χ²(df)
      const wmax = Math.max(S.chiInv(0.999, df), 4);
      const p3 = Plot($('tzC3'), { h: 235 });
      const d3 = densBins(ws, 34, 0, wmax);
      const chiPeak = df > 2 ? S.chiPdf(df - 2, df) : S.chiPdf(0.05, df);
      p3.domain(0, wmax, 0, Math.max(chiPeak, Math.max.apply(null, d3.dens)) * 1.15);
      quietAxes(p3, '(n−1)S²/σ²', 4);
      drawDens(p3, d3, css('--accent-2'));
      p3.curve(x => S.chiPdf(x, df), css('--danger'));

      const zc = 1.959964, tc = S.tInv(0.975, df);
      const useZ = ts.filter(t => Math.abs(t) > zc).length / K;
      const useT = ts.filter(t => Math.abs(t) > tc).length / K;
      const zOnZ = zs.filter(z => Math.abs(z) > zc).length / K;
      const mS2 = S.mean(s2s), mSd = S.mean(sds);
      const eS = sg * Math.sqrt(2 / df) * Math.exp(S.gammaln(n / 2) - S.gammaln(df / 2));

      $('tzOut').innerHTML =
        '<div class="grid g4" style="margin-bottom:14px">' +
        tile('ค่าวิกฤตที่ถูกต้อง t₀.₀₂₅,' + df, f(tc, 4), 'กว้างกว่า Z = 1.9600 อยู่ ' +
          f((tc / zc - 1) * 100, 1) + '%', 'acc') +
        tile('ใช้ t (ถูก) ปฏิเสธจริง', pct(useT), 'ควรได้ 5%', Math.abs(useT - 0.05) < 0.012 ? 'ok' : '') +
        tile('ใช้ Z (ผิด) ปฏิเสธจริง', pct(useZ), 'สูงเกินเป้า ' + f((useZ - 0.05) * 100, 2) + ' จุด',
          useZ > 0.065 ? 'danger' : useZ > 0.056 ? 'warn' : 'ok') +
        tile('ความเบ้ของ T', f(S.skewness(ts), 3), 'ความโด่ง ' + f(S.kurtosis(ts), 2) + ' (ปรกติ = 0)') +
        '</div>' +
        '<div class="grid g2">' +
        '<div class="card"><div class="card-t">ผลของการเลือกค่าวิกฤตผิด (α เป้าหมาย 5%)</div>' +
        row('ใช้ Z กับสถิติ Z (ทราบ σ)', pct(zOnZ) + ' <small style="color:var(--text-3)">— ถูกต้อง</small>') +
        row('ใช้ t<sub>' + df + '</sub> กับสถิติ T (ไม่ทราบ σ)', pct(useT) + ' <small style="color:var(--ok)">— ถูกต้อง</small>') +
        row('ใช้ Z กับสถิติ T (ไม่ทราบ σ)', '<span style="color:' +
          (useZ > 0.065 ? 'var(--danger)' : 'var(--text)') + '">' + pct(useZ) + '</span>' +
          ' <small style="color:var(--text-3)">— พลาดเพิ่ม ' + f(useZ / 0.05, 2) + ' เท่า</small>') +
        '</div>' +
        '<div class="card"><div class="card-t">S² ไม่เอนเอียง แต่ S เอนเอียง</div>' +
        row('σ² จริง', f(sg * sg, 3)) +
        row('ค่าเฉลี่ยของ S² ที่สุ่มได้', f(mS2, 3) + ' <small style="color:var(--ok)">≈ σ²</small>') +
        row('σ จริง', f(sg, 4)) +
        row('ค่าเฉลี่ยของ S ที่สุ่มได้', f(mSd, 4) + ' <small style="color:var(--warn)">< σ</small>') +
        row('E(S) ตามทฤษฎี', f(eS, 4)) +
        '</div></div>' +
        obs('<p>ที่ $n = ' + n + '$ การใช้ค่าวิกฤต $Z = 1.96$ ทั้งที่ไม่ทราบ $\\sigma$ ทำให้ปฏิเสธ $H_0$ จริง <b>' +
          pct(useZ) + '</b> แทนที่จะเป็น 5% — คลาดเคลื่อนแบบที่ 1 สูงกว่าเป้าหมาย ' + f(useZ / 0.05, 2) +
          ' เท่า ขณะที่การใช้ $t_{' + df + '} = ' + f(tc, 3) + '$ ให้ <b>' + pct(useT) + '</b> ซึ่งตรงเป้า</p>' +
          '<p>ความโด่ง (kurtosis) ของ $T$ เท่ากับ ' + f(S.kurtosis(ts), 2) +
          ' เทียบกับ 0 ของการแจกแจงปรกติ — ตัวเลขนี้คือ “หางหนา” ที่เห็นในกราฟกลาง</p>' +
          (shape !== 'norm'
            ? '<p><b>หมายเหตุ:</b> ประชากรที่เลือกไม่ใช่ปรกติ ผลของ $(n-1)S^2/\\sigma^2$ จะ<b>ไม่</b>ตรงกับเส้นไคกำลังสอง เพราะข้อสมมติเรื่องความปรกติเป็นเงื่อนไขจำเป็นสำหรับการแจกแจงของ $S^2$ (ต่างจาก $\\bar X$ ที่มี CLT ช่วย)</p>'
            : '<p>ลองเปลี่ยนประชากรเป็นแบบเบ้ขวา แล้วดูว่ากราฟขวา (ไคกำลังสอง) เพี้ยนไปอย่างไร — $\\bar X$ มี CLT ช่วย แต่ $S^2$ ไม่มี</p>'));
      mathify($('tzOut'));
    }
    $('tzGo').onclick = go;
    ['tzN', 'tzK', 'tzP'].forEach(id => { const e = $(id); if (e) e.onchange = go; });
    const r = $('tzR');
    r.oninput = () => { $('tzRV').textContent = r.value; $('tzN').value = r.value; go(); };
    $('tzN').oninput = () => {
      const v = Math.max(2, Math.min(60, Math.round(V('tzN')) || 5));
      r.value = v; $('tzRV').textContent = v;
    };
    go();
  }
};

/* ============================================================
   แลบ 6 — "95%" หมายความว่าอะไร
   ============================================================ */
LABS.cicover = {
  no: 6, ch: 4, cat: 'บทที่ 4', icon: '📏',
  name: 'ความหมายจริงของช่วงความเชื่อมั่น 95%',
  desc: 'สร้างช่วงความเชื่อมั่น 100 ช่วงจากประชากรที่รู้ค่า μ จริง แล้วนับว่ากี่ช่วงคลุม μ ได้ พร้อมทดลองใช้สูตรผิดดูว่าเกิดอะไรขึ้น',
  goal: 'ตีความคำว่า “ระดับความเชื่อมั่น 95%” ให้ถูกต้องว่าเป็นอัตราการคลุมในระยะยาว และวัดผลเสียเมื่อใช้ค่าวิกฤตผิดหรือประชากรไม่ปรกติ',
  theory: `
<p>ช่วงความเชื่อมั่นของ $\\mu$ เมื่อไม่ทราบ $\\sigma$ คือ</p>
$$\\bar x \\pm t_{\\alpha/2,\\,n-1}\\frac{s}{\\sqrt n}$$
<p>คำว่า “เชื่อมั่น 95%” หมายถึง<b>วิธีการ</b> ไม่ใช่ช่วงใดช่วงหนึ่ง — ถ้าทำซ้ำหลายครั้ง ช่วงที่สร้างได้ประมาณ 95% จะคลุมค่า $\\mu$ จริง</p>
$$P\\big(\\bar X - t_{\\alpha/2}\\tfrac{S}{\\sqrt n} < \\mu < \\bar X + t_{\\alpha/2}\\tfrac{S}{\\sqrt n}\\big) = 0.95$$
<p>ความน่าจะเป็นนี้อยู่กับ $\\bar X$ และ $S$ ซึ่งสุ่ม ไม่ได้อยู่กับ $\\mu$ ซึ่งเป็นค่าคงที่ ดังนั้นเมื่อคำนวณออกมาเป็นตัวเลขแล้ว เช่น $(48.2, 52.6)$ จะพูดว่า “$\\mu$ มีโอกาส 95% ที่จะอยู่ในช่วงนี้” <b>ไม่ได้</b></p>`,
  steps: [
    'กด “เริ่มการจำลอง” — แต่ละเส้นนอนคือหนึ่งช่วงความเชื่อมั่นจากหนึ่งตัวอย่าง เส้นตั้งคือ $\\mu$ จริง',
    'นับเส้นสีแดง (ช่วงที่พลาด) จาก 100 เส้น ว่าใกล้ 5 เส้นหรือไม่ แล้วกดซ้ำหลายรอบ',
    'ดูตัวเลข “อัตราการคลุมระยะยาว” ที่ได้จากการทำซ้ำหลายพันรอบ ว่าใกล้ระดับความเชื่อมั่นที่ตั้งไว้',
    'เปลี่ยนวิธีเป็น “ไม่ทราบ σ แต่ใช้ Z” แล้วดูว่าอัตราการคลุมตกลงไปเท่าไร',
    'เปลี่ยนประชากรเป็นแบบเบ้ขวาจัดที่ $n = 5$ แล้วเทียบกับ $n = 40$ ดูว่า CLT ช่วยได้มากน้อยเพียงใด'
  ],
  questions: [
    { q: 'คำกล่าวที่ว่า “μ มีโอกาส 95% ที่จะอยู่ในช่วง (48.2, 52.6)” ผิดอย่างไร',
      a: 'เพราะ $\\mu$ เป็นค่าคงที่ ไม่ใช่ตัวแปรเชิงสุ่ม ช่วงที่คำนวณเสร็จแล้วก็เป็นตัวเลขคงที่ — มันคลุมหรือไม่คลุม $\\mu$ เท่านั้น (ความน่าจะเป็น 0 หรือ 1) สิ่งที่เป็น 95% คือ<b>อัตราความสำเร็จของวิธีการ</b> เมื่อใช้ซ้ำหลายครั้ง อย่างที่เห็นในกราฟว่าจาก 100 ช่วงมีราว 95 ช่วงที่คลุม' },
    { q: 'ถ้าเพิ่มระดับความเชื่อมั่นจาก 95% เป็น 99% ต้องแลกกับอะไร',
      a: 'ช่วงจะ<b>กว้างขึ้น</b> เพราะ $t_{0.005}>t_{0.025}$ ได้ความมั่นใจมากขึ้นแต่ได้ข้อมูลที่เจาะจงน้อยลง ดูค่า “ความกว้างเฉลี่ย” ในแลบนี้ประกอบ วิธีที่ได้ทั้งแคบและมั่นใจคือเพิ่ม $n$ เพราะความกว้างลดตาม $1/\\sqrt n$' },
    { q: 'เมื่อประชากรเบ้ขวาจัดและ n เล็ก อัตราการคลุมจริงเป็นอย่างไร',
      a: 'ต่ำกว่าที่ประกาศไว้ (เช่นได้ราว 88–92% แทน 95%) เพราะสูตร $t$ ต้องการข้อสมมติว่าประชากรปรกติ เมื่อ $n$ ใหญ่ขึ้น CLT ทำให้ $\\bar X$ เข้าใกล้ปรกติและอัตราการคลุมกลับมาใกล้ 95% — นี่คือเหตุผลที่ต้องตรวจรูปร่างข้อมูลก่อนใช้สูตร หรือหันไปใช้วิธีไม่ใช้พารามิเตอร์ในบทที่ 6' }
  ],
  render(el) {
    el.innerHTML =
      '<div class="card">' +
      '<div class="field"><label>วิธีสร้างช่วง</label>' +
      segment('ciM', [
        ['t', 'ไม่ทราบ σ → ใช้ t (ถูกต้อง)'],
        ['z', 'ไม่ทราบ σ แต่ใช้ Z (ผิด)'],
        ['zk', 'ทราบ σ → ใช้ Z (ถูกต้อง)']
      ], 't') + '</div>' +
      '<div class="grid g4">' +
      num('ciN', 'ขนาดตัวอย่าง n', 15, 1, 'min="2" max="200"') +
      sel('ciL', 'ระดับความเชื่อมั่น', [['0.90', '90%'], ['0.95', '95%'], ['0.99', '99%']], '0.95') +
      sel('ciP', 'ประชากร', shapeOpts(['norm', 'unif', 'exp', 'lnorm', 'heavy', 'bi']), 'norm') +
      num('ciK', 'จำนวนรอบสำหรับอัตราระยะยาว', 10000, 1000, 'min="1000" max="100000"') +
      '</div>' + runBar('ciGo') + '</div>' +
      '<div class="card"><div class="card-t">ช่วงความเชื่อมั่น 100 ช่วงจาก 100 ตัวอย่าง</div>' +
      '<canvas id="ciC"></canvas>' +
      legend([['คลุม μ', css('--accent')], ['พลาด μ', css('--danger')], ['μ จริง', css('--text-2')]]) +
      '</div><div id="ciOut"></div>';

    function go() {
      const method = segVal('ciM') || 't';
      const n = Math.max(2, Math.min(200, Math.round(V('ciN')) || 15));
      const conf = parseFloat(T('ciL')) || 0.95;
      const shape = T('ciP');
      const K = Math.max(1000, Math.min(100000, Math.round(V('ciK')) || 10000));
      const mu = 100, sg = 15, alpha = 1 - conf;
      const crit = method === 't' ? S.tInv(1 - alpha / 2, n - 1) : S.normInv(1 - alpha / 2, 0, 1);

      // ---- 100 ช่วงสำหรับวาดภาพ ----
      const show = [];
      for (let i = 0; i < 100; i++) {
        const a = sampleShape(shape, n, mu, sg);
        const m = S.mean(a);
        const se = (method === 'zk' ? sg : S.sd(a)) / Math.sqrt(n);
        const lo = m - crit * se, hi = m + crit * se;
        show.push({ m, lo, hi, ok: lo <= mu && mu <= hi });
      }
      const missShow = show.filter(s => !s.ok).length;

      // ---- ทำซ้ำ K รอบเพื่อหาอัตราการคลุมระยะยาว ----
      let cover = 0, wsum = 0;
      for (let k = 0; k < K; k++) {
        const a = sampleShape(shape, n, mu, sg);
        const m = S.mean(a);
        const se = (method === 'zk' ? sg : S.sd(a)) / Math.sqrt(n);
        const lo = m - crit * se, hi = m + crit * se;
        if (lo <= mu && mu <= hi) cover++;
        wsum += 2 * crit * se;
      }
      const rate = cover / K, width = wsum / K;

      // ---- วาดช่วงทั้ง 100 ----
      const cv = $('ciC');
      const lo0 = Math.min.apply(null, show.map(s => s.lo));
      const hi0 = Math.max.apply(null, show.map(s => s.hi));
      const padx = (hi0 - lo0) * 0.04 + 1e-9;
      const p = Plot(cv, { h: 400 });
      p.domain(lo0 - padx, hi0 + padx, 0, 101);
      p.axes('ค่าของ μ ที่ประมาณได้', '', 6);
      const c = p.c;
      show.forEach((s, i) => {
        const y = p.Y(i + 0.5);
        c.strokeStyle = s.ok ? css('--accent') : css('--danger');
        c.lineWidth = s.ok ? 1.6 : 2.4;
        c.beginPath(); c.moveTo(p.X(s.lo), y); c.lineTo(p.X(s.hi), y); c.stroke();
        c.fillStyle = s.ok ? css('--accent') : css('--danger');
        c.beginPath(); c.arc(p.X(s.m), y, 1.9, 0, 7); c.fill();
      });
      c.strokeStyle = css('--text-2'); c.lineWidth = 2;
      c.beginPath(); c.moveTo(p.X(mu), p.pad.t); c.lineTo(p.X(mu), p.pad.t + p.ih); c.stroke();
      c.fillStyle = css('--text-2'); c.font = '600 12px system-ui';
      c.textAlign = 'center'; c.textBaseline = 'bottom';
      c.fillText('μ = ' + mu, p.X(mu), p.pad.t - 1);

      const gap = rate - conf;
      const bad = gap < -0.015;
      const methodName = method === 't' ? 'ใช้ t (ถูกต้องเมื่อไม่ทราบ σ)'
        : method === 'z' ? 'ใช้ Z ทั้งที่ไม่ทราบ σ (ผิด)' : 'ใช้ Z เมื่อทราบ σ (ถูกต้อง)';

      $('ciOut').innerHTML =
        '<div class="grid g4" style="margin-bottom:14px">' +
        tile('ช่วงที่พลาดใน 100 ช่วง', missShow + ' ช่วง', 'คาดหมาย ' + f(alpha * 100, 0) + ' ช่วง',
          Math.abs(missShow - alpha * 100) <= 3 + alpha * 100 * 0.5 ? 'ok' : 'warn') +
        tile('อัตราการคลุมระยะยาว', pct(rate), 'จาก ' + K.toLocaleString('en-US') + ' รอบ', bad ? 'danger' : 'acc') +
        tile('ระดับที่ประกาศไว้', pct(conf, 0), 'ต่างกัน ' + f(gap * 100, 2) + ' จุด') +
        tile('ความกว้างเฉลี่ยของช่วง', f(width, 3), 'ค่าวิกฤต = ' + f(crit, 4)) +
        '</div>' +
        '<div class="grid g2">' +
        '<div class="card"><div class="card-t">สรุปเงื่อนไขที่ใช้จำลอง</div>' +
        row('ประชากร', SHAPES[shape].n) +
        row('μ จริง (ที่ปกติไม่มีใครรู้)', String(mu)) +
        row('σ จริง', String(sg)) +
        row('ขนาดตัวอย่าง n', String(n)) +
        row('วิธี', methodName) +
        row('ค่าวิกฤตที่ใช้', f(crit, 4)) +
        '</div>' +
        '<div class="card"><div class="card-t">อัตราการคลุมที่ได้</div>' +
        meter('ที่ควรได้ตามที่ประกาศ', pct(conf, 0), conf, 1, css('--text-3')) +
        meter('ที่ได้จริงจากการจำลอง', pct(rate), rate, 1, bad ? css('--danger') : css('--ok')) +
        '<p style="font-size:13.5px;color:var(--text-2);margin:12px 0 0">' +
        'คลุม ' + cover.toLocaleString('en-US') + ' รอบ · พลาด ' + (K - cover).toLocaleString('en-US') +
        ' รอบ จากทั้งหมด ' + K.toLocaleString('en-US') + ' รอบ</p></div></div>' +
        obs('<p>จาก 100 ช่วงในภาพ มี <b>' + missShow + '</b> ช่วงที่ไม่คลุม $\\mu = 100$ และเมื่อทำซ้ำ ' +
          K.toLocaleString('en-US') + ' รอบได้อัตราการคลุม <b>' + pct(rate) + '</b> เทียบกับที่ประกาศไว้ ' +
          pct(conf, 0) + '</p>' +
          (method === 'z'
            ? '<p><b>วิธีนี้ผิด</b> — การใช้ $Z$ ขณะที่ต้องประมาณ $\\sigma$ ด้วย $S$ ทำให้ช่วงแคบเกินจริง อัตราการคลุมจึงตกลงมาเหลือ ' +
              pct(rate) + ' กลายเป็นช่วงที่ “โฆษณาเกินจริง” ยิ่ง $n$ เล็กยิ่งแย่ ลองตั้ง $n = 5$ ดู</p>'
            : (bad
              ? '<p>อัตราการคลุมต่ำกว่าที่ประกาศอย่างเห็นได้ชัด เพราะประชากรเป็นแบบ <b>' + SHAPES[shape].n +
                '</b> ซึ่งละเมิดข้อสมมติเรื่องความปรกติที่ $n = ' + n +
                '$ ลองเพิ่ม $n$ เป็น 40–60 แล้วดูว่า CLT ดึงอัตราการคลุมกลับขึ้นมาได้เพียงใด</p>'
              : '<p>อัตราการคลุมตรงกับระดับที่ประกาศไว้ — วิธีการทำงานถูกต้องภายใต้เงื่อนไขชุดนี้</p>')) +
          '<p><b>สิ่งที่ต้องจำ:</b> 95% เป็นสมบัติของ<b>วิธีการ</b> ไม่ใช่ของช่วงใดช่วงหนึ่ง ช่วงที่คุณคำนวณได้ในการบ้านหนึ่งข้ออาจเป็นเส้นสีแดงเส้นหนึ่งในภาพนี้ และไม่มีทางรู้ได้เลยว่าเป็นเส้นไหน</p>');
      mathify($('ciOut'));
    }
    wireSeg('ciM', go);
    ['ciN', 'ciL', 'ciP', 'ciK'].forEach(id => { const e = $(id); if (e) e.onchange = go; });
    $('ciGo').onclick = go;
    go();
  }
};

/* ============================================================
   แลบ 7 — ความคลาดเคลื่อนแบบที่ 1, แบบที่ 2 และอำนาจการทดสอบ
   ============================================================ */
LABS.power = {
  no: 7, ch: 5, cat: 'บทที่ 5', icon: '⚖️',
  name: 'α, β และอำนาจการทดสอบ',
  desc: 'ทดสอบสมมติฐานซ้ำหลายพันครั้งบนประชากรที่รู้ความจริง แล้วนับว่าตัดสินผิดกี่ครั้ง — เห็น α และ β เป็นตัวเลขจริง',
  goal: 'วัดอัตราความคลาดเคลื่อนแบบที่ 1 และแบบที่ 2 จากการจำลอง เทียบกับค่าตามทฤษฎี และเห็นว่า $n$, $\\alpha$ และขนาดผลต่างส่งผลต่ออำนาจการทดสอบอย่างไร',
  theory: `
<p>ในการทดสอบ $H_0: \\mu = \\mu_0$ มีการตัดสินผิดได้สองแบบ</p>
$$\\alpha = P(\\text{ปฏิเสธ } H_0 \\mid H_0 \\text{ จริง}), \\qquad
\\beta = P(\\text{ไม่ปฏิเสธ } H_0 \\mid H_0 \\text{ เท็จ})$$
<p>อำนาจการทดสอบ (power) คือความสามารถในการจับผลต่างที่มีจริง</p>
$$\\text{power} = 1 - \\beta \\approx P\\!\\left(Z > z_{\\alpha} - \\frac{|\\mu - \\mu_0|\\sqrt n}{\\sigma}\\right)$$
<p>$\\alpha$ เป็นค่าที่<b>เราเลือกเอง</b> แต่ $\\beta$ เป็นผลพลอยได้จาก $\\alpha$, $n$, $\\sigma$ และขนาดผลต่างจริง การลด $\\alpha$ โดยไม่เพิ่ม $n$ จะทำให้ $\\beta$ สูงขึ้นทันที</p>`,
  steps: [
    'เริ่มจากตั้ง “μ จริง” ให้<b>เท่ากับ</b> $\\mu_0$ แล้วกดจำลอง — อัตราการปฏิเสธที่ได้คือ $\\alpha$ ที่เกิดขึ้นจริง',
    'เลื่อน “μ จริง” ให้ห่างออกจาก $\\mu_0$ — อัตราการปฏิเสธที่ได้ตอนนี้คืออำนาจการทดสอบ และ $\\beta$ คือส่วนที่เหลือ',
    'ดูกราฟซ้าย — บริเวณแรเงาคือเขตปฏิเสธ แท่งที่ตกในเขตนี้คือรอบที่ปฏิเสธ $H_0$',
    'ดูกราฟขวา — เส้นอำนาจการทดสอบตามขนาดตัวอย่าง จุดวงกลมคือ $n$ ที่ตั้งไว้',
    'ลองลด $\\alpha$ จาก 0.05 เป็น 0.01 โดยไม่เปลี่ยน $n$ แล้วสังเกตว่า $\\beta$ เปลี่ยนไปอย่างไร'
  ],
  questions: [
    { q: 'เมื่อตั้ง μ จริง = μ₀ ทำไมยังมีการปฏิเสธ H₀ ประมาณ 5%',
      a: 'นั่นคือ<b>ความคลาดเคลื่อนแบบที่ 1 โดยการออกแบบ</b> — เราเลือก $\\alpha = 0.05$ เอง หมายความว่ายอมรับว่าจะเกิดสัญญาณเตือนผิดพลาด 1 ใน 20 ครั้ง ไม่ใช่ความผิดของข้อมูลหรือสูตร และกำจัดไม่ได้ ทำได้แค่เลือกระดับที่ยอมรับได้' },
    { q: 'ถ้าลด α จาก 0.05 เป็น 0.01 โดยไม่เพิ่ม n จะเกิดอะไรขึ้น',
      a: '$\\alpha$ ลดลงแต่ $\\beta$ <b>เพิ่มขึ้น</b> และอำนาจการทดสอบลดลง เพราะเขตปฏิเสธแคบลง จึงต้องการหลักฐานหนักกว่าเดิม วิธีลดทั้งสองอย่างพร้อมกันมีทางเดียวคือ<b>เพิ่ม $n$</b> ซึ่งเห็นได้จากกราฟอำนาจการทดสอบ' },
    { q: 'การทดสอบที่ “ไม่ปฏิเสธ H₀” แปลว่า H₀ จริงหรือไม่',
      a: 'ไม่ — อาจเป็นเพราะอำนาจการทดสอบต่ำ (n น้อยหรือผลต่างเล็ก) จนจับไม่ได้ ลองตั้งผลต่างเล็ก ๆ กับ $n$ น้อยในแลบนี้ จะเห็นว่าอำนาจอาจเหลือเพียง 20–30% คือพลาด 70–80% ของครั้ง จึงพูดได้แค่ว่า “หลักฐานไม่พอ” ไม่ใช่ “ไม่มีผลต่าง”' }
  ],
  render(el) {
    el.innerHTML =
      '<div class="card"><div class="grid g4">' +
      num('pwM0', 'μ₀ ตามสมมติฐานหลัก', 100, 1) +
      num('pwMu', 'μ จริงของประชากร', 100, 0.5) +
      num('pwSg', 'σ จริง', 15, 1, 'min="0.1"') +
      num('pwN', 'ขนาดตัวอย่าง n', 25, 1, 'min="2" max="500"') +
      '</div><div class="grid g3">' +
      sel('pwA', 'ระดับนัยสำคัญ α', [['0.10', '0.10'], ['0.05', '0.05'], ['0.01', '0.01'], ['0.001', '0.001']], '0.05') +
      sel('pwT', 'ทิศของการทดสอบ', [['two', 'สองหาง (μ ≠ μ₀)'], ['right', 'หางขวา (μ > μ₀)'], ['left', 'หางซ้าย (μ < μ₀)']], 'two') +
      num('pwK', 'จำนวนรอบที่ทดสอบซ้ำ', 5000, 500, 'min="500" max="50000"') +
      '</div>' +
      slider('pwD', 'เลื่อนปรับ μ จริง (ห่างจาก μ₀ กี่หน่วย)', -20, 20, 0, 0.5) +
      runBar('pwGo') + '</div>' +
      '<div class="grid g2">' +
      '<div class="card"><div class="card-t">การแจกแจงของสถิติทดสอบ t</div><canvas id="pwC1"></canvas>' +
      legend([['t ที่ได้จากแต่ละรอบ', css('--accent')], ['เขตปฏิเสธ', css('--danger-soft')],
              ['ค่าวิกฤต', css('--danger')]]) + '</div>' +
      '<div class="card"><div class="card-t">อำนาจการทดสอบตามขนาดตัวอย่าง</div><canvas id="pwC2"></canvas>' +
      legend([['อำนาจตามทฤษฎี', css('--accent')], ['n ที่ตั้งไว้', css('--danger')], ['ระดับ 80%', css('--text-3')]]) +
      '</div></div><div id="pwOut"></div>';

    function powerTheory(delta, sg, n, alpha, tail) {
      const se = sg / Math.sqrt(n);
      if (tail === 'two') {
        const zc = S.normInv(1 - alpha / 2, 0, 1);
        return (1 - S.normCdf(zc - delta / se, 0, 1)) + S.normCdf(-zc - delta / se, 0, 1);
      }
      const zc = S.normInv(1 - alpha, 0, 1);
      return tail === 'right' ? 1 - S.normCdf(zc - delta / se, 0, 1)
                              : S.normCdf(-zc - delta / se, 0, 1);
    }

    function go() {
      const m0 = V('pwM0'), mu = V('pwMu'), sg = Math.max(0.1, V('pwSg') || 15);
      const n = Math.max(2, Math.min(500, Math.round(V('pwN')) || 25));
      const alpha = parseFloat(T('pwA')) || 0.05;
      const tail = T('pwT');
      const K = Math.max(500, Math.min(50000, Math.round(V('pwK')) || 5000));
      const df = n - 1, delta = mu - m0;
      const tc = tail === 'two' ? S.tInv(1 - alpha / 2, df) : S.tInv(1 - alpha, df);

      const ts = [];
      let rej = 0;
      for (let k = 0; k < K; k++) {
        const a = sampleShape('norm', n, mu, sg);
        const m = S.mean(a), s = S.sd(a);
        const t = s > 0 ? (m - m0) / (s / Math.sqrt(n)) : 0;
        ts.push(t);
        if (tail === 'two' ? Math.abs(t) > tc : (tail === 'right' ? t > tc : t < -tc)) rej++;
      }
      const rate = rej / K;
      const thPow = powerTheory(delta, sg, n, alpha, tail);
      const isNull = Math.abs(delta) < 1e-9;

      // กราฟซ้าย — การแจกแจงของ t พร้อมเขตปฏิเสธ
      const lim = Math.max(4.5, Math.min(14, Math.abs(delta) / (sg / Math.sqrt(n)) + 4.5));
      const p1 = Plot($('pwC1'), { h: 265 });
      const d1 = densBins(ts, 40, -lim, lim);
      const ymax = Math.max(0.42, Math.max.apply(null, d1.dens)) * 1.14;
      p1.domain(-lim, lim, 0, ymax);
      quietAxes(p1, 'ค่า t', 6);
      const c = p1.c;
      c.fillStyle = css('--danger-soft');
      if (tail === 'two' || tail === 'right') {
        c.fillRect(p1.X(tc), p1.pad.t, Math.max(0, p1.X(lim) - p1.X(tc)), p1.ih);
      }
      if (tail === 'two' || tail === 'left') {
        c.fillRect(p1.X(-lim), p1.pad.t, Math.max(0, p1.X(-tc) - p1.X(-lim)), p1.ih);
      }
      drawDens(p1, d1, css('--accent'));
      p1.curve(x => S.tPdf(x, df), css('--text-3'));
      if (tail === 'two' || tail === 'right') p1.vline(tc, css('--danger'), '+' + f(tc, 3));
      if (tail === 'two' || tail === 'left') p1.vline(-tc, css('--danger'), '−' + f(tc, 3));

      // กราฟขวา — อำนาจตามขนาดตัวอย่าง
      const nmax = Math.max(60, Math.min(400, n * 3));
      const p2 = Plot($('pwC2'), { h: 265 });
      p2.domain(2, nmax, 0, 1);
      quietAxes(p2, 'ขนาดตัวอย่าง n', 6);
      hline(p2, 0.8, css('--text-3'), 'อำนาจ 80%');
      p2.curve(x => powerTheory(delta, sg, Math.max(2, x), alpha, tail), css('--accent'));
      if (n <= nmax) {
        p2.vline(n, css('--danger'), 'n = ' + n);
        p2.points([n], [thPow], css('--danger'));
      }

      // หา n ที่ทำให้อำนาจถึง 80%
      let n80 = null;
      if (!isNull) {
        for (let q = 2; q <= 20000; q++) {
          if (powerTheory(delta, sg, q, alpha, tail) >= 0.8) { n80 = q; break; }
        }
      }

      $('pwOut').innerHTML =
        '<div class="grid g4" style="margin-bottom:14px">' +
        (isNull
          ? tile('อัตราการปฏิเสธ = α จริง', pct(rate), 'ตั้งไว้ ' + pct(alpha, 1),
              Math.abs(rate - alpha) < Math.max(0.01, alpha * 0.3) ? 'ok' : 'warn')
          : tile('อัตราการปฏิเสธ = อำนาจ', pct(rate), 'ทฤษฎี ' + pct(thPow),
              rate >= 0.8 ? 'ok' : rate >= 0.5 ? 'warn' : 'danger')) +
        tile(isNull ? 'ความคลาดเคลื่อนแบบที่ 1' : 'ความคลาดเคลื่อนแบบที่ 2 (β)',
          isNull ? pct(rate) : pct(1 - rate),
          isNull ? 'ปฏิเสธผิด ' + rej.toLocaleString('en-US') + ' รอบ'
                 : 'พลาดผลต่างจริง ' + (K - rej).toLocaleString('en-US') + ' รอบ',
          isNull ? '' : (1 - rate > 0.2 ? 'danger' : 'ok')) +
        tile('ผลต่างจริง μ − μ₀', f(delta, 3), 'ขนาดผล d = ' + f(Math.abs(delta) / sg, 3)) +
        tile('ค่าวิกฤต t', (tail === 'two' ? '±' : tail === 'right' ? '+' : '−') + f(tc, 4),
          'df = ' + df + ' · ' + (tail === 'two' ? 'สองหาง' : tail === 'right' ? 'หางขวา' : 'หางซ้าย')) +
        '</div>' +
        '<div class="grid g2">' +
        '<div class="card"><div class="card-t">ตารางการตัดสินใจจากการจำลอง ' + K.toLocaleString('en-US') + ' รอบ</div>' +
        '<div class="tbl-wrap"><table class="tbl-mini"><thead><tr><th>ผลการตัดสิน</th>' +
        '<th>จำนวนรอบ</th><th>สัดส่วน</th><th>ความหมาย</th></tr></thead><tbody>' +
        '<tr><td>ปฏิเสธ H₀</td><td>' + rej.toLocaleString('en-US') + '</td><td>' + pct(rate) + '</td>' +
        '<td style="color:' + (isNull ? 'var(--danger)' : 'var(--ok)') + '">' +
        (isNull ? 'ตัดสินผิด (แบบที่ 1)' : 'ตัดสินถูก (จับผลต่างได้)') + '</td></tr>' +
        '<tr><td>ไม่ปฏิเสธ H₀</td><td>' + (K - rej).toLocaleString('en-US') + '</td><td>' + pct(1 - rate) + '</td>' +
        '<td style="color:' + (isNull ? 'var(--ok)' : 'var(--danger)') + '">' +
        (isNull ? 'ตัดสินถูก' : 'ตัดสินผิด (แบบที่ 2)') + '</td></tr>' +
        '</tbody></table></div></div>' +
        '<div class="card"><div class="card-t">การวางแผนขนาดตัวอย่าง</div>' +
        row('อำนาจที่ได้ตอนนี้', pct(thPow) + ' (ทฤษฎี)') +
        row('อำนาจจากการจำลอง', pct(rate)) +
        row('β = 1 − อำนาจ', pct(1 - thPow)) +
        row('n ที่ทำให้อำนาจถึง 80%', isNull ? 'ไม่มี (ไม่มีผลต่างให้จับ)' : (n80 ? n80 + ' ตัวอย่าง' : 'มากกว่า 20,000')) +
        row('SE = σ/√n', f(sg / Math.sqrt(n), 4)) +
        '</div></div>' +
        obs(isNull
          ? '<p>ประชากรมี $\\mu = \\mu_0$ จริง นั่นคือ $H_0$ <b>ถูกต้อง</b> แต่การทดสอบยังปฏิเสธ $H_0$ ไป <b>' +
            rej.toLocaleString('en-US') + ' รอบ จาก ' + K.toLocaleString('en-US') + ' รอบ (' + pct(rate) +
            ')</b> ซึ่งใกล้ $\\alpha = ' + alpha + '$ ที่เราตั้งไว้เอง</p>' +
            '<p>นี่คือความหมายของ $\\alpha$ — ไม่ใช่ความบกพร่องของวิธี แต่เป็น<b>ราคาที่เราตกลงจะจ่าย</b> ลองเลื่อน $\\mu$ จริงออกจาก $\\mu_0$ เพื่อดูอีกด้านของเหรียญ</p>'
          : '<p>ประชากรมีผลต่างจริง $\\mu - \\mu_0 = ' + f(delta, 3) + '$ การทดสอบจับได้ <b>' + pct(rate) +
            '</b> ของรอบ (อำนาจ) และ<b>พลาด ' + pct(1 - rate) + '</b> ของรอบ (นี่คือ $\\beta$)</p>' +
            '<p>ค่าจากการจำลอง ' + pct(rate) + ' เทียบกับทฤษฎี ' + pct(thPow) + ' ต่างกัน ' +
            f(Math.abs(rate - thPow) * 100, 2) + ' จุด' +
            (rate < 0.8 && n80
              ? ' — อำนาจยังไม่ถึงเกณฑ์ 80% ที่งานวิจัยนิยมใช้ ต้องเพิ่ม $n$ เป็น <b>' + n80 + '</b> ตัวอย่าง'
              : ' — อำนาจอยู่ในระดับที่ยอมรับได้แล้ว') + '</p>' +
            '<p>ข้อสรุปสำคัญ: ถ้าการทดสอบนี้ “ไม่ปฏิเสธ $H_0$” ก็ไม่ได้แปลว่าไม่มีผลต่าง เพราะในการจำลองนี้เรา<b>รู้</b> ว่าผลต่างมีจริง</p>');
      mathify($('pwOut'));
    }
    $('pwGo').onclick = go;
    ['pwM0', 'pwMu', 'pwSg', 'pwN', 'pwA', 'pwT', 'pwK'].forEach(id => {
      const e = $(id); if (e) e.onchange = go;
    });
    const d = $('pwD');
    d.oninput = () => {
      $('pwDV').textContent = d.value;
      $('pwMu').value = (V('pwM0') || 0) + parseFloat(d.value);
      go();
    };
    $('pwMu').oninput = () => {
      const dv = (V('pwMu') || 0) - (V('pwM0') || 0);
      if (dv >= -20 && dv <= 20) { d.value = dv; $('pwDV').textContent = dv; }
    };
    go();
  }
};

/* ============================================================
   แลบ 8 — การแจกแจงของค่า p และการทดสอบหลายครั้ง
   ============================================================ */
LABS.pvals = {
  no: 8, ch: 5, cat: 'บทที่ 5', icon: '🎯',
  name: 'ค่า p กับกับดักการทดสอบหลายครั้ง',
  desc: 'เมื่อ H₀ จริง ค่า p กระจายสม่ำเสมอ — ทดสอบหลายครั้งแล้วเลือกเฉพาะที่สวย จะได้ "ผลสำคัญ" ปลอม ๆ แน่นอน',
  goal: 'ตรวจสอบว่าภายใต้ $H_0$ ค่า $p$ มีการแจกแจงสม่ำเสมอบนช่วง $(0,1)$ และวัดโอกาสเกิดผลบวกลวงเมื่อทดสอบหลายครั้ง พร้อมดูผลของการปรับแบบบอนเฟอร์โรนี',
  theory: `
<p>เมื่อ $H_0$ เป็นจริง ค่า $p$ มีการแจกแจงสม่ำเสมอ $U(0,1)$ ดังนั้น</p>
$$P(p < 0.05 \\mid H_0 \\text{ จริง}) = 0.05$$
<p>ถ้าทดสอบ $m$ ครั้งอย่างเป็นอิสระ โอกาสที่จะเจอผลบวกลวง<b>อย่างน้อยหนึ่งครั้ง</b> คือ</p>
$$P(\\text{พบอย่างน้อย 1 ครั้ง}) = 1 - (1-\\alpha)^m$$
<p>ที่ $\\alpha = 0.05$ และ $m = 20$ ค่านี้เท่ากับ $1 - 0.95^{20} \\approx 0.64$ — คือเกือบสองในสาม! การแก้แบบง่ายสุดคือบอนเฟอร์โรนี ใช้เกณฑ์ $\\alpha/m$ กับทุกการทดสอบ</p>`,
  steps: [
    'เริ่มที่ “$H_0$ จริง (ไม่มีผลต่าง)” แล้วกดจำลอง — ดูว่าฮิสโทแกรมของค่า $p$ แบนราบจริงหรือไม่',
    'ดูสัดส่วนค่า $p < 0.05$ ว่าใกล้ 5% ตามที่ทฤษฎีบอก',
    'เพิ่ม “จำนวนการทดสอบต่อรอบ” จาก 1 เป็น 20 แล้วดูช่องว่างระหว่างสองแถบในการ์ดขวา',
    'เปลี่ยนเป็น “$H_0$ เท็จ” แล้วสังเกตว่าฮิสโทแกรมเอียงไปกองที่ศูนย์ — นี่คือหน้าตาของผลต่างที่มีจริง',
    'เทียบอัตราผลบวกลวงก่อนและหลังใช้เกณฑ์บอนเฟอร์โรนี'
  ],
  questions: [
    { q: 'ถ้าทดสอบสมมติฐาน 20 ข้อที่ H₀ จริงทั้งหมด ที่ α = 0.05 คาดว่าจะพบ "ผลสำคัญ" กี่ข้อ',
      a: 'คาดหมาย $20 \\times 0.05 = 1$ ข้อ และโอกาสที่จะพบอย่างน้อยหนึ่งข้อคือ $1 - 0.95^{20} \\approx 64\\%$ ดังนั้นการรายงานเฉพาะข้อที่มีนัยสำคัญโดยไม่บอกว่าทดสอบไปทั้งหมดกี่ข้อ เป็นการนำเสนอที่<b>บิดเบือน</b> (ขัดกับ CLO1 เรื่องจริยธรรมทางสถิติ)' },
    { q: 'ค่า p = 0.03 แปลว่า "H₀ มีโอกาสจริง 3%" ถูกหรือไม่',
      a: 'ไม่ถูก — $p$ คือ $P(\\text{ข้อมูลสุดโต่งเท่านี้หรือกว่านี้} \\mid H_0 \\text{ จริง})$ ไม่ใช่ $P(H_0 \\text{ จริง} \\mid \\text{ข้อมูล})$ การสลับสองค่านี้คือความเข้าใจผิดเรื่องการกลับทิศของเงื่อนไข แบบเดียวกับที่เห็นในแลบเบส์ของบทที่ 1' },
    { q: 'บอนเฟอร์โรนีใช้เกณฑ์ α/m แล้วต้องแลกกับอะไร',
      a: 'ควบคุมผลบวกลวงรวมได้ แต่ทำให้แต่ละการทดสอบเข้มงวดขึ้นมาก จึง<b>ลดอำนาจการทดสอบ</b> และเพิ่ม $\\beta$ ลองเปลี่ยนเป็น “$H_0$ เท็จ” แล้วเทียบอัตราการตรวจพบก่อน-หลังปรับ จะเห็นราคาที่ต้องจ่ายชัดเจน' }
  ],
  render(el) {
    el.innerHTML =
      '<div class="card">' +
      '<div class="field"><label>ความจริงของประชากรที่ใช้จำลอง</label>' +
      segment('pvH', [['null', 'H₀ จริง (ไม่มีผลต่าง)'], ['alt', 'H₀ เท็จ (มีผลต่างจริง)']], 'null') +
      '</div><div class="grid g4">' +
      num('pvN', 'ขนาดตัวอย่างต่อการทดสอบ', 25, 1, 'min="3" max="300"') +
      num('pvM', 'จำนวนการทดสอบต่อรอบ (m)', 20, 1, 'min="1" max="200"') +
      num('pvK', 'จำนวนรอบ', 4000, 500, 'min="200" max="20000"') +
      sel('pvA', 'α ของแต่ละการทดสอบ', [['0.10', '0.10'], ['0.05', '0.05'], ['0.01', '0.01']], '0.05') +
      '</div>' +
      slider('pvD', 'ขนาดผลต่างจริง (เท่าของ σ) — ใช้เมื่อเลือก H₀ เท็จ', 0, 2, 0.4, 0.1) +
      runBar('pvGo') + '</div>' +
      '<div class="grid g2">' +
      '<div class="card"><div class="card-t">การแจกแจงของค่า p ทั้งหมด</div><canvas id="pvC"></canvas>' +
      legend([['ความถี่ของค่า p', css('--accent')], ['ระดับที่ควรได้ถ้า H₀ จริง', css('--danger')]]) + '</div>' +
      '<div class="card"><div class="card-t">โอกาสพบผลบวกลวงอย่างน้อย 1 ครั้งต่อรอบ</div><div id="pvBars"></div></div>' +
      '</div><div id="pvOut"></div>';

    function go() {
      const isNull = (segVal('pvH') || 'null') === 'null';
      const n = Math.max(3, Math.min(300, Math.round(V('pvN')) || 25));
      const m = Math.max(1, Math.min(200, Math.round(V('pvM')) || 20));
      const K = Math.max(200, Math.min(20000, Math.round(V('pvK')) || 4000));
      const alpha = parseFloat(T('pvA')) || 0.05;
      const d = isNull ? 0 : Math.max(0, parseFloat($('pvD').value) || 0);
      const bonf = alpha / m;
      const df = n - 1;

      const ps = [];
      let anyRaw = 0, anyBonf = 0, sigRaw = 0, sigBonf = 0;
      for (let k = 0; k < K; k++) {
        let hitRaw = false, hitBonf = false;
        for (let j = 0; j < m; j++) {
          const a = sampleShape('norm', n, d, 1);       // μ₀ = 0, σ = 1, ผลต่างจริง = d
          const mean = S.mean(a), s = S.sd(a);
          const t = s > 0 ? mean / (s / Math.sqrt(n)) : 0;
          const p = 2 * (1 - S.tCdf(Math.abs(t), df));
          ps.push(p);
          if (p < alpha) { hitRaw = true; sigRaw++; }
          if (p < bonf) { hitBonf = true; sigBonf++; }
        }
        if (hitRaw) anyRaw++;
        if (hitBonf) anyBonf++;
      }
      const total = ps.length;
      const rateRaw = sigRaw / total, rateBonf = sigBonf / total;
      const anyR = anyRaw / K, anyB = anyBonf / K;
      const thAny = 1 - Math.pow(1 - alpha, m);

      const p1 = Plot($('pvC'), { h: 255 });
      const nb = 20;
      const dd = densBins(ps, nb, 0, 1);
      p1.domain(0, 1, 0, Math.max(1.35, Math.max.apply(null, dd.dens) * 1.12));
      quietAxes(p1, 'ค่า p', 5);
      drawDens(p1, dd, css('--accent'));
      hline(p1, 1, css('--danger'), 'ระดับสม่ำเสมอ');
      p1.vline(alpha, css('--violet'), 'α');

      $('pvBars').innerHTML =
        meter('ไม่ปรับอะไร (เกณฑ์ α = ' + alpha + ')', pct(anyR), anyR, 1,
          anyR > 0.2 && isNull ? css('--danger') : css('--accent')) +
        (isNull ? meter('ตามทฤษฎี 1 − (1 − α)^m', pct(thAny), thAny, 1, css('--text-3')) : '') +
        meter('ปรับแบบบอนเฟอร์โรนี (เกณฑ์ ' + f(bonf, 5) + ')', pct(anyB), anyB, 1, css('--ok')) +
        '<p style="font-size:13.5px;color:var(--text-2);margin:12px 0 0">' +
        'จาก ' + K.toLocaleString('en-US') + ' รอบ · รอบละ ' + m + ' การทดสอบ · รวม ' +
        total.toLocaleString('en-US') + ' การทดสอบ</p>';

      $('pvOut').innerHTML =
        '<div class="grid g4" style="margin-bottom:14px">' +
        tile('สัดส่วน p < α ต่อการทดสอบ', pct(rateRaw),
          isNull ? 'ควรได้ ' + pct(alpha, 1) : 'คืออำนาจการทดสอบ',
          isNull ? (Math.abs(rateRaw - alpha) < 0.012 ? 'ok' : 'warn') : 'acc') +
        tile('พบอย่างน้อย 1 ครั้งต่อรอบ', pct(anyR),
          isNull ? 'ทฤษฎี ' + pct(thAny) : 'มีผลต่างจริง จึงควรพบ',
          isNull && anyR > 0.2 ? 'danger' : '') +
        tile('หลังปรับบอนเฟอร์โรนี', pct(anyB), 'เกณฑ์ใหม่ ' + f(bonf, 5), 'ok') +
        tile('สัดส่วน p < เกณฑ์ใหม่', pct(rateBonf),
          isNull ? 'ควรได้ ' + f(bonf * 100, 3) + '%' : 'อำนาจที่เหลือหลังปรับ') +
        '</div>' +
        '<div class="grid g2">' +
        '<div class="card"><div class="card-t">รูปร่างการแจกแจงของค่า p ที่ได้</div>' +
        row('ค่าเฉลี่ยของ p', f(S.mean(ps), 4) + (isNull ? ' <small style="color:var(--text-3)">(U(0,1) ควรได้ 0.5)</small>' : '')) +
        row('มัธยฐานของ p', f(S.median(ps), 4)) +
        row('สัดส่วน p < 0.05', pct(ps.filter(x => x < 0.05).length / total)) +
        row('สัดส่วน p < 0.01', pct(ps.filter(x => x < 0.01).length / total)) +
        row('สัดส่วน p > 0.5', pct(ps.filter(x => x > 0.5).length / total)) +
        '</div>' +
        '<div class="card"><div class="card-t">ถ้ารายงานเฉพาะผลที่ “สวย”</div>' +
        '<p style="font-size:14px;color:var(--text-2);margin:0 0 11px">สมมติผู้วิจัยทดสอบ ' + m +
        ' ข้อ แต่รายงานเฉพาะข้อที่ได้ $p < ' + alpha + '$</p>' +
        row('โอกาสมี “ผลสำคัญ” ให้รายงาน', pct(anyR)) +
        row('จำนวนการทดสอบที่ผ่านเกณฑ์', sigRaw.toLocaleString('en-US') + ' จาก ' + total.toLocaleString('en-US')) +
        row('ผลที่รายงานเป็นของจริงหรือไม่', isNull
          ? '<span style="color:var(--danger)">ลวงทั้งหมด — ไม่มีผลต่างจริง</span>'
          : '<span style="color:var(--ok)">มีผลต่างจริง d = ' + f(d, 2) + 'σ</span>') +
        '</div></div>' +
        obs(isNull
          ? '<p>ประชากรไม่มีผลต่างเลย ($H_0$ จริงทุกการทดสอบ) ค่า $p$ ที่ได้จึงแบนราบแบบ $U(0,1)$ — ค่าเฉลี่ย ' +
            f(S.mean(ps), 4) + ' และมัธยฐาน ' + f(S.median(ps), 4) + ' ซึ่งใกล้ 0.5 ตามทฤษฎี</p>' +
            '<p>แต่เมื่อทดสอบ ' + m + ' ข้อต่อรอบ มี <b>' + pct(anyR) +
            '</b> ของรอบที่เจอ “ผลสำคัญ” อย่างน้อยหนึ่งข้อ (ทฤษฎี ' + pct(thAny) +
            ') ทั้งที่ความจริงคือไม่มีอะไรเลย — นี่คือกับดักที่เรียกว่า p-hacking</p>' +
            '<p>เกณฑ์บอนเฟอร์โรนี $\\alpha/m = ' + f(bonf, 5) + '$ ดึงอัตรานี้ลงมาเหลือ <b>' + pct(anyB) +
            '</b> ซึ่งกลับมาใกล้ ' + pct(alpha, 1) + ' ตามที่ควรเป็น</p>'
          : '<p>ประชากรมีผลต่างจริงขนาด $' + f(d, 2) + '\\sigma$ ค่า $p$ จึงกองไปทางศูนย์ ไม่แบนราบอีกต่อไป — นี่คือหน้าตาของสัญญาณที่มีอยู่จริง</p>' +
            '<p>อัตราการตรวจพบต่อการทดสอบ (อำนาจ) เท่ากับ <b>' + pct(rateRaw) +
            '</b> แต่เมื่อใช้เกณฑ์บอนเฟอร์โรนีที่เข้มงวดขึ้น เหลือเพียง <b>' + pct(rateBonf) + '</b></p>' +
            '<p>นี่คือราคาของการควบคุมผลบวกลวง — ปลอดภัยขึ้นจาก $\\alpha$ แต่เสี่ยงขึ้นกับ $\\beta$ ทางออกที่ดีกว่าคือวางแผนจำนวนการทดสอบและขนาดตัวอย่างไว้ล่วงหน้า</p>');
      mathify($('pvOut'));
    }
    wireSeg('pvH', go);
    ['pvN', 'pvM', 'pvK', 'pvA'].forEach(id => { const e = $(id); if (e) e.onchange = go; });
    wireSliders(['pvD'], go);
    $('pvGo').onclick = go;
    go();
  }
};

/* ============================================================
   แลบ 9 — t-test เทียบกับวิธีไม่ใช้พารามิเตอร์
   ============================================================ */
LABS.robust = {
  no: 9, ch: 6, cat: 'บทที่ 6', icon: '🛡️',
  name: 't-test เทียบกับ Mann–Whitney',
  desc: 'เมื่อข้อมูลไม่ปรกติหรือมีค่าผิดปกติ วิธีใดยังเชื่อถือได้ — วัดอัตราคลาดเคลื่อนและอำนาจของทั้งสองวิธีบนประชากรเดียวกัน',
  goal: 'เปรียบเทียบความคลาดเคลื่อนแบบที่ 1 และอำนาจการทดสอบของ $t$-test กับ Mann–Whitney บนประชากรรูปร่างต่าง ๆ เพื่อตัดสินว่าควรเลือกวิธีใดในสถานการณ์ใด',
  theory: `
<p>$t$-test สองกลุ่มต้องการข้อสมมติว่าประชากรปรกติและความแปรปรวนเท่ากัน สถิติทดสอบคือ</p>
$$t = \\frac{\\bar x_1 - \\bar x_2}{S_p\\sqrt{\\tfrac1{n_1}+\\tfrac1{n_2}}}, \\qquad
S_p^2 = \\frac{(n_1-1)S_1^2+(n_2-1)S_2^2}{n_1+n_2-2}$$
<p>Mann–Whitney ใช้เพียง<b>ลำดับที่</b> ของข้อมูล ไม่ใช้ค่าจริง จึงไม่ต้องสมมติรูปร่างการแจกแจง</p>
$$U = R_1 - \\frac{n_1(n_1+1)}{2}, \\qquad
Z = \\frac{U - \\frac{n_1n_2}{2}}{\\sqrt{\\frac{n_1n_2(n_1+n_2+1)}{12}}}$$
<p>สองสิ่งที่ต้องวัดเพื่อเปรียบเทียบ: เมื่อไม่มีผลต่างจริง อัตราการปฏิเสธควรเท่ากับ $\\alpha$ พอดี (ความเที่ยงตรง) และเมื่อมีผลต่างจริง ควรปฏิเสธให้ได้บ่อย (อำนาจ)</p>`,
  steps: [
    'เริ่มที่ประชากรปรกติและผลต่าง 0 — ดูว่าทั้งสองวิธีให้อัตราการปฏิเสธใกล้ $\\alpha$ หรือไม่',
    'ตั้งผลต่างเป็น 0.8σ บนประชากรปรกติ — เทียบอำนาจของสองวิธี ($t$ ควรชนะเล็กน้อย)',
    'เปลี่ยนประชากรเป็น “หางหนา (มีค่าผิดปกติ)” โดยคงผลต่างเดิม แล้วดูว่าอำนาจของใครพังลง',
    'ลองประชากรเบ้ขวาจัด (ล็อกปรกติ) ที่ $n$ เล็ก แล้วดูอัตราการปฏิเสธเมื่อไม่มีผลต่างจริง',
    'สรุปในตารางท้ายหน้าว่าสถานการณ์ใดควรใช้วิธีใด'
  ],
  questions: [
    { q: 'ถ้าข้อมูลปรกติจริง การใช้ Mann–Whitney แทน t-test เสียเปรียบมากไหม',
      a: 'เสียเปรียบเล็กน้อยเท่านั้น — ประสิทธิภาพเชิงเส้นกำกับของ Mann–Whitney เทียบกับ $t$-test บนข้อมูลปรกติอยู่ที่ราว $3/\\pi \\approx 0.955$ หรือ 95.5% เทียบได้กับการสูญเสียตัวอย่างไปเพียงประมาณ 5% ซึ่งแลบนี้แสดงให้เห็นเป็นตัวเลขอำนาจที่ใกล้กันมาก' },
    { q: 'เมื่อข้อมูลมีค่าผิดปกติ ทำไมอำนาจของ t-test ลดลงมาก',
      a: 'เพราะค่าผิดปกติดัน $S$ ให้ใหญ่ขึ้นมาก ตัวส่วนของ $t$ จึงบวม ทำให้ $t$ เล็กลงและจับผลต่างไม่ได้ ส่วน Mann–Whitney ใช้<b>ลำดับที่</b> ค่าผิดปกติที่ใหญ่มากก็นับเป็นอันดับสุดท้ายเพียงอันดับเดียว อิทธิพลจึงถูกจำกัด' },
    { q: 'ถ้าได้อัตราการปฏิเสธ 9% เมื่อตั้ง α = 5% และไม่มีผลต่างจริง หมายความว่าอะไร',
      a: 'หมายความว่าการทดสอบนั้น<b>ไม่รักษาระดับนัยสำคัญ</b> — ที่ประกาศว่าเสี่ยงพลาด 5% แต่จริงพลาด 9% ผล $p$ ที่รายงานจึงเชื่อถือไม่ได้เต็มที่ กรณีนี้ควรเปลี่ยนไปใช้วิธีที่ไม่ต้องสมมติรูปร่าง หรือเพิ่ม $n$ ให้ CLT ช่วย' }
  ],
  render(el) {
    el.innerHTML =
      '<div class="card"><div class="grid g4">' +
      sel('rbP', 'รูปร่างประชากรของทั้งสองกลุ่ม', shapeOpts(['norm', 'unif', 'exp', 'lnorm', 'heavy', 'bi']), 'norm') +
      num('rbN', 'ขนาดตัวอย่างต่อกลุ่ม', 15, 1, 'min="4" max="200"') +
      sel('rbA', 'ระดับนัยสำคัญ α', [['0.10', '0.10'], ['0.05', '0.05'], ['0.01', '0.01']], '0.05') +
      num('rbK', 'จำนวนรอบ', 3000, 500, 'min="500" max="20000"') +
      '</div>' +
      slider('rbD', 'ผลต่างจริงระหว่างกลุ่ม (เท่าของ σ)', 0, 2, 0, 0.1) +
      runBar('rbGo') + '</div>' +
      '<div class="grid g2">' +
      '<div class="card"><div class="card-t">หน้าตาของประชากรที่ใช้</div><canvas id="rbC1"></canvas>' +
      legend([['กลุ่ม 1', css('--accent')], ['กลุ่ม 2 (เลื่อนไป δ)', css('--violet')]]) + '</div>' +
      '<div class="card"><div class="card-t">อัตราการปฏิเสธ H₀ ของแต่ละวิธี</div><div id="rbBars"></div></div>' +
      '</div><div id="rbOut"></div>';

    function go() {
      const shape = T('rbP');
      const n = Math.max(4, Math.min(200, Math.round(V('rbN')) || 15));
      const alpha = parseFloat(T('rbA')) || 0.05;
      const K = Math.max(500, Math.min(20000, Math.round(V('rbK')) || 3000));
      const d = Math.max(0, parseFloat($('rbD').value) || 0);
      const df = 2 * n - 2, tc = S.tInv(1 - alpha / 2, df), zc = S.normInv(1 - alpha / 2, 0, 1);

      let rejT = 0, rejM = 0, both = 0, onlyT = 0, onlyM = 0;
      for (let k = 0; k < K; k++) {
        const a = sampleShape(shape, n, 0, 1);
        const b = sampleShape(shape, n, d, 1);
        const m1 = S.mean(a), m2 = S.mean(b);
        const v1 = S.variance(a), v2 = S.variance(b);
        const sp = Math.sqrt(((n - 1) * v1 + (n - 1) * v2) / df);
        const t = sp > 0 ? (m1 - m2) / (sp * Math.sqrt(2 / n)) : 0;
        const mw = S.mannWhitney(a, b);
        const rt = Math.abs(t) > tc, rm = Math.abs(mw.z) > zc;
        if (rt) rejT++;
        if (rm) rejM++;
        if (rt && rm) both++;
        else if (rt) onlyT++;
        else if (rm) onlyM++;
      }
      const rT = rejT / K, rM = rejM / K;
      const isNull = d < 1e-9;

      // รูปร่างประชากร
      const big1 = sampleShape(shape, 4000, 0, 1), big2 = sampleShape(shape, 4000, d, 1);
      const lo = Math.min(S.quantile(big1, 0.004), S.quantile(big2, 0.004));
      const hi = Math.max(S.quantile(big1, 0.996), S.quantile(big2, 0.996));
      const p1 = Plot($('rbC1'), { h: 250 });
      const dA = densBins(big1, 34, lo, hi), dB = densBins(big2, 34, lo, hi);
      p1.domain(lo, hi, 0, Math.max(Math.max.apply(null, dA.dens), Math.max.apply(null, dB.dens)) * 1.12);
      quietAxes(p1, 'ค่าของข้อมูล (หน่วยเป็น σ)', 6);
      drawDens(p1, dA, css('--accent'));
      polyline(p1, dB.dens.map((v, i) => dB.mn + (i + 0.5) * dB.bw), dB.dens, css('--violet'), 2);

      const refName = isNull ? 'เป้าหมาย α = ' + alpha : 'ยิ่งสูงยิ่งดี (อำนาจ)';
      const okT = isNull ? Math.abs(rT - alpha) < Math.max(0.012, alpha * 0.3) : true;
      const okM = isNull ? Math.abs(rM - alpha) < Math.max(0.012, alpha * 0.3) : true;
      $('rbBars').innerHTML =
        meter('t-test (ใช้ค่าจริง)', pct(rT), rT, 1, okT ? css('--accent') : css('--danger')) +
        meter('Mann–Whitney (ใช้ลำดับที่)', pct(rM), rM, 1, okM ? css('--violet') : css('--danger')) +
        (isNull ? meter('ระดับที่ประกาศไว้', pct(alpha, 1), alpha, 1, css('--text-3')) : '') +
        '<p style="font-size:13.5px;color:var(--text-2);margin:12px 0 0">' + refName +
        ' · จาก ' + K.toLocaleString('en-US') + ' รอบ · n = ' + n + ' ต่อกลุ่ม</p>';

      const eff = rT > 0 ? rM / rT : 0;
      $('rbOut').innerHTML =
        '<div class="grid g4" style="margin-bottom:14px">' +
        tile(isNull ? 't-test: α ที่เกิดจริง' : 't-test: อำนาจ', pct(rT),
          isNull ? 'ตั้งไว้ ' + pct(alpha, 1) : 'ผลต่าง ' + f(d, 2) + 'σ',
          isNull ? (okT ? 'ok' : 'danger') : (rT >= rM ? 'acc' : '')) +
        tile(isNull ? 'Mann–Whitney: α ที่เกิดจริง' : 'Mann–Whitney: อำนาจ', pct(rM),
          isNull ? 'ตั้งไว้ ' + pct(alpha, 1) : 'ผลต่าง ' + f(d, 2) + 'σ',
          isNull ? (okM ? 'ok' : 'danger') : (rM > rT ? 'acc' : '')) +
        tile('อัตราส่วน MW / t', f(eff, 3), eff >= 0.98 ? 'เท่ากันหรือดีกว่า' : 'MW เสียเปรียบเล็กน้อย') +
        tile('สองวิธีสรุปต่างกัน', pct((onlyT + onlyM) / K),
          'เฉพาะ t ' + pct(onlyT / K) + ' · เฉพาะ MW ' + pct(onlyM / K)) +
        '</div>' +
        '<div class="grid g2">' +
        '<div class="card"><div class="card-t">รายละเอียดการตัดสินใจ</div>' +
        row('ปฏิเสธทั้งสองวิธี', both.toLocaleString('en-US') + ' รอบ (' + pct(both / K) + ')') +
        row('เฉพาะ t-test ปฏิเสธ', onlyT.toLocaleString('en-US') + ' รอบ (' + pct(onlyT / K) + ')') +
        row('เฉพาะ Mann–Whitney ปฏิเสธ', onlyM.toLocaleString('en-US') + ' รอบ (' + pct(onlyM / K) + ')') +
        row('ไม่ปฏิเสธทั้งสองวิธี', (K - both - onlyT - onlyM).toLocaleString('en-US') + ' รอบ') +
        row('ค่าวิกฤตที่ใช้', 't = ±' + f(tc, 4) + ' · Z = ±' + f(zc, 4)) +
        '</div>' +
        '<div class="card"><div class="card-t">ควรเลือกวิธีใด</div>' +
        '<div class="tbl-wrap"><table class="tbl-mini"><thead><tr><th>สถานการณ์</th><th>วิธีที่เหมาะ</th></tr></thead><tbody>' +
        '<tr><td>ปรกติ, n พอสมควร, ไม่มีค่าผิดปกติ</td><td>t-test (อำนาจสูงสุด)</td></tr>' +
        '<tr><td>มีค่าผิดปกติหรือหางหนา</td><td>Mann–Whitney</td></tr>' +
        '<tr><td>เบ้มากและ n เล็ก</td><td>Mann–Whitney</td></tr>' +
        '<tr><td>ข้อมูลเป็นอันดับ (ordinal)</td><td>Mann–Whitney เท่านั้น</td></tr>' +
        '<tr><td>n ใหญ่มาก (CLT ช่วย)</td><td>ใช้ได้ทั้งสองวิธี</td></tr>' +
        '</tbody></table></div></div></div>' +
        obs(isNull
          ? '<p>ไม่มีผลต่างจริงระหว่างสองกลุ่ม ($\\delta = 0$) อัตราการปฏิเสธที่ได้ควรเท่ากับ $\\alpha = ' + alpha +
            '$ — $t$-test ได้ <b>' + pct(rT) + '</b> และ Mann–Whitney ได้ <b>' + pct(rM) + '</b></p>' +
            (!okT && okM
              ? '<p><b>$t$-test ไม่รักษาระดับนัยสำคัญ</b> บนประชากรแบบ ' + SHAPES[shape].n +
                ' ที่ $n = ' + n + '$ ขณะที่ Mann–Whitney ยังอยู่ในเป้า — ' +
                (rT > alpha
                  ? 'อัตราที่ได้<b>สูงกว่า</b>เป้า แปลว่าเสี่ยงสรุปว่ามีผลต่างทั้งที่ไม่มี ซึ่งเป็นความผิดพลาดที่อันตรายกว่า'
                  : 'อัตราที่ได้<b>ต่ำกว่า</b>เป้า แปลว่าการทดสอบอนุรักษ์นิยมเกินไป จึงแลกมาด้วยอำนาจที่ลดลง') +
                '</p>'
              : (okT && okM
                ? '<p>ทั้งสองวิธีรักษาระดับนัยสำคัญได้ถูกต้องในเงื่อนไขชุดนี้ ต่อไปให้เลื่อนผลต่างจริงขึ้นเพื่อเทียบ<b>อำนาจ</b></p>'
                : '<p>ค่าที่ได้ยังเหวี่ยงจากเป้าอยู่บ้าง — ลองเพิ่มจำนวนรอบให้มากขึ้นเพื่อให้ตัวเลขนิ่ง</p>'))
          : '<p>มีผลต่างจริง $' + f(d, 2) + '\\sigma$ — $t$-test จับได้ <b>' + pct(rT) +
            '</b> ของรอบ ส่วน Mann–Whitney จับได้ <b>' + pct(rM) + '</b> ของรอบ</p>' +
            (shape === 'norm'
              ? '<p>บนประชากรปรกติ $t$-test มีอำนาจสูงกว่าเล็กน้อยตามทฤษฎี (ประสิทธิภาพของ MW ≈ 95.5%) ที่นี่อัตราส่วนคือ ' +
                f(eff, 3) + ' — ใกล้ 1 มาก แปลว่าการเลือกวิธีไม่ใช้พารามิเตอร์แลกอำนาจไปน้อยกว่าที่หลายคนคิด</p>'
              : '<p>บนประชากรแบบ ' + SHAPES[shape].n + ' อัตราส่วนอำนาจ MW/t = <b>' + f(eff, 3) + '</b>' +
                (eff > 1.05 ? ' — Mann–Whitney <b>เหนือกว่า</b> ชัดเจน เพราะใช้ลำดับที่จึงไม่ถูกค่าผิดปกติดึง $S$ ให้บวม'
                           : ' — ลองเปลี่ยนเป็นประชากรหางหนาเพื่อเห็นจุดที่ MW เหนือกว่าชัด ๆ') + '</p>') +
            '<p>มี ' + pct((onlyT + onlyM) / K) + ' ของรอบที่สองวิธีสรุปไม่เหมือนกัน — เตือนว่าการเลือกวิธีทดสอบมีผลต่อข้อสรุปจริง จึงต้องเลือกจากลักษณะข้อมูล<b>ก่อน</b>เห็นผล ไม่ใช่เลือกวิธีที่ให้ $p$ สวยที่สุด</p>');
      mathify($('rbOut'));
    }
    $('rbGo').onclick = go;
    ['rbP', 'rbN', 'rbA', 'rbK'].forEach(id => { const e = $(id); if (e) e.onchange = go; });
    wireSliders(['rbD'], go);
    go();
  }
};

/* ============================================================
   แลบ 10 — ความผันแปรของเส้นถดถอยและจุดอิทธิพลสูง
   ============================================================ */
LABS.regvar = {
  no: 10, ch: 7, cat: 'บทที่ 7', icon: '📈',
  name: 'เส้นถดถอยที่ไม่เคยซ้ำเดิม',
  desc: 'สุ่มข้อมูลจากสมการที่รู้ค่า β จริง ฟิตเส้นใหม่หลายร้อยครั้ง ดูว่าเส้นเหวี่ยงแค่ไหน และดูจุดเดียวที่พลิกทั้งเส้นได้',
  goal: 'เข้าใจว่า $b_0, b_1$ เป็นค่าสถิติที่มีการแจกแจงของตัวเอง ตรวจสอบสูตร $SE(b_1)$ และอัตราการคลุมของช่วงความเชื่อมั่นของ $\\beta_1$ พร้อมวัดอิทธิพลของจุดผิดปกติ',
  theory: `
<p>ตัวแบบถดถอยเชิงเส้นคือ $Y_i = \\beta_0 + \\beta_1 x_i + \\varepsilon_i$ โดย $\\varepsilon_i \\sim N(0,\\sigma^2)$ อย่างเป็นอิสระ</p>
$$b_1 = \\frac{S_{xy}}{S_{xx}}, \\qquad
SE(b_1) = \\frac{s}{\\sqrt{S_{xx}}}, \\qquad
\\frac{b_1 - \\beta_1}{SE(b_1)} \\sim t_{\\,n-2}$$
<p>ทุกครั้งที่เก็บข้อมูลชุดใหม่ ความคลาดเคลื่อน $\\varepsilon$ ชุดใหม่ทำให้ได้เส้นใหม่ เส้นที่เห็นในรายงานวิจัยจึงเป็นเพียง<b>หนึ่งเส้น</b>จากเส้นที่เป็นไปได้ทั้งหมด</p>
<p>ช่วงความเชื่อมั่นของความชันคือ $b_1 \\pm t_{\\alpha/2,\\,n-2}\\,SE(b_1)$ และจุดที่ $x$ ห่างจาก $\\bar x$ มาก (ค่า leverage สูง) มีอิทธิพลต่อ $b_1$ มากเป็นพิเศษ</p>`,
  steps: [
    'ตั้งค่า $\\beta_0$, $\\beta_1$, $\\sigma$ และ $n$ แล้วกดจำลอง — กราฟซ้ายแสดงเส้นที่ฟิตได้หลายร้อยเส้นซ้อนกัน',
    'สังเกตว่าพุ่มเส้นแคบที่ตรงกลางและบานออกที่ปลายทั้งสองข้าง — นั่นคือเหตุที่การพยากรณ์นอกช่วงข้อมูลอันตราย',
    'ดูกราฟขวา — การแจกแจงของ $b_1$ เทียบ $SE(b_1)$ จากสูตรกับ SD ที่ได้จากการจำลอง',
    'เพิ่ม $\\sigma$ ของความคลาดเคลื่อน หรือลด $n$ แล้วดูว่าพุ่มเส้นบานออกเท่าไร',
    'ไปที่การ์ด “จุดอิทธิพลสูง” แล้วเลื่อนตำแหน่งจุดผิดปกติ ดูว่า $b_1$ และ $r$ เปลี่ยนไปเพียงใดจากข้อมูลจุดเดียว'
  ],
  questions: [
    { q: 'ทำไมพุ่มเส้นถดถอยจึงแคบที่กลางและบานที่ปลาย',
      a: 'เพราะทุกเส้นถูกบังคับให้ผ่านจุด $(\\bar x, \\bar y)$ การเปลี่ยนความชันจึงหมุนเส้นรอบจุดนั้น ความไม่แน่นอนของค่าพยากรณ์ที่ $x_0$ เท่ากับ $s\\sqrt{\\frac1n + \\frac{(x_0-\\bar x)^2}{S_{xx}}}$ ซึ่งโตขึ้นตามระยะห่างจาก $\\bar x$ — จึงไม่ควรพยากรณ์นอกช่วงข้อมูล (extrapolation)' },
    { q: 'จุดผิดปกติที่ y สูงมากแต่ x อยู่กลาง ๆ กับจุดที่ x ไกลมาก อันไหนอันตรายกว่า',
      a: 'จุดที่ $x$ ไกลจาก $\\bar x$ (leverage สูง) อันตรายกว่ามาก เพราะมีน้ำหนักในการกำหนดความชันสูง จุดเดียวสามารถพลิกเครื่องหมายของ $b_1$ ได้ ลองเลื่อน $x$ ของจุดผิดปกติไปไกล ๆ ในแลบนี้แล้วดู $b_1$' },
    { q: 'ค่า r² ที่สูงรับประกันว่าตัวแบบถูกต้องหรือไม่',
      a: 'ไม่รับประกัน — $r^2$ วัดเพียงสัดส่วนความแปรผันที่อธิบายได้ ค่าสูงอาจมาจากจุดอิทธิพลสูงจุดเดียว หรือจากความสัมพันธ์ที่จริง ๆ ไม่เป็นเส้นตรง ต้องดู<b>กราฟเศษเหลือ</b> ประกอบเสมอ และ $r$ สูงไม่ได้แปลว่าเป็นเหตุเป็นผลกัน' }
  ],
  render(el) {
    el.innerHTML =
      '<div class="card"><div class="grid g4">' +
      num('rgB0', 'β₀ จริง (จุดตัดแกน)', 10, 1) +
      num('rgB1', 'β₁ จริง (ความชัน)', 2, 0.1) +
      num('rgSg', 'σ ของความคลาดเคลื่อน', 6, 0.5, 'min="0.1"') +
      num('rgN', 'ขนาดตัวอย่าง n', 20, 1, 'min="4" max="300"') +
      '</div><div class="grid g2">' +
      num('rgK', 'จำนวนเส้นที่ฟิตซ้ำ', 400, 50, 'min="30" max="4000"') +
      sel('rgL', 'ระดับความเชื่อมั่นของช่วงสำหรับ β₁', [['0.90', '90%'], ['0.95', '95%'], ['0.99', '99%']], '0.95') +
      '</div>' + runBar('rgGo') + '</div>' +
      '<div class="grid g2">' +
      '<div class="card"><div class="card-t">เส้นที่ฟิตได้จากข้อมูลหลายชุด</div><canvas id="rgC1"></canvas>' +
      legend([['เส้นจากแต่ละตัวอย่าง', css('--accent-soft')], ['เส้นจริง', css('--danger')],
              ['ข้อมูลชุดหนึ่ง', css('--accent')]]) + '</div>' +
      '<div class="card"><div class="card-t">การแจกแจงของความชัน b₁</div><canvas id="rgC2"></canvas>' +
      legend([['b₁ ที่ได้', css('--violet')], ['β₁ จริง', css('--danger')]]) + '</div>' +
      '</div><div id="rgOut"></div>' +
      '<div class="card"><div class="card-t">จุดอิทธิพลสูง — เพิ่มข้อมูลเพียงจุดเดียว</div>' +
      '<div class="grid g2">' +
      slider('rgOx', 'ตำแหน่ง x ของจุดผิดปกติ', 0, 60, 50, 1) +
      slider('rgOy', 'ตำแหน่ง y ของจุดผิดปกติ', -60, 160, 10, 1) +
      '</div><canvas id="rgC3"></canvas>' +
      legend([['ข้อมูลปกติ', css('--accent')], ['จุดผิดปกติ', css('--danger')],
              ['เส้นที่ไม่รวมจุดนั้น', css('--text-3')], ['เส้นที่รวมจุดนั้น', css('--danger')]]) +
      '<div id="rgOut2"></div></div>';

    let baseX = [], baseY = [];

    function go() {
      const b0 = V('rgB0') || 0, b1 = V('rgB1') || 0;
      const sg = Math.max(0.1, V('rgSg') || 6);
      const n = Math.max(4, Math.min(300, Math.round(V('rgN')) || 20));
      const K = Math.max(30, Math.min(4000, Math.round(V('rgK')) || 400));
      const conf = parseFloat(T('rgL')) || 0.95;
      const tc = S.tInv(1 - (1 - conf) / 2, n - 2);

      const xs = [];
      for (let i = 0; i < n; i++) xs.push(2 + 18 * i / (n - 1));   // x คงที่ทุกรอบ
      const mx = S.mean(xs);
      const sxx = xs.reduce((s, x) => s + (x - mx) * (x - mx), 0);
      const seTheory = sg / Math.sqrt(sxx);

      const b1s = [], b0s = [];
      let cover = 0;
      let demo = null;
      for (let k = 0; k < K; k++) {
        const ys = xs.map(x => b0 + b1 * x + S.randNorm(0, sg));
        const r = S.linreg(xs, ys);
        b1s.push(r.b1); b0s.push(r.b0);
        if (r.b1 - tc * r.seB1 <= b1 && b1 <= r.b1 + tc * r.seB1) cover++;
        if (k === 0) demo = { ys, r };
      }

      // กราฟซ้าย — พุ่มเส้น
      const yAll = [];
      xs.forEach(x => {
        yAll.push(b0 + b1 * x - 3 * sg, b0 + b1 * x + 3 * sg);
      });
      const ylo = Math.min.apply(null, yAll), yhi = Math.max.apply(null, yAll);
      const p1 = Plot($('rgC1'), { h: 285 });
      p1.domain(0, 21, ylo, yhi);
      quietAxes(p1, 'x', 6);
      const c1 = p1.c;
      c1.save(); c1.globalAlpha = Math.max(0.05, Math.min(0.5, 30 / K));
      for (let k = 0; k < Math.min(K, 600); k++) {
        c1.strokeStyle = css('--accent');
        c1.lineWidth = 1;
        c1.beginPath();
        c1.moveTo(p1.X(0), p1.Y(b0s[k]));
        c1.lineTo(p1.X(21), p1.Y(b0s[k] + b1s[k] * 21));
        c1.stroke();
      }
      c1.restore();
      p1.line(0, b0, 21, b0 + b1 * 21, css('--danger'));
      if (demo) p1.points(xs, demo.ys, css('--accent'));

      // กราฟขวา — การแจกแจงของ b1
      const sdSim = S.sd(b1s);
      const lim = Math.max(sdSim, seTheory) * 4;
      const p2 = Plot($('rgC2'), { h: 285 });
      const dd = densBins(b1s, Math.min(34, Math.max(12, Math.round(Math.sqrt(K)))), b1 - lim, b1 + lim);
      const peak = 1 / (seTheory * Math.sqrt(2 * Math.PI));
      p2.domain(b1 - lim, b1 + lim, 0, Math.max(peak, Math.max.apply(null, dd.dens)) * 1.14);
      quietAxes(p2, 'ค่า b₁ ที่ฟิตได้', 5);
      drawDens(p2, dd, css('--violet'));
      p2.curve(x => S.normPdf(x, b1, seTheory), css('--accent'));
      p2.vline(b1, css('--danger'), 'β₁ = ' + f(b1, 3));

      const rate = cover / K;
      $('rgOut').innerHTML =
        '<div class="grid g4" style="margin-bottom:14px">' +
        tile('β₁ จริง', f(b1, 4), 'ค่าที่เราตั้งเอง') +
        tile('ค่าเฉลี่ยของ b₁', f(S.mean(b1s), 4), 'ไม่เอนเอียง → ควรเท่า β₁', 'acc') +
        tile('SD ของ b₁ (จำลอง)', f(sdSim, 4), 'สูตร σ/√Sxx = ' + f(seTheory, 4),
          Math.abs(sdSim - seTheory) / seTheory < 0.12 ? 'ok' : '') +
        tile('อัตราการคลุมของช่วง β₁', pct(rate), 'ตั้งไว้ ' + pct(conf, 0),
          Math.abs(rate - conf) < 0.025 ? 'ok' : 'warn') +
        '</div>' +
        '<div class="card"><div class="card-t">ข้อมูลชุดแรกให้ผลอย่างไร</div><div class="grid g2">' +
        '<div>' +
        row('b₀ ที่ได้', f(demo.r.b0, 4) + ' <small style="color:var(--text-3)">(β₀ = ' + f(b0, 3) + ')</small>') +
        row('b₁ ที่ได้', f(demo.r.b1, 4) + ' <small style="color:var(--text-3)">(β₁ = ' + f(b1, 3) + ')</small>') +
        row('SE(b₁) จากข้อมูลชุดนี้', f(demo.r.seB1, 4)) +
        '</div><div>' +
        row('r', f(demo.r.r, 4)) +
        row('r²', f(demo.r.r2, 4)) +
        row('ช่วงความเชื่อมั่นของ β₁', '(' + f(demo.r.b1 - tc * demo.r.seB1, 3) + ', ' +
          f(demo.r.b1 + tc * demo.r.seB1, 3) + ')') +
        '</div></div></div>' +
        obs('<p>จาก ' + K.toLocaleString('en-US') + ' ตัวอย่างที่สุ่มจากสมการเดียวกัน ค่า $b_1$ เหวี่ยงอยู่ระหว่าง ' +
          f(Math.min.apply(null, b1s), 3) + ' ถึง ' + f(Math.max.apply(null, b1s), 3) +
          ' ทั้งที่ $\\beta_1$ จริงเป็น ' + f(b1, 3) + ' เพียงค่าเดียว</p>' +
          '<p>ค่าเฉลี่ยของ $b_1$ คือ ' + f(S.mean(b1s), 4) + ' (ยืนยันว่า $b_1$ เป็นตัวประมาณที่<b>ไม่เอนเอียง</b>) และ SD ที่ได้ ' +
          f(sdSim, 4) + ' ตรงกับสูตร $\\sigma/\\sqrt{S_{xx}} = ' + f(seTheory, 4) + '$</p>' +
          '<p>ช่วงความเชื่อมั่นคลุม $\\beta_1$ ได้ <b>' + pct(rate) + '</b> ของครั้ง ตรงกับระดับ ' + pct(conf, 0) +
          ' ที่ประกาศไว้ — ผลเดียวกับที่เห็นในแลบช่วงความเชื่อมั่นของบทที่ 4</p>');
      mathify($('rgOut'));

      // เตรียมข้อมูลฐานสำหรับส่วนจุดอิทธิพลสูง
      baseX = xs.slice(); baseY = demo.ys.slice();
      drawOut();
    }

    function drawOut() {
      if (!baseX.length) return;
      const ox = parseFloat($('rgOx').value), oy = parseFloat($('rgOy').value);
      const X = baseX.concat([ox]), Y = baseY.concat([oy]);
      const rWith = S.linreg(X, Y), rWo = S.linreg(baseX, baseY);
      const mx = S.mean(baseX);
      const mxA = S.mean(X);                       // ค่าเฉลี่ยของ x เมื่อรวมจุดผิดปกติแล้ว
      const sxxA = X.reduce((s, x) => s + (x - mxA) * (x - mxA), 0);
      const lever = 1 / X.length + (ox - mxA) * (ox - mxA) / sxxA;

      const xlo = Math.min(0, ox - 2), xhi = Math.max(21, ox + 2);
      const yvals = Y.concat([rWith.predict(xlo), rWith.predict(xhi), rWo.predict(xlo), rWo.predict(xhi)]);
      const ylo = Math.min.apply(null, yvals), yhi = Math.max.apply(null, yvals);
      const padY = (yhi - ylo) * 0.08 + 1;
      const p = Plot($('rgC3'), { h: 300 });
      p.domain(xlo, xhi, ylo - padY, yhi + padY);
      quietAxes(p, 'x', 6);
      p.line(xlo, rWo.predict(xlo), xhi, rWo.predict(xhi), css('--text-3'));
      p.line(xlo, rWith.predict(xlo), xhi, rWith.predict(xhi), css('--danger'));
      p.points(baseX, baseY, css('--accent'));
      const c = p.c;
      c.fillStyle = css('--danger');
      c.beginPath(); c.arc(p.X(ox), p.Y(oy), 6.5, 0, 7); c.fill();
      c.strokeStyle = css('--surface'); c.lineWidth = 2;
      c.beginPath(); c.arc(p.X(ox), p.Y(oy), 6.5, 0, 7); c.stroke();

      const flip = rWith.b1 * rWo.b1 < 0;
      const chg = rWo.b1 !== 0 ? (rWith.b1 - rWo.b1) / Math.abs(rWo.b1) * 100 : 0;
      $('rgOut2').innerHTML =
        '<div class="grid g4" style="margin:14px 0 0">' +
        tile('b₁ เมื่อไม่รวมจุดนั้น', f(rWo.b1, 4), 'r = ' + f(rWo.r, 3) + ' · r² = ' + f(rWo.r2, 3)) +
        tile('b₁ เมื่อรวมจุดนั้น', f(rWith.b1, 4), 'r = ' + f(rWith.r, 3) + ' · r² = ' + f(rWith.r2, 3),
          Math.abs(chg) > 30 ? 'danger' : Math.abs(chg) > 12 ? 'warn' : 'acc') +
        tile('ความชันเปลี่ยนไป', f(chg, 1) + '%', flip ? 'เครื่องหมายพลิกกลับ!' : 'จากข้อมูลเพียง 1 จุด',
          flip ? 'danger' : '') +
        tile('ค่า leverage ของจุดนั้น', f(lever, 4),
          'เกณฑ์เตือน > ' + f(4 / X.length, 4) + ' · สูงสุดได้ 1', lever > 4 / X.length ? 'warn' : '') +
        '</div>' +
        '<div class="note ' + (Math.abs(chg) > 30 || flip ? 'warn' : 'tip') + '"><b>ผลของจุดเดียว</b>' +
        '<p>ข้อมูลมี ' + baseX.length + ' จุด การเพิ่มจุดที่ ' + (baseX.length + 1) +
        ' ที่ตำแหน่ง $(' + f(ox, 1) + ', ' + f(oy, 1) + ')$ ทำให้ความชันเปลี่ยนจาก ' + f(rWo.b1, 4) +
        ' เป็น ' + f(rWith.b1, 4) + ' (เปลี่ยน ' + f(chg, 1) + '%) และ $r^2$ เปลี่ยนจาก ' +
        f(rWo.r2, 3) + ' เป็น ' + f(rWith.r2, 3) + '</p>' +
        (flip ? '<p><b>เครื่องหมายของความชันพลิกกลับ</b> — ข้อสรุปเรื่องทิศทางความสัมพันธ์กลับตาลปัตรจากข้อมูลจุดเดียว</p>' : '') +
        '<p>จุดที่ $x$ ห่างจาก $\\bar x = ' + f(mx, 2) + '$ มากจะมี leverage สูงและมีอำนาจดึงเส้นมาก ' +
        'ลองเลื่อน $x$ ไปที่ขอบขวาสุดเทียบกับไว้กลาง ๆ โดยตั้ง $y$ เท่ากัน จะเห็นความต่างชัดเจน</p></div>';
      mathify($('rgOut2'));
    }

    $('rgGo').onclick = go;
    ['rgB0', 'rgB1', 'rgSg', 'rgN', 'rgK', 'rgL'].forEach(id => { const e = $(id); if (e) e.onchange = go; });
    wireSliders(['rgOx', 'rgOy'], drawOut);
    go();
  }
};

global.LABS = LABS;
})(window);
