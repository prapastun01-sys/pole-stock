// ประเภท/สถานะของเสา
export const KINDS = [
  { v: "new", label: "เสาใหม่", short: "ใหม่", cls: "bg-emerald-100 text-emerald-700" },
  { v: "dismantled", label: "เสารื้อถอน", short: "รื้อถอน", cls: "bg-orange-100 text-orange-700" },
  { v: "expired", label: "เสาหมดอายุ", short: "หมดอายุ", cls: "bg-red-100 text-red-700" },
  { v: "broken", label: "เสาหัก", short: "หัก", cls: "bg-rose-100 text-rose-700" },
  { v: "deposit", label: "เสารับฝาก", short: "รับฝาก", cls: "bg-sky-100 text-sky-700" },
] as const;

export const KIND_VALUES: string[] = KINDS.map((k) => k.v);
export const kindOf = (v?: string) => KINDS.find((k) => k.v === v) || KINDS[0];
