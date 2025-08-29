import { exiftool } from "exiftool-vendored";
import { readdir, readFile } from "fs/promises";
import path from "path";
import { GoogleGenAI, createUserContent, Type } from "@google/genai";
import { config } from "dotenv";
config({ path: ".env.local" });

// 該当写真一覧取得
const names = await readdir("data/photos");

// EXIF情報取得
const exifs = [];
for (const name of names) {
  const fullPath = path.join("data/photos", name);
  const tags = await exiftool.read(fullPath);
  exifs.push(tags);
}

// Google GenAIでキャプション生成
if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not set");
}
const ai = new GoogleGenAI({});

const base64Images = [];
for (const name of names) {
  const fullPath = path.join("data/photos", name);
  const imageBase64 = await readFile(fullPath, { encoding: "base64" });
  base64Images.push(imageBase64);
}

const inlineDatas = [];
for (const base64Image of base64Images) {
  inlineDatas.push({
    inlineData: {
      data: base64Image,
      mimeType: "image/jpeg",
    },
  });
}

const captionResponse = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: createUserContent([
    "以下の各画像に対して、簡潔なキャプションを日本語で生成してください。",
    ...inlineDatas,
  ]),
  config: {
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          caption: { type: Type.STRING },
        },
      },
    },
  },
});

if(!captionResponse.text){
  throw new Error("response.text is empty");
}
const parsedResponse = JSON.parse(captionResponse.text);
const captions = parsedResponse.map((item: { caption: string }) => item.caption);

// キャプションのエンベディング生成
const embeddingResponse = await ai.models.embedContent({
  model: "gemini-embedding-001",
  contents: captions,
});

if(!embeddingResponse.embeddings){
  throw new Error("embeddingResponse.embeddings is empty");
}

// photosの型
type Photo = {
  id: number;
  fileName: string;
  caption: string;
  date: string;
  embedding: number[];
};

// 写真データを統合したjsonの生成
const photos: Array<Photo> = [];
for (let i = 0; i < names.length; i++) {
  photos.push({
    id: i + 1,
    fileName: "data/photos/" + names[i],
    caption: captions[i],
    date: `${exifs[i]!.DateTimeOriginal}`,
    embedding: embeddingResponse.embeddings[i]!.values || [],
  });
}

// photos.jsonとして保存
await import("fs").then((fs) =>
  fs.promises.writeFile(
    "data/photos.json",
    JSON.stringify(photos, null, 2),
    "utf-8"
  )
);

console.log(photos)