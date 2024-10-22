import { Inject, Injectable } from '@nestjs/common';
import { GameState } from '@src/game/interfaces/game-state.interface';
import {
  generateAllTiles,
  generateRoomId,
} from '@src/game/utils/generate.util';
import { shuffleArray } from '@src/game/utils/shuffle.util';
import { GameError } from '@src/game/errors/game-error';
import { RedisClientType } from 'redis';
import { v4 as uuidv4 } from 'uuid';
import { AppLogger } from '@src/shared/logger/logger.service';

@Injectable()
export class GameStateManager {
  private static readonly LOCK_VALUE = uuidv4();

  constructor(
    private readonly logger: AppLogger,
    @Inject('REDIS_CLIENT') private redisClient: RedisClientType<any, any>,
  ) {
    this.logger.setContext(GameStateManager.name);
  }

  async createGameState(
    players: string[],
    betAmount: number,
  ): Promise<GameState> {
    const roomId = generateRoomId();
    const allTiles = generateAllTiles();
    shuffleArray(allTiles);
    this.logger.debug(`Creating game room ${roomId} with players ${players}`);
    this.logger.debug(
      `All tiles count ${allTiles.length} | ${JSON.stringify(allTiles)}`,
    );

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
      disconnectedPlayers: new Set<string>(),
      moveHistory: [],
      isFirstPlay: true,
      drawPileCount: 0,
      scores: {},
      currentTurn: '',
      yourPosition: 0,
      totalPlayers: players.length,
      otherPlayersHandCounts: {},
      createdAt: new Date(),
      finishedAt: null,
      isFinished: false,
    };

    players.forEach((playerId) => {
      gameState.hands[playerId] = [];
    });

    // Distribute 7 tiles to each player
    players.forEach((playerId) => {
      gameState.hands[playerId] = allTiles.splice(0, 7);
      this.logger.debug(
        `Player ${playerId} hand total ${gameState.hands[playerId].length} | ${JSON.stringify(gameState.hands[playerId])}`,
      );
    });

    if (players.length < 4) {
      gameState.drawPile = allTiles;
      this.logger.debug(
        `Draw tiles total ${allTiles.length} | ${JSON.stringify(allTiles)}`,
      );
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
    const gameState = JSON.stringify({
      ...updatedState,
      disconnectedPlayers: Array.from(updatedState.disconnectedPlayers),
    });
    await this.redisClient.set(`game:${roomId}`, gameState);
    return updatedState;
  }

  async getGameState(roomId: string): Promise<GameState> {
    try {
      const hasGameLabel = roomId.startsWith('game:');
      const room = hasGameLabel ? roomId : `game:${roomId}`;
      const gameState = await this.redisClient.get(room);
      if (!gameState) {
        return;
      }
      const parsedState = JSON.parse(gameState) as GameState;
      // Ensure disconnectedPlayers is a Set
      if (Array.isArray(parsedState.disconnectedPlayers)) {
        // If it's an array, convert to Set
        parsedState.disconnectedPlayers = new Set(
          parsedState.disconnectedPlayers,
        );
      } else if (
        parsedState.disconnectedPlayers &&
        typeof parsedState.disconnectedPlayers === 'object'
      ) {
        // If it's an object (possibly {}), treat it as empty and convert to Set
        parsedState.disconnectedPlayers = new Set();
      } else if (!parsedState.disconnectedPlayers) {
        // If disconnectedPlayers is null or undefined, initialize as an empty Set
        parsedState.disconnectedPlayers = new Set();
      }
      return parsedState;
    } catch (error) {
      console.log(error);
      // throw new GameError('CACHE_ERROR', 'Error accessing the cache');
    }
  }

  getPlayers(gameState: GameState) {
    return gameState.players.map((player) => ({
      position: gameState.players.indexOf(player),
      qtdPdras: gameState.hands[player].length,
      name: player,
    }));
  }

  async getPlayerGameState(roomId: string, playerId: string): Promise<any> {
    try {
      const gameState = await this.getGameState(roomId);
      const players = this.getPlayers(gameState);
      return {
        roomId: gameState.roomId,
        players,
        hands: gameState.hands[playerId] || [],
        board: gameState.board,
        currentTurn: gameState.players[gameState.turnIndex],
        boardEnds: gameState.boardEnds,
        betAmount: gameState.betAmount,
        betTotal: gameState.betAmount * gameState.players.length,
        primeiraPedraDoBoard: gameState.board[0],
        drawPileCount: gameState.drawPile.length,
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

  async cleanRoom(gameState: GameState) {
    await Promise.all([
      this.removeGameState(gameState.roomId),
      this.removePlayerRoomMapping(gameState.players),
      this.cleanChatMessages(gameState.roomId),
    ]);
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
    const result = await this.redisClient.set(
      lockKey,
      GameStateManager.LOCK_VALUE,
      {
        NX: true,
        PX: ttl,
      },
    );
    return result === 'OK';
  }

  async releaseLock(key: string): Promise<void> {
    const lockKey = `lock:${key}`;
    const lockValue = await this.redisClient.get(lockKey);
    if (lockValue === GameStateManager.LOCK_VALUE) {
      await this.redisClient.del(lockKey);
    }
  }

  // Método para adicionar uma mensagem de chat no Redis
  async addChatMessage(roomId: string, playerId: string, message: string) {
    const chatMessage = {
      playerId,
      message,
      timestamp: new Date().toISOString(),
    };

    // Salva a mensagem no Redis, adicionando à lista de mensagens da sala
    await this.redisClient.rPush(`chat:${roomId}`, JSON.stringify(chatMessage));
  }

  // Método para recuperar as mensagens de chat de uma sala
  async getChatMessages(roomId: string): Promise<any[]> {
    const messages = await this.redisClient.lRange(`chat:${roomId}`, 0, -1);
    return messages.map((message) => JSON.parse(message));
  }

  async cleanChatMessages(roomId: string) {
    await this.redisClient.del(`chat:${roomId}`);
  }

  async cleanAll() {
    await this.redisClient.flushAll();
  }
}
