import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const staticDir = join(__dirname, '..', 'static');
const splashDir = join(staticDir, 'splash');
const logoPath = '/Users/iphone/Desktop/Projects/TSP/TSP-Competition/logo.png';

mkdirSync(splashDir, { recursive: true });

const BG_COLOR = '#0a0a0a';

async function generateIcon(name, size, maskable = false) {
  const logoPadding = maskable ? 0.25 : 0.12;
  const logoSize = Math.round(size * (1 - logoPadding * 2));
  const offset = Math.round(size * logoPadding);

  const resizedLogo = await sharp(logoPath)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const rx = maskable ? 0 : Math.round(size * 0.18);

  // Create background with rounded corners (for non-maskable)
  const bgSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="${BG_COLOR}" rx="${rx}"/>
  </svg>`;

  await sharp(Buffer.from(bgSvg))
    .composite([{ input: resizedLogo, left: offset, top: offset }])
    .png()
    .toFile(join(staticDir, name));

  console.log(`  ✓ ${name} (${size}x${size})`);
}

async function generateSplash(width, height) {
  const logoSize = Math.round(Math.min(width, height) * 0.22);
  const logoX = Math.round((width - logoSize) / 2);
  const logoY = Math.round((height - logoSize) / 2 - logoSize * 0.15);

  const resizedLogo = await sharp(logoPath)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  // Text "IB Portal" below logo
  const textY = logoY + logoSize + 50;
  const bgSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="${BG_COLOR}"/>
    <text x="${width / 2}" y="${textY}" font-family="Arial, Helvetica, sans-serif" font-weight="500" font-size="36" fill="#6b7280" text-anchor="middle">IB Portal</text>
  </svg>`;

  const filename = `splash-${width}x${height}.png`;
  await sharp(Buffer.from(bgSvg))
    .composite([{ input: resizedLogo, left: logoX, top: logoY }])
    .png()
    .toFile(join(splashDir, filename));

  console.log(`  ✓ ${filename}`);
}

const icons = [
  { name: 'favicon.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-maskable-192.png', size: 192, maskable: true },
  { name: 'icon-maskable-512.png', size: 512, maskable: true },
];

const splashScreens = [
  { w: 750, h: 1334 },
  { w: 1242, h: 2208 },
  { w: 1125, h: 2436 },
  { w: 828, h: 1792 },
  { w: 1242, h: 2688 },
  { w: 1080, h: 2340 },
  { w: 1170, h: 2532 },
  { w: 1284, h: 2778 },
  { w: 1179, h: 2556 },
  { w: 1290, h: 2796 },
  { w: 1206, h: 2622 },
  { w: 1320, h: 2868 },
];

async function generate() {
  console.log('Generating icons from logo...');
  for (const icon of icons) {
    await generateIcon(icon.name, icon.size, icon.maskable);
  }

  console.log('\nGenerating splash screens...');
  for (const s of splashScreens) {
    await generateSplash(s.w, s.h);
  }

  console.log('\nDone!');
}

generate().catch(console.error);
