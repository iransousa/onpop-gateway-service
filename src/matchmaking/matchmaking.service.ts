// src/matchmaking/matchmaking.service.ts
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AppLogger } from '@src/shared/logger/logger.service';

@Injectable()
export class MatchmakingService {
  private activePlayers = new Set<string>();

  constructor(
    @InjectQueue('matchmaking') private matchmakingQueue: Queue,
    private readonly logger: AppLogger,
  ) {}

  /**
   * Adiciona um jogador à fila de matchmaking como um job.
   */
  async addPlayerToQueue(
    playerId: string,
    betAmount: number,
    delay: number = 500,
    minPlayers: number = 2,
    isBot: boolean,
    type: string = 'REAL',
    botDifficulty: string = 'hard',
  ) {
    if (this.activePlayers.has(playerId)) {
      this.logger.error(`Player ${playerId} is already in matchmaking`);
      throw new Error(`Player ${playerId} is already in matchmaking`);
    }
    // Adicionar o jogador à lista de jogadores ativos
    try {
      this.activePlayers.add(playerId);
      if (isBot) {
        // Adicionar bots diretamente ao jogo
        this.logger.error(
          `Create game with bots ${playerId} - ${botDifficulty} - ${type} - ${minPlayers} - ${betAmount}`,
        );
        await this.matchmakingQueue.add(
          'create-game-with-bots',
          {
            playerId,
            botCount: minPlayers,
            betAmount,
            botDifficulty,
            type: 'DEMO',
          },
          {
            delay: delay,
            attempts: 3,
            removeOnComplete: true,
          },
        );
        return;
      }
      await this.matchmakingQueue.add(
        'handle-matchmaking',
        {
          playerId,
          betAmount,
          minPlayers: 2,
          type,
        },
        {
          delay: delay,
          attempts: 3,
          removeOnComplete: true,
        },
      );

      this.logger.log(
        `Player ${playerId} added to matchmaking queue with bet ${betAmount}`,
      );
    } catch (error) {
      this.logger.error(
        `Error adding player ${playerId} to matchmaking queue: ${error}`,
      );
      this.activePlayers.delete(playerId);
    }
  }

  /**
   * Remove um jogador da fila de matchmaking. Isso pode ser um pouco mais complicado
   * com Bull, pois não é fácil remover jobs individuais de uma fila. Uma opção
   * seria marcar os jogadores como inativos de forma lógica, ou ignorar jobs baseados em status.
   */
  async removePlayerFromQueue(playerId: string) {
    // Em Bull, remover um job pode ser complicado. Aqui, sugerimos uma abordagem alternativa
    // como flagging lógico, onde o processo de matchmaking verificaria se o jogador é válido.
    if (this.activePlayers.has(playerId)) {
      this.activePlayers.delete(playerId); // Remover da lista de jogadores ativos
      this.logger.log(`Player ${playerId} removed from matchmaking queue`);
    } else {
      throw new Error(`Player ${playerId} is not in matchmaking`);
    }
  }

  /**
   * Lida com a desconexão do jogador (remove da fila se estiver ativo).
   */
  async handlePlayerDisconnect(playerId: string) {
    if (this.activePlayers.has(playerId)) {
      await this.removePlayerFromQueue(playerId);
      this.logger.log(
        `Player ${playerId} disconnected and removed from matchmaking`,
      );
    }
  }
}
