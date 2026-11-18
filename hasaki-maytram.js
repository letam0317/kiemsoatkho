/* hasaki-maytram.js — tab «Máy trạm» (Kiểm soát kho · HASAKI), module LAZY như hasaki-tonbatthuong.js.
 *
 *  User 13/10/2026: «tạo 1 sub-tab Máy trạm: các PC + nhịp tim, sức khoẻ (% RAM / CPU / ổ C còn lại), công việc PC đó chạy;
 *  yêu cầu dừng hoặc tiếp tục … khi dừng thì điều phối chuyển việc sang PC khác». Tối 13/10: «chưa thấy mục Máy trạm trên điện
 *  thoại» ⇒ tách khỏi Xác minh (Xác minh chỉ mở trên máy quản lý vì có ảnh người) thành tab riêng xem được ở mọi máy.
 *
 *  2 nguồn:
 *   · Máy quản lý (có máy chủ 8591 + đã đăng nhập Xác minh): /api/may-tram (đầy đủ) + nút Dừng / Tiếp tục / Gỡ (/api/may-tram/lenh).
 *   · Máy khác (điện thoại…): Apps Script action=pcBangTb (JSONP, khoá thiết bị như readTab) — CHỈ XEM. Lệnh dừng KHÔNG mở ra
 *     ngoài vì khoá thiết bị cấp cả cho máy nhân viên.
 *  Việc mỗi PC được giao: PC tự tính bằng dieu-phoi.mjs và gửi kèm nhịp tim (viecGiao) ⇒ màn này không tự suy luật.
 *  Luật nhẹ tải: 0 lượt gọi work/wms/hr — chỉ Apps Script (Script Properties), làm mới 30 s khi tab đang mở.
 */
(function () {
  "use strict";
  var API = window.HX_API || "http://127.0.0.1:8591";   // 19/10: dongMayChu cập nhật theo hxDoMayChu (laptop hoặc đường hầm)
  var GAS = "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
  var HET_HAN_GIAY = 180;   // = hetHanPhut 3' của cai-pc/dieu-phoi.json: nhịp cũ hơn ⇒ máy coi như im
  var PANE = null, MTD = null, MT_LOI = "", DIEU_KHIEN = false, H = null;
  var TEN_VIEC = { "canh-b11": "Cò canh B1.1", "canh-xac-minh-b1": "Cò xác minh B1", "tim-bang-chung-b1": "Tìm bằng chứng B1 (phần 1)", "tim-bang-chung-b1-2": "Tìm bằng chứng B1 (phần 2)",
    "canh-bai-xe-sang": "Canh bãi xe sáng", "canh-bai-xe-chieu": "Canh bãi xe chiều", "canh-bai-xe-toi": "Canh bãi xe tối", "xac-minh-camera": "Soi camera B1 (phần 1)", "xac-minh-camera-2": "Soi camera B1 (phần 2)",
    "co-canh-planogram": "Cò canh planogram", "dong-bo-dashboard": "Đồng bộ dashboard", "packer-a8-sang": "Packer A8 sáng", "packer-a8-chieu": "Packer A8 chiều",
    "cham-cong": "Chấm công", "watchdog-ton-kho": "Canh tồn kho", "lam-tuoi-vesinh": "Làm tươi vệ sinh 15'", "xm-lop-pc": "Làm tươi Xác minh khi laptop tắt",
    "may-chu-xm-du-phong": "Máy chủ Xác minh dự phòng", "day-bao-cao-5s": "Đẩy báo cáo 5S" };   // 21/10 đánh giá: 2 chip hiện mã kỹ thuật vì thiếu tên   // 19/10 nhịp sync-poller sang PC
  var tenV = function (t) { return TEN_VIEC[t] || t; };
  var e_ = window.hskTienIch.esc;
  var phien = function () { try { return localStorage.getItem("hx-phien") || ""; } catch (e) { return ""; } };

  function napCss() {
    if (document.getElementById("mt-css")) return;
    var c = [
      /* 21/10 khối «Đêm qua máy làm gì»: 3 ô ngang hàng (web), xếp dọc (điện thoại) — màu theo token good/warn/bad */
      ".mt-dem{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}",   /* 18/11 chỉ dòng cảnh báo khi có chuyện */
      /* nhãn + nút dùng lại khuôn Xác minh (chép đúng luật để tab này đứng một mình được khi Xác minh không nạp) */
      ".hx-trong{padding:28px 18px;text-align:center;color:var(--muted)}",
      ".hx-nut{min-height:40px;border-radius:8px;border:1px solid var(--accent);background:var(--accent);color:var(--accent-text,#fff);font-weight:600;padding:0 14px;cursor:pointer}.hx-nut[disabled]{opacity:.55;cursor:not-allowed}",
      ".hx-nut.phu{background:var(--surface);color:var(--text);border-color:var(--border)}.hx-nut.phu:hover{border-color:var(--accent);color:var(--accent)}.hx-nut.nguy{color:var(--bad);border-color:color-mix(in srgb,var(--bad) 45%,var(--border))}",
      ".hx-mt{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px;align-items:start;margin-top:4px}@media(max-width:560px){.hx-mt{grid-template-columns:minmax(0,1fr)}}",
      ".hx-mt-xin{margin:4px 0 14px;border-color:color-mix(in srgb,var(--warn) 55%,var(--border))}.hx-mt-xin .ma{font-family:ui-monospace,Consolas,monospace;font-size:14px;letter-spacing:2px;color:var(--text)}",
      ".hx-mt-v{display:flex;align-items:center;gap:8px;min-height:44px;padding:6px 16px;border-top:1px solid var(--border)}.hx-mt-v .ten{flex:1;min-width:0;font-size:13.5px}.hx-mt-v .ten small{display:block;color:var(--muted);font-size:12px}",
      ".mt-dn{max-width:400px;margin:24px auto}.mt-dn form{display:flex;flex-direction:column;gap:12px;padding:16px}.mt-dn label{display:flex;flex-direction:column;gap:4px}.mt-dn input{min-height:44px;font-size:16px}",
      ".mt-st.loi{margin-top:4px;font-size:13px;padding:8px 12px;border-radius:8px;background:color-mix(in srgb,var(--bad) 10%,transparent);color:var(--bad)}",
      /* ===== 18/11 user chọn MẪU 1 «Sơ đồ phân luồng + chi tiết ngang hàng» (đã xoá 11 chỗ lặp): 3 khung — Dòng điều phối hôm nay ·
         Sơ đồ phân luồng việc → máy · Chi tiết máy đang chọn (Nhật ký | Việc). Màu Nặng / Nhẹ pha từ token theme (không mã màu cứng). */
      "#pane-maytram,.mt2-vo{--mt-nang:color-mix(in srgb,var(--accent) 55%,var(--bad));--mt-nhe:color-mix(in srgb,var(--info,var(--accent)) 45%,var(--good))}",
      ".mt2-the{background:var(--surface);border:1px solid var(--border);border-radius:8px;min-width:0}.mt2-the+.mt2-the{margin-top:14px}",
      ".mt2-td{display:flex;align-items:center;gap:12px;min-height:44px;padding:0 16px;border-bottom:1px solid var(--border)}.mt2-td>b{font-size:14px;font-weight:600}.mt2-td .phu{color:var(--muted);font-size:12px}",
      ".mt2-cg{margin-left:auto;display:flex;flex-wrap:wrap;gap:4px 12px;color:var(--muted);font-size:12px}.mt2-cg span{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}.mt2-cg i{width:12px;height:7px;border-radius:2px}",
      /* dòng điều phối: 1 hàng / máy · cột lượt bên phải là chỗ DUY NHẤT ghi số lượt */
      ".mt2-tl{padding:4px 16px 10px}.mt2-h{display:grid;grid-template-columns:150px minmax(0,1fr) 56px;align-items:center;min-height:36px;cursor:pointer;border-radius:6px}",
      ".mt2-h+.mt2-h{border-top:1px solid var(--border)}.mt2-h.dau{cursor:default;min-height:22px}.mt2-h.chon{background:color-mix(in srgb,var(--accent) 7%,var(--surface))}",
      ".mt2-ten{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;min-width:0;padding-left:4px}.mt2-ten span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".mt2-lu{text-align:right;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums;padding-right:4px}.mt2-lu b{color:var(--text);font-weight:600}",
      ".mt2-den{flex:none;width:8px;height:8px;border-radius:50%;background:var(--good)}.mt2-den.chu-y{background:var(--warn)}.mt2-den.kem{background:var(--bad)}.mt2-den.dung{background:var(--muted)}",
      ".mt2-truc{position:relative;height:20px}.mt2-truc span{position:absolute;top:3px;transform:translateX(-50%);font-size:11px;color:var(--muted);white-space:nowrap}",
      ".mt2-truc span.dau{transform:none}.mt2-truc span.cuoi{transform:translateX(-100%)}.mt2-truc span.nay{color:var(--accent-text,#fff);background:var(--bad);border-radius:8px;padding:0 6px;font-weight:600}",
      ".mt2-ray{position:relative;height:30px}.mt2-ray b.vg{position:absolute;top:0;bottom:0;width:1px;background:var(--border)}",
      ".mt2-ray i{position:absolute;border-radius:2px;min-width:3px}.mt2-ray i.n{top:16%;height:36%;background:var(--mt-nang)}.mt2-ray i.l{top:60%;height:24%;background:var(--mt-nhe)}",
      ".mt2-ray i.sap{background:transparent;border:1.3px dashed currentColor;opacity:.75}.mt2-ray i.n.sap{color:var(--mt-nang)}.mt2-ray i.l.sap{color:var(--mt-nhe)}.mt2-ray i.chay{background:var(--good)}",
      ".mt2-ray i.mo{opacity:.14}.mt2-ray i.hl{box-shadow:0 0 0 2px var(--surface),0 0 0 3.5px var(--accent);z-index:1}",
      ".mt2-ray .nay{position:absolute;top:-2px;bottom:-2px;width:2px;background:var(--bad);z-index:2;border-radius:0;min-width:0}",
      ".mt2-ray .ngu{position:absolute;top:0;bottom:0;background:color-mix(in srgb,var(--muted) 14%,transparent);border-radius:0}",
      "",
      /* sơ đồ (trái) + chi tiết máy (phải) ngang hàng — điện thoại: chi tiết thành màn riêng, tab chốt đáy */
      ".mt2-hai{display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:14px;align-items:start;margin-top:14px}.mt2-hai>.mt2-the+.mt2-the{margin-top:0}",
      ".mt2-sd{position:relative;display:grid;grid-template-columns:auto minmax(110px,1fr) 250px;padding:12px 16px 16px}",
      ".mt2-cv{display:flex;flex-direction:column;gap:6px;align-items:flex-end;position:relative;z-index:2}.mt2-cv .nhom{align-self:stretch;text-align:right;font-size:12px;font-weight:600;color:var(--muted);padding-top:6px}",
      ".mt2-jv{display:inline-flex;align-items:center;flex:none;height:28px;padding:0 10px;border-radius:6px;background:var(--surface);border:1px solid var(--border);color:var(--text);font:inherit;font-size:12.5px;white-space:nowrap;cursor:pointer}",
      ".mt2-jv.chay{border-color:var(--good);color:var(--good)}.mt2-jv.chua{border-color:color-mix(in srgb,var(--bad) 55%,var(--border));color:var(--bad)}",
      ".mt2-jv.hl{border-color:var(--accent);color:var(--accent);background:color-mix(in srgb,var(--accent) 7%,var(--surface))}.mt2-jv.mo{opacity:.5}",
      ".mt2-cm{display:flex;flex-direction:column;justify-content:space-around;gap:10px;position:relative;z-index:2}",
      ".mt2-mn{background:var(--surface2);border-radius:6px;padding:10px 12px;display:flex;flex-direction:column;gap:4px;cursor:pointer}.mt2-mn .a{display:flex;align-items:center;gap:8px;min-width:0}",
      ".mt2-mn .a b{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}.mt2-mn .a .hx-tag{margin:0 0 0 auto;flex:none}",
      ".mt2-mn>.hx-tag.dt{display:none}.mt2-mn small{color:var(--muted);font-size:12px}.mt2-mn small b{color:var(--text);font-weight:600}.mt2-mn.mo{opacity:.55}",
      ".mt2-mn.chon{background:color-mix(in srgb,var(--accent) 7%,var(--surface));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent) 45%,var(--surface))}",
      ".mt2-duong{position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none}.mt2-duong path{fill:none;stroke-width:1.5;opacity:.5}",
      ".mt2-duong .n{stroke:var(--mt-nang)}.mt2-duong .l{stroke:var(--mt-nhe)}.mt2-duong .tat{stroke:var(--muted);stroke-dasharray:3 4;opacity:.7}.mt2-duong .hl{opacity:1;stroke-width:2.4}.mt2-duong .mo{opacity:.1}",
      /* chi tiết máy */
      ".mt2-ct .mt2-td .lsb-seg{margin-left:auto;display:inline-flex}.mt2-ts{display:flex;flex-wrap:wrap;gap:4px 14px;padding:10px 16px 4px;font-size:12px;color:var(--muted)}.mt2-ts b{color:var(--text);font-weight:600}",
      ".mt2-ts b.warn{color:var(--warn)}.mt2-ts b.bad{color:var(--bad)}.mt2-ts .ly{color:var(--warn)}.mt2-ph{padding:0 16px;font-size:12px;color:var(--muted)}.mt2-ph b{color:var(--text);font-weight:600}",
      ".mt2-nk{padding:8px 16px 14px}.mt2-ev{display:grid;grid-template-columns:48px 20px minmax(0,1fr);min-height:34px}.mt2-ev .g{font-size:12px;padding-top:2px;font-variant-numeric:tabular-nums}",
      ".mt2-ev .tr{position:relative;display:flex;justify-content:center}.mt2-ev .tr::before{content:\"\";position:absolute;top:0;bottom:0;width:2px;background:var(--border)}",
      ".mt2-ev .tr i{position:relative;margin-top:5px;width:9px;height:9px;border-radius:50%;background:var(--mt-nhe);box-shadow:0 0 0 3px var(--surface)}.mt2-ev.n .tr i{background:var(--mt-nang)}",
      ".mt2-ev.sap .g,.mt2-ev.sap .nd{color:var(--muted)}.mt2-ev.sap .tr i{background:var(--surface);border:1.5px dashed var(--muted)}.mt2-ev.chay .tr i{background:var(--good)}",
      ".mt2-ev .nd{padding:0 0 10px;font-size:12.5px;min-width:0}.mt2-ev .nd small{display:block;color:var(--muted);font-size:12px;margin-top:2px}.mt2-ev .nd a{color:var(--accent)}",
      ".mt2-ev .thanh{display:block;height:5px;border-radius:3px;background:var(--surface2);overflow:hidden;margin-top:4px}.mt2-ev .thanh b{display:block;height:100%;background:var(--good)}",
      ".mt2-bay{display:flex;align-items:center;gap:8px;margin:2px 0 10px 48px;color:var(--bad);font-size:12px;font-weight:600}.mt2-bay::after{content:\"\";flex:1;height:1px;background:var(--bad)}",
      ".mt2-vd .nh{font-size:12px;font-weight:600;color:var(--muted);padding:12px 16px 4px}.mt2-vd .r{display:flex;align-items:center;gap:10px;min-height:40px;padding:0 16px;border-top:1px solid var(--border)}",
      ".mt2-vd .r .t{white-space:nowrap;font-size:13px}.mt2-vd .r .mu{font-size:12px;color:var(--muted);white-space:nowrap}.mt2-vd .r .mu.chua{color:var(--warn)}.mt2-vd .r.tat .t{color:var(--muted);text-decoration:line-through}",
      ".mt2-vd .r.chon{background:color-mix(in srgb,var(--accent) 7%,var(--surface))}.mt2-vd .r .hx-tag{margin:0}",
      ".mt2-sw{position:relative;flex:none;box-sizing:border-box;width:32px;height:18px;min-width:0;min-height:0;padding:0;margin:0;border-radius:9px;border:0;background:var(--border);cursor:pointer;line-height:0}",
      ".mt2-sw::after{content:\"\";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--surface);box-shadow:0 1px 2px color-mix(in srgb,var(--text) 25%,transparent);transition:transform var(--t-vua,.22s) var(--ez-apple,ease)}",
      ".mt2-sw.bat{background:var(--good)}.mt2-sw.bat::after{transform:translateX(14px)}.mt2-sw[disabled]{opacity:.5;cursor:wait}",
      ".mt2-chan{display:flex;gap:8px;padding:12px 16px;border-top:1px solid var(--border)}.mt2-chan .nguy{margin-left:auto}.mt2-chan .hx-nut{min-height:32px;font-size:13px}",
      ".mt2-dong{display:none}.mt2-tabd{display:none}",
      /* 18/11 user «animation chưa có»: việc ĐANG CHẠY nhịp đập (dfPulse — vạch dòng điều phối, chip sơ đồ, chấm nhật ký, nút máy); đổi máy / chọn việc:
         khung chi tiết hiện dần (fadeUp), đường nối + vạch được chọn sáng dần (fadeIn); điện thoại mở màn máy (paneIn). Chỉ gắn lúc VỪA bấm (.vua-mo), làm mới 30 s không chạy lại. */
      ".mt2-ray i.chay,.mt2-ev.chay .tr i,.mt2-cham{animation:dfPulse 1.8s var(--ez-apple) infinite}.mt2-cham{flex:none;width:7px;height:7px;border-radius:50%;background:var(--good)}",
      ".mt2-jv.chay{gap:6px}.mt2-jv.chay::before{content:\"\";flex:none;width:7px;height:7px;border-radius:50%;background:var(--good);animation:dfPulse 1.8s var(--ez-apple) infinite}",
      ".mt2-than.vua-mo{animation:fadeUp var(--t-vua,.22s) var(--ez-apple,ease) both}.mt2-duong path.vua-mo,.mt2-ray i.hl.vua-mo{animation:fadeIn var(--t-vua,.22s) var(--ez-apple,ease) both}",
      ".mt2-vo .mt2-ct.mo-dt.vua-mo{animation:paneIn var(--t-cham,.3s) var(--ez-apple,ease) both}",
      ".mt2-h:not(.dau):not(.chon):hover,.mt2-mn:not(.chon):hover{background:color-mix(in srgb,var(--accent) 4%,var(--surface2))}.mt2-jv:hover{border-color:var(--accent)}",
      ".mt2-h,.mt2-mn,.mt2-jv{transition:background-color var(--t-nhanh,.16s) var(--ez-apple,ease),border-color var(--t-nhanh,.16s) var(--ez-apple,ease)}",
      "@media(prefers-reduced-motion:reduce){.mt2-ray i.chay,.mt2-ev.chay .tr i,.mt2-cham,.mt2-jv.chay::before,.mt2-than.vua-mo,.mt2-duong path.vua-mo,.mt2-ray i.hl.vua-mo,.mt2-vo .mt2-ct.mo-dt.vua-mo{animation:none}}",
      /* điện thoại ≤ 560: đủ 06–22 như web, sơ đồ 3 cột thu nhỏ, chạm ≥ 40px, chi tiết máy = màn riêng (thẻ nổi + tab chốt đáy) */
      "@media(max-width:560px){.mt2-hai{grid-template-columns:minmax(0,1fr);margin-top:10px}.mt2-the+.mt2-the{margin-top:10px}.mt2-td{padding:0 12px}.mt2-td .mt2-cg{display:none}" +
        ".mt2-tl{padding:2px 12px 8px}.mt2-h{grid-template-columns:minmax(0,1fr) auto;row-gap:2px;padding:6px 0;min-height:44px}.mt2-h .mt2-ray{grid-column:1/-1;height:20px}.mt2-h.dau{display:block;padding:0}" +
        ".mt2-h.dau>span,.mt2-h.dau>.mt2-lu{display:none}.mt2-h>.mt2-lu{grid-row:1;grid-column:2}.mt2-truc span{font-size:10.5px}.mt2-lu b{font-weight:400;color:var(--muted)}" +
        "/* 18/11 user duyệt B «khít chữ»: khung tên việc theo chữ (tối đa 112), khung máy theo chữ (tối thiểu 84) */" +
        ".mt2-sd{grid-template-columns:auto minmax(18px,1fr) auto;padding:10px 12px 12px}.mt2-jv{height:auto;min-height:40px;max-width:112px;padding:3px 7px;font-size:11.5px;white-space:normal;line-height:14px;text-align:right}" +
        ".mt2-mn{padding:6px 8px;gap:3px;min-width:84px}.mt2-mn .a b{font-size:12px}.mt2-mn .a .hx-tag{display:none}.mt2-mn>.hx-tag.dt{display:inline-flex;align-self:flex-start;margin:0;font-size:11px}.mt2-mn small{font-size:11px}" +
        ".mt2-ct{display:none}.mt2-vo .mt2-ct.mo-dt{display:flex;flex-direction:column;position:fixed;inset:0;z-index:1350;border:0;border-radius:0;background:var(--tb-nen,var(--bg));margin:0;overflow:hidden}" +
        "/* 18/11 user «tab chưa khớp thanh bên phải (Tổng quan · Làm gì · Báo cáo ở đâu …)»: thẻ tiêu đề nổi lề 10 bo 8 + thanh tab chốt đáy y Planogram (sát 2 mép + đáy, bo 8, viền trên + bóng hắt lên) */" +
        ".mt2-ct.mo-dt .mt2-dau{background:var(--surface);margin:10px 10px 0;border-radius:8px;box-shadow:var(--shadow)}.mt2-ct.mo-dt .mt2-td{border-bottom:0;min-height:56px}" +
        ".mt2-ct.mo-dt .mt2-td .lsb-seg{display:none}.mt2-dong{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text);font:inherit}" +
        ".mt2-ct.mo-dt .mt2-ts{padding:0 12px 10px}.mt2-ct.mo-dt .mt2-than{flex:1;overflow:auto;margin:10px 10px 64px;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding-bottom:4px}" +
        ".mt2-ct.mo-dt .mt2-chan{background:var(--surface);flex-wrap:wrap}.mt2-ct.mo-dt .mt2-chan .hx-nut{min-height:40px}.mt2-vd .r{min-height:48px;padding:0 12px}.mt2-sw{width:44px;height:40px;border-radius:0;background:none}.mt2-sw::before{content:\"\";position:absolute;left:0;right:0;top:7px;height:26px;border-radius:13px;background:var(--border)}" +
        ".mt2-sw.bat{background:none}.mt2-sw.bat::before{background:var(--good)}.mt2-sw::after{top:9px;width:22px;height:22px}.mt2-sw.bat::after{transform:translateX(18px)}#mt2Vo .mt2-tabd.bd-tabben{display:flex;position:fixed;left:0;right:0;bottom:0;top:auto;z-index:2;margin:0;padding:0 2px env(safe-area-inset-bottom);overflow:hidden;border:0;border-top:1px solid var(--ad-chia,var(--border));border-radius:8px;box-shadow:0 -4px 12px color-mix(in srgb,var(--text) 8%,transparent)}" +
        "#mt2Vo .mt2-tabd.bd-tabben .hp-whtab{flex:1 1 0;min-width:0;justify-content:center;padding:0 2px;white-space:nowrap}}}"
    ].join("\n");
    var st = document.createElement("style"); st.id = "mt-css"; st.textContent = c; document.head.appendChild(st);
  }

  /* ---------- tải dữ liệu ---------- */
  function goi591(duong, opt) {
    opt = Object.assign({}, opt || {}); opt.headers = Object.assign({}, opt.headers || {}, { "x-hx-phien": phien() });
    var ctl = new AbortController(), h = setTimeout(function () { ctl.abort(); }, 45000);
    return fetch(API + duong, Object.assign({ signal: ctl.signal }, opt)).then(function (r) { clearTimeout(h);
      return r.text().then(function (t) { var j = {}; try { j = JSON.parse(t); } catch (e) {} if (!r.ok) { var er = new Error(j.loi || ("HTTP " + r.status)); er.ma = r.status; throw er; } return j; }); });
  }
  // 13/10 tối user: «buộc phải có mật khẩu mới xem được». Máy không có 8591 (điện thoại) đăng nhập qua GAS bằng CÙNG mật khẩu Xác minh
  // (bang-591 đồng bộ băm lên GAS mỗi lần đăng nhập Xác minh) → phiên 12 giờ lưu ở localStorage «mt-phien».
  function mtPhien() { try { var o = JSON.parse(localStorage.getItem("mt-phien") || "null"); return o && o.ph && o.het > Date.now() ? o : null; } catch (e) { return null; } }
  function postGas(body) {   // POST text/plain (không preflight) — cùng khuôn hasaki-pc.js; GAS lỗi trả HTML → kiểm '{' (bộ chuẩn mục 3)
    var ctl = new AbortController(), h = setTimeout(function () { ctl.abort(); }, 45000);
    return fetch(GAS, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body), signal: ctl.signal })
      .then(function (r) { return r.text(); }).then(function (t) { clearTimeout(h); if (t.trim()[0] !== "{") throw new Error("Apps Script trả lỗi — thử lại"); return JSON.parse(t); })
      .catch(function (e) { clearTimeout(h); throw e.name === "AbortError" ? new Error("Apps Script không trả lời sau 45 giây") : e; });
  }
  // dữ liệu GAS (thô) → cùng hình với /api/may-tram: may[{…, song, tuoiGiay, viecGiao}], viec[{ten, may}], chuyen
  function chuanGas(j) {
    var now = j.srvNow || Date.now(), tatCa = [];
    var may = (j.may || []).map(function (m) { var tg = Math.round((now - Date.parse(m.luc)) / 1000); (m.tatCaViec || []).forEach(function (t) { if (tatCa.indexOf(t) < 0) tatCa.push(t); });
      return Object.assign({}, m, { tuoiGiay: tg, song: tg <= HET_HAN_GIAY, coKhoa: m.coCamera ? ["TOPREVIEW_USER"] : [] }); });
    may.sort(function (a, b) { return (b.song - a.song) || (b.diem || 0) - (a.diem || 0); });
    var chu = {}; may.forEach(function (m) { if (m.song && !m.dung) (m.viecGiao || []).forEach(function (t) { if (!(m.dungViec || []).includes(t)) chu[t] = m.may; }); });
    return { srvNow: now, may: may, viec: tatCa.map(function (t) { return { ten: t, may: chu[t] || null, canKhoa: [] }; }), chuyen: j.chuyen || [], bridge: j.bridge || [] };   // 17/10: điện thoại cũng thấy phiên trên thẻ máy
  }
  // Máy quản lý? Thanh bên dò 8591 bất đồng bộ (~1,5 s) — mở thẳng ?tab=maytram thì module chạy TRƯỚC ⇒ tự dò, đừng chờ.
  var MAY_CHU = false, CAN_DN = false, H_LAI = 0;
  function dongMayChu() {
    /* 18/11: chế độ KHO DRIVE (09/11 — laptop + mọi máy dự phòng tắt) chỉ phục vụ clip/ảnh, KHÔNG có /api/may-tram ⇒ coi như không có máy chủ, đọc qua Apps Script */
    if (typeof window.hxDoMayChu === "function") return window.hxDoMayChu().then(function (co) { if (co && window.__HX_DRIVE) return false; if (co) API = window.HX_API;
      /* 19/10 điện thoại qua đường hầm: chưa đổi được phiên 8591 thì đi đường Apps Script cũ (không bày ô đăng nhập riêng) */
      if (!co || !window.__HX_QUA_HAM || phien() || typeof window.tkDoiPhienXm !== "function") return co;
      return window.tkDoiPhienXm().then(function () { return !!phien(); }); });
    if (window.__HX_MAY_CHU) return Promise.resolve(true);
    if (window.__HX_KHONG_MAY) return Promise.resolve(false);   // 15/10: điện thoại → chỉ đọc qua Apps Script, không gọi 127.0.0.1
    var ctl = new AbortController(), h = setTimeout(function () { ctl.abort(); }, 1500);
    return fetch(API + "/api/ping", { signal: ctl.signal }).then(function (r) { clearTimeout(h); return r.ok; }).catch(function () { return false; });
  }
  /* 21/10 (đánh giá: «bộ đo chạy đêm, báo lên tab Máy trạm»): khối «Đêm qua máy làm gì» — QC đêm · sao lưu · sức khoẻ kho dữ liệu Apps Script,
     đọc từ 8591 (/api/qc-dem, /api/sao-luu, /api/suc-khoe-du-lieu), giữ 10'; chỉ máy có máy chủ (laptop / đường hầm). */
  var DEMQUA = null, DEMQUA_LUC = 0;
  function taiDemQua() {
    if (Date.now() - DEMQUA_LUC < 10 * 60e3) return;
    DEMQUA_LUC = Date.now();
    var ds = ["/api/qc-dem", "/api/sao-luu", "/api/suc-khoe-du-lieu"].map(function (d) { return goi591(d).catch(function () { return null; }); });
    Promise.all(ds).then(function (r) {
      DEMQUA = { qc: r[0] && r[0].ds ? r[0] : null, sl: r[1] && r[1].luc ? r[1] : null, sk: r[2] && r[2].props ? r[2] : null };
      ve();
    });
  }
  /* 18/11 user «mục Đêm qua máy làm gì có quan trọng không»: khối nói về hệ thống chung, không về máy trạm, và câu «QC tự chạy 02:30» SAI (máy không có
     tác vụ QC đêm, chưa từng có qc-dem.json). Nay CHỈ hiện 1 dòng cảnh báo khi có chuyện: kho Apps Script ≥ 60% trần · 1 Sheet ≥ 80% trần · QC đêm có bộ hỏng. */
  function veDemQua() {
    if (!DEMQUA) return "";
    var ra = [];
    if (DEMQUA.qc) { var hong = (DEMQUA.qc.ds || []).filter(function (b) { return b.ma !== 0; }).map(function (b) { return b.ten.replace(/^qc-/, ""); });
      if (hong.length) ra.push(["warn", "QC đêm: " + hong.length + " bộ đo hỏng — " + hong.join(", ")]); }
    if (DEMQUA.sk) { var p = DEMQUA.sk.props, pct = p.tranByte ? Math.round(p.byte / p.tranByte * 100) : 0;
      if (pct >= 60) ra.push([pct >= 80 ? "bad" : "warn", "Kho dữ liệu Apps Script " + pct + "% trần (" + Math.round(p.byte / 1024) + " / " + Math.round(p.tranByte / 1024) + " KB)"]);
      (DEMQUA.sk.sheets || []).forEach(function (sh) { var q = sh.tranO ? Math.round(sh.o / sh.tranO * 100) : 0; if (q >= 80) ra.push([q >= 90 ? "bad" : "warn", "Sheet " + sh.ten + " " + q + "% trần ô"]); }); }
    return ra.length ? '<div class="mt-dem">' + ra.map(function (x) { return '<span class="hx-tag ' + x[0] + '">' + e_(x[1]) + "</span>"; }).join("") + "</div>" : "";
  }
  function tai() {
    return dongMayChu().then(function (co) {
      MAY_CHU = co;
      // 14/10: trang có HỆ TÀI KHOẢN → bắt buộc đăng nhập ở đó (phiên Xác minh cũ hx-phien còn sót trên laptop KHÔNG đủ)
      if (window.TK && !phienTk()) { CAN_DN = true; DIEU_KHIEN = false; return null; }
      if (co) {   // máy quản lý: cần phiên Xác minh (8591) — đầy đủ + nút điều khiển
        /* 15/10 user thấy «Tài khoản «Lê Chí Tâm» chưa có quyền Xác minh» dù là quản trị: phiên 8591 (hx-phien) mất/hết hạn (máy chủ
           khởi động lại) → 401 → báo nhầm thiếu quyền. Nay: đổi lại phiên tài khoản → phiên 8591 MỘT lần rồi thử lại, hỏng mới hỏi đăng nhập. */
        var doiLai = function () { return typeof window.tkDoiPhienXm === "function" && window.TK ? window.tkDoiPhienXm() : Promise.resolve(false); };
        var lay = function (lan) {
          if (!phien()) return lan ? (CAN_DN = true, null) : doiLai().then(function () { return lay(1); });
          return goi591("/api/may-tram").then(function (j) { DIEU_KHIEN = true; CAN_DN = false;
            /* 15/11 máy chủ trả ngay bản đệm (cuGiay = tuổi bản đệm) để mở nhanh; bản cũ hơn 15 s ⇒ cộng tuổi vào «cập nhật N giây trước» và hỏi lại bản mới sau 2,5 s */
            if (j && j.cuGiay > 15) { (j.may || []).forEach(function (m) { if (typeof m.tuoiGiay === "number") m.tuoiGiay += j.cuGiay; });
              clearTimeout(H_LAI); H_LAI = setTimeout(function () { if (PANE && !PANE.classList.contains("hidden")) tai().then(ve); }, 2500); }
            return j; })
            .catch(function (e) { if (e.ma === 401) { try { localStorage.removeItem("hx-phien"); } catch (x) {} return lay(lan); } throw e; });
        };
        return lay(0);
      }
      /* 14/10 trưa: dùng phiên HỆ TÀI KHOẢN MỚI (tai-khoan.js, nút «Đăng nhập» thanh bên) nếu có quyền Xác minh — 1 lần đăng nhập */
      var tkPh = phienTk(), mp = mtPhien(), ph = tkPh || (mp && mp.ph);
      if (!ph) { CAN_DN = true; return null; }
      return postGas({ action: "pcBangPh", ph: ph }).then(function (j) {
        if (j.status !== "success") { if (j.code === 401) { if (!tkPh) try { localStorage.removeItem("mt-phien"); } catch (x) {} CAN_DN = true; return null; } throw new Error(j.message || "Apps Script trả lỗi"); }
        // 14/10 user «nút dừng chạy của máy trạm đâu»: tài khoản quyền «làm» ở Xác minh → có nút (lệnh qua GAS pcLenhPh); quyền «xem» → chỉ xem
        DIEU_KHIEN = !!(tkPh && typeof window.tkCo === "function" && window.tkCo("r.xacminh", "lam")); CAN_DN = false; return chuanGas(j); });
    }).then(function (d) { MTD = d; MT_LOI = ""; if (d && MAY_CHU) taiDemQua();
      if (d && window.tqGhi) tqGhi("mt", { song: d.may.filter(function (m) { return m.song && !m.dung; }).length, tong: d.may.length });
      if (d && typeof window.soThanhBen === "function") window.soThanhBen(); })   // 14/10: thanh bên từng giữ số cũ (0/1 khi đã có 2 máy)
      .catch(function (e) { MT_LOI = e.name === "AbortError" ? "Máy chủ không trả lời sau 45 giây" : e.message; });
  }
  function phienTk() { var T = window.TK; return T && T.nguoi && T.phien && (typeof window.tkCo !== "function" || window.tkCo("r.xacminh")) ? T.phien : ""; }
  function veDangNhap(thongBao) {
    if (typeof window.tkMoDangNhap === "function") {   // có hệ tài khoản chung → dùng ĐÚNG ô đăng nhập của nó, không ô riêng
      PANE.innerHTML = '<div class="panel mt-dn"><div class="panel-head"><span>Đăng nhập để xem Máy trạm</span></div><div style="padding:16px;display:flex;flex-direction:column;gap:12px">' +
        (window.TK && window.TK.nguoi ? '<div class="mt-st loi">' + (typeof window.tkCo === "function" && !window.tkCo("r.xacminh")
          ? "Tài khoản «" + e_(window.TK.nguoi.ten || window.TK.nguoi.id) + "» chưa có quyền Xác minh."
          : "Phiên đăng nhập đã hết — bấm Đăng nhập để vào lại.") + "</div>" : "") +   // 15/10: chỉ báo thiếu quyền khi THẬT SỰ thiếu
        '<button type="button" class="hx-nut" id="mtMoTk">Đăng nhập</button></div></div>';
      document.getElementById("mtMoTk").onclick = function () { window.tkMoDangNhap(); };
      return;
    }
    var em = ""; try { em = localStorage.getItem("hx-email") || ""; } catch (e) {}
    PANE.innerHTML = '<div class="panel mt-dn"><div class="panel-head"><span>Đăng nhập để xem Máy trạm</span></div>' +
      '<form id="mtDnForm" autocomplete="on"><label><span class="lbl">Email</span><input id="mtDnEm" type="email" autocomplete="username" required value="' + e_(em) + '"></label>' +
      '<label><span class="lbl">Mật khẩu</span><input id="mtDnMk" type="password" autocomplete="current-password" required></label>' +
      '<button type="submit" class="hx-nut" id="mtDnNut">Đăng nhập</button><div id="mtDnSt"' + (thongBao ? ' class="mt-st loi">' + e_(thongBao) : ">") + "</div></form></div>";
    var f = document.getElementById("mtDnForm");
    f.onsubmit = function (ev) {
      ev.preventDefault(); var nut = document.getElementById("mtDnNut"), st = document.getElementById("mtDnSt");
      var email = document.getElementById("mtDnEm").value.trim(), mk = document.getElementById("mtDnMk").value;
      nut.disabled = true; st.className = ""; st.textContent = "Đang kiểm tra…";
      var p = MAY_CHU
        ? goi591("/api/dang-nhap", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: email, matKhau: mk }) })
            .then(function (j) { if (!j.phien) throw new Error(j.loi || "Đăng nhập lỗi"); try { localStorage.setItem("hx-phien", j.phien); } catch (e) {} try { window.dispatchEvent(new CustomEvent("hx-phien")); } catch (e) {} })
        : postGas({ action: "pcDangNhap", email: email, mk: mk })
            .then(function (j) { if (j.status !== "success") throw new Error(j.message || "Đăng nhập lỗi"); try { localStorage.setItem("mt-phien", JSON.stringify({ ph: j.ph, het: j.het, email: j.email })); } catch (e) {} });
      p.then(function () { try { localStorage.setItem("hx-email", email); } catch (e) {} PANE.innerHTML = ""; return tai().then(ve); })
        .catch(function (e) { st.className = "mt-st loi"; st.textContent = e.message; var m = document.getElementById("mtDnMk"); if (m) m.select(); })
        .finally(function () { if (document.body.contains(nut)) nut.disabled = false; });
    };
    (em ? document.getElementById("mtDnMk") : document.getElementById("mtDnEm")).focus();
  }

  /* ---------- vẽ ---------- */
  function tuoiChu(s) { if (s == null || isNaN(s)) return "—"; if (s < 60) return s + " giây trước"; if (s < 3600) return Math.round(s / 60) + " phút trước"; if (s < 86400) return Math.round(s / 3600) + " giờ trước"; return Math.round(s / 86400) + " ngày trước"; }
  var p2 = function (n) { return (n < 10 ? "0" : "") + n; };
  var gio = function (ms) { var d = new Date(ms); return p2(d.getHours()) + ":" + p2(d.getMinutes()); };
  var gioPhut = function (ms) { return gio(ms) + (Date.now() - ms > 864e5 ? " " + new Date(ms).getDate() + "/" + (new Date(ms).getMonth() + 1) : ""); };
  var lau = function (bd) { var p = Math.max(0, Math.round((Date.now() - bd) / 60000)); return p < 1 ? "vừa bắt đầu" : p < 60 ? p + " phút" : Math.floor(p / 60) + " giờ " + (p % 60) + " phút"; };
  var ngan = function (m) { return String(m).replace(/HSK-KHO170-/, "").replace(/^DESKTOP-/, ""); };
  /* 18/11 trục dòng điều phối 06–22 (mẫu user duyệt); lượt ngoài khung vẫn đếm ở cột lượt */
  var G0 = 6, G1 = 22;
  var X = function (ms) { var d = new Date(ms); return Math.max(0, Math.min(100, (d.getHours() + d.getMinutes() / 60 - G0) / (G1 - G0) * 100)); };
  var dauNgay = function () { var d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
  var ngayHom = function () { var d = new Date(); return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); };
  /* taskDP «5S DP <việc>|trạng thái|dd/MM HH:mm lần trước|mã|dd/MM HH:mm lần kế» → lịch từng việc của máy (nhịp = kế − trước) */
  function lichMay(m) {
    var doc = function (s) { var x = String(s || "").match(/(\d+)\/(\d+) (\d+):(\d+)/); return x ? new Date(new Date().getFullYear(), +x[2] - 1, +x[1], +x[3], +x[4]).getTime() : NaN; };
    var r = {}; (m.taskDP || []).forEach(function (s) { var p = String(s).split("|"); if (!/^5S DP /.test(p[0])) return;
      var a = doc(p[2]), b = doc(p[4]); r[p[0].slice(6)] = { tr: a, ke: b, ph: a > 0 && b > 0 ? Math.round((b - a) / 6e4) : 0 }; });
    return r;
  }
  var lichChu = function (ph) { return !(ph > 0) ? "" : ph < 60 ? "mỗi " + ph + " phút" : ph <= 180 ? "mỗi " + Math.round(ph / 60) + " giờ" : "hằng ngày"; };
  /* 18/11 lượt THẬT trong ngày: nhịp tim gửi chayNgay {d, v:{việc:[[phút đầu, bước, số lượt]…]}} (runner-dieu-phoi ghi mỗi lần cổng cho CHẠY).
     Máy bản cũ chưa gửi → chỉ có lần chạy gần nhất (chayLuc) và cột lượt để «—» — không suy đoán lượt. */
  function luotNgay(m) {
    var out = [], cn = m.chayNgay, d0 = dauNgay();
    if (cn && cn.d === ngayHom()) Object.keys(cn.v || {}).forEach(function (t) { (cn.v[t] || []).forEach(function (s) { for (var i = 0; i < s[2]; i++) out.push({ t: t, a: d0 + (s[0] + s[1] * i) * 6e4 }); }); });
    else Object.keys(m.chayLuc || {}).forEach(function (t) { var x = Date.parse(m.chayLuc[t]); if (x >= d0) out.push({ t: t, a: x }); });
    return out.sort(function (a, b) { return a.a - b.a; });
  }
  var coNhatKy = function (m) { return !!(m.chayNgay && m.chayNgay.d === ngayHom()); };
  /* lịch sắp tới của các việc máy đang giữ: lần kế (taskDP) rồi lặp theo nhịp (≤ 3 giờ) tới hết khung */
  function sapToi(m, giu) {
    var l = lichMay(m), het = new Date().setHours(G1, 0, 0, 0), now = Date.now(), out = [];
    giu.forEach(function (t) { var o = l[t]; if (!o || !(o.ke > now)) return; var x = o.ke, k = 0;
      do { out.push({ t: t, a: x }); x += (o.ph > 0 && o.ph <= 180 ? o.ph : 1e9) * 6e4; k++; } while (x <= het && k < 200); });
    return out.sort(function (a, b) { return a.a - b.a; });
  }
  /* 14/10 đánh giá sức khoẻ: Tốt / Cần chú ý / Kém + LÝ DO (giữ nguyên luật cũ) */
  function danhGia(m) {
    var kem = [], chuY = [];
    if (!m.song) kem.push("mất nhịp " + tuoiChu(m.tuoiGiay));
    var ram = Math.round(100 - (m.ramTrongPct || 0)), cpu = Math.round(m.cpuPct || 0);
    if (m.song) { if (ram >= 85) kem.push("RAM đầy " + ram + "%"); else if (ram >= 70) chuY.push("RAM " + ram + "%");
      if (cpu >= 90) kem.push("CPU " + cpu + "%"); else if (cpu >= 70) chuY.push("CPU " + cpu + "%"); }
    if (m.song && m.yeu) chuY.push("tạm ngưng việc nặng" + (ram < 70 ? " (RAM " + ram + "%, chờ xuống 60%)" : ""));
    var oKem = {}, oCy = {};
    (m.oDia && m.oDia.length ? m.oDia : m.diaTrongGB != null ? [{ o: "C", trong: m.diaTrongGB }] : []).forEach(function (x) {
      var dung = x.tong ? Math.round((x.tong - x.trong) / x.tong * 100) : 0, ten = "ổ " + x.o + (dung ? " đầy " + dung + "%" : "") + ", còn " + Math.round(x.trong) + " GB";
      if (x.trong < 3) { kem.push(ten); oKem[x.o] = 1; } else if (x.trong < 10 || dung >= 85) { chuY.push(ten); oCy[x.o] = 1; } });
    if (m.song && !m.duPhong && ("congLuc" in m) && (!m.congLuc || Date.now() - Date.parse(m.congLuc) > 3 * 3600e3)) kem.push("task việc không khởi chạy");
    var soTask = (m.taskDP || []).filter(function (d) { return /^5S DP /.test(String(d)); }).length, canTask = (m.tatCaViec || []).length;
    if (!m.duPhong && (m.taskDP || []).length && canTask && soTask < canTask) kem.push("thiếu " + (canTask - soTask) + "/" + canTask + " task việc");
    (m.taskDP || []).forEach(function (d) { var p = String(d).split("|"), ma = Number(p[3]);
      if (p[0] && /^5S DP /.test(p[0]) && ma && ma !== 267011 && ma !== 267009) chuY.push(p[0].replace(/^5S DP /, "") + " lỗi mã " + ma); });
    if (m.song && !m.duPhong && !("chayLuc" in m)) chuY.push("bản mã cũ, chưa nhận cập nhật");
    var muc = kem.length ? "kem" : chuY.length ? "chu-y" : "tot";
    return { muc: muc, ly: kem.concat(chuY), oKem: oKem, oCy: oCy };
  }
  var MT_CHON = "", MT_VIEC = "", MT_TAB = "nk", MT_DT = false, H_VE = 0, MT_VUA = "";   // MT_VUA: lượt vẽ ngay sau cú bấm → gắn hiệu ứng (.vua-mo) đúng 1 lần
  var laDT = function () { return matchMedia("(max-width:560px)").matches; };
  function ve() {
    if (!PANE) return;
    if (CAN_DN) { if (!document.getElementById("mtDnForm")) veDangNhap(); return; }   // đang gõ thì không vẽ đè form
    if (!MTD) { PANE.innerHTML = '<div class="panel" style="margin-top:4px"><div class="hx-trong">Chưa đọc được bảng máy trạm: ' + e_(MT_LOI || "không rõ lỗi") + " — tự thử lại sau 30 giây.</div></div>"; return; }
    var dangChuyen = {}; (MTD.chuyen || []).forEach(function (c) { dangChuyen[c.viec] = c; });
    var nangCua = {}; (MTD.viec || []).forEach(function (v) { if (v.nang != null) nangCua[v.ten] = !!v.nang; });
    MTD.may.forEach(function (m) { (m.viecNang || []).forEach(function (t) { nangCua[t] = true; }); (m.tatCaViec || []).forEach(function (t) { if (!(t in nangCua)) nangCua[t] = false; }); });
    var mayLaptop = (MTD.may.filter(function (x) { return x.duPhong && x.dung; })[0] || {}).may;
    /* máy giữ việc: điều phối tính (viec[].may); việc chỉ chạy ở laptop → laptop */
    var chuCua = {}; (MTD.viec || []).forEach(function (v) { chuCua[v.ten] = v.may || (v.chiLaptop ? mayLaptop : null) || null; });
    var hangMay = function (m) { return !m.song ? 3 : (m.dangChay || []).length ? 0 : m.dung ? 2 : 1; };
    var tatCa = MTD.may.slice().sort(function (a, b) { return (hangMay(a) - hangMay(b)) || ((b.diem || 0) - (a.diem || 0)) || String(a.may).localeCompare(String(b.may)); });
    var PC = tatCa.filter(function (m) { return m.ban !== "may-in"; }), MIN = tatCa.filter(function (m) { return m.ban === "may-in"; });
    var DG = {}; tatCa.forEach(function (m) { DG[m.may] = danhGia(m); });
    var giuCua = function (m) { return Object.keys(chuCua).filter(function (t) { return chuCua[t] === m.may && (m.dungViec || []).indexOf(t) < 0; }); };
    /* chip sức khoẻ: máy Dừng ghi Dự phòng / Đã dừng; còn lại Tốt / Cần chú ý / Kém (lý do nằm ở khung chi tiết, không lặp trên thẻ) */
    var chipSk = function (m, lop) { var g = DG[m.may], c = m.dung ? (m.duPhong ? ["Dự phòng", "info"] : ["Đã dừng", "warn"]) : { tot: ["Tốt", "good"], "chu-y": ["Cần chú ý", "warn"], kem: ["Kém", "bad"] }[g.muc];
      return '<span class="hx-tag ' + c[1] + (lop ? " " + lop : "") + '">' + c[0] + "</span>"; };
    var denSk = function (m) { return '<i class="mt2-den ' + (m.dung ? "dung" : DG[m.may].muc) + '"></i>'; };
    if (!PC.length && !MIN.length) { PANE.innerHTML = '<div class="panel"><div class="hx-trong">Chưa PC nào gửi nhịp tim. Cài bằng nút «Tải bộ cài PC» ở trang Tổng quan; PC gửi nhịp mỗi phút.</div></div>'; return; }
    if (!PC.concat(MIN).some(function (m) { return m.may === MT_CHON; })) MT_CHON = (PC[0] || MIN[0]).may;
    var MAY = tatCa.filter(function (m) { return m.may === MT_CHON; })[0];
    if (MT_VIEC && !(MT_VIEC in chuCua)) MT_VIEC = "";
    var vua = MT_VUA; MT_VUA = "";

    /* ===== KHUNG 1 · Dòng điều phối hôm nay ===== */
    var now = Date.now(), truc = [];
    for (var g = G0; g <= G1; g += 2) { var xg = new Date().setHours(g, 0, 0, 0); if (Math.abs(xg - now) > 45 * 6e4)
      truc.push('<span class="' + (g === G0 ? "dau" : g === G1 ? "cuoi" : "") + '" style="left:' + (g - G0) / (G1 - G0) * 100 + '%">' + p2(g) + (laDT() ? "" : ":00") + "</span>"); }
    if (now >= new Date().setHours(G0, 0, 0, 0) && now <= new Date().setHours(G1, 0, 0, 0)) truc.push('<span class="nay" style="left:' + X(now) + '%">' + gio(now) + "</span>");
    var VG = ""; for (var k8 = 1; k8 < 8; k8++) VG += '<b class="vg" style="left:' + k8 * 12.5 + '%"></b>';   // vạch 2 giờ (phần tử thật, không nền gradient — AD-04)
    var vach = function (t, a, b, lop) { var n = nangCua[t] === true;
      return '<i class="' + (n ? "n" : "l") + (lop ? " " + lop : "") + (MT_VIEC ? (t === MT_VIEC ? " hl" + (vua ? " vua-mo" : "") : " mo") : "") + '" style="left:' + X(a) + "%;width:" + Math.max(.3, X(b) - X(a)) + '%" title="' + e_(tenV(t) +
        " · " + gio(a)) + '"></i>'; };
    var ray = function (m) { var h = m.song ? "" : '<i class="ngu" style="left:' + X(Date.parse(m.luc)) + '%;right:0"></i>';
      luotNgay(m).forEach(function (k) { h += vach(k.t, k.a, k.a + (nangCua[k.t] ? 10 : 3) * 6e4, ""); });
      (m.song ? m.dangChay || [] : []).forEach(function (t) { var bd = Date.parse((m.batDau || {})[t] || (m.chayLuc || {})[t] || "") || now - 6e4; h += vach(t, bd, now, "chay"); });
      if (m.song && !m.dung) sapToi(m, giuCua(m)).forEach(function (k) { h += vach(k.t, k.a, k.a + (nangCua[k.t] ? 10 : 3) * 6e4, "sap"); });
      return '<div class="mt2-ray">' + VG + h + '<i class="nay" style="left:' + X(now) + '%"></i></div>'; };
    var luotO = function (m) { return coNhatKy(m) ? "<b>" + luotNgay(m).length + "</b>" : '<span title="Máy chưa gửi nhật ký chạy trong ngày (bản cũ) — chỉ có lần chạy gần nhất">—</span>'; };
    /* 18/11 user duyệt bỏ hàng «Máy in» (3/4 tác tử cũ mất nhịp nhiều ngày; nhịp máy in thưa > 180 s nên nhấp nháy đỏ/xanh; không nhận việc điều phối):
       chỉ báo khi máy in tem có nhịp trong 24 giờ qua mà mất nhịp > 10 phút */
    var inMat = MIN.filter(function (m) { var t = now - Date.parse(m.luc); return t > 6e5 && t < 864e5; });
    var tipIn = inMat.map(function (m) { return ngan(m.may) + " · nhịp cuối " + tuoiChu(Math.round((now - Date.parse(m.luc)) / 1000)); }).join("\n");
    var dp = '<div class="mt2-the mt2-dp"><div class="mt2-td"><b>Dòng điều phối hôm nay</b>' + (inMat.length ? '<span class="hx-tag bad" title="' + e_(tipIn) + '">Máy in tem mất nhịp ' + inMat.length + "</span>" : "") + (MT_VIEC ? '<span class="hx-tag info">' + e_(tenV(MT_VIEC)) + "</span>" : "") +
      '<div class="mt2-cg"><span><i style="background:var(--mt-nang)"></i>Nặng</span><span><i style="background:var(--mt-nhe)"></i>Nhẹ</span><span><i style="background:var(--good)"></i>Đang chạy</span>' +
      '<span><i style="border:1.3px dashed var(--muted)"></i>Sắp chạy</span><span><i class="mt2-ray" style="height:7px;background:none"><i class="ngu" style="left:0;right:0"></i></i>Mất nhịp</span></div></div>' +
      '<div class="mt2-tl"><div class="mt2-h dau"><span></span><div class="mt2-truc">' + truc.join("") + '</div><span class="mt2-lu">lượt</span></div>' +
      PC.map(function (m) { return '<div class="mt2-h' + (m.may === MT_CHON ? " chon" : "") + '" data-chon="' + e_(m.may) + '" title="' + e_(m.may) + '"><div class="mt2-ten">' + denSk(m) + "<span>" + e_(ngan(m.may)) + "</span></div>" +
        ray(m) + '<span class="mt2-lu">' + luotO(m) + (laDT() ? " lượt" : "") + "</span></div>"; }).join("") + "</div>" +
 "</div>";

    /* ===== KHUNG 2 · Sơ đồ phân luồng (việc → máy giữ; nét đứt = tắt trên máy đó) ===== */
    var VX = Object.keys(chuCua).sort(function (a, b) { return ((nangCua[b] ? 1 : 0) - (nangCua[a] ? 1 : 0)) || String(chuCua[a] || "~").localeCompare(String(chuCua[b] || "~")) || tenV(a).localeCompare(tenV(b), "vi"); });
    var conMay = PC.some(function (m) { return m.song && !m.dung; });
    var lyChua = function (t) { var c = dangChuyen[t], k = ((MTD.viec || []).filter(function (v) { return v.ten === t; })[0] || {}).canKhoa || [];
      return c ? "Bị dừng giữa chừng ở " + c.tu + " — chờ máy khác chạy bù" : !conMay ? "Chưa có PC nào đang chạy" : k.indexOf("TOPREVIEW_USER") >= 0 ? "Cần PC có khoá camera" : "Cần PC đang chạy"; };
    var chua = VX.filter(function (t) { return !chuCua[t]; });
    var jv = function (t) { var run = tatCa.some(function (m) { return m.song && (m.dangChay || []).indexOf(t) >= 0; }), hl = MT_VIEC ? t === MT_VIEC : chuCua[t] === MT_CHON;
      return '<button type="button" class="mt-ct mt2-jv' + (run ? " chay" : "") + (!chuCua[t] ? " chua" : "") + (hl ? " hl" : MT_VIEC ? " mo" : "") + '" data-viec-chon="' + e_(t) + '" title="' + e_(tenV(t) + (chuCua[t] ? " → " + chuCua[t] : " — chưa có máy nhận: " + lyChua(t))) + '">' + e_(tenV(t)) + "</button>"; };
    var cv = [["Nặng", true], ["Nhẹ", false]].map(function (g) { var ds = VX.filter(function (t) { return (nangCua[t] === true) === g[1]; }); return ds.length ? '<div class="nhom">' + g[0] + "</div>" + ds.map(jv).join("") : ""; }).join("");
    var mn = PC.map(function (m) { return '<div class="mt2-mn' + (m.song && !m.dung ? "" : " mo") + (m.may === MT_CHON ? " chon" : "") + '" data-m="' + e_(m.may) + '" data-chon="' + e_(m.may) + '" title="' + e_(m.may) + '" role="button" tabindex="0">' +
      '<div class="a">' + (m.song && (m.dangChay || []).length ? '<i class="mt2-cham" title="Đang chạy"></i>' : "") + "<b>" + e_(ngan(m.may)) + "</b>" + chipSk(m) + "</div>" + chipSk(m, "dt") + "<small>giữ <b>" + giuCua(m).length +
        "</b> việc</small></div>"; }).join("");
    var sd = '<div class="mt2-the mt2-so"><div class="mt2-td"><b>Sơ đồ phân luồng</b><span class="phu">' + VX.length + " việc → " + PC.length + " máy</span>" +
      (chua.length ? '<span class="hx-tag bad" title="' + e_(chua.map(function (t) { return tenV(t) + ": " + lyChua(t); }).join("\n")) + '">' + chua.length + " việc chưa có máy</span>" : "") + "</div>" +
      '<div class="mt2-sd" id="mt2Sd"><div class="mt2-cv">' + cv + '</div><div></div><div class="mt2-cm">' + mn + '</div><svg class="mt2-duong" id="mt2Duong" aria-hidden="true"></svg></div></div>';

    /* ===== KHUNG 3 · Chi tiết máy đang chọn: Nhật ký | Việc (1 chỗ sửa duy nhất) ===== */
    var idMay = ngan(MAY.may).replace(/[^\w-]/g, "_").replace(/\d{3,}/g, "_"),   /* khoá theo máy: id không có ≥3 chữ số liền (qc-nhay-bam bỏ id dạng mã) */
      g0 = DG[MAY.may], giuM = giuCua(MAY), l0 = lichMay(MAY), dk = DIEU_KHIEN && !MAY.dung && MAY.song;
    var ram0 = Math.round(100 - (MAY.ramTrongPct || 0)), cpu0 = Math.round(MAY.cpuPct || 0), muc0 = function (x, a, b) { return !MAY.song ? "" : x >= b ? "bad" : x >= a ? "warn" : ""; };
    var ts = '<div class="mt2-ts" id="mt2ts-' + idMay + '"><span>RAM <b class="' + muc0(ram0, 70, 85) + '">' + ram0 + '%</b></span><span>CPU <b class="' + muc0(cpu0, 70, 90) + '">' + cpu0 + "%</b></span>" +
      (MAY.oDia || []).map(function (o) { return "<span>Ổ " + e_(o.o) + ' <b class="' + (g0.oKem[o.o] ? "bad" : g0.oCy[o.o] ? "warn" : "") + '">' + Math.round(o.trong) + " GB</b></span>"; }).join("") +
      g0.ly.filter(function (x) { return !/^(ổ |RAM |RAM đầy |CPU )/.test(x); }).map(function (x) { return '<span class="ly">' + e_(x) + "</span>"; }).join("") + "</div>";
    var phien = (MTD.bridge || []).filter(function (b) { return (b.may || mayLaptop) === MAY.may && b.tuoi; }).map(function (b) {
      return '<div class="mt2-ph" title="' + e_(b.email || "") + '">Phiên <b>' + e_(b.ten || b.email || "mã " + b.sub) + "</b> · " + e_(b.kind === "wshr" ? "work/hr" : b.kind === "wms" ? "WMS" : b.kind) + " · " + (b.tamlc ? "ghi + đọc" : "chỉ đọc") + "</div>"; }).join("");
    var soEv = 0, ev = function (lop, g1, nd) { return '<div class="mt2-ev ' + lop + '" id="mt2ev-' + idMay + "-" + (++soEv) + '"><span class="g">' + g1 + '</span><span class="tr"><i></i></span><div class="nd">' + nd + "</div></div>"; };
    var nk = function () { var qua = luotNgay(MAY).slice(-7), sap = {}, thuTu = [];
      sapToi(MAY, MAY.song && !MAY.dung ? giuM : []).forEach(function (k) { if (!sap[k.t]) { sap[k.t] = []; thuTu.push(k.t); } sap[k.t].push(k.a); });
      var chay = (MAY.song ? MAY.dangChay || [] : []).map(function (t) { var td = (MAY.tienDo || {})[t], bd = Date.parse((MAY.batDau || {})[t] || (MAY.chayLuc || {})[t] || ""), pct = td && td.n ? Math.min(100, Math.round(td.i / td.n * 100)) : -1;
        return ev("chay", "đang", "<b>" + e_(tenV(t)) + "</b>" + (td ? "<small>" + e_(td.buoc || "") + (td.task ? ' · phiếu <a href="https://work.hasaki.vn/tasks?task_id=' + encodeURIComponent(td.task) + '" target="_blank" rel="noopener">' + e_(td.task) + "</a>" : "") +
          (td.n ? " (" + td.i + "/" + td.n + ")" : "") + "</small>" : "") + (pct >= 0 ? '<i class="thanh"><b style="width:' + pct + '%"></b></i>' : "") + (bd ? "<small>từ " + gio(bd) + " · " + lau(bd) + "</small>" : "")); }).join("");
      return '<div class="mt2-nk" id="mt2nk-' + idMay + '">' + (qua.length ? qua.map(function (k) { return ev(nangCua[k.t] ? "n" : "", gio(k.a), e_(tenV(k.t))); }).join("") : '<div class="hx-trong" style="padding:12px 0">Hôm nay chưa chạy việc nào</div>') +
        '<div class="mt2-bay">Bây giờ ' + gio(now) + "</div>" + chay +
        thuTu.slice(0, 4).map(function (t) { var a = sap[t]; return ev("sap" + (nangCua[t] ? " n" : ""), gio(a[0]), e_(tenV(t)) + (a.length > 1 ? "<small>rồi " + a.slice(1, 4).map(gio).join(" · ") + (a.length > 4 ? " …" : "") + "</small>" : "")); }).join("") + "</div>"; };
    var vd = function () { var r = function (t, tat) { var sang = chuCua[t];
        var phai = tat ? (sang && sang !== MAY.may ? '<span class="mu">→ ' + e_(ngan(sang)) + "</span>" : '<span class="mu chua">' + (dangChuyen[t] ? "chờ máy chạy bù" : "chưa máy nào nhận") + "</span>") : '<span class="mu">' + lichChu((l0[t] || {}).ph) + "</span>";
        return '<div class="r' + (tat ? " tat" : "") + (t === MT_VIEC ? " chon" : "") + '" data-r="' + e_(t) + '">' + (dk ? '<button type="button" class="mt-x mt2-sw' + (tat ? "" : " bat") + '" role="switch" aria-checked="' + !tat + '" data-may="' + e_(MAY.may) + '" data-viec="' + e_(t) +
          '" data-dung="' + (tat ? "0" : "1") + '" aria-label="' + e_((tat ? "Bật lại " : "Tắt ") + tenV(t) + " trên " + MAY.may) + '"></button>' : "") + '<span class="t">' + e_(tenV(t)) + "</span>" + (nangCua[t] && !tat ? '<span class="hx-tag khongcham">Nặng</span>' : "") + phai + "</div>"; };
      var gs = giuM.slice().sort(function (a, b) { return ((nangCua[b] ? 1 : 0) - (nangCua[a] ? 1 : 0)) || tenV(a).localeCompare(tenV(b), "vi"); });
      return '<div class="mt2-vd" id="mt2vd-' + idMay + '"><div class="nh">Đang giữ · ' + gs.length + "</div>" + (gs.length ? gs.map(function (t) { return r(t, 0); }).join("") : '<div class="hx-trong" style="padding:12px 16px">' + (MAY.dung ? (MAY.duPhong ? "Dự phòng — chỉ làm thay khi PC chưa nhận việc" : "Đang dừng") : !MAY.song ? "Mất nhịp — việc đã sang máy khác" : "Chưa được giao việc") + "</div>") +
        ((MAY.dungViec || []).length ? '<div class="nh">Tắt trên máy này · ' + MAY.dungViec.length + "</div>" + MAY.dungViec.map(function (t) { return r(t, 1); }).join("") : "") + "</div>"; };
    var nut = !DIEU_KHIEN ? "" : !MAY.song && !MAY.dung ? '<button class="hx-nut phu" data-may="' + e_(MAY.may) + '" data-xoa="1">Gỡ</button>'
      : (MAY.song ? (MAY.capNhatYc ? '<button class="hx-nut phu" disabled title="Gửi lúc ' + e_(gioPhut(Date.parse(MAY.capNhatYc))) + ' — máy nhận trong ~1 phút">Chờ máy nhận lệnh…</button>'
        : '<button class="hx-nut" data-may="' + e_(MAY.may) + '" data-capnhat="1" title="' + e_("Lấy bản mới nhất ngay (không chờ lượt 2 giờ) · " + ((MAY.capGan || []).slice(-1)[0] || "")) + '">Cập nhật ngay</button>') : "") +
        '<button class="hx-nut ' + (MAY.dung ? "" : "phu nguy") + '" data-may="' + e_(MAY.may) + '" data-dung="' + (MAY.dung ? "0" : "1") + '">' + (MAY.dung ? "Cho chạy lại" : "Dừng máy") + "</button>";
    var tab = MT_TAB === "viec" ? "viec" : "nk", tabs = [["nk", "Nhật ký"], ["viec", "Việc " + giuM.length]];
    var nutTab = function (o) { return '<button type="button" class="hp-whtab' + (tab === o[0] ? " active" : "") + '" role="tab" aria-selected="' + (tab === o[0]) + '" data-tab="' + o[0] + '">' + o[1] + "</button>"; };
    var ct = '<div class="mt2-the mt2-ct' + (MT_DT ? " mo-dt" : "") + (vua === "dt" ? " vua-mo" : "") +
      '" id="mt2Ct"><div class="mt2-dau"><div class="mt2-td"><button type="button" class="mt-xo-dong mt2-dong" aria-label="Đóng">✕</button><b title="' + e_(MAY.may) + '">' + e_(ngan(MAY.may)) + "</b>" +
      (laDT() ? chipSk(MAY) : "") + '<span class="lsb-seg" role="tablist">' + tabs.map(nutTab).join("") + "</span></div>" + ts + phien + '</div><div class="mt2-than' + (vua === "chon" ? " vua-mo" : "") + '">' + (tab === "viec" ? vd() + (nut ? '<div class="mt2-chan">' + nut + "</div>" : "") : nk()) + "</div>" +
      '<div class="bd-tabben mt2-tabd" role="tablist">' + tabs.map(function (o) { return '<button type="button" class="hp-whtab' + (tab === o[0] ? " active" : "") + '" role="tab" aria-selected="' + (tab === o[0]) +
        '" data-tab="' + o[0] + '" data-ptab="' + (o[0] === "viec" ? "lam" : "ls") + '">' + (o[0] === "viec" ? 'Việc <span class="bd-tab-so">' + giuM.length + "</span>" : o[1]) + "</button>"; }).join("") + "</div></div>";

    /* PC xin khoá (chỉ máy quản lý duyệt, so mã trên màn PC) */
    var xin = (MTD.xin || []).filter(function (x) { return !x.daDuyet; });
    var h = DIEU_KHIEN && xin.length ? '<div class="panel hx-mt-xin"><div class="panel-head"><span>PC xin khoá</span><span>' + xin.length + "</span></div>" +
      xin.map(function (x) { return '<div class="hx-mt-v"><div class="ten"><b>' + e_(x.may) + "</b><small>Mã xác nhận <b class=\"ma\">" + e_(x.maXN) + "</b> · xin " + e_(tuoiChu(Math.round((Date.now() - x.luc) / 1000))) + " · so với mã trên màn hình PC</small></div>" +
        '<button class="hx-nut phu" data-xin="' + e_(x.may) + '" data-dongy="0">Từ chối</button><button class="hx-nut" data-xin="' + e_(x.may) + '" data-dongy="1">Duyệt</button></div>'; }).join("") + "</div>" : "";
    h += dp + '<div class="mt2-hai">' + sd + (MT_DT ? "" : ct) + "</div>";
    if (!MAY_CHU && !phienTk() && mtPhien()) h += '<div style="text-align:center;margin:14px 0"><button type="button" class="hx-nut phu" id="mtDangXuat">Đăng xuất</button></div>';
    PANE.innerHTML = veDemQua() + h;   // 21/10 khối «Đêm qua máy làm gì» trên cùng (rỗng khi không có máy chủ)
    var vo = document.getElementById("mt2Vo"); if (MT_DT) { if (!vo) { vo = document.createElement("div"); vo.id = "mt2Vo"; vo.className = "mt2-vo"; document.body.appendChild(vo); } vo.innerHTML = ct; } else if (vo) vo.remove();
    var qa = function (sel) { var a = [].slice.call(PANE.querySelectorAll(sel)); if (MT_DT && vo) a = a.concat([].slice.call(vo.querySelectorAll(sel))); return a; };
    veDuong(vua === "chon");   // vẽ đường nối NGAY trong cùng khung hình (TK-31) — getBoundingClientRect ép bố cục xong trước khi trình duyệt vẽ
    var dx = document.getElementById("mtDangXuat");
    if (dx) dx.onclick = function () { var mp = mtPhien(); try { localStorage.removeItem("mt-phien"); } catch (e) {} MTD = null; CAN_DN = true;
      if (mp) postGas({ action: "pcDangXuat", ph: mp.ph }).catch(function () {}); veDangNhap(); };
    /* chọn máy (hàng dòng điều phối · nút máy sơ đồ · chip máy in) · chọn việc (chip sơ đồ) · đổi tab · đóng màn chi tiết điện thoại */
    var moDT = function () { if (!laDT() || MT_DT) return; MT_DT = true; MT_VUA = "dt"; if (window.hskLop) window.hskLop.day("mt-may", function () { MT_DT = false; ve(); }); };
    qa("[data-chon]").forEach(function (n) { var chon = function () { MT_CHON = n.dataset.chon; MT_VIEC = ""; MT_VUA = "chon"; moDT(); ve(); };
      n.onclick = chon; n.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); chon(); } }; });
    qa("[data-viec-chon]").forEach(function (n) { n.onclick = function () { var t = n.dataset.viecChon;
      MT_VUA = "chon"; if (MT_VIEC === t) { MT_VIEC = ""; ve(); return; } MT_VIEC = t; if (chuCua[t]) MT_CHON = chuCua[t]; MT_TAB = "viec"; ve();
      var r = PANE.querySelector('.mt2-vd .r[data-r="' + (window.CSS && CSS.escape ? CSS.escape(t) : t) + '"]'); if (r && !laDT()) r.scrollIntoView({ block: "nearest" }); }; });
    qa("[data-tab]").forEach(function (n) { n.onclick = function () { MT_TAB = n.dataset.tab; ve(); }; });
    var dg = qa(".mt2-dong")[0]; if (dg) dg.onclick = function () { MT_DT = false; if (window.hskLop) window.hskLop.rut("mt-may"); ve(); };
    if (!DIEU_KHIEN) return;
    PANE.querySelectorAll("button[data-xin]").forEach(function (n) {
      n.onclick = function () {
        var dongY = n.dataset.dongy === "1", cu = n.textContent; n.disabled = true; n.textContent = "Đang gửi…";
        goi591("/api/may-tram/duyet-khoa", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ may: n.dataset.xin, dongY: dongY }) })
          .then(function () { if (typeof toast === "function") toast(dongY ? "Đã duyệt — " + n.dataset.xin + " tự nhận khoá trong ~10 giây rồi cài tiếp" : "Đã từ chối " + n.dataset.xin, "ok"); return tai().then(ve); })
          .catch(function (e) { if (typeof toast === "function") toast("Không gửi được: " + e.message, "loi"); })
          .finally(function () { if (document.body.contains(n)) { n.disabled = false; n.textContent = cu; } });
      };
    });
    qa("button[data-may]").forEach(function (n) {
      n.onclick = function () {
        var dung = n.dataset.dung === "1", xoa = n.dataset.xoa === "1", capNhat = n.dataset.capnhat === "1", viec = n.dataset.viec || "", cu = n.textContent, sw = n.classList.contains("mt2-sw");
        if (dung && !window.confirm((viec ? "Tắt «" + tenV(viec) + "» trên " : "Dừng cả máy ") + n.dataset.may + "?" + (viec ? " Bộ điều phối sẽ chuyển việc này sang máy khác." : " Mọi việc của máy này sẽ chuyển sang máy khác."))) return;
        n.disabled = true; if (sw) n.classList.toggle("bat"); else n.textContent = "Đang gửi…";   // công tắc đổi ngay (lạc quan, lỗi thì vẽ lại theo dữ liệu)
        (MAY_CHU ? goi591("/api/may-tram/lenh", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ may: n.dataset.may, viec: viec, dung: dung, xoa: xoa, capNhat: capNhat }) })
          /* 14/10: không có 8591 (trình duyệt chặn gọi máy nội bộ / máy khác) → lệnh qua GAS bằng phiên tài khoản có quyền «làm» Xác minh */
          : postGas({ action: "pcLenhPh", ph: phienTk(), may: n.dataset.may, viec: viec, dung: dung, xoa: xoa, capNhat: capNhat }).then(function (j) { if (j.status !== "success") throw new Error(j.message || "Apps Script từ chối"); return j; }))
          .then(function (j) {
            if (typeof toast === "function") toast(capNhat ? "Đã gửi lệnh cập nhật — " + n.dataset.may + " tự lấy bản mới trong ~1–2 phút" : xoa ? "Đã gỡ " + n.dataset.may + " khỏi danh sách" : (dung ? (viec ? "Đã tắt " : "Đã dừng ") : (viec ? "Đã bật lại " : "Đã cho chạy lại ")) + (viec ? tenV(viec) + " trên " : "") + n.dataset.may + (j.daChuyen && j.daChuyen.length ? " — đang chuyển " + j.daChuyen.map(tenV).join(", ") + " sang máy khác" : ""), "ok");
            return tai().then(ve);
          })
          .catch(function (e) { if (typeof toast === "function") toast("Không gửi được lệnh: " + e.message, "loi"); ve(); })
          .finally(function () { if (document.body.contains(n)) { n.disabled = false; if (!sw) n.textContent = cu; } });
      };
    });
  }
  /* đường nối sơ đồ: việc → máy giữ (màu Nặng / Nhẹ), nét đứt = việc tắt trên máy đó; đậm = thuộc máy / việc đang chọn */
  function veDuong(vuaMo) {
    var so = document.getElementById("mt2Sd"), svg = document.getElementById("mt2Duong"); if (!so || !svg || !MTD) return;
    var R = so.getBoundingClientRect(), h = "", chu = {}, tat = {}, nang = {};
    var lap = (MTD.may.filter(function (x) { return x.duPhong && x.dung; })[0] || {}).may;   // việc chỉ chạy ở laptop → laptop (khớp chuCua trong ve)
    (MTD.viec || []).forEach(function (v) { chu[v.ten] = v.may || (v.chiLaptop ? lap : null); nang[v.ten] = !!v.nang; });
    MTD.may.forEach(function (m) { (m.viecNang || []).forEach(function (t) { nang[t] = true; }); (m.dungViec || []).forEach(function (t) { tat[t] = m.may; }); });
    so.querySelectorAll(".mt2-jv").forEach(function (j) { var t = j.dataset.viecChon, a = j.getBoundingClientRect();
      var noi = function (may, lop) { var el = so.querySelector('.mt2-mn[data-m="' + (window.CSS && CSS.escape ? CSS.escape(may) : may) + '"]'); if (!el) return; var b = el.getBoundingClientRect();
        var x1 = a.right - R.left + 2, y1 = a.top + a.height / 2 - R.top, x2 = b.left - R.left - 2, y2 = b.top + Math.min(b.height / 2, 20) - R.top, dx = (x2 - x1) * .55;
        h += '<path class="' + lop + (vuaMo && / hl/.test(lop) ? " vua-mo" : "") + '" d="M' + x1 + "," + y1 + " C" + (x1 + dx) + "," + y1 + " " + (x2 - dx) + "," + y2 + " " + x2 + "," + y2 + '"/>'; };
      var bat = MT_VIEC ? t === MT_VIEC : chu[t] === MT_CHON;
      if (chu[t]) noi(chu[t], (nang[t] ? "n" : "l") + (bat ? " hl" : " mo")); if (tat[t] && tat[t] !== chu[t]) noi(tat[t], "tat" + (MT_VIEC && t !== MT_VIEC ? " mo" : "")); });
    svg.innerHTML = h;
  }
  window.addEventListener("resize", function () { clearTimeout(H_VE); H_VE = setTimeout(function () { if (PANE && !PANE.classList.contains("hidden")) { if (!laDT() && MT_DT) { MT_DT = false; if (window.hskLop) window.hskLop.rut("mt-may"); ve(); } else veDuong(); } }, 120); });
  function init(pane) {
    PANE = pane; napCss();
    if (!MTD || CAN_DN) pane.innerHTML = '<div class="hx-mt">' + '<div class="panel"><div style="padding:18px 16px"><div class="sk sk-line" style="width:60%"></div><div class="sk sk-line" style="width:86%"></div><div class="sk sk-line" style="width:70%"></div></div></div>'.repeat(2) + "</div>";
    else ve();
    tai().then(ve);
    clearInterval(H);
    H = setInterval(function () { if (!PANE || PANE.classList.contains("hidden")) { clearInterval(H); var vo = document.getElementById("mt2Vo"); if (vo) vo.remove(); MT_DT = false; return; } if (!document.hidden) tai().then(ve); }, 30e3);
  }
  document.addEventListener("tk-doi", function () { MTD = null; CAN_DN = false; if (PANE && !PANE.classList.contains("hidden")) { PANE.innerHTML = ""; tai().then(ve); } });   // đăng nhập / đăng xuất hệ tài khoản
  window.addEventListener("hx-phien", function () {   // đăng xuất Xác minh trên máy quản lý → khoá lại ngay
    if (MAY_CHU && !phien()) { MTD = null; CAN_DN = true; DIEU_KHIEN = false; if (PANE && !PANE.classList.contains("hidden")) ve(); }
  });
  window.HMAYTRAM = { init: init, coDuLieu: function () { return !!MTD; }, veLai: function () { if (MTD) ve(); } };   // veLai: vẽ lại như nhịp 30 s (bộ đo X3)
})();
