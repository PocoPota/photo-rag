import { exiftool } from "exiftool-vendored";
import { readdir } from "fs/promises";
import path from "path";

// 該当写真一覧取得
const names = await readdir("data/photos");

// EXIF情報取得
for (const name of names) {
  const fullPath = path.join("data/photos", name);
  const tags = await exiftool.read(fullPath);
  console.log(`${name}: ${tags.DateTimeOriginal}`);
}