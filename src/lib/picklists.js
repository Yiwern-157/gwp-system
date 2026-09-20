import { supabase } from '../supabaseClient'

// Type / Campaign Tag / Platform are all rows in picklist_options so an
// Admin can add or remove options later without touching the schema.
// See the ERD doc, section "Lookup and configuration tables".
export async function fetchPicklist(listType) {
  const { data, error } = await supabase
    .from('picklist_options')
    .select('code, label, description')
    .eq('list_type', listType)
    .eq('active', true)
    .order('label', { ascending: true })
  if (error) throw error
  return data
}

// Country is a fixed CHECK constraint in the schema, not a picklist,
// since it wasn't flagged as something that needs admin editing.
export const COUNTRIES = ['AU', 'MY', 'PH', 'SG', 'US']
