import React, { useRef, useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/glasscn/glass-card";
import { LiquidGlass } from "@/components/ui/glasscn/liquid-glass";
import { GlassButton } from "@/components/ui/glasscn/glass-button";
import "material-symbols/rounded.css";

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
  discordError,
  onConnectDiscord,
}) {
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);

  const { status, roomCode, members, error, connecting, createRoom, joinRoom, leaveRoom } = listen;

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
        refraction: 15,
        className: "rounded-3xl [--liquid-glass-rim-light:rgba(255,255,255,0.4)]",
      }}
      className="gap-0 overflow-hidden py-0 my-auto"
    >
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <LiquidGlass
          blur={6}
          refraction={8}
          className="flex h-10 w-10 items-center justify-center rounded-full [--liquid-glass-rim-light:rgba(255,255,255,0.5)]"
        >
          <span className="material-symbols-rounded text-xl text-white/90">group</span>
        </LiquidGlass>
        <div>
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
            <span className="text-[10px] font-semibold tracking-wider text-emerald-300">
              {status === "host" ? "HOSTING" : "JOINED"}
            </span>
          </LiquidGlass>
        )}
      </div>

      <div className="divide-y divide-white/10 border-t border-white/10">
        {/* Discord connection */}
        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {discordUser ? (
              <>
                <LiquidGlass
                  blur={6}
                  refraction={8}
                  className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full [--liquid-glass-rim-light:rgba(255,255,255,0.5)]"
                >
                  {discordUser.avatar ? (
                    <img
                      src={`https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=64`}
                      alt={discordUser.username}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="material-symbols-rounded text-lg text-white/80">discord</span>
                  )}
                </LiquidGlass>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-white/90">
                    {discordUser.global_name || discordUser.username}
                  </p>
                  <p className="text-[10px] font-medium text-emerald-300">Connected</p>
                </div>
              </>
            ) : (
              <>
                <LiquidGlass
                  blur={6}
                  refraction={8}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full [--liquid-glass-rim-light:rgba(255,255,255,0.5)]"
                >
                  <span className="material-symbols-rounded text-lg text-white/80">discord</span>
                </LiquidGlass>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white/90">Discord</p>
                  <p className="text-[10px] font-medium text-white/50">
                    Connect to show rich presence
                  </p>
                </div>
              </>
            )}
          </div>
          {!discordUser && (
            <GlassButton
              onClick={onConnectDiscord}
              disabled={isDiscordConnecting}
              glassVariant="liquid-refract"
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-50"
            >
              {isDiscordConnecting ? "Connecting..." : "Connect"}
            </GlassButton>
          )}
        </div>

        {discordError && (
          <div className="px-5 pb-3">
            <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[10px] font-medium leading-relaxed text-amber-200">
              {discordError}
            </p>
          </div>
        )}

        {/* Room management */}
        <div className="space-y-3 px-5 py-4">
          {!isInRoom ? (
            <>
              <div className="flex items-center gap-2">
                <LiquidGlass
                  blur={5}
                  refraction={5}
                  className="flex-1 rounded-xl p-0.5 [--liquid-glass-rim-width:0.5px]"
                >
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
                    placeholder="Room code"
                    maxLength={6}
                    className="w-full rounded-lg bg-transparent px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.2em] text-white outline-none placeholder-white/40"
                  />
                </LiquidGlass>
                <GlassButton
                  onClick={handleJoinRoom}
                  disabled={connecting || !joinCode.trim()}
                  glassVariant="liquid-refract"
                  className="shrink-0 rounded-xl px-4 py-2 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-40"
                >
                  {connecting ? "Joining..." : "Join"}
                </GlassButton>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">or</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
              <GlassButton
                onClick={handleCreateRoom}
                glassVariant="liquid-refract"
                className="w-full rounded-xl py-2.5 text-xs font-semibold text-white hover:bg-white/15"
              >
                <span className="material-symbols-rounded mr-1.5 text-base leading-none">
                  video_call
                </span>
                Start a Session
              </GlassButton>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                    Room Code
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="group mt-0.5 flex cursor-pointer items-center gap-2"
                    aria-label="Copy room code"
                  >
                    <LiquidGlass
                      blur={4}
                      refraction={4}
                      className="rounded-lg px-3 py-1 [--liquid-glass-rim-width:0.5px]"
                    >
                      <span className="text-sm font-bold tracking-[0.25em] text-white">
                        {roomCode}
                      </span>
                    </LiquidGlass>
                    <span className="material-symbols-rounded text-base text-white/40 group-hover:text-white/80">
                      {copied ? "check" : "content_copy"}
                    </span>
                  </button>
                </div>
                <GlassButton
                  onClick={leaveRoom}
                  glassVariant="liquid-refract"
                  className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-white/15"
                >
                  Leave
                </GlassButton>
              </div>

              <div className="flex items-center gap-2 pt-1">
                {members.length === 0 ? (
                  <p className="text-[10px] font-medium text-white/40">
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
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 [--liquid-glass-rim-width:0.5px]"
                        >
                          <span className="text-[9px] font-bold text-white/90">
                            {(member.name || "?").charAt(0).toUpperCase()}
                          </span>
                        </LiquidGlass>
                      ))}
                    </div>
                    <p className="text-[10px] font-medium text-white/50">
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
  onSignOut,
  listen,
  discordUser,
  isDiscordConnecting,
  discordError,
  onConnectDiscord,
}) {
  const fileInputRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  const handleBoxClick = () => {
    fileInputRef.current?.click();
  };

  const userAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const userName = user?.user_metadata?.full_name || "Danny Rico";
  const userEmail = user?.email || "daniel_rico1@icloud.com";

  return (
    <>
      <div className="w-full max-w-2xl mx-auto space-y-6 p-4 font-sans text-white select-none">
        <div className="flex items-center justify-center gap-2 pt-1">
          <h1 className="text-lg font-bold tracking-wide text-white/90">Personal Info</h1>
          <LiquidGlass
            blur={4}
            refraction={4}
            className="rounded-full px-2 py-0.5 [--liquid-glass-rim-width:0.5px]"
          >
            <span className="text-[10px] font-semibold tracking-wider text-white/90">v1.0.0</span>
          </LiquidGlass>
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
                    Change Wallpaper
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
              onClick={onSignOut}
              className="group flex w-full cursor-pointer items-center justify-between px-5 py-3 text-left text-xs font-medium text-red-500 transition-all hover:bg-white/10 "
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

        <ListenTogetherCard
          listen={listen}
          discordUser={discordUser}
          isDiscordConnecting={isDiscordConnecting}
          discordError={discordError}
          onConnectDiscord={onConnectDiscord}
        />
      </div>
    </>
  );
}