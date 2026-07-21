import { ZoneType } from '../world/ZoneType.js';
import { ShipmentState } from '../trade/Shipment.js';

// Tier 7+ observability: real milestones derived from live region state,
// powering the Awards panel (see the Hub redesign in
// RENDERER_INTEGRATION_FINDINGS.md) instead of Micropolis' city-class/
// score achievements, which are meaningless against src/engine's model
// (no population, no land value). Every definition below checks something
// the engine already tracks for real reasons (trade, budget, growth) -
// nothing here is invented display data.
//
// "Founder" is relative to the region's city count at tracker construction
// time, not an absolute count, so starting a session with N pre-placed
// cities doesn't retroactively unlock it - only a city founded *after* the
// tracker starts watching (i.e. via FoundCityTool during play) counts.
const DEFINITIONS = [
    {
        id: 'first_trade',
        title: 'First Trade',
        description: 'A shipment was delivered somewhere in the region.',
        check: ( region ) => Array.from( region.shipments.values() ).some( s => s.state === ShipmentState.DELIVERED ),
    },
    {
        id: 'growing_town',
        title: 'Growing Town',
        description: 'A city reached 10 facilities.',
        check: ( region ) => Array.from( region.cities.values() ).some( city => city.facilities.size >= 10 ),
    },
    {
        id: 'industrial_powerhouse',
        title: 'Industrial Powerhouse',
        description: 'A city reached 5 industrial facilities.',
        check: ( region ) => Array.from( region.cities.values() ).some( city => Array.from( city.facilities.values() )
            .filter( f => f.lot.zoneType === ZoneType.INDUSTRIAL ).length >= 5 ),
    },
    {
        id: 'treasury_milestone',
        title: 'Treasury Milestone',
        description: 'The national treasury reached $1000.',
        check: ( region ) => region.nationalBudget.treasury >= 1000,
    },
    {
        id: 'founder',
        title: 'Founder',
        description: 'A new city was founded.',
        // set on start(); see class-level comment above.
        check: ( region, tracker ) => region.cities.size > tracker._initialCityCount,
    },
];

export class AchievementTracker {

    constructor ( region ) {

        this._initialCityCount = region.cities.size;

        this.achievements = new Map(); // id -> { title, description, unlocked, unlockedTick }
        for ( const def of DEFINITIONS ) {

            this.achievements.set( def.id, {
                title: def.title,
                description: def.description,
                unlocked: false,
                unlockedTick: null,
            } );

        }

    }

    // Call once per tick (or on whatever cadence the caller likes) -
    // already-unlocked achievements are skipped, so calling this often is
    // always safe and cheap.
    check ( region ) {

        for ( const def of DEFINITIONS ) {

            const entry = this.achievements.get( def.id );
            if ( entry.unlocked ) continue;

            if ( def.check( region, this ) ) {

                entry.unlocked = true;
                entry.unlockedTick = region.tick;

            }

        }

    }

    all () {

        return Array.from( this.achievements.entries() ).map( ( [ id, entry ] ) => ( { id, ...entry } ) );

    }

    unlockedCount () {

        return this.all().filter( a => a.unlocked ).length;

    }

}
