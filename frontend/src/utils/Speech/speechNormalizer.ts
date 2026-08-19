/**
 * Bộ chuẩn hóa văn bản chuyên sâu cho giọng đọc Tiếng Việt
 * Xử lý Markdown, LaTeX Toán học và Từ mượn Tiếng Anh.
 */

const ENGLISH_LOANWORDS_MAP: Record<string, string> = {
  react: "Ri-éc",
  javascript: "Gia-va-scơ-rip",
  typescript: "Taip-scơ-rip",
  frontend: "Frơn-en",
  backend: "Bắc-en",
  api: "A-P-I",
  html: "H-T-M-L",
  css: "C-S-S",
  database: "Đa-ta-bei-sơ",
  file: "phai",
  files: "phai",
  viewer: "vưu-ơ",
  code: "cốt",
  developer: "đề-ve-lơ-pơ",
  node: "nốt",
  server: "sơ-vơ",
  client: "clai-ân",
};

const convertLatexToSpokenVietnamese = (text: string): string => {
  let result = text;

  result = result.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, `$1 phần $2`);
  result = result.replace(/\\sqrt\{([^}]+)\}/g, `căn bậc hai của $1`);
  result = result.replace(/([a-zA-Z0-9]+)\^2\b/g, `$1 bình phương`);
  result = result.replace(/([a-zA-Z0-9]+)\^3\b/g, `$1 lập phương`);
  result = result.replace(/([a-zA-Z0-9]+)\^\{([^}]+)\}/g, `$1 mũ $2`);
  result = result.replace(/([a-zA-Z0-9]+)\^([0-9a-zA-Z])/g, `$1 mũ $2`);
  result = result.replace(/([a-zA-Z0-9]+)_\{([^}]+)\}/g, `$1 chỉ số $2`);
  result = result.replace(/([a-zA-Z0-9]+)_([0-9a-zA-Z])/g, `$1 chỉ số $2`);
  result = result.replace(
    /\\int_\{([^}]+)\}\^\{([^}]+)\}/g,
    `tích phân từ $1 đến $2`,
  );
  result = result.replace(/\\int/g, `tích phân`);
  result = result.replace(/\\sum/g, `tổng`);
  result = result.replace(/\\infty/g, `vô cực`);
  result = result.replace(/\\alpha/g, `an-pha`);
  result = result.replace(/\\beta/g, `bê-ta`);
  result = result.replace(/\\pi/g, `pi`);
  result = result.replace(/\\theta/g, `thê-ta`);
  result = result.replace(/\\le|\\leq/g, `nhỏ hơn hoặc bằng`);
  result = result.replace(/\\ge|\\geq/g, `lớn hơn hoặc bằng`);
  result = result.replace(/\\neq/g, `khác`);
  result = result.replace(/\\times/g, `nhân`);
  result = result.replace(/\\div/g, `chia`);
  result = result.replace(/\$/g, ``);

  return result;
};

export const normalizeTextForSpeech = (markdownText: string): string => {
  if (!markdownText) return "";

  let text = markdownText;

  text = convertLatexToSpokenVietnamese(text);

  text = text.replace(/```(\w+)?[\s\S]*?```/g, (_match, lang) => {
    return ` Khối mã nguồn ${lang || ""} được bỏ qua. `;
  });

  text = text.replace(/`([^`]+)`/g, "$1");
  text = text.replace(/\[([^\]]+)\]\(timestamp:\/\/\d+\)/g, "$1");
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  text = text.replace(/[#*_~>|]/g, " ");

  const words = text.split(/(\s+|[.,!?;()])/);
  const normalizedWords = words.map((word) => {
    const cleanWord = word.toLowerCase().trim();
    if (ENGLISH_LOANWORDS_MAP[cleanWord]) {
      return ENGLISH_LOANWORDS_MAP[cleanWord];
    }
    return word;
  });

  text = normalizedWords.join("");
  return text.replace(/\s+/g, " ").trim();
};

/**
 * Chia nhỏ văn bản với giới hạn chuẩn 100 ký tự để phù hợp an toàn cho cả Edge-TTS và Google TTS
 */
export const splitTextIntoChunks = (
  text: string,
  maxLength: number = 100,
): string[] => {
  if (!text) return [];
  const cleanText = normalizeTextForSpeech(text);

  const sentences = cleanText.match(/[^.!?;\n]+[.!?;\n]+/g) || [cleanText];
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if (sentence.length > maxLength) {
      const words = sentence.split(" ");
      for (const word of words) {
        if ((currentChunk + " " + word).trim().length <= maxLength) {
          currentChunk = (currentChunk + " " + word).trim();
        } else {
          if (currentChunk.trim()) chunks.push(currentChunk.trim());
          currentChunk = word;
        }
      }
    } else if ((currentChunk + " " + sentence).trim().length <= maxLength) {
      currentChunk = (currentChunk + " " + sentence).trim();
    } else {
      if (currentChunk.trim()) chunks.push(currentChunk.trim());
      currentChunk = sentence.trim();
    }
  }
  if (currentChunk.trim()) chunks.push(currentChunk.trim());
  return chunks;
};
