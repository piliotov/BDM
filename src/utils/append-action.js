import { NODE_TYPES } from './diagramUtils';
import { RELATION_TYPES } from './relationUtils';
import { isRelationAllowed } from './nodeUtils';

/**
 * Append a new activity to the right of the given node and connect them.
 * @param {Object} node - The node to append to.
 * @param {Object} diagram - The current diagram.
 * @param {Function} saveToUndoStack - Undo stack function.
 * @returns {Object|null} { updatedDiagram, newNode } or null if not allowed
 */
export function appendActivityAndConnect(node, diagram, saveToUndoStack) {
  if (!diagram || !node) return null;

  // Check if relation is allowed (simulate as if new node is target)
  // Always allow for new node (no constraints yet)
  // But if you want to prevent appending from nodes with constraints, check here:
  // if (!isRelationAllowed(diagram, node.id, 'newNodeId')) return null;

  saveToUndoStack && saveToUndoStack();

  const nodeWidth = 100;
  const gap = 100;
  const newX = node.x + nodeWidth + gap;
  const newY = node.y;

  const newNode = {
    id: `activity_${Date.now()}`,
    type: NODE_TYPES.ACTIVITY,
    name: '', // Start with empty name
    x: newX,
    y: newY,
    constraint: null,
    constraintValue: null,
    editing: true // Prompt rename on creation
  };

  const newRelation = {
    id: `relation_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    type: RELATION_TYPES.RESPONSE,
    sourceId: node.id,
    targetId: newNode.id,
    waypoints: [
      { x: node.x + nodeWidth / 2, y: node.y },
      { x: newX - nodeWidth / 2, y: newY }
    ]
  };

  const updatedDiagram = {
    ...diagram,
    nodes: [...diagram.nodes, newNode],
    relations: [...diagram.relations, newRelation]
  };

  return { updatedDiagram, newNode };
}
