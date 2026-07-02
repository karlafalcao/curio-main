import { BoxType, SupportedType } from '../constants';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { Position, Edge } from 'reactflow';
import React from 'react';
import { INodeData, ICodeData } from '../types';
import { IPropagation } from '../providers/FlowProvider';

export interface PortDef {
  types: SupportedType[];
  cardinality?: '0' | '1' | 'n' | '[1,n]' | '[1,2]' | '2';
}

export type EditorType = 'code' | 'widgets' | 'grammar' | 'none';
export type BoxCategory = 'data' | 'computation' | 'vis_grammar' | 'vis_simple' | 'flow';

/* ── Handle configuration ──────────────────────────────────────────── */

export interface HandleDef {
  id: string;
  type: 'source' | 'target';
  position: Position;
  style?: React.CSSProperties;
  /** Compute handle style at render time (used by MergeFlow dynamic handles). */
  dynamicStyle?: (data: any, edges: Edge[]) => React.CSSProperties;
  /** Override default connectable logic per-handle. */
  isConnectableOverride?: (data: any, isConnectable: boolean, edges: Edge[]) => boolean;
}

/* ── BoxEditor configuration ───────────────────────────────────────── */

export interface EditorConfig {
  code: boolean;
  grammar: boolean;
  widgets: boolean;
  provenance?: boolean;
  disableWidgets?: boolean;
  /** DOM id for the editor output container (e.g. "vega" + nodeId). */
  outputId?: (nodeId: string) => string;
}

/* ── BoxContainer overrides ────────────────────────────────────────── */

export interface ContainerConfig {
  handleType?: 'in' | 'out' | 'in/out';
  disablePlay?: boolean;
  noContent?: boolean;
  boxWidth?: number;
  boxHeight?: number;
  styles?: React.CSSProperties;
}

/* ── Box Lifecycle Contract ────────────────────────────────────────── */

export type UseBoxStateReturn = ReturnType<typeof import('../hook/useBoxState').useBoxState>;

/**
 * Runtime data passed to every lifecycle hook by UniversalBox.
 *
 * Extends the persisted `INodeData` with FlowProvider runtime callbacks
 * that are injected when the node is mounted on the canvas.
 */
export interface BoxLifecycleData extends INodeData {
  /** FlowProvider callback — push this node's output to downstream nodes. */
  outputCallback: (nodeId: string, output: any) => void;
  /** FlowProvider callback — propagate interaction resolution data. */
  propagationCallback: (propagation: IPropagation) => void;
  /** FlowProvider callback — push interactions to connected interaction nodes. */
  interactionsCallback: (interactions: any, nodeId: string) => void;
  /** Current propagation counter (triggers re-processing in DataPool). */
  newPropagation?: number;
  /** AI suggestion marker — `"none"` or `undefined` means not a suggestion. */
  suggestionType?: string;
}

/**
 * The return value of a lifecycle hook.
 *
 * **Purpose:** LifecycleResult lets a lifecycle hook selectively override
 * UniversalBox defaults. Every field is optional. UniversalBox applies
 * defaults from `useBoxState` for any field the lifecycle does not override.
 * A no-op lifecycle may return `{}`.
 *
 * **Function:** Consumed by **UniversalBox**, which merges each field with
 * defaults:
 * - **Execution** — `sendCodeOverride`, `setSendCodeCallbackOverride` replace
 *   the play button's send-code flow.
 * - **Editor** — `applyGrammar`, `defaultValueOverride`, `customWidgetsCallback`,
 *   `contentComponent` are passed to BoxEditor for grammar viz, initial value,
 *   widgets panel, and custom content.
 * - **Output** — `setOutputCallbackOverride`, `outputOverride` used when output
 *   is managed locally (DataPool, MergeFlow, UTK).
 * - **UI** — `showLoading` makes BoxContainer show a spinner instead of play.
 * - **Handles** — `dynamicHandles` are appended to `adapter.handles` at render.
 */
export interface LifecycleResult {
  /** Compile a grammar spec and render the result (grammar-viz boxes). */
  applyGrammar?: (spec: string) => Promise<void>;
  /** Populate the widgets panel with custom DOM controls. */
  customWidgetsCallback?: (div: HTMLElement) => void;
  /** Override the initial code/grammar editor value. */
  defaultValueOverride?: string;
  /** Replace the default "play" action with a custom send-code routine. */
  sendCodeOverride?: any;
  /** Replace the `setSendCodeCallback` wiring between BoxEditor and the play button. */
  setSendCodeCallbackOverride?: any;
  /** When `true`, BoxContainer shows a loading spinner instead of the play button. */
  showLoading?: boolean;
  /** Custom React subtree rendered inside the BoxEditor content area. */
  contentComponent?: React.ReactNode;
  /** Replace `boxState.setOutput` — used when output state is managed locally (DataPool, MergeFlow). */
  setOutputCallbackOverride?: any;
  /** Replace `boxState.output` — used when output state is managed locally (DataPool, MergeFlow). */
  outputOverride?: ICodeData;
  /** Extra handles appended to `adapter.handles` at render time (MergeFlow dynamic inputs). */
  dynamicHandles?: HandleDef[];
}

/**
 * Contract type for box lifecycle hooks.
 *
 * Every lifecycle implementation **must** satisfy this signature.
 * The hook is called by `UniversalBox` on every render — it receives
 * the node's runtime `data` and the shared `boxState` from `useBoxState`,
 * and returns a `LifecycleResult` whose fields selectively override
 * defaults.
 *
 * **Rules:**
 * 1. Must be a valid React custom hook (may call `useState`, `useEffect`, etc.).
 * 2. Must be deterministic in its hook call order (React rules of hooks).
 * 3. Must return a `LifecycleResult` — omit fields to accept defaults.
 * 4. Must not call `boxState.setSendCodeCallback` directly — return
 *    `setSendCodeCallbackOverride` instead so UniversalBox can wire it.
 */
export type BoxLifecycleHook = (data: BoxLifecycleData, boxState: UseBoxStateReturn) => LifecycleResult;

/* ── Full adapter for a box type ───────────────────────────────────── */

/**
 * Runtime configuration for how a box type is rendered and behaves.
 *
 * **Purpose:** The adapter is the executable part of a box descriptor. It
 * specifies connection points (handles), editor/container UI, visual badges,
 * and the lifecycle hook that implements the box's behavior. Each descriptor
 * embeds exactly one adapter.
 *
 * **Function:** Consumed exclusively by **UniversalBox**, which:
 * - Renders `handles` as ReactFlow Handle components (optionally merged with
 *   `lifecycle.dynamicHandles`).
 * - Passes `editor` to BoxEditor when non-null; when null, no editor is shown
 *   (e.g. MergeFlow, Comments, Data Pool).
 * - Passes `container` to BoxContainer for layout, play button, and styling.
 * - Calls `useLifecycle(data, boxState)` on every render and applies the
 *   returned LifecycleResult overrides.
 * - Renders InputIcon/OutputIcon when `inputIconType`/`outputIconType` are set.
 * - Enables template modal UI (prompt, update, TemplateModal) when
 *   `showTemplateModal` is true.
 */
export interface BoxAdapter {
  /** ReactFlow Handle definitions (source/target, position, style). */
  handles: HandleDef[];
  /** Editor panel config (code/grammar/widgets); null = no editor. */
  editor: EditorConfig | null;
  /** BoxContainer overrides (handleType, dimensions, play button, styles). */
  container: ContainerConfig;
  /** Cardinality badge for input port: "1" | "2" | "N". Omit to hide badge. */
  inputIconType?: string;
  /** Cardinality badge for output port: "1" | "2" | "N". Omit to hide badge. */
  outputIconType?: string;
  /** If true, enables template modal (prompt, update, TemplateModal component). */
  showTemplateModal?: boolean;
  /** Lifecycle hook invoked by UniversalBox; drives behavior and overrides. */
  useLifecycle: BoxLifecycleHook;
}

/* ── Descriptor ────────────────────────────────────────────────────── */

/**
 * Node Box Descriptor.
 *
 * **Purpose:** The descriptor is the single source of truth for a box type. It
 * defines how the box appears in the palette, how it connects to other nodes,
 * what editor UI it exposes, and how it behaves at runtime. Descriptors are
 * registered via `registerNode()` and looked up by `getNodeDescriptor(boxType)`.
 *
 * **Function:** Consumed by:
 * - **UniversalBox** — uses `adapter` (handles, lifecycle, editor/container config)
 *   to render the node and wire its behavior.
 * - **MainCanvas** — maps `BoxType` → React node component.
 * - **ConnectionValidator** — uses `inputPorts` / `outputPorts` for type-safe
 *   edge validation.
 * - **DescriptionModal** — shows `label`, `description`, port cardinality.
 * - **styles.tsx** — uses `icon` and `label` for node appearance.
 *
 * **Lifecycle:** Descriptors are registered at module load (see `descriptors.ts`).
 * Each box type (Data Loading, Vega, Data Pool, etc.) has exactly one descriptor.
 */
export interface BoxDescriptor {
  /** Unique identifier; must match a `BoxType` constant. */
  id: BoxType;
  /** Grouping for palette and semantics: data, computation, vis_grammar, vis_simple, flow. */
  category: BoxCategory;
  /** Display name shown in palette, node header, and modals. */
  label: string;
  /** FontAwesome icon for palette and node header. */
  icon: IconDefinition;
  /** Port definitions for incoming edges; used for connection validation. */
  inputPorts: PortDef[];
  /** Port definitions for outgoing edges; used for connection validation. */
  outputPorts: PortDef[];
  /** Editor mode: 'code' | 'grammar' | 'widgets' | 'none'. */
  editor: EditorType;
  /** Grammar adapter id when editor is 'grammar' (e.g. 'vega-lite', 'utk', 'd3'). */
  grammarId?: string;
  /** If true, box appears in the palette and can be dragged onto the canvas. */
  inPalette: boolean;
  /** Sort order in palette; lower values appear first. */
  paletteOrder?: number;
  /** Human-readable description for modals and tooltips. */
  description: string;
  /** Whether the box supports code editing (used for UI/tutorial logic). */
  hasCode: boolean;
  /** Whether the box has a widgets panel. */
  hasWidgets: boolean;
  /** Whether the box uses a grammar editor (Vega, UTK, D3). */
  hasGrammar: boolean;
  /** Whether the box supports provenance tracking. */
  hasProvenance?: boolean;
  /** Runtime config: handles, editor/container overrides, lifecycle hook. */
  adapter: BoxAdapter;
  /** Tutorial step id for onboarding flows. */
  tutorialId?: string;
}
