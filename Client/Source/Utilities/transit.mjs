/* Top Matter */

/*
 *
 */

import T from "transit-js";

export function setUnionModify( s1, s2 )
{
    for( const thing of s2 )
    {
        s1.add( thing );
    }
}

export function setUnionNew( s1, s2 )
{
    const s = T.set();
    setUnionModify( s, s1 );
    setUnionModify( s, s2 );
    return s;
}

export function mapFromTuples( tuples )
{
    const m = T.map();
    for( const [ k, v ] of tuples )
    {
        m.set( k, v );
    }
    return m;
}
