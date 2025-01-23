import { ENV } from '../config/env';
import { BaseService } from './base.service';
import { SocketService } from './socket.service';
import type { CSGOResponse, CSGOItem } from '../types';
import type { WatcherConfig, SkinWatch } from '../types/config';
import chalk from 'chalk';
import { debug } from '../utils/debug';
import { processSkinConfig } from '../utils/config';

export class WatcherService extends BaseService {
  private spottedItems: Set<number> = new Set();
  private webhookMessages: Map<number, string> = new Map(); // item.id -> message_id
  private itemStates: Map<number, CSGOItem> = new Map(); // item.id -> previous state
  private config: WatcherConfig;
  private socketService: SocketService;
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
    this.socketService = new SocketService(this.handleNewItem.bind(this));
  }

  async start() {
    try {
      // Initial fetch for all configured skins
      for (const skin of this.config.skins) {
        await this.initialFetch(skin);
      }

      // Connect to WebSocket for real-time updates
      await this.socketService.connect();
    } catch (error) {
      console.error(chalk.red('Error starting watcher:', error));
    }
  }

  private async initialFetch(skinConfig: SkinWatch) {
    const adjustedMinPrice = skinConfig.minPrice 
      ? Math.round(skinConfig.minPrice / this.PRICE_MULTIPLIER * 100).toString()
      : undefined;
    const adjustedMaxPrice = skinConfig.maxPrice 
      ? Math.round(skinConfig.maxPrice / this.PRICE_MULTIPLIER * 100).toString()
      : undefined;

    const params = {
      per_page: '100',
      page: '1',
      sort: 'desc',
      order: 'market_value',
      search: skinConfig.search,
      ...(adjustedMinPrice && { price_min: adjustedMinPrice }),
      ...(adjustedMaxPrice && { price_max: adjustedMaxPrice }),
    };

    try {
      const data = await this.get<CSGOResponse>('/trading/items', params);
      debug.log(`Initial fetch for ${skinConfig.search}: Found ${data.data.length} items`);
      
      for (const item of data.data) {
        if (this.matchesConfig(item, skinConfig)) {
          this.spottedItems.add(item.id);
          this.itemStates.set(item.id, {...item});
          await this.notifyDiscord(item, skinConfig);
        }
      }
    } catch (error) {
      console.error(chalk.red(`Error in initial fetch for ${skinConfig.search}:`, error));
    }
  }

  private matchesConfig(item: CSGOItem, config: SkinWatch): boolean {
    debug.log(`Checking item "${item.market_name}" against config "${config.search}"`);
    
    // Convert both strings to lowercase and remove extra spaces
    const itemName = item.market_name.toLowerCase().trim();
    const searchTerm = config.search.toLowerCase().trim();
    
    // Split search terms and check if all parts are included
    const searchParts = searchTerm.split(' ');
    const allPartsMatch = searchParts.every(part => itemName.includes(part));
    
    if (!allPartsMatch) {
      debug.log(`❌ Name mismatch: "${item.market_name}" doesn't match all parts of "${config.search}"`);
      return false;
    }
    debug.log(`✅ Name matches`);
    
    // Rest of the method remains the same
    const itemPrice = item.market_value * this.PRICE_MULTIPLIER / 100;
    if (config.maxPrice && itemPrice > config.maxPrice) {
      debug.log(`❌ Price too high: $${itemPrice.toFixed(2)} > $${config.maxPrice}`);
      return false;
    }
    if (config.minPrice && itemPrice < config.minPrice) {
      debug.log(`❌ Price too low: $${itemPrice.toFixed(2)} < $${config.minPrice}`);
      return false;
    }
    debug.log(`✅ Price matches: $${itemPrice.toFixed(2)} is within range`);
    
    // Check float range if applicable
    if (!this.matchesFloatRange(item, config)) {
      debug.log(`❌ Float mismatch: Item float ${item.wear || 'N/A'} doesn't match range ${config.minFloat || '0'}-${config.maxFloat || 'inf'}`);
      return false;
    }
    debug.log(`✅ Float matches or not required`);
    
    debug.log(`✅ Item matches all criteria`);
    return true;
  }

  private handleNewItem(item: CSGOItem) {
    debug.log(`Checking item: ${item.market_name} (${item.market_value / 100} coins)`);
    
    const matchingConfig = this.config.skins.find(config => {
      const matches = this.matchesConfig(item, config);
      if (!matches) {
        debug.log(`Item ${item.market_name} didn't match config ${config.search}`);
      }
      return matches;
    });

    if (matchingConfig) {
      const isUpdate = this.spottedItems.has(item.id);
      const previousState = this.itemStates.get(item.id);
      
      if (isUpdate && previousState) {
        const changes = this.getItemChanges(previousState, item);
        if (changes.length > 0) {
          debug.log(`Changes detected for item ${item.id}:`, changes);
          this.itemStates.set(item.id, {...item});
          this.notifyDiscord(item, matchingConfig, changes);
        }
      } else {
        debug.log(`New matching item found via WebSocket: ${item.market_name}`);
        this.spottedItems.add(item.id);
        this.itemStates.set(item.id, {...item});
        this.notifyDiscord(item, matchingConfig);
      }
    }
  }

  private matchesFloatRange(item: CSGOItem, config: SkinWatch): boolean {
    // If no float constraints, return true
    if (!config.minFloat && !config.maxFloat) return true;
    
    // If item has no float but config requires it, return false
    if (!item.wear && (config.minFloat || config.maxFloat)) return false;
    
    // Check float constraints if they exist
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

  private getPriceDifferenceText(priceDiff: string | number): string {
    const percentage = Number(priceDiff);
    if (percentage === 0) return "Normal Price 💠";
    if (percentage <= -5) return "Very Cheap! 🔥";
    if (percentage <= -3) return "Cheap! 💰";
    if (percentage < 0) return "Cheaper 📉";
    if (percentage >= 10) return "Very Expensive! ⚠️";
    if (percentage >= 5) return "Expensive! ⚡";
    return "More Expensive 📈";
  }

  private getItemChanges(oldItem: CSGOItem, newItem: CSGOItem): string[] {
    const changes: string[] = [];
    
    if (oldItem.market_value !== newItem.market_value) {
      changes.push(`Price changed from $${(oldItem.market_value / 100).toFixed(2)} to $${(newItem.market_value / 100).toFixed(2)}`);
    }
    
    if (oldItem.auction_ends_at !== newItem.auction_ends_at) {
      if (!oldItem.auction_ends_at && newItem.auction_ends_at) {
        changes.push('Item is now in auction');
      } else if (oldItem.auction_ends_at && !newItem.auction_ends_at) {
        changes.push('Auction has ended');
      }
    }

    if (oldItem.auction_highest_bid !== newItem.auction_highest_bid) {
      changes.push(`Highest bid changed to ${newItem.auction_highest_bid} coins`);
    }

    if (oldItem.auction_number_of_bids !== newItem.auction_number_of_bids) {
      changes.push(`Number of bids changed to ${newItem.auction_number_of_bids}`);
    }

    return changes;
  }

  private async notifyDiscord(item: CSGOItem, skinConfig: SkinWatch, changes: string[] = []) {
    try {
      const itemUrl = `https://csgoempire.com/item/${item.id}`;
      const dollarPrice = (item.market_value * this.PRICE_MULTIPLIER / 100).toFixed(2);
      const suggestedPrice = item.suggested_price != null 
        ? (item.suggested_price * this.PRICE_MULTIPLIER / 100).toFixed(2)
        : null;
      const coinValue = (item.market_value / 100).toFixed(2);
      
      // Format delivery stats
      const deliveryStats = item.depositor_stats;
      const deliveryInfo = [
        `Recent Delivery Rate: ${(deliveryStats.delivery_rate_recent * 100).toFixed(0)}%`,
        `Average Delivery Time: ${deliveryStats.delivery_time_minutes_recent} mins`,
        `Steam Level: ${deliveryStats.steam_level_min_range}-${deliveryStats.steam_level_max_range}`,
        deliveryStats.user_has_trade_notifications_enabled ? '🔔 Trade Notifications ON' : '🔕 Trade Notifications OFF'
      ].join(' • ');

      // Check if auction is still valid
      const currentEpoch = Math.floor(Date.now() / 1000);
      const isValidAuction = item.auction_ends_at && item.auction_ends_at > currentEpoch;
      
      // Create the appropriate command based on auction status
      const commandBlock = isValidAuction
        ? `**Bid Command (Auction ends <t:${item.auction_ends_at}:R>):**\n\`\`\`bash\ncurl -X POST "https://csgoempire.com/api/v2/trading/deposit/${item.id}/bid" \\
-H "Authorization: Bearer $UKNOWXD" \\
-H "Content-Type: application/json" \\
-d "{\\"bid_value\\": ${Math.floor(item.market_value)}}"\n\`\`\``
        : `**Buy Command:**\n\`\`\`bash\ncurl -X POST "https://csgoempire.com/api/v2/trading/deposit/${item.id}/withdraw" \\
-H "Authorization: Bearer $UKNOWXD" \\
-H "Content-Type: application/json" \\
-d "{\\"coin_value\\": ${Math.floor(item.market_value)}}"\n\`\`\``;

      const webhookUrl = `${ENV.DISCORD_WEBHOOK}${this.webhookMessages.has(item.id) ? `/messages/${this.webhookMessages.get(item.id)}` : '?wait=true'}`;
      
      const response = await fetch(webhookUrl, {
        method: this.webhookMessages.has(item.id) ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          embeds: [{
            title: `${this.webhookMessages.has(item.id) ? '🔄 Updated' : '🎯 New'} ${skinConfig.search} Found!`,
            description: [
              `### ${item.market_name}`,
              this.webhookMessages.has(item.id) && [
                '*This message has been updated with new information*',
                '',
                '### 📝 Changes Detected',
                ...changes.map(change => `• ${change}`)
              ].join('\n'),
              `[View on CSGOEmpire](${itemUrl})`,
              '',
              '### 💰 Pricing',
              `• Current Price: **$${dollarPrice}** (${coinValue} coins)`,
              suggestedPrice && `• Suggested Price: **$${suggestedPrice}**`,
              item.above_recommended_price && `• Price Difference: **${item.above_recommended_price}%** (${this.getPriceDifferenceText(item.above_recommended_price)})`,
              '',
              '### 📊 Item Details',
              `• Float: **${item.wear?.toFixed(4) || 'N/A'}** (${item.wear_name || 'N/A'})`,
              item.paint_seed && `• Paint Seed: **${item.paint_seed}**`,
              item.custom_name && `• Custom Name: **${item.custom_name}**`,
              isValidAuction && `• Auction Ends: <t:${item.auction_ends_at}:R>`,
              '',
              '### 🔧 Quick Actions',
              commandBlock
            ].filter(Boolean).join('\n'),
            thumbnail: {
              url: `https://steamcommunity-a.akamaihd.net/economy/image/${item.icon_url}`,
            },
            image: {
              url: `https://inspect.csgoempire2.com/${item.preview_id}.jpg`
            },
            footer: {
              text: item.price_is_unreliable ? '⚠️ Warning: Price may be unreliable' : '✅ Price verified',
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

      // Store message ID if it's a new message
      if (!this.webhookMessages.has(item.id)) {
        const responseData = await response.json();
        this.webhookMessages.set(item.id, responseData.id);
        debug.log(`Stored webhook message ID ${responseData.id} for item ${item.id}`);
      }
    } catch (error) {
      console.error(chalk.red('Error sending Discord notification:', error));
    }
  }
}