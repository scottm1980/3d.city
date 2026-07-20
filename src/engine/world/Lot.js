import { ZoneType } from './ZoneType.js';

export class Lot {

    constructor ( x, y ) {

        this.x = x;
        this.y = y;

        this.terrain = null;            // set by Tier 2 map generation
        this.resourceEndowment = null;  // ResourceEndowment | null, set by Tier 2

        this.zoneType = ZoneType.NONE;  // player-assigned designation
        this.facility = null;           // Facility | null, set only on a footprint's anchor lot
        this.occupiedBy = null;         // facility id | null, set on every lot in a footprint (including the anchor)

    }

    get hasResource () {

        return this.resourceEndowment !== null;

    }

    // True for both the anchor lot (which also holds .facility) and every
    // other lot inside that facility's footprint - occupied either way,
    // even though only the anchor holds the actual Facility object.
    get isDeveloped () {

        return this.occupiedBy !== null;

    }

}
