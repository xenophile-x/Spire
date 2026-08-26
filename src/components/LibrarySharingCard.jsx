import React, { useState, useEffect } from "react";
import { GlassCard } from "@/components/ui/glasscn/glass-card";
import { LiquidGlass } from "@/components/ui/glasscn/liquid-glass";
import { GlassButton } from "@/components/ui/glasscn/glass-button";
import { supabase } from "@/lib/supabaseClient";
import "material-symbols/rounded.css";

export default function LibrarySharingCard({ user }) {
  const [emailInput, setEmailInput] = useState("");
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.id) fetchPartners();

  }, [user?.id]);

  const fetchPartners = async () => {
    const { data } = await supabase
      .from("library_shares")
      .select("*")
      .eq("owner_id", user.id);
    setPartners(data || []);
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    setLoading(true);
    const targetEmail = emailInput.trim().toLowerCase();


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

    setLoading(false);

    if (error) {
      alert(error.message);
    } else {
      setEmailInput("");
      fetchPartners();
    }
  };

  const handleRevoke = async (shareId) => {
    await supabase.from("library_shares").delete().eq("id", shareId);
    fetchPartners();
  };

  return (
    <GlassCard
      glassVariant="liquid-refract"
      liquidProps={{
        blur: 14,
        refraction: 15,
        className: "rounded-3xl [--liquid-glass-rim-light:rgba(255,255,255,0.4)]",
      }}
      className="w-full gap-0 overflow-hidden py-0 my-auto"
    >
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <LiquidGlass
          blur={6}
          refraction={8}
          className="flex h-10 w-10 items-center justify-center rounded-full [--liquid-glass-rim-light:rgba(255,255,255,0.5)]"
        >
          <span className="material-symbols-rounded text-xl text-white/90">group</span>
        </LiquidGlass>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-white">Library Sharing</h2>
          <p className="text-[10px] font-medium text-white/50">
            Grant access to stream your music library via Gmail
          </p>
        </div>
        {partners.length > 0 && (
          <LiquidGlass
            blur={4}
            refraction={4}
            className="ml-auto rounded-full px-2 py-0.5 [--liquid-glass-rim-width:0.5px]"
          >
            <span className="text-[10px] font-semibold tracking-wider text-white/80">
              {partners.length} SHARED
            </span>
          </LiquidGlass>
        )}
      </div>

      <div className="divide-y divide-white/10 border-t border-white/10">

        <form onSubmit={handleInvite} className="flex items-center gap-2 px-5 py-3">
          <LiquidGlass
            blur={5}
            refraction={5}
            className="flex-1 rounded-xl p-0.5 [--liquid-glass-rim-width:0.5px]"
          >
            <input
              type="email"
              placeholder="Enter friend's Gmail..."
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              required
              className="w-full rounded-lg bg-transparent px-3 py-2 text-xs font-medium text-white outline-none placeholder-white/40"
            />
          </LiquidGlass>
          <GlassButton
            type="submit"
            disabled={loading}
            glassVariant="liquid-refract"
            className="shrink-0 rounded-xl px-4 py-2 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-40"
          >
            {loading ? "Inviting..." : "Invite"}
          </GlassButton>
        </form>


        {partners.length > 0 && (
          <div className="divide-y divide-white/5">
            {partners.map((partner) => (
              <div
                key={partner.id}
                className="flex items-center justify-between gap-3 px-5 py-2.5"
              >
                <span className="min-w-0 truncate text-xs font-medium text-white/80">
                  {partner.grantee_email}
                </span>
                <div className="flex shrink-0 items-center gap-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      partner.status === "accepted"
                        ? "bg-emerald-400/15 text-emerald-300"
                        : "bg-amber-400/15 text-amber-300"
                    }`}
                  >
                    {partner.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRevoke(partner.id)}
                    className="cursor-pointer text-white/40 transition-colors hover:text-red-400"
                    title="Revoke Access"
                    aria-label={`Revoke access for ${partner.grantee_email}`}
                  >
                    <span className="material-symbols-rounded text-base leading-none">close</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
