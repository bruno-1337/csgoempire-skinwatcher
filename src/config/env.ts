import { config } from 'dotenv';

config();

export const ENV = {
  API_KEY: process.env.API_KEY || '',
  DISCORD_WEBHOOK: process.env.DISCORD_WEBHOOK || '',
};

if (!ENV.API_KEY || !ENV.DISCORD_WEBHOOK) {
  throw new Error('Missing required environment variables');
}
