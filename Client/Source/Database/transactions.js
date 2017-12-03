/*
 * Convert "value" into the proper kind of value, as indicated by
 * "attribute".valueType.
 *
 * If value is already the proper kind, just return value.
 *
 * If conversion is not possible (i.e. the input is bad), raise an Error.
 */
function normalizeValue( attribute, value )
{
    var vType = keyword( attribute.valueType );
    if( vType === DB.type.bigint )
        throw new Error( 'Unimplemented' );

    else if( vType === DB.type.float )
        throw new Error( 'Unimplemented' );

    else if( vType === DB.type.instant )
        throw new Error( 'Unimplemented' );

    else if( vType === DB.type.uuid )
        throw new Error( 'Unimplemented' );

    else if( vType === DB.type.uri )
        throw new Error( 'Unimplemented' );

    else if( vType === DB.type.bytes )
        throw new Error( 'Unimplemented' );

    else if( vType === DB.type.keyword )
        var v = keyword( value );

    else if( vType === DB.type.double )
        var v = 0.0 + value;

    else if( vType === DB.type.string )
        var v = value.toString();

    else if( vType === DB.type.boolean )
    {
        if( value === true || value === false )
            var v = value;
        else
            throw new Error( 'TODO' );
    }

    /* XXX stupid JavaScript numbers!  Only get 52 bits. */
    else if( vType === DB.type.long )
    {
        var v = 0.0 + value;
        if( !Number.isInteger( v ) )
            throw new Error( 'TODO' );
    }

    else if( vType === DB.type.ref )
    {
        var v = 0.0 + value;
        if( !Number.isInteger( v ) )
            throw new Error( 'TODO' );
        /* TODO: check that v is an entity in the database */
    }

    else
        throw new Error( 'Invalid attribute valueType ' + vType );

    return v;
}

const getAttribute = actFn( function* getAttribute( db, attr ) {
    /* TODO: fetch if not cached */
    const k = keyword( attr );
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
            var unique = keyword( attribute.unique );

            if( unique == DB.unique.value )
            {
                throw new Error( 'Unimplemented' );
            }

            else if( unique == DB.unique.identity )
            {
                throw new Error( 'Unimplemented' );
            }

            else
                throw new Error( 'Invalid attribute uniqueness ' + unique.toString() );
        }

        var card = keyword( attribute.cardinality );
        if( card === DB.cardinality.one )
        {
            /* TODO: add retract if there is an existing value */
        }
        else if( card === DB.cardinality.many )
        {
            /* TODO: nothing??? */
        }
        else
        {
            throw new Error( 'Invalid attribute cardinality ' + card.str );
        }

        datoms.push( [ e, attribute, value ] );
    }

    function processStmt( stmt, i ) {
        try { /* try block for all forms, except map */
            var kind = keyword( stmt[ 0 ] );
            if( stmt[ 0 ] === DB.add ) {
                addDatom( getEntity( stmt[ 1 ] ), stmt[ 2 ], stmt[ 3 ] );
            }
            else if( stmt[ 0 ] === DB.retract ) {
                var e = getEntity( stmt[ 1 ] );
                var attribute = db.getAttribute( stmt[ 2 ] );
                var value     = db.normalizeValue( attribute, stmt[ 3 ] );
                /* Check that v is e's value for attribute a? */
                datoms.push( [ e, attribute, value, true ] );
            }
            else if( stmt[ 0 ] === TXN_STMT_FORM_FN ) {
                var f = db.functions[ keyword( stmt[ 1 ] ).idx ];
                stmt.shift(); // remove statement kind
                stmt.shift(); // remove function name
                var fn_datoms = f.fn.apply( db, stmt );
                fn_datoms.forEach( function( [ e, a, v ] ) {
                    addDatom( getEntity( e ), a, v );
                } );
            }
            else {
                throw new Error( 'malformed stmt' );
            }
        }
        catch( err ) { /* This happens for map statements */
            try {
                var e = getEntity( stmt[ DB.id.idx ] );
            }
            catch( err ) {
                var e = DB.new_entity( db );
            }
            if(  ) {
                var e = getEntity( stmt[ 1 ] );
                stmt[ 2 ].forEach( function( [ a, v ] ) {
                    addDatom( e, a, v );
                } );
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
