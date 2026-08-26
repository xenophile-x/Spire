import React from "react";
import LegalPage from "@/components/LegalPage";

const SECTIONS = [
  {
    heading: "1. Service Description",
    paragraphs: [
      "Spire is a web-based music streaming architecture that streams audio directly from your personal Google Drive in optimized 10-second data packets. The service provides dynamic metadata, time-synced lyrics, and playlist management using modern web standards.",
    ],
  },
  {
    heading: "2. Account and Security",
    items: [
      "Authentication: You must sign in using Google OAuth to securely connect your Google Drive account and access your custom music library.",
      "Session Security: You are responsible for logging out of your account to ensure your music session and cloud tokens remain secure.",
    ],
  },
  {
    heading: "3. User Content and Storage",
    items: [
      "Cloud Storage: Users upload audio files (such as WAV, MP3, and FLAC) directly to their own Google Drive. Users can save subscription expenses by utilizing their existing Google Drive storage, which includes 15GB of free storage.",
      "Global Catalog: When a user uploads an audio file, Spire checks if the track already exists globally by ISRC or Artist and Title. If it is new, it writes to the global tracks, track_metadata, and track_lyrics tables. Anyone can view global track info, but only authenticated users can add new global tracks.",
    ],
  },
  {
    heading: "4. Playlists and Public Sharing",
    items: [
      "Playlist Creation: Users can create, update, and manage custom playlists using their Google Drive tracks.",
      "Visibility: Playlists are private by default, but owners can view all of their playlists, and the public can view them if the owner sets the public toggle to true. Playlist modifications (insert, update, delete) are strictly restricted to the playlist owner.",
    ],
  },
  {
    heading: "5. Third-Party Integrations",
    items: [
      "Metadata Services: Spire uses LRCLIB and iTunes APIs for automated metadata and time-synced lyrics fetching.",
      "Google Drive: Spire requires read access to your Google Drive-hosted audio files to generate signed URLs and stream the audio via the Google Drive API. Spire overcomes traditional streaming limitations by allowing users to stream local files across several devices without costly cloud installations.",
    ],
  },
];

export default function TermsView() {
  return (
    <LegalPage
      title="Terms of Service"
      effectiveDate="August 16, 2026"
      sections={SECTIONS}
    />
  );
}