import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { ListPlus, Plus, ChevronLeft, Trash2, Play, MoreHorizontal, Pencil, X, Check } from "lucide-react";
import "material-symbols/rounded.css";
import { GlassIcon } from "@/components/ui/glasscn/glass-icon";
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
import { cn } from "@/lib/utils";

const CONTENT_WRAP_CLASS = "w-full space-y-8 pb-12";

const isProtectedPlaylist = (pl) =>
  Boolean(
    pl &&
      (pl.id === "1" ||
        pl.isFavorite === true ||
        pl.isRecommended === true ||
        pl.isGenrePlaylist === true)
  );

const isRecommendedPlaylist = (pl) => Boolean(pl && pl.id === "recommended");

function GlassCoverFallback({ title }) {
  return (
    <LiquidGlass
      blur={10}
      refraction={12}
      saturation={1.35}
      className="flex h-full w-full items-center justify-center rounded-2xl [--liquid-glass-rim-width:0.5px]"
    >
      <span className="px-3 text-center text-sm font-semibold tracking-tight text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.4)]">
        {title}
      </span>
    </LiquidGlass>
  );
}

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
          className="rounded-xl p-3.5 [--liquid-glass-rim-width:0.5px]"
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            placeholder="Playlist name"
            className="w-full rounded-lg bg-transparent px-1 py-1 text-sm text-white outline-none placeholder-white/50"
            autoFocus
          />
        </LiquidGlass>
      </div>

      <div className="border-t border-white/10 pt-4">
        <GlassButton
          onClick={handleSubmit}
          disabled={!name.trim()}
          glassVariant="liquid-refract"
          className="w-full rounded-xl py-2.5 text-xs font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitLabel}
        </GlassButton>
      </div>
    </DialogShell>
  );
}

function ConfirmDialog({ open, icon = "delete", title, message, confirmLabel = "Delete", danger = true, onConfirm, onCancel }) {
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
            className="flex-1 cursor-pointer rounded-xl border border-white/20 bg-white/10 py-2.5 text-xs font-semibold text-white hover:bg-white/20 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <GlassButton
            onClick={handleConfirm}
            disabled={busy}
            glassVariant="liquid-refract"
            className={`flex-1 rounded-xl py-2.5 text-xs font-semibold ${danger ? "text-red-300" : "text-white"} disabled:opacity-50`}
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
      onPlaylistPlay?.(playlist.id, tracks[0]);
    }
  };

  const toggleSelection = (playlistId) => {
    const pl = playlists.find((p) => p.id === playlistId);
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

  const getPlaylistImage = (playlist) => {
    if (playlist.image) return playlist.image;
    return null;
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

  if (activePlaylist) {
    return (
      <div className="w-full text-white font-sans antialiased selection:bg-white selection:text-white">
        <div className="mx-auto max-w-5xl space-y-8 pb-12">
          {/* Top bar */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <GlassIcon
                size="sm"
                onClick={() => setActivePlaylistId(null)}
                aria-label="Back to playlists"
                className="text-white cursor-pointer"
                liquidProps={{ blur: 6, refraction: 8 }}
              >
                <ChevronLeft className="h-5 w-5 stroke-[2.5]" />
              </GlassIcon>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white">{activePlaylist.title}</h1>
                <p className="text-xs font-medium text-white/50">
                  {playlistTracks.length} {playlistTracks.length === 1 ? "track" : "tracks"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <GlassIcon
                size="sm"
                onClick={() => handlePlayAll(activePlaylist)}
                className="text-white cursor-pointer"
                aria-label="Play all"
              >
                <Play className="h-4 w-4 fill-current" />
              </GlassIcon>

              {isRecommendedPlaylist(activePlaylist) && (
                <GlassButton
                  onClick={onSaveRecommended}
                  glassVariant="liquid-refract"
                  className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white"
                >
                  <Plus className="h-4 w-4 stroke-[2.5]" />
                  Save to Library
                </GlassButton>
              )}

              {!isProtectedPlaylist(activePlaylist) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/80 hover:bg-white/20 transition-colors"
                    >
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
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
          </div>

          {/* Playlist banner */}
          <div className="flex flex-col items-center gap-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:flex-row sm:items-center">
            <div className="h-48 w-48 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-xl">
              {getPlaylistImage(activePlaylist) ? (
                <img
                  src={getPlaylistImage(activePlaylist)}
                  alt={activePlaylist.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <GlassCoverFallback title={activePlaylist.title} />
              )}
            </div>
            <div className="space-y-1 text-center sm:text-left">
              <h2 className="text-3xl font-extrabold tracking-tight text-white">{activePlaylist.title}</h2>
              <p className="text-sm font-medium text-white/50">
                {playlistTracks.length} {playlistTracks.length === 1 ? "track" : "tracks"}
              </p>
              {isRecommendedPlaylist(activePlaylist) && (
                <p className="text-xs font-medium text-white/40">
                  Picked from your listening taste · refreshes every 24 hours
                </p>
              )}
            </div>
          </div>

          {/* Track list */}
          <div className="space-y-2">
            {playlistTracks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center text-sm text-white/40">
                No songs in this playlist yet. Add songs from search or during playback.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                {playlistTracks.map((track, index) => (
                  <div
                    key={track.id}
                    onClick={() => onPlaylistPlay?.(activePlaylist.id, track)}
                    className="group flex items-center justify-between gap-4 border-b border-white/5 px-4 py-3 transition last:border-0 hover:bg-white/10 cursor-pointer"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <span className="w-5 text-center text-sm font-semibold text-white/40">{index + 1}</span>
                      <img
                        src={track.cover || track.artworkUrl}
                        alt={track.title}
                        className="h-12 w-12 rounded-lg border border-white/10 object-cover"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{track.title}</p>
                        <p className="truncate text-xs font-medium text-white/50">{track.artist}</p>
                      </div>
                    </div>
                    {!isProtectedPlaylist(activePlaylist) && (
                      <button
                        type="button"
                        onClick={(e) => handleRemoveTrack(e, track.id)}
                        aria-label="Remove track"
                        className="rounded-full p-2 text-white/50 opacity-0 transition hover:bg-white/10 hover:text-white focus:opacity-100 group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
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
          onConfirm={() => runDelete(confirmDelete.ids)}
          onCancel={() => setConfirmDelete(null)}
        />
      </div>
    );
  }

  return (
    <div className="w-full text-white font-sans antialiased selection:bg-white selection:text-white">
      <div className={CONTENT_WRAP_CLASS}>
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Your Playlists</h1>
            <p className="text-xs font-medium text-white/50">
              {isSelectionMode
                ? `${selectedCount} selected`
                : `${playlists.length} ${playlists.length === 1 ? "playlist" : "playlists"}`}
            </p>
          </div>

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
        </div>

        {/* Create Playlist Modal */}
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

        {/* Rename Playlist Modal */}
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
          onConfirm={() => runDelete(confirmDelete.ids)}
          onCancel={() => setConfirmDelete(null)}
        />

        {/* Grid */}
        {displayPlaylists.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 py-20 text-center">
            <ListPlus className="mx-auto mb-3 h-8 w-8 text-white/30" />
            <p className="text-sm text-white/50">No playlists yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5 pt-2 sm:grid-cols-3 lg:grid-cols-4">
            {displayPlaylists.map((item) => {
              const isSelected = selectedIds.has(item.id);

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
                  className="group relative cursor-pointer space-y-2"
                >
                  {isSelectionMode && (
                    <div
                      className={`absolute left-3 top-3 z-20 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all ${
                        isSelected ? "border-white bg-white text-black" : "border-white/40 bg-black/20 text-transparent"
                      }`}
                    >
                      {isSelected && <Check className="text-xs text-black" />}
                    </div>
                  )}

                  <div
                    className={`relative aspect-[4/5] overflow-hidden rounded-2xl bg-white/5 shadow-sm transition-all duration-300 ${
                      isSelectionMode && isSelected ? "ring-2 ring-white" : "group-hover:shadow-lg"
                    }`}
                  >
                    {getPlaylistImage(item) ? (
                      <img
                        src={getPlaylistImage(item)}
                        alt={item.title}
                        className={`h-full w-full object-cover transition-transform duration-500 ${
                          isSelectionMode ? "scale-100" : "group-hover:scale-105"
                        }`}
                      />
                    ) : (
                      <GlassCoverFallback title={item.title} />
                    )}

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

                    {!isSelectionMode && isRecommendedPlaylist(item) && (
                      <div
                        className="absolute right-2 top-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={onSaveRecommended}
                          aria-label="Save recommended playlist to your library"
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50 backdrop-blur-md transition-colors"
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
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50 backdrop-blur-md transition-colors"
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

                  <div className="px-0.5">
                    <h3 className="truncate text-sm font-semibold text-white">{item.title}</h3>
                    <p className="mt-0.5 truncate text-xs font-medium text-white/50">
                      {isRecommendedPlaylist(item)
                        ? `${(item.songIds || []).length} songs · refreshes daily`
                        : item.subtitle || `${(item.songIds || []).length} songs`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}