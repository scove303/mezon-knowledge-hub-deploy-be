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

  text = convertLatexToSpokenVietnamese(text);
  text = text.replace(
    /```(\w+)?[\s\S]*?```/g,
    (_match, lang) => ` Khối mã nguồn ${lang || ""} được bỏ qua. `,
  );
  text = text.replace(/`([^`]+)`/g, "$1");
  text = text.replace(/\[([^\]]+)\]\(timestamp:\/\/\d+\)/g, "$1");
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  text = text.replace(/[#*_~>|]/g, " ");

  // Chuẩn hóa khoảng trắng ngang nhưng GIỮ LẠI dấu xuống dòng (\n)
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
};

export const splitTextIntoChunks = (
  text: string,
  maxLength: number = 80, // Giới hạn an toàn (tối đa Google là ~100)
): string[] => {
  if (!text) return [];
  const cleanText = normalizeTextForSpeech(text);
  if (!cleanText) return [];

  // Bước 1: Tách dòng theo ký tự xuống dòng
  const lines = cleanText.split(/\n+/);
  const rawSegments: string[] = [];

  for (const line of lines) {
    // Bước 2: Tách từng dòng theo dấu câu (. ? ! ; : ,) nhưng giữ lại ngắt câu tự nhiên
    const clauses = line
      .split(/(?<=[.?!;:,])\s+/)
      .map((c) => c.trim())
      .filter(Boolean);

    rawSegments.push(...clauses);
  }

  const chunks: string[] = [];
  let currentChunk = "";

  // Bước 3: Gom các mệnh đề ngắn lại sao cho tổng chiều dài <= maxLength
  for (const segment of rawSegments) {
    // Trường hợp câu/mệnh đề đơn lẻ vượt quá maxLength, bắt buộc phải cắt theo từ
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

    // Ghép câu/mệnh đề vào chunk hiện tại nếu chưa vượt ngưỡng
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
