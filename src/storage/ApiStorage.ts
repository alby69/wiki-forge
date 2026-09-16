import { WikiNote } from '../core/types/wiki';
import { IStorage } from '../core/interfaces/IStorage';
import { FileStorage } from './FileStorage';
import { showToast } from '../components/ui/Toast';

export interface AttachOptions {
  noteId?: string;
  title?: string;
  folder?: string;
  content: string;
  mode?: 'append' | 'create' | 'overwrite';
}

export interface ProjectInfo {
  id: string;
  name: string;
  path: string;
}

export class ApiStorage implements IStorage {
  private fallback = new FileStorage();
  private baseUrl: string;
  private activeProjectIdMemory: string = 'default';

  constructor(baseUrl: string = '') {
    // In browser, use VITE_API_BASE_URL if available; otherwise use provided baseUrl
    if (typeof window !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) {
      this.baseUrl = (import.meta as any).env.VITE_API_BASE_URL;
    } else {
      this.baseUrl = baseUrl;
    }
  }

  public getActiveProjectId(): string {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('wiki-forge:active-project') || this.activeProjectIdMemory || 'default';
    }
    return this.activeProjectIdMemory || 'default';
  }

  public setActiveProjectId(id: string): void {
    this.activeProjectIdMemory = id;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('wiki-forge:active-project', id);
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Project-Id': this.getActiveProjectId(),
    };
  }

  public async getProjects(): Promise<ProjectInfo[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/projects`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const json = (await res.json()) as { success: boolean; projects?: ProjectInfo[] };
        if (json.success && json.projects) {
          return json.projects;
        }
      }
    } catch (_err) {
      // Fallback
    }
    return [{ id: 'default', name: 'Default Wiki', path: '.' }];
  }

  public async createProject(id: string, name: string): Promise<ProjectInfo | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/projects`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ id, name }),
      });
      if (res.ok) {
        const json = (await res.json()) as { success: boolean; project?: ProjectInfo };
        if (json.success && json.project) {
          return json.project;
        }
      }
    } catch (_err) {
      // Fallback
    }
    return null;
  }

  public async getProjectConfig(projectId?: string): Promise<Record<string, unknown> | null> {
    const id = projectId || this.getActiveProjectId();
    try {
      const res = await fetch(`${this.baseUrl}/api/projects/${id}/config`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const json = (await res.json()) as { success: boolean; config?: Record<string, unknown> };
        if (json.success && json.config) {
          return json.config;
        }
      }
    } catch (_err) {
      // Fallback
    }
    return null;
  }

  public async updateProjectConfig(config: Record<string, unknown>, projectId?: string): Promise<boolean> {
    const id = projectId || this.getActiveProjectId();
    try {
      const res = await fetch(`${this.baseUrl}/api/projects/${id}/config`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(config),
      });
      if (res.ok) {
        const json = (await res.json()) as { success: boolean };
        return json.success;
      }
    } catch (_err) {
      // Fallback
    }
    return false;
  }

  public async deleteProject(projectId: string, deleteFolder: boolean = false): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/projects/${projectId}?deleteFolder=${deleteFolder}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const json = (await res.json()) as { success: boolean };
        return json.success;
      }
    } catch (_err) {
      // Fallback
    }
    return false;
  }

  public async getAllNotes(): Promise<WikiNote[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/wiki/notes`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const json = (await res.json()) as { success: boolean; notes?: WikiNote[] };
        if (json.success && Array.isArray(json.notes) && json.notes.length > 0) {
          return json.notes;
        }
      }
    } catch (_err) {
      // Backend unavailable; fallback to static FileStorage
    }
    return this.fallback.getAllNotes();
  }

  public async getNote(id: string): Promise<WikiNote | null> {
    const notes = await this.getAllNotes();
    const q = id.toLowerCase();
    return (
      notes.find(n => n.id === id || n.id.toLowerCase() === q || n.title.toLowerCase() === q) ?? null
    );
  }

  public async saveNote(note: Partial<WikiNote> & { id: string }): Promise<WikiNote> {
    try {
      const res = await fetch(`${this.baseUrl}/api/wiki/save`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          id: note.id,
          content: note.content ?? '',
          path: note.path,
          folder: note.folder,
          title: note.title,
        }),
      });

      if (res.ok) {
        const json = (await res.json()) as { success: boolean; note?: WikiNote };
        if (json.success && json.note) {
          if (typeof window !== 'undefined' && typeof document !== 'undefined') {
            showToast({ message: `Saved note: ${json.note.title || note.id}`, variant: 'success' });
          }
          return json.note;
        }
      }
    } catch (_err) {
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        showToast({ message: 'Network error saving note. Used local fallback.', variant: 'warning' });
      }
    }

    return this.fallback.saveNote(note);
  }

  public async attachNote(options: AttachOptions): Promise<WikiNote> {
    try {
      const res = await fetch(`${this.baseUrl}/api/wiki/attach`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(options),
      });

      if (res.ok) {
        const json = (await res.json()) as { success: boolean; note?: WikiNote };
        if (json.success && json.note) {
          return json.note;
        }
      }
    } catch (_err) {
      // Backend unavailable
    }

    const targetId = options.noteId || options.title?.toLowerCase().replace(/\s+/g, '-') || `attached-${Date.now()}`;
    return this.fallback.saveNote({ id: targetId, content: options.content });
  }

  public async deleteNote(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/wiki/delete`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ targetPath: id }),
      });
      if (res.ok) {
        const json = (await res.json()) as { success: boolean };
        if (json.success) {
          if (typeof window !== 'undefined' && typeof document !== 'undefined') {
            showToast({ message: `Deleted: ${id}`, variant: 'success' });
          }
          return true;
        }
      }
    } catch (_err) {
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        showToast({ message: `Error deleting: ${id}`, variant: 'error' });
      }
    }
    return false;
  }

  public async createFolder(folderPath: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/wiki/folder/create`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ folderPath }),
      });
      if (res.ok) {
        const json = (await res.json()) as { success: boolean };
        return json.success;
      }
    } catch (_err) {
      // Fallback
    }
    return this.fallback.createFolder(folderPath);
  }

  public async createFile(folderPath: string, fileName: string, content?: string): Promise<WikiNote> {
    try {
      const res = await fetch(`${this.baseUrl}/api/wiki/file/create`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ folderPath, fileName, content }),
      });
      if (res.ok) {
        const json = (await res.json()) as { success: boolean; note?: WikiNote };
        if (json.success && json.note) return json.note;
      }
    } catch (_err) {
      // Fallback
    }
    return this.fallback.createFile(folderPath, fileName, content);
  }

  public async renameItem(oldPath: string, newName: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/wiki/rename`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ oldPath, newName }),
      });
      if (res.ok) {
        const json = (await res.json()) as { success: boolean };
        return json.success;
      }
    } catch (_err) {
      // Fallback
    }
    return this.fallback.renameItem(oldPath, newName);
  }

  public async moveItem(sourcePath: string, targetFolder: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/wiki/move`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ sourcePath, targetFolder }),
      });
      if (res.ok) {
        const json = (await res.json()) as { success: boolean };
        return json.success;
      }
    } catch (_err) {
      // Fallback
    }
    return this.fallback.moveItem(sourcePath, targetFolder);
  }

  public async uploadFile(folderPath: string, fileName: string, content: string | ArrayBuffer): Promise<boolean> {
    try {
      let payloadContent = '';
      if (typeof content === 'string') {
        payloadContent = content;
      } else {
        const bytes = new Uint8Array(content);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        payloadContent = btoa(binary);
      }

      const res = await fetch(`${this.baseUrl}/api/wiki/upload`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ folderPath, fileName, content: payloadContent, isBase64: typeof content !== 'string' }),
      });

      if (res.ok) {
        const json = (await res.json()) as { success: boolean };
        return json.success;
      }
    } catch (_err) {
      // Fallback
    }
    return this.fallback.uploadFile(folderPath, fileName, content);
  }

  public async searchNotes(query: string): Promise<WikiNote[]> {
    const notes = await this.getAllNotes();
    const q = query.toLowerCase();
    return notes.filter(
      n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    );
  }

  public async getAllFolders(): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/wiki/folders`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const json = (await res.json()) as { success: boolean; folders?: string[] };
        if (json.success && Array.isArray(json.folders)) {
          return json.folders;
        }
      }
    } catch (_err) {
      // Backend unavailable
    }
    return ['wiki'];
  }

  public async sendChat(message: string, command?: string, contextNoteId?: string): Promise<string> {
    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ message, command, contextNoteId }),
      });

      if (res.ok) {
        const json = (await res.json()) as { success: boolean; response?: string };
        if (json.success && json.response) {
          return json.response;
        }
      }
    } catch (_err) {
      // Offline simulation fallback
    }

    return `### 🤖 Offline Agent Assistant\n\nReceived: "${message}". Connect to the backend server for live execution.`;
  }

  public async sendChatStream(
    message: string,
    onChunk: (chunk: string) => void,
    command?: string,
    contextNoteId?: string
  ): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({ message, command, contextNoteId, stream: true }),
      });

      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              const dataStr = trimmed.slice(6).trim();
              if (dataStr === '[DONE]') break;
              try {
                const parsed = JSON.parse(dataStr) as { chunk?: string };
                if (parsed.chunk) {
                  onChunk(parsed.chunk);
                }
              } catch (_e) {
                // ignore
              }
            }
          }
        }

        if (buffer.trim().startsWith('data: ')) {
          const dataStr = buffer.trim().slice(6).trim();
          if (dataStr !== '[DONE]') {
            try {
              const parsed = JSON.parse(dataStr) as { chunk?: string };
              if (parsed.chunk) onChunk(parsed.chunk);
            } catch (_e) {}
          }
        }
        return;
      }
    } catch (_err) {
      // Offline fallback
    }

    const fallbackResponse = await this.sendChat(message, command, contextNoteId);
    onChunk(fallbackResponse);
  }
}
