-- Add chapter support to database
ALTER TABLE podcast_chunks ADD COLUMN IF NOT EXISTS chapter_title VARCHAR(255);
ALTER TABLE podcast_chunks ADD COLUMN IF NOT EXISTS chapter_theme TEXT;
ALTER TABLE podcast_chunks ADD COLUMN IF NOT EXISTS chapter_index INTEGER;

-- Create index for chapter queries
CREATE INDEX IF NOT EXISTS podcast_chunks_chapter_idx ON podcast_chunks(podcast_id, chapter_index);

-- Add comments for documentation
COMMENT ON COLUMN podcast_chunks.chapter_title IS 'LLM-generated chapter title';
COMMENT ON COLUMN podcast_chunks.chapter_theme IS 'LLM-generated chapter theme description';
COMMENT ON COLUMN podcast_chunks.chapter_index IS 'Chapter number within the episode (0-based)';