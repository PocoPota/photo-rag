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

const response = await ai.models.generateContent({
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

if(!response.text){
  throw new Error("response.text is empty");
}
const parsedResponse = JSON.parse(response.text);

// 写真データを統合したjsonの生成
const photos = [];
for (let i = 0; i < names.length; i++) {
  photos.push({
    id: i + 1,
    fileName: "data/photos/" + names[i],
    caption: parsedResponse[i].caption,
    date: `${exifs[i]!.DateTimeOriginal}`
  });
}

console.log(photos);