import { ENV } from '../config/env';
import { BaseService } from './base.service';
import type { CSGOResponse, CSGOItem } from '../types';
import type { WatcherConfig, SkinWatch } from '../types/config';
import chalk from 'chalk';
import { debug } from '../utils/debug';
import { processSkinConfig } from '../utils/config';

export class WatcherService extends BaseService {
  private spottedItems: Set<number> = new Set();
  private config: WatcherConfig;
  private readonly PRICE_MULTIPLIER = 0.6142808;

  constructor(config: WatcherConfig) {
    super();
    debug.log('Processing config:', config);
    this.config = {
      ...config,
      skins: config.skins.map(skin => {
        const processed = processSkinConfig(skin);
        debug.log(`Processed skin:`, processed);
        return processed;
      })
    };
  }

  async searchForSkins() {
    try {
      for (const skin of this.config.skins) {
        await this.searchSkin(skin);
      }
    } catch (error) {
      console.error(chalk.red('Error searching for items:', error));
    }
  }

  private async searchSkin(skinConfig: SkinWatch) {
    const adjustedMinPrice = skinConfig.minPrice 
      ? Math.round(skinConfig.minPrice / this.PRICE_MULTIPLIER * 100).toString()
      : undefined;
    const adjustedMaxPrice = skinConfig.maxPrice 
      ? Math.round(skinConfig.maxPrice / this.PRICE_MULTIPLIER * 100).toString()
      : undefined;

    const params = {
      per_page: '10',
      page: '1',
      sort: 'desc',
      order: 'market_value',
      search: skinConfig.search,
      ...(adjustedMinPrice && { price_min: adjustedMinPrice }),
      ...(adjustedMaxPrice && { price_max: adjustedMaxPrice }),
    };

    debug.object('Search parameters', params);

    try {
      const data = await this.get<CSGOResponse>('/trading/items', params);
      debug.log(`Found ${data.data.length} items before filtering`);
      
      const items = data.data.filter(item => {
        const matchesFloat = this.matchesFloatRange(item, skinConfig);
        debug.log(`Item ${item.market_name} (Float: ${item.wear}) matches float range: ${matchesFloat}`);
        return matchesFloat;
      });

      debug.log(`${items.length} items match float range criteria`);

      // Convert prices back to USD for display
      for (const item of items) {
        item.market_value = item.market_value * this.PRICE_MULTIPLIER;
      }

      for (const item of items) {
        if (this.spottedItems.has(item.id)) {
          debug.log(`Item ${item.id} already spotted before`);
          console.log(chalk.yellow(`
╔════════════════════════════════════════════
║ Already spotted this ${skinConfig.name} before
║ ${this.formatItemDetails(item)}
╚════════════════════════════════════════════
`));
          continue;
        }

        debug.log(`New item found: ${item.market_name}`);
        this.spottedItems.add(item.id);
        console.log(chalk.green(`
╔════════════════════════════════════════════
║ New ${skinConfig.name} Found!
║ ${this.formatItemDetails(item)}
║ URL: https://csgoempire.com/item/${item.id}
╚════════════════════════════════════════════
`));
        
        debug.log('Sending Discord notification...');
        await this.notifyDiscord(item, skinConfig);
      }
    } catch (error) {
      console.error(chalk.red('Error searching for skin:', skinConfig.name));
      debug.log('Full error:', error);
      return;
    }
  }

  private matchesFloatRange(item: CSGOItem, config: SkinWatch): boolean {
    if (!item.wear) return false;
    if (config.minFloat && item.wear < config.minFloat) return false;
    if (config.maxFloat && item.wear > config.maxFloat) return false;
    return true;
  }

  private formatItemDetails(item: CSGOItem): string {
    const details = [
      `ID: ${item.id}`,
      `Name: ${item.market_name}`,
      `Float: ${item.wear || 'N/A'}`,
      `Price: $${(item.market_value / 100).toFixed(2)}`,
      item.custom_name && `Custom Name: ${item.custom_name}`,
      item.paint_seed && `Paint Seed: ${item.paint_seed}`,
      item.price_is_unreliable ? '⚠️ Price Unreliable' : '✅ Price Reliable',
      item.invalid && `⚠️ ${item.invalid}`,
    ].filter(Boolean);

    return details.join('\n║ ');
  }

  private async notifyDiscord(item: CSGOItem, skinConfig: SkinWatch) {
    try {
      const itemUrl = `https://csgoempire.com/item/${item.id}`;
      const response = await fetch(ENV.DISCORD_WEBHOOK, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          embeds: [{
            title: `New ${skinConfig.name} Found!`,
            description: `Found item: ${item.market_name}\n[View on CSGOEmpire](${itemUrl})`,
            fields: [
              {
                name: 'Float',
                value: item.wear?.toString() || 'N/A',
                inline: true,
              },
              {
                name: 'Price',
                value: `$${(item.market_value / 100).toFixed(2)}`,
                inline: true,
              },
              item.custom_name && {
                name: 'Custom Name',
                value: item.custom_name,
                inline: true,
              },
              item.paint_seed && {
                name: 'Paint Seed',
                value: item.paint_seed.toString(),
                inline: true,
              },
              {
                name: 'Status',
                value: [
                  item.price_is_unreliable ? '⚠️ Price Unreliable' : '✅ Price Reliable',
                  item.invalid && `⚠️ ${item.invalid}`,
                ].filter(Boolean).join('\n'),
                inline: false,
              }
            ].filter(Boolean),
            thumbnail: {
              url: `https://steamcommunity-a.akamaihd.net/economy/image/${item.icon_url}`,
            },
            url: itemUrl,
            timestamp: new Date().toISOString(),
            color: parseInt(item.name_color, 16),
          }],
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error(chalk.red('Error sending Discord notification:', error));
    }
  }
}