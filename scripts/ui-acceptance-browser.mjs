import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const baseUrl = required('UI_BASE_URL');
const candidateSha = required('UI_CANDIDATE_SHA');
const runId = required('UI_RUN_ID');
const serverPid = required('UI_SERVER_PID');
const receiptDir = required('UI_RECEIPT_DIR');
const playwrightRoot = required('PLAYWRIGHT_MODULE_PATH');
const executablePath = required('CHROMIUM_EXECUTABLE');
const port = new URL(baseUrl).port;
const startedAt = new Date().toISOString();

const { chromium } = await import(pathToFileURL(path.join(playwrightRoot, 'index.mjs')).href);

const routes = [
  ['home', '/'],
  ['opportunities', '/opportunities'],
  ['opportunity', '/opportunities/f0000000-0000-4000-8000-000000000001'],
  ['network', '/network'],
  ['member', '/network/sebastian-benitez'],
  ['leaderboard', '/leaderboard'],
  ['provenance', '/leaderboard/sebastian-benitez/provenance'],
  ['projects', '/projects'],
  ['project', '/projects/sety-2026'],
  ['admin', '/admin'],
  ['finance', '/admin/finance'],
  ['settle', '/admin/finance/f0000000-0000-4000-8000-000000000001/settle'],
];
const deniedForMember = new Set(['opportunities', 'opportunity', 'admin', 'finance', 'settle']);
const invalidRoutes = [
  '/projects/nope',
  '/opportunities/00000000-0000-4000-8000-000000000000',
  '/network/nope',
  '/leaderboard/nope/provenance',
];
const widths = [375, 767, 768, 1280];
const height = 810;
const failures = [];
const cells = [];
const interactions = [];

function assert(condition, message, detail = null) {
  if (!condition) failures.push({ message, detail });
}

async function inspectPage(page, role, routeName, routePath, width, response, consoleErrors) {
  const expectedDenied = role === 'member' && deniedForMember.has(routeName);
  const result = await page.evaluate(
    ({ expectedDenied, routeName, width }) => {
      const visible = (element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          rect.width > 0 &&
          rect.height > 0
        );
      };
      const headingLevels = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
        .filter(visible)
        .map((heading) => Number(heading.tagName.slice(1)));
      const headingSkips = headingLevels.filter(
        (level, index) => index > 0 && level > headingLevels[index - 1] + 1,
      );
      const controls = [
        ...document.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex]'),
      ]
        .filter(
          (element) =>
            visible(element) &&
            !element.hasAttribute('disabled') &&
            element.getAttribute('tabindex') !== '-1',
        )
        .map((element) => {
          element.focus();
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            tag: element.tagName,
            label:
              element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 80) ?? '',
            width: rect.width,
            height: rect.height,
            focused: document.activeElement === element,
            outlineWidth: Number.parseFloat(style.outlineWidth || '0'),
            outlineStyle: style.outlineStyle,
          };
        });
      const undersized = controls.filter((control) => control.width < 44 || control.height < 44);
      const unfocused = controls.filter((control) => !control.focused);
      const withoutFocusIndicator = controls.filter(
        (control) => control.outlineStyle === 'none' || control.outlineWidth < 2,
      );
      const projectedMoneyClasses = [...document.querySelectorAll('[data-rail-kind="projection"]')]
        .flatMap((root) => [root, ...root.querySelectorAll('*')])
        .filter((element) => [...element.classList].some((token) => token.includes('money')))
        .map((element) => ({ tag: element.tagName, className: element.className }));
      const currencyLeaks = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (!/\$\s?[\d,.]+/.test(node.textContent ?? '')) continue;
        const parent = node.parentElement;
        if (parent && visible(parent) && parent.closest('data.tnum') === null) {
          currencyLeaks.push((node.textContent ?? '').trim());
        }
      }
      const main = document.querySelector('main');
      const authority = document.querySelector('[data-data-authority]');
      const activeLinks = [...document.querySelectorAll('a[aria-current="page"]')]
        .filter(visible)
        .map((link) => link.getAttribute('href'));
      const mobileNav = document.querySelector('nav[aria-label="Navegación inferior"]');
      const sidebar = document.querySelector('#firma23-sidebar');
      const mobileClearance =
        width >= 768 || !mobileNav || !main
          ? true
          : Number.parseFloat(getComputedStyle(main).paddingBottom) >=
            mobileNav.getBoundingClientRect().height;
      const shellCorrect =
        width >= 768
          ? sidebar !== null && getComputedStyle(sidebar).display !== 'none'
          : sidebar !== null && getComputedStyle(sidebar).display === 'none';
      const mainText = main?.textContent ?? '';
      return {
        viewport: window.innerWidth,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        h1Count: document.querySelectorAll('h1').length,
        headingSkips,
        undersized,
        unfocused,
        withoutFocusIndicator,
        projectedMoneyClasses,
        currencyLeaks,
        authority: authority?.getAttribute('data-data-authority') ?? null,
        activeLinks,
        mobileClearance,
        shellCorrect,
        deniedCopy: mainText.includes('Necesitas permisos de fundador'),
        deniedAmounts: expectedDenied ? (main?.querySelectorAll('data.tnum').length ?? 0) : 0,
        founderNamesOnLeaderboard:
          routeName === 'leaderboard'
            ? ['Luis Ramírez', 'Diego Martínez Herrera'].filter((name) => mainText.includes(name))
            : [],
        homeEvidenceDisabled:
          routeName === 'home'
            ? Boolean(
                [...document.querySelectorAll('button')].find((button) =>
                  button.textContent?.includes('Subir evidencia'),
                )?.disabled,
              )
            : true,
      };
    },
    { expectedDenied, routeName, width },
  );

  const prefix = `${role}:${routeName}:${width}`;
  assert(response?.status() === 200, `${prefix} expected HTTP 200`, response?.status());
  assert(result.viewport === width, `${prefix} viewport mismatch`, result.viewport);
  assert(result.overflow <= 0, `${prefix} horizontal overflow`, result.overflow);
  assert(result.h1Count === 1, `${prefix} must have exactly one h1`, result.h1Count);
  assert(
    result.headingSkips.length === 0,
    `${prefix} heading hierarchy skips`,
    result.headingSkips,
  );
  assert(result.undersized.length === 0, `${prefix} controls below 44px`, result.undersized);
  assert(
    result.unfocused.length === 0,
    `${prefix} controls not programmatically focusable`,
    result.unfocused,
  );
  assert(
    result.withoutFocusIndicator.length === 0,
    `${prefix} controls without visible focus`,
    result.withoutFocusIndicator,
  );
  assert(
    result.projectedMoneyClasses.length === 0,
    `${prefix} projected money class leak`,
    result.projectedMoneyClasses,
  );
  assert(
    result.currencyLeaks.length === 0,
    `${prefix} currency outside Amount`,
    result.currencyLeaks,
  );
  assert(
    result.authority === 'synthetic',
    `${prefix} missing synthetic authority disclosure`,
    result.authority,
  );
  if (!expectedDenied) {
    assert(result.activeLinks.length > 0, `${prefix} has no active route state`);
  }
  assert(result.mobileClearance, `${prefix} mobile tab bar lacks reserved clearance`);
  assert(result.shellCorrect, `${prefix} shell breakpoint mismatch`);
  assert(consoleErrors.length === 0, `${prefix} console errors`, consoleErrors);
  assert(
    result.founderNamesOnLeaderboard.length === 0,
    `${prefix} founders appear in ranking`,
    result.founderNamesOnLeaderboard,
  );
  assert(result.homeEvidenceDisabled, `${prefix} inert evidence CTA is enabled`);
  if (expectedDenied) {
    assert(result.deniedCopy, `${prefix} missing denied presentation`);
    assert(
      result.deniedAmounts === 0,
      `${prefix} denied presentation leaks amounts`,
      result.deniedAmounts,
    );
  }
  return {
    role,
    routeName,
    routePath,
    width,
    expectedDenied,
    status: response?.status(),
    consoleErrors,
    ...result,
  };
}

async function matrix(browser) {
  const screenshotDir = path.join(receiptDir, 'screenshots');
  await fs.mkdir(screenshotDir, { recursive: true });
  for (const role of ['founder', 'member']) {
    const context = await browser.newContext({ viewport: { width: 1280, height } });
    await context.addCookies([
      { name: 'f23_prototype_viewer', value: role, url: baseUrl, httpOnly: true, sameSite: 'Lax' },
    ]);
    const page = await context.newPage();
    for (const [routeName, routePath] of routes) {
      for (const width of widths) {
        await page.setViewportSize({ width, height });
        const consoleErrors = [];
        const onConsole = (message) => {
          if (message.type() === 'error') consoleErrors.push(message.text());
        };
        page.on('console', onConsole);
        const response = await page.goto(`${baseUrl}${routePath}`, { waitUntil: 'networkidle' });
        const cell = await inspectPage(
          page,
          role,
          routeName,
          routePath,
          width,
          response,
          consoleErrors,
        );
        cells.push(cell);
        await page.screenshot({
          path: path.join(
            screenshotDir,
            `integrator-mode-s-${role}-${routeName}-${width}x${height}-default.png`,
          ),
          fullPage: true,
        });
        page.off('console', onConsole);
      }
    }
    await context.close();
  }
}

async function runInteractions(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height } });
  await context.addCookies([
    {
      name: 'f23_prototype_viewer',
      value: 'founder',
      url: baseUrl,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  const page = await context.newPage();
  await page.goto(`${baseUrl}/projects`, { waitUntil: 'networkidle' });

  await page.keyboard.press('Tab');
  const skipFocused = await page.evaluate(
    () => document.activeElement?.getAttribute('href') === '#main-content',
  );
  await page.keyboard.press('Enter');
  const mainFocused = await page.evaluate(() => document.activeElement?.id === 'main-content');
  assert(skipFocused && mainFocused, 'skip link must focus main content', {
    skipFocused,
    mainFocused,
  });
  interactions.push({ name: 'skip-link', skipFocused, mainFocused });

  const opener = page.locator('button[aria-label="Buscar"]').last();
  await opener.focus();
  await page.keyboard.press('Meta+K');
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  const backgroundInert = await page.evaluate(() => document.querySelector('[inert]') !== null);
  let trapHeld = true;
  for (let index = 0; index < 20; index += 1) {
    await page.keyboard.press('Tab');
    trapHeld &&= await page.evaluate(() =>
      Boolean(document.activeElement?.closest('[role="dialog"]')),
    );
  }
  await page.keyboard.press('Escape');
  const restored = await opener.evaluate((element) => document.activeElement === element);
  assert(backgroundInert && trapHeld && restored, 'command palette focus contract failed', {
    backgroundInert,
    trapHeld,
    restored,
  });
  interactions.push({ name: 'command-palette', backgroundInert, trapHeld, restored });

  await page.evaluate(() => localStorage.removeItem('firma23.sidebar-mode'));
  await page.reload({ waitUntil: 'networkidle' });
  const sidebar = page.locator('#firma23-sidebar');
  const compactWidth = await sidebar.evaluate((element) => element.getBoundingClientRect().width);
  await sidebar.hover();
  await page.waitForTimeout(350);
  const hoverWidth = await sidebar.evaluate((element) => element.getBoundingClientRect().width);
  const toggle = page.getByRole('button', { name: 'Ocultar menú lateral' });
  await toggle.click();
  await page.reload({ waitUntil: 'networkidle' });
  const persistedHidden = await page.evaluate(
    () => localStorage.getItem('firma23.sidebar-mode') === 'hidden',
  );
  assert(
    compactWidth === 92 && hoverWidth === 292 && persistedHidden,
    'sidebar state contract failed',
    { compactWidth, hoverWidth, persistedHidden },
  );
  interactions.push({ name: 'sidebar', compactWidth, hoverWidth, persistedHidden });

  await page.setViewportSize({ width: 767, height });
  await page.goto(`${baseUrl}/projects`, { waitUntil: 'networkidle' });
  const table767 = await page
    .locator('table')
    .evaluate((element) => getComputedStyle(element).display);
  await page.setViewportSize({ width: 768, height });
  const table768 = await page
    .locator('table')
    .evaluate((element) => getComputedStyle(element).display);
  assert(table767 === 'none' && table768 !== 'none', '767/768 record-table switch failed', {
    table767,
    table768,
  });
  interactions.push({ name: 'table-breakpoint', table767, table768 });

  await context.close();

  const reduced = await browser.newContext({
    viewport: { width: 1280, height },
    reducedMotion: 'reduce',
  });
  await reduced.addCookies([
    {
      name: 'f23_prototype_viewer',
      value: 'member',
      url: baseUrl,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  const reducedPage = await reduced.newPage();
  await reducedPage.goto(baseUrl, { waitUntil: 'networkidle' });
  const canvas = reducedPage.locator('canvas').first();
  await canvas.waitFor();
  const firstFrame = await canvas.screenshot();
  await reducedPage.waitForTimeout(700);
  const secondFrame = await canvas.screenshot();
  const frozen = firstFrame.equals(secondFrame);
  const canvasRect = await canvas.boundingBox();
  assert(
    frozen && canvasRect?.width > 0 && canvasRect?.height > 0,
    'MeshDrift reduced-motion frame is not stable',
    { frozen, canvasRect },
  );
  interactions.push({ name: 'reduced-motion', frozen, canvasRect });
  await reduced.close();
}

async function browser404(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height } });
  await context.addCookies([
    {
      name: 'f23_prototype_viewer',
      value: 'founder',
      url: baseUrl,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  const page = await context.newPage();
  for (const route of invalidRoutes) {
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
    const visible = await page.getByText('No encontramos eso').isVisible();
    assert(response?.status() === 404 && visible, `browser 404 failed for ${route}`, {
      status: response?.status(),
      visible,
    });
    interactions.push({ name: 'browser-404', route, status: response?.status(), visible });
  }
  const member = await browser.newContext({ viewport: { width: 1280, height } });
  await member.addCookies([
    {
      name: 'f23_prototype_viewer',
      value: 'member',
      url: baseUrl,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  const memberPage = await member.newPage();
  const other = await memberPage.goto(`${baseUrl}/leaderboard/emiliano-pasos/provenance`, {
    waitUntil: 'networkidle',
  });
  assert(
    other?.status() === 404,
    'member-other provenance must not expose line detail',
    other?.status(),
  );
  interactions.push({ name: 'member-other-provenance', status: other?.status() });
  await member.close();
  await context.close();
}

const browser = await chromium.launch({ headless: true, executablePath });
let fatalError = null;
try {
  await matrix(browser);
  await runInteractions(browser);
  await browser404(browser);
} catch (error) {
  fatalError =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { message: String(error) };
  failures.push({ message: 'Browser harness terminated unexpectedly', detail: fatalError });
} finally {
  await browser.close();
}

const result = {
  candidateSha,
  runId,
  mode: 'S',
  baseUrl,
  port,
  serverPid,
  startedAt,
  finishedAt: new Date().toISOString(),
  cells,
  interactions,
  failures,
  fatalError,
  passed: failures.length === 0,
};
await fs.writeFile(
  path.join(receiptDir, 'mode-s-browser.json'),
  `${JSON.stringify(result, null, 2)}\n`,
);
if (failures.length > 0) {
  process.stderr.write(`${JSON.stringify(failures, null, 2)}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `PASS ${cells.length} matrix cells and ${interactions.length} interaction receipts\n`,
  );
}
