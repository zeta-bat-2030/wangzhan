const REFRESH=300,MASS=new Set(['baidu','toutiao','zhihu','bilibili']);
const COS={'OpenAI':/openai|chatgpt|gpt-?\d|sora|奥特曼/i,'谷歌/Gemini':/google|gemini|deepmind|谷歌/i,'Anthropic/Claude':/anthropic|claude/i,'Meta':/\bmeta\b|llama/i,'xAI/马斯克':/\bxai\b|grok|马斯克/i,'英伟达':/nvidia|英伟达|黄仁勋/i,'DeepSeek':/deepseek|深度求索/i,'微软':/microsoft|copilot|微软/i,'苹果':/apple intelligence|苹果.{0,6}(ai|智能|模型)/i,'百度/文心':/百度|文心|ernie/i,'阿里/通义':/阿里|通义|千问|qwen/i,'字节/豆包':/字节|豆包|火山引擎|即梦/i,'腾讯/混元':/腾讯|混元|元宝/i,'智谱':/智谱|glm/i,'月之暗面/Kimi':/月之暗面|kimi/i,'华为':/华为|昇腾|盘古|鸿蒙/i,'小米':/小米/i,'快手/可灵':/快手|可灵/i};
const CNSTOP=new Set('的 了 和 是 在 与 及 将 为 也 等 被 让 从 对 已 一 个 用 有 不 都 就 我 你 吗 啥 什么 如何 一个 这个 可以 正式 宣布 首款 全新 支持 今日 消息 官方 我们 他们 如果 还是 没有 怎么 为什么 已经 自己 进行 实现 发布 推出 时候 问题 可能 这些 那些 开始 现在 目前 以及'.split(' '));
const ENSTOP=new Set('the a an and or of to in for on with is are be by from at as it this that how why what you we new not can using use vs ai'.split(' '));
let data={platforms:[]},tab='AI精选',expanded=new Set(),alerts=[],seen=new Set(JSON.parse(localStorage.alertSeen||'[]')),prevRank=JSON.parse(localStorage.prevRank||'{}');
let kws=JSON.parse(localStorage.kws||'["DeepSeek","豆包","OpenAI","大模型","Kimi","智能体"]'),cd=REFRESH,first=true;const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=n=>!n?'':n>=1e8?(n/1e8).toFixed(1)+'亿':n>=1e4?(n/1e4).toFixed(1)+'万':String(n);
const ago=t=>{const s=(Date.now()-t)/1000;return s<60?'刚刚':s<3600?(s/60|0)+'分钟前':s<86400?(s/3600|0)+'小时前':(s/86400|0)+'天前';};
const allItems=()=>data.platforms.flatMap(p=>p.items.map((x,i)=>({...x,rank:i+1,pid:p.id,pname:p.name})));
const hitKw=t=>kws.filter(k=>t.toLowerCase().includes(k.toLowerCase()));
async function load(){log('同步中… 拉取 data/cn.json');const get=(u,ms)=>Promise.race([fetch(u).then(r=>{if(!r.ok)throw r.status;return r.json()}),new Promise((_,j)=>setTimeout(()=>j('超时'),ms))]);
 const rs=await Promise.allSettled([get('data/cn.json?_='+Date.now(),15000),get('https://fastly.jsdelivr.net/gh/zeta-bat-2030/ai-radar@main/data/cn.json',8000),get('https://cdn.jsdelivr.net/gh/zeta-bat-2030/ai-radar@main/data/cn.json',8000)]);
 const ok=rs.filter(r=>r.status==='fulfilled').map(r=>r.value).sort((a,b)=>b.updated-a.updated);if(!ok.length){log('[ERR] 数据拉取失败','e');return;}data=ok[0];
 data.platforms.forEach(p=>log(p.ok?`[OK] ${p.name} ← ${p.items.length} 条 · AI ${p.items.filter(x=>x.ai).length}`:`[ERR] ${p.name}: ${p.err}`,p.ok?'':'e'));
 $('cnUpd').textContent=new Date(data.updated).toLocaleString('zh-CN',{hour12:false})+`（${ago(data.updated)}）`;
 detect();render();charts();ticker();cd=REFRESH;log(`同步完成 · ${data.platforms.filter(p=>p.ok).length} 个平台在线 · 预警 ${alerts.length}`,'w');}
function count(el,v){const s=+el.textContent||0,t0=performance.now();const f=n=>{const p=Math.min(1,(n-t0)/900);el.textContent=Math.round(s+(v-s)*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(f)};requestAnimationFrame(f);}
function render(){const P=data.platforms,cats=['AI精选','综合','科技','开发者','全部'],A=allItems();
 $('tabs').innerHTML=cats.map(c=>`<button class="${c===tab?'on':''}" data-c="${c}">${c}<em>${c==='AI精选'?A.filter(x=>x.ai).length:c==='全部'?P.length:P.filter(p=>p.cat===c).length}</em></button>`).join('');
 const q=$('search').value.trim().toLowerCase(),aiOnly=$('aiOnly').checked||tab==='AI精选';
 let ps=P.filter(p=>tab==='AI精选'||tab==='全部'||p.cat===tab);if(tab==='AI精选')ps=[...ps].sort((a,b)=>b.items.filter(x=>x.ai).length-a.items.filter(x=>x.ai).length);
 $('cards').innerHTML=ps.map((p,ci)=>{let it=p.items.map((x,i)=>({...x,rank:i+1}));if(aiOnly)it=it.filter(x=>x.ai);if(q)it=it.filter(x=>x.title.toLowerCase().includes(q));
  const n=expanded.has(p.id)?it.length:10;const ai=p.items.filter(x=>x.ai).length;
  return `<div class="panel card ${p.ok?'':'off'}" style="animation-delay:${ci*40}ms"><div class="ch"><span class="lg" style="background:${p.color};color:${p.color}"><i style="color:#fff;font-style:normal">${p.name[0]}</i></span><div><b>${p.name}</b><small>${p.cat} · ${p.stale?'缓存(本次抓取失败)':p.ok?'在线':'离线'}</small></div><span class="n">AI ${ai}/${p.items.length}</span></div>
  <ol>${p.ok?(it.slice(0,n).map((x,i)=>`<li class="${hitKw(x.title).length?'kw':''}"><span class="rk ${i<3?'t'+(i+1):''}">${aiOnly||q?i+1:x.rank}</span><a class="${x.ai?'ai':''}" href="${esc(x.url)}" target="_blank" rel="noopener" title="${esc(x.title)}${aiOnly?` · 原榜第${x.rank}名`:''}">${esc(x.title)}</a><span class="hv">${x.heat?fmt(x.heat):x.t?ago(x.t):''}</span></li>`).join('')||'<li>// 当前榜单暂无匹配条目</li>'):`<li>// 链路离线：${esc(p.err)}</li>`}</ol>
  <div class="cf"><span>更新于 ${ago(p.updated)}</span>${it.length>10?`<a data-x="${p.id}">${expanded.has(p.id)?'收起 ▲':`展开全部 ${it.length} 条 ▼`}</a>`:''}</div></div>`;}).join('');
 count($('sPlat'),P.filter(p=>p.ok).length);count($('sTotal'),A.length);count($('sAi'),A.filter(x=>x.ai).length);count($('sAlert'),alerts.length);
 $('kwTags').innerHTML=kws.map(k=>`<span title="点击删除" data-k="${esc(k)}">${esc(k)} ✕</span>`).join('');
 $('alertList').innerHTML=alerts.map(a=>`<li class="L-${a.level}"><b>${{red:'🔴 红色',orange:'🟠 橙色',yellow:'🟡 黄色'}[a.level]}</b> [${a.x.pname}] ${esc(a.why)}<br><a href="${esc(a.x.url)}" target="_blank">${esc(a.x.title)}</a></li>`).join('')||'<li>// 暂无预警</li>';}
function ticker(){const t=allItems().filter(x=>x.ai&&x.rank<=15).map(x=>`<span>[${x.pname}#${x.rank}] ${esc(x.title)}</span>`).join('');$('ticker').innerHTML=t+t;}
function log(s,c=''){const L=$('log'),d=document.createElement('div');d.className=c;d.textContent=`${new Date().toLocaleTimeString('zh-CN',{hour12:false})} ${s}`;L.appendChild(d);while(L.children.length>60)L.firstChild.remove();L.scrollTop=1e9;}
function detect(){alerts=[];const news=[],nr={};
 allItems().forEach(x=>{const key=x.pid+'|'+x.title;nr[key]=x.rank;const h=hitKw(x.title),old=prevRank[key];let level=null,why='';
  if(x.ai&&MASS.has(x.pid)&&x.rank<=10){level='red';why=`AI话题登上大众热榜第${x.rank}名`;}
  else if(x.ai&&old&&old-x.rank>=10){level='red';why=`排名飙升 ${old}→${x.rank}`;}
  else if(h.length&&x.rank<=20){level='orange';why=`命中「${h.join('、')}」· 第${x.rank}名`;}
  else if(h.length){level='yellow';why=`命中「${h.join('、')}」`;}
  if(level){const a={level,why,x};alerts.push(a);const k=key+level;if(!seen.has(k)){seen.add(k);news.push(a);}}});
 const o={red:0,orange:1,yellow:2};alerts.sort((a,b)=>o[a.level]-o[b.level]||a.x.rank-b.x.rank);alerts=alerts.slice(0,80);
 prevRank=nr;localStorage.prevRank=JSON.stringify(nr);localStorage.alertSeen=JSON.stringify([...seen].slice(-3000));
 if(news.length&&!first){news.slice(0,5).forEach(a=>log(`!! 预警[${a.level}] ${a.x.title.slice(0,40)}`,'e'));if($('soundT').checked)beep(news.some(a=>a.level==='red'));if($('notifyT').checked&&'Notification'in window&&Notification.permission==='granted')news.slice(0,3).forEach(a=>new Notification('AI 预警 · '+a.why,{body:`[${a.x.pname}] ${a.x.title}`}));}first=false;}
function beep(red){const c=new AudioContext(),o=c.createOscillator(),g=c.createGain();o.type='square';o.frequency.value=red?880:520;o.connect(g);g.connect(c.destination);g.gain.setValueAtTime(.12,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.5);o.start();o.stop(c.currentTime+.5);}
const C={};const ch=id=>C[id]||(C[id]=echarts.init($(id)));const ax={axisLine:{lineStyle:{color:'#0a7a52'}},axisLabel:{color:'#3fbf8a',fontFamily:'monospace'},splitLine:{lineStyle:{color:'#06301f'}}};
const PAL=['#00ff9c','#00e5ff','#ffd93d','#ff3d5a','#c48bff','#ff9a3d'];
function words(A){const wc={},seg=window.Intl&&Intl.Segmenter?new Intl.Segmenter('zh',{granularity:'word'}):null;
 A.forEach(x=>{const w=1+(x.rank<=10?.5:0);(x.title.match(/[A-Za-z][A-Za-z0-9.+-]{1,}/g)||[]).forEach(k=>{const l=k.toLowerCase();if(!ENSTOP.has(l)&&l.length>1)wc[k]=(wc[k]||0)+w;});
  if(seg)for(const s of seg.segment(x.title.replace(/[A-Za-z0-9]+/g,' '))){const k=s.segment.trim();if(s.isWordLike&&k.length>=2&&/[\u4e00-\u9fa5]/.test(k)&&!CNSTOP.has(k))wc[k]=(wc[k]||0)+w;}});
 return Object.entries(wc).sort((a,b)=>b[1]-a[1]).slice(0,90).map(([name,value])=>({name,value}));}
function charts(){const A=allItems().filter(x=>x.ai);
 ch('cCloud').setOption({tooltip:{},series:[{type:'wordCloud',sizeRange:[12,42],gridSize:6,rotationRange:[0,0],textStyle:{fontFamily:'monospace',color:()=>PAL[Math.random()*5|0]},data:words(A)}]});
 const bar=(id,d,left=110)=>ch(id).setOption({tooltip:{},grid:{left,right:30,top:5,bottom:20},xAxis:{type:'value',...ax},yAxis:{type:'category',data:d.map(c=>c[0]),...ax},series:[{type:'bar',data:d.map(c=>c[1]),label:{show:true,position:'right',color:'#0f9'},itemStyle:{color:new echarts.graphic.LinearGradient(0,0,1,0,[{offset:0,color:'#004d33'},{offset:1,color:'#00ff9c'}]),shadowBlur:8,shadowColor:'#00ff9c'}}]});
 bar('cCo',Object.entries(COS).map(([n,re])=>[n,A.filter(x=>re.test(x.title)).length]).filter(c=>c[1]).sort((a,b)=>a[1]-b[1]).slice(-12));
 bar('cSrc',data.platforms.filter(p=>p.ok&&p.items.length).map(p=>[p.name,Math.round(100*p.items.filter(x=>x.ai).length/p.items.length)]).sort((a,b)=>a[1]-b[1]),100);
 ch('cSrc').setOption({series:[{label:{formatter:'{c}%'}}]});}
(function rain(){const c=$('rain'),x=c.getContext('2d');let drops;const R=()=>{c.width=innerWidth;c.height=innerHeight;drops=Array(c.width/16|0).fill(0).map(()=>Math.random()*-50)};R();addEventListener('resize',R);
 const s='アイウエオカキクケコ01智能模型数据算力神经网络热榜情报AI'.split('');setInterval(()=>{x.fillStyle='rgba(2,6,4,.08)';x.fillRect(0,0,c.width,c.height);x.font='14px monospace';
 drops.forEach((d,i)=>{x.fillStyle=Math.random()>.97?'#fff':'#00ff9c';x.fillText(s[Math.random()*s.length|0],i*16,d*16);drops[i]=d*16>c.height&&Math.random()>.975?0:d+1;});},50);})();
(function radar(){const c=$('radar'),x=c.getContext('2d');let a=0;function f(){const w=c.width=c.clientWidth,h=c.height=c.clientHeight,cx=w/2,cy=h/2,r=Math.min(w,h)/2-14;
 x.strokeStyle='rgba(0,255,156,.3)';for(let i=1;i<=4;i++){x.beginPath();x.arc(cx,cy,r*i/4,0,7);x.stroke();}x.beginPath();x.moveTo(cx-r,cy);x.lineTo(cx+r,cy);x.moveTo(cx,cy-r);x.lineTo(cx,cy+r);x.stroke();
 if(x.createConicGradient){const g=x.createConicGradient(a-0.8,cx,cy);g.addColorStop(0,'rgba(0,255,156,0)');g.addColorStop(.127,'rgba(0,255,156,.45)');g.addColorStop(.128,'rgba(0,255,156,0)');x.fillStyle=g;x.beginPath();x.arc(cx,cy,r,0,7);x.fill();}
 const P=data.platforms.filter(p=>p.ok);P.forEach((p,pi)=>{const base=pi/P.length*Math.PI*2;p.items.forEach((it,i)=>{if(i>=30)return;const ang=base+(i*0.618%1)*(Math.PI*2/P.length);const rr=r*(0.08+0.92*i/30);
  const d=((a-ang)%(Math.PI*2)+Math.PI*2)%(Math.PI*2),gl=Math.max(.12,1-d/2.5);x.fillStyle=it.ai?`rgba(255,217,61,${gl})`:`rgba(0,229,255,${gl*.6})`;x.beginPath();x.arc(cx+Math.cos(ang)*rr,cy+Math.sin(ang)*rr,it.ai?3.5:2,0,7);x.fill();});
  x.fillStyle='rgba(0,255,156,.5)';x.font='10px monospace';x.fillText(p.name,cx+Math.cos(base)*(r+2)-12,cy+Math.sin(base)*(r+2));});
 x.fillStyle='#0a7a52';x.font='10px monospace';x.fillText('中心=榜首 · 黄=AI话题 · 扇区=平台',6,h-4);a+=.025;requestAnimationFrame(f);}f();})();
function boot(){const L=['AI//热榜 v3.0 — 全网AI热点情报终端','[BIOS] 初始化神经网络接口……OK','[NET ] 接入 百度/头条/知乎/B站 ……OK','[NET ] 接入 36氪/IT之家/cnBeta/极客公园/爱范儿/少数派 ……OK','[NET ] 接入 掘金/CSDN/开源中国/V2EX ……OK','[SYS ] 加载AI语义过滤器 ……OK','[SYS ] 预警引擎（红/橙/黄）上线','>>> ACCESS GRANTED_'];
 let i=0,t=$('bootTxt');const iv=setInterval(()=>{t.textContent+=L[i++]+'\n';if(i>=L.length){clearInterval(iv);setTimeout(()=>{$('boot').style.opacity=0;setTimeout(()=>$('boot').remove(),600)},350);}},140);}
$('search').oninput=$('aiOnly').onchange=render;$('refresh').onclick=load;
$('tabs').onclick=e=>{const b=e.target.closest('button');if(b){tab=b.dataset.c;render();log(`切换分类 → ${tab}`);}};
$('cards').onclick=e=>{const p=e.target.dataset.x;if(p){expanded.has(p)?expanded.delete(p):expanded.add(p);render();}};
$('kwInput').onkeydown=e=>{const v=e.target.value.trim();if(e.key==='Enter'&&v){kws.push(v);log(`+ 预警关键词: ${v}`,'w');e.target.value='';localStorage.kws=JSON.stringify(kws);detect();render();}};
$('kwTags').onclick=e=>{const k=e.target.dataset.k;if(k){kws=kws.filter(x=>x!==k);localStorage.kws=JSON.stringify(kws);detect();render();}};
$('notifyT').checked=localStorage.notify==='1';$('soundT').checked=localStorage.sound==='1';
$('notifyT').onchange=e=>{localStorage.notify=e.target.checked?1:0;if(e.target.checked&&'Notification'in window)Notification.requestPermission();};$('soundT').onchange=e=>localStorage.sound=e.target.checked?1:0;
setInterval(()=>{cd--;$('countdown').textContent=cd;$('clock').textContent=new Date().toLocaleString('zh-CN',{hour12:false});if(cd<=0)load();},1000);
addEventListener('resize',()=>Object.values(C).forEach(c=>c.resize()));boot();load();
