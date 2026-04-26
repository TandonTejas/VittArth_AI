import { test, expect } from '@playwright/test';

test.describe.serial('FinGuard AI End-to-End', () => {
  let page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('complete onboarding flow', async () => {
    // Navigate to the app
    await page.goto('http://localhost:5173/');

    // Assert we are redirected to /onboarding
    await expect(page).toHaveURL(/.*\/onboarding/);

    // Fill out the onboarding form
    await page.fill('input[placeholder="e.g. 50000"]', '60000'); // Monthly Income
    await page.fill('input[placeholder="15000"]', '15000'); // Rent
    await page.fill('input[placeholder="1500"]', '2000'); // Subscriptions
    await page.fill('input[placeholder="2000"]', '3000'); // Other Fixed
    await page.fill('input[placeholder="500"]', '800'); // Daily Target
    await page.fill('input[placeholder="25000"]', '20000'); // Current Balance
    await page.selectOption('select', 'Early-Career'); // User Profile

    await page.click('button:has-text("Next")');

    // Wait for step 2 (Upload Bank Statement)
    await page.waitForSelector('h2:has-text("Upload Bank Statement")', { state: 'visible' });

    // Select CSV file using real JS File object to bypass Playwright File sandboxing issues
    await page.evaluate(() => {
      const csvContent = "Date,Amount,Payee,TransactionType\n2025-01-01,100,Zomato,Debit\n2025-01-02,50,Uber,Debit\n";
      const file = new File([csvContent], "sample_transactions.csv", { type: "text/csv" });
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.getElementById('csv-input');
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Click Analyze
    await page.click('button:has-text("Analyze My Spending")');

    // Wait for success screen OR error using waitForSelector
    try {
      await page.waitForSelector('h2:has-text("Analysis Complete")', { state: 'visible', timeout: 15000 });
    } catch (e) {
      // Check if there's an error alert visible
      const errBox = page.locator('div', { hasText: 'Error:' }).first();
      if (await errBox.isVisible()) {
        console.log('UI ERROR BOX:', await errBox.innerText());
      } else {
        console.log('NO ERROR BOX FOUND');
      }
      throw e;
    }

    // Go to Dashboard — button text must match Onboarding.jsx exactly
    await page.click('button:has-text("Go to Dashboard")');

    // Assert redirected to /dashboard
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Assert "Survival Days" metric is visible and > 0
    const survivalCard = page.locator('div', { hasText: 'SURVIVAL DAYS' }).nth(1);
    await expect(survivalCard).toBeVisible();
    const survivalText = await survivalCard.innerText();
    expect(survivalText).toMatch(/\d+(\.\d+)? days/);
  });

  test('transaction simulator AVOID decision', async () => {
    // Click Simulate in the sidebar to preserve React context
    await page.locator('aside').locator('a', { hasText: 'Simulate' }).click();
    await expect(page).toHaveURL(/.*\/simulate/);

    // Enter amount=800, payee="Zomato", hour=23
    await page.fill('input[type="number"]', '800');
    await page.fill('input[placeholder*="Zomato"]', 'Zomato');
    await page.fill('input[type="range"]', '23');
    // Ensure the hour updates state (range input sometimes needs dispatchEvent)
    await page.$eval('input[type="range"]', e => { e.value = '23'; e.dispatchEvent(new Event('change', { bubbles: true })); e.dispatchEvent(new Event('input', { bubbles: true })); });

    // Click Evaluate
    await page.click('button:has-text("Evaluate Transaction")');

    // Assert DecisionCard is visible and shows AVOID or PAUSE
    const decisionHeading = page.locator('h2', { hasText: /Hold on|Don't do it/ });
    await expect(decisionHeading).toBeVisible();

    // Assert nudge text is non-empty
    const nudgeText = await page.locator('p', { hasText: /.+/ }).first().innerText();
    expect(nudgeText.length).toBeGreaterThan(0);
  });

  test('cancel transaction does not change balance', async () => {
    // Record balance before (navigate to dashboard via sidebar)
    await page.locator('aside').locator('a', { hasText: 'Dashboard' }).click();
    await expect(page.locator('text="Loading dashboard"')).toBeHidden();
    
    // Exact match for the CURRENT BALANCE label, then get its next sibling (the value)
    const balanceLabel = page.locator('div', { hasText: /^CURRENT BALANCE$/ }).first();
    await expect(balanceLabel).toBeVisible();
    const balanceBefore = await balanceLabel.evaluate(el => el.nextElementSibling.textContent);

    // Evaluate a transaction (navigate to simulate via sidebar)
    await page.locator('aside').locator('a', { hasText: 'Simulate' }).click();
    await page.fill('input[type="number"]', '500');
    await page.fill('input[placeholder*="Zomato"]', 'Grocery');
    await page.click('button:has-text("Evaluate Transaction")');

    // Wait for decision
    await expect(page.locator('h2')).not.toHaveText('Transaction Details');

    // Click Cancel
    await page.click('button:has-text("cancel")');

    // Check balance in sidebar
    await expect(page.locator('aside')).toBeVisible();
    const sidebarBalance = await page.locator('aside').locator('div', { hasText: /^₹[\d,]+$/ }).first().innerText();
    expect(balanceBefore).toEqual(sidebarBalance);
  });

  test('risk tier banner changes color', async () => {
    // Ensure we start safe (navigate to dashboard via sidebar)
    await page.locator('aside').locator('a', { hasText: 'Dashboard' }).click();
    // Simulate multiple large transactions to drop balance
    await page.locator('aside').locator('a', { hasText: 'Simulate' }).click();

    for (let i = 0; i < 3; i++) {
        await page.fill('input[type="number"]', '8000');
        await page.fill('input[placeholder*="Zomato"]', 'Huge Expense');
        await page.click('button:has-text("Evaluate Transaction")');
        
        await expect(page.locator('h2', { hasText: /Hold on|Don't do it/ })).toBeVisible();
        
        // Proceed anyway or Override
        const proceedBtn = page.locator('button:has-text("Proceed Anyway"), button:has-text("Override")');
        await proceedBtn.click();
        
        // Handle confirm modal if present
        const yesBtn = page.locator('button:has-text("Yes, proceed")');
        if (await yesBtn.isVisible()) {
            await yesBtn.click();
        }
        
        await expect(page.locator('div:has-text("Transaction recorded")').last()).toBeVisible();
        // Wait for it to disappear
        await page.waitForTimeout(2500);
    }

    // Check risk banner
    const banner = page.locator('main').locator('..').locator('> div').first(); // The banner above main
    await expect(banner).toBeVisible();
    const bannerText = await banner.innerText();
    expect(bannerText).toMatch(/(Emergency mode|Watch your spending)/);
  });

  test('emergency planner shows when risk is high', async () => {
    // We are already in High/Medium risk from previous test
    await page.locator('aside').locator('a', { hasText: 'Emergency' }).click();
    await expect(page).toHaveURL(/.*\/emergency/);
    
    // Assert BudgetDonutChart or CrisisChecklist is visible
    // "TOTAL" is inside BudgetDonutChart, or "Crisis Mode"
    const heading = await page.locator('h1').innerText();
    expect(heading).toMatch(/(Emergency Budget Mode|Crisis Mode)/);
  });
});
