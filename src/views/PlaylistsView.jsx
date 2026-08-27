import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { ListPlus, Plus, ChevronLeft, Trash2, Play, Pause, MoreHorizontal, Pencil, X, Check, Shuffle, Clock } from "lucide-react";
import "material-symbols/rounded.css";
import { GlassCard } from "@/components/ui/glasscn/glass-card";
import { GlassButton } from "@/components/ui/glasscn/glass-button";
import { LiquidGlass } from "@/components/ui/glasscn/liquid-glass";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { GlassDropdownMenuContent } from "@/components/ui/glasscn/glass-dropdown-menu";
import PlaylistPoster, { gradientForTitle } from "@/components/PlaylistPoster";
import { cn } from "@/lib/utils";
import StickyGlassHeader from "@/components/ui/StickyGlassHeader";

const CONTENT_WRAP_CLASS = "w-full space-y-8 pb-12";

const isProtectedPlaylist = (pl) =>
  Boolean(
    pl &&
      (pl.id === "1" ||
        pl.isFavorite === true ||
        pl.isSmartPlaylist === true ||
        pl.isRecommended === true ||
        pl.isGenrePlaylist === true)
  );

const isRecommendedPlaylist = (pl) => Boolean(pl && pl.id === "recommended");

function DialogShell({ open, onClose, children, maxWidth = "max-w-md" }) {
  const [rendered, setRendered] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
      setClosing(false);
    } else if (rendered) {
      setClosing(true);
      const t = setTimeout(() => {
        setRendered(false);
        setClosing(false);
      }, 180);
      return () => clearTimeout(t);
    }
  }, [open, rendered]);

  useEffect(() => {
    if (!rendered) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [rendered, onClose]);

  if (!rendered) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-md",
        closing
          ? "animate-out fade-out-0 animation-duration-150 fill-mode-forwards"
          : "animate-in fade-in-0 animation-duration-200"
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
    >
      <GlassCard
        glassVariant="liquid-refract"
        liquidProps={{
          blur: 12,
          refraction: 14,
          saturation: 1.45,
          className: "rounded-3xl",
        }}
        className={cn(
          `relative w-full ${maxWidth} space-y-5 p-6 text-white`,
          closing
            ? "animate-out zoom-out-95 animation-duration-150 fill-mode-forwards"
            : "animate-in zoom-in-95 animation-duration-200"
        )}
      >
        {children}
      </GlassCard>
    </div>,
    document.body
  );
}

function DialogHeader({ icon, title, onClose }) {
  return (
    <div className="flex items-center justify-between pb-4">
      <div className="flex items-center gap-2.5">
        <span
          className="material-symbols-rounded text-2xl text-white"
          style={{
            fontVariationSettings: "'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 24",
          }}
        >
          {icon}
        </span>
        <h3 className="text-lg font-bold tracking-tight text-white">{title}</h3>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close dialog"
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white/70 transition-all hover:bg-white/20 hover:text-white ml-4"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function PlaylistNameDialog({ open, title, icon, initialValue = "", submitLabel, onSubmit, onCancel }) {
  const [name, setName] = useState(initialValue);

  useEffect(() => {
    if (open) setName(initialValue);
  }, [open, initialValue]);

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit(name.trim());
  };

  return (
    <DialogShell open={open} onClose={onCancel}>
      <DialogHeader icon={icon} title={title} onClose={onCancel} />
      <div className="space-y-4">
        <LiquidGlass
          blur={6}
          refraction={6}
          saturation={1.2}
          className="rounded-xl p-2 [--liquid-glass-rim-width:0.5px]"
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            placeholder="Playlist name"
            className="w-full rounded-lg bg-transparent px-1 py-0.5 text-sm text-white outline-none placeholder-white/50"
            autoFocus
          />
        </LiquidGlass>
      </div>

      <div className="border-t border-white/10 pt-4">
        <GlassButton
          onClick={handleSubmit}
          disabled={!name.trim()}
          glassVariant="liquid-refract"
          className="w-full h-9 rounded-xl text-xs font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitLabel}
        </GlassButton>
      </div>
    </DialogShell>
  );
}

function ConfirmDialog({ open, icon = "delete", title, message, confirmLabel = "Delete", onConfirm, onCancel }) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogShell open={open} onClose={onCancel}>
      <DialogHeader icon={icon} title={title} onClose={onCancel} />
      <p className="text-sm leading-relaxed text-white/80">{message}</p>
      <div className="border-t border-white/10 pt-4">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 h-9 cursor-pointer rounded-xl border border-white/20 bg-white/10 text-xs font-semibold text-white hover:bg-white/20 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <GlassButton
            onClick={handleConfirm}
            disabled={busy}
            glassVariant="liquid-refract"
            className="flex-1 h-9 rounded-xl text-xs font-semibold text-white transition-all hover:bg-white/20 disabled:opacity-50"
          >
            {busy ? "Deleting..." : confirmLabel}
          </GlassButton>
        </div>
      </div>
    </DialogShell>
  );
}

export default function PlaylistsView({
  playlists = [],
  userTracks = [],
  activeTrack = null,
  isPlaying = false,
  onTogglePlay = () => {},
  onPlayTrack = () => {},
  onPlaylistPlay = () => {},
  onCreatePlaylist = () => {},
  onDeletePlaylist = () => {},
  onRenamePlaylist = () => {},
  onRemoveTrackFromPlaylist = () => {},
  _onAddToPlaylist = () => {},
  recommendedPlaylist = null,
  genrePlaylists = [],
  onSaveRecommended = () => {},
}) {
  const [activePlaylistId, setActivePlaylistId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const displayPlaylists = [
    ...playlists.filter((pl) => pl.isFavorite === true),
    ...(recommendedPlaylist ? [recommendedPlaylist] : []),
    ...genrePlaylists,
    ...playlists.filter((pl) => pl.isFavorite !== true),
  ];

  const userPlaylists = displayPlaylists.filter((pl) => !pl.isGenrePlaylist);
  const genreList = displayPlaylists.filter((pl) => pl.isGenrePlaylist);

  const openCreate = () => {
    setIsCreateOpen(true);
  };

  const handleCreateCancel = () => {
    setIsCreateOpen(false);
  };

  const openRename = (playlist) => {
    setRenameTarget(playlist);
  };

  const handleRenameSubmit = async (title) => {
    if (!renameTarget) return;
    try {
      await onRenamePlaylist(renameTarget.id, title);
    } catch (err) {
      console.error("Failed to rename playlist:", err);
    }
    setRenameTarget(null);
  };

  const handlePlayAll = (playlist) => {
    if (!playlist.songIds || playlist.songIds.length === 0 || !onPlayTrack) return;
    const tracks = playlist.songIds
      .map((id) => userTracks.find((t) => t.id === id))
      .filter(Boolean);
    if (tracks.length > 0) {
      onPlaylistPlay?.(playlist.id, tracks[0], tracks);
    }
  };

  const handlePlayAllFull = (playlist) => {
    if (!playlist.songIds || playlist.songIds.length === 0 || !onPlayTrack) return;
    const tracks = playlist.songIds
      .map((id) => userTracks.find((t) => t.id === id))
      .filter(Boolean);
    if (tracks.length > 0) {
      onPlaylistPlay?.(playlist.id, tracks[0], tracks);
    }
  };

  const toggleSelection = (playlistId) => {


    const pl =
      playlists.find((p) => p.id === playlistId) ||
      (recommendedPlaylist?.id === playlistId ? recommendedPlaylist : null) ||
      genrePlaylists.find((p) => p.id === playlistId) ||
      null;
    if (pl && isProtectedPlaylist(pl)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(playlistId)) {
        next.delete(playlistId);
      } else {
        next.add(playlistId);
      }
      return next;
    });
  };

  const enterSelectionMode = () => {
    setIsSelectionMode(true);
    setSelectedIds(new Set());
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleDeleteSelected = () => {
    const count = selectedIds.size;
    if (count === 0) return;
    setConfirmDelete({
      ids: Array.from(selectedIds),
      title: "Delete Playlists",
      message: `Are you sure you want to delete ${count} ${count === 1 ? "playlist" : "playlists"}? This can't be undone.`,
    });
  };

  const runDelete = async (ids) => {
    const deletable = ids.filter(
      (id) =>
        id !== "1" && id !== "recommended" && !playlists.find((p) => p.id === id)?.isFavorite
    );
    if (deletable.length === 0) {
      setConfirmDelete(null);
      return;
    }
    try {
      await Promise.all(deletable.map((id) => onDeletePlaylist(id)));
    } catch (err) {
      console.error("Failed to delete selected playlists:", err);
    }
    setConfirmDelete(null);
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  const handleDeletePlaylist = (playlistId) => {
    setConfirmDelete({
      ids: [playlistId],
      title: "Delete Playlist",
      message: "Are you sure you want to delete this playlist? This can't be undone.",
    });
  };

  const handleRenamePlaylist = async (playlist) => {
    openRename(playlist);
  };

  const activePlaylist = displayPlaylists.find((pl) => pl.id === activePlaylistId);

  const playlistTracks = React.useMemo(() => {
    if (!activePlaylist) return [];
    return (activePlaylist.songIds || [])
      .map((id) => userTracks.find((t) => t.id === id))
      .filter(Boolean);
  }, [activePlaylist, userTracks]);

  const handleRemoveTrack = async (e, trackId) => {
    e.stopPropagation();
    try {
      await onRemoveTrackFromPlaylist(activePlaylistId, trackId);
    } catch (err) {
      console.error("Failed to remove track from playlist:", err);
    }
  };

  const selectedCount = selectedIds.size;


  const isPlaylistTrackActive =
    isPlaying &&
    Boolean(
      activeTrack && (activePlaylist?.songIds || []).includes(activeTrack.id)
    );

  const formatTrackDuration = (seconds) => {
    if (!seconds || seconds <= 0) return "—";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const heroGradient =
    activePlaylist?.id === "1"
      ? { name: "Playing with Reds", colors: ["#D31027", "#EA384D"] }
      : gradientForTitle(activePlaylist?.title || "");

  const totalMinutes = Math.max(
    1,
    Math.round(
      playlistTracks.reduce((sum, t) => sum + (t.duration_seconds || t.duration || 0), 0) /
        60
    )
  );

  const playShuffled = () => {
    if (playlistTracks.length === 0 || !onPlaylistPlay) return;
    const shuffled = [...playlistTracks];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    onPlaylistPlay(activePlaylist.id, shuffled[0], shuffled);
  };


  if (activePlaylist) {
    return (
      <div className="w-full text-white font-sans antialiased selection:bg-white selection:text-white">
        <div className="w-full space-y-8 pb-12">
          <div className="mx-auto max-w-5xl px-8 pt-8">
          <div className="sticky top-0 z-30 -mx-8 -mt-8 mb-6 flex items-center justify-between gap-4 px-8 py-4 bg-black/40 backdrop-blur-2xl backdrop-saturate-150 border-b border-white/10 transition-all">
            <LiquidGlass
              blur={10}
              refraction={18}
              saturation={1.6}
              onClick={() => setActivePlaylistId(null)}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-medium text-white/70 border border-white/30 [--liquid-glass-rim-light:rgba(255,255,255,0.7)] transition-all hover:bg-white/25 hover:text-white hover:scale-105 shadow-lg shadow-black/10"
            >
              <ChevronLeft className="h-4 w-4 stroke-[2.5]" />
              Back to Library
            </LiquidGlass>

            {isRecommendedPlaylist(activePlaylist) && (
              <LiquidGlass
                blur={10}
                refraction={18}
                saturation={1.6}
                onClick={onSaveRecommended}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-xs font-semibold text-white border border-white/30 [--liquid-glass-rim-light:rgba(255,255,255,0.7)] transition-all hover:bg-white/25 hover:scale-105 shadow-lg shadow-black/10"
              >
                <Plus className="h-4 w-4 stroke-[2.5]" />
                Save to Library
              </LiquidGlass>
            )}

            {!isProtectedPlaylist(activePlaylist) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <LiquidGlass
                    blur={10}
                    refraction={18}
                    saturation={1.6}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/15 text-white/80 border border-white/30 [--liquid-glass-rim-light:rgba(255,255,255,0.7)] transition-all hover:bg-white/25 hover:text-white hover:scale-105 shadow-lg shadow-black/10"
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </LiquidGlass>
                </DropdownMenuTrigger>
                <DropdownMenuPortal>
                  <GlassDropdownMenuContent
                    glassVariant="frosted"
                    align="end"
                    sideOffset={8}
                    className="w-56"
                  >
                    <DropdownMenuItem onClick={() => handleRenamePlaylist(activePlaylist)}>
                      <Pencil className="mr-2 h-4 w-4 text-white" />
                      <span className="text-white">Rename</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDeletePlaylist(activePlaylist.id)}>
                      <Trash2 className="mr-2 h-4 w-4 text-white" />
                      <span className="text-white">Delete Playlist</span>
                    </DropdownMenuItem>
                  </GlassDropdownMenuContent>
                </DropdownMenuPortal>
              </DropdownMenu>
            )}
          </div>


          <div className="flex flex-col items-start gap-8 border-b border-white/10 pb-8 md:flex-row md:items-end">
            <div className="h-52 w-52 shrink-0 overflow-hidden rounded-2xl shadow-2xl">
              <PlaylistPoster
                title={activePlaylist.title}
                gradient={heroGradient}
              />
            </div>

            <div className="flex flex-1 flex-col justify-end gap-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/85 drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]">
                <span>Spire</span>
              </div>

              <h1 className="text-4xl font-black leading-[1.05] tracking-tight text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.6)] md:text-5xl">
                {activePlaylist.title}
              </h1>

              {isRecommendedPlaylist(activePlaylist) && (
                <p className="max-w-xl text-sm font-medium text-white/85 drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]">
                  Picked from your listening taste · refreshes every 24 hours.
                </p>
              )}

              <div className="flex items-center gap-5 pt-1 text-xs font-medium text-white/80 drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]">
                <span>
                  {playlistTracks.length} {playlistTracks.length === 1 ? "song" : "songs"}
                </span>
                <span>About {totalMinutes} min</span>
              </div>


              <div className="flex items-center gap-4 pt-4">
                <LiquidGlass
                  blur={10}
                  refraction={18}
                  saturation={1.6}
                  onClick={() =>
                    isPlaylistTrackActive ? onTogglePlay() : handlePlayAllFull(activePlaylist)
                  }
                  className="inline-flex cursor-pointer items-center gap-2.5 rounded-full bg-white px-6 py-3 text-sm font-bold text-black shadow-[0_8px_20px_rgba(255,255,255,0.25)] transition-all hover:scale-105 active:scale-95"
                >
                  {isPlaylistTrackActive ? (
                    <Pause className="h-4 w-4 fill-current" />
                  ) : (
                    <Play className="h-4 w-4 fill-current" />
                  )}
                  <span>{isPlaylistTrackActive ? "Pause" : "Play"}</span>
                </LiquidGlass>

                <LiquidGlass
                  blur={10}
                  refraction={18}
                  saturation={1.6}
                  onClick={playShuffled}
                  className={`inline-flex cursor-pointer items-center gap-2.5 rounded-full border border-white/30 bg-white/15 px-5 py-3 text-sm font-semibold text-white [--liquid-glass-rim-light:rgba(255,255,255,0.7)] shadow-lg shadow-black/10 transition-all hover:bg-white/25 hover:scale-105 active:scale-95 ${
                    playlistTracks.length === 0 ? "pointer-events-none opacity-40" : ""
                  }`}
                >
                  <Shuffle className="h-4 w-4" />
                  Shuffle
                </LiquidGlass>

                {!isProtectedPlaylist(activePlaylist) && (
                  <LiquidGlass
                    blur={10}
                    refraction={18}
                    saturation={1.6}
                    onClick={() => handleDeletePlaylist(activePlaylist.id)}
                    className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-white/30 bg-white/15 text-white/80 [--liquid-glass-rim-light:rgba(255,255,255,0.7)] shadow-lg shadow-black/10 transition-all hover:bg-white/25 hover:text-white hover:scale-105"
                  >
                    <Trash2 className="h-5 w-5" />
                  </LiquidGlass>
                )}
              </div>
            </div>
          </div>


          <div className="mt-5">
            {playlistTracks.length === 0 ? (
              <div className="py-10 text-center text-sm text-white/40">
                No songs in this playlist yet. Add songs from search or during playback.
              </div>
            ) : (
              <>
                <div className="mb-2 grid grid-cols-[48px_1fr_1fr_64px] border-b border-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/50">
                  <span>#</span>
                  <span className="pl-[54px]">Title</span>
                  <span>Artist</span>
                  <span className="text-right">
                    <Clock className="inline h-3.5 w-3.5" />
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  {playlistTracks.map((track, index) => (
                    <div
                      key={track.id}
                      onClick={() => onPlaylistPlay?.(activePlaylist.id, track)}
                      className="group grid cursor-pointer grid-cols-[48px_1fr_1fr_64px] items-center rounded-xl border border-transparent px-4 py-3 transition-all hover:border-white/10 hover:bg-white/10"
                    >
                      <div className="text-sm font-medium text-white/60 group-hover:text-white">
                        {activeTrack?.id === track.id ? (
                          isPlaying ? (
                            <Pause className="h-4 w-4 fill-current text-white" />
                          ) : (
                            <Play className="h-4 w-4 fill-current text-white" />
                          )
                        ) : (
                          <>
                            <span className="group-hover:hidden">{index + 1}</span>
                            <Play className="hidden h-4 w-4 fill-current group-hover:block" />
                          </>
                        )}
                      </div>

                      <div className="flex min-w-0 items-center gap-3.5 overflow-hidden pr-4">
                        <img
                          src={track.cover || track.artworkUrl}
                          alt={track.title}
                          loading="lazy"
                          decoding="async"
                          className="h-10 w-10 flex-shrink-0 rounded-lg border border-white/10 object-cover shadow-md ring-1 ring-white/10"
                        />
                        <span className="truncate text-sm font-bold text-white">
                          {track.title}
                        </span>
                      </div>

                      <div className="truncate pr-4 text-sm font-medium text-white/80">
                        {track.artist}
                      </div>

                      <div className="flex items-center justify-end gap-2 text-xs font-medium text-white/60">
                        <span className="group-hover:hidden">
                          {formatTrackDuration(track.duration_seconds || track.duration)}
                        </span>
                        {!isProtectedPlaylist(activePlaylist) && (
                          <button
                            type="button"
                            onClick={(e) => handleRemoveTrack(e, track.id)}
                            aria-label="Remove track"
                            className="hidden rounded-full p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white group-hover:block"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

        <PlaylistNameDialog
          open={isCreateOpen}
          title="Create New Playlist"
          icon="playlist_add"
          submitLabel="Create"
          onSubmit={async (title) => {
            try {
              await onCreatePlaylist(title);
              setIsCreateOpen(false);
            } catch (err) {
              console.error("Failed to create playlist:", err);
            }
          }}
          onCancel={handleCreateCancel}
        />

        <PlaylistNameDialog
          open={Boolean(renameTarget)}
          title="Rename Playlist"
          icon="edit"
          initialValue={renameTarget?.title || ""}
          submitLabel="Save"
          onSubmit={handleRenameSubmit}
          onCancel={() => setRenameTarget(null)}
        />

        <ConfirmDialog
          open={Boolean(confirmDelete)}
          title={confirmDelete?.title}
          message={confirmDelete?.message}
          onConfirm={() => confirmDelete && runDelete(confirmDelete.ids)}
          onCancel={() => setConfirmDelete(null)}
        />
      </div>
    );
  }

  return (
    <div className="w-full text-white font-sans antialiased selection:bg-white selection:text-white">
      <div className={CONTENT_WRAP_CLASS}>

        <StickyGlassHeader
          title="Your Playlists"
          subtitle={isSelectionMode ? `${selectedCount} selected` : `${playlists.length} ${playlists.length === 1 ? "playlist" : "playlists"}`}
          action={
            <div className="flex items-center gap-2">
              {isSelectionMode ? (
                <>
                  <button
                    type="button"
                    onClick={exitSelectionMode}
                    className="flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
                  >
                    <X className="mr-1.5 h-4 w-4" />
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    disabled={selectedCount === 0}
                    className="flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Trash2 className="mr-1.5 h-4 w-4 text-white" />
                    Delete Selected
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={enterSelectionMode}
                    className="flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
                  >
                    <Check className="mr-1.5 h-4 w-4" />
                    Select
                  </button>

                  <button
                    type="button"
                    onClick={openCreate}
                    className="flex items-center rounded-full bg-white/10 border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
                  >
                    <Plus className="mr-1.5 h-4 w-4 stroke-[2.5]" />
                    New Playlist
                  </button>
                </>
              )}
            </div>
          }
        />


        <PlaylistNameDialog
          open={isCreateOpen}
          title="Create New Playlist"
          icon="playlist_add"
          submitLabel="Create"
          onSubmit={async (title) => {
            try {
              await onCreatePlaylist(title);
              setIsCreateOpen(false);
            } catch (err) {
              console.error("Failed to create playlist:", err);
            }
          }}
          onCancel={handleCreateCancel}
        />


        <PlaylistNameDialog
          open={Boolean(renameTarget)}
          title="Rename Playlist"
          icon="edit"
          initialValue={renameTarget?.title || ""}
          submitLabel="Save"
          onSubmit={handleRenameSubmit}
          onCancel={() => setRenameTarget(null)}
        />

        <ConfirmDialog
          open={Boolean(confirmDelete)}
          title={confirmDelete?.title}
          message={confirmDelete?.message}
          onConfirm={() => confirmDelete && runDelete(confirmDelete.ids)}
          onCancel={() => setConfirmDelete(null)}
        />


        {displayPlaylists.length === 0 ? (
          <div className="py-14 text-center">
            <ListPlus className="mx-auto mb-3 h-8 w-8 text-white/30" />
            <p className="text-sm text-white/50">No playlists yet. Create one to get started.</p>
          </div>
        ) : (
          <>
            {userPlaylists.length > 0 && (
              <div className="grid grid-cols-2 gap-5 pt-2 sm:grid-cols-3 lg:grid-cols-4">
                {userPlaylists.map((item) => {
              const isSelected = selectedIds.has(item.id);
              const posterSubtitle = isRecommendedPlaylist(item)
                ? "Recommended"
                : item.subtitle || `${(item.songIds || []).length} songs`;


              const posterArtists = (item.songIds || [])
                .map((id) => userTracks.find((t) => t.id === id)?.artist)
                .filter(Boolean)
                .filter((a, i, arr) => arr.indexOf(a) === i)
                .slice(0, 8);

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (isSelectionMode) {
                      toggleSelection(item.id);
                    } else {
                      setActivePlaylistId(item.id);
                    }
                  }}
                  className="group relative cursor-pointer"
                >
                  {isSelectionMode && !isProtectedPlaylist(item) && (
                    <div
                      className={`absolute left-3 top-3 z-20 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all ${
                        isSelected ? "border-white bg-white text-black" : "border-white/40 bg-black/20 text-transparent"
                      }`}
                    >
                      {isSelected && <Check className="text-xs text-black" />}
                    </div>
                  )}

                  <div
                    className={`relative aspect-square overflow-hidden rounded-2xl bg-white/5 shadow-sm transition-all duration-300 ${
                      isSelectionMode && isSelected ? "ring-2 ring-white" : "group-hover:shadow-lg"
                    }`}
                  >
                    <PlaylistPoster
                      title={item.title}
                      subtitle={posterSubtitle}
                      artists={posterArtists}
                      gradient={
                        item.id === "1"
                          ? { name: "Playing with Reds", colors: ["#D31027", "#EA384D"] }
                          : undefined
                      }
                    />

                    {!isSelectionMode && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <div
                          role="button"
                          tabIndex={0}
                          className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md border border-white/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayAllFull(item);
                          }}
                        >
                          <Play className="h-5 w-5 fill-current" />
                        </div>
                      </div>
                    )}

                    {!isSelectionMode && isRecommendedPlaylist(item) && (
                      <div
                        className="absolute right-2 top-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={onSaveRecommended}
                          aria-label="Save recommended playlist to your library"
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white backdrop-blur-md transition-colors hover:bg-white/15"
                        >
                          <Plus className="h-4 w-4 stroke-[2.5]" />
                        </button>
                      </div>
                    )}

                    {!isSelectionMode && !isProtectedPlaylist(item) && (
                      <div className="absolute right-2 top-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white backdrop-blur-md transition-colors hover:bg-white/15"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuPortal>
                            <GlassDropdownMenuContent
                              glassVariant="frosted"
                              align="end"
                              sideOffset={4}
                              className="w-44"
                            >
                              <DropdownMenuItem onClick={() => handleRenamePlaylist(item)}>
                                <Pencil className="mr-2 h-4 w-4 text-white" />
                                <span className="text-white">Rename</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeletePlaylist(item.id)}>
                                <Trash2 className="mr-2 h-4 w-4 text-white" />
                                <span className="text-white">Delete</span>
                              </DropdownMenuItem>
                            </GlassDropdownMenuContent>
                          </DropdownMenuPortal>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                </div>
              );
              })}
              </div>
            )}

            {genreList.length > 0 && (
              <div className="w-full min-w-0 space-y-3 pt-4">
                <div>
                  <h2 className="text-lg font-bold tracking-tight">Browse by Genre</h2>
                  <p className="text-xs text-white/50">Mixes built from your library</p>
                </div>
                <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
                  {genreList.map((item) => {
                    const count = (item.songIds || []).length;
                    const posterArtists = (item.songIds || [])
                      .map((id) => userTracks.find((t) => t.id === id)?.artist)
                      .filter(Boolean)
                      .filter((a, i, arr) => arr.indexOf(a) === i)
                      .slice(0, 8);
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (!isSelectionMode) setActivePlaylistId(item.id);
                        }}
                        className="group relative cursor-pointer"
                      >
                        <div className="relative aspect-square overflow-hidden rounded-2xl bg-white/5 shadow-sm transition-all duration-300 group-hover:shadow-lg">
                          <PlaylistPoster
                            title={item.title}
                            subtitle={`${count} ${count === 1 ? "song" : "songs"}`}
                            artists={posterArtists}
                          />
                          {!isSelectionMode && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                              <div
                                role="button"
                                tabIndex={0}
                                className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md border border-white/20"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlayAll(item);
                                }}
                              >
                                <Play className="h-5 w-5 fill-current" />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}