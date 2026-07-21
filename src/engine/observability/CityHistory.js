// Tier 7+ observability: real time-series tracking over live region/city
// state, not a display-only mock. Feeds the History panel (see
// RENDERER_INTEGRATION_FINDINGS.md's Hub redesign) with genuine trend
// data - treasury, facility count, and corridor congestion over time -
// instead of the Micropolis-specific population/crime/pollution charts
// src/engine has no data for.
const DEFAULT_MAX_SAMPLES = 200;
const DEFAULT_SAMPLE_INTERVAL = 5; // ticks between samples - keeps a long session's history bounded and readable rather than one point per tick

export class CityHistory {

    constructor ( { maxSamples = DEFAULT_MAX_SAMPLES, sampleInterval = DEFAULT_SAMPLE_INTERVAL } = {} ) {

        this.maxSamples = maxSamples;
        this.sampleInterval = sampleInterval;
        this.samplesByCity = new Map(); // cityId -> sample[], oldest first, bounded to maxSamples
        this._lastSampledTick = -Infinity;

    }

    // Call once per RegionOrchestrator.tick() (or on whatever cadence the
    // caller ticks the region) - internally throttled to sampleInterval,
    // so calling this every tick is always safe and correct.
    record ( region ) {

        if ( region.tick - this._lastSampledTick < this.sampleInterval ) return;
        this._lastSampledTick = region.tick;

        for ( const city of region.cities.values() ) {

            const corridors = region.corridorsFor( city.id );
            const avgCorridorUtilization = corridors.length === 0 ? 0 : corridors.reduce(
                ( sum, c ) => sum + ( c.capacity > 0 ? c.load / c.capacity : 0 ), 0,
            ) / corridors.length;

            const sample = {
                tick: region.tick,
                facilityCount: city.facilities.size,
                treasury: region.nationalBudget.treasury,
                cityAllocation: city.budget ? city.budget.allocation : 0,
                avgCorridorUtilization,
            };

            let list = this.samplesByCity.get( city.id );
            if ( ! list ) { list = []; this.samplesByCity.set( city.id, list ); }

            list.push( sample );
            if ( list.length > this.maxSamples ) list.shift();

        }

    }

    samplesFor ( cityId ) {

        return this.samplesByCity.get( cityId ) || [];

    }

}
