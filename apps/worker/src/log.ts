export type Logger = {
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
};

const emit = (level: string, msg: string, data?: Record<string, unknown>) =>
  console.log(JSON.stringify({ t: new Date().toISOString(), level, msg, ...data }));

export const logger: Logger = {
  info: (m, d) => emit('info', m, d),
  warn: (m, d) => emit('warn', m, d),
  error: (m, d) => emit('error', m, d),
};

export const silentLogger: Logger = { info() {}, warn() {}, error() {} };
