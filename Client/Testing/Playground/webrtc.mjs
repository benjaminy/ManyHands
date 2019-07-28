#!/usr/bin/env node --experimental-modules

/*
 *
 */

import RL   from "readline";
import Peer from "simple-peer";
import wrtc from "wrtc";

function promiseRR()
{
    var resolve, reject;
    const p = new Promise( ( s, j, ) => { resolve = s; reject = j; } );
    return [ p, resolve, reject ];
}

/* just get a line of text from stdin. Probably there's a much simpler way. */
async function question( prompt )
{
    const [ p, resolve, reject ] = promiseRR();
    const rl = RL.createInterface( {
        input: process.stdin,
        output: process.stdout
    } );

    rl.question( prompt, ( answer ) => {
        resolve( answer );
        rl.close();
    } );
    return await p;
}

async function signal( peer_obj )
{
    const [ p, resolve, reject ] = promiseRR();
    peer_obj.on( "signal", resolve );
    return await p;
}

async function connect( peer_obj )
{
    const [ p, resolve, reject ] = promiseRR();
    peer_obj.on( "connect", resolve );
    return await p;
}

async function main()
{
    console.log( process.argv );
    const am_initiator = process.argv[ 2 ] === "initiator";

    const p = new Peer(
        { initiator: am_initiator,
          wrtc: wrtc,
          trickle: false }
    );

    p.on( "data", async data => {
        console.log( "data:" + data );
        const s = await question( "Say something:" );
        if( s === "quit" )
        {
            p.destroy();
        }
        else
        {
            p.send( s );
        }
    } );

    const [ prom_quit, resolve_quit, reject_quit ] = promiseRR();
    p.on( "close", resolve_quit );
    p.on( "error", reject_quit );

    if( am_initiator )
    {
        const initiator_sdp = await signal( p );
        console.log( JSON.stringify( initiator_sdp ) );
        const acceptor_sdp = await question( "Acceptor SDP? " );
        p.signal( JSON.parse( acceptor_sdp ) );
        await connect( p );
        p.send( await question( "Say something:" ) );
    }
    else
    {
        const initiator_sdp = await question( "Initiator SDP? " );
        p.signal( JSON.parse( initiator_sdp ) );
        const acceptor_sdp = await signal( p );
        console.log( JSON.stringify( acceptor_sdp ) );
        await connect( p );
    }

    await prom_quit;
}

main().then(
    ( val ) => console.log( "FINISHED", val ) ).catch(
    ( err ) => console.log( "CRASHED", err ) );
