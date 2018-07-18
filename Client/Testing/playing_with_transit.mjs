/*
 * Top Matter
 */

import T from "transit-js";

console.log( T );

const dk = T.keyword( "dog" );
const ds = T.symbol( "dog" );

console.log( dk, ds, typeof( dk ), typeof( ds ) );
console.log( dk.hashCode )

