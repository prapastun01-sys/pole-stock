"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, compressImage, uploadPhoto, stamp, Photo } from "@/lib/client";
import { notify } from "@/lib/status";

// เปลี่ยนรูปกองเต็ม (กรณีอัปผิด) — เลือกรูปใหม่แล้วแทนที่รูปเดิมของกองนั้น
export default function ChangeFullPhoto({ siteId, label, has }: { siteId: string; label: string; has: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (has && !(await confirmReplace())) return;
    setBusy(true); notify("กำลังอัปโหลดรูปกองเต็ม...");
    try {
      const blob = await compressImage(f);
      const up = await uploadPhoto({ id: "", blob, preview: "", name: f.name } as Photo, ["เสา", label || "กอง"], `กอง_${stamp().full}.jpg`);
      await api("/api/piles/full-photo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ site_id: siteId, photo_id: up.id, photo_url: up.url }) });
      notify("✅ เปลี่ยนรูปกองเต็มแล้ว");
      router.refresh();
    } catch (err: any) { notify("❌ " + (err?.message || "เปลี่ยนรูปไม่สำเร็จ")); }
    setBusy(false);
  }

  return (
    <>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={pick} />
      <button type="button" disabled={busy} className="mt-1 text-xs text-brand underline disabled:opacity-50" onClick={() => ref.current?.click()}>
        {has ? "✏️ เปลี่ยนรูป" : "➕ เพิ่มรูป"}
      </button>
    </>
  );
}
function confirmReplace() { return Promise.resolve(window.confirm("แทนที่รูปกองเต็มเดิมด้วยรูปใหม่?")); }
