/**
 * Chain Schema — defines the structure and validation for agent chains (DAGs)
 *
 * A chain is a directed acyclic graph where each node is an agent invocation
 * and edges define the data flow between them. The executor runs agents in
 * topological order, piping output from predecessors as context to successors.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChainNode {
    /** Unique node identifier within the chain (e.g. "review", "step-1") */
    id: string;
    /** Agent slug from PERSONAS (e.g. "code-review", "testing-validation") */
    agent: string;
    /** Optional label for UI display */
    label?: string;
    /** Optional override for the user prompt sent to this agent.
     *  Use {{prev}} to inject the previous node's output.
     *  If omitted, the original user context + previous output is used. */
    promptTemplate?: string;
    /** Optional per-node config overrides */
    config?: {
        provider?: string;
        model?: string;
        maxTokens?: number;
        temperature?: number;
    };
    /** If true, execution pauses before this node until human approval is provided. */
    requiresApproval?: boolean;
}

export interface ChainEdge {
    /** Source node id */
    from: string;
    /** Target node id */
    to: string;
}

export interface ChainDefinition {
    /** Human-readable name for the chain */
    name: string;
    /** Optional description */
    description?: string;
    /** DAG nodes — each is an agent invocation */
    nodes: ChainNode[];
    /** DAG edges — define execution order and data flow */
    edges: ChainEdge[];
}

// Validation result

export interface ChainValidationResult {
    valid: boolean;
    errors: string[];
    /** Topologically sorted node IDs — the execution order (only if valid) */
    executionOrder?: string[];
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validate a chain definition:
 * 1. At least one node
 * 2. All node IDs are unique
 * 3. All edge references point to existing nodes
 * 4. No self-loops
 * 5. Graph is a DAG (no cycles) — verified via topological sort (Kahn's algo)
 */
export function validateChain(chain: ChainDefinition): ChainValidationResult {
    const errors: string[] = [];

    // Basic structure checks
    if (!chain.name || chain.name.trim().length === 0) {
        errors.push('Chain name is required');
    }

    if (!chain.nodes || chain.nodes.length === 0) {
        errors.push('Chain must have at least one node');
        return { valid: false, errors };
    }

    // Check node IDs are unique
    const nodeIds = new Set<string>();
    for (const node of chain.nodes) {
        if (!node.id || node.id.trim().length === 0) {
            errors.push('Every node must have a non-empty id');
            continue;
        }
        if (!node.agent || node.agent.trim().length === 0) {
            errors.push(`Node "${node.id}" must specify an agent slug`);
        }
        if (nodeIds.has(node.id)) {
            errors.push(`Duplicate node id: "${node.id}"`);
        }
        nodeIds.add(node.id);
    }

    // Validate edges
    const edges = chain.edges || [];
    for (const edge of edges) {
        if (!nodeIds.has(edge.from)) {
            errors.push(`Edge references unknown source node: "${edge.from}"`);
        }
        if (!nodeIds.has(edge.to)) {
            errors.push(`Edge references unknown target node: "${edge.to}"`);
        }
        if (edge.from === edge.to) {
            errors.push(`Self-loop detected on node: "${edge.from}"`);
        }
    }

    if (errors.length > 0) {
        return { valid: false, errors };
    }

    // ─── Topological sort (Kahn's algorithm) to detect cycles ──────────────

    // Build adjacency list and in-degree counts
    const adjacency = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const id of nodeIds) {
        adjacency.set(id, []);
        inDegree.set(id, 0);
    }

    for (const edge of edges) {
        adjacency.get(edge.from)!.push(edge.to);
        inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    }

    // Start with nodes that have no incoming edges
    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
        if (deg === 0) queue.push(id);
    }

    const executionOrder: string[] = [];

    while (queue.length > 0) {
        const current = queue.shift()!;
        executionOrder.push(current);

        for (const neighbor of adjacency.get(current) || []) {
            const newDeg = (inDegree.get(neighbor) || 1) - 1;
            inDegree.set(neighbor, newDeg);
            if (newDeg === 0) {
                queue.push(neighbor);
            }
        }
    }

    if (executionOrder.length !== nodeIds.size) {
        errors.push('Chain contains a cycle — agent chains must be acyclic (DAG)');
        return { valid: false, errors };
    }

    return { valid: true, errors: [], executionOrder };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Get predecessor node IDs for a given node */
export function getPredecessors(chain: ChainDefinition, nodeId: string): string[] {
    return (chain.edges || [])
        .filter(e => e.to === nodeId)
        .map(e => e.from);
}

/** Build a prompt for a chain node by injecting predecessor outputs */
export function buildNodePrompt(
    node: ChainNode,
    userContext: string,
    predecessorOutputs: Map<string, string>,
    chain: ChainDefinition,
): string {
    const predecessors = getPredecessors(chain, node.id);

    // Gather prior outputs
    const priorOutputs = predecessors
        .map(pid => predecessorOutputs.get(pid))
        .filter(Boolean)
        .join('\n\n---\n\n');

    // If node has a custom prompt template, use it
    if (node.promptTemplate) {
        return node.promptTemplate
            .replace('{{prev}}', priorOutputs || '')
            .replace('{{context}}', userContext);
    }

    // Default: prepend prior outputs as context
    if (priorOutputs) {
        return `## Previous Agent Analysis\n${priorOutputs}\n\n## User Request\n${userContext}`;
    }

    return userContext;
}
