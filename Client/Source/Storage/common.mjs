/* Top Matter */

/*
 * File comment
 */

import assert from "assert";
import T from "transit-js";

export const PATH_PREFIX    = T.symbol( "path prefix" );

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
        const r = fn( v );
        console.log( "MMEP", v, r  );
        return r;
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
        if( ( !transit_writer ) && object_encoding === ENCODE_TRANSIT )
        {
            const w = T.writer( "json" );
            transit_writer = w.write.bind( w );
        }
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

    if( ENCODE_OBJ in options || ENCODE_TEXT in options )
    {
        /* NOTE: Apparently the overlords of the web think utf-8 is the only
         * text encoding that matters.  They might be right. */
        if( !text_encoder )
        {
            const t = new TextEncoder();
            text_encoder = t.encode.bind( t );
        }
        return mapAssocData( text_encoder, value, options );
    }

    return value;
}

export function decode( value, options )
{
    if( ENCODE_OBJ in options || ENCODE_TEXT in options )
    {
        if( !text_decoder )
        {
            const t = new TextDecoder();
            text_decoder = t.decode.bind( t );
        }
        value = mapAssocData( text_decoder, value, options );
    }

    if( ENCODE_OBJ in options )
    {
        const object_encoding = options[ ENCODE_OBJ ];
        if( ( !transit_reader ) && object_encoding === ENCODE_TRANSIT )
        {
            const r = T.reader( "json" );
            transit_reader = r.read.bind( r );
            console.log( "XXX1", value, r.read( value ) );
        }
        const decode_fn =
              object_encoding === ENCODE_TRANSIT ? transit_reader
              : ( object_encoding === ENCODE_JSON ? JSON.parse
                  : undefined );
        if( !decode_fn )
        {
            throw new Error( "Unsupported option" );
        }
        console.log( "BEFORE", value );
        return mapAssocData( decode_fn, value, options );
    }

    return value;
}

/* This function handles both ciphering and authentication */
export async function encrypto( value, options )
{
    return [ value, {} ];
}

export async function decrypto( value, link, options )
{
    // console.log( "HUH", typeof value, value );
    return value;
}
