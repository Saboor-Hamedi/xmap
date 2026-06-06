/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Keyboard, ArrowRight } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Tab', desc: 'Add a new child subtopic node under the selector' },
    { key: 'Enter', desc: 'Add a new sibling node next to the selector' },
    { key: 'Space or Double-Click', desc: 'Immediately edit active node text' },
    { key: 'Delete or Backspace', desc: 'Delete the selected node (and its child subtopics recursively)' },
    { key: 'Arrow Keys (↑, ↓, ←, →)', desc: 'Navigate structurally along the mind map hierarchy tree' },
    { key: 'Escape', desc: 'Unselect current node or close helper dialogs' },
    { key: 'Ctrl + Z', desc: 'Undo the last canvas modifications' },
    { key: 'Ctrl + Y', desc: 'Redo the last reverted change list' },
    { key: 'Space + Mouse Drag', desc: 'Pan around the infinite canvas seamlessly' },
    { key: 'Ctrl + Wheel', desc: 'Zoom into specific sectors dynamically' },
  ];

  return (
    <div id="shortcuts_modal_overlay" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[100] p-4 select-none">
      <div id="shortcuts_modal_box" className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-150 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Keyboard size={18} className="text-blue-600" />
            <span className="font-bold text-slate-800 text-sm">Keyboard Shortcuts Cheat Sheet</span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal List */}
        <div className="p-4 overflow-y-auto max-h-[400px] flex flex-col gap-2">
          {shortcuts.map((sh, idx) => (
            <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-b-0 gap-4">
              <span className="text-xs text-slate-600 font-medium leading-relaxed leading-normal">{sh.desc}</span>
              <kbd className="shrink-0 bg-slate-100 border border-slate-300 text-[10px] font-mono font-bold text-slate-700 px-2 py-1 rounded shadow-sm">
                {sh.key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-blue-50/50 border-t border-blue-105 flex items-center gap-2 justify-center text-[11px] text-blue-600 font-medium">
          <span>💡 Dynamic Tip: XMind Vault allows quick conceptual editing without lifting your hands from the keys!</span>
        </div>
      </div>
    </div>
  );
}
