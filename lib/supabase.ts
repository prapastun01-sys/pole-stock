import { createClient } from "@supabase/supabase-js";

// ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น (service_role ข้าม RLS)
// สำคัญ: บังคับ no-store ทุก request เพราะ Next.js 14 แคชผล fetch ไว้ ทำให้ข้อมูลเก่าค้าง
export function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, cache: "no-store" }),
      },
    }
  );
}
