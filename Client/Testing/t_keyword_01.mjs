/* Top Matter */

import assert from "assert";
import T      from "transit-js";

const keyword = T.keyword;

const k01 = keyword( "first" );
const k02 = keyword( "first" );
const k03 = keyword( k01 );
const k04 = keyword( k02 );

console.log( k01.toString(), k02.toString(), k03.toString(), k04.toString() );

assert( k01.equiv( k02 ) );
// assert( k01.equiv( k03 ) );
// assert( k01.equiv( k04 ) );

const k05 = keyword( ":f/first" );
const k06 = keyword( ":f.s/first" );
const k07 = keyword( ":f.s.t/first" );

assert( !( k01.equiv( k05 ) ) );

try {
    const k08 = keyword( ":first/f.s" );
    console.log( "TEST FAILED" );
}
catch( err ) {}

// console.log( K.compare( k01, k02 ) );
// console.log( K.compare( k01, k05 ) );

// console.log( "t_keyword_01.mjs tests passed." );
