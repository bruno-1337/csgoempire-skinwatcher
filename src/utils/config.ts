import type { SkinWatch } from '../types/config';

export function processSkinConfig(config: SkinWatch): SkinWatch {
  if (config.stattrak === true) {
    return {
      ...config,
      name: `StatTrak™ ${config.name}`,
      search: `StatTrak™ ${config.search}`,
    };
  }
  return config;
} 