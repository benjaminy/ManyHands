#!/usr/bin/env node --experimental-modules

/*
 * Top Matter
 */

async function p1( x )
{
    return x;
}

async function p2( y )
{
    return await p1( y );
}

async function p6( y ) {
    var ret = p1(y);
    console.log(ret);
    return new Promise((s,f) => {s(ret)});
}

async function p3( z )
{
    return p1( z );
}

async function p32( z )
{
    return new Promise( ( success, fail ) => { success( p1( z ) ); } );
}

async function p4( y )
{
    return { x: await p1( y ) };
}

async function p5( z )
{
    return { x: p1( z ) };
}

async function main()
{
    console.log( " T2", await p2( "alice" ) );
    console.log( " T3", await p3( "bob" ) );
    console.log( "T32", await p32( "carol" ) );
    console.log( " T4", ( await p4( "dave" ) ).x );
    console.log( " T5", ( await p5( "eve" ) ).x );
}

main().then( () => { console.log( "FINISHED" ) } )
