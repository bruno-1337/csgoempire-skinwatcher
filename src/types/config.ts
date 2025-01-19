export interface SkinWatch {
  search: string;
  minFloat?: number;
  maxFloat?: number;
  minPrice?: number;
  maxPrice?: number;
  stattrak?: boolean;
}

export interface WatcherConfig {
  interval: number;
  skins: SkinWatch[];
}