/*
 *
 */

import assert  from "assert";
import T       from "transit-js";
import * as SC from "../../Source/Storage/common.mjs";
import * as UM from "../../Source/Utilities/misc.mjs";
import * as UT from "../../Source/Utilities/transit.mjs";

export async function test1( s ) {
    const options1 = T.map()
    options1.set( SC.ENCODE_OBJ, SC.ENCODE_TRANSIT );
    options1.set( SC.COND_UPLOAD, SC.COND_NO_OVERWRITE );

    const options2 = T.map()
    options2.set( SC.ENCODE_OBJ, SC.ENCODE_TRANSIT );
    options2.set( SC.COND_UPLOAD, SC.COND_ATOMIC );

    const map_orig = T.map();
    map_orig.set( "a", "42" );
    map_orig.set( "b", 42 );

    const link0 = UT.mapFromTuples( [ [ "path", [ "atom1" ] ] ] );
    const link1 = await s.upload( link0, map_orig, options1 );
    console.log( "LINK1", link1.toString() );

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
        else
        {
            console.log( "RUH-ROH" );
        }
    }

    console.log( "VICTORY" );
}
