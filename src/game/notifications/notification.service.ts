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

  getPlayers(gameState: GameState) {
    return gameState.players.map((player) => ({
      position: gameState.players.indexOf(player),
      qtdPdras: gameState.hands[player].length,
      name: player,
    }));
  }

  notifyPlayersOfGameStart(gameState: GameState) {
    const players = this.getPlayers(gameState);
    gameState.players.forEach((playerId, index) => {
      const message = {
        roomId: gameState.roomId,
        betAmount: gameState.betAmount,
        betTotal: gameState.betAmount * gameState.players.length,
        players,
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
    const players = this.getPlayers(gameState);
    gameState.players.forEach((player) => {
      const message = {
        roomId: gameState.roomId,
        playerWhoMoved: playerId,
        primeiraPedraDoBoard: gameState.board[0],
        drawPileCount: gameState.drawPile.length,
        players,
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
    const players = this.getPlayers(gameState);
    gameState.players.forEach((playerId) => {
      const playerGameState = {
        roomId: gameState.roomId,
        players,
        board: gameState.board,
        primeiraPedraDoBoard: gameState.board[0],
        currentTurn: gameState.players[gameState.turnIndex],
        boardEnds: gameState.boardEnds,
        drawPileCount: gameState.drawPile.length,
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
    const players = this.getPlayers(gameState);
    gameState.players.forEach((player) => {
      this.gatewayService.notifyPlayer(player, 'player_passed', {
        playerId,
        nextTurn: gameState.players[gameState.turnIndex],
        betAmount: gameState.betAmount,
        betTotal: gameState.betAmount * gameState.players.length,
        primeiraPedraDoBoard: gameState.board[0],
        roomId: gameState.roomId,
        playerWhoMoved: playerId,
        board: gameState.board,
        boardEnds: gameState.boardEnds,
        hands: gameState.hands[player],
        drawPileCount: gameState.drawPile.length,
        currentTurn: gameState.players[gameState.turnIndex],
        players,
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
    const players = this.getPlayers(gameState);
    gameState.players.forEach((playerId) => {
      this.gatewayService.notifyPlayer(playerId, 'game_over', {
        roomId: gameState.roomId,
        winner,
        scores,
        players,
        finalBoard: gameState.board,
        drawPileCount: gameState.drawPile.length,
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
    const players = this.getPlayers(gameState);
    const playerGameState = {
      roomId: gameState.roomId,
      players,
      hands: gameState.hands[playerId] || [],
      primeiraPedraDoBoard: gameState.board[0],
      board: gameState.board,
      currentTurn: gameState.players[gameState.turnIndex],
      boardEnds: gameState.boardEnds,
      betAmount: gameState.betAmount,
      drawPileCount: gameState.drawPile.length,
      betTotal: gameState.betAmount * gameState.players.length,
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
