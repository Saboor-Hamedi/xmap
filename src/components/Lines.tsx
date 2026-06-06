import React from 'react';
import { MindMapData } from '../types';
import { PositionedNode } from '../utils/layout';

interface LinesProps {
  mapData: MindMapData;
  positionedNodes: Record<string, PositionedNode>;
  onDeleteRelationship: (relId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  draggingNodeId?: string | null;
  dragOffsetRef?: React.MutableRefObject<{ dx: number; dy: number }>;
}

// Per-line draggable bend offsets stored in memory (not persisted)
const bendOffsets: Record<string, { dx: number; dy: number }> = {};

export default function Lines({
  mapData,
  positionedNodes,
  onDeleteRelationship,
  onDeleteNode,
  draggingNodeId,
  dragOffsetRef,
}: LinesProps) {
  const [tick, setTick] = React.useState(0);

  // Hover: which line + cursor position for the delete pill
  const [hoverInfo, setHoverInfo] = React.useState<{
    key: string;
    x: number;
    y: number;
    type: 'tree' | 'rel';
    id: string; // nodeId for tree, relId for rel
  } | null>(null);

  // Bend-point dragging state
  const bendDragRef = React.useRef<{
    key: string;
    startMx: number; startMy: number;
    origDx: number; origDy: number;
  } | null>(null);

  // Highlighted node IDs
  const highlightedRef = React.useRef<string[]>([]);
  const highlightNodes = (...ids: string[]) => {
    clearHighlight();
    ids.forEach(id => {
      const el = document.getElementById(`node_${id}`);
      if (el) el.style.outline = '2.5px solid #29b6f2';
    });
    highlightedRef.current = ids;
  };
  const clearHighlight = () => {
    highlightedRef.current.forEach(id => {
      const el = document.getElementById(`node_${id}`);
      if (el) el.style.outline = '';
    });
    highlightedRef.current = [];
  };

  // 60fps RAF when dragging nodes
  React.useEffect(() => {
    if (draggingNodeId) {
      let animId: number;
      const loop = () => { setTick(t => t + 1); animId = requestAnimationFrame(loop); };
      animId = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(animId);
    }
  }, [draggingNodeId]);

  // Global mouse move/up for bend dragging
  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!bendDragRef.current) return;
      const { key, startMx, startMy, origDx, origDy } = bendDragRef.current;
      bendOffsets[key] = {
        dx: origDx + (e.clientX - startMx),
        dy: origDy + (e.clientY - startMy),
      };
      setTick(t => t + 1);
    };
    const onUp = () => { bendDragRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const getActivePos = (id: string, originalPos: PositionedNode | undefined) => {
    if (!originalPos) return undefined;
    if (draggingNodeId === id && dragOffsetRef) {
      return { ...originalPos, x: originalPos.x + dragOffsetRef.current.dx, y: originalPos.y + dragOffsetRef.current.dy };
    }
    return originalPos;
  };

  // Get SVG-space coordinates from a mouse event
  const getSvgPos = (e: React.MouseEvent, svgEl: SVGSVGElement | null) => {
    if (!svgEl) return { x: e.clientX, y: e.clientY };
    const pt = svgEl.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const inv = svgEl.getScreenCTM()?.inverse();
    if (!inv) return { x: e.clientX, y: e.clientY };
    const p = pt.matrixTransform(inv);
    return { x: p.x, y: p.y };
  };

  // Build bezier path from edge points + optional bend offset
  const buildPath = (sx: number, sy: number, ex: number, ey: number, isVertical: boolean, bend?: { dx: number; dy: number }) => {
    const dx = ex - sx;
    const dy = ey - sy;
    const bx = bend?.dx ?? 0;
    const by = bend?.dy ?? 0;

    if (isVertical) {
      const cy = dy * 0.5;
      return `M ${sx} ${sy} C ${sx + bx} ${sy + cy + by}, ${ex + bx} ${ey - cy + by}, ${ex} ${ey}`;
    } else {
      const cp = Math.abs(dx) * 0.55;
      const cx1 = sx + Math.sign(dx) * cp + bx;
      const cy1 = sy + by;
      const cx2 = ex - Math.sign(dx) * cp + bx;
      const cy2 = ey + by;
      return `M ${sx} ${sy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${ex} ${ey}`;
    }
  };

  const svgRef = React.useRef<SVGSVGElement>(null);
  const isVertical = mapData.layoutDirection === 'vertical';

  return (
    <svg
      ref={svgRef}
      id="canvas_svg_lines"
      className="absolute inset-0 overflow-visible"
      style={{ width: '1px', height: '1px', pointerEvents: 'none' }}
    >
      <defs>
        <marker id="rel_arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ec4899" />
        </marker>
        <marker id="tree_arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#64748b" />
        </marker>
        <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* ── Parent → Child tree lines ── */}
      {Object.keys(mapData.nodes).map((id) => {
        const node = mapData.nodes[id];
        if (!node || !node.parentId) return null;

        const startPos = getActivePos(node.parentId, positionedNodes[node.parentId]);
        const endPos   = getActivePos(id, positionedNodes[id]);
        if (!startPos || !endPos) return null;

        const parentEl = document.getElementById(`node_${node.parentId}`);
        const childEl  = document.getElementById(`node_${id}`);
        const parentW = mapData.nodes[node.parentId]?.width  || (parentEl?.offsetWidth  ?? 155);
        const parentH = mapData.nodes[node.parentId]?.height || (parentEl?.offsetHeight ?? 40);
        const childW  = node.width  || (childEl?.offsetWidth  ?? 155);
        const childH  = node.height || (childEl?.offsetHeight ?? 40);

        const dx = endPos.x - startPos.x;
        const dy = endPos.y - startPos.y;
        const absDx = Math.abs(dx); const absDy = Math.abs(dy);
        const pad = 6;

        const rP = Math.min((parentW / 2 + pad) / Math.max(0.001, absDx), (parentH / 2 + pad) / Math.max(0.001, absDy));
        const rC = Math.min((childW  / 2 + pad) / Math.max(0.001, absDx), (childH  / 2 + pad) / Math.max(0.001, absDy));

        const sx = startPos.x + dx * Math.min(1, rP);
        const sy = startPos.y + dy * Math.min(1, rP);
        const ex = endPos.x   - dx * Math.min(1, rC);
        const ey = endPos.y   - dy * Math.min(1, rC);

        const lineStyle = node.connectionLineType || 'curve';
        const isDotted  = lineStyle === 'dot';
        const hasArrow  = lineStyle === 'arrow';
        const bendKey   = `tree_${id}`;
        const bend      = bendOffsets[bendKey];

        let pathStr = '';
        if (lineStyle === 'line' || isDotted || hasArrow) {
          pathStr = `M ${sx} ${sy} L ${ex} ${ey}`;
        } else {
          pathStr = buildPath(sx, sy, ex, ey, isVertical, bend);
        }

        // Midpoint for bend handle
        const midX = (sx + ex) / 2 + (bend?.dx ?? 0);
        const midY = (sy + ey) / 2 + (bend?.dy ?? 0);

        const isMain = node.type === 'main';
        const strokeColor = isMain ? '#475569' : '#94a3b8';
        const isHov = hoverInfo?.key === bendKey;

        return (
          <g key={`tree_${id}`} style={{ pointerEvents: 'none' }}>
            {/* Glow on hover */}
            {isHov && (
              <path d={pathStr} fill="none" stroke="#29b6f2" strokeWidth={6} strokeOpacity={0.2} strokeLinecap="round" style={{ pointerEvents: 'none' }} />
            )}
            {/* Visible line */}
            <path
              d={pathStr}
              fill="none"
              stroke={isHov ? '#29b6f2' : strokeColor}
              strokeWidth={isMain ? 2.2 : 1.8}
              strokeDasharray={isDotted ? '5 4' : undefined}
              strokeLinecap="round"
              markerEnd={hasArrow ? 'url(#tree_arrow)' : undefined}
              style={{ pointerEvents: 'none' }}
            />
            {/* Wide invisible hit area — enables hover & events */}
            <path
              d={pathStr}
              fill="none"
              stroke="transparent"
              strokeWidth={20}
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              onMouseMove={(e) => {
                const pos = getSvgPos(e, svgRef.current);
                setHoverInfo({ key: bendKey, x: pos.x, y: pos.y, type: 'tree', id });
                highlightNodes(node.parentId!, id);
              }}
              onMouseLeave={() => { setHoverInfo(null); clearHighlight(); }}
            />
            {/* Bend handle — visible when hovered, draggable */}
            {isHov && (
              <circle
                cx={midX} cy={midY} r={6}
                fill="white" stroke="#29b6f2" strokeWidth={2}
                style={{ pointerEvents: 'auto', cursor: 'grab' }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  bendDragRef.current = {
                    key: bendKey,
                    startMx: e.clientX, startMy: e.clientY,
                    origDx: bend?.dx ?? 0, origDy: bend?.dy ?? 0,
                  };
                }}
              />
            )}
            {/* Delete button — clean circle, offset above cursor */}
            {isHov && hoverInfo && (
              <g
                transform={`translate(${hoverInfo.x}, ${hoverInfo.y - 28})`}
                style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); if (onDeleteNode) onDeleteNode(id); }}
              >
                <circle r={10} fill="#ef4444" stroke="white" strokeWidth={2} />
                <line x1={-4} y1={-4} x2={4} y2={4} stroke="white" strokeWidth={2.2} strokeLinecap="round" />
                <line x1={4} y1={-4} x2={-4} y2={4} stroke="white" strokeWidth={2.2} strokeLinecap="round" />
              </g>
            )}
          </g>
        );
      })}

      {/* ── Summary brackets ── */}
      {mapData.summaries.map((sum) => {
        if (sum.nodeIds.length === 0) return null;
        let minY = Infinity, maxY = -Infinity, rightX = -Infinity;
        sum.nodeIds.forEach((nid) => {
          const p = positionedNodes[nid];
          if (p) { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); rightX = Math.max(rightX, p.x + 85); }
        });
        if (minY === Infinity) return null;
        const midY = minY + (maxY - minY) / 2;
        const bracePath = `M ${rightX} ${minY - 10} C ${rightX + 10} ${minY - 10}, ${rightX + 5} ${midY}, ${rightX + 15} ${midY} C ${rightX + 5} ${midY}, ${rightX + 10} ${maxY + 10}, ${rightX} ${maxY + 10}`;
        return (
          <g key={`sum_${sum.id}`} style={{ pointerEvents: 'none' }}>
            <path d={bracePath} fill="none" stroke="#a855f7" strokeWidth={2} strokeLinecap="round" />
          </g>
        );
      })}

      {/* ── Custom relationship lines ── */}
      {mapData.relationships.map((rel) => {
        const startPos = getActivePos(rel.fromId, positionedNodes[rel.fromId]);
        const endPos   = getActivePos(rel.toId,   positionedNodes[rel.toId]);
        if (!startPos || !endPos) return null;

        const bendKey = `rel_${rel.id}`;
        const bend    = bendOffsets[bendKey];

        const midX = (startPos.x + endPos.x) / 2 + (bend?.dx ?? 0);
        const midY = (startPos.y + endPos.y) / 2 - 50 + (bend?.dy ?? 0);

        const pathStr = `M ${startPos.x} ${startPos.y} Q ${midX} ${midY}, ${endPos.x} ${endPos.y}`;
        const isHov = hoverInfo?.key === bendKey;

        return (
          <g key={`rel_${rel.id}`} style={{ pointerEvents: 'none' }}>
            {/* Glow on hover */}
            {isHov && (
              <path d={pathStr} fill="none" stroke="#ec4899" strokeWidth={8} strokeOpacity={0.2} strokeLinecap="round" style={{ pointerEvents: 'none' }} filter="url(#glow)" />
            )}
            {/* Main dashed line */}
            <path
              d={pathStr}
              fill="none"
              stroke={isHov ? '#f472b6' : '#ec4899'}
              strokeWidth={isHov ? 2.8 : 2.2}
              strokeDasharray="7 4"
              strokeLinecap="round"
              markerEnd="url(#rel_arrow)"
              style={{ pointerEvents: 'none' }}
            />
            {/* Hit area */}
            <path
              d={pathStr}
              fill="none"
              stroke="transparent"
              strokeWidth={20}
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              onMouseMove={(e) => {
                const pos = getSvgPos(e, svgRef.current);
                setHoverInfo({ key: bendKey, x: pos.x, y: pos.y, type: 'rel', id: rel.id });
                highlightNodes(rel.fromId, rel.toId);
              }}
              onMouseLeave={() => { setHoverInfo(null); clearHighlight(); }}
            />
            {/* Bend handle */}
            {isHov && (
              <circle
                cx={midX} cy={midY} r={7}
                fill="white" stroke="#ec4899" strokeWidth={2}
                style={{ pointerEvents: 'auto', cursor: 'grab' }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  bendDragRef.current = {
                    key: bendKey,
                    startMx: e.clientX, startMy: e.clientY,
                    origDx: bend?.dx ?? 0, origDy: bend?.dy ?? 0,
                  };
                }}
              />
            )}
            {/* Delete button — clean circle, offset above cursor */}
            {isHov && hoverInfo && (
              <g
                transform={`translate(${hoverInfo.x}, ${hoverInfo.y - 28})`}
                style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); onDeleteRelationship(rel.id); setHoverInfo(null); }}
              >
                <circle r={10} fill="#be185d" stroke="white" strokeWidth={2} />
                <line x1={-4} y1={-4} x2={4} y2={4} stroke="white" strokeWidth={2.2} strokeLinecap="round" />
                <line x1={4} y1={-4} x2={-4} y2={4} stroke="white" strokeWidth={2.2} strokeLinecap="round" />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
