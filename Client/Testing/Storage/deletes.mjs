/* Top Matter */

import assert  from "assert";
import T       from "transit-js";
import * as UM from "../../Source/Utilities/misc.mjs";
import * as UT from "../../Source/Utilities/transit.mjs";
import * as SC from "../../Source/Storage/common.mjs";

export async function doSomeDeletes( storage )
{
    const options = UT.mapFromTuples( [ [ SC.ENCODE_OBJ, SC.ENCODE_TRANSIT ] ] );
    const link1 = UT.mapFromTuples( [ [ "path", [ "F1" ] ] ] );
    const link2 = UT.mapFromTuples( [ [ "path", [ "D1", "F1" ] ] ] );
    const link3 = UT.mapFromTuples( [ [ "path", [ "D1", "F2" ] ] ] );
    const data1 = "D1";
    const data2 = [ "D2" ];
    await storage.upload( link1, data1, options );
    await storage.upload( link2, data2, options );
    const [ d1, ignore1 ] = await storage.download( link1, options );
    assert( d1 === data1 );
    const [ d2, ignore2 ] = await storage.download( link2, options );
    assert( UM.arrayEq( d2, data2 ) );
    await storage.deleteFile( link2, options );
    const [ d1B, ignore3 ] = await storage.download( link1, options );
    assert( d1B === data1 );
    try {
        await storage.download( link2, options );
        throw new Error();
    }
    catch( err ) {
        if( SC.ERROR_KIND in err && err[ SC.ERROR_KIND ] === SC.ERROR_NOT_FOUND )
        {
            // expected
        }
        else
        {
            throw err;
        }
    }
    try {
        await storage.deleteFile( link3, options );
        throw new Error();
    }
    catch( err ) {
        if( SC.ERROR_KIND in err && err[ SC.ERROR_KIND ] === SC.ERROR_NOT_FOUND )
        {
            // expected
        }
        else
        {
            throw err;
        }
    }
    const [ d1C, ignore4 ] = await storage.download( link1, options );
    assert( d1C === data1 );
}
