import { db } from "@/lib/supabase";
import PrintBar from "@/components/PrintBar";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const TZ = "Asia/Bangkok";
const dateTH = (d: Date) => d.toLocaleDateString("th-TH-u-ca-buddhist", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" });
const timeTH = (d: Date) => d.toLocaleTimeString("th-TH", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }) + " น.";

const css = `
@page { size: A4; margin: 14mm 14mm 16mm; }
.sheet { background:#fff; max-width:210mm; margin:0 auto 24px; padding:14mm; box-shadow:0 1px 8px rgba(0,0,0,.18); }
.doc { font-family:"Noto Sans Thai","Sarabun",sans-serif; color:#111; font-size:13.5px; line-height:1.5; }
.doc * { box-sizing:border-box; }
.doc .head { text-align:center; padding-bottom:8px; border-bottom:2px solid #111; }
.doc .org { font-size:14px; min-height:1px; }
.doc h1 { margin:2px 0 0; font-size:24px; font-weight:700; letter-spacing:1px; }
.doc .meta { display:flex; justify-content:space-between; gap:12px; margin:10px 0 12px; }
.doc h2 { font-size:14.5px; margin:14px 0 6px; padding:3px 8px; background:#e9eef0; border-left:4px solid #0f766e; font-weight:700; }
.doc table { width:100%; border-collapse:collapse; }
.doc th, .doc td { border:1px solid #444; padding:5px 8px; vertical-align:top; }
.doc th { background:#f1f4f5; font-weight:700; text-align:center; }
.doc .info th { width:28%; text-align:left; font-weight:600; }
.doc .c { text-align:center; } .doc .r { text-align:right; }
.doc .nos { word-break:break-word; }
.doc tfoot td { font-weight:700; background:#f1f4f5; }
.doc tr { page-break-inside:avoid; }
.doc .sign { display:flex; gap:14px; margin-top:30px; page-break-inside:avoid; }
.doc .sign > div { flex:1; text-align:center; font-size:13px; }
.doc .sign .line { margin:38px 6px 4px; border-bottom:1px dotted #111; height:1px; }
.doc .foot { margin-top:16px; font-size:11px; color:#555; display:flex; justify-content:space-between; }
@media print {
  html, body { background:#fff !important; }
  main { padding:0 !important; max-width:none !important; }
  .sheet { padding:0; margin:0; box-shadow:none; max-width:none; }
  .no-print { display:none !important; }
}
`;

export default async function Print({ params, searchParams }: { params: { id: string }; searchParams: { auto?: string } }) {
  const { data: w } = await db()
    .from("withdrawals")
    .select("*, poles(pole_no,tier,pos,sites(label),pole_sizes(name))")
    .eq("id", params.id)
    .single();
  if (!w) return <div className="card">ไม่พบใบเบิกนี้ <a className="text-brand underline" href="/history">กลับประวัติ</a></div>;

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
  const nb = ((w as any).before_photos || []).length, na = ((w as any).after_photos || []).length;

  return (
    <div>
      <style>{css}</style>
      <PrintBar auto={searchParams.auto === "1"} />
      <div className="sheet">
        <div className="doc">
          <div className="head">
            <div className="org">{org || " "}</div>
            <h1>ใบเบิกเสา</h1>
          </div>
          <div className="meta">
            <div>เลขที่ <b>{docNo}</b></div>
            <div>วันที่ <b>{dateTH(created)} เวลา {timeTH(created)}</b></div>
          </div>

          <h2>ข้อมูลงาน</h2>
          <table className="info"><tbody>
            <tr><th>ชื่องาน</th><td>{(w as any).job_name}</td></tr>
            <tr><th>WBS / ใบสั่ง</th><td>{(w as any).wbs || "-"}</td></tr>
            <tr><th>โครงข่าย</th><td>{(w as any).network || "-"}</td></tr>
            <tr><th>ผู้รับผิดชอบ</th><td>{(w as any).responsible}</td></tr>
            <tr><th>ทีมงาน</th><td>{(w as any).team || "-"}</td></tr>
            <tr><th>สถานะงาน</th><td>{done}</td></tr>
            <tr><th>รูปประกอบ</th><td>ก่อนขนเสา {nb} รูป · หลังขนเสา {na} รูป (เก็บไว้ในระบบ)</td></tr>
          </tbody></table>

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
