export const TerrainType = Object.freeze( {
    WATER: 'water',
    PLAINS: 'plains',
    FOREST: 'forest',
    HILLS: 'hills',
    MOUNTAIN: 'mountain',
    DESERT: 'desert',
} );

// elevation and moisture are both [0, 1) fbm samples.
export function classifyTerrain ( elevation, moisture ) {

    if ( elevation < 0.32 ) return TerrainType.WATER;
    if ( elevation > 0.78 ) return TerrainType.MOUNTAIN;
    if ( elevation > 0.6 ) return TerrainType.HILLS;
    if ( moisture < 0.3 ) return TerrainType.DESERT;
    if ( moisture > 0.6 ) return TerrainType.FOREST;
    return TerrainType.PLAINS;

}
