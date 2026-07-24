// mulberry32 — small, fast, deterministic PRNG for discrete choices
// (node placement, etc.) where ValueNoise2D's continuous fields don't fit.
export class SeededRandom {

    constructor ( seed ) {

        this._state = seed >>> 0;

    }

    next () {

        let t = this._state += 0x6D2B79F5;
        t = Math.imul( t ^ t >>> 15, t | 1 );
        t ^= t + Math.imul( t ^ t >>> 7, t | 61 );
        return ( ( t ^ t >>> 14 ) >>> 0 ) / 4294967296;

    }

    range ( min, max ) {

        return min + this.next() * ( max - min );

    }

}
