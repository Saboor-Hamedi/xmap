import React from 'react';
import { MindMapData } from '../types';
import { PositionedNode } from '../utils/layout';

interface LinesProps {
  mapData: MindMapData;
  positionedNodes: Record<string, PositionedNode>;
  onDeleteRelationship: (relId: string) => void;
  draggingNodeId?: string | null;
  dragOffsetRef?: React.MutableRefObject<{ dx: number; dy: number }>;
}

export default function Lines({
  mapData,
  positionedNodes,
  onDeleteRelationship,
  draggingNodeId,
  dragOffsetRef
}: LinesProps) {
  const [, setFrame] = React.useState(0);

  // Cursor position for delete button (follows mouse on line hover)
  const [relHoverInfo, setRelHoverInfo] = React.useState<{
    relId: string;
    x: number;
    y: number;
  } | null>(null);

  // Highlight connected nodes when hovering a line
  const lastHighlighted = React.useRef<string[]>([]);
  const highlightNodes = (...ids: string[]) => {
    clearHighlight();
    ids.forEach(id => {
      const el = document.getElementById(`node_${id}`);
      if (el) el.style.outline = '2.5px solid #29b6f2';
    });
    lastHighlighted.current = ids;
  };
  const clearHighlight = () => {
    lastHighlighted.current.forEach(id => {
      const el = document.getElementById(`node_${id}`);
      if (el) el.style.outline = '';
    });
    lastHighlighted.current = [];
  };

  // 60fps RAF loop when dragging
  React.useEffect(() => {
    if (draggingNodeId) {
      let animId: number;
      const loop = () => { setFrame(f => f + 1); animId = requestAnimationFrame(loop); };
      animId = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(animId);
    }
  }, [draggingNodeId]);

  const getActivePos = (id: string, originalPos: PositionedNode | undefined) => {
    if (!originalPos) return undefined;
    if (draggingNodeId === id && dragOffsetRef) {
      return { ...originalPos, x: originalPos.x + dragOffsetRef.current.dx, y: originalPos.y + dragOffsetRef.current.dy };
    }
    return originalPos;
  };

  return (
    <svg
      id="canvas_svg_lines"
      className="absolute inset-0 overflow-visible"
      style={{ width: '1px', height: '1px', pointerEvents: 'none' }}
    >
      <defs>
        {/* Gradient for relationship lines */}
        <linearGradient id="rel_grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
        {/* Arrow marker */}
        <marker id="rel_arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ec4899" />
        </marker>
        <marker id="arrow_main" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#94a3b8" />
        </marker>
        {/* Glow filter for hovered relationship lines */}
        <filter id="glow_line" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ── Parent → Child tree connectors ── */}
      {Object.keys(mapData.nodes).map((id) => {
        const node = mapData.nodes[id];
        if (!node || !node.parentId) return null;

        const startPos = getActivePos(node.parentId, positionedNodes[node.parentId]);
        const endPos   = getActivePos(id, positionedNodes[id]);
        if (!startPos || !endPos) return null;

        const parentEl = document.getElementById(`node_${node.parentId}`);
        const childEl  = document.getElementById(`node_${id}`);

        const parentW = mapData.nodes[node.parentId]?.width  || (parentEl ? parentEl.offsetWidth  : 155);
        const parentH = mapData.nodes[node.parentId]?.height || (parentEl ? parentEl.offsetHeight : 40);
        const childW  = node.width  || (childEl ? childEl.offsetWidth  : 155);
        const childH  = node.height || (childEl ? childEl.offsetHeight : 40);

        const dx = endPos.x - startPos.x;
        const dy = endPos.y - startPos.y;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        const pad = 6;

        const ratioP = Math.min((parentW / 2 + pad) / Math.max(0.001, absDx), (parentH / 2 + pad) / Math.max(0.001, absDy));
        const ratioC = Math.min((childW  / 2 + pad) / Math.max(0.001, absDx), (childH  / 2 + pad) / Math.max(0.001, absDy));
        const clampP = Math.min(1, ratioP);
        const clampC = Math.min(1, ratioC);

        const sx = startPos.x + dx * clampP;
        const sy = startPos.y + dy * clampP;
        const ex = endPos.x   - dx * clampC;
        const ey = endPos.y   - dy * clampC;

        const lineStyle = node.connectionLineType || 'curve';
        const isDotted  = lineStyle === 'dot';
        const hasArrow  = lineStyle === 'arrow';

        let pathString = '';
        if (lineStyle === 'line' || isDotted || hasArrow) {
          pathString = `M ${sx} ${sy} L ${ex} ${ey}`;
        } else {
          // Premium S-curve bezier
          if (mapData.layoutDirection === 'vertical') {
            const cy1 = sy + dy * 0.5;
            const cy2 = ey - dy * 0.5;
            pathString = `M ${sx} ${sy} C ${sx} ${cy1}, ${ex} ${cy2}, ${ex} ${ey}`;
          } else {
            const cp = Math.abs(dx) * 0.55;
            pathString = `M ${sx} ${sy} C ${sx + Math.sign(dx) * cp} ${sy}, ${ex - Math.sign(dx) * cp} ${ey}, ${ex} ${ey}`;
          }
        }

        // Stroke color: root children get a slightly more prominent colour
        const isMain = node.type === 'main';
        const strokeColor = isMain ? '#94a3b8' : '#cbd5e1';
        const strokeW     = isMain ? 2 : 1.5;

        return (
          <g key={`line_grp_${id}`}>
            {hasArrow && (
              <defs>
                <marker id={`arrow_${id}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={strokeColor} />
                </marker>
              </defs>
            )}
            {/* Wide invisible hit area */}
            <path
              d={pathString}
              fill="none"
              stroke="transparent"
              strokeWidth={16}
              style={{ pointerEvents: 'stroke', cursor: 'default' }}
              onMouseEnter={() => highlightNodes(node.parentId!, id)}
              onMouseLeave={clearHighlight}
            />
            {/* Actual visible line */}
            <path
              d={pathString}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeW}
              strokeDasharray={isDotted ? '5 4' : undefined}
              strokeLinecap="round"
              markerEnd={hasArrow ? `url(#arrow_${id})` : undefined}
              className="transition-all duration-150"
              style={{ pointerEvents: 'none' }}
            />
          </g>
        );
      })}

      {/* ── Summary brackets ── */}
      {mapData.summaries.map((sum) => {
        if (sum.nodeIds.length === 0) return null;
        let minY = Infinity, maxY = -Infinity, rightmostX = -Infinity;
        sum.nodeIds.forEach((nid) => {
          const pos = positionedNodes[nid];
          if (pos) { minY = Math.min(minY, pos.y); maxY = Math.max(maxY, pos.y); rightmostX = Math.max(rightmostX, pos.x + 85); }
        });
        if (minY === Infinity) return null;
        const braceMidY = minY + (maxY - minY) / 2;
        const path = `M ${rightmostX} ${minY - 10} C ${rightmostX + 10} ${minY - 10}, ${rightmostX + 5} ${braceMidY}, ${rightmostX + 15} ${braceMidY} C ${rightmostX + 5} ${braceMidY}, ${rightmostX + 10} ${maxY + 10}, ${rightmostX} ${maxY + 10}`;
        return (
          <g key={`sum_bracket_${sum.id}`}>
            <path d={path} fill="none" stroke="#a855f7" strokeWidth={2} strokeLinecap="round" />
          </g>
        );
      })}

      {/* ── Custom relationship arrows ── */}
      {mapData.relationships.map((rel) => {
        const startPos = getActivePos(rel.fromId, positionedNodes[rel.fromId]);
        const endPos   = getActivePos(rel.toId,   positionedNodes[rel.toId]);
        if (!startPos || !endPos) return null;

        const midX = (startPos.x + endPos.x) / 2;
        const midY = (startPos.y + endPos.y) / 2 - 50;
        const pathStr = `M ${startPos.x} ${startPos.y} Q ${midX} ${midY}, ${endPos.x} ${endPos.y}`;

        const isHovered = relHoverInfo?.relId === rel.id;

        return (
          <g key={`rel_${rel.id}`}>
            {/* Glow layer (only on hover) */}
            {isHovered && (
              <path
                d={pathStr}
                fill="none"
                stroke="#ec4899"
                strokeWidth={6}
                strokeOpacity={0.25}
                strokeLinecap="round"
                style={{ pointerEvents: 'none' }}
                filter="url(#glow_line)"
              />
            )}
            {/* Main line — gradient stroke via linearGradient trick */}
            <path
              d={pathStr}
              fill="none"
              stroke={isHovered ? '#f472b6' : '#ec4899'}
              strokeWidth={isHovered ? 2.5 : 2}
              strokeDasharray="7 4"
              strokeLinecap="round"
              markerEnd="url(#rel_arrow)"
              style={{ pointerEvents: 'none' }}
              className="transition-all duration-150"
            />
            {/* Wide transparent hit area — tracks cursor position */}
            <path
              d={pathStr}
              fill="none"
              stroke="transparent"
              strokeWidth={20}
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              onMouseMove={(e) => {
                // Convert mouse position relative to SVG for accurate placement
                const svg = e.currentTarget.ownerSVGElement;
                if (!svg) return;
                const pt = svg.createSVGPoint();
                pt.x = e.clientX; pt.y = e.clientY;
                const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
                setRelHoverInfo({ relId: rel.id, x: svgPt.x, y: svgPt.y });
                highlightNodes(rel.fromId, rel.toId);
              }}
              onMouseLeave={() => {
                setRelHoverInfo(null);
                clearHighlight();
              }}
            />
            {/* Delete button — follows cursor */}
            {isHovered && relHoverInfo && (
              <g
                style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                onClick={() => { onDeleteRelationship(rel.id); setRelHoverInfo(null); }}
              >
                {/* Pill background */}
                <rect
                  x={relHoverInfo.x - 24}
                  y={relHoverInfo.y - 13}
                  width={48}
                  height={26}
                  rx={13}
                  fill="#be185d"
                  stroke="white"
                  strokeWidth={1.5}
                />
                {/* × icon */}
                <line x1={relHoverInfo.x - 5} y1={relHoverInfo.y - 5} x2={relHoverInfo.x + 5} y2={relHoverInfo.y + 5} stroke="white" strokeWidth={2.2} strokeLinecap="round" />
                <line x1={relHoverInfo.x + 5} y1={relHoverInfo.y - 5} x2={relHoverInfo.x - 5} y2={relHoverInfo.y + 5} stroke="white" strokeWidth={2.2} strokeLinecap="round" />
                {/* Label */}
                <text x={relHoverInfo.x + 9} y={relHoverInfo.y + 4} fill="white" fontSize={9} fontWeight="700" fontFamily="sans-serif" style={{ pointerEvents: 'none', userSelect: 'none' }}>del</text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
