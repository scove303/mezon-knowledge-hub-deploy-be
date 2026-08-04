/**
 * hàm tiện ích khi dùng tailwind, xử lý logic điều kiện và bỏ xung đột
 */

import { ClassValue, clsx } from "clsx";
/**
 * Ví dụ: Bạn có thể viết clsx("btn", isActive ? "btn-active" : "btn-inactive"). Nếu isActive là true, nó trả về "btn btn-active". Nếu false, nó trả về "btn btn-inactive". Nó loại bỏ giá trị null, undenfined hoặc false không mong muốn.
 */

import { twMerge } from "tailwind-merge";
/**
 * Tailwind có các class xung đột nhau, p-2 và p-4. Nếu bạn lỡ viết cả hai, twMerge sẽ tự động loại bỏ các cũ và giữ lại cái sau (p-4), tránh việc class này đè lên class kia một cách vô lý.
 */

/**
 * Hàm ghép nối các class Tailwind CSS một cách thông minh, tự động loại bỏ các class bị trùng lặp hoặc xung đột.
 * @param inputs - Danh sách các chuỗi class hoặc đối tượng điều kiện class.
 * @returns Chuỗi class đã được tối ưu hóa hoàn chỉnh.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Ví dụ:
 * <button
 * className={cn(
 * // 1. Các class mặc định (luôn có)
 * "px-4 py-2 rounded-lg font-medium transition-colors",
 * // 2. Class điều kiện dựa trên biến
 * variant === "primary" ? "bg-blue-600 text-white" : "bg-gray-200 text-black",
 * // 3. Class khi ở trạng thái disable
 * disable && "opacity-50 cursor-not-allowed",
 * // 4. Class tùy chỉnh từ bên ngoài (có thể gây xung đột)
 * className
 * >
 * </button>
 * */
