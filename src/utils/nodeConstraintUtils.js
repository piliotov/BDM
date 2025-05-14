

// Use the new Declare/ConDec incoming relation counting logic
import { countIncomingRelationsDeclare } from './incomingRelationUtils';

export function validateNodeConstraint(node, diagram) {
  if (!node || !diagram) return { valid: true };

  // Use Declare/ConDec semantics for incoming relation count
  const incomingCount = countIncomingRelationsDeclare(node, diagram.relations);

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
