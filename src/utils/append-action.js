import { NODE_TYPES } from './diagramUtils';
import { layoutConnection } from './canvasUtils';

/**
 * Append a new activity to the right of the given node and connect them.
 * @param {Object} node - The node to append to.
 * @param {Object} diagram - The current diagram.
 * @param {Function} saveToUndoStack - Undo stack function.
 * @returns {Object|null} { updatedDiagram, newNode } or null if not allowed
 */
export function appendActivityAndConnect(node, diagram, saveToUndoStack) {
  if (!diagram || !node) return null;

  // Use actual node width/height if present, else default
  const nodeWidth = node.width || node.size?.width || 100;
  const nodeHeight = node.height || node.size?.height || 50;
  const gap = 100;
  const newX = node.x + nodeWidth + gap;
  const newY = node.y;

  // Generate the new node id in advance for constraint checking
  const newNodeId = `activity_${Date.now()}`;

  saveToUndoStack && saveToUndoStack();

  const newNode = {
    id: newNodeId,
    type: NODE_TYPES.ACTIVITY, // Set type to resp_existence
    name: '', // Start with empty name
    x: newX,
    y: newY,
    width: nodeWidth, // Set width for downstream menu placement
    height: nodeHeight,
    constraint: null,
    constraintValue: null,
    editing: true // Prompt rename on creation
  };

  // Use layoutConnection to get proper waypoints with actual node sizes
  const waypoints = layoutConnection(
    { ...node, width: nodeWidth, height: nodeHeight },
    { ...newNode, width: nodeWidth, height: nodeHeight }
  );

  const newRelation = {
    id: `relation_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    type: 'resp_existence', // Use resp_existence for the relation
    sourceId: node.id,
    targetId: newNode.id,
    waypoints
  };

  const updatedDiagram = {
    ...diagram,
    nodes: [...diagram.nodes, newNode],
    relations: [...diagram.relations, newRelation]
  };

  return { updatedDiagram, newNode };
}
