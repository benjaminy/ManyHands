/*
 * Top Matter
 */

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

    function generateSignKey() {
        return WCS.generateKey(
            { name: "HMAC", hash:"SHA-256" }, true, [ "sign", "verify" ] );
    }
    function sign( data, file_ptr ) {
        return WCS.sign( { name: "HMAC" }, file_ptr.keyS, data );
    }
    function verify( signature, data, file_ptr ) {
        return WCS.verify( { name: "HMAC" }, file_ptr.keyS, signature, data );
    }

    const rand_name_signed_storage =
        SW.filePtrGenWrapper(
            { param_name: "keyS",
              keyS_generator: generateSignKey },
            SW.authenticityWrapper(
                { tag_bytes: 32,
                  sign: sign,
                  verify: verify },
                SW.randomNameWrapper( storage ) ) );

    if( kind === DC.KIND_PRIVATE || kind === DC.KIND_TEAM )
    {
        function generateCryptKey() {
            return WCS.generateKey(
                { name: "AES-CBC", length:256 }, true, [ "encrypt", "decrypt" ] );
        }
        function generateIV() {
            return Promise.resolve( new Uint8Array( 16 ) );
        }
        function encrypt( data, file_ptr ) {
            return WCS.encrypt( { name: "AES-CBC", iv:file_ptr.iv }, file_ptr.keyC, data );
        }
        function decrypt( data, file_ptr ) {
            return WCS.decrypt( { name: "AES-CBC", iv:file_ptr.iv }, file_ptr.keyC, data );
        }
        var bloop_storage =
            SW.filePtrGenWrapper(
                { param_name: "keyC",
                  keyC_generator: generateCryptKey },
                SW.filePtrGenWrapper(
                    { param_name: "iv",
                      iv_generator: generateIV },
                    SW.confidentialityWrapper(
                        { encrypt: encrypt,
                          decrypt: decrypt },
                        rand_name_signed_storage ) ) );
    }
    else
    {
        var bloop_storage = rand_name_signed_storage;
    }
    db.storage = SW.encodingWrapper( SW.SK_JSON, {}, bloop_storage );

    return db;
}

export const readDB( user, storage, kind )
{
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




