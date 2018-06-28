/*
 * Top Matter
 */

/*
 * File Comment
 */

import assert  from "../Utilities/assert";
import * as K  from "../Utilities/keyword";
import * as SW from "../Storage/wrappers";
import * as DC from "./common";
import * as DT from "./transaction";


/* Reminder: tempting to use classes, */

const TXN_STATE_ADDED     = Symbol( "txn_state_added" );
const TXN_STATE_COMMITTED = Symbol( "txn_state_committed" );
const TXN_STATE_PUSHED    = Symbol( "txn_state_pushed" );

export function newDB( storage, options )
{
    assert( DC.kinds.has( kind ) );
    const db = {};
    db.txn_root       = null;
    db.next_entity_id = 0;


    return db;
}

export async function open( storage, root_ptr )
{
    const db = {};
    db.storage = storage;
    db.root_ptr = root_ptr;
    db.txn_chain = fullRead( db, root_ptr );
}

async function fullRead( db, file_ptr )
{
    const txn_serialized = await db.storage.download( file_ptr, {} );
    var next_ptr = null;
    var next = null;
    if( txn_serialized.next )
    {
        next_ptr = db.storage.fpFromPlainData( txn_serialized.next );
        next = fullRead( db, next_ptr );
    }
    const txn = {};
    txn.orig = deserializeTxn( txn_serialized );
}

export async function huh( user, storage, root_ptr )
{
    const root_storage = 42;
    const resp = storage.download( root_ptr);
}

export const initializeStorage = async function createDB( db )
{
    
};

export function addTxn( db, txn )
{
    /* TODO: check the txn at all? */
    return Object.assign( {}, db, { added_txns: { txn: txn, prev: db.txn_root } } );
};

export async function commitAddedTxns( db )
{
    async function helper( txn )
    {
        if( ( !txn ) || txn.state === TXN_STATE_COMMITTED || txn.state === TXN_STATE_PUSHED )
            return txn;
        const prev = helper( txn.prev );
        return { txn: txn, datoms: [ /* TODO: run txn */ ], prev: prev }
    }
}

export async function pushCommittedTxns( db )
{
    async function helper( txn )
    {
        if( !txn )
            return db.root_file_ptr;
    }
    prev_file_ptr = null;
    //for( const txn of db. )
    //{}
}

// class MonolithicUnorderedxxx
// {
//     constructor( storage, is_public, is_shared )
//     {
//         this.storage = storage;
//         this.eavt    = [];
//         this.aevt    = [];
//         this.avet    = [];
//         this.vaet    = [];
//         this.txns    = [];
//         this.next_entity_id = 0;
//         this.attributes     = {};
//         this.functions      = {};
//     }
// }



// example = '[ "p1", "p2", "p3" ] {  }';




