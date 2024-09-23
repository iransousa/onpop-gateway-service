import { Inject, Injectable } from '@nestjs/common';
import { GameState } from './interfaces/game-state.interface';
import { generateAllTiles, generateRoomId } from './utils/generate.util';
import { shuffleArray } from './utils/shuffle.util';
import { GameError } from './errors/game-error';
import { RedisClientType } from 'redis';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class GameStateManager {
  private readonly LOCK_VALUE = uuidv4();

  constructor(
    @Inject('REDIS_CLIENT') private redisClient: RedisClientType<any, any>,
  ) {}

  async createGameState(
    players: string[],
    betAmount: number,
  ): Promise<GameState> {
    const roomId = generateRoomId();
    const allTiles = generateAllTiles();
    shuffleArray(allTiles);

    const gameState: GameState = {
      roomId,
      players,
      hands: {},
      board: [],
      turnIndex: 0,
      betAmount,
      drawPile: [],
      lastAction: { playerId: '', action: 'play' },
      boardEnds: { left: -1, right: -1 },
      turnStartTime: Date.now(),
      disconnectedPlayers: new Set(),
      moveHistory: [],
      isFirstPlay: true,
      drawPileCount: 0,
      scores: {},
      currentTurn: '',
      yourPosition: 0,
      totalPlayers: players.length,
      otherPlayersHandCounts: {},
    };

    players.forEach((playerId) => {
      gameState.hands[playerId] = [];
    });

    // Distribute 7 tiles to each player
    players.forEach((playerId) => {
      gameState.hands[playerId] = allTiles.splice(0, 7);
    });

    if (players.length < 4) {
      gameState.drawPile = allTiles;
    }

    // Mapear cada playerId para o roomId no Redis
    const pipeline = this.redisClient.multi();
    players.forEach((playerId) => {
      pipeline.set(`player:${playerId}:room`, roomId);
    });
    await pipeline.exec();

    await this.setGameState(roomId, gameState);
    return gameState;
  }

  async setGameState(roomId: string, updatedState: GameState) {
    const gameState = JSON.stringify(updatedState);
    await this.redisClient.set(`game:${roomId}`, gameState);
    return updatedState;
  }

  async getGameState(roomId: string): Promise<GameState> {
    try {
      const gameState = await this.redisClient.get(`game:${roomId}`);
      if (!gameState) {
        throw new GameError('GAME_NOT_FOUND', 'Game not found');
      }
      return JSON.parse(gameState);
    } catch (error) {
      throw new GameError('CACHE_ERROR', 'Error accessing the cache');
    }
  }

  async getPlayerGameState(roomId: string, playerId: string): Promise<any> {
    try {
      const gameState = await this.getGameState(roomId);
      return {
        roomId: gameState.roomId,
        players: gameState.players,
        hands: gameState.hands[playerId] || [],
        board: gameState.board,
        currentTurn: gameState.players[gameState.turnIndex],
        boardEnds: gameState.boardEnds,
        betAmount: gameState.betAmount,
        betTotal: gameState.betAmount * gameState.players.length,
      };
    } catch (error) {
      throw new GameError('CACHE_ERROR', 'Error accessing the cache');
    }
  }

  async getRoomIdByPlayerId(playerId: string): Promise<string | null> {
    return await this.redisClient.get(`player:${playerId}:room`);
  }

  async removeGameState(roomId: string) {
    await this.redisClient.del(`game:${roomId}`);
  }

  async removePlayerRoomMapping(playerIds: string[]): Promise<void> {
    for (const playerId of playerIds) {
      await this.redisClient.del(`player:${playerId}:room`);
    }
  }

  async findGameByPlayerId(playerId: string): Promise<GameState | null> {
    const roomId = await this.getRoomIdByPlayerId(playerId);
    if (roomId) {
      return await this.getGameState(roomId);
    }
    return null;
  }

  async acquireLock(key: string, ttl: number = 5000): Promise<boolean> {
    const lockKey = `lock:${key}`;
    const result = await this.redisClient.set(lockKey, this.LOCK_VALUE, {
      NX: true,
      PX: ttl,
    });
    return result === 'OK';
  }

  async releaseLock(key: string): Promise<void> {
    const lockKey = `lock:${key}`;
    const lockValue = await this.redisClient.get(lockKey);
    if (lockValue === this.LOCK_VALUE) {
      await this.redisClient.del(lockKey);
    }
  }
}
