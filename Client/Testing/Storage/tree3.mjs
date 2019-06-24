#!/usr/bin/env node --experimental-modules

/*
 * A little tree testing purely in-memory
 */

import assert   from "assert";
import T        from "transit-js";
import * as SC  from "../../Source/Storage/common.mjs";
import SM       from "../../Source/Storage/in_memory.mjs";
import * as ST  from "../../Source/Storage/tree.mjs";
import * as K   from "../../Source/Utilities/keyword.mjs"

async function test_01()
{
    console.log( "*** test_01_branching ***" );
    const in_mem_storage = SM();
    const options = T.map();
    options.set( SC.PATH_PREFIX, [ "demo_app2" ] );
    options.set( SC.ENCODE_OBJ, SC.ENCODE_TRANSIT );
    var r = ST.newRoot( [ "root" ], in_mem_storage, options );
    /* r is initially dirty */

    const n1 = ST.newNode();
    const n2 = ST.newNode();
    const n3 = ST.newNode();
    const n4 = ST.newNode();
    const n5 = ST.newNode();
    const n6 = ST.newNode();

    ST.setChild( r, "ptr1", n1 );
    ST.setChild( r, "ptr2", n2 );
    ST.setChild( n1, "ptr1", n3 );
    ST.setChild( n1, "ptr2", n4 );
    ST.setChild( n4, "ptr1", n5 );
    ST.setChild( n4, "ptr2", n6 );

    ST.setValue( r, 42, 45 );
    ST.setValue( r, "alice", "bob" );
    ST.setValue( n1, 42, 45 );
    ST.setValue( n1, "alice", "bob" );
    ST.setValue( n2, 42, 45 );
    ST.setValue( n2, "alice", "bob" );
    ST.setValue( n3, 42, 45 );
    ST.setValue( n3, "alice", "bob" );
    ST.setValue( n4, 42, 45 );
    ST.setValue( n4, "alice", "bob" );
    ST.setValue( n5, 41, 40 );
    ST.setValue( n5, "alice", 4.1 );
    ST.setValue( n6, 42, 45 );
    ST.setValue( n6, "alice", "bob" );

    const r2 = await ST.writeTree( r );

    const r3 = await ST.openRoot( [ "root" ], in_mem_storage, options );
    console.log( "ROOT???", r3.toString() );

    const ccc1 = await ST.getChild( r3, "ptr1" );
    console.log( "Ralph???", ccc1.toString() );

    const ccc2 = await ST.getChild( ccc1, "ptr2" );
    console.log( "Donny???", ccc2.toString() );
    
    const ccc3 = await ST.getChild( ccc2, "ptr1" );
    console.log( "Kristen???", ccc3.toString() );

}

async function main()
{
    await test_01();
}

main().then( () => { console.log( "FINISHED" ) } );
