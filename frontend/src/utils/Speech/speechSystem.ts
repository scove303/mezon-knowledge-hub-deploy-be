import { normalizeTextForSpeech } from "./speechNormalizer";
import { speakWithEdgeTts, stopEdgeSpeech } from "./edgeTtsEngine";

export interface SystemSpeechConfig {
  rate: number;
  pitch: number;
  useCloudNeural: boolean; // Ưu tiên giọng Cloud Neural (Edge-TTS)
}

let currentConfig: SystemSpeechConfig = {
  rate: 1.0,
  pitch: 1.0,
  useCloudNeural: true,
};

export const updateSpeechConfig = (newConfig: Partial<SystemSpeechConfig>) => {
  currentConfig = { ...currentConfig, ...newConfig };
};

export const getSpeechConfig = (): SystemSpeechConfig => currentConfig;

export const stopAllSpeech = (): void => {
  // Dừng Edge-TTS Cloud
  stopEdgeSpeech();

  // Dừng Web Speech API Local
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
};

/**
 * Lấy giọng đọc Tiếng Việt nội cục chuẩn nhất của trình duyệt
 */
const getLocalVietnameseVoice = (): Promise<SpeechSynthesisVoice | null> => {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    let voices = synth.getVoices();

    const findVoice = (list: SpeechSynthesisVoice[]) => {
      return (
        list.find((v) => v.lang === "vi-VN" && v.name.includes("Google")) ||
        list.find((v) => v.lang === "vi-VN" || v.lang.startsWith("vi")) ||
        null
      );
    };

    const voice = findVoice(voices);
    if (voice) {
      resolve(voice);
      return;
    }

    synth.onvoiceschanged = () => {
      resolve(findVoice(synth.getVoices()));
    };

    setTimeout(() => {
      resolve(findVoice(synth.getVoices()));
    }, 800);
  });
};

/**
 * Phát âm thanh nội cục (Web Speech API Local Fallback)
 */
const speakLocalWebSpeech = async (
  cleanText: string,
  onEnd?: () => void,
): Promise<void> => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    if (onEnd) onEnd();
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(cleanText);
  const localVoice = await getLocalVietnameseVoice();

  if (localVoice) {
    utterance.voice = localVoice;
    utterance.lang = localVoice.lang;
  } else {
    utterance.lang = "vi-VN";
  }

  utterance.rate = currentConfig.rate;
  utterance.pitch = currentConfig.pitch;

  utterance.onend = () => {
    if (onEnd) onEnd();
  };

  utterance.onerror = () => {
    if (onEnd) onEnd();
  };

  window.speechSynthesis.speak(utterance);
};

/**
 * Hàm điều phối chính: Phát giọng đọc thông minh
 */
export const speakContent = async (
  rawMarkdownText: string,
  onEnd?: () => void,
): Promise<void> => {
  stopAllSpeech();

  // Step 1: Tiền xử lý làm sạch văn bản (Làm sạch Markdown, chuyển đổi LaTeX, phiên âm từ Anh)
  const cleanText = normalizeTextForSpeech(rawMarkdownText);

  if (!cleanText) {
    if (onEnd) onEnd();
    return;
  }

  // Step 2: Nếu bật cấu hình Cloud Neural, thử gọi Edge-TTS trước
  if (currentConfig.useCloudNeural) {
    const success = await speakWithEdgeTts(
      cleanText,
      { rate: currentConfig.rate, pitch: currentConfig.pitch },
      onEnd,
      () => {
        // Nếu Edge-TTS lỗi/offline, tự động Fallback sang Web Speech API
        console.info(
          "Chuyển hướng sang bộ tổng hợp âm thanh nội cục (Local Fallback)...",
        );
        speakLocalWebSpeech(cleanText, onEnd);
      },
    );

    if (success) return;
  }

  // Step 3: Phát trực tiếp qua Web Speech API
  await speakLocalWebSpeech(cleanText, onEnd);
};
