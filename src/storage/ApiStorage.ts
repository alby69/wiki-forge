import { WikiNote } from '../core/types/wiki';
import { IStorage } from '../core/interfaces/IStorage';
import { FileStorage } from './FileStorage';

export interface AttachOptions {
  noteId?: string;
  title?: string;
  folder?: string;
  content: string;
  mode?: 'append' | 'create' | 'overwrite';
}

export class ApiStorage implements IStorage {
  private fallback = new FileStorage();
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  public async getAllNotes(): Promise<WikiNote[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/wiki/notes`);
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
        headers: { 'Content-Type': 'application/json' },
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
          return json.note;
        }
      }
    } catch (_err) {
      // Backend unavailable; fallback
    }

    return this.fallback.saveNote(note);
  }

  public async attachNote(options: AttachOptions): Promise<WikiNote> {
    try {
      const res = await fetch(`${this.baseUrl}/api/wiki/attach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPath: id }),
      });
      if (res.ok) {
        const json = (await res.json()) as { success: boolean };
        return json.success;
      }
    } catch (_err) {
      // Backend unavailable
    }
    return false;
  }

  public async createFolder(folderPath: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/wiki/folder/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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

  public async sendChat(message: string, command?: string, contextNoteId?: string): Promise<string> {
    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
}
