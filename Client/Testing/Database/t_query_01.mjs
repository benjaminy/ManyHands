#!/usr/bin/env node --experimental-modules

/* Top Matter */

import assert  from "../../Source/Utilities/assert.mjs";
import * as K  from "../../Source/Utilities/keyword.mjs";
import * as Q  from "../../Source/Database/query.mjs";
import * as A from "../../Source/Database/attribute.mjs";
import {tree_adaptor_wrapper} from "../../Source/Database/txn_tree_adaptor.mjs"
import * as DT from "../../Source/Database/transaction.mjs";
import * as DB from "../../Source/Database/simple_txn_chain.mjs";
import SM from "../../Source/Storage/in_memory.mjs";

import T from "transit-js";

async function test_13_simple_txn()
{
    console.log("*** test_13_simple_txn ***");
    // initialize a new database
    const in_mem_storage = SM();
    const raw_storage = await (await tree_adaptor_wrapper(in_mem_storage))();
    let db = DB.newDB(raw_storage);

    // create the schema
    const name_insert = DT.getAttributeInserts(
        A.createAttribute(
            K.key(":name"),
            A.vtypeString,
            A.cardinalityOne,
            "A person's single, full name."
        )
    );
    const likes_insert = DT.getAttributeInserts(
        A.createAttribute(
            K.key(":likes"),
            A.vtypeRef,
            A.cardinalityMany,
            "The many entities that this entity likes."
        )
    );
    db = await db.commitTxn(db, [...name_insert, ...likes_insert]);

    // insert data
    const statements = [
        [ DT.addK, "bob", K.key(":name"), "Bobethy" ],
        [ DT.addK, "bob", K.key(":likes"), "sandra" ],
        [ DT.addK, "sandra", K.key(":name"), "Sandithan"]];

    db = await db.commitTxn(db, statements);

    // query the data
    const q = Q.parseQuery(
        [Q.findK, "?bobsName",
            Q.inK, "$", "?sandrasname",
            Q.whereK, ["?sandra", K.key(":name"), "?sandrasname"],
                ["?bob", K.key(":likes"), "?sandra"],
                ["?bob", K.key(":name"), "?bobsName"]]
    );
    const r = await Q.runQuery(db, q, "Sandithan");


    console.log("r13", r);
    assert(r.length === 1 && r[0][0] === "Bobethy", "Query returned an unexpected value");
    console.log("*** test_13_simple_txn PASSED ***");

}

async function test_12_attribute_query(){

    console.log("*** test_12_attribute_query ***");
    const q = Q.attrQuery;
    const in_mem_storage = SM();
    let raw_storage = await (await tree_adaptor_wrapper(in_mem_storage))();
    let db = DB.newDB(raw_storage);

    const likes_insert = DT.getAttributeInserts(
        A.createAttribute(
            K.key(":likes"),
            A.vtypeRef,
            A.cardinalityMany,
            "The many entities that this entity likes."
        )
    );

    db = await db.commitTxn(db, likes_insert);

    const r = await Q.runQuery(db, q, K.key(":likes"));
    const expected = [
        1000,
        A.vtypeRef,
        A.cardinalityMany,
        'The many entities that this entity likes.',
        null,
        false,
        false,
        false,
        false
    ];

    console.log("r12:", r);

    assert(r.length === 1, `Length of result set is incorrect (expected 1, found ${r.length})`);
    for(let i = 0; i < expected.length; i++){
        assert(T.equals(expected[i], r[0][i]), "A value was mismatched or wrong");
        //+ ` (expected ${expected[i]}, found ${r[0][i]})`);
    }

    console.log("*** test_12_attribute_query PASSED ***");

}


async function test_11_visualization(){

    console.log("*** test_11_visualization ***");

    const aKey = K.key(":a");
    const bKey = K.key(":b");

    const schema = [...DT.getAttributeInserts(A.createAttribute(
        aKey,
        A.vtypeRef,
        A.cardinalityMany,
        "a"
    )), ...DT.getAttributeInserts(A.createAttribute(
        bKey,
        A.vtypeRef,
        A.cardinalityMany,
        "b"
    ))];

    const in_mem_storage = SM();
    let raw_storage = await (await tree_adaptor_wrapper(in_mem_storage))();
    let db = DB.newDB(raw_storage);

    db = await db.commitTxn(db, schema);

    db = await db.commitTxn(db, [
        [DT.addK, "A", aKey,  "B"],
        [DT.addK, "B", bKey, "C1"],
        [DT.addK, "B", bKey, "C2"]
    ]);

    const q = Q.parseQuery(
        [Q.findK, "?a", "?b", "?c",
            Q.whereK, ["?a", aKey, "?b"],
            ["?b", bKey, "?c"]]
    );

    const r = await Q.runQuery(db, q);

    console.log(r);

    assert(r.length === 2 && r[0].length === 3 && r[1].length === 3,
        `Result set has incorrect length (expecting 2x3, found ${r.length}x${r[0].length})`);
    assert(r[0][0] === r[1][0] && r[0][1] === r[1][1] && r[0][2] !== r[1][2], "Result set is malformed");

    // Expected: [ [ 'A', 'B', 'C2' ], [ 'A', 'B', 'C1' ] ]

    console.log("*** test_11_visualization PASSED ***");

}

async function test_10_simpler_fanout(){
    console.log("*** test_10_simpler_fanout ***");

    const inserts = [];
    for(let name of ["a", "b", "c", "d"]){
        inserts.push(...DT.getAttributeInserts(
            A.createAttribute(
                K.key(":" + name),
                A.vtypeRef,
                A.cardinalityMany,
                name
            )
        ));
    } // instantiate keys a-d

    const in_mem_storage = SM();
    let raw_storage = await (await tree_adaptor_wrapper(in_mem_storage))();
    let db = DB.newDB(raw_storage);

    db = await db.commitTxn(db, inserts); // TODO can we create a schema and add stuff to it
    // in one transaction? (probably not)


    db = await db.commitTxn(db, [
        [DT.addK, "A",    K.key(":a"),    "B1"],
        [DT.addK, "A",    K.key(":a"),    "B2"],
        [DT.addK, "B1",   K.key(":b"),   "C11"],
        [DT.addK, "B1",   K.key(":b"),   "C12"],
        [DT.addK, "B2",   K.key(":b"),   "C21"],
        [DT.addK, "B2",   K.key(":b"),   "C22"],
        [DT.addK, "C11",  K.key(":c"),  "D111"],
        [DT.addK, "C22",  K.key(":c"),  "D221"],
        [DT.addK, "C22",  K.key(":c"),  "D222"],
        [DT.addK, "D111", K.key(":d"), "E1111"],
        [DT.addK, "D222", K.key(":d"), "E2221"],
        [DT.addK, "D222", K.key(":d"), "E2222"]
    ]);

    const q = Q.parseQuery(
        [Q.findK, "?a", "?b", "?c", "?d", "?e",
            Q.whereK, ["?a", K.key(":a"), "?b"],
            ["?b", K.key(":b"), "?c"],
            ["?c", K.key(":c"), "?d"],
            ["?d", K.key(":d"), "?e"]]
    );

    const r = await Q.runQuery(db, q);

    console.log("t10:", r);

    assert(r.length === 3 && r[0].length === 5,
        `Query length returned is incorrect (expected 3x5, found ${r.length}x${r[0].length})`);
    console.log("*** test_10_simpler_fanout PASSED ***");
}

async function timing_test_01_just_records(){
    let size = 16;
    let timing = 0;
    const results = {};
    const attr = K.key(":db/ident"); // builtin, it's easy
    const q = Q.parseQuery([Q.findK, "?entity",
        Q.whereK, ["?entity", attr, "?value"]]);
    while(timing < 2000){
        const rlist = [];
        for(let i = 1000; i-1000 < size; i++){
            rlist.push([i, attr, 1, 12345, false]);
        }
        const raw = await (await tree_adaptor_wrapper(SM()))(rlist);
        const db = DB.newDB(raw);
        let start = (new Date()).getTime();
        const r = await Q.runQuery(db, q);
        let end = (new Date()).getTime();
        timing = end - start;
        console.log(end, start);
        results[size] = timing;
        console.log("Completed one test: ", size, timing)
        size *= 2;
    }
    console.log(results);
}


async function timing(){
    return timing_test_01_just_records();
}

async function main(){
    if(process.argv.length < 3) {
        await test_10_simpler_fanout();
        await test_11_visualization();
        await test_12_attribute_query();
        await test_13_simple_txn();
    } else { // add another argument (doesn't matter what) for timing.
        await timing();
    }
}


main().then(() => {
    console.log("File completed.");
}, err => {
    console.error(err);
});
