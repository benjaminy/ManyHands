/*
 * Top Matter
 */

import L from "localforage";

console.log( L );

async function main()
{
    console.log( "main" );
    await L.setItem( "k1", "abc" );
    console.log( "set" );
    await L.setItem( "k2", "xyz" );
    console.log( await L.setItem( "k2" ) )
    console.log( await L.setItem( "k1" ) )
    console.log( await L.setItem( "k0" ) )
}

main().then( () => { console.log( "win" ) },
             ( err ) => { console.log( "lose", err ) } );
