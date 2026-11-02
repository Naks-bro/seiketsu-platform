"use strict";
// Records a short walkthrough of the Seiketsu ordering flow.
// Usage: node scripts/demo-video.cjs   (dev server must be running on :3000)
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE = process.env.QA_BASE_URL || "http://localhost:3000";
const OUT_DIR = path.join(__dirname, "..", "demo");
const OUT = path.join(OUT_DIR, "seiketsu-walkthrough.webm");

async function overlays(page) {
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((n) => n.remove()); // hide dev badge
    if (!document.getElementById("demo-cursor")) {
      const c = document.createElement("div");
      c.id = "demo-cursor";
      c.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M5 3L19 12L12 13L9 20L5 3Z" fill="white" stroke="black" stroke-width="1.5" stroke-linejoin="round"/></svg>';
      c.style.cssText = "position:fixed;z-index:999999;pointer-events:none;width:24px;height:24px;left:640px;top:360px;transition:left .1s,top .1s;filter:drop-shadow(1px 1px 2px rgba(0,0,0,.3))";
      document.body.appendChild(c);
      document.addEventListener("mousemove", (e) => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; });
    }
    if (!document.getElementById("demo-subtitle")) {
      const b = document.createElement("div");
      b.id = "demo-subtitle";
      b.style.cssText = "position:fixed;bottom:0;left:0;right:0;z-index:999998;text-align:center;padding:12px 24px;background:rgba(42,24,30,.85);color:#fffcf5;font:500 17px -apple-system,'Segoe UI',sans-serif;transition:opacity .3s;pointer-events:none;opacity:0";
      document.body.appendChild(b);
    }
  });
}

async function say(page, text) {
  await page.evaluate((t) => {
    const b = document.getElementById("demo-subtitle");
    if (!b) return;
    b.textContent = t || "";
    b.style.opacity = t ? "1" : "0";
  }, text);
  if (text) await page.waitForTimeout(900);
}

async function go(page, url, wait = 2500) {
  await page.goto(BASE + url, { waitUntil: "networkidle" });
  await overlays(page);
  await page.waitForTimeout(wait);
}

async function click(page, selector, label, after = 900) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: "visible", timeout: 15000 }).catch(() => {
    throw new Error(`Not visible: ${label} (${selector})`);
  });
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  const box = await el.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
    await page.waitForTimeout(350);
  }
  await el.click();
  await page.waitForTimeout(after);
}

async function type(page, selector, text, label) {
  await click(page, selector, label, 200);
  await page.locator(selector).first().fill("");
  await page.locator(selector).first().pressSequentially(text, { delay: 35 });
  await page.waitForTimeout(400);
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  let failed = null;
  try {
    // 1. Homepage
    await go(page, "/", 1200);
    await say(page, "Seiketsu: the customer website");
    await page.mouse.move(400, 420, { steps: 15 });
    await page.waitForTimeout(1500);
    await click(page, 'a:has-text("Order now")', "Order now", 1500);
    await overlays(page);

    // 2. Menu
    await say(page, "Browse the menu: categories, search and diet filters");
    await type(page, 'input[type="search"]', "protein", "Search box");
    await page.waitForTimeout(1200);
    await say(page, "Tap a dish to choose size or protein, extras and see nutrition");
    await click(page, 'button:has-text("Herbed Paneer / Chicken Protein Salad Bowl")', "Dish card", 1500);
    await click(page, '[role="dialog"] label:has-text("Chicken")', "Chicken option", 1200);
    await say(page, "Nutrition updates for the option you pick");
    await page.waitForTimeout(800);
    await click(page, '[role="dialog"] label:has-text("Avocado")', "Avocado extra", 600);
    await click(page, '[role="dialog"] label:has-text("Feta Cheese")', "Feta extra", 600);
    await type(page, '[role="dialog"] textarea', "Dressing on the side", "Instructions");
    await click(page, '[role="dialog"] button[aria-label="Increase quantity"]', "Quantity +", 800);
    await click(page, '[role="dialog"] button:has-text("Add to order")', "Add to order", 1800);

    // 3. Cart -> checkout
    await say(page, "The cart keeps your order, even if you refresh");
    await page.waitForTimeout(800);
    await click(page, '[role="dialog"] a:has-text("Checkout")', "Checkout link", 1500);
    await overlays(page);
    await say(page, "Checkout: details, pickup or delivery, notes");
    await type(page, "#name", "Asha Kapoor", "Name");
    await type(page, "#phone", "98765 43210", "Phone");
    await type(page, "#notes", "No onions please", "Notes");
    await click(page, 'button:has-text("Pay ₹")', "Pay button", 1500);

    // 4. Payment (simulator stands in for Razorpay locally)
    await say(page, "Payment window (Razorpay in production; simulator in this demo)");
    await page.waitForTimeout(800);
    await click(page, 'button:has-text("Pay successfully")', "Pay successfully", 500);
    await page.waitForURL(/\/order\//, { timeout: 20000 });
    await overlays(page);
    await page.getByText("Thank you", { exact: false }).waitFor({ timeout: 15000 });
    await say(page, "Order confirmed: live tracking page with order number");
    await page.waitForTimeout(2500);
    const trackingUrl = page.url().replace(BASE, "");
    const orderNo = (await page.locator("text=/SK-\\d+/").first().textContent()).match(/SK-\d+/)[0];
    console.log("Order", orderNo);

    // 5. Admin
    await go(page, "/admin/login", 800);
    await say(page, "Staff side: sign in to the admin");
    await type(page, 'input[name="email"]', "owner@seiketsu.local", "Email");
    await type(page, 'input[name="password"]', "seiketsu-local-dev-2026", "Password");
    await click(page, 'button:has-text("Sign in")', "Sign in", 2000);
    await page.waitForURL(/\/admin\/orders/, { timeout: 20000 });
    await overlays(page);
    await say(page, "New paid orders arrive on the live board");
    await page.waitForTimeout(1800);
    const card = `li:has(a:text-is("${orderNo}"))`;
    await click(page, `${card} button:has-text("Accept")`, "Accept", 600);
    await page.locator(`${card} button:has-text("Start preparing")`).waitFor({ timeout: 15000 });
    await overlays(page);
    await page.waitForTimeout(1200);
    await say(page, "Move each order through: accept, prepare, ready, complete");
    await click(page, `${card} button:has-text("Start preparing")`, "Start preparing", 600);
    await page.locator(`${card} button:has-text("Mark ready")`).waitFor({ timeout: 15000 });
    await overlays(page);
    await page.waitForTimeout(1500);

    // 6. Back to customer view
    await go(page, trackingUrl, 800);
    await say(page, "The customer sees every step update automatically");
    await page.waitForTimeout(3000);
    await say(page, "Seiketsu: the art of clean eating");
    await page.waitForTimeout(2000);
  } catch (err) {
    failed = err;
    console.error("DEMO ERROR:", err.message.split("\n")[0], "at", page.url());
    await page.screenshot({ path: path.join(OUT_DIR, "error.png") }).catch(() => {});
  } finally {
    const video = page.video();
    await context.close();
    if (video) {
      fs.copyFileSync(await video.path(), OUT);
      fs.rmSync(await video.path());
      console.log("Video saved:", OUT);
    }
    await browser.close();
    if (failed) process.exitCode = 1;
  }
})();