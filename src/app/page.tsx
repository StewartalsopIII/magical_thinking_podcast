'use client';

import { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import SearchTranscripts from '@/components/SearchTranscripts';
import SearchResults from '@/components/SearchResults';
import TranscriptBrowser from '@/components/TranscriptBrowser';

interface SearchResult {
  id: number;
  podcast_id: string;
  chunk_index: number;
  text_content: string;
  similarity: number;
  created_at: string;
}

export default function Home() {
  const [uploadResult, setUploadResult] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [currentQuery, setCurrentQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'upload' | 'search' | 'browse'>('upload');

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    setUploadResult('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload-transcript', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setUploadResult(`Successfully processed ${result.chunksCreated} chunks for podcast: ${result.podcastId}`);
      } else {
        setUploadResult(`Error: ${result.error || 'Failed to process transcript'}`);
      }
    } catch (error) {
      setUploadResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSearchResults = (results: SearchResult[], query: string) => {
    setSearchResults(results);
    setCurrentQuery(query);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Magical Thinking Podcast
          </h1>
          <p className="text-lg text-gray-600">
            RAG System for Podcast Transcripts
          </p>
        </header>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg p-1 shadow-sm border">
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-6 py-2 rounded-md transition-colors ${
                activeTab === 'upload'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Upload Transcripts
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`px-6 py-2 rounded-md transition-colors ${
                activeTab === 'search'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Search Transcripts
            </button>
            <button
              onClick={() => setActiveTab('browse')}
              className={`px-6 py-2 rounded-md transition-colors ${
                activeTab === 'browse'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Browse Transcripts
            </button>
          </div>
        </div>

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
              Upload Transcript
            </h2>
            
            <FileUpload onFileUpload={handleFileUpload} />

            {isProcessing && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
                  <p className="text-blue-800">Processing transcript and generating embeddings...</p>
                </div>
              </div>
            )}

            {uploadResult && (
              <div className={`mt-6 p-4 rounded-md ${
                uploadResult.startsWith('Error') 
                  ? 'bg-red-50 border border-red-200' 
                  : 'bg-green-50 border border-green-200'
              }`}>
                <p className={uploadResult.startsWith('Error') ? 'text-red-800' : 'text-green-800'}>
                  {uploadResult}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Search Tab */}
        {activeTab === 'search' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
                Search Transcripts
              </h2>
              
              <SearchTranscripts onSearchResults={handleSearchResults} />
            </div>

            <SearchResults results={searchResults} query={currentQuery} />
          </div>
        )}

        {/* Browse Tab */}
        {activeTab === 'browse' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
                Browse All Transcripts
              </h2>
              <p className="text-center text-gray-600 mb-6">
                Explore your transcript collection with analytics and insights
              </p>
            </div>

            <TranscriptBrowser />
          </div>
        )}
      </div>
    </div>
  );
}