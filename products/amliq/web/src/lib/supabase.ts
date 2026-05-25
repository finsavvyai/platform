import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});

export type DemoLead = {
  email: string;
  company?: string;
  use_case?: string;
  source?: string;
};

export async function submitDemoLead(lead: DemoLead) {
  return supabase.from('demo_leads').insert({
    email: lead.email,
    company: lead.company ?? '',
    use_case: lead.use_case ?? '',
    source: lead.source ?? 'hero',
  });
}
