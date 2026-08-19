/**
 * Dịch vụ phát âm thanh Neural TTS qua Edge-TTS API theo cơ chế Hàng chờ (Audio Queue)
 */

export interface SpeechOptions {
  rate?: number; // 0.5 - 2.0
  pitch?: number; // 0.5 - 1.5
  voice?: string; // Mặc định 'vi-VN-HoaiMyNeural'
}

let currentAudio: HTMLAudioElement | null = null;
let isCancelled = false;

export const stopEdgeSpeech = (): void => {
  isCancelled = true;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
};

export const speakWithEdgeTtsQueue = async (
  chunks: string[],
  options: SpeechOptions = {},
  onEnd?: () => void,
  onError?: () => void,
): Promise<boolean> => {
  isCancelled = false;
  stopEdgeSpeech();

  const voice = options.voice || "vi-VN-HoaiMyNeural";
  const rate = options.rate || 1.0;
  const ratePercent = `${Math.round((rate - 1.0) * 100)}%`;
  const formattedRate = ratePercent.startsWith("-")
    ? ratePercent
    : `+${ratePercent}`;

  for (let i = 0; i < chunks.length; i++) {
    if (isCancelled) return false;

    try {
      const response = await fetch("https://edge-tts-api.vercel.app/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: chunks[i],
          voice: voice,
          rate: formattedRate,
        }),
      });

      if (!response.ok) {
        throw new Error(`Edge-TTS API Error: ${response.statusText}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      await new Promise<void>((resolve, reject) => {
        if (isCancelled) {
          URL.revokeObjectURL(audioUrl);
          return reject(new Error("Playback Cancelled"));
        }

        currentAudio = new Audio(audioUrl);

        currentAudio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          currentAudio = null;
          resolve();
        };

        currentAudio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          currentAudio = null;
          reject(new Error("Audio Playback Error"));
        };

        currentAudio.play().catch(reject);
      });
    } catch (error) {
      console.warn(
        `Đoạn ${i + 1}/${chunks.length} gặp lỗi, chuyển hướng xử lý:`,
        error,
      );
      if (onError) onError();
      return false;
    }
  }

  if (onEnd && !isCancelled) onEnd();
  return true;
};
