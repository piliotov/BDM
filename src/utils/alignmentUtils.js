// Utility to calculate alignment guides for a point against a set of nodes
// Returns { x: number|null, y: number|null } if aligned within threshold
export function getAlignmentGuidesForPoint(point, nodes, threshold = 2) {
  if (!point || !Array.isArray(nodes)) return { x: null, y: null };
  let guideX = null, guideY = null;
  for (const n of nodes) {
    if (Math.abs(n.x - point.x) <= threshold) guideX = n.x;
    if (Math.abs(n.y - point.y) <= threshold) guideY = n.y;
  }
  return { x: guideX, y: guideY };
}

// Utility to render alignment guide SVG lines
// Usage: renderAlignmentGuidesSVG({x, y}, zoom)
export function renderAlignmentGuidesSVG(guides, zoom = 1) {
  if (!guides) return null;
  const lines = [];
  if (guides.x !== null) {
    lines.push(
      <line
        key="align-x"
        x1={guides.x}
        y1={-10000}
        x2={guides.x}
        y2={10000}
        stroke="#1976d2"
        strokeWidth={1.5/zoom}
        strokeDasharray="4,2"
        pointerEvents="none"
      />
    );
  }
  if (guides.y !== null) {
    lines.push(
      <line
        key="align-y"
        x1={-10000}
        y1={guides.y}
        x2={10000}
        y2={guides.y}
        stroke="#1976d2"
        strokeWidth={1.5/zoom}
        strokeDasharray="4,2"
        pointerEvents="none"
      />
    );
  }
  return lines.length ? <g className="alignment-guides">{lines}</g> : null;
}
