/**
 * Engine phát âm thanh đa nguồn Cloud (Edge-TTS + Google TTS Fallback)
 * Đã tích hợp Pre-fetching bộ đệm âm thanh và giải phóng bộ nhớ tự động.
 */

export interface SpeechOptions {
  rate?: number; // 0.5 - 2.0
  pitch?: number; // 0.5 - 1.5
  voice?: string; // Mặc định 'vi-VN-HoaiMyNeural'
}

let currentAudio: HTMLAudioElement | null = null;
let isCancelled = false;
const activeBlobUrls: string[] = [];

const cleanupBlobUrls = (): void => {
  while (activeBlobUrls.length > 0) {
    const url = activeBlobUrls.pop();
    if (url && url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  }
};

export const stopEdgeSpeech = (): void => {
  isCancelled = true;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  cleanupBlobUrls();
};

/**
 * Gọi Google Translate TTS với cơ chế kiểm tra kết nối luồng thật
 */
const fetchGoogleTtsAudio = async (text: string): Promise<string> => {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encodeURIComponent(text)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Google TTS Error ${response.status}`);
  const audioBlob = await response.blob();
  const blobUrl = URL.createObjectURL(audioBlob);
  activeBlobUrls.push(blobUrl);
  return blobUrl;
};

/**
 * Gọi Edge-TTS API
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
  const blobUrl = URL.createObjectURL(audioBlob);
  activeBlobUrls.push(blobUrl);
  return blobUrl;
};

/**
 * Lấy âm thanh linh hoạt (Edge-TTS trước, Google TTS sau)
 */
const fetchAudioWithFallback = async (
  text: string,
  voice: string,
  rateFormatted: string,
): Promise<string> => {
  try {
    return await fetchEdgeTtsAudio(text, voice, rateFormatted);
  } catch (e1) {
    console.warn("Edge-TTS Cloud bận, chuyển sang Google Cloud TTS...");
    return await fetchGoogleTtsAudio(text);
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
  isCancelled = false;

  const voice = options.voice || "vi-VN-HoaiMyNeural";
  const rate = options.rate || 1.0;
  const ratePercent = `${Math.round((rate - 1.0) * 100)}%`;
  const formattedRate = ratePercent.startsWith("-")
    ? ratePercent
    : `+${ratePercent}`;

  if (chunks.length === 0) {
    if (onEnd) onEnd();
    return true;
  }

  try {
    // Tải trước đoạn đầu tiên
    let currentPromise = fetchAudioWithFallback(
      chunks[0],
      voice,
      formattedRate,
    );

    for (let i = 0; i < chunks.length; i++) {
      if (isCancelled) return false;

      const audioUrl = await currentPromise;

      // Nối dòng trước đoạn tiếp theo (Pre-fetch) nếu còn đoạn trong hàng chờ
      if (i + 1 < chunks.length) {
        currentPromise = fetchAudioWithFallback(
          chunks[i + 1],
          voice,
          formattedRate,
        );
      }

      if (isCancelled) return false;

      // Phát âm thanh đoạn hiện tại
      await new Promise<void>((resolve, reject) => {
        if (isCancelled) return reject(new Error("Cancelled"));

        currentAudio = new Audio(audioUrl);
        currentAudio.onended = () => {
          currentAudio = null;
          resolve();
        };
        currentAudio.onerror = () => {
          currentAudio = null;
          reject(new Error("Playback Error"));
        };
        currentAudio.play().catch(reject);
      });
    }

    cleanupBlobUrls();
    if (onEnd && !isCancelled) onEnd();
    return true;
  } catch (err) {
    cleanupBlobUrls();
    if (onError && !isCancelled) onError();
    return false;
  }
};
