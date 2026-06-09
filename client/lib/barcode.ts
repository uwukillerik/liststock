/** Результат разбора кода маркировки / штрихкода. */
export interface ParsedBarcode {
  raw: string;
  gtin?: string;
  expiryDate?: string;
  batchCode?: string;
  serial?: string;
}

const GS = String.fromCharCode(29);

/** Нормализует GTIN до 13 цифр (EAN-13). */
export function normalizeGtin(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length === 14 && d.startsWith("0")) return d.slice(1);
  if (d.length === 14) return d.slice(-13);
  if (d.length === 13) return d;
  if (d.length === 12) return `0${d}`;
  return d;
}

function parseGs1Date(yymmdd: string): string | undefined {
  if (!/^\d{6}$/.test(yymmdd)) return undefined;
  const yy = parseInt(yymmdd.slice(0, 2), 10);
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  const year = yy >= 50 ? 1900 + yy : 2000 + yy;
  return `${year}-${mm}-${dd}`;
}

function extractGs1Fields(data: string): Partial<ParsedBarcode> {
  const result: Partial<ParsedBarcode> = {};
  let i = 0;
  while (i < data.length) {
    const ai = data.slice(i, i + 2);
    if (!/^\d{2}$/.test(ai)) break;
    i += 2;
    switch (ai) {
      case "01": {
        const gtin = data.slice(i, i + 14);
        if (/^\d{14}$/.test(gtin)) {
          result.gtin = normalizeGtin(gtin);
          i += 14;
        }
        break;
      }
      case "17": {
        const d = data.slice(i, i + 6);
        result.expiryDate = parseGs1Date(d);
        i += 6;
        break;
      }
      case "10": {
        const end = data.indexOf(GS, i);
        const val = end === -1 ? data.slice(i) : data.slice(i, end);
        result.batchCode = val.slice(0, 20);
        i = end === -1 ? data.length : end + 1;
        break;
      }
      case "21": {
        const end = data.indexOf(GS, i);
        const val = end === -1 ? data.slice(i) : data.slice(i, end);
        result.serial = val.slice(0, 20);
        i = end === -1 ? data.length : end + 1;
        break;
      }
      default:
        i = data.length;
    }
  }
  return result;
}

/** Полный разбор кода: «Честный знак», GS1, EAN. */
export function parseBarcode(raw: string): ParsedBarcode {
  const trimmed = raw.trim();
  const cleaned = trimmed.replace(/\s/g, "");

  if (/^https?:\/\//i.test(cleaned)) {
    const pathMatch = cleaned.match(/\/(\d{13,14})(?:\/|$|\?)/);
    if (pathMatch) {
      return { raw: trimmed, gtin: normalizeGtin(pathMatch[1]) };
    }
  }

  const withParens = cleaned.replace(/\((\d{2})\)/g, "$1");
  const gs1Data = withParens.split(GS).join("");
  const gs1 = extractGs1Fields(gs1Data);
  if (gs1.gtin) {
    return { raw: trimmed, ...gs1 };
  }

  const ai01 = cleaned.match(/01(\d{14})/);
  if (ai01) {
    const extra = extractGs1Fields(cleaned);
    return {
      raw: trimmed,
      gtin: normalizeGtin(ai01[1]),
      expiryDate: extra.expiryDate,
      batchCode: extra.batchCode,
      serial: extra.serial,
    };
  }

  if (/^\d{8}$/.test(cleaned)) {
    return { raw: trimmed, gtin: cleaned };
  }
  if (/^\d{12,14}$/.test(cleaned)) {
    return { raw: trimmed, gtin: normalizeGtin(cleaned) };
  }

  return { raw: trimmed, gtin: cleaned.length >= 8 ? cleaned : undefined };
}

/** Извлекает GTIN из кода «Честный знак» или обычного штрихкода. */
export function extractGtinFromChestnyZnak(raw: string): string {
  const parsed = parseBarcode(raw);
  return parsed.gtin ?? raw.replace(/\s/g, "");
}

/** Сопоставление товара по штрихкоду / GTIN / артикулу. */
export function matchProductByCode(
  products: { id: string; sku: string; barcode?: string }[],
  raw: string
): { id: string; sku: string; barcode?: string } | undefined {
  const parsed = parseBarcode(raw);
  const gtin = parsed.gtin ?? raw.replace(/\s/g, "");
  const norm = normalizeGtin(gtin);

  return products.find((p) => {
    const bc = (p.barcode ?? "").replace(/\s/g, "");
    if (!bc && p.sku !== raw && p.sku !== gtin) return false;
    if (p.sku === raw || p.sku === gtin) return true;
    if (bc === raw || bc === gtin || bc === norm) return true;
    if (bc.includes(norm) || norm.includes(bc)) return true;
    if (bc.length >= 8 && norm.length >= 8 && bc.slice(-13) === norm.slice(-13)) return true;
    return false;
  });
}
