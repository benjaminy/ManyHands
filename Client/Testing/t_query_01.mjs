/* Top Matter */

import assert  from "../Source/Utilities/assert";
import * as UM from "../Source/Utilities/misc";
import * as K  from "../Source/Utilities/keyword";
import * as Q  from "../Source/Database/query";
import {init_simple_dict} from "../Source/Database/Daniel/data_wrapper.mjs"

const age   = K.key( ":age" );
const likes = K.key( ":likes" );
const annoys = K.key(":annoys");
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
db.add({
    entity: fred,
    attribute: annoys,
    value: ethel
});

async function main(){
    return Promise.all([
        test_01_single_select(),
        test_02_double_select(),
        test_03_double_where(),
        //test_04_double_condition(),
        test_05_references()
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
    const [[a1, l1], [a2, l2], [a3, l3]] = r3.sort((s, o) => s[1].charCodeAt(0) - o[1].charCodeAt(0));
    assert(
        a1 === 21
        && l1 === "opera"
        && a2 === 42
        && l2 === "pizza"
        && a3 === 42
        && l3 === "sushi"
    );
    console.log("SUCCESS: test_03_double_where");
}

/*
TODO: I am unsure how to use these :in parameters, or if that is unsupported so far
 */
async function test_04_double_condition()
{
    const q4 = Q.parseQuery(
        [Q.findK, "?e",
            Q.inK, "$", "?age", "?pizza",
            Q.whereK, ["?e", ":age", "?age"], ["?e", ":likes", "?pizza"]]
    );

    const r4 = await Q.runQuery( db, q4, 42, "pizza" );

    console.log("r4:", r4);

    assert(r4.length === 1 && r4[0][0] === fred);
}

async function test_05_references()
{
    const q5 = Q.parseQuery( // what is the age of people who are annoyed?
        [Q.findK, "?age",
        Q.whereK, ["?a", ":annoys", "?e"], ["?e", ":age", "?age"]] // TODO underbar
    );

    const r5 = await Q.runQuery(db, q5);

    console.log("r5", r5);

    assert(r5.length === 1 && r5[0][0] === 42);
}

main().then(() =>{
    console.log( "t_query_01.mjs tests passed." );
}, (err) => {
    console.error(err);
});
