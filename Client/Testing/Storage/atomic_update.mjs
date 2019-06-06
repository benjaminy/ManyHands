/*
 *
 */

import assert  from "assert";
import * as SC from "../../Source/Storage/common.mjs";

export async function test1( s ) {
    const options = {}
    options[ SC.ENCODE_OBJ ] = SC.ENCODE_TRANSIT;
    options[ SC.COND_UPLOAD ] = SC.COND_ATOMIC;

    const map_orig = T.map();
    map_orig.set( "a", "42" );
    map_orig.set( "b", 42 );

    var resp = await s.upload( { path: [ "sadf" ] }, new Uint8Array(6), options );
    console.log( "just_upload", resp.ok, resp.status, resp.statusText );
    assert( resp.ok );
}

export async function up_down( s ) {
    const options = {}
    options[ SC.ENCODE_OBJ ] = SC.ENCODE_TRANSIT;
    const obj_orig = { a: "42", b: 42 };
    var resp_u = await s.upload( { path: [ "t2" ] }, obj_orig, options );
    var resp_d = await s.download( { path: [ "t2" ] }, options );
    var obj_down = await resp_d;
    console.log( "up_down", resp_d.ok, resp_d.status, resp_d.statusText, obj_down );
    assert( JSON.stringify( obj_orig ) === JSON.stringify( obj_down ) );
}
