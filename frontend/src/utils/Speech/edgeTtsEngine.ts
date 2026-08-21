// Bổ sung cờ dừng isCancelled và chuyển sang cơ chế xử lý hàng chờ đoạn âm thanh speakWithEdgeTtsQueue.
/**
 * Dịch vụ phát âm thanh Neural TTS qua backend của chính ứng dụng (Edge TTS trực tiếp),
 * thay thế proxy thứ 3 (edge-tts-api.vercel.app) đã ngừng hoạt động.
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

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

const getGuestId = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("mezon-guest-id");
  } catch {
    return null;
  }
};

const fetchAudioBlob = async (
  text: string,
  voice: string,
  rate: string,
  pitch: string,
): Promise<Blob> => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const guestId = getGuestId();
  if (guestId) headers["X-Guest-Id"] = guestId;

  // Thử lại tối đa 3 lần (endpoint có thể quá tải tạm thời)
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (isCancelled) throw new Error("Playback Cancelled");
    try {
      const response = await fetch(`${BASE_URL}/tts`, {
        method: "POST",
        headers,
        body: JSON.stringify({ text, voice, rate, pitch }),
      });
      if (!response.ok) {
        throw new Error(`TTS API Error: ${response.status}`);
      }
      return await response.blob();
    } catch (error) {
      lastError = error;
      if (isCancelled) throw error;
      await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
    }
  }
  throw lastError;
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
  const pitch = options.pitch ?? 1.0;
  const formattedPitch = `${Math.round((pitch - 1.0) * 50)}Hz`;

  for (let i = 0; i < chunks.length; i++) {
    if (isCancelled) return false;

    try {
      const audioBlob = await fetchAudioBlob(
        chunks[i],
        voice,
        formattedRate,
        formattedPitch,
      );
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