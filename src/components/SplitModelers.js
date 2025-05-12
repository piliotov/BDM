import React, { useState, useEffect } from 'react';
import BpmnModeler from './BpmnModeler';
import ConDecModeler from './ConDecModeler';

// --- Constants and reusable UI ---
const VIEW_MODE_STORAGE_KEY = 'modeler-view-mode';
const VIEW_MODES = { SPLIT: 'split', BPMN: 'bpmn', CONDEC: 'condec' };

// Reusable view mode button
const ViewModeButton = ({ active, onClick, children }) => (
  <button className={`view-mode-btn${active ? ' active' : ''}`} onClick={onClick}>
    {children}
  </button>
);

// --- Main Split Modelers Component ---
/**
 * Renders BPMN and ConDec modelers side by side or individually.
 */
const SplitModelers = () => {
  const [viewMode, setViewMode] = useState(
    localStorage.getItem(VIEW_MODE_STORAGE_KEY) || VIEW_MODES.SPLIT
  );
  useEffect(() => { localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode); }, [viewMode]);

  // Render view mode selector
  const renderViewModeButtons = () => (
    <div className="view-mode-buttons">
      {Object.entries(VIEW_MODES).map(([key, mode]) => (
        <ViewModeButton
          key={mode}
          active={viewMode === mode}
          onClick={() => setViewMode(mode)}
        >
          {mode.charAt(0).toUpperCase() + mode.slice(1) + (mode === 'split' ? ' View' : ' Only')}
        </ViewModeButton>
      ))}
    </div>
  );

  return (
    <div className="split-modeler-container" style={{
      width: '100vw',
      height: '100vh',
      minHeight: 0,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* View mode selector bar */}
      <div className="view-mode-controls">{renderViewModeButtons()}</div>
      {/* Modelers container */}
      <div
        className={`modelers-container ${viewMode}`}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: viewMode === VIEW_MODES.SPLIT ? 'row' : 'column',
          width: '100%',
          height: '100%',
          minHeight: 0,
          minWidth: 0
        }}
      >
        {(viewMode === VIEW_MODES.SPLIT) && (
          <>
            <div className="modeler-half" style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
              <BpmnModeler />
            </div>
            <div className="modeler-half" style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
              <ConDecModeler width="100%" height="100%" />
            </div>
          </>
        )}
        {(viewMode === VIEW_MODES.BPMN) && (
          <div className="modeler-full" style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
            <BpmnModeler />
          </div>
        )}
        {(viewMode === VIEW_MODES.CONDEC) && (
          <div className="modeler-full" style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
            <ConDecModeler width="100%" height="100%" />
          </div>
        )}
      </div>
    </div>
  );
};

export default SplitModelers;