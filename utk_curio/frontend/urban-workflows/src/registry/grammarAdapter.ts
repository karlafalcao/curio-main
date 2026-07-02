/**
 * Pluggable interface for grammar-based visualizations.
 *
 * **Purpose:** GrammarAdapter abstracts the compile-and-render logic for each
 * grammar toolkit (Vega-Lite, UTK, D3). Implementations validate specs,
 * render into DOM containers, and optionally provide default specs and cleanup.
 * This allows grammar boxes to share a common contract while each toolkit
 * handles its own rendering details.
 *
 * **Function:** Consumed by:
 * - **Lifecycle hooks** — Box lifecycles (e.g. d3Lifecycle) call
 *   `getGrammarAdapter(grammarId)` to obtain the adapter, then use
 *   `validate`, `render`, and `getDefaultSpec` when implementing
 *   `applyGrammar` for the BoxEditor.
 * - **Registry** — Adapters register at module load via
 *   `registerGrammarAdapter()` (triggered by registry index imports).
 *
 * **Lifecycle:** Adapters are registered when vegaLiteAdapter, utkAdapter, or
 * d3Adapter modules are imported. The `grammarId` must match the descriptor's
 * `grammarId` (e.g. 'vega-lite', 'utk', 'd3') so lifecycles can look them up.
 */

export interface GrammarAdapter {
  /** Unique id; must match BoxDescriptor.grammarId for lookup. */
  grammarId: string;

  /** Validate a grammar specification before rendering. */
  validate(spec: unknown): boolean;

  /** Compile and render a grammar spec into the given container. */
  render(
    container: HTMLElement,
    spec: unknown,
    data?: unknown,
    options?: { interactions?: unknown; resolutionMode?: string }
  ): void | Promise<void>;

  /** Return a minimal default spec for this grammar. */
  getDefaultSpec?(): unknown;

  /** Cleanup resources (e.g. dispose Vega views, remove event listeners). */
  cleanup?(): void;
}

const grammarRegistry = new Map<string, GrammarAdapter>();

export function registerGrammarAdapter(adapter: GrammarAdapter): void {
  grammarRegistry.set(adapter.grammarId, adapter);
}

export function getGrammarAdapter(grammarId: string): GrammarAdapter {
  const adapter = grammarRegistry.get(grammarId);
  if (!adapter) throw new Error(`No grammar adapter registered for: ${grammarId}`);
  return adapter;
}

export function getAllGrammarAdapters(): GrammarAdapter[] {
  return Array.from(grammarRegistry.values());
}
