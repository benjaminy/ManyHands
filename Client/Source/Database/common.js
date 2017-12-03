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
