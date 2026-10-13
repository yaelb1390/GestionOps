const sharp = require('sharp');
const path = require('path');

async function generateIcons() {
  const inputPath = path.join(__dirname, 'public', 'app-icon.png');
  const publicDir = path.join(__dirname, 'public');
  
  try {
    await sharp(inputPath).resize(192, 192).toFile(path.join(publicDir, 'icon-192x192.png'));
    await sharp(inputPath).resize(512, 512).toFile(path.join(publicDir, 'icon-512x512.png'));
    await sharp(inputPath).resize(180, 180).toFile(path.join(publicDir, 'apple-touch-icon.png'));
  } catch (error) {
    console.error(error);
  }
}
generateIcons();
