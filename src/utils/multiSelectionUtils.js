// Returns array of nodes fully inside the selection rectangle
export function getNodesInMultiSelectionBox(nodes, selectionBox) {
  if (!selectionBox) return [];
  return nodes.filter(node => {
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
}

// Returns bounding box {x, y, width, height} for a list of nodes
export function getBoundingBoxForMultiSelectedNodes(nodes) {
  if (!nodes || nodes.length === 0) return null;
  const left = Math.min(...nodes.map(n => n.x - 50));
  const right = Math.max(...nodes.map(n => n.x + 50));
  const top = Math.min(...nodes.map(n => n.y - 25));
  const bottom = Math.max(...nodes.map(n => n.y + 25));
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  };
}
