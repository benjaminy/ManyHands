#!/usr/bin/env node --experimental-modules

/* Top Matter */

import assert  from "../../Source/Utilities/assert.mjs";
import * as K  from "../../Source/Utilities/keyword.mjs";
import * as A  from "../../Source/Database/attribute.mjs";
import * as DT from "../../Source/Database/transaction.mjs";
import SM      from "../../Source/Storage/in_memory.mjs";
import * as SC from "../../Source/Storage/common.mjs";
import * as ST from "../../Source/Storage/tree.mjs";

import * as Q  from "../../Source/Database/query.mjs";
import * as DB from "../../Source/Database/simple_txn_chain.mjs";

import * as TU from "./utils.mjs";

import T       from "transit-js";

async function main()
{
    await test_01_rewind();
    await test_02_udf();
    await test_03_udf_fail();
}
async function test_01_rewind()
{
    let [ db, retrieve_root ] = await TU.setup();
    let db2 = await DB.commitTxn(
        db, 
        [
            [
                DT.addK, "chad", K.key(":name"), "Chadictionary"
            ]
        ]
    );
    const q = Q.parseQuery(
        [
            Q.findK, "?name",
            Q.whereK, [
                "?underscore",
                K.key( ":name" ),
                "?name"
            ]
        ]
    );
    const res = await Q.runQuery( db2, q );
    assert( res.length === 1 );
    // rewind one transaction
    let db3 = await DB.traverseHistory( db2, 1 );
    const res2 = await Q.runQuery( db3, q );
    assert( res2.length === 0 );
}

const subtract = async (query, Q, args0, args1, args2) => {
    // TODO Q should not be a parameter!!!
    const [ [ res ] ] = await query(
        [
            Q.findK, "?current",
            Q.inK, "$", "?entity", "?attribute",
            Q.whereK, [
                "?entity", 
                "?attribute", 
                "?current"
            ]
        ],
        args0, args1 // TODO this inParam stuff
        // should be fixed in query code,
        // targeted by t_query_01/test_14_in_params
    );
    if( ( res - args2 ) < 0 ){
        return [ [ "failure", ":name", "a fail happened" ] ];
    }
    return [ [ args0, args1, res - args2 ] ];
}
async function test_03_udf_fail()
{
    const subtractK = K.key( ":subtract" );
    let [ db, retrieve_root ] = await TU.setup();
    let db2 = await DB.commitTxn( db,
        [
            [ DT.addK, "newfunc", A.identK,          subtractK        ],
            [ DT.addK, "newfunc", A.functionK,       subtract         ],
            [ DT.addK, "layla",   K.key( ":money" ), 50               ],
            [ DT.addK, "layla",   K.key( ":name" ),  "Laytictioscopy" ]
        ]
    );
    const q = Q.parseQuery( [
        Q.findK, "?e", 
        Q.inK, "?name", 
        Q.whereK, [ "?e", ":name", "?name" ] ] );
    const e_id = ( await Q.runQuery( db2, q, "Laytictioscopy" ) )[ 0 ][ 0 ];
    let db3 = await DB.commitTxn( db2,
        [
            [ subtractK, e_id, K.key( ":money" ), 2234890238902340 ]
        ]
    );
    const q2 = Q.parseQuery( [
        Q.findK, "?fail_id",
        Q.inK, "?fail",
        Q.whereK, [ "?fail_id", ":name", "?fail" ]
    ] );
    const res = await Q.runQuery( db3, q2, "a fail happened" );
    console.log( "fail ID is", res );
    assert( res !== undefined );
    // TODO cardinalityOne should restrict this result to one item
}

async function test_02_udf()
{
    const subtractK = K.key( ":subtract" );
    let [ db, retrieve_root ] = await TU.setup();
    let db2 = await DB.commitTxn( db,
        [
            [ DT.addK, "newfunc", A.identK,          subtractK        ],
            [ DT.addK, "newfunc", A.functionK,       subtract         ],
            [ DT.addK, "layla",   K.key( ":money" ), 50               ],
            [ DT.addK, "layla",   K.key( ":name" ),  "Laytictioscopy" ]
        ]
    );
    const q = Q.parseQuery( [
        Q.findK, "?e", 
        Q.inK, "?name", 
        Q.whereK, [ "?e", ":name", "?name" ] ] );
    const e_id = ( await Q.runQuery( db2, q, "Laytictioscopy" ) )[ 0 ][ 0 ];
    let db3 = await DB.commitTxn( db2,
        [
            [ subtractK, e_id, K.key( ":money" ), 20 ]
        ]
    );
    const q2 = Q.parseQuery( [
        Q.findK, "?money",
        Q.inK, "?e",
        Q.whereK, [ "?e", ":money", "?money" ]
    ] );
    const res = await Q.runQuery( db3, q2, e_id );
    console.log( res );
    assert( 30 === res[ 0 ][ 0 ], "Function did not return expected result. Found:" + res );
    // TODO cardinalityOne should restrict this result to one item
}

main().then(() => {
    console.log("End of file reached: t_transaction_02.mjs");
});

