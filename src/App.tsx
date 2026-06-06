/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Sparkles, Undo2, Redo2, FileDown, GitFork, Keyboard, 
  HelpCircle, Compass, FolderClosed, RefreshCw, AlertCircle, FileText, Split, Sparkle, Globe, Layout, ChevronDown, Palette
} from 'lucide-react';
import { 
  MindMapData, MindMapNode, LocalVault, VaultFile, SubtopicSummary, Relationship, NodeShape 
} from './types';
import { calculateNodePositions } from './utils/layout';
import { 
  getVaultsList, getActiveVaultId, setActiveVaultId, getVirtualFiles,
  readVirtualFile, writeVirtualFile, deleteVirtualFile, createDefaultMap,
  scanNativeDirectory, readNativeFile, writeNativeFile, deleteNativeFile,
  saveVaultsList
} from './utils/vaultStore';

// Components imports
import LeftSidebar from './components/left/LeftSidebar';
import RightProperties from './components/right/RightProperties';
import MindmapCanvas from './components/MindmapCanvas';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';

export default function App() {
  // Storage Vault Selection
  const [activeVault, setActiveVault] = useState<LocalVault>({ id: 'virtual_default', name: 'My Local Vault', type: 'virtual' });
  const [nativeDirHandle, setNativeDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  
  // Files in vault
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [activeFileName, setActiveFileName] = useState<string | null>(null);
  
  // Cache of all parsed maps in active vault (for search)
  const [allVirtualMaps, setAllVirtualMaps] = useState<Record<string, MindMapData>>({});

  // Active Mind Map data state
  const [mapData, setMapData] = useState<MindMapData | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [linkingModeSource, setLinkingModeSource] = useState<string | null>(null);

  // Undo/Redo historical stacks
  const [undoStack, setUndoStack] = useState<MindMapData[]>([]);
  const [redoStack, setRedoStack] = useState<MindMapData[]>([]);

  // Page interactive loaders
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Persistent collapsible sidebars (default to false if not set so they start closed)
  const [leftSidebarOpen, setLeftSidebarOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('leftSidebarOpen');
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const [rightSidebarOpen, setRightSidebarOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('rightSidebarOpen');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const handleToggleLeftSidebar = () => {
    setLeftSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem('leftSidebarOpen', JSON.stringify(next));
      return next;
    });
  };

  const handleToggleRightSidebar = () => {
    setRightSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem('rightSidebarOpen', JSON.stringify(next));
      return next;
    });
  };

  // Drag & drop clickable floating creator elements (for template labels and block frames)
  const handleDropNewNode = (shape: NodeShape, x: number, y: number) => {
    if (!mapData) return;

    const newId = 'node_fl_' + Math.random().toString(36).substr(2, 9);
    
    const isBlock = shape === 'block';
    const isLabel = shape === 'label';
    const isUnderline = shape === 'underline';
    const isTextOnly = shape === 'borderless';

    let text = 'Floating Topic';
    if (isBlock) text = 'Container Group Board';
    if (isLabel) text = 'Floating Label Title';
    if (isUnderline) text = 'Underlined Notes';
    if (isTextOnly) text = 'Text Annotation';

    const newNode: MindMapNode = {
      id: newId,
      text: text,
      type: isLabel ? 'label' : isBlock ? 'block' : 'floating',
      shape: shape,
      x: x,
      y: y,
      notes: isBlock ? '📦 Double-click label to rename. Place your nodes around. Adjust slider dimension properties in inspector.' : isLabel ? '📝 Floating text label annotation.' : '',
      width: isBlock ? 440 : isLabel ? 200 : undefined,
      height: isBlock ? 320 : isLabel ? 45 : undefined,
    };

    const updatedNodes = {
      ...mapData.nodes,
      [newId]: newNode
    };

    updateMapState({
      ...mapData,
      nodes: updatedNodes,
      lastModified: new Date().toISOString()
    });

    setSelectedNodeId(newId);
  };

  // Initial Vault mounting
  useEffect(() => {
    const list = getVaultsList();
    const activeId = getActiveVaultId();
    const found = list.find((v) => v.id === activeId) || list[0] || { id: 'virtual_default', name: 'My Local Vault', type: 'virtual' };
    
    setActiveVault(found);
    loadVaultFiles(found, null);
  }, []);

  // Sync cache search indices whenever active file or files count changes
  useEffect(() => {
    if (activeVault.type === 'virtual') {
      const cache: Record<string, MindMapData> = {};
      files.forEach((file) => {
        try {
          cache[file.name] = readVirtualFile(activeVault.id, file.name);
        } catch {}
      });
      setAllVirtualMaps(cache);
    }
  }, [files, activeVault]);

  // Load files in the chosen Vault
  const loadVaultFiles = async (vault: LocalVault, dirHandleOverride: FileSystemDirectoryHandle | null) => {
    const handle = dirHandleOverride || nativeDirHandle;
    
    if (vault.type === 'native' && handle) {
      try {
        const fileTree = await scanNativeDirectory(handle);
        setFiles(fileTree);
        
        // Auto-load first file if available
        if (fileTree.length > 0) {
          const firstFile = fileTree[0].name;
          setActiveFileName(firstFile);
          await loadMapDetails(vault, firstFile, handle);
        } else {
          setMapData(null);
          setActiveFileName(null);
        }
      } catch (err) {
        console.error("Error reading native directory:", err);
        alert("Permission denied or access lost to your chosen folder. Please open the folder again to restore Obsidian Sync!");
        
        // Relapse to virtual vault
        const fallbackVault: LocalVault = { id: 'virtual_default', name: 'My Local Vault', type: 'virtual' };
        setActiveVault(fallbackVault);
        setActiveVaultId(fallbackVault.id);
        loadVaultFiles(fallbackVault, null);
      }
    } else {
      // Virtual LocalStorage Files
      const virtualList = getVirtualFiles(vault.id);
      setFiles(virtualList);
      
      if (virtualList.length > 0) {
        const firstFile = virtualList[0].name;
        setActiveFileName(firstFile);
        const map = readVirtualFile(vault.id, firstFile);
        setMapData(map);
        setSelectedNodeId(null);
        setUndoStack([]);
        setRedoStack([]);
      } else {
        setMapData(null);
        setActiveFileName(null);
      }
    }
  };

  // Switch vault selection
  const handleSelectVault = (vault: LocalVault) => {
    setActiveVault(vault);
    setActiveVaultId(vault.id);
    if (vault.type === 'virtual') {
      setNativeDirHandle(null);
      loadVaultFiles(vault, null);
    }
  };

  // Open directory picker for computer access (Obsidian mode!)
  const handleSelectNativeDirectory = async () => {
    if (!(window as any).showDirectoryPicker) {
      alert("Your browser does not support local directory access hubs. Please use Chrome, Edge, or Opera, or continue using the Sandbox browser storage which is fully functional!");
      return;
    }
    
    try {
      const handle = await (window as any).showDirectoryPicker({
        mode: 'readwrite'
      });
      
      const newVault: LocalVault = {
        id: 'native_' + Math.random().toString(36).substr(2, 9),
        name: handle.name,
        type: 'native'
      };

      setNativeDirHandle(handle);
      setActiveVault(newVault);
      
      const vaults = getVaultsList();
      const updated = [...vaults, newVault];
      saveVaultsList(updated);
      setActiveVaultId(newVault.id);
      
      await loadVaultFiles(newVault, handle);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error("Native directory error:", err);
      }
    }
  };

  // Load concrete mind map contents
  const loadMapDetails = async (vault: LocalVault, fileName: string, dirHandle: FileSystemDirectoryHandle | null) => {
    try {
      if (vault.type === 'native' && dirHandle) {
        const rawContent = await readNativeFile(dirHandle, fileName);
        const parsed: MindMapData = JSON.parse(rawContent);
        setMapData(parsed);
      } else {
        const parsed = readVirtualFile(vault.id, fileName);
        setMapData(parsed);
      }
      setSelectedNodeId(null);
      setUndoStack([]);
      setRedoStack([]);
    } catch (err) {
      console.error("Error parsing maps:", err);
      // Fallback
      const map = createDefaultMap(fileName.replace('.json', ''), fileName.replace('.json', ''));
      setMapData(map);
    }
  };

  // Trigger file selection
  const handleSelectFile = async (name: string) => {
    setActiveFileName(name);
    await loadMapDetails(activeVault, name, nativeDirHandle);
  };

  // Track map status mutations to implement instant saving and history tracking
  const updateMapState = (newMap: MindMapData, skipHistory = false) => {
    if (!mapData) return;
    
    if (!skipHistory) {
      setUndoStack((prev) => [...prev, mapData]);
      setRedoStack([]); // Resets future redo on new edits
    }

    setMapData(newMap);
    
    // Save to Disk (Native Filesystem or Virtual localStorage)
    if (activeFileName) {
      if (activeVault.type === 'native' && nativeDirHandle) {
        writeNativeFile(nativeDirHandle, activeFileName, JSON.stringify(newMap, null, 2)).catch((err) => {
          console.error("Failed auto-saving to local computer disk:", err);
        });
      } else {
        writeVirtualFile(activeVault.id, activeFileName, newMap);
      }
    }
  };

  // History: Undo
  const handleUndo = () => {
    if (undoStack.length === 0 || !mapData) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, prev.length - 1));
    setRedoStack((prev) => [...prev, mapData]);
    setMapData(previous);
    
    // Write back changes silently
    if (activeFileName) {
      if (activeVault.type === 'native' && nativeDirHandle) {
        writeNativeFile(nativeDirHandle, activeFileName, JSON.stringify(previous, null, 2)).catch(console.error);
      } else {
        writeVirtualFile(activeVault.id, activeFileName, previous);
      }
    }
  };

  // History: Redo
  const handleRedo = () => {
    if (redoStack.length === 0 || !mapData) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, prev.length - 1));
    setUndoStack((prev) => [...prev, mapData]);
    setMapData(next);
    
    // Write back changes silently
    if (activeFileName) {
      if (activeVault.type === 'native' && nativeDirHandle) {
        writeNativeFile(nativeDirHandle, activeFileName, JSON.stringify(next, null, 2)).catch(console.error);
      } else {
        writeVirtualFile(activeVault.id, activeFileName, next);
      }
    }
  };

  // File CRUD: Create file
  const handleCreateFile = async (name: string) => {
    const finalMap = createDefaultMap(name.replace('.json', ''), name.replace('.json', ''));
    
    if (activeVault.type === 'native' && nativeDirHandle) {
      await writeNativeFile(nativeDirHandle, name, JSON.stringify(finalMap, null, 2));
      const list = await scanNativeDirectory(nativeDirHandle);
      setFiles(list);
    } else {
      writeVirtualFile(activeVault.id, name, finalMap);
      setFiles(getVirtualFiles(activeVault.id));
    }
    
    setActiveFileName(name);
    setMapData(finalMap);
    setSelectedNodeId(null);
    setUndoStack([]);
    setRedoStack([]);
  };

  // File CRUD: Delete file
  const handleDeleteFile = async (name: string) => {
    if (activeVault.type === 'native' && nativeDirHandle) {
      await deleteNativeFile(nativeDirHandle, name);
      const list = await scanNativeDirectory(nativeDirHandle);
      setFiles(list);
    } else {
      deleteVirtualFile(activeVault.id, name);
      setFiles(getVirtualFiles(activeVault.id));
    }
    
    if (activeFileName === name) {
      setMapData(null);
      setActiveFileName(null);
    }
  };

  // File CRUD: Import file
  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed: MindMapData = JSON.parse(text);
      if (!parsed.nodes) {
        throw new Error("Invalid structure");
      }
      const safeName = file.name.endsWith('.json') ? file.name : `${file.name}.json`;
      
      if (activeVault.type === 'native' && nativeDirHandle) {
        await writeNativeFile(nativeDirHandle, safeName, JSON.stringify(parsed, null, 2));
        const list = await scanNativeDirectory(nativeDirHandle);
        setFiles(list);
      } else {
        writeVirtualFile(activeVault.id, safeName, parsed);
        setFiles(getVirtualFiles(activeVault.id));
      }
      
      setActiveFileName(safeName);
      setMapData(parsed);
      setSelectedNodeId(null);
    } catch {
      alert("Failed to parse JSON file structure. Make sure you load a valid XMind Vault .json backup!");
    }
  };

  // Node Editing: Add Child node
  const handleAddChild = (parentId: string, direction?: 'top'|'bottom'|'left'|'right') => {
    if (!mapData) return;
    
    const newId = 'node_' + Math.random().toString(36).substr(2, 9);
    const parent = mapData.nodes[parentId];
    const newType = parent.type === 'root' ? 'main' : 'sub';

    const newNode: MindMapNode = {
      ...parent,
      id: newId,
      parentId,
      type: newType,
    };

    if (mapData.layoutDirection === 'freeform' && direction) {
      const currentPositions = calculateNodePositions(mapData.nodes, mapData.rootNodeId, 'freeform');
      const pPos = currentPositions[parentId] || { x: 0, y: 0 };
      if (direction === 'bottom') {
        newNode.x = pPos.x;
        newNode.y = pPos.y + 100;
      } else if (direction === 'top') {
        newNode.x = pPos.x;
        newNode.y = pPos.y - 100;
      } else if (direction === 'right') {
        newNode.x = pPos.x + 200;
        newNode.y = pPos.y;
      } else if (direction === 'left') {
        newNode.x = pPos.x - 200;
        newNode.y = pPos.y;
      }
    }

    const updatedNodes = {
      ...mapData.nodes,
      [newId]: newNode
    };

    updateMapState({
      ...mapData,
      nodes: updatedNodes,
      lastModified: new Date().toISOString()
    });
    
    // Automatically focus the newly created child node
    setSelectedNodeId(newId);
  };

  // Node Editing: Add Sibling node
  const handleAddSibling = (nodeId: string, direction?: 'top'|'bottom'|'left'|'right') => {
    if (!mapData) return;
    const referenceNode = mapData.nodes[nodeId];
    if (!referenceNode || !referenceNode.parentId) return; // Core Root can't have siblings

    const newId = 'node_' + Math.random().toString(36).substr(2, 9);
    const parentId = referenceNode.parentId;

    const newNode: MindMapNode = {
      ...referenceNode,
      id: newId,
      parentId,
    };

    if (mapData.layoutDirection === 'freeform' && direction) {
      const currentPositions = calculateNodePositions(mapData.nodes, mapData.rootNodeId, 'freeform');
      const pPos = currentPositions[nodeId] || { x: 0, y: 0 };
      if (direction === 'bottom') {
        newNode.x = pPos.x;
        newNode.y = pPos.y + 100;
      } else if (direction === 'top') {
        newNode.x = pPos.x;
        newNode.y = pPos.y - 100;
      } else if (direction === 'right') {
        newNode.x = pPos.x + 200;
        newNode.y = pPos.y;
      } else if (direction === 'left') {
        newNode.x = pPos.x - 200;
        newNode.y = pPos.y;
      }
    }

    const updatedNodes = {
      ...mapData.nodes,
      [newId]: newNode
    };

    updateMapState({
      ...mapData,
      nodes: updatedNodes,
      lastModified: new Date().toISOString()
    });

    setSelectedNodeId(newId);
  };

  // Node Editing: Recursively Delete node and children
  const handleDeleteNode = (nodeId: string) => {
    if (!mapData || nodeId === mapData.rootNodeId) return;

    const nodesToDelete = new Set<string>([nodeId]);
    
    // Helper to find all descendants
    const findDescendants = (pid: string) => {
      Object.keys(mapData.nodes).forEach((id) => {
        if (mapData.nodes[id].parentId === pid) {
          nodesToDelete.add(id);
          findDescendants(id);
        }
      });
    };
    findDescendants(nodeId);

    const updatedNodes = { ...mapData.nodes };
    nodesToDelete.forEach((id) => {
      delete updatedNodes[id];
    });

    // Strip dangling relationships from deleted elements
    const updatedRelationships = mapData.relationships.filter(
      (rel) => !nodesToDelete.has(rel.fromId) && !nodesToDelete.has(rel.toId)
    );

    // Strip dangling summaries
    const updatedSummaries = mapData.summaries.filter(
      (sum) => !nodesToDelete.has(sum.parentId) && sum.nodeIds.every((id) => !nodesToDelete.has(id))
    );

    updateMapState({
      ...mapData,
      nodes: updatedNodes,
      relationships: updatedRelationships,
      summaries: updatedSummaries,
      lastModified: new Date().toISOString()
    });

    setSelectedNodeId(null);
  };

  // Node Editing: Update properties matching specific node
  const handleUpdateNode = (nodeId: string, updates: Partial<MindMapNode>) => {
    if (!mapData) return;
    
    const node = mapData.nodes[nodeId];
    if (!node) return;

    const updatedNodes = {
      ...mapData.nodes,
      [nodeId]: { ...node, ...updates }
    };

    updateMapState({
      ...mapData,
      nodes: updatedNodes,
      lastModified: new Date().toISOString()
    });
  };

  // Node Editing: Add arbitrary relationship cross lines
  const handleAddRelationship = (fromId: string, toId: string, text = "Related") => {
    if (!mapData) return;
    const newRel: Relationship = {
      id: 'rel_' + Math.random().toString(36).substr(2, 9),
      fromId,
      toId,
      text
    };

    updateMapState({
      ...mapData,
      relationships: [...mapData.relationships, newRel],
      lastModified: new Date().toISOString()
    });
  };

  const handleSelectNode = (nodeId: string | null) => {
    if (linkingModeSource && nodeId && linkingModeSource !== nodeId) {
      handleAddRelationship(linkingModeSource, nodeId, "Cross link");
      setLinkingModeSource(null);
    } else {
      setSelectedNodeId(nodeId);
      if (nodeId) setRightSidebarOpen(true);
    }
  };

  // Node Editing: Delete relationship line
  const handleDeleteRelationship = (relId: string) => {
    if (!mapData) return;
    updateMapState({
      ...mapData,
      relationships: mapData.relationships.filter((rel) => rel.id !== relId),
      lastModified: new Date().toISOString()
    });
  };

  // Node Editing: Add sibling nodes summary group bracket
  const handleAddSummary = (parentId: string, nodeIds: string[], text: string) => {
    if (!mapData) return;
    const newSum: SubtopicSummary = {
      id: 'sum_' + Math.random().toString(36).substr(2, 9),
      parentId,
      nodeIds,
      text
    };

    updateMapState({
      ...mapData,
      summaries: [...mapData.summaries, newSum],
      lastModified: new Date().toISOString()
    });
  };

  // Node Editing: Delete summary
  const handleDeleteSummary = (sumId: string) => {
    if (!mapData) return;
    updateMapState({
      ...mapData,
      summaries: mapData.summaries.filter((sum) => sum.id !== sumId),
      lastModified: new Date().toISOString()
    });
  };

  // Reset node offset drags back to auto alignment standard
  const handleReLayoutMap = () => {
    if (!mapData) return;
    
    const updatedNodes = { ...mapData.nodes };
    Object.keys(updatedNodes).forEach((id) => {
      delete updatedNodes[id].offsetX;
      delete updatedNodes[id].offsetY;
    });

    updateMapState({
      ...mapData,
      nodes: updatedNodes,
      lastModified: new Date().toISOString()
    });
  };

  // Compute Layout positions dynamically
  const positionedNodes = useMemo(() => {
    if (!mapData) return {};
    return calculateNodePositions(mapData.nodes, mapData.rootNodeId, mapData.layoutDirection);
  }, [mapData]);

  // Exporters: Export JSON file
  const handleExportJson = () => {
    if (!mapData) return;
    const blob = new Blob([JSON.stringify(mapData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mapData.title || 'MindMap'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Exporters: Export pristine human Markdown bullet lists directly to read with Obsidian!
  const handleExportMarkdown = () => {
    if (!mapData) return;
    
    const root = mapData.nodes[mapData.rootNodeId];
    if (!root) return;

    // Helper map children mapping
    const childrenMap: Record<string, string[]> = {};
    Object.keys(mapData.nodes).forEach((id) => {
      const pid = mapData.nodes[id].parentId;
      if (pid) {
        if (!childrenMap[pid]) childrenMap[pid] = [];
        childrenMap[pid].push(id);
      }
    });

    let mdOutput = `# ${root.text}\n`;
    if (root.notes) {
      mdOutput += `> ${root.notes.replace(/\n/g, '\n> ')}\n\n`;
    }

    const traverse = (nodeId: string, depth: number) => {
      const children = childrenMap[nodeId] || [];
      children.forEach((cid) => {
        const node = mapData.nodes[cid];
        if (!node) return;

        const indent = '  '.repeat(depth - 1);
        
        if (depth === 1) {
          mdOutput += `\n## ${node.text}\n`;
          if (node.notes) mdOutput += `> ${node.notes.replace(/\n/g, '\n> ')}\n`;
          if (node.tags && node.tags.length > 0) {
            mdOutput += `tags: ${node.tags.map(t => `#${t}`).join(' ')}\n`;
          }
        } else {
          let line = `${indent}- ${node.text}`;
          if (node.priority && node.priority !== 'none') {
            line += ` [Priority: ${node.priority.toUpperCase()}]`;
          }
          if (node.complete !== null && node.complete !== undefined) {
            line += ` [Progress: ${node.complete}%]`;
          }
          mdOutput += `${line}\n`;
          
          if (node.notes) {
            mdOutput += `${indent}  > ${node.notes.replace(/\n/g, `\n${indent}  > `)}\n`;
          }
        }

        traverse(cid, depth + 1);
      });
    };

    traverse(mapData.rootNodeId, 1);

    const blob = new Blob([mdOutput], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mapData.title || 'MindMap'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // AI Brainstorming route triggers
  const handleBrainstormWithAI = async (nodeId: string, customPrompt = '') => {
    if (!mapData) return;
    const selectedNode = mapData.nodes[nodeId];
    if (!selectedNode) return;

    setIsAiLoading(true);
    try {
      // Look up parent topic text for contextual reasoning
      const parentTopic = selectedNode.parentId ? mapData.nodes[selectedNode.parentId]?.text : undefined;
      
      // Look up child nodes to prevent duplicate ideas
      const childrenMap = Object.keys(mapData.nodes)
        .filter((id) => mapData.nodes[id].parentId === nodeId)
        .map((id) => mapData.nodes[id].text);

      const response = await fetch('/api/ai/brainstorm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: selectedNode.text,
          parentTopic,
          customPrompt,
          currentSiblings: childrenMap
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Server error');
      }

      const resData = await response.json();
      const suggestions: { text: string; notes?: string; priority?: string }[] = resData.ideas || [];

      if (suggestions.length === 0) {
        alert("Gemini brainstormed perfectly, but didn't output any nested branches. Try submitting again with more description!");
        return;
      }

      // Sift branches in node structures
      const updatedNodes = { ...mapData.nodes };
      
      suggestions.forEach((sugg, idx) => {
        const newId = 'node_' + Math.random().toString(36).substr(2, 9);
        const newType = selectedNode.type === 'root' ? 'main' : 'sub';
        
        updatedNodes[newId] = {
          id: newId,
          parentId: nodeId,
          text: sugg.text || 'Idea',
          type: newType,
          notes: sugg.notes,
          priority: (sugg.priority as any) || 'none',
          shape: 'underline',
          // Space coordinates out slightly to make rendering neat
          offsetX: (idx - (suggestions.length-1)/2) * 5,
          offsetY: 0
        };
      });

      updateMapState({
        ...mapData,
        nodes: updatedNodes,
        lastModified: new Date().toISOString()
      });

    } catch (err: any) {
      console.error("Brainstorm fail:", err);
      alert(`AI Brainstorming error: ${err.message}. Ensure your GEMINI_API_KEY is configured in Secrets.`);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div id="app_frame" className="w-screen h-screen flex text-slate-700 bg-slate-100 overflow-hidden font-sans select-none">
      {/* 1. Left Sidebar Navigation Panel */}
      {leftSidebarOpen && (
        <LeftSidebar 
          activeVault={activeVault}
          files={files}
          activeFile={activeFileName}
          onSelectFile={handleSelectFile}
          onSelectVault={handleSelectVault}
          onCreateFile={handleCreateFile}
          onDeleteFile={handleDeleteFile}
          onImportFile={handleImportFile}
          nativeDirHandle={nativeDirHandle}
          onSelectNativeDirectory={handleSelectNativeDirectory}
          allVirtualMaps={allVirtualMaps}
          onClose={() => setLeftSidebarOpen(false)}
        />
      )}

      {/* Main Canvas Workstation Container */}
      <div id="mindmap_workstation" className="flex-1 h-full flex flex-col min-w-0 bg-slate-50 relative select-none">
        
        {/* Linking Mode Banner */}
        {linkingModeSource && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-blue-600 text-white px-4 py-2 rounded-full font-bold shadow-xl animate-bounce flex items-center gap-2 select-none cursor-pointer" onClick={() => setLinkingModeSource(null)}>
            <AlertCircle size={16} /> Select target node to connect (Click here to cancel)
          </div>
        )}

        {/* Floating Sidebars Toggle overlays */}
        <div className="absolute top-4 left-4 z-50 flex items-center gap-2">
          {/* File Vault burger button */}
          <button
            onClick={handleToggleLeftSidebar}
            className={`p-2.5 rounded-xl border bg-white/95 backdrop-blur-md shadow-md hover:bg-slate-50 transition-all flex items-center justify-center cursor-pointer active:scale-95 ${
              leftSidebarOpen ? 'border-blue-400 text-blue-600 ring-4 ring-blue-500/10' : 'border-slate-200 text-slate-600'
            }`}
            title="Toggle File Vaults (Left Sidebar)"
          >
            <FolderClosed size={16} />
          </button>


        </div>

        {/* Style Inspector panel burger toggler right side */}
        {mapData && (
          <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
            <button
              onClick={handleToggleRightSidebar}
              className={`p-2.5 rounded-xl border bg-white/95 backdrop-blur-md shadow-md hover:bg-slate-50 transition-all flex items-center justify-center cursor-pointer active:scale-95 ${
                rightSidebarOpen ? 'border-pink-400 text-pink-600 ring-4 ring-pink-500/10' : 'border-slate-200 text-slate-600'
              }`}
              title="Toggle Topic Properties Inspector (Right Sidebar)"
            >
              <Palette size={16} />
            </button>
            <button
              onClick={() => setShowShortcuts(true)}
              title="Keyboard Shortcuts Cheatsheet (?)"
              className="p-1 rounded-md border border-slate-200 text-slate-400 hover:text-slate-705 hover:text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
            >
              <Keyboard size={12} />
            </button>
          </div>
        )}

        {/* 2. Interactive Infinite Canvas Work Area or Landing dashboard */}
        {mapData ? (
          <div id="mindmap_workbench" className="flex-1 flex min-w-0 bg-slate-50 select-none overflow-hidden">
            
            {/* Infinite canvas workspace drawing element */}
            <MindmapCanvas 
              mapData={mapData}
              positionedNodes={positionedNodes}
              selectedNodeId={selectedNodeId}
              onSelectNode={handleSelectNode}
              onUpdateNode={handleUpdateNode}
              onAddChild={handleAddChild}
              onAddSibling={handleAddSibling}
              onDeleteNode={handleDeleteNode}
              onAddRelationship={handleAddRelationship}
              onAddSummary={handleAddSummary}
              onDeleteSummary={handleDeleteSummary}
              onDeleteRelationship={handleDeleteRelationship}
              onDropNewNode={handleDropNewNode}
              updateMapState={updateMapState}
            />

            {/* Properties inspector sidebar */}
            <RightProperties
              rightSidebarOpen={rightSidebarOpen}
              setRightSidebarOpen={setRightSidebarOpen}
              mapData={mapData}
              selectedNodeId={selectedNodeId}
              updateMapState={updateMapState}
              handleUndo={handleUndo}
              handleRedo={handleRedo}
              undoStackLength={undoStack.length}
              redoStackLength={redoStack.length}
              handleReLayoutMap={handleReLayoutMap}
              handleExportJson={handleExportJson}
              handleExportMarkdown={handleExportMarkdown}
              handleUpdateNode={handleUpdateNode}
              handleDeleteNode={handleDeleteNode}
            />

          </div>
        ) : (
          /* Empty / Landing Welcome guide dashboard if no maps parsed in active files tree */
          <div id="welcome_blank_dashboard" className="flex-1 bg-slate-50 flex flex-col justify-center items-center p-8 select-none">
            <div className="max-w-md text-center flex flex-col items-center gap-4">
              <div className="h-14 w-14 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl animate-bounce">
                <GitFork size={30} className="rotate-90" />
              </div>
              <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Open a Mind Map to Start</h1>
              <p className="text-xs text-slate-500 leading-relaxed">
                Connect XMind style mind maps together directly on your local computer disk like an Obsidian vault, or use the sandboxed sandbox mode inside the browser!
              </p>
              
              <div className="flex flex-col gap-2 w-full mt-2">
                <button
                  onClick={handleSelectNativeDirectory}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-2.5 px-4 rounded-lg shadow-md transition-all flex items-center justify-center gap-2"
                >
                  📂 Connect Local Computer Folder Sync
                </button>
                <div className="text-[10px] text-slate-400 font-mono">Syncs JSON files straight onto your harddrive!</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Helper Modals */}
      
      {/* Keyboard Shortcuts Overlay and help screen */}
      <KeyboardShortcutsModal 
        isOpen={showShortcuts} 
        onClose={() => setShowShortcuts(false)} 
      />



    </div>
  );
}
