export interface ScriptParamDef {
  name: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  default?: any;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  description?: string;
  positional?: boolean;
  cliFlag?: string;
}

export type ScriptSafety = 'read-only' | 'report' | 'workspace' | 'wiki-write' | 'blocked';

/** Generated from SCRIPT_SCHEMAS: the scheduler and the UI must not redefine it. */
export interface ScriptArgSafetyRule {
  when: Record<string, unknown>;
  safety: ScriptSafety;
}

export interface ScriptAutomation {
  safety: ScriptSafety;
  schedulable: boolean;
  enabledDefault: boolean;
  defaultSchedule: string;
  defaultArgs: Record<string, unknown>;
  /** Arg-dependent overrides, evaluated against the resolved invocation args. */
  argSafety?: ScriptArgSafetyRule[];
  requires: string[];
  notes: string;
}

export interface ScriptDef {
  id: string;
  path: string;
  displayName: string;
  category: 'Ingestion' | 'OKF Maintenance' | 'Analysis & Metrics' | 'Taxonomy' | 'Thesis & Study' | 'Wizard' | 'Knowledge Engineering';
  description: string;
  parameters: ScriptParamDef[];
  /** Optional for hand-built test fixtures; every registry entry has it. */
  automation?: ScriptAutomation;
}

export interface ChatRequest {
  message?: string;
  command?: string;
  contextNoteId?: string;
  stream?: boolean;
}

export interface KEUseCaseStep {
  stepNumber: number;
  title: string;
  description: string;
  scriptId: string;
  defaultArgs?: Record<string, any>;
}

export interface KEUseCaseDef {
  id: string;
  title: string;
  role: 'Knowledge Engineer';
  category: string;
  summary: string;
  objective: string;
  steps: KEUseCaseStep[];
}
