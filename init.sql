-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the podcast_chunks table
CREATE TABLE IF NOT EXISTS podcast_chunks (
    id SERIAL PRIMARY KEY,
    podcast_id UUID NOT NULL,
    chunk_index INT NOT NULL,
    text_content TEXT NOT NULL,
    original_markdown TEXT,
    embedding VECTOR(1024),
    timestamp_start TEXT,
    timestamp_end TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create an index for efficient vector similarity search using HNSW
CREATE INDEX IF NOT EXISTS podcast_chunks_embedding_idx
ON podcast_chunks USING hnsw (embedding vector_cosine_ops);

-- Create additional indexes for common queries
CREATE INDEX IF NOT EXISTS podcast_chunks_podcast_id_idx ON podcast_chunks(podcast_id);
CREATE INDEX IF NOT EXISTS podcast_chunks_chunk_index_idx ON podcast_chunks(chunk_index);
CREATE INDEX IF NOT EXISTS podcast_chunks_created_at_idx ON podcast_chunks(created_at);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a trigger to automatically update the updated_at column
CREATE TRIGGER update_podcast_chunks_updated_at BEFORE UPDATE
ON podcast_chunks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions to the transcript_user (Assuming this user is created via Docker env vars)
GRANT ALL PRIVILEGES ON DATABASE transcript_db TO transcript_user;
GRANT ALL PRIVILEGES ON SCHEMA public TO transcript_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO transcript_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO transcript_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO transcript_user;

-- Set default privileges for future objects (important for new tables/sequences created later)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO transcript_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO transcript_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO transcript_user;

-- Grant permissions on the new table and sequence (redundant if default privileges work, but good for explicit safety)
GRANT ALL PRIVILEGES ON TABLE podcast_chunks TO transcript_user;
GRANT ALL PRIVILEGES ON SEQUENCE podcast_chunks_id_seq TO transcript_user;