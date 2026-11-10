/* lich-su-ben.js — TAB «LỊCH SỬ» THANH BÊN DÙNG CHUNG Planogram + Bảo dưỡng (10/11/2026).
 * User 10/11 chốt mẫu «Lịch sử - mẫu chốt lịch tháng» (Tệp xuất › Mẫu HTML Lịch sử 10-11-2026 › 1 - Lịch sử lịch tháng (chốt).html):
 *   · hàng đầu: Segmented «Tất cả | Ảnh | Sửa chữa» (kèm đếm) bên trái — nút chức năng khoá cứng MÉP PHẢI, cả hàng 1 dòng;
 *   · lịch chia theo tháng, mỗi ngày 1 ô vuông (web ~70 px · điện thoại ~46 px, 7 cột chia đều): ngày có lượt = ô nền ảnh đầu, số ngày
 *     góc trái trên, số ảnh góc phải dưới (web); ngày không lượt = ô xám nhạt chỉ có số ngày;
 *   · «Tất cả» = lịch ảnh + chấm cam ngày có sửa chữa (bấm chấm ⇒ sang Sửa chữa, cuộn tới dòng); «Ảnh» = chỉ lịch ảnh;
 *     nút phải = «Bộ lọc» (nút thư viện .btn-filter.bl-moi như nutLoc() Bảo dưỡng) mở NGĂN KÉO NỔI (TK-28): Ngày (taoBoLocNgay) ·
 *     Người báo cáo (ô chọn thư viện enhanceSelect); đang lọc ⇒ «Đang lọc ✕» đỏ, ô không khớp chuyển xám, số đếm theo kết quả lọc;
 *   · «Sửa chữa» = sổ hư hỏng · sửa chữa (BAO-DUONG-LICHSU, GAS bd_ls) theo MÃ VỊ TRÍ; nút phải «+ Thêm» CÙNG KHUÔN nút Bộ lọc mở ngăn kéo
 *     (Loại = 4 chip màu 1 chạm · Ngày taoBoLocNgay 1 ngày, cấm tương lai · Người thực hiện · Mô tả · Vật tư · SL · Đơn vị · Chi phí);
 *     lưu lạc quan (< 1 s), lỗi thì hoàn lại + toast.
 * Mô-đun chỉ đưa dữ liệu: hskLichSu.ve(p) → HTML; p = { khoa, ngay:[iso mới→cũ], luot:[{id, ngay, gio, ten, email, a:[url], t}],
 *   sc:[{id, ngay, loai, moTa, vatTu, sl, dvt, cp, nguoiLam, nguoiGhi, tam}] | null, coThem, img(url) → <img>, sauVe(root), moAnh(luotId),
 *   them(goi) → Promise }. Sự kiện uỷ quyền 1 lần trên document; trạng thái (chế độ / lọc / ngăn kéo / bản nháp) giữ theo khoá
 *   ⇒ mô-đun vẽ lại cả thanh bên vẫn giữ nguyên chỗ đang đứng (TK-14).
 * Pop-up xem ảnh kiểu B (dải đáy) dựng ở hskLichSu.moAnh / .moNgay → openLB(list, i, {kieu:"B", dai}) của index.html. */
(function () {
  if (window.hskLichSu) return;
  var TI = window.hskTienIch || {}, esc = TI.esc || function (s) { return String(s == null ? "" : s); };
  var ST = {}, P = {};
  var LOAI = [["Hư hỏng", "ls-hh"], ["Sửa chữa", "ls-sc"], ["Nâng cấp", "ls-nc"], ["Thay thế vật tư", "ls-vt"]];
  var THU = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  function st(k) { return ST[k] || (ST[k] = { che: "tat", loc: { tu: "", den: "", ng: "", vt: "" }, keo: "", nhap: { loai: "Sửa chữa" }, cuon: "" }); }
  function dm(iso) { var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + "/" + m[2] : String(iso || ""); }
  function isoVN(t) { return new Date(t + 7 * 36e5).toISOString().slice(0, 10); }
  function lopLoai(l) { var x = LOAI.filter(function (y) { return y[0] === l; })[0]; return x ? x[1] : "ls-sc"; }
  function tien(x) { var n = Number(String(x == null ? "" : x).replace(/[^\d]/g, "")); return n ? n.toLocaleString("vi-VN") + " đ" : ""; }
  /* 10/11 tối user: mục «Ảnh» lọc theo VỊ TRÍ (mã ô con của ảnh, p.con) thay cho Ngày; «Tất cả» giữ Ngày. Mỗi chế độ chỉ dùng trường lọc của nó. */
  function laAnh(o) { return o.che === "anh"; }
  function khop(o, l) { var a = laAnh(o); return (a || !o.loc.tu || l.ngay >= o.loc.tu) && (a || !o.loc.den || l.ngay <= o.loc.den) && (!o.loc.ng || l.ten === o.loc.ng); }
  function dangLoc(o) { return !!(o.loc.ng || (laAnh(o) ? o.loc.vt : o.loc.tu || o.loc.den)); }
  function maCon(p, l, k) { var c = p && p.con ? p.con(k, l.a.length) : ""; var m = c && typeof c === "object" ? String(c.ma || "") : ""; return /\s/.test(m) ? "" : m; }   // ảnh ngoài 16 ô chuẩn («… (Ảnh 17/24)») không thuộc ô nào
  /* chỉ số ảnh của 1 lượt khớp mã vị trí đang lọc (không lọc ⇒ mọi ảnh) */
  function anhVt(p, o, l) { var ds = (l.a || []).map(function (u, k) { return k; }); if (!laAnh(o) || !o.loc.vt) return ds;
    return ds.filter(function (k) { return maCon(p, l, k) === o.loc.vt; }); }

  var CSS = [
    ".lsb{position:relative}",
    /* 10/11 tối user chốt «4 ô viền riêng · theo mẫu 11 · 3 ô không biểu tượng»: Tất cả · Ảnh · Sửa chữa · Bộ lọc/+ Thêm = 4 ô BẰNG NHAU (cỡ ô rộng nhất),
       khít chữ (chữ cách khung 2 px), cả hàng căn giữa; ô đang chọn viền + chữ màu nhấn, nền nhấn nhạt */
    "html body .lsb .panel-head.lsb-hd{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;justify-content:center;align-items:stretch;gap:8px;width:max-content;max-width:100%;white-space:nowrap;min-height:0;padding:0;margin:0 auto 10px;border:0;font-size:inherit;font-weight:400;line-height:normal;background:none}",
    ".lsb-seg{display:contents}",
    "html body .lsb .lsb-hd .hp-whtab,html body .lsb .lsb-hd .btn-filter{display:inline-flex!important;align-items:center;justify-content:center;gap:4px;width:100%;min-width:0;min-height:0!important;height:auto!important;margin:0!important;padding:2px!important;" +
      "border:1px solid var(--border)!important;border-radius:8px!important;background:var(--surface)!important;box-shadow:none!important;color:var(--text)!important;font:inherit;font-size:13px!important;font-weight:400!important;line-height:20px!important;cursor:pointer;white-space:nowrap}",
    "html body .lsb .lsb-hd .hp-whtab::before,html body .lsb .lsb-hd .hp-whtab::after,html body .lsb .lsb-hd .btn-filter::after{display:none!important}",   /* mẫu chốt: Bộ lọc không mũi tên — ô bằng các ô kia */
    "html body .lsb .lsb-hd .hp-whtab.active{border-color:var(--accent)!important;background:color-mix(in srgb,var(--accent) 10%,var(--surface))!important;color:var(--accent)!important;font-weight:600!important}",
    "html body .lsb .lsb-hd .hp-whtab[disabled]{opacity:.5;cursor:not-allowed}",
    "html body .lsb .lsb-hd .hp-whtab b{margin:0;padding:0 5px;border-radius:8px;font-size:11px;line-height:16px;font-weight:400;background:var(--ad-nen2,var(--surface2));color:var(--muted)}",
    "html body .lsb .lsb-hd .hp-whtab.active b{color:var(--accent);background:color-mix(in srgb,var(--accent) 14%,var(--surface))}",
    ".lsb-hd .bl-cum{position:relative;display:flex;margin:0}html body .lsb .lsb-hd .bl-cum{width:100%!important}html body .lsb .lsb-hd .bl-cum>.btn-filter{flex:1 1 auto;width:100%!important;max-width:none}.lsb-hd .bl-cum .bl-xoa{position:absolute;right:-8px;top:-8px;z-index:1}",
    "html body .lsb-hd .btn-filter.lsb-them::after{display:none}",
    ".lsb-keo{position:absolute;right:0;top:40px;z-index:6;width:300px;max-width:100%;box-sizing:border-box;display:flex;flex-direction:column;gap:12px;padding:14px;" +
      "background:var(--surface);border:1px solid var(--ad-chia,var(--border));border-radius:8px;" +
      "box-shadow:0 6px 16px 0 color-mix(in srgb,var(--text) 8%,transparent),0 9px 28px 8px color-mix(in srgb,var(--text) 5%,transparent);" +
      "transform-origin:top right;animation:popIn .22s var(--ez-spring,cubic-bezier(.16,1,.3,1))}",
    ".lsb-keo.them{width:440px}",
    ".lsb-keo .nh{display:block;font-size:11px;color:var(--muted);margin:0 0 4px}",
    ".lsb-keo .cs,.lsb-keo .date-filter{width:100%}",
    ".lsb-keo input,.lsb-keo textarea{width:100%;box-sizing:border-box;min-height:32px;padding:5px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font:inherit;font-size:13px}",
    ".lsb-keo textarea{min-height:52px;resize:vertical}",
    ".lsb-keo .h2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.lsb-keo .h4{display:grid;grid-template-columns:minmax(0,1fr) 70px 70px 120px;gap:8px}",
    ".lsb-loai{display:flex;gap:6px;flex-wrap:nowrap}",
    "html body .lsb-loai .bd-ls-loai{font-size:12px;line-height:18px;padding:5px 10px;border:1px solid transparent;cursor:pointer;opacity:.55;font-weight:600}",
    "html body .lsb-loai .bd-ls-loai.on{opacity:1;border-color:currentColor}",
    ".lsb-keo .cuoi{display:flex;gap:8px;justify-content:flex-end;align-items:center}.lsb-keo .cuoi .bao{margin-right:auto;font-size:12px;color:var(--bad)}",
    ".lsb-th{font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.04em;margin:12px 0 6px}.lsb-th:first-child{margin-top:4px}",
    ".lsb-lich{--o:70px;display:grid;grid-template-columns:repeat(7,var(--o));gap:4px;justify-content:space-between}",
    ".lsb-lich .t{font-size:10.5px;color:var(--muted);text-align:center}",
    ".lsb-o{position:relative;height:var(--o);border-radius:6px;overflow:hidden;box-sizing:border-box;border:1px solid var(--ad-chia,var(--border));background:var(--ad-nen2,var(--surface2))}",
    ".lsb-o.rong{border:0;background:none}",
    ".lsb-o.co{border-color:transparent;cursor:pointer;background:var(--surface2)}",
    ".lsb-o.co:focus-visible{outline:2px solid var(--accent);outline-offset:1px}",
    ".lsb-o>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}",
    ".lsb-o .so{position:absolute;left:4px;top:3px;font-size:10.5px;font-weight:600;color:var(--muted);line-height:14px}",
    ".lsb-o.co .so{color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.6)}",
    ".lsb-o .dem{position:absolute;right:3px;bottom:3px;font-size:10px;line-height:14px;background:rgba(0,0,0,.6);color:#fff;border-radius:4px;padding:0 4px}",
    ".lsb-o .cham{position:absolute;right:3px;top:3px;width:9px;height:9px;padding:0;border-radius:50%;background:var(--warn);border:1.5px solid #fff;cursor:pointer;z-index:1}",
    ".lsb-o .cham::before{content:'';position:absolute;inset:-10px}",
    ".lsb-o.chi-sc{cursor:pointer}",
    ".lsb-o.mo>img{filter:grayscale(1);opacity:.25}.lsb-o.mo .so{color:var(--muted);text-shadow:none}.lsb-o.mo .dem{display:none}",
    ".lsb-scds{display:flex;flex-direction:column}",
    ".lsb-sc{display:grid;grid-template-columns:56px 112px minmax(0,1fr) 90px;column-gap:10px;align-items:center;min-height:40px;padding:6px 0;border-bottom:1px solid var(--ad-chia,var(--border));font-size:12.5px;white-space:nowrap}",
    ".lsb-sc.dau{min-height:30px;padding:0;font-size:10.5px;font-weight:600;color:var(--muted);letter-spacing:.04em;background:var(--ad-nen2,var(--surface2))}",
    ".lsb-sc>.nd{display:flex;flex-direction:column;gap:1px;min-width:0;overflow:hidden}.lsb-sc>.nd>*{overflow:hidden;text-overflow:ellipsis}",
    ".lsb-sc small{font-size:11px;color:var(--muted)}.lsb-sc>.cp{text-align:right;font-variant-numeric:tabular-nums}",
    ".lsb-sc.tam{opacity:.6}.lsb-sc.den{background:color-mix(in srgb,var(--warn) 10%,transparent)}",
    ".lsb-trong{padding:14px 0;color:var(--muted);font-size:12.5px}",
    "@media(max-width:560px){.lsb-lich{--o:46px}.lsb-o .dem{display:none}" +
      "html body .lsb .panel-head.lsb-hd{gap:6px}html body .lsb .lsb-hd .hp-whtab,html body .lsb .lsb-hd .btn-filter{font-size:12px!important;gap:3px}html body .lsb .lsb-hd .hp-whtab b{padding:0 4px;font-size:10.5px}" +
      /* 10/11 tối user (screenshot-1794306367863) «+ Thêm đang to — thu nhỏ cho vừa điện thoại»: lề 10, khe 8, ô nhập 34, Ngày + Người thực hiện cùng hàng,
         Vật tư · SL · ĐV một hàng */
      ".lsb-keo,.lsb-keo.them{width:100%;padding:10px;gap:8px}.lsb-keo .nh{margin-bottom:2px}" +
      ".lsb-keo input,.lsb-keo textarea{min-height:34px;padding:4px 8px}.lsb-keo textarea{min-height:44px}.lsb-keo .date-filter .date-btn{min-height:34px!important;height:34px}" +
      ".lsb-keo .h2{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}.lsb-keo .h4{grid-template-columns:minmax(0,1fr) 46px 50px;gap:6px}" +
      ".lsb-keo .h4 .cp-o{grid-column:1/-1}.lsb-loai{gap:4px}.lsb-loai .bd-ls-loai{padding:4px 6px!important;font-size:11.5px!important}.lsb-keo .cuoi .hsk-nut{min-height:40px;padding:0 14px}" +
      ".lsb-sc{grid-template-columns:48px minmax(0,1fr) auto;grid-template-areas:'ng lo cp' 'ng nd nd';row-gap:4px;align-items:start;padding:10px 0}" +
      ".lsb-sc>.ng{grid-area:ng}.lsb-sc>.lo{grid-area:lo}.lsb-sc>.nd{grid-area:nd}.lsb-sc>.cp{grid-area:cp;color:var(--muted)}.lsb-sc.dau{display:none}}"
  ].join("");
  function napCss() { if (document.getElementById("lsbCss")) return; var s = document.createElement("style"); s.id = "lsbCss"; s.textContent = CSS; document.head.appendChild(s); }

  /* ---------- vẽ ---------- */
  function ve(p) {
    napCss(); P[p.khoa] = p; var o = st(p.khoa);
    if (!p.sc && o.che === "sc") o.che = "tat";
    return '<div class="lsb" data-lsb="' + esc(p.khoa) + '">' + than(p, o) + "</div>";
  }
  function luotTrong(p) { var tap = {}; p.ngay.forEach(function (d) { tap[d] = 1; }); return p.luot.filter(function (l) { return tap[l.ngay]; }); }
  function than(p, o) {
    var lt = luotTrong(p), nA = lt.filter(function (l) { return khop(o, l) && (!laAnh(o) || !o.loc.vt || anhVt(p, o, l).length); }).length, sc = p.sc || [], nS = sc.length;
    var seg = [["tat", "Tất cả", nA + nS], ["anh", "Ảnh", nA], ["sc", "Sửa chữa", nS]];
    var dang = dangLoc(o), laSc = o.che === "sc";
    var nut = laSc ? (p.coThem ? '<span class="bl-cum"><button type="button" class="btn-filter bl-moi lsb-them' + (o.keo === "them" ? " mo" : "") + '" data-lsb-keo="them" aria-expanded="' + (o.keo === "them") + '">+ Thêm</button></span>' : "")
      : '<span class="bl-cum' + (dang ? " dang" : "") + '"><button type="button" class="btn-filter bl-moi' + (o.keo === "loc" ? " mo" : "") + '" data-lsb-keo="loc" aria-expanded="' + (o.keo === "loc") + '">' +
        (dang ? "Đang lọc" : "Bộ lọc") + "</button>" + (dang ? '<button type="button" class="hsk-nut bl-xoa x-do" data-lsb-boloc aria-label="Bỏ lọc" title="Bỏ lọc">×</button>' : "") + "</span>";
    var h = '<div class="panel-head lsb-hd"><span class="lsb-seg" role="tablist" aria-label="Lịch sử">' + seg.map(function (s) {
      return '<button type="button" role="tab" class="hp-whtab' + (s[0] === o.che ? " active" : "") + '" data-lsb-che="' + s[0] + '" aria-selected="' + (s[0] === o.che) + '"' + (s[0] === "sc" && !p.sc ? " disabled" : "") + ">" + s[1] + " <b>" + s[2] + "</b></button>"; }).join("") + "</span>" + nut + "</div>";
    if (o.keo === "loc" && !laSc) h += keoLoc(p, o);
    if (o.keo === "them" && laSc && p.coThem) h += keoThem(p, o);
    return h + (laSc ? veSc(p, o) : lich(p, o, o.che === "tat"));
  }
  function lich(p, o, coSc) {
    if (!p.ngay.length) return '<div class="lsb-trong">Chưa có ngày nào trong 60 ngày</div>';
    var co = {}; p.ngay.forEach(function (d) { co[d] = 1; });
    var theoNgay = {}; luotTrong(p).forEach(function (l) { (theoNgay[l.ngay] = theoNgay[l.ngay] || []).push(l); });
    var scNgay = {}; if (coSc) (p.sc || []).forEach(function (r) { if (!scNgay[r.ngay]) scNgay[r.ngay] = r.id; });
    var thang = []; p.ngay.forEach(function (d) { var t = d.slice(0, 7); if (thang.indexOf(t) < 0) thang.push(t); });
    var cuoi = p.ngay[0];
    return thang.map(function (t) {
      var y = +t.slice(0, 4), m = +t.slice(5, 7), dau = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7, so = new Date(Date.UTC(y, m, 0)).getUTCDate();
      var h = '<div class="lsb-th">THÁNG ' + t.slice(5, 7) + "/" + t.slice(0, 4) + '</div><div class="lsb-lich">' + THU.map(function (x) { return '<span class="t">' + x + "</span>"; }).join("");
      for (var k = 0; k < dau; k++) h += '<span class="lsb-o rong"></span>';
      for (var n = 1; n <= so; n++) {
        var d = t + "-" + (n < 10 ? "0" : "") + n; if (d > cuoi) break;
        if (!co[d]) { h += '<span class="lsb-o rong"></span>'; continue; }
        var locVt = laAnh(o) && o.loc.vt, ds = theoNgay[d] || [], dk = ds.filter(function (l) { return khop(o, l) && (!locVt || anhVt(p, o, l).length); });
        var l0 = dk.filter(function (l) { return l.a && l.a.length; })[0], u0 = l0 ? l0.a[anhVt(p, o, l0)[0]] : "";
        var nAnh = dk.reduce(function (s, l) { return s + (locVt ? anhVt(p, o, l).length : l.t || (l.a || []).length); }, 0), sc = scNgay[d];
        var lop = l0 ? " co" : ds.length && !dk.length ? " mo" : sc ? " chi-sc" : "";
        var mo = ds.length && !dk.length && ds[0].a && ds[0].a.length ? p.img(ds[0].a[0]) : "";
        h += '<div class="lsb-o' + lop + '"' + (l0 ? ' role="button" tabindex="0" data-lsb-luot="' + esc(l0.id) + '" aria-label="Ảnh ngày ' + dm(d) + '"' : sc ? ' data-lsb-sc="' + esc(sc) + '"' : "") + ">" +
          (l0 ? p.img(u0) : mo) + '<span class="so">' + n + "</span>" + (l0 && nAnh > 1 ? '<span class="dem">' + nAnh + "</span>" : "") +
          (sc ? '<button type="button" class="cham" data-lsb-sc="' + esc(sc) + '" aria-label="Sửa chữa ngày ' + dm(d) + '"></button>' : "") + "</div>";
      }
      return h + "</div>";
    }).join("");
  }
  function veSc(p, o) {
    var ds = p.sc || [];
    if (!ds.length) return '<div class="lsb-trong">Chưa ghi hư hỏng · sửa chữa · nâng cấp · thay vật tư nào cho vị trí này</div>';
    return '<div class="lsb-scds"><div class="lsb-sc dau"><span>NGÀY</span><span>LOẠI</span><span>NỘI DUNG</span><span style="text-align:right">CHI PHÍ</span></div>' + ds.map(function (r) {
      var vt = [r.vatTu, r.sl ? r.sl + (r.dvt ? " " + r.dvt : "") : ""].filter(Boolean).join(" · "), phu = [vt, r.nguoiLam].filter(Boolean).join(" · ");
      return '<div class="lsb-sc' + (r.tam ? " tam" : "") + (o.cuon === r.id ? " den" : "") + '" data-lsb-scid="' + esc(r.id) + '"><b class="ng">' + dm(r.ngay) + '</b><span class="lo"><span class="bd-ls-loai ' + lopLoai(r.loai) + '">' + esc(r.loai) + "</span></span>" +
        '<span class="nd"><span title="' + esc(r.moTa) + '">' + esc(r.moTa) + "</span>" + (phu ? '<small title="' + esc(phu) + '">' + esc(phu) + "</small>" : "") + "</span>" +
        '<span class="cp">' + (tien(r.cp) || '<span style="color:var(--muted)">—</span>') + "</span></div>"; }).join("") + "</div>";
  }
  function keoLoc(p, o) {
    var ng = {}; luotTrong(p).forEach(function (l) { if (l.ten) ng[l.ten] = (ng[l.ten] || 0) + 1; });
    var ds = Object.keys(ng).sort(function (a, b) { return ng[b] - ng[a]; });
    var dau = '<div><span class="nh">Ngày</span><div class="date-filter lsb-ngay"></div></div>';
    if (laAnh(o)) {   // mục Ảnh: Vị trí (mã ô con có ảnh báo cáo) thay cho Ngày
      var vt = {}, th = []; luotTrong(p).forEach(function (l) { (l.a || []).forEach(function (u, k) { var m = maCon(p, l, k); if (!m) return; if (!vt[m]) { vt[m] = 0; th.push([k, m]); } vt[m]++; }); });
      th.sort(function (a, b) { return a[0] - b[0] || (a[1] < b[1] ? -1 : 1); });
      dau = '<div><span class="nh">Vị trí</span><select class="lsb-vt"><option value="">Tất cả vị trí</option>' + th.map(function (x) {
        return "<option" + (x[1] === o.loc.vt ? " selected" : "") + ' value="' + esc(x[1]) + '">' + esc(x[1].replace(/^F0-/, "")) + " (" + vt[x[1]] + " ảnh)</option>"; }).join("") + "</select></div>";
    }
    return '<div class="lsb-keo loc" role="dialog" aria-label="Bộ lọc lịch sử">' + dau +
      '<div><span class="nh">Người báo cáo</span><select class="lsb-ng"><option value="">Tất cả người báo cáo</option>' + ds.map(function (t) {
        return "<option" + (t === o.loc.ng ? " selected" : "") + ' value="' + esc(t) + '">' + esc(t) + " (" + ng[t] + ")</option>"; }).join("") + "</select></div></div>";
  }
  function keoThem(p, o) {
    var n = o.nhap, v = function (k) { return esc(n[k] || ""); };
    return '<div class="lsb-keo them" role="dialog" aria-label="Thêm sửa chữa"><div><span class="nh">Loại</span><div class="lsb-loai">' + LOAI.map(function (l) {
        return '<button type="button" class="bd-ls-loai ' + l[1] + (n.loai === l[0] ? " on" : "") + '" data-lsb-loai="' + l[0] + '" aria-pressed="' + (n.loai === l[0]) + '">' + l[0] + "</button>"; }).join("") + "</div></div>" +
      '<div class="h2"><div><span class="nh">Ngày</span><div class="date-filter lsb-ngay1"></div></div><div><span class="nh">Người thực hiện</span><input data-lsb-o="nguoiLam" maxlength="120" placeholder="Tên / đơn vị sửa" value="' + v("nguoiLam") + '"></div></div>' +
      '<div><span class="nh">Mô tả</span><textarea data-lsb-o="moTa" maxlength="500" rows="2" placeholder="Hỏng gì / sửa gì / nâng cấp gì">' + v("moTa") + "</textarea></div>" +
      '<div class="h4"><div><span class="nh">Vật tư thay</span><input data-lsb-o="vatTu" maxlength="200" placeholder="Tên vật tư (nếu có)" value="' + v("vatTu") + '"></div>' +
        '<div><span class="nh">Số lượng</span><input data-lsb-o="sl" inputmode="decimal" maxlength="12" value="' + v("sl") + '"></div>' +
        '<div><span class="nh">Đơn vị</span><input data-lsb-o="dvt" maxlength="20" placeholder="cái" value="' + v("dvt") + '"></div>' +
        '<div class="cp-o"><span class="nh">Chi phí (đ)</span><input data-lsb-o="cp" inputmode="numeric" maxlength="15" value="' + v("cp") + '"></div></div>' +
      '<div class="cuoi"><span class="bao" aria-live="polite"></span><button type="button" class="hsk-nut phu nho" data-lsb-huy>Huỷ</button><button type="button" class="hsk-nut chinh nho" data-lsb-luu>Lưu</button></div></div>';
  }

  /* gắn ô thư viện sau khi chèn (bộ lọc ngày chuẩn + ô chọn mở xuống); gọi lại mỗi lần vẽ */
  function sauChen(root) {
    var k = root.getAttribute("data-lsb"), p = P[k], o = st(k); if (!p) return;
    root.__lsbDa = root.firstElementChild;   // đánh dấu đã gắn — MutationObserver không gắn lần 2
    /* 10/11 tối user (clip 17.23.35) «ảnh bị giật khi chọn 1 mục»: mỗi lần đổi mục / lọc là vẽ lại ⇒ ô ảnh về ô chờ rồi tải lại.
       Ảnh nào đã hiện thì gắn lại NGAY nguồn đã tải (bộ nhớ trình duyệt, 0 lượt mạng), bỏ khỏi hàng tải lười */
    [].forEach.call(root.querySelectorAll(".lsb-o img"), function (im) { var u = DA_TAI[im.getAttribute("data-goc") || im.getAttribute("src")];
      if (!u || im.getAttribute("src") === u) return; im.classList.remove("hp-lz"); im.removeAttribute("data-src"); im.src = u; });
    /* «ô nhập ở + Thêm bị che mất»: danh sách dưới trống thì ngăn kéo nổi thò ra ngoài khung, cuộn là chui dưới thanh tab dính đầu ⇒
       khung giữ đủ cao bằng ngăn kéo đang mở (chỉ kéo dài đáy, nội dung không xê dịch) */
    var keo = root.querySelector(".lsb-keo"); root.style.minHeight = keo ? (keo.offsetTop + keo.offsetHeight + 12) + "px" : "";
    var r = root.querySelector(".lsb-ngay");
    if (r && typeof window.taoBoLocNgay === "function") {
      var dsN = p.ngay, it = dsN[dsN.length - 1], nhieu = dsN[0];
      var bl = window.taoBoLocNgay({ root: r, presets: [{ k: "7", lb: "7 ngày" }, { k: "30", lb: "30 ngày" }, { k: "all", lb: "Tất cả" }],
        homNay: function () { return nhieu; }, chanNgay: function (iso) { return iso < it || iso > nhieu; },
        tinhPreset: function (x) { return x === "all" ? ["", ""] : null; },
        onApply: function (a, b) { o.loc.tu = a || ""; o.loc.den = b || ""; veLai(k); } });
      if (o.loc.tu || o.loc.den) bl.dat(o.loc.tu, o.loc.den);
    }
    var s = root.querySelector(".lsb-ng");
    if (s) { if (typeof window.enhanceSelect === "function") try { window.enhanceSelect(s); } catch (e) {}
      s.addEventListener("change", function () { o.loc.ng = s.value; veLai(k); }); }
    var sv = root.querySelector(".lsb-vt");
    if (sv) { if (typeof window.enhanceSelect === "function") try { window.enhanceSelect(sv); } catch (e) {}
      sv.addEventListener("change", function () { o.loc.vt = sv.value; veLai(k); }); }
    var r1 = root.querySelector(".lsb-ngay1");
    if (r1 && typeof window.taoBoLocNgay === "function") {
      var hn = isoVN(Date.now()); if (!o.nhap.ngay) o.nhap.ngay = hn;
      var b1 = window.taoBoLocNgay({ root: r1, motNgay: true, khongRong: true, presets: [{ k: "today", lb: "Hôm nay" }, { k: "yesterday", lb: "Hôm qua" }],
        homNay: function () { return hn; }, macDinh: function () { return [hn, hn]; }, chanNgay: function (iso) { return iso > hn; },
        onApply: function (a) { o.nhap.ngay = a || hn; } });
      b1.dat(o.nhap.ngay, o.nhap.ngay);
    }
    if (o.cuon) { var d = root.querySelector('[data-lsb-scid="' + (window.CSS && CSS.escape ? CSS.escape(o.cuon) : o.cuon) + '"]'); if (d) d.scrollIntoView({ block: "center" }); o.cuon = ""; }
    if (p.sauVe) try { p.sauVe(root); } catch (e) {}
  }
  function veLai(k) {
    var root = document.querySelector('.lsb[data-lsb="' + (window.CSS && CSS.escape ? CSS.escape(k) : k) + '"]'), p = P[k]; if (!root || !p) return;
    root.innerHTML = than(p, st(k)); sauChen(root);
  }
  /* host chèn HTML xong thì gọi (hoặc để MutationObserver tự bắt) */
  function gan(scope) { [].forEach.call((scope || document).querySelectorAll(".lsb[data-lsb]"), function (r) { if (r.__lsbDa && r.__lsbDa === r.firstElementChild) return; sauChen(r); }); }

  /* ảnh ô lịch đã hiện xong: nhớ nguồn thật (ảnh thu nhỏ blob / CDN) theo khoá ảnh gốc ⇒ vẽ lại dùng ngay */
  var DA_TAI = {};
  document.addEventListener("load", function (e) { var im = e.target; if (!im || im.tagName !== "IMG" || !im.closest || !im.closest(".lsb-o") || im.classList.contains("hp-lz") || im.naturalWidth < 3) return;
    DA_TAI[im.getAttribute("data-goc") || im.getAttribute("src")] = im.currentSrc || im.src; }, true);
  /* ---------- sự kiện uỷ quyền ---------- */
  function dongKeo(k) { var o = st(k); if (!o.keo) return; o.keo = ""; veLai(k); }
  document.addEventListener("click", function (e) {
    var root = e.target.closest && e.target.closest(".lsb[data-lsb]");
    /* bấm ngoài ngăn kéo ⇒ đóng (không đụng ô lịch ngày / danh sách thả xuống của thư viện đang nổi ngoài khung) */
    Object.keys(ST).forEach(function (k) { if (!ST[k].keo) return; var r = document.querySelector('.lsb[data-lsb="' + (window.CSS && CSS.escape ? CSS.escape(k) : k) + '"]');
      if (!r) { ST[k].keo = ""; return; }
      if (e.target.closest(".lsb-keo,[data-lsb-keo],.date-pop,.cs-list") || !document.body.contains(e.target)) return;
      if (r.contains(e.target) || !root) dongKeo(k); });
    if (!root) return;
    var k = root.getAttribute("data-lsb"), o = st(k), p = P[k], t;
    if ((t = e.target.closest("[data-lsb-che]"))) { if (t.disabled) return; o.che = t.getAttribute("data-lsb-che"); o.keo = ""; veLai(k); return; }
    if ((t = e.target.closest("[data-lsb-keo]"))) { var loai = t.getAttribute("data-lsb-keo"); o.keo = o.keo === loai ? "" : loai; veLai(k); return; }
    if (e.target.closest("[data-lsb-boloc]")) { o.loc = { tu: "", den: "", ng: "", vt: "" }; o.keo = ""; veLai(k); return; }
    if ((t = e.target.closest("[data-lsb-loai]"))) { o.nhap.loai = t.getAttribute("data-lsb-loai");
      [].forEach.call(root.querySelectorAll("[data-lsb-loai]"), function (b) { var on = b === t; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); }); return; }
    if (e.target.closest("[data-lsb-huy]")) { o.nhap = { loai: "Sửa chữa" }; o.keo = ""; veLai(k); return; }
    if (e.target.closest("[data-lsb-luu]")) { luu(k, root); return; }
    if ((t = e.target.closest("[data-lsb-sc]"))) { e.stopPropagation(); o.che = "sc"; o.keo = ""; o.cuon = t.getAttribute("data-lsb-sc"); veLai(k); return; }
    if ((t = e.target.closest("[data-lsb-luot]"))) { if (p && p.moAnh) p.moAnh(t.getAttribute("data-lsb-luot"), laAnh(o) ? o.loc.vt : ""); return; }
  }, true);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { var mo = Object.keys(ST).filter(function (k) { return ST[k].keo; });
      if (mo.length && !document.querySelector(".date-pop.show,.cs.open")) { e.preventDefault(); e.stopImmediatePropagation(); mo.forEach(dongKeo); } return; }
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches(".lsb-o[data-lsb-luot]")) { e.preventDefault(); e.target.click(); }
  }, true);
  document.addEventListener("input", function (e) { var f = e.target.closest && e.target.closest("[data-lsb-o]"); if (!f) return;
    var root = f.closest(".lsb[data-lsb]"); if (root) st(root.getAttribute("data-lsb")).nhap[f.getAttribute("data-lsb-o")] = f.value; });

  /* lưu lạc quan: dòng tạm hiện ngay đầu danh sách, máy chủ trả lỗi thì gỡ + báo */
  function luu(k, root) {
    var o = st(k), p = P[k], n = o.nhap, bao = root.querySelector(".lsb-keo .bao");
    if (!String(n.moTa || "").trim()) { if (bao) bao.textContent = "Nhập mô tả trước khi lưu"; var m = root.querySelector('[data-lsb-o="moTa"]'); if (m) m.focus(); return; }
    var goi = { loai: n.loai || "Sửa chữa", ngay: n.ngay || isoVN(Date.now()), moTa: String(n.moTa).trim(), vatTu: n.vatTu || "", sl: n.sl || "", dvt: n.dvt || "", chiPhi: n.cp || "", nguoiLam: n.nguoiLam || "" };
    var tam = { id: "tam-" + Date.now(), ngay: goi.ngay, loai: goi.loai, moTa: goi.moTa, vatTu: goi.vatTu, sl: goi.sl, dvt: goi.dvt, cp: goi.chiPhi, nguoiLam: goi.nguoiLam, tam: 1 };
    p.sc = [tam].concat(p.sc || []); o.nhap = { loai: "Sửa chữa" }; o.keo = ""; veLai(k);
    Promise.resolve().then(function () { return p.them(goi); }).then(function () {
      if (TI.toast) TI.toast("Đã lưu " + goi.loai.toLowerCase(), "ok");
    }, function (er) {
      var q = P[k]; if (q) q.sc = (q.sc || []).filter(function (r) { return r.id !== tam.id; });
      o.nhap = { loai: goi.loai, ngay: goi.ngay, moTa: goi.moTa, vatTu: goi.vatTu, sl: goi.sl, dvt: goi.dvt, cp: goi.chiPhi, nguoiLam: goi.nguoiLam }; o.keo = "them"; veLai(k);
      if (TI.toast) TI.toast("Chưa lưu được: " + ((er && er.message) || "lỗi máy chủ"), "loi");
    });
  }

  /* ---------- pop-up ảnh kiểu B ----------
     moAnh(o): mở từ Lịch sử — dải = mỗi LƯỢT 1 ô (ảnh đầu + số ảnh, NGÀY dưới ô), trái = gần nhất; hết ảnh 1 lượt sang lượt cũ hơn.
     moNgay(o): mở từ chip ngày — dải = mọi ảnh của đúng ngày (mọi lượt), không chữ dưới ô.
     o = { ten, ma, luot:[{id, ngay, gio, ten, email, a:[url], urlLui?:fn, thumb?:fn, con?:fn(i,n)}], id, i, veAnh(url) → html, sauVe() } */
  function anhMuc(o, l, k) {
    var n = l.a.length, u = l.a[k], c = l.khung ? l.khung[k] || "" : o.con ? o.con(k, n) : "", laO = c && typeof c === "object";   // con → chuỗi tên khung hoặc {ten, ma} (ô con có mã riêng)
    return { type: "img", url: (o.goc && o.goc(u)) || u, urlLui: o.lui ? o.lui(u) : "", thumb: o.nho ? o.nho(u) : "", ten: o.ten || "", ma: laO ? c.ma : o.ma,
      tieu: laO ? c.ten : c, nguoi: l.ten ? String(l.ten).trim().split(/\s+/).slice(-2).join(" ") : "", tenDu: l.ten || "", email: l.email || "",
      luc: dm(l.ngay) + (l.gio ? " lúc " + l.gio : ""), dem: n > 1 ? (k + 1) + "/" + n : "" };
  }
  function moAnh(o) {
    if (typeof window.openLB !== "function") return;
    /* o.vt = mã vị trí đang lọc ở mục Ảnh ⇒ ảnh lớn + dải ngày chỉ gồm ảnh của đúng mã đó */
    var giu = function (l) { var ks = l.a.map(function (u, k) { return k; }); return o.vt ? ks.filter(function (k) { return maCon(o, l, k) === o.vt; }) : ks; };
    var ds = (o.luot || []).filter(function (l) { return l.a && l.a.length && giu(l).length; }), list = [], dai = [], bd = 0;
    ds.forEach(function (l, j) { var ks = giu(l), dau = list.length; dai.push({ u: l.a[ks[0]], so: o.vt ? ks.length : l.t || l.a.length, ngay: dm(l.ngay), dau: dau });
      if (l.id === o.id) bd = dau + Math.min(o.i || 0, ks.length - 1);
      ks.forEach(function (k, x) { var m = anhMuc(o, l, k); if (o.vt) m.dem = ks.length > 1 ? (x + 1) + "/" + ks.length : ""; m.dai = j; list.push(m); }); });
    if (!list.length) return;
    window.openLB(list, bd, { kieu: "B", dai: dai, veAnh: o.veAnh, sauVe: o.sauVe });
  }
  function moNgay(o) {
    if (typeof window.openLB !== "function") return;
    var list = [], dai = [], bd = 0;
    (o.luot || []).forEach(function (l) { (l.a || []).forEach(function (u, k) { if (l.id === o.id && k === (o.i || 0)) bd = list.length;
      var m = anhMuc(o, l, k); m.dai = list.length; dai.push({ u: u, dau: list.length }); list.push(m); }); });
    if (!list.length) return;
    window.openLB(list, bd, { kieu: "B", dai: dai, ngay: 1, veAnh: o.veAnh, sauVe: o.sauVe });
  }

  window.hskLichSu = { ve: ve, gan: gan, veLai: veLai, moAnh: moAnh, moNgay: moNgay, trangThai: function (k) { return st(k); } };
  /* host chỉ cần chèn HTML: MutationObserver tự gắn ô thư viện cho khung mới */
  var hen = 0; new MutationObserver(function () { if (hen) return; hen = requestAnimationFrame(function () { hen = 0; if (document.querySelector(".lsb[data-lsb]")) gan(document); }); })
    .observe(document.documentElement, { childList: true, subtree: true });
})();
