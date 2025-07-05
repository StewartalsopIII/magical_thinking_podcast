'use client';

interface SearchResult {
  id: number;
  podcast_id: string;
  chunk_index: number;
  text_content: string;
  similarity: number;
  created_at: string;
  chunk_level: 'episode' | 'topic' | 'paragraph' | 'sentence';
  parent_chunk_id?: number;
  summary?: string;
  speaker?: string;
  topic_boundary?: boolean;
  full_text?: string;
  context?: SearchResult[];
}

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
}

function cleanTranscriptText(text: string): string {
  // Remove timestamp codes like "100:00:00,000 --> 00:00:05,000"
  return text
    .replace(/\d+:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/g, '')
    .replace(/^\d+$/gm, '') // Remove line numbers at start of lines
    .replace(/\n\s*\n/g, '\n') // Remove extra empty lines
    .trim();
}

function getChunkLevelIcon(level: 'episode' | 'topic' | 'paragraph' | 'sentence'): string {
  switch (level) {
    case 'episode': return '🎧';
    case 'topic': return '📝';
    case 'paragraph': return '📄';
    case 'sentence': return '💬';
    default: return '📄';
  }
}

function getChunkLevelColor(level: 'episode' | 'topic' | 'paragraph' | 'sentence'): string {
  switch (level) {
    case 'episode': return 'bg-purple-100 text-purple-800';
    case 'topic': return 'bg-blue-100 text-blue-800';
    case 'paragraph': return 'bg-green-100 text-green-800';
    case 'sentence': return 'bg-orange-100 text-orange-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

export default function SearchResults({ results, query }: SearchResultsProps) {
  if (!query) return null;

  if (results.length === 0) {
    return (
      <div className="mt-8 p-6 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-medium text-gray-800 mb-2">No Results Found</h3>
        <p className="text-gray-600">
          No transcript chunks match your search query. Try different keywords or upload more transcripts.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-gray-800">
          Search Results ({results.length} found)
        </h3>
        
        {/* Level breakdown indicator */}
        <div className="flex items-center space-x-2 text-sm">
          {Array.from(new Set(results.map(r => r.chunk_level))).map(level => (
            <span
              key={level}
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getChunkLevelColor(level)}`}
            >
              {getChunkLevelIcon(level)} {level}
            </span>
          ))}
        </div>
      </div>
      
      <div className="space-y-6">
        {results.map((result) => {
          const cleanedText = cleanTranscriptText(result.text_content);
          
          return (
            <div
              key={result.id}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Similarity: {(result.similarity * 100).toFixed(1)}%
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getChunkLevelColor(result.chunk_level)}`}>
                    {getChunkLevelIcon(result.chunk_level)} {result.chunk_level}
                  </span>
                  {result.speaker && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      🎤 {result.speaker}
                    </span>
                  )}
                  {result.topic_boundary && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      🔄 Topic Start
                    </span>
                  )}
                </div>
                <span className="text-sm text-gray-400">
                  {new Date(result.created_at).toLocaleDateString()}
                </span>
              </div>

              {/* Episode summary and stats for episode-level chunks */}
              {result.chunk_level === 'episode' && (
                <div className="mb-4 space-y-3">
                  {result.summary && (
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-md">
                      <h4 className="text-sm font-medium text-purple-800 mb-1">Episode Summary</h4>
                      <p className="text-sm text-purple-700">{result.summary}</p>
                    </div>
                  )}
                  
                  {result.full_text && (
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span>📊 Full transcript: {result.full_text.length.toLocaleString()} characters</span>
                      <span>📝 ~{Math.round(result.full_text.split(/\s+/).length / 200)} min read</span>
                      <span>🎧 Complete episode available</span>
                    </div>
                  )}
                </div>
              )}
              
              <div className="text-gray-800 leading-relaxed">
                {result.chunk_level === 'episode' && cleanedText.length > 1000 ? (
                  // Show truncated content for episode-level chunks
                  <div>
                    {highlightSearchTerms(cleanedText.substring(0, 1000), query)}
                    <span className="text-gray-500">... (truncated)</span>
                  </div>
                ) : (
                  highlightSearchTerms(cleanedText, query)
                )}
              </div>

              {/* Context section for hierarchical relationships */}
              {result.context && result.context.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Related Context</h4>
                  <div className="space-y-2">
                    {result.context.slice(0, 2).map((contextChunk) => (
                      <div key={contextChunk.id} className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium mr-2 ${getChunkLevelColor(contextChunk.chunk_level)}`}>
                          {getChunkLevelIcon(contextChunk.chunk_level)} {contextChunk.chunk_level}
                        </span>
                        {cleanTranscriptText(contextChunk.text_content).substring(0, 150)}...
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                <span className="text-xs text-gray-500 font-mono">
                  Podcast ID: {result.podcast_id.substring(0, 8)}... • Chunk #{result.chunk_index + 1}
                </span>
                {result.parent_chunk_id && (
                  <span className="text-xs text-gray-500">
                    Child of chunk #{result.parent_chunk_id}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function highlightSearchTerms(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  // For question-style queries, extract key terms (skip common question words)
  const stopWords = new Set(['what', 'does', 'do', 'how', 'why', 'when', 'where', 'is', 'are', 'say', 'tell', 'about']);
  
  const terms = query.toLowerCase()
    .split(/\s+/)
    .filter(term => term.length > 2 && !stopWords.has(term))
    .slice(0, 5); // Limit to 5 most important terms
  
  if (terms.length === 0) {
    // If no meaningful terms, highlight names and important words
    const fallbackTerms = query.toLowerCase()
      .split(/\s+/)
      .filter(term => term.length > 1);
    
    if (fallbackTerms.length === 0) return text;
    
    const pattern = fallbackTerms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(`(${pattern})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) => {
      const isMatch = fallbackTerms.some(term => 
        part.toLowerCase() === term.toLowerCase()
      );
      
      return isMatch ? (
        <mark key={index} className="bg-yellow-200 px-1 rounded font-medium">
          {part}
        </mark>
      ) : (
        <span key={index}>{part}</span>
      );
    });
  }

  // Create regex pattern for meaningful terms
  const pattern = terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(${pattern})`, 'gi');
  
  // Split text by the regex, keeping the matches
  const parts = text.split(regex);

  return parts.map((part, index) => {
    // Check if this part matches any of our search terms
    const isMatch = terms.some(term => 
      part.toLowerCase() === term.toLowerCase()
    );
    
    return isMatch ? (
      <mark key={index} className="bg-yellow-200 px-1 rounded font-medium">
        {part}
      </mark>
    ) : (
      <span key={index}>{part}</span>
    );
  });
}