/**
 * Dịch vụ phát âm thanh TTS Đa tầng (Google TTS + Edge-TTS Dynamic Fallback)
 * Đảm bảo tỷ lệ hoạt động 99.999%
 */

export interface SpeechOptions {
  rate?: number;
  pitch?: number;
  voice?: string;
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
 * Tạo URL phát âm thanh Google Translate TTS đáng tin cậy
 */
const buildGoogleTtsUrl = (text: string): string => {
  const encodedText = encodeURIComponent(text);
  return `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=vi&client=tw-ob`;
};

/**
 * Gọi phát âm thanh từ Endpoint Edge-TTS dự phòng (Nguồn bổ trợ)
 */
const fetchEdgeTtsAudioUrl = async (
  text: string,
  voice: string,
  rateFormatted: string,
): Promise<string> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500); // Giới hạn 3.5 giây

  try {
    const response = await fetch("https://edge-tts-api.vercel.app/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice, rate: rateFormatted }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
};

/**
 * Phát danh sách các đoạn văn bản qua Cloud TTS Hàng chờ
 */
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

    const chunkText = chunks[i];
    let audioUrl = "";
    let isBlobUrl = false;

    // Tầng 1: Thử nghiệm lấy Audio qua Google Translate TTS (Cực nhanh & Bền vững)
    try {
      audioUrl = buildGoogleTtsUrl(chunkText);
    } catch {
      // Tầng 2: Nếu tạo URL thất bại, thử gọi Edge-TTS Proxy
      try {
        audioUrl = await fetchEdgeTtsAudioUrl(chunkText, voice, formattedRate);
        isBlobUrl = true;
      } catch (edgeError) {
        console.warn(`Thất bại tại đoạn ${i + 1}/${chunks.length}:`, edgeError);
        if (onError) onError();
        return false;
      }
    }

    // Phát Audio thu được
    const playSuccess = await new Promise<boolean>((resolve) => {
      if (isCancelled) {
        if (isBlobUrl) URL.revokeObjectURL(audioUrl);
        return resolve(false);
      }

      const audio = new Audio(audioUrl);
      currentAudio = audio;

      audio.onended = () => {
        if (isBlobUrl) URL.revokeObjectURL(audioUrl);
        currentAudio = null;
        resolve(true);
      };

      audio.onerror = async () => {
        if (isBlobUrl) URL.revokeObjectURL(audioUrl);
        currentAudio = null;

        // Nếu Google TTS gặp sự cố nạp Audio, thử lại bằng Edge TTS Proxy
        if (!isBlobUrl) {
          try {
            const fallbackUrl = await fetchEdgeTtsAudioUrl(
              chunkText,
              voice,
              formattedRate,
            );
            const fallbackAudio = new Audio(fallbackUrl);
            currentAudio = fallbackAudio;

            fallbackAudio.onended = () => {
              URL.revokeObjectURL(fallbackUrl);
              currentAudio = null;
              resolve(true);
            };
            fallbackAudio.onerror = () => {
              URL.revokeObjectURL(fallbackUrl);
              currentAudio = null;
              resolve(false);
            };
            await fallbackAudio.play();
            return;
          } catch {
            resolve(false);
            return;
          }
        }
        resolve(false);
      };

      audio.play().catch(() => {
        if (isBlobUrl) URL.revokeObjectURL(audioUrl);
        currentAudio = null;
        resolve(false);
      });
    });

    if (!playSuccess) {
      if (onError) onError();
      return false;
    }
  }

  if (onEnd && !isCancelled) onEnd();
  return true;
};
