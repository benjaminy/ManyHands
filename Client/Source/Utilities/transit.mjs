/* Top Matter */

/*
 *
 */

import T from "transit-js";

export function setUnion( s1, ...sets )
{
    for( const s2 of sets )
    {
        for( const thing of s2 )
        {
            s1.add( thing );
        }
    }
    return s1;
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

export function mapAssign( m1, ...maps )
{
    for( const m2 of maps )
    {
        for( const [ key, value ] of m2 )
        {
            m1.set( key, value );
        }
    }
    return m1;
}

export function mapAssignNoOverwrite( m1, ...maps )
{
    for( const m2 of maps )
    {
        for( const [ key, value ] of m2 )
        {
            if( m1.get( key ) === undefined )
            {
                m1.set( key, value );
            }
        }
    }
}
