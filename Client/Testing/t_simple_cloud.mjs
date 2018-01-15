/* Top Matter */

import assert   from "../Source/Utilities/assert";
import A        from "../Source/Utilities/act-thread";
import scc_init from "../Source/Cloud/simple_cloud_client";
const SCC = scc_init( "Alice" );

const S = new A.Scheduler();

const main = A( async function main( actx ) {
    console.log( "T1" );
    const x = await SCC.upload( actx, "B", "C" );
    console.log( "T2" );
    const y = await SCC.download( actx, "B", true );
    console.log( "T3", y );
    try {
        const z = await SCC.download( actx, [ "X", "Y" ], true );
        console.log( "FAIL", z );
    }
    catch( err ) {
        console.log( "T4", err );
    }
} );

const x = S.activate( main );
x.finished_promise.catch( function( err ) {
    console.log( "t_keyword_01.mjs tests err." + err );
} ).then( function( done ) {
    console.log( "t_keyword_01.mjs tests done. " + done );
} );
