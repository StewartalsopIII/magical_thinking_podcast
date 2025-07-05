interface Chapter {
  title: string;
  theme: string;
  firstSentence: string;
  startTimestamp?: string;
  endTimestamp?: string;
  startCharIndex?: number;
  endCharIndex?: number;
}

interface TimestampedLine {
  timestamp: string;
  text: string;
  charIndex: number;
}

// Extract and preserve timestamps while creating clean text for LLM
export function extractTimestampsAndCleanText(transcript: string): {
  cleanText: string;
  timestampedLines: TimestampedLine[];
  originalWithTimestamps: string;
} {
  const lines = transcript.split('\n');
  const timestampedLines: TimestampedLine[] = [];
  const cleanLines: string[] = [];
  let charIndex = 0;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Match various timestamp formats:
    // HH:MM:SS,mmm --> HH:MM:SS,mmm
    // [HH:MM:SS] or (HH:MM:SS)
    // HH:MM:SS - HH:MM:SS
    const timestampMatch = trimmedLine.match(
      /^(?:\d+\s*)?(\d{1,2}:\d{2}:\d{2}(?:,\d{3})?(?:\s*-->\s*\d{1,2}:\d{2}:\d{2}(?:,\d{3})?)?|\[\d{1,2}:\d{2}:\d{2}\]|\(\d{1,2}:\d{2}:\d{2}\))/
    );

    if (timestampMatch) {
      // This line has a timestamp
      const timestamp = timestampMatch[1];
      const textAfterTimestamp = trimmedLine.substring(timestampMatch[0].length).trim();
      
      if (textAfterTimestamp) {
        timestampedLines.push({
          timestamp: normalizeTimestamp(timestamp),
          text: textAfterTimestamp,
          charIndex: charIndex
        });
        cleanLines.push(textAfterTimestamp);
        charIndex += textAfterTimestamp.length + 1; // +1 for newline
      }
    } else {
      // No timestamp, could be continuation of previous line or standalone text
      if (trimmedLine.length > 10) { // Avoid very short lines that might be artifacts
        cleanLines.push(trimmedLine);
        charIndex += trimmedLine.length + 1;
      }
    }
  }

  return {
    cleanText: cleanLines.join('\n'),
    timestampedLines,
    originalWithTimestamps: transcript
  };
}

// Normalize timestamp formats to HH:MM:SS
function normalizeTimestamp(timestamp: string): string {
  // Remove brackets/parentheses and extract time part
  const cleanTimestamp = timestamp.replace(/[\[\]()]/g, '').split('-->')[0].trim();
  
  // Handle comma milliseconds (convert to just HH:MM:SS)
  const timeOnly = cleanTimestamp.split(',')[0];
  
  // Ensure HH:MM:SS format
  const parts = timeOnly.split(':');
  if (parts.length === 3) {
    const hours = parts[0].padStart(2, '0');
    const minutes = parts[1].padStart(2, '0');
    const seconds = parts[2].padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }
  
  return timeOnly;
}

// Use LLM to identify chapter themes and get first sentences
export async function identifyChaptersWithLLM(cleanText: string): Promise<Chapter[]> {
  const DEEPINFRA_API_KEY = process.env.DEEPINFRA_API_KEY;
  
  if (!DEEPINFRA_API_KEY) {
    throw new Error('DEEPINFRA_API_KEY environment variable is not set');
  }

  // Truncate if too long (most LLMs have context limits)
  const maxLength = 12000;
  const textToAnalyze = cleanText.length > maxLength 
    ? cleanText.substring(0, maxLength) + "..."
    : cleanText;

  const prompt = `Analyze this podcast transcript and identify distinct chapters/segments based on topic changes, speaker transitions, or thematic shifts.

For each chapter, provide:
1. A concise title (3-8 words)
2. A brief theme description (1 sentence)
3. The exact first sentence of that chapter from the transcript

Return your analysis in this JSON format:
{
  "chapters": [
    {
      "title": "Introduction and Welcome",
      "theme": "Host introduces the show and guest",
      "firstSentence": "Welcome to the Stuart Squared podcast."
    },
    {
      "title": "Guest Background Discussion", 
      "theme": "Guest shares their professional background",
      "firstSentence": "So tell me about your early career."
    }
  ]
}

IMPORTANT: 
- Use EXACT sentences from the transcript for firstSentence
- Aim for 3-8 chapters depending on content length
- Focus on meaningful topic/speaker transitions
- Keep titles concise and descriptive

Transcript:
${textToAnalyze}`;

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
        max_tokens: 1500,
        temperature: 0.3,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepInfra chapter API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();
    
    if (!content) {
      throw new Error('No content returned from LLM');
    }

    try {
      const parsed = JSON.parse(content);
      return parsed.chapters || [];
    } catch (parseError) {
      console.error('Failed to parse LLM response as JSON:', content);
      throw new Error('LLM returned invalid JSON format');
    }

  } catch (error) {
    console.error('Chapter identification failed:', error);
    // Fallback: create simple chapters based on text length
    return createFallbackChapters(cleanText);
  }
}

// Fallback chapter creation if LLM fails
function createFallbackChapters(cleanText: string): Chapter[] {
  const lines = cleanText.split('\n').filter(line => line.trim().length > 10);
  const totalLines = lines.length;
  const chapterSize = Math.max(Math.floor(totalLines / 4), 10); // Aim for ~4 chapters

  const chapters: Chapter[] = [];
  
  for (let i = 0; i < totalLines; i += chapterSize) {
    const chapterNumber = Math.floor(i / chapterSize) + 1;
    const firstLine = lines[i]?.trim();
    
    if (firstLine) {
      chapters.push({
        title: `Chapter ${chapterNumber}`,
        theme: `Content segment ${chapterNumber}`,
        firstSentence: firstLine
      });
    }
  }

  return chapters;
}

// Match first sentences back to timestamps
export function matchChaptersToTimestamps(
  chapters: Chapter[],
  timestampedLines: TimestampedLine[],
  cleanText: string
): Chapter[] {
  return chapters.map((chapter, index) => {
    const { firstSentence } = chapter;
    
    // Find the timestamped line that contains or closely matches the first sentence
    let bestMatch: TimestampedLine | null = null;
    let bestScore = 0;

    for (const line of timestampedLines) {
      const score = calculateMatchScore(firstSentence, line.text);
      if (score > bestScore && score > 0.7) { // Require 70% similarity
        bestScore = score;
        bestMatch = line;
      }
    }

    // If no good match, try fuzzy matching with nearby lines
    if (!bestMatch && firstSentence.length > 10) {
      bestMatch = findFuzzyMatch(firstSentence, timestampedLines);
    }

    // Calculate character indices in clean text
    const cleanTextIndex = cleanText.indexOf(firstSentence);
    const startCharIndex = cleanTextIndex !== -1 ? cleanTextIndex : bestMatch?.charIndex;

    // Estimate end time (start of next chapter or end of transcript)
    const nextChapter = chapters[index + 1];
    let endTimestamp = '99:99:99';
    let endCharIndex = cleanText.length;

    if (nextChapter) {
      const nextMatch = timestampedLines.find(line => 
        calculateMatchScore(nextChapter.firstSentence, line.text) > 0.7
      );
      if (nextMatch) {
        endTimestamp = nextMatch.timestamp;
        endCharIndex = nextMatch.charIndex;
      }
    }

    return {
      ...chapter,
      startTimestamp: bestMatch?.timestamp || '00:00:00',
      endTimestamp,
      startCharIndex,
      endCharIndex
    };
  });
}

// Calculate similarity score between two strings
function calculateMatchScore(sentence1: string, sentence2: string): number {
  const s1 = sentence1.toLowerCase().trim();
  const s2 = sentence2.toLowerCase().trim();

  // Exact match
  if (s1 === s2) return 1.0;

  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;

  // Word-based similarity
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  
  const commonWords = words1.filter(word => 
    word.length > 2 && words2.some(w2 => w2.includes(word) || word.includes(w2))
  );

  const similarity = (commonWords.length * 2) / (words1.length + words2.length);
  return similarity;
}

// Find fuzzy match when exact match fails
function findFuzzyMatch(targetSentence: string, timestampedLines: TimestampedLine[]): TimestampedLine | null {
  const targetWords = targetSentence.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  
  let bestMatch: TimestampedLine | null = null;
  let bestScore = 0;

  for (const line of timestampedLines) {
    const lineWords = line.text.toLowerCase().split(/\s+/);
    const matchingWords = targetWords.filter(word => 
      lineWords.some(lineWord => lineWord.includes(word) || word.includes(lineWord))
    );

    const score = matchingWords.length / targetWords.length;
    if (score > bestScore && score > 0.4) { // Lower threshold for fuzzy matching
      bestScore = score;
      bestMatch = line;
    }
  }

  return bestMatch;
}