/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Link2, Plus, CornerRightDown, ArrowRight, Trash2, Bot, Sparkles, AlertCircle, ZoomIn, ZoomOut, Compass, Maximize2, MousePointer2 } from 'lucide-react';
import { MindMapData, MindMapNode, NodeShape } from '../types';
import { calculateNodePositions, PositionedNode } from '../utils/layout';
import Node from './Node';
import Lines from './Lines';

interface MindmapCanvasProps {
  mapData: MindMapData;
  positionedNodes: Record<string, PositionedNode>;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onUpdateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  onAddChild: (parentId: string, direction?: 'top'|'bottom'|'left'|'right') => void;
  onAddSibling: (nodeId: string, direction?: 'top'|'bottom'|'left'|'right') => void;
  onDeleteNode: (nodeId: string) => void;
  onAddRelationship: (fromId: string, toId: string, text?: string) => void;
  onAddSummary: (parentId: string, nodeIds: string[], text: string) => void;
  onDeleteSummary: (summaryId: string) => void;
  onDeleteRelationship: (relId: string) => void;
  onDropNewNode?: (shape: NodeShape, x: number, y: number) => void;
  onTriggerBrainstorm?: (nodeId: string, prompt?: string) => Promise<void>;
  isAiLoading?: boolean;
  updateMapState?: (newData: MindMapData) => void;
}

export default function MindmapCanvas({
  mapData,
  positionedNodes,
  selectedNodeId,
  onSelectNode,
  onUpdateNode,
  onAddChild,
  onAddSibling,
  onDeleteNode,
  onAddRelationship,
  onAddSummary,
  onDeleteSummary,
  onDeleteRelationship,
  onDropNewNode,
  onTriggerBrainstorm,
  isAiLoading,
  updateMapState
}: MindmapCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // Panning and Zoom State
  const [panX, setPanX] = useState(250);
  const [panY, setPanY] = useState(280);
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Floating menus and triggers
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editInputValue, setEditInputValue] = useState('');
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [aiCustomPrompt, setAiCustomPrompt] = useState('');
  
  // Relationship arrow mapping mode
  const [relFromNodeId, setRelFromNodeId] = useState<string | null>(null);

  // Dragging individual nodes helper state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [nodeOffsetOnDragStart, setNodeOffsetOnDragStart] = useState({ x: 0, y: 0 });
  const [nodeAbsoluteOnDragStart, setNodeAbsoluteOnDragStart] = useState({ x: 0, y: 0 });
  const [liveDragOffset, setLiveDragOffset] = useState({ dx: 0, dy: 0 });
  
  const panTransformRef = useRef({ x: panX, y: panY });

  useEffect(() => {
    panTransformRef.current = { x: panX, y: panY };
  }, [panX, panY]);

  // Keyboard shortcut listener for efficient diagramming
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if currently typing in an input text field or notes pane
      if (
        document.activeElement?.tagName === 'INPUT' || 
        document.activeElement?.tagName === 'TEXTAREA' ||
        editingNodeId !== null
      ) {
        return;
      }

      if (!selectedNodeId) return;

      const currentNode = mapData.nodes[selectedNodeId];

      switch (e.key) {
        case 'Tab':
          e.preventDefault();
          onAddChild(selectedNodeId);
          break;
        case 'Enter':
          e.preventDefault();
          onAddSibling(selectedNodeId);
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          if (selectedNodeId !== mapData.rootNodeId) {
            onDeleteNode(selectedNodeId);
            onSelectNode(null);
          }
          break;
        case 'Space':
          e.preventDefault();
          if (currentNode) {
            setEditingNodeId(selectedNodeId);
            setEditInputValue(currentNode.text);
          }
          break;
        case 'Escape':
          onSelectNode(null);
          setRelFromNodeId(null);
          setShowAiPrompt(false);
          break;
        // Directional tree traversal navigation
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight':
          e.preventDefault();
          navigateTree(e.key);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedNodeId, mapData, editingNodeId]);

  // Tree Traversal Navigation helper
  const navigateTree = (direction: string) => {
    if (!selectedNodeId) return;
    
    const activePos = positionedNodes[selectedNodeId];
    if (!activePos) return;

    // Find the physically closest node in the designated key direction
    let bestCandidateId: string | null = null;
    let closestDistance = Infinity;

    Object.keys(positionedNodes).forEach((id) => {
      if (id === selectedNodeId) return;
      const pos = positionedNodes[id];
      
      const dx = pos.x - activePos.x;
      const dy = pos.y - activePos.y;

      // Filter based on grid quadrants
      if (direction === 'ArrowUp' && dy >= 0) return;
      if (direction === 'ArrowDown' && dy <= 0) return;
      if (direction === 'ArrowLeft' && dx >= 0) return;
      if (direction === 'ArrowRight' && dx <= 0) return;

      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < closestDistance) {
        closestDistance = dist;
        bestCandidateId = id;
      }
    });

    if (bestCandidateId) {
      onSelectNode(bestCandidateId);
    }
  };

  // Pan Canvas Mouse Event Helpers
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Only pan if clicking empty canvas or holding spacebar/middle click
    const target = e.target as HTMLElement;
    if (target.closest('.mindmap-node') || target.closest('button') || target.closest('input')) {
      return; 
    }
    
    onSelectNode(null);
    
    setIsPanning(true);
    setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const newX = e.clientX - panStart.x;
      const newY = e.clientY - panStart.y;
      panTransformRef.current = { x: newX, y: newY };
      
      // Update DOM transform directly for 0ms lag panning!
      const el = document.getElementById('canvas_transform_layer');
      if (el) el.style.transform = `translate(${newX}px, ${newY}px) scale(${zoom})`;
    } else if (draggingNodeId) {
      // Calculate absolute dragging movement from drag start
      const zoomLevel = zoom || 1;
      const dx = (e.clientX - dragStartPos.x) / zoomLevel;
      const dy = (e.clientY - dragStartPos.y) / zoomLevel;
      
      setLiveDragOffset({ dx, dy });
    }
  };

  const handleCanvasMouseUp = () => {
    if (isPanning) {
      setPanX(panTransformRef.current.x);
      setPanY(panTransformRef.current.y);
    }

    if (draggingNodeId) {
      const node = mapData.nodes[draggingNodeId];
      const offset = liveDragOffset;
      
      if (node && (offset.dx !== 0 || offset.dy !== 0)) {
        if (mapData.layoutDirection !== 'freeform') {
          // Snap prevention: if dragging while on auto-layout, switch entire map to freeform!
          const currentPositions = calculateNodePositions(mapData.nodes, mapData.rootNodeId, mapData.layoutDirection);
          const updatedNodes = { ...mapData.nodes };
          Object.keys(updatedNodes).forEach(id => {
            if (currentPositions[id]) {
              updatedNodes[id] = {
                ...updatedNodes[id],
                x: currentPositions[id].x,
                y: currentPositions[id].y
              };
            }
          });
          
          updatedNodes[draggingNodeId].x = nodeAbsoluteOnDragStart.x + offset.dx;
          updatedNodes[draggingNodeId].y = nodeAbsoluteOnDragStart.y + offset.dy;
          
          // Use onUpdateNode for the history stack, but also manually trigger updateMapState
          if (updateMapState) {
            updateMapState({ ...mapData, nodes: updatedNodes, layoutDirection: 'freeform' });
          }
        } else {
          onUpdateNode(draggingNodeId, {
            x: nodeAbsoluteOnDragStart.x + offset.dx,
            y: nodeAbsoluteOnDragStart.y + offset.dy
          });
        }
      }
    }
    
    setIsPanning(false);
    setDraggingNodeId(null);
    setLiveDragOffset({ dx: 0, dy: 0 });
  };

  const handleNodeDragStart = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    onSelectNode(nodeId);
    setDraggingNodeId(nodeId);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setLiveDragOffset({ dx: 0, dy: 0 });
    
    const node = mapData.nodes[nodeId];
    if (node) {
      setNodeOffsetOnDragStart({
        x: node.offsetX || 0,
        y: node.offsetY || 0
      });
      // Also cache the absolute positioned nodes coordinates
      const pos = positionedNodes[nodeId];
      setNodeAbsoluteOnDragStart({
        x: node.x ?? pos?.x ?? 0,
        y: node.y ?? pos?.y ?? 0
      });
    }
  };

  const resetPanAndZoom = () => {
    setPanX(canvasRef.current ? canvasRef.current.clientWidth / 2 - 200 : 250);
    setPanY(canvasRef.current ? canvasRef.current.clientHeight / 2 - 40 : 280);
    setZoom(1);
    onSelectNode(null);
  };

  const handleAddChildButton = (e: React.MouseEvent, nodeId: string, direction?: 'top'|'bottom'|'left'|'right') => {
    e.stopPropagation();
    onAddChild(nodeId, direction);
  };

  // Inline edit mergers
  const handleInlineEditSubmit = () => {
    if (editingNodeId) {
      onUpdateNode(editingNodeId, { text: editInputValue.trim() });
      setEditingNodeId(null);
    }
  };

  const handleInlineEditBlur = () => {
    handleInlineEditSubmit();
  };

  const handleInlineEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInlineEditSubmit();
    } else if (e.key === 'Escape') {
      setEditingNodeId(null);
    }
  };

  // Floating AI trigger submit
  const handleAiBrainstormTrigger = async () => {
    if (!selectedNodeId) return;
    setShowAiPrompt(false);
    await onTriggerBrainstorm(selectedNodeId, aiCustomPrompt);
    setAiCustomPrompt('');
  };

  // Trigger floating node connections
  const handleStartRelationshipSetup = (nodeId: string) => {
    setRelFromNodeId(nodeId);
  };

  const handleCompleteRelationshipSetup = (targetNodeId: string) => {
    if (relFromNodeId && relFromNodeId !== targetNodeId) {
      onAddRelationship(relFromNodeId, targetNodeId, "Direct connection");
      setRelFromNodeId(null);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('text/plain') as any;
    
    if (type && onDropNewNode && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const zoomLevel = zoom || 1;
      
      // Calculate coordinates inverse of panning and zoom
      const dropX = (e.clientX - rect.left - panX) / zoomLevel;
      const dropY = (e.clientY - rect.top - panY) / zoomLevel;
      
      onDropNewNode(type, dropX, dropY);
    }
  };

  const computedPositions = useMemo(() => {
    if (!draggingNodeId || (liveDragOffset.dx === 0 && liveDragOffset.dy === 0)) return positionedNodes;
    const pos = { ...positionedNodes };
    if (pos[draggingNodeId]) {
      pos[draggingNodeId] = {
        ...pos[draggingNodeId],
        x: pos[draggingNodeId].x + liveDragOffset.dx,
        y: pos[draggingNodeId].y + liveDragOffset.dy
      };
    }
    return pos;
  }, [positionedNodes, draggingNodeId, liveDragOffset]);

  return (
    <div 
      id="canvas_viewport"
      ref={canvasRef}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onMouseLeave={handleCanvasMouseUp}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`relative flex-1 h-full bg-[#f9f9f9] overflow-hidden cursor-grab select-none ${
        isPanning ? 'cursor-grabbing' : ''
      }`}
    >
      {/* Infinite Grid Background dots - matching draw.io */}
      <div 
        id="canvas_grid_bg"
        className="absolute inset-0 pointer-events-none opacity-50"
        style={{
          backgroundImage: 'radial-gradient(#d1d5db 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          backgroundPosition: `${panX}px ${panY}px`
        }}
      />

      {/* Actual Zoomable/Pannable Inner Wrapper */}
      <div 
        id="canvas_transform_layer"
        className={`absolute origin-top-left select-none ${isPanning ? '' : 'transition-transform duration-75'}`}
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`
        }}
      >
        {/* SVG Drawing Layer (Smooth Curved Connections) */}
        <Lines 
          mapData={mapData}
          positionedNodes={computedPositions}
          onDeleteRelationship={onDeleteRelationship}
          draggingNodeId={null}
          dragOffsetRef={{ current: { dx: 0, dy: 0 } }}
        />

        {/* DOM Mind-Map nodes overlays */}
        {Object.keys(mapData.nodes).map((id) => {
          const node = mapData.nodes[id];
          const pos = computedPositions[id];
          if (!node || !pos) return null;

          return (
            <Node
              key={`dom_${id}`}
              id={id}
              node={node}
              pos={pos}
              isSelected={selectedNodeId === id}
              isEditing={editingNodeId === id}
              isDragging={draggingNodeId === id}
              relFromNodeId={relFromNodeId}
              editInputValue={editInputValue}
              rootNodeId={mapData.rootNodeId}
              setEditInputValue={setEditInputValue}
              onNodeDragStart={handleNodeDragStart}
              onDoubleClick={(e, id) => {
                e.stopPropagation();
                setEditingNodeId(id);
                setEditInputValue(node.text);
              }}
              onInlineEditBlur={handleInlineEditBlur}
              onInlineEditKeyDown={handleInlineEditKeyDown}
              onCompleteRelationshipSetup={handleCompleteRelationshipSetup}
              onAddChild={handleAddChildButton}
              onAddSibling={onAddSibling}
              onStartRelationshipSetup={handleStartRelationshipSetup}
              onDeleteNode={onDeleteNode}
              onSelectNode={onSelectNode}
            />
          );
        })}
      </div>

      {/* Floating Canvas controls sidebar widgets */}
      <div id="canvas_controls_widget" className="absolute bottom-4 left-4 bg-white/95 border border-slate-200/80 p-2 rounded-xl shadow-lg flex items-center gap-1 z-20 shrink-0 select-none">
        <button 
          onClick={() => setZoom(Math.max(0.2, zoom - 0.15))}
          title="Zoom Out"
          className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors"
        >
          <ZoomOut size={15} />
        </button>
        <span className="text-[10px] font-bold font-mono text-slate-500 w-12 text-center pointer-events-none select-none">
          {Math.round(zoom * 100)}%
        </span>
        <button 
          onClick={() => setZoom(Math.min(2.0, zoom + 0.15))}
          title="Zoom In"
          className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors"
        >
          <ZoomIn size={15} />
        </button>
        <div className="h-4 w-[1px] bg-slate-200 mx-1"></div>
        <button 
          onClick={resetPanAndZoom}
          title="Recenter Map View"
          className="p-1.5 hover:bg-slate-100 text-blue-600 hover:text-blue-800 rounded-lg flex items-center gap-1 text-[10px] font-bold tracking-tight uppercase"
        >
          <Compass size={14} /> Recenter
        </button>
      </div>

      {/* Floating AI Prompt expand pop over */}
      {showAiPrompt && selectedNodeId && (
        <div id="floating_ai_popover" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl border border-slate-200/80 p-4 max-w-sm w-full z-45 flex flex-col gap-3.5 select-none animate-in fade-in zoom-in duration-150">
          <div className="flex justify-between items-center bg-blue-50/50 p-2 rounded-lg">
            <span className="text-xs font-bold text-blue-800 flex items-center gap-1.5">
              <Sparkles size={14} className="text-blue-600 animate-spin-slow" /> Brainstorm with Google Gemini
            </span>
            <button 
              onClick={() => setShowAiPrompt(false)}
              className="text-slate-400 hover:text-slate-600 text-xs font-extrabold"
            >
              &times;
            </button>
          </div>
          
          <div className="text-[11px] text-slate-550 text-slate-500">
            Select an idea path or write a custom directive to suggest sub-branches under the node <strong className="text-slate-800">"{mapData.nodes[selectedNodeId]?.text}"</strong>.
          </div>

          {/* Quick presets templates */}
          <div id="ai_quick_presets" className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Quick Presets</label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: '💡 Subcategories', prompt: 'Formulate core subcategories or aspects of this topic' },
                { label: '💰 Monetization', prompt: 'Generate innovative business, monetization, and pricing models' },
                { label: '🎯 Action Steps', prompt: 'List concrete, atomic steps to execute on this specific outcome' },
                { label: '⚠️ Failure/Risks', prompt: 'Identify major bottlenecks, risks, and mitigations to consider' }
              ].map((preset, ix) => (
                <button
                  key={ix}
                  onClick={() => {
                    setAiCustomPrompt(preset.prompt);
                  }}
                  className="p-1 px-2 text-left bg-slate-50 hover:bg-slate-100 text-[10px] text-slate-700 font-semibold border border-slate-150 rounded"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <textarea 
            placeholder="Custom criteria (e.g. Generate marketing channels targeting software engineers)..."
            value={aiCustomPrompt}
            onChange={(e) => setAiCustomPrompt(e.target.value)}
            className="w-full bg-slate-55 bg-slate-50 border border-slate-200 text-xs rounded p-2 focus:bg-white focus:border-purple-500 focus:shadow outline-none resize-none h-16 font-sans"
          />

          <div className="flex gap-2">
            <button
              onClick={() => setShowAiPrompt(false)}
              className="flex-1 border text-xs py-1.5 rounded-md font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAiBrainstormTrigger}
              className="flex-1 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-650 text-white text-xs py-1.5 rounded-md font-bold shadow flex justify-center items-center gap-1.5"
            >
              <Sparkles size={12} className="animate-pulse" /> Trigger AI
            </button>
          </div>
        </div>
      )}

      {/* AI Loading indicator spinner overlay */}
      {isAiLoading && (
        <div id="ai_loading_backdrop" className="absolute inset-0 bg-slate-800/20 backdrop-blur-[1px] flex justify-center items-center z-50 select-none">
          <div className="bg-white rounded-xl shadow-2xl border p-4 flex items-center gap-3 animate-pulse">
            <div className="h-5 w-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-bold text-slate-700 font-mono tracking-wide">Gemini expanding mind mapping clusters...</span>
          </div>
        </div>
      )}
    </div>
  );
}
