/* Top Matter */

/*
 * File comment
 */

import assert from "../Utilities/assert.mjs";
import * as L from "../Utilities/logging.mjs";

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
        L.warn( "Overwriting header", header_name,
                "WAS:", headers.get( header_name ),
                "NOW:", header_value );
        headers.delete( header_name );
    }
    headers.set( header_name, header_value );
}
