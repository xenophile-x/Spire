import React, { useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GlassCard } from "@/components/ui/glasscn/glass-card";
import { LiquidGlass } from "@/components/ui/glasscn/liquid-glass";
import { GlassButton } from "@/components/ui/glasscn/glass-button";
import { GlassInput } from "@/components/ui/glasscn/glass-input";
import { useLibrary } from "@/context/LibraryContext";
import { LibrarySharing } from "@/components/LibrarySharing";
import { 
  isInDiscordClient, 
  connectDiscordOAuth, 
  redeemLinkCode, 
  unlinkDiscord, 
  fetchLinkedDiscordId 
} from "@/services/discordService";
import "material-symbols/rounded.css";

const DISCORD_ICON = "/discoeed.png"; 

function ListenTogetherCard({
  listen = {
    status: "idle",
    roomCode: null,
    members: [],
    error: null,
    connecting: false,
    createRoom: () => {},
    joinRoom: () => {},
    leaveRoom: () => {},
  },
  discordUser,
  isDiscordConnecting,
  onConnectDiscord,
  user,
  linkedDiscordId,
  onDiscordLinked,
  onDiscordUnlinked,
}) {
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [linkCode, setLinkCode] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [linkMessage, setLinkMessage] = useState("");
  const [isOAuthLinking, setIsOAuthLinking] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);

  const { status, roomCode, members: rawMembers, error, connecting, createRoom, joinRoom, leaveRoom } = listen;
  const members = Array.isArray(rawMembers) ? rawMembers : [];
  const isDiscordLinked = Boolean(discordUser || linkedDiscordId);

  const handleRedeemCode = async () => {
    const normalized = linkCode.trim().toUpperCase();
    if (!normalized || !/^[A-Z0-9]{6,8}$/.test(normalized)) return;
    setIsLinking(true);
    setLinkMessage("");
    try {
      const res = await redeemLinkCode(normalized);
      setLinkMessage("Discord account linked successfully!");
      setLinkCode("");
      if (onDiscordLinked) {
        try {
          const fresh = await fetchLinkedDiscordId();
          onDiscordLinked(fresh || res?.discord_id || null);
        } catch {}
      }
    } catch (err) {
      setLinkMessage(err.message || "Invalid or expired code");
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlink = async () => {
    setIsUnlinking(true);
    setLinkMessage("");
    try {
      await unlinkDiscord();
      setLinkMessage("Discord account unlinked.");
      if (onDiscordUnlinked) onDiscordUnlinked();
      else if (onDiscordLinked) onDiscordLinked(null);
    } catch (err) {
      setLinkMessage(err.message || "Failed to unlink");
    } finally {
      setIsUnlinking(false);
    }
  };

  const handleOAuthConnect = async () => {
    setIsOAuthLinking(true);
    try {
      await connectDiscordOAuth();
    } catch (err) {
      setLinkMessage(err.message || "Failed to start Discord OAuth");
      setIsOAuthLinking(false);
    }
  };

  const handleCreateRoom = async () => {
    try {
      await createRoom();
    } catch (err) {
      console.error("Failed to create room:", err);
    }
  };

  const handleJoinRoom = async () => {
    if (!joinCode.trim()) return;
    await joinRoom(joinCode);
  };

  const handleCopyCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.warn("Copy failed:", err);
    }
  };

  const isInRoom = status === "host" || status === "joined";

  return (
    <GlassCard
      glassVariant="liquid-refract"
      liquidProps={{
        blur: 14,
        refraction: 6,
        className: "rounded-3xl glass-rim-bright [--liquid-glass-rim-light:rgba(255,255,255,0.42)] [--liquid-glass-rim-width:1.2px]",
      }}
      className="gap-0 overflow-hidden py-0 my-auto"
    >
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <LiquidGlass
          blur={6}
          refraction={8}
          className="flex h-10 w-10 items-center justify-center rounded-full [--liquid-glass-rim-light:rgba(255,255,255,0.5)] bg-white/5"
        >
          <span className="material-symbols-rounded text-xl text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
            music_cast
          </span>
        </LiquidGlass>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-white">Listen Together</h2>
          <p className="text-[10px] font-medium text-white/50">
            Sync playback live with friends on Discord
          </p>
        </div>
        {isInRoom && (
          <LiquidGlass
            blur={4}
            refraction={4}
            className="ml-auto rounded-full px-2 py-0.5 [--liquid-glass-rim-width:0.5px]"
          >
            <span className="text-[10px] font-semibold tracking-wider text-white">
              {status === "host" ? "HOSTING" : "JOINED"}
            </span>
          </LiquidGlass>
        )}
      </div>

      <div className="divide-y divide-white/10 border-t border-white/10">
        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {discordUser ? (
              <>
                <LiquidGlass
                  blur={6}
                  refraction={8}
                  className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full [--liquid-glass-rim-light:rgba(255,255,255,0.5)]"
                >
                  {discordUser.avatar ? (
                    <img
                      src={`https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=64`}
                      alt={discordUser.username}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <img src={DISCORD_ICON} alt="Discord" className="h-7 w-7 object-contain drop-shadow-sm" />
                  )}
                </LiquidGlass>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold tracking-tight text-white">
                    {discordUser.global_name || discordUser.username}
                  </p>
                  <p className="text-[10px] font-medium text-white/50">Connected</p>
                </div>
              </>
            ) : linkedDiscordId ? (
              <>
                <LiquidGlass
                  blur={6}
                  refraction={8}
                  className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full [--liquid-glass-rim-light:rgba(255,255,255,0.5)] bg-white/5"
                >
                  <img src={DISCORD_ICON} alt="Discord" className="h-7 w-7 object-contain drop-shadow-sm" />
                </LiquidGlass>
                <div className="min-w-0">
                  <p className="text-sm font-semibold tracking-tight text-white">Discord</p>
                  <p className="text-[10px] font-medium text-white/50">Linked</p>
                </div>
              </>
            ) : (
              <>
                <LiquidGlass
                  blur={6}
                  refraction={8}
                  className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full [--liquid-glass-rim-light:rgba(255,255,255,0.5)] bg-white/5"
                >
                  <img src={DISCORD_ICON} alt="Discord" className="h-7 w-7 object-contain drop-shadow-sm" />
                </LiquidGlass>
                <div className="min-w-0">
                  <p className="text-sm font-semibold tracking-tight text-white">Discord</p>
                  <p className="text-[10px] font-medium text-white/50">
                    Link your Discord account
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {!isDiscordLinked && (
          <div className="space-y-3 px-5 py-3">
            <GlassButton
              onClick={handleOAuthConnect}
              disabled={isOAuthLinking}
              glassVariant="liquid-refract"
              className="w-full rounded-xl py-2.5 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-50"
            >
              <img src={DISCORD_ICON} alt="" className="mr-1.5 h-4 w-4 object-contain" />
              {isOAuthLinking ? "Connecting..." : "Connect via Discord"}
            </GlassButton>

            {isInDiscordClient() && (
              <GlassButton
                onClick={onConnectDiscord}
                disabled={isDiscordConnecting}
                glassVariant="liquid-refract"
                className="w-full rounded-xl py-2.5 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-50"
              >
                <img src={DISCORD_ICON} alt="" className="mr-1.5 h-4 w-4 object-contain" />
                {isDiscordConnecting ? "Connecting..." : "Connect in Discord"}
              </GlassButton>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <GlassInput
                    type="text"
                    value={linkCode}
                    onChange={(e) => setLinkCode(e.target.value.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 8))}
                    onKeyDown={(e) => e.key === "Enter" && handleRedeemCode()}
                    placeholder="8-character code"
                    maxLength={8}
                    className="w-full rounded-xl text-center placeholder:text-center text-xs font-semibold tracking-[0.2em] placeholder:tracking-[0.2em] placeholder:text-white/40 text-white h-9 bg-white/5 border-white/10 !py-0 flex items-center justify-center"
                  />
                </div>
                <GlassButton
                  onClick={handleRedeemCode}
                  disabled={isLinking || !/^[A-Z0-9]{6,8}$/.test(linkCode.trim().toUpperCase())}
                  glassVariant="liquid-refract"
                  className="shrink-0 rounded-xl px-4 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-40 h-9 flex items-center justify-center !py-0"
                >
                  {isLinking ? "..." : "Link"}
                </GlassButton>
              </div>
              <p className="text-[10px] font-medium text-white/40">
                Run <span className="text-white/80">/link</span> in Discord to get a code
              </p>
            </div>

            {linkMessage && (
              <p className="text-[10px] font-medium text-white px-1">
                {linkMessage}
              </p>
            )}
          </div>
        )}

        {isDiscordLinked && (
          <div className="px-5 py-3">
            <GlassButton
              onClick={handleUnlink}
              disabled={isUnlinking}
              glassVariant="liquid-refract"
              className="w-full flex items-center justify-center gap-2 rounded-full py-3 text-xs font-semibold text-white/90  disabled:opacity-50 transition-colors"
            >
              <span className="material-symbols-rounded text-base leading-none">link_off</span>
              {isUnlinking ? "Unlinking..." : "Unlink Discord"}
            </GlassButton>
            {linkMessage && (
              <p className="mt-3 text-[10px] font-medium text-white px-1">
                {linkMessage}
              </p>
            )}
          </div>
        )}

        <div className="space-y-3 px-5 py-4">
          {!isInRoom ? (
            <>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <GlassInput
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
                    placeholder="ROOM CODE"
                    maxLength={6}
                    className="w-full rounded-full h-8 text-center placeholder:text-center text-[11px] font-semibold uppercase tracking-[0.15em] placeholder:tracking-[0.15em] placeholder:text-white/40 text-white !py-0 flex items-center justify-center"
                  />
                </div>
                <GlassButton
                  onClick={handleJoinRoom}
                  disabled={connecting || !joinCode.trim()}
                  glassVariant="liquid-refract"
                  className="shrink-0 rounded-full px-4 h-8 text-[11px] font-semibold text-white hover:bg-white/15 disabled:opacity-40 flex items-center justify-center !py-0"
                >
                  {connecting ? "Joining..." : "Join"}
                </GlassButton>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="flex-1 h-px bg-white/10" aria-hidden="true" />
                <span className="text-[9px] font-medium uppercase tracking-wider text-white/40">OR</span>
                <span className="flex-1 h-px bg-white/10" aria-hidden="true" />
              </div>
              
              <GlassButton
                onClick={handleCreateRoom}
                glassVariant="liquid-refract"
                className="w-full flex items-center justify-center gap-1.5 rounded-full py-2 text-[11px] font-semibold text-white"
              >
                <span className="material-symbols-rounded text-sm leading-none">
                  video_call
                </span>
                Start a Session
              </GlassButton>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[9px] font-medium uppercase tracking-wider text-white/40">
                    Room Code
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="group mt-0.5 flex cursor-pointer items-center gap-1.5"
                    aria-label="Copy room code"
                  >
                    <LiquidGlass
                      blur={4}
                      refraction={4}
                      className="rounded-lg px-2.5 py-0.5 [--liquid-glass-rim-width:0.5px]"
                    >
                      <span className="text-xs font-bold tracking-[0.2em] text-white">
                        {roomCode}
                      </span>
                    </LiquidGlass>
                    <span className="material-symbols-rounded text-sm text-white/40 group-hover:text-white/80">
                      {copied ? "check" : "content_copy"}
                    </span>
                  </button>
                </div>
                <GlassButton
                  onClick={leaveRoom}
                  glassVariant="liquid-refract"
                  className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
                >
                  Leave
                </GlassButton>
              </div>

              <div className="flex items-center gap-2 pt-1">
                {members.length === 0 ? (
                  <p className="text-[9px] font-medium text-white/40">
                    Waiting for listeners to join...
                  </p>
                ) : (
                  <>
                    <div className="flex -space-x-1.5">
                      {members.slice(0, 6).map((member) => (
                        <LiquidGlass
                          key={member.id}
                          blur={5}
                          refraction={5}
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-white/20 [--liquid-glass-rim-width:0.5px]"
                        >
                          <span className="text-[8px] font-bold text-white/90">
                            {(member.name || "?").charAt(0).toUpperCase()}
                          </span>
                        </LiquidGlass>
                      ))}
                    </div>
                    <p className="text-[9px] font-medium text-white/50">
                      {members.length} {members.length === 1 ? "listener" : "listeners"} in sync
                    </p>
                  </>
                )}
              </div>
            </>
          )}

          {error && (
            <p className="text-[10px] font-medium text-red-400">⚠ {error}</p>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

export default function SettingsView({
  user,
  isUploading,
  onBackgroundUpload,
  bgMediaType = "all",
  onChangeBgMediaType,
  onSignOut,
  listen,
  discordUser,
  isDiscordConnecting,
  onConnectDiscord,
  linkedDiscordId,
  onDiscordLinked,
  onDiscordUnlinked,
}) {
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const { resyncArtistPhotos, artistSyncState } = useLibrary() || {};
  const syncStatus = artistSyncState?.status;
  const syncSubtitle =
    syncStatus === "idle"
      ? "Refresh artist photos and bios from iTunes & Wikipedia"
      : syncStatus === "syncing"
        ? `Syncing… ${artistSyncState?.done ?? 0}/${artistSyncState?.total ?? 0} · ${artistSyncState?.current ?? ""}`
        : syncStatus === "done"
          ? `Done — ${artistSyncState?.updated ?? 0} artist${artistSyncState?.updated === 1 ? "" : "s"} updated`
          : "Sync failed — try again";

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev || "";
    };
  }, []);

  const handleBoxClick = () => {
    fileInputRef.current?.click();
  };

  const userAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const userName = user?.user_metadata?.full_name || "Guest";
  const userEmail = user?.email || "";

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 p-4 font-sans text-white select-none">
      <div className="flex flex-col items-center justify-center gap-2 py-2 text-center">
        <div className="flex items-center justify-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-white">Personal Info</h1>
          <LiquidGlass
            blur={4}
            refraction={4}
            className="rounded-full px-3 py-1 [--liquid-glass-rim-width:0.5px]"
          >
            <span className="text-[10px] font-semibold tracking-wider text-white/90">v1.0.0</span>
          </LiquidGlass>
        </div>
      </div>

      <GlassCard
        glassVariant="liquid-refract"
        liquidProps={{
          blur: 14,
          refraction: 15,
          className: "rounded-3xl [--liquid-glass-rim-light:rgba(255,255,255,0.4)]",
        }}
        className="gap-0 overflow-hidden py-0 my-auto"
      >
        <div className="flex flex-col items-center justify-center px-4 pt-6 pb-4">
          <LiquidGlass
            blur={8}
            refraction={10}
            className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full [--liquid-glass-rim-light:rgba(255,255,255,0.45)]"
          >
            {userAvatar ? (
              <img
                src={userAvatar}
                alt={userName}
                className="h-full w-full scale-105 object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-white/10 to-black/30">
                <span className="material-symbols-rounded text-6xl text-white/80">account_circle</span>
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </LiquidGlass>

          <h2 className="mt-3 text-lg font-semibold tracking-tight text-white">{userName}</h2>
          <p className="text-xs font-medium text-white/60">{userEmail}</p>
        </div>

        <div className="divide-y divide-white/10 border-t border-white/10">
          <button
            type="button"
            onClick={handleBoxClick}
            disabled={isUploading}
            className="group flex w-full cursor-pointer items-center justify-between px-5 py-3 text-left transition-all hover:bg-white/10 active:bg-white/15 disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <span className={`material-symbols-rounded text-lg text-white/80 group-hover:text-white ${isUploading ? 'animate-spin' : ''}`}>
                {isUploading ? "sync" : "wallpaper"}
              </span>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-white/90 group-hover:text-white">
                  Change Scene
                </span>
                <span className="text-[10px] text-white/50">
                  {isUploading ? "Uploading image..." : "Upload custom background"}
                </span>
              </div>
            </div>
            <span className="material-symbols-rounded text-base text-white/40 group-hover:text-white/70">
              chevron_right
            </span>
          </button>

          <button
            type="button"
            onClick={resyncArtistPhotos}
            disabled={syncStatus === "syncing"}
            className="group flex w-full cursor-pointer items-center justify-between px-5 py-3 text-left transition-all hover:bg-white/10 active:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <span className={`material-symbols-rounded text-lg text-white/80 group-hover:text-white ${syncStatus === "syncing" ? "animate-spin" : ""}`}>
                {syncStatus === "syncing" ? "progress_activity" : "sync"}
              </span>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-white/90 group-hover:text-white">
                  Sync
                </span>
                <span className="text-[10px] text-white/50">{syncSubtitle}</span>
              </div>
            </div>
            <span className="material-symbols-rounded text-base text-white/40 group-hover:text-white/70">
              chevron_right
            </span>
          </button>

          <div className="flex items-center justify-between gap-3 px-5 py-3">
            <div className="flex items-center gap-3">
              <span className="material-symbols-rounded text-lg text-white/80">
                smart_display
              </span>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-white/90">
                  Background Media
                </span>
                <span className="text-[10px] text-white/50">
                  What the theme button cycles through
                </span>
              </div>
            </div>

            <LiquidGlass
              blur={10}
              refraction={18}
              saturation={1.6}
              className="flex shrink-0 items-center gap-1 rounded-full p-1.5 bg-white/10 border border-white/10 [--liquid-glass-rim-light:rgba(255,255,255,0.7)] shadow-lg shadow-black/10"
            >
              {[
                { value: "video", label: "Videos", icon: "movie" },
                { value: "image", label: "Images", icon: "image" },
                { value: "all", label: "All", icon: "grid_view" },
              ].map(({ value, label, icon }) => {
                const isActive = bgMediaType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onChangeBgMediaType?.(value)}
                    aria-pressed={isActive}
                    className={`flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide transition-all ${
                      isActive
                        ? "bg-white/15 text-white shadow-sm"
                        : "text-white/80 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span className="material-symbols-rounded text-xs leading-none">
                      {icon}
                    </span>
                    {label}
                  </button>
                );
              })}
            </LiquidGlass>
          </div>

          <button
            type="button"
            onClick={onSignOut}
            className="group flex w-full cursor-pointer items-center justify-between px-5 py-3 text-left text-xs font-medium text-red-400 transition-all hover:bg-white/10"
          >
            <span>Sign Out</span>
            <span className="material-symbols-rounded text-base text-red-400">logout</span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onBackgroundUpload}
        />
      </GlassCard>

      <LibrarySharing user={user} />

      <ListenTogetherCard
        listen={listen}
        discordUser={discordUser}
        isDiscordConnecting={isDiscordConnecting}
        onConnectDiscord={onConnectDiscord}
        user={user}
        linkedDiscordId={linkedDiscordId}
        onDiscordLinked={onDiscordLinked}
        onDiscordUnlinked={onDiscordUnlinked}
      />

      <div className="flex items-center justify-center gap-3 pb-2 pt-1">
        <button
          onClick={() => navigate("/termsofservice")}
          className="px-4 py-1.5 text-[11px] font-medium text-white/60 hover:text-white/90 transition-colors"
        >
          Terms of Service
        </button>
        <span className="h-3 w-px shrink-0 bg-white/20" aria-hidden="true" />
        <button
          onClick={() => navigate("/privacypolicy")}
          className="px-4 py-1.5 text-[11px] font-medium text-white/60 hover:text-white/90 transition-colors"
        >
          Privacy Policy
        </button>
      </div>
    </div>
  );
}