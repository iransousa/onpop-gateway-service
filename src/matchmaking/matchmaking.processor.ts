import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { GatewayService } from 'src/gateway/gateway.service';
import { GameService } from 'src/game/game.service';
import { AppLogger } from '../shared/logger/logger.service';

interface Player {
  playerId: string;
  betAmount: number;
}

@Injectable()
@Processor('matchmaking')
export class MatchmakingProcessor extends WorkerHost {
  private waitingPlayers: Player[] = [];
  private matchmakingTimeout: NodeJS.Timeout | null = null;

  constructor(
    @Inject(forwardRef(() => GatewayService))
    private readonly gatewayService: GatewayService, // Injeção do GatewayService para notificar jogadores
    private readonly gameService: GameService,
    private readonly logger: AppLogger,
  ) {
    super();
    this.logger.setContext(MatchmakingProcessor.name);
  }

  async process(job: Job) {
    const { playerId, betAmount } = job.data;

    if (job.name === 'handle-matchmaking') {
      this.logger.log(
        `Processing matchmaking job for player ${playerId} with bet ${betAmount}`,
      );

      try {
        const player: Player = { playerId, betAmount };
        this.waitingPlayers.push(player);
        this.logger.log('Current waiting players:', this.waitingPlayers);

        await this.checkForMatch();
      } catch (error) {
        this.logger.error(
          `Error in matchmaking for player ${playerId}: ${error.message}`,
        );
      }
    } else if (job.name === 'create-game-with-bots') {
      await this.handleCreateGameWithBots(
        job.data.playerId,
        job.data.botCount,
        job.data.betAmount,
        job.data.botDifficulty,
      );
    }
  }

  async handleCreateGameWithBots(
    playerId: string,
    botCount: number,
    betAmount: number,
    botDifficulty: 'easy' | 'medium' | 'hard',
  ) {
    const gameState = await this.gameService.initializeGameWithBots(
      [playerId],
      botCount,
      betAmount,
      botDifficulty,
    );

    this.gatewayService.notifyPlayer(playerId, 'game_started', {
      roomId: gameState.roomId,
      players: gameState.players,
      hands: gameState.hands[playerId],
      // ... outras informações relevantes ...
    });
  }

  private async checkForMatch() {
    this.logger.log('Checking for match...');
    const betGroups = this.groupByBetAmount(this.waitingPlayers);
    this.logger.log('Grouped players:', betGroups);

    for (const betAmount in betGroups) {
      const players = betGroups[betAmount];

      if (players.length >= 2) {
        if (this.matchmakingTimeout) {
          clearTimeout(this.matchmakingTimeout);
        }

        this.matchmakingTimeout = setTimeout(async () => {
          if (players.length === 4) {
            const matchedPlayers = players.splice(0, 4);
            await this.createMatch(matchedPlayers);
          } else {
            await this.askPlayersToStart(
              players.slice(0, players.length >= 3 ? 3 : 2),
            );
          }
        }, 10000); // 10 segundos de espera
      }
    }
  }

  private async askPlayersToStart(players: Player[]) {
    const responses = await Promise.all(
      players.map((player) =>
        this.gatewayService.askPlayerToStart(player.playerId, players.length),
      ),
    );

    if (responses.every((response) => response === true)) {
      await this.createMatch(players);
      this.waitingPlayers = this.waitingPlayers.filter(
        (p) => !players.includes(p),
      );
    }
  }

  private groupByBetAmount(players: Player[]): { [key: number]: Player[] } {
    return players.reduce(
      (groups, player) => {
        const group = groups[player.betAmount] || [];
        group.push(player);
        groups[player.betAmount] = group;
        return groups;
      },
      {} as { [key: number]: Player[] },
    );
  }

  private async createMatch(players: Player[]) {
    this.logger.log(
      `Match created for players: ${players.map((p) => p.playerId).join(', ')}`,
    );

    // Criar uma nova sala de jogo
    await this.gameService.createGameRoom(
      players.map((p) => p.playerId),
      players[0].betAmount,
    );

    // Remover os jogadores da fila de espera
    this.waitingPlayers = this.waitingPlayers.filter(
      (p) => !players.includes(p),
    );
  }
}
