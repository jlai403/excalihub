import { test, expect } from "@playwright/test";

test.describe.serial("proxy routing", () => {
  test.beforeAll(async ({ request }) => {
    const res = await request.get("/api/spaces");
    const spaces = await res.json();
    for (const space of spaces) {
      await request.delete(`/api/spaces/${space.id}`);
    }
  });

  test("hub loads at excalihub.localhost", async ({ page }) => {
    await page.goto("http://excalihub.localhost:8081/");
    await expect(page).toHaveTitle(/ExcaliHub/);
  });

  test("space links point to correct subdomain", async ({ page }) => {
    // Create a space via API
    const createRes = await page.request.post("/api/spaces", {
      data: { name: "Link Test" },
    });
    expect(createRes.ok()).toBeTruthy();
    const space = await createRes.json();

    // Navigate to hub — wait for the space card to appear
    await page.goto("/");
    await expect(page.getByText("Link Test")).toBeVisible();

    // The card title is an <a> with href pointing to the subdomain URL
    const cardLink = page.getByRole("link", { name: "Link Test" });
    await expect(cardLink).toBeVisible();
    const href = await cardLink.getAttribute("href");
    expect(href).toContain("link-test.excalihub.localhost");
  });

  test("unknown subdomain returns error", async ({ request }) => {
    const response = await request.get("http://nonexistent.excalihub.localhost:8081/", {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(404);
  });
});
