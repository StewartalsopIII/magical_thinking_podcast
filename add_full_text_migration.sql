-- Add full_text column to store complete transcript
ALTER TABLE podcast_chunks ADD COLUMN IF NOT EXISTS full_text TEXT;

-- Create index for full-text search if needed
CREATE INDEX IF NOT EXISTS podcast_chunks_full_text_idx ON podcast_chunks USING gin(to_tsvector('english', full_text));

-- Add comment for documentation
COMMENT ON COLUMN podcast_chunks.full_text IS 'Complete transcript text, stored only for episode-level chunks';