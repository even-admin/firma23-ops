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

function monitorPage(page, scope, allowResponse = () => false) {
  const events = [];
  const onConsole = (message) => {
    if (message.type() === 'error') {
      events.push({ type: 'console.error', scope, text: message.text() });
    }
  };
  const onPageError = (error) => {
    events.push({ type: 'pageerror', scope, message: error.message, stack: error.stack });
  };
  const onRequestFailed = (request) => {
    events.push({
      type: 'requestfailed',
      scope,
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      failure: request.failure(),
    });
  };
  const onResponse = (response) => {
    if (response.status() < 400 || allowResponse(response)) return;
    events.push({
      type: 'unexpected-response',
      scope,
      url: response.url(),
      status: response.status(),
      resourceType: response.request().resourceType(),
    });
  };
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('requestfailed', onRequestFailed);
  page.on('response', onResponse);
  return {
    events,
    reset() {
      events.length = 0;
    },
    detach() {
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
      page.off('requestfailed', onRequestFailed);
      page.off('response', onResponse);
    },
  };
}

function expectedActiveHref(routeName, routePath, width) {
  if (routeName === 'home') return '/';
  if (routeName === 'opportunities' || routeName === 'opportunity') return '/opportunities';
  if (routeName === 'network' || routeName === 'member') return '/network';
  if (routeName === 'leaderboard' || routeName === 'provenance') return '/leaderboard';
  if (routeName === 'projects') return '/projects';
  if (routeName === 'project') return width >= 768 ? routePath : '/projects';
  if (routeName === 'finance' || routeName === 'settle') {
    return width >= 768 ? '/admin/finance' : '/admin';
  }
  return '/admin';
}

async function inspectInteractiveState(scope, label) {
  return scope.evaluate((root, stateLabel) => {
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
    const controls = [
      ...root.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex]'),
    ]
      .filter((element) => visible(element) && element.getAttribute('tabindex') !== '-1')
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          label:
            element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 80) ?? '',
          width: rect.width,
          height: rect.height,
          disabled:
            element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true',
        };
      });
    const headings = [...root.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(visible);
    const levels = headings.map((heading) => Number(heading.tagName.slice(1)));
    const headingSkips = levels.filter(
      (level, index) => index > 0 && level > (levels[index - 1] ?? level) + 1,
    );
    const focused = document.activeElement;
    const focusedRect = focused instanceof HTMLElement ? focused.getBoundingClientRect() : null;
    const focusedHit =
      focusedRect === null
        ? null
        : document.elementFromPoint(
            Math.max(0, Math.min(window.innerWidth - 1, focusedRect.left + focusedRect.width / 2)),
            Math.max(0, Math.min(window.innerHeight - 1, focusedRect.top + focusedRect.height / 2)),
          );
    return {
      stateLabel,
      controls,
      headingSkips,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      focused:
        focused instanceof HTMLElement
          ? {
              tag: focused.tagName,
              text: focused.textContent?.trim().slice(0, 100) ?? '',
              message:
                focused.querySelector(':scope > p')?.textContent?.trim() ??
                focused.textContent?.trim() ??
                '',
              outcome: focused.dataset.adminOutcome ?? null,
              role: focused.getAttribute('role'),
              ariaLive: focused.getAttribute('aria-live'),
              ariaAtomic: focused.getAttribute('aria-atomic'),
              visible: visible(focused),
              inViewport:
                focusedRect !== null &&
                focusedRect.top >= 0 &&
                focusedRect.left >= 0 &&
                focusedRect.bottom <= window.innerHeight &&
                focusedRect.right <= window.innerWidth,
              unobscured: focusedHit !== null && focused.contains(focusedHit),
              rect: focusedRect,
            }
          : null,
    };
  }, label);
}

async function inspectPage(page, role, routeName, routePath, width, response) {
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
        .filter((element) => visible(element) && element.getAttribute('tabindex') !== '-1')
        .map((element) => {
          const disabled =
            element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true';
          if (!disabled) element.focus({ preventScroll: true });
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            tag: element.tagName,
            label:
              element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 80) ?? '',
            width: rect.width,
            height: rect.height,
            disabled,
            focused: disabled || document.activeElement === element,
            outlineWidth: Number.parseFloat(style.outlineWidth || '0'),
            outlineStyle: style.outlineStyle,
          };
        });
      const undersized = controls.filter((control) => control.width < 44 || control.height < 44);
      const unfocused = controls.filter((control) => !control.focused);
      const withoutFocusIndicator = controls.filter(
        (control) =>
          !control.disabled && (control.outlineStyle === 'none' || control.outlineWidth < 2),
      );
      const projectedRoots = [
        ...document.querySelectorAll(
          '[data-rail-kind="projection"],[data-money-state="projected"]',
        ),
      ];
      const projectedMoneyClasses = projectedRoots
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
      const deniedStateCount = main?.querySelectorAll('[data-permission-denied]').length ?? 0;
      const deniedInteractive = expectedDenied
        ? [...(main?.querySelectorAll('a[href],button,input,select,textarea,summary') ?? [])]
            .filter((element) => visible(element) && !element.hasAttribute('disabled'))
            .map((element) => element.textContent?.trim().slice(0, 80) ?? element.tagName)
        : [];
      const deniedSensitive = expectedDenied
        ? (main?.querySelectorAll('[data-money-state],[data-rail-kind],[data-leaderboard-member]')
            .length ?? 0)
        : 0;
      const founderOnlyReachable = expectedDenied
        ? [...document.querySelectorAll('a[href^="/admin"],a[href^="/opportunities"]')]
            .filter(visible)
            .map((link) => link.getAttribute('href'))
        : [];
      const setyRail =
        routeName === 'opportunity' && !expectedDenied
          ? document.querySelector('[data-rail-kind][data-base-centavos="897270"]')
          : null;
      const setyShares =
        setyRail === null
          ? null
          : Object.fromEntries(
              ['house', 'closer', 'delivery'].map((key) => {
                const segment = setyRail.querySelector(`[data-share-key="${key}"]`);
                return [key, Number(segment?.querySelector('data.tnum')?.getAttribute('value'))];
              }),
            );
      const leaderboardRows =
        routeName === 'leaderboard'
          ? [...document.querySelectorAll('[data-leaderboard-member]')].map((row) => ({
              slug: row.getAttribute('data-leaderboard-member'),
              approved: Number(
                row.querySelector('[data-money-state="approved"] data.tnum')?.getAttribute('value'),
              ),
              hasPaid: row.querySelector('[data-money-state="paid"]') !== null,
              hasProjected: row.querySelector('[data-money-state="projected"]') !== null,
            }))
          : [];
      const financeStates =
        routeName === 'finance' && !expectedDenied
          ? [...document.querySelectorAll('[data-money-state]')].map((node) =>
              node.getAttribute('data-money-state'),
            )
          : [];
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
        deniedStateCount,
        deniedInteractive,
        deniedSensitive,
        founderOnlyReachable,
        setyShares,
        leaderboardRows,
        financeStates,
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
    const expectedHref = expectedActiveHref(routeName, routePath, width);
    assert(
      result.activeLinks.includes(expectedHref),
      `${prefix} active route does not match ${expectedHref}`,
      result.activeLinks,
    );
  }
  assert(result.mobileClearance, `${prefix} mobile tab bar lacks reserved clearance`);
  assert(result.shellCorrect, `${prefix} shell breakpoint mismatch`);
  assert(
    result.founderNamesOnLeaderboard.length === 0,
    `${prefix} founders appear in ranking`,
    result.founderNamesOnLeaderboard,
  );
  assert(result.homeEvidenceDisabled, `${prefix} inert evidence CTA is enabled`);
  if (expectedDenied) {
    assert(result.deniedCopy, `${prefix} missing denied presentation`);
    assert(result.deniedStateCount === 1, `${prefix} missing explicit PermissionDenied state`);
    assert(
      result.deniedAmounts === 0,
      `${prefix} denied presentation leaks amounts`,
      result.deniedAmounts,
    );
    assert(
      result.deniedInteractive.length === 0,
      `${prefix} denied page exposes actions`,
      result.deniedInteractive,
    );
    assert(
      result.deniedSensitive === 0,
      `${prefix} denied page exposes sensitive structures`,
      result.deniedSensitive,
    );
    assert(
      result.founderOnlyReachable.length === 0,
      `${prefix} founder navigation remains reachable`,
      result.founderOnlyReachable,
    );
  }
  if (result.setyShares !== null) {
    assert(
      result.setyShares.house === 269181 &&
        result.setyShares.closer === 179454 &&
        result.setyShares.delivery === 448635,
      `${prefix} SETY rail centavos mismatch`,
      result.setyShares,
    );
  }
  if (routeName === 'leaderboard') {
    const approved = result.leaderboardRows.map((row) => row.approved);
    assert(
      approved.every((amount, index) => index === 0 || amount <= approved[index - 1]),
      `${prefix} leaderboard is not approved-descending`,
      approved,
    );
    if (role === 'member') {
      for (const row of result.leaderboardRows) {
        const own = row.slug === 'sebastian-benitez';
        assert(
          row.hasPaid === own && row.hasProjected === own,
          `${prefix} member personal-money redaction failed`,
          row,
        );
      }
    }
  }
  if (routeName === 'finance' && !expectedDenied) {
    for (const state of ['approved', 'paid', 'payable', 'projected']) {
      assert(
        result.financeStates.includes(state),
        `${prefix} missing finance state ${state}`,
        result.financeStates,
      );
    }
  }
  return {
    role,
    routeName,
    routePath,
    width,
    expectedDenied,
    status: response?.status(),
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
    const health = monitorPage(page, `matrix:${role}`);
    for (const [routeName, routePath] of routes) {
      for (const width of widths) {
        await page.setViewportSize({ width, height });
        health.reset();
        const response = await page.goto(`${baseUrl}${routePath}`, { waitUntil: 'networkidle' });
        // A route change can otherwise abort a still-loading Next font from the
        // previous document and misattribute that real request failure to the
        // next matrix cell. Finish the current document's font work before
        // accepting or leaving the cell; no request failure is filtered out.
        await page.evaluate(() => document.fonts.ready.then(() => undefined));
        const cell = await inspectPage(page, role, routeName, routePath, width, response);
        const activeElementBeforeScreenshot = await page.evaluate(() => {
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
          return {
            tag: document.activeElement?.tagName ?? null,
            id: document.activeElement?.id ?? null,
          };
        });
        await page.waitForTimeout(100);
        await page.screenshot({
          path: path.join(
            screenshotDir,
            `integrator-mode-s-${role}-${routeName}-${width}x${height}-default.png`,
          ),
          fullPage: true,
        });
        await page.waitForTimeout(50);
        const runtimeEvents = [...health.events];
        assert(
          runtimeEvents.length === 0,
          `${role}:${routeName}:${width} browser runtime/network errors`,
          runtimeEvents,
        );
        cells.push({ ...cell, runtimeEvents, activeElementBeforeScreenshot });
        health.reset();
      }
    }
    health.detach();
    await context.close();
  }
}

async function runInteractions(browser) {
  const screenshotDir = path.join(receiptDir, 'screenshots');
  await fs.mkdir(screenshotDir, { recursive: true });
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
  const health = monitorPage(page, 'interactions');
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
  let reverseTrapHeld = true;
  for (let index = 0; index < 20; index += 1) {
    await page.keyboard.press('Shift+Tab');
    reverseTrapHeld &&= await page.evaluate(() =>
      Boolean(document.activeElement?.closest('[role="dialog"]')),
    );
  }
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  const dialogRemoved = (await page.getByRole('dialog').count()) === 0;
  const restored = await opener.evaluate((element) => document.activeElement === element);
  assert(
    backgroundInert && trapHeld && reverseTrapHeld && dialogRemoved && restored,
    'command palette focus contract failed',
    {
      backgroundInert,
      trapHeld,
      reverseTrapHeld,
      dialogRemoved,
      restored,
    },
  );
  interactions.push({
    name: 'command-palette',
    backgroundInert,
    trapHeld,
    reverseTrapHeld,
    dialogRemoved,
    restored,
  });

  const sidebarMeasurements = [];
  for (const width of [768, 1280]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => localStorage.removeItem('firma23.sidebar-mode'));
    await page.goto(`${baseUrl}/projects`, { waitUntil: 'networkidle' });
    const sidebar = page.locator('#firma23-sidebar');
    const compactWidth = await sidebar.evaluate((element) => element.getBoundingClientRect().width);
    await sidebar.hover();
    await page.waitForTimeout(350);
    const hoverWidth = await sidebar.evaluate((element) => element.getBoundingClientRect().width);
    const hoverGeometry = await page.evaluate(() => {
      const rail = document.querySelector('#firma23-sidebar');
      const panel = rail?.firstElementChild;
      const main = document.querySelector('#main-content');
      const heading = main?.querySelector('h1');
      const records = main?.querySelector('[data-project-records]');
      if (
        !(rail instanceof HTMLElement) ||
        !(panel instanceof HTMLElement) ||
        !(main instanceof HTMLElement) ||
        !(heading instanceof HTMLElement) ||
        !(records instanceof HTMLElement)
      ) {
        return null;
      }
      const railRect = rail.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const mainRect = main.getBoundingClientRect();
      const headingRect = heading.getBoundingClientRect();
      const headingHit = document.elementFromPoint(
        Math.max(0, Math.min(window.innerWidth - 1, headingRect.left + headingRect.width / 2)),
        Math.max(0, Math.min(window.innerHeight - 1, headingRect.top + headingRect.height / 2)),
      );
      const recordsRect = records.getBoundingClientRect();
      const table = records.querySelector('[data-record-view="table"]');
      const list = records.querySelector('[data-record-view="list"]');
      const tableVisible = table instanceof HTMLElement && getComputedStyle(table).display !== 'none';
      const listVisible = list instanceof HTMLElement && getComputedStyle(list).display !== 'none';
      const visibleRecordChildren = [...records.querySelectorAll('th, td, li')].filter(
        (element) => element instanceof HTMLElement && element.offsetParent !== null,
      );
      const recordChildrenContained = visibleRecordChildren.every((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left >= recordsRect.left - 0.5 && rect.right <= recordsRect.right + 0.5;
      });
      const visibleCells = [...records.querySelectorAll('th, td')].filter(
        (element) => element instanceof HTMLElement && element.offsetParent !== null,
      );
      const cellContentsContained = visibleCells.every((cell) =>
        [...cell.children].every((child) => {
          const cellRect = cell.getBoundingClientRect();
          const childRect = child.getBoundingClientRect();
          return childRect.left >= cellRect.left - 0.5 && childRect.right <= cellRect.right + 0.5;
        }),
      );
      const tableCellsSeparated = [...records.querySelectorAll('tr')]
        .filter((row) => row instanceof HTMLElement && row.offsetParent !== null)
        .every((row) => {
          const cells = [...row.querySelectorAll(':scope > th, :scope > td')];
          return cells.every((cell, index) => {
            const next = cells[index + 1];
            if (next === undefined) return true;
            return cell.getBoundingClientRect().right <= next.getBoundingClientRect().left + 0.5;
          });
        });
      return {
        rail: { left: railRect.left, right: railRect.right, width: railRect.width },
        panel: { left: panelRect.left, right: panelRect.right },
        main: { left: mainRect.left, right: mainRect.right, width: mainRect.width },
        heading: {
          left: headingRect.left,
          right: headingRect.right,
          top: headingRect.top,
          bottom: headingRect.bottom,
          visible:
            headingRect.left >= 0 &&
            headingRect.right <= window.innerWidth &&
            headingRect.top >= 0 &&
            headingRect.bottom <= window.innerHeight,
          unobscured: headingHit !== null && heading.contains(headingHit),
        },
        panelBorderRightWidth: Number.parseFloat(getComputedStyle(panel).borderRightWidth),
        records: {
          tableVisible,
          listVisible,
          childrenContained: recordChildrenContained,
          cellContentsContained,
          tableCellsSeparated,
        },
      };
    });
    await page.mouse.move(width - 10, 400);
    await sidebar.locator('a[href="/projects"]').focus();
    await page.waitForTimeout(350);
    const focusWidth = await sidebar.evaluate((element) => element.getBoundingClientRect().width);
    const focusedControl = await page.evaluate(() => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return null;
      const rect = active.getBoundingClientRect();
      return {
        href: active.getAttribute('href'),
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        visible:
          rect.left >= 0 &&
          rect.right <= window.innerWidth &&
          rect.top >= 0 &&
          rect.bottom <= window.innerHeight,
      };
    });
    const expandedOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    if (width === 768) {
      await page.screenshot({
        path: path.join(screenshotDir, `sidebar-expanded-${width}x${height}.png`),
        fullPage: true,
      });
    }
    sidebarMeasurements.push({
      width,
      compactWidth,
      hoverWidth,
      focusWidth,
      expandedOverflow,
      hoverGeometry,
      focusedControl,
    });
  }
  const invalidSidebarMeasurement = sidebarMeasurements.find(
    (measurement) =>
      measurement.compactWidth !== 92 ||
      measurement.hoverWidth !== 292 ||
      measurement.focusWidth !== 292 ||
      measurement.expandedOverflow > 0 ||
      measurement.hoverGeometry === null ||
      measurement.hoverGeometry.rail.right > measurement.hoverGeometry.main.left + 0.5 ||
      measurement.hoverGeometry.panel.left < measurement.hoverGeometry.rail.left ||
      measurement.hoverGeometry.panel.right > measurement.hoverGeometry.rail.right ||
      measurement.hoverGeometry.panelBorderRightWidth < 1 ||
      !measurement.hoverGeometry.heading.visible ||
      !measurement.hoverGeometry.heading.unobscured ||
      !measurement.hoverGeometry.records.childrenContained ||
      !measurement.hoverGeometry.records.cellContentsContained ||
      !measurement.hoverGeometry.records.tableCellsSeparated ||
      (measurement.width === 768 &&
        (!measurement.hoverGeometry.records.listVisible ||
          measurement.hoverGeometry.records.tableVisible)) ||
      (measurement.width === 1280 &&
        (!measurement.hoverGeometry.records.tableVisible ||
          measurement.hoverGeometry.records.listVisible)) ||
      measurement.focusedControl?.href !== '/projects' ||
      !measurement.focusedControl.visible,
  );
  const sidebar = page.locator('#firma23-sidebar');
  const toggle = page.getByRole('button', { name: 'Ocultar menú lateral' });
  await toggle.click();
  await page.reload({ waitUntil: 'networkidle' });
  const persistedHidden = await page.evaluate(
    () => localStorage.getItem('firma23.sidebar-mode') === 'hidden',
  );
  const hiddenWidth = await sidebar.evaluate((element) => element.getBoundingClientRect().width);
  const hiddenInert = await sidebar.evaluate((element) => element.hasAttribute('inert'));
  const restoreToggleVisible = await page
    .getByRole('button', { name: 'Mostrar menú lateral' })
    .isVisible();
  assert(
    invalidSidebarMeasurement === undefined &&
      persistedHidden &&
      hiddenWidth === 0 &&
      hiddenInert &&
      restoreToggleVisible,
    'sidebar state contract failed',
    {
      sidebarMeasurements,
      persistedHidden,
      hiddenWidth,
      hiddenInert,
      restoreToggleVisible,
    },
  );
  interactions.push({
    name: 'sidebar',
    sidebarMeasurements,
    persistedHidden,
    hiddenWidth,
    hiddenInert,
    restoreToggleVisible,
  });

  await page.setViewportSize({ width: 767, height });
  await page.goto(`${baseUrl}/projects`, { waitUntil: 'networkidle' });
  const table767 = await page
    .locator('[data-record-view="table"]')
    .evaluate((element) => getComputedStyle(element).display);
  const list767 = await page
    .locator('[data-record-view="list"]')
    .evaluate((element) => getComputedStyle(element).display);
  await page.setViewportSize({ width: 768, height });
  const table768 = await page
    .locator('[data-record-view="table"]')
    .evaluate((element) => getComputedStyle(element).display);
  const list768 = await page
    .locator('[data-record-view="list"]')
    .evaluate((element) => getComputedStyle(element).display);
  await page.setViewportSize({ width: 1280, height });
  const table1280 = await page
    .locator('[data-record-view="table"]')
    .evaluate((element) => getComputedStyle(element).display);
  const list1280 = await page
    .locator('[data-record-view="list"]')
    .evaluate((element) => getComputedStyle(element).display);
  assert(
    table767 === 'none' &&
      list767 !== 'none' &&
      table768 === 'none' &&
      list768 !== 'none' &&
      table1280 !== 'none' &&
      list1280 === 'none',
    'container-responsive record composition failed',
    { table767, list767, table768, list768, table1280, list1280 },
  );
  await page.waitForTimeout(50);
  assert(health.events.length === 0, 'interaction browser runtime/network errors', health.events);
  interactions.push({
    name: 'record-container-switch',
    table767,
    list767,
    table768,
    list768,
    table1280,
    list1280,
  });

  health.detach();
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
  const reducedHealth = monitorPage(reducedPage, 'reduced-motion');
  await reducedPage.goto(baseUrl, { waitUntil: 'networkidle' });
  const canvas = reducedPage.locator('canvas').first();
  await canvas.waitFor();
  const firstFrame = await canvas.screenshot();
  await reducedPage.waitForTimeout(700);
  const secondFrame = await canvas.screenshot();
  const frozen = firstFrame.equals(secondFrame);
  const canvasRect = await canvas.boundingBox();
  assert(canvasRect !== null, 'MeshDrift canvas has no layout box');
  await reducedPage.evaluate(
    ({ width, height }) => {
      const blank = document.createElement('canvas');
      blank.dataset.acceptanceBlank = '';
      blank.width = Math.max(1, Math.round(width));
      blank.height = Math.max(1, Math.round(height));
      blank.style.width = `${width}px`;
      blank.style.height = `${height}px`;
      blank.style.position = 'fixed';
      blank.style.inset = '0 auto auto 0';
      document.body.append(blank);
    },
    { width: canvasRect?.width ?? 1, height: canvasRect?.height ?? 1 },
  );
  const blankCanvas = reducedPage.locator('canvas[data-acceptance-blank]');
  const blankFrame = await blankCanvas.screenshot();
  const nonblank = !firstFrame.equals(blankFrame);
  await blankCanvas.evaluate((element) => element.remove());
  await reducedPage.waitForTimeout(50);
  assert(
    frozen &&
      canvasRect?.width > 0 &&
      canvasRect?.height > 0 &&
      nonblank &&
      reducedHealth.events.length === 0,
    'MeshDrift reduced-motion frame is not stable',
    { frozen, nonblank, canvasRect, runtimeEvents: reducedHealth.events },
  );
  interactions.push({ name: 'reduced-motion', frozen, nonblank, canvasRect });
  reducedHealth.detach();
  await reduced.close();
}

function assertAdminInspection(name, inspection, expectedOutcome = null, expectedText = null) {
  const undersized = inspection.controls.filter(
    (control) => control.width < 44 || control.height < 44,
  );
  assert(undersized.length === 0, `${name} has controls below 44px`, undersized);
  assert(
    inspection.headingSkips.length === 0,
    `${name} has heading skips`,
    inspection.headingSkips,
  );
  assert(inspection.overflow <= 0, `${name} has horizontal overflow`, inspection.overflow);
  if (expectedOutcome !== null) {
    const expectedError = expectedOutcome.endsWith('error');
    assert(
      inspection.focused?.outcome === expectedOutcome &&
        inspection.focused.visible &&
        inspection.focused.inViewport &&
        inspection.focused.unobscured &&
        inspection.focused.role === (expectedError ? 'alert' : 'status') &&
        inspection.focused.ariaLive === (expectedError ? 'assertive' : 'polite') &&
        inspection.focused.ariaAtomic === 'true' &&
        (expectedText === null || inspection.focused.message === expectedText),
      `${name} did not focus ${expectedOutcome}`,
      inspection.focused,
    );
  }
}

async function assertAdminPending(page, scenario, name, kind, expectedText) {
  await scenario.locator('[data-admin-pending="true"]').waitFor();
  const pending = scenario.locator(`[data-admin-pending-status="${kind}"]`);
  await pending.waitFor();
  const pendingHandle = await pending.elementHandle();
  assert(pendingHandle !== null, `${name} pending status did not mount`);
  if (pendingHandle !== null) {
    await page.waitForFunction((element) => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(
        Math.max(0, Math.min(window.innerWidth - 1, rect.left + rect.width / 2)),
        Math.max(0, Math.min(window.innerHeight - 1, rect.top + rect.height / 2)),
      );
      return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.right <= window.innerWidth &&
        hit !== null &&
        element.contains(hit)
      );
    }, pendingHandle);
  }
  const state = await pending.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(
      Math.max(0, Math.min(window.innerWidth - 1, rect.left + rect.width / 2)),
      Math.max(0, Math.min(window.innerHeight - 1, rect.top + rect.height / 2)),
    );
    return {
      text: element.textContent?.trim() ?? '',
      role: element.getAttribute('role'),
      ariaLive: element.getAttribute('aria-live'),
      ariaAtomic: element.getAttribute('aria-atomic'),
      visible: rect.width > 0 && rect.height > 0,
      inViewport:
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.right <= window.innerWidth,
      unobscured: hit !== null && element.contains(hit),
    };
  });
  const inspection = await inspectInteractiveState(scenario, `${name}-pending`);
  assertAdminInspection(`${name}-pending`, inspection);
  assert(
    state.text === expectedText &&
      state.role === 'status' &&
      state.ariaLive === 'polite' &&
      state.ariaAtomic === 'true' &&
      state.visible &&
      state.inViewport &&
      state.unobscured,
    `${name} pending state is not visible and announced`,
    state,
  );
  await page.waitForTimeout(0);
  return state;
}

async function proveAdminRetry(
  page,
  scenario,
  scenarioName,
  retryName,
  outcome,
  attemptAttribute,
  pendingKind,
  pendingText,
) {
  const before = Number(await scenario.getAttribute(attemptAttribute));
  await scenario.getByRole('button', { name: retryName }).click();
  const pending = await assertAdminPending(
    page,
    scenario,
    `${scenarioName}-retry`,
    pendingKind,
    pendingText,
  );
  await scenario.locator(`[data-admin-outcome="${outcome}"]`).waitFor({ state: 'hidden' });
  await page.waitForFunction(
    ({ selector, attribute, expected }) =>
      Number(document.querySelector(selector)?.getAttribute(attribute)) === expected,
    {
      selector: `[data-admin-scenario="${scenarioName}"]`,
      attribute: attemptAttribute,
      expected: before + 1,
    },
  );
  await scenario.locator('[data-admin-pending="false"]').waitFor();
  await scenario.locator(`[data-admin-outcome="${outcome}"]`).waitFor();
  const after = Number(await scenario.getAttribute(attemptAttribute));
  assert(after === before + 1, `${scenarioName} retry did not create a new attempt`, {
    before,
    after,
    attemptAttribute,
  });
  return { before, after, pending };
}

async function runAdminAcceptance(browser) {
  const screenshotDir = path.join(receiptDir, 'screenshots', 'admin-states');
  await fs.mkdir(screenshotDir, { recursive: true });

  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height } });
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
    const health = monitorPage(page, `admin-states:${width}`);
    await page.goto(`${baseUrl}/dev/states`, { waitUntil: 'networkidle' });
    assert(
      await page.locator('[data-admin-acceptance-states]').isVisible(),
      `admin states unavailable at ${width}`,
    );

    const ready = page.locator('[data-admin-scenario="intake-ready"]');
    const manualOpener = ready.getByRole('button', { name: 'Crear manualmente' });
    await manualOpener.focus();
    const openerHandle = await manualOpener.elementHandle();
    await manualOpener.click();
    const sponsor = ready.getByRole('textbox', { name: 'Patrocinador' });
    await sponsor.waitFor();
    const manualFocused = await sponsor.evaluate((element) => document.activeElement === element);
    let inspection = await inspectInteractiveState(ready, `admin-manual-${width}`);
    assertAdminInspection(`admin-manual-${width}`, inspection);
    await ready.getByRole('button', { name: 'Cancelar' }).click();
    await page.waitForFunction(
      (element) => element !== null && document.activeElement === element,
      openerHandle,
    );
    const manualRestored = true;
    assert(manualFocused && manualRestored, `admin manual focus contract failed at ${width}`, {
      manualFocused,
      manualRestored,
    });
    interactions.push({ name: 'admin-manual-focus', width, manualFocused, manualRestored });

    const readyInput = ready.locator('input[type="file"]');
    await readyInput.setInputFiles({
      name: 'propuesta.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('x'),
    });
    inspection = await inspectInteractiveState(ready, `admin-selected-${width}`);
    assertAdminInspection(`admin-selected-${width}`, inspection);
    await ready.getByRole('button', { name: 'Procesar documento' }).click();
    const processingButton = ready.getByRole('button', { name: 'Analizando documento…' });
    const processingVisible = await processingButton.isVisible();
    const processingDisabled = await processingButton.isDisabled();
    inspection = await inspectInteractiveState(ready, `admin-processing-${width}`);
    assertAdminInspection(`admin-processing-${width}`, inspection);
    assert(processingVisible && processingDisabled, `admin processing state failed at ${width}`, {
      processingVisible,
      processingDisabled,
    });
    await ready.getByText('Borrador extraído').waitFor();
    inspection = await inspectInteractiveState(ready, `admin-ready-${width}`);
    assertAdminInspection(`admin-ready-${width}`, inspection);

    await ready.getByRole('button', { name: 'Confirmar contrato existente' }).click();
    await ready.locator('[data-admin-outcome="confirm-unavailable"]').waitFor();
    inspection = await inspectInteractiveState(ready, `admin-confirm-unavailable-${width}`);
    assertAdminInspection(`admin-confirm-unavailable-${width}`, inspection, 'confirm-unavailable');
    const discardTrigger = ready.getByRole('button', { name: 'Descartar borrador' });
    await discardTrigger.click();
    inspection = await inspectInteractiveState(ready, `admin-discard-armed-${width}`);
    assertAdminInspection(`admin-discard-armed-${width}`, inspection);
    await ready.getByRole('button', { name: 'Conservar borrador' }).click();
    await page.waitForFunction(
      (element) => element !== null && document.activeElement === element,
      await discardTrigger.elementHandle(),
    );
    assert(
      (await ready
        .getByText('Confirma el descarte. Esta acción no crea ningún contrato.')
        .count()) === 0,
      `admin discard cancel remained armed at ${width}`,
    );
    await ready.getByRole('button', { name: 'Descartar borrador' }).click();
    await ready.getByRole('button', { name: 'Confirmar descarte' }).click();
    await ready.locator('[data-admin-outcome="discard-unavailable"]').waitFor();
    inspection = await inspectInteractiveState(ready, `admin-discard-unavailable-${width}`);
    assertAdminInspection(`admin-discard-unavailable-${width}`, inspection, 'discard-unavailable');

    const error = page.locator('[data-admin-scenario="intake-error"]');
    await error
      .locator('input[type="file"]')
      .setInputFiles({ name: 'error.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') });
    await error.getByRole('button', { name: 'Procesar documento' }).click();
    await error.getByRole('alert').waitFor();
    const errorFocused = await error
      .getByRole('alert')
      .evaluate((element) => document.activeElement === element);
    inspection = await inspectInteractiveState(error, `admin-intake-error-${width}`);
    assertAdminInspection(`admin-intake-error-${width}`, inspection);
    assert(errorFocused, `admin intake error was not focused at ${width}`);

    const confirmExpected = {
      'confirm-success': { outcome: 'confirmed', text: 'Contrato confirmado.' },
      'confirm-unavailable': {
        outcome: 'confirm-unavailable',
        text: 'Confirmación no disponible.',
      },
      'confirm-error': { outcome: 'confirm-error', text: 'Error de confirmación.' },
      'confirm-rejected': {
        outcome: 'confirm-error',
        text: 'No pudimos confirmar el contrato. El borrador sigue disponible.',
      },
    };
    for (const [scenarioName, expected] of Object.entries(confirmExpected)) {
      const scenario = page.locator(`[data-admin-scenario="${scenarioName}"]`);
      await scenario.getByRole('button', { name: 'Confirmar contrato existente' }).click();
      const pending = await assertAdminPending(
        page,
        scenario,
        `${scenarioName}-${width}`,
        'confirm',
        'Confirmando contrato…',
      );
      interactions.push({ name: 'admin-confirm-pending', width, scenarioName, pending });
      await scenario.locator(`[data-admin-outcome="${expected.outcome}"]`).waitFor();
      inspection = await inspectInteractiveState(scenario, `${scenarioName}-${width}`);
      assertAdminInspection(
        `${scenarioName}-${width}`,
        inspection,
        expected.outcome,
        expected.text,
      );
      if (expected.outcome === 'confirm-error') {
        const retry = await proveAdminRetry(
          page,
          scenario,
          scenarioName,
          'Reintentar',
          expected.outcome,
          'data-confirm-attempts',
          'confirm',
          'Confirmando contrato…',
        );
        inspection = await inspectInteractiveState(scenario, `${scenarioName}-retry-${width}`);
        assertAdminInspection(
          `${scenarioName}-retry-${width}`,
          inspection,
          expected.outcome,
          expected.text,
        );
        interactions.push({ name: 'admin-confirm-retry', width, scenarioName, ...retry });
      }
    }

    const discardExpected = {
      'discard-success': {
        outcome: 'discarded',
        text: 'Borrador descartado. No se creó ningún contrato.',
      },
      'discard-unavailable': {
        outcome: 'discard-unavailable',
        text: 'Descarte no disponible.',
      },
      'discard-error': { outcome: 'discard-error', text: 'Error de descarte.' },
      'discard-rejected': {
        outcome: 'discard-error',
        text: 'No pudimos descartar el borrador. Consérvalo o reintenta.',
      },
    };
    for (const [scenarioName, expected] of Object.entries(discardExpected)) {
      const scenario = page.locator(`[data-admin-scenario="${scenarioName}"]`);
      await scenario.getByRole('button', { name: 'Descartar borrador' }).click();
      await scenario.getByRole('button', { name: 'Confirmar descarte' }).click();
      const pending = await assertAdminPending(
        page,
        scenario,
        `${scenarioName}-${width}`,
        'discard',
        'Descartando borrador…',
      );
      interactions.push({ name: 'admin-discard-pending', width, scenarioName, pending });
      await scenario.locator(`[data-admin-outcome="${expected.outcome}"]`).waitFor();
      inspection = await inspectInteractiveState(scenario, `${scenarioName}-${width}`);
      assertAdminInspection(
        `${scenarioName}-${width}`,
        inspection,
        expected.outcome,
        expected.text,
      );
      if (expected.outcome !== 'discarded') {
        const retry = await proveAdminRetry(
          page,
          scenario,
          scenarioName,
          'Reintentar descarte',
          expected.outcome,
          'data-discard-attempts',
          'discard',
          'Descartando borrador…',
        );
        inspection = await inspectInteractiveState(scenario, `${scenarioName}-retry-${width}`);
        assertAdminInspection(
          `${scenarioName}-retry-${width}`,
          inspection,
          expected.outcome,
          expected.text,
        );
        interactions.push({ name: 'admin-discard-retry', width, scenarioName, ...retry });
      }
    }

    await page.screenshot({
      path: path.join(screenshotDir, `admin-conditional-${width}x${height}.png`),
      fullPage: true,
    });
    await page.waitForTimeout(50);
    assert(
      health.events.length === 0,
      `admin state runtime/network errors at ${width}`,
      health.events,
    );
    interactions.push({
      name: 'admin-conditional-states',
      width,
      runtimeEvents: [...health.events],
    });
    health.detach();
    await context.close();
  }
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
  let expected404Path = null;
  const health = monitorPage(
    page,
    'browser-404',
    (response) =>
      response.status() === 404 &&
      response.request().resourceType() === 'document' &&
      new URL(response.url()).pathname === expected404Path,
  );
  for (const route of invalidRoutes) {
    expected404Path = route;
    health.reset();
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
    const visible = await page.getByText('No encontramos eso').isVisible();
    assert(response?.status() === 404 && visible, `browser 404 failed for ${route}`, {
      status: response?.status(),
      visible,
    });
    await page.waitForTimeout(50);
    const expectedConsoleErrors = health.events.filter(
      (event) =>
        event.type === 'console.error' &&
        event.text ===
          'Failed to load resource: the server responded with a status of 404 (Not Found)',
    );
    const unexpectedEvents = health.events.filter(
      (event) => !expectedConsoleErrors.includes(event),
    );
    assert(
      unexpectedEvents.length === 0,
      `browser 404 runtime/network errors for ${route}`,
      unexpectedEvents,
    );
    interactions.push({
      name: 'browser-404',
      route,
      status: response?.status(),
      visible,
      expectedConsoleErrors: expectedConsoleErrors.length,
    });
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
  const memberRoute = '/leaderboard/emiliano-pasos/provenance';
  const memberHealth = monitorPage(
    memberPage,
    'member-other-provenance',
    (response) =>
      response.status() === 404 &&
      response.request().resourceType() === 'document' &&
      new URL(response.url()).pathname === memberRoute,
  );
  const other = await memberPage.goto(`${baseUrl}${memberRoute}`, {
    waitUntil: 'networkidle',
  });
  assert(
    other?.status() === 404,
    'member-other provenance must not expose line detail',
    other?.status(),
  );
  await memberPage.waitForTimeout(50);
  const expectedMemberConsoleErrors = memberHealth.events.filter(
    (event) =>
      event.type === 'console.error' &&
      event.text ===
        'Failed to load resource: the server responded with a status of 404 (Not Found)',
  );
  const unexpectedMemberEvents = memberHealth.events.filter(
    (event) => !expectedMemberConsoleErrors.includes(event),
  );
  assert(
    unexpectedMemberEvents.length === 0,
    'member-other provenance runtime/network errors',
    unexpectedMemberEvents,
  );
  interactions.push({
    name: 'member-other-provenance',
    status: other?.status(),
    expectedConsoleErrors: expectedMemberConsoleErrors.length,
  });
  memberHealth.detach();
  health.detach();
  await member.close();
  await context.close();
}

const browser = await chromium.launch({ headless: true, executablePath });
let fatalError = null;
try {
  await matrix(browser);
  await runInteractions(browser);
  await runAdminAcceptance(browser);
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
