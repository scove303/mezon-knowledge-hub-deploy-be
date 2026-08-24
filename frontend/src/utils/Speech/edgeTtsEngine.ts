export interface SpeechOptions {
  rate?: number;
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

const buildGoogleTtsUrl = (text: string): string => {
  const encodedText = encodeURIComponent(text);
  return `/api/google-tts?ie=UTF-8&q=${encodedText}&tl=vi&total=1&idx=0&textlen=${text.length}&client=tw-ob`;
};

export const speakWithGoogleTtsQueue = async (
  chunks: string[],
  options: SpeechOptions = {},
  onEnd?: () => void,
): Promise<boolean> => {
  stopEdgeSpeech();
  isCancelled = false;

  const rate = options.rate || 1.0;

  // Lặp qua từng chunk để gửi request riêng biệt
  for (let i = 0; i < chunks.length; i++) {
    if (isCancelled) return false;

    const currentText = chunks[i];
    const audioUrl = buildGoogleTtsUrl(currentText);

    // Console log để bạn kiểm tra từng URL gửi đi trong DevTools
    console.log(
      `[Google TTS] Đang đọc đoạn ${i + 1}/${chunks.length} (${currentText.length} ký tự): "${currentText}"`,
    );

    try {
      await new Promise<void>((resolve, reject) => {
        if (isCancelled) return reject(new Error("Playback Cancelled"));

        currentAudio = new Audio(audioUrl);
        currentAudio.playbackRate = rate;

        // Chỉ khi đoạn này đọc xong mới chuyển sang đoạn tiếp theo
        currentAudio.onended = () => {
          currentAudio = null;
          resolve();
        };

        currentAudio.onerror = (err) => {
          currentAudio = null;
          reject(err);
        };

        currentAudio.play().catch(reject);
      });
    } catch (error) {
      console.warn(`[Google TTS] Lỗi đọc đoạn ${i + 1}:`, error);
      return false;
    }
  }

  if (onEnd && !isCancelled) onEnd();
  return true;
};
