/*
 *
 */

/* Begin generic utilities (Move to a module some day) */


/* End generic utilities */

    //     sessionStorage.setItem( 'filePort', p );
    //     window.location.href = 'main.html';

var C         = window.crypto.subtle;
var log       = console.log.bind( console );
var getElemId = document.getElementById.bind( document );

var elemUID  = getElemId( 'IdUserId' );
var elemPass = getElemId( 'IdPasswd' );

var encoding = 'utf-8';
var encode = function() {
    var encoder  = new TextEncoder( encoding );
    return encoder.encode.bind( encoder );
} ();
var decode = function() {
    var decoder  = new TextDecoder( encoding );
    return decoder.decode.bind( decoder );
} ();

var SALT_NUM_BYTES = 128;

var FILE_SERVER_PORT = 8123;
var FILE_SERVER_ADDR = 'http://localhost:'+FILE_SERVER_PORT;

/* XXX maybe these should go in session storage, or something */
var login_key = null;

function NameNotAvailableError( message )
{
    this.name    = 'NameNotAvailableError';
    this.message = ( message || '' );
    this.stack   = ( new Error() ).stack;
}
NameNotAvailableError.prototype = Object.create(Error.prototype);
NameNotAvailableError.prototype.constructor = NameNotAvailableError;

function NotFoundError( message )
{
    this.name    = 'NotFoundError';
    this.message = ( message || '' );
    this.stack   = ( new Error() ).stack;
}
NotFoundError.prototype = Object.create(Error.prototype);
NotFoundError.prototype.constructor = NotFoundError;

function RequestError( message, server_msg )
{
    this.name       = 'RequestError';
    this.message    = ( message || '' );
    this.server_msg = ( msg || '' );
    this.stack      = ( new Error() ).stack;
}
RequestError.prototype = Object.create(Error.prototype);
RequestError.prototype.constructor = RequestError;

function ServerError( message, server_msg )
{
    this.name       = 'ServerError';
    this.message    = ( message || '' );
    this.server_msg = ( server_msg || '' );
    this.stack      = ( new Error() ).stack;
}
ServerError.prototype = Object.create(Error.prototype);
ServerError.prototype.constructor = ServerError;

/* Encode a typed buffer as a string using only hex characters
 * (could be more efficient with base 64 or whatever) */
function bufToHex( buf )
{
    /* assert( buf is a byte array ) */
    var bytes = new Uint8Array( buf );
    var hex = '';
    for( var i = 0; i < bytes.length; i++ )
    {
        var n = bytes[i].toString( 16 );
        if( n.length < 1 || n.length > 2 )
        {
            throw 'blah';
        }
        if( n.length == 1 )
        {
            n = '0'+n;
        }
        hex += n;
    }
    /* assert( hex.length == 2 * bytes.length ) */
    return hex;
}

function hexToBuf( hex )
{
    /* assert( hex is a string ) */
    /* assert( hex.length % 2 == 0 ) */
    var num_bytes = hex.length / 2;
    var buf = new Uint8Array( num_bytes );
    for( var i = 0; i < num_bytes; i++ )
    {
        buf[i] = parseInt( hex.slice( 2 * i, 2 * i + 2 ), 16 );
    }
    return buf;
}

/* Encode and pack strings into a byte array */
function stringsToBuf( strings )
{
    /* assert( Array.isArray( strings ) ) */
    /* assert( forall i. typeof( strings[i] ) == 'string' ) */
    var bufs = [];
    var total_bytes = 0;
    for( var i = 0; i < strings.length; i++ )
    {
        bufs.push( encode( strings[ i ] ) );
        total_bytes += bufs[ i ].length;
    }
    var b = new Uint8Array( total_bytes );
    var byte_ptr = 0;
    for( var i = 0; i < bufs.length; i++ )
    {
        b.set( bufs[i], byte_ptr );
        byte_ptr += bufs[i];
    }
    return b;
}

function makeLoginKey( username, password, salt )
{
    /* assert( typeof( username ) == 'string' ) */
    /* assert( typeof( password ) == 'string' ) */
    /* assert( typeof( salt ) == typed array ) */
    var up = stringsToBuf( [ username, password ] );
    return C.importKey( 'raw', up, { name: 'PBKDF2' }, false, [ 'deriveKey' ]
    ).then( function( temp_key ) {
        return C.deriveKey(
            { name: 'PBKDF2', salt: salt, iterations: 1000, hash: { name: 'SHA-1' }, },
            temp_key, { name: 'AES-CBC', length: 256 }, false, [ 'encrypt', 'decrypt' ] );
    } );
}

function encode_path( user, path )
{
    /* assert( Array.isArray( path ) || typeof( path ) == 'string' ) */
    /* assert( Array.isArray( path ) => forall i. typeof( path[i] ) == 'string' ) */
    /* assert( typeof( user ) == 'string' ) */
    if( !Array.isArray( path ) )
    {
        path = [ path ];
    }
    return { p: path.map( encodeURIComponent ).join( '/' ),
             u: encodeURIComponent( user ) };
}

/* Returns a Promise that either rejects or fulfills the response object */
function uploadTextFile( user, path, content )
{
    /* assert( Array.isArray( path ) || typeof( path ) == 'string' ) */
    /* assert( Array.isArray( path ) => forall i. typeof( path[i] ) == 'string' ) */
    /* assert( typeof( user ) == 'string' ) */
    /* assert( typeof( content ) is whatever fetch accepts ) */
    var pu = encode_path( user, path );
    return fetch( FILE_SERVER_ADDR+'/'+pu.u+'/'+pu.p,
                  { method  : 'POST',
                    body    : content,
                    headers : new Headers( {
                        'Content-Type':   'text/plain',
                        'Content-Length': '' + content.length
                    } ) }
    ).then( function( resp ) {
        if( !resp.ok )
        {
            return new Promise( function( accept, reject )
            {
                if( resp.status >= 400 && resp.status < 500 )
                    resp.text().then( function( t ) {
                        reject( new RequestError( pu.p, resp.statusText + ' ' + t ) );
                    } );
                else
                    resp.text().then( function( t ) {
                        reject( new ServerError( pu.p, resp.statusText + ' ' + t ) );
                    } );
            } );
        }
        else
            return Promise.accept( resp );
    } );
}

/* Returns a Promise that either rejects or fulfills the downloaded file's text */
function downloadTextFile( user, path )
{
    /* assert( Array.isArray( path ) || typeof( path ) == 'string' ) */
    /* assert( Array.isArray( path ) => forall i. typeof( path[i] ) == 'string' ) */
    /* assert( typeof( user ) == 'string' ) */
    var pu = encode_path( user, path );
    return fetch( FILE_SERVER_ADDR+'/'+pu.u+'/'+pu.p
    ).then( function( resp ) {
        if( !resp.ok )
        {
            return new Promise( function( accept, reject )
            {
                if( resp.status == 404 )
                    reject( new NotFoundError( pu.p ) );
                else if( resp.status >= 400 && resp.status < 500 )
                    resp.text().then( function( t ) {
                        reject( new RequestError( pu.p, resp.statusText + ' ' + t ) );
                    } );
                else
                    resp.text().then( function( t ) {
                        reject( new ServerError( pu.p, resp.statusText + ' ' + t ) );
                    } );
            } );
        }
        else
            return resp.text();
    } );
}

function uploadTextFiles( files )
{
    /* assert( Array.isArray( files ) ) */
    /* assert( forall i. files[i] is { u, p, c } ) */
    Promise.all( files.map( function( f ) { return uploadTextFile( f.u, f.p, f.c ) } ) );
}

function downloadDecryptDecode( user, path, key, iv )
{
    return downloadTextFile( user, path
    ).then( function( resp_text ) {
        return C.decrypt(
            { name: 'AES-CBC', iv: iv }, key, hexToBuf( resp_text ) );
    } ).then( function( decrypted ) {
        return Promise.accept( decode( decrypted ) );
    } );
}

function onLoginReq()
{
    var salt      = null;
    var enc_link  = null;
    var link_id   = null;
    var u_encrypt = {};
    var u_sign    = {};

    var uid_enc = encode( elemUID.value );
    C.digest( 'SHA-256', uid_enc )
    .then( function( hashedUID ) {
        log( 'Got hash', typeof( hashedUID ), bufToHex( hashedUID ) );
        // assert( new Uint8Array( hashedUID )
        //     == hexToBuf( bufToHex( hashedUID ) ) )
        return fetch( '/Users/'+bufToHex( hashedUID ) );
    } ).then( function( resp ) {
        log( 'login resp', resp );
        if( resp.ok )
        {
            log( 'OK!' );
            return resp.json();
        }
        else
        {
            return Promise.reject( new NotFoundError() );
        }
    } ).then( function( resp_json ) {
        log( 'login json', resp_json );
        salt = hexToBuf( resp_json.salt );
        enc_link = hexToBuf( resp_json.encrypted_link );
        return makeLoginKey( elemUID.value, elemPass.value, salt );
    } ).then( function( k ) {
        login_key = k;
        log( 'login key',login_key );
        return C.decrypt(
            { name: 'AES-CBC', iv: salt.slice( 0, 16 ) }, login_key, enc_link );
    } ).then( function( link_id ) {
        link_id_hex = bufToHex( link_id );
        log( 'link ID:', link_id_hex, link_id );
        var e = downloadTextFile( link_id_hex, 'key_encrypt' );
        var d = downloadTextFile( link_id_hex, 'key_decrypt' );
        var s = downloadTextFile( link_id_hex, 'key_sign' );
        var v = downloadTextFile( link_id_hex, 'key_verify' );
        return Promise.all( [ e, d, s, v ] );
    } ).then( function( results ) {
        var e = C.importKey(
            "jwk", JSON.parse( results[0] ), { name: "ECDH", namedCurve: "P-521", },
            false, [] );
        var d = C.decrypt(
            { name: 'AES-CBC', iv: new Uint8Array( 16 ) }, login_key, hexToBuf( results[1] ) );
        var s = C.decrypt(
            { name: 'AES-CBC', iv: new Uint8Array( 16 ) }, login_key, hexToBuf( results[2] ) );
        var v = C.importKey(
            "jwk", JSON.parse( results[3] ), { name: "ECDSA", namedCurve: "P-521", },
            false, [ "verify" ] );
        return Promise.all( [ e, d, s, v ] );
    } ).then( function( results ) {
        u_encrypt.publicKey = results[0];
        u_sign.publicKey = results[3];
        var d = C.importKey(
            "jwk", JSON.parse( decode( results[1] ) ),
            { name: "ECDH", namedCurve: "P-521", }, false, [ "deriveKey" ] );
        var s = C.importKey(
            "jwk", JSON.parse( decode( results[2] ) ),
            { name: "ECDSA", namedCurve: "P-521", }, false, [ "sign" ] );
        return Promise.all( [ d, s ] );
    } ).then( function( results ) {
        u_encrypt.privateKey = results[0];
        u_sign.privateKey = results[1];
        log( 'Logged in!!!', u_encrypt, u_sign );
    } ).catch( function( err ) {
        if( err instanceof NotFoundError )
        {
            alert( 'Login ID not found' );
        }
        else
        {
            log( 'Mystery error 1', err );
        }
    } );
}

function onRegisterReq()
{
    var hashedUID     = null;
    var salt          = null;
    var u_cloud       = null;
    var uploadToCloud = null;

    var uid_enc = encode( elemUID.value );
    C.digest( 'SHA-256', uid_enc )
    .then( function( h ) {
        hashedUID = bufToHex( h );
        log( 'hashed uid', bufToHex( h ) );
        return fetch( '/Users/'+hashedUID );
    } ).then( function( resp ) {
        if( resp.ok )
        {
            alert( 'That username ('+elemUID.value+') is already registered' );
            return Promise.reject( new NameNotAvailableError() );
        }
        else if( resp.status != 404 )
        {
            return new Promise( function( accept, reject )
            {
                var msg = '/Users/'+hashedUID+' '+resp.statusText + ' ';
                if( resp.status >= 400 && resp.status < 500 )
                    resp.text().then( function( t ) {
                        reject( new RequestError( msg + t ) );
                    } );
                else
                    resp.text().then( function( t ) {
                        reject( new ServerError( msg + t ) );
                    } );
            } );
        }
        /* else */
        /* assert not registered */
        log( 'Userid available', resp );
        u_cloud = { b: new Uint8Array( 5 ) };
        window.crypto.getRandomValues( u_cloud.b );
        u_cloud.t = bufToHex( u_cloud.b );
        uploadToCloud = function( p, c ) { return uploadTextFile( u_cloud.t, p, c ) };
        log( 'user cloud link:', u_cloud.t, u_cloud.b );
        salt = new Uint8Array( SALT_NUM_BYTES );
        window.crypto.getRandomValues( salt );
        var s = C.generateKey( { name: 'ECDSA', namedCurve: 'P-521' },
                               true, [ 'sign', 'verify' ] );
        var e = C.generateKey( { name: 'ECDH', namedCurve: 'P-521' },
                               true, [ 'deriveKey', 'deriveBits' ] );
        var l = makeLoginKey( elemUID.value, elemPass.value, salt );
        var u = uploadToCloud( 'salt', bufToHex( salt ) );
        return Promise.all( [ s, e, l, u ] );
    } ).then( function( results ) {
        log( 'Generated user key-pairs', results );
        var u_sign_keypair = results[0];
        var u_encr_keypair = results[1];
        login_key          = results[2];
        var keys = [ u_encr_keypair.privateKey, u_encr_keypair.publicKey,
                     u_sign_keypair.privateKey, u_sign_keypair.publicKey ];
        var promises = keys.map( function( k ) { return C.exportKey( 'jwk', k ) } );
        promises.push( C.encrypt(
            { name: 'AES-CBC', iv: salt.slice( 0, 16 ) }, login_key, u_cloud.b ) );
        return Promise.all( promises );
    } ).then( function( results ) {
        /* assert( results == [ TODO ] ) */
        log( 'step N' );
        var e = uploadToCloud( 'key_encrypt', JSON.stringify( results[1] ) );
        var v = uploadToCloud( 'key_verify',  JSON.stringify( results[3] ) );
        var d = C.encrypt(
            { name: 'AES-CBC', iv: new Uint8Array( 16 ) }, login_key,
            encode( JSON.stringify( results[0] ) ) );
        var s = C.encrypt(
            { name: 'AES-CBC', iv: new Uint8Array( 16 ) }, login_key,
            encode( JSON.stringify( results[2] ) ) );

        var registration_info = {
            link   : bufToHex( results[4] ),
            pub_key: results[3],
            salt   : bufToHex( salt ),
        };
        var content = JSON.stringify( registration_info );
        var r = fetch( '/Register/'+hashedUID,
            { method  : 'POST',
              body    : content,
              headers : new Headers( {
                  'Content-Type':   'text/plain',
                  'Content-Length': '' + content.length
              } ) } );
        return Promise.all( [ e, v, d, s, r ] );
    } ).then( function( results ) {
        var d = uploadToCloud( 'key_decrypt', bufToHex( results[2] ) );
        var s = uploadToCloud( 'key_sign',    bufToHex( results[3] ) );
        return Promise.all( [ d, s ] );
    } ).then( function( results ) {
        log( 'Registration succeeded!' );
        /*
        return C.decrypt(
            { name: 'AES-CBC', iv: init_vec },
            login_key,
            enc_link );
    } ).then( function( dec_link ) {
        log( 'decrypted link:', new Uint32Array( dec_link ) );
        */
    } ).catch( function( err ) {
        if( err instanceof NameNotAvailableError )
        {
            log( 'Username taken!' );
        }
        else if( err instanceof ServerError )
        {
            log( 'Server error:', err.message, 'Response text:', err.server_msg );
        }
        else
        {
            log( 'Mystery error 2', typeof( err ), err );
        }
    } );
}

function in_team_dir( team, path )
{
    var p;
    if( Array.isArray( path ) )
    {
        p = path.slice();
    }
    else
    {
        p = [ path ];
    }
    p.unshift( team );
    p.unshift( 'Teams' );
    return p;
}

function createTeam( team_name )
{
    var team_encrypt_keypair  = null;
    var team_sign_keypair     = null;
    var team_encrypt_exported = null;
    var team_sign_exported    = null;
    var team_key              = null;
    log( 'creating a new team:', team_name );
    C.generateKey( { name: 'ECDH', namedCurve: 'P-521' },
                   true, [ 'deriveKey', 'deriveBits' ] )
    .then( function( k ) {
        team_encrypt_keypair = k;
        log( 'Generated encryption key-pair', team_encrypt_keypair );
        return C.generateKey( { name: 'ECDSA', namedCurve: 'P-521' },
                              true, [ 'sign', 'verify' ] );
    } ).then( function( k ) {
        team_sign_keypair = k;
        log( 'Generated signing key-pair', team_sign_keypair );
        return exportKeypairs( enc_keypair, sign_keypair );
    } ).then( function( e ) {
        team_encrypt_exported = e.e;
        team_sign_exported    = e.s;
        log( 'Exported key-pairs', e );
        team_id = new Uint8Array( 5 );
        window.crypto.getRandomValues( team_id );
        /* XXX Check that ID is not already in use */
        team_id_hex = bufToHex( team_id );
        log( 'Team ID:', link_id_hex, link_id );
        return uploadTextFile(
            link_id_hex, in_team_dir( team_id_hex, 'encryption_public_key' ),
            JSON.stringify( team_encrypt_exported.publ ) );
    } ).then( function( resp ) {
        if( !resp.ok )
        {
            resp.text().then( function( t ) {
                throw new ServerError( 'Failed to upload encryption public key', t );
            } );
        }
        return uploadTextFile(
            link_id_hex, in_team_dir( team_id_hex, 'signing_public_key' ),
            JSON.stringify( team_sign_exported.publ ) );
    } ).then( function( resp ) {
        if( !resp.ok )
        {
            resp.text().then( function( t ) {
                throw new ServerError( 'Failed to upload signing public key', t );
            } );
        }
        var p = encode( JSON.stringify( team_encrypt_exported.priv ) );
        return C.encrypt(
            { name: 'AES-CBC', iv: new Uint8Array( 16 ) }, login_key, p );
    } ).then( function( encrypted_enc_priv ) {
        return uploadTextFile(
            link_id_hex, in_team_dir( team_id_hex, 'encryption_private_key' ),
            bufToHex( encrypted_enc_priv ) );
    } ).then( function( resp ) {
        if( !resp.ok )
        {
            resp.text().then( function( t ) {
                throw new ServerError( 'Failed to upload encryption private key', t );
            } );
        }
        var p = encode( JSON.stringify( team_sign_exported.priv ) );
        return C.encrypt(
            { name: 'AES-CBC', iv: new Uint8Array( 16 ) }, login_key, p );
    } ).then( function( encrypted_sign_priv ) {
        return uploadTextFile(
            link_id_hex, in_team_dir( team_id_hex, 'sign_private_key' ),
            bufToHex( encrypted_enc_priv ) );
    } ).then( function( resp ) {
        if( !resp.ok )
        {
            resp.text().then( function( t ) {
                throw new ServerError( 'Failed to upload signing private key', t );
            } );
        }
        return C.generateKey(
            { name: "AES‐CBC", length: 256, },
            true, [ "encrypt", "decrypt" ] );
    } ).then( function( k ) {
        team_key = k;
        return C.exportKey( 'jwk', team_key );
    } ).then( function( team_key_exported ) {
        return C.encrypt(
            { name: 'AES-CBC', iv: new Uint8Array( 16 ) }, login_key,
            encode( JSON.stringify( team_sign_exported.priv ) ) );
    } ).then( function( team_key_encrypted ) {
        return uploadTextFile(
            link_id_hex, in_team_dir( team_id_hex, 'sign_private_key' ),
            bufToHex( team_key_encrypted ) );
    } ).then( function( resp ) {
        if( !resp.ok )
        {
            resp.text().then( function( t ) {
                throw new ServerError( 'Failed to upload team key', t );
            } );
        }
        return downloadDecryptDeccode( link_id_hex, [ 'Teams', 'teams' ],
                                       login_key, new Uint8Array( 16 ) );
    } ).then( function( team_contents ) {
        /* XXX need to think carefully about concurrency here */
        team_contents = team_id_hex + ' ' + team_name + '\n' + team_contents;
        return C.encrypt(
            { name: 'AES-CBC', iv: new Uint8Array( 16 ) }, login_key,
            encode( team_contents ) );
    } ).then( function( e ) {
        return uploadTextFile(
            link_id_hex, [ 'Teams', 'teams' ], bufToHex( e ) );
    } ).then( function( resp ) {
        if( !resp.ok )
        {
            resp.text().then( function( t ) {
                throw new ServerError( 'Failed to upload team key', t );
            } );
        }
    } ).catch( function( err ) {
        if( err instanceof ServerError )
        {
            log( 'Server error:', err.message, 'Response text:', err.server_msg );
        }
        else
        {
            log( 'Unhandled error during team creation:', err );
        }
    } );
}
