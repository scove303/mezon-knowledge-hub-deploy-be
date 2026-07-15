import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  FileText,
  Calendar,
  Edit3,
  Eye,
  Download,
  Share2,
  Save,
  Video,
  Clock,
  Play,
} from 'lucide-react';
import { Button } from '@/components/base-ui/Button';
import { useWorkspaceStore } from '@/features/folders/store';
import { fileService } from '@/features/files/services';

export default function FileViewer({ file, onSaveContent, folderName }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [seekTime, setSeekTime] = useState(0);
  const [playerKey, setPlayerKey] = useState(0);
  const iframeRef = useRef(null);

  useEffect(() => {
    if (file) {
      setEditedContent(file.content);
      setIsEditing(false);
      setSeekTime(0);
    }
  }, [file]);

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
          Hãy chọn một file từ cây thư mục ở Sidebar hoặc gửi lệnh tạo tri thức trên
          Mezon Bot.
        </p>
      </div>
    );
  }

  const handleSave = () => {
    onSaveContent(editedContent);
    setIsEditing(false);
  };

  const getYoutubeId = (url) => {
    if (!url) return null;
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const handleSeek = (seconds) => {
    setSeekTime(seconds);
    setPlayerKey((prev) => prev + 1);
  };

  const ytId = file.videoUrl ? getYoutubeId(file.videoUrl) : null;

  const MarkdownComponents = {
    a: ({ href, children, ...props }) => {
      if (href && href.startsWith('timestamp://')) {
        const secs = parseInt(href.replace('timestamp://', ''), 10);
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
          {...props}
        >
          {children}
        </a>
      );
    },
    h1: ({ children }) => (
      <h1 className="text-2xl font-extrabold text-[rgb(var(--color-text-primary))] mt-6 mb-4 pb-2 border-b border-[rgb(var(--color-border))]">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-xl font-bold text-[rgb(var(--color-text-secondary))] mt-6 mb-3">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-lg font-bold text-[rgb(var(--color-text-secondary))] mt-4 mb-2">
        {children}
      </h3>
    ),
    ul: ({ children }) => (
      <ul className="list-disc pl-6 my-3 space-y-1.5 text-[rgb(var(--color-text-secondary))]">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal pl-6 my-3 space-y-1.5 text-[rgb(var(--color-text-secondary))]">
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="text-sm leading-relaxed">{children}</li>
    ),
    blockquote: ({ children }) => (
      <div className="border-l-4 border-indigo-500 bg-[rgb(var(--color-surface-1))]/60 rounded-r-lg px-4 py-3 my-4 italic text-[rgb(var(--color-text-secondary))] text-sm">
        {children}
      </div>
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto my-6 rounded-lg border border-[rgb(var(--color-border))]">
        <table className="w-full text-left border-collapse">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-[rgb(var(--color-surface-1))] text-xs font-semibold text-[rgb(var(--color-text-muted))] border-b border-[rgb(var(--color-border))]">
        {children}
      </thead>
    ),
    tbody: ({ children }) => (
      <tbody className="divide-y divide-[rgb(var(--color-border))] text-sm">
        {children}
      </tbody>
    ),
    tr: ({ children }) => (
      <tr className="hover:bg-[rgb(var(--color-surface-1))]/30 transition-colors">
        {children}
      </tr>
    ),
    th: ({ children }) => (
      <th className="px-4 py-3 font-semibold">{children}</th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-3 text-[rgb(var(--color-text-secondary))]">
        {children}
      </td>
    ),
    code: ({ inline, className, children, ...props }) => {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <pre className="bg-[rgb(var(--color-bg))] border border-[rgb(var(--color-border))] rounded-lg p-4 my-4 overflow-x-auto text-xs font-mono text-[rgb(var(--color-text-secondary))] shadow-inner">
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      ) : (
        <code
          className="px-1.5 py-0.5 rounded bg-[rgb(var(--color-surface-1))] text-indigo-400 text-xs font-mono font-medium border border-[rgb(var(--color-border))]"
          {...props}
        >
          {children}
        </code>
      );
    },
  };

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
                {folderName || 'Thư mục gốc'}
              </span>
              <span>•</span>
              <Calendar className="w-3 h-3" />
              <span>Cập nhật {file.createdAt}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2">
          {isEditing ? (
            <Button id="btn-save-file" variant="success" size="sm" onClick={handleSave}>
              <Save className="w-3.5 h-3.5" />
              Lưu
            </Button>
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
            onClick={() => alert('Đang tải file PDF...')}
            title="Xuất PDF"
          >
            <Download className="w-3.5 h-3.5" />
          </Button>

          <Button
            id="btn-share-file"
            variant="secondary"
            size="icon"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              alert('Đã copy đường dẫn chia sẻ vào clipboard!');
            }}
            title="Chia sẻ link"
          >
            <Share2 className="w-3.5 h-3.5" />
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
                components={MarkdownComponents}
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
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                  {file.timestamps.map((t, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSeek(t.seconds)}
                      className={`flex items-start space-x-2.5 p-2 rounded-md cursor-pointer transition-all ${
                        seekTime === t.seconds
                          ? 'bg-indigo-600/10 border border-indigo-500/30 text-indigo-300'
                          : 'hover:bg-[rgb(var(--color-surface-1))]/50 border border-transparent text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]'
                      }`}
                    >
                      <span className="text-xs font-mono font-bold bg-[rgb(var(--color-surface-1))] text-indigo-400 px-1.5 py-0.5 rounded shrink-0">
                        {t.time}
                      </span>
                      <span className="text-xs leading-relaxed font-medium">
                        {t.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
