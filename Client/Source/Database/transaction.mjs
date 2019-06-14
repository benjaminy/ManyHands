/* Top Matter */

import * as K  from "../Utilities/keyword.mjs";
import * as DA from "./attribute.mjs";
import * as Q from "./query.mjs";
import * as A from "./attribute.mjs";

export const addK     = K.key( ":db/add" );
export const retractK = K.key( ":db/retract" );
export const idK      = K.key( ":db/id" );

function new_entity( db )
{
    const eid = db.next_entity_id;
    db.next_entity_id++;
    return eid;
    //return [ eid, Object.assign( {}, db, { next_entity_id: eid + 1 } ) ];
}

export async function getAttribute( db, identName ) {
    const ident = K.key( identName );

    if(DA.dbSymbolMap.has(ident)){
        return DA.makeBuiltin(ident, DA.dbSymbolMap.get(ident));
    }

    if( !( db.attributes.has(ident) ) )
    {
        const qResult = await Q.runQuery( db, Q.attrQuery, ident );
        // console.log(qResult, await Q.runQuery(db, Q.attrQuery, ident.str));
        if(qResult.length === 0){
            throw new Error( "DB does not have attribute " + ident.toString());
        }
        const [ [ id, v, c, d, u, i, f, ic, n ] ] = qResult; // TODO: cardinality should flatten this from [[]] to []
        db.attributes.set( ident, DA.makeAttribute( ident, id, v, c, d, u, i, f, ic, n ) );
    }
    return db.attributes.get( ident );
}

/**
 * Convert this attribute into a set of inserts
 */
export function insertAttribute( attr ){
    const temp_id = attr.ident.toString();
    return [
        [addK, temp_id, A.identK, attr.ident],
        [addK, temp_id, A.valueTypeK, attr.valueType],
        [addK, temp_id, A.cardinalityK, attr.cardinality],
        [addK, temp_id, A.docK, attr.doc],
        [addK, temp_id, A.uniqueK, attr.unique],
        [addK, temp_id, A.indexK, attr.index],
        [addK, temp_id, A.fulltextK, attr.fulltext],
        [addK, temp_id, A.isComponentK, attr.isComponent],
        [addK, temp_id, A.noHistoryK, attr.noHistory]
    ];
}

/* Input: an array of txn statements
 * Output: either throw an exception, or return an array of datoms */
export async function processTxn( db, stmts )
{
    /* assert( typeof( db )  == database ) */
    /* assert( typeof( txn ) == array of statements ) */

    const datoms = [];
    const temp_ids = {};


    /*
     * Convert "value" into the proper kind of value, as indicated by
     * "attribute".valueType.
     *
     * If value is already the proper kind, just return value.
     *
     * If conversion is not possible (i.e. the input is bad), throw an Error.
     */
    function normalizeValue( attribute, value )
    {
        if(attribute.builtin === true){
            return value; // TODO what do normalized values
            // look like for some of the builtins?
            // if they also had .valueType we could just
            // delete this.
        }
        const vType = K.key( attribute.valueType );

        let v;

        if( vType === A.vtypeBigint )
            throw new Error( "Unimplemented" );

        else if( vType === A.vtypeFloat )
            throw new Error( "Unimplemented" );

        /*else if( vType === A.vtypeInstant )
            throw new Error( "Unimplemented" );
        */
        else if( vType === A.vtypeUuid )
            throw new Error( "Unimplemented" );

        /*else if( vType === A.vtypeUri )
            throw new Error( "Unimplemented" );*/

        else if( vType === A.vtypeBytes )
            throw new Error( "Unimplemented" );

        else if( vType === A.vtypeKeyword )
            v = K.key( value );

        else if( vType === A.vtypeDouble )
            v = 0.0 + value;

        else if( vType === A.vtypeString )
            v = String( value );

        else if( vType === A.vtypeBoolean )
        {
            if( value === true || value === false )
                v = value;
            else
                throw new Error( "TODO" );
        }

        /* XXX stupid JavaScript numbers!  Only get 52 bits. */
        else if( vType === A.vtypeLong )
        {
            v = 0.0 + value;
            if( !Number.isInteger( v ) )
                throw new Error( "TODO" );
        }

        else if( vType === A.vtypeRef )
        {
            return getEntityId( value );
        }

        else
            throw new Error( "Invalid attribute valueType " + vType );

        return v;
    }

    function getEntityId( e )
    {
        if( !e )
            return new_entity( db );
        /* "else" */

        if( Number.isInteger( e ) )
        {
            if(DA.dbIdMap.has(e)){
                throw new Error("Cannot edit the entity of a builtin entity.");
            }
            if(e >= db.next_entity_id){
                return new_entity(db);
            }
            // TODO make sure this entity exists in the db already.
            return e;
        }
        /* "else" */

        // TODO allow for setting :ident and referring back to entity by key, rather than id.

        if(e in temp_ids) {
            return temp_ids[ e ];
        }
        const eid = new_entity( db );
        temp_ids[ e ] = eid;
        return eid;
    }

    async function addDatom( e, a, v )
    {
        const entity    = getEntityId( e );
        const attribute = await getAttribute( db, a );
        const value     = normalizeValue( attribute, v );

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
        if( attribute.cardinality ) {
            const card = K.key(attribute.cardinality);
            if (card === DA.cardinalityOne) {
                /* TODO: add retract if there is an existing value */
            } else if (card === DA.cardinalityMany) {
                /* TODO: nothing??? */
            } else {
                throw new Error("Invalid attribute cardinality " + card.str);
            }
        }

        datoms.push({entity: entity, attribute: attribute.id, value: value});
    }

    async function processStmt( stmt, i ) {
        if( Array.isArray( stmt ) )
        {
            const kind = K.key( stmt[ 0 ] );
            if( K.compare(kind, addK) === 0 ) {
                await addDatom( await getEntityId( stmt[ 1 ] ), stmt[ 2 ], stmt[ 3 ] );
            }
            else if( stmt[ 0 ] === retractK ) {
                const e = await getEntityId( stmt[ 1 ] );
                const attribute = await db.getAttribute( stmt[ 2 ] );
                const value     = normalizeValue( attribute, stmt[ 3 ] );
                /* Check that v is e's value for attribute a? */
                datoms.push( [ e, attribute, value, true ] );
            }
            else {
                const f = lookupFunction( db, K.key( stmt[ 0 ] ) );
                stmt.shift(); // remove function name
                const fn_datoms = f.fn.apply( db, stmt );
                fn_datoms.forEach( function( [ e, a, v ] ) {
                    addDatom( getEntityId( e ), a, v ); // TODO PROMISE TROUBLE
                } );
            }
        }
        else
        {
            const idS = K.str( idK );
            let e;
            try {
                e = await getEntityId( stmt[ idK ] );
            }
            catch( err ) {
                try {
                    e = await getEntityId( stmt[ idS ] );
                }
                catch( err ) {
                    e = DB.new_entity( db );
                }
            }
            for( const attr in stmt )
            {
                const a = K.key( attr );
                if( a === idK || a === idS )
                    continue;
                await addDatom( e, a, stmt[ attr ] );
            }
        }
    }

    try {
        await Promise.all(stmts.map(processStmt));
    }
    catch( err ) {
        console.error(err);
    }
    return [datoms, "extra entity information"];
}


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




export function txnStatementToWire( stmt )
{
 // * [ TXN_STMT_ADD,     e, a, v ]
 // * avs
 // * [ TXN_STMT_RETRACT, e, a, v ]
 // * [ fn-name (keyword), p1, p2, p3, ... ]
 // */
}

// DB.save = function()
// {
//     var txn_head = {}
//     var datoms_head = {}
//     var txn_prev = txn_head;
//     var datoms_prev = datoms_head;
//     var i;
//     for( i = this.txn_chain.length - 1; i >= 0; i-- )
//     {
//         if( txn.saved )
//             break;
//     }
//     i++;
//     for( ; i < this.txn_chain.length; i++ )
//     {
//         var txn = txn_chain[ i ];
//         if( txn.saved )
//             break;
//         file = save;
//         txn_prev.next = file;
//         txn_prev = txn;
//     }
//     // ffoooo
// }

// var DB.readFromCloud = async( 'DB.readFromCloud', function *(
//     scp, log, download, decrypt ) {
//     var txn_pointer_encrypted = await download( [ 'Data', 'Txns' ] );
//     var txn_pointer_encoded   = await decrypt( txn_pointer_encrypted );
//     var txn_pointer           =       JSON.parse( decode( txn_pointer_encoded ) );
//     var filename = txn_pointer.filename;
//     var txns = [];
//     do {
//         var txn_encrypted = await download( [ 'Data', filename ] );
//         var txn_encoded   = await decrypt( txn_encrypted );
//         var txn           =       JSON.parse( decode( txn_encoded ) );
//         filename          = txn.n;
//         txns.push( txn );
//     } while( filename );
//     return txns;
// } );

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
