// Chuyển chuỗi "02:15" hoặc "01:02:15" thành số giây tuyệt đối
export function timeStringToSeconds(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(":").map(Number);
  if (parts.some(isNaN)) return 0;

  if (parts.length === 2) {
    // Định dạng MM:SS
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    // Định dạng HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

// Chuyển toàn bộ các chuỗi dạng [02:15] trong văn bản Markdown thành link [02:15](timestamp://135)
export function parseTimestampsToMarkdownLinks(content) {
  if (!content) return "";
  // Biểu thức chính quy quét các mốc dạng [02:15] hoặc [01:20:45]
  const timestampRegex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;

  return content.replace(timestampRegex, (match, timeStr) => {
    const seconds = timeStringToSeconds(timeStr);
    return `[${timeStr}](timestamp://${seconds})`;
  });
}
