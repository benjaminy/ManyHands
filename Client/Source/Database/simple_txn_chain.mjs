/* Top Matter */

/*
 * File Comment
 */

import assert  from "../Utilities/assert";
import A       from "../Utilities/act-thread";
import * as K  from "../Utilities/keyword";
import * as SW from "../Storage/wrappers";
import * as DC from "./common";


/* Reminder: tempting to use classes, */

export function newDB( user, storage, kind, options )
{
    assert( DC.kinds.has( kind ) );
    const db = {};
    db.user             = user;
    db.head             = null;
    db.index            = [];
    db.uncommitted_txns = [];
    db.next_entity_id   = 0;
    db.attr_cache       = {};
    db.func_cache       = {};
    if( kind === DC.KIND_PRIVATE || kind === DC.KIND_TEAM )
    {
        const crypto = {
            generate_mac_key : true,
            generate_key     : true,
            generateKey      : yield 42,
            tag_bytes        : 42,
            sign             : yield 42,
            verify           : yield 42,
            encrypt          : yield 42,
            decrypt          : yield 42
        };

        db.storage =
            SW.encodingWrapper(
                SW.SK_JSON, {},
                SW.confidentialityWrapper(
                    crypto,
                    SW.authenticityWrapper(
                        crypto,
                        SW.randomNameWrapper( storage ) ) ) );
    }
    else
    {
        db.storage =
            SW.encodingWrapper(
                SW.SK_JSON, {},
                SW.authenticityWrapper(
                    crypto,
                    SW.randomNameWrapper( storage ) ) );
    }
    return db;
}

export const initializeStorage = A( function* createDB( db )
{
    
} );

export const fullRead = A( function* fullRead( db )
{
    txn = yield db.storage.download( db.head, {} );
} );

const addTxn = A( async function addTxn( actx, txn ) {
    assert( A.isContext( actx ) );
    db.recent_txns.push( txn );
} );

    const syncToStorage = A( function* syncWithStorage( db ) {
        for( const txn of db.
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




