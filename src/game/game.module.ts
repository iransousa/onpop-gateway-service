// game/game.module.ts

import { forwardRef, Module } from '@nestjs/common';
import { GameService } from './game.service';
import { GatewayModule } from '../gateway/gateway.module';
import { SharedModule } from '../shared/shared.module';
import { BotManager } from './bot.manager';
import { PlayerActionService } from './player.action.service';
import { GameLogicService } from './game.logic.service';
import { NotificationService } from './notifications/notification.service';
import { TimerService } from './time.service';
import { GameStateManager } from './game.state.manager';
import { AppLogger } from '../shared/logger/logger.service';

@Module({
  imports: [forwardRef(() => GatewayModule), SharedModule],
  providers: [
    GameService,
    PlayerActionService,
    GameLogicService,
    BotManager,
    NotificationService,
    TimerService,
    GameStateManager,
  ],
  exports: [
    GameService,
    GameStateManager,
    PlayerActionService,
    NotificationService,
  ],
})
export class GameModule {}
