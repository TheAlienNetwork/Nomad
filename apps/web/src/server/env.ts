function requiredInProduction(name: string): string | undefined {
  const value = process.env[name];
  if (process.env.NODE_ENV === "production" && !value) {
    throw new Error(`${name} is required in production.`);
  }
  return value;
}

export function authSecret(): string {
  return (
    requiredInProduction("AUTH_SECRET") ??
    "huntos-dev-only-secret-not-for-production"
  );
}

export function dataFilePath(): string {
  return (
    process.env.HUNTOS_DATA_FILE ??
    `${process.cwd()}/data/huntos-store.json`
  );
}

export function sessionTtlMs(): number {
  const days = Number(process.env.SESSION_DAYS ?? 30);
  return Math.max(1, days) * 24 * 60 * 60 * 1000;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
