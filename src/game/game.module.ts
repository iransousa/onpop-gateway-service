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
import { GameReportController } from './game-report/game-report.controller';
import { GameReportService } from '@src/game/game-report/service/game-report.service/game-report.service.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [forwardRef(() => GatewayModule), SharedModule, HttpModule],

  providers: [
    GameService,
    PlayerActionService,
    GameLogicService,
    BotManager,
    NotificationService,
    TimerService,
    GameStateManager,
    GameReportService,
  ],
  exports: [
    GameService,
    GameStateManager,
    PlayerActionService,
    NotificationService,
  ],
  controllers: [GameReportController],
})
export class GameModule {}
