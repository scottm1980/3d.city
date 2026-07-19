import { SeededRandom } from './SeededRandom.js';
import { CityMapGenerator } from './CityMapGenerator.js';
import { CityState, ControlMode } from '../world/CityState.js';
import { CorridorEdge } from '../world/CorridorEdge.js';
import { DefaultResourceRules } from './DefaultResources.js';
import { hashString } from './mathUtils.js';

function distance ( a, b ) {

    return Math.hypot( a.x - b.x, a.y - b.y );

}

// Minimum spanning tree over node positions (Prim's algorithm) — the
// baseline "minimum infrastructure to connect everything" a country would
// actually build first. O(n^2), fine at draft node counts.
function minimumSpanningTree ( nodes ) {

    const edges = [];
    if ( nodes.length < 2 ) return edges;

    const byId = new Map( nodes.map( n => [ n.id, n ] ) );
    const inTree = new Set( [ nodes[ 0 ].id ] );
    const remaining = new Set( nodes.slice( 1 ).map( n => n.id ) );

    while ( remaining.size > 0 ) {

        let best = null;

        for ( const aId of inTree ) {

            const a = byId.get( aId );

            for ( const bId of remaining ) {

                const d = distance( a, byId.get( bId ) );
                if ( ! best || d < best.distance ) best = { a: aId, b: bId, distance: d };

            }

        }

        edges.push( best );
        inTree.add( best.b );
        remaining.delete( best.b );

    }

    return edges;

}

// Generates a network of independently map-generated city nodes connected
// by corridors — a stylized node network, not one continuous modeled
// terrain (locked decision, see COUNTRY_SIM_ENGINE_PLAN §Locked decisions
// round 2). This is Tier 2's second slice, built on top of the single-city
// CityMapGenerator from the first slice.
export class RegionMapGenerator {

    constructor ( seed, {
        width = 200,
        height = 200,
        nodeCount = 8,
        minSpacing = 40,
        redundancyFactor = 1.4,
        citySize = { width: 48, height: 48 },
        resourceRules = DefaultResourceRules,
    } = {} ) {

        this.seed = seed >>> 0;
        this.width = width;
        this.height = height;
        this.nodeCount = nodeCount;
        this.minSpacing = minSpacing;
        this.redundancyFactor = redundancyFactor;
        this.citySize = citySize;
        this.resourceRules = resourceRules;

    }

    generate ( regionState ) {

        const rng = new SeededRandom( this.seed );
        const positions = this._placeNodes( rng );

        const cities = positions.map( ( position, i ) => this._generateCity( regionState, position, i ) );

        for ( const city of cities ) regionState.addCity( city );

        this._connectCities( regionState, cities );

        return regionState;

    }

    _placeNodes ( rng ) {

        const points = [];
        const maxAttempts = this.nodeCount * 200;
        let attempts = 0;

        while ( points.length < this.nodeCount && attempts < maxAttempts ) {

            attempts ++;

            const candidate = { x: rng.range( 0, this.width ), y: rng.range( 0, this.height ) };
            const farEnough = points.every( p => distance( p, candidate ) >= this.minSpacing );

            if ( farEnough ) points.push( candidate );

        }

        return points; // may be fewer than nodeCount if space/spacing can't fit them all

    }

    _generateCity ( regionState, position, index ) {

        const id = `city-${ index + 1 }`;
        const name = `City ${ index + 1 }`;
        const controlMode = index === 0 ? ControlMode.MANAGED : ControlMode.AUTOMATED; // one starting home city

        const city = new CityState( id, name, {
            width: this.citySize.width,
            height: this.citySize.height,
            controlMode,
            regionPosition: position,
        } );

        const citySeed = this.seed ^ hashString( id );
        new CityMapGenerator( citySeed, { resourceRules: this.resourceRules } ).generate( city );

        return city;

    }

    _connectCities ( regionState, cities ) {

        if ( cities.length < 2 ) return;

        const nodes = cities.map( c => ( { id: c.id, x: c.regionPosition.x, y: c.regionPosition.y } ) );
        const mstEdges = minimumSpanningTree( nodes );
        const connected = new Set( mstEdges.map( e => `${ e.a }|${ e.b }` ) );

        let edgeIndex = 0;
        for ( const edge of mstEdges ) {

            regionState.addCorridor( new CorridorEdge( `corridor-${ ++ edgeIndex }`, edge.a, edge.b, {
                distance: edge.distance,
                capacity: 20,
            } ) );

        }

        // Redundancy pass: connect additional nearby node pairs so the
        // network isn't a single fragile spine.
        const redundancyRadius = this.minSpacing * this.redundancyFactor;

        for ( let i = 0; i < nodes.length; i ++ ) {

            for ( let j = i + 1; j < nodes.length; j ++ ) {

                const key = `${ nodes[ i ].id }|${ nodes[ j ].id }`;
                const reverseKey = `${ nodes[ j ].id }|${ nodes[ i ].id }`;
                if ( connected.has( key ) || connected.has( reverseKey ) ) continue;

                const d = distance( nodes[ i ], nodes[ j ] );
                if ( d > redundancyRadius ) continue;

                regionState.addCorridor( new CorridorEdge( `corridor-${ ++ edgeIndex }`, nodes[ i ].id, nodes[ j ].id, {
                    distance: d,
                    capacity: 20,
                } ) );

                connected.add( key );

            }

        }

    }

}

// Aggregates a city's lots into a dominant-resource summary — for site
// selection UI and, later, automated-city heuristics. Derived from the
// generated map rather than a separate generation step.
export function summarizeResources ( cityState ) {

    const totals = new Map(); // resourceId -> { count, richnessSum }

    for ( const lot of cityState.lots ) {

        if ( ! lot.hasResource ) continue;

        const { resourceId, richness } = lot.resourceEndowment;
        const entry = totals.get( resourceId ) || { count: 0, richnessSum: 0 };
        entry.count ++;
        entry.richnessSum += richness;
        totals.set( resourceId, entry );

    }

    return Array.from( totals.entries() )
        .map( ( [ resourceId, { count, richnessSum } ] ) => ( {
            resourceId,
            tileCount: count,
            averageRichness: richnessSum / count,
        } ) )
        .sort( ( a, b ) => b.tileCount - a.tileCount );

}
