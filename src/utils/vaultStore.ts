/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MindMapData, LocalVault, VaultFile, MindMapNode } from '../types';

const METADATA_KEY = 'xmind_vaults_list';
const ACTIVE_VAULT_KEY = 'xmind_active_vault_id';
const FALLBACK_FILES_PREFIX = 'xmind_virtual_file_';

// Initial Template Mind Map
export const createDefaultMap = (id: string, title: string): MindMapData => {
  const rootId = 'root_' + Math.random().toString(36).substr(2, 9);
  const n1 = 'node_' + Math.random().toString(36).substr(2, 9);
  const n2 = 'node_' + Math.random().toString(36).substr(2, 9);
  const n3 = 'node_' + Math.random().toString(36).substr(2, 9);
  const n4 = 'node_' + Math.random().toString(36).substr(2, 9);
  const n1_1 = 'node_' + Math.random().toString(36).substr(2, 9);
  const n1_2 = 'node_' + Math.random().toString(36).substr(2, 9);
  const n3_1 = 'node_' + Math.random().toString(36).substr(2, 9);
  
  const nodes: Record<string, MindMapNode> = {
    [rootId]: {
      id: rootId,
      text: title || "My First Mind Map 🚀",
      type: 'root',
      shape: 'rounded',
      color: { background: '#2563eb', border: '#1d4ed8', text: '#ffffff' },
      notes: "Welcome to XMind Vault! Double-click this node or any other node to edit its text."
    },
    [n1]: {
      id: n1,
      parentId: rootId,
      text: "Keyboard Workflows ⌨️",
      type: 'main',
      notes: "Supercharge your speed with high-efficiency hotkeys!",
      priority: 'high',
      shape: 'rounded',
      color: { background: '#0284c7', border: '#0369a1', text: '#ffffff' }
    },
    [n1_1]: {
      id: n1_1,
      parentId: n1,
      text: "Press [Tab] for Child subtopics",
      type: 'sub',
      shape: 'underline',
      color: { background: '#e0f2fe', border: '#bae6fd', text: '#0369a1' },
      complete: 100
    },
    [n1_2]: {
      id: n1_2,
      parentId: n1,
      text: "Press [Enter] for Sibling subtopics",
      type: 'sub',
      shape: 'underline',
      color: { background: '#e0f2fe', border: '#bae6fd', text: '#0369a1' },
      complete: 100
    },
    [n2]: {
      id: n2,
      parentId: rootId,
      text: "Canvas Controls 🧭",
      type: 'main',
      notes: "Pan easily around the canvas: hold spacebar + drag, or drag empty space. Zoom using scroll wheel / trackpad.",
      priority: 'medium',
      shape: 'rounded',
      color: { background: '#0d9488', border: '#0f766e', text: '#ffffff' }
    },
    [n3]: {
      id: n3,
      parentId: rootId,
      text: "AI Brainstorming 🧠",
      type: 'main',
      notes: "Leverage Google Gemini model to expand details instantly!",
      priority: 'high',
      shape: 'rounded',
      color: { background: '#7c3aed', border: '#6d28d9', text: '#ffffff' }
    },
    [n3_1]: {
      id: n3_1,
      parentId: n3,
      text: "Click \"AI Spark\" on any node to generate child ideas",
      type: 'sub',
      shape: 'underline',
      color: { background: '#f3e8ff', border: '#e9d5ff', text: '#6d28d9' }
    },
    [n4]: {
      id: n4,
      parentId: rootId,
      text: "Obsidian Local Vaults 🗄️",
      type: 'main',
      notes: "You can open folders directly from your real local computer to save files locally. If file system permissions are blocked on sandboxes, default browser-bound storage ensures your changes are still stored safely.",
      priority: 'high',
      shape: 'rounded',
      color: { background: '#ea580c', border: '#c2410c', text: '#ffffff' }
    },
  };

  return {
    id,
    title,
    rootNodeId: rootId,
    nodes,
    relationships: [],
    summaries: [],
    theme: 'classic',
    layoutDirection: 'freeform',
    lastModified: new Date().toISOString()
  };
};

/**
 * Handles security check for FileSystemDirectoryHandle permissions
 */
async function verifyPermission(handle: any, withWrite: boolean): Promise<boolean> {
  const opts = {
    mode: withWrite ? 'readwrite' : 'read'
  };
  if ((await handle.queryPermission(opts)) === 'granted') {
    return true;
  }
  if ((await handle.requestPermission(opts)) === 'granted') {
    return true;
  }
  return false;
}

/**
 * Recursively scans directory handle to build a file tree list
 */
export async function scanNativeDirectory(
  dirHandle: FileSystemDirectoryHandle,
  currentPath = ""
): Promise<VaultFile[]> {
  const result: VaultFile[] = [];
  
  for await (const entry of (dirHandle as any).values()) {
    const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
    
    if (entry.kind === 'file') {
      if (entry.name.endsWith('.json') || entry.name.endsWith('.md')) {
        result.push({
          name: entry.name,
          path: entryPath,
          type: 'file'
        });
      }
    } else if (entry.kind === 'directory') {
      const subEntries = await scanNativeDirectory(entry as FileSystemDirectoryHandle, entryPath);
      result.push({
        name: entry.name,
        path: entryPath,
        type: 'directory',
        children: subEntries
      });
    }
  }

  // Sort directories first, then files alphabetically
  return result.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Native Directory Helper: Save a file
 */
export async function writeNativeFile(
  dirHandle: FileSystemDirectoryHandle,
  relativeFilePath: string,
  content: string
): Promise<void> {
  const parts = relativeFilePath.split('/');
  let currentDir = dirHandle;
  
  // Resolve folders path recursively
  for (let i = 0; i < parts.length - 1; i++) {
    currentDir = await currentDir.getDirectoryHandle(parts[i], { create: true });
  }
  
  const fileName = parts[parts.length - 1];
  const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

/**
 * Native Directory Helper: Read file content
 */
export async function readNativeFile(
  dirHandle: FileSystemDirectoryHandle,
  relativeFilePath: string
): Promise<string> {
  const parts = relativeFilePath.split('/');
  let currentDir = dirHandle;
  
  for (let i = 0; i < parts.length - 1; i++) {
    currentDir = await currentDir.getDirectoryHandle(parts[i]);
  }
  
  const fileName = parts[parts.length - 1];
  const fileHandle = await currentDir.getFileHandle(fileName);
  const file = await fileHandle.getFile();
  return await file.text();
}

/**
 * Native Directory Helper: Delete file
 */
export async function deleteNativeFile(
  dirHandle: FileSystemDirectoryHandle,
  relativeFilePath: string
): Promise<void> {
  const parts = relativeFilePath.split('/');
  let currentDir = dirHandle;
  
  for (let i = 0; i < parts.length - 1; i++) {
    currentDir = await currentDir.getDirectoryHandle(parts[i]);
  }
  
  const fileName = parts[parts.length - 1];
  await currentDir.removeEntry(fileName);
}

/**
 * Browser LocalStorage Storage Mechanism for Virtual Fallback Vaults
 */
export const getVaultsList = (): LocalVault[] => {
  try {
    const list = localStorage.getItem(METADATA_KEY);
    return list ? JSON.parse(list) : [
      { id: 'virtual_default', name: 'My Local Vault', type: 'virtual' }
    ];
  } catch {
    return [{ id: 'virtual_default', name: 'My Local Vault', type: 'virtual' }];
  }
};

export const saveVaultsList = (list: LocalVault[]): void => {
  localStorage.setItem(METADATA_KEY, JSON.stringify(list));
};

export const getActiveVaultId = (): string => {
  return localStorage.getItem(ACTIVE_VAULT_KEY) || 'virtual_default';
};

export const setActiveVaultId = (id: string): void => {
  localStorage.setItem(ACTIVE_VAULT_KEY, id);
};

// VIRTUAL VAULT SYSTEM: Load file names inside virtual vault
export const getVirtualFiles = (vaultId: string): VaultFile[] => {
  const keys = Object.keys(localStorage);
  const prefix = `${FALLBACK_FILES_PREFIX}${vaultId}_`;
  
  const files: VaultFile[] = [];
  keys.forEach((key) => {
    if (key.startsWith(prefix)) {
      const fileName = key.substring(prefix.length);
      files.push({
        name: fileName,
        path: fileName,
        type: 'file'
      });
    }
  });

  // If empty, preload with a tutorial mind map
  if (files.length === 0) {
    const defaultName = 'Basics & Workflows.json';
    const tutorialMap = createDefaultMap('tutorial', 'XMind Vault Tutorial 🚀');
    localStorage.setItem(`${prefix}${defaultName}`, JSON.stringify(tutorialMap));
    files.push({
      name: defaultName,
      path: defaultName,
      type: 'file'
    });
  }

  return files.sort((a, b) => a.name.localeCompare(b.name));
};

// VIRTUAL VAULT SYSTEM: Get details for file
export const readVirtualFile = (vaultId: string, fileName: string): MindMapData => {
  const key = `${FALLBACK_FILES_PREFIX}${vaultId}_${fileName}`;
  const data = localStorage.getItem(key);
  if (!data) {
    // If it's the requested default map and missing, regenerate
    const map = createDefaultMap(fileName.replace('.json', ''), fileName.replace('.json', ''));
    localStorage.setItem(key, JSON.stringify(map));
    return map;
  }
  return JSON.parse(data);
};

// VIRTUAL VAULT SYSTEM: Write file
export const writeVirtualFile = (vaultId: string, fileName: string, data: MindMapData): void => {
  const key = `${FALLBACK_FILES_PREFIX}${vaultId}_${fileName}`;
  localStorage.setItem(key, JSON.stringify(data));
};

// VIRTUAL VAULT SYSTEM: Delete file
export const deleteVirtualFile = (vaultId: string, fileName: string): void => {
  const key = `${FALLBACK_FILES_PREFIX}${vaultId}_${fileName}`;
  localStorage.removeItem(key);
};
