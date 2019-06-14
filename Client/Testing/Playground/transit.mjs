#!/usr/bin/env node --experimental-modules

/*
 * Top Matter
 */

import T from "transit-js";

const reader = T.reader( "json" );
const writer = T.writer( "json" );

const rd = reader.read.bind( reader );
const wr = writer.write.bind( writer );

// console.log( T );


function roundtrip( x ) {
    const written = wr( x );
    const read = rd( written );
    console.log( "Foo on you", x, written, read );
    return read;
}

function symbolsNSuch()
{
    const dk = T.keyword( "dog" );
    const ds = T.symbol( "dog" );
    const ds2 = T.symbol( "dog" );
    const djs = Symbol( "dog" );
    const djs2 = Symbol( "dog" );

    console.log( "Transit symbols eq?", ds === ds2, ds === roundtrip( ds ) );

    console.log( "JS Symbol", djs, "type", typeof( djs ), "toStr", djs.toString(), djs == djs2 );

    console.log( "Transit keyword", dk, "type", typeof( dk ) );
    console.log( "Transit symbol", ds, "type", typeof( ds ) );
    const obj = {};

    obj[ djs ] = 123;
    obj[ djs2 ] = 456;

    console.log( "obj", obj );
    console.log( "symbol write", wr( dk ), wr( ds ), wr( ds2 ) );
}
symbolsNSuch();

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

function doesMapCloneWork()
{
    const tc = tm.clone();
    tc.set( "blue", "red" );
    console.log( "CLONE?", tm.toString(), tc.toString() );
}
doesMapCloneWork();

const s1 = T.set();
const sym1 = T.symbol( "giraffe" );

s1.add( [ 42 ] );
s1.add( sym1 );

console.log( "Set", s1.toString() );

const d = T.map();
console.log( "DELETE?", d.delete( 42 ) );

function doesSetCopyingWork()
{
    const sA = T.set();
    sA.add( "42" );
    const sB = sA.clone();
    sA.add( 42 );
    sB.add( 4.2 );
    console.log( "sets the same?", sA.toString(), sB.toString() );
}

doesSetCopyingWork();
