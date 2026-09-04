import { test, expect, type Page } from "@playwright/test";

async function openPalette(page: Page, modifier: "ctrl" | "meta" = "ctrl") {
  await page.evaluate(({ modifier }) => {
    const ctrl = modifier === "ctrl";
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "k",
        ctrlKey: ctrl,
        metaKey: !ctrl,
        bubbles: true,
        cancelable: true,
      })
    );
  }, { modifier });
}

test.describe.serial("command-palette", () => {
  test.beforeAll(async ({ request }) => {
    const res = await request.get("/api/spaces");
    const spaces = await res.json();
    for (const space of spaces) {
      await request.delete(`/api/spaces/${space.id}`);
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("sidebar-pinned", "true");
    });
  });

  test("Ctrl+K opens the palette", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.getByPlaceholder("Type a command or search...")).not.toBeVisible();
    await openPalette(page);
    await expect(page.getByPlaceholder("Type a command or search...")).toBeVisible();
  });

  test("Cmd/Super+K (meta) opens the palette", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.getByPlaceholder("Type a command or search...")).not.toBeVisible();
    await openPalette(page, "meta");
    await expect(page.getByPlaceholder("Type a command or search...")).toBeVisible();
  });

  test("Shortcut hint in sidebar opens the palette", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const hint = page.getByTitle("Open command palette");
    await expect(hint).toBeVisible();

    await hint.click();
    await expect(page.getByPlaceholder("Type a command or search...")).toBeVisible();
  });

  test("Fuzzy filter narrows results", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await openPalette(page);
    await expect(page.getByPlaceholder("Type a command or search...")).toBeVisible();

    await page.getByPlaceholder("Type a command or search...").fill("dark");

    await expect(page.getByRole("option", { name: "Dark" })).toBeVisible();
    await expect(page.getByText("No results found.")).not.toBeVisible();
  });

  test("Theme selection closes palette and applies dark class", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const html = page.locator("html");

    await openPalette(page);
    await expect(page.getByPlaceholder("Type a command or search...")).toBeVisible();

    await page.getByPlaceholder("Type a command or search...").fill("dark");
    await page.getByRole("option", { name: "Dark" }).click();

    await expect(page.getByPlaceholder("Type a command or search...")).not.toBeVisible();
    await expect(html).toHaveClass(/dark/);
  });

  test("Navigate action goes to Settings", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await openPalette(page);
    await expect(page.getByPlaceholder("Type a command or search...")).toBeVisible();

    await page.getByPlaceholder("Type a command or search...").fill("settings");
    await page.getByRole("option", { name: "Settings", exact: true }).click();

    await expect(page).toHaveURL(/\/settings/);
  });

  test("Create Space from palette opens the dialog", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await openPalette(page);
    await expect(page.getByPlaceholder("Type a command or search...")).toBeVisible();

    await page.getByPlaceholder("Type a command or search...").fill("create space");
    await page.getByRole("option", { name: "Create Space" }).click();

    const dialog = page.getByRole("dialog").filter({ hasText: "Space Name" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Space Name")).toBeVisible();
  });

  test("Space item appears in palette", async ({ page }) => {
    const createRes = await page.request.post("/api/spaces", {
      data: { name: "Palette Space" },
    });
    expect(createRes.ok()).toBeTruthy();

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await openPalette(page);
    await expect(page.getByPlaceholder("Type a command or search...")).toBeVisible();

    await page.getByPlaceholder("Type a command or search...").fill("palette space");
    await expect(page.getByRole("option", { name: "Palette Space" })).toBeVisible();
  });

  test("Navigate action goes to Dashboard", async ({ page }) => {
    await page.goto("/archived");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/archived/);
    await openPalette(page);
    await expect(page.getByPlaceholder("Type a command or search...")).toBeVisible();

    await page.getByPlaceholder("Type a command or search...").fill("dashboard");
    await page.getByRole("option", { name: "Dashboard", exact: true }).click();

    await expect(page).toHaveURL(/\/$/);
  });

  test("Navigate action goes to Archived", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await openPalette(page);
    await expect(page.getByPlaceholder("Type a command or search...")).toBeVisible();

    await page.getByPlaceholder("Type a command or search...").fill("archived");
    await page.getByRole("option", { name: "Archived", exact: true }).click();

    await expect(page).toHaveURL(/\/archived/);
  });

  test("Space item opens the space in a new tab", async ({ page }) => {
    const createRes = await page.request.post("/api/spaces", {
      data: { name: "Open in Tab" },
    });
    expect(createRes.ok()).toBeTruthy();
    const { subdomain } = await createRes.json();

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => {
      const w = window as unknown as { __openedUrls: string[]; open: (url: string) => void };
      w.__openedUrls = [];
      w.open = (url: string) => {
        w.__openedUrls.push(url);
        return null;
      };
    });

    await openPalette(page);
    await expect(page.getByPlaceholder("Type a command or search...")).toBeVisible();

    await page.getByPlaceholder("Type a command or search...").fill("open in tab");
    await page.getByRole("option", { name: "Open in Tab", exact: true }).click();

    const openedUrls = await page.evaluate(() => (window as unknown as { __openedUrls: string[] }).__openedUrls);
    expect(openedUrls[0]).toMatch(new RegExp(`${subdomain}\\.excalihub\\.localhost`));
  });

  test("Sidebar unpin and pin from the palette", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const aside = page.locator("aside");

    await expect(aside).toHaveClass(/w-48/);
    await expect(aside).not.toHaveClass(/w-14/);
    await openPalette(page);
    await expect(page.getByPlaceholder("Type a command or search...")).toBeVisible();
    await page.getByPlaceholder("Type a command or search...").fill("unpin");
    await page.getByRole("option", { name: "Unpin", exact: true }).click();
    await expect(page.getByPlaceholder("Type a command or search...")).not.toBeVisible();
    await expect(aside).toHaveClass(/w-14/);
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("sidebar-pinned")))
      .toBe("false");

    await openPalette(page);
    await expect(page.getByPlaceholder("Type a command or search...")).toBeVisible();
    await page.getByPlaceholder("Type a command or search...").fill("pin");
    await expect(page.getByRole("option", { name: "Pin", exact: true })).toBeVisible();
    await page.getByRole("option", { name: "Pin", exact: true }).click();
    await expect(page.getByPlaceholder("Type a command or search...")).not.toBeVisible();
    await expect(aside).toHaveClass(/w-48/);
    await expect(aside).not.toHaveClass(/w-14/);
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("sidebar-pinned")))
      .toBe("true");
  });

  test("Theme selection applies light theme", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const html = page.locator("html");

    await openPalette(page);
    await page.getByPlaceholder("Type a command or search...").fill("light");
    await page.getByRole("option", { name: "Light", exact: true }).click();

    await expect(page.getByPlaceholder("Type a command or search...")).not.toBeVisible();
    await expect(html).not.toHaveClass(/dark/);
  });

  test("Theme selection applies system theme", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const html = page.locator("html");

    await openPalette(page);
    await page.getByPlaceholder("Type a command or search...").fill("system");
    await page.getByRole("option", { name: "System", exact: true }).click();

    await expect(page.getByPlaceholder("Type a command or search...")).not.toBeVisible();
    await expect(html).not.toHaveClass(/dark/);
  });
});
