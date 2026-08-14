import { fileService } from '@/features/files/services';
import { useWorkspaceStore } from '@/features/folders/store';

// Hỗ trợ heading cấp 1-3 (## trước đây, giờ thêm # và ###)
const SECTION_HEADING_RE = /^#{1,3}\s+(.+)$/gm;
const INLINE_MD_RE = /[*_`]+/g;

function cleanLabel(text) {
  return text.replace(INLINE_MD_RE, '').trim();
}

function extractSections(markdown) {
  const sections = [];
  const re = new RegExp(SECTION_HEADING_RE.source, 'gm');
  let match;
  while ((match = re.exec(markdown)) !== null) {
    const label = cleanLabel(match[1]);
    if (label) sections.push(label);
  }
  return sections;
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
  const { folders } = useWorkspaceStore.getState();
  const folder = folders.find((f) => f.id === folderId);
  if (!folder) throw new Error('Không tìm thấy thư mục');

  const files = folder.files || [];
  const details = await Promise.all(
    files.map(async (f) => {
      try {
        const res = await fileService.getFile(f.id);
        const data = res?.success ? res.data : null;
        if (!data) return { id: f.id, title: f.name, summary: '', sections: [] };
        return {
          id: data.id,
          title: data.name,
          summary: data.summary || firstSentence(data.content),
          sections: extractSections(data.content),
        };
      } catch (err) {
        console.error(`Lỗi tải file ${f.id}:`, err);
        return { id: f.id, title: f.name, summary: '', sections: [] };
      }
    })
  );

  return {
    folderName: folder.name,
    folderId: folder.id,
    files: details,
  };
}
