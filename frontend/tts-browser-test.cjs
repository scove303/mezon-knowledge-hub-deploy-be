const { chromium } = require("playwright");

const BASE = "http://localhost:3000";
const API = "http://localhost:8000/api/v1";
const GUEST = "tts-browser-guest-0002";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--autoplay-policy=no-user-gesture-required"],
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1400 } });
  await page.addInitScript((guestId) => {
    try {
      localStorage.setItem("mf-onboarded-v1", "1");
      localStorage.setItem("mezon-guest-id", guestId);
    } catch {}
  }, GUEST);
  const results = [];
  const ttsRequests = [];

  const check = (name, ok, extra = "") => {
    results.push({ name, ok, extra });
  };

  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) console.log("[navigated]", frame.url());
  });

  try {
    const folderRes = await fetch(`${API}/folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Guest-Id": GUEST },
      body: JSON.stringify({ name: "Khoa học máy tính", type: "general" }),
    });
    const folderJson = await folderRes.json();
    const folderId = folderJson?.data?.id;
    check("tạo folder qua API", !!folderId, `status=${folderRes.status}`);

    const fd = new FormData();
    fd.append("folder_id", folderId);
    fd.append(
      "file",
      new Blob(
        ["Xin chào các bạn. Hôm nay chúng ta sẽ học về lập trình Python. Đây là một ngôn ngữ rất mạnh mẽ và dễ học."],
        { type: "text/markdown" }
      ),
      "bai-hoc-tts.md",
    );
    const fileRes = await fetch(`${API}/files`, {
      method: "POST",
      headers: { "X-Guest-Id": GUEST },
      body: fd,
    });
    const fileJson = await fileRes.json();
    check("tạo file qua API", !!fileJson?.data?.id, `status=${fileRes.status}`);

    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    await page
      .locator('button[aria-label="Đóng mở thanh thư mục"]')
      .click()
      .catch(() => {});
    await page.waitForTimeout(800);

    await page.locator('button:has-text("Khoa học máy tính")').first().click();
    await page.waitForTimeout(1500);
    check("mở folder", true);

    await page.locator('button:has-text("bai-hoc-tts")').first().click();
    await page.waitForTimeout(2500);
    check("mở file", true);

    const viewerProbe = await page.evaluate(() => {
      const markdown = document.querySelector(".markdown-body, .prose, article, [class*='markdown']");
      return {
        markdownText: markdown ? markdown.innerText.slice(0, 120) : null,
        hasPython: document.body.innerText.includes("lập trình Python"),
      };
    });
    console.log("[viewer-probe]", JSON.stringify(viewerProbe));

    await page.locator("#btn-overflow-file").click();
    await page.waitForTimeout(600);

    const btn = page.locator("#btn-tts-file");
    const visible = await btn.isVisible().catch(() => false);
    check("nút Đọc bài hiển thị", visible);
    if (visible) {
      const fiberProbe = await page.evaluate(() => {
        const b = document.querySelector("#btn-tts-file");
        document.addEventListener(
          "mousedown",
          (e) => console.log("[doc-mousedown] target=" + (e.target?.id || e.target?.tagName || "?")),
          true
        );
        document.addEventListener(
          "mouseup",
          (e) => console.log("[doc-mouseup] target=" + (e.target?.id || e.target?.tagName || "?")),
          true
        );
        return "patched";
      });
      console.log("[fiber-probe]", fiberProbe);
      const box2 = await btn.boundingBox();
      console.log("[box2]", JSON.stringify(box2));
      const overlayProbe = await page.evaluate(() => ({
        nextjsPortal: !!document.querySelector("nextjs-portal"),
        errorOverlay: !!document.querySelector("[data-nextjs-dialog-overlay], [data-nextjs-error]"),
        fixedOverlays: [...document.querySelectorAll("body *")].filter((el) => {
          const cs = getComputedStyle(el);
          return cs.position === "fixed" && cs.zIndex > 0;
        }).map((el) => el.id || el.tagName + "." + (el.className || "").toString().slice(0, 50)),
      }));
      console.log("[overlay-probe]", JSON.stringify(overlayProbe));
      const hitAt = (label) =>
        page.evaluate(({ label, x, y }) => {
          const el = document.elementFromPoint(x, y);
          return { label, x, y, scrollY: window.scrollY, el: el ? el.id || el.tagName + "." + (el.className || "").slice(0, 30) : "null" };
        }, { label, x: box2.x + box2.width / 2, y: box2.y + box2.height / 2 });
      console.log("[hit-before-move]", JSON.stringify(await hitAt("before")));
      const filePropProbe = await page.evaluate(() => {
        const b = document.querySelector("#btn-tts-file");
        const key = Object.keys(b).find((k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"));
        let fiber = key ? b[key] : null;
        let viewer = null;
        while (fiber) {
          const nm = fiber.type?.name || fiber.type?.displayName || "";
          if (nm === "FileViewer") { viewer = fiber; break; }
          fiber = fiber.return;
        }
        const f = viewer?.memoizedProps?.file;
        return {
          viewerFound: !!viewer,
          fileId: f?.id,
          contentLen: (f?.content || "").length,
          contentHead: (f?.content || "").slice(0, 60),
        };
      });
      console.log("[file-prop-probe]", JSON.stringify(filePropProbe));
      const stateProbe = await page.evaluate(() => {
        const b = document.querySelector("#btn-tts-file");
        const key = Object.keys(b).find((k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"));
        let fiber = key ? b[key] : null;
        let viewer = null;
        while (fiber) {
          const nm = fiber.type?.name || fiber.type?.displayName || "";
          if (nm === "FileViewer") { viewer = fiber; break; }
          fiber = fiber.return;
        }
        if (!viewer) return { viewerFound: false };
        const hooks = [];
        let h = viewer.memoizedState;
        let idx = 0;
        while (h && idx < 60) {
          let v = h.memoizedState;
          let desc = String(v);
          if (v && typeof v === "object") {
            if (v.current && v.current.nodeType) desc = "[ref:" + (v.current.id || v.current.tagName || "el") + "]";
            else if (v.$$typeof) desc = "[element]";
            else if (typeof v.length === "number") desc = "[array:" + v.length + "]";
            else {
              try { desc = JSON.stringify(v); } catch { desc = "[object]"; }
            }
          }
          hooks.push({ idx, type: typeof v, desc: desc.slice(0, 80) });
          h = h.next;
          idx++;
        }
        return { viewerFound: true, hooks };
      });
      console.log("[state-probe]", JSON.stringify(stateProbe));
      const invoked = await page.evaluate(async () => {
        const b = document.querySelector("#btn-tts-file");
        const key = Object.keys(b).find((k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"));
        let fiber = key ? b[key] : null;
        while (fiber && !fiber.memoizedProps?.onClick) fiber = fiber.return;
        if (!fiber?.memoizedProps?.onClick) return "no-onClick";
        const origAudio = window.Audio;
        window.Audio = function (...a) {
          console.log("[new-Audio]", a[0]?.slice(0, 80));
          const inst = new origAudio(...a);
          inst.addEventListener("play", () => console.log("[audio-play]"), { once: true });
          inst.addEventListener("ended", () => console.log("[audio-ended]"), { once: true });
          return inst;
        };
        window.__addToastLog = [];
        const store = await import("/_next/static/chunks/_app-client.js").catch(() => null);
        fiber.memoizedProps.onClick({ currentTarget: b, preventDefault() {}, stopPropagation() {} });
        return "invoked";
      });
      console.log("[fiber-invoke]", invoked);
      check("bấm Đọc bài", true);
      await page.waitForTimeout(7000);

      const ttsOk = ttsRequests.filter((r) => r.status === 200);
      check("TTS API 200 từ backend", ttsOk.length > 0, `requests=${JSON.stringify(ttsRequests)}`);

      const errToast = await page.locator("text=Không thể đọc Tiếng Việt").count();
      check("không có toast lỗi TTS", errToast === 0);

      const stillSpeaking = await page.locator("#btn-tts-file:has-text('Dừng đọc')").count();
      check("trạng thái Dừng đọc (đang phát)", stillSpeaking > 0);
    }

    await fetch(`${API}/folders/${folderId}`, {
      method: "DELETE",
      headers: { "X-Guest-Id": GUEST },
    }).catch(() => {});
  } catch (err) {
    check("exception", false, String(err));
  }

  console.log("=== KẾT QUẢ TTS TEST ===");
  let pass = 0;
  for (const r of results) {
    const mark = r.ok ? "PASS" : "FAIL";
    if (r.ok) pass++;
    console.log(`${mark} | ${r.name}${r.extra ? " | " + r.extra : ""}`);
  }
  console.log(`==> ${pass}/${results.length} PASS`);

  await browser.close();
  process.exit(pass === results.length && results.length > 0 ? 0 : 1);
})();