/*
 * Top Matter
 */

import assert from "assert";
import * as PO from "../Utilities/partial_order"

/*
 * input: two vector timestamps (i.e. objects)
 * output: EQUAL, GREATER, LESS, or INCOMPARABLE
 * note: the input objects must have the same fields
 */
export function compare( ts1, ts2 )
{
    assert( typeof ts1 === "object" );
    assert( typeof ts2 === "object" );
    for( const key in ts2 )
    {
        assert( key in ts1 );
    }

    var so_far = PO.EQUAL;
    for( const key in ts1 )
    {
        assert( key in ts2 );
        const value1 = ts1[ key ];
        const value2 = ts2[ key ];
        assert( value1 === value2 || value1 < value2 || value1 > value2 );
        if( value1 === value2 )
        {
        }
        else if( ( ( value1 < value2 ) && ( so_far === PO.GREATER ) )
                 || ( ( value2 > value1 ) && ( so_far === PO.LESS ) ) )
        {
            return PO.INCOMPARABLE;
        }
        else if( value1 < value2 )
        {
            so_far = PO.LESS;
        }
        else( value1 > value2 )
        {
            so_far = PO.GREATER;
        }
    }
    return so_far;
}

export function max( ts1, ts2 )
{
    assert( typeof ts1 === "object" );
    assert( typeof ts2 === "object" );
    for( const key in ts2 )
    {
        assert( key in ts1 );
    }

    const ts3 = {}
    for( const key in ts1 )
    {
        assert( key in ts2 );
        ts3[ key ] = Math.max( ts1[ key ], ts2[ key ] )
    }
    return ts3;
}
