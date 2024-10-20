import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { BotManager } from '@src/game/bot.manager';
import { AppLogger } from '@src/shared/logger/logger.service';
import { Tile } from '@src/game/interfaces/tile.interface';
import { GameError } from '@src/game/errors/game-error';
import { GameState } from '@src/game/interfaces/game-state.interface';
import { GameService } from '@src/game/game.service';
import { GameStateManager } from '@src/game/game.state.manager';
import { GameLogicService } from '@src/game/game.logic.service';
import { NotificationService } from '@src/game/notifications/notification.service';

@Injectable()
export class PlayerActionService {
  constructor(
    private readonly gameStateManager: GameStateManager,
    private readonly gameLogicService: GameLogicService,
    private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => BotManager))
    private readonly botManager: BotManager,
    private readonly logger: AppLogger,
    @Inject(forwardRef(() => GameService))
    private readonly gameService: GameService,
  ) {
    this.logger.setContext(PlayerActionService.name);
  }

  async playTile(
    roomId: string,
    playerId: string,
    tile: Tile,
    side: 'left' | 'right',
  ) {
    const lockAcquired = await this.gameStateManager.acquireLock(roomId);
    if (!lockAcquired) {
      throw new GameError('LOCK_NOT_ACQUIRED', 'Could not acquire lock');
    }
    try {
      const gameState = await this.gameStateManager.getGameState(roomId);

      if (gameState.players[gameState.turnIndex] !== playerId) {
        throw new GameError('NOT_YOUR_TURN', 'It is not your turn');
      }

      if (!this.gameLogicService.playerHasTile(gameState, playerId, tile)) {
        throw new GameError('TILE_NOT_IN_HAND', 'You do not have this tile');
      }

      if (!this.gameLogicService.isValidMove(gameState, tile, side)) {
        throw new GameError('INVALID_MOVE', 'This tile cannot be played here');
      }

      // Execute the move
      this.executeTilePlay(gameState, playerId, tile, side);

      // Check for winner
      const winner = this.gameLogicService.checkWinner(gameState);
      if (winner) {
        this.logger.debug(
          ` Player ${winner} has won the game in room ${roomId}`,
        );
        await this.gameService.endGame(roomId, winner, 'normal');
        return;
      }

      // Proceed to next turn
      await this.nextTurn(gameState);

      // Save the updated game state
      const lastGameState = await this.gameStateManager.setGameState(
        roomId,
        gameState,
      );

      // Notify players
      this.notificationService.notifyPlayersOfMove(
        lastGameState,
        playerId,
        tile,
        side,
      );
      this.notificationService.notifyPlayersOfGameUpdate(lastGameState);

      // Check if next player is a bot
      const nextPlayerId = lastGameState.players[lastGameState.turnIndex];
      if (await this.botManager.isBot(nextPlayerId)) {
        await this.botManager.playBotTurn(lastGameState, nextPlayerId);
      }
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw error;
    } finally {
      await this.gameStateManager.releaseLock(roomId);
    }
  }

  // async drawTile(roomId: string, playerId: string) {
  //   const lockAcquired = await this.gameStateManager.acquireLock(roomId);
  //   if (!lockAcquired) {
  //     throw new GameError('LOCK_NOT_ACQUIRED', 'Could not acquire lock');
  //   }
  //   try {
  //     const gameState = await this.gameStateManager.getGameState(roomId);
  //
  //     if (gameState.players[gameState.turnIndex] !== playerId) {
  //       throw new GameError('NOT_YOUR_TURN', 'It is not your turn');
  //     }
  //
  //     if (gameState.players.length === 4) {
  //       throw new GameError(
  //         'CANNOT_DRAW_TILES_IN_A_4_PLAYER_GAME',
  //         'Cannot draw tiles in a 4-player game',
  //       );
  //     }
  //
  //     // Loop to draw tiles until the player can play or draw pile is empty
  //     while (
  //       !this.gameLogicService.canPlayTile(gameState, playerId) &&
  //       gameState.drawPile.length > 0
  //     ) {
  //       const drawnTile = gameState.drawPile.pop()!;
  //       gameState.hands[playerId].push(drawnTile);
  //
  //       gameState.lastAction = { playerId, action: 'draw' };
  //
  //       // Notify the player about the drawn tile
  //       this.notificationService.notifyPlayerTileDrawn(playerId, drawnTile);
  //
  //       // Log the drawn tile and updated hand
  //       this.logger.debug(
  //         `Player ${playerId} drew tile [${drawnTile.left}:${drawnTile.right}]`,
  //       );
  //       this.logger.debug(
  //         `Player ${playerId}'s hand after drawing: ${JSON.stringify(
  //           gameState.hands[playerId],
  //         )}`,
  //       );
  //       this.logger.debug(
  //         `Draw pile size after drawing: ${gameState.drawPile.length}`,
  //       );
  //     }
  //
  //     // After drawing, check if the player can now play
  //     if (this.gameLogicService.canPlayTile(gameState, playerId)) {
  //       // The player can play; save the game state
  //       await this.gameStateManager.setGameState(roomId, gameState);
  //
  //       // Notify other players about the draw action
  //       this.notificationService.notifyPlayersOfDraw(gameState, playerId);
  //
  //       // Optionally, you can auto-play or prompt the player to play
  //       // For bots, you might want to auto-play
  //       if (await this.botManager.isBot(playerId)) {
  //         await this.botManager.playBotTurn(gameState, playerId);
  //       } else {
  //         // For human players, wait for them to play
  //       }
  //     } else {
  //       // The player still cannot play; pass the turn
  //       await this.passTurn(roomId, playerId, false, gameState);
  //     }
  //   } catch (error) {
  //     this.logger.error(error.message, error.stack);
  //     throw error;
  //   } finally {
  //     await this.gameStateManager.releaseLock(roomId);
  //   }
  // }

  async drawTile(roomId: string, playerId: string) {
    const lockAcquired = await this.gameStateManager.acquireLock(roomId);
    if (!lockAcquired) {
      throw new GameError('LOCK_NOT_ACQUIRED', 'Could not acquire lock');
    }
    try {
      const gameState = await this.gameStateManager.getGameState(roomId);

      if (gameState.players[gameState.turnIndex] !== playerId) {
        throw new GameError('NOT_YOUR_TURN', 'It is not your turn');
      }

      if (gameState.players.length === 4) {
        throw new GameError(
          'CANNOT_DRAW_TILES_IN_A_4_PLAYER_GAME',
          'Cannot draw tiles in a 4-player game',
        );
      }

      // Verifica se o jogador pode jogar, caso contrário, ele precisa comprar uma pedra
      if (!this.gameLogicService.canPlayTile(gameState, playerId)) {
        if (gameState.drawPile.length > 0) {
          // Compra uma pedra do monte
          const drawnTile = gameState.drawPile.pop()!;
          gameState.hands[playerId].push(drawnTile);

          gameState.lastAction = { playerId, action: 'draw' };

          // Notifica o jogador sobre a pedra comprada
          this.notificationService.notifyPlayerTileDrawn(playerId, drawnTile);

          // Log da pedra comprada e da mão atualizada
          this.logger.debug(
            `Player ${playerId} drew tile [${drawnTile.left}:${drawnTile.right}]`,
          );
          this.logger.debug(
            `Player ${playerId}'s hand after drawing: ${JSON.stringify(
              gameState.hands[playerId],
            )}`,
          );
          this.logger.debug(
            `Draw pile size after drawing: ${gameState.drawPile.length}`,
          );

          // Salvar o estado do jogo
          await this.gameStateManager.setGameState(roomId, gameState);

          // Se o jogador ainda não puder jogar, ele terá que solicitar uma nova compra
          if (!this.gameLogicService.canPlayTile(gameState, playerId)) {
            // Notifica que o jogador precisa comprar novamente ou passar a vez
            this.notificationService.notifyPlayersOfDraw(gameState, playerId);
          }
        } else {
          // Não há mais pedras para comprar, passar a vez
          await this.passTurn(roomId, playerId, false, gameState);
        }
      } else {
        // Jogador pode jogar; prossegue normalmente
        // Salvar o estado do jogo
        await this.gameStateManager.setGameState(roomId, gameState);

        // Notificar outros jogadores sobre a ação de compra
        this.notificationService.notifyPlayersOfDraw(gameState, playerId);

        // Para bots, você pode querer jogar automaticamente
        if (await this.botManager.isBot(playerId)) {
          await this.botManager.playBotTurn(gameState, playerId);
        } else {
          // Para jogadores humanos, aguarde eles jogarem
        }
      }
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw error;
    } finally {
      await this.gameStateManager.releaseLock(roomId);
    }
  }

  async passTurn(
    roomId: string,
    playerId: string,
    acquireLock: boolean = true,
    gameState?: GameState,
  ) {
    if (acquireLock) {
      const lockAcquired = await this.gameStateManager.acquireLock(roomId);
      if (!lockAcquired) {
        throw new GameError('LOCK_NOT_ACQUIRED', 'Could not acquire lock');
      }
    }
    try {
      if (!gameState) {
        gameState = await this.gameStateManager.getGameState(roomId);
      }

      if (gameState.players[gameState.turnIndex] !== playerId) {
        throw new GameError('NOT_YOUR_TURN', 'It is not your turn');
      }

      if (this.gameLogicService.canPlayTile(gameState, playerId)) {
        throw new GameError(
          'MUST_PLAY_TILE',
          'You have a playable tile and must play it',
        );
      }

      gameState.lastAction = { playerId, action: 'pass' };

      // Check if game is blocked
      if (this.gameLogicService.isGameBlocked(gameState)) {
        const winner =
          this.gameLogicService.determineWinnerByLowestTile(gameState);
        await this.gameService.endGame(gameState.roomId, winner, 'blocked');
        return;
      }

      // Proceed to next turn
      await this.nextTurn(gameState);

      // Notify players
      this.notificationService.notifyPlayersOfPass(gameState, playerId);

      // Save the updated game state
      const lastGameState = await this.gameStateManager.setGameState(
        roomId,
        gameState,
      );

      this.notificationService.notifyPlayersOfGameUpdate(lastGameState);

      // If the next player is a bot, have them play
      const nextPlayerId = lastGameState.players[gameState.turnIndex];
      if (await this.botManager.isBot(nextPlayerId)) {
        await this.botManager.playBotTurn(gameState, nextPlayerId);
      }
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw error;
    } finally {
      if (acquireLock) {
        await this.gameStateManager.releaseLock(roomId);
      }
    }
  }

  async nextTurn(gameState: GameState) {
    gameState.turnIndex = (gameState.turnIndex + 1) % gameState.players.length;
    gameState.currentTurn = gameState.players[gameState.turnIndex];
    this.logger.debug(`Next turn: ${gameState.players[gameState.turnIndex]}`);
  }

  private executeTilePlay(
    gameState: GameState,
    playerId: string,
    tile: Tile,
    side: 'left' | 'right' | null | undefined,
  ) {
    // Remove a pedra da mão do jogador
    gameState.hands[playerId] = gameState.hands[playerId].filter(
      (t) => !(t.left === tile.left && t.right === tile.right),
    );

    this.logger.debug(
      `Tile removed from hand Player(${playerId}) | Side(${side}) | Left(${tile.left}) | Right(${tile.right}) | ${JSON.stringify(gameState.hands[playerId])} `,
    );

    tile.timestamp = Date.now();
    tile.username = playerId;

    // Se a jogada é no lado esquerdo
    if (side === 'left') {
      // Verifica se a peça precisa ser invertida para se conectar corretamente
      if (tile.right !== gameState.boardEnds.left) {
        // Inverte a peça
        const temp = tile.left;
        tile.left = tile.right;
        tile.right = temp;
      }

      // Adiciona a peça ao lado esquerdo do tabuleiro
      gameState.board.unshift(tile);
      // Atualiza a extremidade esquerda do tabuleiro
      gameState.boardEnds.left = tile.left;

      this.logger.debug(
        `Game Board Ends | Side(${side}) | Left(${gameState.boardEnds.left}) | Right(${gameState.boardEnds.right})`,
      );
    } else {
      // Se a jogada é no lado direito
      if (tile.left !== gameState.boardEnds.right) {
        // Inverte a peça para garantir que ela se conecte corretamente
        const temp = tile.left;
        tile.left = tile.right;
        tile.right = temp;
        tile.side = side;
      }

      // Adiciona a peça ao lado direito do tabuleiro
      gameState.board.push(tile);
      // Atualiza a extremidade direita do tabuleiro
      gameState.boardEnds.right = tile.right;
      this.logger.debug(
        `Game Board Ends | Side(${side}) | Left(${gameState.boardEnds.left}) | Right(${gameState.boardEnds.right})`,
      );
    }

    // Tratamento para peças duplas
    if (tile.left === tile.right) {
      // Se for uma peça dupla, o lado oposto deve ser igual ao lado jogado
      if (side === 'left') {
        gameState.boardEnds.left = tile.left; // Extremo esquerdo é atualizado
      } else {
        gameState.boardEnds.right = tile.right; // Extremo direito é atualizado
      }

      // Se o tabuleiro contém apenas a peça dupla, precisamos definir ambas as extremidades
      if (gameState.board.length === 1) {
        gameState.boardEnds.left = tile.left;
        gameState.boardEnds.right = tile.right;
        this.logger.debug(
          `Game Board has only one piece in game | Side(${side}) | Left(${gameState.boardEnds.left}) | Right(${gameState.boardEnds.right})`,
        );
      }

      this.logger.debug(
        `Game Board Ends duplicate pieces | Side(${side}) | Left(${gameState.boardEnds.left}) | Right(${gameState.boardEnds.right})`,
      );
    }

    // Armazena a última ação
    gameState.lastAction = { playerId, action: 'play' };
    gameState.moveHistory.push({ playerId, action: 'play', tile, side });
    gameState.isFirstPlay = false;
    // this.logger.debug(
    //   `Game Move History | ${JSON.stringify(gameState.moveHistory)}`,
    // );
  }
}
