import { NODE_TYPES, CONSTRAINTS } from './diagramUtils';

// Handle node rename
export function handleNodeRename(nodeId, newName, diagram, saveToUndoStack) {
  if (!newName || !newName.trim()) return diagram;
  
  saveToUndoStack();
  const updatedNodes = diagram.nodes.map(n =>
    n.id === nodeId ? { ...n, name: newName } : n
  );
  
  return { ...diagram, nodes: updatedNodes };
}

// Handle adding new node
export function addNode(e, mode, diagram, canvasOffset, zoom, saveToUndoStack) {
  if (!mode.startsWith('add')) return null;

  const svg = document.querySelector('.condec-canvas');
  const rect = svg.getBoundingClientRect();
  
  // Calculate position relative to the canvas center
  const x = (e.clientX - rect.left - canvasOffset.x) / zoom;
  const y = (e.clientY - rect.top - canvasOffset.y) / zoom;

  const newNode = {
    id: `activity_${Date.now()}`,
    type: NODE_TYPES.ACTIVITY,
    name: `Activity ${diagram.nodes.length + 1}`,
    x,
    y,
    constraint: null,
    constraintValue: null
  };

  saveToUndoStack();

  return {
    updatedDiagram: {
      ...diagram,
      nodes: [...diagram.nodes, newNode]
    },
    newNode
  };
}

// Function to check if a relation is allowed
export function isRelationAllowed(diagram, sourceId, targetId) {
  const targetNode = diagram.nodes.find(n => n.id === targetId);
  if (!targetNode) return false;

  // Case 1: Prevent relations to INIT nodes
  if (targetNode.constraint === CONSTRAINTS.INIT) {
    return false;
  }

  // Count existing incoming relations to this target
  const incomingRelations = diagram.relations.filter(r => r.targetId === targetId);
  const incomingCount = incomingRelations.length;

  // Case 2: Check other constraints
  switch (targetNode.constraint) {
    case CONSTRAINTS.ABSENCE:
      // No relations allowed
      return false;

    case CONSTRAINTS.ABSENCE_N:
      // Cannot exceed the maximum allowed count
      return incomingCount < (targetNode.constraintValue || 0);

    case CONSTRAINTS.EXACTLY_N:
      // Cannot exceed exact count
      return incomingCount < (targetNode.constraintValue || 0);

    default:
      // Allow relation for other constraints or no constraint
      return true;
  }
}
