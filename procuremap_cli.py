#!/usr/bin/env python3
"""ProcureMap command line generator.

Fetches supplier data from Xila/Qila APIs and renders the same static map UI
used by the Wuhu aluminum report.
"""

from __future__ import annotations

import argparse
import contextlib
import json
import os
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from scripts import generate_wuhu_aluminum_report as gen
from scripts import render_reference_style_wuhu_aluminum as renderer


APP_ROOT = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
RUN_ROOT = Path.cwd()
DEFAULT_OUTPUT_DIR = RUN_ROOT / "outputs"

CITY_COORDS: dict[str, tuple[float, float]] = {
    "芜湖": (31.35246, 118.43313),
    "合肥": (31.82057, 117.22724),
    "马鞍山": (31.67067, 118.50611),
    "宣城": (30.94078, 118.75868),
    "铜陵": (30.94543, 117.81154),
    "池州": (30.6648, 117.49142),
    "滁州": (32.30181, 118.31683),
    "南京": (32.06025, 118.79687),
    "苏州": (31.29834, 120.58319),
    "无锡": (31.49117, 120.31191),
    "常州": (31.81072, 119.97365),
    "上海": (31.23037, 121.47370),
    "杭州": (30.27415, 120.15515),
    "湖州": (30.89305, 120.08805),
    "嘉兴": (30.74613, 120.75550),
    "宁波": (29.86834, 121.54399),
    "武汉": (30.59276, 114.30525),
    "南昌": (28.68202, 115.85794),
}

DEFAULT_AREAS = [
    "安徽",
    "江苏",
    "浙江",
    "上海",
    "江西",
    "湖北",
    "河南",
    "芜湖",
    "合肥",
    "马鞍山",
    "宣城",
    "铜陵",
    "滁州",
    "南京",
    "苏州",
    "无锡",
    "常州",
    "湖州",
    "杭州",
    "嘉兴",
]


@dataclass
class RunConfig:
    origin_name: str
    material_label: str
    keywords: list[str]
    areas: list[str]
    radius_km: int
    max_details: int
    enrich_limit: int
    pages: int
    search_limit: int
    output_dir: Path
    lat: float | None = None
    lng: float | None = None
    industry_name3: str = ""
    internal_token: str = ""
    pause: float = 0.05
    timeout: float = 12.0


class ProgressWriter:
    def __init__(self, emit: Callable[[str], None]) -> None:
        self.emit = emit
        self._buf = ""

    def write(self, text: str) -> int:
        self._buf += text
        while "\n" in self._buf:
            line, self._buf = self._buf.split("\n", 1)
            if line.strip():
                self.emit(line)
        return len(text)

    def flush(self) -> None:
        if self._buf.strip():
            self.emit(self._buf.strip())
        self._buf = ""


def slugify(value: str) -> str:
    value = re.sub(r"[^\w\u4e00-\u9fff.-]+", "-", value.strip())
    return value.strip("-") or "procuremap"


def parse_csv(value: str) -> list[str]:
    return [x.strip() for x in re.split(r"[,，;\n]+", value or "") if x.strip()]


def resolve_origin(name: str, lat: float | None, lng: float | None) -> dict:
    if lat is not None and lng is not None:
        return {"name": name, "lat": lat, "lng": lng, "note": "用户输入坐标"}
    for city, coord in CITY_COORDS.items():
        if city in name or name in city:
            return {"name": name, "lat": coord[0], "lng": coord[1], "note": f"内置城市坐标：{city}"}
    raise ValueError("未能解析原点坐标。请填写经纬度，或使用内置城市名，例如 芜湖、南京、上海、杭州。")


def build_search_queries(keywords: list[str], areas: list[str], industry_name3: str) -> list[dict]:
    queries: list[dict] = []
    for keyword in keywords:
        for area in areas:
            queries.append({"name": keyword, "address": area})
    if industry_name3:
        for area in areas:
            queries.append({"industry_names_3": [industry_name3], "address": area})
    return queries


def configure_generator(config: RunConfig, origin: dict) -> None:
    gen.ORIGIN = origin
    gen.RADIUS_KM = config.radius_km
    gen.MATERIAL_LABEL = config.material_label
    gen.MATERIAL_KEYWORDS = config.keywords
    gen.NEARBY_AREAS = config.areas
    gen.SEARCH_QUERIES = build_search_queries(config.keywords, config.areas, config.industry_name3)


def enrich_nearest(client: gen.XilaClient, companies: list[dict], limit: int, emit: Callable[[str], None]) -> None:
    nearest = sorted(companies, key=lambda c: (c.get("distance_km") is None, c.get("distance_km") or 9999))[:limit]
    nearest_codes = {c.get("credit_code") for c in nearest}
    for company in companies:
        company["enrich"] = {}
        company["risk_counts"] = {}
        company["risk_rows"] = {}
        company["coverage"] = {}
    for index, company in enumerate(nearest, 1):
        code = company.get("credit_code")
        if not code:
            continue
        emit(f"[enrich] nearest {index}/{len(nearest)} {company.get('distance_km')}km {company.get('name')}")
        for key, spec in gen.ENRICH_ENDPOINTS.items():
            params = {"credit_code": code}
            params.update(spec.get("extra") or {})
            if spec.get("paged"):
                params.update({"index": 1, "limit": 50})
            resp = client.post(spec["path"], params)
            rows, total = gen.rows_and_total(resp)
            count = total if total is not None else len(rows)
            company["coverage"][key] = {"ok": resp.get("code") in (0, "0", None), "total": count, "label": spec["label"]}
            if key in gen.RISK_KEYS:
                company["risk_counts"][key] = count
                company["risk_rows"][key] = {"total": count, "rows": rows[:20]}
            else:
                company["enrich"][key] = {"total": count, "rows": rows[:20]}
            if key == "annual_reports" and rows:
                gen.enrich_annual_report_sections(client, company, rows[:3])
    for company in companies:
        if company.get("credit_code") not in nearest_codes:
            company["coverage"]["not_enriched"] = {"ok": False, "total": 0, "label": f"未进入距离前{limit}深度补充"}


def run_analysis(config: RunConfig, emit: Callable[[str], None] = print) -> dict[str, Path]:
    if config.internal_token:
        os.environ["INSIGHT_INTERNAL_SERVICE_TOKEN"] = config.internal_token
    origin = resolve_origin(config.origin_name, config.lat, config.lng)
    configure_generator(config, origin)
    output_dir = config.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    base = slugify(f"{config.origin_name}-{config.material_label}-{config.radius_km}km")
    json_out = output_dir / f"{base}.json"
    html_out = output_dir / f"{base}.html"

    started = time.monotonic()
    client = gen.XilaClient(pause=config.pause, timeout=config.timeout)
    emit("[token] resolving through dev platform or INSIGHT_INTERNAL_SERVICE_TOKEN")
    client.resolve_token(force=True)
    emit(f"[origin] {origin['name']} {origin['lat']:.5f},{origin['lng']:.5f} radius={config.radius_km}km")
    emit(f"[search] queries={len(gen.SEARCH_QUERIES)} areas={len(config.areas)} keywords={','.join(config.keywords)}")
    with contextlib.redirect_stdout(ProgressWriter(emit)):
        candidates = gen.collect_candidates(client, config.pages, config.search_limit)
        companies = gen.fetch_detail_companies(client, candidates, config.max_details)
    emit(f"[detail] suppliers within radius={len(companies)}")
    enrich_nearest(client, companies, config.enrich_limit, emit)
    analysis = gen.build_analysis(companies, client, started)
    analysis["enrich_scope"] = {
        "mode": "nearest_by_distance",
        "limit": config.enrich_limit,
        "description": f"按 distance_km 最近的前 {config.enrich_limit} 家供应商调用深度接口，其余企业保留基础工商与地图信息。",
    }
    snapshot = {
        "analysis": analysis,
        "companies": companies,
        "query": {
            "target": f"{config.origin_name} {config.radius_km}km {config.material_label}原厂/一级代理",
            "material_label": config.material_label,
            "radius_km": config.radius_km,
            "search_queries": gen.SEARCH_QUERIES,
            "max_details": config.max_details,
            "max_enrich": config.enrich_limit,
            "enrich_scope": "nearest_by_distance",
        },
    }
    gen.save_json(snapshot, json_out)
    renderer.render_snapshot(snapshot, html_out)
    emit(f"[done] html={html_out}")
    emit(f"[done] json={json_out}")
    return {"html": html_out, "json": json_out}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate a ProcureMap supplier HTML report.")
    parser.add_argument("--origin", required=True, help="原点名称，例如 芜湖永康")
    parser.add_argument("--lat", type=float)
    parser.add_argument("--lng", type=float)
    parser.add_argument("--material", default="铝", help="品类名称，例如 铝")
    parser.add_argument("--keywords", default="铝,铝业,铝材,铝型材,铝合金,铝制品,铝板,铝箔,铝棒,铝加工")
    parser.add_argument("--areas", default=",".join(DEFAULT_AREAS), help="搜索地区，逗号分隔")
    parser.add_argument("--industry-name3", default="有色金属压延加工")
    parser.add_argument("--radius", type=int, default=300)
    parser.add_argument("--max-details", type=int, default=320)
    parser.add_argument("--enrich-limit", type=int, default=20)
    parser.add_argument("--pages", type=int, default=2)
    parser.add_argument("--search-limit", type=int, default=100)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--internal-token", default="")
    parser.add_argument("--pause", type=float, default=0.05)
    parser.add_argument("--timeout", type=float, default=12.0)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config = RunConfig(
        origin_name=args.origin,
        lat=args.lat,
        lng=args.lng,
        material_label=args.material,
        keywords=parse_csv(args.keywords),
        areas=parse_csv(args.areas),
        industry_name3=args.industry_name3,
        radius_km=args.radius,
        max_details=args.max_details,
        enrich_limit=args.enrich_limit,
        pages=args.pages,
        search_limit=args.search_limit,
        output_dir=args.output_dir,
        internal_token=args.internal_token,
        pause=args.pause,
        timeout=args.timeout,
    )
    result = run_analysis(config)
    print(json.dumps({k: str(v) for k, v in result.items()}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
