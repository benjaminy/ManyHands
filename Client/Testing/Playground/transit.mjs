#!/usr/bin/env node --experimental-modules

/*
 * Top Matter
 */

import T from "transit-js";
import * as UT from "../../Source/Utilities/transit.mjs";

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

    console.log( "Transit symbols eq?", T.equals( ds, ds2 ), ds === roundtrip( ds ) );
    console.log( "JS symbols eq?", djs === djs2 );

    console.log( "JS Symbol", djs, "type", typeof( djs ), "toStr", djs.toString(), djs == djs2 );

    console.log( "Transit keyword", dk, "type", typeof( dk ) );
    console.log( "Transit symbol", ds, "type", typeof( ds ) );
    const obj = {};

    obj[ djs ] = 123;
    obj[ djs2 ] = 456;

    console.log( "obj", obj );
    console.log( "symbol write", wr( dk ), wr( ds ), wr( ds2 ) );

    console.log( "RK", dk, roundtrip( dk ), T.equals( roundtrip( dk ), dk ) );
    console.log( "RS", ds, roundtrip( ds ), T.equals( roundtrip( ds ), ds2 ) );
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

function mapInit()
{
    const m1 = T.map();
    m1.set( 1, 2 );
    m1.set( "a", "b" );
    const tuples = [ [ 5, 6 ], [ "y", "z" ] ]
    const m2 = T.map( tuples ); /* BROKEN */
    const m3 = UT.mapFromTuples( tuples );
    const m4 = new T.map( m1 ); /* BROKEN */
    const m5 = m1.clone();
    console.log( "array init", m2.toString() );
    console.log( "array init2", m3.toString() );
    console.log( "new map", m4.toString() );
    console.log( "clone", m5.toString() );
}
mapInit();

function mapSpreadOp()
{
    const m1 = T.map();
    m1.set( 1, 2 );
    m1.set( "a", "b" );
    m1.set( 3, "c" );
    console.log( "spread", ...m1 );
}
mapSpreadOp();
