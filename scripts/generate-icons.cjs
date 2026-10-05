const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

// Ensure assets directory exists
const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Helper: distance to rounded rectangle
function sdRoundBox(px, py, bx, by, r) {
  const qx = Math.abs(px) - bx + r;
  const qy = Math.abs(py) - by + r;
  const outer = Math.sqrt(Math.max(qx, 0) ** 2 + Math.max(qy, 0) ** 2);
  const inner = Math.min(Math.max(qx, qy), 0);
  return outer + inner - r;
}

// Helper: distance to line segment
function sdSegment(px, py, ax, ay, bx, by) {
  const pax = px - ax, pay = py - ay;
  const bax = bx - ax, bay = by - ay;
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
  const dx = pax - bax * h;
  const dy = pay - bay * h;
  return Math.sqrt(dx * dx + dy * dy);
}

// Distance to 'Q' letter centered around (qx, qy) with radius R, stroke width W
function sdLetterQ(px, py, cx, cy, rx, ry, strokeW) {
  const relX = px - cx;
  const relY = py - cy;
  // Ellipse ring distance approximation
  const dEllipse = Math.abs(Math.sqrt((relX / rx) ** 2 + (relY / ry) ** 2) - 1.0) * Math.min(rx, ry);
  const distRing = dEllipse - strokeW / 2;

  // Q's tail: segment from (cx + rx * 0.2, cy + ry * 0.3) to (cx + rx * 1.05, cy + ry * 1.15)
  const tailX1 = cx + rx * 0.15;
  const tailY1 = cy + ry * 0.35;
  const tailX2 = cx + rx * 1.1;
  const tailY2 = cy + ry * 1.15;
  const distTail = sdSegment(px, py, tailX1, tailY1, tailX2, tailY2) - strokeW / 2;

  return Math.min(distRing, distTail);
}

// Distance to 'K' letter centered around (cx, cy)
function sdLetterK(px, py, cx, cy, stemH, armLen, strokeW) {
  // Stem: vertical line from cy - stemH to cy + stemH at x = cx - armLen * 0.4
  const stemX = cx - armLen * 0.45;
  const distStem = sdSegment(px, py, stemX, cy - stemH, stemX, cy + stemH) - strokeW / 2;

  // Center junction for arms
  const juncX = stemX;
  const juncY = cy;

  // Upper arm: junction to (cx + armLen * 0.55, cy - stemH)
  const distUpperArm = sdSegment(px, py, juncX, juncY + stemH * 0.05, cx + armLen * 0.55, cy - stemH) - strokeW / 2;

  // Lower leg: branch from upper arm midpoint down to (cx + armLen * 0.6, cy + stemH)
  const midArmX = juncX + (cx + armLen * 0.55 - juncX) * 0.42;
  const midArmY = (juncY + stemH * 0.05) + (cy - stemH - (juncY + stemH * 0.05)) * 0.42;
  const distLowerLeg = sdSegment(px, py, midArmX, midArmY, cx + armLen * 0.6, cy + stemH) - strokeW / 2;

  return Math.min(distStem, distUpperArm, distLowerLeg);
}

// Generate Adaptive Icon Foreground (1024 x 1024, transparent background, centered QK badge within safe zone 66%)
function generateAdaptiveForeground() {
  const width = 1024;
  const height = 1024;
  const png = new PNG({ width, height });

  const centerX = 512;
  const centerY = 512;
  // Badge size: 540x540, fits well within 66% circle (radius 340)
  const badgeRadius = 110;
  const halfBadge = 260;

  // Q and K dimensions
  const qCenterX = centerX - 120;
  const qCenterY = centerY;
  const qRx = 105;
  const qRy = 135;
  const letterStroke = 44;

  const kCenterX = centerX + 125;
  const kCenterY = centerY;
  const kStemH = 135;
  const kArmLen = 220;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;

      // Supersampling 2x2 for smooth edges
      let rAcc = 0, gAcc = 0, bAcc = 0, aAcc = 0;

      for (let sy = 0; sy < 2; sy++) {
        for (let sx = 0; sx < 2; sx++) {
          const subX = x + (sx + 0.5) / 2;
          const subY = y + (sy + 0.5) / 2;

          // Distance to badge
          const dBadge = sdRoundBox(subX - centerX, subY - centerY, halfBadge, halfBadge, badgeRadius);

          if (dBadge <= 0) {
            // Inside badge!
            // Gradient: top-left (emerald-600 #059669) to bottom-right (emerald-800 #065f46)
            const tGrad = Math.max(0, Math.min(1, ((subX - (centerX - halfBadge)) + (subY - (centerY - halfBadge))) / (halfBadge * 4)));
            let r = Math.round(5 * (1 - tGrad) + 6 * tGrad);
            let g = Math.round(150 * (1 - tGrad) + 95 * tGrad);
            let b = Math.round(105 * (1 - tGrad) + 70 * tGrad);
            let a = 255;

            // Border: 8px border with emerald-400 (#34d399, [52, 211, 153])
            if (dBadge >= -10) {
              const borderFactor = Math.min(1, Math.max(0, (dBadge + 10) / 10));
              r = Math.round(r * (1 - borderFactor * 0.7) + 52 * borderFactor * 0.7);
              g = Math.round(g * (1 - borderFactor * 0.7) + 211 * borderFactor * 0.7);
              b = Math.round(b * (1 - borderFactor * 0.7) + 153 * borderFactor * 0.7);
            }

            // Subdued subtle diagonal highlight strip across badge
            const diagDist = Math.abs((subX - centerX) - (subY - centerY));
            if (diagDist < 30) {
              const hl = (1 - diagDist / 30) * 18;
              r = Math.min(255, r + hl);
              g = Math.min(255, g + hl);
              b = Math.min(255, b + hl);
            }

            // Check distance to Q and K letters
            const dQ = sdLetterQ(subX, subY, qCenterX, qCenterY, qRx, qRy, letterStroke);
            const dK = sdLetterK(subX, subY, kCenterX, kCenterY, kStemH, kArmLen, letterStroke);
            const dLetter = Math.min(dQ, dK);

            // Subtle drop shadow behind letters
            const dShadow = Math.min(
              sdLetterQ(subX - 5, subY - 5, qCenterX, qCenterY, qRx, qRy, letterStroke),
              sdLetterK(subX - 5, subY - 5, kCenterX, kCenterY, kStemH, kArmLen, letterStroke)
            );
            if (dShadow < 0 && dLetter >= 0) {
              r = Math.round(r * 0.75);
              g = Math.round(g * 0.75);
              b = Math.round(b * 0.75);
            }

            if (dLetter < 0) {
              // Inside letters: Crisp White #FFFFFF
              r = 255;
              g = 255;
              b = 255;
            } else if (dLetter < 1.5) {
              // Antialias letter border
              const alphaLetter = 1 - dLetter / 1.5;
              r = Math.round(r * (1 - alphaLetter) + 255 * alphaLetter);
              g = Math.round(g * (1 - alphaLetter) + 255 * alphaLetter);
              b = Math.round(b * (1 - alphaLetter) + 255 * alphaLetter);
            }

            // Subtle amber emergency spark dot at bottom right corner of badge
            const sparkDist = Math.sqrt((subX - (centerX + 185)) ** 2 + (subY - (centerY + 185)) ** 2) - 16;
            if (sparkDist < 0) {
              r = 251; g = 191; b = 36; // Amber-400
            } else if (sparkDist < 2) {
              const sa = 1 - sparkDist / 2;
              r = Math.round(r * (1 - sa) + 251 * sa);
              g = Math.round(g * (1 - sa) + 191 * sa);
              b = Math.round(b * (1 - sa) + 36 * sa);
            }

            rAcc += r; gAcc += g; bAcc += b; aAcc += a;
          } else if (dBadge < 1.5) {
            // Anti-aliased outer badge border to transparent
            const alphaEdge = (1 - dBadge / 1.5);
            rAcc += 52 * alphaEdge;
            gAcc += 211 * alphaEdge;
            bAcc += 153 * alphaEdge;
            aAcc += 255 * alphaEdge;
          }
        }
      }

      png.data[idx] = Math.round(rAcc / 4);
      png.data[idx + 1] = Math.round(gAcc / 4);
      png.data[idx + 2] = Math.round(bAcc / 4);
      png.data[idx + 3] = Math.round(aAcc / 4);
    }
  }

  const outPath = path.join(assetsDir, 'adaptive-icon.png');
  fs.writeFileSync(outPath, PNG.sync.write(png));
  console.log('Saved:', outPath);
}

// Generate Standard App Icon (1024 x 1024, Full bleed rich emerald gradient + QK emblem)
function generateAppIcon() {
  const width = 1024;
  const height = 1024;
  const png = new PNG({ width, height });

  const centerX = 512;
  const centerY = 512;
  const badgeRadius = 140;
  const halfBadge = 340;

  const qCenterX = centerX - 145;
  const qCenterY = centerY;
  const qRx = 135;
  const qRy = 175;
  const letterStroke = 56;

  const kCenterX = centerX + 155;
  const kCenterY = centerY;
  const kStemH = 175;
  const kArmLen = 270;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;

      let rAcc = 0, gAcc = 0, bAcc = 0;

      for (let sy = 0; sy < 2; sy++) {
        for (let sx = 0; sx < 2; sx++) {
          const subX = x + (sx + 0.5) / 2;
          const subY = y + (sy + 0.5) / 2;

          // Background is rich deep emerald #064e3b -> #022c22
          const bgGrad = Math.min(1, Math.max(0, (subX + subY) / 2048));
          let r = Math.round(6 * (1 - bgGrad) + 2 * bgGrad);
          let g = Math.round(78 * (1 - bgGrad) + 44 * bgGrad);
          let b = Math.round(59 * (1 - bgGrad) + 34 * bgGrad);

          // Subtle radial glow from center
          const distCenter = Math.sqrt((subX - centerX) ** 2 + (subY - centerY) ** 2);
          if (distCenter < 500) {
            const glow = (1 - distCenter / 500) * 25;
            g = Math.min(255, g + glow * 1.2);
            b = Math.min(255, b + glow * 0.8);
          }

          // Badge distance
          const dBadge = sdRoundBox(subX - centerX, subY - centerY, halfBadge, halfBadge, badgeRadius);

          if (dBadge <= 0) {
            // Inside badge: emerald-600 to emerald-800
            const tGrad = Math.max(0, Math.min(1, ((subX - (centerX - halfBadge)) + (subY - (centerY - halfBadge))) / (halfBadge * 4)));
            r = Math.round(5 * (1 - tGrad) + 6 * tGrad);
            g = Math.round(150 * (1 - tGrad) + 95 * tGrad);
            b = Math.round(105 * (1 - tGrad) + 70 * tGrad);

            // Border (12px)
            if (dBadge >= -14) {
              const borderFactor = Math.min(1, Math.max(0, (dBadge + 14) / 14));
              r = Math.round(r * (1 - borderFactor * 0.8) + 52 * borderFactor * 0.8);
              g = Math.round(g * (1 - borderFactor * 0.8) + 211 * borderFactor * 0.8);
              b = Math.round(b * (1 - borderFactor * 0.8) + 153 * borderFactor * 0.8);
            }

            // Letters Q and K
            const dQ = sdLetterQ(subX, subY, qCenterX, qCenterY, qRx, qRy, letterStroke);
            const dK = sdLetterK(subX, subY, kCenterX, kCenterY, kStemH, kArmLen, letterStroke);
            const dLetter = Math.min(dQ, dK);

            const dShadow = Math.min(
              sdLetterQ(subX - 6, subY - 6, qCenterX, qCenterY, qRx, qRy, letterStroke),
              sdLetterK(subX - 6, subY - 6, kCenterX, kCenterY, kStemH, kArmLen, letterStroke)
            );
            if (dShadow < 0 && dLetter >= 0) {
              r = Math.round(r * 0.7);
              g = Math.round(g * 0.7);
              b = Math.round(b * 0.7);
            }

            if (dLetter < 0) {
              r = 255; g = 255; b = 255;
            } else if (dLetter < 2) {
              const a = 1 - dLetter / 2;
              r = Math.round(r * (1 - a) + 255 * a);
              g = Math.round(g * (1 - a) + 255 * a);
              b = Math.round(b * (1 - a) + 255 * a);
            }

            // Amber spark in badge
            const sparkDist = Math.sqrt((subX - (centerX + 240)) ** 2 + (subY - (centerY + 240)) ** 2) - 22;
            if (sparkDist < 0) {
              r = 251; g = 191; b = 36;
            } else if (sparkDist < 2) {
              const sa = 1 - sparkDist / 2;
              r = Math.round(r * (1 - sa) + 251 * sa);
              g = Math.round(g * (1 - sa) + 191 * sa);
              b = Math.round(b * (1 - sa) + 36 * sa);
            }
          } else if (dBadge < 3) {
            // Anti-aliased outer badge border blend
            const a = 1 - dBadge / 3;
            r = Math.round(r * (1 - a) + 52 * a);
            g = Math.round(g * (1 - a) + 211 * a);
            b = Math.round(b * (1 - a) + 153 * a);
          }

          rAcc += r; gAcc += g; bAcc += b;
        }
      }

      png.data[idx] = Math.round(rAcc / 4);
      png.data[idx + 1] = Math.round(gAcc / 4);
      png.data[idx + 2] = Math.round(bAcc / 4);
      png.data[idx + 3] = 255;
    }
  }

  const outPath = path.join(assetsDir, 'icon.png');
  fs.writeFileSync(outPath, PNG.sync.write(png));
  console.log('Saved:', outPath);
}

// Generate Splash screen (1024 x 1024)
function generateSplash() {
  const width = 1024;
  const height = 1024;
  const png = new PNG({ width, height });

  const centerX = 512;
  const centerY = 512;
  const badgeRadius = 80;
  const halfBadge = 180;

  const qCenterX = centerX - 80;
  const qCenterY = centerY;
  const qRx = 70;
  const qRy = 90;
  const letterStroke = 30;

  const kCenterX = centerX + 80;
  const kCenterY = centerY;
  const kStemH = 90;
  const kArmLen = 140;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;

      // Pure deep emerald #064e3b
      let r = 6, g = 78, b = 59;

      const dBadge = sdRoundBox(x - centerX, y - centerY, halfBadge, halfBadge, badgeRadius);
      if (dBadge <= 0) {
        const tGrad = Math.max(0, Math.min(1, ((x - (centerX - halfBadge)) + (y - (centerY - halfBadge))) / (halfBadge * 4)));
        r = Math.round(5 * (1 - tGrad) + 6 * tGrad);
        g = Math.round(150 * (1 - tGrad) + 95 * tGrad);
        b = Math.round(105 * (1 - tGrad) + 70 * tGrad);

        if (dBadge >= -8) {
          r = 52; g = 211; b = 153;
        }

        const dQ = sdLetterQ(x, y, qCenterX, qCenterY, qRx, qRy, letterStroke);
        const dK = sdLetterK(x, y, kCenterX, kCenterY, kStemH, kArmLen, letterStroke);
        if (Math.min(dQ, dK) <= 0) {
          r = 255; g = 255; b = 255;
        }
      }

      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = 255;
    }
  }

  const outPath = path.join(assetsDir, 'splash.png');
  fs.writeFileSync(outPath, PNG.sync.write(png));
  console.log('Saved:', outPath);
}

// Generate Favicon
function generateFavicon() {
  const width = 48;
  const height = 48;
  const png = new PNG({ width, height });

  const centerX = 24;
  const centerY = 24;
  const badgeRadius = 6;
  const halfBadge = 22;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      const dBadge = sdRoundBox(x - centerX, y - centerY, halfBadge, halfBadge, badgeRadius);
      if (dBadge <= 0) {
        let r = 5, g = 150, b = 105;
        if (dBadge >= -2) {
          r = 52; g = 211; b = 153;
        }
        // Minimal letter Q and K
        const qDist = Math.abs(Math.sqrt((x - 16) ** 2 + (y - 24) ** 2) - 6);
        const kStem = (x === 30 && y >= 17 && y <= 31);
        const kArm1 = (Math.abs((x - 30) - (24 - y)) <= 1 && x >= 30 && y <= 24);
        const kArm2 = (Math.abs((x - 30) - (y - 24)) <= 1 && x >= 30 && y >= 24);
        if (qDist <= 1.5 || kStem || kArm1 || kArm2) {
          r = 255; g = 255; b = 255;
        }
        png.data[idx] = r;
        png.data[idx + 1] = g;
        png.data[idx + 2] = b;
        png.data[idx + 3] = 255;
      } else {
        png.data[idx] = 0;
        png.data[idx + 1] = 0;
        png.data[idx + 2] = 0;
        png.data[idx + 3] = 0;
      }
    }
  }

  const outPath = path.join(assetsDir, 'favicon.png');
  fs.writeFileSync(outPath, PNG.sync.write(png));
  console.log('Saved:', outPath);
}

console.log('Generating Quick Karya brand icon assets...');
generateAdaptiveForeground();
generateAppIcon();
generateSplash();
generateFavicon();
console.log('Icon assets generation complete.');
