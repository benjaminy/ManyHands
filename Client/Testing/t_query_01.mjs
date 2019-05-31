/* Top Matter */

import assert  from "../Source/Utilities/assert";
import * as UM from "../Source/Utilities/misc";
import * as K  from "../Source/Utilities/keyword";
import * as Q  from "../Source/Database/query";
import {init_simple_dict} from "../Source/Database/Daniel/data_wrapper.mjs"

const q1 = Q.parseQuery(
    [ Q.findK, "?e",
      Q.whereK, [ "?e", ":age", 42 ] ] );

// console.log("query where clauses: ", q1.where.clauses[0].tuple);

// const q2 = DQ.parseQuery(
//     [ DQ.findK, v("e"),
//       DQ.whereK, [ v("e"), k("age"), 42 ] ] );

console.log( JSON.stringify( q1, UM.tagger, 2 ) );

const age   = K.key( ":age" );
const likes = K.key( ":likes" );
const sally = 12345;
const fred  = 12346;
const ethel = 12347;

const db = init_simple_dict();

db.add({
    entity: sally,
    attribute: age,
    value: 21
});
db.add({
    entity: fred,
    attribute: age,
    value: 42
});
db.add({
    entity: ethel,
    attribute: age,
    value: 42
});
db.add({
    entity: fred,
    attribute: likes,
    value: "pizza"
});
db.add({
    entity: sally,
    attribute: likes,
    value: "opera"
});
db.add({
    entity: ethel,
    attribute: likes,
    value: "sushi"
});

async function main()
{
    const r1 = await Q.runQuery( db, q1 );

    console.log( "FINI?", JSON.stringify( r1 ) );
    assert(r1.length === 2, "Two results should be returned from this query. Found: " + r1.length);
}

main().then(() =>{
    console.log( "t_query_01.mjs tests passed." );
}, (err) => {
    console.error(err);
});
