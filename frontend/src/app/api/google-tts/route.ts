import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const text = searchParams.get("q");
  const tl = searchParams.get("tl") || "vi";

  if (!text) {
    return new NextResponse("Missing query parameter: q", { status: 400 });
  }

  const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
    text,
  )}&tl=${tl}&total=1&idx=0&textlen=${text.length}&client=tw-ob`;

  try {
    // Server-side fetch: bypass hoàn toàn CORS và Referer phía trình duyệt
    const response = await fetch(googleUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://translate.google.com/",
      },
    });

    if (!response.ok) {
      return new NextResponse("Failed to fetch audio from Google", {
        status: response.status,
      });
    }

    const audioArrayBuffer = await response.arrayBuffer();

    return new NextResponse(audioArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[Google TTS Proxy Error]:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
