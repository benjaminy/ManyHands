/* Top Matter */

/*
 *
 */

import assert  from "../Utilities/assert";
import A       from "../Utilities/act-thread";
import L       from "../Utilities/logging";
import M       from "../Utilities/misc";
import SU      from "./utilities";
import CB      from "../Crypto/basics"
import TE      from "text-encoding";

const P = Promise;
const { TextEncoder, TextDecoder } = TE;

const BYTES_PER_NAME = 10;
const DEFAULT_ENCODING = "utf-8";

/* Data stream kinds */
export const SK_ARRAY_BUFFER = Symbol( "arrayBuffer" );
export const SK_BLOB         = Symbol( "blob" );
export const SK_FORM_DATA    = Symbol( "formData" );
export const SK_JSON         = Symbol( "json" );
export const SK_TEXT         = Symbol( "text" );
export const stream_kinds = new Set( [ SK_ARRAY_BUFFER, SK_BLOB, SK_FORM_DATA, SK_JSON, SK_TEXT ] );

/*
 * Upload to a randomly chosen name.  If a file already exists at that
 * path, retry until an unused name is found.
 *
 * Add the randomly chosen name as a field to the response object.
 *
 * This is how most files in UWS are uploaded.  The only files with
 * externally useful names are the root of the whole tree and a few odd
 * special cases.
 */
export function randomNameWrapper( storage )
{
    const rstorage = Object.assign( {}, storage );

    rstorage.upload = A( function* upload( path, options ) {
        const o = Object.assign( {}, options );
        SU.appendHeaderHook( o, function( headers )
        {
            SU.overwriteHeader( headers, "If-Match", "*" );
        } );

        var retries = 0;
        while( true )
        {
            const bytes = CB.getRandomBytes( BYTES_PER_NAME );
            const name = M.toHexString( bytes );
            const response = Object.assign( {},
                yield storage.upload( M.pathJoin( path, name ), o ) );
            if( response.status === 412 )
            {
                retries += 1;
                if( options.retry_limit && ( retries > options.retry_limit ) )
                    throw new Error( "Retry limit exceeded" );
                L.warn( "Name collision", name, retries );
                continue;
            }
            /* Reminder: The fetch convention is to return (not throw) for HTTP "errors" */
            if( response.ok )
            {
                response.generated_name = name;
            }
            return response;
        }
    } );

    return rstorage;
}

/*
 * When uploading, ensure that the currently stored version matches the
 * last downloaded version.  If not: conflict error.
 */
export function atomicUpdateWrapper( storage )
{
    const astorage = Object.assign( {}, storage );

    astorage.upload = A( function* upload( path, options ) {
        assert( "etag" in options );

        const o = Object.assign( {}, options );
        SU.appendHeaderHook( o, function( headers )
        {
            SU.overwriteHeader( headers, "If-Match", options.etag );
        } );

        const response = Object.assign( {},
            yield storage.upload( M.pathJoin( path, name ), o ) );
        if( response.status === 412 )
        {
            L.warn( "Atomic update failed" );
            response.status     = 409;
            response.statusText = "Conflict";
        }
        /* Reminder: The fetch convention is to return (not throw) for HTTP "errors" */
        return response;
    } );

    return astorage;
}

/*
 * When uploading, calculate and prepend a MAC.  When downloading, verify the MAC.
 *
 * This wrapper's data input and output are byte arrays.
 */
export function authenticityWrapper( storage, crypto )
{
    const astorage = Object.assign( {}, storage );

    astorage.upload = A( function* upload( path, options ) {
        assert( body in options );
        // assert byte array

        const o = Object.assign( {}, options );
        if( options.generate_mac_key )
        {
            o.mac_key = yield crypto.generateKey();
        }
        const tag = yield crypto.sign( o.body, o.mac_key );
        assert( tag.length === crypto.tag_bytes );
        o.body = UM.typedArrayConcat( tag, o.body );
        const response = yield storage.upload( path, o );
        if( response.ok )
        {
            if( options.generate_mac_key )
            {
                response.generated_mac_key = o.mac_key;
            }
        }
        return response;
    } );

    astorage.download = A( function* download( path, options ) {
        const response = yield storage.download( path, options );
        if( !response.ok )
        {
            return response;
        }
        // 'else': response looks ok so far
        const body_bytes = new Uint8Array( yield response.arrayBuffer() );
        const tag = body_bytes.subarray( 0, crypto.tag_bytes );
        const signed = body_bytes.subarray( crypto.tag_bytes );
        if( !( yield crypto.verify( tag, signed, options.mac_key ) ) )
        {
            throw new VerificationError( '' );
        }
        // 'else': verification passed
        const r = Object.assign( {}, response );
        r.arrayBuffer = () => P.resolve( signed );
        return r;
    } );

    return astorage;
}

/*
 * When uplaoding, encrypt.  When downloading, decrypt.
 *
 * This wrapper's data input and output are byte arrays.
 */
export function confidentialityWrapper( storage, crypto )
{
    const cstorage = Object.assign( {}, storage );

    cstorage.upload = A( function* upload( path, options ) {
        assert( body in options );
        // assert byte array

        const o = Object.assign( {}, options );
        if( options.generate_key )
        {
            o.key = yield crypto.generateKey();
        }

        if( options.generate_iv )
        {
            o.iv = 12345;
        }

        o.body = yield crypto.encrypt( options.body, o.key, o.iv );
        const response = yield storage.upload( path, o );
        if( response.ok )
        {
            if( options.generate_key )
                response.generated_key = o.key;
            if( options.generate_iv )
                response.generated_iv = o.iv;
        }
        return response;
    } );

    cstorage.download = A( function* download( path, options ) {
        const response = yield storage.download( path, options );
        if( !response.ok )
        {
            return response;
        }
        // 'else': response looks ok so far
        const body_bytes = yield response.arrayBuffer();
        const r = Object.assign( {}, response );
        r.arrayBuffer = () => crypto.decrypt( body_bytes, options.key, options.iv );
        return r;
    } );

    return cstorage;
}
// return C.decrypt( this.enc_algo( enc_param ), key_dec, data_enc );

/*
 * Encode/decode various data kinds to byte arrays.
 */
text_encoders = {};
text_decoders = {};

export function encodingWrapper( storage, stream_kind, w_options )
{
    assert( stream_kinds.has( stream_kind ) );
    const estorage = Object.assign( {}, storage );
    const tstorage = stream_kind === SK_JSON ? encodingWrapper( storage, SK_TEXT ) : null;

    cstorage.upload = A( function* upload( path, options ) {
        assert( body in options );

        const o = Object.assign( {}, options );
        switch( stream_kind ) {
        case SK_ARRAY_BUFFER:
            break;
        case SK_BLOB:
            throw new Error( "Unimplemented" );
            break;
        case SK_FORM_DATA:
            throw new Error( "Unimplemented" );
            break;
        case SK_JSON:
            const o = Object.assign( {}, options );
            if( "body" in options )
            {
                o.body = JSON.stringify( options.body );
            }
            return yield tstorage.upload( path, o );
            break;
        case SK_TEXT:
            const encoding = ( "encoding" in options ) ? options.encoding :
                (  ( w_options && ( "encoding" in w_options ) ) ? w_options.encoding :
                   DEFAULT_ENCODING );
            if( !( encoding in text_encoders ) )
            {
                text_encoders[ encoding ] = new TextEncoder( encoding );
            }
            const encoder = text_encoders[ encoding ];
            o.body = encoder.encode( options.body );
            break;
        }
        o.body = yield encrypt( options.body );
        return yield storage.upload( path, o );
    } );

    cstorage.download = A( function* download( path, options ) {
        const s = stream_kind === SK_JSON ? tstorage : storage;
        const response = yield s.download( path, options );
        if( !response.ok )
        {
            return response;
        }
        // 'else': response looks ok so far
        const r = Object.assign( {}, response );

        switch( stream_kind ) {
        case SK_ARRAY_BUFFER:
            break;
        case SK_BLOB:
            throw new Error( "Unimplemented" );
            break;
        case SK_FORM_DATA:
            throw new Error( "Unimplemented" );
            break;
        case SK_JSON:
            r.json = () => P.resolve( JSON.parse( yield response.text() ) );
            break;
        case SK_TEXT:
            const encoding = ( "encoding" in options ) ? options.encoding :
                (  ( w_options && ( "encoding" in w_options ) ) ? w_options.encoding :
                   DEFAULT_ENCODING );
            if( !( encoding in text_decoders ) )
            {
                text_decoders[ encoding ] = new TextDecoder( encoding );
            }
            const decoder = text_decoders[ encoding ];
            r.text = () => P.resolve( decoder.decode( yield response.arrayBuffer() ) );
            break;
        }

        return r;
    } );


}
