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

function addProp( obj, prop1, prop2, val )
{
    obj[ prop1 ] = obj[ prop1 ] || {};
    obj[ prop1 ][ prop2 ] = val;
}

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

    rstorage.upload = A( function* upload( file_ptr, options ) {
        const o = Object.assign( {}, options );
        SU.appendHeaderHook( o, function( headers ) {
            SU.overwriteHeader( headers, "If-Match", "*" );
        } );

        var retries = 0;
        while( true )
        {
            const bytes = CB.getRandomBytes( BYTES_PER_NAME );
            const name = M.toHexString( bytes );
            const fp = Object.assign( {}, file_ptr );
            fp.path = M.pathJoin( file_ptr.path, name );
            const response = Object.assign( {}, yield storage.upload( fp, o ) );
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
                addProp( response, "file_ptr", "path", fp.path );
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

    astorage.upload = A( function* upload( file_ptr, options ) {
        assert( "etag" in options );

        const o = Object.assign( {}, options );
        SU.appendHeaderHook( o, function( headers ) {
            SU.overwriteHeader( headers, "If-Match", options.etag );
        } );

        const response = Object.assign( {}, yield storage.upload( file_ptr, o ) );
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
 *
 */
export function keyGenWrapper( crypto, name, storage )
{
    const gstorage = Object.assign( {}, storage );

    gstorage.upload = A( function* upload( file_ptr, options ) {
        const fp = Object.assign( {}, file_ptr );
        fp[ "key_" + name ] = yield crypto.generateKey( name );
        const response = Object.assign( {}, yield storage.upload( file_ptr, options ) );
        if( response.ok )
        {
            addProp( response, "file_ptr", "key_" + name, fp.path );
        }
        return response;

    } );
}

/*
 *
 */
export function keyParamWrapper( key, name, storage )
{
    const gstorage = Object.assign( {}, storage );

    gstorage.upload = A( function* upload( file_ptr, options ) {
        const fp = Object.assign( {}, file_ptr );
        fp[ "key_" + name ] = key;
        return yield storage.upload( file_ptr, o );
    } );
}

/*
 * When uploading, sign.  When downloading, verify.
 *
 * This wrapper's data input and output are byte arrays.
 */
export function authenticityWrapper( crypto, storage )
{
    const astorage = Object.assign( {}, storage );

    astorage.upload = A( function* upload( file_ptr, options ) {
        assert( body in options );
        // assert byte array

        const o = Object.assign( {}, options );
        const tag = yield crypto.sign( o.body, file_ptr.key_auth );
        assert( tag.length === crypto.tag_bytes );
        o.body = UM.typedArrayConcat( tag, o.body );
        SU.appendHeaderHook( o, function( headers ) {
            SU.overwriteHeader( headers, "Content-Length", o.body.length );
        } );
        return yield storage.upload( file_ptr, o );
    } );

    astorage.download = A( function* download( file_ptr, options ) {
        const response = yield storage.download( file_ptr, option );
        if( !response.ok )
        {
            return response;
        }
        // 'else': response looks ok so far
        const body_bytes = new Uint8Array( yield response.arrayBuffer() );
        const tag = body_bytes.subarray( 0, crypto.tag_bytes );
        const signed = body_bytes.subarray( crypto.tag_bytes );
        if( !( yield crypto.verify( tag, signed, file_ptr.auth_key ) ) )
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
 * When uploading, encrypt.  When downloading, decrypt.
 *
 * This wrapper's data input and output are byte arrays.
 */
export function confidentialityWrapper( crypto, storage )
{
    const cstorage = Object.assign( {}, storage );

    cstorage.upload = A( function* upload( file_ptr, options ) {
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
        SU.appendHeaderHook( o, function( headers ) {
            SU.overwriteHeader( headers, "Content-Length", o.body.length );
        } );
        const response = Object.assign( {}, yield storage.upload( file_ptr, o ) );
        if( response.ok )
        {
            if( options.generate_key )
                response.generated_key = o.key;
            if( options.generate_iv )
                response.generated_iv = o.iv;
        }
        return response;
    } );

    cstorage.download = A( function* download( file_ptr, options ) {
        const response = yield storage.download( file_ptr, options );
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

export function encodingWrapper( stream_kind, w_options, storage )
{
    assert( stream_kinds.has( stream_kind ) );
    const estorage = Object.assign( {}, storage );
    const tstorage = stream_kind === SK_JSON ? encodingWrapper( SK_TEXT, storage ) : null;

    cstorage.upload = A( function* upload( file_ptr, options ) {
        assert( body in options );

        const o = Object.assign( {}, options );
        SU.appendHeaderHook( o, function( headers ) {
            SU.overwriteHeader( headers, "Content-Type", "application/octet-stream" );
        } );
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
                SU.appendHeaderHook( o, function( headers ) {
                    SU.overwriteHeader( headers, "Content-Length", o.body.length );
                } );
            }
            return yield tstorage.upload( file_ptr, o );
            break;
        case SK_TEXT:
            const encoding = ( "encoding" in options ) ? options.encoding :
                (  ( w_options && ( "encoding" in w_options ) ) ? w_options.encoding :
                   DEFAULT_ENCODING );
            if( !( encoding in text_encoders ) )
            {
                text_encoders[ encoding ] = new TextEncoder( encoding );
            }
            o.body = text_encoders[ encoding ].encode( options.body );
            break;
        }
        SU.appendHeaderHook( o, function( headers ) {
            SU.overwriteHeader( headers, "Content-Length", o.body.length );
        } );
        return yield storage.upload( file_ptr, o );
    } );

    cstorage.download = A( function* download( file_ptr, options ) {
        const s = stream_kind === SK_JSON ? tstorage : storage;
        const response = yield s.download( file_ptr, options );
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
