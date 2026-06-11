#!/usr/bin/env python3
"""ProcureMap local browser app."""

from __future__ import annotations

import json
import threading
import time
import traceback
import uuid
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from socket import error as SocketError
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from procuremap_cli import DEFAULT_AREAS, DEFAULT_OUTPUT_DIR, RunConfig, parse_csv, run_analysis


TASKS: dict[str, dict] = {}
OUTPUT_DIR = DEFAULT_OUTPUT_DIR


APP_HTML = """<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ProcureMap</title>
<style>
:root{--bg:#090f1d;--panel:#10182a;--line:rgba(255,255,255,.12);--text:#edf4ff;--muted:#8f9db5;--accent:#4dd6ff;--good:#5ee2a0;--bad:#ff7a59}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#090f1d;color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft Yahei",sans-serif}
.shell{display:grid;grid-template-columns:420px minmax(0,1fr);min-height:100vh}.form{background:var(--panel);border-right:1px solid var(--line);padding:24px;display:flex;flex-direction:column;gap:18px}
h1{font-size:22px;margin:0}.sub{color:var(--muted);font-size:13px;line-height:1.6}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.field{display:grid;gap:6px}.field.full{grid-column:1/-1}
label{font-size:12px;color:var(--muted)}input,textarea{width:100%;border:1px solid var(--line);background:#0b1222;color:var(--text);border-radius:8px;padding:10px;font-size:13px}textarea{min-height:74px;resize:vertical}
button{height:40px;border:1px solid rgba(77,214,255,.55);border-radius:8px;background:rgba(77,214,255,.15);color:var(--accent);font-weight:800;cursor:pointer}button:disabled{opacity:.55;cursor:not-allowed}
.main{padding:24px;display:grid;grid-template-rows:auto auto minmax(0,1fr);gap:16px}.status{display:flex;align-items:center;gap:12px}.pill{border:1px solid var(--line);border-radius:999px;padding:5px 10px;color:var(--muted);font-size:12px}
.progress{height:10px;background:#111a2d;border:1px solid var(--line);border-radius:999px;overflow:hidden}.bar{height:100%;width:0;background:linear-gradient(90deg,var(--accent),var(--good));transition:width .2s}
.log{background:#060a13;border:1px solid var(--line);border-radius:10px;overflow:auto;padding:14px;white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:1.55}
.result{display:none;border:1px solid rgba(94,226,160,.35);background:rgba(94,226,160,.08);border-radius:10px;padding:14px}.result a{color:var(--good);font-weight:800}.err{color:var(--bad)}
@media(max-width:900px){.shell{grid-template-columns:1fr}.form{border-right:0;border-bottom:1px solid var(--line)}}
</style>
</head>
<body>
<div class="shell">
  <form class="form" id="form">
    <div><h1>ProcureMap</h1><div class="sub">输入原点和品类，自动调用 Xila 最新数据，生成同款地图供应商 HTML。</div></div>
    <div class="grid">
      <div class="field full"><label>原点名称</label><input name="origin" value="芜湖永康" required></div>
      <div class="field"><label>纬度（可选）</label><input name="lat" placeholder="31.35246"></div>
      <div class="field"><label>经度（可选）</label><input name="lng" placeholder="118.43313"></div>
      <div class="field"><label>品类名称</label><input name="material" value="铝"></div>
      <div class="field"><label>半径 km</label><input name="radius" type="number" value="300"></div>
      <div class="field"><label>深度补充前 N 家</label><input name="enrich_limit" type="number" value="20"></div>
      <div class="field"><label>详情候选数</label><input name="max_details" type="number" value="320"></div>
      <div class="field full"><label>品类关键词</label><textarea name="keywords">铝,铝业,铝材,铝型材,铝合金,铝制品,铝板,铝箔,铝棒,铝加工</textarea></div>
      <div class="field full"><label>搜索地区</label><textarea name="areas">__AREAS__</textarea></div>
      <div class="field full"><label>行业三级名称（可选）</label><input name="industry_name3" value="有色金属压延加工"></div>
      <div class="field full"><label>INSIGHT_INTERNAL_SERVICE_TOKEN（可选；不填则尝试本机 ssh moss-dev）</label><input name="internal_token" type="password"></div>
    </div>
    <button id="start" type="submit">开始分析并生成 HTML</button>
  </form>
  <main class="main">
    <div class="status"><span class="pill" id="state">idle</span><span class="pill" id="task"></span></div>
    <div class="progress"><div class="bar" id="bar"></div></div>
    <div class="result" id="result"></div>
    <div class="log" id="log">等待开始。</div>
  </main>
</div>
<script>
const form=document.querySelector('#form'), log=document.querySelector('#log'), state=document.querySelector('#state'), task=document.querySelector('#task'), bar=document.querySelector('#bar'), result=document.querySelector('#result'), start=document.querySelector('#start');
let timer=null, taskId=null;
function setLog(lines){log.textContent=lines.length?lines.join('\\n'):'等待日志。';log.scrollTop=log.scrollHeight}
function pctFromLines(lines,status){let p=8; for(const l of lines){ if(l.includes('[search]'))p=25; if(l.includes('[detail]'))p=55; if(l.includes('[enrich]'))p=Math.max(p,72); if(l.includes('[done]'))p=100;} if(status==='error')p=100; return p}
async function poll(){const r=await fetch('/api/status?id='+taskId); const d=await r.json(); state.textContent=d.status; setLog(d.logs||[]); bar.style.width=pctFromLines(d.logs||[],d.status)+'%'; if(d.status==='done'){clearInterval(timer); start.disabled=false; result.style.display='block'; result.innerHTML='已完成：<a href="'+d.html_url+'" target="_blank">打开生成的 HTML</a>'; window.open(d.html_url,'_blank')} if(d.status==='error'){clearInterval(timer); start.disabled=false; result.style.display='block'; result.innerHTML='<span class="err">失败，请查看日志。</span>'}}
form.onsubmit=async e=>{e.preventDefault(); start.disabled=true; result.style.display='none'; const body=Object.fromEntries(new FormData(form).entries()); const r=await fetch('/api/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); const d=await r.json(); taskId=d.id; task.textContent=taskId; timer=setInterval(poll,1000); poll()};
</script>
</body>
</html>""".replace("__AREAS__", ",".join(DEFAULT_AREAS))


def task_runner(task_id: str, payload: dict) -> None:
    task = TASKS[task_id]

    def emit(line: str) -> None:
        task["logs"].append(line)

    try:
        task["status"] = "running"
        config = RunConfig(
            origin_name=payload.get("origin") or "芜湖永康",
            lat=float(payload["lat"]) if payload.get("lat") else None,
            lng=float(payload["lng"]) if payload.get("lng") else None,
            material_label=payload.get("material") or "铝",
            keywords=parse_csv(payload.get("keywords") or ""),
            areas=parse_csv(payload.get("areas") or ""),
            industry_name3=payload.get("industry_name3") or "",
            radius_km=int(payload.get("radius") or 300),
            max_details=int(payload.get("max_details") or 320),
            enrich_limit=int(payload.get("enrich_limit") or 20),
            pages=2,
            search_limit=100,
            output_dir=OUTPUT_DIR,
            internal_token=payload.get("internal_token") or "",
        )
        result = run_analysis(config, emit)
        task["html"] = str(result["html"])
        task["json"] = str(result["json"])
        task["status"] = "done"
    except Exception:
        task["status"] = "error"
        task["logs"].append(traceback.format_exc())


class Handler(BaseHTTPRequestHandler):
    def send_index_headers(self) -> None:
        body = APP_HTML.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()

    def send_json(self, data: dict) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/":
            body = APP_HTML.encode("utf-8")
            self.send_index_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/status":
            task_id = parse_qs(parsed.query).get("id", [""])[0]
            task = TASKS.get(task_id) or {"status": "missing", "logs": []}
            html_url = ""
            if task.get("html"):
                html_url = "/outputs/" + Path(task["html"]).name
            self.send_json({"status": task["status"], "logs": task.get("logs", [])[-500:], "html_url": html_url})
            return
        if parsed.path.startswith("/outputs/"):
            name = Path(unquote(parsed.path.removeprefix("/outputs/"))).name
            path = OUTPUT_DIR / name
            if path.exists():
                body = path.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8" if path.suffix == ".html" else "application/octet-stream")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
        self.send_error(404)

    def do_POST(self) -> None:
        if self.path != "/api/start":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", "0"))
        payload = json.loads(self.rfile.read(length) or b"{}")
        task_id = uuid.uuid4().hex[:10]
        TASKS[task_id] = {"status": "queued", "logs": [f"[queued] {time.strftime('%Y-%m-%d %H:%M:%S')}"]}
        threading.Thread(target=task_runner, args=(task_id, payload), daemon=True).start()
        self.send_json({"id": task_id})

    def log_message(self, fmt: str, *args) -> None:
        return

    def do_HEAD(self) -> None:
        if urlparse(self.path).path == "/":
            self.send_index_headers()
            return
        self.send_error(404)


def create_server() -> ThreadingHTTPServer:
    last_error: SocketError | None = None
    for port in range(8765, 8786):
        try:
            return ThreadingHTTPServer(("127.0.0.1", port), Handler)
        except SocketError as exc:
            last_error = exc
    raise RuntimeError(f"无法启动本地服务，8765-8785 端口都不可用：{last_error}")


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    server = create_server()
    host, port = server.server_address
    url = f"http://{host}:{port}/"
    print(f"ProcureMap running at {url}")
    webbrowser.open(url)
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
