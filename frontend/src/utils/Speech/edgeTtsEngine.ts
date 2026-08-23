/**
 * Dịch vụ phát âm thanh TTS đa tầng:
 * 1. Backend /api/v1/tts (Microsoft Edge TTS) - PRIMARY
 * 2. Google Translate TTS - FALLBACK
 * 3. Browser Web Speech API - FINAL FALLBACK
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export interface SpeechOptions {
  rate?: number; // 0.5 - 2.0
  pitch?: number; // 0.5 - 1.5
  voice?: string; // vi-VN-HoaiMyNeural (female), vi-VN-NamMinhNeural (male), google-translate
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

const buildGoogleTtsUrl = (text: string): string => {
  const encodedText = encodeURIComponent(text);
  return `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=vi&client=tw-ob`;
};

const fetchBackendTtsBlob = async (
  text: string,
  voice: string,
  rate: string,
  pitch: string,
): Promise<Blob> => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const guestId = getGuestId();
  if (guestId) headers["X-Guest-Id"] = guestId;

  const url = `${BASE_URL}/tts`;

  // Retry up to 2 times on network error
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (isCancelled) throw new Error("Playback Cancelled");
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ text, voice, rate, pitch }),
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`TTS API Error: ${response.status} - ${errText}`);
      }
      return await response.blob();
    } catch (error) {
      if (isCancelled) throw error;
      await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
    }
  }
  throw new Error("TTS backend unavailable after retries");
};

export const speakWithEdgeTtsQueue = async (
  chunks: string[],
  options: SpeechOptions = {},
  onEnd?: () => void,
  onError?: () => void,
): Promise<boolean> => {
  stopEdgeSpeech();  // Stop current playback first
  isCancelled = false;  // Then reset cancellation flag for new playback

  const voice = options.voice || "vi-VN-HoaiMyNeural";
  const rate = options.rate || 1.0;
  const ratePercent = `${Math.round((rate - 1.0) * 100)}%`;
  const formattedRate = ratePercent.startsWith("-") ? ratePercent : `+${ratePercent}`;
  const pitch = options.pitch ?? 1.0;
  const pitchValue = Math.round((pitch - 1.0) * 50);
  const formattedPitch = pitchValue >= 0 ? `+${pitchValue}Hz` : `${pitchValue}Hz`;

  const isMicrosoftVoice = voice.startsWith("vi-VN-");

  for (let i = 0; i < chunks.length; i++) {
    if (isCancelled) return false;

    try {
      let audioUrl = "";
      let isBlobUrl = false;

      if (isMicrosoftVoice) {
        try {
          const audioBlob = await fetchBackendTtsBlob(
            chunks[i],
            voice,
            formattedRate,
            formattedPitch,
          );
          audioUrl = URL.createObjectURL(audioBlob);
          isBlobUrl = true;
        } catch (backendError) {
          console.warn("Backend TTS failed, falling back to Google Translate:", backendError);
        }
      }

      if (!isBlobUrl) {
        try {
          audioUrl = buildGoogleTtsUrl(chunks[i]);
        } catch (googleError) {
          console.warn("Google TTS failed:", googleError);
          if (onError) onError();
          return false;
        }
      }

      await new Promise<void>((resolve, reject) => {
        if (isCancelled) {
          if (isBlobUrl) URL.revokeObjectURL(audioUrl);
          return reject(new Error("Playback Cancelled"));
        }

        currentAudio = new Audio(audioUrl);

        currentAudio.onended = () => {
          if (isBlobUrl) URL.revokeObjectURL(audioUrl);
          currentAudio = null;
          resolve();
        };

        currentAudio.onerror = () => {
          if (isBlobUrl) URL.revokeObjectURL(audioUrl);
          currentAudio = null;
          if (!isBlobUrl && onError) {
            onError();
          }
          reject(new Error("Audio Playback Error"));
        };

        currentAudio.play().catch(reject);
      });
    } catch (error) {
      console.warn(`Chunk ${i + 1}/${chunks.length} failed:`, error);
      if (onError) onError();
      return false;
    }
  }

  if (onEnd && !isCancelled) onEnd();
  return true;
};