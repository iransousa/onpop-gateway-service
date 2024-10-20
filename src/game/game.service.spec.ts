// src/game/game.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { GameService } from '@src/game/game.service';
import { GameStateManager } from '@src/game//game.state.manager';
import { PlayerActionService } from '@src/game//player.action.service';
import { AppLogger } from '@src/shared/logger/logger.service';
import { GameState } from '@src/game/interfaces/game-state.interface';
import { NotificationService } from 'src/game/notifications/notification.service';
import { GameLogicService } from 'src/game/game.logic.service';
import { BotManager } from 'src/game/bot.manager';
import { TimerService } from 'src/game/time.service';
import { GatewayService } from 'src/gateway/gateway.service';
import { MatchmakingService } from 'src/matchmaking/matchmaking.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

describe('GameService', () => {
  let service: GameService;
  let gameStateManager: GameStateManager;
  let playerActionService: PlayerActionService;
  let notificationService: NotificationService;
  let timerService: any;
  const TURN_WARNING = 10000;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameService,
        GameStateManager,
        AppLogger,
        GameLogicService,
        BotManager,
        NotificationService,
        TimerService,
        AppLogger,
        GatewayService,
        PlayerActionService,
        BotManager,
        MatchmakingService,
        ConfigService,
        JwtService,
      ],
    }).compile();

    service = module.get<GameService>(GameService);
    gameStateManager = module.get<GameStateManager>(GameStateManager);
    notificationService = module.get<NotificationService>(NotificationService);
    playerActionService = module.get<PlayerActionService>(PlayerActionService);
    timerService = module.get('TimerService');
    jest
      .spyOn(notificationService, 'notifyPlayersOfGameStart')
      .mockImplementation(() => {});
    jest
      .spyOn(notificationService, 'notifyPlayersOfMove')
      .mockImplementation(() => {});
    jest
      .spyOn(notificationService, 'notifyPlayersOfGameUpdate')
      .mockImplementation(() => {});
    jest
      .spyOn(notificationService, 'notifyPlayersOfGameEnd')
      .mockImplementation(() => {});
  });

  it('createGameRoom should initialize game state correctly', async () => {
    const players = ['player1', 'player2', 'player3', 'player4'];
    const betAmount = 100;
    const gameState = await service.createGameRoom(players, betAmount);
    expect(gameState.players).toEqual(players);
    expect(gameState.betAmount).toBe(betAmount);
    expect(gameState.turnIndex).toBeGreaterThanOrEqual(0);
    expect(gameState.turnIndex).toBeLessThan(players.length);
  });

  it('handlePlayerLeaveGame should remove player and update game state', async () => {
    const roomId = 'room1';
    const playerId = 'player1';
    await service.handlePlayerLeaveGame(roomId, playerId);
    const gameState = await gameStateManager.getGameState(roomId);
    expect(gameState.players).not.toContain(playerId);
    expect(gameState.hands[playerId]).toBeUndefined();
  });

  it('initializeGameWithBots should add bots and initialize game state', async () => {
    const humanPlayers = ['player1', 'player2'];
    const botCount = 2;
    const betAmount = 100;
    const gameState = await service.initializeGameWithBots(
      humanPlayers,
      botCount,
      betAmount,
    );
    expect(gameState.players.length).toBe(humanPlayers.length + botCount);
    for (let i = 1; i <= botCount; i++) {
      expect(gameState.players).toContain(`bot_${i}`);
    }
  });

  it('handlePlayerDisconnect should replace player with bot', async () => {
    const roomId = 'room1';
    const playerId = 'player1';
    await service.handlePlayerDisconnect(roomId, playerId);
    const gameState = await gameStateManager.getGameState(roomId);
    expect(gameState.players).toContain(`bot_${playerId}`);
    expect(gameState.hands[`bot_${playerId}`]).toEqual(
      gameState.hands[playerId],
    );
  });

  it('handlePlayerReconnect should replace bot with player', async () => {
    const roomId = 'room1';
    const playerId = 'player1';
    await service.handlePlayerReconnect(roomId, playerId);
    const gameState = await gameStateManager.getGameState(roomId);
    expect(gameState.players).toContain(playerId);
    expect(gameState.hands[playerId]).toEqual(
      gameState.hands[`bot_${playerId}`],
    );
  });

  it('warnPlayer should notify player of turn warning', async () => {
    const gameState = { players: ['player1'], turnIndex: 0 } as GameState;
    await service.warnPlayer(gameState);
    expect(notificationService.notifyPlayerTurnWarning).toHaveBeenCalledWith(
      'player1',
      TURN_WARNING,
    );
  });

  it('handleTurnTimeout should pass turn and start new turn timer', async () => {
    const gameState = {
      roomId: 'room1',
      players: ['player1'],
      turnIndex: 0,
    } as GameState;
    await service.handleTurnTimeout(gameState);
    expect(playerActionService.passTurn).toHaveBeenCalledWith(
      'room1',
      'player1',
    );
    expect(timerService.setTurnTimer).toHaveBeenCalled();
  });

  it('startTurnTimer should set warning and turn timers', async () => {
    const roomId = 'room1';
    await service.startTurnTimer(roomId);
    expect(timerService.setWarningTimer).toHaveBeenCalled();
    expect(timerService.setTurnTimer).toHaveBeenCalled();
  });

  it('endGame should notify players and update game state', async () => {
    const roomId = 'room1';
    const winner = 'player1';
    await service.endGame(roomId, winner, 'normal');
    const gameState = await gameStateManager.getGameState(roomId);
    expect(notificationService.notifyPlayersOfGameEnd).toHaveBeenCalledWith(
      gameState,
      winner,
      expect.any(Object),
    );
    expect(gameState.isFinished).toBe(true);
    expect(gameState.winner).toBe(winner);
  });
});
