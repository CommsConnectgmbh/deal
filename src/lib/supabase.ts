import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// When env vars are missing (e.g. misconfigured preview deploy), fail loud
// and early with a clear message instead of crashing deep inside a query
// with an opaque "cannot read property of null" error.
function makeMissingEnvStub(): any {
  const fail = () => {
    throw new Error(
      '[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. ' +
      'Configure the Supabase environment variables for this deployment.'
    )
  }
  return new Proxy({}, { get: fail, apply: fail })
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : makeMissingEnvStub()
