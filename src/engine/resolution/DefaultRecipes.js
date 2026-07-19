import { ResourceType, ResourceCategory } from '../resources/ResourceType.js';
import { Recipe, RecipeLine } from '../resources/Recipe.js';
import { ZoneType } from '../world/ZoneType.js';

// Resources that only exist as production outputs, never placed by terrain.
export const DefaultProcessedResourceTypes = [
    new ResourceType( 'steel', 'Steel', ResourceCategory.PROCESSED ),
    new ResourceType( 'lumber', 'Lumber', ResourceCategory.PROCESSED ),
    // Population-derived, not geographic - mechanically an extraction output
    // (zero inputs) so it resolves through the same recipe machinery as ore.
    new ResourceType( 'labor', 'Labor', ResourceCategory.RAW ),
    new ResourceType( 'trade_goods', 'Trade Goods', ResourceCategory.PROCESSED ),
];

const line = ( resourceId, quantity ) => new RecipeLine( resourceId, quantity );

// Demonstrates the resolver end to end: one extraction recipe per raw
// terrain resource, one processing chain per zone type, plus the
// residential/commercial recipes that prove the same mechanism handles
// every zone type uniformly, not just industry. Content, not engine logic -
// new chains are added here, not by touching ZoneResolver.
export const DefaultRecipes = [
    new Recipe( 'iron_mine', { outputs: [ line( 'iron_ore', 2 ) ], facilityArchetype: 'iron_mine', requiredZoneType: ZoneType.INDUSTRIAL } ),
    new Recipe( 'coal_mine', { outputs: [ line( 'coal', 2 ) ], facilityArchetype: 'coal_mine', requiredZoneType: ZoneType.INDUSTRIAL } ),
    new Recipe( 'logging_camp', { outputs: [ line( 'timber', 2 ) ], facilityArchetype: 'logging_camp', requiredZoneType: ZoneType.INDUSTRIAL } ),
    new Recipe( 'farm', { outputs: [ line( 'grain', 2 ) ], facilityArchetype: 'farm', requiredZoneType: ZoneType.INDUSTRIAL } ),
    new Recipe( 'fishery', { outputs: [ line( 'fish', 2 ) ], facilityArchetype: 'fishery', requiredZoneType: ZoneType.INDUSTRIAL } ),
    new Recipe( 'oil_well', { outputs: [ line( 'oil', 2 ) ], facilityArchetype: 'oil_well', requiredZoneType: ZoneType.INDUSTRIAL } ),

    new Recipe( 'steel_mill', { inputs: [ line( 'iron_ore', 2 ), line( 'coal', 1 ) ], outputs: [ line( 'steel', 1 ) ], facilityArchetype: 'steel_mill', requiredZoneType: ZoneType.INDUSTRIAL } ),
    new Recipe( 'sawmill', { inputs: [ line( 'timber', 2 ) ], outputs: [ line( 'lumber', 1 ) ], facilityArchetype: 'sawmill', requiredZoneType: ZoneType.INDUSTRIAL } ),

    new Recipe( 'housing', { outputs: [ line( 'labor', 3 ) ], facilityArchetype: 'housing', requiredZoneType: ZoneType.RESIDENTIAL } ),
    new Recipe( 'retail', { inputs: [ line( 'labor', 1 ) ], outputs: [ line( 'trade_goods', 1 ) ], facilityArchetype: 'retail', requiredZoneType: ZoneType.COMMERCIAL } ),
];
