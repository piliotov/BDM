import React, { useEffect, useState, useCallback } from 'react';
import '../styles/ConDecModeler.css';
import { ConDecCanvas } from './ConDecCanvas';
import { RELATION_TYPES } from './ConDecRelations';
import { ConDecNodeMenu } from './ConDecNodeMenu';
import { RELATION_TYPES as ALL_RELATION_TYPES } from './ConDecRelations';

// Constants for local storage
const LOCAL_STORAGE_KEY = 'condec-diagram';

// ConDec node types
const NODE_TYPES = {
  ACTIVITY: 'activity'
};

// Define constraints
const CONSTRAINTS = {
  ABSENCE: 'absence',           // Activity cannot be executed
  ABSENCE_N: 'absence_n',       // Activity can be executed at most n times
  EXISTENCE_N: 'existence_n',   // Activity must be executed at least n times
  EXACTLY_N: 'exactly_n',       // Activity must be executed exactly n times
  INIT: 'init'                  // Activity must be the first executed activity
};

// Initial diagram with a default activity
const initialDiagram = {
  nodes: [
    {
      id: 'activity_1',
      type: NODE_TYPES.ACTIVITY,
      name: 'Activity',
      x: 150,
      y: 150,
      constraint: null,
      constraintValue: null
    }
  ],
  relations: []
};

// Helper: Convert diagram to ConDec XML string (custom format)
function diagramToXML(diagram) {
  function escapeXml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Map node.id to numeric id for export
  const activityIdMap = {};
  diagram.nodes.forEach((node, idx) => {
    activityIdMap[node.id] = (idx + 1).toString();
  });

  // Map relation.id to numeric id for export
  const constraintIdMap = {};
  diagram.relations.forEach((rel, idx) => {
    constraintIdMap[rel.id] = (idx + 1).toString();
  });

  // Activities XML
  let activitiesXml = '';
  diagram.nodes.forEach((node, idx) => {
    activitiesXml += `    <activity id="${activityIdMap[node.id]}" name="${escapeXml(node.name)}"><authorization/><datamodel/></activity>\n`;
  });

  // Constraints XML
  let constraintsXml = '';
  diagram.relations.forEach((rel, idx) => {
    const constraintId = constraintIdMap[rel.id];
    const sourceNode = diagram.nodes.find(n => n.id === rel.sourceId);
    const targetNode = diagram.nodes.find(n => n.id === rel.targetId);
    // Template: use relation type as name/display/text, and source/target as parameters
    const templateName = escapeXml(rel.type.replace(/_/g, ' '));
    const sourceName = sourceNode ? escapeXml(sourceNode.name) : '';
    const targetName = targetNode ? escapeXml(targetNode.name) : '';
    constraintsXml += `    <constraint id="${constraintId}" mandatory="true">\n`;
    constraintsXml += `      <condition/>\n`;
    constraintsXml += `      <name>${templateName}</name>\n`;
    constraintsXml += `      <template>\n`;
    constraintsXml += `        <description>${templateName} constraint between ${sourceName} and ${targetName}</description>\n`;
    constraintsXml += `        <display>${templateName}</display>\n`;
    constraintsXml += `        <name>${templateName}</name>\n`;
    constraintsXml += `        <text>(${sourceName}) -&gt; (${targetName})</text>\n`;
    constraintsXml += `        <parameters>\n`;
    constraintsXml += `          <parameter branchable="true" id="1" name="${sourceName}">\n`;
    constraintsXml += `            <graphical><style number="1"/><begin fill="true" style="5"/><middle fill="false" style="0"/><end fill="false" style="0"/></graphical>\n`;
    constraintsXml += `          </parameter>\n`;
    constraintsXml += `          <parameter branchable="true" id="2" name="${targetName}">\n`;
    constraintsXml += `            <graphical><style number="1"/><begin fill="false" style="0"/><middle fill="false" style="0"/><end fill="false" style="0"/></graphical>\n`;
    constraintsXml += `          </parameter>\n`;
    constraintsXml += `        </parameters>\n`;
    constraintsXml += `        <statemessages>\n`;
    constraintsXml += `          <message state="VIOLATED">VIOLATED undefined</message>\n`;
    constraintsXml += `          <message state="VIOLATED_TEMPORARY">VIOLATED_TEMPORARY undefined</message>\n`;
    constraintsXml += `          <message state="SATISFIED">SATISFIED undefined</message>\n`;
    constraintsXml += `        </statemessages>\n`;
    constraintsXml += `      </template>\n`;
    constraintsXml += `      <constraintparameters>\n`;
    constraintsXml += `        <parameter templateparameter="1"><branches><branch name="${sourceName}"/></branches></parameter>\n`;
    constraintsXml += `        <parameter templateparameter="2"><branches><branch name="${targetName}"/></branches></parameter>\n`;
    constraintsXml += `      </constraintparameters>\n`;
    constraintsXml += `    </constraint>\n`;
  });

  // Graphical activities
  let graphicalActivitiesXml = '';
  diagram.nodes.forEach((node, idx) => {
    // Default width/height as in your sample: width="90.0" height="50.0"
    // x/y from node.x/node.y (rounded to 1 decimal)
    graphicalActivitiesXml += `        <cell height="50.0" id="${activityIdMap[node.id]}" width="90.0" x="${Number(node.x).toFixed(1)}" y="${Number(node.y).toFixed(1)}"/>\n`;
  });

  // Graphical constraints (just place at midpoint between source and target)
  let graphicalConstraintsXml = '';
  diagram.relations.forEach((rel, idx) => {
    const constraintId = constraintIdMap[rel.id];
    const sourceNode = diagram.nodes.find(n => n.id === rel.sourceId);
    const targetNode = diagram.nodes.find(n => n.id === rel.targetId);
    let x = 0, y = 0;
    if (sourceNode && targetNode) {
      x = ((Number(sourceNode.x) + Number(targetNode.x)) / 2).toFixed(1);
      y = ((Number(sourceNode.y) + Number(targetNode.y)) / 2).toFixed(1);
    }
    graphicalConstraintsXml += `        <cell height="1.0" id="${constraintId}" width="1.0" x="${x}" y="${y}"/>\n`;
  });

  // Compose the full XML
  let xml = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n';
  xml += '<model><assignment language="ConDec" name="new model">\n';
  xml += '  <activitydefinitions>\n';
  xml += activitiesXml;
  xml += '  </activitydefinitions>\n';
  xml += '  <constraintdefinitions>\n';
  xml += constraintsXml;
  xml += '  </constraintdefinitions>\n';
  xml += '  <data/>\n';
  xml += '  <team/>\n';
  xml += '  <graphical>\n';
  xml += '    <activities>\n';
  xml += graphicalActivitiesXml;
  xml += '    </activities>\n';
  xml += '    <constraints>\n';
  xml += graphicalConstraintsXml;
  xml += '    </constraints>\n';
  xml += '  </graphical>\n';
  xml += '</assignment></model>\n';
  return xml;
}

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
  // Remove panning states
  // const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  // const [isPanning, setIsPanning] = useState(false);
  // const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  // const [panOrigin, setPanOrigin] = useState({ x: 0, y: 0 });
  
  // Calculate the center offset based on window size
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });

  // Update canvas size and center offset when window resizes
  useEffect(() => {
    const updateCanvasSize = () => {
      const container = document.querySelector('.condec-canvas-container');
      if (container) {
        const { width, height } = container.getBoundingClientRect();
        setCanvasSize({ width, height });
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

  // Save current state to undo stack
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

  // Handle double click on node to rename
  const handleNodeRename = (nodeId, newName) => {
    if (!newName || !newName.trim()) return;
    saveToUndoStack();
    const updatedNodes = diagram.nodes.map(n =>
      n.id === nodeId ? { ...n, name: newName } : n
    );
    setDiagram({ ...diagram, nodes: updatedNodes });
    if (selectedElement?.type === 'node' && selectedElement.element.id === nodeId) {
      setSelectedElement(prev => ({ ...prev, element: { ...prev.element, name: newName } }));
    }
  };

  // Handle adding new node
  const handleAddNode = (e) => {
    if (!mode.startsWith('add')) return;

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

    setDiagram({
      ...diagram,
      nodes: [...diagram.nodes, newNode]
    });

    setSelectedElement({
      type: 'node',
      element: newNode
    });

    setMode('hand');
  };

  // Function to check if a relation is allowed
  const isRelationAllowed = (diagram, sourceId, targetId) => {
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
  };

  // Create a new relation
  const handleRelationCreate = (sourceId, targetId) => {
    // Check if the relation is allowed
    if (!isRelationAllowed(diagram, sourceId, targetId)) {
      alert("Cannot create this relation due to target node constraints.");
      setNewRelation(null);
      return;
    }

    const sourceNode = diagram.nodes.find(n => n.id === sourceId);
    const targetNode = diagram.nodes.find(n => n.id === targetId);
    
    if (!sourceNode || !targetNode) {
      setNewRelation(null);
      return;
    }
    
    // Calculate initial waypoints
    const sourcePoint = { x: sourceNode.x, y: sourceNode.y };
    const targetPoint = { x: targetNode.x, y: targetNode.y };
    
    // Calculate edge intersection points
    const calculateIntersectionPoint = (source, target, width = 100, height = 50) => {
      // Simplified implementation for this example
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const nx = dx / length;
      const ny = dy / length;
      
      return {
        x: source.x + nx * 50, // 50 is half the node width
        y: source.y + ny * 25  // 25 is half the node height
      };
    };
    
    const sourceEdgePoint = calculateIntersectionPoint(targetPoint, sourcePoint);
    const targetEdgePoint = calculateIntersectionPoint(sourcePoint, targetPoint);
    
    const waypoints = [
      { x: sourceEdgePoint.x, y: sourceEdgePoint.y },
      { x: targetEdgePoint.x, y: targetEdgePoint.y }
    ];

    const newRelationObj = {
      id: `relation_${Date.now()}`,
      type: RELATION_TYPES.RESPONSE, // Default type
      sourceId: sourceId,
      targetId: targetId,
      waypoints: waypoints // Store the waypoints
    };

    saveToUndoStack();

    setDiagram(prevDiagram => ({
      ...prevDiagram,
      relations: [...prevDiagram.relations, newRelationObj]
    }));

    setSelectedElement({
      type: 'relation',
      element: newRelationObj
    });
    setNewRelation(null); // Clear temporary relation state
  };

  // Handle relation edits (including waypoint updates)
  const handleRelationEdit = (updatedRelations) => {
    // Save to undo stack before making changes
    saveToUndoStack();
    
    setDiagram(prevDiagram => ({
      ...prevDiagram,
      relations: updatedRelations
    }));
    
    // If there's a selected relation, update the selected element reference
    if (selectedElement?.type === 'relation') {
      const updatedRelation = updatedRelations.find(r => r.id === selectedElement.element.id);
      if (updatedRelation) {
        setSelectedElement({
          type: 'relation',
          element: updatedRelation
        });
      }
    }
  };

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

  // Save diagram as image (PNG) - using html2canvas
  const handleExportImage = () => {
    const svgElement = document.querySelector('.condec-canvas');
    if (!svgElement) return;

    // Convert SVG to canvas
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Create an image to load the SVG data
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      // Set canvas size to match SVG
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw the SVG image onto the canvas
      ctx.drawImage(img, 0, 0);

      // Convert canvas to data URL and trigger download
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'diagram.png';
        link.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
    };

    img.src = url;
  };

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

    // Find relations that have both source and target nodes in the selection
    const selectedRelations = diagram.relations.filter(relation => {
      const sourceNode = selectedNodes.find(n => n.id === relation.sourceId);
      const targetNode = selectedNodes.find(n => n.id === relation.targetId);
      return sourceNode && targetNode;
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
      const relationTypeOptions = Object.entries(ALL_RELATION_TYPES).map(([, value]) => (
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
            <svg fill="#000000" height="64px" width="64px" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg"
            viewBox="-28.71 -28.71 344.50 344.50"
            transform="matrix(1, 0, 0, 1, 0, 0)rotate(0)">
            <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
            <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
            <g id="SVGRepo_iconCarrier"> <g> <path d="M218.188,239.917H118c-5.126,0-9.282,4.156-9.282,9.282v28.603c0,5.126,4.156,9.282,9.282,9.282h100.187 
            c5.126,0,9.282-4.156,9.282-9.282v-28.603C227.47,244.073,223.314,239.917,218.188,239.917z"></path> 
            <path d="M233.687,49.327c-8.108-1.647-16.039,3.58-17.697,11.697l-7.142,34.981c-0.269,1.317-1.518,2.195-2.848,2.004 
            c-1.33-0.192-2.28-1.387-2.166-2.726l5.421-63.68c0.772-9.072-5.957-17.054-15.029-17.826c-9.066-0.773-17.054,5.957-17.826,15.029 
            l-4.616,54.232c-0.121,1.421-1.341,2.494-2.765,2.434c-1.425-0.061-2.549-1.233-2.549-2.66V16.487 C166.469,7.382,159.087,0,149.981,0s-16.487,
            7.382-16.487,16.487v65.28c0,1.168-0.91,2.133-2.076,2.201 c-1.166,0.069-2.183-0.784-2.319-1.943l-6.245-52.997c-1.065-9.042-9.261-15.513-18.304-14.444 
            c-9.043,1.065-15.51,9.261-14.444,18.304L102.98,142.14c0.166,1.408-0.586,2.764-1.867,3.37c-1.281,0.606-2.807,0.327-3.79-0.695 
            l-27.565-28.631c-6.314-6.559-16.751-6.758-23.312-0.442c-6.56,6.315-6.758,16.752-0.442,23.312l65.413,67.943 c7.546,9.91,19.462,16.323,32.851,16.323h39.536c24.077,0,
            43.666-19.588,43.666-43.665c0-16.546,1.668-33.05,4.977-49.262 l12.937-63.369C247.04,58.908,241.804,50.984,233.687,49.327z"></path> 
            </g> 
            </g>
            </svg>
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
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" transform="rotate(180)">
              <g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round"
                stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fill-rule="evenodd" clip-rule="evenodd"
                d="M5 6C5.55228 6 6 5.55228 6 5C6 4.44772 5.55228 4 5 4C4.44772 4 4 4.44772 4 5C4 5.55228 4.44772 6 5 
                6ZM18 13C18 12.4477 17.5523 12 17 12C16.4477 12 16 12.4477 16 13V16H13C12.4477 16 12 16.4477 12 17C12 
                17.5523 12.4477 18 13 18H16V21C16 21.5523 16.4477 22 17 22C17.5523 22 18 21.5523 18 21V18H21C21.5523 
                18 22 17.5523 22 17C22 16.4477 21.5523 16 21 16H18V13ZM10 5C10 5.55228 9.55228 6 9 6C8.44771 6 8 5.55228 
                8 5C8 4.44772 8.44771 4 9 4C9.55228 4 10 4.44772 10 5ZM13 6C13.5523 6 14 5.55228 14 5C14 4.44772 13.5523 
                4 13 4C12.4477 4 12 4.44772 12 5C12 5.55228 12.4477 6 13 6ZM18 5C18 5.55228 17.5523 6 17 6C16.4477 6 16 
                5.55228 16 5C16 4.44772 16.4477 4 17 4C17.5523 4 18 4.44772 18 5ZM17 10C17.5523 10 18 9.55228 18 9C18 
                8.44771 17.5523 8 17 8C16.4477 8 16 8.44771 16 9C16 9.55228 16.4477 10 17 10ZM10 17C10 17.5523 9.55228 
                18 9 18C8.44771 18 8 17.5523 8 17C8 16.4477 8.44771 16 9 16C9.55228 16 10 16.4477 10 17ZM5 18C5.55228 
                18 6 17.5523 6 17C6 16.4477 5.55228 16 5 16C4.44772 16 4 16.4477 4 17C4 17.5523 4.44772 18 5 18ZM6 13C6 
                13.5523 5.55228 14 5 14C4.44772 14 4 13.5523 4 13C4 12.4477 4.44772 12 5 12C5.55228 12 6 12.4477 6 13ZM5 
                10C5.55228 10 6 9.55228 6 9C6 8.44771 5.55228 8 5 8C4.44772 8 4 8.44771 4 9C4 9.55228 4.44772 10 5 10Z" 
                fill="#000000"></path> 
              </g>
            </svg>
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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5,12H19" stroke="#5F6368" strokeWidth="2"/>
              <path d="M13,6L19,12L13,18" stroke="#5F6368" strokeWidth="2" fill="none"/>
            </svg>
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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="6" width="16" height="12" rx="1" stroke="#5F6368" strokeWidth="2" fill="none"/>
              <line x1="12" y1="9" x2="12" y2="15" stroke="#5F6368" strokeWidth="1.5"/>
              <line x1="9" y1="12" x2="15" y2="12" stroke="#5F6368" strokeWidth="1.5"/>
            </svg>
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
        />
        {renderEditPopup()}
        {renderPalette()}
      </div>
    </div>
  );
};
export default ConDecModeler;