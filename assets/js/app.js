/* ============================================================
   app.js — ตัวควบคุมหลักของแพลตฟอร์ม
   ============================================================ */
(function () {
'use strict';
const C = window.COURSE, CH = window.CHAPTERS, TOOLS = window.TOOLS, S = window.Stats;
const LABS = window.LABS || {};
const LAB_KEYS = Object.keys(LABS).sort((a, b) => LABS[a].no - LABS[b].no);
CH.sort((a, b) => a.no - b.no);

const main = document.getElementById('main');
const nav = document.getElementById('nav');
const KEY = 'statlab.v1';

/* ---------- สถานะการเรียน ---------- */
let ST = { read: {}, quiz: {}, lab: {}, prac: {}, theme: null, fs: 'm' };
try { ST = Object.assign(ST, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { }
ST.prac = ST.prac || {};
const EX = window.EXERCISES || [];
function save() { try { localStorage.setItem(KEY, JSON.stringify(ST)); } catch (e) { } }

/* ---------- ธีม ---------- */
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  ST.theme = t; save();
}
applyTheme(ST.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
document.getElementById('themeBtn').onclick = () =>
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');

/* ---------- ขนาดตัวอักษร ---------- */
const FS = ['s', 'm', 'l'], FS_NAME = { s: 'เล็ก', m: 'ปกติ', l: 'ใหญ่' };
function applyFs(v) {
  document.documentElement.setAttribute('data-fs', v);
  ST.fs = v; save();
  const b = document.getElementById('fsBtn');
  if (b) b.title = 'ขนาดตัวอักษร: ' + FS_NAME[v] + ' (กดเพื่อเปลี่ยน)';
}
applyFs(ST.fs || 'm');
document.getElementById('fsBtn').onclick = () =>
  applyFs(FS[(FS.indexOf(ST.fs) + 1) % FS.length]);

/* ---------- ตัวช่วย ---------- */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function katex(el) {
  if (!window.renderMathInElement) return;
  try {
    window.renderMathInElement(el, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false }
      ],
      ignoredTags: ['script', 'noscript', 'style', 'textarea', 'option'],
      throwOnError: false
    });
  } catch (e) { }
}

function progress() {
  const total = CH.length * 2;  // อ่าน + ทำแบบทดสอบ ต่อบท
  let done = 0;
  CH.forEach(c => {
    if (ST.read[c.id]) done++;
    if (ST.quiz[c.id] !== undefined) done++;
  });
  return { done, total, pct: Math.round(done / total * 100) };
}

function updateProgress() {
  const p = progress();
  document.getElementById('progPct').textContent = p.pct + '%';
  document.getElementById('progFill').style.width = p.pct + '%';
  const nq = Object.keys(ST.quiz).length;
  document.getElementById('progNote').textContent =
    p.pct === 0 ? 'ยังไม่เริ่มเรียน'
      : p.pct === 100 ? 'เรียนครบทุกบทแล้ว 🎉'
        : 'อ่านแล้ว ' + Object.keys(ST.read).length + '/' + CH.length + ' บท · ทำแบบทดสอบ ' + nq + '/' + CH.length + ' ชุด';
}

/* ---------- เมนูข้าง ---------- */
function buildNav() {
  let h = '<div class="nav-group"><div class="nav-label">ภาพรวม</div>' +
    item('#/', '🏠', 'หน้าแรก') +
    item('#/plan', '🗓', 'แผนการเรียนและคะแนน') +
    item('#/formulas', '∑', 'สรุปสูตรทั้งหมด') +
    '</div>';

  h += '<div class="nav-group"><div class="nav-label">บทเรียน</div>';
  CH.forEach(c => {
    const done = ST.read[c.id];
    h += '<a class="nav-item' + (done ? ' done' : '') + '" href="#/ch/' + c.no + '" data-r="#/ch/' + c.no + '">' +
      '<span class="nav-num">' + c.no + '</span><span class="nav-txt">' + esc(c.short) + '</span>' +
      '<span class="xtags">' + examTag(examOf(c), true) + '</span>' +
      (done ? '<svg class="nav-tick" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>' : '') + '</a>';
  });
  h += '</div>';

  h += '<div class="nav-group"><div class="nav-label">ฝึกฝน</div>' +
    item('#/practice/mid', '🧮', 'แบบฝึกหัด · กลางภาค') +
    item('#/practice/fin', '🧮', 'แบบฝึกหัด · ปลายภาค') +
    item('#/quizzes', '✏️', 'แบบทดสอบท้ายบท') +
    item('#/exam', '📝', 'ข้อสอบจำลอง') +
    '</div>';

  h += '<div class="nav-group"><div class="nav-label">ห้องปฏิบัติการ</div>' +
    item('#/lab', '🔬', 'แลบทั้งหมด');
  LAB_KEYS.forEach(k => {
    const L = LABS[k], done = ST.lab[k];
    h += '<a class="nav-item' + (done ? ' done' : '') + '" href="#/lab/' + k + '" data-r="#/lab/' + k +
      '" style="padding-left:16px">' +
      '<span style="width:20px;text-align:center;flex:none;font-size:14px">' + L.icon + '</span>' +
      '<span class="nav-txt" style="font-size:13.5px">' + esc(L.name) + '</span>' +
      (done ? '<svg class="nav-tick" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>' : '') + '</a>';
  });
  h += '</div>';

  const cats = {};
  Object.keys(TOOLS).forEach(k => {
    const t = TOOLS[k];
    (cats[t.cat] = cats[t.cat] || []).push([k, t]);
  });
  h += '<div class="nav-group"><div class="nav-label">เครื่องมือคำนวณ</div>' +
    item('#/tools', '🧰', 'เครื่องมือทั้งหมด');
  Object.keys(cats).forEach(cat => {
    cats[cat].forEach(([k, t]) => {
      h += '<a class="nav-item" href="#/tools/' + k + '" data-r="#/tools/' + k + '" style="padding-left:16px">' +
        '<span style="width:20px;text-align:center;flex:none;font-size:14px">' + t.icon + '</span>' +
        '<span class="nav-txt" style="font-size:13.5px">' + esc(t.name) + '</span></a>';
    });
  });
  h += '</div>';
  nav.innerHTML = h;
  markNav();
}
// ป้ายขอบเขตสอบ: mid = กลางภาค, fin = ปลายภาค, both = คร่อมทั้งสอง
function examTag(g, small) {
  if (!g) return '';
  const cls = small ? ' sm' : '';
  if (g === 'both') return '<span class="xtag mid' + cls + '">กลาง</span><span class="xtag fin' + cls + '">ปลาย</span>';
  return '<span class="xtag ' + g + cls + '">' + (g === 'mid' ? (small ? 'กลาง' : 'กลางภาค') : (small ? 'ปลาย' : 'ปลายภาค')) + '</span>';
}
function examOf(c) { return (C.examOf || {})[c.no]; }
function secExam(s) { return (C.secExam || {})[s.id]; }

function item(href, ic, txt) {
  return '<a class="nav-item" href="' + href + '" data-r="' + href + '">' +
    '<span style="width:23px;text-align:center;flex:none">' + ic + '</span>' +
    '<span class="nav-txt">' + txt + '</span></a>';
}
function markNav() {
  const r = location.hash || '#/';
  nav.querySelectorAll('.nav-item').forEach(a => a.classList.toggle('on', a.dataset.r === r));
}

/* ---------- หน้าแรก ---------- */
function pageHome() {
  const p = progress();
  let h = '<div class="page-head">' +
    '<div class="page-kicker">' + C.code + ' · ' + C.credit + '</div>' +
    '<h1>' + C.nameTh + '</h1>' +
    '<p>' + C.nameEn + ' — แพลตฟอร์มเรียนรู้ด้วยตนเอง ครอบคลุมเนื้อหาทั้ง 7 บทตามประมวลรายวิชา ' +
    'พร้อมเครื่องมือคำนวณเชิงโต้ตอบและแบบทดสอบท้ายบท</p></div>';

  h += '<div class="grid g4" style="margin-bottom:22px">' +
    '<div class="tile acc"><div class="k">ความคืบหน้า</div><div class="v">' + p.pct + '%</div><div class="s">' + p.done + ' จาก ' + p.total + ' รายการ</div></div>' +
    '<div class="tile"><div class="k">จำนวนบท</div><div class="v">' + CH.length + '</div><div class="s">' + CH.reduce((s, c) => s + c.hours, 0) + ' ชั่วโมง</div></div>' +
    '<div class="tile"><div class="k">เครื่องมือคำนวณ</div><div class="v">' + Object.keys(TOOLS).length + '</div><div class="s">ใช้ได้ทันที</div></div>' +
    '<div class="tile"><div class="k">แลบจำลอง</div><div class="v">' + LAB_KEYS.length + '</div><div class="s">ทดลองเองในเบราว์เซอร์</div></div>' +
    '<div class="tile"><div class="k">ข้อสอบฝึก</div><div class="v">' + CH.reduce((s, c) => s + c.quiz.length, 0) + '</div><div class="s">พร้อมเฉลยอธิบาย</div></div>' +
    '</div>';

  // บทถัดไปที่ควรเรียน
  const next = CH.find(c => !ST.read[c.id]);
  if (next) {
    h += '<div class="card" style="border-color:var(--accent);background:linear-gradient(135deg,var(--accent-soft),transparent)">' +
      '<div class="card-t">▶ เรียนต่อจากที่ค้างไว้</div>' +
      '<h3 style="font-size:17px;margin-bottom:6px">บทที่ ' + next.no + ' — ' + esc(next.title) + '</h3>' +
      '<p style="font-size:14px;color:var(--text-2);margin-bottom:13px">' + esc(next.intro) + '</p>' +
      '<a href="#/ch/' + next.no + '" class="btn">เริ่มเรียนบทนี้ →</a></div>';
  }

  h += '<h2 class="sec">บทเรียนทั้งหมด</h2>' +
    '<div class="xlegend">' + examTag('mid') + ' บทที่ 1–4 และ 5.1–5.3 &nbsp;·&nbsp; ' +
    examTag('fin') + ' 5.4–5.5 และบทที่ 6–7</div><div class="grid g2">';
  CH.forEach(c => {
    const done = ST.read[c.id], q = ST.quiz[c.id];
    h += '<a class="ch-card" href="#/ch/' + c.no + '">' +
      (done ? '<span class="ribbon">อ่านแล้ว</span>' : '') +
      '<span class="cn">บทที่ ' + c.no + ' ' + examTag(examOf(c)) + '</span>' +
      '<h3>' + esc(c.title) + '</h3><p>' + esc(c.intro) + '</p>' +
      '<div class="ch-meta">' +
      '<span>🕐 ' + c.hours + ' ชม.</span>' +
      '<span>📄 ' + c.sections.length + ' หัวข้อ</span>' +
      '<span>✏️ ' + c.quiz.length + ' ข้อ</span>' +
      (q !== undefined ? '<span style="color:var(--ok);margin-left:auto">คะแนน ' + q + '/' + c.quiz.length + '</span>' : '') +
      '</div></a>';
  });
  h += '</div>';

  h += '<h2 class="sec">คำอธิบายรายวิชา</h2><div class="card"><p style="margin:0">' + esc(C.desc) + '</p>' +
    '<div class="chips" style="margin-top:14px">' +
    '<span class="chip">หน่วยกิต ' + C.credit + '</span>' +
    '<span class="chip">เงื่อนไข: ' + C.prereq + '</span>' +
    '<span class="chip">' + C.faculty + '</span></div></div>';

  h += '<h2 class="sec">เริ่มต้นอย่างรวดเร็ว</h2><div class="grid g3">' +
    quick('#/tools/picker', '🧭', 'ไม่รู้ว่าใช้สถิติตัวไหน', 'ตอบคำถามไม่กี่ข้อ ระบบแนะนำให้') +
    quick('#/tools/table', '📋', 'ต้องการค่าวิกฤต', 'ตาราง Z, t, χ², F คำนวณสดทันที') +
    quick('#/formulas', '∑', 'ทบทวนสูตรก่อนสอบ', 'รวมสูตรทั้ง 7 บทไว้หน้าเดียว') +
    quick('#/practice/mid', '🧮', 'แบบฝึกหัดกลางภาค', EX.filter(e => e.exam === 'mid').length + ' ข้อ พร้อมคำใบ้และวิธีทำ') +
    quick('#/practice/fin', '🧮', 'แบบฝึกหัดปลายภาค', EX.filter(e => e.exam === 'fin').length + ' ข้อ พร้อมคำใบ้และวิธีทำ') +
    quick('#/exam', '📝', 'ลองทำข้อสอบจำลอง', 'สุ่มข้อสอบแยกชุดกลางภาค / ปลายภาค') +
    quick('#/lab/cicover', '🔬', 'พิสูจน์ "95%" ด้วยตาตัวเอง', 'สร้างช่วงความเชื่อมั่น 100 ช่วงแล้วนับที่พลาด') +
    quick('#/lab', '⚗️', 'เข้าห้องปฏิบัติการ', LAB_KEYS.length + ' แลบจำลองครบทุกบท') +
    quick('#/plan', '🗓', 'คำนวณเกรด', 'ใส่คะแนนที่ได้ ดูว่าจะได้เกรดอะไร') +
    '</div>';
  return h;
}
function quick(href, ic, t, d) {
  return '<a class="ch-card" href="' + href + '" style="padding:16px 18px">' +
    '<div style="font-size:22px;margin-bottom:8px">' + ic + '</div>' +
    '<h3 style="margin-bottom:5px">' + t + '</h3>' +
    '<p style="margin:0;-webkit-line-clamp:3">' + d + '</p></a>';
}

/* ---------- หน้าบทเรียน ---------- */
function pageChapter(no) {
  const c = CH.find(x => x.no === +no);
  if (!c) return '<div class="card">ไม่พบบทเรียนนี้</div>';
  const i = CH.indexOf(c);

  let toc = '<aside class="toc"><div class="tt">ในบทนี้</div>';
  c.sections.forEach(s => toc += '<a href="#sec-' + s.id + '" data-sec="sec-' + s.id + '">' + s.id + ' ' + esc(s.title) +
    (secExam(s) ? ' ' + examTag(secExam(s), true) : '') + '</a>');
  toc += '<a href="#sec-formulas" data-sec="sec-formulas">สรุปสูตร</a></aside>';

  let h = '<div class="doc"><article class="doc-body"><div class="page-head">' +
    '<div class="page-kicker">บทที่ ' + c.no + ' · ' + c.weeks + ' · ' + c.hours + ' ชั่วโมง</div>' +
    '<h1>' + esc(c.title) + '</h1><p>' + esc(c.intro) + '</p>' +
    '<div class="xhead">ออกสอบ: ' + examTag(examOf(c)) +
    (examOf(c) === 'both' ? ' <span>หัวข้อ 5.1–5.3 ออกกลางภาค · 5.4–5.5 ออกปลายภาค</span>' : '') + '</div>' +
    '<div class="chips">' + c.clos.map(x => '<span class="chip acc">' + x + '</span>').join('') + '</div></div>';

  c.sections.forEach(s => {
    h += '<h2 class="sec" id="sec-' + s.id + '">' + s.id + ' &nbsp;' + esc(s.title) +
      (secExam(s) ? ' ' + examTag(secExam(s)) : '') + '</h2>' +
      s.h.replace(/<div data-fig="([\w-]+)"><\/div>/g, (m, n) => window.FIGURES ? FIGURES.render(n) : '');
  });

  h += '<h2 class="sec" id="sec-formulas">สรุปสูตรประจำบท</h2><div class="tbl-wrap"><table>' +
    '<thead><tr><th style="width:38%">ชื่อสูตร</th><th>สูตร</th></tr></thead><tbody>' +
    c.formulas.map(f => '<tr><td>' + esc(f.n) + '</td><td>$' + f.f + '$</td></tr>').join('') +
    '</tbody></table></div>';

  const read = ST.read[c.id];
  h += '<div class="done-bar">' +
    '<span>' + (read ? '✓ คุณทำเครื่องหมายว่าอ่านบทนี้แล้ว' : 'อ่านจบแล้วใช่ไหม? ทำเครื่องหมายเพื่อบันทึกความคืบหน้า') + '</span>' +
    '<div style="display:flex;gap:9px;flex-wrap:wrap">' +
    '<button class="btn' + (read ? ' ghost' : '') + '" id="markRead">' + (read ? 'ยกเลิกเครื่องหมาย' : 'ทำเครื่องหมายว่าอ่านแล้ว') + '</button>' +
    '<a class="btn ghost" href="#/quiz/' + c.no + '">ทำแบบทดสอบ ' + c.quiz.length + ' ข้อ →</a>' +
    practiceLinks(c) + '</div></div>';

  const myLabs = LAB_KEYS.filter(k => LABS[k].ch === c.no);
  if (myLabs.length) {
    h += '<div class="note key"><b>🔬 ห้องปฏิบัติการของบทนี้</b>' +
      '<p>ลองจำลองสถานการณ์ด้วยตัวเองเพื่อเห็นว่าทฤษฎีในบทนี้ทำงานจริง</p>' +
      '<div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:4px">' +
      myLabs.map(k => '<a class="btn sm ghost" href="#/lab/' + k + '">' + LABS[k].icon + ' ' +
        esc(LABS[k].name) + ' →</a>').join('') + '</div></div>';
  }

  h += '<div class="pager">';
  if (i > 0) h += '<a href="#/ch/' + CH[i - 1].no + '"><small>← บทก่อนหน้า</small><strong>' + esc(CH[i - 1].short) + '</strong></a>';
  else h += '<a href="#/"><small>← กลับ</small><strong>หน้าแรก</strong></a>';
  if (i < CH.length - 1) h += '<a class="nx" href="#/ch/' + CH[i + 1].no + '"><small>บทถัดไป →</small><strong>' + esc(CH[i + 1].short) + '</strong></a>';
  else h += '<a class="nx" href="#/exam"><small>ขั้นต่อไป →</small><strong>ข้อสอบจำลอง</strong></a>';
  h += '</div></article>' + toc + '</div>';
  return h;
}

function afterChapter(no) {
  const c = CH.find(x => x.no === +no);
  const b = document.getElementById('markRead');
  if (b) b.onclick = () => {
    if (ST.read[c.id]) delete ST.read[c.id]; else ST.read[c.id] = Date.now();
    save(); buildNav(); updateProgress(); route();
  };
  // ไฮไลต์สารบัญตามการเลื่อนหน้า
  const links = Array.from(document.querySelectorAll('.toc a'));
  if (!links.length) return;
  const onScroll = () => {
    let cur = links[0];
    links.forEach(a => {
      const el = document.getElementById(a.dataset.sec);
      if (el && el.getBoundingClientRect().top <= 110) cur = a;
    });
    links.forEach(a => a.classList.toggle('on', a === cur));
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ---------- แบบทดสอบ ---------- */
function renderQuiz(items, opts) {
  opts = opts || {};
  const id = opts.id || 'q';
  let h = '<div id="qWrap">';
  items.forEach((q, i) => {
    h += '<div class="quiz-q" data-i="' + i + '">' +
      '<div class="quiz-n">ข้อ ' + (i + 1) + ' จาก ' + items.length + (q._ch ? ' · บทที่ ' + q._ch : '') + '</div>' +
      '<div class="quiz-txt">' + q.q + '</div>' +
      '<div class="opts">' +
      q.c.map((o, j) => '<div class="opt" data-q="' + i + '" data-o="' + j + '">' +
        '<span class="bul">' + 'กขคง'[j] + '</span><span>' + o + '</span></div>').join('') +
      '</div><div class="explain" style="display:none"><b>คำอธิบาย</b>' + q.e + '</div></div>';
  });
  h += '</div>' +
    '<div class="done-bar" id="qBar"><span id="qStat">เลือกคำตอบให้ครบทุกข้อ แล้วกดตรวจคำตอบ</span>' +
    '<div style="display:flex;gap:9px"><button class="btn" id="qSubmit" disabled>ตรวจคำตอบ</button>' +
    '<button class="btn ghost" id="qReset">เริ่มใหม่</button></div></div>' +
    '<div id="qResult"></div>';
  return h;
}

function wireQuiz(items, onDone) {
  const ans = {};
  let graded = false;
  const wrap = document.getElementById('qWrap');
  const stat = document.getElementById('qStat');
  const btn = document.getElementById('qSubmit');

  wrap.addEventListener('click', e => {
    const o = e.target.closest('.opt');
    if (!o || graded) return;
    const qi = +o.dataset.q, oi = +o.dataset.o;
    wrap.querySelectorAll('.opt[data-q="' + qi + '"]').forEach(x => x.classList.remove('sel'));
    o.classList.add('sel');
    ans[qi] = oi;
    const n = Object.keys(ans).length;
    stat.textContent = 'ตอบแล้ว ' + n + ' จาก ' + items.length + ' ข้อ';
    btn.disabled = n < items.length;
  });

  btn.onclick = () => {
    graded = true;
    let score = 0;
    items.forEach((q, i) => {
      const card = wrap.querySelector('.quiz-q[data-i="' + i + '"]');
      card.querySelectorAll('.opt').forEach(o => {
        const oi = +o.dataset.o;
        o.classList.remove('sel');
        o.classList.add('locked');
        if (oi === q.a) o.classList.add('right');
        else if (oi === ans[i]) o.classList.add('wrong');
      });
      card.querySelector('.explain').style.display = 'block';
      if (ans[i] === q.a) score++;
    });
    const pct = Math.round(score / items.length * 100);
    const grade = pct >= 80 ? ['ดีเยี่ยม', 'var(--ok)'] : pct >= 60 ? ['ผ่าน', 'var(--accent)'] :
      pct >= 40 ? ['ควรทบทวน', 'var(--warn)'] : ['ต้องอ่านใหม่', 'var(--danger)'];
    const circ = 2 * Math.PI * 56;
    document.getElementById('qResult').innerHTML =
      '<div class="card score-card"><div class="score-ring">' +
      '<svg viewBox="0 0 128 128"><circle class="bgc" cx="64" cy="64" r="56" fill="none"/>' +
      '<circle class="fgc" cx="64" cy="64" r="56" fill="none" stroke="' + grade[1] + '" ' +
      'stroke-dasharray="' + circ + '" stroke-dashoffset="' + (circ * (1 - pct / 100)) + '"/></svg>' +
      '<div class="lbl">' + pct + '%</div></div>' +
      '<h3 style="font-size:19px;margin-bottom:6px;color:' + grade[1] + '">' + grade[0] + '</h3>' +
      '<p style="color:var(--text-2);margin:0">ตอบถูก <b>' + score + '</b> จาก <b>' + items.length + '</b> ข้อ</p>' +
      '<p style="font-size:13.5px;color:var(--text-3);margin:11px 0 0">เลื่อนขึ้นไปอ่านคำอธิบายของแต่ละข้อได้</p></div>';
    btn.disabled = true;
    btn.textContent = 'ตรวจแล้ว';
    stat.textContent = 'ผลคะแนน ' + score + '/' + items.length;
    document.getElementById('qResult').scrollIntoView({ behavior: 'smooth', block: 'center' });
    katex(document.getElementById('qWrap'));
    if (onDone) onDone(score);
  };
  document.getElementById('qReset').onclick = () => route(true);
}

function pageQuiz(no) {
  const c = CH.find(x => x.no === +no);
  if (!c) return '<div class="card">ไม่พบแบบทดสอบ</div>';
  const prev = ST.quiz[c.id];
  return '<div class="page-head"><div class="page-kicker">แบบทดสอบ · บทที่ ' + c.no + '</div>' +
    '<h1>' + esc(c.short) + '</h1>' +
    '<p>' + c.quiz.length + ' ข้อ เลือกตอบข้อละ 1 คำตอบ เมื่อตรวจแล้วจะมีคำอธิบายทุกข้อ' +
    (prev !== undefined ? ' — <b>ครั้งก่อนคุณได้ ' + prev + '/' + c.quiz.length + '</b>' : '') + '</p></div>' +
    renderQuiz(c.quiz) +
    '<div class="pager"><a href="#/ch/' + c.no + '"><small>← กลับไป</small><strong>อ่านบทที่ ' + c.no + '</strong></a>' +
    (CH[CH.indexOf(c) + 1] ? '<a class="nx" href="#/quiz/' + CH[CH.indexOf(c) + 1].no + '"><small>แบบทดสอบถัดไป →</small><strong>' +
      esc(CH[CH.indexOf(c) + 1].short) + '</strong></a>' : '') + '</div>';
}

function pageQuizzes() {
  let h = '<div class="page-head"><div class="page-kicker">ฝึกฝน</div><h1>แบบทดสอบท้ายบท</h1>' +
    '<p>ทดสอบความเข้าใจทีละบท ทุกข้อมีคำอธิบายเฉลยละเอียด คะแนนจะถูกบันทึกไว้</p></div>';
  h += '<div class="grid g2">';
  CH.forEach(c => {
    const s = ST.quiz[c.id];
    const pct = s !== undefined ? Math.round(s / c.quiz.length * 100) : null;
    h += '<a class="ch-card" href="#/quiz/' + c.no + '">' +
      '<span class="cn">บทที่ ' + c.no + '</span>' +
      '<h3>' + esc(c.short) + '</h3>' +
      '<p>' + esc(c.intro) + '</p>' +
      '<div class="ch-meta"><span>✏️ ' + c.quiz.length + ' ข้อ</span>' +
      (pct !== null ? '<span style="margin-left:auto;color:' + (pct >= 80 ? 'var(--ok)' : pct >= 60 ? 'var(--accent)' : 'var(--warn)') +
        ';font-weight:600">' + s + '/' + c.quiz.length + ' (' + pct + '%)</span>' : '<span style="margin-left:auto">ยังไม่ได้ทำ</span>') +
      '</div></a>';
  });
  return h + '</div>';
}

/* ---------- แบบฝึกหัดเขียนตอบ ---------- */
function practiceLinks(c) {
  const g = examOf(c);
  return ['mid', 'fin'].filter(x => g === x || g === 'both').map(x => {
    const n = EX.filter(e => e.ch === c.no && e.exam === x).length;
    return n ? '<a class="btn ghost" href="#/practice/' + x + '/' + c.no + '">🧮 แบบฝึกหัด' +
      (g === 'both' ? (x === 'mid' ? 'กลางภาค' : 'ปลายภาค') : '') + ' ' + n + ' ข้อ →</a>' : '';
  }).join('');
}

function pagePractice(set, chNo) {
  set = set === 'fin' ? 'fin' : 'mid';
  const all = EX.filter(e => e.exam === set);
  const chs = [...new Set(all.map(e => e.ch))];
  const list = chNo ? all.filter(e => e.ch === +chNo) : all;
  const done = all.filter(e => ST.prac[e.id]).length;
  const name = set === 'mid' ? 'กลางภาค' : 'ปลายภาค';
  const exam = (C.exams || []).find(e => e.t === 'สอบ' + name);

  let h = '<div class="page-head"><div class="page-kicker">ฝึกฝน · แบบฝึกหัดเขียนตอบ</div>' +
    '<h1>แบบฝึกหัด' + name + ' ' + examTag(set) + '</h1>' +
    '<p>ลองทำในกระดาษก่อน ติดตรงไหนค่อยเปิดคำใบ้ แล้วจึงเปิดวิธีทำเพื่อตรวจคำตอบ' +
    (exam ? ' · สอบ' + name + ' ' + exam.when : '') + '</p>' +
    '<div class="seg">' +
    '<a href="#/practice/mid" class="' + (set === 'mid' ? 'on' : '') + '">กลางภาค</a>' +
    '<a href="#/practice/fin" class="' + (set === 'fin' ? 'on' : '') + '">ปลายภาค</a></div>' +
    '<div class="chips">' +
    '<a class="chip' + (!chNo ? ' acc' : '') + '" href="#/practice/' + set + '">ทุกบท (' + all.length + ')</a>' +
    chs.map(n => '<a class="chip' + (+chNo === n ? ' acc' : '') + '" href="#/practice/' + set + '/' + n + '">บทที่ ' + n +
      ' (' + all.filter(e => e.ch === n).length + ')</a>').join('') + '</div>' +
    '<div class="ex-prog"><div class="ex-bar"><i style="width:' + Math.round(done / all.length * 100) + '%"></i></div>' +
    '<span id="exDone">ทำได้แล้ว ' + done + ' / ' + all.length + ' ข้อ</span></div></div>';

  list.forEach(e => {
    const c = CH.find(x => x.no === e.ch);
    const ok = ST.prac[e.id];
    h += '<div class="ex-card' + (ok ? ' ok' : '') + '" data-id="' + e.id + '">' +
      '<div class="ex-head"><span class="ex-n">ข้อ ' + (all.indexOf(e) + 1) + '</span>' +
      '<a href="#/ch/' + e.ch + '">บทที่ ' + e.ch + (e.sec ? ' · หัวข้อ ' + e.sec : '') + '</a>' +
      '<span class="ex-lvl" title="ระดับความยาก">' + '★'.repeat(e.lvl) + '<s>' + '★'.repeat(3 - e.lvl) + '</s></span></div>' +
      '<div class="ex-q">' + e.q + '</div>' +
      '<div class="ex-btns">' +
      '<button class="btn sm ghost" data-act="hint">💡 คำใบ้</button>' +
      '<button class="btn sm ghost" data-act="sol">ดูวิธีทำ</button>' +
      '<button class="btn sm' + (ok ? '' : ' ghost') + '" data-act="ok">' + (ok ? '✓ ทำได้แล้ว' : 'ทำได้แล้ว') + '</button></div>' +
      '<div class="ex-hint" hidden><b>คำใบ้</b> ' + e.hint + '</div>' +
      '<div class="ex-sol" hidden><div class="ex-ans"><b>คำตอบ</b> ' + e.ans + '</div>' + e.sol + '</div></div>';
  });

  h += '<div class="pager"><a href="#/exam/' + set + '"><small>พร้อมแล้ว?</small><strong>ทำข้อสอบจำลอง' + name + ' →</strong></a>' +
    '<a class="nx" href="#/practice/' + (set === 'mid' ? 'fin' : 'mid') + '"><small>สลับชุด →</small><strong>แบบฝึกหัด' +
    (set === 'mid' ? 'ปลายภาค' : 'กลางภาค') + '</strong></a></div>';
  return h;
}

function afterPractice(set) {
  const all = EX.filter(e => e.exam === (set === 'fin' ? 'fin' : 'mid'));
  main.addEventListener('click', onPracClick);
  function onPracClick(ev) {
    const b = ev.target.closest('.ex-card button');
    if (!b) return;
    if (!document.body.contains(b)) return;
    const card = b.closest('.ex-card'), id = card.dataset.id, act = b.dataset.act;
    if (act === 'hint' || act === 'sol') {
      const box = card.querySelector(act === 'hint' ? '.ex-hint' : '.ex-sol');
      box.hidden = !box.hidden;
      b.classList.toggle('on', !box.hidden);
    } else if (act === 'ok') {
      if (ST.prac[id]) delete ST.prac[id]; else ST.prac[id] = 1;
      save();
      const ok = !!ST.prac[id];
      card.classList.toggle('ok', ok);
      b.classList.toggle('ghost', !ok);
      b.textContent = ok ? '✓ ทำได้แล้ว' : 'ทำได้แล้ว';
      const n = all.filter(e => ST.prac[e.id]).length;
      document.getElementById('exDone').textContent = 'ทำได้แล้ว ' + n + ' / ' + all.length + ' ข้อ';
      document.querySelector('.ex-bar i').style.width = Math.round(n / all.length * 100) + '%';
    }
  }
  // ถอดตัวฟังเมื่อเปลี่ยนหน้า เพื่อไม่ให้ซ้อนกัน
  window.addEventListener('hashchange', () => main.removeEventListener('click', onPracClick), { once: true });
}

/* ---------- ข้อสอบจำลอง ---------- */
let examItems = null, examMode = null;
const EXAM_PER = { all: 3, mid: 4, fin: 6 };  // จำนวนข้อต่อบท
function pageExam(regen, mode) {
  mode = mode === 'mid' || mode === 'fin' ? mode : 'all';
  if (!examItems || regen || examMode !== mode) {
    examMode = mode;
    const pool = [];
    CH.filter(c => mode === 'all' || examOf(c) === mode || examOf(c) === 'both')
      .forEach(c => c.quiz.forEach(q => pool.push(Object.assign({ _ch: c.no }, q))));
    // สุ่มโดยกระจายให้ครบทุกบท
    const byCh = {};
    pool.forEach(q => (byCh[q._ch] = byCh[q._ch] || []).push(q));
    const picked = [];
    Object.keys(byCh).forEach(k => {
      const arr = byCh[k].slice().sort(() => Math.random() - 0.5);
      picked.push.apply(picked, arr.slice(0, EXAM_PER[mode]));
    });
    examItems = picked.sort(() => Math.random() - 0.5);
  }
  const label = { all: 'ข้อสอบรวมทุกบท', mid: 'ข้อสอบจำลองกลางภาค', fin: 'ข้อสอบจำลองปลายภาค' }[mode];
  const scope = { all: 'ทุกบท', mid: 'บทที่ 1–5', fin: 'บทที่ 5–7' }[mode];
  return '<div class="page-head"><div class="page-kicker">ข้อสอบจำลอง</div>' +
    '<h1>' + label + ' ' + (mode === 'all' ? '' : examTag(mode)) + '</h1>' +
    '<p>' + examItems.length + ' ข้อ สุ่มจาก' + scope + ' สลับลำดับใหม่ทุกครั้ง' +
    ' (บทละ ' + EXAM_PER[mode] + ' ข้อ)' + '</p>' +
    '<div class="seg">' +
    '<a href="#/exam/mid" class="' + (mode === 'mid' ? 'on' : '') + '">กลางภาค</a>' +
    '<a href="#/exam/fin" class="' + (mode === 'fin' ? 'on' : '') + '">ปลายภาค</a>' +
    '<a href="#/exam" class="' + (mode === 'all' ? 'on' : '') + '">รวมทุกบท</a></div>' +
    '<button class="btn ghost" id="exNew">สุ่มชุดใหม่</button></div>' +
    renderQuiz(examItems);
}

/* ---------- สูตรทั้งหมด ---------- */
function pageFormulas() {
  let h = '<div class="page-head"><div class="page-kicker">อ้างอิง</div><h1>สรุปสูตรทั้งหมด</h1>' +
    '<p>รวมสูตรสำคัญจากทั้ง 7 บทไว้ในหน้าเดียว — กด Ctrl+P เพื่อพิมพ์เป็นชีตสรุปก่อนสอบได้</p></div>';
  CH.forEach(c => {
    h += '<h2 class="sec">บทที่ ' + c.no + ' &nbsp;' + esc(c.short) + '</h2>' +
      '<div class="tbl-wrap"><table><thead><tr><th style="width:36%">ชื่อสูตร</th><th>สูตร</th></tr></thead><tbody>' +
      c.formulas.map(f => '<tr><td>' + esc(f.n) + '</td><td>$' + f.f + '$</td></tr>').join('') +
      '</tbody></table></div>';
  });

  h += '<h2 class="sec">ค่าวิกฤตที่ใช้บ่อย</h2><div class="grid g2">' +
    '<div class="card"><div class="card-t">ค่า Z</div><div class="tbl-wrap"><table class="tbl-mini">' +
    '<thead><tr><th>ความเชื่อมั่น</th><th class="num">สองหาง</th><th class="num">หางเดียว</th></tr></thead><tbody>' +
    [[0.90, '90%'], [0.95, '95%'], [0.99, '99%']].map(x =>
      '<tr><td>' + x[1] + '</td><td class="num">' + S.normInv(1 - (1 - x[0]) / 2).toFixed(4) +
      '</td><td class="num">' + S.normInv(x[0]).toFixed(4) + '</td></tr>').join('') +
    '</tbody></table></div></div>' +
    '<div class="card"><div class="card-t">ค่า t ที่ α = 0.05</div><div class="tbl-wrap"><table class="tbl-mini">' +
    '<thead><tr><th>df</th><th class="num">สองหาง</th><th class="num">หางเดียว</th></tr></thead><tbody>' +
    [5, 10, 15, 20, 30, 60].map(d =>
      '<tr><td>' + d + '</td><td class="num">' + S.tInv(0.975, d).toFixed(4) +
      '</td><td class="num">' + S.tInv(0.95, d).toFixed(4) + '</td></tr>').join('') +
    '</tbody></table></div></div></div>' +
    '<p style="text-align:center;margin-top:16px"><a class="btn ghost" href="#/tools/table">เปิดตารางค่าวิกฤตแบบเต็ม (ทุก df) →</a></p>';
  return h;
}

/* ---------- แผนการเรียนและคะแนน ---------- */
function pagePlan() {
  let h = '<div class="page-head"><div class="page-kicker">ประมวลรายวิชา</div><h1>แผนการเรียนและการประเมินผล</h1>' +
    '<p>ข้อมูลจาก มคอ.3 ของรายวิชา ' + C.code + ' ปรับปรุงล่าสุด ' + C.updated + '</p></div>';

  h += '<h2 class="sec">คำนวณเกรดของคุณ</h2>' +
    '<div class="card"><p style="font-size:14px;color:var(--text-2)">ใส่คะแนนที่ได้ในแต่ละส่วน (เต็มตามสัดส่วนที่แสดง) ระบบจะรวมคะแนนและเทียบเกรดให้</p>' +
    '<div class="grid g3" id="gcIn">' +
    C.assessment.map((a, i) =>
      '<div class="field"><label>' + a.t + ' <span style="color:var(--text-3)">(เต็ม ' + a.w + ')</span></label>' +
      '<input type="number" id="gc' + i + '" min="0" max="' + a.w + '" step="0.1" placeholder="0 – ' + a.w + '"></div>').join('') +
    '</div><div id="gcOut"></div></div>';

  h += '<h2 class="sec">สัดส่วนคะแนน</h2><div class="grid g3">' +
    '<div class="tile acc"><div class="k">กลางภาค + สอบย่อย 1</div><div class="v">40%</div><div class="s">25% + 15%</div></div>' +
    '<div class="tile acc"><div class="k">ปลายภาค + สอบย่อย 2</div><div class="v">40%</div><div class="s">30% + 10%</div></div>' +
    '<div class="tile"><div class="k">คะแนนเก็บ</div><div class="v">20%</div><div class="s">เข้าเรียน 5 · Quiz 8 · แบบฝึกหัด 7</div></div>' +
    '</div>';

  h += '<h2 class="sec">เกณฑ์การประเมิน (อิงเกณฑ์)</h2><div class="tbl-wrap"><table class="tbl-stack cols2">' +
    '<thead><tr>' + C.grades.map(g => '<th class="num">' + g.g + '</th>').join('') + '</tr></thead>' +
    '<tbody><tr>' + C.grades.map(g => '<td class="num" data-label="' + g.g + '">' +
      (g.g === 'F' ? '< 30' : g.lo + '–' + g.hi) + '</td>').join('') + '</tr></tbody>' +
    '</table></div><p style="font-size:13.5px;color:var(--text-2)">ระดับ A ต้องมีคะแนนตั้งแต่ 80% ขึ้นไป และต้องได้คะแนน ≥ 30% จึงจะถือว่าผ่าน</p>';

  h += '<h2 class="sec">กำหนดการสอบ</h2><div class="tbl-wrap"><table>' +
    '<thead><tr><th>การสอบ</th><th>ช่วงเวลา</th><th>ขอบเขตเนื้อหา</th><th class="num">สัดส่วน</th></tr></thead><tbody>' +
    C.exams.map(e => '<tr><td><b>' + e.t + '</b></td><td>' + e.when + '</td><td>' + e.scope + '</td><td class="num">' + e.w + '%</td></tr>').join('') +
    '</tbody></table></div>';

  h += '<h2 class="sec">แผนการจัดการเรียนรู้</h2><div class="tbl-wrap"><table>' +
    '<thead><tr><th>คาบ</th><th class="num">ชม.</th><th>หัวข้อ</th><th></th></tr></thead><tbody>' +
    C.schedule.map(s => '<tr><td style="white-space:nowrap"><b>' + s.w + '</b></td><td class="num">' + s.h + '</td><td>' + esc(s.t) + '</td>' +
      '<td>' + (s.ch ? '<a href="#/ch/' + s.ch + '">เปิดบทเรียน →</a>' : '') + '</td></tr>').join('') +
    '</tbody></table></div>';

  h += '<h2 class="sec">ผลลัพธ์การเรียนรู้ (CLO)</h2><div class="tbl-wrap"><table>' +
    '<thead><tr><th style="width:70px">รหัส</th><th>รายละเอียด</th><th class="num">คะแนน</th></tr></thead><tbody>' +
    C.clos.map(c => '<tr><td><b>' + c.id + '</b></td><td>' + esc(c.t) + '</td><td class="num">' + c.score + '</td></tr>').join('') +
    '<tr style="background:var(--surface-2)"><td colspan="2"><b>รวม</b></td><td class="num"><b>100</b></td></tr>' +
    '</tbody></table></div>';

  h += '<h2 class="sec">ผู้สอน</h2><div class="card"><p style="margin:0">' +
    'รายชื่อและช่องทางติดต่ออาจารย์ผู้สอน ดูได้จากประมวลรายวิชาที่ได้รับในชั้นเรียน ' +
    'หรือระบบสารสนเทศของมหาวิทยาลัย — ไม่ได้เผยแพร่ไว้ในเว็บนี้เพื่อคุ้มครองข้อมูลส่วนบุคคล</p></div>';

  h += '<h2 class="sec">แหล่งข้อมูลสำหรับศึกษาด้วยตนเอง</h2><div class="card"><ul style="margin:0">' +
    C.refs.map(r => '<li style="font-size:14px">' + esc(r) + '</li>').join('') + '</ul></div>';

  return h;
}

function afterPlan() {
  function calc() {
    let total = 0, filled = 0;
    const parts = C.assessment.map((a, i) => {
      const el = document.getElementById('gc' + i);
      let v = parseFloat(el.value);
      if (isNaN(v)) return { a, v: null };
      v = Math.max(0, Math.min(a.w, v));
      total += v; filled += a.w;
      return { a, v };
    });
    const o = document.getElementById('gcOut');
    if (filled === 0) { o.innerHTML = '<div class="result empty">ใส่คะแนนอย่างน้อยหนึ่งช่องเพื่อคำนวณ</div>'; return; }
    const g = C.grades.find(x => total >= x.lo) || C.grades[C.grades.length - 1];
    const proj = total / filled * 100;
    const projG = C.grades.find(x => proj >= x.lo) || C.grades[C.grades.length - 1];
    // คะแนนที่ต้องได้เพิ่มเพื่อแต่ละเกรด
    const left = 100 - filled;
    let need = '';
    if (left > 0) {
      need = '<div class="tbl-wrap" style="margin-top:13px"><table class="tbl-mini">' +
        '<thead><tr><th>อยากได้เกรด</th><th class="num">ต้องได้อีกอย่างน้อย</th><th>เป็นไปได้หรือไม่</th></tr></thead><tbody>' +
        C.grades.slice(0, 5).map(gr => {
          const n = gr.lo - total;
          const ok = n <= left;
          return '<tr><td><b>' + gr.g + '</b></td><td class="num">' + (n <= 0 ? 'ได้แล้ว' : S.fmt(n, 1) + ' จาก ' + S.fmt(left, 1)) +
            '</td><td>' + (n <= 0 ? '<span style="color:var(--ok)">✓ ถึงแล้ว</span>' :
              ok ? '<span style="color:var(--accent)">ยังเป็นไปได้</span>' : '<span style="color:var(--danger)">เกินคะแนนที่เหลือ</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    o.innerHTML = '<div class="result">' +
      '<div class="grid g3" style="margin-bottom:13px">' +
      '<div class="tile acc"><div class="k">คะแนนรวมที่ได้</div><div class="v">' + S.fmt(total, 2) + '</div><div class="s">จาก 100</div></div>' +
      '<div class="tile"><div class="k">กรอกไปแล้ว</div><div class="v">' + S.fmt(filled, 0) + '</div><div class="s">เหลืออีก ' + S.fmt(left, 0) + ' คะแนน</div></div>' +
      '<div class="tile ' + (g.g === 'F' ? 'danger' : g.g === 'A' ? 'ok' : 'acc') + '"><div class="k">เกรดจากคะแนนปัจจุบัน</div><div class="v">' + g.g + '</div>' +
      '<div class="s">ถ้ารักษาระดับนี้ได้: ' + projG.g + '</div></div></div>' +
      (left > 0 ? '<p style="font-size:13.5px;color:var(--text-2);margin:0">หากทำคะแนนส่วนที่เหลือได้ในอัตราเดิม (' +
        S.fmt(proj, 1) + '%) จะได้เกรด <b>' + projG.g + '</b></p>' : '') +
      need + '</div>';
  }
  C.assessment.forEach((a, i) => {
    const el = document.getElementById('gc' + i);
    if (el) el.addEventListener('input', calc);
  });
  calc();
}

/* ---------- เครื่องมือ ---------- */
function pageTools() {
  const cats = {};
  Object.keys(TOOLS).forEach(k => (cats[TOOLS[k].cat] = cats[TOOLS[k].cat] || []).push(k));
  let h = '<div class="page-head"><div class="page-kicker">เครื่องมือ</div><h1>เครื่องมือคำนวณทางสถิติ</h1>' +
    '<p>คำนวณสดทุกค่าในเบราว์เซอร์ ไม่ต้องเปิดตาราง ไม่ต้องติดตั้งโปรแกรม ปรับค่าแล้วเห็นผลและกราฟทันที</p></div>';
  Object.keys(cats).forEach(cat => {
    h += '<h2 class="sec">' + cat + '</h2><div class="grid g3">';
    cats[cat].forEach(k => {
      const t = TOOLS[k];
      h += '<a class="ch-card" href="#/tools/' + k + '">' +
        '<div style="font-size:23px;margin-bottom:9px">' + t.icon + '</div>' +
        '<h3>' + esc(t.name) + '</h3><p style="-webkit-line-clamp:3">' + esc(t.desc) + '</p></a>';
    });
    h += '</div>';
  });
  return h;
}

function pageTool(id) {
  const t = TOOLS[id];
  if (!t) return '<div class="card">ไม่พบเครื่องมือนี้</div>';
  return '<div class="page-head"><div class="page-kicker">' + t.icon + ' ' + t.cat + '</div>' +
    '<h1>' + esc(t.name) + '</h1><p>' + esc(t.desc) + '</p></div>' +
    '<div id="toolHost"></div>' +
    '<div class="pager"><a href="#/tools"><small>← กลับ</small><strong>เครื่องมือทั้งหมด</strong></a></div>';
}

/* ---------- ห้องปฏิบัติการ ---------- */
function pageLabs() {
  let h = '<div class="page-head"><div class="page-kicker">ห้องปฏิบัติการ</div>' +
    '<h1>แลบจำลองสถานการณ์</h1>' +
    '<p>เครื่องมือในหมวดก่อนหน้าใช้ “คำนวณ” จากตัวเลขที่กรอก แต่แลบในหมวดนี้ใช้ “ทดลอง” — ' +
    'สุ่มข้อมูลขึ้นมาใหม่หลายพันชุดจากประชากรที่เรารู้ความจริงทุกอย่าง แล้วนับผลที่เกิดขึ้นจริง ' +
    'เพื่อตรวจว่าสูตรและทฤษฎีในแต่ละบทใช้ได้จริงหรือไม่ และพังเมื่อใด</p></div>';

  const nDone = LAB_KEYS.filter(k => ST.lab[k]).length;
  h += '<div class="grid g4" style="margin-bottom:22px">' +
    '<div class="tile acc"><div class="k">จำนวนแลบ</div><div class="v">' + LAB_KEYS.length +
    '</div><div class="s">ครอบคลุมทั้ง 7 บท</div></div>' +
    '<div class="tile"><div class="k">ทำแล้ว</div><div class="v">' + nDone +
    '</div><div class="s">จาก ' + LAB_KEYS.length + ' แลบ</div></div>' +
    '<div class="tile"><div class="k">คำถามท้ายแลบ</div><div class="v">' +
    LAB_KEYS.reduce((a, k) => a + LABS[k].questions.length, 0) + '</div><div class="s">พร้อมแนวคำตอบ</div></div>' +
    '<div class="tile"><div class="k">ต้องติดตั้งอะไร</div><div class="v">ไม่ต้อง</div>' +
    '<div class="s">คำนวณในเบราว์เซอร์</div></div></div>';

  h += '<div class="note key"><b>แลบนี้ต่างจากเครื่องมือคำนวณอย่างไร</b>' +
    '<p>ในชีวิตจริงเราไม่เคยรู้ค่า $\\mu$, $\\sigma$ หรือ $\\beta_1$ ของประชากร จึงไม่มีทางรู้ว่าวิธีที่ใช้ตัดสินถูกหรือผิด ' +
    'แต่ในการจำลอง <b>เราเป็นคนกำหนดความจริงเอง</b> แล้วปล่อยให้วิธีทางสถิติทำงาน จึงตรวจสอบได้ว่า ' +
    'มันถูกบ่อยแค่ไหน พลาดบ่อยแค่ไหน และพลาดในสถานการณ์ใด</p></div>';

  const byCh = {};
  LAB_KEYS.forEach(k => (byCh[LABS[k].cat] = byCh[LABS[k].cat] || []).push(k));
  Object.keys(byCh).forEach(cat => {
    h += '<h2 class="sec">' + cat + '</h2><div class="grid g2">';
    byCh[cat].forEach(k => {
      const L = LABS[k];
      h += '<a class="ch-card" href="#/lab/' + k + '">' +
        (ST.lab[k] ? '<span class="ribbon">ทำแล้ว</span>' : '') +
        '<span class="cn">' + L.icon + ' แลบที่ ' + L.no + '</span>' +
        '<h3>' + esc(L.name) + '</h3><p>' + esc(L.desc) + '</p>' +
        '<div class="ch-meta"><span>🧭 ' + L.steps.length + ' ขั้นตอน</span>' +
        '<span>❓ ' + L.questions.length + ' คำถาม</span>' +
        '<span>📘 บทที่ ' + L.ch + '</span></div></a>';
    });
    h += '</div>';
  });
  return h;
}

function pageLab(id) {
  const L = LABS[id];
  if (!L) return '<div class="card"><h2>ไม่พบแลบนี้</h2><p><a href="#/lab">กลับไปหน้าห้องปฏิบัติการ</a></p></div>';
  const i = LAB_KEYS.indexOf(id);

  let h = '<div class="page-head"><div class="page-kicker">' + L.icon + ' แลบที่ ' + L.no + ' · ' + L.cat + '</div>' +
    '<h1>' + esc(L.name) + '</h1><p>' + esc(L.desc) + '</p></div>';

  h += '<div class="note ex"><b>จุดประสงค์ของแลบ</b><p>' + L.goal + '</p></div>';

  h += '<h2 class="sec">แนวคิดที่จะนำไปทดสอบ</h2><div class="card lab-theory">' + L.theory + '</div>';

  h += '<h2 class="sec">วิธีทำการทดลอง</h2><ol class="steps">' +
    L.steps.map(x => '<li>' + x + '</li>').join('') + '</ol>';

  h += '<h2 class="sec">เครื่องจำลอง</h2><div id="labHost"></div>';

  h += '<h2 class="sec">คำถามท้ายแลบ</h2><div id="labQ">' +
    L.questions.map((q, n) =>
      '<div class="lab-q"><div class="lab-q-h"><span class="lab-q-n">' + (n + 1) + '</span>' +
      '<div class="lab-q-t">' + q.q + '</div></div>' +
      '<button class="btn sm ghost lab-q-b" data-n="' + n + '">แสดงแนวคำตอบ</button>' +
      '<div class="lab-q-a" id="labA' + n + '" hidden>' + q.a + '</div></div>').join('') +
    '</div>';

  const done = ST.lab[id];
  h += '<div class="done-bar">' +
    '<span>' + (done ? '✓ ทำแลบนี้แล้ว' : 'ทำการทดลองและตอบคำถามครบแล้วใช่ไหม?') + '</span>' +
    '<button class="btn' + (done ? ' ghost' : '') + '" id="markLab">' +
    (done ? 'ยกเลิกเครื่องหมาย' : 'ทำเครื่องหมายว่าทำแลบนี้แล้ว') + '</button></div>';

  h += '<div class="pager">';
  if (i > 0) h += '<a href="#/lab/' + LAB_KEYS[i - 1] + '"><small>← แลบก่อนหน้า</small><strong>' +
    esc(LABS[LAB_KEYS[i - 1]].name) + '</strong></a>';
  else h += '<a href="#/lab"><small>← กลับ</small><strong>แลบทั้งหมด</strong></a>';
  if (i < LAB_KEYS.length - 1) h += '<a class="nx" href="#/lab/' + LAB_KEYS[i + 1] + '"><small>แลบถัดไป →</small><strong>' +
    esc(LABS[LAB_KEYS[i + 1]].name) + '</strong></a>';
  else h += '<a class="nx" href="#/ch/' + L.ch + '"><small>ทบทวนทฤษฎี →</small><strong>บทที่ ' + L.ch + '</strong></a>';
  h += '</div>';
  return h;
}

function afterLab(id) {
  const L = LABS[id];
  if (!L) return;
  const host = document.getElementById('labHost');
  if (host) {
    try { L.render(host); } catch (e) {
      host.innerHTML = '<div class="result empty">เกิดข้อผิดพลาดในการจำลอง: ' + esc(e.message) + '</div>';
    }
    katex(host);
  }
  const qw = document.getElementById('labQ');
  if (qw) {
    katex(qw);
    qw.addEventListener('click', e => {
      const b = e.target.closest('.lab-q-b');
      if (!b) return;
      const a = document.getElementById('labA' + b.dataset.n);
      a.hidden = !a.hidden;
      b.textContent = a.hidden ? 'แสดงแนวคำตอบ' : 'ซ่อนแนวคำตอบ';
    });
  }
  const mb = document.getElementById('markLab');
  if (mb) mb.onclick = () => {
    if (ST.lab[id]) delete ST.lab[id]; else ST.lab[id] = Date.now();
    save(); buildNav(); route(true);
  };
}

/* ---------- บอกสถานะการเลื่อนของตารางและสูตรที่กว้างเกินจอ ---------- */
function markScrollables(root) {
  root.querySelectorAll('.tbl-wrap, .fml, .katex-display').forEach(el => {
    const withHint = el.classList.contains('tbl-wrap');
    const upd = () => {
      const more = el.scrollWidth - el.clientWidth;
      const on = more > 10;        // ล้นแค่ไม่กี่พิกเซลไม่ต้องเตือน จะกลายเป็นสิ่งรบกวน
      el.classList.toggle('scroll-x', on);
      el.classList.toggle('at-start', !on || el.scrollLeft <= 1);
      el.classList.toggle('at-end', !on || el.scrollLeft >= more - 1);
      const sib = el.nextElementSibling;
      const hasHint = !!sib && sib.classList.contains('scroll-x-hint');
      if (on && withHint && !hasHint) {
        const h = document.createElement('small');
        h.className = 'scroll-x-hint';
        h.textContent = '↔ เลื่อนในแนวนอนเพื่อดูส่วนที่เหลือ';
        el.parentNode.insertBefore(h, el.nextSibling);
      } else if (!on && hasHint) {
        sib.parentNode.removeChild(sib);
      }
    };
    upd();
    if (!el._sx) { el._sx = 1; el.addEventListener('scroll', upd, { passive: true }); }
    el._upd = upd;
  });
}
let rsTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(rsTimer);
  rsTimer = setTimeout(() => markScrollables(main), 150);
});

/* ---------- ตัวจัดเส้นทาง ---------- */
function route(keepScroll) {
  const hash = location.hash || '#/';
  const p = hash.replace(/^#\//, '').split('/');
  let html, after = null;
  // บทเรียนจัดเลย์เอาต์เอง · แบบทดสอบใช้คอลัมน์อ่าน · หน้าที่เหลือใช้ความกว้างเต็ม
  const narrow = p[0] === 'quiz' || p[0] === 'exam' || p[0] === 'practice';
  const wrap = p[0] === 'ch' ? null : (narrow ? 'doc-body reading' : 'wide');

  if (!p[0]) html = pageHome();
  else if (p[0] === 'ch') { html = pageChapter(p[1]); after = () => afterChapter(p[1]); }
  else if (p[0] === 'quiz') {
    const c = CH.find(x => x.no === +p[1]);
    html = pageQuiz(p[1]);
    after = () => { if (c) wireQuiz(c.quiz, s => { ST.quiz[c.id] = s; save(); buildNav(); updateProgress(); }); };
  }
  else if (p[0] === 'quizzes') html = pageQuizzes();
  else if (p[0] === 'practice') { html = pagePractice(p[1], p[2]); after = () => afterPractice(p[1]); }
  else if (p[0] === 'exam') {
    html = pageExam(false, p[1]);
    after = () => {
      wireQuiz(examItems);
      const b = document.getElementById('exNew');
      if (b) b.onclick = () => { examItems = null; route(); };
    };
  }
  else if (p[0] === 'lab') {
    if (p[1]) { html = pageLab(p[1]); after = () => afterLab(p[1]); }
    else html = pageLabs();
  }
  else if (p[0] === 'formulas') html = pageFormulas();
  else if (p[0] === 'plan') { html = pagePlan(); after = afterPlan; }
  else if (p[0] === 'tools') {
    if (p[1]) { html = pageTool(p[1]); after = () => { const host = document.getElementById('toolHost'); if (host && TOOLS[p[1]]) { TOOLS[p[1]].render(host); katex(host); } }; }
    else html = pageTools();
  }
  else html = '<div class="card"><h2>ไม่พบหน้านี้</h2><p><a href="#/">กลับหน้าแรก</a></p></div>';

  main.innerHTML = wrap ? '<div class="' + wrap + '">' + html + '</div>' : html;
  katex(main);
  if (after) after();
  markScrollables(main);
  markNav();
  closeSide();
  if (!keepScroll && !location.hash.includes('#sec-')) window.scrollTo(0, 0);
}

window.addEventListener('hashchange', () => {
  if (location.hash.startsWith('#sec-')) {
    const el = document.getElementById(location.hash.slice(1));
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    return;
  }
  route();
});

/* ---------- เมนูบนมือถือ ---------- */
const sb = document.getElementById('sidebar'), scrim = document.getElementById('scrim');
function closeSide() { sb.classList.remove('open'); scrim.classList.remove('on'); }
document.getElementById('burger').onclick = () => {
  sb.classList.toggle('open'); scrim.classList.toggle('on');
};
scrim.onclick = closeSide;

/* ---------- ล้างความคืบหน้า ---------- */
document.getElementById('resetBtn').onclick = () => {
  if (!confirm('ล้างความคืบหน้าทั้งหมด (บทที่อ่านแล้วและคะแนนแบบทดสอบ) ใช่หรือไม่?')) return;
  ST.read = {}; ST.quiz = {}; ST.lab = {}; save(); buildNav(); updateProgress(); route();
};

/* ---------- ค้นหา ---------- */
const INDEX = [];
CH.forEach(c => {
  INDEX.push({ t: 'บทที่ ' + c.no + ' — ' + c.title, c: 'บทเรียน', h: '#/ch/' + c.no, k: c.title + ' ' + c.short + ' ' + c.intro });
  c.sections.forEach(s => INDEX.push({
    t: s.id + ' ' + s.title, c: 'บทที่ ' + c.no, h: '#/ch/' + c.no,
    k: s.title + ' ' + s.h.replace(/<[^>]+>/g, ' ').slice(0, 1400)
  }));
  c.formulas.forEach(f => INDEX.push({ t: f.n, c: 'สูตร · บทที่ ' + c.no, h: '#/formulas', k: f.n + ' ' + f.f }));
  INDEX.push({ t: 'แบบทดสอบบทที่ ' + c.no, c: 'ฝึกฝน', h: '#/quiz/' + c.no, k: c.short + ' แบบทดสอบ quiz ข้อสอบ' });
});
Object.keys(TOOLS).forEach(k => INDEX.push({
  t: TOOLS[k].name, c: 'เครื่องมือ', h: '#/tools/' + k, k: TOOLS[k].name + ' ' + TOOLS[k].desc
}));
LAB_KEYS.forEach(k => INDEX.push({
  t: 'แลบ ' + LABS[k].no + ' — ' + LABS[k].name, c: 'ห้องปฏิบัติการ · ' + LABS[k].cat, h: '#/lab/' + k,
  k: LABS[k].name + ' ' + LABS[k].desc + ' ' + LABS[k].goal + ' จำลอง simulation แลบ ทดลอง'
}));
INDEX.push({ t: 'ห้องปฏิบัติการทั้งหมด', c: 'ห้องปฏิบัติการ', h: '#/lab',
  k: 'แลบ lab จำลอง simulation ทดลอง มอนติคาร์โล monte carlo' });
INDEX.push({ t: 'แผนการเรียนและคำนวณเกรด', c: 'ภาพรวม', h: '#/plan', k: 'เกรด คะแนน ประเมิน สอบ กลางภาค ปลายภาค CLO ตาราง แผน' });
INDEX.push({ t: 'สรุปสูตรทั้งหมด', c: 'อ้างอิง', h: '#/formulas', k: 'สูตร formula สรุป ชีต' });
INDEX.push({ t: 'ข้อสอบจำลอง', c: 'ฝึกฝน', h: '#/exam', k: 'ข้อสอบ จำลอง mock exam ทบทวน' });

const sm = document.getElementById('searchModal'), si = document.getElementById('searchInput'),
  sr = document.getElementById('searchRes');
let hi = 0;

function openSearch() {
  sm.classList.add('on'); si.value = ''; si.focus(); doSearch();
}
function closeSearch() { sm.classList.remove('on'); }
document.getElementById('searchBtn').onclick = openSearch;
sm.onclick = e => { if (e.target === sm) closeSearch(); };

function doSearch() {
  const q = si.value.trim().toLowerCase();
  let res;
  if (!q) res = INDEX.filter(x => x.c === 'บทเรียน' || x.c === 'เครื่องมือ').slice(0, 10);
  else {
    res = INDEX.map(x => {
      const t = x.t.toLowerCase(), k = x.k.toLowerCase();
      let sc = 0;
      if (t.includes(q)) sc += 10;
      if (t.startsWith(q)) sc += 5;
      if (k.includes(q)) sc += 2;
      return { x, sc };
    }).filter(r => r.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 14).map(r => r.x);
  }
  hi = 0;
  sr.innerHTML = res.length
    ? res.map((x, i) => '<a class="sr' + (i === 0 ? ' hi' : '') + '" href="' + x.h + '" data-h="' + x.h + '">' +
      '<div class="t">' + esc(x.t) + '</div><div class="c">' + esc(x.c) + '</div></a>').join('')
    : '<div class="sr-empty">ไม่พบผลลัพธ์สำหรับ “' + esc(si.value) + '”</div>';
  sr.querySelectorAll('.sr').forEach(a => a.onclick = () => closeSearch());
}
si.addEventListener('input', doSearch);
si.addEventListener('keydown', e => {
  const items = sr.querySelectorAll('.sr');
  if (e.key === 'Escape') { closeSearch(); return; }
  if (!items.length) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(hi + 1, items.length - 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); hi = Math.max(hi - 1, 0); }
  else if (e.key === 'Enter') { e.preventDefault(); location.hash = items[hi].dataset.h; closeSearch(); return; }
  else return;
  items.forEach((a, i) => a.classList.toggle('hi', i === hi));
  items[hi].scrollIntoView({ block: 'nearest' });
});

document.addEventListener('keydown', e => {
  if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) {
    e.preventDefault(); openSearch();
  }
  if (e.key === 'Escape') closeSearch();
});

/* ---------- เริ่มทำงาน ---------- */
function boot() {
  buildNav();
  updateProgress();
  route();
  const l = document.getElementById('loader');
  l.classList.add('gone');
  setTimeout(() => l.remove(), 350);
}
if (window.renderMathInElement) boot();
else {
  let tries = 0;
  const t = setInterval(() => {
    if (window.renderMathInElement || ++tries > 40) { clearInterval(t); boot(); }
  }, 60);
}
})();
