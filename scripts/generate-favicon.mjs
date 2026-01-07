import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.join(__dirname, '..');
const logoPath = path.join(projectRoot, 'CCgather logo 72x72.png');
const outputPath = path.join(projectRoot, 'public', 'favicon.png');
const appFaviconPath = path.join(projectRoot, 'app', 'favicon.png');

async function generateFavicon() {
  const size = 80;
  const logoSize = 56; // Logo size within the circle
  const padding = (size - logoSize) / 2;

  // Create circular black background with logo centered
  const circleBackground = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="#0D0D0F"/>
    </svg>`
  );

  // Resize logo
  const resizedLogo = await sharp(logoPath)
    .resize(logoSize, logoSize)
    .toBuffer();

  // Composite logo on circle background
  const favicon = await sharp(circleBackground)
    .composite([
      {
        input: resizedLogo,
        top: Math.round(padding),
        left: Math.round(padding),
      }
    ])
    .png()
    .toBuffer();

  // Save to public folder
  await sharp(favicon).toFile(outputPath);
  console.log(`✅ Favicon generated: ${outputPath}`);

  // Also save to app folder for Next.js
  await sharp(favicon).toFile(appFaviconPath);
  console.log(`✅ Favicon generated: ${appFaviconPath}`);
}

generateFavicon().catch(console.error);
