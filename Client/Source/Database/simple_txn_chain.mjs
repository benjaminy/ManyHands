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
    db.root_ptr       = null;
    db.next_entity_id = 0;


    return db;
}

export const initializeStorage = async function createDB( db )
{
    
};

export async function open( storage, root_ptr )
{
    const db = {};
    db.storage  = storage;
    db.root_ptr = root_ptr;
    db.txns     = fullRead( db, root_ptr );
}

async function fullRead( db, file_ptr )
{
    const txn = await db.storage.download( file_ptr, {} );
    if( txn.next_ptr )
    {
        txn.next_ptr = db.storage.fpFromPlainData( txn.next_ptr );
        txn.next = fullRead( db, txn.next_ptr );
    }

    /* TODO More stuff */
    return txn;
}

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

export async function submitCommittedTxns( db )
{
    async function helper( txn )
    {
        if( !txn )
            return [ null, null ];
        if( txn.next_ptr )
            return [ db.root_ptr, txn ];
        const [ next_ptr, next ] = helper( txn.next );
        const txn_uploaded = Object.assign( {}, txn, {} );
        const resp = db.storage.upload( {}, {} );
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




