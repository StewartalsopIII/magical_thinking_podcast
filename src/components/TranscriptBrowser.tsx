'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface AnalyticsData {
  stats: {
    total_episodes: string;
    total_chunks: string;
    episode_chunks: string;
    topic_chunks: string;
    paragraph_chunks: string;
    sentence_chunks: string;
    avg_episode_length: string;
    unique_speakers: string;
  };
  episodes: Array<{
    podcast_id: string;
    summary: string;
    created_at: string;
    character_count: number;
    word_count: number;
    reading_time: number;
    metadata: any;
  }>;
  chunkDistribution: Record<string, Record<string, number>>;
  speakers: Array<{
    name: string;
    chunk_count: number;
    episode_count: number;
  }>;
  topics: Array<{
    podcast_id: string;
    topic_segments: number;
    total_chunks: number;
  }>;
  activity: Array<{
    date: string;
    episodes_uploaded: number;
    total_characters: number;
  }>;
}

export default function TranscriptBrowser() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/transcript-analytics');
      const result = await response.json();
      
      if (response.ok) {
        setData(result);
      } else {
        setError(result.error || 'Failed to fetch analytics');
      }
    } catch (err) {
      setError('Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading transcript analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Analytics</h3>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-medium text-gray-800 mb-2">No Data Available</h3>
        <p className="text-gray-600">Upload some transcripts to see analytics.</p>
      </div>
    );
  }

  const { stats, episodes, speakers, topics, activity } = data;

  return (
    <div className="space-y-8">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Episodes"
          value={stats.total_episodes}
          icon="🎧"
          color="purple"
        />
        <StatCard
          title="Total Chunks"
          value={parseInt(stats.total_chunks).toLocaleString()}
          icon="📄"
          color="blue"
        />
        <StatCard
          title="Unique Speakers"
          value={stats.unique_speakers}
          icon="🎤"
          color="green"
        />
        <StatCard
          title="Avg Episode Length"
          value={`${Math.round(parseInt(stats.avg_episode_length || '0') / 1000)}K chars`}
          icon="📊"
          color="orange"
        />
      </div>

      {/* Chunk Level Distribution */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Chunk Distribution</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ChunkTypeCard
            level="Episode"
            count={parseInt(stats.episode_chunks)}
            icon="🎧"
            color="bg-purple-100 text-purple-800"
          />
          <ChunkTypeCard
            level="Topic"
            count={parseInt(stats.topic_chunks)}
            icon="📝"
            color="bg-blue-100 text-blue-800"
          />
          <ChunkTypeCard
            level="Paragraph"
            count={parseInt(stats.paragraph_chunks)}
            icon="📄"
            color="bg-green-100 text-green-800"
          />
          <ChunkTypeCard
            level="Sentence"
            count={parseInt(stats.sentence_chunks)}
            icon="💬"
            color="bg-orange-100 text-orange-800"
          />
        </div>
      </div>

      {/* Recent Episodes */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Recent Episodes</h3>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {episodes.map((episode) => (
            <EpisodeCard 
              key={episode.podcast_id} 
              episode={episode} 
              onClick={() => router.push(`/episode/${episode.podcast_id}`)}
            />
          ))}
        </div>
      </div>

      {/* Speaker Analysis */}
      {speakers.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Most Active Speakers</h3>
          <div className="grid gap-3">
            {speakers.slice(0, 10).map((speaker) => (
              <SpeakerCard key={speaker.name} speaker={speaker} />
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {activity.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Recent Upload Activity</h3>
          <div className="space-y-2">
            {activity.slice(0, 7).map((day) => (
              <ActivityCard key={day.date} activity={day} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, color }: {
  title: string;
  value: string;
  icon: string;
  color: string;
}) {
  const colorClasses = {
    purple: 'bg-purple-50 border-purple-200',
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    orange: 'bg-orange-50 border-orange-200'
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color as keyof typeof colorClasses]}`}>
      <div className="flex items-center">
        <span className="text-2xl mr-3">{icon}</span>
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-xl font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function ChunkTypeCard({ level, count, icon, color }: {
  level: string;
  count: number;
  icon: string;
  color: string;
}) {
  return (
    <div className="text-center p-4 rounded-lg border border-gray-200">
      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${color} mb-2`}>
        {icon} {level}
      </div>
      <p className="text-2xl font-bold text-gray-900">{count.toLocaleString()}</p>
      <p className="text-xs text-gray-500">chunks</p>
    </div>
  );
}

function EpisodeCard({ episode, onClick }: { 
  episode: AnalyticsData['episodes'][0];
  onClick: () => void;
}) {
  return (
    <div 
      className="border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs text-gray-500 font-mono group-hover:text-blue-600">
          ID: {episode.podcast_id.substring(0, 8)}...
        </span>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500">
            {new Date(episode.created_at).toLocaleDateString()}
          </span>
          <span className="text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
            View Details →
          </span>
        </div>
      </div>
      
      {episode.summary && (
        <p className="text-sm text-gray-700 mb-3 line-clamp-2 group-hover:text-gray-900">
          {episode.summary}
        </p>
      )}
      
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex space-x-4">
          <span>📊 {episode.character_count.toLocaleString()} chars</span>
          <span>📝 {episode.word_count.toLocaleString()} words</span>
          <span>⏱️ ~{episode.reading_time} min read</span>
        </div>
        <span className="text-xs text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          Click to explore
        </span>
      </div>
    </div>
  );
}

function SpeakerCard({ speaker }: { speaker: AnalyticsData['speakers'][0] }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center">
        <span className="text-sm font-medium text-gray-900">🎤 {speaker.name}</span>
      </div>
      <div className="flex items-center space-x-4 text-xs text-gray-500">
        <span>{speaker.chunk_count} chunks</span>
        <span>{speaker.episode_count} episodes</span>
      </div>
    </div>
  );
}

function ActivityCard({ activity }: { activity: AnalyticsData['activity'][0] }) {
  return (
    <div className="flex items-center justify-between p-2 border-l-4 border-blue-500 bg-blue-50">
      <span className="text-sm font-medium text-gray-900">
        {new Date(activity.date).toLocaleDateString()}
      </span>
      <div className="flex items-center space-x-4 text-xs text-gray-600">
        <span>📁 {activity.episodes_uploaded} episodes</span>
        <span>📊 {(activity.total_characters / 1000).toFixed(0)}K chars</span>
      </div>
    </div>
  );
}