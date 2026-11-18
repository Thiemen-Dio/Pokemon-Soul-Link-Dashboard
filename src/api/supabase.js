// Connection to the shared Supabase database that holds the Soul Link runs.
// The URL and public key come from the .env file in the project folder.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.warn('Supabase is not configured: add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env')
}

export const supabase = url && key ? createClient(url, key) : null
