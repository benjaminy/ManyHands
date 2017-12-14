/* Top Matter */

const P = Promise;
import { actFn, Scheduler } from "./act-thread";
import BufferThing from "buffer/";
const Buffer = BufferThing.Buffer;
import TE from "text-encoding";
const { TextEncoder, TextDecoder } = TE;

export const encoding = 'utf-8';
var [ encode, decode ] = encodeDecodeFunctions( encoding );

/* NOTE: No reason to iterate in this function, because of races.  There
 * will always need to be an "outer" loop. */
var randomName = function( num_chars, encoding, prefix, suffix )
{
    var CHARS_PER_NAME = num_chars | 18;
    var ENCODING       = encoding  | 'base32crock';
    var PREFIX         = prefix    | 'F';
    var SUFFIX         = suffix    | '.data';
    var ALPHABETS      = {
        base32crock : '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
    };
    var ALPHABET       = ALPHABETS[ encoding ];
    var NUM_CHARS      = ALPHABET.length;
    var WORD_SIZE      = 32;
    var CHARS_PER_WORD = 6; /* XXX should be computed from WORD_SIZE and NUM_CHARS */
    var WORDS_PER_NAME = Math.ceil( CHARS_PER_NAME / CHARS_PER_WORD );
    var WORDS          = new Uint32Array( WORDS_PER_NAME );

    window.crypto.getRandomValues( WORDS );

    var chars_left     = 0;
    var name           = '';
    var word;

    for( var i = 0; i < CHARS_PER_NAME; i++ )
    {
        if( chars_left < 1 ) {
            word = WORDS[ Math.floor( i / CHARS_PER_WORD ) ];
            chars_left = CHARS_PER_WORD;
        }
        name       += ALPHABET  [ word % NUM_CHARS ];
        word        = Math.floor( word / NUM_CHARS );
        chars_left -= 1;
    }

    return PREFIX + name + SUFFIX;
}

function encodeDecodeFunctions( encoding )
{
    var encoder = new TextEncoder( encoding );
    var decoder = new TextDecoder( encoding );
    var arr = [ encoder.encode.bind( encoder ),
                decoder.decode.bind( decoder ) ];
    return arr;
}

/* stupid Firefox */
function polyfill_captureStackTrace( o, c )
{
    if( Error.captureStackTrace )
    {
        return Error.captureStackTrace( o, c );
    }
    else
    {
        /* TODO */
    }
}

function AbstractError( err, msg, scp )
{
    Error.call( err );
    polyfill_captureStackTrace( err, err.constructor );
    if( scp )
    {
        var stacks = scp.old_stacks.concat( err.stack );
        err.stack = stacks.join();
    }
    err.name = err.constructor.name;
    err.message = ( msg || '' );
}

function AssertionFailedError( msg, scp )
{
    AbstractError( this, msg, scp );
}
AssertionFailedError.prototype = Object.create(Error.prototype);
AssertionFailedError.prototype.constructor = AssertionFailedError;

function NameNotAvailableError( msg, scp )
{
    AbstractError( this, msg, scp );
}
NameNotAvailableError.prototype = Object.create(Error.prototype);
NameNotAvailableError.prototype.constructor = NameNotAvailableError;

function NotFoundError( msg, scp )
{
    AbstractError( this, msg, scp );
}
NotFoundError.prototype = Object.create(Error.prototype);
NotFoundError.prototype.constructor = NotFoundError;

function RequestError( msg, server_msg, scp )
{
    AbstractError( this, msg, scp );
    this.server_msg = ( server_msg || '' );
}
RequestError.prototype = Object.create(Error.prototype);
RequestError.prototype.constructor = RequestError;

function ServerError( msg, server_msg, scp )
{
    AbstractError( this, msg, scp );
    this.server_msg = ( server_msg || '' );
}
ServerError.prototype = Object.create(Error.prototype);
ServerError.prototype.constructor = ServerError;

function AuthenticationError( msg, scp )
{
    AbstractError( this, msg, scp );
}
AuthenticationError.prototype = Object.create(Error.prototype);
AuthenticationError.prototype.constructor = AuthenticationError;

function CryptoError( msg, scp )
{
    AbstractError( this, msg, scp );
}
CryptoError.prototype = Object.create(Error.prototype);
CryptoError.prototype.constructor = CryptoError;

function VerificationError( msg, scp )
{
    AbstractError( this, msg, scp );
}
VerificationError.prototype = Object.create(Error.prototype);
VerificationError.prototype.constructor = VerificationError;

function assert( condition, message, scp )
{
    if( condition )
        return;
    throw new AssertionFailedError( message, scp );
}

function domToCrypto( err, scp ) {
    if( err instanceof DOMException )
    {
        throw new CryptoError( err.message, scp );
    }
    else
        return Promise.reject( err );
}


function array_zip( a1, a2, flatten1, flatten2, strict1, strict2, scp )
{
    var [ scp, log ] = Scope.enter( scp, 'array_zip' );
    log( a1, a2 );
    function helper( a, i )
    {
        var result = null;
        if( flatten1 )
        {
            if( Array.isArray( a ) )
            {
                result = a;
            }
            else if( strict1 )
            {
                throw new Error( 'Fix me' );
            }
            else
            {
                result = [ a ];
            }
        }
        else
        {
            result = [ a ];
        }
        if( flatten2 )
        {
            if( Array.isArray( a2[i] ) )
            {
                result = result.concat( a2[i] );
            }
            else if( strict1 )
            {
                throw new Error( 'Fix me' );
            }
            else
            {
                result.push( a2[i] );
            }
        }
        else
        {
            result.push( a2[i] );
        }
        return result;
    }
    return a1.map( helper );
}

function typedArrayConcat( a, b )
{
    a = new Uint8Array( a );
    b = new Uint8Array( b );
    var c = new Uint8Array( a.length + b.length );
    c.set( a );
    c.set( b, a.length );
    return c;
}

function p_all_resolve( promises, values, scp )
{
    /* assert( Array.isArray( promises ) ) */
    /* assert( Array.isArray( values ) ) */
    /* assert( forall i. typeof( promises[i] ) is Promise ) */
    return P.all( promises.concat( values.map( P.resolve.bind( P ) ) ) );
}


var handleServerError = actFn( function *handleServerError( scp, log, msg, resp )
{
    if( resp.status == 404 )
        throw new NotFoundError( msg, scp );
    var t = yield resp.text();
    if( resp.status >= 400 && resp.status < 500 )
        throw new RequestError( msg, resp.statusText + ' ' + t, scp );
    throw new ServerError( msg, resp.statusText + ' ' + t, scp );
} );


/* Graveyard */

//     sessionStorage.setItem( 'filePort', p );
//     window.location.href = 'main.html';

