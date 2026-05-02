import { expect, test } from "@playwright/test";

function uniqueName(prefix: string) {
  return `${prefix} ${Date.now()}`;
}

type Page = Parameters<typeof test>[0]["page"];

/**
 * Types a search query and waits for the search API response before returning.
 * Uses waitForResponse so tests are not sensitive to server response latency.
 */
async function searchInventory(page: Page, query: string) {
  // Set up the response listener BEFORE typing so we don't miss it
  const responsePromise = page.waitForResponse(
    (resp) => resp.url().includes("/api/items/search") && resp.status() === 200,
    { timeout: 15000 },
  );
  await page
    .getByPlaceholder(/search by name,.*barcode, or item id/i)
    .pressSequentially(query);
  await responsePromise;
}

async function loginAsOwner(page: Parameters<typeof test>[0]["page"]) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Login as owner" }).click();
  await page
    .getByPlaceholder("Password")
    .fill(process.env["PLAYWRIGHT_OWNER_PASSWORD"] ?? "warehouse1");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page.getByRole("button", { name: "owner" })).toBeVisible();
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

test.describe("Inventory Visibility", () => {
  test("shows prompt to start typing when search bar is empty", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/dashboard/inventory-visibility");
    await expect(
      page.getByText("Start typing to search for items"),
    ).toBeVisible();
  });

  test("shows no items found for unrecognised search term", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/dashboard/inventory-visibility");
    await searchInventory(page, "xyzNonExistentItem99999");
    await expect(page.getByText(/No items found/)).toBeVisible();
  });

  test("search by name finds item and navigates to item detail", async ({
    page,
  }) => {
    const itemName = uniqueName("InvTest");

    await loginAsOwner(page);
    // Create the item via Products page
    await page.goto("/dashboard/products");
    await page
      .getByPlaceholder("Protein powder, Tape roll, Cleaning spray")
      .fill(itemName);
    await page.getByRole("button", { name: "Create Product" }).click();
    await expect(page.getByText("Product created")).toBeVisible();

    // Navigate to inventory search
    await page.goto("/dashboard/inventory-visibility");
    await searchInventory(page, itemName);

    const resultButton = page.getByRole("button", {
      name: new RegExp(itemName),
    });
    await expect(resultButton).toBeVisible();
    await resultButton.click();

    // Should land on item detail page
    await expect(page.getByRole("heading", { name: itemName })).toBeVisible();
  });

  test("item detail availability tab shows no stock when no movements", async ({
    page,
  }) => {
    const itemName = uniqueName("NoStockItem");

    await loginAsOwner(page);
    await page.goto("/dashboard/products");
    await page
      .getByPlaceholder("Protein powder, Tape roll, Cleaning spray")
      .fill(itemName);
    await page.getByRole("button", { name: "Create Product" }).click();
    await expect(page.getByText("Product created")).toBeVisible();

    await page.goto("/dashboard/inventory-visibility");
    await searchInventory(page, itemName);

    const resultButton = page.getByRole("button", {
      name: new RegExp(itemName),
    });
    await expect(resultButton).toBeVisible();
    await resultButton.click();

    // Availability tab is shown by default
    await expect(
      page.getByRole("button", { name: "Availability" }),
    ).toBeVisible();
    await expect(page.getByText("No stock in any warehouse")).toBeVisible();
  });

  test("item detail movements tab shows no movements when history is empty", async ({
    page,
  }) => {
    const itemName = uniqueName("NoMovItem");

    await loginAsOwner(page);
    await page.goto("/dashboard/products");
    await page
      .getByPlaceholder("Protein powder, Tape roll, Cleaning spray")
      .fill(itemName);
    await page.getByRole("button", { name: "Create Product" }).click();
    await expect(page.getByText("Product created")).toBeVisible();

    await page.goto("/dashboard/inventory-visibility");
    await searchInventory(page, itemName);

    const resultButton = page.getByRole("button", {
      name: new RegExp(itemName),
    });
    await expect(resultButton).toBeVisible();
    await resultButton.click();

    await page.getByRole("button", { name: "Movement History" }).click();
    await expect(page.getByText("No movements recorded")).toBeVisible();
  });

  test("search by barcode finds item", async ({ page }) => {
    const itemName = uniqueName("BarcodeItem");
    const barcode = `BC${Date.now()}`;

    await loginAsOwner(page);
    await page.goto("/dashboard/products");
    await page
      .getByPlaceholder("Protein powder, Tape roll, Cleaning spray")
      .fill(itemName);
    await page.getByPlaceholder("Optional barcode").fill(barcode);
    await page.getByRole("button", { name: "Create Product" }).click();
    await expect(page.getByText("Product created")).toBeVisible();

    await page.goto("/dashboard/inventory-visibility");
    await searchInventory(page, barcode);

    await expect(
      page.getByRole("button", { name: new RegExp(itemName) }),
    ).toBeVisible();
  });

  test("item detail shows availability by warehouse and movement history after adding stock", async ({
    page,
  }) => {
    const itemName = uniqueName("StockedItem");
    const barcode = `STKBC${Date.now()}`;
    const warehouseName = uniqueName("InvWH");
    const userName = uniqueName("StockUser");

    await loginAsOwner(page);

    // Create warehouse
    await page.goto("/dashboard/configuration");
    await page
      .getByRole("textbox", { name: "Warehouse Name" })
      .fill(warehouseName);
    await page.getByRole("button", { name: "Create Warehouse" }).click();
    await expect(
      page.getByText("Warehouse created successfully!"),
    ).toBeVisible();

    // Create item with barcode
    await page.goto("/dashboard/products");
    await page
      .getByPlaceholder("Protein powder, Tape roll, Cleaning spray")
      .fill(itemName);
    await page.getByPlaceholder("Optional barcode").fill(barcode);
    await page.getByRole("button", { name: "Create Product" }).click();
    await expect(page.getByText("Product created")).toBeVisible();

    // Create PIN user
    await page.goto("/dashboard/users");
    await page.getByRole("button", { name: "Add User" }).click();
    await page.getByPlaceholder("Name").fill(userName);
    await page.getByPlaceholder("4-digit PIN").fill("5678");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText(userName)).toBeVisible();

    // Log out as owner
    await logout(page);

    // Log in as the PIN user
    await page.getByRole("combobox").selectOption({ label: userName });
    await page.getByPlaceholder("4-digit PIN").fill("5678");
    await page.getByRole("button", { name: "Login", exact: true }).click();
    await expect(page.getByRole("button", { name: "user" })).toBeVisible();

    // Add stock via Inventory > Add
    await page.goto("/dashboard/inventory/add");
    await page.getByLabel("Warehouse").selectOption({ label: warehouseName });
    await page.getByLabel("Barcode or Item ID").fill(barcode);
    await page.getByRole("button", { name: "Resolve" }).click();
    await expect(
      page.getByText(new RegExp(`Resolved item: ${itemName}`)),
    ).toBeVisible();
    await page.getByLabel("Quantity").fill("10");
    await page.getByRole("button", { name: "Add Stock" }).click();
    await expect(page.getByText(/Added 10 qty/)).toBeVisible();

    // Navigate to Inventory Visibility and search
    await page.goto("/dashboard/inventory-visibility");
    await searchInventory(page, itemName);

    const resultButton = page.getByRole("button", {
      name: new RegExp(itemName),
    });
    await expect(resultButton).toBeVisible();
    await resultButton.click();

    // Availability tab: warehouse name and total quantity visible
    await expect(page.getByText(warehouseName)).toBeVisible();
    await expect(page.getByText("10 total")).toBeVisible();

    // Movement History tab: movement with type "Add" and qty 10
    await page.getByRole("button", { name: "Movement History" }).click();
    await expect(page.getByRole("cell", { name: "Add" })).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "10", exact: true }),
    ).toBeVisible();
  });
});
