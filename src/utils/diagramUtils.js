export const NODE_TYPES = {
  ACTIVITY: 'activity',
};

export const CONSTRAINTS = {
  ABSENCE: 'absence',
  ABSENCE_N: 'absence_n',
  EXISTENCE_N: 'existence_n',
  EXACTLY_N: 'exactly_n',
  INIT: 'init',
};

export const initialDiagram = {
  nodes: [
    {
      id: 'activity_1',
      type: NODE_TYPES.ACTIVITY,
      name: 'Activity',
      x: 150,
      y: 150,
      constraint: null,
      constraintValue: null,
    },
  ],
  relations: [],
};

// Helper: Convert diagram to ConDec XML string (custom format)
/**
 * Converts a diagram object to XML string.
 * @param {Object} diagram
 * @returns {string}
 */
export function diagramToXML(diagram) {
  function escape(str) {
    return ('' + str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  const nodesXml = (diagram.nodes || []).map(node => {
    let attrs = [
      `id="${escape(node.id)}"`,
      `name="${escape(node.name)}"`,
      `x="${Number(node.x)}"`,
      `y="${Number(node.y)}"`
    ];
    if (node.constraint) attrs.push(`constraint="${escape(node.constraint)}"`);
    if (node.constraintValue !== undefined)
      attrs.push(`constraintValue="${Number(node.constraintValue)}"`);
    return `<node ${attrs.join(' ')} />`;
  }).join('');

  const relationsXml = (diagram.relations || []).map(rel => {
    let attrs = [
      `id="${escape(rel.id)}"`,
      `type="${escape(rel.type)}"`,
      `sourceId="${escape(rel.sourceId)}"`,
      `targetId="${escape(rel.targetId)}"`
    ];
    if (rel.labelOffset && rel.labelOffset.x !== undefined && rel.labelOffset.y !== undefined) {
      attrs.push(`labelOffsetX="${Number(rel.labelOffset.x)}"`);
      attrs.push(`labelOffsetY="${Number(rel.labelOffset.y)}"`);
    }
    let waypointsXml = '';
    if (Array.isArray(rel.waypoints)) {
      waypointsXml = rel.waypoints.map(wp =>
        `<waypoint x="${Number(wp.x)}" y="${Number(wp.y)}" />`
      ).join('');
    }
    return `<relation ${attrs.join(' ')}>${waypointsXml}</relation>`;
  }).join('');

  return `<diagram>${nodesXml}${relationsXml}</diagram>`;
}

/**
 * Parse XML string and convert to diagram object.
 * @param {string} xmlString
 * @returns {Object} diagram { nodes: [], relations: [] }
 */
export function xmlToDiagram(xmlString) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlString, "application/xml");
  const diagram = { nodes: [], relations: [] };

  // Parse nodes
  const nodeEls = xml.getElementsByTagName('node');
  for (let i = 0; i < nodeEls.length; i++) {
    const el = nodeEls[i];
    diagram.nodes.push({
      id: el.getAttribute('id'),
      name: el.getAttribute('name'),
      x: Number(el.getAttribute('x')),
      y: Number(el.getAttribute('y')),
      constraint: el.getAttribute('constraint') || null,
      constraintValue: el.hasAttribute('constraintValue') ? Number(el.getAttribute('constraintValue')) : undefined
    });
  }

  // Parse relations
  const relEls = xml.getElementsByTagName('relation');
  for (let i = 0; i < relEls.length; i++) {
    const el = relEls[i];
    // Parse waypoints if present
    let waypoints = [];
    const waypointEls = el.getElementsByTagName('waypoint');
    for (let j = 0; j < waypointEls.length; j++) {
      const wp = waypointEls[j];
      waypoints.push({
        x: Number(wp.getAttribute('x')),
        y: Number(wp.getAttribute('y'))
      });
    }
    let labelOffset;
    if (el.hasAttribute('labelOffsetX') && el.hasAttribute('labelOffsetY')) {
      labelOffset = {
        x: Number(el.getAttribute('labelOffsetX')),
        y: Number(el.getAttribute('labelOffsetY'))
      };
    }
    diagram.relations.push({
      id: el.getAttribute('id'),
      type: el.getAttribute('type'),
      sourceId: el.getAttribute('sourceId'),
      targetId: el.getAttribute('targetId'),
      waypoints,
      labelOffset
    });
  }

  return diagram;
}

// Create a new relation
export function createNewRelation(sourceId, targetId, relationType, diagram, calculateIntersectionPoint) {
  const sourceNode = diagram.nodes.find(n => n.id === sourceId);
  const targetNode = diagram.nodes.find(n => n.id === targetId);
  
  if (!sourceNode || !targetNode) {
    return null;
  }
  
  // Calculate initial waypoints
  const sourcePoint = { x: sourceNode.x, y: sourceNode.y };
  const targetPoint = { x: targetNode.x, y: targetNode.y };
  
  // Calculate edge intersection points
  const sourceEdgePoint = calculateIntersectionPoint(targetPoint, sourcePoint);
  const targetEdgePoint = calculateIntersectionPoint(sourcePoint, targetPoint);
  
  const waypoints = [
    { x: sourceEdgePoint.x, y: sourceEdgePoint.y },
    { x: targetEdgePoint.x, y: targetEdgePoint.y }
  ];

  return {
    id: `relation_${Date.now()}`,
    type: relationType,
    sourceId: sourceId,
    targetId: targetId,
    waypoints: waypoints
  };
}
