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

async function test_01_branching()
{
    console.log( "*** test_01_branching ***" );
    const in_mem_storage = SM();
    const options = T.map();
    options.set( SC.PATH_PREFIX, [ "demo_app" ] );
    options.set( SC.ENCODE_OBJ, SC.ENCODE_TRANSIT );
    var r = ST.newRoot( [ "root" ], in_mem_storage, options );
    /* r is initially dirty */
    ST.setValue( r, 42, 45 );
    ST.setValue( r, "alice", "bob" );
    const [ ignore1, cRalph ] = ST.newChild( r, "ralph" );
    const [ ignore2, cDonny ] = ST.newChild( r, [ K.key(":donny") ] );
    ST.setValue( cRalph, "pets", [ "fido", "mittens" ] );
    ST.setValue( cDonny, [[[]]], [ "Oswald", "Tingle" ] );
    const [ ignore3, cDude ] = ST.newChild( cDonny, "Look at her dance" );
    ST.setValue( cDude, "bill", [ "law" ] );
    console.log( "WHOLE TREE", r.toString() );
    var r2 = await ST.writeTree( r );

    var r3 = await ST.openRoot( [ "root" ], in_mem_storage, options );
    console.log( "ROOT???", r3.toString() );

    const ccc1 = await ST.getChild( r3, "ralph" );
    console.log( "Ralph???", ccc1.toString() );

    const ccc2 = await ST.getChild( r3, [ K.key(":donny") ] );
    console.log( "Donny???", ccc2.toString() );
    
    const ccc3 = await ST.getChild( ccc2, "Look at her dance" );
    console.log( "Kristen???", ccc3.toString() );

    const r4 = ST.setValue( r3, "New one", 1.7 );
    const r5 = await ST.writeTree( r4 );

    // ST.deleteValue( r, 42 );
    // const b = ST.getValue( r, "alice" );
    // console.log( b, r.toString() );
    // var c1, c2;
    // [ r, c1 ] = ST.newChild( r, "bobby" );
    // /* c1 is initially dirty */
    // ST.setValue( c1, -3, "Hello" );
    // [ r, c2 ] = ST.newChild( r, 22 );
    // ST.setValue( c2, [1], "really?" );
    // console.log( r.toString() );
    // ST.deleteChild( r, "bobby" );
    // console.log( r.toString() );
}

async function test_02_simple_dict()
{
    console.log( "*** test_02_simple_dict ***" );
    const in_mem_storage = SM();
    const options = T.map();
    options.set( SC.PATH_PREFIX, [ "demo_app" ] );
    options.set( SC.ENCODE_OBJ, SC.ENCODE_TRANSIT );
    var r = ST.newRoot( [ "root" ], in_mem_storage, options );
    /* r is initially dirty */
    ST.setValue( r, 42, 45 );
    ST.setValue( r, "alice", "bob" );
    ST.setValue( r, K.key(":alicekey"), K.key(":bobkey"));
    var r2 = await ST.writeTree( r );

    var r3 = await ST.openRoot( [ "root" ], in_mem_storage, options );

    assert(ST.getValue(r3, 42) === 45, "Getting value from root was unsuccessful");
    assert(ST.getValue(r3, "alice") === "bob", "Getting string value from root was unsuccessful");
    assert(T.equals(ST.getValue(r3, K.key(":alicekey")), K.key(":bobkey")))
    console.log("test_02_simple_dict completed successfully");
}

async function main()
{
    await test_01_branching();
    await test_02_simple_dict();
}

main().then( () => { console.log( "FINISHED" ) } );
