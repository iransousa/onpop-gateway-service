import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { BotManager } from './bot.manager';
import { AppLogger } from '../shared/logger/logger.service';
import { Tile } from './interfaces/tile.interface';
import { GameError } from './errors/game-error';
import { GameState } from './interfaces/game-state.interface';
import { GameService } from './game.service';
import { GameStateManager } from './game.state.manager';
import { GameLogicService } from './game.logic.service';
import { NotificationService } from './notifications/notification.service';

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
        await this.gameService.endGame(roomId, winner);
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

      if (gameState.drawPile.length === 0) {
        await this.passTurn(roomId, playerId);
        return;
      }

      const drawnTile = gameState.drawPile.pop()!;
      gameState.hands[playerId].push(drawnTile);

      gameState.lastAction = { playerId, action: 'draw' };

      // Notify the player about the drawn tile
      this.notificationService.notifyPlayerTileDrawn(playerId, drawnTile);

      // If the player can now play, they should play
      if (this.gameLogicService.canPlayTile(gameState, playerId)) {
        // The player can play; do not change the turn
        await this.gameStateManager.setGameState(roomId, gameState);
      } else {
        // The player still cannot play; pass the turn
        await this.passTurn(roomId, playerId);
      }

      // Notify other players about the draw action
      this.notificationService.notifyPlayersOfDraw(gameState, playerId);
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw error;
    } finally {
      await this.gameStateManager.releaseLock(roomId);
    }
  }

  async passTurn(roomId: string, playerId: string) {
    const lockAcquired = await this.gameStateManager.acquireLock(roomId);
    if (!lockAcquired) {
      throw new GameError('LOCK_NOT_ACQUIRED', 'Could not acquire lock');
    }
    try {
      const gameState = await this.gameStateManager.getGameState(roomId);

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
        await this.gameService.endGame(gameState.roomId, winner);
        return;
      }

      // Proceed to next turn
      await this.nextTurn(gameState);

      // Notify players
      this.notificationService.notifyPlayersOfPass(gameState, playerId);

      // Save the updated game state
      await this.gameStateManager.setGameState(roomId, gameState);

      // If the next player is a bot, have them play
      const nextPlayerId = gameState.players[gameState.turnIndex];
      if (await this.botManager.isBot(nextPlayerId)) {
        await this.botManager.playBotTurn(gameState, nextPlayerId);
      }
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw error;
    } finally {
      await this.gameStateManager.releaseLock(roomId);
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
      }
    }

    // Armazena a última ação
    gameState.lastAction = { playerId, action: 'play' };
    gameState.moveHistory.push({ playerId, action: 'play', tile, side });
    gameState.isFirstPlay = false;
  }
}
