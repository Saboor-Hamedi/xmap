import React, { useState, useEffect } from 'react';
import { 
  X, Type, Palette, Flag, Info, FileText, CheckCircle2, 
  Link, Hash, Smile, ChevronRight, ChevronDown, Sparkles, Eye, Edit3, Trash2
} from 'lucide-react';
import { MindMapNode, NodeShape, NodeColor } from '../../types';

interface NodePropertiesPanelProps {
  selectedNode: MindMapNode | null;
  onUpdateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  onClose: () => void;
  onDeleteNode?: (nodeId: string) => void;
}

const COMPACT_PALETTES: { name: string; background: string; border: string; text: string }[] = [
  { name: 'Blue', background: '#2563eb', border: '#1d4ed8', text: '#ffffff' },
  { name: 'Teal', background: '#0d9488', border: '#0f766e', text: '#ffffff' },
  { name: 'Crimson', background: '#e11d48', border: '#be123c', text: '#ffffff' },
  { name: 'Lavender', background: '#7c3aed', border: '#6d28d9', text: '#ffffff' },
  { name: 'Sky', background: '#e0f2fe', border: '#bae6fd', text: '#0369a1' },
  { name: 'Mint', background: '#dcfce7', border: '#bbf7d0', text: '#15803d' },
  { name: 'Amber', background: '#fef3c7', border: '#fde68a', text: '#b45309' },
  { name: 'Dark', background: '#334155', border: '#1e293b', text: '#f8fafc' },
  { name: 'Transparent', background: 'transparent', border: '#e2e8f0', text: '#0f172a' },
];

const COMPACT_SHAPES: { value: NodeShape; label: string }[] = [
  { value: 'rounded', label: 'Rounded Rect' },
  { value: 'rect', label: 'Square Rect' },
  { value: 'circle', label: 'Circle' },
  { value: 'ellipse', label: 'Ellipse' },
  { value: 'underline', label: 'Underline' },
  { value: 'borderless', label: 'Borderless' },
  { value: 'block', label: 'Block Frame' },
  { value: 'label', label: 'Sticky Label' },
  { value: 'card', label: 'Clean Card' },
];

const SIMPLE_ICONS = [
  '⭐', '🎯', '🔥', '💡', '📌', '🚀', '📈', '⚠️', '✅', '❤️', '📅', '💬', '🛠️', '🔒'
];

export default function NodePropertiesPanel({
  selectedNode,
  onUpdateNode,
  onClose,
  onDeleteNode,
}: NodePropertiesPanelProps) {
  const [noteText, setNoteText] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [notePreviewMode, setNotePreviewMode] = useState(false);
  
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    'Style & Shape': true,
    'Colors': false,
    'Badges & Status': false,
    'Layout': false,
    'Notes & Details': false,
  });

  const toggle = (section: string) => {
    setExpanded(p => ({ ...p, [section]: !p[section] }));
  };

  useEffect(() => {
    if (selectedNode) {
      setNoteText(selectedNode.notes || '');
    }
  }, [selectedNode]);

  if (!selectedNode) {
    return (
      <div className="flex flex-col justify-center items-center text-slate-400 p-4 select-none bg-[#f3f4f6]">
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-md transition-colors"
          title="Close panel"
        >
          <X size={15} />
        </button>
        <div className="text-center relative">
          <Palette size={32} className="mx-auto text-slate-300 mb-2" />
          <p className="text-xs font-semibold text-slate-600 mb-1">Topic Inspector</p>
          <p className="text-[10px] text-slate-400 leading-relaxed px-2">Select any node on the infinite map to customize details, styles, tags, priority, or rich markdown notes.</p>
        </div>
      </div>
    );
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateNode(selectedNode.id, { text: e.target.value });
  };

  const handleShapeSelect = (shape: NodeShape) => {
    onUpdateNode(selectedNode.id, { shape });
  };

  const handleColorSelect = (palette: NodeColor) => {
    onUpdateNode(selectedNode.id, { color: palette });
  };

  const handlePrioritySelect = (priority: 'high' | 'medium' | 'low' | 'none') => {
    onUpdateNode(selectedNode.id, { priority });
  };

  const handleCompleteSelect = (complete: 0 | 25 | 50 | 75 | 100 | null) => {
    onUpdateNode(selectedNode.id, { complete });
  };

  const handleSaveNotes = () => {
    onUpdateNode(selectedNode.id, { notes: noteText });
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagInput.trim()) return;
    const currentTags = selectedNode.tags || [];
    const normalizedTag = tagInput.trim().toLowerCase();
    
    if (!currentTags.includes(normalizedTag)) {
      onUpdateNode(selectedNode.id, { tags: [...currentTags, normalizedTag] });
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = selectedNode.tags || [];
    onUpdateNode(selectedNode.id, { tags: currentTags.filter((t) => t !== tagToRemove) });
  };

  const handleToggleIcon = (iconSym: string) => {
    const currentIcon = selectedNode.icon;
    onUpdateNode(selectedNode.id, { icon: currentIcon === iconSym ? undefined : iconSym });
  };

  const renderSimpleMarkdown = (text: string) => {
    if (!text) return <p className="text-slate-400 italic">No note text</p>;
    return text.split('\n').map((line, ix) => {
      let content = line;
      let isHeader = false;
      let headerLevel = 0;

      if (line.startsWith('### ')) {
        content = line.substring(4);
        isHeader = true;
        headerLevel = 3;
      } else if (line.startsWith('## ')) {
        content = line.substring(3);
        isHeader = true;
        headerLevel = 2;
      } else if (line.startsWith('# ')) {
        content = line.substring(2);
        isHeader = true;
        headerLevel = 1;
      }

      const boldRegex = /\*\*(.*?)\*\*/g;
      const parsedElements: React.ReactNode[] = [];
      let lastIndex = 0;
      let match;

      while ((match = boldRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
          parsedElements.push(content.substring(lastIndex, match.index));
        }
        parsedElements.push(<strong key={match.index} className="font-extrabold text-[#0f172a]">{match[1]}</strong>);
        lastIndex = boldRegex.lastIndex;
      }
      if (lastIndex < content.length) {
        parsedElements.push(content.substring(lastIndex));
      }

      const finalRender = parsedElements.length > 0 ? parsedElements : content;

      if (isHeader) {
        if (headerLevel === 1) return <h1 key={ix} className="text-lg font-bold text-slate-900 border-b pb-1 mt-3 mb-1">{finalRender}</h1>;
        if (headerLevel === 2) return <h2 key={ix} className="text-base font-bold text-slate-800 mt-2 mb-1">{finalRender}</h2>;
        return <h3 key={ix} className="text-sm font-semibold text-slate-700 mt-2 mb-0.5">{finalRender}</h3>;
      }

      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        return <li key={ix} className="ml-4 list-disc text-slate-600 text-xs py-0.5">{finalRender}</li>;
      }

      return <p key={ix} className="text-slate-600 text-xs leading-relaxed mb-1.5">{finalRender || '\u00A0'}</p>;
    });
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
          {actions && <div onClick={e => e.stopPropagation()}>{actions}</div>}
        </div>
        {isExpanded && (
          <div className="px-3 pb-3 bg-[#f3f4f6]">
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div id="inspector_panel" className="flex flex-col select-none bg-[#f3f4f6] h-full overflow-y-auto pb-8">
      
      {/* Node Identity Display */}
      <div className="p-3 bg-blue-50/50 border-b border-slate-200 flex flex-col gap-1.5 relative">
        {onClose && (
          <button 
            onClick={onClose}
            className="absolute top-2 right-2 p-1.5 hover:bg-blue-100 text-blue-400 hover:text-blue-700 rounded-md transition-colors z-10"
            title="Close panel"
          >
            <X size={16} />
          </button>
        )}
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex justify-between pr-6">
          <span>Selected Node</span>
          <span className="font-mono text-slate-400">ID: {selectedNode.id}</span>
        </label>
        <div className="relative">
          <Type size={14} className="absolute left-3 top-2 text-slate-400" />
          <input 
            type="text" 
            value={selectedNode.text}
            onChange={handleTextChange}
            placeholder="Edit text..."
            className="w-full bg-white border border-slate-300 focus:border-blue-500 rounded px-8 py-1.5 text-xs text-slate-800 font-semibold focus:shadow-sm outline-none"
          />
        </div>
      </div>

      <div className="flex flex-col shrink-0">
        
        {/* Style & Shape */}
        <AccordionSection title="Style & Shape">
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            {COMPACT_SHAPES.map((shape) => (
              <button
                key={shape.value}
                onClick={() => handleShapeSelect(shape.value)}
                className={`py-1.5 px-2 text-[11px] border rounded transition-all shadow-sm ${
                  selectedNode.shape === shape.value
                    ? 'bg-blue-50 border-blue-400 text-blue-700 font-bold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {shape.label}
              </button>
            ))}
          </div>
        </AccordionSection>

        {/* Colors */}
        <AccordionSection title="Colors">
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            {COMPACT_PALETTES.map((color, idx) => {
              const isSelected = selectedNode.color?.background === color.background && selectedNode.color?.text === color.text;
              const isTransparent = color.background === 'transparent';
              return (
                <button
                  key={idx}
                  onClick={() => handleColorSelect(color)}
                  style={{ 
                    backgroundColor: isTransparent ? '#ffffff' : color.background,
                    color: color.text,
                    borderColor: isTransparent ? '#cbd5e1' : color.border
                  }}
                  className={`h-9 border text-[10px] rounded flex flex-col items-center justify-center shadow-sm active:scale-95 transition-all ${
                    isSelected 
                      ? 'ring-2 ring-blue-500 font-bold scale-[1.03]' 
                      : 'opacity-90 hover:opacity-100'
                  }`}
                >
                  <span className="truncate px-1 font-mono">{color.name}</span>
                </button>
              );
            })}
          </div>
        </AccordionSection>

        {/* Badges & Status */}
        <AccordionSection title="Badges & Status">
          <div className="flex flex-col gap-3 pt-1">
            <div className="flex flex-wrap gap-1.5">
              {SIMPLE_ICONS.map((emojiSym) => {
                const hasIt = selectedNode.icon === emojiSym;
                return (
                  <button
                    key={emojiSym}
                    onClick={() => handleToggleIcon(emojiSym)}
                    className={`text-sm h-7 w-7 rounded border flex items-center justify-center transition-all ${
                      hasIt 
                        ? 'border-blue-400 bg-blue-50 shadow-sm' 
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    {emojiSym}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-1.5">
              {(['high', 'medium', 'low', 'none'] as const).map((p) => {
                const isChecked = (selectedNode.priority || 'none') === p;
                let colorClass = 'text-slate-600 bg-white border-slate-200';
                if (p === 'high') colorClass = isChecked ? 'bg-rose-500 text-white border-rose-600 font-bold' : 'text-rose-600 bg-rose-50 border-rose-200 hover:bg-rose-100';
                if (p === 'medium') colorClass = isChecked ? 'bg-amber-500 text-white border-amber-600 font-bold' : 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100';
                if (p === 'low') colorClass = isChecked ? 'bg-sky-500 text-white border-sky-600 font-bold' : 'text-sky-600 bg-sky-50 border-sky-200 hover:bg-sky-100';
                if (p === 'none') colorClass = isChecked ? 'bg-slate-500 text-white border-slate-600 font-bold' : 'text-slate-500 bg-white hover:bg-slate-50';
                
                return (
                  <button
                    key={p}
                    onClick={() => handlePrioritySelect(p)}
                    className={`flex-1 py-1 text-[10px] capitalize border rounded transition-all shadow-sm ${colorClass}`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {([0, 25, 50, 75, 100] as const).map((val) => {
                const isChecked = selectedNode.complete === val;
                return (
                  <button
                    key={val}
                    onClick={() => handleCompleteSelect(val)}
                    className={`py-1 text-center font-bold text-[10px] border rounded transition-all shadow-sm ${
                      isChecked 
                        ? 'border-emerald-600 bg-emerald-500 text-white' 
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {val}%
                  </button>
                );
              })}
            </div>
            {selectedNode.complete !== null && selectedNode.complete !== undefined && (
              <button 
                onClick={() => handleCompleteSelect(null)}
                className="text-left text-[10px] text-slate-400 hover:text-red-500 transition-colors"
              >
                Clear progress
              </button>
            )}
          </div>
        </AccordionSection>

        {/* Layout */}
        <AccordionSection title="Layout">
          <div className="flex flex-col gap-3 pt-1">
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { value: 'curve', label: 'Bezier Curve' },
                { value: 'line', label: 'Straight Solid' },
                { value: 'dot', label: 'Dotted Link' },
                { value: 'arrow', label: 'Arrow Path' },
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => onUpdateNode(selectedNode.id, { connectionLineType: item.value as any })}
                  className={`py-1.5 px-2 text-[10px] border rounded transition-all shadow-sm ${
                    (selectedNode.connectionLineType || 'curve') === item.value
                      ? 'bg-purple-50 border-purple-400 text-purple-700 font-bold'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {(selectedNode.shape === 'block' || selectedNode.type === 'block' || selectedNode.type === 'label' || selectedNode.shape === 'rect' || selectedNode.shape === 'rounded') && (
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Width:</span>
                  <span className="font-mono text-slate-700 font-bold">{selectedNode.width ?? (selectedNode.type === 'block' ? 350 : 150)}px</span>
                </div>
                <input 
                  type="range"
                  min="60"
                  max="900"
                  step="10"
                  value={selectedNode.width ?? (selectedNode.type === 'block' ? 350 : 150)}
                  onChange={(e) => onUpdateNode(selectedNode.id, { width: parseInt(e.target.value) })}
                  className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>Height:</span>
                  <span className="font-mono text-slate-700 font-bold">{selectedNode.height ?? (selectedNode.type === 'block' ? 250 : 40)}px</span>
                </div>
                <input 
                  type="range"
                  min="30"
                  max="800"
                  step="10"
                  value={selectedNode.height ?? (selectedNode.type === 'block' ? 250 : 40)}
                  onChange={(e) => onUpdateNode(selectedNode.id, { height: parseInt(e.target.value) })}
                  className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            )}
          </div>
        </AccordionSection>

        {/* Notes & Details */}
        <AccordionSection title="Notes & Details">
          <div className="flex flex-col gap-3 pt-1">
            <div className="relative">
              <Link size={13} className="absolute left-2.5 top-2 text-slate-400" />
              <input 
                type="text"
                placeholder="https://example.com"
                value={selectedNode.hyperlink || ''}
                onChange={(e) => onUpdateNode(selectedNode.id, { hyperlink: e.target.value })}
                className="w-full bg-white border border-slate-200 focus:border-blue-400 rounded pl-8 pr-2 py-1.5 text-xs text-slate-700 outline-none shadow-sm"
              />
            </div>

            <form onSubmit={handleAddTag} className="flex gap-1.5">
              <input 
                type="text"
                placeholder="Add a tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                className="flex-1 bg-white border border-slate-200 focus:border-blue-400 rounded px-2 py-1.5 text-[11px] text-slate-700 outline-none shadow-sm"
              />
              <button 
                type="submit"
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 rounded text-[11px] font-bold transition-colors"
              >
                Add
              </button>
            </form>

            {selectedNode.tags && selectedNode.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedNode.tags.map((t) => (
                  <span 
                    key={t} 
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white border border-slate-300 text-slate-600 rounded text-[9px] font-bold font-mono"
                  >
                    #{t}
                    <button 
                      onClick={() => handleRemoveTag(t)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex justify-between items-center mt-2">
              <span className="text-xs font-bold text-slate-700">Markdown Note</span>
              <button
                onClick={() => setNotePreviewMode(!notePreviewMode)}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-700"
              >
                {notePreviewMode ? 'Write Mode' : 'Preview MD'}
              </button>
            </div>
            
            {notePreviewMode ? (
              <div className="w-full min-h-[120px] bg-white border border-slate-200 rounded p-2 overflow-y-auto select-text prose prose-sm max-h-[250px] shadow-sm">
                {renderSimpleMarkdown(noteText)}
              </div>
            ) : (
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onBlur={handleSaveNotes}
                placeholder="Write rich markdown notes..."
                className="w-full min-h-[120px] bg-white border border-slate-200 text-xs focus:border-blue-400 rounded p-2 outline-none resize-y font-mono shadow-sm"
              />
            )}
            {!notePreviewMode && (
              <button
                onClick={handleSaveNotes}
                className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold py-1.5 rounded transition-colors"
              >
                Save Note
              </button>
            )}
          </div>
        </AccordionSection>

        {/* Danger Zone */}
        {onDeleteNode && selectedNode.type !== 'root' && (
          <div className="p-3 mt-4">
            <button
              onClick={() => {
                if (confirm(`Are you sure you want to delete "${selectedNode.text}" and its branches?`)) {
                  onDeleteNode(selectedNode.id);
                }
              }}
              className="w-full flex justify-center items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-[11px] font-bold py-2 rounded shadow-sm transition-colors"
            >
              <Trash2 size={13} /> Delete Node
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
