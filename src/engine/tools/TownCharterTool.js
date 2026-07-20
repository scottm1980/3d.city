import { ZoneType } from '../world/ZoneType.js';
import { ControlMode } from '../world/CityState.js';
import { TerrainType } from '../worldgen/Terrain.js';
import { developLot } from '../resolution/ZoneResolver.js';

// Default relative weights for how an automated city allocates newly
// zoned lots when nothing stronger (an on-site resource) is pulling it
// toward industrial. Content, not a locked ruleset - tune per city
// archetype later.
export const DefaultTownCharter = Object.freeze( {
    industrial: 0.4,
    residential: 0.4,
    commercial: 0.2,
} );

// The lighter-oversight counterpart to ZoningTool for automated cities
// (round-2 decision: satellite towns get policy sliders, not tile-by-tile
// control). Each application zones and attempts to develop a batch of a
// city's undeveloped lots according to the charter's priorities, rather
// than requiring per-lot player input.
export class TownCharterTool {

    constructor ( resolver ) {

        this.resolver = resolver;

    }

    // rng: a SeededRandom, so growth is deterministic and replayable like
    // the rest of world generation. maxLots caps how many lots this call
    // successfully develops, not how many it zones - a candidate that gets
    // zoned but can't resolve yet (e.g. commercial with no labor available)
    // doesn't count against the cap, and stays zoned for a later sweep
    // (ZoningTool.reattempt() is control-mode-agnostic and picks up any
    // zoned-but-undeveloped lot, regardless of which tool zoned it).
    apply ( city, charter, availableResourceIds, rng, maxLots = 5 ) {

        if ( city.controlMode !== ControlMode.AUTOMATED ) {

            throw new Error( `TownCharterTool only operates on automated cities; ${ city.id } is ${ city.controlMode }` );

        }

        const candidates = city.lots.filter( l => l.zoneType === ZoneType.NONE && ! l.isDeveloped && l.terrain !== TerrainType.WATER );
        const developed = [];

        for ( const lot of candidates ) {

            if ( developed.length >= maxLots ) break;

            lot.zoneType = this._chooseZone( lot, charter, rng );

            const recipe = this.resolver.resolve( city, lot, availableResourceIds );
            if ( recipe ) developed.push( developLot( city, lot, recipe ) );
            // If it doesn't resolve yet (e.g. commercial with no labor
            // available), it stays zoned and a later reattempt - via the
            // same mechanism ZoningTool.reattempt() uses - picks it up.

        }

        return developed;

    }

    _chooseZone ( lot, charter, rng ) {

        if ( lot.hasResource ) return ZoneType.INDUSTRIAL; // on-site resource is always worth claiming

        const total = charter.industrial + charter.residential + charter.commercial;
        const roll = rng.next() * total;

        if ( roll < charter.residential ) return ZoneType.RESIDENTIAL;
        if ( roll < charter.residential + charter.commercial ) return ZoneType.COMMERCIAL;
        return ZoneType.INDUSTRIAL;

    }

}
