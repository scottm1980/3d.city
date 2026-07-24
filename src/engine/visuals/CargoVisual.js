// Which vehicle mesh archetype a shipment instances as. Kept to a small,
// fixed set rather than one model per resource so cargo sharing a variant
// can still be batched into the same InstancedMesh (see
// docs/GRAPHICS_ENGINE_UPGRADE.md's GPU-driven instancing item) - only the
// tint needs to vary per instance, not the geometry.
export const ModelVariant = Object.freeze( {
    HOPPER: 'hopper',             // bulk solids: ore, coal, grain
    TANKER: 'tanker',             // liquids: oil
    FLATBED: 'flatbed',           // processed materials: steel, lumber
    REFRIGERATED: 'refrigerated', // perishables: fish
    VAN: 'van',                   // finished/consumer goods
    TRANSIT: 'transit',           // labor - commuter movement, not freight
} );

export class CargoVisual {

    constructor ( resourceId, { tint, modelVariant, label } ) {

        this.resourceId = resourceId;
        this.tint = tint;               // hex color for instance tinting
        this.modelVariant = modelVariant;
        this.label = label;             // short glyph/text for UI legibility

    }

}

// Resolves a CargoVisual per resource id, falling back to a per-category
// default so a resource added later without explicit art direction still
// renders as something coherent instead of breaking.
export class CargoVisualRegistry {

    constructor () {

        this._visuals = new Map();
        this._fallbackByCategory = new Map();

    }

    register ( visual ) {

        this._visuals.set( visual.resourceId, visual );
        return visual;

    }

    registerCategoryFallback ( category, visual ) {

        this._fallbackByCategory.set( category, visual );
        return visual;

    }

    get ( resourceId ) {

        return this._visuals.get( resourceId ) || null;

    }

    resolve ( resourceId, resourceRegistry ) {

        const explicit = this.get( resourceId );
        if ( explicit ) return explicit;

        const resourceType = resourceRegistry.get( resourceId );
        if ( resourceType ) {

            const fallback = this._fallbackByCategory.get( resourceType.category );
            if ( fallback ) return fallback;

        }

        return null;

    }

}

// The Tier 7 wiring point: given a Shipment (Tier 1/4) and the region's
// resource registry, what should it look like when TradeResolver's
// shipments are rendered as real traffic vehicles.
export function visualForShipment ( shipment, cargoVisualRegistry, resourceRegistry ) {

    return cargoVisualRegistry.resolve( shipment.commodityId, resourceRegistry );

}
