import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { getEmbeddings } from './textProcessing';

export interface ChunkData {
  text_content: string;
  chunk_index: number;
  chunk_level: 'episode' | 'topic' | 'paragraph' | 'sentence';
  parent_chunk_id?: number;
  summary?: string;
  speaker?: string;
  topic_boundary?: boolean;
  full_text?: string;
  timestamp_start: string;
  timestamp_end: string;
  metadata: Record<string, any>;
}

// Episode-level summarization using DeepInfra
async function generateEpisodeSummary(fullText: string): Promise<string> {
  const DEEPINFRA_API_KEY = process.env.DEEPINFRA_API_KEY;
  
  if (!DEEPINFRA_API_KEY) {
    throw new Error('DEEPINFRA_API_KEY environment variable is not set');
  }

  // Truncate if too long (most LLMs have context limits)
  const truncatedText = fullText.length > 6000 
    ? fullText.substring(0, 6000) + "..."
    : fullText;

  const prompt = `Please provide a concise summary of this podcast transcript in 2-3 sentences, focusing on the main topics discussed:

${truncatedText}

Summary:`;

  try {
    const response = await fetch("https://api.deepinfra.com/v1/openai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPINFRA_API_KEY}`,
      },
      body: JSON.stringify({
        model: "meta-llama/Meta-Llama-3.1-8B-Instruct",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 200,
        temperature: 0.3
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepInfra summary API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content?.trim() || fullText.substring(0, 500) + "...";
  } catch (error) {
    console.error('Episode summary generation failed:', error);
    // Fallback to simple truncation
    return fullText.substring(0, 500) + "...";
  }
}

// Detect topic boundaries based on content patterns
function detectTopicBoundaries(text: string): number[] {
  const lines = text.split('\n');
  const boundaries: number[] = [0]; // Always start with boundary at beginning
  
  let currentPos = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    currentPos += lines[i-1].length + 1; // +1 for newline
    
    // Detect topic changes based on patterns
    const isTopicBoundary = (
      // Time gaps (assuming timestamps indicate topic changes)
      /\d{2}:\d{2}:\d{2}/.test(line) &&
      // Skip if too close to previous boundary
      currentPos - boundaries[boundaries.length - 1] > 1000
    ) || (
      // Speaker changes
      /^[A-Z][a-zA-Z\s]+:/.test(line) &&
      currentPos - boundaries[boundaries.length - 1] > 800
    ) || (
      // Paragraph breaks with significant content
      line.length === 0 && 
      i < lines.length - 1 && 
      lines[i + 1].trim().length > 50 &&
      currentPos - boundaries[boundaries.length - 1] > 1500
    );
    
    if (isTopicBoundary) {
      boundaries.push(currentPos);
    }
  }
  
  return boundaries;
}

// Extract speaker from text lines
function extractSpeaker(text: string): string | undefined {
  const lines = text.split('\n');
  for (const line of lines.slice(0, 3)) { // Check first few lines
    const speakerMatch = line.match(/^([A-Z][a-zA-Z\s]+):/);
    if (speakerMatch) {
      return speakerMatch[1].trim();
    }
  }
  return undefined;
}

// Multi-level chunking implementation
export async function createMultiLevelChunks(
  plainText: string,
  originalMarkdown?: string
): Promise<ChunkData[]> {
  const allChunks: ChunkData[] = [];
  let chunkCounter = 0;

  // 1. Episode Level - Generate summary and create episode chunk
  console.log('Creating episode-level chunk...');
  const episodeSummary = await generateEpisodeSummary(plainText);
  
  const episodeChunk: ChunkData = {
    text_content: plainText.length > 8000 ? plainText.substring(0, 8000) + "..." : plainText,
    chunk_index: chunkCounter++,
    chunk_level: 'episode',
    summary: episodeSummary,
    full_text: plainText, // Store complete transcript
    timestamp_start: '00:00:00',
    timestamp_end: '99:99:99',
    metadata: { 
      total_length: plainText.length,
      has_summary: true,
      original_markdown: originalMarkdown ? true : false,
      word_count: plainText.split(/\s+/).length,
      has_full_text: true
    }
  };
  allChunks.push(episodeChunk);

  // 2. Topic Level - Segment by topic boundaries
  console.log('Creating topic-level chunks...');
  const topicBoundaries = detectTopicBoundaries(plainText);
  
  for (let i = 0; i < topicBoundaries.length - 1; i++) {
    const start = topicBoundaries[i];
    const end = topicBoundaries[i + 1];
    const topicText = plainText.substring(start, end).trim();
    
    if (topicText.length > 200) { // Only create chunk if substantial
      const topicChunk: ChunkData = {
        text_content: topicText,
        chunk_index: chunkCounter++,
        chunk_level: 'topic',
        parent_chunk_id: 1, // Reference to episode chunk (will be updated with actual ID)
        speaker: extractSpeaker(topicText),
        topic_boundary: true,
        timestamp_start: '00:00:00',
        timestamp_end: '00:00:00',
        metadata: { 
          topic_segment: i + 1,
          segment_start: start,
          segment_end: end
        }
      };
      allChunks.push(topicChunk);
    }
  }

  // Handle final segment
  const lastBoundary = topicBoundaries[topicBoundaries.length - 1];
  if (lastBoundary < plainText.length - 200) {
    const finalText = plainText.substring(lastBoundary).trim();
    if (finalText.length > 200) {
      const finalChunk: ChunkData = {
        text_content: finalText,
        chunk_index: chunkCounter++,
        chunk_level: 'topic',
        parent_chunk_id: 1,
        speaker: extractSpeaker(finalText),
        topic_boundary: true,
        timestamp_start: '00:00:00',
        timestamp_end: '00:00:00',
        metadata: { 
          topic_segment: topicBoundaries.length,
          segment_start: lastBoundary,
          segment_end: plainText.length
        }
      };
      allChunks.push(finalChunk);
    }
  }

  // 3. Paragraph Level - Enhanced current approach
  console.log('Creating paragraph-level chunks...');
  const paragraphSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ["\n\n", "\n", ". ", " ", ""],
  });
  
  const paragraphDocs = await paragraphSplitter.createDocuments([plainText]);
  const topicChunks = allChunks.filter(c => c.chunk_level === 'topic');
  
  paragraphDocs.forEach((doc, index) => {
    // Find which topic this paragraph belongs to
    const paragraphStart = plainText.indexOf(doc.pageContent);
    const parentTopic = topicChunks.find(topic => {
      const topicStart = topic.metadata?.segment_start || 0;
      const topicEnd = topic.metadata?.segment_end || plainText.length;
      return paragraphStart >= topicStart && paragraphStart < topicEnd;
    });

    const paragraphChunk: ChunkData = {
      text_content: doc.pageContent,
      chunk_index: chunkCounter++,
      chunk_level: 'paragraph',
      parent_chunk_id: parentTopic?.chunk_index || undefined,
      speaker: extractSpeaker(doc.pageContent),
      timestamp_start: '00:00:00',
      timestamp_end: '00:00:00',
      metadata: { 
        paragraph_index: index,
        char_start: paragraphStart,
        parent_topic: parentTopic?.chunk_index
      }
    };
    allChunks.push(paragraphChunk);
  });

  // 4. Sentence Level - Individual sentences
  console.log('Creating sentence-level chunks...');
  const sentences = plainText
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 500); // Filter reasonable sentences

  sentences.forEach((sentence, index) => {
    if (sentence.length > 30) { // Only meaningful sentences
      // Find parent paragraph
      const sentenceStart = plainText.indexOf(sentence);
      const parentParagraph = allChunks.find(chunk => 
        chunk.chunk_level === 'paragraph' && 
        chunk.text_content.includes(sentence)
      );

      const sentenceChunk: ChunkData = {
        text_content: sentence + '.', // Add period back
        chunk_index: chunkCounter++,
        chunk_level: 'sentence',
        parent_chunk_id: parentParagraph?.chunk_index || undefined,
        speaker: extractSpeaker(sentence),
        timestamp_start: '00:00:00',
        timestamp_end: '00:00:00',
        metadata: { 
          sentence_index: index,
          char_start: sentenceStart,
          parent_paragraph: parentParagraph?.chunk_index
        }
      };
      allChunks.push(sentenceChunk);
    }
  });

  console.log(`Created ${allChunks.length} chunks across all levels:`, {
    episode: allChunks.filter(c => c.chunk_level === 'episode').length,
    topic: allChunks.filter(c => c.chunk_level === 'topic').length,
    paragraph: allChunks.filter(c => c.chunk_level === 'paragraph').length,
    sentence: allChunks.filter(c => c.chunk_level === 'sentence').length
  });

  return allChunks;
}