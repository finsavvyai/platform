/**
 * Operational Transform Algorithm
 * Core OT implementation for conflict-free concurrent editing
 */

import type { EditOperation, ConflictResolution } from './types.js';

export class OperationalTransform {
  /**
   * Apply a single operation to a document
   */
  static apply(document: string, operation: EditOperation): string {
    if (!this.isValidOperation(operation, document)) {
      throw new Error(`Invalid operation: position=${operation.position} exceeds document length`);
    }

    switch (operation.type) {
      case 'insert':
        if (!operation.content) throw new Error('Insert operation requires content');
        return document.slice(0, operation.position) + operation.content + document.slice(operation.position);

      case 'delete':
        if (!operation.length) throw new Error('Delete operation requires length');
        return document.slice(0, operation.position) + document.slice(operation.position + operation.length);

      case 'replace':
        if (!operation.content || !operation.length) throw new Error('Replace requires content and length');
        return (
          document.slice(0, operation.position) +
          operation.content +
          document.slice(operation.position + operation.length)
        );

      default:
        throw new Error(`Unknown operation type: ${(operation as EditOperation).type}`);
    }
  }

  /**
   * Transform operation B against operation A
   */
  static transform(opA: EditOperation, opB: EditOperation): EditOperation {
    const transformed: EditOperation = { ...opB };

    if (opA.type === 'insert') {
      if (opB.position >= opA.position) {
        transformed.position += opA.content?.length ?? 0;
      }
    } else if (opA.type === 'delete') {
      const deleteEnd = opA.position + (opA.length ?? 0);
      if (opB.position >= deleteEnd) {
        transformed.position -= opA.length ?? 0;
      } else if (opB.position > opA.position) {
        transformed.position = opA.position;
      }
    } else if (opA.type === 'replace') {
      const deleteEnd = opA.position + (opA.length ?? 0);
      const insertLen = opA.content?.length ?? 0;
      const delta = insertLen - (opA.length ?? 0);

      if (opB.position >= deleteEnd) {
        transformed.position += delta;
      } else if (opB.position > opA.position) {
        transformed.position = opA.position + insertLen;
      }
    }

    return transformed;
  }

  /**
   * Bidirectional transformation
   */
  static transformBidirectional(opA: EditOperation, opB: EditOperation): [EditOperation, EditOperation] {
    return [this.transform(opB, opA), this.transform(opA, opB)];
  }

  /**
   * Compose two operations
   */
  static compose(opA: EditOperation, opB: EditOperation): EditOperation {
    if (opA.type === 'insert' && opB.type === 'insert') {
      if (opA.position + (opA.content?.length ?? 0) === opB.position) {
        return {
          type: 'insert',
          position: opA.position,
          content: (opA.content ?? '') + (opB.content ?? ''),
          timestamp: opB.timestamp,
          userId: opB.userId,
          version: opB.version,
        };
      }
    }

    if (opA.type === 'delete' && opB.type === 'delete' && opA.position === opB.position) {
      return {
        type: 'delete',
        position: opA.position,
        length: (opA.length ?? 0) + (opB.length ?? 0),
        timestamp: opB.timestamp,
        userId: opB.userId,
        version: opB.version,
      };
    }

    return opB;
  }

  /**
   * Validate operation
   */
  private static isValidOperation(operation: EditOperation, document: string): boolean {
    const docLen = document.length;
    const opPos = operation.position;

    if (opPos < 0 || opPos > docLen) return false;

    switch (operation.type) {
      case 'insert':
        return !!operation.content;
      case 'delete':
        return opPos + (operation.length ?? 0) <= docLen && (operation.length ?? 0) > 0;
      case 'replace':
        return opPos + (operation.length ?? 0) <= docLen && (operation.length ?? 0) >= 0 && !!operation.content;
      default:
        return false;
    }
  }

  /**
   * Resolve conflict
   */
  static resolveConflict(opA: EditOperation, opB: EditOperation): ConflictResolution {
    const [transformedA, transformedB] = this.transformBidirectional(opA, opB);
    return {
      strategy: 'ot',
      opA,
      opB,
      resolvedOpA: transformedA,
      resolvedOpB: transformedB,
    };
  }

  /**
   * Calculate delta for operation
   */
  static calculateDelta(operation: EditOperation): number {
    switch (operation.type) {
      case 'insert':
        return operation.content?.length ?? 0;
      case 'delete':
        return -(operation.length ?? 0);
      case 'replace':
        return (operation.content?.length ?? 0) - (operation.length ?? 0);
      default:
        return 0;
    }
  }
}
