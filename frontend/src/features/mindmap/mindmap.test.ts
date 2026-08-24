import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildTree, layoutHorizontal, layoutRadial } from './layout';
import { getMindmapData, extractMindmapNodes } from './services';
import { useWorkspaceStore } from '@/features/folders/store';
import { folderService } from '@/features/folders/services';
import { fileService } from '@/features/files/services';

vi.mock('@/features/folders/services', () => ({
  folderService: {
    getFolders: vi.fn(),
  },
}));

vi.mock('@/features/files/services', () => ({
  fileService: {
    getFile: vi.fn(),
  },
}));

describe('Mindmap layout & tree builder', () => {
  it('buildTree handles section headings fallback correctly', () => {
    const files = [
      {
        id: 'file-1',
        title: 'Bài 1: Giới thiệu',
        summary: 'Tóm tắt bài 1',
        sections: ['Khái niệm cơ bản', 'Cài đặt môi trường'],
        mindmapNodes: [],
      },
    ];

    const tree = buildTree('Khoá học React', files);
    expect(tree.id).toBe('mindmap-root');
    expect(tree.label).toBe('Khoá học React');
    expect(tree.children).toHaveLength(1);

    const lesson = tree.children[0];
    expect(lesson.id).toBe('lesson-file-1');
    expect(lesson.shortLabel).toBe('Bài 1: Giới thiệu');
    expect(lesson.children).toHaveLength(2);
    expect(lesson.children[0].label).toBe('Khái niệm cơ bản');
    expect(lesson.children[0].fileId).toBe('file-1');
  });

  it('buildTree handles AI anchor nodes with custom types (main, sub, detail)', () => {
    const files = [
      {
        id: 'file-2',
        title: 'Bài 2: Advanced Topics',
        summary: 'Tóm tắt bài 2',
        sections: [],
        mindmapNodes: [
          { id: 'node_1', label: 'Chủ đề 1', parentId: null, type: 'main' },
          { id: 'node_1_1', label: 'Chi tiết 1.1', parentId: 'node_1', type: 'sub' },
          { id: 'node_1_1_1', label: 'Ý sâu hơn', parentId: 'node_1_1', type: 'detail' },
        ],
      },
    ];

    const tree = buildTree('Khoá học React', files);
    const lesson = tree.children[0];
    expect(lesson.children).toHaveLength(1);
    const mainNode = lesson.children[0];
    expect(mainNode.id).toBe('anchor-file-2-node_1');
    expect(mainNode.children).toHaveLength(1);
    const subNode = mainNode.children[0];
    expect(subNode.id).toBe('anchor-file-2-node_1_1');
    expect(subNode.children).toHaveLength(1);
    expect(subNode.children[0].id).toBe('anchor-file-2-node_1_1_1');
  });

  it('layoutHorizontal generates valid nodes and edges without crashing', () => {
    const files = [
      {
        id: 'file-1',
        title: 'Bài 1',
        summary: 'Tóm tắt',
        sections: ['Mục 1', 'Mục 2'],
        mindmapNodes: [],
      },
      {
        id: 'file-2',
        title: 'Bài 2',
        summary: 'Tóm tắt 2',
        sections: [],
        mindmapNodes: [
          { id: 'node_1', label: 'Nhánh chính', parentId: null, type: 'main' },
          { id: 'node_2', label: 'Nhánh con', parentId: 'node_1', type: 'sub' },
        ],
      },
    ];

    const tree = buildTree('Folder Test', files);
    const layout = layoutHorizontal(tree);

    expect(layout.nodes.length).toBeGreaterThan(0);
    expect(layout.edges.length).toBeGreaterThan(0);
    for (const node of layout.nodes) {
      expect(node.position.x).not.toBeNaN();
      expect(node.position.y).not.toBeNaN();
      expect(node.data.node.width).toBeGreaterThan(0);
      expect(node.data.node.height).toBeGreaterThan(0);
    }
  });

  it('layoutRadial generates valid nodes and edges', () => {
    const files = [
      {
        id: 'file-1',
        title: 'Bài 1',
        summary: 'Tóm tắt',
        sections: ['Mục 1'],
        mindmapNodes: [],
      },
    ];

    const tree = buildTree('Folder Test', files);
    const layout = layoutRadial(tree);

    expect(layout.nodes.length).toBeGreaterThan(0);
    expect(layout.edges.length).toBeGreaterThan(0);
    for (const node of layout.nodes) {
      expect(node.position.x).not.toBeNaN();
      expect(node.position.y).not.toBeNaN();
    }
  });
});

describe('Mindmap services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.setState({
      folders: [],
      selectedFolderId: null,
      selectedFileId: null,
    });
  });

  it('extractMindmapNodes extracts anchor nodes accurately', () => {
    const content = `
# Title
[MINDMAP_NODE: id="node_1" | label="Tổng quan" | parent_id="root" | type="main"]
Some text
[MINDMAP_NODE: id="node_1_1" | label="Chi tiết" | parent_id="node_1" | type="sub"]
`;
    const nodes = extractMindmapNodes(content);
    expect(nodes).toEqual([
      { id: 'node_1', label: 'Tổng quan', parentId: null, type: 'main' },
      { id: 'node_1_1', label: 'Chi tiết', parentId: 'node_1', type: 'sub' },
    ]);
  });

  it('getMindmapData fetches folders from API when store is empty', async () => {
    const mockFolder = {
      id: 'f-123',
      name: 'Thư mục AI',
      files: [{ id: 'file-99', name: 'File Test' }],
    };

    (folderService.getFolders as any).mockResolvedValueOnce({
      success: true,
      data: [mockFolder],
    });

    (fileService.getFile as any).mockResolvedValueOnce({
      success: true,
      data: {
        id: 'file-99',
        name: 'File Test',
        content: '# Heading 1\nNội dung bài viết',
      },
    });

    const data = await getMindmapData('f-123');
    expect(data.folderName).toBe('Thư mục AI');
    expect(data.files).toHaveLength(1);
    expect(data.files[0].title).toBe('File Test');
    expect(data.files[0].sections).toContain('Heading 1');
  });
});
