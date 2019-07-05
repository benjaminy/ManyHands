/*
 * Top Matter
 */

/*
 * File Comment
 */

import T from "transit-js";

import assert  from "../Utilities/assert.mjs";
import * as K  from "../Utilities/keyword.mjs";
import * as SW from "../Storage/wrappers.mjs";
import * as DC from "./common.mjs";
import * as DT from "./transaction.mjs";
import * as DA from "./attribute.mjs";
import * as ST from "../Storage/tree.mjs";
import * as TW from "./txn_tree_adaptor.mjs";

const kPrev =         T.keyword("prev");
const kStmts =        T.keyword("stmts");
const kDatoms =       T.keyword("datoms");
const kStorage =      T.keyword("storage");
const kNextEntityId = T.keyword("next_entity_id");

/*
 * Txn object:
 * Both versions have the following:
 * - txn_stmts: The raw pre-txn processing source
 * - datoms: The result of txn processing; null if the txn failed
 * - prev : a pointer to the previous committed transaction (in-mem vs stored different)
 * - DB meta-data : ??? next entity ID ??? etc ???
 */

export async function commitTxn( db, stmts )
{
    const current_node = db.node;
    const [ datoms, entity_id_info ] = await DT.processTxn( db, stmts );
    let wrap;
    try {
        const storage = await ST.getChild( current_node, kStorage );
        wrap = TW.tree_adaptor( storage );
    } catch( ex )
    {
        if( ex.type !== "FileNotFoundError" ){
            throw ex;
        } else {
            wrap = await TW.initialize_tree_adaptor();
        }
    }
    const new_storage = await wrap.add( ...datoms );
    const db_node = ST.newNode();
    ST.setValue( db_node, kStmts,        stmts );
    ST.setValue( db_node, kDatoms,       datoms );
    ST.setValue( db_node, kNextEntityId, entity_id_info );
    ST.setChild( db_node, kPrev,         current_node );
    ST.setChild( db_node, kStorage,      new_storage.node );
    return wrapDB(db_node);
}

export async function find( db, ...options )
{
    const current_node = db.node;
    let wrap;
    try {
        const storage = await ST.getChild( current_node, kStorage );
        wrap = TW.tree_adaptor( storage );
    } catch( ex )
    {
        if( ex.type !== "FileNotFoundError" ){
            throw ex;
        } else {
            wrap = await TW.initialize_tree_adaptor();
        }
    }
    return wrap.find( ...options );
}
// ,
// uploadCommittedTxns : async function uploadCommittedTxns( db )
// {
//     async function uploadChain( txn )
//     {
//         if( txn === db.last_up_txn )
//             return db.last_up_ptr;

//         const prev_ptr = db.storage.fpToPlainData( uploadChain( txn.prev ) );
//         const txn_to_upload = Object.assign( {}, txn, { prev: prev_ptr } );
//         const resp = await db.storage.upload( { body: txn_to_upload }, {} );
//         if( !resp.ok )
//         {
//             throw new Error( "Unimplemented" );
//         }
//         return resp.file_ptr;
//     }

//     const txn_ptr = uploadChain( db.txns );
//     const db_to_upload = {
//         txns: txn_ptr,
//         entities: db.entity_id_info
//     };
//     const resp = await db.storage.upload( { body: txn_to_upload }, {} );
//     return Object.assign( {}, db, { last_up_txn: db.txns, last_up_ptr: txn_ptr } );
// }
// ,
// allTxnsUploaded : async function allTxnsUploaded( db )
// {
//     return db.root_txn === db.txns;
// }
// ,
// entityIdInfo : function entityIdInfo( db )
// {
//     return db.txns.entity_id_info;
// }

export function wrapDB( node ){
    return {
        node: node,
        attributes: T.map(), // cache
        next_entity_id: ST.getValue(node, kNextEntityId)
        // this may be incremented, while the value in the node
        // will not be changed.
    };
}

export function newDB( root_node )
{
    // I am assuming we will not have 1000 builtins
    const first_entity = 1000;
    const db_node = ST.newNode()
    ST.setValue(db_node, kStmts,        []);
    ST.setValue(db_node, kDatoms,       []);
    // ST.setChild(db_node, kPrev,         null);
    // ST.setChild(db_node, kStorage,         null);
    ST.setValue(db_node, kNextEntityId, first_entity);

    // db.attributes     = T.map(); // cached attributes
    return wrapDB( db_node );
}

export async function traverseHistory( db, hops ){
    let land_node = db.node;
    while(hops > 0){
        land_node = await ST.getChild( land_node, kPrev );
        hops--;
    }
    return wrapDB( land_node );
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

const early_exit_symbol = Symbol( "EARLY_EXIT" );

function earlyExit( value )
{
    throw [ early_exit_symbol, value ];
}

async function fold_txns_newest_first( db, f, initial_val, f_is_async )
{
    /* assert( sanity check db ) */
    var accumulator = initial_val;
    var txn = db.txns;
    while( txn )
    {
        try {
            const v = f( txn, accumulator );
            accumulator = f_is_async ? await v : v;
            txn = txn.next;
            /* TODO: await every so often */
        }
        catch( err ) {
            if( Array.isArray( err )
                && err.length === 2
                && err[ 0 ] === early_exit_symbol )
            {
                return err[ 1 ];
            }
            throw err;
        }
    }
    return accumulator
}

async function fold_txns_oldest_first( db, f, initial_val, f_is_async )
{
    /* assert( sanity check db ) */
    async function helper( txn )
    {
        if( txn )
        {
            /* TODO: await every so often */
            const v = f( txn, helper( txn.next ) );
            /* TODO: await every so often */
            return f_is_async ? await v : v;
        }
        else
        {
            return initial_val;
        }
    }

    try {
        return helper( db.txns );
    }
    catch( err ) {
        if( Array.isArray( err )
            && err.length === 2
            && err[ 0 ] === early_exit_symbol )
        {
            return err[ 1 ];
        }
        throw err;
    }
}

const fold_txns = fold_txns_newest_first;

/*
 * "thing" can be 1 of 3 kinds of value:
 * 1. An entity id.  Just verify it's a valid id
 * 2. A keyword.  Look for an entity with this ident
 * 3. A lookup ref: [ keyword, value ].  Look for an entity with the given value
 *    for the given attribute
 *
 * Returns either an entity object or null.
 */
export async function entity( db, thing )
{
    if( T.isInteger( thing ) )
    {
        const find_ent_id = function( txn )
        {
            if( thing in txn.datoms )
            {
                /* throws: */
                earlyExit( new Entity );
            }
            return null;
        };
        return fold_txns( db, find_ent_id, null );
    }
    else if( T.isKeyword( thing ) )
    {
        const find_ident = function( txn )
        {
            if( txn.failed )
                return null;
            for( const [ e, a, v, t, add ] of txn.datoms )
            {
                const ae = entity( db, a );
                if( thing === ae.get( DA.identK ) )
                {
                    if( add )
                        earlyExit( new Entity );
                    else
                        earlyExit( null );
                }
            }
            if( thing in txn.datoms )
            {
                /* throws: */
            }
            return null;
        };
        return fold_txns( db, find_ident, null );
    }
    else if( Array.isArray( thing ) && thing.length === 2 )
    {
        const [ attr, val ] = thing;
        throw new Error( "unimplemented" );
        /* TODO: assert attr is attribute and unique */
    }
    else
    {
        throw new Error(
            "Type error.  Expecting integer, keyword or lookup ref. Got" +
                typeof( thing ) );
    }
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
