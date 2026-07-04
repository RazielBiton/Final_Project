const puppeteer = require('puppeteer');

(async () => {
    console.log("Launching browser...");
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', error => console.error('BROWSER ERROR:', error.message));
    page.on('response', response => {
        if (response.url().includes('/api/chat')) {
            console.log('API CHAT RESPONSE STATUS:', response.status());
        }
    });

    console.log("Navigating to index.html...");
    await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle2' });

    console.log("Opening chat widget...");
    await page.click('#chatWidgetBtn');
    
    // Wait for chat to open
    await new Promise(r => setTimeout(r, 1000));
    
    console.log("Typing message...");
    await page.type('#userInput', 'מתי הטסט הבא שלי ומה צריך להכין?');
    
    console.log("Clicking send...");
    await page.click('#sendBtn');

    console.log("Waiting for response...");
    
    // wait for typing indicator to disappear
    try {
        await page.waitForFunction(() => {
            const typing = document.getElementById('typing');
            return typing && typing.style.display === 'none';
        }, { timeout: 15000 });
        console.log("Response received!");
    } catch (e) {
        console.log("Timeout waiting for response. Still typing...");
    }

    await browser.close();
    console.log("Browser closed.");
})();
