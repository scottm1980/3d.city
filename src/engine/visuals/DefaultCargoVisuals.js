import { CargoVisual, CargoVisualRegistry, ModelVariant } from './CargoVisual.js';
import { ResourceCategory } from '../resources/ResourceType.js';

// Content, not engine logic - a new resource just needs an entry here (or
// falls back to its category default below) to render coherently.
export const DefaultCargoVisuals = [
    new CargoVisual( 'iron_ore', { tint: 0x8b4a3d, modelVariant: ModelVariant.HOPPER, label: 'Fe' } ),
    new CargoVisual( 'coal', { tint: 0x2b2b2b, modelVariant: ModelVariant.HOPPER, label: 'C' } ),
    new CargoVisual( 'timber', { tint: 0x7a5230, modelVariant: ModelVariant.FLATBED, label: 'Tm' } ),
    new CargoVisual( 'grain', { tint: 0xd9b44a, modelVariant: ModelVariant.HOPPER, label: 'Gr' } ),
    new CargoVisual( 'fish', { tint: 0x4a90a4, modelVariant: ModelVariant.REFRIGERATED, label: 'Fi' } ),
    new CargoVisual( 'oil', { tint: 0x1a1a1a, modelVariant: ModelVariant.TANKER, label: 'Oi' } ),
    new CargoVisual( 'steel', { tint: 0x9fa6ad, modelVariant: ModelVariant.FLATBED, label: 'St' } ),
    new CargoVisual( 'lumber', { tint: 0xc08a52, modelVariant: ModelVariant.FLATBED, label: 'Lb' } ),
    new CargoVisual( 'labor', { tint: 0xf2d24b, modelVariant: ModelVariant.TRANSIT, label: 'Wk' } ),
    new CargoVisual( 'trade_goods', { tint: 0xd94f4f, modelVariant: ModelVariant.VAN, label: 'Gd' } ),
];

export const DefaultCargoCategoryFallbacks = [
    { category: ResourceCategory.RAW, visual: new CargoVisual( '__raw_default__', { tint: 0x9c8060, modelVariant: ModelVariant.HOPPER, label: '?' } ) },
    { category: ResourceCategory.PROCESSED, visual: new CargoVisual( '__processed_default__', { tint: 0xa9a9a9, modelVariant: ModelVariant.FLATBED, label: '?' } ) },
];

export function createDefaultCargoVisualRegistry () {

    const registry = new CargoVisualRegistry();

    for ( const visual of DefaultCargoVisuals ) registry.register( visual );
    for ( const { category, visual } of DefaultCargoCategoryFallbacks ) registry.registerCategoryFallback( category, visual );

    return registry;

}
