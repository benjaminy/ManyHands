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


async function main()
{
    //await test_01_rewind();
    await test_02_udf();
}

function new_plain_root()
{
    const in_mem_storage = SM();
    const options = T.map();
    options.set( SC.PATH_PREFIX, [ "demo_app2" ] );
    options.set( SC.ENCODE_OBJ, SC.ENCODE_TRANSIT );
    const root = ST.newRoot( [ "root" ], in_mem_storage, options );
    return [root, () => { return ST.openRoot( [ "root" ], in_mem_storage, options ) }];
}

async function setup(){
    const [root, retrieve_root] = new_plain_root();
    const name_insert = DT.getAttributeInserts(
        A.createAttribute(
            ":name",
            A.vtypeString,
            A.cardinalityOne,
            "A person's single, full name"
        )
    );
    const money_insert = DT.getAttributeInserts(
        A.createAttribute(
            ":money",
            A.vtypeString,
            A.cardinalityOne,
            "A person's money amount"
        )
    );
    let db = DB.newDB( );
    db = await DB.commitTxn( db, [ ...name_insert, ...money_insert ] );

    ST.setChild( root, "the database", db.node );
    const r2 = await ST.writeTree( root );    
    const r3 = await retrieve_root();
    const retrieved_raw = await ST.getChild( r3, "the database" );
    const retrieved_db = DB.wrapDB( retrieved_raw );
    return [ retrieved_db, retrieve_root ];
}


async function test_01_rewind()
{
    let [ db, retrieve_root ] = await setup();
    let db2 = await DB.commitTxn( db, [ [ DT.addK, "chad", K.key(":name"), "Chadictionary" ] ] );
}

const subtract = async (query, Q, ...args) => {
    console.log("ALL:", (await query([Q.findK, "?e", "?a", "?v", Q.whereK, ["?e", "?a", "?v"]])));
    const a = await query(
        [
            Q.findK, "?current",
            Q.inK, "$", //"?entity", "?attribute",
            Q.whereK, [
                args[0],//"?entity", 
                args[1],//"?attribute", 
                "?current"
            ]
        ],
        //args[0], args[1] // TODO these should be inK parameters
    );
    console.log("adsfjkl;as", args, a);
    return [[args[0], args[1], a[0][0] - args[2]]];
}

async function test_02_udf()
{
    const subtractK = K.key( ":subtract" );
    let [ db, retrieve_root ] = await setup();
    let db2 = await DB.commitTxn( db,
        [
            [ DT.addK, "newfunc", A.identK,              subtractK       ],
            [ DT.addK, "newfunc", A.functionK,           subtract        ],
            [ DT.addK, "layla",   K.key( ":money" ), 50              ],
            [ DT.addK, "layla",   K.key( ":name" ),  "Laytictioscopy"]
        ]
    );
    const q = Q.parseQuery( [
        Q.findK, "?e", 
        Q.inK, "?name", 
        Q.whereK, [ "?e", ":name", "?name" ] ] );
    const e_id = (await Q.runQuery( db2, q, "Laytictioscopy" ))[0][0];
    let db3 = await DB.commitTxn( db2,
        [
            [ subtractK, e_id, K.key(":money"), 20 ]
        ]
    );
    const q2 = Q.parseQuery( [
        Q.findK, "?money",
        Q.inK, "?e",
        Q.whereK, [ "?e", ":money", "?money" ]
    ] );
    const res = await Q.runQuery(db3, q2, e_id);
    console.log(res);
}

main().then(() => {
    console.log("End of file reached: t_transaction_02");
});

/* (err) => {
    console.log("error:" + err);
})*/
