// เอกสารตรวจนับพัสดุประจำเดือน (สร้างโครงข้อมูลของแต่ละชีต/บล็อก — ส่วนวาด Excel อยู่ที่ app/api/inventory/route.ts)

export type InvSize = { id: string; name: string; sort_order?: number };
export type InvSite = { id: string; name: string; zone?: string | null; pile?: string | null };
export type InvPole = { pole_no: string; tier: number | null; pos: number | null; kind: string; site_id: string; size_id: string };

export type InvRow = { nos: string; count: number };
export type InvBlock = {
  seq: number; code: string; item: string; point: string; batch: "N" | "R";
  siteId: string; rows: InvRow[]; total: number;
};
export type InvSheet = { name: string; place: string; blocks: InvBlock[]; total: number };

// รหัสพัสดุ + ชื่อรายการ ตามขนาดเสา
export function material(sizeName: string): { code: string; item: string } {
  const n = sizeName || "";
  if (/stub/i.test(n)) {
    if (/0?\.41/.test(n)) return { code: "1-00-002-0500", item: "STUB 0.41X0.41 M. 5.5 M.LONG" };
    return { code: "1-00-002-0400", item: "STUB 0.36X0.36 M. 4.5 M.LONG" };
  }
  const m = n.match(/(\d+(?:\.\d+)?)/);
  const v = m ? Number(m[1]) : NaN;
  const table: Record<string, [string, string]> = {
    "8": ["1-00-001-0001", "POLE 8 M."],
    "9": ["1-00-001-0002", "POLE 9 M."],
    "12": ["1-00-001-0004", "POLE 12 M."],
    "14": ["1-00-001-0006", "POLE 14 M."],
    "12.2": ["1-00-001-0012", "POLE 12.2 M."],
    "14.3": ["1-00-001-0013", "POLE 14.3 M."],
    "22": ["1-00-001-0016", "POLE 22 M WITH GROUND PLATE 2 SIDES"],
  };
  const hit = isFinite(v) ? table[String(v)] : undefined;
  if (hit) return { code: hit[0], item: hit[1] };
  return { code: "", item: isFinite(v) ? `POLE ${v} M.` : n };
}

// รหัสสถานที่จัดเก็บ = เลข 4 หลักท้ายชื่อจุด (เช่น "ที่เช่า 6001" → 6001)
export function placeCode(pointName: string): string {
  const m = (pointName || "").match(/(\d{4})\s*$/);
  return m ? m[1] : (pointName || "-");
}

const nat = (a: any, b: any) => String(a ?? "").localeCompare(String(b ?? ""), "th", { numeric: true });
const safeSheet = (s: string) => s.replace(/[\\/?*\[\]:]/g, " ").trim().slice(0, 31) || "Sheet";

// poles = เสาที่ "คงเหลือ" เท่านั้น. ลำดับ: ต่อขนาดเสา → เสาใหม่ (N) ทุกกองก่อน แล้วเสารื้อถอน (R)
export function buildInventory(sites: InvSite[], sizes: InvSize[], poles: InvPole[]): InvSheet[] {
  const siteById = new Map(sites.map((s) => [s.id, s]));
  const sheets: InvSheet[] = [];
  const sortedSizes = [...sizes].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || nat(a.name, b.name));

  type Key = string;
  const bySizeCode = new Map<Key, { size: InvSize; code: string; poles: InvPole[] }>();
  for (const p of poles) {
    const site = siteById.get(p.site_id); const size = sortedSizes.find((z) => z.id === p.size_id);
    if (!site || !size) continue;
    if (p.kind !== "new" && p.kind !== "dismantled") continue; // เสาประเภทอื่นไม่อยู่ในเอกสารนี้
    const code = placeCode(site.name);
    const k = size.id + "|" + code;
    if (!bySizeCode.has(k)) bySizeCode.set(k, { size, code, poles: [] });
    bySizeCode.get(k)!.poles.push(p);
  }

  const codesPerSize = new Map<string, number>();
  Array.from(bySizeCode.values()).forEach((g) => codesPerSize.set(g.size.id, (codesPerSize.get(g.size.id) || 0) + 1));

  const groups = Array.from(bySizeCode.values()).sort((a, b) =>
    sortedSizes.indexOf(a.size) - sortedSizes.indexOf(b.size) || nat(a.code, b.code));

  for (const g of groups) {
    const mat = material(g.size.name);
    const blocks: InvBlock[] = [];
    for (const batch of ["N", "R"] as const) {
      const kind = batch === "N" ? "new" : "dismantled";
      const bySite = new Map<string, InvPole[]>();
      for (const p of g.poles) if (p.kind === kind) { if (!bySite.has(p.site_id)) bySite.set(p.site_id, []); bySite.get(p.site_id)!.push(p); }
      const siteList = Array.from(bySite.keys()).map((id) => siteById.get(id)!)
        .sort((a, b) => nat(a.name, b.name) || nat(a.zone, b.zone) || nat(a.pile, b.pile));
      for (const s of siteList) {
        const ps = bySite.get(s.id)!;
        // แถวละ 1 ชั้น: ชั้นบนสุดก่อน, ซ้าย → ขวา (เหมือนผังกอง)
        const tiers = new Map<number, InvPole[]>();
        for (const p of ps) { const t = p.tier ?? 0; if (!tiers.has(t)) tiers.set(t, []); tiers.get(t)!.push(p); }
        const rows: InvRow[] = Array.from(tiers.keys()).sort((a, b) => (a === 0 ? 1 : b === 0 ? -1 : b - a)).flatMap((t) => {
          const list = tiers.get(t)!.sort((a, b) => (a.pos ?? 1e9) - (b.pos ?? 1e9) || nat(a.pole_no, b.pole_no));
          const out: InvRow[] = [];
          for (let i = 0; i < list.length; i += 12) {
            const part = list.slice(i, i + 12);
            out.push({ nos: part.map((x) => x.pole_no).join(", "), count: part.length });
          }
          return out;
        });
        blocks.push({ seq: 0, code: mat.code, item: mat.item, point: s.name, batch, siteId: s.id, rows, total: ps.length });
      }
    }
    blocks.forEach((b, i) => { b.seq = i + 1; });
    const multi = (codesPerSize.get(g.size.id) || 0) > 1;
    sheets.push({ name: safeSheet(multi ? `${g.size.name} (${g.code})` : g.size.name), place: g.code, blocks, total: blocks.reduce((a, b) => a + b.total, 0) });
  }
  // ชื่อชีตต้องไม่ซ้ำ
  const used = new Set<string>();
  for (const sh of sheets) { let n = sh.name, i = 2; while (used.has(n.toLowerCase())) n = sh.name.slice(0, 28) + " " + i++; sh.name = n; used.add(n.toLowerCase()); }
  return sheets;
}
