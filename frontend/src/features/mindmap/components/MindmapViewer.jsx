'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Controls,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toPng } from 'html-to-image';
import { Loader2, Network, RefreshCw, SplitSquareHorizontal, Orbit, FileQuestion, ImageDown } from 'lucide-react';
import MindmapNode from './MindmapNode';
import KineticGrid from '@/components/ui/kinetic-grid';
import { getMindmapData } from '../services';
import { buildTree, layoutHorizontal, layoutRadial } from '../layout';

const nodeTypes = { mindmapNode: MindmapNode };

export default function MindmapViewer({ folderId, onOpenLesson }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [layoutKind, setLayoutKind] = useState('horizontal');
  const [flowKey, setFlowKey] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [hoveredId, setHoveredId] = useState(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mindmapData = await getMindmapData(folderId);
        if (!cancelled) {
          setData(mindmapData);
          setError('');
          setLoading(false);
        }
      } catch (err) {
        console.error('Lỗi tải dữ liệu mindmap:', err);
        if (!cancelled) {
          setError('Không thể tải dữ liệu sơ đồ tư duy. Vui lòng thử lại.');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [folderId, refreshKey]);

  const switchLayout = (kind) => {
    setLayoutKind(kind);
    setFlowKey((k) => k + 1);
  };

  const refresh = () => {
    setLoading(true);
    setError('');
    setRefreshKey((k) => k + 1);
  };

  const exportPng = useCallback(async () => {
    const el = document.querySelector('.mindmap-canvas .react-flow');
    if (!el) return;
    try {
      const dataUrl = await toPng(el, {
        backgroundColor: '#0b1220',
        pixelRatio: 2,
      });
      const a = document.createElement('a');
      a.download = `mindmap-${folderId}.png`;
      a.href = dataUrl;
      a.click();
    } catch (err) {
      console.error('Lỗi xuất ảnh sơ đồ tư duy:', err);
    }
  }, [folderId]);

  const graph = useMemo(() => {
    if (!data) return null;
    const tree = buildTree(data.folderName, data.files);
    return layoutKind === 'radial' ? layoutRadial(tree) : layoutHorizontal(tree);
  }, [data, layoutKind]);

  const childMap = useMemo(() => {
    const map = {};
    if (!graph) return map;
    for (const n of graph.nodes) {
      map[n.id] = (n.data.node.children || []).map((c) => c.id);
    }
    return map;
  }, [graph]);

  const parentMap = useMemo(() => {
    const map = {};
    if (!graph) return map;
    for (const n of graph.nodes) {
      for (const child of n.data.node.children || []) map[child.id] = n.id;
    }
    return map;
  }, [graph]);

  // Nhánh được hover = chuỗi cạnh từ root dọc xuống node đang hover
  const branchEdgeIds = useMemo(() => {
    if (!hoveredId || !parentMap[hoveredId]) return null;
    const ids = new Set();
    let cur = hoveredId;
    while (parentMap[cur]) {
      ids.add(`e-${parentMap[cur]}-${cur}`);
      cur = parentMap[cur];
    }
    return ids;
  }, [hoveredId, parentMap]);

  const subtreeIds = useMemo(() => {
    if (!hoveredId || !childMap[hoveredId]) return null;
    const ids = new Set([hoveredId]);
    const stack = [...(childMap[hoveredId] || [])];
    while (stack.length) {
      const id = stack.pop();
      if (ids.has(id)) continue;
      ids.add(id);
      stack.push(...(childMap[id] || []));
    }
    return ids;
  }, [hoveredId, childMap]);

  const displayNodes = useMemo(
    () =>
      graph
        ? graph.nodes.map((n) => {
            const inSubtree = subtreeIds ? subtreeIds.has(n.id) : false;
            return {
              ...n,
              className: inSubtree ? 'mindmap-active' : undefined,
              data: { ...n.data, dimmed: subtreeIds ? !inSubtree : false },
            };
          })
        : [],
    [graph, subtreeIds],
  );

  const displayEdges = useMemo(
    () =>
      graph
        ? graph.edges.map((e) => {
            const active =
              !subtreeIds ||
              subtreeIds.has(e.source) ||
              subtreeIds.has(e.target) ||
              branchEdgeIds?.has(e.id);
            const isHoveredEdge = e.id === hoveredEdgeId;
            return {
              ...e,
              markerEnd: { type: MarkerType.ArrowClosed },
              style: {
                ...e.style,
                color: e.style.stroke,
                opacity: subtreeIds ? (active ? 1 : 0.12) : 1,
                transition: 'opacity 320ms cubic-bezier(0.4, 0, 0.2, 1)',
                strokeWidth: isHoveredEdge
                  ? e.style.strokeWidth + 1.8
                  : e.style.strokeWidth,
              },
              className: active
                ? isHoveredEdge
                  ? 'mindmap-active mindmap-edge-hover'
                  : 'mindmap-active'
                : undefined,
            };
          })
        : [],
    [graph, subtreeIds, branchEdgeIds, hoveredEdgeId],
  );

  const onNodeClick = useCallback(
    (_, node) => {
      if (node.data?.fileId && onOpenLesson) onOpenLesson(node.data.fileId);
    },
    [onOpenLesson],
  );

  const hoverTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const clearHover = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setHoveredId(null);
      setHoveredEdgeId(null);
      hoverTimerRef.current = null;
    }, 120);
  }, []);

  const cancelHoverClear = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  const onNodeMouseEnter = useCallback(
    (_, node) => {
      cancelHoverClear();
      setHoveredId((prev) => (prev === node.id ? prev : node.id));
    },
    [cancelHoverClear],
  );

  const onNodeMouseLeave = useCallback(() => {
    clearHover();
  }, [clearHover]);

  const onEdgeMouseEnter = useCallback(
    (_, edge) => {
      cancelHoverClear();
      setHoveredId((prev) => (prev === edge.target ? prev : edge.target));
      setHoveredEdgeId((prev) => (prev === edge.id ? prev : edge.id));
    },
    [cancelHoverClear],
  );

  const onEdgeMouseLeave = useCallback(() => {
    clearHover();
  }, [clearHover]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-[rgb(var(--color-text-muted))]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          <span className="text-sm">Đang xây dựng sơ đồ tư duy...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 max-w-sm text-center">
          {error}
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 mx-auto mt-3 px-3 py-1.5 rounded-lg text-xs bg-[rgb(var(--color-surface-2))] border border-[rgb(var(--color-border))] hover:text-indigo-400 transition-colors"
          >
            <RefreshCw size={13} /> Thử lại
          </button>
        </div>
      </div>
    );
  }

  if (!data || data.files.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[rgb(var(--color-text-muted))] p-8">
        <div className="flex flex-col items-center gap-3 text-center max-w-xs">
          <FileQuestion size={40} className="text-[rgb(var(--color-text-disabled))]" />
          <p className="text-sm">
            Thư mục chưa có bài học nào để vẽ sơ đồ tư duy. Hãy tạo lộ trình hoặc thêm tài liệu
            trước.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[rgb(var(--color-border))] shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium text-[rgb(var(--color-text-primary))]">
          <Network size={16} className="text-indigo-400" />
          Sơ đồ tư duy
          <span className="text-[11px] font-normal text-[rgb(var(--color-text-muted))]">
            ({data.files.length} bài học)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => switchLayout('horizontal')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
              layoutKind === 'horizontal'
                ? 'bg-indigo-600 text-white border-indigo-500'
                : 'text-[rgb(var(--color-text-secondary))] border-[rgb(var(--color-border))] hover:text-indigo-400'
            }`}
            title="Bố cục ngang"
          >
            <SplitSquareHorizontal size={13} />
            Ngang
          </button>
          <button
            onClick={() => switchLayout('radial')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
              layoutKind === 'radial'
                ? 'bg-indigo-600 text-white border-indigo-500'
                : 'text-[rgb(var(--color-text-secondary))] border-[rgb(var(--color-border))] hover:text-indigo-400'
            }`}
            title="Bố cục tròn (tâm tỏa)"
          >
            <Orbit size={13} />
            Tròn
          </button>
          <button
            onClick={exportPng}
            className="p-1.5 rounded-lg text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface-2))] hover:text-indigo-400 transition-colors"
            title="Xuất ảnh PNG"
          >
            <ImageDown size={15} />
          </button>
          <button
            onClick={refresh}
            className="p-1.5 rounded-lg text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface-2))] hover:text-indigo-400 transition-colors"
            title="Làm mới sơ đồ"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <KineticGrid globalColor="default" className="h-full">
          <div className="mindmap-canvas absolute inset-0">
            <ReactFlow
              key={flowKey}
              nodes={displayNodes}
              edges={displayEdges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.15 }}
              minZoom={0.15}
              maxZoom={1.5}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              panOnScroll
              zoomOnScroll
              proOptions={{ hideAttribution: true }}
              colorMode="dark"
              onNodeClick={onNodeClick}
              onNodeMouseEnter={onNodeMouseEnter}
              onNodeMouseLeave={onNodeMouseLeave}
              onEdgeMouseEnter={onEdgeMouseEnter}
              onEdgeMouseLeave={onEdgeMouseLeave}
            >
              <Controls showInteractive={false} position="bottom-left" />
            </ReactFlow>
          </div>
        </KineticGrid>
      </div>
    </div>
  );
}
