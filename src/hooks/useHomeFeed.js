import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

export function useHomeFeed(user) {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);


  const latestUserIdRef = useRef(user?.id);
  latestUserIdRef.current = user?.id;

  const loadFeed = useCallback(async () => {
    const userId = user?.id;
    if (!userId) return;
    setLoading(true);

    try {

      const { data: myTracks, error: myError } = await supabase
        .from("user_tracks")
        .select("*, tracks(*, track_metadata(*)), users!user_tracks_user_id_fkey(full_name, email)")
        .eq("user_id", userId);
      if (myError) throw myError;


      const { data: shares, error: sharesError } = await supabase
        .from("library_shares")
        .select("owner_id, users!library_shares_owner_id_fkey(full_name, email)")
        .eq("grantee_id", userId)
        .eq("status", "accepted");
      if (sharesError) throw sharesError;

      const sharedOwnerIds = shares?.map(share => share.owner_id) || [];

      let sharedTracksData = [];


      if (sharedOwnerIds.length > 0) {
        const { data: sTracks, error: sError } = await supabase
          .from("user_tracks")
          .select("*, tracks(*, track_metadata(*)), users!user_tracks_user_id_fkey(full_name, email)")
          .in("user_id", sharedOwnerIds);
        if (sError) throw sError;

        sharedTracksData = sTracks || [];
      }


      if (userId !== latestUserIdRef.current) return;


      const formattedMyTracks = (myTracks || []).map(track => ({
        ...track,
        isShared: false,
      }));

      const formattedSharedTracks = sharedTracksData.map(track => ({
        ...track,
        isShared: true,
        sharedBy: track.users?.full_name || track.users?.email || "A Friend",
      }));


      const mergedFeed = [...formattedMyTracks, ...formattedSharedTracks].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );

      setFeed(mergedFeed);
    } catch (error) {
      console.error("Error loading home feed:", error);
    } finally {
      if (userId === latestUserIdRef.current) {
        setLoading(false);
      }
    }
  }, [user]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  return { feed, loading, refetch: loadFeed };
}