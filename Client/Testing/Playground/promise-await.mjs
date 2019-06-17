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

async function p3( z )
{
    return p1( z );
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
    console.log( "T2", await p2( "alice" ) );
    console.log( "T3", await p3( "bob" ) );
    console.log( "T4", ( await p4( "alice" ) ).x );
    console.log( "T5", ( await p5( "bob" ) ).x );
}

main().then( () => { console.log( "FINISHED" ) } )
