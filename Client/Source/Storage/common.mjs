/* Top Matter */

/*
 * File comment
 */

import assert  from "assert";
import T       from "transit-js";
import * as L  from "../Utilities/logging.mjs";
import * as CB from "../Crypto/basics.mjs";
const WCS = CB.CS;

const kw = T.keyword;

export const PATH_PREFIX                = kw( "path prefix" );

export const ENCODE_OBJ                 = kw( "obj" );
export const ENCODE_TRANSIT             = kw( "transit" );
export const ENCODE_JSON                = kw( "json" );
export const ENCODE_TEXT                = kw( "text encoding" );

export const ASSOC_DATA                 = kw( "associated data" );
export const ENCRYPT_DATA               = kw( "encrypt data" );
export const GEN_KEY                    = kw( "generate key" );
export const EXTRENAL_KEY               = kw( "generate key" );

export const COND_UPLOAD                = kw( "conditional upload" );
export const COND_ATOMIC                = kw( "atomic upload" );
export const COND_NEW_NAME              = kw( "unique upload" );
export const COND_NO_OVERWRITE          = kw( "no overwrite" );

export const ERROR_KIND                 = kw( "storage error kind" );
export const ERROR_OVERWRITE_FAILED     = kw( "atomic update failed" );
export const ERROR_ATOMIC_UPDATE_FAILED = kw( "storage error overwrite failed" );

function mapAssocData( fn, v, options )
{
    if( options.has( ASSOC_DATA ) )
    {
        return { secret: fn( v.secret ),
                 integrity_protected: fn( v.integrity_protected ) };
    }
    else
    {
        const r = fn( v );
        return r;
    }
}

var text_encoder, text_decoder;
var transit_writer, transit_reader;

/* This function handles both plain data to text and text to byte array encoding. */
export function encode( value, options )
{
    L.debug( "\u21b3 common.encode", options.toString() );
    if( options.has( ENCODE_OBJ ) )
    {
        const object_encoding = options.get( ENCODE_OBJ );
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

    if( options.has( ENCODE_OBJ ) || options.has( ENCODE_TEXT ) )
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
    if( options.has( ENCODE_OBJ ) || options.has( ENCODE_TEXT ) )
    {
        if( !text_decoder )
        {
            const t = new TextDecoder();
            text_decoder = t.decode.bind( t );
        }
        value = mapAssocData( text_decoder, value, options );
    }

    if( options.has( ENCODE_OBJ ) )
    {
        const object_encoding = options.get( ENCODE_OBJ );
        if( ( !transit_reader ) && object_encoding === ENCODE_TRANSIT )
        {
            const r = T.reader( "json" );
            transit_reader = r.read.bind( r );
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
    if( options.has( ENCRYPT_DATA ) )
    {
        if( options.has( GEN_KEY ) )
        {
            // TODO: const algo = options.get( GEN_KEY );
            var k = await WCS.generateKey(
                { name: "AES-GCM", length:256 }, true, [ "encrypt", "decrypt" ] );
        }
        else
        {
            var k = options.get( EXTERNAL_KEY );
        }
        if( options.has( ASSOC_DATA ) )
        {
        }
    }
    else
    {
        return [ value, T.map() ];
    }
}

export async function decrypto( value, link, options )
{
    // console.log( "HUH", typeof value, value );
    return value;
}

// async function dehydrateLink( fp )
// {
//     return { keyC: await WCS.exportKey( "jwk", fp.keyC ),
//              iv  : fp.iv,
//              keyS: await WCS.exportKey( "jwk", fp.keyS ) };
// }

// }
