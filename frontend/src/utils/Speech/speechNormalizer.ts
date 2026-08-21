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
  python: "Pai-thơn",
  vue: "Vưu",
  angular: "Ăng-gu-la",
};

/**
 * Chuyển đổi công thức LaTeX sang câu đọc tiếng Việt tự nhiên
 */
const convertLatexToSpokenVietnamese = (text: string): string => {
  let result = text;

  // 1. Phân số: \frac{a}{b} -> a phần b
  result = result.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1 phần $2");

  // 2. Căn bậc hai: \sqrt{x} -> căn bậc hai của x
  result = result.replace(/\\sqrt\{([^}]+)\}/g, "căn bậc hai của $1");

  // 3. Mũ / Lũy thừa
  result = result.replace(/([a-zA-Z0-9]+)\^2\b/g, "$1 bình phương");
  result = result.replace(/([a-zA-Z0-9]+)\^3\b/g, "$1 lập phương");
  result = result.replace(/([a-zA-Z0-9]+)\^\{([^}]+)\}/g, "$1 mũ $2");
  result = result.replace(/([a-zA-Z0-9]+)\^([0-9a-zA-Z])/g, "$1 mũ $2");

  // 4. Chỉ số dưới
  result = result.replace(/([a-zA-Z0-9]+)_\{([^}]+)\}/g, "$1 chỉ số $2");
  result = result.replace(/([a-zA-Z0-9]+)_([0-9a-zA-Z])/g, "$1 chỉ số $2");

  // 5. Ký hiệu toán học đặc biệt
  result = result.replace(
    /\\int_\{([^}]+)\}\^\{([^}]+)\}/g,
    "tích phân từ $1 đến $2",
  );
  result = result.replace(/\\int/g, "tích phân");
  result = result.replace(/\\sum/g, "tổng");
  result = result.replace(/\\infty/g, "vô cực");

  // 6. Ký hiệu Hy Lạp
  result = result.replace(/\\alpha/g, "an-pha");
  result = result.replace(/\\beta/g, "bê-ta");
  result = result.replace(/\\pi/g, "pi");
  result = result.replace(/\\theta/g, "thê-ta");

  // 7. Các phép toán so sánh
  result = result.replace(/\\le|\\leq/g, "nhỏ hơn hoặc bằng");
  result = result.replace(/\\ge|\\geq/g, "lớn hơn hoặc bằng");
  result = result.replace(/\\neq/g, "khác");
  result = result.replace(/\\times/g, "nhân");
  result = result.replace(/\\div/g, "chia");

  // Loại bỏ các dấu $
  result = result.replace(/\$/g, "");

  return result;
};

/**
 * Chuẩn hóa toàn bộ văn bản Markdown và tiếng Anh trước khi đưa vào TTS Engine
 */
export const normalizeTextForSpeech = (markdownText: string): string => {
  if (!markdownText) return "";

  let text = markdownText;

  // Chuyển đổi công thức Toán học LaTeX
  text = convertLatexToSpokenVietnamese(text);

  // Xử lý khối mã nguồn (Code blocks)
  text = text.replace(/```(\w+)?[\s\S]*?```/g, (_match, lang) => {
    return ` Khối mã nguồn ${lang || ""} được bỏ qua. `;
  });

  // Xử lý mã nguồn nội dòng (`code`)
  text = text.replace(/`([^`]+)`/g, "$1");

  // Bỏ liên kết timestamp
  text = text.replace(/\[([^\]]+)\]\(timestamp:\/\/\d+\)/g, "$1");

  // Bỏ đường dẫn URL biểu diễn bằng markdown
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // Xóa các ký tự định dạng Markdown
  text = text.replace(/[#*_~>|]/g, " ");

  // Thay thế từ mượn Tiếng Anh chuyên ngành bằng phiên âm Tiếng Việt
  const words = text.split(/(\s+|[.,!?;()])/);
  const normalizedWords = words.map((word) => {
    const cleanWord = word.toLowerCase().trim();
    if (ENGLISH_LOANWORDS_MAP[cleanWord]) {
      return ENGLISH_LOANWORDS_MAP[cleanWord];
    }
    return word;
  });

  text = normalizedWords.join("");

  // Làm sạch khoảng trắng thừa
  return text.replace(/\s+/g, " ").trim();
};

/**
 * Chia nhỏ văn bản thành các đoạn ngắn đảm bảo độ dài <= 180 ký tự
 */
export const splitTextIntoChunks = (
  text: string,
  maxLength: number = 180,
): string[] => {
  if (!text) return [];
  const cleanText = normalizeTextForSpeech(text);

  const sentences = cleanText.match(/[^.!?;\n]+[.!?;\n]+/g) || [cleanText];
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxLength) {
      currentChunk += sentence + " ";
    } else {
      if (currentChunk.trim()) chunks.push(currentChunk.trim());
      currentChunk = sentence + " ";
    }
  }
  if (currentChunk.trim()) chunks.push(currentChunk.trim());
  return chunks;
};
