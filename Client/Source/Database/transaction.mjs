/* Top Matter */

import * as K from "../Utilities/keyword.mjs";
import * as DA from "./attribute.mjs";

export const addK     = K.key( ":db/add" );
export const retractK = K.key( ":db/retract" );
export const idK      = K.key( ":db/id" );

DB.new_entity = function( db )
{
    var rv = db.next_entity_id;
    db.next_entity_id++;
    return rv;
}

const getAttribute = actFn( function* getAttribute( db, attr ) {
    /* TODO: fetch if not cached */
    const k = K.key( attr );
    return db.attributes[ k.idx ];
} );

/* Input: an array of txn statements
 * Output: either throw an exception, or return an array of datoms */
const processTxn = actFn( function* processTxn( db, txn )
{
    /* assert( typeof( db )  == database ) */
    /* assert( typeof( txn ) == array of statements ) */

    var datoms = [];
    var temp_ids = {};

    function getEntity( e ) {
        if( !e )
            return DB.new_entity( db );
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
                addDatom( getEntity( stmt[ 1 ] ), stmt[ 2 ], stmt[ 3 ] );
            }
            else if( stmt[ 0 ] === retractK ) {
                var e = getEntity( stmt[ 1 ] );
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
                    addDatom( getEntity( e ), a, v );
                } );
            }
        }
        else
        {
            const idS = K.str( idK );
            try {
                var e = getEntity( stmt[ idK ] );
            }
            catch( err ) {
                try {
                    var e = getEntity( stmt[ idS ] );
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
}


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


