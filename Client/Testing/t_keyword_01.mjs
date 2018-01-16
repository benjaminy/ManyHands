/* Top Matter */

import assert from "../Source/Utilities/assert.mjs";
import * as K from "../Source/Utilities/keyword.mjs";

const k01 = K.key( ":first" );
const k02 = K.key( ":first" );
const k03 = K.key( k01 );
const k04 = K.key( k02 );

assert( k01 === k02 );
assert( k01 === k03 );
assert( k01 === k04 );

const k05 = K.key( ":f/first" );
const k06 = K.key( ":f.s/first" );
const k07 = K.key( ":f.s.t/first" );

assert( !( k01 === k05 ) );

try {
    const k08 = K.key( ":first/f.s" );
    console.log( "TEST FAILED" );
}
catch( err ) {}

console.log( K.compare( k01, k02 ) );
console.log( K.compare( k01, k05 ) );

console.log( "t_keyword_01.mjs tests passed." );
