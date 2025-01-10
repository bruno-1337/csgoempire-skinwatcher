import chalk from 'chalk';

class DebugLogger {
  private isDebugMode: boolean;

  constructor() {
    this.isDebugMode = process.argv.includes('--debug');
  }

  log(...args: any[]) {
    if (this.isDebugMode) {
      console.log(chalk.cyan('[DEBUG]'), ...args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
      ));
    }
  }

  object(label: string, obj: any) {
    if (this.isDebugMode) {
      console.log(chalk.cyan('[DEBUG]'), label + ':');
      console.log(chalk.cyan(JSON.stringify(obj, null, 2)));
    }
  }

  request(method: string, url: string, params?: any) {
    if (this.isDebugMode) {
      console.log(chalk.cyan('[DEBUG]'), `${method} Request to:`, url);
      if (params) {
        console.log(chalk.cyan('[DEBUG]'), 'Parameters:', JSON.stringify(params, null, 2));
      }
    }
  }

  response(data: any) {
    if (this.isDebugMode) {
      console.log(chalk.cyan('[DEBUG]'), 'Response:', JSON.stringify(data, null, 2));
    }
  }
}

export const debug = new DebugLogger(); 