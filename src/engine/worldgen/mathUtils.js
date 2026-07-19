export function clamp01 ( value ) {

    return Math.min( 1, Math.max( 0, value ) );

}

// Turns a resource id into a distinct, deterministic noise seed offset so
// each resource gets its own independent placement field.
export function hashString ( str ) {

    let h = 0;

    for ( let i = 0; i < str.length; i ++ ) {

        h = ( Math.imul( 31, h ) + str.charCodeAt( i ) ) | 0;

    }

    return h >>> 0;

}
