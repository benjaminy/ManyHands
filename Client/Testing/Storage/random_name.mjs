/* Top Matter */

import assert  from "assert";
import T       from "transit-js";
import * as SC from "../../Source/Storage/common.mjs";
import * as UM from "../../Source/Utilities/misc.mjs";
import * as UT from "../../Source/Utilities/transit.mjs";

export async function test1( s ) {
    /* FIXME */
    const options1 = T.map();
    options1.set( SC.ENCODE_OBJ, SC.ENCODE_TRANSIT );
    options1.set( SC.COND_UPLOAD, SC.COND_NEW_NAME );

    const m1 = T.map();
    m1.set( "a", "42" );
    m1.set( "b", 42 );

    const link1_up = UT.mapFromTuples( [ [ "path", [ "new_name1" ] ] ] );
    const meta1 = await s.upload( link1_up, m1, options1 );
    const link1 = UT.mapAssign( T.map(), link1_up );
    link1.set( "path", link1_up.get( "path" ).concat( meta1.get( "new_name" ) ) );
    const [ x1, meta1a ] = await s.download( link1, options1 );
    assert( T.equals( m1, x1 ) );

    const m2 = UT.mapFromTuples( [ ...m1, [ "c", 4.2 ] ] );
    const link2_up = UT.mapFromTuples( [ [ "path", [ "new_name1" ] ] ] );
    const meta2 = await s.upload( link2_up, m2, options1 );
    const link2 = UT.mapAssign( T.map(), link2_up );
    link2.set( "path", link2_up.get( "path" ).concat( meta2.get( "new_name" ) ) );
    const [ x12, link12_down ] = await s.download( link1, options1 );
    const [ x2, link2a ] = await s.download( link2, options1 );
    assert( T.equals( m1, x1 ) );
    assert( T.equals( m1, x12 ) );
    assert( T.equals( m2, x2 ) );

    const m3 = m2.clone();
    m3.set( "d", 4.2 );
    const link3_up = UT.mapFromTuples( [ [ "path", [ "new_name1" ] ] ] );
    const meta3 = await s.upload( link3_up, m3, options1 );
    const link3 = UT.mapAssign( T.map(), link3_up );
    link3.set( "path", link3_up.get( "path" ).concat( meta3.get( "new_name" ) ) );
    const [ x13, link13_down ] = await s.download( link1, options1 );
    const [ x22, link22_down ] = await s.download( link2, options1 );
    const [ x3, link3a ] = await s.download( link3, options1 );
    assert( T.equals( m1, x1 ) );
    assert( T.equals( m1, x13 ) );
    assert( T.equals( m2, x2 ) );
    assert( T.equals( m2, x22 ) );
    assert( T.equals( m3, x3 ) );
}
