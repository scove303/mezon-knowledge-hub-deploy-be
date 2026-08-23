import { fileService } from '@/features/files/services';
import { folderService } from '@/features/folders/services';
import { useWorkspaceStore } from '@/features/folders/store';

// Hỗ trợ heading cấp 1-3 (## trước đây, giờ thêm # và ###)
const SECTION_HEADING_RE = /^#{1,3}\s+(.+)$/gm;
const INLINE_MD_RE = /[*_`]+/g;

// Regex để parse MINDMAP_NODE anchor tags từ AI output
// Format: [MINDMAP_NODE: id="node_1" | label="Toàn cảnh" | parent_id="root" | type="main"]
const MINDMAP_NODE_RE = /\[MINDMAP_NODE:\s*id="([^"]+)"\s*\|\s*label="([^"]+)"\s*\|\s*parent_id="([^"]+)"\s*\|\s*type="([^"]+)"\s*\]/g;

function cleanLabel(text) {
  return String(text || '').replace(INLINE_MD_RE, '').trim();
}

export function extractMindmapNodes(markdown) {
  if (!markdown) return [];
  const nodes = [];
  const re = new RegExp(MINDMAP_NODE_RE.source, 'g');
  let match;
  while ((match = re.exec(markdown)) !== null) {
    nodes.push({
      id: match[1],
      label: match[2],
      parentId: match[3] === 'root' ? null : match[3],
      type: match[4],
    });
  }
  return nodes;
}

export function extractSections(markdown) {
  if (!markdown) return [];
  const sections = [];
  const re = new RegExp(SECTION_HEADING_RE.source, 'gm');
  let match;
  while ((match = re.exec(markdown)) !== null) {
    const label = cleanLabel(match[1]);
    if (label) sections.push(label);
  }
  return sections;
}

export function getMindmapNodesForFile(content) {
  return extractMindmapNodes(content);
}

function firstSentence(markdown) {
  const text = (markdown || '')
    .replace(/^#.*$/gm, '')
    .replace(/[*_`#>|]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const sentences = text.match(/[^.!?\n]+[.!?]?/g);
  const first = sentences ? sentences[0] : text;
  return first && first.length > 8 ? first.slice(0, 160) : '';
}

export async function getMindmapData(folderId) {
  const store = useWorkspaceStore.getState();
  let folders = store.folders || [];
  let folder = folders.find((f) => String(f.id) === String(folderId));

  if (!folder) {
    try {
      const res = await folderService.getFolders();
      const folderList = Array.isArray(res) ? res : res?.data || [];
      if (typeof store.setFolders === 'function' && folderList.length > 0) {
        store.setFolders(folderList);
      }
      folder = folderList.find((f) => String(f.id) === String(folderId));
    } catch (err) {
      console.error('Lỗi khi tải danh sách thư mục cho mindmap:', err);
    }
  }

  if (!folder) throw new Error('Không tìm thấy thư mục');

  const files = folder.files || [];
  const details = await Promise.all(
    files.map(async (f) => {
      try {
        const res = await fileService.getFile(f.id);
        const data = res?.success ? res.data : null;
        if (!data) return { id: f.id, title: f.name || 'Tài liệu', summary: '', sections: [], mindmapNodes: [] };
        return {
          id: data.id,
          title: data.name || f.name || 'Tài liệu',
          summary: data.summary || firstSentence(data.content),
          sections: extractSections(data.content),
          mindmapNodes: extractMindmapNodes(data.content),
        };
      } catch (err) {
        console.error(`Lỗi tải file ${f.id}:`, err);
        return { id: f.id, title: f.name || 'Tài liệu', summary: '', sections: [], mindmapNodes: [] };
      }
    })
  );

  return {
    folderName: folder.name || 'Thư mục',
    folderId: folder.id,
    files: details,
  };
}

import axiosInstance from '@/libs/axios';

export async function getConceptMindmap(folderId) {
  const { data } = await axiosInstance.get(`/folders/${folderId}/mindmap`);
  return data?.data || null;
}

export async function regenerateConceptMindmap(folderId) {
  const { data } = await axiosInstance.post(`/folders/${folderId}/mindmap/regenerate`);
  return data?.data || null;
}

