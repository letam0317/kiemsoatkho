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
  var API = "http://127.0.0.1:8591";
  var GAS = "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
  var HET_HAN_GIAY = 180;   // = hetHanPhut 3' của cai-pc/dieu-phoi.json: nhịp cũ hơn ⇒ máy coi như im
  var PANE = null, MTD = null, MT_LOI = "", DIEU_KHIEN = false, H = null;
  var TEN_VIEC = { "canh-b11": "Cò canh B1.1", "canh-xac-minh-b1": "Cò xác minh B1", "tim-bang-chung-b1": "Tìm bằng chứng B1",
    "canh-bai-xe-sang": "Canh bãi xe sáng", "canh-bai-xe-chieu": "Canh bãi xe chiều", "canh-bai-xe-toi": "Canh bãi xe tối", "xac-minh-camera": "Xác minh camera tối",
    "co-canh-planogram": "Cò canh planogram", "dong-bo-dashboard": "Đồng bộ dashboard", "packer-a8-sang": "Packer A8 sáng", "packer-a8-chieu": "Packer A8 chiều",
    "cham-cong": "Chấm công", "watchdog-ton-kho": "Canh tồn kho" };
  var tenV = function (t) { return TEN_VIEC[t] || t; };
  var e_ = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var phien = function () { try { return localStorage.getItem("hx-phien") || ""; } catch (e) { return ""; } };

  function napCss() {
    if (document.getElementById("mt-css")) return;
    var c = [
      /* nhãn + nút dùng lại khuôn Xác minh (chép đúng luật để tab này đứng một mình được khi Xác minh không nạp) */
      ".hx-tag{display:inline-block;font-size:11px;font-weight:700;border-radius:20px;padding:2px 8px;margin:0 4px 2px 0;border:1px solid var(--border);background:var(--surface2);color:var(--muted);white-space:nowrap}",
      ".hx-tag.bad{color:var(--bad);border-color:color-mix(in srgb,var(--bad) 40%,transparent);background:color-mix(in srgb,var(--bad) 9%,transparent)}",
      ".hx-tag.warn{color:var(--warn);border-color:color-mix(in srgb,var(--warn) 40%,transparent);background:color-mix(in srgb,var(--warn) 10%,transparent)}",
      ".hx-tag.good{color:var(--good);border-color:color-mix(in srgb,var(--good) 40%,transparent);background:color-mix(in srgb,var(--good) 9%,transparent)}",
      ".hx-tag.info{color:var(--info,var(--accent));border-color:color-mix(in srgb,var(--info,var(--accent)) 35%,transparent)}",
      ".hx-trong{padding:28px 18px;text-align:center;color:var(--muted)}",
      ".hx-nut{min-height:40px;border-radius:10px;border:1px solid var(--accent);background:var(--accent);color:var(--accent-text,#fff);font-weight:650;padding:0 14px;cursor:pointer}.hx-nut[disabled]{opacity:.55;cursor:not-allowed}",
      ".hx-nut.phu{background:var(--surface);color:var(--text);border-color:var(--border)}.hx-nut.phu:hover{border-color:var(--bad,#dc2626);color:var(--bad,#dc2626)}",
      ".hx-mt{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px;align-items:start;margin-top:4px}@media(max-width:560px){.hx-mt{grid-template-columns:minmax(0,1fr)}}",
      ".hx-mt .panel{margin:0}.hx-mt .panel-head{display:block}.hx-mt-cu .hx-mt-sk{opacity:.45}.hx-mt-dau{display:flex;align-items:center;gap:8px;flex-wrap:nowrap;width:100%}.hx-mt-dau b{font-size:15px;min-width:0;flex:0 1 auto;overflow-wrap:anywhere;line-height:20px}.hx-mt-dau .hx-tag{flex:none;margin:0}.hx-mt-dau .hx-nut{margin-left:auto;flex:none}",   // 14/10: tên máy dài từng đẩy nút xuống dòng 2
      ".hx-mt-sk{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:12px 16px 4px}.hx-mt-sk .lbl{font-size:12px;color:var(--muted)}.hx-mt-sk .so{font-size:18px;font-weight:700;font-variant-numeric:tabular-nums}",
      ".hx-mt-thanh{height:6px;border-radius:3px;background:var(--surface2);overflow:hidden;margin-top:4px}.hx-mt-thanh i{display:block;height:100%;background:var(--good)}.hx-mt-thanh i.warn{background:var(--warn)}.hx-mt-thanh i.bad{background:var(--bad,#dc2626)}",
      ".hx-mt-phu{padding:2px 16px 8px;font-size:12px;color:var(--muted)}",
      ".hx-mt-xin{margin:4px 0 14px;border-color:color-mix(in srgb,var(--warn) 55%,var(--border))}.hx-mt-xin .ma{font-family:ui-monospace,Consolas,monospace;font-size:14px;letter-spacing:2px;color:var(--text)}",
      ".hx-mt-ly{padding:10px 16px;border-top:1px solid var(--border)}.hx-mt-ly .ly{font-size:13px;color:var(--muted);margin-bottom:6px}.hx-mt-ly .ds{display:flex;flex-wrap:wrap;gap:6px}.hx-mt-ly .hx-tag{margin:0;font-weight:600;font-size:12px;color:var(--text)}",
      ".hx-mt-v{display:flex;align-items:center;gap:8px;min-height:44px;padding:6px 16px;border-top:1px solid var(--border)}.hx-mt-v .ten{flex:1;min-width:0;font-size:13.5px}.hx-mt-v .ten small{display:block;color:var(--muted);font-size:12px}",
      ".hx-mt-v .hx-nut{min-height:34px;padding:0 12px;font-size:13px;background:var(--surface);color:var(--text);border-color:var(--border)}.hx-mt-v .hx-nut:hover{border-color:var(--accent);color:var(--accent)}",
      "@media(max-width:560px){.hx-mt-v .hx-nut,.hx-mt-dau .hx-nut,#mtDangXuat{min-height:44px}}",   // 14/10: bỏ xếp dọc panel-head (số «13» rơi xuống dòng riêng, phí chỗ)
      /* form đăng nhập — cùng khuôn .hx-dn của Xác minh */
      ".mt-dn{max-width:400px;margin:24px auto}.mt-dn form{display:flex;flex-direction:column;gap:12px;padding:16px}.mt-dn label{display:flex;flex-direction:column;gap:4px}.mt-dn input{min-height:44px;font-size:16px}",
      ".mt-st.loi{margin-top:4px;font-size:13px;padding:8px 12px;border-radius:10px;background:color-mix(in srgb,var(--bad) 10%,transparent);color:var(--bad)}"
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
    return { srvNow: now, may: may, viec: tatCa.map(function (t) { return { ten: t, may: chu[t] || null, canKhoa: [] }; }), chuyen: j.chuyen || [] };
  }
  // Máy quản lý? Thanh bên dò 8591 bất đồng bộ (~1,5 s) — mở thẳng ?tab=maytram thì module chạy TRƯỚC ⇒ tự dò, đừng chờ.
  var MAY_CHU = false, CAN_DN = false;
  function dongMayChu() {
    if (window.__HX_MAY_CHU) return Promise.resolve(true);
    var ctl = new AbortController(), h = setTimeout(function () { ctl.abort(); }, 1500);
    return fetch(API + "/api/ping", { signal: ctl.signal }).then(function (r) { clearTimeout(h); return r.ok; }).catch(function () { return false; });
  }
  function tai() {
    return dongMayChu().then(function (co) {
      MAY_CHU = co;
      if (co) {   // máy quản lý: cần phiên Xác minh (8591) — đầy đủ + nút điều khiển
        if (!phien()) { CAN_DN = true; return null; }
        return goi591("/api/may-tram").then(function (j) { DIEU_KHIEN = true; CAN_DN = false; return j; })
          .catch(function (e) { if (e.ma === 401) { try { localStorage.removeItem("hx-phien"); } catch (x) {} CAN_DN = true; return null; } throw e; });
      }
      var mp = mtPhien(); if (!mp) { CAN_DN = true; return null; }
      return postGas({ action: "pcBangPh", ph: mp.ph }).then(function (j) {
        if (j.status !== "success") { if (j.code === 401) { try { localStorage.removeItem("mt-phien"); } catch (x) {} CAN_DN = true; return null; } throw new Error(j.message || "Apps Script trả lỗi"); }
        DIEU_KHIEN = false; CAN_DN = false; return chuanGas(j); });
    }).then(function (d) { MTD = d; MT_LOI = "";
      if (d && window.tqGhi) tqGhi("mt", { song: d.may.filter(function (m) { return m.song && !m.dung; }).length, tong: d.may.length }); })
      .catch(function (e) { MT_LOI = e.name === "AbortError" ? "Máy chủ không trả lời sau 45 giây" : e.message; });
  }
  function veDangNhap(thongBao) {
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
  function ve() {
    if (!PANE) return;
    if (CAN_DN) { if (!document.getElementById("mtDnForm")) veDangNhap(); return; }   // đang gõ thì không vẽ đè form
    if (!MTD) { PANE.innerHTML = '<div class="panel" style="margin-top:4px"><div class="hx-trong">Chưa đọc được bảng máy trạm: ' + e_(MT_LOI || "không rõ lỗi") + " — tự thử lại sau 30 giây.</div></div>"; return; }
    var dangChuyen = {}; (MTD.chuyen || []).forEach(function (c) { dangChuyen[c.viec] = c; });
    var mayCua = {}; (MTD.viec || []).forEach(function (v) { mayCua[v.ten] = v.may; });
    var mucDo = function (pct, vang, doo) { return pct >= doo ? "bad" : pct >= vang ? "warn" : ""; };
    var o = function (lbl, so, pct, lop) { return '<div><div class="lbl">' + lbl + '</div><div class="so">' + so + '</div><div class="hx-mt-thanh"><i class="' + lop + '" style="width:' + Math.max(0, Math.min(100, pct)) + '%"></i></div></div>'; };
    var coMayKhac = function (m) { return MTD.may.some(function (x) { return x.may !== m.may && x.song && !x.dung; }); };
    var tenBoi = function (b) { return /^bo cai/.test(b) ? "bộ cài (máy quản lý)" : b; };   // nhãn ASCII do bộ cài gửi → tiếng Việt
    var nut = function (attr, chu, phu) { return DIEU_KHIEN ? '<button class="hx-nut' + (phu ? " phu" : "") + '" ' + attr + ">" + chu + "</button>" : ""; };
    var the = function (m) {
      var tt = !m.song ? ["Mất nhịp", "bad"] : m.dung ? ["Đã dừng", "warn"] : m.yeu ? ["Đang chạy · yếu", "warn"] : ["Đang chạy", "good"];
      var ramDung = Math.round(100 - (m.ramTrongPct || 0)), cpu = Math.round(m.cpuPct || 0), dia = m.diaTrongGB;
      var viec = []; (m.viecGiao || []).concat(m.dangChay || [], m.dungViec || []).forEach(function (t) { if (viec.indexOf(t) < 0) viec.push(t); });
      var dongViec = viec.map(function (t) {
        var dung = (m.dungViec || []).indexOf(t) >= 0, chay = (m.dangChay || []).indexOf(t) >= 0, sang = mayCua[t];
        var trang = dung ? '<span class="hx-tag warn">Dừng ở máy này</span>' + (sang && sang !== m.may ? ' <small>→ chuyển sang <b>' + e_(sang) + "</b></small>" : "")   // chưa ai nhận: đã có khối «Việc chưa có máy nhận», không nhắc lại
          : chay ? '<span class="hx-tag good">Đang chạy</span>' : (m.viecGiao || []).indexOf(t) >= 0 ? '<span class="hx-tag info">Được giao · chờ lịch</span>' : '<span class="hx-tag">Đang chạy dở (đã giao máy khác)</span>';
        return '<div class="hx-mt-v"><div class="ten"><b>' + e_(tenV(t)) + "</b><small>" + trang + "</small></div>" +
          (m.dung ? "" : nut('data-may="' + e_(m.may) + '" data-viec="' + e_(t) + '" data-dung="' + (dung ? "0" : "1") + '"', dung ? "Tiếp tục" : "Dừng")) + "</div>";
      }).join("") || '<div class="hx-mt-v"><div class="ten muted">' + (m.dung ? (coMayKhac(m) ? "Đang dừng — việc do máy khác làm." : "Đang dừng — không nhận việc.")   // 14/10 user: câu cũ nói «đã chuyển sang máy khác» khi không có máy nào khác
        : m.song ? "Chưa được giao việc (máy khác mạnh hơn hoặc máy này thiếu khoá)." : (coMayKhac(m) ? "Không gửi nhịp — việc đã chuyển sang máy khác." : "Không gửi nhịp.")) + "</div></div>";
      return '<div class="panel' + (m.song ? "" : " hx-mt-cu") + '"><div class="panel-head"><div class="hx-mt-dau"><b title="' + e_(m.may) + '">' + e_(m.may) + '</b><span class="hx-tag ' + tt[1] + '">' + tt[0] + "</span>" +
        (!m.song && !m.dung ? nut('data-may="' + e_(m.may) + '" data-xoa="1"', "Gỡ khỏi danh sách", 1)   // máy im: dừng vô nghĩa (việc đã tự chuyển), chỉ còn gỡ
          : nut('data-may="' + e_(m.may) + '" data-dung="' + (m.dung ? "0" : "1") + '"', m.dung ? "Cho chạy lại" : "Dừng máy", !m.dung)) + "</div></div>" +
        '<div class="hx-mt-sk">' + o("RAM đang dùng", ramDung + "%", ramDung, mucDo(ramDung, 70, 85)) + o("CPU", cpu + "%", cpu, mucDo(cpu, 70, 90)) +
        o("Ổ C còn trống", dia == null ? "—" : dia + " GB", dia == null ? 0 : Math.min(100, dia / 0.5), dia == null ? "" : dia < 3 ? "bad" : dia < 10 ? "warn" : "") + "</div>" +
        /* 14/10 user «rối, dài dòng»: dòng phụ chỉ giữ thứ cần đọc; cấu hình máy (nhân · RAM · điểm xếp hạng) vào chú thích rê chuột */
        '<div class="hx-mt-phu" title="' + e_((m.nhan || "?") + " nhân · " + (m.ramTongGB || "?") + " GB RAM · điểm xếp hạng " + (m.diem || 0)) + '">Nhịp tim ' + e_(tuoiChu(m.tuoiGiay)) + (m.ban ? " · bản " + e_(m.ban) : "") +
        ((m.coKhoa || []).indexOf("TOPREVIEW_USER") < 0 ? " · không có khoá camera" : "") + (m.dung && m.lenhBoi ? " · dừng bởi " + e_(tenBoi(m.lenhBoi)) : "") + "</div>" + dongViec + "</div>";
    };
    var chuaCo = (MTD.viec || []).filter(function (v) { return !v.may; });
    /* 14/10: PC cài bằng bộ cài tải NGAY TRÊN PC (không khoá) gửi yêu cầu xin khoá + hiện MÃ XÁC NHẬN trên màn PC. Chỉ máy quản lý duyệt.
       So mã trên màn PC với mã ở đây — khác nhau là có máy giả tên, bấm Từ chối. */
    var xin = (MTD.xin || []).filter(function (x) { return !x.daDuyet; });
    var hXin = DIEU_KHIEN && xin.length ? '<div class="panel hx-mt-xin"><div class="panel-head"><span>PC xin khoá</span><span>' + xin.length + "</span></div>" +
      xin.map(function (x) { return '<div class="hx-mt-v"><div class="ten"><b>' + e_(x.may) + "</b><small>Mã xác nhận <b class=\"ma\">" + e_(x.maXN) + "</b> · xin " + e_(tuoiChu(Math.round((Date.now() - x.luc) / 1000))) + " · so với mã trên màn hình PC</small></div>" +
        '<button class="hx-nut phu" data-xin="' + e_(x.may) + '" data-dongy="0">Từ chối</button><button class="hx-nut" data-xin="' + e_(x.may) + '" data-dongy="1">Duyệt</button></div>'; }).join("") + "</div>" : "";
    var h = hXin + '<div class="hx-mt">' + (MTD.may.length ? MTD.may.map(the).join("") : '<div class="panel"><div class="hx-trong">Chưa PC nào gửi nhịp tim. Cài bằng nút «Tải bộ cài PC» ở trang Tổng quan; PC gửi nhịp mỗi phút.</div></div>') + "</div>";
    /* 14/10 user «hiển thị rối, dài dòng»: 13 dòng lặp cùng 1 câu lý do + tên khoá kỹ thuật ⇒ GOM THEO LÝ DO (luật không lặp thông tin):
       mỗi lý do 1 dòng lời thường, tên việc xếp gọn dưới. Không còn PC nào chạy thì chỉ 1 lý do chung. */
    if (chuaCo.length) {
      var conMay = MTD.may.some(function (m) { return m.song && !m.dung; }), nhom = [], theo = {};
      chuaCo.forEach(function (v) { var c = dangChuyen[v.ten], k = (v.canKhoa || []);
        var ly = c ? "Bị dừng giữa chừng ở " + c.tu + " — chờ máy khác chạy bù" : !conMay ? "Chưa có PC nào đang chạy"
          : k.indexOf("TOPREVIEW_USER") >= 0 ? "Cần PC có khoá camera" + (k.indexOf("GEMINI_API_KEY") >= 0 ? " và khoá AI" : "") : "Cần PC đang chạy";
        if (!theo[ly]) { theo[ly] = []; nhom.push(ly); } theo[ly].push(tenV(v.ten)); });
      h += '<div class="panel" style="margin-top:14px"><div class="panel-head"><span>Việc chưa có máy nhận</span><span>' + chuaCo.length + "</span></div>" +
        nhom.map(function (ly) { return '<div class="hx-mt-ly"><div class="ly">' + e_(ly) + '</div><div class="ds">' + theo[ly].map(function (t) { return '<span class="hx-tag">' + e_(t) + "</span>"; }).join("") + "</div></div>"; }).join("") + "</div>";
    }
    if (!MAY_CHU && mtPhien()) h += '<div style="text-align:center;margin:14px 0"><button type="button" class="hx-nut phu" id="mtDangXuat">Đăng xuất</button></div>';
    PANE.innerHTML = h;
    var dx = document.getElementById("mtDangXuat");
    if (dx) dx.onclick = function () { var mp = mtPhien(); try { localStorage.removeItem("mt-phien"); } catch (e) {} MTD = null; CAN_DN = true;
      if (mp) postGas({ action: "pcDangXuat", ph: mp.ph }).catch(function () {}); veDangNhap(); };
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
    PANE.querySelectorAll("button[data-may]").forEach(function (n) {
      n.onclick = function () {
        var dung = n.dataset.dung === "1", xoa = n.dataset.xoa === "1", viec = n.dataset.viec || "", cu = n.textContent;
        n.disabled = true; n.textContent = "Đang gửi…";
        goi591("/api/may-tram/lenh", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ may: n.dataset.may, viec: viec, dung: dung, xoa: xoa }) })
          .then(function (j) {
            if (typeof toast === "function") toast(xoa ? "Đã gỡ " + n.dataset.may + " khỏi danh sách" : (dung ? "Đã dừng " : "Đã cho chạy lại ") + (viec ? tenV(viec) + " trên " : "") + n.dataset.may + (j.daChuyen && j.daChuyen.length ? " — đang chuyển " + j.daChuyen.map(tenV).join(", ") + " sang máy khác" : ""), "ok");
            return tai().then(ve);
          })
          .catch(function (e) { if (typeof toast === "function") toast("Không gửi được lệnh: " + e.message, "loi"); })
          .finally(function () { if (document.body.contains(n)) { n.disabled = false; n.textContent = cu; } });
      };
    });
  }

  function init(pane) {
    PANE = pane; napCss();
    if (!MTD || CAN_DN) pane.innerHTML = '<div class="hx-mt">' + '<div class="panel"><div style="padding:18px 16px"><div class="sk sk-line" style="width:60%"></div><div class="sk sk-line" style="width:86%"></div><div class="sk sk-line" style="width:70%"></div></div></div>'.repeat(2) + "</div>";
    else ve();
    tai().then(ve);
    clearInterval(H);
    H = setInterval(function () { if (!PANE || PANE.classList.contains("hidden")) { clearInterval(H); return; } if (!document.hidden) tai().then(ve); }, 30e3);
  }
  window.addEventListener("hx-phien", function () {   // đăng xuất Xác minh trên máy quản lý → khoá lại ngay
    if (MAY_CHU && !phien()) { MTD = null; CAN_DN = true; DIEU_KHIEN = false; if (PANE && !PANE.classList.contains("hidden")) ve(); }
  });
  window.HMAYTRAM = { init: init, coDuLieu: function () { return !!MTD; } };
})();
