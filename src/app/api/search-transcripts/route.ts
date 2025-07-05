import { NextRequest, NextResponse } from 'next/server';
import { connectDb, client } from '@/lib/db';
import { getEmbeddings } from '@/lib/textProcessing';

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Generate embedding for the search query
    const queryEmbeddings = await getEmbeddings([query.trim()]);
    const queryEmbedding = queryEmbeddings[0];
    const embeddingVector = `[${queryEmbedding.join(',')}]`;

    await connectDb();

    // Perform vector similarity search using cosine similarity
    const searchResults = await client.query(
      `SELECT 
        id,
        podcast_id,
        chunk_index,
        text_content,
        created_at,
        1 - (embedding <=> $1::vector) AS similarity
       FROM podcast_chunks
       WHERE embedding IS NOT NULL
         AND (1 - (embedding <=> $1::vector)) > 0.3
       ORDER BY embedding <=> $1::vector
       LIMIT 15`,
      [embeddingVector]
    );

    // Format results
    const results = searchResults.rows.map(row => ({
      id: row.id,
      podcast_id: row.podcast_id,
      chunk_index: row.chunk_index,
      text_content: row.text_content,
      similarity: parseFloat(row.similarity.toFixed(4)),
      created_at: row.created_at
    }));

    return NextResponse.json({
      success: true,
      query,
      results,
      count: results.length
    });

  } catch (error) {
    console.error('Search transcripts error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}