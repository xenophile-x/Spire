import React from "react";
import LegalPage from "@/components/LegalPage";

const SECTIONS = [
  {
    heading: "1. Information We Collect",
    paragraphs: [
      "To provide a seamless, cloud-native web application experience, Spire collects and processes the following information:",
    ],
    items: [
      "Authentication Data: We use OAuth 2.0 \"Continue as Google\" to securely link your personal Google Drive repository. Supabase Auth creates a secure identity in auth.users, and a database trigger automatically creates a mirrored profile in our public users table containing your display name, email, and Google ID.",
      "Google Drive Data: Spire connects to your Google Drive to scan and import your uploaded audio tracks. We store the Google Drive File ID where the actual audio file is hosted, rather than the file itself. Spire does not retain your master credentials.",
      "Usage and Library Data: We store your login session ID in Supabase to keep you authenticated across browser refreshes. We also log every time you play a track, alongside a timestamp and genre, in a listening_history table.",
      "User Preferences: Spire records which tracks you have \"hearted\" in a liked_songs table and manages your custom playlists in playlists and playlist_tracks tables.",
    ],
  },
  {
    heading: "2. How We Store and Protect Your Data",
    items: [
      "Database Architecture: We utilize a Global Catalog and User Library model via Supabase (PostgreSQL). Audio tracks, metadata, and lyrics exist globally to prevent duplication, while your personal library, playlists, and history are linked to these global tracks via foreign keys.",
      "Access Control: Data access is strictly controlled at the database level using Supabase Row Level Security (RLS). This ensures that only the authenticated owner can select, insert, update, or delete their private user data (such as libraries, history, and liked songs).",
      "Caching and Metadata: Track details, genres, synced lyrics, and user playlists are stored in a Supabase backend for quick access. Metadata and lyrics are fetched using MusicBrainz, LRCLIB, Genius, and iTunes APIs.",
    ],
  },
  {
    heading: "3. Data Deletion and Ownership",
    items: [
      "User Ownership: Spire respects absolute user data ownership by relying on your personal Google Drive for audio file storage.",
      "Account Deletion: If a user deletes their account from the users table, all associated history, metadata, and library references are automatically deleted via ON DELETE CASCADE to prevent database bloat.",
    ],
  },
];

export default function PrivacyView() {
  return (
    <LegalPage
      title="Privacy Policy"
      effectiveDate="August 16, 2026"
      sections={SECTIONS}
    />
  );
}