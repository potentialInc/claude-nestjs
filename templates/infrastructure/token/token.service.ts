import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { IJwtPayload } from '../../shared/interfaces';

@Injectable()
export class TokenService {
    constructor(
        private jwtService: JwtService,
        private configService: ConfigService,
    ) {}

    getAccessToken(payload: IJwtPayload, rememberMe?: boolean): string {
        const expiresIn = rememberMe
            ? this.configService.get<string>('authTokenExpiredTimeRememberMe')
            : this.configService.get<string>('authTokenExpiredTime');

        const expiresInNumber = Number(expiresIn);

        if (isNaN(expiresInNumber)) {
            throw new Error(
                `Invalid JWT expiry time: ${expiresIn}. Check AUTH_TOKEN_EXPIRE_TIME in your .env file.`,
            );
        }

        return this.jwtService.sign(payload, { expiresIn: expiresInNumber });
    }

    getRefreshToken(payload: IJwtPayload): string {
        const refreshExpiresIn = this.configService.get<string>(
            'authRefreshTokenExpiredTime',
        );
        const refreshExpiresInNumber = Number(refreshExpiresIn);

        if (isNaN(refreshExpiresInNumber)) {
            throw new Error(
                `Invalid JWT refresh expiry time: ${refreshExpiresIn}. Check AUTH_REFRESH_TOKEN_EXPIRE_TIME in your .env file.`,
            );
        }

        return this.jwtService.sign(payload, {
            expiresIn: refreshExpiresInNumber,
        });
    }

    verifyToken(token: string): boolean {
        try {
            this.jwtService.verify(token);
            return true;
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new UnauthorizedException('Token has expired');
            }
            throw new UnauthorizedException('Invalid token');
        }
    }

    decodeToken(token: string): any {
        return this.jwtService.decode(token);
    }
}
