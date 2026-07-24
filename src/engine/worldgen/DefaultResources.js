import { ResourceType, ResourceCategory } from '../resources/ResourceType.js';
import { TerrainType } from './Terrain.js';

export const DefaultResourceTypes = [
    new ResourceType( 'iron_ore', 'Iron Ore', ResourceCategory.RAW ),
    new ResourceType( 'coal', 'Coal', ResourceCategory.RAW ),
    new ResourceType( 'timber', 'Timber', ResourceCategory.RAW ),
    new ResourceType( 'grain', 'Grain', ResourceCategory.RAW ),
    new ResourceType( 'fish', 'Fish', ResourceCategory.RAW ),
    new ResourceType( 'oil', 'Crude Oil', ResourceCategory.RAW ),
];

// Which raw resource can appear on which terrain, how large/sparse its
// belts are (frequency: lower = larger, sparser clusters), and how high its
// own placement-noise value has to be before it actually appears (threshold:
// higher = rarer). This is what makes placement geographic — a mountain
// tile only has ore if it falls inside an ore belt, not on every mountain.
export const DefaultResourceRules = [
    { resourceId: 'iron_ore', terrain: TerrainType.MOUNTAIN, frequency: 0.10, threshold: 0.62 },
    { resourceId: 'coal', terrain: TerrainType.HILLS, frequency: 0.12, threshold: 0.60 },
    { resourceId: 'timber', terrain: TerrainType.FOREST, frequency: 0.18, threshold: 0.50 },
    { resourceId: 'grain', terrain: TerrainType.PLAINS, frequency: 0.15, threshold: 0.55 },
    { resourceId: 'fish', terrain: TerrainType.WATER, frequency: 0.20, threshold: 0.58 },
    { resourceId: 'oil', terrain: TerrainType.DESERT, frequency: 0.08, threshold: 0.65 },
];
