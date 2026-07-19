import { ZoneType } from '../world/ZoneType.js';
import { Facility } from '../world/Facility.js';

let _facilitySequence = 0;

// Set of resource ids placed by terrain (Tier 2) - these require a matching
// lot endowment to resolve, unlike zone-inherent outputs (e.g. housing's
// labor) that need no geological deposit to exist.
export function geographicResourceIds ( resourceRules ) {

    return new Set( resourceRules.map( r => r.resourceId ) );

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
    resolve ( lot, availableResourceIds ) {

        if ( lot.zoneType === ZoneType.NONE || lot.isDeveloped ) return null;

        for ( const recipe of this.recipes.all() ) {

            if ( recipe.requiredZoneType !== lot.zoneType ) continue;
            if ( this._isSatisfiable( recipe, lot, availableResourceIds ) ) return recipe;

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

export function developLot ( city, lot, recipe ) {

    const facility = new Facility( `facility-${ ++ _facilitySequence }`, recipe.facilityArchetype, lot );
    lot.facility = facility;
    city.facilities.set( facility.id, facility );
    return facility;

}
