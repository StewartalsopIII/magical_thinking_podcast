import { NextRequest, NextResponse } from 'next/server';
import { connectDb, client } from '@/lib/db';
import { markdownToPlainText, chunkTranscript, getEmbeddings } from '@/lib/textProcessing';
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

    const chunks = await chunkTranscript(processedText);
    
    const texts = chunks.map(chunk => chunk.text_content);
    const embeddings = await getEmbeddings(texts);

    await connectDb();
    const podcastId = uuidv4();

    try {
      await client.query('BEGIN');

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddings[i];
        const embeddingVector = `[${embedding.join(',')}]`;

        await client.query(
          `INSERT INTO podcast_chunks (
            podcast_id,
            chunk_index,
            text_content,
            original_markdown,
            embedding,
            timestamp_start,
            timestamp_end,
            metadata
          ) VALUES ($1, $2, $3, $4, $5::vector, $6, $7, $8::jsonb)`,
          [
            podcastId,
            chunk.chunk_index,
            chunk.text_content,
            originalMarkdown,
            embeddingVector,
            chunk.timestamp_start,
            chunk.timestamp_end,
            JSON.stringify(chunk.metadata || {})
          ]
        );
      }

      await client.query('COMMIT');
      console.log(`Successfully saved ${chunks.length} chunks for podcast ID: ${podcastId}`);

      return NextResponse.json({
        success: true,
        podcastId,
        chunksCreated: chunks.length,
        message: 'Transcript processed successfully'
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