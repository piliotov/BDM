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
export function diagramToXML(diagram) {
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
