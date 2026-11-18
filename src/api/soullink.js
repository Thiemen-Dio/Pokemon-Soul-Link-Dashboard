// Reading and saving Soul Link runs in Supabase.
import { supabase } from './supabase.js'

function check({ data, error }) {
  if (error) throw new Error(error.message)
  return data
}

function db() {
  if (!supabase) throw new Error('Supabase is not configured (see .env)')
  return supabase
}

export async function getRuns() {
  return check(await db().from('runs').select('*').order('created_at', { ascending: true }))
}

export async function updateRun(id, fields) {
  return check(await db().from('runs').update(fields).eq('id', id).select().single())
}

export async function getEncounters(runId) {
  return check(
    await db().from('encounters').select('*').eq('run_id', runId).order('sort_order', { ascending: true }),
  )
}

/**
 * Save changes to one area (one linked pair). Creates the row the first time.
 * Only the given fields are written, so two quick edits never overwrite each other.
 */
export async function saveEncounter(runId, area, sortOrder, changes) {
  const fields = { run_id: runId, area, sort_order: sortOrder, ...changes }
  for (const k of ['p1_nickname', 'p2_nickname']) if (k in fields) fields[k] = fields[k] || null
  return check(
    await db().from('encounters').upsert(fields, { onConflict: 'run_id,area' }).select().single(),
  )
}

export async function deleteEncounter(id) {
  check(await db().from('encounters').delete().eq('id', id))
}

/** Call onChange whenever anyone changes this run's encounters or the runs list. */
export function subscribeToRun(runId, onChange) {
  if (!supabase) return () => {}
  const channel = supabase
    .channel(`run-${runId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'encounters', filter: `run_id=eq.${runId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'runs' }, onChange)
    .subscribe()
  return () => supabase.removeChannel(channel)
}
