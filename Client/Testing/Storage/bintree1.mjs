#!/usr/bin/env node --experimental-modules

import * as BT from "../../Source/Database/Tree/binary.mjs";
import * as ST from "../../Source/Storage/tree.mjs";

async function main(){
    const node = await BT.buildTree( [ 1, 2, 3, 4, 5 ] );
    console.log(node);
}

main().then(() => {
    console.log( "Reached end of file" );
}, (err) => {
    console.error(err);
});

