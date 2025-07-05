import MarkdownIt from 'markdown-it';
import mdPlainText from 'markdown-it-plain-text';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

export async function markdownToPlainText(markdownContent: string): Promise<string> {
  const md = new MarkdownIt();
  md.use(mdPlainText);
  md.render(markdownContent);
  return (md as any).plainText || '';
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