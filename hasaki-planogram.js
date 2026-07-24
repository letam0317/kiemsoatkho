/**
 * ============================================================================
 *  hasaki-planogram.js — MODULE "PLANOGRAM" (vệ sinh quầy kệ & không gian làm việc)
 * ============================================================================
 *  Theo dõi PHỤ TRÁCH vệ sinh của kho SHOP - 170 QUOC LO 1A theo nguồn planogram
 *  (request-of-declaration). Đọc tab "PHU-TRACH-QUAY-KE" trên Google Sheet 5S
 *  (bộ sync-vesinh-all.js ghi, cụm 8h40) — mỗi vị trí F0-A1 (vệ sinh tủ quầy
 *  kệ) + F0-A8 (vệ sinh không gian làm việc) kèm người phụ trách gần nhất.
 *
 *  Bê NGUYÊN thiết kế/độ mượt/pop-up/bộ lọc của tab "Tồn kho bất thường"
 *  (hasaki-tonbatthuong.js) để đồng bộ tuyệt đối:
 *   - Closure kín, CHỈ lộ window.HPLANOGRAM.
 *   - id/class DOM tiền tố hp- ; CSS bơm 1 lần, neo #pane-planogram / .hp-modal.
 *   - Màu dùng CSS variables portal (--panel/--text/--muted/--line/--accent).
 *   - Thẻ chỉ số bấm được · 2 chart · pop-up combo chain-filter (gõ lọc, đếm dòng).
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
var TAB_CC = "CHAMCONG-VESINH";     // đối chiếu chấm công × vệ sinh hôm nay (bộ sync-vesinh-all.js)
var APPSCRIPT_URL = "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
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

/* ===== STATE ===== */
var S = { ok: false, all: [], area: "", lastAt: 0, tsData: 0, cc: { ok: false, rows: [], ts: 0 }, ccStatus: "", ccQ: "" };
var MODAL = { base: [], preset: null };
var PANE = null, _nmColor = {}, _nmCi = 0, _deb = null, _debT = null, _ccDeb = null;

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

/* ===== CSS — bơm 1 lần, neo #pane-planogram / .hp-modal (khuôn ht-*) ===== */
var CSS = [
"#pane-planogram .hp-srcbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:14px 0 10px;font-size:12.5px;}",
"#pane-planogram .hp-chip{background:color-mix(in srgb, var(--accent,#2563eb) 14%, transparent);color:var(--accent,#1e40af);border-radius:999px;padding:4px 13px;font-weight:650;font-size:12px;}",
"#pane-planogram .hp-srcbar a{color:var(--accent,#2563eb);text-decoration:none;font-weight:600;} #pane-planogram .hp-srcbar a:hover{text-decoration:underline;}",
"#pane-planogram .hp-hint{color:var(--muted,#9ca3af);font-size:11.5px;font-weight:400;}",
"#hpReload{background:var(--accent,#1f2937);color:var(--accent-text,#fff);border:0;border-radius:9px;padding:8px 15px;font-size:12.5px;font-weight:650;cursor:pointer;min-height:36px;}",
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
"#pane-planogram .hp-grid2{display:grid;grid-template-columns:1.55fr 1fr;gap:12px;}",
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
/* panel đối chiếu chấm công */
"#pane-planogram .hp-cc{margin-top:12px;}",
"#pane-planogram .hp-ccsearch{width:100%;max-width:340px;padding:9px 11px;border:1px solid var(--border,#d5dbe4);border-radius:9px;font-size:12.5px;background:var(--surface,#fff);color:var(--text,#1f2937);min-height:36px;margin:2px 0 10px;}",
"#pane-planogram .hp-ccsearch:focus{outline:0;border-color:var(--accent,#2563eb);}",
"#pane-planogram .hp-ccwrap{overflow-x:auto;-webkit-overflow-scrolling:touch;max-height:520px;overflow-y:auto;border:1px solid var(--border,#e8ecf1);border-radius:12px;}",
"#pane-planogram .hp-cctbl{width:100%;border-collapse:collapse;font-size:12.5px;color:var(--text,#1f2937);min-width:720px;}",
"#pane-planogram .hp-cctbl thead th{position:sticky;top:0;background:var(--accent,#1f2937);color:var(--accent-text,#fff);padding:9px 11px;text-align:left;font-weight:600;font-size:11px;z-index:1;white-space:nowrap;}",
"#pane-planogram .hp-cctbl td{padding:8px 11px;border-bottom:1px solid var(--border,#f1f4f8);white-space:nowrap;}",
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
".hp-modalhd{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border,#e8ecf1);}",
".hp-modalhd .mt{font-weight:700;font-size:15.5px;} .hp-modalhd .mtsub{font-size:11.5px;color:var(--muted,#9ca3af);margin-top:2px;}",
".hp-mclose{background:0;border:0;font-size:24px;line-height:1;cursor:pointer;color:var(--muted,#9ca3af);padding:6px 10px;border-radius:8px;min-width:44px;min-height:40px;}",
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
"@media(max-width:768px){.hp-modal{padding:0;align-items:stretch;justify-content:stretch;}.hp-modalbox{width:100vw!important;max-height:100vh!important;height:100vh;border-radius:0;}.hp-mclose{font-size:30px;min-width:48px;min-height:48px;}.hp-mfilters input{min-height:44px;}#pane-planogram .hp-whtab{min-height:44px;}#hpReload{min-height:44px;width:100%;}}",
].join("\n");

/* ===== KHUNG HTML ===== */
var KHUNG =
'<div class="hp-srcbar">' +
'  <span class="hp-chip">Phụ trách vệ sinh — SHOP - 170 QUOC LO 1A · khu vực F0-A1 &amp; F0-A8</span>' +
'  <a href="' + SHEET_URL + '" target="_blank" rel="noopener">Mở Google Sheet</a>' +
'  <span id="hpLoadinfo" class="hp-hint"></span>' +
'  <button id="hpReload" onclick="HPLANOGRAM.reload()" title="Đọc lại dữ liệu mới nhất từ Google Sheet">Làm mới</button>' +
'</div>' +
'<p class="hp-hint" style="margin:0 0 10px">Nguồn: <b>planogram</b> (request-of-declaration). Khi nhân viên báo hoàn tất vệ sinh (trạng thái New → Chờ duyệt), hệ thống lấy <b>người báo cáo gần nhất</b> làm phụ trách vị trí — bộ đồng bộ <code>sync-vesinh-all.js</code> (cụm 8h40) ghi vào tab <code>' + TAB + '</code>.</p>' +
'<div class="hp-whbar" id="hpWhBar"></div>' +
'<div id="hpContent"></div>' +
'<div id="hpCC" class="hp-cc"></div>' +
'<div id="hpState" class="hp-state"><div class="hp-spin"></div>Đang tải dữ liệu phụ trách vệ sinh…</div>';

var MODAL_HTML =
'<div id="hpModal" class="hp-modal">' +
'  <div class="hp-modalbox">' +
'    <div class="hp-modalhd"><div><div class="mt" id="hpMtitle"></div><div class="mtsub" id="hpMsub"></div></div>' +
'      <button class="hp-mclose" onclick="HPLANOGRAM.closeModal()">&times;</button></div>' +
'    <div class="hp-mfilters" id="hpMFilters"></div>' +
'    <div class="hp-msum" id="hpMSum"></div>' +
'    <div class="hp-modalbody"><table class="hp-mtbl"><thead><tr>' +
'      <th>Location</th><th>Executed By</th><th>Code</th><th class="nm">Name</th><th>Khu vực</th><th>Trạng thái</th>' +
'    </tr></thead><tbody id="hpMBody"></tbody></table></div>' +
'  </div>' +
'</div>';

/* ===== TẢI DỮ LIỆU — ưu tiên GAS readTab (SHEET PRIVATE bí mật), fallback gviz (sheet public cũ) ===== */
function injectJSONP(url, id, onerr){
  var old = $id(id); if (old) old.remove();
  var sc = document.createElement("script"); sc.id = id; sc.src = url;
  sc.onerror = function(){ onerr && onerr(); };
  document.body.appendChild(sc);
}
function gvizHeader(resp){ return ((resp.table && resp.table.cols) || []).map(function(c){ return (c && c.label) || ""; }); }
function gvizRows(resp){ return ((resp.table && resp.table.rows) || []).map(function(r){ return (r.c || []).map(function(c){ return (c && c.v != null) ? c.v : ""; }); }); }
function loadData(){
  var st = $id("hpState"); if (!st) return;
  var btn = $id("hpReload"); if (btn) btn.disabled = true;
  st.style.display = "block";
  st.innerHTML = '<div class="hp-spin"></div>Đang tải dữ liệu phụ trách vệ sinh…';
  $id("hpContent").innerHTML = ""; $id("hpWhBar").innerHTML = "";
  S.lastAt = Date.now();
  window.hpgv_pt = function(j){
    if (j && j.status === "success" && j.header && j.header.length){
      if (Number(j.ts) > 0) S.tsData = Number(j.ts);
      buildMain(j.header, j.rows || []); capNhatInfo(); loadCC();
    } else { loadDataGviz(); }
  };
  injectJSONP(APPSCRIPT_URL + "?action=readTab&tab=" + encodeURIComponent(TAB) + "&callback=hpgv_pt&_=" + Date.now(), "hp_sc_pt", loadDataGviz);
}
function loadDataGviz(){
  window.hpgv_data = function(resp){
    if (!resp || resp.status === "error"){ S.ok = false; render(); }
    else buildMain(gvizHeader(resp), gvizRows(resp));
  };
  var url = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq?tqx=out:json;responseHandler:hpgv_data&sheet=" + encodeURIComponent(TAB) + "&headers=1";
  injectJSONP(url, "hp_sc_data", function(){ S.ok = false; render(); });
  loadMeta();
  loadCC();
}
/* ===== ĐỐI CHIẾU CHẤM CÔNG — ưu tiên GAS readTab (private), fallback gviz ===== */
function loadCC(){
  window.hpgv_cc2 = function(j){
    if (j && j.status === "success" && j.header && j.header.length){
      if (Number(j.ts) > 0) S.cc.ts = Number(j.ts);
      buildCC(j.header, j.rows || []);
    } else { loadCCGviz(); }
  };
  injectJSONP(APPSCRIPT_URL + "?action=readTab&tab=" + encodeURIComponent(TAB_CC) + "&callback=hpgv_cc2&_=" + Date.now(), "hp_sc_cc", loadCCGviz);
}
function loadCCGviz(){
  window.hpgv_cc = function(resp){
    if (!resp || resp.status === "error"){ S.cc.ok = false; renderCC(); }
    else buildCC(gvizHeader(resp), gvizRows(resp));
  };
  var url = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq?tqx=out:json;responseHandler:hpgv_cc&sheet=" + encodeURIComponent(TAB_CC) + "&headers=1";
  injectJSONP(url, "hp_sc_ccg", function(){ S.cc.ok = false; renderCC(); });
  window.hpgv_ccmeta = function(j){ try{ if (j && j.status === "success" && Number(j.ts) > 0){ S.cc.ts = Number(j.ts); renderCC(); } }catch(e){} };
  injectJSONP(APPSCRIPT_URL + "?action=lastSync&tab=" + encodeURIComponent(TAB_CC) + "&callback=hpgv_ccmeta", "hp_sc_ccmeta");
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
    arr.push({ code: String(gv(idx.code) || "").trim(), name: name, email: String(gv(idx.email) || "").trim(),
      major: String(gv(idx.major) || "").trim(), ci: fmtHM(gv(idx.ci)), co: fmtHM(gv(idx.co)),
      vs: Number(gv(idx.vs)) || 0, loc: String(gv(idx.loc) || "").trim(), tt: tt, bk: ccBucket(tt) });
  });
  S.cc.ok = true; S.cc.rows = arr; renderCC();
}
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
    return '<tr>' +
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
    '<h2>Đối chiếu chấm công hôm nay <span class="hp-hint">(đội vệ sinh × chấm công × đã vệ sinh trong ngày · bấm thẻ/chip để lọc)</span></h2>' +
    '<div class="hp-tiles">' + tiles + '</div>' +
    '<div class="hp-whbar">' + chips + '</div>' +
    '<input class="hp-ccsearch" placeholder="Tìm tên / mã / email / vị trí…" value="' + esc(S.ccQ || "") + '" oninput="HPLANOGRAM.ccSearch(this.value)">' +
    '<div class="hp-ccwrap"><table class="hp-cctbl"><thead><tr>' +
    '<th>Nhân viên</th><th>Code</th><th>Nghiệp vụ</th><th>Giờ vào</th><th>Giờ ra</th><th class="num">Đã vệ sinh</th><th>Vị trí gần nhất</th><th>Trạng thái</th>' +
    '</tr></thead><tbody>' + body + '</tbody></table></div>' +
    '<p class="hp-hint" style="margin:10px 0 0">Đang hiển thị ' + nf(rows.length) + ' / ' + nf(nTot) + ' nhân viên' + (S.cc.ts ? ' · cập nhật ' + fmtTime(S.cc.ts) : '') + '. Nguồn chấm công: timesheet HR (location 398 · Đóng gói) — chỉ đội vệ sinh SHOP-170.</p>' +
    '</section>';
}
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
    arr.push({ loc: loc, area: a.k, email: email,
      code: String(gv(idx.code) || "").trim(), name: String(gv(idx.name) || "").trim(),
      done: !!email });
  });
  S.ok = true; S.all = arr; render();
}
/* Chip giờ dữ liệu: hỏi GAS lastSync (mốc apiAt lúc bộ sync ghi) — JSONP */
function loadMeta(){
  window.hpgv_last = function(j){ try{ if (j && j.status === "success" && Number(j.ts) > 0){ S.tsData = Number(j.ts); capNhatInfo(); } }catch(e){} };
  var old = $id("hp_sc_meta"); if (old) old.remove();
  var sc = document.createElement("script"); sc.id = "hp_sc_meta";
  sc.src = APPSCRIPT_URL + "?action=lastSync&tab=" + encodeURIComponent(TAB) + "&callback=hpgv_last";
  sc.onerror = function(){};
  document.body.appendChild(sc);
}
function capNhatInfo(){
  var el = $id("hpLoadinfo"); if (!el) return;
  var n = S.all.length;
  el.textContent = (n ? nf(n) + " vị trí" : "") + (S.tsData ? (n ? " · " : "") + "cập nhật " + fmtTime(S.tsData) : "");
}

/* ===== LỌC + RENDER ===== */
function rowsInScope(){ return S.all.filter(function(r){ return !S.area || r.area === S.area; }); }
function setArea(a){ if (S.area === a) a = ""; S.area = a; render(); }
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
function render(){
  var st = $id("hpState"), cont = $id("hpContent");
  if (!st || !cont) return;
  var btn = $id("hpReload"); if (btn) btn.disabled = false;
  if (!S.ok){
    $id("hpWhBar").innerHTML = ""; cont.innerHTML = "";
    st.style.display = "block";
    st.innerHTML = '<div style="max-width:720px;margin:0 auto;text-align:left;line-height:1.75;color:var(--muted,#6b7280)">' +
      '<b style="color:var(--text,#1f2937)">Chưa có dữ liệu phụ trách vệ sinh trong Google Sheet.</b><br>' +
      'Tab này đọc từ sheet <code>' + esc(TAB) + '</code> — bộ đồng bộ <code>sync-vesinh-all.js</code> (cụm 8h40) sẽ ghi người phụ trách vệ sinh ' +
      'khu vực F0-A1 &amp; F0-A8 (kho SHOP - 170 QUOC LO 1A, nguồn planogram) vào đó.</div>';
    capNhatInfo();
    return;
  }
  st.style.display = "none";
  renderWhBar();
  var rows = rowsInScope();
  var nTot = rows.length;
  var nDone = rows.filter(function(r){ return r.done; }).length;
  var nPend = nTot - nDone;
  var byArea = {}; AREAS.forEach(function(a){ byArea[a.k] = { n: 0, done: 0 }; });
  var staff = {};   // name -> { n, code, email }
  rows.forEach(function(r){
    if (!byArea[r.area]) byArea[r.area] = { n: 0, done: 0 };
    byArea[r.area].n++; if (r.done) byArea[r.area].done++;
    if (r.done && r.name){ var s = staff[r.name] || (staff[r.name] = { n: 0, code: r.code, email: r.email }); s.n++; }
  });
  var nStaff = Object.keys(staff).length;

  /* Thẻ chỉ số */
  var tiles =
    '<div class="hp-tile tot" onclick="HPLANOGRAM.openAll()" title="Xem tất cả vị trí"><div class="k">' + nf(nTot) + '</div><div class="l">Tổng vị trí</div><div class="s">' + (S.area ? esc(areaMeta(S.area).short) : "F0-A1 + F0-A8") + '</div></div>' +
    '<div class="hp-tile" style="--cc:' + ST.done.c + '" onclick="HPLANOGRAM.openStatus(\'done\')" title="Vị trí đã có người phụ trách"><div class="k">' + nf(nDone) + '</div><div class="l">Đã có người phụ trách</div><div class="s">' + pct(nDone, nTot) + '% · ' + nf(nStaff) + ' nhân viên</div></div>' +
    '<div class="hp-tile" style="--cc:' + ST.pending.c + '" onclick="HPLANOGRAM.openStatus(\'pending\')" title="Vị trí chưa ai báo cáo vệ sinh"><div class="k">' + nf(nPend) + '</div><div class="l">Chưa báo cáo</div><div class="s">' + pct(nPend, nTot) + '% tổng vị trí</div></div>' +
    AREAS.filter(function(a){ return byArea[a.k] && byArea[a.k].n; }).map(function(a){
      var o = byArea[a.k];
      return '<div class="hp-tile" style="--cc:' + a.c + '" data-a="' + a.k + '" onclick="HPLANOGRAM.openArea(this.getAttribute(\'data-a\'))" title="' + esc(a.lb) + '"><div class="k">' + nf(o.n) + '</div><div class="l">' + esc(a.short) + '</div><div class="s">' + nf(o.done) + ' đã có người · ' + pct(o.done, o.n) + '%</div></div>';
    }).join("");

  var html = '<div class="hp-tiles">' + tiles + '</div>';
  if (!nTot){
    html += '<section class="hp-panel"><div class="hp-empty">Không có vị trí trong phạm vi' + (S.area ? (' “' + esc(areaMeta(S.area).short) + '”') : ' này') + '.</div></section>';
    cont.innerHTML = html; capNhatInfo(); return;
  }

  /* Chart 1 — theo nhân viên phụ trách (số vị trí đảm nhận) */
  var names = Object.keys(staff).sort(function(a, b){ return staff[b].n - staff[a].n; });
  var maxN = 1; names.forEach(function(n){ maxN = Math.max(maxN, staff[n].n); });
  var staffBars = names.length ? names.map(function(n){
    var o = staff[n], wp = o.n / maxN * 100;
    return '<div class="hp-row" data-n="' + esc(n) + '" onclick="HPLANOGRAM.openName(this.getAttribute(\'data-n\'))" title="Bấm xem vị trí của ' + esc(n) + '">' +
      '<span class="hp-rl"><span class="hp-dot" style="background:' + nmColor(n) + '"></span>' + esc(n) + (o.code ? ' <span class="hp-hint">' + esc(o.code) + '</span>' : "") + '</span>' +
      '<span class="hp-track"><span class="hp-fill" data-w="' + wp.toFixed(2) + '" style="background:' + nmColor(n) + '"></span></span>' +
      '<span class="hp-rv"><b>' + nf(o.n) + '</b><small>vị trí</small></span></div>';
  }).join("") : '<div class="hp-empty">Chưa có nhân viên nào báo cáo vệ sinh trong phạm vi này.</div>';

  /* Chart 2 — theo khu vực (đã có người / chưa báo cáo) */
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

  html += '<div class="hp-grid2 hp-fade">' +
    '<section class="hp-panel"><h2>Theo nhân viên phụ trách <span class="hp-hint">(số vị trí đảm nhận · bấm để xem)</span></h2><div class="hp-chart">' + staffBars + '</div></section>' +
    '<section class="hp-panel"><h2>Theo khu vực ' + legend2 + '</h2><div class="hp-chart">' + areaBars + '</div></section>' +
  '</div>';
  cont.innerHTML = html;
  requestAnimationFrame(function(){ requestAnimationFrame(function(){
    cont.querySelectorAll(".hp-fill").forEach(function(f){ f.style.width = f.getAttribute("data-w") + "%"; });
  }); });
  capNhatInfo();
}

/* ===== MODAL DRILL-DOWN — combo chain-filter (khuôn pop-up tồn bất thường) ===== */
var FDEF = [
  { k: "area",   lb: "Khu vực",             vals: function(r){ return [areaMeta(r.area).short]; } },
  { k: "status", lb: "Trạng thái",          vals: function(r){ return [r.done ? ST.done.lb : ST.pending.lb]; } },
  { k: "name",   lb: "Nhân viên phụ trách", vals: function(r){ return r.name ? [r.name] : []; } }
];
function fdefOf(k){ for (var i = 0; i < FDEF.length; i++) if (FDEF[i].k === k) return FDEF[i]; return null; }
function openAll(){ showModal(rowsInScope(), "Tất cả vị trí" + (S.area ? (" · " + areaMeta(S.area).short) : ""), null); }
function openArea(k){ var a = areaMeta(k); showModal(S.all.filter(function(r){ return r.area === k; }), a.lb + " · " + a.short, { k: "area", raw: a.short }); }
function openStatus(s){ var m = ST[s]; if (!m) return; showModal(rowsInScope().filter(function(r){ return s === "done" ? r.done : !r.done; }), m.lb + (S.area ? (" · " + areaMeta(S.area).short) : ""), { k: "status", raw: m.lb }); }
function openName(n){ showModal(S.all.filter(function(r){ return r.name === n; }), "Vị trí phụ trách bởi: " + n, { k: "name", raw: n }); }
function showModal(base, title, preset){
  MODAL.base = base || []; MODAL.preset = preset || null;
  $id("hpMtitle").textContent = title;
  $id("hpMsub").textContent = nf(MODAL.base.length) + " vị trí — combo lọc sinh động, gõ để lọc, đếm số dòng";
  buildFilters();
  $id("hpMSum").textContent = "";
  $id("hpMBody").innerHTML = '<tr><td colspan="6" class="empty">Đang hiển thị…</td></tr>';
  var m = $id("hpModal"); m.style.display = "flex";
  requestAnimationFrame(function(){ m.classList.add("show"); setTimeout(mRender, 60); });
}
function closeModal(){
  var m = $id("hpModal"); m.classList.remove("show");
  setTimeout(function(){ m.style.display = "none"; $id("hpMFilters").innerHTML = ""; $id("hpMBody").innerHTML = ""; }, 240);
}
function buildFilters(){
  var rows = MODAL.base, html = "";
  FDEF.forEach(function(d){
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
function rowsWith(excludeK, state, q){
  return MODAL.base.filter(function(r){
    for (var i = 0; i < state.length; i++){ var f = state[i];
      if (f.k === excludeK || !f.v) continue;
      var vs = fdefOf(f.k).vals(r).map(String);
      if (f.exact){ if (vs.indexOf(f.raw) < 0) return false; }
      else if (!vs.some(function(v){ return v.toLowerCase().indexOf(f.v) >= 0; })) return false;
    }
    if (q && ((r.loc + " " + r.email + " " + r.code + " " + r.name).toLowerCase().indexOf(q) < 0)) return false;
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
  var out = [], nDone = 0;
  for (var i = 0; i < rows.length; i++){ var r = rows[i];
    if (r.done) nDone++;
    if (out.length < CAP){
      var a = areaMeta(r.area);
      var badge = r.done
        ? '<span class="badge" style="background:color-mix(in srgb,' + ST.done.c + ' 16%,transparent);color:' + ST.done.c + '">' + ST.done.lb + '</span>'
        : '<span class="badge" style="background:color-mix(in srgb,' + ST.pending.c + ' 22%,transparent);color:var(--muted,#6b7280)">' + ST.pending.lb + '</span>';
      out.push('<tr>' +
        '<td>' + esc(r.loc) + '</td>' +
        '<td>' + (r.email ? esc(r.email) : '<span class="mut">—</span>') + '</td>' +
        '<td>' + (r.code ? esc(r.code) : '<span class="mut">—</span>') + '</td>' +
        '<td class="nm">' + (r.name ? esc(r.name) : '<span class="mut">—</span>') + '</td>' +
        '<td><span class="hp-dot" style="background:' + a.c + '"></span> ' + esc(a.short) + '</td>' +
        '<td>' + badge + '</td></tr>');
    }
  }
  if (rows.length > CAP) out.push('<tr><td colspan="6" class="empty">Hiển thị ' + nf(CAP) + ' / ' + nf(rows.length) + ' dòng — dùng bộ lọc để thu hẹp.</td></tr>');
  $id("hpMBody").innerHTML = out.length ? out.join("") : '<tr><td colspan="6" class="empty">Không có dòng phù hợp</td></tr>';
  var nAct = state.filter(function(f){ return f.v; }).length + (q ? 1 : 0);
  $id("hpMSum").textContent = nf(rows.length) + " / " + nf(MODAL.base.length) + " vị trí" + (nAct ? (" · " + nAct + " bộ lọc đang áp dụng") : "") + " · Đã có người: " + nf(nDone) + " · Chưa báo cáo: " + nf(rows.length - nDone);
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
  if (!pane.querySelector("#hpContent")){ pane.innerHTML = KHUNG; render(); capNhatInfo(); }
  if (Date.now() - S.lastAt > STALE_MS) loadData();
}

window.HPLANOGRAM = {
  init: init, reload: loadData, setArea: setArea,
  openAll: openAll, openArea: openArea, openStatus: openStatus, openName: openName, closeModal: closeModal,
  comboInput: comboInput, comboMenu: comboMenu, quick: quick,
  ccSetStatus: ccSetStatus, ccSearch: ccSearch
};
})();
