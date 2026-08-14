/**
 * Dịch vụ phát âm thanh Neural TTS qua Edge-TTS API / Hugging Face Serverless
 */

export interface SpeechOptions {
  rate?: number; // 0.5 - 2.0
  pitch?: number; // 0.5 - 1.5
  voice?: string; // Mặc định 'vi-VN-HoaiMyNeural'
}

let currentAudio: HTMLAudioElement | null = null;

export const stopEdgeSpeech = (): void => {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
};

export const speakWithEdgeTts = async (
  text: string,
  options: SpeechOptions = {},
  onEnd?: () => void,
  onError?: () => void,
): Promise<boolean> => {
  try {
    stopEdgeSpeech();

    const voice = options.voice || "vi-VN-HoaiMyNeural";
    const rate = options.rate || 1.0;

    // Chuyển đổi rate sang phần trăm theo định dạng Edge-TTS (+0%, +10%, -10%)
    const ratePercent = `${Math.round((rate - 1.0) * 100)}%`;
    const formattedRate = ratePercent.startsWith("-")
      ? ratePercent
      : `+${ratePercent}`;

    // Endpoint API xử lý Edge-TTS public/proxy
    const response = await fetch("https://edge-tts-api.vercel.app/api/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text,
        voice: voice,
        rate: formattedRate,
      }),
    });

    if (!response.ok) {
      throw new Error(`Edge-TTS API Error: ${response.statusText}`);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    currentAudio = new Audio(audioUrl);

    currentAudio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;
      if (onEnd) onEnd();
    };

    currentAudio.onerror = () => {
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;
      if (onError) onError();
    };

    await currentAudio.play();
    return true;
  } catch (error) {
    console.warn(
      "Edge-TTS Cloud gặp lỗi, chuẩn bị chuyển sang Web Speech API:",
      error,
    );
    if (onError) onError();
    return false;
  }
};
