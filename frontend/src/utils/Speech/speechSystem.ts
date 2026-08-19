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

const getLocalVietnameseVoice = (): Promise<SpeechSynthesisVoice | null> => {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve(null);
      return;
    }

    const synth = window.speechSynthesis;
    const voices = synth.getVoices();

    const findStrictVietnameseVoice = (list: SpeechSynthesisVoice[]) => {
      return (
        list.find(
          (v) =>
            (v.lang === "vi-VN" || v.lang.startsWith("vi")) &&
            (v.name.includes("Google") ||
              v.name.includes("Natural") ||
              v.name.includes("HoaiMy") ||
              v.name.includes("NamMinh")),
        ) ||
        list.find(
          (v) =>
            v.lang === "vi-VN" && !v.name.toLowerCase().includes("english"),
        ) ||
        null
      );
    };

    const voice = findStrictVietnameseVoice(voices);
    if (voice) {
      resolve(voice);
      return;
    }

    synth.onvoiceschanged = () => {
      resolve(findStrictVietnameseVoice(synth.getVoices()));
    };

    setTimeout(() => {
      resolve(findStrictVietnameseVoice(synth.getVoices()));
    }, 800);
  });
};

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

  if (!localVoice) {
    useToastStore
      .getState()
      .addToast(
        "Không thể bật giọng đọc nội cục: Máy tính của bạn chưa cài gói ngôn ngữ Tiếng Việt (vi-VN). Hãy bật kết nối mạng để dùng giọng đọc AI Cloud.",
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

export const speakContent = async (
  rawMarkdownText: string,
  onEnd?: () => void,
): Promise<void> => {
  stopAllSpeech();

  // Chuẩn hóa ngắt đoạn tối đa 100 ký tự cho nguồn Cloud
  const chunks = splitTextIntoChunks(rawMarkdownText, 100);

  if (chunks.length === 0) {
    if (onEnd) onEnd();
    return;
  }

  if (currentConfig.useCloudNeural) {
    const success = await speakWithEdgeTtsQueue(
      chunks,
      { rate: currentConfig.rate, pitch: currentConfig.pitch },
      onEnd,
      () => {
        console.info(
          "Kết nối Cloud gián đoạn, đang chuyển hướng sang bộ tổng hợp âm thanh nội cục (Local Fallback)...",
        );
        speakLocalWebSpeech(rawMarkdownText, onEnd);
      },
    );

    if (success) return;
  }

  await speakLocalWebSpeech(rawMarkdownText, onEnd);
};
