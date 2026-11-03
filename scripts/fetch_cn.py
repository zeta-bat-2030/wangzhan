#!/usr/bin/env python3
"""抓取中文热榜（各平台），输出 data/cn.json。由 GitHub Actions 每15分钟运行。数据均为真实抓取，失败的平台标记 ok=false。"""
import json,re,time,urllib.request,email.utils,os,html
UA={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36','Accept-Language':'zh-CN,zh;q=0.9'}
AI=re.compile(r'AI|人工智能|大模型|模型|智能体|Agent|GPT|OpenAI|DeepSeek|Claude|Gemini|LLM|文心|通义|豆包|混元|智谱|Kimi|月之暗面|机器人|算力|英伟达|NVIDIA|芯片|Sora|AIGC|生成式|千问|Qwen|Llama|xAI|Grok|具身|Copilot|Cursor|Codex|MCP|神经网络|机器学习|深度学习|自动驾驶|智驾|昇腾|元宝|可灵|即梦|大语言',re.I)
def get(u,data=None,h=None):
    return urllib.request.urlopen(urllib.request.Request(u,data=data,headers={**UA,**(h or {})}),timeout=20).read()
J=lambda *a,**k:json.loads(get(*a,**k))
def num(v):
    try:return int(float(v))
    except Exception:return 0
def rss(u):
    x=get(u).decode('utf-8','ignore');out=[]
    def g(tag,b):
        m=re.search('<'+tag+'[^>]*>(.*?)</'+tag+'>',b,re.S)
        return html.unescape(re.sub(r'<!\[CDATA\[|\]\]>','',m.group(1)).strip()) if m else ''
    for b in re.findall(r'<item>(.*?)</item>',x,re.S):
        try:ts=int(email.utils.parsedate_to_datetime(g('pubDate',b)).timestamp()*1000)
        except Exception:ts=None
        out.append(dict(title=g('title',b),url=g('link',b),heat=0,t=ts))
    return out
def baidu():
    c=J('https://top.baidu.com/api/board?platform=wise&tab=realtime')['data']['cards'][0]['content'][0]['content']
    return [dict(title=x['word'],url=x['url'],heat=num(x.get('hotScore'))) for x in c]
def toutiao():
    return [dict(title=x['Title'],url=x['Url'].split('?')[0],heat=num(x.get('HotValue'))) for x in J('https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc')['data']]
def zhihu():
    out=[]
    for x in J('https://api.zhihu.com/topstory/hot-list?limit=50')['data']:
        t=x['target'];m=re.search(r'([\d.]+)\s*万',x.get('detail_text',''))
        out.append(dict(title=t['title'],url='https://www.zhihu.com/question/%s'%t['id'],heat=int(float(m.group(1))*1e4) if m else 0))
    return out
def bili():
    return [dict(title=x['title'],url='https://www.bilibili.com/video/'+x['bvid'],heat=x['stat']['view']) for x in J('https://api.bilibili.com/x/web-interface/popular?ps=50')['data']['list']]
def kr36():
    d=J('https://gateway.36kr.com/api/mis/nav/home/nav/rank/hot',b'{"partner_id":"wap","param":{"siteId":1,"platformId":2}}',{'Content-Type':'application/json'})
    return [dict(title=x['templateMaterial']['widgetTitle'],url='https://36kr.com/p/%s'%x['itemId'],heat=x['templateMaterial'].get('statRead',0)) for x in d['data']['hotRankList']]
def juejin():
    return [dict(title=x['content']['title'],url='https://juejin.cn/post/'+x['content']['content_id'],heat=x['content_counter'].get('hot_rank',0)) for x in J('https://api.juejin.cn/content_api/v1/content/article_rank?category_id=6809637773935378440&type=hot')['data']]
def csdn():
    return [dict(title=x['articleTitle'],url=x['articleDetailUrl'],heat=num(x.get('hotRankScore'))) for x in J('https://blog.csdn.net/phoenix/web/blog/hot-rank?page=0&pageSize=50')['data']]
def v2ex():
    return [dict(title=x['title'],url=x['url'],heat=x['replies'],t=x['created']*1000) for p in ('hot','latest') for x in J(f'https://www.v2ex.com/api/topics/{p}.json')]
P=[('baidu','百度热搜','综合',baidu,'#2f6bff'),('toutiao','今日头条','综合',toutiao,'#f04142'),('zhihu','知乎热榜','综合',zhihu,'#0a66ff'),('bilibili','哔哩哔哩','综合',bili,'#fb7299'),
   ('36kr','36氪','科技',kr36,'#3c7dff'),('ithome','IT之家','科技',lambda:rss('https://www.ithome.com/rss/'),'#d22222'),('cnbeta','cnBeta','科技',lambda:rss('https://www.cnbeta.com.tw/backend.php'),'#2a63b4'),
   ('geekpark','极客公园','科技',lambda:rss('https://www.geekpark.net/rss'),'#1aa3ff'),('ifanr','爱范儿','科技',lambda:rss('https://www.ifanr.com/feed'),'#e21f26'),('sspai','少数派','科技',lambda:rss('https://sspai.com/feed'),'#da282a'),
   ('juejin','掘金·人工智能','开发者',juejin,'#1e80ff'),('csdn','CSDN热榜','开发者',csdn,'#fc5531'),('oschina','开源中国','开发者',lambda:rss('https://www.oschina.net/news/rss'),'#2fb35a'),('v2ex','V2EX','开发者',v2ex,'#999999')]
out=[];now=int(time.time()*1000)
try:OLD={p['id']:p for p in json.load(open('data/cn.json'))['platforms'] if p.get('ok')}
except Exception:OLD={}
for pid,name,cat,f,color in P:
    try:
      for attempt in range(3):
       try:
        seen=set();items=[]
        for x in f():
            x['title']=(x['title'] or '').strip()
            if not x['title'] or x['title'] in seen:continue
            seen.add(x['title']);x['ai']=bool(AI.search(x['title']));items.append(x)
        items=[{k:v for k,v in dict(title=i['title'],url=i['url'],heat=i.get('heat') or None,t=i.get('t') if not i.get('heat') else None,ai=1 if i['ai'] else None).items() if v is not None} for i in items[:30]];out.append(dict(id=pid,name=name,cat=cat,color=color,ok=True,items=items,updated=now))
        print(f'{name}: {len(items)} 条, AI {sum(1 for i in items if i.get("ai"))}');break
       except Exception:
        if attempt==2:raise
        time.sleep(3)
    except Exception as e:
      if pid in OLD:
        o=OLD[pid];o['stale']=True;o['err']=str(e)[:100];out.append(o);print(f'{name}: ERR {e}（沿用上次数据）')
      else:
        out.append(dict(id=pid,name=name,cat=cat,color=color,ok=False,err=str(e)[:100],items=[],updated=now));print(f'{name}: ERR {e}')
os.makedirs('data',exist_ok=True)
json.dump(dict(updated=now,platforms=out),open('data/cn.json','w'),ensure_ascii=False,separators=(',',':'))
