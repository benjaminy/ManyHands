#!/usr/bin/env node --experimental-modules

/*
 * A little tree testing purely in-memory
 */

import assert   from "assert";
import * as SC  from "../../Source/Storage/common.mjs";
import SM       from "../../Source/Storage/in_memory.mjs";
import * as ST  from "../../Source/Storage/tree.mjs";

async function main()
{
    const in_mem_storage = SM();
    const options = { [SC.PATH_PREFIX]: "demo_app" };
    var r = ST.newRoot( [ "root" ], in_mem_storage, options );
    /* r is initially dirty */
    ST.setValue( r, 42, 45 );
    ST.setValue( r, "alice", "bob" );
    var r2 = await ST.writeTree( r );
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

main().then( () => { console.log( "FINISHED" ) } );
