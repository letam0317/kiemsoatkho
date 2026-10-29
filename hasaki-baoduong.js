/* hasaki-baoduong.js — Audit Retail › Tài sản › Bảo dưỡng. Module LAZY, khuôn hasaki-tonbatthuong / hasaki-kiemke.
 *
 *  27/10/2026 lượt 2 — user bác bản bảng chữ («nhìn vào không biết là cái gì, làm ở đâu, ra sao, tiến độ?»), xem 3 phương án PDF
 *  rồi chốt **phương án C: lịch theo thiết bị + Cách làm**; việc 3 tháng/lần phải «phân rõ trách nhiệm Vận hành / KT cơ điện /
 *  Bảo trì / kết hợp» và có «ô để lấy theo hệ thống (chia việc work, làm lần trước hoặc phân công) và chỉ định (ô nhập)».
 *
 *  2 khung (28/10 user: bỏ khung «Việc theo kỳ», gom hết vào Lịch thực hiện, gắn cờ tần suất):
 *   ⓪ Việc hôm nay — thẻ từng việc phải làm hôm nay (yêu cầu planogram + task định kỳ đang mở), vòng tiến độ + ô lọc trạng thái.
 *   ① Lịch thực hiện — lưới vị trí × ngày, nhóm theo hạng mục (mục chủ ẩn/hiện); ô = yêu cầu planogram + task [BD] định kỳ
 *      (bd-task-ky.mjs, đặt ở ngày đầu kỳ) của ngày đó; ô có SỐ = việc định kỳ 1 / 3 / 6 tháng (T = hàng tuần).
 *   ② Thanh bên phải (vỏ Planogram) — yêu cầu ngày, ảnh, Phụ trách (ô Người nhận: Theo hệ thống · Chỉ định → GAS bd_giao,
 *      quyền Làm r.baoduong), Làm gì, Báo cáo ở đâu, Tài sản.
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
  var TOI_PC = 30, TOI_DT = 14;   // số ngày TỚI sau cột hôm nay ghim (29/10 phương án A2)
  var chuan = function (s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim().toUpperCase(); };
  var nhomCua = function (s) { var u = chuan(s); return u === "KT CƠ ĐIỆN" ? "KỸ THUẬT CƠ ĐIỆN" : u; };
  /* nhóm thực hiện → nhãn + lớp màu (biến màu của trang, không mã màu cứng) */
  var NHOM = { "VẬN HÀNH": ["Vận hành", "n-vh"], "VẬN HÀNH + BẢO TRÌ": ["Vận hành + Bảo trì", "n-vhbt"], "BẢO TRÌ": ["Bảo trì", "n-bt"], "KỸ THUẬT CƠ ĐIỆN": ["KT cơ điện", "n-kt"], "CHƯA XÁC ĐỊNH": ["Chưa xác định", "n-cxd"] };
  var nhanNhom = function (n) { var x = NHOM[nhomCua(n)] || [n || "?", "n-cxd"]; return '<span class="bd-nhom ' + x[1] + '">' + esc(x[0]) + "</span>"; };
  var NGUON = [["he-thong|phan-cong", "Theo hệ thống · Phân công (g-sheet)"], ["he-thong|work", "Theo hệ thống · Chia việc work"], ["he-thong|lan-truoc", "Theo hệ thống · Làm lần trước"], ["chi-dinh|", "Chỉ định (nhập tên / mã NV)"]];
  var xong = function (st) { return st === 3 || st === 4; };
  /* tài khoản THỬ thao tác (28/10 user: «Lê Chí Tâm chỉ là người thử thao tác, không phải luôn làm») — không suy làm người phụ trách.
     Cùng danh sách với sync-vesinh-all.js (TK_THU) */
  var TK_THU = { "tamlc@hasaki.vn": 1 };
  var laDT = function () { return window.matchMedia("(max-width:768px)").matches; };

  var PANE = null, S = { ok: false, loi: "", dv: [], yc: [], ky: [], giao: {}, ts: 0, lastAt: 0, chon: "", soNgay: 0, luu: {}, moNhom: {}, locNay: "", locHm: "", locAi: "", moLocNay: false, khoang: null, khoangTuDong: true, cuonX: null };

  function napCss() {
    if ($id("bd-css")) return;
    var B = ":is(#pane-baoduong,#hpVtBody)";
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
      B + " .bd-hm td.vt{position:sticky;left:0;z-index:1;background:var(--surface);max-width:240px;overflow:hidden;text-overflow:ellipsis;padding:0 10px 0 4px;font-size:12px;line-height:20px;color:var(--text);border-radius:4px}",
      B + " .bd-hm tr.vtr{cursor:pointer}",
      B + " .bd-hm tr.vtr:hover td.vt{background:var(--ad-re,var(--hover))}",
      B + " .bd-hm tr.vtr.on td.vt{color:var(--accent);font-weight:600;background:var(--ad-chon,var(--hover))}",
      B + " .bd-hm tr.vtr.trong td.vt{color:var(--muted)}",
      /* cột tên KHOÁ khi cuộn ngang ngày (cả ô góc đầu lưới) */
      B + " .bd-hm thead th.th-goc{position:sticky;left:0;z-index:2;background:var(--surface)}",
      B + " .bd-hm td.vt .bd-ten{display:block;overflow:hidden;text-overflow:ellipsis}",
      /* mục CHỦ: hàng nền xám, chữ đậm, mũi tên, số vị trí; mục CON: thụt lề + vạch nối */
      B + " .bd-hm tr.gd td.vt .bd-gdv{display:flex;align-items:center;gap:6px}",
      B + " .bd-hm tr.gd td.vt{background:var(--ad-nen2,var(--surface2));padding:4px 10px 4px 6px;font-size:13px;line-height:20px;color:var(--text)}",
      B + " .bd-hm tr.gd td.vt .bd-ten{flex:0 1 auto;min-width:0}",
      B + " .bd-hm tr.gd td.vt .bd-sl{flex:none;font-size:11px;line-height:16px;font-weight:600;padding:0 6px;border-radius:8px;color:var(--muted);background:var(--surface);border:1px solid var(--ad-chia,var(--border))}",
      B + " .bd-hm tr.gd:hover td.vt{color:var(--accent)}",
      B + " .bd-hm tr.gd>td:not(.vt){background:color-mix(in srgb,var(--ad-nen2,var(--surface2)) 55%,transparent)}",
      B + " .bd-hm tr.gd:not(:first-child) td{border-top:6px solid var(--surface)}",
      B + " .bd-hm tr.vtr.con td.vt{position:sticky;padding-left:24px}",
      B + " .bd-hm tr.vtr.con td.vt::before{content:'';position:absolute;left:11px;top:-2px;bottom:-2px;border-left:1px solid var(--ad-chia,var(--border))}",
      B + " .bd-hm tr.vtr.con.cuoi td.vt::before{bottom:50%}",
      B + " .bd-hm tr.vtr.con td.vt::after{content:'';position:absolute;left:11px;top:50%;width:8px;border-top:1px solid var(--ad-chia,var(--border))}",
      B + " .bd-hm td .bd-o{display:block;width:16px;height:16px;margin:0 auto}",
      /* 29/10 A2: cột HÔM NAY ghim ngay sau cột tên (--bd-wvt = bề rộng cột tên, đặt ở ganThuoc); bóng mép phải = dải ngày trượt bên dưới */
      B + " .bd-hm :is(td.nay,th.th-nay){position:sticky;left:var(--bd-wvt,0);z-index:1;min-width:34px;padding:0 6px;background:color-mix(in srgb,var(--accent) 8%,var(--surface));" +
        "box-shadow:-2px 0 0 var(--surface),2px 0 0 var(--accent),8px 0 8px -6px color-mix(in srgb,var(--text) 35%,transparent)}",
      B + " .bd-hm thead :is(th.th-goc,th.th-nay){z-index:6}" + B + " .bd-hm thead th.th-nay{vertical-align:bottom;padding:2px 6px 4px;border-radius:6px 6px 0 0;line-height:12px;color:var(--accent)}",
      B + " .bd-hm thead th.th-nay span{display:block;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.3px}",
      B + " .bd-hm thead th.th-nay b{display:block;font-size:15px;line-height:18px;font-weight:700;color:var(--text)}",
      B + " .bd-hm tr.gd td.nay{background:color-mix(in srgb,var(--accent) 12%,var(--ad-nen2,var(--surface2)))}",
      B + " .bd-hm tr.vtr.on td.nay{background:color-mix(in srgb,var(--accent) 16%,var(--surface))}",
      /* ngày đã qua mờ đi (rê hàng thì rõ lại) · vạch xanh trước NGÀY MAI = chỗ của hôm nay theo thời gian */
      B + " .bd-hm td.qua .bd-o{opacity:.55;transition:opacity .15s}" + B + " .bd-hm tr:hover td.qua .bd-o{opacity:1}",
      B + " .bd-hm thead th.qua{opacity:.7}",
      B + " .bd-hm :is(td,th).ranh{box-shadow:inset 2px 0 0 var(--accent)}" + B + " .bd-hm thead th.th-thang.ranh{box-shadow:inset 2px 0 0 var(--accent)}",
      /* ô SẮP TỚI: kỳ định kỳ chưa tới hạn — viền đứt, chưa có trạng thái */
      B + " .bd-o.p," + B + " .bd-chu i.p{background:transparent;outline:1.5px dashed var(--muted);outline-offset:-1.5px}",
      /* thước thời gian */
      B + " .bd-thuoc{display:flex;align-items:center;gap:8px;margin:0 0 10px;font-size:11px;line-height:16px;color:var(--muted)}",
      B + " .bd-thuoc-mep{flex:none;font-variant-numeric:tabular-nums}",
      B + " .bd-thuoc-ray{position:relative;flex:1 1 auto;min-width:80px;height:24px;border-radius:6px;background:var(--ad-nen2,var(--surface2));cursor:pointer;touch-action:none;overflow:hidden}",
      B + " .bd-thuoc-ray:focus-visible{outline:none;box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 25%,transparent)}",
      B + " .bd-thuoc-moc{position:absolute;top:4px;padding-left:4px;border-left:1px solid var(--ad-chia,var(--border));font-size:10px;line-height:16px;font-weight:600;white-space:nowrap;pointer-events:none}",
      B + " .bd-thuoc-vach{position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;background:var(--warn);pointer-events:none}",
      B + " .bd-thuoc-khung{position:absolute;top:0;bottom:0;border:2px solid var(--accent);border-radius:6px;background:color-mix(in srgb,var(--accent) 10%,transparent);cursor:grab;pointer-events:none}",
      B + " .bd-thuoc-ray.keo .bd-thuoc-khung{cursor:grabbing;background:color-mix(in srgb,var(--accent) 18%,transparent)}",
      B + " .bd-thuoc-nut{display:flex;flex:none;gap:6px}",
      /* thẻ Cách làm */
      B + " .bd-buoc{margin:0;padding-left:20px}",
      B + " .bd-buoc li{margin-bottom:8px;font-size:13px;line-height:20px}",
      B + " .bd-buoc li b{font-weight:600}",
      B + " .bd-buoc li .bd-nd{display:block;font-size:12px;line-height:18px;color:var(--muted);white-space:pre-line}",
      /* nhãn nhóm thực hiện */
      B + " .bd-nhom{display:inline-block;font-size:12px;line-height:20px;padding:0 8px;border-radius:4px;white-space:nowrap;border:1px solid}",
      B + " .bd-nhom.n-vh{color:var(--accent);border-color:color-mix(in srgb,var(--accent) 40%,transparent);background:color-mix(in srgb,var(--accent) 8%,transparent)}",
      B + " .bd-nhom.n-bt{color:var(--info);border-color:color-mix(in srgb,var(--info) 40%,transparent);background:color-mix(in srgb,var(--info) 8%,transparent)}",
      B + " .bd-nhom.n-kt{color:var(--warn);border-color:color-mix(in srgb,var(--warn) 45%,transparent);background:color-mix(in srgb,var(--warn) 8%,transparent)}",
      B + " .bd-nhom.n-vhbt{color:var(--good);border-color:color-mix(in srgb,var(--good) 45%,transparent);background:color-mix(in srgb,var(--good) 8%,transparent)}",
      B + " .bd-nhom.n-cxd{color:var(--muted);border-color:var(--ad-chia,var(--border));background:var(--ad-nen2,var(--surface2))}",
      /* bảng việc theo kỳ */
      B + " .bd-wrap .bd-phu{display:block;font-size:12px;line-height:18px;color:var(--muted)}",
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
      B + " .bd-hm thead th.th-thu.chunhat{color:var(--bad)}",   // KHÔNG đặt lớp «cn» — trùng viên Cập nhật của trang (viền tròn cao 36px ⇒ đầu lưới lệch)
      B + " .bd-hm td .bd-o{cursor:pointer}",
      /* ô có SỐ = việc định kỳ (1 · 3 · 6 tháng, T = hàng tuần) */
      B + " :is(.bd-o,.bd-chu i).co-ky{position:relative}",
      B + " :is(.bd-o,.bd-chu i).co-ky::after{content:attr(data-ky);position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;line-height:1;color:var(--surface)}",
      B + " .bd-o.co-ky:is(.m,:not(.x):not(.d):not(.b):not(.p))::after{color:var(--bad)}",
      B + " .bd-o.co-ky.p::after," + B + " .bd-chu i.co-ky.p::after{color:var(--muted)}",
      B + " .bd-chu i.co-ky{width:14px;height:14px;vertical-align:-3px}",
      B + " .bd-hm td .bd-o.tb-dangxem{outline:2px solid var(--accent);outline-offset:1px}",
      B + " .bd-xam{font-weight:400;color:var(--muted)}",
      "#pane-baoduong .bd-cn{align-items:center;gap:6px;margin-bottom:16px}",
      "#pane-baoduong .bd-nay-bl{grid-template-columns:repeat(2,minmax(0,260px))}",
      "@media(max-width:560px){#pane-baoduong .bd-nay-bl{grid-template-columns:minmax(0,1fr)}}",
      "#pane-baoduong .bd-gs{display:inline-flex;align-items:flex-start;gap:2px;padding:6px 8px;border-radius:8px;text-decoration:none;transition:background .15s}",
      "#pane-baoduong .bd-gs:hover{background:var(--ad-re,var(--hover))}",
      "#pane-baoduong .bd-gs-mui{font-size:13px;line-height:14px;font-weight:700;color:var(--muted)}",
      "#pane-baoduong .bd-gs:hover .bd-gs-mui{color:var(--accent)}",
      "#pane-baoduong .bd-panel>.panel-head .bd-phai .date-btn{min-height:32px}",
      /* thanh bên: yêu cầu ngày */
      B + " .bd-hm td.vt{width:1%}",
      /* ảnh báo cáo của yêu cầu đã hoàn thành */
      B + " .bd-hm td .bd-o.co-anh{cursor:zoom-in;box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--surface) 70%,transparent)}",
      /* điện thoại: hàng gộp hạng mục (chạm mở/thu) */
      B + " .bd-hm tr.gd{cursor:pointer}",
      B + " .bd-hm tr.gd td.vt{font-weight:600}",
      B + " .bd-hm tr.gd td.vt .bd-mui{display:inline-block;flex:none;width:12px;text-align:center;font-size:16px;color:var(--muted);transition:transform .2s var(--ez-apple,ease)}",
      B + " .bd-hm tr.gd.mo td.vt .bd-mui{transform:rotate(90deg)}",
      B + " .bd-nhan:not(.mo){display:none}",
      B + " .bd-nhan.mo{flex-basis:100%;margin-top:6px}",
      B + " .bd-ng{font-size:13px;line-height:20px;color:var(--text);font-weight:600}",
      B + " .bd-ng.bd-thieu{color:var(--bad);font-weight:400}",
      B + " .bd-phu{display:block;font-size:12px;line-height:18px;color:var(--muted)}",
      B + " .bd-pc{display:flex;flex-direction:column}",
      B + " .bd-pc .bd-pc-dong:first-of-type{border-top:0;padding-top:0}",
      B + " .bd-buoc{margin:0;padding-left:18px;font-size:12.5px}",
      B + " .hp-vtcard{margin-top:10px}",
      B + " .hp-vtduo .hp-vtcard{margin-top:0}",
      B + " .hp-vtthumbs a{display:block;line-height:0}",
      B + " .bd-pc-dong{display:flex;flex-wrap:wrap;align-items:flex-start;gap:6px 10px;padding:8px 0;border-top:1px solid var(--ad-chia,var(--border))}",
      B + " .bd-pc-dong:first-child{border-top:0;padding-top:0}",
      B + " .bd-pc-than{flex:1;min-width:0}",
      /* Phụ trách: dòng đầu = nhóm (trái) · khi nào (phải); dòng dưới = từng người · Đổi */
      B + " .bd-pc .bd-pc-dong{display:block;padding:10px 0}",
      B + " .bd-pc-dau{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}",
      B + " .bd-pc-khi{display:flex;flex-direction:column;align-items:flex-end;text-align:right;font-size:12px;line-height:18px;color:var(--text);min-width:0}",
      B + " .bd-pc-khi b{font-weight:600}",
      B + " .bd-pc-ai{display:flex;flex-wrap:wrap;align-items:flex-start;gap:6px 10px;margin-top:6px;padding-left:2px}",
      B + " .bd-pc-ai .bd-pc-than{display:flex;flex-direction:column}",
      B + " .bd-pc-ai .bd-ng{line-height:20px}",
      /* thẻ ẩn/hiện có mũi tên (khuôn .hp-vtts của Planogram, nhưng bấm được cả trên web) */
      B + " .bd-gap>summary{list-style:none;display:flex;align-items:center;gap:8px;cursor:pointer;min-height:24px;-webkit-tap-highlight-color:transparent}",
      B + " .bd-gap>summary::-webkit-details-marker{display:none}",
      B + " details.hp-vtcard:not([open]){gap:0}",
      B + " .bd-gap-mui{margin-left:auto;flex:none;display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;margin-right:-6px;border-radius:8px;" +
        "font-size:14px;color:var(--muted);cursor:pointer;transition:transform .2s var(--ez-apple,ease),background .15s,color .15s}",
      B + " .bd-gap>summary:hover .bd-gap-mui{background:var(--ad-re,var(--hover));color:var(--accent)}",
      B + " .bd-gap>summary:focus-visible{outline:none;box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 25%,transparent);border-radius:8px}",
      B + " .bd-gap[open] .bd-gap-mui{transform:rotate(180deg)}",
      "@media(max-width:560px){" + B + " .bd-gap-mui{width:40px;height:40px;margin:-6px -8px -6px auto}}",
      B + " .bd-gap-tt{font-size:12px;font-weight:700;color:var(--accent);white-space:nowrap}",
      B + " .bd-pc-ai .bd-doi{margin-left:auto}",
      /* Việc hôm nay */
      B + " .bd-nay{padding-top:14px}",
      /* vòng tiến độ + ô lọc */
      B + " .bd-nay-tong{display:flex;align-items:center;gap:20px;margin-bottom:16px}",
      B + " .bd-vong{position:relative;flex:none;width:88px;height:88px}",
      B + " .bd-vong svg{width:100%;height:100%;transform:rotate(-90deg)}",
      B + " .bd-vong circle{fill:none;stroke-width:7}",
      B + " .bd-vong .nen{stroke:var(--ad-nen2,var(--surface2))}",
      B + " .bd-vong .tien{stroke:var(--good);stroke-linecap:round;animation:bd-vong-ve 1s var(--ez-apple,ease) both}",
      "@keyframes bd-vong-ve{from{stroke-dashoffset:var(--vong)}}",
      "@keyframes bd-thanh{from{transform:scaleX(0)}}",
      B + " .bd-vong-so{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.1}",
      B + " .bd-vong-so b{font-size:19px;font-weight:700;color:var(--text);font-variant-numeric:tabular-nums}",
      B + " .bd-vong-so small{font-size:10px;color:var(--muted);margin-top:2px}",
      B + " .bd-nay-loc{display:flex;flex-wrap:wrap;gap:8px;min-width:0}",
      B + " .bd-loc-o{--mau:var(--accent);display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:96px;padding:8px 14px 8px 12px;border:1px solid var(--ad-chia,var(--border));border-radius:10px;" +
        "background:var(--surface);font:inherit;color:var(--muted);cursor:pointer;text-align:left;position:relative;transition:border-color .2s,box-shadow .2s,transform .2s var(--ez-apple,ease),background .2s}",
      B + " .bd-loc-o .tkq-num{font-size:20px;line-height:24px;font-weight:700;color:var(--mau);font-variant-numeric:tabular-nums}",
      B + " .bd-loc-o .tkq-cap{font-size:12px;line-height:16px}",
      B + " .bd-loc-o.s-m{--mau:var(--warn)}" + B + " .bd-loc-o.s-d{--mau:var(--info,var(--accent))}" + B + " .bd-loc-o.s-x{--mau:var(--good)}" + B + " .bd-loc-o.s-b{--mau:var(--bad)}",
      B + " .bd-loc-o:hover{border-color:var(--mau);transform:translateY(-1px)}",
      B + " .bd-loc-o[aria-pressed=true]{border-color:var(--mau);background:color-mix(in srgb,var(--mau) 8%,var(--surface));box-shadow:0 0 0 3px color-mix(in srgb,var(--mau) 16%,transparent)}",
      B + " .bd-loc-o:focus-visible{outline:none;box-shadow:0 0 0 3px color-mix(in srgb,var(--mau) 30%,transparent)}",
      /* lưới thẻ việc */
      B + " .bd-nay-luoi{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;align-items:start}",
      /* khối hạng mục */
      B + " .bd-nk{min-width:0;border:1px solid var(--ad-chia,var(--border));border-radius:12px;background:var(--surface);padding:10px 4px 6px;animation:fadeUp .4s var(--ez-apple,ease) both}",
      B + " .bd-nk[hidden]{display:none}",
      B + " .bd-nk-dau{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:0 10px}",
      B + " .bd-nk-ten{font-size:13px;line-height:18px;font-weight:700;color:var(--text);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      B + " .bd-nk-so{flex:none;font-size:12px;font-weight:700;color:var(--muted);font-variant-numeric:tabular-nums}" + B + " .bd-nk-so.du{color:var(--good)}",
      B + " .bd-nk-thanh{height:3px;margin:6px 10px 0;border-radius:2px;background:var(--ad-nen2,var(--surface2));overflow:hidden}",
      B + " .bd-nk-thanh i{display:block;height:100%;border-radius:2px;background:var(--good);animation:bd-thanh .8s .2s var(--ez-apple,ease) both;transform-origin:left}",
      B + " .bd-nk-ai{padding:6px 10px 0;font-size:12px;line-height:16px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      B + " .bd-nk-ds{display:flex;flex-direction:column;margin-top:4px}",
      /* 1 dòng / việc: chấm trạng thái · tên vị trí · cờ định kỳ · ảnh */
      B + " .bd-tn{--mau:var(--warn);display:flex;align-items:center;gap:8px;min-width:0;min-height:32px;padding:4px 6px;margin:0 4px;border-radius:8px;font-size:12.5px;line-height:17px;color:var(--text);transition:background .15s}",
      B + " .bd-tn.s-d{--mau:var(--info,var(--accent))}" + B + " .bd-tn.s-x{--mau:var(--good)}" + B + " .bd-tn.s-b{--mau:var(--bad)}",
      B + " .bd-tn[hidden]{display:none}",
      B + " .bd-tn[data-bin]{cursor:pointer}" + B + " .bd-tn[data-bin]:hover{background:var(--ad-re,var(--hover))}",
      B + " .bd-tn[data-bin]:focus-visible{outline:none;box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 25%,transparent)}",
      B + " .bd-tn-cham{flex:none;width:8px;height:8px;border-radius:50%;background:var(--mau);box-shadow:0 0 0 3px color-mix(in srgb,var(--mau) 18%,transparent)}",
      B + " .bd-tn-ten{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      B + " .bd-tn-ai{display:block;font-size:11px;line-height:14px;color:var(--muted);overflow:hidden;text-overflow:ellipsis}",
      B + " .bd-tn.s-x .bd-tn-ten{color:var(--muted)}",
      B + " .bd-tn-so{flex:none;font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums}",
      B + " .bd-tn-ky{flex:none;padding:0 6px;border-radius:6px;font-size:10.5px;font-weight:700;line-height:16px;color:var(--accent);background:color-mix(in srgb,var(--accent) 10%,transparent)}",
      "@media (prefers-reduced-motion:reduce){" + B + " .bd-nk," + B + " .bd-vong .tien," + B + " .bd-nk-thanh i{animation:none}}",
      B + " .bd-nay-trong{padding:10px 6px;font-size:13px;color:var(--muted)}",
      /* nhiều yêu cầu cùng ngày: đầu từng yêu cầu */
      B + " .bd-ycdau{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;margin-top:12px;padding:6px 10px;border-radius:8px;font-size:12.5px;background:var(--ad-nen2,var(--surface2))}",
      B + " .bd-ycdau a{color:var(--accent);text-decoration:none}",
      B + " .bd-ycdau:first-child{margin-top:0}",
      B + " .bd-do{color:var(--bad)}",
      B + " .bd-trong .hsk-nut{margin-top:10px}",
      "@media(max-width:768px){" +
        B + " .bd-than{padding:10px 12px 12px}" +
        /* điện thoại: tên xuống tối đa 2 dòng thay vì cắt «Đèn LED Nhà …»; ngày cuộn ngang dưới cột tên khoá */
        B + " .bd-hm td.vt{min-width:118px;max-width:132px;padding-right:4px;white-space:normal}" +
        B + " .bd-hm td.vt .bd-ten{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:16px;white-space:normal}" +
        B + " .bd-hm tr.gd td.vt{font-size:12.5px;padding:4px 6px 4px 4px}" + B + " .bd-hm tr.vtr.con td.vt{padding-left:20px;font-size:12px}" +
        B + " .bd-hm tr.vtr.con td.vt::before," + B + " .bd-hm tr.vtr.con td.vt::after{left:8px}" + B + " .bd-hm tr.vtr.con td.vt::after{width:7px}" +
        B + " .bd-hm table{border-spacing:1px}" +
        B + " .bd-hm :is(td.nay,th.th-nay){min-width:30px;padding:0 3px}" + B + " .bd-hm thead th.th-nay span{font-size:8px;letter-spacing:0}" +
        B + " .bd-thuoc-mep," + B + " .bd-thuoc [data-thuoc='-7']," + B + " .bd-thuoc [data-thuoc='7']{display:none}" + B + " .bd-thuoc .hsk-nut{min-height:32px;height:32px;padding:0 10px;font-size:13px}" +
        /* điện thoại: vòng nhỏ + ô lọc cuộn ngang 1 hàng; thẻ 2 cột gọn */
        B + " .bd-nay-tong{gap:12px;margin-bottom:12px}" + B + " .bd-vong{width:68px;height:68px}" + B + " .bd-vong-so b{font-size:15px}" + B + " .bd-vong-so small{font-size:9px}" +
        B + " .bd-nay-loc{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;flex:1 1 auto}" + B + " .bd-nay-loc::-webkit-scrollbar{display:none}" +
        B + " .bd-loc-o{min-width:76px;flex:none;padding:6px 10px}" + B + " .bd-loc-o .tkq-num{font-size:17px;line-height:20px}" + B + " .bd-loc-o .tkq-cap{font-size:11px;white-space:nowrap}" +
        B + " .bd-nay-luoi{grid-template-columns:minmax(0,1fr);gap:8px}" + B + " .bd-tn{min-height:40px}" +
        B + " .bd-hm td .bd-o{width:12px;height:12px}" +
        B + " .bd-hm thead th{font-size:10px;line-height:11px;min-width:12px}" +
        B + " .bd-nhan{min-width:0;max-width:none}" + 
        B + " .bd-panel>.panel-head .ph-trai{flex:1 1 auto;min-width:0;overflow:visible;white-space:normal}" + B + " .bd-panel>.panel-head .ph-trai{flex-wrap:wrap}" + B +
            " .bd-panel>.panel-head .ph-dem{white-space:normal;flex:0 1 auto;min-width:0}" +
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
    var VT = {}, thuTu = [], CUM = {};
    S.dv.forEach(function (r) {
      var ma = String(r["MÃ VỊ TRÍ"] || "").split(/\n/).map(function (x) { return x.trim().toUpperCase(); });
      var ten = String(r["TÊN VỊ TRÍ"] || "").split(/\n/).map(function (x) { return x.trim(); });
      ma.forEach(function (m, i) {
        if (!/^F0-/.test(m)) return;
        var v = VT[m]; if (!v) { v = VT[m] = { bin: m, ten: ten[i] || "", hm: r["HẠNG MỤC"], nhom: {}, vh: [] }; thuTu.push(m); }
        if (!v.ten && ten[i]) v.ten = ten[i];
        var nh = nhomCua(r["NHÓM THỰC HIỆN"]) || "CHƯA XÁC ĐỊNH", n = v.nhom[nh] = v.nhom[nh] || { ts: {}, pt: {} };
        n.ts[r["TẦN SUẤT"]] = 1;
        String(r["NGƯỜI PHỤ TRÁCH"] || "").split(/\n|\//).forEach(function (p) { p = p.trim(); if (p && !/^[-–—]+$/.test(p)) n.pt[p] = 1; });
        if (nh === "VẬN HÀNH") v.vh.push(r);
        if (r["CỤM / HỆ THỐNG"]) (CUM[m] = CUM[m] || {})[chuanK(r["CỤM / HỆ THỐNG"])] = r["TẦN SUẤT"];
      });
    });
    S.vt = VT; S.thuTu = thuTu; S.cum = CUM; S.tsYc = {};
    /* task [BD] định kỳ (tab BAO-DUONG-KY) → ô lưới ở NGÀY ĐẦU KỲ của vị trí */
    S.kyNgay = {}; S.kySau = {};
    S.ky.forEach(function (k) {
      var b = k["MÃ VỊ TRÍ"], d = isoTuDmy(k["KỲ HIỆN TẠI"]); if (!VT[b]) return;
      if (d) { var t = S.kyNgay[b] = S.kyNgay[b] || {}; (t[d] = t[d] || []).push(k); }
      /* các kỳ SAU (cột KỲ TỚI của bd-task-ky, rồi + chu kỳ tháng) → ô «sắp tới» ở dải ngày tới; chưa có task nên chưa có trạng thái */
      var th = soThang(k["TẦN SUẤT"]), toi = congNgay(isoVN(Date.now()), 150);
      for (var n = isoTuDmy(k["KỲ TỚI"]); n && n <= toi; n = th ? congThangIso(n, th) : "") { var s = S.kySau[b] = S.kySau[b] || {}; (s[n] = s[n] || []).push(k); }
    });
  }
  /* 28/10 user «gom hết vào Lịch thực hiện, gắn cờ yêu cầu của việc 1 tháng / 3 tháng / 6 tháng». Cờ của 1 yêu cầu planogram: khung ảnh
     của lịch = cột CỤM / HỆ THỐNG g-sheet (26/10: lịch 540631 cửa cuốn 4 khung = đúng 4 dòng «3 tháng/lần») ⇒ MỌI khung khớp dòng định kỳ
     của vị trí đó thì yêu cầu là việc định kỳ, lấy tần suất dòng ấy. Không đoán theo số ngày xuất hiện (540631 từng chạy hằng ngày). */
  function chuanK(s) { return chuan(s).replace(/[^\p{L}\p{N}]+/gu, " ").trim(); }
  function isoTuDmy(s) { var m = String(s || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? m[3] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2) : ""; }
  function kyHieu(ts) { var u = chuan(ts); if (!u || /NGÀY/.test(u)) return ""; if (/TUẦN/.test(u)) return "T"; if (/HÀNG THÁNG/.test(u)) return "1"; var m = u.match(/(\d+)\s*THÁNG/); return m ? m[1] : ""; }
  function soThang(ts) { var k = kyHieu(ts); return /NĂM/.test(chuan(ts)) ? 12 : /^\d+$/.test(k) ? Number(k) : 0; }
  function congThangIso(iso, n) { var d = new Date(iso + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); }
  /* nhãn tần suất thống nhất: «Hàng tháng» → «1 tháng/lần» */
  function nhanTs(ts) { var k = kyHieu(ts); return !k ? ts : k === "T" ? "Hàng tuần" : k + " tháng/lần"; }
  function tsCuaYc(y) {
    var id = y["REQUEST ID"]; if (id in S.tsYc) return S.tsYc[id];
    var cum = S.cum[y["MÃ VỊ TRÍ"]] || {}, kh = String(y["KHUNG ẢNH"] || "").split("|").map(chuanK).filter(Boolean);
    var ts = kh.map(function (k) { return cum[k] || ""; }), dk = kh.length && ts.every(function (t) { return kyHieu(t); });
    return (S.tsYc[id] = dk ? ts[0] : "");
  }
  /* trạng thái 1 task định kỳ như ô lưới: xong xanh · đang làm cam · quá hạn đỏ · chưa làm (còn hạn) viền đỏ */
  function lopKy(k) { var t = k["TRẠNG THÁI"]; return /Hoàn thành/.test(t) ? "x" : /Quá hạn/.test(t) ? "b" : /Đang làm/.test(t) ? "d" : "m"; }

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
  var CHU_O = { x: "Đã báo cáo", d: "Đang làm", m: "Chưa làm", b: "Không làm", "": "Không có yêu cầu" };
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
  /* 29/10 user chốt PHƯƠNG ÁN A2: cột HÔM NAY ghim cứng ngay sau cột vị trí (bên trái dải ngày), dải ngày xếp đúng thời gian TRỪ hôm nay:
     cuộn trái = các ngày trước (ô mờ), cuộn phải = ngày tới (kỳ định kỳ sắp tới viền đứt). Mở trang dải đứng ở NGÀY MAI (vạch .ranh).
     Thước thời gian trên lưới: khung = đoạn đang xem, vạch = hôm nay; kéo/bấm thước hoặc nút ‹ 7 ngày · Hôm nay · 7 ngày › để nhảy. */
  function veLuoi() {
    var homNay = isoVN(Date.now()), theoBin = theoBinNgay(), dt = laDT();   // dt: mặc định gập mục chủ trên điện thoại
    var qua = dsKhoang().filter(function (d) { return d < homNay; }), toi = [];
    var soToi = Math.max(dt ? TOI_DT : TOI_PC, Math.ceil(((PANE && PANE.clientWidth) || 0) / (dt ? 13 : 18)));   // ≥ số cột nhìn thấy ⇒ cuộn được tới ngày mai ở mọi bề ngang
    if (S.khoang[1] >= homNay) for (var i = 1; i <= soToi; i++) toi.push(congNgay(homNay, i));
    var ngay = qua.concat(toi), ranh = toi[0] || "";
    var lopCot = function (d) { return (d < homNay ? " qua" : "") + (d === ranh ? " ranh" : ""); };
    var nhom = {}, thuTuHm = [];
    S.thuTu.forEach(function (b) { var hm = S.vt[b].hm; if (!nhom[hm]) { nhom[hm] = []; thuTuHm.push(hm); } nhom[hm].push(b); });
    /* đầu lưới 3 tầng: tháng (gộp cột) · ngày · thứ (CN tô đỏ); cột hôm nay gộp 3 tầng, ghim */
    var thang = [], dauThang = "";
    ngay.forEach(function (d) { var t = d.slice(0, 7); if (t !== dauThang) { thang.push({ t: t, n: 0, d: d }); dauThang = t; } thang[thang.length - 1].n++; });
    var dau = '<tr><th class="th-goc" rowspan="3"></th><th class="th-nay" rowspan="3" title="Hôm nay ' + esc(dm(homNay)) + '"><span>Hôm nay</span><b>' + homNay.slice(8) + "</b><span>" + thuCua(homNay) + "</span></th>" +
        thang.map(function (x) { return '<th class="th-thang' + lopCot(x.d) + '" colspan="' + x.n + '">' + (x.n >= 3 ? "Tháng " + Number(x.t.slice(5)) : "") + "</th>"; }).join("") + "</tr>" +
      "<tr>" + ngay.map(function (d) { return '<th class="th-ngay' + lopCot(d) + '">' + d.slice(8) + "</th>"; }).join("") + "</tr>" +
      "<tr>" + ngay.map(function (d) { var t = thuCua(d); return '<th class="th-thu' + (t === "CN" ? " chunhat" : "") + lopCot(d) + '">' + t + "</th>"; }).join("") + "</tr>";
    var tong = 0, bc = 0, hang = "";
    var dem = function (ds, ks) { tong += ds.length + ks.length; bc += ds.filter(function (y) { return xong(Number(y["STATUS ID"])); }).length + ks.filter(function (k) { return lopKy(k) === "x"; }).length; };
    /* task [BD] của kỳ hiện tại + các kỳ sau (chưa có task) */
    var kyCuaO = function (b, d) { return (((S.kyNgay || {})[b] || {})[d] || []).concat(d > homNay ? ((S.kySau || {})[b] || {})[d] || [] : []); };
    /* gộp màu yêu cầu planogram (lớp tính sẵn) với task định kỳ: cùng xanh mới xanh · có cam = cam · còn chưa làm = viền đỏ · còn lại đỏ.
       Ngày TỚI chưa xong = «sắp tới» (viền đứt), không phải «chưa làm». */
    var gop = function (lYc, ks, d) { var a = (lYc ? [lYc] : []).concat(ks.map(lopKy)); if (!a.length) return "";
      var l = a.every(function (x) { return x === "x"; }) ? "x" : a.indexOf("d") >= 0 ? "d" : a.indexOf("m") >= 0 ? "m" : "b";
      return d > homNay && (l === "m" || l === "b") ? "p" : l; };
    /* số cờ của ô: tần suất việc định kỳ (yêu cầu planogram khớp dòng định kỳ g-sheet, hoặc task [BD]) */
    var coKy = function (ds, ks) { var t = ds.map(tsCuaYc).concat(ks.map(function (k) { return k["TẦN SUẤT"]; })).filter(kyHieu)[0] || ""; return t; };
    var theO = function (l, ts, them) { return '<i class="bd-o ' + l + them.lop + (ts ? " co-ky" : "") + '"' + (ts ? ' data-ky="' + kyHieu(ts) + '"' : "") + them.attr +
      ' title="' + them.tieu + (ts ? " · việc định kỳ " + esc(nhanTs(ts)) : "") + '"></i>'; };
    /* ô gộp 1 hạng mục / ngày (mục chủ đang gập): mọi việc xong = xanh · có đang làm = cam · hôm nay còn thiếu = viền đỏ · còn lại = đỏ */
    var oGop = function (bins, d) {
      var ds = [], ks = []; bins.forEach(function (b) { ds = ds.concat((theoBin[b] || {})[d] || []); ks = ks.concat(kyCuaO(b, d)); }); if (!ds.length && !ks.length) return "";
      var st = ds.map(function (y) { return Number(y["STATUS ID"]); });
      var l = gop(ds.length ? (st.every(xong) ? "x" : st.indexOf(2) >= 0 ? "d" : d === homNay ? "m" : "b") : "", ks, d);
      return theO(l, coKy(ds, ks), { lop: "", attr: "", tieu: dm(d) + " · " + CHU_O[l] });
    };
    /* 28/10 user: «nhìn vào là biết mục nào chủ, mục nào con» + ẩn/hiện có mũi tên (khuôn mũi tên › xoay của thư viện) — cả web lẫn điện thoại.
       Mục chủ = hàng nền xám, chữ đậm, mũi tên, số vị trí; đang gập thì ô ngày = tổng các mục con. Mục con thụt lề + vạch nối bên trái.
       Mặc định: web mở, điện thoại gập; bấm rồi thì nhớ theo hạng mục. */
    thuTuHm.forEach(function (hm) {
      var mo = S.moNhom[hm] == null ? !dt : !!S.moNhom[hm];
      hang += '<tr class="gd' + (mo ? " mo" : "") + '" data-hm="' + esc(hm) + '" aria-expanded="' + mo + '"><td class="vt"><div class="bd-gdv"><span class="bd-mui">›</span><span class="bd-ten">' + o(hm) +
          '</span><span class="bd-sl" title="số vị trí">' + nhom[hm].length + '</span></div></td><td class="nay">' + (mo ? "" : oGop(nhom[hm], homNay)) + "</td>" +
        ngay.map(function (d) { return '<td class="' + lopCot(d).trim() + '">' + (mo ? "" : oGop(nhom[hm], d)) + "</td>"; }).join("") + "</tr>";
      nhom[hm].forEach(function (b, i) {
        var tb = theoBin[b] || {}, coYc = Object.keys(tb).length > 0 || Object.keys((S.kyNgay || {})[b] || {}).length > 0;
        if (!mo) { qua.concat(homNay).forEach(function (d) { dem(tb[d] || [], kyCuaO(b, d)); }); return; }
        var v = S.vt[b], tenHang = String(v.ten || b).split("|").pop().trim() || v.ten || b;
        var oNgay = function (d) {
          var ds = tb[d] || [], ks = kyCuaO(b, d), l = gop(lopO(ds, d, homNay), ks, d); if (d <= homNay) dem(ds, ks);
          var ai = ds.map(function (y) { return y["NGƯỜI LÀM"]; }).filter(Boolean).join(", ");
          var coAnh = l === "x" && ds.some(function (y) { return y["ẢNH BÁO CÁO"]; });
          return theO(l, coKy(ds, ks), { lop: coAnh ? " co-anh" : "", attr: ' data-ngay="' + d + '"' + (ks.length ? ' data-ky-task="' + ks.length + '"' : ""),
            tieu: thuCua(d) + " " + dm(d) + " · " + (l === "p" ? "Sắp tới" : CHU_O[l]) + (ai ? " · " + esc(ai) : "") + (coAnh ? " · có ảnh" : "") });
        };
        hang += '<tr class="vtr con' + (i === nhom[hm].length - 1 ? " cuoi" : "") + (coYc ? "" : " trong") +
          '" data-bin="' + esc(b) + '" title="' + esc((v.ten || "") + " · " + b) + '"><td class="vt"><span class="bd-ten">' + o(tenHang) + '</span></td><td class="nay">' + oNgay(homNay) + "</td>" +
          ngay.map(function (d) { return '<td class="' + lopCot(d).trim() + '">' + oNgay(d) + "</td>"; }).join("") + "</tr>";
      });
    });
    /* thước thời gian: mốc đầu tháng + vạch hôm nay (giữa hôm qua và ngày mai) theo tỉ lệ cột; khung đoạn đang xem do ganThuoc() đặt */
    var pt = function (i) { return (100 * i / ngay.length).toFixed(2) + "%"; };
    var thuoc = ngay.length ? '<div class="bd-thuoc" id="bdThuoc"><span class="bd-thuoc-mep">' + esc(dm(ngay[0])) + '</span><div class="bd-thuoc-ray" role="slider" aria-label="Đoạn ngày đang xem" tabindex="0">' +
        thang.map(function (x, j) { var i = ngay.indexOf(x.d); return (j || i > 0) && i < ngay.length * 0.94 ? '<span class="bd-thuoc-moc" style="left:' + pt(i) + '">Th ' + Number(x.t.slice(5)) + "</span>" : ""; }).join("") +
        (toi.length ? '<i class="bd-thuoc-vach" style="left:' + pt(qua.length) + '" title="Hôm nay"></i>' : "") + '<i class="bd-thuoc-khung"></i></div><span class="bd-thuoc-mep">' + esc(dm(ngay[ngay.length - 1])) + "</span>" +
        '<span class="bd-thuoc-nut"><button type="button" class="hsk-nut phu nho" data-thuoc="-7" aria-label="Lùi 7 ngày">‹ 7 ngày</button>' +
        '<button type="button" class="hsk-nut phu nho" data-thuoc="0">Hôm nay</button>' +
        '<button type="button" class="hsk-nut phu nho" data-thuoc="7" aria-label="Tới 7 ngày">7 ngày ›</button></span></div>' : "";
    return '<div class="panel bd-panel" id="bdLich"><div class="panel-head"><span class="ph-trai"><span class="ph-td">Lịch thực hiện</span><span class="ph-dem">' +
      S.thuTu.length + " vị trí · " + (qua.length + 1) + " ngày" + (toi.length ? " + " + toi.length + " ngày tới" : "") + " · " + bc + "/" + tong + " yêu cầu đã báo cáo</span></span>" +
      '<span class="bd-phai"><div id="bdLocNgay"></div></span></div>' +
      '<div class="bd-than"><div class="bd-chu"><span><i class="x"></i>Đã báo cáo</span><span><i class="d"></i>Đang làm</span><span><i class="m"></i>Chưa làm (hôm nay / còn hạn)</span><span><i class="b"></i>Không làm</span>' +
        '<span><i class="p"></i>Sắp tới</span><span><i></i>Không có yêu cầu</span><span><i class="x co-ky" data-ky="3"></i>Việc định kỳ: số = 1 · 3 · 6 tháng/lần (T = hàng tuần)</span><span><b class="bd-xam">Tên xám</b> chưa có lịch</span></div>' +
      thuoc + '<div class="bd-hm"><table><thead>' + dau + "</thead><tbody>" + hang + "</tbody></table></div></div></div>";
  }
  /* sau mỗi lần vẽ lưới: đặt chỗ ghim cột hôm nay (= bề rộng cột tên), cuộn dải về NGÀY MAI (hoặc chỗ cũ khi chỉ gập/mở), nối thước ↔ cuộn */
  function ganThuoc() {
    var vc = PANE.querySelector("#bdLich .bd-hm"), goc = vc && vc.querySelector("th.th-goc"), nay = vc && vc.querySelector("th.th-nay"); if (!goc || !nay) return;
    var sp = parseFloat(getComputedStyle(vc.querySelector("table")).borderSpacing) || 0;
    vc.style.setProperty("--bd-wvt", goc.offsetWidth + sp + "px");
    var ranh = vc.querySelector("thead th.th-ngay.ranh"), cot1 = vc.querySelector("thead th.th-ngay");
    /* toạ độ trong vùng cuộn (offsetLeft ở đây tính theo khung ngoài có position — không dùng được) */
    var xNoi = function (e) { return e.getBoundingClientRect().left - vc.getBoundingClientRect().left + vc.scrollLeft; };
    var tren = function () { return goc.offsetWidth + nay.offsetWidth + 3 * sp; };   // phần ghim bên trái
    var veMai = function () { return ranh ? xNoi(ranh) - tren() : vc.scrollWidth; };
    vc.scrollLeft = S.cuonX != null ? S.cuonX : veMai();
    var T = $id("bdThuoc"); if (!T) return;
    var ray = T.querySelector(".bd-thuoc-ray"), kh = T.querySelector(".bd-thuoc-khung");
    var x0 = cot1 ? xNoi(cot1) - sp : tren(), dai = function () { return Math.max(1, vc.scrollWidth - x0); };
    var capNhat = function () { var d = dai(), nhin = Math.max(0, vc.clientWidth - tren());
      kh.style.left = (100 * vc.scrollLeft / d).toFixed(2) + "%"; kh.style.width = Math.min(100, 100 * nhin / d).toFixed(2) + "%"; };
    var cho = 0; vc.addEventListener("scroll", function () { S.cuonX = vc.scrollLeft; if (!cho) cho = requestAnimationFrame(function () { cho = 0; capNhat(); }); }, { passive: true });
    var toi = function (e) { var r = ray.getBoundingClientRect(), f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); vc.scrollLeft = f * dai() - (vc.clientWidth - tren()) / 2; };
    ray.addEventListener("pointerdown", function (e) { ray.setPointerCapture(e.pointerId); ray.classList.add("keo"); toi(e); });
    ray.addEventListener("pointermove", function (e) { if (ray.hasPointerCapture(e.pointerId)) toi(e); });
    ray.addEventListener("pointerup", function () { ray.classList.remove("keo"); });
    ray.addEventListener("keydown", function (e) { var c = (cot1 ? cot1.offsetWidth + sp : 18); if (e.key === "ArrowLeft") { vc.scrollLeft -= c; e.preventDefault(); } if (e.key === "ArrowRight") { vc.scrollLeft += c; e.preventDefault(); } });
    T.querySelectorAll("[data-thuoc]").forEach(function (n) {
      n.addEventListener("click", function () { var k = Number(n.getAttribute("data-thuoc")), c = (cot1 ? cot1.offsetWidth + sp : 18);
        vc.scrollTo({ left: k ? vc.scrollLeft + k * c : veMai(), behavior: "smooth" }); });
    });
    capNhat();
  }

  /* ===== ② THANH BÊN PHẢI — VỎ CỦA PLANOGRAM (#hpVtModal), CHỈ KHÁC DỮ LIỆU =====
     28/10 user: «làm thanh bên phải theo giao diện thanh bên phải planogram — thiết kế như nhau chỉ khác dữ liệu». Không dựng khung riêng:
     HPLANOGRAM.moVoVt("bd") mở đúng khung đó (đầu: mã vị trí · phụ đề · link yêu cầu · Đóng; dải ô ngày .hp-vthist; dòng .hp-vtrow;
     cặp thẻ .hp-vtduo Phụ trách | Báo cáo gần nhất; thẻ .hp-vtcard; Tài sản tại vị trí = HPLANOGRAM.theTaiSan). Mô-đun Planogram nạp lười,
     KHÔNG khởi động (không tải dữ liệu planogram). */
  var PG_CT = "https://planogram.hasaki.vn/asset-management/request-of-declaration/details/";
  var _plg = null;
  function napPlg() {
    if (window.HPLANOGRAM && window.HPLANOGRAM.moVoVt) return Promise.resolve();
    if (_plg) return _plg;
    var l = document.querySelector('link[href^="hasaki-planogram.js"]'), src = l ? l.getAttribute("href") : "hasaki-planogram.js";
    _plg = new Promise(function (res, rej) { var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = function () { _plg = null; rej(new Error("Không tải được khung thanh bên")); }; document.body.appendChild(s); });
    return _plg;
  }
  var MAU_O = { x: "var(--good)", d: "var(--warn)", m: "color-mix(in srgb,var(--bad) 45%,var(--surface))", b: "var(--bad)" };
  function badge(chu, mau) { return '<span class="hp-badge" style="background:color-mix(in srgb,' + mau + ' 15%,transparent);color:' + mau + '">' + esc(chu) + "</span>"; }
  function oAnh(y, a, i) {
    return '<a class="bd-anh" href="' + esc(a.url) + '" target="_blank" rel="noopener" data-rid="' + esc(y["REQUEST ID"]) + '" data-so="' + i + '" title="' + esc(a.khung) + '"><img src="' + esc(a.url) + '" alt="' +
        esc(a.khung) + '" loading="lazy" decoding="async"></a>';
  }
  /* dải 7 ô ngày như Planogram: 7 ngày tới ngày đang xem (đang xem gần hôm nay thì 7 ngày cuối) */
  function veDai(b, d) {
    var homNay = isoVN(Date.now()), cuoi = congNgay(d, 3) > homNay ? homNay : congNgay(d, 3), tb = {};
    ycCua(b).forEach(function (y) { (tb[y["NGÀY"]] = tb[y["NGÀY"]] || []).push(y); });
    var o7 = []; for (var i = 6; i >= 0; i--) { var n = congNgay(cuoi, -i); if (n >= ngayDau()) o7.push(n); }
    return '<div class="hp-vthistrow">' + o7.map(function (n) { var l = lopO(tb[n] || [], n, homNay);
      return '<span class="hp-vthist' + (n === d ? " on" : "") + (l ? "" : " trong") + '"' + (l ? ' style="background:' + MAU_O[l] + '"' : "") + ' title="' + esc(dm(n) + " — " + CHU_O[l]) + '" data-sang="' + n + '"><b>' +
          thuCua(n) + "</b>" + dm(n) + "</span>";
    }).join("") + "</div>";
  }
  /* 28/10 user «hiển thị NV (yenntk6@hasaki.vn) chưa đạt»: họ tên ĐẬM + mã NV (cột «Tên người làm», sync tra danh bạ theo email);
     không có trong danh bạ → rút gọn «@yenntk6» như trang Xác minh. Email đầy đủ để ở title. Người chưa nộp ghi «Đã mở, chưa nộp»
     (planogram ghi tên người MỞ yêu cầu, không phải người được giao — tránh hiểu nhầm «tamlc phụ trách»). */
  function nguoiLam(y) {
    var em = String(y["NGƯỜI LÀM"] || ""), t = String(y["TÊN NGƯỜI LÀM"] || "").split(" · ");
    return '<span title="' + esc(em) + '">' + (t[0] ? "<b>" + o(t[0]) + "</b>" + (t[1] ? ' <span class="hp-hint">' + esc(t[1]) + "</span>" : "") : o("@" + em.split("@")[0])) + "</span>";
  }
  function dong(nhan, gt) { return '<div class="hp-vtrow"><label>' + nhan + "</label><div>" + gt + "</div></div>"; }
  /* các dòng của NGÀY đang xem: trạng thái · người báo cáo · ảnh từng khung (thiếu khung nào nói tên) · cảnh báo khung lệch */
  function veNgay(b, v, d) {
    var ds = ycCua(b).filter(function (y) { return y["NGÀY"] === d; }), homNay = isoVN(Date.now()), ks = ((S.kyNgay || {})[b] || {})[d] || [];
    /* task [BD] định kỳ bắt đầu kỳ ngày này (đã gom từ khung Việc theo kỳ cũ vào lưới) */
    var kyHtml = ks.map(function (k) { var l = lopKy(k), tid = k["TASK ID"];
      return '<div class="bd-ycdau"><b>Việc định kỳ</b>' + badge(nhanTs(k["TẦN SUẤT"]), "var(--accent)") + nhanNhom(k["NHÓM THỰC HIỆN"]) +
          (tid ? '<a href="https://work.hasaki.vn/tasks?task_id=' + encodeURIComponent(tid) + '" target="_blank" rel="noopener">Task ' + esc(tid) + " ↗</a>" : "") + "</div>" +
        dong("Trạng thái", badge(k["TRẠNG THÁI"] || CHU_O[l], MAU_O[l] || "var(--muted)") + (k["HẠN"] ? ' <span class="hp-hint">hạn ' + esc(k["HẠN"]) + "</span>" : "")) +
        dong("Người nhận", k["NGƯỜI NHẬN"] ? o(k["NGƯỜI NHẬN"]) : '<span class="bd-do">Chưa giao người</span>') +
        dong("Số đầu việc", esc(k["SỐ ĐẦU VIỆC"] || "—"));
    }).join("");
    if (!ds.length) return kyHtml || dong("Trạng thái", '<span class="hp-hint">Không có yêu cầu bảo dưỡng ngày này</span>');
    /* 28/10 user «sao mục này lặp lại»: 1 vị trí có thể có 2 LỊCH planogram cùng ngày (26/10 cửa cuốn A1: lịch 540625 vận hành 2 khung +
       lịch 540631 bảo trì 4 khung) — không phải lặp; mỗi yêu cầu có đầu riêng (thứ tự · số yêu cầu · lịch · số khung) để phân biệt. */
    var nhieu = ds.length > 1 || ks.length > 0;
    return kyHtml + ds.map(function (y, i) {
      var st = Number(y["STATUS ID"]), l = lopO([y], d, homNay), anh = anhCua(y);
      var kh = String(y["KHUNG ẢNH"] || "").split("|").map(function (x) { return x.trim(); }).filter(Boolean);
      var thieu = kh.filter(function (k) { return !anh.some(function (a) { return a.khung === k; }); });
      var lech = kh.length && !/quạt/i.test(v.hm + " " + v.ten) && kh.some(function (k) { return /quạt/i.test(k); });
      return (nhieu ? '<div class="bd-ycdau"><b>Yêu cầu ' + (i + 1) + "/" + ds.length + '</b><a href="' + PG_CT + encodeURIComponent(y["REQUEST ID"]) + '" target="_blank" rel="noopener">#' +
            esc(y["REQUEST ID"]) + " ↗</a>" + '<span class="hp-hint">lịch ' + esc(y["SCHEDULE ID"] || "?") + " · " + kh.length + " khung ảnh</span></div>" : "") +
        (lech ? dong("Cảnh báo", badge("Khung ảnh của lịch là khung quạt — không khớp thiết bị, cần sửa lịch planogram", "var(--warn)")) : "") +
        dong("Trạng thái", badge(CHU_O[l] || y["TRẠNG THÁI"], MAU_O[l] || "var(--muted)") + (TT_YC[st] ? " " + badge(TT_YC[st], "var(--info)") : "") +
          (tsCuaYc(y) ? " " + badge("Định kỳ " + nhanTs(tsCuaYc(y)), "var(--accent)") : "")) +
        (y["NGƯỜI LÀM"] ? dong(xong(st) ? "Người báo cáo" : st === 2 ? "Đang làm" : "Đã mở, chưa nộp", nguoiLam(y) +
          (y["LÚC LÀM"] ? ' <span class="hp-hint">lúc ' + esc(String(y["LÚC LÀM"]).slice(11, 16) + " " + dm(String(y["LÚC LÀM"]).slice(0, 10))) + "</span>" : "")) : "") +
        dong("Ảnh báo cáo (" + anh.length + "/" + kh.length + ")", (anh.length ? '<div class="hp-vtthumbs">' + anh.map(function (a, i) { return oAnh(y, a, i); }).join("") + "</div>" : "") +
          (thieu.length ? '<div class="hp-hint">Chưa có ảnh: ' + thieu.map(esc).join(" · ") + "</div>" : ""));
    }).join("");
  }
  /* thẻ ẨN/HIỆN có mũi tên — khuôn thư viện của thẻ «Tài sản tại vị trí» (Planogram: <details class="hp-vtcard hp-vtts">, ▾ bên phải xoay khi mở).
     28/10 user: «Làm gì» + «Báo cáo ở đâu» gập được trên web lẫn điện thoại; đầu thẻ vẫn đủ tóm tắt khi gập.
     28/10 lượt sau (user CHỐT): «2 mục này LUÔN ẨN» ⇒ mỗi lần vẽ đều gập (không nhớ trạng thái).
     28/10 chiều user ĐỔI: «ấn vào là hiển thị, không phải buộc ấn mũi tên» ⇒ bấm CẢ DÒNG đầu thẻ (summary gốc) mở/đóng; mũi tên chỉ là dấu hiệu. */
  function theGap(khoa, tieu, tomTat, than) {
    return '<details class="hp-vtcard bd-gap" data-the="' + esc(khoa) + '"><summary><span class="hd">' + tieu + '</span><span class="bd-gap-tt">' + tomTat +
      '</span><span class="bd-gap-mui" aria-hidden="true">▾</span></summary>' + than + "</details>";
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
      return theGap("lam|" + ts, "Làm gì · " + esc(ts), rs.length + " việc" + (phut(rs) ? " · ~" + phut(rs) + " phút" : ""), '<ol class="bd-buoc">' + rs.map(function (r) {
        return "<li><b>" + o(r["HẠNG MỤC KIỂM TRA"]) + "</b>" + (r["THỜI GIAN"] ? ' <span class="bd-phu-n">· ' + o(r["THỜI GIAN"]) + "</span>" : "") + '<span class="bd-nd">' + o(r["NỘI DUNG CÔNG VIỆC"]) + "</span></li>";
      }).join("") + "</ol>");
    }).join("");
    var duong = v.vh.length ? theGap("duong", "Báo cáo ở đâu", "App Hasaki WMS", '<div class="ln">App <b>Hasaki WMS</b> › <b>Quản lý tài sản</b> (Asset Management) › <b>Báo cáo vệ sinh (vị trí)</b> (Declaration request (location))' +
      " › chọn kho và <b>Loại mục đích</b> (Purpose type) theo yêu cầu › quét mã <b>" + esc(b) + "</b> › <b>Chụp ảnh</b> (Take photo) đủ khung › <b>Hoàn thành yêu cầu</b> (Complete request)</div>") : "";
    /* báo cáo gần nhất (tham khảo) — như thẻ phải của Planogram */
    var gan = ycCua(b).filter(function (y) { return xong(Number(y["STATUS ID"])) && y["NGƯỜI LÀM"]; }).sort(function (a, c) { return String(c["LÚC LÀM"]).localeCompare(String(a["LÚC LÀM"])); })[0];
    var tuoi = gan ? Math.round((Date.parse(isoVN(Date.now())) - Date.parse(gan["NGÀY"])) / 864e5) : null;
    var cardBc = '<div class="hp-vtcard ref"><div class="hd">Báo cáo gần nhất <span class="hp-hint">tham khảo</span></div>' + (gan
      ? '<div class="who"><div><b>' + o(gan["NGƯỜI LÀM"]) + "</b></div></div>" + '<div class="ln"><b>' + thuCua(gan["NGÀY"]) + " " + dm(gan["NGÀY"]) + "</b>" +
        (gan["LÚC LÀM"] ? " lúc <b>" + esc(String(gan["LÚC LÀM"]).slice(11, 16)) + "</b>" : "") + ' <span class="hp-hint">· ' + (tuoi > 0 ? tuoi + " ngày trước" : "hôm nay") + "</span></div>"
      : '<div class="ln mut">chưa ai báo cáo vị trí này trong ' + NGAY_DU_LIEU + " ngày</div>") + "</div>";
    var ts = window.HPLANOGRAM && window.HPLANOGRAM.theTaiSan ? window.HPLANOGRAM.theTaiSan(b) : "";
    return '<div class="bd-ben">' + veDai(b, d) + veNgay(b, v, d) + '<div class="hp-vtduo">' + vePhanCong(b) + cardBc + "</div>" + lamGi + duong + ts + "</div>";
  }

  /* ===== PHÂN CÔNG THEO VỊ TRÍ =====
     27/10 tối (user): «phân công cần đi chi tiết, tuỳ biến đến từng vị trí cụ thể của tài sản — mục con A do X,Y làm, mục con B ở vị trí khác
     do Z,O». Khoá = HẠNG MỤC|NHÓM THỰC HIỆN|MÃ VỊ TRÍ (tab BAO-DUONG-GIAO). Cả việc Vận hành (lịch planogram) lẫn việc theo kỳ (task work). */
  function khoaGiao(b, nhom) { return S.vt[b].hm + "|" + nhom + "|" + b; }
  function kyCua(b, nhom) { return S.ky.filter(function (k) { return k["MÃ VỊ TRÍ"] === b && nhomCua(k["NHÓM THỰC HIỆN"]) === nhom; }); }
  /* gợi ý từng nguồn: phân công = g-sheet; làm lần trước = Vận hành: người làm yêu cầu planogram gần nhất · theo kỳ: người xong task kỳ trước;
     chia việc work = người đang được giao ở task kỳ trước (Vận hành không có task ⇒ trống) */
  function goiY(b, nhom) {
    var n = S.vt[b].nhom[nhom] || { pt: {} }, k = kyCua(b, nhom)[0] || {};
    /* 28/10 user: thẻ hiện «yenntk6@hasaki.vn», «tamlc@hasaki.vn» ⇒ lấy HỌ TÊN (cột «Tên người làm»), bỏ lượt của tài khoản THỬ (TK_THU) */
    var yLan = nhom === "VẬN HÀNH" ? (ycCua(b).filter(function (y) { return xong(Number(y["STATUS ID"])) && y["NGƯỜI LÀM"] && !TK_THU[String(y["NGƯỜI LÀM"]).toLowerCase()]; })
      .sort(function (a, c) { return String(c["LÚC LÀM"]).localeCompare(String(a["LÚC LÀM"])); })[0] || null) : null;
    var lan = yLan ? (String(yLan["TÊN NGƯỜI LÀM"] || "").split(" · ")[0] || "@" + String(yLan["NGƯỜI LÀM"]).split("@")[0]) : nhom === "VẬN HÀNH" ? "" : k["LÀM LẦN TRƯỚC"] || "";
    return { "phan-cong": Object.keys(n.pt).join(" / "), work: nhom === "VẬN HÀNH" ? "" : k["CHIA VIỆC WORK (KỲ TRƯỚC)"] || "", "lan-truoc": lan };
  }
  function cheDoCua(khoa) {
    if (S.luu[khoa]) return S.luu[khoa];
    var g = S.giao[khoa]; if (!g) return { v: "he-thong|phan-cong", chiDinh: "", ai: "", luc: "" };
    return { v: g["CHẾ ĐỘ"] === "chi-dinh" ? "chi-dinh|" : "he-thong|" + (g["NGUỒN"] || "phan-cong"), chiDinh: g["CHỈ ĐỊNH"] || "", ai: g["NGƯỜI LƯU"] || "", luc: g["LÚC LƯU"] || "" };
  }
  /* người phụ trách đang hiệu lực (cùng thứ tự với bd-task-ky: nguồn đã chọn, hụt thì nguồn khác) */
  function nguoiVt(b, nhom) {
    var cd = cheDoCua(khoaGiao(b, nhom)), gy = goiY(b, nhom);
    if (cd.v.indexOf("chi-dinh") === 0) return { ten: cd.chiDinh, nguon: "Chỉ định" };
    var chon = cd.v.split("|")[1] || "phan-cong", thu = [chon].concat(["phan-cong", "work", "lan-truoc"].filter(function (x) { return x !== chon; }));
    for (var i = 0; i < thu.length; i++) if (gy[thu[i]]) return { ten: gy[thu[i]], nguon: TEN_NGUON[thu[i]] };
    return { ten: "", nguon: "" };
  }
  var TEN_NGUON = { "phan-cong": "Phân công (g-sheet)", work: "Chia việc work", "lan-truoc": "Làm lần trước" };
  var duocSua = function () { return typeof window.tkCo === "function" && window.tkCo("r.baoduong", "lam") && !!phien(); };
  /* ô sửa người nhận — gập sau nút «Đổi», dùng chung cho thanh bên và khung Việc theo kỳ */
  function oSua(b, nhom) {
    if (!duocSua()) return "";
    var khoa = khoaGiao(b, nhom), cd = cheDoCua(khoa), gy = goiY(b, nhom), laCd = cd.v.indexOf("chi-dinh") === 0;
    return '<button type="button" class="hsk-nut phu nho bd-doi" aria-expanded="false">Đổi</button>' +
      '<div class="bd-nhan" data-khoa="' + esc(khoa) + '"><select class="bd-cdo" aria-label="Cách lấy người phụ trách">' + NGUON.map(function (n) {
        var g = gy[n[0].split("|")[1]]; return '<option value="' + n[0] + '"' + (n[0] === cd.v ? " selected" : "") + ">" + esc(n[1]) + (n[0] === "chi-dinh|" ? "" : ": " + (g ? esc(g) : "(trống)")) + "</option>";
      }).join("") + "</select>" +
      '<div class="bd-hang"' + (laCd ? "" : " hidden") + '><input type="text" class="bd-cd" maxlength="80" placeholder="Tên hoặc mã NV, nhiều người cách dấu phẩy" value="' + esc(cd.chiDinh) + '"></div>' +
      '<div class="bd-hang"><button type="button" class="hsk-nut chinh bd-luu">Lưu</button><span class="bd-dl">' + (cd.ai ? "Lưu bởi " + esc(cd.ai) + " · " + esc(cd.luc) : "") + "</span></div></div>";
  }
  /* 28/10 user «cải tiến hiển thị Phụ trách cho dễ hiểu, trực quan, logic»: mỗi nhóm thực hiện = 1 khối đọc theo câu hỏi
     AI LÀM (từng người 1 dòng, nguồn chữ nhỏ) · KHI NÀO (tần suất, kỳ tới, task — góc phải). Vận hành lên đầu; thiếu người = chữ đỏ «Chưa giao người». */
  var THU_NHOM = ["VẬN HÀNH", "VẬN HÀNH + BẢO TRÌ", "BẢO TRÌ", "KỸ THUẬT CƠ ĐIỆN", "CHƯA XÁC ĐỊNH"];
  function vePhanCong(b) {
    var v = S.vt[b], ds = Object.keys(v.nhom).sort(function (a, c) { return THU_NHOM.indexOf(a) - THU_NHOM.indexOf(c); });
    return '<div class="hp-vtcard pt bd-pc"><div class="hd">Phụ trách <span class="hp-hint">ai làm · khi nào</span></div>' + ds.map(function (nhom) {
      var n = v.nhom[nhom], k = kyCua(b, nhom)[0], ng = nguoiVt(b, nhom);
      var khi = '<span class="bd-pc-khi"><b>' + esc(Object.keys(n.ts).join(" · ")) + "</b>" + (k ? '<span class="bd-phu">kỳ tới ' + esc(k["KỲ TỚI"] || "—") + "</span>" +
          (k["TASK ID"] ? '<span class="bd-phu"><a href="https://work.hasaki.vn/tasks?task_id=' + encodeURIComponent(k["TASK ID"]) + '" target="_blank" rel="noopener">Task ' + esc(k["TASK ID"]) + " ↗</a></span>" : "") : "") + "</span>";
      var ai = ng.ten ? String(ng.ten).split(/\s*[\/,;]\s*/).filter(Boolean).map(function (t) { return '<span class="bd-ng">' + o(t) + "</span>"; }).join("") + '<span class="bd-phu">theo ' + esc(ng.nguon) + "</span>"
        : '<span class="bd-ng bd-thieu">Chưa giao người</span>';
      return '<div class="bd-pc-dong"><div class="bd-pc-dau">' + nhanNhom(nhom) + khi + '</div><div class="bd-pc-ai"><div class="bd-pc-than">' + ai + "</div>" + oSua(b, nhom) + "</div></div>";
    }).join("") + "</div>";
  }

  /* ===== ⓪ VIỆC HÔM NAY =====
     28/10 user: «có cần thêm Việc hôm nay — những việc có yêu cầu làm hôm nay» → thêm; lượt sau «cần trực quan hơn, hiệu ứng hơn, chuyên nghiệp
     hơn», bỏ dòng đếm chữ dưới tiêu đề. Nay: VÒNG tiến độ (đã báo cáo / tổng, vẽ dần) + Ô LỌC trạng thái (bấm = lọc thẻ) + LƯỚI THẺ, mỗi thẻ
     1 việc: dải màu trạng thái bên trái · hạng mục · tên vị trí · người phụ trách · thanh ảnh đã chụp / khung · cờ định kỳ. Thẻ hiện dần (fadeUp
     so le), rê chuột nhấc lên. Việc = yêu cầu planogram hôm nay (theo vị trí) + task [BD] định kỳ đang mở (gộp theo nhóm việc). Bấm thẻ → thanh bên. */
  var CHIP_O = { m: ["cho", "Chưa làm"], b: ["qua", "Quá hạn"], d: ["dang", "Đang làm"], x: ["xong", "Đã báo cáo"] };
  var VONG = 2 * Math.PI * 26;
  function veHomNay() {
    var homNay = isoVN(Date.now()), theoBin = {}, the = [];
    S.yc.forEach(function (y) { if (y["NGÀY"] === homNay && S.vt[y["MÃ VỊ TRÍ"]]) (theoBin[y["MÃ VỊ TRÍ"]] = theoBin[y["MÃ VỊ TRÍ"]] || []).push(y); });
    Object.keys(theoBin).forEach(function (b) {
      var ds = theoBin[b], v = S.vt[b], ng = nguoiVt(b, "VẬN HÀNH"), kh = 0, co = 0;
      ds.forEach(function (y) { var k = String(y["KHUNG ẢNH"] || "").split("|").filter(function (x) { return x.trim(); }).length; kh += k; co += Math.min(anhCua(y).length, k); });
      var l = lopO(ds, homNay, homNay);
      the.push({ b: b, l: l, hm: v.hm, ten: String(v.ten || b).split("|").pop().trim() || b, ai: ng.ten, kh: kh, co: co, ts: ds.map(tsCuaYc).filter(Boolean)[0] || "" });
    });
    /* task [BD] định kỳ đang trong kỳ, chưa xong — 1 thẻ / nhóm việc */
    var kyMo = {}, thuKy = [];
    S.ky.forEach(function (k) { if (!k["KỲ HIỆN TẠI"] || /Hoàn thành|Chưa tới|chưa hỗ trợ/.test(k["TRẠNG THÁI"])) return;
      var kh = k["KHOÁ NHÓM"]; if (!kyMo[kh]) { kyMo[kh] = []; thuKy.push(kh); } kyMo[kh].push(k); });
    thuKy.forEach(function (kh) {
      var ds = kyMo[kh], k0 = ds[0], ls = ds.map(lopKy), b = (ds.filter(function (k) { return S.vt[k["MÃ VỊ TRÍ"]]; })[0] || {})["MÃ VỊ TRÍ"] || "";
      the.push({ b: b, l: ls.indexOf("b") >= 0 ? "b" : ls.indexOf("d") >= 0 ? "d" : "m", hm: k0["HẠNG MỤC"], ten: (NHOM[nhomCua(k0["NHÓM THỰC HIỆN"])] || [k0["NHÓM THỰC HIỆN"]])[0] + " · " + ds.length + " vị trí",
        ai: k0["NGƯỜI NHẬN"], ts: k0["TẦN SUẤT"], han: k0["HẠN"], d: isoTuDmy(k0["KỲ HIỆN TẠI"]) });
    });
    /* bộ lọc Hạng mục · Người phụ trách (28/10 user «bổ sung bộ lọc ở thư viện vào Việc hôm nay») — lựa chọn lấy từ chính thẻ hôm nay */
    var tachAi = function (t) { return t.ai ? String(t.ai).split(/\s*[\/,;]\s*/).filter(Boolean) : ["Chưa giao người"]; };
    var dsHm = {}, dsAi = {};
    the.forEach(function (t) { dsHm[t.hm] = (dsHm[t.hm] || 0) + 1; tachAi(t).forEach(function (a) { dsAi[a] = (dsAi[a] || 0) + 1; }); });
    if (S.locHm && !dsHm[S.locHm]) S.locHm = ""; if (S.locAi && !dsAi[S.locAi]) S.locAi = "";
    var tatCa = the.length, dangLoc = !!(S.locHm || S.locAi);
    the = the.filter(function (t) { return (!S.locHm || t.hm === S.locHm) && (!S.locAi || tachAi(t).indexOf(S.locAi) >= 0); });
    var luaChon = function (id, nhan, tat, ds, chon) {
      return '<label><span class="lbl">' + nhan + '</span><select id="' + id + '"><option value="">' + tat + " (" + tatCa + ")</option>" +
        Object.keys(ds).sort(function (a, c) { return a.localeCompare(c, "vi"); }).map(function (k) {
          return '<option value="' + esc(k) + '"' + (k === chon ? " selected" : "") + ">" + esc(k) + " (" + ds[k] + ")</option>"; }).join("") + "</select></label>";
    };
    var khoiLoc = '<div class="filters bd-nay-bl' + (S.moLocNay ? "" : " collapsed") + '" id="bdNayLoc">' +
      luaChon("bdNayHm", "Hạng mục", "Tất cả hạng mục", dsHm, S.locHm) + luaChon("bdNayAi", "Người phụ trách", "Tất cả người", dsAi, S.locAi) + "</div>";
    var THU_L = { b: 0, m: 1, d: 2, x: 3 };
    the.sort(function (a, c) { return THU_L[a.l] - THU_L[c.l] || S.thuTu.indexOf(a.b) - S.thuTu.indexOf(c.b); });
    var dem = { m: 0, b: 0, d: 0, x: 0 }; the.forEach(function (t) { dem[t.l]++; });
    if (S.locNay && !dem[S.locNay]) S.locNay = "";
    var tong = the.length, ti = tong ? dem.x / tong : 0;
    var vong = '<div class="bd-vong" role="img" aria-label="Đã báo cáo ' + dem.x + " trên " + tong + '"><svg viewBox="0 0 64 64" aria-hidden="true"><circle class="nen" cx="32" cy="32" r="26"></circle>' +
        '<circle class="tien" cx="32" cy="32" r="26" style="stroke-dasharray:' + VONG.toFixed(1) + ";stroke-dashoffset:" + (VONG * (1 - ti)).toFixed(1) + ";--vong:" + VONG.toFixed(1) + '"></circle></svg>' +
      '<span class="bd-vong-so"><b>' + Math.round(ti * 100) + '%</b><small>đã báo cáo</small></span></div>';
    /* ô lọc = thẻ số của thư viện (tkq-card · tkq-num · tkq-cap, «Tổng kết nhanh») tô màu theo trạng thái */
    var oLoc = [["", "Tất cả", tong]].concat(["b", "m", "d", "x"].filter(function (k) { return dem[k] || k !== "b"; }).map(function (k) { return [k, CHIP_O[k][1], dem[k]]; }));
    var loc = '<div class="bd-nay-loc" role="group" aria-label="Lọc theo trạng thái">' + oLoc.map(function (x) {
      return '<button type="button" class="tkq-card bd-loc-o' + (x[0] ? " s-" + x[0] : "") + '" data-loc="' + x[0] + '" aria-pressed="' + (S.locNay === x[0]) + '"><span class="tkq-num">' + x[2] +
        '</span><span class="tkq-cap">' + x[1] + "</span></button>"; }).join("") + "</div>";
    /* 28/10 user «chưa ưng giao diện Việc hôm nay» — thẻ rời lặp hạng mục + chip «Chưa làm» + cùng cặp tên người ở mọi thẻ (LUẬT không lặp).
       Nay GOM THEO HẠNG MỤC: 1 khối / hạng mục — đầu khối: tên · x/y đã báo cáo + thanh mảnh · người phụ trách (ghi 1 lần nếu cả khối chung);
       thân: 1 DÒNG / việc = chấm màu trạng thái (màu = ô lọc phía trên, chữ trạng thái ở title) · tên vị trí · ảnh x/y · cờ định kỳ;
       người chỉ ghi ở dòng khi khác đầu khối. Bấm dòng → thanh bên. Lớp .bd-tn giữ cho từng việc (ô lọc trạng thái ẩn/hiện theo lớp này). */
    var khoi = [], theoHm = {};
    the.forEach(function (t) { if (!theoHm[t.hm]) { theoHm[t.hm] = []; khoi.push(t.hm); } theoHm[t.hm].push(t); });
    var the_ = khoi.map(function (hm, gi) {
      var ds = theoHm[hm], xongK = ds.filter(function (t) { return t.l === "x"; }).length;
      var aiK = ds.every(function (t) { return (t.ai || "") === (ds[0].ai || ""); }) ? ds[0].ai || "" : null;   // null = mỗi dòng một người
      var dong = ds.map(function (t) {
        var an = S.locNay && t.l !== S.locNay;
        return '<div class="bd-tn s-' + t.l + '"' + (t.b ? ' data-bin="' + esc(t.b) + '"' + (t.d ? ' data-ngay="' + t.d + '"' : "") + ' role="button" tabindex="0"' : "") + (an ? " hidden" : "") +
            ' title="' + esc(CHIP_O[t.l][1]) + '"><i class="bd-tn-cham" aria-hidden="true"></i>' +
          '<span class="bd-tn-ten">' + o(t.ten) + (aiK === null ? '<small class="bd-tn-ai">' + (t.ai ? o(t.ai) : '<span class="bd-do">Chưa giao người</span>') + "</small>" : "") + "</span>" +
          (t.ts ? '<span class="bd-tn-ky" title="Việc định kỳ ' + esc(nhanTs(t.ts)) + '">' + esc(nhanTs(t.ts)) + "</span>" : "") +
          '<span class="bd-tn-so">' + (t.kh ? t.co + "/" + t.kh + " ảnh" : t.han ? "hạn " + esc(t.han) : "") + "</span></div>";
      }).join("");
      return '<section class="bd-nk" style="animation-delay:' + Math.min(gi * 45, 400) + 'ms"><div class="bd-nk-dau"><span class="bd-nk-ten">' + o(hm) + "</span>" +
          '<span class="bd-nk-so' + (xongK === ds.length ? " du" : "") + '">' + xongK + "/" + ds.length + "</span></div>" +
        '<div class="bd-nk-thanh" aria-hidden="true"><i style="width:' + Math.round(100 * xongK / ds.length) + '%"></i></div>' +
        (aiK !== null ? '<div class="bd-nk-ai">' + (aiK ? o(aiK) : '<span class="bd-do">Chưa giao người</span>') + "</div>" : "") +
        '<div class="bd-nk-ds">' + dong + "</div></section>";
    }).join("");
    return '<div class="panel bd-panel" id="bdNay"><div class="panel-head"><span class="ph-trai"><span class="ph-td">Việc hôm nay</span></span>' +
        (tatCa ? '<button type="button" class="btn-filter' + (S.moLocNay ? " mo" : "") + (dangLoc ? " dang-loc" : "") + '" id="bdNayNut" aria-controls="bdNayLoc">' +
          (dangLoc ? "Bộ lọc · đang lọc" : "Bộ lọc") + "</button>" : "") + "</div>" + (tatCa ? khoiLoc : "") +
      '<div class="bd-than bd-nay">' + (tong ? '<div class="bd-nay-tong">' + vong + loc + '</div><div class="bd-nay-luoi">' + the_ + "</div>"
        : '<div class="bd-nay-trong">' + (dangLoc ? "Không có việc khớp bộ lọc." : "Hôm nay không có việc bảo dưỡng nào.") + "</div>") + "</div></div>";
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
        ve(); veLaiBen();
        var bao = document.querySelector('.bd-nhan[data-khoa="' + CSS.escape(khoa) + '"] .bd-dl'); if (bao) bao.textContent = "Đã lưu · " + (d[4] || "") + " " + (d[5] || "");
      })
      .catch(function (e) { dl.textContent = "Chưa lưu được: " + e.message; nut.disabled = false; });
  }
  /* sự kiện ô sửa — ỦY QUYỀN trên khung chứa (trang + thanh bên dùng chung) */
  function ganSua(hop) {
    hop.addEventListener("click", function (e) {
      var doi = e.target.closest(".bd-doi");
      if (doi) { var h = doi.parentNode.querySelector(".bd-nhan"), mo = h.classList.toggle("mo"); doi.setAttribute("aria-expanded", mo); doi.textContent = mo ? "Thu lại" : "Đổi";
        if (mo) { var s = h.querySelector(".bd-cdo"); if (s && !s.__da && typeof window.enhanceSelect === "function") { s.__da = 1; try { window.enhanceSelect(s); } catch (er) {} } } return; }
      var luu = e.target.closest(".bd-luu"); if (luu) { luuGiao(luu); return; }
    });
    hop.addEventListener("change", function (e) {
      var s = e.target.closest(".bd-cdo"); if (!s) return;
      var nh = s.closest(".bd-nhan"), h = nh.querySelector(".bd-cd").closest(".bd-hang");
      h.hidden = s.value.indexOf("chi-dinh") !== 0;
      S.luu[nh.getAttribute("data-khoa")] = { v: s.value, chiDinh: nh.querySelector(".bd-cd").value, ai: "", luc: "" };
      if (!h.hidden) nh.querySelector(".bd-cd").focus();
    });
  }

  function chanTrang() {
    /* viên Cập nhật ở CHÂN TRANG như Kiểm kê / Bất thường / Planogram (khuôn .cn-wrap) — user 27/10 «cập nhật luôn ở cuối trang» */
    return '<div class="cn-wrap bd-cn" id="bdLoadinfo">' + (typeof window.hskCapNhat === "function" ? window.hskCapNhat(S.ts || 0, { id: "bdReload", onclick: "HBAODUONG.reload()",
      tip: "Bảo dưỡng kho 170 · g-sheet kế hoạch + yêu cầu planogram " + NGAY_DU_LIEU + " ngày — bấm để tải lại" }) : "") +
      /* 28/10 user: chữ «Mở g-sheet…» → BIỂU TƯỢNG Google Sheets + mũi tên ↗ (bấm là sang g-sheet); chữ đầy đủ ở title/aria-label.
         3 mã màu trong SVG = màu NHẬN DIỆN của biểu tượng Google Sheets — cố ý không theo token sáng/tối (phát hành --bo-qua-lint có lý do).
         28/10 lượt sau: biểu tượng NGANG HÀNG, bên phải viên Cập nhật (cùng .cn-wrap) */
      '<a class="bd-gs" href="' + GSHEET + '" target="_blank" rel="noopener" title="Mở g-sheet kế hoạch bảo dưỡng" aria-label="Mở g-sheet kế hoạch bảo dưỡng">' +
        '<svg viewBox="0 0 24 32" width="18" height="24" aria-hidden="true"><path d="M2 0h14l8 8v22a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2z" fill="#0F9D58"/>' +
        '<path d="M16 0l8 8h-6a2 2 0 0 1-2-2z" fill="#87CEAC"/><path d="M5 14h14v11H5zm2 2v2h4v-2zm6 0v2h4v-2zm-6 4v3h4v-3zm6 0v3h4v-3z" fill="#fff"/></svg>' +
        '<span class="bd-gs-mui">↗</span></a></div>';
  }
  function ganLocNgay() {
    var r = $id("bdLocNgay"); if (!r || typeof window.taoBoLocNgay !== "function") return;
    var coNgay = {}; S.yc.forEach(function (y) { coNgay[y["NGÀY"]] = 1; });
    Object.keys(S.kyNgay || {}).forEach(function (b) { Object.keys(S.kyNgay[b]).forEach(function (d) { coNgay[d] = 1; }); });
    var loc = window.taoBoLocNgay({
      root: r, idNut: "bdNgayBtn", idPop: "bdNgayPop", homNay: function () { return isoVN(Date.now()); },
      presets: [{ k: "7", lb: "7 ngày" }, { k: "14", lb: "14 ngày" }, { k: "30", lb: "30 ngày" }, { k: "month", lb: "Tháng này" }, { k: "all", lb: NGAY_DU_LIEU + " ngày" }],
      tinhPreset: function (k) { return k === "all" ? [ngayDau(), isoVN(Date.now())] : null; },
      khongRong: true, macDinh: khoangMacDinh,
      coDuLieu: function (iso) { return !!coNgay[iso]; },
      chanNgay: function (iso) { return iso < ngayDau() || iso > isoVN(Date.now()); },
      nhan: function (a, b) { return a ? dm(a) + (b && b !== a ? " → " + dm(b) : "") : ""; },
      onApply: function (a, b) { var m = khoangMacDinh(); S.khoang = [a || m[0], b || a || m[1]]; S.khoangTuDong = !a; S.cuonX = null; veLaiLuoi(); }
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
    PANE.innerHTML = veHomNay() + veLuoi() + chanTrang();
    ganLocNgay();
    ganSuKien();
    PANE.scrollTop = cuon;
    if (typeof window.tqGhi === "function") window.tqGhi("bd", { dv: S.dv.length, vt: S.thuTu.length });
  }

  function xemAnhNut(a) { var y = S.yc.filter(function (r) { return String(r["REQUEST ID"]) === a.getAttribute("data-rid"); })[0]; xemAnh(y, Number(a.getAttribute("data-so")) || 0); }
  /* điền vỏ thanh bên Planogram bằng dữ liệu bảo dưỡng của 1 vị trí × 1 ngày */
  function dienBen(V, b, d) {
    var v = S.vt[b], y = ycCua(b).filter(function (r) { return r["NGÀY"] === d; })[0];
    V.tieu.innerHTML = '<span class="hp-vt-tday">' + esc(b) + '</span><span class="hp-vt-tgon">' + esc(b.replace(/^F0-/, "")) + "</span>";
    V.phu.title = ""; V.phu.textContent = (String(v.ten || "").split("|").pop().trim() || v.hm) + " · " + thuCua(d) + " " + dm(d);
    if (y) { V.lk.style.display = ""; V.lk.href = PG_CT + encodeURIComponent(y["REQUEST ID"]); V.lk.textContent = "Yêu cầu #" + y["REQUEST ID"] + " ↗"; } else V.lk.style.display = "none";
    if (V.ghi) V.ghi.style.display = "none"; if (V.lt) V.lt.style.display = "none";   // nút Ghi nhận 5S là của Planogram
    V.than.innerHTML = veCachLam(b, d);
    if (!V.than.__bd) {   // ủy quyền 1 lần trên thân vỏ — chỉ chạy khi vỏ đang thuộc Bảo dưỡng
      V.than.__bd = 1;
      V.than.addEventListener("click", function (e) {
        if (V.m.dataset.chu !== "bd") return;
        var a = e.target.closest(".bd-anh"); if (a) { e.preventDefault(); xemAnhNut(a); return; }
        var n = e.target.closest("[data-sang]"); if (n) moBen(S.chon, n.getAttribute("data-sang"));
      });
      ganSua(V.than);
    }
    /* sổ tài sản nạp lười lần đầu (taisan-vitri.js) — về thì vẽ lại thẻ Tài sản */
    if (window.HPLANOGRAM && !window.TAISAN_VT) { var lan = 0, ch = setInterval(function () { if (window.TAISAN_VT || ++lan > 20) { clearInterval(ch); if (window.TAISAN_VT) veLaiBen(); } }, 500); }
  }
  function moBen(b, d) {
    if (!S.vt[b]) return;
    S.chon = b; S.chonNgay = d;
    PANE.querySelectorAll("#bdLich tr.vtr.on").forEach(function (x) { x.classList.remove("on"); });
    var tr = PANE.querySelector('#bdLich tr.vtr[data-bin="' + b + '"]'); if (tr) tr.classList.add("on");
    napPlg().then(function () { dienBen(window.HPLANOGRAM.moVoVt("bd"), b, d); })
      .catch(function (e) { if (typeof window.toast === "function") window.toast(e.message, "loi"); });
  }
  /* sau khi lưu người phụ trách: thanh bên đang mở đúng Bảo dưỡng thì vẽ lại thân tại chỗ */
  function veLaiBen() {
    var m = $id("hpVtModal");
    if (!m || !m.classList.contains("show") || m.dataset.chu !== "bd" || !S.chon) return;
    $id("hpVtBody").innerHTML = veCachLam(S.chon, S.chonNgay);
  }
  /* bấm tên vị trí (không trỏ ngày) → ngày gần nhất có yêu cầu trong khoảng đang xem, không có thì ngày cuối khoảng */
  function ngayMacDinh(b) {
    var ds = ycCua(b).map(function (y) { return y["NGÀY"]; }).filter(function (d) { return d >= S.khoang[0] && d <= S.khoang[1]; }).sort();
    return ds.length ? ds[ds.length - 1] : S.khoang[1];
  }
  /* 28/10 user «trỏ/nhấn mục cha ở lưới thì thẻ Việc hôm nay lại nhảy»: gập/mở mục cha + đổi khoảng ngày chỉ VẼ LẠI KHUNG LƯỚI,
     không vẽ lại cả trang (vẽ lại cả trang = thẻ chạy lại hiệu ứng fadeUp so le ⇒ trông như nhảy). Tương tự bộ lọc Việc hôm nay chỉ vẽ lại khung đó. */
  function thayKhung(id, html) {
    var cu = $id(id); if (!cu) { ve(); return false; }
    var t = document.createElement("div"); t.innerHTML = html; cu.parentNode.replaceChild(t.firstChild, cu); return true;
  }
  function veLaiLuoi() { if (thayKhung("bdLich", veLuoi())) { ganLocNgay(); ganLuoi(); } }
  function veLaiNay() { if (thayKhung("bdNay", veHomNay())) ganNay(); }
  function ganSuKien() { ganLuoi(); ganNay(); if (!PANE.__bdSua) { PANE.__bdSua = 1; ganSua(PANE); } }
  function ganLuoi() {
    ganThuoc();
    PANE.querySelectorAll("#bdLich tr.vtr").forEach(function (tr) {
      tr.addEventListener("click", function (e) {
        var b = tr.getAttribute("data-bin"), oNgay = e.target.closest(".bd-o[data-ngay]");
        moBen(b, oNgay ? oNgay.getAttribute("data-ngay") : ngayMacDinh(b));
      });
    });
    PANE.querySelectorAll("#bdLich tr.gd").forEach(function (tr) {
      /* đảo theo trạng thái ĐANG HIỆN (lớp .mo), không theo S.moNhom — web mặc định mở mà S.moNhom chưa có ⇒ !undefined = true:
         lần bấm đầu không gập (28/10 user «mục cha cũng phải bấm vào là ẩn/hiện») */
      tr.addEventListener("click", function () { S.moNhom[tr.getAttribute("data-hm")] = !tr.classList.contains("mo"); veLaiLuoi(); });
    });
  }
  function ganNay() {
    /* Bộ lọc (khuôn .btn-filter + .filters của thư viện, như Kiểm kê): nút mở/đóng khối lọc; ô chọn enhanceSelect (mở xuống, popIn, ✕) */
    var nut = $id("bdNayNut"); if (nut) nut.addEventListener("click", function () { S.moLocNay = !S.moLocNay; $id("bdNayLoc").classList.toggle("collapsed", !S.moLocNay); nut.classList.toggle("mo", S.moLocNay); });
    [["bdNayHm", "locHm"], ["bdNayAi", "locAi"]].forEach(function (x) {
      var s = $id(x[0]); if (!s) return;
      if (typeof window.enhanceSelect === "function") { try { window.enhanceSelect(s); } catch (er) {} }
      s.addEventListener("change", function () { S[x[1]] = s.value; veLaiNay(); });
    });
    /* Việc hôm nay: 1 dòng → thanh bên vị trí đó, ngày hôm nay */
    /* ô lọc trạng thái: ẩn/hiện thẻ tại chỗ (không vẽ lại cả trang), thẻ còn lại hiện dần lại */
    PANE.querySelectorAll("#bdNay .bd-loc-o").forEach(function (n) {
      n.addEventListener("click", function () {
        var v = n.getAttribute("data-loc"); S.locNay = S.locNay === v ? "" : v;
        PANE.querySelectorAll("#bdNay .bd-loc-o").forEach(function (x) { x.setAttribute("aria-pressed", String(x.getAttribute("data-loc") === S.locNay)); });
        PANE.querySelectorAll("#bdNay .bd-tn").forEach(function (t) { t.hidden = !!S.locNay && !t.classList.contains("s-" + S.locNay); });
        /* khối hạng mục không còn dòng nào khớp thì ẩn cả khối; khối còn lại hiện dần lại (fadeUp so le) */
        var i = 0; PANE.querySelectorAll("#bdNay .bd-nk").forEach(function (k) {
          var an = !k.querySelector(".bd-tn:not([hidden])"); k.hidden = an;
          if (!an) { k.style.animation = "none"; void k.offsetWidth; k.style.animation = ""; k.style.animationDelay = Math.min(i++ * 45, 400) + "ms"; }
        });
      });
    });
    PANE.querySelectorAll("#bdNay .bd-tn[data-bin]").forEach(function (r) {
      var bat = function () { moBen(r.getAttribute("data-bin"), r.getAttribute("data-ngay") || isoVN(Date.now())); };
      r.addEventListener("click", bat);
      r.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); bat(); } });
    });
  }

  var mq = window.matchMedia("(max-width:768px)");
  var doiCo = function () { S.cuonX = null; if (S.ok && PANE && PANE.offsetParent) ve(); };
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
