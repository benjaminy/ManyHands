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

/* Begin registration for the ManyHands protocol */

/* Returns a resolved Promise if successful; a rejected Promise otherwise */
function register( name, passwd )
{
    var user = {}
    return checkNameAvailability( name, user )
    .then( function( _ ) {
        return initializeUserAccount( name, passwd, user );
    } ).then( function( _ ) {
        log( '[Register] Keys initialized' );
        return initializeCloudStorage( user );
    } ).then( function( _ ) {
        log( '[Register] Cloud storage initialized' );
        return submitRegistrationInfo( user );
    } ).then( function( _ ) {
        log( '[Register] Registered' );
        return P.resolve( user );
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
            return new Promise( function( resolve, reject )
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
        P.resolve( '' );
    } );
}

function initializeUserAccount( name, passwd, user )
{
    user.login_salt = getRandomBytes( SALT_NUM_BYTES );
    var ep = C.generateKey( pub_enc_algo, true, [ 'deriveKey', 'deriveBits' ] );
    var sp = C.generateKey( signing_kalgo, true, [ 'sign', 'verify' ] );
    var lp = makeLoginKey( name, passwd, user.login_salt );
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
        return P.resolve( '' );
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
                           [ encode( '[]' ), bad_salt ],
                           [ encode( '{}' ), bad_salt ] ];
        var ep = C.exportKey( 'jwk', user.encrypt_pair.publicKey );
        var vp = C.exportKey( 'jwk', user.signing_pair.publicKey );
        return P.all( to_encrypt.map( encrypt ).concat( [ dp, ep, vp ] ) );
    } ).then( function( [ s, t, i, d, e, v ] ) {
        log( '[init cloud] Exported public keys and encrypted private keys' );
        function upload( [ p, c, t ] ) { return uploadFile( user.cloud_text, p, c, t ) };
        user.salt = getRandomBytes( 16 );
        var fs = [ [ 'key_encrypt', JSON.stringify( e ), 'text/plain' ],
                   [ 'key_verify',  JSON.stringify( v ), 'text/plain' ],
                   [ 'key_decrypt', d ],
                   [ 'key_sign', s ],
                   [ 'salt', user.salt ],
                   [ [ 'Teams', 'manifest' ], t ],
                   [ [ 'Invites', 'manifest' ], i ],
                   [ 'salt', user.salt ] ]
        return P.all( fs.map( upload ) );
    } );
}

function submitRegistrationInfo( user )
{
    var vp = C.exportKey( 'jwk', user.signing_pair.publicKey );
    var lp = encrypt_aes_cbc( user.login_salt.slice( 0, 16 ), user.login_key, user.cloud_bits );
    return P.all( [ vp, lp ] )
    .then( function( [ v, l ] ) {
        log( '[Register] Encrypted link', user.cloud_bits, user.cloud_bits.length );
        var registration_info = {
            link   : bufToHex( l ),
            pub_key: v,
            salt   : bufToHex( user.login_salt ),
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
            return P.resolve( '' );
        /* 'else' */
        return new Promise( function( resolve, reject )
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
        log( '[Login] Logged in' );
        user.name = name;
        return P.resolve( user );
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
        user.login_salt = hexToBuf( registration_info.salt );
        enc_link = hexToBuf( registration_info.encrypted_link );
        return makeLoginKey( uid, pass, user.login_salt );
    } ).then( function( k ) {
        user.login_key = k;
        log( '[Login] Made login key' );
        return decrypt_aes_cbc( user.login_salt.slice( 0, 16 ), user.login_key, enc_link );
    } ).then( function( l ) {
        user.cloud_bits = l;
        user.cloud_text = bufToHex( user.cloud_bits );
        log( '[Login] Decrypted link', user.cloud_text, user.cloud_bits );
        return P.resolve( '' );
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

    /* XXX download invite information */
    user.invites = {};
    /* XXX */

    return P.all( [ ep, vp, dp ] )
    .then( function( [ e, v, d ] ) {
        log( '[Login] Downloaded public keys and decryption key' );
        var ep = importKeyEncrypt( e );
        var vp = importKeyVerify( v );
        return p_all_resolve( [ ep, vp ], [ d ] );
    } ).then( function( [ e, v, d ] ) {
        log( '[Login] Imported public keys' );
        user.encrypt_pair.publicKey = e;
        user.signing_pair.publicKey = v;
        return verify_and_decrypt_ac_ed( user.login_key, user.signing_pair.publicKey,
                                         new Uint8Array( 16 ), d );
    } ).then( function( d ) {
        log( '[Login] Decrypted decryption key', d );
        return importKeyDecrypt( decode( d ) );
    } ).then( function( d ) {
        log( '[Login] Imported decryption key', d );
        user.encrypt_pair.privateKey = d;
        var kp = C.deriveKey(
            { name: 'ECDH', namedCurve: 'P-521', public: user.encrypt_pair.publicKey },
            user.encrypt_pair.privateKey,
            sym_enc_algo, true, [ 'encrypt', 'decrypt' ] );
        var sp = download( 'key_sign' );
        var salt = download( 'salt' );
        var tp = download( [ 'Teams', 'manifest' ] );
        var ip = download( [ 'Invites', 'manifest' ] );
        return P.all( [ kp, sp, salt, tp, ip ] );
    } ).then( function( [ k, s, salt, manifest, i ] ) {
        log( '[Login] Downloaded signing key and derived main key' );
        user.main_key = k
        user.salt = salt;
        function decrypt( d )
        { return verify_and_decrypt_ac_ed( user.main_key, user.signing_pair.publicKey,
                                           new Uint8Array( 16 ), d ); }
        return P.all( [ s, manifest, i ].map( decrypt ) );
    } ).then( function( [ s, manifest, invites ] ) {
        log( '[Login] Decrypted signing key', decode( manifest ), i );
        var manifest = JSON.parse( decode( manifest ) );
        log( '[Login] Team manifest', manifest );
        user.teams = {};
        for( var i in manifest )
        {
            user.teams[ manifest[ i ] ] = {};
        }
        user.invites = JSON.parse( decode( invites ) );
        return importKeySign( decode( s ) );
    } ).then( function( s ) {
        log( '[Login] Imported signing key', user.teams );
        user.signing_pair.privateKey = s;
        return P.all( Object.keys( user.teams ).map( loginReadTeam( user ) ) );
    } ).then( function( _ ) {
        log( '[Login] Read teams', user.teams );
        for( var k in user.teams )
        {
            log( 'Team', k, user.teams[k] );
        }
        return P.resolve();
    } );
}

function loginReadTeam( user )
{
return function( team_id )
{
    var download = null
    var bad_salt = new Uint8Array( 16 );
    var team = {};
    return C.digest(
        'SHA-256', typedArrayConcat( encode( team_id ), user.salt ) )
    .then( function( team_dir ) {
        team.team_dir = team_dir;
        download = function( [ p, t ] )
        {
            if( !Array.isArray( p ) )
                p = [ p ];
            p.unshift( bufToHex( team_dir ) );
            p.unshift( 'Teams' );
            return downloadFile( user.cloud_text, p, t );
        }
        return download( [ 'key_team' ] );
    } ).then( function( team_key ) {
        return verify_and_decrypt_ac_ed(
            user.main_key, user.signing_pair.publicKey, bad_salt, team_key );
    } ).then( function( team_key ) {
        return importKeySym( decode( team_key ) );
    } ).then( function( team_key ) {
        log( '[LoginTeam] Team main key imported' );
        team.main_key = team_key;
        var files = [ [ 'key_encrypt', true ],
                      [ 'key_verify', true ],
                      [ 'key_decrypt' ],
                      [ 'key_sign' ],
                      [ 'self_id' ],
                      [ [ 'Data', 'data' ] ],
                      [ [ 'Teammates', 'manifest' ] ],
                      [ [ 'Teammates', 'salt' ], true ] ];
        return P.all( files.map( download ) );
    } ).then( function( [ e, v, d, s, user_team_id, data, teammates_manifest, salt ] ) {
        log( '[LoginTeam]',team_id,'Downloaded files', new Uint8Array( teammates_manifest ) );
        team.salt = hexToBuf( salt );
        var ep = importKeyEncrypt( e );
        var vp = importKeyVerify( v );
        var to_decrypt = [ [ team.main_key, d ],
                           [ team.main_key, s ],
                           [ user.main_key, user_team_id ],
                           [ team.main_key, data ],
                           [ user.main_key, teammates_manifest ] ];
        function decrypt( [ k, x ] )
        { return verify_and_decrypt_ac_ed(
            k, user.signing_pair.publicKey, bad_salt, x ); }
        return P.all( [ ep, vp ].concat( to_decrypt.map( decrypt ) ) );
    } ).then( function( [ e, v, d, s, user_team_id, data, teammates_manifest ] ) {
        log( '[LoginTeam]',team_id,'Imported and decrypted', new Uint8Array( teammates_manifest ) );
        team.key_encrypt = e;
        team.key_verify = v;
        team.self_id = decode( user_team_id );
        team.data = JSON.parse( decode( data ) );
        team.name = team.data.name;
        team.teammates_manifest = JSON.parse( decode( teammates_manifest ) );
        var dp = importKeyDecrypt( decode( d ) );
        var sp = importKeySign( decode( s ) );
        return P.all( [ dp, sp ] );
    } ).then( function( [ d, s ] ) {
        log( '[LoginTeam]',team_id,'Imported' );
        team.key_decrypt = d;
        team.key_sign = s;
        user.teams[ team_id ] = team;
        return P.resolve();
    } )
}
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
    var team = { name: team_name };
    var upload = uploadFileTo( user.cloud_text );
    var team_id = makeUniqueId( user.teams );

    log( '[TeamCreate] Starting', team_name, team_id );
    var ep = C.generateKey(  pub_enc_algo, true, [ 'deriveKey', 'deriveBits' ] )
    var sp = C.generateKey( signing_kalgo, true, [ 'sign', 'verify' ] );
    var mp = C.generateKey(  sym_enc_algo, true, [ 'encrypt', 'decrypt' ] );
    return P.all( [ ep, sp, mp ] )
    .then( function( [ enc_keypair, sign_keypair, main_key ] ) {
        log( '[TeamCreate] Generated keys' );
        team.signing_pair = sign_keypair;
        team.encrypt_pair = enc_keypair;
        team.main_key = main_key;
        var keys = [ team.encrypt_pair.privateKey, team.encrypt_pair.publicKey,
                     team.signing_pair.privateKey, team.signing_pair.publicKey,
                     main_key, user.signing_pair.publicKey ];
        return P.all(
            keys.map( function( k ) { return C.exportKey( 'jwk', k ) } ) );
    } ).then( function( [ d, e, s, v, main, pub ] ) {
        log( '[TeamCreate] exported keys' );
        var bad_salt = new Uint8Array( 16 );
        var teammates = {};
        team.self_id = makeUniqueId( teammates );
        team.salt = getRandomBytes( 16 );
        teammates[ team.self_id ] = { name: user.name, cloud: user.cloud_text, key: pub };
        var data = { name: team_name, teammates: teammates };
        /* This loop could be a performance bug, but team creation
         * should be infrequent, so not a big deal */
        var manifest = [];
        for( var old_id in user.teams )
            manifest.push( old_id );
        manifest.push( team_id );
        log( "MADE MANIFEST", manifest );
        team.encrypt_pair.publicKeyExported = e;
        team.signing_pair.publicKeyExported = v;

        function encrypt( [ k, d, s ] )
        { return encrypt_and_sign_ac_ed( k, user.signing_pair.privateKey, s, d ); }
        var to_encrypt =
            [ [ team.main_key, encode( JSON.stringify( d ) ), bad_salt ],
              [ team.main_key, encode( JSON.stringify( s ) ), bad_salt ],
              [ team.main_key, encode( JSON.stringify( data ) ), bad_salt ],
              [ user.main_key, encode( JSON.stringify( manifest ) ), bad_salt ],
              [ user.main_key, encode( JSON.stringify( main ) ), bad_salt ],
              [ user.main_key, encode( team.self_id ), bad_salt ],
              [ user.main_key, encode( JSON.stringify( { test: 'blah'} ) ), bad_salt ] ];
        var promises = to_encrypt.map( encrypt );
        var team_dir = C.digest(
            'SHA-256', typedArrayConcat( encode( team_id ), user.salt ) );
        promises.push( team_dir );
        return P.all( promises );
    } ).then( function( [ d, s, data, manifest, main, self_id, teammates_manifest, team_dir ] ) {
        log( '[TeamCreate] Encrypted keys' );
        function upload( [ p, c, t ] )
        {
            if( !Array.isArray( p ) )
                p = [ p ];
            p.unshift( bufToHex( team_dir ) );
            p.unshift( 'Teams' );
            return uploadFile( user.cloud_text, p, c, t );
        }
        var files = [
            [ 'key_encrypt', JSON.stringify( team.encrypt_pair.publicKeyExported ),
              'application/json' ],
            [ 'key_verify',  JSON.stringify( team.signing_pair.publicKeyExported ),
              'application/json' ],
            [ 'key_decrypt', d ],
            [ 'key_sign',    s ],
            [ 'key_team',    main ],
            [ 'self_id',     self_id ],
            [ [ 'Teammates', 'manifest' ], teammates_manifest ],
            [ [ 'Teammates', 'salt' ], bufToHex( team.salt ), 'text/plain' ],
            [ [ 'Data', 'data' ], data ],
        ];
        var promises = files.map( upload );
        promises.push( uploadFile( user.cloud_text, [ 'Teams', 'manifest' ], manifest ) );
        return P.all( promises );
    } ).then( function( [ e, v, d, s, t, c ] ) {
        log( '[TeamCreate] Team created' );
        user.teams[ team_id ] = team;
        return P.resolve( team_id );
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

function makeInvite( invite_user, team_id, user )
{
    var invite_id   = makeUniqueId( user.invites );
    var invite_salt = getRandomBytes( 16 );
    var step1       = JSON.stringify( { id: invite_user, team: team_id } );
    var ip = encrypt_and_sign_ac_ed(
        user.main_key, user.signing_pair.privateKey, invite_salt, encode( step1 ) );
    var sp = encrypt_and_sign_ac_ed(
        user.main_key, user.signing_pair.privateKey, new Uint8Array( 16 ), invite_salt );
    return P.all( [ ip, sp ] )
    .then( function( [ step1, salt ] ) {
        log( '[Invite] Encrypted and signed' );
        function uploadHelper( [ d, n, t ] )
        { return uploadFile( user.cloud_text, [ 'Invites', invite_id, n ], d, t ); }

        f = [ [ step1, 'step1' ], [ salt, 'salt' ], [ '', 'step3', 'text/plain' ] ];
        return P.all( f.map( uploadHelper ) );
    } ).then( function( _ ) {
        log( '[Invite] Uploaded' );
        return P.resolve( JSON.stringify( { c:user.cloud_text, i:invite_id } ) );
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
        return importKeyEncrypt( k );
    } ).then( function( k ) {
        log( '[InviteAccept] Imported key' );
        return C.deriveKey(
            { name: 'ECDH', namedCurve: 'P-521', public: k },
            user.encrypt_pair.privateKey,
            sym_enc_algo, true, [ 'encrypt', 'decrypt' ] );
    } ).then( function( k ) {
        log( '[InviteAccept] Derived key!' );
        var step2 = encode( JSON.stringify( { l: user.cloud_text, t: team_id, i:invite.i } ) );
        var ip = encrypt_and_sign_ac_ed(
            k, user.signing_pair.privateKey, invite_salt, step2 );
        var sp = encrypt_and_sign_ac_ed(
            k, user.signing_pair.privateKey, new Uint8Array( 16 ), invite_salt );
        debug_k = k;
        return P.all( [ ip, sp ] )
    } ).then( function( [ step2, s ] ) {
        log( '[InviteAccept] Encrypted and signed', s, debug_k, user.signing_pair.publicKey );
        function uploadHelper( [ d, n, t ] )
        { return uploadFile( user.cloud_text, [ 'Invites', invite_id, n ], d, t ); }

        f = [ [ step2, 'step2' ], [ s, 'salt' ] ];
        return P.all( f.map( uploadHelper ) );
    } ).then( function( _ ) {
        log( '[InviteAccept] Uploaded' );
        return P.resolve( JSON.stringify( { c:user.cloud_text, i:invite_id } ) );
    } ).catch( function( err ) {
        return unhandledError( 'invite accept', err )
    } );
}

function inviteAddToTeam( invite_input, user )
{
    /* assert( invite_input is valid ) */
    /* assert( user is valid ) */
    var invite = JSON.parse( invite_input );
    function upload( [ p, c, t ] ) { return uploadFile( user.cloud_text, p, c, t ) };
    function downloadA( [ p, t ] ) { return downloadFile( user.cloud_text, p, t ) };
    function downloadB( [ p, t ] ) { return downloadFile( invite.c, p, t ) };
    var files = [ [ 'key_encrypt', true ],
                  [ 'key_verify', true ],
                  [ [ 'Invites', invite.i, 'step2' ] ],
                  [ [ 'Invites', invite.i, 'salt' ] ] ];
    return P.all( files.map( downloadB ) )
    .then( function( [ encrypt_B, verify_B, step2, salt_B ] ) {
        log( '[InviteAdd] Downloaded B' );
        return p_all_resolve(
            [ importKeyEncrypt( encrypt_B ), importKeyVerify( verify_B ) ],
            [ step2, salt_B ] );
    } ).then( function( [ encrypt_B, verify_B, step2, salt_B ] ) {
        log( '[InviteAdd] Imported keys' );
        var ep = C.deriveKey(
            { name: 'ECDH', namedCurve: 'P-521', public: encrypt_B },
            user.encrypt_pair.privateKey,
            sym_enc_algo, true, [ 'encrypt', 'decrypt' ] );
        return p_all_resolve( [ ep ], [ verify_B, step2, salt_B ] );
    } ).then( function( [ sym_AB, verify_B, step2, salt_B ] ) {
        log( '[InviteAdd] Derived' );
        var sp = verify_and_decrypt_ac_ed( sym_AB, verify_B, new Uint8Array( 16 ), salt_B );
        return p_all_resolve( [ sp ], [ sym_AB, verify_B, step2 ] );
    } ).then( function( [ salt_B, sym_AB, verify_B, step2 ] ) {
        log( '[InviteAdd] Decrypted salt' );
        var ip = verify_and_decrypt_ac_ed( sym_AB, verify_B, salt_B, step2 );
        return p_all_resolve( [ ip ], [ sym_AB, verify_B ] );
    } ).then( function( [ step2, sym_AB, verify_B ] ) {
        log( '[InviteAdd] Decrypted step2', decode( step2 ) );
        step2 = JSON.parse( decode( step2 ) );
        var sp = downloadA( [ [ 'Invites', step2.i, 'salt' ] ] );
        var ip = downloadA( [ [ 'Invites', step2.i, 'step1' ] ] );
        return p_all_resolve( [ ip, sp ], [ step2, sym_AB, verify_B ] );
    } ).then( function( [ step1, salt_A, step2, sym_AB, verify_B ] ) {
        log( '[InviteAdd] Downloaded A' );
        var sp = verify_and_decrypt_ac_ed(
            user.main_key, user.signing_pair.publicKey, new Uint8Array( 16 ), salt_A );
        return p_all_resolve( [ sp ], [ step1, step2, sym_AB, verify_B ] );
    } ).then( function( [ salt_A, step1, step2, sym_AB, verify_B ] ) {
        log( '[InviteAdd] Decrypted salt' );
        var ip = verify_and_decrypt_ac_ed(
            user.main_key, user.signing_pair.publicKey, salt_A, step1 );
        return p_all_resolve( [ ip ], [ step2, sym_AB, verify_B ] );
    } ).then( function( [ step1, step2, sym_AB, verify_B ] ) {
        step1 = JSON.parse( decode( step1 ) );
        log( '[InviteAdd] Decrypted step1', user, step1 );
        if( !( step1.team in user.teams ) )
        {
            log( 'blah', user.teams );
            return P.reject( 'XXX error' );
        }
        var team = user.teams[ step1.team ];
        log( 'DEBUG' );
        var user_id = makeUniqueId( team.data.teammates );
        var step3 = JSON.stringify( { t: step1.team, u: user_id } );
        var step3p = encrypt_and_sign_ac_ed(
            k, user.signing_pair.privateKey, new Uint8Array( 16 ), invite_salt );

        team.data.teammates[ user_id ] =
            { name: step1.id, cloud: invite.c, key: verify_B };
        var data = { name: team_name, teammates: teammates };

        
        console.log( 'really', decode( step1 ) );
        console.log( 'yes', step2 );
    } ).catch( function( err ) {
        return unhandledError( 'invite complete', err );
    } );
}

//            return C.verify( signing_salgo, user.signing_pair.publicKey, s, m )
