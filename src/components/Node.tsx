import React from 'react';
import { MindMapNode } from '../types';
import { PositionedNode } from '../utils/layout';
import { Link2, Plus, CornerRightDown, ArrowRight, Trash2 } from 'lucide-react';

interface NodeProps {
  id: string;
  node: MindMapNode;
  pos: PositionedNode;
  isSelected: boolean;
  isEditing: boolean;
  isDragging: boolean;
  relFromNodeId: string | null;
  editInputValue: string;
  rootNodeId: string;
  setEditInputValue: (val: string) => void;
  onNodeDragStart: (e: React.MouseEvent, id: string) => void;
  onDoubleClick: (e: React.MouseEvent, id: string) => void;
  onInlineEditBlur: () => void;
  onInlineEditKeyDown: (e: React.KeyboardEvent) => void;
  onCompleteRelationshipSetup: (id: string) => void;
  onAddChild: (e: React.MouseEvent, id: string, direction?: 'top'|'bottom'|'left'|'right') => void;
  onAddSibling: (id: string, direction?: 'top'|'bottom'|'left'|'right') => void;
  onStartRelationshipSetup: (id: string) => void;
  onDeleteNode: (id: string) => void;
  onSelectNode: (id: string | null) => void;
}

export default React.memo(function Node({
  id,
  node,
  pos,
  isSelected,
  isEditing,
  isDragging,
  relFromNodeId,
  editInputValue,
  rootNodeId,
  setEditInputValue,
  onNodeDragStart,
  onDoubleClick,
  onInlineEditBlur,
  onInlineEditKeyDown,
  onCompleteRelationshipSetup,
  onAddChild,
  onAddSibling,
  onStartRelationshipSetup,
  onDeleteNode,
  onSelectNode
}: NodeProps) {
  
  // Default Eraser.io aesthetics
  let background = node.color?.background || '#ffffff';
  let border = node.color?.border || '#1e293b'; // slate-800
  let text = node.color?.text || '#0f172a';     // slate-900

  if (node.type === 'root' && !node.color) {
    background = '#1e293b';
    border = '#0f172a';
    text = '#ffffff';
  }

  const isBlock = node.type === 'block' || node.shape === 'block';
  const isLabel = node.type === 'label' || node.shape === 'label';

  let width = node.width;
  let height = node.height;

  if (isBlock) {
    width = node.width ?? 350;
    height = node.height ?? 250;
  } else if (isLabel) {
    width = node.width ?? 160;
    height = node.height ?? 40;
  }

  // Generate CSS properties based on the exact shape
  let shapeClasses = 'rounded-md shadow-sm border-[1.5px]'; // Eraser base look
  let clipPath = undefined;
  
  const shape = node.shape || 'rounded';
  
  if (shape === 'rect') shapeClasses = 'rounded-none shadow-sm border-[1.5px]';
  if (shape === 'circle') shapeClasses = 'rounded-full h-12 w-12 flex items-center justify-center shadow-sm border-[1.5px]';
  if (shape === 'ellipse') shapeClasses = 'rounded-[60%] shadow-sm border-[1.5px] px-5';
  if (shape === 'underline') shapeClasses = 'border-b-[2px] rounded-none border-t-0 border-l-0 border-r-0 bg-transparent shadow-none';
  if (shape === 'borderless' || isLabel) shapeClasses = 'border-none shadow-none bg-transparent';
  if (isBlock) shapeClasses = 'rounded-xl border-[1.5px] border-slate-300 bg-slate-50/50 items-start justify-start p-4 shadow-sm';
  
  // Advanced CSS Clip-Path Shapes
  if (shape === 'diamond') {
    shapeClasses = 'rounded-none shadow-sm border-0';
    clipPath = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
  }
  if (shape === 'hexagon') {
    shapeClasses = 'rounded-none shadow-sm border-0 px-6';
    clipPath = 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';
  }
  if (shape === 'triangle') {
    shapeClasses = 'rounded-none shadow-sm border-0 pb-2 pt-6 px-6';
    clipPath = 'polygon(50% 0%, 100% 100%, 0% 100%)';
  }
  if (shape === 'parallelogram') {
    shapeClasses = 'rounded-none shadow-sm border-0 px-6';
    clipPath = 'polygon(20% 0%, 100% 0%, 80% 100%, 0% 100%)';
  }

  // For complex shapes, we use an absolute SVG background instead of borders
  const usesSvgBackground = ['cylinder', 'cloud', 'document', 'folder', 'note', 'actor', 'browser', 'callout', 'card'].includes(shape);
  if (usesSvgBackground) {
    shapeClasses = 'border-0 shadow-none bg-transparent pt-3 pb-3 px-4';
  }

  // Ensure clip-path nodes have a simulated border via a parent wrapper or background
  const finalBgColor = isBlock ? undefined : background;
  const finalBorderColor = isBlock ? undefined : border;

  return (
    <div 
      id={`node_${id}`}
      onMouseDown={(e) => onNodeDragStart(e, id)}
      onDoubleClick={(e) => onDoubleClick(e, id)}
      className={`mindmap-node absolute -translate-x-1/2 -translate-y-1/2 font-sans px-4 py-2 ${isDragging ? '' : 'transition-shadow transition-colors duration-200'} outline-none flex flex-col justify-center select-none group ${shapeClasses} ${
        isSelected 
          ? 'shadow-md scale-[1.02]' 
          : 'hover:shadow hover:scale-[1.01]'
      }`}
      style={{
        left: pos.x,
        top: pos.y,
        width: width ?? (usesSvgBackground || clipPath ? '180px' : '155px'),
        height: height ?? undefined,
        backgroundColor: clipPath || usesSvgBackground ? 'transparent' : finalBgColor,
        borderColor: clipPath || usesSvgBackground ? 'transparent' : finalBorderColor,
        color: text,
        cursor: isDragging ? 'grabbing' : 'grab',
        zIndex: isBlock ? 1 : (isSelected ? 20 : 10)
      }}
    >
      {/* Draw.io Style Selection Bounding Box */}
      {isSelected && (
        <div className="absolute -inset-2 border-[1.5px] border-dashed border-[#29b6f2] pointer-events-none">
          {/* 8 Resize Handles */}
          <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-[#29b6f2] rounded-full pointer-events-auto cursor-nwse-resize" />
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#29b6f2] rounded-full pointer-events-auto cursor-ns-resize" />
          <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-[#29b6f2] rounded-full pointer-events-auto cursor-nesw-resize" />
          <div className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-3 bg-[#29b6f2] rounded-full pointer-events-auto cursor-ew-resize" />
          <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-[#29b6f2] rounded-full pointer-events-auto cursor-nwse-resize" />
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#29b6f2] rounded-full pointer-events-auto cursor-ns-resize" />
          <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-[#29b6f2] rounded-full pointer-events-auto cursor-nesw-resize" />
          <div className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-3 h-3 bg-[#29b6f2] rounded-full pointer-events-auto cursor-ew-resize" />
          
          {/* Rotate Handle */}
          <div className="absolute -top-6 right-0 w-4 h-4 text-[#29b6f2] pointer-events-auto cursor-grab">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.17l5.63 5.63"/></svg>
          </div>
        </div>
      )}

      {/* Draw.io Style Hover Duplicate / Connect Arrows */}
      <div className="absolute -inset-8 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        <button onClick={(e) => onAddChild(e, id, 'top')} className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-auto text-[#29b6f2] hover:scale-125 transition-transform bg-white/50 rounded-full" title="Add Parent/Sibling">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11 4v10.59l-3.3-3.3-1.4 1.42L12 18.41l5.7-5.7-1.4-1.42-3.3 3.3V4h-2z" transform="rotate(180 12 12)"/></svg>
        </button>
        <button onClick={(e) => onAddChild(e, id, 'bottom')} className="absolute bottom-0 left-1/2 -translate-x-1/2 pointer-events-auto text-[#29b6f2] hover:scale-125 transition-transform bg-white/50 rounded-full" title="Add Child">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11 4v10.59l-3.3-3.3-1.4 1.42L12 18.41l5.7-5.7-1.4-1.42-3.3 3.3V4h-2z"/></svg>
        </button>
        <button onClick={(e) => { e.stopPropagation(); onAddSibling(id, 'left'); }} className="absolute top-1/2 -translate-y-1/2 left-0 pointer-events-auto text-[#29b6f2] hover:scale-125 transition-transform bg-white/50 rounded-full" title="Add Sibling">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11 4v10.59l-3.3-3.3-1.4 1.42L12 18.41l5.7-5.7-1.4-1.42-3.3 3.3V4h-2z" transform="rotate(90 12 12)"/></svg>
        </button>
        <button onClick={(e) => { e.stopPropagation(); onAddSibling(id, 'right'); }} className="absolute top-1/2 -translate-y-1/2 right-0 pointer-events-auto text-[#29b6f2] hover:scale-125 transition-transform bg-white/50 rounded-full" title="Add Sibling">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11 4v10.59l-3.3-3.3-1.4 1.42L12 18.41l5.7-5.7-1.4-1.42-3.3 3.3V4h-2z" transform="rotate(-90 12 12)"/></svg>
        </button>
      </div>

      {/* Clip-Path inner background provider */}
      {clipPath && (
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            clipPath,
            backgroundColor: finalBgColor,
            border: `1.5px solid ${finalBorderColor}` // Fallback if supported
          }}
        />
      )}
      {/* SVG Background Provider for Complex Shapes */}
      {usesSvgBackground && (
        <svg 
          className="absolute inset-0 w-full h-full pointer-events-none" 
          preserveAspectRatio="none" 
          viewBox="0 0 100 100"
        >
          {shape === 'cylinder' && (
            <path d="M0,20 C0,10 100,10 100,20 L100,80 C100,90 0,90 0,80 Z M0,20 C0,30 100,30 100,20" fill={finalBgColor} stroke={finalBorderColor} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          )}
          {shape === 'document' && (
            <path d="M0,0 L80,0 L100,20 L100,100 L0,100 Z M80,0 L80,20 L100,20" fill={finalBgColor} stroke={finalBorderColor} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          )}
          {shape === 'folder' && (
            <path d="M0,10 L30,10 L40,25 L100,25 L100,100 L0,100 Z" fill={finalBgColor} stroke={finalBorderColor} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          )}
          {shape === 'note' && (
            <path d="M0,0 L100,0 L100,80 L80,100 L0,100 Z M100,80 L80,80 L80,100" fill={finalBgColor} stroke={finalBorderColor} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          )}
          {shape === 'card' && (
            <rect x="0" y="0" width="100" height="100" rx="8" fill={finalBgColor} stroke={finalBorderColor} strokeWidth="1.5" vectorEffect="non-scaling-stroke" filter="drop-shadow(0px 4px 6px rgba(0,0,0,0.1))" />
          )}
          {shape === 'cloud' && (
            <path d="M20,60 A20,20 0 0,1 40,40 A30,30 0 0,1 80,50 A20,20 0 0,1 80,90 L20,90 A20,20 0 0,1 20,60 Z" fill={finalBgColor} stroke={finalBorderColor} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          )}
          {shape === 'actor' && (
            <g>
              <circle cx="50" cy="30" r="15" fill={finalBgColor} stroke={finalBorderColor} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              <path d="M20,90 Q50,50 80,90 Z" fill={finalBgColor} stroke={finalBorderColor} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            </g>
          )}
          {shape === 'browser' && (
            <g>
              <rect x="0" y="0" width="100" height="100" rx="6" fill={finalBgColor} stroke={finalBorderColor} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              <line x1="0" y1="20" x2="100" y2="20" stroke={finalBorderColor} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              <circle cx="10" cy="10" r="3" fill={finalBorderColor} />
              <circle cx="20" cy="10" r="3" fill={finalBorderColor} />
              <circle cx="30" cy="10" r="3" fill={finalBorderColor} />
            </g>
          )}
          {shape === 'callout' && (
            <path d="M0,0 L100,0 L100,70 L30,70 L10,100 L20,70 L0,70 Z" fill={finalBgColor} stroke={finalBorderColor} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
      )}

      {/* Foreground Container */}
      <div className="relative z-10 w-full h-full flex flex-col justify-center">
      {/* Relationship setting indicator overlay */}
      {relFromNodeId && relFromNodeId !== id && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            onCompleteRelationshipSetup(id);
          }}
          className="absolute inset-0 bg-pink-500/25 cursor-pointer flex items-center justify-center animate-pulse rounded border border-pink-500"
        >
          <span className="text-[9px] text-white font-extrabold uppercase font-mono px-1 bg-pink-600 rounded">Link Dest</span>
        </div>
      )}

      {/* Editing / Writing Mode Input */}
      {isEditing ? (
        <input 
          type="text"
          value={editInputValue}
          onChange={(e) => setEditInputValue(e.target.value)}
          onBlur={onInlineEditBlur}
          onKeyDown={onInlineEditKeyDown}
          autoFocus
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full bg-white text-slate-800 text-xs px-1 outline-none text-center font-semibold rounded"
        />
      ) : (
        <div className={`flex flex-col ${isBlock ? 'items-start text-left w-full h-full' : 'items-center text-center'} gap-0.5 leading-normal`}>
          {/* Container Frame Title Banner tag */}
          {isBlock && (
            <div className="text-[9px] uppercase tracking-wider font-extrabold text-pink-700 bg-pink-100 border border-pink-200 px-1.5 py-0.5 rounded mb-2.5 select-none pointer-events-none">
              📦 Container Board: {node.text}
            </div>
          )}

          {/* Attached details icons row */}
          <div className="flex flex-wrap gap-1 items-center justify-center mb-0.5 pointer-events-none">
            {node.icon && <span className="text-[11px] font-medium leading-none shrink-0">{node.icon}</span>}
            {node.priority && node.priority !== 'none' && (
              <span className={`text-[8px] uppercase tracking-wider font-extrabold px-1.5 py-0.2 rounded-full leading-none shrink-0 ${
                node.priority === 'high' ? 'bg-rose-500 text-white' : node.priority === 'medium' ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white'
              }`}>
                !
              </span>
            )}
            {node.complete !== null && node.complete !== undefined && (
              <span className="text-[8px] font-extrabold px-1 rounded-full bg-emerald-500 text-white leading-none shrink-0 font-mono">
                {node.complete}%
              </span>
            )}
            {node.hyperlink && <Link2 size={8} className={node.type === 'root' ? 'text-white' : 'text-blue-500'} />}
          </div>

          {/* Main Node Text label */}
          {!isBlock && (
            <span className={`text-xs select-none block w-full truncate text-center break-words font-semibold max-w-[145px] leading-relaxed ${
              node.type === 'root' ? 'text-sm font-extrabold' : ''
            }`}>
              {node.text}
            </span>
          )}

          {isBlock && (
            <p className="text-[11px] leading-relaxed text-slate-500/90 select-none italic max-w-full overflow-hidden mt-1 cursor-text select-all">
              {node.notes || "Double-click block title/body to edit contents or drag other notes/images inside."}
            </p>
          )}


        </div>
      )}
      </div>
    </div>
  );
});
