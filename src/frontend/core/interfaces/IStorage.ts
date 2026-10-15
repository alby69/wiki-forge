import { WikiNote } from '@frontend/core/types/wiki';

/** Result of a one-shot Markdown import (stage in `raw/` + compile). */
export interface IngestResult {
  success: boolean;
  note?: WikiNote;
  compiled?: boolean;
  targetFolder?: string;
  message?: string;
  error?: string;
}

/**
 * Storage Abstraction Layer Interface (Vault Adapter)
 */
export interface IStorage {
  /**
   * Retrieves all notes in the vault
   */
  getAllNotes(): Promise<WikiNote[]>;

  /**
   * Retrieves a single note by ID/path
   */
  getNote(id: string): Promise<WikiNote | null>;

  /**
   * Saves or updates a note
   */
  saveNote(note: Partial<WikiNote> & { id: string }): Promise<WikiNote>;

  /**
   * Deletes a note by ID
   */
  deleteNote(id: string): Promise<boolean>;

  /**
   * Searches notes by query text
   */
  searchNotes(query: string): Promise<WikiNote[]>;

  /**
   * Creates a new folder inside the vault
   */
  createFolder?(folderPath: string): Promise<boolean>;

  /**
   * Creates a new file inside a folder
   */
  createFile?(folderPath: string, fileName: string, content?: string): Promise<WikiNote>;

  /**
   * Renames a file or folder
   */
  renameItem?(oldPath: string, newName: string): Promise<boolean>;

  /**
   * Moves a file or folder to a target directory
   */
  moveItem?(sourcePath: string, targetFolder: string): Promise<boolean>;

  /**
   * Uploads a file (text or binary encoded) into target folder
   */
  uploadFile?(folderPath: string, fileName: string, content: string | ArrayBuffer): Promise<boolean>;

  /**
   * Stages a Markdown file in `raw/`, compiles it and places the resulting
   * note in the chosen wiki folder (one-shot ingest + compile).
   */
  ingestMarkdownFile?(fileName: string, content: string, targetFolder: string): Promise<IngestResult>;
}
