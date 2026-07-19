import { ZoneType } from '../world/ZoneType.js';
import { ControlMode } from '../world/CityState.js';
import { developLot } from '../resolution/ZoneResolver.js';

// Operates on a single managed city's lots. Automated cities are handled
// by TownCharterTool instead (round-2 decision: tool scope splits by
// control mode).
export class ZoningTool {

    constructor ( resolver ) {

        this.resolver = resolver;

    }

    // What zoning this lot as `zoneType` would resolve to right now,
    // without committing anything - the legibility the engine plan calls
    // for ("surface a lot's resource endowment... before the player
    // commits"). Returns null if nothing would resolve yet. A dry run:
    // zoneType is set, resolved, then restored, so it never mutates state
    // the caller didn't ask to change.
    preview ( lot, zoneType, availableResourceIds ) {

        if ( lot.isDeveloped ) return null;

        const previousZone = lot.zoneType;
        lot.zoneType = zoneType;
        const recipe = this.resolver.resolve( lot, availableResourceIds );
        lot.zoneType = previousZone;

        return recipe;

    }

    // Commits the zoning designation and immediately attempts resolution.
    // If the required inputs are already available, development happens
    // right away; otherwise the lot stays zoned-but-vacant until a later
    // call to reattempt() (Tier 7's orchestrator is expected to call that
    // every tick) picks it up once supply exists.
    zone ( city, lot, zoneType, availableResourceIds ) {

        if ( city.controlMode !== ControlMode.MANAGED ) {

            throw new Error( `ZoningTool only operates on managed cities; ${ city.id } is ${ city.controlMode }` );

        }

        if ( lot.isDeveloped ) return null;

        lot.zoneType = zoneType;
        const recipe = this.resolver.resolve( lot, availableResourceIds );

        return recipe ? developLot( city, lot, recipe ) : null;

    }

    // Re-attempts development for every zoned-but-undeveloped lot in a
    // managed city. Call this after a TradeResolver.tick() to pick up lots
    // that couldn't resolve before but can now that supply has arrived.
    reattempt ( city, availableResourceIds ) {

        const developed = [];

        for ( const lot of city.lots ) {

            if ( lot.zoneType === ZoneType.NONE || lot.isDeveloped ) continue;

            const recipe = this.resolver.resolve( lot, availableResourceIds );
            if ( recipe ) developed.push( developLot( city, lot, recipe ) );

        }

        return developed;

    }

}
