import { FacilityStatus } from '../world/Facility.js';

const DEFAULT_DURATION = 20; // ticks

// A trade-sim-appropriate "disaster": not a Micropolis fire/flood/monster
// reskin, but a real disruption to the trade network with genuinely
// traceable ripple effects (see COUNTRY_SIM_ENGINE_PLAN's "fully traceable
// trade" pillar) - powers the Disaster panel (see the Hub redesign in
// RENDERER_INTEGRATION_FINDINGS.md). Two kinds, both time-bounded and both
// mechanically real (TradeResolver actually reads the fields this sets):
//
// - a supply shock: one facility stops producing for K ticks
//   (Facility.disruptedUntilTick), which starves everything downstream of
//   it exactly like a real production halt would - watch a dependent
//   facility go STALLED for missing input.
// - a transport disruption: one corridor's usable capacity drops for K
//   ticks (CorridorEdge.disruptedUntilTick/disruptionCapacityFactor),
//   which forces TradeResolver's shipment matching to route around it (if
//   an alternate path exists) or simply fail to move enough - watch
//   corridor.load actually drop and downstream facilities stall.
export class DisruptionTool {

    constructor ( { defaultDuration = DEFAULT_DURATION } = {} ) {

        this.defaultDuration = defaultDuration;

    }

    disruptFacility ( region, facility, { duration = this.defaultDuration } = {} ) {

        facility.disruptedUntilTick = region.tick + duration;
        facility.status = FacilityStatus.STALLED;
        return facility.disruptedUntilTick;

    }

    // capacityFactor: fraction of normal capacity left usable while
    // disrupted - 0 (default) fully severs the corridor, e.g. 0.25 models
    // a partial washout instead of a total blockage.
    disruptCorridor ( region, corridor, { duration = this.defaultDuration, capacityFactor = 0 } = {} ) {

        corridor.disruptedUntilTick = region.tick + duration;
        corridor.disruptionCapacityFactor = capacityFactor;
        return corridor.disruptedUntilTick;

    }

    // Every currently-active disruption in the region, for Hub display -
    // computed fresh each call from live state (disruptedUntilTick vs.
    // region.tick), never a separately-tracked list that could drift out
    // of sync with the fields TradeResolver actually reads.
    activeDisruptions ( region ) {

        const facilities = [];
        const corridors = [];

        for ( const city of region.cities.values() ) {

            for ( const facility of city.facilities.values() ) {

                if ( facility.disruptedUntilTick !== null && region.tick < facility.disruptedUntilTick ) {

                    facilities.push( { facility, city, ticksRemaining: facility.disruptedUntilTick - region.tick } );

                }

            }

        }

        for ( const corridor of region.corridors.values() ) {

            if ( corridor.disruptedUntilTick !== null && region.tick < corridor.disruptedUntilTick ) {

                corridors.push( { corridor, ticksRemaining: corridor.disruptedUntilTick - region.tick } );

            }

        }

        return { facilities, corridors };

    }

}
