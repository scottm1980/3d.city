// A RecipeLine is reused for both inputs and outputs: a resource + quantity.
export class RecipeLine {

    constructor ( resourceId, quantity ) {

        this.resourceId = resourceId;
        this.quantity = quantity;

    }

}

export class Recipe {

    constructor ( id, { inputs = [], outputs = [], facilityArchetype, requiredZoneType, throughputPerTick = 1, footprintSize = 1, buildCost = 0, taxRatePerOutputUnit = 0 } = {} ) {

        this.id = id;

        this.inputs = inputs;                       // RecipeLine[], empty for raw extraction
        this.outputs = outputs;                      // RecipeLine[]

        this.facilityArchetype = facilityArchetype;   // resolved Facility.archetypeId
        this.requiredZoneType = requiredZoneType;      // ZoneType this recipe is eligible on
        this.throughputPerTick = throughputPerTick;
        this.footprintSize = footprintSize;             // side length of the square lot area this facility occupies, centered on the anchor lot
        this.buildCost = buildCost;                     // spent from the developing city's budget on resolution - see ZoneResolver.resolve()'s affordability gate
        this.taxRatePerOutputUnit = taxRatePerOutputUnit; // per unit produced each tick, collected into NationalBudget's treasury - see TradeResolver

    }

    get isExtraction () {

        return this.inputs.length === 0;

    }

}

export class RecipeRegistry {

    constructor () {

        this._recipes = new Map();

    }

    register ( recipe ) {

        this._recipes.set( recipe.id, recipe );
        return recipe;

    }

    get ( id ) {

        return this._recipes.get( id ) || null;

    }

    all () {

        return Array.from( this._recipes.values() );

    }

}
