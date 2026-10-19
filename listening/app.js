// 精听训练首页（训练流程已迁移到 practice.html，本页仅做入口 + 状态展示）
const LS_KEY = 'ailearn_listening_progress_v1';
const SUPABASE_URL = "https://qydtzdewqkzonzwmxapa.supabase.co";
const SUPABASE_KEY = "sb_publishable_979g0z6Xf84og_vjDliW-Q_Jyia_y4N";
const SBH = { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY };
let drills = [];

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
  catch { return {}; }
}

// ① 云端 drill_sessions：取每个 drill_date 的 finished_at 最新已完成行
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

function fmtMin(sec) {
  if (sec == null) return "未知";
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return s ? `${m} 分钟 ${s} 秒` : `${m} 分钟`;
}

// 合并两处数据源：云端 drill_sessions（优先）+ 旧本地 localStorage
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

async function init() {
  try {
    const res = await fetch('data/index.json');
    const idx = await res.json();
    drills = idx.drills.slice().sort((a, b) => b.date.localeCompare(a.date)); // 最新在前
  } catch (e) {
    document.getElementById('today-card').innerHTML = '<div class="meta">加载失败，请刷新重试</div>';
    return;
  }
  const latest = drills[0];
  const pl = document.getElementById('practiceLink');
  if (pl && latest) pl.href = 'practice.html?date=' + latest.date;
  const prog = loadProgress();
  const cloud = await fetchCloudSessions();
  renderHome(prog, cloud);
}

function renderHome(prog, cloud) {
  const today = drills[0];
  const st = statusFor(today.date, prog, cloud);
  document.getElementById('today-card').innerHTML = `
    <div class="date">${today.date} · Level ${today.level}</div>
    <div class="topic">${today.topic_cn}</div>
    <div class="meta">${today.topic} · 约15分钟 · ${st.label}</div>
    <button class="btn-primary" onclick="location.href='practice.html?date=${today.date}'">${st.done ? "重新练习" : "开始今日精练"}</button>`;
  document.getElementById('history-list').innerHTML = drills.map(d => {
    const s = statusFor(d.date, prog, cloud);
    const badge = s.done ? `<span class="score done">已完成</span>` : `<span class="score">未做</span>`;
    return `<div class="hist-item" onclick="location.href='practice.html?date=${d.date}'">
      <div><div class="d">${d.date}</div><div class="t">${d.topic_cn} · ${d.topic}</div></div>${badge}</div>`;
  }).join('');
}

document.addEventListener('DOMContentLoaded', init);
