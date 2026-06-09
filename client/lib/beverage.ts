export const LOW_STOCK_THRESHOLD = 36;
export const CRITICAL_STOCK_THRESHOLD = 10;

/** Категории только для складского учёта напитков. */
export const QUICK_CATEGORIES = [
  "Вода питьевая",
  "Минеральная вода",
  "Соки и нектары",
  "Морсы и компоты",
  "Лимонады и квас",
  "Газировка",
  "Холодный чай",
  "Кофе (готовый)",
  "Энергетики",
  "Спортивные напитки",
  "Молочные напитки",
  "Растительные напитки",
  "Пиво",
  "Сидр и медовуха",
  "Вино",
  "Крепкий алкоголь",
  "Слабоалкогольные коктейли",
  "Прочие напитки",
] as const;

export type BeverageCategory = (typeof QUICK_CATEGORIES)[number];

/** Типовые зоны хранения напитков на складе. */
export const WAREHOUSE_ZONE_PRESETS = [
  "Холодильник",
  "Холодный зал",
  "Сухой склад",
  "Экспедиция",
  "Зона приёмки",
] as const;

/** Перевод старых / неточных названий в актуальные категории. */
export const LEGACY_CATEGORY_MAP: Record<string, BeverageCategory> = {
  Вода: "Вода питьевая",
  "Пиво и сидр": "Пиво",
  "Кофе и холодный чай": "Холодный чай",
  "Сиропы и концентраты": "Прочие напитки",
  "Безалкогольные миксы": "Лимонады и квас",
  Слабоалкогольные: "Слабоалкогольные коктейли",
};

export function normalizeCategory(raw: string): BeverageCategory | string {
  const t = raw.trim();
  if (!t) return "";
  if ((QUICK_CATEGORIES as readonly string[]).includes(t)) return t as BeverageCategory;
  return LEGACY_CATEGORY_MAP[t] ?? t;
}

export function isKnownBeverageCategory(raw: string): boolean {
  const n = normalizeCategory(raw);
  return (QUICK_CATEGORIES as readonly string[]).includes(n);
}

/** Список категорий для фильтра в каталоге (только напитки, с учётом старых названий в БД). */
export function buildCategoryFilterList(products: { category: string }[]): string[] {
  const seen = new Set<string>();
  for (const p of products) {
    const cat = normalizeCategory(p.category);
    if (cat) seen.add(cat);
  }
  const ordered = QUICK_CATEGORIES.filter((c) => seen.has(c));
  for (const c of seen) {
    if (!(QUICK_CATEGORIES as readonly string[]).includes(c)) ordered.push(c);
  }
  return ordered;
}

export const UNIT_OPTIONS = [
  { value: "шт", label: "Штуки" },
  { value: "упак", label: "Упаковка" },
  { value: "ящик", label: "Ящик (короб)" },
  { value: "бут", label: "Бутылка / банка" },
  { value: "л", label: "Литры" },
  { value: "кег", label: "Кег" },
  { value: "паллет", label: "Паллета" },
] as const;

export const REASON_OPTIONS = [
  { value: "receipt", label: "Приёмка товара" },
  { value: "sale", label: "Продажа / выдача" },
  { value: "writeoff", label: "Списание (брак / истёк срок)" },
  { value: "inventory", label: "Инвентаризация" },
  { value: "transfer", label: "Перемещение между ячейками" },
  { value: "return", label: "Возврат поставщику" },
  { value: "adjustment", label: "Корректировка" },
] as const;

export type ReasonCode = (typeof REASON_OPTIONS)[number]["value"];

export function reasonLabel(reason: string): string {
  return REASON_OPTIONS.find((r) => r.value === reason)?.label ?? reason;
}

export function productLowThreshold(p: { minQuantity?: number | null }): number {
  return p.minQuantity != null && p.minQuantity > 0 ? p.minQuantity : LOW_STOCK_THRESHOLD;
}

export function isLowStock(p: { quantity: number; minQuantity?: number | null }): boolean {
  const t = productLowThreshold(p);
  return p.quantity < t && p.quantity >= CRITICAL_STOCK_THRESHOLD;
}

export function isCriticalStock(p: { quantity: number }): boolean {
  return p.quantity < CRITICAL_STOCK_THRESHOLD;
}

export function formatPrice(val?: number | null): string {
  if (val == null) return "—";
  return val.toLocaleString("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 2,
  });
}

export function categoryDisplayName(raw: string): string {
  return normalizeCategory(raw) || "Без категории";
}
