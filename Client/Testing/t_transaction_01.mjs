#!/usr/bin/env node --experimental-modules

/* Top Matter */

import assert from "../Source/Utilities/assert.mjs";
import * as K from "../Source/Utilities/keyword.mjs";
import * as A from "../Source/Database/attribute.mjs";
import * as DT from "../Source/Database/transaction.mjs";
import SM       from "../Source/Storage/in_memory.mjs";

//import {init_simple_dict} from "../Source/Database/Daniel/data_wrapper.mjs";
import {tree_adaptor_wrapper} from "../Source/Database/Daniel/txn_tree_adaptor.mjs";
import * as Q from "../Source/Database/query.mjs";
import * as DB from "../Source/Database/simple_txn_chain.mjs";

// // [ DT.addK, "bob", ":age", 42 ]

async function main() {
    return Promise.all([
        /*test_00_out_of_the_box(),
        test_01_instantiate(),
        test_02_add_datom(),*/
        test_03_get_attribute()//,
        /*test_04_many_statements()*/
    ]);
}

/*
async function test_01_instantiate(){
    const raw_storage = SM( { path_prefix: [ "bob", "misc" ] } );
    const storage = SW.authedPrivateWrapper( {}, raw_storage );
    const db = DB.newDB( storage );
    console.log( db );
// //     ageAttr = DA.makeAttribute(
// //         ":age", DA.vtypeLong, DA.cardinalityOne,
// //         "doc doc doc" );
// //     likesAttr = DA.makeAttribute(
// //         ":likes", DA.vtypeLong, DA.cardinalityOne,
// //         "doc doc doc" );

// //     const ageAddStmt   = DA.makeAddTxnStmt( ageAttr );
// //     const likesAddStmt = DA.makeAddTxnStmt( likesAttr );
// //     //db.add
}

async function test_02_add_datom(){
    const raw_storage = init_simple_dict();

    const db = DB.newDB(raw_storage);

    const statement = [ DT.addK, "bob", ":age", 42 ];

    const res = await db.commitTxn(db, [statement]);

    console.log(res);
}

*/

async function setup(){
    const raw_storage = await tree_adaptor_wrapper(SM())();
    const like_insert = DT.insertAttribute(
        A.makeAttribute(
            ":likes",
            undefined,
            A.vtypeRef,
            A.cardinalityMany,
            "Contains references to other entities this entity likes."
        )
    );
    const name_insert = DT.insertAttribute(
        A.makeAttribute(
            ":name",
            undefined,
            A.vtypeString,
            A.cardinalityOne,
            "A person's single, full name"
        )
    );
    let db = DB.newDB(raw_storage);
    db = await db.commitTxn(db, [...like_insert, ...name_insert]);
    console.log(db);
    console.log("Setup completed");
    return db;
}

async function test_03_get_attribute(){
    let db = await setup();
    const statement = [ DT.addK, "bob", K.key(":name"), "Bobethy" ];
    db = await db.commitTxn(db, [statement]);

    const checkQuery = Q.parseQuery(
        [Q.findK, "?a", "?name",
            Q.whereK, ["?a", K.key(":name"), "?name"]]
    );

    const r = await Q.runQuery(db, checkQuery);

    assert(r.length === 1 && r[0][1] === "Bobethy", "Attribute was not filled in correctly.");
    console.log("test_03_get_attribute completed successfully");
}

async function test_04_many_statements(){
    let db = await setup();
    const likes = K.key(":likes");
    const name = K.key(":name");
    const statements = [
        [ DT.addK, "mary", name, "Marticia"],
        [ DT.addK, "susan", name, "Suzard"],
        [ DT.addK, "mary", likes, "susan" ] ];
    db = await db.commitTxn(db, statements);
    const checkQuery = Q.parseQuery(
        [Q.findK, "?a", "?name",
            Q.whereK, ["?a", likes, "?b"],
            ["?a", name, "?name"],
            ["?b", name, "Suzard"]]
    );

    const r = await Q.runQuery(db, checkQuery);

    assert(r.length === 1, `Query failed to retrieve a record (found: ${r}).`);
    assert(r[0][1] === "Marticia", "Query returned invalid or incorrect result.");
    console.log("test_04_many_statements completed successfully");
}

async function test_00_out_of_the_box(){
    let raw = await tree_adaptor_wrapper(SM())([{
        entity: 1,
        attribute: 2,
        value: 3,
        timestamp: 4,
        revoked: 5}]);
    console.log(raw.find());
    let db = DB.newDB(raw);
    db = await db.commitTxn(db, [[ DT.addK, "mary", K.key(":db/ident"), "Marticia"]]);
    console.log(db.find());
}

main().then(() => {
    console.log("Reached end of t_transaction_01.mjs");
}, err => {
    console.error(err);
});
