import { splitTextIntoChunks } from "./speechNormalizer";
import { speakWithGoogleTtsQueue, stopEdgeSpeech } from "./edgeTtsEngine";

export interface SystemSpeechConfig {
  rate: number;
}

let currentConfig: SystemSpeechConfig = {
  rate: 1.0,
};

export const updateSpeechConfig = (newConfig: Partial<SystemSpeechConfig>) => {
  currentConfig = { ...currentConfig, ...newConfig };
};

export const getSpeechConfig = (): SystemSpeechConfig => currentConfig;

export const stopAllSpeech = (): void => {
  stopEdgeSpeech();
};

export const speakContent = async (
  rawMarkdownText: string,
  onEnd?: () => void,
): Promise<void> => {
  stopAllSpeech();

  // Bắt buộc chia nhỏ văn bản thành mảng các chuỗi <= 70 ký tự
  const chunks = splitTextIntoChunks(rawMarkdownText, 70);
  console.log("[SpeechSystem] Tổng số đoạn sẽ phát:", chunks.length, chunks);

  if (chunks.length === 0) {
    if (onEnd) onEnd();
    return;
  }

  await speakWithGoogleTtsQueue(chunks, { rate: currentConfig.rate }, onEnd);
};
