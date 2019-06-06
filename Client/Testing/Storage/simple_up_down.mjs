/*
 *
 */

import assert  from "assert";
import T       from "transit-js";
import * as SC from "../../Source/Storage/common.mjs";

export async function just_upload( s ) {
    const options = {}
    const link = await s.upload( { path: [ "sadf" ] }, new Uint8Array(6), options );
    console.log( "just_upload", link );
}

export async function up_down( s ) {
    const options = {}
    options[ SC.ENCODE_OBJ ] = SC.ENCODE_TRANSIT;
    const map_orig = T.map();
    map_orig.set( "a", "42" );
    map_orig.set( "b", 42 );
    map_orig.set( "c", new Uint8Array( 7 ) );
    var resp_u = await s.upload( { path: [ "t2" ] }, map_orig, options );
    console.log( "UPLOADED", resp_u );
    var map_down = await s.download( { path: [ "t2" ] }, options );
    console.log( "up_down", map_orig.toString(), map_down.get( "c" ) );
    assert( T.equals( map_orig, map_down ) );
}
