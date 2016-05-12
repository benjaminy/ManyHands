/*
 *
 */

    //     sessionStorage.setItem( 'filePort', p );
    //     window.location.href = 'main.html';

var C         = window.crypto.subtle;
var log       = console.log.bind( console );
var getElemId = document.getElementById.bind( document );

var elemUID  = getElemId( 'IdUserId' );
var elemPass = getElemId( 'IdPasswd' );

var encoding = 'utf-8';
var encoder  = new TextEncoder( encoding );
var decoder  = new TextDecoder( encoding );

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

function bufToHex( buf )
{
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
    return hex;
}

function hexToBuf( hex )
{
    if( ( hex.length % 2 ) == 1 )
    {
        throw 'asfg';
    }
    var num_bytes = hex.length / 2;
    var buf = new Uint8Array( num_bytes );
    for( var i = 0; i < num_bytes; i++ )
    {
        buf[i] = parseInt( hex.slice( 2 * i, 2 * i + 2 ), 16 );
    }
    return buf;
}

function stringsToBuf( strings )
{
    var bufs = [];
    var total_bytes = 0;
    for( var i = 0; i < strings.length; i++ )
    {
        bufs.push( encoder.encode( strings[ i ] ) );
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

/*
 * username : string
 * password : string
 * salt     : array buffer thing
 */
function makeLoginKey( username, password, salt )
{
    var up = stringsToBuf( [ username, password ] );
    return C.importKey( 'raw', up, { name: 'PBKDF2' }, false, [ 'deriveKey' ]
    ).then( function( temp_key ) {
        return C.deriveKey(
            { name: 'PBKDF2', salt: salt, iterations: 1000, hash: { name: 'SHA-1' }, },
            temp_key, { name: 'AES-CBC', length: 256 }, false, [ 'encrypt', 'decrypt' ] );
    } );
}

function encode_helper( user, path )
{
    if( !path.isArray() )
    {
        path = [ path ];
    }
    return { p: path.map( encodeURIcomponent ).join( '/' ),
             u: encodeURIcomponent( user ) };
}

/* path_pre_encode can be an array of strings or a single string */
function uploadTextFile( user, path, content )
{
    var pu = encode_helper( user, path );
    return fetch( FILE_SERVER_ADDR+'/'+pu.u+'/'+pu.p,
                  { method  : 'POST',
                    body    : content,
                    headers : new Headers( {
                        'Content-Type':   'text/plain',
                        'Content-Length': '' + content.length
                    } ) } );
}

function uploadTextFiles( params )
{
    var promises = [];
    for( var i = 0; i < params.length; i++ )
    {
        var p = params[i];
        promises.push( uploadTextFile( p.u, p.p, p.c ) );
    }
    var idx = 0;
    resps = [];
    return new Promise( function( resolve, reject ) {
        for( var i = 0; i < promises.length; i++ )
        {
            promises[i].then( function( resp ) {
                resps[i] = resp;
            } ).catch( function( err ) {
                reject( err );
            } );
        }
        resolve( resps );
    } );
}

function downloadTextFile( user_pre_encode, path_pre_encode )
{
    var pu = encode_helper( user_pre_encode, path_pre_encode );
    return fetch( FILE_SERVER_ADDR+'/'+pu.u+'/'+pu.p )
    .then( function( resp ) {
        if( !resp.ok )
        {
            if( resp.status == 404 )
                throw new NotFoundError( pu.p );
            else if( resp.status >= 400 && resp.status < 500 )
                resp.text().then( function( t ) {
                    throw new RequestError( pu.p, resp.statusText + ' ' + t );
                } );
            else
                resp.text().then( function( t ) {
                    throw new ServerError( pu.p, resp.statusText + ' ' + t );
                } );
        }
        return resp.text();
    } );
}

function downloadDecryptDecode( cloud, path, key, iv )
{
    return downloadTextFile( cloud, path
    ).then( function( resp_text ) {
        return C.decrypt(
            { name: 'AES-CBC', iv: iv }, key, hexToBuf( resp_text ) );
    } ).then( function( decrypted ) {
        return new Promise( function( resolve, reject ) {
            resolve( decoder.decode( decrypted ) );
    } );
}

function onLoginReq()
{
    var salt      = null;
    var enc_link  = null;
    var link_id   = null;
    var enc_enc   = null;
    var sign_enc  = null;
    var enc_keys  = { priv: null, publ: null };
    var sign_keys = { priv: null, publ: null };

    var uid_enc = encoder.encode( elemUID.value );
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
            throw new NotFoundError();
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
        return downloadTextFile( link_id_hex, 'encryption_public_key' );
    } ).then( function( k ) {
        enc_keys.publ = JSON.parse( k );
        return downloadTextFile( link_id_hex, 'signing_public_key' );
    } ).then( function( k ) {
        sign_keys.publ = JSON.parse( k );
        return downloadTextFile( link_id_hex, 'encryption_private_key' );
    } ).then( function( k ) {
        enc_enc = k;
        return downloadTextFile( link_id_hex, 'signing_private_key' );
    } ).then( function( k ) {
        sign_enc = k;
        return C.decrypt(
            { name: 'AES-CBC', iv: new Uint8Array( 16 ) }, login_key, hexToBuf( enc_enc ) );
    } ).then( function( k ) {
        enc_keys.priv = JSON.parse( decoder.decode( k ) );
        return C.decrypt(
            { name: 'AES-CBC', iv: new Uint8Array( 16 ) }, login_key, hexToBuf( sign_enc ) );
    } ).then( function( k ) {
        sign_keys.priv = JSON.parse( decoder.decode( k ) );
        log( 'Got they keys!!!', enc_keys, sign_keys );
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

/* Given keys as JS objects, generate exported versions */
function exportKeypairs( enc_keys, sign_keys )
{
    var enc_exported  = { priv: null, publ: null };
    var sign_exported = { priv: null, publ: null };
    log( 'Running exportKeys', enc_keys, sign_keys );
    return C.exportKey( 'jwk', enc_keys.privateKey )
    .then( function( d ) {
        enc_exported.priv = d;
        return C.exportKey( 'jwk', enc_keys.publicKey );
    } ).then( function( d ) {
        enc_exported.publ = d;
        return C.exportKey( 'jwk', sign_keys.privateKey );
    } ).then( function( d ) {
        sign_exported.priv = d;
        return C.exportKey( 'jwk', sign_keys.publicKey );
    } ).then( function( d ) {
        sign_exported.publ = d;
        return new Promise( function( resolve, reject ) {
            resolve( { e: enc_exported, s: sign_exported } );
        } );
    } );
}

function onRegisterReq()
{
    var hashedUID     = null;
    var enc_keypair   = null;
    var sign_keypair  = null;
    var salt          = null;
    var enc_exported  = { priv: null, publ: null };
    var sign_exported = { priv: null, publ: null };
    var link_id       = null;
    var link_id_hex   = null;

    var uid_enc = encoder.encode( elemUID.value );
    C.digest( 'SHA-256', uid_enc )
    .then( function( h ) {
        log( 'uid hash', typeof( h ), h, bufToHex( h ) );
        hashedUID = bufToHex( h );
        return fetch( '/Users/'+hashedUID );
    } ).then( function( resp ) {
        if( resp.ok )
        {
            alert( 'That username ('+elemUID.value+') is already registered' );
            throw new NameNotAvailableError();
        }
        else
        {
            /* assert not registered */
            log( 'Userid available', resp );
            return C.generateKey( { name: 'ECDH', namedCurve: 'P-521' },
                                  true,
                                  [ 'deriveKey', 'deriveBits' ] );

        }
    } ).then( function( e ) {
        enc_keypair = e;
        log( 'Generated encryption key-pair', enc_keypair );
        return C.generateKey( { name: 'ECDSA', namedCurve: 'P-521' },
                              true,
                              [ 'sign', 'verify' ] );
    } ).then( function( s ) {
        sign_keypair = s;
        log( 'Generated signing key-pair', sign_keypair );
        return exportKeypairs( enc_keypair, sign_keypair );
    } ).then( function( d ) {
        enc_exported  = d.e;
        sign_exported = d.s;
        log( 'Exported key-pairs', d, enc_exported, sign_exported );
        link_id = new Uint8Array( 5 );
        window.crypto.getRandomValues( link_id );
        link_id_hex = bufToHex( link_id );
        log( 'link ID:', link_id_hex, link_id );
        return uploadTextFile(
            link_id_hex, 'encryption_public_key', JSON.stringify( enc_exported.publ ) );
    } ).then( function( resp ) {
        if( !resp.ok )
        {
            resp.text().then( function( t ) {
                throw new ServerError( 'Failed to upload encryption public key', t );
            } );
        }
        return uploadTextFile(
            link_id_hex, 'signing_public_key', JSON.stringify( sign_exported.publ ) );
    } ).then( function( resp ) {
        if( !resp.ok )
        {
            resp.text().then( function( t ) {
                throw new ServerError( 'Failed to upload signing public key', t );
            }
        }
        salt = new Uint8Array( SALT_NUM_BYTES );
        window.crypto.getRandomValues( salt );
        return makeLoginKey( elemUID.value, elemPass.value, salt );
    } ).then( function( k ) {
        login_key = k;
        log( 'Made the login key!', login_key );
        var p = encoder.encode( JSON.stringify( enc_exported.priv ) );
        return C.encrypt(
            { name: 'AES-CBC', iv: new Uint8Array( 16 ) }, login_key, p );
    } ).then( function( encrypted_enc_priv ) {
        return uploadTextFile(
            link_id_hex, 'encryption_private_key', bufToHex( encrypted_enc_priv ) );
    } ).then( function( resp ) {
        if( !resp.ok )
        {
            resp.text().then( function( t ) {
                throw new ServerError( 'Failed to upload encryption private key', t );
            }
        }
        var p = encoder.encode( JSON.stringify( sign_exported.priv ) );
        return C.encrypt(
            { name: 'AES-CBC', iv: new Uint8Array( 16 ) }, login_key, p );
    } ).then( function( encrypted_sign_priv ) {
        return uploadTextFile(
            link_id_hex, 'signing_private_key', bufToHex( encrypted_sign_priv ) );
    } ).then( function( resp ) {
        if( !resp.ok )
        {
            resp.text().then( function( t ) {
                throw new ServerError( 'Failed to upload signing private key', t );
            }
        }
        return C.encrypt(
            { name: 'AES-CBC', iv: salt.slice( 0, 16 ) }, login_key, link_id );
    } ).then( function( enc_link ) {
        log( 'encrypted link:', new Uint8Array( enc_link ) );
        log( 'blah:', String.fromCharCode.apply( null, new Uint8Array( enc_link ) ) );
        var reg_info = {
            link   : bufToHex( enc_link ),
            pub_key: sign_exported.publ,
            salt   : bufToHex( salt ),
        };
        var content = JSON.stringify( reg_info );
        log( 'JSON:', content );
        return fetch( '/Register/'+hashedUID,
               { method  : 'POST',
                 body    : content,
                 headers : new Headers( {
                     'Content-Type':   'text/plain',
                     'Content-Length': '' + content.length
                 } ) } );
    } ).then( function( resp ) {
        if( !resp.ok )
        {
            resp.text().then( function( t ) {
                throw new ServerError( 'Registration upload failed', t );
            }
        }
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
    if( path.isArray() )
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
        var p = encoder.encode( JSON.stringify( team_encrypt_exported.priv ) );
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
        var p = encoder.encode( JSON.stringify( team_sign_exported.priv ) );
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
            encoder.encode( JSON.stringify( team_sign_exported.priv ) ) );
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
            encoder.encode( team_contents ) );
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
