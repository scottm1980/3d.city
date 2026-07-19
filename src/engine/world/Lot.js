import { ZoneType } from './ZoneType.js';

export class Lot {

    constructor ( x, y ) {

        this.x = x;
        this.y = y;

        this.terrain = null;            // set by Tier 2 map generation
        this.resourceEndowment = null;  // ResourceEndowment | null, set by Tier 2

        this.zoneType = ZoneType.NONE;  // player-assigned designation
        this.facility = null;           // Facility | null, resolved by Tier 3

    }

    get hasResource () {

        return this.resourceEndowment !== null;

    }

    get isDeveloped () {

        return this.facility !== null;

    }

}
