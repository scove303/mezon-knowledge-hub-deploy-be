with open('src/app/dashboard/folders/[folderId]/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add imports
old_imports = '''import {
  PanelRightClose,
  PanelRight,
  Network,
  FileText,
  Upload,
  Loader2,
  Download,
  X,
} from "lucide-react";'''

new_imports = '''import {
  PanelRightClose,
  PanelRight,
  Network,
  FileText,
  Upload,
  Loader2,
  Download,
  X,
  Share2,
} from "lucide-react";
import { useLanguage } from "@/localization/LanguageContext";
import vn from "@/localization/languages/vn.json";
import en from "@/localization/languages/en.json";
import { sharedChatService } from "@/features/shared-chats/services";'''

content = content.replace(old_imports, new_imports)

# 2. Add state after isMobile
old_state = '''  const isMobile = useMediaQuery("(max-width: 767px)");
  const [showMindmap, setShowMindmap] = useState(() => viewParam === "mindmap");'''

new_state = '''  const isMobile = useMediaQuery("(max-width: 767px)");
  const { currentLanguage } = useLanguage();
  const translation = { en, vn };
  const t = translation[currentLanguage];
  const addToast = useToastStore((s) => s.addToast);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [showMindmap, setShowMindmap] = useState(() => viewParam === "mindmap");
  const [sharing, setSharing] = useState(false);
  const [shareResult, setShareResult] = useState<{ share_url: string; share_code: string } | null>(null);'''

content = content.replace(old_state, new_state)

# 3. Add handleShareFolder after handleExportFolder
old_export = '''    } finally {
      setIsExporting(false);
    }
  };

  // Upload file thủ công vào thư mục hiện tại'''

new_export = '''    } finally {
      setIsExporting(false);
    }
  };

  // Chia sẻ thư mục thành chat
  const handleShareFolder = async () => {
    if (!folder) return;
    setSharing(true);
    try {
      const res = await sharedChatService.shareChat({
        folder_id: folderId,
        title: `Chat: ${folder.name}`,
        description: `Shared from ${folder.name}`,
        topic: folder.name,
        conversation_history: messages
          .filter((m) => m.role === "user" || m.role === "bot")
          .map((m) => ({ role: m.role, content: m.content, timestamp: new Date().toISOString() })),
        is_public: true,
      });
      if (res.success) {
        setShareResult({ share_url: res.data.share_url, share_code: res.data.share_code });
        addToast(t.sharedChats?.shared || "Folder shared successfully!", "success");
      } else {
        addToast(res.message || t.sharedChats?.shareError || "Share failed", "error");
      }
    } catch (err) {
      console.error("Share folder error:", err);
      addToast(t.sharedChats?.shareError || "Share failed", "error");
    } finally {
      setSharing(false);
    }
  };

  // Upload file thủ công vào thư mục hiện tại'''

content = content.replace(old_export, new_export)

# 4. Add share button in header
old_button = '''            <button
              onClick={toggleDocumentSide}
              className="p-1.5 hover:bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-secondary))] rounded-lg transition-colors"
              title="Bật/Tắt cửa sổ tài liệu"
              aria-label="Bật/Tắt cửa sổ tài liệu"
            >
              {isDocumentSideOpen ? (
                <PanelRightClose size={20} />
              ) : (
                <PanelRight size={20} />
              )}
            </button>
          </div>
        </div>

        <ChatHistory messages={messages} />'''

new_button = '''            <button
              onClick={toggleDocumentSide}
              className="p-1.5 hover:bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-secondary))] rounded-lg transition-colors"
              title="Bật/Tắt cửa sổ tài liệu"
              aria-label="Bật/Tắt cửa sổ tài liệu"
            >
              {isDocumentSideOpen ? (
                <PanelRightClose size={20} />
              ) : (
                <PanelRight size={20} />
              )}
            </button>
            {/* Share Button - only render after mount to avoid hydration mismatch */}
            {mounted && (
              <button
                onClick={handleShareFolder}
                disabled={sharing || !folder}
                className="p-1.5 hover:bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-secondary))] rounded-lg transition-colors disabled:opacity-40"
                title={t.sharedChats?.shareFolder || "Share folder as chat"}
                aria-label={t.sharedChats?.shareFolder || "Share folder as chat"}
              >
                {sharing ? (
                  <Loader2 size={20} className="animate-spin text-indigo-400" />
                ) : (
                  <Share2 size={20} />
                )}
              </button>
            )}
          </div>
        </div>

        <ChatHistory messages={messages} />'''

content = content.replace(old_button, new_button)

# 5. Add modal before closing
old_end = '''        )}
      </div>
    </div>
  );
}'''

new_end = '''        )}
      </div>
    </div>

    {/* Share Result Modal */}
    {shareResult && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md bg-[rgb(var(--color-surface-1))] rounded-xl border border-[rgb(var(--color-border))] p-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg text-[rgb(var(--color-text-primary))]">
              {t.sharedChats?.shared || "Folder Shared!"}
            </h3>
            <button
              onClick={() => setShareResult(null)}
              className="p-1 hover:bg-[rgb(var(--color-surface-2))] rounded-lg text-[rgb(var(--color-text-muted))] transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[rgb(var(--color-text-muted))] block mb-1">
                {t.sharedChats?.shareCode || "Share Code"}
              </label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={shareResult.share_code}
                  className="flex-1 px-3 py-2 rounded-lg bg-[rgb(var(--color-bg))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] font-mono text-sm"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareResult.share_code);
                    addToast(t.sharedChats?.copied || "Copied!", "success");
                  }}
                  className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
                >
                  {t.sharedChats?.copy || "Copy"}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-[rgb(var(--color-text-muted))] block mb-1">
                {t.sharedChats?.shareUrl || "Share URL"}
              </label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={shareResult.share_url}
                  className="flex-1 px-3 py-2 rounded-lg bg-[rgb(var(--color-bg))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] text-sm truncate"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareResult.share_url);
                    addToast(t.sharedChats?.copied || "Copied!", "success");
                  }}
                  className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
                >
                  {t.sharedChats?.copy || "Copy"}
                </button>
              </div>
            </div>
            <Link
              href={shareResult.share_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center px-4 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition-colors"
            >
              {t.sharedChats?.viewSharedChat || "View Shared Chat"}
            </Link>
          </div>
        </div>
      </div>
    )}

  </div>
  );
}'''

content = content.replace(old_end, new_end)

with open('src/app/dashboard/folders/[folderId]/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Applied all changes')