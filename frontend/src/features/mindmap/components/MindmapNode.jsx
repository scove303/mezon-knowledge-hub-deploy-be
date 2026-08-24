import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Folder, BookOpen, Dot, ChevronRight } from 'lucide-react';

const NODE_TRANSITION = 'opacity 320ms cubic-bezier(0.4, 0, 0.2, 1)';

function MindmapNode({ data }) {
  const { node, dimmed } = data;
  const fade = {
    width: node.width,
    opacity: dimmed ? 0.22 : 1,
    transition: NODE_TRANSITION,
  };

  if (node.kind === 'root') {
    return (
      <div
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 border border-indigo-400/40 min-w-0"
        style={fade}
      >
        <Folder size={24} className="shrink-0" />
        <span className="font-semibold text-[21px] leading-snug line-clamp-2">{node.label}</span>
        <Handle type="source" position={Position.Right} className="!opacity-0" />
      </div>
    );
  }

  if (node.kind === 'lesson') {
    const displayLabel = node.shortLabel || node.label;
    const hasDescription = node.label !== node.shortLabel;
    
    return (
      <div
        className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[rgb(var(--color-surface-1))] border border-[rgb(var(--color-border))] shadow-sm hover:shadow-md transition-all cursor-pointer select-none min-w-0"
        style={{ ...fade, borderLeft: `3px solid ${node.color}` }}
      >
        <BookOpen size={18} className="shrink-0 mt-0.5" style={{ color: node.color }} />
        <div className="flex-1 min-w-0">
          <span className="text-[17px] font-semibold text-[rgb(var(--color-text-primary))] leading-snug line-clamp-2 block">
            {displayLabel}
          </span>
          {hasDescription && (
            <span className="text-[13px] text-[rgb(var(--color-text-muted))] leading-snug line-clamp-2 block mt-0.5 max-w-[400px]">
              {node.label.replace(node.shortLabel + ': ', '').replace(node.shortLabel, '')}
            </span>
          )}
        </div>
        <Handle type="target" position={Position.Left} className="!opacity-0" />
        <Handle type="source" position={Position.Right} className="!opacity-0" />
      </div>
    );
  }

  return (
    <div
      className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-md bg-[rgb(var(--color-surface-2))] border border-[rgb(var(--color-border))] select-none min-w-0"
      style={{ ...fade, borderLeft: node.color ? `2px solid ${node.color}` : undefined }}
      title={node.description || node.label}
    >
      <Dot size={18} className="shrink-0 mt-0.5" style={{ color: node.color }} />
      <div className="flex-1 min-w-0">
        <span className="text-[16px] font-medium text-[rgb(var(--color-text-primary))] leading-snug block line-clamp-2">
          {node.label}
        </span>
        {node.description && (
          <span className="text-[12px] text-[rgb(var(--color-text-muted))] leading-snug block line-clamp-2 mt-0.5">
            {node.description}
          </span>
        )}
      </div>
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <Handle type="source" position={Position.Right} className="!opacity-0" />
    </div>
  );
}

export default memo(MindmapNode);
