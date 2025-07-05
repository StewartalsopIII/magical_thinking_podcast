'use client';

interface SearchResult {
  id: number;
  podcast_id: string;
  chunk_index: number;
  text_content: string;
  similarity: number;
  created_at: string;
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
      <h3 className="text-xl font-semibold text-gray-800 mb-4">
        Search Results ({results.length} found)
      </h3>
      
      <div className="space-y-4">
        {results.map((result) => {
          const cleanedText = cleanTranscriptText(result.text_content);
          
          return (
            <div
              key={result.id}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center space-x-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Similarity: {(result.similarity * 100).toFixed(1)}%
                  </span>
                  <span className="text-sm text-gray-500">
                    Chunk #{result.chunk_index + 1}
                  </span>
                </div>
                <span className="text-sm text-gray-400">
                  {new Date(result.created_at).toLocaleDateString()}
                </span>
              </div>
              
              <div className="text-gray-800 leading-relaxed">
                {highlightSearchTerms(cleanedText, query)}
              </div>
              
              <div className="mt-3 pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-500 font-mono">
                  Podcast ID: {result.podcast_id.substring(0, 8)}...
                </span>
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