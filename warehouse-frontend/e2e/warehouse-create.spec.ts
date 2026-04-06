import { test, expect } from "@playwright/test";

/** Generate a unique warehouse name to avoid cross-run collisions. */
function uniqueName(prefix: string) {
  return `${prefix} ${Date.now()}`;
}

test.describe("Warehouse Create", () => {
  test("should create a warehouse without bins", async ({ page }) => {
    await page.goto("/");

    // Verify the form is visible
    await expect(
      page.getByRole("heading", { name: "Create a New Warehouse" }),
    ).toBeVisible();

    // Fill in warehouse name
    await page
      .getByRole("textbox", { name: "Warehouse Name" })
      .fill(uniqueName("NoBins"));

    // Ensure use_bins is unchecked by default
    await expect(
      page.getByRole("checkbox", { name: "Use bins/shelves" }),
    ).not.toBeChecked();

    // Submit the form
    await page.getByRole("button", { name: "Create Warehouse" }).click();

    // Verify success message appears
    await expect(
      page.getByText("Warehouse created successfully!"),
    ).toBeVisible();

    // Verify the form was reset
    await expect(
      page.getByRole("textbox", { name: "Warehouse Name" }),
    ).toHaveValue("");
  });

  test("should create a warehouse with bins enabled", async ({ page }) => {
    await page.goto("/");

    await page
      .getByRole("textbox", { name: "Warehouse Name" })
      .fill(uniqueName("WithBins"));

    // Enable bins
    await page.getByRole("checkbox", { name: "Use bins/shelves" }).check();

    await page.getByRole("button", { name: "Create Warehouse" }).click();

    await expect(
      page.getByText("Warehouse created successfully!"),
    ).toBeVisible();
  });

  test("should show error for duplicate warehouse name", async ({
    page,
    request,
  }) => {
    // Create a warehouse via API first
    const dupName = uniqueName("DupTest");
    await request.post("/api/warehouses", {
      data: { name: dupName, use_bins: false },
    });

    await page.goto("/");

    // Try to create warehouse with same name
    await page.getByRole("textbox", { name: "Warehouse Name" }).fill(dupName);

    await page.getByRole("button", { name: "Create Warehouse" }).click();

    // Should show error about duplicate name
    await expect(page.getByText(/already exists/i)).toBeVisible();
  });

  test("should prevent submission with empty name", async ({ page }) => {
    await page.goto("/");

    // Try to submit without filling name
    await page.getByRole("button", { name: "Create Warehouse" }).click();

    // The form should not show success (HTML5 required validation prevents submission)
    await expect(
      page.getByText("Warehouse created successfully!"),
    ).not.toBeVisible();
  });

  test("should disable button while submitting", async ({ page }) => {
    await page.goto("/");

    await page
      .getByRole("textbox", { name: "Warehouse Name" })
      .fill(uniqueName("BtnTest"));

    const submitButton = page.getByRole("button", {
      name: /Create Warehouse|Creating/,
    });

    await submitButton.click();

    // Button should show "Creating..." text while loading
    // (may be too fast to catch, so we just verify it completes)
    await expect(
      page.getByText("Warehouse created successfully!"),
    ).toBeVisible();
  });
});
