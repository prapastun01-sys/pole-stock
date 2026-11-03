import type { PilePhotos } from "@/lib/pile";

const d = (x: string) => new Date(x).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium" });

// แสดงรูปกองเต็ม + รูปหลังขนล่าสุด (server component)
export default function PilePhotosView({ ph }: { ph?: PilePhotos }) {
  const none = "flex h-24 w-32 items-center justify-center rounded-lg border border-dashed text-xs text-slate-400";
  return (
    <div className="mb-3 flex flex-wrap gap-4">
      <div>
        <div className="mb-1 text-xs text-slate-500">รูปกองเต็ม {ph?.full ? `(${d(ph.full.at)})` : ""}</div>
        {ph?.full ? (
          <a href={`https://drive.google.com/file/d/${ph.full.id}/view`} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ph.full.url} alt="รูปกองเต็ม" loading="lazy" className="h-24 w-32 rounded-lg border object-cover" />
          </a>
        ) : <div className={none}>ไม่มีรูป</div>}
      </div>
      <div>
        <div className="mb-1 text-xs text-slate-500">รูปหลังขนล่าสุด {ph?.after ? `(${d(ph.after.at)} · ${ph.after.job})` : ""}</div>
        <div className="flex gap-1.5">
          {ph?.after ? ph.after.photos.slice(0, 3).map((x) => (
            <a key={x.id} href={`https://drive.google.com/file/d/${x.id}/view`} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={x.url} alt="รูปหลังขน" loading="lazy" className="h-24 w-32 rounded-lg border object-cover" />
            </a>
          )) : <div className={none}>ยังไม่เคยเบิก</div>}
        </div>
      </div>
    </div>
  );
}
