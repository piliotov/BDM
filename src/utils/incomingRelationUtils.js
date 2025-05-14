// Utility to count incoming relations for a node according to Declare/ConDec semantics
// For each node, count as incoming:
// - any relation where the node is the target for "incoming" types
// - both source and target for "both" types (e.g., coexistence, succession, alt succession, chain succession)

// Map relation types to their directionality
const RELATION_DIRECTION = {
  response: 'incoming',
  precedence: 'incoming',
  resp_existence: 'incoming',
  resp_absence: 'incoming',
  neg_response: 'incoming',
  neg_precedence: 'incoming',
  alt_response: 'incoming',
  alt_precedence: 'incoming',
  neg_alt_response: 'incoming',
  neg_alt_precedence: 'incoming',
  chain_response: 'incoming',
  chain_precedence: 'incoming',
  neg_chain_response: 'incoming',
  neg_chain_precedence: 'incoming',
  // Both directions:
  coexistence: 'both',
  not_coexistence: 'both',
  succession: 'both',
  alt_succession: 'both',
  chain_succession: 'both',
  neg_succession: 'both',
  neg_alt_succession: 'both',
  neg_chain_succession: 'both',
};

// Remove prefixes to get base type
function defixType(type) {
  let t = type;
  if (t.startsWith('neg_')) t = t.slice(4);
  if (t.startsWith('alt_')) t = t.slice(4);
  if (t.startsWith('chain_')) t = t.slice(6);
  return t;
}

/**
 * Count incoming relations for a node according to Declare/ConDec semantics
 * @param {Object} node - The node to count for
 * @param {Array} relations - All relations in the diagram
 * @returns {number}
 */
export function countIncomingRelationsDeclare(node, relations) {
  if (!node || !relations) return 0;
  let count = 0;
  for (const r of relations) {
    const baseType = defixType(r.type);
    const dir = RELATION_DIRECTION[baseType];
    if (dir === 'incoming' && r.targetId === node.id) {
      count++;
    } else if (dir === 'both' && (r.sourceId === node.id || r.targetId === node.id)) {
      count++;
    }
  }
  return count;
}
