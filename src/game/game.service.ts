import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { BotManager } from './bot.manager';
import { GatewayService } from '../gateway/gateway.service';
import { GameStateManager } from './game.state.manager';
import { PlayerActionService } from './player.action.service';
import { GameLogicService } from './game.logic.service';
import { NotificationService } from './notifications/notification.service';
import { GameState } from './interfaces/game-state.interface';
import { TimerService } from './time.service';
import { AppLogger } from '../shared/logger/logger.service';

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
    this.logger.log(`First player: ${gameState.players[gameState.turnIndex]}`);

    // Notify players
    this.notificationService.notifyPlayersOfGameStart(gameState);
    this.logger.log('Game started');

    await this.gameStateManager.setGameState(gameState.roomId, gameState);

    // Start turn timer if applicable
    // ...

    return gameState;
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
    if (!gameState || gameState?.disconnectedPlayers) return;

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
    if (!gameState) return;

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

  async endGame(roomId: string, winner: string | null) {
    const gameState = await this.gameStateManager.getGameState(roomId);
    if (!gameState) return;

    // Stop timers
    this.timerService.clearTurnTimer(roomId);
    this.timerService.clearWarningTimer(roomId);

    // Calculate final scores
    const scores = this.gameLogicService.calculateFinalScores(gameState);

    // Notify players of game end
    this.notificationService.notifyPlayersOfGameEnd(gameState, winner, scores);

    // Remove game state
    await this.gameStateManager.removeGameState(roomId);

    // Remove bots from BotManager and Redis
    for (const playerId of gameState.players) {
      if (await this.botManager.isBot(playerId)) {
        await this.botManager.removeBot(playerId);
      }
    }
  }

  private findFirstPlayer(gameState: GameState): number {
    if (gameState.players.length === 4) {
      // For 4 players, find who has the 6:6 tile
      for (let i = 0; i < gameState.players.length; i++) {
        const playerId = gameState.players[i];
        if (
          gameState.hands[playerId].some(
            (tile) => tile.left === 6 && tile.right === 6,
          )
        ) {
          return i;
        }
      }
    }
    // For 2 or 3 players, or if no one has 6:6, choose randomly
    return Math.floor(Math.random() * gameState.players.length);
  }
}
