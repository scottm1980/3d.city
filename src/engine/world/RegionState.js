import { ResourceRegistry } from '../resources/ResourceType.js';
import { RecipeRegistry } from '../resources/Recipe.js';
import { NationalBudget } from '../budget/NationalBudget.js';

// Top-level container: a country/region made of city nodes connected by
// corridors, plus the registries and ledgers shared across all of them.
export class RegionState {

    constructor ( id, name ) {

        this.id = id;
        this.name = name;

        this.cities = new Map();     // cityId -> CityState
        this.corridors = new Map();  // corridorId -> CorridorEdge

        this.resources = new ResourceRegistry();
        this.recipes = new RecipeRegistry();

        this.nationalBudget = new NationalBudget();

        this.shipments = new Map();  // shipmentId -> Shipment, active + recent for observability

        this.tick = 0;

    }

    addCity ( cityState ) {

        this.cities.set( cityState.id, cityState );
        cityState.budget = this.nationalBudget.registerCity( cityState.id );
        return cityState;

    }

    addCorridor ( corridorEdge ) {

        this.corridors.set( corridorEdge.id, corridorEdge );
        return corridorEdge;

    }

    corridorsFor ( cityId ) {

        return Array.from( this.corridors.values() ).filter( c => c.connects( cityId ) );

    }

    addShipment ( shipment ) {

        this.shipments.set( shipment.id, shipment );
        return shipment;

    }

}
