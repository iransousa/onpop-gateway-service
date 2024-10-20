import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { BotManager } from '@src/game/bot.manager';
import { GatewayService } from '@src/gateway/gateway.service';
import { GameStateManager } from '@src/game/game.state.manager';
import { PlayerActionService } from '@src/game/player.action.service';
import { GameLogicService } from '@src/game/game.logic.service';
import { NotificationService } from '@src/game/notifications/notification.service';
import { GameState } from '@src/game/interfaces/game-state.interface';
import { TimerService } from '@src/game/time.service';
import { AppLogger } from '@src/shared/logger/logger.service';

const TURN_TIMEOUT = 30000; // 30 seconds
const TURN_WARNING = 10000; // Warn 10 seconds before timeout

@Injectable()
export class GameService {
  constructor(
    private readonly logger: AppLogger,
    private readonly gameStateManager: GameStateManager,
    private readonly playerActionService: PlayerActionService,
    private readonly gameLogicService: GameLogicService,
    private readonly botManager: BotManager,
    private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => GatewayService))
    @Inject(forwardRef(() => TimerService))
    private readonly timerService: TimerService,
  ) {
    this.logger.setContext(GameService.name);
  }

  async createGameRoom(
    players: string[],
    betAmount: number,
  ): Promise<GameState> {
    const gameState = await this.gameStateManager.createGameState(
      players,
      betAmount,
    );

    // Determine first player
    gameState.turnIndex = this.findFirstPlayer(gameState);
    this.logger.log(
      `First player: ${gameState.players[gameState.turnIndex]} - ${JSON.stringify(gameState.hands[gameState.players[gameState.turnIndex]])}`,
    );

    // Notify players
    this.notificationService.notifyPlayersOfGameStart(gameState);
    this.logger.log('Game started');

    await this.gameStateManager.setGameState(gameState.roomId, gameState);

    return gameState;
  }

  async handlePlayerLeaveGame(roomId: string, playerId: string) {
    const gameState = await this.gameStateManager.getGameState(roomId);
    if (!gameState) return;

    this.logger.log(`Player ${playerId} leaving game ${roomId}`);

    // Remove the player from the game state
    gameState.players = gameState.players.filter((id) => id !== playerId);

    // Remove the player's hand from the game state
    delete gameState.hands[playerId];

    // If only one player remains, end the game
    if (gameState.players.length === 1) {
      const winner = gameState.players[0];
      await this.endGame(roomId, winner, 'opponent_left');
      return;
    }

    // If there are more players, update the game state
    await this.gameStateManager.setGameState(roomId, gameState);

    // Notify remaining players that the player has left
    this.notificationService.notifyRoom(roomId, 'player_left', { playerId });

    this.logger.log(`Player ${playerId} successfully left the game`);
  }

  async initializeGameWithBots(
    humanPlayers: string[],
    botCount: number,
    betAmount: number,
    botDifficulty: 'easy' | 'medium' | 'hard' = 'medium',
  ): Promise<GameState> {
    const bots = Array.from({ length: botCount }, (_, i) => `bot_${i + 1}`);
    const allPlayers = [...humanPlayers, ...bots];

    const gameState = await this.createGameRoom(allPlayers, betAmount);

    // Add bots to BotManager
    for (const botId of bots) {
      await this.botManager.addBot(botId, botDifficulty);
    }

    return gameState;
  }

  async handlePlayerDisconnect(roomId: string, playerId: string) {
    const gameState = await this.gameStateManager.getGameState(roomId);
    if (!gameState) return;

    if (!gameState.disconnectedPlayers) {
      gameState.disconnectedPlayers = new Set<string>(); // Initialize as Set if undefined
    }

    gameState.disconnectedPlayers.add(playerId);

    const botId = `bot_${playerId}`;
    await this.botManager.addBot(botId, 'medium');

    // Replace player with bot
    gameState.players = gameState.players.map((id) =>
      id === playerId ? botId : id,
    );
    gameState.hands[botId] = gameState.hands[playerId];
    delete gameState.hands[playerId];

    await this.gameStateManager.setGameState(roomId, gameState);

    // Notify players
    this.notificationService.notifyPlayersOfDisconnect(gameState, playerId);

    // If it's the bot's turn, play
    const nextPlayerId = gameState.players[gameState.turnIndex];
    if (await this.botManager.isBot(nextPlayerId)) {
      await this.botManager.playBotTurn(gameState, nextPlayerId);
    }
  }

  async handlePlayerReconnect(roomId: string, playerId: string) {
    const gameState = await this.gameStateManager.getGameState(roomId);
    if (!gameState || !gameState.disconnectedPlayers) return;

    if (gameState.disconnectedPlayers.has(playerId)) {
      gameState.disconnectedPlayers.delete(playerId);

      const botId = `bot_${playerId}`;
      await this.botManager.removeBot(botId);

      gameState.players = gameState.players.map((id) =>
        id === botId ? playerId : id,
      );
      gameState.hands[playerId] = gameState.hands[botId];
      delete gameState.hands[botId];

      await this.gameStateManager.setGameState(roomId, gameState);

      // Notify players
      this.notificationService.notifyPlayersOfReconnection(gameState, playerId);

      // Send game state to reconnected player
      this.notificationService.sendGameStateToPlayer(gameState, playerId);
    }
  }

  async warnPlayer(gameState: GameState) {
    const currentPlayerId = gameState.players[gameState.turnIndex];
    this.notificationService.notifyPlayerTurnWarning(
      currentPlayerId,
      TURN_WARNING,
    );
  }

  async handleTurnTimeout(gameState: GameState) {
    const currentPlayerId = gameState.players[gameState.turnIndex];
    this.logger.warn(`Player ${currentPlayerId} turn timed out.`);

    // Decide what action to take on timeout, e.g., pass the turn
    await this.playerActionService.passTurn(gameState.roomId, currentPlayerId);

    // Proceed to the next turn
    await this.startTurnTimer(gameState.roomId);
  }

  async startTurnTimer(roomId: string) {
    const gameState = await this.gameStateManager.getGameState(roomId);
    gameState.turnStartTime = Date.now();
    await this.gameStateManager.setGameState(roomId, gameState);

    // Clear existing timers
    this.timerService.clearTurnTimer(roomId);
    this.timerService.clearWarningTimer(roomId);

    // Set warning timer
    const warningTimer = setTimeout(async () => {
      await this.warnPlayer(gameState);
    }, TURN_TIMEOUT - TURN_WARNING);
    this.timerService.setWarningTimer(roomId, warningTimer);

    // Set turn timeout timer
    const turnTimer = setTimeout(async () => {
      await this.handleTurnTimeout(gameState);
    }, TURN_TIMEOUT);
    this.timerService.setTurnTimer(roomId, turnTimer);
  }

  async endGame(roomId: string, winner: string | null, reason?: string) {
    const gameState = await this.gameStateManager.getGameState(roomId);
    if (!gameState) return;

    // Stop timers
    // this.timerService.clearTurnTimer(roomId);
    // this.timerService.clearWarningTimer(roomId);

    // Calculate final scores
    const scores = this.gameLogicService.calculateFinalScores(gameState);

    this.logger.debug(
      `Game ended. Winner: ${winner}, Scores: ${JSON.stringify(scores)}`,
    );

    gameState.finishedAt = new Date();
    gameState.isFinished = true;
    gameState.winner = winner;
    gameState.reason = reason;
    await this.gameStateManager.setGameState(roomId, gameState);
    this.logger.debug(`Game state: ${JSON.stringify(gameState)}`);

    // Notify players of game end
    this.notificationService.notifyPlayersOfGameEnd(gameState, winner, scores);

    // Remove game state
    // await this.gameStateManager.removeGameState(roomId);

    // Remove bots from BotManager and Redis
    for (const playerId of gameState.players) {
      if (await this.botManager.isBot(playerId)) {
        await this.botManager.removeBot(playerId);
      }
    }
  }

  private findFirstPlayer(gameState: GameState): number {
    const numberOfPlayers = gameState.players.length;
    this.logger.debug(`Finding first player for ${numberOfPlayers} players`);
    if (numberOfPlayers === 4) {
      // Para 4 jogadores, encontra quem tem a pedra [6:6]
      for (let i = 0; i < numberOfPlayers; i++) {
        const playerId = gameState.players[i];
        if (
          gameState.hands[playerId].some(
            (tile) => tile.left === 6 && tile.right === 6,
          )
        ) {
          // Jogador com [6:6] inicia
          this.logger.debug(
            `First player for ${numberOfPlayers} players is ${i}`,
          );
          return i;
        }
      }
      // Não é necessário escolher aleatoriamente, pois alguém sempre terá a [6:6]
      // Se o código chegar aqui, é porque houve um erro na distribuição das pedras
      throw new Error(
        'Nenhum jogador possui a pedra [6:6], o que é impossível em um jogo de 4 jogadores.',
      );
    } else if (numberOfPlayers === 2 || numberOfPlayers === 3) {
      // Para 2 ou 3 jogadores, encontra quem tem a maior dupla
      for (let pip = 6; pip >= 0; pip--) {
        for (let i = 0; i < numberOfPlayers; i++) {
          const playerId = gameState.players[i];
          if (
            gameState.hands[playerId].some(
              (tile) => tile.left === pip && tile.right === pip,
            )
          ) {
            // Jogador com a maior dupla inicia
            this.logger.debug(
              `First player for ${numberOfPlayers} players is ${i}`,
            );
            return i;
          }
        }
      }
      this.logger.debug(
        `No one has a double, choosing randomly for ${numberOfPlayers} players`,
      );
      // Se ninguém tem dupla, escolhe aleatoriamente
      return Math.floor(Math.random() * numberOfPlayers);
    } else {
      this.logger.debug(
        `No one has a double, choosing randomly for ${numberOfPlayers} players`,
      );
      // Para outros números de jogadores, escolhe aleatoriamente
      return Math.floor(Math.random() * numberOfPlayers);
    }
  }
}
