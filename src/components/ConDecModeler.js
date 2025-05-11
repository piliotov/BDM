import React, { useEffect, useState, useCallback } from 'react';
import '../styles/ConDecModeler.css';
import { ConDecCanvas } from './ConDecCanvas';
import { ConDecNodeMenu } from './ConDecNodeMenu';
import { snapNodeDuringDrag, createSvgGrid } from '../utils/gridUtil';
import { initialDiagram, diagramToXML, CONSTRAINTS } from '../utils/diagramUtils';
import { isRelationAllowed, RELATION_TYPES } from '../utils/relationUtils';
import { addNode, handleNodeRename as utilHandleNodeRename } from '../utils/nodeUtils';
import { appendActivityAndConnect } from '../utils/append-action';

// Constants for local storage
const LOCAL_STORAGE_KEY = 'condec-diagram';

const ConDecModeler = ({ width = '100%', height = '100%', style = {} }) => {

  // State
  const [diagram, setDiagram] = useState(null);
  const [selectedElement, setSelectedElement] = useState(null);
  const [draggedElement, setDraggedElement] = useState(null);
  const [newRelation, setNewRelation] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [undoStack, setUndoStack] = useState([]);
  const [mode, setMode] = useState('hand');
  const [editNodePopup, setEditNodePopup] = useState(null); // {node}
  const [editNodePopupPos, setEditNodePopupPos] = useState({ x: null, y: null });
  const [draggingEditPopup, setDraggingEditPopup] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [selectionBox, setSelectionBox] = useState(null);
  const [selectionStart, setSelectionStart] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panOrigin, setPanOrigin] = useState({ x: 0, y: 0 });
  
  // Calculate the center offset based on window size
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });

  // Update canvas size and center offset when window resizes
  useEffect(() => {
    const updateCanvasSize = () => {
      const container = document.querySelector('.condec-canvas-container');
      if (container) {
        const { width, height } = container.getBoundingClientRect();
        setCanvasOffset({ 
          x: width / 2, 
          y: height / 2 
        });
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  // Load diagram from localStorage or use initial diagram
  useEffect(() => {
    const savedDiagram = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedDiagram) {
      try {
        setDiagram(JSON.parse(savedDiagram));
      } catch (e) {
        console.error('Error parsing saved diagram:', e);
        setDiagram(initialDiagram);
      }
    } else {
      setDiagram(initialDiagram);
    }
  }, []);

  // Save diagram to localStorage when it changes
  useEffect(() => {
    if (diagram) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(diagram));
    }
  }, [diagram]);

  // Prevent browser zoom on ctrl+wheel or meta+wheel over the canvas
  useEffect(() => {
    function handleWheel(e) {
      // Only block if ctrlKey or metaKey (pinch/zoom gesture) and target is inside our canvas
      const canvas = document.querySelector('.condec-canvas');
      if ((e.ctrlKey || e.metaKey) && canvas && canvas.contains(e.target)) {
        e.preventDefault();
      }
    }
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', handleWheel, { passive: false });
    };
  }, []);

  // Save current state to undo stack (call this only at the start of meaningful actions)
  const saveToUndoStack = useCallback(() => {
    setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(diagram))]);
  }, [diagram]);

  // Handle undo
  const handleUndo = useCallback(() => {
    setUndoStack(prevUndoStack => {
      if (prevUndoStack.length > 0) {
        const previousState = prevUndoStack[prevUndoStack.length - 1];
        setDiagram(previousState);
        return prevUndoStack.slice(0, -1);
      }
      return prevUndoStack;
    });
  }, []);

  // Handle delete
  const handleDelete = useCallback(() => {
    if (!selectedElement) return;
    saveToUndoStack();

    if (selectedElement.type === 'node') {
      const nodeId = selectedElement.element.id;
      const updatedNodes = diagram.nodes.filter(n => n.id !== nodeId);
      const updatedRelations = diagram.relations.filter(
        r => r.sourceId !== nodeId && r.targetId !== nodeId
      );
      setDiagram({
        nodes: updatedNodes,
        relations: updatedRelations
      });
    } else if (selectedElement.type === 'relation') {
      const relationId = selectedElement.element.id;
      const updatedRelations = diagram.relations.filter(r => r.id !== relationId);
      setDiagram({
        ...diagram,
        relations: updatedRelations
      });
    }
    setSelectedElement(null);
  }, [selectedElement, diagram, saveToUndoStack]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+Z for undo
      if ((e.ctrlKey && e.key === 'z') || (e.metaKey && e.key === 'z')) {
        handleUndo();
        e.preventDefault();
      }
      // Delete key for deleting selected elements
      if ((e.key === 'Delete' && selectedElement) || (e.key === 'Backspace' && selectedElement)) {
        handleDelete();
        e.preventDefault();
      }
      // Escape key to return to hand mode
      if (e.key === 'Escape') {
        setMode('hand');
        setNewRelation(null);
        e.preventDefault();
      }
      // H key for hand tool
      if (e.key === 'h' || e.key === 'H') {
        setMode('hand');
      }
      // S key for select tool
      if (e.key === 's' || e.key === 'S') {
        setMode('select');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedElement, undoStack, handleDelete, handleUndo]);

  // Handle element selection (unified)
  const handleElementSelect = (elementType, elementId) => {
    const element = elementType === 'node'
      ? diagram.nodes.find(n => n.id === elementId)
      : diagram.relations.find(r => r.id === elementId);

    setSelectedElement({
      type: elementType,
      element: element
    });
    setMode('hand'); // Switch back to hand mode on selection
  };

  // --- Node drag start: save to undo stack ---
  const handleNodeDragStart = (nodeId, e) => {
    saveToUndoStack();
    setDraggedElement({
      id: nodeId,
      startX: e.clientX,
      startY: e.clientY,
      elementX: diagram.nodes.find(n => n.id === nodeId).x,
      elementY: diagram.nodes.find(n => n.id === nodeId).y
    });
  };

  // --- Node drag: update position, but do NOT save to undo stack here ---
  const handleNodeDrag = (nodeId, dragEvent) => {
    if (!diagram || !nodeId) return;
    const node = diagram.nodes.find(n => n.id === nodeId);
    if (!node) return;
    const deltaX = (dragEvent.clientX - dragEvent.startX) / zoom;
    const deltaY = (dragEvent.clientY - dragEvent.startY) / zoom;
    const newNode = snapNodeDuringDrag(node, deltaX, deltaY, 10);
    
    // Update node position
    const updatedNodes = diagram.nodes.map(n => 
      n.id === nodeId ? newNode : n
    );
    
    setDiagram({
      ...diagram, 
      nodes: updatedNodes
    });
  };

  // replace in-file node rename
  const handleNodeRename = (nodeId, newName) => {
    saveToUndoStack();
    const updated = utilHandleNodeRename(nodeId, newName, diagram, () => {});
    setDiagram(updated);
    setSelectedElement({ 
      type: 'node', 
      element: updated.nodes.find(n => n.id === nodeId) 
    });
  };

  // delegate adding new node
  const handleAddNode = e => {
    saveToUndoStack();
    const result = addNode(e, mode, diagram, canvasOffset, zoom, () => {});
    if (!result) return;
    setDiagram(result.updatedDiagram);
    setSelectedElement({ type: 'node', element: result.newNode });
    setMode('hand');
  };

  // Add missing handleRelationCreate function
  const handleRelationCreate = (sourceId, targetId) => {
    saveToUndoStack();
    // Log current state for debugging
    console.log('Creating relation:', { sourceId, targetId });
    console.log('Current diagram state:', diagram);

    // Only check for exact duplicate (same source, target, and type)
    const existingRelation = diagram?.relations?.find(
      r => r.sourceId === sourceId && 
          r.targetId === targetId && 
          r.type === RELATION_TYPES.RESPONSE
    );

    if (existingRelation) {
      console.log('Found duplicate relation');
      setSelectedElement({
        type: 'relation',
        element: existingRelation
      });
      setNewRelation(null);
      return;
    }

    // Check if relation is allowed
    if (!isRelationAllowed(diagram, sourceId, targetId)) {
      alert('Cannot create this relation due to target constraints.');
      setNewRelation(null);
      return;
    }

    const sourceNode = diagram.nodes.find(n => n.id === sourceId);
    const targetNode = diagram.nodes.find(n => n.id === targetId);
    
    if (!sourceNode || !targetNode) {
      console.log('Source or target node not found');
      setNewRelation(null);
      return;
    }
    
    // Calculate intersection points for endpoints
    const calculateIntersectionPoint = (source, target, width = 100, height = 50) => {
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      
      if (length === 0) return source;
      
      const nx = dx / length;
      const ny = dy / length;
      
      return {
        x: source.x + nx * 50,
        y: source.y + ny * 25
      };
    };

    // Create waypoints with intersection points
    const waypoints = [
      calculateIntersectionPoint(
        { x: sourceNode.x, y: sourceNode.y },
        { x: targetNode.x, y: targetNode.y }
      ),
      calculateIntersectionPoint(
        { x: targetNode.x, y: targetNode.y },
        { x: sourceNode.x, y: sourceNode.y }
      )
    ];
    
    // Create new relation object
    const newRelationObj = {
      id: `relation_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      type: RELATION_TYPES.RESPONSE,
      sourceId,
      targetId,
      waypoints
    };

    console.log('New relation object:', newRelationObj);

    // Save current state to undo stack
    saveToUndoStack();

    // Update diagram state using functional update to ensure we have latest state
    setDiagram(prevDiagram => {
      // Ensure relations array exists and copy it
      const currentRelations = prevDiagram.relations || [];
      const updatedDiagram = {
        ...prevDiagram,
        relations: [...currentRelations, newRelationObj]
      };
      console.log('Updated diagram:', updatedDiagram);
      return updatedDiagram;
    });

    // Update selection
    setSelectedElement({
      type: 'relation',
      element: newRelationObj
    });
    
    setNewRelation(null);
  };

  // Add missing handleRelationEdit function
  const handleRelationEdit = updatedRelations => {
    saveToUndoStack();
    setDiagram(prev => ({ ...prev, relations: updatedRelations }));
  };
  
  // Append a new activity to the right and create a relation
  const handleAppendActivity = useCallback((node) => {
    const result = appendActivityAndConnect(node, diagram, saveToUndoStack);
    if (!result) return;
    setDiagram(result.updatedDiagram);
    setSelectedElement({ type: 'node', element: result.newNode });
  }, [diagram, saveToUndoStack]);

  // Prevent default context menu on right click
  useEffect(() => {
    const handleContextMenu = (e) => {
      e.preventDefault();
    };

    const canvas = document.querySelector('.condec-canvas');
    if (canvas) {
      canvas.addEventListener('contextmenu', handleContextMenu);
    }

    return () => {
      if (canvas) {
        canvas.removeEventListener('contextmenu', handleContextMenu);
      }
    };
  }, []);

  // Remove canvas panning handlers
  const handleCanvasMouseDown = (e) => {
    // Only handle selection box
    if (mode === 'select') {
      handleSelectionMouseDown(e);
    }
  };

  // --- Zoom Handler ---
  const handleCanvasWheel = (e) => {
    // Zoom only if ctrlKey (or metaKey for Mac) or pinch gesture (deltaY !== 0 && ctrlKey)
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      let newZoom = zoom * (e.deltaY > 0 ? 0.9 : 1.1);
      newZoom = Math.max(0.2, Math.min(3, newZoom));
      setZoom(newZoom);
    }
  };

  // Edit Node Popup Movement
  useEffect(() => {
    if (!draggingEditPopup) return;
    const handleMouseMove = (e) => {
      setEditNodePopupPos({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    };
    const handleMouseUp = () => setDraggingEditPopup(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingEditPopup, dragOffset]);

  // Export SVG handler
  const handleExportSVG = () => {
    const svg = document.querySelector('.condec-canvas');
    if (!svg) return;
    // Clone and clean up SVG for export
    const clone = svg.cloneNode(true);
    // Remove any interactive overlays or invisible lines if needed
    // Optionally set width/height attributes for better compatibility
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', svg.clientWidth || 800);
    clone.setAttribute('height', svg.clientHeight || 600);
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'condec-diagram.svg';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Function to handle canvas clicks
  const handleCanvasClick = (e) => {
    if (e.target.classList.contains('condec-canvas')) {
      if (mode === 'addActivity') {
        handleAddNode(e);
      } else if (mode !== 'select') {
        setSelectedElement(null);
      }
    }
  };

  // Handle mouse down for selection box
  const handleSelectionMouseDown = (e) => {
    if (mode !== 'select') return;

    const svg = document.querySelector('.condec-canvas');
    if (!svg || !e.target.classList.contains('condec-canvas')) return;

    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left - canvasOffset.x) / zoom;
    const y = (e.clientY - rect.top - canvasOffset.y) / zoom;

    setSelectionStart({ x, y });
    setSelectionBox({
      x: x,
      y: y,
      width: 0,
      height: 0
    });
  };

  // Handle mouse move for selection box
  const handleSelectionMouseMove = (e) => {
    if (!selectionStart || mode !== 'select') return;

    const svg = document.querySelector('.condec-canvas');
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const currentX = (e.clientX - rect.left - canvasOffset.x) / zoom;
    const currentY = (e.clientY - rect.top - canvasOffset.y) / zoom;

    // Calculate the dimensions of the selection box
    const x = Math.min(selectionStart.x, currentX);
    const y = Math.min(selectionStart.y, currentY);
    const width = Math.abs(currentX - selectionStart.x);
    const height = Math.abs(currentY - selectionStart.y);

    setSelectionBox({ x, y, width, height });
  };

  // Handle mouse up for selection box
  const handleSelectionMouseUp = () => {
    if (!selectionBox || mode !== 'select') {
      setSelectionStart(null);
      setSelectionBox(null);
      return;
    }

    // Find nodes that are completely within the selection box
    const selectedNodes = diagram.nodes.filter(node => {
      // Assuming node width/height is 100x50
      const nodeLeft = node.x - 50;
      const nodeRight = node.x + 50;
      const nodeTop = node.y - 25;
      const nodeBottom = node.y + 25;

      return (
        nodeLeft >= selectionBox.x &&
        nodeRight <= selectionBox.x + selectionBox.width &&
        nodeTop >= selectionBox.y &&
        nodeBottom <= selectionBox.y + selectionBox.height
      );
    });

    // Update selection if any nodes are selected
    if (selectedNodes.length > 0) {
      setSelectedElement({
        type: 'node',
        element: selectedNodes[0],
        multiSelect: selectedNodes.length > 1 ? selectedNodes : null
      });
    }

    // Clear selection box
    setSelectionStart(null);
    setSelectionBox(null);
  };

  // --- Unified Edit Popup for Node and Relation ---

  // Renders the unified edit popup for node or relation
  const renderEditPopup = () => {
    // Node Edit
    if (editNodePopup) {
      const node = editNodePopup.node;
      const popupStyle = {
        position: 'fixed',
        left: editNodePopupPos.x !== null ? editNodePopupPos.x : '50%',
        top: editNodePopupPos.y !== null ? editNodePopupPos.y : '50%',
        transform:
          editNodePopupPos.x === null && editNodePopupPos.y === null
            ? 'translate(-50%, -50%)'
            : undefined,
        zIndex: 2000,
        background: '#fff',
        border: '1.5px solid #1976d2',
        borderRadius: 8,
        boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
        minWidth: 260,
        maxWidth: 320,
        padding: 16,
        width: 280,
        cursor: draggingEditPopup ? 'move' : 'default',
        userSelect: draggingEditPopup ? 'none' : 'auto'
      };
      return (
        <div
          className="condec-edit-node-popup"
          style={popupStyle}
        >
          <div
            className="condec-edit-node-popup-header"
            style={{
              fontWeight: 600,
              fontSize: 16,
              color: '#1976d2',
              marginBottom: 12,
              cursor: 'move',
              userSelect: 'none'
            }}
            onMouseDown={e => {
              const rect = e.currentTarget.parentNode.getBoundingClientRect();
              setDragOffset({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
              });
              setDraggingEditPopup(true);
            }}
          >
            <span role="img" aria-label="wrench" style={{marginRight:8}}>🔧</span>
            Edit Node
          </div>
          <div className="property-group">
            <label>Name:</label>
            <input
              type="text"
              value={node.name}
              onChange={e => {
                const newName = e.target.value;
                setEditNodePopup(prev => ({
                  ...prev,
                  node: { ...prev.node, name: newName }
                }));
              }}
              onBlur={() => saveToUndoStack()}
            />
          </div>
          <div className="property-group">
            <label>Constraint:</label>
            <select
              value={node.constraint || ''}
              onChange={e => {
                const newConstraint = e.target.value || null;
                setEditNodePopup(prev => ({
                  ...prev,
                  node: { ...prev.node, constraint: newConstraint }
                }));
              }}
            >
              <option value="">None</option>
              <option value={CONSTRAINTS.ABSENCE}>Absence (0)</option>
              <option value={CONSTRAINTS.ABSENCE_N}>Absence (0..n)</option>
              <option value={CONSTRAINTS.EXISTENCE_N}>Existence (n..*)</option>
              <option value={CONSTRAINTS.EXACTLY_N}>Exactly (n)</option>
              <option value={CONSTRAINTS.INIT}>Init</option>
            </select>
          </div>
          {(node.constraint === CONSTRAINTS.ABSENCE_N ||
            node.constraint === CONSTRAINTS.EXISTENCE_N ||
            node.constraint === CONSTRAINTS.EXACTLY_N) && (
            <div className="property-group">
              <label>Constraint Value (n):</label>
              <input
                type="number"
                min="1"
                value={node.constraintValue || 1}
                onChange={e => {
                  const newValue = parseInt(e.target.value) || 1;
                  setEditNodePopup(prev => ({
                    ...prev,
                    node: { ...prev.node, constraintValue: newValue }
                  }));
                }}
              />
            </div>
          )}
          <div className="property-group">
            <label>Position (X, Y):</label>
            <div className="position-inputs">
              <input
                type="number"
                value={Math.round(node.x)}
                onChange={e => {
                  const newX = parseInt(e.target.value) || 0;
                  setEditNodePopup(prev => ({
                    ...prev,
                    node: { ...prev.node, x: newX }
                  }));
                }}
              />
              <input
                type="number"
                value={Math.round(node.y)}
                onChange={e => {
                  const newY = parseInt(e.target.value) || 0;
                  setEditNodePopup(prev => ({
                    ...prev,
                    node: { ...prev.node, y: newY }
                  }));
                }}
              />
            </div>
          </div>
          <div style={{display:'flex',gap:12,marginTop:18}}>
            <button
              style={{flex:1,background:'#1976d2',color:'#fff',border:'none',borderRadius:4,padding:'8px 0',fontWeight:600}}
              onClick={() => {
                saveToUndoStack();
                setDiagram(diagram => ({
                  ...diagram,
                  nodes: diagram.nodes.map(n =>
                    n.id === node.id ? { ...node } : n
                  )
                }));
                setEditNodePopup(null);
                setEditNodePopupPos({ x: null, y: null });
                setSelectedElement({ type: 'node', element: { ...node } });
              }}
            >Save</button>
            <button
              style={{flex:1,background:'#eee',color:'#333',border:'none',borderRadius:4,padding:'8px 0'}}
              onClick={() => {
                setEditNodePopup(null);
                setEditNodePopupPos({ x: null, y: null });
              }}
            >Cancel</button>
          </div>
        </div>
      );
    }

    // Relation Edit
    if (selectedElement && selectedElement.type === 'relation') {
      const relation = selectedElement.element;
      const relationTypeOptions = Object.values(RELATION_TYPES).map((value) => (
        <option key={value} value={value}>{value}</option>
      ));
      
      return (
        <div
          className="condec-edit-relation-popup"
          style={{
            position: 'fixed',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 3000,
            background: '#fff',
            border: '1.5px solid #1976d2',
            borderRadius: 8,
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
            minWidth: 320,
            maxWidth: 400,
            padding: 24
          }}
        >
          <h3 style={{marginTop:0,marginBottom:18,fontSize:18,color:'#1976d2'}}>Edit Relation</h3>
          <div className="property-group">
            <label>Type:</label>
            <select
              value={relation.type}
              onChange={e => {
                const newType = e.target.value;
                saveToUndoStack();
                const updatedRelations = diagram.relations.map(r => {
                  if (r.id === relation.id) {
                    return { ...r, type: newType };
                  }
                  return r;
                });
                setDiagram({ ...diagram, relations: updatedRelations });
                setSelectedElement(prev => ({ ...prev, element: { ...prev.element, type: newType } }));
              }}
            >
              {relationTypeOptions}
            </select>
          </div>
          <div className="property-group">
            <label>Source:</label>
            <select
              value={relation.sourceId}
              onChange={e => {
                const newSourceId = e.target.value;
                saveToUndoStack();
                const updatedRelations = diagram.relations.map(r => {
                  if (r.id === relation.id) {
                    return { ...r, sourceId: newSourceId };
                  }
                  return r;
                });
                setDiagram({ ...diagram, relations: updatedRelations });
                setSelectedElement(prev => ({ ...prev, element: { ...prev.element, sourceId: newSourceId } }));
              }}
            >
              {diagram.nodes.map(node => (
                <option key={node.id} value={node.id}>{node.name}</option>
              ))}
            </select>
          </div>
          <div className="property-group">
            <label>Target:</label>
            <select
              value={relation.targetId}
              onChange={e => {
                const newTargetId = e.target.value;
                saveToUndoStack();
                const updatedRelations = diagram.relations.map(r => {
                  if (r.id === relation.id) {
                    return { ...r, targetId: newTargetId };
                  }
                  return r;
                });
                setDiagram({ ...diagram, relations: updatedRelations });
                setSelectedElement(prev => ({ ...prev, element: { ...prev.element, targetId: newTargetId } }));
              }}
            >
              {diagram.nodes.map(node => (
                <option key={node.id} value={node.id}>{node.name}</option>
              ))}
            </select>
          </div>
          <div style={{display:'flex',gap:12,marginTop:18}}>
            <button
              style={{flex:1,background:'#d32f2f',color:'#fff',border:'none',borderRadius:4,padding:'8px 0'}}
              onClick={handleDelete}
            >Delete</button>
            <button
              style={{flex:1,background:'#eee',color:'#333',border:'none',borderRadius:4,padding:'8px 0'}}
              onClick={() => setSelectedElement(null)}
            >Close</button>
          </div>
        </div>
      );
    }

    return null;
  };

  // Render palette (icon-only, vertical, left side)
  const renderPalette = () => {
    return (
      <div className="condec-palette condec-palette-left" style={{
        position: 'absolute',
        left: '10px',
        top: '20%',
        transform: 'translateY(-50%)',
        background: '#f5f5f5',
        border: '1px solid #e0e0e0',
        borderRadius: '4px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
        zIndex: 10
      }}>
        <div className="palette-group" style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '6px'
        }}>
          {/* Hand Tool */}
          <div
            className={`palette-entry ${mode === 'hand' ? 'active' : ''}`}
            onClick={() => setMode('hand')}
            title="Hand Tool (H)"
            style={{
              cursor: 'pointer',
              padding: '8px',
              margin: '2px 0',
              borderRadius: '4px',
              background: mode === 'hand' ? '#e3f2fd' : 'transparent',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}
            >

            <svg width="30" height="30" viewBox="0 0 2000 2000" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="2000" height="2000" rx="8" fill="none"/><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000" fill="#000000" x="0" y="0" width="2000" height="2000"><path fill="none" stroke="#000000" stroke-width="67.5" d="M806.673 1750.205h621.961c22.031-70.25 62.033-342.206 146.35-560.816c109.703-284.426 222.535-533.47 79.188-558.11c-114.053-22.16-164.268 222.17-239.25 378.398c0 0-.735-152.653-1.608-319.073c-.925-176.455 20.91-388.517-71.236-381.548c-95.054-6.969-102.434 176.632-127.533 313.704C1187.657 769.598 1163 921.667 1163 921.667s-25.608-129.884-43.734-309.888c-16.45-163.37-23.671-382.574-120.066-378.476c-114.205-4.098-91.583 212.301-89.508 386.42c1.627 136.477-3.108 300.727-3.108 300.727s-61.033-149.246-92.487-232.773c-62.058-160.334-116.378-320.83-230.62-269.78c-101.186 47.595-9.532 225.224 39.893 407.56c43.362 159.965 86.72 332.892 86.72 332.892s-293.095-367.544-429.6-246.644c-120.896 113.1 66.75 220.16 245.33 434.345c101.267 121.459 208.574 310.194 280.852 404.155z"/></svg></svg>
          </div>

          {/* Select Tool */}
          <div
            className={`palette-entry ${mode === 'select' ? 'active' : ''}`}
            onClick={() => setMode('select')}
            title="Select Tool (S)"
            style={{
              cursor: 'pointer',
              padding: '8px',
              margin: '2px 0',
              borderRadius: '4px',
              background: mode === 'select' ? '#e3f2fd' : 'transparent',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 2000 2000"><g fill="none" stroke="currentColor"><path stroke-linejoin="round" stroke-width="205.238" d="M1304.97 699.019H868.856"/><path stroke-width="80" d="M1566.732 696.368h285.2v273.246m.001 592.034v273.247h-277.985m277.304-652.426v153.246m-1140.123 228.21v273.247h277.984m209.817 0h165.201"/><path stroke-linejoin="round" stroke-width="205.238" d="M708.49 104.8v436.115m0 323.815v436.114M545.042 699.019H108.927"/></g></svg>
          </div>
          
          {/* Add Relation Tool - Arrow Icon */}
          <div
            className={`palette-entry ${mode === 'addRelation' ? 'active' : ''}`}
            onClick={() => setMode('addRelation')}
            title="Add Relation"
            style={{
              cursor: 'pointer',
              padding: '8px',
              margin: '2px 0',
              borderRadius: '4px',
              background: mode === 'addRelation' ? '#e3f2fd' : 'transparent',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 2048 2048"><path fill="currentColor" d="M1866.407 206.692s-585.454 298.724-882.844 438.406c63.707 58.178 122.963 120.927 184.437 181.407c-302.353 306.387-604.71 612.769-907.062 919.156c22.172 21.16 44.327 42.309 66.5 63.469c302.352-306.388 604.71-612.738 907.062-919.125c61.588 61.37 122.828 123.086 184.438 184.437c158.845-312.83 447.469-867.75 447.469-867.75z"/></svg>
          </div>
          
          {/* Add Activity Tool - Box Icon */}
          <div
            className={`palette-entry ${mode === 'addActivity' ? 'active' : ''}`}
            onClick={() => setMode('addActivity')}
            title="Add Activity"
            style={{
              cursor: 'pointer',
              padding: '8px',
              margin: '2px 0',
              borderRadius: '4px',
              background: mode === 'addActivity' ? '#e3f2fd' : 'transparent',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 2048 2048"><rect width="17.563" height="14.478" x="1.23" y="1035.052" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.034" rx="2.759" transform="translate(55.328 -99820.702) scale(96.7529)"/></svg>
          </div>
        </div>
      </div>
    );
  };

  // If diagram is not loaded yet, show loading
  if (!diagram) {
    return <div>Loading ConDec Modeler...</div>;
  }

  // Ensure the modeler always fills its parent or viewport if used standalone
  const wrapperStyle = {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    minWidth: 0,
    flex:1,
    ...style,
    position: 'relative',
    background: '#fafbfc'
  };

  return (
    <div className="condec-modeler-wrapper" style={wrapperStyle}>
      {/* --- Button bar at the top --- */}
      <div className="condec-button-bar" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: '#fafbfc',
        zIndex: 20,
        padding: '10px 16px',
        borderBottom: '1px solid #e0e0e0'
      }}>
        <button 
          onClick={() => setDiagram(initialDiagram)} 
          title="New Diagram"
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            height: '36px',
            minWidth: '80px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          New
        </button>
        <button 
          onClick={() => {
            // Export as XML
            const xmlString = diagramToXML(diagram);
            const blob = new Blob([xmlString], { type: 'application/xml' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'condec-diagram.xml';
            link.click();
            URL.revokeObjectURL(url);
          }} 
          
          title="Export Diagram (XML)"
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            height: '36px',
            minWidth: '80px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          Export
        </button>
        <button 
          onClick={handleExportSVG} 
          title="Export SVG"
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            height: '36px',
            minWidth: '80px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          Export SVG
        </button>
        <label 
          className="import-button" 
          title="Import Diagram (JSON)" 
          style={{ 
            background: '#43a047', 
            color: '#fff', 
            border: 'none', 
            borderRadius: '4px', 
            padding: '8px 16px', 
            fontWeight: 500,
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '14px',
            minWidth: '80px'
          }}
        >
          Import
          <input type="file" accept=".json" onChange={(event) => {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
              try {
                const importedDiagram = JSON.parse(e.target.result);

                if (importedDiagram &&
                    Array.isArray(importedDiagram.nodes) &&
                    Array.isArray(importedDiagram.relations)) {
                  saveToUndoStack();
                  setDiagram(importedDiagram);
                  setSelectedElement(null); // Deselect after import
                } else {
                  alert('Invalid diagram format. Required properties: nodes (array), relations (array).');
                }
              } catch (error) {
                alert('Error importing diagram. Please check the file format.');
                console.error('Import error:', error);
              }
            };

            reader.readAsText(file);
            event.target.value = null;
          }} style={{ display: 'none' }} />
        </label>
      </div>
      {/* --- Main modeler area --- */}
      <div className="condec-modeler-container" style={{
        display: 'flex',
        flexDirection: 'row',
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        position: 'relative',
        width: '100%',
        height: '100%'
      }}>
        <ConDecCanvas
          diagram={diagram}
          selectedElement={selectedElement}
          mode={mode}
          onSelectElement={handleElementSelect}
          onNodeRename={handleNodeRename}
          onRelationCreate={handleRelationCreate} 
          onNodeEdit={updatedNodes => setDiagram({ ...diagram, nodes: updatedNodes })}
          onRelationEdit={handleRelationEdit}
          newRelation={newRelation}
          setNewRelation={setNewRelation}
          mousePosition={mousePosition}
          setMousePosition={setMousePosition}
          draggedElement={draggedElement}
          setDraggedElement={setDraggedElement}
          onCanvasClick={handleCanvasClick}
          canvasOffset={canvasOffset}
          setCanvasOffset={setCanvasOffset}
          onCanvasMouseDown={handleCanvasMouseDown}
          onSelectionMouseMove={handleSelectionMouseMove}
          onSelectionMouseUp={handleSelectionMouseUp}
          zoom={zoom}
          onCanvasWheel={handleCanvasWheel}
          selectionBox={selectionBox}
          onNodeMenuEdit={node => {
            setEditNodePopup({ node: { ...node } });
            setEditNodePopupPos({ x: null, y: null });
          }}
          onNodeMenuDelete={handleDelete}
          onNodeMenuClose={() => setSelectedElement(null)}
          isPanning={isPanning}
          setIsPanning={setIsPanning}
          panStart={panStart}
          setPanStart={setPanStart}
          panOrigin={panOrigin}
          setPanOrigin={setPanOrigin}
          onNodeDragStart={handleNodeDragStart}
          onNodeDrag={handleNodeDrag}
          onAppend={handleAppendActivity}
        />
        {renderEditPopup()}
        {renderPalette()}
      </div>
    </div>
  );
};

export default ConDecModeler;