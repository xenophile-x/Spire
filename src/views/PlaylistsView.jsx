import React, { useState } from "react";
import { ListPlus, FolderPlus, Plus, ChevronLeft, Trash2, Play, MoreHorizontal, Pencil, X } from "lucide-react";
import "material-symbols/rounded.css";
import { GlassIcon } from "@/components/ui/glasscn/glass-icon";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { GlassDropdownMenuContent } from "@/components/ui/glasscn/glass-dropdown-menu";
import { LiquidGlass } from "@/components/ui/glasscn/liquid-glass";

export default function PlaylistsView({
  playlists = [],
  setPlaylists = () => {},
  userTracks = [],
  onPlayTrack = () => {},
  onPlaylistPlay = () => {},
}) {
  const [activePlaylistId, setActivePlaylistId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [createType, setCreateType] = useState(null);
  const [createName, setCreateName] = useState("");

  const filteredPlaylists = playlists;

  const handleCreatePlaylist = () => {
    setCreateType("playlist");
    setCreateName("");
  };

  const handleCreateFolder = () => {
    setCreateType("folder");
    setCreateName("");
  };

  const handleCreateSubmit = () => {
    const title = createName.trim();
    if (!title) return;

    if (createType === "playlist") {
      setPlaylists((prev) => [...prev, { id: Date.now().toString(), title, songIds: [] }]);
    } else if (createType === "folder") {
      setPlaylists((prev) => [...prev, { id: Date.now().toString(), title, isFolder: true, songIds: [], covers: [] }]);
    }

    setCreateType(null);
    setCreateName("");
  };

  const handleCreateCancel = () => {
    setCreateType(null);
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

  const toggleSelection = (e, playlistId) => {
    e.stopPropagation();
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
    setPlaylists((prev) => prev.filter((pl) => !selectedIds.has(pl.id)));
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  const handleDeletePlaylist = (playlistId) => {
    setPlaylists((prev) => prev.filter((pl) => pl.id !== playlistId));
  };

  const handleRenamePlaylist = (playlist) => {
    const title = prompt("Rename playlist:", playlist.title);
    if (!title || !title.trim()) return;
    setPlaylists((prev) =>
      prev.map((pl) => (pl.id === playlist.id ? { ...pl, title: title.trim() } : pl))
    );
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

  const handleRemoveTrack = (e, trackId) => {
    e.stopPropagation();
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id === activePlaylistId) {
          return {
            ...pl,
            songIds: (pl.songIds || []).filter((id) => id !== trackId),
          };
        }
        return pl;
      })
    );
  };

  const selectedCount = selectedIds.size;

  if (activePlaylist) {
    return (
      <div className="w-full text-white p-2 font-sans antialiased selection:bg-white selection:text-white">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Back Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <GlassIcon
                size="sm"
                onClick={() => setActivePlaylistId(null)}
                aria-label="Back to playlists"
                className="text-white"
                liquidProps={{ blur: 6, refraction: 8 }}
              >
                <ChevronLeft className="h-5 w-5 stroke-[2.5]" />
              </GlassIcon>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white">{activePlaylist.title}</h1>
                <p className="text-xs text-neutral-500/50">{playlistTracks.length} tracks</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <GlassIcon
                size="sm"
                onClick={() => handlePlayAll(activePlaylist)}
                className="text-white"
              >
                <Play className="h-4 w-4 fill-current" />
              </GlassIcon>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <GlassIcon
                    size="sm"
                    aria-label="Playlist options"
                    className="text-neutral-400"
                    liquidProps={{ blur: 6, refraction: 8 }}
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </GlassIcon>
                </DropdownMenuTrigger>
                <DropdownMenuPortal>
                  <GlassDropdownMenuContent
                    glassVariant="liquid-refract"
                    align="end"
                    sideOffset={8}
                    className="w-56"
                  >
                    <DropdownMenuItem onClick={() => handleRenamePlaylist(activePlaylist)}>
                      <Pencil className="w-4 h-4 mr-2 text-white" />
                      <span className="text-white">Rename</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDeletePlaylist(activePlaylist.id)}>
                      <Trash2 className="w-4 h-4 mr-2 text-white" />
                      <span className="text-white">Delete Playlist</span>
                    </DropdownMenuItem>
                  </GlassDropdownMenuContent>
                </DropdownMenuPortal>
              </DropdownMenu>
            </div>
          </div>

          {/* Playlist Info Banner */}
          <div className="flex flex-col sm:flex-row items-center gap-6 bg-white/5 p-6 rounded-3xl border border-neutral-500/50">
              <div className="w-40 h-40 shrink-0 rounded-2xl overflow-hidden shadow-xl bg-white/5">
                {getPlaylistImage(activePlaylist) ? (
                  <img
                    src={getPlaylistImage(activePlaylist)}
                    alt={activePlaylist.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/10 to-white/5 border border-neutral-500/50">
                    <span className="px-1 text-center text-[10px] font-semibold uppercase tracking-wider text-white/80">
                      {activePlaylist.title}
                    </span>
                  </div>
                )}
              </div>
            <div className="text-center sm:text-left space-y-2">
              <h2 className="text-3xl font-extrabold tracking-tight text-white">{activePlaylist.title}</h2>
              <p className="text-sm text-neutral-500/50">{playlistTracks.length} tracks</p>
            </div>
          </div>

          {/* Playlist Tracks List */}
          <div className="space-y-3">
            {playlistTracks.length === 0 ? (
              <div className="text-center py-16 text-neutral-500/50 italic">
                No songs in this playlist yet. Add songs from search or during playback.
              </div>
            ) : (
              <div className="space-y-1">
                {playlistTracks.map((track, index) => (
                  <div
                    key={track.id}
                    onClick={() => onPlaylistPlay?.(activePlaylist.id, track)}
                    className="group flex items-center justify-between gap-4 p-3 rounded-2xl hover:bg-white/10 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="w-4 text-sm font-semibold text-neutral-500/50 text-center">{index + 1}</span>
                      <img
                        src={track.cover || track.artworkUrl}
                        alt={track.title}
                        className="w-12 h-12 rounded-lg object-cover border border-neutral-500/50"
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate text-white">{track.title}</p>
                        <p className="text-xs text-neutral-500/50 truncate">{track.artist}</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleRemoveTrack(e, track.id)}
                      className="opacity-0 group-hover:opacity-100 p-2 rounded-full hover:bg-white/10 transition text-white/60 hover:text-white focus:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
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
    <div className="w-full text-white p-2 font-sans antialiased selection:bg-white selection:text-white">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex items-center justify-between relative">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Albums</h1>
            <p className="text-xs text-neutral-500/50">
              {isSelectionMode
                ? `${selectedCount} selected`
                : `${playlists.length} playlists total`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isSelectionMode ? (
              <>
                <GlassIcon
                  size="sm"
                  onClick={exitSelectionMode}
                  aria-label="Cancel selection"
                  className="text-white"
                  liquidProps={{ blur: 6, refraction: 8 }}
                >
                  <X className="h-5 w-5" />
                </GlassIcon>
              </>
            ) : (
              <>
                <GlassIcon
                  size="sm"
                  onClick={enterSelectionMode}
                  aria-label="Select playlists"
                  className="text-white"
                  liquidProps={{ blur: 6, refraction: 8 }}
                >
                  <span className="material-symbols-rounded text-base">select_all</span>
                </GlassIcon>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <GlassIcon
                      size="sm"
                      aria-label="Add options"
                      className="text-white"
                      liquidProps={{ blur: 6, refraction: 8 }}
                    >
                      <Plus className="h-5 w-5 stroke-[2.5] text-white" />
                    </GlassIcon>
                  </DropdownMenuTrigger>
                  <DropdownMenuPortal>
                    <GlassDropdownMenuContent
                      glassVariant="liquid-refract"
                      align="end"
                      sideOffset={8}
                      className="w-56"
                    >
                      <DropdownMenuItem onClick={handleCreatePlaylist}>
                        <ListPlus className="w-4 h-4 mr-2 text-white" />
                        <span className="text-white">Create New Playlist</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleCreateFolder}>
                        <FolderPlus className="w-4 h-4 mr-2 text-white" />
                        <span className="text-white">Create New Folder</span>
                      </DropdownMenuItem>
                    </GlassDropdownMenuContent>
                  </DropdownMenuPortal>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>

        {/* Create Input */}
        {createType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
            <GlassCard
              glassVariant="liquid-refract"
              liquidProps={{ blur: 12, refraction: 14, saturation: 1.45, className: "rounded-3xl" }}
              className="relative w-full max-w-md space-y-5 p-6 text-white"
            >
              <div className="flex items-center justify-between pb-4">
                <h3 className="text-lg font-bold tracking-tight text-white">
                  {createType === "playlist" ? "Create New Playlist" : "Create New Folder"}
                </h3>
                <button
                  onClick={handleCreateCancel}
                  aria-label="Close modal"
                  className="cursor-pointer rounded-full p-1.5 text-white/70 transition-all hover:bg-white/10 hover:text-white"
                >
                  <span className="material-symbols-rounded block text-xl">close</span>
                </button>
              </div>

              <div className="space-y-4">
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Enter name..."
                  className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-white/50 outline-none focus:border-white/40 focus:bg-white/15"
                  autoFocus
                />

                <div className="flex gap-3">
                  <button
                    onClick={handleCreateCancel}
                    className="flex-1 cursor-pointer rounded-xl border border-white/20 bg-white/10 py-2.5 text-xs font-semibold text-white hover:bg-white/20 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateSubmit}
                    disabled={!createName.trim()}
                    className="flex-1 cursor-pointer rounded-xl border border-white/20 bg-white py-2.5 text-xs font-semibold text-black hover:bg-white/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Create
                  </button>
                </div>
              </div>
            </GlassCard>
          </div>
        )}

        {/* Selection Mode Banner */}
        {isSelectionMode && (
          <div className="flex items-center justify-between rounded-2xl bg-white/5 p-4 border border-white/10">
            <p className="text-sm text-neutral-500/50">
              {selectedCount === 0
                ? "Tap playlists to select them for deletion"
                : `${selectedCount} playlist${selectedCount > 1 ? "s" : ""} selected`}
            </p>
            <button
              onClick={handleDeleteSelected}
              disabled={selectedCount === 0}
              className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white border border-white/20 hover:bg-white/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Selected
            </button>
          </div>
        )}

        {/* Square Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 pt-2">
          {filteredPlaylists.map((item) => {
            const isSelected = selectedIds.has(item.id);

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (isSelectionMode) {
                    toggleSelection({ stopPropagation: () => {} }, item.id);
                  } else {
                    setActivePlaylistId(item.id);
                  }
                }}
                className="group relative space-y-2 cursor-pointer"
              >
                {/* Selection Indicator */}
                {isSelectionMode && (
                  <div
                    className={`absolute top-3 left-3 z-20 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all ${
                      isSelected
                        ? "bg-white border-white text-black"
                        : "bg-black/20 border-white/40 text-transparent"
                    }`}
                  >
                    {isSelected && <span className="material-symbols-rounded text-xs">check</span>}
                  </div>
                )}

                {/* Cover Card Container */}
                <div
                  className={`aspect-square relative rounded-2xl overflow-hidden bg-white/5 shadow-sm transition-all duration-300 ${
                    isSelectionMode && isSelected
                      ? "ring-2 ring-white shadow-md"
                      : "group-hover:shadow-md"
                  }`}
                >
                  {/* Cover (folder / image / text fallback) */}
                  {item.isFolder && (item.songIds || []).length === 0 ? (
                    /* Dual Cover Folder Display */
                    <div className="w-full h-full bg-[#ededf0] p-3 flex items-center justify-center gap-2">
                      {item.covers?.map((src, i) => (
                        <img
                          key={i}
                          src={src}
                          alt=""
                          className="w-1/2 aspect-square object-cover rounded-lg shadow-sm"
                        />
                      ))}
                    </div>
                  ) : getPlaylistImage(item) ? (
                    /* First track's photo */
                    <img
                      src={getPlaylistImage(item)}
                      alt={item.title}
                      className={`w-full h-full object-cover transition-transform duration-500 ${
                        isSelectionMode ? "scale-100" : "group-hover:scale-105"
                      }`}
                    />
                  ) : (
                    /* Text fallback — no stock imagery */
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/10 to-white/5 border border-neutral-500/50">
                      <span className="px-1 text-center text-[10px] font-semibold uppercase tracking-wider text-white/80">
                        {item.title}
                      </span>
                    </div>
                  )}

                  {/* Play All Overlay */}
                  {!isSelectionMode && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <GlassIcon
                        size="lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayAll(item);
                        }}
                        className="text-white"
                      >
                        <Play className="h-5 w-5 fill-current" />
                      </GlassIcon>
                    </div>
                  )}

                  {/* Card Menu Button */}
                  {!isSelectionMode && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <GlassIcon
                            size="sm"
                            className="bg-black/20 text-white hover:bg-white/20"
                            liquidProps={{ blur: 4, refraction: 4 }}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </GlassIcon>
                        </DropdownMenuTrigger>
                        <DropdownMenuPortal>
                          <GlassDropdownMenuContent
                            glassVariant="liquid-refract"
                            align="end"
                            sideOffset={4}
                            className="w-44"
                          >
                            <DropdownMenuItem onClick={() => handleRenamePlaylist(item)}>
                              <Pencil className="w-4 h-4 mr-2 text-white" />
                              <span className="text-white">Rename</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeletePlaylist(item.id)}>
                              <Trash2 className="w-4 h-4 mr-2 text-white" />
                              <span className="text-white">Delete</span>
                            </DropdownMenuItem>
                          </GlassDropdownMenuContent>
                        </DropdownMenuPortal>
                      </DropdownMenu>
                    </div>
                  )}
                </div>

                {/* Title & Subtitle */}
                <div>
                  <h3 className="font-semibold text-sm text-white truncate">{item.title}</h3>
                  <p className="text-xs text-neutral-500/50 font-medium truncate mt-0.5">
                    {item.subtitle || `${(item.songIds || []).length} songs`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
