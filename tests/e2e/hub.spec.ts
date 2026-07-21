import { test, expect } from "@playwright/test";

test.describe.serial("hub", () => {
  test.beforeAll(async ({ request }) => {
    const res = await request.get("/api/spaces");
    const spaces = await res.json();
    for (const space of spaces) {
      await request.delete(`/api/spaces/${space.id}`);
    }
  });

  test("loads with correct title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/ExcaliHub/);
  });

  test("shows empty state when no spaces", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("No spaces yet")).toBeVisible();
  });

  test("creates a space and appears in list", async ({ page }) => {
    await page.goto("/spaces/new");

    // Wait for Svelte hydration — the form should be interactive
    const form = page.locator("form");
    await expect(form).toBeVisible();

    await page.getByLabel("Space Name").fill("My Test Space");
    await page.getByRole("button", { name: "Create" }).first().click();

    await expect(page).toHaveURL("/");
    await expect(page.getByText("My Test Space")).toBeVisible();
    await expect(page.getByText("my-test-space.")).toBeVisible();
  });

  test("archives and unarchives a space", async ({ page }) => {
    // Create via API
    const createRes = await page.request.post("/api/spaces", {
      data: { name: "Archive Me" },
    });
    expect(createRes.ok()).toBeTruthy();
    const space = await createRes.json();

    // Verify on dashboard
    await page.goto("/");
    await expect(page.getByText("Archive Me")).toBeVisible();

    // Archive via API
    const archiveRes = await page.request.patch(`/api/spaces/${space.id}`, {
      data: { status: "archived" },
    });
    expect(archiveRes.ok()).toBeTruthy();

    // Reload — space hidden
    await page.reload();
    await expect(page.getByText("Archive Me")).not.toBeVisible();

    // Go to archived page
    await page.getByRole("link", { name: "Archived" }).click();
    await expect(page.getByText("Archive Me")).toBeVisible();

    // Unarchive via API
    const unarchiveRes = await page.request.patch(`/api/spaces/${space.id}`, {
      data: { status: "active" },
    });
    expect(unarchiveRes.ok()).toBeTruthy();

    // Reload archived — space gone
    await page.reload();
    await expect(page.getByText("Archive Me")).not.toBeVisible();

    // Dashboard — space reappears
    await page.getByRole("link", { name: "Spaces" }).click();
    await expect(page.getByText("Archive Me")).toBeVisible();
  });

  test("toggles theme", async ({ page }) => {
    await page.goto("/");
    const html = page.locator("html");
    const themeButton = page.getByTitle(/Theme:/);
    await expect(themeButton).toBeVisible();

    // Click 3 times: system→light→dark→system
    await themeButton.click(); // → light
    await themeButton.click(); // → dark
    const isDark = await html.evaluate((el) => el.classList.contains("dark"));
    expect(isDark).toBe(true);

    await themeButton.click(); // → system
    const finalTitle = await themeButton.getAttribute("title");
    expect(finalTitle).toContain("system");
  });

  test("navigates between pages", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Archived" }).click();
    await expect(page).toHaveURL("/archived");

    await page.getByRole("link", { name: "Spaces" }).click();
    await expect(page).toHaveURL("/");
  });
});
