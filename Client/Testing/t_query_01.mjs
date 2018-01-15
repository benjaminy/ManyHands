/* Top Matter */

import assert from "../Source/Utilities/assert";
import * as K from "../Source/Utilities/keyword";
import * as Q from "../Source/Database/query";

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


const q1 = Q.parseQuery(
    [ Q.findK, "?e",
      Q.whereK, [ "?e", ":age", 42 ] ] );

// const q2 = DQ.parseQuery(
//     [ DQ.findK, v("e"),
//       DQ.whereK, [ v("e"), k("age"), 42 ] ] );

console.log( JSON.stringify( q1, tagger, 2 ) );

const age   = K.key( ":age" );
const likes = K.key( ":likes" );
const sally = 12345;
const fred  = 12346;
const ethel = 12347;

const db = {};
db.datoms = [
    [ sally, age, 21 ],
    [ fred,  age, 42 ],
    [ ethel, age, 42 ],
    [ fred,  likes, "pizza" ],
    [ sally, likes, "opera" ],
    [ ethel, likes, "sushi" ] ];

const r1 = Q.runQuery( db, q1 );

console.log( JSON.stringify( r1 ) );

console.log( "t_query_01.mjs tests passed." );
