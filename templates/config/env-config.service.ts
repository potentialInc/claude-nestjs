import dotenv from "dotenv";
dotenv.config();

class EnvConfigService {
  constructor(private env: { [k: string]: string | undefined }) {}

  getValue(key: string, throwOnMissing = true): string {
    const value = this.env[key];
    if (!value && throwOnMissing) {
      throw new Error(`config error - missing env.${key}`);
    }
    return value as string;
  }

  public ensureValues(keys: string[]) {
    keys.forEach((k) => this.getValue(k, true));
    return this;
  }

  public getPort(): string {
    return this.getValue("PORT", false) || "3000";
  }

  public isProduction(): boolean {
    const mode = this.getValue("MODE", false);
    return mode !== "DEV";
  }

  public getFrontendUrl(): string {
    return this.getValue("FRONTEND_URL", false) || "http://localhost:5173";
  }

  public getOrigins(): string[] {
    const devOrigins = [
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:5174",
    ];
    try {
      const envOrigins = this.getValue("ALLOW_ORIGINS")
        .split(",")
        .map((origin) => origin.trim());
      if (!this.isProduction()) {
        const merged = new Set([...envOrigins, ...devOrigins]);
        return Array.from(merged);
      }
      return envOrigins;
    } catch {
      return devOrigins;
    }
  }

  public getTypeOrmConfig() {
    return {
      host: this.getValue("POSTGRES_HOST"),
      port: parseInt(this.getValue("POSTGRES_PORT")),
      username: this.getValue("POSTGRES_USER"),
      password: this.getValue("POSTGRES_PASSWORD"),
      database: this.getValue("POSTGRES_DATABASE"),
      synchronize: !this.isProduction(),
    };
  }

  public getAuthJWTConfig() {
    const secret = this.getValue("AUTH_JWT_SECRET", false);
    if (!secret) {
      throw new Error("AUTH_JWT_SECRET is required — no fallback allowed");
    }
    return {
      AUTH_JWT_SECRET: secret,
      AUTH_TOKEN_COOKIE_NAME: this.getValue("AUTH_TOKEN_COOKIE_NAME"),
      AUTH_TOKEN_EXPIRE_TIME:
        this.getValue("AUTH_TOKEN_EXPIRE_TIME", false) || "86400",
      AUTH_TOKEN_EXPIRE_TIME_REMEMBER_ME:
        this.getValue("AUTH_TOKEN_EXPIRE_TIME_REMEMBER_ME", false) || "2592000",
      AUTH_REFRESH_TOKEN_COOKIE_NAME: this.getValue(
        "AUTH_REFRESH_TOKEN_COOKIE_NAME",
      ),
      AUTH_REFRESH_TOKEN_EXPIRE_TIME:
        this.getValue("AUTH_REFRESH_TOKEN_EXPIRE_TIME", false) || "2592000",
    };
  }

  // TODO: CUSTOMIZE — Add project-specific config methods below
  // Example: getMailConfig(), getAwsConfig(), etc.
}

const envConfigService = new EnvConfigService(process.env).ensureValues([
  // TODO: CUSTOMIZE — List required env vars for your project
  "POSTGRES_HOST",
  "POSTGRES_PORT",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "POSTGRES_DATABASE",
]);

export { envConfigService };
