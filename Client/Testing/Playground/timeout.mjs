#!/usr/bin/env node --experimental-modules

/* Top Matter */

function sleepPromise( ms )
{
    return new Promise(
        ( resolve, reject ) =>
            {
                setTimeout( () => resolve(),
                            ms );
            } );
}

async function main()
{
    console.log( "Sleeping 1.5s" );
    await sleepPromise( 1500 );
    console.log( "Refreshed" );
}

main().then( "FINISHED" );
