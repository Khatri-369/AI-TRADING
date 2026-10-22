import { chromium } from '@playwright/test';
import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const USER_SOURCE_PATH = 'C:/Users/KHATRI OM KUMAR/.gemini/antigravity-ide/brain/d79e0105-fc3a-499d-b7ef-1a005bfbecda/.user_uploaded/media_1792694193607.jpg';
const REPO_MASTER_PATH = 'public/icons/tradexa-logo.png';

async function build() {
  console.log('🚀 Generating Tradexa high-resolution brand assets from official logo...');
  await mkdir('public/icons', { recursive: true });

  // 1. Ensure master high-res source exists in public/icons
  let sourceBuffer;
  if (existsSync(USER_SOURCE_PATH)) {
    sourceBuffer = await readFile(USER_SOURCE_PATH);
    await writeFile(REPO_MASTER_PATH, sourceBuffer);
    console.log(`✔ Copied official logo to ${REPO_MASTER_PATH}`);
  } else if (existsSync(REPO_MASTER_PATH)) {
    sourceBuffer = await readFile(REPO_MASTER_PATH);
  } else {
    throw new Error('No source logo image found!');
  }

  const base64Data = 'data:image/jpeg;base64,' + sourceBuffer.toString('base64');

  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage();

  const distinctSizes = [
    { size: 512, file: 'public/icons/tradexa-512.png' },
    { size: 256, file: 'public/icons/tradexa-256.png' },
    { size: 192, file: 'public/icons/tradexa-192.png' },
    { size: 180, file: 'public/icons/apple-touch-icon.png' },
    { size: 64,  file: 'public/icons/tradexa-64.png' },
    { size: 32,  file: 'public/icons/tradexa-32.png' },
    { size: 16,  file: 'public/icons/tradexa-16.png' },
  ];

  for (const t of distinctSizes) {
    const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:${t.size}px; height:${t.size}px; overflow:hidden; background:transparent; }
    img { width:${t.size}px; height:${t.size}px; display:block; object-fit:contain; }
  </style>
</head>
<body>
  <img src="${base64Data}" />
</body>
</html>`;
    await page.setViewportSize({ width: t.size, height: t.size });
    await page.setContent(html);
    await page.screenshot({ path: t.file, omitBackground: true });
    console.log(`✔ Rendered ${t.file} (${t.size}x${t.size})`);
  }

  // Generate Maskable 512 with safe padding (Android adaptive icons safe circle is 80% diameter)
  const maskableHtml = `<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:512px; height:512px; overflow:hidden; background:#040812; display:flex; align-items:center; justify-content:center; }
    img { width:430px; height:430px; display:block; object-fit:contain; }
  </style>
</head>
<body>
  <img src="${base64Data}" />
</body>
</html>`;
  await page.setViewportSize({ width: 512, height: 512 });
  await page.setContent(maskableHtml);
  await page.screenshot({ path: 'public/icons/tradexa-maskable-512.png' });
  console.log('✔ Rendered public/icons/tradexa-maskable-512.png (512x512 maskable)');

  // Clones / Aliases
  await copyFile('public/icons/tradexa-512.png', 'public/icons/tradexa-master.png');
  await copyFile('public/icons/tradexa-512.png', 'public/icons/markets-512.png');
  await copyFile('public/icons/tradexa-192.png', 'public/icons/markets-192.png');
  await copyFile('public/icons/tradexa-32.png', 'public/favicon.ico');
  console.log('✔ Generated aliases & public/favicon.ico');

  // Also create preview demo in public/test-logos/
  await mkdir('public/test-logos', { recursive: true });
  const previewHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Tradexa Brand Logo Assets Preview</title>
  <style>
    body { background: #070B14; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; display: flex; flex-direction: column; align-items: center; gap: 32px; }
    h1 { font-size: 26px; font-weight: 700; color: #38bdf8; margin: 0; }
    .grid { display: flex; flex-wrap: wrap; gap: 24px; justify-content: center; max-width: 1000px; }
    .card { background: #0B1322; border: 1px solid #1E293B; border-radius: 16px; padding: 20px; display: flex; flex-direction: column; align-items: center; gap: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.5); }
    .card-title { font-size: 13px; font-weight: 600; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; }
    .preview-box { display: flex; align-items: center; justify-content: center; background: radial-gradient(circle, #0F1D33 0%, #060A13 100%); border-radius: 12px; padding: 12px; }
    .badge { font-size: 11px; padding: 4px 8px; border-radius: 6px; background: rgba(56, 189, 248, 0.15); color: #38BDF8; font-family: monospace; }
  </style>
</head>
<body>
  <h1>Tradexa New App Logo Asset Suite</h1>
  <div class="grid">
    <div class="card">
      <div class="card-title">Master 512x512</div>
      <div class="preview-box"><img src="../icons/tradexa-512.png" width="160" height="160" /></div>
      <span class="badge">tradexa-512.png</span>
    </div>
    <div class="card">
      <div class="card-title">Maskable 512x512 (Android PWA)</div>
      <div class="preview-box"><img src="../icons/tradexa-maskable-512.png" width="160" height="160" style="border-radius: 50%;" /></div>
      <span class="badge">Adaptive Circular Safe</span>
    </div>
    <div class="card">
      <div class="card-title">Standard 192x192</div>
      <div class="preview-box"><img src="../icons/tradexa-192.png" width="96" height="96" /></div>
      <span class="badge">tradexa-192.png</span>
    </div>
    <div class="card">
      <div class="card-title">Apple Touch 180x180 (iOS)</div>
      <div class="preview-box"><img src="../icons/apple-touch-icon.png" width="90" height="90" /></div>
      <span class="badge">apple-touch-icon.png</span>
    </div>
    <div class="card">
      <div class="card-title">Nav Header & Favicon (32x32 / 16x16)</div>
      <div class="preview-box" style="gap: 16px;">
        <img src="../icons/tradexa-64.png" width="48" height="48" />
        <img src="../icons/tradexa-32.png" width="32" height="32" />
        <img src="../icons/tradexa-16.png" width="16" height="16" />
      </div>
      <span class="badge">favicon.ico / header</span>
    </div>
  </div>
</body>
</html>`;

  await writeFile('public/test-logos/brand-preview.html', previewHtml, 'utf8');
  await page.setViewportSize({ width: 1040, height: 600 });
  await page.goto('file:///' + path.resolve('public/test-logos/brand-preview.html').replace(/\\/g, '/'));
  await page.screenshot({ path: 'public/test-logos/brand-preview.png', fullPage: true });
  console.log('✔ Saved brand preview screenshot: public/test-logos/brand-preview.png');

  await browser.close();
  console.log('🎉 All Tradexa branding assets successfully generated from official logo!');
}

build().catch(err => {
  console.error('Build error:', err);
  process.exit(1);
});
