// Hàm hỗ trợ lấy voice tiếng Việt (có xử lý chờ Chrome load danh sách voice)
const getVietnameseVoice = (): Promise<SpeechSynthesisVoice | null> => {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    let voices = synth.getVoices();

    const findVoice = (voiceList: SpeechSynthesisVoice[]) => {
      // 1. Ưu tiên cao nhất: "Google Tiếng Việt" (trên Chrome đọc rất tự nhiên)
      // 2. Ưu tiên 2: Bất kỳ voice nào có lang là 'vi-VN' hoặc bắt đầu bằng 'vi'
      return (
        voiceList.find(
          (v) => v.lang === "vi-VN" && v.name.includes("Google"),
        ) ||
        voiceList.find((v) => v.lang === "vi-VN" || v.lang.startsWith("vi")) ||
        null
      );
    };

    const targetVoice = findVoice(voices);
    if (targetVoice) {
      resolve(targetVoice);
      return;
    }

    // Nếu chưa load xong voice (đặc biệt trên Chrome/Edge), chờ sự kiện onvoiceschanged
    synth.onvoiceschanged = () => {
      voices = synth.getVoices();
      resolve(findVoice(voices));
    };

    // Timeout phòng trường hợp máy người dùng thực sự không hỗ trợ
    setTimeout(() => {
      resolve(findVoice(synth.getVoices()));
    }, 1000);
  });
};

export const speakText = async (text: string) => {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    // Hủy các lượt đọc trước đó nếu có
    window.speechSynthesis.cancel();

    // Loại bỏ các ký tự Markdown cơ bản (#, *, `, _) để tránh máy đọc luôn ký tự đặc biệt
    const plainText = text.replace(/[#*`_~]/g, "");
    const utterance = new SpeechSynthesisUtterance(plainText);

    // Tìm và gán Voice thực tế
    const viVoice = await getVietnameseVoice();

    if (viVoice) {
      utterance.voice = viVoice; // Gán chính xác Object Voice tiếng Việt
      utterance.lang = viVoice.lang;
    } else {
      utterance.lang = "vi-VN";
      console.warn(
        "Không tìm thấy voice tiếng Việt trên thiết bị. Trình duyệt sẽ dùng voice mặc định.",
      );
    }

    utterance.rate = 1.0; // Tốc độ đọc (0.5 - 2.0)
    utterance.pitch = 1.0; // Cao độ (0 - 2.0)

    window.speechSynthesis.speak(utterance);
  }
};

export const stopSpeech = () => {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
};
