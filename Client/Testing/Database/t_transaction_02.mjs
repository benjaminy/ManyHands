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

import * as TU from "./utils.mjs";

import T from "transit-js";

async function main()
{
    await test_01_rewind();
    //await test_02_udf();
}
async function test_01_rewind()
{
    let [ db, retrieve_root ] = await TU.setup();
    let db2 = await DB.commitTxn( db, [ [ DT.addK, "chad", K.key(":name"), "Chadictionary" ] ] );
    const q = Q.parseQuery( [ Q.findK, "?name", Q.whereK, [ "?underscore", K.key( ":name" ), "?name" ] ] );
    const res = await Q.runQuery( db2, q );
    assert( res.length === 1 );
    let db3 = await DB.traverseHistory( db2, 1 );
    const res2 = await Q.runQuery( db3, q );
    assert( res2.length === 0);
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
    let [ db, retrieve_root ] = await TU.setup();
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
    assert(30 === res[0][0], "Function did not return expected result. Found:" + res);
    // TODO cardinalityOne should restrict this result to one item
}

main().then(() => {
    console.log("End of file reached: t_transaction_02.mjs");
});

