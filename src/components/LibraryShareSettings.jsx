import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { requestGoogleAuthCode } from "@/lib/googleTokenClient";

export default function LibraryShareSettings({ user }) {
  const [isPublic, setIsPublic] = useState(false);
  const [shareToken, setShareToken] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [connectingDrive, setConnectingDrive] = useState(false);
  const [driveConnectMsg, setDriveConnectMsg] = useState(null);

  const handleConnectDriveOffline = async () => {
    if (connectingDrive) return;
    setConnectingDrive(true);
    setDriveConnectMsg(null);
    try {
      const code = await requestGoogleAuthCode();

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("You are not signed in.");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/store-google-token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ code }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Token storage failed (${res.status}).`);
      }

      setDriveConnectMsg({
        ok: true,
        msg: "Connected! Friends can now stream your library even when you're offline.",
      });
    } catch (err) {
      const code = err?.code;
      if (code === "popup_closed_by_user" || code === "access_denied") {
        setDriveConnectMsg(null);
      } else {
        console.error("[LibraryShareSettings] Drive connect failed:", err);
        setDriveConnectMsg({ ok: false, msg: err.message || "Couldn't connect Google Drive." });
      }
    } finally {
      setConnectingDrive(false);
    }
  };

  async function fetchShareToken(userId) {
    const { data, error } = await supabase
      .from("user_share_tokens")
      .select("share_token")
      .eq("user_id", userId)
      .maybeSingle();

    if (!error && data?.share_token) return data.share_token;

    if (!error && !data) {
      const { data: created } = await supabase
        .from("user_share_tokens")
        .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true })
        .select("share_token")
        .maybeSingle();
      if (created?.share_token) return created.share_token;
      
      // If upsert didn't return data (ignoreDuplicates), fetch it
      const { data: existing } = await supabase
        .from("user_share_tokens")
        .select("share_token")
        .eq("user_id", userId)
        .maybeSingle();
      if (existing?.share_token) return existing.share_token;
    }

    return "";
  }

  useEffect(() => {
    async function fetchUserSettings() {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("users")
          .select("is_library_public")
          .eq("id", user.id)
          .single();

        if (error) throw error;
        if (data) {
          setIsPublic(data.is_library_public || false);
          setShareToken(await fetchShareToken(user.id));
        }
      } catch (err) {
        console.error("[LibraryShareSettings] Failed to load settings:", err);
        setLoadError("Couldn't load sharing settings.");
      } finally {
        setLoading(false);
      }
    }
    fetchUserSettings();
  }, [user?.id]);

  const shareUrl = shareToken
    ? `${window.location.origin}/share/${shareToken}`
    : "";

  const handleToggleShare = async () => {
    if (saving) return;
    const nextState = !isPublic;
    setIsPublic(nextState);
    setSaving(true);

    const { error } = await supabase
      .from("users")
      .update({ is_library_public: nextState })
      .eq("id", user.id);

    setSaving(false);
    if (error) {
      setIsPublic(!nextState);
      alert("Failed to update sharing settings.");
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        const input = document.createElement("textarea");
        input.value = shareUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        alert("Couldn't copy the link. Please copy it manually.");
      }
    }
  };

  if (loading) return <div className="text-xs text-white/50">Loading settings...</div>;

  if (loadError) {
    return (
      <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
        {loadError}
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm text-white">Public Library Sharing</h3>
          <p className="text-xs text-white/60">Allow anyone with your link to listen to your uploaded library.</p>
        </div>
        <button
          onClick={handleToggleShare}
          disabled={saving}
          className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all disabled:opacity-50 ${
            isPublic ? "bg-emerald-500 text-black font-semibold" : "bg-white/10 text-white/70 hover:bg-white/20"
          }`}
        >
          {saving ? "Saving..." : isPublic ? "Enabled" : "Disabled"}
        </button>
      </div>

      {isPublic && (
        <div className="flex items-center gap-2 pt-2 border-t border-white/10">
          {shareUrl ? (
            <>
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 bg-black/40 text-xs px-3 py-2 rounded-lg border border-white/10 text-white/80 focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium transition-colors shrink-0"
              >
                {copied ? "Copied!" : "Copy Link"}
              </button>
            </>
          ) : (
            <p className="text-xs text-amber-400">
              Share link unavailable — reload the page to generate one.
            </p>
          )}
        </div>
      )}

      <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-white">Offline Streaming</h4>
            <p className="text-[11px] text-white/50 leading-snug">
              Grant long-term Drive access so friends can stream your library even when
              you're offline.
            </p>
          </div>
          <button
            onClick={handleConnectDriveOffline}
            disabled={connectingDrive}
            className="px-4 py-1.5 rounded-full text-xs font-medium transition-all disabled:opacity-50 bg-white/10 text-white/70 hover:bg-white/20 shrink-0"
          >
            {connectingDrive ? "Connecting..." : "Connect"}
          </button>
        </div>
        {driveConnectMsg && (
          <span
            className={`text-[11px] ${driveConnectMsg.ok ? "text-emerald-400" : "text-red-400"}`}
          >
            {driveConnectMsg.msg}
          </span>
        )}
      </div>
    </div>
  );
}
