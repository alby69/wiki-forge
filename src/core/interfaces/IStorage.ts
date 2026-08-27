import { WikiNote } from '../types/wiki';

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
}
