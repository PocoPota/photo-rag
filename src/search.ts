import process from "process";
import { GoogleGenAI } from "@google/genai";
import { config } from "dotenv";
config({ path: ".env.local" });
import path from "path";
import { readFile } from "fs/promises";

// コマンドライン引数を取得
const q = process.argv.slice(2);

// 引数がない場合は終了
if (q.length === 0) {
  console.log("検索クエリを指定してください。");
  process.exit(1);
}

// キーワードのエンベディング
if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not set");
}
const ai = new GoogleGenAI({});

const response = await ai.models.embedContent({
  model: "gemini-embedding-001",
  contents: q,
});

const embedQuery = response.embeddings?.[0]?.values;

if (!embedQuery) {
  throw new Error("embedQuery is empty");
}

// jsonファイルを読み込み
const photosJson = await readFile(path.join("data", "photos.json"), {
  encoding: "utf-8",
});
const photos = JSON.parse(photosJson) as {
  id: number;
  fileName: string;
  caption: string;
  date: string;
  embedding: number[];
}[];

// コサイン類似度を計算
function cosineSimilarity(a: number[], b: number[]) {
  const dotProduct = a.reduce((sum, aVal, i) => sum + aVal * (b[i] || 0), 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (magnitudeA * magnitudeB);
}

// 各写真のエンベディングとクエリのエンベディングのコサイン類似度を計算
const photosWithSimilarity = photos.map((photo) => ({
  ...photo,
  similarity: cosineSimilarity(photo.embedding, embedQuery),
}));

// 類似度でソート
photosWithSimilarity.sort((a, b) => b.similarity - a.similarity);

// 上位5件を表示
const topK = 5;
console.log(`Top ${topK} results for query: "${q.join(" ")}"`);
photosWithSimilarity.slice(0, topK).forEach((photo, index) => {
  console.log(
    `${index + 1}. ${photo.fileName} (Similarity: ${photo.similarity.toFixed(
      4
    )})`
  );
  console.log(`   Caption: ${photo.caption}`);
});
