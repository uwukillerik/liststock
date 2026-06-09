import type { AnalyticsSummary, Product, StockMovement } from "@shared/api";

export const APP_REPORT_TITLE = "ListStock";
export const REPORT_BRAND = "#0d7377";
export const REPORT_ACCENT = "#e07b24";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const REPORT_STYLES = `
  @page { margin: 10mm 12mm; size: A4 landscape; }
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", "DM Sans", system-ui, sans-serif;
    color: #0f172a;
    padding: 0;
    margin: 0;
    font-size: 10px;
    line-height: 1.4;
  }
  .page { padding: 16px 20px; max-width: 100%; }
  .header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 18px;
    padding-bottom: 14px;
    border-bottom: 3px solid ${REPORT_BRAND};
  }
  .brand { display: flex; align-items: center; gap: 12px; }
  .logo {
    width: 44px; height: 44px; border-radius: 10px;
    background: linear-gradient(135deg, ${REPORT_BRAND}, #14a3a8);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 22px;
  }
  h1 { font-size: 20px; margin: 0 0 2px; font-weight: 700; letter-spacing: -0.02em; }
  .subtitle { color: #64748b; font-size: 11px; margin: 0; }
  .meta-box {
    text-align: right; font-size: 10px; color: #64748b;
    background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;
    padding: 8px 12px; min-width: 160px;
  }
  .meta-box strong { display: block; color: #0f172a; font-size: 12px; margin-bottom: 2px; }
  .kpis { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
  .kpi {
    flex: 1; min-width: 120px; border-radius: 10px; padding: 10px 14px;
    border: 1px solid #e2e8f0; background: linear-gradient(180deg, #fff, #f8fafc);
  }
  .kpi-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }
  .kpi-value { font-size: 18px; font-weight: 700; color: ${REPORT_BRAND}; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: left; vertical-align: middle; }
  th {
    background: linear-gradient(180deg, ${REPORT_BRAND}, #0a5c5f);
    color: #fff; font-weight: 600; font-size: 9px;
    text-transform: uppercase; letter-spacing: 0.04em;
  }
  tr:nth-child(even) td { background: #f8fafc; }
  tr:hover td { background: #f1f5f9; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .mono { font-family: ui-monospace, monospace; font-size: 9px; }
  .low { color: #dc2626; font-weight: 600; }
  .warn { color: #d97706; font-weight: 600; }
  .ok { color: #059669; }
  .zone-tag {
    display: inline-block; background: #ecfeff; color: #0e7490;
    border-radius: 4px; padding: 1px 5px; font-size: 9px;
  }
  .cell-tag {
    display: inline-block; background: #fff7ed; color: #c2410c;
    border-radius: 4px; padding: 1px 5px; font-size: 9px; margin-left: 4px;
  }
  h2 { font-size: 13px; margin: 16px 0 8px; color: ${REPORT_BRAND}; font-weight: 700; }
  .footer {
    margin-top: 20px; padding-top: 10px; border-top: 1px solid #e2e8f0;
    font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between;
  }
  .no-print { }
  @media print {
    .no-print { display: none !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  .print-btn {
    padding: 10px 18px; font-size: 13px; cursor: pointer; border-radius: 8px;
    border: none; background: ${REPORT_BRAND}; color: #fff; font-weight: 600;
    margin-top: 16px;
  }
`;

function reportShell(title: string, subtitle: string, body: string, kpis?: string): void {
  const when = new Date().toLocaleString("ru-RU");
  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8"/>
  <title>${esc(title)} — ${APP_REPORT_TITLE}</title>
  <style>${REPORT_STYLES}</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="brand">
        <div class="logo">🍷</div>
        <div>
          <h1>${esc(title)}</h1>
          <p class="subtitle">${esc(subtitle)}</p>
        </div>
      </div>
      <div class="meta-box">
        <strong>${APP_REPORT_TITLE}</strong>
        ${esc(when)}
      </div>
    </div>
    ${kpis ?? ""}
    ${body}
    <div class="footer">
      <span>Сформировано автоматически · ${APP_REPORT_TITLE}</span>
      <span>Стр. 1</span>
    </div>
    <p class="no-print">
      <button type="button" class="print-btn" onclick="window.print()">Печать / Сохранить PDF</button>
    </p>
  </div>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (!w) throw new Error("Разрешите всплывающие окна для отчёта");
  w.document.write(html);
  w.document.close();
}

function qtyClass(qty: number): string {
  if (qty < 10) return "low";
  if (qty < 36) return "warn";
  return "ok";
}

/** Печать / «Сохранить как PDF» — кириллица через системный диалог. */
export function openInventoryPrintReport(products: Product[]): void {
  const totalQty = products.reduce((s, p) => s + p.quantity, 0);
  const lowCount = products.filter((p) => p.quantity < 36).length;

  const kpis = `<div class="kpis">
    <div class="kpi"><div class="kpi-label">Позиций</div><div class="kpi-value">${products.length}</div></div>
    <div class="kpi"><div class="kpi-label">Единиц на складе</div><div class="kpi-value">${totalQty.toLocaleString("ru-RU")}</div></div>
    <div class="kpi"><div class="kpi-label">Низкий запас</div><div class="kpi-value">${lowCount}</div></div>
  </div>`;

  const rows = products
    .map(
      (p) =>
        `<tr>
          <td>${esc(p.name)}</td>
          <td class="mono">${esc(p.sku)}</td>
          <td>${esc(p.category || "—")}</td>
          <td class="num ${qtyClass(p.quantity)}">${p.quantity}</td>
          <td>${esc(p.unit)}</td>
          <td><span class="zone-tag">${esc(p.location || "—")}</span></td>
          <td><span class="cell-tag">${esc(p.cell || "—")}</span></td>
          <td class="mono">${esc(p.barcode || "—")}</td>
        </tr>`
    )
    .join("");

  const body = `<table>
    <thead><tr>
      <th>Наименование</th><th>Артикул</th><th>Категория</th>
      <th>Кол-во</th><th>Ед.</th><th>Зона</th><th>Ячейка</th><th>Штрихкод</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;

  reportShell("Остатки на складе", "Полный каталог", body, kpis);
}

export function openAnalyticsPrintReport(data: AnalyticsSummary): void {
  const kpis = `<div class="kpis">
    <div class="kpi"><div class="kpi-label">Позиций</div><div class="kpi-value">${data.totals.kinds}</div></div>
    <div class="kpi"><div class="kpi-label">Единиц</div><div class="kpi-value">${data.totals.units.toLocaleString("ru-RU")}</div></div>
    <div class="kpi"><div class="kpi-label">Низкий запас</div><div class="kpi-value">${data.stockLevels.low + data.stockLevels.critical}</div></div>
  </div>`;

  const catRows = data.categories
    .map(
      (c) =>
        `<tr><td>${esc(c.name)}</td><td class="num">${c.count}</td><td class="num">${c.quantity}</td></tr>`
    )
    .join("");
  const locRows = data.locations
    .map(
      (l) =>
        `<tr><td>${esc(l.name)}</td><td class="num">${l.kinds}</td><td class="num">${l.quantity}</td></tr>`
    )
    .join("");

  const body = `
    <h2>Категории</h2>
    <table><thead><tr><th>Категория</th><th>Позиций</th><th>Единиц</th></tr></thead><tbody>${catRows}</tbody></table>
    <h2>Зоны хранения</h2>
    <table><thead><tr><th>Зона</th><th>Позиций</th><th>Единиц</th></tr></thead><tbody>${locRows}</tbody></table>`;

  reportShell("Сводка по складу", "Аналитика и зоны", body, kpis);
}

export function openMovementsPrintReport(movements: StockMovement[]): void {
  const rows = movements
    .map((m) => {
      const sign = m.delta > 0 ? "+" : "";
      const cls = m.delta > 0 ? "ok" : "low";
      return `<tr>
        <td>${esc(new Date(m.createdAt).toLocaleString("ru-RU"))}</td>
        <td>${esc(m.productName)}</td>
        <td class="mono">${esc(m.productSku)}</td>
        <td class="num ${cls}">${sign}${m.delta}</td>
        <td class="num">${m.balanceAfter}</td>
        <td>${esc(m.reason)}</td>
        <td>${esc(m.userName || "—")}</td>
        <td>${esc(m.note || "—")}</td>
      </tr>`;
    })
    .join("");

  const body = `<table>
    <thead><tr>
      <th>Дата</th><th>Товар</th><th>Артикул</th><th>Δ</th><th>Остаток</th><th>Причина</th><th>Кладовщик</th><th>Комментарий</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;

  reportShell("Журнал движений", `${movements.length} записей`, body);
}

/** Прямое скачивание PDF (латиница). Для кириллицы используйте печать. */
export async function downloadInventoryPdfLatin(products: Product[]): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFillColor(13, 115, 119);
  doc.rect(0, 0, 297, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("Inventory Export", 14, 12);
  doc.setFontSize(8);
  doc.text(new Date().toLocaleString("ru-RU"), 220, 12);

  doc.setTextColor(15, 23, 42);
  autoTable(doc, {
    startY: 22,
    head: [["SKU", "Qty", "Unit", "Cell", "Zone"]],
    body: products.map((p) => [p.sku, String(p.quantity), p.unit, p.cell, p.location]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [13, 115, 119], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });
  doc.save(`ostatki_${new Date().toISOString().slice(0, 10)}.pdf`);
}
