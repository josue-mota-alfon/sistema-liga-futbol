import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://cqwkybkmckkumururqtd.supabase.co";
const SUPABASE_KEY = "sb_publishable_E6BxrW9YGQPGuNIQ1PLNgg_Cg1QwRGO";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);