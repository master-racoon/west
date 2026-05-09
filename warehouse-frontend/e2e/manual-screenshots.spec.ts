/**
 * Manual page screenshot capture.
 * Logs in as owner and visits every major page/tab, saving screenshots to docs/manual/screenshots/.
 * Run with: npx playwright test e2e/manual-screenshots.spec.ts --project=chromium
 */
import { test, expect, Page } from "@playwright/test";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUT_DIR = path.resolve(__dirname, "../../docs/manual/screenshots");

const MANUAL_USER_NAME = "Manual Demo User";
const MANUAL_USER_PIN = "9876";

async function shot(page: Page, name: string) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  // Wait for any success/error toast to vanish before capturing
  await page
    .waitForSelector("[data-sonner-toast]", { state: "hidden", timeout: 8000 })
    .catch(() => {});
  await page.screenshot({
    path: path.join(OUT_DIR, `${name}.png`),
    fullPage: false,
  });
}

async function loginAsOwner(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Login as owner" }).click();
  await page
    .getByPlaceholder("Password")
    .fill(process.env["PLAYWRIGHT_OWNER_PASSWORD"] ?? "warehouse1");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page.getByRole("button", { name: "owner" })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

async function logout(page: Page) {
  page.once("dialog", async (dialog) => dialog.accept());
  await page.getByRole("button", { name: /owner|user/i }).click();
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(
    page.getByRole("heading", { name: "Warehouse Login" }),
  ).toBeVisible();
}

async function ensureManualUserExists(page: Page) {
  await loginAsOwner(page);
  await page.goto("/dashboard/users");
  await page.waitForLoadState("networkidle");
  // Check if demo user already exists
  if (await page.getByText(MANUAL_USER_NAME).isVisible()) return;
  await page.getByRole("button", { name: "Add User" }).click();
  await page.getByPlaceholder("Name").fill(MANUAL_USER_NAME);
  await page.getByPlaceholder("4-digit PIN").fill(MANUAL_USER_PIN);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByText(MANUAL_USER_NAME)).toBeVisible();
}

async function loginAsManualUser(page: Page) {
  await page.goto("/login");
  await page.getByRole("combobox").selectOption({ label: MANUAL_USER_NAME });
  await page.getByPlaceholder("4-digit PIN").fill(MANUAL_USER_PIN);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page.getByRole("button", { name: "user" })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

test.describe.serial("Manual screenshots", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await ensureManualUserExists(page);
    await page.close();
  });

  test("01 – Login page", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Warehouse Login" }),
    ).toBeVisible();
    await shot(page, "01-login");
  });

  test("02 – Login as owner (PIN mode shown)", async ({ page }) => {
    await page.goto("/login");
    // Show the owner panel
    await page.getByRole("button", { name: "Login as owner" }).click();
    await shot(page, "02-login-owner-panel");
  });

  test("03 – Configuration (owner dashboard)", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/dashboard/configuration");
    await page.waitForLoadState("networkidle");
    await shot(page, "03-configuration");
  });

  test("04 – Products page", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/dashboard/products");
    await page.waitForLoadState("networkidle");
    await shot(page, "04-products");
  });

  test("05 – Bulk upload products", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/dashboard/bulk-upload-products");
    await page.waitForLoadState("networkidle");
    await shot(page, "05-bulk-upload-products");
  });

  test("06 – Bulk upload balance", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/dashboard/bulk-upload-balance");
    await page.waitForLoadState("networkidle");
    await shot(page, "06-bulk-upload-balance");
  });

  test("07 – Users page", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/dashboard/users");
    await page.waitForLoadState("networkidle");
    await shot(page, "07-users");
  });

  test("08 – Owner notice on inventory page", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/dashboard/inventory/add");
    await page.waitForLoadState("networkidle");
    await shot(page, "08-inventory-owner-notice");
  });

  test("09 – Inventory / Add Stock (user view)", async ({ page }) => {
    await loginAsManualUser(page);
    await page.goto("/dashboard/inventory/add");
    await page.waitForLoadState("networkidle");
    await shot(page, "09-inventory-add");
  });

  test("10 – Inventory / Remove Stock tab", async ({ page }) => {
    await loginAsManualUser(page);
    await page.goto("/dashboard/inventory/remove");
    await page.waitForLoadState("networkidle");
    await shot(page, "10-inventory-remove");
  });

  test("11 – Inventory / Transfer tab", async ({ page }) => {
    await loginAsManualUser(page);
    await page.goto("/dashboard/inventory/transfer");
    await page.waitForLoadState("networkidle");
    await shot(page, "11-inventory-transfer");
  });

  test("12 – Inventory / Quick Count tab", async ({ page }) => {
    await loginAsManualUser(page);
    await page.goto("/dashboard/inventory/quickcount");
    await page.waitForLoadState("networkidle");
    await shot(page, "12-inventory-quickcount");
  });

  test("13 – Inventory Visibility search", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/dashboard/inventory-visibility");
    await page.waitForLoadState("networkidle");
    await shot(page, "13-inventory-visibility");
  });

  test("14 – Current Balance", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/dashboard/current-balance");
    await page.waitForLoadState("networkidle");
    await shot(page, "14-current-balance");
  });

  test("15 – Create Movement", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/dashboard/create-movement");
    await page.waitForLoadState("networkidle");
    await shot(page, "15-create-movement");
  });

  test("16 – Side menu visible (full layout)", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/dashboard/configuration");
    await page.waitForLoadState("networkidle");
    // Ensure side menu is in view
    await shot(page, "16-app-layout-side-menu");
  });
});
