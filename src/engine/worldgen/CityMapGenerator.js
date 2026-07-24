import { ValueNoise2D } from './ValueNoise.js';
import { classifyTerrain } from './Terrain.js';
import { ResourceEndowment } from '../world/ResourceEndowment.js';
import { DefaultResourceRules } from './DefaultResources.js';
import { clamp01, hashString } from './mathUtils.js';

// Generates terrain and resource endowment for a single CityState's lot
// grid. Deterministic per seed. Resource placement reads real geography
// (terrain-gated, clustered into belts via each resource's own noise
// field) rather than rolling a resource independently per tile.
export class CityMapGenerator {

    constructor ( seed, { resourceRules = DefaultResourceRules, baseFrequency = 4 } = {} ) {

        this.seed = seed >>> 0;
        this.resourceRules = resourceRules;
        this.baseFrequency = baseFrequency;

        this.elevationField = new ValueNoise2D( this.seed );
        this.moistureField = new ValueNoise2D( this.seed ^ 0x9e3779b9 );

        this.resourceFields = new Map();
        for ( const rule of resourceRules ) {

            this.resourceFields.set( rule.resourceId, new ValueNoise2D( this.seed ^ hashString( rule.resourceId ) ) );

        }

    }

    generate ( cityState ) {

        for ( const lot of cityState.lots ) {

            const nx = lot.x / cityState.width;
            const ny = lot.y / cityState.height;

            const elevation = this.elevationField.fbm( nx * this.baseFrequency, ny * this.baseFrequency, 4 );
            const moisture = this.moistureField.fbm( nx * this.baseFrequency, ny * this.baseFrequency, 3 );

            lot.terrain = classifyTerrain( elevation, moisture );
            lot.resourceEndowment = this._rollResource( lot, nx, ny );

        }

        return cityState;

    }

    _rollResource ( lot, nx, ny ) {

        for ( const rule of this.resourceRules ) {

            if ( rule.terrain !== lot.terrain ) continue;

            const field = this.resourceFields.get( rule.resourceId );
            const value = field.fbm( nx / rule.frequency, ny / rule.frequency, 2 );

            if ( value < rule.threshold ) continue;

            const richness = clamp01( ( value - rule.threshold ) / ( 1 - rule.threshold ) );
            return new ResourceEndowment( rule.resourceId, Math.max( 0.2, richness ) );

        }

        return null;

    }

}
