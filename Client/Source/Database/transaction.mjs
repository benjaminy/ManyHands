/* Top Matter */

import * as K  from "../Utilities/keyword";
import A       from "../Utilities/act-thread";
import * as DA from "./attribute";

export const addK     = K.key( ":db/add" );
export const retractK = K.key( ":db/retract" );
export const idK      = K.key( ":db/id" );

function new_entity( db )
{
    const eid = db.next_entity_id;
    db.next_entity_id++;
    return eid;
}

const attrQuery = Q.parseQuery( [
    Q.findK, [ "?vtype", "?card", "?doc", "?uniq", "?idx", "?ftxt", "?isComp", "?noHist" ],
    Q.inK, "$", "?ident",
    Q.whereK, [ "?attr", DA.identK,       "?ident" ],
              [ "?attr", DA.valueTypeK,   "?vtype" ],
              [ "?attr", DA.cardinalityK, "?card" ],
              [ "?attr", DA.docK,         "?doc" ],
              [ "?attr", DA.uniqueK,      "?uniq" ],
              [ "?attr", DA.indexK,       "?idx" ],
              [ "?attr", DA.fulltextK,    "?ftxt" ],
              [ "?attr", DA.isComponentK, "?isComp" ],
              [ "?attr", DA.noHistoryK,   "?noHist" ] ] );

/*
" [ :find [ ?vtype ?card ?doc ?uniq ?idx ?ftxt ?isComp ?noHist ]
    :in $ ?ident
    :where [ ?attr :db/ident       ?ident ]
           [ ?attr :db/valueType   ?vtype ]
           [ ?attr :db/cardinality ?card ]
           [ ?attr :db/doc         ?doc ]
           [ ?attr :db/unique      ?uniq ]
           [ ?attr :db/index       ?idx ]
           [ ?attr :db/fulltext    ?ftxt ]
           [ ?attr :db/isComponent ?isComp ]
           [ ?attr :db/noHistory   ?noHist ] ] "
*/

const getAttribute = A( async function getAttribute( actx, db, identName ) {
    const ident = K.key( identName );

    if( !( ak in db.attributes ) )
    {
        try {
            [ v, c, d, u, i, f, ic, n ] = await Q.runQuery( actx, db, attrQuery, ak );
            db.attributes[ ak ] = DA.makeAttribute( ident, v, c, d, u, i, f, ic, n );
        }
        catch( err ) {
            if( err === queryFailure )
            {
                throw new Error( "DB does not have attribute "+identName );
            }
            else
            {
                throw err;
            }
        }
    }

    return db.attributes[ ak ];
} );

/* Input: an array of txn statements
 * Output: either throw an exception, or return an array of datoms */
const processTxn = A( function* processTxn( db, txn )
{
    /* assert( typeof( db )  == database ) */
    /* assert( typeof( txn ) == array of statements ) */

    var datoms = [];
    var temp_ids = {};

    function getEntityId( e ) {
        if( !e )
            return new_entity( db );
        /* "else" */

        if( Number.isInteger( e ) )
        {
            /* TODO: check that e is a valid entity id */
            return e;
        }
        /* "else" */

        try {
            return temp_ids[ e ];
        }
        catch() {
            const eid = DB.new_entity( db );
            temp_ids[ e ] = eid;
            return eid
        }
    }

    function addDatom( e, a, v )
    {
        var attribute = getAttribute( db, a );
        var value     = normalizeValue( attribute, v );

        if( attribute.unique )
        {
            var unique = K.key( attribute.unique );

            if( unique === DA.uniqueValue )
            {
                throw new Error( "Unimplemented" );
            }

            else if( unique === DA.uniqueIdentity )
            {
                throw new Error( "Unimplemented" );
            }

            else
                throw new Error( "Invalid attribute uniqueness " + unique.toString() );
        }

        var card = K.key( attribute.cardinality );
        if( card === DA.cardinalityOne )
        {
            /* TODO: add retract if there is an existing value */
        }
        else if( card === DA.cardinalityMany )
        {
            /* TODO: nothing??? */
        }
        else
        {
            throw new Error( "Invalid attribute cardinality " + card.str );
        }

        datoms.push( [ e, attribute, value ] );
    }

    function processStmt( stmt, i ) {
        if( Array.isArray( stmt ) )
        {
            var kind = K.key( stmt[ 0 ] );
            if( stmt[ 0 ] === addK ) {
                addDatom( getEntityId( stmt[ 1 ] ), stmt[ 2 ], stmt[ 3 ] );
            }
            else if( stmt[ 0 ] === retractK ) {
                var e = getEntityId( stmt[ 1 ] );
                var attribute = db.getAttribute( stmt[ 2 ] );
                var value     = DA.normalizeValue( attribute, stmt[ 3 ] );
                /* Check that v is e's value for attribute a? */
                datoms.push( [ e, attribute, value, true ] );
            }
            else {
                var f = lookupFunction( db, K.key( stmt[ 0 ] ) );
                stmt.shift(); // remove function name
                var fn_datoms = f.fn.apply( db, stmt );
                fn_datoms.forEach( function( [ e, a, v ] ) {
                    addDatom( getEntityId( e ), a, v );
                } );
            }
        }
        else
        {
            const idS = K.str( idK );
            try {
                var e = getEntityId( stmt[ idK ] );
            }
            catch( err ) {
                try {
                    var e = getEntityId( stmt[ idS ] );
                }
                catch( err ) {
                    var e = DB.new_entity( db );
                }
            }
            for( const attr in stmt )
            {
                const a = K.key( attr );
                if( a === idK || a === idS )
                    continue;
                addDatom( e, a, stmt[ attr ] );
            }
        }
    }

    try {
        db.txns.forEach( processStmt );
    }
    catch( err ) {
    }
} );


export {}

// DB.query = function( db, q )
// {
//     var datoms = [];
//     function eatTxns( txn, i )
//     {
//         function eatDatoms( datom, j )
//         {
//             if( datom.a.startsWith( q ) )
//             {
//                 datoms.push( datom );
//             }
//         }
//         txn.datoms.map( eatDatoms );
//     }
//     db.txns.map( eatTxns );
//     return datoms;
// }




DB.uploadTxn = A( function *uploadTxn( db, txn )
{
    var wrapped = {
        t: txn,
        n: db.cloud_head,
        v: db.current_vector
    };
    /* new random file name */
    /* add timestamp */
} );

DB.txnStatementToWire( stmt )
{
 * [ TXN_STMT_ADD,     e, a, v ]
 * avs
 * [ TXN_STMT_RETRACT, e, a, v ]
 * [ fn-name (keyword), p1, p2, p3, ... ]
 */
}

DB.uploadOneTxn = async( '', function *( txn )
{
    var wire_txn = {
        prev : txn.prev;
    }
} );

DB.save = function()
{
    var txn_head = {}
    var datoms_head = {}
    var txn_prev = txn_head;
    var datoms_prev = datoms_head;
    var i;
    for( i = this.txn_chain.length - 1; i >= 0; i-- )
    {
        if( txn.saved )
            break;
    }
    i++;
    for( ; i < this.txn_chain.length; i++ )
    {
        var txn = txn_chain[ i ];
        if( txn.saved )
            break;
        file = save;
        txn_prev.next = file;
        txn_prev = txn;
    }
    // ffoooo
}

var DB.readFromCloud = async( 'DB.readFromCloud', function *(
    scp, log, download, decrypt ) {
    var txn_pointer_encrypted = yield download( [ 'Data', 'Txns' ] );
    var txn_pointer_encoded   = yield decrypt( txn_pointer_encrypted );
    var txn_pointer           =       JSON.parse( decode( txn_pointer_encoded ) );
    var filename = txn_pointer.filename;
    var txns = [];
    do {
        var txn_encrypted = yield download( [ 'Data', filename ] );
        var txn_encoded   = yield decrypt( txn_encrypted );
        var txn           =       JSON.parse( decode( txn_encoded ) );
        filename          = txn.n;
        txns.push( txn );
    } while( filename );
    return txns;
} );

function isTxnStmt( thing )
{
    if( Array.isArray( thing ) )
    {
        try {
            var first = K.key( thing[ 0 ] );
        }
        catch( err ) {
            return false
        }
        if( first === addK || first === retractK )
        {
            try {
                var e = thing[ 1 ];
                var a = thing[ 2 ];
                var v = thing[ 3 ];
            }
            catch( err ) {
                return false;
            }
            /* TODO: examine e, a, v */
            return true;
        }
        else
        {
            /* TODO: examine f, ps */
            return true;
        }
    }
    else if( thing === Object( thing ) )
    {
        for( const attr_name in thing )
        {
            try {
                var attr = K.key( attr_name );
            }
            catch( err ) {
                return false;
            }
            const val = thing[ attr_name ];
            /* TODO: examine attr, val */
        }
        return true;
    }
    return false;
}

function isTxn( thing )
{
    if( !Array.isArray( thing ) )
        return false;
    return thing.every( isTxnStmt )
}
