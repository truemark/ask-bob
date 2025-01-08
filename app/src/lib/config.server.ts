import * as logging from '@nr1e/logging';
import {DataSettings} from './data-settings';

export type Env = 'dev' | 'stage' | 'prod';

export interface Config {
  readonly log: logging.Logger;
  readonly agentId: string;
  readonly agentAliasId: string;
  readonly appSyncEndpoint: string;
  readonly appSyncRealtimeEndpoint: string;
  readonly dataSettings: DataSettings;
}

const config = null as Config | null;

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

export default function getConfig(): Config {
  if (config) return config;

  // Initialize logging
  const level = getEnv('LOG_LEVEL');
  if (!logging.isLevel(level)) {
    throw new Error(`Invalid log level: ${level}`);
  }
  const log = logging.initialize({
    level,
    svc: 'app',
  });
  log.info().str('logLevel', level).msg('Initializing config');

  return {
    log,
    agentId: getEnv('AGENT_ID'),
    agentAliasId: getEnv('AGENT_ALIAS_ID'),
    appSyncEndpoint: getEnv('APP_SYNC_ENDPOINT'),
    appSyncRealtimeEndpoint: getEnv('APP_SYNC_REALTIME_ENDPOINT'),
    dataSettings: new DataSettings(),
  }
}
