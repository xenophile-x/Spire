-- Migration: Ensure track_metadata has primary key on track_id for upsert
-- Run this in Supabase SQL Editor if the constraint is missing

-- Check if primary key exists, if not add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'track_metadata_pkey' 
    AND conrelid = 'public.track_metadata'::regclass
  ) THEN
    ALTER TABLE public.track_metadata
    ADD CONSTRAINT track_metadata_pkey PRIMARY KEY (track_id);
    
    RAISE NOTICE 'Added primary key track_metadata_pkey on track_metadata(track_id)';
  ELSE
    RAISE NOTICE 'Primary key track_metadata_pkey already exists';
  END IF;
END $$;

-- Also ensure track_lyrics has primary key (for consistency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'track_lyrics_pkey' 
    AND conrelid = 'public.track_lyrics'::regclass
  ) THEN
    ALTER TABLE public.track_lyrics
    ADD CONSTRAINT track_lyrics_pkey PRIMARY KEY (track_id);
    
    RAISE NOTICE 'Added primary key track_lyrics_pkey on track_lyrics(track_id)';
  ELSE
    RAISE NOTICE 'Primary key track_lyrics_pkey already exists';
  END IF;
END $$;

-- Verify the constraints exist
SELECT 
  conname as constraint_name,
  conrelid::regclass as table_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conname IN ('track_metadata_pkey', 'track_lyrics_pkey')
AND contype = 'p';