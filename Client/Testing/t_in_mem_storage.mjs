/*
 * Top Matter
 */

import assert  from "../Source/Utilities/assert";
import A       from "../Source/Utilities/activities";
import SM      from "../Source/Storage/in_memory";
import * as SW from "../Source/Storage/wrappers";


const main = A( function* main() {
    const s = SM( "alice" );

    var xxx = yield s.upload( { path: "sadf" }, { header_hooks:[], body:new Uint8Array(6) } );

    const j = SW.encodingWrapper( SW.SK_JSON, {}, s );

    var resp1 = yield j.upload( { path: "t2" }, { body: { a: "42", b: 42 } } );
    var resp2 = yield j.download( { path: "t2" }, {} );
    var yelp = yield resp2.json();
    console.log( "VICTORY", yelp );
} );

const S = A.activate( main );

console.log( "t_in_mem_storage reached EOF" );
