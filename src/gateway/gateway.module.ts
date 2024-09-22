import { forwardRef, Module } from '@nestjs/common';
import { GatewayService } from './gateway.service';
import { GameModule } from 'src/game/game.module';
import { AuthModule } from 'src/auth/auth.module';
import { MatchmakingModule } from 'src/matchmaking/matchmaking.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    forwardRef(() => GameModule),
    forwardRef(() => MatchmakingModule),
    AuthModule,
    MatchmakingModule,
    SharedModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        privateKey: Buffer.from(
          configService.get<string>('JWT_PUBLIC_KEY_BASE64'),
          'base64',
        ).toString('utf8'),
        publicKey: Buffer.from(
          configService.get<string>('JWT_PRIVATE_KEY_BASE64'),
          'base64',
        ).toString('utf8'),

        signOptions: {
          algorithm: 'RS256',
          expiresIn: '60m',
        },
      }),
    }),
  ],
  providers: [GatewayService],
  exports: [GatewayService],
})
export class GatewayModule {}
