"use client";
// เลือก "จุดกองหมอน" (ชื่อ) ก่อน แล้วค่อยเลือก "กอง" ภายในจุดนั้น
export default function SitePicker({ sites, value, onChange }: { sites: any[]; value: string; onChange: (id: string) => void }) {
  const names = Array.from(new Set(sites.map((s) => s.name as string))).sort((a, b) => a.localeCompare(b));
  const cur = sites.find((s) => s.id === value);
  const name = cur?.name || "";
  const piles = sites.filter((s) => s.name === name);
  const pileName = (s: any) => [s.zone && `Zone ${s.zone}`, s.pile].filter(Boolean).join(" / ") || "กองหลัก";
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <select className="input" value={name} onChange={(e) => {
        const first = sites.find((s) => s.name === e.target.value);
        onChange(first ? first.id : "");
      }}>
        <option value="">— เลือกจุดกองหมอน —</option>
        {names.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      <select className="input" value={value} disabled={!name} onChange={(e) => onChange(e.target.value)}>
        {!name && <option value="">เลือกจุดก่อน</option>}
        {piles.map((s) => <option key={s.id} value={s.id}>{pileName(s)}</option>)}
      </select>
    </div>
  );
}
