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


/* There are two slightly different versions of transaction objects: in-memory vs stored
 * Both versions have the following:
 * - txn_stmts: The raw pre-txn processing source
 * - datoms: The result of txn processing; null if the txn failed
 * - DB meta-data : ??? next entity ID ??? etc ???
 *
 * The in-memory version has:
 * - prev : a pointer to the previous committed transaction
 * - file_ptr : a pointer to the uploaded copy of the txn (only if uploaded)
 *
 * The stored version has:
 * - prev_ptr : a pointer to the uploaded copy of the previous txn
 */

/* This is kind of like a class, but we can't use classes, because async. */
const dbMethods =
{
    commitTxn : async function commitTxn( db, stmts )
    {
        var entity_id_info = db.entity_id_info;
        const txn = { stmts: stmts, prev: db.txns };
        try {
            [ txn.datoms, entity_id_info ] = await processTxn( db, stmts );
        }
        catch( err ) {
            // TODO: check err
            console.log( "ERROR. Txn commit", err );
        }
        return Object.assign( {}, db, { txns: txn, entity_id_info: entity_id_info } );
    }
    ,
    uploadCommittedTxns : async function uploadCommittedTxns( db )
    {
        async function uploadChain( txn )
        {
            if( txn === db.last_up_txn )
                return db.last_up_ptr;

            const prev_ptr = db.storage.fpToPlainData( uploadChain( txn.prev ) );
            const txn_to_upload = Object.assign( {}, txn, { prev: prev_ptr } );
            const resp = await db.storage.upload( { body: txn_to_upload }, {} );
            if( !resp.ok )
            {
                throw new Error( "Unimplemented" );
            }
            return resp.file_ptr;
        }

        const txn_ptr = uploadChain( db.txns );
        const db_to_upload = {
            txns: txn_ptr,
            entities: db.entity_id_info
        };
        const resp = await db.storage.upload( { body: txn_to_upload }, {} );
        return Object.assign( {}, db, { last_up_txn: db.txns, last_up_ptr: txn_ptr } );
    }
    ,
    allTxnsUploaded : async function allTxnsUploaded( db )
    {
        return db.root_txn === db.txns;
    }
    ,
    entityIdInfo : function entityIdInfo( db )
    {
        return db.txns.entity_id_info;
    }
};

export function newDB( storage, options )
{
    const db = Object.assign( {}, dbMethods );
    const first_txn = {
        stmts : [],
        datoms : [],
        prev : null,
        next_entity_id : 1
    };
    db.storage        = storage;
    db.last_up_txn    = null;
    db.last_up_ptr    = null;
    db.txns           = first_txn;
    /* TODO???: more initial txns */
    return db;
}

export async function open( storage, root_ptr )
{
    const db = Object.assign( {}, dbMethods );
    db.storage = storage;
    db.last_up_ptr = root_ptr;

    async function downloadChain( file_ptr )
    {
        const resp = await storage.download( file_ptr, {} );
        if( !resp.ok )
        {
            throw new Error( "Unimplemented" );
        }
        const txn = await resp.json();
        if( txn.prev )
        {
            const prev_ptr = await storage.fpFromPlainData( txn.prev );
            txn.prev = downloadChain( prev_ptr );
        }
        /* TODO??? More deserializing */
        return txn;
    }

    db.txns = downloadChain( root_ptr );
    db.last_up_txn = db.txns;
    return db;
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
