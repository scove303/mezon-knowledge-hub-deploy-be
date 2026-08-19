// Bổ sung cờ dừng isCancelled và chuyển sang cơ chế xử lý hàng chờ đoạn âm thanh speakWithEdgeTtsQueue.
/**
 * Engine phát âm thanh đa nguồn Cloud (Edge-TTS + Google TTS Fallback)
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

/**
 * Gọi Google Translate TTS (Kênh dự phòng miễn phí, độ khả dụng 99.9%)
 */
const fetchGoogleTtsAudio = async (text: string): Promise<string> => {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encodeURIComponent(text)}`;
  return url;
};

/**
 * Gọi Edge-TTS API (Kênh chính)
 */
const fetchEdgeTtsAudio = async (
  text: string,
  voice: string,
  rateFormatted: string,
): Promise<string> => {
  const response = await fetch("https://edge-tts-api.vercel.app/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice, rate: rateFormatted }),
  });

  if (!response.ok) throw new Error(`Edge-TTS Error ${response.status}`);
  const audioBlob = await response.blob();
  return URL.createObjectURL(audioBlob);
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

    let audioUrl = "";

    // Thử Nguồn 1: Edge-TTS Cloud
    try {
      audioUrl = await fetchEdgeTtsAudio(chunks[i], voice, formattedRate);
    } catch (e1) {
      console.warn(
        `Nguồn Edge-TTS lỗi đoạn ${i + 1}, tự động chuyển sang Nguồn 2 (Google Cloud)...`,
      );

      // Thử Nguồn 2: Google Translate TTS Fallback
      try {
        audioUrl = await fetchGoogleTtsAudio(chunks[i]);
      } catch (e2) {
        console.error(`Tất cả nguồn Cloud TTS đều thất bại ở đoạn ${i + 1}`);
        if (onError) onError();
        return false;
      }
    }

    // Phát âm thanh của đoạn hiện tại
    try {
      await new Promise<void>((resolve, reject) => {
        if (isCancelled) return reject(new Error("Cancelled"));

        currentAudio = new Audio(audioUrl);
        currentAudio.onended = () => {
          if (audioUrl.startsWith("blob:")) URL.revokeObjectURL(audioUrl);
          currentAudio = null;
          resolve();
        };
        currentAudio.onerror = () => {
          if (audioUrl.startsWith("blob:")) URL.revokeObjectURL(audioUrl);
          currentAudio = null;
          reject(new Error("Audio Playback Error"));
        };
        currentAudio.play().catch(reject);
      });
    } catch (err) {
      if (onError) onError();
      return false;
    }
  }

  if (onEnd && !isCancelled) onEnd();
  return true;
};
