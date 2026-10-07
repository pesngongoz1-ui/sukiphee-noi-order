# สุกี้ผีน้อย — ระบบสั่งอาหารร้านบุฟเฟต์

## Stack
- Next.js (App Router) + **JavaScript** (ไม่ใช้ TypeScript)
- Deploy บน Vercel
- ฐานข้อมูล: Supabase (`lib/supabaseClient.js`)
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ใส่ใน `.env.local` และใน Vercel Project Settings)

## กฎสำคัญ: Dynamic Route params เป็น Promise
โปรเจกต์นี้ใช้ Next.js เวอร์ชันล่าสุด ซึ่ง `params` ของ Dynamic Route (เช่น `app/order/[sessionId]/page.js`) เป็น **Promise** ต้อง unwrap เสมอ ห้ามอ่านค่าตรง ๆ เช่น `params.sessionId`

```js
"use client";
import { use } from "react";

export default function OrderPage({ params }) {
  const { sessionId } = use(params); // unwrap ด้วย use() จาก React
  // ...
}
```

หมายเหตุ: ใน Server Component ที่เป็น `async` ให้ใช้ `const { sessionId } = await params;` แทน (ใช้ `use()` กับหน้าที่เป็น Client Component)

## โครงสร้างตารางฐานข้อมูล Supabase (มีอยู่แล้ว ไม่ต้องสร้างใหม่)
ใช้อ้างอิงตลอดทั้งโปรเจกต์ ห้ามเดาชื่อคอลัมน์นอกเหนือจากนี้

| ตาราง | คอลัมน์ |
|---|---|
| `sessions` | id, table_number, adult_count, child_count, status, created_at |
| `menu_categories` | id, name, sort_order |
| `menu_items` | id, category_id, name |
| `orders` | id, session_id, table_number, items (jsonb), status, created_at |

ความสัมพันธ์: `menu_items.category_id` → `menu_categories.id`, `orders.session_id` → `sessions.id`

## Scripts
- `npm run dev` / `npm run build` / `npm run start`
