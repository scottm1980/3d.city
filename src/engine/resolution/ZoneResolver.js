import { ZoneType } from '../world/ZoneType.js';
import { Facility } from '../world/Facility.js';
import { TerrainType } from '../worldgen/Terrain.js';

let _facilitySequence = 0;

// Set of resource ids placed by terrain (Tier 2) - these require a matching
// lot endowment to resolve, unlike zone-inherent outputs (e.g. housing's
// labor) that need no geological deposit to exist.
export function geographicResourceIds ( resourceRules ) {

    return new Set( resourceRules.map( r => r.resourceId ) );

}

// Every Lot a footprintSize x footprintSize building centered on `lot`
// would occupy, or null if any of them are out of bounds, water, or
// already occupied - the real renderer's building tools use a fixed 3x3
// footprint (Base.js's Zone()), which this mirrors so src/engine's
// placement can't produce overlapping buildings (see the mismatch noted
// in RENDERER_INTEGRATION_FINDINGS.md).
export function footprintTiles ( city, lot, size ) {

    if ( size <= 1 ) return [ lot ];

    const half = Math.floor( size / 2 );
    const tiles = [];

    for ( let dy = -half; dy <= half; dy ++ ) {

        for ( let dx = -half; dx <= half; dx ++ ) {

            const neighbor = city.lotAt( lot.x + dx, lot.y + dy );
            if ( ! neighbor ) return null; // out of bounds
            if ( neighbor.terrain === TerrainType.WATER ) return null;
            if ( neighbor !== lot && neighbor.isDeveloped ) return null; // already claimed by another footprint

            tiles.push( neighbor );

        }

    }

    return tiles;

}

// Resolves what a zoned, undeveloped Lot actually becomes: the mechanism
// behind "zoning + resource endowment automatically determines industry"
// (COUNTRY_SIM_ENGINE_PLAN's locked design direction). Replaces the RCI
// growth-stage math in the original zone/*.js classes entirely - one
// resolver for every zone type, not a class per zone.
export class ZoneResolver {

    constructor ( recipeRegistry, geographicResourceIds ) {

        this.recipes = recipeRegistry;
        this.geographicResourceIds = geographicResourceIds;

    }

    // availableResourceIds: Set<string> of inputs considered obtainable.
    // Owned by Tier 4 in the full system (local production + shipments) -
    // callers ahead of Tier 4 can pass whatever set fits their test.
    // city is required to check footprint clearance around the anchor lot.
    resolve ( city, lot, availableResourceIds ) {

        if ( lot.zoneType === ZoneType.NONE || lot.isDeveloped ) return null;

        for ( const recipe of this.recipes.all() ) {

            if ( recipe.requiredZoneType !== lot.zoneType ) continue;
            if ( ! this._isSatisfiable( recipe, lot, availableResourceIds ) ) continue;
            if ( ! footprintTiles( city, lot, recipe.footprintSize ) ) continue;

            return recipe;

        }

        return null;

    }

    _isSatisfiable ( recipe, lot, availableResourceIds ) {

        if ( recipe.inputs.length === 0 ) {

            const geoBound = recipe.outputs.some( o => this.geographicResourceIds.has( o.resourceId ) );
            if ( ! geoBound ) return true;
            return lot.hasResource && recipe.outputs.some( o => o.resourceId === lot.resourceEndowment.resourceId );

        }

        return recipe.inputs.every( input => availableResourceIds.has( input.resourceId ) );

    }

}

// Claims the recipe's full footprint, not just the anchor lot: every tile
// in it becomes occupied (Lot.occupiedBy), while only the anchor holds the
// actual Facility object (Lot.facility). Assumes resolve() already
// confirmed the footprint has clearance - does not re-check here.
export function developLot ( city, lot, recipe ) {

    const facility = new Facility( `facility-${ ++ _facilitySequence }`, recipe.facilityArchetype, lot );
    const footprint = footprintTiles( city, lot, recipe.footprintSize ) || [ lot ];

    facility.footprint = footprint;
    lot.facility = facility;
    for ( const footprintLot of footprint ) footprintLot.occupiedBy = facility.id;

    city.facilities.set( facility.id, facility );
    return facility;

}

// The undo of developLot(): frees every tile in the facility's footprint
// (not just the anchor) and removes it from the city, so the lots become
// zoneable/resolvable again. `lot` may be any tile in the footprint, not
// only the anchor - callers (BulldozeTool) resolve the actual anchor via
// Lot.occupiedBy before calling this. Returns the removed Facility, or
// null if the lot wasn't developed.
export function undevelopLot ( city, lot ) {

    if ( ! lot.facility ) return null;

    const facility = lot.facility;
    for ( const footprintLot of facility.footprint ) footprintLot.occupiedBy = null;
    lot.facility = null;
    lot.zoneType = ZoneType.NONE;

    city.facilities.delete( facility.id );
    return facility;

}
