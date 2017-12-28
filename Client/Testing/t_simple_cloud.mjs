/* Top Matter */

import assert               from "../Source/Utilities/assert";
import { actFn, Scheduler } from "../Source/Utilities/act-thread";
import scc_init             from "../Source/Cloud/simple_cloud_client";
const SCC = scc_init();

const S = new Scheduler();

const main = actFn( function* main( actx ) {
    console.log( "T1" );
    const x = yield SCC.upload( actx, "A", "B", "C" );
    console.log( "T2" );
    const y = yield SCC.download( actx, "A", "B", true );
    console.log( "T3", y );
    try {
        const z = yield SCC.download( actx, "A", [ "X", "Y" ], true );
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
