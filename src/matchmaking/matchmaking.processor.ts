import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { GatewayService } from '@src/gateway/gateway.service';
import { GameService } from '@src/game/game.service';
import { AppLogger } from '@src/shared/logger/logger.service';

interface Player {
  playerId: string;
  betAmount: number;
  minPlayers: number;
  type: string;
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
    const { playerId, betAmount, minPlayers, type, botDifficulty } = job.data;

    if (job.name === 'handle-matchmaking') {
      this.logger.log(
        `Processing matchmaking job for player ${playerId} with bet ${betAmount}`,
      );

      try {
        const player: Player = { playerId, betAmount, minPlayers, type };
        this.waitingPlayers.push(player);
        this.logger.log('Current waiting players:', this.waitingPlayers);

        await this.checkForMatch();
      } catch (error) {
        this.logger.error(
          `Error in matchmaking for player ${playerId}: ${error.message}`,
        );
        this.removePlayerState(playerId);
      }
    } else if (job.name === 'create-game-with-bots') {
      await this.handleCreateGameWithBots(
        playerId,
        minPlayers,
        betAmount,
        botDifficulty,
      );
    }
  }

  async handleCreateGameWithBots(
    playerId: string,
    botCount: number = 3,
    betAmount: number,
    botDifficulty: 'easy' | 'medium' | 'hard',
  ) {
    try {
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
      });
      // await this.gameService.startTurnTimer(gameState.roomId);
    } catch (error) {
      this.removePlayerState(playerId);
      this.logger.error(
        `Error creating game with bots for player ${playerId}: ${error.message}`,
      );
    }
  }

  private async checkForMatch() {
    this.logger.log('Checking for match...');
    const betGroups = this.groupByBetAmount(this.waitingPlayers);
    this.logger.log('Grouped players:', betGroups);

    for (const betAmount in betGroups) {
      const players = betGroups[betAmount];

      if (players.length >= 2) {
        // Limpar qualquer timeout anterior, caso exista
        if (this.matchmakingTimeout) {
          clearTimeout(this.matchmakingTimeout);
        }

        // Esperar 30 segundos para iniciar a partida, caso haja no mínimo 2 jogadores
        this.matchmakingTimeout = setTimeout(async () => {
          const currentPlayers = betGroups[betAmount]; // Reavaliar o número de jogadores após o tempo de espera
          if (currentPlayers.length >= 2) {
            const matchedPlayers = currentPlayers.splice(
              0,
              Math.min(currentPlayers.length, 4),
            );
            await this.createMatch(matchedPlayers);
          } else {
            this.logger.log(
              `Not enough players for bet amount ${betAmount} after waiting, still waiting...`,
            );
          }
        }, 30000); // 30 segundos de espera
      } else {
        this.logger.log(
          `Not enough players for bet amount ${betAmount}, waiting for more players...`,
        );
      }
    }
  }

  // private async checkForMatch() {
  //   this.logger.log('Checking for match...');
  //
  //   // Agrupar jogadores por valor de aposta
  //   const betGroups = this.groupByBetAmount(this.waitingPlayers);
  //   this.logger.log('Grouped players by bet amount:', betGroups);
  //
  //   // Percorrer cada grupo de apostas
  //   for (const betAmount in betGroups) {
  //     const players = betGroups[betAmount];
  //
  //     // Agrupar jogadores pelo minPlayers
  //     const minPlayersGroups = this.groupByMinPlayers(players);
  //
  //     for (const minPlayers in minPlayersGroups) {
  //       const group = minPlayersGroups[minPlayers];
  //
  //       // Verifica se há jogadores suficientes de acordo com o minPlayers
  //       if (group.length >= Number(minPlayers)) {
  //         this.logger.log(
  //           `Found ${group.length} players for bet amount ${betAmount} with minPlayers ${minPlayers}`,
  //         );
  //
  //         // Limpa qualquer timeout existente para esta partida
  //         if (this.matchmakingTimeout) {
  //           clearTimeout(this.matchmakingTimeout);
  //         }
  //
  //         // Verificar se deve iniciar com 2, 3 ou 4 jogadores
  //         const matchedPlayers = group.splice(0, Math.min(group.length, 4)); // Pega o mínimo de jogadores até 4
  //
  //         await this.createMatch(matchedPlayers);
  //       } else {
  //         this.logger.log(
  //           `Not enough players for bet amount ${betAmount} with minPlayers ${minPlayers}, waiting...`,
  //         );
  //       }
  //     }
  //   }
  // }

  private groupByMinPlayers(players: Player[]): { [key: number]: Player[] } {
    return players.reduce(
      (groups, player) => {
        const group = groups[player.minPlayers] || [];
        group.push(player);
        groups[player.minPlayers] = group;
        return groups;
      },
      {} as { [key: number]: Player[] },
    );
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

  private removePlayerState(playerId: string) {
    this.waitingPlayers = this.waitingPlayers.filter(
      (player) => player.playerId !== playerId,
    );
    this.logger.log(`Player ${playerId} removed from waiting players state`);
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
    players.forEach((player) => this.removePlayerState(player.playerId));
  }
}
