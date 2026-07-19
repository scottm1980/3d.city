import { CityBudget } from './CityBudget.js';

// National treasury allocates into per-city budgets rather than cities
// being fully autonomous or a pure pass-through (locked decision, see
// COUNTRY_SIM_ENGINE_PLAN §Locked decisions round 2).
export class NationalBudget {

    constructor () {

        this.treasury = 0;
        this.cityAllocations = new Map(); // cityId -> CityBudget

    }

    registerCity ( cityId ) {

        const budget = new CityBudget( cityId );
        this.cityAllocations.set( cityId, budget );
        return budget;

    }

    allocate ( cityId, amount ) {

        const budget = this.cityAllocations.get( cityId );
        if ( budget ) budget.allocation = amount;
        return budget;

    }

}
