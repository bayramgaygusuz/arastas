(() => {
const TUR = {kristal:'Kristal', mineral:'Mineral', kaya:'Kaya', fosil:'Kabuk & Fosil'};
const MOHS = [['Talk',1],['Alçıtaşı',2],['Kalsit',3],['Florit',4],['Apatit',5],['Feldispat',6],['Kuvars',7],['Topaz',8],['Korindon',9],['Elmas',10]];
const $ = s => document.querySelector(s);
const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const norm = s => s.toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '');

let all = [], view = [], state = {q:'', tur:'hepsi', sort:'ad', mohs:0, mystery:false};

fetch('data/specimens.json').then(r => r.json()).then(d => {
  all = d.map((s, i) => ({...s, sira:i}));
  buildStats(); buildChips(); buildMohs(); render();
}).catch(() => { $('#count').textContent = 'Veri yüklenemedi. Siteyi bir web sunucusu üzerinden aç.'; });

const mid = s => s.mohs ? (s.mohs[0] + s.mohs[1]) / 2 : null;
const thumb = s => `img/thumb/${s.id}.webp`;

function buildStats(){
  const n = k => all.filter(s => s.tur === k).length;
  const myst = all.filter(s => s.kimlik === 'bilinmiyor').length;
  $('#stats').innerHTML =
    `<span class="stat"><b>${all.length}</b>örnek</span>` +
    Object.keys(TUR).map(k => `<span class="stat"><b>${n(k)}</b>${TUR[k]}</span>`).join('') +
    (myst ? `<span class="stat">🔍 <b>${myst}</b>gizemli</span>` : '');
}
function buildChips(){
  const box = $('#chips');
  const mk = (k, label, c) => { const b = el('button', 'chip', label); b.dataset.k = k; if (c) b.style.setProperty('--c', c); b.onclick = () => { state.tur = k; state.mystery = false; render(); }; return b; };
  box.append(mk('hepsi', 'Hepsi', '#fff'));
  const colors = {kristal:'var(--kristal)', mineral:'var(--mineral)', kaya:'var(--kaya)', fosil:'var(--fosil)'};
  for (const k in TUR) box.append(mk(k, TUR[k], colors[k]));
  const m = el('button', 'chip', '🔍 Gizemli'); m.dataset.k = 'gizemli'; m.style.setProperty('--c', '#f0abfc');
  m.onclick = () => { state.mystery = !state.mystery; state.tur = 'hepsi'; render(); };
  box.append(m);
}
function buildMohs(){
  const row = $('#mohsRow');
  MOHS.forEach(([n, v]) => {
    const b = el('button', 'mh', `<b>${v}</b><small>${n}</small>`); b.dataset.v = v;
    b.onclick = () => { state.mohs = state.mohs === v ? 0 : v; render(); };
    row.append(b);
  });
}

function filter(){
  const q = norm(state.q.trim());
  let r = all.filter(s => {
    if (state.tur !== 'hepsi' && s.tur !== state.tur) return false;
    if (state.mystery && s.kimlik !== 'bilinmiyor') return false;
    if (state.mohs && !(s.mohs && state.mohs >= Math.floor(s.mohs[0]) && state.mohs <= Math.ceil(s.mohs[1]))) return false;
    if (q) { const hay = norm([s.ad, s.renk, s.formul, s.bilgi, TUR[s.tur], s.sistem, s.parlaklik].join(' ')); if (!hay.includes(q)) return false; }
    return true;
  });
  const by = state.sort;
  if (by === 'ad') r.sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
  else if (by === 'sira') r.sort((a, b) => a.sira - b.sira);
  else r.sort((a, b) => { const x = mid(a), y = mid(b); if (x == null) return 1; if (y == null) return -1; return by === 'mohs-d' ? y - x : x - y; });
  return r;
}

function render(){
  view = filter();
  document.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.dataset.k === 'gizemli' ? state.mystery : (!state.mystery && c.dataset.k === state.tur)));
  document.querySelectorAll('.mh').forEach(b => b.classList.toggle('on', +b.dataset.v === state.mohs));
  const g = $('#grid'); g.innerHTML = '';
  view.forEach((s, i) => {
    const c = el('button', 'card'); c.dataset.tur = s.tur; c.style.animationDelay = Math.min(i, 24) * 18 + 'ms';
    c.setAttribute('aria-label', s.ad);
    const badge = s.kimlik === 'bilinmiyor' ? '<span class="badge mystery">gizemli</span>' : s.kimlik === 'tahmin' ? '<span class="badge guess" title="Tahmin">?</span>' : '<span class="badge ok">✓</span>';
    const mini = s.mohs ? `<span class="mini"><i style="left:${(s.mohs[0]-1)*11.1}%;width:${Math.max(6,(s.mohs[1]-s.mohs[0])*11.1+6)}%"></i></span><span>${fmt(s.mohs)}</span>` : `<span style="opacity:.6">${TUR[s.tur]}</span>`;
    c.innerHTML = `${badge}<div class="pic"><img loading="lazy" src="${thumb(s)}" alt="${esc(s.ad)}"></div>
      <div class="meta"><h3>${esc(s.ad)}</h3><div class="row"><span class="dot"></span>${mini}</div></div>`;
    c.onclick = () => openModal(i);
    g.append(c);
  });
  $('#count').textContent = `${view.length} / ${all.length} örnek gösteriliyor`;
  $('#empty').hidden = view.length > 0;
}
const fmt = m => m[0] === m[1] ? String(m[0]).replace('.', ',') : `${m[0]}–${m[1]}`.replace(/\./g, ',');

$('#q').oninput = e => { state.q = e.target.value; render(); };
$('#sort').onchange = e => { state.sort = e.target.value; render(); };

/* ---- detay ---- */
let cur = 0, imgMode = 'cut', timer = null, slide = false;
const modal = $('#modal');
function openModal(i, isSlide = false){
  cur = i; slide = isSlide; imgMode = 'cut';
  modal.classList.toggle('slide', slide);
  $('#slideCtl').hidden = !slide;
  modal.hidden = false; document.body.style.overflow = 'hidden';
  paint();
  if (slide) startTimer(); else stopTimer();
}
function closeModal(){
  stopTimer(); modal.hidden = true; document.body.style.overflow = '';
  if (document.fullscreenElement) document.exitFullscreen();
}
function paint(){
  const s = view[cur]; if (!s) return;
  const col = {kristal:'#a78bfa', mineral:'#fbbf24', kaya:'#94a3b8', fosil:'#34d399'}[s.tur];
  modal.style.setProperty('--c', col);
  const img = $('#mImg'); img.className = imgMode === 'photo' ? 'photo' : '';
  img.src = `img/${imgMode}/${s.id}.webp`; img.alt = s.ad;
  document.querySelectorAll('#mSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === imgMode));
  const st = s.kimlik === 'bilinmiyor' ? '<span class="tag">🔍 Gizemli taş</span>' : s.kimlik === 'tahmin' ? '<span class="tag">? Tahmin</span>' : '<span class="tag">✓ Doğrulandı</span>';
  $('#mTags').innerHTML = `<span class="tag">${TUR[s.tur]}</span>${st}`;
  $('#mTitle').textContent = s.ad;
  const rows = [['Renk', s.renk], ['Formül', s.formul], ['Kristal sistemi', s.sistem], ['Parlaklık', s.parlaklik]].filter(r => r[1]);
  $('#mProps').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
  const bar = $('#mBar');
  if (s.mohs) {
    bar.innerHTML = `<div class="lbl"><span>Mohs sertliği</span><span>${fmt(s.mohs)}</span></div><div class="scale">${
      Array.from({length:10}, (_, k) => `<i class="${(k+1) >= Math.floor(s.mohs[0]) && (k+1) <= Math.ceil(s.mohs[1]) ? 'f' : ''}"></i>`).join('')}</div>
      <div class="hint">1 = talk (en yumuşak) · 10 = elmas (en sert)</div>`;
  } else bar.innerHTML = '<div class="hint">Sertliği henüz ölçülmedi. Çivi, bakır para ve çelikle test edebiliriz.</div>';
  $('#mFact').textContent = s.bilgi || 'Bu taşın hikâyesini birlikte yazacağız.';
  const n = $('#mNote'); n.hidden = !s.not; n.textContent = s.not || '';
  $('#pos').textContent = `${cur + 1} / ${view.length}`;
}
const go = d => { cur = (cur + d + view.length) % view.length; imgMode = 'cut'; paint(); if (slide) startTimer(); };
function startTimer(){ stopTimer(); timer = setInterval(() => go(1), 8000); $('#playBtn').textContent = '⏸ Duraklat'; }
function stopTimer(){ clearInterval(timer); timer = null; $('#playBtn').textContent = '▶ Oynat'; }

$('#mClose').onclick = closeModal;
$('#mPrev').onclick = () => go(-1); $('#mNext').onclick = () => go(1);
$('#mSeg').onclick = e => { const v = e.target.dataset.v; if (v) { imgMode = v; paint(); } };
modal.onclick = e => { if (e.target === modal) closeModal(); };
$('#playBtn').onclick = () => timer ? stopTimer() : startTimer();
$('#fsBtn').onclick = () => { document.fullscreenElement ? document.exitFullscreen() : modal.requestFullscreen?.(); };
$('#btnShow').onclick = () => { if (view.length) openModal(0, true); };
document.addEventListener('keydown', e => {
  if (!modal.hidden) { if (e.key === 'Escape') closeModal(); else if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); else if (e.key === ' ' && slide) { e.preventDefault(); timer ? stopTimer() : startTimer(); } }
  if (!$('#quiz').hidden && e.key === 'Escape') closeQuiz();
});
let tx = 0; modal.addEventListener('touchstart', e => tx = e.touches[0].clientX, {passive:true});
modal.addEventListener('touchend', e => { const d = e.changedTouches[0].clientX - tx; if (Math.abs(d) > 60) go(d < 0 ? 1 : -1); });

/* ---- quiz ---- */
const quiz = $('#quiz'); let qs = [], qi = 0, score = 0, locked = false;
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
function startQuiz(){
  const pool = all.filter(s => s.kimlik !== 'bilinmiyor');
  qs = shuffle(pool.slice()).slice(0, 10); qi = 0; score = 0;
  quiz.hidden = false; document.body.style.overflow = 'hidden'; ask();
}
function closeQuiz(){ quiz.hidden = true; document.body.style.overflow = ''; }
function ask(){
  locked = false;
  const s = qs[qi], sh = $('#qOpts');
  $('#qProg').textContent = `Soru ${qi + 1} / ${qs.length}`; $('#qScore').textContent = `⭐ ${score}`;
  $('#qImg').src = `img/cut/${s.id}.webp`; $('#qAsk').textContent = 'Bu hangi taş?';
  $('#qFb').textContent = ''; $('#qNext').hidden = true;
  const names = new Set([s.ad]);
  const wrong = shuffle(all.filter(x => x.kimlik !== 'bilinmiyor' && !names.has(x.ad)).map(x => x.ad));
  const opts = [s.ad]; for (const w of wrong) { if (!opts.includes(w)) opts.push(w); if (opts.length === 4) break; }
  sh.innerHTML = '';
  shuffle(opts).forEach(o => {
    const b = el('button', 'opt', esc(o));
    b.onclick = () => {
      if (locked) return; locked = true;
      const ok = o === s.ad; if (ok) score++;
      sh.querySelectorAll('.opt').forEach(x => { x.disabled = true; if (x.textContent === s.ad) x.classList.add('good'); });
      if (!ok) b.classList.add('bad');
      $('#qFb').textContent = (ok ? '🎉 Doğru! ' : '😅 Olmadı. ') + (s.bilgi || '');
      $('#qScore').textContent = `⭐ ${score}`;
      const nb = $('#qNext'); nb.hidden = false; nb.textContent = qi === qs.length - 1 ? 'Sonucu gör' : 'Sonraki →';
    };
    sh.append(b);
  });
}
$('#qNext').onclick = () => {
  if (qi < qs.length - 1) { qi++; ask(); return; }
  $('#qOpts').innerHTML = ''; $('#qNext').hidden = true; $('#qImg').removeAttribute('src');
  $('#qAsk').innerHTML = `<div class="final">${score >= 8 ? '🏆' : score >= 5 ? '🥈' : '💪'}</div>${score} / ${qs.length} doğru!`;
  $('#qFb').innerHTML = '<button class="btn primary" id="again">Tekrar oyna</button>';
  $('#again').onclick = startQuiz;
};
$('#btnQuiz').onclick = startQuiz; $('#qClose').onclick = closeQuiz;
quiz.onclick = e => { if (e.target === quiz) closeQuiz(); };
})();
