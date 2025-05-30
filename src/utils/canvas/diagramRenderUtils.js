/**
 * Diagram Rendering Utilities
 * 
 * Contains the main diagram rendering logic extracted from ConDecCanvas.js
 */

import React from 'react';
import { ConDecRelation } from '../../components/ConDecRelations';
import { ConDecNode } from '../../components/ConDecNode';
import { ConDecNodeMenu } from '../../components/FloatingNodeMenu';
import { calculateIntersectionPoint } from '../geometryUtils';
import { renderMultiSelectBoundingBox, renderMultiSelectMenu } from './renderUtils';

/**
 * Renders all diagram elements including nodes, relations, and n-ary diamonds
 */
export const renderDiagramElements = ({
  diagram,
  selectedElement,
  multiSelectedNodes,
  mode,
  zoom,
  naryStartNode,
  naryMouse,
  relationCreationState,
  relationMouse,
  connectFromNodeMenu,
  nodeSizes,
  props,
  handleNodeInteractionStart,
  handleNaryDiamondInteractionStart,
  handleWaypointDrag,
  handleWaypointDragEnd,
  handleAlignmentCheck,
  handleNodeSize,
  canvasOffset,
  saveToUndoStack,
  setConnectFromNodeMenu,
  setRelationCreationState,
  setRelationMouse,
  onNaryRelationClick,
  getNodeCenter,
  getNodeEdgePoint,
  renderAlignmentGuides
}) => {
  if (!diagram || !diagram.nodes || !diagram.relations) return null;
  
  const nodes = [...diagram.nodes];
  const relations = [...diagram.relations];
  
  const selectedNodeId = selectedElement?.type === 'node' ? selectedElement.element.id : null;
  const selectedRelationId = selectedElement?.type === 'relation' ? selectedElement.element.id : null;
  
  relations.sort((a, b) => {
    if (a.id === selectedRelationId) return 1; 
    if (b.id === selectedRelationId) return -1;
    return 0;
  });
  
  nodes.sort((a, b) => {
    if (a.id === selectedNodeId) return 1; 
    if (b.id === selectedNodeId) return -1;
    return 0;
  });

  // --- Pass 1: Render n-ary diamonds and labels only ---
  const naryDiamondsArr = [];
  relations.forEach(relation => {
    if ((relation.type === 'choice' || relation.type === 'Ex_choice') && relation.activities && Array.isArray(relation.activities) && relation.activities.length > 0) {
      // Ensure diamondPos exists: fallback to centroid if missing
      let diamondPos = relation.diamondPos;
      if (!diamondPos) {
        // Compute centroid of activity nodes
        const activityNodes = relation.activities.map(id => nodes.find(n => n.id === id)).filter(Boolean);
        if (activityNodes.length > 0) {
          const avgX = activityNodes.reduce((sum, n) => sum + n.x, 0) / activityNodes.length;
          const avgY = activityNodes.reduce((sum, n) => sum + n.y, 0) / activityNodes.length;
          diamondPos = { x: avgX, y: avgY };
          if (props.onRelationEdit && diagram && Array.isArray(diagram.relations)) {
            const updatedRelations = diagram.relations.map(r =>
              r.id === relation.id ? { ...relation, diamondPos } : r
            );
            props.onRelationEdit(updatedRelations);
          }
        }
      }
      if (!diamondPos) return; // Still no position, skip rendering
      const isSelected =
        !multiSelectedNodes.length &&
        selectedElement &&
        selectedElement.type === 'relation' &&
        selectedElement.element.id === relation.id;
      // Determine fill color
      let fillColor = '#fff';
      if (relation.type === 'Ex_choice') fillColor = '#000';
      naryDiamondsArr.push(
        <g key={`nary-diamond-${relation.id}`} className="nary-relation-diamond">
          {/* N-ary connecting lines (behind diamond) */}
          <g className="nary-relation-lines">
            {relation.activities.map((nodeId, index) => {
              const node = nodes.find(n => n.id === nodeId);
              if (!node) return null;
              const nodeEdgePoint = calculateIntersectionPoint(
                { x: diamondPos.x, y: diamondPos.y },
                { x: node.x, y: node.y },
                node.width || 100,
                node.height || 50
              );
              return (
                <line
                  key={`nary-line-${nodeId}-${index}`}
                  x1={diamondPos.x}
                  y1={diamondPos.y}
                  x2={nodeEdgePoint.x}
                  y2={nodeEdgePoint.y}
                  stroke={isSelected ? "#1976d2" : "#666"}
                  strokeWidth={(isSelected ? 2 : 1.5) / zoom}
                  pointerEvents="none"
                />
              );
            })}
          </g>
          {/* Constraint label above the diamond */}
          <text
            x={diamondPos.x}
            y={diamondPos.y - 20}
            textAnchor="middle"
            dominantBaseline="baseline"
            fontSize={`${12/zoom}px`}
            fontWeight="bold"
            fill="#222"
            pointerEvents="none"
            style={{ userSelect: 'none' }}
          >
            {relation.n} of {relation.activities.length}
          </text>
          {/* Diamond shape */}
          <polygon
            points={`${diamondPos.x},${diamondPos.y - 8} ${diamondPos.x + 18},${diamondPos.y} ${diamondPos.x},${diamondPos.y + 8} ${diamondPos.x - 18},${diamondPos.y}`}
            fill={fillColor}
            stroke={isSelected ? "#1976d2" : "#666"}
            strokeWidth={(isSelected ? 2 : 1.5) / zoom}
            onMouseDown={(e) => {
              if (mode === 'hand' && e.button === 0) {
                handleNaryDiamondInteractionStart(relation.id, diamondPos.x, diamondPos.y, e);
              }
              // In all other cases, do nothing so onClick can fire
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (saveToUndoStack) {
                saveToUndoStack();
              }
              if (props.onSelectElement) {
                props.onSelectElement('relation', relation.id);
              }
              if (props.onNaryRelationClick) {
                props.onNaryRelationClick(relation, e);
              }
            }}
            style={{ 
              cursor: mode === 'hand' ? 'move' : (mode === 'nary' && naryStartNode ? 'pointer' : 'default')
            }}
          />
        </g>
      );
    }
  });

  // --- Pass 2: Render all other relations (binary, etc) ---
  const relationElements = relations.map(relation => {
    if (relation.type === 'choice' && relation.activities && Array.isArray(relation.activities)) {
      // n-ary already rendered above
      return null;
    }
    // Regular binary relations
    const sourceNode = nodes.find(n => n.id === relation.sourceId);
    const targetNode = nodes.find(n => n.id === relation.targetId);
    if (!sourceNode || !targetNode) return null;
    const isSelected =
      !multiSelectedNodes.length &&
      selectedElement &&
      selectedElement.type === 'relation' &&
      selectedElement.element.id === relation.id;
    const handleRelationClick =
      mode === 'nary' && naryStartNode
        ? (e) => {
            e.stopPropagation();
            onNaryRelationClick && onNaryRelationClick(relation, e);
          }
        : (e) => {
            e.stopPropagation();
            if (mode === 'select' && props.onSelectElement) {
              props.onSelectElement('relation', relation.id);
              return;
            }
            props.onSelectElement('relation', relation.id);
          };
    return (
      <ConDecRelation
        key={relation.id}
        relation={relation}
        sourceNode={sourceNode}
        targetNode={targetNode}
        isSelected={isSelected}
        onSelect={handleRelationClick}
        calculateIntersectionPoint={calculateIntersectionPoint}
        onWaypointDrag={handleWaypointDrag}
        onWaypointDragEnd={handleWaypointDragEnd}
        canvasOffset={canvasOffset}
        zoom={zoom}
        saveToUndoStack={saveToUndoStack}
        allNodes={nodes}
        onAlignmentCheck={handleAlignmentCheck}
      />
    );
  });
  
  const handleNodeClick = (nodeId, e) => {
    e.stopPropagation();
    // --- N-ary creation: start n-ary on node click ---
    if (mode === 'nary' && !naryStartNode) {
      const node = nodes.find(n => n.id === nodeId);
      if (node && props.setNaryStartNode) {
        props.setNaryStartNode(node);
      }
      return;
    }
    // --- Handle connect-from-node-menu mode ---
    if (connectFromNodeMenu && connectFromNodeMenu.sourceId && nodeId !== connectFromNodeMenu.sourceId) {
      if (props.onRelationCreate) {
        props.onRelationCreate(connectFromNodeMenu.sourceId, nodeId);
      }
      setConnectFromNodeMenu(null);
      if (props.setMode) props.setMode('hand');
      return;
    }
    // --- Palette relation tool: click source, then click target ---
    if (props.mode === 'addRelation') {
      if (!relationCreationState.active) {
        // First click: set source node
        if (diagram && Array.isArray(diagram.nodes)) {
          const sourceNode = diagram.nodes.find(n => n.id === nodeId);
          setRelationCreationState({
            active: true,
            sourceNode,
            sourceId: nodeId
          });
          setRelationMouse(null);
        }
        return;
      } else if (
        relationCreationState.active &&
        nodeId !== relationCreationState.sourceId
      ) {
        if (props.onRelationCreate) {
          props.onRelationCreate(relationCreationState.sourceId, nodeId);
        }
        setRelationCreationState({
          active: false,
          sourceNode: null,
          sourceId: null
        });
        setRelationMouse(null);
        return;
      }
      // If already active and clicking the source again, ignore (do not reset source)
      return;
    }
    // Select tool: select node
    if (mode === 'select' && props.onSelectElement) {
      props.onSelectElement('node', nodeId);
      return;
    }
    // Otherwise, normal selection
    if (props.onSelectElement) {
      props.onSelectElement('node', nodeId);
    }
  };

  const nodeElements = nodes.map(node => {
    const isSelected = !multiSelectedNodes.length && selectedElement &&
      selectedElement.type === 'node' &&
      selectedElement.element.id === node.id;
    const isMultiSelected = multiSelectedNodes && multiSelectedNodes.find(n => n.id === node.id);
    return (
      <React.Fragment key={node.id}>
        <ConDecNode
          node={node}
          isSelected={isSelected}
          isMultiSelected={!!isMultiSelected}
          mode={props.mode}
          onSelect={(e) => handleNodeClick(node.id, e)}
          onDoubleClick={() => {}}
          onDragStart={e => handleNodeInteractionStart(node.id, e)}
          onMenu={null}
          onRename={(newName, clearEditing) => {
            if (clearEditing) {
              const updatedNodes = diagram.nodes.map(n =>
                n.id === node.id
                  ? { ...n, name: newName, editing: undefined }
                  : n
              );
              if (typeof props.onNodeEdit === 'function') {
                props.onNodeEdit(updatedNodes);
              }
            } else {
              // Just update name
              const updatedNodes = diagram.nodes.map(n =>
                n.id === node.id
                  ? { ...n, name: newName }
                  : n
              );
              if (typeof props.onNodeEdit === 'function') {
                props.onNodeEdit(updatedNodes);
              }
            }
          }}
          onRenameBlur={() => {}}
          onSize={size => handleNodeSize(node.id, size)}
        />
      </React.Fragment>
    );
  });

  // --- Render floating menu for selected node (if not multi-selected) ---
  let nodeMenu = null;
  if (
    selectedElement &&
    selectedElement.type === 'node' &&
    (!multiSelectedNodes || !multiSelectedNodes.length)
  ) {
    let node = nodes.find(n => n.id === selectedElement.element.id);
    // Inject latest size if available
    if (node && nodeSizes[node.id]) {
      node = { ...node, ...nodeSizes[node.id] };
    }
    if (node) {
      nodeMenu = (
        <ConDecNodeMenu
          node={node}
          diagram={diagram}
          onEdit={props.onNodeMenuEdit}
          onDelete={props.onNodeMenuDelete}
          onAppend={props.onAppend}
          onClose={props.onNodeMenuClose}
          zoom={zoom}
          onConnect={(node) => {
            setConnectFromNodeMenu({ 
              sourceId: node.id,
              sourceNode: node
            });
            if (props.setMode) props.setMode('connectFromNodeMenu');
          }}
        />
      );
    }
  }

  // --- Show temporary line for relation creation modes ---
  let temporaryRelation = null;
  // For addRelation mode (palette tool)
  if (
    props.mode === 'addRelation' &&
    relationCreationState.active &&
    relationCreationState.sourceNode &&
    relationMouse
  ) {
    const sourceNode = relationCreationState.sourceNode;
    const sourceCenter = getNodeCenter(sourceNode);
    // Target point in canvas coordinates
    const targetPoint = {
      x: (relationMouse.x - (props.canvasOffset?.x || 0)) / (props.zoom || 1),
      y: (relationMouse.y - (props.canvasOffset?.y || 0)) / (props.zoom || 1)
    };
    // Direction from source to target
    const dx = targetPoint.x - sourceCenter.x;
    const dy = targetPoint.y - sourceCenter.y;
    // Start at edge of source node
    const start = getNodeEdgePoint(sourceNode, dx, dy);
    temporaryRelation = (
      <>
        <line
          x1={start.x}
          y1={start.y}
          x2={targetPoint.x}
          y2={targetPoint.y}
          stroke="#1a73e8"
          strokeWidth="1.5"
          strokeDasharray="5,5"
          markerEnd="url(#arrow)"
          style={{ pointerEvents: 'none' }}
        />
        <circle
          cx={start.x}
          cy={start.y}
          r="3"
          fill="#1a73e8"
          style={{ pointerEvents: 'none' }}
        />
      </>
    );
  }
  // For connect-from-node-menu mode (floating menu)
  else if (
    props.mode === 'connectFromNodeMenu' &&
    connectFromNodeMenu &&
    connectFromNodeMenu.sourceNode &&
    props.mousePosition
  ) {
    const sourceNode = connectFromNodeMenu.sourceNode;
    const sourceCenter = getNodeCenter(sourceNode);
    const targetPoint = {
      x: (props.mousePosition.x - (props.canvasOffset?.x || 0)) / (props.zoom || 1),
      y: (props.mousePosition.y - (props.canvasOffset?.y || 0)) / (props.zoom || 1)
    };
    const dx = targetPoint.x - sourceCenter.x;
    const dy = targetPoint.y - sourceCenter.y;
    const start = getNodeEdgePoint(sourceNode, dx, dy);
    temporaryRelation = (
      <>
        <line
          x1={start.x}
          y1={start.y}
          x2={targetPoint.x}
          y2={targetPoint.y}
          stroke="#1a73e8"
          strokeWidth="1.5"
          strokeDasharray="5,5"
          markerEnd="url(#arrow)"
          style={{ pointerEvents: 'none' }}
        />
        <circle
          cx={start.x}
          cy={start.y}
          r="3"
          fill="#1a73e8"
          style={{ pointerEvents: 'none' }}
        />
      </>
    );
  }

  return (
    <>
      {renderAlignmentGuides()}
      {naryDiamondsArr}
      {relationElements}
      {/* N-ary mode: draw dashed arrow from start node to mouse */}
      {mode === 'nary' && naryStartNode && naryMouse && (
        <line
          x1={naryStartNode.x}
          y1={naryStartNode.y}
          x2={naryMouse.x}
          y2={naryMouse.y}
          stroke="#1976d2"
          strokeWidth={2}
          strokeDasharray="6,6"
          markerEnd="url(#arrow)"
          pointerEvents="none"
        />
      )}
      {temporaryRelation}
      {nodeElements}
      {nodeMenu}
    </>
  );
};
