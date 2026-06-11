#!/usr/bin/env python3
"""Enrich the nearest Wuhu aluminum suppliers from an existing snapshot."""

from __future__ import annotations

import argparse
import importlib.util
import sys
import time
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_JSON = ROOT / "data" / "wuhu_aluminum_suppliers.json"
GENERATOR = ROOT / "scripts" / "generate_wuhu_aluminum_report.py"


def load_generator():
    spec = importlib.util.spec_from_file_location("wuhu_generator", GENERATOR)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {GENERATOR}")
    module = importlib.util.module_from_spec(spec)
    sys.modules["wuhu_generator"] = module
    spec.loader.exec_module(module)
    return module


def enrich_nearest(snapshot: dict[str, Any], limit: int, pause: float, timeout: float) -> dict[str, Any]:
    gen = load_generator()
    companies = snapshot.get("companies") or []
    nearest = sorted(
        companies,
        key=lambda c: (c.get("distance_km") is None, c.get("distance_km") or 9999, c.get("name") or ""),
    )[:limit]
    nearest_codes = {c.get("credit_code") for c in nearest}

    for company in companies:
        company["enrich"] = {}
        company["risk_counts"] = {}
        company["risk_rows"] = {}
        company["coverage"] = {}

    client = gen.XilaClient(pause=pause, timeout=timeout)
    print("[token] resolving through dev platform", flush=True)
    client.resolve_token(force=True)

    for index, company in enumerate(nearest, 1):
        code = company.get("credit_code")
        if not code:
            continue
        print(f"[enrich] nearest {index}/{len(nearest)} {company.get('distance_km')}km {company.get('name')}", flush=True)
        for key, spec in gen.ENRICH_ENDPOINTS.items():
            params = {"credit_code": code}
            params.update(spec.get("extra") or {})
            if spec.get("paged"):
                params.update({"index": 1, "limit": 50})
            resp = client.post(spec["path"], params)
            rows, total = gen.rows_and_total(resp)
            count = total if total is not None else len(rows)
            company["coverage"][key] = {
                "ok": resp.get("code") in (0, "0", None),
                "total": count,
                "label": spec["label"],
            }
            if key in gen.RISK_KEYS:
                company["risk_counts"][key] = count
                company["risk_rows"][key] = {"total": count, "rows": rows[:20]}
            else:
                company["enrich"][key] = {"total": count, "rows": rows[:20]}
            if key == "annual_reports" and rows:
                gen.enrich_annual_report_sections(client, company, rows[:3])

    for company in companies:
        if company.get("credit_code") not in nearest_codes:
            company["coverage"]["not_enriched"] = {"ok": False, "total": 0, "label": "未进入距离前20深度补充"}

    started = time.monotonic()
    analysis = gen.build_analysis(companies, client, started)
    analysis["enrich_scope"] = {
        "mode": "nearest_by_distance",
        "limit": limit,
        "description": f"按 distance_km 最近的前 {limit} 家供应商调用深度接口，其余企业保留基础工商与地图信息。",
    }
    snapshot["analysis"] = analysis
    snapshot.setdefault("query", {})["max_enrich"] = limit
    snapshot["query"]["enrich_scope"] = "nearest_by_distance"
    return snapshot


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", type=Path, default=DEFAULT_JSON)
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--pause", type=float, default=0.05)
    parser.add_argument("--timeout", type=float, default=12.0)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    gen = load_generator()
    snapshot = gen.json.loads(args.json.read_text(encoding="utf-8"))
    snapshot = enrich_nearest(snapshot, args.limit, args.pause, args.timeout)
    gen.save_json(snapshot, args.json)
    print(f"[done] enriched nearest {args.limit}; json={args.json}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
