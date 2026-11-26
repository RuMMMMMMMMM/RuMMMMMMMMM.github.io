/* 课程 07：面板数据与事件研究（PANEL DATA） */
(function(){
if(!window.COURSES) window.COURSES=[];
window.COURSES.push({
id:'07-panel', no:'07', icon:'🗂️', title:'面板数据与事件研究', tag:'PANEL DATA', keywords:['面板','固定效应','随机效应','Hausman','双向固定','动态面板','GMM','事件研究','CAR','Stata','MCP'],
subtitle:'固定效应 · 随机效应 · 双向固定 · 动态效应 · Stata-MCP 协同',
prerequisites:'先修：模块 02（数据结构）、06（回归基础）',
objectives:[
  '理解面板数据结构的优势与 xtset 设定',
  '掌握固定效应 / 随机效应的选择逻辑与 Hausman 检验',
  '会实现双向固定效应与动态面板（GMM）',
  '掌握事件研究法的事件窗/估计窗设计与 AR/CAR 检验'
],
sections:[
{h:'面板数据结构与优势', blocks:[
 {type:'ul', items:[
   '**结构**：个体 i × 时间 t 的二维数据（省份×年份、公司×季度、员工×月度）。平衡面板每期观测齐全；非平衡面板允许个体中途进入/退出。',
   '**三大优势**：① 样本量大、自由度多；② 控制**不随时间变化的不可观测异质性**（能力、文化、地理），缓解遗漏变量偏误；③ 支持动态分析（滞后效应、事件研究）。',
   '**代价**：需要面板长度的 T≥2；时变变量的测量误差会被放大；样本损耗（attrition）需检查是否系统化。'
 ]},
 {type:'code', lang:'stata', title:'面板设定与结构检查', body:
`xtset id year           // 声明面板：个体 id + 时间 year
xtdes                   // 面板结构：T 分布、是否平衡
xtsum income            // 组间(between)/组内(within)/总体变异分解
xtline income, overlay  // 面板趋势图`}
]},
{h:'固定效应 vs 随机效应', blocks:[
 {type:'table', headers:['维度','固定效应（FE）','随机效应（RE）'], rows:[
   ['个体效应 αᵢ 的假设','与 X 相关（允许内生性）','与 X 不相关（纯随机）'],
   ['识别来源','组内变异（within）','组内 + 组间（GLS 加权）'],
   ['优点','一致性好、因果推断首选','效率高、可估时不变变量系数'],
   ['缺点','时不变变量（性别、民族）系数无法估计','αᵢ 与 X 相关时不一致'],
   ['适用信号','研究因果效应、个体效应疑似与 X 相关','αᵢ 是随机抽样的一部分']
 ]},
 {type:'code', lang:'stata', title:'FE / RE / Hausman', body:
`xtreg income age edu, fe vce(cluster id)      // 固定效应
estimates store FE
xtreg income age edu, re vce(cluster id)      // 随机效应
estimates store RE
hausman FE RE, sigmamore                      // Hausman 检验
* p<0.05 → 拒绝"RE 一致" → 用 FE`}
]},
{h:'双向固定效应（TWFE）', blocks:[
 {type:'p', body:'同时加入**个体固定效应与时间固定效应**：Yᵢₜ = βXᵢₜ + αᵢ + λₜ + εᵢₜ。时间固定效应吸收所有个体共同的年度冲击（宏观政策、经济周期），是面板因果推断的标准配置。'},
 {type:'code', lang:'stata', title:'双向固定效应', body:
`* 方法一：xtreg + 时间哑变量
xtreg income age edu i.year, fe vce(cluster id)

* 方法二：reghdfe（推荐，速度快、支持高维 FE）
ssc install reghdfe
reghdfe income age edu, absorb(id year) vce(cluster id)

* 方法三：双向 FE + 交互固定效应（地区×年份）
reghdfe income age edu, absorb(id year region#year) vce(cluster id)`}
]},
{h:'案例：省份数字经济的效应', blocks:[
 {type:'analogy', title:'通俗类比 · 固定效应是「跟自己比」', body:'固定效应的逻辑像减肥记录：**你只跟过去的自己比**（同一省份 2015 vs 2020），而不是跟别的省比。个体固定效应先把「每个省自己的底色」（地理、文化、资源）扣掉，剩下的变化才用来识别因果。'},
 {type:'case', title:'30 省 × 12 年面板的完整实证', story:'你研究「数字经济指数对绿色创新的影响」，数据是 30 省 2010-2021 年面板，绿色创新用绿色专利数衡量。',
   steps:[
    {t:'第 1 步 · 面板体检', d:'xtset + xtdes：平衡面板，T=12；xtsum 显示核心变量组内变异充足。'},
    {t:'第 2 步 · 基准回归', d:'双向固定效应（省份 + 年份），标准误按省份聚类——基准系数 0.183（p<0.01）。'},
    {t:'第 3 步 · FE vs RE', d:'Hausman 检验 p<0.01 → 个体效应与解释变量相关，采用固定效应。'},
    {t:'第 4 步 · 动态效应', d:'加入滞后一期绿色创新，系统 GMM 重估 → 核心结论稳健。'},
    {t:'第 5 步 · 稳健性', d:'替换绿色创新指标（专利授权数）、1% 缩尾重估 → 系数方向与显著性不变。'}
   ],
   conclusion:'对比混合 OLS（忽略省份差异）的系数，固定效应结果小了约 40%——**面板数据用普通回归，等于把「省份底色」错算成了数字经济的作用。**'},
 {type:'quickcheck', id:'qc-07-panel'}
]},
{h:'动态面板与 GMM', blocks:[
 {type:'ul', items:[
   '**动态效应**：当期的 Y 依赖过去的 Y（惯性、调整成本），设定 Yᵢₜ = βYᵢ,ₜ₋₁ + γXᵢₜ + αᵢ + εᵢₜ。',
   '**Nickell 偏误**：滞后因变量与个体效应相关，FE 估计在 T 较短时偏误严重。',
   '**解法**：差分 GMM（Arellano-Bond，用滞后水平作工具变量）与系统 GMM（Blundell-Bond，差分+水平方程联立，效率更高）。'
 ]},
 {type:'code', lang:'stata', title:'动态面板 GMM', body:
`* 系统 GMM（Roodman xtabond2）
ssc install xtabond2
xtabond2 income L.income age edu, gmm(L.income, lag(2 4) collapse) \\
    iv(age edu) twostep robust small
* 关键诊断：AR(2) 检验 p>0.1（无二阶自相关）；Hansen J 检验 p 在 0.1-0.25 为宜`}
]},
{h:'事件研究法（Event Study）', blocks:[
 {type:'ol', items:[
   '**定义事件**：政策发布日、公告日、事故日（t=0），事件必须对市场/个体是「意外」的；',
   '**划分窗口**：估计窗 [T₀, T₁]（事件前，用于估计正常收益模型）；事件窗 [T₁+1, T₂]（观测异常反应）；',
   '**估计正常收益**：市场模型 Rᵢₜ = αᵢ + βᵢRₘₜ + εᵢₜ（用估计窗拟合）；',
   '**计算异常收益 ARᵢₜ** = 实际收益 − 正常收益；**累计异常收益 CARᵢ** = Σ ARᵢₜ（事件窗内求和）；',
   '**检验**：横截面 t 检验 / 标准化 CAR 检验（BMP）/ 非参数秩检验；多事件日时先对齐 t=0 再平均。'
 ]},
 {type:'tool', id:'event-study-demo'},
 {type:'code', lang:'stata', title:'事件研究实现', body:
`* eventstudy2（含显著性检验）
ssc install eventstudy2
eventstudy2 ret, id(id) date(date) events(eventdate) \\
    evwlb(-5) evwub(10) estwlb(-120) estwub(-6) \\
    model(market) index(mktret) noscale
* 输出：CAR 均值、t 值（Patell/BMP）、作图数据

* 手工路径（Python）
# 1) 估计窗回归得 α,β → 2) 事件窗计算 AR = ret - (α + β*mkt)
# 3) CAR = AR.groupby(id)[win].sum() → 4) CAR.mean() / (CAR.std()/sqrt(N)) 做 t 检验`}
]},
{h:'Stata-MCP 协同工作流', blocks:[
 {type:'p', body:'WorkBuddy 通过 **Stata-MCP 连接器**让大模型与分析环境协同：模型负责生成与解读，Stata 负责权威计算。典型协作链路：'},
 {type:'code', lang:'text', title:'Stata-MCP 协同流程', body:
`① 分析员描述任务: "用 2010-2022 省际面板检验数字经济对绿色创新的影响"
② 模型生成方案: TWFE 设定、控制变量、标准误选择(双向聚类)
③ 经 Stata-MCP 发送代码 → Stata 执行 → 返回对数与结果表
④ 模型初读结果: 系数方向、显著性、样本量
⑤ 分析员复核 + 稳健性检验(模块 08) + 人工撰写结论
⑥ 结果表经 esttab 导出三线表 → 报告(模块 08)`},
 {type:'callout', kind:'warn', title:'协同纪律', body:'MCP 执行的是「计算」，不是「判断」。工具变量有效性、GMM 诊断、事件窗设定等统计判断必须由人做最终决定；模型输出的一切结果都应能回溯到脚本与日志。'},
 {type:'scenario', id:'sc-07-panel'}
]}
],
faq:[
 {q:'FE 和 RE 到底怎么选？', a:'默认思维：做因果推断 → FE（更稳）；只做描述性关联且 αᵢ 与 X 不相关 → RE 效率更高。形式上用 Hausman 检验裁决，但注意：检验不显著 ≠ 一定用 RE，经济学实证中 FE 是更被信任的基准设定。'},
 {q:'双向固定效应能解决一切遗漏变量吗？', a:'不能。TWFE 只吸收「个体不变」与「共同时间」冲击；个体层面的时变混淆（如同时影响 X 和 Y 的时变政策）仍需控制变量、DID 设计或工具变量。'},
 {q:'事件研究的窗口怎么定？', a:'没有统一标准，取决于预期反应速度与「泄漏」风险：公告类事件常用 [-1,+1]、[-2,+2] 短窗（减少混淆事件）；政策类可用 [-5,+10]。估计窗要足够长（≥100 期）且不与事件窗重叠；稳健性中应报告多组窗口的 CAR。'},
 {q:'系统 GMM 一定比差分 GMM 好吗？', a:'大样本、Y 持续性强的场景系统 GMM 更有效；但系统 GMM 额外要求「差分工具与个体效应不相关」，工具过多会弱化 Hansen 检验。规范做法是报告两种结果并说明诊断指标。'}
]
});
})();
