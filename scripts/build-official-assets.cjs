const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const srcImage = path.join(rootDir, 'src', 'assets', 'images', 'running_technician_emblem_1792087773690.jpg');

if (!fs.existsSync(srcImage)) {
  console.error('Source official image not found at:', srcImage);
  process.exit(1);
}

console.log('Using official source image:', srcImage);

// Destinations
const assetsDir = path.join(rootDir, 'assets');
const publicAssetsDir = path.join(rootDir, 'public', 'assets');
const srcAssetsDir = path.join(rootDir, 'src', 'assets');

[assetsDir, publicAssetsDir, srcAssetsDir].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// 1. Generate Full-Bleed Master PNG (1024x1024)
// Trim white margins around the circular emblem so it fills 100% edge-to-edge
const masterPng = path.join(srcAssetsDir, 'running_technician_logo.png');
const tempSquare = path.join('/tmp', 'qk_trimmed_emblem.png');
const tempMask = path.join('/tmp', 'qk_circle_mask.png');

console.log('Trimming outer padding and generating full-bleed master emblem...');
execSync(`convert "${srcImage}" -fuzz 10% -trim +repage -resize 1024x1024\\! "${tempSquare}"`);
execSync(`convert -size 1024x1024 xc:none -fill white -draw "circle 512,512 512,0" "${tempMask}"`);
execSync(`convert "${tempSquare}" "${tempMask}" -alpha off -compose CopyOpacity -composite "${masterPng}"`);
console.log('Full-bleed master PNG created at:', masterPng);

// Copy to assets/icon.png and public/assets/icon.png
fs.copyFileSync(masterPng, path.join(assetsDir, 'icon.png'));
fs.copyFileSync(masterPng, path.join(publicAssetsDir, 'icon.png'));
console.log('Copied to assets/icon.png and public/assets/icon.png');

// 2. Favicon (48x48)
execSync(`convert "${masterPng}" -resize 48x48 "${path.join(assetsDir, 'favicon.png')}"`);
fs.copyFileSync(path.join(assetsDir, 'favicon.png'), path.join(publicAssetsDir, 'favicon.png'));
fs.copyFileSync(path.join(assetsDir, 'favicon.png'), path.join(rootDir, 'public', 'favicon.png'));
console.log('Favicon generated');

// 3. Full-Bleed Adaptive Icon (1024x1024)
// Full-bleed edge-to-edge foreground image without squircle borders or excess transparent padding
const adaptiveIconPath = path.join(assetsDir, 'adaptive-icon.png');
execSync(`convert "${masterPng}" -resize 1024x1024 "${adaptiveIconPath}"`);
fs.copyFileSync(adaptiveIconPath, path.join(publicAssetsDir, 'adaptive-icon.png'));
console.log('Full-bleed adaptive icon generated');

// 4. Splash Screen (1242x2436)
// Solid Deep Navy Blue #001F3F with official emblem centered
const splashPath = path.join(assetsDir, 'splash.png');
execSync(`convert -size 1242x2436 xc:"#001F3F" \\( "${masterPng}" -resize 640x640 \\) -gravity center -geometry +0-100 -composite "${splashPath}"`);
fs.copyFileSync(splashPath, path.join(publicAssetsDir, 'splash.png'));
console.log('Splash screen generated');

// 5. Android Native Mipmap & Drawable Assets (Edge-to-Edge Full-Bleed)
const resDir = path.join(rootDir, 'android', 'app', 'src', 'main', 'res');
if (fs.existsSync(resDir)) {
  const densities = [
    { dir: 'mipmap-mdpi', launcher: 48, foreground: 108 },
    { dir: 'mipmap-hdpi', launcher: 72, foreground: 162 },
    { dir: 'mipmap-xhdpi', launcher: 96, foreground: 216 },
    { dir: 'mipmap-xxhdpi', launcher: 144, foreground: 324 },
    { dir: 'mipmap-xxxhdpi', launcher: 192, foreground: 432 },
  ];

  for (const d of densities) {
    const targetDir = path.join(resDir, d.dir);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    // ic_launcher.webp: full-bleed square icon tile
    execSync(`convert "${masterPng}" -resize ${d.launcher}x${d.launcher} "${path.join(targetDir, 'ic_launcher.webp')}"`);
    // ic_launcher_round.webp: circular cropped launcher icon
    execSync(`convert "${masterPng}" -resize ${d.launcher}x${d.launcher} "${path.join(targetDir, 'ic_launcher_round.webp')}"`);
    // ic_launcher_foreground.webp: full-bleed edge-to-edge foreground image
    execSync(`convert "${masterPng}" -resize ${d.foreground}x${d.foreground} "${path.join(targetDir, 'ic_launcher_foreground.webp')}"`);

    console.log(`Updated ${d.dir} launcher & foreground assets with full-bleed emblem`);
  }

  // splashscreen_logo.png in drawable-*
  const splashLogos = [
    { dir: 'drawable-mdpi', size: 128 },
    { dir: 'drawable-hdpi', size: 192 },
    { dir: 'drawable-xhdpi', size: 256 },
    { dir: 'drawable-xxhdpi', size: 384 },
    { dir: 'drawable-xxxhdpi', size: 512 }
  ];

  for (const s of splashLogos) {
    const targetDir = path.join(resDir, s.dir);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    execSync(`convert "${masterPng}" -resize ${s.size}x${s.size} "${path.join(targetDir, 'splashscreen_logo.png')}"`);
    console.log(`Updated ${s.dir}/splashscreen_logo.png (${s.size}x${s.size})`);
  }
}

console.log('All full-bleed edge-to-edge launcher and splash assets successfully generated!');
