import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function History() {
  const { data, error } = await db()
    .from("withdrawals")
    .select("*, sites(name), pole_sizes(name), poles(pole_no)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return <div className="card text-red-600">{error.message}</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">ประวัติการเบิกเสา</h1>
      {(data || []).map((w: any) => (
        <article key={w.id} className="card space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold">{w.job_name}</h2>
              <div className="text-sm text-slate-500">{new Date(w.created_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</div>
            </div>
            <span className="chip">{w.poles.length} ต้น · {w.pole_sizes?.name}</span>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm md:grid-cols-3">
            <Item k="จุดกองหมอน" v={w.sites?.name} />
            <Item k="WBS/ใบสั่ง" v={w.wbs} />
            <Item k="โครงข่าย" v={w.network} />
            <Item k="ผู้รับผิดชอบ" v={w.responsible} />
            <Item k="ทีมงาน" v={w.team} />
          </dl>
          <div className="flex flex-wrap gap-1">{w.poles.map((p: any) => <span key={p.pole_no} className="chip">{p.pole_no}</span>)}</div>
          <Photos title="ก่อนขน" list={w.before_photos} />
          <Photos title="หลังขน" list={w.after_photos} />
        </article>
      ))}
      {(data || []).length === 0 && <div className="card text-slate-500">ยังไม่มีประวัติการเบิก</div>}
    </div>
  );
}

function Item({ k, v }: { k: string; v?: string }) {
  return <div><dt className="text-slate-400">{k}</dt><dd className="font-medium">{v || "-"}</dd></div>;
}

function Photos({ title, list }: { title: string; list: { id: string; url: string }[] }) {
  if (!list?.length) return null;
  return (
    <div>
      <div className="mb-1 text-sm text-slate-500">{title}</div>
      <div className="flex flex-wrap gap-2">
        {list.map((p) => (
          <a key={p.id} href={`https://drive.google.com/file/d/${p.id}/view`} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={title} loading="lazy" className="h-20 w-20 rounded-lg border object-cover" />
          </a>
        ))}
      </div>
    </div>
  );
}
