import {
  splitTextIntoChunks,
  normalizeTextForSpeech,
} from "./speechNormalizer";
import { speakWithEdgeTtsQueue, stopEdgeSpeech } from "./edgeTtsEngine";
import { useToastStore } from "@/stores/toast";

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
 * Phát âm thanh cục bộ (Web Speech API Local Fallback)
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

  // BỘ BẢO VỆ (VOICE GUARD):
  // Chặn không cho tự động chuyển sang giọng mặc định Tiếng Anh nếu hệ điều hành không cài gói vi-VN
  if (!localVoice) {
    useToastStore
      .getState()
      .addToast(
        "Không thể đọc Tiếng Việt: Thiết bị của bạn chưa cài gói giọng đọc Tiếng Việt cục bộ và kết nối Cloud AI bị gián đoạn.",
        "error",
        6000,
      );
    if (onEnd) onEnd();
    return;
  }

  const cleanText = normalizeTextForSpeech(rawText);
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.voice = localVoice;
  utterance.lang = localVoice.lang;
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
 * Điều phối chính: Phát giọng đọc thông minh
 */
export const speakContent = async (
  rawMarkdownText: string,
  onEnd?: () => void,
): Promise<void> => {
  stopAllSpeech();

  // 1. Chia nhỏ văn bản thành các đoạn <= 250 ký tự
  const chunks = splitTextIntoChunks(rawMarkdownText, 250);

  if (chunks.length === 0) {
    if (onEnd) onEnd();
    return;
  }

  // 2. Thử gọi Cloud Neural TTS theo hàng chờ
  if (currentConfig.useCloudNeural) {
    const success = await speakWithEdgeTtsQueue(
      chunks,
      { rate: currentConfig.rate, pitch: currentConfig.pitch },
      onEnd,
      () => {
        console.info(
          "Chuyển hướng sang bộ tổng hợp âm thanh nội cục (Local Fallback)...",
        );
        speakLocalWebSpeech(rawMarkdownText, onEnd);
      },
    );

    if (success) return;
  }

  // 3. Nếu tắt Cloud Neural, phát trực tiếp qua Web Speech API
  await speakLocalWebSpeech(rawMarkdownText, onEnd);
};
