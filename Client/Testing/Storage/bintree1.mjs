#!/usr/bin/env node --experimental-modules

import * as BT from "../../Source/Database/Tree/binary.mjs";
import * as ST from "../../Source/Storage/tree.mjs";
import * as SC from "../../Source/Storage/common.mjs";
import SM      from "../../Source/Storage/in_memory.mjs";
import T       from "transit-js";

async function main()
{
    await test_01_create_tree();
    await test_02_query_simple();
    await test_03_query_tree();
}

async function test_01_create_tree()
{
    const datoms = [];
    for( let i = 0; i < 1000; i += 5)
    {
        datoms.push( [ i, i+1, i+2, i+3, i+4 ] );
    }
    const node = await BT.buildTree( datoms );
    console.log( "Operation completed successfully. Node:", node.toString() );
}

function new_plain_root()
{
    const in_mem_storage = SM();
    const options = T.map();
    options.set( SC.PATH_PREFIX, [ "demo_app2" ] );
    options.set( SC.ENCODE_OBJ, SC.ENCODE_TRANSIT );
    const root = ST.newRoot( [ "root" ], in_mem_storage, options );
    return [root, () => { ST.openRoot( [ "root" ], in_mem_storage, options ) }];
}

async function test_02_query_simple()
{
    const datoms = [[1,2,3,4,5], [6,7,8,9,10]];
    const node = await BT.buildTree( datoms );
    let [root, retrieve_root] = new_plain_root();

    ST.setChild( root, "the database", node );

    const r2 = await ST.writeTree( root );    
    const r3 = await retrieve_root();
    const db = await ST.getChild( r3, "the database" );
    const tree = BT.wrapTree( db );
    const res = await tree.query({entity: 6});
    console.log("one datom?", res);
}

async function test_03_query_tree()
{
    const datoms = [];
    for( let i = 0; i < 100; i += 5)
    {
        datoms.push( [ i, i+1, i+2, i+3, i+4 ] );
    }
    const node = await BT.buildTree( datoms );
    let [root, retrieve_root] = new_plain_root();

    ST.setChild( root, "the database", node );

    const r2 = await ST.writeTree( root );    
    const r3 = await retrieve_root();
    const db = await ST.getChild( root, "the database" );
    const tree = BT.wrapTree( db );
    const res = await tree.query({entity: 55});
    console.log("one datom?", res);
}

main().then(() => {
    console.log( "Reached end of file" );
}, (err) => {
    console.error(err);
});

