// Menggunakan Supabase dari CDN untuk Vanilla JS (ES Modules)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// TODO: Gantikan dengan URL dan Key dari dashboard Supabase anda
const supabaseUrl = 'https://gevftxdqyrejnjovurjt.supabase.co'; 
const supabaseKey = 'sb_publishable_YJib5aDM3gt49N6j25XLLw_LGdoNxvy';

export const supabase = createClient(supabaseUrl, supabaseKey);