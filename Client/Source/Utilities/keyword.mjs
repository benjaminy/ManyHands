/* Top Matter */

import assert from "./assert";

/* \w may not be the right choice here.  It's fine for now, though. */
const regex = /^:\w+(?:(?:\.\w+)*\/\w+)?$/;

export function key( k )
{
    if( typeof( k ) === typeof( Symbol() ) )
    {
        /* could check str.  Worth it??? */
        return k;
    }

    try {
        var name = String( k );
    }
    catch( err ) {
        throw new Error( "keyword.key: String conversion failed: " + k );
    }

    if( !regex.test( k ) )
        throw new Error( "keyword: Invalid format ( " + k + " )" );

    return Symbol.for( k );
}

export function str( k )
{
    try {
        return Symbol.keyFor( k );
    }
    catch( err ) {
        throw new Error( "keyword: Unable to get str for: " + k );
    }
}

export function compare( k1, k2 )
{
    const key1 = key( k1 );
    const key2 = key( k2 );
    if( key1 === key2 )
        return 0;
    const s1 = str( key1 );
    const s2 = str( key2 );
    if( s1 < s2 )
        return -1;
    if( s2 < s1 )
        return 1;
    return 0;
}

console.log( "Utilities/keyword loaded." );
