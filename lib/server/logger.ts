import "server-only";

type LogLevel = "info" | "warn" | "error";
type LogData = Record<string, unknown>;

const sensitiveKey = /token|secret|password|authorization|signature|replytext/i;

const sanitize = (data: LogData): LogData =>
  Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      sensitiveKey.test(key) ? "[REDACTED]" : value,
    ]),
  );

export const log = (level: LogLevel, event: string, data: LogData = {}) => {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...sanitize(data),
  });

  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
};
