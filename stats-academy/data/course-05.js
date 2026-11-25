/* 课程 05：问卷分析与统计推断（SURVEY） */
(function(){
if(!window.COURSES) window.COURSES=[];
window.COURSES.push({
id:'05-survey', no:'05', icon:'📝', title:'问卷分析与统计推断', tag:'SURVEY', keywords:['问卷','Likert','信度','Cronbach','KMO','因子分析','t检验','方差分析','卡方','ANOVA'],
subtitle:'Likert 量表 · Cronbach\'s α · KMO / EFA · t 检验 · 方差分析 · 卡方',
objectives:[
  '掌握 Likert 量表设计规范（点数、反向题、合成计分）',
  '会计算并解读 Cronbach\'s α 信度与 KMO/EFA 效度',
  '会选用 t 检验、方差分析与卡方检验做组间比较',
  '理解「先信效度、后推断」的问卷分析顺序'
],
sections:[
{h:'Likert 量表基础', blocks:[
 {type:'ul', items:[
   '**点数**：4/5/7 点最常见。5 点与 7 点信度差异很小；点数越多区分度越高但填写负担越大。',
   '**反向题**：同一维度中故意设置反向表述（如「我工作时感到压力很大」），检验作答认真度，计分时翻转。',
   '**合成计分**：同一维度的多题加总/平均得到维度分，再进入后续分析；合成前必须通过信效度检验。',
   '**量表引用**：优先使用已发表的成熟量表（有信效度证据），自编量表必须报告完整的开发与检验过程。'
 ]},
 {type:'table', headers:['设计要点','建议','原因'], rows:[
   ['题项方向','同维度 6-8 成正向 + 2-4 成反向','识别乱填与默许偏差'],
   ['选项标签','全标注（非常不同意→非常同意）','仅两端标注中间含义不清'],
   ['维度题数','每维度 3-7 题','太少信度不足，太多疲劳效应'],
   ['预测试','正式发放前 30-50 人预试','检查歧义、作答时间、信度']
 ]}
]},
{h:'信度：Cronbach\'s α', blocks:[
 {type:'callout', kind:'formula', title:'计算公式', fx:'α = (k / (k − 1)) · ( 1 − Σsᵢ² / sₜ² )，其中 k 为题数，sᵢ² 为第 i 题方差，sₜ² 为总分方差'},
 {type:'table', headers:['α 值','评价','处理建议'], rows:[
   ['α ≥ 0.9','优秀','可用于高风险决策（选拔/晋升）'],
   ['0.8 ≤ α < 0.9','良好','研究使用的主流标准'],
   ['0.7 ≤ α < 0.8','可接受','探索性研究可用；检查「删除该项后的 α」'],
   ['0.6 ≤ α < 0.7','偏低','需修订：删弱题项或增加题数'],
   ['α < 0.6','不合格','维度结构需重构']
 ]},
 {type:'tool', id:'alpha-calc'},
 {type:'code', lang:'python', title:'α 与删除某项后的 α', body:
`import pandas as pd, numpy as np

def cronbach_alpha(items):           # items: DataFrame, 每列一题
    k = items.shape[1]
    return k/(k-1) * (1 - items.var(axis=0, ddof=1).sum() / items.sum(axis=1).var(ddof=1))

alpha_all = cronbach_alpha(df[cols])
drop_if = {c: cronbach_alpha(df[cols].drop(columns=c)) for c in cols}
print("总量表 α =", round(alpha_all, 3))
print("删除该项后 α:", {k: round(v,3) for k,v in drop_if.items()})`}
]},
{h:'效度：KMO 与探索性因子分析（EFA）', blocks:[
 {type:'ul', items:[
   '**KMO**（0-1）度量变量间偏相关强度：<0.5 不适合因子分析；0.5-0.6 勉强；0.6-0.7 尚可；0.7-0.8 适合；>0.8 很适合。',
   '**Bartlett 球形检验**：p<0.05 表示相关矩阵非单位阵，适合做因子分析。',
   '**EFA 步骤**：① KMO/Bartlett 预检 → ② 提取因子（主成分/主轴法，特征值>1 或碎石图拐点）→ ③ 旋转（正交 varimax / 斜交 promax）→ ④ 解读载荷（|载荷|>0.4 归入因子，交叉载荷<0.3）→ ⑤ 命名因子。'
 ]},
 {type:'code', lang:'python', title:'KMO + EFA', body:
`from factor_analyzer import FactorAnalyzer
from factor_analyzer.factor_analyzer import calculate_kmo, calculate_bartlett_sphericity

kmo_all, kmo_model = calculate_kmo(df[cols])
chi2, p = calculate_bartlett_sphericity(df[cols])
print(f"KMO = {kmo_model:.3f}, Bartlett p = {p:.4g}")

fa = FactorAnalyzer(n_factors=3, rotation='varimax')
fa.fit(df[cols])
loadings = pd.DataFrame(fa.loadings_, index=cols)   // 载荷矩阵
print(loadings.round(3))`}
]},
{h:'t 检验：三种形态', blocks:[
 {type:'table', headers:['类型','问题','使用条件','示例'], rows:[
   ['单样本 t','样本均值是否等于已知总体值 μ0','单组、近似正态','满意度均值是否等于中值 3'],
   ['独立样本 t','两组独立样本均值是否相等','两组独立、方差齐性（Welch 修正可放宽）','男女满意度比较'],
   ['配对样本 t','同一批对象前后 / 配对差值','差值近似正态','培训前后能力得分']
 ]},
 {type:'tool', id:'ttest-demo'},
 {type:'code', lang:'python', title:'t 检验', body:
`from scipy import stats
# 独立样本 t（Welch 修正，默认不等方差更稳健）
t, p = stats.ttest_ind(df_male['sat'], df_female['sat'], equal_var=False)
# 配对 t
t, p = stats.ttest_rel(df['post'], df['pre'])
# 效应量 Cohen's d
d = (df_male['sat'].mean() - df_female['sat'].mean()) / \\\\
    ((df_male['sat'].std(ddof=1)**2 + df_female['sat'].std(ddof=1)**2) / 2) ** 0.5`}
]},
{h:'方差分析（ANOVA）', blocks:[
 {type:'ul', items:[
   '**单因素 ANOVA**：比较 3 组及以上均值（如四类学历的收入差异）。F = 组间方差 / 组内方差；显著后需做**事后多重比较**（Tukey HSD / Bonferroni）定位差异来源。',
   '**双因素 ANOVA**：两个分类自变量及其交互效应（如性别 × 部门对满意度）。',
   '**前提**：各组近似正态 + 方差齐性（Levene 检验）；违反正态性时用 Kruskal-Wallis（非参数）。',
   '**效应量**：η² = 组间平方和 / 总平方和（0.01 小 / 0.06 中 / 0.14 大）。'
 ]},
 {type:'code', lang:'python', title:'单因素 ANOVA + 事后检验', body:
`from scipy import stats
import statsmodels.api as sm
from statsmodels.formula.api import ols
from statsmodels.stats.multicomp import pairwise_tukeyhsd

model = ols('income ~ C(edu)', data=df).fit()
anova = sm.stats.anova_lm(model, typ=2)      # F 值与 p 值

# 方差齐性
lev = stats.levene(*[g['income'].values for _, g in df.groupby('edu')])
# 事后两两比较
tukey = pairwise_tukeyhsd(df['income'], df['edu'], alpha=0.05)`}
]},
{h:'卡方检验', blocks:[
 {type:'p', body:'用于**分类变量**的关联/差异检验：拟合优度卡方（单变量分布是否符合预期比例）与独立性卡方（两个分类变量是否相关）。核心是比较**观察频数与期望频数**的偏离。'},
 {type:'callout', kind:'formula', title:'统计量', fx:'χ² = Σ (O − E)² / E，自由度 df = (r−1)(c−1)；要求期望频数 <5 的格不超过 20%，且无格为 0（否则用 Fisher 精确检验）'},
 {type:'tool', id:'chisq-demo'},
 {type:'code', lang:'stata', title:'Stata 卡方', body:
`tab gender turnover, chi2 expected row   // 独立性卡方 + 期望频数 + 行百分比
tab gender turnover, exact               // 小样本 Fisher 精确检验
csgof edu, expperc(10 30 40 20)          // 拟合优度（按设定比例）`}
]},
{h:'问卷分析标准顺序', blocks:[
 {type:'ol', items:[
   '数据清洗与反向计分（模块 03）→ 2. 描述统计（模块 04）→ 3. 信度 α → 4. 效度 KMO/EFA → 5. 组间比较（t/ANOVA/卡方）→ 6. 关系模型（回归，模块 06）→ 7. 稳健性与报告（模块 08）。',
   '**信效度不合格就不要进入推断**：α<0.6 或 KMO<0.5 时先修订量表，否则后续结论没有地基。'
 ]}
]}
],
faq:[
 {q:'α 很高（0.95+）就一定是好量表吗？', a:'不一定。α 过高可能意味着题目严重冗余（同一意思反复问）。0.90-0.95 通常已是上限，再高反而提示题项同质性过剩、覆盖面变窄。'},
 {q:'t 检验显著但样本很大，怎么解读？', a:'必须看效应量 Cohen\'s d：d<0.2 微小、0.2-0.5 小、0.5-0.8 中等、>0.8 大。大样本下 d=0.1 也能显著，但实际差异可能毫无业务意义。'},
 {q:'KMO 和 Bartlett 先看哪个？', a:'两个都看：KMO 看「抽样充分性」，Bartlett 看「相关矩阵是否可分解」。常见结论写法：「KMO=0.82，Bartlett 球形检验 p<0.001，适合进行因子分析」。'},
 {q:'三组以上比较为什么不能做多个 t 检验？', a:'每做一次 t 检验都有 α=5% 的 I 类错误风险，多次比较错误率累积（3 组两两比较约 14%）。ANOVA 先做整体 F 检验，显著后再做多重比较并校正 α。'}
]
});
})();
