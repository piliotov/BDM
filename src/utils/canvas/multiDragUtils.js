// Multi-drag utilities for ConDecCanvas
import { updateRelationsForNode } from '../relationUtils';

/**
 * Handles multi-drag mouse move for extended selection (nodes + relation points + nary diamonds)
 * @param {Object} params - Parameters object
 * @param {Object} params.multiDragStart - Multi-drag start state
 * @param {Object} params.diagram - Diagram object
 * @param {number} params.zoom - Zoom level
 * @param {Event} params.e - Mouse event
 * @param {Function} params.onNodeEdit - Node edit callback
 * @param {Function} params.onRelationEdit - Relation edit callback
 * @param {Function} params.setMultiDragStart - Setter for multi-drag start
 */
export function handleExtendedMultiDragMove({ multiDragStart, diagram, zoom, e, onNodeEdit, onRelationEdit, setMultiDragStart }) {
  if (!multiDragStart || multiDragStart.type !== 'extended' || !multiDragStart.selectedElements) return;
  
  const deltaX = (e.clientX - multiDragStart.startX) / zoom;
  const deltaY = (e.clientY - multiDragStart.startY) / zoom;
  
  // Update nodes
  const updatedNodes = diagram.nodes.map(node => {
    const dragNode = multiDragStart.selectedElements.nodes.find(n => n.id === node.id);
    if (dragNode) {
      return { ...node, x: dragNode.x + deltaX, y: dragNode.y + deltaY };
    }
    return node;
  });
  
  // Update relations with waypoints and diamond positions
  const updatedRelations = diagram.relations.map(relation => {
    let updatedRelation = { ...relation };
    
    // Check if both source and target nodes are being moved
    const selectedNodeIds = multiDragStart.selectedElements.nodes.map(n => n.id);
    const bothNodesSelected = selectedNodeIds.includes(relation.sourceId) && 
                             selectedNodeIds.includes(relation.targetId);
    
    // Update relation waypoints if they're in the selection
    if (multiDragStart.selectedElements.relationPoints) {
      const relationWaypoints = multiDragStart.selectedElements.relationPoints
        .filter(rp => rp.relationId === relation.id);
      
      if (relationWaypoints.length > 0 && Array.isArray(relation.waypoints)) {
        updatedRelation.waypoints = relation.waypoints.map((wp, index) => {
          const dragWaypoint = relationWaypoints.find(rp => rp.waypointIndex === index);
          if (dragWaypoint) {
            return { ...wp, x: dragWaypoint.x + deltaX, y: dragWaypoint.y + deltaY };
          }
          return wp;
        });
      }
    }
    
    // If both source and target nodes are being moved together, 
    // recalculate endpoints to ensure they stay connected to node boundaries
    if (bothNodesSelected && updatedRelation.waypoints && updatedRelation.waypoints.length >= 2) {
      const tempDiagram = { 
        nodes: updatedNodes, 
        relations: [updatedRelation] 
      };
      updatedRelation = updateRelationsForNode(
        updatedNodes.find(n => n.id === relation.sourceId), 
        tempDiagram
      )[0];
    }
    
    // Update nary diamond positions if they're in the selection
    if (multiDragStart.selectedElements.naryDiamonds) {
      const dragDiamond = multiDragStart.selectedElements.naryDiamonds
        .find(nd => nd.relationId === relation.id);
      if (dragDiamond && relation.diamondPos) {
        updatedRelation.diamondPos = {
          x: dragDiamond.x + deltaX,
          y: dragDiamond.y + deltaY
        };
      }
    }
    
    return updatedRelation;
  });
  
  if (typeof onNodeEdit === 'function') {
    onNodeEdit(updatedNodes);
  }
  if (typeof onRelationEdit === 'function') {
    onRelationEdit(updatedRelations);
  }
  
  // Update last mouse position for bounding box
  setMultiDragStart(prev => prev ? { ...prev, lastClientX: e.clientX, lastClientY: e.clientY } : prev);
}

/**
 * Handles multi-drag mouse move for traditional node-only selection
 * @param {Object} params - Parameters object
 * @param {Object} params.multiDragStart - Multi-drag start state
 * @param {Object} params.diagram - Diagram object
 * @param {number} params.zoom - Zoom level
 * @param {Event} params.e - Mouse event
 * @param {Function} params.onNodeEdit - Node edit callback
 * @param {Function} params.onRelationEdit - Relation edit callback
 * @param {Function} params.setMultiDragStart - Setter for multi-drag start
 */
export function handleTraditionalMultiDragMove({ multiDragStart, diagram, zoom, e, onNodeEdit, onRelationEdit, setMultiDragStart }) {
  if (!multiDragStart || !multiDragStart.nodePositions) return;
  
  const deltaX = (e.clientX - multiDragStart.startX) / zoom;
  const deltaY = (e.clientY - multiDragStart.startY) / zoom;
  
  const updatedNodes = diagram.nodes.map(node => {
    const dragNode = multiDragStart.nodePositions.find(n => n.id === node.id);
    if (dragNode) {
      return { ...node, x: dragNode.x + deltaX, y: dragNode.y + deltaY };
    }
    return node;
  });
  
  if (typeof onNodeEdit === 'function') {
    onNodeEdit(updatedNodes);
  }
  
  // Update relations to recalculate endpoints for moved nodes
  if (typeof onRelationEdit === 'function' && diagram && Array.isArray(diagram.relations)) {
    const movedNodeIds = multiDragStart.nodePositions.map(n => n.id);
    const updatedRelations = diagram.relations.map(relation => {
      // Check if both source and target nodes are being moved
      const bothNodesSelected = movedNodeIds.includes(relation.sourceId) && 
                               movedNodeIds.includes(relation.targetId);
      
      if (bothNodesSelected) {
        // If both nodes are moved, recalculate endpoints
        const tempDiagram = { 
          nodes: updatedNodes, 
          relations: [relation] 
        };
        return updateRelationsForNode(
          updatedNodes.find(n => n.id === relation.sourceId), 
          tempDiagram
        )[0];
      } else if (movedNodeIds.includes(relation.sourceId) || movedNodeIds.includes(relation.targetId)) {
        // If only one node is moved, use normal single-node update logic
        const movedNode = updatedNodes.find(n => 
          movedNodeIds.includes(n.id) && 
          (n.id === relation.sourceId || n.id === relation.targetId)
        );
        if (movedNode) {
          const tempDiagram = { 
            nodes: updatedNodes, 
            relations: [relation] 
          };
          return updateRelationsForNode(movedNode, tempDiagram)[0];
        }
      }
      return relation;
    });
    onRelationEdit(updatedRelations);
  }
  
  // Update last mouse position for bounding box
  setMultiDragStart(prev => prev ? { ...prev, lastClientX: e.clientX, lastClientY: e.clientY } : prev);
}

/**
 * Handles multi-drag mouse up for extended selection
 * @param {Object} params - Parameters object
 * @param {Object} params.multiDragStart - Multi-drag start state
 * @param {Object} params.diagram - Diagram object
 * @param {number} params.zoom - Zoom level
 * @param {Function} params.onNodeEdit - Node edit callback
 * @param {Function} params.onRelationEdit - Relation edit callback
 * @param {Function} params.saveToUndoStack - Save to undo stack callback
 * @param {Object} params.props - Props object
 */
export function handleExtendedMultiDragUp({ multiDragStart, diagram, zoom, onNodeEdit, onRelationEdit, saveToUndoStack, props }) {
  if (!multiDragStart || multiDragStart.type !== 'extended' || !multiDragStart.selectedElements) return;
  
  const deltaX = (multiDragStart.lastClientX !== undefined ? multiDragStart.lastClientX : multiDragStart.startX) - multiDragStart.startX;
  const deltaY = (multiDragStart.lastClientY !== undefined ? multiDragStart.lastClientY : multiDragStart.startY) - multiDragStart.startY;
  const moved = deltaX !== 0 || deltaY !== 0;
  
  const scaledDeltaX = deltaX / zoom;
  const scaledDeltaY = deltaY / zoom;
  
  // Update nodes
  const updatedNodes = diagram.nodes.map(node => {
    const dragNode = multiDragStart.selectedElements.nodes.find(n => n.id === node.id);
    if (dragNode) {
      return { ...node, x: dragNode.x + scaledDeltaX, y: dragNode.y + scaledDeltaY };
    }
    return node;
  });
  
  // Update relations with waypoints and diamond positions
  const updatedRelations = diagram.relations.map(relation => {
    let updatedRelation = { ...relation };
    
    // Check if both source and target nodes are being moved
    const selectedNodeIds = multiDragStart.selectedElements.nodes.map(n => n.id);
    const bothNodesSelected = selectedNodeIds.includes(relation.sourceId) && 
                             selectedNodeIds.includes(relation.targetId);
    
    // Update relation waypoints if they're in the selection
    if (multiDragStart.selectedElements.relationPoints) {
      const relationWaypoints = multiDragStart.selectedElements.relationPoints
        .filter(rp => rp.relationId === relation.id);
      
      if (relationWaypoints.length > 0 && Array.isArray(relation.waypoints)) {
        updatedRelation.waypoints = relation.waypoints.map((wp, index) => {
          const dragWaypoint = relationWaypoints.find(rp => rp.waypointIndex === index);
          if (dragWaypoint) {
            return { ...wp, x: dragWaypoint.x + scaledDeltaX, y: dragWaypoint.y + scaledDeltaY };
          }
          return wp;
        });
      }
    }
    
    // If both source and target nodes are being moved together, 
    // recalculate endpoints to ensure they stay connected to node boundaries
    if (bothNodesSelected && updatedRelation.waypoints && updatedRelation.waypoints.length >= 2) {
      const tempDiagram = { 
        nodes: updatedNodes, 
        relations: [updatedRelation] 
      };
      updatedRelation = updateRelationsForNode(
        updatedNodes.find(n => n.id === relation.sourceId), 
        tempDiagram
      )[0];
    }
    
    // Update nary diamond positions if they're in the selection
    if (multiDragStart.selectedElements.naryDiamonds) {
      const dragDiamond = multiDragStart.selectedElements.naryDiamonds
        .find(nd => nd.relationId === relation.id);
      if (dragDiamond && relation.diamondPos) {
        updatedRelation.diamondPos = {
          x: dragDiamond.x + scaledDeltaX,
          y: dragDiamond.y + scaledDeltaY
        };
      }
    }
    
    return updatedRelation;
  });
  
  if (typeof onNodeEdit === 'function') {
    onNodeEdit(updatedNodes);
  }
  if (typeof onRelationEdit === 'function') {
    onRelationEdit(updatedRelations);
  }
  
  // Update extended multi-selection to new positions
  if (props.setMultiSelectedElements) {
    const newExtendedSelection = {
      nodes: updatedNodes.filter(n => 
        multiDragStart.selectedElements.nodes.some(sn => sn.id === n.id)
      ),
      relationPoints: multiDragStart.selectedElements.relationPoints?.map(rp => ({
        ...rp,
        x: rp.x + scaledDeltaX,
        y: rp.y + scaledDeltaY
      })) || [],
      naryDiamonds: multiDragStart.selectedElements.naryDiamonds?.map(nd => ({
        ...nd,
        x: nd.x + scaledDeltaX,
        y: nd.y + scaledDeltaY
      })) || []
    };
    props.setMultiSelectedElements(newExtendedSelection);
  }
  
  if (moved && saveToUndoStack) saveToUndoStack();
}

/**
 * Handles multi-drag mouse up for traditional node-only selection
 * @param {Object} params - Parameters object
 * @param {Object} params.multiDragStart - Multi-drag start state
 * @param {Object} params.diagram - Diagram object
 * @param {number} params.zoom - Zoom level
 * @param {Function} params.onNodeEdit - Node edit callback
 * @param {Function} params.saveToUndoStack - Save to undo stack callback
 * @param {Object} params.props - Props object
 */
export function handleTraditionalMultiDragUp({ multiDragStart, diagram, zoom, onNodeEdit, saveToUndoStack, props }) {
  if (!multiDragStart || !multiDragStart.nodePositions) return;
  
  const deltaX = (multiDragStart.lastClientX !== undefined ? multiDragStart.lastClientX : multiDragStart.startX) - multiDragStart.startX;
  const deltaY = (multiDragStart.lastClientY !== undefined ? multiDragStart.lastClientY : multiDragStart.startY) - multiDragStart.startY;
  const moved = deltaX !== 0 || deltaY !== 0;
  
  const updatedNodes = diagram.nodes.map(node => {
    const dragNode = multiDragStart.nodePositions.find(n => n.id === node.id);
    if (dragNode) {
      return { ...node, x: dragNode.x + deltaX / zoom, y: dragNode.y + deltaY / zoom };
    }
    return node;
  });
  
  if (typeof onNodeEdit === 'function') {
    onNodeEdit(updatedNodes);
  }
  
  // Update selection to new node positions
  if (props.setMultiSelectedNodes) {
    const newSelection = updatedNodes.filter(n => multiDragStart.nodeIds.includes(n.id));
    props.setMultiSelectedNodes(newSelection);
  }
  
  if (moved && saveToUndoStack) saveToUndoStack();
}