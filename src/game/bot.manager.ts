import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { BotPlayer, BotDifficulty } from '@src/game/bot-player';
import { GameState } from '@src/game/interfaces/game-state.interface';
import { PlayerActionService } from '@src/game/player.action.service';
import { RedisClientType } from 'redis';
import { GameLogicService } from '@src/game/game.logic.service';
import { GameStateManager } from 'src/game/game.state.manager';

@Injectable()
export class BotManager {
  constructor(
    @Inject(forwardRef(() => PlayerActionService))
    private readonly playerActionService: PlayerActionService,
    @Inject('REDIS_CLIENT') private redisClient: RedisClientType<any, any>,
    private readonly gameLogicService: GameLogicService,
    private readonly gameStateManager: GameStateManager,
  ) {}

  async addBot(botId: string, difficulty: BotDifficulty) {
    const bot = new BotPlayer(botId, difficulty);
    await this.setBot(botId, bot);
  }

  async removeBot(botId: string) {
    await this.deleteBot(botId);
  }

  async isBot(playerId: string): Promise<boolean> {
    const bot = await this.getBot(playerId);
    return bot !== null;
  }

  async playBotTurn(gameState: GameState, botId: string) {
    const bot = await this.getBot(botId);
    if (!bot) return;

    // Simulate thinking delay
    await this.simulateThinking();

    const playerHand = gameState.hands[botId];

    // Recalculate playable tiles
    let playableTiles = playerHand.filter(
      (tile) =>
        this.gameLogicService.isValidMove(gameState, tile, 'left') ||
        this.gameLogicService.isValidMove(gameState, tile, 'right'),
    );

    if (playableTiles.length > 0) {
      // Play the first valid tile
      const tileToPlay = playableTiles[0];
      const side = this.gameLogicService.isValidMove(
        gameState,
        tileToPlay,
        'left',
      )
        ? 'left'
        : 'right';

      await this.playerActionService.playTile(
        gameState.roomId,
        botId,
        tileToPlay,
        side,
      );
    } else {
      // Player needs to draw tiles one at a time until they can play or the draw pile is empty
      while (!playableTiles.length && gameState.drawPile.length > 0) {
        await this.playerActionService.drawTile(gameState.roomId, botId);

        // Update game state after drawing
        gameState = await this.gameStateManager.getGameState(gameState.roomId);
        playableTiles = gameState.hands[botId].filter(
          (tile) =>
            this.gameLogicService.isValidMove(gameState, tile, 'left') ||
            this.gameLogicService.isValidMove(gameState, tile, 'right'),
        );
      }

      if (playableTiles.length > 0) {
        // Player can now play
        const tileToPlay = playableTiles[0];
        const side = this.gameLogicService.isValidMove(
          gameState,
          tileToPlay,
          'left',
        )
          ? 'left'
          : 'right';

        await this.playerActionService.playTile(
          gameState.roomId,
          botId,
          tileToPlay,
          side,
        );
      } else {
        // Draw pile is empty, and the bot cannot play; pass the turn
        await this.playerActionService.passTurn(gameState.roomId, botId);
      }
    }
  }

  private async simulateThinking() {
    const delay = Math.floor(Math.random() * 500) + 1000;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  // Redis operations for bot storage
  private async setBot(botId: string, bot: BotPlayer): Promise<void> {
    const key = `bot:${botId}`;
    const serializedBot = JSON.stringify({
      botId: bot.botId,
      difficulty: bot.difficulty,
    });
    await this.redisClient.set(key, serializedBot);
  }

  private async getBot(botId: string): Promise<BotPlayer | null> {
    const key = `bot:${botId}`;
    const serializedBot = await this.redisClient.get(key);
    if (serializedBot) {
      const { botId: id, difficulty } = JSON.parse(serializedBot);
      return new BotPlayer(id, difficulty as BotDifficulty);
    }
    return null;
  }

  private async deleteBot(botId: string): Promise<void> {
    const key = `bot:${botId}`;
    await this.redisClient.del(key);
  }
}
