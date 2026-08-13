import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Folder, BookOpen, Dot } from 'lucide-react';

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
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgb(var(--color-surface-1))] border border-[rgb(var(--color-border))] shadow-sm hover:shadow-md transition-all cursor-pointer select-none min-w-0"
        style={{ ...fade, borderLeft: `3px solid ${node.color}` }}
      >
        <BookOpen size={18} className="shrink-0" style={{ color: node.color }} />
        <span className="text-[19.5px] font-medium text-[rgb(var(--color-text-primary))] leading-snug line-clamp-2">
          {node.label}
        </span>
        <Handle type="target" position={Position.Left} className="!opacity-0" />
        <Handle type="source" position={Position.Right} className="!opacity-0" />
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[rgb(var(--color-surface-2))] border border-[rgb(var(--color-border))] select-none min-w-0"
      style={fade}
    >
      <Dot size={18} className="shrink-0" style={{ color: node.color }} />
      <span className="text-[17px] text-[rgb(var(--color-text-secondary))] leading-snug line-clamp-2">
        {node.label}
      </span>
      <Handle type="target" position={Position.Left} className="!opacity-0" />
    </div>
  );
}

export default memo(MindmapNode);
