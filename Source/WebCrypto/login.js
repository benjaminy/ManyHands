/*
 *
 */

var elemUID      = getElemId( 'IdUserId' );
var elemPass     = getElemId( 'IdPasswd' );
var elemLoggedIn = getElemId( 'IdLoggedIn' );
var elemTeamName = getElemId( 'IdTeamName' );

var encoding = 'utf-8';
var [ encode, decode ] = encodeDecodeFunctions( encoding );

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

/**
 *
 */
var u_uid = {};

/** login_key is derived from username, password and salt.  It should
 * _only_ be used to en/decrypt the cloud link received from the central
 * server and the user's private encryption key. */
var login_key = null;

/** u_encrypt_pair is the primary public/private key pair for
 * en/decryption for the user. */
var u_encrypt_pair = {};

/** u_signing_pair is the primary public/private key pair for
 * signing/verification for the user. */
var u_signing_pair = {};

/** u_main_key is a symmetric key that is the workhorse for
 * en/decrypting personal information */
var u_main_key = null;

/** u_cloud is the information needed to access the user's cloud
 * storage */
var u_cloud = null;

/**
 *
 */
var u_teams = {};


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
        // log( 'Login key import succeeded' )
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
function uploadFile( user, path, content, content_type )
{
    /* assert( Array.isArray( path ) || typeof( path ) == 'string' ) */
    /* assert( Array.isArray( path ) => forall i. typeof( path[i] ) == 'string' ) */
    /* assert( typeof( user ) == 'string' ) */
    /* assert( typeof( content ) is whatever fetch accepts ) */
    var pu = encode_path( user, path );
    var headers = new Headers( { 'Content-Length': '' + content.length } );
    if( content_type )
    {
        headers[ 'Content-Type' ] = content_type;
    }

    return fetch( FILE_SERVER_ADDR+'/'+pu.u+'/'+pu.p,
                  { method  : 'POST',
                    body    : content,
                    headers : headers }
    ).then( function( resp ) {
        log( 'uploadFile response:', resp.status, resp.statusText );
        /* log( 'uploadFile response', resp ); */
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
function downloadFile( user, path, text )
{
    /* assert( Array.isArray( path ) || typeof( path ) == 'string' ) */
    /* assert( Array.isArray( path ) => forall i. typeof( path[i] ) == 'string' ) */
    /* assert( typeof( user ) == 'string' ) */
    var pu = encode_path( user, path );
    return fetch( FILE_SERVER_ADDR+'/'+pu.u+'/'+pu.p
    ).then( function( resp ) {
        log( 'downloadFile response:', resp.status, resp.statusText );
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
        {
            if( text )
                return resp.text();
            else
                return resp.arrayBuffer();
        }
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
    return downloadFile( user, path
    ).then( function( resp_text ) {
        return decrypt_aes_cbc( iv, key, resp_text );
    } ).then( function( decrypted ) {
        log( 'Decrypted', decrypted.length );
        return P.accept( decode( decrypted ) );
    } );
}

/* Begin registration for the ManyHands protocol */

function onRegisterReq()
{
    checkNameAvailability()
    .then( function( _ ) {
        return initializeBasicUserAccount();
    } ).then( function( _ ) {
        log( '[Register] Keys initialized' );
        return initializeCloudStorage();
    } ).then( function( _ ) {
        log( '[Register] Cloud storage initialized' );
        return submitRegistrationInfo();
    } ).then( function( _ ) {
        log( '[Register] Complete!' );
    } ).catch( function( err ) {
        if( err instanceof NameNotAvailableError )
        {
            log( 'Username "', elemUID.value, '" taken!' );
            alert( 'The username "'+elemUID.value+'" is already registered' );
        }
        else if( err instanceof ServerError )
        {
            log( 'Server error:', err.message, 'Response text:', err.server_msg );
        }
        else if( err instanceof RequestError )
        {
            log( 'Request error:', err.message, 'Response text:', err.server_msg );
        }
        else
        {
            log( 'Mystery error 2', typeof( err ), err );
        }
    } );
}

function checkNameAvailability()
{
    return C.digest( 'SHA-256', encode( elemUID.value ) )
    .then( function( h ) {
        u_uid.hashed = bufToHex( h );
        log( '[Register] Hashed uid', bufToHex( h ) );
        return fetch( '/Users/'+u_uid.hashed );
    } ).then( function ( resp ) {
        log( '[Register] uid check', resp.status, resp.statusText );
        if( resp.ok )
            return P.reject( new NameNotAvailableError() );
        else if( resp.status != 404 )
        {
            return new Promise( function( accept, reject )
            {
                var msg = '/Users/'+u_uid.hashed+' '+resp.statusText + ' ';
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
        P.accept( '' );
    } );
}

function initializeBasicUserAccount()
{
    salt = getRandomBytes( SALT_NUM_BYTES );
    var ep = C.generateKey( pub_enc_algo, true, [ 'deriveKey', 'deriveBits' ] );
    var sp = C.generateKey( signing_algo, true, [ 'sign', 'verify' ] );
    var lp = makeLoginKey( elemUID.value, elemPass.value, salt );
    return P.all( [ ep, sp, lp ] )
    .then( function( [ e, s, l ] ) {
        u_encrypt_pair = e;
        u_signing_pair = s;
        login_key      = l;
        return C.deriveKey(
            { name: 'ECDH', namedCurve: 'P-521', public: u_encrypt_pair.publicKey },
            u_encrypt_pair.privateKey,
            sym_enc_algo, false, [ 'encrypt', 'decrypt' ] );
    } ).then( function( k ) {
        u_main_key = k;
        return P.accept( '' );
    } );
}

function initializeCloudStorage()
{
    u_cloud = {};
    u_cloud.b = getRandomBytes( 5 );
    u_cloud.t = bufToHex( u_cloud.b );
    log( 'user cloud link:', u_cloud.t, u_cloud.b );
    function uploadToCloud( p, c, t ) { return uploadFile( u_cloud.t, p, c, t ) };
    var dp = C.exportKey( 'jwk', u_encrypt_pair.privateKey );
    var sp = C.exportKey( 'jwk', u_signing_pair.privateKey );
    return P.all( [ dp, sp ] )
    .then( function( [ d, s ] ) {
        log( '[init cloud] Exported private keys' );
        var dp = encrypt_aes_cbc(
            new Uint8Array( 16 ), login_key, encode( JSON.stringify( d ) ) );
        var sp = encrypt_aes_cbc(
            new Uint8Array( 16 ), u_main_key, encode( JSON.stringify( s ) ) );
        var tp = encrypt_aes_cbc( new Uint8Array( 16 ), u_main_key, encode( '' ) );
        var ep = C.exportKey( 'jwk', u_encrypt_pair.publicKey );
        var vp = C.exportKey( 'jwk', u_signing_pair.publicKey );
        return P.all( [ dp, sp, ep, vp, tp ] );
    } ).then( function( [ d, s, e, v, t ] ) {
        log( '[init cloud] Exported public keys and encrypted private keys' );
        var ep = uploadToCloud( 'key_encrypt', JSON.stringify( e ), 'text/plain' );
        var vp = uploadToCloud( 'key_verify',  JSON.stringify( v ), 'text/plain' );
        var dp = uploadToCloud( 'key_decrypt', d );
        var sp = uploadToCloud( 'key_sign', s );
        var tp = uploadToCloud( [ 'Teams', 'teams' ], t );
        var up = uploadToCloud( 'salt', salt );
        return P.all( [ ep, vp, tp, dp, sp, up ] );
    } );
}

function submitRegistrationInfo()
{
    var vp = C.exportKey( 'jwk', u_signing_pair.publicKey );
    var lp = encrypt_aes_cbc( salt.slice( 0, 16 ), login_key, u_cloud.b );
    return P.all( [ vp, lp ] )
    .then( function( [ v, l ] ) {
        log( '[Register] Encrypted link', u_cloud.b, u_cloud.b.length, l, bufToHex( l ) );
        var registration_info = {
            link   : bufToHex( l ),
            pub_key: v,
            salt   : bufToHex( salt ),
        };
        var content = JSON.stringify( registration_info );
        return fetch( '/Register/'+u_uid.hashed,
            { method  : 'POST',
              body    : content,
              headers : new Headers( {
                  'Content-Type':   'text/plain',
                  'Content-Length': '' + content.length
              } ) } );
    } ).then( function( resp ) {
        if( resp.ok )
            return P.accept( '' );
        /* 'else' */
        return new Promise( function( accept, reject )
        {
            var msg = '/Users/'+u_uid.hashed+' '+resp.statusText + ' ';
            if( resp.status >= 400 && resp.status < 500 )
                resp.text().then( function( t ) {
                    reject( new RequestError( msg + t ) );
                } );
            else
                resp.text().then( function( t ) {
                    reject( new ServerError( msg + t ) );
                } );
        } );
    } );
}

/* End registration */

/* Begin login */

function onLoginReq()
{
    getRegistrationInfo()
    .then( function( _ ) {
        return loginCloud();
    } ).then( function( _ ) {
        log( '[Login] Complete' );
        elemLoggedIn.innerText = ''+elemUID.value+' '+u_cloud.t;
    } ).catch( function( err ) {
        if( err instanceof NotFoundError )
        {
            alert( 'Login ID not found' );
        }
        else if( err instanceof AuthenticationError )
        {
            alert( 'Wrong password' );
        }
        else
        {
            log( 'Mystery error 1', err );
        }
    } );
}

function getRegistrationInfo()
{
    var uid = elemUID.value;
    var pass = elemPass.value;
    u_cloud = {};
    var enc_link = null;
    return C.digest( 'SHA-256', encode( uid ) )
    .then( function( hashedUID ) {
        log( '[Login] uid', bufToHex( hashedUID ) );
        return fetch( '/Users/'+bufToHex( hashedUID ) );
    } ).then( function( resp ) {
        log( '[Login] central server', resp.status, resp.statusText );
        if( resp.ok )
            return resp.json();
        /* else */
        return P.reject( new NotFoundError() );
    } ).then( function( registration_info ) {
        log( '[Login] registration info', registration_info );
        salt     = hexToBuf( registration_info.salt );
        enc_link = hexToBuf( registration_info.encrypted_link );
        return makeLoginKey( uid, pass, salt );
    } ).then( function( k ) {
        login_key = k;
        log( '[Login] Made login key' );
        return decrypt_aes_cbc( salt.slice( 0, 16 ), login_key, enc_link );
    } ).then( function( l ) {
        u_cloud.b = l;
        u_cloud.t = bufToHex( u_cloud.b );
        log( '[Login] Decrypted link', u_cloud.t, u_cloud.b );
        return P.accept( '' );
    } ).catch( function( err ) {
        if( err instanceof DOMException )
        {
            return P.reject( new AuthenticationError() );
        }
        else return P.reject( err );
    } );
}

function loginCloud()
{
    var ep = downloadFile( u_cloud.t, 'key_encrypt', true );
    var vp = downloadFile( u_cloud.t, 'key_verify' , true );
    var dp = downloadFile( u_cloud.t, 'key_decrypt' );
    return P.all( [ ep, vp, dp ] )
    .then( function( [ e, v, d ] ) {
        log( '[Login] Downloaded public keys and decryption key' );
        var ep = C.importKey(
            'jwk', JSON.parse( e ), pub_enc_algo, false, [] );
        var vp = C.importKey(
            'jwk', JSON.parse( v ), signing_algo, false, [ 'verify' ] );
        var dp = decrypt_aes_cbc( new Uint8Array( 16 ), login_key, d );
        return P.all( [ ep, dp, vp ] );
    } ).then( function( [ e, d, v ] ) {
        log( '[Login] Decrypted decryption key' );
        u_encrypt_pair.publicKey = e;
        u_signing_pair.publicKey = v;
        return C.importKey(
            'jwk', JSON.parse( decode( d ) ), pub_enc_algo, false, [ 'deriveKey' ] );
    } ).then( function( d ) {
        u_encrypt_pair.privateKey = d;
        var kp = C.deriveKey(
            { name: 'ECDH', namedCurve: 'P-521', public: u_encrypt_pair.publicKey },
            u_encrypt_pair.privateKey,
            sym_enc_algo, false, [ 'encrypt', 'decrypt' ] )
        var sp = downloadFile( u_cloud.t, 'key_sign' );
        return P.all( [ kp, sp ] );
    } ).then( function( [ k, s ] ) {
        log( '[Login] Downloaded signing key and derived main key' );
        u_main_key = k
        return decrypt_aes_cbc( new Uint8Array( 16 ), u_main_key, s );
    } ).then( function( s ) {
        log( '[Login] Decrypted signing key' );
        return C.importKey(
            'jwk', JSON.parse( decode( s ) ), signing_algo, false, [ 'sign' ] );
    } ).then( function( s ) {
        u_signing_pair.privateKey = s;
        return P.accept( '' );
    } );
}

/* End login */


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

function onCreateTeam()
{
    var team_name = elemTeamName.value;
    var t_signing_pair = null;
    var t_encrypt_pair = null;
    var t_main_key = null;
    var id_found = false;
    var team_id;
    while( !id_found )
    {
        team_id = bufToHex( getRandomBytes( 5 ) );
        if( !( team_id in u_teams ) )
            id_found = true;
    }

    var team_encrypt_exported = null;
    var team_sign_exported    = null;
    var team_key              = null;
    log( '[TeamCreate] Starting', team_name, team_id );
    var ep = C.generateKey( pub_enc_algo, true, [ 'deriveKey', 'deriveBits' ] )
    var sp = C.generateKey( signing_algo, true, [ 'sign', 'verify' ] );
    var tp = C.generateKey( sym_enc_algo, true, [ 'encrypt', 'decrypt' ] );
    P.all( [ ep, sp, tp ] )
    .then( function( [ e, s, t ] ) {
        log( '[TeamCreate] Generated keys', e, s, t );
        t_signing_pair = s;
        t_encrypt_pair = e;
        t_main_key = t;
        var keys = [ e.privateKey, e.publicKey, s.privateKey, s.publicKey, t ];
        return P.all(
            keys.map( function( k ) { return C.exportKey( 'jwk', k ) } ) );
    } ).then( function( [ d, e, s, v, t ] ) {
        log( '[TeamCreate] exported keys' );
        /* This loop could be a performance bug, but team creation
         * should be infrequent, so not a big deal */
        var teams_file_contents = {};
        for( var property in u_teams )
        {
            teams_file_contents[ property ] = u_teams.name;
        }
        teams_file_contents[ team_id ] = team_name;
        t_encrypt_pair.publicKeyExported = e;
        t_signing_pair.publicKeyExported = v;
        var dp = encrypt_aes_cbc(
            new Uint8Array( 16 ), u_main_key, encode( JSON.stringify( d ) ) );
        var sp = encrypt_aes_cbc(
            new Uint8Array( 16 ), u_main_key, encode( JSON.stringify( s ) ) );
        var tp = encrypt_aes_cbc(
            new Uint8Array( 16 ), u_main_key, encode( JSON.stringify( t ) ) );
        var cp = encrypt_aes_cbc(
            new Uint8Array( 16 ), u_main_key, encode( JSON.stringify( teams_file_contents ) ) );
        return P.all( [ dp, sp, tp, cp ] );
    } ).then( function( [ d, s, t, c ] ) {
        log( '[TeamCreate] Encrypted keys' );
        function uploadInTeamDir( nct )
        {
            var t = undefined;
            if( t in nct ) t = nct.t;
            return uploadFile( u_cloud.t, in_team_dir( team_id, nct.n ), nct.c, nct.t );
        }
        var files = [
            { n: 'key_encrypt', c: JSON.stringify( t_encrypt_pair.publicKeyExported ),
              t: 'application/json' },
            { n: 'key_verify',  c: JSON.stringify( t_signing_pair.publicKeyExported ),
              t: 'application/json' },
            { n: 'key_decrypt', c: d },
            { n: 'key_sign',    c: s },
            { n: 'key_team',    c: t },
        ];
        var promises = files.map( uploadInTeamDir );
        promises.push( uploadFile( u_cloud.t, [ 'Teams', 'teams' ], c ) );
        return P.all( promises );
    } ).then( function( [ e, v, d, s, t, c ] ) {
        log( '[TeamCreate] Complete' );
        u_teams[ team_id ] =
            {
                name: team_name,
                signing_pair: t_signing_pair,
                encrypt_pair: t_encrypt_pair,
                main_key: t_main_key
            }
    } ).catch( function( err ) {
        if( err instanceof ServerError )
        {
            log( 'Server error:', err.message, 'Response text:', err.server_msg );
        }
        else
        {
            log( 'Unhandled error during team creation:', err );
            log( '???', typeof( err ) );
        }
    } );
}
