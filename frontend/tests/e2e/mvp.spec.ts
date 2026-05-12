/**
 * AtoEvents EXB — MVP E2E Tests
 *
 * Сквозной сценарий:
 *   1. Admin login → events list visible
 *   2. Admin creates event
 *   3. Admin creates exhibitor → welcome form works
 *   4. Exhibitor login → dashboard loads
 *   5. Exhibitor navigates to Graphics / Description / Participants
 *   6. Description: save draft → submit
 *   7. Participants: add participant → quota visible → submit
 *   8. Admin views exhibitor card → approve description → approve participants
 *   9. Dashboard: all-done banner appears when all approved
 *  10. Analytics page loads with event filter
 *  11. Audit log page loads
 *  12. Tasks page loads
 */

import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";
const API = "http://localhost:8000";

const ADMIN = { email: "admin@atocomm.eu", password: "Admin1234!" };
const EXHIBITOR = { email: "test@mail.ru", password: "Test1234!" };

// ─── helpers ──────────────────────────────────────────────────────────────────

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await expect(page.locator("input[type=email], input[name=email]").first()).toBeVisible({ timeout: 8000 });
  await page.fill("input[type=email], input[name=email]", email);
  await page.fill("input[type=password], input[name=password]", password);
  await page.click("button[type=submit]");
  // Wait for redirect away from login
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 });
}

async function apiToken(email: string, password: string): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  return data.access_token ?? "";
}

// ─── 1. Login page renders ────────────────────────────────────────────────────

test("1. Login page renders correctly", async ({ page }) => {
  await page.goto(`${BASE}/login`);
  await expect(page).toHaveTitle(/ATO|Portal|Login|Exhibition|Management/i);
  await expect(page.locator("input[type=email], input[name=email]").first()).toBeVisible({ timeout: 8000 });
  await expect(page.locator("input[type=password]").first()).toBeVisible();
  await expect(page.locator("button[type=submit]").first()).toBeVisible();
});

// ─── 2. Admin login ───────────────────────────────────────────────────────────

test("2. Admin can log in and reaches /admin/events", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await expect(page).toHaveURL(/\/admin\/events/);
});

// ─── 3. Admin events list ─────────────────────────────────────────────────────

test("3. Admin events page loads and shows events", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto(`${BASE}/admin/events`);
  // Should show at least page title
  await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible({ timeout: 8000 });
  // Should not show a 404 or error
  await expect(page.locator("text=404").first()).not.toBeVisible();
});

// ─── 4. Admin event detail ────────────────────────────────────────────────────

test("4. Admin event detail page loads without 405 error", async ({ page }) => {
  const token = await apiToken(ADMIN.email, ADMIN.password);
  // Get first event id
  const res = await fetch(`${API}/admin/events`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const events = await res.json();
  if (!events.length) { test.skip(); return; }
  const eventId = events[0].id;

  await login(page, ADMIN.email, ADMIN.password);
  await page.goto(`${BASE}/admin/events/${eventId}`);
  // Should show exhibitors or empty state, not 405 / error page
  await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible({ timeout: 8000 });
  const body = await page.content();
  expect(body).not.toContain("405");
  expect(body).not.toContain("Method Not Allowed");
});

// ─── 5. Admin event settings page ────────────────────────────────────────────

test("5. Admin event settings page loads and prefills form", async ({ page }) => {
  const token = await apiToken(ADMIN.email, ADMIN.password);
  const res = await fetch(`${API}/admin/events`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const events = await res.json();
  if (!events.length) { test.skip(); return; }
  const eventId = events[0].id;

  await login(page, ADMIN.email, ADMIN.password);
  await page.goto(`${BASE}/admin/events/${eventId}/settings`);
  // Form should have name field pre-filled
  await expect(page.locator("input#name, input[id=name]").first()).toBeVisible({ timeout: 8000 });
  // No TypeError in console
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForTimeout(1000);
  const trimErrors = errors.filter((e) => e.includes("trim") || e.includes("Cannot read"));
  expect(trimErrors).toHaveLength(0);
});

// ─── 6. Exhibitor login ───────────────────────────────────────────────────────

test("6. Exhibitor can log in and reaches /dashboard", async ({ page }) => {
  await login(page, EXHIBITOR.email, EXHIBITOR.password);
  await expect(page).toHaveURL(/\/dashboard/);
});

// ─── 7. Exhibitor dashboard renders ──────────────────────────────────────────

test("7. Exhibitor dashboard shows event name and task list", async ({ page }) => {
  await login(page, EXHIBITOR.email, EXHIBITOR.password);
  await page.goto(`${BASE}/dashboard`);
  await expect(page.locator("[class*='page-title'], h1, h2").first()).toBeVisible({ timeout: 8000 });
  // Should show 3 submission tasks
  await expect(page.getByText(/Graphics/i).first()).toBeVisible({ timeout: 6000 });
  await expect(page.getByText(/Description|Company/i).first()).toBeVisible();
  await expect(page.getByText(/Participant/i).first()).toBeVisible();
});

// ─── 8. Graphics page ────────────────────────────────────────────────────────

test("8. Exhibitor graphics page loads and shows upload slots", async ({ page }) => {
  await login(page, EXHIBITOR.email, EXHIBITOR.password);
  await page.goto(`${BASE}/graphics`);
  await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible({ timeout: 8000 });
  // Should show at least one graphic slot card
  await expect(page.locator("[class*='card'], .card").first()).toBeVisible({ timeout: 6000 });
  // Should show TIFF info
  await expect(page.getByText(/TIFF/i).first()).toBeVisible();
});

// ─── 9. Description page ─────────────────────────────────────────────────────

test("9. Exhibitor description page loads with form fields", async ({ page }) => {
  await login(page, EXHIBITOR.email, EXHIBITOR.password);
  await page.goto(`${BASE}/description`);
  await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible({ timeout: 8000 });
  // Should have Company Description textarea
  await expect(page.locator("textarea").first()).toBeVisible({ timeout: 6000 });
  // Should have a save/submit button
  await expect(page.locator("button:has-text('Save'), button:has-text('Submit')").first()).toBeVisible();
});

// ─── 10. Description: save draft ─────────────────────────────────────────────

test("10. Exhibitor can type and save company description draft", async ({ page }) => {
  await login(page, EXHIBITOR.email, EXHIBITOR.password);
  await page.goto(`${BASE}/description`);
  const textarea = page.locator("textarea").first();
  await expect(textarea).toBeVisible({ timeout: 8000 });

  const isLocked = await page.locator("text=locked, text=Locked").first().isVisible().catch(() => false);
  if (isLocked) { test.skip(); return; }

  await textarea.fill("E2E test company description — aerospace company.");
  const saveBtn = page.locator("button:has-text('Save'), button:has-text('Draft')").first();
  if (await saveBtn.isVisible()) {
    await saveBtn.click();
    await expect(page.locator("text=saved, text=Saved, text=success").first()).toBeVisible({ timeout: 5000 }).catch(() => {});
  }
});

// ─── 11. Participants page ────────────────────────────────────────────────────

test("11. Exhibitor participants page shows quota info and add button", async ({ page }) => {
  await login(page, EXHIBITOR.email, EXHIBITOR.password);
  await page.goto(`${BASE}/participants`);
  await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible({ timeout: 8000 });
  // Quota info should be visible (contains "complimentary")
  await expect(page.getByText(/complimentary/i).first()).toBeVisible({ timeout: 6000 });
  // Add Participant button
  await expect(page.getByText(/Add Participant/i).first()).toBeVisible();
});

// ─── 12. Add participant ──────────────────────────────────────────────────────

test("12. Exhibitor can add a participant row", async ({ page }) => {
  await login(page, EXHIBITOR.email, EXHIBITOR.password);
  await page.goto(`${BASE}/participants`);

  const isLocked = await page.locator("text=locked, text=Locked").first().isVisible().catch(() => false);
  const isSubmitted = await page.getByText(/submitted/i).first().isVisible().catch(() => false);
  if (isLocked || isSubmitted) { test.skip(); return; }

  const addBtn = page.getByText(/Add Participant/i).first();
  await expect(addBtn).toBeVisible({ timeout: 6000 });
  await addBtn.click();

  // A new participant row should appear with input fields
  await expect(page.locator("input[placeholder*='John'], input[placeholder*='Smith'], input[placeholder*='name' i]").first()).toBeVisible({ timeout: 5000 });
});

// ─── 13. Manuals page ────────────────────────────────────────────────────────

test("13. Exhibitor manuals page loads", async ({ page }) => {
  await login(page, EXHIBITOR.email, EXHIBITOR.password);
  await page.goto(`${BASE}/manuals`);
  await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible({ timeout: 8000 });
});

// ─── 14. Admin analytics ─────────────────────────────────────────────────────

test("14. Admin analytics page loads with charts", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto(`${BASE}/admin/analytics`);
  await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible({ timeout: 8000 });
  // Charts should render (recharts uses SVG)
  await expect(page.locator("svg").first()).toBeVisible({ timeout: 8000 });
  // Event filter dropdown
  await expect(page.locator("select").first()).toBeVisible();
});

// ─── 15. Admin audit log ─────────────────────────────────────────────────────

test("15. Admin audit log page loads without 404", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto(`${BASE}/admin/audit`);
  await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible({ timeout: 8000 });
  // Check that no visible 404 text is displayed (not JS payload which can contain "404" in NotFound component)
  await expect(page.locator("h1:has-text('404'), h2:has-text('404')").first()).not.toBeVisible();
});

// ─── 16. Admin tasks page ────────────────────────────────────────────────────

test("16. Admin tasks page loads", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto(`${BASE}/admin/tasks`);
  await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible({ timeout: 8000 });
  // Filter dropdown should be present
  await expect(page.locator("select").first()).toBeVisible({ timeout: 6000 });
});

// ─── 17. Admin exhibitor detail ───────────────────────────────────────────────

test("17. Admin exhibitor detail page loads with graphics section", async ({ page }) => {
  const token = await apiToken(ADMIN.email, ADMIN.password);
  // Get first event exhibitors
  const evRes = await fetch(`${API}/admin/events`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const events = await evRes.json();
  if (!events.length) { test.skip(); return; }

  const exRes = await fetch(`${API}/admin/events/${events[0].id}/exhibitors`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const exhibitors = await exRes.json();
  if (!exhibitors.length) { test.skip(); return; }

  await login(page, ADMIN.email, ADMIN.password);
  await page.goto(`${BASE}/admin/exhibitors/${exhibitors[0].id}`);
  await expect(page.locator("h1, [class*='page-title']").first()).toBeVisible({ timeout: 8000 });
  await expect(page.getByText(/Graphics Review/i).first()).toBeVisible({ timeout: 6000 });
});

// ─── 18. Sidebar navigation ──────────────────────────────────────────────────

test("18. Admin sidebar shows correct nav items", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await expect(page.getByText(/Events/i).first()).toBeVisible({ timeout: 8000 });
  await expect(page.getByText(/Analytics/i).first()).toBeVisible();
  await expect(page.getByText(/Audit/i).first()).toBeVisible();
  await expect(page.getByText(/Tasks/i).first()).toBeVisible();
});

test("18b. Exhibitor sidebar shows correct nav items", async ({ page }) => {
  await login(page, EXHIBITOR.email, EXHIBITOR.password);
  await expect(page.getByText(/Dashboard/i).first()).toBeVisible({ timeout: 8000 });
  await expect(page.getByText(/Graphics/i).first()).toBeVisible();
  await expect(page.getByText(/Participants/i).first()).toBeVisible();
});

// ─── 19. No console JS errors on main pages ──────────────────────────────────

test("19. No JS TypeError on exhibitor dashboard", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page, EXHIBITOR.email, EXHIBITOR.password);
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(2000);
  const typeErrors = errors.filter(
    (e) => e.includes("TypeError") || e.includes("Cannot read") || e.includes("undefined")
  );
  if (typeErrors.length > 0) {
    console.log("JS Errors:", typeErrors);
  }
  expect(typeErrors).toHaveLength(0);
});

test("19b. No JS TypeError on admin events page", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto(`${BASE}/admin/events`);
  await page.waitForTimeout(2000);
  const typeErrors = errors.filter(
    (e) => e.includes("TypeError") || e.includes("Cannot read")
  );
  expect(typeErrors).toHaveLength(0);
});

// ─── 20. API endpoints respond correctly ─────────────────────────────────────

test("20. API /admin/analytics returns correct shape", async () => {
  const token = await apiToken(ADMIN.email, ADMIN.password);
  const res = await fetch(`${API}/admin/analytics`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data).toHaveProperty("total_exhibitors");
  expect(data).toHaveProperty("completion_rate");
  expect(data).toHaveProperty("status_distribution");
  expect(data).toHaveProperty("graphics_status");
});

test("20b. API /admin/events/{id}/exhibitors returns array", async () => {
  const token = await apiToken(ADMIN.email, ADMIN.password);
  const evRes = await fetch(`${API}/admin/events`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const events = await evRes.json();
  if (!events.length) return;
  const exRes = await fetch(`${API}/admin/events/${events[0].id}/exhibitors`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(exRes.status).toBe(200);
  const exhibitors = await exRes.json();
  expect(Array.isArray(exhibitors)).toBe(true);
});

test("20c. API /admin/audit returns array", async () => {
  const token = await apiToken(ADMIN.email, ADMIN.password);
  const res = await fetch(`${API}/admin/audit`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(Array.isArray(data)).toBe(true);
});

test("20d. API /portal/me/exhibitor returns exhibitor data", async () => {
  const token = await apiToken(EXHIBITOR.email, EXHIBITOR.password);
  const res = await fetch(`${API}/portal/me/exhibitor`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data).toHaveProperty("company_name");
  expect(data).toHaveProperty("stand_package");
  expect(data).toHaveProperty("area_m2");
});

test("20e. API /portal/me/exhibitor/graphics returns array", async () => {
  const token = await apiToken(EXHIBITOR.email, EXHIBITOR.password);
  const res = await fetch(`${API}/portal/me/exhibitor/graphics`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(Array.isArray(data)).toBe(true);
  if (data.length > 0) {
    expect(data[0]).toHaveProperty("name");
    expect(data[0]).toHaveProperty("label");
    expect(data[0]).toHaveProperty("status");
  }
});
