#!/usr/bin/env node --experimental-modules

/* Top Matter */

import C from "crypto";

const text = "hello bob";
const key  = "mysecret key";

// create hash
const hash = C.createHmac( "sha256", key );
hash.update( text );
const value = hash.digest('hex');

console.log( "H1", value );

const hash2 = C.createHash( "sha256" );
const text2 = "carol";
hash2.update( text2 );
const value2 = hash2.digest( "hex" );

console.log( "H2", value2 );

const hash3 = C.createHash( "sha256" );
const text3 = "carol";
hash3.update( text3 );
const value3 = hash3.digest();

console.log( "H3", typeof( value3 ), Object.keys( value3 ) );

const hash4 = C.createHash( "sha256" );
const text4 = new Uint8Array( 11 );
hash4.update( text4 );
const value4 = hash4.digest( "hex" );

console.log( "H4", text4, value4 );
