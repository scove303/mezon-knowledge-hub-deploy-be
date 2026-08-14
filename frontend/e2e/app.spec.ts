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

let seed: MockFolder[] = [
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

// Chặn toàn bộ API backend, trả dữ liệu mock để e2e chạy độc lập
// (không cần MySQL/uvicorn). Flow đúng nghiệp vụ: POST tạo folder →
// GET /folders trả list mới → GET /files/{id} trả nội dung file.
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

test.describe("Guest flow (không cần login/backend)", () => {
  test("dashboard hiển thị banner khách", async ({ page }) => {
    await mockApi(page);
    await page.goto("/dashboard");
    await expect(
      page.getByText("Bạn đang dùng chế độ Khách", { exact: false }),
    ).toBeVisible();
  });

  test("Ctrl+K tạo folder mới → xuất hiện trong sidebar", async ({ page }) => {
    await mockApi(page);
    await page.goto("/dashboard");

    // Mở sidebar
    await page.getByTitle("Toggle Sidebar").click();
    await expect(page.getByText("Tất cả thư mục")).toBeVisible();

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
    await mockApi(page);
    await page.goto("/dashboard/folders/e2e-folder-1");

    // Sidebar tự mở ở trang folder (row trong tree là button)
    await expect(
      page.getByRole("button", { name: "E2E Python", exact: true }),
    ).toBeVisible();

    // Bấm file → FileViewer render nội dung (heading # của markdown).
    // Lưu ý: accessible name của row file là "File" → dùng getByText
    await page.getByText("Bai_01.md", { exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Bài 1: Khởi động" }),
    ).toBeVisible();
    await expect(page.getByText("Xin chào thế giới.")).toBeVisible();
  });

  test("palette chuyển theme sáng/tối qua class trên <html>", async ({
    page,
  }) => {
    await mockApi(page);
    await page.goto("/dashboard");

    // Click 1 điểm trên trang để đảm bảo focus (Ctrl+K cần page được focus)
    await page.getByTitle("Toggle Sidebar").click();
    await page.keyboard.press("Control+K");
    const paletteInput = page.getByPlaceholder(
      "Tìm tài liệu, thư mục hoặc gõ lệnh...",
    );
    await expect(paletteInput).toBeVisible();
    await paletteInput.fill("tối");

    // Mặc định theme "light" → mục đổi sang tối.
    // Lưu ý: item "Tạo thư mục ..." luôn khớp query (label nhúng query)
    // nên phải ArrowDown để chọn item theme (index 1).
    await expect(
      page.getByText("Chuyển sang giao diện tối", { exact: true }),
    ).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    await expect(page.locator("html")).toHaveClass(/dark/);
  });
});