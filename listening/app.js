// 精听训练首页（训练统一走 practice.html → drill_sessions，本页只读不写；旧站内训练流程已删除）
const LS_KEY = 'ailearn_listening_progress_v1';
const SUPABASE_URL = "https://qydtzdewqkzonzwmxapa.supabase.co";
const SUPABASE_KEY = "sb_publishable_979g0z6Xf84og_vjDliW-Q_Jyia_y4N";
const SBH = { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY };
let drills = [];

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
  catch { return {}; }
}

// 云端 drill_sessions：每个 drill_date 取 finished_at 最新的已完成行
async function fetchCloudSessions() {
  const map = {};
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/drill_sessions?select=drill_date,finished_at,total_seconds,modules&order=drill_date.desc&limit=100`,
      { headers: SBH }
    );
    if (!r.ok) return map;
    const rows = await r.json();
    for (const row of rows) {
      if (row.finished_at && !map[row.drill_date]) map[row.drill_date] = row;
    }
  } catch (e) { /* 云端不可用时静默降级，只显示本地 */ }
  return map;
}

// 阅读：今日文章 + 当天 session（latest）
async function fetchReadingStatus() {
  const d = new Date(), p2 = n => String(n).padStart(2,"0");
  const today = `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
  const out = { article: null, session: null };
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/reading_articles?read_date=eq.${today}&order=created_at.desc&limit=1`,
      { headers: SBH }
    );
    if (r.ok) { const rows = await r.json(); if (rows.length) out.article = rows[0]; }
  } catch (e) { /* 阅读表可能还没建 */ }
  if (!out.article) return out;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/reading_sessions?read_date=eq.${today}&order=created_at.desc&limit=10`,
      { headers: SBH }
    );
    if (r.ok) {
      const rows = await r.json();
      const passed = rows.find(s => s.passed);
      out.session = passed || rows[0] || null;
    }
  } catch (e) { /* 静默 */ }
  return out;
}

function fmtMin(sec) {
  if (sec == null) return "未知";
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return s ? `${m} 分钟 ${s} 秒` : `${m} 分钟`;
}

// 合并两处数据源：云端 drill_sessions（优先）+ 旧本地 localStorage（迁移显示）
function statusFor(date, prog, cloud) {
  const c = cloud[date];
  if (c) {
    const m = c.modules || {};
    const ds = (m.dictation && m.dictation.score != null) ? ` · 听写 ${m.dictation.score} 分` : "";
    return { done: true, label: `✅ 已完成${ds} · 用时 ${fmtMin(c.total_seconds)}` };
  }
  const p = prog[date];
  if (p && p.finished) {
    const sc = p.score != null ? ` · 听写得分 ${p.score}%` : "";
    return { done: true, label: `✅ 已完成${sc}（旧版记录）` };
  }
  return { done: false, label: "未做" };
}

// 某天的听写得分（云端优先，旧本地兜底），无成绩返回 null
function scoreFor(date, prog, cloud) {
  const c = cloud[date];
  if (c && c.modules && c.modules.dictation && c.modules.dictation.score != null)
    return c.modules.dictation.score;
  const p = prog[date];
  if (p && p.score != null) return p.score;
  return null;
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

async function init() {
  try {
    const res = await fetch('data/index.json');
    const idx = await res.json();
    drills = idx.drills.slice().sort((a, b) => b.date.localeCompare(a.date)); // 最新在前
  } catch (e) {
    document.getElementById('today-card').innerHTML = '<div class="meta">加载失败，请刷新重试</div>';
    return;
  }
  const prog = loadProgress();
  const cloud = await fetchCloudSessions();
  renderToday(prog, cloud);
  renderReadingCard(await fetchReadingStatus());
  renderRecommend(prog, cloud);
  renderHistory(prog, cloud);
}

// 今日大卡片：唯一的训练入口（→ practice.html）
function renderToday(prog, cloud) {
  const today = drills[0];
  const st = statusFor(today.date, prog, cloud);
  document.getElementById('today-card').innerHTML = `
    <div class="date">${today.date} · Level ${today.level} · 约15分钟</div>
    <div class="topic">${esc(today.topic_cn)}</div>
    <div class="meta">${esc(today.topic)} · ${st.label}</div>
    <button class="btn-primary" onclick="location.href='practice.html?date=${today.date}'">${st.done ? "重新练习" : "开始今日精练"}</button>`;
}

// 阅读训练大卡片（与精听平级）
function renderReadingCard(reading) {
  const box = document.getElementById('reading-card');
  const a = reading.article, s = reading.session;
  if (!a) {
    box.innerHTML = `
      <div class="date">📖 阅读训练 · 每天 30 分钟沉浸</div>
      <div class="topic">今日文章还在准备中</div>
      <div class="meta">明早 7:10 会推送第一篇</div>`;
    return;
  }
  const meta = `Level ${esc(a.level || "")} · 约${a.est_minutes || "?"}分钟`;
  if (!s) {
    box.innerHTML = `
      <div class="date">📖 阅读训练 · ${meta}</div>
      <div class="topic">${esc(a.title)}</div>
      <div class="meta">${esc(a.reason_cn || "")} · <b>未做</b></div>
      <button class="btn-primary" onclick="location.href='../reading/reading.html'">开始今日阅读</button>`;
  } else if (s.passed) {
    box.innerHTML = `
      <div class="date">📖 阅读训练 · ${meta}</div>
      <div class="topic">${esc(a.title)}</div>
      <div class="meta">✅ 已打卡 · 测试 ${s.quiz_score} 分 · 用时 ${fmtMin(s.total_seconds)}</div>
      <button class="btn-primary" onclick="location.href='../reading/reading.html'">重新阅读</button>`;
  } else {
    box.innerHTML = `
      <div class="date">📖 阅读训练 · ${meta}</div>
      <div class="topic">${esc(a.title)}</div>
      <div class="meta">已测 ${s.quiz_score} 分，未通过</div>
      <button class="btn-primary" onclick="location.href='../reading/reading.html'">继续挑战</button>`;
  }
}

// 为你推荐：最近未完成的一天 / 历史听写最低的一天（建议重练）
function renderRecommend(prog, cloud) {
  const todayDate = drills[0].date;
  const cards = [];
  const unfinished = drills.find(d => d.date !== todayDate && !statusFor(d.date, prog, cloud).done);
  if (unfinished) {
    cards.push({
      tag: "还没练", title: `${unfinished.date} · ${esc(unfinished.topic_cn)}`,
      desc: "补上这一天的训练",
      href: `practice.html?date=${unfinished.date}`, btn: "继续练习 →"
    });
  }
  let worst = null, worstScore = Infinity;
  for (const d of drills) {
    if (d.date === todayDate) continue;
    if (unfinished && d.date === unfinished.date) continue;
    const sc = scoreFor(d.date, prog, cloud);
    if (sc != null && sc < worstScore) { worstScore = sc; worst = d; }
  }
  if (worst && worstScore < 100) {
    cards.push({
      tag: "建议重练", title: `${worst.date} · ${esc(worst.topic_cn)}`,
      desc: `听写 ${worstScore} 分，是你的历史最低分`,
      href: `practice.html?date=${worst.date}`, btn: "重新练习 →"
    });
  }
  document.getElementById('rec-list').innerHTML = cards.slice(0, 2).map(c => `
    <div class="card" style="border-left:4px solid #ff9f0a;cursor:pointer" onclick="location.href='${c.href}'">
      <div style="font-size:.8rem;color:#b7791f;margin-bottom:4px">${c.tag}</div>
      <div style="font-weight:bold">${c.title}</div>
      <div style="font-size:.85rem;color:#666;margin:4px 0 8px">${c.desc}</div>
      <button class="btn-primary" style="margin-top:0" onclick="event.stopPropagation();location.href='${c.href}'">${c.btn}</button>
    </div>`).join('');
}

// 历史记录：紧凑列表
function renderHistory(prog, cloud) {
  document.getElementById('history-list').innerHTML = drills.map(d => {
    const s = statusFor(d.date, prog, cloud);
    const sc = scoreFor(d.date, prog, cloud);
    const badge = s.done
      ? `<span class="score done">已完成${sc != null ? " " + sc + "分" : ""}</span>`
      : `<span class="score">未做</span>`;
    return `<div class="hist-item" onclick="location.href='practice.html?date=${d.date}'">
      <div><div class="d">${d.date}</div><div class="t">${esc(d.topic_cn)} · ${esc(d.topic)}</div></div>${badge}</div>`;
  }).join('');
}

document.addEventListener('DOMContentLoaded', init);
