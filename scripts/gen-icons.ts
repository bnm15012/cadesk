import sharp from "sharp";
import { writeFileSync } from "fs";

// SVG: dark navy background with rounded corners, folder + checkmark icon
const svg = (size: number) => {
  const r = Math.round(size * 0.22); // corner radius
  const iconScale = size / 512;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="#1e293b"/>
  <g transform="translate(${size * 0.15}, ${size * 0.18}) scale(${iconScale * 0.7})">
    <!-- Folder body -->
    <path d="M32 96C32 78.3 46.3 64 64 64h64l32 32h192c17.7 0 32 14.3 32 32v224c0 17.7-14.3 32-32 32H64c-17.7 0-32-14.3-32-32V96z"
      fill="none" stroke="#f59e0b" stroke-width="28" stroke-linejoin="round" stroke-linecap="round"/>
    <!-- Checkmark -->
    <polyline points="160,280 220,340 352,208"
      fill="none" stroke="#f59e0b" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
};

async function generate(size: number, outPath: string) {
  const buf = Buffer.from(svg(size));
  await sharp(buf).resize(size, size).png().toFile(outPath);
  console.log(`✓ ${outPath}`);
}

await generate(192, "public/icon-192.png");
await generate(512, "public/icon-512.png");
await generate(180, "public/apple-touch-icon.png");

// Also replace favicon.ico with a 64px version
const faviconBuf = Buffer.from(svg(64));
const pngBuf = await sharp(faviconBuf).resize(64, 64).png().toBuffer();
writeFileSync("public/favicon.png", pngBuf);
console.log("✓ public/favicon.png (use this as favicon if needed)");
