const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
    page.on('response', response => {
        if ([301, 302, 303, 307, 308].includes(response.status())) {
            console.log(`REDIRECT: ${response.url()} -> ${response.headers().location}`);
        }
    });
    page.on('framenavigated', frame => {
        if (frame === page.mainFrame()) {
            console.log('NAVIGATED TO:', frame.url());
        }
    });

    console.log('Navigating to index...');
    await page.goto('http://localhost:64144/');

    // Login only if needed
    try {
        await page.waitForSelector('#login-email', { timeout: 2000 });
        console.log('Logging in...');
        await page.fill('#login-email', 'test@test.com');
        await page.fill('#login-password', 'password123');
        await page.click('#login-btn');
    } catch (e) {
        console.log('Already logged in or login bypassed');
    }

    // Wait for dashboard to settle
    await page.waitForTimeout(1000);
    console.log('Current page:', page.url());

    if (page.url().includes('index.html')) {
        console.log('Looks like it stayed on index. Manual navigate to Dashboard');
        await page.goto('http://localhost:64144/dashboard.html');
        await page.waitForTimeout(1000);
    }

    // Click New Project
    console.log('Clicking New Project...');
    const newProjLink = await page.$('a[href="create-step2.html"]');
    if (newProjLink) {
        await newProjLink.click();
    } else {
        console.log('New Project link not found! Trying to navigate manually');
        await page.goto('http://localhost:64144/create-step2.html');
    }

    await page.waitForTimeout(1000);
    console.log('On page:', page.url());

    // Fill form
    console.log('Filling form...');
    await page.waitForSelector('#company-name');
    await page.fill('#company-name', 'Playwright Test Co');

    console.log('Clicking Next: Styling...');
    // Intercept before click
    await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNavigation({ waitUntil: 'networkidle', timeout: 5000 }).catch(e => console.log('Navigation timeout:', e.message))
    ]);

    console.log('After submit, on page:', page.url());
    await browser.close();
})();
