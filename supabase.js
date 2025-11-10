// NOTE: In production, enable RLS and never expose service keys on client. This anon key is public.
// Supabase client init
// Uses @supabase/supabase-js v2 (loaded via CDN in admin.html)
const SUPABASE_URL = "https://iwnhakegtvwfdisruogr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3bmhha2VndHZ3ZmRpc3J1b2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExMjkzMTAsImV4cCI6MjA3NjcwNTMxMH0.gAjWu__1xdqH4HCjLx51DgAs0H7cQDyKwHhtYh4XOYY";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export { supabase };
