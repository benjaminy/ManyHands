/*
 *
 */

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


function login( uid, passwd )
{
    var user = { uid: uid };
    return getRegistrationInfo( uid, passwd, user )
    .then( function( _ ) {
        return loginCloud( user );
    } ).then( function( _ ) {
        log( '[Login] Logged in' );
        return P.resolve( user );
    } );
}

function getRegistrationInfo( uid, passwd, user )
{
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
        return makeLoginKey( uid, passwd, user.login_salt );
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
    var team = {
        name: team_name,
        salt: getRandomBytes( 16 ),
        self_id: makeUniqueId( {} ) };
    var upload = uploadFileTo( user.cloud_text );
    var team_id = makeUniqueId( user.teams );

    log( '[TeamCreate] Starting', team_name, team_id );
    var key_gen_promises =
        [ C.generateKey(  pub_enc_algo, true, [ 'deriveKey', 'deriveBits' ] ),
          C.generateKey( signing_kalgo, true, [ 'sign', 'verify' ] ),
          C.generateKey(  sym_enc_algo, true, [ 'encrypt', 'decrypt' ] ) ]
    return P.all( key_gen_promises )
    .then( function( key_pairs ) {
        log( '[TeamCreate] Generated keys' );
        [ team.encrypt_pair, team.signing_pair, team.main_key ] = key_pairs;
        var keys = [ team.encrypt_pair.privateKey, team.encrypt_pair.publicKey,
                     team.signing_pair.privateKey, team.signing_pair.publicKey,
                     team.main_key, user.signing_pair.publicKey ];
        return P.all(
            keys.map( function( k ) { return C.exportKey( 'jwk', k ) } ) );
    } ).then( function( keys ) {
        log( '[TeamCreate] exported keys' );
        var bad_salt = new Uint8Array( 16 );
        var teammates = {}
        teammates[ team.self_id ] =
            { uid: user.uid, cloud: user.cloud_text, key: keys[5] };
        var team_db = { name: team_name, teammates: teammates };
        /* This loop could be a performance bug, but team creation
         * should be infrequent, so not urgent */
        var manifest = [];
        for( var old_id in user.teams )
            manifest.push( old_id );
        manifest.push( team_id );
        team.encrypt_pair.publicKeyExported = keys[1];
        team.signing_pair.publicKeyExported = keys[3];

        function encrypt( [ k, d, s ] )
        { return encrypt_and_sign_ac_ed( k, user.signing_pair.privateKey, d, s ); }
        var to_encrypt =
            [ [ team.main_key, encode( JSON.stringify( keys[0] ) ), bad_salt ],
              [ team.main_key, encode( JSON.stringify( keys[2] ) ), bad_salt ],
              [ team.main_key, encode( JSON.stringify( team_db ) ), bad_salt ],
              [ user.main_key, encode( JSON.stringify( manifest ) ), bad_salt ],
              [ user.main_key, encode( JSON.stringify( keys[4] ) ), bad_salt ],
              [ user.main_key, encode( team.self_id ), bad_salt ],
              [ user.main_key, encode( '{}' ), bad_salt ] ];
        var promises = to_encrypt.map( encrypt );
        var team_dir = C.digest(
            'SHA-256', typedArrayConcat( encode( team_id ), user.salt ) );
        promises.push( team_dir );
        return P.all( promises );
    } ).then( function( [ d, s, team_db, manifest, main, self_id, teammates_manifest, team_dir ] ) {
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
            [ [ 'Data', 'data' ], team_db ],
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


