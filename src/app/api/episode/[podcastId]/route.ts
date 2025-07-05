import { NextRequest, NextResponse } from 'next/server';
import { connectDb, client } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { podcastId: string } }
) {
  try {
    const { podcastId } = params;

    if (!podcastId) {
      return NextResponse.json({ error: 'Podcast ID is required' }, { status: 400 });
    }

    await connectDb();

    // Get episode-level chunk for summary and metadata
    const episodeQuery = await client.query(`
      SELECT 
        id,
        podcast_id,
        summary,
        full_text,
        created_at,
        metadata
      FROM podcast_chunks 
      WHERE podcast_id = $1 AND chunk_level = 'episode'
      LIMIT 1
    `, [podcastId]);

    if (episodeQuery.rows.length === 0) {
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
    }

    const episode = episodeQuery.rows[0];

    // Get all chunks for this episode grouped by level
    const chunksQuery = await client.query(`
      SELECT 
        id,
        chunk_index,
        chunk_level,
        text_content,
        parent_chunk_id,
        speaker,
        topic_boundary,
        timestamp_start,
        timestamp_end,
        chapter_title,
        chapter_theme,
        chapter_index,
        metadata,
        created_at
      FROM podcast_chunks 
      WHERE podcast_id = $1 
      ORDER BY chunk_level, chunk_index
    `, [podcastId]);

    // Group chunks by level
    const chunksByLevel = chunksQuery.rows.reduce((acc, chunk) => {
      if (!acc[chunk.chunk_level]) {
        acc[chunk.chunk_level] = [];
      }
      acc[chunk.chunk_level].push({
        id: chunk.id,
        chunk_index: chunk.chunk_index,
        chunk_level: chunk.chunk_level,
        text_content: chunk.text_content,
        parent_chunk_id: chunk.parent_chunk_id,
        speaker: chunk.speaker,
        topic_boundary: chunk.topic_boundary,
        timestamp_start: chunk.timestamp_start,
        timestamp_end: chunk.timestamp_end,
        chapter_title: chunk.chapter_title,
        chapter_theme: chunk.chapter_theme,
        chapter_index: chunk.chapter_index,
        metadata: chunk.metadata,
        created_at: chunk.created_at
      });
      return acc;
    }, {} as Record<string, any[]>);

    // Get chunk statistics
    const statsQuery = await client.query(`
      SELECT 
        chunk_level,
        COUNT(*) as count,
        COUNT(DISTINCT speaker) FILTER (WHERE speaker IS NOT NULL) as unique_speakers_in_level
      FROM podcast_chunks 
      WHERE podcast_id = $1 
      GROUP BY chunk_level
      ORDER BY 
        CASE chunk_level 
          WHEN 'episode' THEN 1 
          WHEN 'topic' THEN 2 
          WHEN 'paragraph' THEN 3 
          WHEN 'sentence' THEN 4 
        END
    `, [podcastId]);

    // Get speaker analysis for this episode
    const speakersQuery = await client.query(`
      SELECT 
        speaker,
        COUNT(*) as chunk_count,
        array_agg(DISTINCT chunk_level) as levels_spoken_in
      FROM podcast_chunks 
      WHERE podcast_id = $1 AND speaker IS NOT NULL
      GROUP BY speaker
      ORDER BY chunk_count DESC
    `, [podcastId]);

    // Calculate episode metrics
    const fullTextLength = episode.full_text ? episode.full_text.length : 0;
    const wordCount = episode.full_text ? episode.full_text.split(/\s+/).length : 0;
    const readingTime = Math.round(wordCount / 200);

    return NextResponse.json({
      success: true,
      episode: {
        id: episode.id,
        podcast_id: episode.podcast_id,
        summary: episode.summary,
        full_text: episode.full_text,
        created_at: episode.created_at,
        metadata: episode.metadata,
        character_count: fullTextLength,
        word_count: wordCount,
        reading_time: readingTime
      },
      chunks: chunksByLevel,
      stats: statsQuery.rows.map(row => ({
        level: row.chunk_level,
        count: parseInt(row.count),
        unique_speakers: parseInt(row.unique_speakers_in_level || '0')
      })),
      speakers: speakersQuery.rows.map(row => ({
        name: row.speaker,
        chunk_count: parseInt(row.chunk_count),
        levels: row.levels_spoken_in
      })),
      totalChunks: chunksQuery.rows.length
    });

  } catch (error) {
    console.error('Episode API error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}