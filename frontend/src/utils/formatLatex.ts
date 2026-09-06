/**
 * Chuẩn hóa các cú pháp công thức toán học (LaTeX) từ LLM (Gemini / ChatGPT / Claude)
 * để `remark-math` và `rehype-katex` nhận diện và render chính xác 100%.
 */
export function normalizeLatex(content: string = ""): string {
  if (!content || typeof content !== "string") return "";

  return (
    content
      // 1. Chuyển block math \[ ... \] sang $$ ... $$
      .replace(/\\\[([\s\S]*?)\\\]/g, (_, equation) => `\n$$\n${equation.trim()}\n$$\n`)
      // 2. Chuyển inline math \( ... \) sang $ ... $
      .replace(/\\\(([\s\S]*?)\\\)/g, (_, equation) => `$${equation.trim()}$`)
  );
}

export default normalizeLatex;
