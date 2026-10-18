// 精听训练 App
const LS_KEY = 'ailearn_listening_progress_v1';
let drills = [], current = null;

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
  catch { return {}; }
}
function saveProgress(p) { localStorage.setItem(LS_KEY, JSON.stringify(p)); }

async function init() {
  const res = await fetch('data/index.json');
  const idx = await res.json();
  drills = idx.drills;
  const _latest = drills.slice().sort((a,b)=>a.date.localeCompare(b.date)).pop();
  const _pl = document.getElementById('practiceLink');
  if(_pl && _latest) _pl.href = 'practice.html?date=' + _latest.date;
  renderHome();
  bindGlobal();
}

function renderHome() {
  showView('view-home');
  const today = drills[0];
  const prog = loadProgress();
  const done = prog[today.date] && prog[today.date].finished;
  document.getElementById('today-card').innerHTML = `
    <div class="date">${today.date} · Level ${today.level}</div>
    <div class="topic">${today.topic_cn}</div>
    <div class="meta">${today.topic} · 约15分钟 ${done ? '· ✅ 已完成' : ''}</div>
    <button class="btn-primary" onclick="startDrill('${today.date}')">开始今日精练</button>`;
  const hist = document.getElementById('history-list');
  hist.innerHTML = drills.map(d => {
    const p = prog[d.date];
    const s = p && p.score != null ? `<span class="score done">${p.score}%</span>`
            : p && p.finished ? `<span class="score done">已完成</span>`
            : `<span class="score">未做</span>`;
    return `<div class="hist-item" onclick="startDrill('${d.date}')">
      <div><div class="d">${d.date}</div><div class="t">${d.topic_cn} · ${d.topic}</div></div>${s}</div>`;
  }).join('');
}

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
  window.scrollTo(0, 0);
}

async function startDrill(date) {
  const _pl = document.getElementById('practiceLink');
  if (_pl) _pl.href = 'practice.html?date=' + date;
  const meta = drills.find(d => d.date === date);
  const res = await fetch(meta.data);
  current = await res.json();
  current._date = date;
  document.querySelectorAll('.step').forEach(s => s.classList.add('locked'));
  document.getElementById('step1').classList.remove('locked');
  document.querySelectorAll('.step-status').forEach(s => s.textContent = '');
  document.getElementById('check-result').classList.add('hidden');
  document.getElementById('drill-header').innerHTML = `
    <div class="date">${current._date} · Level ${current.level}</div>
    <div class="topic">${current.topic_cn}</div>
    <div class="meta">${current.topic}</div>`;
  ['audio1','audio2','audio3'].forEach(id => {
    document.getElementById(id).src = current.audio;
  });
  document.getElementById('dictation-fields').innerHTML = current.sentences.map((s, i) => `
    <div class="dict-field"><label>关键句 ${i+1}</label>
    <textarea id="dict-${i}" placeholder="听到什么写什么…"></textarea></div>`).join('');
  document.getElementById('transcript').textContent = current.passage;
  document.getElementById('vocab').innerHTML = (current.vocab||[]).map(v =>
    `<div class="v-item"><span class="w">${v.word}</span> <span class="p">${v.phonetic||''}</span><br>${v.note||''}</div>`).join('');
  showView('view-drill');
}

function bindGlobal() {
  document.getElementById('btn-back-home').onclick = renderHome;
  document.getElementById('btn-step1-done').onclick = () => {
    unlock('step2', 1); document.getElementById('step2').scrollIntoView({behavior:'smooth'});
  };
  document.getElementById('btn-check').onclick = checkDictation;
  document.getElementById('btn-finish').onclick = finishDrill;
  document.querySelectorAll('.speed-row').forEach(row => {
    const audios = row.parentElement.querySelectorAll('audio');
    row.querySelectorAll('button').forEach(btn => {
      btn.onclick = () => {
        row.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        audios.forEach(a => a.playbackRate = parseFloat(btn.dataset.speed));
      };
    });
  });
}

function unlock(stepId, n) {
  document.getElementById(stepId).classList.remove('locked');
  document.querySelector(`.step-status[data-step="${n}"]`).textContent = '✓';
  document.querySelector(`.step-status[data-step="${n}"]`).classList.add('done');
}

function normWords(s) {
  return s.toLowerCase().replace(/[.,!?;:"'()]/g, '').split(/\s+/).filter(Boolean);
}

function checkDictation() {
  const results = current.sentences.map((s, i) => {
    const user = document.getElementById(`dict-${i}`).value.trim();
    const stdW = normWords(s.text), userW = normWords(user);
    let correct = 0;
    for (let k = 0; k < Math.min(stdW.length, userW.length); k++) {
      if (stdW[k] === userW[k]) correct++;
    }
    return { user, std: s.text, correct, total: stdW.length };
  });
  const totC = results.reduce((a,r)=>a+r.correct,0), totT = results.reduce((a,r)=>a+r.total,0);
  const score = Math.round(totC/totT*100);
  const prog = loadProgress();
  prog[current._date] = Object.assign(prog[current._date]||{}, { score, checked: true });
  saveProgress(prog);
  const html = results.map((r,i) => `
    <div class="correction"><div><b>句 ${i+1}</b>（${r.correct}/${r.total}）</div>
    <div class="you">你写的：${r.user ? escapeHtml(r.user) : '<i>（空）</i>'}</div>
    <div class="std">标准：${escapeHtml(r.std)}</div></div>`).join('')
    + `<div class="score-line">本次听写：${score}% ${score>=80?'🎉 达标！':'（80% 达标线）'}</div>`;
  const box = document.getElementById('check-result');
  box.innerHTML = html; box.classList.remove('hidden');
  unlock('step3', 2);
  document.getElementById('step3').scrollIntoView({behavior:'smooth'});
}

function escapeHtml(s){ const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

function finishDrill() {
  const prog = loadProgress();
  prog[current._date] = Object.assign(prog[current._date]||{}, { finished: true, finishedAt: new Date().toISOString() });
  saveProgress(prog);
  document.querySelector(`.step-status[data-step="3"]`).textContent = '✓';
  document.querySelector(`.step-status[data-step="3"]`).classList.add('done');
  alert('今日训练完成！明天见 👏');
  renderHome();
}

document.addEventListener('DOMContentLoaded', init);
