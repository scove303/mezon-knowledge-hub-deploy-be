# MERGE NOTES — Khiet → development

Ngày: 31/07/2026

## Quyết định chính (theo yêu cầu)
- **GIỮ từ Khiet**: hệ thống đổi theme (3 theme: light / dark / crimson-dark) + vị trí hiển thị avatar/email/username ở đáy Sidebar (`UserProfileMenu.tsx`, kèm ThemeToggle + Đăng xuất trong dropdown).
- **BỎ từ development**: khối avatar/user cũ trong `Sidebar.jsx` (avatar_url + display_name + email + dropdown logout riêng).

## 4 file conflict + cách resolve
| File | Nội dung conflict | Quyết định |
|---|---|---|
| `Sidebar.jsx` | Khiet: UserProfileMenu + inline tạo file (stub) + confirm(); Dev: avatar block + toast + modal xóa + phím Delete + skeleton + MOCK_FOLDERS | Lấy bản **dev làm nền** (đầy đủ chức năng), **thay khối avatar/user dev bằng UserProfileMenu của Khiet** ở footer; xóa `next/image`, state `showUserMenu`. Giữ của dev: toast, modal xóa + phím Delete, skeleton loading, MOCK_FOLDERS |
| `layout.tsx` | Khiet: script chống flash theme + import styles/global.css; Dev: import globals.css + favicon 📁 | **Gộp cả 2**: script theme của Khiet (chống FOUC, đọc `app-theme-storage`) + favicon của dev + import `globals.css` hợp nhất |
| `ChatInput.tsx` | Gần như giống nhau (chỉ khác quote style); Khiet thêm icon `Loader2` | **Lấy Khiet** (giữ Loader2) |
| `package.json` | Khiet: `clsx`, `tailwind-merge`, `tailwindcss-animate`; Dev: `@react-oauth/google` | **Gộp cả 2** (không mất bên nào) |
| `package-lock.json` | File lock khác nhau | Regenerate bằng `npm install` sau merge |

## Các thay đổi phụ (đã làm trong lúc merge)
1. **CSS**: gộp toàn bộ nội dung `src/styles/global.css` (khối `@theme`, `:root`, `[data-theme="dark"|"crimson-dark"]`, `@layer base`) vào `src/app/globals.css` rồi **xóa** `styles/global.css` — vì import cả 2 file làm Turbopack emit duplicate preflight (gấp đôi CSS). Đã verify: preflight x1, utility `bg-card`/`border-border`/`text-foreground` hoạt động.
2. **Xóa** `package-lock.json` ở root repo (file rác, chỉ tồn tại trên Khiet).
3. Nút "+" trong thư mục: giữ hành vi của dev (toast "tạo file bằng AI") thay vì inline-create của Khiet (vì backend chưa có endpoint tạo file thủ công).
4. Emoji folder document: giữ "📄" của dev (Khiet dùng "🚗").
5. `useThemeStore.ts` của dev là file rỗng → bị bản thật của Khiet thay thế (có chủ ý).

## Tự động merge (không conflict) — giữ nguyên
- **Từ Khiet**: `ThemeToggle.tsx`, `UserProfileMenu.tsx`, `types/theme.ts`, `useThemeStore.ts`, các `utils/*`, `tailwind.config.ts`, `tsconfig.json`, `.storybook/`
- **Từ development**: `/register` + `RegisterForm`, toast system (`stores/toast.js`, `Toast.jsx`), Google login/avatar (backend auth.py + migration email/avatar), axios refresh interceptor, FileViewer (xóa file, unsaved warning, Ctrl+S), AI services + backend (bot, alembic, workers...)

## Verify
- `npm install` + `npm run build` ✅ (6 routes: /, /login, /register, /dashboard, /dashboard/folders/[folderId])
- Không còn conflict markers; `git diff --check` sạch.
