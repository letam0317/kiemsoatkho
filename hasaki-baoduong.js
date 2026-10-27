/* hasaki-baoduong.js — Audit Retail › Tài sản › Bảo dưỡng. Module LAZY, khuôn hasaki-tonbatthuong / hasaki-kiemke.
 *
 *  27/10/2026 lượt 2 — user bác bản bảng chữ («nhìn vào không biết là cái gì, làm ở đâu, ra sao, tiến độ?»), xem 3 phương án PDF
 *  rồi chốt **phương án C: lịch theo thiết bị + Cách làm**; việc 3 tháng/lần phải «phân rõ trách nhiệm Vận hành / KT cơ điện /
 *  Bảo trì / kết hợp» và có «ô để lấy theo hệ thống (chia việc work, làm lần trước hoặc phân công) và chỉ định (ô nhập)».
 *
 *  3 khung:
 *   ① Lịch thực hiện — lưới vị trí × ngày (29 ngày; điện thoại 14), nhóm theo hạng mục; ô = yêu cầu planogram của ngày đó
 *      (xanh báo cáo · cam đang làm · viền đỏ hôm nay chưa làm · đỏ bỏ). Bấm 1 hàng → ② của vị trí đó.
 *   ② Cách làm — việc VẬN HÀNH của vị trí (đúng g-sheet), khung ảnh của yêu cầu gần nhất (⚠ khi khung không khớp thiết bị),
 *      đường báo cáo trên app, tiến độ riêng vị trí, việc theo kỳ của vị trí.
 *   ③ Việc theo kỳ — mỗi (hạng mục · nhóm thực hiện · tần suất) không phải Vận hành = 1 task work [BD] mỗi kỳ (bd-task-ky.mjs);
 *      nhãn màu theo nhóm (Bảo trì / KT cơ điện / Vận hành + Bảo trì) + ô Người nhận: Theo hệ thống (Phân công · Chia việc work ·
 *      Làm lần trước) hoặc Chỉ định (ô nhập) → GAS bd_giao (phiên tài khoản, quyền Làm r.baoduong).
 *
 *  Nguồn (tab RIÊNG, readTab khoá thiết bị / phiên): BAO-DUONG-DAU-VIEC (g-sheet, sync-bao-duong.mjs) · BAO-DUONG-YEUCAU
 *  (planogram, sync-bao-duong-yc.mjs) · BAO-DUONG-KY (bd-task-ky.mjs) · BAO-DUONG-GIAO (ô người nhận). Trang: 0 lượt WMS/work.
 */
(function () {
  "use strict";
  if (window.HBAODUONG) return;
  var esc = window.hskTienIch.esc, $id = window.hskTienIch.$id;
  var APPSCRIPT_URL = "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
  var TAB_DV = "BAO-DUONG-DAU-VIEC", TAB_YC = "BAO-DUONG-YEUCAU", TAB_KY = "BAO-DUONG-KY", TAB_GIAO = "BAO-DUONG-GIAO";
  var GSHEET = "https://docs.google.com/spreadsheets/d/1ERdim9g4-BbJspzWhIfy6jWXFMMNya4zhhvWYF59GHc/edit?gid=481972207#gid=481972207";
  var STALE_MS = 5 * 60 * 1000, NGAY_PC = 29, NGAY_DT = 14;
  var chuan = function (s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim().toUpperCase(); };
  var nhomCua = function (s) { var u = chuan(s); return u === "KT CƠ ĐIỆN" ? "KỸ THUẬT CƠ ĐIỆN" : u; };
  /* nhóm thực hiện → nhãn + lớp màu (biến màu của trang, không mã màu cứng) */
  var NHOM = { "VẬN HÀNH": ["Vận hành", "n-vh"], "VẬN HÀNH + BẢO TRÌ": ["Vận hành + Bảo trì", "n-vhbt"], "BẢO TRÌ": ["Bảo trì", "n-bt"], "KỸ THUẬT CƠ ĐIỆN": ["KT cơ điện", "n-kt"], "CHƯA XÁC ĐỊNH": ["Chưa xác định", "n-cxd"] };
  var nhanNhom = function (n) { var x = NHOM[nhomCua(n)] || [n || "?", "n-cxd"]; return '<span class="bd-nhom ' + x[1] + '">' + esc(x[0]) + "</span>"; };
  var NGUON = [["he-thong|phan-cong", "Theo hệ thống · Phân công (g-sheet)"], ["he-thong|work", "Theo hệ thống · Chia việc work"], ["he-thong|lan-truoc", "Theo hệ thống · Làm lần trước"], ["chi-dinh|", "Chỉ định (nhập tên / mã NV)"]];
  var xong = function (st) { return st === 3 || st === 4; };
  var laDT = function () { return window.matchMedia("(max-width:768px)").matches; };

  var PANE = null, S = { ok: false, loi: "", dv: [], yc: [], ky: [], giao: {}, ts: 0, lastAt: 0, chon: "", soNgay: 0, luu: {}, moNhom: {} };

  function napCss() {
    if ($id("bd-css")) return;
    var B = ":is(#pane-baoduong,#mBody)";
    var c = [
      B + " .bd-panel{margin:0 0 16px;border:1px solid var(--ad-chia,var(--border));border-radius:8px;box-shadow:none;overflow:visible}",
      B + " .bd-panel>.panel-head .bd-phai{display:flex;align-items:center;gap:8px;flex:0 0 auto;margin-left:auto}",
      B + " .bd-panel>.panel-head .bd-phai a{font-size:12px;color:var(--accent);text-decoration:none;white-space:nowrap}",
      B + " .bd-luoi2{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;align-items:start}",
      B + " .bd-than{padding:12px 16px 16px}",
      /* chú giải + ô màu */
      B + " .bd-chu{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12px;line-height:20px;color:var(--muted);margin-bottom:8px}",
      B + " .bd-chu i," + B + " .bd-o{display:inline-block;width:12px;height:12px;border-radius:3px;background:var(--ad-nen2,var(--surface2));vertical-align:-3px}",
      B + " .bd-chu i{margin-right:6px}",
      B + " .bd-o.x," + B + " .bd-chu i.x{background:var(--good)}",
      B + " .bd-o.d," + B + " .bd-chu i.d{background:var(--warn)}",
      B + " .bd-o.m," + B + " .bd-chu i.m{background:color-mix(in srgb,var(--bad) 18%,transparent);outline:1px dashed var(--bad);outline-offset:-1px}",
      B + " .bd-o.b," + B + " .bd-chu i.b{background:var(--bad)}",
      /* lưới vị trí × ngày */
      B + " .bd-hm{overflow-x:auto}",
      B + " .bd-hm table{border-collapse:separate;border-spacing:2px;font-size:11px}",
      B + " .bd-hm :is(th,td){white-space:nowrap;padding:0;border:0;background:transparent}",
      B + " .bd-hm thead th{font-weight:400;color:var(--muted);text-align:center;font-size:10px;line-height:11px;padding-bottom:4px;min-width:11px}",
      B + " .bd-hm td.vt{position:sticky;left:0;z-index:1;background:var(--surface);max-width:170px;overflow:hidden;text-overflow:ellipsis;padding:0 10px 0 4px;font-size:12px;line-height:20px;color:var(--text);border-radius:4px}",
      B + " .bd-hm tr.vtr{cursor:pointer}",
      B + " .bd-hm tr.vtr:hover td.vt{background:var(--ad-re,var(--hover))}",
      B + " .bd-hm tr.vtr.on td.vt{color:var(--accent);font-weight:600;background:var(--ad-chon,var(--hover))}",
      B + " .bd-hm tr.vtr.trong td.vt{color:var(--muted)}",
      B + " .bd-hm tr.gr td{font-weight:600;font-size:12px;line-height:20px;color:var(--text);padding:10px 4px 2px;position:sticky;left:0;background:var(--surface)}",
      B + " .bd-hm tr.gr td span{font-weight:400;color:var(--muted);margin-left:6px}",
      B + " .bd-hm td .bd-o{display:block;width:11px;height:11px}",
      B + " .bd-ghi{font-size:12px;line-height:20px;color:var(--muted);margin-top:8px}",
      /* thẻ Cách làm */
      B + " .bd-cl .bd-tieu{font-size:16px;line-height:24px;font-weight:600;color:var(--text);margin:0 0 8px}",
      B + " .bd-chips{display:flex;flex-wrap:wrap;gap:6px}",
      B + " .bd-sub{font-size:12px;line-height:20px;color:var(--muted);margin:14px 0 6px}",
      B + " .bd-buoc{margin:0;padding-left:20px}",
      B + " .bd-buoc li{margin-bottom:8px;font-size:13px;line-height:20px}",
      B + " .bd-buoc li b{font-weight:600}",
      B + " .bd-buoc li .bd-nd{display:block;font-size:12px;line-height:18px;color:var(--muted);white-space:pre-line}",
      B + " .bd-khung{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}",
      B + " .bd-khung>div{border:1px dashed var(--ad-chia,var(--border));border-radius:6px;padding:6px 8px;font-size:12px;line-height:18px;min-height:52px}",
      B + " .bd-khung>div b{display:block;font-weight:600;color:var(--muted)}",
      B + " .bd-canh{border:1px solid color-mix(in srgb,var(--warn) 45%,transparent);background:color-mix(in srgb,var(--warn) 10%,transparent);border-radius:6px;padding:6px 10px;font-size:12px;line-height:18px;margin-bottom:8px;color:var(--text)}",
      B + " .bd-duong{font-size:12px;line-height:20px;color:var(--text)}",
      B + " .bd-duong b{font-weight:600}",
      B + " .bd-tdo{display:flex;gap:16px;flex-wrap:wrap;font-size:12px;line-height:20px;color:var(--muted)}",
      B + " .bd-tdo b{font-size:16px;line-height:24px;font-weight:600;color:var(--text);display:block}",
      /* nhãn nhóm thực hiện */
      B + " .bd-nhom{display:inline-block;font-size:12px;line-height:20px;padding:0 8px;border-radius:4px;white-space:nowrap;border:1px solid}",
      B + " .bd-nhom.n-vh{color:var(--accent);border-color:color-mix(in srgb,var(--accent) 40%,transparent);background:color-mix(in srgb,var(--accent) 8%,transparent)}",
      B + " .bd-nhom.n-bt{color:var(--info);border-color:color-mix(in srgb,var(--info) 40%,transparent);background:color-mix(in srgb,var(--info) 8%,transparent)}",
      B + " .bd-nhom.n-kt{color:var(--warn);border-color:color-mix(in srgb,var(--warn) 45%,transparent);background:color-mix(in srgb,var(--warn) 8%,transparent)}",
      B + " .bd-nhom.n-vhbt{color:var(--good);border-color:color-mix(in srgb,var(--good) 45%,transparent);background:color-mix(in srgb,var(--good) 8%,transparent)}",
      B + " .bd-nhom.n-cxd{color:var(--muted);border-color:var(--ad-chia,var(--border));background:var(--ad-nen2,var(--surface2))}",
      B + " .bd-tt{font-size:12px;line-height:20px;white-space:nowrap}",
      B + " .bd-tt.t-xong{color:var(--good)} " + B + " .bd-tt.t-tre{color:var(--bad);font-weight:600} " + B + " .bd-tt.t-thieu{color:var(--bad)} " + B + " .bd-tt.t-cho{color:var(--muted)}",
      /* bảng việc theo kỳ */
      B + " .bd-wrap{overflow:auto}",
      B + " .bd-wrap table{width:100%;border-collapse:collapse;font-size:13px}",
      B + " .bd-wrap thead th{background:var(--ad-nen2,var(--surface2));color:var(--muted);font-weight:600;font-size:12px;line-height:18px;text-align:left;padding:8px 10px;border-bottom:1px solid var(--ad-chia,var(--border));white-space:normal}",
      B + " .bd-wrap tbody td{padding:8px 10px;border-bottom:1px solid var(--ad-chia,var(--border));vertical-align:top;color:var(--text);white-space:normal}",
      B + " .bd-wrap td.num{text-align:right;font-variant-numeric:tabular-nums}",
      B + " .bd-wrap td.c-hm{font-weight:600}",
      B + " .bd-wrap .bd-phu{display:block;font-size:12px;line-height:18px;color:var(--muted)}",
      B + " .bd-wrap .bd-loi{display:block;font-size:12px;line-height:18px;color:var(--bad)}",
      B + " .bd-nhan{display:flex;flex-direction:column;gap:6px;min-width:180px}",
      B + " .bd-nhan .bd-hang{display:flex;gap:6px;align-items:center}",
      B + " .bd-nhan input{flex:1;min-width:0}",
      B + " .bd-nhan{max-width:300px}" + B + " .bd-nhan .cs-trigger{max-width:100%;min-width:0}" + B + " .bd-nhan .cs-trigger>*{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      B + " .bd-nhan .bd-hang[hidden]{display:none}",
      B + " .bd-buoc .bd-phu-n{color:var(--muted);font-size:12px}",
      B + " .bd-nhan .bd-dl{font-size:12px;line-height:18px;color:var(--muted)}",
      B + " .bd-trong{padding:28px 16px;text-align:center;color:var(--muted)}",
      /* ảnh báo cáo của yêu cầu đã hoàn thành */
      B + " .bd-lan{margin-top:10px}",
      B + " .bd-lan-dau{font-size:12px;line-height:20px;color:var(--muted);margin-bottom:4px}",
      B + " .bd-lan-dau b{color:var(--text);font-weight:600}",
      B + " .bd-anh-ds{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}",
      B + " .bd-anh-ds a{display:block;cursor:zoom-in;text-decoration:none;color:var(--text);min-width:0}",
      B + " .bd-anh-ds img{display:block;width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:6px;background:var(--ad-nen2,var(--surface2))}",
      B + " .bd-anh-ds span{display:block;font-size:11px;line-height:16px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px}",
      B + " .bd-hm td .bd-o.co-anh{cursor:zoom-in;box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--surface) 70%,transparent)}",
      /* điện thoại: hàng gộp hạng mục (chạm mở/thu) */
      B + " .bd-hm tr.gd{cursor:pointer}",
      B + " .bd-hm tr.gd td.vt{font-weight:600}",
      B + " .bd-hm tr.gd td.vt .bd-mui{display:inline-block;width:12px;color:var(--muted);transition:transform .15s}",
      B + " .bd-hm tr.gd.mo td.vt .bd-mui{transform:rotate(90deg)}",
      B + " .bd-hm tr.vtr.con td.vt{padding-left:16px}",
      B + " .bd-doi{display:none}",
      B + " .bd-chi-dt{display:none}",
      B + " .bd-trong .hsk-nut{margin-top:10px}",
      "@media(max-width:768px){" +
        B + " .bd-luoi2{grid-template-columns:minmax(0,1fr)}" +
        B + " .bd-than{padding:10px 12px 12px}" +
        B + " .bd-hm td.vt{max-width:112px;padding-right:4px}" +
        B + " .bd-hm table{border-spacing:1px}" +
        B + " .bd-hm td .bd-o{width:12px;height:12px}" +
        B + " .bd-hm thead th{font-size:10px;line-height:11px;min-width:12px}" +
        B + " .bd-nhan{min-width:0;max-width:none}" + B + " .bd-nhan:not(.mo){display:none}" + B + " .bd-doi{display:inline-flex}" +
        B + " .bd-chi-dt{display:inline-block;margin-left:6px;vertical-align:1px}" +
        B + " .bd-wrap{overflow:visible}" + B + " .bd-wrap table.mbcard tr{border-radius:8px}" + B + " .bd-wrap table.mbcard td.mb-hd{font-weight:600}" +
        B + " .bd-panel>.panel-head .ph-trai{flex:0 0 auto;overflow:visible}" +
      "}",
      "@media(max-width:560px){" + B + " .bd-panel>.panel-head{flex-wrap:wrap;row-gap:4px}" + B + " .bd-panel>.panel-head .ph-dem{white-space:normal}" + B + " .bd-panel>.panel-head .bd-phai{margin-left:0}" + B +
          " .bd-panel>.panel-head .bd-phai a," + B + " .bd-panel>.panel-head .bd-phai .cn-ngay{display:none}}"
    ].join("\n");
    var st = document.createElement("style"); st.id = "bd-css"; st.textContent = c; document.head.appendChild(st);
  }

  /* ===== DỮ LIỆU — readTab (sheet RIÊNG), thử lại 3 lượt khi Apps Script chập chờn ===== */
  function phien() { try { return localStorage.getItem("tk-phien") || ""; } catch (e) { return ""; } }
  function tbKhoa() { try { return localStorage.getItem("tb-khoa") || (phien() ? "tk:" + phien() : ""); } catch (e) { return ""; } }
  var CHO = [700, 1800, 4000], SO = 0;
  function readTabP(tab, lan) {
    lan = lan || 0;
    var cb = "bdgv_" + (++SO);
    return new Promise(function (res) {
      var da = false, hen = setTimeout(function () { ket(null); }, 60000);
      function ket(resp) {
        if (da) return; da = true; clearTimeout(hen); delete window[cb];
        var sc = $id("bd_sc_" + cb); if (sc) sc.remove();
        var hong = !resp || (resp.status !== "success" && resp.code !== 403 && !/không có tab|chưa có/i.test(resp.message || ""));
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
    return (resp.rows || []).map(function (r) { var o = {}; H.forEach(function (h, i) { o[h] = r[i] == null ? "" : String(r[i]); }); return o; });
  }

  /* vị trí kế hoạch: tách MÃ VỊ TRÍ ↔ TÊN VỊ TRÍ (cùng thứ tự dòng trong ô g-sheet) */
  function dungViTri() {
    var VT = {}, thuTu = [];
    S.dv.forEach(function (r) {
      var ma = String(r["MÃ VỊ TRÍ"] || "").split(/\n/).map(function (x) { return x.trim().toUpperCase(); });
      var ten = String(r["TÊN VỊ TRÍ"] || "").split(/\n/).map(function (x) { return x.trim(); });
      ma.forEach(function (m, i) {
        if (!/^F0-/.test(m)) return;
        var v = VT[m]; if (!v) { v = VT[m] = { bin: m, ten: ten[i] || "", hm: r["HẠNG MỤC"], pt: {}, vh: [] }; thuTu.push(m); }
        if (!v.ten && ten[i]) v.ten = ten[i];
        String(r["NGƯỜI PHỤ TRÁCH"] || "").split(/\n|\//).forEach(function (p) { p = p.trim(); if (p && !/^[-–—]+$/.test(p)) v.pt[p] = 1; });
        if (nhomCua(r["NHÓM THỰC HIỆN"]) === "VẬN HÀNH") v.vh.push(r);
      });
    });
    S.vt = VT; S.thuTu = thuTu;
  }

  function taiDuLieu() {
    var btn = $id("bdReload"); if (btn) btn.disabled = true;
    S.lastAt = Date.now();
    if (PANE) PANE.innerHTML = '<div class="panel bd-panel"><div class="bd-trong"><div class="sk sk-line" style="width:60%;margin:0 auto 8px"></div><div class="sk sk-line" style="width:40%;margin:0 auto"></div></div></div>';
    return Promise.all([readTabP(TAB_DV), readTabP(TAB_YC), readTabP(TAB_KY), readTabP(TAB_GIAO)]).then(function (res) {
      var dv = bang(res[0]);
      S.ok = !!(dv && dv.length);
      S.loi = S.ok ? "" : (res[0] && res[0].code === 403 ? "khoa" : res[0] && res[0].status === "success" ? "trong" : "gas");
      S.dv = dv || []; S.yc = bang(res[1]) || []; S.ky = bang(res[2]) || [];
      S.giao = {}; (bang(res[3]) || []).forEach(function (g) { S.giao[g["KHOÁ"]] = g; });
      S.ts = Math.max(Number(res[1] && res[1].ts) || 0, Number(res[0] && res[0].ts) || 0);
      if (S.ok) dungViTri();
      ve();
    }).catch(function () { S.ok = false; S.loi = "gas"; ve(); })
      .finally(function () { var b = $id("bdReload"); if (b) b.disabled = false; });
  }

  /* ===== TIỆN ÍCH ===== */
  function isoVN(ms) { return new Date(ms + 7 * 3600e3).toISOString().slice(0, 10); }
  function dsNgay(n) { var h = Date.parse(isoVN(Date.now()) + "T00:00:00Z"), a = []; for (var i = n - 1; i >= 0; i--) a.push(new Date(h - i * 864e5).toISOString().slice(0, 10)); return a; }
  var dm = function (iso) { return iso ? window.hskTienIch.ngayVN(iso) : ""; };
  function ycCua(bin) { return S.yc.filter(function (y) { return y["MÃ VỊ TRÍ"] === bin; }); }
  function lopO(ds, ngay, homNay) {
    if (!ds.length) return "";
    var st = ds.map(function (y) { return Number(y["STATUS ID"]); });
    if (st.some(xong)) return "x"; if (st.indexOf(2) >= 0) return "d"; if (ngay === homNay) return "m"; return "b";
  }
  var CHU_O = { x: "Đã báo cáo", d: "Đang làm", m: "Hôm nay chưa làm", b: "Bỏ (không làm)", "": "Không có yêu cầu" };
  var TT_YC = { 3: "Chờ duyệt", 4: "Đã duyệt" };
  var ANH_CDN = "https://cdn-media-wms.inshasaki.com/planogram/standard/", ANH_GW = "https://wms-gw-external.hasaki.vn/api/v1/filesmanagement/planogram/standard/";
  /* «khung::tệp | …» → [{khung, url (CDN — cổng 302 sang đây), urlLui (cổng)}] */
  function anhCua(y) {
    return String(y["ẢNH BÁO CÁO"] || "").split(" | ").map(function (s) { var i = s.lastIndexOf("::"); return i < 0 ? null : { khung: s.slice(0, i).trim(), tep: s.slice(i + 2).trim() }; })
      .filter(function (a) { return a && a.tep; }).map(function (a) { var http = /^https?:/i.test(a.tep); return { khung: a.khung, url: http ? a.tep : ANH_CDN + a.tep, urlLui: http ? a.tep : ANH_GW + a.tep }; });
  }
  function xemAnh(y, i) {
    if (!y || typeof window.openLB !== "function") return;
    var v = S.vt[y["MÃ VỊ TRÍ"]] || {}, ds = anhCua(y);
    window.openLB(ds.map(function (a) { return { url: a.url, urlLui: a.urlLui, title: a.khung, sub: (v.ten || y["MÃ VỊ TRÍ"]) + " · " + dm(y["NGÀY"]), meta: (y["NGƯỜI LÀM"] || "") + (y["LÚC LÀM"] ? " · " + y["LÚC LÀM"] : "") }; }), i || 0);
  }
  function o(v) { return '<span data-ad-mien="du-lieu-g-sheet">' + esc(v) + "</span>"; }

  /* ===== ① LƯỚI VỊ TRÍ × NGÀY ===== */
  function veLuoi() {
    var ngay = dsNgay(S.soNgay), homNay = ngay[ngay.length - 1];
    var theoBin = {}; S.yc.forEach(function (y) { (theoBin[y["MÃ VỊ TRÍ"]] = theoBin[y["MÃ VỊ TRÍ"]] || {}); var b = theoBin[y["MÃ VỊ TRÍ"]]; (b[y["NGÀY"]] = b[y["NGÀY"]] || []).push(y); });
    var nhom = {}, thuTuHm = [];
    S.thuTu.forEach(function (b) { var hm = S.vt[b].hm; if (!nhom[hm]) { nhom[hm] = []; thuTuHm.push(hm); } nhom[hm].push(b); });
    var dau = ngay.map(function (d, i) { return "<th>" + d.slice(8) + (i === 0 || d.slice(8) === "01" ? "<br>" + d.slice(5, 7) : "") + "</th>"; }).join("");
    var tong = 0, bc = 0, hang = "", dt = laDT();
    /* ô gộp 1 hạng mục / ngày (điện thoại): mọi yêu cầu xong = xanh · có đang làm = cam · hôm nay còn thiếu = viền đỏ · còn lại = đỏ */
    var oGop = function (bins, d) {
      var ds = []; bins.forEach(function (b) { ds = ds.concat((theoBin[b] || {})[d] || []); }); if (!ds.length) return "";
      var st = ds.map(function (y) { return Number(y["STATUS ID"]); });
      return st.every(xong) ? "x" : st.indexOf(2) >= 0 ? "d" : d === homNay ? "m" : "b";
    };
    thuTuHm.forEach(function (hm) {
      var mo = !dt || !!S.moNhom[hm];
      hang += dt
        ? '<tr class="gd' + (mo ? " mo" : "") + '" data-hm="' + esc(hm) + '" aria-expanded="' + mo + '"><td class="vt"><span class="bd-mui">›</span>' + o(hm) + " (" + nhom[hm].length + ")</td>" +
            ngay.map(function (d) { var l = oGop(nhom[hm], d); return '<td><i class="bd-o ' + l + '" title="' + dm(d) + " · " + CHU_O[l] + '"></i></td>'; }).join("") + "</tr>"
        : '<tr class="gr"><td colspan="' + (ngay.length + 1) + '">' + o(hm) + "<span>" + nhom[hm].length + " vị trí</span></td></tr>";
      nhom[hm].forEach(function (b) {
        if (!mo) { var tb0 = theoBin[b] || {}; ngay.forEach(function (d) { var ds0 = tb0[d] || []; tong += ds0.length; bc += ds0.filter(function (y) { return xong(Number(y["STATUS ID"])); }).length; }); return; }
        var v = S.vt[b], tb = theoBin[b] || {}, coYc = Object.keys(tb).length > 0;
        var tenHang = String(v.ten || b).split("|").pop().trim() || v.ten || b;
        hang += '<tr class="vtr' + (dt ? " con" : "") + (S.chon === b && !dt ? " on" : "") + (coYc ? "" : " trong") + '" data-bin="' + esc(b) + '" title="' + esc((v.ten || "") + " · " + b) + (coYc ? "" : " · chưa có lịch phát yêu cầu") +
            '"><td class="vt">' + o(tenHang) + "</td>" +
          ngay.map(function (d) {
            var ds = tb[d] || [], l = lopO(ds, d, homNay); tong += ds.length; bc += ds.filter(function (y) { return xong(Number(y["STATUS ID"])); }).length;
            var ai = ds.map(function (y) { return y["NGƯỜI LÀM"]; }).filter(Boolean).join(", ");
            var coAnh = l === "x" && ds.some(function (y) { return y["ẢNH BÁO CÁO"]; });
            return '<td><i class="bd-o ' + l + (coAnh ? " co-anh" : "") + '"' + (coAnh ? ' data-ngay="' + d + '"' : "") + ' title="' + dm(d) + " · " + CHU_O[l] + (ai ? " · " + esc(ai) : "") + (coAnh ? " · bấm xem ảnh" : "") + '"></i></td>';
          }).join("") + "</tr>";
      });
    });
    var chuaLich = S.thuTu.filter(function (b) { return !theoBin[b]; }).length;
    return '<div class="panel bd-panel" id="bdLich"><div class="panel-head"><span class="ph-trai"><span class="ph-td">Lịch thực hiện</span><span class="ph-dem">' +
      S.thuTu.length + " vị trí · " + S.soNgay + " ngày · " + bc + "/" + tong + " yêu cầu đã báo cáo</span></span>" +
      '<span class="bd-phai"><a href="' + GSHEET + '" target="_blank" rel="noopener" title="Mở g-sheet kế hoạch bảo dưỡng">G-sheet ↗</a>' +
      (typeof window.hskCapNhat === "function" ? window.hskCapNhat(S.ts || 0, { id: "bdReload", onclick: "HBAODUONG.reload()", tip: "Giờ lấy yêu cầu planogram — bấm để tải lại" }) : "") + "</span></div>" +
      '<div class="bd-than"><div class="bd-chu"><span><i class="x"></i>Đã báo cáo</span><span><i class="d"></i>Đang làm</span><span><i class="m"></i>Hôm nay chưa làm</span><span><i class="b"></i>Bỏ</span><span><i></i>Không có yêu cầu</span></div>' +
      '<div class="bd-hm"><table><thead><tr><th></th>' + dau + "</tr></thead><tbody>" + hang + "</tbody></table></div>" +
      '<div class="bd-ghi">' + (dt ? "Chạm hạng mục để mở vị trí, chạm vị trí để xem cách làm và ảnh." : "Bấm 1 vị trí để xem cách làm, bấm ô xanh để xem ảnh báo cáo.") +
        (chuaLich ? " " + chuaLich + " vị trí chữ xám = chưa có lịch phát yêu cầu (lịch còn nháp hoặc chưa khai)." : "") + "</div></div></div>";
  }

  /* ===== ② CÁCH LÀM ===== */
  function veCachLam(trongBen) {   // trongBen: thanh bên đã có tiêu đề (tên vị trí) ⇒ bỏ đầu khung + tên, không lặp
    var b = S.chon, v = S.vt[b];
    if (!v) return '<div class="panel bd-panel bd-cl" id="bdCachLam"><div class="bd-trong">Chọn 1 vị trí ở Lịch thực hiện.</div></div>';
    /* việc Vận hành của vị trí — gộp dòng trùng (g-sheet ghi 1 dòng / cụm thiết bị) theo HẠNG MỤC KIỂM TRA, Hàng ngày trước */
    var thuTs = ["HÀNG NGÀY", "HÀNG TUẦN", "2 TUẦN/LẦN", "HÀNG THÁNG"], gom = {}, dsTs = [];
    v.vh.forEach(function (r) { var ts = r["TẦN SUẤT"]; if (!gom[ts]) { gom[ts] = {}; dsTs.push(ts); } if (!gom[ts][r["HẠNG MỤC KIỂM TRA"]]) gom[ts][r["HẠNG MỤC KIỂM TRA"]] = r; });
    dsTs.sort(function (a, c) { var i = thuTs.indexOf(chuan(a)), j = thuTs.indexOf(chuan(c)); return (i < 0 ? 9 : i) - (j < 0 ? 9 : j); });
    var phut = function (rs) { return rs.reduce(function (s, r) { return s + (parseInt(r["THỜI GIAN"], 10) || 0); }, 0); };
    var lamGi = dsTs.map(function (ts) {
      var rs = Object.keys(gom[ts]).map(function (k) { return gom[ts][k]; });
      return '<div class="bd-sub">' + esc(ts) + " · " + rs.length + " việc" + (phut(rs) ? " · ~" + phut(rs) + " phút" : "") + '</div><ol class="bd-buoc">' + rs.map(function (r) {
        return "<li><b>" + o(r["HẠNG MỤC KIỂM TRA"]) + "</b>" + (r["THỜI GIAN"] ? ' <span class="bd-phu-n">· ' + o(r["THỜI GIAN"]) + "</span>" : "") + '<span class="bd-nd">' + o(r["NỘI DUNG CÔNG VIỆC"]) + "</span></li>";
      }).join("") + "</ol>";
    }).join("") || '<div class="bd-ghi">G-sheet không có việc Vận hành cho vị trí này — xem Việc theo kỳ bên dưới.</div>';
    /* khung ảnh của yêu cầu gần nhất + cảnh báo khung lệch thiết bị (khung «quạt» ở thiết bị không phải quạt) */
    var ds = ycCua(b).slice().sort(function (a, c) { return String(c["NGÀY"]).localeCompare(String(a["NGÀY"])); }), gan = ds[0];
    var kh = gan ? String(gan["KHUNG ẢNH"] || "").split("|").map(function (x) { return x.trim(); }).filter(Boolean) : [];
    var lech = kh.length && !/quạt/i.test(v.hm + " " + v.ten) && kh.some(function (k) { return /quạt/i.test(k); });
    var khung = !gan ? '<div class="bd-ghi">Vị trí chưa có lịch phát yêu cầu nên chưa có khung ảnh.</div>'
      : '<div class="bd-sub">Chụp ' + kh.length + " khung ảnh (theo yêu cầu " + dm(gan["NGÀY"]) + ")</div>" +
        (lech ? '<div class="bd-canh">Khung ảnh của lịch là khung của <b>quạt</b>, không khớp thiết bị «' + esc(v.ten || v.hm) + "» ở g-sheet — lịch planogram gán nhầm mẫu, cần sửa lịch.</div>" : "") +
        '<div class="bd-khung">' + kh.map(function (k, i) { return "<div><b>" + (i + 1) + "</b>" + o(k) + "</div>"; }).join("") + "</div>";
    var x = ds.filter(function (y) { return xong(Number(y["STATUS ID"])); }), bo = ds.filter(function (y) { return Number(y["STATUS ID"]) === 7; }).length;
    var lanCuoi = x.slice().sort(function (a, c) { return String(c["LÚC LÀM"]).localeCompare(String(a["LÚC LÀM"])); })[0];
    var tdo = '<div class="bd-sub">Tiến độ ' + NGAY_PC + ' ngày</div><div class="bd-tdo"><span><b>' + x.length + "/" + ds.length + "</b>đã báo cáo</span><span><b>" + bo + "</b>bỏ</span><span><b>" +
      (lanCuoi ? dm(lanCuoi["NGÀY"]) : "—") + "</b>" + (lanCuoi && lanCuoi["NGƯỜI LÀM"] ? o(lanCuoi["NGƯỜI LÀM"]) : "lần làm gần nhất") + "</span></div>";
    var coAnh = x.filter(function (y) { return y["ẢNH BÁO CÁO"]; }).sort(function (a, c) { return String(c["NGÀY"]).localeCompare(String(a["NGÀY"])); });
    var anh = '<div class="bd-sub">Ảnh báo cáo' + (coAnh.length > 3 ? " · 3 lần gần nhất / " + coAnh.length : "") + "</div>" + (coAnh.length ? coAnh.slice(0, 3).map(function (y) {
      var ds2 = anhCua(y);
      return '<div class="bd-lan"><div class="bd-lan-dau"><b>' + dm(y["NGÀY"]) + "</b> · " + o(y["NGƯỜI LÀM"] || "—") + " · " + esc(TT_YC[Number(y["STATUS ID"])] || y["TRẠNG THÁI"]) + "</div>" +
        '<div class="bd-anh-ds">' + ds2.map(function (a, i) {
          /* thẻ <a> trỏ thẳng ảnh gốc (mở được kể cả khi tắt JS); bấm = trình xem ảnh chung openLB */
          return '<a class="bd-anh" href="' + esc(a.url) + '" target="_blank" rel="noopener" data-rid="' + esc(y["REQUEST ID"]) + '" data-so="' + i + '" title="' + esc(a.khung) + '">' +
            '<img src="' + esc(a.url) + '" alt="' + esc(a.khung) + '" loading="lazy" decoding="async"><span>' + o(a.khung) + "</span></a>";
        }).join("") + "</div></div>";
    }).join("") : '<div class="bd-ghi" style="margin-top:0">Chưa có lần báo cáo nào trong ' + NGAY_PC + " ngày.</div>");
    var duong = '<div class="bd-sub">Báo cáo ở đâu</div><div class="bd-duong">App <b>Hasaki WMS</b> › <b>Quản lý tài sản</b> (Asset Management) › <b>Báo cáo vệ sinh (vị trí)</b> (Declaration request (location)) › chọn kho và <b>Loại mục đích</b> (Purpose type) theo yêu cầu › quét mã <b>' + esc(b) + "</b> › <b>Chụp ảnh</b> (Take photo) đủ khung › <b>Hoàn thành yêu cầu</b> (Complete request)</div>";
    var ky = S.ky.filter(function (k) { return String(k["MÃ VỊ TRÍ"] || "").split(/\n/).map(function (s) { return s.trim(); }).indexOf(b) >= 0; });
    var veKy = ky.length ? '<div class="bd-sub">Việc theo kỳ ở vị trí này</div>' + ky.map(function (k) {
      return '<div class="bd-ghi" style="margin-top:4px">' + nhanNhom(k["NHÓM THỰC HIỆN"]) + " " + esc(k["TẦN SUẤT"]) + " · " + esc(k["SỐ ĐẦU VIỆC"]) + " việc · kỳ tới " + esc(k["KỲ TỚI"] || "—") + "</div>";
    }).join("") : "";
    var pt = Object.keys(v.pt);
    var than = '<div class="bd-chips"><span class="badge">' + esc(b) + '</span><span class="badge">' + o(v.hm) + "</span>" + (pt.length ? '<span class="badge">' + o(pt.join(" / ")) +
        "</span>" : '<span class="badge">Chưa có người phụ trách</span>') + "</div>" + lamGi + khung + tdo + anh + duong + veKy;
    return trongBen ? '<div class="bd-cl">' + than + "</div>"
      : '<div class="panel bd-panel bd-cl" id="bdCachLam"><div class="panel-head"><span class="ph-trai"><span class="ph-td">Cách làm</span></span></div><div class="bd-than">' +
        '<div class="bd-tieu">' + o(v.ten || b) + "</div>" + than + "</div></div>";
  }

  /* ===== ③ VIỆC THEO KỲ ===== */
  function cheDoCua(khoa) {
    if (S.luu[khoa]) return S.luu[khoa];
    var g = S.giao[khoa]; if (!g) return { v: "he-thong|phan-cong", chiDinh: "", ai: "", luc: "" };
    return { v: g["CHẾ ĐỘ"] === "chi-dinh" ? "chi-dinh|" : "he-thong|" + (g["NGUỒN"] || "phan-cong"), chiDinh: g["CHỈ ĐỊNH"] || "", ai: g["NGƯỜI LƯU"] || "", luc: g["LÚC LƯU"] || "" };
  }
  function lopTT(t) { return /Hoàn thành/.test(t) ? "t-xong" : /Quá hạn/.test(t) ? "t-tre" : /Thiếu/.test(t) ? "t-thieu" : "t-cho"; }
  function veKy() {
    if (!S.ky.length) return '<div class="panel bd-panel" id="bdKy"><div class="panel-head"><span class="ph-trai"><span class="ph-td">Việc theo kỳ</span></span></div><div class="bd-trong">Chưa có dữ liệu việc theo kỳ — máy tạo task chưa chạy lần nào.</div></div>';
    var duocSua = typeof window.tkCo === "function" && window.tkCo("r.baoduong", "lam") && !!phien();
    var dong = S.ky.map(function (k, i) {
      var khoa = k["KHOÁ"], cd = cheDoCua(khoa), laCd = cd.v.indexOf("chi-dinh") === 0;
      var goiY = { "he-thong|phan-cong": k["PHÂN CÔNG (G-SHEET)"], "he-thong|work": k["CHIA VIỆC WORK (KỲ TRƯỚC)"], "he-thong|lan-truoc": k["LÀM LẦN TRƯỚC"] };
      var nhan = duocSua
        ? '<div class="bd-nhan" data-khoa="' + esc(khoa) + '"><select class="bd-cdo" aria-label="Cách lấy người nhận">' + NGUON.map(function (n) {
            var gy = goiY[n[0]]; return '<option value="' + n[0] + '"' + (n[0] === cd.v ? " selected" : "") + ">" + esc(n[1]) + (n[0] === "chi-dinh|" ? "" : gy ? ": " + esc(gy) : ": (trống)") + "</option>";
          }).join("") + "</select>" +
          '<div class="bd-hang"' + (laCd ? "" : " hidden") + '><input type="text" class="bd-cd" maxlength="80" placeholder="Tên hoặc mã NV, nhiều người cách dấu phẩy" value="' + esc(cd.chiDinh) + '"></div>' +
          '<div class="bd-hang"><button type="button" class="hsk-nut chinh bd-luu">Lưu</button><span class="bd-dl">' + (cd.ai ? "Lưu bởi " + esc(cd.ai) + " · " +
              esc(cd.luc) : "Mặc định: Phân công (g-sheet)") + "</span></div></div>"
        : '<span class="bd-dl">' + esc((NGUON.filter(function (n) { return n[0] === cd.v; })[0] || NGUON[0])[1]) + (laCd ? ": " + esc(cd.chiDinh) : "") + "</span>";
      var nguoi = k["NGƯỜI NHẬN"] ? o(k["NGƯỜI NHẬN"]) + '<span class="bd-phu">' + esc(k["NGUỒN NGƯỜI NHẬN"]) + "</span>" : '<span class="bd-loi"><b>Chưa có người nhận</b></span>';
      var tid = k["TASK ID"] ? '<a href="https://work.hasaki.vn/tasks?task_id=' + encodeURIComponent(k["TASK ID"]) + '" target="_blank" rel="noopener">Task ' + esc(k["TASK ID"]) + " ↗</a>" : "";
      return "<tr>" +
        '<td class="c-hm mb-hd">' + o(k["HẠNG MỤC"]) + '<span class="bd-chi-dt">' + nhanNhom(k["NHÓM THỰC HIỆN"]) + "</span></td>" +
        '<td class="mb-0" data-lb="Nhóm thực hiện">' + nhanNhom(k["NHÓM THỰC HIỆN"]) + "</td>" +
        '<td data-lb="Tần suất">' + o(k["TẦN SUẤT"]) + '<span class="bd-phu">' + esc(k["SỐ ĐẦU VIỆC"]) + " đầu việc</span></td>" +
        '<td data-lb="Kỳ">' + (k["KỲ HIỆN TẠI"] ? esc(k["KỲ HIỆN TẠI"]) + '<span class="bd-phu">hạn ' + esc(k["HẠN"]) + "</span>" : esc(k["KỲ TỚI"]) + '<span class="bd-phu">kỳ đầu</span>') + "</td>" +
        '<td data-lb="Trạng thái"><span class="bd-tt ' + lopTT(k["TRẠNG THÁI"]) + '">' + esc(k["TRẠNG THÁI"]) + "</span>" + (tid ? '<span class="bd-phu">' + tid + "</span>" : "") + "</td>" +
        '<td data-lb="Người nhận">' + nguoi + (k["GHI CHÚ MÁY"] ? '<span class="' + (k["NGƯỜI NHẬN"] ? "bd-phu" : "bd-loi") + '">' + esc(k["GHI CHÚ MÁY"]) + "</span>" : "") + "</td>" +
        '<td data-lb="Cách lấy người nhận">' + (duocSua ? '<button type="button" class="hsk-nut phu nho bd-doi" aria-expanded="false">Đổi người nhận</button>' : "") + nhan + "</td></tr>";
    }).join("");
    var tong = S.ky.reduce(function (s, k) { return s + (Number(k["SỐ ĐẦU VIỆC"]) || 0); }, 0), thieu = S.ky.filter(function (k) { return !k["NGƯỜI NHẬN"]; }).length;
    return '<div class="panel bd-panel" id="bdKy"><div class="panel-head"><span class="ph-trai"><span class="ph-td">Việc theo kỳ</span><span class="ph-dem">' +
      S.ky.length + " nhóm · " + tong + " đầu việc" + (thieu ? " · " + thieu + " thiếu người nhận" : "") + "</span></span></div>" +
      '<div class="bd-than" style="padding-bottom:0"><div class="bd-ghi" style="margin:0 0 8px">Việc không phải Vận hành (Bảo trì, KT cơ điện, Vận hành + Bảo trì) planogram không đặt lịch theo quý được → mỗi kỳ máy tạo 1 task work [BD] cho người nhận, kỳ đầu 01/11/2026. Người nhận đổi ở cột cuối, áp dụng từ lần tạo task kế tiếp.</div></div>' +
      '<div class="bd-wrap"><table class="mbcard"><thead><tr><th>Hạng mục</th><th>Nhóm thực hiện</th><th>Tần suất</th><th>Kỳ</th><th>Trạng thái</th><th>Người nhận</th><th>Cách lấy người nhận</th></tr></thead><tbody>' +
          dong + "</tbody></table></div></div>";
  }

  function luuGiao(nut) {
    var hop = nut.closest(".bd-nhan"), khoa = hop.getAttribute("data-khoa"), v = hop.querySelector(".bd-cdo").value, cd = (hop.querySelector(".bd-cd") || {}).value || "";
    var p = v.split("|"), dl = hop.querySelector(".bd-dl");
    if (p[0] === "chi-dinh" && !cd.trim()) { dl.textContent = "Nhập tên hoặc mã nhân viên trước khi lưu."; return; }
    nut.disabled = true; dl.textContent = "Đang lưu…";
    fetch(APPSCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "bd_giao", phien: phien(), khoa: khoa, cheDo: p[0], nguon: p[1] || "", chiDinh: cd }), redirect: "follow" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.status !== "success") throw new Error(j.message || "Lỗi");
        var d = j.dong || [];
        S.giao[khoa] = { "KHOÁ": khoa, "CHẾ ĐỘ": d[1], "NGUỒN": d[2], "CHỈ ĐỊNH": d[3], "NGƯỜI LƯU": d[4], "LÚC LƯU": d[5] }; delete S.luu[khoa];
        dl.textContent = "Đã lưu — áp dụng từ lần tạo task kế tiếp · " + (d[4] || "") + " " + (d[5] || "");
      })
      .catch(function (e) { dl.textContent = "Chưa lưu được: " + e.message; })
      .finally(function () { nut.disabled = false; });
  }

  function ve() {
    if (!PANE) return;
    if (!S.ok) {
      var cau = S.loi === "khoa" ? "Máy này chưa được cấp quyền đọc dữ liệu bảo dưỡng — đăng nhập tài khoản hoặc mở link cấp quyền một lần rồi tải lại trang."
        : S.loi === "trong" ? "Chưa có dữ liệu bảo dưỡng trên máy chủ — máy đồng bộ chưa chép g-sheet lần nào."
        : "Không tải được dữ liệu bảo dưỡng (Apps Script không trả lời).";
      PANE.innerHTML = '<div class="panel bd-panel"><div class="bd-trong">' + esc(cau) + '<br><button type="button" class="hsk-nut chinh" onclick="HBAODUONG.reload()">Thử lại</button></div></div>';
      return;
    }
    S.soNgay = laDT() ? NGAY_DT : NGAY_PC;
    if (!S.chon || !S.vt[S.chon]) {   // mặc định: vị trí đầu tiên có yêu cầu hôm nay chưa xong, không có thì vị trí đầu
      var hn = isoVN(Date.now()), y = S.yc.filter(function (r) { return r["NGÀY"] === hn && !xong(Number(r["STATUS ID"])) && S.vt[r["MÃ VỊ TRÍ"]]; })[0];
      S.chon = y ? y["MÃ VỊ TRÍ"] : S.thuTu[0];
    }
    var cuon = PANE.scrollTop;
    PANE.innerHTML = '<div class="bd-luoi2">' + veLuoi() + (laDT() ? "" : veCachLam()) + "</div>" + veKy();
    ganSuKien();
    PANE.scrollTop = cuon;
    if (typeof window.tqGhi === "function") window.tqGhi("bd", { dv: S.dv.length, vt: S.thuTu.length });
  }

  function xemAnhNut(a) { var y = S.yc.filter(function (r) { return String(r["REQUEST ID"]) === a.getAttribute("data-rid"); })[0]; xemAnh(y, Number(a.getAttribute("data-so")) || 0); }
  /* điện thoại: Cách làm mở ở THANH BÊN dùng chung (hskThanhBen — vuốt lùi đóng 1 lớp, luật 25/10) thay vì cuộn xuống cuối trang */
  function moBen(bin) {
    var TB = window.hskThanhBen, v = S.vt[bin] || {};
    if (!TB || !$id("mBody")) return;
    var tb = TB.mo("bd:" + bin, '#bdLich tr.vtr[data-bin="' + bin + '"]');
    $id("mTitle").textContent = v.ten || bin;
    $id("mBody").innerHTML = '<div class="bd-ben">' + veCachLam(true) + "</div>";
    $id("mBody").querySelector(".bd-ben").addEventListener("click", function (e) { var a = e.target.closest(".bd-anh"); if (a) { e.preventDefault(); xemAnhNut(a); } });
    TB.xong(tb);
  }
  function ganSuKien(chiLuoi) {
    PANE.querySelectorAll("#bdLich tr.vtr").forEach(function (tr) {
      tr.addEventListener("click", function (e) {
        var bin = tr.getAttribute("data-bin"), o2 = e.target.closest(".bd-o.co-anh");
        if (o2) { var y = ycCua(bin).filter(function (r) { return r["NGÀY"] === o2.getAttribute("data-ngay") && r["ẢNH BÁO CÁO"]; })[0]; xemAnh(y, 0); return; }
        S.chon = bin;
        if (laDT()) { moBen(bin); return; }
        PANE.querySelectorAll("#bdLich tr.vtr.on").forEach(function (x) { x.classList.remove("on"); }); tr.classList.add("on");
        var cl = $id("bdCachLam"); if (cl) { cl.outerHTML = veCachLam(); }
      });
    });
    PANE.querySelectorAll("#bdLich tr.gd").forEach(function (tr) {
      tr.addEventListener("click", function () { var tenHm = tr.getAttribute("data-hm"); S.moNhom[tenHm] = !S.moNhom[tenHm]; var l = $id("bdLich"); if (l) { l.outerHTML = veLuoi(); ganSuKien(true); } });
    });
    if (chiLuoi) return;
    if (!PANE.__bdAnh) { PANE.__bdAnh = 1; PANE.addEventListener("click", function (e) { var a = e.target.closest(".bd-anh"); if (a) { e.preventDefault(); xemAnhNut(a); } }); }
    PANE.querySelectorAll("#bdKy .bd-doi").forEach(function (b) {
      b.addEventListener("click", function () { var h = b.parentNode.querySelector(".bd-nhan"), mo = h.classList.toggle("mo"); b.setAttribute("aria-expanded", mo); b.textContent = mo ? "Thu lại" : "Đổi người nhận"; });
    });
    PANE.querySelectorAll("#bdKy .bd-cdo").forEach(function (s) {
      s.addEventListener("change", function () {
        var hop = s.closest(".bd-nhan"), h = hop.querySelector(".bd-cd").closest(".bd-hang");
        h.hidden = s.value.indexOf("chi-dinh") !== 0;
        S.luu[hop.getAttribute("data-khoa")] = { v: s.value, chiDinh: hop.querySelector(".bd-cd").value, ai: "", luc: "" };
        if (!h.hidden) hop.querySelector(".bd-cd").focus();
      });
      if (typeof window.enhanceSelect === "function") { try { window.enhanceSelect(s); } catch (e) {} }
    });
    PANE.querySelectorAll("#bdKy .bd-luu").forEach(function (b) { b.addEventListener("click", function () { luuGiao(b); }); });
  }

  var mq = window.matchMedia("(max-width:768px)");
  var doiCo = function () { if (S.ok && PANE && PANE.offsetParent) ve(); };
  if (mq.addEventListener) mq.addEventListener("change", doiCo); else if (mq.addListener) mq.addListener(doiCo);

  window.HBAODUONG = {
    init: function (pane) {
      PANE = pane; napCss();
      if (S.ok && Date.now() - S.lastAt < STALE_MS) { ve(); return; }
      taiDuLieu();
    },
    reload: function () { return taiDuLieu(); }
  };
})();
