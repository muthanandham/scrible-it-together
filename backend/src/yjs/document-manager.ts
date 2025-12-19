import * as Y from 'yjs';
import { PrismaClient } from '@prisma/client';

export class YjsDocumentManager {
  private documents = new Map<string, Y.Doc>();
  private saveTimers = new Map<string, NodeJS.Timeout>();
  private prisma: PrismaClient;
  private saveIntervalMs: number;

  constructor(prisma: PrismaClient, saveIntervalMs = 30000) {
    this.prisma = prisma;
    this.saveIntervalMs = saveIntervalMs;
  }

  async getOrCreateDocument(roomId: string): Promise<Y.Doc> {
    let doc = this.documents.get(roomId);

    if (!doc) {
      doc = new Y.Doc();
      console.log(`[Yjs] Creating document for room: ${roomId}`);

      // Load latest snapshot from database
      const snapshot = await this.prisma.roomSnapshot.findFirst({
        where: { roomId },
        orderBy: { version: 'desc' },
      });

      if (snapshot) {
        console.log(`[Yjs] Loaded snapshot v${snapshot.version} for room: ${roomId}`);
        Y.applyUpdate(doc, new Uint8Array(snapshot.snapshotData));
      }

      this.documents.set(roomId, doc);

      // Set up periodic snapshot saving
      this.setupSnapshotSaving(roomId, doc);
    }

    return doc;
  }

  private setupSnapshotSaving(roomId: string, doc: Y.Doc) {
    // Clear existing timer if any
    const existingTimer = this.saveTimers.get(roomId);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    // Save snapshot periodically
    const timer = setInterval(async () => {
      await this.saveSnapshot(roomId, doc);
    }, this.saveIntervalMs);

    this.saveTimers.set(roomId, timer);
  }

  async saveSnapshot(roomId: string, doc?: Y.Doc) {
    const document = doc || this.documents.get(roomId);
    if (!document) return;

    try {
      const snapshot = Y.encodeStateAsUpdate(document);
      const stateVector = Y.encodeStateVector(document);

      const lastSnapshot = await this.prisma.roomSnapshot.findFirst({
        where: { roomId },
        orderBy: { version: 'desc' },
      });

      const version = (lastSnapshot?.version || 0) + 1;

      await this.prisma.roomSnapshot.create({
        data: {
          roomId,
          snapshotData: Buffer.from(snapshot),
          stateVector: Buffer.from(stateVector),
          version,
        },
      });

      console.log(`[Yjs] Saved snapshot v${version} for room: ${roomId}`);

      // Cleanup old snapshots (keep last 10)
      const oldSnapshots = await this.prisma.roomSnapshot.findMany({
        where: { roomId },
        orderBy: { version: 'desc' },
        skip: 10,
      });

      if (oldSnapshots.length > 0) {
        await this.prisma.roomSnapshot.deleteMany({
          where: {
            id: { in: oldSnapshots.map(s => s.id) },
          },
        });
        console.log(`[Yjs] Cleaned up ${oldSnapshots.length} old snapshots`);
      }
    } catch (error) {
      console.error(`[Yjs] Failed to save snapshot for room ${roomId}:`, error);
    }
  }

  applyUpdate(roomId: string, update: Uint8Array): boolean {
    const doc = this.documents.get(roomId);
    if (doc) {
      Y.applyUpdate(doc, update);
      return true;
    }
    return false;
  }

  getStateAsUpdate(roomId: string): Uint8Array | null {
    const doc = this.documents.get(roomId);
    return doc ? Y.encodeStateAsUpdate(doc) : null;
  }

  getStateVector(roomId: string): Uint8Array | null {
    const doc = this.documents.get(roomId);
    return doc ? Y.encodeStateVector(doc) : null;
  }

  async destroyDocument(roomId: string) {
    const doc = this.documents.get(roomId);
    if (doc) {
      // Save final snapshot before destroying
      await this.saveSnapshot(roomId, doc);

      // Clear save timer
      const timer = this.saveTimers.get(roomId);
      if (timer) {
        clearInterval(timer);
        this.saveTimers.delete(roomId);
      }

      doc.destroy();
      this.documents.delete(roomId);
      console.log(`[Yjs] Destroyed document for room: ${roomId}`);
    }
  }

  getActiveRoomCount(): number {
    return this.documents.size;
  }
}
