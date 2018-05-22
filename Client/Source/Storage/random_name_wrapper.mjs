/* Top Matter */

/*
 *
 */

import assert  from "../Utilities/assert";
import A       from "../Utilities/act-thread";

function RandomNameWrapper( storage )
{
    const rstorage = Object.assign( {}, storage );

    rstorage.upload = A( function* upload( path, options ) {
        const o = Object.assign( {}, options );
        o.headerHook = function addIfMatch( headers )
        {
            if( "headerHook" in options )
                options.headerHook( headers );
            if( headers.has( "If-Match" ) )
            {
                A.log( "WARNING: Overwriting If-Match", headers.get( "If-Match" ) );
                headers.delete( "If-Match" );
            }
            headers.set( "If-Match", "*" );
        };

        while( true )
        {
            const name = "TODO: randomly generate name";
            try {
                const response = yield storage.upload( M.pathJoin( path, name ), o );
                const r = Object.assign( {}, response );
                r.random_name = name;
                return r;
            }
            catch( err ) {
                if( !( err === 412 ) ) {
                    throw err;
                }
                A.log( "Name collision" );
            }
        }
    } );

    return rstorage;
}

function AtomicUpdateWrapper( storage )
{
    const astorage = Object.assign( {}, storage );

    astorage.upload = A( function* upload( path, options ) {
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

        try {
            var response = await storage.upload(
                actx, M.pathJoin( path, name ), o );
        }
        catch( err ) {
            if( err === 412 )
            {
                
                throw err;




            }
        }
            var r = Object.assign( {}, response );
            r.random_name = name;
            return r;
    } );

    return astorage;
}
