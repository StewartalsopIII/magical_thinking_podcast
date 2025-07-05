'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface EpisodeData {
  episode: {
    id: number;
    podcast_id: string;
    summary: string;
    full_text: string;
    created_at: string;
    metadata: any;
    character_count: number;
    word_count: number;
    reading_time: number;
  };
  chunks: Record<string, Array<{
    id: number;
    chunk_index: number;
    chunk_level: string;
    text_content: string;
    parent_chunk_id?: number;
    speaker?: string;
    topic_boundary?: boolean;
    timestamp_start: string;
    timestamp_end: string;
    metadata: any;
    created_at: string;
  }>>;
  stats: Array<{
    level: string;
    count: number;
    unique_speakers: number;
  }>;
  speakers: Array<{
    name: string;
    chunk_count: number;
    levels: string[];
  }>;
  totalChunks: number;
}

function getChunkLevelIcon(level: string): string {
  switch (level) {
    case 'episode': return '🎧';
    case 'topic': return '📝';
    case 'paragraph': return '📄';
    case 'sentence': return '💬';
    default: return '📄';
  }
}

function getChunkLevelColor(level: string): string {
  switch (level) {
    case 'episode': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'topic': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'paragraph': return 'bg-green-100 text-green-800 border-green-200';
    case 'sentence': return 'bg-orange-100 text-orange-800 border-orange-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

export default function EpisodePage({ params }: { params: { podcastId: string } }) {
  const [data, setData] = useState<EpisodeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [activeLevel, setActiveLevel] = useState<string>('topic');
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchEpisodeData();
  }, []);

  const fetchEpisodeData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/episode/${params.podcastId}`);
      const result = await response.json();
      
      if (response.ok) {
        setData(result);
        // Set default level to first available level
        const availableLevels = Object.keys(result.chunks);
        if (availableLevels.includes('topic')) {
          setActiveLevel('topic');
        } else if (availableLevels.length > 0) {
          setActiveLevel(availableLevels[0]);
        }
      } else {
        setError(result.error || 'Failed to fetch episode data');
      }
    } catch (err) {
      setError('Failed to fetch episode data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading episode...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Episode</h3>
            <p className="text-red-600">{error}</p>
            <button
              onClick={() => router.back()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { episode, chunks, stats, speakers } = data;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="mb-4 flex items-center text-blue-600 hover:text-blue-800"
          >
            ← Back to Transcripts
          </button>
          
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <h1 className="text-3xl font-bold text-gray-900">Episode Details</h1>
              <span className="text-sm text-gray-500">
                {new Date(episode.created_at).toLocaleDateString()}
              </span>
            </div>
            
            <div className="mb-4">
              <span className="text-xs text-gray-500 font-mono">
                ID: {episode.podcast_id}
              </span>
            </div>

            {episode.summary && (
              <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-md">
                <h3 className="text-lg font-medium text-purple-800 mb-2">Episode Summary</h3>
                <p className="text-purple-700">{episode.summary}</p>
              </div>
            )}

            {/* Episode Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{data.totalChunks}</div>
                <div className="text-sm text-gray-600">Total Chunks</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{episode.word_count.toLocaleString()}</div>
                <div className="text-sm text-gray-600">Words</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{episode.reading_time}</div>
                <div className="text-sm text-gray-600">Min Read</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{speakers.length}</div>
                <div className="text-sm text-gray-600">Speakers</div>
              </div>
            </div>

            {/* Full Transcript Toggle */}
            <button
              onClick={() => setShowFullTranscript(!showFullTranscript)}
              className="w-full p-3 text-left bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              <div className="flex justify-between items-center">
                <span className="font-medium">📜 Full Transcript</span>
                <span className="text-gray-500">
                  {showFullTranscript ? '▼ Hide' : '▶ Show'} ({episode.character_count.toLocaleString()} chars)
                </span>
              </div>
            </button>

            {showFullTranscript && episode.full_text && (
              <div className="mt-4 p-4 bg-gray-50 rounded-md border max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm text-gray-700">
                  {episode.full_text}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Chunk Level Navigation */}
        <div className="mb-6">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Chunk Breakdown</h2>
            
            {/* Level Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {stats.map((stat) => (
                <div
                  key={stat.level}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    activeLevel === stat.level 
                      ? getChunkLevelColor(stat.level)
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                  onClick={() => setActiveLevel(stat.level)}
                >
                  <div className="text-center">
                    <div className="text-2xl mb-1">{getChunkLevelIcon(stat.level)}</div>
                    <div className="font-bold text-lg">{stat.count}</div>
                    <div className="text-xs capitalize">{stat.level} chunks</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Level Selector Tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.keys(chunks).map((level) => (
                <button
                  key={level}
                  onClick={() => setActiveLevel(level)}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    activeLevel === level
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {getChunkLevelIcon(level)} {level} ({chunks[level]?.length || 0})
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chunks Display */}
        {chunks[activeLevel] && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              {getChunkLevelIcon(activeLevel)} {activeLevel.charAt(0).toUpperCase() + activeLevel.slice(1)} Level Chunks
            </h3>
            
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {chunks[activeLevel].map((chunk) => (
                <div key={chunk.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-600">
                        Chunk #{chunk.chunk_index + 1}
                      </span>
                      {chunk.speaker && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          🎤 {chunk.speaker}
                        </span>
                      )}
                      {chunk.topic_boundary && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          🔄 Topic Start
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">ID: {chunk.id}</span>
                  </div>
                  
                  <div className="text-gray-800 text-sm leading-relaxed">
                    {chunk.text_content.length > 500 ? (
                      <>
                        {chunk.text_content.substring(0, 500)}...
                        <button className="text-blue-600 hover:text-blue-800 ml-2">
                          Show more
                        </button>
                      </>
                    ) : (
                      chunk.text_content
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Speakers Section */}
        {speakers.length > 0 && (
          <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Speakers in this Episode</h3>
            <div className="grid gap-3">
              {speakers.map((speaker) => (
                <div key={speaker.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className="font-medium text-gray-900">🎤 {speaker.name}</span>
                    <div className="text-sm text-gray-600">
                      Active in: {speaker.levels.join(', ')} levels
                    </div>
                  </div>
                  <span className="text-sm text-gray-500">{speaker.chunk_count} chunks</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}