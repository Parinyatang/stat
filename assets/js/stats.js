/* ============================================================
   stats.js — เครื่องยนต์คำนวณทางสถิติ
   คำนวณค่าการแจกแจงทั้งหมดด้วยตัวเลข (ไม่ต้องเปิดตาราง)
   ใช้ได้ทั้ง Z, t, Chi-square, F, Binomial, Poisson
   ============================================================ */
(function (global) {
  'use strict';

  const S = {};

  /* ---------- ฟังก์ชันพิเศษพื้นฐาน ---------- */

  // ln Γ(x) — Lanczos approximation
  S.gammaln = function (x) {
    const g = [
      76.18009172947146, -86.50532032941677, 24.01409824083091,
      -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5
    ];
    let xx = x, y = x, tmp = xx + 5.5;
    tmp -= (xx + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) ser += g[j] / ++y;
    return -tmp + Math.log(2.5066282746310005 * ser / xx);
  };

  S.gamma = function (x) {
    if (x < 0.5) return Math.PI / (Math.sin(Math.PI * x) * S.gamma(1 - x));
    return Math.exp(S.gammaln(x));
  };

  S.factorial = function (n) {
    if (n < 0) return NaN;
    if (n < 171) { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
    return Math.exp(S.gammaln(n + 1));
  };

  S.lnFactorial = function (n) { return S.gammaln(n + 1); };

  // จำนวนวิธีจัดหมู่ C(n,r)
  S.combin = function (n, r) {
    if (r < 0 || r > n) return 0;
    r = Math.min(r, n - r);
    let res = 1;
    for (let i = 0; i < r; i++) res = res * (n - i) / (i + 1);
    return Math.round(res * 1e10) / 1e10;
  };

  // จำนวนวิธีเรียงสับเปลี่ยน P(n,r)
  S.permut = function (n, r) {
    if (r < 0 || r > n) return 0;
    let res = 1;
    for (let i = 0; i < r; i++) res *= (n - i);
    return res;
  };

  // อินคอมพลีตแกมมา P(a,x) — regularized lower
  S.lowerGamma = function (a, x) {
    if (x < 0 || a <= 0) return NaN;
    if (x === 0) return 0;
    if (x < a + 1) {
      // อนุกรม
      let ap = a, sum = 1 / a, del = sum;
      for (let n = 1; n < 500; n++) {
        ap++; del *= x / ap; sum += del;
        if (Math.abs(del) < Math.abs(sum) * 1e-14) break;
      }
      return sum * Math.exp(-x + a * Math.log(x) - S.gammaln(a));
    } else {
      // เศษส่วนต่อเนื่อง สำหรับ Q(a,x)
      const FPMIN = 1e-300;
      let b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d;
      for (let i = 1; i < 500; i++) {
        const an = -i * (i - a);
        b += 2; d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN;
        c = b + an / c; if (Math.abs(c) < FPMIN) c = FPMIN;
        d = 1 / d; const del = d * c; h *= del;
        if (Math.abs(del - 1) < 1e-14) break;
      }
      const q = Math.exp(-x + a * Math.log(x) - S.gammaln(a)) * h;
      return 1 - q;
    }
  };

  // อินคอมพลีตเบตา I_x(a,b) — regularized
  S.betacf = function (a, b, x) {
    const FPMIN = 1e-300;
    const qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d; let h = d;
    for (let m = 1; m <= 300; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; const del = d * c; h *= del;
      if (Math.abs(del - 1) < 1e-14) break;
    }
    return h;
  };

  S.ibeta = function (x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bt = Math.exp(S.gammaln(a + b) - S.gammaln(a) - S.gammaln(b) +
      a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) return bt * S.betacf(a, b, x) / a;
    return 1 - bt * S.betacf(b, a, 1 - x) / b;
  };

  S.erf = function (x) {
    const t = 1 / (1 + 0.5 * Math.abs(x));
    const y = t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 +
      t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 +
      t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? 1 - y : y - 1;
  };

  /* ---------- การแจกแจงปกติ (Normal) ---------- */

  S.normPdf = function (x, mu, sd) {
    mu = mu || 0; sd = sd === undefined ? 1 : sd;
    const z = (x - mu) / sd;
    return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
  };

  // P(X <= x)
  S.normCdf = function (x, mu, sd) {
    mu = mu || 0; sd = sd === undefined ? 1 : sd;
    return 0.5 * (1 + S.erf((x - mu) / (sd * Math.SQRT2)));
  };

  // ค่า z ที่ทำให้ P(Z <= z) = p  (Acklam + Newton refinement)
  S.normInv = function (p, mu, sd) {
    mu = mu || 0; sd = sd === undefined ? 1 : sd;
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
      1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
      6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
      -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
      3.754408661907416e+00];
    const pl = 0.02425, ph = 1 - pl;
    let q, r, x;
    if (p < pl) {
      q = Math.sqrt(-2 * Math.log(p));
      x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= ph) {
      q = p - 0.5; r = q * q;
      x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    // ขัดเกลาด้วย Newton หนึ่งรอบ
    const e = S.normCdf(x) - p;
    const u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2);
    x = x - u / (1 + x * u / 2);
    return mu + sd * x;
  };

  /* ---------- t ของ Student ---------- */

  S.tPdf = function (t, df) {
    return Math.exp(S.gammaln((df + 1) / 2) - S.gammaln(df / 2)) /
      Math.sqrt(df * Math.PI) * Math.pow(1 + t * t / df, -(df + 1) / 2);
  };

  S.tCdf = function (t, df) {
    const x = df / (df + t * t);
    const p = 0.5 * S.ibeta(x, df / 2, 0.5);
    return t > 0 ? 1 - p : p;
  };

  S.tInv = function (p, df) {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    return bisect(function (t) { return S.tCdf(t, df) - p; }, -300, 300);
  };

  /* ---------- ไค-สแควร์ ---------- */

  S.chiPdf = function (x, df) {
    if (x <= 0) return 0;
    const k = df / 2;
    return Math.exp((k - 1) * Math.log(x) - x / 2 - S.gammaln(k) - k * Math.LN2);
  };

  S.chiCdf = function (x, df) {
    if (x <= 0) return 0;
    return S.lowerGamma(df / 2, x / 2);
  };

  S.chiInv = function (p, df) {   // ค่า x ที่ P(X <= x) = p
    if (p <= 0) return 0;
    if (p >= 1) return Infinity;
    return bisect(function (x) { return S.chiCdf(x, df) - p; }, 1e-10, 1e6);
  };

  /* ---------- F ---------- */

  S.fPdf = function (x, d1, d2) {
    if (x <= 0) return 0;
    const lnNum = (d1 / 2) * Math.log(d1 / d2) + (d1 / 2 - 1) * Math.log(x);
    const lnDen = ((d1 + d2) / 2) * Math.log(1 + d1 * x / d2) +
      S.gammaln(d1 / 2) + S.gammaln(d2 / 2) - S.gammaln((d1 + d2) / 2);
    return Math.exp(lnNum - lnDen);
  };

  S.fCdf = function (x, d1, d2) {
    if (x <= 0) return 0;
    return S.ibeta(d1 * x / (d1 * x + d2), d1 / 2, d2 / 2);
  };

  S.fInv = function (p, d1, d2) {
    if (p <= 0) return 0;
    if (p >= 1) return Infinity;
    return bisect(function (x) { return S.fCdf(x, d1, d2) - p; }, 1e-10, 1e7);
  };

  /* ---------- การแจกแจงไม่ต่อเนื่อง ---------- */

  S.binomPmf = function (k, n, p) {
    if (k < 0 || k > n) return 0;
    if (p === 0) return k === 0 ? 1 : 0;
    if (p === 1) return k === n ? 1 : 0;
    return Math.exp(S.gammaln(n + 1) - S.gammaln(k + 1) - S.gammaln(n - k + 1) +
      k * Math.log(p) + (n - k) * Math.log(1 - p));
  };

  S.binomCdf = function (k, n, p) {
    let s = 0;
    for (let i = 0; i <= Math.floor(k); i++) s += S.binomPmf(i, n, p);
    return Math.min(1, s);
  };

  S.poissonPmf = function (k, lam) {
    if (k < 0) return 0;
    return Math.exp(-lam + k * Math.log(lam) - S.gammaln(k + 1));
  };

  S.poissonCdf = function (k, lam) {
    let s = 0;
    for (let i = 0; i <= Math.floor(k); i++) s += S.poissonPmf(i, lam);
    return Math.min(1, s);
  };

  S.hyperPmf = function (k, N, K, n) {
    if (k < Math.max(0, n - (N - K)) || k > Math.min(n, K)) return 0;
    return S.combin(K, k) * S.combin(N - K, n - k) / S.combin(N, n);
  };

  S.geomPmf = function (k, p) {       // k = จำนวนครั้งที่ทดลองจนสำเร็จครั้งแรก (k = 1,2,...)
    if (k < 1) return 0;
    return Math.pow(1 - p, k - 1) * p;
  };

  S.negBinomPmf = function (x, r, p) { // x = จำนวนครั้งที่ทดลองจนสำเร็จครบ r ครั้ง
    if (x < r) return 0;
    return S.combin(x - 1, r - 1) * Math.pow(p, r) * Math.pow(1 - p, x - r);
  };

  /* ---------- การแจกแจงต่อเนื่องอื่น ---------- */

  S.expPdf = function (x, lam) { return x < 0 ? 0 : lam * Math.exp(-lam * x); };
  S.expCdf = function (x, lam) { return x < 0 ? 0 : 1 - Math.exp(-lam * x); };
  S.uniPdf = function (x, a, b) { return (x < a || x > b) ? 0 : 1 / (b - a); };
  S.uniCdf = function (x, a, b) { return x < a ? 0 : (x > b ? 1 : (x - a) / (b - a)); };

  /* ---------- สถิติพรรณนา ---------- */

  S.mean = function (a) { return a.reduce((s, x) => s + x, 0) / a.length; };

  S.median = function (a) {
    const b = a.slice().sort((x, y) => x - y), n = b.length;
    return n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2;
  };

  S.mode = function (a) {
    const c = {}; let best = [], bc = 0;
    a.forEach(v => { c[v] = (c[v] || 0) + 1; });
    for (const k in c) {
      if (c[k] > bc) { bc = c[k]; best = [Number(k)]; }
      else if (c[k] === bc) best.push(Number(k));
    }
    return bc <= 1 ? [] : best;
  };

  S.variance = function (a, population) {
    const m = S.mean(a);
    const ss = a.reduce((s, x) => s + (x - m) * (x - m), 0);
    return ss / (population ? a.length : a.length - 1);
  };

  S.sd = function (a, population) { return Math.sqrt(S.variance(a, population)); };

  S.quantile = function (a, q) {      // วิธี interpolation แบบเดียวกับ Excel/MINITAB (type 7)
    const b = a.slice().sort((x, y) => x - y);
    const pos = (b.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    if (lo === hi) return b[lo];
    return b[lo] + (pos - lo) * (b[hi] - b[lo]);
  };

  S.skewness = function (a) {
    const n = a.length, m = S.mean(a), s = S.sd(a);
    const sum = a.reduce((t, x) => t + Math.pow((x - m) / s, 3), 0);
    return n / ((n - 1) * (n - 2)) * sum;
  };

  S.kurtosis = function (a) {
    const n = a.length, m = S.mean(a), s = S.sd(a);
    const sum = a.reduce((t, x) => t + Math.pow((x - m) / s, 4), 0);
    return n * (n + 1) / ((n - 1) * (n - 2) * (n - 3)) * sum -
      3 * (n - 1) * (n - 1) / ((n - 2) * (n - 3));
  };

  S.summary = function (a) {
    return {
      n: a.length,
      mean: S.mean(a),
      median: S.median(a),
      mode: S.mode(a),
      sd: S.sd(a),
      variance: S.variance(a),
      min: Math.min.apply(null, a),
      max: Math.max.apply(null, a),
      q1: S.quantile(a, 0.25),
      q3: S.quantile(a, 0.75),
      iqr: S.quantile(a, 0.75) - S.quantile(a, 0.25),
      range: Math.max.apply(null, a) - Math.min.apply(null, a),
      cv: S.sd(a) / S.mean(a) * 100,
      se: S.sd(a) / Math.sqrt(a.length)
    };
  };

  /* ---------- การถดถอยและสหสัมพันธ์ ---------- */

  S.pearson = function (x, y) {
    const n = x.length, mx = S.mean(x), my = S.mean(y);
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) {
      sxy += (x[i] - mx) * (y[i] - my);
      sxx += (x[i] - mx) * (x[i] - mx);
      syy += (y[i] - my) * (y[i] - my);
    }
    return sxy / Math.sqrt(sxx * syy);
  };

  S.spearman = function (x, y) {
    const rank = function (arr) {
      const idx = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
      const r = new Array(arr.length);
      let i = 0;
      while (i < idx.length) {
        let j = i;
        while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
        const avg = (i + j) / 2 + 1;
        for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
        i = j + 1;
      }
      return r;
    };
    return S.pearson(rank(x), rank(y));
  };

  S.linreg = function (x, y) {
    const n = x.length, mx = S.mean(x), my = S.mean(y);
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) {
      sxy += (x[i] - mx) * (y[i] - my);
      sxx += (x[i] - mx) * (x[i] - mx);
      syy += (y[i] - my) * (y[i] - my);
    }
    const b1 = sxy / sxx, b0 = my - b1 * mx;
    const ssr = b1 * sxy, sse = syy - ssr, sst = syy;
    const df = n - 2, mse = sse / df;
    const seB1 = Math.sqrt(mse / sxx);
    const seB0 = Math.sqrt(mse * (1 / n + mx * mx / sxx));
    const tB1 = b1 / seB1;
    const F = (ssr / 1) / mse;
    const r = sxy / Math.sqrt(sxx * syy);
    return {
      n, b0, b1, r, r2: ssr / sst, sxx, syy, sxy,
      sse, ssr, sst, mse, df, s: Math.sqrt(mse),
      seB0, seB1, tB0: b0 / seB0, tB1,
      pB1: 2 * (1 - S.tCdf(Math.abs(tB1), df)),
      F, pF: 1 - S.fCdf(F, 1, df),
      predict: function (xv) { return b0 + b1 * xv; }
    };
  };

  /* ---------- การทดสอบสมมติฐาน ---------- */

  // tail: 'two' | 'left' | 'right'
  S.pFromZ = function (z, tail) {
    if (tail === 'left') return S.normCdf(z);
    if (tail === 'right') return 1 - S.normCdf(z);
    return 2 * (1 - S.normCdf(Math.abs(z)));
  };

  S.pFromT = function (t, df, tail) {
    if (tail === 'left') return S.tCdf(t, df);
    if (tail === 'right') return 1 - S.tCdf(t, df);
    return 2 * (1 - S.tCdf(Math.abs(t), df));
  };

  S.pFromChi = function (x, df, tail) {
    if (tail === 'left') return S.chiCdf(x, df);
    if (tail === 'two') {
      const p = S.chiCdf(x, df);
      return 2 * Math.min(p, 1 - p);
    }
    return 1 - S.chiCdf(x, df);
  };

  S.pFromF = function (x, d1, d2, tail) {
    if (tail === 'left') return S.fCdf(x, d1, d2);
    if (tail === 'two') {
      const p = S.fCdf(x, d1, d2);
      return 2 * Math.min(p, 1 - p);
    }
    return 1 - S.fCdf(x, d1, d2);
  };

  // ANOVA แบบจำแนกทางเดียว — groups = [[...],[...],...]
  S.anova1 = function (groups) {
    const k = groups.length;
    const N = groups.reduce((s, g) => s + g.length, 0);
    const grand = groups.reduce((s, g) => s + g.reduce((a, b) => a + b, 0), 0) / N;
    let ssb = 0, ssw = 0;
    const detail = groups.map(g => {
      const m = S.mean(g);
      ssb += g.length * (m - grand) * (m - grand);
      const w = g.reduce((s, x) => s + (x - m) * (x - m), 0);
      ssw += w;
      return { n: g.length, mean: m, sd: S.sd(g), ss: w };
    });
    const dfb = k - 1, dfw = N - k;
    const msb = ssb / dfb, msw = ssw / dfw;
    const F = msb / msw;
    return {
      k, N, grand, ssb, ssw, sst: ssb + ssw, dfb, dfw, dft: N - 1,
      msb, msw, F, p: 1 - S.fCdf(F, dfb, dfw), detail,
      eta2: ssb / (ssb + ssw)
    };
  };

  // ANOVA สองทาง (ไม่มีซ้ำในแต่ละเซลล์) — data[i][j] แถว i คอลัมน์ j
  S.anova2 = function (data) {
    const a = data.length, b = data[0].length, N = a * b;
    const grand = data.flat().reduce((s, x) => s + x, 0) / N;
    const rowM = data.map(r => S.mean(r));
    const colM = [];
    for (let j = 0; j < b; j++) colM.push(S.mean(data.map(r => r[j])));
    let ssa = 0, ssb = 0, sst = 0;
    rowM.forEach(m => ssa += b * (m - grand) ** 2);
    colM.forEach(m => ssb += a * (m - grand) ** 2);
    data.flat().forEach(x => sst += (x - grand) ** 2);
    const sse = sst - ssa - ssb;
    const dfa = a - 1, dfb2 = b - 1, dfe = dfa * dfb2;
    const msa = ssa / dfa, msb = ssb / dfb2, mse = sse / dfe;
    return {
      a, b, grand, rowM, colM,
      ssa, ssb, sse, sst, dfa, dfb: dfb2, dfe, dft: N - 1,
      msa, msb, mse,
      Fa: msa / mse, Fb: msb / mse,
      pa: 1 - S.fCdf(msa / mse, dfa, dfe),
      pb: 1 - S.fCdf(msb / mse, dfb2, dfe)
    };
  };

  // LSD สำหรับเปรียบเทียบพหุคูณ
  S.lsd = function (anova, alpha) {
    const t = S.tInv(1 - alpha / 2, anova.dfw);
    const out = [];
    for (let i = 0; i < anova.k; i++) {
      for (let j = i + 1; j < anova.k; j++) {
        const ni = anova.detail[i].n, nj = anova.detail[j].n;
        const lsdv = t * Math.sqrt(anova.msw * (1 / ni + 1 / nj));
        const diff = anova.detail[i].mean - anova.detail[j].mean;
        out.push({
          i: i + 1, j: j + 1, diff, lsd: lsdv,
          sig: Math.abs(diff) > lsdv
        });
      }
    }
    return out;
  };

  // Tukey HSD (ใช้ค่าประมาณ studentized range)
  S.tukeyQ = function (alpha, k, df) {
    // ค่าประมาณ q โดยการค้นหาเชิงตัวเลขจาก distribution ของ studentized range
    // ใช้การประมาณที่ยอมรับได้สำหรับการสอน
    const z = S.normInv(1 - alpha / (k * (k - 1)));
    const q = Math.SQRT2 * z * (1 + (z * z + 1) / (4 * df));
    return q;
  };

  // ไค-สแควร์ ตารางการณ์จร (contingency)
  S.chiIndep = function (table) {
    const r = table.length, c = table[0].length;
    const rowT = table.map(row => row.reduce((a, b) => a + b, 0));
    const colT = [];
    for (let j = 0; j < c; j++) colT.push(table.reduce((s, row) => s + row[j], 0));
    const n = rowT.reduce((a, b) => a + b, 0);
    const exp = [];
    let chi = 0, minE = Infinity, lowCells = 0;
    for (let i = 0; i < r; i++) {
      exp.push([]);
      for (let j = 0; j < c; j++) {
        const e = rowT[i] * colT[j] / n;
        exp[i].push(e);
        chi += (table[i][j] - e) ** 2 / e;
        minE = Math.min(minE, e);
        if (e < 5) lowCells++;
      }
    }
    const df = (r - 1) * (c - 1);
    return {
      chi, df, p: 1 - S.chiCdf(chi, df), exp, rowT, colT, n, minE, lowCells,
      cramerV: Math.sqrt(chi / (n * Math.min(r - 1, c - 1)))
    };
  };

  // ไค-สแควร์ ภาวะสารูปสนิทดี (goodness of fit)
  S.chiGof = function (obs, expected) {
    const n = obs.reduce((a, b) => a + b, 0);
    let exp = expected;
    if (!exp) exp = obs.map(() => n / obs.length);
    else {
      const se = exp.reduce((a, b) => a + b, 0);
      if (Math.abs(se - n) > 1e-6 && Math.abs(se - 1) < 1e-6) exp = exp.map(p => p * n);
    }
    let chi = 0;
    for (let i = 0; i < obs.length; i++) chi += (obs[i] - exp[i]) ** 2 / exp[i];
    const df = obs.length - 1;
    return { chi, df, p: 1 - S.chiCdf(chi, df), exp };
  };

  /* ---------- สถิติไม่อิงพารามิเตอร์ ---------- */

  // การทดสอบเครื่องหมาย
  S.signTest = function (plus, minus, tail) {
    const n = plus + minus;
    const k = Math.min(plus, minus);
    let p;
    if (tail === 'two') p = Math.min(1, 2 * S.binomCdf(k, n, 0.5));
    else if (tail === 'left') p = S.binomCdf(plus, n, 0.5);
    else p = 1 - S.binomCdf(plus - 1, n, 0.5);
    const z = n > 0 ? (plus - n / 2) / Math.sqrt(n / 4) : 0;
    return { n, plus, minus, k, p, z, zApproxP: S.pFromZ(z, tail || 'two') };
  };

  // Wilcoxon signed-rank (ข้อมูลคู่ / ไม่อิสระ)
  S.wilcoxonSigned = function (d) {
    const nz = d.filter(v => v !== 0);
    const n = nz.length;
    const abs = nz.map(Math.abs);
    const idx = abs.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const rank = new Array(n);
    let i = 0;
    while (i < idx.length) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) rank[idx[k][1]] = avg;
      i = j + 1;
    }
    let wp = 0, wm = 0;
    nz.forEach((v, k) => { if (v > 0) wp += rank[k]; else wm += rank[k]; });
    const W = Math.min(wp, wm);
    const mu = n * (n + 1) / 4;
    const sd = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24);
    const z = (W - mu) / sd;
    return { n, wPlus: wp, wMinus: wm, W, mu, sd, z, p: 2 * S.normCdf(-Math.abs(z)) };
  };

  // Mann–Whitney U (สองกลุ่มอิสระ)
  S.mannWhitney = function (a, b) {
    const all = a.map(v => [v, 0]).concat(b.map(v => [v, 1]));
    all.sort((x, y) => x[0] - y[0]);
    const rank = new Array(all.length);
    let i = 0;
    while (i < all.length) {
      let j = i;
      while (j + 1 < all.length && all[j + 1][0] === all[i][0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) rank[k] = avg;
      i = j + 1;
    }
    let r1 = 0;
    all.forEach((v, k) => { if (v[1] === 0) r1 += rank[k]; });
    const n1 = a.length, n2 = b.length;
    const u1 = r1 - n1 * (n1 + 1) / 2;
    const u2 = n1 * n2 - u1;
    const U = Math.min(u1, u2);
    const mu = n1 * n2 / 2;
    const sd = Math.sqrt(n1 * n2 * (n1 + n2 + 1) / 12);
    const z = (U - mu) / sd;
    return { n1, n2, r1, u1, u2, U, mu, sd, z, p: 2 * S.normCdf(-Math.abs(z)) };
  };

  // Kruskal–Wallis
  S.kruskal = function (groups) {
    const all = [];
    groups.forEach((g, gi) => g.forEach(v => all.push([v, gi])));
    all.sort((x, y) => x[0] - y[0]);
    const rank = new Array(all.length);
    let i = 0;
    while (i < all.length) {
      let j = i;
      while (j + 1 < all.length && all[j + 1][0] === all[i][0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) rank[k] = avg;
      i = j + 1;
    }
    const N = all.length;
    const rsum = groups.map(() => 0);
    all.forEach((v, k) => { rsum[v[1]] += rank[k]; });
    let H = 0;
    groups.forEach((g, gi) => { H += rsum[gi] * rsum[gi] / g.length; });
    H = 12 / (N * (N + 1)) * H - 3 * (N + 1);
    const df = groups.length - 1;
    return { H, df, N, rsum, p: 1 - S.chiCdf(H, df) };
  };

  // Runs test — ทดสอบความเป็นสุ่ม
  S.runsTest = function (seq) {   // seq = อาร์เรย์ของ 0/1
    const n1 = seq.filter(v => v === 1).length;
    const n2 = seq.length - n1;
    let runs = 1;
    for (let i = 1; i < seq.length; i++) if (seq[i] !== seq[i - 1]) runs++;
    const mu = 2 * n1 * n2 / (n1 + n2) + 1;
    const varr = 2 * n1 * n2 * (2 * n1 * n2 - n1 - n2) /
      ((n1 + n2) ** 2 * (n1 + n2 - 1));
    const z = (runs - mu) / Math.sqrt(varr);
    return { runs, n1, n2, mu, sd: Math.sqrt(varr), z, p: 2 * S.normCdf(-Math.abs(z)) };
  };

  /* ---------- การสุ่มตัวเลข ---------- */

  S.randNorm = function (mu, sd) {
    mu = mu || 0; sd = sd === undefined ? 1 : sd;
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  S.randExp = function (lam) { return -Math.log(1 - Math.random()) / lam; };
  S.randUnif = function (a, b) { return a + Math.random() * (b - a); };
  S.randPoisson = function (lam) {
    const L = Math.exp(-lam); let k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L);
    return k - 1;
  };
  S.randBinom = function (n, p) {
    let s = 0; for (let i = 0; i < n; i++) if (Math.random() < p) s++;
    return s;
  };

  /* ---------- ตัวช่วย ---------- */

  function bisect(f, lo, hi) {
    let flo = f(lo);
    for (let i = 0; i < 300; i++) {
      const mid = (lo + hi) / 2, fm = f(mid);
      if (fm === 0 || (hi - lo) / 2 < 1e-12) return mid;
      if ((fm < 0) === (flo < 0)) { lo = mid; flo = fm; } else hi = mid;
    }
    return (lo + hi) / 2;
  }
  S.bisect = bisect;

  S.fmt = function (x, d) {
    d = d === undefined ? 4 : d;
    if (x === undefined || x === null || isNaN(x)) return '—';
    if (!isFinite(x)) return x > 0 ? '∞' : '-∞';
    if (x !== 0 && Math.abs(x) < 0.0001) return x.toExponential(3);
    return Number(x).toFixed(d).replace(/\.?0+$/, m => m.includes('.') ? '' : m);
  };

  S.fmtP = function (p) {
    if (p < 0.0001) return '< 0.0001';
    return p.toFixed(4);
  };

  // แปลงข้อความเป็นอาร์เรย์ตัวเลข
  S.parse = function (text) {
    return String(text).split(/[\s,;\t\n]+/)
      .filter(s => s.length)
      .map(Number)
      .filter(v => !isNaN(v));
  };

  global.Stats = S;
})(window);
