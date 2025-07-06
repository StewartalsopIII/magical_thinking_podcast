import { NextRequest, NextResponse } from 'next/server';
import { connectDb, client } from '@/lib/db';
import { markdownToPlainText, getEmbeddings } from '@/lib/textProcessing';
import { createMultiLevelChunks, ChunkData } from '@/lib/multiLevelChunking';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const isMarkdown = fileName.endsWith('.md') || fileName.endsWith('.markdown');
    
    if (!isMarkdown && !fileName.endsWith('.txt')) {
      return NextResponse.json({ error: 'Only .txt and .md files are supported' }, { status: 400 });
    }

    const fileContent = await file.text();
    const originalMarkdown = isMarkdown ? fileContent : null;

    let processedText = fileContent;
    if (isMarkdown) {
      processedText = await markdownToPlainText(fileContent);
    }

    console.log('Starting multi-level chunking...');
    const allChunks = await createMultiLevelChunks(processedText, originalMarkdown);
    
    // Generate embeddings for all chunks
    console.log('Generating embeddings for all chunks...');
    const texts = allChunks.map(chunk => {
      // For episode-level chunks, use summary for embedding if available
      if (chunk.chunk_level === 'episode' && chunk.summary) {
        return chunk.summary;
      }
      return chunk.text_content;
    });
    
    const embeddings = await getEmbeddings(texts);

    await connectDb();
    const podcastId = uuidv4();

    try {
      await client.query('BEGIN');

      // Store all chunks with their hierarchical relationships
      const insertedChunks: { [key: number]: number } = {}; // Map chunk_index to actual database ID

      for (let i = 0; i < allChunks.length; i++) {
        const chunk = allChunks[i];
        const embedding = embeddings[i];
        const embeddingVector = `[${embedding.join(',')}]`;

        // Resolve parent_chunk_id to actual database ID
        let actualParentId = null;
        if (chunk.parent_chunk_id !== undefined) {
          actualParentId = insertedChunks[chunk.parent_chunk_id] || null;
        }

        const result = await client.query(
          `INSERT INTO podcast_chunks (
            podcast_id,
            chunk_index,
            text_content,
            original_markdown,
            embedding,
            timestamp_start,
            timestamp_end,
            metadata,
            chunk_level,
            parent_chunk_id,
            summary,
            speaker,
            topic_boundary,
            full_text,
            chapter_title,
            chapter_theme,
            chapter_index,
            guest_name
          ) VALUES ($1, $2, $3, $4, $5::vector, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          RETURNING id`,
          [
            podcastId,
            chunk.chunk_index,
            chunk.text_content,
            originalMarkdown,
            embeddingVector,
            chunk.timestamp_start,
            chunk.timestamp_end,
            JSON.stringify(chunk.metadata || {}),
            chunk.chunk_level,
            actualParentId,
            chunk.summary || null,
            chunk.speaker || null,
            chunk.topic_boundary || false,
            chunk.full_text || null,
            chunk.chapter_title || null,
            chunk.chapter_theme || null,
            chunk.chapter_index || null,
            chunk.guest_name || null
          ]
        );

        // Store the mapping of chunk_index to actual database ID
        insertedChunks[chunk.chunk_index] = result.rows[0].id;
      }

      await client.query('COMMIT');
      
      const chunkCounts = {
        episode: allChunks.filter(c => c.chunk_level === 'episode').length,
        topic: allChunks.filter(c => c.chunk_level === 'topic').length,
        paragraph: allChunks.filter(c => c.chunk_level === 'paragraph').length,
        sentence: allChunks.filter(c => c.chunk_level === 'sentence').length
      };

      console.log(`Successfully saved ${allChunks.length} chunks for podcast ID: ${podcastId}`, chunkCounts);

      return NextResponse.json({
        success: true,
        podcastId,
        chunksCreated: allChunks.length,
        chunkBreakdown: chunkCounts,
        message: 'Transcript processed with multi-level chunking'
      });

    } catch (dbError) {
      await client.query('ROLLBACK');
      console.error('Database error:', dbError);
      throw new Error('Failed to save transcript chunks to database');
    }

  } catch (error) {
    console.error('Upload transcript error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}