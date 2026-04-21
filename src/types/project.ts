import type { Plan } from './plan';
import type { TilingConfig } from './tiling';

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  plan: Plan;
  config: TilingConfig;
}
