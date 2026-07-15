import React, { useState } from 'react';
import {
  Folder,
  FileText,
  Search,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Compass,
  FileCheck,
  Video,
  HardDrive,
} from 'lucide-react';
import { Button } from '@/components/base-ui/Button';
import { Input } from '@/components/base-ui/Input';
import { Modal } from '@/components/base-ui/Modal';
import { authService } from '@/features/auth/services';
import { useAuthStore } from '@/features/auth/store';
import { useWorkspaceStore } from '@/features/folders/store';
import { folderService } from '@/features/folders/services';

export default function Sidebar() {
  const store = useWorkspaceStore();
  const folders = store.getFilteredFolders();
  const selectedFolder = store.getSelectedFolder();
  const selectedFile = store.getSelectedFile();
  const searchQuery = store.searchQuery;
  const setSearchQuery = store.setSearch;
  const selectFolder = store.setSelectedFolder;
  const selectFile = (folderId, fileId) => {
    store.setSelectedFolder(folderId);
    store.setSelectedFile(fileId);
  };

  const createFolder = async (name, type) => {
    try {
      const res = await folderService.createFolder(name, type);
      if (res.success) {
        // Optimistic update or refetch
      }
    } catch (err) {}
  };

  const createFile = async (folderId, name, content) => {
    // ... fileService integration
  };

  const deleteFolder = async (folderId) => {
    // ...
  };

  const deleteFile = async (folderId, fileId) => {
    // ...
  };
  const [expandedFolders, setExpandedFolders] = useState({
    'folder-1': true,
    'folder-2': true,
    'folder-3': true,
  });
  const [newFolderName, setNewFolderName] = useState('');
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [newFileName, setNewFileName] = useState({});
  const [addingFileToFolderId, setAddingFileToFolderId] = useState(null);

  const toggleExpand = (folderId, e) => {
    e.stopPropagation();
    setExpandedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const handleCreateFolder = (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const types = ['roadmap', 'document', 'video'];
    const randomType = types[folders.length % 3];
    const emoji =
      randomType === 'roadmap' ? '🐍 ' : randomType === 'document' ? '🚗 ' : '🎥 ';
    createFolder(emoji + newFolderName.trim(), randomType);
    setNewFolderName('');
    setShowAddFolder(false);
  };

  const handleCreateFile = (folderId) => {
    const fileName = newFileName[folderId];
    if (!fileName || !fileName.trim()) return;
    const formattedName = fileName.trim().endsWith('.md')
      ? fileName.trim()
      : `${fileName.trim()}.md`;
    createFile(
      folderId,
      formattedName,
      `# ${formattedName.replace('.md', '')}\n\nNhập nội dung tài liệu ở đây...`
    );
    setNewFileName((prev) => ({ ...prev, [folderId]: '' }));
    setAddingFileToFolderId(null);
  };

  const getFolderIcon = (type) => {
    switch (type) {
      case 'roadmap':
        return <Compass className="w-4 h-4 text-emerald-400" />;
      case 'document':
        return <FileCheck className="w-4 h-4 text-cyan-400" />;
      case 'video':
        return <Video className="w-4 h-4 text-rose-400" />;
      default:
        return <Folder className="w-4 h-4 text-indigo-400" />;
    }
  };

  return (
    <aside className="w-80 bg-[rgb(var(--color-surface-1))] border-r border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] flex flex-col h-full select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-[rgb(var(--color-border))] flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <HardDrive className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-[rgb(var(--color-text-primary))] tracking-wide">
            Mezon MindFolder
          </h1>
          <p className="text-xs text-indigo-400 font-medium">Knowledge Hub</p>
        </div>
      </div>

      {/* Search */}
      <div className="p-4">
        <div className="relative">
          <input
            id="sidebar-search"
            type="text"
            placeholder="Tìm kiếm tài liệu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[rgb(var(--color-bg))] border border-[rgb(var(--color-border))] focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/50 rounded-lg pl-10 pr-4 py-2 text-sm text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-muted))] outline-none transition-all"
          />
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-[rgb(var(--color-text-muted))]" />
        </div>
      </div>

      {/* Folder Navigation */}
      <div className="flex-1 overflow-y-auto px-3 space-y-4 pb-4 scrollbar-thin">
        <div className="flex items-center justify-between px-2 text-xs font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wider">
          <span>Danh sách Thư Mục</span>
          <Button
            id="btn-add-folder"
            variant="ghost"
            size="icon"
            onClick={() => setShowAddFolder(!showAddFolder)}
            title="Tạo thư mục mới"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Create Folder Form */}
        {showAddFolder && (
          <form
            onSubmit={handleCreateFolder}
            className="px-2 py-2 bg-[rgb(var(--color-bg))] rounded-lg border border-[rgb(var(--color-border))] space-y-2 animate-fade-in"
          >
            <input
              type="text"
              placeholder="Tên thư mục mới..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="w-full bg-[rgb(var(--color-surface-1))] border border-[rgb(var(--color-border))] rounded px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500 text-[rgb(var(--color-text-primary))]"
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setShowAddFolder(false)}
              >
                Hủy
              </Button>
              <Button type="submit" variant="primary" size="xs">
                Tạo
              </Button>
            </div>
          </form>
        )}

        {/* Folders List */}
        <ul className="space-y-1.5">
          {folders.length === 0 ? (
            <div className="text-center py-6 text-sm text-[rgb(var(--color-text-muted))]">
              Không tìm thấy tài liệu nào
            </div>
          ) : (
            folders.map((folder) => {
              const isExpanded = !!expandedFolders[folder.id];
              const isSelected = selectedFolder?.id === folder.id;

              return (
                <li
                  key={folder.id}
                  className="group/folder rounded-lg overflow-hidden transition-all duration-150"
                >
                  {/* Folder Header */}
                  <div
                    onClick={() => selectFolder(folder.id)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-600/10 text-indigo-300 border border-indigo-500/20 font-medium'
                        : 'hover:bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))] border border-transparent'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <button
                        onClick={(e) => toggleExpand(folder.id, e)}
                        className="text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))] p-0.5 rounded transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {getFolderIcon(folder.type)}
                      <span className="text-sm truncate select-none">
                        {folder.name}
                      </span>
                    </div>

                    {/* Hover Actions */}
                    <div className="opacity-0 group-hover/folder:opacity-100 flex items-center space-x-1 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAddingFileToFolderId(
                            addingFileToFolderId === folder.id ? null : folder.id
                          );
                        }}
                        className="text-[rgb(var(--color-text-muted))] hover:text-indigo-400 p-0.5 rounded transition-colors"
                        title="Tạo file mới"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            confirm(`Bạn có chắc muốn xóa thư mục "${folder.name}"?`)
                          ) {
                            deleteFolder(folder.id);
                          }
                        }}
                        className="text-[rgb(var(--color-text-muted))] hover:text-rose-500 p-0.5 rounded transition-colors"
                        title="Xóa thư mục"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Children Files */}
                  {isExpanded && (
                    <ul className="pl-7 pr-1 mt-1 mb-2 space-y-1 border-l border-[rgb(var(--color-border))] ml-4 animate-fade-in">
                      {/* Inline file creation */}
                      {addingFileToFolderId === folder.id && (
                        <div className="px-2 py-1.5 bg-[rgb(var(--color-bg))] rounded border border-[rgb(var(--color-border))] flex items-center space-x-1">
                          <input
                            type="text"
                            placeholder="file_name.md..."
                            value={newFileName[folder.id] || ''}
                            onChange={(e) =>
                              setNewFileName((prev) => ({
                                ...prev,
                                [folder.id]: e.target.value,
                              }))
                            }
                            className="bg-transparent text-xs text-[rgb(var(--color-text-primary))] outline-none w-full py-0.5"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCreateFile(folder.id);
                              if (e.key === 'Escape') setAddingFileToFolderId(null);
                            }}
                          />
                          <button
                            onClick={() => handleCreateFile(folder.id)}
                            className="text-indigo-400 hover:text-indigo-300 text-xs font-semibold px-1 transition-colors"
                          >
                            Lưu
                          </button>
                        </div>
                      )}

                      {/* File Items */}
                      {folder.files.map((file) => {
                        const isFileSelected = selectedFile?.id === file.id;
                        return (
                          <li
                            key={file.id}
                            onClick={() => selectFile(folder.id, file.id)}
                            className={`group/file flex items-center justify-between px-3 py-1.5 rounded cursor-pointer transition-colors ${
                              isFileSelected
                                ? 'bg-indigo-600/15 text-indigo-400 font-semibold'
                                : 'hover:bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]'
                            }`}
                          >
                            <div className="flex items-center space-x-2 min-w-0">
                              <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="text-xs truncate select-none">
                                {file.name}
                              </span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (
                                  confirm(
                                    `Bạn có chắc muốn xóa file "${file.name}"?`
                                  )
                                ) {
                                  deleteFile(folder.id, file.id);
                                }
                              }}
                              className="opacity-0 group-hover/file:opacity-100 text-[rgb(var(--color-text-muted))] hover:text-rose-500 p-0.5 rounded transition-all"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </li>
                        );
                      })}

                      {folder.files.length === 0 &&
                        addingFileToFolderId !== folder.id && (
                          <div className="text-[10px] text-[rgb(var(--color-text-disabled))] px-3 py-1 italic select-none">
                            Không có file nào
                          </div>
                        )}
                    </ul>
                  )}
                </li>
              );
            })
          )}
        </ul>
      </div>

      {/* Footer */}
      <div className="p-4 bg-[rgb(var(--color-bg))] border-t border-[rgb(var(--color-border))] text-[10px] text-[rgb(var(--color-text-muted))] flex flex-col space-y-1">
        <div className="flex justify-between">
          <span>Phiên bản UI</span>
          <span className="font-semibold text-[rgb(var(--color-text-secondary))]">2.0.0</span>
        </div>
        <div className="flex justify-between">
          <span>Kết nối API</span>
          <span className="flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-emerald-500 font-semibold">Đang đồng bộ</span>
          </span>
        </div>
      </div>
    </aside>
  );
}
