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
  var TAB_DV = "BAO-DUONG-DAU-VIEC", TAB_YC = "BAO-DUONG-YEUCAU", TAB_KY = "BAO-DUONG-KY", TAB_GIAO = "BAO-DUONG-GIAO", TAB_LS = "BAO-DUONG-LICHSU", TAB_NGAY = "BAO-DUONG-NGAY", TAB_TEN = "BAO-DUONG-DOI-TEN", TAB_KHU = "BAO-DUONG-KHU";
  var TAB_THEM = "BAO-DUONG-THEM-VT", TAB_KHUNG = "BAO-DUONG-KHUNG";
  var GSHEET = "https://docs.google.com/spreadsheets/d/1ERdim9g4-BbJspzWhIfy6jWXFMMNya4zhhvWYF59GHc/edit?gid=481972207#gid=481972207";
  var STALE_MS = 5 * 60 * 1000, NGAY_DU_LIEU = 60;   // dữ liệu sync-bao-duong-yc (lưới hiện trọn 60 ngày — 29/10 bỏ bộ lọc ngày, đã có thước thời gian)
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

  var PANE = null, S = { ok: false, loi: "", dv: [], yc: [], ky: [], giao: {}, ls: [], ts: 0, lastAt: 0, chon: "", soNgay: 0, luu: {}, moNhom: {}, locNay: "",
    cheNay: "khu", cfg: {}, themVt: [], suaKho: {}, khung: [], khuBin: {}, moO: {}, moNg: {}, chonVt: {}, locHm: "", locAi: "", moLocNay: false, khoang: null, cuonX: null };

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
      /* 07/11 bản thử kính lúp: cột tên +7 cm (web) / +2 cm (điện thoại); dải bắt dính giữa kính; kính = khung nhấn nổi, nền đặc che cột dưới */
      /* 07/11 thanh bên: lưới chip đối xứng 2 cột + phần thân của chip đang mở; ô đổi tên 1 hàng */
      B + " .bd-chips{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}" +
        B + " .bd-chips.hai-ben{grid-auto-flow:row dense}" + B + " .bd-chips.hai-ben>.bd-chip{grid-column:1}" + B + " .bd-chips.hai-ben>.bd-chip.phai{grid-column:2}" +
        B + " .bd-chips .bd-chip{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:'n m' 't m';align-items:center;gap:0 6px;min-height:52px;padding:7px 10px 7px 12px;" +
          "border:1px solid var(--ad-chia,var(--border));border-radius:10px;background:var(--surface);color:var(--text);font:inherit;text-align:left;cursor:pointer;" +
          "transition:border-color .15s,background .15s}" + B + " .bd-chips .bd-chip:hover{border-color:var(--accent)}" +
        B + " .bd-chips .bd-chip.mo{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 7%,var(--surface))}" +
        B + " .bd-chips .bd-chip:focus-visible{outline:none;box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 35%,transparent)}" +
        B + " .bd-chip-n{grid-area:n;font-size:13px;font-weight:600;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
        B + " .bd-chip-t{grid-area:t;font-size:12px;line-height:16px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
        B + " .bd-chip-mui{grid-area:m;width:0;height:0;border:4px solid transparent;border-top:5px solid var(--muted);margin-top:4px;transition:transform .2s}" +
        B + " .bd-chip.mo .bd-chip-mui{transform:rotate(180deg);margin-top:-4px;border-top-color:var(--accent)}" +
        B + " .bd-chip-than{margin-top:8px;padding:10px 12px;border:1px solid var(--accent);border-radius:10px;animation:fadeUp .18s var(--ez-apple,ease) both}" +
        B + " .bd-chip-than>.hp-vtcard{margin:0;border:0;padding:0;box-shadow:none;background:none}" + B + " .bd-chip-than .bd-ls-hd>span:first-child{display:none}" +
        B + " .bd-chip-than .bd-ls-hd{justify-content:flex-end;min-height:0;margin:0}" + B + " .bd-chip-than details>summary{display:none}",
      B + " .bd-chip-than .bd-ten-form{padding:0;margin:0;background:none;gap:4px}" +
        B + " .bd-ten-hang{display:flex;gap:6px;align-items:center}" + B + " .bd-ten-hang .bd-ten-o{flex:1;min-width:0;height:32px;padding:0 10px;border:1px solid var(--border);border-radius:6px;" +
          "background:var(--surface);color:var(--text);font:inherit;font-size:13.5px}" + B + " .bd-ten-hang .bd-ten-o:focus{outline:none;border-color:var(--accent)}" +
        B + " .bd-ten-bao:empty{display:none}" + B + " .bd-ten-tt{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;margin-top:6px}",
      /* 07/11 «+» cạnh tên kho; ô «Chưa có vị trí + Thêm» 1 dòng */
      B + " .bd-kd-t{display:flex;align-items:center;gap:8px}" + B + " .bd-kd-t .bd-kd-them{flex:none;width:22px;height:20px;margin:-2px 0;border-radius:6px;border:0;background:none;color:var(--muted);" +
          "padding:0;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s,color .15s}" +
        B + " .bd-kd-t .bd-kd-them:hover{background:var(--ad-re,var(--hover));color:var(--accent)}" +
        B + " .bd-ko-1{display:flex;align-items:center;gap:8px;height:18px;white-space:nowrap}" + B + " .bd-ko-1 .bd-phu{display:inline}",
      B + " .bd-hm tr.gd.mo.mui-cu td.vt .bd-mui{transform:none}" + B + " .bd-hm tr.gd:not(.mo).mui-cu td.vt .bd-mui{transform:rotate(90deg) translateX(2px)}" +
        B + " .bd-pn.mo.mui-cu>.bd-pn-h .bd-mui{transform:none}" + B + " .bd-pn:not(.mo).mui-cu>.bd-pn-h .bd-mui{transform:rotate(90deg) translateX(2px)}" +
        B + " .bd-ko.mo.mui-cu .bd-ko-h .bd-mui{transform:none}" + B + " .bd-ko:not(.mo).mui-cu .bd-ko-h .bd-mui{transform:rotate(90deg) translateX(2px)}" +
        B + " .bd-kdt-mo.mui-cu .bd-kdt-mui{transform:none}" + B + " .bd-kdt-kho:not(.bd-kdt-mo).mui-cu .bd-kdt-mui{transform:rotate(90deg) translateX(2px)}" +
        B + " .bd-hm tr.gd td.vt .bd-mui{display:inline-block;width:0;height:0;font-size:0;margin:0 2px 0 0}",
      /* 07/11 bút sửa nhỏ · + / ✕ trong chế độ sửa · đầu kho 1 hàng trên web */
      B + " .bd-lk.bd-but-sua{display:inline-flex;align-items:center;justify-content:center;width:22px;height:20px;margin:-2px 0;padding:0;border-radius:6px;color:var(--muted);vertical-align:middle}" +
        B + " .bd-lk.bd-but-sua:hover{background:var(--ad-re,var(--hover));color:var(--accent)}" + B + " .bd-lk.bd-but-sua.mo{background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--accent)}" +
        B + " .bd-ko{position:relative}" + B + " td.bd-ko{padding-right:26px!important}" +
        B + " .bd-lk.bd-ko-x{position:absolute;top:4px;right:4px;min-height:0!important;z-index:2;width:16px;height:16px;padding:0;border-radius:50%;display:inline-flex;align-items:center;" +
          "justify-content:center;color:var(--surface);background:var(--bad)}" +
        /* 07/11 user: ✕ đỏ tròn của nút «Đang lọc» = KHUÔN ✕ CHUẨN cho mọi dấu ✕ (Bảo dưỡng: ô kho · khung ảnh · bỏ người trong hộp) */
        B + " :is(.bd-lk.bd-ko-x,.bd-lk.bd-sk-x):hover{filter:brightness(.9)}" + B + " :is(.bd-lk.bd-ko-x,.bd-lk.bd-sk-x).xn{box-shadow:0 0 0 3px color-mix(in srgb,var(--bad) 30%,transparent)}" +
        B + " .bd-lk.bd-ko-cong{display:inline-flex;align-items:center;justify-content:center;width:20px;height:18px;margin:-2px 0;padding:0;border-radius:6px;color:var(--accent);vertical-align:middle}" +
        B + " .bd-lk.bd-ko-cong:hover{background:var(--ad-re,var(--hover))}" + /* 07/11 LUẬT «bấm bất kỳ cái gì không được nhảy mục khác»: nút chế độ sửa không đổi lề / chiều cao; ô bảng neo đỉnh (ô cạnh mở ra không đẩy ô này) */
        B + " .bd-kbang :is(td.bd-ko,th.bd-kh-hm){vertical-align:top}" +
        /* nút chỉ hiện khi bật sửa (+ trong ô · Đổi quản lý · bút) KHÔNG được cao hơn dòng chữ — đo 07/11: «Đổi» làm đầu cột +8px, + làm ô +10px */
        B + " :is(.bd-ko-1,.bd-kh-ql,.bd-kd-t) .bd-lk.bd-ka{min-height:0!important;height:auto;padding-top:0!important;padding-bottom:0!important;line-height:inherit}" +
        B + " .bd-ko-1 .bd-lk.bd-ko-cong{height:18px!important}" + B + " .bd-kd-t .bd-lk.bd-ka{height:20px!important}" +
        /* ô nhập khung ảnh nằm trong hàng .hp-vtrow ⇒ gỡ kiểu nhãn hàng (in hoa, đậm) */
        "#hpVtBody .bd-sk label{display:flex;flex-direction:column;gap:4px;width:auto;flex:none;text-transform:none;letter-spacing:0;font-size:12.5px;font-weight:400;color:var(--muted)}" +
        "#hpVtBody .bd-sk label.bd-sk-ml{flex-direction:row;align-items:center;flex-wrap:wrap}#hpVtBody .bd-sk :is(input,textarea){font-weight:400;text-transform:none}",
      B + " .bd-kd-hang{display:flex;align-items:center;justify-content:space-between;gap:12px;align-self:stretch;white-space:nowrap}" +
        B + " .bd-kd-hang .bd-kh-ql{flex:0 1 auto;min-width:0;overflow:hidden}" + B + " .bd-kd-hang .bd-kd-so{flex:none;flex-wrap:nowrap}" +
        "@media(max-width:768px){" + B + " .bd-kd-hang{display:block;white-space:normal}}",   // điện thoại: giữ 2 dòng
      B + " .bd-sk{margin-top:8px;padding:8px;border:1px dashed var(--accent);border-radius:8px}" + B + " .bd-sk-ds{display:flex;flex-wrap:wrap;gap:6px;align-items:center}" +
        B + " .bd-sk-it{position:relative;display:inline-flex;align-items:center;padding:3px 22px 3px 8px;border:1px solid var(--ad-chia,var(--border));border-radius:6px;font-size:12px;background:var(--surface)}" +
        B + " .bd-sk-it.bo{padding-right:8px;text-decoration:line-through;color:var(--muted)}" +
        B + " .bd-lk.bd-sk-x{min-height:0!important;line-height:0;box-sizing:border-box;position:absolute;top:-6px;right:-6px;width:16px;height:16px;padding:0;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;" +
          "color:var(--surface);background:var(--bad)}" +
        B + " .bd-lk.bd-sk-cong{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border-radius:6px;border:1px dashed var(--accent);color:var(--accent)}",
      B + " .bd-sk-form{display:flex;flex-direction:column;gap:8px;margin-top:8px}" + B + " .bd-sk-form :is(input[type=text],textarea){width:100%;padding:6px 8px;border:1px solid var(--border);" +
          "border-radius:6px;font:inherit;font-size:13px;background:var(--surface);color:var(--text)}" +
        B + " .bd-sk-ml{display:flex;flex-wrap:wrap;gap:4px 6px;align-items:baseline;font-size:12.5px}" + B + " .bd-sk-cho{margin-top:8px;display:flex;flex-direction:column;gap:4px;font-size:12.5px}",
      /* 07/11 user «lỗi nhảy vẫn còn — xử lý tận gốc»: phần tử chỉ dùng khi bật sửa luôn có mặt, ẩn bằng visibility ⇒ bật/tắt sửa = 0 phần tử thêm/bớt */
      B + " .chi-sua{visibility:hidden!important;pointer-events:none!important}",
      /* 07/11 user «LUẬT THIẾT KẾ ĐÂU — sao xuống hàng Chưa làm, icon bút xuống hàng, "Chưa có ảnh: …" xuống hàng»: hàng thanh bên Bảo dưỡng =
         nhãn | giá trị trên 1 dòng ở MỌI cỡ màn; nhãn + bút không gãy; danh sách chữ dài cắt «…» (đủ ở title) */
      B + " .bd-ben .hp-vtrow{display:flex!important;flex-direction:row!important;align-items:flex-start;gap:10px}" +
        /* nhãn = khối chữ căn TRÁI tuyệt đối (khung flex làm chữ ngắn «Trạng thái» bị căn giữa, lệch 22px so với «Ảnh báo cáo (0/4)») */
        B + " .bd-ben .hp-vtrow>label{flex:0 0 124px;display:block;text-align:left!important;text-align-last:left!important;white-space:nowrap;margin:0;padding:2px 0 0;overflow:visible}" +
        B + " .bd-ben .hp-vtrow>div{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-start;gap:4px 6px;text-align:left}" +
        B + " .bd-ben .hp-vtrow>div>:is(.bd-anh-dau,.hp-vtthumbs,.bd-sk,.bd-ycdau){flex:1 1 100%}" +
        B + " .bd-ben .hp-vtrow>div{flex:1 1 auto;min-width:0}" + B + " .bd-ben .hp-vtrow>div .hp-badge{white-space:nowrap}" +
        B + " .bd-ben .hp-vtrow .hp-hint.bd-motdong{display:block;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
        B + " .bd-ben .hp-vtrow>div>.hp-hint," + B + " .bd-ben .hp-vtrow>div>a{white-space:nowrap}" +
        B + " .bd-anh-dau{display:flex;align-items:center;gap:6px;min-width:0}",
      B + " .bd-pc-ai{flex-wrap:nowrap!important;align-items:center!important}" + B + " .bd-pc-ai .bd-pc-than{flex-direction:row!important;flex-wrap:wrap;align-items:center;gap:4px 12px}" +
        B + " .bd-pc-ng{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;font-size:13px}" + B + " .bd-pc-ng .bd-av{width:22px;height:22px;flex:none}" +
        B + " .bd-pc-ng.vuong .bd-av{border-radius:6px}" + B + " .bd-pc-ng-nguon{width:100%}" +
        B + " .bd-lk.bd-doi-ic{flex:none;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border-radius:6px;color:var(--muted)}" +
        B + " .bd-lk.bd-doi-ic:hover," + B + " .bd-lk.bd-doi-ic.mo{background:var(--ad-re,var(--hover));color:var(--accent)}",
      B + " .bd-ko-ds .bd-kvt{position:relative;padding-right:26px!important}" +
        B + " .bd-lk.bd-kvt-x{position:absolute;top:4px;right:4px;z-index:2;width:16px;height:16px!important;min-height:0!important;padding:0;line-height:0;border-radius:50%;" +
          "display:inline-flex;align-items:center;justify-content:center;color:var(--surface);background:var(--bad)}" +
        B + " .bd-lk.bd-kvt-x:hover{filter:brightness(.9)}" + B + " .bd-lk.bd-kvt-x.xn{box-shadow:0 0 0 3px color-mix(in srgb,var(--bad) 30%,transparent)}" +
        B + " .bd-lk.bd-kvt-ck{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px!important;min-height:0!important;padding:0;border-radius:6px;color:var(--muted)}" +
        B + " .bd-lk.bd-kvt-ck:hover{background:var(--ad-re,var(--hover));color:var(--accent)}",
      /* số «[x/y]» nhỏ trước tên; vùng ảnh thẻ hạng mục cố định: VH 3 ảnh | BT 2 ảnh ⇒ các hàng thẳng cột */
      B + " .bd-so-truoc{margin-right:6px;font-size:11.5px;font-weight:600;color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap}" + B + " .bd-so-truoc.du{color:var(--good)}" +
        B + " .bd-pn-h .bd-kav.bd-kav-cot{flex:0 0 132px!important;width:132px;display:flex;align-items:center;margin-left:auto}" +
        B + " .bd-kav.bd-kav-cot>.bd-kav-vh{flex:0 0 78px;overflow:visible}" + B + " .bd-kav.bd-kav-cot>.bd-kav-kt{flex:1 1 0;padding-left:6px}",
      "#hpVtModal:not([data-chu=bd]) #bdVtKy{display:none}#bdVtKy{margin-right:8px;white-space:nowrap}#bdDoiHop .bd-hop-ad[hidden],#bdDoiHop [hidden]{display:none!important}",
      B + " .bd-hm-w{position:relative}" + B + " .bd-hm.kl{scroll-snap-type:x mandatory;scroll-padding-left:var(--bd-wvt,0)}" + B + " .bd-hm.kl thead th.th-ngay{scroll-snap-align:center}" +
        B + " .bd-hm.kl td.vt{width:200px;min-width:200px;max-width:200px;box-sizing:border-box}"   /* 07/11 user «web rộng lên 200px» */ + B + " .bd-hm.kl :is(td,th):not(.vt):not(.th-goc){min-width:18px}",
      B + " .bd-kinh{position:absolute;top:0;width:60px;z-index:7;border-radius:10px;cursor:pointer;background:color-mix(in srgb,var(--accent) 6%,var(--surface));" +
          "box-shadow:0 0 0 1.5px var(--accent),0 8px 22px -6px rgba(0,0,0,.22);overflow:hidden}" +
        B + " .bd-kinh-dau{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:4px;color:var(--accent);" +
          "background:color-mix(in srgb,var(--accent) 12%,var(--surface));border-bottom:1px solid color-mix(in srgb,var(--accent) 25%,transparent)}" +
        B + " .bd-kinh-dau span{font-size:9px;font-weight:700;line-height:11px;text-transform:uppercase;letter-spacing:.3px}" + B + " .bd-kinh-dau b{font-size:20px;line-height:22px;font-weight:700;color:var(--text)}" +
        B + " .bd-kinh.la-qua .bd-kinh-dau span{color:var(--muted)}" + B + " .bd-kinh-ds{position:absolute;inset:0;pointer-events:none}" +
        B + " .bd-kinh-o{position:absolute;left:0;right:0;display:flex;align-items:center;justify-content:center;pointer-events:auto}" +
        B + " .bd-kinh-o.gd{background:color-mix(in srgb,var(--accent) 10%,var(--ad-nen2,var(--surface2)))}" +
        B + " .bd-kinh-o .bd-o{width:auto;height:min(26px,calc(100% - 6px));aspect-ratio:1;margin:0;border-radius:6px;opacity:1}" +
        /* 07/11 kính: không chặn chạm (vuốt cả khung), số / ô lăn vào khi đổi ngày như bánh xe chọn giờ; kéo chuột thì tắt hít tạm thời */
        B + " .bd-kinh," + B + " .bd-kinh .bd-kinh-o{pointer-events:none}" + B + " .bd-hm.kl.dang-keo{scroll-snap-type:none;cursor:grabbing;user-select:none}" + B + " .bd-hm.kl{cursor:grab}" +
        B + " .bd-kinh.lan .bd-kinh-dau b," + B + " .bd-kinh.lan .bd-kinh-o .bd-o{animation:kinhLan .18s cubic-bezier(.2,.8,.2,1)}" +
        "@keyframes kinhLan{from{transform:translateY(7px) scale(.82);opacity:.35}to{transform:none;opacity:1}}" +
        "@media (prefers-reduced-motion:reduce){" + B + " .bd-kinh.lan .bd-kinh-dau b," + B + " .bd-kinh.lan .bd-kinh-o .bd-o{animation:none}}",
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
      /* 29/10 lịch sử thiết bị: chấm góc ô ngày (xanh dương = sửa chữa / nâng cấp / thay vật tư · đỏ = có hư hỏng) */
      B + " :is(.bd-o,.bd-chu i).co-ls{position:relative}",
      B + " :is(.bd-o,.bd-chu i).co-ls::before{content:'';position:absolute;top:-3px;right:-3px;width:7px;height:7px;border-radius:50%;background:var(--info,var(--accent));box-shadow:0 0 0 1.5px var(--surface)}",
      B + " :is(.bd-o,.bd-chu i).co-ls.ls-hh::before{background:var(--bad)}",
      /* 29/10 B4 Việc hôm nay: danh sách tích (trái) + cột tiến độ (phải) */
      B + " .bd-b4{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px;align-items:start}",
      B + " .bd-ckl{columns:2 300px;column-gap:24px;min-width:0}",
      B + " .bd-ckl .bd-nk{border:0;border-radius:0;padding:0;background:transparent;break-inside:avoid;margin:0 0 14px}",
      B + " .bd-ckl .bd-nk-dau{padding:4px 4px 6px;border-bottom:1px solid var(--ad-chia,var(--border))}",
      B + " .bd-ckl .bd-nk-ten{font-size:11.5px;letter-spacing:.3px;text-transform:uppercase;color:var(--muted);white-space:normal}",
      B + " .bd-ckl .bd-nk-ai{display:inline;padding:0;font-size:11.5px;font-weight:400;letter-spacing:0;text-transform:none}",
      B + " .bd-ckl .bd-nk-ds{margin-top:2px}",
      B + " .bd-ckl .bd-tn{margin:0;border-radius:6px;gap:10px;min-height:34px;border-bottom:1px solid color-mix(in srgb,var(--ad-chia,var(--border)) 60%,transparent)}",
      B + " .bd-tn-tron{flex:none;position:relative;width:16px;height:16px;border-radius:50%;border:2px solid var(--ad-chia,var(--border));transition:background .2s,border-color .2s}",
      B + " .bd-tn.s-b .bd-tn-tron{border-color:var(--bad)}" + B + " .bd-tn.s-d .bd-tn-tron{border-color:var(--info,var(--accent));background:linear-gradient(90deg,var(--info,var(--accent)) 50%,transparent 50%)}",
      B + " .bd-tn.s-x .bd-tn-tron{border-color:var(--good);background:var(--good)}",
      B + " .bd-tn.s-x .bd-tn-tron::after{content:'';position:absolute;left:4px;top:1px;width:4px;height:8px;border:solid var(--surface);border-width:0 2px 2px 0;transform:rotate(45deg)}",
      B + " .bd-ckl .bd-tn.s-x .bd-tn-ten{text-decoration:line-through}",
      B + " .bd-tn-anh{flex:none;display:inline-flex;gap:2px}",
      B + " .bd-tn-anh i{width:9px;height:9px;border-radius:2px;box-shadow:inset 0 0 0 1.5px var(--ad-chia,var(--border))}" + B + " .bd-tn-anh i.co{background:var(--good);box-shadow:none}",
      /* ô lọc trạng thái = viên */
      B + " .bd-nay-loc{margin:0 0 12px}",
      /* viên = mặt .hp-legchip của Planogram (CSS Planogram chỉ phủ #pane-planogram nên chép lại ở đây) */
      B + " .bd-nay-loc .bd-loc-o{flex:0 0 auto;flex-direction:row;align-items:center;gap:6px;min-width:0;min-height:30px;padding:3px 10px;border-radius:999px;font-size:11.5px;font-weight:600;color:var(--text)}",
      B + " .bd-nay-loc .bd-loc-o b{color:var(--muted)}" + B + " .bd-nay-loc .bd-loc-o[aria-pressed=true] b{color:var(--text)}",
      B + " .bd-nay-loc .bd-loc-o i{width:8px;height:8px;border-radius:50%;background:var(--mau)}" + B + " .bd-nay-loc .bd-loc-o b{font-variant-numeric:tabular-nums}",
      B + " .bd-nay-loc .bd-loc-o:hover{transform:none}",
      /* cột phải */
      B + " .bd-tdo{display:flex;flex-direction:column;gap:12px;min-width:0}",
      B + " .bd-tdo-the{border:1px solid var(--ad-chia,var(--border));border-radius:10px;padding:10px 12px;background:var(--surface)}",
      B + " .bd-tdo-hd{display:flex;align-items:center;gap:6px;margin-bottom:6px;font-size:12.5px;line-height:18px;font-weight:700;color:var(--text)}",
      B + " .bd-tdo-dem{font-size:11px;line-height:16px;padding:0 6px;border-radius:8px;color:var(--surface);background:var(--bad)}",
      B + " .bd-cot{display:flex;align-items:center;gap:8px;margin:5px 0;font-size:12px;line-height:16px}",
      B + " .bd-cot-n{flex:none;width:118px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)}",
      B + " .bd-cot-r{position:relative;flex:1 1 auto;height:10px;border-radius:3px;background:var(--ad-nen2,var(--surface2));overflow:hidden}",
      B + " .bd-cot-r i{position:absolute;left:0;top:0;bottom:0;background:color-mix(in srgb,var(--warn) 35%,transparent)}" + B + " .bd-cot-r b{position:absolute;left:0;top:0;bottom:0;background:var(--good)}",
      B + " .bd-cot-s{flex:none;width:42px;text-align:right;color:var(--muted);font-variant-numeric:tabular-nums}",
      /* Việc theo người: dòng bấm được; trỏ → ô nổi chi tiết bên TRÁI cột (đè lên danh sách, không đẩy bố cục); đang chọn → chi tiết hiện ngay dưới dòng */
      B + " .bd-cot-ng{position:relative;margin:0 -6px;padding:0 6px;border-radius:6px;cursor:pointer;transition:background .15s}",
      B + " .bd-cot-ng:hover{background:var(--ad-re,var(--hover))}" + B + " .bd-cot-ng.on{background:color-mix(in srgb,var(--accent) 10%,transparent)}" + B + " .bd-cot-ng.on .bd-cot-n{font-weight:700;color:var(--accent)}",
      B + " .bd-cot-ng:focus-visible{outline:none;box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 25%,transparent)}",
      B + " .bd-cot-ct{display:none;position:absolute;right:calc(100% + 10px);top:-6px;z-index:5;width:280px;padding:10px 12px;border:1px solid var(--ad-chia,var(--border));border-radius:10px;" +
        "background:var(--surface);box-shadow:0 8px 24px color-mix(in srgb,var(--text) 18%,transparent);cursor:default}",
      B + " .bd-cot-ng:is(:hover,:focus-visible) .bd-cot-ct{display:block}",
      B + " .bd-ct-dau{margin-bottom:4px;font-size:12.5px;font-weight:700;color:var(--text)}",
      B + " .bd-ct-dong{display:flex;flex-wrap:wrap;align-items:baseline;gap:0 8px;padding:3px 0;border-top:1px solid var(--ad-chia,var(--border));font-size:12px;line-height:17px;color:var(--text)}",
      B + " .bd-ct-dong span{flex:1 1 auto;min-width:0}" + B + " .bd-ct-dong b{font-variant-numeric:tabular-nums}" + B + " .bd-ct-dong small{flex-basis:100%;font-size:11px;color:var(--muted)}" + B + " .bd-ct-dong small.bd-do{color:var(--bad)}",
      B + " .bd-tdo-hong{display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-top:1px solid var(--ad-chia,var(--border));font-size:12px;line-height:16px;cursor:pointer}",
      B + " .bd-tdo-hong:hover .bd-tdo-ht b{color:var(--accent)}",
      B + " .bd-tdo-ht{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;color:var(--muted)}" + B + " .bd-tdo-ht b{font-weight:600;color:var(--text)}",
      B + " .bd-tdo-ng{flex:none;color:var(--bad);white-space:nowrap}",
      /* thẻ Lịch sử hư hỏng · sửa chữa (thanh bên) */
      B + " .bd-ls-hd{display:flex;align-items:center;justify-content:space-between;gap:8px}",
      B + " .bd-ls-dong{display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-top:1px solid var(--ad-chia,var(--border))}",
      B + " .bd-ls-loai{flex:none;font-size:11px;line-height:18px;font-weight:700;padding:0 7px;border-radius:5px;white-space:nowrap}",
      B + " .bd-ls-loai.ls-hh{color:var(--bad);background:color-mix(in srgb,var(--bad) 12%,transparent)}" + B + " .bd-ls-loai.ls-sc{color:var(--info,var(--accent));background:color-mix(in srgb,var(--info,var(--accent)) 12%,transparent)}",
      B + " .bd-ls-loai.ls-nc{color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,transparent)}" + B + " .bd-ls-loai.ls-vt{color:var(--warn);background:color-mix(in srgb,var(--warn) 14%,transparent)}",
      B + " .bd-ls-than{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px;font-size:12.5px;line-height:18px}",
      B + " .bd-ls-nut{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}",
      B + " .bd-ls-form{display:flex;flex-direction:column;gap:8px;margin:8px 0;padding:10px;border-radius:8px;background:var(--ad-nen2,var(--surface2))}" + B + " .bd-ls-form[hidden]{display:none}",
      B + " .bd-ls-hang{display:flex;flex-wrap:wrap;align-items:flex-end;gap:8px}",
      /* flex-basis chỉ đặt trong HÀNG NGANG — ở khung dọc nó thành CHIỀU CAO 140px (ô Mô tả từng thừa khoảng trống) */
      B + " .bd-ls-o{display:flex;flex-direction:column;gap:3px;min-width:0;font-size:12px;color:var(--muted)}",
      B + " .bd-ls-hang>.bd-ls-o{flex:1 1 140px}" + B + " .bd-ls-hang>.bd-ls-o.rong{flex:2 1 200px}" + B + " .bd-ls-hang>.bd-ls-o.hep{flex:0 1 90px}",
      B + " .bd-ls-o :is(input,textarea){width:100%;min-width:0;font:inherit;font-size:13px;color:var(--text)}",
      "@media(max-width:768px){" + B + " .bd-cot-ng:is(:hover,:focus-visible) .bd-cot-ct{display:none}" +
        B + " .bd-cot-ng.on .bd-cot-ct{display:block;position:static;width:auto;margin:2px 0 6px;box-shadow:none}" + B + " .bd-cot-ng.on .bd-ct-dau{display:none}" +
        B + " .bd-b4{grid-template-columns:minmax(0,1fr)}" + B + " .bd-ckl{columns:1}" + B + " .bd-cot-n{width:104px}" + B + " .bd-ckl .bd-tn{min-height:42px}}",
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
      /* 07/11 t2.1 user «ô nhập phải là dạng nút đôi cạnh / ngang nhau, không nằm trên dưới» — cả điện thoại */
      "#pane-baoduong .bd-nay-bl{grid-template-columns:repeat(2,minmax(0,260px))}",
      "@media(max-width:560px){#pane-baoduong .bd-nay-bl{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}#pane-baoduong .bd-nay-bl .lbl{font-size:11.5px}}",
      /* nút Bộ lọc mới (bản duyệt) */
      ".panel-head .bl-cum{position:relative;display:inline-flex;align-items:center;flex:0 0 auto;margin-left:auto;isolation:isolate}" +
        ".panel-head .bl-cum .btn-filter.bl-moi{margin:0!important}" +
        ".panel-head .btn-filter.bl-moi:is(:hover,.mo){border-color:var(--border);color:var(--text);background:var(--ad-re,var(--hover))}" +
        ".panel-head .bl-cum.dang .btn-filter.bl-moi{border-color:var(--bad);color:var(--bad);background:color-mix(in srgb,var(--bad) 7%,var(--surface));padding-right:30px!important;font-weight:600!important}" +
        ".panel-head .bl-cum.dang .btn-filter.bl-moi::after{display:none}" +
        ".panel-head .bl-cum .hsk-nut.bl-xoa{display:block;min-height:0!important;box-shadow:none;position:absolute;right:5px;top:50%;width:18px;height:18px;" +
          "margin-top:-9px;padding:0;border:0;border-radius:50%;background:var(--bad);color:var(--surface);" +
          "font:700 14px/18px system-ui,sans-serif;text-align:center;cursor:pointer;z-index:2}" +
        ".panel-head .bl-cum .hsk-nut.bl-xoa:hover{filter:brightness(.9)}.panel-head .bl-cum .hsk-nut.bl-xoa:focus-visible{outline:2px solid var(--bad);outline-offset:2px}" +
        ".panel-head .bl-cum.dang::before,.panel-head .bl-cum.dang::after{content:'';position:absolute;inset:0;z-index:-1;border-radius:7px;border:1.5px solid var(--bad);" +
          "pointer-events:none;animation:blTamChan 2.4s cubic-bezier(.2,.6,.3,1) infinite}" +
        ".panel-head .bl-cum.dang::after{animation-delay:1.2s}" +
        "@keyframes blTamChan{0%{transform:scale(1);opacity:.6}70%{opacity:.12}100%{transform:scale(1.3,1.75);opacity:0}}" +
        "@media (prefers-reduced-motion:reduce){.panel-head .bl-cum.dang::before,.panel-head .bl-cum.dang::after{animation:none;opacity:0}}",
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
      /* 05/11 Việc hôm nay theo người (bản mẫu PDF user duyệt): bảng lưới 4–5 cột · hàng mở = danh sách vị trí gom hạng mục */
      B + " .bd-nay-phai{display:flex;align-items:center;gap:8px;margin-left:auto}",
      B + " .bd-seg{display:inline-flex}" + B + " .bd-seg .hp-whtab{display:inline-flex;align-items:center;min-height:32px;padding:0 12px;font:inherit;font-size:13px;cursor:pointer;white-space:nowrap}",
      B + " .bd-tom{display:flex;flex-wrap:wrap;gap:4px 24px;margin:0 0 12px;color:var(--muted);font-size:13px}" + B + " .bd-tom b{color:var(--text);font-weight:600}" + B + " .bd-tom .bd-do b{color:inherit}",
      B + " .bd-chon-bar{display:flex;align-items:center;gap:8px;margin:0 0 12px;padding:8px 12px;border-radius:8px;background:color-mix(in srgb,var(--accent) 8%,var(--surface));font-size:13px}" + B + " .bd-chon-bar>span{margin-right:auto}",
      B + " .bd-ngb{--cot:minmax(230px,1.3fr) 120px minmax(0,2fr) 130px 160px 84px;border-top:1px solid var(--ad-chia,var(--border))}" + B + " .bd-ngb.co-task{--cot:minmax(230px,1.3fr) 120px minmax(0,1.8fr) 130px 160px 110px 84px}",
      /* 06/11 cột «Lưu trình»: Chưa gán · Đã gán (task work) · Đang làm · Đã làm (chờ duyệt) · Hoàn thành (đã duyệt) — đếm vị trí theo trạng thái planogram */
      B + " .bd-lt{display:flex;flex-direction:column;gap:2px;font-size:12.5px;line-height:18px}" + B + " .bd-lt>span{display:flex;align-items:center;gap:6px;white-space:nowrap}" +
        B + " .bd-lt i{flex:none;width:7px;height:7px;border-radius:50%;background:var(--muted)}" + B + " .bd-lt b{font-weight:600;font-variant-numeric:tabular-nums}" +
        B + " .bd-lt .lt-gan i{background:var(--info)}" + B + " .bd-lt .lt-dg i{background:var(--warn)}" + B + " .bd-lt .lt-dl i{background:var(--accent)}" + B + " .bd-lt .lt-ht i{background:var(--good)}",
      B + " .bd-ngh," + B + " .bd-ngr-h{display:grid;grid-template-columns:var(--cot);gap:16px;align-items:center;padding:10px 12px;border-bottom:1px solid var(--ad-chia,var(--border))}",
      B + " .bd-ngh{background:var(--ad-nen2,var(--surface2));font-size:12.5px;font-weight:600;color:var(--text)}",
      B + " .bd-ngr-h{cursor:pointer;font-size:13.5px;transition:background .15s}" + B + " .bd-ngr-h:hover," + B + " .bd-ngr.mo>.bd-ngr-h{background:var(--ad-re,var(--hover))}",
      B + " .bd-ngr-h:focus-visible{outline:none;box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--accent) 30%,transparent)}",
      B + " .bd-ngr-ten{display:flex;align-items:center;gap:8px;min-width:0}" + B + " .bd-ngr-tn{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" + B + " .bd-ngr.thieu .bd-ngr-ten{font-weight:600}",
      B + " .bd-mui{flex:none;width:0;height:0;border:4px solid transparent;border-left:5px solid var(--muted);margin-right:-2px;transition:transform .2s var(--ez-apple,ease)}" + B + " .bd-ngr.mo .bd-mui{transform:rotate(90deg) translateX(2px)}",
      B + " .bd-av{flex:none;width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,var(--surface))}",
      B + " .bd-dl-dt{display:none}",
      B + " .bd-ngr-ds-ten{display:flex;flex-direction:column;gap:6px;min-width:0}" + B + " .bd-ngr-mot{display:flex;align-items:center;gap:8px;min-width:0;min-height:28px}" +
        B + " .bd-ngr-dl{display:flex;flex-direction:column;gap:6px}",
      B + " .bd-ngr-hm{display:flex;flex-wrap:wrap;gap:2px 16px;min-width:0}" + B + " .bd-hmc{white-space:nowrap}" + B + " .bd-hmc b{font-weight:600;color:var(--muted)}",
      B + " .bd-tien{display:flex;align-items:center;gap:8px}" + B + " .bd-tien-r{flex:1;height:6px;border-radius:3px;background:var(--ad-nen2,var(--surface2));overflow:hidden}" +
        B + " .bd-tien-r i{display:block;height:100%;background:var(--good)}" + B + " .bd-tien b{min-width:60px;white-space:nowrap;text-align:right;font-weight:400;font-variant-numeric:tabular-nums}",
      B + " .bd-tk b{font-weight:400;font-variant-numeric:tabular-nums;margin-right:6px}" + B + " .bd-tk a," +
        B + " .bd-lk{color:var(--accent);text-decoration:none;font:inherit;font-size:13px;background:none;border:0;padding:0;cursor:pointer;white-space:nowrap}" +
        B + " .bd-tk a:hover," + B + " .bd-lk:hover{text-decoration:underline}",
      B + " .bd-ngr-ds{padding:0 0 8px;background:var(--ad-re,var(--hover));border-bottom:1px solid var(--ad-chia,var(--border))}",
      B + " .bd-vtn{padding:12px 12px 4px 26px;font-size:14px;line-height:22px;font-weight:600;color:var(--text)}",
      B + " .bd-vtd{display:grid;grid-template-columns:var(--cot);gap:16px;align-items:center;min-height:40px;padding:4px 12px;border-bottom:1px solid var(--ad-chia,var(--border));font-size:13px;" +
        "color:color-mix(in srgb,var(--text) 80%,var(--muted))}" +
        B + " .bd-vtd:last-child{border-bottom:0}" + B + " .bd-vtd-a{grid-column:1/4;display:flex;align-items:center;gap:10px;min-width:0;padding-left:14px}" +
        B + " .bd-vtd-lk{justify-self:end}" + B + " .bd-vtd-a>.bd-ck," + B + " .bd-vtd-a>.bd-ck-tr{flex:none}" + B + " .bd-vtd-lk .bd-lk{box-shadow:none;min-height:0}" + B + " .bd-lt .lt-qh{color:var(--bad)}",
      B + " .bd-vtd-ten{cursor:pointer;min-width:0}" + B + " .bd-vtd-ten:hover{color:var(--accent)}" + B + " .bd-vtd code," + "#bdDoiHop code{font:12px ui-monospace,Consolas,monospace;color:var(--muted);margin-left:6px}",
      B + " .bd-tien small{font-size:12px;color:var(--muted);margin-left:3px}",
      /* 06/11 Theo khu — bảng đối xứng hạng mục × SHOP | WH. Đầu bảng = khuôn hp-mtbl nguyên bản (nền nhấn, chữ trắng, sticky). Ô gọn 8/12px.
         Xuống dòng: chỉ tên hạng mục / tên vị trí được gói; số, đơn vị, tên người, chip = nowrap. */
      B + " .bd-kbang-w{overflow-x:auto}" + B + " .bd-kbang{table-layout:fixed;font-size:13px}" +
        B + " .bd-kbang th[data-khu]," + B + " .bd-kbang td.bd-ko{border-left:1px solid var(--ad-chia,var(--border))}",
      /* 06/11 lượt 4 user «dùng màu thư viện nhưng nổi bật — nền nhấn đậm màu mè quá; hàng xen kẽ để không rối»:
         đầu cột = nền xám thư viện (--ad-nen2) + vạch nhấn 2px đáy, tên kho màu nhấn; cột Hạng mục chữ đậm, vạch phân cách phải;
         hàng chẵn nền --ad-nen2 nhạt (xen kẽ) — dữ liệu không tô màu. */
      B + " .bd-kbang thead th{position:sticky;top:0;z-index:1;background:var(--ad-nen2,var(--surface2));color:var(--text);white-space:nowrap;padding:10px 12px;border-bottom:2px solid var(--accent)}" +
        B + " .bd-kbang thead th.bd-kh-hm{font-size:12px;font-weight:600;color:var(--muted);letter-spacing:.02em;text-transform:uppercase}",
      B + " .bd-kbang tbody th," + B + " .bd-kbang td{white-space:normal;vertical-align:top;padding:8px 12px;border-bottom:1px solid var(--ad-chia,var(--border));text-align:left}" +
        B + " .bd-kbang th.bd-kh-hm{width:190px}" + B + " .bd-kbang tbody th.bd-kh-hm{font-weight:400;background:transparent;border-right:1px solid var(--ad-chia,var(--border))}" +
        B + " .bd-kbang tbody tr:nth-child(even)>*{background-color:color-mix(in srgb,var(--ad-nen2,var(--surface2)) 70%,transparent)}",
      B + " .bd-kh-d{display:flex;align-items:baseline;justify-content:space-between;gap:12px}" + B + " .bd-kh-t{font-size:15.5px;font-weight:700;color:var(--accent);overflow:hidden;text-overflow:ellipsis}" +
        B + " .bd-kh-so{font-weight:400;flex:none;font-size:12.5px}" + B + " .bd-kh-so b{font-size:16px;font-weight:700;font-variant-numeric:tabular-nums}",
      B + " .bd-kh-ql{display:flex;align-items:center;gap:6px;margin-top:4px;font-weight:400;font-size:12.5px;min-height:24px;overflow:hidden}" + B + " .bd-kh-ql .bd-kn{opacity:1}" +
        B + " .bd-kh-ql .bd-lk{font-size:12px;margin-left:auto}" + B + " .bd-kh-ql .bd-kh-chua{color:var(--muted)}",
      B + " .bd-kh-ten{display:block;font-weight:700;font-size:14px;line-height:20px;color:var(--text)}" + B + " .bd-kh-n{display:block;font-size:12px;color:var(--muted);white-space:nowrap}" +
        B + " .bd-kh-ro{color:var(--warn);cursor:help}",
      B + " .bd-ko.trong{background:repeating-linear-gradient(45deg,var(--ad-nen2,var(--surface2)) 0 6px,transparent 6px 12px);white-space:nowrap}" + B + " .bd-ko.trong .bd-phu," + B +
        " .bd-ko.trong .bd-ka{display:inline;margin-left:0}" + B + " .bd-ko.trong .bd-ka{margin-left:12px}",
      B + " .bd-kql{display:flex;flex-wrap:wrap;align-items:center;gap:2px 10px;font-size:12px;color:var(--muted);margin-bottom:4px}" + B + " .bd-kql .bd-kn{color:var(--text)}",
      B + " .bd-kg{display:flex;align-items:center;gap:8px;min-height:34px}" + B + " .bd-kg+.bd-kg{border-top:1px dashed var(--ad-chia,var(--border))}" +
        /* 06/11 lượt 5: chồng ảnh 28px; vòng đỏ = chưa chấm công (đã chấm công không vòng); nền ô theo tiến độ (thắng nền hàng xen kẽ) */
        B + " .bd-kav{display:inline-flex;align-items:center;padding-left:4px}" + B + " .bd-kav-1{display:inline-flex;border-radius:50%;margin-left:-4px;box-shadow:0 0 0 2px var(--surface)}" +
        B + " .bd-kav-1 .bd-av{width:28px;height:28px}" + B + " .bd-kav-1.vang{box-shadow:0 0 0 2px var(--surface),0 0 0 4px var(--bad);margin-right:2px;margin-left:0}" +
        /* 06/11 lượt 6: chấm số yêu cầu dính góc trên-phải ảnh (kiểu tin nhắn Messenger); ảnh cách nhau đủ chỗ cho chấm số */
        B + " .bd-ko-nd .bd-kav{gap:8px;padding:2px 0 0}" + B + " .bd-ko-nd .bd-kav-1 .bd-av{width:20px;height:20px;font-size:10px}" +
        B + " .bd-ko-nd .bd-kav-1 .bd-av svg{width:12px;height:12px}" + B + " .bd-ko-nd .bd-kbad{top:-6px;right:-8px;min-width:15px;height:15px;line-height:15px;font-size:9.5px}" +
        B + " .bd-ko-nd .bd-kg{min-height:22px}" + B + " .bd-kbang tbody td.bd-ko{padding-top:6px;padding-bottom:6px}" +
        B + " .bd-kbang tbody .bd-ko-h{margin:-6px -12px;padding:6px 12px}" + B + " .bd-kbang tbody .bd-ko-h .bd-mui{margin-top:6px}" + B + " .bd-kbang tbody th.bd-kh-hm{padding-top:6px;padding-bottom:6px}" +
        B + " .bd-kbang tbody th.bd-kh-hm .bd-kh-ten{display:inline}" + B + " .bd-kbang tbody th.bd-kh-hm .bd-kh-n{display:inline;margin-left:8px}" +   /* 07/11 user «khung mục cha nhỏ lại 0,6 · avatar 0,7» */
        B + " .bd-ko-nd .bd-kav-1," + B + " .bd-pn-h .bd-kav-1{position:relative;margin-left:0}" +
        B + " .bd-kbad{position:absolute;top:-5px;right:-7px;min-width:17px;height:17px;padding:0 4px;border-radius:9px;background:var(--bad);color:var(--accent-text,white);" +
          "font-size:10.5px;line-height:17px;font-weight:700;text-align:center;box-shadow:0 0 0 2px var(--surface);font-variant-numeric:tabular-nums}" +
        B + " .bd-av.bd-av-chua{background:var(--surface);color:var(--bad);border:1.5px dashed var(--bad);box-sizing:border-box}" + B + " .bd-kav-1.chua{box-shadow:none}" +
        /* 07/11 KT bảo trì = ảnh VUÔNG; chấm số theo màu trạng thái work (colorProjectTaskStatus) */
        B + " .bd-kav-1.vuong .bd-av{border-radius:6px}" + B + " :is(.bd-kav-1,.bd-pc-ng).vuong .bd-av img{border-radius:6px}" + B + " .bd-kav-1.vuong{border-radius:8px}" + B + " .bd-kav-1.vuong.vang .bd-av{border-radius:6px}" +
        B + " .bd-kav:has(>.bd-kav-kt)," + B + " .bd-pn.bd-ph .bd-kav:has(>.bd-kav-kt){flex:1 1 0;min-width:0;display:flex;align-items:center}"   /* 07/11 vạch | thẳng cột */ +
        B + " .bd-kav>.bd-kav-vh{flex:0 0 66.667%;display:flex;align-items:center;gap:inherit;min-width:0}" +
        B + " .bd-kav>.bd-kav-vh:has(>:nth-child(4)){gap:0}" + B + " .bd-kav>.bd-kav-vh:has(>:nth-child(4))>.bd-kav-1+.bd-kav-1{margin-left:-8px}" +
        B + " .bd-kav>.bd-kav-kt{flex:1 1 0;display:flex;align-items:center;justify-content:flex-start;gap:inherit;min-width:0;padding-left:4px}" +
        B + " .bd-kav>.bd-kav-vach{flex:none;align-self:stretch;width:1px;margin:4px 0;background:var(--ad-chia,var(--border))}" +
        B + " .bd-kbad.lt-chua{background:var(--muted)}" + B + " .bd-kbad.lt-gan{background:var(--wk-0,var(--muted))}" + B + " .bd-kbad.lt-dg{background:var(--wk-1,var(--info))}" +
        B + " .bd-kbad.lt-dl{background:var(--wk-5,var(--warn))}" + B + " .bd-kbad.lt-ht{background:var(--wk-2,var(--good))}" + B + " .bd-kbad.lt-tre{background:var(--wk-3,var(--bad))}" +
        B + " .bd-kav-1.nho .bd-av{width:22px;height:22px}" + B + " .bd-kav-1.nho .bd-av svg{width:13px;height:13px}" + B + " .bd-kg-fl{flex:1}" +
        B + " .bd-kbang tbody tr>td.bd-ko.tt-do{background-color:color-mix(in srgb,var(--bad) 7%,var(--surface))}" + B + " .bd-kbang tbody tr>td.bd-ko.tt-xanh{background-color:color-mix(in srgb,var(--good) 10%,var(--surface))}" +
        B + " .bd-kbang tbody tr>td.bd-ko.tt-vang{background-color:color-mix(in srgb,var(--warn) 10%,var(--surface))}" +
        B + " .bd-kg-ng{flex:1;min-width:0;display:flex;flex-wrap:wrap;gap:2px 12px}" + B + " .bd-kn{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}" + B + " .bd-kn.vang{color:var(--bad)}",
      B + " .bd-kso{flex:none;min-width:36px;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}" + B + " .bd-kso b{font-weight:600}" + B + " .bd-kso.du b{color:var(--good)}",
      B + " .bd-pv{flex:none;font-size:11.5px;line-height:18px;padding:0 6px;border-radius:4px;white-space:nowrap}" + B + " .bd-pv.gom{background:color-mix(in srgb,var(--accent) 10%,transparent);color:var(--accent)}" +
        B + " .bd-pv.tach{background:color-mix(in srgb,var(--warn) 14%,transparent);color:color-mix(in srgb,var(--warn) 70%,var(--text))}",
      B + " .bd-ko-h{display:flex;align-items:flex-start;gap:6px;cursor:pointer;margin:-8px -12px;padding:8px 12px}" + B + " .bd-ko-h:hover{background:var(--ad-re,var(--hover))}" +
        B + " .bd-ko-h:focus-visible{outline:none;box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--accent) 30%,transparent)}" + B + " .bd-ko-nd{flex:1;min-width:0}" +
        B + " .bd-ko-h .bd-mui{margin:10px 0 0;transition:transform .2s var(--ez-apple,ease)}" + B + " .bd-ko.mo .bd-ko-h .bd-mui{transform:rotate(90deg) translateX(2px)}" + B + " .bd-ko.mo .bd-ko-h{margin-bottom:0}",
      B + " .bd-ko-ds{margin-top:4px}" + B + " .bd-ko-can{margin-top:4px;font-size:12px;line-height:18px;color:color-mix(in srgb,var(--warn) 70%,var(--text))}" + B + " .bd-ko-ds.vua-mo," + B +
        " .bd-ngr-ds.vua-mo," + B + " .bd-kdt-ds.vua-mo{animation:fadeUp .2s var(--ez-apple,ease) both}" +
        B + " .bd-kvt{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;gap:0 10px;align-items:center;padding:6px 0;border-top:1px dashed var(--ad-chia,var(--border));font-size:12.5px}",
      B + " .bd-kvt-ten{min-width:0;line-height:18px}" + B + " .bd-kvt .bd-vtd-ten{cursor:pointer}" + B + " .bd-kvt .bd-vtd-ten:hover{color:var(--accent)}" +
        B + " .bd-kvt code{display:block;font:11px ui-monospace,Consolas,monospace;color:var(--muted);white-space:nowrap}" + B + " .bd-kvt-ng{display:block;color:var(--muted)}",
      B + " .bd-kvt-lt i{display:block;width:8px;height:8px;border-radius:50%;background:var(--muted)}" + B + " .bd-kvt-lt .qh i{box-shadow:0 0 0 2px color-mix(in srgb,var(--bad) 35%,transparent)}",
      B + " .bd-kvt-anh{color:var(--muted);text-align:right;white-space:nowrap}" + B + " .bd-kvt-lk{display:flex;gap:12px;white-space:nowrap}" + B + " .bd-kvt-lk:empty{display:none}" +
        "@media (hover:hover){" + B + " .bd-kvt-lk{opacity:0;transition:opacity .12s}" + B + " .bd-kvt:hover .bd-kvt-lk," + B + " .bd-kvt:focus-within .bd-kvt-lk{opacity:1}}",
      /* 06/11 lượt 6 (mẫu 5): dòng con = vạch trái + nền nhạt theo Lưu trình · tên (+ bút đổi tên, «chờ WMS») · ảnh người + nút đổi người sát ảnh · số ảnh · nhãn Lưu trình */
      B + " .bd-ko-ds .bd-kvt{grid-template-columns:minmax(0,1fr) auto auto auto auto;gap:0 12px;padding:6px 8px;margin:0 -8px;border-top:0;border-radius:4px;" +
          "box-shadow:inset 3px 0 0 var(--lt-m);background:color-mix(in srgb,var(--lt-m) 9%,transparent);--lt-m:var(--muted)}" + B + " .bd-ko-ds .bd-kvt+.bd-kvt{margin-top:4px}" +
        /* 06/11 lượt 8 user «lấy theo màu status của workflow ở work.hasaki.vn» — bảng colorProjectTaskStatus trong mã trang work (đọc 06/11 khi đã đăng nhập):
           0 Chưa bắt đầu rgb(204,204,204) · 1 Đang xử lý rgb(32,170,234) · 2 Hoàn thành rgb(98,210,111) · 3 Trễ hạn rgb(253,97,44) · 5 Chờ duyệt rgb(246,153,63).
           Ánh xạ: Đã giao·chưa làm = 0 · Đang làm = 1 · Đã làm·chờ duyệt = 5 · Hoàn thành = 2 · Quá hạn = 3. «Chưa giao task» (chưa có task work) = xám nhạt --muted.
           Khai báo 1 lần thành biến (--wk-*) — màu thương hiệu ngoài như palette biểu đồ, không phải màu tự chọn. */
        B + "{--wk-0:rgb(204,204,204);--wk-1:rgb(32,170,234);--wk-2:rgb(98,210,111);--wk-3:rgb(253,97,44);--wk-5:rgb(246,153,63)}" +
        B + " .bd-kvt.lt-gan{--lt-m:var(--wk-0)}" + B + " .bd-kvt.lt-dg{--lt-m:var(--wk-1)}" + B + " .bd-kvt.lt-dl{--lt-m:var(--wk-5)}" + B + " .bd-kvt.lt-ht{--lt-m:var(--wk-2)}" +
        B + " .bd-kvt.qh:not(.lt-ht):not(.lt-dl){--lt-m:var(--wk-3)}" + B + " .bd-kvt.lt-chua:not(.qh){--lt-m:color-mix(in srgb,var(--muted) 60%,transparent)}",
      B + " .bd-kvt-tt{font-size:12px;white-space:nowrap;color:color-mix(in srgb,var(--lt-m) 75%,var(--text))}" + B + " .bd-ko-ds .bd-kvt-tt{text-align:right}" +
        B + " .bd-kvt-ngs{display:inline-flex;align-items:center;gap:4px}" + B + " .bd-kvt-ma{display:flex;align-items:center;gap:2px;white-space:nowrap}" + B + " .bd-kvt-ma code{display:inline}" + B +
          " .bd-kvt-ma .bd-kvt-but{width:22px;height:22px}" + B + " .bd-kvt-ngs .bd-kav{gap:2px;padding:0}" +
        B + " .bd-kvt-doi," + B + " .bd-kvt-but{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:6px;color:var(--muted);vertical-align:middle}" +
        B + " .bd-kvt-doi:hover," + B + " .bd-kvt-but:hover{background:var(--ad-re,var(--hover));color:var(--accent);text-decoration:none}" +
        B + " .bd-kvt-cho{display:inline-block;margin-left:4px;padding:0 6px;border-radius:4px;font-size:11px;line-height:16px;color:color-mix(in srgb,var(--warn) 70%,var(--text));" +
          "background:color-mix(in srgb,var(--warn) 14%,transparent);cursor:help}",
      /* 06/11 lượt 7: thẻ mục con CỐ ĐỊNH 64px — trái 2/3 (tên tối đa 2 dòng + bút cuối tên · dòng mã) | phải 1/3: trạng thái TRÊN, ảnh + đổi người DƯỚI */
      B + " .bd-ko-ds .bd-kvt{grid-template-columns:minmax(0,2fr) minmax(0,1fr);grid-template-areas:'trai ngs';height:64px;gap:0 10px;align-items:stretch;padding:6px 8px 6px 10px;overflow:hidden}" +
        B + " .bd-kvt-trai{grid-area:trai;min-width:0;display:flex;flex-direction:column;justify-content:center}" +
        B + " .bd-ko-ds .bd-kvt-ten{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:18px;white-space:normal}" +
        B + " .bd-kvt-ten .bd-kvt-but{width:20px;height:20px;margin-left:2px}" + B + " .bd-kvt-ql{color:var(--muted);margin-left:6px;font-size:11.5px}",
      /* 07/11 user «bỏ trạng thái chưa giao / đã giao… ở mục con; ảnh người làm căn phải + giữa khung, to ×1,5» */
      B + " .bd-ko-ds .bd-kvt-tt{display:none}" +
        B + " .bd-ko-ds .bd-kvt-ngs{grid-area:ngs;justify-self:end;align-self:center;gap:2px}" + B + " .bd-ko-ds .bd-kav-1.nho .bd-av{width:33px;height:33px;font-size:14px}" +
        B + " .bd-ko-ds .bd-kav-1.nho .bd-av svg{width:19px;height:19px}" + B + " .bd-kvt-qlb{font-size:11.5px;margin-right:6px}" +
        "@media (hover:hover){" + B + " .bd-kvt-qlb{opacity:0}" + B + " .bd-kvt:hover .bd-kvt-qlb," + B + " .bd-kvt:focus-within .bd-kvt-qlb{opacity:1}}",
      B + " .bd-ko-tt{display:flex;flex-wrap:wrap;gap:4px 16px;padding-top:6px;border-top:1px solid var(--ad-chia,var(--border));font-size:12.5px}" + B + " .bd-ko-tt .bd-do{color:var(--bad)}",
      /* 06/11 lượt 12 — đầu kho 3 dòng căn trái «Tên kho / Quản lý / N hạng mục | x/y đã hoàn thành» (dùng chung bảng, thẻ kho điện thoại, Theo người) */
      B + " .bd-kd{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;min-width:0}" + B + " .bd-kd-t{font-size:15.5px;font-weight:700;line-height:22px;color:var(--accent);white-space:normal}" +
        B + " .bd-kd .bd-kh-ql{margin-top:0;align-self:stretch}" + B + " .bd-kd-so{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 8px;font-size:12.5px;font-weight:400;color:var(--muted)}" +
        B + " .bd-kd-so b{font-size:15px;font-weight:700;color:var(--text);font-variant-numeric:tabular-nums}" + B + " .bd-kd-vach{color:var(--ad-chia,var(--border))}" + B + " .bd-kd-so .bd-do{color:var(--bad)}",
      B + " .bd-kdt-kho{position:relative;padding-right:32px}" + B + " .bd-kdt-mui{position:absolute;right:14px;top:18px;margin:0}" +
        /* 07/11: thẻ kho đang mở (điện thoại) — mũi tên xoay xuống, bấm bất kỳ chỗ nào thu lại; hạng mục bên dưới = thẻ gập */
        B + " .bd-kdt-mo .bd-kdt-mui{transform:rotate(90deg) translateX(2px)}" + B + " .bd-kdt-mo{margin-bottom:10px;border-color:var(--accent)!important}" +
        B + " .bd-kdt-hm.vua-mo{animation:fadeUp .2s var(--ez-apple,ease) both}" +
        B + " .bd-kd-so>span:not(.bd-kd-vach){font-variant-numeric:tabular-nums;white-space:nowrap}" + B + " .bd-ko-rong .bd-phu{display:block}" +
        B + " .bd-kvt-ky{display:inline-block;margin-right:6px;padding:0 6px;border-radius:4px;font-size:11px;line-height:16px;white-space:nowrap;color:var(--muted);" +
          "background:var(--ad-nen2,var(--surface2));border:1px solid var(--ad-chia,var(--border))}" + B + " .bd-gia{margin-left:8px;vertical-align:middle}",
      /* 06/11 lượt 12 — Theo người = Kho › người › vị trí: khối kho (đầu nền xám thư viện + vạch nhấn), mỗi người 1 dòng ≥ 44px (ảnh + 2 chữ cuối tên + x/y) */
      B + " .bd-pk-luoi{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start}" +
        B + " .bd-pk{border:1px solid var(--ad-chia,var(--border));border-radius:8px;overflow:hidden;background:var(--surface)}" +
        B + " .bd-pk-dau{padding:10px 12px;background:var(--ad-nen2,var(--surface2));border-bottom:2px solid var(--accent)}" + B + " .bd-pk-trong{padding:12px}",
      B + " .bd-pn+.bd-pn{border-top:1px solid var(--ad-chia,var(--border))}" + B + " .bd-pn.chua{background:color-mix(in srgb,var(--bad) 6%,var(--surface))}" +
        B + " .bd-pn-h{display:flex;align-items:center;gap:8px;min-height:44px;padding:4px 12px;cursor:pointer}" + B + " .bd-pn-h:hover{background:var(--ad-re,var(--hover))}" +
        B + " .bd-pn-h:focus-visible{outline:none;box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--accent) 30%,transparent)}" + B + " .bd-pn-h .bd-mui{margin:0;transition:transform .2s var(--ez-apple,ease)}" +
        B + " .bd-pn.mo>.bd-pn-h .bd-mui{transform:rotate(90deg) translateX(2px)}" + B + " .bd-pn-h .bd-kav{gap:0;padding:6px 6px 2px 2px}" + B + " .bd-pn-ten{font-size:13.5px;font-weight:500;white-space:nowrap}" +
        B + " .bd-pn>.bd-ko-ds{padding:0 12px 10px}" + B + " .bd-pn>.bd-ko-ds .bd-vtn{padding:8px 0 4px;font-size:12.5px}",
      /* 06/11 lượt 13 — Theo người / Theo hạng mục: lưới thẻ gập (align-start: mở 1 thẻ không kéo thẻ bên cạnh), lớp 2 hạng mục thụt trong thẻ */
      B + " .bd-pl{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,420px),1fr));gap:12px;align-items:start}" +
        B + " .bd-pl>.bd-pn{border:1px solid var(--ad-chia,var(--border));border-radius:8px;overflow:hidden;background:var(--surface)}" + B + " .bd-pl>.bd-pn+.bd-pn{border-top:1px solid var(--ad-chia,var(--border))}" +
        B + " .bd-pm-ten{flex:1 1 auto;min-width:0;font-size:13.5px;font-weight:600;line-height:18px}" + B + " .bd-pn.bd-pm .bd-pm-ten{font-weight:500}" +
        B + " .bd-pn.bd-pm .bd-pn-h{min-height:40px;padding:2px 0}" + B + " .bd-pn.bd-pm>.bd-ko-ds{padding:0 0 8px}" + B + " .bd-pn.bd-pm+.bd-pn.bd-pm{border-top:1px dashed var(--ad-chia,var(--border))}" +
        B + " .bd-pn.bd-ph .bd-kav{flex:none}",
      /* 06/11 lượt 12 — chú giải Lịch thực hiện = hàng viên như chú giải Planogram (.hp-legchip): viền tròn, ô màu + chữ ngắn, chú thích dài ở tooltip */
      B + " .bd-chu{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px;color:var(--text)}" +
        B + " .bd-chu-it{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;min-height:30px;padding:3px 10px;border-radius:999px;border:1px solid var(--border);" +
          "background:var(--surface);font-size:11.5px;font-weight:600;line-height:16px;white-space:nowrap}" + B + " .bd-chu .bd-chu-it i{margin:0;flex:none}" + B + " .bd-chu-it .bd-xam{font-weight:600}",
      "@media(max-width:768px){" + B + " .bd-chu{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:2px}" + B + " .bd-chu::-webkit-scrollbar{display:none}" +
        B + " .bd-pk-ds{border:1px solid var(--ad-chia,var(--border));border-radius:8px;overflow:hidden;background:var(--surface)}}",
      B + " .bd-kchan{display:flex;flex-wrap:wrap;align-items:center;gap:8px 20px;padding:10px 0 0;font-size:13px}" + B + " .bd-kthem{display:flex;flex-wrap:wrap;gap:8px;align-items:center}" +
        B + " .bd-kthem input{height:32px;padding:0 10px;border:1px solid var(--ad-chia,var(--border));border-radius:6px;font:inherit;min-width:220px;background:var(--surface);color:var(--text)}",
      "#bdChonHop .bd-chon-mt{font-size:13px;margin:0 0 12px}" + "#bdChonHop .bd-chon-ds{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}" +
        "#bdDoiHop .bd-hop-giu{display:flex;flex-wrap:wrap;gap:6px;align-items:center}" +
          "#bdChonHop .bd-ng-chon,#bdDoiHop .bd-ng-chon{display:inline-flex;align-items:center;gap:6px;padding:2px 4px 2px 2px;border:1px solid var(--border);border-radius:16px;font-size:13px}" +
        "#bdChonHop .bd-ng-chon .bd-bo-chon,#bdDoiHop .bd-ng-chon .bd-bo-chon{display:inline-flex;align-items:center;justify-content:center;flex:none;width:18px;height:18px!important;min-height:0!important;margin:0 3px;padding:0;line-height:0;" +
          "border-radius:50%;background:var(--bad);color:var(--surface)}" +
        "#bdChonHop .bd-ng-chon .bd-bo-chon:hover,#bdDoiHop .bd-ng-chon .bd-bo-chon:hover{filter:brightness(.9);text-decoration:none}" +
          "#bdChonHop .bd-chon-xoa{color:var(--bad);background:none;border:0;padding:0;font:inherit;font-size:13px;cursor:pointer;margin-right:auto}",
      B + " .bd-ck," + B + " .bd-ck-het," + "#bdDoiHop input[type=radio]{width:16px;height:16px;margin:0;accent-color:var(--accent);cursor:pointer}" + B + " .bd-ck-tr{width:16px}",
      B + " .bd-chon-het{display:inline-flex;flex-direction:row;align-items:center;gap:8px;margin:0;font-weight:400;text-transform:none;letter-spacing:0;color:var(--text);padding:10px 0 0;font-size:13px;cursor:pointer}",
      B + " .bd-ckl.bd-ckl-rong{columns:3 280px}",
      B + " .bd-ckl.bd-ckl-rong .bd-nk{margin:0 0 20px}" + B + " .bd-ckl.bd-ckl-rong .bd-nk-dau{display:flex;align-items:flex-start;gap:8px;padding:8px 4px;border-bottom:2px solid var(--ad-chia,var(--border))}",
      B + " .bd-ckl.bd-ckl-rong .bd-nk-tt{flex:1;min-width:0}" + B + " .bd-ckl.bd-ckl-rong .bd-nk-ten{display:block;font-size:14.5px;line-height:22px;font-weight:600;letter-spacing:0;text-transform:none;color:var(--text)}",
      B + " .bd-ckl.bd-ckl-rong .bd-nk-ai{display:block;font-size:12px;line-height:18px;font-weight:400;color:var(--muted)}" + B + " .bd-ckl.bd-ckl-rong .bd-nk-so{font-size:13px;line-height:22px}",
      B + " .bd-av{overflow:hidden}" + B + " .bd-av.co-anh," + "#bdDoiHop .bd-av.co-anh{background:var(--surface2)}" + B + " .bd-av img," + "#bdDoiHop .bd-av img{width:100%;height:100%;object-fit:cover;border-radius:50%;display:block}" +
        "#bdDoiHop .bd-av{overflow:hidden}",
      /* hộp đổi người */
      /* vỏ tự đủ (CSS .hp-modal của Planogram chỉ có khi mô-đun đó đã nạp) */
      "#bdDoiHop{display:none;position:fixed;inset:0;z-index:1200;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.45);opacity:0;transition:opacity .2s}" + "#bdDoiHop.show{opacity:1}",
      "#bdDoiHop .hp-modalbox{display:flex;flex-direction:column;max-height:90vh;background:var(--surface);color:var(--text);box-shadow:0 6px 16px rgba(0,0,0,.08),0 3px 6px -4px rgba(0,0,0,.12),0 9px 28px 8px rgba(0,0,0,.05);" +
        "transform:translateY(8px);transition:transform .22s var(--ez-apple,ease)}" +
        "#bdDoiHop.show .hp-modalbox{transform:none}",
      "#bdDoiHop .hp-modalhd{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:16px 20px 0}" + "#bdDoiHop .hp-modalhd .mt{font-size:16px;font-weight:600}" +
        "#bdDoiHop .hp-modalbody{overflow:auto;overscroll-behavior:contain}",
      "#bdDoiHop .hp-modalbox{width:min(480px,96vw);border-radius:8px}" + "#bdDoiHop .hp-modalbody{padding:0 20px 8px}",
      /* 07/11 viên chọn trượt (datTr): rãnh vẽ ở khung .bd-seg, nút trong suốt nằm trên viên; tắt viên ::before của khuôn antd */
      ":is(#bdNay,#bdDoiHop) .bd-seg.co-tr{position:relative;isolation:isolate;background:var(--ad-ray,var(--surface2));border-radius:8px}" +
        ":is(#bdNay,#bdDoiHop) .bd-seg.co-tr .hp-whtab{background:transparent!important;position:relative;z-index:1;margin-left:0!important}" +
        ":is(#bdNay,#bdDoiHop) .bd-seg.co-tr.co-tr .hp-whtab.active::before{display:none}" +
        ".bd-seg-tr{position:absolute;top:2px;bottom:2px;left:0;width:0;z-index:0;border-radius:6px;background:var(--surface);pointer-events:none;" +
          "box-shadow:0 1px 2px 0 rgba(0,0,0,.03),0 1px 6px -1px rgba(0,0,0,.02),0 2px 4px 0 rgba(0,0,0,.02);" +
          "transition:transform .3s cubic-bezier(.645,.045,.355,1),width .3s cubic-bezier(.645,.045,.355,1)}" +
        "@media (prefers-reduced-motion:reduce){.bd-seg-tr{transition:none}}",
      /* 07/11 hộp «Thêm vị trí» — cùng vỏ #bdDoiHop */
      "#bdThemHop{display:none;position:fixed;inset:0;z-index:1200;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.45);opacity:0;transition:opacity .2s}#bdThemHop.show{opacity:1}" +
        "#bdThemHop .hp-modalbox{display:flex;flex-direction:column;width:min(520px,96vw);max-height:90vh;border-radius:8px;background:var(--surface);color:var(--text);" +
          "box-shadow:0 6px 16px rgba(0,0,0,.08),0 3px 6px -4px rgba(0,0,0,.12),0 9px 28px 8px rgba(0,0,0,.05);transform:translateY(8px);transition:transform .22s var(--ez-apple,ease)}" +
        "#bdThemHop.show .hp-modalbox{transform:none}" +
        "#bdThemHop .hp-modalhd{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:16px 20px 0}#bdThemHop .hp-modalhd .mt{font-size:16px;font-weight:600}",
      "#bdThemHop .bd-them-than{display:flex;flex-direction:column;gap:12px;padding:16px 20px 12px;overflow:visible}#bdThemHop .hp-modalbox{overflow:visible;max-height:none}" +   /* 07/11 danh sách ô chọn không bị khung hộp cắt */
        "#bdThemHop .bd-ls-hang{display:flex;flex-wrap:wrap;gap:12px}#bdThemHop .bd-ls-hang>.bd-ls-o{flex:1 1 140px}#bdThemHop .bd-ls-hang>.bd-ls-o.rong{flex:2 1 200px}" +
        "#bdThemHop .bd-ls-hang>.bd-ls-o.hep{flex:0 1 110px}" +
        "#bdThemHop .bd-ls-o{display:flex;flex-direction:column;gap:4px;min-width:0;font-size:12px;color:var(--muted)}",
      "#bdThemHop .bd-ls-o :is(input,select,textarea){width:100%;min-width:0;min-height:36px;padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);" +
          "color:var(--text);font:inherit;font-size:14px}" +
        "#bdThemHop .bd-ls-o :is(input,select,textarea):focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 16%,transparent)}" +
        "#bdThemHop [aria-invalid=true]{border-color:var(--bad)!important}#bdThemHop .bd-them-loi{min-height:0;color:var(--bad);font-size:12px}#bdThemHop .bd-them-loi:empty{display:none}" +
        "#bdThemHop .bd-do{color:var(--bad)}#bdThemHop input[name=bin]{font-family:ui-monospace,Consolas,monospace;letter-spacing:.2px}",
      "#bdThemHop .bd-hop-chan{display:flex;align-items:center;gap:8px;padding:12px 20px 16px;border-top:1px solid var(--border)}#bdThemHop .bd-hop-bao{flex:1}" +
        "@media(max-width:768px){#bdThemHop{align-items:flex-end;padding:0}#bdThemHop .hp-modalbox{width:100%;border-radius:12px 12px 0 0;max-height:92vh;overflow:hidden}" +
          "#bdThemHop .bd-them-than{overflow:auto;overscroll-behavior:contain}" +
          "#bdThemHop .bd-ls-o :is(input,select,textarea){font-size:16px;min-height:44px}#bdThemHop .bd-hop-chan .hsk-nut{min-height:44px}}",
      "#bdDoiHop .bd-hop-vt{margin-top:16px;padding:8px 12px;border-radius:6px;background:var(--surface2);font-size:13.5px;line-height:22px}",
      "#bdDoiHop .bd-hop-nh{margin:16px 0 6px;font-size:12px;color:var(--muted)}" + "#bdDoiHop .bd-hop-hien{font-size:13.5px}",
      "#bdDoiHop .bd-hop-tim{width:100%;height:32px;margin-bottom:8px;padding:4px 11px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font:inherit;font-size:13.5px}",
      "#bdDoiHop .bd-hop-tim:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 16%,transparent)}",
      "#bdDoiHop .bd-hop-ds{border:1px solid var(--border);border-radius:6px;max-height:300px;overflow:auto;overscroll-behavior:contain}",
      "#bdDoiHop .bd-hop-ng[hidden],#bdDoiHop .bd-hop-trong[hidden]{display:none}" +
        "#bdDoiHop .bd-hop-ng{display:flex;flex-direction:row;text-align:left;margin:0;font-weight:400;text-transform:none;letter-spacing:0;color:var(--text);align-items:center;gap:8px;padding:8px 12px;" +
          "border-bottom:1px solid var(--border);cursor:pointer;font-size:13.5px}" +
        "#bdDoiHop .bd-hop-ng:last-of-type{border-bottom:0}",
      "#bdDoiHop .bd-hop-ten{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#bdDoiHop .bd-hop-ten code{white-space:nowrap}" +   /* 07/11 tên + mã NV không xuống dòng */
      "#bdDoiHop .bd-hop-ten small{display:block;line-height:16px}" + "#bdDoiHop .bd-hop-ten code{margin-left:4px}" + "#bdDoiHop .bd-hop-trong{padding:8px 12px}" +
        "#bdDoiHop .bd-hop-ng:has(input:checked){background:color-mix(in srgb,var(--accent) 10%,var(--surface))}" + "#bdDoiHop .bd-hop-ten{flex:1;min-width:0}" + "#bdDoiHop .bd-hop-trong{padding:8px 12px}",
      "#bdDoiHop .bd-seg{display:flex}" + "#bdDoiHop .bd-seg .hp-whtab{flex:1;justify-content:center;display:inline-flex;align-items:center;min-height:32px;font:inherit;font-size:13px;cursor:pointer}",
      "#bdDoiHop .bd-hop-chan{display:flex;align-items:center;gap:8px;padding:12px 20px 16px;border-top:1px solid var(--border)}" + "#bdDoiHop .bd-hop-bao{flex:1;font-size:12px}",
      "#bdDoiHop .bd-lk{color:var(--accent);background:none;border:0;padding:0;font:inherit;font-size:13px;cursor:pointer}" + "#bdDoiHop .bd-phu{color:var(--muted);font-size:12px}" + "#bdDoiHop .bd-do{color:var(--bad)}",
      "#bdDoiHop .bd-av{flex:none;width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:var(--accent);" +
        "background:color-mix(in srgb,var(--accent) 12%,var(--surface))}",
      /* điện thoại: hàng người = thẻ 2 dòng; dòng vị trí xuống 2 tầng; hộp = tấm trượt đáy */
      "@media(max-width:768px){" + B + " .bd-ngh{display:none}" + B + " .bd-ngb{border-top:0;display:flex;flex-direction:column;gap:8px}" +
        B + " .bd-ngr{border:1px solid var(--ad-chia,var(--border));border-radius:8px;overflow:hidden}" +
        B + " .bd-ngr-h{grid-template-columns:minmax(0,1fr) 96px;grid-template-areas:'ten ten' 'hm bc' 'lt lt';align-items:start;gap:6px 12px;border-bottom:0;padding:12px;min-height:44px}" +
        B + " .bd-ngr-ten{grid-area:ten}" + B + " .bd-ngr-bc{grid-area:bc}" + B + " .bd-ngr-dl{grid-area:dl;padding-left:34px}" + B + " .bd-ngr-dl:empty," + B + " .bd-ngr-dl{display:none!important}" +
          B + " .bd-ngr-ten .bd-ngr-ds-ten{flex:1}" + B + " .bd-dl-dt{display:inline-flex;margin-left:auto}" + B + " .bd-dl-dt:not(:has(.hsk-chip)){display:none}" + B + " .bd-ngr-tn{flex:1;min-width:0}" +
        B + " .bd-ngr-hm{grid-area:hm;padding-left:34px;color:var(--muted)}" + B + " .bd-ngr-lt{grid-area:lt;padding-left:34px}" + B + " .bd-lt{flex-direction:row;flex-wrap:wrap;gap:2px 14px}" + B + " .bd-ngr-tk{grid-column:1/-1;padding-left:34px}" +
        B + " .bd-ngr-ds{padding:0 12px 8px;border-bottom:0}" +
        /* 06/11 dòng con điện thoại = cùng khuôn thẻ người: hàng 1 tên vị trí | Đổi người · hàng 2 Lưu trình | Đã báo cáo (cột 96px như thẻ cha) */
        B + " .bd-vtd{grid-template-columns:minmax(0,1fr) 96px;grid-template-areas:'a lk' 'lt bc';gap:4px 12px;padding:8px 12px}" +
        B + " .bd-vtd-a{grid-area:a;padding-left:0;align-items:flex-start}" + B + " .bd-vtd-a>.bd-ck," + B + " .bd-vtd-a>.bd-ck-tr{margin-top:3px}" + B + " .bd-vtd code{display:block;margin:0}" +
        B + " .bd-vtd-lt{grid-area:lt;padding-left:26px}" + B + " .bd-vtd-bc{grid-area:bc}" + B + " .bd-vtd-lk{grid-area:lk;min-height:40px;display:inline-flex;align-items:center}" +
        B + " .bd-vtn{padding-left:12px}" + B + " .bd-ngr-h>.bd-ngr-x," + B + " .bd-vtd-tk{display:none}" +
        B + " .bd-seg-dt{margin:0 0 12px}" + B + " .bd-seg-dt .bd-seg{display:flex}" + B + " .bd-seg-dt .bd-seg .hp-whtab{flex:1;justify-content:center}" + B + " .bd-seg .hp-whtab{min-height:40px}" + B + " .bd-chon-bar{flex-wrap:wrap}" +
        "#bdDoiHop{align-items:flex-end;padding:0}" + "#bdDoiHop .hp-modalbox{width:100%;max-height:92vh;border-radius:12px 12px 0 0}" +
        "#bdDoiHop .bd-hop-ng{min-height:44px}" + "#bdDoiHop .bd-hop-tim{height:40px;font-size:16px}" + "#bdDoiHop .bd-seg .hp-whtab{min-height:40px}" + "#bdDoiHop .bd-hop-chan .hsk-nut{flex:1;min-height:44px}" +
          "#bdDoiHop .bd-hop-bao:empty{display:none}}",
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
      B + " .bd-nk{min-width:0;border:1px solid var(--ad-chia,var(--border));border-radius:12px;background:var(--surface);padding:10px 4px 6px}",   /* 06/11: bỏ fadeUp so le riêng — đổi chế độ dùng chung .bd-che-vao */
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
        B + " .bd-hm.kl td.vt{width:1%;min-width:0;max-width:none;white-space:nowrap}" +
        B + " .bd-hm.kl td.vt .bd-ten{display:block;-webkit-line-clamp:unset;white-space:nowrap;overflow:visible}" +   /* 07/11 «không che / không xuống dòng, khung sát chữ cuối tên dài nhất» */
        B + " .bd-kinh{width:46px}" + B + " .bd-kinh-o .bd-o{height:min(22px,calc(100% - 6px))}" +
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
      /* 06/11 Theo khu trên điện thoại: mỗi hạng mục 1 thẻ, 2 khu xếp dọc (nhãn khu đầu mỗi phần); đầu bảng = thẻ tổng theo khu */
      "@media(max-width:768px){" + B + " .bd-kbang," + B + " .bd-kbang thead," + B + " .bd-kbang tbody," + B + " .bd-kbang tr," + B + " .bd-kbang th," + B + " .bd-kbang td{display:block;width:auto!important}" +
        B + " .bd-kbang tr{border:1px solid var(--ad-chia,var(--border));border-radius:8px;margin-bottom:8px;overflow:hidden}" + B + " .bd-kbang th," + B + " .bd-kbang td{border:0;border-top:1px solid var(--ad-chia,var(--border))}" +
        B + " .bd-kbang tr>:first-child{border-top:0}" + B + " .bd-kbang thead th.bd-kh-hm{display:none}" + B + " .bd-kbang thead th[data-khu]:nth-child(2){border-top:0}" +
        B + " .bd-kbang tbody th.bd-kh-hm{background:var(--ad-nen2,var(--surface2));display:flex;align-items:baseline;justify-content:space-between;gap:8px}" + B + " .bd-kbang tbody th.bd-kh-hm small{margin:0}" +
        B + " .bd-ko::before{content:attr(data-khu);display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px}" + B + " .bd-ko-tt .bd-lk," + B + " .bd-kvt-lk .bd-lk," + B +
          " .bd-kql .bd-ka{min-height:40px;display:inline-flex;align-items:center}" +
        B + " .bd-kthem input{min-width:0;flex:1 1 100%;height:40px;font-size:16px}" +
        B + " .bd-kvt{grid-template-columns:auto minmax(0,1fr) auto}" + B +
          " .bd-kh-d{flex-wrap:wrap;row-gap:0}" + B + " .bd-kh-t{white-space:normal}" + B + " .bd-kvt-lk{grid-column:2/-1}" + B + " .bd-ko-h{min-height:44px}}",
      /* 06/11 lượt 11 điện thoại — đi sâu Kho › Hạng mục › Vị trí: thẻ viền --ad-chia bo 8px (khuôn thẻ người Theo người), vùng chạm ≥ 44px */
      /* 07/11 user «mũi tên mục con đổi thành dạng TIMELINE để biết là con của hạng mục cha»: Lịch — trục dọc màu nhấn chạy thẳng từ mũi tên cha,
         mỗi vị trí con 1 chấm tròn trên trục, tên con thụt vào SAU tên cha; dòng đang chọn = chấm đặc */
      B + " .bd-hm tr.vtr.con td.vt{padding-left:34px}" +
        B + " .bd-hm tr.vtr.con td.vt::before{left:11px;top:0;bottom:0;border-left:2px solid color-mix(in srgb,var(--accent) 40%,transparent)}" +
        B + " .bd-hm tr.vtr.con.cuoi td.vt::before{bottom:50%}" +
        B + " .bd-hm tr.vtr.con td.vt::after{left:8px;top:50%;width:8px;height:8px;margin-top:-4px;border:2px solid var(--accent);border-radius:50%;background:var(--surface);box-sizing:border-box}" +
        B + " .bd-hm tr.vtr.con.on td.vt::after{background:var(--accent)}" +
        "@media(max-width:768px){" + B + " .bd-hm tr.vtr.con td.vt{padding-left:30px}" + B + " .bd-hm tr.vtr.con td.vt::before{left:9px}" +
          B + " .bd-hm tr.vtr.con td.vt::after{left:6px;width:8px}" +
          /* 07/11 user «thu hẹp khung cha/con trên điện thoại — sát chữ / ảnh, chừa lại 10px» */
          B + " .bd-kdt-hm>.bd-pn>.bd-pn-h{min-height:0;padding:10px}" +
          B + " .bd-kdt-hm>.bd-pn>.bd-pn-h .bd-kav{padding-top:0;padding-bottom:0}" +
          B + " .bd-kdt-hm>.bd-pn>.bd-pn-h .bd-kav-1 .bd-av{width:20px;height:20px;font-size:10px}" + B + " .bd-kdt-hm>.bd-pn>.bd-pn-h .bd-kbad{top:-6px;right:-8px;min-width:15px;height:15px;line-height:15px;font-size:9.5px}" +
          B + " .bd-ko-ds .bd-kvt{height:auto;min-height:0;padding:10px!important}" +
          B + " .bd-ko-ds .bd-kvt-x{top:2px;right:2px}}",
      "@media(max-width:768px){" + B + " .bd-kdt-khos," + B + " .bd-kdt-ds{display:flex;flex-direction:column;gap:8px}" +
        B + " .bd-kdt-kho{border:1px solid var(--ad-chia,var(--border));border-radius:8px;padding:12px;background:var(--surface);min-height:44px;cursor:pointer}" +
        B + " .bd-kdt-kho:active{background:var(--ad-re,var(--hover))}" + B + " .bd-kdt-kh{display:flex;align-items:center;justify-content:space-between;gap:8px}" +
        B + " .bd-kdt-kh .bd-kh-t{font-size:15.5px;white-space:normal}" + B + " .bd-kdt-kho .bd-mui{margin:0}" +
        B + " .bd-kdt-so{display:flex;flex-wrap:wrap;gap:2px 12px;margin:4px 0 2px;font-size:12.5px;color:var(--muted)}" + B + " .bd-kdt-so b{color:var(--text);font-size:14px}" +
        B + " .bd-kdt-dau{padding:0 0 8px;margin-bottom:8px;border-bottom:2px solid var(--accent)}" + B + " .bd-kdt-lui{min-height:40px;display:inline-flex;align-items:center}" +
        B + " .bd-kdt-dau .bd-kdt-kh{flex-wrap:wrap}" + B + " .bd-kdt-dau .bd-kh-so{font-size:12.5px}" +
        B + " .bd-kdt-ds>.bd-ko{border:1px solid var(--ad-chia,var(--border));border-radius:8px;padding:8px 12px;background:var(--surface);overflow:hidden}" +
        B + " .bd-kdt-ds>.bd-ko::before{display:none}" + B + " .bd-kdt-ds>.bd-ko.tt-do{background:color-mix(in srgb,var(--bad) 7%,var(--surface))}" +
        B + " .bd-kdt-ds>.bd-ko.tt-xanh{background:color-mix(in srgb,var(--good) 10%,var(--surface))}" + B + " .bd-kdt-ds>.bd-ko.tt-vang{background:color-mix(in srgb,var(--warn) 10%,var(--surface))}" +
        B + " .bd-kdt-ten{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-weight:600;font-size:14px;line-height:20px}" +
        B + " .bd-kdt-ten small{font-weight:400;font-size:12px;color:var(--muted);white-space:nowrap}" + B + " .bd-kdt-khong{margin-top:10px;font-size:12.5px;line-height:20px}}",
      "@media(max-width:560px){" + B + " .bd-panel>.panel-head{flex-wrap:wrap;row-gap:4px}" + B + " .bd-panel>.panel-head .ph-dem{white-space:normal}" + B + " .bd-panel>.panel-head .bd-phai{margin-left:0}" + B +
          " .bd-panel>.panel-head .bd-phai a," + B + " .bd-panel>.panel-head .bd-phai .cn-ngay{display:none}}"
    ].join("\n");
    /* 06/11 hộp chọn quản lý / phụ trách (#bdChonHop) dùng CHUNG khuôn hộp đổi người — nhân bản các luật #bdDoiHop (mỗi phần tử mảng = 1 dòng trọn khối) */
    c += "\n" + c.split("\n").filter(function (l) { return l.indexOf("#bdDoiHop") >= 0; }).join("\n").replace(/#bdDoiHop/g, "#bdChonHop");
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
  /* 07/11 user «bổ sung nhanh dấu ✕ để bỏ, dấu chuyển kho ở các mục con»: cấu hình theo vị trí thắng kho của lịch planogram */
  function apDungVt() {
    S.boVt = {};
    Object.keys(S.cfg || {}).forEach(function (k) { var r = S.cfg[k]; if (r["LOẠI"] !== "vt") return; var b = String(r["MÃ VỊ TRÍ"] || "").toUpperCase(), g = r["GIÁ TRỊ"];
      if (g === "khong") S.boVt[b] = 1; else if (/^(SHOP|WH)$/.test(g)) S.khuBin[b] = g; });
  }
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
    /* 06/11 «Đổi tên»: tên hiển thị ở tab BAO-DUONG-DOI-TEN thắng TÊN VỊ TRÍ g-sheet (giữ tiền tố «Quạt hơi nước |» nếu có — trang chỉ hiện phần sau «|») */
    Object.keys(S.doiTen || {}).forEach(function (b) { var v = VT[b], r = S.doiTen[b]; if (!v || r["TRẠNG THÁI"] === "Lỗi" && !v.ten) return;
      var i = String(v.ten || "").lastIndexOf("|"); v.tenGs = v.ten; v.ten = (i >= 0 ? v.ten.slice(0, i + 1) : "") + r["TÊN MỚI"]; });
    /* 07/11 vị trí vừa thêm trên trang (chưa tới lượt sync-bao-duong chép g-sheet) — đầu việc chép theo vị trí mẫu */
    (S.themVt || []).forEach(function (r) {
      var b = String(r["MÃ VỊ TRÍ"] || "").toUpperCase(); if (!/^F0-/.test(b) || VT[b]) return;
      var mu = VT[String(r["VỊ TRÍ MẪU"] || "").toUpperCase()], dv = r._dv || {};
      VT[b] = { bin: b, ten: r["TÊN VỊ TRÍ"] || "", hm: r["HẠNG MỤC"], moi: true, nhom: mu ? mu.nhom : { "VẬN HÀNH": { ts: {}, pt: {} } },
        vh: mu ? mu.vh.slice() : [{ "NHÓM THỰC HIỆN": "VẬN HÀNH", "HẠNG MỤC": r["HẠNG MỤC"], "TẦN SUẤT": dv.ts || "", "HẠNG MỤC KIỂM TRA": dv.kt || "", "NỘI DUNG CÔNG VIỆC": dv.nd || "", "THỜI GIAN": dv.tg || "" }] };
      thuTu.push(b);
    });
    S.vt = VT; S.thuTu = thuTu; S.cum = CUM; S.tsYc = {};
    /* 06/11 khu SHOP / WH của vị trí = cột KHO tab yêu cầu (kho của lịch planogram, sync-bao-duong-yc) — dòng mới nhất thắng */
    S.khuBin = {}; S.yc.forEach(function (y) { var k = String(y["KHO"] || ""); if (k) S.khuBin[String(y["MÃ VỊ TRÍ"]).toUpperCase()] = k; });
    /* vị trí thêm trên trang chưa có lịch planogram ⇒ kho theo ô đã bấm «+ Thêm» */
    (S.themVt || []).forEach(function (r) { var b = String(r["MÃ VỊ TRÍ"] || "").toUpperCase(); if (b && !S.khuBin[b] && /^(SHOP|WH)$/.test(r["KHU"])) S.khuBin[b] = r["KHU"]; });
    apDungVt();
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
    return Promise.all([readTabP(TAB_DV), readTabP(TAB_YC), readTabP(TAB_KY), readTabP(TAB_GIAO), readTabP(TAB_LS), readTabP(TAB_NGAY), readTabP(TAB_TEN), readTabP(TAB_KHU), readTabP(TAB_THEM), readTabP(TAB_KHUNG)]).then(function (res) {
      var dv = bang(res[0]);
      S.ok = !!(dv && dv.length);
      S.loi = S.ok ? "" : (res[0] && res[0].code === 403 ? "khoa" : res[0] && res[0].status === "success" ? "trong" : "gas");
      S.dv = dv || []; S.yc = bang(res[1]) || []; S.ky = bang(res[2]) || [];
      S.giao = {}; (bang(res[3]) || []).forEach(function (g) { S.giao[g["KHOÁ"]] = g; });
      S.ls = bang(res[4]) || [];
      /* 06/11 cấu hình theo khu SHOP / WH (GAS bd_khu): khoá «LOẠI|KHU|HẠNG MỤC|MÃ VỊ TRÍ» */
      /* 07/11 vị trí thêm trên trang (nhật ký GAS bd_them_vt) — giữ dòng đang chờ máy chủ của lượt trước */
      var choThem = (S.themVt || []).filter(function (r) { return r["CHỜ"]; });
      S.themVt = (bang(res[8]) || []).concat(choThem);
      S.khung = bang(res[9]) || [];   // 07/11 hàng chờ thêm / bớt khung ảnh planogram
      S.cfg = {}; (bang(res[7]) || []).forEach(function (r) { if (r["KHOÁ"] && r["GIÁ TRỊ"]) S.cfg[r["KHOÁ"]] = r; });
      S.doiTen = {}; (bang(res[6]) || []).forEach(function (r) { var b = String(r["MÃ VỊ TRÍ"] || "").toUpperCase(); if (b && r["TÊN MỚI"]) S.doiTen[b] = r; });
      /* 31/10 bd-giao-ngay.mjs: việc Vận hành hôm nay giao task cho người CÓ CHẤM CÔNG trong g-sheet chia việc (chưa ai chấm công = chờ) */
      /* 07/11 user «tái hiện lại là hôm nay có việc để cải tiến — không có dữ liệu không cải tiến được»: bản thử (qc./localhost) hoặc ?ngay=YYYY-MM-DD
         mà hôm nay chưa có yêu cầu ⇒ «Việc hôm nay» dựng theo ngày gần nhất có yêu cầu (đầu khung ghi «Mô phỏng dd/mm»). Bản chính không đổi. */
      S.ngayGia = chonNgayGia();
      S.giaoNay = {}; (bang(res[5]) || []).forEach(function (r) { if (isoTuDmy(r["NGÀY"]) === ngayNay()) S.giaoNay[r["MÃ VỊ TRÍ"]] = r; });
      S.ts = Math.max(Number(res[1] && res[1].ts) || 0, Number(res[0] && res[0].ts) || 0);
      if (S.ok) dungViTri();
      ve();
      /* 05/11: chỉ định bằng MÃ NV hiện «NV 233135» tới khi danh bạ (anh-nv.js) về ⇒ về thì vẽ lại khung Việc hôm nay ra tên thật */
      if (window.hskAnhNV) window.hskAnhNV.san(function () { var k = $id("bdNay"); if (k && /NV \d{4,7}/.test(k.textContent)) veLaiNay(); });
    }).catch(function () { S.ok = false; S.loi = "gas"; ve(); })
      .finally(function () { var b = $id("bdReload"); if (b) b.disabled = false; });
  }

  /* ===== TIỆN ÍCH ===== */
  function isoVN(ms) { return new Date(ms + 7 * 3600e3).toISOString().slice(0, 10); }
  function ngayNay() { return S.ngayGia || isoVN(Date.now()); }
  /* 07/11 BẢN THỬ t3 «kính lúp» Lịch thực hiện — chỉ bật ở qc. / localhost hoặc ?kinhlup=1 (?kinhlup=0 tắt) tới khi user duyệt PDF */
  var KINH = !/[?&]kinhlup=0/.test(location.search);   // 07/11 user duyệt PDF kính lúp ⇒ bật bản chính
  function chonNgayGia() {
    var q = (location.search.match(/[?&]ngay=(\d{4}-\d\d-\d\d)/) || [])[1]; if (q) return q;
    if (!/^(qc\.|localhost|127\.)/.test(location.hostname)) return "";
    var hn = isoVN(Date.now()), max = "";
    S.yc.forEach(function (y) { var d = y["NGÀY"]; if (d === hn) max = "~"; else if (max !== "~" && d < hn && d > max) max = d; });
    return max === "~" ? "" : max;
  }
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
     khoảng ngày (29/10: bỏ bộ lọc ngày, lưới luôn đủ 60 ngày + thước thời gian); lưới trọn bề ngang, chi tiết mở ở THANH BÊN PHẢI khi trỏ ngày. */
  var THU = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  function thuCua(iso) { return THU[new Date(iso + "T00:00:00Z").getUTCDay()]; }
  function congNgay(iso, n) { return new Date(Date.parse(iso + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10); }
  function ngayDau() { return congNgay(isoVN(Date.now()), -(NGAY_DU_LIEU - 1)); }
  function khoangMacDinh() { return [ngayDau(), isoVN(Date.now())]; }
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
    /* KINH: hôm nay nằm TRONG dải (trái = quá khứ, phải = tương lai); kính lúp giữa dải phóng to ngày đang nằm dưới kính */
    var ngay = KINH ? qua.concat([homNay], toi) : qua.concat(toi), ranh = toi[0] || "";
    var lopCot = function (d) { return (d < homNay ? " qua" : "") + (d === ranh ? " ranh" : "") + (KINH && d === homNay ? " homnay" : ""); };
    var nhom = {}, thuTuHm = [];
    S.thuTu.forEach(function (b) { var hm = S.vt[b].hm; if (!nhom[hm]) { nhom[hm] = []; thuTuHm.push(hm); } nhom[hm].push(b); });
    /* đầu lưới 3 tầng: tháng (gộp cột) · ngày · thứ (CN tô đỏ); cột hôm nay gộp 3 tầng, ghim */
    var thang = [], dauThang = "";
    ngay.forEach(function (d) { var t = d.slice(0, 7); if (t !== dauThang) { thang.push({ t: t, n: 0, d: d }); dauThang = t; } thang[thang.length - 1].n++; });
    var dau = '<tr><th class="th-goc" rowspan="3"></th>' + (KINH ? "" : '<th class="th-nay" rowspan="3" title="Hôm nay ' + esc(dm(homNay)) + '"><span>Hôm nay</span><b>' + homNay.slice(8) + "</b><span>" + thuCua(homNay) + "</span></th>") +
        thang.map(function (x) { return '<th class="th-thang' + lopCot(x.d) + '" colspan="' + x.n + '">' + (x.n >= 3 ? "Tháng " + Number(x.t.slice(5)) : "") + "</th>"; }).join("") + "</tr>" +
      "<tr>" + ngay.map(function (d) { return '<th class="th-ngay' + lopCot(d) + '" data-ngay="' + d + '">' + d.slice(8) + "</th>"; }).join("") + "</tr>" +
      "<tr>" + ngay.map(function (d) { var t = thuCua(d); return '<th class="th-thu' + (t === "CN" ? " chunhat" : "") + lopCot(d) + '">' + t + "</th>"; }).join("") + "</tr>";
    var tong = 0, bc = 0, hang = "";
    /* lịch sử hư hỏng / sửa chữa… → chấm góc ô ngày (đỏ = có hư hỏng) */
    var lsTheo = {}; (S.ls || []).forEach(function (r) { if (r["TRẠNG THÁI"] === "Đã huỷ") return; var m = lsTheo[r["MÃ VỊ TRÍ"]] = lsTheo[r["MÃ VỊ TRÍ"]] || {}; (m[r["NGÀY"]] = m[r["NGÀY"]] || []).push(r); });
    var dem = function (ds, ks) { tong += ds.length + ks.length; bc += ds.filter(function (y) { return xong(Number(y["STATUS ID"])); }).length + ks.filter(function (k) { return lopKy(k) === "x"; }).length; };
    /* task [BD] của kỳ hiện tại + các kỳ sau (chưa có task) */
    var kyCuaO = function (b, d) { return (((S.kyNgay || {})[b] || {})[d] || []).concat(d > homNay ? ((S.kySau || {})[b] || {})[d] || [] : []); };
    /* gộp màu yêu cầu planogram (lớp tính sẵn) với task định kỳ: cùng xanh mới xanh · có cam = cam · còn chưa làm = viền đỏ · còn lại đỏ.
       Ngày TỚI chưa xong = «sắp tới» (viền đứt), không phải «chưa làm». */
    var gop = function (lYc, ks, d) { var a = (lYc ? [lYc] : []).concat(ks.map(lopKy)); if (!a.length) return "";
      var l = a.every(function (x) { return x === "x"; }) ? "x" : a.indexOf("d") >= 0 ? "d" : a.indexOf("m") >= 0 ? "m" : "b";
      return d > homNay ? "p" : l; };   // 02/11: kỳ SAU mượn trạng thái task kỳ hiện tại (Đang làm ⇒ ô cam ở 01/12, 01/01) — ngày tới luôn «sắp tới»
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
       29/10 user «các mục con mặc định ẩn — chỉ khi chọn mục cha hoặc ô ngang hàng mới hiện» ⇒ MỌI màn mặc định GẬP; bấm hàng mục cha (tên hoặc ô ngày) = mở/gập, nhớ theo hạng mục. */
    thuTuHm.forEach(function (hm) {
      var mo = !!S.moNhom[hm];
      hang += '<tr class="gd' + (mo ? " mo" : "") + (S.muiDoi === "l|" + hm ? " mui-cu" : "") + '" data-hmuc="' + esc(hm) + '" aria-expanded="' + mo + '">' +
        '<td class="vt"><div class="bd-gdv"><span class="bd-mui" aria-hidden="true"></span><span class="bd-ten">' + o(tHm(hm)) +
          "</span></div></td>" + (KINH ? "" : '<td class="nay">' + (mo ? "" : oGop(nhom[hm], homNay)) + "</td>") +
        ngay.map(function (d) { return '<td class="' + lopCot(d).trim() + '">' + (mo ? "" : oGop(nhom[hm], d)) + "</td>"; }).join("") + "</tr>";
      nhom[hm].forEach(function (b, i) {
        var tb = theoBin[b] || {}, coYc = Object.keys(tb).length > 0 || Object.keys((S.kyNgay || {})[b] || {}).length > 0;
        if (!mo) { qua.concat(homNay).forEach(function (d) { dem(tb[d] || [], kyCuaO(b, d)); }); return; }
        var v = S.vt[b], tenHang = String(v.ten || b).split("|").pop().trim() || v.ten || b;
        var oNgay = function (d) {
          var ds = tb[d] || [], ks = kyCuaO(b, d), l = gop(lopO(ds, d, homNay), ks, d); if (d <= homNay) dem(ds, ks);
          var ai = ds.map(function (y) { return y["NGƯỜI LÀM"]; }).filter(Boolean).join(", ");
          var coAnh = l === "x" && ds.some(function (y) { return y["ẢNH BÁO CÁO"]; });
          var lsd = (lsTheo[b] || {})[d] || [], lsT = lsd.map(function (r) { return r["LOẠI"] + ": " + r["MÔ TẢ"]; }).join(" · ");
          var lopLsO = lsd.length ? " co-ls" + (lsd.some(function (r) { return r["LOẠI"] === "Hư hỏng"; }) ? " ls-hh" : "") : "";
          return theO(l, coKy(ds, ks), { lop: (coAnh ? " co-anh" : "") + lopLsO, attr: ' data-ngay="' + d + '"' + (ks.length ? ' data-ky-task="' + ks.length + '"' : ""),
            tieu: thuCua(d) + " " + dm(d) + " · " + (l === "p" ? "Sắp tới" : CHU_O[l]) + (ai ? " · " + esc(ai) : "") + (coAnh ? " · có ảnh" : "") + (lsT ? " · " + esc(lsT) : "") });
        };
        hang += '<tr class="vtr con' + (i === nhom[hm].length - 1 ? " cuoi" : "") + (coYc ? "" : " trong") +
          '" data-bin="' + esc(b) + '" title="' + esc((v.ten || "") + " · " + b) + '"><td class="vt"><span class="bd-ten">' + o(tenHang) + "</span></td>" + (KINH ? "" : '<td class="nay">' + oNgay(homNay) + "</td>") +
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
      "</div>" +
      '<div class="bd-than"><div class="bd-chu" role="group" aria-label="Chú giải Lịch thực hiện">' + [["x", "Đã báo cáo", ""], ["d", "Đang làm", ""], ["m", "Chưa làm", "Hôm nay / còn hạn"],
          ["b", "Không làm", ""], ["co-ls ls-hh", "Hư hỏng", "Có hư hỏng · sửa chữa (chấm góc)"], ["p", "Sắp tới", ""], ["", "Không yêu cầu", "Không có yêu cầu"],
          ["x co-ky\" data-ky=\"3", "Định kỳ", "Số trong ô = 1 · 3 · 6 tháng/lần (T = hàng tuần)"]].map(function (c) {
            return '<span class="bd-chu-it"' + (c[2] ? ' title="' + c[2] + '"' : "") + '><i class="' + c[0] + '"></i>' + c[1] + "</span>"; }).join("") +
          '<span class="bd-chu-it" title="Tên vị trí màu xám = chưa có lịch planogram"><b class="bd-xam">Tên xám</b>Chưa có lịch</span></div>' +
      thuoc + (KINH ? '<div class="bd-hm-w">' : "") + '<div class="bd-hm' + (KINH ? " kl" : "") + '" data-khong-khoa><table><thead>' + dau + "</thead><tbody>" + hang + "</tbody></table></div>" +
      (KINH ? '<div class="bd-kinh" role="group" aria-label="Kính lúp ngày"><div class="bd-kinh-dau"></div><div class="bd-kinh-ds"></div></div></div>' : "") + "</div></div>";
  }
  /* sau mỗi lần vẽ lưới: đặt chỗ ghim cột hôm nay (= bề rộng cột tên), cuộn dải về NGÀY MAI (hoặc chỗ cũ khi chỉ gập/mở), nối thước ↔ cuộn */
  function ganThuoc() {
    var vc = PANE.querySelector("#bdLich .bd-hm"), goc = vc && vc.querySelector("th.th-goc"), nay = vc && vc.querySelector("th.th-nay"); if (!goc || (!nay && !KINH)) return;
    var sp = parseFloat(getComputedStyle(vc.querySelector("table")).borderSpacing) || 0;
    vc.style.setProperty("--bd-wvt", goc.offsetWidth + sp + "px");
    var ranh = vc.querySelector("thead th.th-ngay.ranh"), cot1 = vc.querySelector("thead th.th-ngay");
    /* toạ độ trong vùng cuộn (offsetLeft ở đây tính theo khung ngoài có position — không dùng được) */
    var xNoi = function (e) { return e.getBoundingClientRect().left - vc.getBoundingClientRect().left + vc.scrollLeft; };
    var tren = function () { return goc.offsetWidth + (nay ? nay.offsetWidth + 3 * sp : 2 * sp); };   // phần ghim bên trái
    /* KINH: tâm kính = giữa phần dải nhìn thấy; «Hôm nay» = đưa cột hôm nay vào giữa kính */
    var tamKinh = function () { return tren() + (vc.clientWidth - tren()) / 2; };
    var thNay = vc.querySelector("thead th.th-ngay.homnay");
    var veMai = KINH ? function () { return thNay ? xNoi(thNay) + thNay.offsetWidth / 2 - tamKinh() : 0; } : function () { return ranh ? xNoi(ranh) - tren() : vc.scrollWidth; };
    /* nhớ độ LỆCH so với «ngày mai» chứ không nhớ điểm ảnh: mở/gập mục cha làm cột tên rộng/hẹp ⇒ điểm ảnh cũ lệch ngày (29/10) */
    var mai0 = veMai(); vc.scrollLeft = mai0 + (S.cuonX || 0);
    if (KINH) ganKinh(vc, tamKinh, xNoi);
    var T = $id("bdThuoc"); if (!T) return;
    var ray = T.querySelector(".bd-thuoc-ray"), kh = T.querySelector(".bd-thuoc-khung");
    var x0 = cot1 ? xNoi(cot1) - sp : tren(), dai = function () { return Math.max(1, vc.scrollWidth - x0); };
    var capNhat = function () { var d = dai(), nhin = Math.max(0, vc.clientWidth - tren());
      kh.style.left = (100 * vc.scrollLeft / d).toFixed(2) + "%"; kh.style.width = Math.min(100, 100 * nhin / d).toFixed(2) + "%"; };
    var cho = 0; vc.addEventListener("scroll", function () { S.cuonX = vc.scrollLeft - mai0; if (!cho) cho = requestAnimationFrame(function () { cho = 0; capNhat(); }); }, { passive: true });
    var toi = function (e) { var r = ray.getBoundingClientRect(), f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); vc.scrollLeft = f * dai() - (vc.clientWidth - tren()) / 2; };
    /* 07/11 user «thanh tháng cuộn chậm lại để cột kính lúp cuộn đúng ngày cần»: kéo = dời theo ĐỘ KÉO × 0,3 (không nhảy theo vị trí con trỏ);
       dải bắt dính từng ngày nên kính dừng đúng ngày; bấm 1 chạm (không kéo) = nhảy tới chỗ bấm như cũ */
    var kt0 = null;
    ray.addEventListener("pointerdown", function (e) { ray.setPointerCapture(e.pointerId); ray.classList.add("keo"); MO_TIENG = true; kt0 = { x: e.clientX, s: vc.scrollLeft, di: false }; });
    ray.addEventListener("pointermove", function (e) { if (!kt0 || !ray.hasPointerCapture(e.pointerId)) return; var dx = e.clientX - kt0.x; if (Math.abs(dx) > 3) kt0.di = true;
      if (kt0.di) vc.scrollLeft = kt0.s + dx / ray.getBoundingClientRect().width * dai() * 0.3; });
    ray.addEventListener("pointerup", function (e) { ray.classList.remove("keo"); if (kt0 && !kt0.di) toi(e); kt0 = null; });
    ray.addEventListener("keydown", function (e) { var c = (cot1 ? cot1.offsetWidth + sp : 18); if (e.key === "ArrowLeft") { vc.scrollLeft -= c; e.preventDefault(); } if (e.key === "ArrowRight") { vc.scrollLeft += c; e.preventDefault(); } });
    T.querySelectorAll("[data-thuoc]").forEach(function (n) {
      n.addEventListener("click", function () { var k = Number(n.getAttribute("data-thuoc")), c = (cot1 ? cot1.offsetWidth + sp : 18);
        vc.scrollTo({ left: k ? vc.scrollLeft + k * c : veMai(), behavior: "smooth" }); });
    });
    capNhat();
  }

  /* 07/11 BẢN THỬ t3 — KÍNH LÚP: user «mục Hôm nay làm dạng kính lúp phóng to đúng vào ngày được kéo trúng vào cột kính lúp, bên trái các chấm
     lịch quá khứ, bên phải lịch tương lai». Kính đứng yên giữa dải; kéo dải (cuộn / thước / nút) ⇒ cột ngày dưới tâm kính hiện TO trong kính
     (đầu: Hôm nay · Đã qua · Sắp tới + ngày + thứ; mỗi hàng 1 ô to). Dải bắt dính (scroll-snap) để luôn có đúng 1 ngày nằm giữa kính.
     Bấm ô trong kính = bấm ô gốc (mở thanh bên vị trí / gập-mở mục cha). */
  /* tiếng «tách» kiểu bánh xe chọn giờ báo thức (iPhone · Đồng hồ): 1 xung rất ngắn qua WebAudio + rung 4 ms (Android). Chỉ kêu sau khi người
     dùng đã chạm / kéo / lăn vào khung (trình duyệt cấm phát tiếng trước lần tương tác đầu; mở trang không kêu). */
  var MO_TIENG = false, AM = null, BAT_TIENG = false;
  function tachKinh() {
    if (!MO_TIENG) return;
    try { if (navigator.vibrate) navigator.vibrate(4); } catch (e) {}
    if (!BAT_TIENG) return;   // 07/11 user «tắt âm thanh cuộn» — chỉ còn rung
    try { AM = AM || new (window.AudioContext || window.webkitAudioContext)(); if (AM.state === "suspended") AM.resume();
      var t = AM.currentTime, os = AM.createOscillator(), g = AM.createGain(), lo = AM.createBiquadFilter();
      os.type = "triangle"; os.frequency.setValueAtTime(2400, t); os.frequency.exponentialRampToValueAtTime(900, t + 0.018);
      lo.type = "highpass"; lo.frequency.value = 600;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      os.connect(lo); lo.connect(g); g.connect(AM.destination); os.start(t); os.stop(t + 0.035);
    } catch (e) {}
  }
  function ganKinh(vc, tamKinh, xNoi) {
    var w = vc.parentNode, K = w.querySelector(".bd-kinh"); if (!K) return;
    var dau = K.querySelector(".bd-kinh-dau"), ds = K.querySelector(".bd-kinh-ds"), ths = [].slice.call(vc.querySelectorAll("thead th.th-ngay"));
    var hang = [].slice.call(vc.querySelectorAll("tbody tr")), homNay = isoVN(Date.now()), thead = vc.querySelector("thead");
    var ve1 = function () {
      var c = vc.scrollLeft + tamKinh(), i = 0, kc = 1e9;
      ths.forEach(function (th, j) { var x = xNoi(th) + th.offsetWidth / 2, k = Math.abs(x - c); if (k < kc) { kc = k; i = j; } });
      var wr = w.getBoundingClientRect(), vr = vc.getBoundingClientRect();
      K.style.left = (vr.left - wr.left + tamKinh() - K.offsetWidth / 2) + "px"; K.style.height = (vc.clientHeight + 8) + "px"; K.style.top = (vr.top - wr.top - 8) + "px";   // nhô lên 8px: chữ «Hôm nay» không bị cắt
      if (K.__i === i) return; var dau0 = K.__i == null; K.__i = i;
      var d = ths[i] && ths[i].getAttribute("data-ngay"); if (!d) return;
      if (!dau0) { tachKinh(); K.classList.remove("lan"); void K.offsetWidth; K.classList.add("lan"); }   // mỗi ngày qua kính: «tách» + rung + số lăn vào
      K.classList.toggle("la-nay", d === homNay); K.classList.toggle("la-qua", d < homNay);
      dau.style.height = (thead.offsetHeight + 8) + "px";
      dau.innerHTML = "<span>" + (d === homNay ? "Hôm nay" : d < homNay ? "Đã qua" : "Sắp tới") + "</span><b>" + d.slice(8) + "</b><span>" + thuCua(d) + "</span>";
      ds.innerHTML = hang.map(function (tr, r) {
        var td = tr.children[1 + i], oc = td && td.querySelector(".bd-o"), rr = tr.getBoundingClientRect();
        return '<div class="bd-kinh-o' + (tr.classList.contains("gd") ? " gd" : "") + '" data-r="' + r + '" style="top:' + (rr.top - vr.top + 8) + "px;height:" + rr.height + 'px">' + (oc ? oc.outerHTML : "") + "</div>";
      }).join("");
    };
    var cho = 0; vc.addEventListener("scroll", function () { if (!cho) cho = requestAnimationFrame(function () { cho = 0; ve1(); }); }, { passive: true });
    /* 07/11 user «cảm ứng kéo qua lại phải nhạy CẢ KHUNG — không cần trỏ đúng cột kính lúp»: kính không chặn chạm (pointer-events:none) ⇒ vuốt
       ở bất kỳ đâu trên khung (kể cả đè lên kính) đều cuộn dải; chuột máy tính: nhấn-kéo ở bất kỳ đâu để cuộn. Bấm trong vùng kính = bấm đúng ngày dưới kính. */
    var keo = null;
    vc.addEventListener("pointerdown", function (e) { MO_TIENG = true; if (e.pointerType !== "mouse" || e.button !== 0) return;
      keo = { x: e.clientX, l: vc.scrollLeft, di: false, id: e.pointerId }; }, { passive: true });
    vc.addEventListener("pointermove", function (e) { if (!keo || e.pointerId !== keo.id) return; var dx = e.clientX - keo.x;
      if (!keo.di && Math.abs(dx) > 4) { keo.di = true; vc.classList.add("dang-keo"); try { vc.setPointerCapture(e.pointerId); } catch (er) {} }
      if (keo.di) vc.scrollLeft = keo.l - dx; });
    var tha = function () { if (!keo) return; var di = keo.di; keo = null; vc.classList.remove("dang-keo"); if (di) { vc.__vuaKeo = Date.now();
      var c = vc.scrollLeft + tamKinh(), tot = null; ths.forEach(function (th) { var x = xNoi(th) + th.offsetWidth / 2; if (!tot || Math.abs(x - c) < Math.abs(tot - c)) tot = x; });
      if (tot != null) vc.scrollTo({ left: vc.scrollLeft + (tot - c), behavior: "smooth" }); } };   // thả tay: hít chắc đúng 1 ngày giữa kính
    vc.addEventListener("pointerup", tha); vc.addEventListener("pointercancel", tha);
    vc.addEventListener("wheel", function () { MO_TIENG = true; }, { passive: true }); vc.addEventListener("touchstart", function () { MO_TIENG = true; }, { passive: true });
    vc.addEventListener("click", function (e) {
      if (vc.__vuaKeo && Date.now() - vc.__vuaKeo < 300) { e.stopPropagation(); e.preventDefault(); return; }   // vừa kéo thì không tính là bấm
      var kr = K.getBoundingClientRect(); if (e.clientX < kr.left || e.clientX > kr.right || e.target.closest("td.vt")) return;
      var tr = e.target.closest("tr"); if (!tr || !tr.parentNode || tr.parentNode.tagName !== "TBODY") return;
      var td = tr.children[1 + K.__i], oc = td && td.querySelector(".bd-o"); if (!oc || oc.contains(e.target)) return;
      e.stopPropagation(); e.preventDefault(); oc.click();
    }, true);
    ve1();
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
    if (S.chonKt === "0") ks = [];
    ks = ks.filter(function (k) { return nhomCua(k["NHÓM THỰC HIỆN"]) !== "CHƯA XÁC ĐỊNH"; });
    if (S.chonKt === "1") { ds = []; if (!ks.length) ks = S.ky.filter(function (k) { return k["MÃ VỊ TRÍ"] === b && k["KỲ HIỆN TẠI"] && nhomCua(k["NHÓM THỰC HIỆN"]) !== "VẬN HÀNH"; }).slice(0, 1); }
    /* task [BD] định kỳ bắt đầu kỳ ngày này (đã gom từ khung Việc theo kỳ cũ vào lưới) */
    var kyHtml = ks.map(function (k) { var l = lopKy(k), tid = /Đã xoá/.test(k["TRẠNG THÁI"]) ? "" : k["TASK ID"];   // task đã xoá: không link
      return '<div class="bd-ycdau">' + nhanNhom(k["NHÓM THỰC HIỆN"]) +
          (tid ? '<a href="https://work.hasaki.vn/tasks?task_id=' + encodeURIComponent(tid) + '" target="_blank" rel="noopener">Task ' + esc(tid) + " ↗</a>" : "") + "</div>" +
        dong("Trạng thái", badge(/Đã xoá/.test(k["TRẠNG THÁI"]) ? "Chưa có task" : (k["TRẠNG THÁI"] || CHU_O[l]), MAU_O[l] || "var(--muted)") + (k["HẠN"] ? ' <span class="hp-hint">hạn ' + esc(k["HẠN"]) + "</span>" : "")) +
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
          "") +   /* 07/11 tần suất đã ở chip cạnh Đóng — không lặp */
        (y["NGƯỜI LÀM"] ? dong(xong(st) ? "Người báo cáo" : st === 2 ? "Đang làm" : "Đã mở, chưa nộp", nguoiLam(y) +
          (y["LÚC LÀM"] ? ' <span class="hp-hint">lúc ' + esc(String(y["LÚC LÀM"]).slice(11, 16) + " " + dm(String(y["LÚC LÀM"]).slice(0, 10))) + "</span>" : "")) : "") +
        dong("Ảnh báo cáo (" + anh.length + "/" + kh.length + ")", '<div class="bd-anh-dau">' + (suaBen(b) && y["SCHEDULE ID"] ? butSua("khung", S.suaKhung === y["SCHEDULE ID"],
            "Sửa khung ảnh của lịch planogram " + y["SCHEDULE ID"], ' data-sid="' + esc(y["SCHEDULE ID"]) + '"') : "") +
          (thieu.length ? '<span class="hp-hint bd-motdong" title="Chưa có ảnh: ' + esc(thieu.join(" · ")) + '">Chưa có ảnh: ' + thieu.map(esc).join(" · ") + "</span>" : "") + "</div>" +
          (anh.length ? '<div class="hp-vtthumbs">' + anh.map(function (a, i) { return oAnh(y, a, i); }).join("") + "</div>" : "") + (S.suaKhung === y["SCHEDULE ID"] ? veSuaKhung(b, y, kh) : ""));
    }).join("");
  }
  /* thẻ ẨN/HIỆN có mũi tên — khuôn thư viện của thẻ «Tài sản tại vị trí» (Planogram: <details class="hp-vtcard hp-vtts">, ▾ bên phải xoay khi mở).
     28/10 user: «Làm gì» + «Báo cáo ở đâu» gập được trên web lẫn điện thoại; đầu thẻ vẫn đủ tóm tắt khi gập.
     28/10 lượt sau (user CHỐT): «2 mục này LUÔN ẨN» ⇒ mỗi lần vẽ đều gập (không nhớ trạng thái).
     28/10 chiều user ĐỔI: «ấn vào là hiển thị, không phải buộc ấn mũi tên» ⇒ bấm CẢ DÒNG đầu thẻ (summary gốc) mở/đóng; mũi tên chỉ là dấu hiệu. */
  /* 07/11 user «+/− ở Ảnh báo cáo: + thì thêm 1 mục cần chụp ảnh ở planogram (tên tiêu chuẩn + mô tả, như nút Add new standard); ✕ góc trên phải để bớt».
     Ghi hàng chờ GAS bd_khung → máy trạm (bd-khung-planogram.mjs, 5') sửa lịch planogram, đọc lại, báo kết quả. Lịch đã duyệt phải tick «Mở lại lịch». */
  var TT_KHUNG = { "Chờ": ["dang", "Chờ ghi planogram (≤5′)"], "Xong": ["xong", "Đã ghi planogram"], "Cần mở lại": ["cho", "Cần mở lại lịch"], "Lỗi": ["qua", "Lỗi"] };
  function tenKhungKe(kh) {
    var c = kh[kh.length - 1] || "", m = c.match(/^(.*?)(\d+)$/);
    if (m) { var n = String(Number(m[2]) + 1); while (n.length < m[2].length) n = "0" + n; return m[1] + n; }
    return c ? c + " 2" : "Trực diện";
  }
  function moTaKhung(b, ten) {
    var v = S.vt[b] || { vh: [] }, kt = [], nd = [], ts = [], tg = [];
    v.vh.forEach(function (r) { [[kt, "HẠNG MỤC KIỂM TRA"], [ts, "TẦN SUẤT"], [tg, "THỜI GIAN"]].forEach(function (x) { var t = String(r[x[1]] || "").trim(); if (t && x[0].indexOf(t) < 0) x[0].push(t); });
      String(r["NỘI DUNG CÔNG VIỆC"] || "").split("\n").forEach(function (t) { t = t.trim(); if (t && nd.indexOf(t) < 0) nd.push(t); }); });
    return "1. Hạng mục kiểm tra: " + (kt.join("; ") || ten) + "\n2. Nội dung công việc:\n" + (nd.length ? nd.map(function (t) { return "   · " + t; }).join("\n") : "   · ") +
      "\n3. Chu kỳ: " + (ts.join(" · ") || "Hàng ngày") + (tg.length ? " — thời gian " + tg.join("/") : "") +
      "\n4. Tiêu chuẩn báo cáo: Chụp ảnh trực diện " + ten + ", thấy rõ tình trạng thiết bị sau khi kiểm tra.";
  }
  function veSuaKhung(b, y, kh) {
    var sid = y["SCHEDULE ID"], cho = (S.khung || []).filter(function (r) { return r["SCHEDULE ID"] === sid && (r["TRẠNG THÁI"] !== "Xong" || String(r["LÚC XONG"] || r["LÚC"]).slice(0, 10) >= congNgay(isoVN(Date.now()), -1)); });
    var boCho = {}; cho.forEach(function (r) { if (r["LOẠI"] === "bot" && r["TRẠNG THÁI"] === "Chờ") boCho[r["TÊN"]] = 1; });
    var tenMoi = tenKhungKe(kh);
    return '<div class="bd-sk" data-sid="' + esc(sid) + '" data-bin="' + esc(b) + '"><div class="bd-sk-ds">' + kh.map(function (k) {
        return '<span class="bd-sk-it' + (boCho[k] ? " bo" : "") + '">' + esc(k) +
          (boCho[k] ? "" : '<button type="button" class="bd-lk bd-sk-x" data-ten="' + esc(k) + '" title="Bớt khung «' + esc(k) + '»" aria-label="Bớt khung ' + esc(k) + '">' + SVG_X_N + "</button>") + "</span>"; }).join("") +
        '<button type="button" class="bd-lk bd-sk-cong" title="Thêm khung ảnh" aria-label="Thêm khung ảnh"' + (S.themKhung ? ' aria-pressed="true"' : "") + ">" + SVG_CONG + "</button></div>" +
      (S.themKhung ? '<div class="bd-sk-form"><label class="bd-ls-o"><span>Tên tiêu chuẩn <b class="bd-do">*</b></span><input type="text" class="bd-sk-ten" maxlength="120" value="' + esc(tenMoi) + '"></label>' +
        '<label class="bd-ls-o"><span>Mô tả</span><textarea class="bd-sk-mt" rows="6" maxlength="1500">' + esc(moTaKhung(b, tenMoi)) + "</textarea></label>" +
        '<label class="bd-sk-ml"><input type="checkbox" class="bd-sk-molai"> Mở lại lịch nếu lịch đã duyệt <span class="hp-hint">(lịch về Nháp, ngừng phát yêu cầu tới khi Phê duyệt lại trên planogram)</span></label>' +
        '<div class="bd-ls-hang"><button type="button" class="hsk-nut chinh nho bd-sk-luu">Lưu</button><button type="button" class="hsk-nut phu nho bd-sk-bo">Huỷ</button><span class="bd-dl bd-sk-bao"></span></div></div>' : "") +
      (cho.length ? '<div class="bd-sk-cho">' + cho.slice(-6).reverse().map(function (r) { var t = TT_KHUNG[r["TRẠNG THÁI"]] || ["luu", r["TRẠNG THÁI"]];
        return '<div><span class="hsk-chip ' + t[0] + ' khongcham">' + t[1] + "</span> " + (r["LOẠI"] === "bot" ? "Bớt" : "Thêm") + " «" + esc(r["TÊN"]) + "»" +
          (r["KẾT QUẢ"] ? ' <span class="hp-hint">' + esc(r["KẾT QUẢ"]) + "</span>" : "") + "</div>"; }).join("") + "</div>" : "") + "</div>";
  }
  function guiKhung(nut, op, ten, moTa, moLai) {
    var k = nut.closest(".bd-sk"), sid = k.getAttribute("data-sid"), b = k.getAttribute("data-bin");
    var dong = { "ID": "tam" + Date.now(), "SCHEDULE ID": sid, "MÃ VỊ TRÍ": b, "LOẠI": op, "TÊN": ten, "TRẠNG THÁI": "Chờ", "LÚC": isoVN(Date.now()) };
    S.khung.push(dong); if (op === "them") S.themKhung = false; veLaiBen();
    fetch(APPSCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "bd_khung", op: op, phien: phien(), sid: sid, bin: b, ten: ten, moTa: moTa || "", moLai: !!moLai }), redirect: "follow" })
      .then(function (r) { return r.json(); }).then(function (j) { if (!j || j.status !== "success") throw new Error((j && j.message) || "máy chủ không trả lời");
        if (j.dong) dong["ID"] = j.dong[0];
        if (window.hskTienIch && window.hskTienIch.toast) window.hskTienIch.toast((op === "them" ? "Đã gửi thêm khung «" : "Đã gửi bớt khung «") + ten + "» — máy ghi planogram trong ≤5 phút", "ok"); })
      .catch(function (e) { S.khung = S.khung.filter(function (x) { return x !== dong; }); veLaiBen();
        if (window.hskTienIch && window.hskTienIch.toast) window.hskTienIch.toast("Chưa gửi được: " + e.message, "loi"); });
  }
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
      ? '<div class="who"><span class="av av-chi-anh" data-anh-nv="' + esc(String(gan["TÊN NGƯỜI LÀM"] || "").split(" · ")[0]) + '" data-anh-em="' + esc(gan["NGƯỜI LÀM"]) + '"></span>' +
        "<div><b>" + o(gan["NGƯỜI LÀM"]) + "</b></div></div>" + '<div class="ln"><b>' + thuCua(gan["NGÀY"]) + " " + dm(gan["NGÀY"]) + "</b>" +
        (gan["LÚC LÀM"] ? " lúc <b>" + esc(String(gan["LÚC LÀM"]).slice(11, 16)) + "</b>" : "") + ' <span class="hp-hint">· ' + (tuoi > 0 ? tuoi + " ngày trước" : "hôm nay") + "</span></div>"
      : '<div class="ln mut">chưa ai báo cáo vị trí này trong ' + NGAY_DU_LIEU + " ngày</div>") + "</div>";
    var ts = window.HPLANOGRAM && window.HPLANOGRAM.theTaiSan ? window.HPLANOGRAM.theTaiSan(b) : "";
    /* 07/11 user: «Tên hiển thị · Lịch sử · Làm gì · Báo cáo ở đâu · Tài sản — hiển thị dạng nút chip đối xứng 2 bên» ⇒ lưới 2 cột chip
       (tên + tóm tắt 1 dòng); bấm chip = mở phần thân ngay dưới lưới, bấm lại = đóng; mỗi lúc 1 chip. */
    if (S.chonKt === "1") dsTs = [];   // mục con KT: không hiện «Làm gì» Vận hành
    var muc = [], tenM = mucTen(b); if (tenM) muc.push(tenM);
    muc.push({ k: "ls", n: "Lịch sử sửa chữa", t: lsCua(b).length ? lsCua(b).length + " mục" : "chưa có", than: theLichSu(b) });
    dsTs.forEach(function (t0) { var rs = Object.keys(gom[t0]).map(function (k) { return gom[t0][k]; });
      muc.push({ k: "lam|" + t0, n: "Làm gì · " + esc(t0), t: rs.length + " việc" + (phut(rs) ? " · ~" + phut(rs) + "′" : ""), than: '<ol class="bd-buoc">' + rs.map(function (r) {
        return "<li><b>" + o(r["HẠNG MỤC KIỂM TRA"]) + "</b>" + (r["THỜI GIAN"] ? ' <span class="bd-phu-n">· ' + o(r["THỜI GIAN"]) + "</span>" : "") + '<span class="bd-nd">' + o(r["NỘI DUNG CÔNG VIỆC"]) + "</span></li>"; }).join("") + "</ol>" }); });
    if (v.vh.length && S.chonKt !== "1") muc.push({ k: "duong", n: "Báo cáo ở đâu", t: "App Hasaki WMS", than: duong.replace(/^[\s\S]*?<\/summary>/, "").replace(/<\/details>$/, "") });
    if (ts) { var tam = document.createElement("div"); tam.innerHTML = ts; var su = tam.querySelector("summary"), tt0 = su ? su.textContent.replace(/\s+/g, " ").replace(/^\s*Tài sản tại vị trí\s*/, "").replace(/▾/g, "").trim() : "";
      if (su) su.remove(); var dt0 = tam.querySelector("details"); if (dt0) dt0.setAttribute("open", "");
      muc.push({ k: "ts", n: "Tài sản tại vị trí", t: ((su && su.querySelector(".hp-vttsn")) || { textContent: tt0 }).textContent.trim(), than: tam.innerHTML }); }
    var mo = S.moTen === b ? "ten" : S.chipMo; if (!muc.some(function (m) { return m.k === mo; })) mo = "";
    /* 07/11 user «tuần ngày tháng bên phải, các mục còn lại đối xứng bên trái» */
    var coLam = muc.some(function (m) { return /^lam\|/.test(m.k); });
    var chips = '<div class="bd-chips' + (coLam ? " hai-ben" : "") + '" role="group" aria-label="Thông tin vị trí">' + muc.map(function (m) {
      return '<button type="button" class="bd-lk bd-chip' + (/^lam\|/.test(m.k) ? " phai" : "") + (m.k === mo ? " mo" : "") + '" data-chip="' + esc(m.k) + '" aria-expanded="' + (m.k === mo) + '"><span class="bd-chip-n">' + m.n +
        '</span><span class="bd-chip-t">' + m.t + '</span><i class="bd-chip-mui" aria-hidden="true"></i></button>'; }).join("") + "</div>" +
      (mo ? '<div class="bd-chip-than" data-chip-than="' + esc(mo) + '">' + muc.filter(function (m) { return m.k === mo; })[0].than + "</div>" : "");
    return '<div class="bd-ben">' + veDai(b, d) + veNgay(b, v, d) + '<div class="hp-vtduo">' + vePhanCong(b) + cardBc + "</div>" + chips + "</div>";
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
    return '<button type="button" class="bd-lk bd-doi bd-doi-ic" aria-expanded="false" title="Đổi người phụ trách" aria-label="Đổi người phụ trách">' + SVG_DOI_N + "</button>" +
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
    var v = S.vt[b], ds = Object.keys(v.nhom).sort(function (a, c) { return THU_NHOM.indexOf(a) - THU_NHOM.indexOf(c); })
      .filter(function (nh) { return nh !== "CHƯA XÁC ĐỊNH" && (S.chonKt === "0" ? nh === "VẬN HÀNH" : S.chonKt === "1" ? nh !== "VẬN HÀNH" : true); });   // 07/11 bỏ nhóm chưa xác định
    if (!ds.length) return "";
    return '<div class="hp-vtcard pt bd-pc"><div class="hd">Phụ trách</div>' + ds.map(function (nhom) {
      var n = v.nhom[nhom], k = kyCua(b, nhom)[0], ng = nguoiVt(b, nhom);
      /* 07/11: Vận hành có việc hôm nay ⇒ thanh bên hiện ĐÚNG người như mục con (đổi «chỉ hôm nay», phụ trách cả ô, chỉ định) — không lệch phân công gốc */
      if (nhom === "VẬN HÀNH") { var tn0 = (duLieuNay().the.filter(function (t) { return t.b === b && !t.kt; })[0]); if (tn0) ng = { ten: tn0.ng.map(function (x) { return x.ten; }).join(", "), nguon: "" }; }
      var gn = nhom === "VẬN HÀNH" ? S.giaoNay[b] : null;   // 31/10: task hôm nay (bd-giao-ngay) hoặc chữ đỏ khi chưa ai trong ô chấm công
      var nay = !gn ? "" : gn["TASK ID"] ? '<span class="bd-phu"><a href="https://work.hasaki.vn/tasks?task_id=' + encodeURIComponent(gn["TASK ID"]) + '" target="_blank" rel="noopener">Task hôm nay ↗</a></span>'
        : /^(Chờ người có chấm công|Không ai trong ca)$/.test(gn["TRẠNG THÁI"]) ? '<span class="bd-phu bd-do">' + esc(gn["TRẠNG THÁI"]) + "</span>" : "";
      var khi = '<span class="bd-pc-khi">' + nay +   /* 07/11 user: tần suất đã lên chip cạnh Đóng — không lặp ở đây */ (k ? '<span class="bd-phu">kỳ tới ' + esc(k["KỲ TỚI"] || "—") + "</span>" +
          (k["TASK ID"] && !/Đã xoá/.test(k["TRẠNG THÁI"]) ?
            '<span class="bd-phu"><a href="https://work.hasaki.vn/tasks?task_id=' + encodeURIComponent(k["TASK ID"]) + '" target="_blank" rel="noopener">Task ' + esc(k["TASK ID"]) + " ↗</a></span>" : "") : "") + "</span>";
      /* 07/11 user «các mục này ngoài mục con bố trí thế nào mà thanh bên hiện như vậy»: cùng khuôn mục con — người = ảnh (VH tròn · KT vuông) + tên,
         chưa giao = hình người nét đứt đỏ; «Đổi» = icon đổi người như ngoài mục con; không xuống dòng */
      var kt = nhom !== "VẬN HÀNH", ten = ng.ten ? String(ng.ten).split(/\s*[\/,;]\s*/).filter(Boolean) : [];
      var ai = ten.length ? ten.map(function (t) { var tn = tenNV(t); return '<span class="bd-pc-ng' + (kt ? " vuong" : "") + '" title="' + esc(tn) + '">' + avatar(tn) + '<span class="bd-pc-tn">' +
          o(String(tn).split(" ").slice(-2).join(" ")) + "</span></span>"; }).join("")
        : '<span class="bd-pc-ng chua' + (kt ? " vuong" : "") + '"><span class="bd-av bd-av-chua">' + SVG_NG_N + '</span><span class="bd-pc-tn bd-do">Chưa giao người</span></span>';
      return '<div class="bd-pc-dong"><div class="bd-pc-dau">' + nhanNhom(nhom) + khi + '</div><div class="bd-pc-ai"><div class="bd-pc-than">' + ai +
        "</div>" + (!suaBen(b) ? "" : '<button type="button" class="bd-lk bd-doi1 bd-doi-ic" data-bin="' + esc(b) + '" data-nhom="' + esc(nhom) +
          '" title="Đổi người phụ trách" aria-label="Đổi người phụ trách">' + SVG_DOI_N + "</button>") + "</div></div>";
    }).join("") + "</div>";
  }

  /* ===== ⓪ VIỆC HÔM NAY =====
     05/11 user (duyệt bản mẫu PDF «Ban mau Viec hom nay 05-11-2026»): «gọn gàng, biết việc theo NGƯỜI (người có đi làm không) — đã log task chưa»,
     «cần mục đổi người (cả task đã giao và không giao) nếu chưa có ai / chưa phân công». Bố cục:
       đầu khung «Việc hôm nay x/y» · Segmented Theo người | Theo hạng mục · Bộ lọc; 1 dòng tóm tắt (đi làm · chưa chấm công · chưa giao người · task work);
       Theo người: 1 hàng / người (Đi làm = giờ vào / Chưa chấm công · Việc gom theo hạng mục · Đã báo cáo x/y · Đã log task khi hôm nay có task),
       bấm hàng → danh sách vị trí của người đó (gom hạng mục) với ô chọn + «Đổi người» / «Phân công»; chọn nhiều → «Đổi người n vị trí».
       Hộp đổi người: người đang đi làm hôm nay (ít việc trước) + ô tìm tên / mã NV; Áp dụng Chỉ hôm nay (khoá …|ngày) | Từ nay về sau (chỉ định cũ).
       Lưu → GAS bd_giao; bd-giao-ngay.mjs giao task / CHUYỂN người nhận task con đã giao ở lượt kế.
     Task định kỳ «Đã xoá — chờ thiết kế lại» không còn tính là việc hôm nay. Theo hạng mục = danh sách tích B4 (29/10) trải rộng. */
  var CHIP_O = { m: ["cho", "Chưa làm"], b: ["qua", "Quá hạn"], d: ["dang", "Đang làm"], x: ["xong", "Đã báo cáo"] };
  var CHUA_GIAO = "Chưa giao người";
  /* 06/11 cấu hình theo khu (tab BAO-DUONG-KHU, GAS bd_khu) — khoá «LOẠI|KHU|HẠNG MỤC|MÃ VỊ TRÍ», hạng mục chuẩn hoá như GAS (khoảng trắng gộp, «|» → «/») */
  var KHU_DS = [["SHOP", "SHOP – 170 QUOC LO 1A"], ["WH", "WH – 170 QUOC LO 1A"]];
  function hmCfg(hm) { return String(hm || "").replace(/\|/g, "/").replace(/\s+/g, " ").trim().slice(0, 80); }
  function khoaCfg(loai, khu, hm, bin) { return [loai, khu || "", hmCfg(hm), loai === "hm" || loai === "pt" ? "" : String(bin || "").toUpperCase()].join("|"); }
  function cfgGt(loai, khu, hm, bin) { var x = S.cfg[khoaCfg(loai, khu, hm, bin)]; return x ? String(x["GIÁ TRỊ"] || "") : ""; }
  function tachDs(s) { return String(s || "").split(/\s*[,\/;]\s*/).filter(Boolean); }
  function tenNV(x) { var d = /^\d{4,7}$/.test(x) && window.hskAnhNV ? window.hskAnhNV.theoMa(x) : null; return d ? d.ten : /^\d{4,7}$/.test(x) ? "NV " + x : x; }
  /* quản lý: vị trí › hạng mục trong khu › khu (cấp gần nhất thắng) */
  function qlCua(khu, hm, bin) {
    var c = [["vị trí", bin ? cfgGt("ql", khu, hm, bin) : ""], ["hạng mục", hm ? cfgGt("ql", khu, hm) : ""], ["kho", cfgGt("ql", khu)]].filter(function (x) { return x[1]; })[0];
    return c ? { cap: c[0], ds: tachDs(c[1]) } : { cap: "", ds: [] };
  }
  /* vòng đại diện: ảnh NV nếu có, không thì chữ cái cuối tên */
  function avatar(ten) {   // 05/11: ảnh do anh-nv.js (khuôn chung toàn dự án) tự gắn vào [data-anh-nv]; chưa có ảnh = chữ cái cuối tên
    /* 06/11 lượt 10 user «nhấn mục cha A mà các mục khác cũng rung rinh»: vẽ lại khung ⇒ mọi vòng ảnh trống 1 khung hình rồi mới gắn ảnh (nhấp nháy).
       Danh bạ ảnh đã về ⇒ vẽ THẲNG <img> + data-anh-xong (anh-nv.js bỏ qua), không qua vòng trống. */
    var a = window.hskAnhNV && window.hskAnhNV.lay ? window.hskAnhNV.lay(ten) : "";
    if (a) return '<span class="bd-av co-anh" data-anh-nv="' + esc(ten) + '" data-anh-xong="1" aria-hidden="true"><img src="' + esc(a) + '" alt="" decoding="async"></span>';
    return '<span class="bd-av" data-anh-nv="' + esc(ten) + '" aria-hidden="true">' + esc(String(ten).split(" ").pop().charAt(0)) + "</span>"; }
  /* 07/11 user «mục con hiển thị nhãn Ngày / Tuần / Tháng / 3 tháng / 6 tháng» — tần suất của yêu cầu (khung khớp dòng định kỳ g-sheet), không khớp = Ngày */
  function nhanKy(ts) { if (/NĂM/.test(chuan(ts))) return "Năm"; var k = kyHieu(ts); return !k ? "Ngày" : k === "T" ? "Tuần" : k === "1" ? "Tháng" : k + " tháng"; }
  /* 07/11 user «dấu + to / thô / xấu»: icon cộng nét mảnh như icon thư viện (cùng khuôn nét 1.6 của icon đổi người / bút) */
  var SVG_DOI_N = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M7 4 3 8l4 4"/><path d="M3 8h13a4 4 0 0 1 0 8h-2"/><path d="m17 20 4-4-4-4"/><path d="M21 16H8"/></svg>';
  var SVG_NG_N = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>';
  var SVG_CK = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M3 10 12 4l9 6v10H3z"/><path d="M9 15h7"/><path d="m13 12 3 3-3 3"/></svg>';   // nhà kho + mũi tên = chuyển kho
  var SVG_BUT_N = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m14 6 4 4"/></svg>';
  var SVG_X_N = '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  /* nút bút sửa nhỏ: bật / tắt chế độ sửa (bên trong mới có + thêm / ✕ bớt) */
  function butSua(act, mo, nhan, them) { return '<button type="button" class="bd-lk bd-ka bd-but-sua' + (mo ? " mo" : "") + '" data-act="' + act + '"' + (them || "") +
    ' aria-pressed="' + !!mo + '" title="' + esc(nhan) + '" aria-label="' + esc(nhan) + '">' + SVG_BUT_N + "</button>"; }
  var SVG_CONG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  /* 07/11 user đổi tên hiển thị 4 hạng mục («đổi tên ở những nơi tụi nó hiển thị»). Chỉ đổi CHỮ HIỆN — tên gốc g-sheet vẫn là khoá dữ liệu
     (phân công BAO-DUONG-GIAO, cấu hình kho BAO-DUONG-KHU, task kỳ…), đổi khoá là mất phân công cũ. */
  var TEN_HM = { "Đèn LED Nhà Xưởng": "Đèn Chiếu Sáng", "Xe Nâng Nichiyu FBR18": "Xe Nâng Điện", "Máy Cắt Xốp EVA": "Máy Cắt Xốp", "Quạt Làm Mát Hơi Nước": "Quạt Hơi Nước" };
  function tHm(s) { var k = String(s == null ? "" : s).replace(/\s+/g, " ").trim(); return TEN_HM[k] || s; }
  /* 07/11 user «TẤT CẢ chỉnh sửa, đổi người, đổi kho, đổi tên vị trí, thêm ảnh, xoá mục con, xoá người, thêm tiêu chuẩn — CHỈ hiện icon khi nhấn
     bút sau tên kho; không nhấn thì không hiện» ⇒ thanh bên dùng cờ này thay cho duocSua() */
  function suaBen(b) { return duocSua() && !!(S.suaKho || {})[S.khuBin[b]]; }
  function khoaNay(b) { return khoaGiao(b, "VẬN HÀNH") + "|" + ngayNay(); }
  /* ứng viên «Tên · vào 06:56 / Tên · chưa chấm công / x · không tra được» (bd-giao-ngay) → [{ten, vao}] — vao: "06:56" · "" chưa chấm công · null không rõ */
  function khongGach(x) { return !!x && !/^[-–—]+$/.test(String(x).trim()); }   // 06/11: chỉ định «-» = không ai
  function tachUngVien(s) {
    return String(s || "").split(" / ").map(function (x) { var p = x.split(" · "), ten = (p[0] || "").trim(), c = p[1] || "", m = c.match(/vào (\d\d:\d\d)/);
      return ten ? { ten: ten, vao: m ? m[1] : /chưa chấm công/.test(c) ? "" : null } : null; }).filter(Boolean);
  }
  function duLieuNay() {
    var homNay = ngayNay(), theoBin = {}, the = [], vao = {};
    Object.keys(S.giaoNay).forEach(function (b) { tachUngVien(S.giaoNay[b]["ỨNG VIÊN (CHẤM CÔNG)"]).forEach(function (n) { if (n.vao != null && !(chuan(n.ten) in vao)) vao[chuan(n.ten)] = n.vao; }); });
    var tenVao = function (t) { var k = chuan(t); var dm = /^\d{4,7}$/.test(t) && window.hskAnhNV ? window.hskAnhNV.theoMa(t) : null; if (dm) { t = dm.ten; k = chuan(t); }
      return { ten: /^\d{4,7}$/.test(t) ? "NV " + t : t, vao: k in vao ? vao[k] : null }; };   // chỉ định bằng mã: hiện «NV 233135» tới lượt máy kế (ra tên)
    S.yc.forEach(function (y) { if (y["NGÀY"] === homNay && S.vt[y["MÃ VỊ TRÍ"]] && !(S.boVt || {})[y["MÃ VỊ TRÍ"]]) (theoBin[y["MÃ VỊ TRÍ"]] = theoBin[y["MÃ VỊ TRÍ"]] || []).push(y); });
    Object.keys(theoBin).forEach(function (b) {
      var ds = theoBin[b], v = S.vt[b], kh = 0, co = 0;
      ds.forEach(function (y) { var k = String(y["KHUNG ẢNH"] || "").split("|").filter(function (x) { return x.trim(); }).length; kh += k; co += Math.min(anhCua(y).length, k); });
      var gn = S.giaoNay[b] || {}, dn = S.giao[khoaNay(b)], ng;
      /* vừa đổi trên trang (máy chưa chạy lượt kế) ⇒ lấy tên chỉ định, giờ vào tra từ ứng viên các vị trí khác */
      if (dn && dn["CHẾ ĐỘ"] === "chi-dinh" && gn["NGUỒN"] !== "Đổi hôm nay") ng = String(dn["CHỈ ĐỊNH"]).split(/\s*[,\/]\s*/).filter(khongGach).map(tenVao);
      else ng = gn["NGUỒN"] === "" ? [] : tachUngVien(gn["ỨNG VIÊN (CHẤM CÔNG)"]);   // NGUỒN "" = vừa lưu trên trang ⇒ đọc chỉ định / g-sheet
      /* 06/11 phụ trách CẢ Ô hạng mục × khu (gom) thắng g-sheet; chỉ định riêng vị trí (hôm nay / lâu dài) vẫn thắng ô */
      var ptO = cfgGt("pt", S.khuBin[b], v.hm), gl = S.giao[khoaGiao(b, "VẬN HÀNH")];
      if (ptO && !(dn && dn["CHẾ ĐỘ"] === "chi-dinh") && !(gl && gl["CHẾ ĐỘ"] === "chi-dinh")) ng = tachDs(ptO).map(tenVao);
      /* 06/11 lượt 10: chỉ định «-» (hộp Đổi người bỏ hết người) = KHÔNG AI ⇒ «Chưa giao người», không rơi về g-sheet */
      var cdNay = dn && dn["CHẾ ĐỘ"] === "chi-dinh" ? dn : gl && gl["CHẾ ĐỘ"] === "chi-dinh" ? gl : null;
      var khongAi = !!(cdNay && !String(cdNay["CHỈ ĐỊNH"]).split(/\s*[,\/]\s*/).filter(khongGach).length);
      if (khongAi) ng = [];
      if (!ng.length && !khongAi) { var nv = nguoiVt(b, "VẬN HÀNH"); ng = nv.ten ? String(nv.ten).split(/\s*[\/,;]\s*/).filter(khongGach).map(tenVao) : []; }
      var st = Math.max.apply(null, ds.map(function (y) { return Number(y["STATUS ID"]) || 0; }));
      the.push({ b: b, khu: S.khuBin[b] || "", l: lopO(ds, homNay, homNay), hm: v.hm, ts: tsCuaYc(ds[0]), ten: String(v.ten || b).split("|").pop().trim() || b, ng: ng, kh: kh, co: co, doi: true,
        st: st, nyc: ds.length, gan: !!String(gn["TASK CON"] || gn["TASK CHUNG"] || "").replace(/^'/, "").trim() });   // nyc = số yêu cầu planogram hôm nay (06/11 số trên ảnh)
    });
    /* task [BD] định kỳ đang trong kỳ, chưa xong — 1 dòng / nhóm việc (bỏ «Đã xoá — chờ thiết kế lại») */
    var kyMo = {}, thuKy = [];
    S.ky.forEach(function (k) { if (!k["KỲ HIỆN TẠI"] || /Hoàn thành|Chưa tới|chưa hỗ trợ/.test(k["TRẠNG THÁI"])) return;
      var kh = k["KHOÁ NHÓM"]; if (!kyMo[kh]) { kyMo[kh] = []; thuKy.push(kh); } kyMo[kh].push(k); });
    /* 07/11 user «tách VH và KT bảo trì ra 2 yêu cầu riêng, không gộp chung — có KT bảo trì thì thêm 1 mục con tương tự; chưa giao ai thì như luật VH»
       ⇒ mỗi VỊ TRÍ của task kỳ = 1 mục con riêng (kt: true — ảnh VUÔNG), không còn 1 dòng «Nhóm · n vị trí» */
    thuKy.forEach(function (kh) {
      kyMo[kh].forEach(function (k) { var b = k["MÃ VỊ TRÍ"], v = S.vt[b]; if (!v || nhomCua(k["NHÓM THỰC HIỆN"]) === "CHƯA XÁC ĐỊNH" || (/Đã xoá/.test(k["TRẠNG THÁI"]) && !S.khuBin[b])) return;
        the.push({ b: b, khu: S.khuBin[b] || "", l: lopKy(k), hm: k["HẠNG MỤC"] || v.hm, ten: String(v.ten || b).split("|").pop().trim() || b, kt: true,
          nhom: (NHOM[nhomCua(k["NHÓM THỰC HIỆN"])] || [k["NHÓM THỰC HIỆN"]])[0],
          ng: String(k["NGƯỜI NHẬN"] || "").split(/\s*,\s*/).map(function (t) { return t.replace(/\s*\(\d+\)\s*$/, "").trim(); }).filter(Boolean).map(tenVao),
          han: k["HẠN"], d: isoTuDmy(k["KỲ HIỆN TẠI"]), ky: /Đã xoá/.test(k["TRẠNG THÁI"]) ? "" : k["TASK ID"], ts: k["TẦN SUẤT"] }); });
    /* 07/11: việc bảo trì theo KẾ HOẠCH vẫn là mục con KT dù task kỳ đã xoá (03/11 ngưng tạo task) — chỉ không gắn link task; nhóm «Chưa xác định» không phải việc; vị trí chưa có lịch planogram (chưa rõ kho) thì không hiện kế hoạch đã xoá task */
    });
    /* task work hôm nay theo người nhận (tab BAO-DUONG-NGAY: NGƯỜI NHẬN «Tên (mã)», TASK CHUNG/CON «mã#id») */
    var task = {};
    Object.keys(S.giaoNay).forEach(function (b) {
      var r = S.giaoNay[b], tenMa = {}, xg = /Hoàn thành|Đã nộp/.test(r["TRẠNG THÁI"]);
      String(r["NGƯỜI NHẬN"] || "").split(/\s*,\s*/).forEach(function (x) { var m = x.match(/^(.*?)\s*\((\d+)\)$/); if (m) tenMa[m[2]] = m[1]; });
      var cua = function (ma) { var k = chuan(tenMa[ma]); return (task[k] = task[k] || { cha: "", n: 0, x: 0 }); };
      String(r["TASK CHUNG"] || "").replace(/^'/, "").split(/\s*,\s*/).forEach(function (x) { var m = x.match(/^(\d+)#(\d+)$/); if (m && tenMa[m[1]]) cua(m[1]).cha = m[2]; });
      String(r["TASK CON"] || "").replace(/^'/, "").split(/\s*,\s*/).forEach(function (x) { var m = x.match(/^(\d+)#(\d+)$/); if (!m || !tenMa[m[1]]) return; var t = cua(m[1]); t.n++; if (xg) t.x++; });
    });
    /* gom theo người (vị trí 2 người cùng làm ⇒ hiện ở cả hai) */
    var ngMap = {};
    the.forEach(function (t) { (t.ng.length ? t.ng : [{ ten: CHUA_GIAO, vao: null }]).forEach(function (n) {
      var k = chuan(n.ten), p = ngMap[k] = ngMap[k] || { ten: n.ten, vao: n.vao, viec: [], thieu: n.ten === CHUA_GIAO }; if (p.vao == null && n.vao != null) p.vao = n.vao; p.viec.push(t); }); });
    Object.keys(task).forEach(function (k) { if (ngMap[k]) ngMap[k].task = task[k]; });
    var dsNg = Object.keys(ngMap).map(function (k) { return ngMap[k]; }).sort(function (a, c) { return a.thieu - c.thieu || c.viec.length - a.viec.length || a.ten.localeCompare(c.ten, "vi"); });
    return { the: the, dsNg: dsNg, vao: vao, coTask: Object.keys(task).length > 0 };
  }

  /* người có cùng bộ việc hôm nay ⇒ 1 nhóm (giữ thứ tự dsNg: nhiều việc trước, «Chưa giao người» cuối) */
  function nhomNguoi(dsNg) {
    var m = {}, thu = [];
    dsNg.forEach(function (p) { var k = p.thieu ? "~" : p.viec.map(function (t) { return t.b + "|" + t.ten; }).sort().join("¦");
      if (!m[k]) { m[k] = { ds: [] }; thu.push(k); } m[k].ds.push(p); });
    return thu.map(function (k) { return m[k]; });
  }
  /* 07/11 user t2 — NÚT BỘ LỌC MỚI (bản duyệt ở Bảo dưỡng, duyệt xong thay toàn bộ nút Bộ lọc hasaki + factory):
     không lọc = «Bộ lọc» màu thường (mở khối lọc cũng không đổi màu); đang lọc = CHỈ «Đang lọc» + chấm ✕ đỏ tròn bên phải (bấm = bỏ hết lọc)
     + khung nút nhấp nháy kiểu «tâm chấn» (2 vòng sóng lan ra rồi tan, lệch nhịp) — riêng khung nút, không rung cả trang. */
  function nutLoc(id, khoi, mo, dang) {
    return '<span class="bl-cum' + (dang ? " dang" : "") + '"><button type="button" class="btn-filter bl-moi' + (mo ? " mo" : "") + '" id="' + id + '" aria-controls="' + khoi + '" aria-expanded="' + !!mo + '">' +
      (dang ? "Đang lọc" : "Bộ lọc") + "</button>" + (dang ? '<button type="button" class="hsk-nut bl-xoa" data-bl-xoa="' + id + '" aria-label="Bỏ lọc" title="Bỏ lọc">×</button>' : "") + "</span>";
  }
  function veHomNay() {
    var D = duLieuNay(), the = D.the, sua = duocSua();
    /* bộ lọc Hạng mục · Người phụ trách (28/10) — lựa chọn lấy từ chính việc hôm nay */
    var tenNg = function (t) { return t.ng.length ? t.ng.map(function (n) { return n.ten; }) : [CHUA_GIAO]; };
    var dsHm = {}, dsAi = {};
    the.forEach(function (t) { dsHm[t.hm] = (dsHm[t.hm] || 0) + 1; tenNg(t).forEach(function (a) { dsAi[a] = (dsAi[a] || 0) + 1; }); });
    if (S.locHm && !dsHm[S.locHm]) S.locHm = ""; if (S.locAi && !dsAi[S.locAi]) S.locAi = "";
    var tatCa = the.length, dangLoc = !!(S.locHm || S.locAi);
    var khop = function (t) { return (!S.locHm || t.hm === S.locHm) && (!S.locAi || tenNg(t).indexOf(S.locAi) >= 0); };
    var luaChon = function (id, nhan, tat, ds, chon) {
      return '<label><span class="lbl">' + nhan + '</span><select id="' + id + '"><option value="">' + tat + " (" + tatCa + ")</option>" +
        Object.keys(ds).sort(function (a, c) { return a.localeCompare(c, "vi"); }).map(function (k) {
          return '<option value="' + esc(k) + '"' + (k === chon ? " selected" : "") + ">" + esc(tHm(k)) + " (" + ds[k] + ")</option>"; }).join("") + "</select></label>";
    };
    var khoiLoc = '<div class="filters bd-nay-bl' + (S.moLocNay ? "" : " collapsed") + '" id="bdNayLoc">' +
      luaChon("bdNayHm", "Hạng mục", "Tất cả hạng mục", dsHm, S.locHm) + luaChon("bdNayAi", "Người phụ trách", "Tất cả người", dsAi, S.locAi) + "</div>";
    var loc = the.filter(khop), tong = loc.length, xongN = loc.filter(function (t) { return t.l === "x"; }).length;
    var THU_L = { b: 0, m: 1, d: 2, x: 3 };
    var anhSo = function (t) { return t.kh ? t.co + "/" + t.kh + " ảnh" : t.han ? "hạn " + esc(t.han) : ""; };
    var diLam = function (p) { return p.thieu ? "" : p.vao ? '<span class="hsk-chip xong khongcham">Vào ' + esc(p.vao) + "</span>" : p.vao === "" ? '<span class="hsk-chip qua khongcham">Chưa chấm công</span>' : '<span class="bd-phu">—</span>'; };
    var tien = function (x, y, dv) { return '<span class="bd-tien"><span class="bd-tien-r"><i style="width:' + (y ? (100 * x / y).toFixed(0) : 0) + '%"></i></span><b>' + x + "/" + y + (dv ? "<small>" + dv + "</small>" : "") + "</b></span>"; };
    var gomHm = function (ds) { var m = {}, thu = []; ds.forEach(function (t) { if (!m[t.hm]) { m[t.hm] = []; thu.push(t.hm); } m[t.hm].push(t); });
      return thu.sort(function (a, c) { return m[c].length - m[a].length; }).map(function (h) { return [h, m[h]]; }); };
    /* 06/11 «Lưu trình»: KPI tính ở planogram (Chờ duyệt / Đã duyệt) — task work chỉ là nhắc việc ⇒ trạng thái theo yêu cầu planogram, «Đã gán» = đã bắn task */
    /* 06/11 lượt 6 user: «chưa bắn task / đã gán task-chưa làm / đang làm / đã làm-chờ duyệt / hoàn thành» — nhãn dùng chung mọi chế độ xem */
    /* 06/11 lượt 9 user «trạng thái ghi tương ứng GỐC trên work, không dài dòng, căn phải»: nhãn = chữ của work.hasaki.vn (taskStatusKey / i18n vi):
       chưa có task = «Chưa giao» · status 0 «Chưa bắt đầu» · 1 «Đang xử lý» · 5 «Chờ duyệt» · 2 «Hoàn thành» · quá hạn = 3 «Trễ hạn» */
    var LT = [["chua", "Chưa giao"], ["gan", "Chưa bắt đầu"], ["dg", "Đang xử lý"], ["dl", "Chờ duyệt"], ["ht", "Hoàn thành"]];
    var buocLt = function (t) { if (t.doi) return t.st === 4 ? "ht" : t.st === 3 ? "dl" : t.st === 2 ? "dg" : t.gan ? "gan" : "chua";
      return t.l === "x" ? "ht" : t.l === "d" ? "dg" : t.ky ? "gan" : "chua"; };
    var luuTrinh = function (ds) { var dem = {}; ds.forEach(function (t) { var k = buocLt(t); dem[k] = (dem[k] || 0) + 1; });
      return '<span class="bd-lt">' + LT.filter(function (x) { return dem[x[0]]; }).map(function (x) {
        return '<span class="lt-' + x[0] + '"><i aria-hidden="true"></i>' + x[1] + " <b>" + dem[x[0]] + "</b></span>"; }).join("") + "</span>"; };
    var hmChu = function (ds) { return gomHm(ds).map(function (x) { return '<span class="bd-hmc">' + o(tHm(x[0])) + (x[1].length > 1 ? " <b>" + x[1].length + "</b>" : "") + "</span>"; }).join(""); };
    /* 06/11 user «mục cha/mục con căn ngay ngắn, không lệch»: dòng vị trí dùng CHUNG lưới cột (--cot) với hàng người —
       tên vị trí trải 3 cột đầu · Lưu trình (cùng chấm màu của hàng cha) · Đã báo cáo (cùng thanh tiến độ, đơn vị «ảnh») · [Đã log task] · thao tác. */
    var motLt = function (t) { var k = buocLt(t), x = LT.filter(function (z) { return z[0] === k; })[0];
      return '<span class="bd-lt"><span class="lt-' + k + '"><i aria-hidden="true"></i>' + (t.l === "b" && !/ht|dl/.test(k) ? "Trễ hạn" : x[1]) + "</span></span>"; };
    var dongVt = function (t, thieu) {
      var chon = !!S.chonVt[t.b] && t.doi;
      var moTask = t.ky ? '<a class="bd-lk" href="https://work.hasaki.vn/tasks?task_id=' + encodeURIComponent(t.ky) + '" target="_blank" rel="noopener">Mở task ↗</a>' : "";
      return '<div class="bd-vtd s-' + t.l + '"' + (t.b ? ' data-bin="' + esc(t.b) + '"' + (t.d ? ' data-ngay="' + t.d + '"' : "") : "") + ' title="' + esc(CHIP_O[t.l][1]) + '">' +
        '<span class="bd-vtd-a">' + (sua ? (t.doi ? '<input type="checkbox" class="bd-ck" data-bin="' + esc(t.b) + '" aria-label="Chọn ' + esc(t.ten) + '"' + (chon ? " checked" : "") + ">" : '<span class="bd-ck-tr"></span>') : "") +
        '<span class="bd-vtd-ten" role="button" tabindex="0">' + o(t.ten) + (t.doi ? " <code>" + esc(t.b) + "</code>" : "") + "</span></span>" +
        '<span class="bd-vtd-lt">' + motLt(t) + '</span><span class="bd-vtd-bc">' + (t.kh ? tien(t.co, t.kh, "ảnh") : t.han ? '<span class="bd-phu">hạn ' + esc(t.han) + "</span>" : "") + "</span>" +
        (D.coTask ? '<span class="bd-vtd-tk">' + moTask + "</span>" : "") +
        '<span class="bd-vtd-lk">' + (sua && t.doi ? '<button type="button" class="bd-lk bd-doi1" data-bin="' + esc(t.b) + '">' + (thieu ? "Phân công" : "Đổi người") + "</button>" : D.coTask ? "" : moTask) + "</span></div>";
    };
    var dsVt = function (ds, thieu) { return gomHm(ds.slice().sort(function (a, c) { return THU_L[a.l] - THU_L[c.l]; })).map(function (x) {
      return '<div class="bd-vtn">' + o(tHm(x[0])) + "</div>" + x[1].map(function (t) { return dongVt(t, thieu); }).join(""); }).join(""); };
    var than;
    if (S.cheNay === "khu" || S.cheNay === "nguoi" || S.cheNay === "hm") {   // 06/11 lượt 13: 3 chế độ chung bộ dựng (thẻ vị trí, ảnh, số)
      /* 06/11 PA2 (user duyệt PDF «Phuong an Viec hom nay theo khu SHOP-WH»): bảng đối xứng HẠNG MỤC × SHOP | WH — khu nào cũng có cột.
         06/11 lượt 2 (user «không nổi trội, chung chung; chỗ nào xuống dòng theo luật nào; chừa trống nhiều; bấm Sửa lỗi»):
         · đầu bảng = khuôn thư viện hp-mtbl NGUYÊN BẢN (nền nhấn, chữ trắng) — không ghi đè xám;
         · nói 1 lần (luật «không lặp»): đầu cột khu = «x/y vị trí đã báo cáo» + quản lý khu; ô chỉ ghi SỐ, quản lý ô chỉ hiện khi đặt riêng;
         · xuống dòng: số + đơn vị, tên người, nhãn khu, chip KHÔNG xuống dòng (nowrap); chỉ tên hạng mục / tên vị trí được gói dòng;
         · thao tác (Phụ trách cả khu · Quản lý · Bỏ khỏi khu) nằm trong phần mở của ô, không rải ở mọi ô;
         · KHÔNG dùng data-hm (trang chủ bắt click [data-hm] = bảng Hạng mục 5S ⇒ mở nhầm pop-up) ⇒ data-hmuc. */
      var tatVt = {};   // hạng mục → khu → [mã vị trí] (mọi vị trí Vận hành g-sheet; khu theo kho lịch planogram, "?" = chưa rõ)
      Object.keys(S.vt).forEach(function (b) { var v = S.vt[b]; if (!v.vh.length || (S.boVt || {})[b]) return; var m = tatVt[v.hm] = tatVt[v.hm] || {}, k = S.khuBin[b] || "?"; (m[k] = m[k] || []).push(b); });
      Object.keys(S.cfg).forEach(function (kh) { var r = S.cfg[kh]; if (r["LOẠI"] === "hm" && r["GIÁ TRỊ"] === "co" && !tatVt[r["HẠNG MỤC"]]) tatVt[r["HẠNG MỤC"]] = {}; });
      var trangThai = function (hm, khu) { var g = cfgGt("hm", khu, hm), n = ((tatVt[hm] || {})[khu] || []).length; return g === "khong" ? "bo" : n ? "co" : g === "co" ? "them" : "khong"; };
      var dsHmK = Object.keys(tatVt).sort(function (a, c) { return a.localeCompare(c, "vi"); });
      var daBo = dsHmK.filter(function (h) { return KHU_DS.every(function (k) { return /bo|khong/.test(trangThai(h, k[0])); }) && KHU_DS.some(function (k) { return trangThai(h, k[0]) === "bo"; }); });
      var hienHm = dsHmK.filter(function (h) { return daBo.indexOf(h) < 0 && (!S.locHm || h === S.locHm) && (!S.locAi || loc.some(function (t) { return t.hm === h; })); });
      var nutCong = function (act, khu, hm) { return sua ? '<button type="button" class="bd-lk bd-ka bd-ko-cong' + (S.suaKho[khu] ? "" : " chi-sua") + '" data-act="' + act + '" data-khu="' + esc(khu) + '" data-hmuc="' + esc(hm) +
        '" title="Thêm vị trí ' + esc(hm) + " vào " + esc(khu) + '" aria-label="Thêm vị trí ' + esc(hm) + " vào " + esc(khu) + '">' + SVG_CONG + "</button>" : ""; };
      /* ✕ góc trên phải ô (chế độ sửa kho): bỏ hạng mục khỏi kho — bấm 2 lần (lần 1 đỏ «bấm lại để bỏ») */
      var xBo = function (khu, hm) { if (!sua) return ""; var xn = S.xacBo === khu + "|" + hm;
        return '<button type="button" class="bd-lk bd-ka bd-ko-x' + (xn ? " xn" : "") + (S.suaKho[khu] ? "" : " chi-sua") + '" data-act="bo" data-khu="' + esc(khu) + '" data-hmuc="' + esc(hm) + '" title="' +
          (xn ? "Bấm lần nữa để bỏ " : "Bỏ ") + esc(hm) + " khỏi " + esc(khu) + '" aria-label="Bỏ ' + esc(hm) + " khỏi " + esc(khu) + '">' + SVG_X_N + "</button>"; };
      var nut = function (act, chu, khu, hm, bin, lop) {
        return sua ? '<button type="button" class="bd-lk bd-ka' + (lop ? " " + lop : "") + '" data-act="' + act + '" data-khu="' + esc(khu || "") + '" data-hmuc="' + esc(hm || "") + '"' +
          (bin ? ' data-bin="' + esc(bin) + '"' : "") + ">" + chu + "</button>" : ""; };
      /* 06/11 lượt 3 user «bổ sung ảnh QL»: quản lý = ảnh đại diện + tên (khuôn chung anh-nv.js qua avatar(), như người phụ trách) */
      var tenQL = function (ds) { return ds.map(function (x) { var t = tenNV(x); return '<span class="bd-kn">' + avatar(t) + o(t) + "</span>"; }).join(""); };
      /* 06/11 lượt 6 user (chọn mẫu 5 + «ảnh có số yêu cầu dính góc phải như Messenger; bỏ Tách; mục cha hiện tổng người của mục con,
         mục con chưa gán vẫn có hình + số; icon đổi người sát ảnh; màu tiến độ ở mục con; đổi tên để gợi nhớ»):
         · ô cha = mỗi NGƯỜI 1 ảnh (gộp từ các vị trí con) + chấm số đỏ góc phải = số yêu cầu planogram hôm nay người đó phải làm;
           vị trí chưa giao người = hình người nét đứt viền đỏ + số; vòng đỏ quanh ảnh = chưa chấm công;
         · dòng con = vạch + nền nhạt theo Lưu trình · tên (bút đổi tên, «chờ WMS» khi WMS/planogram chưa nhận tên) · ảnh người + nút đổi người sát ảnh · số ảnh · nhãn Lưu trình. */
      var SVG_NG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>';
      var SVG_DOI = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M7 4 3 8l4 4"/><path d="M3 8h13a4 4 0 0 1 0 8h-2"/><path d="m17 20 4-4-4-4"/><path d="M21 16H8"/></svg>';
      var SVG_BUT = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m14 6 4 4"/></svg>';
      /* 07/11 t2.1 user «chọn trường lọc nhưng dữ liệu hiển thị không áp dụng theo trường lọc»: lọc người ⇒ ảnh trong ô chỉ còn người đó
         (vị trí 2 người cùng làm trước đây vẫn hiện người kia), hàng hạng mục không có việc của người đó thì ẩn */
      /* 07/11 user «số trên ảnh từng người / mục con hiển thị theo màu trạng thái work»: gộp trạng thái các việc của người đó —
         có việc trễ = Trễ hạn · hết đã duyệt = Hoàn thành · còn chờ duyệt = Chờ duyệt · đang làm = Đang xử lý · đã giao = Chưa bắt đầu · chưa task = Chưa giao */
      var ltGop = function (ds) { var c = function (k) { return ds.indexOf(k) >= 0; };
        return c("tre") ? "tre" : ds.length && ds.every(function (k) { return k === "ht"; }) ? "ht" : c("dl") ? "dl" : c("dg") ? "dg" : c("gan") ? "gan" : "chua"; };
      var ltViec = function (t) { var k = buocLt(t); return t.l === "b" && !/ht|dl/.test(k) ? "tre" : k; };
      var demNg = function (vs) { var m = {}, thu = [], chua = 0, ltC = [];
        vs.forEach(function (t) { var n = t.nyc || 1; if (!t.ng.length) { chua += n; ltC.push(ltViec(t)); return; }
          t.ng.filter(function (p) { return !S.locAi || p.ten === S.locAi; })
            .forEach(function (p) { var k = chuan(p.ten); if (!m[k]) { m[k] = { ten: p.ten, vao: p.vao, n: 0, lts: [] }; thu.push(k); } if (m[k].vao == null && p.vao != null) m[k].vao = p.vao;
              m[k].n += n; m[k].lts.push(ltViec(t)); }); });
        return { ds: thu.map(function (k) { m[k].lt = ltGop(m[k].lts); return m[k]; }), chua: chua, ltChua: ltGop(ltC) }; };
      /* ảnh 1 nhóm việc: VH = tròn · KT (Bảo trì / KT cơ điện, task kỳ) = VUÔNG; có KT thì «VH ●●● | KT ■■» */
      var anhNhom = function (vs, nho, cot) {
        var ve = function (ds, laKt) { var dn = demNg(ds); return dn.ds.map(function (p) { return anhSo1(nho ? { ten: p.ten, vao: p.vao, lt: p.lt } : p, nho, laKt); }).join("") +
          (dn.chua ? anhChua(nho ? null : dn.chua, nho, laKt, dn.ltChua) : ""); };
        var vh = vs.filter(function (t) { return !t.kt; }), kt = vs.filter(function (t) { return t.kt; });
        if (!kt.length && !cot) return ve(vh, false);   // cot: luôn chia 2 vùng VH | BT để các hàng thẳng cột
        /* 07/11 user: không chữ VH / KT — «●● | ■»: ảnh VH căn trái trong 2/3 vùng ảnh, vạch | cố định ở mốc 2/3, ảnh KT chỉ nằm sau vạch */
        return '<span class="bd-kav-vh">' + ve(vh, false) + '</span><span class="bd-kav-vach' + (kt.length ? "" : " chi-sua") + '" aria-hidden="true"></span><span class="bd-kav-kt">' +
          (kt.length ? ve(kt, true) : "") + "</span>"; };
      var anhSo1 = function (p, c, kt) { var vang = p.vao === "", tip = p.ten + (kt ? " · KT bảo trì" : "") + (vang ? " · chưa chấm công" : p.vao ? " · vào " + p.vao : "") + (p.n != null ? " · " + p.n + " yêu cầu" : "");
        return '<span class="bd-kav-1' + (vang ? " vang" : "") + (c ? " nho" : "") + (kt ? " vuong" : "") + '" title="' + esc(tip) + '" aria-label="' + esc(tip) + '">' + avatar(p.ten) +
          (p.n != null ? '<b class="bd-kbad lt-' + (p.lt || "chua") + '">' + p.n + "</b>" : "") + "</span>"; };
      var anhChua = function (n, c, kt, lt) { var tip = (n != null ? n + " yêu cầu " : "") + (kt ? "KT bảo trì " : "") + "chưa giao người";
        return '<span class="bd-kav-1 chua' + (c ? " nho" : "") + (kt ? " vuong" : "") + '" title="' + tip + '" aria-label="' + tip + '"><span class="bd-av bd-av-chua">' + SVG_NG + "</span>" +
          (n != null ? '<b class="bd-kbad lt-' + (lt || "chua") + '">' + n + "</b>" : "") + "</span>"; };
      var so = function (x, y) { return '<span class="bd-kso' + (y && x === y ? " du" : "") + '" title="Vị trí đã báo cáo hôm nay / vị trí có yêu cầu hôm nay"><b>' + x + "/" + y + "</b></span>"; };
      /* 07/11 user «các mục sửa, xoá, bổ sung, chuyển kho chỉ hiện nút hành động khi nhấn icon bút sau tên kho»: nút mục con giữ chỗ, ẩn khi kho chưa bật sửa */
      var anSua = function (t) { return S.suaKho[t.khu] ? "" : " chi-sua"; };
      var dongVtK = function (t) {
        var q = qlCua(t.khu, t.hm, t.b), bl = buocLt(t), nl = t.l === "b" && !/ht|dl/.test(bl) ? "Trễ hạn" : LT.filter(function (z) { return z[0] === bl; })[0][1];   // work: quá hạn = «Trễ hạn»
        var dt = (S.doiTen || {})[t.b], cho = dt && dt["TRẠNG THÁI"] !== "Đã đổi WMS";
        /* 06/11 lượt 7 user: «bút cạnh mã → tưởng đổi mã; mã vị trí luôn cố định» ⇒ bút đứng cuối TÊN (đổi tên hiển thị, mã giữ nguyên);
           «mục con kích thước cố định, không hiện số ảnh; trạng thái lên trên cùng bên phải; ảnh + icon xuống dưới cùng bên phải; tên chiếm 2/3, dài thì xuống dòng» */
        return '<div class="bd-kvt lt-' + bl + (t.l === "b" ? " qh" : "") + (t.kt ? " kt" : "") + '" data-bin="' + esc(t.b) + '" data-kt="' + (t.kt ? 1 : 0) + '"' + (t.d ? ' data-ngay="' + t.d + '"' : "") + ">" +
          '<span class="bd-kvt-trai"><span class="bd-kvt-ten"><span class="bd-vtd-ten" role="button" tabindex="0" title="' + esc(t.ten) + '">' + o(t.ten) + "</span>" +
            (sua && t.doi ? '<button type="button" class="bd-lk bd-ka bd-kvt-but' + anSua(t) + '" data-act="ten" data-bin="' + esc(t.b) + '" title="Đổi tên vị trí (mã giữ nguyên)" aria-label="Đổi tên vị trí ' + esc(t.ten) + ', mã giữ nguyên">' +
              SVG_BUT + "</button>" : "") + "</span>" +
            '<span class="bd-kvt-ma"><span class="bd-kvt-ky">' + nhanKy(t.ts) + "</span>" + (t.doi ? "<code>" + esc(t.b) + "</code>" : t.han ? '<span class="bd-phu">hạn ' + esc(t.han) + "</span>" : "") +
            (cho ? '<small class="bd-kvt-cho" title="' + esc((dt["TRẠNG THÁI"] === "Lỗi" ? "WMS chưa nhận tên mới" : "Đang chờ WMS / planogram cập nhật") + " — tên cũ: " + (dt["TÊN CŨ"] || "")) + '">' +
              (dt["TRẠNG THÁI"] === "Lỗi" ? "WMS chưa đổi" : "chờ WMS") + "</small>" : "") + (q.cap === "vị trí" ? '<span class="bd-kvt-ql">· QL ' + q.ds.map(function (x) { return o(tenNV(x)); }).join(", ") + "</span>" : "") +
            "</span></span>" +
          '<span class="bd-kvt-tt">' + esc(nl) + "</span>" +
          '<span class="bd-kvt-ngs">' +   /* 06/11 lượt 10 user «xoá mục QL ở mục con — không cần thiết» */
            (sua && t.doi ? '<button type="button" class="bd-lk bd-doi1 bd-kvt-doi' + anSua(t) + '" data-bin="' + esc(t.b) + '" title="' + (t.ng.length ? "Đổi người" : "Phân công") + '" aria-label="' + (t.ng.length ? "Đổi người " : "Phân công ") +
              esc(t.ten) + '">' + SVG_DOI + "</button>" : "") +
            (sua && t.doi && t.khu ? '<button type="button" class="bd-lk bd-ka bd-kvt-ck' + anSua(t) + '" data-act="ckvt" data-bin="' + esc(t.b) + '" data-khu="' + esc(t.khu) + '" data-hmuc="' + esc(t.hm) +
              '" title="Chuyển sang ' + (t.khu === "SHOP" ? "WH" : "SHOP") + '" aria-label="Chuyển ' + esc(t.ten) + " sang " + (t.khu === "SHOP" ? "WH" : "SHOP") + '">' + SVG_CK + "</button>" : "") +
            '<span class="bd-kav">' + (t.ng.length ? t.ng.map(function (p) { return anhSo1({ ten: p.ten, vao: p.vao }, 1, t.kt); }).join("") : anhChua(null, 1, t.kt)) + "</span>" + "</span>" +
            (sua && t.doi ? '<button type="button" class="bd-lk bd-ka bd-kvt-x' + anSua(t) + (S.xacBo === "vt|" + t.b ? " xn" : "") + '" data-act="bovt" data-bin="' + esc(t.b) +
              '" data-hmuc="' + esc(t.hm) + '" title="' +
              (S.xacBo === "vt|" + t.b ? "Bấm lần nữa để bỏ " : "Bỏ ") + esc(t.ten) + ' khỏi Việc hôm nay" aria-label="Bỏ ' + esc(t.ten) + '">' + SVG_X_N + "</button>" : "") + "</div>";
      };
      var oKhu = function (hm, khu) {
        var tt = trangThai(hm, khu), key = khu + "|" + hm, tong = ((tatVt[hm] || {})[khu] || []).length;
        if (tt === "khong" || tt === "bo") return '<td class="bd-ko trong" data-khu="' + khu + '"><span class="bd-phu">' + (tt === "bo" ? "Đã bỏ khỏi " + khu : "Không có") + "</span>" +
          nutCong(tt === "bo" ? "molai" : "themvt", khu, hm) + "</td>";
        var vs = loc.filter(function (t) { return t.hm === hm && t.khu === khu; }).sort(function (a, c) { return THU_L[a.l] - THU_L[c.l]; });
        var q = qlCua(khu, hm), mo = !!S.moO[key], dn = demNg(vs);
        /* 07/11 user «không có lịch thì hiện mũi tên xổ xuống làm gì — ẩn hết, chỉ ghi đơn giản»; «Chưa có vị trí»: bỏ dòng ⚠ — nhắc lúc bấm + Thêm */
        if (!vs.length) return '<td class="bd-ko bd-ko-rong" data-khu="' + khu + '">' + (q.cap === "hạng mục" ? '<div class="bd-kql">Quản lý ' + tenQL(q.ds) + "</div>" : "") +
          '<span class="bd-ko-1"><span class="bd-phu">' + (tong ? "Hôm nay không có lịch" : "Chưa có vị trí") + "</span>" + (tong ? "" : nutCong("themvt", khu, hm)) + "</span>" + xBo(khu, hm) + "</td>";
        /* nền ô theo tiến độ: còn vị trí chưa giao người = đỏ nhạt · đủ = xanh nhạt · đã báo cáo một phần = vàng nhạt · chưa ai báo cáo = không tô */
        var xo = vs.filter(function (t) { return t.l === "x"; }).length, nen = !vs.length ? "" : dn.chua ? " tt-do" : xo === vs.length ? " tt-xanh" : xo ? " tt-vang" : "";
        /* 06/11 lượt 10 user «xoá: Phụ trách cả kho · Quản lý <hạng mục> · Bỏ khỏi <kho> — không cần thiết» ⇒ bỏ dòng thao tác ô */
        var chan = "";
        /* cả dòng ô = nút mở (mũi tên đầu dòng) — bấm mở danh sách vị trí + thao tác */
        return '<td class="bd-ko' + nen + (mo ? " mo" : "") + (S.muiDoi === key ? " mui-cu" : "") + '" data-khu="' + khu + '">' + xBo(khu, hm) +
          '<div class="bd-ka bd-ko-h" role="button" tabindex="0" data-act="vt" data-o="' + esc(key) + '" aria-expanded="' + mo + '"><i class="bd-mui" aria-hidden="true"></i><div class="bd-ko-nd">' +
            (q.cap === "hạng mục" ? '<div class="bd-kql">Quản lý ' + tenQL(q.ds) + "</div>" : "") +
            '<div class="bd-kg"><span class="bd-kav">' + anhNhom(vs) + '</span><span class="bd-kg-fl"></span>' + so(xo, vs.length) + "</div>" +
            "</div></div>" +
          (mo ? '<div class="bd-ko-ds' + (S.moMoi === key ? " vua-mo" : "") + '">' + vs.map(dongVtK).join("") + chan + "</div>" : "") + "</td>";
      };
      /* 06/11 lượt 12 user «hiển thị tên kho / Quản lý / Số lượng mục | 0/10 đã hoàn thành — dấu / là xuống dòng, căn lề trái» */
      var tomKho = function (k) { var vs = loc.filter(function (t) { return t.khu === k; }), m = {};
        vs.forEach(function (t) { t.ng.forEach(function (p) { m[chuan(p.ten)] = 1; }); });
        var hmK = dsHmK.filter(function (h) { return daBo.indexOf(h) < 0 && /co|them/.test(trangThai(h, k)) && (!S.locHm || h === S.locHm) &&
          (!S.locAi || vs.some(function (t) { return t.hm === h; })); });   // 07/11: đầu kho đếm theo bộ lọc đang chọn
        /* hạng mục «đã giao» = không còn vị trí hôm nay chưa giao người */
        var hmChua = hmK.filter(function (h) { return vs.some(function (t) { return t.hm === h && !t.ng.length; }); }).length;
        return { vs: vs, x: vs.filter(function (t) { return t.l === "x"; }).length, nNg: Object.keys(m).length, nHm: hmK.length, daGiao: hmK.length - hmChua }; };
      var dauKho = function (k, coSua) { var tk = tomKho(k), q = qlCua(k), kt = (KHU_DS.filter(function (z) { return z[0] === k; })[0] || [k, k])[1];
        /* 07/11 user «các mục +, Thêm → đều đổi thành icon cây bút nhỏ; bên trong mới có thêm (+) / bớt (✕ góc trên phải mục đã có)» */
        var dangSua = coSua && sua && S.suaKho[k];
        return '<div class="bd-kd"><div class="bd-kd-t">' + kt + (coSua && sua ? butSua("suakho", dangSua, (dangSua ? "Xong sửa " : "Sửa hạng mục · quản lý ") + k, ' data-khu="' + k + '"') +
            '<button type="button" class="bd-lk bd-ka bd-kd-them' + (dangSua ? "" : " chi-sua") + '" data-act="themvt" data-khu="' + k + '" data-hmuc="" title="Thêm hạng mục vào ' + k +
              '" aria-label="Thêm hạng mục vào ' + k + '"' + (dangSua ? "" : ' tabindex="-1" aria-hidden="true"') + ">" + SVG_CONG + "</button>" : "") + "</div>" +
          '<div class="bd-kd-hang"><div class="bd-kh-ql">' + (q.ds.length ? "Quản lý" + tenQL(q.ds) : '<span class="bd-kh-chua">Chưa có quản lý</span>') +
            (coSua && sua ? nut("ql", "Đổi", k, "", "", dangSua ? "" : "chi-sua") : "") + "</div>" +
          /* 07/11 user «gom thành "Đã giao 7/8 hạng mục | 0/1 hoàn thành" — cỡ / font chữ / số như nhau» */
          '<div class="bd-kd-so"><span title="Hạng mục không còn vị trí hôm nay chưa giao người / hạng mục của kho"' + (tk.daGiao < tk.nHm ? ' class="bd-do"' : "") + ">Đã giao " +
            tk.daGiao + "/" + tk.nHm + ' hạng mục</span><span class="bd-kd-vach" aria-hidden="true">|</span>' +
            '<span title="Vị trí đã báo cáo hôm nay / vị trí có yêu cầu hôm nay">' + tk.x + "/" + tk.vs.length + " hoàn thành</span></div></div></div>"; };
      var dauKhu = KHU_DS.map(function (k) { return '<th scope="col" data-khu="' + k[0] + '">' + dauKho(k[0], true) + "</th>"; }).join("");
      var chuaRo = loc.filter(function (t) { return !t.khu; }).length;
      var dangSuaK = sua && KHU_DS.some(function (k) { return S.suaKho[k[0]]; });   // 07/11 user «Đã bỏ … Thêm lại: chỉ hiện khi bấm icon bút»
      than = '<div class="bd-kbang-w"><table class="hp-mtbl bd-kbang"><thead><tr><th scope="col" class="bd-kh-hm">Hạng mục</th>' + dauKhu + "</tr></thead><tbody>" +
        hienHm.map(function (h) {
          return '<tr><th scope="row" class="bd-kh-hm"><span class="bd-kh-ten">' + o(tHm(h)) + "</span></th>" +   // 07/11 user bỏ «n vị trí ⚠ n»
            KHU_DS.map(function (k) { return oKhu(h, k[0]); }).join("") + "</tr>"; }).join("") +
        "</tbody></table></div>" +
        '<div class="bd-kchan">' +
          (daBo.length && dangSuaK ? '<span class="bd-phu">Đã bỏ: ' + daBo.map(function (h) { return o(tHm(h)) + (sua ? " " + nut("molai2", "Thêm lại", "", h) : ""); }).join(" · ") + "</span>" : "") +
          (Object.keys(S.boVt || {}).length && dangSuaK ? '<span class="bd-phu">Đã bỏ vị trí: ' + Object.keys(S.boVt).map(function (b0) { var v0 = S.vt[b0] || {};
            return o(String(v0.ten || b0).split("|").pop().trim()) + " " +
              '<button type="button" class="bd-lk bd-ka" data-act="molaivt" data-bin="' + esc(b0) + '" data-hmuc="' + esc(v0.hm || "") + '">Thêm lại</button>'; }).join(" · ") + "</span>" : "") +
          (chuaRo ? '<span class="bd-do">⚠ ' + chuaRo + " việc chưa rõ kho (vị trí chưa có lịch planogram)</span>" : "") + "</div>";
      /* 06/11 lượt 11 user «lỗi hiển thị nghiêm trọng trên điện thoại — mặc định hiển thị kho, nhấn vào mới hiện mục cha, nhấn mục cha mới hiện mục con»:
         bảng 2 kho bẻ thành chuỗi thẻ (mỗi hạng mục lặp SHOP + WH, cả ô «Không có») dài ~5 màn ⇒ điện thoại = ĐI SÂU TỪNG LỚP:
         ① 2 thẻ kho (tiến độ · quản lý · số hạng mục · chưa giao) → ② bấm kho: hạng mục CỦA KHO ĐÓ (‹ Tất cả kho) → ③ bấm hạng mục: vị trí con.
         Mỗi lớp ghi nấc hskLop (vuốt lùi / Esc đóng đúng 1 lớp). Máy tính giữ bảng 2 cột. */
      var xOf = function (ds) { return ds.filter(function (t) { return t.l === "x"; }).length; };
      var xep = function (ds) { return ds.slice().sort(function (a0, c) { return THU_L[a0.l] - THU_L[c.l]; }); };
      var gap1 = function (key, dau, con, lop) { var mo = !!S.moO[key];
        return '<div class="bd-pn' + (mo ? " mo" : "") + (S.muiDoi === key ? " mui-cu" : "") + (lop ? " " + lop : "") + '"><div class="bd-ka bd-pn-h" role="button" tabindex="0" data-act="vt" data-o="' + esc(key) + '" aria-expanded="' + mo + '">' +
          '<i class="bd-mui" aria-hidden="true"></i>' + dau + "</div>" + (mo ? '<div class="bd-ko-ds' + (S.moMoi === key ? " vua-mo" : "") + '">' + con() + "</div>" : "") + "</div>"; };
      /* thẻ hạng mục 1 dòng: tên · ảnh người phụ trách · x/y — chung Theo hạng mục và Theo kho trên điện thoại */
      /* 07/11 user «bỏ cột số x/y bên phải — hiện chỗ khác cho gọn (như "[298 ngày] Tên"); cột ảnh VH và ảnh BT phải thẳng cột giữa các hàng» */
      var soTruoc = function (x, y) { return '<small class="bd-so-truoc' + (y && x === y ? " du" : "") + '" title="Vị trí đã báo cáo hôm nay / vị trí có yêu cầu hôm nay">[' + x + "/" + y + "]</small>"; };
      var dauHm = function (h, vs) {
        return '<span class="bd-pm-ten">' + soTruoc(xOf(vs), vs.length) + o(tHm(h)) + "</span>" + '<span class="bd-kav bd-kav-cot">' + anhNhom(vs, 1, true) + "</span>"; };
      if (laDT()) {
        var chanK = than.slice(than.indexOf('<div class="bd-kchan">'));
        var tk = null;
        if (!S.khoDT) {
          than = '<div class="bd-kdt-khos">' + KHU_DS.map(function (k) {
            return '<div class="bd-kdt-kho bd-ka' + (S.muiDoi === "kho|" + k[0] ? " mui-cu" : "") + '" role="button" tabindex="0" data-act="khodt" data-khu="' + k[0] + '" aria-label="Xem ' + esc(k[1]) + '">' +
              '<i class="bd-mui bd-kdt-mui" aria-hidden="true"></i>' + dauKho(k[0], false) + "</div>"; }).join("") + "</div>";
        } else {
          /* 07/11 user: «nhấn lại BẤT KỲ chỗ nào ở khung SHOP/WH thì thu lại (không phải chỉ ‹ Tất cả kho)» · «chỉ hiển thị mục có lịch, không có thì không hiển thị» ·
             «vị trí ngang hàng hạng mục nên để avatar người — nhấn vào mới hiện mục con» ⇒ đầu kho = thẻ đang mở (bấm thu lại);
             hạng mục = thẻ gập 1 dòng như Theo hạng mục; hạng mục hôm nay không có lịch / chưa có vị trí không hiện. */
          var k0 = S.khoDT, ktn = (KHU_DS.filter(function (z) { return z[0] === k0; })[0] || [k0, k0])[1];
          var coHm = hienHm.filter(function (h) { return loc.some(function (t) { return t.hm === h && t.khu === k0; }); });
          than = '<div class="bd-kdt-kho bd-kdt-mo bd-ka' + (S.muiDoi === "kho|" + k0 ? " mui-cu" : "") + '" role="button" tabindex="0" data-act="khodt" data-khu="" aria-expanded="true" aria-label="Thu gọn ' + esc(ktn) + '">' +
              '<i class="bd-mui bd-kdt-mui" aria-hidden="true"></i>' + dauKho(k0, true) + "</div>" +
            (coHm.length ? '<div class="bd-pl bd-kdt-hm' + (S.moMoi === "kho" ? " vua-mo" : "") + '">' + coHm.map(function (h) {
              var vs = xep(loc.filter(function (t) { return t.hm === h && t.khu === k0; }));
              return gap1(k0 + "|" + h, dauHm(h, vs), function () { return vs.map(dongVtK).join(""); }, "bd-ph"); }).join("") + "</div>"
              : '<div class="bd-phu bd-pk-trong">Hôm nay không có lịch</div>');
        }
        than += chanK;
      }
      /* 06/11 lượt 13 user «Theo người là theo từng người được giao — nhấn người mới hiện mục cha, nhấn tiếp cha mới tới mục con, sao lặp lại theo kho?» +
         «Theo hạng mục: nhấn mục cha mới xổ mục con, sao luôn hiện cả cha lẫn con?» ⇒ 2 chế độ dùng CHUNG 1 khuôn danh sách gập:
         · Theo người: lớp 1 = mỗi người 1 thẻ (ảnh + 2 chữ cuối tên + x/y), KHÔNG chia kho; lớp 2 = hạng mục của người đó; lớp 3 = vị trí (thẻ con như Theo kho).
         · Theo hạng mục: lớp 1 = mỗi hạng mục 1 thẻ (tên + ảnh người phụ trách + x/y); lớp 2 = vị trí.
         Mặc định gập hết; mỗi lớp mở trên điện thoại ghi nấc hskLop (vuốt lùi đóng đúng 1 lớp). Lưới thẻ align-start ⇒ mở 1 thẻ không làm thẻ khác nhảy cột. */
      if (S.cheNay === "nguoi" || S.cheNay === "hm") {
        var ds1;
        if (S.cheNay === "nguoi") {
          var mN = {}, thuN = [], chuaN = [];
          loc.forEach(function (t) { if (!t.ng.length) { chuaN.push(t); return; }
            t.ng.forEach(function (p) { var kk = chuan(p.ten); if (!mN[kk]) { mN[kk] = { ten: p.ten, vao: p.vao, n: 0, ds: [] }; thuN.push(kk); }
              if (mN[kk].vao == null && p.vao != null) mN[kk].vao = p.vao; mN[kk].n += t.nyc || 1; mN[kk].ds.push(t); }); });
          var dsN = thuN.map(function (kk) { return mN[kk]; }).sort(function (a0, c) { return c.n - a0.n || a0.ten.localeCompare(c.ten, "vi"); });
          if (chuaN.length) dsN.push({ chua: true, ten: CHUA_GIAO, n: chuaN.reduce(function (s0, t) { return s0 + (t.nyc || 1); }, 0), ds: chuaN });
          ds1 = dsN.map(function (p) {
            var chiKt = function (ds) { return ds.length && ds.every(function (t) { return t.kt; }); };   // 07/11 người chỉ làm việc bảo trì = ảnh vuông
            var dau = soTruoc(xOf(p.ds), p.ds.length) + '<span class="bd-kav">' + (p.chua ? anhChua(p.n, 0, false, ltGop(p.ds.map(ltViec))) : anhSo1({ ten: p.ten, vao: p.vao, n: p.n, lt: ltGop(p.ds.map(ltViec)) }, 0, chiKt(p.ds))) + "</span>" +
              '<span class="bd-pn-ten' + (p.chua ? " bd-do" : "") + '" title="' + esc(p.ten) + '">' + o(p.chua ? "Chưa giao" : String(p.ten).split(" ").slice(-2).join(" ")) + "</span>" +
              '<span class="bd-kg-fl"></span>';
            return gap1("ng|" + p.ten, dau, function () { return gomHm(p.ds).map(function (g) {
              return gap1("ng|" + p.ten + "|" + g[0], '<span class="bd-pm-ten">' + soTruoc(xOf(g[1]), g[1].length) + o(tHm(g[0])) + '</span><span class="bd-kg-fl"></span>',
                function () { return xep(g[1]).map(dongVtK).join(""); }, "bd-pm"); }).join(""); }, p.chua ? "chua" : ""); });
        } else {
          ds1 = gomHm(loc).sort(function (a0, c) { return a0[0].localeCompare(c[0], "vi"); }).map(function (g) {
            return gap1("hm|" + g[0], dauHm(g[0], g[1]), function () { return xep(g[1]).map(dongVtK).join(""); }, "bd-ph"); });
        }
        than = ds1.length ? '<div class="bd-pl">' + ds1.join("") + "</div>" : '<div class="bd-phu bd-pk-trong">Hôm nay không có lịch</div>';
      }
    } else {
      var cotTask = D.coTask;
      than = '<div class="bd-ngb' + (cotTask ? " co-task" : "") + '"><div class="bd-ngh"><span>Người phụ trách</span><span>Đi làm</span><span>Việc</span>' +
        '<span>Lưu trình</span><span title="Vị trí đã báo cáo hôm nay / vị trí có yêu cầu hôm nay">Đã báo cáo</span>' + (cotTask ? "<span>Đã log task</span>" : "") + '<span class="bd-ngr-x"></span></div>' +
        /* 05/11 user «sao cả Cường và Phi phải báo cáo cùng 1 khu vực? cần nhóm lại»: người có CÙNG bộ việc gộp 1 hàng nhóm —
           tên + ảnh xếp dọc, giờ vào từng người thẳng hàng tên; bấm mở danh sách vị trí chung 1 lần (trước: 2 hàng giống hệt nhau). */
        nhomNguoi(D.dsNg).map(function (g) {
          var p0 = g.ds[0], thieu = !!p0.thieu, ds = p0.viec.filter(khop); if (!ds.length) return "";
          var khoa = g.ds.map(function (p) { return p.ten; }).join(" · "), mo = !!S.moNg[khoa], x = ds.filter(function (t) { return t.l === "x"; }).length;
          var tkP = g.ds.filter(function (p) { return p.task; })[0];
          var tk = tkP ? '<span class="bd-tk"><b>' + tkP.task.x + "/" + tkP.task.n + "</b>" + (tkP.task.cha ? ' <a href="https://work.hasaki.vn/tasks?task_id=' + encodeURIComponent(tkP.task.cha) +
            '" target="_blank" rel="noopener">Mở task ↗</a>' : "") + "</span>" : '<span class="bd-phu">—</span>';
          return '<div class="bd-ngr' + (mo ? " mo" : "") + (thieu ? " thieu" : "") + (g.ds.length > 1 ? " nhom" : "") + '" data-ng="' + esc(khoa) + '"><div class="bd-ngr-h" role="button" tabindex="0" aria-expanded="' + mo + '">' +
            '<span class="bd-ngr-ten"><i class="bd-mui" aria-hidden="true"></i>' + (thieu ? '<span class="bd-do">' + CHUA_GIAO + "</span>"
              : '<span class="bd-ngr-ds-ten">' + g.ds.map(function (p) { return '<span class="bd-ngr-mot">' + avatar(p.ten) + '<span class="bd-ngr-tn">' + o(p.ten) + '</span><span class="bd-dl-dt">' + diLam(p) +
                "</span></span>"; }).join("") + "</span>") + "</span>" +
            '<span class="bd-ngr-dl">' + g.ds.map(function (p) { return '<span class="bd-ngr-mot">' + diLam(p) + "</span>"; }).join("") + '</span><span class="bd-ngr-hm">' + hmChu(ds) + '</span>' +
              '<span class="bd-ngr-lt">' + luuTrinh(ds) + '</span><span class="bd-ngr-bc">' +
              tien(x, ds.length, "vị trí") + "</span>" + (cotTask ? '<span class="bd-ngr-tk">' + tk + "</span>" : "") + '<span class="bd-ngr-x"></span></div>' +
            (mo ? '<div class="bd-ngr-ds' + (S.moMoi === "ng:" + khoa ? " vua-mo" : "") + '">' + (sua && thieu && ds.some(function (t) { return t.doi; }) ? '<label class="bd-chon-het"><input type="checkbox" class="bd-ck-het"' +
              (ds.every(function (t) { return !t.doi || S.chonVt[t.b]; }) ? " checked" : "") + "> Chọn tất cả</label>" : "") + dsVt(ds, thieu) + "</div>" : "") + "</div>";
        }).join("") + "</div>";
    }
    var nChon = Object.keys(S.chonVt).length;
    var thanh = sua && nChon ? '<div class="bd-chon-bar"><span>Đã chọn <b>' + nChon + "</b> vị trí</span>" +
      '<button type="button" class="hsk-nut phu nho" id="bdBoChon">Bỏ chọn</button><button type="button" class="hsk-nut chinh nho" id="bdDoiNhieu">Đổi người ' + nChon + " vị trí</button></div>" : "";
    var vang = D.dsNg.filter(function (p) { return !p.thieu && p.vao === ""; }).length, coMat = D.dsNg.filter(function (p) { return !p.thieu && p.vao; }).length;
    var thieuN = (D.dsNg.filter(function (p) { return p.thieu; })[0] || { viec: [] }).viec.length;
    var tom = '<div class="bd-tom"><span><b>' + coMat + "</b> người đi làm</span>" + (vang ? '<span class="bd-do"><b>' + vang + "</b> chưa chấm công</span>" : "") +
      (thieuN ? '<span class="bd-do"><b>' + thieuN + "</b> vị trí chưa giao người</span>" : "") + (D.coTask ? "" : "<span>Task work: <b>ngưng giao</b></span>") + "</div>";
    var che = S.cheNay || "khu";
    var seg = '<div class="bd-seg" role="group" aria-label="Cách xem">' + [["khu", "Theo kho"], ["nguoi", "Theo người"], ["hm", "Theo hạng mục"]].map(function (x) {
      return '<button type="button" class="hp-whtab' + (che === x[0] ? " active" : "") + '" data-che="' + x[0] + '" aria-pressed="' + (che === x[0]) + '">' + x[1] + "</button>"; }).join("") + "</div>";
    var chipGia = S.ngayGia ? '<span class="hsk-chip dang khongcham bd-gia" title="Bản thử: hôm nay chưa có yêu cầu — dựng theo ngày gần nhất có yêu cầu">Mô phỏng ' +
      dm(S.ngayGia) + "</span>" : "";
    return '<div class="panel bd-panel" id="bdNay"><div class="panel-head"><span class="ph-trai"><span class="ph-td">Việc hôm nay</span>' + chipGia + '<span class="ph-dem" title="Việc đã báo cáo hôm nay / việc có yêu cầu hôm nay">Đã báo cáo ' +
      xongN + "/" + tong + " việc</span></span>" +
        '<span class="bd-nay-phai">' + (tatCa ? (laDT() ? "" : seg) + nutLoc("bdNayNut", "bdNayLoc", S.moLocNay, dangLoc) : "") + "</span></div>" + (tatCa ? khoiLoc : "") +
      '<div class="bd-than bd-nay">' + (tong ? (laDT() && tatCa ? '<div class="bd-seg-dt">' + seg + "</div>" : "") + thanh + '<div class="bd-che">' + than + "</div>"
        : '<div class="bd-nay-trong">' + (dangLoc ? "Không có việc khớp bộ lọc." : "Hôm nay không có việc bảo dưỡng nào.") + "</div>") + "</div></div>";
  }

  /* ===== HỘP ĐỔI NGƯỜI (05/11) — vỏ .hp-modal (hskLop tự ghi nấc vuốt lùi); điện thoại = tấm trượt đáy ===== */
  function moDoiNguoi(bins, nhom) {
    bins = bins.filter(function (b) { return S.vt[b]; }); if (!bins.length) return;
    nhom = nhom || "VẬN HÀNH"; var laKt = nhom !== "VẬN HÀNH";   // 07/11: nhóm Bảo trì / KT cũng dùng hộp này (luôn «Từ nay về sau»)
    var D = duLieuNay(), theoBin = {}; D.the.forEach(function (t) { if (t.doi) theoBin[t.b] = t; });
    var hien = {}; bins.forEach(function (b) { (laKt ? tachDs(nguoiVt(b, nhom).ten).map(function (t) { return { ten: tenNV(t) }; }) : (theoBin[b] || {}).ng || [])
      .forEach(function (n) { hien[chuan(n.ten)] = n.ten; }); });
    var tenHien = Object.keys(hien).map(function (k) { return hien[k]; });
    var coTask = bins.some(function (b) { return S.giaoNay[b] && S.giaoNay[b]["TASK CON"]; });
    var coNgay = bins.some(function (b) { var g = S.giao[khoaNay(b)]; return g && g["CHẾ ĐỘ"] === "chi-dinh"; });
    /* 05/11 lượt 2 (user «đầy đủ nhân viên CHỈ KHI GÕ TÊN — gõ ký tự là ra gợi ý; luôn ưu tiên người được phân công / đã làm, báo cáo trước đó»):
       ƯU TIÊN = phân công g-sheet của vị trí · người từng báo cáo vị trí (mới nhất trước) · người đang đi làm hôm nay; chưa gõ chỉ hiện nhóm ưu tiên.
       Gõ ⇒ tìm trên danh bạ (anh-nv.js: tên không dấu · mã NV · đầu email), người ưu tiên lên đầu. Chọn = lưu MÃ NV (tránh trùng tên). */
    var uu = {}, soViec = {};
    D.dsNg.forEach(function (p) { soViec[chuan(p.ten)] = p.viec.length; });
    var them = function (ten, nhan, thu) { ten = String(ten || "").trim(); if (!ten || ten === CHUA_GIAO || hien[chuan(ten)]) return;
      var k = chuan(ten), u = uu[k] = uu[k] || { ten: ten, nhan: [], thu: 9 }; if (u.nhan.indexOf(nhan) < 0) u.nhan.push(nhan); u.thu = Math.min(u.thu, thu); };
    bins.forEach(function (b) {
      String(goiY(b, "VẬN HÀNH")["phan-cong"] || "").split(/\s*[\/,;]\s*/).forEach(function (t) { them(t, "Phân công", 0); });
      ycCua(b).filter(function (y) { return xong(Number(y["STATUS ID"])) && y["TÊN NGƯỜI LÀM"] && !TK_THU[String(y["NGƯỜI LÀM"]).toLowerCase()]; })
        .sort(function (a, c) { return String(c["LÚC LÀM"]).localeCompare(String(a["LÚC LÀM"])); })
        .forEach(function (y) { them(String(y["TÊN NGƯỜI LÀM"]).split(" · ")[0], "Đã báo cáo", 1); });
    });
    Object.keys(D.vao).forEach(function (k) { if (D.vao[k]) them((D.dsNg.filter(function (p) { return chuan(p.ten) === k; })[0] || { ten: k }).ten, "Đi làm", 2); });
    var m = $id("bdDoiHop");
    if (!m) { m = document.createElement("div"); m.id = "bdDoiHop"; m.className = "hp-modal"; document.body.appendChild(m); ganHop(m); }
    m.__bins = bins; m.__ngay = !laKt; m.__nhom = nhom; m.__uu = uu; m.__vao = D.vao; m.__soViec = soViec;
    m.__giu = tenHien.slice(); m.__goc = tenHien.slice();   // 06/11 lượt 10: người hiện tại xoá được (✕); Lưu = người còn giữ + người thêm
    var tieuDe = tenHien.length ? "Đổi người phụ trách" + (bins.length > 1 ? " · " + bins.length + " vị trí" : "") : "Phân công " + bins.length + " vị trí";
    m.innerHTML = '<div class="hp-modalbox" role="dialog" aria-modal="true" aria-label="' + esc(tieuDe) + '"><div class="hp-modalhd"><div class="mt">' + esc(tieuDe) +
      '</div><button type="button" class="hsk-nut phu nho bd-hop-dong">Đóng</button></div>' +
      '<div class="hp-modalbody"><div class="bd-hop-vt">' + bins.slice(0, 3).map(function (b) { var t = theoBin[b] || {}; return "<div>" + o(t.ten || b) + " <code>" + esc(b) + "</code></div>"; }).join("") +
        (bins.length > 3 ? '<div class="bd-phu">+ ' + (bins.length - 3) + " vị trí nữa</div>" : "") + "</div>" +
      '<div class="bd-hop-nh">Người phụ trách hiện tại</div><div class="bd-hop-hien"><div class="bd-hop-giu"></div>' +
        (coTask ? '<div class="bd-phu">Task đã giao → chuyển người nhận sang người mới</div>' : "") + "</div>" +
      '<div class="bd-hop-nh">' + (tenHien.length ? "Thêm người" : "Chọn người") + "</div>" +
      '<input type="search" class="bd-hop-tim" maxlength="80" placeholder="Gõ tên, mã NV hoặc email" autocomplete="off" enterkeyhint="search">' +
      '<div class="bd-hop-ds" role="radiogroup"></div>' +
      '<div class="bd-hop-nh"' + (laKt ? " hidden" : "") + '>Áp dụng</div><div class="bd-seg bd-hop-ad" role="group"' + (laKt ? " hidden" : "") + ">" +
        '<button type="button" class="hp-whtab active" data-ngay="1" aria-pressed="true">Chỉ hôm nay</button>' +
        '<button type="button" class="hp-whtab" data-ngay="0" aria-pressed="false">Từ nay về sau</button></div>' +
      "</div>" + '<div class="bd-hop-chan">' + (coNgay ? '<button type="button" class="bd-lk bd-hop-bo">Bỏ đổi hôm nay</button>' : "") + '<span class="bd-hop-bao bd-phu"></span>' +
        '<button type="button" class="hsk-nut phu bd-hop-dong">Huỷ</button><button type="button" class="hsk-nut chinh bd-hop-luu">Lưu</button></div></div>';
    veGiu(m); veGoiY(m, "");
    requestAnimationFrame(function () { datTr(m.querySelector(".bd-hop-ad")); });
    if (window.hskAnhNV) window.hskAnhNV.san(function () { if (m.classList.contains("show")) veGoiY(m, m.querySelector(".bd-hop-tim").value); });
    m.style.display = "flex"; requestAnimationFrame(function () { m.classList.add("show"); });
  }
  /* người phụ trách đang có: mỗi người 1 ô + ✕ để bỏ (bỏ hết + không thêm ai = «Chưa giao người») */
  function veGiu(m) {
    m.querySelector(".bd-hop-giu").innerHTML = m.__giu.length ? m.__giu.map(function (t, i) {
      return '<span class="bd-ng-chon">' + avatar(t) + o(t) + '<button type="button" class="bd-lk bd-bo-chon" data-i-giu="' + i + '" aria-label="Bỏ ' + esc(t) + '" title="Bỏ người này">' + SVG_X_N + '</button></span>'; }).join("")
      : '<span class="bd-do">' + CHUA_GIAO + "</span>" + (m.__goc.length ? ' <small class="bd-phu">(bỏ hết — Lưu để thôi giao, hoặc thêm người bên dưới)</small>' : "");
  }
  /* bỏ dấu để gõ «kim yen» / «Yến» đều ra */
  function khongDau(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/\s+/g, " ").trim(); }
  function veGoiY(m, q) {
    var uu = m.__uu, vao = m.__vao, dsUu = Object.keys(uu).map(function (k) { return uu[k]; }), A = window.hskAnhNV, ds = [];
    var tim = khongDau(q);
    if (!tim) ds = dsUu.slice().sort(function (a, c) { return a.thu - c.thu || (m.__soViec[chuan(a.ten)] || 0) - (m.__soViec[chuan(c.ten)] || 0) || a.ten.localeCompare(c.ten, "vi"); });
    else {
      var khop = function (x) { var t = khongDau(x.ten); return t.indexOf(tim) === 0 || t.indexOf(" " + tim) >= 0 || (x.ma && x.ma.indexOf(tim) === 0) || (x.em && x.em.indexOf(tim) === 0); };
      var gap = {};
      dsUu.forEach(function (u) { var x = { ten: u.ten, ma: "", em: "" }, d = A && A.ds().filter(function (z) { return chuan(z.ten) === chuan(u.ten); })[0]; if (d) { x.ma = d.ma; x.em = d.em; }
        if (khop(x)) { ds.push(u); gap[chuan(u.ten)] = 1; } });
      ds.sort(function (a, c) { return a.thu - c.thu; });
      (A ? A.ds() : []).forEach(function (z) { if (ds.length >= 12 || gap[chuan(z.ten)] || !khop(z)) return; gap[chuan(z.ten)] = 1; ds.push({ ten: z.ten, nhan: [], thu: 9, ma: z.ma }); });
    }
    var maCua = function (u) { if (u.ma) return u.ma; var d = A && A.ds().filter(function (z) { return chuan(z.ten) === chuan(u.ten); }); return d && d.length === 1 ? d[0].ma : ""; };
    var hop = m.querySelector(".bd-hop-ds");
    hop.innerHTML = ds.map(function (u) {
      var ma = maCua(u), v = vao[chuan(u.ten)];
      return '<label class="bd-hop-ng"><input type="radio" name="bdHopNg" value="' + esc(ma || u.ten) + '">' + avatar(u.ten) +
        '<span class="bd-hop-ten">' + o(u.ten) + (ma ? " <code>" + esc(ma) + "</code>" : "") +
          (u.nhan.filter(function (n) { return n !== "Đi làm"; }).length ? '<small class="bd-phu">' + esc(u.nhan.filter(function (n) { return n !== "Đi làm"; }).join(" · ")) + "</small>" : "") + "</span>" +
        (v ? '<span class="hsk-chip xong khongcham">Vào ' + esc(v) + "</span>" : "") + "</label>"; }).join("") +
      (!ds.length ? '<div class="bd-hop-trong bd-phu">' + (tim ? "Không tìm thấy — lưu theo tên / mã NV đã gõ." : "Gõ tên để tìm nhân viên.") + "</div>" : "");
  }
  function dongHop() { var m = $id("bdDoiHop"); if (!m) return; if (typeof window.anModalModule === "function") window.anModalModule(m); else { m.classList.remove("show"); m.style.display = "none"; } }
  function ganHop(m) {
    m.addEventListener("click", function (e) {
      if (e.target === m || e.target.closest(".bd-hop-dong")) { dongHop(); return; }
      var ad = e.target.closest(".bd-hop-ad .hp-whtab"); if (ad) { m.__ngay = ad.getAttribute("data-ngay") === "1";
        m.querySelectorAll(".bd-hop-ad .hp-whtab").forEach(function (x) { x.classList.toggle("active", x === ad); x.setAttribute("aria-pressed", String(x === ad)); });
        datTr(m.querySelector(".bd-hop-ad")); return; }
      if (e.target.closest(".bd-hop-bo")) { guiDoi(m, "he-thong", "", true); return; }
      var bg = e.target.closest("[data-i-giu]"); if (bg) { m.__giu.splice(Number(bg.getAttribute("data-i-giu")), 1); veGiu(m); return; }
      if (e.target.closest(".bd-hop-luu")) {
        var r = m.querySelector('input[name="bdHopNg"]:checked'), go = m.querySelector(".bd-hop-tim").value.trim(), moi = r ? r.value : go;
        /* người giữ lại: đổi tên → mã NV khi danh bạ có đúng 1 người trùng tên (tránh bẫy trùng tên) */
        var A = window.hskAnhNV, ma = function (t) { var d = A ? A.ds().filter(function (z) { return chuan(z.ten) === chuan(t); }) : []; return d.length === 1 ? d[0].ma : t; };
        var cuoi = m.__giu.map(ma); if (moi && cuoi.indexOf(moi) < 0) cuoi.push(moi);
        if (!moi && m.__giu.length === m.__goc.length) { m.querySelector(".bd-hop-bao").textContent = m.__goc.length ? "Chưa thay đổi — bấm ✕ để bỏ người hoặc chọn người thêm." : "Chọn hoặc gõ tên / mã NV."; return; }
        guiDoi(m, "chi-dinh", cuoi.length ? cuoi.join(", ") : "-", m.__ngay);   // «-» = chỉ định KHÔNG AI (Chưa giao người)
      }
    });
    m.addEventListener("input", function (e) { if (e.target.classList.contains("bd-hop-tim")) veGoiY(m, e.target.value); });
  }
  /* ===== THEO KHU (06/11): thao tác trong bảng + hộp chọn quản lý / phụ trách cả khu (nhiều người) ===== */
  function xuLyKhu(el) {
    var act = el.getAttribute("data-act"), khu = el.getAttribute("data-khu") || "", hm = el.getAttribute("data-hmuc") || "", bin = el.getAttribute("data-bin") || "";
    if (act === "vt") { var k = el.getAttribute("data-o"); S.moO[k] = !S.moO[k]; S.moMoi = S.moO[k] ? k : ""; S.muiDoi = k;
      /* điện thoại: mở hạng mục = 1 lớp (vuốt lùi / Esc đóng lại) */
      if (laDT() && window.hskLop) { if (S.moO[k]) window.hskLop.day("bd-hm:" + k, function () { S.moO[k] = false; veLaiNay(); }); else window.hskLop.rut("bd-hm:" + k); }
      veLaiNay(); S.moMoi = ""; S.muiDoi = ""; return; }   // chỉ ô vừa mở chạy hiệu ứng
    /* 06/11 lượt 11 điện thoại: chọn kho (đi sâu) / ‹ Tất cả kho; lớp kho ghi nấc hskLop */
    if (act === "khodt") { var kd = el.getAttribute("data-khu") || "";
      S.muiDoi = "kho|" + (kd || S.khoDT);
      if (kd) { S.khoDT = kd; S.moMoi = "kho"; if (window.hskLop) window.hskLop.day("bd-kho", function () { S.khoDT = ""; veLaiNay(); }); }
      else { S.khoDT = ""; if (window.hskLop) window.hskLop.rut("bd-kho"); }
      veLaiNay(); S.moMoi = ""; S.muiDoi = ""; var kn = $id("bdNay"); if (kn && kn.getBoundingClientRect().top < 0) kn.scrollIntoView({ block: "start" }); return; }
    if (act === "mothem") { S.themHm = true; veLaiNay(); var i0 = $id("bdThemHm"); if (i0) i0.focus(); return; }
    if (act === "huythem") { S.themHm = false; veLaiNay(); return; }
    if (act === "themhm") { var ten = hmCfg(($id("bdThemHm") || {}).value);
      if (!ten) { var i1 = $id("bdThemHm"); if (i1) { i1.focus(); i1.placeholder = "Nhập tên hạng mục"; } return; }
      S.themHm = false; guiKhu(KHU_DS.map(function (k) { return ["hm", k[0], ten, "", "co"]; }));
      if (window.hskTienIch && window.hskTienIch.toast) window.hskTienIch.toast("Đã thêm " + ten + " vào SHOP và WH. Chưa có việc: cần mã vị trí (F0-…) trong g-sheet Bảo dưỡng (cột MÃ VỊ TRÍ) và lịch planogram", "warn");
      return; }
    if (act === "them" || act === "molai") { guiKhu([["hm", khu, hm, "", "co"]]);
      if (!Object.keys(S.vt).some(function (b) { return S.vt[b].hm === hm && S.vt[b].vh.length && S.khuBin[b] === khu; }) && window.hskTienIch && window.hskTienIch.toast)
        window.hskTienIch.toast("Đã thêm " + hm + " vào " + khu + ". Chưa có việc: cần mã vị trí (F0-…) trong g-sheet Bảo dưỡng (cột MÃ VỊ TRÍ) và lịch planogram", "warn");
      return; }
    if (act === "themvt") { moThemVt(khu, hm); return; }
    if (act === "bovt") { var kv = "vt|" + bin; if (S.xacBo !== kv) { S.xacBo = kv; veLaiNay(); return; } S.xacBo = "";
      guiKhu([["vt", "SHOP", hm, bin, "khong"]]); apDungVt(); veLaiNay(); veLaiLuoi();
      if (window.hskTienIch && window.hskTienIch.toast) window.hskTienIch.toast("Đã bỏ " + bin + " khỏi Việc hôm nay — thêm lại ở dòng «Đã bỏ vị trí» cuối bảng", "ok"); return; }
    if (act === "ckvt") { var den = khu === "SHOP" ? "WH" : "SHOP"; S.khuBin[bin] = den; guiKhu([["vt", "SHOP", hm, bin, den]]); apDungVt(); veLaiNay();
      if (window.hskTienIch && window.hskTienIch.toast) window.hskTienIch.toast("Đã chuyển " + bin + " sang " + den, "ok"); return; }
    if (act === "molaivt") { guiKhu([["vt", "SHOP", hm, bin, ""]]); delete (S.boVt || {})[bin]; dungViTri(); veLaiNay(); veLaiLuoi(); return; }
    if (act === "suakho") { S.suaKho[khu] = !S.suaKho[khu]; S.xacBo = ""; veLaiNay(); veLaiBen(); return; }   // thanh bên đang mở cũng hiện / ẩn icon theo bút kho   // 07/11 hộp nhập vị trí → ghi g-sheet
    if (act === "molai2") { guiKhu(KHU_DS.filter(function (k) { return cfgGt("hm", k[0], hm) === "khong"; }).map(function (k) { return ["hm", k[0], hm, "", "co"]; })); return; }
    if (act === "bo") { var kb = khu + "|" + hm; if (S.xacBo !== kb) { S.xacBo = kb; veLaiNay(); return; } S.xacBo = ""; guiKhu([["hm", khu, hm, "", "khong"]]); return; }
    if (act === "ql" || act === "pt") moChonNguoi(act, khu, hm, bin);
    /* 06/11 lượt 6: bút đổi tên ở dòng vị trí ⇒ mở thanh bên đúng vị trí + bật sẵn ô «Tên hiển thị mới» (luồng bd_doiten có sẵn — tên mới hiện
       ở audit-dc ngay cả khi WMS / planogram chưa nhận, dòng con ghi «chờ WMS») */
    if (act === "ten" && bin) { S.moTen = bin; moBen(bin, isoVN(Date.now()));   // theTen() vẽ ô nhập MỞ SẴN khi S.moTen = bin (kể cả thanh bên vẽ lại)
      var thu = 0, cho = setInterval(function () { var o2 = document.querySelector('.bd-ten-form[data-bin="' + bin + '"] .bd-ten-o');
        if (o2 && document.activeElement !== o2) { o2.focus(); o2.select(); } if (++thu > 20 || S.moTen !== bin) clearInterval(cho); }, 150); }
  }
  /* ===== THÊM VỊ TRÍ NGAY TRÊN TRANG → GHI THẲNG G-SHEET (07/11) =====
     User 07/11: «Không có + Thêm — khi nhấn Thêm thì hiển thị mục nhập các thông tin buộc nhập, chứ không phải sang g-sheet nhập.
     Nhập ở đây thì dữ liệu g-sheet tự cập nhật». Hộp .hp-modal (hskLop tự ghi nấc vuốt lùi): Mã vị trí · Tên vị trí · Số lượng thiết bị (buộc) ·
     Tên khu vực; hạng mục đã có vị trí ⇒ «Làm như vị trí» (đầu việc Vận hành chép theo vị trí mẫu); hạng mục chưa có đầu việc ⇒ Tần suất ·
     Hạng mục kiểm tra · Nội dung công việc (buộc) · Thời gian. Lưu LẠC QUAN: vị trí hiện ngay (S.themVt), GAS bd_them_vt ghi g-sheet ở nền,
     lỗi ⇒ gỡ lại + báo. Nhật ký BAO-DUONG-THEM-VT giữ KHU của vị trí khi chưa có lịch planogram. */
  var TS_THEM = ["Hàng ngày", "Hàng tuần", "Hàng tháng", "3 tháng/lần", "6 tháng/lần"];
  function dongThem() { var m = $id("bdThemHop"); if (!m) return; if (typeof window.anModalModule === "function") window.anModalModule(m); else { m.classList.remove("show"); m.style.display = "none"; } }
  function moThemVt(khu, hm) {
    var m = $id("bdThemHop");
    if (!m) { m = document.createElement("div"); m.id = "bdThemHop"; m.className = "hp-modal"; document.body.appendChild(m); ganThem(m); }
    m.__khu = khu; m.__hm = hm;
    var o1 = O1_THEM, buoc = BUOC_THEM;
    var dsHmCo = Object.keys(S.vt).map(function (b) { return S.vt[b].hm; }).filter(function (x, i, a) { return x && a.indexOf(x) === i; }).sort(function (a, c) { return a.localeCompare(c, "vi"); });
    m.innerHTML = '<div class="hp-modalbox" role="dialog" aria-modal="true" aria-label="Thêm vị trí ' + esc(hm) + " ở " + khu + '"><div class="hp-modalhd"><div class="mt">' + (hm ? "Thêm vị trí · " + o(tHm(hm)) : "Thêm hạng mục") + " · " + khu +
      '</div><button type="button" class="hsk-nut phu nho bd-hop-dong">Đóng</button></div><div class="hp-modalbody bd-them-than">' +
      /* 07/11 user (video): ô Hạng mục là danh sách xổ của TRÌNH DUYỆT (datalist) — không chuyển động, sai luật ô chọn ⇒ ô chọn thư viện
         (enhanceSelect: mở xuống + popIn + ✕) có mục «＋ Hạng mục mới…» mở ô gõ tên */
      (hm ? "" : o1("Hạng mục" + buoc, "hm", '<select name="hmChon"><option value="">Chọn hạng mục</option>' + dsHmCo.map(function (x) {
          return '<option value="' + esc(x) + '">' + esc(tHm(x)) + "</option>"; }).join("") + '<option value="__moi">＋ Hạng mục mới…</option></select>' +
        '<input type="text" name="hm" maxlength="80" placeholder="Tên hạng mục mới" autocomplete="off" hidden>')) +
      '<div class="bd-ls-hang">' + o1("Mã vị trí" + buoc, "bin", '<input type="text" name="bin" maxlength="40" placeholder="F0-A18-501-01-01-01" autocomplete="off" autocapitalize="characters" spellcheck="false" required>', "rong") +
        o1("Số lượng thiết bị" + buoc, "soLuong", '<input type="number" name="soLuong" min="1" max="999" value="1" inputmode="numeric" required>', "hep") + "</div>" +
      o1("Tên vị trí" + buoc, "ten", '<input type="text" name="ten" maxlength="120" placeholder="Tên hiển thị của vị trí" autocomplete="off" required>') +
      /* 07/11 user «bổ sung trường chọn khu vực từ A1 đến hết theo luật hiển thị khu vực ở bộ lọc có» = ô chọn Khu vực của Planogram («A1 | Quầy kệ») */
      o1("Khu vực", "khuVuc", '<select name="khuVuc"><option value="">Chọn khu vực</option>' + KHU_VUC.map(function (x) {
        return '<option value="' + esc(x[0] + " | " + x[1]) + '">' + esc(x[0] + " | " + x[1]) + "</option>"; }).join("") + "</select>") +
      '<div class="bd-them-duoi">' + duoiThem(hm) + "</div></div>" + '<div class="bd-hop-chan"><span class="bd-hop-bao bd-phu"></span><button type="button" class="hsk-nut phu bd-hop-dong">Huỷ</button>' +
        '<button type="button" class="hsk-nut chinh bd-them-luu">Lưu vào g-sheet</button></div></div>';
    datChonThem(m); dienTheoMau(m);
    m.style.display = "flex"; requestAnimationFrame(function () { m.classList.add("show"); var i = m.querySelector('[name="bin"]'); if (i && !laDT()) i.focus(); });
  }
  /* danh mục khu vực kho 170 — cùng nguồn + cách hiện «mã | tên» với ô chọn Khu vực của Planogram (AREAS + KHU_TEN trong hasaki-planogram.js) */
  var KHU_VUC = [["A1", "Quầy kệ"], ["A2", "Kệ lưu trữ WH"], ["A3", "Kệ trữ VPP"], ["A4", "Kho VPP · tái chế giấy"], ["A5", "Bàn giao ĐVVC"],
    ["A6", "Bàn quản lý · hàng hoàn"], ["A7", "Xe soạn hàng"], ["A8", "Bàn đóng gói"], ["A9", "Đồng kiểm PO"], ["A10", "Nhà vệ sinh"], ["A11", "Hàng đổi trả · IT"],
    ["A12", "Kho Clinic"], ["A13", "Phòng họp"], ["A14", "Kiểm nhập IT Shop"], ["A15", "Xe nâng đứng"], ["A16", "Kho hành chánh"], ["A17", "Bàn Logistic"],
    ["A18", "Chờ xử lý · xe nâng ngồi"], ["A19", "Băng chuyền xuất"], ["A20", "Gia cố · đóng gói nội bộ"], ["A21", "Bảo vệ · tủ khoá"], ["A22", "Xe giao nhận nội bộ"],
    ["A23", "Bãi xe nhân viên"], ["A24", "Phòng giặt sấy"], ["A25", "Bãi xe NCC · rác ngoài kho"], ["CB", "Băng chuyền phân loại"]];
  function khuCuaMa(b) { var m = /^F0-([A-Z]{1,2})0*(\d{0,2})-/i.exec(String(b || "")); if (!m) return ""; var k = (m[1] + m[2]).toUpperCase();
    var x = KHU_VUC.filter(function (z) { return z[0] === k; })[0]; return x ? x[0] + " | " + x[1] : ""; }
  /* đặt giá trị ô chọn thư viện (enhanceSelect) + đồng bộ phần hiển thị */
  function datChon(sel, v) { if (!sel) return; sel.value = v; if (sel._csWrap && typeof sel._csWrap._csDongBo === "function") sel._csWrap._csDongBo(); }
  /* 07/11 user «chọn Làm như vị trí xxx thì Mã vị trí / Tên vị trí tự điền đúng như vị trí được chọn (cho sửa theo ý)» */
  function dienTheoMau(m) {
    var s0 = m.querySelector('[name="mau"]'); if (!s0 || !s0.value) return; var v = S.vt[s0.value] || {};
    var ma = m.querySelector('[name="bin"]'), ten = m.querySelector('[name="ten"]');
    if (ma) ma.value = s0.value; if (ten) ten.value = String(v.ten || "").split("|").pop().trim();
    var kv = khuCuaMa(s0.value), kvS = m.querySelector('[name="khuVuc"]'); if (kv && kvS) { datChon(kvS, kv); kvS.__tu = 1; }
    m.querySelectorAll(".bd-them-loi").forEach(function (c) { c.textContent = ""; });
  }
  var BUOC_THEM = ' <b class="bd-do" aria-hidden="true">*</b>';
  function O1_THEM(nhan, ten, the, phu) { return '<label class="bd-ls-o' + (phu ? " " + phu : "") + '"><span>' + nhan + "</span>" + the + '<small class="bd-them-loi" data-cho="' + ten + '"></small></label>'; }
  /* phần dưới hộp Thêm: hạng mục đã có vị trí ⇒ «Làm như vị trí»; chưa có đầu việc ⇒ tần suất · hạng mục kiểm tra · nội dung */
  function duoiThem(hm) {
    var o1 = O1_THEM, buoc = BUOC_THEM, k = chuan(hm);
    var mau = Object.keys(S.vt).filter(function (b) { return chuan(S.vt[b].hm) === k && S.vt[b].vh.length; })
      .sort(function (a, c) { return S.vt[c].vh.length - S.vt[a].vh.length || a.localeCompare(c); });
    return mau.length ? o1("Làm như vị trí" + buoc, "mau", '<select name="mau">' + mau.map(function (b) { var v = S.vt[b];
        return '<option value="' + esc(b) + '">' + esc(String(v.ten || b).split("|").pop().trim() || b) + " · " + esc(b) + " · " + v.vh.length + " đầu việc</option>"; }).join("") + "</select>")
      : '<div class="bd-ls-hang">' + o1("Tần suất" + buoc, "ts", '<select name="ts">' + TS_THEM.map(function (t) { return "<option>" + t + "</option>"; }).join("") + "</select>") +
        o1("Thời gian", "tg", '<input type="text" name="tg" maxlength="40" placeholder="5 phút" autocomplete="off">', "hep") + "</div>" +
        o1("Hạng mục kiểm tra" + buoc, "kt", '<input type="text" name="kt" maxlength="200" placeholder="Kiểm tra ngoại quan" autocomplete="off" required>') +
        o1("Nội dung công việc" + buoc, "nd", '<textarea name="nd" rows="3" maxlength="500" placeholder="Làm gì, kiểm tra gì" required></textarea>');
  }
  /* ô chọn trong hộp Thêm = ô chọn thư viện (luật 17/10 «ô chọn mở xuống + popIn + ✕») */
  function datChonThem(m) { if (typeof window.enhanceSelect !== "function") return;
    m.querySelectorAll("select").forEach(function (x) { if (x.__es) return; x.__es = 1; try { window.enhanceSelect(x); } catch (er) {} }); }
  function chonHm(m, sel) {
    var oh = m.querySelector('[name="hm"]'), moiHm = sel.value === "__moi"; if (oh.__v === sel.value) return; oh.__v = sel.value;
    oh.hidden = !moiHm; oh.value = moiHm ? "" : sel.value; if (moiHm) oh.focus();
    var du2 = m.querySelector(".bd-them-duoi"); if (du2) { du2.__k = chuan(oh.value); du2.innerHTML = duoiThem(oh.value); datChonThem(m); dienTheoMau(m); }
  }
  function ganThem(m) {
    m.addEventListener("click", function (e) {
      if (e.target === m || e.target.closest(".bd-hop-dong")) { dongThem(); return; }
      if (e.target.closest(".bd-them-luu")) luuThem(m);
    });
    m.addEventListener("input", function (e) {
      if (e.target.name === "hmChon") { chonHm(m, e.target); return; }
      if (e.target.name === "hm") { var du = m.querySelector(".bd-them-duoi"), moiD = duoiThem(e.target.value.trim()); if (du && du.__k !== chuan(e.target.value)) { du.__k = chuan(e.target.value); du.innerHTML = moiD; datChonThem(m); } }
      if (e.target.name === "bin") { var kvS = m.querySelector('[name="khuVuc"]'), kv0 = khuCuaMa(e.target.value.toUpperCase());
        if (kvS && kv0 && (!kvS.value || kvS.__tu)) { datChon(kvS, kv0); kvS.__tu = 1; } }   // gõ mã ⇒ tự chọn khu vực theo mã (chưa ai chọn tay)
      if (e.target.name === "bin") { var p = e.target.selectionStart; e.target.value = e.target.value.toUpperCase().replace(/\s+/g, ""); try { e.target.setSelectionRange(p, p); } catch (er) {} }
      var c = m.querySelector('.bd-them-loi[data-cho="' + e.target.name + '"]'); if (c) c.textContent = "";
      e.target.removeAttribute("aria-invalid");
    });
    m.addEventListener("change", function (e) { if (e.target.name === "hmChon") chonHm(m, e.target); if (e.target.name === "mau") dienTheoMau(m); if (e.target.name === "khuVuc") e.target.__tu = 0; });
    m.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); luuThem(m); } });
  }
  function luuThem(m) {
    var g = function (n) { var x = m.querySelector('[name="' + n + '"]'); return x ? String(x.value || "").trim() : ""; };
    var d = { bin: g("bin").toUpperCase(), ten: g("ten"), soLuong: g("soLuong"), khuVuc: g("khuVuc"), mau: g("mau") };
    var hmG = m.__hm || hmCfg(g("hm")), coMau = !!m.querySelector('[name="mau"]');
    var dv = coMau ? null : { ts: g("ts"), kt: g("kt"), nd: g("nd"), tg: g("tg") };
    var loi = {};
    if (!hmG) loi.hm = "Nhập hoặc chọn hạng mục";
    else { var hmCo = Object.keys(S.vt).map(function (b) { return S.vt[b].hm; }).filter(function (x) { return chuan(x) === chuan(hmG); })[0]; if (hmCo) hmG = hmCo; }
    if (!d.bin) loi.bin = "Nhập mã vị trí"; else if (!/^F0-[A-Z0-9]+(-[A-Z0-9]+){1,6}$/.test(d.bin)) loi.bin = "Mã dạng F0-…, ví dụ F0-A18-501-01-01-01";
    else if (S.vt[d.bin] && S.vt[d.bin].hm === hmG) loi.bin = d.bin + " đã có trong " + hmG;
    if (!d.ten) loi.ten = "Nhập tên vị trí";
    if (!(Number(d.soLuong) >= 1)) loi.soLuong = "Từ 1 trở lên";
    if (dv) { if (!dv.kt) loi.kt = "Nhập hạng mục kiểm tra"; if (!dv.nd) loi.nd = "Nhập nội dung công việc"; }
    m.querySelectorAll(".bd-them-loi").forEach(function (c) { var k = c.getAttribute("data-cho"); c.textContent = loi[k] || "";
      var i = m.querySelector('[name="' + k + '"]'); if (i) { if (loi[k]) i.setAttribute("aria-invalid", "true"); else i.removeAttribute("aria-invalid"); } });
    var dau = Object.keys(loi)[0]; if (dau) { var f = m.querySelector('[name="' + dau + '"]'); if (f) f.focus(); return; }
    var khu = m.__khu, hm = hmG, toast = function (t, l) { if (window.hskTienIch && window.hskTienIch.toast) window.hskTienIch.toast(t, l); };
    var dong = { "MÃ VỊ TRÍ": d.bin, "HẠNG MỤC": hm, "KHU": khu, "TÊN VỊ TRÍ": d.ten, "SỐ LƯỢNG": d.soLuong, "TÊN KHU VỰC": d.khuVuc, "VỊ TRÍ MẪU": d.mau, "CHỜ": 1, "_dv": dv };
    S.themVt.push(dong);
    if (cfgGt("hm", khu, hm) === "khong") guiKhu([["hm", khu, hm, "", "co"]]);   // kho từng «bỏ» hạng mục này ⇒ thêm vị trí = dùng lại
    dongThem(); dungViTri(); veLaiNay(); veLaiLuoi();
    fetch(APPSCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "bd_them_vt", phien: phien(), khu: khu, hm: hm, bin: d.bin, ten: d.ten, soLuong: d.soLuong, khuVuc: d.khuVuc, mau: d.mau, dauViec: dv }), redirect: "follow" })
      .then(function (r) { return r.json(); }).then(function (j) {
        if (!j || j.status !== "success") throw new Error((j && j.message) || "máy chủ không trả lời");
        delete dong["CHỜ"]; toast("Đã ghi " + d.bin + " vào g-sheet (dòng " + j.soDong + ")", "ok");
      }).catch(function (e) {
        S.themVt = S.themVt.filter(function (x) { return x !== dong; }); dungViTri(); veLaiNay(); veLaiLuoi();
        toast("Chưa ghi được " + d.bin + " vào g-sheet — đã gỡ lại: " + e.message, "loi");
      });
  }

  /* lưu tuần tự [loai, khu, hm, bin, giaTri] → GAS bd_khu; cập nhật S.cfg theo khoá máy chủ trả về */
  /* 06/11 lượt 4 user «Đang lưu… quá lâu, ép < 1 s ngay lập tức»: GAS trả lời 2–6 s ⇒ LƯU LẠC QUAN — áp S.cfg + vẽ lại NGAY (cả 3 chế độ xem
     đọc chung S.cfg nên đổi cùng lúc), gửi máy chủ ở NỀN tuần tự; lỗi ⇒ hoàn lại giá trị cũ + vẽ lại + báo. Trả về true ngay (đóng hộp liền). */
  var hangGui = Promise.resolve();
  function guiKhu(ds) {
    var cu = ds.map(function (x) { var k = khoaCfg(x[0], x[1], x[2], x[3]); return [k, S.cfg[k]]; });
    ds.forEach(function (x) { var k = khoaCfg(x[0], x[1], x[2], x[3]);
      if (x[4]) S.cfg[k] = { "KHOÁ": k, "LOẠI": x[0], "KHU": x[1], "HẠNG MỤC": hmCfg(x[2]), "MÃ VỊ TRÍ": k.split("|")[3], "GIÁ TRỊ": x[4], "CHỜ": 1 }; else delete S.cfg[k]; });
    veLaiNay();
    var toast = function (m, l) { if (window.hskTienIch && window.hskTienIch.toast) window.hskTienIch.toast(m, l); };
    hangGui = hangGui.then(function () {
      return ds.reduce(function (p, x) { return p.then(function () {
        return fetch(APPSCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "bd_khu", phien: phien(), loai: x[0], khu: x[1], hm: x[2], bin: x[3], giaTri: x[4] }), redirect: "follow" })
          .then(function (r) { return r.json(); }).then(function (j) {
            if (!j || j.status !== "success") throw new Error((j && j.message) || "máy chủ không trả lời");
            if (j.dong) S.cfg[j.khoa] = { "KHOÁ": j.khoa, "LOẠI": j.dong[1], "KHU": j.dong[2], "HẠNG MỤC": j.dong[3], "MÃ VỊ TRÍ": j.dong[4], "GIÁ TRỊ": j.dong[5] }; else delete S.cfg[j.khoa]; }); }); }, Promise.resolve());
    }).catch(function (e) {
      cu.forEach(function (c) { if (c[1]) S.cfg[c[0]] = c[1]; else delete S.cfg[c[0]]; });
      veLaiNay(); toast("Chưa lưu được — đã hoàn lại: " + e.message, "loi");
    });
    return Promise.resolve(true);
  }
  function moChonNguoi(loai, khu, hm, bin) {
    var cu = tachDs(loai === "pt" ? cfgGt("pt", khu, hm) : cfgGt("ql", khu, hm, bin)), ke = loai === "ql" ? qlCua(khu, hm, bin) : null;
    var tieuDe = (loai === "pt" ? "Phụ trách cả kho" : "Quản lý") + " · " + (bin ? bin : [hm, khu].filter(Boolean).join(" · "));
    var m = $id("bdChonHop");
    if (!m) { m = document.createElement("div"); m.id = "bdChonHop"; m.className = "hp-modal"; document.body.appendChild(m); ganChon(m); }
    m.__chon = cu.slice(); m.__viec = [loai, khu, hm, bin]; m.__vao = duLieuNay().vao;
    m.innerHTML = '<div class="hp-modalbox" role="dialog" aria-modal="true" aria-label="' + esc(tieuDe) + '"><div class="hp-modalhd"><div class="mt">' + esc(tieuDe) +
      '</div><button type="button" class="hsk-nut phu nho bd-hop-dong">Đóng</button></div><div class="hp-modalbody">' +
      '<div class="bd-phu bd-chon-mt">' + (loai === "pt" ? "Mọi vị trí " + o(tHm(hm)) + " ở " + khu + " giao cho người dưới đây (gom cả kho). Vị trí đã chỉ định riêng giữ nguyên."
        : "Quản lý cấp " + (bin ? "vị trí" : hm ? "hạng mục" : "kho") + " — cấp gần nhất thắng (vị trí › hạng mục › kho)." +
          (ke && ke.ds.length && !cu.length ? " Đang theo " + ke.cap + ": " + ke.ds.map(function (x) { return o(tenNV(x)); }).join(", ") + "." : "")) + "</div>" +
      '<div class="bd-hop-nh">Đã chọn</div><div class="bd-chon-ds"></div>' +
      '<div class="bd-hop-nh">Thêm người</div><input type="search" class="bd-hop-tim" maxlength="80" placeholder="Gõ tên, mã NV hoặc email" autocomplete="off" enterkeyhint="search">' +
      '<div class="bd-hop-ds"></div></div><div class="bd-hop-chan"><button type="button" class="bd-lk bd-chon-xoa">Xoá hết</button><span class="bd-hop-bao bd-phu"></span>' +
      '<button type="button" class="hsk-nut phu bd-hop-dong">Huỷ</button><button type="button" class="hsk-nut chinh bd-chon-luu">Lưu</button></div></div>';
    veChon(m, "");
    if (window.hskAnhNV) window.hskAnhNV.san(function () { if (m.classList.contains("show")) veChon(m, m.querySelector(".bd-hop-tim").value); });
    m.style.display = "flex"; requestAnimationFrame(function () { m.classList.add("show"); });
  }
  function veChon(m, q) {
    m.querySelector(".bd-chon-ds").innerHTML = m.__chon.length ? m.__chon.map(function (x, i) {
      return '<span class="bd-ng-chon">' + avatar(tenNV(x)) + o(tenNV(x)) + '<button type="button" class="bd-lk bd-bo-chon" data-i-bo="' + i + '" aria-label="Bỏ ' + esc(tenNV(x)) + '">' + SVG_X_N + '</button></span>'; }).join("")
      : '<span class="bd-phu">Chưa có ai</span>';
    var A = window.hskAnhNV, tim = khongDau(q), co = {}, ds = [];
    m.__chon.forEach(function (x) { co[x] = 1; co[chuan(tenNV(x))] = 1; });
    var them = function (z) { if (ds.length >= 12 || co[z.ma] || co[chuan(z.ten)]) return; co[chuan(z.ten)] = 1; ds.push(z); };
    if (!tim) Object.keys(m.__vao).forEach(function (k) { if (!m.__vao[k] || !A) return; var d = A.ds().filter(function (z) { return chuan(z.ten) === k; }); if (d.length === 1) them(d[0]); });
    else (A ? A.ds() : []).forEach(function (z) { var t = khongDau(z.ten); if (t.indexOf(tim) === 0 || t.indexOf(" " + tim) >= 0 || (z.ma && z.ma.indexOf(tim) === 0) || (z.em && z.em.indexOf(tim) === 0)) them(z); });
    m.querySelector(".bd-hop-ds").innerHTML = ds.map(function (z) { var v = m.__vao[chuan(z.ten)];
      return '<label class="bd-hop-ng"><input type="checkbox" class="bd-chon-ck" value="' + esc(z.ma || z.ten) + '">' + avatar(z.ten) + '<span class="bd-hop-ten">' + o(z.ten) + (z.ma ? " <code>" + esc(z.ma) + "</code>" : "") + "</span>" +
        (v ? '<span class="hsk-chip xong khongcham">Vào ' + esc(v) + "</span>" : "") + "</label>"; }).join("") +
      (!ds.length ? '<div class="bd-hop-trong bd-phu">' + (tim ? "Không tìm thấy trong danh bạ." : "Gõ tên để tìm nhân viên.") + "</div>" : "");
  }
  function dongChon() { var m = $id("bdChonHop"); if (!m) return; if (typeof window.anModalModule === "function") window.anModalModule(m); else { m.classList.remove("show"); m.style.display = "none"; } }
  function ganChon(m) {
    m.addEventListener("click", function (e) {
      if (e.target === m || e.target.closest(".bd-hop-dong")) { dongChon(); return; }
      var bo = e.target.closest("[data-i-bo]"); if (bo) { m.__chon.splice(Number(bo.getAttribute("data-i-bo")), 1); veChon(m, m.querySelector(".bd-hop-tim").value); return; }
      var xoa = e.target.closest(".bd-chon-xoa"), luu = e.target.closest(".bd-chon-luu");
      if (xoa || luu) { var v = m.__viec; dongChon();
        guiKhu([[v[0], v[1], v[2], v[3], xoa ? "" : m.__chon.join(", ")]]); }
    });
    m.addEventListener("input", function (e) { if (e.target.classList.contains("bd-hop-tim")) veChon(m, e.target.value); });
    m.addEventListener("change", function (e) { var ck = e.target.closest(".bd-chon-ck"); if (!ck || !ck.checked) return;
      m.__chon.push(ck.value); var t = m.querySelector(".bd-hop-tim"); t.value = ""; veChon(m, ""); t.focus(); });
  }
  /* lưu tuần tự từng vị trí (bd_giao — khoá chỉ hôm nay = …|ngày) */
  function guiDoi(m, cheDo, ten, ngay) {
    var hang = [];
    /* «Từ nay về sau» khi vị trí đang có dòng «chỉ hôm nay» ⇒ gỡ luôn dòng ngày (nếu không dòng ngày vẫn thắng) */
    var nhom = m.__nhom || "VẬN HÀNH"; if (nhom !== "VẬN HÀNH") ngay = false;
    m.__bins.forEach(function (b) { hang.push({ b: b, khoa: ngay ? khoaNay(b) : khoaGiao(b, nhom), cheDo: cheDo, ten: ten, dem: 1 });
      var kn = S.giao[khoaNay(b)]; if (!ngay && kn && kn["CHẾ ĐỘ"] === "chi-dinh") hang.push({ b: b, khoa: khoaNay(b), cheDo: "he-thong", ten: "", dem: 0 }); });
    /* 06/11 lượt 4 (user «Đang lưu… quá lâu, < 1 s»): LẠC QUAN — áp S.giao + đóng hộp + vẽ lại NGAY, gửi bd_giao ở nền (chung hàng đợi với bd_khu);
       lỗi ⇒ hoàn lại dòng cũ + vẽ lại + báo. */
    var cu = hang.map(function (h) { return [h.khoa, S.giao[h.khoa], h.b, S.giaoNay[h.b] ? S.giaoNay[h.b]["NGUỒN"] : null]; }), n = m.__bins.length;
    hang.forEach(function (h) { S.giao[h.khoa] = { "KHOÁ": h.khoa, "CHẾ ĐỘ": h.cheDo, "NGUỒN": "", "CHỈ ĐỊNH": h.cheDo === "chi-dinh" ? h.ten : "", "CHỜ": 1 }; delete S.luu[h.khoa];
      if (S.giaoNay[h.b]) S.giaoNay[h.b]["NGUỒN"] = ""; });   // dòng máy cũ hết hiệu lực cho tới lượt kế
    dongHop(); S.chonVt = {}; veLaiNay(); veLaiBen();
    var toast = function (t, l) { if (window.hskTienIch && window.hskTienIch.toast) window.hskTienIch.toast(t, l); };
    toast("Đã đổi " + n + " vị trí — máy giao / chuyển task ở lượt kế", "ok");
    hangGui = hangGui.then(function () {
      return hang.reduce(function (p, h) { return p.then(function () {
        return fetch(APPSCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "bd_giao", phien: phien(), khoa: h.khoa, cheDo: h.cheDo, nguon: "", chiDinh: h.ten }), redirect: "follow" })
          .then(function (r) { return r.json(); }).then(function (j) {
            if (!j || j.status !== "success") throw new Error((j && j.message) || "Lỗi");
            var d = j.dong || []; S.giao[h.khoa] = { "KHOÁ": h.khoa, "CHẾ ĐỘ": d[1], "NGUỒN": d[2], "CHỈ ĐỊNH": d[3], "NGƯỜI LƯU": d[4], "LÚC LƯU": d[5] }; }); }); }, Promise.resolve());
    }).catch(function (e) {
      cu.forEach(function (c) { if (c[1]) S.giao[c[0]] = c[1]; else delete S.giao[c[0]]; if (c[3] != null && S.giaoNay[c[2]]) S.giaoNay[c[2]]["NGUỒN"] = c[3]; });
      veLaiNay(); toast("Chưa lưu đổi người — đã hoàn lại: " + e.message, "loi");
    });
  }

  /* ===== ĐỔI TÊN HIỂN THỊ (06/11) — mã vị trí giữ nguyên; tên mới ghi tab riêng BAO-DUONG-DOI-TEN qua bd_doiten, máy trong mạng công ty
     (bd-doi-ten.mjs, 5') sửa MÔ TẢ vị trí trên WMS ⇒ planogram + app quét đổi theo (đọc sống, kể cả yêu cầu cũ). Tên đang hiện ở tiêu đề
     thanh bên nên thẻ không nhắc lại tên — chỉ trạng thái đồng bộ + ô sửa. ===== */
  var TT_TEN = { "Chờ đẩy WMS": ["dang", "Chờ cập nhật WMS · planogram"], "Đã đổi WMS": ["xong", "Đã cập nhật WMS · planogram"], "Lỗi": ["qua", "Chưa cập nhật được WMS"] };
  /* 07/11 t4 «Tên hiển thị · Đổi tên · Tên hiển thị mới — làm gọn, hạn chế tối đa khoảng trống»: chip «Tên hiển thị» mở = 1 hàng ô nhập + Lưu + Huỷ,
     dưới là 1 dòng trạng thái. Lưu ⇒ WMS (mô tả vị trí) · planogram · app quét (đọc sống từ WMS) · g-sheet kế hoạch (GAS bdGsDoiTen_) cùng đổi. */
  function mucTen(b) {
    var r = (S.doiTen || {})[b], sua = suaBen(b); if (!r && !sua) return null;
    var tt = r && TT_TEN[r["TRẠNG THÁI"]], tenNay = String((S.vt[b] || {}).ten || "").split("|").pop().trim();
    var than = (sua ? '<div class="bd-ls-form bd-ten-form" data-bin="' + esc(b) + '"><div class="bd-ten-hang"><input type="text" class="bd-ten-o" maxlength="120" autocomplete="off" enterkeyhint="done"' +
        ' aria-label="Tên hiển thị mới" placeholder="Tên hiển thị mới" value="' + esc(tenNay) + '"><button type="button" class="hsk-nut chinh nho bd-ten-luu">Lưu</button>' +
        '<button type="button" class="hsk-nut phu nho bd-ten-bo">Huỷ</button></div><span class="bd-dl bd-ten-bao"></span></div>' : "") +
      '<div class="bd-ten-tt">' + (tt ? '<span class="hsk-chip ' + tt[0] + ' khongcham">' + tt[1] + "</span>" : "") +
        '<span class="hp-hint">' + (r ? (r["TÊN CŨ"] ? "trước: " + o(r["TÊN CŨ"]) + " · " : "") + o(r["NGƯỜI ĐỔI"]) + " " + esc(r["LÚC ĐỔI"]) : "Mã giữ nguyên · đổi cả WMS, planogram, app quét, g-sheet") + "</span>" +
        (r && r["TRẠNG THÁI"] === "Lỗi" && r["GHI CHÚ"] ? '<span class="hp-hint bd-do">' + o(r["GHI CHÚ"]) + "</span>" : "") + "</div>";
    return { k: "ten", n: "Tên hiển thị", t: tt ? (r["TRẠNG THÁI"] === "Đã đổi WMS" ? "Đã đổi" : r["TRẠNG THÁI"] === "Lỗi" ? "Lỗi WMS" : "Chờ WMS") : sua ? "Đổi tên" : "", than: than };
  }
  function theTen(b) {
    var r = (S.doiTen || {})[b], sua = duocSua(); if (!r && !sua) return "";
    var tt = r && TT_TEN[r["TRẠNG THÁI"]];
    var dong = r ? '<div class="ln">' + (tt ? '<span class="hsk-chip ' + tt[0] + ' khongcham">' + tt[1] + "</span> " : "") +
        '<span class="hp-hint">' + (r["TÊN CŨ"] ? "trước: " + o(r["TÊN CŨ"]) + " · " : "") + o(r["NGƯỜI ĐỔI"]) + " " + esc(r["LÚC ĐỔI"]) + "</span>" +
        (r["TRẠNG THÁI"] === "Lỗi" && r["GHI CHÚ"] ? '<div class="hp-hint bd-do">' + o(r["GHI CHÚ"]) + "</div>" : "") + "</div>"
      : '<div class="ln mut">Mã vị trí giữ nguyên — tên mới hiện ở đây, WMS, planogram và app quét.</div>';
    var moS = S.moTen === b, tenNay = String((S.vt[b] || {}).ten || "").split("|").pop().trim();
    var form = sua ? '<div class="bd-ls-form bd-ten-form" data-bin="' + esc(b) + '"' + (moS ? "" : " hidden") + '><label class="bd-ls-o"><span>Tên hiển thị mới</span>' +
      '<input type="text" class="bd-ten-o" maxlength="120" autocomplete="off" enterkeyhint="done"' + (moS ? ' value="' + esc(tenNay) + '"' : "") + "></label>" +
      '<div class="bd-ls-hang"><button type="button" class="hsk-nut chinh bd-ten-luu">Lưu</button><button type="button" class="hsk-nut phu bd-ten-bo">Đóng</button><span class="bd-dl bd-ten-bao"></span></div></div>' : "";
    return '<div class="hp-vtcard bd-ten" data-bin="' + esc(b) + '"><div class="hd bd-ls-hd"><span>Tên hiển thị</span>' +
      (sua ? '<button type="button" class="hsk-nut phu nho bd-ten-doi">Đổi tên</button>' : "") + "</div>" + form + dong + "</div>";
  }
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" || !e.target.classList || !e.target.classList.contains("bd-ten-o")) return;
    e.preventDefault(); var f = e.target.closest(".bd-ten-form"), n = f && f.querySelector(".bd-ten-luu"); if (n) luuTen(n); });
  function luuTen(nut) {
    var f = nut.closest(".bd-ten-form"), b = f.getAttribute("data-bin"), bao = f.querySelector(".bd-ten-bao"), o1 = f.querySelector(".bd-ten-o");
    var ten = o1.value.replace(/\s+/g, " ").trim(), v = S.vt[b] || {}, cu = String(v.ten || "").split("|").pop().trim();
    if (!ten) { bao.textContent = "Nhập tên mới."; o1.focus(); return; }
    if (ten.indexOf("|") >= 0) { bao.textContent = "Tên không được chứa dấu |"; o1.focus(); return; }
    if (ten === cu) { f.hidden = true; return; }
    nut.disabled = true; bao.textContent = "Đang lưu…";
    fetch(APPSCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "bd_doiten", phien: phien(), bin: b, ten: ten, tenCu: String(v.tenGs || v.ten || "").split("|").pop().trim() }), redirect: "follow" })
      .then(function (r) { return r.json(); }).then(function (j) {
        if (j.status !== "success") throw new Error(j.message || "Lỗi");
        var d = j.dong || [], hd = ["MÃ VỊ TRÍ", "TÊN MỚI", "TÊN CŨ", "TRẠNG THÁI", "NGƯỜI ĐỔI", "LÚC ĐỔI", "LÚC ĐẨY WMS", "GHI CHÚ"], dong = {};
        hd.forEach(function (h, i) { dong[h] = d[i] == null ? "" : String(d[i]); });
        (S.doiTen = S.doiTen || {})[b] = dong; f.hidden = true; S.moTen = ""; S.chipMo = "";
        dungViTri(); veLaiLuoi(); veLaiNay(); veLaiBen();
        var m = $id("hpVtModal"), ph = $id("hpVtSub"); if (m && m.dataset.chu === "bd" && S.chon === b && ph) ph.textContent = ten + " · " + thuCua(S.chonNgay) + " " + dm(S.chonNgay);
        var gsC = j.gs ? " · g-sheet đã đổi " + j.gs + " ô" : j.gsLoi ? " · g-sheet chưa đổi: " + j.gsLoi : "";
        if (window.hskTienIch && window.hskTienIch.toast) window.hskTienIch.toast("Đã lưu tên" + gsC + " — WMS · planogram cập nhật trong vài phút", j.gsLoi ? "warn" : "ok");
      }).catch(function (e) { nut.disabled = false; bao.textContent = "Chưa lưu được: " + e.message; });
  }

  /* ===== LỊCH SỬ THIẾT BỊ — hư hỏng · sửa chữa · nâng cấp · thay thế vật tư (29/10, tab riêng BAO-DUONG-LICHSU, ghi qua bd_ls) ===== */
  var LOAI_LS = [["Hư hỏng", "ls-hh"], ["Sửa chữa", "ls-sc"], ["Nâng cấp", "ls-nc"], ["Thay thế vật tư", "ls-vt"]];
  var lopLs = function (loai) { var x = LOAI_LS.filter(function (l) { return l[0] === loai; })[0]; return x ? x[1] : "ls-sc"; };
  function soNgay(a, b) { return a && b ? Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5) : 0; }
  function lsCua(b) { return (S.ls || []).filter(function (r) { return r["MÃ VỊ TRÍ"] === b && r["TRẠNG THÁI"] !== "Đã huỷ"; })
    .sort(function (a, c) { return String(c["NGÀY"]).localeCompare(String(a["NGÀY"])) || String(c["LÚC GHI"]).localeCompare(String(a["LÚC GHI"])); }); }
  function lsMo() { return (S.ls || []).filter(function (r) { return r["LOẠI"] === "Hư hỏng" && r["TRẠNG THÁI"] === "Đang xử lý" && S.vt[r["MÃ VỊ TRÍ"]]; })
    .sort(function (a, c) { return String(a["NGÀY"]).localeCompare(String(c["NGÀY"])); }); }
  var tien = function (x) { var n = Number(x); return n ? n.toLocaleString("vi-VN") + " đ" : ""; };
  function theLichSu(b) {
    var ds = lsCua(b), homNay = isoVN(Date.now()), sua = suaBen(b);
    var dong = ds.map(function (r) {
      var mo = r["LOẠI"] === "Hư hỏng" && r["TRẠNG THÁI"] === "Đang xử lý", dx = r["NGÀY XONG"];
      var khi = dm(r["NGÀY"]) + (mo ? ' · <span class="bd-do">đang hỏng ' + Math.max(0, soNgay(r["NGÀY"], homNay)) + " ngày</span>" : dx && dx !== r["NGÀY"] ? " → " + dm(dx) + " · " + soNgay(r["NGÀY"], dx) + " ngày" : "");
      var vt = [r["VẬT TƯ"], r["SỐ LƯỢNG"] ? r["SỐ LƯỢNG"] + (r["ĐƠN VỊ"] ? " " + r["ĐƠN VỊ"] : "") : "", tien(r["CHI PHÍ"])].filter(Boolean).join(" · ");
      return '<div class="bd-ls-dong"><span class="bd-ls-loai ' + lopLs(r["LOẠI"]) + '">' + esc(r["LOẠI"]) + '</span><div class="bd-ls-than"><b>' + o(r["MÔ TẢ"]) + "</b>" +
        '<span class="bd-phu">' + khi + "</span>" + (vt ? '<span class="bd-phu">Vật tư: ' + o(vt) + "</span>" : "") +
        '<span class="bd-phu">' + (r["NGƯỜI THỰC HIỆN"] ? o(r["NGƯỜI THỰC HIỆN"]) + " · " : "") + "ghi bởi " + o(r["NGƯỜI GHI"]) + "</span>" +
        (sua ? '<span class="bd-ls-nut">' + (mo ? '<button type="button" class="hsk-nut phu nho bd-ls-xong" data-id="' + esc(r["ID"]) + '">Đã khắc phục</button>' : "") +
          '<button type="button" class="hsk-nut phu nho bd-ls-huy" data-id="' + esc(r["ID"]) + '">Huỷ dòng</button></span>' : "") + "</div></div>";
    }).join("");
    var form = sua ? '<div class="bd-ls-form" data-bin="' + esc(b) + '" hidden>' +
      '<div class="bd-ls-hang"><label class="bd-ls-o"><span>Loại</span><select class="bd-ls-loai-chon">' + LOAI_LS.map(function (l) { return "<option>" + l[0] + "</option>"; }).join("") + "</select></label>" +
        '<div class="bd-ls-o"><span>Ngày</span><div class="bd-ls-ngay"></div></div></div>' +
      '<label class="bd-ls-o"><span>Mô tả</span><textarea class="bd-ls-mota" rows="2" maxlength="500" placeholder="Hỏng gì / sửa gì / nâng cấp gì"></textarea></label>' +
      '<div class="bd-ls-hang"><label class="bd-ls-o rong"><span>Vật tư thay</span><input type="text" class="bd-ls-vt" maxlength="200" placeholder="Tên vật tư (nếu có)"></label>' +
        '<label class="bd-ls-o hep"><span>Số lượng</span><input type="text" inputmode="decimal" class="bd-ls-sl" maxlength="12"></label>' +
        '<label class="bd-ls-o hep"><span>Đơn vị</span><input type="text" class="bd-ls-dvt" maxlength="20" placeholder="cái"></label></div>' +
      '<div class="bd-ls-hang"><label class="bd-ls-o"><span>Chi phí (đ)</span><input type="text" inputmode="numeric" class="bd-ls-cp" maxlength="15"></label>' +
        '<label class="bd-ls-o rong"><span>Người thực hiện</span><input type="text" class="bd-ls-ai" maxlength="120" placeholder="Tên / đơn vị sửa"></label></div>' +
      '<div class="bd-ls-hang"><button type="button" class="hsk-nut chinh bd-ls-luu">Lưu</button><button type="button" class="hsk-nut phu bd-ls-bo">Đóng</button><span class="bd-dl bd-ls-bao"></span></div></div>' : "";
    return '<div class="hp-vtcard bd-ls" data-bin="' + esc(b) + '"><div class="hd bd-ls-hd"><span>Lịch sử hư hỏng · sửa chữa <span class="hp-hint">' + (ds.length ? ds.length + " mục" : "chưa có") + "</span></span>" +
      (sua ? '<button type="button" class="bd-lk bd-ls-them bd-but-sua" title="Sửa lịch sử (thêm / bỏ dòng)" aria-label="Sửa lịch sử">' + SVG_BUT_N + "</button>" : "") + "</div>" + form +
      (dong || '<div class="ln mut">Chưa ghi hư hỏng / sửa chữa / nâng cấp / thay vật tư nào cho vị trí này.</div>') + "</div>";
  }
  /* mở form: ô Loại = enhanceSelect (luật ô chọn mở xuống), ô Ngày = taoBoLocNgay 1 ngày (luật bộ lọc ngày chuẩn), không chọn ngày tương lai */
  function moFormLs(f) {
    f.hidden = false; var homNay = isoVN(Date.now());
    var s = f.querySelector(".bd-ls-loai-chon"); if (s && !s.__da && typeof window.enhanceSelect === "function") { s.__da = 1; try { window.enhanceSelect(s); } catch (er) {} }
    var r = f.querySelector(".bd-ls-ngay");
    if (r && !r.__da && typeof window.taoBoLocNgay === "function") {
      r.__da = 1; f.dataset.ngay = homNay;
      var loc = window.taoBoLocNgay({ root: r, motNgay: true, khongRong: true, presets: [{ k: "today", lb: "Hôm nay" }, { k: "yesterday", lb: "Hôm qua" }],
        homNay: function () { return homNay; }, macDinh: function () { return [homNay, homNay]; }, chanNgay: function (iso) { return iso > homNay; },
        onApply: function (a) { f.dataset.ngay = a || homNay; } });
      loc.dat(homNay, homNay);
    }
    var m = f.querySelector(".bd-ls-mota"); if (m) m.focus();
  }
  function guiLs(goi, nut, bao) {
    nut.disabled = true; if (bao) bao.textContent = "Đang lưu…";
    goi.action = "bd_ls"; goi.phien = phien();
    return fetch(APPSCRIPT_URL, { method: "POST", body: JSON.stringify(goi), redirect: "follow" }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.status !== "success") throw new Error(j.message || "Lỗi");
      var f = nut.closest(".bd-ls-form"); if (f) f.hidden = true;   // lưu xong: đóng form để vẽ lại ra form trống
      var d = j.dong || [], hd = ["ID", "MÃ VỊ TRÍ", "HẠNG MỤC", "LOẠI", "NGÀY", "NGÀY XONG", "TRẠNG THÁI", "MÔ TẢ", "VẬT TƯ", "SỐ LƯỢNG", "ĐƠN VỊ", "CHI PHÍ", "NGƯỜI THỰC HIỆN", "NGƯỜI GHI", "LÚC GHI"];
      var dong = {}; hd.forEach(function (h, i) { dong[h] = d[i] == null ? "" : String(d[i]); });
      S.ls = (S.ls || []).filter(function (r) { return r["ID"] !== dong["ID"]; }).concat([dong]);
      veLaiLuoi(); veLaiNay(); veLaiBen();
    }).catch(function (e) { nut.disabled = false; if (bao) bao.textContent = "Chưa lưu được: " + e.message; else if (typeof window.toast === "function") window.toast("Chưa lưu được: " + e.message, "loi"); });
  }
  function luuLs(nut) {
    var f = nut.closest(".bd-ls-form"), b = f.getAttribute("data-bin"), bao = f.querySelector(".bd-ls-bao"), g = function (c) { return (f.querySelector(c) || {}).value || ""; };
    if (!g(".bd-ls-mota").trim()) { bao.textContent = "Nhập mô tả trước khi lưu."; f.querySelector(".bd-ls-mota").focus(); return; }
    guiLs({ op: "them", bin: b, hm: (S.vt[b] || {}).hm || "", loai: g(".bd-ls-loai-chon"), ngay: f.dataset.ngay || isoVN(Date.now()), moTa: g(".bd-ls-mota"),
      vatTu: g(".bd-ls-vt"), sl: g(".bd-ls-sl"), dvt: g(".bd-ls-dvt"), chiPhi: g(".bd-ls-cp"), nguoiLam: g(".bd-ls-ai") }, nut, bao);
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
      if (doi) { var h = doi.parentNode.querySelector(".bd-nhan"), mo = h.classList.toggle("mo"); doi.setAttribute("aria-expanded", mo); doi.classList.toggle("mo", mo);
        if (mo) { var s = h.querySelector(".bd-cdo"); if (s && !s.__da && typeof window.enhanceSelect === "function") { s.__da = 1; try { window.enhanceSelect(s); } catch (er) {} } } return; }
      var luu = e.target.closest(".bd-luu"); if (luu) { luuGiao(luu); return; }
      var d1b = e.target.closest(".bd-doi1[data-bin]"); if (d1b) { moDoiNguoi([d1b.getAttribute("data-bin")], d1b.getAttribute("data-nhom")); return; }   // thanh bên: cùng hộp Đổi người như mục con
      var dt = e.target.closest(".bd-ten-doi"); if (dt) { var ft = dt.closest(".bd-ten").querySelector(".bd-ten-form");
        if (ft.hidden) { ft.hidden = false; var oT = ft.querySelector(".bd-ten-o"); oT.value = String((S.vt[ft.getAttribute("data-bin")] || {}).ten || "").split("|").pop().trim(); oT.focus(); oT.select(); } else ft.hidden = true; return; }
      if (e.target.closest(".bd-ten-bo")) { S.moTen = ""; S.chipMo = ""; veLaiBen(); return; }
      var sk = e.target.closest('.bd-but-sua[data-act="khung"]'); if (sk) { var sid0 = sk.getAttribute("data-sid"); S.suaKhung = S.suaKhung === sid0 ? "" : sid0; S.themKhung = false; veLaiBen(); return; }
      if (e.target.closest(".bd-sk-cong")) { S.themKhung = !S.themKhung; veLaiBen(); var ti = hop.querySelector(".bd-sk-ten"); if (ti) { ti.focus(); ti.select(); } return; }
      if (e.target.closest(".bd-sk-bo")) { S.themKhung = false; veLaiBen(); return; }
      var skx = e.target.closest(".bd-sk-x"); if (skx) { var tx = skx.getAttribute("data-ten");
        if (skx.classList.contains("xn")) guiKhung(skx, "bot", tx); else { skx.classList.add("xn"); skx.title = "Bấm lần nữa để bớt «" + tx + "»"; } return; }
      var skl = e.target.closest(".bd-sk-luu"); if (skl) { var fk = skl.closest(".bd-sk-form"), tn = fk.querySelector(".bd-sk-ten").value.replace(/\s+/g, " ").trim();
        if (!tn) { fk.querySelector(".bd-sk-bao").textContent = "Nhập tên tiêu chuẩn"; return; }
        guiKhung(skl, "them", tn, fk.querySelector(".bd-sk-mt").value, fk.querySelector(".bd-sk-molai").checked); return; }
      var cp = e.target.closest(".bd-chip[data-chip]"); if (cp) { var kc = cp.getAttribute("data-chip"), dangMo = cp.classList.contains("mo");
        S.chipMo = dangMo ? "" : kc; S.moTen = !dangMo && kc === "ten" ? S.chon : ""; veLaiBen();
        if (S.moTen) { var oT2 = hop.querySelector(".bd-ten-o"); if (oT2) { oT2.focus(); oT2.select(); } }
        var lf = !dangMo && kc === "ls" && hop.querySelector(".bd-chip-than .bd-ls-form"); return; }
      var lt = e.target.closest(".bd-ten-luu"); if (lt) { luuTen(lt); return; }
      var th = e.target.closest(".bd-ls-them"); if (th) { var f = th.closest(".bd-ls").querySelector(".bd-ls-form"); if (f.hidden) moFormLs(f); else f.hidden = true; return; }
      if (e.target.closest(".bd-ls-bo")) { e.target.closest(".bd-ls-form").hidden = true; return; }
      var ll = e.target.closest(".bd-ls-luu"); if (ll) { luuLs(ll); return; }
      var lx = e.target.closest(".bd-ls-xong,.bd-ls-huy"); if (lx) { var huy = lx.classList.contains("bd-ls-huy");
        if (huy && !window.confirm("Huỷ dòng lịch sử này? (dòng vẫn giữ trong sheet, đánh dấu Đã huỷ)")) return;
        guiLs({ op: huy ? "huy" : "xong", id: lx.getAttribute("data-id") }, lx, null); return; }
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
      /* 07/11 user «xoá luôn icon g-sheet cạnh Cập nhật» */
      '</div>';
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
    S.khoang = khoangMacDinh();   // 29/10 user «có thước rồi thì 30/09 → 29/10 cần bỏ» ⇒ không còn bộ lọc ngày, luôn đủ 60 ngày
    var cuon = PANE.scrollTop;
    PANE.innerHTML = veHomNay() + veLuoi() + chanTrang();
    ganSuKien();
    PANE.scrollTop = cuon;
    if (typeof window.tqGhi === "function") window.tqGhi("bd", { dv: S.dv.length, vt: S.thuTu.length });
  }

  function xemAnhNut(a) { var y = S.yc.filter(function (r) { return String(r["REQUEST ID"]) === a.getAttribute("data-rid"); })[0]; xemAnh(y, Number(a.getAttribute("data-so")) || 0); }
  /* điền vỏ thanh bên Planogram bằng dữ liệu bảo dưỡng của 1 vị trí × 1 ngày */
  function dienBen(V, b, d) {
    var v = S.vt[b], y = ycCua(b).filter(function (r) { return r["NGÀY"] === d; })[0];
    V.tieu.innerHTML = '<span class="hp-vt-tday">' + esc(b) + '</span><span class="hp-vt-tgon">' + esc(b.replace(/^F0-/, "")) + "</span>";
    V.phu.title = ""; V.phu.textContent = (String(v.ten || "").split("|").pop().trim() || tHm(v.hm)) + " · " + thuCua(d) + " " + dm(d);
    if (S.chonKt === "1") y = null;   // mục con KT: không gắn link yêu cầu planogram (việc VH)
    /* 07/11 user «Việc định kỳ 3 tháng/lần hay Hàng ngày đem lên bên phải, ngang hàng chữ Đóng» */
    var hang1 = V.m.querySelector(".hp-vtr1"), chip = $id("bdVtKy");
    if (hang1 && !chip) { chip = document.createElement("span"); chip.id = "bdVtKy"; chip.className = "hsk-chip luu khongcham"; var dg = hang1.querySelector(".hp-mdong"); hang1.insertBefore(chip, dg || null); }
    if (chip) { var kyK = S.chonKt === "1" ? S.ky.filter(function (k) { return k["MÃ VỊ TRÍ"] === b && k["KỲ HIỆN TẠI"] && nhomCua(k["NHÓM THỰC HIỆN"]) !== "VẬN HÀNH" && nhomCua(k["NHÓM THỰC HIỆN"]) !== "CHƯA XÁC ĐỊNH"; })[0] : null;
      var yN = ycCua(b).filter(function (r) { return r["NGÀY"] === d; })[0];
      chip.textContent = kyK ? "Việc định kỳ · " + nhanTs(kyK["TẦN SUẤT"]) : yN ? (tsCuaYc(yN) ? "Định kỳ · " + nhanTs(tsCuaYc(yN)) : "Hàng ngày") : ""; chip.hidden = !chip.textContent; }
    if (y) { V.lk.style.display = ""; V.lk.href = PG_CT + encodeURIComponent(y["REQUEST ID"]); V.lk.textContent = "Yêu cầu #" + y["REQUEST ID"] + " ↗"; } else V.lk.style.display = "none";
    if (V.ghi) V.ghi.style.display = "none"; if (V.lt) V.lt.style.display = "none";   // nút Ghi nhận 5S là của Planogram
    V.than.innerHTML = veCachLam(b, d);
    if (!V.than.__bd) {   // ủy quyền 1 lần trên thân vỏ — chỉ chạy khi vỏ đang thuộc Bảo dưỡng
      V.than.__bd = 1;
      V.than.addEventListener("click", function (e) {
        if (V.m.dataset.chu !== "bd") return;
        var a = e.target.closest(".bd-anh"); if (a) { e.preventDefault(); xemAnhNut(a); return; }
        var n = e.target.closest("[data-sang]"); if (n) moBen(S.chon, n.getAttribute("data-sang"), true);
      });
      ganSua(V.than);
    }
    /* sổ tài sản nạp lười lần đầu (taisan-vitri.js) — về thì vẽ lại thẻ Tài sản */
    if (window.HPLANOGRAM && !window.TAISAN_VT) { var lan = 0, ch = setInterval(function () { if (window.TAISAN_VT || ++lan > 20) { clearInterval(ch); if (window.TAISAN_VT) veLaiBen(); } }, 500); }
  }
  /* bật/tắt thanh bên: đang mở đúng vị trí đó ⇒ đóng */
  /* 07/11 user «nhấn mục con VH mà thanh bên vẫn hiện thông tin KT bảo trì — sao chưa tách»: S.chonKt = "1" KT · "0" VH · null (từ Lịch) = cả hai */
  function batBen(b, d, kt) {
    var m = $id("hpVtModal"), loai = kt == null ? null : String(kt);
    if (m && m.classList.contains("show") && m.dataset.chu === "bd" && S.chon === b && S.chonKt === loai && window.HPLANOGRAM && window.HPLANOGRAM.closeVt) {
      window.HPLANOGRAM.closeVt(); S.chon = ""; PANE.querySelectorAll("#bdLich tr.vtr.on").forEach(function (x) { x.classList.remove("on"); }); return; }
    S.moTen = ""; S.chonKt = loai; moBen(b, d, true);
  }
  function moBen(b, d, giuLoai) {
    if (!S.vt[b]) return; if (!giuLoai) S.chonKt = null;   // mở từ Lịch / dải ngày = cả VH lẫn KT
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
    /* form Lịch sử đang mở (đang gõ) thì giữ nguyên — vẽ lại lúc sổ tài sản nạp xong từng xoá chữ người dùng đang nhập */
    var than = $id("hpVtBody"), dang = than.querySelector(".bd-ls-form:not(.bd-ten-form):not([hidden])");
    than.innerHTML = veCachLam(S.chon, S.chonNgay);
    var moi = dang && than.querySelector(".bd-ls-form:not(.bd-ten-form)"); if (moi) moi.parentNode.replaceChild(dang, moi);
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
  function veLaiLuoi() { if (thayKhung("bdLich", veLuoi())) ganLuoi(); }
  function veLaiNay() { if (thayKhung("bdNay", veHomNay())) ganNay(); }
  /* 07/11 user «hiệu ứng chuyển động đi, chuyển động lại giữa các lựa chọn đang không có — bổ sung»: viên chọn của thanh Segmented
     TRƯỢT từ lựa chọn cũ sang lựa chọn mới (kiểu Segmented antd). Khung vẽ lại ⇒ nhớ chỗ viên cũ (S.segTr) rồi trượt từ đó;
     nội dung vẫn đổi NGAY (luật 06/11 lượt 4). Giảm chuyển động (prefers-reduced-motion) ⇒ đứng yên. */
  function datTr(sg, tu) {
    if (!sg) return null;
    var t = sg.querySelector(".bd-seg-tr");
    if (!t) { t = document.createElement("i"); t.className = "bd-seg-tr"; t.setAttribute("aria-hidden", "true"); sg.insertBefore(t, sg.firstChild); sg.classList.add("co-tr"); }
    var a = sg.querySelector(".hp-whtab.active"); if (!a) { t.style.opacity = "0"; return null; }
    var moi = { x: a.offsetLeft + 2, w: a.offsetWidth - 4 };
    tu = tu || moi;   // 07/11 user «nhấn mục cha/con thì các ô khác bị giật như tải lại»: viên mới tạo từng trượt từ 0 ⇒ luôn đặt sẵn chỗ cũ
    if (!t.__da || tu.x !== moi.x || tu.w !== moi.w) {
      t.__da = 1;
      t.style.transition = "none"; t.style.transform = "translateX(" + tu.x + "px)"; t.style.width = tu.w + "px";
      void t.offsetWidth; t.style.transition = "";
    }
    t.style.transform = "translateX(" + moi.x + "px)"; t.style.width = moi.w + "px"; t.style.opacity = "";
    return moi;
  }
  function ganSuKien() { ganLuoi(); ganNay(); if (!PANE.__bdSua) { PANE.__bdSua = 1; ganSua(PANE); } }
  /* 07/11 user «mũi tên ngang = đang gập; nhấn thì xoay chỉ xuống + hiện mục con; nhấn nữa thì ẩn — phải có chuyển động»: khung vẽ lại nên
     phần vừa bấm vẽ kèm lớp .mui-cu (mũi tên ở trạng thái CŨ), 2 khung hình sau bỏ lớp ⇒ mũi tên xoay bằng transition. Dùng chung Lịch + Việc hôm nay. */
  function xoayMui(goc) { var ds = goc ? goc.querySelectorAll(".mui-cu") : []; if (!ds.length) return;
    requestAnimationFrame(function () { requestAnimationFrame(function () { [].forEach.call(ds, function (x) { x.classList.remove("mui-cu"); }); }); }); }
  function ganLuoi() {
    ganThuoc(); xoayMui($id("bdLich"));
    PANE.querySelectorAll("#bdLich tr.vtr").forEach(function (tr) {
      tr.addEventListener("click", function (e) {
        var b = tr.getAttribute("data-bin"), oNgay = e.target.closest(".bd-o[data-ngay]");
        var dN = oNgay ? oNgay.getAttribute("data-ngay") : ngayMacDinh(b);
        var laKt = !!(oNgay && oNgay.getAttribute("data-ky-task") && !ycCua(b).some(function (y) { return y["NGÀY"] === dN; }));
        batBen(b, dN, laKt ? "1" : "0");   // 07/11: thanh bên chỉ 1 loại việc (VH / KT) như mục con; bấm lại = ẩn
      });
    });
    PANE.querySelectorAll("#bdLich tr.gd").forEach(function (tr) {
      /* đảo theo trạng thái ĐANG HIỆN (lớp .mo), không theo S.moNhom — web mặc định mở mà S.moNhom chưa có ⇒ !undefined = true:
         lần bấm đầu không gập (28/10 user «mục cha cũng phải bấm vào là ẩn/hiện») */
      tr.addEventListener("click", function () { var hm0 = tr.getAttribute("data-hmuc"); S.moNhom[hm0] = !tr.classList.contains("mo"); S.muiDoi = "l|" + hm0; veLaiLuoi(); S.muiDoi = ""; });
    });
  }
  function ganNay() {
    var khung = $id("bdNay"); if (!khung) return;
    S.segTr = datTr(khung.querySelector(".bd-seg"), S.segTr) || S.segTr; xoayMui(khung);
    /* Bộ lọc (khuôn .btn-filter + .filters của thư viện, như Kiểm kê): nút mở/đóng khối lọc; ô chọn enhanceSelect (mở xuống, popIn, ✕) */
    var xoaL = khung.querySelector('[data-bl-xoa="bdNayNut"]'); if (xoaL) xoaL.addEventListener("click", function (e) { e.stopPropagation(); S.locHm = ""; S.locAi = ""; veLaiNay(); });
    var nut = $id("bdNayNut"); if (nut) nut.addEventListener("click", function () { S.moLocNay = !S.moLocNay; $id("bdNayLoc").classList.toggle("collapsed", !S.moLocNay); nut.classList.toggle("mo", S.moLocNay); });
    [["bdNayHm", "locHm"], ["bdNayAi", "locAi"]].forEach(function (x) {
      var s = $id(x[0]); if (!s) return;
      if (typeof window.enhanceSelect === "function") { try { window.enhanceSelect(s); } catch (er) {} }
      s.addEventListener("change", function () { S[x[1]] = s.value; veLaiNay(); });
    });
    /* 05/11: mọi bấm trong khung — ỦY QUYỀN 1 chỗ (khung vẽ lại khi đổi chế độ / mở người / chọn vị trí) */
    var moVt = function (r) { S.moTen = ""; moBen(r.getAttribute("data-bin"), r.getAttribute("data-ngay") || ngayNay()); };
    khung.addEventListener("click", function (e) {
      var sg = e.target.closest(".bd-seg .hp-whtab[data-che]"); if (sg) { S.cheNay = sg.getAttribute("data-che"); veLaiNay(); return; }   // 06/11 lượt 4 user «3 mục đồng bộ NGAY TỨC THÌ»: đổi chế độ không hiệu ứng
      var ka = e.target.closest(".bd-ka"); if (ka) { if (!/^(bo|bovt)$/.test(ka.getAttribute("data-act"))) S.xacBo = ""; xuLyKhu(ka); return; }   // 06/11 Theo khu
      var d1 = e.target.closest(".bd-doi1"); if (d1) { moDoiNguoi([d1.getAttribute("data-bin")]); return; }
      if (e.target.closest("#bdDoiNhieu")) { moDoiNguoi(Object.keys(S.chonVt)); return; }
      if (e.target.closest("#bdBoChon")) { S.chonVt = {}; veLaiNay(); return; }
      if (e.target.closest(".bd-ck,.bd-ck-het,.bd-chon-het,a")) return;   // ô chọn xử lý ở «change»; liên kết task giữ mặc định
      var h = e.target.closest(".bd-ngr-h"); if (h) { var t = h.parentNode.getAttribute("data-ng"); S.moNg[t] = !S.moNg[t]; S.moMoi = S.moNg[t] ? "ng:" + t : ""; veLaiNay(); S.moMoi = ""; return; }
      /* 07/11 user «nhấn vào mục con thì hiện thanh bên phải — lần nữa thì ẩn, không buộc nhấn vào tên» */
      var v = e.target.closest(".bd-kvt[data-bin],.bd-vtd[data-bin]"); if (v) { batBen(v.getAttribute("data-bin"), v.getAttribute("data-ngay") || ngayNay(), v.getAttribute("data-kt")); return; }
      var tn = e.target.closest(".bd-tn[data-bin]"); if (tn) moVt(tn);
    });
    khung.addEventListener("keydown", function (e) {
      if (e.target.id === "bdThemHm") { if (e.key === "Enter") { e.preventDefault(); var nt = khung.querySelector('.bd-ka[data-act="themhm"]'); if (nt) nt.click(); } return; }
      if (e.key !== "Enter" && e.key !== " ") return;
      var x = e.target.closest(".bd-ngr-h,.bd-vtd-ten,.bd-tn[data-bin],.bd-ko-h,.bd-kdt-kho"); if (!x) return;
      e.preventDefault(); x.click();
    });
    khung.addEventListener("change", function (e) {
      var ck = e.target.closest(".bd-ck"); if (ck) { var b = ck.getAttribute("data-bin"); if (ck.checked) S.chonVt[b] = 1; else delete S.chonVt[b]; veLaiNay(); return; }
      var het = e.target.closest(".bd-ck-het"); if (het) {
        het.closest(".bd-ngr-ds").querySelectorAll(".bd-ck").forEach(function (c) { var b = c.getAttribute("data-bin"); if (het.checked) S.chonVt[b] = 1; else delete S.chonVt[b]; });
        veLaiNay();
      }
    });
  }

  var mq = window.matchMedia("(max-width:768px)");
  var doiCo = function () { S.cuonX = null; if (S.ok && PANE && PANE.offsetParent) ve(); };
  if (mq.addEventListener) mq.addEventListener("change", doiCo); else if (mq.addListener) mq.addListener(doiCo);

  /* 07/11: anh-nv.js tải được danh bạ SAU lượt hỏng (máy khác mở trang trước khi đăng nhập / GAS chập chờn) ⇒ vẽ lại tên thật thay «NV 233135» */
  window.addEventListener("hsk-anh-nv", function () { if (S.ok && $id("bdNay")) veLaiNay(); });
  window.HBAODUONG = {
    init: function (pane) {
      PANE = pane; napCss();
      if (S.ok && Date.now() - S.lastAt < STALE_MS) { ve(); return; }
      taiDuLieu();
    },
    reload: function () { return taiDuLieu(); }
  };
})();
