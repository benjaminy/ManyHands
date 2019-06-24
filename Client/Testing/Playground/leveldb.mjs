#!/usr/bin/env node --experimental-modules

/*
 *
 */

import L from "level";
import P from "path";

console.log( "open seasame",  L );

const DEFAULT_DB_DIR = [ ".", "Testing", "Ignore" ]

async function main()
{
    const path_arr = DEFAULT_DB_DIR.concat( "PlaygroundDB" );
    console.log( "PATH ARR", path_arr );
    const path = P.join( ...path_arr );
    console.log( "PATH", path );
    const db = L( path );
    try {
        const foo = await db.get( "Horse2" );
    }
    catch( err ) {
        console.log( "ERROR HAPPENED", err.name, err.type );
        if( err.name === "NotFoundError" )
        {

        }
        else
        {
            throw err;
        }
    }
    const foo = "blah";
    console.log( "Worked1?", foo );
    await db.put( "Horse", "flo" );
    const foo2 = await db.get( "Horse" );
    console.log( "Worked3?", foo2 );
    const horse = await db.del( "Horse" );
    console.log( "Horse?", horse );
    const huh = await db.del( "not there" );
    console.log( "Deleted?", huh );
}

main().then( () => { console.log( "FINISHED" ) } );

