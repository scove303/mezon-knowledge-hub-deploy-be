/**
 * Chuyển đổi số giây thô thành chuỗi thời gian video định dạng hh:mm:ss hoặc mm:ss
 * @param seconds - Tổng số giây phát video
 * @returns Chuỗi định dạng thời gian (Ví dụ: "03:15" hoặc "01:15:30")
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const paddedMins = mins.toString().padStart(2, "0");
  const paddedSecs = secs.toString().padStart(2, "0");

  if (hrs > 0) {
    const paddedHrs = hrs.toString().padStart(2, "0");
    return `${paddedHrs}:${paddedMins}:${paddedSecs}`;
  }

  return `${paddedMins}:${paddedSecs}`;
}
