/*
 *
 */

import assert  from "assert";
import T       from "transit-js";
import * as UT from "../../Source/Utilities/transit.mjs";
import * as SC from "../../Source/Storage/common.mjs";

export async function just_upload( s ) {
    const options = T.map();
    const link_up = UT.mapFromTuples( [ [ "path", [ "sadf" ] ] ] );
    const link = await s.upload( link_up, new Uint8Array(6), options );
    console.log( "just_upload", link );
}

export async function up_down( s ) {
    const options = T.map();
    options.set( SC.ENCODE_OBJ, SC.ENCODE_TRANSIT );
    const map_orig = T.map();
    map_orig.set( "a", "42" );
    map_orig.set( "b", 42 );
    map_orig.set( "c", new Uint8Array( 7 ) );
    const link_up = UT.mapFromTuples( [ [ "path", [ "t2" ] ] ] );
    var resp_u = await s.upload( link_up, map_orig, options );
    console.log( "UPLOADED", resp_u );
    const link_down = UT.mapFromTuples( [ [ "path", [ "t2" ] ] ] );
    var [ map_down, l ] = await s.download( link_down, options );
    console.log( "up_down", map_orig.toString(), map_down.get( "c" ) );
    assert( T.equals( map_orig, map_down ) );
}
