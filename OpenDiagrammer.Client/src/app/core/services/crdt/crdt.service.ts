import { Service, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { CanvasDiagramData } from '../../../features/board/canvas/canvas.models';
import { CanvasShape } from '../../../features/board/canvas/shape.models';
import { CanvasConnection } from '../../../features/board/canvas/connection.models';

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

@Service()
export class CrdtService {
  private doc: Y.Doc = new Y.Doc();
  private shapesMap: Y.Map<CanvasShape> = this.doc.getMap<CanvasShape>('shapes');
  private connectionsMap: Y.Map<CanvasConnection> =
    this.doc.getMap<CanvasConnection>('connections');
  private indexeddbProvider: IndexeddbPersistence | null = null;
  private currentBoardId: string | null = null;
  private isApplyingRemoteUpdate = false;

  private readonly localUpdateSubject$ = new Subject<Uint8Array>();
  public readonly localUpdate$: Observable<Uint8Array> = this.localUpdateSubject$.asObservable();

  private readonly remoteDiagramDataSubject$ = new Subject<CanvasDiagramData>();
  public readonly remoteDiagramData$: Observable<CanvasDiagramData> =
    this.remoteDiagramDataSubject$.asObservable();

  public readonly diagramData = signal<CanvasDiagramData>({
    shapes: [],
    connections: [],
  });

  public readonly isIndexedDbSynced = signal<boolean>(false);

  constructor() {
    this.setupListeners();
  }

  private setupListeners(): void {
    this.doc.on('update', (update: Uint8Array, origin: unknown) => {
      this.syncDiagramDataFromDoc();
      if (origin !== 'remote' && origin !== 'indexeddb') {
        this.localUpdateSubject$.next(update);
      } else {
        this.remoteDiagramDataSubject$.next(this.diagramData());
      }
    });
  }

  public async initBoard(
    boardId: string,
    initialData?: CanvasDiagramData | null,
    crdtStateBase64?: string | null,
  ): Promise<void> {
    this.destroy();

    this.currentBoardId = boardId;
    this.doc = new Y.Doc();
    this.shapesMap = this.doc.getMap<CanvasShape>('shapes');
    this.connectionsMap = this.doc.getMap<CanvasConnection>('connections');
    this.isIndexedDbSynced.set(false);

    this.setupListeners();

    // 1. Initialize IndexedDB persistence for offline fallback if available
    if (typeof indexedDB !== 'undefined') {
      try {
        this.indexeddbProvider = new IndexeddbPersistence(`board-${boardId}`, this.doc);
        await this.indexeddbProvider.whenSynced;
        this.isIndexedDbSynced.set(true);
      } catch {
        this.isIndexedDbSynced.set(true);
      }
    } else {
      this.isIndexedDbSynced.set(true);
    }

    // 2. If initial server CRDT state is present, apply it
    if (crdtStateBase64) {
      try {
        const update = base64ToUint8Array(crdtStateBase64);
        Y.applyUpdate(this.doc, update, 'remote');
      } catch {
        // Fallback to initial diagram data if binary decode fails
      }
    }

    // 3. If doc is still empty, populate from initial canvas JSON data
    if (this.shapesMap.size === 0 && this.connectionsMap.size === 0 && initialData) {
      this.doc.transact(() => {
        for (const shape of initialData.shapes) {
          this.shapesMap.set(shape.id, shape);
        }
        for (const conn of initialData.connections) {
          this.connectionsMap.set(conn.id, conn);
        }
      }, 'init');
    }

    this.syncDiagramDataFromDoc();
  }

  public applyRemoteUpdate(update: Uint8Array): void {
    this.isApplyingRemoteUpdate = true;
    try {
      Y.applyUpdate(this.doc, update, 'remote');
    } finally {
      this.isApplyingRemoteUpdate = false;
    }
  }

  public applyLocalDiagramChange(data: CanvasDiagramData): void {
    if (this.isApplyingRemoteUpdate) {
      return;
    }

    this.doc.transact(() => {
      // Track existing IDs to remove deleted ones
      const incomingShapeIds = new Set(data.shapes.map((s) => s.id));
      for (const key of this.shapesMap.keys()) {
        if (!incomingShapeIds.has(key)) {
          this.shapesMap.delete(key);
        }
      }

      for (const shape of data.shapes) {
        const existing = this.shapesMap.get(shape.id);
        if (!existing || JSON.stringify(existing) !== JSON.stringify(shape)) {
          this.shapesMap.set(shape.id, shape);
        }
      }

      const incomingConnIds = new Set(data.connections.map((c) => c.id));
      for (const key of this.connectionsMap.keys()) {
        if (!incomingConnIds.has(key)) {
          this.connectionsMap.delete(key);
        }
      }

      for (const conn of data.connections) {
        const existing = this.connectionsMap.get(conn.id);
        if (!existing || JSON.stringify(existing) !== JSON.stringify(conn)) {
          this.connectionsMap.set(conn.id, conn);
        }
      }
    }, 'local');
  }

  public updateShape(shape: CanvasShape): void {
    this.shapesMap.set(shape.id, shape);
  }

  public deleteShape(shapeId: string): void {
    this.shapesMap.delete(shapeId);
  }

  public updateConnection(connection: CanvasConnection): void {
    this.connectionsMap.set(connection.id, connection);
  }

  public deleteConnection(connectionId: string): void {
    this.connectionsMap.delete(connectionId);
  }

  public encodeStateAsUpdate(): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc);
  }

  public encodeStateAsBase64(): string {
    return uint8ArrayToBase64(this.encodeStateAsUpdate());
  }

  public getDiagramData(): CanvasDiagramData {
    return this.diagramData();
  }

  public getRawDoc(): Y.Doc {
    return this.doc;
  }

  private syncDiagramDataFromDoc(): void {
    const shapes: CanvasShape[] = [];
    for (const shape of this.shapesMap.values()) {
      shapes.push(shape);
    }

    const connections: CanvasConnection[] = [];
    for (const conn of this.connectionsMap.values()) {
      connections.push(conn);
    }

    this.diagramData.set({ shapes, connections });
  }

  public destroy(): void {
    if (this.indexeddbProvider) {
      this.indexeddbProvider.destroy();
      this.indexeddbProvider = null;
    }
    this.doc.destroy();
    this.currentBoardId = null;
  }
}
