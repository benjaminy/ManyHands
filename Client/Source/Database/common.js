/* Top Matter */

import assert from "../Utilities/assert.mjs";
import * as K from "../Utilities/keyword.mjs";

class MonolithicFile
{
    constructor( storage )
    {
        this.storage = storage;
        this.eavt    = [];
        this.aevt    = [];
        this.avet    = [];
        this.vaet    = [];
        this.txns    = [];
        this.next_entity_id = 0;
        this.attributes     = {};
        this.functions      = {};
    }
}



example = '[ "p1", "p2", "p3" ] {  }';






console.log( "Database/common loaded." );
