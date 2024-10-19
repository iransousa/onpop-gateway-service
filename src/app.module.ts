import { Module } from '@nestjs/common';
import { AppController } from '@src/app.controller';
import { AppService } from '@src/app.service';
import { AuthModule } from '@src/auth/auth.module';
import { GatewayModule } from '@src/gateway/gateway.module';
import { MatchmakingModule } from '@src/matchmaking/matchmaking.module';
import { ConfigModule } from '@nestjs/config';
import { GameModule } from '@src/game/game.module';
import { SharedModule } from '@src/shared/shared.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AuthModule,
    GameModule,
    GatewayModule,
    MatchmakingModule,
    SharedModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
