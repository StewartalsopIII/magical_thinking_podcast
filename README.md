# Magical Thinking Podcast - RAG System

A Next.js application for uploading podcast transcripts, processing them with text chunking, generating embeddings using DeepInfra's BGE-M3 model, and storing them in PostgreSQL with pgvector for semantic search.

## Features

- **Drag & Drop Upload**: Easy file upload for .txt and .md files
- **Markdown Processing**: Converts markdown to plain text while preserving original
- **Text Chunking**: Uses LangChain's RecursiveCharacterTextSplitter 
- **Vector Embeddings**: Generates embeddings using DeepInfra's BGE-M3 model
- **PostgreSQL Storage**: Stores chunks and embeddings in PostgreSQL with pgvector

## Setup

### 1. Database Setup

Start PostgreSQL with pgvector:

```bash
docker-compose up -d
```

### 2. Environment Variables

Update `.env.local` with your DeepInfra API key:

```
DATABASE_URL="postgresql://transcript_user:transcript_password@localhost:5433/transcript_db"
DEEPINFRA_API_KEY="your_deepinfra_api_key_here"
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to use the application.

## Database Schema

The application uses a single `podcast_chunks` table with the following structure:

- `id`: Primary key
- `podcast_id`: UUID to group chunks from the same transcript
- `chunk_index`: Order of the chunk within the transcript
- `text_content`: Plain text content of the chunk
- `original_markdown`: Original markdown content (if applicable)
- `embedding`: Vector embedding (1024 dimensions)
- `timestamp_start/end`: Placeholder for future timestamp extraction
- `metadata`: JSONB for additional metadata
- `created_at/updated_at`: Timestamps

## API Endpoints

- `POST /api/upload-transcript`: Uploads and processes transcript files

## Tech Stack

- **Frontend**: Next.js 14 with App Router, React, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with pgvector extension
- **Text Processing**: LangChain text splitters, markdown-it
- **Embeddings**: DeepInfra BGE-M3 model
- **File Upload**: react-dropzone

## Architecture

1. **File Upload**: Drag & drop interface using react-dropzone
2. **Text Processing**: Markdown converted to plain text, then chunked
3. **Embedding Generation**: Each chunk processed through DeepInfra API
4. **Database Storage**: Chunks and embeddings stored in PostgreSQL
5. **Error Handling**: Comprehensive error handling throughout the pipeline