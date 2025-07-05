-- Multi-Level Chunking Database Migration
-- This migration adds support for hierarchical chunking at multiple granularity levels

-- Add new columns for multi-level chunking
ALTER TABLE podcast_chunks ADD COLUMN IF NOT EXISTS chunk_level VARCHAR(20) DEFAULT 'paragraph';
ALTER TABLE podcast_chunks ADD COLUMN IF NOT EXISTS parent_chunk_id INTEGER;
ALTER TABLE podcast_chunks ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE podcast_chunks ADD COLUMN IF NOT EXISTS speaker VARCHAR(255);
ALTER TABLE podcast_chunks ADD COLUMN IF NOT EXISTS topic_boundary BOOLEAN DEFAULT FALSE;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS podcast_chunks_level_idx ON podcast_chunks(chunk_level);
CREATE INDEX IF NOT EXISTS podcast_chunks_parent_idx ON podcast_chunks(parent_chunk_id);
CREATE INDEX IF NOT EXISTS podcast_chunks_topic_boundary_idx ON podcast_chunks(topic_boundary);
CREATE INDEX IF NOT EXISTS podcast_chunks_speaker_idx ON podcast_chunks(speaker);

-- Add foreign key constraint for parent-child relationships
ALTER TABLE podcast_chunks ADD CONSTRAINT fk_parent_chunk 
    FOREIGN KEY (parent_chunk_id) REFERENCES podcast_chunks(id) ON DELETE CASCADE;

-- Update existing chunks to have 'paragraph' level
UPDATE podcast_chunks SET chunk_level = 'paragraph' WHERE chunk_level IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN podcast_chunks.chunk_level IS 'Chunk granularity: episode, topic, paragraph, sentence';
COMMENT ON COLUMN podcast_chunks.parent_chunk_id IS 'Reference to parent chunk for hierarchical relationships';
COMMENT ON COLUMN podcast_chunks.summary IS 'LLM-generated summary for episode-level chunks';
COMMENT ON COLUMN podcast_chunks.speaker IS 'Speaker identification for speaker-based segmentation';
COMMENT ON COLUMN podcast_chunks.topic_boundary IS 'Indicates if this chunk starts a new topic segment';