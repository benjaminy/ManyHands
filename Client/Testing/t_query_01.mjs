/* Top Matter */

import { assert }  from "../Source/Utilities/assert";
import * as DQ from "../Source/Database/query";

const q1 = DQ.parseQuery(
    [ ":find", "?e",
      ":where", [ "?e", ":age", 42 ] ] );

function tagger( k, v )
{
    if( typeof( v ) === "symbol" )
    {
        const x = Symbol.keyFor( v );
        if( typeof( x ) === "string" )
            return x;
        else
            return String( v );
    }
    else
    {
        return v;
    }
}

console.log( JSON.stringify( q1, tagger, 2 ) );

// const q2 = DQ.parseQuery(
//     [ DQ.findK, v("e"),
//       DQ.whereK, [ v("e"), k("age"), 42 ] ] );

console.log( "t_query_01.mjs tests passed." );
