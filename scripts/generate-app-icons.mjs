import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const buildDir = path.join(root, "build");
const sourceSvg = path.join(buildDir, "icon.svg");

function iconByte(value) {
  return value >= 256 ? 0 : value;
}

function createIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6 + count * 16;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  let offset = headerSize;
  pngBuffers.forEach(({ size, buffer }, index) => {
    const entry = 6 + index * 16;
    header.writeUInt8(iconByte(size), entry);
    header.writeUInt8(iconByte(size), entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(buffer.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += buffer.length;
  });

  return Buffer.concat([header, ...pngBuffers.map((item) => item.buffer)]);
}

async function renderPng(svg, size, outputPath) {
  const buffer = await sharp(svg, { density: 384 })
    .resize(size, size, { fit: "contain" })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  if (outputPath) await writeFile(outputPath, buffer);
  return buffer;
}

async function main() {
  await mkdir(buildDir, { recursive: true });
  const svg = await readFile(sourceSvg);
  const pngSizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];

  const icoBuffers = [];
  for (const size of pngSizes) {
    const output = path.join(buildDir, `icon-${size}.png`);
    const buffer = await renderPng(svg, size, output);
    if (size <= 256) icoBuffers.push({ size, buffer });
  }

  await writeFile(path.join(buildDir, "icon.png"), await renderPng(svg, 1024));
  await writeFile(path.join(buildDir, "icon.ico"), createIco(icoBuffers));
  await writeFile(path.join(root, "public", "favicon.svg"), svg);
  console.log(`Generated app icons in ${buildDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
