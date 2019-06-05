/* Top Matter */

/*
 * File comment
 */

import assert from "assert";
import T from "transit-js";

export const ENCODE_OBJ     = T.symbol( "obj" );
export const ENCODE_TRANSIT = T.symbol( "transit" );
export const ENCODE_JSON    = T.symbol( "json" );
export const ENCODE_TEXT    = T.symbol( "text encoding" );
export const ASSOC_DATA     = T.symbol( "associated data" );

export const COND_UPLOAD    = T.symbol( "conditional upload" );
export const COND_ATOMIC    = T.symbol( "atomic upload" );
export const COND_UNIQUE    = T.symbol( "unique upload" );

export const ERROR_KIND     = T.symbol( "storage error kind" );
export const ERROR_OVERWRITE_FAILED = T.symbol( "storage error overwrite failed" );

function mapAssocData( fn, v, options )
{
    if( ASSOC_DATA in options )
    {
        return { secret: fn( v.secret ),
                 integrity_protected: fn( v.integrity_protected ) };
    }
    else
    {
        return = fn( v );
    }
}

var text_encoder, text_decoder;
var transit_writer, transit_reader;

/* This function handles both plain data to text and text to byte array encoding. */
export function encode( value, options )
{
    if( ENCODE_OBJ in options )
    {
        const object_encoding = options[ ENCODE_OBJ ];
        transit_writer = ( transit_writer || object_encoding !== ENCODE_TRANSIT )
            ? transit_writer : T.writer( "json" );
        const encode_fn =
              object_encoding === ENCODE_TRANSIT ? transit_writer
              : ( object_encoding === ENCODE_JSON ? JSON.stringify
                  : undefined );
        if( !encode_fn )
        {
            throw new Error( "Unsupported option" );
        }
        value = mapAssocData( encode_fn, value, options );
    }

    if( ENCODE_TEXT in options )
    {
        /* NOTE: Apparently the overlords of the web think utf-8 is the only
         * text encoding that matters.  They might be right. */
        text_encoder = text_encoder ? text_encoder : new TextEncoder();
        return mapAssocData( text_endcoder, value, options );
    }

    return value;
}

export function decode( value, options )
{
    if( ENCODE_TEXT in options )
    {
        text_decoder = text_decoder ? text_decoder : new TextDecoder();
        value = mapAssocData( text_decoder, value, options );
    }

    if( ENCODE_OBJ in options )
    {
        const object_encoding = options[ ENCODE_OBJ ];
        transit_reader = ( transit_reader || object_encoding !== ENCODE_TRANSIT )
            ? transit_reader : T.reader( "json" );
        const decode_fn =
              object_encoding === ENCODE_TRANSIT ? transit_reader
              : ( object_encoding === ENCODE_JSON ? JSON.parse
                  : undefined );
        if( !decode_fn )
        {
            throw new Error( "Unsupported option" );
        }
        return mapAssocData( encode_fn, value, options );
    }

    return value;
}

/* This function handles both ciphering and authentication */
export async function encrypto( value, options )
{
    
}
