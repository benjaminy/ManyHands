#!/usr/bin/env node --experimental-modules

/*
 * Top Matter
 */

import T from "transit-js";

const my_map = T.map();
// initialize a map with 10 key-value pairs
my_map.set(1,2);
my_map.set(3,4);
my_map.set(5,6);
my_map.set(7,8);
my_map.set(9,10);
my_map.set(11,12);
my_map.set(13,14);
my_map.set(15,16);
my_map.set(17,18);
my_map.set(19,20);

function loop( msg, v, k ){
    for(let i = 0; i < 100; i++){
        my_map.get(1);
    }
    console.log("k, v", msg, k, v);
}

const x = false;

if( x )
{
    for( const [ k, v ] of my_map )
    {
        loop( "A", v, k );
    }
}

my_map.forEach((v, k) => loop("B", v, k));
// prints: k, v 1 2
