import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";


export function LibrarySharing({ user }) {
  const [emailInput, setEmailInput] = useState("");
  const [outgoingShares, setOutgoingShares] = useState([]);
  const [incomingInvites, setIncomingInvites] = useState([]);
  const [acceptedLibraries, setAcceptedLibraries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState("");
  const channelRef = useRef(null);

  async function loadAllSharingData() {
    setLoadError(null);
    try {
      const myEmail = user.email.toLowerCase();

      const { data: incoming, error: incomingError } = await supabase
        .from("library_shares")
        .select("id, status, owner_id, users:owner_id (full_name, email)")
        .eq("grantee_email", myEmail)
        .eq("status", "pending");
      if (incomingError) throw incomingError;
      setIncomingInvites(incoming || []);

      const { data: accepted, error: acceptedError } = await supabase
        .from("library_shares")
        .select("id, owner_id, users:owner_id (full_name, email)")
        .eq("grantee_email", myEmail)
        .eq("status", "accepted")
        .or("expires_at.is.null,expires_at.gt.now()");
      if (acceptedError) throw acceptedError;
      setAcceptedLibraries(accepted || []);

      const { data: outgoing, error: outgoingError } = await supabase
        .from("library_shares")
        .select("*")
        .eq("owner_id", user.id);
      if (outgoingError) throw outgoingError;
      setOutgoingShares(outgoing || []);
    } catch (err) {
      console.error("[LibrarySharing] Failed to load sharing data:", err);
      setLoadError("Couldn't load sharing data. Try again.");
    }
  }

  useEffect(() => {
    if (!user?.id) return;
    loadAllSharingData();

    const channel = supabase
      .channel(`library-sharing:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "library_shares", filter: `owner_id=eq.${user.id}` },
        () => loadAllSharingData()
      )
      .subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id]);

  const handleSendInvite = async (e) => {
    e.preventDefault();
    const targetEmail = emailInput.trim().toLowerCase();
    if (!targetEmail || targetEmail === user.email.toLowerCase()) {
      setNotice("You can't invite yourself.");
      return;
    }

    setLoading(true);
    setNotice("");

    try {
      const { data: existing } = await supabase
        .from("library_shares")
        .select("id, status")
        .eq("owner_id", user.id)
        .eq("grantee_email", targetEmail)
        .maybeSingle();

      if (existing) {
        setNotice(
          existing.status === "pending"
            ? `${targetEmail} already has a pending invite.`
            : `${targetEmail} already has access to your library.`
        );
        return;
      }

      const { data: targetUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", targetEmail)
        .maybeSingle();

      const { error } = await supabase.from("library_shares").insert({
        owner_id: user.id,
        grantee_email: targetEmail,
        grantee_id: targetUser?.id || null,
        status: "pending",
      });

      if (error) throw error;

      setEmailInput("");
      await loadAllSharingData();
    } catch (err) {
      console.error("[LibrarySharing] Invite failed:", err);
      setNotice("Couldn't send the invite. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async (inviteId) => {
    if (busyId) return;
    setBusyId(inviteId);
    try {
      const { error } = await supabase
        .from("library_shares")
        .update({
          status: "accepted",
          grantee_id: user.id,
        })
        .eq("id", inviteId)
        .eq("grantee_email", user.email.toLowerCase());

      if (error) {
        alert("Failed to accept invite: " + error.message);
      } else {
        await loadAllSharingData();
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleRemoveShare = async (shareId) => {
    if (busyId) return;
    setBusyId(shareId);
    try {
      const isOutgoing = outgoingShares.some((s) => s.id === shareId);
      const query = supabase.from("library_shares").delete().eq("id", shareId);
      const { error } = isOutgoing
        ? await query.eq("owner_id", user.id)
        : await query.eq("grantee_email", user.email.toLowerCase());

      if (error) {
        alert("Failed to remove share: " + error.message);
        return;
      }
      await loadAllSharingData();
    } finally {
      setBusyId(null);
    }
  };


  return (
    <div className="w-full rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-5 flex flex-col gap-4 text-white">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/80">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold tracking-wide">Library Sharing</h3>
          <p className="text-xs text-white/50">Grant access to stream your music library via Gmail</p>
        </div>
      </div>

      {loadError && (
        <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
          <span className="text-xs text-red-300">{loadError}</span>
          <button
            onClick={loadAllSharingData}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 text-xs font-medium rounded-full transition-all shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {notice && (
        <span className="text-xs text-amber-300">{notice}</span>
      )}

      {incomingInvites.length > 0 && (
        <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <span className="text-[11px] font-bold tracking-wider uppercase text-amber-300">
            Received Access Invites
          </span>
          {incomingInvites.map((invite) => (
            <div key={invite.id} className="flex items-center justify-between gap-2 text-xs pt-1">
              <span className="text-white/90 truncate">
                <strong className="text-white">{invite.users?.full_name || invite.users?.email}</strong> invited you to their library.
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleAcceptInvite(invite.id)}
                  disabled={busyId === invite.id}
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-full transition-all text-xs shadow-md disabled:opacity-50"
                >
                  {busyId === invite.id ? "..." : "Accept"}
                </button>
                <button
                  onClick={() => handleRemoveShare(invite.id)}
                  disabled={busyId === invite.id}
                  className="px-2 py-1 text-white/40 hover:text-white transition-all text-xs disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSendInvite} className="flex items-center gap-2">
        <input
          type="email"
          placeholder="Enter friend's Gmail..."
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition-all"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-xs font-medium text-white transition-all disabled:opacity-50"
        >
          {loading ? "Sending..." : "Invite"}
        </button>
      </form>

      {outgoingShares.length > 0 && (
        <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
            Sent Invites
          </span>
          {outgoingShares.map((share) => (
            <div key={share.id} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-xl bg-black/20 border border-white/5">
              <span className="text-white/80 font-mono text-[11px]">{share.grantee_email}</span>
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  share.status === 'accepted' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {share.status}
                </span>
                <button
                  onClick={() => handleRemoveShare(share.id)}
                  disabled={busyId === share.id}
                  className="text-white/30 hover:text-red-400 text-xs transition-colors disabled:opacity-50"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {acceptedLibraries.length > 0 && (
        <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
            Libraries Accessible To You
          </span>
          {acceptedLibraries.map((lib) => (
            <div key={lib.id} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-emerald-300 font-medium">{lib.users?.full_name || lib.users?.email}'s Library</span>
              <span className="text-[10px] text-emerald-400/80 font-bold uppercase">Connected</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
