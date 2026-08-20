import {
  splitTextIntoChunks,
  normalizeTextForSpeech,
} from "./speechNormalizer";
import { speakWithEdgeTtsQueue, stopEdgeSpeech } from "./edgeTtsEngine";

export interface SystemSpeechConfig {
  rate: number;
  pitch: number;
  useCloudNeural: boolean;
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
  stopEdgeSpeech();
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
};

/**
 * Tìm giọng đọc Tiếng Việt nội cục của trình duyệt
 */
const getLocalVietnameseVoice = (): Promise<SpeechSynthesisVoice | null> => {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve(null);
      return;
    }

    const synth = window.speechSynthesis;
    const voices = synth.getVoices();

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
    }, 500);
  });
};

/**
 * Phát âm thanh cục bộ (Web Speech API Local Fallback - Linh hoạt)
 */
const speakLocalWebSpeech = async (
  rawText: string,
  onEnd?: () => void,
): Promise<void> => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    if (onEnd) onEnd();
    return;
  }

  window.speechSynthesis.cancel();
  const localVoice = await getLocalVietnameseVoice();
  const cleanText = normalizeTextForSpeech(rawText);
  const utterance = new SpeechSynthesisUtterance(cleanText);

  // Nếu tìm thấy giọng Tiếng Việt thì dùng, nếu không có sẽ gán giọng mặc định hệ thống
  if (localVoice) {
    utterance.voice = localVoice;
    utterance.lang = localVoice.lang;
  } else {
    utterance.lang = "vi-VN"; // Gán mã ngôn ngữ để trình duyệt tự điều phối
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
 * Điều phối chính: Phát giọng đọc đa tầng thông minh
 */
export const speakContent = async (
  rawMarkdownText: string,
  onEnd?: () => void,
): Promise<void> => {
  stopAllSpeech();

  // 1. Chia nhỏ văn bản thành các đoạn <= 180 ký tự
  const chunks = splitTextIntoChunks(rawMarkdownText, 180);

  if (chunks.length === 0) {
    if (onEnd) onEnd();
    return;
  }

  // 2. Thử gọi Cloud Neural TTS qua Hàng chờ Đa tuyến (Google TTS / Edge Proxy)
  if (currentConfig.useCloudNeural) {
    const success = await speakWithEdgeTtsQueue(
      chunks,
      { rate: currentConfig.rate, pitch: currentConfig.pitch },
      onEnd,
      () => {
        console.info("Đang chuyển hướng sang bộ tổng hợp âm thanh nội cục...");
        speakLocalWebSpeech(rawMarkdownText, onEnd);
      },
    );

    if (success) return;
  }

  // 3. Dự phòng cuối cùng: Phát qua Web Speech API
  await speakLocalWebSpeech(rawMarkdownText, onEnd);
};
