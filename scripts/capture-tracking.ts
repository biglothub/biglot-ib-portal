/**
 * Capture Tradezella /tracking page comprehensively
 * Usage: npx tsx scripts/capture-tracking.ts
 */

import { chromium, type Page, type Request, type Response } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const AUTH = {
  'access-token': 'q9iwcDs3I1vHMQWQP6GRxA',
  'token-type': 'Bearer',
  'client': '8XqbRwYtPpECv3pWasIjog',
  'uid': '100572037245702657965',
};

const BASE = 'https://app.tradezella.com';
const OUT = path.join(process.cwd(), 'scripts/tradezella-responses/tracking');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.join(OUT, 'screenshots'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'api'), { recursive: true });

const captured: Record<string, unknown> = {};
const apiCalls: Array<{ url: string; method: string; status: number; body: unknown; requestBody?: unknown }> = [];

async function shot(page: Page, name: string) {
  const p = path.join(OUT, 'screenshots', `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  console.log(`  📸 ${name}.png`);
}

async function shotFull(page: Page, name: string) {
  const p = path.join(OUT, 'screenshots', `${name}_full.png`);
  await page.screenshot({ path: p, fullPage: true });
  console.log(`  📸 ${name}_full.png (full page)`);
}

async function extractSection(page: Page, selector: string, name: string) {
  try {
    const el = page.locator(selector).first();
    const count = await el.count();
    if (count > 0) {
      const box = await el.boundingBox();
      if (box) {
        await el.screenshot({ path: path.join(OUT, 'screenshots', `section_${name}.png`) });
        console.log(`  📸 section_${name}.png`);
      }
      const text = await el.innerText().catch(() => '');
      captured[name] = { selector, text: text.slice(0, 2000) };
    }
  } catch {
    console.log(`  ⚠️  Could not capture section: ${name}`);
  }
}

async function extractDOM(page: Page): Promise<string> {
  return page.evaluate(`(function() {
    var extract = function(el, depth) {
      var tag = el.tagName.toLowerCase();
      var cls = (el.className && typeof el.className === 'string') ? el.className.slice(0, 100) : '';
      var text = el.innerText ? el.innerText.slice(0, 200).trim() : '';
      var children = depth < 6
        ? Array.from(el.children).slice(0, 20).map(function(c) { return extract(c, depth + 1); })
        : [];
      return { tag: tag, cls: cls, text: text, children: children };
    };
    var main = document.querySelector('main') || document.body;
    return JSON.stringify(extract(main, 0), null, 2);
  })()`);
}

async function getScrollContainer(page: Page): Promise<string> {
  return page.evaluate(`(function() {
    var candidates = document.querySelectorAll('*');
    var best = null;
    var bestHeight = 0;
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      var style = window.getComputedStyle(el);
      var overflow = style.overflowY;
      if ((overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight + 50) {
        if (el.scrollHeight > bestHeight) {
          bestHeight = el.scrollHeight;
          best = el;
        }
      }
    }
    if (best) {
      best.setAttribute('data-scroll-target', 'true');
      return 'found:' + bestHeight;
    }
    return 'body:' + document.body.scrollHeight;
  })()`);
}

(async () => {
  console.log('🚀 Starting Tradezella /tracking capture...\n');

  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
  });
  const page = await context.newPage();

  page.on('request', (req: Request) => {
    if (req.url().includes('tradezella.com/api') || req.url().includes('api.tradezella')) {
      console.log(`  → ${req.method()} ${req.url().replace(/https?:\/\/[^/]+/, '')}`);
    }
  });

  page.on('response', async (res: Response) => {
    const url = res.url();
    if (!url.includes('tradezella.com/api') && !url.includes('api.tradezella')) return;
    try {
      const body = await res.json().catch(() => null);
      const entry = {
        url,
        method: res.request().method(),
        status: res.status(),
        body,
        requestBody: res.request().postData() ?? null,
      };
      apiCalls.push(entry);
      const filename = url
        .replace(/https?:\/\/[^/]+/, '')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .slice(0, 80) + `_${Date.now()}.json`;
      fs.writeFileSync(path.join(OUT, 'api', filename), JSON.stringify(entry, null, 2));
    } catch { /* skip */ }
  });

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.evaluate((auth) => {
    Object.entries(auth).forEach(([k, v]) => localStorage.setItem(k, v as string));
  }, AUTH);

  console.log('\n📍 Navigating to /tracking...');
  await page.goto(`${BASE}/tracking`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(6000);

  const currentUrl = page.url();
  console.log(`  Current URL: ${currentUrl}`);
  if (!currentUrl.includes('/tracking')) {
    console.log('  ❌ Redirected away — tokens expired.');
    await browser.close();
    process.exit(1);
  }

  console.log('\n📸 Taking screenshots...');
  await shot(page, '01_tracking_viewport');

  const scrollInfo = await getScrollContainer(page) as string;
  console.log(`\n📜 Scroll container: ${scrollInfo}`);
  const useBodyScroll = scrollInfo.startsWith('body');
  const totalHeight = parseInt(scrollInfo.split(':')[1] ?? '900');

  const viewHeight = 860;
  const steps = Math.ceil(totalHeight / viewHeight);
  console.log(`   Total height: ${totalHeight}px → ${steps} sections`);

  for (let i = 0; i < steps; i++) {
    const scrollY = i * viewHeight;
    if (useBodyScroll) {
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), scrollY);
    } else {
      await page.evaluate((y) => {
        const el = document.querySelector('[data-scroll-target]') as HTMLElement;
        if (el) el.scrollTop = y;
      }, scrollY);
    }
    await page.waitForTimeout(800);
    await shot(page, `02_scroll_${String(i + 1).padStart(2, '0')}_y${scrollY}`);
  }

  await page.evaluate(() => {
    window.scrollTo(0, 0);
    const el = document.querySelector('[data-scroll-target]') as HTMLElement;
    if (el) el.scrollTop = 0;
  });
  await page.waitForTimeout(500);
  await shotFull(page, '03_tracking');

  console.log('\n🔍 Extracting sections...');
  const sectionSelectors: [string, string][] = [
    ['header, [class*="header"]', 'header'],
    ['[class*="nav"], [class*="sidebar"]', 'nav'],
    ['[class*="chart"], [class*="Chart"]', 'charts'],
    ['[class*="card"], [class*="Card"]', 'cards'],
    ['[class*="table"], table', 'table'],
    ['[class*="stat"], [class*="metric"]', 'stats'],
    ['[class*="filter"], [class*="Filter"]', 'filters'],
    ['[class*="calendar"], [class*="Calendar"]', 'calendar'],
    ['[class*="goal"], [class*="Goal"]', 'goals'],
    ['[class*="progress"], [class*="Progress"]', 'progress'],
    ['[class*="habit"], [class*="Habit"]', 'habits'],
    ['[class*="rule"], [class*="Rule"]', 'rules'],
    ['[class*="streak"], [class*="Streak"]', 'streak'],
    ['[class*="score"], [class*="Score"]', 'score'],
    ['[class*="widget"], [class*="Widget"]', 'widgets'],
    ['[class*="journal"], [class*="Journal"]', 'journal'],
    ['[class*="checklist"], [class*="Checklist"]', 'checklist'],
    ['[class*="target"], [class*="Target"]', 'targets'],
  ];

  for (const [sel, name] of sectionSelectors) {
    await extractSection(page, sel, name);
  }

  console.log('\n🖱️  Looking for tabs...');
  const tabs = await page.$$('[role="tab"], [class*="tab"], [class*="Tab"]');
  console.log(`  Found ${tabs.length} tab elements`);

  const seenLabels = new Set<string>();
  for (let i = 0; i < Math.min(tabs.length, 15); i++) {
    try {
      const label = (await tabs[i].innerText().catch(() => `tab_${i}`)).trim();
      if (!label || seenLabels.has(label)) continue;
      seenLabels.add(label);
      const cleanLabel = label.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
      await tabs[i].click({ timeout: 3000 });
      await page.waitForTimeout(1500);
      await shot(page, `04_tab_${String(i).padStart(2, '0')}_${cleanLabel}`);
      await shotFull(page, `05_tab_full_${String(i).padStart(2, '0')}_${cleanLabel}`);
    } catch { /* skip */ }
  }

  console.log('\n🏗️  Extracting DOM structure...');
  await page.evaluate('window.scrollTo(0,0)');
  await page.waitForTimeout(500);
  try {
    const domJson = await extractDOM(page) as string;
    fs.writeFileSync(path.join(OUT, 'dom_structure.json'), domJson);
    console.log('  Saved dom_structure.json');
  } catch (e) {
    console.log(`  ⚠️  DOM extract failed: ${e}`);
  }

  try {
    const allText = await page.evaluate('document.body.innerText') as string;
    fs.writeFileSync(path.join(OUT, 'page_text.txt'), allText);
    console.log('  Saved page_text.txt');
  } catch (e) {
    console.log(`  ⚠️  Text extract failed: ${e}`);
  }

  try {
    const classes = await page.evaluate(`(function() {
      var all = {};
      document.querySelectorAll('*').forEach(function(el) {
        if (el.className && typeof el.className === 'string') {
          el.className.split(/\\s+/).forEach(function(c) { if (c) all[c] = true; });
        }
      });
      return Object.keys(all).sort();
    })()`) as string[];
    fs.writeFileSync(path.join(OUT, 'css_classes.txt'), classes.join('\n'));
    console.log('  Saved css_classes.txt');
  } catch (e) {
    console.log(`  ⚠️  CSS classes failed: ${e}`);
  }

  const summary = {
    capturedAt: new Date().toISOString(),
    url: currentUrl,
    pageHeight: totalHeight,
    scrollSections: steps,
    apiCallCount: apiCalls.length,
    apiEndpoints: [...new Set(apiCalls.map(c => c.url.replace(/https?:\/\/[^/]+/, '')))],
    sections: Object.keys(captured),
    screenshotCount: fs.readdirSync(path.join(OUT, 'screenshots')).length,
  };
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));

  console.log('\n✅ Done!');
  console.log(`   Screenshots : ${summary.screenshotCount}`);
  console.log(`   API calls   : ${summary.apiCallCount}`);
  console.log(`   Output: ${OUT}`);

  await page.waitForTimeout(1000);
  await browser.close();
})();
