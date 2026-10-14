const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const rootDir = path.join(__dirname, '..');
const assetsDir = path.join(rootDir, 'assets');
const publicAssetsDir = path.join(rootDir, 'public', 'assets');
const logoPath = path.join(rootDir, 'src', 'assets', 'running_technician_logo.png');

if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
if (!fs.existsSync(publicAssetsDir)) fs.mkdirSync(publicAssetsDir, { recursive: true });

console.log('Reading official running technician logo from:', logoPath);
const logoBuffer = fs.readFileSync(logoPath);
const logoPng = PNG.sync.read(logoBuffer);
console.log(`Original logo loaded: ${logoPng.width}x${logoPng.height}`);

// Helper: Bilinear or nearest-neighbor image scaling
function resizePNG(src, targetWidth, targetHeight) {
  const dst = new PNG({ width: targetWidth, height: targetHeight });
  const xRatio = src.width / targetWidth;
  const yRatio = src.height / targetHeight;

  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const srcX = Math.min(Math.floor(x * xRatio), src.width - 1);
      const srcY = Math.min(Math.floor(y * yRatio), src.height - 1);
      const srcIdx = (srcY * src.width + srcX) << 2;
      const dstIdx = (y * targetWidth + x) << 2;

      dst.data[dstIdx] = src.data[srcIdx];
      dst.data[dstIdx + 1] = src.data[srcIdx + 1];
      dst.data[dstIdx + 2] = src.data[srcIdx + 2];
      dst.data[dstIdx + 3] = src.data[srcIdx + 3];
    }
  }
  return dst;
}

// 1. Generate icon.png (1024x1024)
console.log('Generating assets/icon.png...');
const iconOut = PNG.sync.write(logoPng);
fs.writeFileSync(path.join(assetsDir, 'icon.png'), iconOut);
fs.writeFileSync(path.join(publicAssetsDir, 'icon.png'), iconOut);

// 2. Generate adaptive-icon.png (1024x1024 with logo centered in safe zone ~680px)
console.log('Generating assets/adaptive-icon.png...');
const adaptive = new PNG({ width: 1024, height: 1024 });
// fill background with #001F3F
for (let i = 0; i < 1024 * 1024; i++) {
  const idx = i << 2;
  adaptive.data[idx] = 0x00;     // R
  adaptive.data[idx + 1] = 0x1F; // G
  adaptive.data[idx + 2] = 0x3F; // B
  adaptive.data[idx + 3] = 255;  // A
}

// scale logo to 680x680 and paste in center (offsetX = 172, offsetY = 172)
const safeLogo = resizePNG(logoPng, 680, 680);
const offsetA = Math.floor((1024 - 680) / 2);

for (let y = 0; y < 680; y++) {
  for (let x = 0; x < 680; x++) {
    const sIdx = (y * 680 + x) << 2;
    const dIdx = ((y + offsetA) * 1024 + (x + offsetA)) << 2;
    const alpha = safeLogo.data[sIdx + 3] / 255;

    adaptive.data[dIdx] = Math.round(safeLogo.data[sIdx] * alpha + adaptive.data[dIdx] * (1 - alpha));
    adaptive.data[dIdx + 1] = Math.round(safeLogo.data[sIdx + 1] * alpha + adaptive.data[dIdx + 1] * (1 - alpha));
    adaptive.data[dIdx + 2] = Math.round(safeLogo.data[sIdx + 2] * alpha + adaptive.data[dIdx + 2] * (1 - alpha));
    adaptive.data[dIdx + 3] = 255;
  }
}
const adaptiveOut = PNG.sync.write(adaptive);
fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), adaptiveOut);
fs.writeFileSync(path.join(publicAssetsDir, 'adaptive-icon.png'), adaptiveOut);

// 3. Generate favicon.png (48x48)
console.log('Generating assets/favicon.png...');
const favicon = resizePNG(logoPng, 48, 48);
const faviconOut = PNG.sync.write(favicon);
fs.writeFileSync(path.join(assetsDir, 'favicon.png'), faviconOut);
fs.writeFileSync(path.join(publicAssetsDir, 'favicon.png'), faviconOut);

// 4. Generate splash.png (1242x2436 on Deep Navy Blue #001F3F with official emblem)
console.log('Generating assets/splash.png...');
const splashW = 1242;
const splashH = 2436;
const splash = new PNG({ width: splashW, height: splashH });

for (let i = 0; i < splashW * splashH; i++) {
  const idx = i << 2;
  splash.data[idx] = 0x00;     // R
  splash.data[idx + 1] = 0x1F; // G
  splash.data[idx + 2] = 0x3F; // B
  splash.data[idx + 3] = 255;  // A
}

// Center 560x560 logo emblem at y = 850
const emblemSize = 560;
const splashEmblem = resizePNG(logoPng, emblemSize, emblemSize);
const splashOffsetX = Math.floor((splashW - emblemSize) / 2);
const splashOffsetY = 850;

for (let y = 0; y < emblemSize; y++) {
  for (let x = 0; x < emblemSize; x++) {
    const sIdx = (y * emblemSize + x) << 2;
    const dIdx = ((y + splashOffsetY) * splashW + (x + splashOffsetX)) << 2;
    const alpha = splashEmblem.data[sIdx + 3] / 255;

    splash.data[dIdx] = Math.round(splashEmblem.data[sIdx] * alpha + splash.data[dIdx] * (1 - alpha));
    splash.data[dIdx + 1] = Math.round(splashEmblem.data[sIdx + 1] * alpha + splash.data[dIdx + 1] * (1 - alpha));
    splash.data[dIdx + 2] = Math.round(splashEmblem.data[sIdx + 2] * alpha + splash.data[dIdx + 2] * (1 - alpha));
    splash.data[dIdx + 3] = 255;
  }
}

const splashOut = PNG.sync.write(splash);
fs.writeFileSync(path.join(assetsDir, 'splash.png'), splashOut);
fs.writeFileSync(path.join(publicAssetsDir, 'splash.png'), splashOut);

// 5. Update Android res drawable folders if present
const resDir = path.join(rootDir, 'android', 'app', 'src', 'main', 'res');
if (fs.existsSync(resDir)) {
  const drawableFolders = [
    { name: 'drawable-mdpi', size: 128 },
    { name: 'drawable-hdpi', size: 192 },
    { name: 'drawable-xhdpi', size: 256 },
    { name: 'drawable-xxhdpi', size: 384 },
    { name: 'drawable-xxxhdpi', size: 512 }
  ];

  for (const f of drawableFolders) {
    const targetDir = path.join(resDir, f.name);
    if (fs.existsSync(targetDir)) {
      const splashLogo = resizePNG(logoPng, f.size, f.size);
      fs.writeFileSync(path.join(targetDir, 'splashscreen_logo.png'), PNG.sync.write(splashLogo));
      console.log(`Updated ${f.name}/splashscreen_logo.png (${f.size}x${f.size})`);
    }
  }
}

console.log('All brand launcher and splash assets successfully generated!');
