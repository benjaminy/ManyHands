/* Top Matter */

import { keyword } from "../Source/Utilities/keyword.mjs";
import { assert }  from "../Source/Utilities/assert.mjs";

const k01 = keyword( ":first" );
const k02 = keyword( ":first" );
const k03 = keyword( k01 );
const k04 = keyword( k02 );

assert( k01 === k02 );
assert( k01 === k03 );
assert( k01 === k04 );

const k05 = keyword( ":f/first" );
const k06 = keyword( ":f.s/first" );
const k07 = keyword( ":f.s.t/first" );

assert( !( k01 === k05 ) );

try {
    const k08 = keyword( ":first/f.s" );
    console.log( "TEST FAILED" );
}
catch( err ) {}

console.log( "t_keyword_01.mjs tests passed." );
