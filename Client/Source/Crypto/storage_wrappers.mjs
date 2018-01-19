/* Top Matter */

/*
 *
 */

import assert  from "../Utilities/assert";
import A       from "../Utilities/act-thread";

function KeyGenWrapper( storage )
{
    const cstorage = Object.assign( {}, storage );

    cstorage.upload = A( async function upload( actx, path, options ) {
        assert( A.isContext( actx ) );
        assert( M.isPath( path ) );

        const o = Object.assign( {}, options );
        o.key = "TODO: randomly generate key";
        const response = await storage.upload( actx, path, o );
        const r = Object.assign( {}, response );
        r.generated_key = key;
        return r;
    } );

    return cstorage;
}

function SecretKeyWrapper( storage )
{
    const cstorage = Object.assign( {}, storage );

    cstorage.upload = A( async function upload( actx, path, options ) {
        assert( A.isContext( actx ) );
        assert( M.isPath( path ) );
        assert( "key" in options, "Missing key" );
        assert( "body" in options, "Why encrypt an empty file?" );
        /* assert( options.body is some kind of array buffer ) */

        const o = Object.assign( {}, options );
        o.headerHook = function contentTypeOctetStream( headers )
        {
            if( "headerHook" in options )
                options.headerHook( headers );
            if( headers.has( "Content-Type" ) )
            {
                actx.log( "WARNING: Overwriting Content-Type",
                          headers.get( "Content-Type" ) );
                headers.delete( "Content-Type" )
            }
            headers.set( "Content-Type", "application/octet-stream" );
        };

        const data = encrypt( o.body, o.key );
        const mac = encrypt( hash( data ), o.key );
        o.body = concat( mac, data );
        return await storage.upload( actx, path, o );
    } );

    cstorage.download = A( async function downlaod( actx, path, options ) {
        assert( A.isContext( actx ) );
        assert( M.isPath( path ) );
        assert( "key" in options, "Missing key" );

        o.bodyDataKind = "arrayBuffer";
        const response = await storage.download( actx, path, o );
        const r = Object.assign( {}, response );
        const mac = split( r.full_body );
        const encrypted_data = split( r.full_body );
        if( !( mac === encrypt( hash( encrypted_data, o.key ) ) ) )
            throw new Error( "MAC mismatch... Corruption or malfeasance" );
        r.full_body = decrypt( encrypted_data, o.key );
    } );

    return cstorage;
}
