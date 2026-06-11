#!/usr/bin/env python3
"""Render the Wuhu aluminum supplier dataset with the reference Leaflet UI."""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REFERENCE_HTML = ROOT / "参考.html"
DATA_JSON = ROOT / "data" / "wuhu_aluminum_suppliers.json"
OUTPUT_HTML = ROOT / "芜湖永康铝供应商雷达.html"


SECTION_CONFIG = [
    ("shareholders", "股东信息", [("SHName", "股东"), ("EquityRatio", "持股比例"), ("Capital", "认缴资本"), ("ActulCapital", "实缴资本"), ("CapitalDate", "出资日期"), ("CreditCode", "信用代码")]),
    ("annual_reports", "年报信息", [("ReportYear", "年份"), ("Tel", "电话"), ("Email", "邮箱"), ("EmployeeSum", "员工数"), ("BusinessStatus", "经营状态"), ("MainBusinessActivity", "主营活动"), ("EnterpriseAddress", "地址")]),
    ("finance_reports", "财务 / 社保", []),
    ("certificates", "资质证书", [("type_name", "类型"), ("name", "名称"), ("cert_name", "证书"), ("cert_no", "编号"), ("start_date", "开始"), ("end_date", "结束"), ("status", "状态")]),
    ("patents", "专利", [("patent_name", "专利名称"), ("patent_type", "类型"), ("status_name", "状态"), ("apply_no", "申请号"), ("apply_date", "申请日"), ("apply_pub_date", "公开日"), ("inventor", "发明人")]),
    ("trademarks", "商标", [("mark_name", "商标"), ("mark_classify", "类别"), ("status_desc", "状态"), ("apply_no", "申请号"), ("apply_date", "申请日"), ("agent_name", "代理机构")]),
    ("branches", "分支机构", []),
    ("outward_investment", "对外投资", []),
    ("leader_positions", "董监高任职", [("LeaderName", "姓名"), ("PostName", "职务"), ("PositionTypeDesc", "机构"), ("BeginningDate", "开始"), ("EndDate", "结束"), ("Incumbent", "在任")]),
    ("hire", "招聘记录", [("Position", "岗位"), ("Salary", "薪资"), ("WorkingPlace", "地点"), ("EducationLevel", "学历"), ("Experience", "经验"), ("PubDate", "发布日期"), ("PositionDescription", "职责")]),
    ("mobile", "关键联系人", [("Name", "姓名"), ("Position", "职位"), ("Mobile", "手机"), ("Phone", "电话"), ("Department", "部门")]),
    ("news", "新闻 / 舆情", [("Title", "标题"), ("PublishTime", "时间"), ("Source", "来源"), ("Summary", "摘要"), ("Url", "链接"), ("LinkAddress", "链接")]),
    ("policy", "可申报政策", [("type_name", "类型"), ("department_name", "部门"), ("apply_state_text", "申报状态"), ("subsidy_money", "金额"), ("start_time", "开始"), ("end_time", "结束"), ("search_word", "关键词")]),
    ("approved_policy", "已获政策", [("name", "项目"), ("type_name", "类型"), ("department_name", "部门"), ("subsidy_money", "金额"), ("year", "年份")]),
    ("eligible_subsidy", "补贴匹配", [("name", "项目"), ("type_name", "类型"), ("department_name", "部门"), ("subsidy_money", "金额"), ("score", "匹配分"), ("province_name", "省份")]),
    ("relation_chain", "关系链", []),
    ("bidding", "招投标", [("Title", "标题"), ("ProjectName", "项目"), ("BiddingTypeIName", "类型"), ("InfoPublDate", "发布日期"), ("Area", "地区"), ("BudgetValue", "预算"), ("BiddingMoney", "中标金额"), ("LinkAddress", "链接")]),
    ("copyright_software", "软件著作权", []),
    ("copyright_works", "作品著作权", []),
    ("listed_finance", "上市财务", []),
]

RISK_SECTION_CONFIG = [
    ("oper_abnorm", "经营异常"),
    ("punishment", "行政处罚"),
    ("tax_arrears", "欠税"),
    ("tax_abnormal", "税务非正常户"),
    ("major_tax_illegal", "重大税收违法"),
    ("illegal_info", "严重违法失信"),
    ("simple_cancel", "简易注销"),
    ("clear_info", "清算"),
    ("equity_pledge", "股权出质"),
    ("mortgage_info", "动产抵押"),
]


def split_industry(industry: str | None) -> tuple[str, str]:
    if not industry:
        return "", ""
    parts = [p.strip() for p in industry.split("/") if p.strip()]
    if len(parts) >= 4:
        return parts[1], parts[-1]
    if len(parts) >= 2:
        return parts[0], parts[-1]
    return "", industry


def coverage_summary(coverage: dict) -> str:
    if not isinstance(coverage, dict):
        return "未进入深度补充批次"
    ok_items = [
        f"{v.get('label') or k}:{v.get('total', 0)}"
        for k, v in coverage.items()
        if isinstance(v, dict) and v.get("ok")
    ]
    return " · ".join(ok_items[:12]) if ok_items else "未进入深度补充批次"


def risk_total(risk_counts: dict) -> int:
    if not isinstance(risk_counts, dict):
        return 0
    return sum(int(v or 0) for v in risk_counts.values())


def product_list(value) -> list[str]:
    if isinstance(value, list):
        return [str(v) for v in value if v][:20]
    if value:
        return [str(value)]
    return []


def cell_value(value) -> str:
    if value is None:
        return ""
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, str):
        return value[:240]
    if isinstance(value, list):
        parts = []
        for item in value[:4]:
            if isinstance(item, dict):
                parts.append(str(item.get("name") or item.get("title") or item.get("urlTitle") or item.get("ProjectName") or item.get("EnterpriseName") or item)[:80])
            else:
                parts.append(str(item)[:80])
        return "；".join(parts)
    if isinstance(value, dict):
        for key in ("name", "title", "urlTitle", "ProjectName", "EnterpriseName", "result"):
            if value.get(key):
                return str(value.get(key))[:160]
        return "；".join(f"{k}:{cell_value(v)}" for k, v in list(value.items())[:4])[:240]
    return str(value)[:240]


def normalize_rows(rows: list[dict], columns: list[tuple[str, str]]) -> list[dict]:
    output = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        if not columns:
            keys = [k for k, v in row.items() if v not in (None, "", [], {})][:7]
            normalized = [{"k": k, "v": cell_value(row.get(k))} for k in keys]
        else:
            normalized = [{"k": label, "v": cell_value(row.get(key))} for key, label in columns if row.get(key) not in (None, "", [], {})]
        if normalized:
            output.append(normalized)
    return output


def build_detail_sections(c: dict) -> list[dict]:
    enrich = c.get("enrich") or {}
    sections = []
    for key, label, columns in SECTION_CONFIG:
        data = enrich.get(key) or {}
        if isinstance(data, list):
            rows = data
            total = len(rows)
        elif isinstance(data, dict):
            rows = data.get("rows") or []
            total = data.get("total", len(rows) if rows else 0)
        else:
            rows = []
            total = 0
        sections.append(
            {
                "key": key,
                "label": label,
                "total": total,
                "rows": normalize_rows(rows, columns),
            }
        )
    risk_rows = c.get("risk_rows") or {}
    for key, label in RISK_SECTION_CONFIG:
        data = risk_rows.get(key) or {}
        if isinstance(data, list):
            rows = data
            total = len(rows)
        elif isinstance(data, dict):
            rows = data.get("rows") or []
            total = data.get("total", len(rows) if rows else (c.get("risk_counts") or {}).get(key, 0))
        else:
            rows = []
            total = (c.get("risk_counts") or {}).get(key, 0)
        sections.append(
            {
                "key": "risk_" + key,
                "label": label + "明细",
                "total": total,
                "rows": normalize_rows(rows, []),
            }
        )
    return sections


def unique_values(values: list[str], limit: int = 8) -> list[str]:
    seen = set()
    result = []
    for value in values:
        value = str(value or "").strip()
        if not value or value in seen:
            continue
        seen.add(value)
        result.append(value)
        if len(result) >= limit:
            break
    return result


def extract_contact_bundle(c: dict) -> dict:
    enrich = c.get("enrich") or {}
    annual_rows = (enrich.get("annual_reports") or {}).get("rows") or []
    mobile_rows = (enrich.get("mobile") or {}).get("rows") or []

    phones = []
    emails = []
    if c.get("tel"):
        phones.append(c["tel"])
    if c.get("emails"):
        emails.extend(str(c["emails"]).replace("；", ";").split(";"))
    for row in annual_rows:
        phones.append(row.get("Tel") or row.get("tel") or row.get("Telephone"))
        emails.append(row.get("Email") or row.get("email") or row.get("Mail"))

    contacts = []
    for row in mobile_rows:
        if not isinstance(row, dict):
            continue
        name = row.get("Name") or row.get("name") or row.get("ContactName") or row.get("PersonName") or row.get("person")
        title = row.get("Title") or row.get("Position") or row.get("Duty") or row.get("Department")
        mobile = row.get("Mobile") or row.get("mobile") or row.get("Phone") or row.get("Tel") or row.get("telephone")
        if name or mobile or title:
            contacts.append({"name": name or "未公开姓名", "title": title or "联系人", "mobile": mobile or ""})

    return {
        "phones": unique_values(phones),
        "emails": unique_values(emails),
        "contacts": contacts[:6],
    }


def extract_material_roles(c: dict) -> list[dict]:
    rows = ((c.get("enrich") or {}).get("hire") or {}).get("rows") or []
    keywords = ("采购", "物料", "仓储", "仓库", "供应链", "计划", "库存", "物流", "PMC", "跟单", "订单")
    matches = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        title = str(row.get("Position") or "")
        desc = str(row.get("PositionDescription") or "")
        blob = title + " " + desc
        if any(k in blob for k in keywords):
            matches.append(
                {
                    "position": title or "物料相关岗位",
                    "salary": row.get("Salary") or "",
                    "place": row.get("WorkingPlace") or "",
                    "date": str(row.get("PubDate") or "")[:10],
                    "desc": desc[:120],
                }
            )
        if len(matches) >= 4:
            break
    return matches


def build_payload(snapshot: dict) -> dict:
    companies = snapshot.get("companies", [])
    analysis = snapshot.get("analysis", {})
    origin = analysis.get("origin", {})
    query = snapshot.get("query", {})
    material = analysis.get("material_label") or query.get("material_label") or "铝"
    radius = analysis.get("radius_km") or origin.get("radius_km") or query.get("radius_km") or 300
    target = query.get("target") or f"{origin.get('name') or '检索锚点'} {radius}km {material}供应商"

    mapped = []
    for c in companies:
        ind2, ind3 = split_industry((c.get("role_evidence") or {}).get("industry"))
        risk_counts = c.get("risk_counts") or {}
        coverage = c.get("coverage") or {}
        score_parts = c.get("score_parts") or {}
        contact_bundle = extract_contact_bundle(c)
        mapped.append(
            {
                "n": c.get("name") or "",
                "sn": c.get("short_name") or "",
                "cc": c.get("credit_code") or "",
                "ec": c.get("enterprise_code") or "",
                "op": c.get("operator") or "",
                "ca": c.get("category") or "",
                "pv": c.get("province") or "",
                "ct": c.get("city") or "",
                "dist": c.get("distance_km"),
                "rc": c.get("registered_capital_wan"),
                "ac": c.get("paid_capital_wan"),
                "sd": c.get("start_date") or "",
                "ad": c.get("address") or c.get("reg_address") or "",
                "la": c.get("lat"),
                "lo": c.get("lng"),
                "tel": c.get("tel") or "",
                "em": c.get("emails") or "",
                "domain": c.get("domain") or "",
                "phones": contact_bundle["phones"],
                "emails": contact_bundle["emails"],
                "contacts": contact_bundle["contacts"],
                "material_roles": extract_material_roles(c),
                "wn": c.get("website_num") or 0,
                "ssn": c.get("social_security_num"),
                "ec_class": c.get("enterprise_class") or "",
                "ec_above": c.get("enterprise_above_class") or "",
                "ind2": ind2,
                "ind3": ind3,
                "mp": product_list(c.get("main_product")),
                "chain": product_list(c.get("industrial_chain")),
                "sc": c.get("scope") or "",
                "st": c.get("status") or "",
                "pk": c.get("park_name") or "",
                "rn": c.get("group_name") or "",
                "mig": c.get("main_income_growth_label"),
                "tax": c.get("tax_revenue_growth_rate"),
                "pat": c.get("patent_num") or 0,
                "tm": c.get("trademark_num") or 0,
                "cert": c.get("certificates_num") or 0,
                "recruit": c.get("recruit_num") or 0,
                "lst": c.get("listed_state") or "",
                "score": c.get("score"),
                "info_level": c.get("decision") or "",
                "risk_total": risk_total(risk_counts),
                "risk_counts": risk_counts,
                "coverage_summary": coverage_summary(coverage),
                "score_parts": score_parts,
                "classifications": c.get("classifications_ys") or {},
                "sections": build_detail_sections(c),
            }
        )

    return {
        "meta": {
            "generated_at": snapshot.get("analysis", {}).get("generated_at") or "",
            "origin": origin.get("name") or "芜湖永康检索锚点",
            "origin_note": origin.get("note") or "",
            "origin_lat": origin.get("lat") or 31.35246,
            "origin_lng": origin.get("lng") or 118.43313,
            "radius_km": radius,
            "material_label": material,
            "target": target,
            "title": f"{origin.get('name') or '供应商'} · {radius}km {material}供应商雷达",
            "brand": f"{origin.get('name') or '供应商'} · ",
            "accent": f"{material}供应商雷达",
            "total": len(mapped),
            "mills": sum(1 for c in mapped if c["ca"] == "M"),
            "agents": sum(1 for c in mapped if c["ca"] == "A"),
            "with_coord": sum(1 for c in mapped if c["la"] is not None and c["lo"] is not None),
            "with_email": sum(1 for c in mapped if c["em"]),
            "api_calls": snapshot.get("analysis", {}).get("api_calls", 0),
            "data_source": "喜啦企业数据平台 (api-dev.qiliance.com)",
        },
        "companies": mapped,
    }


def replace_payload(html: str, payload: dict) -> str:
    payload_text = "const PAYLOAD = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";"
    return re.sub(
        r"const PAYLOAD = .*?\n\n// === Globals ===",
        payload_text + "\n\n// === Globals ===",
        html,
        count=1,
        flags=re.S,
    )


def apply_text_changes(html: str, payload: dict) -> str:
    meta = payload["meta"]
    title = meta.get("title") or "供应商雷达"
    brand = meta.get("brand") or ""
    accent = meta.get("accent") or "供应商雷达"
    material = meta.get("material_label") or "铝"
    radius = meta.get("radius_km") or 300
    replacements = {
        "酷哇台州 · 500km 钢材供应商雷达": title,
        "酷哇 · <span class=\"accent\">钢材供应商雷达</span>": f"{brand}<span class=\"accent\">{accent}</span>",
        "原钢厂": "原厂/加工厂",
        "一级代理": "疑似一级代理",
        "如：宝钢 / 304 不锈钢 / Q345": f"如：{material}材 / {material}板 / {material}制品 / 关键词",
        "max=\"500\"": f"max=\"{radius}\"",
        f"value=\"500\" min=\"0\" max=\"{radius}\"": f"value=\"{radius}\" min=\"0\" max=\"{radius}\"",
        "value=\"1000\" min=\"0\"": "value=\"0\" min=\"0\"",
        "<label class=\"toggle-row\"><input type=\"checkbox\" id=\"only-coord\" checked /> 仅显示带定位</label>": "<label class=\"toggle-row\"><input type=\"checkbox\" id=\"only-coord\" /> 仅显示带定位</label>",
        "酷哇台州工厂": "芜湖永康锚点",
        "500km 半径圈": f"{radius}km 半径圈",
        "// 500km radius circle": "// 300km radius circle",
        "// Kuwa origin marker": "// Origin marker",
        "marker-origin\">酷哇</div>": "marker-origin\">芜湖</div>",
        "酷哇台州工厂 (": "' + PAYLOAD.meta.origin + ' (",
        "distMin: 0, distMax: 500,": f"distMin: 0, distMax: {radius},",
        "capMin: 1000, capMax: null,": "capMin: 0, capMax: null,",
        "onlyCoord: true, onlyEmail: false, onlyListed: false, onlyAbove: false,": "onlyCoord: false, onlyEmail: false, onlyListed: false, onlyAbove: false,",
        "代理": "代理",
        "kuwa_suppliers_": "wuhu_aluminum_suppliers_",
    }
    for old, new in replacements.items():
        html = html.replace(old, new)

    html = html.replace(
        """    <div class="demand-box">
      <div class="h">酷哇月/年需求 (来自备货表)</div>
      <div>钢板 SPCC ~<b>77</b> 吨/月 · Q345 ~<b>78</b> 吨/月 · 304 ~<b>76</b> 吨/月 · 管材 ~<b>14</b> 吨/月</div>
      <div class="small">年需求 ≈ <b style="color: var(--text)">2,929</b> 吨 · 5–6× 供应商规模目标 <b style="color: var(--text)">14,600–17,600</b> 吨/年</div>
    </div>""",
        """    <div class="demand-box">
      <div class="h">数据口径</div>
      <div>检索锚点 · <b>__RADIUS__km</b> 半径 · __MATERIAL__原厂/加工厂与疑似一级代理 · <b id="meta-total">0</b> 家</div>
      <div class="small">数据源：喜啦企业数据平台；补充展示工商、规模、产品、联系方式、资质、知识产权、风险、招投标、政策、年报等接口信息。</div>
    </div>""",
    )
    html = html.replace("__RADIUS__", str(radius)).replace("__MATERIAL__", material)

    return html


def inject_detail_fields(html: str) -> str:
    html = html.replace(
        "             + '<div class=\"tt-meta\" style=\"margin-top:4px\"><span>注册资本 ' + fmtCap(c.rc) + '</span><span>员工 ' + fmtSsn(c.ssn) + '</span></div>'\n"
        "             + (c.em ? '<div class=\"tt-meta\" style=\"margin-top:4px;color:var(--good)\">📧 ' + escapeHtml(c.em) + '</div>' : '');",
        "             + '<div class=\"tt-meta\" style=\"margin-top:4px\"><span>注册资本 ' + fmtCap(c.rc) + '</span><span>员工 ' + fmtSsn(c.ssn) + '</span><span>信息指数 ' + (c.score ?? '—') + '</span></div>'\n"
        "             + (c.em ? '<div class=\"tt-meta\" style=\"margin-top:4px;color:var(--good)\">邮箱 ' + escapeHtml(c.em) + '</div>' : '');",
    )
    html = html.replace(
        "      + '<span>📍 ' + (c.pv||'') + (c.ct||'') + ' ' + (c.dist != null ? c.dist+'km' : '') + '</span>'\n"
        "      + '<span>💰 ' + fmtCap(c.rc) + '</span>'\n"
        "      + '<span>👥 ' + fmtSsn(c.ssn) + '</span>'\n"
        "      + (c.em ? '<span style=\"color:var(--good)\">✉</span>' : '')",
        "      + '<span>位置 ' + (c.pv||'') + (c.ct||'') + ' ' + (c.dist != null ? c.dist+'km' : '') + '</span>'\n"
        "      + '<span>资本 ' + fmtCap(c.rc) + '</span>'\n"
        "      + '<span>人数 ' + fmtSsn(c.ssn) + '</span>'\n"
        "      + '<span>信息 ' + (c.score ?? '—') + '</span>'\n"
        "      + (c.risk_total ? '<span style=\"color:var(--bad)\">风险 ' + c.risk_total + '</span>' : '')\n"
        "      + (c.em ? '<span style=\"color:var(--good)\">邮箱</span>' : '')",
    )
    html = html.replace(
        "    +     kv('企业代码', c.ec || '—')\n"
        "    +     kv('成立日期', c.sd || '—')",
        "    +     kv('企业代码', c.ec || '—')\n"
        "    +     kv('信息完整度指数', c.score ?? '—')\n"
        "    +     kv('信息层级', c.info_level || '—')\n"
        "    +     kv('风险记录数', c.risk_total ?? 0)\n"
        "    +     kv('接口覆盖摘要', c.coverage_summary || '—')\n"
        "    +     kv('成立日期', c.sd || '—')",
    )
    html = html.replace(
        "    +     kv('专利数', c.pat || 0)\n"
        "    +     kv('地址', c.ad || '—')",
        "    +     kv('专利 / 商标 / 资质', (c.pat || 0) + ' / ' + (c.tm || 0) + ' / ' + (c.cert || 0))\n"
        "    +     kv('招聘记录', c.recruit || 0)\n"
        "    +     kv('营收增长 / 税收增长', (c.mig ?? '—') + ' / ' + (c.tax ?? '—'))\n"
        "    +     kv('地址', c.ad || '—')",
    )
    html = html.replace(
        "    +   (tagsHtml ? '<h3>主营产品</h3><div class=\"tag-row\">' + tagsHtml + '</div>' : '')\n"
        "    +   (c.sc ? '<h3>经营范围</h3><div class=\"scope-text\">' + escapeHtml(c.sc) + '</div>' : '')",
        "    +   (tagsHtml ? '<h3>主营产品</h3><div class=\"tag-row\">' + tagsHtml + '</div>' : '')\n"
        "    +   ((c.chain || []).length ? '<h3>产业链标签</h3><div class=\"tag-row\">' + c.chain.slice(0, 12).map(t => '<span class=\"tag\">' + escapeHtml(t) + '</span>').join('') + '</div>' : '')\n"
        "    +   (riskHtml(c) ? '<h3>风险记录</h3><div class=\"scope-text\">' + riskHtml(c) + '</div>' : '')\n"
        "    +   (scorePartHtml(c) ? '<h3>评分构成</h3><div class=\"scope-text\">' + scorePartHtml(c) + '</div>' : '')\n"
        "    +   (classifyHtml(c) ? '<h3>经营指标分类</h3><div class=\"scope-text\">' + classifyHtml(c) + '</div>' : '')\n"
        "    +   (c.sc ? '<h3>经营范围</h3><div class=\"scope-text\">' + escapeHtml(c.sc) + '</div>' : '')",
    )
    helper = """
function riskHtml(c) {
  const rows = Object.entries(c.risk_counts || {}).filter(([, v]) => Number(v || 0) > 0);
  return rows.map(([k, v]) => '<span class="tag" style="margin-right:6px">' + escapeHtml(k) + ': ' + v + '</span>').join('');
}
function scorePartHtml(c) {
  const rows = Object.entries(c.score_parts || {});
  return rows.map(([k, v]) => '<span class="tag" style="margin-right:6px">' + escapeHtml(k) + ': ' + v + '</span>').join('');
}
function classifyHtml(c) {
  const rows = Object.entries(c.classifications || {});
  return rows.map(([k, v]) => '<span class="tag" style="margin-right:6px">' + escapeHtml(k) + ': ' + escapeHtml(v) + '</span>').join('');
}
"""
    html = html.replace("function closeDetail() {", helper + "\nfunction closeDetail() {")
    html = html.replace(
        "document.getElementById('stat-mail').textContent = PAYLOAD.meta.with_email;",
        "document.getElementById('stat-mail').textContent = PAYLOAD.meta.with_email;\n"
        "document.getElementById('meta-total').textContent = PAYLOAD.meta.total;",
    )
    return html


def inject_procurement_ui(html: str) -> str:
    html = html.replace(
        "#app { display: grid; grid-template-columns: 360px 1fr; grid-template-rows: 60px 1fr; height: 100vh; }",
        "#app { display: grid; grid-template-columns: 320px minmax(360px, 1fr) 360px 0; grid-template-rows: 60px 1fr; height: 100vh; transition: grid-template-columns 0.18s ease; }",
    )
    html = html.replace(
        "aside .filter-area { padding: 16px; overflow-y: auto; border-bottom: 1px solid var(--line); }",
        "aside .filter-area { padding: 16px; overflow-y: auto; border-bottom: 1px solid var(--line); flex: 1; }",
    )
    html = html.replace(
        ".detail-modal {\n  background: var(--panel-solid); border: 1px solid var(--line); border-radius: 12px;\n  width: min(820px, 92vw); max-height: 86vh; overflow: hidden; display: flex; flex-direction: column;",
        ".detail-modal {\n  background: var(--panel-solid); border: 1px solid var(--line); border-radius: 12px;\n  width: min(1080px, 94vw); max-height: 88vh; overflow: hidden; display: flex; flex-direction: column;",
    )

    extra_css = """
.map-shell { position: relative; min-width: 0; }
#app.detail-open { grid-template-columns: 280px minmax(380px, 1fr) 320px minmax(440px, 460px); }
#app.detail-open .demand-box { display: none; }
.supplier-panel {
  background: var(--panel-solid); border-left: 1px solid var(--line);
  display: flex; flex-direction: column; min-height: 0;
}
.supplier-panel .list-meta {
  padding: 10px 12px; border-bottom: 1px solid var(--line);
  background: rgba(255,255,255,0.025);
}
.supplier-panel .list-area { padding: 10px; }
.supplier-panel .list-item {
  background: rgba(255,255,255,0.028); border-color: rgba(255,255,255,0.04);
}
.supplier-panel .list-item:hover { border-color: var(--accent); background: rgba(77,214,255,0.06); }
.supplier-panel .list-item.active { border-color: var(--accent); background: rgba(77,214,255,0.09); }
.supplier-panel .list-item .meta { flex-wrap: wrap; line-height: 1.55; }
.company-detail-panel {
  min-width: 0; min-height: 0; background: var(--panel-solid);
  border-left: 1px solid var(--line); display: none; flex-direction: column;
}
#app.detail-open .company-detail-panel { display: flex; }
.company-detail-panel .detail-modal {
  width: 100%; height: 100%; max-height: none; border: 0; border-radius: 0;
  box-shadow: none; background: transparent; position: relative;
}
.company-detail-panel .detail-modal:after {
  content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 44px;
  pointer-events: none; background: linear-gradient(180deg, rgba(11,17,32,0), var(--panel-solid));
}
.company-detail-panel .detail-head {
  position: sticky; top: 0; z-index: 2; background: var(--panel-solid);
  padding: 16px 18px;
}
.company-detail-panel .detail-head h2 { font-size: 16px; line-height: 1.35; padding-right: 26px; }
.company-detail-panel .detail-body { padding: 14px 18px 56px; }
.company-detail-panel .detail-body h3 { margin-top: 18px; }
.company-detail-panel .contact-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.company-detail-panel .risk-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.company-detail-panel .field-list { grid-template-columns: 1fr; }
.company-detail-panel .kv { grid-template-columns: 96px 1fr; }
.detail-placeholder {
  height: 100%; display: grid; align-content: center; gap: 10px; padding: 24px;
  color: var(--muted); font-size: 13px; border-left: 1px solid var(--line);
}
.detail-placeholder b { color: var(--text); font-size: 16px; }
.module-strip { display: flex; flex-wrap: nowrap; gap: 6px; overflow-x: auto; padding-bottom: 4px; }
.module-strip .tag { flex: 0 0 auto; }
.contact-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.contact-card {
  min-height: 82px; border: 1px solid var(--line); border-radius: 8px;
  padding: 12px; background: rgba(255,255,255,0.035);
}
.contact-card .label { font-size: 11px; color: var(--muted); margin-bottom: 6px; }
.contact-card .val { color: var(--text); font-size: 14px; line-height: 1.55; user-select: all; word-break: break-word; }
.contact-card.strong { border-color: rgba(77,214,255,0.45); background: linear-gradient(135deg, rgba(77,214,255,0.13), rgba(255,255,255,0.03)); }
.metric-row { display: grid; grid-template-columns: 120px 1fr 56px; gap: 10px; align-items: center; margin: 8px 0; font-size: 12px; }
.metric-track { height: 8px; border-radius: 999px; background: rgba(255,255,255,0.06); overflow: hidden; }
.metric-track i { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--accent), var(--origin)); }
.risk-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.risk-card { border: 1px solid var(--line); border-radius: 8px; padding: 10px; background: rgba(255,255,255,0.03); }
.risk-card b { display: block; font-size: 18px; color: var(--text); }
.risk-card span { color: var(--muted); font-size: 11px; }
.risk-card.hot { border-color: rgba(255,122,89,0.5); background: rgba(255,122,89,0.09); }
.data-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.data-table th, .data-table td { border-bottom: 1px solid rgba(255,255,255,0.08); padding: 8px 6px; text-align: left; vertical-align: top; }
.data-table th { color: var(--muted); font-weight: 600; }
.empty-note { color: var(--muted); font-size: 12px; padding: 10px 12px; border: 1px dashed var(--line); border-radius: 8px; background: rgba(255,255,255,0.025); }
.section-stack { display: grid; gap: 12px; }
.data-section { border: 1px solid var(--line); border-radius: 8px; background: rgba(255,255,255,0.025); overflow: hidden; }
.data-section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.07); }
.data-section-head b { color: var(--text); font-size: 13px; }
.data-section-head span { color: var(--muted); font-size: 11px; }
.data-section-body { padding: 10px 12px; }
.field-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 14px; font-size: 12px; }
.field-list .field { display: grid; grid-template-columns: 88px 1fr; gap: 6px; min-width: 0; }
.field-list .field .fk { color: var(--muted); }
.field-list .field .fv { color: var(--text); word-break: break-word; }
.record-card { border-top: 1px solid rgba(255,255,255,0.07); padding: 10px 0; }
.record-card:first-child { border-top: 0; padding-top: 0; }
.record-card:last-child { padding-bottom: 0; }
@media (max-width: 1180px) {
  #app, #app.detail-open { grid-template-columns: 320px minmax(0, 1fr); grid-template-rows: 60px minmax(0, 1fr) 300px 420px; }
  .supplier-panel { grid-column: 1 / -1; border-left: 0; border-top: 1px solid var(--line); }
  .supplier-panel .list-area { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; overflow-y: auto; }
  .company-detail-panel { grid-column: 1 / -1; border-left: 0; border-top: 1px solid var(--line); display: flex; }
  #app:not(.detail-open) .company-detail-panel { display: none; }
}
@media (max-width: 900px) {
  #app, #app.detail-open { grid-template-columns: 1fr; grid-template-rows: 60px auto 1fr auto auto; }
  .supplier-panel .list-area { display: block; max-height: 42vh; }
  .contact-grid, .risk-grid { grid-template-columns: 1fr; }
  .company-detail-panel .contact-grid, .company-detail-panel .risk-grid { grid-template-columns: 1fr; }
  .field-list { grid-template-columns: 1fr; }
  .metric-row { grid-template-columns: 96px 1fr 46px; }
}
"""
    html = html.replace("</style>", extra_css + "\n</style>", 1)

    html = html.replace(
        """    </div>

    <div class="list-meta">
      <span>共 <b id="list-count">0</b> 条</span>
      <select id="sort-by">
        <option value="dist">按距离</option>
        <option value="cap">按注册资本</option>
        <option value="ssn">按员工数</option>
        <option value="name">按名称</option>
      </select>
    </div>
    <div class="list-area" id="list"></div>
  </aside>

  <div style="position: relative;">""",
        """    </div>
  </aside>

  <div class="map-shell">""",
    )
    html = html.replace(
        """    </div>
  </div>
</div>

<div class="detail-overlay" id="detail-overlay">""",
        """    </div>
  </div>

  <section class="supplier-panel">
    <div class="list-meta">
      <span>筛选结果 <b id="list-count">0</b> 家</span>
      <select id="sort-by">
        <option value="dist">按距离</option>
        <option value="cap">按注册资本</option>
        <option value="ssn">按员工数</option>
        <option value="name">按名称</option>
      </select>
    </div>
    <div class="list-area" id="list"></div>
  </section>

  <section class="company-detail-panel" id="detail-overlay">
    <div class="detail-modal" id="detail-modal">
      <div class="detail-placeholder"><b>企业详情</b><span>从右侧列表或地图点选择一家企业。</span></div>
    </div>
  </section>
</div>
""",
        1,
    )
    html = html.replace(
        """<div class="detail-overlay" id="detail-overlay">
  <div class="detail-modal" id="detail-modal"></div>
</div>

""",
        "",
        1,
    )

    override_js = r"""
const RISK_LABELS = {
  oper_abnorm: '经营异常',
  punishment: '行政处罚',
  tax_arrears: '欠税',
  tax_abnormal: '税务非正常户',
  major_tax_illegal: '重大税收违法',
  illegal_info: '严重违法失信',
  simple_cancel: '简易注销',
  clear_info: '清算',
  equity_pledge: '股权出质',
  mortgage_info: '动产抵押'
};
function uniq(arr) {
  const out = [];
  (arr || []).forEach(v => {
    v = (v || '').toString().trim();
    if (v && !out.includes(v)) out.push(v);
  });
  return out;
}
function pct(v) {
  const n = Number(v || 0);
  return Math.max(0, Math.min(100, Math.round(n)));
}
function contactBlock(c) {
  const phones = uniq([...(c.phones || []), c.tel]).slice(0, 6);
  const emails = uniq([...(c.emails || []), c.em]).slice(0, 6);
  const contacts = c.contacts || [];
  const cards = [];
  cards.push('<div class="contact-card strong"><div class="label">电话</div><div class="val">' + (phones.length ? phones.map(x => '<span class="copy" onclick="copy(\'' + escapeAttr(x) + '\')">' + escapeHtml(x) + '</span>').join('<br>') : '未公开') + '</div></div>');
  cards.push('<div class="contact-card strong"><div class="label">邮箱</div><div class="val">' + (emails.length ? emails.map(x => '<span class="copy" onclick="copy(\'' + escapeAttr(x) + '\')">' + escapeHtml(x) + '</span>').join('<br>') : '未公开') + '</div></div>');
  cards.push('<div class="contact-card"><div class="label">网站 / 域名</div><div class="val">' + (c.domain ? escapeHtml(c.domain) : (c.wn ? '网站记录 ' + c.wn + ' 条' : '未公开')) + '</div></div>');
  if (contacts.length) {
    cards.push('<div class="contact-card"><div class="label">关键联系人</div><div class="val">' + contacts.map(p => escapeHtml((p.title || '联系人') + ' · ' + (p.name || '未公开姓名') + (p.mobile ? ' · ' + p.mobile : ''))).join('<br>') + '</div></div>');
  } else {
    cards.push('<div class="contact-card"><div class="label">关键联系人</div><div class="val">getMobile 未返回公开联系人</div></div>');
  }
  return '<div class="contact-grid">' + cards.join('') + '</div>';
}
function materialRolesHtml(c) {
  const roles = c.material_roles || [];
  if (!roles.length) return '<div class="empty-note">未发现采购、物料、仓储、计划、物流等岗位线索；不代表企业没有对应负责人，仅表示接口未公开。</div>';
  return '<table class="data-table"><thead><tr><th>岗位线索</th><th>地点</th><th>薪资</th><th>发布日期</th><th>职责片段</th></tr></thead><tbody>'
    + roles.map(r => '<tr><td>' + escapeHtml(r.position || '物料相关岗位') + '</td><td>' + escapeHtml(r.place || '—') + '</td><td>' + escapeHtml(r.salary || '—') + '</td><td>' + escapeHtml(r.date || '—') + '</td><td>' + escapeHtml(r.desc || '—') + '</td></tr>').join('')
    + '</tbody></table>';
}
function riskHtml(c) {
  const entries = Object.entries(c.risk_counts || {});
  if (!entries.length) return '<div class="empty-note">未进入深度风险补充批次，或接口未返回风险记录。</div>';
  return '<div class="risk-grid">' + entries.map(([k, v]) => {
    const n = Number(v || 0);
    return '<div class="risk-card ' + (n ? 'hot' : '') + '"><b>' + n + '</b><span>' + escapeHtml(RISK_LABELS[k] || k) + '</span></div>';
  }).join('') + '</div>';
}
function scorePartHtml(c) {
  const rows = Object.entries(c.score_parts || {});
  if (!rows.length) return '';
  return rows.map(([k, v]) => {
    const n = Number(v || 0);
    return '<div class="metric-row"><span>' + escapeHtml(k) + '</span><div class="metric-track"><i style="width:' + pct(Math.abs(n) * 5) + '%"></i></div><b>' + escapeHtml(v) + '</b></div>';
  }).join('');
}
function classifyHtml(c) {
  const rows = Object.entries(c.classifications || {});
  if (!rows.length) return '';
  return '<div class="tag-row">' + rows.map(([k, v]) => '<span class="tag">' + escapeHtml(k) + '：' + escapeHtml(v) + '</span>').join('') + '</div>';
}
function coverageHtml(c) {
  if (!c.coverage_summary) return '<div class="empty-note">未进入深度接口补充批次。</div>';
  return '<div class="tag-row">' + c.coverage_summary.split(' · ').map(x => '<span class="tag hl">' + escapeHtml(x) + '</span>').join('') + '</div>';
}
function valueWithLink(v) {
  const text = escapeHtml(v || '—');
  if (/^https?:\/\//.test(v || '')) return '<a href="' + escapeAttr(v) + '" target="_blank" rel="noopener" style="color:var(--accent)">' + text + '</a>';
  return text;
}
function rowFieldsHtml(row) {
  return '<div class="field-list">' + (row || []).map(cell => '<div class="field"><span class="fk">' + escapeHtml(cell.k) + '</span><span class="fv">' + valueWithLink(cell.v) + '</span></div>').join('') + '</div>';
}
function detailSectionsHtml(c) {
  const sections = c.sections || [];
  if (!sections.length) return '<div class="empty-note">没有补充接口明细。</div>';
  return '<div class="section-stack">' + sections.map(sec => {
    const rows = sec.rows || [];
    const body = rows.length
      ? rows.map(row => '<div class="record-card">' + rowFieldsHtml(row) + '</div>').join('')
      : '<div class="empty-note">当前接口返回 0 条明细。</div>';
    return '<section class="data-section"><div class="data-section-head"><b>' + escapeHtml(sec.label) + '</b><span>' + (sec.total ?? rows.length) + ' 条</span></div><div class="data-section-body">' + body + '</div></section>';
  }).join('') + '</div>';
}
function moduleOverviewHtml(c) {
  const sections = (c.sections || []).filter(sec => Number(sec.total || 0) > 0);
  if (!sections.length) return '<div class="empty-note">深度接口未返回可展示明细。</div>';
  return '<div class="module-strip">' + sections.map(sec => '<span class="tag hl">' + escapeHtml(sec.label) + ' ' + (sec.total ?? 0) + '</span>').join('') + '</div>';
}
function highlightActiveList() {
  document.querySelectorAll('.supplier-panel .list-item').forEach(el => {
    el.classList.toggle('active', Number(el.dataset.id) === state.active);
  });
}
function applyFilters() {
  cluster.clearLayers();
  markerById.clear();
  const filtered = COMPS.filter(passes);
  filtered.sort((a, b) => {
    switch (state.sortBy) {
      case 'cap': return (b.rc || 0) - (a.rc || 0);
      case 'ssn': return (b.ssn || 0) - (a.ssn || 0);
      case 'name': return (a.n || '').localeCompare(b.n || '', 'zh');
      default: return (a.dist || 0) - (b.dist || 0);
    }
  });
  filtered.forEach(c => {
    if (c.la == null || c.lo == null) return;
    const size = c.rc >= 100000 ? 22 : c.rc >= 10000 ? 18 : 14;
    const icon = L.divIcon({
      html: '<div class="marker-' + (c.ca === 'M' ? 'mill' : 'agent') + '" style="width:' + size + 'px;height:' + size + 'px;font-size:' + (size>=18?10:9) + 'px">' + (c.ca) + '</div>',
      className: '', iconSize: [size, size], iconAnchor: [size/2, size/2]
    });
    const m = L.marker([c.la, c.lo], { icon });
    const tt = '<div class="tt-name">' + escapeHtml(c.n) + '</div>'
      + '<div class="tt-meta"><span class="tt-badge ' + c.ca + '">' + (c.ca==='M'?'原厂':'代理') + '</span><span>' + (c.pv||'') + ' ' + (c.ct||'') + '</span><span>' + (c.dist||'?') + 'km</span></div>'
      + '<div class="tt-meta" style="margin-top:4px"><span>注册资本 ' + fmtCap(c.rc) + '</span><span>参保 ' + fmtSsn(c.ssn) + '</span><span>信息 ' + (c.score ?? '—') + '</span></div>'
      + ((c.phones || []).length || c.em ? '<div class="tt-meta" style="margin-top:4px;color:var(--good)">有公开联系方式</div>' : '');
    m.bindTooltip(tt, { direction: 'top', offset: [0, -8], opacity: 1 });
    m.on('click', () => openDetail(c));
    markerById.set(c._id, m);
    cluster.addLayer(m);
  });
  const list = document.getElementById('list');
  list.innerHTML = '';
  filtered.slice(0, 500).forEach(c => {
    const phones = uniq(c.phones || []);
    const el = document.createElement('div');
    el.className = 'list-item';
    el.dataset.id = c._id;
    if (state.active === c._id) el.classList.add('active');
    el.innerHTML = '<div class="title-row">'
      + '<span class="badge ' + c.ca + '">' + (c.ca==='M'?'原厂':'代理') + '</span>'
      + '<span class="name" title="' + escapeAttr(c.n) + '">' + escapeHtml(c.n) + '</span>'
      + '</div>'
      + '<div class="meta">'
      + '<span>' + (c.pv||'') + (c.ct||'') + ' · ' + (c.dist != null ? c.dist+'km' : '距离未知') + '</span>'
      + '<span>资本 ' + fmtCap(c.rc) + '</span>'
      + '<span>参保 ' + fmtSsn(c.ssn) + '</span>'
      + '<span>信息 ' + (c.score ?? '—') + '</span>'
      + (phones.length ? '<span style="color:var(--good)">电话</span>' : '')
      + (c.em ? '<span style="color:var(--good)">邮箱</span>' : '')
      + (c.risk_total ? '<span style="color:var(--bad)">风险 ' + c.risk_total + '</span>' : '')
      + '</div>';
    el.onclick = () => {
      openDetail(c);
      if (c.la != null) map.flyTo([c.la, c.lo], 13);
    };
    list.appendChild(el);
  });
  document.getElementById('stat-shown').textContent = filtered.length;
  document.getElementById('list-count').textContent = filtered.length;
}
function openDetail(c) {
  state.active = c._id;
  const app = document.getElementById('app');
  app.classList.add('detail-open');
  const demandBox = document.querySelector('.demand-box');
  if (demandBox) demandBox.style.display = 'none';
  highlightActiveList();
  const modal = document.getElementById('detail-modal');
  document.getElementById('detail-overlay').onclick = null;
  const tagsHtml = (c.mp || []).slice(0, 14).map(t => '<span class="tag hl">' + escapeHtml(t) + '</span>').join('');
  modal.innerHTML = ''
    + '<div class="detail-head">'
    +   '<button class="close" id="d-close">×</button>'
    +   '<h2>' + escapeHtml(c.n) + (c.sn?' <span style="color:var(--muted);font-size:13px">('+escapeHtml(c.sn)+')</span>':'') + '</h2>'
    +   '<div class="meta">'
    +     '<span class="badge ' + c.ca + '" style="padding:2px 8px;border-radius:4px;font-size:11px;background:'+(c.ca==='M'?'rgba(255,122,89,0.18)':'rgba(77,214,255,0.18)')+';color:'+(c.ca==='M'?'var(--mill)':'var(--agent)')+';">' + (c.ca==='M'?'原厂/加工厂':'疑似一级代理') + '</span>'
    +     '<span>' + (c.pv||'') + ' · ' + (c.ct||'') + ' · ' + (c.dist!=null?c.dist+' km':'距离未知') + '</span>'
    +     '<span>' + (c.st || '') + '</span>'
    +     '<span>信息指数 ' + (c.score ?? '—') + '</span>'
    +   '</div>'
    + '</div>'
    + '<div class="detail-body">'
    +   '<h3>联系方式与物料线索</h3>'
    +   contactBlock(c)
    +   '<h3>信息模块</h3>'
    +   moduleOverviewHtml(c)
    +   '<h3>物料 / 仓储 / 计划相关岗位线索</h3>'
    +   materialRolesHtml(c)
    +   '<h3>基本信息</h3>'
    +   '<div class="kv">'
    +     kv('法定代表人', c.op)
    +     kv('注册资本', fmtCap(c.rc) + (c.ac ? ' (实缴 ' + fmtCap(c.ac) + ')' : ''))
    +     kv('参保人数', fmtSsn(c.ssn))
    +     kv('统一信用代码', '<span class="copy" onclick="copy(\''+c.cc+'\')">' + (c.cc || '—') + '</span>')
    +     kv('企业代码', c.ec || '—')
    +     kv('成立日期', c.sd || '—')
    +     kv('规模', (c.ec_class||'—') + ' / ' + (c.ec_above||''))
    +     kv('所属行业', (c.ind2||'') + ' · ' + (c.ind3||''))
    +     kv('园区 / 集团', (c.pk || '—') + ' / ' + (c.rn || '—'))
    +     kv('专利 / 商标 / 资质', (c.pat || 0) + ' / ' + (c.tm || 0) + ' / ' + (c.cert || 0))
    +     kv('招聘记录', c.recruit || 0)
    +     kv('营收增长 / 税收增长', (c.mig ?? '—') + ' / ' + (c.tax ?? '—'))
    +     kv('地址', c.ad || '—')
    +   '</div>'
    +   (tagsHtml ? '<h3>主营产品</h3><div class="tag-row">' + tagsHtml + '</div>' : '')
    +   ((c.chain || []).length ? '<h3>产业链标签</h3><div class="tag-row">' + c.chain.slice(0, 12).map(t => '<span class="tag">' + escapeHtml(t) + '</span>').join('') + '</div>' : '')
    +   '<h3>风险记录</h3>' + riskHtml(c)
    +   '<h3>评分构成</h3><div class="scope-text">' + scorePartHtml(c) + '</div>'
    +   (classifyHtml(c) ? '<h3>经营指标分类</h3>' + classifyHtml(c) : '')
    +   '<h3>接口覆盖</h3>' + coverageHtml(c)
    +   '<h3>全部接口明细</h3>' + detailSectionsHtml(c)
    +   (c.sc ? '<h3>经营范围</h3><div class="scope-text">' + escapeHtml(c.sc) + '</div>' : '')
    + '</div>';
  document.getElementById('detail-overlay').classList.add('open');
  document.getElementById('d-close').onclick = closeDetail;
  const body = modal.querySelector('.detail-body');
  if (body) body.scrollTop = 0;
  setTimeout(() => map.invalidateSize(), 120);
}
function closeDetail() {
  document.getElementById('app').classList.remove('detail-open');
  document.getElementById('detail-overlay').classList.remove('open');
  const demandBox = document.querySelector('.demand-box');
  if (demandBox) demandBox.style.display = '';
  state.active = null;
  highlightActiveList();
  setTimeout(() => map.invalidateSize(), 120);
}
"""
    html = html.replace("// === Wire filters ===", override_js + "\n// === Wire filters ===", 1)
    return html


def main() -> None:
    snapshot = json.loads(DATA_JSON.read_text(encoding="utf-8"))
    render_snapshot(snapshot, OUTPUT_HTML)


def render_snapshot(snapshot: dict, output_html: Path = OUTPUT_HTML, reference_html: Path = REFERENCE_HTML) -> None:
    payload = build_payload(snapshot)
    html = reference_html.read_text(encoding="utf-8")
    html = replace_payload(html, payload)
    html = apply_text_changes(html, payload)
    html = inject_detail_fields(html)
    html = inject_procurement_ui(html)
    output_html.parent.mkdir(parents=True, exist_ok=True)
    output_html.write_text(html, encoding="utf-8")
    print(f"rendered {output_html} with {len(payload['companies'])} companies")


if __name__ == "__main__":
    main()
