const H_DEPTH_GAP = 64;
const ROW_GAP = 22;
const RADIAL_MIN_R1 = 360;
const RADIAL_DEPTH_GAP = 480;
const RADIAL_ARC_FACTOR = 0.72;
const NODE_GAP = 36;

const BRANCH_SATURATION = 72;
const BRANCH_LIGHTNESS = 55;
const SHADE_STEP = 17;
const SHADE_MAX_LIGHTNESS = 88;

const SIZE = {
  root: { charPx: 11, extras: 46, linePx: 30, pad: 18, minW: 300, maxW: 560 },
  lesson: { charPx: 10.5, extras: 40, linePx: 27, pad: 16, minW: 260, maxW: 520 },
  section: { charPx: 9, extras: 34, linePx: 24, pad: 14, minW: 240, maxW: 460 },
  main: { charPx: 9.5, extras: 36, linePx: 25, pad: 14, minW: 240, maxW: 480 },
  sub: { charPx: 9, extras: 32, linePx: 24, pad: 12, minW: 220, maxW: 440 },
  detail: { charPx: 8.5, extras: 28, linePx: 22, pad: 10, minW: 200, maxW: 400 },
};

function nodeSize(node) {
  const kind = node?.kind;
  const cfg = SIZE[kind] || SIZE.section || { charPx: 9, extras: 34, linePx: 24, pad: 14, minW: 240, maxW: 460 };
  const label = String(node?.label || '');
  const desc = String(node?.description || '');

  const labelPx = label.length * cfg.charPx;
  const descPx = desc ? desc.length * (cfg.charPx * 0.8) : 0;
  const maxTextPx = Math.max(labelPx, descPx);

  const width = Math.min(cfg.maxW, Math.max(cfg.minW, cfg.extras + maxTextPx));
  const labelLines = Math.max(1, Math.ceil((cfg.extras + labelPx) / width));
  const descLines = desc ? Math.max(1, Math.ceil((cfg.extras + descPx) / width)) : 0;

  const totalLines = labelLines + descLines;
  const height = totalLines * cfg.linePx + cfg.pad + (desc ? 10 : 0);

  return { width, height };
}

function branchHue(index) {
  return Math.round((index * 137.508) % 360);
}

function branchColor(hue) {
  return `hsl(${hue} ${BRANCH_SATURATION}% ${BRANCH_LIGHTNESS}%)`;
}

function shadeColor(hue, depth) {
  const lightness = Math.min(
    SHADE_MAX_LIGHTNESS,
    BRANCH_LIGHTNESS + (depth - 1) * SHADE_STEP,
  );
  return `hsl(${hue} ${BRANCH_SATURATION}% ${lightness}%)`;
}

export function buildTree(folderName, files = []) {
  const root = {
    id: 'mindmap-root',
    label: folderName || 'Thư mục',
    kind: 'root',
    children: [],
  };

  for (const [fileIdx, file] of (files || []).entries()) {
    const hue = branchHue(fileIdx);

    // Ưu tiên dùng mindmapNodes (từ AI anchor) nếu có
    const mindmapNodes = file.mindmapNodes || [];
    const mainAnchors = mindmapNodes.filter(a => a.type === 'main');
    const subAnchors = mindmapNodes.filter(a => a.type === 'sub');
    const detailAnchors = mindmapNodes.filter(a => a.type === 'detail');

    // Build lesson node with descriptive label from summary + first main concepts
    const lessonLabel = file.title || 'Bài học';
    const conceptLabels = mainAnchors.slice(0, 3).map(a => a.label).filter(Boolean);
    const descriptiveLabel = conceptLabels.length > 0 
      ? `${lessonLabel}: ${conceptLabels.join(' • ')}`
      : (file.summary ? `${lessonLabel}: ${file.summary.slice(0, 80)}...` : lessonLabel);

    const lessonNode = {
      id: `lesson-${file.id}`,
      label: descriptiveLabel,
      shortLabel: lessonLabel, // Keep original for reference
      summary: file.summary || '',
      fileId: file.id,
      hue,
      color: branchColor(hue),
      depth: 1,
      kind: 'lesson',
      children: [],
    };

    if (mindmapNodes.length > 0) {
      // Build tree từ anchor hierarchy
      const nodeMap = new Map();
      const roots = [];

      // Create all nodes
      for (const anchor of mindmapNodes) {
        const anchorDepth = anchor.type === 'main' ? 2 : anchor.type === 'sub' ? 3 : 4;
        const kind = anchor.type && SIZE[anchor.type] ? anchor.type : 'section';
        nodeMap.set(anchor.id, {
          id: `anchor-${file.id}-${anchor.id}`,
          label: anchor.label || '',
          hue,
          color: shadeColor(hue, anchorDepth),
          depth: anchorDepth,
          kind,
          fileId: file.id,
          children: [],
        });
      }

      // Link parent-child relationships
      for (const anchor of mindmapNodes) {
        const node = nodeMap.get(anchor.id);
        if (!node) continue;
        if (!anchor.parentId || anchor.parentId === 'root') {
          // Main sections (type="main") become direct children of lesson
          roots.push(node);
        } else {
          const parent = nodeMap.get(anchor.parentId);
          if (parent) {
            parent.children.push(node);
          } else {
            roots.push(node);
          }
        }
      }

      lessonNode.children = roots;
    } else {
      // Fallback: dùng sections (heading)
      (file.sections || []).forEach((section, idx) => {
        lessonNode.children.push({
          id: `section-${file.id}-${idx}`,
          label: section || '',
          hue,
          color: shadeColor(hue, 2),
          depth: 2,
          kind: 'section',
          fileId: file.id,
          children: [],
        });
      });
    }

    root.children.push(lessonNode);
  }

  const assignSize = (node) => {
    const size = nodeSize(node);
    node.width = size.width;
    node.height = size.height;
    (node.children || []).forEach(assignSize);
  };
  assignSize(root);

  return root;
}

export function buildConceptTree(conceptData) {
  if (!conceptData || !conceptData.root) return null;
  const rootObj = conceptData.root;
  const root = {
    id: 'concept-root',
    label: rootObj.label || 'Mindmap',
    description: rootObj.description || '',
    kind: 'root',
    children: [],
  };

  let counter = 0;
  const parseChildren = (parentNode, childrenList, depth, parentHue) => {
    if (depth > 4) return; // Max 5 levels total (root = depth 0, depth 1..4)
    (childrenList || []).forEach((child, idx) => {
      const hue = depth === 1 ? branchHue(idx) : parentHue;
      const fileId = child.file_id || child.fileId || parentNode.fileId || null;
      const kind = child.type || (depth === 1 ? 'main' : depth === 2 ? 'sub' : 'detail');
      const node = {
        id: `concept-${++counter}`,
        label: child.label || '',
        description: child.description || '',
        excerpt: child.excerpt || child.label || '',
        fileId,
        hue,
        color: depth === 1 ? branchColor(hue) : shadeColor(hue, depth),
        depth,
        kind,
        children: [],
      };
      parseChildren(node, child.children, depth + 1, hue);
      parentNode.children.push(node);
    });
  };

  parseChildren(root, rootObj.children, 1, 0);

  const assignSize = (node) => {
    const size = nodeSize(node);
    node.width = size.width;
    node.height = size.height;
    (node.children || []).forEach(assignSize);
  };
  assignSize(root);

  return root;
}


function collectNodes(root) {
  const out = [];
  const walk = (node) => {
    if (!node) return;
    out.push(node);
    (node.children || []).forEach(walk);
  };
  walk(root);
  return out;
}

function edgeStyle(node) {
  if (!node) return { stroke: '#666', strokeWidth: 1 };
  const hue = node.hue ?? 0;
  const depth = node.depth ?? 1;
  const stroke =
    depth === 1 ? branchColor(hue) : shadeColor(hue, depth);
  return {
    stroke,
    strokeWidth: depth === 1 ? 2 : 1.4,
  };
}

function leafCount(node) {
  if (!node || !node.children || node.children.length === 0) return 1;
  return node.children.reduce((sum, c) => sum + (c ? leafCount(c) : 0), 0);
}

export function layoutHorizontal(root) {
  const nodes = [];
  const edges = [];

  const all = collectNodes(root);
  const nonRootHeights = all
    .filter((n) => n && n.kind !== 'root')
    .map((n) => nodeSize(n).height);
  const maxRowHeight = Math.max(
    ...nonRootHeights,
    SIZE.section.linePx + SIZE.section.pad,
  );
  const rowHeight = maxRowHeight + ROW_GAP;

  // Vị trí X mỗi tầng: tầng sau bắt đầu ngay sau node dài nhất của tầng trước
  const maxWidthByDepth = [];
  const walkWidth = (node, depth) => {
    maxWidthByDepth[depth] = Math.max(
      maxWidthByDepth[depth] || 0,
      nodeSize(node).width,
    );
    node.children.forEach((c) => walkWidth(c, depth + 1));
  };
  walkWidth(root, 0);

  const depthX = [0];
  for (let d = 1; d < maxWidthByDepth.length; d++) {
    depthX[d] =
      depthX[d - 1] +
      maxWidthByDepth[d - 1] / 2 +
      H_DEPTH_GAP +
      maxWidthByDepth[d] / 2;
  }

  const assignY = (node, counter) => {
    if (node.children.length === 0) {
      node._y = counter * rowHeight;
      return counter + 1;
    }
    let c = counter;
    const first = node.children[0];
    const last = node.children[node.children.length - 1];
    for (const child of node.children) c = assignY(child, c);
    node._y = (first._y + last._y) / 2;
    return c;
  };

  const total = assignY(root, 0);

  const walk = (node, depth, parentId) => {
    const { width, height } = nodeSize(node);
    nodes.push({
      id: node.id,
      type: 'mindmapNode',
      position: {
        x: depthX[depth] - width / 2,
        y: node._y - height / 2,
      },
      data: { node, fileId: node.fileId },
    });
    if (parentId) {
      edges.push({
        id: `e-${parentId}-${node.id}`,
        source: parentId,
        target: node.id,
        type: 'default',
        style: edgeStyle(node),
      });
    }
    for (const child of node.children) walk(child, depth + 1, node.id);
  };

  walk(root, 0, null);

  const lastDepth = depthX.length - 1;

  return {
    nodes,
    edges,
    fitPadding: { x: 60, y: 60 },
    bounds: {
      x: -maxWidthByDepth[0] / 2,
      y: 0,
      width:
        depthX[lastDepth] + maxWidthByDepth[lastDepth] / 2,
      height: total * rowHeight,
    },
  };
}

export function layoutRadial(root) {
  const nodes = [];
  const edges = [];

  // --- Bước 1: tính bán kính tối thiểu cho từng độ sâu để node không đè nhau ---
  const depths = new Map();
  const byDepth = [];
  const walkDepth = (node, depth) => {
    if (!node) return;
    if (!byDepth[depth]) byDepth[depth] = [];
    byDepth[depth].push(node);
    depths.set(node, depth);
    (node.children || []).forEach((c) => walkDepth(c, depth + 1));
  };
  walkDepth(root, 0);

  const radiusByDepth = [0];
  for (let d = 1; d < byDepth.length; d++) {
    const ringWidth = (byDepth[d] || []).reduce(
      (sum, node) => sum + (node ? nodeSize(node).width : 0) + NODE_GAP,
      0,
    );
    const needed =
      ringWidth / (2 * Math.PI * RADIAL_ARC_FACTOR) + RADIAL_DEPTH_GAP;
    radiusByDepth[d] = Math.max(RADIAL_MIN_R1, radiusByDepth[d - 1] + RADIAL_DEPTH_GAP, needed);
  }

  const totalLeaves = leafCount(root);
  const fullSpan = 2 * Math.PI;

  const place = (node, angleStart, span, depth, parentId) => {
    if (!node) return;
    const radius = radiusByDepth[depth] || 0;
    const mid = angleStart + span / 2;
    const { width, height } = nodeSize(node);
    nodes.push({
      id: node.id,
      type: 'mindmapNode',
      position: {
        x: radius * Math.cos(mid) - width / 2,
        y: radius * Math.sin(mid) - height / 2,
      },
      data: { node, fileId: node.fileId },
    });
    if (parentId) {
      edges.push({
        id: `e-${parentId}-${node.id}`,
        source: parentId,
        target: node.id,
        type: 'default',
        style: edgeStyle(node),
      });
    }

    if (!node.children || node.children.length === 0) return;

    const childDepth = depth + 1;
    const childRadius = radiusByDepth[childDepth] || 0;

    // Mỗi con cần tối thiểu một cung bằng bề rộng của nó tại bán kính con
    const minSpans = (node.children || []).map((c) => {
      const w = c ? nodeSize(c).width : 0;
      return childRadius > 0 ? (w + NODE_GAP) / childRadius : 0;
    });
    const minTotal = minSpans.reduce((s, m) => s + m, 0);
    const leafShare = (c) => (c ? leafCount(c) : 0) / leafCount(node);
    const squeeze = minTotal > span ? span / minTotal : 1;
    const leftover = Math.max(0, span - minTotal * squeeze);

    let cursor = angleStart;
    (node.children || []).forEach((child, i) => {
      if (!child) return;
      const childSpan = minSpans[i] * squeeze + leftover * leafShare(child);
      place(child, cursor, childSpan, childDepth, node.id);
      cursor += childSpan;
    });
  };

  place(root, -Math.PI / 2, fullSpan, 0, null);

  const maxRadius = radiusByDepth[radiusByDepth.length - 1] || 600;

  return {
    nodes,
    edges,
    fitPadding: { x: 60, y: 60 },
    bounds: {
      x: -maxRadius,
      y: -maxRadius,
      width: 2 * maxRadius,
      height: 2 * maxRadius,
    },
  };
}
