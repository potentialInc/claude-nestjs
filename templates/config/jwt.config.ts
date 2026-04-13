import { envConfigService } from './env-config.service';

export default () => ({
    authJwtSecret: envConfigService.getAuthJWTConfig().AUTH_JWT_SECRET,

    authTokenCookieName:
        envConfigService.getAuthJWTConfig().AUTH_TOKEN_COOKIE_NAME,
    authTokenExpiredTime:
        envConfigService.getAuthJWTConfig().AUTH_TOKEN_EXPIRE_TIME,
    authTokenExpiredTimeRememberMe:
        envConfigService.getAuthJWTConfig().AUTH_TOKEN_EXPIRE_TIME_REMEMBER_ME,
    authRefreshTokenCookieName:
        envConfigService.getAuthJWTConfig().AUTH_REFRESH_TOKEN_COOKIE_NAME,
    authRefreshTokenExpiredTime:
        envConfigService.getAuthJWTConfig().AUTH_REFRESH_TOKEN_EXPIRE_TIME,
});
