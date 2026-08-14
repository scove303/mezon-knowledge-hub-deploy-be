import React, { useState, useEffect, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FileText,
  Calendar,
  Edit3,
  Eye,
  Download,
  Copy,
  Share2,
  Save,
  Video,
  Clock,
  Play,
  Trash2,
  Volume2,
  VolumeX,
  StickyNote,
  Pencil,
  CheckCircle2,
  History,
  Presentation,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/base-ui/Button";
import { Modal } from "@/components/base-ui/Modal";
import { useWorkspaceStore } from "@/features/folders/store";
import { fileService } from "@/features/files/services";
import { folderService } from "@/features/folders/services";
import { aiService } from "@/features/ai/services";
import { useToastStore } from "@/stores/toast";
import { speakText, stopSpeech } from "src/utils/speech";
import { MarkdownComponents } from "@/components/markdown/MarkdownComponents";
import SlideViewer from "./SlideViewer";
import { cn } from "@/utils/formatTailwind";

export default function FileViewer({ file, onSaveContent, onRestoreContent, folderName }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(file ? file.content : "");
  const [seekTime, setSeekTime] = useState(0);
  const [playerKey, setPlayerKey] = useState(0);

  const iframeRef = useRef(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Lịch sử phiên bản (version history)
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [revisions, setRevisions] = useState([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [previewRevision, setPreviewRevision] = useState(null);
  const [restoringRevisionId, setRestoringRevisionId] = useState(null);

  const openRevisions = async () => {
    setRevisionsOpen(true);
    setPreviewRevision(null);
    setRevisionsLoading(true);
    try {
      const res = await fileService.listRevisions(file.id);
      if (res.success) setRevisions(res.data || []);
    } catch (err) {
      useToastStore.getState().addToast("Không thể tải lịch sử phiên bản", "error");
    } finally {
      setRevisionsLoading(false);
    }
  };

  const handleRestoreRevision = async (revId) => {
    setRestoringRevisionId(revId);
    try {
      const res = await fileService.restoreRevision(file.id, revId);
      if (res.success) {
        onRestoreContent?.(res.data.content);
        useToastStore
          .getState()
          .addToast("Đã khôi phục phiên bản", "success");
        setRevisionsOpen(false);
      } else {
        useToastStore.getState().addToast("Khôi phục thất bại", "error");
      }
    } catch (err) {
      console.error("Lỗi khôi phục phiên bản:", err);
      useToastStore.getState().addToast("Khôi phục thất bại", "error");
    } finally {
      setRestoringRevisionId(null);
    }
  };

  const formatRevTime = (iso) => {
    try {
      return new Date(iso).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const [isSpeaking, setIsSpeaking] = useState(false);

  // Chế độ trình chiếu (slide) từ markdown
  const [slideOpen, setSlideOpen] = useState(false);

  // Tóm tắt nội dung bằng AI
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);

  const handleSummarize = async () => {
    setSummaryOpen(true);
    setSummary("");
    setSummaryLoading(true);
    try {
      const res = await aiService.summarizeFile(file.id);
      if (res.success) {
        setSummary(res.data?.summary || "(AI không trả về nội dung)");
      } else {
        setSummary(`Không thể tóm tắt: ${res.message || "lỗi không xác định"}`);
      }
    } catch (err) {
      console.error("Lỗi tóm tắt file:", err);
      const msg =
        err?.response?.data?.detail?.message ||
        err?.response?.data?.detail ||
        "Không thể kết nối với dịch vụ AI. Vui lòng thử lại sau!";
      setSummary(`Lỗi: ${typeof msg === "string" ? msg : JSON.stringify(msg)}`);
    } finally {
      setSummaryLoading(false);
    }
  };

  // Đánh dấu bài đã học (lưu localStorage)
  const [isDone, setIsDone] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return !!JSON.parse(localStorage.getItem("mf-lessons-done") || "{}")[
        file?.id
      ];
    } catch {
      return false;
    }
  });

  const toggleDone = () => {
    const next = !isDone;
    setIsDone(next);
    try {
      const raw = JSON.parse(localStorage.getItem("mf-lessons-done") || "{}");
      if (next) {
        raw[file.id] = true;
      } else {
        delete raw[file.id];
      }
      localStorage.setItem("mf-lessons-done", JSON.stringify(raw));
      window.dispatchEvent(new Event("mf-lessons-changed"));
    } catch {
      // ignore
    }
    useToastStore
      .getState()
      .addToast(
        next ? "Đã đánh dấu bài đã học!" : "Đã bỏ đánh dấu bài",
        next ? "success" : "info",
      );
  };

  const store = useWorkspaceStore();

  const isDirty = isEditing && editedContent !== (file?.content ?? "");

  useEffect(() => {
    if (isDirty) {
      const handler = (e) => {
        e.preventDefault();
        e.returnValue = "";
      };
      window.addEventListener("beforeunload", handler);
      return () => window.removeEventListener("beforeunload", handler);
    }
  }, [isDirty]);

  const handleSave = () => {
    onSaveContent(editedContent);
    setIsEditing(false);
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "s" && (e.ctrlKey || e.metaKey) && isEditing) {
        e.preventDefault();
        if (isDirty) handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const handleDelete = async () => {
    try {
      await fileService.deleteFile(file.id);
      useToastStore
        .getState()
        .addToast("Đã xoá tài liệu thành công", "success");
      setDeleteConfirmOpen(false);
      const foldersRes = await folderService.getFolders();
      if (foldersRes.success) store.setFolders(foldersRes.data);
    } catch (err) {
      useToastStore.getState().addToast("Xoá tài liệu thất bại", "error");
    }
  };

  // Xóa có hoàn tác: hoãn 5s, nút "Hoàn tác" hủy xóa
  const deleteTimerRef = useRef(null);

  const confirmDelete = () => {
    const name = file?.name || "tài liệu";
    setDeleteConfirmOpen(false);
    clearTimeout(deleteTimerRef.current);

    useToastStore
      .getState()
      .addToast(
        `Đã xóa "${name}"`,
        "info",
        5000,
        {
          label: "Hoàn tác",
          onClick: () => {
            clearTimeout(deleteTimerRef.current);
            useToastStore
              .getState()
              .addToast("Đã hoàn tác, tài liệu được giữ lại!", "success");
          },
        },
      );

    deleteTimerRef.current = setTimeout(() => {
      handleDelete();
    }, 5000);
  };

  const [prevFile, setPrevFile] = useState(file);

  // Tắt giọng đọc khi chuyển file hoặc unmount
  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, [file?.id]);

  // Đánh dấu trường hợp thay đổi file đến từ autosave (giữ nguyên chế độ chỉnh sửa)
  const [isAutosaving, setIsAutosaving] = useState(false);

  // Tự động lưu sau 2 giây ngừng gõ (khi đang chỉnh sửa và có thay đổi)
  const autosaveTimer = useRef(null);
  useEffect(() => {
    if (!isEditing || !isDirty) return;
    autosaveTimer.current = setTimeout(() => {
      setIsAutosaving(true);
      onSaveContent(editedContent);
    }, 2000);
    return () => clearTimeout(autosaveTimer.current);
  }, [editedContent, isDirty, isEditing, onSaveContent]);

  // Thống kê nội dung: số từ + thời gian đọc (khoảng 200 từ/phút)
  const contentStats = useMemo(() => {
    const plain = (file?.content || "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[#>*`~_\-|]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const words = plain ? plain.split(/\s+/).length : 0;
    return { words, readingMinutes: Math.max(1, Math.ceil(words / 200)) };
  }, [file?.content]);

  // Ghi chú video theo mốc thời gian (lưu localStorage)
  const [notes, setNotes] = useState(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem("mf-video-notes") || "{}");
    } catch {
      return {};
    }
  });
  const [activeTime, setActiveTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [noteEditingKey, setNoteEditingKey] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");

  // Đồng bộ highlight mốc đang phát (ước lượng: +1s mỗi giây kể từ lần seek gần nhất)
  useEffect(() => {
    if (!file?.videoUrl) return;
    const t = setInterval(() => {
      if (playing) {
        setActiveTime((prev) => prev + 1);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [file?.id, file?.videoUrl, playing]);

  if (file !== prevFile) {
    setPrevFile(file); // Cập nhật lại file cũ để không bị lặp lại ở lần render sau
    if (file) {
      setEditedContent(file.content); // Khởi tạo nội dung tương ứng với file mới
      if (!isAutosaving) {
        setIsEditing(false); // Tắt chế độ chỉnh sửa (trừ khi thay đổi đến từ autosave)
      }
      setSeekTime(0); // Trả thời gian video về 0
      setPlaying(false); // Tắt đồng bộ transcript khi đổi file
      setIsSpeaking(false); // Tắt giọng đọc khi đổi file
      try {
        setIsDone(
          !!JSON.parse(localStorage.getItem("mf-lessons-done") || "{}")[
            file.id
          ],
        );
      } catch {
        setIsDone(false);
      }
    }
    setIsAutosaving(false);
  }

  if (!file) {
    return (
      <div className="flex-1 bg-[rgb(var(--color-bg))] flex flex-col items-center justify-center text-[rgb(var(--color-text-muted))] p-8 select-none">
        <div className="w-16 h-16 rounded-full bg-[rgb(var(--color-surface-1))] flex items-center justify-center mb-4 border border-[rgb(var(--color-border))]">
          <FileText className="w-8 h-8 text-[rgb(var(--color-text-disabled))]" />
        </div>
        <p className="text-base font-semibold text-[rgb(var(--color-text-secondary))]">
          Không có tài liệu nào đang mở
        </p>
        <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1 max-w-xs text-center">
          Hãy chọn một file từ cây thư mục ở Sidebar hoặc gửi lệnh tạo tri thức
          trên Mezon Bot.
        </p>
      </div>
    );
  }

  const getYoutubeId = (url) => {
    if (!url) return null;
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const handleSeek = (seconds) => {
    setSeekTime(seconds);
    setPlaying(true);
    setActiveTime(seconds);
    setPlayerKey((prev) => prev + 1);
  };

  const ytId = file.videoUrl ? getYoutubeId(file.videoUrl) : null;

  // Ghi đè link timestamp:// để seek video, còn lại dùng component dùng chung
  const TimestampA = ({ href, children }) => {
    if (href && href.startsWith("timestamp://")) {
      const secs = parseInt(href.replace("timestamp://", ""), 10);
      return (
        <button
          onClick={() => handleSeek(secs)}
          className="px-1.5 py-0.5 mx-0.5 rounded bg-[rgb(var(--color-surface-1))] hover:bg-indigo-600 hover:text-white text-indigo-400 text-xs font-mono font-semibold transition-colors duration-150 inline-flex items-center space-x-1 cursor-pointer align-middle"
        >
          <Play className="w-2.5 h-2.5 fill-current" />
          <span>{children}</span>
        </button>
      );
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-2"
      >
        {children}
      </a>
    );
  };

  const FileMarkdownComponents = { ...MarkdownComponents, a: TimestampA };

  // Phần Tích hợp Text-to-Speech (TTS)
  const handleToggleSpeech = () => {
    if (isSpeaking) {
      stopSpeech();
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);
      speakText(file.content, () => setIsSpeaking(false));
    }
  };

  // Tải xuống file Markdown (.md)
  const handleDownloadMarkdown = () => {
    const blob = new Blob([file.content || ""], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${file.name || "document"}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    useToastStore.getState().addToast("Đã tải xuống file Markdown", "success");
  };

  // Copy toàn bộ nội dung vào clipboard
  const handleCopyContent = async () => {
    try {
      await navigator.clipboard.writeText(file.content || "");
      useToastStore
        .getState()
        .addToast("Đã copy nội dung vào clipboard!", "success");
    } catch (err) {
      useToastStore.getState().addToast("Không thể copy nội dung", "error");
    }
  };

  // Lưu / xóa ghi chú cho một mốc thời gian
  const saveNote = (seconds) => {
    const key = `${file.id}:${seconds}`;
    setNotes((prev) => {
      const next = { ...prev };
      if (noteDraft.trim()) next[key] = noteDraft.trim();
      else delete next[key];
      try {
        localStorage.setItem("mf-video-notes", JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
    setNoteEditingKey(null);
    setNoteDraft("");
  };

  // Mốc thời gian đang phát gần nhất (để highlight transcript)
  // Export ghi chú video ra file Markdown
  const exportNotes = () => {
    const entries = Object.entries(notes)
      .filter(([k]) => k.startsWith(`${file.id}:`))
      .map(([k, v]) => {
        const secs = parseInt(k.split(":")[1], 10);
        return { secs, text: v };
      })
      .filter((e) => e.text && !Number.isNaN(e.secs))
      .sort((a, b) => a.secs - b.secs);
    if (entries.length === 0) {
      useToastStore
        .getState()
        .addToast("Chưa có ghi chú nào để xuất", "info");
      return;
    }
    const fmt = (s) =>
      `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(
        Math.floor(s % 60),
      ).padStart(2, "0")}`;
    const md = `# Ghi chú — ${file.name}\n\n${entries
      .map((e) => `- [${fmt(e.secs)}] ${e.text}`)
      .join("\n")}\n`;
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${file.name.replace(/\.\w+$/, "")}-notes.md`;
    a.click();
    URL.revokeObjectURL(url);
    useToastStore.getState().addToast("Đã xuất ghi chú ra file .md", "success");
  };

  const activeTimestampIdx = (file.timestamps || []).reduce(
    (acc, t, i) => (t.seconds <= activeTime ? i : acc),
    -1,
  );

  return (
    <div className="flex-1 bg-[rgb(var(--color-bg))] flex flex-col h-full overflow-hidden text-[rgb(var(--color-text-secondary))]">
      {/* Header */}
      <header className="h-16 border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))]/80 px-6 flex items-center justify-between flex-shrink-0 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
            <FileText className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[rgb(var(--color-text-primary))] truncate">
              {file.name}
            </h2>
            <div className="flex items-center space-x-2 text-[10px] text-[rgb(var(--color-text-muted))] font-medium">
              <span className="truncate max-w-xs">
                {folderName || "Thư mục gốc"}
              </span>
              <span>•</span>
              <Calendar className="w-3 h-3" />
              <span>Cập nhật {file.createdAt}</span>
              <span>•</span>
              <FileText className="w-3 h-3" />
              <span>
                {contentStats.words} từ • {contentStats.readingMinutes} phút đọc
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2">
          {/* Text-to-Speech (TTS) */}
          {!file.videoUrl && (
            <Button
              id="btn-summarize-file"
              variant="secondary"
              size="icon"
              onClick={handleSummarize}
              title="Tóm tắt nội dung bằng AI"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </Button>
          )}

          {!file.videoUrl && (
            <Button
              id="btn-slide-file"
              variant="secondary"
              size="icon"
              onClick={() => setSlideOpen(true)}
              title="Trình chiếu slide từ markdown"
            >
              <Presentation className="w-3.5 h-3.5" />
            </Button>
          )}

          <Button
            id="btn-done-file"
            variant={isDone ? "success" : "secondary"}
            size="icon"
            onClick={toggleDone}
            title={isDone ? "Bỏ đánh dấu đã học" : "Đánh dấu đã học"}
          >
            <CheckCircle2
              className={cn(
                "w-3.5 h-3.5",
                isDone ? "text-emerald-400" : "text-[rgb(var(--color-text-muted))]",
              )}
            />
          </Button>

          <Button
            id="btn-tts-file"
            variant={isSpeaking ? "primary" : "secondary"}
            size="icon"
            onClick={handleToggleSpeech}
            title={isSpeaking ? "Dừng đọc" : "Đọc văn bản"}
          >
            {isSpeaking ? (
              <VolumeX
                className={cn("w-3.5 h-3.5 text-rose-400 animate-pulse")}
              />
            ) : (
              <Volume2 className={cn("w-3.5 h-3.5")} />
            )}
          </Button>

          {isEditing ? (
            <div className="flex items-center gap-2">
              {isDirty && (
                <span className="text-[10px] text-amber-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                  Chưa lưu
                </span>
              )}
              <Button
                id="btn-save-file"
                variant="success"
                size="sm"
                onClick={handleSave}
              >
                <Save className="w-3.5 h-3.5" />
                Lưu
              </Button>
            </div>
          ) : (
            <Button
              id="btn-edit-file"
              variant="secondary"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <Edit3 className="w-3.5 h-3.5" />
              Chỉnh sửa
            </Button>
          )}

          <Button
            id="btn-download-file"
            variant="secondary"
            size="icon"
            onClick={handleDownloadMarkdown}
            title="Tải xuống file Markdown"
          >
            <Download className="w-3.5 h-3.5" />
          </Button>

          <Button
            id="btn-copy-file"
            variant="secondary"
            size="icon"
            onClick={handleCopyContent}
            title="Copy nội dung"
          >
            <Copy className="w-3.5 h-3.5" />
          </Button>

          <Button
            id="btn-history-file"
            variant="secondary"
            size="icon"
            onClick={openRevisions}
            title="Lịch sử phiên bản"
          >
            <History className="w-3.5 h-3.5" />
          </Button>

          <Button
            id="btn-share-file"
            variant="secondary"
            size="icon"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              useToastStore
                .getState()
                .addToast(
                  "Đã copy đường dẫn chia sẻ vào clipboard!",
                  "success",
                );
            }}
            title="Chia sẻ link"
          >
            <Share2 className="w-3.5 h-3.5" />
          </Button>

          <Button
            id="btn-delete-file"
            variant="danger"
            size="icon"
            onClick={() => setDeleteConfirmOpen(true)}
            title="Xoá tài liệu"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Document Panel */}
        <div className="flex-1 overflow-y-auto px-8 py-6 scrollbar-thin">
          {isEditing ? (
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full h-full bg-[rgb(var(--color-bg))] font-mono text-sm border-0 focus:ring-0 outline-none text-[rgb(var(--color-text-secondary))] resize-none leading-relaxed"
              placeholder="Nhập nội dung Markdown..."
            />
          ) : (
            <article className="prose prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={FileMarkdownComponents}
              >
                {file.content}
              </ReactMarkdown>
            </article>
          )}
        </div>

        {/* YouTube Panel */}
        {ytId && (
          <div className="w-96 border-l border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-1))]/30 flex flex-col h-full overflow-y-auto p-4 flex-shrink-0 animate-slide-in-right">
            <div className="flex items-center space-x-2 text-rose-400 text-xs font-bold uppercase tracking-wider mb-3">
              <Video className="w-4 h-4" />
              <span>Video Trình Chiếu</span>
            </div>

            <div className="relative aspect-video rounded-lg overflow-hidden bg-[rgb(var(--color-bg))] border border-[rgb(var(--color-border))] mb-4 shadow-lg shadow-black/30">
              <iframe
                key={playerKey}
                ref={iframeRef}
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${ytId}?start=${seekTime}&autoplay=${seekTime > 0 ? 1 : 0}&enablejsapi=1`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>

            {file.timestamps && (
              <div className="flex-1 flex flex-col min-h-0 bg-[rgb(var(--color-bg))]/60 border border-[rgb(var(--color-border))] rounded-lg p-3">
                <div className="flex items-center space-x-1.5 text-xs text-[rgb(var(--color-text-muted))] font-semibold mb-2 pb-2 border-b border-[rgb(var(--color-border))]">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Danh sách mốc thời gian</span>
                  <button
                    onClick={exportNotes}
                    className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[rgb(var(--color-surface-2))] hover:text-indigo-400 transition-colors font-medium"
                    title="Xuất ghi chú ra file Markdown"
                  >
                    <Download className="w-3 h-3" />
                    Export
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                  {file.timestamps.map((t, idx) => {
                    const noteKey = `${file.id}:${t.seconds}`;
                    const note = notes[noteKey];
                    const isActive = idx === activeTimestampIdx;
                    return (
                      <div key={idx}>
                        <div
                          onClick={() => handleSeek(t.seconds)}
                          className={`flex items-start space-x-2.5 p-2 rounded-md cursor-pointer transition-all ${
                            isActive
                              ? "bg-amber-500/10 border border-amber-400/30 text-amber-300"
                              : "hover:bg-[rgb(var(--color-surface-1))]/50 border border-transparent text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]"
                          }`}
                        >
                          <span className="text-xs font-mono font-bold bg-[rgb(var(--color-surface-1))] text-indigo-400 px-1.5 py-0.5 rounded shrink-0">
                            {t.time}
                          </span>
                          <span className="text-xs leading-relaxed font-medium flex-1">
                            {t.text}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setNoteEditingKey(
                                noteEditingKey === noteKey ? null : noteKey,
                              );
                              setNoteDraft(note || "");
                            }}
                            className={`p-1 rounded transition-colors shrink-0 ${
                              note
                                ? "text-amber-400"
                                : "text-[rgb(var(--color-text-muted))] hover:text-amber-400 opacity-0 group-hover:opacity-100"
                            }`}
                            title={note ? "Sửa ghi chú" : "Thêm ghi chú"}
                          >
                            <StickyNote className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {note && noteEditingKey !== noteKey && (
                          <div className="ml-8 mt-1 mb-1.5 flex items-start justify-between gap-2 text-[11px] text-amber-300/90 bg-amber-500/5 border-l-2 border-amber-400/40 pl-2 py-1 pr-1 rounded-r">
                            <span className="whitespace-pre-wrap leading-relaxed">
                              {note}
                            </span>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setNoteEditingKey(noteKey);
                                  setNoteDraft(note);
                                }}
                                className="p-0.5 text-[rgb(var(--color-text-muted))] hover:text-amber-400 transition-colors"
                                title="Sửa ghi chú"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setNoteDraft("");
                                  saveNote(t.seconds);
                                }}
                                className="p-0.5 text-[rgb(var(--color-text-muted))] hover:text-rose-400 transition-colors"
                                title="Xóa ghi chú"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}

                        {noteEditingKey === noteKey && (
                          <div className="ml-8 mt-1 mb-1.5">
                            <textarea
                              autoFocus
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value)}
                              onBlur={() => saveNote(t.seconds)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                                  saveNote(t.seconds);
                                }
                                if (e.key === "Escape") {
                                  setNoteEditingKey(null);
                                  setNoteDraft("");
                                }
                              }}
                              placeholder="Ghi chú cho mốc này..."
                              rows={2}
                              className="w-full bg-[rgb(var(--color-bg))] border border-amber-400/30 focus:border-amber-400 rounded-md p-2 text-[11px] text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-muted))] outline-none resize-none"
                            />
                            <div className="text-[10px] text-[rgb(var(--color-text-muted))] mt-0.5">
                              Ctrl+Enter để lưu, Esc để hủy
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        isOpen={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        title={`Tóm tắt AI — ${file?.name || ""}`}
        size="lg"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="ghost" onClick={() => setSummaryOpen(false)}>
              Đóng
            </Button>
          </div>
        }
      >
        {summaryLoading ? (
          <div className="flex flex-col items-center gap-3 py-10 text-sm text-[rgb(var(--color-text-muted))]">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
            Đang tóm tắt nội dung bằng AI...
          </div>
        ) : (
          <article className="prose prose-invert max-w-none max-h-96 overflow-y-auto scrollbar-thin text-sm">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={FileMarkdownComponents}
            >
              {summary}
            </ReactMarkdown>
          </article>
        )}
      </Modal>

      <Modal
        isOpen={revisionsOpen}
        onClose={() => setRevisionsOpen(false)}
        title={`Lịch sử phiên bản — ${file?.name || ""}`}
        size="lg"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="ghost" onClick={() => setRevisionsOpen(false)}>
              Đóng
            </Button>
          </div>
        }
      >
        {revisionsLoading ? (
          <div className="py-10 text-center text-sm text-[rgb(var(--color-text-muted))]">
            Đang tải lịch sử...
          </div>
        ) : revisions.length === 0 ? (
          <div className="py-10 text-center text-sm text-[rgb(var(--color-text-muted))]">
            Chưa có phiên bản nào (chỉ tạo khi nội dung thay đổi).
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-96 overflow-y-auto scrollbar-thin pr-1">
            {revisions.map((rev) => (
              <div
                key={rev.id}
                className="border border-[rgb(var(--color-border))] rounded-lg p-3 bg-[rgb(var(--color-surface-1))]"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-[rgb(var(--color-text-secondary))] flex items-center gap-1.5">
                    <History className="w-3 h-3 text-indigo-400" />
                    {formatRevTime(rev.created_at)}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() =>
                        setPreviewRevision(
                          previewRevision?.id === rev.id ? null : rev,
                        )
                      }
                    >
                      {previewRevision?.id === rev.id ? "Ẩn" : "Xem"}
                    </Button>
                    <Button
                      variant="primary"
                      size="xs"
                      loading={restoringRevisionId === rev.id}
                      onClick={() => handleRestoreRevision(rev.id)}
                    >
                      Khôi phục
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-[rgb(var(--color-text-muted))] whitespace-pre-wrap line-clamp-2">
                  {rev.content || "(trống)"}
                </p>
                {previewRevision?.id === rev.id && (
                  <pre className="mt-2 p-3 rounded-md bg-[rgb(var(--color-bg))] border border-[rgb(var(--color-border))] text-xs text-[rgb(var(--color-text-secondary))] whitespace-pre-wrap max-h-56 overflow-y-auto scrollbar-thin">
                    {rev.content || "(trống)"}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Xoá Tài Liệu"
        size="sm"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="ghost" onClick={() => setDeleteConfirmOpen(false)}>
              Hủy
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Đồng ý xóa
            </Button>
          </div>
        }
      >
        <p className="text-sm text-[rgb(var(--color-text-secondary))] leading-relaxed">
          Bạn có chắc chắn muốn xóa tài liệu &quot;{file?.name}&quot;? Hành động
          này không thể hoàn tác.
        </p>
      </Modal>

      {slideOpen && (
        <SlideViewer
          content={file.content}
          name={file.name}
          onClose={() => setSlideOpen(false)}
        />
      )}
    </div>
  );
}
