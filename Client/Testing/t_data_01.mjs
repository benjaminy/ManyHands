/* Top Matter */

import { keyword } from "../Source/Utilities/keyword.mjs";
import { assert }  from "../Source/Utilities/assert.mjs";

var k01 = keyword( ":first" );
var k02 = keyword( ":first" );
var k03 = keyword( k01 );
var k04 = keyword( k02 );
var k05 = keyword( ":f/first" );
var k04 = keyword( ":first" );
var k05 = keyword( ":first" );
var k06 = keyword( ":first" );

assert( k01 === k02 );
assert( k01 === k03 );
assert( k01 === k04 );
assert( !( k01 === k02 ) );

console.log( "K: ", k01 );
console.log( "K: ", k01 === k02 );
console.log( "K: ", k01 === k04 );

console.log( "t_keyword_01.mjs tests passed." );
