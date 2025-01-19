import { ENV } from '../config/env';
import chalk from 'chalk';
import { debug } from '../utils/debug';

export class BaseService {
  private readonly BASE_URL = 'https://csgoempire.com/api/v2';

  protected async get<T>(endpoint: string, params: Record<string, string | undefined> = {}) {
    const url = new URL(`${this.BASE_URL}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, value);
      }
    });

    console.log(chalk.cyan(`🌐 Making request to: ${this.BASE_URL}${endpoint}`));

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${ENV.API_KEY}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }
} 