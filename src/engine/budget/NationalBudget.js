import { CityBudget } from './CityBudget.js';

// What fraction of the accumulated treasury gets distributed to cities
// each tick, rather than handed out in full - keeps a running national
// reserve instead of the treasury being a pure pass-through, and smooths
// allocation so one huge tick of trade revenue doesn't instantly flood
// every city. Content, not locked math - a starting point for tuning.
const ALLOCATION_FRACTION = 0.5;

// A city with zero facilities still gets a minimum share so a newly
// founded city (FoundCityTool) isn't stuck unable to ever afford its
// first building - without this, its allocation weight would be zero
// forever, since weight is driven by existing facility count.
const MIN_ALLOCATION_WEIGHT = 1;

// OrdinanceTool's "Priority Funding" lever: a city with it enabled draws a
// larger share of the distributable treasury than its facility count alone
// would earn it, at every other city's expense (the weighted split is
// zero-sum) - a real, mechanical policy trade-off, not a display toggle.
const PRIORITY_FUNDING_MULTIPLIER = 1.5;

// A new city can't wait for its first tick() to earn any revenue before
// it's allowed to build anything - it would have $0 and every recipe's
// buildCost would block it forever. A founding grant (content, not
// locked math) solves the bootstrap problem for both a region's initial
// cities and any founded later via FoundCityTool.
const STARTING_ALLOCATION = 1000;

// National treasury allocates into per-city budgets rather than cities
// being fully autonomous or a pure pass-through (locked decision, see
// COUNTRY_SIM_ENGINE_PLAN §Locked decisions round 2: "a national treasury
// pools revenue (taxes + trade activity across the whole network) and
// allocates funding to each city"). tick() is this made real: it collects
// TradeResolver's per-tick economic report into the treasury, then
// distributes a share of it to every city weighted by how much
// infrastructure that city is already running - a bigger, more developed
// city draws more national funding, which is the "smaller cities forced
// to serve bigger ones" tension the plan calls for, expressed in money
// rather than just resource flow.
export class NationalBudget {

    constructor () {

        this.treasury = 0;
        this.cityAllocations = new Map(); // cityId -> CityBudget

    }

    registerCity ( cityId ) {

        const budget = new CityBudget( cityId );
        budget.allocation = STARTING_ALLOCATION;
        this.cityAllocations.set( cityId, budget );
        return budget;

    }

    // amount: a RegionState's cities, so weighting can read live facility
    // counts. economicReport: TradeResolver.tick()'s return value.
    tick ( cities, economicReport ) {

        this.treasury += economicReport.totalRevenue;
        this._allocate( cities );

    }

    _allocate ( cities ) {

        const cityList = Array.from( cities.values() );
        if ( cityList.length === 0 ) return;

        const weights = cityList.map( city => {

            const base = Math.max( MIN_ALLOCATION_WEIGHT, city.facilities.size );
            return city.ordinances && city.ordinances.priorityFunding ? base * PRIORITY_FUNDING_MULTIPLIER : base;

        } );
        const totalWeight = weights.reduce( ( sum, w ) => sum + w, 0 );

        const distributable = this.treasury * ALLOCATION_FRACTION;
        this.treasury -= distributable;

        cityList.forEach( ( city, i ) => {

            const budget = this.cityAllocations.get( city.id );
            if ( ! budget ) return;

            budget.allocation += distributable * ( weights[ i ] / totalWeight );

        } );

    }

}
