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

  // When dragging, force 60fps re-renders of ONLY the lines so they perfectly track the DOM-transformed node
  React.useEffect(() => {
    if (draggingNodeId) {
      let animationFrameId: number;
      const loop = () => {
        setFrame(f => f + 1);
        animationFrameId = requestAnimationFrame(loop);
      };
      animationFrameId = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(animationFrameId);
    }
  }, [draggingNodeId]);

  const getActivePos = (id: string, originalPos: PositionedNode | undefined) => {
    if (!originalPos) return undefined;
    if (draggingNodeId === id && dragOffsetRef) {
      return {
        ...originalPos,
        x: originalPos.x + dragOffsetRef.current.dx,
        y: originalPos.y + dragOffsetRef.current.dy
      };
    }
    return originalPos;
  };

  return (
    <svg 
      id="canvas_svg_lines"
      className="absolute inset-0 pointer-events-none overflow-visible"
      style={{ width: '1px', height: '1px' }}
    >
      {/* Arrow heads definition */}
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="15" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#718096" />
        </marker>
      </defs>

      {/* Parents to children connectors */}
      {Object.keys(mapData.nodes).map((id) => {
        const node = mapData.nodes[id];
        if (!node || !node.parentId) return null;

        const startPos = getActivePos(node.parentId, positionedNodes[node.parentId]);
        const endPos = getActivePos(id, positionedNodes[id]);
        if (!startPos || !endPos) return null;

        // Compute actual box exit points dynamically
        const halfBoxW = 75;
        const halfBoxH = 18;

        let parentX = startPos.x;
        let parentY = startPos.y;
        let childX = endPos.x;
        let childY = endPos.y;

        let pathString = '';
        const lineStyle = node.connectionLineType || 'curve';

        if (lineStyle === 'line' || lineStyle === 'dot' || lineStyle === 'arrow') {
          if (mapData.layoutDirection === 'vertical') {
            parentY += halfBoxH;
            childY -= halfBoxH;
          } else {
            if (endPos.x >= startPos.x) {
              parentX += halfBoxW;
              childX -= halfBoxW;
            } else {
              parentX -= halfBoxW;
              childX += halfBoxW;
            }
          }
          pathString = `M ${parentX} ${parentY} L ${childX} ${childY}`;
        } else {
          // curve style
          if (mapData.layoutDirection === 'vertical') {
            // Vertically downwards: Parent exits bottom, child enters top
            parentY += halfBoxH;
            childY -= halfBoxH;
            
            // Draw rounded right-angle or curved curve
            const dy = childY - parentY;
            pathString = `M ${parentX} ${parentY} C ${parentX} ${parentY + dy*0.4}, ${childX} ${childY - dy*0.4}, ${childX} ${childY}`;
          } else {
            // Horizontal or balanced layouts
            if (endPos.x >= startPos.x) {
              // Symmetrical Right-spreading connector
              parentX += halfBoxW;
              childX -= halfBoxW;
              const dx = childX - parentX;
              pathString = `M ${parentX} ${parentY} C ${parentX + dx*0.45} ${parentY}, ${parentX + dx*0.55} ${childY}, ${childX} ${childY}`;
            } else {
              // Symmetrical Left-spreading connector
              parentX -= halfBoxW;
              childX += halfBoxW;
              const dx = childX - parentX;
              pathString = `M ${parentX} ${parentY} C ${parentX + dx*0.45} ${parentY}, ${parentX + dx*0.55} ${childY}, ${childX} ${childY}`;
            }
          }
        }

        // Theme-appropriate stroke color and markers
        const isDotted = lineStyle === 'dot';
        const hasArrow = lineStyle === 'arrow';

        return (
          <g key={`line_grp_${id}`}>
            {/* Visual marker definition helper */}
            {hasArrow && (
              <defs>
                <marker id={`arrow_${id}`} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={node.type === 'sub' ? '#b1cbdc' : '#718096'} />
                </marker>
              </defs>
            )}
            <path 
              d={pathString}
              fill="none"
              stroke={node.type === 'sub' ? '#b1cbdc' : '#718096'}
              strokeWidth={node.type === 'main' ? 2 : 1.5}
              strokeDasharray={isDotted ? '4 4' : undefined}
              markerEnd={hasArrow ? `url(#arrow_${id})` : undefined}
              className="opacity-80 hover:opacity-100 transition-opacity"
            />
          </g>
        );
      })}

      {/* Summary Brackets grouping siblings */}
      {mapData.summaries.map((sum) => {
        if (sum.nodeIds.length === 0) return null;
        
        // Collect bounding heights of all grouped children to render a curly brace
        let minY = Infinity;
        let maxY = -Infinity;
        let rightmostX = -Infinity;

        sum.nodeIds.forEach((nid) => {
          const pos = positionedNodes[nid];
          if (pos) {
            minY = Math.min(minY, pos.y);
            maxY = Math.max(maxY, pos.y);
            rightmostX = Math.max(rightmostX, pos.x + 85); // Align slightly outside the node box border
          }
        });

        if (minY === Infinity || maxY === -Infinity) return null;

        // Draw high-fidelity curly brackets path
        const braceH = maxY - minY;
        const braceMidY = minY + braceH/2;
        const braceBracketPath = `M ${rightmostX} ${minY - 10} C ${rightmostX + 10} ${minY - 10}, ${rightmostX + 5} ${braceMidY}, ${rightmostX + 15} ${braceMidY} C ${rightmostX + 5} ${braceMidY}, ${rightmostX + 10} ${maxY + 10}, ${rightmostX} ${maxY + 10}`;

        return (
          <g key={`sum_bracket_${sum.id}`} className="group/sum cursor-pointer">
            <path 
              d={braceBracketPath} 
              fill="none" 
              stroke="#a855f7" 
              strokeWidth={2} 
            />
            <text 
              x={rightmostX + 22} 
              y={braceMidY + 4} 
              fill="#7e22ce" 
              fontSize={11} 
              fontFamily="monospace"
              className="font-bold select-none group-hover/sum:underline bg-white"
            >
              {sum.text}
            </text>
          </g>
        );
      })}

      {/* User-defined custom relationship connector arrows */}
      {mapData.relationships.map((rel) => {
        const startPos = getActivePos(rel.fromId, positionedNodes[rel.fromId]);
        const endPos = getActivePos(rel.toId, positionedNodes[rel.toId]);
        if (!startPos || !endPos) return null;

        // Compute simple curved arches over nodes
        const midX = (startPos.x + endPos.x) / 2;
        const midY = (startPos.y + endPos.y) / 2 - 45; // Arch up

        const pathString = `M ${startPos.x} ${startPos.y} Q ${midX} ${midY}, ${endPos.x} ${endPos.y}`;

        return (
          <g key={`rel_${rel.id}`} className="group/rel">
            <path 
              d={pathString}
              fill="none"
              stroke="#ec4899"
              strokeWidth={2.2}
              strokeDasharray="4 3"
              markerEnd="url(#arrow)"
              className="cursor-pointer hover:stroke-rose-600 transition-colors pointer-events-auto"
            />
            
            {/* Floating link label overlay */}
            <rect 
              x={midX - 45} 
              y={midY - 8} 
              width={90} 
              height={16} 
              rx={3} 
              fill="#fbcfe8" 
              className="fill-rose-100 fill-opacity-95 stroke-pink-300 opacity-90 stroke group-hover/rel:opacity-100" 
            />
            <text 
              x={midX} 
              y={midY + 3} 
              textAnchor="middle" 
              fill="#be185d" 
              fontSize={9} 
              className="font-bold shrink-0 font-mono select-none"
            >
              {rel.text || "Connection"}
            </text>
            
            {/* Micro deletion trigger button */}
            <circle 
              cx={midX + 50} 
              cy={midY} 
              r={7} 
              fill="#be185d" 
              className="cursor-pointer opacity-0 group-hover/rel:opacity-100 transition-opacity pointer-events-auto"
              onClick={() => onDeleteRelationship(rel.id)}
            />
            <text 
              x={midX + 50} 
              y={midY + 2} 
              fill="white" 
              fontSize={7} 
              textAnchor="middle" 
              className="font-extrabold select-none pointer-events-none"
            >
              &times;
            </text>
          </g>
        );
      })}
    </svg>
  );
}
