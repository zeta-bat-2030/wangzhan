#!/usr/bin/env python3
"""ai-radar 每日 AI 简报生成（本机 LiteLLM 网关）。成功才写 data/daily_summary.json；失败退出码非0且不覆盖旧文件。
用法: python3 test_summary.py [--dry-run] [--model M] [--base URL] [--max-items N]
密钥: 环境变量 LITELLM_API_KEY，或文件 /workspace/secrets/litellm_master_key.txt（绝不打印）。"""
import argparse, json, os, re, sys, time, urllib.request, urllib.error
from datetime import datetime
from pathlib import Path

CN_JSON = str(Path(__file__).resolve().parent.parent / "data" / "cn.json")
OUT = Path(__file__).resolve().parent.parent / "data"
KEY_FILE = "/workspace/secrets/litellm_master_key.txt"
AI_RE = re.compile(r"AI|人工智能|大模型|模型|GPT|LLM|Claude|Gemini|DeepSeek|通义|文心|Kimi|豆包|智谱|OpenAI|英伟达|NVIDIA|算力|芯片|机器人|智能体|Agent|AIGC|Sora|Llama|Qwen|自动驾驶|神经网络|深度学习|机器学习", re.I)
AI_PLATFORMS = {"juejin_ai"}

def load_items(maxn):
    d = json.load(open(CN_JSON, encoding="utf-8"))
    seen, out = set(), []
    for p in d.get("platforms", []):
        for it in p.get("items", []):
            t = (it.get("title") or "").strip()
            if not t or t in seen: continue
            if p.get("id") in AI_PLATFORMS or AI_RE.search(t):
                seen.add(t); out.append({"title": t, "url": it.get("url", ""), "src": p.get("name", "")})
    return d.get("updated"), out[:maxn]

def get_key():
    k = os.environ.get("LITELLM_API_KEY")
    if not k and os.path.exists(KEY_FILE): k = open(KEY_FILE).read().strip()
    return k

def build_prompt(items):
    lines = "\n".join(f"{i+1}. [{x['src']}] {x['title']}" for i, x in enumerate(items))
    return ("你是AI行业编辑。根据以下今日中文热榜中的AI相关标题，写一份中文每日摘要。"
            "只输出JSON：{\"headline\":\"一句话总览\",\"bullets\":[{\"text\":\"要点(<=60字)\",\"refs\":[条目序号]}],"
            "\"alerts\":[{\"level\":\"high|mid|low\",\"text\":\"预警\"}],\"tags\":[\"关键词\"]}。"
            "要点5-8条，不要编造标题中没有的事实。\n\n" + lines)

def call(base, key, model, prompt, timeout=90):
    body = json.dumps({"model": model, "messages": [{"role": "user", "content": prompt}],
                       "temperature": 0.3, "max_tokens": 4000}).encode()
    req = urllib.request.Request(base.rstrip("/") + "/v1/chat/completions", data=body,
          headers={"Content-Type": "application/json", "Authorization": "Bearer " + key})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        j = json.load(r)
    msg = j["choices"][0]["message"]
    txt = msg.get("content") or msg.get("reasoning_content") or ""
    if not txt: raise ValueError("空输出 finish_reason=%s" % j["choices"][0].get("finish_reason"))
    return txt, j.get("model", model)

def parse(txt):
    m = re.search(r"\{.*\}", txt, re.S)
    return json.loads(m.group(0)) if m else None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--base", default=os.environ.get("LITELLM_BASE", "http://localhost:4000"))
    ap.add_argument("--model", action="append", help="可多次指定，按顺序回退")
    ap.add_argument("--max-items", type=int, default=40)
    a = ap.parse_args()
    models = a.model or ["free", "gemma4", "nemotron-lightning"]
    OUT.mkdir(exist_ok=True)
    updated, items = load_items(a.max_items)
    prompt = build_prompt(items)
    print(f"数据更新时间: {updated}，AI相关条目: {len(items)}")
    res = {"date": datetime.now().strftime("%Y-%m-%d"), "generated_at": datetime.now().isoformat(timespec="seconds"),
           "source_updated": updated, "items": items, "status": "dry-run", "model": None}
    if a.dry_run:
        pass
        try:
            urllib.request.urlopen(a.base.rstrip("/") + "/health/liveliness", timeout=3); res["gateway"] = "reachable"
        except Exception as e:
            res["gateway"] = f"unreachable: {type(e).__name__}"
        print("网关:", res["gateway"], "| 密钥:", "已找到" if get_key() else "未找到")
    else:
        key = get_key()
        if not key: sys.exit("未找到密钥（LITELLM_API_KEY 或 %s）" % KEY_FILE)
        for m in models:
            t0 = time.time()
            try:
                txt, used = call(a.base, key, m, prompt)
                s = parse(txt)
                if not s: raise ValueError("模型输出非JSON")
                for b in s.get("bullets", []):
                    refs=[r for r in b.get("refs", []) if isinstance(r,int) and 1<=r<=len(items)]
                    b["refs"]=refs; b["links"]=[{"title":items[r-1]["title"],"url":items[r-1]["url"],"src":items[r-1]["src"]} for r in refs]
                s["bullets"]=[b for b in s.get("bullets",[]) if b["links"]]
                if len(s["bullets"])<3: raise ValueError("有效要点不足")
                res.update(status="ok", model=used, latency_s=round(time.time()-t0, 1), summary=s); break
            except urllib.error.HTTPError as e:
                print(f"[{m}] HTTP {e.code}（429=免费限流），尝试下一个"); res["status"] = f"error {e.code}"
            except Exception as e:
                print(f"[{m}] 失败: {type(e).__name__}: {str(e)[:120]}"); res["status"] = "error"
            time.sleep(2)
        if res["status"] != "ok":
            print("全部模型失败，不覆盖旧结果"); sys.exit(2)
            res["summary"] = {"headline": "AI 摘要暂不可用，以下为今日AI热点标题", "bullets": [{"text": x["title"], "refs": [i+1]} for i, x in enumerate(items[:8])], "fallback": True}
        print(f"状态: {res['status']} 模型: {res['model']} 耗时: {res.get('latency_s')}s")
        print(json.dumps(res["summary"], ensure_ascii=False, indent=1)[:800])
    if a.dry_run: print("dry-run 不写文件"); return
    p = OUT / "daily_summary.json"
    p.write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    print("已写入", p)

if __name__ == "__main__":
    main()
