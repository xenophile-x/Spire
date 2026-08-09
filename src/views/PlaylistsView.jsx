import React, { useState } from "react";
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

const CONTENT_WRAP_CLASS = "w-full space-y-8 pb-12";

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
}) {
  const [activePlaylistId, setActivePlaylistId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");

  const filteredPlaylists = playlists;

  const openCreate = () => {
    setIsCreateOpen(true);
    setCreateName("");
  };

  const handleCreateSubmit = async () => {
    const title = createName.trim();
    if (!title) return;
    try {
      await onCreatePlaylist(title);
    } catch (e) {
      console.error("Failed to create playlist:", e);
    }
    setIsCreateOpen(false);
    setCreateName("");
  };

  const handleCreateCancel = () => {
    setIsCreateOpen(false);
    setCreateName("");
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

  const handleDeleteSelected = async () => {
    if (confirm(`Are you sure you want to delete the ${selectedIds.size} selected playlists?`)) {
      try {
        await Promise.all(Array.from(selectedIds).map((id) => onDeletePlaylist(id)));
      } catch (err) {
        console.error("Failed to delete selected playlists:", err);
      }
      setSelectedIds(new Set());
      setIsSelectionMode(false);
    }
  };

  const handleDeletePlaylist = async (playlistId) => {
    if (confirm("Are you sure you want to delete this playlist?")) {
      try {
        await onDeletePlaylist(playlistId);
        if (playlistId === activePlaylistId) {
          setActivePlaylistId(null);
        }
      } catch (err) {
        console.error("Failed to delete playlist:", err);
      }
    }
  };

  const handleRenamePlaylist = async (playlist) => {
    const title = prompt("Rename playlist:", playlist.title);
    if (!title || !title.trim()) return;
    try {
      await onRenamePlaylist(playlist.id, title.trim());
    } catch (err) {
      console.error("Failed to rename playlist:", err);
    }
  };

  const getPlaylistImage = (playlist) => {
    if (playlist.songIds && playlist.songIds.length > 0) {
      const firstSongId = playlist.songIds[0];
      const matchedTrack = userTracks.find((t) => t.id === firstSongId);
      if (matchedTrack?.cover || matchedTrack?.artworkUrl) {
        return matchedTrack.cover || matchedTrack.artworkUrl;
      }
    }
    return playlist.image || null;
  };

  const activePlaylist = playlists.find((pl) => pl.id === activePlaylistId);

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
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/10 to-white/5">
                  <span className="px-2 text-center text-[10px] font-semibold uppercase tracking-wider text-white/80">
                    {activePlaylist.title}
                  </span>
                </div>
              )}
            </div>
            <div className="space-y-1 text-center sm:text-left">
              <h2 className="text-3xl font-extrabold tracking-tight text-white">{activePlaylist.title}</h2>
              <p className="text-sm font-medium text-white/50">
                {playlistTracks.length} {playlistTracks.length === 1 ? "track" : "tracks"}
              </p>
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
                    <button
                      type="button"
                      onClick={(e) => handleRemoveTrack(e, track.id)}
                      aria-label="Remove track"
                      className="rounded-full p-2 text-white/50 opacity-0 transition hover:bg-white/10 hover:text-white focus:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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

        {/* Portal Modal */}
        {isCreateOpen &&
          createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-white/5 backdrop-blur-2xl"
              onClick={(e) => {
                if (e.target === e.currentTarget) handleCreateCancel();
              }}
              role="dialog"
              aria-modal="true"
            >
              <GlassCard
                glassVariant="liquid-refract"
                className="relative w-full max-w-md space-y-5 border border-white/40 bg-white/30 p-6 text-neutral-900 shadow-2xl"
              >
                <div className="flex items-center justify-between pb-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="material-symbols-rounded text-2xl text-white"
                      style={{
                        fontVariationSettings: "'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 24",
                      }}
                    >
                      playlist_add
                    </span>
                    <h3 className="text-lg font-bold tracking-tight text-white">
                      Create New Playlist
                    </h3>
                  </div>
                </div>

                <div className="space-y-4">
                  <LiquidGlass
                    blur={6}
                    refraction={6}
                    saturation={1.2}
                    className="rounded-xl border border-neutral-900/10 bg-white/50 p-1 [--liquid-glass-rim-width:0.5px]"
                  >
                    <input
                      type="text"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      placeholder="Playlist name"
                      className="w-full rounded-lg bg-transparent px-3 py-2.5 text-sm text-neutral-900 outline-none placeholder-neutral-500"
                      autoFocus
                    />
                  </LiquidGlass>
                </div>

                <div className="border-t border-neutral-900/10 pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={handleCreateCancel}
                    className="flex-1 cursor-pointer rounded-xl border border-neutral-900/15 bg-white/30 py-2.5 text-xs font-semibold text-white hover:bg-white/40 transition-all"
                  >
                    Cancel
                  </button>

                  <GlassButton
                    onClick={handleCreateSubmit}
                    disabled={!createName.trim()}
                    glassVariant="liquid-refract"
                    className="flex-1 rounded-xl border border-neutral-900/10 text-white hover:bg-white/20 py-2.5 text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Create
                  </GlassButton>
                </div>
              </GlassCard>
            </div>,
            document.body
          )}

        {/* Grid */}
        {filteredPlaylists.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 py-20 text-center">
            <ListPlus className="mx-auto mb-3 h-8 w-8 text-white/30" />
            <p className="text-sm text-white/50">No playlists yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5 pt-2 sm:grid-cols-3 lg:grid-cols-4">
            {filteredPlaylists.map((item) => {
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
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/10 to-white/5">
                        <span className="px-2 text-center text-[10px] font-semibold uppercase tracking-wider text-white/80">
                          {item.title}
                        </span>
                      </div>
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

                    {!isSelectionMode && (
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
                              glassVariant="liquid-refract"
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
                      {item.subtitle || `${(item.songIds || []).length} songs`}
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