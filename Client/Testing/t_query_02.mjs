/* Top Matter */

import assert  from "../Source/Utilities/assert";
import * as UM from "../Source/Utilities/misc";
import * as K  from "../Source/Utilities/keyword";
import * as DQ from "../Source/Database/query";
import * as DA from "../Source/Database/attribute";

const q1 = DQ.parseQuery(
    [ DQ.findK, "?e",
      DQ.whereK, [ "?e", ":age", 42 ] ] );

// const q2 = DQ.parseQuery(
//     [ DQ.findK, v("e"),
//       DQ.whereK, [ v("e"), k("age"), 42 ] ] );

console.log( JSON.stringify( q1, UM.tagger, 2 ) );

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

async function main()
{
    const r1 = await DQ.runQuery( db, q1 );

    console.log( "FINI?", JSON.stringify( r1 ) );
}

main();

console.log( "t_query_01.mjs tests passed." );
