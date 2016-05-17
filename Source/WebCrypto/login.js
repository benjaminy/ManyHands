/*
 *
 */

/* Begin generic utilities (Move to a module some day) */


/* End generic utilities */

    //     sessionStorage.setItem( 'filePort', p );
    //     window.location.href = 'main.html';

var P         = Promise;
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

var signing_algo = { name:   'ECDSA', namedCurve: 'P-521' };
var pub_enc_algo = { name:    'ECDH', namedCurve: 'P-521' };
var sym_enc_algo = { name: 'AES-CBC',     length:    256  };

function encrypt_aes_cbc( iv, k, d )
{ return C.encrypt( { name: 'AES-CBC', iv: iv }, k, d ); }

function decrypt_aes_cbc( iv, k, d )
{ return C.decrypt( { name: 'AES-CBC', iv: iv }, k, d ); }

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
            temp_key, sym_enc_algo, false, [ 'encrypt', 'decrypt' ] );
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

/* Returns a Promise that either rejects, or fulfills the response object */
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
            return P.accept( resp );
    } );
}

/* Returns a Promise that either rejects, or fulfills the downloaded file's text */
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
    P.all( files.map( function( f ) { return uploadTextFile( f.u, f.p, f.c ) } ) );
}

function downloadDecryptDecode( user, path, key, iv )
{
    return downloadTextFile( user, path
    ).then( function( resp_text ) {
        return decrypt_aes_cbc( iv, key, hexToBuf( resp_text ) );
    } ).then( function( decrypted ) {
        return P.accept( decode( decrypted ) );
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
            return P.reject( new NotFoundError() );
        }
    } ).then( function( resp_json ) {
        log( 'login json', resp_json );
        salt = hexToBuf( resp_json.salt );
        enc_link = hexToBuf( resp_json.encrypted_link );
        return makeLoginKey( elemUID.value, elemPass.value, salt );
    } ).then( function( k ) {
        login_key = k;
        log( 'login key',login_key );
        return decrypt_aes_cbc( salt.slice( 0, 16 ), login_key, enc_link );
    } ).then( function( link_id ) {
        link_id_hex = bufToHex( link_id );
        log( 'link ID:', link_id_hex, link_id );
        var ep = downloadTextFile( link_id_hex, 'key_encrypt' );
        var dp = downloadTextFile( link_id_hex, 'key_decrypt' );
        var sp = downloadTextFile( link_id_hex, 'key_sign' );
        var vp = downloadTextFile( link_id_hex, 'key_verify' );
        return P.all( [ ep, dp, sp, vp ] );
    } ).then( function( [ e, d, s, v ] ) {
        var ep = C.importKey(
            "jwk", JSON.parse( e ), pub_enc_algo, false, [] );
        var dp = decrypt_aes_cbc( new Uint8Array( 16 ), login_key, hexToBuf( d ) );
        var sp = decrypt_aes_cbc( new Uint8Array( 16 ), login_key, hexToBuf( s ) );
        var vp = C.importKey(
            "jwk", JSON.parse( v ), signing_algo, false, [ "verify" ] );
        return P.all( [ ep, dp, sp, vp ] );
    } ).then( function( [ e, d, s, v ] ) {
        u_encrypt.publicKey = e;
        u_sign.publicKey = v;
        var dp = C.importKey(
            "jwk", JSON.parse( decode( d ) ), pub_enc_algo, false, [ "deriveKey" ] );
        var sp = C.importKey(
            "jwk", JSON.parse( decode( s ) ), signing_algo, false, [ "sign" ] );
        return P.all( [ dp, sp ] );
    } ).then( function( [ d, s ] ) {
        u_encrypt.privateKey = d;
        u_sign.privateKey = s;
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
            alert( 'The username "'+elemUID.value+'" is already registered' );
            return P.reject( new NameNotAvailableError() );
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
        var sp = C.generateKey( signing_algo, true, [ 'sign', 'verify' ] );
        var ep = C.generateKey( pub_enc_algo, true, [ 'deriveKey', 'deriveBits' ] );
        var lp = makeLoginKey( elemUID.value, elemPass.value, salt );
        var up = uploadToCloud( 'salt', bufToHex( salt ) );
        return P.all( [ sp, ep, lp, up ] );
    } ).then( function( [ s, e, l, u ] ) {
        log( 'Generated user key-pairs' );
        var u_sign_keypair = s;
        var u_encr_keypair = e;
        login_key          = l;
        var keys = [ u_encr_keypair.privateKey, u_encr_keypair.publicKey,
                     u_sign_keypair.privateKey, u_sign_keypair.publicKey ];
        var promises = keys.map( function( k ) { return C.exportKey( 'jwk', k ) } );
        promises.push( encrypt_aes_cbc( salt.slice( 0, 16 ), login_key, u_cloud.b ) );
        return P.all( promises );
    } ).then( function( [ d, e, s, v, link_encrypted ] ) {
        var ep = uploadToCloud( 'key_encrypt', JSON.stringify( e ) );
        var vp = uploadToCloud( 'key_verify',  JSON.stringify( v ) );
        var dp = encrypt_aes_cbc( new Uint8Array( 16 ), login_key,
                                  encode( JSON.stringify( d ) ) );
        var sp = encrypt_aes_cbc( new Uint8Array( 16 ), login_key,
                                  encode( JSON.stringify( s ) ) );

        var registration_info = {
            link   : bufToHex( link_encrypted ),
            pub_key: v,
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
        return P.all( [ ep, vp, dp, sp, r ] );
    } ).then( function( [ e, v, d, s, r ] ) {
        var dp = uploadToCloud( 'key_decrypt', bufToHex( d ) );
        var sp = uploadToCloud( 'key_sign',    bufToHex( s ) );
        return P.all( [ dp, sp ] );
    } ).then( function( [ d, s ] ) {
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

/* Concatenate team and path */
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

function onCreateTeam( team_name )
{
    var team_encrypt_keypair  = null;
    var team_sign_keypair     = null;
    var team_encrypt_exported = null;
    var team_sign_exported    = null;
    var team_key              = null;
    log( 'creating a new team:', team_name );
    var ep = C.generateKey( pub_enc_algo, true, [ 'deriveKey', 'deriveBits' ] )
    var sp = C.generateKey( signing_algo, true, [ 'sign', 'verify' ] );
    var tp = C.generateKey( sym_enc_algo, true, [ "encrypt", "decrypt" ] );
    P.all( [ ep, sp, tp ] )
    .then( function( [ e, s, t ] ) {
        team_encrypt_keypair = k;
        team_sign_keypair = k;
        log( 'Generated keys', e, s, t );
        var keys = [ e.privateKey, e.publicKey, s.privateKey, s.publicKey, t ];
        return P.all(
            keys.map( function( k ) { return C.exportKey( 'jwk', k ) } ) );
    } ).then( function( [ d, e, s, v, t ] ) {
        team_encrypt_exported = e.e;
        team_sign_exported    = e.s;
        log( 'Exported key-pairs', e );
        team_id = new Uint8Array( 5 );
        window.crypto.getRandomValues( team_id );
        /* XXX Check that ID is not already in use */
        team_id_hex = bufToHex( team_id );
        log( 'Team ID:', link_id_hex, link_id );
        var ep = uploadTextFile(
            link_id_hex, in_team_dir( team_id_hex, 'key_encrypt' ),
            JSON.stringify( team_encrypt_exported.publ ) );
        var vp = uploadTextFile(
            link_id_hex, in_team_dir( team_id_hex, 'key_verify' ),
            JSON.stringify( team_sign_exported.publ ) );
        var dp = encrypt_aes_cbc( new Uint8Array( 16 ), login_key,
                                  encode( JSON.stringify( d ) ) );
        var sp = encrypt_aes_cbc( new Uint8Array( 16 ), login_key,
                                  encode( JSON.stringify( s ) ) );
        var tp = encrypt_aes_cbc( new Uint8Array( 16 ), login_key,
                                  encode( JSON.stringify( t ) ) );
        var cp = downloadDecryptDeccode( link_id_hex, [ 'Teams', 'teams' ],
                                         login_key, new Uint8Array( 16 ) );
        return P.all( [ ep, vp, dp, sp, tp, cp ] );
    } ).then( function( [ e, v, d, s, t, c ] ) {
        var dp = uploadTextFile(
            link_id_hex, in_team_dir( team_id_hex, 'key_decryption' ), bufToHex( d ) );
        var sp = uploadTextFile(
            link_id_hex, in_team_dir( team_id_hex, 'key_sign' ), bufToHex( s ) );
        var tp = uploadTextFile(
            link_id_hex, in_team_dir( team_id_hex, 'key_team' ), bufToHex( t ) );
        /* XXX need to think carefully about concurrency here */
        var team_contents = team_id_hex + ' ' + team_name + '\n' + c;
        var cp = encrypt_aes_cbc( new Uint8Array( 16 ), login_key,
                                  encode( team_contents ) );
        return P.all( [ dp, sp, tp, cp ] );
    } ).then( function( [ d, s, t, c ] ) {
        return uploadTextFile( link_id_hex, [ 'Teams', 'teams' ], bufToHex( c ) );
    } ).then( function( resp ) {
        log( 'Created new team!' );
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
