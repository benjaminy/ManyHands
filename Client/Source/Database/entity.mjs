/*
 * Top Matter
 */

/*
 * File Comment
 */

async function get( entity, thing )
{
    if( T.isInteger( thing ) )
    {
        try {
            return entity.attr_cache[ thing ];
        }
        catch( err ) {
            /* Log? */
        }
        throw new Error( "unimplemented" );
        /* TODO: lookup thing in entity.db; update cache */
    }
    else if( T.isKeyword( thing ) )
    {
        var id;
        try {
            id = entity.attr_id_translation_cache[ thing ];
        }
        catch( err ) {
            /* Log? */
            throw new Error( "unimplemented" );
            /* TODO: lookup id for thing in entity.db; update cache */
        }
        return await get( entity, id );
    }
    else
    {
        throw new Error(
            "Type error.  Expecting integer or keyword. Got" + typeof( thing ) );
    }
}

export function makeEntityObj( db, id, attrs )
{
    const ent = {};

    ent.db = db;
    ent.id = id;
    ent.attr_cache = {};
    /* ??? When transit Keywordss are used as object key, it's a string??? ok??? */
    ent.attr_id_tranlation_cache = {};
    if( attrs )
    {
        for( const [ k, v, i ] of attrs )
        {
            const id = i ? i : db.lookup( k );
            ent.attr_cache[ id ] = v;
            ent.attr_id_translation_cache[ k ] = id;
        }
    }

    /* NOTE: effectively async, because "get" is async */
    ent.get = function( thing ) {
        return get( this, thing );
    }

    return ent;
}
