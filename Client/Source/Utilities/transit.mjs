/* Top Matter */

/*
 *
 */

import T from "transit-js";

export function shallowCopyMap( thing )
{
    const m = T.map();
    for( const [ k, v ] of thing )
    {
        m.set( k, v );
    }
    return m;
}
