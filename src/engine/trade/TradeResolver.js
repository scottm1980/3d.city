import { Shipment, ShipmentState } from './Shipment.js';
import { FacilityStatus } from '../world/Facility.js';
import { shortestPath } from './CorridorPathfinder.js';

const BUFFER_TICKS = 3;      // how many ticks of input stock a facility tries to keep buffered
const TRANSPORT_SPEED = 4;   // distance covered per tick
const SAME_CITY_DISTANCE = 1; // no corridor needed; still takes >=1 tick to arrive
const TRADE_TARIFF_PER_UNIT = 0.2; // per unit delivered, collected into NationalBudget's treasury alongside production tax - "revenue... + trade activity" per COUNTRY_SIM_ENGINE_PLAN's locked budget decision

// Matches regional supply and demand per commodity, generates Shipments,
// and advances them to delivery. This is the piece that makes automated
// trade real rather than a stat: quantities move through actual corridor
// capacity over actual distance, so a congested route is a visible,
// diagnosable bottleneck (see COUNTRY_SIM_ENGINE_PLAN §Tier 4).
//
// Note: facility.archetypeId is looked up directly against the recipe
// registry - default content keys facilityArchetype === recipe id (see
// resolution/DefaultRecipes.js). That's a convention, not an invariant
// enforced elsewhere yet.
export class TradeResolver {

    constructor ( region ) {

        this.region = region;

    }

    // Returns this tick's economic activity - production tax on everything
    // produced plus a trade tariff on everything delivered - for
    // NationalBudget to collect into the treasury. TradeResolver computes
    // it because it's already the one place tracking both quantities; it
    // doesn't otherwise know or care about money.
    tick () {

        this.region.tick ++;

        const productionRevenue = this._produceAndConsume();
        const tradeRevenue = this._advanceShipments();
        this._matchNewShipments();

        return { productionRevenue, tradeRevenue, totalRevenue: productionRevenue + tradeRevenue };

    }

    _recipeFor ( facility ) {

        return this.region.recipes.get( facility.archetypeId );

    }

    _produceAndConsume () {

        let productionRevenue = 0;

        for ( const city of this.region.cities.values() ) {

            for ( const facility of city.facilities.values() ) {

                const recipe = this._recipeFor( facility );
                if ( ! recipe ) continue;

                const canProduce = recipe.inputs.every( input => ( facility.inputStock.get( input.resourceId ) || 0 ) >= input.quantity );

                if ( recipe.inputs.length > 0 && ! canProduce ) {

                    facility.status = FacilityStatus.STALLED;
                    continue;

                }

                let multiplier = recipe.throughputPerTick;
                if ( recipe.isExtraction && facility.lot.resourceEndowment ) multiplier *= facility.lot.resourceEndowment.richness;

                for ( const input of recipe.inputs ) {

                    facility.inputStock.set( input.resourceId, ( facility.inputStock.get( input.resourceId ) || 0 ) - input.quantity );

                }

                for ( const output of recipe.outputs ) {

                    const amount = output.quantity * multiplier;
                    facility.outputStock.set( output.resourceId, ( facility.outputStock.get( output.resourceId ) || 0 ) + amount );
                    productionRevenue += amount * recipe.taxRatePerOutputUnit;

                }

                facility.status = FacilityStatus.ACTIVE;

            }

        }

        return productionRevenue;

    }

    _advanceShipments () {

        let tradeRevenue = 0;

        for ( const shipment of this.region.shipments.values() ) {

            if ( shipment.state !== ShipmentState.IN_TRANSIT ) continue;

            shipment.progress = Math.min( 1, shipment.progress + TRANSPORT_SPEED / shipment.distance );

            if ( shipment.progress >= 1 ) {

                const destination = this._findFacility( shipment.destinationFacilityId );

                if ( destination ) {

                    destination.inputStock.set(
                        shipment.commodityId,
                        ( destination.inputStock.get( shipment.commodityId ) || 0 ) + shipment.quantity,
                    );

                }

                shipment.setState( ShipmentState.DELIVERED, this.region.tick );
                tradeRevenue += shipment.quantity * TRADE_TARIFF_PER_UNIT;

            }

        }

        return tradeRevenue;

    }

    _findFacility ( facilityId ) {

        for ( const city of this.region.cities.values() ) {

            const facility = city.facilities.get( facilityId );
            if ( facility ) return facility;

        }

        return null;

    }

    _matchNewShipments () {

        // How much of each corridor's capacity is already spoken for by
        // in-flight shipments, before this tick allocates anything new.
        const reserved = new Map();
        for ( const corridor of this.region.corridors.values() ) reserved.set( corridor.id, 0 );

        for ( const shipment of this.region.shipments.values() ) {

            if ( shipment.state !== ShipmentState.IN_TRANSIT ) continue;

            for ( const corridorId of shipment.path ) {

                reserved.set( corridorId, ( reserved.get( corridorId ) || 0 ) + shipment.quantity );

            }

        }

        const demands = this._collectDemand();
        const supplies = this._collectSupply();

        for ( const demand of demands ) {

            let remainingNeed = demand.shortfall;
            if ( remainingNeed <= 0 ) continue;

            const candidates = supplies
                .filter( s => s.resourceId === demand.resourceId && s.available > 0 )
                .map( supply => {

                    const route = shortestPath( this.region, supply.cityId, demand.cityId );
                    return route ? { supply, route } : null;

                } )
                .filter( Boolean )
                .sort( ( a, b ) => a.route.distance - b.route.distance );

            for ( const candidate of candidates ) {

                if ( remainingNeed <= 0 ) break;

                const { supply, route } = candidate;
                if ( supply.available <= 0 ) continue;

                let quantity = Math.min( remainingNeed, supply.available );

                for ( const corridorId of route.corridorIds ) {

                    const corridor = this.region.corridors.get( corridorId );
                    const used = reserved.get( corridorId ) || 0;
                    const room = Math.max( 0, corridor.capacity - used );
                    quantity = Math.min( quantity, room );

                }

                if ( quantity <= 0 ) continue;

                const distance = route.corridorIds.length === 0 ? SAME_CITY_DISTANCE : route.distance;

                const shipment = new Shipment( {
                    commodityId: demand.resourceId,
                    quantity,
                    originFacilityId: supply.facility.id,
                    destinationFacilityId: demand.facility.id,
                    path: route.corridorIds,
                    distance,
                } );
                shipment.setState( ShipmentState.IN_TRANSIT, this.region.tick );

                this.region.addShipment( shipment );

                supply.facility.outputStock.set( demand.resourceId, ( supply.facility.outputStock.get( demand.resourceId ) || 0 ) - quantity );
                supply.available -= quantity;
                remainingNeed -= quantity;

                for ( const corridorId of route.corridorIds ) {

                    reserved.set( corridorId, ( reserved.get( corridorId ) || 0 ) + quantity );

                }

            }

        }

        // `reserved` already tracks exactly this - every corridor's
        // in-flight quantity, including the shipments just matched above -
        // so writing it back is the whole fix. Without this, CorridorEdge's
        // own `load` field (documented in world/CorridorEdge.js as "owned
        // by the Tier 4 trade resolver") stayed permanently 0, and anything
        // reading it for congestion visualization (e.g.
        // dev_engine_region.html's corridor coloring/thickening) was
        // silently rendering every corridor as empty regardless of actual
        // traffic - exactly the "visible, diagnosable bottleneck" this
        // module's own top-of-file comment says is the point.
        for ( const corridor of this.region.corridors.values() ) corridor.load = reserved.get( corridor.id ) || 0;

    }

    _collectDemand () {

        const demands = [];

        for ( const city of this.region.cities.values() ) {

            for ( const facility of city.facilities.values() ) {

                const recipe = this._recipeFor( facility );
                if ( ! recipe ) continue;

                for ( const input of recipe.inputs ) {

                    const target = input.quantity * recipe.throughputPerTick * BUFFER_TICKS;
                    const current = facility.inputStock.get( input.resourceId ) || 0;
                    const shortfall = target - current;

                    if ( shortfall > 0 ) demands.push( { facility, cityId: city.id, resourceId: input.resourceId, shortfall } );

                }

            }

        }

        return demands;

    }

    _collectSupply () {

        const supplies = [];

        for ( const city of this.region.cities.values() ) {

            for ( const facility of city.facilities.values() ) {

                for ( const [ resourceId, quantity ] of facility.outputStock.entries() ) {

                    if ( quantity > 0 ) supplies.push( { facility, cityId: city.id, resourceId, available: quantity } );

                }

            }

        }

        return supplies;

    }

}

// What Tier 3's ZoneResolver treats as "obtainable" - anything currently
// being produced anywhere in the region. The corridor network is always
// fully connected (Tier 2's generator guarantees it), so this is
// region-wide rather than reachability-limited per city; real scarcity is
// still enforced downstream by corridor capacity in _matchNewShipments.
export function availableResourceIds ( region ) {

    const ids = new Set();

    for ( const city of region.cities.values() ) {

        for ( const facility of city.facilities.values() ) {

            for ( const [ resourceId, quantity ] of facility.outputStock.entries() ) {

                if ( quantity > 0 ) ids.add( resourceId );

            }

        }

    }

    return ids;

}
