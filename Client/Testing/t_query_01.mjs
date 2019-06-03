/* Top Matter */

import assert  from "../Source/Utilities/assert";
import * as UM from "../Source/Utilities/misc";
import * as K  from "../Source/Utilities/keyword";
import * as Q  from "../Source/Database/query";
import {init_simple_dict} from "../Source/Database/Daniel/data_wrapper.mjs"

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

async function main(){
    return Promise.all([
        test_01_single_select(),
        test_02_double_select(),
        test_03_double_where()
    ])
}

async function test_01_single_select()
{

    const q1 = Q.parseQuery(
        [ Q.findK, "?e",
            Q.whereK, [ "?e", ":age", 42 ] ] );
    const r1 = await Q.runQuery( db, q1 );

    console.log( "FINI?", JSON.stringify( r1 ) );
    assert(r1.length === 2, "Two results should be returned from this query. Found: " + r1.length);
    assert((ethel === r1[0][0] || ethel === r1[1][0])
        && (fred === r1[0][0] || fred === r1[1][0])
        && r1[0][0] !== r1[1][0]);
}

async function test_02_double_select()
{

    const q2 = Q.parseQuery(
        [ Q.findK, "?e", "?age",
            Q.whereK, [ "?e", ":age", "?age" ] ] );

    const r2 = await Q.runQuery( db, q2 );

    console.log( "3x2 array?", JSON.stringify(r2));
    assert(r2.length === 3, "Three results should be returned from this query. Found: " + r2.length);
}

async function test_03_double_where()
{
    const q3 = Q.parseQuery(
        [ Q.findK, "?a", "?l",
            Q.whereK, ["?e", ":age", "?a"], ["?e", ":likes", "?l"]]
    );

    const r3 = await Q.runQuery( db, q3 );

    console.log("Ages and likes paired?", JSON.stringify(r3));
}

main().then(() =>{
    console.log( "t_query_01.mjs tests passed." );
}, (err) => {
    console.error(err);
});
