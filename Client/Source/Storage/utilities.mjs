/* Top Matter */

/*
 * File comment
 */

import assert from "../Utilities/assert";
import * as L from "../Utilities/logging";

export function prependHeaderHook( opts, f )
{
    if( !Array.isArray( opts.header_hooks ) )
    {
        opts.header_hooks = [];
    }

    opts.header_hooks.unshift( f );
}

export function appendHeaderHook( opts, f )
{
    if( !Array.isArray( opts.header_hooks ) )
    {
        opts.header_hooks = [];
    }

    opts.header_hooks.push( f );
}

export function overwriteHeader( headers, header_name, header_value )
{
    if( headers.has( header_name ) )
    {
        L.warn( "Overwriting", header_name, headers.get( header_name ) );
        headers.delete( header_name );
    }
    headers.set( header_name, header_value );
}

export function encode_path( ...path_parts )
{
    assert( path_parts.every( ( p ) => ( typeof( p ) === "string" || Array.isArray( p ) ) ) );

    var path = [];

    for( const part of path_parts )
    {
        if( typeof( part ) === "string" )
            path.push( part )
        else
            path = path.concat( part );
    }

    return path.map( encodeURIComponent ).join( "/" );
}

