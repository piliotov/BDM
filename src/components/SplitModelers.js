import React, { useState, useEffect } from 'react';
import BpmnModeler from './BpmnModeler';
import ConDecModeler from './ConDecModeler';

// Local storage key for view mode
const VIEW_MODE_STORAGE_KEY = 'modeler-view-mode';

// View mode constants
const VIEW_MODES = {
  SPLIT: 'split',
  BPMN: 'bpmn',
  CONDEC: 'condec'
};

const SplitModelers = () => {
  // State for current view mode
  const [viewMode, setViewMode] = useState(
    localStorage.getItem(VIEW_MODE_STORAGE_KEY) || VIEW_MODES.SPLIT
  );

  // Save view mode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  // Handle view mode change
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
  };

  return (
    <div className="split-modeler-container" style={{height: '100vh', minHeight: 0, minWidth: 0, width: '100vw', overflow: 'hidden'}}>
      {/* View mode selector bar */}
      <div className="view-mode-controls">
        <div className="view-mode-buttons">
          <button
            className={viewMode === VIEW_MODES.SPLIT ? 'active' : ''}
            onClick={() => handleViewModeChange(VIEW_MODES.SPLIT)}
          >
            Split View
          </button>
          <button
            className={viewMode === VIEW_MODES.BPMN ? 'active' : ''}
            onClick={() => handleViewModeChange(VIEW_MODES.BPMN)}
          >
            BPMN Only
          </button>
          <button
            className={viewMode === VIEW_MODES.CONDEC ? 'active' : ''}
            onClick={() => handleViewModeChange(VIEW_MODES.CONDEC)}
          >
            ConDec Only
          </button>
        </div>
      </div>

      {/* Modelers container with appropriate class based on view mode */}
      <div className={`modelers-container ${viewMode}`} style={{flex: 1, display: 'flex', minHeight: 0, minWidth: 0, height: '100%'}}>
        {/* BPMN modeler (shown in SPLIT and BPMN modes) */}
        {(viewMode === VIEW_MODES.SPLIT || viewMode === VIEW_MODES.BPMN) && (
          <div className="modeler-half" style={{height: '100%', minHeight: 0, minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column'}}>
            <BpmnModeler />
          </div>
        )}
        
        {/* ConDec modeler (shown in SPLIT and CONDEC modes) */}
        {(viewMode === VIEW_MODES.SPLIT || viewMode === VIEW_MODES.CONDEC) && (
          <div className="modeler-half" style={{height: '100%', minHeight: 0, minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column'}}>
            <ConDecModeler 
              width="100%" 
              height="100%" 
              style={{flex: 1, minHeight: 0, minWidth: 0, height: '100%', width: '100%'}}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default SplitModelers;