/* Top Matter */

import assert from "../Source/Utilities/assert";
import A      from "../Source/Utilities/activities";
/*

const S = new A.Scheduler();

const f1 = A( function* f1( p1, p2 ) {
    A.log( "L1", p1, p2 );
    return p1 + p2;
} );

const f2 = A( function* f2( p1, p2, p3 ) {
    A.log( "L2", p1, p2, p3 );
    return p1 + yield f1( p2, p3 );
} );

const main = A( function* main() {
    A.log( "T1" );
    const x1 = yield f1( 13, 42 );
    A.log( "T2", x1 );
    const x2 = yield f2( 13, 42 );
    A.log( "T3", x2 );
} );

const x = S.activate( main );
x.finished_promise.catch( function( err ) {
    console.log( "t_keyword_01.mjs tests err." + err );
} ).then( function( done ) {
    console.log( "t_keyword_01.mjs tests done. " + done );
} );
*/
