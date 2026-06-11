#!/usr/bin/env python3
"""Build a Wuhu Yongkang aluminum supplier report from Xila/Qila APIs.

The script resolves a short-lived Xila token through the dev platform internal
endpoint, uses it only in memory, and writes a static HTML report plus a JSON
snapshot. It intentionally does not persist tokens.
"""

from __future__ import annotations

import argparse
import html
import json
import math
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_JSON = ROOT / "data" / "wuhu_aluminum_suppliers.json"
DEFAULT_HTML = ROOT / "芜湖永康铝供应商雷达.html"

PLATFORM_TOKEN_URL = "http://47.97.154.221:8119/api/v1/internal/xila-token/resolve"
XILA_BASE_URL = "https://api-dev.qiliance.com"
ORIGIN = {
    "name": "芜湖永康检索锚点",
    "note": "Xila 中“芜湖永康”相关主体未提供可用坐标，且主要匹配项为注销/非铝主体；本报告以芜湖市中心作为 300km 供应半径锚点。",
    "lat": 31.35246,
    "lng": 118.43313,
}
RADIUS_KM = 300
MATERIAL_LABEL = "铝"
MATERIAL_KEYWORDS = ["铝", "铝业", "铝材", "铝型材", "铝合金", "铝制品", "铝板", "铝箔", "铝棒", "铝加工"]
NEARBY_AREAS = ["芜湖", "安徽", "南京", "苏州", "无锡", "常州", "上海", "湖州", "杭州", "嘉兴"]

SEARCH_QUERIES = [
    {"name": "铝", "address": v}
    for v in [
        "芜湖",
        "合肥",
        "马鞍山",
        "宣城",
        "铜陵",
        "池州",
        "滁州",
        "安庆",
        "安徽",
        "南京",
        "苏州",
        "无锡",
        "常州",
        "镇江",
        "扬州",
        "南通",
        "江苏",
        "上海",
        "湖州",
        "嘉兴",
        "杭州",
        "宁波",
        "浙江",
        "九江",
        "南昌",
        "江西",
        "武汉",
        "黄石",
        "湖北",
        "信阳",
        "河南",
    ]
] + [
    {"name": "铝业", "address": v}
    for v in ["安徽", "江苏", "浙江", "上海", "江西", "湖北", "河南"]
] + [
    {"industry_names_3": ["有色金属压延加工"], "address": v}
    for v in ["安徽", "江苏", "浙江", "上海", "江西", "湖北"]
]

DETAIL_PATH = "/adminapi/Business/getCompanyDetail"
SEARCH_PATH = "/api/Company/getCompanyList"

ENRICH_ENDPOINTS: dict[str, dict[str, Any]] = {
    "shareholders": {"path": "/api/company/shareholderPubList", "paged": False, "label": "股东"},
    "annual_reports": {"path": "/api/company/entAnnualReports", "paged": False, "label": "年报"},
    "finance_reports": {"path": "/adminapi/Company/getAsyncReportList", "paged": False, "label": "财务/社保"},
    "certificates": {"path": "/adminapi/Company/getCertificatesList", "paged": False, "label": "资质证书"},
    "patents": {"path": "/api/Company/getPatentList", "paged": True, "label": "专利"},
    "trademarks": {"path": "/api/Company/getTrademarkList", "paged": True, "label": "商标"},
    "branches": {"path": "/api/Company/getCompanyBranches", "paged": False, "label": "分支机构"},
    "outward_investment": {"path": "/adminapi/Company/outwardInvestmentList", "paged": True, "label": "对外投资"},
    "leader_positions": {"path": "/adminapi/EnterprisePortrait/leaderPositions", "paged": True, "label": "董监高任职"},
    "hire": {"path": "/adminapi/EnterprisePortrait/getHireList", "paged": True, "label": "招聘"},
    "mobile": {"path": "/adminapi/Company/getMobile", "paged": False, "label": "关键联系人"},
    "news": {"path": "/adminapi/Company/getCompanyNews", "paged": False, "label": "企业新闻/舆情"},
    "policy": {"path": "/adminapi/Company/getCompanyPolicyList", "paged": False, "label": "可申报政策"},
    "approved_policy": {"path": "/adminapi/Company/getApprovedPolicyList", "paged": False, "label": "已获政策"},
    "eligible_subsidy": {"path": "/adminapi/project/entProjectMatch", "paged": True, "label": "补贴匹配"},
    "relation_chain": {"path": "/adminapi/Business/newRelationChain", "paged": False, "label": "关系链"},
    "bidding": {"path": "/adminapi/Bidding/getBiddingList", "paged": True, "label": "招投标"},
    "copyright_software": {"path": "/api/Company/getCopyrightSoftwareList", "paged": False, "label": "软件著作权"},
    "copyright_works": {"path": "/api/Company/getCopyrightWorksList", "paged": False, "label": "作品著作权"},
    "listed_finance": {"path": "/api/ListedCompany/getFinancialData", "paged": False, "label": "上市财务", "extra": {"limit": 20}},
    "oper_abnorm": {"path": "/adminapi/ManagementRisk/getOperAbnormList", "paged": False, "label": "经营异常"},
    "punishment": {"path": "/adminapi/ManagementRisk/getPunishmentBSPubList", "paged": False, "label": "行政处罚"},
    "tax_arrears": {"path": "/adminapi/ManagementRisk/getTaxArrearsInfoList", "paged": False, "label": "欠税"},
    "tax_abnormal": {"path": "/adminapi/ManagementRisk/getAbnormalEnterprisesList", "paged": False, "label": "税务非正常户"},
    "major_tax_illegal": {"path": "/adminapi/ManagementRisk/getMajorTaxIllegalList", "paged": False, "label": "重大税收违法"},
    "illegal_info": {"path": "/adminapi/ManagementRisk/getIllegalInfoList", "paged": False, "label": "严重违法失信"},
    "simple_cancel": {"path": "/adminapi/ManagementRisk/getSimpleCancelList", "paged": False, "label": "简易注销"},
    "clear_info": {"path": "/adminapi/ManagementRisk/getClearInfolList", "paged": False, "label": "清算"},
    "equity_pledge": {"path": "/adminapi/ManagementRisk/getEquityPledgelList", "paged": False, "label": "股权出质"},
    "mortgage_info": {"path": "/adminapi/ManagementRisk/getMortgageInfolList", "paged": False, "label": "动产抵押"},
}

ANNUAL_REPORT_ENDPOINTS: dict[str, dict[str, str]] = {
    "report_asset": {"path": "/api/Company/reportAsset", "label": "年报资产负债"},
    "report_social_info": {"path": "/api/Company/reportSocialInfo", "label": "年报社保"},
    "report_out_guarant": {"path": "/api/Company/reportOutGuarant", "label": "年报对外担保"},
    "report_share_tran": {"path": "/api/Company/reportShareTran", "label": "年报股权转让"},
}

RISK_KEYS = {
    "oper_abnorm",
    "punishment",
    "tax_arrears",
    "tax_abnormal",
    "major_tax_illegal",
    "illegal_info",
    "simple_cancel",
    "clear_info",
    "equity_pledge",
    "mortgage_info",
}


def run(cmd: str) -> str:
    return subprocess.check_output(cmd, shell=True, text=True).strip()


class XilaClient:
    def __init__(self, pause: float = 0.16, timeout: float = 14.0) -> None:
        self.pause = pause
        self.timeout = timeout
        self.token: str | None = None
        self.last_call = 0.0
        self.internal_token: str | None = None
        self.calls = 0
        self.failures: Counter[str] = Counter()

    def resolve_internal_token(self) -> str:
        if self.internal_token:
            return self.internal_token
        env_token = os.getenv("INSIGHT_INTERNAL_SERVICE_TOKEN")
        if env_token:
            self.internal_token = env_token
            return env_token
        cmd = (
            "ssh moss-dev 'pod=$(kubectl get pods -n moss-v2-dev -l app=platform "
            "-o jsonpath=\"{.items[0].metadata.name}\"); "
            "kubectl exec -n moss-v2-dev \"$pod\" -- /bin/sh -lc "
            "\"printenv INSIGHT_INTERNAL_SERVICE_TOKEN\"'"
        )
        self.internal_token = run(cmd)
        return self.internal_token

    def resolve_token(self, *, force: bool = False) -> str:
        body = {"tenantId": "GLOBAL_DEFAULT"}
        if force:
            body["forceRefresh"] = True
        req = urllib.request.Request(
            PLATFORM_TOKEN_URL,
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": "Bearer " + self.resolve_internal_token(),
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                payload = json.load(resp)
        except urllib.error.HTTPError as exc:
            self.failures["/api/v1/internal/xila-token/resolve"] += 1
            if force:
                # Force refresh can fail transiently when the fallback account pool is
                # switching. Prefer the last shared snapshot before giving up.
                time.sleep(1.0)
                return self.resolve_token(force=False)
            if self.token:
                return self.token
            raise exc
        except urllib.error.URLError as exc:
            self.failures["/api/v1/internal/xila-token/resolve"] += 1
            if self.token:
                return self.token
            raise exc
        self.token = payload["token"]
        return self.token

    def post(self, path: str, params: dict[str, Any], *, retry: bool = True) -> dict[str, Any]:
        if not self.token:
            self.resolve_token()
        gap = time.monotonic() - self.last_call
        if gap < self.pause:
            time.sleep(self.pause - gap)
        self.last_call = time.monotonic()
        body = dict(params)
        body["TOKEN"] = self.token or ""
        req = urllib.request.Request(
            XILA_BASE_URL.rstrip("/") + "/" + path.lstrip("/"),
            data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        self.calls += 1
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                payload = json.load(resp)
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
            self.failures[path] += 1
            if retry:
                self.resolve_token(force=True)
                time.sleep(0.8)
                return self.post(path, params, retry=False)
            return {"code": -1, "msg": str(exc), "data": {}}
        if payload.get("code") == 403 and retry:
            self.resolve_token(force=True)
            time.sleep(0.5)
            return self.post(path, params, retry=False)
        if payload.get("code") not in (0, "0", None):
            self.failures[path] += 1
        return payload


def rows_and_total(resp: dict[str, Any]) -> tuple[list[dict[str, Any]], int | None]:
    data = resp.get("data", resp)
    total = None
    rows: Any = []
    if isinstance(data, dict):
        for key in ("total", "Total", "totalCount", "count"):
            if data.get(key) is not None:
                try:
                    total = int(data[key])
                except (TypeError, ValueError):
                    pass
                break
        rows = data.get("rows") or data.get("list") or data.get("records") or data.get("items") or data.get("data") or []
    elif isinstance(data, list):
        rows = data
        total = len(rows)
    if isinstance(rows, dict):
        rows = rows.get("rows") or rows.get("list") or rows.get("items") or []
    if not isinstance(rows, list):
        rows = []
    return [r for r in rows if isinstance(r, dict)], total


def payload_dict(resp: dict[str, Any]) -> dict[str, Any]:
    data = resp.get("data", resp)
    if isinstance(data, dict):
        nested = data.get("data")
        return nested if isinstance(nested, dict) else data
    return {}


def first(*values: Any) -> Any:
    for value in values:
        if value is not None and value != "":
            return value
    return None


def as_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def as_int(value: Any) -> int | None:
    num = as_float(value)
    return None if num is None else int(num)


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0088
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def contains_any(text: str, words: list[str]) -> bool:
    return any(word in text for word in words)


def infer_area(address: str) -> tuple[str, str]:
    province = ""
    city = ""
    for p in ["安徽", "江苏", "浙江", "上海", "江西", "湖北", "河南"]:
        if p in address:
            province = p
            break
    if "上海" in address:
        return "上海", "上海"
    city_markers = [
        "芜湖",
        "合肥",
        "马鞍山",
        "宣城",
        "铜陵",
        "池州",
        "滁州",
        "安庆",
        "南京",
        "苏州",
        "无锡",
        "常州",
        "镇江",
        "扬州",
        "南通",
        "杭州",
        "湖州",
        "嘉兴",
        "宁波",
        "九江",
        "南昌",
        "武汉",
        "黄石",
        "信阳",
    ]
    for c in city_markers:
        if c in address:
            city = c
            break
    return province, city


def collect_candidates(client: XilaClient, pages: int, limit: int) -> list[dict[str, Any]]:
    dedup: dict[str, dict[str, Any]] = {}
    for q_index, query in enumerate(SEARCH_QUERIES, 1):
        for page in range(1, pages + 1):
            params = {"index": str(page), "limit": str(limit), **query}
            resp = client.post(SEARCH_PATH, params)
            rows, total = rows_and_total(resp)
            print(f"[search] {q_index:02d}/{len(SEARCH_QUERIES)} page={page} total={total} rows={len(rows)} {query}", flush=True)
            if not rows:
                break
            for row in rows:
                code = row.get("credit_code") or row.get("creditCode")
                if not code:
                    continue
                item = dedup.setdefault(code, {})
                item.update({k: v for k, v in row.items() if v not in (None, "")})
                item.setdefault("_source_queries", []).append(query)
            if total is not None and page * limit >= total:
                break
    return list(dedup.values())


def rough_priority(row: dict[str, Any]) -> float:
    text = " ".join(
        str(row.get(k) or "")
        for k in ["name", "reg_address", "business_address", "keywords", "reg_capi", "oper_name"]
    )
    score = 0.0
    if contains_any(text, MATERIAL_KEYWORDS):
        score += 40
    if contains_any(text, ["门窗", "装饰", "幕墙"]):
        score -= 15
    if contains_any(text, NEARBY_AREAS):
        score += 12
    score += min(25, math.log10(max(1, as_float(row.get("reg_capi_num")) or 0) + 1) * 5)
    if contains_any(text, ["高新", "专精特新", "规上"]):
        score += 8
    return score


def normalize_company(base: dict[str, Any], detail: dict[str, Any]) -> dict[str, Any] | None:
    address = first(detail.get("business_address"), detail.get("reg_address"), base.get("business_address"), base.get("reg_address"), "")
    lat = as_float(first(detail.get("latitude"), detail.get("lat")))
    lng = as_float(first(detail.get("longitude"), detail.get("lng"), detail.get("lon")))
    if lat is None or lng is None:
        loc = str(detail.get("location") or "")
        if "," in loc:
            a, b = loc.split(",", 1)
            lat = as_float(a)
            lng = as_float(b)
    if lat is None or lng is None:
        return None
    dist = haversine(ORIGIN["lat"], ORIGIN["lng"], lat, lng)
    if dist > RADIUS_KM:
        return None
    province, city = infer_area(address)
    products = detail.get("main_product") if isinstance(detail.get("main_product"), list) else []
    chain = detail.get("industrial_chain") if isinstance(detail.get("industrial_chain"), list) else []
    chain_names = [str(x.get("name")) for x in chain if isinstance(x, dict) and x.get("name")]
    tags = detail.get("keywords") if isinstance(detail.get("keywords"), list) else []
    scope = str(first(detail.get("scope"), detail.get("business_scope"), ""))
    name = str(first(detail.get("name"), base.get("name"), ""))
    blob = " ".join([name, scope, " ".join(products), " ".join(chain_names), str(detail.get("industry_name_3") or "")])
    if not contains_any(blob, MATERIAL_KEYWORDS):
        return None
    factory_evidence = contains_any(
        blob,
        ["制造", "生产", "加工", "压延", "轧制", "挤压", "熔铸", "型材", "板带", "铝箔", "铝棒", "铝合金"],
    ) or str(detail.get("industry_name_1") or "") == "制造业"
    agent_evidence = contains_any(blob, ["销售", "批发", "商贸", "贸易", "经销", "代理"])
    category = "M" if factory_evidence else "A"
    if not factory_evidence and not agent_evidence:
        category = "A"
    return {
        "name": name,
        "short_name": first(detail.get("name_short"), ""),
        "credit_code": first(detail.get("credit_code"), base.get("credit_code"), ""),
        "enterprise_code": first(detail.get("EnterpriseCode"), base.get("EnterpriseCode"), ""),
        "operator": first(detail.get("oper_name"), base.get("oper_name"), ""),
        "category": category,
        "role_label": "原厂/加工厂" if category == "M" else "疑似一级代理/贸易商",
        "role_evidence": {
            "factory": factory_evidence,
            "agent": agent_evidence,
            "industry": " / ".join(str(detail.get(k) or "") for k in ["industry_name_1", "industry_name_2", "industry_name_3", "industry_name_4"]).strip(" /"),
        },
        "province": province,
        "city": city,
        "distance_km": round(dist, 1),
        "lat": lat,
        "lng": lng,
        "registered_capital_wan": as_int(first(detail.get("reg_capi_num"), base.get("reg_capi_num"))),
        "registered_capital": first(detail.get("reg_capi"), base.get("reg_capi"), ""),
        "paid_capital_wan": as_int(first(detail.get("actual_capi_num"), detail.get("paid_capital_num"))),
        "paid_capital": first(detail.get("paid_capital"), ""),
        "social_security_num": as_int(detail.get("social_security_num")) or 0,
        "enterprise_class": first(detail.get("enterprise_class"), ""),
        "enterprise_above_class": first(detail.get("enterprise_above_class"), ""),
        "status": first(detail.get("status"), ""),
        "status_code": detail.get("status_code"),
        "start_date": first(detail.get("start_date"), base.get("start_date"), ""),
        "change_date": first(detail.get("change_date"), ""),
        "check_date": first(detail.get("check_date"), ""),
        "last_update_time": first(detail.get("last_update_time"), ""),
        "address": address,
        "reg_address": first(detail.get("reg_address"), ""),
        "business_address": first(detail.get("business_address"), ""),
        "scope": scope,
        "main_product": products,
        "industrial_chain": chain_names[:12],
        "keywords": tags,
        "group_name": first(detail.get("group_name"), ""),
        "park_name": first(detail.get("park_name"), detail.get("dev_park_name"), ""),
        "listed_state": first(detail.get("listedstate"), ""),
        "tel": first(detail.get("tel"), ""),
        "emails": first(detail.get("emails"), ""),
        "domain": first(detail.get("domain"), detail.get("website"), ""),
        "website_num": as_int(detail.get("website_num")) or 0,
        "patent_num": as_int(detail.get("patent_num")) or 0,
        "trademark_num": as_int(detail.get("trademark_num")) or 0,
        "certificates_num": as_int(detail.get("certificates_num")) or 0,
        "recruit_num": as_int(detail.get("recruit_num")) or 0,
        "tax_revenue_growth_rate": as_float(detail.get("tax_revenue_growth_rate")),
        "main_income_growth_label": as_float(detail.get("main_income_growth_label")),
        "classifications_ys": detail.get("classifications_ys") if isinstance(detail.get("classifications_ys"), dict) else {},
        "detail": {k: detail.get(k) for k in [
            "belong_org",
            "econ_kind_std",
            "term_start",
            "term_end",
            "county_code",
            "city_code",
            "province_code",
            "is_real",
            "is_equity",
            "have_project_clue",
        ]},
        "enrich": {},
        "risk_counts": {},
        "risk_rows": {},
        "coverage": {},
        "score": 0,
        "score_parts": {},
        "decision": "",
    }


def fetch_detail_companies(client: XilaClient, candidates: list[dict[str, Any]], max_details: int) -> list[dict[str, Any]]:
    candidates = sorted(candidates, key=rough_priority, reverse=True)[:max_details]
    companies: list[dict[str, Any]] = []
    for index, base in enumerate(candidates, 1):
        code = base.get("credit_code")
        if not code:
            continue
        resp = client.post(DETAIL_PATH, {"credit_code": code})
        detail = payload_dict(resp)
        item = normalize_company(base, detail)
        if item:
            companies.append(item)
        if index % 25 == 0:
            print(f"[detail] {index}/{len(candidates)} kept={len(companies)} calls={client.calls}", flush=True)
    companies.sort(key=lambda c: (c["distance_km"], -(c["registered_capital_wan"] or 0)))
    return companies


def enrich_companies(client: XilaClient, companies: list[dict[str, Any]], max_enrich: int) -> None:
    chosen = sorted(companies, key=lambda c: pre_enrich_score(c), reverse=True)[:max_enrich]
    chosen_codes = {c["credit_code"] for c in chosen}
    for c_index, company in enumerate(chosen, 1):
        code = company["credit_code"]
        print(f"[enrich] company {c_index}/{len(chosen)} {company['name']}", flush=True)
        for key, spec in ENRICH_ENDPOINTS.items():
            params = {"credit_code": code}
            params.update(spec.get("extra") or {})
            if spec.get("paged"):
                params.update({"index": 1, "limit": 20})
            resp = client.post(spec["path"], params)
            rows, total = rows_and_total(resp)
            company["coverage"][key] = {
                "ok": resp.get("code") in (0, "0", None),
                "total": total if total is not None else len(rows),
                "label": spec["label"],
            }
            if key in RISK_KEYS:
                company["risk_counts"][key] = total if total is not None else len(rows)
                company["risk_rows"][key] = rows[:5]
            else:
                company["enrich"][key] = {
                    "total": total if total is not None else len(rows),
                    "rows": rows[:6],
                }
            if key == "annual_reports" and rows:
                enrich_annual_report_sections(client, company, rows[:2])
        if c_index % 10 == 0:
            print(f"[enrich] {c_index}/{len(chosen)} calls={client.calls}", flush=True)
    for company in companies:
        if company["credit_code"] not in chosen_codes:
            company["coverage"]["not_enriched"] = {"ok": False, "total": 0, "label": "未进入深度补充批次"}


def annual_report_id(row: dict[str, Any]) -> str:
    for key in ("annual_report_id", "annualReportId", "id", "report_id", "reportId"):
        value = row.get(key)
        if value:
            return str(value)
    return ""


def enrich_annual_report_sections(client: XilaClient, company: dict[str, Any], annual_rows: list[dict[str, Any]]) -> None:
    sections: dict[str, Any] = {}
    for row in annual_rows:
        rid = annual_report_id(row)
        if not rid:
            continue
        year = first(row.get("year"), row.get("anche_year"), row.get("report_year"), row.get("annual_year"), rid)
        sections[str(year)] = {}
        for key, spec in ANNUAL_REPORT_ENDPOINTS.items():
            resp = client.post(spec["path"], {"annual_report_id": rid})
            rows, total = rows_and_total(resp)
            payload = payload_dict(resp)
            sections[str(year)][key] = {
                "label": spec["label"],
                "total": total if total is not None else (len(rows) if rows else (1 if payload else 0)),
                "rows": rows[:4],
                "payload": payload if payload and not rows else {},
            }
            company["coverage"][key] = {
                "ok": resp.get("code") in (0, "0", None),
                "total": sections[str(year)][key]["total"],
                "label": spec["label"],
            }
    if sections:
        company["enrich"]["annual_report_sections"] = {"total": len(sections), "rows": sections}


def pre_enrich_score(c: dict[str, Any]) -> float:
    score = 0.0
    score += 60 if c["category"] == "M" else 35
    score += max(0, 22 - c["distance_km"] / 12)
    score += min(20, math.log10(max(1, c.get("registered_capital_wan") or 0) + 1) * 4)
    score += min(16, (c.get("social_security_num") or 0) / 20)
    if c.get("enterprise_above_class"):
        score += 10
    if c.get("keywords"):
        score += 6
    return score


def score_company(c: dict[str, Any]) -> None:
    parts: dict[str, float] = {}
    status = str(c.get("status") or "")
    active = contains_any(status, ["在营", "存续", "开业"])
    parts["存续状态"] = 12 if active else -36
    distance = c.get("distance_km") or 999
    parts["距离"] = max(0, 14 - distance / 25)
    parts["供应属性"] = 20 if c.get("category") == "M" else 14
    cap = c.get("registered_capital_wan") or 0
    parts["注册资本"] = min(12, math.log10(max(1, cap) + 1) * 2.8)
    ssn = c.get("social_security_num") or 0
    parts["人员规模"] = min(12, math.sqrt(ssn) * 0.75)
    parts["规上/资质"] = 0
    if c.get("enterprise_above_class"):
        parts["规上/资质"] += 6
    tags = " ".join(c.get("keywords") or [])
    if contains_any(tags, ["高新", "专精特新", "创新型"]):
        parts["规上/资质"] += 5
    parts["知识产权/证书"] = min(7, (c.get("patent_num") or 0) * 0.08 + (c.get("certificates_num") or 0) * 0.8)
    parts["联系方式"] = 3 if c.get("tel") or c.get("emails") or ((c.get("enrich", {}).get("mobile") or {}).get("total") or 0) else 0
    parts["产业链匹配"] = 8 if any("铝" in x for x in c.get("industrial_chain") or []) else 4
    enrich = c.get("enrich") or {}
    parts["经营活跃"] = min(
        8,
        ((enrich.get("bidding") or {}).get("total") or 0) * 0.35
        + ((enrich.get("hire") or {}).get("total") or 0) * 0.18
        + ((enrich.get("news") or {}).get("total") or 0) * 0.12
        + ((enrich.get("approved_policy") or {}).get("total") or 0) * 0.45,
    )
    parts["年报背书"] = min(
        5,
        ((enrich.get("annual_reports") or {}).get("total") or 0) * 0.8
        + ((enrich.get("annual_report_sections") or {}).get("total") or 0) * 0.6,
    )
    risk = c.get("risk_counts") or {}
    red = sum(risk.get(k, 0) or 0 for k in ["tax_abnormal", "major_tax_illegal", "illegal_info", "simple_cancel", "clear_info"])
    yellow = sum(risk.get(k, 0) or 0 for k in ["oper_abnorm", "punishment", "tax_arrears", "equity_pledge", "mortgage_info"])
    parts["风险扣分"] = -min(28, red * 12 + yellow * 2.5)
    guarant = 0
    annual_sections = (enrich.get("annual_report_sections") or {}).get("rows") or {}
    if isinstance(annual_sections, dict):
        for section in annual_sections.values():
            if isinstance(section, dict):
                guarant += ((section.get("report_out_guarant") or {}).get("total") or 0)
    if guarant:
        parts["担保扣分"] = -min(6, guarant * 2)
    growth = c.get("main_income_growth_label")
    if growth is not None and growth < -20:
        parts["经营趋势"] = -4
    elif growth is not None and growth > 10:
        parts["经营趋势"] = 3
    else:
        parts["经营趋势"] = 0
    if ssn == 0 and cap >= 10000:
        parts["实体性扣分"] = -6
    raw_score = 18 + sum(parts.values())
    score = max(0, min(100, round(raw_score, 1)))
    c["score"] = score
    c["score_parts"] = {k: round(v, 1) for k, v in parts.items()}
    if not active:
        c["decision"] = "主体状态异常"
    elif score >= 82:
        c["decision"] = "信息密度高"
    elif score >= 70:
        c["decision"] = "信息较完整"
    elif score >= 55:
        c["decision"] = "信息一般"
    else:
        c["decision"] = "信息缺口较多"


def build_analysis(companies: list[dict[str, Any]], client: XilaClient, started_at: float) -> dict[str, Any]:
    for company in companies:
        score_company(company)
    companies.sort(key=lambda c: (-c["score"], c["distance_km"]))
    role_counts = Counter(c["role_label"] for c in companies)
    province_counts = Counter(c["province"] or "未知" for c in companies)
    city_counts = Counter(c["city"] or "未知" for c in companies)
    status_counts = Counter(c["status"] or "未知" for c in companies)
    risk_totals = Counter()
    coverage_totals = defaultdict(lambda: {"ok": 0, "total": 0, "label": ""})
    for c in companies:
        risk_totals.update(c.get("risk_counts") or {})
        for k, v in (c.get("coverage") or {}).items():
            coverage_totals[k]["ok"] += 1 if v.get("ok") else 0
            coverage_totals[k]["total"] += v.get("total") or 0
            coverage_totals[k]["label"] = v.get("label") or k
    buckets = Counter()
    for c in companies:
        d = c["distance_km"]
        if d <= 50:
            buckets["0-50km"] += 1
        elif d <= 100:
            buckets["50-100km"] += 1
        elif d <= 200:
            buckets["100-200km"] += 1
        else:
            buckets["200-300km"] += 1
    return {
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "duration_seconds": round(time.monotonic() - started_at, 1),
        "api_calls": client.calls,
        "api_failures": dict(client.failures),
        "origin": ORIGIN,
        "radius_km": RADIUS_KM,
        "material_label": MATERIAL_LABEL,
        "material_keywords": MATERIAL_KEYWORDS,
        "summary": {
            "company_count": len(companies),
            "factory_count": sum(1 for c in companies if c["category"] == "M"),
            "agent_count": sum(1 for c in companies if c["category"] == "A"),
            "average_score": round(sum(c["score"] for c in companies) / max(1, len(companies)), 1),
            "top_score": companies[0]["score"] if companies else 0,
            "with_contact": sum(1 for c in companies if c.get("tel") or c.get("emails") or ((c.get("enrich", {}).get("mobile") or {}).get("total") or 0)),
            "with_risk_signal": sum(1 for c in companies if sum((c.get("risk_counts") or {}).values()) > 0),
        },
        "charts": {
            "role_counts": dict(role_counts),
            "province_counts": dict(province_counts.most_common(12)),
            "city_counts": dict(city_counts.most_common(16)),
            "status_counts": dict(status_counts),
            "distance_buckets": dict(buckets),
            "risk_totals": dict(risk_totals),
            "coverage_totals": dict(coverage_totals),
        },
    }


def render_html(snapshot: dict[str, Any], path: Path) -> None:
    data = json.dumps(snapshot, ensure_ascii=False, separators=(",", ":"))
    path.write_text(HTML_TEMPLATE.replace("__DATA__", data), encoding="utf-8")


def save_json(snapshot: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8")


HTML_TEMPLATE = r"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>芜湖永康 · 300km 铝供应商雷达</title>
<style>
:root{--bg:#08110f;--panel:#101d19;--panel2:#14251f;--line:#29433a;--text:#eef7f1;--muted:#8aa297;--accent:#6ee7b7;--amber:#f6c35b;--red:#ef6b64;--blue:#67b7ff;--violet:#b7a5ff;--green:#7fe08a;--shadow:0 18px 60px rgba(0,0,0,.36);font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;color:var(--text);background:var(--bg)}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 20% 0%,#173327 0,#08110f 34%,#060907 100%);letter-spacing:0}button,input,select{font:inherit}button{cursor:pointer}
.shell{display:grid;grid-template-columns:74px 360px minmax(0,1fr);height:100vh;overflow:hidden}.nav{border-right:1px solid var(--line);background:#07100d;display:flex;flex-direction:column;align-items:center;padding:16px 10px;gap:12px}.nav .mark{width:42px;height:42px;border-radius:10px;display:grid;place-items:center;background:linear-gradient(135deg,#e9fff5,#84e0b6);color:#062217;font-weight:900}.nav button{width:52px;height:52px;border-radius:10px;border:1px solid transparent;background:transparent;color:var(--muted);display:grid;place-items:center}.nav button.active{background:#162a23;color:var(--accent);border-color:#2d5145}.nav button span{font-size:11px;line-height:1.15}.sidebar{border-right:1px solid var(--line);background:rgba(10,22,18,.9);overflow:auto}.side-head{padding:20px 20px 14px;border-bottom:1px solid var(--line)}.eyebrow{font-size:12px;color:var(--accent);font-weight:800}.side-head h1{font-size:22px;line-height:1.2;margin:6px 0}.side-head p{margin:0;color:var(--muted);font-size:12px;line-height:1.6}.stats{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:14px}.stat{background:#0c1814;border:1px solid var(--line);border-radius:8px;padding:10px}.stat b{display:block;font-size:22px}.stat span{font-size:11px;color:var(--muted)}
.filters{padding:16px 20px}.section{padding:14px 0;border-bottom:1px solid rgba(255,255,255,.08)}.label{font-size:12px;color:var(--muted);margin-bottom:8px}.chips{display:flex;flex-wrap:wrap;gap:7px}.chip{border:1px solid var(--line);background:#0b1713;color:#b9cac2;border-radius:6px;padding:6px 9px;font-size:12px}.chip.on{border-color:var(--accent);background:rgba(110,231,183,.15);color:var(--accent)}.input,.select{width:100%;height:36px;border-radius:7px;border:1px solid var(--line);background:#08120f;color:var(--text);padding:0 10px}.range{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center}.toggle{display:flex;gap:8px;align-items:center;margin:8px 0;color:#c9d8d2;font-size:13px}.main{min-width:0;overflow:auto}.view{display:none;min-height:100vh}.view.active{display:block}.radar-layout{display:grid;grid-template-columns:minmax(520px,1.25fr) minmax(420px,.75fr);gap:16px;padding:18px}.topbar{position:sticky;top:0;z-index:10;background:rgba(8,17,15,.85);backdrop-filter:blur(14px);border-bottom:1px solid var(--line);padding:14px 18px;display:flex;justify-content:space-between;align-items:center}.topbar h2{font-size:18px;margin:0}.actions{display:flex;gap:8px}.btn{border:1px solid var(--line);background:#102019;color:var(--text);border-radius:7px;height:34px;padding:0 12px}.btn.primary{border-color:var(--accent);color:#052117;background:var(--accent);font-weight:800}.map-card{min-height:calc(100vh - 86px);background:linear-gradient(160deg,#0f211b,#07110e);border:1px solid var(--line);box-shadow:var(--shadow);border-radius:8px;position:relative;overflow:hidden}.map-card:before{content:"";position:absolute;inset:-20%;background-image:linear-gradient(rgba(110,231,183,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(110,231,183,.07) 1px,transparent 1px);background-size:42px 42px;transform:rotate(-5deg)}.radar{position:absolute;inset:24px}.radius{position:absolute;left:50%;top:50%;width:min(72vw,760px);height:min(72vw,760px);max-height:78vh;max-width:78vh;border:1px dashed rgba(246,195,91,.5);border-radius:50%;transform:translate(-50%,-50%)}.origin{position:absolute;left:50%;top:50%;width:46px;height:46px;border-radius:50%;display:grid;place-items:center;background:var(--amber);color:#1b1300;font-size:12px;font-weight:900;transform:translate(-50%,-50%);box-shadow:0 0 0 4px rgba(246,195,91,.15),0 0 38px rgba(246,195,91,.55)}.pin{position:absolute;border-radius:50%;display:grid;place-items:center;color:#06100d;font-size:10px;font-weight:900;border:2px solid rgba(255,255,255,.85);box-shadow:0 8px 24px rgba(0,0,0,.35);transform:translate(-50%,-50%)}.pin.M{background:#ff806d}.pin.A{background:#67d7ff}.pin.active{outline:4px solid rgba(110,231,183,.35);z-index:5}.legend{position:absolute;right:18px;bottom:18px;background:rgba(7,16,13,.78);border:1px solid var(--line);border-radius:8px;padding:12px;font-size:12px;color:var(--muted)}.list-panel{display:flex;flex-direction:column;gap:10px}.meta-row{display:flex;justify-content:space-between;align-items:center;color:var(--muted);font-size:12px}.supplier-list{display:grid;gap:10px;max-height:calc(100vh - 130px);overflow:auto;padding-right:4px}.supplier{background:rgba(16,29,25,.92);border:1px solid var(--line);border-radius:8px;padding:13px;display:grid;gap:8px}.supplier.active,.supplier:hover{border-color:var(--accent)}.row{display:flex;align-items:center;gap:8px;min-width:0}.badge{font-size:11px;font-weight:900;border-radius:5px;padding:3px 7px;white-space:nowrap}.badge.M{color:#ffd2ca;background:rgba(255,128,109,.15)}.badge.A{color:#cfeeff;background:rgba(103,183,255,.14)}.supplier .name{font-weight:850;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}.mini{display:flex;gap:10px;flex-wrap:wrap;color:var(--muted);font-size:12px}.score{margin-left:auto;font-weight:900;color:var(--accent)}.bar{height:7px;background:#07110e;border-radius:999px;overflow:hidden}.bar i{display:block;height:100%;background:linear-gradient(90deg,var(--accent),var(--amber));border-radius:999px}.analysis{padding:18px;display:grid;gap:16px}.hero{display:grid;grid-template-columns:1.15fr .85fr;gap:16px}.panel{background:rgba(16,29,25,.9);border:1px solid var(--line);border-radius:8px;padding:16px;box-shadow:var(--shadow)}.panel h3{margin:0 0 12px;font-size:15px}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.kpi{background:#0a1612;border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:13px}.kpi b{display:block;font-size:28px}.kpi span{color:var(--muted);font-size:12px}.grid2{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}.chart-row{display:grid;grid-template-columns:90px 1fr 44px;gap:10px;align-items:center;margin:9px 0;font-size:12px}.chart-row .track{height:10px;background:#07110e;border-radius:999px;overflow:hidden}.chart-row i{display:block;height:100%;background:var(--accent)}.rank-table{width:100%;border-collapse:collapse;font-size:12px}.rank-table th,.rank-table td{border-bottom:1px solid rgba(255,255,255,.08);padding:10px 8px;text-align:left;vertical-align:top}.rank-table th{color:var(--muted);font-weight:700}.decision{font-weight:900}.risk-low{color:var(--green)}.risk-mid{color:var(--amber)}.risk-high{color:var(--red)}.modal{position:fixed;inset:0;background:rgba(0,0,0,.62);display:none;align-items:center;justify-content:center;z-index:50}.modal.open{display:flex}.modal-card{width:min(980px,92vw);max-height:86vh;overflow:auto;background:#0d1915;border:1px solid var(--line);border-radius:10px;box-shadow:0 24px 80px rgba(0,0,0,.65)}.modal-head{position:sticky;top:0;background:#0d1915;border-bottom:1px solid var(--line);padding:16px 18px;display:flex;justify-content:space-between;gap:16px}.modal-head h3{margin:0}.close{width:34px;height:34px;border-radius:7px;border:1px solid var(--line);background:#11211b;color:var(--text)}.modal-body{padding:18px;display:grid;gap:16px}.detail-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.detail-box{background:#08120f;border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:10px}.detail-box span{display:block;color:var(--muted);font-size:11px;margin-bottom:4px}.detail-box b{font-size:13px}.pill-row{display:flex;gap:6px;flex-wrap:wrap}.pill{font-size:11px;border:1px solid var(--line);background:#07110e;color:#bfd0c8;border-radius:999px;padding:4px 8px}.json-lite{white-space:pre-wrap;word-break:break-word;color:#cbd9d3;background:#07110e;border:1px solid var(--line);border-radius:8px;padding:12px;font-size:12px;line-height:1.55;max-height:240px;overflow:auto}.note{color:var(--muted);font-size:12px;line-height:1.7}.coverage{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.coverage .detail-box b{font-size:18px}@media(max-width:1180px){.shell{grid-template-columns:60px 320px minmax(0,1fr)}.radar-layout,.hero,.grid2{grid-template-columns:1fr}.map-card{min-height:620px}.kpis{grid-template-columns:repeat(2,1fr)}}@media(max-width:820px){.shell{display:block;height:auto}.nav{position:sticky;top:0;z-index:20;flex-direction:row;height:66px}.sidebar{max-height:none}.radar-layout{padding:10px}.detail-grid,.coverage{grid-template-columns:1fr}.kpis{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="shell">
  <nav class="nav">
    <div class="mark">Al</div>
    <button class="active" data-view="radar" title="参考雷达"><span>参考<br>雷达</span></button>
    <button data-view="analysis" title="对比分析"><span>对比<br>分析</span></button>
  </nav>
  <aside class="sidebar">
    <div class="side-head">
      <div class="eyebrow">芜湖永康 · 300km</div>
      <h1>铝供应商雷达</h1>
      <p id="sourceNote"></p>
      <div class="stats">
        <div class="stat"><b id="kCount">0</b><span>企业数量</span></div>
        <div class="stat"><b id="kFactory">0</b><span>原厂/加工厂</span></div>
        <div class="stat"><b id="kAgent">0</b><span>疑似一级代理</span></div>
        <div class="stat"><b id="kAvg">0</b><span>平均评分</span></div>
      </div>
    </div>
    <div class="filters">
      <div class="section">
        <div class="label">企业类别</div>
        <div class="chips" id="catFilter"><span class="chip on" data-cat="M">原厂</span><span class="chip on" data-cat="A">一级代理</span></div>
      </div>
      <div class="section">
        <div class="label">名称 / 产品 / 经营范围</div>
        <input class="input" id="searchInput" placeholder="铝型材 / 铝板 / 合金 / 高新">
      </div>
      <div class="section">
        <div class="label">信息层级</div>
        <div class="chips" id="decisionFilter"></div>
      </div>
      <div class="section">
        <div class="label">评分区间</div>
        <div class="range"><input class="input" id="scoreMin" type="number" value="0"><span>—</span><input class="input" id="scoreMax" type="number" value="100"></div>
      </div>
      <div class="section">
        <div class="label">距离区间 km</div>
        <div class="range"><input class="input" id="distMin" type="number" value="0"><span>—</span><input class="input" id="distMax" type="number" value="300"></div>
      </div>
      <div class="section">
        <div class="label">省份</div>
        <div class="chips" id="provinceFilter"></div>
      </div>
      <div class="section">
        <div class="label">其他筛选</div>
        <label class="toggle"><input id="onlyActive" type="checkbox" checked> 仅存续/在营</label>
        <label class="toggle"><input id="onlyContact" type="checkbox"> 仅有联系方式或联系人线索</label>
        <label class="toggle"><input id="onlyRiskFree" type="checkbox"> 隐藏已发现风险记录</label>
      </div>
    </div>
  </aside>
  <main class="main">
    <section class="view active" id="radarView">
      <div class="topbar">
        <h2>参考雷达</h2>
        <div class="actions"><select class="select" id="sortSelect"><option value="score">按评分</option><option value="distance">按距离</option><option value="capital">按注册资本</option><option value="people">按参保人数</option></select><button class="btn" id="fitBtn">适配视野</button><button class="btn primary" id="exportBtn">导出 CSV</button></div>
      </div>
      <div class="radar-layout">
        <div class="map-card"><div class="radar" id="radar"><div class="radius"></div><div class="origin">芜湖</div></div><div class="legend">橙色：原厂/加工厂<br>蓝色：疑似一级代理<br>圆圈：300km 半径相对雷达图</div></div>
        <div class="list-panel"><div class="meta-row"><span id="shownCount">0</span><span>点击企业查看接口详情</span></div><div class="supplier-list" id="supplierList"></div></div>
      </div>
    </section>
    <section class="view" id="analysisView">
      <div class="topbar"><h2>对比分析</h2><div class="note" id="runMeta"></div></div>
      <div class="analysis">
        <div class="hero">
          <div class="panel"><h3>综合判断</h3><div class="kpis" id="analysisKpis"></div><p class="note" id="judgement"></p></div>
          <div class="panel"><h3>综合指数口径</h3><p class="note">综合指数不是接口原字段，而是基于 Xila 工商详情、产业链标签、注册/实缴资本、参保人数、资质标签、距离、联系方式、经营活跃记录和风险接口结果计算，用于横向展示不同企业的信息密度与可比维度。</p></div>
        </div>
        <div class="grid2">
          <div class="panel"><h3>地区分布</h3><div id="provinceChart"></div></div>
          <div class="panel"><h3>距离分布</h3><div id="distanceChart"></div></div>
          <div class="panel"><h3>风险信号汇总</h3><div id="riskChart"></div></div>
          <div class="panel"><h3>接口覆盖</h3><div class="coverage" id="coverageGrid"></div></div>
        </div>
        <div class="panel"><h3>Top 供应商排名</h3><table class="rank-table" id="rankTable"></table></div>
      </div>
    </section>
  </main>
</div>
<div class="modal" id="modal"><div class="modal-card"><div class="modal-head"><div><h3 id="modalTitle"></h3><div class="note" id="modalSub"></div></div><button class="close" id="modalClose">×</button></div><div class="modal-body" id="modalBody"></div></div></div>
<script>
const SNAPSHOT = __DATA__;
const COMPANIES = SNAPSHOT.companies || [];
const state = {cat:{M:true,A:true}, q:'', decision:'', province:'', scoreMin:0, scoreMax:100, distMin:0, distMax:300, onlyActive:true, onlyContact:false, onlyRiskFree:false, sort:'score', active:null};
const $ = s => document.querySelector(s);
const fmt = n => n==null || n==='' ? '—' : Number(n).toLocaleString('zh-CN');
const esc = s => (s==null?'':String(s)).replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
function hasContact(c){return !!(c.tel || c.emails || (((c.enrich||{}).mobile||{}).total||0));}
function riskTotal(c){return Object.values(c.risk_counts||{}).reduce((a,b)=>a+(Number(b)||0),0);}
function activeStatus(c){return /在营|存续|开业/.test(c.status||'');}
function filtered(){
  let rows = COMPANIES.filter(c => state.cat[c.category]);
  rows = rows.filter(c => !state.decision || c.decision === state.decision);
  rows = rows.filter(c => !state.province || c.province === state.province);
  rows = rows.filter(c => c.score >= state.scoreMin && c.score <= state.scoreMax);
  rows = rows.filter(c => c.distance_km >= state.distMin && c.distance_km <= state.distMax);
  if(state.onlyActive) rows = rows.filter(activeStatus);
  if(state.onlyContact) rows = rows.filter(hasContact);
  if(state.onlyRiskFree) rows = rows.filter(c => riskTotal(c) === 0);
  if(state.q){
    const q = state.q.toLowerCase();
    rows = rows.filter(c => [c.name,c.scope,c.address,(c.main_product||[]).join(' '),(c.industrial_chain||[]).join(' '),(c.keywords||[]).join(' ')].join(' ').toLowerCase().includes(q));
  }
  rows.sort((a,b)=>{
    if(state.sort==='distance') return a.distance_km-b.distance_km;
    if(state.sort==='capital') return (b.registered_capital_wan||0)-(a.registered_capital_wan||0);
    if(state.sort==='people') return (b.social_security_num||0)-(a.social_security_num||0);
    return b.score-a.score || a.distance_km-b.distance_km;
  });
  return rows;
}
function pinPos(c){
  const dx = (c.lng - SNAPSHOT.analysis.origin.lng) * Math.cos(SNAPSHOT.analysis.origin.lat*Math.PI/180) * 111.32;
  const dy = (c.lat - SNAPSHOT.analysis.origin.lat) * 110.57;
  const r = Math.min(1, Math.sqrt(dx*dx+dy*dy)/300) * 38;
  const angle = Math.atan2(dy, dx);
  return {left:50 + Math.cos(angle)*r, top:50 - Math.sin(angle)*r};
}
function renderRadar(){
  const rows = filtered();
  const radar = $('#radar');
  radar.querySelectorAll('.pin').forEach(n=>n.remove());
  rows.slice(0, 420).forEach(c => {
    const p = pinPos(c), size = Math.max(11, Math.min(26, 10 + c.score/6));
    const node = document.createElement('button');
    node.className = `pin ${c.category}${state.active===c.credit_code?' active':''}`;
    node.style.cssText = `left:${p.left}%;top:${p.top}%;width:${size}px;height:${size}px`;
    node.textContent = c.category;
    node.title = `${c.name} ${c.score}分 ${c.distance_km}km`;
    node.onclick = () => openCompany(c.credit_code);
    radar.appendChild(node);
  });
  $('#shownCount').textContent = `已显示 ${rows.length} / ${COMPANIES.length} 家`;
  const list = $('#supplierList');
  list.innerHTML = rows.slice(0, 260).map(c => `<div class="supplier ${state.active===c.credit_code?'active':''}" onclick="openCompany('${c.credit_code}')"><div class="row"><span class="badge ${c.category}">${c.category==='M'?'原厂':'代理'}</span><span class="name">${esc(c.name)}</span><span class="score">${c.score}</span></div><div class="mini"><span>${esc(c.decision)}</span><span>${c.distance_km}km</span><span>${esc(c.province||'')}${esc(c.city||'')}</span><span>资本 ${fmt(c.registered_capital_wan)} 万</span><span>参保 ${fmt(c.social_security_num)}</span><span>风险 ${riskTotal(c)}</span></div><div class="bar"><i style="width:${c.score}%"></i></div></div>`).join('');
}
function chart(el, data, color='var(--accent)'){
  const entries = Object.entries(data||{}).filter(([,v])=>Number(v)>0).sort((a,b)=>Number(b[1])-Number(a[1])).slice(0,12);
  const max = Math.max(1,...entries.map(([,v])=>Number(v)));
  el.innerHTML = entries.length ? entries.map(([k,v])=>`<div class="chart-row"><span title="${esc(k)}">${esc(k)}</span><div class="track"><i style="width:${Number(v)/max*100}%;background:${color}"></i></div><b>${v}</b></div>`).join('') : '<p class="note">暂无记录</p>';
}
function renderAnalysis(){
  const s = SNAPSHOT.analysis.summary;
  $('#analysisKpis').innerHTML = [['企业数量',s.company_count],['原厂/加工厂',s.factory_count],['平均综合指数',s.average_score],['存在风险记录企业',s.with_risk_signal]].map(x=>`<div class="kpi"><b>${x[1]}</b><span>${x[0]}</span></div>`).join('');
  $('#judgement').textContent = `本页展示 300km 范围内铝相关企业的工商、规模、产业链、资质、联系人、经营活跃、风险与接口覆盖信息。综合指数仅作为横向对比字段。`;
  chart($('#provinceChart'), SNAPSHOT.analysis.charts.province_counts, 'var(--accent)');
  chart($('#distanceChart'), SNAPSHOT.analysis.charts.distance_buckets, 'var(--amber)');
  chart($('#riskChart'), SNAPSHOT.analysis.charts.risk_totals, 'var(--red)');
  const cov = SNAPSHOT.analysis.charts.coverage_totals || {};
  $('#coverageGrid').innerHTML = Object.entries(cov).filter(([k])=>k!=='not_enriched').slice(0,18).map(([k,v])=>`<div class="detail-box"><span>${esc(v.label||k)}</span><b>${fmt(v.total)}</b><div class="note">覆盖 ${fmt(v.ok)} 家</div></div>`).join('');
  $('#rankTable').innerHTML = `<thead><tr><th>序号</th><th>企业</th><th>综合指数</th><th>信息层级</th><th>关键维度</th><th>风险记录</th></tr></thead><tbody>${COMPANIES.slice(0,40).map((c,i)=>`<tr onclick="openCompany('${c.credit_code}')"><td>${i+1}</td><td><b>${esc(c.name)}</b><div class="note">${esc(c.role_label)} · ${c.distance_km}km · ${esc(c.province||'')}${esc(c.city||'')}</div></td><td><b>${c.score}</b></td><td class="decision ${c.score>=80?'risk-low':c.score>=65?'risk-mid':'risk-high'}">${esc(c.decision)}</td><td>资本 ${fmt(c.registered_capital_wan)} 万 / 参保 ${fmt(c.social_security_num)} / ${esc(c.enterprise_above_class||c.enterprise_class||'')}</td><td>${riskTotal(c)}</td></tr>`).join('')}</tbody>`;
}
function openCompany(code){
  const c = COMPANIES.find(x => x.credit_code === code); if(!c) return;
  state.active = code; renderRadar();
  $('#modalTitle').textContent = c.name;
  $('#modalSub').textContent = `${c.role_label} · ${c.decision} · ${c.distance_km}km · ${c.credit_code}`;
  const riskRows = Object.entries(c.risk_rows||{}).filter(([,v])=>v&&v.length);
  const enrich = c.enrich || {};
  $('#modalBody').innerHTML = `
    <div class="detail-grid">
      ${box('综合指数', c.score)}
      ${box('信息层级', c.decision)}
      ${box('状态', c.status)}
      ${box('注册资本', `${fmt(c.registered_capital_wan)} 万`)}
      ${box('实缴资本', c.paid_capital || `${fmt(c.paid_capital_wan)} 万`)}
      ${box('参保人数', fmt(c.social_security_num))}
      ${box('法定代表人', c.operator)}
      ${box('联系方式', c.tel || c.emails || `联系人线索 ${((enrich.mobile||{}).total)||0}`)}
      ${box('产业链', (c.industrial_chain||[]).slice(0,3).join(' / '))}
    </div>
    <div class="panel"><h3>综合指数拆解</h3>${Object.entries(c.score_parts||{}).map(([k,v])=>`<div class="chart-row"><span>${esc(k)}</span><div class="track"><i style="width:${Math.min(100,Math.abs(Number(v))*5)}%;background:${Number(v)<0?'var(--red)':'var(--accent)'}"></i></div><b>${v}</b></div>`).join('')}</div>
    <div class="panel"><h3>主营与经营范围</h3><div class="pill-row">${(c.main_product||[]).concat(c.keywords||[]).slice(0,24).map(x=>`<span class="pill">${esc(x)}</span>`).join('')}</div><p class="note">${esc(c.scope)}</p></div>
    <div class="panel"><h3>地址与工商</h3><p class="note">${esc(c.address)}</p><div class="json-lite">${esc(JSON.stringify(c.detail||{}, null, 2))}</div></div>
    <div class="panel"><h3>接口补充摘要</h3><div class="coverage">${Object.entries(c.coverage||{}).filter(([k])=>k!=='not_enriched').map(([k,v])=>`<div class="detail-box"><span>${esc(v.label||k)}</span><b>${fmt(v.total)}</b><div class="note">${v.ok?'已调用':'失败/无权限'}</div></div>`).join('') || '<p class="note">未进入深度补充批次</p>'}</div></div>
    <div class="panel"><h3>风险明细样本</h3>${riskRows.length ? riskRows.map(([k,v])=>`<h4>${esc((SNAPSHOT.analysis.charts.coverage_totals[k]||{}).label||k)}</h4><div class="json-lite">${esc(JSON.stringify(v, null, 2))}</div>`).join('') : '<p class="note">深度批次内未返回风险记录。</p>'}</div>
    <div class="panel"><h3>股东 / 新闻 / 联系人 / 招聘样本</h3><div class="json-lite">${esc(JSON.stringify({shareholders:enrich.shareholders, mobile:enrich.mobile, news:enrich.news, hire:enrich.hire, annual_reports:enrich.annual_reports}, null, 2))}</div></div>
  `;
  $('#modal').classList.add('open');
}
function box(k,v){return `<div class="detail-box"><span>${esc(k)}</span><b>${esc(v||'—')}</b></div>`}
function exportCsv(){
  const rows = filtered();
  const header = ['综合指数','信息层级','类别','名称','统一社会信用代码','省','市','距离km','注册资本万','实缴资本万','参保人数','状态','法定代表人','地址','电话','邮箱','主营产品','产业链','风险记录数','经营范围'];
  const lines = [header.join(',')].concat(rows.map(c => [c.score,c.decision,c.role_label,c.name,c.credit_code,c.province,c.city,c.distance_km,c.registered_capital_wan,c.paid_capital_wan,c.social_security_num,c.status,c.operator,c.address,c.tel,c.emails,(c.main_product||[]).join('|'),(c.industrial_chain||[]).join('|'),riskTotal(c),(c.scope||'').slice(0,500)].map(x=>`"${String(x??'').replace(/"/g,'""')}"`).join(',')));
  const blob = new Blob(['\ufeff'+lines.join('\n')], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'wuhu_aluminum_suppliers.csv'; a.click(); URL.revokeObjectURL(a.href);
}
function init(){
  $('#sourceNote').textContent = SNAPSHOT.analysis.origin.note;
  $('#runMeta').textContent = `${SNAPSHOT.analysis.generated_at} · API ${SNAPSHOT.analysis.api_calls} 次 · ${SNAPSHOT.analysis.duration_seconds}s`;
  const s = SNAPSHOT.analysis.summary; $('#kCount').textContent=s.company_count; $('#kFactory').textContent=s.factory_count; $('#kAgent').textContent=s.agent_count; $('#kAvg').textContent=s.average_score;
  [...new Set(COMPANIES.map(c=>c.province).filter(Boolean))].sort().forEach(p => $('#provinceFilter').insertAdjacentHTML('beforeend', `<span class="chip" data-province="${esc(p)}">${esc(p)}</span>`));
  $('#provinceFilter').insertAdjacentHTML('afterbegin', '<span class="chip on" data-province="">全部</span>');
  [...new Set(COMPANIES.map(c=>c.decision))].forEach(d => $('#decisionFilter').insertAdjacentHTML('beforeend', `<span class="chip" data-decision="${esc(d)}">${esc(d)}</span>`));
  $('#decisionFilter').insertAdjacentHTML('afterbegin', '<span class="chip on" data-decision="">全部</span>');
  document.querySelectorAll('.nav button').forEach(b => b.onclick=()=>{document.querySelectorAll('.nav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));$('#'+b.dataset.view+'View').classList.add('active')});
  $('#catFilter').onclick=e=>{if(!e.target.dataset.cat)return; state.cat[e.target.dataset.cat]=!state.cat[e.target.dataset.cat]; e.target.classList.toggle('on'); renderRadar()};
  $('#provinceFilter').onclick=e=>{if(e.target.dataset.province==null)return; state.province=e.target.dataset.province; [...e.currentTarget.children].forEach(x=>x.classList.remove('on')); e.target.classList.add('on'); renderRadar()};
  $('#decisionFilter').onclick=e=>{if(e.target.dataset.decision==null)return; state.decision=e.target.dataset.decision; [...e.currentTarget.children].forEach(x=>x.classList.remove('on')); e.target.classList.add('on'); renderRadar()};
  $('#searchInput').oninput=e=>{state.q=e.target.value.trim(); renderRadar()};
  ['scoreMin','scoreMax','distMin','distMax'].forEach(id=>$('#'+id).oninput=e=>{state[id]=Number(e.target.value)||0; renderRadar()});
  $('#onlyActive').onchange=e=>{state.onlyActive=e.target.checked; renderRadar()}; $('#onlyContact').onchange=e=>{state.onlyContact=e.target.checked; renderRadar()}; $('#onlyRiskFree').onchange=e=>{state.onlyRiskFree=e.target.checked; renderRadar()};
  $('#sortSelect').onchange=e=>{state.sort=e.target.value; renderRadar()}; $('#exportBtn').onclick=exportCsv; $('#fitBtn').onclick=()=>{state.distMin=0;state.distMax=300;$('#distMin').value=0;$('#distMax').value=300;renderRadar()};
  $('#modalClose').onclick=()=>$('#modal').classList.remove('open'); $('#modal').onclick=e=>{if(e.target.id==='modal')$('#modal').classList.remove('open')};
  renderRadar(); renderAnalysis();
}
init();
</script>
</body>
</html>
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json-out", type=Path, default=DEFAULT_JSON)
    parser.add_argument("--html-out", type=Path, default=DEFAULT_HTML)
    parser.add_argument("--pages", type=int, default=2)
    parser.add_argument("--search-limit", type=int, default=100)
    parser.add_argument("--max-details", type=int, default=260)
    parser.add_argument("--max-enrich", type=int, default=80)
    parser.add_argument("--pause", type=float, default=0.16)
    parser.add_argument("--timeout", type=float, default=14.0)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    started = time.monotonic()
    client = XilaClient(pause=args.pause, timeout=args.timeout)
    print("[token] resolving through dev platform", flush=True)
    client.resolve_token(force=True)
    candidates = collect_candidates(client, args.pages, args.search_limit)
    print(f"[search] dedup candidates={len(candidates)}", flush=True)
    companies = fetch_detail_companies(client, candidates, args.max_details)
    print(f"[detail] within 300km aluminum companies={len(companies)}", flush=True)
    enrich_companies(client, companies, args.max_enrich)
    analysis = build_analysis(companies, client, started)
    snapshot = {
        "analysis": analysis,
        "companies": companies,
        "query": {
            "target": "芜湖永康 300km 铝原厂/一级代理",
            "search_queries": SEARCH_QUERIES,
            "max_details": args.max_details,
            "max_enrich": args.max_enrich,
        },
    }
    save_json(snapshot, args.json_out)
    render_html(snapshot, args.html_out)
    print(f"[done] json={args.json_out}", flush=True)
    print(f"[done] html={args.html_out}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
