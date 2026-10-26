/* loc-popup.js — khối lọc trong pop-up gập sau nút «Bộ lọc» trên ĐIỆN THOẠI · 26/10/2026
 * User 26/10: «tất cả pop-up đều có 1 bộ lọc chiếm 50% màn hình điện thoại → biến thành nút bộ lọc theo luật/thiết kế/thư viện đã có».
 * Đo 375×771: khối lọc Planogram 32% · Tồn kho chính xác 21% · Tồn bất thường 23% màn (+ đầu pop-up ⇒ còn ~1/2 cho dữ liệu).
 * Cùng MẪU nút ở cấp trang (index.html .panel-head .btn-filter): hàng đầu = số dòng (msum) | nút «Bộ lọc» bên phải (28 px, mũi tên xoay),
 * bấm thì khối lọc trượt xuống (popIn); có điều kiện ⇒ «Bộ lọc · đang lọc» + màu nhấn; ✕ Tắt lọc do tat-loc.js tự gắn (khung .xx-modalbox).
 * Áp CHUNG cho mọi khối .hp-mfilters / .hk-mfilters / .ht-mfilters (pop-up module mới cùng khuôn tự có). Máy tính: không đổi gì (hàng = display:contents).
 * Không sửa từng module: khối lọc vẫn do module vẽ lại (innerHTML) — nút nằm ngoài khối nên không mất. */
(function () {
  if (window.__LOC_POPUP) return; window.__LOC_POPUP = 1;
  var KHOI = ".hp-mfilters,.hk-mfilters,.ht-mfilters", TOM = /(^|\s)(hp|hk|ht)-msum(\s|$)/;
  function dangLoc(k) {
    return [].some.call(k.querySelectorAll("select, input:not([type=checkbox]):not([type=radio])"), function (x) {
      return x.tagName === "SELECT" ? (x.options.length > 0 && x.value !== x.options[0].value) : !!String(x.value || "").trim(); });
  }
  function datChu(b, t) {   // chỉ thay nút chữ — giữ ✕ (.tat-loc) là con của nút
    var n = [].find.call(b.childNodes, function (x) { return x.nodeType === 3; });
    if (n) { if (n.nodeValue !== t) n.nodeValue = t; } else b.insertBefore(document.createTextNode(t), b.firstChild);
  }
  function capNhat(k) {
    var b = k.__locPop; if (!b) return;
    var c = dangLoc(k); b.classList.toggle("dang-loc", c); datChu(b, c ? "Bộ lọc · đang lọc" : "Bộ lọc");
  }
  function gan(k) {
    if (k.__locPop) return capNhat(k);
    var tom = k.nextElementSibling; if (!tom || !TOM.test(tom.className)) return;
    var hang = document.createElement("div"); hang.className = "loc-pop-hang";
    k.parentNode.insertBefore(hang, tom); hang.appendChild(tom);   // đúng chỗ cũ của msum ⇒ máy tính (display:contents) không xê dịch
    var b = document.createElement("button"); b.type = "button"; b.className = "btn-filter loc-pop-nut"; b.setAttribute("aria-expanded", "false");
    b.appendChild(document.createTextNode("Bộ lọc"));
    b.addEventListener("click", function (ev) { if (ev.target.closest(".tat-loc")) return;
      var mo = k.classList.toggle("loc-pop-mo"); b.classList.toggle("mo", mo); b.setAttribute("aria-expanded", String(mo)); });
    hang.appendChild(b);
    k.parentNode.classList.add("loc-pop-box"); k.__locPop = b;
    capNhat(k);
  }
  function quet() { [].forEach.call(document.querySelectorAll(KHOI), gan); }
  var hT = 0; function hen() { clearTimeout(hT); hT = setTimeout(quet, 80); }
  var st = document.createElement("style");
  st.textContent = ".loc-pop-hang{display:contents}.loc-pop-nut{display:none}" +
    "@media (max-width:768px){" +
    ".loc-pop-box>.loc-pop-hang{display:flex;align-items:center;gap:8px;order:1;padding-right:12px;border-bottom:1px solid var(--border,#e8ecf1)}" +
    ".loc-pop-hang>.hp-msum,.loc-pop-hang>.hk-msum,.loc-pop-hang>.ht-msum{flex:1 1 auto;min-width:0;border-bottom:0!important}" +
    ".loc-pop-box>.hp-mfilters,.loc-pop-box>.hk-mfilters,.loc-pop-box>.ht-mfilters{order:2}" +
    ".loc-pop-box>.loc-pop-hang~*{order:3}" +
    ".loc-pop-box>.hp-mfilters:not(.loc-pop-mo),.loc-pop-box>.hk-mfilters:not(.loc-pop-mo),.loc-pop-box>.ht-mfilters:not(.loc-pop-mo){display:none!important}" +
    ".loc-pop-box>.loc-pop-mo{transform-origin:top center;animation:popIn .22s var(--ez-spring,cubic-bezier(.16,1,.3,1))}" +
    /* mẫu nút trang (.panel-head .btn-filter) */
    /* !important: CSS điện thoại của module ép nút trong pop-up giãn hết hàng (đo ảnh 26/10: chữ tóm tắt bị bóp thành 1 cột dọc) */
    ".loc-pop-box .loc-pop-nut{position:relative;display:inline-flex!important;align-items:center;justify-content:center;gap:6px;flex:0 0 auto!important;width:auto!important;max-width:none!important;" +
    "margin:0!important;padding:0 10px!important;height:28px!important;min-height:28px!important;font-size:12px!important;font-weight:500;line-height:1!important;border-radius:6px!important;" +
    "border:1px solid var(--border);background:var(--surface);color:var(--text);white-space:nowrap;cursor:pointer}" +
    ".loc-pop-nut::after{content:'';display:inline-block;width:5.5px;height:5.5px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;" +
    "transform:translateY(-1.5px) rotate(45deg);transition:transform .22s var(--ez-apple,ease);flex:0 0 auto}" +
    ".loc-pop-nut.mo::after{transform:translateY(1.5px) rotate(-135deg)}" +
    ".loc-pop-nut:hover,.loc-pop-nut.mo,.loc-pop-nut.dang-loc{border-color:var(--accent);color:var(--accent);background:color-mix(in srgb,var(--accent) 8%,var(--surface))}" +
    ".loc-pop-nut::before{content:'';position:absolute;left:-2px;right:-2px;top:-6px;bottom:-6px}}";
  (document.head || document.documentElement).appendChild(st);
  /* pop-up module dựng muộn (tải module khi mở mục) + khối lọc vẽ lại mỗi lần mở + ô chọn đặt giá trị bằng mã (không bắn input) */
  new MutationObserver(function (ms) { if (ms.some(function (m) { return !(m.target.closest && m.target.closest(".loc-pop-nut")); })) hen(); })
    .observe(document.documentElement, { subtree: true, childList: true });
  ["input", "change", "click", "keyup"].forEach(function (e) { document.addEventListener(e, hen, true); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", quet); else quet();
})();
