import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { getEmbeddings } from './textProcessing';
import { 
  extractTimestampsAndCleanText, 
  identifyChaptersWithLLM, 
  matchChaptersToTimestamps 
} from './chapterSegmentation';

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
  chapter_title?: string;
  chapter_theme?: string;
  chapter_index?: number;
  guest_name?: string;
  metadata: Record<string, any>;
}

// Extract guest name from transcript using LLM
async function extractGuestName(fullText: string): Promise<string> {
  const DEEPINFRA_API_KEY = process.env.DEEPINFRA_API_KEY;
  
  if (!DEEPINFRA_API_KEY) {
    return 'Guest Interview'; // Fallback if no API key
  }

  // Take first 2000 characters to find the guest introduction
  const introText = fullText.substring(0, 2000);

  const prompt = `Analyze this podcast transcript and identify the guest being interviewed. Return only the guest's name, or "Guest Interview" if unclear.

${introText}

Guest name:`;

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
        max_tokens: 50,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      return 'Guest Interview';
    }

    const data = await response.json();
    const guestName = data.choices[0]?.message?.content?.trim() || 'Guest Interview';
    
    // Clean up the response and ensure it's reasonable
    const cleanName = guestName.replace(/['"]/g, '').trim();
    return cleanName.length > 50 ? 'Guest Interview' : cleanName;
  } catch (error) {
    console.error('Guest name extraction failed:', error);
    return 'Guest Interview';
  }
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

  const prompt = `Please provide a concise summary of this podcast transcript, focusing on the main topics discussed:

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

  // 1. Episode Level - Generate summary and extract guest name
  console.log('Creating episode-level chunk...');
  const [episodeSummary, guestName] = await Promise.all([
    generateEpisodeSummary(plainText),
    extractGuestName(plainText)
  ]);
  
  const episodeChunk: ChunkData = {
    text_content: plainText.length > 8000 ? plainText.substring(0, 8000) + "..." : plainText,
    chunk_index: chunkCounter++,
    chunk_level: 'episode',
    summary: episodeSummary,
    guest_name: guestName,
    full_text: plainText, // Store complete transcript
    timestamp_start: '00:00:00',
    timestamp_end: '99:99:99',
    metadata: { 
      total_length: plainText.length,
      has_summary: true,
      original_markdown: originalMarkdown ? true : false,
      word_count: plainText.split(/\s+/).length,
      has_full_text: true,
      guest_name: guestName
    }
  };
  allChunks.push(episodeChunk);

  // 2. Topic Level - Use chapter segmentation for better topic boundaries
  console.log('Creating topic-level chunks using chapter segmentation...');
  let chapters = [];
  let cleanText = plainText;
  let timestampedLines: { timestamp: string; text: string; charIndex: number }[] = [];
  
  try {
    // Extract timestamps and clean text for LLM analysis
    const timestampData = extractTimestampsAndCleanText(originalMarkdown || plainText);
    cleanText = timestampData.cleanText;
    timestampedLines = timestampData.timestampedLines;
    
    // Use LLM to identify chapters
    const identifiedChapters = await identifyChaptersWithLLM(cleanText);
    
    // Match chapters to timestamps
    chapters = matchChaptersToTimestamps(identifiedChapters, timestampedLines, cleanText);
    
    console.log(`Identified ${chapters.length} chapters using LLM`);
  } catch (error) {
    console.error('Chapter segmentation failed, falling back to basic topic detection:', error);
    // Fallback to original topic detection if chapter segmentation fails
    const topicBoundaries = detectTopicBoundaries(plainText);
    chapters = topicBoundaries.slice(0, -1).map((start, i) => ({
      title: `Topic ${i + 1}`,
      theme: 'Content segment',
      firstSentence: plainText.substring(start, start + 100).trim(),
      startTimestamp: '00:00:00',
      endTimestamp: '00:00:00',
      startCharIndex: start,
      endCharIndex: topicBoundaries[i + 1] || plainText.length
    }));
  }
  
  // Create topic chunks from chapters
  chapters.forEach((chapter, index) => {
    const startChar = chapter.startCharIndex || 0;
    const endChar = chapter.endCharIndex || plainText.length;
    const chapterText = plainText.substring(startChar, endChar).trim();
    
    if (chapterText.length > 200) { // Only create chunk if substantial
      const topicChunk: ChunkData = {
        text_content: chapterText,
        chunk_index: chunkCounter++,
        chunk_level: 'topic',
        parent_chunk_id: 1, // Reference to episode chunk (will be updated with actual ID)
        speaker: extractSpeaker(chapterText),
        topic_boundary: true,
        timestamp_start: chapter.startTimestamp || '00:00:00',
        timestamp_end: chapter.endTimestamp || '00:00:00',
        chapter_title: chapter.title,
        chapter_theme: chapter.theme,
        chapter_index: index,
        metadata: { 
          topic_segment: index + 1,
          segment_start: startChar,
          segment_end: endChar,
          is_chapter: true,
          chapter_first_sentence: chapter.firstSentence
        }
      };
      allChunks.push(topicChunk);
    }
  });

  // Helper to map a character index in the transcript to the closest timestamp
  const mapCharIndexToTimestamp = (charIdx: number): { start: string; end: string } => {
    if (!timestampedLines || timestampedLines.length === 0) {
      return { start: '00:00:00', end: '00:00:00' };
    }

    // timestampedLines is sorted as we built it in order of encounter
    let startTs = '00:00:00';
    let endTs = '99:99:99';

    for (let i = 0; i < timestampedLines.length; i++) {
      const line = timestampedLines[i];
      if (line.charIndex <= charIdx) {
        startTs = line.timestamp;
        endTs = timestampedLines[i + 1]?.timestamp || '99:99:99';
      } else {
        break;
      }
    }

    return { start: startTs, end: endTs };
  };

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

    // Map char index to timestamps
    const ts = mapCharIndexToTimestamp(paragraphStart);

    const paragraphChunk: ChunkData = {
      text_content: doc.pageContent,
      chunk_index: chunkCounter++,
      chunk_level: 'paragraph',
      parent_chunk_id: parentTopic?.chunk_index || undefined,
      speaker: extractSpeaker(doc.pageContent),
      timestamp_start: ts.start,
      timestamp_end: ts.end,
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

      // Map char index to timestamps
      const tsSentence = mapCharIndexToTimestamp(sentenceStart);

      const sentenceChunk: ChunkData = {
        text_content: sentence + '.', // Add period back
        chunk_index: chunkCounter++,
        chunk_level: 'sentence',
        parent_chunk_id: parentParagraph?.chunk_index || undefined,
        speaker: extractSpeaker(sentence),
        timestamp_start: tsSentence.start,
        timestamp_end: tsSentence.end,
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