/* hasaki-baoduong.js — Audit Retail › Tài sản › Bảo dưỡng (27/10/2026). Module LAZY, khuôn hasaki-tonbatthuong / hasaki-kiemke.
 *
 *  User 27/10: «tạo hạng mục Tài sản tương đương Xác minh / Tồn kho — mục con Bảo dưỡng — dashboard theo dõi theo dữ liệu gốc g-sheet
 *  (MỤC LỤC: STT · HẠNG MỤC · TẦN SUẤT CHÍNH · NGƯỜI THỰC HIỆN · SKU · SỐ ĐẦU VIỆC · VẬN HÀNH · VẬN HÀNH + BẢO TRÌ · BẢO TRÌ ·
 *  KỸ THUẬT CƠ ĐIỆN · GHI CHÚ) — yêu cầu dữ liệu theo sát các mục đã nêu ở g-sheet».
 *
 *  Nguồn: sync-bao-duong.mjs chép NGUYÊN 2 tab của g-sheet (không thêm/bớt/đổi cột) vào sheet RIÊNG:
 *    BAO-DUONG-MUC-LUC  (11 cột MỤC LỤC + «G-sheet sửa lúc») · BAO-DUONG-DAU-VIEC (đủ cột bảng chi tiết BAO-DUONG-170).
 *  Đọc bằng Apps Script readTab (khoá thiết bị / phiên tài khoản) — bảng có tên người phụ trách nên KHÔNG để ở sheet công khai.
 *  Tải upstream: 0 lượt WMS/work/hr. Trang chỉ HIỆN đúng số g-sheet; chỗ g-sheet tự lệch (MỤC LỤC ≠ bảng chi tiết) thì đánh ⚠, không tự sửa.
 *
 *  Bố cục (luật dự án): khung Mục lục = dải thẻ số (tổng các cột MỤC LỤC, bấm = lọc đầu việc) + bảng MỤC LỤC (bấm hàng = lọc đầu việc);
 *  khung Đầu việc = Bộ lọc (gập trên điện thoại) + bảng các cột chính, bấm hàng xổ đủ mọi cột còn lại của g-sheet (không pop-up).
 *  Cột đơn trị (mọi dòng đang hiện cùng 1 giá trị) ẩn và đưa giá trị lên đầu khung (luật 14). Điện thoại: table.mbcard.
 */
(function () {
  "use strict";
  if (window.HBAODUONG) return;
  var esc = window.hskTienIch.esc, $id = window.hskTienIch.$id;
  var APPSCRIPT_URL = "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
  var TAB_ML = "BAO-DUONG-MUC-LUC", TAB_DV = "BAO-DUONG-DAU-VIEC";
  var GSHEET = "https://docs.google.com/spreadsheets/d/1ERdim9g4-BbJspzWhIfy6jWXFMMNya4zhhvWYF59GHc/edit?gid=481972207#gid=481972207";
  var STALE_MS = 5 * 60 * 1000;
  /* 4 cột nhóm của MỤC LỤC ↔ giá trị cột NHÓM THỰC HIỆN của bảng chi tiết (g-sheet viết «KT cơ điện» lẫn «KỸ THUẬT CƠ ĐIỆN» cho cùng nhóm) */
  var NHOM = [["VẬN HÀNH", "Vận hành"], ["VẬN HÀNH + BẢO TRÌ", "Vận hành + Bảo trì"], ["BẢO TRÌ", "Bảo trì"], ["KỸ THUẬT CƠ ĐIỆN", "Kỹ thuật cơ điện"]];
  var chuan = function (s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim().toUpperCase(); };
  var nhomCua = function (s) { var u = chuan(s); return u === "KT CƠ ĐIỆN" ? "KỸ THUẬT CƠ ĐIỆN" : u; };
  var soCua = function (v) { var n = Number(String(v == null ? "" : v).replace(/[^\d]/g, "")); return /\d/.test(String(v)) ? n : 0; };
  var nf = function (n) { return Number(n || 0).toLocaleString("vi-VN"); };
  /* Bảng đầu việc: cột hiện trên bảng (đúng tên g-sheet) — mọi cột còn lại xổ ra khi bấm hàng */
  var COT_BANG = [["HẠNG MỤC", "c-hm"], ["TẦN SUẤT", "c-ts"], ["CỤM / HỆ THỐNG", "c-cum"], ["HẠNG MỤC KIỂM TRA", "c-kt"], ["NỘI DUNG CÔNG VIỆC", "c-nd"],
    ["THỜI GIAN", "c-tg"], ["NGƯỜI THỰC HIỆN", "c-nth"], ["NGƯỜI PHỤ TRÁCH", "c-npt"], ["MÃ VỊ TRÍ", "c-mvt"]];
  var DON_TRI = { "HẠNG MỤC": 1, "TẦN SUẤT": 1, "NGƯỜI THỰC HIỆN": 1 };   // cột lặp được — đơn trị thì ẩn, giá trị lên đầu khung

  var PANE = null, S = { ok: false, loi: "", ml: null, dv: null, lastAt: 0, ts: 0, sua: "", loc: { hm: "", ts: "", nhom: "", tim: "" }, mo: {}, locMo: null };

  function napCss() {
    if ($id("bd-css")) return;
    var B = "#pane-baoduong";
    var c = [
      B + " .bd-panel{margin:0 0 16px;border:1px solid var(--ad-chia,var(--border));border-radius:8px;box-shadow:none;overflow:visible}",
      B + " .bd-panel>.panel-head .bd-phai{display:flex;align-items:center;gap:8px;flex:0 0 auto;margin-left:auto}",
      B + " .bd-panel>.panel-head .bd-phai a{font-size:12px;color:var(--accent);text-decoration:none;white-space:nowrap}",
      /* dải thẻ số = Statistic antd: nhãn xám trên, số dưới; ngăn bằng vạch dọc 1px, không khung lồng (luật 1 tầng khung 15/10) */
      B + " .bd-tiles{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:0;padding:12px 16px;border-bottom:1px solid var(--ad-chia,var(--border))}",
      B + " .bd-tile{display:flex;flex-direction:column;gap:2px;min-width:0;padding:4px 16px;border:0;border-left:1px solid var(--ad-chia,var(--border));background:transparent;font:inherit;text-align:left;color:var(--text);cursor:pointer;border-radius:0}",
      B + " .bd-tile:first-child{border-left:0;padding-left:0}",
      B + " .bd-tile:hover{background:var(--ad-re,color-mix(in srgb,var(--accent) 6%,transparent))}",
      B + " .bd-tile.on .bd-n{color:var(--accent)}",
      B + " .bd-tile:focus-visible{outline:0;box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 18%,transparent)}",
      B + " .bd-tile .bd-l{font-size:12px;line-height:20px;font-weight:400;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      B + " .bd-tile .bd-n{font-size:24px;line-height:32px;font-weight:600;font-variant-numeric:tabular-nums}",
      B + " .bd-tile.chua .bd-n{color:var(--muted)}",
      /* bảng */
      B + " .bd-wrap{overflow:auto;max-height:none}",
      B + " .bd-wrap table{width:100%;border-collapse:collapse;font-size:13px}",
      /* tiêu đề cột ĐƯỢC xuống dòng: để nowrap thì bảng 11 cột (Mục lục) / 9 cột (Đầu việc) tràn khung, cột Ghi chú · Mã vị trí bị cắt ở 1440 */
      B + " .bd-wrap thead th{position:sticky;top:0;z-index:1;background:var(--ad-nen2,var(--surface2));color:var(--muted);font-weight:600;font-size:12px;line-height:18px;text-align:left;vertical-align:bottom;padding:8px 10px;border-bottom:1px solid var(--ad-chia,var(--border))}",
      B + " .bd-wrap tbody td{padding:8px 10px;border-bottom:1px solid var(--ad-chia,var(--border));vertical-align:top;color:var(--text)}",
      B + " .bd-wrap tbody tr.bd-dong{cursor:pointer}",
      B + " .bd-wrap tbody tr.bd-dong:hover td{background:var(--ad-re,color-mix(in srgb,var(--accent) 5%,transparent))}",
      B + " .bd-wrap tbody tr.on td{background:var(--ad-chon,color-mix(in srgb,var(--accent) 8%,transparent))}",
      B + " .bd-wrap td.num,.bd-wrap th.num{text-align:right;font-variant-numeric:tabular-nums}",
      B + " .bd-wrap td.c-ghi{color:var(--muted);min-width:180px}",
      B + " .bd-wrap td.c-hm{font-weight:600}",
      /* CSS chung của trang ép th,td nowrap (bảng Vi phạm) ⇒ trong khung này ô được xuống dòng; chỉ cột số + Thời gian giữ 1 dòng */
      B + " .bd-wrap :is(th,td){white-space:normal}",
      "@media(min-width:769px){" + B + " #bdMucLuc .bd-wrap :is(th,td).num{width:1%;white-space:nowrap}}",   // chỉ máy tính: điện thoại là thẻ, ép 1% làm nhãn «Số đầu việc» chồng chữ
      B + " .bd-wrap .bd-gach{color:var(--muted)}",
      B + " .bd-lech{color:var(--warn);font-weight:600;cursor:help;margin-left:4px}",
      B + " .bd-wrap td .bd-k2{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;white-space:pre-line}",
      B + " .bd-wrap tr.mo td .bd-k2{-webkit-line-clamp:unset;display:block}",
      B + " .bd-wrap td.c-mvt{white-space:pre-line;font-variant-numeric:tabular-nums}",
      B + " .bd-wrap td.c-nd{min-width:200px}",
      B + " .bd-wrap td.c-kt{min-width:140px}",
      B + " .bd-wrap td.c-tg{white-space:nowrap}",
      /* hàng xổ: các cột còn lại của g-sheet — lưới nhãn / giá trị, không khung lồng */
      B + " tr.bd-xo>td{background:var(--ad-nen2,var(--surface2));padding:10px 16px 12px}",
      B + " .bd-xo-luoi{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px 24px}",
      B + " .bd-xo-luoi>div{min-width:0}",
      B + " .bd-xo-luoi .lb{display:block;font-size:12px;line-height:20px;color:var(--muted)}",
      B + " .bd-xo-luoi .gt{display:block;font-size:13px;line-height:20px;color:var(--text);white-space:pre-line;overflow-wrap:anywhere}",
      B + " .bd-trong{padding:28px 16px;text-align:center;color:var(--muted)}",
      B + " .bd-trong .hsk-nut,.bd-trong button{margin-top:10px}",
      /* điện thoại */
      "@media(max-width:768px){" +
        B + " .bd-tiles{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 0;padding:10px 12px}" +
        B + " .bd-tile{padding:4px 10px;min-height:44px}" + B + " .bd-tile:nth-child(3n+1){border-left:0;padding-left:0}" +
        B + " .bd-tile .bd-n{font-size:20px;line-height:28px}" +
        B + " .bd-wrap{overflow:visible}" + B + " .bd-wrap table.mbcard{font-size:12px}" +
        B + " .bd-wrap table.mbcard tr.bd-xo{padding:10px 12px;margin-top:-6px;border-top-left-radius:0;border-top-right-radius:0}" +
        B + " .bd-wrap table.mbcard tr.bd-xo>td{background:transparent;padding:0!important}" +
        B + " .bd-xo-luoi{grid-template-columns:minmax(0,1fr)}" +
        B + " .bd-wrap table.mbcard td.c-ghi{max-width:none}" +
        B + " .bd-wrap table.mbcard td.c-nd," + B + " .bd-wrap table.mbcard td.c-kt{min-width:0}" +
        B + " .bd-wrap table.mbcard tr.bd-dong{min-height:44px}" +
        /* khuôn thẻ chung (table.mbcard) bo 12 px + tiêu đề 700 — mục theo lớp antd: thẻ 8 px, đậm 600 (AD-03, AD-06) */
        B + " .bd-wrap table.mbcard tr{border-radius:8px}" + B + " .bd-wrap table.mbcard td.mb-hd{font-weight:600}" +
        B + " .bd-panel>.panel-head .ph-trai{flex:0 0 auto;overflow:visible}" +
      "}" +
      /* ≤560: đầu khung Mục lục chỉ giữ tiêu đề + giờ cập nhật (bỏ link g-sheet + phần ngày) — trước bị cắt còn «Mục lụ» */
      "@media(max-width:560px){" + B + " .bd-panel>.panel-head .bd-phai a," + B + " .bd-panel>.panel-head .bd-phai .cn-ngay{display:none}" +
      "}"
    ].join("\n");
    var st = document.createElement("style"); st.id = "bd-css"; st.textContent = c; document.head.appendChild(st);
  }

  /* ===== DỮ LIỆU — readTab (sheet RIÊNG), thử lại 3 lượt khi Apps Script chập chờn (khuôn hasaki-kiemke.js) ===== */
  function tbKhoa() { try { return localStorage.getItem("tb-khoa") || (localStorage.getItem("tk-phien") ? "tk:" + localStorage.getItem("tk-phien") : ""); } catch (e) { return ""; } }
  var CHO = [700, 1800, 4000], SO = 0;
  function readTabP(tab, lan) {
    lan = lan || 0;
    var cb = "bdgv_" + (++SO);
    return new Promise(function (res) {
      var xong = false, hen = setTimeout(function () { ket(null); }, 60000);
      function ket(resp) {
        if (xong) return; xong = true; clearTimeout(hen); delete window[cb];
        var sc = $id("bd_sc_" + cb); if (sc) sc.remove();
        var hong = !resp || (resp.status !== "success" && resp.code !== 403);
        if (hong && lan < CHO.length) { setTimeout(function () { readTabP(tab, lan + 1).then(res); }, CHO[lan]); return; }
        res(resp);
      }
      window[cb] = ket;
      var s = document.createElement("script"); s.id = "bd_sc_" + cb;
      s.src = APPSCRIPT_URL + "?action=readTab&tab=" + encodeURIComponent(tab) + "&callback=" + cb + "&tb=" + encodeURIComponent(tbKhoa());
      s.onerror = function () { ket(null); };
      document.body.appendChild(s);
    });
  }
  function bang(resp) {
    if (!resp || resp.status !== "success" || !(resp.header || []).length) return null;
    var H = resp.header.map(function (h) { return chuan(h); });
    var rows = (resp.rows || []).map(function (r) { var o = {}; H.forEach(function (h, i) { o[h] = r[i] == null ? "" : String(r[i]); }); return o; });
    return { H: resp.header.map(function (h) { return String(h); }), rows: rows };
  }

  function taiDuLieu() {
    var btn = $id("bdReload"); if (btn) btn.disabled = true;
    S.lastAt = Date.now();
    veKhung('<div class="bd-trong"><div class="sk sk-line" style="width:60%;margin:0 auto 8px"></div><div class="sk sk-line" style="width:40%;margin:0 auto"></div></div>');
    return Promise.all([readTabP(TAB_ML), readTabP(TAB_DV)]).then(function (res) {
      var ml = bang(res[0]), dv = bang(res[1]);
      S.ok = !!(ml && dv && ml.rows.length);
      S.loi = S.ok ? "" : (res.some(function (r) { return r && r.code === 403; }) ? "khoa" : (res.every(function (r) { return r && r.status === "success"; }) ? "trong" : "gas"));
      S.ml = ml; S.dv = dv;
      S.ts = Math.max(Number(res[0] && res[0].ts) || 0, Number(res[1] && res[1].ts) || 0);
      S.sua = ml && ml.rows[0] ? ml.rows[0]["G-SHEET SỬA LÚC"] || "" : "";
      ve();
    }).catch(function () { S.ok = false; S.loi = "gas"; ve(); })
      .finally(function () { var b = $id("bdReload"); if (b) b.disabled = false; });
  }

  /* ===== VẼ ===== */
  function veKhung(than) { if (PANE) PANE.innerHTML = than; }
  function capNhat() {
    var ms = S.sua ? Date.parse(S.sua) : S.ts;
    if (typeof window.hskCapNhat !== "function") return "";
    return window.hskCapNhat(ms || 0, { id: "bdReload", onclick: "HBAODUONG.reload()", tip: "Giờ g-sheet kế hoạch bảo dưỡng được sửa lần cuối — bấm để tải lại" });
  }
  /* chữ DỮ LIỆU của g-sheet bọc data-ad-mien: «Bấm còi», «Nút bấm»… là nội dung đầu việc, không phải chữ dạy thao tác (AD-10) */
  var GACH = /^[-–—]*$/;   // ô chỉ có gạch (g-sheet viết cả «-» lẫn «—») = không mang tin
  function o(v) { var s = String(v == null ? "" : v).trim(); return GACH.test(s) ? '<span class="bd-gach">—</span>' : '<span data-ad-mien="du-lieu-g-sheet">' + esc(s) + "</span>"; }
  function mb0(v) { return GACH.test(String(v == null ? "" : v).trim()) ? " mb-0" : ""; }

  /* Hàng MỤC LỤC có cột nhóm khác số dòng thật của bảng chi tiết (g-sheet tự lệch) → ⚠ + nguyên văn trong title */
  function lechCua(r) {
    var hm = r["HẠNG MỤC"], ds = S.dv.rows.filter(function (x) { return x["HẠNG MỤC"] === hm; });
    var dem = {}; ds.forEach(function (x) { var k = nhomCua(x["NHÓM THỰC HIỆN"]) || "(trống)"; dem[k] = (dem[k] || 0) + 1; });
    var lech = NHOM.filter(function (n) { return soCua(r[n[0]]) !== (dem[n[0]] || 0); }).length || soCua(r["SỐ ĐẦU VIỆC"]) !== ds.length;
    if (!lech) return "";
    var ct = Object.keys(dem).map(function (k) { var t = NHOM.filter(function (n) { return n[0] === k; })[0]; return (t ? t[1] : k.charAt(0) + k.slice(1).toLowerCase()) + " " + dem[k]; }).join(" · ");
    return '<span class="bd-lech" title="G-sheet lệch: MỤC LỤC khác bảng chi tiết. Bảng chi tiết có ' + ds.length + " đầu việc: " + esc(ct) + '">⚠</span>';
  }

  function veMucLuc() {
    var R = S.ml.rows, tong = function (k) { return R.reduce(function (s, r) { return s + soCua(r[k]); }, 0); };
    var t = [["", "Hạng mục", R.length], ["", "Đầu việc", tong("SỐ ĐẦU VIỆC")]].concat(NHOM.map(function (n) { return [n[0], n[1], tong(n[0])]; }));
    var tiles = t.map(function (x) {
      var on = S.loc.nhom && S.loc.nhom === x[0];
      return '<button type="button" class="bd-tile' + (on ? " on" : "") + (x[2] ? "" : " chua") + '" data-nhom="' + esc(x[0]) + '" title="' + (x[0] ? "Lọc đầu việc nhóm " + esc(x[1]) : "Xem mọi đầu việc") + '">' +
        '<span class="bd-l">' + esc(x[1]) + '</span><span class="bd-n">' + nf(x[2]) + "</span></button>";
    }).join("");
    var cot = S.ml.H.filter(function (h) { return chuan(h) !== "G-SHEET SỬA LÚC"; });
    var lop = function (h) { var u = chuan(h); return u === "HẠNG MỤC" ? "c-hm mb-hd" : u === "GHI CHÚ" ? "c-ghi mb-full" : (u === "STT" || u === "SỐ ĐẦU VIỆC" || NHOM.some(function (n) { return n[0] === u; })) ? "num" : ""; };
    var tieuDe = function (h) { var u = chuan(h); var n = NHOM.filter(function (x) { return x[0] === u; })[0]; return n ? n[1] : u === "STT" ? "STT" : u === "SKU" ? "SKU" : u.charAt(0) + u.slice(1).toLowerCase(); };
    var dong = R.map(function (r) {
      var on = S.loc.hm && S.loc.hm === r["HẠNG MỤC"];
      return '<tr class="bd-dong' + (on ? " on" : "") + '" data-hm="' + esc(r["HẠNG MỤC"]) + '" title="Lọc đầu việc của ' + esc(r["HẠNG MỤC"]) + '">' + cot.map(function (h) {
        var u = chuan(h), v = r[u];
        return '<td class="' + lop(h) + (u === "STT" ? " mb-0" : mb0(v)) + '"' + (u === "HẠNG MỤC" ? "" : ' data-lb="' + esc(tieuDe(h)) + '"') + ">" + o(v) + (u === "HẠNG MỤC" ? lechCua(r) : "") + "</td>";   // ô tiêu đề thẻ (mb-hd) không nhãn
      }).join("") + "</tr>";
    }).join("");
    return '<div class="panel bd-panel" id="bdMucLuc"><div class="panel-head"><span class="ph-trai"><span class="ph-td">Mục lục</span></span>' +
      '<span class="bd-phai"><a href="' + GSHEET + '" target="_blank" rel="noopener" title="Mở g-sheet kế hoạch bảo dưỡng (tab MỤC LỤC)">G-sheet ↗</a>' + capNhat() + "</span></div>" +
      '<div class="bd-tiles">' + tiles + "</div>" +
      '<div class="bd-wrap"><table class="mbcard"><thead><tr>' + cot.map(function (h) { return '<th class="' + lop(h).replace(/ mb-\w+/g, "") + '">' + esc(tieuDe(h)) + "</th>"; }).join("") + "</tr></thead><tbody>" + dong + "</tbody></table></div></div>";
  }

  function dvLoc() {
    var L = S.loc, tim = L.tim.toLowerCase();
    return S.dv.rows.filter(function (r) {
      if (L.hm && r["HẠNG MỤC"] !== L.hm) return false;
      if (L.ts && r["TẦN SUẤT"] !== L.ts) return false;
      if (L.nhom && nhomCua(r["NHÓM THỰC HIỆN"]) !== L.nhom) return false;
      if (tim && !(r._tim || (r._tim = Object.keys(r).map(function (k) { return r[k]; }).join(" ").toLowerCase())).includes(tim)) return false;
      return true;
    });
  }
  function luaChon(k) { var s = {}; S.dv.rows.forEach(function (r) { if (r[k]) s[r[k]] = (s[r[k]] || 0) + 1; }); return Object.keys(s); }

  function veDauViec() {
    var ds = dvLoc(), L = S.loc;
    /* cột đơn trị → ẩn, giá trị lên đầu khung (luật 14) */
    var an = {}, gtDon = [];
    if (ds.length > 1) COT_BANG.forEach(function (c) { if (!DON_TRI[c[0]]) return; var v = ds[0][c[0]]; if (v && ds.every(function (r) { return r[c[0]] === v; })) { an[c[0]] = 1; gtDon.push(v); } });
    var hien = COT_BANG.filter(function (c) { return !an[c[0]]; });
    var con = S.dv.H.filter(function (h) { var u = chuan(h); return !COT_BANG.some(function (c) { return c[0] === u; }) || an[u]; });
    var tieuDe = function (u) { return u === "SKU" ? "SKU" : u.charAt(0) + u.slice(1).toLowerCase(); };
    var coLoc = !!(L.hm || L.ts || L.nhom || L.tim);
    var dong = ds.map(function (r, i) {
      var k = r["HẠNG MỤC"] + "|" + r["STT"] + "|" + i, mo = !!S.mo[k];
      var tr = '<tr class="bd-dong' + (mo ? " mo" : "") + '" data-k="' + esc(k) + '" aria-expanded="' + mo + '" title="Xem đủ các cột của đầu việc này">' + hien.map(function (c) {
        var v = r[c[0]], hd = c[1] === "c-kt";
        return '<td class="' + c[1] + (hd ? " mb-hd" : c[1] === "c-nd" ? " mb-full" : "") + mb0(v) + '"' + (hd ? "" : ' data-lb="' + esc(tieuDe(c[0])) + '"') + ">" + (c[1] === "c-nd" || c[1] === "c-kt" ? '<span class="bd-k2">' + o(v) + "</span>" : o(v)) + "</td>";
      }).join("") + "</tr>";
      if (!mo) return tr;
      var luoi = con.filter(function (h) { return !GACH.test(String(r[chuan(h)] || "").trim()); }).map(function (h) {
        return '<div><span class="lb">' + esc(tieuDe(chuan(h))) + '</span><span class="gt" data-ad-mien="du-lieu-g-sheet">' + esc(r[chuan(h)]) + "</span></div>"; }).join("");
      return tr + '<tr class="bd-xo"><td colspan="' + hien.length + '" class="mb-full">' + (luoi ? '<div class="bd-xo-luoi">' + luoi + "</div>" : '<span class="bd-gach">Các cột khác đều trống.</span>') + "</td></tr>";
    }).join("");
    var sel = function (id, nhan, k, ds2, chon) {
      return '<label><span class="lbl">' + nhan + '</span><select id="' + id + '"><option value="">Tất cả</option>' + ds2.map(function (v) {
        var val = Array.isArray(v) ? v[0] : v, ten = Array.isArray(v) ? v[1] : v;
        return '<option value="' + esc(val) + '"' + (val === chon ? " selected" : "") + ">" + esc(ten) + "</option>"; }).join("") + "</select></label>";
    };
    var locMo = S.locMo == null ? !window.matchMedia("(max-width:768px)").matches : S.locMo;
    return '<div class="panel bd-panel" id="bdDauViec"><div class="panel-head"><span class="ph-trai"><span class="ph-td">Đầu việc</span>' +
      '<span class="ph-dem">' + nf(ds.length) + (coLoc ? " / " + nf(S.dv.rows.length) : "") + (gtDon.length ? " · " + esc(gtDon.join(" · ")) : "") + "</span></span>" +
      '<button type="button" class="btn-filter' + (locMo ? " mo" : "") + (coLoc ? " dang-loc" : "") + '" id="bdBtnLoc">' + (coLoc ? "Bộ lọc · đang lọc" : "Bộ lọc") + "</button></div>" +
      '<div class="filters' + (locMo ? "" : " collapsed") + '" id="bdLoc" data-mb-rangcua="luoi-1-cot-gap-mac-dinh">' +
        sel("bdHm", "Hạng mục", "HẠNG MỤC", S.ml.rows.map(function (r) { return r["HẠNG MỤC"]; }), L.hm) +
        sel("bdTs", "Tần suất", "TẦN SUẤT", luaChon("TẦN SUẤT"), L.ts) +
        sel("bdNhom", "Nhóm thực hiện", "", NHOM.map(function (n) { return [n[0], n[1]]; }).concat(S.dv.rows.some(function (r) { return nhomCua(r["NHÓM THỰC HIỆN"]) === "CHƯA XÁC ĐỊNH"; }) ? [["CHƯA XÁC ĐỊNH", "Chưa xác định"]] : []), L.nhom) +
        '<label><span class="lbl">Tìm (mã vị trí / nội dung / người)</span><input type="search" id="bdTim" autocomplete="off" placeholder="F0-CB-503 / băng tải" value="' + esc(L.tim) + '"></label>' +
      "</div>" +
      (ds.length ? '<div class="bd-wrap"><table class="mbcard"><thead><tr>' + hien.map(function (c) { return '<th class="' + c[1] + '">' + esc(tieuDe(c[0])) + "</th>"; }).join("") + "</tr></thead><tbody>" + dong + "</tbody></table></div>"
        : '<div class="bd-trong">Không có đầu việc nào khớp bộ lọc.</div>') + "</div>";
  }

  function ve() {
    if (!PANE) return;
    if (!S.ok) {
      var cau = S.loi === "khoa" ? "Máy này chưa được cấp quyền đọc dữ liệu bảo dưỡng — đăng nhập tài khoản hoặc mở link cấp quyền một lần rồi tải lại trang."
        : S.loi === "trong" ? "Chưa có dữ liệu bảo dưỡng trên máy chủ — máy đồng bộ chưa chép g-sheet lần nào."
        : "Không tải được dữ liệu bảo dưỡng (Apps Script không trả lời).";
      veKhung('<div class="panel bd-panel"><div class="bd-trong">' + esc(cau) + '<br><button type="button" class="hsk-nut chinh" onclick="HBAODUONG.reload()">Thử lại</button></div></div>');
      return;
    }
    var cuon = PANE.scrollTop;
    veKhung(veMucLuc() + veDauViec());
    ganSuKien();
    if (typeof window.enhanceSelect === "function") PANE.querySelectorAll("#bdLoc select").forEach(function (s) { try { window.enhanceSelect(s); } catch (e) {} });
    PANE.scrollTop = cuon;
    if (typeof window.tqGhi === "function") window.tqGhi("bd", { dv: S.dv.rows.length, hm: S.ml.rows.length });
  }

  function cuonToiDauViec() { var el = $id("bdDauViec"); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "start" }); }
  function ganSuKien() {
    PANE.querySelectorAll(".bd-tile").forEach(function (b) {
      b.addEventListener("click", function () { var n = b.getAttribute("data-nhom"); S.loc.nhom = S.loc.nhom === n ? "" : n; if (!n) { S.loc = { hm: "", ts: "", nhom: "", tim: "" }; } S.mo = {}; ve(); cuonToiDauViec(); });
    });
    PANE.querySelectorAll("#bdMucLuc tr.bd-dong").forEach(function (tr) {
      tr.addEventListener("click", function () { var hm = tr.getAttribute("data-hm"); S.loc.hm = S.loc.hm === hm ? "" : hm; S.mo = {}; ve(); cuonToiDauViec(); });
    });
    PANE.querySelectorAll("#bdDauViec tr.bd-dong").forEach(function (tr) {
      tr.addEventListener("click", function (e) { if (e.target.closest("a")) return; var k = tr.getAttribute("data-k"); S.mo[k] = !S.mo[k]; ve(); });
    });
    var bl = $id("bdBtnLoc"); if (bl) bl.addEventListener("click", function () { var f = $id("bdLoc"); var dong = f.classList.toggle("collapsed"); S.locMo = !dong; bl.classList.toggle("mo", !dong); });
    [["bdHm", "hm"], ["bdTs", "ts"], ["bdNhom", "nhom"]].forEach(function (p) { var s = $id(p[0]); if (s) s.addEventListener("change", function () { S.loc[p[1]] = s.value; S.mo = {}; ve(); }); });
    var t = $id("bdTim"), hen = null;
    if (t) t.addEventListener("input", function () { clearTimeout(hen); hen = setTimeout(function () { S.loc.tim = t.value.trim(); S.mo = {}; var vt = t.selectionStart; ve(); var t2 = $id("bdTim"); if (t2) { t2.focus(); try { t2.setSelectionRange(vt, vt); } catch (e) {} } }, 250); });
  }

  window.HBAODUONG = {
    init: function (pane) {
      PANE = pane; napCss();
      if (S.ok && Date.now() - S.lastAt < STALE_MS) { ve(); return; }
      taiDuLieu();
    },
    reload: function () { return taiDuLieu(); }
  };
})();
