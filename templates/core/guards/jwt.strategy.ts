import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Request } from "express";
import { envConfigService } from "../../config/env-config.service";

// TODO: CUSTOMIZE — Import your IJwtPayload from shared/interfaces
// import { IJwtPayload } from '@shared/interfaces';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // Cookie first — httpOnly cookies sent automatically
        JwtStrategy.extractJWTFromCookie,
        // Fallback to Bearer token (for API clients like Postman)
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: envConfigService.getAuthJWTConfig().AUTH_JWT_SECRET,
    });
  }

  private static extractJWTFromCookie(this: void, req: Request): string | null {
    const cookieName =
      envConfigService.getAuthJWTConfig().AUTH_TOKEN_COOKIE_NAME;
    if (req.cookies && req.cookies[cookieName]) {
      return req.cookies[cookieName];
    }
    return null;
  }

  // TODO: CUSTOMIZE — Adjust validation logic and return shape for your project
  validate(payload: any) {
    if (!payload.id && !payload.sub) {
      throw new UnauthorizedException("Invalid token payload");
    }

    return {
      id: payload.sub || payload.id,
      email: payload.email,
      role: payload.role,
    };
  }
}
