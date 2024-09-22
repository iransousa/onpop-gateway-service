import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { GameState } from '../interfaces/game-state.interface';
import { Tile } from '../interfaces/tile.interface';
import { GatewayService } from '../../gateway/gateway.service';
import { AppLogger } from '../../shared/logger/logger.service';

@Injectable()
export class NotificationService {
  constructor(
    @Inject(forwardRef(() => GatewayService))
    private readonly gatewayService: GatewayService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(NotificationService.name);
  }

  notifyPlayersOfGameStart(gameState: GameState) {
    gameState.players.forEach((playerId, index) => {
      const message = {
        roomId: gameState.roomId,
        players: gameState.players,
        hands: gameState.hands[playerId],
        board: gameState.board,
        yourPosition: index,
        totalPlayers: gameState.players.length,
        firstPlayer: gameState.players[gameState.turnIndex],
        currentTurn: gameState.players[gameState.turnIndex],
        youAreFirstPlayer: index === gameState.turnIndex,
        drawPileCount: gameState.drawPile.length,
      };

      this.gatewayService.notifyPlayer(playerId, 'match_found', message);
    });
  }

  notifyPlayersOfMove(
    gameState: GameState,
    playerId: string,
    tile: Tile,
    side: 'left' | 'right',
  ) {
    gameState.players.forEach((player) => {
      const message = {
        roomId: gameState.roomId,
        playerWhoMoved: playerId,
        tilePlayed: tile,
        side: side,
        board: gameState.board,
        boardEnds: gameState.boardEnds,
        hands: gameState.hands[player],
        currentTurn: gameState.players[gameState.turnIndex],
      };

      this.gatewayService.notifyPlayer(player, 'tile_played', message);
    });
  }

  notifyPlayersOfGameUpdate(gameState: GameState) {
    gameState.players.forEach((playerId) => {
      const playerGameState = {
        roomId: gameState.roomId,
        players: gameState.players,
        board: gameState.board,
        currentTurn: gameState.players[gameState.turnIndex],
        boardEnds: gameState.boardEnds,
        hands: gameState.hands[playerId] || [],
      };

      this.gatewayService.notifyPlayer(
        playerId,
        'game_state_update',
        playerGameState,
      );
    });
  }

  notifyPlayersOfPass(gameState: GameState, playerId: string) {
    gameState.players.forEach((player) => {
      this.gatewayService.notifyPlayer(player, 'player_passed', {
        playerId,
        nextTurn: gameState.players[gameState.turnIndex],
        roomId: gameState.roomId,
        playerWhoMoved: playerId,
        board: gameState.board,
        boardEnds: gameState.boardEnds,
        hands: gameState.hands[player],
        currentTurn: gameState.players[gameState.turnIndex],
        players: gameState.players,
      });
    });
  }

  notifyPlayerTileDrawn(playerId: string, tile: Tile) {
    this.gatewayService.notifyPlayer(playerId, 'tile_drawn', {
      tile: tile,
    });
  }

  notifyPlayersOfDraw(gameState: GameState, playerId: string) {
    gameState.players.forEach((player) => {
      if (player !== playerId) {
        this.gatewayService.notifyPlayer(player, 'player_drew_tile', {
          playerId,
        });
      }
    });
  }

  notifyPlayersOfGameEnd(
    gameState: GameState,
    winner: string,
    scores: Record<string, number>,
  ) {
    gameState.players.forEach((playerId) => {
      this.gatewayService.notifyPlayer(playerId, 'game_over', {
        roomId: gameState.roomId,
        winner,
        scores,
        finalBoard: gameState.board,
        yourFinalHandScore: scores[playerId],
      });
    });
  }

  notifyPlayersOfDisconnect(gameState: GameState, playerId: string) {
    gameState.players.forEach((player) => {
      if (player !== playerId) {
        this.gatewayService.notifyPlayer(player, 'player_disconnected', {
          roomId: gameState.roomId,
          disconnectedPlayer: playerId,
          remainingPlayers: gameState.players,
        });
      }
    });
  }

  notifyPlayersOfReconnection(gameState: GameState, playerId: string) {
    gameState.players.forEach((player) => {
      if (player !== playerId) {
        this.gatewayService.notifyPlayer(player, 'player_reconnected', {
          playerId,
        });
      }
    });
  }

  sendGameStateToPlayer(gameState: GameState, playerId: string) {
    const playerGameState = {
      roomId: gameState.roomId,
      players: gameState.players,
      hands: gameState.hands[playerId] || [],
      board: gameState.board,
      moveHistory: gameState.moveHistory,
      currentTurn: gameState.players[gameState.turnIndex],
      boardEnds: gameState.boardEnds,
    };

    this.gatewayService.notifyPlayer(
      playerId,
      'game_state_update',
      playerGameState,
    );
  }

  /**
   * Notifies a player that their turn is about to expire.
   * @param playerId - The ID of the player to notify.
   * @param timeLeft - The amount of time left before the turn expires, in milliseconds.
   */
  notifyPlayerTurnWarning(playerId: string, timeLeft: number) {
    this.gatewayService.notifyPlayer(playerId, 'turn_warning', {
      timeLeft,
    });
    this.logger.debug(
      `Notified player ${playerId} of turn warning with ${timeLeft}ms left.`,
    );
  }
}
