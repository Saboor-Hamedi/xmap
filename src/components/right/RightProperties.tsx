import React from 'react';
import { MindMapData, MindMapNode } from '../../types';
import MapProperties from './MapProperties';
import NodeProperties from './NodeProperties';

interface RightPropertiesProps {
  rightSidebarOpen: boolean;
  setRightSidebarOpen: (open: boolean) => void;
  mapData: MindMapData;
  selectedNodeId: string | null;
  updateMapState: (newData: MindMapData) => void;
  handleUndo: () => void;
  handleRedo: () => void;
  undoStackLength: number;
  redoStackLength: number;
  handleReLayoutMap: () => void;
  handleExportJson: () => void;
  handleExportMarkdown: () => void;
  handleUpdateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  handleDeleteNode: (nodeId: string) => void;
}

export default function RightProperties({
  rightSidebarOpen,
  setRightSidebarOpen,
  mapData,
  selectedNodeId,
  updateMapState,
  handleUndo,
  handleRedo,
  undoStackLength,
  redoStackLength,
  handleReLayoutMap,
  handleExportJson,
  handleExportMarkdown,
  handleUpdateNode,
  handleDeleteNode
}: RightPropertiesProps) {
  
  if (!rightSidebarOpen) return null;

  return (
    <div className="absolute md:relative inset-y-0 right-0 w-60 md:w-64 border-l border-slate-200 bg-[#f9f9f9] flex flex-col shadow-2xl md:shadow-none z-50 overflow-y-auto overflow-x-hidden">
      {selectedNodeId && mapData.nodes[selectedNodeId] ? (
        <NodeProperties 
          selectedNode={mapData.nodes[selectedNodeId]}
          onUpdateNode={handleUpdateNode}
          onClose={() => setRightSidebarOpen(false)}
          onDeleteNode={handleDeleteNode}
        />
      ) : (
        <MapProperties 
          mapData={mapData}
          updateMapState={updateMapState}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={undoStackLength > 0}
          canRedo={redoStackLength > 0}
          onAlign={handleReLayoutMap}
          onExportJson={handleExportJson}
          onExportMarkdown={handleExportMarkdown}
          onClose={() => setRightSidebarOpen(false)}
        />
      )}
    </div>
  );
}
