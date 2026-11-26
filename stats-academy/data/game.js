/* 游戏化规则：关卡、徽章、XP、等级 */
window.GAME = {
  xpPerLevel: 300,               // 每 300 XP 升一级
  courseQuizBase: 50,            // 完成模块测验基础 XP
  courseQuizPerPoint: 0.5,       // 每分额外 XP（100 分 → +50）
  quickXP: 5,                    // 随堂测评答对每题 XP
  scenarioXP: 10,                // 情境练习答对每题 XP
  elementVisitXP: 5,             // 首次访问六要素详情页
  badgeXP: 50,                   // 每枚徽章奖励
  completeXP: 30,                // 标记模块完成
  starRule: { g3: 90, g2: 75, g1: 60 },  // 三星/两星/一星分数线
  badges: [
    {id:'first-step',   icon:'🌱', name:'初出茅庐', desc:'完成任意一个模块测验', check:s=>Object.keys(s.quizBest||{}).length>=1},
    {id:'cleaner',      icon:'🧹', name:'数据清道夫', desc:'模块 03「数据清洗」测验 ≥60 分', check:s=>(s.quizBest||{})['03-cleaning']>=60},
    {id:'surveyor',     icon:'📝', name:'问卷诊断师', desc:'模块 05「问卷分析」测验 ≥60 分', check:s=>(s.quizBest||{})['05-survey']>=60},
    {id:'modeler',      icon:'📈', name:'回归建模师', desc:'模块 06「相关回归」测验 ≥60 分', check:s=>(s.quizBest||{})['06-regression']>=60},
    {id:'panelist',     icon:'🗂️', name:'面板研究员', desc:'模块 07「面板与事件研究」测验 ≥60 分', check:s=>(s.quizBest||{})['07-panel']>=60},
    {id:'guardian',     icon:'🛡️', name:'稳健守门人', desc:'结果核验清单完成 ≥8 项', check:s=>(s.robcheck||[]).filter(Boolean).length>=8},
    {id:'explorer',     icon:'🧭', name:'要素探索者', desc:'学完全部 6 个 WorkBuddy 要素', check:s=>Object.keys(s.visitedElements||{}).length>=6},
    {id:'practitioner', icon:'🎯', name:'实战练习生', desc:'累计答对 10 道随堂测评或情境练习', check:s=>((s.quickCorrect||0)+(s.scenarioCorrect||0))>=10},
    {id:'perfectionist',icon:'💯', name:'满分学霸', desc:'任意模块测验拿到 100 分', check:s=>Object.values(s.quizBest||{}).includes(100)},
    {id:'allstar',      icon:'🏆', name:'全栈分析师', desc:'8 个模块测验全部 ≥60 分', check:s=>window.COURSES && window.COURSES.every(c=>(s.quizBest||{})[c.id]>=60)}
  ]
};
