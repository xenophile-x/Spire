import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { GlassCard } from "@/components/ui/glasscn/glass-card";
import { GlassInput } from "@/components/ui/glasscn/glass-input";
import { GlassButton } from "@/components/ui/glasscn/glass-button";
import { GlassIcon } from "@/components/ui/glasscn/glass-icon";
import { GlassBadge } from "@/components/ui/glasscn/glass-badge";
import { GlassSeparator } from "@/components/ui/glasscn/glass-separator";
import { LiquidGlass } from "@/components/ui/glasscn/liquid-glass";

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
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!targetEmail || !EMAIL_RE.test(targetEmail) || targetEmail.length > 254) {
      setNotice("Enter a valid email address.");
      return;
    }
    if (targetEmail === user.email.toLowerCase()) {
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
    <GlassCard
      glassVariant="liquid-refract"
      liquidProps={{
        blur: 14,
        refraction: 6,
        className: "rounded-3xl glass-rim-bright [--liquid-glass-rim-light:rgba(255,255,255,0.42)] [--liquid-glass-rim-width:1.2px]",
      }}
      className="gap-0 overflow-hidden py-0 flex flex-col"
    >
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <GlassIcon size="sm" className="shrink-0 pointer-events-none bg-white/10">
          <span className="material-symbols-rounded text-xl text-white" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
        </GlassIcon>
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-white">Library Sharing</h3>
          <p className="text-[11px] font-medium text-white/60">Grant access to stream your music library via Gmail</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5 pt-3 text-white">
        {loadError && (
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-xs font-medium text-white">{loadError}</span>
            <GlassButton onClick={loadAllSharingData} glassVariant="liquid-refract" className="shrink-0 rounded-full px-3 py-1 text-[11px] font-medium">
              Retry
            </GlassButton>
          </div>
        )}

        {notice && (
          <span className="text-xs font-medium text-white px-1">{notice}</span>
        )}

        {incomingInvites.length > 0 && (
          <LiquidGlass
            blur={10}
            refraction={18}
            saturation={1.6}
            className="rounded-2xl p-3.5 flex flex-col gap-2 border border-white/20 bg-white/10 [--liquid-glass-rim-light:rgba(255,255,255,0.7)] shadow-lg shadow-black/10"
          >
            <span className="text-[11px] font-bold tracking-wider uppercase text-amber-300">
              Received Access Invites
            </span>
            {incomingInvites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between gap-2 text-xs pt-1">
                <span className="text-white/90 truncate">
                  <strong className="text-white">{invite.users?.full_name || invite.users?.email}</strong> invited you to their library.
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <GlassButton
                    onClick={() => handleAcceptInvite(invite.id)}
                    disabled={busyId === invite.id}
                    glassVariant="liquid-refract"
                    className="rounded-full px-4 py-1.5 text-xs font-bold bg-white/20 text-white border border-white/30 shadow-md hover:bg-white/30 disabled:opacity-50 transition-colors"
                  >
                    {busyId === invite.id ? "..." : "Accept"}
                  </GlassButton>
                  <GlassButton
                    onClick={() => handleRemoveShare(invite.id)}
                    disabled={busyId === invite.id}
                    glassVariant="liquid-refract"
                    className="rounded-full px-3 py-1 text-xs font-medium text-white/70 hover:bg-white/10 disabled:opacity-50 transition-colors"
                  >
                    Decline
                  </GlassButton>
                </div>
              </div>
            ))}
          </LiquidGlass>
        )}

        <form onSubmit={handleSendInvite} className="flex items-center gap-2">
  <div className="flex-1">
    <GlassInput
      type="email"
      placeholder="Enter friend's Gmail..."
      value={emailInput}
      onChange={(e) => setEmailInput(e.target.value)}
      required
      className="w-full rounded-full h-11 text-xs placeholder:text-white/50 text-white bg-white/5 border-white/10 glass-rim-default"
    />
  </div>
  <GlassButton
    type="submit"
    disabled={loading}
    glassVariant="liquid-refract"
    className="h-11 w-11 shrink-0 rounded-full flex items-center justify-center text-white hover:bg-white/10 disabled:opacity-40 p-0 glass-rim-default"
    aria-label="Send invite"
  >
    {loading ? (
      <span className="material-symbols-rounded text-xl animate-spin">progress_activity</span>
    ) : (
      <span className="material-symbols-rounded text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>arrow_forward</span>
    )}
  </GlassButton>
</form>

        {outgoingShares.length > 0 && (
          <div className="flex flex-col gap-2">
            <GlassSeparator className="my-1" />
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
              Sent Invites
            </span>
            {outgoingShares.map((share) => (
              <LiquidGlass key={share.id} className="flex items-center justify-between text-xs py-2 px-3 rounded-xl border border-white/10 bg-white/[0.04] [--liquid-glass-rim-width:0.5px]">
                <span className="text-white/80 font-mono text-[11px] truncate mr-2">{share.grantee_email}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {share.status === 'pending' && (
                    <GlassBadge className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border-0  text-white-300">
                      Pending
                    </GlassBadge>
                  )}
                  <button
                    className="flex !h-7 !w-7 items-center justify-center shrink-0 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                    onClick={() => handleRemoveShare(share.id)}
                  >
                    <span className="text-xs">✕</span>
                  </button>
                </div>
              </LiquidGlass>
            ))}
          </div>
        )}

        {acceptedLibraries.length > 0 && (
          <div className="flex flex-col gap-2">
            <GlassSeparator className="my-1" />
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
              Libraries Accessible To You
            </span>
            {acceptedLibraries.map((lib) => (
              <LiquidGlass key={lib.id} className="flex items-center justify-between text-xs py-2.5 px-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 [--liquid-glass-rim-width:0.5px]">
                <span className="text-emerald-200 font-medium truncate">{lib.users?.full_name || lib.users?.email}'s Library</span>
              </LiquidGlass>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
