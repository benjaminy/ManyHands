/* Top Matter */

import assert from "assert";
import T      from "transit-js";

const keyword = T.keyword;

const k01 = keyword( "first" );
const k02 = keyword( "first" );
const k03 = keyword( k01 );
const k04 = keyword( k02 );

function logAllProperties(obj) {
     if (obj == null) return; // recursive approach
     console.log(Object.getOwnPropertyNames(obj));
     logAllProperties(Object.getPrototypeOf(obj));
}

logAllProperties( k01 );

// console.log( "Type", Object.keys( k01 ) );
console.log( "Hash", k01.com$cognitect$transit$hashCode() );
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
    console.log( "PERMISSIVE KEYWORD SYNTAX" );
}
catch( err ) {}

// console.log( K.compare( k01, k02 ) );
// console.log( K.compare( k01, k05 ) );

const obj = [];
obj[ k01 ] = "test";
console.log( "test obj", obj );
console.log( "test keys", Object.keys( obj ) );
console.log( "tester", typeof( Object.keys( obj )[ 0 ] ) );

// console.log( "t_keyword_01.mjs tests passed." );
