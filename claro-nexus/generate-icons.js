const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function generateIcons() {
  const inputPath = path.join(__dirname, 'src', 'app', 'icon.png');
  const publicDir = path.join(__dirname, 'public');
  
  if (!fs.existsSync(inputPath)) {
    console.log("No se encontró icon.png en src/app. Por favor, asegúrate de guardar allí la imagen.");
    return;
  }

  try {
    // Generate 192x192
    await sharp(inputPath)
      .resize(192, 192)
      .toFile(path.join(publicDir, 'icon-192x192.png'));
    console.log("Generado icon-192x192.png");

    // Generate 512x512
    await sharp(inputPath)
      .resize(512, 512)
      .toFile(path.join(publicDir, 'icon-512x512.png'));
    console.log("Generado icon-512x512.png");

    // Copy to apple-icon.png just in case (Next.js can use it from app/ too)
    await sharp(inputPath)
      .resize(180, 180)
      .toFile(path.join(__dirname, 'src', 'app', 'apple-icon.png'));
    console.log("Generado apple-icon.png en src/app");

  } catch (error) {
    console.error("Error generando iconos:", error);
  }
}

generateIcons();
