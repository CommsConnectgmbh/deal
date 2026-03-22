/**
 * debug-frame.ts — Diagnostic script for gold frame structure analysis
 *
 * Loads gold.png, runs the same BFS analysis as composite-v2.ts,
 * and prints detailed metrics about interior, border, and exterior regions.
 * Saves a debug visualization PNG with color-coded regions.
 */

import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

const FRAME_PATH = path.resolve(__dirname, '../../../Kartengenerator/gold.png');
const OUTPUT_PATH = path.resolve(__dirname, 'debug-frame-output.png');
const CANVAS_SIZE = 1024;
const ALPHA_THRESH = 30;
const BRIGHTNESS_THRESH = 60;

function brightness(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

async function main() {
  console.log('=== Gold Frame Diagnostic ===\n');

  // ── Load and get original metadata ──
  const rawFrame = fs.readFileSync(FRAME_PATH);
  const meta = await sharp(rawFrame).metadata();
  const origW = meta.width!;
  const origH = meta.height!;
  console.log(`Original frame size: ${origW} x ${origH}`);
  console.log(`File size: ${fs.statSync(FRAME_PATH).size} bytes`);
  console.log(`Format: ${meta.format}, channels: ${meta.channels}, hasAlpha: ${meta.hasAlpha}\n`);

  // ── Scale to fit canvas (same logic as composite-v2) ──
  const scale = Math.min(
    (CANVAS_SIZE * 0.96) / origW,
    (CANVAS_SIZE * 0.96) / origH
  );
  const sw = Math.round(origW * scale);
  const sh = Math.round(origH * scale);
  const ox = Math.round((CANVAS_SIZE - sw) / 2);
  const oy = Math.round((CANVAS_SIZE - sh) / 2);

  console.log(`Scale factor: ${scale.toFixed(4)}`);
  console.log(`Scaled frame size: ${sw} x ${sh}`);
  console.log(`Offset in canvas: (${ox}, ${oy})\n`);

  const scaledRGBA = await sharp(rawFrame)
    .resize(sw, sh, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer();

  // ── BFS exterior from edges (transparent pixels) ──
  const exterior = new Uint8Array(sw * sh);
  const extQ: number[] = [];

  // Seed from top/bottom edges
  for (let x = 0; x < sw; x++) {
    for (const idx of [x, (sh - 1) * sw + x]) {
      if (scaledRGBA[idx * 4 + 3] < ALPHA_THRESH && !exterior[idx]) {
        exterior[idx] = 1;
        extQ.push(idx);
      }
    }
  }
  // Seed from left/right edges
  for (let y = 0; y < sh; y++) {
    for (const idx of [y * sw, y * sw + sw - 1]) {
      if (scaledRGBA[idx * 4 + 3] < ALPHA_THRESH && !exterior[idx]) {
        exterior[idx] = 1;
        extQ.push(idx);
      }
    }
  }

  let head = 0;
  while (head < extQ.length) {
    const idx = extQ[head++];
    const x = idx % sw;
    const y = (idx - x) / sw;
    for (const n of [
      y > 0 ? idx - sw : -1,
      y < sh - 1 ? idx + sw : -1,
      x > 0 ? idx - 1 : -1,
      x < sw - 1 ? idx + 1 : -1,
    ]) {
      if (n >= 0 && !exterior[n] && scaledRGBA[n * 4 + 3] < ALPHA_THRESH) {
        exterior[n] = 1;
        extQ.push(n);
      }
    }
  }

  console.log(`Exterior pixels (BFS from edges): ${extQ.length}`);

  // ── BFS interior from center (dark pixels, not exterior) ──
  const interior = new Uint8Array(sw * sh);
  const intQ: number[] = [];
  const cx = Math.round(sw / 2);
  const cy = Math.round(sh / 2);

  function isDark(idx: number): boolean {
    const a = scaledRGBA[idx * 4 + 3];
    if (a < ALPHA_THRESH) return true;
    return brightness(
      scaledRGBA[idx * 4],
      scaledRGBA[idx * 4 + 1],
      scaledRGBA[idx * 4 + 2]
    ) < BRIGHTNESS_THRESH;
  }

  // Find seed from center
  const ci = cy * sw + cx;
  if (!exterior[ci] && isDark(ci)) {
    interior[ci] = 1;
    intQ.push(ci);
    console.log(`\nInterior seed: center pixel (${cx}, ${cy}) — isDark=true`);
  } else {
    console.log(`\nCenter pixel (${cx}, ${cy}): exterior=${exterior[ci]}, isDark=${isDark(ci)}`);
    const centerAlpha = scaledRGBA[ci * 4 + 3];
    const centerBright = brightness(
      scaledRGBA[ci * 4],
      scaledRGBA[ci * 4 + 1],
      scaledRGBA[ci * 4 + 2]
    );
    console.log(`  RGBA: (${scaledRGBA[ci * 4]}, ${scaledRGBA[ci * 4 + 1]}, ${scaledRGBA[ci * 4 + 2]}, ${centerAlpha}), brightness=${centerBright.toFixed(1)}`);

    let seedFound = false;
    for (let d = 0; d <= 80; d += 3) {
      for (let dy = -d; dy <= d && !seedFound; dy += 3) {
        for (let dx = -d; dx <= d && !seedFound; dx += 3) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= sw || ny < 0 || ny >= sh) continue;
          const ni = ny * sw + nx;
          if (!exterior[ni] && isDark(ni)) {
            interior[ni] = 1;
            intQ.push(ni);
            seedFound = true;
            console.log(`  Interior seed found at offset (${dx}, ${dy}) -> pixel (${nx}, ${ny})`);
          }
        }
      }
      if (seedFound) break;
    }
    if (!seedFound) {
      console.log('  WARNING: No interior seed found within 80px of center!');
    }
  }

  head = 0;
  while (head < intQ.length) {
    const idx = intQ[head++];
    const x = idx % sw;
    const y = (idx - x) / sw;
    for (const n of [
      y > 0 ? idx - sw : -1,
      y < sh - 1 ? idx + sw : -1,
      x > 0 ? idx - 1 : -1,
      x < sw - 1 ? idx + 1 : -1,
    ]) {
      if (n >= 0 && !exterior[n] && !interior[n] && isDark(n)) {
        interior[n] = 1;
        intQ.push(n);
      }
    }
  }

  // ── Compute counts ──
  const totalPixels = sw * sh;
  let extCount = 0;
  let intCount = 0;
  let borderCount = 0;
  for (let i = 0; i < totalPixels; i++) {
    if (exterior[i]) extCount++;
    else if (interior[i]) intCount++;
    else borderCount++;
  }

  console.log(`\n=== Region Counts ===`);
  console.log(`  Exterior: ${extCount} pixels (${(extCount / totalPixels * 100).toFixed(1)}%)`);
  console.log(`  Interior: ${intCount} pixels (${(intCount / totalPixels * 100).toFixed(1)}%)`);
  console.log(`  Border (frame): ${borderCount} pixels (${(borderCount / totalPixels * 100).toFixed(1)}%)`);
  console.log(`  Total: ${totalPixels} pixels`);

  // ── Interior bounding box ──
  let minX = sw, maxX = 0, minY = sh, maxY = 0;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      if (interior[y * sw + x]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const intW = maxX - minX + 1;
  const intH = maxY - minY + 1;

  console.log(`\n=== Interior Bounding Box ===`);
  console.log(`  Pixels: minX=${minX}, maxX=${maxX}, minY=${minY}, maxY=${maxY}`);
  console.log(`  Size: ${intW} x ${intH}`);
  console.log(`  As % of scaled frame:`);
  console.log(`    Left edge:   ${(minX / sw * 100).toFixed(1)}%`);
  console.log(`    Right edge:  ${(maxX / sw * 100).toFixed(1)}%`);
  console.log(`    Top edge:    ${(minY / sh * 100).toFixed(1)}%`);
  console.log(`    Bottom edge: ${(maxY / sh * 100).toFixed(1)}%`);
  console.log(`    Width:       ${(intW / sw * 100).toFixed(1)}%`);
  console.log(`    Height:      ${(intH / sh * 100).toFixed(1)}%`);

  // ── Canvas-space coordinates ──
  console.log(`\n=== Interior in Canvas Space (${CANVAS_SIZE}x${CANVAS_SIZE}) ===`);
  console.log(`  minX=${minX + ox}, maxX=${maxX + ox}, minY=${minY + oy}, maxY=${maxY + oy}`);
  console.log(`  As % of canvas:`);
  console.log(`    Left:   ${((minX + ox) / CANVAS_SIZE * 100).toFixed(1)}%`);
  console.log(`    Right:  ${((maxX + ox) / CANVAS_SIZE * 100).toFixed(1)}%`);
  console.log(`    Top:    ${((minY + oy) / CANVAS_SIZE * 100).toFixed(1)}%`);
  console.log(`    Bottom: ${((maxY + oy) / CANVAS_SIZE * 100).toFixed(1)}%`);

  // ── Arch/top decoration analysis ──
  // Scan down from top center until we hit interior
  console.log(`\n=== Top Arch / Decoration Analysis ===`);
  const topCenterX = Math.round(sw / 2);
  let archEndY = -1;
  for (let y = 0; y < sh; y++) {
    if (interior[y * sw + topCenterX]) {
      archEndY = y;
      break;
    }
  }
  if (archEndY >= 0) {
    console.log(`  Top center column (x=${topCenterX}):`);
    console.log(`    First interior pixel at y=${archEndY}`);
    console.log(`    Arch/bar occupies top ${archEndY} pixels (${(archEndY / sh * 100).toFixed(1)}% of frame height)`);
    console.log(`    In canvas space: y=${archEndY + oy} (${((archEndY + oy) / CANVAS_SIZE * 100).toFixed(1)}% from top)`);
  } else {
    console.log(`  WARNING: No interior pixel found scanning down center column!`);
  }

  // Also scan at multiple x positions to find the arch profile
  console.log(`\n  Arch profile (first interior y at various x positions):`);
  const sampleXs = [
    Math.round(sw * 0.15),
    Math.round(sw * 0.25),
    Math.round(sw * 0.35),
    Math.round(sw * 0.45),
    Math.round(sw * 0.50),
    Math.round(sw * 0.55),
    Math.round(sw * 0.65),
    Math.round(sw * 0.75),
    Math.round(sw * 0.85),
  ];

  for (const sx of sampleXs) {
    let firstIntY = -1;
    for (let y = 0; y < sh; y++) {
      if (interior[y * sw + sx]) {
        firstIntY = y;
        break;
      }
    }
    const pct = (sx / sw * 100).toFixed(0);
    if (firstIntY >= 0) {
      console.log(`    x=${sx} (${pct}%): first interior y=${firstIntY} (${(firstIntY / sh * 100).toFixed(1)}%)`);
    } else {
      console.log(`    x=${sx} (${pct}%): NO interior found (column fully in border/exterior)`);
    }
  }

  // ── Bottom edge analysis ──
  console.log(`\n=== Bottom Edge Analysis ===`);
  let bottomEndY = -1;
  for (let y = sh - 1; y >= 0; y--) {
    if (interior[y * sw + topCenterX]) {
      bottomEndY = y;
      break;
    }
  }
  if (bottomEndY >= 0) {
    const bottomBorder = sh - 1 - bottomEndY;
    console.log(`  Last interior pixel at y=${bottomEndY}`);
    console.log(`  Bottom border: ${bottomBorder} pixels (${(bottomBorder / sh * 100).toFixed(1)}% of frame height)`);
  }

  // ── Left/right border widths ──
  console.log(`\n=== Left/Right Border Widths ===`);
  const midY = Math.round(sh / 2);
  let leftBorder = -1, rightBorder = -1;
  for (let x = 0; x < sw; x++) {
    if (interior[midY * sw + x]) { leftBorder = x; break; }
  }
  for (let x = sw - 1; x >= 0; x--) {
    if (interior[midY * sw + x]) { rightBorder = sw - 1 - x; break; }
  }
  if (leftBorder >= 0) console.log(`  Left border at midpoint: ${leftBorder}px (${(leftBorder / sw * 100).toFixed(1)}%)`);
  if (rightBorder >= 0) console.log(`  Right border at midpoint: ${rightBorder}px (${(rightBorder / sw * 100).toFixed(1)}%)`);

  // ── Sample pixel values along a vertical stripe through center ──
  console.log(`\n=== Pixel samples along center column (x=${topCenterX}) ===`);
  const sampleYs = [0, 10, 20, 30, 50, 80, 100, 120, 150, 180, 200, 250, 300, 400, 500, 600, 700, 800, 900, sh - 1];
  for (const sy of sampleYs) {
    if (sy >= sh) continue;
    const idx = sy * sw + topCenterX;
    const r = scaledRGBA[idx * 4];
    const g = scaledRGBA[idx * 4 + 1];
    const b = scaledRGBA[idx * 4 + 2];
    const a = scaledRGBA[idx * 4 + 3];
    const br = brightness(r, g, b);
    const region = exterior[idx] ? 'EXT' : interior[idx] ? 'INT' : 'BRD';
    console.log(`  y=${String(sy).padStart(4)}: rgba(${String(r).padStart(3)},${String(g).padStart(3)},${String(b).padStart(3)},${String(a).padStart(3)}) bright=${br.toFixed(0).padStart(3)} [${region}]`);
  }

  // ── Generate debug visualization ──
  console.log(`\n=== Generating debug visualization ===`);
  const vizBuffer = Buffer.alloc(sw * sh * 4);
  for (let i = 0; i < totalPixels; i++) {
    const pi = i * 4;
    if (exterior[i]) {
      // RED = exterior
      vizBuffer[pi] = 200;
      vizBuffer[pi + 1] = 40;
      vizBuffer[pi + 2] = 40;
      vizBuffer[pi + 3] = 255;
    } else if (interior[i]) {
      // GREEN = interior
      vizBuffer[pi] = 40;
      vizBuffer[pi + 1] = 200;
      vizBuffer[pi + 2] = 40;
      vizBuffer[pi + 3] = 255;
    } else {
      // BLUE = frame border
      vizBuffer[pi] = 40;
      vizBuffer[pi + 1] = 40;
      vizBuffer[pi + 2] = 200;
      vizBuffer[pi + 3] = 255;
    }
  }

  // Mark interior bounding box corners with white crosses
  const markSize = 8;
  function markCross(px: number, py: number) {
    for (let d = -markSize; d <= markSize; d++) {
      for (const [mx, my] of [[px + d, py], [px, py + d]]) {
        if (mx >= 0 && mx < sw && my >= 0 && my < sh) {
          const mi = (my * sw + mx) * 4;
          vizBuffer[mi] = 255;
          vizBuffer[mi + 1] = 255;
          vizBuffer[mi + 2] = 255;
          vizBuffer[mi + 3] = 255;
        }
      }
    }
  }
  markCross(minX, minY);
  markCross(maxX, minY);
  markCross(minX, maxY);
  markCross(maxX, maxY);

  // Mark center with yellow cross
  for (let d = -markSize; d <= markSize; d++) {
    for (const [mx, my] of [[cx + d, cy], [cx, cy + d]]) {
      if (mx >= 0 && mx < sw && my >= 0 && my < sh) {
        const mi = (my * sw + mx) * 4;
        vizBuffer[mi] = 255;
        vizBuffer[mi + 1] = 255;
        vizBuffer[mi + 2] = 0;
        vizBuffer[mi + 3] = 255;
      }
    }
  }

  // Mark arch end line with cyan horizontal line
  if (archEndY >= 0) {
    for (let x = minX; x <= maxX; x++) {
      const mi = (archEndY * sw + x) * 4;
      vizBuffer[mi] = 0;
      vizBuffer[mi + 1] = 255;
      vizBuffer[mi + 2] = 255;
      vizBuffer[mi + 3] = 255;
    }
  }

  await sharp(vizBuffer, { raw: { width: sw, height: sh, channels: 4 } })
    .png()
    .toFile(OUTPUT_PATH);

  console.log(`  Saved to: ${OUTPUT_PATH}`);
  console.log(`  Legend: RED=exterior, GREEN=interior, BLUE=border`);
  console.log(`  White crosses = interior bounding box corners`);
  console.log(`  Yellow cross = center of frame`);
  console.log(`  Cyan line = arch end (first interior row at center column)`);
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
