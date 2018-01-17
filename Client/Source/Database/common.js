/* Top Matter */

import assert from "../Utilities/assert.mjs";
import A      from "../Utilities/act-thread";
import * as K from "../Utilities/keyword.mjs";

export default function MonolithicUnordered( storage, root, is_public, is_shared )
{
    const db = {};
    this.storage        = storage;
    this.root           = storage;
    this.index          = [];
    this.recent_txns    = [];
    this.next_entity_id = 0;
    this.attr_cache     = {};
    this.func_cache     = {};

    const addTxn = A( async function addTxn( actx, txn ) {
        assert( A.isContext( actx ) );
        db.recent_txns.push( txn );
    } );

    const syncToStorage = A( async function syncToStorage( actx, 
}

class MonolithicUnorderedxxx
{
    constructor( storage, is_public, is_shared )
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
