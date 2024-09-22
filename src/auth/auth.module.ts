import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    ConfigModule,
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
  providers: [AuthService, JwtStrategy],
  exports: [JwtStrategy, AuthService],
})
export class AuthModule {}
