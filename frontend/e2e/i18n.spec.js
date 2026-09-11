// Real-browser E2E tests for the VoltarisOS i18n implementation.
// Runs against the actual app (Vite dev server). No mocks.
const { test, expect } = require("@playwright/test");

// Conservative Portuguese detector used to assert "no visible PT when EN is selected".
// Intentionally avoids proper nouns / demo data (e.g. Évora, Voltaris, João).
const PT_RE = new RegExp(
  "\\b(?:" +
    [
      "Carregando", "Não foi possível", "Sem dados", "Sem sites", "Sem relatórios",
      "Sem alertas", "Definições", "Utilizadores", "Relatórios", "Previsão", "Manutenção",
      "Guardar", "Cancelar", "Voltar", "Pesquisar", "Ativar", "Desativar", "Fechar",
      "Apagar", "Remover", "Convidar", "Enviar", "Eliminar", "Notificações", "A carregar",
      "A criar", "A gerar", "Atualizado", "Começar", "Próximo", "Anterior", "Seleciona",
      "Escolhe", "Insere", "Preenche", "Tens de", "Concluído", "Só leitura", "Acesso total",
    ].join("|") +
    ")\\b"
);

const FLAG = { pt: "🇵🇹", en: "🇬🇧", nl: "🇳🇱" };
const LOGIN_TITLE = {
  pt: "Bem-vindo de volta",
  en: "Welcome back",
  nl: "Welkom terug",
};

// Seed an authenticated session (as a logged-in user would have) WITHOUT touching auth/backend.
async function seedSession(page, lang) {
  await page.goto("/");
  await page.evaluate((l) => {
    localStorage.setItem("token", "e2e-token");
    localStorage.setItem("company", "Voltaris E2E");
    localStorage.setItem("color", "#4ade80");
    localStorage.setItem("role", "SUPER_ADMIN");
    localStorage.setItem("plan", "beta");
    localStorage.setItem("vos_onboarded", "true"); // dismiss onboarding overlay
    localStorage.setItem("vos_lang", l || "en");
  }, lang);
  await page.reload();
  await expect(page.locator("nav")).toBeVisible();
}

async function openLangSwitcher(page) {
  // The trigger shows the current language flag; it is unique per screen.
  await page.locator('button:has-text("🇵🇹"), button:has-text("🇬🇧"), button:has-text("🇳🇱")').first().click();
}

async function pickLanguage(page, label) {
  await page.locator("button", { hasText: label }).last().click();
}

// There is no backend in the E2E environment. Force every API call to fail
// deterministically so data pages render their (translated) error/empty states
// instead of receiving Vite's SPA HTML fallback. The app itself is untouched.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ detail: "E2E: backend unavailable" }),
    })
  );
});

test.describe("1. Automatic detection — pt-PT", () => {
  test.use({ locale: "pt-PT" });

  test("fresh browser pt-PT opens in Portuguese", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(LOGIN_TITLE.pt)).toBeVisible();
  });

  test("manual switch PT → EN and refresh persists", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(LOGIN_TITLE.pt)).toBeVisible();
    await openLangSwitcher(page);
    await pickLanguage(page, "English");
    await expect(page.getByText(LOGIN_TITLE.en)).toBeVisible();
    await page.reload();
    await expect(page.getByText(LOGIN_TITLE.en)).toBeVisible();
    const saved = await page.evaluate(() => localStorage.getItem("vos_lang"));
    expect(saved).toBe("en");
  });

  test("explicit saved preference is NOT overridden by browser locale", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("vos_lang", "en"));
    await page.goto("/");
    await expect(page.getByText(LOGIN_TITLE.en)).toBeVisible();
    await expect(page.getByText(LOGIN_TITLE.pt)).toHaveCount(0);
  });
});

test.describe("2. Automatic detection — en-US", () => {
  test.use({ locale: "en-US" });
  test("fresh browser en-US opens in English", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(LOGIN_TITLE.en)).toBeVisible();
  });
});

test.describe("3. Automatic detection — nl-NL", () => {
  test.use({ locale: "nl-NL" });
  test("fresh browser nl-NL opens in Dutch", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(LOGIN_TITLE.nl)).toBeVisible();
  });
});

test.describe("4. Unsupported locale falls back to English", () => {
  test.use({ locale: "de-DE" });
  test("fresh browser de-DE opens in English", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(LOGIN_TITLE.en)).toBeVisible();
  });
});

test.describe("5. Authenticated app (English) — real UI", () => {
  test.use({ locale: "en-US" });

  test("manual switch PT → EN changes the whole application", async ({ page }) => {
    await seedSession(page, "pt");
    await expect(page.locator("nav").getByText("Definições")).toBeVisible();

    await openLangSwitcher(page);
    await pickLanguage(page, "English");

    await expect(page.locator("nav").getByText("Settings")).toBeVisible();
    await expect(page.locator("nav").getByText("Definições")).toHaveCount(0);
    await expect(page.locator("nav").getByText("Utilizadores")).toHaveCount(0);
  });

  test("logout/login preserves the selected language", async ({ page }) => {
    await seedSession(page, "en");
    await expect(page.locator("nav").getByText("Settings")).toBeVisible();

    // Logout → back to the login screen.
    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page.getByText(LOGIN_TITLE.en)).toBeVisible();
    const savedAfterLogout = await page.evaluate(() => localStorage.getItem("vos_lang"));
    expect(savedAfterLogout).toBe("en");
    await expect(page.evaluate(() => localStorage.getItem("token"))).resolves.toBeNull();

    // Simulate logging back in → shell must still be in English.
    await page.evaluate(() => {
      localStorage.setItem("token", "e2e-token2");
      localStorage.setItem("role", "SUPER_ADMIN");
      localStorage.setItem("plan", "beta");
      localStorage.setItem("vos_onboarded", "true");
    });
    await page.reload();
    await expect(page.locator("nav")).toBeVisible();
    await expect(page.locator("nav").getByText("Settings")).toBeVisible();
  });

  test("simplified navigation keeps admin modules (Settings, Users) reachable", async ({ page }) => {
    await seedSession(page, "en"); // fresh context → simplified nav is ON by default

    // The toggle proves simplified mode is active, and it must be translated.
    await expect(page.getByRole("button", { name: "View all modules" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ver todos os módulos" })).toHaveCount(0);

    // Admin modules must remain reachable while simplified nav is active.
    const settingsBtn = page.locator("nav button").filter({ hasText: "Settings" }).first();
    const usersBtn = page.locator("nav button").filter({ hasText: "Users" }).first();
    await expect(settingsBtn).toBeVisible();
    await expect(usersBtn).toBeVisible();

    // ...and actually navigate.
    await usersBtn.click();
    await page.waitForTimeout(1000);
    await expect(page.getByText("Something went wrong on this page")).toHaveCount(0);
    await settingsBtn.click();
    await page.waitForTimeout(600);
    await expect(page.getByText("Something went wrong on this page")).toHaveCount(0);

    // Expanding still works (feature preserved) and its label is translated.
    await page.getByRole("button", { name: "View all modules" }).click();
    await expect(page.getByRole("button", { name: "View less" })).toBeVisible();
  });

  test("legacy role spelling is normalized to canonical SUPER_ADMIN", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("token", "e2e-legacy");
      localStorage.setItem("role", "admin"); // legacy pre-RBAC-v2 spelling
      localStorage.setItem("plan", "beta");
      localStorage.setItem("vos_onboarded", "true");
      localStorage.setItem("vos_lang", "en");
    });
    await page.reload();
    await expect(page.locator("nav")).toBeVisible();

    // localStorage is self-healed to the canonical value...
    await expect
      .poll(async () => page.evaluate(() => localStorage.getItem("role")))
      .toBe("SUPER_ADMIN");
    // ...and the admin navigation (Settings/Users) is therefore visible.
    await expect(page.locator("nav").getByText("Settings")).toBeVisible();
    await expect(page.locator("nav").getByText("Users")).toBeVisible();
  });

  test("main application areas show no Portuguese when English is selected", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(String((e && e.stack) || e)));
    await seedSession(page, "en");

    const areas = ["Dashboard", "Sites", "Fleet", "Forecasting", "Alerts", "Users", "Settings"];
    for (const area of areas) {
      const btn = page.locator("nav button").filter({ hasText: area }).first();
      if ((await btn.count()) === 0) {
        pageErrors.push(`nav button not reachable: ${area}`);
        await page.reload();
        await expect(page.locator("nav")).toBeVisible();
        continue;
      }
      await btn.click();
      await page.waitForTimeout(1200); // allow data fetch attempts to settle
      // A crash would be caught by the ErrorBoundary and replace the whole app.
      await expect(page.getByText("Something went wrong on this page")).toHaveCount(0);
      const bodyText = await page.locator("body").innerText();
      const hits = bodyText.match(PT_RE);
      expect(hits, `Portuguese strings found on '${area}': ${hits && hits.join(", ")}`).toBeNull();
    }
    if (pageErrors.length) console.log("PAGE ERRORS:\n" + pageErrors.join("\n---\n"));
  });
});
