/* 课程 06：相关分析与回归分析（REGRESSION） */
(function(){
if(!window.COURSES) window.COURSES=[];
window.COURSES.push({
id:'06-regression', no:'06', icon:'📈', title:'相关分析与回归分析', tag:'REGRESSION', keywords:['相关','Pearson','Spearman','回归','多元线性','固定效应','动态效应','共线性','VIF','异方差','诊断'],
subtitle:'Pearson / Spearman · 多元线性 · 固定效应 · 动态效应 · 共线性 · 异方差 · 模型诊断',
prerequisites:'先修：模块 02（方法选择）、04（描述统计）',
objectives:[
  '能根据变量测度正确选择 Pearson 或 Spearman 相关',
  '掌握多元线性回归的设定、估计与系数解读',
  '理解固定效应与动态效应的含义与实现',
  '会做共线性（VIF）、异方差与残差诊断'
],
sections:[
{h:'相关分析：Pearson vs Spearman', blocks:[
 {type:'table', headers:['方法','适用条件','度量','稳健性'], rows:[
   ['Pearson','双连续变量、近似正态、线性关系','线性相关强度与方向 r ∈ [-1,1]','对异常值敏感，受非线性干扰'],
   ['Spearman','定序变量，或连续但非正态/非线性单调','秩相关 ρ（单调关系）','抗异常值，只要求单调'],
   ['Kendall τ','小样本、多并列秩','秩相关 τ','更稳健但功效略低']
 ]},
 {type:'callout', kind:'formula', title:'Pearson 相关系数', fx:'r = Σ(xᵢ−x̄)(yᵢ−ȳ) / √( Σ(xᵢ−x̄)² · Σ(yᵢ−ȳ)² )，取值 −1（完全负相关）~ +1（完全正相关），0 为无线性相关'},
 {type:'callout', kind:'warn', title:'解读纪律', body:'① 相关 ≠ 因果；② r=0 只说明无**线性**关系，可能存在 U 型等非线性关系；③ 报告时给 r 的置信区间与 p 值；④ r 的强度参考：|r|<0.3 弱、0.3-0.5 中等、>0.5 强（社科口径）。'},
 {type:'tool', id:'corr-reg-demo'}
]},
{h:'案例：房价影响因素分析', blocks:[
 {type:'analogy', title:'通俗类比 · 回归是一条「平均法则」', body:'回归回答的问题像商店里的「均价」：**在身高相近的人群里，体重平均是多少**。它不预测某一个人，而是给出「条件平均」——控制其他因素后，X 每动一下，Y 平均跟着动多少。'},
 {type:'case', title:'300 套二手房的完整建模', story:'你要分析二手房价格的影响因素：300 套成交数据，含价格、面积、房龄、楼层、装修等级、地铁距离。',
   steps:[
    {t:'第 1 步 · 探索', d:'价格严重右偏 → 取对数；面积-价格散点图在对数后近似线性，方向符合预期。'},
    {t:'第 2 步 · 相关预检', d:'log(价格) 与面积 Pearson r = 0.71（强正相关）——相关先看方向与强度。'},
    {t:'第 3 步 · 回归设定', d:'log(价格) ~ 面积 + 房龄 + 楼层 + 装修等级（哑变量）+ 地铁距离。'},
    {t:'第 4 步 · 诊断', d:'VIF < 3 无共线性；残差图呈漏斗形 → 异方差 → 改用稳健标准误（HC1）重新推断。'},
    {t:'第 5 步 · 解读', d:'对数模型里斜率即弹性：面积每 +1㎡，价格平均 +1.1%；房龄每 +1 年，价格 −0.8%（均 p<0.01）。'}
   ],
   conclusion:'诊断不是走流程——若没发现漏斗形残差、继续用普通标准误，显著性与置信区间都会失真。**「跑出回归」只是开始，「诊断后的回归」才能写进报告。**'},
 {type:'quickcheck', id:'qc-06-regression'}
]},
{h:'多元线性回归', blocks:[
 {type:'callout', kind:'formula', title:'模型设定', fx:'Y = β₀ + β₁X₁ + β₂X₂ + … + βₖXₖ + ε，ε ~ N(0, σ²)（假设：线性、独立、同方差、正态、无严重共线性）'},
 {type:'ul', items:[
   '**β 的解读**：控制其他变量不变时，X 每变化 1 单位，Y 平均变化 β 单位。',
   '**标准化系数 β***：量纲差异大时比较变量相对重要性。',
   '**R² 与调整 R²**：模型解释的方差比例；变量增多时看调整 R²。',
   '**分类自变量**：哑变量进入（k-1 个），系数解读为「相对参照组的差异」。'
 ]},
 {type:'code', lang:'python', title:'多元回归 + 稳健标准误', body:
`import statsmodels.formula.api as smf

m = smf.ols('sat ~ age + income + C(edu) + C(gender)', data=df).fit()
print(m.summary())

# 存在异方差时用稳健标准误（HC1）
m_rob = m.get_robustcov_results(cov_type='HC1')
print(m_rob.summary())

# 标准化系数（量纲可比）
from scipy import stats as st
X_std = df[['age','income']].apply(st.zscore)`}
]},
{h:'固定效应与动态效应', blocks:[
 {type:'ul', items:[
   '**固定效应（FE）**：控制**不随时间变化**的不可观测个体特征（能力、文化、地理禀赋）。横截面数据中用**组别/地区固定效应**（行业、省份哑变量）吸收组内共同冲击。',
   '**动态效应**：解释变量对结果的影响**随时间变化**（当期、滞后、长期）。实现方式：加入滞后项 Yₜ₋₁（动态面板，模块 07），或事件研究中分期的虚拟变量（模块 07），或分布滞后模型。',
   '**个体固定效应（面板）**：Yᵢₜ = βXᵢₜ + αᵢ + εᵢₜ，αᵢ 为个体截距——识别的是**组内（within）变异**，即「同一个体随时间变化」的效应，是因果识别的重要工具。'
 ]},
 {type:'code', lang:'stata', title:'固定效应回归', body:
`* 横截面：行业/地区固定效应
reg income age i.edu i.industry, vce(robust)

* 面板：个体固定效应（模块 07 详述）
xtset id year
xtreg income age edu, fe vce(cluster id)

* 动态效应：加入滞后因变量
gen l_income = L.income
xtreg income l_income age edu, fe`}
]},
{h:'多重共线性（VIF）', blocks:[
 {type:'ul', items:[
   '**含义**：自变量之间高度相关，导致系数方差膨胀、符号不稳、显著性失真。',
   '**诊断**：VIF = 1/(1−R²ⱼ)（Xⱼ 对其余自变量的回归）。经验规则：VIF>10（或均值>3）提示严重共线性。',
   '**处理**：删除冗余变量；合并相关变量（如分项合成总分）；中心化后建交互项；使用岭回归/LASSO；增加样本。'
 ]},
 {type:'code', lang:'python', title:'VIF 计算', body:
`from statsmodels.stats.outliers_influence import variance_inflation_factor
X = sm.add_constant(df[['age','income','edu_years','tenure']])
vif = pd.Series([variance_inflation_factor(X.values, i)
                 for i in range(X.shape[1])], index=X.columns)
print(vif)   # 任一列 VIF > 10 需处理`}
]},
{h:'异方差与自相关', blocks:[
 {type:'ul', items:[
   '**异方差**：残差方差随 X 变化（收入越高波动越大）。后果：标准误有偏 → p 值失真。诊断：Breusch-Pagan / White 检验 + 残差-拟合值散点图（漏斗形）。处理：**稳健标准误（HC）**、WLS、变量变换。',
   '**自相关**：时间序列/面板中相邻期残差相关。诊断：Durbin-Watson（横截面序列）、面板中 Wooldridge 检验。处理：聚类稳健标准误（cluster）、Newey-West、AR 项。'
 ]},
 {type:'code', lang:'python', title:'异方差与自相关诊断', body:
`# Breusch-Pagan 异方差检验
from statsmodels.stats.diagnostic import het_breuschpagan
bp = het_breuschpagan(m.resid, m.model.exog)

# Durbin-Watson 自相关
from statsmodels.stats.stattools import durbin_watson
dw = durbin_watson(m.resid)      # ≈2 无自相关；→0 正自相关；→4 负自相关

# 残差图（异方差的视觉证据）
import matplotlib.pyplot as plt
plt.scatter(m.fittedvalues, m.resid); plt.axhline(0, c='r', ls='--')`}
]},
{h:'模型诊断完整清单', blocks:[
 {type:'ol', items:[
   '**设定**：变量缺漏/多余（信息准则 AIC/BIC 比较）、函数形式（RESET 检验）、交互项必要性；',
   '**异常点**：Cook 距离、杠杆值、学生化残差；强影响点需做敏感性分析；',
   '**共线性**：VIF；**异方差**：BP/White + 残差图；**正态性**：Q-Q 图、Shapiro-Wilk；',
   '**稳健性**：换标准误、缩尾、加控制变量后系数符号与显著性是否稳定（模块 08）。'
 ]},
 {type:'callout', kind:'tip', title:'报告纪律', body:'回归结果表中报告：系数、标准误（或 t 值）、p 值、标准化系数（可选）、样本量、R²/调整 R²、F 检验。显著性与符号分开解读——**符号看经济意义，显著性看统计证据**。'},
 {type:'scenario', id:'sc-06-regression'}
]}
],
faq:[
 {q:'相关系数显著（p<0.05）但很小（r=0.15），有意义吗？', a:'统计显著只是「不是零」的证据；r=0.15 说明只有约 2% 的共享方差，实务上意义微弱。结论应写「存在弱正相关但实际意义有限」，并考虑是否遗漏了非线性或调节机制。'},
 {q:'什么时候必须用 Spearman？', a:'任一变量是定序变量；或连续变量严重偏态/存在异常值且不想做变换；或关系明显非线性但单调。Pearson 对这几种情况都会低估或误导。'},
 {q:'VIF 高但系数都显著，还需要处理吗？', a:'需要。共线性下系数估计不稳定——换个样本符号可能翻转，单个系数不可信，且标准误膨胀可能导致「该显著的没显著」。除非只关心整体预测（如机器学习场景），否则要处理。'},
 {q:'固定效应和「加入哑变量」是一回事吗？', a:'在横截面里，组固定效应=加入组哑变量，等价。在面板里，个体固定效应可以用「去均值变换（within）」估计，数学上与加入 N-1 个个体哑变量等价，但计算上更高效，且识别的是组内变异。'}
]
});
})();
