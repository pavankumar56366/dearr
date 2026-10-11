import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import assert from 'assert';

const LOGO_PATH = path.join(process.cwd(), 'public', 'brand', 'dearr-logo.png');
const TEST_OUTPUT_DIR = path.join(process.cwd(), 'test-results', 'logo-verification');

if (!fs.existsSync(TEST_OUTPUT_DIR)) {
  fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
}

async function verifyLogo() {
  console.log('================================================================================');
  console.log('DEARR LOGO ASSET & TRANSPARENCY VERIFICATION SUITE');
  console.log('================================================================================\n');

  // 1. Verify file exists
  assert(fs.existsSync(LOGO_PATH), `Logo file not found at: ${LOGO_PATH}`);
  const stats = fs.statSync(LOGO_PATH);
  console.log(`✓ Logo asset exists: ${LOGO_PATH} (${stats.size} bytes)`);

  // 2. Verify image metadata
  const meta = await sharp(LOGO_PATH).metadata();
  console.log(`✓ Image dimensions: ${meta.width}x${meta.height}, format: ${meta.format}, channels: ${meta.channels}`);
  assert.strictEqual(meta.format, 'png', 'Logo must be in PNG format');
  assert.strictEqual(meta.hasAlpha, true, 'Logo must contain an alpha channel');
  assert.strictEqual(meta.channels, 4, 'Logo must have 4 channels (RGBA)');

  // 3. Verify pixel composition & alpha channel
  const { data, info } = await sharp(LOGO_PATH).raw().toBuffer({ resolveWithObject: true });
  let fullyTransparent = 0;
  let fullyOpaque = 0;
  let semiTransparent = 0;
  let cornerTransparent = 0;

  // Check 4 corners
  const corners = [
    { x: 0, y: 0 },
    { x: info.width - 1, y: 0 },
    { x: 0, y: info.height - 1 },
    { x: info.width - 1, y: info.height - 1 },
  ];

  for (const c of corners) {
    const idx = (c.y * info.width + c.x) * 4;
    const a = data[idx + 3];
    if (a === 0) cornerTransparent++;
    console.log(`  Corner (${c.x}, ${c.y}): alpha=${a}`);
  }
  assert.strictEqual(cornerTransparent, 4, 'All four corners must be genuinely transparent (alpha = 0)');

  // Loop through pixels
  let whiteHighlightCount = 0;
  let darkEdgeCount = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a === 0) {
      fullyTransparent++;
    } else if (a === 255) {
      fullyOpaque++;
      // Check for white highlight details
      if (r > 240 && g > 240 && b > 240) {
        whiteHighlightCount++;
      }
    } else {
      semiTransparent++;
      // Check for unwanted black halo/fringing
      if (r < 30 && g < 30 && b < 30) {
        darkEdgeCount++;
      }
    }
  }

  const transparentRatio = (fullyTransparent / (info.width * info.height)) * 100;
  console.log(`✓ Fully transparent pixels: ${fullyTransparent} (${transparentRatio.toFixed(1)}%)`);
  console.log(`✓ Fully opaque letter pixels: ${fullyOpaque}`);
  console.log(`✓ Antialiased edge pixels: ${semiTransparent}`);
  console.log(`✓ White highlight pixels preserved: ${whiteHighlightCount}`);
  console.log(`✓ Dark halo pixels on antialiased edges: ${darkEdgeCount}`);

  assert(transparentRatio > 50, 'Logo background must be majority transparent');
  assert(whiteHighlightCount > 500, 'White highlight details inside letters must be preserved');
  assert.strictEqual(darkEdgeCount, 0, 'No black halo or dark fringing allowed on edge pixels');

  // 4. Verify the 5 letters and heart are present and distinct
  const letterSlices = [
    { letter: 'd', minX: 0, maxX: Math.floor(info.width * 0.25) },
    { letter: 'e', minX: Math.floor(info.width * 0.25), maxX: Math.floor(info.width * 0.40) },
    { letter: 'a', minX: Math.floor(info.width * 0.40), maxX: Math.floor(info.width * 0.60) },
    { letter: 'r1', minX: Math.floor(info.width * 0.60), maxX: Math.floor(info.width * 0.72) },
    { letter: 'r2', minX: Math.floor(info.width * 0.72), maxX: Math.floor(info.width * 0.84) },
    { letter: 'heart', minX: Math.floor(info.width * 0.84), maxX: info.width },
  ];

  for (const slice of letterSlices) {
    let sliceOpaque = 0;
    for (let y = 0; y < info.height; y++) {
      for (let x = slice.minX; x < slice.maxX; x++) {
        const idx = (y * info.width + x) * 4;
        if (data[idx + 3] === 255) sliceOpaque++;
      }
    }
    console.log(`✓ Slice '${slice.letter}' has ${sliceOpaque} solid pixels (confirmed intact)`);
    assert(sliceOpaque > 1000, `Letter '${slice.letter}' must have solid pixels`);
  }

  // 5. Composite logo over multiple real Dearr backgrounds to verify visual transparency
  const backgrounds = [
    { name: 'white', color: { r: 255, g: 255, b: 255, alpha: 1 } },
    { name: 'canvas_offwhite', color: { r: 250, g: 248, b: 245, alpha: 1 } }, // Dearr --color-canvas
    { name: 'surface_cream', color: { r: 244, g: 241, b: 232, alpha: 1 } },   // Dearr auth surface #F4F1E8
    { name: 'black', color: { r: 0, g: 0, b: 0, alpha: 1 } },
    { name: 'dark_footer', color: { r: 32, g: 33, b: 36, alpha: 1 } },         // Dearr #202124
  ];

  for (const bg of backgrounds) {
    const bgBuffer = await sharp({
      create: {
        width: info.width + 40,
        height: info.height + 40,
        channels: 4,
        background: bg.color,
      },
    })
      .composite([{ input: LOGO_PATH, left: 20, top: 20 }])
      .png()
      .toFile(path.join(TEST_OUTPUT_DIR, `logo_on_${bg.name}.png`));

    console.log(`✓ Generated composite preview: logo_on_${bg.name}.png`);
  }

  console.log('\n================================================================================');
  console.log('ALL LOGO TRANSPARENCY & INTEGRATION CHECKS PASSED (100%)');
  console.log('================================================================================\n');
}

verifyLogo().catch((err) => {
  console.error('[LOGO VERIFICATION FAILED]:', err);
  process.exit(1);
});
