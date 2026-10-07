import { createClient } from '@supabase/supabase-js';

// ดึงค่าจาก Environment Variable ก่อน ถ้าไม่มีให้ใช้ค่า URL/Key ที่กำหนดไว้เป็น fallback
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://cybtcaefaijooiotzlmv.supabase.co';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5YnRjYWVmYWlqb29pb3R6bG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNDY4NTYsImV4cCI6MjEwNjkyMjg1Nn0.t-8xnn2IWm2pUzCiok2P2UNSUpgQ-7HDgFCBlHM4n-0';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
