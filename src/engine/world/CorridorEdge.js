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

        // Set by DisruptionTool (a "transport disruption"): while
        // region.tick is below this, effectiveCapacity() reports capacity
        // scaled by disruptionCapacityFactor instead of the full value,
        // forcing TradeResolver's shipment matching to reroute around or
        // queue behind the bottleneck. null means not disrupted.
        this.disruptedUntilTick = null;
        this.disruptionCapacityFactor = 0; // 0 = fully severed, e.g. 0.25 = a partial washout

    }

    connects ( cityId ) {

        return this.cityAId === cityId || this.cityBId === cityId;

    }

    other ( cityId ) {

        if ( this.cityAId === cityId ) return this.cityBId;
        if ( this.cityBId === cityId ) return this.cityAId;
        return null;

    }

    // What TradeResolver's shipment matching should actually treat this
    // corridor's capacity as, given any active disruption - the single
    // source of truth so nothing reads the raw `capacity` field directly
    // and silently ignores a disruption.
    effectiveCapacity ( currentTick ) {

        if ( this.disruptedUntilTick !== null && currentTick < this.disruptedUntilTick ) {

            return this.capacity * this.disruptionCapacityFactor;

        }

        return this.capacity;

    }

}
