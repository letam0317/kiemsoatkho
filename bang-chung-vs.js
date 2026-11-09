/* bang-chung-vs.js — KHUÔN ẢNH BẢNG BẰNG CHỨNG VỆ SINH dùng CHUNG máy (node) ⇄ trang (trình duyệt) — tách 09/11/2026 từ bang-chung-vesinh.mjs.
 * User 09/11 (nút cờ 5S ở Planogram, đủ 3/3): «mục này đã có ảnh mẫu sao không làm ảnh mẫu mà ghi chú?» ⇒ trang vẽ ĐÚNG khuôn ảnh cò luỹ tiến (mẫu chốt 04/11),
 * không chép đôi mã: node `import "./kiemsoatkho/bang-chung-vs.js"` (bang-chung-vesinh.mjs re-export), trang nạp <script> rồi dùng window.hskBangChung.
 * Không import/export (chạy được cả 2 phía) · chỉ màu HEX (html2canvas không hiểu color()). */
(function (g) {
  if (g.hskBangChung) return;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
/** Bàn A8 viết gọn: bỏ đuôi «-01-01» (F0-A8-506-01-01-01 → F0-A8-506-01) — giữ số bàn để 2 camera cùng dãy không trùng. */
const banGon = (b) => String(b || "").replace(/(-\d{2})-01-01$/, "$1");
/** Tên gọn = 2 chữ cuối (Nguyễn Thị Kim Yến → Kim Yến). */
const tenGon = (t) => String(t || "").trim().split(/\s+/).slice(-2).join(" ");
function cauNguoi(h, vt = []) {
  const ten = "<b>" + esc(tenGon(h.ten)) + (h.ma ? " (" + esc(h.ma) + ")" : "") + "</b>";
  if (!h.lam) return ten + " " + (h.nghi ? "nghỉ" : esc(h.ro || "không rõ chấm công"));
  /* 04/11 user: dòng 1 «Kim Yến (260394) có đi làm» · dòng 2 «07:51–17:01 · 86 phiếu» · đúng vị trí phân công thì thôi,
     đóng gói ở bàn KHÁC vị trí phân công thì thêm dòng «tại vị trí A8-xxx» */
  const gio = h.cc && (h.cc.vao || h.cc.ra) ? esc(h.cc.vao || "?") + "–" + esc(h.cc.ra || "chưa ra") : "";
  /* 04/11 user: «tại A8-xxx» ghi liền, không xuống dòng · A8 có ≥2 vị trí phân công ⇒ luôn ghi bàn làm thực tế (camera),
     không đóng gói ở A8 hôm đó (camera có dữ liệu) ⇒ «không đóng gói» */
  const kh = (k) => banGon(k).replace(/^F0-/, ""), nA8 = vt.filter((v) => /^F0-A8-/.test(v)).length;
  const ghiBan = h.ban && (nA8 >= 2 || !vt.some((v) => kh(v) === kh(h.ban)));
  const d2 = [gio, h.so ? h.so + " phiếu" + (ghiBan ? " tại " + esc(kh(h.ban)) : "") : (ghiBan ? "tại " + esc(kh(h.ban)) : h.khongDong && nA8 >= 2 ? "không đóng gói" : "")].filter(Boolean).join(" · ");
  return ten + " có đi làm" + (d2 ? '<div class="phieu">' + d2 + "</div>" : "");
}
/* 04/11 user: ≥2 vị trí LIỀN NHAU cùng 1 người khác báo cáo ⇒ gom bằng ngoặc «}» + «Trọng Phát / báo cáo» (2 dòng) */
const dongBc = (x) => '<div class="bcd">' + (x.ma ? '<span class="ma">' + esc(x.ma) + "</span>" : esc(x.t || "")) + (x.ok === true ? ' <span class="ok">✓</span>' : x.ok === false ? ' <span class="x">✗</span>' : "");
const oBc = (r) => { if (!r.bc) return oBcCu(r); const ra = [];
  for (let i = 0; i < r.bc.length;) { let j = i; while (r.bc[i].ghi && j + 1 < r.bc.length && r.bc[j + 1].ghi === r.bc[i].ghi && r.bc[j + 1].ok === r.bc[i].ok) j++;
    if (j > i) { const w = r.bc[i].ghi.split(" "), n = j - i + 1;
      ra.push('<div class="gom"><div>' + r.bc.slice(i, j + 1).map((x) => dongBc(x) + "</div>").join("") + '</div><span class="ngoac"></span><div class="bcg">' + esc(w.slice(0, -2).join(" ")) + "<br>" + esc(w.slice(-2).join(" ")) + "</div></div>"); }
    else ra.push(dongBc(r.bc[i]) + (r.bc[i].ghi ? ' <span class="bcg">' + esc(r.bc[i].ghi) + "</span>" : "") + "</div>");
    i = j + 1; }
  return ra.join(""); };
const oBcCu = (r) => r.bc ? r.bc.map((x) => '<div class="bcd">' + (x.ma ? '<span class="ma">' + esc(x.ma) + "</span>" : esc(x.t || "")) + (x.ok === true ? ' <span class="ok">✓</span>' : x.ok === false ? ' <span class="x">✗</span>' : "") + (x.ghi ? ' <span class="bcg">' + esc(x.ghi) + "</span>" : "") + "</div>").join("")
  : '<span class="kq ' + ({ khong: "khong", mien: "mien", nghi: "nghi" }[r.kq] || "khong") + '">' + esc(r.kqChu) + "</span>";

function htmlBangChung(b) {
  const khoi = b.khoi.map((k) => {
    const coGn = k.dong.some((r) => r.gn != null);
    const dong = k.dong.map((r, i) => {
      const nguoi = r.nguoi.length ? r.nguoi.map((h) => `<div><span class="dot ${h.lam ? "lam" : "nghi"}"></span>${cauNguoi(h, k.vt)}</div>`).join("") : `<div><span class="dot nghi"></span>Không có phụ trách</div>`;
      const mo = r.gn == null ? "" : /^Lần/.test(r.gn) ? "" : r.nguoi.every((h) => !h.lam) ? "mo2" : "mo1";
      return `<tr class="${mo}">${i ? "" : `<td class="vt" rowspan="${k.dong.length}"><b>${k.vt.map(esc).join("<br>")}</b>${k.n ? `<span class="chuoi">${k.n} ngày yêu cầu liên tiếp</span>` : ""}${k.nhan ? `<span class="nhan">${esc(k.nhan)}</span>` : ""}</td>`}` +
        `<td class="ng">${esc(r.d)}</td><td>${nguoi}</td><td>${oBc(r)}</td>${coGn ? `<td class="gn ${/^Lần/.test(r.gn) ? "tinh" : ""}">${esc(r.gn || "")}</td>` : ""}</tr>`;
    }).join("");
    return `<table><thead><tr>${b.khit ? "<th>Vị trí phụ trách</th><th>Ngày</th><th>Phụ trách/Làm việc thực tế</th><th>Báo cáo vệ sinh</th>" + (coGn ? "<th>Ghi nhận</th>" : "") : `<th style="width:20%">Vị trí</th><th style="width:9%">Ngày</th><th style="width:${coGn ? 37 : 45}%">Phụ trách/Làm việc thực tế</th><th>Báo cáo vệ sinh</th>${coGn ? '<th style="width:11%">Ghi nhận</th>' : ""}`}</tr></thead><tbody>${dong}</tbody></table>`;
  }).join("");
  return `<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;padding:14px;font-family:"Segoe UI",Arial,sans-serif;color:#1f2329;font-size:13px;background:#fff;width:900px}
.khung{border:1px solid #e5e6eb;border-radius:8px;overflow:hidden}.dau{padding:14px 18px 12px;border-bottom:3px solid #cf1322}
h1{font-size:17px;margin:0 0 3px}.mo{color:#646a73;font-size:11.5px}
table{width:100%;border-collapse:collapse}table+table{border-top:6px solid #f5f5f5}
th{background:#fff1f0;color:#a8071a;font-weight:600;font-size:12px;padding:8px 10px;text-align:left;border-bottom:1px solid #ffccc7}
td{padding:9px 10px;border-bottom:1px solid #f0f0f0;vertical-align:middle;line-height:1.45}tbody tr:last-child td{border-bottom:0}
td.vt{background:#fafafa;border-right:1px solid #f0f0f0;vertical-align:top;font-family:Consolas,monospace;font-size:12.5px;line-height:1.55}
.chuoi{display:block;font-family:"Segoe UI",Arial;font-size:11.5px;color:#646a73;margin-top:6px}
.nhan{display:inline-block;margin-top:5px;font-family:"Segoe UI",Arial;font-size:11px;font-weight:600;color:#cf1322;background:#fff1f0;border:1px solid #ffa39e;border-radius:10px;padding:1px 8px}
td.ng{font-weight:600;white-space:nowrap}
.kq{font-weight:600;border-radius:3px;padding:2px 7px;font-size:12px;display:inline-block;white-space:pre-line}.kq.khong{color:#cf1322;background:#fff1f0}.kq.mien{color:#389e0d;background:#f6ffed}.kq.nghi{color:#8c8c8c;background:#f5f5f5}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px;vertical-align:1px}.dot.nghi{background:#bfbfbf}.dot.lam{background:#fa8c16}
.ghi{padding:10px 18px;background:#fffbe6;border-bottom:1px solid #ffe58f;font-size:12.5px;line-height:1.55}.ghi>div{display:grid;grid-template-columns:150px 1fr;column-gap:10px}.ghi>div+div{margin-top:3px}.ghi b{color:#874d00}
${b.khit ? "body{width:auto}.khung{display:inline-block}table{width:auto}th,td{white-space:nowrap;padding-right:16px}td.vt{white-space:normal}td.vt .nhan{display:block;width:fit-content}" : ""}
.trong{padding:14px 18px;color:#646a73;font-style:italic}
.phieu{color:#646a73;font-size:12px;margin-left:15px}.bcd{font-weight:600;font-size:12.5px;white-space:nowrap}.ma{font-family:Consolas,monospace}.bcd+.bcd{margin-top:2px}
.gom{display:flex;align-items:center;gap:6px}.gom+.bcd,.bcd+.gom{margin-top:2px}.gom{align-items:stretch}.ngoac{width:9px;margin:3px 2px 3px 0;border:1.5px solid #bfbfbf;border-left:0;border-radius:0 9px 9px 0;position:relative}.ngoac::after{content:"";position:absolute;right:-6px;top:50%;width:5px;border-top:1.5px solid #bfbfbf}.gom .bcg{align-self:center;margin-left:4px}.gom .bcg{line-height:1.3}
.ok{color:#389e0d;font-family:"Segoe UI",Arial}.x{color:#cf1322;font-family:"Segoe UI",Arial}.bcg{font-family:"Segoe UI",Arial;font-weight:400;color:#646a73;font-size:12px}
tr.mo1>td:not(.vt){opacity:.5}tr.mo2>td:not(.vt){opacity:.28}td.gn{font-weight:600;color:#389e0d;white-space:nowrap}td.gn.tinh{color:#cf1322}
</style><div class="khung"><div class="dau"><h1>${esc(b.tieu)}</h1>${b.phu ? `<div class="mo">${esc(b.phu)}</div>` : ""}</div>${(b.ghi || []).length ? `<div class="ghi">${b.ghi.map((g) => `<div><b>${esc(g[0])}</b>${esc(g[1])}</div>`).join("")}</div>` : ""}${khoi}${!b.khoi.length && b.trong ? `<div class="trong">${esc(b.trong)}</div>` : ""}</div>`;
}
  g.hskBangChung = { html: htmlBangChung, cauNguoi: cauNguoi, banGon: banGon, tenGon: tenGon, esc: esc };
})(typeof window !== "undefined" ? window : globalThis);
