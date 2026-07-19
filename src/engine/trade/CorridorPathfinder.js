// Shortest path between two cities over the corridor network (Dijkstra),
// weighted by CorridorEdge.distance. Returns { corridorIds, distance }, or
// null if unreachable (shouldn't happen given the generated network is
// always connected, but callers should still guard).
export function shortestPath ( region, fromCityId, toCityId ) {

    if ( fromCityId === toCityId ) return { corridorIds: [], distance: 0 };

    const adjacency = new Map(); // cityId -> [ { corridor, neighborId } ]

    for ( const corridor of region.corridors.values() ) {

        if ( ! adjacency.has( corridor.cityAId ) ) adjacency.set( corridor.cityAId, [] );
        if ( ! adjacency.has( corridor.cityBId ) ) adjacency.set( corridor.cityBId, [] );

        adjacency.get( corridor.cityAId ).push( { corridor, neighborId: corridor.cityBId } );
        adjacency.get( corridor.cityBId ).push( { corridor, neighborId: corridor.cityAId } );

    }

    const dist = new Map( [ [ fromCityId, 0 ] ] );
    const prevCorridor = new Map();
    const prevCity = new Map();
    const visited = new Set();
    const queue = new Set( region.cities.keys() );

    while ( queue.size > 0 ) {

        let current = null;
        let currentDist = Infinity;

        for ( const cityId of queue ) {

            const d = dist.has( cityId ) ? dist.get( cityId ) : Infinity;
            if ( d < currentDist ) { currentDist = d; current = cityId; }

        }

        if ( current === null ) break; // remaining nodes are unreachable
        queue.delete( current );
        visited.add( current );

        if ( current === toCityId ) break;

        for ( const { corridor, neighborId } of ( adjacency.get( current ) || [] ) ) {

            if ( visited.has( neighborId ) ) continue;

            const candidate = currentDist + corridor.distance;
            const known = dist.has( neighborId ) ? dist.get( neighborId ) : Infinity;

            if ( candidate < known ) {

                dist.set( neighborId, candidate );
                prevCorridor.set( neighborId, corridor );
                prevCity.set( neighborId, current );

            }

        }

    }

    if ( ! dist.has( toCityId ) ) return null;

    const corridorIds = [];
    let cursor = toCityId;

    while ( cursor !== fromCityId ) {

        const corridor = prevCorridor.get( cursor );
        if ( ! corridor ) return null;

        corridorIds.unshift( corridor.id );
        cursor = prevCity.get( cursor );

    }

    return { corridorIds, distance: dist.get( toCityId ) };

}
