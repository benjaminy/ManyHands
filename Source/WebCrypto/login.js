/*
 *
 */

var encoding = 'utf-8';
var [ encode, decode ] = encodeDecodeFunctions( encoding );

var SALT_NUM_BYTES = 128;
var SIG_LENGTH = 132;
var PBKDF2_ITER = 1000;

var FILE_SERVER_PORT = 8123;
var FILE_SERVER_ADDR = 'http://localhost:'+FILE_SERVER_PORT;

var signing_kalgo = { name:   'ECDSA', namedCurve: 'P-521' };
var signing_salgo = { name:   'ECDSA', hash: { name:'SHA-256' } };
var pub_enc_algo  = { name:    'ECDH', namedCurve: 'P-521' };
var sym_enc_algo  = { name: 'AES-CBC',     length:    256  };

/**
 * User objects have the following fields
 *
 * uid
 *
 * salt
 *
 * login_key is derived from username, password and salt.  It should
 * _only_ be used to en/decrypt the cloud link received from the central
 * server and the user's private encryption key.
 *
 * encrypt_pair is the primary public/private key pair for
 * en/decryption for the user.
 *
 * signing_pair is the primary public/private key pair for
 * signing/verification for the user.
 *
 * main_key is a symmetric key that is the workhorse for
 * en/decrypting personal information
 *
 * cloud is the information needed to access the user's cloud
 * storage
 *
 * teams
 *
 * invites
 */

function encrypt_and_sign( e_algo, s_algo, e_key, s_key, d )
{
    log( '[Debug]', d );
    return C.encrypt( e_algo, e_key, d )
    .then( function( m ) {
        return P.all( [ C.sign( s_algo, s_key, m ), P.accept( m ) ] );
    } ).then( function( [ s, m ] ) {
        return P.accept( typedArrayConcat( s, m ) );
    } ).catch( domToCrypto );
}

function verify_and_decrypt( e_algo, s_algo, e_key, s_key, d, s_bytes )
{
    var d_as_bytes = new Uint8Array( d );
    var s = d_as_bytes.subarray( 0, s_bytes );
    var m = d_as_bytes.subarray( s_bytes );
    log( 'ABOUT TO VERIFY' );
    return C.verify( s_algo, s_key, s, m )
    .then( function( v ) {
        log( 'ABOUT TO DECRYPT', v );
        if( !v )
            return P.reject( new VerificationError() );
        /* 'else' */
        return C.decrypt( e_algo, e_key, m );
    } ).catch( domToCrypto );
}

function encrypt_and_sign_ac_ed( e_key, s_key, iv, d )
{
    return encrypt_and_sign(
        { name: 'AES-CBC', iv: iv },
        { name: 'ECDSA', hash: { name:'SHA-256' } },
        e_key, s_key, d );
}

function verify_and_decrypt_ac_ed( e_key, s_key, iv, d )
{
    return P.all( [ C.exportKey( 'jwk', e_key ), C.exportKey( 'jwk', s_key ) ] )
    .then( function( [ e, s ] ) {
        var d8 = new Uint8Array( d )
        log( 'V AND D e:', e );
        log( 'V AND D s:', s );
        log( 'V AND D i:', new Uint8Array( iv ) );
        log( 'V AND D d:', typeof( d ), d8.length, d.byteLength, d8 );
        return P.resolve();
    } ).then( function( _ ) {
        return verify_and_decrypt(
        { name: 'AES-CBC', iv: iv },
        { name: 'ECDSA', hash: { name:'SHA-256' } },
        e_key, s_key, d, SIG_LENGTH );

    } );
}

function encrypt_aes_cbc( iv, k, d )
{
    return C.encrypt( { name: 'AES-CBC', iv: iv }, k, d )
    .then( function( v ) {
        return P.accept( v );
    },
    function( err ) {
        if( err instanceof DOMException )
            return P.reject( new CryptoError() );
        else
            return P.reject( err );
    } );
}

function decrypt_aes_cbc( iv, k, d )
{
    return C.decrypt( { name: 'AES-CBC', iv: iv }, k, d )
    .then( function( v ) {
        return P.accept( v );
    },
    function( err ) {
        if( err instanceof DOMException )
            return P.reject( new CryptoError() );
        else
            return P.reject( err );
    } );
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
    return C.importKey( 'raw', up, { name: 'PBKDF2' }, true, [ 'deriveKey' ]
    ).then( function( k ) {
        return C.deriveKey(
            { name: 'PBKDF2', salt: salt, iterations: PBKDF2_ITER, hash: { name: 'SHA-1' }, },
            k, sym_enc_algo, true, [ 'encrypt', 'decrypt' ] );
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

function uploadFileTo( cloud )
{
    return function( path, content, content_type )
    {
        return uploadFile( cloud, path, content, content_type );
    }
}

function downloadFileFrom( cloud )
{
    return function( path, text )
    {
        return downloadFile( cloud, path, text );
    }
}

/* Begin registration for the ManyHands protocol */

/* Returns a resolved Promise if successful; a rejected Promise otherwise */
function register( name, passwd )
{
    var user = {}
    return checkNameAvailability( name, user )
    .then( function( _ ) {
        return initializeBasicUserAccount( name, passwd, user );
    } ).then( function( _ ) {
        log( '[Register] Keys initialized' );
        return initializeCloudStorage( user );
    } ).then( function( _ ) {
        log( '[Register] Cloud storage initialized' );
        return submitRegistrationInfo( user );
    } ).then( function( _ ) {
        log( '[Register] Complete!' );
        return P.accept( user );
    } );
}

function checkNameAvailability( name, user )
{
    return C.digest( 'SHA-256', encode( name ) )
    .then( function( h ) {
        user.name_hashed = bufToHex( h );
        log( '[Register] Hashed uid', bufToHex( h ) );
        return fetch( '/Users/'+user.name_hashed );
    } ).then( function ( resp ) {
        log( '[Register] uid check', resp.status, resp.statusText );
        if( resp.ok )
            return P.reject( new NameNotAvailableError() );
        else if( resp.status != 404 )
        {
            return new Promise( function( accept, reject )
            {
                var msg = '/Users/'+user.name_hashed+' '+resp.statusText + ' ';
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

function initializeBasicUserAccount( name, passwd, user )
{
    user.salt = getRandomBytes( SALT_NUM_BYTES );
    var ep = C.generateKey( pub_enc_algo, true, [ 'deriveKey', 'deriveBits' ] );
    var sp = C.generateKey( signing_kalgo, true, [ 'sign', 'verify' ] );
    var lp = makeLoginKey( name, passwd, user.salt );
    return P.all( [ ep, sp, lp ] )
    .then( function( [ e, s, l ] ) {
        user.encrypt_pair = e;
        user.signing_pair = s;
        user.login_key    = l;
        return C.deriveKey(
            { name: 'ECDH', namedCurve: 'P-521', public: user.encrypt_pair.publicKey },
            user.encrypt_pair.privateKey,
            sym_enc_algo, true, [ 'encrypt', 'decrypt' ] );
    } ).then( function( k ) {
        user.main_key = k;
        return P.accept( '' );
    } );
}

function initializeCloudStorage( user )
{
    user.cloud_bits = getRandomBytes( 5 );
    user.cloud_text = bufToHex( user.cloud_bits );
    log( 'user cloud link:', user.cloud_text, user.cloud_bits );
    var dp = C.exportKey( 'jwk', user.encrypt_pair.privateKey );
    var sp = C.exportKey( 'jwk', user.signing_pair.privateKey );
    return P.all( [ dp, sp ] )
    .then( function( [ d, s ] ) {
        var bad_salt = new Uint8Array( 16 );
        log( '[init cloud] Exported private keys' );
        var dp = encrypt_and_sign_ac_ed(
            user.login_key, user.signing_pair.privateKey, bad_salt,
            encode( JSON.stringify( d ) ) );
        function encrypt( [ d, s ] )
        { return encrypt_and_sign_ac_ed( user.main_key, user.signing_pair.privateKey, s, d ); }
        var to_encrypt = [ [ encode( JSON.stringify( s ) ), bad_salt ],
                           [ encode( '{}' ), bad_salt ],
                           [ encode( '{}' ), bad_salt ] ];
        var ep = C.exportKey( 'jwk', user.encrypt_pair.publicKey );
        var vp = C.exportKey( 'jwk', user.signing_pair.publicKey );
        return P.all( to_encrypt.map( encrypt ).concat( [ dp, ep, vp ] ) );
    } ).then( function( [ s, t, i, d, e, v ] ) {
        log( '[init cloud] Exported public keys and encrypted private keys' );
        function upload( [ p, c, t ] ) { return uploadFile( user.cloud_text, p, c, t ) };
        var fs = [ [ 'key_encrypt', JSON.stringify( e ), 'text/plain' ],
                   [ 'key_verify',  JSON.stringify( v ), 'text/plain' ],
                   [ 'key_decrypt', d ],
                   [ 'key_sign', s ],
                   [ [ 'Teams', 'manifest' ], t ],
                   [ [ 'Invites', 'manifest' ], i ],
                   [ 'salt', user.salt ] ]
        return P.all( fs.map( upload ) );
    } );
}

function submitRegistrationInfo( user )
{
    var vp = C.exportKey( 'jwk', user.signing_pair.publicKey );
    var lp = encrypt_aes_cbc( user.salt.slice( 0, 16 ), user.login_key, user.cloud_bits );
    return P.all( [ vp, lp ] )
    .then( function( [ v, l ] ) {
        log( '[Register] Encrypted link', user.cloud_bits, user.cloud_bits.length );
        var registration_info = {
            link   : bufToHex( l ),
            pub_key: v,
            salt   : bufToHex( user.salt ),
        };
        var content = JSON.stringify( registration_info );
        return fetch( '/Register/'+user.name_hashed,
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
            var msg = '/Users/'+user.name_hashed+' '+resp.statusText + ' ';
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

function login( name, passwd )
{
    var user = {};
    return getRegistrationInfo( name, passwd, user )
    .then( function( _ ) {
        return loginCloud( user );
    } ).then( function( _ ) {
        log( '[Login] Complete' );
        return P.accept( user );
    } );
}

function getRegistrationInfo( name, passwd, user )
{
    var uid = name;
    var pass = passwd;
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
        user.salt   = hexToBuf( registration_info.salt );
        enc_link = hexToBuf( registration_info.encrypted_link );
        return makeLoginKey( uid, pass, user.salt );
    } ).then( function( k ) {
        user.login_key = k;
        log( '[Login] Made login key' );
        return decrypt_aes_cbc( user.salt.slice( 0, 16 ), user.login_key, enc_link );
    } ).then( function( l ) {
        user.cloud_bits = l;
        user.cloud_text = bufToHex( user.cloud_bits );
        log( '[Login] Decrypted link', user.cloud_text, user.cloud_bits );
        return P.accept( '' );
    } ).catch( function( err ) {
        if( err instanceof CryptoError )
        {
            return P.reject( new AuthenticationError() );
        }
        else return P.reject( err );
    } );
}

function loginCloud( user )
{
    user.encrypt_pair = {};
    user.signing_pair = {};
    var download = downloadFileFrom( user.cloud_text );
    var ep = download( 'key_encrypt', true );
    var vp = download( 'key_verify' , true );
    var dp = download( 'key_decrypt' );

    /* XXX download team and invite information */
    user.teams = {};
    user.invites = {};
    /* XXX */

    return P.all( [ ep, vp, dp ] )
    .then( function( [ e, v, d ] ) {
        log( '[Login] Downloaded public keys and decryption key' );
        var ep = C.importKey(
            'jwk', JSON.parse( e ), pub_enc_algo, true, [] );
        var vp = C.importKey(
            'jwk', JSON.parse( v ), signing_kalgo, true, [ 'verify' ] );
        return p_all_accept( [ ep, vp ], [ d ] );
    } ).then( function( [ e, v, d ] ) {
        log( '[Login] Imported public keys' );
        user.encrypt_pair.publicKey = e;
        user.signing_pair.publicKey = v;
        return verify_and_decrypt_ac_ed( user.login_key, user.signing_pair.publicKey,
                                         new Uint8Array( 16 ), d );
    } ).then( function( d ) {
        log( '[Login] Decrypted decryption key', d );
        return C.importKey(
            'jwk', JSON.parse( decode( d ) ), pub_enc_algo, true, [ 'deriveKey' ] );
    } ).then( function( d ) {
        user.encrypt_pair.privateKey = d;
        var kp = C.deriveKey(
            { name: 'ECDH', namedCurve: 'P-521', public: user.encrypt_pair.publicKey },
            user.encrypt_pair.privateKey,
            sym_enc_algo, true, [ 'encrypt', 'decrypt' ] );
        var sp = download( 'key_sign' );
        var tp = download( [ 'Teams', 'manifest' ] );
        var ip = download( [ 'Invites', 'manifest' ] );
        return P.all( [ kp, sp, tp, ip ] );
    } ).then( function( [ k, s, t, i ] ) {
        log( '[Login] Downloaded signing key and derived main key' );
        user.main_key = k
        function decrypt( d )
        { return verify_and_decrypt_ac_ed( user.main_key, user.signing_pair.publicKey,
                                           new Uint8Array( 16 ), d ); }
        return P.all( [ s, t, i ].map( decrypt ) );
    } ).then( function( [ s, t, i ] ) {
        log( '[Login] Decrypted signing key', t, i );
        user.teams = JSON.parse( decode( t ) );
        user.invites = JSON.parse( decode( i ) );
        return C.importKey(
            'jwk', JSON.parse( decode( s ) ), signing_kalgo, true, [ 'sign' ] );
    } ).then( function( s ) {
        user.signing_pair.privateKey = s;
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

function createTeam( team_name, user )
{
    var upload = uploadFileTo( user.cloud_text );
    var t_signing_pair = null;
    var t_encrypt_pair = null;
    var t_main_key = null;
    var team_id = makeUniqueId( user.teams );

    var team_encrypt_exported = null;
    var team_sign_exported    = null;
    var team_key              = null;
    log( '[TeamCreate] Starting', team_name, team_id );
    var ep = C.generateKey(  pub_enc_algo, true, [ 'deriveKey', 'deriveBits' ] )
    var sp = C.generateKey( signing_kalgo, true, [ 'sign', 'verify' ] );
    var tp = C.generateKey(  sym_enc_algo, true, [ 'encrypt', 'decrypt' ] );
    return P.all( [ ep, sp, tp ] )
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
        for( var property in user.teams )
        {
            teams_file_contents[ property ] = user.teams.name;
        }
        teams_file_contents[ team_id ] = team_name;
        t_encrypt_pair.publicKeyExported = e;
        t_signing_pair.publicKeyExported = v;

        var bad_salt = new Uint8Array( 16 );
        function encrypt( [ d, s ] )
        { return encrypt_and_sign_ac_ed( user.main_key, user.signing_pair.privateKey, s, d ); }
        var to_encrypt = [ [ encode( JSON.stringify( d ) ), bad_salt ],
                           [ encode( JSON.stringify( s ) ), bad_salt ],
                           [ encode( JSON.stringify( t ) ), bad_salt ],
                           [ encode( JSON.stringify( teams_file_contents ) ), bad_salt ] ];
        return P.all( to_encrypt.map( encrypt ) );
    } ).then( function( [ d, s, t, c ] ) {
        log( '[TeamCreate] Encrypted keys' );
        function uploadInTeamDir( nct )
        {
            var t = undefined;
            if( 't' in nct ) t = nct.t;
            return upload( in_team_dir( team_id, nct.n ), nct.c, nct.t );
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
        promises.push( upload( [ 'Teams', 'manifest' ], c ) );
        return P.all( promises );
    } ).then( function( [ e, v, d, s, t, c ] ) {
        log( '[TeamCreate] Complete' );
        user.teams[ team_id ] =
            {
                name: team_name,
                signing_pair: t_signing_pair,
                encrypt_pair: t_encrypt_pair,
                main_key: t_main_key
            }
    } );
}


/*
 * Current invitation process:
 * 1) A sends cloud link to B
 * 2) B makes a placeholder Team folder,
 *    finds A's public key,
 *    sends cloud link and Team ID to A, all encrypted and signed
 * 3) A makes
 */

function makeInvite( invite_user, invite_team, user )
{
    var invite_id   = makeUniqueId( user.invites );
    var invite_salt = getRandomBytes( 16 );
    var contents    = JSON.stringify( { id: invite_user, team: invite_team } );
    var ip = encrypt_and_sign_ac_ed(
        user.main_key, user.signing_pair.privateKey, invite_salt, encode( contents ) );
    var sp = encrypt_and_sign_ac_ed(
        user.main_key, user.signing_pair.privateKey, new Uint8Array( 16 ), invite_salt );
    return P.all( [ ip, sp ] )
    .then( function( [ i, s ] ) {
        log( '[Invite] Encrypted and signed' );
        function uploadHelper( [ d, n, t ] )
        { return uploadFile( user.cloud_text, [ 'Invites', invite_id, n ], d, t ); }

        f = [ [ i, 'step1' ], [ s, 'salt' ], [ '', 'step3', 'text/plain' ] ];
        return P.all( f.map( uploadHelper ) );
    } ).then( function( _ ) {
        log( '[Invite] Uploaded' );
        return P.accept( JSON.stringify( { c:user.cloud_text, i:invite_id } ) );
    } );
}

function inviteAccept( invite_input, user )
{
    var invite      = JSON.parse( invite_input );
    var team_id     = makeUniqueId( user.teams );
    var invite_id   = makeUniqueId( user.invites );
    var invite_salt = getRandomBytes( 16 );
    var debug_k;
    return downloadFile( invite.c, 'key_encrypt', true )
    .then( function( k ) {
        log( '[InviteAccept] Downloaded key' );
        return C.importKey( 'jwk', JSON.parse( k ), pub_enc_algo, true, [] );
    } ).then( function( k ) {
        log( '[InviteAccept] Imported key' );
        return C.deriveKey(
            { name: 'ECDH', namedCurve: 'P-521', public: k },
            user.encrypt_pair.privateKey,
            sym_enc_algo, true, [ 'encrypt', 'decrypt' ] );
    } ).then( function( k ) {
        return p_all_accept( [ C.exportKey( 'jwk', k ) ], [ k ] );
    } ).then( function( [ ex, k ] ) {
        log( '[InviteAccept] Derived key!', ex );
        var msg = encode( JSON.stringify( { l: user.cloud_text, t: team_id, i:invite.i } ) );
        var ip = encrypt_and_sign_ac_ed(
            k, user.signing_pair.privateKey, invite_salt, msg );
        var sp = encrypt_and_sign_ac_ed(
            k, user.signing_pair.privateKey, new Uint8Array( 16 ), invite_salt );
        debug_k = k;
        return P.all( [ ip, sp ] )
    } ).then( function( [ i, s ] ) {
        log( '[InviteAccept] Encrypted and signed', s, debug_k, user.signing_pair.publicKey );
        function uploadHelper( [ d, n, t ] )
        { return uploadFile( user.cloud_text, [ 'Invites', invite_id, n ], d, t ); }

        f = [ [ i, 'step2' ], [ s, 'salt' ] ];
        return P.all( f.map( uploadHelper ) );
    } ).then( function( _ ) {
        log( '[InviteAccept] Uploaded' );
        return P.resolve( JSON.stringify( { c:user.cloud_text, i:invite_id } ) );
    } ).catch( function( err ) {
        return unhandledError( 'invite accept', err )
    } );
}

function inviteComplete( invite_input, user )
{
    var invite = JSON.parse( invite_input );
    function downloadA( [ p, t ] ) { return downloadFile( user.cloud_text, p, t ) };
    function downloadB( [ p, t ] ) { return downloadFile( invite.c, p, t ) };
    var fs = [ [ 'key_encrypt', true ],
               [ 'key_verify', true ],
               [ [ 'Invites', invite.i, 'step2' ] ],
               [ [ 'Invites', invite.i, 'salt' ] ] ];
    return P.all( fs.map( downloadB ) )
    .then( function( [ ek, vk, step2, salt_B ] ) {
        log( '[InviteComplete] Downloaded B' );
        var ep = C.importKey( 'jwk', JSON.parse( ek ), pub_enc_algo, true, [] );
        var vp = C.importKey( 'jwk', JSON.parse( vk ), signing_kalgo, true, [ 'verify' ] );
        return p_all_accept( [ ep, vp ], [ step2, salt_B ] );
    } ).then( function( [ ek, vk, step2, salt_B ] ) {
        log( '[InviteComplete] Imported keys' );
        var ep = C.deriveKey(
            { name: 'ECDH', namedCurve: 'P-521', public: ek },
            user.encrypt_pair.privateKey,
            sym_enc_algo, true, [ 'encrypt', 'decrypt' ] );
        return p_all_accept( [ ep ], [ vk, step2, salt_B ] );
    } ).then( function( [ ek, vk, step2, salt_B ] ) {
        log( '[InviteComplete] Derived', new Uint8Array( salt_B ), vk );
        var sp = verify_and_decrypt_ac_ed(
            ek, vk, new Uint8Array( 16 ), salt_B );
        return p_all_accept( [ sp ], [ ek, vk, step2 ] );
    } ).then( function( [ salt_B, ek, vk, step2 ] ) {
        log( '[InviteComplete] Decrypted salt' );
        var ip = verify_and_decrypt_ac_ed( ek, vk, salt_B, step2 );
        return p_all_accept( [ ip ], [ ek ] );
    } ).then( function( [ step2, ek ] ) {
        log( '[InviteComplete] Decrypted step2', decode( step2 ) );
        step2 = JSON.parse( decode( step2 ) );
        var sp = downloadA( [ [ 'Invites', step2.i, 'salt' ] ] );
        var ip = downloadA( [ [ 'Invites', step2.i, 'step1' ] ] );
        return p_all_accept( [ ip, sp ], [ step2, ek ] );
    } ).then( function( [ step1, salt_A, step2, ek ] ) {
        log( '[InviteComplete] Downloaded A' );
        var sp = verify_and_decrypt_ac_ed(
            user.main_key, user.signing_pair.publicKey, new Uint8Array( 16 ), salt_A );
        return p_all_accept( [ sp ], [ step1, step2, ek ] );
    } ).then( function( [ salt_A, step1, step2, ek ] ) {
        log( '[InviteComplete] Decrypted salt' );
        var ip = verify_and_decrypt_ac_ed(
            user.main_key, user.signing_pair.publicKey, salt_A, step1 );
        return p_all_accept( [ ip ], [ step2, ek ] );
    } ).then( function( [ step1, step2, ek ] ) {
        log( '[InviteComplete] Decrypted step1' );
        console.log( 'really', decode( step1 ) );
        console.log( 'yes', step2 );
    } ).catch( function( err ) {
        return unhandledError( 'invite complete', err );
    } );
}

//            return C.verify( signing_salgo, user.signing_pair.publicKey, s, m )
