'use client';

import { useState } from 'react';

interface SearchResult {
  id: number;
  podcast_id: string;
  chunk_index: number;
  text_content: string;
  similarity: number;
  created_at: string;
}

interface SearchTranscriptsProps {
  onSearchResults: (results: SearchResult[], query: string) => void;
}

export default function SearchTranscripts({ onSearchResults }: SearchTranscriptsProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) return;

    setIsSearching(true);

    try {
      const response = await fetch('/api/search-transcripts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: query.trim() }),
      });

      const result = await response.json();

      if (response.ok) {
        onSearchResults(result.results || [], query.trim());
      } else {
        console.error('Search error:', result.error);
        onSearchResults([], '');
      }
    } catch (error) {
      console.error('Search request failed:', error);
      onSearchResults([], '');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSearch} className="space-y-4">
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
            Search Transcripts
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              id="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your search query..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
              disabled={isSearching}
            />
            <button
              type="submit"
              disabled={isSearching || !query.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isSearching ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Searching...
                </div>
              ) : (
                'Search'
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}