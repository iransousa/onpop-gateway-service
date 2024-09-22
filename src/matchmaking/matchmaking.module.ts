// src/matchmaking/matchmaking.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MatchmakingService } from './matchmaking.service';
import { MatchmakingProcessor } from './matchmaking.processor';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GatewayModule } from 'src/gateway/gateway.module';
import { GameModule } from 'src/game/game.module';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: 'matchmaking',
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST'),
          port: configService.get('REDIS_PORT'),
          password: configService.get('REDIS_PASSWORD'),
          username: configService.get('REDIS_USERNAME'),
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
