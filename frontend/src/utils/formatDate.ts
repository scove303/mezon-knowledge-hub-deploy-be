/**
 * Định dạng chuỗi ngày tháng ISO sang chuẩn hiển thị tiếng Việt ngày/tháng/năm.
 * @params dateString - Chuỗi thời gian chuẩn ISO (Ví dụ: "2026-07-15T18:00:00Z")
 * @returns Chuỗi hiển thị dạng "15/07/2026"
 */
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Chưa rõ thời gian";

    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  } catch (err) {
    return "Chưa rõ thời gian";
  }
}
