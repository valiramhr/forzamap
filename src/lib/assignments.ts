import { supabase } from "./supabase";

export const STRENGTHS_SLUG = "strengths-profile";
export const PARADOX_SLUG = "paradox-profile";

/* Where a candidate sits each instrument. An instrument in the catalogue with
   no entry here has no page to send anyone to, so the landing chooser skips it. */
export const INSTRUMENT_PATH: Record<string, string> = {
  [STRENGTHS_SLUG]: "/assessment",
  [PARADOX_SLUG]: "/paradox",
};

/** Id of this candidate's assignment for one instrument, or null if they have none. */
export async function findAssignment(candidateId: string, slug: string): Promise<string | null> {
  const { data: instrument } = await supabase
    .from("instruments").select("id").eq("slug", slug).maybeSingle();
  if (!instrument) return null;

  const { data } = await supabase.from("assignments").select("id")
    .eq("candidate_id", candidateId).eq("instrument_id", instrument.id).maybeSingle();
  return data?.id ?? null;
}
