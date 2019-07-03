#!/usr/bin/env node --experimental-modules

/* Top Matter */

import assert from "../../Source/Utilities/assert.mjs";
import * as K from "../../Source/Utilities/keyword.mjs";
import * as A from "../../Source/Database/attribute.mjs";
import * as DT from "../../Source/Database/transaction.mjs";
import SM       from "../../Source/Storage/in_memory.mjs";
import * as SC from "../../Source/Storage/common.mjs";
import * as ST from "../../Source/Storage/tree.mjs";

import * as TW from "../../Source/Database/txn_tree_adaptor.mjs";
import * as Q from "../../Source/Database/query.mjs";
import * as DB from "../../Source/Database/simple_txn_chain.mjs";

import T from "transit-js";

// // [ DT.addK, "bob", ":age", 42 ]

async function main() {
    //return Promise.all([
        //await test_01_add_datom();
        await test_02_get_attribute();
        //await test_03_many_statements()
    //]);
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

    const res = await DB.commitTxn(db, [statement]);

    console.log(res);
}

*/

function new_plain_root()
{
    const in_mem_storage = SM();
    const options = T.map();
    options.set( SC.PATH_PREFIX, [ "demo_app2" ] );
    options.set( SC.ENCODE_OBJ, SC.ENCODE_TRANSIT );
    const root = ST.newRoot( [ "root" ], in_mem_storage, options );
    return [ root, () => { return ST.openRoot( [ "root" ], in_mem_storage, options ) } ];
}

async function setup(){
    const [ root, retrieve_root ] = new_plain_root();
    const like_insert = DT.getAttributeInserts(
        A.createAttribute(
            ":likes",
            A.vtypeRef,
            A.cardinalityMany,
            "Contains references to other entities this entity likes."
        )
    );
    const name_insert = DT.getAttributeInserts(
        A.createAttribute(
            ":name",
            A.vtypeString,
            A.cardinalityOne,
            "A person's single, full name"
        )
    );
    let db = DB.newDB( );
    db = await DB.commitTxn( db, [ ...like_insert, ...name_insert ] );

    ST.setChild( root, "the database", db.node );
    const r2 = await ST.writeTree( root );    
    const r3 = await retrieve_root();
    const retrieved_raw = await ST.getChild( r3, "the database" );
    const retrieved_db = DB.wrapDB( retrieved_raw );
    return [ retrieved_db, retrieve_root ];
}

async function test_02_get_attribute(){
    let [ db, retrieve_root ] = await setup();
    const statement = [ DT.addK, "bob", K.key( ":name" ), "Bobethy" ];
    db = await DB.commitTxn(db, [statement]);

    const checkQuery = Q.parseQuery(
        [ Q.findK, "?a", "?name",
            Q.whereK, [ "?a", K.key( ":name" ), "?name" ] ]
    );

    const r = await Q.runQuery( db, checkQuery );

    assert( r.length === 1 && r[0][1] === "Bobethy", "Attribute was not filled in correctly." );
    console.log("test_03_get_attribute completed successfully");
}

async function test_03_many_statements(){
    let db = await setup();
    const likes = K.key(":likes");
    const name = K.key(":name");
    const statements = [
        [ DT.addK, "mary", name, "Marticia"],
        [ DT.addK, "susan", name, "Suzard"],
        [ DT.addK, "mary", likes, "susan" ] ];
    db = await DB.commitTxn(db, statements);
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

async function test_01_add_datom(){
    let raw = await (await tree_adaptor_wrapper(SM()))();
    let db = DB.newDB(raw);
    db = await DB.commitTxn(db, [[ DT.addK, "mary", K.key(":db/ident"), "Marticia"]]);
    assert((await db.find()).length === 1, `The query returned an incorrect amount of results ` +
    `(expected: 1, found: ${(await db.find()).length})`);
}

main().then(() => {
    console.log("Reached end of t_transaction_01.mjs");
}, err => {
    console.error(err);
});
