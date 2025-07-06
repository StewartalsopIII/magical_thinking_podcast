import { NextRequest, NextResponse } from 'next/server';
import { connectDb, client } from '@/lib/db';
import { getEmbeddings } from '@/lib/textProcessing';
import { classifyQuery, calculateLevelWeight, assembleContext, SearchResult } from '@/lib/smartSearch';

export async function POST(request: NextRequest) {
  try {
    const { query, levels, maxResults = 10, minSimilarity = 0.25 } = await request.json();

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Classify query to determine optimal chunk levels
    const preferredLevels = levels || classifyQuery(query.trim());
    console.log(`Query: "${query}" -> Preferred levels:`, preferredLevels);

    // Generate embedding for the search query
    const queryEmbeddings = await getEmbeddings([query.trim()]);
    const queryEmbedding = queryEmbeddings[0];
    const embeddingVector = `[${queryEmbedding.join(',')}]`;

    await connectDb();

    // Perform multi-level vector similarity search
    const searchResults = await client.query(
      `SELECT 
        id,
        podcast_id,
        chunk_index,
        text_content,
        created_at,
        chunk_level,
        parent_chunk_id,
        summary,
        speaker,
        topic_boundary,
        metadata,
        full_text,
        timestamp_start,
        timestamp_end,
        1 - (embedding <=> $1::vector) AS similarity
       FROM podcast_chunks
       WHERE embedding IS NOT NULL
         AND (1 - (embedding <=> $1::vector)) > $2
         AND chunk_level = ANY($3)
       ORDER BY embedding <=> $1::vector
       LIMIT $4`,
      [embeddingVector, minSimilarity, preferredLevels, maxResults * 2] // Get more to allow for reranking
    );

    // Enhanced results with level-based weighting
    let results: SearchResult[] = searchResults.rows.map(row => {
      const baseScore = parseFloat(row.similarity);
      const levelWeight = calculateLevelWeight(row.chunk_level, preferredLevels);
      const adjustedScore = baseScore * levelWeight;

      return {
        id: row.id,
        podcast_id: row.podcast_id,
        chunk_index: row.chunk_index,
        text_content: row.text_content,
        similarity: parseFloat(adjustedScore.toFixed(4)),
        created_at: row.created_at,
        chunk_level: row.chunk_level,
        parent_chunk_id: row.parent_chunk_id,
        summary: row.summary,
        speaker: row.speaker,
        topic_boundary: row.topic_boundary,
        metadata: row.metadata,
        full_text: row.full_text,
        timestamp_start: row.timestamp_start,
        timestamp_end: row.timestamp_end
      };
    });

    // Re-sort by adjusted similarity score
    results.sort((a, b) => b.similarity - a.similarity);
    
    // Limit to requested number of results
    results = results.slice(0, maxResults);

    // Assemble context for each result (parent/child relationships)
    const allResults = searchResults.rows.map(row => ({
      id: row.id,
      podcast_id: row.podcast_id,
      chunk_index: row.chunk_index,
      text_content: row.text_content,
      similarity: parseFloat(row.similarity),
      created_at: row.created_at,
      chunk_level: row.chunk_level,
      parent_chunk_id: row.parent_chunk_id,
      summary: row.summary,
      speaker: row.speaker,
      topic_boundary: row.topic_boundary,
      full_text: row.full_text,
      timestamp_start: row.timestamp_start,
      timestamp_end: row.timestamp_end
    }));

    // Add context to top results
    const resultsWithContext = results.map(result => ({
      ...result,
      context: assembleContext(result, allResults)
    }));

    const levelBreakdown = results.reduce((acc, result) => {
      acc[result.chunk_level] = (acc[result.chunk_level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      success: true,
      query,
      preferredLevels,
      results: resultsWithContext,
      count: results.length,
      levelBreakdown,
      searchStrategy: {
        minSimilarity,
        maxResults,
        queryClassification: preferredLevels
      }
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