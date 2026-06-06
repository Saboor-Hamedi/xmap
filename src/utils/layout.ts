/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MindMapNode } from '../types';

export interface PositionedNode {
  id: string;
  x: number;
  y: number;
  side: 'left' | 'right' | 'center';
}

/**
 * Calculates absolute coordinates for each mind map node based on hierarchical layout rules.
 * This handles Horizontal, Vertical, and Balanced (Left/Right) layouts in a clean tree structure.
 */
export function calculateNodePositions(
  nodes: Record<string, MindMapNode>,
  rootId: string,
  layoutDirection: 'horizontal' | 'vertical' | 'balanced' | 'freeform'
): Record<string, PositionedNode> {
  const positions: Record<string, PositionedNode> = {};

  const rootNode = nodes[rootId];
  if (!rootNode) return positions;

  if (layoutDirection === 'freeform') {
    // To prevent infinite recursion, we pass 'balanced' directly which is handled in the else-if/else blocks below.
    const balancedPos = calculateNodePositions(nodes, rootId, 'balanced');
    Object.keys(nodes).forEach((id) => {
      const node = nodes[id];
      positions[id] = {
        id,
        x: node.x !== undefined ? node.x : (balancedPos[id]?.x ?? 0),
        y: node.y !== undefined ? node.y : (balancedPos[id]?.y ?? 0),
        side: 'center'
      };
    });
    return positions;
  }

  // 1. Build children reference mapping
  const childrenMap: Record<string, string[]> = {};
  Object.keys(nodes).forEach((id) => {
    const parentId = nodes[id].parentId;
    if (parentId) {
      if (!childrenMap[parentId]) {
        childrenMap[parentId] = [];
      }
      childrenMap[parentId].push(id);
    }
  });

  // Sort children by original index / creation to keep order consistent
  Object.keys(childrenMap).forEach((parentId) => {
    childrenMap[parentId].sort((a, b) => a.localeCompare(b));
  });

  const hSpacing = 240; // Horizontal distance between levels
  const vSpacing = 55;  // Vertical distance between adjacent topics
  const vNodeHeight = 120; // Vertical spacing for downward trees

  // 2. Measure subtrees recursively (for sizing envelopes)
  const subtreeSizes: Record<string, number> = {};
  
  function measureNode(nodeId: string): number {
    const node = nodes[nodeId];
    const nodeHeight = node ? (node.height || 42) + 20 : vSpacing; // 42 default height + margin
    
    const children = childrenMap[nodeId] || [];
    if (children.length === 0) {
      subtreeSizes[nodeId] = Math.max(vSpacing, nodeHeight);
      return subtreeSizes[nodeId];
    }
    
    let totalSize = 0;
    children.forEach((childId) => {
      totalSize += measureNode(childId);
    });
    
    // Total size of subtree is the sum of children heights or the node's own height, whichever is larger
    subtreeSizes[nodeId] = Math.max(totalSize, Math.max(vSpacing, nodeHeight));
    return subtreeSizes[nodeId];
  }

  // Measure the whole root subtree structure
  measureNode(rootId);

  // Position Root initially at (0, 0)
  positions[rootId] = {
    id: rootId,
    x: 0 + (rootNode.offsetX || 0),
    y: 0 + (rootNode.offsetY || 0),
    side: 'center'
  };

  const rootChildren = childrenMap[rootId] || [];

  if (layoutDirection === 'balanced') {
    // Partition root children alternately to the right and left sides
    const rightChildren: string[] = [];
    const leftChildren: string[] = [];
    
    rootChildren.forEach((childId, index) => {
      if (index % 2 === 0) {
        rightChildren.push(childId);
      } else {
        leftChildren.push(childId);
      }
    });

    // Helper to lay out a horizontal subtree
    // startY is the top-most position of the container bounding area
    function layoutSubtreeHorizontal(
      nodeId: string,
      currentX: number,
      startY: number,
      directionMultiplier: number, // 1 for right, -1 for left
      side: 'left' | 'right'
    ) {
      const children = childrenMap[nodeId] || [];
      const nodeHeight = subtreeSizes[nodeId] || vSpacing;
      
      // Calculate node's centered Y coordinate with respect to its subtree box
      const nodeY = startY + nodeHeight / 2;
      const selfNode = nodes[nodeId];
      
      positions[nodeId] = {
        id: nodeId,
        x: currentX + (selfNode?.offsetX || 0),
        y: nodeY + (selfNode?.offsetY || 0),
        side
      };

      let childYAccumulator = startY;
      children.forEach((childId) => {
        const childNode = nodes[childId];
        const childHeight = subtreeSizes[childId] || vSpacing;
        
        // Push children horizontally if parent is wide
        const parentWidthOffset = (selfNode?.width ? selfNode.width - 155 : 0) / 2;
        // Push child further if child itself is wide (handled by basic hSpacing, but could add childWidth offset)
        const childWidthOffset = (childNode?.width ? childNode.width - 155 : 0) / 2;
        const totalOffsetX = parentWidthOffset + childWidthOffset;

        layoutSubtreeHorizontal(
          childId,
          currentX + (hSpacing + totalOffsetX) * directionMultiplier,
          childYAccumulator,
          directionMultiplier,
          side
        );
        childYAccumulator += childHeight;
      });
    }

    // Lay out Right Side
    let rightTotalHeight = 0;
    rightChildren.forEach((childId) => {
      rightTotalHeight += subtreeSizes[childId] || vSpacing;
    });
    
    let rightYAccumulator = -rightTotalHeight / 2;
    rightChildren.forEach((childId) => {
      const childHeight = subtreeSizes[childId] || vSpacing;
      layoutSubtreeHorizontal(childId, hSpacing, rightYAccumulator, 1, 'right');
      rightYAccumulator += childHeight;
    });

    // Lay out Left Side
    let leftTotalHeight = 0;
    leftChildren.forEach((childId) => {
      leftTotalHeight += subtreeSizes[childId] || vSpacing;
    });

    let leftYAccumulator = -leftTotalHeight / 2;
    leftChildren.forEach((childId) => {
      const childHeight = subtreeSizes[childId] || vSpacing;
      layoutSubtreeHorizontal(childId, -hSpacing, leftYAccumulator, -1, 'left');
      leftYAccumulator += childHeight;
    });

  } else if (layoutDirection === 'horizontal') {
    // All children go to the right
    function layoutSubtreeRight(nodeId: string, currentX: number, startY: number) {
      const children = childrenMap[nodeId] || [];
      const nodeHeight = subtreeSizes[nodeId] || vSpacing;
      const nodeY = startY + nodeHeight / 2;
      const selfNode = nodes[nodeId];

      positions[nodeId] = {
        id: nodeId,
        x: currentX + (selfNode?.offsetX || 0),
        y: nodeY + (selfNode?.offsetY || 0),
        side: 'right'
      };

      let childYAccumulator = startY;
      children.forEach((childId) => {
        const childNode = nodes[childId];
        const childHeight = subtreeSizes[childId] || vSpacing;
        
        const parentWidthOffset = (selfNode?.width ? selfNode.width - 155 : 0) / 2;
        const childWidthOffset = (childNode?.width ? childNode.width - 155 : 0) / 2;
        const totalOffsetX = parentWidthOffset + childWidthOffset;

        layoutSubtreeRight(childId, currentX + hSpacing + totalOffsetX, childYAccumulator);
        childYAccumulator += childHeight;
      });
    }

    let totalHeight = 0;
    rootChildren.forEach((childId) => {
      totalHeight += subtreeSizes[childId] || vSpacing;
    });

    let yAccumulator = -totalHeight / 2;
    rootChildren.forEach((childId) => {
      const childHeight = subtreeSizes[childId] || vSpacing;
      layoutSubtreeRight(childId, hSpacing, yAccumulator);
      yAccumulator += childHeight;
    });

  } else {
    // Vertical Layout (downward expanding trees)
    const hNodeSpacing = 160;
    
    const verticalSubtreeWidths: Record<string, number> = {};
    
    function measureVerticalNode(nodeId: string): number {
      const node = nodes[nodeId];
      const nodeWidth = node ? (node.width || 155) + 30 : hNodeSpacing; // 155 default width + margin
      
      const children = childrenMap[nodeId] || [];
      if (children.length === 0) {
        verticalSubtreeWidths[nodeId] = Math.max(hNodeSpacing, nodeWidth);
        return verticalSubtreeWidths[nodeId];
      }
      
      let totalWidth = 0;
      children.forEach((childId) => {
        totalWidth += measureVerticalNode(childId);
      });
      
      verticalSubtreeWidths[nodeId] = Math.max(totalWidth, Math.max(hNodeSpacing, nodeWidth));
      return verticalSubtreeWidths[nodeId];
    }
    
    measureVerticalNode(rootId);

    function layoutSubtreeVertical(nodeId: string, startX: number, currentY: number) {
      const children = childrenMap[nodeId] || [];
      const nodeWidth = verticalSubtreeWidths[nodeId] || hNodeSpacing;
      const nodeX = startX + nodeWidth / 2;
      const selfNode = nodes[nodeId];

      positions[nodeId] = {
        id: nodeId,
        x: nodeX + (selfNode?.offsetX || 0),
        y: currentY + (selfNode?.offsetY || 0),
        side: 'center'
      };

      let childXAccumulator = startX;
      children.forEach((childId) => {
        const childNode = nodes[childId];
        const childWidth = verticalSubtreeWidths[childId] || hNodeSpacing;
        
        const parentHeightOffset = (selfNode?.height ? selfNode.height - 42 : 0) / 2;
        const childHeightOffset = (childNode?.height ? childNode.height - 42 : 0) / 2;
        const totalOffsetY = parentHeightOffset + childHeightOffset;

        layoutSubtreeVertical(childId, childXAccumulator, currentY + vNodeHeight + totalOffsetY);
        childXAccumulator += childWidth;
      });
    }

    let rootWidth = verticalSubtreeWidths[rootId] || hNodeSpacing;
    layoutSubtreeVertical(rootId, -rootWidth / 2, 0);
  }

  // 3. Handle Floating, Label and Block Topics (they hold manual coordinate positions)
  Object.keys(nodes).forEach((id) => {
    const node = nodes[id];
    if (node.type === 'floating' || node.type === 'label' || node.type === 'block') {
      positions[id] = {
        id,
        x: node.x ?? 200,
        y: node.y ?? 200,
        side: 'center'
      };
    }
  });

  return positions;
}
