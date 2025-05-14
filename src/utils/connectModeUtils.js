// Simple singleton state for connect mode (can be replaced with context or redux if needed)
let connectModeState = {
  isActive: false,
  sourceNodeId: null,
};

/**
 * Start connect mode from a given source node.
 * @param {string} sourceNodeId
 */
export function startConnectMode(sourceNodeId) {
  connectModeState.isActive = true;
  connectModeState.sourceNodeId = sourceNodeId;
}

/**
 * End connect mode and clear state.
 */
export function endConnectMode() {
  connectModeState.isActive = false;
  connectModeState.sourceNodeId = null;
}

/**
 * Get current connect mode state.
 * @returns {{isActive: boolean, sourceNodeId: string|null}}
 */
export function getConnectModeState() {
  return { ...connectModeState };
}

/**
 * Should handle node click as connect mode?
 * @param {string} nodeId
 * @returns {boolean}
 */
export function shouldHandleNodeClick(nodeId) {
  return connectModeState.isActive && connectModeState.sourceNodeId && nodeId !== connectModeState.sourceNodeId;
}
