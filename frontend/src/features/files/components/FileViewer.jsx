import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
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
  ChevronRight,
  ListTree,
  Minus,
  Plus,
  ChevronUp,
  ChevronDown,
  Link2,
  Maximize2,
  Minimize2,
  Ellipsis,
  Settings2,
  Mic,
} from "lucide-react";
import { Button } from "@/components/base-ui/Button";
import { Modal } from "@/components/base-ui/Modal";
import { useWorkspaceStore } from "@/features/folders/store";
import { fileService } from "@/features/files/services";
import { folderService } from "@/features/folders/services";
import { useToastStore } from "@/stores/toast";
import { MarkdownComponents } from "@/components/markdown/MarkdownComponents";
import MarkdownRender from "@/components/markdown/MarkdownRender";
import SlideViewer from "./SlideViewer";
import { cn } from "@/utils/formatTailwind";

// Import Hệ thống Giọng đọc Tối ưu Lai (Hybrid Speech System)
import {
  speakContent,
  stopAllSpeech,
  updateSpeechConfig,
  getSpeechConfig,
} from "@/utils/Speech/speechSystem";

// Regex để xóa MINDMAP_NODE anchor tags khỏi hiển thị (giữ trong content gốc cho mindmap)
const MINDMAP_ANCHOR_RE = /\[MINDMAP_NODE:[^\]]+\]\s*\n?/g;

function stripMindmapAnchors(content) {
  return content ? content.replace(MINDMAP_ANCHOR_RE, "") : content;
}

// Timer hoãn xóa (module scope để React Compiler không chặn việc modify trong handler)
let deleteTimer = null;
// Timer lưu vị trí đọc (module scope, tránh mutate ref trong effect)
let scrollSaveTimer = null;

// Chuyển tiêu đề heading thành id ổn định cho mục lục
const slugify = (text) =>
  String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");

export default function FileViewer({
  file,
  onSaveContent,
  onRestoreContent,
  folderName,
  folderId,
  initialSeek,
  onAiSummary,
}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showTtsSettings, setShowTtsSettings] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);
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
      useToastStore
        .getState()
        .addToast("Không thể tải lịch sử phiên bản", "error");
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
        useToastStore.getState().addToast("Đã khôi phục phiên bản", "success");
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

  // Chế độ trình chiếu (slide) từ markdown
  const [slideOpen, setSlideOpen] = useState(false);

  // Menu thao tác phụ (⋯) — gom các nút ít dùng để header bớt chật
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef(null);

  useEffect(() => {
    if (!overflowOpen) return;
    const onDown = (e) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target)) {
        setOverflowOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOverflowOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [overflowOpen]);

  // Tóm tắt nội dung bằng AI → hiển thị trong khung chat (nối tiếp hội thoại)
  const handleSummarize = () => {
    onAiSummary?.(file);
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
        // Ghi nhật ký ngày học (cho streak)
        const today = new Date().toISOString().slice(0, 10);
        const days = JSON.parse(localStorage.getItem("mf-study-days") || "[]");
        if (!days.includes(today)) days.push(today);
        localStorage.setItem("mf-study-days", JSON.stringify(days));
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

  // Thời điểm lưu thành công cuối cùng (hiển thị "Đã lưu HH:mm")
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const markSaved = useCallback(() => setLastSavedAt(new Date()), []);
  const formatSavedTime = (d) =>
    d
      ? d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
      : "";

  // Chế độ đọc tập trung (zen): ẩn mục lục + căn giữa cột nội dung
  const [zenOpen, setZenOpen] = useState(
    () =>
      typeof window !== "undefined" && localStorage.getItem("mf-zen") === "1",
  );
  const toggleZen = () => {
    setZenOpen((prev) => {
      try {
        localStorage.setItem("mf-zen", prev ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !prev;
    });
  };

  // Panel cuộn nội dung tài liệu
  const docPanelRef = useRef(null);

  // Nhớ vị trí đọc: lưu scrollTop sau khi ngừng cuộn 400ms
  useEffect(() => {
    if (!file?.id) return;
    const el = docPanelRef.current;
    if (!el) return;
    const handler = () => {
      clearTimeout(scrollSaveTimer);
      scrollSaveTimer = setTimeout(() => {
        try {
          localStorage.setItem(`mf-scroll-${file.id}`, String(el.scrollTop));
        } catch {
          /* ignore */
        }
      }, 400);
    };
    el.addEventListener("scroll", handler);
    return () => {
      el.removeEventListener("scroll", handler);
      clearTimeout(scrollSaveTimer);
    };
  }, [file?.id]);

  // Khôi phục vị trí đọc khi mở file
  useEffect(() => {
    if (!file?.id) return;
    const el = docPanelRef.current;
    if (!el) return;
    let saved = 0;
    try {
      saved =
        parseInt(localStorage.getItem(`mf-scroll-${file.id}`) || "0", 10) || 0;
    } catch {
      /* ignore */
    }
    const frame = requestAnimationFrame(() => {
      if (docPanelRef.current) docPanelRef.current.scrollTop = saved;
    });
    return () => cancelAnimationFrame(frame);
  }, [file?.id]);

  // Tìm kiếm / Nhảy tới vị trí từ khóa từ Mindmap hoặc Sidebar
  useEffect(() => {
    if (!file?.id || isEditing) return;
    const rawQ = (store.searchQuery || "").trim();
    if (!rawQ) return;
    const panel = docPanelRef.current;
    const article = panel?.querySelector("article");
    if (!article) return;

    // Danh sách từ khóa ưu tiên: 1. Nguyên văn -> 2. Cụm 3 từ -> 3. Từ dài nhất
    const searchTerms = [rawQ.toLowerCase()];
    const cleanWords = rawQ
      .replace(/[*_`#>|()\[\]]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3);

    if (cleanWords.length > 2) {
      for (let i = 0; i <= cleanWords.length - 2; i++) {
        searchTerms.push(
          cleanWords
            .slice(i, i + 3)
            .join(" ")
            .toLowerCase(),
        );
      }
    }
    cleanWords.sort((a, b) => b.length - a.length);
    cleanWords.slice(0, 3).forEach((w) => searchTerms.push(w.toLowerCase()));

    let targetNode = null;
    let matchedTerm = "";

    for (const term of searchTerms) {
      if (!term || term.length < 2) continue;
      const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const val = (walker.currentNode.nodeValue || "").toLowerCase();
        if (val.includes(term)) {
          targetNode = walker.currentNode;
          matchedTerm = term;
          break;
        }
      }
      if (targetNode) break;
    }

    if (!targetNode || !matchedTerm) return;

    const full = targetNode.nodeValue || "";
    const idx = full.toLowerCase().indexOf(matchedTerm);
    if (idx === -1) return;

    const mark = document.createElement("mark");
    mark.className =
      "bg-amber-400/40 text-[rgb(var(--color-text-primary))] rounded px-1 py-0.5 font-medium transition-all shadow-sm";
    const range = document.createRange();
    range.setStart(targetNode, idx);
    range.setEnd(targetNode, idx + matchedTerm.length);
    range.surroundContents(mark);
    mark.scrollIntoView({ behavior: "smooth", block: "center" });

    const fade = setTimeout(() => {
      mark.style.transition = "background-color 1000ms ease, color 1000ms ease";
      mark.style.backgroundColor = "transparent";
    }, 3500);
    return () => {
      clearTimeout(fade);
      try {
        mark.replaceWith(document.createTextNode(full));
      } catch {}
    };
  }, [file?.id, file?.content, isEditing, store.searchQuery]);

  // Bài trước / bài tiếp theo trong cùng thư mục
  const folderFiles = store.getSelectedFolder()?.files || [];
  const fileIndex = folderFiles.findIndex((f) => f.id === file?.id);
  const prevFileItem = fileIndex > 0 ? folderFiles[fileIndex - 1] : null;
  const nextFileItem =
    fileIndex >= 0 && fileIndex < folderFiles.length - 1
      ? folderFiles[fileIndex + 1]
      : null;

  const goToFile = (target) => {
    if (!target) return;
    if (isDirty) {
      Promise.resolve(onSaveContent(editedContent)).catch(() => {});
    }
    setIsEditing(false);
    store.setSelectedFile(target.id);
  };

  // Mục lục tự sinh từ các heading H1-H3 trong nội dung markdown
  const headings = useMemo(() => {
    const out = [];
    const seen = new Set();
    for (const line of (file?.content || "").split("\n")) {
      const m = line.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/);
      if (m) {
        const text = m[2].trim();
        let id = slugify(text);
        if (seen.has(id)) {
          let i = 2;
          while (seen.has(`${id}-${i}`)) i++;
          id = `${id}-${i}`;
        }
        seen.add(id);
        out.push({ level: m[1].length, text, id });
      }
    }
    return out;
  }, [file?.content]);

  const [tocOpen, setTocOpen] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("mf-toc-open") !== "0"
      : true,
  );

  const toggleToc = () => {
    setTocOpen((prev) => {
      try {
        localStorage.setItem("mf-toc-open", prev ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !prev;
    });
  };

  // Cỡ chữ đọc (A-/A+), lưu localStorage
  const [fontScale, setFontScale] = useState(() => {
    if (typeof window === "undefined") return 1;
    try {
      const v = parseFloat(localStorage.getItem("mf-font-scale"));
      return Number.isFinite(v) ? Math.min(1.4, Math.max(0.8, v)) : 1;
    } catch {
      return 1;
    }
  });

  const changeFontScale = (delta) => {
    setFontScale((prev) => {
      const next = Math.min(1.4, Math.max(0.8, +(prev + delta).toFixed(2)));
      try {
        localStorage.setItem("mf-font-scale", String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const scrollToHeading = (id) => {
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
    setIsEditing(false);
    Promise.resolve(onSaveContent(editedContent))
      .then(markSaved)
      .catch(() => {});
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "s" && (e.ctrlKey || e.metaKey) && isEditing) {
        e.preventDefault();
        if (isDirty) handleSave();
      }
      // Ctrl+Z = hoàn tác xóa (giống nút "Hoàn tác" trên toast)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        const tagName = document.activeElement?.tagName;
        const isInputting =
          ["INPUT", "TEXTAREA"].includes(tagName) ||
          document.activeElement?.isContentEditable;
        if (isInputting) return;
        if (deleteTimer) {
          e.preventDefault();
          clearTimeout(deleteTimer);
          deleteTimer = null;
          useToastStore
            .getState()
            .addToast("Đã hoàn tác, tài liệu được giữ lại!", "success");
        }
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
  const confirmDelete = () => {
    const name = file?.name || "tài liệu";
    setDeleteConfirmOpen(false);
    clearTimeout(deleteTimer);

    useToastStore.getState().addToast(`Đã xóa "${name}"`, "info", 5000, {
      label: "Hoàn tác",
      onClick: () => {
        clearTimeout(deleteTimer);
        useToastStore
          .getState()
          .addToast("Đã hoàn tác, tài liệu được giữ lại!", "success");
      },
    });

    deleteTimer = setTimeout(() => {
      handleDelete();
    }, 5000);
  };

  const [prevFile, setPrevFile] = useState(file);

  // Tắt giọng đọc khi chuyển file hoặc unmount
  useEffect(() => {
    return () => {
      stopAllSpeech();
      setIsSpeaking(false);
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
      Promise.resolve(onSaveContent(editedContent))
        .then(markSaved)
        .catch(() => {});
    }, 2000);
    return () => clearTimeout(autosaveTimer.current);
  }, [editedContent, isDirty, isEditing, onSaveContent, markSaved]);

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

  // Tự động nhảy giây trên video YouTube khi `initialSeek` có giá trị
  useEffect(() => {
    if (typeof initialSeek === "number" && initialSeek >= 0) {
      // Gọi hàm handleSeek sẵn có trong FileViewer
      handleSeek(initialSeek);
    }
  }, [initialSeek, file?.id]); // Chạy lại khi mốc thời gian hoặc file thay đổi

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

  const HEADING_CLASSES = {
    h1: "text-2xl font-extrabold text-[rgb(var(--color-text-primary))] mt-6 mb-4 pb-2 border-b border-[rgb(var(--color-border))]",
    h2: "text-xl font-bold text-[rgb(var(--color-text-secondary))] mt-6 mb-3",
    h3: "text-lg font-bold text-[rgb(var(--color-text-secondary))] mt-4 mb-2",
  };

  const HeadingWithId = ({ tag: Tag, children }) => {
    const id = slugify(String(children).replace(/\s*\n\s*/g, " "));
    const copyHeadingLink = () => {
      const url = `${window.location.origin}${window.location.pathname}#${id}`;
      navigator.clipboard
        .writeText(url)
        .then(() =>
          useToastStore
            .getState()
            .addToast("Đã copy link tới mục này!", "success"),
        )
        .catch(() =>
          useToastStore.getState().addToast("Không thể copy link", "error"),
        );
    };
    return (
      <Tag
        id={id}
        className={`scroll-mt-4 group/heading ${HEADING_CLASSES[Tag] || ""}`}
      >
        <span className="inline-flex items-center gap-2 flex-wrap">
          {children}
          <button
            onClick={copyHeadingLink}
            className="inline-flex items-center opacity-0 group-hover/heading:opacity-100 focus-visible:opacity-100 transition-opacity p-0.5 rounded text-[rgb(var(--color-text-muted))] hover:text-indigo-400 hover:bg-[rgb(var(--color-surface-2))]"
            title="Copy link tới mục này"
            aria-label="Copy link tới mục này"
          >
            <Link2 className="w-3 h-3" />
          </button>
        </span>
      </Tag>
    );
  };

  const FileMarkdownComponents = {
    ...MarkdownComponents,
    pre: ({ children }) => <>{children}</>,
    p: ({ children, ...props }) => (
      <div className="mb-4 last:mb-0" {...props}>
        {children}
      </div>
    ),
    a: TimestampA,
    h1: (props) => <HeadingWithId tag="h1" {...props} />,
    h2: (props) => <HeadingWithId tag="h2" {...props} />,
    h3: (props) => <HeadingWithId tag="h3" {...props} />,
  };

  // Phần Tích hợp Text-to-Speech (TTS)
  // Trạng thái phát âm thanh & Bảng cài đặt giọng đọc

  // Cập nhật cấu hình khi thay đổi thông số đọc
  const handleRateChange = (newRate) => {
    setSpeechRate(newRate);
    updateSpeechConfig({ rate: newRate });
  };

  const handleCloudToggle = (enabled) => {
    setUseCloudNeural(enabled);
    updateSpeechConfig({ useCloudNeural: enabled });
  };

  const handleVoiceChange = (voice) => {
    console.log("[TTS] handleVoiceChange - new voice:", voice);
    setTtsVoice(voice);
    updateSpeechConfig({ voice });
  };

  // Xử lý Bật / Tắt giọng đọc
  const handleToggleSpeech = () => {
    if (isSpeaking) {
      stopAllSpeech();
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);
      // Loại bỏ thẻ neo mindmap trước khi truyền vào hệ thống đọc
      const cleanContent = stripMindmapAnchors(file.content);
      speakContent(cleanContent, () => {
        setIsSpeaking(false);
      });
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
      } catch {
        /* ignore */
      }
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
      useToastStore.getState().addToast("Chưa có ghi chú nào để xuất", "info");
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

  // Hàm chuyển đổi định dạng mốc thời gian dạng thành link dạng markdown timestamp://
  function parseTimestampsToMarkdownLinks(content) {
    if (!content) return "";
    // Nhận diện cú pháp mốc thời gian dạng [MM:SS] hoặc [HH:MM:SS]
    return content.replace(
      /\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/g,
      (match, p1, p2, p3) => {
        let totalSeconds = 0;
        if (p3 !== undefined) {
          totalSeconds =
            parseInt(p1, 10) * 3600 + parseInt(p2, 10) * 60 + parseInt(p3, 10);
        } else {
          totalSeconds = parseInt(p1, 10) * 60 + parseInt(p2, 10);
        }
        return `[${match}](timestamp://${totalSeconds})`;
      },
    );
  }

  // Tiền xử lý nội dung văn bản trước khi đưa vào ReactMarkdown
  const processedContent = useMemo(() => {
    return parseTimestampsToMarkdownLinks(file?.content || "");
  }, [file?.content]);

  return (
    <div className="flex-1 bg-[rgb(var(--color-bg))] flex flex-col h-full overflow-hidden text-[rgb(var(--color-text-secondary))]">
      {/* Header */}
      <header className="h-16 border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))]/80 px-6 flex items-center justify-between flex-shrink-0 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center space-x-3 min-w-0 shrink-0 max-w-[40%]">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
            <FileText className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[rgb(var(--color-text-primary))] truncate">
              {file.name}
            </h2>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-1.5 min-w-0">
          {/* Bài trước / Bài tiếp theo trong cùng thư mục */}
          <Button
            variant="secondary"
            size="icon"
            onClick={() => goToFile(prevFileItem)}
            disabled={!prevFileItem}
            title={
              prevFileItem
                ? `Bài trước: ${prevFileItem.name}`
                : "Không có bài trước"
            }
            aria-label={
              prevFileItem
                ? `Bài trước: ${prevFileItem.name}`
                : "Không có bài trước"
            }
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={() => goToFile(nextFileItem)}
            disabled={!nextFileItem}
            title={
              nextFileItem
                ? `Bài tiếp theo: ${nextFileItem.name}`
                : "Không có bài tiếp theo"
            }
            aria-label={
              nextFileItem
                ? `Bài tiếp theo: ${nextFileItem.name}`
                : "Không có bài tiếp theo"
            }
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </Button>

          {/* Chế độ đọc tập trung (zen) */}
          <Button
            variant="secondary"
            size="icon"
            onClick={toggleZen}
            title={
              zenOpen ? "Thoát chế độ đọc tập trung" : "Chế độ đọc tập trung"
            }
            aria-label={
              zenOpen ? "Thoát chế độ đọc tập trung" : "Chế độ đọc tập trung"
            }
          >
            {zenOpen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </Button>

          {/* Cỡ chữ đọc đã chuyển vào menu ⋯ (btn-overflow-file) */}

          {/* Mục lục */}
          {headings.length > 0 && (
            <Button
              id="btn-toc-file"
              variant={tocOpen ? "primary" : "secondary"}
              size="icon"
              onClick={toggleToc}
              title={tocOpen ? "Ẩn mục lục" : "Hiện mục lục"}
              aria-label={tocOpen ? "Ẩn mục lục" : "Hiện mục lục"}
            >
              <ListTree className="w-3.5 h-3.5" />
            </Button>
          )}

          <Button
            id="btn-done-file"
            variant={isDone ? "success" : "secondary"}
            size="icon"
            onClick={toggleDone}
            title={isDone ? "Bỏ đánh dấu đã học" : "Đánh dấu đã học"}
            aria-label={isDone ? "Bỏ đánh dấu đã học" : "Đánh dấu đã học"}
          >
            <CheckCircle2
              className={cn(
                "w-3.5 h-3.5",
                isDone
                  ? "text-emerald-400"
                  : "text-[rgb(var(--color-text-muted))]",
              )}
            />
          </Button>

          {isEditing ? (
            <div className="flex items-center gap-2">
              {isDirty ? (
                <span className="text-[10px] text-amber-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                  Chưa lưu
                </span>
              ) : lastSavedAt ? (
                <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Đã lưu {formatSavedTime(lastSavedAt)}
                </span>
              ) : null}
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
            <>
              {lastSavedAt && (
                <span
                  className="text-[10px] text-emerald-400 font-medium flex items-center gap-1 shrink-0"
                  title={`Lần lưu cuối: ${formatSavedTime(lastSavedAt)}`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Đã lưu {formatSavedTime(lastSavedAt)}
                </span>
              )}
              <Button
                id="btn-edit-file"
                variant="secondary"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Edit3 className="w-3.5 h-3.5" />
                Chỉnh sửa
              </Button>
            </>
          )}

          {/* Menu thao tác phụ (⋯): gom các nút ít dùng để header gọn gàng */}
          <div className="relative" ref={overflowRef}>
            <Button
              id="btn-overflow-file"
              variant="secondary"
              size="icon"
              onClick={() => setOverflowOpen((v) => !v)}
              title="Thao tác khác"
              aria-label="Thao tác khác"
              aria-expanded={overflowOpen}
            >
              <Ellipsis className="w-3.5 h-3.5" />
            </Button>
            {overflowOpen && (
              <div className="absolute right-0 top-full mt-2 w-60 bg-[rgb(var(--color-surface-1))] border border-[rgb(var(--color-border))] rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Cỡ chữ đọc (A-/A+) */}
                <div className="px-2.5 py-1.5 mb-1">
                  <div className="text-[10px] font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wide mb-1.5">
                    Cỡ chữ đọc: {Math.round(fontScale * 100)}%
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => changeFontScale(-0.1)}
                      disabled={fontScale <= 0.8}
                      className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-lg border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface-2))] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                      Nhỏ hơn
                    </button>
                    <button
                      onClick={() => changeFontScale(0.1)}
                      disabled={fontScale >= 1.4}
                      className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-lg border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface-2))] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Lớn hơn
                    </button>
                  </div>
                </div>

                <div className="my-1 border-t border-[rgb(var(--color-border))]" />

                {/* Text-to-Speech (TTS) */}
                {!file.videoUrl && (
                  <button
                    id="btn-tts-file"
                    onClick={() => {
                      setOverflowOpen(false);
                      handleToggleSpeech();
                    }}
                    title={isSpeaking ? "Dừng đọc" : "Đọc văn bản"}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-surface-2))] rounded-lg transition-colors"
                  >
                    {isSpeaking ? (
                      <>
                        <VolumeX className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                        <span className="text-xs text-rose-400 font-medium">
                          Dừng đọc
                        </span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">Đọc bài</span>
                      </>
                    )}
                  </button>
                )}

                {/* Cấu hình giọng đọc */}
                {!file.videoUrl && (
                  <button
                    id="btn-tts-settings"
                    onClick={() => setShowTtsSettings((v) => !v)}
                    title="Cấu hình giọng đọc"
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-surface-2))] rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Settings2 className="w-3.5 h-3.5 text-[rgb(var(--color-text-muted))]" />
                      <span className="font-medium">Cấu hình giọng đọc</span>
                    </div>
                    <span className="text-[10px] text-[rgb(var(--color-text-muted))] font-mono">
                      {speechRate}x
                    </span>
                  </button>
                )}

                {/* Text-to-Speech (AI tóm tắt) */}
                {!file.videoUrl && (
                  <button
                    id="btn-summarize-file"
                    onClick={() => {
                      setOverflowOpen(false);
                      handleSummarize();
                    }}
                    title="Tóm tắt nội dung bằng AI"
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-surface-2))] rounded-lg transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span className="font-medium">Tóm tắt bằng AI</span>
                  </button>
                )}

                {/* Trình chiếu slide */}
                {!file.videoUrl && (
                  <button
                    id="btn-slide-file"
                    onClick={() => {
                      setOverflowOpen(false);
                      setSlideOpen(true);
                    }}
                    title="Trình chiếu slide từ markdown"
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-surface-2))] rounded-lg transition-colors"
                  >
                    <Presentation className="w-3.5 h-3.5" />
                    <span className="font-medium">Trình chiếu slide</span>
                  </button>
                )}

                <div className="my-1.5 border-t border-[rgb(var(--color-border))]" />

                <button
                  id="btn-download-file"
                  onClick={() => {
                    setOverflowOpen(false);
                    handleDownloadMarkdown();
                  }}
                  title="Tải xuống file Markdown"
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-surface-2))] rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="font-medium">Tải xuống Markdown</span>
                </button>

                <button
                  id="btn-copy-file"
                  onClick={() => {
                    setOverflowOpen(false);
                    handleCopyContent();
                  }}
                  title="Copy nội dung"
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-surface-2))] rounded-lg transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span className="font-medium">Copy nội dung</span>
                </button>

                <button
                  id="btn-history-file"
                  onClick={() => {
                    setOverflowOpen(false);
                    openRevisions();
                  }}
                  title="Lịch sử phiên bản"
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-surface-2))] rounded-lg transition-colors"
                >
                  <History className="w-3.5 h-3.5" />
                  <span className="font-medium">Lịch sử phiên bản</span>
                </button>

                <button
                  id="btn-share-file"
                  onClick={() => {
                    setOverflowOpen(false);
                    navigator.clipboard
                      .writeText(window.location.href)
                      .then(() =>
                        useToastStore
                          .getState()
                          .addToast(
                            "Đã copy đường dẫn chia sẻ vào clipboard!",
                            "success",
                          ),
                      )
                      .catch(() =>
                        useToastStore
                          .getState()
                          .addToast("Không thể copy đường dẫn", "error"),
                      );
                  }}
                  title="Chia sẻ link"
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-surface-2))] rounded-lg transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="font-medium">Chia sẻ link</span>
                </button>

                <div className="my-1.5 border-t border-[rgb(var(--color-border))]" />

                <button
                  id="btn-delete-file"
                  onClick={() => {
                    setOverflowOpen(false);
                    setDeleteConfirmOpen(true);
                  }}
                  title="Xoá tài liệu"
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="font-medium">Xóa tài liệu</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Bảng cấu hình thông số giọng đọc dạng Popup thả xuống */}
      {showTtsSettings && (
        <div className="bg-[rgb(var(--color-surface-1))] border-b border-[rgb(var(--color-border))] px-6 py-3 flex items-center justify-between text-xs animate-slide-down">
          <div className="flex items-center space-x-6">
            {/* Tốc độ đọc */}
            <div className="flex items-center space-x-2">
              <span className="text-[rgb(var(--color-text-muted))] font-medium">
                Tốc độ đọc Google Dịch:
              </span>
              {[0.8, 1.0, 1.25, 1.5].map((rate) => (
                <button
                  key={rate}
                  onClick={() => handleRateChange(rate)}
                  className={`px-2 py-0.5 rounded text-xs font-mono font-semibold transition-colors ${
                    speechRate === rate
                      ? "bg-indigo-600 text-white"
                      : "bg-[rgb(var(--color-bg))] text-[rgb(var(--color-text-muted))] hover:text-white"
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {/* Chế độ Giọng Neural Cloud vs Local */}

            {/* Chọn giọng đọc trong Bảng cấu hình */}
          </div>

          <span className="text-[10px] text-[rgb(var(--color-text-muted))] italic">
            Đang sử dụng Google Translate TTS (Giọng Nữ chuẩn)
          </span>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Document Panel */}
        <div
          ref={docPanelRef}
          className="flex-1 overflow-y-auto px-8 py-6 scrollbar-thin"
        >
          {isEditing ? (
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full h-full bg-[rgb(var(--color-bg))] font-mono text-sm border-0 focus:ring-0 outline-none text-[rgb(var(--color-text-secondary))] resize-none leading-relaxed"
              placeholder="Nhập nội dung Markdown..."
            />
          ) : (
            <article
              className={`prose prose-invert transition-[max-width,background-color] duration-300 ${
                zenOpen
                  ? "mx-auto max-w-[72ch] px-6 py-4 rounded-2xl bg-[rgb(var(--color-surface-1))/50]"
                  : "max-w-none"
              }`}
              style={{ fontSize: `${fontScale}em` }}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={FileMarkdownComponents}
              >
                {stripMindmapAnchors(processedContent)}
              </ReactMarkdown>

              {/* Nếu ReactMarkdown ở trên không dùng được thì thay bằng MarkdownRender ở dưới */}
              {/* <MarkdownRenderer
  components={FileMarkdownComponents}
>
  {stripMindmapAnchors(processedContent)}
</MarkdownRenderer> */}
            </article>
          )}
        </div>

        {/* Mục lục (ToC) */}
        {tocOpen && !zenOpen && headings.length > 0 && (
          <nav className="hidden lg:block w-52 shrink-0 border-l border-[rgb(var(--color-border))] overflow-y-auto scrollbar-thin px-3 py-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[rgb(var(--color-text-muted))] mb-2 px-1">
              Mục lục
            </div>
            <div className="space-y-0.5">
              {headings.map((h) => (
                <button
                  key={h.id}
                  onClick={() => scrollToHeading(h.id)}
                  className={`block w-full text-left rounded px-1.5 py-1 transition-colors hover:text-indigo-400 hover:bg-[rgb(var(--color-surface-1))] ${
                    h.level === 1
                      ? "pl-1.5 text-xs font-semibold text-[rgb(var(--color-text-primary))]"
                      : h.level === 2
                        ? "pl-4 text-[11px] font-medium text-[rgb(var(--color-text-secondary))]"
                        : "pl-7 text-[11px] text-[rgb(var(--color-text-muted))]"
                  }`}
                >
                  <span className="line-clamp-2">{h.text}</span>
                </button>
              ))}
            </div>
          </nav>
        )}

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
                            aria-label={note ? "Sửa ghi chú" : "Thêm ghi chú"}
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
                                aria-label="Sửa ghi chú"
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
                                aria-label="Xóa ghi chú"
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
                                if (
                                  e.key === "Enter" &&
                                  (e.ctrlKey || e.metaKey)
                                ) {
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
                  <div className="mt-2 p-3 rounded-md bg-[rgb(var(--color-bg))] border border-[rgb(var(--color-border))] text-xs text-[rgb(var(--color-text-secondary))] whitespace-pre-wrap max-h-56 overflow-y-auto scrollbar-thin">
                    {rev.content || "(trống)"}
                  </div>
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
