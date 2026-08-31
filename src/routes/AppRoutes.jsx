import React, { useMemo } from "react";
import { Routes, Route } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLibrary } from "@/context/LibraryContext";
import { usePlayer } from "@/context/PlayerContext";

import HomeView from "@/views/HomeView";
import ExploreView from "@/views/ExploreView";
import KaraokeView from "@/views/KaraokeView";
import RecordingsView from "@/views/RecordingsView";
import PlaylistsView from "@/views/PlaylistsView";
import ArtistView from "@/views/ArtistView";
import SettingsView from "@/views/SettingsView";
import NotFoundView from "@/views/NotFoundView";

export default function AppRoutes({
  searchQuery,
  isUploading,
  onFileUpload,
  isBgUploading,
  onBackgroundUpload,
  bgMediaType,
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
  const { user } = useAuth();
  const {
    userTracks,
    libraryLoaded,
    playlists,
    listeningHistory,
    playedTrackIds,
    recommendedPlaylist,
    genrePlaylists,
    handleAddToPlaylist,
    handleCreatePlaylist,
    handleDeletePlaylist,
    handleRenamePlaylist,
    handleRemoveTrackFromPlaylist,
    handleDeleteTrack,
    handleSaveRecommendedPlaylist,
  } = useLibrary();
  const {
    activeTrack,
    isPlaying,
    duration,
    handlePlayTrack,
    handleTogglePlay,
    handleSeek,
    handlePlaylistPlay,
    karaokeAudioElementRef,
  } = usePlayer();

  const continueListening = useMemo(
    () =>
      playedTrackIds
        .map((id) => userTracks.find((t) => t.id === id))
        .filter(Boolean),
    [userTracks, playedTrackIds]
  );

  const homeElement = (
    <HomeView
      userTracks={userTracks}
      libraryLoaded={libraryLoaded}
      searchQuery={searchQuery}
      isUploading={isUploading}
      onFileUpload={onFileUpload}
      onPlayTrack={handlePlayTrack}
      playlists={playlists}
      onAddToPlaylist={handleAddToPlaylist}
      onDeleteTrack={handleDeleteTrack}
    />
  );

  return (
    <Routes>
      <Route path="/" element={homeElement} />
      <Route path="/home" element={homeElement} />
      <Route
        path="/explore"
        element={
          <ExploreView
            userTracks={userTracks}
            libraryLoaded={libraryLoaded}
            onPlayTrack={handlePlayTrack}
            currentTrack={activeTrack}
            continueListening={continueListening}
            playlists={playlists}
            onAddToPlaylist={handleAddToPlaylist}
            onDeleteTrack={handleDeleteTrack}
            listeningHistory={listeningHistory}
          />
        }
      />
      <Route path="/karaoke/recordings" element={<RecordingsView />} />
      <Route
        path="/karaoke"
        element={
          <KaraokeView
            userTracks={userTracks}
            activeTrack={activeTrack}
            isPlaying={isPlaying}
            onPlayTrack={handlePlayTrack}
            onTogglePlay={handleTogglePlay}
            duration={duration}
            onSeek={handleSeek}
            audioElementRef={karaokeAudioElementRef}
          />
        }
      />
      <Route
        path="/playlists"
        element={
          <PlaylistsView
            playlists={playlists}
            userTracks={userTracks}
            activeTrack={activeTrack}
            isPlaying={isPlaying}
            onTogglePlay={handleTogglePlay}
            onPlayTrack={handlePlayTrack}
            onPlaylistPlay={handlePlaylistPlay}
            onCreatePlaylist={handleCreatePlaylist}
            onDeletePlaylist={handleDeletePlaylist}
            onRenamePlaylist={handleRenamePlaylist}
            onRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
            onAddToPlaylist={handleAddToPlaylist}
            recommendedPlaylist={recommendedPlaylist}
            genrePlaylists={genrePlaylists}
            onSaveRecommended={handleSaveRecommendedPlaylist}
          />
        }
      />
      <Route
        path="/artist/:artistName"
        element={
          <ArtistPageRoute
            userTracks={userTracks}
            onPlayTrack={handlePlayTrack}
            playlists={playlists}
            onAddToPlaylist={handleAddToPlaylist}
            onDeleteTrack={handleDeleteTrack}
            isLibraryLoading={!libraryLoaded}
          />
        }
      />
      <Route
        path="/settings"
        element={
          <SettingsView
            user={user}
            isUploading={isBgUploading}
            onBackgroundUpload={onBackgroundUpload}
            bgMediaType={bgMediaType}
            onChangeBgMediaType={onChangeBgMediaType}
            onSignOut={onSignOut}
            listen={listen}
            discordUser={discordUser}
            isDiscordConnecting={isDiscordConnecting}
            onConnectDiscord={onConnectDiscord}
            linkedDiscordId={linkedDiscordId}
            onDiscordLinked={onDiscordLinked}
            onDiscordUnlinked={onDiscordUnlinked}
          />
        }
      />

      <Route path="*" element={<NotFoundView />} />
    </Routes>
  );
}

function ArtistPageRoute({ isLibraryLoading, ...rest }) {
  return <ArtistView {...rest} isLibraryLoading={isLibraryLoading} />;
}