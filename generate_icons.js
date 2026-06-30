// Run with: node generate_icons.js
// Requires: npm install sharp
// This generates all PWA icon sizes from your logo.jpeg

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SOURCE = path.join(__dirname, 'public', 'logo.jpeg');
const OUT_DIR = path.join(__dirname, 'public', 'icons');

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  if (!fs.existsSync(SOURCE)) {
    console.error('❌ logo.jpeg not found at public/logo.jpeg');
    console.error('   Place your logo there first, then run this script again.');
    process.exit(1);
  }

  console.log('🎨 Generating PWA icons from logo.jpeg...\n');

  // Standard icons (any purpose)
  for (const size of SIZES) {
    await sharp(SOURCE)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(path.join(OUT_DIR, `icon-${size}.png`));
    console.log(`✅ icon-${size}.png`);
  }

  // Maskable icons (need padding so Android doesn't crop the logo in a circle)
  // Maskable = logo should fit within the "safe zone" (center 80%)
  for (const size of [192, 512]) {
    const padding = Math.round(size * 0.1); // 10% padding on each side
    const innerSize = size - padding * 2;
    await sharp(SOURCE)
      .resize(innerSize, innerSize, { fit: 'cover' })
      .extend({
        top: padding, bottom: padding, left: padding, right: padding,
        background: { r: 15, g: 110, b: 86, alpha: 1 } // #0f6e56 brand green
      })
      .png()
      .toFile(path.join(OUT_DIR, `icon-${size}-maskable.png`));
    console.log(`✅ icon-${size}-maskable.png (with safe-zone padding)`);
  }

  // Also generate favicon
  await sharp(SOURCE).resize(32, 32).png().toFile(path.join(__dirname, 'public', 'favicon.png'));
  console.log('✅ favicon.png');

  // Apple touch icon
  await sharp(SOURCE).resize(180, 180).png().toFile(path.join(__dirname, 'public', 'apple-touch-icon.png'));
  console.log('✅ apple-touch-icon.png');

  console.log('\n🎉 All icons generated! Now run: git add . && git commit -m "feat: PWA icons" && git push');
}

generateIcons().catch(console.error);
