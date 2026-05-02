/**
 * UX Inspection Spec — Full app heuristic check (desktop + mobile)
 *
 * Covers Nielsen's 10 heuristics as observable browser behaviour:
 *  H1  Visibility of system status (loading states, active nav, disabled buttons)
 *  H2  Match between system and real world (labels, button text)
 *  H3  User control and freedom (back, cancel, logout confirm)
 *  H4  Consistency and standards (same button styles, heading hierarchy)
 *  H5  Error prevention (required fields, disabled submit before resolve)
 *  H6  Recognition rather than recall (placeholders, helper text)
 *  H7  Flexibility and efficiency (scan shortcut, keyboard submit)
 *  H8  Aesthetic and minimalist design (no clutter, no orphaned content)
 *  H9  Help users recognise/recover from errors (error messages visible)
 *  H10 Help and documentation (form hints)
 *
 * Mobile breakpoint tested: 390×844 (iPhone 14 Pro)
 * Known UX failures documented as failing assertions (not skipped).
 */

import { test, expect, type Page } from "@playwright/test";

const OWNER_PASSWORD = process.env["PLAYWRIGHT_OWNER_PASSWORD"] ?? "warehouse1";

function uniqueName(prefix: string) {
  return `${prefix} ${Date.now()}`;
}

// ─── helpers ────────────────────────────────────────────────────────────────

async function loginAsOwner(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Login as owner" }).click();
  await page.getByPlaceholder("Password").fill(OWNER_PASSWORD);
  // exact: true prevents matching "Back to PIN login" via substring
  await page.getByRole("button", { name: "Login", exact: true }).click();
  // Owner is auto-redirected to /dashboard/configuration — wait for it
  await expect(page.getByRole("button", { name: "owner" })).toBeVisible({
    timeout: 15000,
  });
}

async function logout(page: Page) {
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /owner|user/ }).click();
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(
    page.getByRole("heading", { name: "Warehouse Login" }),
  ).toBeVisible();
}

/**
 * Create a fresh user as owner, log out, log in as that user.
 * Returns the created user name so tests can clean up if needed.
 */
async function loginAsNewUser(page: Page): Promise<string> {
  const userName = uniqueName("UXUser");
  await loginAsOwner(page);
  await page.goto("/dashboard/users");
  await page.getByRole("button", { name: "Add User" }).click();
  await page.getByPlaceholder("Name").fill(userName);
  await page.getByPlaceholder("4-digit PIN").fill("1234");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByText(userName)).toBeVisible();
  await logout(page);
  await page.getByRole("combobox").selectOption({ label: userName });
  await page.getByPlaceholder("4-digit PIN").fill("1234");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  // Regular user redirects to /dashboard/products which is currently buggy.
  // Escape to a stable page before it fully renders.
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  await page.goto("/dashboard/inventory/add");
  await expect(page.getByRole("button", { name: "user" })).toBeVisible({
    timeout: 10000,
  });
  return userName;
}

// ─── Login Page ─────────────────────────────────────────────────────────────

test.describe("Login page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("H1 – page has a visible heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Warehouse Login" }),
    ).toBeVisible();
  });

  test("H4 – Login button is a real button element", async ({ page }) => {
    const loginBtn = page.getByRole("button", { name: "Login", exact: true });
    await expect(loginBtn).toBeVisible();
  });

  test("H4 – Login as owner is a real button element", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: "Login as owner" }),
    ).toBeVisible();
  });

  test("H6 – PIN input has visible placeholder text", async ({ page }) => {
    await expect(page.getByPlaceholder("4-digit PIN")).toBeVisible();
  });

  test("H5 – PIN field is disabled until a user is selected", async ({
    page,
  }) => {
    // Until a user is chosen from the combobox, the PIN input should be disabled
    // (error prevention: can't submit by accident)
    // NOTE: currently the PIN input is NOT disabled before a user is chosen —
    // this is a known UX gap documented by this failing assertion.
    const combobox = page.getByRole("combobox");
    await expect(combobox).toBeVisible();
    const pinInput = page.getByPlaceholder("4-digit PIN");
    await expect(pinInput).toBeDisabled(); // intentionally fails — UX issue
  });

  test("H9 – invalid owner password shows an error message on the page", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Login as owner" }).click();
    await page.getByPlaceholder("Password").fill("wrongpassword");
    await page.getByRole("button", { name: "Login", exact: true }).click();
    // Error message must be visible inline on the page (not just a console log)
    await expect(page.getByText(/incorrect|invalid|error/i)).toBeVisible();
  });

  test("H9 – invalid PIN shows an error message", async ({ page }) => {
    // Need a valid user in the dropdown — pick the first non-placeholder option
    const combobox = page.getByRole("combobox");
    await combobox.selectOption({ index: 1 }); // first real user
    await page.getByPlaceholder("4-digit PIN").fill("0000");
    await page.getByRole("button", { name: "Login", exact: true }).click();
    // Error message must appear inline
    await expect(
      page.getByText(/invalid|incorrect|wrong|error/i),
    ).toBeVisible();
  });

  test("H3 – Back to PIN login button is visible on owner form", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Login as owner" }).click();
    await expect(
      page.getByRole("button", { name: /back to pin/i }),
    ).toBeVisible();
  });

  // Mobile: login form usable at 390px
  test("H8 – login form is usable at 390px (mobile)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByRole("heading", { name: "Warehouse Login" }),
    ).toBeVisible();
    const combobox = page.getByRole("combobox");
    await expect(combobox).toBeVisible();
    // Check combobox is not overflowing outside viewport (right edge check)
    const box = await combobox.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  });
});

// ─── App Shell ──────────────────────────────────────────────────────────────

test.describe("App shell — owner", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
  });

  test("H1 – active nav item is visually highlighted", async ({ page }) => {
    await page.goto("/dashboard/configuration");
    const configLink = page.getByRole("link", { name: "Configuration" });
    // Active link should have blue colour (not the generic gray)
    const color = await configLink.evaluate((el) => getComputedStyle(el).color);
    // rgb(26,115,232) is the #1a73e8 blue used for active items
    expect(color).toMatch(/26|115|232/); // contains blue channel values
  });

  test("H1 – user identity is always visible in header", async ({ page }) => {
    await expect(page.getByRole("button", { name: "owner" })).toBeVisible();
  });

  test("H4 – owner can see Users and Configuration in nav", async ({
    page,
  }) => {
    await expect(page.getByRole("link", { name: "Users" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Configuration" }),
    ).toBeVisible();
  });

  test("H3 – logout requires confirmation", async ({ page }) => {
    await page.getByRole("button", { name: "owner" }).click();
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toMatch(/log out/i);
      await dialog.dismiss();
    });
    await page.getByRole("button", { name: "Logout" }).click();
    // After dismissing, should still be on dashboard
    await expect(page.getByRole("button", { name: "owner" })).toBeVisible();
  });

  // Mobile: sidebar must not crush content
  test("H8 – sidebar does not overflow main content area at 390px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard/configuration");
    const main = page.getByRole("main");
    const box = await main.boundingBox();
    expect(box).not.toBeNull();
    // The main content area must have at least 200px width to be usable
    expect(box!.width).toBeGreaterThan(200);
  });
});

test.describe("App shell — regular user", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsNewUser(page);
    await page.goto("/dashboard/inventory/add");
  });

  test("H4 – regular user does not see Users or Configuration links", async ({
    page,
  }) => {
    await expect(page.getByRole("link", { name: "Users" })).not.toBeVisible();
    await expect(
      page.getByRole("link", { name: "Configuration" }),
    ).not.toBeVisible();
  });

  test("H4 – regular user sees Products, Inventory, Inventory Visibility", async ({
    page,
  }) => {
    await expect(page.getByRole("link", { name: "Products" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Inventory" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Inventory Visibility" }),
    ).toBeVisible();
  });

  // Mobile: sidebar does not crush main content
  test("H8 – main content area has sufficient width at 390px (mobile)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard/inventory/add");
    const main = page.getByRole("main");
    await expect(main).toBeVisible();
    const box = await main.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(200);
  });
});

// ─── Configuration (warehouses) ─────────────────────────────────────────────

test.describe("Configuration page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/dashboard/configuration");
  });

  test("H1 – page has visible heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Create a New Warehouse" }),
    ).toBeVisible();
  });

  test("H6 – Warehouse Name input has visible label", async ({ page }) => {
    await expect(page.getByLabel("Warehouse Name")).toBeVisible();
  });

  test("H5 – Create Warehouse button present", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: "Create Warehouse" }),
    ).toBeVisible();
  });

  test("H4 – Warehouses list heading is visible", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Warehouses" }),
    ).toBeVisible();
  });
});

// ─── Products page ──────────────────────────────────────────────────────────

test.describe("Products page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/dashboard/products");
    await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
  });

  test("H1 – page heading is visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
  });

  test("H6 – product list search input has placeholder", async ({ page }) => {
    await expect(page.getByPlaceholder(/search products/i)).toBeVisible();
  });

  test("H5 – Create Product button is visible", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: "Create Product" }),
    ).toBeVisible();
  });

  test("H8 – products page usable at 390px mobile width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard/products");
    await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
    const heading = page.getByRole("heading", { name: "Products" });
    const box = await heading.boundingBox();
    expect(box).not.toBeNull();
    // Heading must be within viewport horizontally
    expect(box!.x + box!.width).toBeLessThanOrEqual(395);
  });
});

// ─── Inventory — Add Stock ───────────────────────────────────────────────────

test.describe("Inventory – Add Stock", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsNewUser(page);
    await page.goto("/dashboard/inventory/add");
    await expect(
      page.getByRole("heading", { name: "Inventory" }),
    ).toBeVisible();
  });

  test("H1 – Add tab shows as active", async ({ page }) => {
    const addTab = page.getByRole("link", { name: "Add" });
    const color = await addTab.evaluate((el) => getComputedStyle(el).color);
    expect(color).toMatch(/26|115|232/); // blue
  });

  test("H6 – warehouse selector has label", async ({ page }) => {
    await expect(page.getByLabel("Warehouse")).toBeVisible();
  });

  test("H6 – barcode input has placeholder text", async ({ page }) => {
    await expect(page.getByPlaceholder(/scan barcode/i)).toBeVisible();
  });

  test("H5 – Add Stock button is disabled before warehouse selected", async ({
    page,
  }) => {
    const addBtn = page.getByRole("button", { name: "Add Stock" });
    await expect(addBtn).toBeDisabled();
  });

  test("H7 – Scan button is visible for camera scan shortcut", async ({
    page,
  }) => {
    await expect(page.getByRole("button", { name: /scan/i })).toBeVisible();
  });

  test("H10 – helper text visible before barcode resolved", async ({
    page,
  }) => {
    await expect(page.getByText(/resolve a barcode/i)).toBeVisible();
  });
});

// ─── Inventory — Remove Stock ────────────────────────────────────────────────

test.describe("Inventory – Remove Stock", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsNewUser(page);
    await page.goto("/dashboard/inventory/remove");
    await expect(
      page.getByRole("heading", { name: "Inventory" }),
    ).toBeVisible();
  });

  test("H1 – Remove tab shows as active", async ({ page }) => {
    const removeTab = page.getByRole("link", { name: "Remove" });
    const color = await removeTab.evaluate((el) => getComputedStyle(el).color);
    expect(color).toMatch(/26|115|232/);
  });

  test("H5 – Remove Stock button disabled before warehouse selected", async ({
    page,
  }) => {
    const removeBtn = page.getByRole("button", { name: "Remove Stock" });
    await expect(removeBtn).toBeDisabled();
  });
});

// ─── Inventory — Transfer Stock ──────────────────────────────────────────────

test.describe("Inventory – Transfer Stock", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsNewUser(page);
    await page.goto("/dashboard/inventory/transfer");
    await expect(
      page.getByRole("heading", { name: "Inventory" }),
    ).toBeVisible();
  });

  test("H1 – Transfer tab shows as active", async ({ page }) => {
    const transferTab = page.getByRole("link", { name: "Transfer" });
    const color = await transferTab.evaluate(
      (el) => getComputedStyle(el).color,
    );
    expect(color).toMatch(/26|115|232/);
  });

  test("H2 – Source and Destination labels are visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Source" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Destination" }),
    ).toBeVisible();
  });
});

// ─── Inventory — Quick Count ─────────────────────────────────────────────────

test.describe("Inventory – Quick Count", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsNewUser(page);
    await page.goto("/dashboard/inventory/quickcount");
    await expect(
      page.getByRole("heading", { name: "Inventory" }),
    ).toBeVisible();
  });

  test("H1 – Quick Count tab shows as active", async ({ page }) => {
    const qcTab = page.getByRole("link", { name: "Quick Count" });
    const color = await qcTab.evaluate((el) => getComputedStyle(el).color);
    expect(color).toMatch(/26|115|232/);
  });

  test("H6 – Observed Quantity field is labelled", async ({ page }) => {
    await expect(page.getByLabel(/observed quantity/i)).toBeVisible();
  });
});

// ─── Inventory Visibility ────────────────────────────────────────────────────

test.describe("Inventory Visibility page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/dashboard/inventory-visibility");
    await expect(
      page.getByRole("heading", { name: "Inventory Explorer" }),
    ).toBeVisible();
  });

  test("H1 – page heading is visible", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Inventory Explorer" }),
    ).toBeVisible();
  });

  test("H6 – search input has placeholder", async ({ page }) => {
    await expect(page.getByPlaceholder(/search by name/i)).toBeVisible();
  });

  test("H8 – page usable at 390px mobile width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const heading = page.getByRole("heading", { name: "Inventory Explorer" });
    const box = await heading.boundingBox();
    expect(box).not.toBeNull();
    // Heading must start within viewport (not hidden behind sidebar)
    expect(box!.x).toBeLessThan(390);
    expect(box!.width).toBeGreaterThan(80);
  });
});

// ─── Users page (owner only) ─────────────────────────────────────────────────

test.describe("Users page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/dashboard/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  });

  test("H1 – users table is visible", async ({ page }) => {
    await expect(page.getByRole("table")).toBeVisible();
  });

  test("H4 – Add User button is visible", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Add User" })).toBeVisible();
  });

  test("H4 – Delete and Reset PIN actions are present per row", async ({
    page,
  }) => {
    // At least one row's Delete button should exist
    const deleteBtn = page.getByRole("button", { name: "Delete" }).first();
    await expect(deleteBtn).toBeVisible();
    const resetBtn = page.getByRole("button", { name: "Reset PIN" }).first();
    await expect(resetBtn).toBeVisible();
  });

  test("H4 – regular user cannot access Users page (role gate)", async ({
    page,
  }) => {
    // Log out and log in as regular user
    await page.getByRole("button", { name: "owner" }).click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Logout" }).click();
    await expect(
      page.getByRole("heading", { name: "Warehouse Login" }),
    ).toBeVisible();

    await loginAsNewUser(page);
    await page.goto("/dashboard/users");
    // Should redirect or show nothing meaningful (no Users heading)
    await expect(
      page.getByRole("heading", { name: "Users" }),
    ).not.toBeVisible();
  });
});

// ─── Owner blocked from Inventory movements ──────────────────────────────────

test.describe("Owner inventory gate", () => {
  test("H2 – owner sees informative message on Inventory page", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/dashboard/inventory");
    await expect(
      page.getByRole("heading", { name: "Inventory" }),
    ).toBeVisible();
    await expect(page.getByText(/personal user account/i)).toBeVisible();
  });
});
