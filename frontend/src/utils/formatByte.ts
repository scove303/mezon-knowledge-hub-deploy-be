/**
 * Định dạng dung lượng tệp tin từ đơn vị Bytes sang dạng dễ đọc (KB, MB, GB).
 * @param bytes - Dung lượng tệp tin dạng số nguyên
 * @returns Chuỗi định dạng dễ đọc (Ví dụ: "12.45 MB")
 */
export function formatByte(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  // Tính toán làm tròn đến 2 chữ số thập phân
  const formattedValue = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
  return `${formattedValue} ${sizes[i]}`;
}
