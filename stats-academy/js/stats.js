/* 统计计算函数库（浏览器端数值实现）
 * 提供：描述统计、相关、回归、t 检验、卡方检验、Cronbach's α、
 * 以及支撑它们的不完全 Gamma / Beta 函数与 t、卡方分布的 p 值计算。
 */
window.Stats = (function(){
'use strict';

/* ---------- 基础 ---------- */
function mean(a){ return a.reduce((s,x)=>s+x,0)/a.length; }
function variance(a, ddof){ const m=mean(a); return a.reduce((s,x)=>s+(x-m)*(x-m),0)/(a.length-(ddof||0)); }
function std(a, ddof){ return Math.sqrt(variance(a, ddof)); }
function median(a){ const s=[...a].sort((x,y)=>x-y), n=s.length, h=n>>1;
  return n%2 ? s[h] : (s[h-1]+s[h])/2; }
function quantile(a, q){ const s=[...a].sort((x,y)=>x-y);
  if(!s.length) return NaN;
  const pos=(s.length-1)*q, lo=Math.floor(pos), hi=Math.ceil(pos);
  return s[lo]+(s[hi]-s[lo])*(pos-lo); }
function min(a){ return Math.min(...a); }
function max(a){ return Math.max(...a); }
function range(a){ return max(a)-min(a); }
function iqr(a){ return quantile(a,.75)-quantile(a,.25); }
function skewness(a){ const n=a.length, m=mean(a), s=std(a,1);
  if(s===0) return NaN;
  return (n/((n-1)*(n-2)))*a.reduce((t,x)=>t+Math.pow((x-m)/s,3),0); }
function kurtosis(a){ const n=a.length, m=mean(a), s=std(a,1);
  if(s===0) return NaN;
  const t1=(n*(n+1))/((n-1)*(n-2)*(n-3)), t3=3*(n-1)*(n-1)/((n-2)*(n-3));
  return t1*a.reduce((t,x)=>t+Math.pow((x-m)/s,4),0)-t3; } // 超额峰度
function cv(a){ return std(a,1)/mean(a); }

/* ---------- 秩 ---------- */
function rankAvg(a){ // 平均秩
  const order=[...a.keys()].sort((i,j)=>a[i]-a[j]);
  const r=new Array(a.length);
  let i=0;
  while(i<a.length){
    let j=i;
    while(j+1<a.length && a[order[j+1]]===a[order[i]]) j++;
    const rk=(i+1+j+1)/2;
    for(let k=i;k<=j;k++) r[order[k]]=rk;
    i=j+1;
  }
  return r;
}
function corrPearson(x,y){ const n=x.length;
  const mx=mean(x), my=mean(y);
  let sxy=0,sxx=0,syy=0;
  for(let i=0;i<n;i++){ sxy+=(x[i]-mx)*(y[i]-my); sxx+=(x[i]-mx)*(x[i]-mx); syy+=(y[i]-my)*(y[i]-my); }
  const d=Math.sqrt(sxx*syy);
  return d===0 ? NaN : sxy/d;
}
function corrSpearman(x,y){
  const rx=rankAvg(x), ry=rankAvg(y);
  return corrPearson(rx,ry);
}

/* ---------- 线性回归 ---------- */
function linReg(x,y){
  const n=x.length, mx=mean(x), my=mean(y);
  let sxy=0,sxx=0;
  for(let i=0;i<n;i++){ sxy+=(x[i]-mx)*(y[i]-my); sxx+=(x[i]-mx)*(x[i]-mx); }
  const b1=sxx===0?NaN:sxy/sxx, b0=my-b1*mx;
  const yhat=x.map(v=>b0+b1*v);
  const res=y.map((v,i)=>v-yhat[i]);
  const ssRes=res.reduce((s,e)=>s+e*e,0), ssTot=y.reduce((s,v)=>s+(v-my)*(v-my),0);
  const r2=ssTot===0?NaN:1-ssRes/ssTot;
  const se2=ssRes/(n-2);
  const seB1=Math.sqrt(se2/sxx), seB0=Math.sqrt(se2*(1/n+mx*mx/sxx));
  return {b0,b1,r2,r:Math.sqrt(Math.max(0,r2)),seB0,seB1,res};
}

/* ---------- 特殊函数 ---------- */
function logGamma(x){ // Lanczos g=7
  const c=[0.99999999999980993,676.5203681218851,-1259.1392167224028,
    771.32342877765313,-176.61502916214059,12.507343278686905,
    -0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
  if(x<0.5) return Math.log(Math.PI/Math.sin(Math.PI*x))-logGamma(1-x);
  x-=1; let a=c[0], t=x+7.5;
  for(let i=1;i<9;i++) a+=c[i]/(x+i);
  return 0.5*Math.log(2*Math.PI)+(x+0.5)*Math.log(t)-t+Math.log(a);
}
function gammaP(a,x){ // 正则化下不完全 gamma P(a,x)
  if(x<0||a<=0) return NaN;
  if(x<a+1){ // 级数
    let ap=a, sum=1/a, del=sum;
    for(let i=0;i<200;i++){
      ap+=1; del*=x/ap; sum+=del;
      if(Math.abs(del)<Math.abs(sum)*1e-14) break;
    }
    return sum*Math.exp(-x+a*Math.log(x)-logGamma(a));
  } else { // 连分式（Lentz）
    const EPS=1e-15, FPMIN=1e-300;
    let b=x+1-a, c=1/FPMIN, d=1/b, h=d;
    for(let i=1;i<=300;i++){
      const an=-i*(i-a);
      b+=2;
      d=an*d+b; if(Math.abs(d)<FPMIN) d=FPMIN;
      c=b+an/c; if(Math.abs(c)<FPMIN) c=FPMIN;
      d=1/d; const del=d*c; h*=del;
      if(Math.abs(del-1)<EPS) break;
    }
    return 1-Math.exp(-x+a*Math.log(x)-logGamma(a))*h;
  }
}
function gammaQ(a,x){ return 1-gammaP(a,x); }
function betaContinuedFraction(a,b,x){ // 不完全 beta 连分式
  const EPS=1e-13, FPMIN=1e-300, MAXIT=300;
  const qab=a+b, qap=a+1, qam=a-1;
  let c=1, d=1-qab*x/qap;
  if(Math.abs(d)<FPMIN) d=FPMIN;
  d=1/d; let h=d;
  for(let m=1;m<=MAXIT;m++){
    const m2=2*m;
    let aa=m*(b-m)*x/((qam+m2)*(a+m2));
    d=1+aa*d; if(Math.abs(d)<FPMIN) d=FPMIN;
    c=1+aa/c; if(Math.abs(c)<FPMIN) c=FPMIN;
    d=1/d; h*=d*c;
    aa=-(a+m)*(qab+m)*x/((a+m2)*(qap+m2));
    d=1+aa*d; if(Math.abs(d)<FPMIN) d=FPMIN;
    c=1+aa/c; if(Math.abs(c)<FPMIN) c=FPMIN;
    d=1/d; const del=d*c; h*=del;
    if(Math.abs(del-1)<EPS) break;
  }
  return h;
}
function betaReg(a,b,x){ // 正则化不完全 beta I_x(a,b)
  if(x<=0) return 0;
  if(x>=1) return 1;
  const bt=Math.exp(logGamma(a+b)-logGamma(a)-logGamma(b)+a*Math.log(x)+b*Math.log(1-x));
  if(x<(a+1)/(a+b+2)) return bt*betaContinuedFraction(a,b,x)/a;
  return 1-bt*betaContinuedFraction(b,a,1-x)/b;
}
function tCdf(t, df){ // 学生 t 分布 CDF（t≥0）
  const x=df/(df+t*t);
  return 1-0.5*betaReg(df/2,0.5,x);
}
function tPvalue(t, df){ // 双尾 p
  return 2*(1-tCdf(Math.abs(t),df));
}
function chi2Pvalue(chi2, df){ return gammaQ(df/2, chi2/2); }

/* ---------- 检验 ---------- */
function welchTTest(x,y){
  const nx=x.length, ny=y.length;
  const mx=mean(x), my=mean(y), vx=variance(x,1), vy=variance(y,1);
  const se=Math.sqrt(vx/nx+vy/ny);
  const t=(mx-my)/se;
  const df=Math.pow(vx/nx+vy/ny,2)/
    (Math.pow(vx/nx,2)/(nx-1)+Math.pow(vy/ny,2)/(ny-1));
  const p=tPvalue(t,df);
  const sp=Math.sqrt(((nx-1)*vx+(ny-1)*vy)/(nx+ny-2));
  const d=(mx-my)/sp;
  return {t,df,p,d,mx,my,nx,ny,se};
}
function chi2Indep(table){ // table: 二维数组（观察频数）
  const r=table.length, c=table[0].length;
  const n=table.flat().reduce((s,x)=>s+x,0);
  const rowSum=table.map(rw=>rw.reduce((s,x)=>s+x,0));
  const colSum=[];
  for(let j=0;j<c;j++){ let s=0; for(let i=0;i<r;i++) s+=table[i][j]; colSum.push(s); }
  let chi2=0, minE=Infinity;
  for(let i=0;i<r;i++) for(let j=0;j<c;j++){
    const e=rowSum[i]*colSum[j]/n;
    if(e>0) chi2+=(table[i][j]-e)*(table[i][j]-e)/e;
    minE=Math.min(minE,e);
  }
  const df=(r-1)*(c-1);
  const p=chi2Pvalue(chi2,df);
  const v=Math.sqrt(chi2/(n*Math.min(r-1,c-1)));
  return {chi2,df,p,v,n,minE};
}
function cronbachAlpha(mat){ // mat: 二维 [被试][题]
  const n=mat.length, k=mat[0].length;
  if(n<3||k<2) return {alpha:NaN, k, n};
  const itemVar=[], totals=mat.map(rw=>rw.reduce((s,x)=>s+x,0));
  for(let j=0;j<k;j++){
    const col=mat.map(rw=>rw[j]);
    itemVar.push(variance(col,1));
  }
  const sTotal=variance(totals,1);
  const alpha=k/(k-1)*(1-itemVar.reduce((s,x)=>s+x,0)/sTotal);
  const drop=[];
  for(let j=0;j<k;j++){
    const sub=mat.map(rw=>rw.filter((_,jj)=>jj!==j));
    const tv=sub.map(rw=>rw.reduce((s,x)=>s+x,0));
    const iv=[]; for(let q=0;q<k-1;q++){ const col=sub.map(rw=>rw[q]); iv.push(variance(col,1)); }
    const st=variance(tv,1);
    drop.push((k-1)/(k-2)*(1-iv.reduce((s,x)=>s+x,0)/st));
  }
  return {alpha,k,n,drop};
}

/* ---------- 随机数 ---------- */
function randNorm(n, mu=0, sigma=1, seed){
  let s=seed===undefined?Math.floor(Math.random()*1e9):seed;
  const rng=()=>{ s=(s*1664525+1013904223)>>>0; return s/4294967296; };
  const out=[];
  for(let i=0;i<n;i+=2){
    const u1=Math.max(rng(),1e-12), u2=rng();
    const z=Math.sqrt(-2*Math.log(u1));
    out.push(mu+sigma*z*Math.cos(2*Math.PI*u2));
    if(out.length<n) out.push(mu+sigma*z*Math.sin(2*Math.PI*u2));
  }
  return out;
}
function randSkewed(n, seed){ // 右偏（对数正态）
  const s=seed===undefined?Math.floor(Math.random()*1e9):seed;
  const rng=()=>{ s=(s*1664525+1013904223)>>>0; return s/4294967296; };
  const out=[];
  for(let i=0;i<n;i+=2){
    const u1=Math.max(rng(),1e-12), u2=rng();
    const z=Math.sqrt(-2*Math.log(u1));
    const z1=z*Math.cos(2*Math.PI*u2), z2=z*Math.sin(2*Math.PI*u2);
    out.push(Math.exp(3.5+0.6*z1));
    if(out.length<n) out.push(Math.exp(3.5+0.6*z2));
  }
  return out;
}
function randBimodal(n, seed){
  const a=randNorm(Math.ceil(n/2), 40, 6, seed), b=randNorm(Math.floor(n/2), 70, 5, (seed||1)+7);
  return a.concat(b);
}

/* ---------- 格式化 ---------- */
function fmt(x, d){
  if(!isFinite(x)) return '—';
  if(Math.abs(x)>=1e6||(Math.abs(x)<1e-4&&x!==0)) return x.toExponential(2);
  return x.toFixed(d===undefined?3:d);
}
function pStar(p){
  if(!isFinite(p)) return '—';
  if(p<0.01) return '***';
  if(p<0.05) return '**';
  if(p<0.1) return '*';
  return '';
}

return {mean,variance,std,median,quantile,min,max,range,iqr,skewness,kurtosis,cv,
  rankAvg,corrPearson,corrSpearman,linReg,logGamma,gammaP,gammaQ,betaReg,tCdf,tPvalue,
  chi2Pvalue,welchTTest,chi2Indep,cronbachAlpha,randNorm,randSkewed,randBimodal,fmt,pStar};
})();
