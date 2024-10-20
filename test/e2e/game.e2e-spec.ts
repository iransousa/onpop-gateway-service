import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '@src/app.module';
import { GameService } from '@src/game/game.service';
import { GameStateManager } from '@src/game/game.state.manager';
import { PlayerActionService } from '@src/game/player.action.service';
import { GameLogicService } from '@src/game/game.logic.service';
import { BotManager } from '@src/game/bot.manager';
import { NotificationService } from '@src/game/notifications/notification.service';
import { AppLogger } from '@src/shared/logger/logger.service';
import { TimerService } from '@src/game/time.service';
import { GatewayService } from '@src/gateway/gateway.service';
import { MatchmakingService } from '@src/matchmaking/matchmaking.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import { GameState } from '@src/game/interfaces/game-state.interface';

describe('GameService Integration Test', () => {
  let app: INestApplication;
  let gameService: GameService;
  let gameStateManager: GameStateManager;
  let playerActionService: PlayerActionService;
  let gameLogicService: GameLogicService;
  let botManager: BotManager;

  beforeAll(async () => {
    process.env.TEST_ENV = 'true'; // Define the test environment

    const moduleRef = await Test.createTestingModule({
      imports: [
        AppModule,
        AppModule,
        BullModule.registerQueueAsync({
          name: 'matchmaking',
          imports: [ConfigModule],
          useFactory: async (configService: ConfigService) => ({
            connection: {
              host: configService.get('REDIS_HOST'),
              port: configService.get('REDIS_PORT'),
              password: configService.get('REDIS_PASSWORD'),
              username: configService.get('REDIS_USERNAME'),
            },
          }),
          inject: [ConfigService],
        }),
      ],
      providers: [
        GameService,
        GameStateManager,
        PlayerActionService,
        GameLogicService,
        BotManager,
        NotificationService,
        TimerService,
        AppLogger,
        GatewayService,
        MatchmakingService,
        ConfigService,
        JwtService,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    gameService = moduleRef.get<GameService>(GameService);
    gameStateManager = moduleRef.get<GameStateManager>(GameStateManager);
    playerActionService =
      moduleRef.get<PlayerActionService>(PlayerActionService);
    gameLogicService = moduleRef.get<GameLogicService>(GameLogicService);
    botManager = moduleRef.get<BotManager>(BotManager);

    // Mock NotificationService to avoid real notifications
    const notificationService =
      moduleRef.get<NotificationService>(NotificationService);
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

  afterAll(async () => {
    // await gameStateManager.cleanAll();
    await app.close();
  });

  // it('should simulate a complete game with 2 players', async () => {
  //   const players = ['player1', 'player2'];
  //   const betAmount = 100;
  //
  //   // Create the game
  //   let gameState = await gameService.createGameRoom(players, betAmount);
  //
  //   // Verify the first player is correct
  //   const highestDoubleInfo = findHighestDouble(gameState);
  //   if (highestDoubleInfo.playerId) {
  //     expect(gameState.players[gameState.turnIndex]).toBe(
  //       highestDoubleInfo.playerId,
  //     );
  //   }
  //
  //   let gameOver = false;
  //
  //   while (!gameOver) {
  //     // Fetch the current game state at the start of the loop
  //     gameState = await gameStateManager.getGameState(gameState.roomId);
  //
  //     // Check if the game state is undefined
  //     if (!gameState) {
  //       console.log(
  //         'Game state is no longer available. The game may have ended.',
  //       );
  //       break;
  //     }
  //
  //     // Check if the game has finished
  //     if (gameState.isFinished) {
  //       gameOver = true;
  //       console.log(`Game has ended. Winner: ${gameState.winner}`);
  //       break;
  //     }
  //
  //     let currentPlayerIndex = gameState.turnIndex;
  //     let currentPlayerId = gameState.players[currentPlayerIndex];
  //     let playerHand = gameState.hands[currentPlayerId];
  //
  //     console.log(`Current turn: ${gameState.currentTurn}`);
  //     console.log(`Current player index: ${currentPlayerIndex}`);
  //     console.log(`Current player ID: ${currentPlayerId}`);
  //
  //     // Recalculate playable tiles
  //     let playableTiles = playerHand.filter(
  //       (tile) =>
  //         gameLogicService.isValidMove(gameState, tile, 'left') ||
  //         gameLogicService.isValidMove(gameState, tile, 'right'),
  //     );
  //
  //     if (playableTiles.length > 0) {
  //       // Play the first valid tile
  //       const tileToPlay = playableTiles[0];
  //       const side = gameLogicService.isValidMove(gameState, tileToPlay, 'left')
  //         ? 'left'
  //         : 'right';
  //
  //       await playerActionService.playTile(
  //         gameState.roomId,
  //         currentPlayerId,
  //         tileToPlay,
  //         side,
  //       );
  //
  //       // Update game state
  //       gameState = await gameStateManager.getGameState(gameState.roomId);
  //     } else {
  //       // Player needs to draw tiles one at a time until they can play or the draw pile is empty
  //       while (!playableTiles.length && gameState.drawPile.length > 0) {
  //         await playerActionService.drawTile(gameState.roomId, currentPlayerId);
  //
  //         // Update game state after drawing
  //         gameState = await gameStateManager.getGameState(gameState.roomId);
  //         playerHand = gameState.hands[currentPlayerId];
  //
  //         // Recalculate playable tiles after drawing
  //         playableTiles = playerHand.filter(
  //           (tile) =>
  //             gameLogicService.isValidMove(gameState, tile, 'left') ||
  //             gameLogicService.isValidMove(gameState, tile, 'right'),
  //         );
  //       }
  //
  //       if (playableTiles.length > 0) {
  //         // Player can now play
  //         const tileToPlay = playableTiles[0];
  //         const side = gameLogicService.isValidMove(
  //           gameState,
  //           tileToPlay,
  //           'left',
  //         )
  //           ? 'left'
  //           : 'right';
  //
  //         await playerActionService.playTile(
  //           gameState.roomId,
  //           currentPlayerId,
  //           tileToPlay,
  //           side,
  //         );
  //
  //         // Update game state
  //         gameState = await gameStateManager.getGameState(gameState.roomId);
  //       } else {
  //         // Draw pile is empty, and the player cannot play; pass the turn
  //         await playerActionService.passTurn(gameState.roomId, currentPlayerId);
  //
  //         // Update game state
  //         gameState = await gameStateManager.getGameState(gameState.roomId);
  //       }
  //     }
  //
  //     // Check if the game is over
  //     const winner = gameLogicService.checkWinner(gameState);
  //     if (winner) {
  //       gameOver = true;
  //       expect(winner).toBeDefined();
  //       console.log(`Winning player: ${winner}`);
  //       break;
  //     }
  //
  //     if (gameLogicService.isGameBlocked(gameState)) {
  //       gameOver = true;
  //       const winner = gameLogicService.determineWinnerByLowestTile(gameState);
  //       expect(winner).toBeDefined();
  //       console.log(`Game blocked. Player with lowest sum: ${winner}`);
  //       break;
  //     }
  //
  //     // Update currentPlayerIndex and currentPlayerId
  //     currentPlayerIndex = gameState.turnIndex;
  //     currentPlayerId = gameState.players[currentPlayerIndex];
  //   }
  // }, 300000);

  it('should simulate a complete game with 3 players', async () => {
    const players = ['player1', 'player2', 'player3'];
    const betAmount = 100;

    // Create the game
    let gameState = await gameService.createGameRoom(players, betAmount);

    // Verify the first player is correct
    const highestDoubleInfo = findHighestDouble(gameState);
    if (highestDoubleInfo.playerId) {
      expect(gameState.players[gameState.turnIndex]).toBe(
        highestDoubleInfo.playerId,
      );
    }

    let gameOver = false;

    while (!gameOver) {
      // Fetch the current game state at the start of the loop
      gameState = await gameStateManager.getGameState(gameState.roomId);

      // Check if the game state is undefined
      if (!gameState) {
        console.log(
          'Game state is no longer available. The game may have ended.',
        );
        break;
      }

      // Check if the game has finished
      if (gameState.isFinished) {
        gameOver = true;
        console.log(`Game has ended. Winner: ${gameState.winner}`);
        break;
      }

      let currentPlayerIndex = gameState.turnIndex;
      let currentPlayerId = gameState.players[currentPlayerIndex];
      let playerHand = gameState.hands[currentPlayerId];

      console.log(`Current turn: ${gameState.currentTurn}`);
      console.log(`Current player index: ${currentPlayerIndex}`);
      console.log(`Current player ID: ${currentPlayerId}`);

      // Recalculate playable tiles
      let playableTiles = playerHand.filter(
        (tile) =>
          gameLogicService.isValidMove(gameState, tile, 'left') ||
          gameLogicService.isValidMove(gameState, tile, 'right'),
      );

      if (playableTiles.length > 0) {
        // Play the first valid tile
        const tileToPlay = playableTiles[0];
        const side = gameLogicService.isValidMove(gameState, tileToPlay, 'left')
          ? 'left'
          : 'right';

        await playerActionService.playTile(
          gameState.roomId,
          currentPlayerId,
          tileToPlay,
          side,
        );

        // Update game state
        gameState = await gameStateManager.getGameState(gameState.roomId);
      } else {
        // Player needs to draw tiles one at a time until they can play or the draw pile is empty
        while (!playableTiles.length && gameState.drawPile.length > 0) {
          await playerActionService.drawTile(gameState.roomId, currentPlayerId);

          // Update game state after drawing
          gameState = await gameStateManager.getGameState(gameState.roomId);
          playerHand = gameState.hands[currentPlayerId];

          // Recalculate playable tiles after drawing
          playableTiles = playerHand.filter(
            (tile) =>
              gameLogicService.isValidMove(gameState, tile, 'left') ||
              gameLogicService.isValidMove(gameState, tile, 'right'),
          );
        }

        if (playableTiles.length > 0) {
          // Player can now play
          const tileToPlay = playableTiles[0];
          const side = gameLogicService.isValidMove(
            gameState,
            tileToPlay,
            'left',
          )
            ? 'left'
            : 'right';

          await playerActionService.playTile(
            gameState.roomId,
            currentPlayerId,
            tileToPlay,
            side,
          );

          // Update game state
          gameState = await gameStateManager.getGameState(gameState.roomId);
        } else {
          // Draw pile is empty, and the player cannot play; pass the turn
          await playerActionService.passTurn(gameState.roomId, currentPlayerId);

          // Update game state
          gameState = await gameStateManager.getGameState(gameState.roomId);
        }
      }

      // Check if the game is over
      const winner = gameLogicService.checkWinner(gameState);
      if (winner) {
        gameOver = true;
        expect(winner).toBeDefined();
        console.log(`Winning player: ${winner}`);
        break;
      }

      if (gameLogicService.isGameBlocked(gameState)) {
        gameOver = true;
        const winner = gameLogicService.determineWinnerByLowestTile(gameState);
        expect(winner).toBeDefined();
        console.log(`Game blocked. Player with lowest sum: ${winner}`);
        break;
      }

      // Update currentPlayerIndex and currentPlayerId
      currentPlayerIndex = gameState.turnIndex;
      currentPlayerId = gameState.players[currentPlayerIndex];
    }
  }, 300000);

  // it('should simulate a complete game with 4 players', async () => {
  //   const players = ['player1', 'player2', 'player3', 'player4'];
  //   const betAmount = 100;
  //
  //   // Create the game
  //   let gameState = await gameService.createGameRoom(players, betAmount);
  //
  //   // Verify the first player is correct
  //   const highestDoubleInfo = findHighestDouble(gameState);
  //   if (highestDoubleInfo.playerId) {
  //     expect(gameState.players[gameState.turnIndex]).toBe(
  //       highestDoubleInfo.playerId,
  //     );
  //   }
  //
  //   let gameOver = false;
  //
  //   while (!gameOver) {
  //     // Fetch the current game state at the start of the loop
  //     gameState = await gameStateManager.getGameState(gameState.roomId);
  //
  //     // Check if the game state is undefined
  //     if (!gameState) {
  //       console.log(
  //         'Game state is no longer available. The game may have ended.',
  //       );
  //       break;
  //     }
  //
  //     // Check if the game has finished
  //     if (gameState.isFinished) {
  //       gameOver = true;
  //       console.log(`Game has ended. Winner: ${gameState.winner}`);
  //       break;
  //     }
  //
  //     // Check if the game is over
  //     const winner = gameLogicService.checkWinner(gameState);
  //     if (winner) {
  //       gameOver = true;
  //       expect(winner).toBeDefined();
  //       console.log(`Winning player: ${winner}`);
  //       break;
  //     }
  //
  //     if (gameLogicService.isGameBlocked(gameState)) {
  //       gameOver = true;
  //       const winner = gameLogicService.determineWinnerByLowestTile(gameState);
  //       expect(winner).toBeDefined();
  //       console.log(`Game blocked. Player with lowest sum: ${winner}`);
  //       break;
  //     }
  //
  //     let currentPlayerIndex = gameState.turnIndex;
  //     let currentPlayerId = gameState.players[currentPlayerIndex];
  //     const playerHand = gameState.hands[currentPlayerId];
  //
  //     console.log(`Current turn: ${gameState.currentTurn}`);
  //     console.log(`Current player index: ${currentPlayerIndex}`);
  //     console.log(`Current player ID: ${currentPlayerId}`);
  //
  //     // Recalculate playable tiles
  //     const playableTiles = playerHand.filter(
  //       (tile) =>
  //         gameLogicService.isValidMove(gameState, tile, 'left') ||
  //         gameLogicService.isValidMove(gameState, tile, 'right'),
  //     );
  //
  //     if (playableTiles.length > 0) {
  //       // Play the first valid tile
  //       const tileToPlay = playableTiles[0];
  //       const side = gameLogicService.isValidMove(gameState, tileToPlay, 'left')
  //         ? 'left'
  //         : 'right';
  //
  //       await playerActionService.playTile(
  //         gameState.roomId,
  //         currentPlayerId,
  //         tileToPlay,
  //         side,
  //       );
  //
  //       // Update game state
  //       gameState = await gameStateManager.getGameState(gameState.roomId);
  //     } else {
  //       // In a 4-player game, players cannot draw tiles; they must pass the turn
  //       await playerActionService.passTurn(gameState.roomId, currentPlayerId);
  //
  //       // Update game state
  //       gameState = await gameStateManager.getGameState(gameState.roomId);
  //
  //       // Check if the game has finished after passing the turn
  //       if (gameState.isFinished) {
  //         gameOver = true;
  //         console.log(
  //           `Game has ended after passing turn. Winner: ${gameState.winner}`,
  //         );
  //         break;
  //       }
  //     }
  //
  //     // Update currentPlayerIndex and currentPlayerId
  //     currentPlayerIndex = gameState.turnIndex;
  //     currentPlayerId = gameState.players[currentPlayerIndex];
  //   }
  // }, 300000);

  // Função auxiliar para encontrar a maior dupla
  function findHighestDouble(gameState: GameState): {
    playerId: string;
    pip: number;
  } {
    let highestDoublePip = -1;
    let playerWithHighestDouble: string | null = null;

    for (let pip = 6; pip >= 0; pip--) {
      for (const playerId of gameState.players) {
        if (
          gameState.hands[playerId].some(
            (tile) => tile.left === pip && tile.right === pip,
          )
        ) {
          highestDoublePip = pip;
          playerWithHighestDouble = playerId;
          return { playerId: playerWithHighestDouble, pip: highestDoublePip };
        }
      }
    }

    return { playerId: null, pip: -1 };
  }

  // it('should simulate a complete game with 4 players', async () => {
  //   const players = ['player1', 'player2', 'player3', 'player4'];
  //   const betAmount = 100;
  //
  //   // Create the game
  //   let gameState = await gameService.createGameRoom(players, betAmount);
  //
  //   const highestDoubleInfo = findHighestDouble(gameState);
  //   if (highestDoubleInfo.playerId) {
  //     expect(gameState.players[gameState.turnIndex]).toBe(
  //       highestDoubleInfo.playerId,
  //     );
  //   }
  //
  //   let gameOver = false;
  //
  //   while (!gameOver) {
  //     // Fetch the current game state at the start of the loop
  //     gameState = await gameStateManager.getGameState(gameState.roomId);
  //     if (!gameState) {
  //       throw new Error(`Game state not found for roomId ${gameState.roomId}`);
  //     }
  //
  //     let currentPlayerIndex = gameState.turnIndex;
  //     let currentPlayerId = gameState.players[currentPlayerIndex];
  //     let playerHand = gameState.hands[currentPlayerId];
  //
  //     console.log(`Current turn: ${gameState.currentTurn}`);
  //     console.log(`Current player index: ${currentPlayerIndex}`);
  //     console.log(`Current player ID: ${currentPlayerId}`);
  //
  //     // Recalculate playable tiles
  //     let playableTiles = playerHand.filter(
  //       (tile) =>
  //         gameLogicService.isValidMove(gameState, tile, 'left') ||
  //         gameLogicService.isValidMove(gameState, tile, 'right'),
  //     );
  //
  //     if (playableTiles.length > 0) {
  //       // Play the first valid tile
  //       const tileToPlay = playableTiles[0];
  //       const side = gameLogicService.isValidMove(gameState, tileToPlay, 'left')
  //         ? 'left'
  //         : 'right';
  //
  //       await playerActionService.playTile(
  //         gameState.roomId,
  //         currentPlayerId,
  //         tileToPlay,
  //         side,
  //       );
  //
  //       // Update game state
  //       gameState = await gameStateManager.getGameState(gameState.roomId);
  //     } else if (gameState.drawPile.length > 0) {
  //       // The player needs to draw tiles until they can play or the draw pile is empty
  //       await playerActionService.drawTile(gameState.roomId, currentPlayerId);
  //
  //       // Update game state
  //       gameState = await gameStateManager.getGameState(gameState.roomId);
  //
  //       // Re-fetch player's hand
  //       playerHand = gameState.hands[currentPlayerId];
  //
  //       // Recalculate playable tiles after drawing
  //       playableTiles = playerHand.filter(
  //         (tile) =>
  //           gameLogicService.isValidMove(gameState, tile, 'left') ||
  //           gameLogicService.isValidMove(gameState, tile, 'right'),
  //       );
  //
  //       if (playableTiles.length > 0) {
  //         // The player can now play
  //         const tileToPlay = playableTiles[0];
  //         const side = gameLogicService.isValidMove(
  //           gameState,
  //           tileToPlay,
  //           'left',
  //         )
  //           ? 'left'
  //           : 'right';
  //
  //         await playerActionService.playTile(
  //           gameState.roomId,
  //           currentPlayerId,
  //           tileToPlay,
  //           side,
  //         );
  //
  //         // Update game state
  //         gameState = await gameStateManager.getGameState(gameState.roomId);
  //       } else {
  //         // The player has drawn all tiles and cannot play, turn has been passed
  //         // No need to call passTurn here
  //       }
  //     } else {
  //       // Draw pile is empty, and the player cannot play; pass the turn
  //       await playerActionService.passTurn(gameState.roomId, currentPlayerId);
  //
  //       // Update game state
  //       gameState = await gameStateManager.getGameState(gameState.roomId);
  //     }
  //
  //     // Update currentPlayerIndex and currentPlayerId
  //     currentPlayerIndex = gameState.turnIndex;
  //     currentPlayerId = gameState.players[currentPlayerIndex];
  //
  //     // Check if the game is over
  //     const winner = gameLogicService.checkWinner(gameState);
  //     if (winner) {
  //       gameOver = true;
  //       expect(winner).toBeDefined();
  //       console.log(`Winning player: ${winner}`);
  //       break;
  //     }
  //
  //     if (gameLogicService.isGameBlocked(gameState)) {
  //       gameOver = true;
  //       const winner = gameLogicService.determineWinnerByLowestTile(gameState);
  //       expect(winner).toBeDefined();
  //       console.log(`Game blocked. Player with lowest sum: ${winner}`);
  //       break;
  //     }
  //   }
  // }, 60000);
});
