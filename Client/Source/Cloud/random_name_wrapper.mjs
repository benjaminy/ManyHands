/* Top Matter */

/*
 *
 */

import assert  from "../Utilities/assert";
import A       from "../Utilities/act-thread";

function RandomNameWrapper( storage )
{
    const rstorage = Object.assign( {}, storage );

    rstorage.upload = A( async function upload( actx, path, options ) {
        assert( A.isContext( actx ) );

        const o = Object.assign( {}, options );
        o.headerHook = function addIfMatch( headers )
        {
            if( "headerHook" in options )
                options.headerHook( headers );
            if( headers.has( "If-Match" ) )
            {
                actx.log( "WARNING: Overwriting If-Match", headers.get( "If-Match" ) );
                headers.delete( "If-Match" );
            }
            headers.set( "If-Match", "*" );
        };

        while( true )
        {
            const name = "TODO: randomly generate name";
            try {
                const response = await storage.upload(
                    actx, M.pathJoin( path, name ), o );
                const r = Object.assign( {}, response );
                r.random_name = name;
                return r;
            }
            catch( err ) {
                if( !( err === 412 ) ) {
                    throw err;
                }
            }
        }
    } );

    return rstorage;
}

function AtomicUpdateWrapper( storage )
{
    const astorage = Object.assign( {}, storage );

    astorage.upload = A( async function upload( actx, path, options ) {
        assert( A.isContext( actx ) );
        assert( M.isPath( path ) );
        assert( "etag" in options );

        const o = Object.assign( {}, options );
        o.headerHook = function addIfMatch( headers )
        {
            if( "headerHook" in options )
                options.headerHook( headers );
            if( headers.has( "If-Match" ) )
            {
                actx.log( "WARNING: Overwriting If-Match", headers.get( "If-Match" ) );
                headers.delete( "If-Match" );
            }
            headers.set( "If-Match", options.etag );
        };

        const new_etag = "TODO: randomly generate tag";
            try {
                const response = await storage.upload(
                    actx, M.pathJoin( path, name ), o );
                const r = Object.assign( {}, response );
                r.random_name = name;
                return r;
            }
            catch( err ) {
                if( !( err === 412 ) ) {
                    throw err;
                }
            }
        }
    } );

    return astorage;
}
