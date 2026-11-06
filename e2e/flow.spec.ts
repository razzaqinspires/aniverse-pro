import { test, expect, type Page } from "@playwright/test";

/**
 * Aniverse PRO — E2E Playwright
 *
 * Alur utama:  Login Demo → tonton episode (kunci berkurang) → simulasi kunci habis
 *              → AdModal muncul → iklan selesai → +3 kunci → XP heartbeat bertambah.
 * Alur kedua:  Ganti Server manual → sumber video / toast berubah.
 *
 * Strategi: endpoint bisnis (spend, ad, xp, watch) di-intercept dengan page.route
 * agar test deterministik, cepat, dan tidak bergantung pada upstream eksternal.
 * Login Demo dan navigasi menggunakan server nyata (webServer di playwright.config.ts).
 */

// Timeout longgar — alur iklan & heartbeat menunggu event asinkron dari klien.
test.describe.configure({ mode: "serial" });

const WATCH_URL = "/watch/1/1"; // anime id=1, episode=1 (apa pun, demo server selalu siap)
const WATCH_URL_EP2 = "/watch/1/2";

/** Login instan via tombol Demo / Guest (jalur default, zero-setup). */
async function loginAsDemo(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  // Tombol bisa berlabel "Login Demo", "Masuk Demo", "Demo / Guest", atau "Tamu Demo".
  const loginBtn = page
    .getByRole("button", { name: /demo|guest|tamu/i })
    .first();
  await loginBtn.waitFor({ state: "visible", timeout: 15_000 });
  await loginBtn.click();

  // Tunggu redirect keluar dari /login.
  await page.waitForURL(
    (url) => !url.pathname.startsWith("/login"),
    { timeout: 20_000 }
  );

  // Navbar harus menampilkan user "Tamu Demo" ATAU HUD kunci.
  const hud = page.getByText(/Tamu Demo|Kunci|kunci/).first();
  await expect(hud).toBeVisible({ timeout: 15_000 });
}

/** Tunggu elemen player (Plyr / <video> / testid) muncul. */
async function expectPlayerVisible(page: Page) {
  const player = page
    .locator("video, .plyr, [data-testid='player'], [data-player]")
    .first();
  await player.waitFor({ state: "visible", timeout: 25_000 });
  await expect(player).toBeVisible();
}

/** Paksa video autoplay (muted) agar heartbeat XP klien benar-benar terkirim. */
async function forcePlay(page: Page) {
  await page.evaluate(() => {
    const v = document.querySelector("video") as HTMLVideoElement | null;
    if (v) {
      v.muted = true;
      v.play().catch(() => undefined);
    }
  });
}

test.describe("Alur inti Aniverse PRO", () => {
  test("Login Demo → tonton → kunci berkurang → iklan → +3 kunci → XP bertambah", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    // ---- 1. Login Demo ----
    await loginAsDemo(page);

    // ---- 2. Intercept XP heartbeat (mock respons, rekam nilai xp) ----
    // Klien mengirim heartbeat setiap ~5 detik saat playing+visible.
    // Kita kembalikan xp yang naik bertahap (5, 10, 15, ...) dan rekam untuk asersi.
    const xpPayloads: number[] = [];
    let xpSeq = 0;
    await page.route("**/api/xp/heartbeat", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      xpSeq += 1;
      const xp = xpSeq * 5; // 5 → 10 → 15 ...
      xpPayloads.push(xp);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          xp,
          level: 1,
          xpToday: xp,
          dailyCap: 7200,
          leveledUp: false,
          newBadges: [],
          rewardKeysGranted: 0,
          capped: false,
        }),
      });
    });

    // ---- 3. Tonton episode pertama (kunci awal = 3, spend harus sukses) ----
    // Rekam request spend untuk memastikan 1 kunci terpotong.
    let spendCalled = false;
    let spendOk = false;
    page.on("response", async (res) => {
      if (
        res.url().includes("/api/keys/spend") &&
        res.request().method() === "POST"
      ) {
        spendCalled = true;
        try {
          const body = await res.json();
          spendOk = Boolean(body.ok);
        } catch {
          /* abaikan */
        }
      }
    });

    await page.goto(WATCH_URL, { waitUntil: "domcontentloaded" });
    await expectPlayerVisible(page);
    await forcePlay(page);

    // Spend episode pertama harus terjadi dan sukses (kunci masih ada).
    await expect
      .poll(() => spendCalled, { timeout: 20_000, intervals: [500, 1000] })
      .toBe(true);
    expect(spendOk).toBe(true);

    // ---- 4. Simulasi kunci = 0: intercept spend → 402 needAd ----
    // Pasang intercept SEBELUM navigasi ke episode berikutnya.
    await page.route("**/api/keys/spend", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      return route.fulfill({
        status: 402,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, needAd: true, keys: 0 }),
      });
    });

    // Iklan diselesaikan cepat: durasi 2 detik, heartbeat langsung penuh,
    // complete mengembalikan +3 kunci. (Anti-bypass tidak aktif di test ini
    // karena tab Playwright selalu visible.)
    await page.route("**/api/keys/ad/start", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          watchId: "e2e-ad-session",
          durationSec: 2,
          rewardKeys: 3,
        }),
      });
    });

    await page.route("**/api/keys/ad/heartbeat", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, progress: 2, reset: false }),
      });
    });

    let adCompleted = false;
    let grantedKeys = 0;
    await page.route("**/api/keys/ad/complete", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      adCompleted = true;
      grantedKeys = 3;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, granted: 3, keys: 3 }),
      });
    });

    // Navigasi ke episode lain → trigger spend baru → dapat 402 → AdModal muncul.
    await page.goto(WATCH_URL_EP2, { waitUntil: "domcontentloaded" });

    // ---- 5. Assert AdModal muncul dengan progress ----
    const adModal = page.getByText(/iklan|Iklan|menonton iklan/).first();
    await expect(adModal).toBeVisible({ timeout: 20_000 });
    // Progress bar / countdown harus ada di modal.
    const progress = page
      .locator("[role='progressbar'], [data-testid='ad-progress'], .progress, .plyr__progress")
      .first();
    if (await progress.count()) {
      await expect(progress).toBeVisible();
    }

    // ---- 6. Tunggu iklan selesai & reward diklaim ----
    await expect
      .poll(() => adCompleted, { timeout: 30_000, intervals: [500, 1000, 2000] })
      .toBe(true);
    expect(grantedKeys).toBe(3);

    // Toast sonner "+3 kunci" (atau HUD kunci naik) harus muncul.
    const toast = page.getByText(/\+3.*kunci|kunci.*\+3|\+3 Kunci/i).first();
    await expect(toast).toBeVisible({ timeout: 15_000 });

    // ---- 7. XP: setidaknya 2 heartbeat, dan xp heartbeat kedua > pertama ----
    await expect
      .poll(() => xpPayloads.length, { timeout: 30_000, intervals: [1000, 2000] })
      .toBeGreaterThanOrEqual(2);
    expect(xpPayloads[1]).toBeGreaterThan(xpPayloads[0]);
  });

  test("Ganti Server manual berfungsi (sumber video berubah / toast muncul)", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await loginAsDemo(page);

    // Rekam parameter `server` pada setiap request resolusi video,
    // dan kembalikan sumber yang berbeda sesuai server yang diminta
    // (agar perubahan benar-benar tercermin di player).
    const requestedServers: string[] = [];
    await page.route("**/api/anime/watch**", async (route) => {
      const u = new URL(route.request().url());
      const server = u.searchParams.get("server") || "auto";
      requestedServers.push(server);
      const sample =
        server === "upstream-1"
          ? "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4"
          : "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          server,
          serverName: server === "demo" ? "Server Demo" : `Server ${server}`,
          sources: [{ url: sample, type: "mp4", quality: "1080p" }],
          subtitles: [],
          isDemo: server === "demo",
        }),
      });
    });

    await page.goto(WATCH_URL, { waitUntil: "domcontentloaded" });
    await expectPlayerVisible(page);

    // Sumber awal.
    const videoSrcBefore = await page
      .locator("video")
      .first()
      .getAttribute("src")
      .catch(() => null);

    // Klik tombol Ganti Server.
    const gantiBtn = page
      .getByRole("button", { name: /ganti server|pilih server|server/i })
      .first();
    await expect(gantiBtn).toBeVisible({ timeout: 15_000 });
    await gantiBtn.click();

    // Jika muncul menu/dropdown server, pilih server yang BUKAN yang pertama
    // (mis. "Server 2" atau "Server Demo"). Jika tidak ada menu (tombol siklik),
    // request baru tetap akan terrekam.
    const menuItem = page
      .getByRole("menuitem", { name: /server (2|demo|cadangan)/i })
      .first();
    if (await menuItem.count()) {
      await menuItem.click();
    } else {
      // Fallback: klik opsi teks server kedua yang terlihat.
      const alt = page.getByText(/Server (2|Demo|Cadangan)/i).first();
      if (await alt.count()) await alt.click();
    }

    // Assert: ada request resolusi video baru dengan parameter server berbeda.
    await expect
      .poll(
        () => new Set(requestedServers).size > 1,
        { timeout: 20_000, intervals: [500, 1000] }
      )
      .toBe(true);

    // Assert: sumber video player berubah ATAU toast konfirmasi muncul.
    const videoSrcAfter = await page
      .locator("video")
      .first()
      .getAttribute("src")
      .catch(() => null);
    const toast = page.getByText(/server|beralih|diganti|berhasil/i).first();
    const sourceChanged =
      !!videoSrcAfter && videoSrcAfter !== videoSrcBefore;
    const toastVisible = (await toast.count()) > 0 && (await toast.isVisible());
    expect(sourceChanged || toastVisible).toBe(true);
  });
});
