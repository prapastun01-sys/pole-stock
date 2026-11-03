# ระบบเบิกเสา (Pole Stock)

Next.js 14 + Supabase (ฐานข้อมูล) + Vercel (รันเว็บ) + Google Apps Script (เก็บรูปลง Drive / แจ้งเตือน Telegram)
ใช้งานได้ทุกอุปกรณ์ (มือถือ/แท็บเล็ต/คอม) และ "ติดตั้งเป็นแอป" ได้ (PWA)

```
เบราว์เซอร์ ──► Vercel (Next.js + API) ──► Supabase (ข้อมูล)
                         └──────────────► Google Apps Script ──► Google Drive (รูป)
                                                          └────► Telegram (แจ้งเตือน)
```
รูปถูกบีบเหลือ ≤ 1MB ที่เครื่องผู้ใช้ก่อนอัปโหลด ความลับทั้งหมด (service key, bot token) อยู่ฝั่งเซิร์ฟเวอร์

---------------------------------------------------------------------

## ขั้นตอนที่ 1 — Supabase
1. สมัคร https://supabase.com → **New project** (ตั้งรหัส DB, เลือก region Singapore)
2. เมนู **SQL Editor → New query** → วางเนื้อหาไฟล์ `supabase/schema.sql` ทั้งไฟล์ → **Run**
   (สร้างตาราง sites, pole_sizes, poles, withdrawals, view v_stock, ฟังก์ชันเบิกแบบ atomic, เปิด RLS, ใส่ขนาดเสาตั้งต้น)
3. **Project Settings → API** คัดลอก 2 ค่า:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (ห้ามเปิดเผย/ห้าม commit)

## ขั้นตอนที่ 2 — Google Drive + Apps Script
1. Google Drive สร้างโฟลเดอร์หลัก เช่น `ระบบเบิกเสา` เปิดโฟลเดอร์ แล้วคัดลอก **ID** จาก URL
   (`drive.google.com/drive/folders/`**`ตรงนี้คือ ID`**)
2. ไปที่ https://script.google.com → **โปรเจกต์ใหม่** → วางโค้ดจาก `gas/Code.gs` แทนของเดิม → บันทึก
3. **Project Settings (⚙) → Script properties → Add** ใส่ 4 ค่า:
   | Property | ค่า |
   |---|---|
   | `SECRET` | รหัสลับยาวๆ ตั้งเอง (จะใช้เป็น `GAS_SECRET` ใน Vercel) |
   | `ROOT_FOLDER_ID` | ID โฟลเดอร์จากข้อ 1 |
   | `TG_BOT_TOKEN` | ได้จากขั้นตอนที่ 3 |
   | `TG_CHAT_ID` | ได้จากขั้นตอนที่ 3 |
4. (ทำหลังได้ค่า Telegram) เลือกฟังก์ชัน `testSetup` → **Run** → กด Allow สิทธิ์ Drive/ภายนอก
   ต้องมีข้อความทดสอบเด้งในกลุ่ม Telegram
5. **Deploy → New deployment → Web app** → Execute as: **Me** · Who has access: **Anyone** → Deploy
   คัดลอก **Web app URL** (ลงท้าย `/exec`) → `GAS_URL`
   > ทุกครั้งที่แก้โค้ด Code.gs ต้อง Deploy → Manage deployments → Edit → New version

โครงสร้างโฟลเดอร์ที่ระบบสร้างให้อัตโนมัติ:
```
ระบบเบิกเสา/
 ├─ เสา/<จุดกอง>/<ขนาดเสา>/        ← รูปเสาตอนเพิ่มเข้ากอง
 └─ เบิกเสา/<ปี-เดือน>/<วันเวลา_ชื่องาน>/
      ├─ ก่อนขนเสา/
      └─ หลังขนเสา/
```
หมายเหตุ: ไฟล์ถูกตั้งเป็น "ทุกคนที่มีลิงก์ดูได้" เพื่อแสดงในเว็บ ถ้าบัญชี Google Workspace ขององค์กรห้ามแชร์สาธารณะ ให้ใช้บัญชี Gmail ส่วนตัวสร้างโฟลเดอร์/สคริปต์ หรือขอ admin อนุญาต

## ขั้นตอนที่ 3 — Telegram Bot
1. Telegram ค้นหา **@BotFather** → `/newbot` → ตั้งชื่อ → ได้ **token** → `TG_BOT_TOKEN`
2. สร้างกลุ่มแจ้งเตือน → เพิ่มบอทเข้ากลุ่ม → พิมพ์ข้อความอะไรก็ได้ในกลุ่ม 1 ข้อความ
3. เปิดเบราว์เซอร์ `https://api.telegram.org/bot<TOKEN>/getUpdates` → หา `"chat":{"id":-100xxxxxxxxxx` → ค่านั้นคือ `TG_CHAT_ID` (กลุ่มจะขึ้นต้นด้วย `-`)
   (ถ้าเป็นแชทส่วนตัว: กด Start กับบอทก่อน แล้วใช้ id ของตัวเอง)

## ขั้นตอนที่ 4 — GitHub
```bash
cd pole-stock
git init && git add . && git commit -m "init"
git branch -M main
git remote add origin https://github.com/<ชื่อคุณ>/pole-stock.git   # สร้าง repo เปล่า (Private) ก่อน
git push -u origin main
```
(`.env` ถูกกันไว้ใน `.gitignore` แล้ว ห้ามอัปความลับขึ้น GitHub)

## ขั้นตอนที่ 5 — Vercel
1. https://vercel.com → **Add New → Project** → Import repo `pole-stock` (Framework: Next.js ตรวจอัตโนมัติ)
2. **Environment Variables** ใส่ตาม `.env.example`:
   `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GAS_URL`, `GAS_SECRET`, `APP_PASSCODE`, `NEXT_PUBLIC_APP_URL`
   (`APP_PASSCODE` = รหัสที่ทีมใช้เข้าเว็บ; `NEXT_PUBLIC_APP_URL` ใส่ได้หลังรู้โดเมน แล้ว Redeploy)
3. **Deploy** — เสร็จแล้วได้ URL `https://xxx.vercel.app` ทุกครั้งที่ `git push` ระบบ deploy ใหม่เอง

## ทดลองรันในเครื่อง (ไม่บังคับ)
```bash
cp .env.example .env.local   # แก้ค่าให้ครบ
npm install
npm run dev                  # http://localhost:3000
```

---------------------------------------------------------------------

## วิธีใช้งาน
**เพิ่มเสา:** เมนู 📍จุดกอง → เพิ่มจุดกอง (ชื่อ + พิกัด วางจาก Google Maps หรือกด GPS) → ➕เพิ่มเสา → เลือกจุดกอง → ขนาด → อัปรูปเสา → สร้างเลขเสา → บันทึก
- โหมด **ตามชั้น**: ชั้น `42` เริ่ม `1` จำนวน `5` หลัก `2` → 4201, 4202, 4203, 4204, 4205
- โหมด **กรอกเอง**: พิมพ์เลขคั่นด้วย , หรือเว้นวรรค
- เลขเสาห้ามซ้ำทั้งระบบ (ระบบจะแจ้งเลขที่ซ้ำ)

**เบิกเสา:** 📦เบิกเสา
- พิมพ์เลขเสาในช่อง 🔎 → เห็นว่าอยู่กองไหน → กด "เบิกเสานี้" ระบบเลือกกอง/ขนาด/ติ๊กเสาให้
- หรือเลือกจุดกอง → ขนาด → ติ๊กเลขเสาหลายต้น → กรอกชื่องาน, WBS/ใบสั่ง, โครงข่าย, ผู้รับผิดชอบ, ทีมงาน → แนบรูปก่อน/หลังขน → ยืนยัน
- สำเร็จแล้ว: ตัดยอดเสา + บันทึกรูปลง Drive + แจ้ง Telegram ทันที
- ป้องกันเบิกซ้ำ: ถ้ามีคนเบิกเสาต้นเดียวกันพร้อมกัน ใบที่ช้ากว่าจะถูกปฏิเสธทั้งใบ

**สรุป (Dashboard):** จำนวนจุดกอง เสาทั้งหมด/คงเหลือ/เบิกแล้ว ยอดตามขนาด และตารางจุดกอง × ขนาด
**ประวัติ:** รายการเบิกล่าสุด 50 ใบ พร้อมรูปก่อน/หลัง (กดดูรูปเต็มใน Drive)

**ติดตั้งเป็นแอปบนมือถือ:** iPhone: Safari → แชร์ → Add to Home Screen · Android: Chrome → ⋮ → Install app

---------------------------------------------------------------------

## ปรับแต่ง
| ต้องการ | แก้ที่ |
|---|---|
| รูปแบบเลขเสา | `buildNumbers()` ใน `app/poles/new/page.tsx` |
| ไม่บังคับรูปก่อน/หลัง | `REQUIRE_PHOTOS = false` ใน `app/withdraw/page.tsx` |
| ขนาดเสาตั้งต้น | ท้ายไฟล์ `supabase/schema.sql` หรือเพิ่มในหน้า จุดกอง |
| ข้อความ Telegram | `app/api/withdraw/route.ts` |
| ขนาดรูปสูงสุด | `MAX_BYTES` ใน `lib/client.ts` |

## แก้ปัญหาเบื้องต้น
- **หน้า Dashboard ขึ้น error** → ยังไม่ได้รัน schema.sql หรือ env Supabase ผิด
- **อัปรูปไม่ได้ / unauthorized** → `GAS_SECRET` ต้องตรงกับ `SECRET` ใน Script properties; Web app ต้องตั้ง Anyone; แก้โค้ดแล้วต้อง deploy เวอร์ชันใหม่
- **รูปไม่แสดง** → ไฟล์ใน Drive ไม่ได้แชร์สาธารณะ (ดูหมายเหตุ Workspace ด้านบน)
- **Telegram ไม่เด้ง** → รัน `testSetup` ดู Logs; ตรวจว่าบอทอยู่ในกลุ่มและ chat id ถูก
- **เบิกแล้วขึ้น "บางต้นถูกเบิกไปแล้ว"** → มีคนเบิกก่อน รีเฟรชแล้วเลือกใหม่

## ความปลอดภัย
- RLS เปิดและไม่มี policy → anon key อ่าน/เขียนฐานข้อมูลตรงไม่ได้ ทุกอย่างผ่าน API ฝั่งเซิร์ฟเวอร์
- เข้าเว็บต้องใส่รหัส (`APP_PASSCODE`) — เป็นรหัสร่วมกันทั้งทีม ถ้าต้องการแยกผู้ใช้/สิทธิ์ ให้ต่อยอดด้วย Supabase Auth

---------------------------------------------------------------------

## ไฟล์อัปเดตฐานข้อมูล (รันตามลำดับใน Supabase SQL Editor หลังติดตั้ง schema.sql เวอร์ชันเก่า)
| ไฟล์ | สิ่งที่เพิ่ม |
|---|---|
| `migration_002_site_pile.sql` | จุดเดียวมีหลายกอง (ช่อง "กอง") |
| `migration_003_stack_layout.sql` | ชั้น/ลำดับของเสาในกอง |
| `migration_004_multi_pile_withdraw.sql` | ใบเบิกเบิกได้หลายกอง/หลายขนาด |
| `migration_005_zone_kind_done.sql` | Zone ต่อชื่อจุด, ประเภทเสา (ใหม่/รื้อถอน/หมดอายุ/หัก/รับฝาก), งานเสร็จ + เลขใบตัดงาน |
| `migration_006_doc_no.sql` | เลขที่ใบเบิกรันอัตโนมัติ (ใบเบิก PDF) |

(ติดตั้งใหม่ทั้งระบบ: รัน `schema.sql` ไฟล์เดียวพอ เพราะรวมทุกอย่างไว้แล้ว)
