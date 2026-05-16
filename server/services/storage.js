import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

const basePath = path.resolve(config.storagePath);

function ensureDir() {
  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath, { recursive: true });
  }
}

export async function put(filename, buffer) {
  ensureDir();
  const filePath = path.join(basePath, filename);
  await fs.promises.writeFile(filePath, buffer);
  return filePath;
}

export async function get(filename) {
  const filePath = path.join(basePath, filename);
  if (!fs.existsSync(filePath)) return null;
  return fs.promises.readFile(filePath);
}

export function getUrl(filename) {
  return `/uploads/${filename}`;
}

export async function remove(filename) {
  const filePath = path.join(basePath, filename);
  if (fs.existsSync(filePath)) {
    await fs.promises.unlink(filePath);
    return true;
  }
  return false;
}

export function getPath(filename) {
  return path.join(basePath, filename);
}

export default { put, get, getUrl, remove, getPath };
