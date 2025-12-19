import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

export function createRoomsRouter(prisma: PrismaClient): Router {
  const router = Router();

  // Create a new room
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { id, name, creatorId, visibility = 'public' } = req.body;

      if (!id || !name) {
        return res.status(400).json({ error: 'id and name are required' });
      }

      const room = await prisma.room.create({
        data: {
          id,
          name,
          creatorId,
          visibility,
        },
      });

      console.log(`[API] Created room: ${room.id}`);
      res.status(201).json(room);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Room already exists' });
      }
      console.error('[API] Error creating room:', error);
      res.status(500).json({ error: 'Failed to create room' });
    }
  });

  // Get room by ID
  router.get('/:roomId', async (req: Request, res: Response) => {
    try {
      const { roomId } = req.params;

      const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: {
          participants: {
            where: { leftAt: null },
            select: {
              userId: true,
              userName: true,
              userColor: true,
              clientId: true,
              joinedAt: true,
            },
          },
        },
      });

      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      res.json(room);
    } catch (error) {
      console.error('[API] Error fetching room:', error);
      res.status(500).json({ error: 'Failed to fetch room' });
    }
  });

  // Check if room exists
  router.get('/:roomId/exists', async (req: Request, res: Response) => {
    try {
      const { roomId } = req.params;

      const room = await prisma.room.findUnique({
        where: { id: roomId },
        select: { id: true, name: true },
      });

      res.json({ exists: !!room, room });
    } catch (error) {
      console.error('[API] Error checking room:', error);
      res.status(500).json({ error: 'Failed to check room' });
    }
  });

  // Update room
  router.patch('/:roomId', async (req: Request, res: Response) => {
    try {
      const { roomId } = req.params;
      const { name, visibility } = req.body;

      const room = await prisma.room.update({
        where: { id: roomId },
        data: {
          ...(name && { name }),
          ...(visibility && { visibility }),
          lastActive: new Date(),
        },
      });

      res.json(room);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Room not found' });
      }
      console.error('[API] Error updating room:', error);
      res.status(500).json({ error: 'Failed to update room' });
    }
  });

  // Delete room
  router.delete('/:roomId', async (req: Request, res: Response) => {
    try {
      const { roomId } = req.params;

      await prisma.room.delete({
        where: { id: roomId },
      });

      console.log(`[API] Deleted room: ${roomId}`);
      res.status(204).send();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Room not found' });
      }
      console.error('[API] Error deleting room:', error);
      res.status(500).json({ error: 'Failed to delete room' });
    }
  });

  // Get room history (for recovery)
  router.get('/:roomId/snapshots', async (req: Request, res: Response) => {
    try {
      const { roomId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;

      const snapshots = await prisma.roomSnapshot.findMany({
        where: { roomId },
        orderBy: { version: 'desc' },
        take: limit,
        select: {
          id: true,
          version: true,
          createdAt: true,
        },
      });

      res.json(snapshots);
    } catch (error) {
      console.error('[API] Error fetching snapshots:', error);
      res.status(500).json({ error: 'Failed to fetch snapshots' });
    }
  });

  return router;
}
