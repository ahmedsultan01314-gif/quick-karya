const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const assetsDir = path.join(rootDir, 'assets');
const masterSource = path.join(assetsDir, 'watermarked_img_14700063438706443329.png');

console.log('✓ Master theme-matched source icon:', masterSource);

// 1. Sync assets/ and public/assets/
const iconPath = path.join(assetsDir, 'icon.png');
const adaptiveIconPath = path.join(assetsDir, 'adaptive-icon.png');
const publicIcon = path.join(rootDir, 'public', 'assets', 'icon.png');
const publicAdaptive = path.join(rootDir, 'public', 'assets', 'adaptive-icon.png');
const publicWatermarked = path.join(rootDir, 'public', 'assets', 'watermarked_img_14700063438706443329.png');
const faviconPath = path.join(assetsDir, 'favicon.png');
const publicFavicon = path.join(rootDir, 'public', 'favicon.png');

fs.copyFileSync(masterSource, iconPath);
fs.copyFileSync(masterSource, adaptiveIconPath);
fs.copyFileSync(masterSource, publicIcon);
fs.copyFileSync(masterSource, publicAdaptive);
fs.copyFileSync(masterSource, publicWatermarked);

execSync(`convert "${masterSource}" -resize 48x48 "${faviconPath}"`);
fs.copyFileSync(faviconPath, publicFavicon);
console.log('✓ Synchronized app icons and web favicons');

// 2. Android Mipmap densities
const resDir = path.join(rootDir, 'android', 'app', 'src', 'main', 'res');
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

  // Clean out any old/loose files in directory
  const files = fs.readdirSync(targetDir);
  for (const f of files) {
    if (f.startsWith('ic_launcher')) {
      fs.unlinkSync(path.join(targetDir, f));
    }
  }

  // 1. ic_launcher.webp
  execSync(`convert "${masterSource}" -resize ${d.launcher}x${d.launcher} "${path.join(targetDir, 'ic_launcher.webp')}"`);

  // 2. ic_launcher_round.webp (circular mask on #001F3F base)
  const tempRound = path.join('/tmp', `round_${d.launcher}.png`);
  const radius = Math.floor(d.launcher / 2);
  execSync(`convert -size ${d.launcher}x${d.launcher} xc:none -fill white -draw "circle ${radius},${radius} ${radius},0" /tmp/circle_${d.launcher}.png`);
  execSync(`convert \\( "${masterSource}" -resize ${d.launcher}x${d.launcher} \\) /tmp/circle_${d.launcher}.png -alpha off -compose CopyOpacity -composite "${tempRound}"`);
  execSync(`convert -size ${d.launcher}x${d.launcher} xc:"#001F3F" "${tempRound}" -composite "${path.join(targetDir, 'ic_launcher_round.webp')}"`);

  // 3. ic_launcher_foreground.webp (Android adaptive icon foreground layer)
  execSync(`convert "${masterSource}" -resize ${d.foreground}x${d.foreground} "${path.join(targetDir, 'ic_launcher_foreground.webp')}"`);

  console.log(`✓ Replaced ${d.dir} assets (ic_launcher.webp, ic_launcher_round.webp, ic_launcher_foreground.webp)`);
}

// 3. mipmap-anydpi-v26 XML files
const anyDpiDir = path.join(resDir, 'mipmap-anydpi-v26');
if (!fs.existsSync(anyDpiDir)) fs.mkdirSync(anyDpiDir, { recursive: true });

const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/iconBackground"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;

fs.writeFileSync(path.join(anyDpiDir, 'ic_launcher.xml'), adaptiveXml);
fs.writeFileSync(path.join(anyDpiDir, 'ic_launcher_round.xml'), adaptiveXml);
console.log('✓ Verified mipmap-anydpi-v26 adaptive XMLs');

// 4. Update splashscreen logos in drawable-*
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
  execSync(`convert "${masterSource}" -resize ${s.size}x${s.size} "${path.join(targetDir, 'splashscreen_logo.png')}"`);
  console.log(`✓ Updated ${s.dir}/splashscreen_logo.png`);
}

console.log('✓ All Android icon assets generated with theme-matched colors!');
