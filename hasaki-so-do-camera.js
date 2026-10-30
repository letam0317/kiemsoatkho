/* hasaki-so-do-camera.js — mục con «Sơ đồ camera» của Xác minh (24/10/2026). Nạp lười từ hasaki-xacminh.js (SUB «sodo»).
 * User: «phân tích kết hợp sơ đồ kho / hình ảnh / góc cam để gán góc cam hiện tại lên vị trí ở sơ đồ kho — làm sao khớp thực tế nhất;
 *        chỉ quản trị tamlc xem được, kể cả điện thoại và 4G».
 *
 * TỆP NÀY CÔNG KHAI (repo + Pages) ⇒ KHÔNG chứa dữ liệu camera. Tên kênh, ô đã kiểm, khung hình, hiệu chỉnh đều tải từ máy chủ 8591
 * (/api/so-do-camera, chỉ phiên tài khoản tamlc — so-do-camera.mjs). Nền sơ đồ = kho170-sodo.js (đã công khai từ 16/09, mặt bằng CAD).
 *
 * BẬC TIN CẬY (cao → thấp) — mỗi camera hiện đúng 1 bậc, có giải thích:
 *   hc  HIỆU CHỈNH: ≥ 4 cặp điểm SÀN (ảnh ↔ sơ đồ) → phép chiếu phẳng H (DLT chuẩn hoá). Từ H suy ngược chỗ lắp, độ cao, hướng, góc nhìn
 *       (tách K·[r1 r2 t], dò tiêu cự f cho r1 ⊥ r2) + vùng sàn nhìn thấy + ô trong khung. Sai số = kiểm chéo bỏ-1-điểm (≥ 5 điểm).
 *       Tốt: ≥ 5 điểm, sai số ≤ 0,5 m, cao lắp 2–12 m · Tạm: ≤ 1 m (hoặc đúng 4 điểm — chưa kiểm chéo được) · Kém: còn lại.
 *   tay ĐẶT TAY: người đặt chỗ + hướng + góc trên sơ đồ (cảnh không thấy sàn: cổng, hành lang hẹp).
 *   nk  NGƯỜI KIỂM: ô người xác minh đã thấy trên kênh này (ban-do-camera-o.json, kèm phiếu nguồn).
 *   ten THEO TÊN KÊNH: «501_1-3» = dãy 501 tủ 1–3 · «KE <dãy> - <dãy> Sau» = kệ A2 các dãy đó · tên khu khớp nhãn khu trên bản vẽ.
 *   chua chưa đặt được.
 * KIỂM CHÉO (máy tự cảnh báo, không AI): góc đổi (khung mới so với dấu lúc hiệu chỉnh, tương quan ảnh xám 32×18 < 0,6) · lệch tên kênh
 * (ô tên kênh nói mà khung nhìn không thấy) · cao lắp vô lý · kênh ghi trùng (cùng tên trên đầu ghi khác) dùng chung hiệu chỉnh để so.
 */
(function () {
  "use strict";
  if (window.HXSODO) return;
  var T = window.hskTienIch || {}, $id = T.$id || function (i) { return document.getElementById(i); };
  var e_ = T.esc || function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var W = 1280, H_ = 720, CX = 640, CY = 360, TAM_TOI_DA = 35;
  var CTX = null, D = null, SD = null, HOST = null, NAP = null;
  var S = { chon: "", hc: null };
  var ANH = {};   // khoá → objectURL khung hình (tải bằng tiêu đề phiên, không để phiên trong URL)

  /* ---------- kệ sát tường 5L (cùng hệ toạ độ sơ đồ — chép từ kho170-3d.html L5, nguồn DCMTG1) ---------- */
  var L5 = {
    "5L1": { tr: "y", v0: 12.70, sau: 1.0, z: [4.29, 5.39, 6.49, 7.59, 9.29, 10.39, 11.49, 12.59, 13.69, 15.29, 16.39, 17.49, 18.59, 19.69, 21.39, 22.49, 23.59, 24.69, 25.79, 27.39, 28.49, 29.59, 30.69, 31.79], lui: 0.27 },
    "5L2": { tr: "x", v0: 3.01, sau: 1.0, z: [13.86, 14.96, 16.06, 17.16, 18.26, 19.36, 20.46, 21.46, 22.56, 23.56, 24.56, 25.56, 26.56, 27.66, 28.66, 29.66, 30.66, 31.66, 32.76, 33.76, 34.76, 35.76, 36.76, 37.86, 38.86, 39.86], lui: 0.04 },
    "5L3": { tr: "y", v0: 42.50 - 1.1, sau: 1.1, z: [6.49, 7.59, 9.29, 10.39, 11.49, 12.49, 13.59, 15.19, 16.29, 17.39, 18.49, 19.59, 21.19, 22.29, 23.39, 24.49, 25.59, 27.39, 28.49, 29.59, 30.69, 31.79, 33.49, 34.59, 35.69, 36.79, 37.89], lui: 0.27 }
  };
  var O = {}, GOC = [];   // mã ô → hình chữ nhật (m) · mọi góc ô để «hút» điểm khi bấm sơ đồ
  function dungO() {
    if (GOC.length || !SD) return;
    SD.o.forEach(function (o) { if (o.loc) O[o.loc] = { x: o.x, y: o.y, w: o.w, h: o.h }; GOC.push([o.x, o.y], [o.x + o.w, o.y], [o.x, o.y + o.h], [o.x + o.w, o.y + o.h]); });
    Object.keys(L5).forEach(function (k) { var c = L5[k];
      c.z.forEach(function (z, i) { var u0 = z - c.lui, r = c.tr === "y" ? { x: c.v0, y: u0, w: c.sau, h: 1 } : { x: u0, y: c.v0, w: 1, h: c.sau };
        O["F0-A1-" + k + "-" + String(i + 1).padStart(2, "0")] = r; GOC.push([r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]); }); });
  }

  /* ---------- đọc tên kênh → ô / khu ---------- */
  var boDau = function (s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim(); };
  var CHUNG = /^(IPC|CAMERA ?\d*|CAMERA_\d+|CAMERA \d+)$/;
  function goiYTen(ten) {
    var t = String(ten || "").trim(), m, o = [];
    if ((m = /^(\d{3}|5L\d)(?:-(\d{3}))?_(\d+)-(\d+)$/i.exec(t))) {   // A1: 501_1-3 · 502-503_6-8 · 5L3_18-27
      var day = [m[1].toUpperCase()]; if (m[2]) day.push(m[2]);
      day.forEach(function (d) { for (var i = +m[3]; i <= +m[4]; i++) o.push("F0-A1-" + d + "-" + String(i).padStart(2, "0")); });
      return { o: o, mo: "Kệ A1 " + day.join(" + ") + " · tủ " + m[3] + "–" + m[4] };
    }
    if ((m = /^A2\s*-\s*(\d{3})$/i.exec(t))) return { o: oCuaDay("A2", +m[1], +m[1]), mo: "Kệ A2 dãy " + m[1] };
    if ((m = /^KE\s+(\d{3})(?:\s*-?\s*(\d{3}))?(?:\s*-?\s*(\d{3}))?/i.exec(t))) {   // «KE <dãy> - <dãy> Sau|Truoc|Dau», có tên chỉ 2 số không gạch
      var ds = [m[1], m[2], m[3]].filter(Boolean).map(Number), a = Math.min.apply(null, ds), b = Math.max.apply(null, ds);
      var phia = /SAU/i.test(t) ? " · phía sau" : /TRUOC/i.test(t) ? " · phía trước" : /DAU/i.test(t) ? " · đầu dãy" : "";
      return { o: oCuaDay("A2", a, b), mo: "Kệ A2 dãy " + (a === b ? a : a + "–" + b) + phia };
    }
    /* bí danh CHẮC (đã đối chiếu): tên kênh ↔ nhãn bản vẽ viết khác nhau. Phòng cắt giấy = khu phân loại rác (phiếu 14010729, 02/10) */
    var BD_ = boDau(t), BI = [[/\bOUT ([123])\b/, function (m) { return "OUT " + m[1]; }], [/\bRE IT\b/, function () { return "RE IT"; }],
      [/\bPHONG CAT GIAY\b/, function () { return "KHU VUC PHAN LOAI RAC DONG GOI"; }], [/\bORTERY\b/, function () { return "ORTERY"; }]];
    for (var bi = 0; bi < BI.length; bi++) { var mb = BI[bi][0].exec(BD_); if (!mb) continue; var dich = BI[bi][1](mb);
      var kh = (SD ? SD.khu : []).find(function (k) { return boDau(k.s) === dich; }); if (kh) return { o: [], khu: kh, mo: "Gần nhãn «" + kh.s + "» trên bản vẽ" }; }
    /* tên khu: khớp nhãn khu trên bản vẽ theo chữ (bỏ dấu) — ít nhất 2 chữ trùng, không tính chữ chung chung */
    var BO ={ KHU: 1, VUC: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1 };
    var tu = boDau(t).split(" ").filter(function (x) { return x && !BO[x]; }), tot = null;
    if (tu.length && !CHUNG.test(boDau(t))) (SD ? SD.khu : []).forEach(function (k) {
      var tk = boDau(k.s).split(" "), n = tu.filter(function (x) { return tk.indexOf(x) >= 0; }).length;
      if (n >= Math.min(2, tu.length) && (!tot || n > tot.n)) tot = { n: n, khu: k };
    });
    return tot ? { o: [], khu: tot.khu, mo: "Gần nhãn «" + tot.khu.s + "» trên bản vẽ (khớp chữ)" } : null;
  }
  function oCuaDay(khu, a, b) { return Object.keys(O).filter(function (k) { var p = k.split("-"); return p[1] === khu && +p[2] >= a && +p[2] <= b; }); }
  function bao(ds) {   // hộp bao các ô (m)
    var r = null; ds.forEach(function (k) { var o = O[k]; if (!o) return;
      r = r ? { x0: Math.min(r.x0, o.x), y0: Math.min(r.y0, o.y), x1: Math.max(r.x1, o.x + o.w), y1: Math.max(r.y1, o.y + o.h) } : { x0: o.x, y0: o.y, x1: o.x + o.w, y1: o.y + o.h }; });
    return r;
  }

  /* ---------- toán: phép chiếu phẳng sàn → ảnh ---------- */
  function giai(A, b) {   // khử Gauss có chọn trụ
    var n = b.length, M = A.map(function (r, i) { return r.concat([b[i]]); });
    for (var c = 0; c < n; c++) {
      var p = c; for (var r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-12) return null; var t = M[c]; M[c] = M[p]; M[p] = t;
      for (r = 0; r < n; r++) if (r !== c) { var f = M[r][c] / M[c][c]; for (var k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map(function (r, i) { return r[n] / M[i][i]; });
  }
  function chuan(ps) {   // dời tâm + co giãn cho ổn định số
    var cx = 0, cy = 0; ps.forEach(function (p) { cx += p[0]; cy += p[1]; }); cx /= ps.length; cy /= ps.length;
    var d = 0; ps.forEach(function (p) { d += Math.hypot(p[0] - cx, p[1] - cy); }); d = d / ps.length || 1; var s = Math.SQRT2 / d;
    return [[s, 0, -s * cx], [0, s, -s * cy], [0, 0, 1]];
  }
  var nhan = function (A, B) { return A.map(function (r) { return [0, 1, 2].map(function (j) { return r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]; }); }); };
  function nghich(m) {
    var a = m[0][0], b = m[0][1], c = m[0][2], d = m[1][0], e = m[1][1], f = m[1][2], g = m[2][0], h = m[2][1], i = m[2][2];
    var A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C; if (Math.abs(det) < 1e-14) return null;
    return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det], [B / det, (a * i - c * g) / det, -(a * f - c * d) / det], [C / det, -(a * h - b * g) / det, (a * e - b * d) / det]];
  }
  var ap = function (M, x, y) { return [M[0][0] * x + M[0][1] * y + M[0][2], M[1][0] * x + M[1][1] * y + M[1][2], M[2][0] * x + M[2][1] * y + M[2][2]]; };
  function phepChieu(diem) {   // m → px
    if (!diem || diem.length < 4) return null;
    var Tm = chuan(diem.map(function (d) { return d.m; })), Tp = chuan(diem.map(function (d) { return d.px; })), A = [], b = [];
    diem.forEach(function (d) {
      var X = ap(Tm, d.m[0], d.m[1]), U = ap(Tp, d.px[0], d.px[1]), x = X[0], y = X[1], u = U[0], v = U[1];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    });
    var At = A[0].map(function (_, j) { return A.map(function (r) { return r[j]; }); });
    var AtA = At.map(function (r) { return At.map(function (c) { return r.reduce(function (s, v, k) { return s + v * c[k]; }, 0); }); });
    var Atb = At.map(function (r) { return r.reduce(function (s, v, k) { return s + v * b[k]; }, 0); });
    var h = giai(AtA, Atb); if (!h) return null;
    var Tpi = nghich(Tp); if (!Tpi) return null;
    var Hm = nhan(nhan(Tpi, [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]]), Tm);
    var c = diem.reduce(function (s, d) { return [s[0] + d.m[0] / diem.length, s[1] + d.m[1] / diem.length]; }, [0, 0]);
    if (ap(Hm, c[0], c[1])[2] < 0) Hm = Hm.map(function (r) { return r.map(function (v) { return -v; }); });   // điểm sàn phải ở TRƯỚC camera
    return Hm;
  }
  function veSan(Hm, px) { var G = nghich(Hm); if (!G) return null; var q = ap(G, px[0], px[1]); return q[2] > 0 ? [q[0] / q[2], q[1] / q[2]] : null; }
  function veAnh(Hm, m) { var q = ap(Hm, m[0], m[1]); return q[2] > 1e-9 ? [q[0] / q[2], q[1] / q[2]] : null; }
  /* tách camera: Hm = λ·K·[r1 r2 t]; dò f sao cho r1 ⊥ r2 và |r1| = |r2| */
  function tachCam(Hm) {
    var tot = null, thu = function (f) {
      var Ki = [[1 / f, 0, -CX / f], [0, 1 / f, -CY / f], [0, 0, 1]], M = nhan(Ki, Hm);
      var m1 = [M[0][0], M[1][0], M[2][0]], m2 = [M[0][1], M[1][1], M[2][1]], n1 = Math.hypot.apply(null, m1), n2 = Math.hypot.apply(null, m2);
      var loi = Math.abs(m1[0] * m2[0] + m1[1] * m2[1] + m1[2] * m2[2]) / (n1 * n2) + Math.abs(n1 - n2) / ((n1 + n2) / 2);
      if (!tot || loi < tot.loi) tot = { loi: loi, f: f, M: M, n1: n1, n2: n2 };
    };
    for (var f = 250; f <= 3200; f += 10) thu(f);
    for (var f2 = tot.f - 10; f2 <= tot.f + 10; f2 += 0.5) thu(f2);   // dò mịn quanh điểm tốt nhất
    var l = 2 / (tot.n1 + tot.n2), M = tot.M, r1 = [M[0][0] * l, M[1][0] * l, M[2][0] * l], r2 = [M[0][1] * l, M[1][1] * l, M[2][1] * l], t = [M[0][2] * l, M[1][2] * l, M[2][2] * l];
    var r3 = [r1[1] * r2[2] - r1[2] * r2[1], r1[2] * r2[0] - r1[0] * r2[2], r1[0] * r2[1] - r1[1] * r2[0]];
    var dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; };
    var C = [-dot(r1, t), -dot(r2, t), -dot(r3, t)];   // C = −Rᵀt, R = [r1 r2 r3] theo cột ⇒ thành phần j = −rj·t (bản đầu viết nhầm R·t — bộ thử camera giả bắt)
    /* trục nhìn trong toạ độ sàn = Rᵀ·(0,0,1) = (r1[2], r2[2]) */
    return { x: C[0], y: C[1], cao: Math.abs(C[2]), huong: Math.atan2(r2[2], r1[2]) * 180 / Math.PI, f: tot.f, goc: 2 * Math.atan(CX / tot.f) * 180 / Math.PI, vuong: tot.loi };
  }
  /* đủ trải = có 4 điểm mà không 3 điểm nào thẳng hàng (diện tích tam giác < 1 % bình phương cạnh dài nhất ⇒ coi là thẳng hàng) —
     thiếu điều này phép chiếu không xác định: dữ liệu sạch vẫn «giải được» nhưng nhiễu vài px là lệch mét */
  function thang(a, b, c) { var s = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2, l = Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]), Math.hypot(c[0] - a[0], c[1] - a[1]), Math.hypot(c[0] - b[0], c[1] - b[1]));
    return !l || s < 0.01 * l * l; }
  function duTrai(diem) {
    var p = diem.map(function (d) { return d.m; }), n = p.length;
    for (var a = 0; a < n; a++) for (var b = a + 1; b < n; b++) for (var c = b + 1; c < n; c++) { if (thang(p[a], p[b], p[c])) continue;
      for (var d = c + 1; d < n; d++) if (!thang(p[a], p[b], p[d]) && !thang(p[a], p[c], p[d]) && !thang(p[b], p[c], p[d])) return true; }
    return false;
  }
  function danhGia(diem) {   // sai số + mức — kiểm chéo bỏ-1-điểm khi ≥ 5 điểm (4 điểm thì khớp tuyệt đối, chưa nói được gì)
    var Hm = phepChieu(diem);
    if (!Hm) return { H: null, cam: null, loiM: null, loiPx: null, caoOk: false, muc: "kem", thangHang: true };   // suy biến (thẳng hàng) — mọi nơi dùng dg.H/dg.cam phải xét dg.H
    var loiPx = Math.sqrt(diem.reduce(function (s, d) { var p = veAnh(Hm, d.m); return s + (p ? Math.pow(p[0] - d.px[0], 2) + Math.pow(p[1] - d.px[1], 2) : 1e6); }, 0) / diem.length);
    /* lượt bỏ-1-điểm mà phần còn lại suy biến (≥ 3 điểm thẳng hàng — hay gặp khi chỉ bấm chân trụ CÙNG 1 dãy kệ) thì không tính được:
       bỏ qua lượt đó (bản đầu phạt 9 m ⇒ báo lệch 3,6 m oan — bộ đo bắt 24/10); còn < 3 lượt hợp lệ thì coi như chưa kiểm chéo được */
    var loiM = null, thangHang = !duTrai(diem);
    if (diem.length >= 5 && !thangHang) { var tong = 0, n = 0;
      diem.forEach(function (d, i) { var con = diem.filter(function (_, j) { return j !== i; }); if (!duTrai(con)) return;
        var H2 = phepChieu(con), q = H2 && veSan(H2, d.px); if (q) { tong += Math.hypot(q[0] - d.m[0], q[1] - d.m[1]); n++; } });
      if (n >= 3) loiM = tong / n; else thangHang = true; }
    var cam = tachCam(Hm), caoOk = cam.cao >= 2 && cam.cao <= 12;
    /* không đủ trải (cả bộ điểm) ⇒ «kém» luôn; đủ trải mà kiểm chéo thiếu lượt hợp lệ ⇒ tối đa «tạm» */
    var muc = !duTrai(diem) ? "kem" : diem.length >= 5 && loiM != null && loiM <= 0.5 && caoOk ? "tot" : (diem.length === 4 || thangHang || (loiM != null && loiM <= 1)) && caoOk ? "tam" : "kem";
    return { H: Hm, loiPx: loiPx, loiM: loiM, cam: cam, caoOk: caoOk, muc: muc, thangHang: thangHang };
  }
  function vungThay(Hm, cam, tam) {   // đa giác sàn camera thấy: mép khung ảnh chiếu xuống sàn, cắt ở tầm tối đa (ngoài nhà 15 m)
    var G = nghich(Hm); if (!G) return []; var TAM = tam || TAM_TOI_DA;
    var bien = [], N = 24, i;
    for (i = 0; i <= N; i++) bien.push([W * i / N, 0]); for (i = 1; i <= N; i++) bien.push([W, H_ * i / N]);
    for (i = N - 1; i >= 0; i--) bien.push([W * i / N, H_]); for (i = N - 1; i > 0; i--) bien.push([0, H_ * i / N]);
    var ch = vatChan();
    return bien.map(function (p) { var q = ap(G, p[0], p[1]); if (Math.abs(q[2]) <= 1e-9) return null; var x = q[0] / q[2], y = q[1] / q[2], d = Math.hypot(x - cam.x, y - cam.y);
      /* điểm ảnh TRÊN đường chân trời (mép trên khung: đầu lối đi xa) chiếu ra sau lưng camera ⇒ lật hướng, đi xa hết tầm. Bản trước bỏ hẳn ⇒ vùng
         chỉ còn dải sát chân camera, mất cả lối đi phía trước (soi 501_1-3) */
      if (q[2] < 0) { x = cam.x - (x - cam.x) / (d || 1) * TAM; y = cam.y - (y - cam.y) / (d || 1) * TAM; d = TAM; }
      if (d > TAM) { x = cam.x + (x - cam.x) * TAM / d; y = cam.y + (y - cam.y) * TAM / d; }
      /* 25/10 tia nhìn dừng ở kệ / tường đầu tiên: bản trước vẽ vùng xuyên tường ra ngoài nhà kho (soi 501_1-3) */
      var t = tiaCham(cam.x, cam.y, x, y, ch); if (t < 1) { x = cam.x + (x - cam.x) * t; y = cam.y + (y - cam.y) * t; } return [x, y]; }).filter(Boolean);
  }
  /* vật chặn tầm nhìn sàn: kệ vật lý của mô hình 3D (oA1/oA2) + VÁCH. Vách = đúng bộ lọc trang 3D đang dựng tường (netLaVach: nét ≥ 2 m, bỏ khung băng
     chuyền và «vách rác» — mép kệ, ô pallet, đường kích thước — theo tường hồng của PDF 3D). Bản đầu chỉ lấy nét ≥ 10 m ⇒ vách phòng SPA / Re-IT lọt,
     camera trong phòng nhìn xuyên vách (soi camera phòng SPA, 25/10). Chưa có trang 3D thì lùi về nét ≥ 10 m. */
  var _chan = null;
  function vatChan() {
    var w3 = F && F.w, S = (w3 && w3.KHO170_SODO) || window.KHO170_SODO, hop = w3 && w3.oA1 ? (w3.oA1 || []).concat(w3.oA2 || []) : [];
    if (_chan && _chan.n === hop.length + (S ? 1 : 0) + (w3 && w3.netLaVach ? 1e6 : 0)) return _chan;
    var laVach = w3 && typeof w3.netLaVach === "function" ? w3.netLaVach : function (n) { return Math.hypot(n[2] - n[0], n[3] - n[1]) >= 10; };
    var tuong = S && S.nen ? S.nen.filter(function (n) { try { return laVach(n); } catch (e) { return false; } }) : [];
    /* đường bao ngoài nhà kho (DC HASAKI.pdf: khối chính + khu đóng gói + kho giấy) — bản vẽ chia tường bao khu đóng gói thành nét ngắn bị lọc ⇒ vùng
       nhìn camera đầu băng đóng gói số 1 tràn ra ngoài góc tây-nam (soi 25/10) */
    var BAO = [[12.3, 2.6], [112.7, 2.6], [112.7, 43], [55, 43], [55, 56.1], [42.4, 56.1], [42.4, 62.7], [12.3, 62.7]];
    BAO.forEach(function (p, i) { var q = BAO[(i + 1) % BAO.length]; tuong.push([p[0], p[1], q[0], q[1]]); });
    return (_chan = { hop: hop, tuong: tuong, n: hop.length + (S ? 1 : 0) + (w3 && w3.netLaVach ? 1e6 : 0) });
  }
  function tiaCham(ax, ay, bx, by, ch) {   // tỉ lệ t∈(0,1] dọc tia a→b chạm vật chặn đầu tiên (bỏ 0,3 m sát camera)
    var dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, t0 = 0.3 / L, tMin = 1;
    ch.hop.forEach(function (o) {
      if (ax >= o.x && ax <= o.x + o.w && ay >= o.y && ay <= o.y + o.h) return;
      var a = 0, b = 1, p = [-dx, dx, -dy, dy], q = [ax - o.x, o.x + o.w - ax, ay - o.y, o.y + o.h - ay];
      for (var i = 0; i < 4; i++) { if (p[i] === 0) { if (q[i] < 0) return; continue; } var t = q[i] / p[i]; if (p[i] < 0) { if (t > b) return; if (t > a) a = t; } else { if (t < a) return; if (t < b) b = t; } }
      if (a < b && a > t0 && a < tMin) tMin = a;
    });
    ch.tuong.forEach(function (n) {
      var ex = n[2] - n[0], ey = n[3] - n[1], m = dx * ey - dy * ex; if (Math.abs(m) < 1e-9) return;
      var t = ((n[0] - ax) * ey - (n[1] - ay) * ex) / m, s = ((n[0] - ax) * dy - (n[1] - ay) * dx) / m;
      if (s >= 0 && s <= 1 && t > t0 && t < tMin) tMin = t;
    });
    return tMin;
  }
  /* 25/10 có tính KỆ CHE: kệ A1/A2/5L cao ~4–5 m ≥ chỗ lắp camera ⇒ trên mặt bằng, đường nhìn tới ô mà cắt qua khối kệ khác là bị che.
     Bản đầu liệt kê xuyên kệ (ô dãy sau cũng «trong khung») — người đọc tưởng camera thấy cả khối. */
  function catHop(ax, ay, bx, by, o) {   // đoạn (a→b) cắt hình chữ nhật o? (Liang–Barsky)
    var t0 = 0, t1 = 1, dx = bx - ax, dy = by - ay, p = [-dx, dx, -dy, dy], q = [ax - o.x, o.x + o.w - ax, ay - o.y, o.y + o.h - ay];
    for (var i = 0; i < 4; i++) { if (p[i] === 0) { if (q[i] < 0) return false; continue; } var t = q[i] / p[i]; if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } }
    return t0 < t1;
  }
  function oTrongKhung(Hm, cam) {
    /* vật che = hình kệ VẬT LÝ của mô hình 3D (oA1/oA2: mỗi mặt kệ sâu 0,5 m, lối nhặt trống 1,2 m). Khối ô sơ đồ 2D là khung bao, phủ kín lối nhặt
       (502 tới x 17,89 > tâm lối 17,88) ⇒ dùng nó thì camera trong lối «bị che» mọi thứ. Chưa có mô hình 3D mới lùi về khối 2D. */
    var w3 = F && F.w, vl = w3 && w3.oA1 ? (w3.oA1 || []).concat(w3.oA2 || []) : null, VAT = {};
    if (vl) vl.forEach(function (o) { if (o.loc) VAT[o.loc] = o; });
    /* trong khung: tâm ô HOẶC mặt ô gần camera (kệ vật lý) chiếu lọt khung — ô sát chân camera lối nhặt có tâm ra ngoài mép dưới nhưng mặt vẫn thấy */
    var trong = Object.keys(O).filter(function (k) { var o = O[k], v = VAT[k] || o, c = [o.x + o.w / 2, o.y + o.h / 2], fm = [Math.max(v.x, Math.min(cam.x, v.x + v.w)), Math.max(v.y, Math.min(cam.y, v.y + v.h))];
      if (Math.hypot(c[0] - cam.x, c[1] - cam.y) > TAM_TOI_DA) return false;
      return [c, fm].some(function (q) { var p = veAnh(Hm, q); return p && p[0] >= 0 && p[0] <= W && p[1] >= 0 && p[1] <= H_; }); });
    var tuongCh = vatChan().tuong;   // vách phòng / tường nhà cũng che ô (SPA nhìn xuyên vách sang 5L3, 25/10)
    var ds = vl ? vl.concat(Object.keys(O).filter(function (k) { return !VAT[k]; }).map(function (k) { return Object.assign({ loc: k }, O[k]); })) : Object.keys(O).map(function (k) { return Object.assign({ loc: k }, O[k]); });
    return trong.filter(function (k) { var o = VAT[k] || O[k];
      /* 25/10 đích = MẶT ô quay về camera (điểm gần nhất của ô, nhích 5 cm ra lối). Bản trước nhắm tâm ô lùi 0,3 m: camera lối nhặt nhìn dọc lối
         thì tia sượt qua các tủ kế bên ⇒ báo oan «chỉ thấy 2/6 ô» (soi 502-503_3-5) */
      var fx = Math.max(o.x, Math.min(cam.x, o.x + o.w)), fy = Math.max(o.y, Math.min(cam.y, o.y + o.h)), d = Math.hypot(fx - cam.x, fy - cam.y) || 1,
        ex = fx + (cam.x - fx) / d * 0.05, ey = fy + (cam.y - fy) / d * 0.05;
      return !ds.some(function (v) { return v.loc !== k && catHop(cam.x, cam.y, ex, ey, v); }) && tiaCham(cam.x, cam.y, ex, ey, { hop: [], tuong: tuongCh }) >= 0.999; });
  }
  function tuongQuan(a, b) {
    if (!a || !b || a.length !== b.length) return null;
    var n = a.length, ma = 0, mb = 0, i; for (i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n;
    var s = 0, sa = 0, sb = 0; for (i = 0; i < n; i++) { s += (a[i] - ma) * (b[i] - mb); sa += Math.pow(a[i] - ma, 2); sb += Math.pow(b[i] - mb, 2); }
    return sa && sb ? s / Math.sqrt(sa * sb) : null;
  }

  /* ---------- gộp nguồn → 1 bản ghi đã suy ra cho mỗi kênh ---------- */
  function tinh(c) {
    var g = goiYTen(c.ten), r = { c: c, goiY: g, vung: null, diem: null, muc: "chua", nhan: "Chưa đặt được", canh: [] };
    if (c.hc && c.hc.diem && c.hc.diem.length >= 4) {
      var dg = danhGia(c.hc.diem);
      if (dg && !dg.H) { r.muc = "hc-kem"; r.nhan = "Hiệu chỉnh — chưa khớp"; r.canh.push(["bad", "Các điểm thẳng hàng — không tính được, rải thêm điểm"]); }
      /* điểm ảo có tư thế gốc (hc.tt) ⇒ chỗ lắp / cao lấy thẳng từ đó; tách ngược chỉ cho điểm người gắn */
      var tt = (c.hc.nguon === "uoc" || c.hc.nguon === "may-do") && c.hc.tt ? c.hc.tt : null;
      if (dg && dg.H) { r.dg = dg; r.muc = "hc-" + dg.muc; r.camT = tt ? { x: tt.x, y: tt.y, cao: tt.cao } : dg.cam; r.diem = [r.camT.x, r.camT.y];
        r.da = vungThay(dg.H, r.camT, c.hc.vt === "ngoai" ? 15 : 0); r.thay = oTrongKhung(dg.H, r.camT);
        r.huong = tt ? tt.huong : dg.cam.huong; r.goc = tt ? tt.goc : dg.cam.goc;   // hướng chiếu (độ, 0 = +x sơ đồ) · góc nhìn ngang
        /* camera chúc ≥ 70° nhìn thẳng xuống ⇒ không có «hướng chiếu» trên mặt bằng — không vẽ quạt (quạt chỉ 1 hướng là sai) */
        if (tt && tt.chuc >= 70) r.huong = null;
        /* tư thế gốc đã biết ⇒ mức không chấm theo phép tách ngược (camera nhìn thẳng xuống tách ra «chưa khớp» đỏ oan, soi 25/10 tối) */
        if (tt && r.muc === "hc-kem") r.muc = "hc-tam";
        r.nhan = { tot: "Hiệu chỉnh — khớp tốt", tam: "Hiệu chỉnh — tạm", kem: "Hiệu chỉnh — chưa khớp" }[dg.muc];
        /* máy dò (ảnh thật ↔ ảnh vẽ mô hình 3D): điểm ảo sai số ≈ 0 ⇒ KHÔNG cho «khớp tốt» — tối đa «tạm», ghi rõ nguồn + điểm khớp để người soi lại */
        if (c.hc.nguon === "may-do") { if (r.muc === "hc-tot") r.muc = "hc-tam"; r.nhan = "Máy dò góc (ảnh ↔ mô hình 3D) — chờ người xác nhận" + (c.hc.tin ? " · khớp gấp " + String(c.hc.tin).replace(".", ",") + " lần nền" : ""); }
        /* «uoc»: hướng + lối + đoạn tủ đã đọc từ ảnh thật (số tủ, bên kệ, cuối lối); điểm lắp / độ chúc là ước (±1–2 m) */
        if (c.hc.nguon === "uoc") { if (r.muc === "hc-tot") r.muc = "hc-tam";
          /* 25/10 mức chắc theo căn cứ đã soi (so-do-camera-gan-goc.mjs): huong = biển số dãy / vật cố định · khu = đúng khu · ten = kênh không trả hình ·
             ngoài nhà = bản vẽ không có sân, cổng. 48 kênh A1 gán trước (không «chac») giữ nhãn cũ */
          r.nhan = c.hc.vt === "ngoai" ? "Ngoài nhà — đặt tương đối theo tường, cửa (bản vẽ không có sân, cổng)"
            : c.hc.chac === "huong" ? "Ước theo ảnh — đúng khu và hướng nhìn; chỗ lắp ±1–2 m"
            : c.hc.chac === "khu" ? "Ước theo ảnh — đúng khu; chỗ lắp ±3–5 m"
            : c.hc.chac === "ten" ? "Kênh không trả hình — đặt theo kênh trùng tên đã soi"
            : "Ước theo ảnh — đúng lối, đoạn tủ, hướng; điểm lắp ±1–2 m, chờ hiệu chỉnh điểm sàn";
          if (c.hc.chac === "ten") r.muc = "hc-ten"; }
        r.ao = c.hc.nguon === "uoc" || c.hc.nguon === "may-do";   // điểm sàn ẢO (sinh từ tư thế) — không bày ra như điểm người gắn
        if (!dg.caoOk && !tt) r.canh.push(["bad", "Cao lắp ≈ " + dg.cam.cao.toFixed(1).replace(".", ",") + " m — vô lý, kiểm lại điểm"]);
        if (g && g.o.length) { var thay = g.o.filter(function (k) { return r.thay.indexOf(k) >= 0; }).length;
          if (thay < g.o.length / 2) r.canh.push(["warn", "Lệch tên kênh: khung nhìn chỉ thấy " + thay + "/" + g.o.length + " ô tên kênh nói"]); } }
    }
    if (r.muc === "chua" && c.tay) { r.muc = "tay"; r.nhan = "Đặt tay"; r.diem = [c.tay.x, c.tay.y]; r.da = quat(c.tay); r.huong = c.tay.huong; r.goc = c.tay.goc; }
    var nk = c.nguoiKiem && c.nguoiKiem.o.filter(function (k) { return O[k]; });
    if (r.muc === "chua" && nk && nk.length) { r.muc = "nk"; r.nhan = "Theo ô người kiểm thấy"; r.vung = bao(nk); }
    if (r.muc === "chua" && g) { r.muc = "ten"; r.nhan = "Theo tên kênh"; if (g.o.length) r.vung = bao(g.o); else if (g.khu) r.diem = [g.khu.x, g.khu.y]; }
    if (r.vung && !r.diem) r.diem = [(r.vung.x0 + r.vung.x1) / 2, (r.vung.y0 + r.vung.y1) / 2];
    if (c.khung && c.khung.dau && c.dauKhung) { var tq = tuongQuan(c.khung.dau, c.dauKhung); r.tq = tq;
      if (tq != null && tq < 0.6) r.canh.push(["bad", "Góc có thể đã đổi: khung mới khác khung lúc hiệu chỉnh (tương quan " + tq.toFixed(2).replace(".", ",") + ")"]); }
    return r;
  }
  function quat(t) {   // hình quạt đặt tay
    var p = [[t.x, t.y]], a0 = (t.huong - t.goc / 2) * Math.PI / 180, a1 = (t.huong + t.goc / 2) * Math.PI / 180;
    for (var i = 0; i <= 16; i++) { var a = a0 + (a1 - a0) * i / 16; p.push([t.x + Math.cos(a) * t.tam, t.y + Math.sin(a) * t.tam]); }
    return p;
  }
  var MUC = {   // màu theo token theme (không mã cứng) + nhãn chip dùng chung (.hsk-chip)
    "hc-tot": ["var(--good)", "xong"], "hc-tam": ["var(--info,var(--accent))", "dang"], "hc-kem": ["var(--bad)", "qua"], "hc-ten": ["var(--muted)", "luu"],
    tay: ["var(--info,var(--accent))", "dang"], nk: ["var(--warn)", "cho"], ten: ["var(--muted)", "luu"], chua: ["var(--muted)", "none"]
  };

  var mauVar = function (m) { return (MUC[m] || MUC.chua)[0]; };

  /* ---------- xem trực tiếp (user 25/10 «sao không xem được camera live») ----------
     8591 chụp từ đầu ghi (snapshot.cgi — tài khoản đầu ghi chỉ ở .env laptop, không ra trình duyệt) ~1 ảnh/giây. Chạy CHỈ khi thanh bên kênh đó
     đang mở + trang đang hiện; tự dừng sau 5 phút / đóng thanh bên / chọn kênh khác / 3 lần lỗi liền — đầu ghi không bị kéo vô ích. */
  var LIVE = { k: "", url: "", h: 0, het: 0, loi: 0 };
  function dungLive() { clearTimeout(LIVE.h); LIVE.k = ""; }
  function ttLive(s) { var o = $id("sdcKhungTt"); if (o) o.textContent = s; }
  function veNutLive() { var b = document.querySelector('#mBody [data-a="live"]'), on = !!(S.hc && LIVE.k === S.hc.k); if (b) { b.textContent = on ? "Dừng trực tiếp" : "Xem trực tiếp"; b.classList.toggle("chinh", on); } }
  function chayLive(k) {
    dungLive(); LIVE.k = k; LIVE.het = Date.now() + 5 * 60e3; LIVE.loi = 0;
    var vong = function () {
      if (LIVE.k !== k) return;
      var m = $id("modal"); if (!m || !m.classList.contains("show") || !S.hc || S.hc.k !== k) return dungLive();
      if (Date.now() > LIVE.het) { dungLive(); veNutLive(); veAnhKhung(); return ttLive("Đã dừng sau 5 phút — bấm «Xem trực tiếp» để xem tiếp."); }
      if (document.hidden) { LIVE.h = setTimeout(vong, 1500); return; }
      var t0 = Date.now();
      fetch(CTX.API() + "/api/so-do-camera/truc-tiep?cam=" + encodeURIComponent(k), { headers: tieuDe(), signal: AbortSignal.timeout(12000) })
        .then(function (r) { het428(r); if (!r.ok) return r.text().then(function (t) { var j = {}; try { j = JSON.parse(t); } catch (e) {} var e2 = new Error(j.loi || "HTTP " + r.status); e2.code = r.status; throw e2; }); return r.blob(); })
        .then(function (b) { if (LIVE.k !== k) return; if (LIVE.url) URL.revokeObjectURL(LIVE.url); LIVE.url = URL.createObjectURL(b); LIVE.loi = 0; veAnhKhung();
          ttLive("Trực tiếp · " + new Date().toTimeString().slice(0, 8)); LIVE.h = setTimeout(vong, Math.max(300, 1000 - (Date.now() - t0))); })
        .catch(function (e) { if (LIVE.k !== k) return;
          if (e.code === 503 || e.code === 403 || e.code === 423 || ++LIVE.loi >= 3) { dungLive(); veNutLive(); veAnhKhung(); return ttLive("Không xem trực tiếp được: " + e.message); }
          LIVE.h = setTimeout(vong, 2000 * LIVE.loi); });
    };
    vong();
  }

  /* ---------- mạng ---------- */
  /* 25/10 đêm user «CCTV chỉ quản trị xem nên cũng cần mật khẩu»: mọi lệnh mang thêm thẻ CCTV (x-cctv) do máy chủ cấp sau khi nhập đúng mật khẩu
     riêng (so-do-camera.mjs MK_TEP). Thẻ để ở sessionStorage: đóng thẻ trình duyệt là mất; máy chủ gắn thẻ với phiên đăng nhập, 30' không dùng là hết. */
  var THE_K = "sdc-the";
  function layThe() { try { return sessionStorage.getItem(THE_K) || ""; } catch (e) { return THE_MEM || ""; } }
  function datThe(t) { THE_MEM = t || ""; try { if (t) sessionStorage.setItem(THE_K, t); else sessionStorage.removeItem(THE_K); } catch (e) {} }
  var THE_MEM = "";
  function tieuDe() { var h = { "x-hx-phien": CTX.phien() }, t = layThe(); if (t) h["x-cctv"] = t; return h; }
  /* ---------- CCTV khi LAPTOP TẮT (25/10 tối) — máy dự phòng chỉ có BẢN MÃ (khoá CCTV riêng Kc) + «hộp khoá» bọc Kc bằng mật khẩu CCTV.
     Mật khẩu vừa nhập (MK_TAM, chỉ trong bộ nhớ) → PBKDF2 → mở hộp → Kc → giải dữ liệu / khung hình đã lưu (giai-ma-guong.js dùng chung với gương
     Xác minh). Tải lại trang = mất Kc ⇒ hỏi lại mật khẩu. Máy dự phòng không bao giờ thấy Kc hay mật khẩu rõ. ---------- */
  var GM = null, MK_TAM = "";
  function napGiaiMa() {
    if (window.hxGiaiMa) return Promise.resolve(window.hxGiaiMa);
    return new Promise(function (ok, hong) { var s = document.createElement("script"); s.src = "giai-ma-guong.js?v=20261022a"; s.onload = function () { ok(window.hxGiaiMa); }; s.onerror = function () { hong(new Error("Không tải được bộ giải mã")); }; document.head.appendChild(s); });
  }
  var tuB64 = function (x) { var b = atob(x), r = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) r[i] = b.charCodeAt(i); return r; };
  function moDuPhong(j) {
    if (GM) return taiMa("cctv:du-lieu", "application/json").then(function (b) { return b.text(); }).then(JSON.parse);
    if (!MK_TAM) { setTimeout(function () { khoaLai("Laptop đang tắt — đang xem bản mã hoá trên máy dự phòng: nhập lại mật khẩu CCTV để mở."); }, 0); var e0 = new Error("cần mật khẩu"); e0.code = 428; return Promise.reject(e0); }
    var b = j.boc || {}, mk = MK_TAM; MK_TAM = "";
    if (!window.crypto || !crypto.subtle) return Promise.reject(new Error("Trình duyệt này không giải mã được (cần trang https)."));
    return crypto.subtle.importKey("raw", new TextEncoder().encode(mk), "PBKDF2", false, ["deriveKey"])
      .then(function (km) { return crypto.subtle.deriveKey({ name: "PBKDF2", salt: tuB64(b.salt), iterations: b.vong, hash: "SHA-256" }, km, { name: "AES-GCM", length: 256 }, false, ["decrypt"]); })
      .then(function (w) { return crypto.subtle.decrypt({ name: "AES-GCM", iv: tuB64(b.iv) }, w, tuB64(b.ct)); })
      .catch(function () { var e = new Error("Không mở được hộp khoá — mật khẩu CCTV đã đổi trên laptop? Bật laptop 1 lần để cập nhật."); e.code = 409; throw e; })
      .then(function (kc) { return napGiaiMa().then(function (G) { return G.nhapKhoa(new Uint8Array(kc)); }); })
      .then(function (kk) { GM = { kk: kk }; return moDuPhong(j); });
  }
  function taiMa(khoa, loai) {
    var G = window.hxGiaiMa;
    return G.tenAn(GM.kk, khoa).then(function (ten) { return fetch(CTX.API() + "/ma/" + ten, { headers: { "x-hx-phien": CTX.phien() }, cache: "no-store", signal: AbortSignal.timeout(60000) }); })
      .then(function (r) { if (!r.ok) { var e = new Error(r.status === 404 ? "chưa có" : "HTTP " + r.status); e.code = r.status; throw e; } return G.docTron(r, khoa, GM.kk); })
      .then(function (x) { return new Blob(x.phan, { type: loai }); });
  }
  function het428(r) { if (r.status === 428) setTimeout(function () { khoaLai("Đã khoá lại CCTV (lâu không dùng) — nhập lại mật khẩu."); }, 0); }
  /* 30/10 user «laptop tắt thì CCTV không vô được (báo không kết nối được đường hầm)»: trang mở lúc laptop bật ⇒ địa chỉ còn trỏ đường hầm laptop
     đã chết (Failed to fetch) hoặc phiên của laptop bị máy dự phòng trả 401 → 1 lần dò lại máy chủ + đổi phiên (hasaki-xacminh noiLai → index.html
     hxNoiLai) rồi gọi lại; chỉ GET mới gọi lại (lệnh ghi không gửi 2 lần). */
  function goi(p, o) {
    o = o || {}; var get = !o.method || o.method === "GET";
    return goi1(p, o).catch(function (e) {
      var mang = e && (e.name === "TypeError" || e.name === "AbortError" || e.name === "TimeoutError"), het = e && e.code === 401;
      if (!(mang || het) || !get || !CTX.noiLai) throw e;
      return CTX.noiLai().then(function (ok) { if (!ok) throw e; return goi1(p, o); }, function () { throw e; });
    });
  }
  function goi1(p, o) {
    var h = tieuDe(); if (o.body) h["Content-Type"] = "application/json";
    return fetch(CTX.API() + p, { method: o.method || "GET", headers: h, body: o.body ? JSON.stringify(o.body) : undefined, signal: AbortSignal.timeout(o.ms || 45000) })
      .then(function (r) { if (!o.khongKhoa) het428(r); return r.text().then(function (t) { var j = null; if (t && t.charAt(0) === "{") try { j = JSON.parse(t); } catch (e) {}
        if (!r.ok || !j) { var e = new Error((j && j.loi) || ("Máy chủ trả " + r.status)); e.code = r.status; e.j = j; throw e; } return j; }); });
  }
  function napAnh(k, moi) {
    if (ANH[k] && !moi) return Promise.resolve(ANH[k]);
    if (GM) return taiMa("cctv:anh:" + k, "image/jpeg").then(function (b) { if (ANH[k]) URL.revokeObjectURL(ANH[k]); ANH[k] = URL.createObjectURL(b); return ANH[k]; });
    return fetch(CTX.API() + "/api/so-do-camera/anh?cam=" + encodeURIComponent(k), { headers: tieuDe(), signal: AbortSignal.timeout(45000) })
      .then(function (r) { het428(r); if (!r.ok) throw new Error(r.status === 404 ? "chưa có" : "HTTP " + r.status); return r.blob(); })
      .then(function (b) { if (ANH[k]) URL.revokeObjectURL(ANH[k]); ANH[k] = URL.createObjectURL(b); return ANH[k]; });
  }
  function khungTrucTiep(k) {
    return fetch(CTX.API() + "/api/so-do-camera/truc-tiep?cam=" + encodeURIComponent(k), { headers: tieuDe(), signal: AbortSignal.timeout(15000) })
      .then(function (r) { het428(r); if (!r.ok) throw new Error("HTTP " + r.status); return r.blob(); })
      .then(function (b) { if (ANH[k]) URL.revokeObjectURL(ANH[k]); ANH[k] = URL.createObjectURL(b); return ANH[k]; });
  }
  function napSoDo() {
    if (window.KHO170_SODO) return Promise.resolve(window.KHO170_SODO);
    return new Promise(function (ok, loi) { var s = document.createElement("script"); s.src = "kho170-sodo.js?v=20260916"; s.onload = function () { ok(window.KHO170_SODO); }; s.onerror = function () { loi(new Error("không tải được sơ đồ kho")); }; document.head.appendChild(s); });
  }

  /* ---------- CSS riêng (màu qua token; khối/nút/chip dùng lớp chung .panel .kpi-band .hsk-nut .hsk-chip) ---------- */
  function napCss() {
    if ($id("sdc-css")) return;
    var st = document.createElement("style"); st.id = "sdc-css";
    st.textContent = [
      ".sdc-anh{position:relative;border-radius:8px;overflow:hidden;background:#000;aspect-ratio:16/9}",
      ".sdc-anh img,.sdc-anh svg{position:absolute;inset:0;width:100%;height:100%;display:block}",
      ".sdc-anh.gan{cursor:crosshair;outline:2px solid var(--accent);outline-offset:2px}",
      ".sdc-anh .rong{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;opacity:.85;text-align:center;padding:12px}",
      ".sdc-mini{position:relative;height:260px;border:1px solid var(--border);border-radius:8px;background:var(--surface2);overflow:hidden;touch-action:none}",
      ".sdc-mini.gan{cursor:crosshair;outline:2px solid var(--accent);outline-offset:2px}",
      ".sdc-mini svg{width:100%;height:100%;display:block}",
      ".sdc-hang{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0}",
      ".sdc-tt{font-size:12.5px;color:var(--muted);min-height:18px;margin:6px 0}",
      ".sdc-tt b{color:var(--text)}",
      ".sdc-kep{cursor:pointer}.sdc-kep:not(.mo){display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}",
      ".sdc-cap{width:100%;border-collapse:collapse;font-size:12.5px}.sdc-cap td{padding:4px 6px;border-top:1px solid var(--border)}",
      ".sdc-tr{display:grid;grid-template-columns:auto 1fr auto;gap:6px 10px;align-items:center;font-size:12.5px;margin:8px 0}",
      ".sdc-tr input[type=range]{width:100%;accent-color:var(--accent);min-height:32px}",
      ".sdc-sec{margin-top:14px;padding-top:12px;border-top:1px solid var(--border)}",
      ".sdc-sec h4{margin:0 0 6px;font-size:13px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:6px}",
      ".sdc-gc{width:100%;min-height:60px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);padding:8px 10px;font:inherit;resize:vertical}",
      ".sdc-3d{position:relative;height:calc(100dvh - 128px);min-height:360px;border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--surface2)}",
      ".sdc-3d iframe{width:100%;height:100%;border:0;display:block;pointer-events:none;transition:opacity .25s var(--ez-apple,ease)}",
      ".sdc-3d.cho iframe{opacity:0}",
      /* 25/10 user «cố định cứng sơ đồ, không cần di chuyển bằng tay»: lớp phủ trong suốt nuốt kéo / lăn / chụm — chỉ còn chạm chọn camera */
      ".sdc-che{position:absolute;inset:0;touch-action:pan-y;-webkit-tap-highlight-color:transparent}.sdc-che.tro{cursor:pointer}",
      ".sdc-3dtt{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:13px;color:var(--muted);text-align:center;pointer-events:none}",
      ".sdc-khoa input,.sdc-khoa .hx-nut,.sdc-lk{min-height:44px}",
      ".sdc-mt{margin:0;font-size:12.5px;line-height:1.5;color:var(--muted)}",
      ".sdc-lk{align-self:flex-start;min-height:44px;padding:0;border:0;background:none;color:var(--accent);font:inherit;font-size:13px;cursor:pointer}",
      ".sdc-lk:hover{text-decoration:underline}",
      /* bảng chọn khi chạm trúng nhiều camera chồng nhau — khuôn Dropdown của Ant Design: nền nổi, bo 8, bóng, mỗi dòng ≥ 40 px */
      ".sdc-chon{position:absolute;z-index:5;min-width:220px;max-width:min(320px,calc(100% - 16px));max-height:min(60vh,360px);overflow:auto;padding:4px;" +
        "background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:0 6px 16px rgba(0,0,0,.08),0 3px 6px -4px rgba(0,0,0,.12),0 9px 28px 8px rgba(0,0,0,.05);animation:popIn .16s var(--ez-apple,ease)}",
      ".sdc-chon .dau{padding:6px 10px 4px;font-size:12px;color:var(--muted)}",
      ".sdc-chon button{display:flex;align-items:center;gap:10px;width:100%;min-height:40px;padding:6px 10px;border:0;border-radius:6px;background:none;color:var(--text);font:inherit;font-size:13px;text-align:left;cursor:pointer}",
      ".sdc-chon button:hover,.sdc-chon button:focus-visible{background:var(--surface2);outline:none}",
      ".sdc-chon .ic{flex:none;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center}",
      ".sdc-chon .ic svg{width:15px;height:15px;fill:#fff}",
      ".sdc-chon .tx{flex:1;min-width:0}.sdc-chon .tx b{display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".sdc-chon .tx small{display:block;color:var(--muted);font-size:11.5px}",
      ".sdc-chon .mui{flex:none;width:16px;height:16px;fill:var(--muted)}",
      "@media(max-width:820px){.sdc-3d{height:calc(100dvh - 96px);min-height:300px;border-radius:8px}.sdc-mini{height:220px}}"
    ].join("\n");
    document.head.appendChild(st);
  }

  /* ---------- sơ đồ nhỏ 2D để GẮN ĐIỂM (thanh bên): nhìn thẳng từ trên mới bấm trúng góc chân trụ; KHÔNG chữ tên khu (user 25/10) ---------- */
  function nenSvg() {
    var h = '<g stroke="var(--muted)" stroke-width="0.06" opacity=".55" fill="none">';
    var d = SD.nen.map(function (n) { return "M" + n[0] + " " + n[1] + "L" + n[2] + " " + n[3]; }).join("");
    h += '<path d="' + d + '"/></g><g fill="var(--surface)" stroke="var(--border)" stroke-width="0.04">';
    Object.keys(O).forEach(function (k) { var o = O[k]; h += '<rect x="' + o.x + '" y="' + o.y + '" width="' + o.w + '" height="' + o.h + '"/>'; });
    SD.o.forEach(function (o) { if (!o.loc) h += '<rect x="' + o.x + '" y="' + o.y + '" width="' + o.w + '" height="' + o.h + '" opacity=".6"/>'; });
    return h + "</g>";
  }

  /* bản đồ kéo / phóng (chuột, chạm, 2 ngón) — điểm dưới con trỏ đứng yên khi phóng */
  function banDo(el, vb0, veLop, bam) {
    var svg = el.querySelector("svg"), vb = vb0.slice(), ptr = {}, keo = null, chum = null, dichuyen = 0;
    function ap_() { svg.setAttribute("viewBox", vb.join(" ")); veLop(tlPx()); }
    function tlPx() { var r = svg.getBoundingClientRect(); return Math.min(r.width / vb[2], r.height / vb[3]) || 1; }
    function sangM(cx, cy) { var r = svg.getBoundingClientRect(), tl = tlPx(), ox = (r.width - vb[2] * tl) / 2, oy = (r.height - vb[3] * tl) / 2;
      return [vb[0] + (cx - r.left - ox) / tl, vb[1] + (cy - r.top - oy) / tl]; }
    function phong(k, cx, cy) { var p = sangM(cx, cy), w = Math.max(4, Math.min(160, vb[2] / k)), h = vb[3] * w / vb[2];
      vb = [p[0] - (p[0] - vb[0]) * w / vb[2], p[1] - (p[1] - vb[1]) * h / vb[3], w, h]; ap_(); }
    el.addEventListener("wheel", function (e) { e.preventDefault(); phong(e.deltaY < 0 ? 1.25 : 0.8, e.clientX, e.clientY); }, { passive: false });
    el.addEventListener("pointerdown", function (e) { if (e.target.closest("button")) return; el.setPointerCapture(e.pointerId); ptr[e.pointerId] = [e.clientX, e.clientY]; dichuyen = 0;
      var ks = Object.keys(ptr); if (ks.length === 1) keo = { x: e.clientX, y: e.clientY, vb: vb.slice() }; else if (ks.length === 2) { var a = ptr[ks[0]], b = ptr[ks[1]]; chum = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), vb: vb.slice() }; keo = null; } });
    el.addEventListener("pointermove", function (e) { if (!ptr[e.pointerId]) return; ptr[e.pointerId] = [e.clientX, e.clientY]; var ks = Object.keys(ptr);
      if (keo && ks.length === 1) { var tl = tlPx(), dx = e.clientX - keo.x, dy = e.clientY - keo.y; if (Math.hypot(dx, dy) > 4) { dichuyen = 1; el.classList.add("keo"); }
        vb = [keo.vb[0] - dx / tl, keo.vb[1] - dy / tl, vb[2], vb[3]]; ap_(); }
      else if (chum && ks.length === 2) { dichuyen = 1; var a = ptr[ks[0]], b = ptr[ks[1]], d = Math.hypot(a[0] - b[0], a[1] - b[1]); vb = chum.vb.slice(); phong(d / chum.d, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); } });
    function tha(e) { var ks = Object.keys(ptr), mot = ks.length === 1; delete ptr[e.pointerId]; el.classList.remove("keo");
      if (mot && !dichuyen && e.type === "pointerup" && bam) bam(sangM(e.clientX, e.clientY), tlPx(), e); if (!Object.keys(ptr).length) { keo = null; chum = null; } }
    el.addEventListener("pointerup", tha); el.addEventListener("pointercancel", tha);
    ap_();
    return { phong: function (k) { var r = svg.getBoundingClientRect(); phong(k, r.left + r.width / 2, r.top + r.height / 2); },
      dat: function (v) { vb = v.slice(); ap_(); }, vb: function () { return vb.slice(); }, ve: function () { veLop(tlPx()); } };
  }
  function vbVua(r, du) { du = du || 6; var w = Math.max(10, r.x1 - r.x0 + 2 * du), h = Math.max(8, r.y1 - r.y0 + 2 * du); return [r.x0 - du - (w - (r.x1 - r.x0 + 2 * du)) / 2, r.y0 - du - (h - (r.y1 - r.y0 + 2 * du)) / 2, w, h]; }

  /* ---------- màn chính (user 25/10): CHỈ mô hình 3D kho 170 + camera — không thẻ số, chip, nút «i», danh sách, tên khu / vật thể ----------
     Nhúng chính kho170-3d.html (cùng gốc ⇒ đọc được scene/camera/THREE của khung) — KHÔNG sửa trang 3D: ẩn thanh công cụ / bản đồ nhỏ / gợi ý
     bằng CSS chèn vào khung, tắt chữ (sprite) bằng material.visible (vòng 1 s vì trang 3D dựng lại khi đổi thông số). Toạ độ 3D: x = x sơ đồ,
     z = y sơ đồ (sàn trải 0…HX, 0…HZ). Dữ liệu camera chỉ nằm trong bộ nhớ trang cha, không qua URL / postMessage. */
  var DS = [], F = null, V3D = "20261025a";
  var CSS_NHUNG = "#hint,#ui,#sua,#vc,#timTag,#mmBox,#joy,#joyY,#mnNen,#timTt{display:none!important}";
  var BIEN = { "hc-tot": "--good", "hc-tam": "--info", "hc-kem": "--bad", "hc-ten": "--muted", tay: "--info", nk: "--warn", ten: "--muted", chua: "--muted" };
  /* màu token theme → rgb đặc cho three.js: vẽ màu lên nền (--surface) rồi đọc điểm ảnh — token có thể là rgba / color-mix (three.js bỏ alpha ⇒ ra ĐEN, soi ảnh 25/10) */
  var MAU_DEM = {};
  function mauMuc(m) {
    var cs = getComputedStyle(document.body), v = cs.getPropertyValue(BIEN[m] || "--muted").trim() || cs.getPropertyValue("--accent").trim() || "#888888", nen = cs.getPropertyValue("--surface").trim() || "#ffffff";
    if (MAU_DEM[v + nen]) return MAU_DEM[v + nen];
    try { var c = document.createElement("canvas"); c.width = c.height = 1; var x = c.getContext("2d"); x.fillStyle = nen; x.fillRect(0, 0, 1, 1); x.fillStyle = v; x.fillRect(0, 0, 1, 1);
      var d = x.getImageData(0, 0, 1, 1).data; return (MAU_DEM[v + nen] = "rgb(" + d[0] + "," + d[1] + "," + d[2] + ")"); } catch (e) { return "#888888"; }
  }
  function ve(host, ctx) {
    CTX = ctx; HOST = host; napCss();
    /* đóng thanh bên → bỏ chọn, dừng trực tiếp. CHỈ khi chuyển từ đang mở → đóng: lúc MỞ, hx-ben được gắn trước «show» ⇒ bản đầu bỏ chọn ngay khi vừa chọn (bộ đo bắt 25/10) */
    if (!ve._mo && $id("modal")) { ve._mo = 1; var moTruoc = $id("modal").classList.contains("show");
      new MutationObserver(function () { var mo = $id("modal").classList.contains("show"), vuaDong = moTruoc && !mo; moTruoc = mo; if (!vuaDong || !S.chon) return; S.chon = ""; dungLive(); veDiem3D(); })
      .observe($id("modal"), { attributes: true, attributeFilter: ["class"] }); }
    if (!layThe()) return veKhoa(host);   // chưa mở khoá ⇒ chỉ màn mật khẩu, KHÔNG tải dữ liệu camera
    henKhoa();
    if (!D) host.innerHTML = '<div class="sdc-3d"><div class="sdc-3dtt">Đang tải…</div></div>';
    if (!NAP) NAP = Promise.all([goi("/api/so-do-camera").then(function (j) { return j.duPhong ? moDuPhong(j) : (GM = null, j); }), napSoDo()]).then(function (kq) { D = kq[0]; SD = kq[1]; dungO(); DS = D.cams.map(tinh); })
      .catch(function (e) { NAP = null; throw e; });
    NAP.then(function () { if (HOST === host) veMan(); }).catch(function (e) {
      if (e.code === 428) return;   // het428 đã đưa về màn mật khẩu
      if (e.code === 409) return khoaLai(e.message);   // máy dự phòng: mật khẩu không mở được hộp khoá
      /* 410 = bản dự phòng mã hoá (laptop tắt) chặn bản rõ · 503 = bản dự phòng thường · 403 = không phải tamlc */
      host.innerHTML = '<div class="panel"><div class="empty-row" style="padding:24px 16px">' + e_(e.code === 403 || e.code === 503 ? e.message : e.code === 410 ? "Laptop đang tắt — sơ đồ camera chỉ xem được khi laptop bật (dữ liệu chỉ nằm trên laptop)." : "Không tải được sơ đồ camera: " + e.message) +
        (e.code === 403 ? "" : ' <button type="button" class="hx-nut nho" data-sdc="lai">Thử lại</button>') + "</div></div>";
      var b = host.querySelector('[data-sdc="lai"]'); if (b) b.onclick = function () { ve(host, ctx); };
    });
  }
  /* ---------- khoá mật khẩu CCTV (25/10 đêm) — khuôn .hx-dn của form đăng nhập Xác minh ----------
     che: "mo" nhập mật khẩu · "dat" đặt lần đầu · "doi" đổi mật khẩu. 25/10 đêm (2) user «đăng nhập rồi sao vẫn bắt lên laptop»: đặt lần đầu
     ngay tại chỗ (cả điện thoại / 4G); từ xa máy chủ đòi nhập lại MẬT KHẨU ĐĂNG NHẬP (canTk) để chắc là chính chủ tài khoản */
  function veKhoa(host, thongBao) {
    host.innerHTML = '<div class="panel hx-dn sdc-khoa"><div class="panel-head"><span id="sdcKhoaTd">CCTV đang khoá</span></div><form id="sdcKhoaF" autocomplete="on"><p class="sdc-mt" id="sdcKhoaMt">Đang kiểm tra…</p></form></div>';
    var f = $id("sdcKhoaF");
    var tt = function (s, loi) { var o = $id("sdcKhoaSt"); if (o) { o.className = s ? (loi ? "hx-st loi" : "hx-st") : ""; o.textContent = s || ""; } };
    var o_ = function (id, nhan, ac) { return '<label><span class="lbl">' + nhan + '</span><input id="' + id + '" type="password" autocomplete="' + ac + '" required' + (ac === "new-password" ? ' minlength="6"' : "") + '></label>'; };
    var canTk = false;
    var dung = function (ch) {
      var mt = ch === "dat" ? "CCTV có thêm 1 mật khẩu riêng, KHÁC mật khẩu đăng nhập — lớp bảo vệ thứ 2 cho camera. Đặt 1 lần ở đây (ít nhất 6 ký tự); từ đó mở CCTV trên máy nào cũng nhập mật khẩu này." +
          (canTk ? " Để chắc là chính anh/chị, nhập lại mật khẩu đăng nhập trước." : "")
        : ch === "doi" ? "Đổi mật khẩu CCTV. Mọi thiết bị đang mở CCTV sẽ bị khoá lại."
        : "Mục này có mật khẩu riêng, khác mật khẩu đăng nhập. Không dùng 30 phút sẽ tự khoá lại.";
      $id("sdcKhoaTd").textContent = ch === "dat" ? "Đặt mật khẩu CCTV" : ch === "doi" ? "Đổi mật khẩu CCTV" : "CCTV đang khoá";
      f.innerHTML = '<p class="sdc-mt">' + e_(mt) + '</p><input type="text" autocomplete="username" value="tamlc-cctv" hidden aria-hidden="true">' +
        (ch === "mo" ? o_("sdcMk", "Mật khẩu CCTV", "current-password")
          : ch === "dat" ? (canTk ? o_("sdcTk", "Mật khẩu đăng nhập (tài khoản đang dùng)", "current-password") : "") + o_("sdcMoi", "Mật khẩu CCTV mới", "new-password") + o_("sdcMoi2", "Nhập lại mật khẩu mới", "new-password")
          : ch === "doi" ? o_("sdcCu", "Mật khẩu hiện tại", "current-password") + o_("sdcMoi", "Mật khẩu mới", "new-password") + o_("sdcMoi2", "Nhập lại mật khẩu mới", "new-password") : "") +
        '<button type="submit" class="hx-nut" id="sdcKhoaNut">' + (ch === "mo" ? "Mở khoá" : ch === "dat" ? "Đặt mật khẩu" : "Đổi mật khẩu") + "</button>" +
        '<div id="sdcKhoaSt"></div>' +
        (ch === "mo" ? '<button type="button" class="sdc-lk" data-che="doi">Đổi mật khẩu</button>' : ch === "doi" ? '<button type="button" class="sdc-lk" data-che="mo">Quay lại</button>' : "");
      if (thongBao) { tt(thongBao, true); thongBao = ""; }
      var dau = f.querySelector("input[type=password]"); if (dau && matchMedia("(hover:hover)").matches) dau.focus();
      f.querySelectorAll("[data-che]").forEach(function (b) { b.onclick = function () { dung(b.getAttribute("data-che")); }; });
      f.onsubmit = function (ev) {
        ev.preventDefault(); var nut = $id("sdcKhoaNut"), v = function (id) { var x = $id(id); return x ? x.value : ""; };
        if (ch !== "mo" && v("sdcMoi") !== v("sdcMoi2")) { tt("Hai lần nhập mật khẩu mới không giống nhau.", true); return; }
        var duong = ch === "mo" ? "/api/so-do-camera/mo-khoa" : "/api/so-do-camera/dat-mk", than = ch === "mo" ? { mk: v("sdcMk") } : { cu: v("sdcCu"), moi: v("sdcMoi"), tk: v("sdcTk") };
        nut.disabled = true; tt("Đang kiểm tra…");
        goi(duong, { method: "POST", body: than, khongKhoa: 1, ms: 30000 })
          .then(function (j) { datThe(j.the); MK_TAM = ch === "doi" ? v("sdcMoi") : ch === "mo" ? v("sdcMk") : v("sdcMoi"); GM = null; ve(host, CTX); })
          .catch(function (e) { nut.disabled = false; tt(e.name === "TimeoutError" || e.name === "AbortError" ? "Máy chủ không trả lời — thử lại." : e.message, true);
            var x = f.querySelector("input[type=password]"); if (x) x.select(); });
      };
    };
    goi("/api/so-do-camera/khoa", { khongKhoa: 1, ms: 15000 }).then(function (j) {
      canTk = !!j.canTk; dung(j.daDat ? "mo" : "dat");
    }).catch(function (e) {
      $id("sdcKhoaMt").textContent = e.code === 403 || e.code === 503 ? e.message : "Không hỏi được máy chủ: " + e.message;
    });
  }
  function khoaLai(tb) {
    var t = layThe(); datThe("");
    if (t && CTX) fetch(CTX.API() + "/api/so-do-camera/khoa-lai", { method: "POST", headers: { "x-hx-phien": CTX.phien(), "x-cctv": t } }).catch(function () {});
    dungLive(); D = null; DS = []; NAP = null; GM = null; MK_TAM = ""; Object.keys(ANH).forEach(function (k) { URL.revokeObjectURL(ANH[k]); delete ANH[k]; });
    var m = $id("modal"); if ((S.chon || S.hc) && m && m.classList.contains("hx-ben") && typeof window.dongModal === "function") window.dongModal();
    S.chon = ""; S.hc = null; dongChon();
    if (F) { window.removeEventListener("resize", F.vua); if (F.ro) F.ro.disconnect(); F = null; }
    if (HOST && document.contains(HOST) && HOST.querySelector(".sdc-3d,.sdc-khoa")) veKhoa(HOST, tb);
  }
  /* tự khoá khi 30' không chạm / gõ gì trên trang (máy chủ cũng tự huỷ thẻ sau 30' không gọi) */
  var DUNG_CUOI = Date.now();
  function henKhoa() {
    if (henKhoa._ok) return; henKhoa._ok = 1;
    ["pointerdown", "keydown", "wheel"].forEach(function (t) { document.addEventListener(t, function () { DUNG_CUOI = Date.now(); }, { passive: true, capture: true }); });
    setInterval(function () { if (layThe() && Date.now() - DUNG_CUOI > 30 * 60e3) khoaLai("Đã tự khoá CCTV sau 30 phút không dùng."); }, 60e3);
  }

  function veMan() {
    if (F && F.el && HOST.contains(F.el)) return veDiem3D();
    HOST.innerHTML = '<div class="sdc-3d cho"><iframe id="sdc3d" title="CCTV — mặt bằng kho 170 và camera" tabindex="-1" src="kho170-3d.html?v=' + V3D + '"></iframe><div class="sdc-che" id="sdcChe"></div><div class="sdc-3dtt" id="sdc3dTt">Đang dựng mặt bằng…</div></div>';
    var el = $id("sdc3d"); F = { el: el, diem: [] };
    el.addEventListener("load", function () { choSan(el, 0); });
  }
  function tt3(s) { var o = $id("sdc3dTt"); if (o) { o.textContent = s || ""; o.hidden = !s; } }
  function choSan(el, n) {
    if (!F || F.el !== el) return; var w = el.contentWindow;
    if (!w || !w.__SAN_SANG || !w.scene || !w.THREE || !w.camera) { if (n > 200) return tt3("Không dựng được mô hình 3D (mất mạng thư viện đồ hoạ?)."); return setTimeout(function () { choSan(el, n + 1); }, 150); }
    var st = w.document.createElement("style"); st.textContent = CSS_NHUNG; w.document.head.appendChild(st);
    var bc = w.document.getElementById("bChieu"); if (bc && bc.classList.contains("on")) bc.click();   // chiếu trực giao (máy nhớ từ trang 3D) → phối cảnh: bấm chọn camera tính theo camera phối cảnh
    F.w = w; anChu(); var hAn = setInterval(function () { if (!F || F.w !== w || !document.contains(F.el)) return clearInterval(hAn); anChu(); }, 1000);
    /* sơ đồ CỐ ĐỊNH: mọi thao tác đi vào lớp phủ trang cha (khung 3D pointer-events:none, không nhận phím) ⇒ trang 3D không kéo / phóng / xoay được.
       Toạ độ chạm đổi về hệ của khung (trừ mép khung) rồi chọn quả cầu gần nhất ≤ 18 px như cũ */
    var che = $id("sdcChe"), xuong = null, trongKhung = function (e) { var b = el.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    ["wheel", "dblclick", "contextmenu"].forEach(function (t) { che.addEventListener(t, function (e) { e.preventDefault(); }, { passive: false }); });
    che.addEventListener("pointerdown", function (e) { xuong = [e.clientX, e.clientY]; });
    che.addEventListener("pointermove", function (e) { if (e.pointerType !== "mouse" || xuong) return; var p = trongKhung(e); che.classList.toggle("tro", chamCam(p[0], p[1], 0).length > 0); });
    che.addEventListener("pointerup", function (e) {
      if (!xuong || Math.hypot(e.clientX - xuong[0], e.clientY - xuong[1]) > 8) { xuong = null; return; } xuong = null;
      /* 25/10 đêm user «3 icon camera đè lên nhau (lắp gần nhau) — làm sao chạm đúng camera trên điện thoại»: trúng 1 → mở luôn; trúng ≥ 2
         (cùng cụm chồng nhau, hoặc ngón tay phủ nhiều biểu tượng) → bảng chọn ngay chỗ chạm, mỗi dòng tên + kênh + mũi tên hướng chiếu */
      var p = trongKhung(e), ds = chamCam(p[0], p[1], e.pointerType === "touch" ? 1 : 0);
      if (ds.length === 1) { dongChon(); moCam(ds[0]); } else if (ds.length > 1) moChon(ds, p); else dongChon();
    });
    che.addEventListener("pointercancel", function () { xuong = null; });
    /* đổi cỡ màn (xoay điện thoại, đóng/mở thanh bên trái) ⇒ canh vừa khung lại */
    var henVua = null; F.vua = function () { clearTimeout(henVua); henVua = setTimeout(function () { if (F && F.w === w && document.contains(el)) { vuaTren(w); } }, 150); };
    window.addEventListener("resize", F.vua);
    if (window.ResizeObserver) { F.ro = new ResizeObserver(F.vua); F.ro.observe(el); }
    /* khung DỌC (điện thoại): góc «Toàn kho» của trang 3D canh theo màn ngang → kho bị cắt 2 bên. Lùi xa bằng chính thao tác lăn chuột trang 3D
       hỗ trợ (không sửa trang 3D): số nấc theo độ hẹp của khung */
    datTren(w);
    /* kệ vật lý (oA1/oA2) chỉ có khi mô hình xong ⇒ tính lại vùng nhìn + ô bị che (lượt nạp dữ liệu có thể về trước mô hình) */
    if (D && D.cams) DS = D.cams.map(tinh);
    veDiem3D(); vongCo();
    /* 25/10 tối user «vào mục vẫn thấy bản 3D 1–2 s rồi mới nhảy sang nhìn từ trên»: khung 3D bị GIẤU (.cho) từ lúc tạo; chỉ hiện khi đã đặt góc
       nhìn từ trên + biểu tượng và trang 3D vẽ xong 2 khung hình */
    w.requestAnimationFrame(function () { w.requestAnimationFrame(function () { var b = el.parentNode; if (b) b.classList.remove("cho"); tt3(""); }); });
  }
  /* 25/10 user «không lấy cả sơ đồ 3D — chỉ lấy góc nhìn từ trên xuống»: chế độ BẢN ĐỒ (kéo = dời, lăn = phóng) + chiếu TRỰC GIAO, nhìn thẳng xuống,
     vừa khung. CAM là const cấp tệp của trang 3D (không lên window) ⇒ đọc qua w.eval (cùng gốc; CSP trang có 'unsafe-eval'). datMode/datChieu tự ghi
     «kho170-cam» ⇒ trả lại giá trị cũ để mở trang 3D riêng vẫn như người dùng để. Khung dọc: xoay mặt bằng 90° (cạnh dài 116 m nằm dọc). */
  function datTren(w) {
    var luu = null; try { luu = w.localStorage.getItem("kho170-cam"); } catch (e) {}
    try { w.eval("CAM.datMode('map');CAM.datChieu(true);CAM.o.rot=false;"); } catch (e) {}
    try { if (luu == null) w.localStorage.removeItem("kho170-cam"); else w.localStorage.setItem("kho170-cam", luu); } catch (e) {}
    vuaTren(w);
  }
  function vuaTren(w) {
    var cv = w.document.getElementById("c"), r = cv.getBoundingClientRect(), S2 = w.KHO170_SODO; if (!S2 || !r.width) return;
    var doc = r.height > r.width * 1.15, W2 = doc ? S2.H : S2.W, H2 = doc ? S2.W : S2.H, hNua = Math.max(H2 / 2, W2 / 2 / (r.width / r.height)) * 1.04;
    /* theta π/2: «lên» màn hình = −z ⇒ đúng chiều sơ đồ (x sang phải, y xuống) · theta π: «lên» = +x (khung dọc) */
    try { w.eval("(function(d,th){var o=CAM.o;o.theta=th;o.phi=0.001;o.dist=d;o.target.set(" + (S2.W / 2) + ",0," + (S2.H / 2) + ");o.vel.th=o.vel.ph=0;o.anim=null;})(" +
      (hNua / Math.tan(w.camera.fov * Math.PI / 360)) + "," + (doc ? Math.PI : Math.PI / 2) + ")"); } catch (e) {}
  }
  function camVe() { try { return F.w.eval("CAM.cam()"); } catch (e) { return F.w.camera; } }   // camera đang VẼ (trực giao khi nhìn từ trên)
  function anChu() { var g = F && F.w && F.w.GOC3D; if (g) g.traverse(function (o) { if (o.isSprite && o.material && o.material.visible) o.material.visible = false; }); }
  /* chạm chọn: chiếu tâm từng biểu tượng ra màn hình (luật tay nắm: bắt theo khoảng cách PIXEL). Chuột ≤ 16 px (BO-CHUAN §6); ngón tay ≤ 22 px.
     Trả MỌI camera trúng (gần nhất trước) + cả cụm chồng của camera gần nhất ⇒ biểu tượng nằm khuất dưới vẫn chọn được */
  function chamCam(cx, cy, tay) {
    var w = F.w, cv = w.document.getElementById("c"), r = cv.getBoundingClientRect(), v = new w.THREE.Vector3(), rc = camVe(), ban = tay ? 22 : 16, kq = [];
    F.diem.forEach(function (d) { v.copy(d.m.position).project(rc); if (v.z > 1 || v.z < -1) return;
      var dd = Math.hypot((v.x + 1) / 2 * r.width - (cx - r.left), (1 - v.y) / 2 * r.height - (cy - r.top)); if (dd <= ban) kq.push({ d: dd, k: d.k, cum: d.cum }); });
    kq.sort(function (a, b) { return a.d - b.d; });
    /* chạm trúng hẳn 1 biểu tượng không chồng (gần hơn biểu tượng kế ≥ 8 px) ⇒ mở luôn, khỏi bảng chọn — vùng ngón tay rộng chỉ để vớt cú chạm hụt */
    if (kq.length > 1 && !kq[0].cum && kq[1].d - kq[0].d >= 8) kq.length = 1;
    var ds = kq.map(function (x) { return x.k; });
    if (kq[0] && kq[0].cum) kq[0].cum.forEach(function (k) { if (ds.indexOf(k) < 0) ds.push(k); });
    return ds;
  }
  /* cụm chồng nhau: 2 biểu tượng cách nhau < 70 % đường kính trên màn ⇒ cùng cụm (gom bắc cầu). Tính lại khi đổi cỡ khung / vẽ lại; cụm ≥ 2 có
     huy hiệu số (kiểu Badge Ant Design) ở góc trên phải biểu tượng nằm trên cùng */
  function gomCum(co, r, rc) {
    var w = F.w, TH = w.THREE, v = new TH.Vector3(), P = F.diem.map(function (d) { v.copy(d.m.position).project(rc); return [(v.x + 1) / 2 * r.width, (1 - v.y) / 2 * r.height]; });
    var me = F.diem.map(function (_, i) { return i; }), goc = function (i) { while (me[i] !== i) i = me[i] = me[me[i]]; return i; };
    for (var i = 0; i < P.length; i++) for (var j = i + 1; j < P.length; j++) if (Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]) < co * 0.7) me[goc(i)] = goc(j);
    var nhom = {}; F.diem.forEach(function (d, i) { var g = goc(i); (nhom[g] = nhom[g] || []).push(i); });
    (F.huy || []).forEach(function (h) { F.nhom.remove(h.m); h.m.material.dispose(); }); F.huy = [];
    F.diem.forEach(function (d) { d.cum = null; });
    Object.keys(nhom).forEach(function (g) { var ds = nhom[g]; if (ds.length < 2) return;
      var ks = ds.map(function (i) { return F.diem[i].k; }), tren = F.diem[ds[ds.length - 1]];   // vẽ sau = nằm trên
      ds.forEach(function (i) { F.diem[i].cum = ks; });
      var sp = new TH.Sprite(new TH.SpriteMaterial({ map: texSo(w, ds.length), transparent: true, depthTest: false, depthWrite: false }));
      sp.renderOrder = 1002; sp.userData.cum = ds.length; F.nhom.add(sp); F.huy.push({ m: sp, goc: tren.m }); });
  }
  function texSo(w, n) {
    var k = "s" + n; if (TEX[k]) return TEX[k];
    var c = w.document.createElement("canvas"); c.width = c.height = 64; var x = c.getContext("2d"), cs = getComputedStyle(document.body);
    x.beginPath(); x.arc(32, 32, 28, 0, Math.PI * 2); x.fillStyle = cs.getPropertyValue("--bad").trim() || "#ff4d4f"; x.fill();
    x.lineWidth = 5; x.strokeStyle = "#fff"; x.stroke();
    x.fillStyle = "#fff"; x.font = "700 34px system-ui,-apple-system,Segoe UI,Roboto,sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(String(n), 32, 34);
    var t = new w.THREE.CanvasTexture(c); return (TEX[k] = t);
  }
  /* bảng chọn camera (khuôn Dropdown) đặt ngay chỗ chạm, lật vào trong khung nếu tràn mép; Esc / chạm ra ngoài / cuộn ⇒ đóng */
  var GLYPH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + "M6.03 12.03L8.03 15.5L5.5 18.68L2 12.62L6.03 12.03M17 18V15.29C17.88 14.9 18.5 14.03 18.5 13C18.5 12.43 18.3 11.9 17.97 11.5L19.94 10.35C20.95 9.76 21.3 8.47 20.71 7.46L19.33 5.06C18.74 4.05 17.45 3.7 16.44 4.28L8.31 9C7.36 9.53 7.03 10.75 7.58 11.71L9.08 14.31C9.63 15.26 10.86 15.59 11.81 15.04L13.69 13.96C13.94 14.55 14.41 15.03 15 15.29V18C15 19.1 15.9 20 17 20H22V18H17Z" + '"/></svg>';
  function dongChon() { var o = $id("sdcChon"); if (o) o.remove(); document.removeEventListener("keydown", dongChon._esc, true); }
  function moChon(ds, p) {
    dongChon(); var bo = F && F.el && F.el.parentNode; if (!bo) return;
    var w = F.w, rc = camVe(), v0 = new w.THREE.Vector3(), v1 = new w.THREE.Vector3();
    var h = '<div class="dau">' + ds.length + " camera ở chỗ này — chọn 1</div>";
    ds.forEach(function (k) { var x = DS.find(function (y) { return y.c.k === k; }); if (!x) return;
      /* mũi tên = hướng chiếu TRÊN MÀN (mặt bằng có thể xoay 90° trên điện thoại) */
      var mui = "";
      if (x.huong != null && x.diem) { var rad = x.huong * Math.PI / 180; v0.set(x.diem[0], 0, x.diem[1]).project(rc); v1.set(x.diem[0] + Math.cos(rad), 0, x.diem[1] + Math.sin(rad)).project(rc);
        var gocMan = Math.atan2(-(v1.y - v0.y), v1.x - v0.x) * 180 / Math.PI;
        mui = '<svg class="mui" viewBox="0 0 24 24" aria-label="hướng chiếu" style="transform:rotate(' + Math.round(gocMan) + 'deg)"><path d="M4 11h12.2l-4.6-4.6L13 5l7 7-7 7-1.4-1.4 4.6-4.6H4z"/></svg>'; }
      h += '<button type="button" role="menuitem" data-k="' + e_(k) + '"><span class="ic" style="background:' + mauMuc(x.muc) + '">' + GLYPH + '</span><span class="tx"><b>' + e_(x.c.ten) + "</b><small>" +
        e_((x.c.dauGhi || x.c.ip) + " · kênh " + x.c.kenh) + (x.huong == null && x.diem ? " · nhìn thẳng xuống" : "") + "</small></span>" + mui + "</button>"; });
    var m = document.createElement("div"); m.className = "sdc-chon"; m.id = "sdcChon"; m.setAttribute("role", "menu"); m.innerHTML = h; bo.appendChild(m);
    var bw = bo.clientWidth, bh = bo.clientHeight, mw = m.offsetWidth, mh = m.offsetHeight, b = F.el.getBoundingClientRect(), g = bo.getBoundingClientRect();
    var x0 = p[0] + b.left - g.left, y0 = p[1] + b.top - g.top;
    m.style.left = Math.max(8, Math.min(bw - mw - 8, x0 - mw / 2)) + "px";
    m.style.top = (y0 + 18 + mh <= bh - 8 ? y0 + 18 : Math.max(8, y0 - 18 - mh)) + "px";   // mở xuống dưới chỗ chạm; tràn đáy mới lật lên
    m.querySelectorAll("button").forEach(function (bt) { bt.onclick = function () { var k = bt.getAttribute("data-k"); dongChon(); moCam(k); }; });
    if (matchMedia("(hover:hover)").matches) { var b0 = m.querySelector("button"); if (b0) b0.focus(); }
    dongChon._esc = function (e) { if (e.key === "Escape") { e.stopPropagation(); dongChon(); } };
    document.addEventListener("keydown", dongChon._esc, true);
  }
  function matSan(TH, da, mau, op) {   // vùng sàn camera thấy: tam giác quạt quanh tâm, nằm sát sàn
    var cx = 0, cz = 0; da.forEach(function (p) { cx += p[0]; cz += p[1]; }); cx /= da.length; cz /= da.length;
    var v = []; for (var i = 0; i < da.length; i++) { var a = da[i], b = da[(i + 1) % da.length]; v.push(cx, 0.06, cz, a[0], 0.06, a[1], b[0], 0.06, b[1]); }
    var geo = new TH.BufferGeometry(); geo.setAttribute("position", new TH.Float32BufferAttribute(v, 3));
    var m = new TH.Mesh(geo, new TH.MeshBasicMaterial({ color: mau, transparent: true, opacity: op, side: TH.DoubleSide, depthWrite: false })); m.renderOrder = 997; return m;
  }
  /* 25/10 tối user «chấm xanh → icon camera; thêm hướng chiếu của camera — gọn, đẹp, theo Ant Design»: mỗi camera = 2 lớp.
     (1) Biểu tượng: Sprite (luôn đứng thẳng trên màn, kể cả điện thoại xoay mặt bằng 90°) — vòng tròn màu theo mức, viền trắng, bóng nhẹ, glyph
         mdiCctv trắng; lật gương để ống kính quay về phía hướng chiếu trên màn.
     (2) Hướng chiếu: quạt mờ dần nằm trên sàn, xoay theo hướng camera, góc mở = góc nhìn ngang (kẹp 30–130°).
     Cỡ tính theo PIXEL màn (BO-CHUAN §6), bắt chọn theo tâm biểu tượng ≤ 16 px như cũ. Vùng sàn thật (đã trừ kệ / vách) vẫn chỉ tô cho camera đang chọn. */
  var CCTV = "M6.03 12.03L8.03 15.5L5.5 18.68L2 12.62L6.03 12.03M17 18V15.29C17.88 14.9 18.5 14.03 18.5 13C18.5 12.43 18.3 11.9 17.97 11.5L19.94 10.35C20.95 9.76 21.3 8.47 20.71 7.46L19.33 5.06C18.74 4.05 17.45 3.7 16.44 4.28L8.31 9C7.36 9.53 7.03 10.75 7.58 11.71L9.08 14.31C9.63 15.26 10.86 15.59 11.81 15.04L13.69 13.96C13.94 14.55 14.41 15.03 15 15.29V18C15 19.1 15.9 20 17 20H22V18H17Z";
  var TEX = {}, CO_ICON = 26, R_QUAT = 36;   // px màn: đường kính biểu tượng · bán kính quạt hướng chiếu
  var soMau = function (mau) { var m = /(\d+)\D+(\d+)\D+(\d+)/.exec(mau); return m ? m[1] + "," + m[2] + "," + m[3] : "128,128,128"; };
  function texIcon(w, mau, guong) {
    var k = "i" + mau + guong; if (TEX[k]) return TEX[k];
    var c = w.document.createElement("canvas"); c.width = c.height = 128; var x = c.getContext("2d");
    x.shadowColor = "rgba(0,0,0,.28)"; x.shadowBlur = 10; x.shadowOffsetY = 3;
    x.beginPath(); x.arc(64, 62, 50, 0, Math.PI * 2); x.fillStyle = mau; x.fill();
    x.shadowColor = "transparent"; x.lineWidth = 8; x.strokeStyle = "#fff"; x.stroke();
    x.save(); x.translate(guong ? 64 + 31 : 64 - 31, 62 - 31); x.scale(guong ? -2.6 : 2.6, 2.6); x.fillStyle = "#fff"; x.fill(new Path2D(CCTV)); x.restore();
    var t = new w.THREE.CanvasTexture(c); t.anisotropy = 4; return (TEX[k] = t);
  }
  function texQuat(w, mau, goc) {
    var a = Math.max(30, Math.min(130, Math.round((goc || 90) / 10) * 10)), k = "q" + mau + a; if (TEX[k]) return TEX[k];
    var c = w.document.createElement("canvas"); c.width = c.height = 256; var x = c.getContext("2d"), r = 124, a0 = -a * Math.PI / 360, a1 = a * Math.PI / 360, rgb = soMau(mau);
    var gd = x.createRadialGradient(128, 128, 8, 128, 128, r); gd.addColorStop(0, "rgba(" + rgb + ",.55)"); gd.addColorStop(1, "rgba(" + rgb + ",.04)");
    x.beginPath(); x.moveTo(128, 128); x.arc(128, 128, r, a0, a1); x.closePath(); x.fillStyle = gd; x.fill();
    x.lineWidth = 3; x.strokeStyle = "rgba(" + rgb + ",.65)"; x.beginPath(); x.moveTo(128 + Math.cos(a0) * r, 128 + Math.sin(a0) * r); x.lineTo(128, 128); x.lineTo(128 + Math.cos(a1) * r, 128 + Math.sin(a1) * r); x.stroke();
    var t = new w.THREE.CanvasTexture(c); t.anisotropy = 4; return (TEX[k] = t);
  }
  function veDiem3D() {
    if (!F || !F.w) return; var w = F.w, TH = w.THREE, rc = camVe();
    if (F.nhom) { w.scene.remove(F.nhom); F.nhom.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
    var g = new TH.Group(); g.name = "sdc-camera"; F.diem = [];
    var v0 = new TH.Vector3(), v1 = new TH.Vector3();
    DS.forEach(function (x) {
      if (!x.diem) return; var on = x.c.k === S.chon, mo = !!S.chon && !on, mauS = mauMuc(x.muc), mau = new TH.Color().setStyle(mauS), op = mo ? 0.35 : 1;
      var co = x.huong != null, rad = co ? x.huong * Math.PI / 180 : 0;
      /* ống kính glyph mặc định quay TRÁI màn ⇒ hướng chiếu sang phải màn thì lật gương */
      var guong = false; if (co && rc) { v0.set(x.diem[0], 0, x.diem[1]).project(rc); v1.set(x.diem[0] + Math.cos(rad), 0, x.diem[1] + Math.sin(rad)).project(rc); guong = v1.x > v0.x; }
      var sp = new TH.Sprite(new TH.SpriteMaterial({ map: texIcon(w, mauS, guong), transparent: true, opacity: op, depthTest: false, depthWrite: false }));
      sp.renderOrder = 1000; sp.position.set(x.diem[0], 6.5, x.diem[1]); sp.userData.camera = 1; g.add(sp);
      var q = null;
      if (co) {   // quạt: mặt phẳng nằm trên sàn (xoay −90° quanh X), quay quanh Y theo hướng (0° = +x, 90° = +y sơ đồ = +z thế giới)
        q = new TH.Mesh(new TH.PlaneGeometry(1, 1), new TH.MeshBasicMaterial({ map: texQuat(w, mauS, x.goc), transparent: true, opacity: op, depthTest: false, depthWrite: false, side: TH.DoubleSide }));
        q.geometry.rotateX(-Math.PI / 2); q.rotation.y = -rad; q.position.set(x.diem[0], 6.4, x.diem[1]); q.renderOrder = 998; q.userData.huong = 1; g.add(q);
      }
      var da = x.da && x.da.length > 2 ? x.da : x.vung ? [[x.vung.x0, x.vung.y0], [x.vung.x1, x.vung.y0], [x.vung.x1, x.vung.y1], [x.vung.x0, x.vung.y1]] : null;
      if (da && on) g.add(matSan(TH, da, mau, 0.38));   // vùng sàn CHỈ của camera đang chọn — tô hết thì thành mảng che mặt bằng (soi ảnh điện thoại 25/10)
      F.diem.push({ k: x.c.k, m: sp, q: q });
    });
    w.scene.add(g); F.nhom = g; F.so = F.diem.length; F.huy = []; F.cumK = "";   // cụm chồng tính lại ở vòng cỡ kế tiếp
    /* số cho thẻ Tổng quan (chỉ ghi khi đổi) — Tổng quan không tự tải dữ liệu camera */
    var tq = F.so + "/" + DS.length; if (window.tqGhi && ve._tq !== tq) { ve._tq = tq; window.tqGhi("sdc", { dat: F.so, tong: DS.length }); }
  }
  /* cỡ biểu tượng / quạt theo PIXEL màn: trực giao — mỗi px = (top − bottom) / zoom / chiều cao khung; phối cảnh (dự phòng) — theo khoảng cách */
  function vongCo() {
    if (!F || !F.w || !document.contains(F.el)) return; var w = F.w, cam = w.camera, cv = w.document.getElementById("c");
    var h = (cv && cv.clientHeight) || 600, rc = camVe(), pxPC = Math.tan(cam.fov * Math.PI / 360) / (h / 2);
    var pxTG = rc && rc.isOrthographicCamera ? (rc.top - rc.bottom) / (rc.zoom || 1) / h : 0;
    /* khung hẹp (điện thoại): biểu tượng 18 px, quạt 24 px — 26/36 px chồng kín mặt bằng (soi 390 px, 25/10 tối); vẫn ≥ 8 px bán kính */
    var nho = cv && cv.clientWidth < 500, CO = nho ? 18 : CO_ICON, RQ = nho ? 24 : R_QUAT;
    F.diem.forEach(function (d) { var px = pxTG || cam.position.distanceTo(d.m.position) * pxPC, on = d.k === S.chon;
      d.m.scale.setScalar(Math.max(0.05, CO * px * (on ? 1.3 : 1)));
      if (d.q) d.q.scale.setScalar(Math.max(0.05, 2 * RQ * px * 128 / 124 * (on ? 1.2 : 1))); });
    if (rc && cv) {
      var khoaCum = cv.clientWidth + "x" + cv.clientHeight + ":" + F.so + ":" + (rc.zoom || 1).toFixed(3);
      if (F.cumK !== khoaCum) { F.cumK = khoaCum; gomCum(CO, cv.getBoundingClientRect(), rc); }
      if (F.huy.length) {   // huy hiệu: lệch lên-phải theo trục MÀN (mặt bằng có thể xoay 90°) — cỡ 15 px (điện thoại 13 px)
        var TH = w.THREE, ph = new TH.Vector3().setFromMatrixColumn(rc.matrixWorld, 0), tr = new TH.Vector3().setFromMatrixColumn(rc.matrixWorld, 1), lech = CO * 0.42;
        F.huy.forEach(function (hh) { var px = pxTG || cam.position.distanceTo(hh.goc.position) * pxPC;
          hh.m.position.copy(hh.goc.position).addScaledVector(ph, lech * px).addScaledVector(tr, lech * px); hh.m.position.y = 6.6;
          hh.m.scale.setScalar(Math.max(0.05, (nho ? 13 : 15) * px)); });
      }
    }
    w.requestAnimationFrame(vongCo);
  }
  var ngay = function (iso) { var d = new Date(Date.parse(iso) + 7 * 3600e3).toISOString(); return d.slice(8, 10) + "/" + d.slice(5, 7) + " " + d.slice(11, 16); };

  /* ---------- thanh bên phải: 1 kênh ---------- */
  function moCam(k) {
    var r = DS.find(function (x) { return x.c.k === k; }); if (!r) return;
    S.chon = k; veDiem3D();
    var c = r.c, TB = CTX.moThanhBen(k);
    S.hc = { nguon: c.hc && c.hc.nguon, ao: !!r.ao, k: k, diem: (c.hc && c.hc.diem ? c.hc.diem : []).map(function (d) { return { px: d.px.slice(), m: d.m.slice() }; }), cho: null, che: "", tay: c.tay ? Object.assign({}, c.tay) : null, ghiChu: c.ghiChu || "", doi: 0 };
    $id("mTitle").innerHTML = '<span class="hx-mt1">' + e_(c.ten) + '</span><span class="hx-mt2">' + e_(c.dauGhi || c.ip) + " · kênh " + c.kenh + "</span>";
    veThan();
    window.hskThanhBen.xong(TB);
    /* chưa có khung lưu ⇒ lấy 1 khung trực tiếp (1 lượt đầu ghi cho mỗi lần người mở kênh) thay vì để ô đen */
    /* 28/10 user «top-review chụp khung ngay khi trỏ vào mắt cam»: khung lưu cũ > 10' ⇒ hiện khung lưu trước rồi thay bằng 1 khung trực tiếp
       (1 lượt top-review mỗi lần mở — nhẹ hơn hẳn làm mới định kỳ cả 237 kênh). Hỏng (kênh ngoài số kênh top-review, máy dự phòng) ⇒ giữ khung lưu. */
    var trucTiep = function () { return khungTrucTiep(k).then(function () { veAnhKhung(); var kt = $id("sdcKhungTt"); if (kt && S.hc && S.hc.k === k) kt.textContent = "Khung trực tiếp lúc " + new Date().toTimeString().slice(0, 5) + " (chưa lưu)"; }); };
    var cu = !c.khung || Date.now() - Date.parse(c.khung.luc) > 10 * 60e3;
    napAnh(k).then(function () { veAnhKhung(); if (cu && !GM) return trucTiep().catch(function () {}); }).catch(function () { return trucTiep().catch(function () { veAnhKhung(); }); });
  }
  function rHienTai() { return DS.find(function (x) { return x.c.k === S.hc.k; }); }
  function veThan() {
    var r = rHienTai(), c = r.c, hc = S.hc, dg = hc.diem.length >= 4 ? danhGia(hc.diem) : null, so = function (v, n) { return v.toFixed(n == null ? 1 : n).replace(".", ","); };
    /* user 25/10: không chip, không nút «i» — trạng thái là 1 dòng chữ (màu theo mức), cảnh báo là dòng chữ đỏ / vàng */
    /* chữ camera tự in lên hình — chỉ nêu khi KHÁC tên kênh ở tiêu đề (không lặp thông tin, BO-CHUAN §6 luật 14) */
    var osd = c.hc && c.hc.osd && boDau(c.hc.osd) !== boDau(c.ten) ? c.hc.osd : "";
    var h = '<div class="sdc-tt"><b style="color:' + mauVar(r.muc) + '">' + e_(r.nhan) + "</b>" + (osd ? "<br>Chữ trên hình: <b>" + e_(osd) + "</b>" : "") + r.canh.map(function (z) { return '<br><span style="color:var(--' + (z[0] === "bad" ? "bad" : "warn") + ')">' + e_(z[1]) + "</span>"; }).join("") + "</div>";
    h += '<div class="sdc-anh" id="sdcAnh"><div class="rong">Đang tải khung hình…</div></div>';
    h += '<div class="sdc-hang"><button type="button" class="hsk-nut' + (LIVE.k === hc.k ? " chinh" : "") + '" data-a="live">' + (LIVE.k === hc.k ? "Dừng trực tiếp" : "Xem trực tiếp") + '</button><button type="button" class="hsk-nut" data-a="khung">Lấy khung mới</button><span class="sdc-tt" id="sdcKhungTt">' + (c.khung ? "Khung lúc " + e_(ngay(c.khung.chup)) : "Chưa có khung hình") + "</span></div>";
    /* hiệu chỉnh */
    h += '<div class="sdc-sec"><h4>Hiệu chỉnh bằng điểm sàn</h4>';
    h += '<div class="sdc-hang"><button type="button" class="hsk-nut' + (hc.cho ? " chinh" : "") + '" data-a="gan">' + (hc.cho ? "Đang gắn — bấm để dừng" : "Gắn điểm") + '</button><span class="sdc-tt" id="sdcGanTt">' + (hc.cho === "anh" ? "Chạm 1 điểm <b>trên sàn</b> ở khung hình (chân trụ kệ chạm sàn, vạch sơn)" : hc.cho === "sodo" ? "Chạm đúng điểm đó trên <b>sơ đồ</b>" : "") + "</span></div>";
    h += '<div class="sdc-mini" id="sdcMini"><svg preserveAspectRatio="xMidYMid meet"><g>' + nenSvg() + '</g><g id="sdcMiniLop"></g></svg></div>';
    /* điểm ẢO (tư thế ước / máy dò) không bày thành bảng: 16 dòng «lệch 0 px» không mang tin; bấm «Gắn điểm» là bắt đầu bộ điểm thật từ 0 */
    if (hc.diem.length && !hc.ao) h += '<table class="sdc-cap">' + hc.diem.map(function (d, i) { var lo = dg && dg.H ? veAnh(dg.H, d.m) : null, e = lo ? Math.hypot(lo[0] - d.px[0], lo[1] - d.px[1]) : null;
      return "<tr><td><b>" + (i + 1) + "</b></td><td>ảnh " + Math.round(d.px[0]) + ", " + Math.round(d.px[1]) + "</td><td>sơ đồ " + so(d.m[0], 2) + " · " + so(d.m[1], 2) + " m</td><td>" + (e != null ? "lệch " + Math.round(e) + " px" : "") + '</td><td style="text-align:right"><button type="button" class="hsk-nut nho nguy" data-xoa="' + i + '" aria-label="Bỏ điểm ' + (i + 1) + '">✕</button></td></tr>'; }).join("") + "</table>";
    if (hc.ao) { /* mức đã nằm ở dòng trạng thái đầu thanh */ }
    else if (dg && !dg.H) h += '<div class="sdc-tt">Mức: <b style="color:var(--bad)">Chưa khớp</b> · các điểm gần như thẳng hàng (vd cùng 1 dãy chân trụ) — không tính được, rải thêm điểm ra 2 bên / xa gần.</div>';
    else if (dg) h += '<div class="sdc-tt">Mức: <b style="color:' + mauVar("hc-" + dg.muc) + '">' + { tot: "Khớp tốt", tam: "Tạm", kem: "Chưa khớp" }[dg.muc] + "</b> · " +
      (dg.loiM != null ? "kiểm chéo lệch TB <b>" + so(dg.loiM, 2) + " m</b>" : dg.thangHang ? "nhiều điểm thẳng hàng — rải thêm điểm ra 2 bên / xa gần" : "4 điểm — thêm điểm thứ 5 để kiểm chéo") + " · chỗ lắp (ước) cao ≈ <b>" + so(dg.cam.cao) + " m</b> · góc nhìn ≈ <b>" + Math.round(dg.cam.goc) + "°</b>" +
      (dg.thay ? "" : "") + "</div>";
    else if (hc.diem.length) h += '<div class="sdc-tt">Còn thiếu ' + (4 - hc.diem.length) + " điểm để tính.</div>";
    h += "</div>";
    /* đặt tay */
    var t = hc.tay;
    h += '<div class="sdc-sec"><h4>Đặt tay (cảnh không thấy sàn)</h4>' +
      '<div class="sdc-hang"><button type="button" class="hsk-nut' + (hc.che === "tay" ? " chinh" : "") + '" data-a="tay">' + (hc.che === "tay" ? "Chạm sơ đồ nhỏ để đặt" : t ? "Dời chỗ lắp" : "Đặt chỗ lắp") + "</button>" + (t ? '<button type="button" class="hsk-nut nguy" data-a="boTay">Bỏ đặt tay</button>' : "") + "</div>" +
      (t ? '<div class="sdc-tr"><span>Hướng</span><input type="range" min="-180" max="180" step="1" data-t="huong" value="' + t.huong + '"><b>' + Math.round(t.huong) + '°</b><span>Góc</span><input type="range" min="20" max="150" step="1" data-t="goc" value="' + t.goc + '"><b>' + Math.round(t.goc) + '°</b><span>Tầm</span><input type="range" min="3" max="40" step="0.5" data-t="tam" value="' + t.tam + '"><b>' + so(+t.tam) + " m</b></div>" : "") + "</div>";
    /* ô + nguồn */
    var oT = hc.ao ? r.thay || [] : dg && dg.H ? oTrongKhung(dg.H, dg.cam) : r.thay || [];
    /* danh sách ô dài ⇒ kẹp 3 dòng, bấm trải (mẫu .fld-dai:not(.mo) — BO-CHUAN §6 luật 9/11); bỏ dòng chỉ dẫn thường trực, ý «đã trừ ô bị che» vào tiêu đề */
    h += '<div class="sdc-sec"><h4>Ô trong khung nhìn' + (oT.length ? " · " + oT.length + " ô, đã trừ ô bị kệ che" : "") + "</h4>" + (oT.length ? '<div class="sdc-tt sdc-kep" title="Bấm để xem hết">' + e_(oT.map(function (k) { return k.replace(/^F0-/, ""); }).join(", ")) + "</div>" : '<div class="sdc-tt">Có sau khi hiệu chỉnh ≥ 4 điểm.</div>') +
      '<div class="sdc-tt">' + (r.goiY ? "Tên kênh nói: <b>" + e_(r.goiY.mo) + "</b>" : "Tên kênh không chỉ ra ô / khu.") + (c.nguoiKiem ? "<br>Người kiểm thấy: <b>" + e_(c.nguoiKiem.o.slice(0, 6).join(", ")) + (c.nguoiKiem.o.length > 6 ? "…" : "") + "</b> — " + e_(c.nguoiKiem.nguon) + (c.nguoiKiem.luuY ? "<br>Lưu ý: " + e_(c.nguoiKiem.luuY) : "") : "") + "</div></div>";
    h += '<div class="sdc-sec"><h4>Ghi chú</h4><textarea class="sdc-gc" id="sdcGc" maxlength="300" placeholder="vd: camera gắn cột đầu dãy 501, nhìn về tủ 10">' + e_(hc.ghiChu) + "</textarea></div>";
    h += '<div class="sdc-hang" style="justify-content:flex-end"><span class="sdc-tt" id="sdcLuuTt" style="margin-right:auto"></span>' + (c.hc || c.tay ? '<button type="button" class="hsk-nut nguy" data-a="xoa">Xoá hiệu chỉnh</button>' : "") +
      '<button type="button" class="hsk-nut chinh" data-a="luu"' + (hc.doi ? "" : " disabled") + ">Lưu</button></div>";
    var mb = $id("mBody"); mb.innerHTML = h;
    noiThan(dg);
  }
  function noiThan(dg) {
    var mb = $id("mBody"), hc = S.hc, r = rHienTai();
    mb.querySelectorAll("[data-a]").forEach(function (b) { b.onclick = function () { hanhDong(b.dataset.a, b); }; });
    mb.querySelectorAll("[data-xoa]").forEach(function (b) { b.onclick = function () { hc.diem.splice(+b.dataset.xoa, 1); hc.doi = 1; hc.nguon = "nguoi"; veThan(); veAnhKhung(); }; });
    mb.querySelectorAll("input[data-t]").forEach(function (i) { i.oninput = function () { hc.tay[i.dataset.t] = +i.value; hc.doi = 1; i.nextElementSibling.textContent = i.dataset.t === "tam" ? String(i.value).replace(".", ",") + " m" : Math.round(i.value) + "°"; veMini(); var b = mb.querySelector('[data-a="luu"]'); if (b) b.disabled = false; }; });
    var kep = mb.querySelector(".sdc-kep"); if (kep) kep.onclick = function () { kep.classList.toggle("mo"); };
    var gc = $id("sdcGc"); gc.oninput = function () { hc.ghiChu = gc.value; hc.doi = 1; var b = mb.querySelector('[data-a="luu"]'); if (b) b.disabled = false; };
    /* sơ đồ nhỏ: khung quanh vùng camera (hiệu chỉnh → điểm; tên kênh → ô) */
    var vg = null, ds = hc.diem.map(function (d) { return d.m; }).concat(r.diem ? [r.diem] : []);
    if (r.vung) vg = { x0: r.vung.x0, y0: r.vung.y0, x1: r.vung.x1, y1: r.vung.y1 };
    ds.forEach(function (p) { vg = vg ? { x0: Math.min(vg.x0, p[0]), y0: Math.min(vg.y0, p[1]), x1: Math.max(vg.x1, p[0]), y1: Math.max(vg.y1, p[1]) } : { x0: p[0], y0: p[1], x1: p[0], y1: p[1] }; });
    var mini = $id("sdcMini");
    S.mini = banDo(mini, S.miniVb && S.miniVb.k === hc.k ? S.miniVb.v : vg ? vbVua(vg, 5) : [0, 0, SD.W, SD.H], function (tl) { S.miniTl = tl; veMini(dg); if (S.mini) S.miniVb = { k: hc.k, v: S.mini.vb() }; }, function (m, tl) {
      if (hc.che === "tay") { hc.tay = Object.assign({ huong: 0, goc: 90, tam: 12 }, hc.tay || {}, { x: +m[0].toFixed(2), y: +m[1].toFixed(2) }); hc.che = ""; hc.doi = 1; veThan(); return; }
      if (hc.cho !== "sodo") return;
      var p = m, tot = null; GOC.forEach(function (g) { var d = Math.hypot(g[0] - m[0], g[1] - m[1]); if (d <= 0.35 && (!tot || d < tot.d)) tot = { d: d, g: g }; }); if (tot) p = tot.g;
      hc.diem.push({ px: hc.tamPx, m: [+p[0].toFixed(3), +p[1].toFixed(3)] }); hc.nguon = "nguoi"; hc.tamPx = null; hc.cho = "anh"; hc.doi = 1; veThan(); veAnhKhung();
    });
    mini.classList.toggle("gan", hc.cho === "sodo" || hc.che === "tay");
  }
  function veMini(dg) {
    var hc = S.hc, lop = $id("sdcMiniLop"), tl = S.miniTl || 10; if (!lop) return;
    dg = dg || (hc.diem.length >= 4 ? danhGia(hc.diem) : null);
    var r = rHienTai(), h = "", m = MUC[r.muc][0];
    var cm = hc.ao && r.camT ? r.camT : dg && dg.cam;
    if (dg && dg.H) { var da = hc.ao && r.da ? r.da : vungThay(dg.H, cm); if (da.length > 2) h += '<polygon points="' + da.map(function (p) { return p[0].toFixed(2) + "," + p[1].toFixed(2); }).join(" ") + '" fill="var(--accent)" fill-opacity=".15" stroke="var(--accent)" stroke-width="' + 1.5 / tl + '"/>';
      h += '<circle cx="' + cm.x + '" cy="' + cm.y + '" r="' + 7 / tl + '" fill="var(--accent)" stroke="var(--surface)" stroke-width="' + 2 / tl + '"/>'; }
    else if (r.vung) h += '<rect x="' + r.vung.x0 + '" y="' + r.vung.y0 + '" width="' + (r.vung.x1 - r.vung.x0) + '" height="' + (r.vung.y1 - r.vung.y0) + '" fill="' + m + '" fill-opacity=".12" stroke="' + m + '" stroke-dasharray="' + 4 / tl + " " + 3 / tl + '" stroke-width="' + 1.2 / tl + '"/>';
    if (hc.tay) { var q = quat(hc.tay); h += '<polygon points="' + q.map(function (p) { return p[0].toFixed(2) + "," + p[1].toFixed(2); }).join(" ") + '" fill="var(--info,var(--accent))" fill-opacity=".14" stroke="var(--info,var(--accent))" stroke-dasharray="' + 3 / tl + " " + 2 / tl + '" stroke-width="' + 1.2 / tl + '"/>' +
      '<circle cx="' + hc.tay.x + '" cy="' + hc.tay.y + '" r="' + 6 / tl + '" fill="var(--info,var(--accent))"/>'; }
    if (!hc.ao) hc.diem.forEach(function (d, i) { h += '<circle cx="' + d.m[0] + '" cy="' + d.m[1] + '" r="' + 8 / tl + '" fill="var(--warn)" stroke="var(--surface)" stroke-width="' + 1.5 / tl + '"/><text transform="scale(' + (1 / tl) + ')" x="' + d.m[0] * tl + '" y="' + (d.m[1] * tl + 3.5) + '" font-size="11" text-anchor="middle" fill="#000" font-weight="700">' + (i + 1) + "</text>"; });   // cỡ px thật (xem nenSvg)
    lop.innerHTML = h;
  }
  function veAnhKhung() {
    var box = $id("sdcAnh"); if (!box || !S.hc) return;
    var hc = S.hc, r = rHienTai(), song = LIVE.k === hc.k && LIVE.url, url = song ? LIVE.url : ANH[hc.k], dg = hc.diem.length >= 4 ? danhGia(hc.diem) : null, ov = "";
    /* đang trực tiếp: chỉ đổi nguồn ảnh (lớp phủ giữ nguyên) — dựng lại cả khung mỗi giây làm nháy và mất cú chạm gắn điểm */
    if (song && box.__song === hc.k && box.__phu === hc.diem.length + "|" + (hc.tamPx || "")) { var im0 = box.querySelector("img"); if (im0) { im0.src = url; return; } }
    box.__song = song ? hc.k : ""; box.__phu = hc.diem.length + "|" + (hc.tamPx || "");
    if (!url) { box.innerHTML = '<div class="rong">' + (r.c.khung ? "Không tải được khung hình." : "Chưa có khung hình — bấm «Lấy khung mới».") + "</div>"; box.classList.remove("gan"); return; }
    /* lớp phủ: ô kệ chiếu từ sơ đồ lên ảnh (khớp thanh kệ thật = hiệu chỉnh đúng) · vùng đo của phiếu · điểm đã gắn.
       Màu CỐ ĐỊNH (vàng/cam/đỏ, chữ đen) vì nền là ẢNH CAMERA chứ không phải nền theme — token theme tối/sáng sẽ chìm vào ảnh. */
    /* chỉ ô có TÂM trong khung nhìn (trong tầm 35 m) — vẽ mọi ô thì lưới ô xa chồng kín ảnh, không soi được (soi ảnh 24/10) */
    if (dg && dg.H) (hc.ao ? r.thay || [] : oTrongKhung(dg.H, dg.cam)).forEach(function (k) { var o = O[k], g = [[o.x, o.y], [o.x + o.w, o.y], [o.x + o.w, o.y + o.h], [o.x, o.y + o.h]].map(function (p) { return veAnh(dg.H, p); });
      if (g.some(function (p) { return !p || Math.abs(p[0]) > 4000 || Math.abs(p[1]) > 4000; })) return;
      if (g.every(function (p) { return p[0] < 0 || p[0] > W || p[1] < 0 || p[1] > H_; })) return;
      ov += '<polygon points="' + g.map(function (p) { return p[0].toFixed(0) + "," + p[1].toFixed(0); }).join(" ") + '" fill="none" stroke="#ffd400" stroke-width="2" opacity=".85"/>'; });
    (r.c.roi || []).forEach(function (z) { if (!z.khung) return; ov += '<rect x="' + z.khung[0] + '" y="' + z.khung[1] + '" width="' + z.khung[2] + '" height="' + z.khung[3] + '" fill="none" stroke="#ff8a00" stroke-width="3" stroke-dasharray="10 6"/><text x="' + (z.khung[0] + 4) + '" y="' + (z.khung[1] + 22) + '" font-size="20" fill="#ff8a00" font-weight="700">' + e_(z.o.replace(/^F0-/, "")) + "</text>"; });
    if (!hc.ao) hc.diem.forEach(function (d, i) { ov += '<circle cx="' + d.px[0] + '" cy="' + d.px[1] + '" r="13" fill="#ffd400" stroke="#000" stroke-width="2"/><text x="' + d.px[0] + '" y="' + (d.px[1] + 6) + '" font-size="17" text-anchor="middle" font-weight="700" fill="#000">' + (i + 1) + "</text>"; });
    if (hc.tamPx) ov += '<circle cx="' + hc.tamPx[0] + '" cy="' + hc.tamPx[1] + '" r="12" fill="none" stroke="#ff2d55" stroke-width="4"/>';
    box.innerHTML = '<img alt="Khung hình ' + e_(r.c.ten) + '" src="' + url + '"><svg viewBox="0 0 ' + W + " " + H_ + '" preserveAspectRatio="none">' + ov + "</svg>";
    box.classList.toggle("gan", hc.cho === "anh");
    box.onclick = function (e) {
      if (hc.cho !== "anh") return; var b = box.getBoundingClientRect(), px = [(e.clientX - b.left) * W / b.width, (e.clientY - b.top) * H_ / b.height];
      hc.tamPx = [+px[0].toFixed(1), +px[1].toFixed(1)]; hc.cho = "sodo"; veAnhKhung(); var tt = $id("sdcGanTt"); if (tt) tt.innerHTML = "Chạm đúng điểm đó trên <b>sơ đồ</b>";
      var mini = $id("sdcMini"); if (mini) { mini.classList.add("gan"); mini.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
    };
  }
  function hanhDong(a, b) {
    var hc = S.hc, r = rHienTai(), tt = function (s) { var o = $id("sdcLuuTt"); if (o) o.textContent = s; };
    if (a === "live") { if (LIVE.k === hc.k) { dungLive(); veNutLive(); veAnhKhung(); ttLive(r.c.khung ? "Khung lúc " + ngay(r.c.khung.chup) : "Chưa có khung hình"); } else { chayLive(hc.k); veNutLive(); ttLive("Đang nối đầu ghi…"); } return; }
    /* camera đang theo tư thế ước (điểm ảo): bắt đầu gắn = bộ điểm THẬT từ 0 — trộn điểm người bấm với điểm ảo làm phép chiếu sai */
    if (a === "gan") { if (!hc.cho && hc.ao) { hc.diem = []; hc.ao = false; hc.nguon = "nguoi"; hc.doi = 1; }
      hc.cho = hc.cho ? null : "anh"; hc.tamPx = null; hc.che = ""; veThan(); veAnhKhung(); return; }
    if (a === "tay") { hc.che = hc.che === "tay" ? "" : "tay"; hc.cho = null; veThan(); veAnhKhung(); return; }
    if (a === "boTay") { hc.tay = null; hc.doi = 1; veThan(); veAnhKhung(); return; }
    if (a === "khung") {
      b.disabled = true; var kt = $id("sdcKhungTt"); if (kt) kt.textContent = "Đang lấy khung…";   // ban ngày: khung trực tiếp (< 1 s); 19:00–06:00: cắt video lúc 10:00 (~45 s)
      /* 19:00–06:00 kho có thể tắt đèn khu kệ → mặc định lấy 10:00 gần nhất cho rõ sàn */
      var gio = new Date(Date.now() + 7 * 3600e3).getUTCHours(), body = { cam: hc.k };
      if (gio >= 19 || gio < 6) { var d = new Date(Date.now() + 7 * 3600e3); if (gio < 6) d.setUTCDate(d.getUTCDate() - 1); body.luc = d.toISOString().slice(0, 10) + "T03:00:00Z"; }
      goi("/api/so-do-camera/khung", { method: "POST", body: body, ms: 200000 }).then(function (j) {
        r.c.khung = j.khung; D.han.conLuot = j.conLuot; var i = DS.indexOf(r); DS[i] = tinh(r.c);
        return napAnh(hc.k, true).then(function () { veThan(); veAnhKhung(); veDiem3D(); });
      }).catch(function (e) { if (kt) kt.textContent = e.message; }).finally(function () { b.disabled = false; });
      return;
    }
    if (a === "luu" || a === "xoa") {
      if (a === "xoa" && !confirm("Xoá hiệu chỉnh của kênh «" + r.c.ten + "»? (máy giữ bản sao lưu)")) return;
      var dg = hc.diem.length >= 4 ? danhGia(hc.diem) : null;
      if (a === "luu" && hc.diem.length && hc.diem.length < 4) { tt("Cần ≥ 4 điểm (hoặc bỏ hết điểm để chỉ lưu đặt tay / ghi chú)."); return; }
      var body2 = a === "xoa" ? { cam: hc.k, hc: null, tay: null, ghiChu: "" } : { cam: hc.k, ghiChu: hc.ghiChu, tay: hc.tay || null,
        hc: dg ? Object.assign(dg.H ? { diem: hc.diem, loiM: dg.loiM == null ? undefined : dg.loiM, loiPx: dg.loiPx, cao: dg.cam.cao, f: dg.cam.f, muc: dg.muc } : { diem: hc.diem, muc: "kem" },
          (hc.nguon === "may-do" || hc.nguon === "uoc") && r.c.hc ? { nguon: hc.nguon, tin: r.c.hc.tin, khopTen: r.c.hc.khopTen, chac: r.c.hc.chac } : {},
          r.c.hc ? { osd: r.c.hc.osd, vt: r.c.hc.vt } : {}) : null };   // giữ nguồn «máy dò» khi người không đụng điểm
      b.disabled = true; tt("Đang lưu…");
      goi("/api/so-do-camera/luu", { method: "POST", body: body2 }).then(function (j) {
        Object.assign(r.c, j.cam); var i = DS.indexOf(r); DS[i] = tinh(r.c); hc.doi = 0;
        if (a === "xoa") { hc.diem = []; hc.tay = null; hc.ghiChu = ""; }
        veThan(); veAnhKhung(); veMan(); tt("Đã lưu " + new Date().toTimeString().slice(0, 5) + (dg ? " · " + { tot: "khớp tốt", tam: "tạm", kem: "chưa khớp" }[dg.muc] : ""));
      }).catch(function (e) { tt("Không lưu được: " + e.message); b.disabled = false; });
    }
  }

  window.HXSODO = { ve: ve, moCam: moCam, _dem: function () { return DS.length; }, _chua: function () { return DS.filter(function (x) { return !x.diem; }).length; },
    _diem: function (k) { var x = DS.find(function (y) { return y.c.k === k; }); return x && x.diem; },
    /* bộ đo: cụm chồng lớn nhất — số camera + toạ độ TRANG của tâm biểu tượng nằm trên cùng (để chạm thật) */
    _cum: function () { if (!F || !F.w || !F.huy || !F.huy.length) return null; var w = F.w, rc = camVe(), b = F.el.getBoundingClientRect(), cv = w.document.getElementById("c").getBoundingClientRect(), v = new w.THREE.Vector3(), tot = null;
      F.huy.forEach(function (h) { var n = h.m.userData.cum; if (tot && tot.n >= n) return; v.copy(h.goc.position).project(rc); var x = (v.x + 1) / 2 * cv.width, y = (1 - v.y) / 2 * cv.height;
        if (x > 30 && x < cv.width - 30 && y > 30 && y < cv.height - 30) tot = { n: n, x: b.left + cv.left + x, y: b.top + cv.top + y }; }); return tot; },
    _khoa: function () { khoaLai("QC"); }, _toan: { phepChieu: phepChieu, danhGia: danhGia, tachCam: tachCam, goiYTen: goiYTen, vungThay: vungThay } };
})();
