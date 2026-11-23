/* ============================================================
 * app.js —— 平台主逻辑：登录/角色/路由/实时仿真/视图渲染
 * ============================================================ */
(function () {
  'use strict';

  /* ================= 状态 ================= */
  var state = {
    role: null,            // farmer | merchant | coop | consumer
    view: 'dashboard',
    priceVariety: 'gw',    // 价格页当前品种
    radarSel: ['gw', 'nmc'], // 品种对比选择
    townSel: 'gzz',
    tickerCount: 0,
    logs: []
  };

  /* 移动端检测（扫码手机直入场景） */
  var IS_MOBILE = window.matchMedia && window.matchMedia('(max-width: 860px)').matches;

  var ROLE_META = {
    farmer: {
      name: '农户', sub: '种植端 · 留果与上市决策', icon: '🌱', color: '#2FA36B',
      demo: '演示场景：查看果园留果建议与滞销预警 → 用“AI 决策”向智能体提问“我家20亩桂味什么时候摘”',
      nav: ['dashboard', 'decision', 'price', 'production', 'regions', 'varieties', 'sales', 'knowledge'],
      welcome: '您好，柏桥村何叔！智能体已为您更新 3 条今日建议。'
    },
    merchant: {
      name: '商户', sub: '销售端 · 选品与货源匹配', icon: '🛒', color: '#D92B4B',
      demo: '演示场景：首页查看今日爆款榜 → “销量统计”看选品清单与货源匹配 → “价格预测”定价格带',
      nav: ['dashboard', 'decision', 'sales', 'price', 'varieties', 'knowledge', 'production', 'regions'],
      welcome: '您好，荔直播选品团队！今日 6 款爆款清单已生成，货源已匹配。'
    },
    coop: {
      name: '合作社', sub: '流通端 · 收购与冷链调度', icon: '🏢', color: '#2F6FED',
      demo: '演示场景：首页查看收购计划与预警 → “产量统计”看产区进度 → “AI 决策”看调度与加工对接',
      nav: ['dashboard', 'decision', 'production', 'regions', 'price', 'sales', 'varieties', 'knowledge'],
      welcome: '您好，柏桥合作社！明日收购计划与冷链拼车线路已排定。'
    },
    consumer: {
      name: '消费者', sub: '消费端 · 选购与溯源', icon: '🧺', color: '#8B5CF6',
      demo: '演示场景：“品种介绍”看当季品种对比 → “价格预测”看什么时候买划算 → “知识普及”学挑荔技巧',
      nav: ['dashboard', 'varieties', 'price', 'knowledge', 'regions', 'sales', 'production', 'decision'],
      welcome: '欢迎来到粤西荔枝直供平台！本周桂味与糯米糍正处最佳赏味期。'
    }
  };

  var VIEW_META = {
    dashboard: { name: '产销驾驶舱', icon: '📊', desc: '产区产销实时总览' },
    decision: { name: 'AI 智能决策', icon: '🤖', desc: '智能体建议书与滞销预警' },
    varieties: { name: '品种介绍', icon: '🍒', desc: '六大主栽品种档案与对比' },
    regions: { name: '产区分布', icon: '🗺️', desc: '主产镇分布与产地行情' },
    production: { name: '产量统计', icon: '📈', desc: '大小年产量与上市进度' },
    sales: { name: '销量统计', icon: '🛍️', desc: '渠道销量与爆款榜单' },
    price: { name: '价格预测', icon: '💰', desc: '品种级价格走势与区间预测' },
    knowledge: { name: '知识普及', icon: '📚', desc: '产销知识与科普课堂' }
  };

  /* ================= 工具 ================= */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 10);
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { t.remove(); }, 400);
    }, 3400);
  }
  function nowHM() { var d = new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
  function nowHMS() { var d = new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function rndi(a, b) { return Math.round(rnd(a, b)); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function jitter(v, pct) { return Math.round(v * (1 + rnd(-pct, pct)) * 100) / 100; }
  function fmt(v, d) { d = d == null ? 0 : d; return Number(v).toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d }); }

  /* ================= 时钟 ================= */
  function startClock() {
    var f = function () {
      var elC = $('#topClock');
      if (elC) elC.textContent = new Date().toLocaleString('zh-CN', { hour12: false });
    };
    f();
    setInterval(f, 1000);
  }

  /* ================= 登录 ================= */
  function renderLogin() {
    var d = DATA.region;
    var rolesHtml = Object.keys(ROLE_META).map(function (k) {
      var m = ROLE_META[k];
      return '<div class="role-card" data-role="' + k + '">' +
        '<div class="role-icon" style="background:' + m.color + '1A;color:' + m.color + '">' + m.icon + '</div>' +
        '<div class="role-name">' + m.name + '</div>' +
        '<div class="role-sub">' + m.sub + '</div>' +
        '<div class="role-enter">进入平台 →</div>' +
        '</div>';
    }).join('');
    $('#loginView').innerHTML =
      '<div class="login-wrap">' +
      '  <div class="login-brand">' +
      '    <div class="brand-badge">攀登计划 · 校赛决赛演示</div>' +
      '    <h1>荔枝产销协同决策<br><span>智能体平台</span></h1>' +
      '    <p class="brand-slogan">从“爆款挖掘”到“滞销解困”<br>AI智能体赋能粤西特色农产品产销协同路径研究</p>' +
      '    <div class="brand-stats">' +
      '      <div><b>' + d.area + '</b><span>万亩种植面积</span></div>' +
      '      <div><b>' + d.yield + '</b><span>万吨年产量</span></div>' +
      '      <div><b>' + d.chainValue + '</b><span>亿元全产业链产值</span></div>' +
      '    </div>' +
      '    <p class="brand-note">高州市 · 全球最大连片荔枝种植基地 · 广东“百千万工程”首批典型县（创先类）</p>' +
      '    <p class="brand-credit">东莞城市学院商学院 · 汇报人：许斯豪</p>' +
      '  </div>' +
      '  <div class="login-panel">' +
      '    <h2>选择角色进入平台</h2>' +
      '    <p class="login-sub">同一数据底座 · 不同角色的信息需求与使用场景</p>' +
      '    <div class="role-grid">' + rolesHtml + '</div>' +
      '    <div class="login-demo">' +
      '      <span>💡</span> 演示模式：全部为模拟数据，点击角色卡片一键进入对应视角' +
      '    </div>' +
      '    <button class="btn-ghost" id="btnVisitor">以游客身份浏览（消费者视角）</button>' +
      '  </div>' +
      '</div>' +
      '<div class="login-foot">数据感知 → 需求预测 → 爆款挖掘 → 滞销预警 → 决策生成 ｜ 指导老师：毛新平 · 孙湘晓 · 韩江键</div>';
    $$('.role-card').forEach(function (c) {
      c.addEventListener('click', function () { login(c.getAttribute('data-role')); });
    });
    $('#btnVisitor').addEventListener('click', function () { login('consumer'); });
  }

  function login(role) {
    state.role = role;
    $('#loginView').style.display = 'none';
    $('#appView').style.display = 'flex';
    renderShell();
    navigate('dashboard');
    startRealtime();
  }

  function logout() {
    state.role = null;
    $('#appView').style.display = 'none';
    $('#loginView').style.display = 'flex';
  }

  /* ================= 外壳 ================= */
  function renderShell() {
    var m = ROLE_META[state.role];
    var navHtml = m.nav.map(function (v) {
      return '<a class="nav-item" data-view="' + v + '">' +
        '<span class="nav-icon">' + VIEW_META[v].icon + '</span>' +
        '<span>' + VIEW_META[v].name + '</span></a>';
    }).join('');
    var rolesHtml = Object.keys(ROLE_META).map(function (k) {
      return '<option value="' + k + '"' + (k === state.role ? ' selected' : '') + '>' + ROLE_META[k].icon + ' ' + ROLE_META[k].name + '端</option>';
    }).join('');
    /* 移动端抽屉内角色切换按钮 */
    var sideRolesHtml = Object.keys(ROLE_META).map(function (k) {
      var rm = ROLE_META[k];
      return '<button class="side-role' + (k === state.role ? ' on' : '') + '" data-rolebtn="' + k + '" style="--rc:' + rm.color + '">' +
        rm.icon + ' ' + rm.name + '</button>';
    }).join('');
    $('#appView').innerHTML =
      '<aside class="sidebar" id="sidebar">' +
      '  <div class="logo">' +
      '    <div class="logo-mark">荔</div>' +
      '    <div class="logo-txt"><b>荔枝产销协同</b><span>智能体决策平台</span></div>' +
      '  </div>' +
      '  <div class="role-chip" style="border-color:' + m.color + ';background:' + m.color + '14">' +
      '    <span style="font-size:20px">' + m.icon + '</span>' +
      '    <div><b>' + m.name + '</b><span style="color:' + m.color + '">' + m.sub + '</span></div>' +
      '  </div>' +
      '  <nav class="nav">' + navHtml + '</nav>' +
      '  <div class="side-roles">' +
      '    <div class="side-roles-title">切换角色视角</div>' +
      '    <div class="side-roles-grid">' + sideRolesHtml + '</div>' +
      '  </div>' +
      '  <div class="side-foot">' +
      '    <div class="pulse-dot"></div> 数据流 · 实时仿真中' +
      '  </div>' +
      '</aside>' +
      '<div class="drawer-mask" id="drawerMask"></div>' +
      '<div class="main">' +
      '  <header class="topbar">' +
      '    <button class="btn-mini ghost btn-menu" id="btnMenu" aria-label="打开导航">☰</button>' +
      '    <div class="top-title">' +
      '      <h2 id="viewTitle">' + VIEW_META[state.view].name + '</h2>' +
      '      <span id="viewDesc">' + VIEW_META[state.view].desc + '</span>' +
      '    </div>' +
      '    <div class="top-right">' +
      '      <div class="sim-badge">🟢 2026产季 · 实时仿真</div>' +
      '      <div class="clock" id="topClock"></div>' +
      '      <div class="update-badge"><span class="pulse-dot"></span>数据更新于 <b id="updateTime">06-18 14:32:05</b></div>' +
      '      <select class="role-switch" id="roleSwitch">' + rolesHtml + '</select>' +
      '      <button class="btn-mini" id="btnGuide">演示指引</button>' +
      '      <button class="btn-mini ghost" id="btnLogout">退出</button>' +
      '    </div>' +
      '  </header>' +
      '  <main class="content" id="viewRoot"></main>' +
      '  <footer class="foot">' +
      '    <span>攀登计划校赛决赛演示 ｜ 东莞城市学院商学院 · 许斯豪团队 ｜ 指导教师：毛新平 · 孙湘晓 · 韩江键</span>' +
      '    <span>⚠ 本平台全部为模拟演示数据，非真实产区数据</span>' +
      '  </footer>' +
      '</div>' +
      '<div class="modal-root" id="modalRoot"></div>';
    $$('.nav-item').forEach(function (a) {
      a.addEventListener('click', function () { navigate(a.getAttribute('data-view')); closeDrawer(); });
    });
    $$('.side-role').forEach(function (b) {
      b.addEventListener('click', function () { login(b.getAttribute('data-rolebtn')); });
    });
    $('#roleSwitch').addEventListener('change', function (e) {
      login(e.target.value);
    });
    $('#btnLogout').addEventListener('click', function () { closeDrawer(); logout(); });
    $('#btnGuide').addEventListener('click', function () { closeDrawer(); openGuide(); });
    $('#btnMenu').addEventListener('click', function () {
      var sb = $('#sidebar');
      if (sb.classList.contains('open')) closeDrawer(); else openDrawer();
    });
    $('#drawerMask').addEventListener('click', closeDrawer);
  }

  function openDrawer() {
    var sb = $('#sidebar');
    if (sb) sb.classList.add('open');
    var m = $('#drawerMask');
    if (m) m.classList.add('show');
  }
  function closeDrawer() {
    var sb = $('#sidebar');
    if (sb) sb.classList.remove('open');
    var m = $('#drawerMask');
    if (m) m.classList.remove('show');
  }

  function navigate(view) {
    state.view = view;
    $$('.nav-item').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-view') === view);
    });
    var m = VIEW_META[view];
    $('#viewTitle').textContent = m.name;
    $('#viewDesc').textContent = m.desc;
    var root = $('#viewRoot');
    root.innerHTML = '';
    root.scrollTop = 0;
    if (view === 'dashboard') viewDashboard(root);
    else if (view === 'decision') viewDecision(root);
    else if (view === 'varieties') viewVarieties(root);
    else if (view === 'regions') viewRegions(root);
    else if (view === 'production') viewProduction(root);
    else if (view === 'sales') viewSales(root);
    else if (view === 'price') viewPrice(root);
    else if (view === 'knowledge') viewKnowledge(root);
  }

  /* ================= 通用组件 ================= */
  function card(html, cls) {
    return '<div class="panel' + (cls ? ' ' + cls : '') + '">' + html + '</div>';
  }
  function cardHead(icon, title, right) {
    return '<div class="panel-head"><div class="panel-title"><span class="ph-icon">' + icon + '</span>' + title + '</div>' + (right ? '<div class="panel-right">' + right + '</div>' : '') + '</div>';
  }
  function legendHtml(items) {
    return '<div class="legend-row">' + items.map(function (i) {
      return '<span class="legend-item"><i style="background:' + i.c + '"></i>' + i.n + '</span>';
    }).join('') + '</div>';
  }
  function deltaHtml(v, goodWhenUp) {
    var up = String(v).indexOf('+') === 0;
    var down = String(v).indexOf('-') === 0;
    var cls = up ? 'up' : (down ? 'down' : 'flat');
    return '<span class="delta ' + cls + '">' + v + '</span>';
  }

  /* ================= 视图：产销驾驶舱 ================= */
  var dashSeries = null;
  function viewDashboard(root) {
    var m = ROLE_META[state.role];
    var K = DATA.kpis;
    var kpiCards = Object.keys(K).map(function (k) {
      var kp = K[k];
      return '<div class="kpi" data-kpi="' + k + '">' +
        '<div class="kpi-label">' + kp.label + '</div>' +
        '<div class="kpi-value" id="kpi-' + k + '">' + fmt(kp.value, 2) + '<span class="kpi-unit">' + (kp.unit || '') + '</span></div>' +
        '<div class="kpi-sub">' + deltaHtml(kp.delta) + ' <span>' + kp.sub + '</span></div>' +
        '</div>';
    }).join('');

    var warnCounts = { blue: 0, yellow: 0, orange: 0, red: 0 };
    DATA.warnings.forEach(function (w) { warnCounts[w.level]++; });

    root.innerHTML =
      '<div class="dash-banner">' +
      '  <div class="banner-main"><b>核心主张</b> 帮农户少烂一斤，帮产业多赚一季 —— 以销定产，把产前决策从凭经验变成看数据</div>' +
      '  <div class="banner-sub" id="roleWelcome">' + m.welcome + '</div>' +
      '</div>' +
      '<div class="kpi-grid">' + kpiCards + '</div>' +
      '<div class="grid-3-1">' +
      '  <div class="col">' +
      '    <div class="panel">' +
      cardHead('📡', '产区产销实时曲线', '<span class="tag">每3秒刷新 · 万吨</span>') +
      '      <div id="dashRealtime" style="height:280px"></div>' +
      '    </div>' +
      '    <div class="panel ticker-panel">' +
      cardHead('⚡', '实时成交播报', '<span class="tag" id="tickerMeta">桂味·糯米糍 价格坚挺</span>') +
      '      <div class="ticker" id="tickerBox"></div>' +
      '    </div>' +
      '  </div>' +
      '  <div class="col">' +
      '    <div class="panel">' +
      cardHead('💰', '产区价格指数', '<span class="tag">地头收购口径</span>') +
      '      <div class="price-index"><div class="pi-main"><b id="piVal">' + K.price.value + '</b><span>元/斤</span></div>' +
      '      <div class="pi-delta" id="piDelta">' + deltaHtml('-2.3%') + '</div></div>' +
      '      <div id="piSpark" style="height:70px"></div>' +
      '      <div class="pi-note">' + legendHtml([{ c: '#E5484D', n: '产区均价' }]) + ' 近24小时走势 · 早熟品种价格企稳，桂味高位震荡</div>' +
      '    </div>' +
      '    <div class="panel">' +
      cardHead('🚨', '滞销风险预警分布', '<span class="tag">五维指数 · 四级阈值</span>') +
      '      <div class="warn-row">' +
      '        <div class="warn-box blue"><b>' + warnCounts.blue + '</b><span>蓝色 · 关注</span></div>' +
      '        <div class="warn-box yellow"><b>' + warnCounts.yellow + '</b><span>黄色 · 警戒</span></div>' +
      '        <div class="warn-box orange"><b>' + warnCounts.orange + '</b><span>橙色 · 较重</span></div>' +
      '        <div class="warn-box red"><b>' + warnCounts.red + '</b><span>红色 · 严重</span></div>' +
      '      </div>' +
      '      <div class="warn-note">白蜡（76）、桂味（82）橙色预警中 —— 智能体已生成处置建议，详见 AI 智能决策</div>' +
      '    </div>' +
      '    <div class="panel log-panel">' +
      cardHead('🗂️', '智能体数据流日志', '<span class="tag">实时</span>') +
      '      <div class="log-box" id="logBox"></div>' +
      '    </div>' +
      '  </div>' +
      '</div>' +
      '<div class="grid-2-1">' +
      '  <div class="panel">' +
      cardHead('🤖', m.name + ' · 今日智能体摘要', '<a class="link" data-jump="decision">查看完整建议书 →</a>') +
      '    <div id="roleSummary" class="role-summary"></div>' +
      '  </div>' +
      '  <div class="panel">' +
      cardHead('⚙️', '智能体流水线', '<span class="tag">五层架构</span>') +
      '    <div class="pipeline">' + DATA.pipeline.map(function (p) {
        return '<div class="pipe-step"><div class="pipe-icon">' + p.icon + '</div><div><b>' + p.step + '</b><span>' + p.desc + '</span></div><em class="st-' + (p.status === '运行中' ? 'run' : 'ok') + '">' + p.status + '</em></div>';
      }).join('') + '</div>' +
      '  </div>' +
      '</div>';

    /* 角色摘要卡 */
    var sum = DATA.decisions[state.role].cards;
    $('#roleSummary').innerHTML = '<div class="sum-grid">' + sum.map(function (c) {
      return '<div class="sum-card"><div class="sum-ic">' + c.icon + '</div><div><b>' + c.name + '</b><p>' + c.body + '</p></div></div>';
    }).join('') + '</div>';
    $$('#roleSummary [data-jump]').forEach(function () {});
    $('[data-jump]', root).addEventListener('click', function () { navigate('decision'); });

    /* 实时曲线初始化 */
    dashSeries = { listed: [], traded: [], labels: [] };
    var base = DATA.trend30;
    var tail = 14;
    for (var i = 0; i < tail; i++) {
      dashSeries.labels.push(base.labels[base.labels.length - tail + i]);
      dashSeries.listed.push(base.listed[base.listed.length - tail + i]);
      dashSeries.traded.push(base.traded[base.traded.length - tail + i]);
    }
    window.__dashInit = function () {
      drawDashRealtime();
      var pi = DATA.trend30.traded.slice(-18);
      Charts.spark($('#piSpark'), pi, '#E5484D');
    };
    window.__dashInit();
  }

  function drawDashRealtime() {
    var box = $('#dashRealtime');
    if (!box) return;
    Charts.line(box, {
      noAnim: true,
      labels: dashSeries.labels,
      series: [
        { name: '上市量', data: dashSeries.listed, color: '#2F6FED', fillOpacity: 0.16 },
        { name: '成交量', data: dashSeries.traded, color: '#D92B4B', fillOpacity: 0.14 }
      ],
      unit: ' 吨', h: 280
    });
  }

  /* ================= 视图：AI 智能决策 ================= */
  function viewDecision(root) {
    var m = ROLE_META[state.role];
    var dec = DATA.decisions[state.role];
    var cardsHtml = dec.cards.map(function (c) {
      return '<div class="dec-card"><div class="dec-ic">' + c.icon + '</div><b>' + c.name + '</b><em>' + c.tag + '</em><p>' + c.body + '</p></div>';
    }).join('');

    var warnRows = DATA.warnings.map(function (w) {
      var L = DATA.riskLevels[w.level];
      return '<tr>' +
        '<td><b>' + w.variety + '</b></td>' +
        '<td><span class="risk-pill" style="background:' + L.color + '1A;color:' + L.color + '">' + L.name + '</span></td>' +
        '<td><div class="risk-meter"><i style="width:' + w.risk + '%;background:' + L.color + '"></i></div></td>' +
        '<td><b style="color:' + L.color + '">' + w.risk + '</b></td>' +
        '<td class="advice-cell">' + w.advice + '</td>' +
        '</tr>';
    }).join('');

    var chatHtml = state.role === 'farmer' ?
      '<div class="panel">' + cardHead('💬', '向智能体提问（演示）', '<span class="tag">模拟问答</span>') +
      '  <div class="qa-suggest" id="qaSuggest">' +
      '    <button data-qa="0">' + esc(DATA.farmerQA.q1.ask) + '</button>' +
      '    <button data-qa="1">' + esc(DATA.farmerQA.q2.ask) + '</button>' +
      '    <button data-qa="2">' + esc(DATA.farmerQA.q3.ask) + '</button>' +
      '  </div>' +
      '  <div class="qa-chat" id="qaChat"></div>' +
      '</div>'
      : '<div class="panel">' + cardHead('💬', '智能体输出预览（' + m.name + '视角）', '<span class="tag">今晨 06:00 生成</span>') +
      '  <div class="qa-chat" id="qaChat"><div class="qa-a">已根据您的角色画像生成决策建议书（左侧卡片），并同步推送至' + (state.role === 'merchant' ? '直播间运营台' : state.role === 'coop' ? '收购调度群' : '小程序首页') + '。如需调整收购量/选品组合/预算档位，可在正式版本中直接对话调整。</div></div>' +
      '</div>';

    root.innerHTML =
      '<div class="dec-head">' +
      '  <h3>' + dec.title + '</h3>' +
      '  <p>' + dec.intro + '</p>' +
      '</div>' +
      '<div class="dec-grid">' + cardsHtml + '</div>' +
      '<div class="grid-2-1">' +
      '  <div class="panel">' +
      cardHead('🚨', '滞销风险预警看板', '<span class="tag">五维指数 → 四级阈值 · 每4小时更新</span>') +
      '    <table class="tbl"><thead><tr><th>品种</th><th>预警等级</th><th style="width:22%">风险指数</th><th>分值</th><th>智能体处置建议</th></tr></thead><tbody>' + warnRows + '</tbody></table>' +
      '    <div class="level-legend">' + Object.keys(DATA.riskLevels).map(function (k) {
        var L = DATA.riskLevels[k];
        return '<span class="level-item"><i style="background:' + L.color + '"></i>' + L.name + '（' + L.range + '）→ ' + L.action + '</span>';
      }).join('') + '</div>' +
      '  </div>' +
      chatHtml +
      '</div>' +
      '<div class="panel">' + cardHead('🔀', '智能体编排流程', '<span class="tag">五层架构 · 演示</span>') +
      '  <div class="pipe-flow">' + DATA.pipeline.map(function (p, i) {
        return '<div class="pf-step"><div class="pf-ic">' + p.icon + '</div><b>' + p.step + '</b><span>' + p.desc + '</span></div>' + (i < DATA.pipeline.length - 1 ? '<div class="pf-arrow">→</div>' : '');
      }).join('') + '</div>' +
      '</div>';

    $$('#qaSuggest button').forEach(function (b) {
      b.addEventListener('click', function () {
        var i = parseInt(b.getAttribute('data-qa'), 10);
        askAgent(i);
      });
    });

    function askAgent(i) {
      var qa = DATA.farmerQA['q' + (i + 1)];
      var box = $('#qaChat');
      if (!qa) return;
      box.innerHTML += '<div class="qa-q">' + esc(qa.ask) + '</div>';
      var a = document.createElement('div');
      a.className = 'qa-a qa-typing';
      a.textContent = '智能体思考中…';
      box.appendChild(a);
      box.scrollTop = box.scrollHeight;
      setTimeout(function () {
        a.classList.remove('qa-typing');
        a.textContent = qa.ans;
        box.scrollTop = box.scrollHeight;
      }, 900);
    }
    /* 农户默认展示第一条问答 */
    if (state.role === 'farmer') askAgent(0);
  }

  /* ================= 视图：品种介绍 ================= */
  function viewVarieties(root) {
    var cards = DATA.varieties.map(function (v) {
      var sel = state.radarSel.indexOf(v.id) >= 0;
      return '<div class="variety-card' + (sel ? ' sel' : '') + '" data-vid="' + v.id + '">' +
        '<div class="vc-head" style="background:linear-gradient(120deg,' + v.color + '22,' + v.color + '0D)">' +
        '  <span class="vc-emoji">🍒</span>' +
        '  <div><b>' + v.name + '</b><span>' + v.alias + ' · ' + v.ripe + '</span></div>' +
        '  <em style="color:' + v.color + '">' + v.tier + '</em>' +
        '</div>' +
        '<div class="vc-metrics">' +
        '  <div><span>糖度</span><b>' + v.sweet + '°</b></div>' +
        '  <div><span>单果重</span><b>' + v.weight + '</b></div>' +
        '  <div><span>当前均价</span><b style="color:' + v.color + '">' + v.price + ' 元/斤</b></div>' +
        '</div>' +
        '<p class="vc-desc">' + v.desc + '</p>' +
        '<div class="vc-tips"><span>💡</span>' + v.tips + '</div>' +
        '<div class="vc-foot"><span>产量占比 <b>' + v.share + '%</b></span><span>热销指数 <b>' + v.hot + '</b></span><span>复购率 <b>' + v.repurchase + '%</b></span></div>' +
        '</div>';
    }).join('');

    root.innerHTML =
      '<div class="panel">' + cardHead('🍒', '六大主栽品种档案', '<span class="tag">点击卡片加入对比（可选2个）</span>') +
      '  <div class="variety-grid">' + cards + '</div>' +
      '</div>' +
      '<div class="grid-2-1">' +
      '  <div class="panel">' + cardHead('🎯', '品种多维对比', '<span class="tag">甜度/果个/产量/耐储/溢价</span>') +
      '    <div id="radarBox" style="height:330px"></div>' +
      '  </div>' +
      '  <div class="panel">' + cardHead('🕐', '上市时间轴（2026产季）', '<span class="tag">错峰上市是削峰关键</span>') +
      '    <div class="ripe-timeline" id="ripeTimeline"></div>' +
      '  </div>' +
      '</div>' +
      '<div class="panel">' + cardHead('📋', '品种行情快照', '') +
      '  <table class="tbl"><thead><tr><th>品种</th><th>别名</th><th>熟期</th><th>最佳上市窗口</th><th>糖度</th><th>核型</th><th>产量占比</th><th>当前均价</th><th>同比</th><th>定位</th></tr></thead><tbody>' +
      DATA.varieties.map(function (v) {
        return '<tr><td><b>' + v.name + '</b></td><td>' + v.alias + '</td><td>' + v.ripe + '</td><td>' + v.ripeWindow + '</td><td>' + v.sweet + '°</td><td>' + v.core + '</td><td>' + v.share + '%</td><td><b style="color:' + v.color + '">' + v.price + '</b></td><td>' + deltaHtml(v.priceYoY) + '</td><td><span class="tier-tag" style="color:' + v.color + '">' + v.tier + '</span></td></tr>';
      }).join('') +
      '</tbody></table>' +
      '</div>';

    $$('.variety-card').forEach(function (c) {
      c.addEventListener('click', function () {
        var id = c.getAttribute('data-vid');
        var i = state.radarSel.indexOf(id);
        if (i >= 0) state.radarSel.splice(i, 1);
        else {
          state.radarSel.push(id);
          if (state.radarSel.length > 2) state.radarSel.shift();
        }
        $$('.variety-card').forEach(function (x) {
          x.classList.toggle('sel', state.radarSel.indexOf(x.getAttribute('data-vid')) >= 0);
        });
        drawRadar();
      });
    });
    drawRadar();
    drawTimeline();
  }

  function drawRadar() {
    var box = $('#radarBox');
    if (!box) return;
    var series = state.radarSel.map(function (id) {
      var v = DATA.varieties.filter(function (x) { return x.id === id; })[0];
      return { name: v.name, color: v.color, data: v.radar, max: 100 };
    });
    Charts.radar(box, { axes: ['甜度', '果个', '产量', '耐储', '溢价'], series: series, legend: true, h: 330 });
  }

  function drawTimeline() {
    var box = $('#ripeTimeline');
    if (!box) return;
    var pos = {
      '白糖罂': { left: 0, w: 13, top: 26 },
      '白蜡': { left: 0, w: 13, top: 78 },
      '妃子笑': { left: 14, w: 18, top: 128 },
      '桂味': { left: 24, w: 15, top: 180 },
      '糯米糍': { left: 32, w: 15, top: 232 },
      '仙进奉': { left: 42, w: 17, top: 128 }
    };
    box.innerHTML = DATA.varieties.map(function (v) {
      var p = pos[v.name];
      return '<div class="tl-item" style="left:' + p.left + '%;width:' + p.w + '%;top:' + p.top + 'px;background:' + v.color + '">' + v.name + '<span>' + v.ripe + '</span></div>';
    }).join('') + '<div class="tl-today" style="left:31%">今日<br>6月18日</div>';
  }

  /* ================= 视图：产区分布 ================= */
  function viewRegions(root) {
    var t = DATA.towns.filter(function (x) { return x.id === state.townSel; })[0] || DATA.towns[0];
    var mapHtml = '<svg viewBox="0 0 520 420" class="region-map" id="regionMap">' +
      '<path d="M150 24 C 205 14, 300 20, 360 40 C 420 60, 470 105, 476 160 C 482 220, 452 285, 398 330 C 350 372, 268 400, 200 396 C 130 392, 68 352, 46 296 C 24 242, 30 180, 52 128 C 72 80, 100 36, 150 24 Z" fill="#EAF4EC" stroke="#B9D4C0" stroke-width="2"/>' +
      '<path d="M120 200 C 190 170, 300 190, 420 250" fill="none" stroke="#BFD9EC" stroke-width="7" stroke-linecap="round" opacity="0.8"/>' +
      '<text x="128" y="216" font-size="11" fill="#7FA8C9">鉴江水系</text>' +
      DATA.towns.map(function (tw) {
        var R = 9 + Math.sqrt(tw.area) * 3.2;
        var L = DATA.riskLevels[tw.riskLevel];
        var sel = tw.id === state.townSel;
        return '<g class="town-g" data-town="' + tw.id + '" style="cursor:pointer">' +
          '<circle cx="' + (tw.x * 5.2) + '" cy="' + (tw.y * 4) + '" r="' + R + '" fill="' + L.color + '" fill-opacity="' + (sel ? 0.95 : 0.28) + '" stroke="' + L.color + '" stroke-width="' + (sel ? 3 : 1.5) + '" ' + (tw.hot ? 'class="town-pulse"' : '') + '/>' +
          '<text x="' + (tw.x * 5.2) + '" y="' + (tw.y * 4) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#fff" ' + (sel ? '' : 'opacity="0"') + '>' + tw.output + '</text>' +
          '<text x="' + (tw.x * 5.2) + '" y="' + (tw.y * 4 + R + 15) + '" text-anchor="middle" font-size="12.5" font-weight="600" fill="#23362E">' + tw.name + '</text>' +
          '</g>';
      }).join('') +
      '<text x="392" y="408" font-size="10" fill="#93A79D">＊示意图：气泡大小=种植面积，颜色=当前预警等级</text>' +
      '</svg>';

    var townList = DATA.towns.map(function (tw) {
      var L = DATA.riskLevels[tw.riskLevel];
      return '<div class="town-row' + (tw.id === state.townSel ? ' sel' : '') + '" data-town="' + tw.id + '">' +
        '<i style="background:' + L.color + '"></i>' +
        '<div><b>' + tw.name + '</b><span>' + tw.variety + '</span></div>' +
        '<div class="tr-nums"><b>' + tw.area + '万亩</b><span>' + tw.output + '万吨</span></div>' +
        '<em style="color:' + L.color + '">' + L.name + '</em>' +
        '</div>';
    }).join('');

    root.innerHTML =
      '<div class="grid-map">' +
      '  <div class="panel">' + cardHead('🗺️', '高州市荔枝主产镇分布（示意）', '<span class="tag">59.6万亩 · 23个主产镇</span>') +
      '    ' + mapHtml +
      '  </div>' +
      '  <div class="col">' +
      '    <div class="panel">' + cardHead('🏘️', '主产镇列表', '<span class="tag">点击查看详情</span>') +
      '      <div class="town-list">' + townList + '</div>' +
      '    </div>' +
      '  </div>' +
      '</div>' +
      '<div class="grid-3-1">' +
      '  <div class="col">' +
      '    <div class="panel town-detail" id="townDetail"></div>' +
      '  </div>' +
      '  <div class="col">' +
      '    <div class="panel">' + cardHead('🌦️', '产地气象与物流', '<span class="tag">感知层数据</span>') +
      '      <div class="weather-grid">' +
      '        <div><span>气温</span><b>28.6℃</b><em>适宜采摘</em></div>' +
      '        <div><span>未来72h降水</span><b>12mm</b><em>雷阵雨转多云</em></div>' +
      '        <div><span>台风路径</span><b>无影响</b><em>粤西海面平静</em></div>' +
      '        <div><span>冷链运力</span><b>312车次</b><em>余量 8.6%</em></div>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    function selectTown(id) {
      state.townSel = id;
      viewRegions(root);
    }
    $$('.town-g').forEach(function (g) {
      g.addEventListener('click', function () { selectTown(g.getAttribute('data-town')); });
    });
    $$('.town-row').forEach(function (r) {
      r.addEventListener('click', function () { selectTown(r.getAttribute('data-town')); });
    });
    renderTownDetail(t);
  }

  function renderTownDetail(t) {
    var L = DATA.riskLevels[t.riskLevel];
    var price = { gzz: 29.8, psz: 9.2, fjz: 8.8, ssz: 27.6, djz: 10.3, cjz: 6.9, stz: 46.2, htz: 8.6 }[t.id];
    var listed = { gzz: 612, psz: 486, fjz: 720, ssz: 388, djz: 306, cjz: 512, stz: 96, htz: 268 }[t.id];
    var progress = { gzz: 64, psz: 82, fjz: 76, ssz: 58, djz: 88, cjz: 91, stz: 32, htz: 71 }[t.id];
    $('#townDetail').innerHTML = cardHead('📍', t.name + ' · 产销详情', '<span class="risk-pill" style="background:' + L.color + '1A;color:' + L.color + '">' + L.name + '（指数 ' + t.risk + '）</span>') +
      '<div class="td-grid">' +
      '  <div><span>种植面积</span><b>' + t.area + ' 万亩</b></div>' +
      '  <div><span>2026产季产量</span><b>' + t.output + ' 万吨</b></div>' +
      '  <div><span>主栽品种</span><b>' + t.variety + '</b></div>' +
      '  <div><span>今日上市量</span><b>' + listed + ' 吨</b></div>' +
      '  <div><span>当前均价</span><b>' + price + ' 元/斤</b></div>' +
      '  <div><span>采收进度</span><b>' + progress + '%</b></div>' +
      '</div>' +
      '<div class="td-progress"><i style="width:' + progress + '%;background:' + L.color + '"></i></div>' +
      '<p class="td-note">' + t.note + '</p>';
  }

  /* ================= 视图：产量统计 ================= */
  function viewProduction(root) {
    root.innerHTML =
      '<div class="panel">' + cardHead('📈', '历年产量：大小年波动（万吨）', '<span class="tag">2025超级大年 +111% · 2026小年 -37%</span>') +
      '  <div class="grid-3-1">' +
      '    <div class="col"><div id="yearlyChart" style="height:300px"></div></div>' +
      '    <div class="col">' +
      '      <div class="year-note-card big"><b>2025 超级大年</b><span>全国 365.04 万吨（+111.26%）<br>白蜡地头价 4.33 → 1.5 元/斤<br>台风后个别果园低至 0.8–1 元/斤</span></div>' +
      '      <div class="year-note-card small"><b>2026 小年</b><span>全国 231.16 万吨（-37%）<br>高州桂味、糯米糍减产近八成<br>产地价上涨约 4 倍</span></div>' +
      '      <div class="year-note-card warn"><b>2018 滞销</b><span>根子镇柏桥村 1 万多斤荔枝烂在地里<br>收购价由 3 元/斤跌至 0.8 元/斤</span></div>' +
      '    </div>' +
      '  </div>' +
      '</div>' +
      '<div class="grid-2-1">' +
      '  <div class="panel">' + cardHead('🍰', '品种产量结构（2026产季 · 24.6万吨）', '') +
      '    <div class="grid-mini">' +
      '      <div><div id="varietyDonut" style="height:280px"></div></div>' +
      '      <div class="mini-legend" id="varietyLegend"></div>' +
      '    </div>' +
      '  </div>' +
      '  <div class="panel">' + cardHead('📅', '旬度上市进度（%）', '<span class="tag">错峰上市监测</span>') +
      '    <div id="progressChart" style="height:280px"></div>' +
      '  </div>' +
      '</div>' +
      '<div class="panel">' + cardHead('🗃️', '产区数据底座（感知层 · 模拟采集）', '<span class="tag">成花率/挂果率/产量预测</span>') +
      '  <table class="tbl"><thead><tr><th>品种</th><th>在园面积（万亩）</th><th>成花率</th><th>挂果率</th><th>预计产量（万吨）</th><th>预测方式</th><th>数据更新时间</th></tr></thead><tbody>' +
      [['白糖罂', 13.6, '92%', '84%', 6.4, 'LSTM 旬度模型', '06-18 08:00'],
       ['妃子笑', 12.4, '89%', '80%', 5.9, 'LSTM 旬度模型', '06-18 08:00'],
       ['桂味', 8.2, '41%', '36%', 1.6, '小年情景子模型', '06-18 08:00'],
       ['白蜡', 7.8, '94%', '86%', 3.4, 'LSTM 旬度模型', '06-18 08:00'],
       ['糯米糍', 4.1, '38%', '33%', 0.7, '迁移学习（先验：桂味）', '06-18 08:00'],
       ['仙进奉', 2.2, '78%', '71%', 0.9, '迁移学习（先验：妃子笑）', '06-18 08:00']].map(function (r) {
        return '<tr><td><b>' + r[0] + '</b></td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td><td>' + r[4] + '</td><td>' + r[5] + '</td><td>' + r[6] + '</td></tr>';
      }).join('') +
      '</tbody></table>' +
      '</div>';

    Charts.bars($('#yearlyChart'), {
      labels: DATA.yearly.labels,
      series: [
        { name: '全国产量', color: '#B9C4BE', data: DATA.yearly.national },
        { name: '高州产量', color: '#D92B4B', data: DATA.yearly.gaozhou }
      ],
      unit: ' 万吨', h: 300
    });
    Charts.donut($('#varietyDonut'), {
      data: DATA.varieties.map(function (v) { return { name: v.name, value: v.share, color: v.color }; }),
      center: '24.6', centerSub: '万吨 · 2026产季', h: 280
    });
    $('#varietyLegend').innerHTML = DATA.varieties.map(function (v) {
      return '<div class="ml-row"><i style="background:' + v.color + '"></i><span>' + v.name + '</span><b>' + v.share + '% · ' + (v.share / 100 * 24.6).toFixed(1) + '万吨</b></div>';
    }).join('');
    Charts.bars($('#progressChart'), {
      labels: DATA.progress.labels,
      series: DATA.progress.series,
      stacked: true, unit: '%', h: 280
    });
  }

  /* ================= 视图：销量统计 ================= */
  function viewSales(root) {
    root.innerHTML =
      '<div class="grid-2-1">' +
      '  <div class="panel">' + cardHead('📦', '近30日销量趋势（吨/日）', '<span class="tag">已收官回放 + 实时仿真</span>') +
      '    <div id="salesTrend" style="height:300px"></div>' +
      '  </div>' +
      '  <div class="col">' +
      '    <div class="panel">' + cardHead('🏬', '渠道销量结构', '<span class="tag">本季 24.6万吨</span>') +
      '      <div class="grid-mini">' +
      '        <div><div id="channelDonut" style="height:210px"></div></div>' +
      '        <div class="mini-legend" id="channelLegend"></div>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>' +
      '<div class="panel">' + cardHead('🔥', '爆款挖掘榜单（XGBoost + K-Means + LDA）', '<span class="tag">未来2–4周潜力款 · 商户端核心模块</span>') +
      '  <table class="tbl hot-tbl"><thead><tr><th>排名</th><th>商品</th><th>规格</th><th>建议价格</th><th>销量增速</th><th>热销指数</th><th>分档</th><th>LDA卖点</th><th>主推渠道</th><th>货源匹配</th></tr></thead><tbody>' +
      DATA.hotItems.map(function (h) {
        return '<tr>' +
          '<td><span class="rank r' + h.rank + '">' + h.rank + '</span></td>' +
          '<td><b>' + h.name + '</b></td>' +
          '<td>' + h.spec + '</td>' +
          '<td><b>' + h.price + ' 元</b></td>' +
          '<td>' + deltaHtml(h.growth) + '</td>' +
          '<td><div class="hot-bar"><i style="width:' + h.hot + '%;background:#D92B4B"></i></div><b>' + h.hot + '</b></td>' +
          '<td><span class="tier-tag" style="color:' + h.tierColor + '">' + h.tier + '</span></td>' +
          '<td><span class="point-tags">' + h.points.map(function (p) { return '<i>' + p + '</i>'; }).join('') + '</span></td>' +
          '<td>' + h.channel + '</td>' +
          '<td>✅ ' + h.match + '</td>' +
          '</tr>';
      }).join('') +
      '</tbody></table>' +
      '</div>' +
      '<div class="grid-2-1">' +
      '  <div class="panel">' + cardHead('🧭', '销售区域流向（发货量占比）', '<span class="tag">冷链干线</span>') +
      '    <div id="flowChart" style="height:260px"></div>' +
      '  </div>' +
      '  <div class="panel">' + cardHead('🏆', '渠道表现亮点', '') +
      '    <div class="hl-grid">' +
      '      <div class="hl-card"><b>5天 · 200万杯</b><span>2025年茶百道荔枝饮品上线5天销量，消耗鲜荔枝2500万颗</span></div>' +
      '      <div class="hl-card"><b>首周 · 850万杯</b><span>瑞幸联名款首周销量，B端原料采购窗口预测的价值场景</span></div>' +
      '      <div class="hl-card"><b>数天 → 小时级</b><span>平台把“看榜—比价—试卖”选品周期压缩到小时级</span></div>' +
      '      <div class="hl-card"><b>+33.1%</b><span>茶饮/B端加工渠道本季增速最快，大年过剩产能转化出口</span></div>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    Charts.line($('#salesTrend'), {
      labels: DATA.trend30.labels,
      series: [
        { name: '成交量', color: '#D92B4B', data: DATA.trend30.traded }
      ],
      unit: ' 吨', h: 300
    });
    Charts.donut($('#channelDonut'), {
      data: DATA.channels.map(function (c) { return { name: c.name, value: c.share, color: c.color }; }),
      center: '42%', centerSub: '直播电商占比', h: 210
    });
    $('#channelLegend').innerHTML = DATA.channels.map(function (c) {
      return '<div class="ml-row"><i style="background:' + c.color + '"></i><span>' + c.name + '</span><b>' + c.amount + '万吨 ' + c.trend + '</b></div>';
    }).join('');
    Charts.hbars($('#flowChart'), {
      data: [
        { label: '珠三角', value: 38, color: '#D92B4B' },
        { label: '长三角', value: 22, color: '#2F6FED' },
        { label: '京津冀', value: 12, color: '#2FA36B' },
        { label: '川渝', value: 10, color: '#8B5CF6' },
        { label: '华中', value: 9, color: '#F5A623' },
        { label: '其他', value: 9, color: '#9AA7A0' }
      ],
      unit: '%', h: 260
    });
  }

  /* ================= 视图：价格预测 ================= */
  function viewPrice(root) {
    var chips = DATA.price.series.map(function (s) {
      return '<button class="chip' + (s.name === (curName()) ? ' on' : '') + '" data-pv="' + s.name + '">' + s.name + '</button>';
    }).join('');
    var cur = DATA.price.series.filter(function (s) { return s.name === curName(); })[0];

    root.innerHTML =
      '<div class="panel">' + cardHead('💰', '品种级价格走势与预测区间（元/斤 · 旬度）', '<div class="chip-row">' + chips + '</div>') +
      '  <div class="pv-head">' +
      '    <b>' + cur.name + '</b>' +
      '    <span>历史价（6旬）→ 预测区间（4旬）· 模型：Transformer + LSTM 融合</span>' +
      '    <em class="risk-pill" style="background:#8B5CF614;color:#8B5CF6">置信区间 90%</em>' +
      '  </div>' +
      '  <div id="priceChart" style="height:320px"></div>' +
      '</div>' +
      '<div class="grid-3-1">' +
      '  <div class="col">' +
      '    <div class="panel">' + cardHead('⏰', '智能体决策窗口建议（' + cur.name + '）', '<span class="tag">结合风险指数</span>') +
      '      <div class="win-box">' + winAdvice(cur.name) + '</div>' +
      '    </div>' +
      '  </div>' +
      '  <div class="col">' +
      '    <div class="panel">' + cardHead('⚖️', '2025大年 vs 2026小年 情景对比', '') +
      '      <div class="scene-grid">' +
      '        <div class="scene-card big-year"><b>2025 · 超级大年</b><span>全国 365.04万吨（+111%）</span><em>白蜡地头价 4.33→1.5 元/斤</em><em>台风后个别果园 0.8–1 元/斤</em></div>' +
      '        <div class="scene-card small-year"><b>2026 · 小年</b><span>全国 231.16万吨（-37%）</span><em>桂味/糯米糍减产近八成</em><em>产地价上涨约 4 倍</em></div>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>' +
      '<div class="panel">' + cardHead('🧪', '预测模型对比（滚动回测 · 模拟指标）', '<span class="tag">2025大年 + 2026小年 双情景回溯</span>') +
      '  <table class="tbl"><thead><tr><th>模型</th><th>类型</th><th>MAE（元/斤）</th><th>RMSE</th><th>方向准确率</th><th>用途</th></tr></thead><tbody>' +
      DATA.models.map(function (mm, i) {
        return '<tr><td><b>' + mm.name + '</b>' + (i < 2 ? ' <span class="tag main">主模型</span>' : '') + '</td><td>' + mm.type + '</td><td>' + mm.mae + '</td><td>' + mm.rmse + '</td><td>' + mm.acc + '</td><td>' + mm.use + '</td></tr>';
      }).join('') +
      '</tbody></table>' +
      '</div>';

    $$('.chip').forEach(function (c) {
      c.addEventListener('click', function () {
        state.priceVarietyName = c.getAttribute('data-pv');
        viewPrice(root);
      });
    });
    drawPriceChart(cur);

    function curName() { return state.priceVarietyName || '桂味'; }
    function winAdvice(name) {
      var map = {
        '桂味': '最佳出手窗口：6月10日–15日（当前橙色预警，指数82）。建议先礼盒后散货、控量惜售；6月下旬预测价格上行至30–32元/斤，勿在18日集中上市期低价抛售。',
        '白糖罂': '最佳出手窗口：已过峰值，当前处于价格底部区（8–9元/斤）。建议走社区团购快速清货，或转加工保底6.8元/斤；不建议囤货待涨。',
        '妃子笑': '最佳出手窗口：6月8日–15日。直播间加推3–5斤家庭装（39.9–49.9元），走货平稳、维持节奏即可。',
        '糯米糍': '最佳出手窗口：6月20日后错峰上市。当前供不应求（蓝灯），高端礼盒价格带218元+，建议延后一周按订单节奏发货。',
        '白蜡': '最佳出手窗口：6月5日前必须清园（橙色预警，指数76）。当前7.2元/斤已近底部，48小时内对接加工产能260吨保底。',
        '仙进奉': '最佳出手窗口：6月25日–7月10日（晚熟空档期）。当前46元/斤高位、供不应求，精品私域渠道订单充足，可分批发货。'
      };
      return map[name] || '';
    }
  }

  function drawPriceChart(cur) {
    var box = $('#priceChart');
    if (!box) return;
    var labels = DATA.price.labels;
    var nHist = cur.history.length;
    var data = cur.history.concat(cur.forecast);
    /* 按全标签长度对齐的置信区间带 */
    var histFull = [], foreFull = [], bandFull = [];
    for (var i = 0; i < labels.length; i++) {
      if (i < nHist) {
        histFull.push(data[i]); foreFull.push(null); bandFull.push(cur.band[0] || 0.8);
      } else {
        histFull.push(null); foreFull.push(data[i]); bandFull.push(cur.band[i - nHist] || cur.band[cur.band.length - 1]);
      }
    }
    Charts.line(box, {
      labels: labels,
      series: [
        { name: cur.name + '价格', color: cur.color, data: data, width: 3 }
      ],
      band: { id: 'pband', color: cur.color, splitIdx: nHist - 0.5, history: histFull, forecast: foreFull, band: bandFull, split: '60%' },
      unit: ' 元/斤', h: 320
    });
  }

  /* ================= 视图：知识普及 ================= */
  var knowledgeFilter = 'all';
  function viewKnowledge(root) {
    var roleTagMap = { farmer: '农户', merchant: '商户', coop: '合作社', consumer: '消费者' };
    var myTag = roleTagMap[state.role];
    var chips = ['all', 'farmer', 'coop', 'merchant', 'consumer'].map(function (k) {
      var label = k === 'all' ? '全部' : roleTagMap[k];
      return '<button class="chip' + (knowledgeFilter === k ? ' on' : '') + '" data-kf="' + k + '">' + (k === 'all' ? '📚 ' : '') + label + (k === state.role ? '（我）' : '') + '</button>';
    }).join('');
    var list = DATA.knowledge.filter(function (k) {
      if (knowledgeFilter === 'all') return true;
      return k.role === knowledgeFilter || k.role === 'all';
    });
    root.innerHTML =
      '<div class="panel">' + cardHead('📚', '荔枝产销知识课堂', '<span class="tag">按角色筛选 · 已为你标记' + myTag + '相关</span>') +
      '  <div class="chip-row" style="margin-bottom:14px">' + chips + '</div>' +
      '  <div class="k-grid">' + list.map(function (k) {
        var mine = k.role === state.role;
        return '<div class="k-card' + (mine ? ' mine' : '') + '">' +
          '<div class="k-head"><span class="k-icon">' + k.icon + '</span><div><b>' + k.title + '</b><span>' + k.cat + '</span></div>' +
          '<em class="k-tag">' + k.tag + (mine ? ' · 与你相关' : '') + '</em></div>' +
          '<p>' + k.body + '</p>' +
          '</div>';
      }).join('') + '</div>' +
      '</div>' +
      '<div class="panel">' + cardHead('🏛️', '平台口径说明', '<span class="tag">统一数据底座</span>') +
      '  <div class="kb-notes">' +
      '    <p><b>三层数据：</b>平台层（电商销量/价格/评价/直播数据）＋ 产区层（成花率/挂果率/采收进度/气象）＋ 政策层（采购导图/价格周报/助农政策），以“产区—品种—旬”为最小颗粒对齐。</p>' +
      '    <p><b>口径字典：</b>“白糖罂”与“白蜡”同品异名自动归并；价格统一为地头收购口径（元/斤）；产量统一为吨/万吨。</p>' +
      '    <p><b>决策定位：</b>平台建议为辅助决策，不替代经营者判断；产区经营数据仅作聚合分析，不对外披露个体明细。</p>' +
      '  </div>' +
      '</div>';
    $$('.chip[data-kf]').forEach(function (c) {
      c.addEventListener('click', function () {
        knowledgeFilter = c.getAttribute('data-kf');
        viewKnowledge(root);
      });
    });
  }

  /* ================= 实时仿真引擎 ================= */
  var tickerTimer = null, kpiTimer = null, logTimer = null;
  function startRealtime() {
    if (tickerTimer) clearInterval(tickerTimer);
    if (kpiTimer) clearInterval(kpiTimer);
    if (logTimer) clearInterval(logTimer);

    var tickIdx = 0;
    tickerTimer = setInterval(function () {
      var box = $('#tickerBox');
      if (!box) return;
      var item = DATA.tickerPool[tickIdx % DATA.tickerPool.length];
      tickIdx++;
      var q = jitter(item.q, 0.25).toFixed(1);
      var p = jitter(item.p, 0.06).toFixed(1);
      var time = '06-18 ' + nowHMS();
      var row = document.createElement('div');
      row.className = 'ticker-row';
      row.innerHTML = '<span class="tk-time">' + time + '</span><b>' + item.t + '</b><span>' + item.v + '</span><em>' + q + '吨</em><i>@ ' + p + '元/斤</i><small>' + item.m + '</small>';
      box.prepend(row);
      while (box.children.length > 24) box.removeChild(box.lastChild);
      var meta = $('#tickerMeta');
      if (meta) {
        meta.textContent = item.v + ' 成交 ' + q + '吨 @ ' + p + '元/斤 · ' + item.m;
      }
    }, 2600);

    var pi = [12.4, 13.0, 12.8, 13.6, 13.4, 13.9, 14.2, 14.6, 14.4, 14.9, 15.1, 15.3, 15.0, 15.2, 14.9, 15.0, 14.8, 14.86];
    var piIdx = 0;
    kpiTimer = setInterval(function () {
      /* KPI 微波动 */
      ['listed', 'traded', 'price', 'stock', 'coldchain'].forEach(function (k) {
        var el = $('#kpi-' + k);
        if (!el) return;
        var kp = DATA.kpis[k];
        var v;
        if (k === 'price') v = jitter(kp.value, 0.008);
        else v = Math.round(jitter(kp.value, 0.012));
        kp.value = Math.round(v * 100) / 100;
        el.innerHTML = fmt(kp.value, 2) + '<span class="kpi-unit">' + (kp.unit || '') + '</span>';
      });
      var pv = $('#piVal');
      if (pv) {
        var nv = jitter(DATA.kpis.price.value, 0.008).toFixed(2);
        pv.textContent = nv;
        pi.push(parseFloat(nv));
        if (pi.length > 30) pi.shift();
        Charts.spark($('#piSpark'), pi, '#E5484D');
      }
      /* 实时曲线追加 */
      if (state.view === 'dashboard' && dashSeries && dashSeries.listed.length > 0) {
        var lastL = Math.round(jitter(dashSeries.listed[dashSeries.listed.length - 1], 0.03));
        var lastT = Math.round(jitter(dashSeries.traded[dashSeries.traded.length - 1], 0.03));
        dashSeries.listed.push(lastL); dashSeries.traded.push(lastT);
        dashSeries.labels.push(nowHM());
        if (dashSeries.listed.length > 16) {
          dashSeries.listed.shift(); dashSeries.traded.shift(); dashSeries.labels.shift();
        }
        drawDashRealtime();
      }
      var ut = $('#updateTime');
      if (ut) ut.textContent = '06-18 ' + nowHMS();
    }, 3000);

    var logIdx = 0;
    logTimer = setInterval(function () {
      var box = $('#logBox');
      if (!box) return;
      var msg = DATA.logPool[logIdx % DATA.logPool.length];
      logIdx++;
      var d = document.createElement('div');
      d.className = 'log-row';
      d.innerHTML = '<span class="log-time">' + nowHMS() + '</span>' + msg;
      box.prepend(d);
      while (box.children.length > 12) box.removeChild(box.lastChild);
      if (state.view === 'dashboard' && $('#logBox')) { /* 初始填充 */ }
    }, 4200);

    /* 初始日志填充 */
    var box0 = $('#logBox');
    if (box0) {
      DATA.logPool.slice(0, 5).forEach(function (msg) {
        var d = document.createElement('div');
        d.className = 'log-row';
        d.innerHTML = '<span class="log-time">' + nowHMS() + '</span>' + msg;
        box0.appendChild(d);
      });
    }
  }

  /* ================= 演示指引弹窗 ================= */
  function openGuide() {
    var m = ROLE_META[state.role];
    var steps = [
      { n: 1, t: '登录演示', d: '选择任一角色卡片进入，展示“同一底座、四种视角”的平台定位（约20秒）。' },
      { n: 2, t: '产销驾驶舱', d: '展示实时仿真：成交播报滚动、KPI跳动、数据流日志、五层流水线状态（约40秒）。' },
      { n: 3, t: '当前角色场景', d: m.demo + '（约40秒）。' },
      { n: 4, t: '核心数据模块', d: '产区分布（预警气泡图）→ 产量统计（大小年对比）→ 销量统计（爆款榜单）→ 价格预测（区间预测），每页10–20秒。' },
      { n: 5, t: 'AI 智能决策', d: '滞销预警看板（四级预警）+ 角色化建议书，农户视角再演示一次智能体问答（约60秒）。' }
    ];
    $('#modalRoot').innerHTML =
      '<div class="modal-mask"><div class="modal">' +
      '<div class="modal-head"><b>🎤 现场演示指引（约3分钟）</b><button class="modal-x" id="guideClose">✕</button></div>' +
      '<div class="modal-body">' + steps.map(function (s) {
        return '<div class="guide-step"><em>' + s.n + '</em><div><b>' + s.t + '</b><p>' + s.d + '</p></div></div>';
      }).join('') + '</div>' +
      '<div class="modal-foot"><button class="btn-mini" id="guideClose2">知道了，开始演示</button></div>' +
      '</div></div>';
    $('#guideClose').addEventListener('click', closeModal);
    $('#guideClose2').addEventListener('click', closeModal);
  }
  function closeModal() { $('#modalRoot').innerHTML = ''; }

  /* ================= 启动 ================= */
  document.addEventListener('DOMContentLoaded', function () {
    startClock();
    if (IS_MOBILE) {
      /* 扫码手机直入：免登录，直接以游客（消费者视角）进入，点 ☰ 可切换角色 */
      login('consumer');
      setTimeout(function () {
        toast('已直接进入平台（游客视角）· 点左上角 ☰ 可切换 农户/商户/合作社/消费者 角色');
      }, 600);
    } else {
      renderLogin();
    }
  });

  /* 窗口尺寸变化（手机横竖屏/浏览器缩放）时重绘当前视图，保证图表尺寸适配 */
  var __resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(__resizeTimer);
    __resizeTimer = setTimeout(function () {
      if (state.role && $('#appView') && $('#appView').style.display !== 'none') {
        navigate(state.view);
      }
    }, 320);
  });
})();
