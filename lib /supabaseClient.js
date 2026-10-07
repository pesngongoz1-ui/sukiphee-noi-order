import { createClient } from '@supabase/supabase-js';

// ดึงค่าจาก Environment Variable ก่อน ถ้าไม่มีให้ใช้ค่า URL/Key ที่กำหนดไว้เป็น fallback
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://mpsfzmeifugujjanwind.supabase.co';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wc2Z6bWVpZnVndWpqYW53aW5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNDQ3ODEsImV4cCI6MjEwNjkyMDc4MX0.t0flSYXsjcWd0n5nyELtiS4u8EjZaX2nX_RzLH0NZO8';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
