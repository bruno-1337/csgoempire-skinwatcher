import { io, Socket } from 'socket.io-client';
import { ENV } from '../config/env';
import chalk from 'chalk';
import { debug } from '../utils/debug';
import type { CSGOItem } from '../types';

export class SocketService {
  private socket: Socket | null = null;
  private userData: any = null;
  private userDataRefreshedAt: number | null = null;
  private readonly domain = 'csgoempire.com';
  private readonly socketEndpoint = `wss://trade.${this.domain}/trade`;
  private itemCallback: (item: CSGOItem) => void;

  constructor(onNewItem: (item: CSGOItem) => void) {
    this.itemCallback = onNewItem;
  }

  private async refreshUserData(retryCount = 0, maxRetries = 3): Promise<void> {
    if (this.userDataRefreshedAt && this.userDataRefreshedAt > Date.now() - 15000) {
      return;
    }

    try {
      const response = await fetch(`https://${this.domain}/api/v2/metadata/socket`, {
        headers: {
          'Authorization': `Bearer ${ENV.API_KEY}`,
          'Content-Type': 'application/json',
        }
      });

      if (response.status === 429 && retryCount < maxRetries) {
        const retryAfter = response.headers.get('Retry-After') || '5';
        const waitTime = parseInt(retryAfter, 10) * 1000;
        console.log(chalk.yellow(`Rate limited, waiting ${waitTime/1000}s before retry ${retryCount + 1}/${maxRetries}`));
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.refreshUserData(retryCount + 1, maxRetries);
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      this.userData = await response.json();
      this.userDataRefreshedAt = Date.now();
      debug.log('User data refreshed successfully');
    } catch (error) {
      if (retryCount < maxRetries) {
        console.log(chalk.yellow(`Failed to refresh user data, retrying ${retryCount + 1}/${maxRetries}...`));
        await new Promise(resolve => setTimeout(resolve, 5000));
        return this.refreshUserData(retryCount + 1, maxRetries);
      }
      throw error;
    }
  }

  async connect() {
    try {
      await this.refreshUserData();
      
      if (!this.userData?.user) {
        throw new Error('Failed to get user data after multiple retries');
      }

      this.socket = io(this.socketEndpoint, {
        transports: ['websocket'],
        path: '/s/',
        secure: true,
        rejectUnauthorized: false,
        reconnect: true,
        query: {
          uid: this.userData.user.id,
          token: this.userData.socket_token,
        },
        extraHeaders: { 'User-agent': `${this.userData.user.id} API Bot` }
      });

      this.setupEventHandlers();
    } catch (error) {
      console.error(chalk.red(`Error connecting to websocket: ${error}`));
      console.log(chalk.yellow('Retrying connection in 10 seconds...'));
      await new Promise(resolve => setTimeout(resolve, 10000));
      return this.connect();
    }
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log(chalk.green('Connected to websocket'));
      
      this.socket?.emit('identify', {
        uid: this.userData.user.id,
        model: this.userData.user,
        authorizationToken: this.userData.socket_token,
        signature: this.userData.socket_signature
      });
    });

    this.socket.on('init', (data: any) => {
      if (data?.authenticated) {
        console.log(chalk.green(`Successfully authenticated as ${data.name}`));
        this.socket?.emit('filters', { price_max: 9999999 });
      }
    });

    this.socket.on('new_item', (data: any) => {
      try {
        const items = Array.isArray(data[1]) ? data[1] : [data[1]];
        items.forEach(item => {
          if (item && item.market_name) {
            console.log(chalk.blue(`📦 New item: ${item.market_name} - $${(item.market_value / 100).toFixed(2)} (${item.wear?.toFixed(4) || 'N/A'})`));
            this.itemCallback(item);
          } else if (item && item.id) {
            console.log(chalk.yellow(`📝 Item update received for ID: ${item.id}`));
          }
        });
      } catch (error) {
        console.error(chalk.red('Error processing new item:', error));
        debug.log('Problematic data:', data);
      }
    });

    this.socket.on('error', (error) => {
      console.error(chalk.red(`Socket error: ${error}`));
    });

    this.socket.on('disconnect', (reason) => {
      console.log(chalk.yellow(`Socket disconnected: ${reason}`));
    });
  }

  disconnect() {
    this.socket?.disconnect();
  }
} 