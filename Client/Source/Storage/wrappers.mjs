/* Top Matter */

/*
 * File comment
 */

import assert  from "../Utilities/assert";
import * as L  from "../Utilities/logging";
import * as UM from "../Utilities/misc";
import * as SU from "./utilities";
import * as CB from "../Crypto/basics"
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

function addProps( obj, prop1, props )
{
    obj[ prop1 ] = Object.assign( obj[ prop1 ] || {}, props );
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
export function randomNameWrapper( options, storage )
{
    async function upload( file_ptr, options_u ) {
        const retry_limit = UM.multiGetter( "retry_limit", undefined, options_u, options );
        const o = Object.assign( {}, options_u );
        SU.appendHeaderHook( o, function( headers ) {
            SU.overwriteHeader( headers, "If-None-Match", "*" );
        } );

        var retries = 0;
        while( ( !retry_limit ) || ( retries < retry_limit ) )
        {
            const bytes = CB.getRandomBytes( BYTES_PER_NAME );
            const name = UM.toHexString( bytes );
            const fp = Object.assign(
                {}, file_ptr, { path: [ file_ptr.path, name ] } );
            const response = Object.assign( {}, await storage.upload( fp, o ) );
            if( response.status === 412 )
            {
                retries += 1;
                L.warn( "Name collision", name, retries );
            }
            else
            {
                if( response.ok )
                {
                    addProps( response, "file_ptr", { path: fp.path } );
                }
                return response;
            }
        }
        throw new Error( "Retry limit exceeded" );
    }

    return Object.assign( {}, storage, { upload:upload } );
}

/*
 * When uploading, ensure that the currently stored version matches the
 * last downloaded version.  If not: conflict error.
 */
export function atomicUpdateWrapper( storage )
{
    async function upload( file_ptr, options_u ) {
        assert( "etag" in file_ptr );

        const o = Object.assign( {}, options_u );
        SU.appendHeaderHook( o, function( headers ) {
            SU.overwriteHeader( headers, "If-Match", file_ptr.etag );
        } );

        const response = Object.assign( {}, await storage.upload( file_ptr, o ) );
        if( response.status === 412 )
        {
            L.warn( "Atomic update failed" );
            response.status     = 409;
            response.statusText = "Conflict";
        }
        return response;
    }

    return Object.assign( {}, storage, { upload:upload } );
}

/*
 * Generate something about the file pointer during upload.
 * (Current "somethings" include keys and iv.)
 * Report back whatever was generated in the file_ptr property of the response (if ok)
 */
export function filePtrGenWrapper( options, storage )
{
    async function upload( file_ptr, options_u ) {
        const mg = ( n, d ) => UM.multiGetter( n, d, options_u, options );
        const param_name    = mg( "param_name", "param" );
        const param_options = mg( param_name + "_options", undefined );
        const generator     = mg( param_name + "_generator", undefined );
        const params = await generator( param_name, param_options );
        const fp = Object.assign( {}, file_ptr, params );
        const response = Object.assign( {}, await storage.upload( fp, options_u ) );
        if( response.ok )
        {
            addProps( response, "file_ptr", params );
        }
        return response;
    }

    async function fpToPlainData( fp )
    {
        const f = storage.fpToPlainData( fp );
        {
            const f2 = options.fpToPlainData( fp );
            return Object.assign( {}, f, f2 );
        }
        return f;
    }

    async function fpFromPlainData( fp )
    {
        const f = storage.fpFromPlainData( fp );
        if( "fpFromPlainData" in options )
        {
            const f2 = options.fpFromPlainData( fp );
            return Object.assign( {}, f, f2 );
        }
        return f;
    }

    return Object.assign(
        {}, storage, { upload:upload, fpToPlainData:fpToPlainData, fpFromPlainData:fpFromPlainData } );
}

/*
 * When uploading, sign.  When downloading, verify.
 *
 * This wrapper's data input and output are byte arrays.
 */
export function authenticationWrapper( options, storage )
{
    async function upload( file_ptr, options_u ) {
        assert( "body" in options_u );
        // assert byte array
        const tag_bytes = UM.multiGetter( "tag_bytes", undefined, options_u, options );
        const sign = UM.multiGetter( "sign", undefined, options_u, options );

        const o = Object.assign( {}, options_u );
        const tag = await sign( o.body, file_ptr );
        assert( tag.byteLength === tag_bytes );
        o.body = UM.typedArrayConcat( tag, o.body );
        const len = o.body.byteLength;
        SU.appendHeaderHook( o, function( headers ) {
            SU.overwriteHeader( headers, "Content-Length", len );
        } );
        return await storage.upload( file_ptr, o );
    }

    async function download( file_ptr, options_d ) {
        const tag_bytes = UM.multiGetter( "tag_bytes", undefined, options_d, options );
        const verify = UM.multiGetter( "verify", undefined, options_d, options );
        const response = await storage.download( file_ptr, options_d );
        if( !response.ok )
        {
            return response;
        }
        // 'else': response looks ok so far
        const tag_plus_body = new Uint8Array( await response.arrayBuffer() );
        /* TODO: is copying the byte arrays necessary? */
        const tag  = tag_plus_body.subarray( 0, tag_bytes );
        const body = tag_plus_body.subarray( tag_bytes );
        const verified = await verify( tag, body, file_ptr );
        if( !verified )
        {
            throw new Error( "Verifiction Failed" );
        }
        // 'else': verification passed
        return Object.assign(
            {}, response, { arrayBuffer:( () => P.resolve( body ) ) } );
    }

    return Object.assign( {}, storage, { upload:upload, download:download } );
}

/*
 * When uploading, encrypt.  When downloading, decrypt.
 *
 * This wrapper's data input and output are byte arrays.
 */
export function confidentialityWrapper( options, storage )
{
    async function upload( file_ptr, options_u ) {
        assert( "body" in options_u );
        // assert byte array
        const encrypt = UM.multiGetter( "encrypt", undefined, options_u, options );

        const o = Object.assign( {}, options_u );
        o.body = await encrypt( options_u.body, file_ptr );
        const len = o.body.byteLength;
        SU.appendHeaderHook( o, function( headers ) {
            SU.overwriteHeader( headers, "Content-Length", len );
        } );
        return await storage.upload( file_ptr, o );
    }

    async function download( file_ptr, options_d ) {
        const decrypt = UM.multiGetter( "decrypt", undefined, options_d, options );
        const response = await storage.download( file_ptr, options_d );
        if( !response.ok )
        {
            return response;
        }
        // 'else': response looks ok so far
        const r = Object.assign( {}, response );
        r.arrayBuffer = () => ( response.arrayBuffer().then(
            ( body_bytes ) => decrypt( body_bytes, file_ptr ) ) );
        return r;
    }

    return Object.assign( {}, storage, { upload:upload, download:download } );
}

/*
 * Encode/decode various data kinds to byte arrays.
 */
const text_encoders = {};
const text_decoders = {};

export function encodingWrapper( stream_kind, options, storage )
{
    assert( stream_kinds.has( stream_kind ) );
    const tstorage = stream_kind === SK_JSON
          ? encodingWrapper( SK_TEXT, options, storage )
          : null;

    async function upload( file_ptr, options_u ) {
        assert( "body" in options_u );

        var o = Object.assign( {}, options_u );
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
            // const o = Object.assign( {}, options );
            if( "body" in options_u )
            {
                o.body = JSON.stringify( options_u.body );
                const len = o.body.length;
                SU.appendHeaderHook( o, function( headers ) {
                    SU.overwriteHeader( headers, "Content-Length", len );
                } );
            }
            return await tstorage.upload( file_ptr, o );
            break;
        case SK_TEXT:
            const encoding = UM.multiGetter( "encoding", DEFAULT_ENCODING, options_u, options );
            if( !( encoding in text_encoders ) )
            {
                text_encoders[ encoding ] = new TextEncoder( encoding );
            }
            o.body = text_encoders[ encoding ].encode( options_u.body );
            break;
        }
        const len = o.body.length;
        SU.appendHeaderHook( o, function( headers ) {
            SU.overwriteHeader( headers, "Content-Length", len );
        } );
        return await storage.upload( file_ptr, o );
    }

    async function download( file_ptr, options_d ) {
        const s = stream_kind === SK_JSON ? tstorage : storage;
        const response = await s.download( file_ptr, options_d );
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
            r.json = () => response.text().then( ( text ) => JSON.parse( text ) );
            break;
        case SK_TEXT:
            const encoding = UM.multiGetter( "encoding", DEFAULT_ENCODING, options_d, options );
            if( !( encoding in text_decoders ) )
            {
                text_decoders[ encoding ] = new TextDecoder( encoding );
            }
            const decoder = text_decoders[ encoding ];
            r.text = () => response.arrayBuffer().then( ( bytes ) => decoder.decode( bytes ) );
            break;
        }

        return r;
    }

    return Object.assign( {}, storage, { upload:upload, download:download } );
}

export function authedPublicWrapper( options, storage )
{
    return filePtrGenWrapper(
        options,
        authenticationWrapper(
            options,
            randomNameWrapper(
                options,
                storage ) ) );
}

export function authedPrivateWrapper( options, storage )
{
    return filePtrGenWrapper(
        options,
        authenticationWrapper(
            options,
            confidentialityWrapper(
                options,
                randomNameWrapper(
                    options,
                    storage ) ) ) );
}

export function authedPublicJsonWrapper( options, storage )
{
    return encodingWrapper(
        SK_JSON, options, authedPublicWrapper( options, storage ) );

}

export function authedPrivateJsonWrapper( options, storage )
{
    return encodingWrapper(
        SK_JSON, options, authedPrivateWrapper( options, storage ) );

}
