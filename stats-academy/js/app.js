/* WorkBuddy 数据统计分析学院 —— 应用逻辑 */
(function(){
'use strict';
const S = window.Stats;
const COURSES = window.COURSES || [];
const QUIZ = window.QUIZ || {};
const STORE_KEY = 'wb-stats-academy-v1';
const CHART_KEY  = 'wb-stats-charts-v1';

/* ================= 状态 ================= */
const store = {
  completed: {},   // courseId -> true
  quizBest: {},    // courseId -> score(0-100)
  robcheck: []     // 核验清单勾选状态
};
try{
  const raw = localStorage.getItem(STORE_KEY);
  if(raw) Object.assign(store, JSON.parse(raw));
}catch(e){}
function save(){
  try{ localStorage.setItem(STORE_KEY, JSON.stringify(store)); }catch(e){}
}
const charts = [];   // 当前页面 ECharts 实例
let currentCourseId = null;
let pendingScroll = null;   // {sec, hl}

/* ================= 工具函数 ================= */
const $ = s => document.querySelector(s);
function md(s){
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g,'<b>$1</b>')
    .replace(/`([^`]+)`/g,'<code>$1</code>');
}
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._tm); t._tm = setTimeout(()=>t.classList.remove('show'), 2200);
}
function isDark(){ return document.body.dataset.theme === 'dark'; }
function axisColor(){ return isDark() ? '#8b93b8' : '#5b6478'; }
function gridColor(){ return isDark() ? 'rgba(255,255,255,.08)' : 'rgba(23,27,62,.08)'; }
function chart(el, option){
  if(!window.echarts){ el.innerHTML = '<div class="tool-msg err">图表组件未加载（需要联网获取 ECharts），数值结果仍可正常使用。</div>'; return null; }
  const c = echarts.init(el, isDark() ? 'dark' : null);
  c.setOption(option); charts.push(c); return c;
}
function baseChart(){
  return {
    textStyle:{ color: axisColor(), fontFamily:'inherit' },
    grid:{ left:48, right:20, top:30, bottom:40 },
    tooltip:{ trigger:'axis' },
    xAxis:{ axisLine:{ lineStyle:{ color: gridColor() } }, axisLabel:{ color: axisColor() }, splitLine:{ show:false } },
    yAxis:{ axisLine:{ show:false }, axisLabel:{ color: axisColor() }, splitLine:{ lineStyle:{ color: gridColor() } } }
  };
}
function parseNums(text){
  return text.split(/[,，;；\s\n\t]+/).map(s=>s.trim()).filter(s=>s!=='')
    .map(Number).filter(n=>isFinite(n));
}
function parseMatrix(text){
  // 每行一个被试，行内逗号/空白分隔题目得分
  return text.split(/\n+/).map(line=>line.trim()).filter(Boolean)
    .map(line=>line.split(/[,，;；\s\t]+/).map(Number))
    .filter(row=>row.length>1 && row.every(isFinite));
}
function resizeCharts(){ charts.forEach(c=>{ try{ c.resize(); }catch(e){} }); }

/* ================= 侧栏 ================= */
function renderSidebar(filter){
  const list = $('#moduleList');
  const kw = (filter||'').trim().toLowerCase();
  list.innerHTML = '';
  COURSES.forEach(c=>{
    const hit = !kw || (c.title+c.tag+c.subtitle+ (c.keywords||[]).join(' ')).toLowerCase().includes(kw);
    if(!hit) return;
    const done = !!store.completed[c.id];
    const best = store.quizBest[c.id];
    const item = document.createElement('div');
    item.className = 'module-item' + (c.id===currentCourseId?' active':'') + (done?' done':'');
    item.innerHTML =
      '<div class="module-icon">'+c.icon+'</div>' +
      '<div class="module-meta"><div class="module-no">'+c.no+' · '+esc(c.tag)+'</div>' +
      '<div class="module-title">'+esc(c.title)+'</div></div>' +
      '<div class="module-status"><span class="dot"></span>' +
      (best!==undefined?'<span class="quiz-badge">'+best+'分</span>':'') + '</div>';
    item.onclick = ()=>{ closeSidebar(); goTo(c.id); };
    list.appendChild(item);
  });
  updateProgress();
}
function updateProgress(){
  const n = Object.keys(store.completed).length;
  $('#progressText').textContent = n + ' / ' + COURSES.length;
  $('#progressBar').style.width = (COURSES.length? n/COURSES.length*100 : 0) + '%';
}

/* ================= 路由 ================= */
function goTo(id){
  closeSidebar();
  const h = '#/course/' + id;
  if(location.hash === h){ renderCourse(id); }
  else { location.hash = h; }
}
function parseHash(){
  const m = location.hash.match(/^#\/course\/([\w-]+)$/);
  return m ? m[1] : null;
}
function handleRoute(){
  const id = parseHash() || (COURSES[0] && COURSES[0].id);
  renderCourse(id);
}

/* ================= 课程渲染 ================= */
function renderCourse(id){
  const c = COURSES.find(x=>x.id===id);
  if(!c){ $('#content').innerHTML = '<div class="empty-search">未找到该课程</div>'; return; }
  currentCourseId = id;
  charts.forEach(ch=>{ try{ ch.dispose(); }catch(e){} }); charts.length = 0;
  renderSidebar($('#searchBox').value);

  const quiz = QUIZ[id] || [];
  let html = '';
  html += '<div class="course-hero"><div class="badge-line">'+
    '<span class="chip">模块 '+c.no+'</span><span class="chip">'+esc(c.tag)+'</span></div>'+
    '<h2>'+c.icon+' '+esc(c.title)+'</h2><p>'+esc(c.subtitle)+'</p></div>';

  html += '<div class="objectives"><h3>🎯 学习目标</h3><ol>'+
    c.objectives.map(o=>'<li>'+md(o)+'</li>').join('')+'</ol></div>';

  c.sections.forEach((sec, si)=>{
    html += '<div class="section" id="sec-'+c.id+'-'+si+'"><h3><span class="num">'+c.no+'.'+(si+1)+'</span>'+esc(sec.h)+'</h3>';
    (sec.blocks||[]).forEach(b=>{ html += renderBlock(b, c); });
    html += '</div>';
  });

  if(c.faq && c.faq.length){
    html += '<div class="section"><h3><span class="num">'+c.no+'.Q</span>常见问题</h3>'+
      c.faq.map(f=>'<details class="faq-item"><summary>'+esc(f.q)+'</summary><div class="faq-a">'+md(f.a)+'</div></details>').join('')+
      '</div>';
  }

  if(quiz.length){
    html += renderQuizHTML(c, quiz);
  }

  const idx = COURSES.findIndex(x=>x.id===id);
  const prev = COURSES[idx-1], next = COURSES[idx+1];
  html += '<div class="page-nav">'+
    (prev?'<button class="btn ghost" id="prevBtn">← 上一模块 · '+prev.no+' '+esc(prev.title)+'</button>':'<span></span>')+
    '<button class="btn" id="doneBtn">'+(store.completed[id]?'✅ 已完成 · 点击取消':'✔ 标记本模块为已完成')+'</button>'+
    (next?'<button class="btn ghost" id="nextBtn">下一模块 · '+next.no+' '+esc(next.title)+' →</button>':'<span></span>')+
    '</div>';

  $('#content').innerHTML = html;
  $('#crumb').innerHTML = 'WorkBuddy 数据统计分析学院 / <b>'+c.no+' '+esc(c.title)+'</b>';
  document.title = c.no + ' ' + c.title + ' · WorkBuddy 数据统计分析学院';
  window.scrollTo(0,0);

  $('#doneBtn').onclick = ()=>{
    if(store.completed[id]) delete store.completed[id]; else store.completed[id] = true;
    save(); renderSidebar($('#searchBox').value);
    toast(store.completed[id] ? '已标记完成 🎉' : '已取消完成标记');
    $('#doneBtn').textContent = store.completed[id] ? '✅ 已完成 · 点击取消' : '✔ 标记本模块为已完成';
  };
  if(prev) $('#prevBtn').onclick = ()=>goTo(prev.id);
  if(next) $('#nextBtn').onclick = ()=>goTo(next.id);

  // 复制按钮
  document.querySelectorAll('.copy').forEach(btn=>{
    btn.onclick = ()=>{
      const code = btn.closest('.code-block').querySelector('pre').innerText;
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(code).then(()=>toast('已复制到剪贴板'));
      } else { toast('复制失败：浏览器不支持'); }
    };
  });

  // 工具渲染
  document.querySelectorAll('.tool-slot').forEach(el=>{
    const tid = el.dataset.tool;
    if(TOOLS[tid]) TOOLS[tid](el);
  });

  // 测验绑定
  bindQuiz(c);

  // 搜索跳转
  if(pendingScroll && pendingScroll.course === id){
    const el2 = document.getElementById('sec-'+c.id+'-'+pendingScroll.sec);
    if(el2){ setTimeout(()=>{ el2.scrollIntoView({behavior:'smooth', block:'start'});
      el2.classList.add('highlight-section'); setTimeout(()=>el2.classList.remove('highlight-section'), 2600); }, 80); }
    pendingScroll = null;
  }
  setTimeout(resizeCharts, 60);
}

function renderBlock(b, c){
  switch(b.type){
    case 'p': return '<p>'+md(b.body)+'</p>';
    case 'ul': return '<ul>'+b.items.map(i=>'<li>'+md(i)+'</li>').join('')+'</ul>';
    case 'ol': return '<ol>'+b.items.map(i=>'<li>'+md(i)+'</li>').join('')+'</ol>';
    case 'cards':
      return '<div class="cards-grid">'+b.items.map(it=>
        '<div class="mini-card"><h5>'+(it.icon||'▪')+' '+esc(it.t)+'</h5><p>'+md(it.b)+'</p></div>').join('')+'</div>';
    case 'table':
      return '<div class="table-wrap"><table><thead><tr>'+b.headers.map(h=>'<th>'+esc(h)+'</th>').join('')+
        '</tr></thead><tbody>'+b.rows.map(r=>'<tr>'+r.map(d=>'<td>'+md(d)+'</td>').join('')+'</tr>').join('')+
        '</tbody></table></div>';
    case 'code':
      return '<div class="code-block"><div class="code-head"><span class="lang">'+esc(b.lang||'')+
        (b.title?' · '+esc(b.title):'')+'</span><button class="copy">复制</button></div><pre>'+esc(b.body)+'</pre></div>';
    case 'callout':
      return '<div class="callout '+esc(b.kind||'tip')+'"><b>'+(b.title?esc(b.title):'')+'</b>'+
        (b.fx?'<div class="fx">'+b.fx+'</div>':'')+
        (b.body?'<div class="ct">'+md(b.body)+'</div>':'')+'</div>';
    case 'tool':
      return '<div class="tool-box"><div class="tool-label">🧪 交互工具</div><div class="tool-slot" data-tool="'+esc(b.id)+'"></div></div>';
  }
  return '';
}

/* ================= 测验 ================= */
function renderQuizHTML(c, quiz){
  let h = '<div class="quiz-box"><h3>📝 模块测验</h3><div class="quiz-sub">共 '+quiz.length+
    ' 题 · 提交后自动判分并显示解析 · 最高分计入学习档案</div>';
  quiz.forEach((q,qi)=>{
    h += '<div class="quiz-q" id="quiz-q-'+qi+'"><div class="qq"><span class="no">'+(qi+1)+'</span>'+esc(q.q)+'</div>';
    q.o.forEach((opt,oi)=>{
      h += '<label class="quiz-opt"><input type="radio" name="q'+qi+'" value="'+oi+'"> '+esc(opt)+'</label>';
    });
    h += '<div class="quiz-explain" id="quiz-e-'+qi+'">'+esc(q.e)+'</div></div>';
  });
  h += '<div class="tool-actions"><button class="btn" id="quizSubmit">提交测验</button>'+
    '<button class="btn ghost" id="quizRetake">重新作答</button></div>'+
    '<div class="quiz-result" id="quizResult" style="display:none"></div></div>';
  return h;
}
function bindQuiz(c){
  const quiz = QUIZ[c.id] || [];
  if(!quiz.length) return;
  const submit = $('#quizSubmit'), retake = $('#quizRetake');
  if(!submit) return;
  submit.onclick = ()=>{
    let score = 0;
    quiz.forEach((q,qi)=>{
      const sel = document.querySelector('input[name="q'+qi+'"]:checked');
      const labels = document.querySelectorAll('#quiz-q-'+qi+' .quiz-opt');
      labels.forEach(l=>{ l.classList.remove('correct','wrong'); l.querySelector('input').disabled = true; });
      const ex = $('#quiz-e-'+qi);
      ex.classList.add('show');
      if(sel && +sel.value === q.a){
        score++; labels[q.a].classList.add('correct');
      } else {
        labels[q.a].classList.add('correct');
        if(sel) labels[+sel.value].classList.add('wrong');
      }
    });
    const pct = Math.round(score/quiz.length*100);
    const res = $('#quizResult');
    res.style.display = 'block';
    const cls = pct>=80?'good':(pct>=60?'mid':'low');
    const msg = pct>=80?'优秀！知识掌握扎实 🎉':(pct>=60?'合格，建议复习错题解析':'建议重读本模块内容后再挑战');
    res.innerHTML = '<div class="score '+cls+'">'+pct+' 分</div><div class="msg">答对 '+score+' / '+quiz.length+' 题 · '+msg+'</div>';
    submit.disabled = true;
    const best = store.quizBest[c.id];
    if(best===undefined || pct>best){
      store.quizBest[c.id] = pct;
      save(); renderSidebar($('#searchBox').value);
      if(best===undefined) toast('测验完成！得分 '+pct+' 分');
      else toast('新纪录！'+pct+' 分（原 '+best+' 分）');
    } else { toast('得分 '+pct+' 分（最高 '+best+' 分）'); }
    if(pct>=60 && !store.completed[c.id]){ store.completed[c.id]=true; save(); renderSidebar($('#searchBox').value); }
  };
  retake.onclick = ()=>{
    const box = document.querySelector('.quiz-box');
    box.outerHTML = renderQuizHTML(c, quiz);
    bindQuiz(c);
    toast('已重置，重新作答');
  };
}

/* ================= 交互工具 ================= */
const TOOLS = {};

/* 01：工作流时间线 */
TOOLS['workflow-map'] = function(el){
  const steps = [
    ['1','需求定义','研究问题、H0/H1、变量清单、分析计划书','🎯'],
    ['2','数据接入','来源确认、口径核对、原始数据入库（只读）','🔌'],
    ['3','清洗质控','缺失/重复/异常、编码、数据字典、清洗日志','🧹'],
    ['4','探索分析','描述统计、六类图表、方法选择','📊'],
    ['5','建模推断','t/ANOVA/回归/面板/事件研究 + 诊断','📈'],
    ['6','报告交付','稳健性检验、三线表、学术图表、写作成稿','📦']
  ];
  el.innerHTML = '<div class="timeline">'+steps.map(s=>
    '<div class="tl-item"><h5><span>'+s[3]+'</span> 阶段 '+s[0]+'：'+s[1]+'</h5><p>'+s[2]+'</p></div>').join('')+'</div>'+
    '<p class="chart-note">阶段间顺序依赖，允许小步回环；每个阶段都产出可追溯的工件（计划书 → 数据 → 日志 → 图表 → 模型 → 报告）。</p>';
};

/* 02：方法选择器 */
TOOLS['method-picker'] = function(el){
  el.innerHTML =
  '<div class="tool-grid">'+
    '<div class="tool-field"><label>研究目标</label><select id="mp-goal">'+
      '<option value="compare">比较组间差异</option><option value="relate">关联分析</option>'+
      '<option value="predict">预测与解释</option><option value="reduce">结构降维</option>'+
      '<option value="reliability">量表信度评估</option></select></div>'+
    '<div class="tool-field"><label>因变量 Y 类型</label><select id="mp-y">'+
      '<option value="continuous">连续（数值）</option><option value="binary">二分类（0/1）</option>'+
      '<option value="categorical">多分类</option><option value="count">计数（0,1,2…）</option>'+
      '<option value="scale">多题量表</option></select></div>'+
    '<div class="tool-field"><label>数据结构</label><select id="mp-struct">'+
      '<option value="cross">横截面</option><option value="panel">面板</option><option value="time">时间序列</option></select></div>'+
  '</div>'+
  '<div class="tool-actions"><button class="btn" id="mp-run">推荐方法</button></div>'+
  '<div class="method-out" id="mp-out" style="display:none"></div>';
  el.querySelector('#mp-run').onclick = ()=>{
    const goal = el.querySelector('#mp-goal').value;
    const y = el.querySelector('#mp-y').value;
    const st = el.querySelector('#mp-struct').value;
    let r = null;
    if(goal==='reliability') r = {m:'Cronbach\'s α 信度分析', d:'模块 05', note:'多题合成前必做；α<0.6 需修订量表，0.7-0.8 可接受，0.8+ 良好。'};
    else if(goal==='reduce') r = {m:'探索性因子分析（EFA）/ 验证性因子分析（CFA）', d:'模块 05', note:'先看 KMO（>0.6）与 Bartlett（p<0.05），再提取因子并旋转。'};
    else if(goal==='compare'){
      if(st==='cross'){
        if(y==='continuous') r = {m:'独立样本 t 检验（2 组）/ 单因素 ANOVA（3 组及以上）', d:'模块 05', note:'前提：近似正态 + 方差齐性；违背后改用 Mann-Whitney / Kruskal-Wallis。'};
        else r = {m:'卡方检验（列联表）', d:'模块 05', note:'期望频数 <5 的格超过 20% 时用 Fisher 精确检验。'};
      } else r = {m:'面板固定效应 / 双重差分（DID）', d:'模块 07', note:'面板可用组内变异控制个体异质性；政策冲击优先考虑 DID 设计。'};
    }
    else if(goal==='relate'){
      if(st==='cross' && y==='continuous') r = {m:'Pearson 相关（正态线性）/ Spearman 秩相关（非正态/定序）', d:'模块 06', note:'先画散点图确认形态；r 只度量线性（或单调）关系。'};
      else if(st==='cross') r = {m:'卡方检验 + Cramér\'s V 效应量', d:'模块 05', note:'χ² 显著后报告 V（0.1 小 / 0.3 中 / 0.5 大）衡量关联强度。'};
      else r = {m:'面板相关分析 / 协整检验', d:'模块 07', note:'时序与面板要警惕伪相关，先做平稳性与协整检验。'};
    }
    else if(goal==='predict'){
      if(st==='cross'){
        if(y==='continuous') r = {m:'多元线性回归（OLS + 稳健标准误）', d:'模块 06', note:'分类自变量做哑变量；完成后做 VIF、异方差与残差诊断。'};
        else if(y==='binary') r = {m:'Logistic 回归', d:'模块 06', note:'系数解读用几率比 OR = exp(β)；报告 Hosmer-Lemeshow 拟合优度。'};
        else if(y==='count') r = {m:'Poisson / 负二项回归', d:'模块 06', note:'过度离散（方差>均值）时用负二项；零膨胀时用 ZINB。'};
        else r = {m:'多项 Logit / 有序 Logit', d:'模块 06', note:'定序因变量用有序 Logit，多分类无序用多项 Logit。'};
      } else if(st==='panel'){
        r = {m: y==='continuous' ? '面板固定效应 / 随机效应（Hausman 检验选择）' : '面板 Logit / Probit', d:'模块 07', note:'个体 FE 控制时不变异质性；双向固定效应吸收共同时间冲击。'};
      } else r = {m:'时间序列回归（ARIMA / 动态回归）', d:'模块 07', note:'先做平稳性检验；有单位根时差分或用协整框架。'};
    }
    const out = el.querySelector('#mp-out');
    out.style.display = 'block';
    out.innerHTML = '<h4>🎯 推荐：'+esc(r.m)+'</h4><p>'+esc(r.note)+'</p>'+
      '<span class="goto" data-id="'+ (r.d==='模块 05'?'05-survey':(r.d==='模块 06'?'06-regression':(r.d==='模块 07'?'07-panel':'05-survey'))) +'">进入'+esc(r.d)+'学习 →</span>';
    out.querySelector('.goto').onclick = ()=>goTo(out.querySelector('.goto').dataset.id);
  };
};

/* 03：IQR 异常值演示 */
TOOLS['iqr-demo'] = function(el){
  el.innerHTML =
  '<div class="tool-field"><label>输入数据（逗号/空格/换行分隔）：</label>'+
  '<textarea id="iqr-in">12 15 16 18 19 20 21 22 23 24 25 26 28 30 95</textarea></div>'+
  '<div class="tool-actions"><button class="btn" id="iqr-run">计算边界与异常值</button></div>'+
  '<div class="tool-result" id="iqr-out"></div>';
  el.querySelector('#iqr-run').onclick = ()=>{
    const d = parseNums(el.querySelector('#iqr-in').value).sort((a,b)=>a-b);
    const out = el.querySelector('#iqr-out');
    if(d.length<4){ out.innerHTML = '<div class="tool-msg err">请至少输入 4 个数值</div>'; return; }
    const q1=S.quantile(d,.25), q3=S.quantile(d,.75), iq=S.iqr(d);
    const lo=q1-1.5*iq, hi=q3+1.5*iq;
    const outl = d.filter(v=>v<lo||v>hi);
    const extreme = d.filter(v=>v<q1-3*iq||v>q3+3*iq);
    out.innerHTML = '<div class="result-grid">'+
      cell('Q1',S.fmt(q1,2))+cell('中位数',S.fmt(S.median(d),2))+cell('Q3',S.fmt(q3,2))+cell('IQR',S.fmt(iq,2))+
      cell('下边界',S.fmt(lo,2))+cell('上边界',S.fmt(hi,2))+cell('异常值数',outl.length)+cell('极端值数',extreme.length)+
      '</div>'+
      '<div class="tool-msg '+(outl.length?'err':'ok')+'">'+
      (outl.length? '检出异常值：'+outl.join(', ')+'（超出边界 '+S.fmt(lo,1)+' ~ '+S.fmt(hi,1)+'）<br>处理建议：先核对录入，再决定「修正 / 保留 / 缩尾」，并写入清洗日志。' :
      '未检出异常值：全部观测位于 '+S.fmt(lo,1)+' ~ '+S.fmt(hi,1)+' 内。')+'</div>';
  };
  el.querySelector('#iqr-run').click();
};

/* 04a：描述统计计算器 */
TOOLS['desc-stats'] = function(el){
  el.innerHTML =
  '<div class="tool-field"><label>输入数据（逗号/空格/换行分隔）：</label>'+
  '<textarea id="ds-in">34 29 35 41 28 33 37 30 44 32 36 31 39 27 33 38 35 40 30 36 32 34 37 33 31 42 28 35 39 36</textarea></div>'+
  '<div class="tool-actions"><button class="btn" id="ds-run">计算 + 绘图</button></div>'+
  '<div class="tool-result" id="ds-out"></div><div class="chart-box" id="ds-hist"></div><div class="chart-box" id="ds-box" style="height:180px"></div>';
  const run = ()=>{
    const d = parseNums(el.querySelector('#ds-in').value);
    const out = el.querySelector('#ds-out');
    const histEl = el.querySelector('#ds-hist'), boxEl = el.querySelector('#ds-box');
    [histEl, boxEl].forEach(e=>{ const c = echarts && echarts.getInstanceByDom(e); if(c) c.dispose(); });
    if(d.length<3){ out.innerHTML = '<div class="tool-msg err">请至少输入 3 个数值</div>'; return; }
    out.innerHTML = '<div class="result-grid">'+
      cell('样本量 n',d.length)+cell('均值',S.fmt(S.mean(d)))+cell('中位数',S.fmt(S.median(d)))+
      cell('标准差',S.fmt(S.std(d,1)))+cell('方差',S.fmt(S.variance(d,1)))+cell('极差',S.fmt(S.range(d)))+
      cell('IQR',S.fmt(S.iqr(d)))+cell('偏度',S.fmt(S.skewness(d)))+cell('峰度(超额)',S.fmt(S.kurtosis(d)))+
      cell('变异系数',S.fmt(S.cv(d)))+cell('最小值',S.fmt(S.min(d)))+cell('最大值',S.fmt(S.max(d)))+'</div>'+
      '<p class="chart-note">偏度>0 右偏（均值>中位数）；偏度<0 左偏（均值<中位数）。右偏时报告中位数 + IQR 更稳健。</p>';
    // 直方图
    const n = d.length, k = Math.min(30, Math.max(6, Math.round(1+3.322*Math.log10(n))));
    const lo = S.min(d), hi = S.max(d), w = (hi-lo)/k || 1;
    const bins = new Array(k).fill(0);
    d.forEach(v=>{ let i = Math.min(k-1, Math.floor((v-lo)/w)); bins[i]++; });
    const cats = bins.map((_,i)=>S.fmt(lo+i*w,1)+'~'+S.fmt(lo+(i+1)*w,1));
    const opt = baseChart();
    opt.tooltip = {trigger:'axis', axisPointer:{type:'shadow'}};
    opt.xAxis = {type:'category', data:cats, axisLabel:{color:axisColor(), rotate:30, fontSize:10}, axisLine:{lineStyle:{color:gridColor()}}};
    opt.yAxis = {type:'value', name:'频数', nameTextStyle:{color:axisColor()}, axisLabel:{color:axisColor()}, splitLine:{lineStyle:{color:gridColor()}}};
    opt.series = [{type:'bar', data:bins, itemStyle:{color:'#4f46e5', borderRadius:[4,4,0,0]}, barMaxWidth:28}];
    opt.grid = {left:44,right:16,top:24,bottom:56};
    chart(histEl, opt);
    // 箱线图
    const bopt = baseChart();
    bopt.tooltip = {trigger:'item'};
    bopt.xAxis = {type:'category', data:['数据'], axisLabel:{color:axisColor()}, axisLine:{lineStyle:{color:gridColor()}}};
    bopt.yAxis = {type:'value', axisLabel:{color:axisColor()}, splitLine:{lineStyle:{color:gridColor()}}};
    bopt.series = [{type:'boxplot', data:[[S.min(d),S.quantile(d,.25),S.median(d),S.quantile(d,.75),S.max(d)]],
      itemStyle:{color:'rgba(124,58,237,.25)', borderColor:'#7c3aed'}}];
    bopt.grid = {left:44,right:16,top:16,bottom:24};
    chart(boxEl, bopt);
  };
  el.querySelector('#ds-run').onclick = run;
  run();
};

/* 04b：分布形态实验室 */
TOOLS['dist-demo'] = function(el){
  el.innerHTML =
  '<div class="tool-actions">'+
    '<button class="btn sm" data-k="norm">🔔 正态分布</button>'+
    '<button class="btn sm ghost" data-k="skew">📈 右偏（对数正态）</button>'+
    '<button class="btn sm ghost" data-k="bi">🐫 双峰分布</button>'+
  '</div><div class="tool-result" id="dd-out"></div><div class="chart-box" id="dd-hist"></div>';
  const run = (kind)=>{
    const n = 600;
    let d;
    if(kind==='skew') d = S.randSkewed(n);
    else if(kind==='bi') d = S.randBimodal(n);
    else d = S.randNorm(n, 50, 12);
    const out = el.querySelector('#dd-out');
    out.innerHTML = '<div class="result-grid">'+
      cell('均值',S.fmt(S.mean(d),1))+cell('中位数',S.fmt(S.median(d),1))+
      cell('标准差',S.fmt(S.std(d,1),1))+cell('偏度',S.fmt(S.skewness(d)))+cell('峰度(超额)',S.fmt(S.kurtosis(d)))+'</div>'+
      '<p class="chart-note">观察要点：偏态时均值与中位数分离；双峰时均值落在两峰之间的“无人区”，此时必须看直方图而非只看均值。</p>';
    const histEl = el.querySelector('#dd-hist');
    const prev = echarts && echarts.getInstanceByDom(histEl); if(prev) prev.dispose();
    const k = 28, lo = S.min(d), hi = S.max(d), w = (hi-lo)/k;
    const bins = new Array(k).fill(0);
    d.forEach(v=>{ let i=Math.min(k-1, Math.floor((v-lo)/w)); bins[i]++; });
    const cats = bins.map((_,i)=>S.fmt(lo+i*w,1));
    const opt = baseChart();
    opt.tooltip = {trigger:'axis', axisPointer:{type:'shadow'}};
    opt.xAxis = {type:'category', data:cats, axisLabel:{color:axisColor(), rotate:30, fontSize:9, interval:3}, axisLine:{lineStyle:{color:gridColor()}}};
    opt.yAxis = {type:'value', name:'频数', nameTextStyle:{color:axisColor()}, axisLabel:{color:axisColor()}, splitLine:{lineStyle:{color:gridColor()}}};
    opt.series = [{type:'bar', data:bins, itemStyle:{color: kind==='skew'?'#f59e0b':(kind==='bi'?'#10b981':'#4f46e5'), borderRadius:[3,3,0,0]}}];
    opt.grid = {left:44,right:16,top:24,bottom:48};
    chart(histEl, opt);
  };
  el.querySelectorAll('button').forEach(b=>b.onclick = ()=>{ run(b.dataset.k); });
  run('norm');
};

/* 05a：Cronbach's α */
TOOLS['alpha-calc'] = function(el){
  el.innerHTML =
  '<div class="tool-field"><label>输入题项得分矩阵（每行一个被试，题项间用逗号/空格分隔，5 点 Likert）：</label>'+
  '<textarea id="ac-in" style="min-height:150px">4 5 4 3 4\n5 4 4 5 4\n3 4 5 4 3\n4 4 4 4 5\n5 5 4 4 4\n3 3 4 3 4\n4 5 5 4 3\n2 3 3 2 4\n4 4 3 4 4\n5 4 5 3 5</textarea></div>'+
  '<div class="tool-actions"><button class="btn" id="ac-run">计算 α</button></div>'+
  '<div class="tool-result" id="ac-out"></div>';
  el.querySelector('#ac-run').onclick = ()=>{
    const mat = parseMatrix(el.querySelector('#ac-in').value);
    const out = el.querySelector('#ac-out');
    if(!mat.length || mat.some(r=>r.length!==mat[0].length)){
      out.innerHTML = '<div class="tool-msg err">格式错误：每行题数必须一致，且至少 2 题 × 3 个被试</div>'; return;
    }
    const r = S.cronbachAlpha(mat);
    if(!isFinite(r.alpha)){ out.innerHTML = '<div class="tool-msg err">计算失败：请检查数据（如所有被试得分相同）</div>'; return; }
    const verdict = r.alpha>=0.9?'优秀':(r.alpha>=0.8?'良好':(r.alpha>=0.7?'可接受':(r.alpha>=0.6?'偏低':'不合格')));
    let rows = r.drop.map((a,i)=>'<tr><td>删除第 '+(i+1)+' 题</td><td><b>'+S.fmt(a,3)+'</b></td><td>'+(a>r.alpha?'<b style="color:var(--ok)">α 提升 ↑</b>':'α 下降')+'</td></tr>').join('');
    out.innerHTML = '<div class="result-grid">'+cell('被试数',r.n)+cell('题项数',r.k)+
      '<div class="stat-cell"><div class="v" style="font-size:26px">'+S.fmt(r.alpha,3)+'</div><div class="k">Cronbach\'s α · '+verdict+'</div></div></div>'+
      '<div class="table-wrap"><table><thead><tr><th>敏感性分析</th><th>删除该项后的 α</th><th>方向</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
      '<p class="chart-note">若「删除某项后的 α」明显高于总量表 α，说明该项与维度不一致，考虑修订或删除。α 判定：≥0.9 优秀 / 0.8-0.9 良好 / 0.7-0.8 可接受 / <0.6 不合格。</p>';
  };
  el.querySelector('#ac-run').click();
};

/* 05b：t 检验演示 */
TOOLS['ttest-demo'] = function(el){
  el.innerHTML =
  '<div class="tool-grid">'+
    '<div class="tool-field"><label>第 1 组数据：</label><textarea id="tt-a">22 24 21 25 23 26 24 22 25 23 24 26 22 25 24</textarea></div>'+
    '<div class="tool-field"><label>第 2 组数据：</label><textarea id="tt-b">19 20 21 18 22 19 20 21 18 22 20 19 21 18 20</textarea></div>'+
  '</div><div class="tool-actions"><button class="btn" id="tt-run">Welch t 检验</button></div>'+
  '<div class="tool-result" id="tt-out"></div><div class="chart-box" id="tt-box" style="height:230px"></div>';
  const run = ()=>{
    const a = parseNums(el.querySelector('#tt-a').value), b = parseNums(el.querySelector('#tt-b').value);
    const out = el.querySelector('#tt-out');
    const boxEl = el.querySelector('#tt-box');
    const prev = echarts && echarts.getInstanceByDom(boxEl); if(prev) prev.dispose();
    if(a.length<3||b.length<3){ out.innerHTML = '<div class="tool-msg err">每组至少 3 个数值</div>'; return; }
    const r = S.welchTTest(a,b);
    const sig = r.p<0.05?'显著':'不显著';
    const dMag = Math.abs(r.d)<0.2?'微小':(Math.abs(r.d)<0.5?'小':(Math.abs(r.d)<0.8?'中等':'大'));
    out.innerHTML = '<div class="result-grid">'+
      cell('t 值',S.fmt(r.t)) + cell('自由度 df',S.fmt(r.df,1)) + cell('p 值',S.fmt(r.p,4)) +
      cell('均值差',S.fmt(r.mx-r.my)) + cell('组1均值',S.fmt(r.mx)) + cell('组2均值',S.fmt(r.my)) +
      cell('Cohen\'s d',S.fmt(r.d)) + cell('结论',(sig?'差异显著':'无显著差异')) +'</div>'+
      '<div class="tool-msg '+(sig?'ok':'err')+'">Welch 修正 t 检验（不假设方差相等）：t('+S.fmt(r.df,1)+') = '+S.fmt(r.t)+
      ', p = '+S.fmt(r.p,4)+' → 两组均值差异在 5% 水平上'+sig+'；效应量 d = '+S.fmt(r.d)+'（'+dMag+'）。</div>';
    const bopt = baseChart();
    bopt.tooltip = {trigger:'item'};
    bopt.xAxis = {type:'category', data:['第 1 组 (n='+a.length+')','第 2 组 (n='+b.length+')'], axisLabel:{color:axisColor()}, axisLine:{lineStyle:{color:gridColor()}}};
    bopt.yAxis = {type:'value', axisLabel:{color:axisColor()}, splitLine:{lineStyle:{color:gridColor()}}};
    bopt.series = [{type:'boxplot',
      data:[[[S.min(a),S.quantile(a,.25),S.median(a),S.quantile(a,.75),S.max(a)]],
            [[S.min(b),S.quantile(b,.25),S.median(b),S.quantile(b,.75),S.max(b)]]],
      itemStyle:{color:'rgba(79,70,229,.22)', borderColor:'#4f46e5'}}];
    bopt.grid = {left:44,right:16,top:20,bottom:30};
    chart(boxEl, bopt);
  };
  el.querySelector('#tt-run').onclick = run;
  run();
};

/* 05c：卡方检验 */
TOOLS['chisq-demo'] = function(el){
  el.innerHTML =
  '<div class="tool-field"><label>列联表规模：</label><select id="cs-r"><option value="2">2 行</option><option value="3">3 行</option></select> × '+
  '<select id="cs-c"><option value="2">2 列</option><option value="3">3 列</option></select></div>'+
  '<div class="matrix-grid" id="cs-m"></div>'+
  '<div class="tool-actions"><button class="btn" id="cs-run">计算卡方</button></div>'+
  '<div class="tool-result" id="cs-out"></div>';
  const mk = ()=>{
    const r = +el.querySelector('#cs-r').value, c = +el.querySelector('#cs-c').value;
    const def = [[40,12],[28,22],[15,18],[10,25]];
    const g = el.querySelector('#cs-m');
    g.style.gridTemplateColumns = 'repeat('+c+',62px)';
    g.innerHTML = '';
    for(let i=0;i<r;i++) for(let j=0;j<c;j++){
      const inp = document.createElement('input');
      inp.type = 'number'; inp.min = '0'; inp.id = 'cs-x-'+i+'-'+j;
      inp.value = (def[i]&&def[i][j]!==undefined)?def[i][j]:Math.round(20+Math.random()*20);
      g.appendChild(inp);
    }
  };
  el.querySelector('#cs-r').onchange = mk; el.querySelector('#cs-c').onchange = mk;
  el.querySelector('#cs-run').onclick = ()=>{
    const r = +el.querySelector('#cs-r').value, c = +el.querySelector('#cs-c').value;
    const table = [];
    for(let i=0;i<r;i++){ const row=[]; for(let j=0;j<c;j++) row.push(+el.querySelector('#cs-x-'+i+'-'+j).value||0); table.push(row); }
    const res = S.chi2Indep(table);
    const out = el.querySelector('#cs-out');
    out.innerHTML = '<div class="result-grid">'+
      cell('χ²',S.fmt(res.chi2))+cell('自由度',res.df)+cell('p 值',S.fmt(res.p,4))+
      cell('Cramér\'s V',S.fmt(res.v))+cell('最小期望频数',S.fmt(res.minE,2))+cell('结论',res.p<0.05?'两变量相关':'未发现关联')+'</div>'+
      '<div class="tool-msg '+(res.p<0.05?'ok':'err')+'">χ²('+res.df+') = '+S.fmt(res.chi2)+', p = '+S.fmt(res.p,4)+
      (res.minE<5?'<br>⚠ 存在期望频数 <5 的单元格，小样本建议改用 Fisher 精确检验。':'')+'</div>';
  };
  mk();
};

/* 06：相关与回归演示 */
TOOLS['corr-reg-demo'] = function(el){
  el.innerHTML =
  '<div class="tool-grid">'+
    '<div class="tool-field"><label>X 变量：</label><textarea id="cr-x">45 50 55 60 65 70 75 80 85 90 52 58 63 68 73 78 83 88 93 98 47 54 61 66 71</textarea></div>'+
    '<div class="tool-field"><label>Y 变量（与 X 一一对应）：</label><textarea id="cr-y">58 63 60 70 68 74 76 80 84 88 62 66 70 74 78 82 84 90 94 97 59 64 67 72 75</textarea></div>'+
  '</div><div class="tool-actions"><button class="btn" id="cr-run">计算相关 + 拟合回归</button></div>'+
  '<div class="tool-result" id="cr-out"></div><div class="chart-box" id="cr-chart"></div>';
  el.querySelector('#cr-run').onclick = ()=>{
    const x = parseNums(el.querySelector('#cr-x').value), y = parseNums(el.querySelector('#cr-y').value);
    const out = el.querySelector('#cr-out');
    const cEl = el.querySelector('#cr-chart');
    const prev = echarts && echarts.getInstanceByDom(cEl); if(prev) prev.dispose();
    if(x.length!==y.length || x.length<3){ out.innerHTML = '<div class="tool-msg err">X 与 Y 数量必须一致，且至少 3 对</div>'; return; }
    const r = S.corrPearson(x,y), rho = S.corrSpearman(x,y), m = S.linReg(x,y);
    const rMag = Math.abs(r)<0.3?'弱':(Math.abs(r)<0.5?'中等':'强');
    out.innerHTML = '<div class="result-grid">'+
      cell('Pearson r',S.fmt(r))+cell('Spearman ρ',S.fmt(rho))+cell('R²',S.fmt(m.r2))+
      cell('截距 β₀',S.fmt(m.b0))+cell('斜率 β₁',S.fmt(m.b1))+cell('β₁ 标准误',S.fmt(m.seB1))+
      cell('线性强度',rMag)+'</div>'+
      '<p class="chart-note">回归方程：ŷ = '+S.fmt(m.b0)+' + '+S.fmt(m.b1)+'·x。X 每增加 1 单位，Y 平均变化 '+S.fmt(m.b1)+' 单位；模型解释 '+S.fmt(m.r2*100,1)+'% 的 Y 方差。若 ρ 明显高于 r，提示存在非线性单调关系。</p>';
    const sorted = x.map((v,i)=>[v,y[i]]).sort((a,b)=>a[0]-b[0]);
    const xs = sorted.map(d=>d[0]), ys = sorted.map(d=>d[1]);
    const fit = xs.map(v=>m.b0+m.b1*v);
    const opt = baseChart();
    opt.tooltip = {trigger:'item', formatter: p=>'('+S.fmt(p.value[0],1)+', '+S.fmt(p.value[1],1)+')'};
    opt.legend = {top:0, textStyle:{color:axisColor()}};
    opt.xAxis = {type:'value', name:'X', nameTextStyle:{color:axisColor()}, axisLabel:{color:axisColor()}, splitLine:{lineStyle:{color:gridColor()}}};
    opt.yAxis = {type:'value', name:'Y', nameTextStyle:{color:axisColor()}, axisLabel:{color:axisColor()}, splitLine:{lineStyle:{color:gridColor()}}};
    opt.series = [
      {name:'观测值', type:'scatter', data:xs.map((v,i)=>[v,ys[i]]), itemStyle:{color:'#4f46e5', opacity:.75}, symbolSize:8},
      {name:'回归拟合线', type:'line', data:xs.map((v,i)=>[v,fit[i]]), showSymbol:false, lineStyle:{color:'#ef4444', width:2.5}}
    ];
    opt.grid = {left:52,right:20,top:34,bottom:46};
    chart(cEl, opt);
  };
  el.querySelector('#cr-run').click();
};

/* 07：事件研究演示 */
TOOLS['event-study-demo'] = function(el){
  el.innerHTML =
  '<div class="tool-field"><label>事件窗口（相对事件日 t=0）：</label><select id="es-win">'+
    '<option value="-5,10">[-5, +10] 宽窗（政策类）</option><option value="-3,3">[-3, +3] 窄窗（公告类）</option>'+
    '<option value="-10,20">[-10, +20] 长期窗</option></select></div>'+
  '<div class="tool-actions"><button class="btn" id="es-run">生成模拟 AR / CAR</button></div>'+
  '<div class="chart-box" id="es-chart"></div><div class="tool-result" id="es-out"></div>';
  const run = ()=>{
    const [w0,w1] = el.querySelector('#es-win').value.split(',').map(Number);
    const days = [];
    for(let t=w0;t<=w1;t++) days.push(t);
    // 模拟：估计窗噪声 + 事件后正向漂移
    let seed = 12345;
    const rng = ()=>{ seed = (seed*1664525+1013904223)>>>0; return seed/4294967296; };
    const ar = days.map(t=> (rng()-0.5)*1.1 + (t>=0? 0.5 + (t===0?0.9:0) + (t>0? 0.05*t:0) : 0));
    const car = []; let acc = 0;
    ar.forEach((v,i)=>{ acc+=v; car.push(acc); });
    const cEl = el.querySelector('#es-chart');
    const prev = echarts && echarts.getInstanceByDom(cEl); if(prev) prev.dispose();
    const opt = baseChart();
    opt.tooltip = {trigger:'axis'};
    opt.legend = {top:0, textStyle:{color:axisColor()}};
    opt.xAxis = {type:'category', data:days.map(t=>'t'+(t>0?'+':'')+t), axisLabel:{color:axisColor()}, axisLine:{lineStyle:{color:gridColor()}}};
    opt.yAxis = {type:'value', name:'收益（%）', nameTextStyle:{color:axisColor()}, axisLabel:{color:axisColor()}, splitLine:{lineStyle:{color:gridColor()}}};
    opt.series = [
      {name:'AR 异常收益', type:'bar', data:ar.map(v=>+v.toFixed(2)), itemStyle:{color:'#0ea5e9', borderRadius:[3,3,0,0]}},
      {name:'CAR 累计异常收益', type:'line', data:car.map(v=>+v.toFixed(2)), smooth:true, lineStyle:{color:'#ef4444', width:3}, itemStyle:{color:'#ef4444'}}
    ];
    chart(cEl, opt);
    const tCAR = S.fmt(car[car.length-1],2);
    el.querySelector('#es-out').innerHTML =
      '<div class="result-grid">'+cell('事件窗', '['+w0+', +'+w1+']')+cell('CAR('+w0+',+'+w1+')', tCAR+'%')+
      cell('AR(t=0)', S.fmt(ar[-w0],2)+'%')+cell('方向', acc>0?'正向反应':'负向反应')+'</div>'+
      '<p class="chart-note">演示逻辑：事件日 t=0 出现跳跃式 AR，随后逐期漂移，CAR 持续上升 → 事件产生显著正向影响。真实研究中需以估计窗拟合市场模型、做横截面 t 检验（Patell/BMP）并报告多窗口稳健性。</p>';
  };
  el.querySelector('#es-run').onclick = run;
  run();
};

/* 08：结果核验清单 */
TOOLS['robust-check'] = function(el){
  const items = [
    ['1','研究问题与假设','研究问题清晰可检验；H0/H1 已事先声明，未事后改口径'],
    ['2','数据质量','缺失/重复/异常已按规范处理；清洗日志完整可复现'],
    ['3','样本描述','样本量、纳入/排除标准、描述统计已报告；分布形态已检查'],
    ['4','方法匹配','方法与变量类型、数据结构匹配；关键假设已检验（正态/方差/线性）'],
    ['5','模型诊断','共线性（VIF）、异方差、残差诊断已完成并处理'],
    ['6','稳健性','替换变量/缩尾/子样本/安慰剂等检验已做，核心结论稳定'],
    ['7','显著性解读','p 值、置信区间、效应量三者一致；显著性星号口径已声明'],
    ['8','因果纪律','相关与因果表述区分；因果主张有识别策略支撑'],
    ['9','图表规范','图表黑白可读、单位齐全、矢量导出；三线表规范'],
    ['10','可复现交付','数据、脚本、日志、结果表归档在工作空间，他人可复跑']
  ];
  el.innerHTML = '<div class="check-progress" id="rc-prog"></div>'+
    items.map((it,i)=>
      '<label class="check-item'+(store.robcheck[i]?' on':'')+'"><input type="checkbox" data-i="'+i+'" '+(store.robcheck[i]?'checked':'')+'> <span><b>'+it[0]+'. '+it[1]+'</b> — '+it[2]+'</span></label>').join('')+
    '<p class="chart-note">状态自动保存在本地。建议：每次交付报告前逐项核对；全部通过后方可定稿。</p>';
  const upd = ()=>{
    const n = store.robcheck.filter(Boolean).length;
    el.querySelector('#rc-prog').innerHTML = '已核验 <b style="color:var(--primary2)">'+n+'</b> / '+items.length+
      ' <span style="margin-left:10px">'+(n===items.length?'✅ 全部通过，可交付':'继续核验中…')+'</span>';
  };
  el.querySelectorAll('input').forEach(inp=>{
    inp.onchange = ()=>{
      store.robcheck[+inp.dataset.i] = inp.checked;
      inp.closest('.check-item').classList.toggle('on', inp.checked);
      save(); upd();
      if(store.robcheck.filter(Boolean).length===items.length) toast('核验清单全部通过 🎉');
    };
  });
  upd();
};

function cell(k,v){ return '<div class="stat-cell"><div class="v">'+v+'</div><div class="k">'+esc(k)+'</div></div>'; }

/* ================= 搜索 ================= */
function doSearch(q){
  const kw = q.toLowerCase();
  if(!kw){ renderSidebar(''); handleRoute(); return; }
  renderSidebar(kw);
  const hits = [];
  COURSES.forEach(c=>{
    if((c.title+c.tag+c.subtitle).toLowerCase().includes(kw)) hits.push({c, sec:-1, label:'课程：'+c.no+' '+c.title});
    c.sections.forEach((sec,si)=>{
      if(sec.h.toLowerCase().includes(kw)) hits.push({c, sec:si, label:'小节：'+sec.h});
    });
    (c.faq||[]).forEach(f=>{
      if(f.q.toLowerCase().includes(kw)) hits.push({c, sec:-2, label:'问答：'+f.q});
    });
  });
  const box = $('#content');
  if(!hits.length){ box.innerHTML = '<div class="empty-search">🔍 未找到与「'+esc(q)+'」相关的内容<br><br><button class="btn ghost" id="backFromSearch">返回课程</button></div>'; }
  else{
    box.innerHTML = '<div class="objectives"><h3>🔍 搜索结果：'+hits.length+' 条</h3></div>'+
      hits.slice(0,50).map(h=>{
        const secIdx = h.sec>=0?h.sec:(h.sec===-2?'faq':null);
        return '<div class="search-result-item" data-c="'+h.c.id+'" data-s="'+h.sec+'">'+
          '<span class="tag">'+h.c.no+' '+esc(h.c.tag)+'</span><h4>'+esc(h.label)+'</h4>'+
          '<p>'+esc(h.c.title)+'</p></div>';
      }).join('');
    box.querySelectorAll('.search-result-item').forEach(it=>{
      it.onclick = ()=>{
        const id = it.dataset.c, s = +it.dataset.s;
        pendingScroll = {course:id, sec:s};
        goTo(id);
      };
    });
  }
  const back = $('#backFromSearch');
  if(back) back.onclick = ()=>{ $('#searchBox').value=''; renderSidebar(''); handleRoute(); };
}

/* ================= 侧栏抽屉（移动端） ================= */
let maskEl = null;
function ensureMask(){
  if(!maskEl){ maskEl = document.createElement('div'); maskEl.id = 'mask'; document.body.appendChild(maskEl); }
  return maskEl;
}
function openSidebar(){
  const sb = $('#sidebar');
  sb.classList.add('open'); ensureMask().classList.add('show');
  document.body.classList.add('nav-open');
}
function closeSidebar(){
  const sb = $('#sidebar');
  sb.classList.remove('open');
  if(maskEl) maskEl.classList.remove('show');
  document.body.classList.remove('nav-open');
}
function toggleSidebar(){ $('#sidebar').classList.contains('open') ? closeSidebar() : openSidebar(); }

/* ================= 学习报告 ================= */
function reportHTML(){
  const done = COURSES.filter(c=>store.completed[c.id]);
  const rows = COURSES.map(c=>{
    const best = store.quizBest[c.id];
    return '<tr><td>'+c.no+' '+esc(c.title)+'</td><td>'+(store.completed[c.id]?'✅ 已完成':'⬜ 未完成')+'</td>'+
      '<td>'+(best!==undefined?best+' 分':'—')+'</td></tr>';
  }).join('');
  const robN = store.robcheck.filter(Boolean).length;
  const avg = (()=>{ const s = COURSES.map(c=>store.quizBest[c.id]).filter(x=>x!==undefined);
    return s.length? Math.round(s.reduce((a,b)=>a+b,0)/s.length) : null; })();
  return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>学习报告</title><style>'+
    'body{font-family:"PingFang SC","Microsoft YaHei",sans-serif;padding:40px 30px;color:#1c2233;font-size:14px;line-height:1.8;max-width:820px;margin:0 auto}'+
    '@media(max-width:600px){body{padding:18px 14px;font-size:13px}}'+
    'h1{font-size:22px;border-bottom:3px solid #4f46e5;padding-bottom:10px}'+
    'table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}'+
    'th{background:#f0f2ff;text-align:left;padding:9px 12px;border-bottom:2px solid #c7cdf5}'+
    'td{padding:8px 12px;border-bottom:1px solid #e4e7f2}'+
    '.meta{background:#f7f8ff;border-left:4px solid #4f46e5;padding:12px 16px;margin:14px 0}'+
    'button{padding:10px 22px;background:#4f46e5;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;margin-right:8px}'+
    '@media print{.noprint{display:none}}</style></head><body>'+
    '<h1>📊 WorkBuddy 数据统计分析学院 · 学习报告</h1>'+
    '<div class="meta">生成时间：'+new Date().toLocaleString('zh-CN')+'<br>'+
    '学习进度：'+done.length+' / '+COURSES.length+' 模块'+
    (avg!==null? ' ｜ 测验平均分：'+avg+' 分':'')+' ｜ 结果核验清单：'+robN+' / 10 项通过</div>'+
    '<h2>课程完成情况</h2><table><thead><tr><th>模块</th><th>状态</th><th>测验最高分</th></tr></thead><tbody>'+rows+'</tbody></table>'+
    '<h2>学习建议</h2><ul>'+
    (done.length<COURSES.length?'<li>尚有 '+(COURSES.length-done.length)+' 个模块未完成，建议按顺序继续学习。</li>':'<li>全部模块已完成，建议结合真实数据完成一个完整项目练习。</li>')+
    (robN<10?'<li>结果核验清单还有 '+(10-robN)+' 项未通过，交付分析前请逐项核对。</li>':'<li>结果核验清单全部通过，具备规范的交付习惯。</li>')+
    '<li>建议：用一份真实数据走完 六阶段工作流（需求→接入→清洗→探索→建模→报告）。</li></ul>'+
    '<button class="noprint" onclick="window.print()">🖨 打印 / 存为 PDF</button>'+
    '<button class="noprint" onclick="downloadSelf()">⬇ 下载报告文件</button>'+
    '<script>function downloadSelf(){var b=new Blob([document.documentElement.outerHTML],{type:"text/html;charset=utf-8"});'+
    'var a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="WorkBuddy学习报告.html";a.click();}<\/script>'+
    '</body></html>';
}
function exportReport(){
  const w = window.open('', '_blank');
  if(!w){
    // 弹窗被拦截（手机浏览器常见）：改为直接下载报告文件
    downloadReport();
    return;
  }
  w.document.write(reportHTML());
  w.document.close();
}
function downloadReport(){
  const blob = new Blob([reportHTML()], {type:'text/html;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'WorkBuddy学习报告_' + new Date().toISOString().slice(0,10) + '.html';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 3000);
  toast('学习报告已下载（浏览器打开即可查看/打印）');
}

/* ================= 事件绑定 ================= */
window.addEventListener('hashchange', ()=>{ closeSidebar(); handleRoute(); });
window.addEventListener('resize', ()=>{ if(window.innerWidth>920) closeSidebar(); resizeCharts(); });
document.addEventListener('DOMContentLoaded', ()=>{
  // 主题
  let theme = 'light';
  try{ theme = localStorage.getItem('wb-stats-theme') || 'light'; }catch(e){}
  document.body.dataset.theme = theme;
  $('#themeBtn').textContent = theme==='dark'?'☀️':'🌙';
  $('#themeBtn').onclick = ()=>{
    const next = isDark()?'light':'dark';
    document.body.dataset.theme = next;
    try{ localStorage.setItem('wb-stats-theme', next); }catch(e){}
    $('#themeBtn').textContent = next==='dark'?'☀️':'🌙';
    if(currentCourseId) renderCourse(currentCourseId);
    else handleRoute();
  };
  // 搜索
  const sb = $('#searchBox');
  sb.addEventListener('input', ()=>{ renderSidebar(sb.value); });
  sb.addEventListener('keydown', e=>{ if(e.key==='Enter') doSearch(sb.value.trim()); });
  sb.addEventListener('search', ()=>{ if(!sb.value) handleRoute(); });
  // 菜单（移动端抽屉）
  $('#menuBtn').onclick = toggleSidebar;
  $('#sideClose').onclick = closeSidebar;
  ensureMask();
  maskEl.addEventListener('click', closeSidebar);
  // 抽屉内滑动不穿透背景
  $('#sidebar').addEventListener('touchmove', e=>{ if($('#sidebar').classList.contains('open')) e.stopPropagation(); }, {passive:true});
  $('#reportBtn').onclick = exportReport;
  // 首屏
  renderSidebar('');
  handleRoute();
  if(!location.hash && COURSES[0]) location.replace('#/course/'+COURSES[0].id);
});
})();
