export class CityBudget {

    constructor ( cityId ) {

        this.cityId = cityId;

        this.allocation = 0;     // funds granted by the national budget this period
        this.localRevenue = 0;   // any local levers a city retains (open question, see plan doc)

        this.spend = new Map();  // category -> amount

    }

    get totalFunds () {

        return this.allocation + this.localRevenue;

    }

    // Called by ZoneResolver.developLot() when a recipe with a buildCost
    // actually resolves - the spend side of the affordability gate in
    // resolve(). Tracked by category (Recipe.facilityArchetype) so a
    // future budget UI can show where a city's allocation actually went,
    // not just the running total.
    spendOn ( category, amount ) {

        this.allocation -= amount;
        this.spend.set( category, ( this.spend.get( category ) || 0 ) + amount );

    }

}
