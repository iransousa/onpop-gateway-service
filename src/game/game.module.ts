// game/game.module.ts

import { forwardRef, Module } from '@nestjs/common';
import { GameService } from '@src/game/game.service';
import { GatewayModule } from '@src/gateway/gateway.module';
import { SharedModule } from '@src/shared/shared.module';
import { BotManager } from '@src/game/bot.manager';
import { PlayerActionService } from '@src/game/player.action.service';
import { GameLogicService } from '@src/game/game.logic.service';
import { NotificationService } from '@src/game/notifications/notification.service';
import { TimerService } from '@src/game/time.service';
import { GameStateManager } from '@src/game/game.state.manager';

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
