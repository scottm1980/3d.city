// Hash-based value noise: deterministic per seed, no pre-allocated grid, so
// it samples at arbitrary coordinates for any map size.
function hash2D ( seed, x, y ) {

    let h = ( seed ^ Math.imul( x | 0, 0x27d4eb2d ) ^ Math.imul( y | 0, 0x165667b1 ) ) >>> 0;
    h = Math.imul( h ^ ( h >>> 15 ), h | 1 );
    h ^= h + Math.imul( h ^ ( h >>> 7 ), h | 61 );
    return ( ( h ^ ( h >>> 14 ) ) >>> 0 ) / 4294967296;

}

function smoothstep ( t ) {

    return t * t * ( 3 - 2 * t );

}

function lerp ( a, b, t ) {

    return a + ( b - a ) * t;

}

export class ValueNoise2D {

    constructor ( seed ) {

        this.seed = seed >>> 0;

    }

    // Single octave, continuous (x, y) -> [0, 1).
    sample ( x, y ) {

        const x0 = Math.floor( x ), y0 = Math.floor( y );
        const x1 = x0 + 1, y1 = y0 + 1;
        const sx = smoothstep( x - x0 );
        const sy = smoothstep( y - y0 );

        const n00 = hash2D( this.seed, x0, y0 );
        const n10 = hash2D( this.seed, x1, y0 );
        const n01 = hash2D( this.seed, x0, y1 );
        const n11 = hash2D( this.seed, x1, y1 );

        const ix0 = lerp( n00, n10, sx );
        const ix1 = lerp( n01, n11, sx );

        return lerp( ix0, ix1, sy );

    }

    // Fractal sum of octaves for more natural-looking fields than raw noise.
    fbm ( x, y, octaves = 4, persistence = 0.5 ) {

        let total = 0, amplitude = 1, maxAmplitude = 0, frequency = 1;

        for ( let i = 0; i < octaves; i ++ ) {

            total += this.sample( x * frequency, y * frequency ) * amplitude;
            maxAmplitude += amplitude;
            amplitude *= persistence;
            frequency *= 2;

        }

        return total / maxAmplitude;

    }

}
