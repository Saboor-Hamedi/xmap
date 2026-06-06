/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ThemeType = 'classic' | 'warm_wood' | 'cyberpunk' | 'nordic_light' | 'midnight_slate';

export type NodeShape = 
  | 'rect' | 'rounded' | 'circle' | 'ellipse' | 'diamond' | 'hexagon' 
  | 'triangle' | 'parallelogram' | 'cylinder' | 'cloud' | 'document' 
  | 'folder' | 'note' | 'actor' | 'browser' | 'callout' | 'card' 
  | 'block' | 'label' | 'underline' | 'borderless';

export interface NodeColor {
  background: string;
  border: string;
  text: string;
}

export interface MindMapNode {
  id: string;
  text: string;
  parentId?: string; // undefined for central root node
  type: 'root' | 'main' | 'sub' | 'floating' | 'label' | 'block';
  
  // Custom offsets (relative to automatic tree layout coordinates) or absolute coordinates
  // Positive/negative user adjustments when dragging a node manually.
  offsetX?: number;
  offsetY?: number;
  
  // If floating or annotation, these are absolute canvas coordinates
  x?: number;
  y?: number;

  width?: number;  // Optional custom width (e.g. for container blocks)
  height?: number; // Optional custom height (e.g. for container blocks)

  notes?: string; // Markdown notes
  priority?: 'high' | 'medium' | 'low' | 'none';
  complete?: 0 | 25 | 50 | 75 | 100 | null; // Progress percent indicator
  tags?: string[];
  hyperlink?: string;
  icon?: string; // Lucide icon key name
  
  shape?: NodeShape;
  color?: NodeColor;
  connectionLineType?: 'curve' | 'line' | 'dot' | 'arrow'; // Link connection style choices
}

export interface Relationship {
  id: string;
  fromId: string;
  toId: string;
  text?: string;
  color?: string;
  style?: 'solid' | 'dashed' | 'dotted';
}

export interface SubtopicSummary {
  id: string;
  parentId: string; // Parent node ID
  nodeIds: string[]; // List of adjacent sibling node IDs bound in this summary
  text: string; // Summary word/node text
  notes?: string;
  color?: NodeColor;
}

export interface MindMapData {
  id: string;
  title: string;
  rootNodeId: string;
  nodes: Record<string, MindMapNode>;
  relationships: Relationship[];
  summaries: SubtopicSummary[];
  theme: ThemeType;
  layoutDirection: 'horizontal' | 'vertical' | 'balanced' | 'freeform'; // Balanced spreads left/right, horizontal spreads rightward, vertical spreads downward, freeform allows full manual drag-and-drop layout
  lastModified: string;
}

export interface VaultFile {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: VaultFile[];
}

export interface LocalVault {
  id: string;
  name: string;
  path?: string; // Directory picker handle reference or serial if filesystem API
  type: 'native' | 'virtual'; // native is Local Directory Picker, virtual is browser IndexedDB fallback
}
