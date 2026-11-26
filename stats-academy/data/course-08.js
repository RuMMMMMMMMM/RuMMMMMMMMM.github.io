/* 课程 08：稳健性检验、结果核验与报告生成（ROBUSTNESS） */
(function(){
if(!window.COURSES) window.COURSES=[];
window.COURSES.push({
id:'08-robustness', no:'08', icon:'🛡️', title:'稳健性检验与报告生成', tag:'ROBUSTNESS', keywords:['稳健性','替换变量','缩尾','安慰剂','核验','学术图表','写作','报告','显著性'],
subtitle:'替换变量 · 缩尾 · 安慰剂 · 学术图表规范 · 实证结果写作',
prerequisites:'先修：模块 05-07（推断与建模方法）',
objectives:[
  '掌握替换变量、缩尾、安慰剂等核心稳健性检验的设计与实现',
  '会用核验清单系统检查实证结果的可信度',
  '掌握学术图表规范与三线表导出',
  '能按规范句式撰写实证结果'
],
sections:[
{h:'稳健性检验总览', blocks:[
 {type:'p', body:'稳健性检验回答一个问题：**「如果换一种合理的做法，结论还成立吗？」** 结论对关键设定不敏感，才值得被相信。'},
 {type:'cards', items:[
   {icon:'🔁', t:'替换变量', b:'核心自变量/因变量换成替代度量（如收入换成消费、满意度换离职意愿），结论不变则稳健。'},
   {icon:'✂️', t:'缩尾与剔异常', b:'1%/5% 双侧缩尾、剔除离群样本后重估，检验结论是否被极端值驱动。'},
   {icon:'🎭', t:'安慰剂检验', b:'用「假处理」（随机分组、伪事件日、伪政策期）检验效应是否只是噪声。'},
   {icon:'🧩', t:'子样本分析', b:'按地区/规模/时期分组重估；异质性本身就是有价值的发现。'},
   {icon:'➕', t:'增减控制变量', b:'逐步加入/剔除控制变量，观察核心系数稳定性（避免“选择式回归”）。'},
   {icon:'🧮', t:'标准误与模型形式', b:'换标准误（HC/聚类）、换估计方法（OLS→FE→GMM→Logit），结论应跨设定成立。'}
 ]}
]},
{h:'替换变量与缩尾', blocks:[
 {type:'code', lang:'python', title:'替换变量 + 缩尾稳健性', body:
`# 1) 替换因变量：满意度 → 离职倾向（另一份量表）
m1 = smf.ols('sat ~ age + income + C(edu)', data=df).fit()
m2 = smf.ols('turnover_int ~ age + income + C(edu)', data=df).fit()

# 2) 替换自变量：收入 → 收入对数 / 财富指数
m3 = smf.ols('sat ~ np.log1p(income) + age + C(edu)', data=df).fit()

# 3) 缩尾后重估
p1, p99 = df['income'].quantile([.01, .99])
df['income_w'] = df['income'].clip(p1, p99)
m4 = smf.ols('sat ~ income_w + age + C(edu)', data=df).fit()

# 4) 剔除异常样本（Cook 距离前 1%）
from statsmodels.stats.outliers_influence import OLSInfluence
infl = OLSInfluence(m1)
df_clean = df[infl.cooks_distance[0] < infl.cooks_distance[0].quantile(.99)]
m5 = smf.ols('sat ~ age + income + C(edu)', data=df_clean).fit()

# 核心系数对比表（符号与显著性是否一致）
compare = pd.DataFrame({
  'baseline':     [m1.params['income'], m1.pvalues['income']],
  'alt_dv':       [m2.params['income'], m2.pvalues['income']],
  'log_x':        [m3.params['np.log1p(income)'], m3.pvalues['np.log1p(income)']],
  'winsorized':   [m4.params['income_w'], m4.pvalues['income_w']],
  'drop_outlier': [m5.params['income'], m5.pvalues['income']]})`}
]},
{h:'安慰剂检验', blocks:[
 {type:'ul', items:[
   '**随机置换安慰剂**：把处理组标签随机打乱（或随机指定伪处理时点）数百次，得到安慰剂效应的分布；真实效应若落在分布边缘之外（>95% 分位），说明不是噪声。',
   '**伪政策时间**：把政策实施年提前 1-3 期（“提前政策”应无效应），检验平行趋势与预期效应。',
   '**伪结果变量**：用理论上不应受影响的变量做因变量（如政策影响企业创新但不该影响企业注册地），应无效应。'
 ]},
 {type:'code', lang:'python', title:'随机置换安慰剂（DID/回归场景）', body:
`import numpy as np
real_beta = 1.83                     # 真实估计系数
placebo = []
rng = np.random.default_rng(42)
for _ in range(500):
    # 随机打乱处理组标签，保持样本结构
    df['treat_fake'] = rng.permutation(df['treat'].values)
    b = smf.ols('y ~ treat_fake + X', data=df).fit().params['treat_fake']
    placebo.append(b)
placebo = np.array(placebo)
p_placebo = (np.abs(placebo) >= np.abs(real_beta)).mean()
# p<0.05 → 真实效应显著异于安慰剂分布；再画核密度图对比`},
 {type:'callout', kind:'tip', title:'汇报口径', body:'「经 500 次随机置换安慰剂检验，真实效应位于安慰剂分布的 99.2% 分位之外（p=0.008），表明估计结果并非由随机因素驱动。」'}
]},
{h:'案例：审稿人的三个追问', blocks:[
 {type:'analogy', title:'通俗类比 · 稳健性像「换人检验」', body:'你宣称「这口锅炒菜不粘」。审稿人（老板/导师）不信，要求**换个厨师炒、换个菜试、换个锅铲再试**——都还不粘，结论才硬气。替换变量就是换菜，缩尾就是换个锅铲，安慰剂就是找个不会炒菜的人来炒（应该粘锅）。'},
 {type:'case', title:'一篇论文从质疑到录用', story:'你的论文「数字素养提升员工绩效」收到审稿意见，三个问题一个比一个尖锐。你逐条用稳健性检验回应：',
   steps:[
    {t:'追问一：换指标还成立吗？', d:'把绩效指标从「自评」换成「上级评价」重新估计 → 系数从 0.24 变为 0.21，显著性不变 → 结论不依赖特定度量。'},
    {t:'追问二：是不是极端值驱动？', d:'对连续变量 1% 双侧缩尾 + 剔除 Cook 距离前 1% 强影响点 → 结论稳健。'},
    {t:'追问三：会不会是安慰剂效应？', d:'随机置换处理组 500 次：真实效应位于安慰剂分布 99% 分位之外（p=0.01）→ 排除虚假效应。'},
    {t:'加分项：图表与表格规范化', d:'折线图改线型区分（黑白可读）、柱状图 y 轴从 0 开始、回归结果表改为三线表并标注显著性星号口径。'}
   ],
   conclusion:'三个检验全部通过，图表规范达标——第二轮审稿直接录用。**稳健性检验不是「多做几遍」，而是针对质疑逐条给出证据。**'},
 {type:'quickcheck', id:'qc-08-robustness'}
]},
{h:'结果核验清单（交付前必过）', blocks:[
 {type:'p', body:'逐项勾选。全部通过后，结果才具备交付条件。清单状态保存在本地，可跨模块会话保持。'},
 {type:'tool', id:'robust-check'}
]},
{h:'学术图表规范', blocks:[
 {type:'table', headers:['规范项','要求','常见扣分点'], rows:[
   ['清晰性','一图一意；坐标轴标签+单位；图例必要才加','单位缺失、字体过小、信息过载'],
   ['可复现性','数据+脚本可重跑出同图','手工修饰后无法复现'],
   ['黑白可读','灰阶打印仍可区分系列（线型/填充纹理区分）','只靠颜色区分系列'],
   ['显著性标注','* p<0.1, ** p<0.05, *** p<0.01 并在图注说明','只画图不标注检验结果'],
   ['诚实性','y 轴从 0 开始（柱状）；截断轴必须明确标识','截断 y 轴放大差异'],
   ['导出质量','矢量图（PDF/SVG/EPS）或 ≥300dpi 位图','低分辨率截图']
 ]},
 {type:'code', lang:'python', title:'matplotlib 规范出图模板', body:
`import matplotlib.pyplot as plt
plt.rcParams.update({'font.family':'serif','font.size':11,
                     'axes.spines.top':False,'axes.spines.right':False})
fig, ax = plt.subplots(figsize=(7, 4.2), dpi=300)
ax.bar(x, y, color='#4f46e5', width=.6)
ax.set_xlabel('学历'); ax.set_ylabel('满意度均值（分）')
ax.set_ylim(0, 30)                       # 柱状图 y 轴必须含 0
ax.text(.02, .96, '** p<0.05', transform=ax.transAxes, va='top')
fig.savefig('fig1_satisfaction.pdf', bbox_inches='tight')`}
]},
{h:'实证结果写作模板', blocks:[
 {type:'code', lang:'text', title:'结果段落标准句式', body:
`【表 X 报告了基准回归结果】列(1)仅含核心解释变量，列(2)加入个体特征，
列(3)进一步控制行业固定效应。结果显示，核心解释变量 X 的系数在 1%
水平上显著为正（β=1.83, SE=0.41, p<0.01），经济含义为：X 每提高 1 个
单位，Y 平均提高 1.83 个单位，相当于样本均值的 12.4%。

【稳健性】替换 Y 的度量方式（列 4）、对连续变量 1% 缩尾（列 5）、
剔除强影响点（列 6）后，系数符号与显著性均未发生实质变化，表明
基准结论稳健。

【异质性】分样本回归显示，效应在大型企业中更明显（β=2.31 vs 1.02，
组间差异 p=0.032），提示该效应的发挥依赖组织规模。`},
 {type:'callout', kind:'info', title:'写作纪律', body:'结果段落回答三个问题：① 效应是否存在（系数+显著性）；② 效应有多大（经济含义/效应量）；③ 是否可信（稳健性）。**只陈述，不夸大**——「显著相关」不写「证明因果」。'},
 {type:'scenario', id:'sc-08-robustness'}
]}
],
faq:[
 {q:'稳健性检验做多少算够？', a:'没有固定数量，原则是覆盖「读者最容易质疑的设定」：核心变量度量、样本范围、模型形式、标准误选择。3-5 项针对性检验比 20 项敷衍检验更有说服力。'},
 {q:'稳健性检验结果不一致怎么办？', a:'诚实报告不一致，并分析原因：哪一项检验最贴近真实设定？不一致往往揭示结论的边界条件（如效应只在某子样本存在），这本身是重要发现，而不是失败。'},
 {q:'安慰剂检验和稳健性检验是什么关系？', a:'安慰剂是稳健性检验中针对「因果识别」的专项检验，用于排除虚假效应；替换变量/缩尾等针对的是「度量与样本」的稳健性。两者互补。'},
 {q:'图表里的显著性星号怎么标才规范？', a:'统一口径并在图注声明：* p<0.1，** p<0.05，*** p<0.01。只在统计检验有意义的地方标注（组间差异、相关系数、回归系数），描述性图表不标星号。'}
]
});
})();
