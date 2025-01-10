export interface SkinWatch {
  name: string;
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