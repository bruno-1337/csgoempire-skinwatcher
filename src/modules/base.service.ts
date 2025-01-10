import { ENV } from '../config/env';
import chalk from 'chalk';
import { debug } from '../utils/debug';

export class BaseService {
  private readonly API_URL = 'https://csgoempire.com/api/v2';

  protected async get<T>(endpoint: string, params: Record<string, string | undefined>) {
    try {
      const queryString = Object.entries(params)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => `${key}=${encodeURIComponent(value as string)}`)
        .join('&');

      const url = `${this.API_URL}${endpoint}?${queryString}`;
      debug.request('GET', url, params);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${ENV.API_KEY}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText}\nURL: ${url}\nResponse: ${errorText}`);
      }

      const data = await response.json() as T;
      debug.response(data);
      return data;
    } catch (error: any) {
      console.error(chalk.red('Request failed:'));
      debug.log('Error:', error.message);
      throw error;
    }
  }
} 