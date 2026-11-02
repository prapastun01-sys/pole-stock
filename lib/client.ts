// ฟังก์ชันฝั่งเบราว์เซอร์: บีบอัดรูป + อัปโหลด
export const MAX_BYTES = 1024 * 1024 - 20 * 1024; // < 1 MB

export type Photo = { id: string; blob: Blob; preview: string; name: string };

/** บีบรูปให้ไม่เกิน ~1MB: ลดขนาดด้านยาวสุด + ลดคุณภาพ JPEG ทีละขั้น */
export async function compressImage(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as any);
  let maxSide = 1920;
  let quality = 0.82;
  let blob: Blob | null = null;

  for (let i = 0; i < 12; i++) {
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/jpeg", quality));
    if (blob.size <= MAX_BYTES) break;
    if (quality > 0.5) quality -= 0.1;
    else maxSide = Math.round(maxSide * 0.8);
  }
  bmp.close?.();
  return blob!;
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(",")[1]);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

export async function uploadPhoto(photo: Photo, folder: string[], filename: string) {
  const data = await toBase64(photo.blob);
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder, filename, mimeType: "image/jpeg", data }),
  });
  const j = await res.json();
  if (!res.ok || !j.ok) throw new Error(j.error || "อัปโหลดรูปไม่สำเร็จ");
  return { id: j.id as string, url: j.url as string };
}

export async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, { cache: "no-store", ...init });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `ผิดพลาด (${res.status})`);
  return j;
}

export function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    month: `${d.getFullYear()}-${p(d.getMonth() + 1)}`,
    full: `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`,
  };
}
