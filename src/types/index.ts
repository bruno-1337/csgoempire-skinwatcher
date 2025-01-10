export interface CSGOItem {
  id: number;
  market_name: string;
  market_value: number;
  wear: number;
  icon_url: string;
  img?: string;
  asset_id?: string;
  created_at?: string;
  updated_at?: string;
  published_at?: string;
  auction_ends_at?: number;
  auction_highest_bid?: number;
  auction_highest_bidder?: number;
  auction_number_of_bids?: number;
  auction_auto_withdraw_failed?: boolean;
  custom_name?: string | null;
  custom_price_percentage?: number | null;
  description_type?: string;
  invalid?: string;
  is_commodity: boolean;
  name?: string;
  name_color: string;
  paint_index?: number | null;
  paint_seed?: number | null;
  position?: number | null;
  full_position?: number;
  preview_id: string | null;
  price_is_unreliable: boolean;
  stickers: any[];
  tradable: boolean;
  tradelock: boolean;
  app_id?: number;
}

export interface CSGOResponse {
  data: CSGOItem[];
}

export interface TradeStatus {
  type: 'withdrawal' | 'deposit';
  data: {
    status: number;
    status_message: string;
    id: number;
    item_id: number;
    tradeoffer_id: number;
    item: {
      market_name: string;
      market_value: number;
    };
    total_value: number;
  };
}