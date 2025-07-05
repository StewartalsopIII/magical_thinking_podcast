import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

export async function markdownToPlainText(markdownContent: string): Promise<string> {
  // Simple markdown to plain text conversion
  return markdownContent
    // Remove headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Remove horizontal rules
    .replace(/^---+$/gm, '')
    // Remove blockquotes
    .replace(/^>\s+/gm, '')
    // Remove list markers
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    // Clean up extra whitespace
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
}

export async function chunkTranscript(plainText: string) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ["\n\n", "\n", " ", ""],
  });
  
  const chunks = await splitter.createDocuments([plainText]);
  return chunks.map((doc, index) => ({
    text_content: doc.pageContent,
    chunk_index: index,
    timestamp_start: '00:00:00',
    timestamp_end: '00:00:00',
    metadata: {}
  }));
}

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const DEEPINFRA_API_KEY = process.env.DEEPINFRA_API_KEY;
  
  if (!DEEPINFRA_API_KEY) {
    throw new Error('DEEPINFRA_API_KEY environment variable is not set');
  }

  const response = await fetch("https://api.deepinfra.com/v1/openai/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DEEPINFRA_API_KEY}`,
    },
    body: JSON.stringify({
      model: "BAAI/bge-m3",
      input: texts,
      encoding_format: "float",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepInfra API error: ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  return data.data.map((item: any) => item.embedding);
}