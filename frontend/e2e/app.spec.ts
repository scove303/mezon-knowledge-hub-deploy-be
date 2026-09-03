import { test, expect, type Page } from "@playwright/test";

type MockFile = {
  id: string;
  name: string;
  content: string;
  timestamps: Array<{ time: string; seconds: number; text: string }>;
};

type MockFolder = {
  id: string;
  name: string;
  type: string;
  files: MockFile[];
};

const INITIAL_SEED: MockFolder[] = [
  {
    id: "e2e-folder-1",
    name: "E2E Python",
    type: "roadmap",
    files: [
      {
        id: "e2e-file-1",
        name: "Bai_01.md",
        content: "# Bài 1: Khởi động\n\nXin chào thế giới.",
        timestamps: [],
      },
    ],
  },
];

let seed: MockFolder[] = [];

async function setAuthSession(page: Page) {
  // Set auth cookie for Next.js middleware
  await page.context().addCookies([
    {
      name: "mf_logged_in",
      value: "1",
      domain: "localhost",
      path: "/",
    },
  ]);

  // Set Zustand persist store in localStorage
  await page.addInitScript(() => {
    localStorage.setItem("mf-onboarded-v1", "1");
    localStorage.setItem("mf-expanded-folders", JSON.stringify(["e2e-folder-1"]));
    localStorage.setItem(
      "mezon-auth",
      JSON.stringify({
        state: {
          user: {
            id: 1,
            username: "tester",
            display_name: "Tester",
            email: "tester@mezon.io",
            role: "USER",
          },
          accessToken: "mock-access-token",
          refreshToken: "mock-refresh-token",
          isAuthenticated: true,
        },
        version: 0,
      })
    );
  });
}

// Chặn toàn bộ API backend, trả dữ liệu mock để e2e chạy độc lập
async function mockApi(page: Page) {
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const method = req.method();

    if (method === "GET" && path === "/api/v1/folders") {
      return route.fulfill({ json: { success: true, data: seed } });
    }

    if (method === "POST" && path === "/api/v1/folders") {
      const body = req.postDataJSON();
      const folder: MockFolder = {
        id: `e2e-new-${Date.now()}`,
        name: body.name,
        type: "general",
        files: [],
      };
      seed = [folder, ...seed];
      return route.fulfill({
        json: { success: true, data: { id: folder.id, name: folder.name } },
      });
    }

    if (method === "GET" && path.startsWith("/api/v1/files/")) {
      const id = path.split("/").pop();
      const file = seed.flatMap((f) => f.files).find((f) => f.id === id);
      if (file) {
        return route.fulfill({ json: { success: true, data: file } });
      }
    }

    return route.fulfill({ json: { success: false, data: null } });
  });
}

test.describe("Auth guard & Protected routes", () => {
  test("chưa đăng nhập truy cập /dashboard bị redirect về /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText("Mezon MindFolder")).toBeVisible();
  });
});

test.describe("Authenticated Dashboard flow", () => {
  test.beforeEach(async ({ page }) => {
    seed = JSON.parse(JSON.stringify(INITIAL_SEED));
    await setAuthSession(page);
    await mockApi(page);
  });

  test("dashboard hiển thị thông tin người dùng đã đăng nhập", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
    await page.getByTitle("Toggle Sidebar").click();
    await expect(page.getByRole("button", { name: /Tester/ })).toBeVisible();
  });

  test("Ctrl+K tạo folder mới → xuất hiện trong sidebar", async ({ page }) => {
    await page.goto("/dashboard");

    // Mở sidebar
    await page.getByTitle("Toggle Sidebar").click();

    // Mở palette, gõ tên folder mới, Enter để chọn hành động "Tạo thư mục"
    await page.keyboard.press("Control+K");
    const paletteInput = page.getByPlaceholder(
      "Tìm tài liệu, thư mục hoặc gõ lệnh...",
    );
    await expect(paletteInput).toBeVisible();
    await paletteInput.fill("e2e-folder-moi");
    await expect(
      page.getByText('Tạo thư mục "e2e-folder-moi"', { exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Enter");

    // Palette đóng, sidebar hiển thị folder vừa tạo
    await expect(paletteInput).toBeHidden();
    await expect(page.getByText("e2e-folder-moi", { exact: true })).toBeVisible();
  });

  test("mở folder → bấm file → xem nội dung markdown", async ({ page }) => {
    await page.goto("/dashboard/folders/e2e-folder-1");

    // Bấm file (folder đã được mở tự động qua mf-expanded-folders)
    const fileItem = page.getByText("Bai_01.md");
    await expect(fileItem).toBeVisible();
    await fileItem.click();

    await expect(
      page.getByRole("heading", { name: "Bài 1: Khởi động" }),
    ).toBeVisible();
    await expect(page.getByText("Xin chào thế giới.")).toBeVisible();
  });

  test("palette chuyển theme sáng/tối qua class trên <html>", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    await page.getByTitle("Toggle Sidebar").click();
    await page.keyboard.press("Control+K");
    const paletteInput = page.getByPlaceholder(
      "Tìm tài liệu, thư mục hoặc gõ lệnh...",
    );
    await expect(paletteInput).toBeVisible();
    await paletteInput.fill("tối");

    await expect(
      page.getByText("Chuyển sang giao diện tối", { exact: true }),
    ).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    await expect(page.locator("html")).toHaveClass(/dark/);
  });
});