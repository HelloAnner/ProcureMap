<claude-mem-context>
# Memory Context

# [ProcureMap] recent context, 2026-06-11 4:26pm GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (16,900t read) | 191,170t work | 91% savings

### May 22, 2026
6085 3:09p 🔵 ProcureMap Backend .env Bootstrapped with Service Credentials
6086 " 🔵 Backend Python Dependencies Resolved via uv sync
6088 3:10p 🔵 Backend Running Successfully on localhost:8000
6089 " 🔵 Origin Search and Default Endpoints Verified Working in Production
6090 " 🔵 Company Search with Lat/Lng Origin Works but Geo Resolution Failing on Test Query
6091 " 🔵 Qila getCompanyList Returns Irrelevant Result for 不锈钢 Keyword
6092 3:11p 🔵 Qila getCompanyList Designed for Company Name Lookup, Not Material Keyword Search
6093 " 🔵 Qila getCompanyList name Parameter Is Company Name Filter, Not Full-Text Search
6094 3:12p 🔵 Confirmed: name= Param Returns Relevant Stainless Steel Suppliers from Qila
6095 " 🔵 Qila Row Schema: credit_code May Be Numeric ID, Not 18-Digit USCC
6096 " 🔵 Qila getCompanyDetail Schema Confirmed: main_product is Array, industry_name_1/2 Available
6097 " 🔴 qila.py get_company_list Fixed: Wrong API Params Replaced with Correct name/index/limit
6098 3:13p 🟣 Geo City Lookup Table Expanded from ~50 to ~140 Cities
6099 3:14p 🔵 End-to-End Search Now Working: 14 Stainless Steel Suppliers Found with Correct Distances
6151 4:41p 🔵 ProcureMap SQLite Database Current State
6152 4:42p 🟣 Bulk Contact Refresh Background Task Launched
6153 " 🟣 New Script: scripts/refresh_contacts.py — Bulk Contact Refresher
6154 " ✅ Bulk Contact Refresh Process Launched in Background
6155 4:43p 🔵 TinyFish Rate Limit Throttling Bulk Refresh — 30 req/min Free Tier Cap
6156 " ✅ Bulk Refresh Process Killed Due to TinyFish Rate Limiting
6157 " 🔴 TinyFish Rate Limiter Added to web_search.py
6158 4:44p 🔴 Rate Limiter Wired into web_search.query() Call Path
6159 " ✅ Bulk Contact Refresh Relaunched with Rate Limiter Active
6160 4:45p ✅ Monitor Task Set Up to Track Bulk Refresh Completion
6161 4:47p 🔵 Refresh Log File Empty — Process May Have Crashed on Startup
6162 " 🔵 Refresh Process Running Fine — Empty Log Caused by Python stdout Buffering
6163 " 🔴 Refresh Script Relaunched with Unbuffered Python Output
6164 4:48p ✅ New Monitor Task bpwp4u05n Launched for Unbuffered Refresh Run
S672 Bulk refresh all 320 companies' contact data in ProcureMap SQLite DB — steady progress at 28/203 companies, ETA 12 minutes (May 22 at 4:49 PM)
S673 Bulk refresh all 320 companies' contact data in ProcureMap SQLite DB — at 48/203 processed, DB rows growing, ETA 11 minutes (May 22 at 4:49 PM)
S674 Bulk refresh all 320 companies' contact data in ProcureMap SQLite DB — at 68/203 (33%), 66 rows with data, ETA ~9.6 minutes (May 22 at 4:51 PM)
S675 Bulk refresh all 320 companies' contact data in ProcureMap SQLite DB — accelerating at 90/203 (44%), 97 total rows, ETA 8 minutes (May 22 at 4:52 PM)
S676 Bulk refresh all 320 companies' contact data in ProcureMap SQLite DB — past halfway at 112/203 (55%), 106 rows with data, ETA 6.5 minutes (May 22 at 4:54 PM)
S677 Bulk refresh all 320 companies' contact data in ProcureMap SQLite DB — at 132/203 (65%), 135 total rows, ETA 5 minutes (May 22 at 4:55 PM)
S678 Bulk refresh all 320 companies' contact data in ProcureMap SQLite DB — at 153/203 (75%), 133 rows with data, ETA 3.5 minutes (May 22 at 4:57 PM)
S679 Bulk refresh all 320 companies' contact data in ProcureMap SQLite DB — nearly done at 174/203 (86%), 153 rows with data, ETA 2 minutes (May 22 at 4:58 PM)
S681 Implement full authentication system for ProcureMap supplier intelligence tool — password-based auth with JWT, SQLite token storage, login page UI, and coverage of both main app and share pages (May 22 at 5:00 PM)
6165 5:11p 🔵 ProcureMap Project Structure Discovery
6166 " 🔵 ProcureMap Frontend and Backend Source File Inventory
6167 " 🔵 ProcureMap Core Architecture Before Auth — Key Integration Points
6168 5:12p 🔵 Design System CSS Tokens and Auth Page Styling Reference
6169 " 🔵 Confirmed Zero Authentication Code in Entire Codebase
6170 5:13p 🔵 Critical Constraint: No Frontend Router Library Installed
6171 5:14p ⚖️ Auth Implementation Plan: 2-Task Backend Decomposition
6172 " ⚖️ Auth API Surface: Login, Verify, and Logout Endpoints Planned
6173 " ⚖️ Full Auth Implementation Plan: 6 Tasks Covering Backend and Frontend
6174 " ⚖️ AuthPage Design Requirements: System Intro + Password Auth Matching Existing Design System
6175 5:17p 🟣 Auth Credentials Added to .env
6176 " 🟣 Auth Settings Fields Added to config.py Settings Class
6177 " 🟣 PyJWT Added to Backend Dependencies
6178 5:18p 🟣 tokens Table Added to SQLite Schema in db.py
6179 " 🟣 Token DB Functions Implemented in db.py
6180 " 🟣 backend/app/auth.py Created — JWT Auth Dependency Module
6181 5:19p 🟣 Auth API Router Created at backend/app/api/auth.py
6182 " 🟣 All API Routers Protected with JWT Auth via Router-Level Dependencies
6183 " 🟣 PyJWT 2.13.0 Installed Successfully via uv sync
6184 " 🟣 AuthContext.tsx Created — Frontend Auth State Management
6185 5:20p 🟣 api.ts Updated to Inject Authorization Header on All API Requests
6192 5:21p 🟣 AuthPage.tsx Created — Branded Login Page with System Introduction
S682 Remove vendor name "Qila" from all frontend code and API response field names — coordinated rename across backend services and frontend types/components (May 22 at 5:31 PM)
**Investigated**: - Ran grep across all frontend .tsx/.ts/.css/.html files to find every Qila occurrence
    - Read backend companies.py, services/qila.py, services/contacts.py, services/enrich.py, api/export.py, models.py, api/origin.py to map all API response fields containing "qila"
    - Used a sub-agent to produce a definitive table of which JSON response fields contained "qila" strings and exactly which backend lines produced them
    - Determined which occurrences were API-contract-bound (requiring coordinated backend+frontend changes) vs pure copy/comment (safe to change independently)
    - Confirmed that qila_json SQLite column and internal variable names like qila_basic are backend-internal only and never serialized to API responses

**Learned**: - Three categories of "qila" in API responses: (1) enrichment_source values "qila"/"qila+web" from enrich.py, (2) contacts sources[].kind: "qila" from contacts.py, (3) contacts response key "qila_only" from contacts.py
    - All three required coordinated rename: backend service layer changed simultaneously with frontend type definitions and string comparisons
    - The SQLite column qila_json and internal variable names (qila_basic, qila_detail) are backend-internal DB/code identifiers — safely left unchanged as they never appear in JSON responses
    - The vendor name in Chinese is "喜啦" (Xila) — config uses both "xila" and "qila" spellings inconsistently in backend; only the JSON-serialized strings mattered for the rename
    - Frontend display labels "工商"/"网络" were already abstract — only the discriminator string values needed changing, not the user-visible text
    - Chosen replacement term "registry" (工商登记 = business registry) is semantically appropriate and already aligned with existing UI text

**Completed**: - Created `/Users/anner/ProcureMap/CLAUDE.md` (new project-level rules file) documenting: frontend Qila prohibition, auth system architecture
    - **Backend `services/contacts.py`**: `"qila_only"` → `"registry_only"` (×2 return sites); `"kind": "qila"` → `"kind": "registry"` (×3 source attribution sites)
    - **Backend `services/enrich.py`**: `"source": "qila"` → `"source": "registry"`; `"source": "qila+web"` → `"source": "registry+web"`
    - **Frontend `AuthPage.tsx`**: `"Qila 企业数据 + AI 语义匹配"` → `"工商数据 + AI 语义匹配"` (only user-visible Qila text that was pure copy)
    - **Frontend `types.ts`**: `ContactSource.kind: "qila" | "web"` → `"registry" | "web"`; `ContactsResponse.qila_only` → `registry_only`; comment `// Qila basics` → `// Registry basics`
    - **Frontend `CompanyDrawer.tsx`**: `enrichment_source === "qila+web"` → `"registry+web"`; `data?.qila_only` → `data?.registry_only`; `s.kind === "qila"` → `s.kind === "registry"` (×3); JSX comment updated
    - Final verification grep: frontend src has zero Qila occurrences; remaining backend occurrences are all internal DB/variable identifiers (allowed per CLAUDE.md)
    - TypeScript compilation passes clean after all renames

**Next Steps**: - Rename work is fully complete and verified. The primary session has no stated pending tasks from this workstream.
    - The session may next move to git commit preparation — the primary session read CLAUDE.md earlier which documents the no-auto-commit rule, suggesting the user will be asked to confirm before committing the auth system + Qila rename changes together.
    - Possible follow-up: update `.env.example` to document AUTH_PASSWORD, JWT_SECRET, JWT_EXPIRY_DAYS fields (noted as optional earlier but not yet done)


Access 191k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>