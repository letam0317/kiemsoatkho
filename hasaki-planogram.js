/**
 * ============================================================================
 *  hasaki-planogram.js — MODULE "PLANOGRAM" (vệ sinh quầy kệ & không gian làm việc)
 * ============================================================================
 *  Theo dõi VỆ SINH của kho SHOP - 170 QUOC LO 1A theo nguồn planogram
 *  (request-of-declaration). Bố cục THEO HÀNH ĐỘNG (25/07/2026):
 *   1. "Vệ sinh hôm nay" — 4 thẻ: Tổng yêu cầu / Đã vệ sinh / Chưa vệ sinh (phụ
 *      trách CÓ chấm công — cần nhắc) / Không có ca làm việc (phụ trách nghỉ hoặc
 *      chưa có người nhận). Bấm thẻ → pop-up từng yêu cầu: trạng thái thật, người
 *      làm + giờ, ẢNH BÁO CÁO (hotlink công khai, lightbox), link mở planogram.
 *   2. "Theo khu vực" (độ phủ phụ trách) + panel "Phụ trách vị trí" THU GỌN:
 *      chỉ còn dòng chỉ số + nút "Tra cứu theo nhân viên" → pop-up xem 1 NV làm
 *      việc Ở ĐÂU THEO NGÀY (F0-A8 đổi theo ngày, F0-A1 theo tuần) — tham khảo.
 *   3. "Đối chiếu chấm công hôm nay" (giữ nguyên) — bấm 1 dòng NV mở nhật ký NV đó.
 *
 *  Dữ liệu: 4 tab Sheet 5S do sync-vesinh-all.js ghi (cụm 8h40 / nút Cập nhật ngay):
 *   PHU-TRACH-QUAY-KE · CHAMCONG-VESINH · VESINH-YEUCAU (yêu cầu hôm nay + ảnh)
 *   · VESINH-NHATKY (NV × ngày × khu vực, 45 ngày).
 *
 *  Đồng bộ thiết kế TUYỆT ĐỐI với các tab khác (khuôn hasaki-tonbatthuong.js):
 *   - Closure kín, CHỈ lộ window.HPLANOGRAM; DOM/CSS tiền tố hp-.
 *   - Màu qua CSS variables portal (--panel/--text/--muted/--line/--accent) — ăn 7 theme.
 *   - Thẻ chỉ số bấm được, pop-up combo chain-filter, animation/độ mượt giữ nguyên.
 *   - Ảnh mở bằng LIGHTBOX CAROUSEL sẵn có của host (openLB) — không chế thêm.
 *
 *  LAZY: host chỉ inject khi người dùng đứng ở HASAKI ▸ Planogram.
 *  API: HPLANOGRAM.init(paneEl) — idempotent; gọi lại chỉ refresh nếu dữ liệu cũ >5'.
 * ============================================================================
 */
(function(){
"use strict";
if (window.HPLANOGRAM) return;

/* ===== CẤU HÌNH ===== */
var SHEET_ID = "1FWffWi75aATbokfqIcqjByEPzkJLQBngTXp5aPOIbLM";   // Sheet 5S (kiemsoatkho)
var SHEET_URL = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/edit";
var TAB = "PHU-TRACH-QUAY-KE";
var TAB_CC = "CHAMCONG-VESINH";     // đối chiếu chấm công × vệ sinh hôm nay
var TAB_YC = "VESINH-YEUCAU";       // từng yêu cầu vệ sinh hôm nay (trạng thái + ảnh)
var TAB_NK = "VESINH-NHATKY";       // nhật ký NV × ngày × khu vực (45 ngày)
var TAB_AI = "VESINH-AI";           // AI xét duyệt ảnh (sync-vesinh-ai.mjs — Claude chấm từng yêu cầu)
var APPSCRIPT_URL = "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
var PG_BASE = "https://planogram.hasaki.vn/asset-management/request-of-declaration";
var STALE_MS = 5 * 60 * 1000;
var CAP = 500;

/* Khu vực -> nhóm vệ sinh (đồng bộ purpose_type planogram: F0-A1 = quầy kệ, F0-A8 = không gian làm việc) */
var AREAS = [
  { k: "A1", lb: "Vệ sinh tủ quầy kệ",         short: "Quầy kệ (F0-A1)",           c: "#2563eb", re: /^F0-A1/i },
  { k: "A8", lb: "Vệ sinh không gian làm việc", short: "Không gian làm việc (F0-A8)", c: "#0891b2", re: /^F0-A8/i }
];
var ST = {
  done:    { k: "done",    lb: "Đã có người phụ trách", c: "#059669" },
  pending: { k: "pending", lb: "Chưa báo cáo",          c: "#9ca3af" }
};
/* Nhóm HÀNH ĐỘNG của 1 yêu cầu vệ sinh hôm nay */
var YCST = [
  { k: "da",    lb: "Đã vệ sinh",                 sub: "báo cáo hoàn tất",                 c: "#059669" },
  { k: "nhac",  lb: "Chưa vệ sinh",               sub: "phụ trách CÓ chấm công — cần nhắc", c: "#dc2626" },
  { k: "khong", lb: "Không có ca làm việc",        sub: "phụ trách nghỉ / chưa có người nhận", c: "#9ca3af" }
];
function ycMeta(k){ for (var i = 0; i < YCST.length; i++) if (YCST[i].k === k) return YCST[i]; return { k: k, lb: k, sub: "", c: "#6b7280" }; }
function ycBucket(r){
  if (r.stId === 3 || r.stId === 4 || /approve/i.test(r.st)) return "da";
  if (r.pt && r.ptDiLam) return "nhac";
  return "khong";
}
/* Badge trạng thái HỆ THỐNG planogram của 1 yêu cầu */
function stBadge(r){
  var lb = r.st || "—", c = "#6b7280";
  if (r.stId === 1 || /new/i.test(r.st)){ lb = "Chưa vệ sinh"; c = "#dc2626"; }
  else if (/waiting/i.test(r.st) || r.stId === 3){ lb = "Chờ duyệt"; c = "#0891b2"; }
  else if (/approved/i.test(r.st) || r.stId === 4){ lb = "Đã duyệt"; c = "#059669"; }
  else if (/reject/i.test(r.st)){ lb = "Bị từ chối"; c = "#ef4444"; }
  else if (/cancel/i.test(r.st)){ lb = "Huỷ"; c = "#6b7280"; }
  return '<span class="badge" title="' + esc(r.st || "") + '" style="background:color-mix(in srgb,' + c + ' 15%,transparent);color:' + c + '">' + esc(lb) + '</span>';
}
var PAL = ["#f59e0b", "#8b5cf6", "#ef4444", "#10b981", "#ec4899", "#6366f1", "#0891b2", "#84cc16", "#2563eb", "#d97706"];
/* Nhận diện cột theo NHÃN header (chấp nhận tiếng Anh/Việt/snake_case) */
var COLS = {
  loc:   ["location", "mã vị trí", "ma vi tri", "vị trí", "vi tri"],
  email: ["executed by", "executed_by", "email", "mail", "mail hasaki", "mail hsk"],
  code:  ["code", "mã nv", "ma nv", "mã nhân viên", "id nhân viên", "id nhan vien"],
  name:  ["name", "tên", "ten", "tên nhân viên", "ten nhan vien", "họ tên", "ho ten"]
};
/* Cột tab CHAMCONG-VESINH */
var COLS_CC = {
  code:  ["code", "mã nv", "ma nv"],
  name:  ["name", "tên", "ten", "họ tên"],
  email: ["email", "mail", "mail hasaki"],
  major: ["major", "nghiệp vụ", "nghiep vu"],
  ci:    ["giờ vào", "gio vao", "check in", "check_in"],
  co:    ["giờ ra", "gio ra", "check out", "check_out"],
  vs:    ["đã vệ sinh hôm nay", "da ve sinh hom nay", "đã vệ sinh", "da ve sinh"],
  loc:   ["vị trí gần nhất", "vi tri gan nhat", "vị trí", "location"],
  tt:    ["trạng thái", "trang thai", "status"]
};
/* Cột tab VESINH-YEUCAU */
var COLS_YC = {
  id:     ["request id", "request_id", "id"],
  ngay:   ["ngày", "ngay", "date"],
  loc:    ["location", "vị trí", "vi tri"],
  stid:   ["status id", "status_id"],
  st:     ["trạng thái", "trang thai", "status"],
  email:  ["executed by", "executed_by"],
  at:     ["executed at", "executed_at"],
  pt:     ["phụ trách", "phu trach"],
  ptcode: ["pt code"],
  ptname: ["pt name"],
  ptdilam:["pt đi làm", "pt di lam"],
  ptci:   ["pt giờ vào", "pt gio vao"],
  anh:    ["ảnh", "anh", "images"]
};
/* Cột tab VESINH-AI + nhãn kết luận AI */
var COLS_AI = {
  id:     ["request id", "request_id", "id"],
  kl:     ["kết luận", "ket luan", "verdict"],
  diem:   ["điểm", "diem", "score"],
  tincay: ["tin cậy", "tin cay", "confidence"],
  lydo:   ["lý do", "ly do", "reason"],
  anhloi: ["ảnh lỗi", "anh loi"]
};
var AIST = [
  { k: "DAT",       lb: "AI: Đạt",       c: "#059669" },
  { k: "KHONG_DAT", lb: "AI: Không đạt", c: "#dc2626" },
  { k: "CAN_XEM",   lb: "AI: Cần xem",   c: "#d97706" }
];
function aiMeta(k){ for (var i = 0; i < AIST.length; i++) if (AIST[i].k === k) return AIST[i]; return null; }
/* Cột tab VESINH-NHATKY */
var COLS_NK = {
  ngay:  ["ngày", "ngay", "date"],
  email: ["email", "mail"],
  code:  ["code", "mã nv", "ma nv"],
  name:  ["name", "tên", "ten"],
  khu:   ["khu vực", "khu vuc", "area"],
  locs:  ["vị trí", "vi tri", "locations"]
};
/* Nhóm trạng thái chấm công (màu + nhãn) */
var CCST = [
  { k: "chua", lb: "Đi làm - chưa vệ sinh", short: "Chưa vệ sinh", c: "#dc2626" },
  { k: "da",   lb: "Đi làm - đã vệ sinh",   short: "Đã vệ sinh",   c: "#059669" },
  { k: "nghi", lb: "Nghỉ / không chấm công", short: "Nghỉ",        c: "#9ca3af" }
];
function ccBucket(tt){ tt = String(tt || "").toLowerCase();
  if (/nghỉ|nghi|không chấm|khong cham/.test(tt)) return "nghi";
  if (/chưa|chua/.test(tt)) return "chua";
  if (/đã|da/.test(tt)) return "da";
  return "nghi";
}
function ccMeta(k){ for (var i = 0; i < CCST.length; i++) if (CCST[i].k === k) return CCST[i]; return { k: k, lb: k, short: k, c: "#6b7280" }; }
/* Google Sheet tự nhận "07:52" thành kiểu GIỜ → gviz trả "Date(1899,11,30,7,52,0)". Chuẩn hoá về HH:MM. */
function fmtHM(v){ v = String(v == null ? "" : v).trim();
  var m = v.match(/^Date\(\d+,\d+,\d+,(\d+),(\d+)/); if (!m) return v;
  var h = Number(m[1]), mi = Number(m[2]); return (h < 10 ? "0" : "") + h + ":" + (mi < 10 ? "0" : "") + mi; }
function p2(n){ return (n < 10 ? "0" : "") + n; }
/* Chuẩn hoá ô NGÀY về ISO yyyy-mm-dd (Sheet có thể trả Date(...) / ISO / dd/mm/yyyy) */
function fmtNgay(v){ v = String(v == null ? "" : v).trim();
  var m = v.match(/^Date\((\d+),(\d+),(\d+)/); if (m) return m[1] + "-" + p2(+m[2] + 1) + "-" + p2(+m[3]);
  m = v.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[1] + "-" + m[2] + "-" + m[3];
  m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return m[3] + "-" + p2(+m[2]) + "-" + p2(+m[1]);
  return v; }
/* Chuẩn hoá ô NGÀY+GIỜ (Executed At) — gviz có thể trả "Date(2026,6,25,6,1,41)" */
function fmtNgayGio(v){ v = String(v == null ? "" : v).trim();
  var m = v.match(/^Date\((\d+),(\d+),(\d+),(\d+),(\d+)/);
  if (m) return m[1] + "-" + p2(+m[2] + 1) + "-" + p2(+m[3]) + " " + p2(+m[4]) + ":" + p2(+m[5]);
  return v; }
function isoToday(){ var d = new Date(); return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); }
function ngayVN(iso){ var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + "/" + m[2] : iso; }
function thuVN(iso){ var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return "";
  var d = new Date(+m[1], +m[2] - 1, +m[3]).getDay(); return d === 0 ? "CN" : "T" + (d + 1); }
/* Link planogram */
function pgDetailUrl(id){ return PG_BASE + "/details/" + id; }
function pgListUrl(isoNgay, areaK, stIds){
  var m = String(isoNgay || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  var d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date();
  var f = d.getTime(), t = f + 86399999;
  var u = PG_BASE + "/list?company_ids=1001&warehouse_ids=863&keyword_type=sku_or_barcode&page=1&size=100&from_date=" + f + "&to_date=" + t;
  if (areaK) u += "&location_description=F0-" + areaK;
  if (stIds) u += "&status_ids=" + stIds;
  return u;
}

/* ===== STATE ===== */
var S = { ok: false, all: [], area: "", lastAt: 0, tsData: 0,
  cc: { ok: false, rows: [], ts: 0 }, ccStatus: "", ccQ: "",
  yc: { ok: false, rows: [], ts: 0, ngay: "" },
  nk: { ok: false, rows: [], ts: 0 },
  ai: { ok: false, by: {}, ts: 0 } };
var MODAL = { base: [], preset: null, mode: "loc" };
var NK = { email: "", q: "" };
var PANE = null, _nmColor = {}, _nmCi = 0, _deb = null, _debT = null, _ccDeb = null, _nkDeb = null;
var _emNm = {};   // email(lower) -> { code, name } (gom từ PT + NK để hiện tên người thực hiện)

var $id = function(s){ return document.getElementById(s); };
function nf(x){ return (x || 0).toLocaleString("en-US"); }
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function fmtTime(ms){ var d = new Date(ms); function p(n){ return (n < 10 ? "0" : "") + n; }
  return p(d.getHours()) + ":" + p(d.getMinutes()) + " " + p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear(); }
function idxOf(H, aliases){ for (var i = 0; i < aliases.length; i++){ var j = H.indexOf(aliases[i]); if (j >= 0) return j; } return -1; }
function areaOf(loc){ for (var i = 0; i < AREAS.length; i++) if (AREAS[i].re.test(loc)) return AREAS[i]; return null; }
function areaMeta(k){ for (var i = 0; i < AREAS.length; i++) if (AREAS[i].k === k) return AREAS[i]; return { k: k, lb: k, short: k, c: "#6b7280" }; }
function nmColor(n){ if (!_nmColor[n]) _nmColor[n] = PAL[_nmCi++ % PAL.length]; return _nmColor[n]; }
function pct(a, b){ return b ? Math.round(a / b * 100) : 0; }
function ghiNhoNm(email, code, name){ var k = String(email || "").toLowerCase(); if (!k) return;
  var o = _emNm[k] || (_emNm[k] = { code: "", name: "" }); if (code && !o.code) o.code = code; if (name && !o.name) o.name = name; }
function tenNm(email){ var o = _emNm[String(email || "").toLowerCase()]; return (o && o.name) ? o.name : ""; }

/* ===== CSS — bơm 1 lần, neo #pane-planogram / .hp-modal (khuôn ht-*) ===== */
var CSS = [
"#pane-planogram .hp-srcbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:14px 0 10px;font-size:12.5px;}",
/* nguồn/mô tả/Làm mới ĐƯA XUỐNG CHÂN tab — đồng bộ với footer .foot của các tab native (ghi chú ở dưới) */
"#pane-planogram .hp-srcfoot{margin-top:22px;padding-top:14px;border-top:1px solid var(--border,#e8ecf1);text-align:center;}",
"#pane-planogram .hp-srcfoot .hp-srcbar{margin:0 0 6px;justify-content:center;font-size:12px;}",
"#pane-planogram .hp-srcfoot .hp-hint{display:inline;}",
"#pane-planogram .hp-chip{background:color-mix(in srgb, var(--accent,#2563eb) 14%, transparent);color:var(--accent,#1e40af);border-radius:999px;padding:4px 13px;font-weight:650;font-size:12px;}",
"#pane-planogram .hp-srcbar a,#pane-planogram .hp-ext,.hp-modal .hp-ext{color:var(--accent,#2563eb);text-decoration:none;font-weight:600;}",
"#pane-planogram .hp-srcbar a:hover,#pane-planogram .hp-ext:hover,.hp-modal .hp-ext:hover{text-decoration:underline;}",
"#pane-planogram .hp-hint{color:var(--muted,#9ca3af);font-size:11.5px;font-weight:400;}",
"#hpReload,#pane-planogram .hp-btn{background:var(--accent,#1f2937);color:var(--accent-text,#fff);border:0;border-radius:9px;padding:8px 15px;font-size:12.5px;font-weight:650;cursor:pointer;min-height:36px;transition:transform .16s cubic-bezier(.32,.72,0,1),box-shadow .25s ease;}",
"#pane-planogram .hp-btn:hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(16,24,40,.16);}",
"#hpReload:disabled{background:color-mix(in srgb, var(--muted,#9ca3af) 42%, var(--surface,#fff));color:var(--muted,#9ca3af);cursor:not-allowed;}",
"#pane-planogram .hp-whbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 12px;}",
"#pane-planogram .hp-whtab{border:1px solid var(--border,#e8ecf1);background:var(--surface,#fff);color:var(--text,#374151);border-radius:999px;padding:6px 13px;font-size:12px;font-weight:600;cursor:pointer;min-height:32px;display:inline-flex;align-items:center;gap:7px;transition:background .16s ease,border-color .16s ease;}",
"#pane-planogram .hp-whtab:hover{background:color-mix(in srgb, var(--accent,#2563eb) 8%, transparent);}",
"#pane-planogram .hp-whtab.active{background:var(--accent,#1f2937);color:var(--accent-text,#fff);border-color:var(--accent,#1f2937);}",
"#pane-planogram .hp-whtab b{font-variant-numeric:tabular-nums;}",
"#pane-planogram .hp-dot,.hp-modal .hp-dot{display:inline-block;width:9px;height:9px;border-radius:50%;flex:none;vertical-align:middle;}",
"#pane-planogram .hp-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(136px,1fr));gap:8px;margin:4px 0 12px;}",
"#pane-planogram .hp-tile{--cc:var(--accent,#2563eb);background:var(--surface,#fff);border:1px solid var(--border,#e8ecf1);border-left:4px solid var(--cc);border-radius:10px;padding:9px 12px;cursor:pointer;transition:transform .16s cubic-bezier(.32,.72,0,1),box-shadow .25s ease;animation:hp-in .3s ease both;}",
"#pane-planogram .hp-tile:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(16,24,40,.12);}",
"#pane-planogram .hp-tile .k{font-size:20px;font-weight:780;font-variant-numeric:tabular-nums;line-height:1;color:var(--cc);}",
"#pane-planogram .hp-tile.tot .k{color:var(--text,#1f2937);}",
"#pane-planogram .hp-tile .l{font-size:11px;color:var(--text,#374151);margin-top:4px;font-weight:650;line-height:1.2;}",
"#pane-planogram .hp-tile .s{font-size:10px;color:var(--muted,#9ca3af);margin-top:1px;}",
/* hero "hôm nay": số to hơn 1 nấc + thanh tiến độ xếp chồng */
"#pane-planogram .hp-hero .hp-tile .k{font-size:24px;}",
"#pane-planogram .hp-herobar{margin:2px 0 4px;}",
"#pane-planogram .hp-grid2{display:grid;grid-template-columns:1.35fr 1fr;gap:12px;margin-top:12px;}",
"@media(max-width:1024px){#pane-planogram .hp-grid2{grid-template-columns:1fr;}}",
"#pane-planogram .hp-panel{background:var(--surface,#fff);border:1px solid var(--border,#e8ecf1);border-radius:14px;padding:14px 16px;}",
"#pane-planogram .hp-panel h2{margin:0 0 12px;font-size:14px;font-weight:680;color:var(--text,#374151);display:flex;align-items:center;gap:8px;flex-wrap:wrap;}",
"#pane-planogram .hp-legend{display:inline-flex;flex-wrap:wrap;gap:3px 10px;font-weight:400;font-size:10.5px;color:var(--muted,#6b7280);}",
"#pane-planogram .hp-legend span{display:inline-flex;align-items:center;gap:5px;}",
"#pane-planogram .hp-legend i{width:9px;height:9px;border-radius:3px;display:inline-block;flex:none;}",
"#pane-planogram .hp-chart{display:flex;flex-direction:column;gap:1px;max-height:330px;overflow-y:auto;padding-right:6px;}",
"#pane-planogram .hp-row{display:grid;grid-template-columns:210px 1fr 92px;align-items:center;gap:10px;padding:5px 6px;border-radius:8px;cursor:pointer;transition:background .16s ease;}",
"#pane-planogram .hp-row:hover{background:color-mix(in srgb, var(--accent,#2563eb) 7%, transparent);}",
"#pane-planogram .hp-rl{font-size:11.5px;font-weight:600;color:var(--text,#1f2937);white-space:normal;word-break:break-word;line-height:1.3;display:flex;align-items:center;gap:7px;}",
"#pane-planogram .hp-track{background:color-mix(in srgb, var(--muted,#9ca3af) 20%, transparent);border-radius:6px;height:16px;overflow:hidden;}",
"#pane-planogram .hp-fill{height:100%;display:flex;width:0;border-radius:6px;overflow:hidden;transition:width .85s cubic-bezier(.4,0,.2,1);}",
"#pane-planogram .hp-fill i{display:block;height:100%;min-width:1px;}",
"#pane-planogram .hp-rv{text-align:right;font-variant-numeric:tabular-nums;font-size:12px;line-height:1.15;}",
"#pane-planogram .hp-rv b{font-size:13px;color:var(--text,#1f2937);} #pane-planogram .hp-rv small{display:block;color:var(--muted,#9ca3af);font-size:10px;font-weight:500;}",
"@media(max-width:640px){#pane-planogram .hp-row{grid-template-columns:1fr 84px;grid-template-areas:'l l' 't v';row-gap:5px;gap:8px;padding:7px 6px;}#pane-planogram .hp-rl{grid-area:l;}#pane-planogram .hp-track{grid-area:t;}#pane-planogram .hp-rv{grid-area:v;}}",
"#pane-planogram .hp-empty{color:var(--muted,#9ca3af);font-size:12.5px;padding:18px 2px;text-align:center;}",
"#pane-planogram .hp-mini{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 12px;}",
/* panel đối chiếu chấm công */
"#pane-planogram .hp-cc{margin-top:12px;}",
"#pane-planogram .hp-ccsearch{width:100%;max-width:340px;padding:9px 11px;border:1px solid var(--border,#d5dbe4);border-radius:9px;font-size:12.5px;background:var(--surface,#fff);color:var(--text,#1f2937);min-height:36px;margin:2px 0 10px;}",
"#pane-planogram .hp-ccsearch:focus{outline:0;border-color:var(--accent,#2563eb);}",
"#pane-planogram .hp-ccwrap{overflow-x:auto;-webkit-overflow-scrolling:touch;max-height:520px;overflow-y:auto;border:1px solid var(--border,#e8ecf1);border-radius:12px;}",
"#pane-planogram .hp-cctbl{width:100%;border-collapse:collapse;font-size:12.5px;color:var(--text,#1f2937);min-width:720px;}",
"#pane-planogram .hp-cctbl thead th{position:sticky;top:0;background:var(--accent,#1f2937);color:var(--accent-text,#fff);padding:9px 11px;text-align:left;font-weight:600;font-size:11px;z-index:1;white-space:nowrap;}",
"#pane-planogram .hp-cctbl td{padding:8px 11px;border-bottom:1px solid var(--border,#f1f4f8);white-space:nowrap;}",
"#pane-planogram .hp-cctbl tr[data-em]{cursor:pointer;}",
"#pane-planogram .hp-cctbl tr:hover td{background:color-mix(in srgb, var(--accent,#2563eb) 5%, transparent);}",
"#pane-planogram .hp-cctbl .num{text-align:right;font-variant-numeric:tabular-nums;}",
"#pane-planogram .hp-cctbl .mut{color:var(--muted,#9ca3af);}",
"#pane-planogram .hp-cctbl .empty{text-align:center;color:var(--muted,#9ca3af);padding:26px;}",
"#pane-planogram .hp-badge{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:650;white-space:nowrap;}",
"#pane-planogram .hp-state{padding:56px 20px;text-align:center;color:var(--muted,#6b7280);}",
"#pane-planogram .hp-spin{width:32px;height:32px;border:3px solid var(--border,#d5dbe4);border-top-color:var(--accent,#2563eb);border-radius:50%;margin:0 auto 16px;animation:hp-sp .8s linear infinite;}",
"@keyframes hp-sp{to{transform:rotate(360deg)}}",
"#pane-planogram .hp-fade{animation:hp-in .45s cubic-bezier(.32,.72,0,1) both;}",
"@keyframes hp-in{from{opacity:0;transform:translate3d(0,12px,0)}to{opacity:1;transform:none}}",
".hp-modal{display:none;position:fixed;inset:0;background:rgba(17,24,39,.55);backdrop-filter:blur(6px);z-index:1200;align-items:center;justify-content:center;padding:18px;opacity:0;transition:opacity .22s;}",
".hp-modal.show{opacity:1;}",
".hp-modalbox{background:var(--surface,#fff);color:var(--text,#1f2937);border-radius:18px;width:min(1080px,96vw);max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(16,24,40,.3);transform:translateY(12px) scale(.985);opacity:.6;transition:transform .26s,opacity .26s;}",
".hp-modal.show .hp-modalbox{transform:none;opacity:1;}",
".hp-modalhd{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border,#e8ecf1);gap:10px;}",
".hp-modalhd .mt{font-weight:700;font-size:15.5px;} .hp-modalhd .mtsub{font-size:11.5px;color:var(--muted,#9ca3af);margin-top:2px;}",
".hp-mclose{background:0;border:0;font-size:24px;line-height:1;cursor:pointer;color:var(--muted,#9ca3af);padding:6px 10px;border-radius:8px;min-width:44px;min-height:40px;flex:none;}",
".hp-mclose:hover{color:#ef4444;background:color-mix(in srgb,#ef4444 12%,transparent);}",
".hp-mfilters{display:grid;grid-template-columns:1fr 1fr 1.3fr 1.6fr;gap:8px;padding:12px 20px;border-bottom:1px solid var(--border,#e8ecf1);}",
"@media(max-width:720px){.hp-mfilters{grid-template-columns:1fr 1fr;}}",
".hp-mfilters .fld{display:flex;flex-direction:column;gap:3px;}",
".hp-mfilters label{font-size:10px;font-weight:650;color:var(--muted,#9ca3af);text-transform:uppercase;letter-spacing:.04em;}",
".hp-mfilters input{padding:9px 10px;border:1px solid var(--border,#d5dbe4);border-radius:9px;font-size:12.5px;background:var(--surface,#fff);color:var(--text,#1f2937);width:100%;min-height:38px;}",
".hp-mfilters input:focus{outline:0;border-color:var(--accent,#2563eb);}",
".hp-combo{position:relative;}",
".hp-combo-menu{position:absolute;top:calc(100% + 5px);left:0;right:0;z-index:40;background:var(--surface,#fff);border:1px solid var(--border,#e8ecf1);border-radius:11px;box-shadow:0 24px 60px rgba(16,24,40,.28);max-height:250px;overflow-y:auto;overscroll-behavior:contain;padding:5px;opacity:0;visibility:hidden;transform:translateY(-6px);transition:.16s;}",
".hp-combo-menu.show{opacity:1;visibility:visible;transform:none;}",
".hp-combo-item{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 11px;border-radius:8px;font-size:12.5px;cursor:pointer;color:var(--text,#1f2937);white-space:nowrap;overflow:hidden;}",
".hp-combo-item .nm{overflow:hidden;text-overflow:ellipsis;} .hp-combo-item .c{color:var(--muted,#9ca3af);font-size:11px;flex:none;}",
".hp-combo-item:hover{background:color-mix(in srgb, var(--accent,#2563eb) 10%, transparent);color:var(--accent,#2563eb);}",
".hp-combo-item.all{border-bottom:1px solid var(--border,#e8ecf1);font-weight:600;}",
".hp-combo-empty{padding:12px;font-size:12px;color:var(--muted,#9ca3af);text-align:center;}",
".hp-msum{padding:9px 20px;font-size:12px;color:var(--muted,#6b7280);border-bottom:1px solid var(--border,#e8ecf1);font-variant-numeric:tabular-nums;}",
".hp-modalbody{overflow:auto;padding:0 20px 20px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;}",
".hp-mtbl{width:100%;border-collapse:collapse;font-size:12.5px;color:var(--text,#1f2937);}",
".hp-mtbl thead th{position:sticky;top:0;background:var(--accent,#1f2937);color:var(--accent-text,#fff);padding:9px 11px;text-align:left;font-weight:600;font-size:11px;z-index:1;white-space:nowrap;}",
".hp-mtbl td{padding:8px 11px;border-bottom:1px solid var(--border,#f1f4f8);vertical-align:top;white-space:nowrap;}",
".hp-mtbl .empty{text-align:center;color:var(--muted,#9ca3af);padding:28px;}",
".hp-mtbl .nm{white-space:normal;min-width:150px;}",
".hp-mtbl .mut{color:var(--muted,#9ca3af);}",
".hp-mtbl .badge{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:650;}",
".hp-mtbl tbody.is-filtering{opacity:.45;transition:opacity .12s;}",
".hp-mtbl small{display:block;color:var(--muted,#9ca3af);font-size:10px;}",
/* thumbnail ảnh báo cáo trong pop-up (lazy — chỉ tải khi cuộn tới) */
".hp-thumbs{display:inline-flex;align-items:center;gap:5px;}",
".hp-thumbs img{width:34px;height:34px;object-fit:cover;border-radius:7px;border:1px solid var(--border,#e8ecf1);cursor:zoom-in;display:block;transition:transform .16s cubic-bezier(.32,.72,0,1);background:color-mix(in srgb, var(--muted,#9ca3af) 14%, transparent);}",
".hp-thumbs img:hover{transform:scale(1.12);}",
".hp-thumbs .more{border:1px solid var(--border,#e8ecf1);background:var(--surface,#fff);color:var(--accent,#2563eb);border-radius:7px;min-width:34px;height:34px;font-size:11px;font-weight:650;cursor:pointer;}",
".hp-thumbs .more:hover{background:color-mix(in srgb, var(--accent,#2563eb) 10%, transparent);}",
/* pop-up TRA CỨU THEO NHÂN VIÊN (nhật ký theo ngày) */
".hp-nk-grid{display:grid;grid-template-columns:280px 1fr;gap:0;flex:1;min-height:0;}",
".hp-nk-left{border-right:1px solid var(--border,#e8ecf1);display:flex;flex-direction:column;min-height:0;}",
".hp-nk-left input{margin:12px 14px 8px;padding:9px 11px;border:1px solid var(--border,#d5dbe4);border-radius:9px;font-size:12.5px;background:var(--surface,#fff);color:var(--text,#1f2937);min-height:38px;}",
".hp-nk-left input:focus{outline:0;border-color:var(--accent,#2563eb);}",
".hp-nk-list{overflow-y:auto;overscroll-behavior:contain;padding:0 8px 12px;flex:1;min-height:0;}",
".hp-nk-item{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 10px;border-radius:9px;cursor:pointer;transition:background .16s ease;}",
".hp-nk-item:hover{background:color-mix(in srgb, var(--accent,#2563eb) 8%, transparent);}",
".hp-nk-item.active{background:var(--accent,#1f2937);color:var(--accent-text,#fff);}",
".hp-nk-item .nm{font-size:12.5px;font-weight:600;line-height:1.25;overflow:hidden;text-overflow:ellipsis;}",
".hp-nk-item .nm small{display:block;font-weight:500;font-size:10.5px;color:var(--muted,#9ca3af);}",
".hp-nk-item.active .nm small{color:color-mix(in srgb, var(--accent-text,#fff) 70%, transparent);}",
".hp-nk-item .c{font-size:10.5px;color:var(--muted,#9ca3af);text-align:right;flex:none;font-variant-numeric:tabular-nums;}",
".hp-nk-item.active .c{color:color-mix(in srgb, var(--accent-text,#fff) 75%, transparent);}",
".hp-nk-right{overflow-y:auto;overscroll-behavior:contain;padding:14px 18px 18px;min-height:0;}",
".hp-nk-right .hd{font-weight:700;font-size:14px;margin-bottom:2px;}",
".hp-nk-right .sub{font-size:11.5px;color:var(--muted,#9ca3af);margin-bottom:12px;}",
".hp-nk-day{border-left:3px solid var(--accent,#2563eb);padding:6px 0 8px 12px;margin:0 0 10px;animation:hp-in .3s ease both;}",
".hp-nk-day .d{font-size:12px;font-weight:700;color:var(--text,#1f2937);margin-bottom:5px;display:flex;gap:8px;align-items:center;}",
".hp-nk-day .d .today{font-size:10px;font-weight:650;color:var(--accent,#2563eb);background:color-mix(in srgb, var(--accent,#2563eb) 12%, transparent);border-radius:999px;padding:2px 8px;}",
".hp-nk-khu{display:flex;gap:6px;align-items:flex-start;margin:3px 0;flex-wrap:wrap;}",
".hp-nk-khu .kdot{margin-top:5px;}",
".hp-nk-loc{display:inline-block;font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:6px;margin:1px 2px 1px 0;text-decoration:none;color:var(--text,#374151);background:color-mix(in srgb, var(--muted,#9ca3af) 14%, transparent);transition:background .16s ease,color .16s ease;}",
".hp-nk-loc:hover{background:color-mix(in srgb, var(--accent,#2563eb) 14%, transparent);color:var(--accent,#2563eb);}",
".hp-nk-empty{color:var(--muted,#9ca3af);font-size:12.5px;padding:40px 16px;text-align:center;}",
"@media(max-width:768px){.hp-modal{padding:0;align-items:stretch;justify-content:stretch;}.hp-modalbox{width:100vw!important;max-height:100vh!important;height:100vh;border-radius:0;}.hp-mclose{font-size:30px;min-width:48px;min-height:48px;}.hp-mfilters input{min-height:44px;}#pane-planogram .hp-whtab{min-height:44px;}#hpReload,#pane-planogram .hp-btn{min-height:44px;width:100%;}",
".hp-nk-grid{grid-template-columns:1fr;grid-template-rows:auto 1fr;}.hp-nk-left{border-right:0;border-bottom:1px solid var(--border,#e8ecf1);}.hp-nk-list{max-height:200px;}}",
/* lightbox host phải nổi TRÊN pop-up module (host để z-index 60, pop-up 1200) */
"#lightbox{z-index:1400;}",
].join("\n");

/* ===== KHUNG HTML ===== */
var KHUNG =
'<div class="hp-whbar" id="hpWhBar"></div>' +
'<div id="hpToday"></div>' +
'<div id="hpContent"></div>' +
'<div id="hpCC" class="hp-cc"></div>' +
'<div id="hpState" class="hp-state"><div class="hp-spin"></div>Đang tải dữ liệu vệ sinh…</div>' +
'<div class="hp-srcfoot">' +
'  <div class="hp-srcbar">' +
'    <span class="hp-chip">Vệ sinh — SHOP - 170 QUOC LO 1A · khu vực F0-A1 &amp; F0-A8</span>' +
'    <a href="' + SHEET_URL + '" target="_blank" rel="noopener">Mở Google Sheet</a>' +
'    <span id="hpLoadinfo" class="hp-hint"></span>' +
'    <button id="hpReload" onclick="HPLANOGRAM.reload()" title="Đọc lại dữ liệu mới nhất từ Google Sheet">Làm mới</button>' +
'  </div>' +
'  <p class="hp-hint" style="margin:0">Nguồn: <b>planogram</b> (request-of-declaration). Bộ đồng bộ <code>sync-vesinh-all.js</code> (cụm 8h40 / nút Cập nhật ngay) ghi 4 tab: <code>' + TAB_YC + '</code> (yêu cầu hôm nay + ảnh báo cáo), <code>' + TAB_NK + '</code> (nhật ký NV theo ngày), <code>' + TAB + '</code>, <code>' + TAB_CC + '</code>. Ảnh trong pop-up là ảnh nhân viên chụp khi báo cáo — bấm để phóng to.</p>' +
'</div>';

var MODAL_HTML =
'<div id="hpModal" class="hp-modal">' +
'  <div class="hp-modalbox">' +
'    <div class="hp-modalhd"><div><div class="mt" id="hpMtitle"></div><div class="mtsub" id="hpMsub"></div></div>' +
'      <div style="display:flex;align-items:center;gap:8px;"><a id="hpMPg" class="hp-ext" target="_blank" rel="noopener" style="display:none;font-size:12px;white-space:nowrap;">Mở planogram ↗</a>' +
'      <button class="hp-mclose" onclick="HPLANOGRAM.closeModal()">&times;</button></div></div>' +
'    <div class="hp-mfilters" id="hpMFilters"></div>' +
'    <div class="hp-msum" id="hpMSum"></div>' +
'    <div class="hp-modalbody"><table class="hp-mtbl"><thead id="hpMHead"></thead><tbody id="hpMBody"></tbody></table></div>' +
'  </div>' +
'</div>' +
'<div id="hpNkModal" class="hp-modal">' +
'  <div class="hp-modalbox" style="width:min(920px,96vw);height:min(640px,90vh);">' +
'    <div class="hp-modalhd"><div><div class="mt">Tra cứu theo nhân viên</div>' +
'      <div class="mtsub">Nhật ký vệ sinh theo NGÀY (45 ngày) — quầy kệ F0-A1 thường giữ theo tuần, không gian F0-A8 đổi theo ngày</div></div>' +
'      <button class="hp-mclose" onclick="HPLANOGRAM.closeNk()">&times;</button></div>' +
'    <div class="hp-nk-grid">' +
'      <div class="hp-nk-left"><input id="hpNkQ" autocomplete="off" placeholder="Tìm tên / mã nhân viên…" oninput="HPLANOGRAM.nkSearch(this.value)"><div class="hp-nk-list" id="hpNkList"></div></div>' +
'      <div class="hp-nk-right" id="hpNkRight"></div>' +
'    </div>' +
'  </div>' +
'</div>';

var THEAD_LOC = '<tr><th>Location</th><th>Executed By</th><th>Code</th><th class="nm">Name</th><th>Khu vực</th><th>Trạng thái</th></tr>';
var THEAD_REQ = '<tr><th>Vị trí</th><th>Trạng thái</th><th>AI xét duyệt</th><th class="nm">Người thực hiện</th><th>Lúc</th><th class="nm">Phụ trách (dự kiến)</th><th>Ảnh</th><th>Planogram</th></tr>';

/* ===== TẢI DỮ LIỆU — ưu tiên GAS readTab (SHEET PRIVATE bí mật), fallback gviz (sheet public) ===== */
function injectJSONP(url, id, onerr){
  var old = $id(id); if (old) old.remove();
  var sc = document.createElement("script"); sc.id = id; sc.src = url;
  sc.onerror = function(){ onerr && onerr(); };
  document.body.appendChild(sc);
}
function gvizHeader(resp){ return ((resp.table && resp.table.cols) || []).map(function(c){ return (c && c.label) || ""; }); }
function gvizRows(resp){ return ((resp.table && resp.table.rows) || []).map(function(r){ return (r.c || []).map(function(c){ return (c && c.v != null) ? c.v : ""; }); }); }
/* nạp 1 tab: GAS readTab trước, hỏng thì gviz (cbBuild(header, rows2d, ts)) */
function loadTab(tab, cbName, cbBuild, onFail){
  window[cbName] = function(j){
    if (j && j.status === "success" && j.header && j.header.length){ cbBuild(j.header, j.rows || [], Number(j.ts) || 0); }
    else { loadTabGviz(tab, cbName, cbBuild, onFail); }
  };
  injectJSONP(APPSCRIPT_URL + "?action=readTab&tab=" + encodeURIComponent(tab) + "&callback=" + cbName + "&_=" + Date.now(), "hp_sc_" + cbName, function(){ loadTabGviz(tab, cbName, cbBuild, onFail); });
}
function loadTabGviz(tab, cbName, cbBuild, onFail){
  var cb2 = cbName + "g";
  window[cb2] = function(resp){
    if (!resp || resp.status === "error"){ onFail && onFail(); }
    else cbBuild(gvizHeader(resp), gvizRows(resp), 0);
  };
  var url = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq?tqx=out:json;responseHandler:" + cb2 + "&sheet=" + encodeURIComponent(tab) + "&headers=1";
  injectJSONP(url, "hp_sc_" + cb2, function(){ onFail && onFail(); });
}
function loadData(){
  var st = $id("hpState"); if (!st) return;
  var btn = $id("hpReload"); if (btn) btn.disabled = true;
  st.style.display = "block";
  st.innerHTML = '<div class="hp-spin"></div>Đang tải dữ liệu vệ sinh…';
  $id("hpContent").innerHTML = ""; $id("hpToday").innerHTML = ""; $id("hpWhBar").innerHTML = "";
  S.lastAt = Date.now();
  loadTab(TAB, "hpgv_pt", function(H, rows, ts){ if (ts > 0) S.tsData = ts; buildMain(H, rows); if (!ts) loadMeta(); capNhatInfo(); },
    function(){ S.ok = false; render(); });
  loadTab(TAB_CC, "hpgv_cc", function(H, rows, ts){ if (ts > 0) S.cc.ts = ts; buildCC(H, rows); },
    function(){ S.cc.ok = false; renderCC(); });
  loadTab(TAB_YC, "hpgv_yc", function(H, rows, ts){ if (ts > 0) S.yc.ts = ts; buildYC(H, rows); },
    function(){ S.yc.ok = false; renderToday(); });
  loadTab(TAB_NK, "hpgv_nk", function(H, rows, ts){ if (ts > 0) S.nk.ts = ts; buildNK(H, rows); }, function(){ S.nk.ok = false; });
  loadTab(TAB_AI, "hpgv_ai", function(H, rows, ts){ if (ts > 0) S.ai.ts = ts; buildAI(H, rows); }, function(){ S.ai.ok = false; });
}
/* Chip giờ dữ liệu: hỏi GAS lastSync (mốc apiAt lúc bộ sync ghi) — chỉ cần khi rơi về gviz */
function loadMeta(){
  window.hpgv_last = function(j){ try{ if (j && j.status === "success" && Number(j.ts) > 0){ S.tsData = Number(j.ts); capNhatInfo(); } }catch(e){} };
  injectJSONP(APPSCRIPT_URL + "?action=lastSync&tab=" + encodeURIComponent(TAB) + "&callback=hpgv_last", "hp_sc_meta");
}

/* ===== BUILD 4 NGUỒN ===== */
function buildMain(H, rows2d){
  var hl = H.map(function(h){ return String(h).replace(/\s+/g, " ").trim().toLowerCase(); });
  var idx = {}; Object.keys(COLS).forEach(function(k){ idx[k] = idxOf(hl, COLS[k]); });
  if (idx.loc < 0){ S.ok = false; S.all = []; render(); return; }   // tab chưa có/không đúng nguồn
  var arr = [];
  rows2d.forEach(function(row){
    function gv(i){ return (i >= 0 && row[i] != null) ? row[i] : ""; }
    var loc = String(gv(idx.loc)).trim(); if (!loc) return;
    var a = areaOf(loc); if (!a) return;    // chỉ giữ F0-A1 / F0-A8
    var email = String(gv(idx.email) || "").trim();
    var code = String(gv(idx.code) || "").trim(), name = String(gv(idx.name) || "").trim();
    ghiNhoNm(email, code, name);
    arr.push({ loc: loc, area: a.k, email: email, code: code, name: name, done: !!email });
  });
  S.ok = true; S.all = arr; render();
}
function buildCC(H, rows2d){
  var hl = H.map(function(h){ return String(h).replace(/\s+/g, " ").trim().toLowerCase(); });
  var idx = {}; Object.keys(COLS_CC).forEach(function(k){ idx[k] = idxOf(hl, COLS_CC[k]); });
  if (idx.name < 0 || idx.tt < 0){ S.cc.ok = false; S.cc.rows = []; renderCC(); return; }
  var arr = [];
  rows2d.forEach(function(row){
    function gv(i){ return (i >= 0 && row[i] != null) ? row[i] : ""; }
    var name = String(gv(idx.name)).trim(); if (!name) return;
    var tt = String(gv(idx.tt)).trim();
    var email = String(gv(idx.email) || "").trim();
    ghiNhoNm(email, String(gv(idx.code) || "").trim(), name);
    arr.push({ code: String(gv(idx.code) || "").trim(), name: name, email: email,
      major: String(gv(idx.major) || "").trim(), ci: fmtHM(gv(idx.ci)), co: fmtHM(gv(idx.co)),
      vs: Number(gv(idx.vs)) || 0, loc: String(gv(idx.loc) || "").trim(), tt: tt, bk: ccBucket(tt) });
  });
  S.cc.ok = true; S.cc.rows = arr; renderCC();
}
function buildYC(H, rows2d){
  var hl = H.map(function(h){ return String(h).replace(/\s+/g, " ").trim().toLowerCase(); });
  var idx = {}; Object.keys(COLS_YC).forEach(function(k){ idx[k] = idxOf(hl, COLS_YC[k]); });
  if (idx.loc < 0 || idx.st < 0){ S.yc.ok = false; S.yc.rows = []; renderToday(); return; }
  var arr = [], ngay = "";
  rows2d.forEach(function(row){
    function gv(i){ return (i >= 0 && row[i] != null) ? row[i] : ""; }
    var loc = String(gv(idx.loc)).trim(); if (!loc) return;
    var a = areaOf(loc); if (!a) return;
    var r = {
      id: String(gv(idx.id)).replace(/\.0$/, "").trim(),
      ngay: fmtNgay(gv(idx.ngay)),
      loc: loc, area: a.k,
      stId: Number(gv(idx.stid)) || 0, st: String(gv(idx.st)).trim(),
      email: String(gv(idx.email) || "").trim(), at: fmtNgayGio(gv(idx.at)),
      pt: String(gv(idx.pt) || "").trim(),
      ptCode: String(gv(idx.ptcode) || "").trim(), ptName: String(gv(idx.ptname) || "").trim(),
      ptDiLam: Number(gv(idx.ptdilam)) || 0, ptCi: fmtHM(gv(idx.ptci)),
      anh: String(gv(idx.anh) || "").split(/\s*\|\s*/).filter(Boolean)
    };
    r.bk = ycBucket(r);
    ghiNhoNm(r.pt, r.ptCode, r.ptName);
    if (r.ngay > ngay) ngay = r.ngay;
    arr.push(r);
  });
  S.yc.ok = true; S.yc.rows = arr; S.yc.ngay = ngay;
  renderToday(); capNhatInfo();
}
function buildNK(H, rows2d){
  var hl = H.map(function(h){ return String(h).replace(/\s+/g, " ").trim().toLowerCase(); });
  var idx = {}; Object.keys(COLS_NK).forEach(function(k){ idx[k] = idxOf(hl, COLS_NK[k]); });
  if (idx.ngay < 0 || idx.email < 0){ S.nk.ok = false; S.nk.rows = []; return; }
  var arr = [];
  rows2d.forEach(function(row){
    function gv(i){ return (i >= 0 && row[i] != null) ? row[i] : ""; }
    var email = String(gv(idx.email)).trim(); if (!email) return;
    var code = String(gv(idx.code) || "").trim(), name = String(gv(idx.name) || "").trim();
    ghiNhoNm(email, code, name);
    var khu = String(gv(idx.khu) || "").trim();
    arr.push({ ngay: fmtNgay(gv(idx.ngay)), email: email, code: code, name: name,
      area: /A8/.test(khu) ? "A8" : "A1",
      locs: String(gv(idx.locs) || "").split(/\s*,\s*/).filter(Boolean) });
  });
  S.nk.ok = true; S.nk.rows = arr;
  render();   // vẽ lại panel phụ trách (nút tra cứu đếm NV)
}
function buildAI(H, rows2d){
  var hl = H.map(function(h){ return String(h).replace(/\s+/g, " ").trim().toLowerCase(); });
  var idx = {}; Object.keys(COLS_AI).forEach(function(k){ idx[k] = idxOf(hl, COLS_AI[k]); });
  if (idx.id < 0 || idx.kl < 0){ S.ai.ok = false; S.ai.by = {}; return; }
  var by = {};
  rows2d.forEach(function(row){
    function gv(i){ return (i >= 0 && row[i] != null) ? row[i] : ""; }
    var id = String(gv(idx.id)).replace(/\.0$/, "").trim(); if (!id) return;
    by[id] = { kl: String(gv(idx.kl)).trim().toUpperCase().replace(/\s+/g, "_"),
      diem: Number(gv(idx.diem)) || 0, tincay: Number(gv(idx.tincay)) || 0,
      lydo: String(gv(idx.lydo) || "").trim(), anhloi: String(gv(idx.anhloi) || "").trim() };
  });
  S.ai.ok = true; S.ai.by = by;
  renderToday();   // vẽ lại chip AI ở hero
}
function aiOf(r){ return S.ai.ok ? (S.ai.by[String(r.id)] || null) : null; }
function capNhatInfo(){
  var el = $id("hpLoadinfo"); if (!el) return;
  var n = S.yc.rows.length || S.all.length;
  el.textContent = (n ? nf(n) + (S.yc.rows.length ? " yêu cầu" : " vị trí") : "") + (S.tsData ? (n ? " · " : "") + "cập nhật " + fmtTime(S.tsData) : "");
}

/* ===== LỌC + RENDER ===== */
function rowsInScope(){ return S.all.filter(function(r){ return !S.area || r.area === S.area; }); }
function ycInScope(){ return S.yc.rows.filter(function(r){ return !S.area || r.area === S.area; }); }
function setArea(a){ if (S.area === a) a = ""; S.area = a; render(); renderToday(); }
function renderWhBar(){
  var el = $id("hpWhBar"); if (!el) return;
  var cnt = {}; S.all.forEach(function(r){ cnt[r.area] = (cnt[r.area] || 0) + 1; });
  var keys = AREAS.filter(function(a){ return cnt[a.k]; });
  if (!keys.length){ el.innerHTML = ""; return; }
  el.innerHTML = '<span class="hp-hint" style="font-weight:650">Lọc khu vực:</span>' +
    '<button class="hp-whtab' + (S.area ? "" : " active") + '" onclick="HPLANOGRAM.setArea(\'\')">Tất cả</button>' +
    keys.map(function(a){
      return '<button class="hp-whtab' + (S.area === a.k ? " active" : "") + '" data-a="' + a.k + '" title="' + esc(a.lb) + '" ' +
        'onclick="HPLANOGRAM.setArea(this.getAttribute(\'data-a\'))"><span class="hp-dot" style="background:' + a.c + '"></span>' + esc(a.short) + ' <b>' + nf(cnt[a.k]) + '</b></button>';
    }).join("");
}
/* --- KHỐI 1: VỆ SINH HÔM NAY (tab VESINH-YEUCAU) — 4 thẻ hành động + thanh tiến độ --- */
function renderToday(){
  var box = $id("hpToday"); if (!box) return;
  if (!S.yc.ok || !S.yc.rows.length){
    box.innerHTML = S.ok ? ('<section class="hp-panel hp-fade" style="margin-bottom:12px"><div class="hp-empty">Chưa có dữ liệu yêu cầu vệ sinh trong ngày (tab <code>' + esc(TAB_YC) + '</code>) — chạy <code>sync-vesinh-all.js</code> hoặc bấm "Cập nhật ngay" ở tab Tổng quan.</div></section>') : "";
    return;
  }
  var rows = ycInScope(), nTot = rows.length;
  var cnt = { da: 0, nhac: 0, khong: 0 }, nvDa = {};
  rows.forEach(function(r){ cnt[r.bk]++; if (r.bk === "da" && r.email) nvDa[r.email.toLowerCase()] = 1; });
  var nNvDa = Object.keys(nvDa).length;
  var ngay = S.yc.ngay, homNay = ngay === isoToday();
  var chipNgay = '<span class="hp-chip" title="Ngày của dữ liệu yêu cầu vệ sinh">' + (homNay ? "Hôm nay " : "") + thuVN(ngay) + " " + ngayVN(ngay) + '</span>' +
    (homNay ? "" : ' <span class="hp-hint">dữ liệu chưa phải hôm nay — bấm Làm mới / "Cập nhật ngay"</span>');

  var tiles =
    '<div class="hp-tile tot" onclick="HPLANOGRAM.openYc(\'\')" title="Xem mọi yêu cầu vệ sinh trong ngày"><div class="k">' + nf(nTot) + '</div><div class="l">Tổng yêu cầu vệ sinh</div><div class="s">' + (S.area ? esc(areaMeta(S.area).short) : "F0-A1 + F0-A8") + '</div></div>' +
    YCST.map(function(m){
      var extra = m.k === "da" ? (pct(cnt.da, nTot) + "% · " + nf(nNvDa) + " nhân viên") : m.sub;
      return '<div class="hp-tile" style="--cc:' + m.c + '" data-k="' + m.k + '" onclick="HPLANOGRAM.openYc(this.getAttribute(\'data-k\'))" title="' + esc(m.lb + " — " + m.sub) + '"><div class="k">' + nf(cnt[m.k]) + '</div><div class="l">' + esc(m.lb) + '</div><div class="s">' + esc(extra) + '</div></div>';
    }).join("");

  var wDa = pct(cnt.da, nTot), wNhac = pct(cnt.nhac, nTot);
  var bar =
    '<div class="hp-track hp-herobar"><span class="hp-fill" data-w="100" style="width:100%">' +
      '<i style="width:' + wDa + '%;background:' + ycMeta("da").c + '" title="Đã vệ sinh: ' + nf(cnt.da) + '"></i>' +
      '<i style="width:' + wNhac + '%;background:' + ycMeta("nhac").c + '" title="Chưa vệ sinh (có đi làm): ' + nf(cnt.nhac) + '"></i>' +
      '<i style="width:' + (100 - wDa - wNhac) + '%;background:' + ycMeta("khong").c + '" title="Không có ca: ' + nf(cnt.khong) + '"></i>' +
    '</span></div>' +
    '<span class="hp-legend">' + YCST.map(function(m){ return '<span><i style="background:' + m.c + '"></i>' + esc(m.lb) + ' · ' + nf(cnt[m.k]) + '</span>'; }).join("") + '</span>';

  /* Chip AI xét duyệt (nếu bộ sync-vesinh-ai.mjs đã chạy) — bấm chip mở pop-up lọc sẵn */
  var aiLine = "";
  if (S.ai.ok){
    var ac = { DAT: 0, KHONG_DAT: 0, CAN_XEM: 0 }, nAi = 0;
    rows.forEach(function(r){ var a2 = aiOf(r); if (a2 && ac[a2.kl] != null){ ac[a2.kl]++; nAi++; } });
    if (nAi){
      aiLine = '<div class="hp-whbar" style="margin:12px 0 0">' +
        '<span class="hp-hint" style="font-weight:650">AI xét duyệt ảnh:</span>' +
        AIST.map(function(m){
          return '<button class="hp-whtab" data-k="' + m.k + '" title="' + esc(m.lb) + ' — bấm xem danh sách" onclick="HPLANOGRAM.openYcAi(this.getAttribute(\'data-k\'))"><span class="hp-dot" style="background:' + m.c + '"></span>' + esc(m.lb.replace("AI: ", "")) + ' <b>' + nf(ac[m.k]) + '</b></button>';
        }).join("") +
        '<span class="hp-hint">' + nf(nAi) + '/' + nf(nTot) + ' yêu cầu đã được AI chấm ảnh' + (S.ai.ts ? ' · ' + fmtTime(S.ai.ts) : '') + '</span></div>';
    }
  }
  box.innerHTML =
    '<section class="hp-panel hp-fade hp-hero" style="margin-bottom:12px">' +
    '<h2>Vệ sinh hôm nay ' + chipNgay + '<span style="flex:1"></span><a class="hp-ext" style="font-size:12px" target="_blank" rel="noopener" href="' + esc(pgListUrl(ngay, S.area, "")) + '">Mở planogram ↗</a></h2>' +
    '<div class="hp-tiles">' + tiles + '</div>' + bar + aiLine +
    '</section>';
}
/* --- KHỐI 2: THEO KHU VỰC + PHỤ TRÁCH (thu gọn, tham khảo) --- */
function render(){
  var st = $id("hpState"), cont = $id("hpContent");
  if (!st || !cont) return;
  var btn = $id("hpReload"); if (btn) btn.disabled = false;
  if (!S.ok){
    $id("hpWhBar").innerHTML = ""; cont.innerHTML = "";
    st.style.display = "block";
    st.innerHTML = '<div style="max-width:720px;margin:0 auto;text-align:left;line-height:1.75;color:var(--muted,#6b7280)">' +
      '<b style="color:var(--text,#1f2937)">Chưa có dữ liệu vệ sinh trong Google Sheet.</b><br>' +
      'Tab này đọc từ các sheet <code>' + esc(TAB_YC) + '</code>, <code>' + esc(TAB) + '</code>… — bộ đồng bộ <code>sync-vesinh-all.js</code> (cụm 8h40) sẽ ghi dữ liệu ' +
      'khu vực F0-A1 &amp; F0-A8 (kho SHOP - 170 QUOC LO 1A, nguồn planogram) vào đó.</div>';
    capNhatInfo();
    return;
  }
  st.style.display = "none";
  renderWhBar();
  var rows = rowsInScope();
  var nTot = rows.length;
  var nDone = rows.filter(function(r){ return r.done; }).length;
  var byArea = {}; AREAS.forEach(function(a){ byArea[a.k] = { n: 0, done: 0 }; });
  var staff = {};
  rows.forEach(function(r){
    if (!byArea[r.area]) byArea[r.area] = { n: 0, done: 0 };
    byArea[r.area].n++; if (r.done) byArea[r.area].done++;
    if (r.done && r.name) staff[r.name] = 1;
  });
  var nStaff = Object.keys(staff).length;
  var nNk = 0; if (S.nk.ok){ var em = {}; S.nk.rows.forEach(function(r){ em[r.email.toLowerCase()] = 1; }); nNk = Object.keys(em).length; }

  /* Theo khu vực (độ phủ phụ trách 45 ngày) */
  var maxA = 1; AREAS.forEach(function(a){ if (byArea[a.k]) maxA = Math.max(maxA, byArea[a.k].n); });
  var areaBars = AREAS.filter(function(a){ return byArea[a.k] && byArea[a.k].n; }).map(function(a){
    var o = byArea[a.k], wp = o.n / maxA * 100, dp = o.n ? (o.done / o.n * 100) : 0;
    return '<div class="hp-row" data-a="' + a.k + '" onclick="HPLANOGRAM.openArea(this.getAttribute(\'data-a\'))" title="Bấm xem vị trí khu vực ' + esc(a.short) + '">' +
      '<span class="hp-rl"><span class="hp-dot" style="background:' + a.c + '"></span>' + esc(a.short) + '</span>' +
      '<span class="hp-track"><span class="hp-fill" data-w="' + wp.toFixed(2) + '">' +
        '<i style="width:' + dp.toFixed(2) + '%;background:' + ST.done.c + '" title="Đã có người: ' + nf(o.done) + '"></i>' +
        '<i style="width:' + (100 - dp).toFixed(2) + '%;background:' + ST.pending.c + '" title="Chưa báo cáo: ' + nf(o.n - o.done) + '"></i>' +
      '</span></span>' +
      '<span class="hp-rv"><b>' + nf(o.done) + '/' + nf(o.n) + '</b><small>' + pct(o.done, o.n) + '%</small></span></div>';
  }).join("");
  var legend2 = '<span class="hp-legend"><span><i style="background:' + ST.done.c + '"></i>Đã có người</span><span><i style="background:' + ST.pending.c + '"></i>Chưa báo cáo</span></span>';

  /* Phụ trách vị trí — THU GỌN: chip chỉ số + nút tra cứu theo NV (tham khảo) */
  var mini =
    '<button class="hp-whtab" onclick="HPLANOGRAM.openAll()" title="Xem tất cả vị trí">Tổng vị trí <b>' + nf(nTot) + '</b></button>' +
    '<button class="hp-whtab" onclick="HPLANOGRAM.openStatus(\'done\')" title="Vị trí đã có người phụ trách"><span class="hp-dot" style="background:' + ST.done.c + '"></span>Đã có người <b>' + nf(nDone) + '</b></button>' +
    '<button class="hp-whtab" onclick="HPLANOGRAM.openStatus(\'pending\')" title="Vị trí chưa ai báo cáo vệ sinh"><span class="hp-dot" style="background:' + ST.pending.c + '"></span>Chưa báo cáo <b>' + nf(nTot - nDone) + '</b></button>';

  cont.innerHTML = '<div class="hp-grid2 hp-fade">' +
    '<section class="hp-panel"><h2>Theo khu vực <span class="hp-hint">(độ phủ người phụ trách · 45 ngày)</span>' + legend2 + '</h2><div class="hp-chart">' + areaBars + '</div></section>' +
    '<section class="hp-panel"><h2>Phụ trách vị trí <span class="hp-hint">(tham khảo)</span></h2>' +
      '<div class="hp-mini">' + mini + '</div>' +
      '<button class="hp-btn" onclick="HPLANOGRAM.openNk()"' + (S.nk.ok ? "" : " disabled") + '>Tra cứu theo nhân viên' + (nNk ? " · " + nf(nNk) : "") + '</button>' +
      '<p class="hp-hint" style="margin:10px 0 0">Xem 1 nhân viên làm việc ở đâu theo từng ngày (hôm nay F0-A8-501, mai F0-A8-504…). ' + nf(nStaff) + ' nhân viên đang phụ trách ' + nf(nDone) + ' vị trí.</p>' +
    '</section>' +
  '</div>';
  requestAnimationFrame(function(){ requestAnimationFrame(function(){
    cont.querySelectorAll(".hp-fill").forEach(function(f){ f.style.width = f.getAttribute("data-w") + "%"; });
  }); });
  if (!($id("hpToday") || {}).innerHTML) renderToday();   // YC có thể về trước PT — vẽ lại hero (kể cả hint trống)
  capNhatInfo();
}

/* --- KHỐI 3: ĐỐI CHIẾU CHẤM CÔNG (giữ nguyên khuôn — thêm: bấm dòng mở nhật ký NV) --- */
function ccSetStatus(k){ if (S.ccStatus === k) k = ""; S.ccStatus = k; renderCC(); }
function ccSearch(v){ S.ccQ = v; clearTimeout(_ccDeb); _ccDeb = setTimeout(renderCC, 130); }
function renderCC(){
  var box = $id("hpCC"); if (!box) return;
  if (!S.cc.ok){ box.innerHTML = ""; return; }
  var all = S.cc.rows;
  var cnt = { chua: 0, da: 0, nghi: 0 };
  all.forEach(function(r){ cnt[r.bk] = (cnt[r.bk] || 0) + 1; });
  var nDiLam = cnt.chua + cnt.da, nTot = all.length;

  var q = String(S.ccQ || "").trim().toLowerCase();
  var rows = all.filter(function(r){
    if (S.ccStatus && r.bk !== S.ccStatus) return false;
    if (q && ((r.name + " " + r.code + " " + r.email + " " + r.major + " " + r.loc).toLowerCase().indexOf(q) < 0)) return false;
    return true;
  });

  var tiles =
    '<div class="hp-tile tot" onclick="HPLANOGRAM.ccSetStatus(\'\')" title="Toàn đội vệ sinh"><div class="k">' + nf(nTot) + '</div><div class="l">Đội vệ sinh</div><div class="s">executor phân biệt</div></div>' +
    '<div class="hp-tile" style="--cc:#2563eb"><div class="k">' + nf(nDiLam) + '</div><div class="l">Đi làm hôm nay</div><div class="s">' + pct(nDiLam, nTot) + '% · có chấm công</div></div>' +
    '<div class="hp-tile" style="--cc:' + ccMeta("chua").c + '" onclick="HPLANOGRAM.ccSetStatus(\'chua\')" title="Đi làm nhưng chưa vệ sinh"><div class="k">' + nf(cnt.chua) + '</div><div class="l">Đi làm - chưa vệ sinh</div><div class="s">cần nhắc việc</div></div>' +
    '<div class="hp-tile" style="--cc:' + ccMeta("da").c + '" onclick="HPLANOGRAM.ccSetStatus(\'da\')" title="Đi làm và đã vệ sinh"><div class="k">' + nf(cnt.da) + '</div><div class="l">Đi làm - đã vệ sinh</div><div class="s">' + pct(cnt.da, nDiLam) + '% người đi làm</div></div>' +
    '<div class="hp-tile" style="--cc:' + ccMeta("nghi").c + '" onclick="HPLANOGRAM.ccSetStatus(\'nghi\')" title="Nghỉ / không chấm công"><div class="k">' + nf(cnt.nghi) + '</div><div class="l">Nghỉ / không chấm công</div><div class="s">' + pct(cnt.nghi, nTot) + '% đội</div></div>';

  var chips = '<span class="hp-hint" style="font-weight:650">Lọc trạng thái:</span>' +
    '<button class="hp-whtab' + (S.ccStatus ? "" : " active") + '" onclick="HPLANOGRAM.ccSetStatus(\'\')">Tất cả</button>' +
    CCST.map(function(s){
      return '<button class="hp-whtab' + (S.ccStatus === s.k ? " active" : "") + '" onclick="HPLANOGRAM.ccSetStatus(\'' + s.k + '\')"><span class="hp-dot" style="background:' + s.c + '"></span>' + esc(s.short) + ' <b>' + nf(cnt[s.k] || 0) + '</b></button>';
    }).join("");

  var body = rows.length ? rows.map(function(r){
    var m = ccMeta(r.bk);
    var badge = '<span class="hp-badge" style="background:color-mix(in srgb,' + m.c + ' 16%,transparent);color:' + (r.bk === "nghi" ? "var(--muted,#6b7280)" : m.c) + '">' + esc(r.tt || m.lb) + '</span>';
    return '<tr data-em="' + esc(r.email) + '" title="Bấm xem nhật ký vệ sinh theo ngày của ' + esc(r.name) + '" onclick="HPLANOGRAM.openNk(this.getAttribute(\'data-em\'))">' +
      '<td>' + esc(r.name) + '</td>' +
      '<td>' + (r.code ? esc(r.code) : '<span class="mut">—</span>') + '</td>' +
      '<td>' + (r.major ? esc(r.major) : '<span class="mut">—</span>') + '</td>' +
      '<td>' + (r.ci ? esc(r.ci) : '<span class="mut">—</span>') + '</td>' +
      '<td>' + (r.co ? esc(r.co) : '<span class="mut">—</span>') + '</td>' +
      '<td class="num">' + (r.vs ? nf(r.vs) : '<span class="mut">0</span>') + '</td>' +
      '<td>' + (r.loc ? esc(r.loc) : '<span class="mut">—</span>') + '</td>' +
      '<td>' + badge + '</td></tr>';
  }).join("") : '<tr><td colspan="8" class="empty">Không có nhân viên phù hợp bộ lọc.</td></tr>';

  box.innerHTML =
    '<section class="hp-panel hp-fade">' +
    '<h2>Đối chiếu chấm công hôm nay <span class="hp-hint">(đội vệ sinh × chấm công × đã vệ sinh trong ngày · bấm thẻ/chip để lọc · bấm dòng xem nhật ký NV)</span></h2>' +
    '<div class="hp-tiles">' + tiles + '</div>' +
    '<div class="hp-whbar">' + chips + '</div>' +
    '<input class="hp-ccsearch" placeholder="Tìm tên / mã / email / vị trí…" value="' + esc(S.ccQ || "") + '" oninput="HPLANOGRAM.ccSearch(this.value)">' +
    '<div class="hp-ccwrap"><table class="hp-cctbl"><thead><tr>' +
    '<th>Nhân viên</th><th>Code</th><th>Nghiệp vụ</th><th>Giờ vào</th><th>Giờ ra</th><th class="num">Đã vệ sinh</th><th>Vị trí gần nhất</th><th>Trạng thái</th>' +
    '</tr></thead><tbody>' + body + '</tbody></table></div>' +
    '<p class="hp-hint" style="margin:10px 0 0">Đang hiển thị ' + nf(rows.length) + ' / ' + nf(nTot) + ' nhân viên' + (S.cc.ts ? ' · cập nhật ' + fmtTime(S.cc.ts) : '') + '. Nguồn chấm công: timesheet HR (location 398 · Đóng gói) — chỉ đội vệ sinh SHOP-170.</p>' +
    '</section>';
}

/* ===== MODAL DRILL-DOWN — combo chain-filter (2 chế độ: loc = vị trí phụ trách · req = yêu cầu hôm nay) ===== */
var FDEF_LOC = [
  { k: "area",   lb: "Khu vực",             vals: function(r){ return [areaMeta(r.area).short]; } },
  { k: "status", lb: "Trạng thái",          vals: function(r){ return [r.done ? ST.done.lb : ST.pending.lb]; } },
  { k: "name",   lb: "Nhân viên phụ trách", vals: function(r){ return r.name ? [r.name] : []; } }
];
var FDEF_REQ = [
  { k: "area", lb: "Khu vực",   vals: function(r){ return [areaMeta(r.area).short]; } },
  { k: "bk",   lb: "Trạng thái", vals: function(r){ return [ycMeta(r.bk).lb]; } },
  { k: "ai",   lb: "AI xét duyệt", vals: function(r){ var a = aiOf(r); var m = a && aiMeta(a.kl); return m ? [m.lb] : []; } },
  { k: "pt",   lb: "Phụ trách (dự kiến)", vals: function(r){ var n = r.ptName || r.pt; return n ? [n] : []; } }
];
function fdefs(){ return MODAL.mode === "req" ? FDEF_REQ : FDEF_LOC; }
function fdefOf(k){ var F = fdefs(); for (var i = 0; i < F.length; i++) if (F[i].k === k) return F[i]; return null; }
function openAll(){ showModal(rowsInScope(), "Tất cả vị trí" + (S.area ? (" · " + areaMeta(S.area).short) : ""), null, "loc"); }
function openArea(k){ var a = areaMeta(k); showModal(S.all.filter(function(r){ return r.area === k; }), a.lb + " · " + a.short, { k: "area", raw: a.short }, "loc"); }
function openStatus(s){ var m = ST[s]; if (!m) return; showModal(rowsInScope().filter(function(r){ return s === "done" ? r.done : !r.done; }), m.lb + (S.area ? (" · " + areaMeta(S.area).short) : ""), { k: "status", raw: m.lb }, "loc"); }
function openName(n){ showModal(S.all.filter(function(r){ return r.name === n; }), "Vị trí phụ trách bởi: " + n, { k: "name", raw: n }, "loc"); }
function openYc(bk){
  var m = bk ? ycMeta(bk) : null;
  showModal(ycInScope(), (m ? m.lb : "Tất cả yêu cầu vệ sinh") + " · " + thuVN(S.yc.ngay) + " " + ngayVN(S.yc.ngay) + (S.area ? (" · " + areaMeta(S.area).short) : ""),
    m ? { k: "bk", raw: m.lb } : null, "req");
}
function openYcAi(k){
  var m = aiMeta(k); if (!m) return;
  showModal(ycInScope(), m.lb + " · " + thuVN(S.yc.ngay) + " " + ngayVN(S.yc.ngay) + (S.area ? (" · " + areaMeta(S.area).short) : ""), { k: "ai", raw: m.lb }, "req");
}
function showModal(base, title, preset, mode){
  MODAL.base = base || []; MODAL.preset = preset || null; MODAL.mode = mode || "loc";
  $id("hpMtitle").textContent = title;
  $id("hpMsub").textContent = nf(MODAL.base.length) + (MODAL.mode === "req" ? " yêu cầu" : " vị trí") + " — combo lọc sinh động, gõ để lọc, đếm số dòng";
  $id("hpMHead").innerHTML = MODAL.mode === "req" ? THEAD_REQ : THEAD_LOC;
  var pg = $id("hpMPg");
  if (MODAL.mode === "req"){ pg.style.display = ""; pg.href = pgListUrl(S.yc.ngay, S.area, ""); }
  else pg.style.display = "none";
  buildFilters();
  $id("hpMSum").textContent = "";
  $id("hpMBody").innerHTML = '<tr><td colspan="7" class="empty">Đang hiển thị…</td></tr>';
  var m = $id("hpModal"); m.style.display = "flex";
  requestAnimationFrame(function(){ m.classList.add("show"); setTimeout(mRender, 60); });
}
function closeModal(){
  var m = $id("hpModal"); m.classList.remove("show");
  setTimeout(function(){ m.style.display = "none"; $id("hpMFilters").innerHTML = ""; $id("hpMBody").innerHTML = ""; }, 240);
}
function buildFilters(){
  var rows = MODAL.base, html = "";
  fdefs().forEach(function(d){
    var uniq = new Set();
    rows.forEach(function(r){ d.vals(r).forEach(function(v){ if (v) uniq.add(v); }); });
    if (uniq.size > 1){
      html += '<div class="fld"><label>' + esc(d.lb) + '</label><div class="hp-combo" data-fk="' + d.k + '" data-lb="' + esc(d.lb) + '">' +
        '<input data-fk="' + d.k + '" autocomplete="off" placeholder="Tất cả…" oninput="HPLANOGRAM.comboInput(this)" onfocus="HPLANOGRAM.comboMenu(this.parentNode)">' +
        '<div class="hp-combo-menu"></div></div></div>';
    }
  });
  html += '<div class="fld q"><label>Tìm nhanh</label><input id="hpMQ" autocomplete="off" placeholder="Vị trí / email / mã / tên…" oninput="HPLANOGRAM.quick()"></div>';
  $id("hpMFilters").innerHTML = html;
  if (MODAL.preset){
    var p = MODAL.preset, inp = $id("hpMFilters").querySelector('.hp-combo[data-fk="' + p.k + '"] input');
    if (inp){ inp.value = p.raw; inp.setAttribute("data-exact", "1"); }
  }
}
function qval(){ return (($id("hpMQ") || {}).value || "").trim().toLowerCase(); }
function fstate(){
  return Array.prototype.slice.call(document.querySelectorAll("#hpMFilters .hp-combo input")).map(function(inp){
    var v = inp.value.trim();
    return { k: inp.getAttribute("data-fk"), raw: v, v: v.toLowerCase(), exact: !!inp.getAttribute("data-exact") };
  });
}
function quickText(r){
  return MODAL.mode === "req"
    ? (r.loc + " " + r.email + " " + r.pt + " " + r.ptName + " " + r.ptCode + " " + r.st)
    : (r.loc + " " + r.email + " " + r.code + " " + r.name);
}
function rowsWith(excludeK, state, q){
  return MODAL.base.filter(function(r){
    for (var i = 0; i < state.length; i++){ var f = state[i];
      if (f.k === excludeK || !f.v) continue;
      var d = fdefOf(f.k); if (!d) continue;
      var vs = d.vals(r).map(String);
      if (f.exact){ if (vs.indexOf(f.raw) < 0) return false; }
      else if (!vs.some(function(v){ return v.toLowerCase().indexOf(f.v) >= 0; })) return false;
    }
    if (q && (quickText(r).toLowerCase().indexOf(q) < 0)) return false;
    return true;
  });
}
function comboMenu(combo){
  var k = combo.getAttribute("data-fk"), lb = combo.getAttribute("data-lb");
  var inp = combo.querySelector("input"), menu = combo.querySelector(".hp-combo-menu");
  var uniq = new Set(), cnt = {};
  rowsWith(k, fstate(), qval()).forEach(function(r){ fdefOf(k).vals(r).forEach(function(v){ if (!v) return; uniq.add(v); cnt[v] = (cnt[v] || 0) + 1; }); });
  var typed = inp.getAttribute("data-exact") ? "" : inp.value.trim().toLowerCase();
  var items = Array.from(uniq).filter(function(v){ return !typed || v.toLowerCase().indexOf(typed) >= 0; });
  items.sort(function(a, b){ return a < b ? -1 : a > b ? 1 : 0; });
  var html = '<div class="hp-combo-item all" data-v=""><span class="nm">Tất cả ' + esc(lb) + '</span><span class="c">' + uniq.size + ' mục</span></div>';
  html += items.map(function(v){ return '<div class="hp-combo-item" data-v="' + esc(v) + '"><span class="nm">' + esc(v) + '</span><span class="c">' + nf(cnt[v]) + '</span></div>'; }).join("");
  if (!items.length) html += '<div class="hp-combo-empty">Không có mục phù hợp</div>';
  menu.innerHTML = html;
  closeCombos(combo);
  menu.classList.add("show");
}
function comboInput(inp){ inp.removeAttribute("data-exact"); comboMenu(inp.parentNode); quick(); }
function closeCombos(except){
  document.querySelectorAll("#hpMFilters .hp-combo-menu.show").forEach(function(m){ if (!except || m.parentNode !== except) m.classList.remove("show"); });
}
function quick(){ clearTimeout(_deb); _deb = setTimeout(applyF, 120); }
function applyF(){ var b = $id("hpMBody"); if (b) b.classList.add("is-filtering"); clearTimeout(_debT); _debT = setTimeout(function(){ mRender(); if (b) b.classList.remove("is-filtering"); }, 150); }
function mRender(){
  var state = fstate(), q = qval();
  var rows = rowsWith(null, state, q);
  rows = rows.slice().sort(function(a, b){ return a.loc < b.loc ? -1 : a.loc > b.loc ? 1 : 0; });
  var out = [], sum;
  if (MODAL.mode === "req"){
    var cnt = { da: 0, nhac: 0, khong: 0 };
    for (var i = 0; i < rows.length; i++){ var r = rows[i];
      cnt[r.bk]++;
      if (out.length < CAP){
        var a = areaMeta(r.area);
        var thuc = r.email ? ('<span title="' + esc(r.email) + '">' + esc(tenNm(r.email) || r.email) + '</span>') : '<span class="mut">—</span>';
        var ptTxt = r.pt
          ? ('<span title="' + esc(r.pt) + '">' + esc(r.ptName || r.pt) + '</span><small>' + (r.ptDiLam ? ("đi làm" + (r.ptCi ? " · vào " + esc(r.ptCi) : "")) : "nghỉ / không chấm công") + '</small>')
          : '<span class="mut">chưa có người nhận</span>';
        var thumbs = r.anh.length
          ? ('<span class="hp-thumbs">' +
              '<img loading="lazy" src="' + esc(r.anh[0]) + '" alt="" data-id="' + esc(r.id) + '" onclick="HPLANOGRAM.openAnh(this.getAttribute(\'data-id\'),0)" title="Xem ' + r.anh.length + ' ảnh báo cáo">' +
              (r.anh.length > 1 ? '<button class="more" data-id="' + esc(r.id) + '" onclick="HPLANOGRAM.openAnh(this.getAttribute(\'data-id\'),0)">+' + (r.anh.length - 1) + '</button>' : '') +
            '</span>')
          : '<span class="mut">—</span>';
        var ai = aiOf(r), aim = ai && aiMeta(ai.kl);
        var aiCell = aim
          ? '<span class="badge" title="' + esc((ai.lydo || "") + (ai.anhloi ? " — " + ai.anhloi : "") + (ai.tincay ? " (tin cậy " + ai.tincay + "%)" : "")) + '" style="background:color-mix(in srgb,' + aim.c + ' 15%,transparent);color:' + aim.c + '">' + esc(aim.lb.replace("AI: ", "")) + (ai.diem ? " · " + ai.diem : "") + '</span>'
          : '<span class="mut">—</span>';
        out.push('<tr>' +
          '<td><span class="hp-dot" style="background:' + a.c + '"></span> ' + esc(r.loc) + '</td>' +
          '<td>' + stBadge(r) + '</td>' +
          '<td>' + aiCell + '</td>' +
          '<td class="nm">' + thuc + '</td>' +
          '<td>' + (r.at ? esc(String(r.at).slice(11, 16) || r.at) : '<span class="mut">—</span>') + '</td>' +
          '<td class="nm">' + ptTxt + '</td>' +
          '<td>' + thumbs + '</td>' +
          '<td><a class="hp-ext" target="_blank" rel="noopener" href="' + esc(pgDetailUrl(r.id)) + '" title="Mở yêu cầu #' + esc(r.id) + ' trên planogram">Mở ↗</a></td></tr>');
      }
    }
    sum = nf(rows.length) + " / " + nf(MODAL.base.length) + " yêu cầu · Đã vệ sinh: " + nf(cnt.da) + " · Chưa (có đi làm): " + nf(cnt.nhac) + " · Không có ca: " + nf(cnt.khong);
    if (rows.length > CAP) out.push('<tr><td colspan="8" class="empty">Hiển thị ' + nf(CAP) + ' / ' + nf(rows.length) + ' dòng — dùng bộ lọc để thu hẹp.</td></tr>');
    if (!out.length) out.push('<tr><td colspan="8" class="empty">Không có dòng phù hợp</td></tr>');
  } else {
    var nDone = 0;
    for (var j = 0; j < rows.length; j++){ var r2 = rows[j];
      if (r2.done) nDone++;
      if (out.length < CAP){
        var a2 = areaMeta(r2.area);
        var badge = r2.done
          ? '<span class="badge" style="background:color-mix(in srgb,' + ST.done.c + ' 16%,transparent);color:' + ST.done.c + '">' + ST.done.lb + '</span>'
          : '<span class="badge" style="background:color-mix(in srgb,' + ST.pending.c + ' 22%,transparent);color:var(--muted,#6b7280)">' + ST.pending.lb + '</span>';
        out.push('<tr>' +
          '<td>' + esc(r2.loc) + '</td>' +
          '<td>' + (r2.email ? esc(r2.email) : '<span class="mut">—</span>') + '</td>' +
          '<td>' + (r2.code ? esc(r2.code) : '<span class="mut">—</span>') + '</td>' +
          '<td class="nm">' + (r2.name ? esc(r2.name) : '<span class="mut">—</span>') + '</td>' +
          '<td><span class="hp-dot" style="background:' + a2.c + '"></span> ' + esc(a2.short) + '</td>' +
          '<td>' + badge + '</td></tr>');
      }
    }
    sum = nf(rows.length) + " / " + nf(MODAL.base.length) + " vị trí · Đã có người: " + nf(nDone) + " · Chưa báo cáo: " + nf(rows.length - nDone);
    if (rows.length > CAP) out.push('<tr><td colspan="6" class="empty">Hiển thị ' + nf(CAP) + ' / ' + nf(rows.length) + ' dòng — dùng bộ lọc để thu hẹp.</td></tr>');
    if (!out.length) out.push('<tr><td colspan="6" class="empty">Không có dòng phù hợp</td></tr>');
  }
  $id("hpMBody").innerHTML = out.join("");
  var nAct = state.filter(function(f){ return f.v; }).length + (q ? 1 : 0);
  $id("hpMSum").textContent = sum + (nAct ? (" · " + nAct + " bộ lọc đang áp dụng") : "");
}
/* Ảnh báo cáo → LIGHTBOX CAROUSEL của host (openLB) */
function openAnh(id, i){
  var r = null;
  for (var j = 0; j < S.yc.rows.length; j++) if (String(S.yc.rows[j].id) === String(id)){ r = S.yc.rows[j]; break; }
  if (!r || !r.anh.length) return;
  var list = r.anh.map(function(u){ return { type: "img", url: u }; });
  if (typeof window.openLB === "function") window.openLB(list, i || 0);
  else window.open(r.anh[i || 0], "_blank", "noopener");
}

/* ===== POP-UP TRA CỨU THEO NHÂN VIÊN (nhật ký theo ngày, tab VESINH-NHATKY) ===== */
function nkStaff(){
  var by = {};
  S.nk.rows.forEach(function(r){
    var k = r.email.toLowerCase();
    var o = by[k] || (by[k] = { email: r.email, code: r.code, name: r.name || tenNm(r.email) || r.email, nLoc: 0, days: {}, last: "" });
    o.nLoc += r.locs.length; o.days[r.ngay] = 1;
    if (r.ngay > o.last) o.last = r.ngay;
    if (!o.name && r.name) o.name = r.name;
  });
  return Object.keys(by).map(function(k){ var o = by[k]; o.nDay = Object.keys(o.days).length; return o; })
    .sort(function(a, b){ return b.last < a.last ? -1 : b.last > a.last ? 1 : (b.nLoc - a.nLoc); });
}
function openNk(email){
  if (!S.nk.ok || !S.nk.rows.length) return;
  NK.email = String(email || "").toLowerCase(); NK.q = "";
  var inp = $id("hpNkQ"); if (inp) inp.value = "";
  var list = nkStaff();
  if (!NK.email && list.length) NK.email = list[0].email.toLowerCase();
  renderNkList(); renderNkRight();
  var m = $id("hpNkModal"); m.style.display = "flex";
  requestAnimationFrame(function(){ m.classList.add("show"); });
}
function closeNk(){
  var m = $id("hpNkModal"); m.classList.remove("show");
  setTimeout(function(){ m.style.display = "none"; }, 240);
}
function nkSearch(v){ NK.q = String(v || "").trim().toLowerCase(); clearTimeout(_nkDeb); _nkDeb = setTimeout(renderNkList, 130); }
function nkPick(email){ NK.email = String(email || "").toLowerCase(); renderNkList(); renderNkRight(); }
function renderNkList(){
  var el = $id("hpNkList"); if (!el) return;
  var list = nkStaff().filter(function(o){
    return !NK.q || (o.name + " " + o.code + " " + o.email).toLowerCase().indexOf(NK.q) >= 0;
  });
  el.innerHTML = list.length ? list.map(function(o){
    var act = o.email.toLowerCase() === NK.email;
    return '<div class="hp-nk-item' + (act ? " active" : "") + '" data-em="' + esc(o.email) + '" onclick="HPLANOGRAM.nkPick(this.getAttribute(\'data-em\'))">' +
      '<span class="nm"><span class="hp-dot" style="background:' + nmColor(o.name) + ';margin-right:6px"></span>' + esc(o.name) + '<small>' + esc(o.code || o.email) + '</small></span>' +
      '<span class="c">' + nf(o.nLoc) + ' vị trí<br>' + nf(o.nDay) + ' ngày</span></div>';
  }).join("") : '<div class="hp-nk-empty">Không tìm thấy nhân viên.</div>';
}
function renderNkRight(){
  var el = $id("hpNkRight"); if (!el) return;
  var rows = S.nk.rows.filter(function(r){ return r.email.toLowerCase() === NK.email; });
  if (!rows.length){ el.innerHTML = '<div class="hp-nk-empty">Chọn 1 nhân viên bên trái để xem nhật ký vệ sinh theo ngày.</div>'; return; }
  var o = { name: rows[0].name || tenNm(rows[0].email) || rows[0].email, code: rows[0].code, email: rows[0].email };
  /* gom theo ngày (giảm dần) → từng khu vực */
  var byDay = {};
  rows.forEach(function(r){
    var d = byDay[r.ngay] || (byDay[r.ngay] = {});
    var arr = d[r.area] || (d[r.area] = []);
    arr.push.apply(arr, r.locs);
  });
  var days = Object.keys(byDay).sort().reverse();
  var homNay = isoToday();
  var nLoc = 0; rows.forEach(function(r){ nLoc += r.locs.length; });
  var html = '<div class="hd">' + esc(o.name) + (o.code ? ' <span class="hp-hint">' + esc(o.code) + '</span>' : '') + '</div>' +
    '<div class="sub">' + esc(o.email) + ' · ' + nf(nLoc) + ' lượt vị trí / ' + nf(days.length) + ' ngày (45 ngày gần nhất). Quầy kệ F0-A1 thường giữ theo tuần · không gian F0-A8 đổi theo ngày.</div>';
  html += days.map(function(d){
    var khu = byDay[d];
    return '<div class="hp-nk-day"><div class="d">' + thuVN(d) + ' ' + ngayVN(d) + (d === homNay ? ' <span class="today">Hôm nay</span>' : '') + '</div>' +
      AREAS.filter(function(a){ return khu[a.k] && khu[a.k].length; }).map(function(a){
        return '<div class="hp-nk-khu"><span class="hp-dot kdot" title="' + esc(a.short) + '" style="background:' + a.c + '"></span><span>' +
          khu[a.k].sort().map(function(L){
            return '<a class="hp-nk-loc" target="_blank" rel="noopener" title="Mở planogram vị trí ' + esc(L) + ' ngày ' + ngayVN(d) + '" href="' + esc(pgListUrlLoc(d, L)) + '">' + esc(L) + '</a>';
          }).join("") + '</span></div>';
      }).join("") + '</div>';
  }).join("");
  el.innerHTML = html;
}
function pgListUrlLoc(isoNgay, locDesc){
  var m = String(isoNgay || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  var d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date();
  var f = d.getTime(), t = f + 86399999;
  return PG_BASE + "/list?company_ids=1001&warehouse_ids=863&keyword_type=sku_or_barcode&page=1&size=100&from_date=" + f + "&to_date=" + t + "&location_description=" + encodeURIComponent(locDesc);
}

/* ===== INIT (host gọi mỗi lần mở tab — idempotent) ===== */
var _booted = false;
function init(pane){
  PANE = pane;
  if (!_booted){
    _booted = true;
    var style = document.createElement("style"); style.id = "hp-css"; style.textContent = CSS;
    document.head.appendChild(style);
    var wrap = document.createElement("div"); wrap.innerHTML = MODAL_HTML;
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
    $id("hpModal").addEventListener("click", function(e){ if (e.target === this) closeModal(); });
    $id("hpNkModal").addEventListener("click", function(e){ if (e.target === this) closeNk(); });
    $id("hpMFilters").addEventListener("click", function(e){
      var it = e.target.closest(".hp-combo-item"); if (!it) return;
      var inp = it.closest(".hp-combo").querySelector("input");
      inp.value = it.getAttribute("data-v") || "";
      if (inp.value) inp.setAttribute("data-exact", "1"); else inp.removeAttribute("data-exact");
      closeCombos(); applyF();
    });
    document.addEventListener("click", function(e){ if (!e.target.closest("#hpMFilters .hp-combo")) closeCombos(); });
    pane.innerHTML = KHUNG;
    loadData();
    return;
  }
  if (!pane.querySelector("#hpContent")){ pane.innerHTML = KHUNG; render(); renderToday(); renderCC(); capNhatInfo(); }
  if (Date.now() - S.lastAt > STALE_MS) loadData();
}

window.HPLANOGRAM = {
  init: init, reload: loadData, setArea: setArea,
  openAll: openAll, openArea: openArea, openStatus: openStatus, openName: openName, openYc: openYc, openYcAi: openYcAi, closeModal: closeModal,
  comboInput: comboInput, comboMenu: comboMenu, quick: quick, openAnh: openAnh,
  openNk: openNk, closeNk: closeNk, nkPick: nkPick, nkSearch: nkSearch,
  ccSetStatus: ccSetStatus, ccSearch: ccSearch
};
})();
