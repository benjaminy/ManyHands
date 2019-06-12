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

const reader = T.reader( "json" );
const writer = T.writer( "json" );

function roundtrip( x ) {
    const written = writer.write( x );
    const read = reader.read( written );
    console.log( "Foo on you", x, written, read );
    return read;
}

roundtrip( "45" );
roundtrip( [ "45" ] );
const m = roundtrip( { a: "42", b:42 } );

console.log( m.get( "b" ) );

const tm = T.map();

tm.set( "alice", 42 );
tm.set( 17, [ "drogon" ] );
tm.set( [ "a", 12 ], null );

console.log( "entries::: ", tm.toString(), tm.entries() );

for( const blah of tm )
{
    console.log( "Shmerp", blah );
}

tm.forEach( ( v, k ) => console.log( "iterate?", k, v ) );

console.log( "COPY?", ( new T.map( tm ) ).toString() );

const s1 = T.set();
const sym1 = T.symbol( "giraffe" );

s1.add( [ 42 ] );
s1.add( sym1 );

console.log( "Set", s1.toString() );

const d = T.map();
console.log( "DELETE?", d.delete( 42 ) );
