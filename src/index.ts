import { WatcherService } from './modules/watcher.service';
import type { WatcherConfig } from './types/config';
import chalk from 'chalk';
import { readFileSync, writeFileSync, existsSync } from 'fs';

// Find the config file path from arguments, excluding the --debug flag
const args = process.argv.slice(2);
const debugIndex = args.indexOf('--debug');
if (debugIndex !== -1) {
  args.splice(debugIndex, 1);
}
const configPath = args[0] || 'skinstowatch.json';

let watcherConfig: WatcherConfig;

try {
  if (!existsSync(configPath)) {
    console.log(chalk.yellow(`Config file not found at ${configPath}, creating default config...`));
    const DEFAULT_CONFIG: WatcherConfig = {
      interval: 10000,
      skins: [
        {
          name: "Karambit Crimson Web",
          search: "Karambit Crimson Web",
          minFloat: 0.15,
          maxFloat: 0.24,
          minPrice: 1500
        }
      ]
    };
    writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
    console.log(chalk.green('Default config file created!'));
    watcherConfig = DEFAULT_CONFIG;
  } else {
    const configFile = readFileSync(configPath, 'utf-8');
    watcherConfig = JSON.parse(configFile);
  }
} catch (error: any) {
  console.error(chalk.red(`Error handling config file: ${error.message}`));
  process.exit(1);
}

const watcher = new WatcherService(watcherConfig);

console.log(chalk.green(`
╔════════════════════════════════════════════
║ CSGOEmpire Watcher Started
║ Watching for ${watcherConfig.skins.length} different skins
║ Using WebSocket for real-time updates
║ Press Ctrl+C to stop
╚════════════════════════════════════════════
`));

watcher.start();