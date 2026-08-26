import { supabase } from "@/lib/supabaseClient";

export async function deleteTrackAndDriveFile(trackId) {
  const { data, error } = await supabase.functions.invoke("delete-track", {
    body: { trackId },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return true;
}