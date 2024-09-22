// game/bot.manager.ts

import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { BotPlayer, BotDifficulty } from './bot-player';
import { GameState } from './interfaces/game-state.interface';
import { PlayerActionService } from './player.action.service';
import { RedisClientType } from 'redis';

@Injectable()
export class BotManager {
  constructor(
    @Inject(forwardRef(() => PlayerActionService))
    private readonly playerActionService: PlayerActionService,
    @Inject('REDIS_CLIENT') private redisClient: RedisClientType<any, any>,
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

    const decision = bot.decideTurn(gameState);

    switch (decision.action) {
      case 'play':
        await this.playerActionService.playTile(
          gameState.roomId,
          botId,
          decision.tile!,
          decision.side!,
        );
        break;
      case 'draw':
        await this.playerActionService.drawTile(gameState.roomId, botId);
        break;
      case 'pass':
        await this.playerActionService.passTurn(gameState.roomId, botId);
        break;
    }
  }

  private async simulateThinking() {
    const delay = Math.floor(Math.random() * 2000) + 1000;
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
