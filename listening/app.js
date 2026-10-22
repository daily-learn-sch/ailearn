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
  renderIeltsBar();
  renderToday(prog, cloud);
  renderRationale();
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

// 今日推荐思路：默认折叠，点查看展开。
// 内容 = 当天 drill JSON 的 coach_rationale（晨间 cron 写）+ 当天阅读文章的推荐理由（Supabase）。
async function renderRationale() {
  const box = document.getElementById('rationale-wrap');
  if (!box || !drills.length) return;
  const today = drills[0];
  let coach = "";
  try {
    if (today.data) {
      const r = await fetch(today.data);
      if (r.ok) { const j = await r.json(); coach = j.coach_rationale || ""; }
    }
  } catch (e) { /* 无思路字段时只显示阅读理由 */ }
  let reading = null;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/reading_articles?read_date=eq.${today.date}&select=title,reason_cn&order=created_at.desc&limit=1`,
      { headers: SBH }
    );
    if (r.ok) { const rows = await r.json(); reading = rows[0] || null; }
  } catch (e) { /* 无阅读理由时只显示精听思路 */ }
  const coachHtml = coach
    ? `<div style="margin-bottom:12px"><div style="font-weight:bold;margin-bottom:4px">🎧 精听思路</div><div style="line-height:1.7">${esc(coach).replace(/\n/g, "<br>")}</div></div>`
    : `<div style="margin-bottom:12px;color:#666;font-size:.9rem">🎧 精听思路：暂无记录（从明日 drill 起附带）。</div>`;
  const readHtml = (reading && reading.reason_cn)
    ? `<div><div style="font-weight:bold;margin-bottom:4px">📖 阅读推荐</div><div style="line-height:1.7">${esc(reading.title)}：${esc(reading.reason_cn)}</div></div>`
    : ``;
  box.innerHTML = `
    <div class="card" style="border-left:4px solid #34c759">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div style="font-weight:bold">📋 今日推荐思路</div>
        <button id="rationaleToggle" style="flex:none;background:#fff;border:1px solid #ddd;border-radius:8px;padding:4px 12px;cursor:pointer;font-size:.9rem">查看 ▸</button>
      </div>
      <div style="color:#666;font-size:.85rem;margin-top:4px">为什么今天是这篇精听、这篇阅读？点查看看教练思路。</div>
      <div id="rationaleBody" style="display:none;margin-top:12px;border-top:1px solid #eee;padding-top:12px">${coachHtml}${readHtml}</div>
    </div>`;
  document.getElementById('rationaleToggle').onclick = () => {
    const b = document.getElementById('rationaleBody');
    const open = b.style.display !== 'none';
    b.style.display = open ? 'none' : 'block';
    document.getElementById('rationaleToggle').textContent = open ? '查看 ▸' : '收起 ▾';
  };
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

// ==== IELTS 7.0 进度条（与 practice.html 统计页同一套估值口径）====
const IELTS_MILES = [[4.5,"4.5 A2·起点"],[5.0,"5.0"],[5.5,"5.5 B1"],[6.0,"6.0"],[6.5,"6.5 B2"],[7.0,"7.0 🎯目标"]];
const IELTS_NEXT_NAME = {5.0:"5.0", 5.5:"B1 · 5.5", 6.0:"6.0", 6.5:"B2 · 6.5", 7.0:"目标 · 7.0"};
function ieltsEstimate(sessions){
  const scores = [];
  for(const s of (sessions||[])){
    const sc = s && s.modules && s.modules.dictation ? s.modules.dictation.score : null;
    if(sc != null){ scores.push(sc); if(scores.length >= 7) break; }
  }
  if(scores.length < 3) return {enough:false, n:scores.length, band:4.5, avg: scores.length ? scores.reduce((a,b)=>a+b,0)/scores.length : null};
  const avg = scores.reduce((a,b)=>a+b,0)/scores.length;
  const band = Math.min(6.0, 4.5 + Math.max(0, avg-70)*0.05);
  return {enough:true, n:scores.length, band, avg};
}
function ieltsBarInner(sessions){
  const est = ieltsEstimate(sessions);
  const pct = Math.round(Math.max(0, Math.min(100, (est.band-4.5)/2.5*100))*10)/10;
  const marks = IELTS_MILES.map(([v])=>`<span class="ielts-mark" style="left:${(v-4.5)/2.5*100}%"></span>`).join("");
  const ticks = IELTS_MILES.map(([v,label],i)=>{
    const cls = i===0 ? "ielts-tick first" : (i===IELTS_MILES.length-1 ? "ielts-tick last" : "ielts-tick");
    return `<span class="${cls}" style="left:${(v-4.5)/2.5*100}%">${label}</span>`;
  }).join("");
  let note;
  if(est.enough){
    const next = IELTS_MILES.find(m=>m[0] > est.band + 0.04);
    const distTxt = next ? `距 ${IELTS_NEXT_NAME[next[0]]} 还差 ${(next[0]-est.band).toFixed(1)}` : "已非常接近 7.0 目标";
    note = `${distTxt} · 近 ${est.n} 次听写均分 ${est.avg.toFixed(1)}<br><span class="ielts-sub">按近期听写成绩粗估，非官方分数；现阶段材料为 A2 难度，估值暂封顶 6.0</span>`;
  } else {
    note = `数据积累中（已完成 ${est.n} 次带听写分的训练，满 3 次后开始估算）<br><span class="ielts-sub">按近期听写成绩粗估，非官方分数</span>`;
  }
  const bubbleStyle = pct < 10 ? ' style="left:0;transform:none"' : (pct > 90 ? ' style="left:auto;right:0;transform:none"' : "");
  return `<div class="ielts-track"><div class="ielts-fill" style="width:${pct}%"></div>${marks}<div class="ielts-dot" style="left:${pct}%"><div class="ielts-bubble"${bubbleStyle}>当前估计 ≈${est.band.toFixed(1)}</div></div></div><div class="ielts-ticks">${ticks}</div><div class="ielts-note">${note}</div>`;
}
async function renderIeltsBar(){
  const el = document.getElementById('ielts-bar');
  if(!el) return;
  try{
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/drill_sessions?select=drill_date,total_seconds,modules,finished_at&finished_at=not.is.null&order=finished_at.desc&limit=40`,
      { headers: SBH }
    );
    if(!r.ok) throw new Error(r.status);
    const sessions = await r.json();
    el.innerHTML = `<h2 style="margin:0 0 2px">🏁 通往 IELTS 7.0</h2>` + ieltsBarInner(sessions);
  }catch(e){ el.style.display = "none"; }
}

document.addEventListener('DOMContentLoaded', init);
