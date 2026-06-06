import React, { useState } from 'react';
import { Palette, RefreshCw, Undo2, Redo2, DownloadCloud, FileText, ChevronDown, ChevronRight, HelpCircle, Plus, Edit2, X } from 'lucide-react';
import { MindMapData, NodeShape } from '../../types';
import { calculateNodePositions } from '../../utils/layout';

const SHAPE_CATEGORIES = [
  {
    name: 'General',
    shapes: [
      { type: 'rect', label: 'Rectangle' },
      { type: 'rounded', label: 'Rounded' },
      { type: 'circle', label: 'Circle' },
      { type: 'ellipse', label: 'Ellipse' },
      { type: 'diamond', label: 'Diamond' },
      { type: 'hexagon', label: 'Hexagon' },
      { type: 'triangle', label: 'Triangle' },
      { type: 'parallelogram', label: 'Parallelogram' },
      { type: 'cylinder', label: 'Database' },
      { type: 'cloud', label: 'Cloud' },
    ] as { type: NodeShape, label: string }[]
  },
  {
    name: 'Basic',
    shapes: [
      { type: 'document', label: 'Document' },
      { type: 'folder', label: 'Folder' },
      { type: 'note', label: 'Note' },
      { type: 'actor', label: 'Actor' },
      { type: 'browser', label: 'Browser' },
      { type: 'callout', label: 'Callout' },
      { type: 'card', label: 'Card UI' },
      { type: 'block', label: 'Region' },
      { type: 'label', label: 'Text Tag' },
      { type: 'underline', label: 'Underline' }
    ] as { type: NodeShape, label: string }[]
  }
];

interface MapPropertiesPanelProps {
  mapData: MindMapData;
  updateMapState: (newData: MindMapData) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onAlign: () => void;
  onExportJson: () => void;
  onExportMarkdown: () => void;
  onClose?: () => void;
}

export default function MapPropertiesPanel({
  mapData,
  updateMapState,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onAlign,
  onExportJson,
  onExportMarkdown,
  onClose
}: MapPropertiesPanelProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    'Scratchpad': false,
    'General': true,
    'Basic': true,
    'Global Actions': false,
    'Map Layout': false,
    'Export': false
  });

  const toggle = (section: string) => {
    setExpanded(p => ({ ...p, [section]: !p[section] }));
  };

  const handleDragStart = (e: React.DragEvent, type: NodeShape) => {
    e.dataTransfer.setData('text/plain', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const AccordionSection = ({ title, children, actions }: { title: string, children: React.ReactNode, actions?: React.ReactNode }) => {
    const isExpanded = expanded[title];
    return (
      <div className="flex flex-col border-b border-slate-200 last:border-0 bg-[#f3f4f6]">
        <div 
          className="flex items-center justify-between px-2 py-2 cursor-pointer hover:bg-slate-200 transition-colors"
          onClick={() => toggle(title)}
        >
          <div className="flex items-center gap-1.5 text-slate-800">
            {isExpanded ? <ChevronDown size={14} className="text-slate-600" /> : <ChevronRight size={14} className="text-slate-600" />}
            <span className="text-xs font-semibold select-none">{title}</span>
          </div>
          {actions && <div onClick={e => e.stopPropagation()} className="flex items-center gap-1 text-slate-500">{actions}</div>}
        </div>
        {isExpanded && (
          <div className="px-2 pb-3 bg-[#f3f4f6]">
            {children}
          </div>
        )}
      </div>
    );
  };

  // Helper to render the mini SVG
  const renderMiniShape = (type: NodeShape) => {
    return (
      <div className="w-8 h-8 flex items-center justify-center text-slate-700 pointer-events-none">
        {type === 'rect' && <div className="w-6 h-5 border-[1.5px] border-current rounded-sm" />}
        {type === 'rounded' && <div className="w-6 h-5 border-[1.5px] border-current rounded-md" />}
        {type === 'circle' && <div className="w-6 h-6 border-[1.5px] border-current rounded-full" />}
        {type === 'ellipse' && <div className="w-7 h-4 border-[1.5px] border-current rounded-[50%]" />}
        {type === 'diamond' && <div className="w-5 h-5 border-[1.5px] border-current rotate-45" />}
        {type === 'hexagon' && <div className="w-6 h-5 bg-transparent border-none relative flex justify-center items-center"><svg viewBox="0 0 100 100" className="w-6 h-6"><polygon points="25,0 75,0 100,50 75,100 25,100 0,50" fill="none" stroke="currentColor" strokeWidth="5" /></svg></div>}
        {type === 'triangle' && <div className="w-6 h-6 bg-transparent border-none relative flex justify-center items-center"><svg viewBox="0 0 100 100" className="w-6 h-6"><polygon points="50,0 100,100 0,100" fill="none" stroke="currentColor" strokeWidth="5" /></svg></div>}
        {type === 'parallelogram' && <div className="w-6 h-6 bg-transparent border-none relative flex justify-center items-center"><svg viewBox="0 0 100 100" className="w-6 h-6"><polygon points="20,10 100,10 80,90 0,90" fill="none" stroke="currentColor" strokeWidth="5" /></svg></div>}
        {type === 'cylinder' && <div className="w-6 h-6 bg-transparent border-none relative flex justify-center items-center"><svg viewBox="0 0 100 100" className="w-6 h-6"><path d="M0,20 C0,5 100,5 100,20 L100,80 C100,95 0,95 0,80 Z M0,20 C0,35 100,35 100,20" fill="none" stroke="currentColor" strokeWidth="5" /></svg></div>}
        {type === 'cloud' && <div className="w-6 h-6 bg-transparent border-none relative flex justify-center items-center"><svg viewBox="0 0 100 100" className="w-6 h-6"><path d="M20,60 A20,20 0 0,1 40,40 A30,30 0 0,1 80,50 A20,20 0 0,1 80,90 L20,90 A20,20 0 0,1 20,60 Z" fill="none" stroke="currentColor" strokeWidth="5" /></svg></div>}
        {type === 'document' && <div className="w-5 h-6 bg-transparent border-none relative flex justify-center items-center"><svg viewBox="0 0 100 100" className="w-6 h-6"><path d="M10,0 L70,0 L90,20 L90,100 L10,100 Z M70,0 L70,20 L90,20" fill="none" stroke="currentColor" strokeWidth="5" /></svg></div>}
        {type === 'folder' && <div className="w-6 h-5 bg-transparent border-none relative flex justify-center items-center"><svg viewBox="0 0 100 100" className="w-6 h-6"><path d="M0,10 L30,10 L40,25 L100,25 L100,100 L0,100 Z" fill="none" stroke="currentColor" strokeWidth="5" /></svg></div>}
        {type === 'note' && <div className="w-5 h-5 bg-transparent border-none relative flex justify-center items-center"><svg viewBox="0 0 100 100" className="w-6 h-6"><path d="M0,0 L100,0 L100,70 L70,100 L0,100 Z M100,70 L70,70 L70,100" fill="none" stroke="currentColor" strokeWidth="5" /></svg></div>}
        {type === 'actor' && <div className="w-5 h-6 bg-transparent border-none relative flex justify-center items-center"><svg viewBox="0 0 100 100" className="w-6 h-6"><circle cx="50" cy="30" r="20" fill="none" stroke="currentColor" strokeWidth="5" /><path d="M20,100 Q50,60 80,100" fill="none" stroke="currentColor" strokeWidth="5" /></svg></div>}
        {type === 'browser' && <div className="w-6 h-5 bg-transparent border-none relative flex justify-center items-center"><svg viewBox="0 0 100 100" className="w-6 h-6"><rect x="0" y="0" width="100" height="100" rx="10" fill="none" stroke="currentColor" strokeWidth="5" /><line x1="0" y1="25" x2="100" y2="25" stroke="currentColor" strokeWidth="5" /></svg></div>}
        {type === 'callout' && <div className="w-6 h-5 bg-transparent border-none relative flex justify-center items-center"><svg viewBox="0 0 100 100" className="w-6 h-6"><path d="M0,0 L100,0 L100,70 L30,70 L10,100 L20,70 L0,70 Z" fill="none" stroke="currentColor" strokeWidth="5" /></svg></div>}
        {type === 'card' && <div className="w-6 h-5 border-[1.5px] border-current rounded-md shadow-sm" />}
        {type === 'block' && <div className="w-6 h-5 border-2 border-dashed border-current rounded-md" />}
        {type === 'label' && <div className="text-[8px] font-bold text-current border border-current px-1 py-0.5 rounded-sm">Tag</div>}
        {type === 'underline' && <div className="w-6 h-1 border-b-2 border-current" />}
      </div>
    );
  };

  return (
    <div id="map_properties_panel" className="flex flex-col select-none bg-[#f3f4f6] h-full overflow-y-auto">
      
      {/* Search Bar mimic */}
      <div className="p-3 bg-[#f3f4f6] pb-2">
        <div className="bg-white border border-slate-300 rounded-full px-3 py-1.5 flex items-center text-slate-400">
          <input 
            type="text" 
            placeholder="Type / to search" 
            className="bg-transparent border-none outline-none text-xs flex-1 text-slate-700" 
            disabled
          />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </div>
      </div>

      <div className="flex flex-col shrink-0">
        
        {/* Scratchpad (Empty mockup) */}
        <AccordionSection 
          title="Scratchpad" 
          actions={
            <>
              <HelpCircle size={13} className="hover:text-slate-800 cursor-pointer" />
              <Plus size={13} className="hover:text-slate-800 cursor-pointer" />
              <Edit2 size={13} className="hover:text-slate-800 cursor-pointer" />
              <X size={13} className="hover:text-slate-800 cursor-pointer" />
            </>
          }
        >
          <div className="border border-dashed border-slate-400 rounded-md py-3 text-center text-slate-400 text-xs mt-1">
            Drag elements here
          </div>
        </AccordionSection>

        {/* Dynamic Shape Categories */}
        {SHAPE_CATEGORIES.map(cat => (
          <React.Fragment key={cat.name}>
            <AccordionSection title={cat.name}>
              <div className="grid grid-cols-5 gap-1 pt-1">
                {cat.shapes.map((s) => (
                  <div 
                    key={s.type}
                    draggable
                    onDragStart={(e) => handleDragStart(e, s.type)}
                    className="w-10 h-10 mx-auto flex items-center justify-center hover:bg-[#e2e8f0] rounded cursor-grab active:cursor-grabbing text-slate-700 transition-colors"
                    title={s.label}
                  >
                    {renderMiniShape(s.type)}
                  </div>
                ))}
              </div>
            </AccordionSection>
          </React.Fragment>
        ))}

        <div className="flex justify-center p-3">
          <button className="bg-[#dbeafe] hover:bg-[#bfdbfe] text-[#1e3a8a] font-bold py-2 px-6 rounded-md flex items-center justify-center gap-2 text-xs transition-colors w-full">
            <Plus size={14} className="stroke-[3]" /> More Shapes
          </button>
        </div>

        {/* Global Tools */}
        <AccordionSection title="Global Actions">
          <div className="flex flex-col gap-1.5 pt-1">
            <div className="flex items-center gap-1.5">
              <button
                disabled={!canUndo}
                onClick={onUndo}
                className="flex-1 py-1.5 px-2 bg-white hover:bg-slate-50 disabled:opacity-50 border border-slate-200 rounded text-slate-700 flex justify-center items-center gap-1 transition-colors text-xs shadow-sm"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 size={13} /> Undo
              </button>
              <button
                disabled={!canRedo}
                onClick={onRedo}
                className="flex-1 py-1.5 px-2 bg-white hover:bg-slate-50 disabled:opacity-50 border border-slate-200 rounded text-slate-700 flex justify-center items-center gap-1 transition-colors text-xs shadow-sm"
                title="Redo (Ctrl+Y)"
              >
                <Redo2 size={13} /> Redo
              </button>
            </div>
            
            <button 
              onClick={onAlign}
              className="w-full py-1.5 px-2 bg-white hover:bg-slate-50 border border-slate-200 rounded text-blue-600 flex justify-center items-center gap-1.5 transition-colors font-semibold text-xs shadow-sm"
            >
              <RefreshCw size={13} /> Auto-Align Layout
            </button>
          </div>
        </AccordionSection>

        {/* Layout Direction */}
        <AccordionSection title="Map Layout">
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            {[
              { id: 'balanced', label: 'Balanced' },
              { id: 'horizontal', label: 'Horizontal' },
              { id: 'vertical', label: 'Vertical' },
              { id: 'freeform', label: 'Freeform' },
            ].map((dir) => (
              <button
                key={dir.id}
                onClick={() => {
                  if (dir.id === 'freeform') {
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
                    updateMapState({ ...mapData, nodes: updatedNodes, layoutDirection: 'freeform' });
                  } else {
                    updateMapState({ ...mapData, layoutDirection: dir.id as any });
                  }
                }}
                className={`py-1.5 px-2 text-xs border rounded transition-all shadow-sm ${
                  mapData.layoutDirection === dir.id
                    ? 'bg-blue-50 border-blue-400 text-blue-700 font-bold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {dir.label}
              </button>
            ))}
          </div>
        </AccordionSection>

        {/* Export / Save */}
        <AccordionSection title="Export">
          <div className="flex flex-col gap-1.5 pt-1 pb-4">
            <button 
              onClick={onExportJson}
              className="w-full text-left px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 flex items-center justify-between rounded text-xs font-semibold shadow-sm transition-colors"
            >
              Download JSON <DownloadCloud size={13} />
            </button>
            
            <button 
              onClick={onExportMarkdown}
              className="w-full text-left px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 flex items-center justify-between rounded text-xs font-semibold shadow-sm transition-colors"
            >
              Export Markdown <FileText size={13} />
            </button>
          </div>
        </AccordionSection>

      </div>
    </div>
  );
}
