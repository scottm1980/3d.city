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

}
