// src/matchmaking/matchmaking.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MatchmakingService } from '@src/matchmaking/matchmaking.service';
import { MatchmakingProcessor } from '@src/matchmaking/matchmaking.processor';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GatewayModule } from '@src/gateway/gateway.module';
import { GameModule } from '@src/game/game.module';
import { SharedModule } from '@src/shared/shared.module';

@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: 'matchmaking',
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST_QUEUE'),
          port: configService.get('REDIS_PORT_QUEUE'),
          password: configService.get('REDIS_PASSWORD_QUEUE'),
          username: configService.get('REDIS_USERNAME_QUEUE'),
        },
      }),
      inject: [ConfigService],
    }),
    forwardRef(() => GatewayModule),
    SharedModule,
    GameModule,
  ],
  providers: [MatchmakingService, MatchmakingProcessor],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}
