/* Top Matter */

import assert from "../Source/Utilities/assert";
import A      from "../Source/Utilities/act-thread";

const S = new A.Scheduler();

const f1 = A( async function f1( actx, p1, p2 ) {
    actx.log( "L1", p1, p2 );
    return p1 + p2;
} );

const f2 = A( async function f2( actx, p1, p2, p3 ) {
    actx.log( "L2", p1, p2, p3 );
    return p1 + await f1( actx, p2, p3 );
} );

const main = A( async function main( actx ) {
    actx.log( "T1" );
    const x1 = await f1( actx, 13, 42 );
    actx.log( "T2", x1 );
    const x2 = await f2( actx, 13, 42 );
    actx.log( "T3", x2 );
} );

const x = S.activate( main );
x.finished_promise.catch( function( err ) {
    console.log( "t_keyword_01.mjs tests err." + err );
} ).then( function( done ) {
    console.log( "t_keyword_01.mjs tests done. " + done );
} );
