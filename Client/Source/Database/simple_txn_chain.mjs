import assert  from "../Utilities/assert.mjs";
import A       from "../Utilities/act-thread";
import * as K  from "../Utilities/keyword.mjs";
import * as DC from "./common";


/* Reminder: tempting to use classes, */

export function init( user, storage, kind )
{
    assert( DC.kinds.has( kind ) );
    const db = {};
    db.user           = user;
    db.storage        = storage;
    db.index          = [];
    db.recent_txns    = [];
    db.next_entity_id = 0;
    db.attr_cache     = {};
    db.func_cache     = {};
    return db;
}

export const initializeStorage = A( function* createDB( db ) )
{
    
}

    const initialRead( db )
    {
    }

    const addTxn = A( async function addTxn( actx, txn ) {
        assert( A.isContext( actx ) );
        db.recent_txns.push( txn );
    } );

    const syncToStorage = A( async function syncWithStorage( actx ) {
        ...
    } )
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




