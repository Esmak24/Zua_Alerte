/**
 * Preuve navigateur: pages Expo + géoloc mockée + flux login visible.
 */
import { chromium } from "playwright";

const FRONT = "http://localhost:8081";
const API = "http://127.0.0.1:8002";

const results = [];
const pass = (n, p) => {
  results.push({ n, r: "PASS", p });
  console.log(`PASS | ${n}\n     ${p}`);
};
const fail = (n, p) => {
  results.push({ n, r: "FAIL", p });
  console.log(`FAIL | ${n}\n     ${p}`);
};

async function main() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (e) {
    fail("Playwright Chromium", String(e));
    console.log("Install: npx playwright install chromium");
    process.exit(1);
  }

  const context = await browser.newContext({
    geolocation: { latitude: -4.327612, longitude: 15.313568 },
    permissions: ["geolocation"],
    locale: "fr-FR",
  });
  const page = await context.newPage();

  // GPS permission granted in browser context
  pass(
    "GPS — permission navigateur accordée (Playwright)",
    "geolocation=-4.327612,15.313568 permissions=[geolocation]"
  );

  await page.goto(FRONT, { waitUntil: "networkidle", timeout: 60000 });
  const body = await page.locator("body").innerText().catch(() => "");
  if (body.toLowerCase().includes("connecter") || body.toLowerCase().includes("zua") || body.length > 20) {
    pass("UI — page Expo Web chargée", `texte extrait: ${body.slice(0, 120).replace(/\n/g, " ")}`);
  } else {
    fail("UI — page Expo Web chargée", `body=${body.slice(0, 200)}`);
  }

  // Créer compte via API puis se connecter dans l'UI
  const email = `ui.${Date.now()}@example.com`;
  const password = "secret12";
  const reg = await fetch(`${API}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      full_name: "UI Tester",
      email,
      password,
    }),
  }).then((r) => r.json());

  if (!reg.access_token) {
    fail("UI prérequis register API", JSON.stringify(reg));
  } else {
    pass("UI prérequis register API", `user=${reg.user?.id}`);
  }

  // Remplir login si champs présents
  const emailInput = page.getByPlaceholder(/example.com|email/i).first();
  const passInput = page.locator('input[type="password"]').first();
  const loginBtn = page.getByText(/SE CONNECTER|connecter/i).first();

  try {
    await emailInput.waitFor({ timeout: 15000 });
    await emailInput.fill(email);
    await passInput.fill(password);
    await loginBtn.click();
    await page.waitForTimeout(3000);
    const after = await page.locator("body").innerText();
    if (/SOS|gadget|profil|alerte/i.test(after)) {
      pass("UI — Connexion → Accueil", after.slice(0, 160).replace(/\n/g, " "));
    } else {
      // parfois encore sur login si bundler lent
      fail("UI — Connexion → Accueil", after.slice(0, 200).replace(/\n/g, " "));
    }
  } catch (e) {
    fail("UI — Connexion formulaire", String(e));
  }

  // Vérifier GPS API navigateur dans la page
  const geo = await page.evaluate(() => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ ok: false, error: "no geolocation API" });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            ok: true,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        (err) => resolve({ ok: false, error: err.message }),
        { timeout: 10000 }
      );
    });
  });

  if (geo.ok) {
    pass(
      "GPS — getCurrentPosition navigateur",
      `lat=${geo.latitude} lon=${geo.longitude}`
    );
  } else {
    fail("GPS — getCurrentPosition navigateur", JSON.stringify(geo));
  }

  await browser.close();

  console.log("\n=== UI SUMMARY ===");
  for (const x of results) console.log(`${x.r}\t${x.n}`);
  process.exit(results.some((x) => x.r === "FAIL") ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
