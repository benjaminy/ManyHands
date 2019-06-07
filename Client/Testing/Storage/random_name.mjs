/*
 *
 */

import assert  from "assert";
import T       from "transit-js";
import * as SC from "../../Source/Storage/common.mjs";
import * as UM from "../../Source/Utilities/misc.mjs";

export async function test1( s ) {
    /* FIXME */
    const options1 = {}
    options1[ SC.ENCODE_OBJ ] = SC.ENCODE_TRANSIT;
    options1[ SC.COND_UPLOAD ] = SC.COND_NEW_NAME;

    const map_orig = T.map();
    map_orig.set( "a", "42" );
    map_orig.set( "b", 42 );

    const link1 = await s.upload( { path: [ "new_name1" ] }, map_orig, options1 );
    const [ x1, link1a ] = await s.download( link1, options1 );
    console.log( "TRY 1", link1, link1a, x1.toString() );

    map_orig.set( "c", 4.2 );
    const link2 = await s.upload( { path: [ "new_name1" ] }, map_orig, options1 );
    const [ x2, link2a ] = await s.download( link2, options1 );
    console.log( "TRY 2", link2, link2a, x2.toString() );

    map_orig.set( "d", 4.2 );
    const link3 = await s.upload( { path: [ "new_name1" ] }, map_orig, options1 );
    const [ x3, link3a ] = await s.download( link3, options1 );
    console.log( "TRY 3", link3, link3a, x3.toString() );
}
