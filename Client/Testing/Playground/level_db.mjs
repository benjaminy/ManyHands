#!/usr/bin/env node --experimental-modules

/*
 *
 */

import L from "level";

console.log( "open seasame",  L );

async function main()
{
    const db = L( "test-db" );
    const foo = await db.get( "Horse" );
    console.log( "Worked1?", foo );
    await db.put( "Horse", "flo" );
    const foo2 = await db.get( "Horse" );
    console.log( "Worked3?", foo2 );
}

main().then( () => { console.log( "FINISHED" ) } );

