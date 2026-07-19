export const CorridorMode = Object.freeze( {
    ROAD: 'road',
    RAIL: 'rail',
    SEA: 'sea',
} );

// An inter-city connection in the region node network — a simplified
// transport segment, not fully modeled terrain (see COUNTRY_SIM_ENGINE_PLAN).
export class CorridorEdge {

    constructor ( id, cityAId, cityBId, { mode = CorridorMode.ROAD, distance = 1, capacity = 1 } = {} ) {

        this.id = id;
        this.cityAId = cityAId;
        this.cityBId = cityBId;

        this.mode = mode;
        this.distance = distance;
        this.capacity = capacity;

        this.load = 0; // current throughput this tick, owned by the Tier 4 trade resolver

    }

    connects ( cityId ) {

        return this.cityAId === cityId || this.cityBId === cityId;

    }

    other ( cityId ) {

        if ( this.cityAId === cityId ) return this.cityBId;
        if ( this.cityBId === cityId ) return this.cityAId;
        return null;

    }

}
