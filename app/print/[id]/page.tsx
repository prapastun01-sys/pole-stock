import { db } from "@/lib/supabase";
import PrintBar from "@/components/PrintBar";
import { fetchPoles, pilePhotos } from "@/lib/pile";
import { withdrawalColors } from "@/lib/wcolor";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const TZ = "Asia/Bangkok";
const dateTH = (d: Date) => d.toLocaleDateString("th-TH-u-ca-buddhist", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" });
const timeTH = (d: Date) => d.toLocaleTimeString("th-TH", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }) + " น.";

const css = `
@page { size: A4; margin: 8mm; }
.sheet { background:#fff; width:210mm; margin:0 auto 24px; padding:8mm; box-sizing:border-box; box-shadow:0 1px 8px rgba(0,0,0,.18); }
.doc { font-family:"Noto Sans Thai","Sarabun",sans-serif; color:#111; font-size:12px; line-height:1.35; }
.doc * { box-sizing:border-box; }
.doc .head { text-align:center; padding-bottom:4px; border-bottom:2px solid #111; }
.doc .org { font-size:12.5px; min-height:1px; }
.doc h1 { margin:0; font-size:20px; font-weight:700; letter-spacing:1px; line-height:1.3; }
.doc .meta { display:flex; justify-content:space-between; gap:12px; margin:6px 0 6px; }
.doc h2 { font-size:13px; margin:8px 0 4px; padding:2px 8px; background:#e9eef0; border-left:4px solid #0f766e; font-weight:700; }
.doc table { width:100%; border-collapse:collapse; }
.doc th, .doc td { border:1px solid #444; padding:2px 6px; vertical-align:top; }
.doc th { background:#f1f4f5; font-weight:700; text-align:center; }
.doc .info th { width:24%; text-align:left; font-weight:600; }
.doc .c { text-align:center; } .doc .r { text-align:right; }
.doc .nos { word-break:break-word; }
.doc tfoot td { font-weight:700; background:#f1f4f5; }
.doc tr { page-break-inside:avoid; }
.doc .sign { display:flex; gap:12px; margin-top:12px; page-break-inside:avoid; }
.doc .sign > div { flex:1; text-align:center; font-size:12px; }
.doc .sign .line { margin:24px 6px 3px; border-bottom:1px dotted #111; height:1px; }
.doc .foot { margin-top:8px; font-size:10px; color:#555; display:flex; justify-content:space-between; }
.doc .pile { margin:3px 0 8px 8px; }
.doc .pile h3 { margin:0; font-size:14px; font-weight:700; line-height:1.3; }
.doc .pile .sub { font-size:11px; color:#555; }
.doc .pile .sub b { color:#0f766e; }
.doc .pphotos { display:flex; gap:8px; margin:3px 0 5px; align-items:flex-start; }
.doc .pphotos figure { margin:0; }
.doc .pphotos figcaption { font-size:10px; color:#555; margin-bottom:1px; }
.doc .pphotos img { height:64px; width:auto; max-width:100px; object-fit:cover; border-radius:5px; border:1px solid #ccc; display:block; }
.doc .trow { display:flex; align-items:flex-start; gap:5px; margin-bottom:3px; }
.doc .trow .tl { width:32px; font-size:10px; color:#888; padding-top:4px; flex:none; }
.doc .tgrid { flex:1; display:grid; grid-template-columns:repeat(10,1fr); gap:3px; }
.doc .tgrid.dense .cell { font-size:9.5px; } .doc .tgrid.dense .cell .tm { font-size:6px; }
.doc .cell { position:relative; min-width:0; text-align:center; padding:2px 0 8px; border-radius:6px; border:1px solid #94a3b8; background:#fff; font-weight:600; font-size:11.5px; line-height:1.25; }
.doc .cell .tm { position:absolute; right:3px; bottom:0; font-size:7px; line-height:1.2; font-weight:600; color:#0f766e; max-width:95%; white-space:nowrap; overflow:hidden; text-overflow:clip; }
.doc .legend { display:flex; flex-wrap:wrap; gap:2px 10px; font-size:10px; margin:0 0 4px 37px; }
.doc .lg i { display:inline-block; width:10px; height:10px; border:1px solid; border-radius:3px; margin-right:3px; vertical-align:-1px; }
.doc * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.doc .cell.out { background:#e3e8ef; border:2px solid #475569; padding:1px 0 7px; color:#334155; text-decoration:line-through; }
.doc .cell.old { background:#f4f5f7; border-color:#e5e7eb; color:#64748b; font-weight:400; }
@media print {
  html, body { background:#fff !important; }
  main { padding:0 !important; max-width:none !important; }
  .sheet { padding:0; margin:0; box-shadow:none; width:194mm; }
  .no-print { display:none !important; }
}
`;

export default async function Print({ params, searchParams }: { params: { id: string }; searchParams: { auto?: string } }) {
  const { data: w } = await db()
    .from("withdrawals")
    .select("*, poles(pole_no,tier,pos,site_id,sites(label),pole_sizes(name))")
    .eq("id", params.id)
    .single();
  if (!w) return <div className="card">ไม่พบใบเบิกนี้ <a className="text-brand underline" href="/history">กลับประวัติ</a></div>;

  // ผังของแต่ละกองที่แตะในใบนี้ (เสาในใบนี้ = ขีดฆ่า)
  const siteIds = Array.from(new Set(((w as any).poles || []).map((p: any) => p.site_id))) as string[];
  const { data: siteRows } = await db().from("sites").select("id,name,zone,pile,label").in("id", siteIds);
  const phs = await pilePhotos(siteIds);
  const piles: any[] = [];
  for (const sid of siteIds) {
    const site = (siteRows || []).find((x: any) => x.id === sid) as any;
    const all = await fetchPoles(sid);
    const byTier = new Map<number, any[]>();
    for (const x of all) { const t = x.tier ?? 0; if (!byTier.has(t)) byTier.set(t, []); byTier.get(t)!.push(x); }
    const tiers = Array.from(byTier.keys()).sort((a, b) => (a === 0 ? -1 : b === 0 ? 1 : b - a));
    piles.push({
      sid, site, tiers, byTier, ph: phs[sid], maxN: Math.max(1, ...Array.from(byTier.values()).flatMap((a: any[]) => a.map((x: any, i: number) => (Number.isInteger(x.pos) && x.pos > 0 ? x.pos : i + 1)))), wcol: withdrawalColors(all),
      total: all.length, avail: all.filter((x: any) => x.status === "available").length,
      title: [site?.zone, site?.pile].filter(Boolean).join(" / ") || site?.label || "",
    });
  }
  const items: any[] = Array.isArray((w as any).items) ? (w as any).items : [];

  const poles = [...((w as any).poles || [])].sort((a: any, b: any) => (a.tier ?? 999) - (b.tier ?? 999) || (a.pos ?? 999) - (b.pos ?? 999));
  const m = new Map<string, { site: string; size: string; nos: string[] }>();
  for (const p of poles) {
    const k = `${p.sites?.label}|${p.pole_sizes?.name}`;
    if (!m.has(k)) m.set(k, { site: p.sites?.label, size: p.pole_sizes?.name, nos: [] });
    m.get(k)!.nos.push(p.pole_no);
  }
  const groups = Array.from(m.values());
  const total = poles.length;

  const created = new Date((w as any).created_at);
  const yearBE = Number(created.toLocaleDateString("en-CA", { timeZone: TZ }).slice(0, 4)) + 543;
  const docNo = (w as any).doc_seq != null ? `${String((w as any).doc_seq).padStart(4, "0")}/${yearBE}` : `W-${String((w as any).id).slice(0, 6).toUpperCase()}`;
  const done = (w as any).done_at ? `งานเสร็จ · เลขใบตัดงาน ${(w as any).cut_no || "-"}` : "อยู่ระหว่างดำเนินการ";
  const now = new Date();
  const org = process.env.ORG_NAME || "";
  const nb = ((w as any).before_photos || []).length, na = ((w as any).after_photos || []).length, nc = ((w as any).acc_photos || []).length;

  return (
    <div>
      <style>{css}</style>
      <PrintBar auto={searchParams.auto === "1"} />
      <div className="sheet" id="sheet">
        <div className="doc" id="doc">
          <div className="head">
            <div className="org">{org || " "}</div>
            <h1>ใบเบิกเสา</h1>
          </div>
          <div className="meta">
            <div>เลขที่ <b>{docNo}</b></div>
            <div>วันที่ <b>{dateTH(created)} เวลา {timeTH(created)}</b></div>
          </div>

          <h2>ข้อมูลงาน</h2>
          {piles.map((pl) => (
            <div className="pile" key={pl.sid}>
              <h3>{pl.title}</h3>
              <div className="sub">{pl.site?.name ? `${pl.site.name} · ` : ""}คงเหลือ <b>{pl.avail}</b> / {pl.total} ต้น</div>
              <div className="pphotos">
                {pl.ph?.full && (
                  <figure><figcaption>รูปกองเต็ม ({dateTH(new Date(pl.ph.full.at))})</figcaption>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pl.ph.full.url} alt="รูปกองเต็ม" /></figure>
                )}
                {pl.ph?.after && (
                  <figure><figcaption>รูปหลังขนล่าสุด ({dateTH(new Date(pl.ph.after.at))} · {pl.ph.after.job})</figcaption>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pl.ph.after.photos[0].url} alt="รูปหลังขนล่าสุด" /></figure>
                )}
              </div>
              {pl.wcol.size > 0 && (
                <div className="legend">
                  {Array.from(pl.wcol.entries()).map(([wid, c]: any) => (
                    <span className="lg" key={wid}><i style={{ background: c.bg, borderColor: c.bd }} />{c.label}{wid === (w as any).id ? " (ใบนี้)" : ""}</span>
                  ))}
                </div>
              )}
              {pl.tiers.map((t: number) => (
                <div className="trow" key={t}>
                  <div className="tl">{t === 0 ? "ไม่ระบุ" : `ชั้น ${t}`}</div>
                  <div className={`tgrid${pl.maxN > 14 ? " dense" : ""}`} style={{ gridTemplateColumns: `repeat(${pl.maxN}, minmax(0, 1fr))` }}>
                    {pl.byTier.get(t)!.map((x: any, xi: number) => (
                      <div key={x.id} style={{ gridColumnStart: Number.isInteger(x.pos) && x.pos > 0 ? x.pos : xi + 1, ...(x.status !== "available" && pl.wcol.get(x.withdrawal_id) ? { background: pl.wcol.get(x.withdrawal_id).bg, borderColor: pl.wcol.get(x.withdrawal_id).bd } : {}) }}
                        className={`cell ${x.withdrawal_id === (w as any).id ? "out" : x.status === "available" ? "" : "old"}`}>{x.pole_no}{x.withdrawals?.team && x.status !== "available" ? <span className="tm">{x.withdrawals.team}</span> : null}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
          <table className="info"><tbody>
            <tr><th>ชื่องาน</th><td>{(w as any).job_name}</td></tr>
            <tr><th>WBS / ใบสั่ง</th><td>{(w as any).wbs || "-"}</td></tr>
            <tr><th>โครงข่าย</th><td>{(w as any).network || "-"}</td></tr>
            <tr><th>ผู้รับผิดชอบ</th><td>{(w as any).responsible}</td></tr>
            <tr><th>วันขนเสา</th><td>{dateTH(new Date(((w as any).move_date || created.toLocaleDateString("en-CA", { timeZone: TZ })) + "T12:00:00+07:00"))}</td></tr>
            <tr><th>ทีมงาน</th><td>{(w as any).team || "-"}</td></tr>
            <tr><th>สถานะงาน</th><td>{(w as any).approved_at === null ? "รออนุมัติ" : done}</td></tr>
            <tr><th>รูปประกอบ</th><td>ก่อนขนเสา {nb} รูป · หลังขนเสา {na} รูป{nc > 0 ? ` · หลังขนอุปกรณ์เสริม ${nc} รูป` : ""} (เก็บไว้ในระบบ)</td></tr>
          </tbody></table>

          {groups.length > 0 && (
            <>
          <h2>รายการเสาที่เบิก</h2>
          <table>
            <thead><tr><th style={{ width: "8%" }}>ลำดับ</th><th style={{ width: "27%" }}>จุดกองหมอน / กอง</th><th style={{ width: "14%" }}>ขนาดเสา</th><th style={{ width: "10%" }}>จำนวน</th><th>เลขเสา</th></tr></thead>
            <tbody>
              {groups.map((g, i) => (
                <tr key={i}>
                  <td className="c">{i + 1}</td><td>{g.site}</td><td className="c">{g.size}</td><td className="c">{g.nos.length}</td>
                  <td className="nos">{g.nos.join(", ")}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={3} className="r">รวมทั้งสิ้น</td><td className="c">{total}</td><td>ต้น</td></tr></tfoot>
          </table>
            </>
          )}

          {items.length > 0 && (
            <>
              <h2>อุปกรณ์เสริมที่เบิก</h2>
              <table>
                <thead><tr><th style={{ width: "8%" }}>ลำดับ</th><th style={{ width: "22%" }}>รหัส</th><th>รายการ</th><th style={{ width: "10%" }}>จำนวน</th></tr></thead>
                <tbody>
                  {items.map((x, i) => (
                    <tr key={i}><td className="c">{i + 1}</td><td>{x.code}</td><td>{x.name}{x.detail ? ` (${x.detail})` : ""}</td><td className="c">{x.qty}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div className="sign">
            <div><div className="line" />({(w as any).responsible})<br />ผู้เบิก<br />วันที่ ........../........../..........</div>
            <div><div className="line" />(................................................)<br />ผู้ตรวจสอบ<br />วันที่ ........../........../..........</div>
            <div><div className="line" />(................................................)<br />ผู้อนุมัติ<br />วันที่ ........../........../..........</div>
          </div>
          <div className="foot"><span>พิมพ์เมื่อ {dateTH(now)} {timeTH(now)}</span><span>ระบบเบิกเสา · เอกสารฉบับนี้สร้างโดยระบบ</span></div>
        </div>
      </div>
    </div>
  );
}
