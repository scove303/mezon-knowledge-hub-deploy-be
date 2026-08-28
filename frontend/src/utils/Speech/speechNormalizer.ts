const convertLatexToSpokenVietnamese = (text: string): string => {
  let result = text;
  result = result.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1 phần $2");
  result = result.replace(/\\sqrt\{([^}]+)\}/g, "căn bậc hai của $1");
  result = result.replace(/([a-zA-Z0-9]+)\^2\b/g, "$1 bình phương");
  result = result.replace(/([a-zA-Z0-9]+)\^3\b/g, "$1 lập phương");
  result = result.replace(/([a-zA-Z0-9]+)\^\{([^}]+)\}/g, "$1 mũ $2");
  result = result.replace(/([a-zA-Z0-9]+)\^([0-9a-zA-Z])/g, "$1 mũ $2");
  result = result.replace(/([a-zA-Z0-9]+)_\{([^}]+)\}/g, "$1 chỉ số $2");
  result = result.replace(/([a-zA-Z0-9]+)_([0-9a-zA-Z])/g, "$1 chỉ số $2");
  result = result.replace(
    /\\int_\{([^}]+)\}\^\{([^}]+)\}/g,
    "tích phân từ $1 đến $2",
  );
  result = result.replace(/\\int/g, "tích phân");
  result = result.replace(/\\sum/g, "tổng");
  result = result.replace(/\\infty/g, "vô cực");
  result = result.replace(/\\alpha/g, "an-pha");
  result = result.replace(/\\beta/g, "bê-ta");
  result = result.replace(/\\pi/g, "pi");
  result = result.replace(/\\theta/g, "thê-ta");
  result = result.replace(/\\le|\\leq/g, "nhỏ hơn hoặc bằng");
  result = result.replace(/\\ge|\\geq/g, "lớn hơn hoặc bằng");
  result = result.replace(/\\neq/g, "khác");
  result = result.replace(/\\times/g, "nhân");
  result = result.replace(/\\div/g, "chia");
  result = result.replace(/\$/g, "");
  return result;
};

export const normalizeTextForSpeech = (markdownText: string): string => {
  if (!markdownText) return "";
  let text = markdownText;

  // Bước 1: Chuyển đổi biểu thức toán học LaTeX
  text = convertLatexToSpokenVietnamese(text);

  // Bước 2: Loại bỏ khối mã nguồn nhiều dòng (Code Blocks)
  text = text.replace(
    /```(\w+)?[\s\S]*?```/g,
    (_match, lang) => ` Khối mã nguồn ${lang || ""} được bỏ qua. `,
  );

  // Bước 3: Loại bỏ mã nguồn nội dòng (Inline Code)
  text = text.replace(/`([^`]+)`/g, "$1");

  // Bước 4: Loại bỏ thẻ neo Mindmap đặc thù [MINDMAP_NODE:xxx]
  text = text.replace(/\[MINDMAP_NODE:[^\]]+\]/g, "");

  // Bước 5: Loại bỏ liên kết hình ảnh ![mô tả](url) -> giữ lại mô tả nếu có
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");

  // Bước 6: Loại bỏ liên kết mốc thời gian timestamp:// và liên kết web thông thường [nhãn](url) -> giữ lại nhãn
  text = text.replace(/\[([^\]]+)\]\(timestamp:\/\/\d+\)/g, "$1");
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // Bước 7: Loại bỏ thẻ HTML (nếu có)
  text = text.replace(/<[^>]*>/g, " ");

  // Bước 8: Loại bỏ cú pháp Bảng Markdown (Loại bỏ đường kẻ phân cách bảng và ký tự gạch đứng |)
  text = text.replace(/^[\|\s\-:]+$/gm, "");
  text = text.replace(/\|/g, " ");

  // Bước 9: Loại bỏ ký hiệu Tiêu đề (#), Trích dẫn (>), Đường kẻ ngang (---, ***)
  text = text.replace(/^#{1,6}\s+/gm, "");
  text = text.replace(/^\s*>\s+/gm, "");
  text = text.replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, "");

  // Bước 10: Loại bỏ ký hiệu danh sách (gạch đầu dòng -, +, * hoặc số 1., 2.)
  text = text.replace(/^[ \t]*[-+*]\s+/gm, "");
  text = text.replace(/^[ \t]*\d+\.\s+/gm, "");

  // Bước 11: Loại bỏ định dạng in đậm, in nghiêng, gạch ngang (*, _, ~)
  text = text.replace(/[*_~]/g, "");

  // Bước 12: Chuẩn hóa khoảng trắng ngang nhưng giữ lại dấu xuống dòng (\n)
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
};

export const splitTextIntoChunks = (
  text: string,
  maxLength: number = 80,
): string[] => {
  if (!text) return [];
  const cleanText = normalizeTextForSpeech(text);
  if (!cleanText) return [];

  // Tách dòng theo ký tự xuống dòng
  const lines = cleanText.split(/\n+/);
  const rawSegments: string[] = [];

  for (const line of lines) {
    // Tách từng dòng theo dấu câu (. ? ! ; : ,) nhưng giữ ngắt câu tự nhiên
    const clauses = line
      .split(/(?<=[.?!;:,])\s+/)
      .map((c) => c.trim())
      .filter(Boolean);

    rawSegments.push(...clauses);
  }

  const chunks: string[] = [];
  let currentChunk = "";

  // Gom các mệnh đề ngắn sao cho tổng chiều dài <= maxLength
  for (const segment of rawSegments) {
    if (segment.length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = "";
      }

      const words = segment.split(/\s+/);
      for (const word of words) {
        const testChunk = currentChunk ? `${currentChunk} ${word}` : word;
        if (testChunk.length <= maxLength) {
          currentChunk = testChunk;
        } else {
          chunks.push(currentChunk);
          currentChunk = word;
        }
      }
      continue;
    }

    const testChunk = currentChunk ? `${currentChunk} ${segment}` : segment;
    if (testChunk.length <= maxLength) {
      currentChunk = testChunk;
    } else {
      chunks.push(currentChunk);
      currentChunk = segment;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
};
