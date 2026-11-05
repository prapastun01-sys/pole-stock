"use client";
import { useRef, useState } from "react";
import { compressImage, Photo } from "@/lib/client";
import { notify } from "@/lib/status";

export default function PhotoPicker({
  label, photos, onChange, single,
}: { label: string; photos: Photo[]; onChange: (p: Photo[]) => void; single?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const out: Photo[] = [];
      for (const f of Array.from(files)) {
        const blob = await compressImage(f);
        out.push({ id: crypto.randomUUID(), blob, preview: URL.createObjectURL(blob), name: f.name });
      }
      onChange(single ? out.slice(0, 1) : [...photos, ...out]);
    } catch {
      notify("❌ อ่านรูปไม่ได้ กรุณาลองรูปอื่น");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex flex-wrap gap-2">
        {photos.map((p) => (
          <div key={p.id} className="relative h-24 w-24 overflow-hidden rounded-xl border border-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.preview} alt="" className="h-full w-full object-cover" />
            <span className="absolute bottom-0 left-0 bg-black/60 px-1 text-[10px] text-white">{Math.round(p.blob.size / 1024)} KB</span>
            <button type="button" onClick={() => onChange(photos.filter((x) => x.id !== p.id))}
              className="absolute right-0 top-0 h-6 w-6 rounded-bl-lg bg-red-600 text-sm leading-6 text-white">×</button>
          </div>
        ))}
        <button type="button" onClick={() => ref.current?.click()} disabled={busy}
          className="flex h-24 w-24 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-sm text-slate-500 hover:border-brand hover:text-brand">
          <span className="text-2xl">{busy ? "⏳" : "📷"}</span>
          {busy ? "กำลังบีบ..." : single ? "เลือกรูป" : "เพิ่มรูป"}
        </button>
      </div>
      <input ref={ref} type="file" accept="image/*" multiple={!single} hidden onChange={(e) => pick(e.target.files)} />
    </div>
  );
}
