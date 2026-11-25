export interface CommandManifestRoute {
  id: string;
  method: string;
  path: string;
  command: string;
  tags: string[];
  projectScoped: boolean;
  stream: string | null;
  hasBusHandler: boolean;
}

export interface CommandManifestSlash {
  id: string;
  category: string;
  verb: string;
  hasImplementation: boolean;
}

export interface CommandManifestGap {
  kind: 'route-without-bus' | 'slash-without-implementation';
  id: string;
  detail: string;
}

export interface DerivedCommandManifest {
  routes: CommandManifestRoute[];
  busCommands: string[];
  slashCommands: CommandManifestSlash[];
  implementedSlashCommands: string[];
  mcpTools: string[];
  gaps: CommandManifestGap[];
}

export declare const REPO_ROOT: string;
export declare function deriveCommandManifest(): Promise<DerivedCommandManifest>;
export declare function renderTypescript(manifest: DerivedCommandManifest): string;
export declare function renderMarkdown(manifest: DerivedCommandManifest): string;
