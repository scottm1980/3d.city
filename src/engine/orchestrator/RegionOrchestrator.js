import { TradeResolver, availableResourceIds } from '../trade/TradeResolver.js';
import { ShipmentState } from '../trade/Shipment.js';
import { ZoneResolver, geographicResourceIds } from '../resolution/ZoneResolver.js';
import { ZoningTool } from '../tools/ZoningTool.js';
import { TownCharterTool, DefaultTownCharter } from '../tools/TownCharterTool.js';
import { SeededRandom } from '../worldgen/SeededRandom.js';
import { DefaultResourceRules } from '../worldgen/DefaultResources.js';
import { ControlMode } from '../world/CityState.js';
import { TickMessageType, tickMessage } from '../messages/TickMessages.js';

function cityPhaseOffset ( cityId, modulus ) {

    let h = 0;
    for ( let i = 0; i < cityId.length; i ++ ) h = ( h * 31 + cityId.charCodeAt( i ) ) >>> 0;
    return h % modulus;

}

// Replaces CityGame.js's single-city assumption: one orchestrator drives
// every city in a RegionState each tick, at fidelity that follows control
// mode rather than city count (COUNTRY_SIM_ENGINE_PLAN, Tier 7).
//
// This is the engine-side half of Tier 7 only. It runs TradeResolver,
// sweeps every city for newly-resolvable lots, and grows automated cities
// via TownCharterTool - all verified headlessly, same as Tiers 1-6. It does
// not move a single pixel or vehicle: wiring TradeResolver's Shipments into
// the real src/traffic vehicle system and src/city3d rendering (replacing
// CityGame.js/WorkerBridge.js for real) is a separate follow-on that needs
// an actual browser/dev-server pass to verify, which this headless layer
// can't provide.
export class RegionOrchestrator {

    constructor ( region, {
        seed = 1,
        automatedTickInterval = 3,    // automated cities grow every Nth tick, not every tick - the real fidelity knob today, see Tier 1's control-mode note
        maxLotsPerAutomatedTick = 5,
        charterFor = () => DefaultTownCharter,
        resourceRules = DefaultResourceRules,
    } = {} ) {

        this.region = region;
        this.trade = new TradeResolver( region );
        this.resolver = new ZoneResolver( region.recipes, geographicResourceIds( resourceRules ) );
        this.zoningTool = new ZoningTool( this.resolver );
        this.charterTool = new TownCharterTool( this.resolver );
        this.rng = new SeededRandom( seed );

        this.automatedTickInterval = automatedTickInterval;
        this.maxLotsPerAutomatedTick = maxLotsPerAutomatedTick;
        this.charterFor = charterFor;

        this.orchestratorTick = 0;

    }

    // Player-driven zoning on a managed city goes through this.zoningTool
    // directly (e.g. orchestrator.zoningTool.zone(...)) - the orchestrator
    // never auto-zones a managed city, only automated ones via the charter.
    tick () {

        this.orchestratorTick ++;

        this.trade.tick();
        const available = availableResourceIds( this.region );

        const newlyDeveloped = [];
        const automatedCitiesProcessed = [];

        for ( const city of this.region.cities.values() ) {

            // Every city, regardless of control mode, gets a chance to
            // resolve lots that were blocked before but can resolve now -
            // this isn't a control decision, it's just catching up
            // (ZoningTool.reattempt is deliberately control-mode agnostic).
            const reattempted = this.zoningTool.reattempt( city, available );
            for ( const facility of reattempted ) {

                newlyDeveloped.push( { cityId: city.id, facilityId: facility.id, archetypeId: facility.archetypeId } );

            }

            if ( city.controlMode !== ControlMode.AUTOMATED ) continue;

            const phase = cityPhaseOffset( city.id, this.automatedTickInterval );
            const dueForGrowth = ( this.orchestratorTick + phase ) % this.automatedTickInterval === 0;
            if ( ! dueForGrowth ) continue;

            automatedCitiesProcessed.push( city.id );

            const charter = this.charterFor( city );
            const grown = this.charterTool.apply( city, charter, available, this.rng, this.maxLotsPerAutomatedTick );
            for ( const facility of grown ) {

                newlyDeveloped.push( { cityId: city.id, facilityId: facility.id, archetypeId: facility.archetypeId } );

            }

        }

        const activeShipments = Array.from( this.region.shipments.values() )
            .filter( s => s.state === ShipmentState.IN_TRANSIT ).length;

        return tickMessage( TickMessageType.REGION_TICK, {
            tick: this.region.tick,
            newlyDeveloped,
            automatedCitiesProcessed,
            activeShipments,
        } );

    }

}
