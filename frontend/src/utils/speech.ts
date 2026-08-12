export const speakText = (
  text: string,
  onEnd?: () => void,
  options?: { rate?: number; pitch?: number },
) => {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    // Hủy các lượt đọc trước đó nếu có
    window.speechSynthesis.cancel();

    // Loại bỏ các ký tự Markdown cơ bản để đọc tự nhiên hơn
    const plainText = text.replace(/[#*`_~]/g, "");

    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.lang = "vi-VN";
    utterance.rate = options?.rate ?? 1.0;
    utterance.pitch = options?.pitch ?? 1.0;

    if (onEnd) utterance.onend = onEnd;
    utterance.onerror = () => onEnd?.();

    window.speechSynthesis.speak(utterance);
  }
};

export const stopSpeech = () => {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
};
