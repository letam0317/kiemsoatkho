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
      ".hx-mt .panel{margin:0}.hx-mt .panel-head{display:block}.hx-mt-cu .hx-mt-sk{opacity:.45}.hx-mt-dau{display:flex;align-items:center;gap:8px;flex-wrap:wrap;width:100%}.hx-mt-dau b{font-size:15px}.hx-mt-dau .hx-nut{margin-left:auto}",
      ".hx-mt-sk{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:12px 16px 4px}.hx-mt-sk .lbl{font-size:12px;color:var(--muted)}.hx-mt-sk .so{font-size:18px;font-weight:700;font-variant-numeric:tabular-nums}",
      ".hx-mt-thanh{height:6px;border-radius:3px;background:var(--surface2);overflow:hidden;margin-top:4px}.hx-mt-thanh i{display:block;height:100%;background:var(--good)}.hx-mt-thanh i.warn{background:var(--warn)}.hx-mt-thanh i.bad{background:var(--bad,#dc2626)}",
      ".hx-mt-phu{padding:2px 16px 8px;font-size:12px;color:var(--muted)}",
      ".hx-mt-v{display:flex;align-items:center;gap:8px;min-height:44px;padding:6px 16px;border-top:1px solid var(--border)}.hx-mt-v .ten{flex:1;min-width:0;font-size:13.5px}.hx-mt-v .ten small{display:block;color:var(--muted);font-size:12px}",
      ".hx-mt-v .hx-nut{min-height:34px;padding:0 12px;font-size:13px;background:var(--surface);color:var(--text);border-color:var(--border)}.hx-mt-v .hx-nut:hover{border-color:var(--accent);color:var(--accent)}",
      "@media(max-width:560px){.hx-mt-v .hx-nut,.hx-mt-dau .hx-nut{min-height:44px}#pane-maytram .panel-head{flex-direction:column;align-items:flex-start;gap:2px}}"
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
  function goiGas() {   // JSONP — cùng khuôn readTab của dashboard (khoá thiết bị tb-khoa)
    return new Promise(function (res, rej) {
      var cb = "__mt_cb" + Date.now(), s = document.createElement("script"), xong = false;
      var tb = ""; try { tb = localStorage.getItem("tb-khoa") || ""; } catch (e) {}
      var dung = function () { xong = true; try { delete window[cb]; } catch (e) { window[cb] = undefined; } s.remove(); clearTimeout(h); };
      var h = setTimeout(function () { if (!xong) { dung(); rej(new Error("Apps Script không trả lời sau 45 giây")); } }, 45000);
      window[cb] = function (j) { if (xong) return; dung(); if (j && j.status === "success") res(j); else rej(new Error((j && j.message) || "Apps Script trả lỗi")); };
      s.onerror = function () { if (!xong) { dung(); rej(new Error("Mất mạng — bấm thử lại")); } };
      s.src = GAS + "?action=pcBangTb&callback=" + cb + "&tb=" + encodeURIComponent(tb) + "&_=" + Date.now();
      document.head.appendChild(s);
    });
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
  function dongMayChu() {
    if (!phien()) return Promise.resolve(false);
    if (window.__HX_MAY_CHU) return Promise.resolve(true);
    var ctl = new AbortController(), h = setTimeout(function () { ctl.abort(); }, 1500);
    return fetch(API + "/api/ping", { signal: ctl.signal }).then(function (r) { clearTimeout(h); return r.ok; }).catch(function () { return false; });
  }
  function tai() { return dongMayChu().then(taiTheo); }
  function taiTheo(coMayChu) {
    var p = coMayChu ? goi591("/api/may-tram").then(function (j) { DIEU_KHIEN = true; return j; })
      .catch(function (e) { if (e.ma === 401) { DIEU_KHIEN = false; return goiGas().then(chuanGas); } throw e; })   // phiên Xác minh hết → vẫn xem được qua GAS
      : goiGas().then(function (j) { DIEU_KHIEN = false; return chuanGas(j); });
    return p.then(function (d) { MTD = d; MT_LOI = "";
      if (window.tqGhi) tqGhi("mt", { song: d.may.filter(function (m) { return m.song && !m.dung; }).length, tong: d.may.length }); })
      .catch(function (e) { MT_LOI = e.name === "AbortError" ? "Máy chủ không trả lời sau 45 giây" : e.message; });
  }

  /* ---------- vẽ ---------- */
  function tuoiChu(s) { if (s == null || isNaN(s)) return "—"; if (s < 60) return s + " giây trước"; if (s < 3600) return Math.round(s / 60) + " phút trước"; if (s < 86400) return Math.round(s / 3600) + " giờ trước"; return Math.round(s / 86400) + " ngày trước"; }
  function ve() {
    if (!PANE) return;
    if (!MTD) { PANE.innerHTML = '<div class="panel" style="margin-top:4px"><div class="hx-trong">Chưa đọc được bảng máy trạm: ' + e_(MT_LOI || "không rõ lỗi") + " — tự thử lại sau 30 giây.</div></div>"; return; }
    var dangChuyen = {}; (MTD.chuyen || []).forEach(function (c) { dangChuyen[c.viec] = c; });
    var mayCua = {}; (MTD.viec || []).forEach(function (v) { mayCua[v.ten] = v.may; });
    var mucDo = function (pct, vang, doo) { return pct >= doo ? "bad" : pct >= vang ? "warn" : ""; };
    var o = function (lbl, so, pct, lop) { return '<div><div class="lbl">' + lbl + '</div><div class="so">' + so + '</div><div class="hx-mt-thanh"><i class="' + lop + '" style="width:' + Math.max(0, Math.min(100, pct)) + '%"></i></div></div>'; };
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
      }).join("") || '<div class="hx-mt-v"><div class="ten muted">' + (m.dung ? "Máy đang dừng — việc đã chuyển sang máy khác." : m.song ? "Chưa được giao việc nào (máy khác mạnh hơn hoặc máy này thiếu khoá)." : "Máy không gửi nhịp — việc của nó đã tự chuyển sang máy còn sống.") + "</div></div>";
      return '<div class="panel' + (m.song ? "" : " hx-mt-cu") + '"><div class="panel-head"><div class="hx-mt-dau"><b>' + e_(m.may) + '</b><span class="hx-tag ' + tt[1] + '">' + tt[0] + "</span>" +
        (!m.song && !m.dung ? nut('data-may="' + e_(m.may) + '" data-xoa="1"', "Gỡ khỏi danh sách", 1)   // máy im: dừng vô nghĩa (việc đã tự chuyển), chỉ còn gỡ
          : nut('data-may="' + e_(m.may) + '" data-dung="' + (m.dung ? "0" : "1") + '"', m.dung ? "Cho chạy lại" : "Dừng máy", !m.dung)) + "</div></div>" +
        '<div class="hx-mt-sk">' + o("RAM đang dùng", ramDung + "%", ramDung, mucDo(ramDung, 70, 85)) + o("CPU", cpu + "%", cpu, mucDo(cpu, 70, 90)) +
        o("Ổ C còn trống", dia == null ? "—" : dia + " GB", dia == null ? 0 : Math.min(100, dia / 0.5), dia == null ? "" : dia < 3 ? "bad" : dia < 10 ? "warn" : "") + "</div>" +
        '<div class="hx-mt-phu">Nhịp tim ' + e_(tuoiChu(m.tuoiGiay)) + " · " + (m.nhan || "?") + " nhân, " + (m.ramTongGB || "?") + " GB RAM · điểm " + (m.diem || 0) + (m.ban ? " · bản " + e_(m.ban) : "") +
        ((m.coKhoa || []).indexOf("TOPREVIEW_USER") < 0 ? " · không có khoá camera" : "") + (m.dung && m.lenhBoi ? " · dừng bởi " + e_(m.lenhBoi) : "") + "</div>" + dongViec + "</div>";
    };
    var chuaCo = (MTD.viec || []).filter(function (v) { return !v.may; });
    var h = '<div class="hx-mt">' + (MTD.may.length ? MTD.may.map(the).join("") : '<div class="panel"><div class="hx-trong">Chưa PC nào gửi nhịp tim. Cài bằng nút «Tải bộ cài PC» ở trang Tổng quan; PC gửi nhịp mỗi phút.</div></div>') + "</div>";
    if (chuaCo.length) h += '<div class="panel" style="margin-top:14px"><div class="panel-head"><span>Việc chưa có máy nhận</span><span>' + chuaCo.length + "</span></div>" +
      chuaCo.map(function (v) { var c = dangChuyen[v.ten]; return '<div class="hx-mt-v"><div class="ten"><b>' + e_(tenV(v.ten)) + "</b><small>" +
        (c ? "Bị dừng giữa chừng ở " + e_(c.tu) + " · chờ máy khác chạy bù" : v.nang && (v.canKhoa || []).length ? "Cần máy còn sống, không bị dừng, có khoá " + e_(v.canKhoa.join(", ")) : "Cần máy còn sống, không bị dừng") + "</small></div></div>"; }).join("") + "</div>";
    PANE.innerHTML = h;
    if (!DIEU_KHIEN) return;
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
    if (!MTD) pane.innerHTML = '<div class="hx-mt">' + '<div class="panel"><div style="padding:18px 16px"><div class="sk sk-line" style="width:60%"></div><div class="sk sk-line" style="width:86%"></div><div class="sk sk-line" style="width:70%"></div></div></div>'.repeat(2) + "</div>";
    else ve();
    tai().then(ve);
    clearInterval(H);
    H = setInterval(function () { if (!PANE || PANE.classList.contains("hidden")) { clearInterval(H); return; } if (!document.hidden) tai().then(ve); }, 30e3);
  }
  window.HMAYTRAM = { init: init, coDuLieu: function () { return !!MTD; } };
})();
