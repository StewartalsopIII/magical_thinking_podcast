// Smart search logic for multi-level chunking
export interface SearchQuery {
  query: string;
  levels?: ('episode' | 'topic' | 'paragraph' | 'sentence')[];
  maxResults?: number;
  minSimilarity?: number;
}

export interface SearchResult {
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
  // Timestamp boundaries within the episode (useful for locating clips)
  timestamp_start?: string;
  timestamp_end?: string;

  // Episode-level context (filled in by the search API via join or by the UI later)
  episode_summary?: string;
  guest_name?: string;
  context?: SearchResult[]; // Parent and child chunks for context
}

// Classify query type to determine optimal chunking levels
export function classifyQuery(query: string): ('episode' | 'topic' | 'paragraph' | 'sentence')[] {
  const lowerQuery = query.toLowerCase();
  
  // Broad discovery queries - use episode and topic levels
  const broadIndicators = [
    'episodes about', 'podcasts about', 'which episode', 'find episodes',
    'discusses', 'talks about', 'covers', 'mentions'
  ];
  
  // Specific detail queries - use paragraph and sentence levels
  const specificIndicators = [
    'what does', 'how does', 'explain', 'definition', 'example',
    'quote', 'exact', 'precisely', 'specifically'
  ];
  
  // Exploratory queries - use all levels
  const exploratoryIndicators = [
    'tell me about', 'learn about', 'understand', 'overview'
  ];

  const isBroad = broadIndicators.some(indicator => lowerQuery.includes(indicator));
  const isSpecific = specificIndicators.some(indicator => lowerQuery.includes(indicator));
  const isExploratory = exploratoryIndicators.some(indicator => lowerQuery.includes(indicator));

  if (isBroad) {
    return ['episode', 'topic'];
  } else if (isSpecific) {
    return ['paragraph', 'sentence'];
  } else if (isExploratory) {
    return ['episode', 'topic', 'paragraph'];
  } else {
    // Default: favor paragraph and topic for balanced results
    return ['topic', 'paragraph'];
  }
}

// Weight chunks based on level and query type
export function calculateLevelWeight(
  level: 'episode' | 'topic' | 'paragraph' | 'sentence',
  preferredLevels: ('episode' | 'topic' | 'paragraph' | 'sentence')[]
): number {
  const baseWeights = {
    episode: 0.8,  // Lower weight since very broad
    topic: 1.0,    // Good balance
    paragraph: 1.0, // Good balance  
    sentence: 0.9   // Slightly lower since very specific
  };

  const isPreferred = preferredLevels.includes(level);
  const preferenceBoost = isPreferred ? 1.2 : 0.8;
  
  return baseWeights[level] * preferenceBoost;
}

// Assemble context by finding related chunks
export function assembleContext(
  result: SearchResult,
  allResults: SearchResult[]
): SearchResult[] {
  const context: SearchResult[] = [];
  
  // Add parent chunk if exists
  if (result.parent_chunk_id) {
    const parent = allResults.find(r => r.id === result.parent_chunk_id);
    if (parent) {
      context.push(parent);
    }
  }
  
  // Add child chunks (for episode/topic level results)
  const children = allResults.filter(r => r.parent_chunk_id === result.id);
  context.push(...children.slice(0, 3)); // Limit to 3 children
  
  // Add sibling chunks (same parent, similar topic)
  if (result.parent_chunk_id) {
    const siblings = allResults.filter(r => 
      r.parent_chunk_id === result.parent_chunk_id && 
      r.id !== result.id
    ).slice(0, 2); // Limit to 2 siblings
    context.push(...siblings);
  }
  
  return context;
}