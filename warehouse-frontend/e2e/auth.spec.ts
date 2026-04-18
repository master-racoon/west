import { expect, test } from "@playwright/test";

async function loginAsOwner(page: Parameters<typeof test>[0]["page"]) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Login as owner" }).click();
  await page.getByPlaceholder("Password").fill(process.env["PLAYWRIGHT_OWNER_PASSWORD"] ?? "warehouse1");
  await page.getByRole("button", { name: "Login" }).click();
}

async function logout(page: Parameters<typeof test>[0]["page"]) {
  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  await page.getByRole("button", { name: /owner|user/ }).click();
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page.getByRole("heading", { name: "Warehouse Login" })).toBeVisible();
}

test.describe("Auth flow", () => {
  test("owner can login with valid password and see dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Login as owner" }).click();
    await page.getByPlaceholder("Password").fill(process.env["PLAYWRIGHT_OWNER_PASSWORD"] ?? "warehouse1");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page.getByRole("button", { name: "owner" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Configuration" })).toBeVisible();
  });

  test("invalid owner password shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Login as owner" }).click();
    await page.getByPlaceholder("Password").fill("wrongpassword");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page.getByText(/Incorrect/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Warehouse Login" })).toBeVisible();
  });

  test("unauthenticated user is redirected to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Warehouse Login" })).toBeVisible();
  });

  test("session persists after page reload", async ({ page }) => {
    await loginAsOwner(page);
    await expect(page.getByRole("button", { name: "owner" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "owner" })).toBeVisible();
  });

  test("logout clears session and redirects to login", async ({ page }) => {
    await loginAsOwner(page);
    await logout(page);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Warehouse Login" })).toBeVisible();
  });
});
