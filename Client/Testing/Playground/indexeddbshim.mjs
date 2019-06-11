/*
 * Top Matter
 */

import setGlobalVars from "indexeddbshim";

// console.log( indexedDB );

global.window = global; // We'll allow ourselves to use `window.indexedDB` or `indexedDB` as a global
setGlobalVars( null, { checkOrigin: false } );

console.log( indexedDB );

const request = indexedDB.open( "MyTestDatabase", 3 );

console.log( request );

// async function main()
// {
//     console.log( "main" );
//     await L.setItem( "k1", "abc" );
//     console.log( "set" );
//     await L.setItem( "k2", "xyz" );
//     console.log( await L.setItem( "k2" ) )
//     console.log( await L.setItem( "k1" ) )
//     console.log( await L.setItem( "k0" ) )
// }

// main().then( () => { console.log( "win" ) },
//              ( err ) => { console.log( "lose", err ) } );
