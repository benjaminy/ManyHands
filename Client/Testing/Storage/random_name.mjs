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
    options1[ SC.COND_UPLOAD ] = SC.COND_NO_OVERWRITE;

    const options2 = {}
    options2[ SC.ENCODE_OBJ ] = SC.ENCODE_TRANSIT;
    options2[ SC.COND_UPLOAD ] = SC.COND_ATOMIC;

    const map_orig = T.map();
    map_orig.set( "a", "42" );
    map_orig.set( "b", 42 );

    const link1 = await s.upload( { path: [ "atom1" ] }, map_orig, options1 );
    console.log( "LINK1", link1 );

    map_orig.set( "c", 4.2 );
    const link2 = await s.upload( link1, map_orig, options2 );
    console.log( "LINK2", link1 );

    map_orig.set( "d", 4.2 );
    const link3 = await s.upload( link2, map_orig, options2 );
    console.log( "LINK3", link1 );

    map_orig.set( "e", 4.2 );
    try {
        const link4 = await s.upload( link2, map_orig, options2 );
        console.log( "LINK4", link1 );
    }
    catch( err ) {
        if( UM.hasProp( err, SC.ERROR_KIND ) &&
            err[ SC.ERROR_KIND ] === SC.ERROR_ATOMIC_UPDATE_FAILED )
        {
            console.log( "LITTLE VICTORY" );
        }
    }

    console.log( "just_upload", link4 );
}
