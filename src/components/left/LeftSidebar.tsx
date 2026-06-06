/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Folder, File, Plus, Trash2, Search, ArrowRight, 
  Settings, FolderPlus, Info, Upload, Download, KeyRound, AlertCircle, Sparkles, X
} from 'lucide-react';
import { LocalVault, VaultFile, MindMapData } from '../../types';
import { 
  getVaultsList, saveVaultsList, getVirtualFiles, readVirtualFile, 
  deleteVirtualFile, writeVirtualFile, scanNativeDirectory
} from '../../utils/vaultStore';

interface VaultSidebarProps {
  activeVault: LocalVault;
  files: VaultFile[];
  activeFile: string | null;
  onSelectFile: (fileName: string) => void;
  onSelectVault: (vault: LocalVault) => void;
  onCreateFile: (name: string) => void;
  onDeleteFile: (name: string) => void;
  onImportFile: (file: File) => void;
  nativeDirHandle: FileSystemDirectoryHandle | null;
  onSelectNativeDirectory: () => void;
  allVirtualMaps: Record<string, MindMapData>; // Pre-cached for search
  onClose?: () => void;
}

export default function LeftSidebar({
  activeVault,
  files,
  activeFile,
  onSelectFile,
  onSelectVault,
  onCreateFile,
  onDeleteFile,
  onImportFile,
  nativeDirHandle,
  onSelectNativeDirectory,
  allVirtualMaps,
  onClose
}: VaultSidebarProps) {
  const [vaults, setVaults] = useState<LocalVault[]>([]);
  const [showNewVault, setShowNewVault] = useState(false);
  const [newVaultName, setNewVaultName] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ fileName: string; nodeId: string; nodeText: string }[]>([]);

  useEffect(() => {
    setVaults(getVaultsList());
  }, []);

  // Update search results
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results: typeof searchResults = [];

    // Search inside the current cached files
    Object.keys(allVirtualMaps).forEach((fileName) => {
      const map = allVirtualMaps[fileName];
      if (!map?.nodes) return;

      Object.keys(map.nodes).forEach((nodeId) => {
        const node = map.nodes[nodeId];
        const matchText = node.text?.toLowerCase() || '';
        const matchNotes = node.notes?.toLowerCase() || '';
        const matchTags = (node.tags || []).join(' ').toLowerCase();

        if (matchText.includes(query) || matchNotes.includes(query) || matchTags.includes(query)) {
          results.push({
            fileName,
            nodeId,
            nodeText: node.text
          });
        }
      });
    });

    setSearchResults(results);
  }, [searchQuery, allVirtualMaps]);

  const handleCreateVault = () => {
    if (!newVaultName.trim()) return;
    const newVault: LocalVault = {
      id: 'virtual_' + Math.random().toString(36).substr(2, 9),
      name: newVaultName,
      type: 'virtual'
    };
    const updated = [...vaults, newVault];
    setVaults(updated);
    saveVaultsList(updated);
    setNewVaultName('');
    setShowNewVault(false);
    onSelectVault(newVault);
  };

  const handleCreateFileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    let finalName = newFileName.trim();
    if (!finalName.endsWith('.json')) {
      finalName += '.json';
    }
    onCreateFile(finalName);
    setNewFileName('');
  };

  const handleImportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportFile(file);
    }
  };

  return (
    <div id="sidebar_container" className="absolute md:relative inset-y-0 left-0 w-72 md:w-80 h-full bg-[#f3f4f6] border-r border-slate-200 text-slate-800 flex flex-col select-none shadow-2xl md:shadow-none z-50 animate-in slide-in-from-left duration-205">
      
      {/* Header matching RightProperties */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-white shrink-0 shadow-sm z-20 sticky top-0">
        <span className="font-bold text-sm text-slate-700">Left Sidebar</span>
        {onClose && (
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-md transition-colors"
            title="Close panel"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="flex flex-col overflow-y-auto pb-8 relative">
      {/* Vault Picker Section */}
      <div id="vault_picker_header" className="p-4 border-b border-slate-200 flex flex-col gap-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Vault Sandbox</label>
        <div className="flex gap-2 items-center">
          <select 
            id="vault_select"
            value={activeVault.id}
            onChange={(e) => {
              const selected = vaults.find((v) => v.id === e.target.value);
              if (selected) onSelectVault(selected);
            }}
            className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
          >
            {vaults.map((vault) => (
              <option key={vault.id} value={vault.id}>
                {vault.type === 'native' ? '📂 ' : '☁️ '} {vault.name}
              </option>
            ))}
          </select>
          <button 
            id="btn_add_vault"
            onClick={() => setShowNewVault(!showNewVault)}
            title="Create Virtual Vault"
            className="p-1.5 bg-slate-50 hover:bg-slate-700 border border-slate-200 rounded-md text-slate-500 hover:text-slate-800 transition-colors"
          >
            <FolderPlus size={16} />
          </button>
        </div>

        {/* Create Virtual Vault Field */}
        {showNewVault && (
          <div id="new_vault_form" className="bg-white p-3 rounded-md border border-slate-200 flex flex-col gap-2 mt-1">
            <span className="text-xs text-slate-500">Add a Virtual Cloud Vault:</span>
            <div className="flex gap-2">
              <input 
                type="text"
                placeholder="Vault Name..."
                value={newVaultName}
                onChange={(e) => setNewVaultName(e.target.value)}
                className="flex-1 bg-slate-50 text-xs text-slate-800 border border-slate-200 rounded px-2 py-1 outline-none"
              />
              <button 
                onClick={handleCreateVault}
                className="bg-blue-600 hover:bg-blue-500 text-slate-800 text-xs px-2.5 py-1 rounded font-medium"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {/* Real Hard Drive Vault Picker Trigger */}
        <button
          id="btn_select_native_vault"
          onClick={onSelectNativeDirectory}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-slate-800 font-medium text-xs py-2 px-3 rounded-md shadow-md transition-all group duration-200"
        >
          <Folder size={14} className="group-hover:scale-110 transition-transform" />
          Open Computer Folder as Vault
        </button>

        {/* Status indicator */}
        <div className="flex items-center gap-1.5 px-1 py-0.5 mt-1">
          <div className={`h-2 w-2 rounded-full ${activeVault.type === 'native' ? 'bg-emerald-500 animate-pulse' : 'bg-blue-400'}`}></div>
          <span className="text-[11px] text-slate-500 font-medium font-mono">
            {activeVault.type === 'native' ? 'Local Drive Sync (Obsidian Mode)' : 'Sandbox Storage (In-Browser)'}
          </span>
        </div>
      </div>

      {/* Global Mind Map Nodes Search */}
      <div id="sidebar_search_container" className="p-4 border-b border-slate-200">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">Vault Search</label>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
          <input 
            type="text"
            placeholder="Search words across all maps..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-md pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-500 outline-none"
          />
        </div>
        
        {/* Real-time search result listing */}
        {searchResults.length > 0 && (
          <div id="search_results_bubble" className="mt-2 text-xs bg-white p-2 rounded-md border border-slate-200 max-h-40 overflow-y-auto divide-y divide-slate-900">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold block pb-1">Found ({searchResults.length}) matches:</span>
            {searchResults.map((res, i) => (
              <div 
                key={i} 
                className="py-1 cursor-pointer hover:bg-white flex items-center justify-between text-slate-800"
                onClick={() => {
                  onSelectFile(res.fileName);
                  // Global key binding should highlight this node on canvas. We pass coordinates or node selectors
                  setSearchQuery('');
                  // Focus the specific canvas element
                  setTimeout(() => {
                    const canvasEl = document.getElementById(`node_${res.nodeId}`);
                    if (canvasEl) {
                      canvasEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      canvasEl.classList.add('ring-4', 'ring-purple-500');
                      setTimeout(() => canvasEl.classList.remove('ring-4', 'ring-purple-500'), 3000);
                    }
                  }, 200);
                }}
              >
                <div className="truncate pr-2">
                  <p className="font-semibold text-slate-200 truncate">{res.nodeText || "(Blank node)"}</p>
                  <p className="text-[10px] text-slate-500 truncate italic">in {res.fileName}</p>
                </div>
                <ArrowRight size={10} className="text-blue-500 shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* File Lister & Creation UI */}
      <div id="vault_files_container" className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        <div id="files_header" className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-slate-500">
          <span>Mind Map Vault Files</span>
          <span className="font-mono text-[10px] text-slate-600">({files.length} JSON)</span>
        </div>

        {/* Inline file creator input form */}
        <form onSubmit={handleCreateFileSubmit} className="flex gap-2">
          <input 
            type="text"
            placeholder="New map name (e.g. Brainstorm)..."
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            className="flex-1 bg-slate-50 text-xs text-slate-800 border border-slate-200 rounded-md px-2.5 py-1.5 focus:border-blue-500 outline-none placeholder-slate-500"
          />
          <button 
            type="submit"
            title="Create New Map file"
            className="p-1 px-2.5 bg-blue-700 hover:bg-blue-600 hover:text-slate-800 border border-blue-800 rounded-md text-slate-800 font-medium text-xs transition-colors"
          >
            <Plus size={16} />
          </button>
        </form>

        {/* Existing Vault Files Tree / List */}
        <div id="vault_files_list" className="flex flex-col gap-1.5 mt-1">
          {files.length === 0 ? (
            <div className="py-8 text-center bg-white/20 rounded-md border border-dashed border-slate-200 text-slate-600 text-xs">
              No .json files found. Add one above!
            </div>
          ) : (
            files.map((file) => {
              const worksAsActive = activeFile === file.name;
              return (
                <div 
                  key={file.path} 
                  className={`group flex justify-between items-center px-3 py-2 rounded-md border cursor-pointer select-none transition-all duration-150 ${
                    worksAsActive 
                      ? 'bg-slate-50 border-indigo-500/50 text-slate-800 shadow' 
                      : 'bg-white/40 border-slate-200/80 hover:bg-slate-50/60 hover:text-slate-800 text-slate-500'
                  }`}
                  onClick={() => onSelectFile(file.name)}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <File size={13} className={worksAsActive ? 'text-indigo-400' : 'text-slate-500'} />
                    <span className="text-xs truncate font-medium font-mono">{file.name}</span>
                  </div>
                  
                  {/* File controls: Delete */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Are you sure you want to delete ${file.name}?`)) {
                        onDeleteFile(file.name);
                      }
                    }}
                    title="Delete File"
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 hover:bg-white rounded-md transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer System Integrations & import trigger */}
      <div id="sidebar_footer" className="p-4 border-t border-slate-200 bg-white/60 flex flex-col gap-3 text-xs">
        <div className="flex justify-between items-center">
          <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Import Map</span>
          <label className="flex items-center gap-1 text-[11px] underline text-blue-400 hover:text-blue-300 cursor-pointer">
            <Upload size={10} /> Load File
            <input 
              type="file" 
              accept=".json" 
              className="hidden" 
              onChange={handleImportChange} 
            />
          </label>
        </div>

        {/* Tutorial Banner */}
        <div className="bg-white/60 p-3 rounded-lg border border-slate-200 text-[11px] text-slate-500 leading-relaxed flex gap-2">
          <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
          <div>
            <span className="text-slate-800 font-medium block mb-0.5">XMind Obsidian Experience:</span>
            Double-click a node to edit. Use <span className="font-mono text-slate-800 bg-slate-50 px-1 py-0.5 rounded">Tab</span> to expand child topics. Changes save instantly!
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
