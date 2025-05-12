// Utility to validate node constraints against the diagram

export function validateNodeConstraint(node, diagram) {
  if (!node || !diagram) return { valid: true };

  const incomingCount = diagram.relations.filter(r => r.targetId === node.id).length;

  switch (node.constraint) {
    case 'absence':
      return incomingCount === 0
        ? { valid: true }
        : { valid: false, message: 'Must have no incoming relations' };

    case 'absence_n':
      return incomingCount <= (node.constraintValue || 0)
        ? { valid: true }
        : { valid: false, message: `Exceeds max ${node.constraintValue} incoming relations` };

    case 'existence_n':
      return incomingCount >= (node.constraintValue || 0)
        ? { valid: true }
        : { valid: false, message: `Needs at least ${node.constraintValue} incoming relations` };

    case 'exactly_n':
      return incomingCount === (node.constraintValue || 0)
        ? { valid: true }
        : { valid: false, message: `Must have exactly ${node.constraintValue} incoming relations` };

    case 'init':
      return incomingCount === 0
        ? { valid: true }
        : { valid: false, message: 'Init activities cannot have incoming relations' };

    default:
      return { valid: true };
  }
}
