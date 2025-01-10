import { config } from 'dotenv';
import { existsSync } from 'fs';
import chalk from 'chalk';
import { debug } from '../utils/debug';

function loadEnvFile(): void {
  const envPaths = ['.env', 'config/.env'];
  const loadedPath = envPaths.find(path => existsSync(path));
  
  if (!loadedPath) {
    console.error(chalk.red('No .env file found in either root or config directory'));
    process.exit(1);
  }

  debug.log(`Loading environment from: ${loadedPath}`);
  config({ path: loadedPath });
}

function validateEnv<T extends Record<string, string>>(config: T): T {
  const missingVars = Object.entries(config)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    console.error(chalk.red('Missing required environment variables:'));
    missingVars.forEach(variable => {
      console.error(chalk.yellow(`- ${variable}`));
    });
    process.exit(1);
  }

  return config;
}

// Load environment variables
loadEnvFile();

// Export validated environment variables
export const ENV = validateEnv({
  API_KEY: process.env.API_KEY || '',
  DISCORD_WEBHOOK: process.env.DISCORD_WEBHOOK || '',
});
