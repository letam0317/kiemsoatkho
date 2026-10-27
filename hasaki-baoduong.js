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
  var STALE_MS = 5 * 60 * 1000, NGAY_PC = 30, NGAY_DT = 14, NGAY_DU_LIEU = 60;   // khoảng mặc định máy tính / điện thoại · dữ liệu sync-bao-duong-yc
  var chuan = function (s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim().toUpperCase(); };
  var nhomCua = function (s) { var u = chuan(s); return u === "KT CƠ ĐIỆN" ? "KỸ THUẬT CƠ ĐIỆN" : u; };
  /* nhóm thực hiện → nhãn + lớp màu (biến màu của trang, không mã màu cứng) */
  var NHOM = { "VẬN HÀNH": ["Vận hành", "n-vh"], "VẬN HÀNH + BẢO TRÌ": ["Vận hành + Bảo trì", "n-vhbt"], "BẢO TRÌ": ["Bảo trì", "n-bt"], "KỸ THUẬT CƠ ĐIỆN": ["KT cơ điện", "n-kt"], "CHƯA XÁC ĐỊNH": ["Chưa xác định", "n-cxd"] };
  var nhanNhom = function (n) { var x = NHOM[nhomCua(n)] || [n || "?", "n-cxd"]; return '<span class="bd-nhom ' + x[1] + '">' + esc(x[0]) + "</span>"; };
  var NGUON = [["he-thong|phan-cong", "Theo hệ thống · Phân công (g-sheet)"], ["he-thong|work", "Theo hệ thống · Chia việc work"], ["he-thong|lan-truoc", "Theo hệ thống · Làm lần trước"], ["chi-dinh|", "Chỉ định (nhập tên / mã NV)"]];
  var xong = function (st) { return st === 3 || st === 4; };
  var laDT = function () { return window.matchMedia("(max-width:768px)").matches; };

  var PANE = null, S = { ok: false, loi: "", dv: [], yc: [], ky: [], giao: {}, ts: 0, lastAt: 0, chon: "", soNgay: 0, luu: {}, moNhom: {}, khoang: null, khoangTuDong: true };

  function napCss() {
    if ($id("bd-css")) return;
    var B = ":is(#pane-baoduong,#mBody)";
    var c = [
      B + " .bd-panel{margin:0 0 16px;border:1px solid var(--ad-chia,var(--border));border-radius:8px;box-shadow:none;overflow:visible}",
      B + " .bd-panel>.panel-head .bd-phai{display:flex;align-items:center;gap:8px;flex:0 0 auto;margin-left:auto}",
      B + " .bd-panel>.panel-head .bd-phai a{font-size:12px;color:var(--accent);text-decoration:none;white-space:nowrap}",
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
      B + " .bd-hm thead th{font-weight:400;color:var(--muted);text-align:center;font-size:10px;line-height:11px;padding-bottom:4px;min-width:14px}",
      B + " .bd-hm td.vt{position:sticky;left:0;z-index:1;background:var(--surface);max-width:200px;overflow:hidden;text-overflow:ellipsis;padding:0 10px 0 4px;font-size:12px;line-height:20px;color:var(--text);border-radius:4px}",
      B + " .bd-hm tr.vtr{cursor:pointer}",
      B + " .bd-hm tr.vtr:hover td.vt{background:var(--ad-re,var(--hover))}",
      B + " .bd-hm tr.vtr.on td.vt{color:var(--accent);font-weight:600;background:var(--ad-chon,var(--hover))}",
      B + " .bd-hm tr.vtr.trong td.vt{color:var(--muted)}",
      B + " .bd-hm tr.gr td{font-weight:600;font-size:12px;line-height:20px;color:var(--text);padding:10px 4px 2px;position:sticky;left:0;background:var(--surface)}",
      B + " .bd-hm tr.gr td span{font-weight:400;color:var(--muted);margin-left:6px}",
      B + " .bd-hm td .bd-o{display:block;width:16px;height:16px;margin:0 auto}",
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
      /* đầu lưới 3 tầng + ô bấm được + chân trang */
      B + " .bd-hm thead th.th-thang{text-align:left;color:var(--text);font-weight:600;font-size:11px;line-height:16px;padding:0 0 2px 3px;box-shadow:inset 1px 0 0 var(--ad-chia,var(--border))}",
      B + " .bd-hm thead th.th-ngay{font-size:10px;line-height:12px;padding:0}",
      B + " .bd-hm thead th.th-ngay.nay{color:var(--accent);font-weight:700}",
      B + " .bd-hm thead th.th-thu{font-size:9px;line-height:11px;padding:0 0 4px}",
      B + " .bd-hm thead th.th-thu.cn{color:var(--bad)}",
      B + " .bd-hm td .bd-o{cursor:pointer}",
      B + " .bd-hm td .bd-o.tb-dangxem{outline:2px solid var(--accent);outline-offset:1px}",
      B + " .bd-xam{font-weight:400;color:var(--muted)}",
      "#pane-baoduong .bd-nguon{text-align:center;font-size:12px;line-height:20px;margin:0 0 16px}",
      "#pane-baoduong .bd-nguon a{color:var(--muted)}",
      "#pane-baoduong .bd-panel>.panel-head .bd-phai .date-btn{min-height:32px}",
      /* thanh bên: yêu cầu ngày */
      B + " .bd-dai{display:flex;flex-wrap:wrap;gap:3px;margin-bottom:10px}",
      B + " .bd-dai .bd-o{width:14px;height:14px;cursor:pointer}",
      B + " .bd-dai .bd-o.dang{outline:2px solid var(--accent);outline-offset:1px}",
      B + " .bd-ngay-nav{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}",
      B + " .bd-ngay-nav b{font-size:14px;line-height:22px;font-weight:600;color:var(--text)}",
      B + " .bd-yc{border:1px solid var(--ad-chia,var(--border));border-radius:8px;padding:10px 12px;margin-bottom:10px}",
      B + " .bd-yc-dau{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:13px;line-height:20px;margin-bottom:8px;color:var(--muted)}",
      B + " .bd-yc-dau b{font-weight:600;color:var(--text)}",
      B + " .bd-kh-trong{aspect-ratio:3/4;border:1px dashed var(--ad-chia,var(--border));border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:6px;text-align:center;font-size:11px;line-height:16px;color:var(--muted)}",
      B + " .bd-kh-trong span{color:var(--text)}",
      "#mBody .bd-ben{padding:12px 20px 24px}",
      "#mBody .bd-ben .bd-anh-ds{grid-template-columns:repeat(auto-fill,minmax(120px,160px))}",
      B + " .bd-hm td.vt{width:1%}",
      B + " .bd-loi-chung{font-size:12px;line-height:18px;color:var(--bad)}",
      "@media(max-width:768px){#mBody .bd-ben{padding:10px 12px 20px}#mBody .bd-ben .bd-anh-ds{grid-template-columns:repeat(3,minmax(0,1fr))}}",
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

  /* ===== ① LƯỚI VỊ TRÍ × NGÀY =====
     27/10 lượt 4 (user): bỏ chữ dạy thao tác dưới lưới («luật đâu mà hiển thị»); đầu lưới đủ THÁNG · NGÀY · THỨ («ngày lịch không đủ»);
     khoảng ngày chọn bằng bộ lọc ngày chuẩn (taoBoLocNgay, dữ liệu 60 ngày); lưới trọn bề ngang, chi tiết mở ở THANH BÊN PHẢI khi trỏ ngày. */
  var THU = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  function thuCua(iso) { return THU[new Date(iso + "T00:00:00Z").getUTCDay()]; }
  function congNgay(iso, n) { return new Date(Date.parse(iso + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10); }
  function ngayDau() { return congNgay(isoVN(Date.now()), -(NGAY_DU_LIEU - 1)); }
  function khoangMacDinh() { var den = isoVN(Date.now()); return [congNgay(den, -((laDT() ? NGAY_DT : NGAY_PC) - 1)), den]; }
  function dsKhoang() { var a = [], d = S.khoang[0]; while (d <= S.khoang[1]) { a.push(d); d = congNgay(d, 1); } return a; }
  function theoBinNgay() {
    var m = {}; S.yc.forEach(function (y) { var b = m[y["MÃ VỊ TRÍ"]] = m[y["MÃ VỊ TRÍ"]] || {}; (b[y["NGÀY"]] = b[y["NGÀY"]] || []).push(y); });
    return m;
  }
  function veLuoi() {
    var ngay = dsKhoang(), homNay = isoVN(Date.now()), theoBin = theoBinNgay();
    var nhom = {}, thuTuHm = [];
    S.thuTu.forEach(function (b) { var hm = S.vt[b].hm; if (!nhom[hm]) { nhom[hm] = []; thuTuHm.push(hm); } nhom[hm].push(b); });
    /* đầu lưới 3 tầng: tháng (gộp cột) · ngày · thứ (CN tô đỏ, hôm nay tô đậm) */
    var thang = [], dauThang = "";
    ngay.forEach(function (d) { var t = d.slice(0, 7); if (t !== dauThang) { thang.push({ t: t, n: 0 }); dauThang = t; } thang[thang.length - 1].n++; });
    var dau = '<tr><th class="th-goc" rowspan="3"></th>' + thang.map(function (x) { return '<th class="th-thang" colspan="' + x.n + '">' + (x.n >= 3 ? "Tháng " + Number(x.t.slice(5)) : "") + "</th>"; }).join("") + "</tr>" +
      "<tr>" + ngay.map(function (d) { return '<th class="th-ngay' + (d === homNay ? " nay" : "") + '">' + d.slice(8) + "</th>"; }).join("") + "</tr>" +
      "<tr>" + ngay.map(function (d) { var t = thuCua(d); return '<th class="th-thu' + (t === "CN" ? " cn" : "") + '">' + t + "</th>"; }).join("") + "</tr>";
    var tong = 0, bc = 0, hang = "", dt = laDT();
    var dem = function (ds) { tong += ds.length; bc += ds.filter(function (y) { return xong(Number(y["STATUS ID"])); }).length; };
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
        var tb = theoBin[b] || {}, coYc = Object.keys(tb).length > 0;
        if (!mo) { ngay.forEach(function (d) { dem(tb[d] || []); }); return; }
        var v = S.vt[b], tenHang = String(v.ten || b).split("|").pop().trim() || v.ten || b;
        hang += '<tr class="vtr' + (dt ? " con" : "") + (coYc ? "" : " trong") + '" data-bin="' + esc(b) + '" title="' + esc((v.ten || "") + " · " + b) + '"><td class="vt">' + o(tenHang) + "</td>" +
          ngay.map(function (d) {
            var ds = tb[d] || [], l = lopO(ds, d, homNay); dem(ds);
            var ai = ds.map(function (y) { return y["NGƯỜI LÀM"]; }).filter(Boolean).join(", ");
            var coAnh = l === "x" && ds.some(function (y) { return y["ẢNH BÁO CÁO"]; });
            return '<td><i class="bd-o ' + l + (coAnh ? " co-anh" : "") + '" data-ngay="' + d + '" title="' + thuCua(d) + " " + dm(d) + " · " + CHU_O[l] + (ai ? " · " + esc(ai) : "") + (coAnh ? " · có ảnh" : "") + '"></i></td>';
          }).join("") + "</tr>";
      });
    });
    return '<div class="panel bd-panel" id="bdLich"><div class="panel-head"><span class="ph-trai"><span class="ph-td">Lịch thực hiện</span><span class="ph-dem">' +
      S.thuTu.length + " vị trí · " + ngay.length + " ngày · " + bc + "/" + tong + " yêu cầu đã báo cáo</span></span>" +
      '<span class="bd-phai"><div id="bdLocNgay"></div></span></div>' +
      '<div class="bd-than"><div class="bd-chu"><span><i class="x"></i>Đã báo cáo</span><span><i class="d"></i>Đang làm</span><span><i class="m"></i>Hôm nay chưa làm</span><span><i class="b"></i>Bỏ</span>' +
        '<span><i></i>Không có yêu cầu</span><span><b class="bd-xam">Tên xám</b> chưa có lịch</span></div>' +
      '<div class="bd-hm"><table><thead>' + dau + "</thead><tbody>" + hang + "</tbody></table></div></div></div>";
  }

  /* ===== ② THANH BÊN: 1 vị trí × 1 ngày + cách làm ===== */
  function oAnh(y, a, i) {
    return '<a class="bd-anh" href="' + esc(a.url) + '" target="_blank" rel="noopener" data-rid="' + esc(y["REQUEST ID"]) + '" data-so="' + i + '" title="' + esc(a.khung) + '">' +
      '<img src="' + esc(a.url) + '" alt="' + esc(a.khung) + '" loading="lazy" decoding="async"><span>' + o(a.khung) + "</span></a>";
  }
  function veNgay(b, v, d) {
    var ds = ycCua(b).filter(function (y) { return y["NGÀY"] === d; }), homNay = isoVN(Date.now());
    var truoc = d > ngayDau() ? congNgay(d, -1) : "", sau = d < homNay ? congNgay(d, 1) : "";
    var nav = '<div class="bd-ngay-nav">' + (truoc ? '<button type="button" class="hsk-nut phu nho" data-sang="' + truoc + '">‹ ' + dm(truoc) + "</button>" : "<span></span>") +
      "<b>" + thuCua(d) + ", " + dm(d) + "/" + d.slice(0, 4) + "</b>" + (sau ? '<button type="button" class="hsk-nut phu nho" data-sang="' + sau + '">' + dm(sau) + " ›</button>" : "<span></span>") + "</div>";
    /* dải ô ngày của vị trí trong khoảng đang xem — thanh bên che phần phải của lưới (ngày gần nhất) nên đổi ngày ngay tại đây */
    var tb = {}; ycCua(b).forEach(function (y) { (tb[y["NGÀY"]] = tb[y["NGÀY"]] || []).push(y); });
    var dai = '<div class="bd-dai">' + dsKhoang().map(function (n) { var l = lopO(tb[n] || [], n, homNay);
      return '<i class="bd-o ' + l + (n === d ? " dang" : "") + '" data-sang="' + n + '" title="' + thuCua(n) + " " + dm(n) + " · " + CHU_O[l] + '"></i>'; }).join("") + "</div>";
    nav = dai + nav;
    if (!ds.length) return nav + '<div class="bd-ghi" style="margin-top:0">Không có yêu cầu bảo dưỡng ngày này.</div>';
    return nav + ds.map(function (y) {
      var st = Number(y["STATUS ID"]), l = lopO([y], d, homNay), anh = anhCua(y);
      var kh = String(y["KHUNG ẢNH"] || "").split("|").map(function (x) { return x.trim(); }).filter(Boolean);
      var lech = kh.length && !/quạt/i.test(v.hm + " " + v.ten) && kh.some(function (k) { return /quạt/i.test(k); });
      var o1 = kh.map(function (k) { var i = -1; anh.some(function (a, j) { if (a.khung === k) { i = j; return true; } return false; });
        return i >= 0 ? oAnh(y, anh[i], i) : '<div class="bd-kh-trong"><span>' + o(k) + "</span>Chưa có ảnh</div>"; }).join("");
      /* ảnh có mà tên khung không khớp danh sách khung (lịch đổi mẫu sau khi chụp) — vẫn hiện, không bỏ sót */
      var thua = anh.map(function (a, j) { return kh.indexOf(a.khung) < 0 ? oAnh(y, a, j) : ""; }).join("");
      return '<div class="bd-yc"><div class="bd-yc-dau"><i class="bd-o ' + l + '"></i><b>' + esc(st === 7 ? "Bỏ (không làm)" : TT_YC[st] || (st === 2 ? "Đang làm" : d === homNay ? "Chưa làm" : y["TRẠNG THÁI"])) + "</b>" +
        (y["NGƯỜI LÀM"] ? " · " + o(y["NGƯỜI LÀM"]) : "") + (y["LÚC LÀM"] ? " · " + esc(y["LÚC LÀM"].slice(11) || y["LÚC LÀM"]) : "") + "</div>" +
        (lech ? '<div class="bd-canh">Khung ảnh của lịch là khung của <b>quạt</b>, không khớp thiết bị «' + esc(v.ten || v.hm) + "» ở g-sheet — lịch planogram gán nhầm mẫu, cần sửa lịch.</div>" : "") +
        '<div class="bd-anh-ds">' + o1 + thua + "</div></div>";
    }).join("");
  }
  function veCachLam(b, d) {
    var v = S.vt[b]; if (!v) return "";
    /* việc Vận hành của vị trí — gộp dòng trùng (g-sheet ghi 1 dòng / cụm thiết bị) theo HẠNG MỤC KIỂM TRA, Hàng ngày trước */
    var thuTs = ["HÀNG NGÀY", "HÀNG TUẦN", "2 TUẦN/LẦN", "HÀNG THÁNG"], gom = {}, dsTs = [];
    v.vh.forEach(function (r) { var ts = r["TẦN SUẤT"]; if (!gom[ts]) { gom[ts] = {}; dsTs.push(ts); } if (!gom[ts][r["HẠNG MỤC KIỂM TRA"]]) gom[ts][r["HẠNG MỤC KIỂM TRA"]] = r; });
    dsTs.sort(function (a, c) { var i = thuTs.indexOf(chuan(a)), j = thuTs.indexOf(chuan(c)); return (i < 0 ? 9 : i) - (j < 0 ? 9 : j); });
    var phut = function (rs) { return rs.reduce(function (s, r) { return s + (parseInt(r["THỜI GIAN"], 10) || 0); }, 0); };
    var lamGi = dsTs.map(function (ts) {
      var rs = Object.keys(gom[ts]).map(function (k) { return gom[ts][k]; });
      return '<div class="bd-sub">Làm gì · ' + esc(ts) + " · " + rs.length + " việc" + (phut(rs) ? " · ~" + phut(rs) + " phút" : "") + '</div><ol class="bd-buoc">' + rs.map(function (r) {
        return "<li><b>" + o(r["HẠNG MỤC KIỂM TRA"]) + "</b>" + (r["THỜI GIAN"] ? ' <span class="bd-phu-n">· ' + o(r["THỜI GIAN"]) + "</span>" : "") + '<span class="bd-nd">' + o(r["NỘI DUNG CÔNG VIỆC"]) + "</span></li>";
      }).join("") + "</ol>";
    }).join("") || '<div class="bd-ghi">G-sheet không có việc Vận hành cho vị trí này.</div>';
    var tuKh = S.khoang[0], denKh = S.khoang[1];
    var ds = ycCua(b).filter(function (y) { return y["NGÀY"] >= tuKh && y["NGÀY"] <= denKh; });
    var x = ds.filter(function (y) { return xong(Number(y["STATUS ID"])); }), bo = ds.filter(function (y) { return Number(y["STATUS ID"]) === 7; }).length;
    var tdo = '<div class="bd-sub">Tiến độ ' + dm(tuKh) + " → " + dm(denKh) + '</div><div class="bd-tdo"><span><b>' + x.length + "/" + ds.length + "</b>đã báo cáo</span><span><b>" + bo + "</b>bỏ</span></div>";
    var khac = ycCua(b).filter(function (y) { return y["NGÀY"] !== d && xong(Number(y["STATUS ID"])) && y["ẢNH BÁO CÁO"]; }).sort(function (a, c) { return String(c["NGÀY"]).localeCompare(String(a["NGÀY"])); });
    var anhKhac = khac.length ? '<div class="bd-sub">Ảnh các lần báo cáo khác</div>' + khac.slice(0, 3).map(function (y) {
      return '<div class="bd-lan"><div class="bd-lan-dau"><b>' + thuCua(y["NGÀY"]) + " " + dm(y["NGÀY"]) + "</b> · " + o(y["NGƯỜI LÀM"] || "—") + " · " + esc(TT_YC[Number(y["STATUS ID"])] || y["TRẠNG THÁI"]) + "</div>" +
        '<div class="bd-anh-ds">' + anhCua(y).map(function (a, i) { return oAnh(y, a, i); }).join("") + "</div></div>";
    }).join("") : "";
    var duong = '<div class="bd-sub">Báo cáo ở đâu</div><div class="bd-duong">App <b>Hasaki WMS</b> › <b>Quản lý tài sản</b> (Asset Management) › <b>Báo cáo vệ sinh (vị trí)</b> (Declaration request (location))' +
      " › chọn kho và <b>Loại mục đích</b> (Purpose type) theo yêu cầu › quét mã <b>" + esc(b) + "</b> › <b>Chụp ảnh</b> (Take photo) đủ khung › <b>Hoàn thành yêu cầu</b> (Complete request)</div>";
    var ky = S.ky.filter(function (k) { return String(k["MÃ VỊ TRÍ"] || "").split(/\n/).map(function (s) { return s.trim(); }).indexOf(b) >= 0; });
    var veKy2 = ky.length ? '<div class="bd-sub">Việc theo kỳ ở vị trí này</div>' + ky.map(function (k) {
      return '<div class="bd-ghi" style="margin-top:4px">' + nhanNhom(k["NHÓM THỰC HIỆN"]) + " " + esc(k["TẦN SUẤT"]) + " · " + esc(k["SỐ ĐẦU VIỆC"]) + " việc · kỳ tới " + esc(k["KỲ TỚI"] || "—") + "</div>";
    }).join("") : "";
    var pt = Object.keys(v.pt);
    return '<div class="bd-cl"><div class="bd-chips"><span class="badge">' + esc(b) + '</span><span class="badge">' + o(v.hm) + "</span>" +
      (pt.length ? '<span class="badge">' + o(pt.join(" / ")) + "</span>" : '<span class="badge">Chưa có người phụ trách</span>') + "</div>" +
      '<div class="bd-sub">Yêu cầu ngày</div>' + veNgay(b, v, d) + lamGi + tdo + anhKhac + duong + veKy2 + "</div>";
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
    var demGhi = {}, chungGhi = {}; S.ky.forEach(function (k) { if (k["GHI CHÚ MÁY"]) demGhi[k["GHI CHÚ MÁY"]] = (demGhi[k["GHI CHÚ MÁY"]] || 0) + 1; });
    Object.keys(demGhi).forEach(function (g) { if (demGhi[g] > 1) chungGhi[g] = demGhi[g]; });
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
        '<td data-lb="Kỳ">' + (k["KỲ HIỆN TẠI"] ? esc(k["KỲ HIỆN TẠI"]) + '<span class="bd-phu">hạn ' + esc(k["HẠN"]) + "</span>" : esc(k["KỲ TỚI"])) + "</td>" +
        '<td data-lb="Trạng thái"><span class="bd-tt ' + lopTT(k["TRẠNG THÁI"]) + '">' + esc(k["TRẠNG THÁI"]) + "</span>" + (tid ? '<span class="bd-phu">' + tid + "</span>" : "") + "</td>" +
        '<td data-lb="Người nhận">' + nguoi + (k["GHI CHÚ MÁY"] && !chungGhi[k["GHI CHÚ MÁY"]] ? '<span class="' + (k["NGƯỜI NHẬN"] ? "bd-phu" : "bd-loi") + '">' + esc(k["GHI CHÚ MÁY"]) + "</span>" : "") + "</td>" +
        '<td data-lb="Cách lấy người nhận">' + (duocSua ? '<button type="button" class="hsk-nut phu nho bd-doi" aria-expanded="false">Đổi người nhận</button>' : "") + nhan + "</td></tr>";
    }).join("");
    var tong = S.ky.reduce(function (s, k) { return s + (Number(k["SỐ ĐẦU VIỆC"]) || 0); }, 0), thieu = S.ky.filter(function (k) { return !k["NGƯỜI NHẬN"]; }).length;
    return '<div class="panel bd-panel" id="bdKy"><div class="panel-head"><span class="ph-trai"><span class="ph-td">Việc theo kỳ</span><span class="ph-dem">' +
      S.ky.length + " nhóm · " + tong + " đầu việc" + (thieu ? " · " + thieu + " thiếu người nhận" : "") + "</span></span></div>" +
      Object.keys(chungGhi).map(function (g) { return '<div class="bd-than" style="padding-bottom:0"><div class="bd-loi-chung">' + chungGhi[g] + " nhóm: " + esc(g) + "</div></div>"; }).join("") +
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

  function chanTrang() {
    /* viên Cập nhật ở CHÂN TRANG như Kiểm kê / Bất thường / Planogram (khuôn .cn-wrap) — user 27/10 «cập nhật luôn ở cuối trang» */
    return '<div class="cn-wrap" id="bdLoadinfo">' + (typeof window.hskCapNhat === "function" ? window.hskCapNhat(S.ts || 0, { id: "bdReload", onclick: "HBAODUONG.reload()",
      tip: "Bảo dưỡng kho 170 · g-sheet kế hoạch + yêu cầu planogram " + NGAY_DU_LIEU + " ngày — bấm để tải lại" }) : "") + "</div>" +
      '<div class="bd-nguon"><a href="' + GSHEET + '" target="_blank" rel="noopener">Mở g-sheet kế hoạch bảo dưỡng</a></div>';
  }
  function ganLocNgay() {
    var r = $id("bdLocNgay"); if (!r || typeof window.taoBoLocNgay !== "function") return;
    var coNgay = {}; S.yc.forEach(function (y) { coNgay[y["NGÀY"]] = 1; });
    var loc = window.taoBoLocNgay({
      root: r, idNut: "bdNgayBtn", idPop: "bdNgayPop", homNay: function () { return isoVN(Date.now()); },
      presets: [{ k: "7", lb: "7 ngày" }, { k: "14", lb: "14 ngày" }, { k: "30", lb: "30 ngày" }, { k: "month", lb: "Tháng này" }, { k: "all", lb: NGAY_DU_LIEU + " ngày" }],
      tinhPreset: function (k) { return k === "all" ? [ngayDau(), isoVN(Date.now())] : null; },
      khongRong: true, macDinh: khoangMacDinh,
      coDuLieu: function (iso) { return !!coNgay[iso]; },
      chanNgay: function (iso) { return iso < ngayDau() || iso > isoVN(Date.now()); },
      nhan: function (a, b) { return a ? dm(a) + (b && b !== a ? " → " + dm(b) : "") : ""; },
      onApply: function (a, b) { var m = khoangMacDinh(); S.khoang = [a || m[0], b || a || m[1]]; S.khoangTuDong = !a; ve(); }
    });
    loc.dat(S.khoang[0], S.khoang[1]);
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
    if (!S.khoang || S.khoangTuDong) { S.khoang = khoangMacDinh(); S.khoangTuDong = true; }
    var cuon = PANE.scrollTop;
    PANE.innerHTML = veLuoi() + veKy() + chanTrang();
    ganLocNgay();
    ganSuKien();
    PANE.scrollTop = cuon;
    if (typeof window.tqGhi === "function") window.tqGhi("bd", { dv: S.dv.length, vt: S.thuTu.length });
  }

  function xemAnhNut(a) { var y = S.yc.filter(function (r) { return String(r["REQUEST ID"]) === a.getAttribute("data-rid"); })[0]; xemAnh(y, Number(a.getAttribute("data-so")) || 0); }
  /* THANH BÊN PHẢI dùng chung (hskThanhBen — máy tính trượt ra bên phải, điện thoại phủ màn; vuốt lùi đóng 1 lớp, luật 25/10):
     1 vị trí × 1 ngày — yêu cầu ngày đó + ảnh từng khung, chuyển ngày ‹ ›, rồi cách làm của vị trí. */
  function moBen(b, d) {
    var TB = window.hskThanhBen; if (!TB || !$id("mBody") || !S.vt[b]) return;
    S.chon = b; S.chonNgay = d;
    var tb = TB.mo("bd:" + b + ":" + d, '#bdLich tr.vtr[data-bin="' + b + '"], #bdLich tr.vtr[data-bin="' + b + '"] .bd-o[data-ngay="' + d + '"]');
    $id("mTitle").textContent = S.vt[b].ten || b;
    var mb = $id("mBody"); mb.innerHTML = '<div class="bd-ben">' + veCachLam(b, d) + "</div>";
    mb.querySelector(".bd-ben").addEventListener("click", function (e) {
      var a = e.target.closest(".bd-anh"); if (a) { e.preventDefault(); xemAnhNut(a); return; }
      var n = e.target.closest("[data-sang]"); if (n) moBen(b, n.getAttribute("data-sang"));
    });
    TB.xong(tb);
  }
  /* bấm tên vị trí (không trỏ ngày) → ngày gần nhất có yêu cầu trong khoảng đang xem, không có thì ngày cuối khoảng */
  function ngayMacDinh(b) {
    var ds = ycCua(b).map(function (y) { return y["NGÀY"]; }).filter(function (d) { return d >= S.khoang[0] && d <= S.khoang[1]; }).sort();
    return ds.length ? ds[ds.length - 1] : S.khoang[1];
  }
  function ganSuKien() {
    PANE.querySelectorAll("#bdLich tr.vtr").forEach(function (tr) {
      tr.addEventListener("click", function (e) {
        var b = tr.getAttribute("data-bin"), oNgay = e.target.closest(".bd-o[data-ngay]");
        moBen(b, oNgay ? oNgay.getAttribute("data-ngay") : ngayMacDinh(b));
      });
    });
    PANE.querySelectorAll("#bdLich tr.gd").forEach(function (tr) {
      tr.addEventListener("click", function () { var tenHm = tr.getAttribute("data-hm"); S.moNhom[tenHm] = !S.moNhom[tenHm]; ve(); });
    });
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
