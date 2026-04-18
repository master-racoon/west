import { expect, test } from "@playwright/test";

function uniqueName(prefix: string) {
  return `${prefix} ${Date.now()}`;
}

async function loginAsOwner(page: Parameters<typeof test>[0]["page"]) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Login as owner" }).click();
  await expect(
    page.getByText(
      "The shared owner login is for administration only. Inventory movements require a personal user account signed in with your own PIN.",
    ),
  ).toBeVisible();
  await page
    .getByPlaceholder("Password")
    .fill(process.env["PLAYWRIGHT_OWNER_PASSWORD"] ?? "warehouse1");
  await page.getByRole("button", { name: "Login" }).click();
}

async function logout(page: Parameters<typeof test>[0]["page"]) {
  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });

  await page.getByRole("button", { name: /owner|user/ }).click();
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(
    page.getByRole("heading", { name: "Warehouse Login" }),
  ).toBeVisible();
}

test.describe("PIN users", () => {
  test("owner can create a user and that user can sign in without access to Users", async ({
    page,
  }) => {
    const aliceName = uniqueName("Alice");

    await loginAsOwner(page);
    await page.getByRole("link", { name: "Users" }).click();
    await page.getByRole("button", { name: "Add User" }).click();
    await page.getByPlaceholder("Name").fill(aliceName);
    await page.getByPlaceholder("4-digit PIN").fill("1234");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText(aliceName)).toBeVisible();

    await logout(page);

    await page.getByRole("combobox").selectOption({ label: aliceName });
    await page.getByPlaceholder("4-digit PIN").fill("1234");
    await page.getByRole("button", { name: "Login" }).click();

    await expect(page.getByRole("button", { name: "user" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);
  });

  test("shared owner sessions are blocked from inventory movement flows", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.getByRole("link", { name: "Inventory" }).click();
    await expect(
      page.getByText(
        "Inventory movements require a personal user account. Sign out of the owner account and sign in with your own PIN.",
      ),
    ).toBeVisible();
  });
});
