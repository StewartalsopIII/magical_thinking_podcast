import { NextRequest, NextResponse } from 'next/server';
import { connectDb, client } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    await connectDb();

    // Get overall statistics
    const statsQuery = await client.query(`
      SELECT 
        COUNT(DISTINCT podcast_id) as total_episodes,
        COUNT(*) as total_chunks,
        COUNT(*) FILTER (WHERE chunk_level = 'episode') as episode_chunks,
        COUNT(*) FILTER (WHERE chunk_level = 'topic') as topic_chunks,
        COUNT(*) FILTER (WHERE chunk_level = 'paragraph') as paragraph_chunks,
        COUNT(*) FILTER (WHERE chunk_level = 'sentence') as sentence_chunks,
        AVG(CASE WHEN chunk_level = 'episode' AND full_text IS NOT NULL 
            THEN LENGTH(full_text) END) as avg_episode_length,
        COUNT(DISTINCT speaker) FILTER (WHERE speaker IS NOT NULL) as unique_speakers
      FROM podcast_chunks
    `);

    // Get episode summaries and metadata
    const episodesQuery = await client.query(`
      SELECT 
        podcast_id,
        summary,
        created_at,
        LENGTH(full_text) as character_count,
        (LENGTH(full_text) - LENGTH(REPLACE(full_text, ' ', '')) + 1) as word_count,
        metadata
      FROM podcast_chunks 
      WHERE chunk_level = 'episode'
      ORDER BY created_at DESC
      LIMIT 50
    `);

    // Get chunk level distribution by episode
    const chunkDistributionQuery = await client.query(`
      SELECT 
        podcast_id,
        chunk_level,
        COUNT(*) as count
      FROM podcast_chunks
      GROUP BY podcast_id, chunk_level
      ORDER BY podcast_id, chunk_level
    `);

    // Get speaker distribution
    const speakerQuery = await client.query(`
      SELECT 
        speaker,
        COUNT(*) as chunk_count,
        COUNT(DISTINCT podcast_id) as episode_count
      FROM podcast_chunks 
      WHERE speaker IS NOT NULL 
      GROUP BY speaker
      ORDER BY chunk_count DESC
      LIMIT 20
    `);

    // Get topic boundary analysis
    const topicQuery = await client.query(`
      SELECT 
        podcast_id,
        COUNT(*) FILTER (WHERE topic_boundary = true) as topic_segments,
        COUNT(*) as total_chunks
      FROM podcast_chunks
      WHERE chunk_level = 'topic'
      GROUP BY podcast_id
      ORDER BY topic_segments DESC
    `);

    // Get recent upload activity
    const activityQuery = await client.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(DISTINCT podcast_id) as episodes_uploaded,
        SUM(CASE WHEN chunk_level = 'episode' AND full_text IS NOT NULL 
            THEN LENGTH(full_text) END) as total_characters
      FROM podcast_chunks
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    // Process chunk distribution for visualization
    const chunkDistribution = chunkDistributionQuery.rows.reduce((acc, row) => {
      if (!acc[row.podcast_id]) {
        acc[row.podcast_id] = {};
      }
      acc[row.podcast_id][row.chunk_level] = parseInt(row.count);
      return acc;
    }, {} as Record<string, Record<string, number>>);

    return NextResponse.json({
      success: true,
      stats: statsQuery.rows[0],
      episodes: episodesQuery.rows.map(row => ({
        podcast_id: row.podcast_id,
        summary: row.summary,
        created_at: row.created_at,
        character_count: parseInt(row.character_count) || 0,
        word_count: parseInt(row.word_count) || 0,
        metadata: row.metadata,
        reading_time: Math.round((parseInt(row.word_count) || 0) / 200)
      })),
      chunkDistribution,
      speakers: speakerQuery.rows.map(row => ({
        name: row.speaker,
        chunk_count: parseInt(row.chunk_count),
        episode_count: parseInt(row.episode_count)
      })),
      topics: topicQuery.rows.map(row => ({
        podcast_id: row.podcast_id,
        topic_segments: parseInt(row.topic_segments),
        total_chunks: parseInt(row.total_chunks)
      })),
      activity: activityQuery.rows.map(row => ({
        date: row.date,
        episodes_uploaded: parseInt(row.episodes_uploaded),
        total_characters: parseInt(row.total_characters) || 0
      }))
    });

  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}