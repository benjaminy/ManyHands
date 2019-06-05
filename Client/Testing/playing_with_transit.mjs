#!/usr/bin/env node --experimental-modules

/*
 * Top Matter
 */

import T from "transit-js";

// console.log( T );

const dk = T.keyword( "dog" );
const ds = T.symbol( "dog" );
const djs = Symbol( "dog" );
const djs2 = Symbol( "dog" );

console.log( "JS Symbol", djs, "type", typeof( djs ), "toStr", djs.toString(), djs == djs2 );

console.log( "Transit keyword", dk, "type", typeof( dk ) );
console.log( "Transit symbol", ds, "type", typeof( ds ) );

const obj = {};

obj[ djs ] = 123;
obj[ djs2 ] = 456;

console.log( "obj", obj );
