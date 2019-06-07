#!/usr/bin/env node --experimental-modules

/*
 * A little tree testing purely in-memory
 */

import assert   from "assert";
import * as ST  from "../../Source/Storage/tree.mjs";

async function main()
{
    var r = ST.newRoot( {}, {} );
    /* r is initially dirty */
    ST.setValue( r, 42, 45 );
    ST.setValue( r, "alice", "bob" );
    ST.deleteValue( r, 42 );
    const b = ST.getValue( r, "alice" );
    console.log( b, r.toString() );
    var c1, c2;
    [ r, c1 ] = ST.newChild( r, "bobby" );
    /* c1 is initially dirty */
    ST.setValue( c1, -3, "Hello" );
    [ r, c2 ] = ST.newChild( r, 22 );
    ST.setValue( c2, [1], "really?" );
    console.log( r.toString() );
    ST.deleteChild( r, "bobby" );
    console.log( r.toString() );
}

main().then( () => { console.log( "FINISHED" ) } );
