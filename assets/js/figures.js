/* ============================================================
   figures.js — ภาพประกอบในบทเรียน (SVG ล้วน)
   ใส่ในเนื้อหาด้วย <div data-fig="ชื่อ"></div> แล้ว app.js จะแทนที่ให้
   สีทั้งหมดมาจากตัวแปร CSS จึงเปลี่ยนตามโหมดสว่าง/มืดเอง
   ============================================================ */
(function (global) {
  'use strict';

  const W = 520;           // ความกว้าง viewBox มาตรฐาน
  let uidN = 0;
  const uid = p => 'fg' + (++uidN) + p;

  /* ---------- ตัวช่วยวาด ---------- */
  const r1 = v => Math.round(v * 10) / 10;
  function svg(h, body, label) {
    return '<svg viewBox="0 0 ' + W + ' ' + h + '" role="img" aria-label="' + label + '">' + body + '</svg>';
  }
  function T(x, y, s, cls, anchor, extra) {
    return '<text x="' + r1(x) + '" y="' + r1(y) + '" text-anchor="' + (anchor || 'middle') + '"' +
      (cls ? ' class="' + cls + '"' : '') + (extra || '') + '>' + s + '</text>';
  }
  function L(x1, y1, x2, y2, cls, extra) {
    return '<line x1="' + r1(x1) + '" y1="' + r1(y1) + '" x2="' + r1(x2) + '" y2="' + r1(y2) + '" class="' + (cls || 'ln') + '"' + (extra || '') + '/>';
  }
  function C(x, y, r, cls, extra) {
    return '<circle cx="' + r1(x) + '" cy="' + r1(y) + '" r="' + r + '" class="' + cls + '"' + (extra || '') + '/>';
  }
  function R(x, y, w, h, cls, extra) {
    return '<rect x="' + r1(x) + '" y="' + r1(y) + '" width="' + r1(w) + '" height="' + r1(h) + '" class="' + cls + '"' + (extra || '') + '/>';
  }
  // แผนที่จากค่าข้อมูลไปพิกัดภาพ
  function frame(x0, x1, y0, y1, left, right, top, bottom) {
    return {
      X: v => left + (v - x0) / (x1 - x0) * (right - left),
      Y: v => bottom - (v - y0) / (y1 - y0) * (bottom - top),
      left, right, top, bottom
    };
  }
  function curve(f, a, b, m, cls, n) {
    n = n || 160;
    let d = '';
    for (let i = 0; i <= n; i++) {
      const x = a + (b - a) * i / n;
      d += (i ? 'L' : 'M') + r1(m.X(x)) + ' ' + r1(m.Y(f(x)));
    }
    return '<path d="' + d + '" class="' + (cls || 'ln') + '"/>';
  }
  function area(f, a, b, m, cls, op, n) {
    n = n || 100;
    let d = 'M' + r1(m.X(a)) + ' ' + r1(m.Y(0));
    for (let i = 0; i <= n; i++) {
      const x = a + (b - a) * i / n;
      d += 'L' + r1(m.X(x)) + ' ' + r1(m.Y(f(x)));
    }
    d += 'L' + r1(m.X(b)) + ' ' + r1(m.Y(0)) + 'Z';
    return '<path d="' + d + '" class="' + cls + '" fill-opacity="' + (op || 0.3) + '"/>';
  }
  function xAxis(m, ticks, y) {
    y = y === undefined ? m.bottom : y;
    let h = L(m.left, y, m.right, y, 'ax');
    ticks.forEach(t => {
      const v = Array.isArray(t) ? t[0] : t, s = Array.isArray(t) ? t[1] : t;
      h += L(m.X(v), y, m.X(v), y + 5, 'ax') + T(m.X(v), y + 20, s, 'sm');
    });
    return h;
  }
  function arrowDefs(id, cls) {
    return '<defs><marker id="' + id + '" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
      '<path d="M0 0L10 5L0 10z" class="' + (cls || 'mk') + '"/></marker></defs>';
  }
  // ตัวสุ่มแบบกำหนดเมล็ด — ภาพเหมือนเดิมทุกครั้งที่เปิด
  function rng(seed) {
    let a = seed >>> 0;
    const u = () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    u.norm = () => Math.sqrt(-2 * Math.log(u() || 1e-9)) * Math.cos(2 * Math.PI * u());
    return u;
  }

  const S = global.Stats;
  const npdf = (x, mu, sd) => Math.exp(-0.5 * Math.pow((x - mu) / sd, 2)) / (sd * Math.sqrt(2 * Math.PI));
  const tpdf = (x, df) => Math.exp(S.gammaln((df + 1) / 2) - S.gammaln(df / 2)) / Math.sqrt(df * Math.PI) *
    Math.pow(1 + x * x / df, -(df + 1) / 2);
  const chipdf = (x, df) => x <= 0 ? 0 : Math.exp((df / 2 - 1) * Math.log(x) - x / 2 - (df / 2) * Math.log(2) - S.gammaln(df / 2));
  const fmt = (v, d) => v.toFixed(d === undefined ? 2 : d);

  const F = {};

  /* =================== บทที่ 1 =================== */

  F['venn-ops'] = () => {
    const panels = [
      ['union', '$A\\cup B$', 'เกิด A หรือ B (หรือทั้งคู่)'],
      ['inter', '$A\\cap B$', 'เกิดทั้ง A และ B พร้อมกัน'],
      ['comp', "$A'$", 'ไม่เกิด A'],
      ['diff', "$A\\cap B'$", 'เกิด A แต่ไม่เกิด B']
    ];
    let h = '';
    panels.forEach((p, i) => {
      const ox = (i % 2) * 262, oy = Math.floor(i / 2) * 190;
      const ax = ox + 104, bx = ox + 158, cy = oy + 78, r = 46;
      const id = uid('v');
      let shade = '';
      if (p[0] === 'union') shade = '<g fill-opacity=".38">' + C(ax, cy, r, 'ca') + C(bx, cy, r, 'ca') + '</g>';
      if (p[0] === 'inter') shade = '<defs><clipPath id="' + id + '"><circle cx="' + bx + '" cy="' + cy + '" r="' + r + '"/></clipPath></defs>' +
        C(ax, cy, r, 'ca', ' fill-opacity=".38" clip-path="url(#' + id + ')"');
      if (p[0] === 'comp') shade = '<defs><mask id="' + id + '"><rect x="' + (ox + 8) + '" y="' + (oy + 14) + '" width="244" height="128" fill="#fff"/>' +
        '<circle cx="' + ax + '" cy="' + cy + '" r="' + r + '" fill="#000"/></mask></defs>' +
        R(ox + 8, oy + 14, 244, 128, 'ca', ' fill-opacity=".38" mask="url(#' + id + ')"');
      if (p[0] === 'diff') shade = '<defs><mask id="' + id + '"><circle cx="' + ax + '" cy="' + cy + '" r="' + r + '" fill="#fff"/>' +
        '<circle cx="' + bx + '" cy="' + cy + '" r="' + r + '" fill="#000"/></mask></defs>' +
        C(ax, cy, r, 'ca', ' fill-opacity=".38" mask="url(#' + id + ')"');
      h += shade + R(ox + 8, oy + 14, 244, 128, 'ax', ' rx="8"') +
        C(ax, cy, r, 'ln') + C(bx, cy, r, 'ln') +
        T(ox + 22, oy + 34, 'S', 'mute', 'start') + T(ax - 22, cy + 5, 'A', 'ink b') + T(bx + 22, cy + 5, 'B', 'ink b') +
        T(ox + 130, oy + 166, p[2], 'sm');
    });
    return { svg: svg(380, h, 'แผนภาพเวนน์ของยูเนียน อินเตอร์เซกชัน และคอมพลีเมนต์'),
      cap: 'ส่วนที่ระบายสีคือเหตุการณ์นั้น · กรอบสี่เหลี่ยม $S$ คือผลลัพธ์ทั้งหมด' };
  };

  F['venn-die'] = () => {
    const ax = 205, bx = 300, cy = 138, r = 78;
    const id = uid('c');
    let h = '<defs><clipPath id="' + id + '"><circle cx="' + bx + '" cy="' + cy + '" r="' + r + '"/></clipPath></defs>' +
      R(40, 40, 440, 200, 'ax', ' rx="10"') +
      C(ax, cy, r, 'ca', ' fill-opacity=".16"') + C(bx, cy, r, 'cb', ' fill-opacity=".18"') +
      C(ax, cy, r, 'cc', ' fill-opacity=".35" clip-path="url(#' + id + ')"') +
      C(ax, cy, r, 'ln la') + C(bx, cy, r, 'ln lb') +
      T(58, 64, 'S', 'mute', 'start') +
      T(ax - 30, 26, 'A = แต้มคู่', 'ca b') + T(bx + 30, 26, 'B = มากกว่า 4', 'cb b');
    const num = (x, y, s) => C(x, y, 17, 'bg', ' stroke-width="1.4"') + C(x, y, 17, 'ln', ' stroke-width="1.2"') + T(x, y + 6, s, 'ink b');
    h += num(170, 118, '2') + num(178, 168, '4') + num(253, 128, '6') + num(330, 140, '5') +
      num(84, 210, '1') + num(436, 210, '3');
    h += T(253, 172, 'A∩B', 'cc sm b');
    return { svg: svg(255, h, 'แผนภาพเวนน์ของการทอดลูกเต๋า'),
      cap: 'ตัวอย่าง 1.1 ในภาพ: เลข 6 อยู่ในส่วนทับซ้อนจึงเป็น $A\\cap B$ · เลข 1 และ 3 อยู่นอกทั้งสองวงจึงเป็น $(A\\cup B)\'$' };
  };

  F['perm-comb'] = () => {
    const groups = [['A', 'B'], ['A', 'C'], ['B', 'C']];
    let h = '';
    groups.forEach((g, i) => {
      const x = 22 + i * 168;
      h += R(x, 46, 148, 132, 'cc', ' fill-opacity=".1" rx="12"') + R(x, 46, 148, 132, 'ln lc', ' rx="12" stroke-width="1.4"') +
        T(x + 74, 34, 'หมู่ {' + g.join(', ') + '}', 'cc b');
      [[g[0], g[1]], [g[1], g[0]]].forEach((pair, j) => {
        const y = 66 + j * 56;
        pair.forEach((c, k) => {
          h += R(x + 30 + k * 48, y, 40, 40, 'bg', ' rx="8"') + R(x + 30 + k * 48, y, 40, 40, 'ln la', ' rx="8" stroke-width="1.4"') +
            T(x + 50 + k * 48, y + 27, c, 'ink b');
        });
      });
    });
    h += T(260, 206, 'เรียงสับเปลี่ยน: นับทุกกล่องเล็ก = 6 แบบ  ·  จัดหมู่: นับกรอบใหญ่ = 3 แบบ', 'sm');
    return { svg: svg(220, h, 'เปรียบเทียบการเรียงสับเปลี่ยนกับการจัดหมู่'),
      cap: 'เลือก 2 จาก {A, B, C}: AB กับ BA เป็นคนละแบบเมื่อสนใจลำดับ แต่เป็นหมู่เดียวกัน จึงได้ $C(3,2)=\\dfrac{P(3,2)}{2!}=\\dfrac{6}{2}=3$' };
  };

  F['bayes-tree'] = () => {
    const mk = uid('a');
    let h = arrowDefs(mk);
    const root = [30, 150];
    const lv1 = [[170, 70, 'ป่วย D', '100 คน', '0.01'], [170, 230, 'ไม่ป่วย D′', '9,900 คน', '0.99']];
    const lv2 = [
      [360, 34, 'ผลบวก +', '99 คน', '0.99', 1], [360, 106, 'ผลลบ −', '1 คน', '0.01', 0],
      [360, 194, 'ผลบวก +', '495 คน', '0.05', 1], [360, 266, 'ผลลบ −', '9,405 คน', '0.95', 0]
    ];
    h += C(root[0], root[1], 6, 'cink') + T(root[0], root[1] + 26, '10,000 คน', 'sm');
    lv1.forEach((n, i) => {
      h += L(root[0] + 6, root[1], n[0] - 8, n[1], 'ax') + T((root[0] + n[0]) / 2 - 4, (root[1] + n[1]) / 2 - 8, n[4], 'mute sm') +
        T(n[0], n[1] - 6, n[2], 'ink b', 'start') + T(n[0], n[1] + 14, n[3], 'sm', 'start');
      lv2.slice(i * 2, i * 2 + 2).forEach(m => {
        h += L(n[0] + 84, n[1], m[0] - 8, m[1], m[5] ? 'ln la' : 'ax') +
          T((n[0] + 84 + m[0]) / 2, (n[1] + m[1]) / 2 - 6, m[4], 'mute sm') +
          (m[5] ? R(m[0] - 6, m[1] - 20, 146, 40, 'ca', ' fill-opacity=".14" rx="8"') : '') +
          T(m[0], m[1] - 3, m[2], m[5] ? 'ca b' : 'ink', 'start') + T(m[0] + 72, m[1] - 3, m[3], m[5] ? 'ca b' : 'sm', 'start');
      });
    });
    h += R(20, 300, 480, 44, 'ca', ' fill-opacity=".1" rx="10"') +
      T(260, 328, 'ผลบวกทั้งหมด 99 + 495 = 594 คน  →  ป่วยจริง 99 / 594 = 16.7%', 'ca b');
    return { svg: svg(350, h, 'แผนภาพต้นไม้ของตัวอย่างการตรวจโรค'),
      cap: 'แปลงความน่าจะเป็นเป็น "จำนวนคน" จาก 10,000 คน จะเห็นว่าผลบวกส่วนใหญ่ (495 คน) มาจากคนที่<b>ไม่ป่วย</b> เพราะคนไม่ป่วยมีมากกว่า 99 เท่า' };
  };

  /* =================== บทที่ 2 =================== */

  F['pmf-cdf'] = () => {
    const p = [0.1, 0.3, 0.4, 0.2];
    const a = frame(-0.6, 3.6, 0, 0.5, 40, 240, 30, 200);
    const b = frame(-0.6, 4.2, 0, 1.1, 300, 505, 30, 200);
    let h = T(140, 18, 'pmf: p(x) = P(X = x)', 'ink b') + T(402, 18, 'CDF: F(x) = P(X ≤ x)', 'ink b');
    p.forEach((v, x) => {
      h += R(a.X(x) - 17, a.Y(v), 34, a.Y(0) - a.Y(v), 'ca', ' fill-opacity=".75" rx="3"') + T(a.X(x), a.Y(v) - 7, v, 'sm ink');
    });
    h += xAxis(a, [0, 1, 2, 3]);
    // จุดสมดุล E(X)
    h += L(a.X(1.7), a.Y(0.47), a.X(1.7), a.bottom, 'ln lb dash') + '<path d="M' + a.X(1.7) + ' ' + a.bottom + 'l-7 12h14z" class="cb"/>' +
      T(a.X(1.7) - 6, a.Y(0.47) + 4, 'E(X) = 1.7', 'cb sm b', 'end');
    let cum = 0;
    for (let x = -1; x <= 3; x++) {
      const v = x < 0 ? 0 : (cum += p[x]);
      const x0 = Math.max(x, -0.6), x1 = x === 3 ? 4.2 : x + 1;
      h += L(b.X(x0), b.Y(v), b.X(x1), b.Y(v), 'ln la', ' stroke-width="2.4"');
      if (x >= 0) h += C(b.X(x), b.Y(v), 4, 'ca') + (x < 3 ? C(b.X(x + 1), b.Y(v), 4, 'bg ln la', ' stroke-width="1.5"') : '') +
        T(b.X(x) + 8, b.Y(v) - 8, fmt(v, 1), 'sm ink', 'start');
    }
    h += xAxis(b, [0, 1, 2, 3, 4]) + L(b.left, b.Y(1), b.right, b.Y(1), 'grid dash');
    return { svg: svg(250, h, 'กราฟฟังก์ชันความน่าจะเป็นและฟังก์ชันการแจกแจงสะสม'),
      cap: 'ตัวอย่าง 2.2 ในภาพ: ความสูงแท่งซ้ายคือ $p(x)$ · กราฟขวาเป็นขั้นบันไดที่กระโดดขึ้นเท่ากับความสูงแท่งที่จุดนั้น จนถึง 1' };
  };

  F['pdf-area'] = () => {
    const f = x => x <= 0 ? 0 : 0.25 * x * x * Math.exp(-x) * 2;   // รูปเบ้ขวา
    const m = frame(0, 9, 0, 0.6, 30, 500, 24, 190);
    let h = area(f, 1.5, 3.5, m, 'ca', 0.4) + curve(f, 0, 9, m, 'ln') + xAxis(m, [[1.5, 'a'], [3.5, 'b'], [6, 'c']]);
    h += T(m.X(2.5), m.Y(0.12), 'P(a < X < b)', 'ink b') + T(m.X(2.5), m.Y(0.12) + 20, '= พื้นที่', 'sm');
    h += L(m.X(6), m.Y(0), m.X(6), m.Y(0.22), 'ln lb', ' stroke-width="2.5"') +
      T(m.X(6), m.Y(0.33), 'P(X = c) = 0', 'cb b') + T(m.X(6), m.Y(0.33) + 20, 'เส้นเดียวไม่มีความกว้าง', 'sm');
    h += T(m.X(0.9), m.Y(0.52), 'f(x)', 'ink', 'start');
    return { svg: svg(220, h, 'ความน่าจะเป็นของตัวแปรสุ่มต่อเนื่องคือพื้นที่ใต้เส้นโค้ง'),
      cap: 'ตัวแปรสุ่มต่อเนื่อง: ความน่าจะเป็นคือ<b>พื้นที่</b>ใต้ $f(x)$ ไม่ใช่ความสูง ดังนั้น $P(a\\le X\\le b)=P(a&lt;X&lt;b)$' };
  };

  F['binom-shapes'] = () => {
    const ps = [[0.2, 'p = 0.2 เบ้ขวา'], [0.5, 'p = 0.5 สมมาตร'], [0.8, 'p = 0.8 เบ้ซ้าย']];
    let h = '';
    ps.forEach((q, i) => {
      const m = frame(-0.7, 10.7, 0, 0.32, 12 + i * 170, 172 + i * 170, 34, 170);
      h += T((m.left + m.right) / 2, 20, q[1], 'ink b');
      for (let x = 0; x <= 10; x++) {
        const v = S.binomPmf(x, 10, q[0]);
        h += R(m.X(x) - 5.5, m.Y(v), 11, m.Y(0) - m.Y(v), 'ca', ' fill-opacity=".75" rx="2"');
      }
      h += xAxis(m, [0, 5, 10]);
      h += L(m.X(10 * q[0]), m.top + 6, m.X(10 * q[0]), m.bottom, 'ln lb dash') + T(m.X(10 * q[0]), m.bottom + 40, 'np = ' + 10 * q[0], 'cb sm b');
    });
    return { svg: svg(220, h, 'รูปร่างการแจกแจงทวินามเมื่อ p ต่างกัน'),
      cap: 'ทวินาม $n=10$ · ยอดของกราฟอยู่ใกล้ $np$ เสมอ ถ้า $p$ ห่างจาก 0.5 กราฟจะเบ้ไปทางตรงข้าม' };
  };

  F['normal-empirical'] = () => {
    const f = x => npdf(x, 0, 1);
    const m = frame(-3.7, 3.7, 0, 0.42, 20, 500, 18, 170);
    let h = area(f, -3, 3, m, 'ca', 0.12) + area(f, -2, 2, m, 'ca', 0.16) + area(f, -1, 1, m, 'ca', 0.24) +
      curve(f, -3.7, 3.7, m) +
      xAxis(m, [[-3, 'μ−3σ'], [-2, 'μ−2σ'], [-1, 'μ−σ'], [0, 'μ'], [1, 'μ+σ'], [2, 'μ+2σ'], [3, 'μ+3σ']]);
    const br = (k, y, s) => {
      const x1 = m.X(-k), x2 = m.X(k);
      return L(x1, y, x2, y, 'ln la', ' stroke-width="1.6"') + L(x1, y - 6, x1, y + 6, 'ln la') + L(x2, y - 6, x2, y + 6, 'ln la') +
        R((x1 + x2) / 2 - 34, y - 11, 68, 22, 'bg') + T((x1 + x2) / 2, y + 5, s, 'ca b');
    };
    h += br(1, 210, '68%') + br(2, 240, '95%') + br(3, 270, '99.7%');
    return { svg: svg(285, h, 'กฎ 68–95–99.7 ของการแจกแจงปรกติ'),
      cap: 'เกือบทุกค่า (99.7%) อยู่ภายใน 3 เท่าของ $\\sigma$ จากค่าเฉลี่ย · ค่าที่ห่างเกิน $2\\sigma$ จึงถือว่า "ผิดปกติ" ได้' };
  };

  F['z-scale'] = () => {
    const f = x => npdf(x, 70, 8);
    const m = frame(44, 96, 0, 0.055, 56, 500, 20, 160);
    let h = area(f, 60, 80, m, 'ca', 0.35) + curve(f, 44, 96, m) +
      xAxis(m, [46, 54, 70, 86, 94].map(v => [v, v])) +
      L(m.X(60), m.Y(f(60)), m.X(60), 160, 'ln la') + L(m.X(80), m.Y(f(80)), m.X(80), 160, 'ln la');
    // แกน Z
    const zy = 214;
    h += L(m.left, zy, m.right, zy, 'ax');
    [-3, -2, -1, 0, 1, 2, 3].forEach(z => { const x = m.X(70 + 8 * z); h += L(x, zy, x, zy + 5, 'ax') + T(x, zy + 20, z, 'sm'); });
    [[60, '−1.25'], [80, '1.25']].forEach(q => {
      h += L(m.X(q[0]), 168, m.X(q[0]), zy - 4, 'ln la dash') + T(m.X(q[0]), zy - 10, q[1], 'ca sm b');
      h += T(m.X(q[0]), 182, q[0], 'ca sm b');
    });
    h += T(m.X(70), m.Y(0.02), '0.7888', 'ink b big') + T(6, 166, 'X', 'mute b', 'start') + T(6, zy + 6, 'Z', 'mute b', 'start');
    return { svg: svg(260, h, 'การแปลงคะแนน X เป็นคะแนนมาตรฐาน Z'),
      cap: 'ตัวอย่าง 2.4: แกนบนเป็นคะแนนจริง แกนล่างเป็นค่า $Z$ ของจุดเดียวกัน — การแปลงเป็น $Z$ แค่เปลี่ยน<b>ไม้บรรทัด</b> พื้นที่ยังเท่าเดิม' };
  };

  /* =================== บทที่ 3 =================== */

  F['sampling-flow'] = () => {
    const u = rng(7), mk = uid('a');
    let h = arrowDefs(mk);
    h += R(10, 40, 140, 180, 'cc', ' fill-opacity=".08" rx="16"') + R(10, 40, 140, 180, 'ln lc', ' rx="16" stroke-width="1.3"') +
      T(80, 28, 'ประชากร', 'cc b') + T(80, 240, 'μ, σ (ไม่รู้ค่า)', 'sm');
    for (let i = 0; i < 46; i++) h += C(24 + u() * 112, 54 + u() * 152, 4, 'cc', ' fill-opacity=".55"');
    const means = ['68.2', '71.5', '69.4'];
    [40, 112, 184].forEach((y, i) => {
      h += '<path d="M152 ' + (130) + 'C175 130 175 ' + (y + 22) + ' 196 ' + (y + 22) + '" class="ax" marker-end="url(#' + mk + ')"/>' +
        R(200, y, 92, 44, 'bg', ' rx="10"') + R(200, y, 92, 44, 'ln la', ' rx="10" stroke-width="1.3"');
      for (let k = 0; k < 5; k++) h += C(214 + k * 16, y + 15, 4, 'ca');
      h += T(246, y + 37, 'x̄' + '₁₂₃'[i] + ' = ' + means[i], 'sm ink') +
        '<path d="M294 ' + (y + 22) + 'C318 ' + (y + 22) + ' 318 130 342 130" class="ax" marker-end="url(#' + mk + ')"/>';
    });
    h += T(246, 28, 'สุ่มตัวอย่างซ้ำ ๆ', 'ca b');
    const m = frame(62, 78, 0, 1, 350, 510, 60, 200);
    const bars = [0.08, 0.22, 0.5, 0.85, 1, 0.82, 0.48, 0.2, 0.07];
    bars.forEach((v, i) => { const x = 62 + 1.8 * i; h += R(m.X(x) + 1, m.Y(v), (m.right - m.left) / 9 - 2, m.Y(0) - m.Y(v), 'cb', ' fill-opacity=".7" rx="2"'); });
    h += L(m.left, m.bottom, m.right, m.bottom, 'ax') + T(430, 28, 'การแจกแจงของ x̄', 'cb b') + T(430, 222, 'แต่ละแท่ง = x̄ หลาย ๆ ชุด', 'sm');
    return { svg: svg(250, h, 'แนวคิดการแจกแจงของค่าเฉลี่ยตัวอย่าง'),
      cap: 'สุ่มกี่ครั้งก็ได้ $\\bar x$ ไม่เท่ากัน — เมื่อนำ $\\bar x$ ทุกชุดมาทำฮิสโทแกรม จะได้ "การแจกแจงของค่าสถิติ" (sampling distribution)' };
  };

  F['se-shrink'] = () => {
    const m = frame(26, 74, 0, 0.29, 20, 500, 20, 190);
    let h = curve(x => npdf(x, 50, 12), 26, 74, m, 'ln dash');
    [[4, 'la', 'n = 4'], [16, 'lc', 'n = 16'], [64, 'lb', 'n = 64']].forEach(q => {
      const sd = 12 / Math.sqrt(q[0]);
      const k = [4, 16, 64].indexOf(q[0]), ly = 34 + k * 22;
      h += curve(x => npdf(x, 50, sd), 26, 74, m, 'ln ' + q[1]) +
        L(24, ly, 50, ly, 'ln ' + q[1], ' stroke-width="2.5"') + T(58, ly + 5, q[2] + ' · SE = ' + fmt(sd, 1), 'sm b ' + q[1].replace('l', 'c'), 'start');
    });
    h += L(24, 100, 50, 100, 'ln dash') + T(58, 105, 'ประชากร σ = 12', 'sm', 'start') + xAxis(m, [[30, 30], [40, 40], [50, 'μ = 50'], [60, 60], [70, 70]]);
    return { svg: svg(225, h, 'การแจกแจงของค่าเฉลี่ยตัวอย่างแคบลงเมื่อ n เพิ่มขึ้น'),
      cap: 'ทุกเส้นมีจุดศูนย์กลางที่ $\\mu$ เดียวกัน แต่ยิ่ง $n$ มาก $\\bar X$ ยิ่งกระจุกใกล้ $\\mu$ — เพิ่ม $n$ สี่เท่า $SE=\\sigma/\\sqrt n$ ลดลงครึ่งหนึ่ง' };
  };

  F['clt'] = () => {
    const gam = n => x => x <= 0 ? 0 : Math.exp(n * Math.log(n) + (n - 1) * Math.log(x) - n * x - S.gammaln(n));
    const panels = [[1, 'ประชากร (เบ้ขวามาก)'], [2, 'x̄ จาก n = 2'], [5, 'x̄ จาก n = 5'], [30, 'x̄ จาก n = 30']];
    let h = '';
    panels.forEach((p, i) => {
      const ox = (i % 2) * 262, oy = Math.floor(i / 2) * 160;
      const f = gam(p[0]);
      let ymax = 0; for (let x = 0.01; x < 3; x += 0.01) ymax = Math.max(ymax, f(x));
      const m = frame(0, 3, 0, ymax * 1.12, ox + 12, ox + 248, oy + 34, oy + 126);
      h += T(ox + 130, oy + 20, p[1], 'ink b') + area(f, 0.001, 3, m, i ? 'ca' : 'cc', 0.25) + curve(f, 0.001, 3, m, 'ln ' + (i ? 'la' : 'lc'));
      if (i) h += curve(x => npdf(x, 1, 1 / Math.sqrt(p[0])), 0, 3, m, 'ln lb dash');
      h += xAxis(m, [0, [1, 'μ'], 2, 3]);
    });
    h += L(150, 332, 180, 332, 'ln lb dash') + T(188, 337, 'การแจกแจงปรกติที่ใช้ประมาณ', 'cb sm', 'start');
    return { svg: svg(345, h, 'ทฤษฎีบทขีดจำกัดกลาง'),
      cap: 'ประชากรเบ้มากแค่ไหน พอเฉลี่ยหลายค่าเข้าด้วยกัน รูปร่างของ $\\bar X$ จะเข้าใกล้ระฆังคว่ำ — ที่ $n=30$ แทบทับเส้นประพอดี' };
  };

  F['chi-shapes'] = () => {
    const m = frame(0, 26, 0, 0.26, 24, 500, 20, 180);
    let h = '';
    [[3, 'la'], [5, 'lc'], [10, 'lb']].forEach(q => {
      h += curve(x => chipdf(x, q[0]), 0.05, 26, m, 'ln ' + q[1]);
      const xp = Math.max(q[0] - 2, 0.6);
      h += T(m.X(xp) + 8, m.Y(chipdf(xp, q[0])) - 8, 'df = ' + q[0], 'sm b ' + q[1].replace('l', 'c'), 'start');
    });
    h += xAxis(m, [0, 5, 10, 15, 20, 25]);
    return { svg: svg(210, h, 'รูปร่างของการแจกแจงไคกำลังสองตามองศาอิสระ'),
      cap: 'ค่าไคกำลังสองไม่ติดลบ เบ้ขวา และยอดเลื่อนไปทางขวาเมื่อ $df$ เพิ่ม (ค่าเฉลี่ย $=df$)' };
  };

  F['t-vs-z'] = () => {
    const m = frame(-4.2, 4.2, 0, 0.42, 20, 500, 20, 180);
    let h = curve(x => npdf(x, 0, 1), -4.2, 4.2, m, 'ln') +
      curve(x => tpdf(x, 5), -4.2, 4.2, m, 'ln lc') +
      curve(x => tpdf(x, 2), -4.2, 4.2, m, 'ln la');
    h += T(m.X(0), m.Y(0.405) - 4, 'Z', 'ink b') + T(m.X(1.05), m.Y(0.33), 't (df = 5)', 'cc sm b', 'start') +
      T(m.X(-1.15), m.Y(0.3), 't (df = 2)', 'ca sm b', 'end');
    h += T(m.X(2.3), m.Y(0.21), 'หาง t หนากว่า', 'ca sm b', 'start') + T(m.X(2.3), m.Y(0.21) + 18, '→ ค่าวิกฤตไกลกว่า', 'sm', 'start') +
      L(m.X(2.9), m.Y(0.16), m.X(3.1), m.Y(0.04), 'ln la', ' stroke-width="1.2"');
    h += xAxis(m, [-4, -3, -2, -1, 0, 1, 2, 3, 4]);
    return { svg: svg(210, h, 'เปรียบเทียบการแจกแจง t กับ Z'),
      cap: '$t$ เตี้ยกว่าและหางหนากว่า $Z$ เพราะใช้ $S$ ซึ่งมีความไม่แน่นอนแทน $\\sigma$ · เมื่อ $df$ มากขึ้น $t$ จะเข้าใกล้ $Z$' };
  };

  /* =================== บทที่ 4 =================== */

  F['ci-anatomy'] = () => {
    const y = 120;
    let h = L(30, y, 490, y, 'ax');
    h += L(140, y, 380, y, 'ln la', ' stroke-width="5" stroke-linecap="round"') + C(260, y, 8, 'cb');
    h += L(140, y - 14, 140, y + 14, 'ln la', ' stroke-width="2.5"') + L(380, y - 14, 380, y + 14, 'ln la', ' stroke-width="2.5"');
    h += T(260, y + 40, 'x̄', 'cb b big') + T(260, y + 62, 'ค่าประมาณแบบจุด', 'sm');
    h += T(140, y + 40, 'x̄ − E', 'ca b') + T(140, y + 62, 'ขอบล่าง', 'sm') + T(380, y + 40, 'x̄ + E', 'ca b') + T(380, y + 62, 'ขอบบน', 'sm');
    const br = (x1, x2) => '<path d="M' + x1 + ' ' + (y - 28) + 'v-10H' + x2 + 'v10" class="ln lc" fill="none"/>';
    h += br(146, 254) + br(266, 374) + T(200, y - 48, 'E', 'cc b') + T(320, y - 48, 'E', 'cc b');
    h += T(260, 30, 'E = ค่าวิกฤต × SE  เช่น  1.96 × σ/√n', 'ink b');
    return { svg: svg(200, h, 'องค์ประกอบของช่วงความเชื่อมั่น'),
      cap: 'ช่วงความเชื่อมั่น = ค่าประมาณแบบจุด ± ความคลาดเคลื่อน $E$ · ช่วงกว้างขึ้นเมื่อความเชื่อมั่นสูงขึ้นหรือ $\\sigma$ มากขึ้น และแคบลงเมื่อ $n$ เพิ่ม' };
  };

  F['ci-coverage'] = () => {
    const off = [0.3, -1.1, 0.8, -0.2, 1.4, -0.6, 0.1, 2.3, -1.5, 0.5, -0.9, 1.0, -0.3, 0.7, -1.8, 0.2, -0.4, 1.6, -1.2, 0.9];
    const m = frame(-4.3, 4.3, 0, 1, 60, 470, 0, 0);
    let h = '';
    off.forEach((o, i) => {
      const y = 22 + i * 13.5, miss = Math.abs(o) > 1.96;
      h += L(m.X(o - 1.96), y, m.X(o + 1.96), y, 'ln ' + (miss ? 'ld' : 'la'), ' stroke-width="3" stroke-linecap="round"') +
        C(m.X(o), y, 3.2, miss ? 'cd' : 'cink');
      if (miss) h += T(m.X(o + 1.96) + 10, y + 5, '✗ พลาด', 'cd sm b', 'start');
    });
    h += L(m.X(0), 8, m.X(0), 292, 'ln lb dash') + T(m.X(0), 310, 'μ จริง (ไม่เปลี่ยน)', 'cb b');
    return { svg: svg(320, h, 'ช่วงความเชื่อมั่น 95% จาก 20 ตัวอย่าง'),
      cap: 'สุ่ม 20 ครั้ง สร้างช่วง 95% ได้ 20 ช่วง: <b>19 ช่วงครอบ $\\mu$ อีก 1 ช่วงพลาด</b> — "95%" คืออัตราความสำเร็จของ<b>วิธีการ</b> ไม่ใช่ของช่วงใดช่วงหนึ่ง' };
  };

  F['dartboard'] = () => {
    const kinds = [
      [0, 0, 7, 'ไม่ลำเอียง · แปรปรวนต่ำ', 'cok', '✓ ดีที่สุด'],
      [0, 0, 24, 'ไม่ลำเอียง · แปรปรวนสูง', 'ink', ''],
      [26, -18, 7, 'ลำเอียง · แปรปรวนต่ำ', 'ink', ''],
      [26, -18, 24, 'ลำเอียง · แปรปรวนสูง', 'cd', '✗ แย่ที่สุด']
    ];
    let h = '';
    kinds.forEach((k, i) => {
      const u = rng(11 + i), cx = 130 + (i % 2) * 260, cy = 90 + Math.floor(i / 2) * 170;
      h += C(cx, cy, 62, 'ln', ' stroke-width="1" fill="none"') + C(cx, cy, 42, 'ln', ' stroke-width="1" fill="none"') +
        C(cx, cy, 22, 'cb', ' fill-opacity=".25"') + C(cx, cy, 3, 'cb');
      for (let j = 0; j < 9; j++) h += C(cx + k[0] + u.norm() * k[2], cy + k[1] + u.norm() * k[2], 4.5, 'ca', ' fill-opacity=".85"');
      h += T(cx, cy + 86, k[3], 'sm ' + (k[4] === 'ink' ? '' : k[4] + ' b')) + (k[5] ? T(cx + 66, cy - 50, k[5], k[4] + ' sm b', 'start') : '');
    });
    return { svg: svg(345, h, 'เปรียบเทียบความลำเอียงและความแปรปรวนของตัวประมาณ'),
      cap: 'จุดกลางเป้า = ค่าพารามิเตอร์จริง $\\theta$ · จุดสีน้ำเงิน = ค่าประมาณจากตัวอย่างแต่ละชุด · <b>ไม่ลำเอียง</b> คือเฉลี่ยแล้วตรงกลาง <b>แปรปรวนต่ำ</b> คือจับกลุ่มแน่น' };
  };

  /* =================== บทที่ 5 =================== */

  F['alpha-beta'] = () => {
    const m = frame(-3.6, 6.2, 0, 0.45, 20, 500, 34, 190);
    const f0 = x => npdf(x, 0, 1), f1 = x => npdf(x, 2.6, 1), c = 1.645;
    let h = area(f1, c, 6.2, m, 'cok', 0.18) + area(f1, -1.2, c, m, 'cb', 0.4) + area(f0, c, 4, m, 'cd', 0.55) +
      curve(f0, -3.6, 4.5, m) + curve(f1, -1.2, 6.2, m, 'ln lc');
    h += L(m.X(c), 26, m.X(c), 190, 'ln ld dash') + T(m.X(c), 18, 'ค่าวิกฤต', 'cd sm b');
    h += T(m.X(0), m.Y(0.41), 'เมื่อ H₀ จริง', 'ink sm b') + T(m.X(2.6), m.Y(0.41), 'เมื่อ H₁ จริง', 'cc sm b');
    h += T(m.X(2.05), m.Y(0.035), 'α', 'cd b big') + T(m.X(1.05), m.Y(0.09), 'β', 'cb b big') + T(m.X(3.4), m.Y(0.15), '1 − β', 'cok b') + T(m.X(3.4), m.Y(0.15) + 17, '(อำนาจ)', 'cok xs');
    h += L(m.left, 190, m.right, 190, 'ax');
    h += T(m.X(c) - 10, 214, '← ไม่ปฏิเสธ H₀', 'sm', 'end') + T(m.X(c) + 10, 214, 'ปฏิเสธ H₀ →', 'cd sm b', 'start');
    return { svg: svg(225, h, 'ความคลาดเคลื่อนแบบที่ 1 และแบบที่ 2'),
      cap: 'เลื่อนเส้นค่าวิกฤตไปทางขวา (ลด $\\alpha$) พื้นที่ $\\beta$ จะโตขึ้นทันที · ทางเดียวที่ลดทั้งคู่คือเพิ่ม $n$ ให้สองโค้งแคบลงจนแยกกัน' };
  };

  F['tails3'] = () => {
    const f = x => npdf(x, 0, 1);
    const ps = [
      ['หางซ้าย', 'H₁: μ < μ₀', [[-3.6, -1.645]], ['α']],
      ['สองหาง', 'H₁: μ ≠ μ₀', [[-3.6, -1.96], [1.96, 3.6]], ['α/2', 'α/2']],
      ['หางขวา', 'H₁: μ > μ₀', [[1.645, 3.6]], ['α']]
    ];
    let h = '';
    ps.forEach((p, i) => {
      const m = frame(-3.6, 3.6, 0, 0.42, 10 + i * 172, 166 + i * 172, 50, 150);
      h += T((m.left + m.right) / 2, 18, p[0], 'ink b') + T((m.left + m.right) / 2, 38, p[1], 'sm');
      p[2].forEach((r, j) => {
        h += area(f, r[0], r[1], m, 'cd', 0.55);
        const xm = r[0] < 0 ? r[1] - 0.6 : r[0] + 0.6;
        h += T(m.X(xm), m.Y(0.1), p[3][j], 'cd sm b');
      });
      h += curve(f, -3.6, 3.6, m) + L(m.left, m.bottom, m.right, m.bottom, 'ax');
    });
    h += T(260, 178, 'พื้นที่สีแดง = เขตปฏิเสธ H₀ · หางชี้ไปทางเดียวกับเครื่องหมายใน H₁', 'sm');
    return { svg: svg(190, h, 'เขตวิกฤตของการทดสอบหางซ้าย สองหาง และหางขวา'),
      cap: 'สองหางแบ่ง $\\alpha$ ออกเป็นสองข้าง ข้างละ $\\alpha/2$ ค่าวิกฤตจึงไกลกว่า (1.96 เทียบกับ 1.645 ที่ $\\alpha=0.05$)' };
  };

  F['pvalue'] = () => {
    const f = x => npdf(x, 0, 1);
    const m = frame(-3.6, 3.6, 0, 0.42, 20, 500, 30, 180);
    let h = '<path d="' + (function () {
      let d = 'M' + m.X(1.645) + ' ' + m.Y(0);
      for (let x = 1.645; x <= 3.6; x += 0.02) d += 'L' + r1(m.X(x)) + ' ' + r1(m.Y(f(x)));
      return d + 'L' + m.X(3.6) + ' ' + m.Y(0) + 'Z';
    })() + '" class="ln ld" fill="none" stroke-dasharray="4 3"/>';
    h += area(f, 2.0, 3.6, m, 'ca', 0.55) + curve(f, -3.6, 3.6, m) + xAxis(m, [-3, -2, -1, 0, 1, 2, 3]);
    h += L(m.X(2), m.Y(0.22), m.X(2), m.bottom, 'ln la', ' stroke-width="2.5"') + T(m.X(2) + 8, m.Y(0.22) + 4, 'z ที่คำนวณได้ = 2.00', 'ca sm b', 'start');
    h += L(m.X(1.645), m.Y(0.33), m.X(1.645), m.bottom, 'ln ld dash') + T(m.X(1.645) + 8, m.Y(0.33) + 4, 'ค่าวิกฤต 1.645', 'cd sm b', 'start');
    h += T(m.X(3.0), m.Y(0.1), 'p = 0.023', 'ca b') + T(m.X(-3.5), m.Y(0.36), 'กรอบประแดง = α = 0.05', 'cd sm', 'start');
    return { svg: svg(210, h, 'ค่า p คือพื้นที่หางที่เลยค่าสถิติทดสอบออกไป'),
      cap: 'ค่า p = พื้นที่ที่ "สุดโต่งกว่าข้อมูลของเรา" ถ้า $H_0$ จริง · พื้นที่สีน้ำเงิน (0.023) เล็กกว่ากรอบ $\\alpha$ (0.05) จึงปฏิเสธ $H_0$' };
  };

  F['anova-idea'] = () => {
    const sets = [
      [[4, 7, 10], 0.7, 'F ใหญ่ → ปฏิเสธ H₀', 'ค่าเฉลี่ยห่างกัน · ในกลุ่มแน่น', 'cd'],
      [[6.4, 7, 7.6], 2.1, 'F เล็ก → ไม่ปฏิเสธ H₀', 'ค่าเฉลี่ยใกล้กัน · ในกลุ่มกระจาย', 'cok']
    ];
    const cols = ['ca', 'cc', 'cb'];
    let h = '';
    sets.forEach((s, i) => {
      const u = rng(21 + i), ox = i * 262;
      const m = frame(0, 14, 0, 14, ox + 30, ox + 250, 40, 210);
      h += T(ox + 140, 18, s[3], 'sm') + L(ox + 30, 210, ox + 250, 210, 'ax');
      h += L(ox + 30, m.Y(7), ox + 250, m.Y(7), 'ln dash', ' stroke-width="1.2"') + (i ? '' : T(ox + 32, m.Y(7) - 6, 'x̄ รวม', 'mute xs', 'start'));
      s[0].forEach((mu, g) => {
        const gx = ox + 70 + g * 70;
        for (let k = 0; k < 7; k++) h += C(gx + (u() - 0.5) * 26, m.Y(Math.max(0.4, Math.min(13.6, mu + u.norm() * s[1]))), 4.5, cols[g], ' fill-opacity=".75"');
        h += L(gx - 20, m.Y(mu), gx + 20, m.Y(mu), 'ln ' + cols[g].replace('c', 'l'), ' stroke-width="3"') + T(gx, 230, 'กลุ่ม ' + (g + 1), 'xs mute');
      });
      h += T(ox + 140, 256, s[2], s[4] + ' b');
    });
    return { svg: svg(265, h, 'แนวคิดของ ANOVA เปรียบเทียบความแปรผันระหว่างกลุ่มกับภายในกลุ่ม'),
      cap: '$F=\\dfrac{MSB}{MSW}$ = ความห่างระหว่างค่าเฉลี่ยกลุ่ม (เส้นสี) เทียบกับการกระจายภายในกลุ่ม (จุด) · ซ้ายห่างกันชัดเจน ขวาแยกไม่ออก' };
  };

  F['chisq-bars'] = () => {
    const O = [15, 25, 18, 22, 24, 16], E = 20;
    const m = frame(0.4, 6.6, 0, 30, 40, 500, 20, 180);
    let h = '';
    O.forEach((o, i) => {
      const x = m.X(i + 1);
      h += R(x - 22, m.Y(o), 44, m.Y(0) - m.Y(o), 'ca', ' fill-opacity=".7" rx="3"') + T(x, m.Y(o) + 20, o, 'bg sm b') +
        L(x, m.Y(o), x, m.Y(E), 'ln ld', ' stroke-width="2"') + T(x, 200, 'หน้า ' + (i + 1), 'sm');
    });
    h += L(m.left, m.Y(E), m.right, m.Y(E), 'ln lb dash', ' stroke-width="2"') + T(m.left - 4, m.Y(E) + 5, 'E', 'cb b', 'end') +
      L(m.left, m.bottom, m.right, m.bottom, 'ax');
    h += T(500, 226, 'χ² = Σ (O − E)² / E = 4.5', 'ink b', 'end');
    return { svg: svg(236, h, 'เปรียบเทียบความถี่ที่สังเกตได้กับความถี่คาดหวัง'),
      cap: 'แท่งสีน้ำเงิน = ความถี่ที่สังเกตได้ $O$ · เส้นประ = ความถี่คาดหวัง $E=20$ · เส้นแดงคือส่วนต่าง ยิ่งยาวรวมกันมาก $\\chi^2$ ยิ่งใหญ่' };
  };

  /* =================== บทที่ 6 =================== */

  F['sign-test'] = () => {
    const d = [3, 5, 2, 6, 1, 4, 7, 2, -2, 0];
    let h = T(20, 22, '① ผลต่างของแต่ละคน (หลัง − ก่อน)', 'ink b', 'start');
    d.forEach((v, i) => {
      const x = 38 + i * 48, cls = v > 0 ? 'cok' : v < 0 ? 'cd' : 'mute';
      h += R(x - 19, 36, 38, 38, 'bg', ' rx="19"') + R(x - 19, 36, 38, 38, 'ln ' + (v > 0 ? 'lok' : v < 0 ? 'ld' : ''), ' rx="19" stroke-width="1.5"') +
        T(x, 61, v > 0 ? '+' : v < 0 ? '−' : '0', cls + ' b big');
      if (!v) h += L(x - 16, 39, x + 16, 71, 'ln ld', ' stroke-width="2"') + T(x, 92, 'ตัดทิ้ง', 'cd xs');
    });
    h += T(20, 122, '② ถ้า H₀ จริง จำนวน "+" จาก n = 9 ~ B(9, 0.5)', 'ink b', 'start');
    const m = frame(-0.6, 9.6, 0, 0.27, 40, 500, 136, 236);
    for (let x = 0; x <= 9; x++) {
      const v = S.binomPmf(x, 9, 0.5), hi = x >= 8;
      h += R(m.X(x) - 15, m.Y(v), 30, m.Y(0) - m.Y(v), hi ? 'cd' : 'ca', ' fill-opacity="' + (hi ? '.8' : '.35') + '" rx="2"');
    }
    h += xAxis(m, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) + T(m.X(9.5), m.Y(0.22), 'P(X ≥ 8) = 0.0195', 'cd b', 'end') +
      L(m.X(8.5), m.Y(0.19), m.X(8.3), m.Y(0.04), 'ln ld', ' stroke-width="1.2"');
    return { svg: svg(265, h, 'หลักการของการทดสอบเครื่องหมาย'),
      cap: 'ตัวอย่าง 6.1: สนใจแค่เครื่องหมาย ได้ "+" 8 จาก 9 คน · ถ้าอบรมไม่มีผล โอกาสได้ "+" มากขนาดนี้มีเพียง 1.95% จึงปฏิเสธ $H_0$' };
  };

  F['rank-merge'] = () => {
    const g1 = [12, 15, 18, 20], g2 = [10, 11, 14, 16, 13];
    const all = g1.map(v => [v, 1]).concat(g2.map(v => [v, 2])).sort((a, b) => a[0] - b[0]);
    const m = frame(9, 21, 0, 1, 40, 490, 0, 0);
    let h = T(20, 20, '① วางข้อมูลสองกลุ่มบนเส้นจำนวนเดียวกัน', 'ink b', 'start') + L(m.left, 80, m.right, 80, 'ax');
    [10, 12, 14, 16, 18, 20].forEach(v => { h += L(m.X(v), 80, m.X(v), 85, 'ax') + T(m.X(v), 100, v, 'xs mute'); });
    all.forEach(p => { h += C(m.X(p[0]), p[1] === 1 ? 50 : 66, 7, p[1] === 1 ? 'ca' : 'cb'); });
    h += C(398, 15, 6, 'ca') + T(408, 20, 'กลุ่ม 1', 'ca sm b', 'start') + C(458, 15, 6, 'cb') + T(468, 20, 'กลุ่ม 2', 'cb sm b', 'start');
    h += T(20, 134, '② ให้อันดับรวม 1 – 9 จากน้อยไปมาก', 'ink b', 'start');
    all.forEach((p, i) => {
      const x = 52 + i * 52, cls = p[1] === 1 ? 'ca' : 'cb';
      h += C(x, 168, 19, cls, ' fill-opacity=".2"') + C(x, 168, 19, 'ln ' + cls.replace('c', 'l'), ' fill="none"') +
        T(x, 174, i + 1, cls + ' b') + T(x, 204, p[0], 'xs mute');
    });
    h += T(130, 240, 'R₁ = 3 + 6 + 8 + 9 = 26', 'ca b') + T(390, 240, 'R₂ = 1 + 2 + 4 + 5 + 7 = 19', 'cb b');
    return { svg: svg(255, h, 'การจัดอันดับรวมของ Mann–Whitney'),
      cap: 'ถ้าสองกลุ่มไม่ต่างกัน อันดับจะสลับคละกันพอ ๆ กัน · ถ้ากลุ่มหนึ่งได้อันดับสูงเกือบหมด แสดงว่าค่ากลางต่างกัน' };
  };

  /* =================== บทที่ 7 =================== */

  function regData() {
    const u = rng(5), xs = [1, 2, 3, 4, 5, 6, 7, 8, 9], ys = xs.map(x => 52 + 4.5 * x + u.norm() * 5);
    const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
    let sxx = 0, sxy = 0; xs.forEach((x, i) => { sxx += (x - mx) ** 2; sxy += (x - mx) * (ys[i] - my); });
    const b1 = sxy / sxx, b0 = my - b1 * mx;
    return { xs, ys, b0, b1, mx, my };
  }

  F['scatter-resid'] = () => {
    const d = regData();
    const m = frame(0, 10, 45, 105, 50, 500, 20, 210);
    let h = L(m.left, m.bottom, m.right, m.bottom, 'ax') + L(m.left, m.top, m.left, m.bottom, 'ax');
    [2, 4, 6, 8].forEach(v => { h += T(m.X(v), m.bottom + 18, v, 'xs mute'); });
    [60, 80, 100].forEach(v => { h += T(m.left - 8, m.Y(v) + 4, v, 'xs mute', 'end'); });
    h += L(m.X(0.3), m.Y(d.b0 + d.b1 * 0.3), m.X(9.7), m.Y(d.b0 + d.b1 * 9.7), 'ln la', ' stroke-width="2.5"');
    d.xs.forEach((x, i) => {
      const yh = d.b0 + d.b1 * x;
      h += L(m.X(x), m.Y(d.ys[i]), m.X(x), m.Y(yh), 'ln ld', ' stroke-width="1.6"') + C(m.X(x), m.Y(d.ys[i]), 5, 'cink');
    });
    h += T(m.X(9.6), m.Y(d.b0 + d.b1 * 9.6) - 12, 'ŷ = b₀ + b₁x', 'ca b', 'end') +
      T(m.X(0.4), m.Y(100), 'เส้นแดง = ส่วนเหลือ e = y − ŷ', 'cd sm', 'start') +
      T(m.X(0.4), m.Y(100) + 18, 'เลือกเส้นที่ Σe² น้อยที่สุด', 'sm', 'start') +
      T(m.right, m.bottom + 36, 'X', 'mute sm', 'end') + T(m.left - 30, m.top + 4, 'Y', 'mute sm', 'start');
    return { svg: svg(255, h, 'เส้นถดถอยและส่วนเหลือ'),
      cap: 'วิธีกำลังสองน้อยที่สุด: เส้นที่ดีที่สุดคือเส้นที่ทำให้ผลรวมกำลังสองของความยาวเส้นแดงน้อยที่สุด' };
  };

  F['sst-split'] = () => {
    const m = frame(0, 10, 40, 110, 50, 330, 20, 290);
    const b0 = 47.5, b1 = 4.5, my = 70, x = 8, y = 100, yh = b0 + b1 * x;
    let h = L(m.left, m.bottom, m.right, m.bottom, 'ax') + L(m.left, m.top, m.left, m.bottom, 'ax');
    h += L(m.X(0.3), m.Y(b0 + b1 * 0.3), m.X(10), m.Y(b0 + b1 * 10), 'ln la', ' stroke-width="2.2"') +
      L(m.left, m.Y(my), m.right, m.Y(my), 'ln dash') + T(m.left + 6, m.Y(my) - 8, 'ȳ = 70', 'sm', 'start') +
      T(m.X(1.4), m.Y(b0 + b1 * 1.4) + 24, 'ŷ = 47.5 + 4.5x', 'ca sm b', 'start');
    h += C(m.X(x), m.Y(y), 6, 'cink') + T(m.X(x), m.Y(y) - 12, '(8, 100)', 'sm ink');
    const X0 = m.X(x) - 18, X1 = m.X(x) + 18;
    h += L(m.X(x), m.Y(yh), X1, m.Y(yh), 'ln dash', ' stroke-width="1"') +
      L(X0, m.Y(my), X0, m.Y(y), 'ln', ' stroke-width="4"') +
      L(X1, m.Y(my), X1, m.Y(yh), 'ln la', ' stroke-width="4"') + L(X1, m.Y(yh), X1, m.Y(y), 'ln ld', ' stroke-width="4"');
    h += T(X0 - 10, m.Y((my + y) / 2) - 4, 'y − ȳ = 30', 'ink b', 'end') + T(X0 - 10, m.Y((my + y) / 2) + 14, 'ทั้งหมด (SST)', 'sm', 'end');
    // ป้ายด้านขวาอยู่นอกพื้นที่กราฟ จึงไม่ทับเส้นถดถอย
    const lx = 350;
    const tag = (ya, yb, cls, a, b) => L(X1 + 4, m.Y((ya + yb) / 2), lx - 6, m.Y((ya + yb) / 2), 'ln ' + cls.replace('c', 'l'), ' stroke-width="1" stroke-dasharray="2 3"') +
      T(lx, m.Y((ya + yb) / 2) - 2, a, cls + ' b', 'start') + T(lx, m.Y((ya + yb) / 2) + 16, b, 'sm', 'start');
    h += tag(yh, y, 'cd', 'y − ŷ = 16.5', 'ส่วนเหลือ (SSE)') + tag(my, yh, 'ca', 'ŷ − ȳ = 13.5', 'อธิบายได้ (SSR)');
    return { svg: svg(305, h, 'การแยกความแปรผันทั้งหมดเป็นส่วนที่อธิบายได้และส่วนเหลือ'),
      cap: 'ทุกจุด: ระยะจาก $\\bar y$ (ดำ) = ส่วนที่เส้นถดถอยอธิบายได้ (น้ำเงิน) + ส่วนที่เหลือ (แดง) · ยกกำลังสองแล้วรวมทุกจุดได้ $SST=SSR+SSE$' };
  };

  F['r-gallery'] = () => {
    const rhos = [0.95, 0.6, 0, -0.6, -0.95, 'curve'];
    let h = '';
    rhos.forEach((rho, i) => {
      const u = rng(31 + i), ox = (i % 3) * 174, oy = Math.floor(i / 3) * 162;
      // สร้างข้อมูลให้ r ของตัวอย่างเท่ากับค่าที่ต้องการพอดี
      const z = a => { const mu = a.reduce((s, v) => s + v, 0) / a.length; const c = a.map(v => v - mu);
        const sd = Math.sqrt(c.reduce((s, v) => s + v * v, 0) / a.length); return c.map(v => v / sd); };
      let xs = [], es = [];
      for (let k = 0; k < 20; k++) { const x = u.norm(); xs.push(x, -x); es.push(u.norm(), u.norm()); }
      xs = z(xs); es = z(es);
      const bx = es.reduce((s, v, k) => s + v * xs[k], 0) / xs.length;
      es = z(es.map((v, k) => v - bx * xs[k]));
      const ys = rho === 'curve' ? xs.map((x, k) => x * x - 1 + es[k] * 0.2) : xs.map((x, k) => rho * x + Math.sqrt(1 - rho * rho) * es[k]);
      const r = S.pearson(xs, ys);
      const m = frame(-2.8, 2.8, -2.8, rho === 'curve' ? 6 : 2.8, ox + 14, ox + 160, oy + 12, oy + 122);
      h += R(ox + 10, oy + 8, 154, 118, 'ax', ' rx="8"');
      xs.forEach((x, k) => { h += C(m.X(x), m.Y(Math.max(-2.8, Math.min(rho === 'curve' ? 6 : 2.8, ys[k]))), 3, 'ca', ' fill-opacity=".7"'); });
      h += T(ox + 87, oy + 146, 'r = ' + fmt(r, 2), 'ink b');
      if (rho === 'curve') h += T(ox + 87, oy + 24, 'สัมพันธ์แบบโค้ง!', 'cd xs b');
    });
    return { svg: svg(325, h, 'แผนภาพการกระจายตามค่าสัมประสิทธิ์สหสัมพันธ์'),
      cap: 'ยิ่ง $|r|$ ใกล้ 1 จุดยิ่งเกาะเป็นเส้นตรง เครื่องหมายบอกทิศ · ภาพสุดท้าย $r\\approx0$ แต่ $X$ กับ $Y$ สัมพันธ์กันชัดเจนแบบโค้ง — $r$ วัดเฉพาะ<b>เชิงเส้น</b>' };
  };

  F['ci-pi'] = () => {
    const n = 10, sxx = 40, mx = 5, s = Math.sqrt(190 / 8), t = 2.306;
    const yh = x => 47.5 + 4.5 * x;
    const ci = x => t * s * Math.sqrt(1 / n + (x - mx) ** 2 / sxx), pi = x => t * s * Math.sqrt(1 + 1 / n + (x - mx) ** 2 / sxx);
    const m = frame(0, 10, 30, 115, 50, 500, 16, 220);
    const band = (g, cls, op) => {
      let d = '', back = '';
      for (let x = 0; x <= 10.001; x += 0.1) {
        d += (d ? 'L' : 'M') + r1(m.X(x)) + ' ' + r1(m.Y(yh(x) + g(x)));
        back = 'L' + r1(m.X(x)) + ' ' + r1(m.Y(yh(x) - g(x))) + back;
      }
      return '<path d="' + d + back + 'Z" class="' + cls + '" fill-opacity="' + op + '"/>';
    };
    let h = band(pi, 'cb', 0.2) + band(ci, 'ca', 0.35) +
      L(m.X(0), m.Y(yh(0)), m.X(10), m.Y(yh(10)), 'ln la', ' stroke-width="2.2"') +
      L(m.left, m.bottom, m.right, m.bottom, 'ax') + L(m.left, m.top, m.left, m.bottom, 'ax') +
      L(m.X(mx), m.top, m.X(mx), m.bottom, 'grid dash') + T(m.X(mx), m.bottom + 18, 'x̄ = 5 (แคบสุด)', 'sm');
    [0, 2, 8, 10].forEach(v => { h += T(m.X(v), m.bottom + 18, v, 'xs mute'); });
    [40, 60, 80, 100].forEach(v => { h += T(m.left - 8, m.Y(v) + 4, v, 'xs mute', 'end'); });
    h += R(m.X(0.3), 20, 18, 12, 'cb', ' fill-opacity=".45"') + T(m.X(0.3) + 26, 31, 'ช่วงพยากรณ์ (PI) ค่ารายตัว', 'cb b', 'start') +
      R(m.X(0.3), 44, 18, 12, 'ca', ' fill-opacity=".6"') + T(m.X(0.3) + 26, 55, 'ช่วงความเชื่อมั่น (CI) ค่าเฉลี่ย', 'ca b', 'start');
    return { svg: svg(245, h, 'เปรียบเทียบช่วงความเชื่อมั่นกับช่วงพยากรณ์ในการถดถอย'),
      cap: 'จากตัวอย่าง 7.1: แถบน้ำเงินเข้ม (CI) แคบกว่าแถบส้ม (PI) เสมอ และทั้งสองแถบบานออกเมื่อ $x_0$ ห่างจาก $\\bar x$' };
  };

  /* ---------- ส่วนแสดงผล ---------- */
  function render(name) {
    const fn = F[name];
    if (!fn) return '';
    try {
      const f = fn();
      return '<figure class="fig"><div class="fig-s">' + f.svg + '</div>' +
        '<div class="fig-hint">แตะภาพเพื่อขยาย</div>' +
        (f.cap ? '<figcaption>' + f.cap + '</figcaption>' : '') + '</figure>';
    } catch (e) {
      console.error('figure', name, e);
      return '';
    }
  }
  // จอเล็ก: แตะภาพเพื่อขยาย แล้วปัดซ้าย–ขวาดูได้
  global.document && document.addEventListener('click', e => {
    const f = e.target.closest && e.target.closest('figure.fig');
    if (!f || global.innerWidth > 700 || e.target.closest('a')) return;
    f.classList.toggle('big');
    const h = f.querySelector('.fig-hint');
    if (h) h.textContent = f.classList.contains('big') ? 'ปัดซ้าย–ขวาเพื่อดู · แตะอีกครั้งเพื่อย่อ' : 'แตะภาพเพื่อขยาย';
  });

  global.FIGURES = { render, names: Object.keys(F) };
})(window);
