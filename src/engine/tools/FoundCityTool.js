import { CityState, ControlMode } from '../world/CityState.js';
import { CorridorEdge } from '../world/CorridorEdge.js';
import { CityMapGenerator } from '../worldgen/CityMapGenerator.js';
import { DefaultResourceRules } from '../worldgen/DefaultResources.js';

function distance ( a, b ) {

    return Math.hypot( a.x - b.x, a.y - b.y );

}

// Places one additional city node into an existing region network - the
// tool equivalent of RegionMapGenerator's node placement, but for a single
// city at a time against a network that may already have player-managed
// cities in it, so it can't just regenerate the whole layout (no
// equivalent exists in the original tool set - see engine plan Tier 5).
export class FoundCityTool {

    constructor ( {
        minSpacing = 40,
        citySize = { width: 48, height: 48 },
        resourceRules = DefaultResourceRules,
        connectToNearest = 2,
    } = {} ) {

        this.minSpacing = minSpacing;
        this.citySize = citySize;
        this.resourceRules = resourceRules;
        this.connectToNearest = connectToNearest;

    }

    // Returns null if the position is too close to an existing city.
    found ( region, position, { id, name, seed, controlMode = ControlMode.AUTOMATED } ) {

        const tooClose = Array.from( region.cities.values() )
            .some( c => distance( c.regionPosition, position ) < this.minSpacing );

        if ( tooClose ) return null;

        const city = new CityState( id, name, {
            width: this.citySize.width,
            height: this.citySize.height,
            controlMode,
            regionPosition: position,
        } );

        new CityMapGenerator( seed, { resourceRules: this.resourceRules } ).generate( city );
        region.addCity( city );

        this._connectToNetwork( region, city );

        return city;

    }

    _connectToNetwork ( region, newCity ) {

        const others = Array.from( region.cities.values() ).filter( c => c.id !== newCity.id );
        if ( others.length === 0 ) return;

        const ranked = others
            .map( city => ( { city, distance: distance( city.regionPosition, newCity.regionPosition ) } ) )
            .sort( ( a, b ) => a.distance - b.distance )
            .slice( 0, this.connectToNearest );

        let edgeIndex = region.corridors.size;

        for ( const { city, distance: d } of ranked ) {

            edgeIndex ++;
            region.addCorridor( new CorridorEdge( `corridor-founded-${ edgeIndex }`, newCity.id, city.id, { distance: d, capacity: 20 } ) );

        }

    }

}
