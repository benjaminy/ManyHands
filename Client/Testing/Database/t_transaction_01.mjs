#!/usr/bin/env node --experimental-modules

/* Top Matter */

import assert from "../../Source/Utilities/assert.mjs";
import * as K from "../../Source/Utilities/keyword.mjs";
import * as A from "../../Source/Database/attribute.mjs";
import * as DT from "../../Source/Database/transaction.mjs";
import SM       from "../../Source/Storage/in_memory.mjs";
import * as SC from "../../Source/Storage/common.mjs";
import * as ST from "../../Source/Storage/tree.mjs";

import * as TR from "../../Source/Database/Tree/tree.mjs";
import * as Q from "../../Source/Database/query.mjs";
import * as DB from "../../Source/Database/simple_txn_chain.mjs";

import T from "transit-js";

async function main() {
    await test_02_get_attribute();
}


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
    db = await DB.commitTxn( db, [ statement ] );

    const checkQuery = Q.parseQuery(
        [ Q.findK, "?a", "?name",
            Q.whereK, [ "?a", K.key( ":name" ), "?name" ] ]
    );

    const r = await Q.runQuery( db, checkQuery );
    console.log( "r03", r );

    assert( 
        r.length === 1 
            && r[0][1] === "Bobethy", 
        "Attribute was not filled in correctly or record could not be retrieved"
    );
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

main().then(() => {
    console.log("Reached end of t_transaction_01.mjs");
}, err => {
    console.error(err);
});
