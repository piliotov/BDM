import declareRelationTypeMap from './declareRelationTypeMap';
import { layoutConnection } from './canvasUtils';

/**
 * Import Declare TXT
 * @param {string} txt
 * @returns {Object}
 */
export function importDeclareTxtWithLayout(txt) {
  // Remove BOM and comments
  let cleaned = txt.replace(/^\uFEFF/, '').replace(/\n?\s*#.*$/gm, '');

  // Replace single quotes with double quotes (for keys and values)
  cleaned = cleaned.replace(/'/g, '"');

  // Convert tuple keys to string keys: ("A", "B") => "A|||B"
  cleaned = cleaned.replace(/\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)\s*:/g, '"$1|||$2":');

  // Now parse as JSON
  let dict;
  try {
    dict = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Could not parse TXT file as Declare Python dict: ${e && e.message ? e.message : e}`);
  }

  // Use a Map to avoid duplicate nodes
  const nodeMap = new Map();
  const nodeConstraints = {};
  const relations = [];
  for (const constraintType in dict) {
    // Normalize constraint type to internal key
    const normType = declareRelationTypeMap[constraintType.trim().toLowerCase()] || constraintType.trim().toLowerCase();
    const value = dict[constraintType];
    if (typeof value === 'object' && !Array.isArray(value)) {
      for (const k in value) {
        let source, target;
        // Binary constraint: key is "A|||B"
        if (typeof k === 'string' && k.includes('|||')) {
          [source, target] = k.split('|||');
          if (source && target) {
            // Add nodes if not already present
            if (!nodeMap.has(source)) nodeMap.set(source, {
              id: `activity_${source}`,
              type: 'activity',
              name: source,
              x: 0,
              y: 0,
              constraint: null,
              constraintValue: null
            });
            if (!nodeMap.has(target)) nodeMap.set(target, {
              id: `activity_${target}`,
              type: 'activity',
              name: target,
              x: 0,
              y: 0,
              constraint: null,
              constraintValue: null
            });
            // Only add the relation for this type and this pair
            relations.push({
              type: normType,
              source,
              target
            });
          }
        } else {
          // Unary constraint: key is node name
          const nodeName = k;
          // Add node if not already present
          if (!nodeMap.has(nodeName)) nodeMap.set(nodeName, {
            id: `activity_${nodeName}`,
            type: 'activity',
            name: nodeName,
            x: 0,
            y: 0,
            constraint: null,
            constraintValue: null
          });
          // Save the constraint 
          nodeConstraints[nodeName] = {
            constraint: normType,
            constraintValue: value[k]
          };
        }
      }
    }
  }

  // Set constraint fields if present
  for (const [name, node] of nodeMap.entries()) {
    if (nodeConstraints[name]) {
      node.constraint = nodeConstraints[name].constraint;
      node.constraintValue = nodeConstraints[name].constraintValue;
    }
  }

  // Create nodes array from map
  let nodes = Array.from(nodeMap.values());

  // Create relations
  // Remove duplicate relations (same type, source, target)
  const uniqueRelationSet = new Set();
  let rels = relations.filter(rel => {
    // For coexistence, treat (A,B) and (B,A) as the same
    let key;
    if (rel.type === 'coexistence') {
      const pair = [rel.source, rel.target].sort();
      key = `${rel.type}|||${pair[0]}|||${pair[1]}`;
    } else {
      key = `${rel.type}|||${rel.source}|||${rel.target}`;
    }
    if (uniqueRelationSet.has(key)) return false;
    uniqueRelationSet.add(key);
    return true;
  }).map((rel, idx) => ({
    id: `relation_${idx}`,
    type: rel.type,
    sourceId: `activity_${rel.source}`,
    targetId: `activity_${rel.target}`,
    waypoints: []
  }));

  // Auto-place nodes
  nodes = layoutNodesForceDirected(nodes, rels);

  // Set waypoints for relations using layoutConnection and actual node size
  rels = rels.map(r => {
    const source = nodes.find(n => n.id === r.sourceId);
    const target = nodes.find(n => n.id === r.targetId);
    const sourceSize = { width: source.width || 100, height: source.height || 50 };
    const targetSize = { width: target.width || 100, height: target.height || 50 };
    return {
      ...r,
      waypoints: layoutConnection(source, target, sourceSize, targetSize)
    };
  });

  return { nodes, relations: rels };
}

/**
 * Import JSON exported from the modeler
 * @param {string} jsonString
 * @returns {Object} diagram { nodes: [], relations: [] }
 */
export function importDeclareJsonWithLayout(jsonString) {
  let diagram;
  try {
    diagram = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
  } catch (e) {
    throw new Error('Invalid JSON file.');
  }
  // Validate structure
  if (!diagram.nodes || !diagram.relations) {
    throw new Error('JSON must be a diagram object with nodes and relations.');
  }
  // Just return as is (preserve all positions/waypoints)
  return diagram;
}

// --- Simple force-directed layout (inspired by declare-js graphLayout) ---
export function layoutNodesForceDirected(nodes, relations, iterations = 900) {
  const width = 1600, height = 1200;
  const nodeRadius = 80; // Larger for more space
  const minSep = nodeRadius * 2.2;
  const k = Math.sqrt((width * height) / Math.max(nodes.length, 1));
  const center = { x: width / 2, y: height / 2 };

  // Place nodes in a large circle with a small random offset
  const initialRadius = Math.max(350, 400 + nodes.length * 10);
  nodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length;
    const rand = 1 + (Math.random() - 0.5) * 0.15;
    n.x = center.x + initialRadius * Math.cos(angle) * rand;
    n.y = center.y + initialRadius * Math.sin(angle) * rand;
  });

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      let dx = 0, dy = 0;
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const nx = nodes[i].x - nodes[j].x;
        const ny = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(nx * nx + ny * ny) || 0.01;
        if (dist < minSep) {
          dx += (nx / dist) * (minSep - dist) * 1.5;
          dy += (ny / dist) * (minSep - dist) * 1.5;
        }
      }
      nodes[i].x += dx * 0.09;
      nodes[i].y += dy * 0.09;
    }
    relations.forEach(rel => {
      const source = nodes.find(n => n.id === rel.sourceId);
      const target = nodes.find(n => n.id === rel.targetId);
      if (!source || !target) return;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const desired = k * 1.2;
      const force = (dist - desired) * 0.014;
      const fx = dx / dist * force;
      const fy = dy / dist * force;
      source.x += fx;
      source.y += fy;
      target.x -= fx;
      target.y -= fy;
    });
    nodes.forEach(n => {
      n.x += (center.x - n.x) * 0.012;
      n.y += (center.y - n.y) * 0.012;
    });
  }
  // Post-process: nudge any remaining overlapping nodes
  let changed = true;
  let nudgeTries = 0;
  while (changed && nudgeTries < 10) {
    changed = false;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nx = nodes[i].x - nodes[j].x;
        const ny = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(nx * nx + ny * ny) || 0.01;
        if (dist < minSep) {
          // Push apart
          const push = (minSep - dist) / 2;
          const px = (nx / dist) * push;
          const py = (ny / dist) * push;
          nodes[i].x += px;
          nodes[i].y += py;
          nodes[j].x -= px;
          nodes[j].y -= py;
          changed = true;
        }
      }
    }
    nudgeTries++;
  }
  nodes.forEach(n => {
    n.x = Math.max(nodeRadius, Math.min(width - nodeRadius, n.x));
    n.y = Math.max(nodeRadius, Math.min(height - nodeRadius, n.y));
  });
  return nodes;
}

export function importDeclareXmlWithLayout(xmlString) {
  let parser = new DOMParser();
  let xml = parser.parseFromString(xmlString, "application/xml");

  const activityNodes = Array.from(xml.querySelectorAll('activitydefinitions > activity'));
  const nodes = activityNodes.map(act => ({
    id: `activity_${act.getAttribute('name')}`,
    type: 'activity',
    name: act.getAttribute('name'),
    x: 0,
    y: 0,
    constraint: null,
    constraintValue: null
  }));
  const nodeMap = new Map(nodes.map(n => [n.name, n]));

  const constraintNodes = Array.from(xml.querySelectorAll('constraintdefinitions > constraint'));
  const relations = [];
  constraintNodes.forEach((c, idx) => {
    let type = c.querySelector('name')?.textContent || 'unknown';
    type = declareRelationTypeMap[type.trim().toLowerCase()] || type.trim().toLowerCase();
    const params = Array.from(c.querySelectorAll('constraintparameters > parameter'));
    if (params.length === 2) {
      const target = params[0].querySelector('branch')?.getAttribute('name');
      const source = params[1].querySelector('branch')?.getAttribute('name');
      if (source && target) {
        relations.push({
          id: `relation_${idx}`,
          type,
          sourceId: `activity_${source}`,
          targetId: `activity_${target}`,
          waypoints: []
        });
      }
    } else if (params.length === 1) {
      // Unary constraint (e.g. existence, absence, etc.)
      const nodeName = params[0].querySelector('branch')?.getAttribute('name');
      if (nodeName && nodeMap.has(nodeName)) {
        nodeMap.get(nodeName).constraint = type;
        // Try to extract constraintValue from <template><display> or <template><description>
        const template = c.querySelector('template');
        let value = null;
        if (template) {
          const display = template.querySelector('display')?.textContent;
          if (display) {
            if (type === 'existence' && /^1\.\./.test(display)) {
              value = 1;
            } else {
              const match = display.match(/(\d+)/);
              if (match) value = parseInt(match[1], 10);
            }
          }
        }
        if (value !== null) nodeMap.get(nodeName).constraintValue = value;
      }
    }
  });
  const placedNodes = layoutNodesForceDirected(Array.from(nodeMap.values()), relations);
  const rels = relations.map(r => {
    const source = placedNodes.find(n => n.id === r.sourceId);
    const target = placedNodes.find(n => n.id === r.targetId);
    const sourceSize = { width: source.width || 100, height: source.height || 50 };
    const targetSize = { width: target.width || 100, height: target.height || 50 };
    return {
      ...r,
      waypoints: layoutConnection(source, target, sourceSize, targetSize)
    };
  });
  return { nodes: placedNodes, relations: rels };
}
