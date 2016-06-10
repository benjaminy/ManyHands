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
        return makeLoginKeys( uid, passwd, user.login_salt );
    } ).then( function( [ login_sym, login_verify, login_sign ] ) {
        user.login_sym    = login_sym;
        user.login_verify = login_verify;
        user.login_sign   = login_sign;
        log( '[Login] Made login key' );
        return aes_cbc_ecdsa.verify_then_decrypt_salted(
            user.login_sym, user.login_verify, enc_link );
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
        user.encrypt_key = e;
        user.verify_key  = v;
        return verify_and_decrypt_ac_ed(
            user.login_key, user.verify_key, d, zeros );
    } ).then( function( d ) {
        log( '[Login] Decrypted decryption key', d );
        return importKeyDecrypt( decode( d ) );
    } ).then( function( d ) {
        log( '[Login] Imported decryption key', d );
        user.decrypt_key = d;
        var kp = C.deriveKey(
            { name: 'ECDH', namedCurve: 'P-521', public: user.encrypt_key },
            user.decrypt_key,
            sym_enc_algo, true, [ 'encrypt', 'decrypt' ] );
        var sp = download( 'key_sign' );
        var salt = download( 'salt' );
        var tp = download( [ 'Teams', 'manifest' ] );
        var ip = download( [ 'Invites', 'manifest' ] );
        return P.all( [ kp, sp, salt, tp, ip ] );
    } ).then( function( [ k, s, salt, teams_manifest, invites_manifest ] ) {
        log( '[Login] Downloaded signing key and derived main key', new Uint8Array( teams_manifest ) );
        user.main_key = k
        user.salt = salt;
        function decrypt( d )
        { return verify_and_decrypt_ac_ed(
            user.main_key, user.verify_key, d, zeros ); }
        return P.all( [ s, teams_manifest, invites_manifest ].map( decrypt ) );
    } ).then( function( [ s, teams_manifest, invites_manifest ] ) {
        log( '[Login] Decrypted signing key', decode( teams_manifest ) );
        var teams_manifest = JSON.parse( decode( teams_manifest ) );
        log( '[Login] Team manifest', teams_manifest );
        user.teams = {};
        for( var dir in teams_manifest )
        {
            user.teams[ dir ] = { self_id: manifest[ dir ], dir: dir };
        }
        user.invites = JSON.parse( decode( invites_manifest ) );
        return importKeySign( decode( s ) );
    } ).then( function( s ) {
        log( '[Login] Imported signing key', user.teams );
        user.signing_key = s;
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

/*
 * Cloud:
 * -- Teams/
 *    |-- manifest (encrypted w user key)
 *    |-- salt     (IVs for encrypting various user files)
 *    |-- XYZ/
 *    |   |-- team_key           (encrypted w user key)
 *    |   |-- salt               (IV for encrypting team_key)
 *    |   |-- pub/priv key-pairs (not currently used)
 *    |   |-- Data/
 *    |   |   |-- ... TBD ... (encrypted w team key)
 *    |   |-- Teammates/
 *    |   |   |-- manifest (encrypted w user key)
 *    |   |   |-- ABC/
 *    |   |   |   |-- team_key   (encrypted w shared key)
 *    |   |   |   |-- salt       (IV for encrypting team_key)
 *    |   |   |-- DEF/
 *    |   |   |   |-- team_key   (encrypted w shared key)
 *    |   |   |   |-- salt       (IV for encrypting team_key)
 *
 * Notes:
 * - Team directory names (e.g. XYZ) are randomly chosen when a user
 *   creates or joins a team.  Teammates can (and generally do) have
 *   different directory names for the same team.  A user's own team
 *   directory names are stored in the team manifest.  Teammates'
 *   directory names are stored in the team DB (for remote fetching).
 * - Teammate directory names (e.g. ABC, DEF) are randomly chosen when
 *   a user is added to a team.  Each user's teammate directory can be
 *   (and generally is) different in each teammate's copy of the team.
 */

function uploadToTeam( cloud, team )
{
return function( [ p, c, t ] )
{
    if( !Array.isArray( p ) )
        p = [ p ];
    p.unshift( team );
    p.unshift( 'Teams' );
    return uploadFile( cloud, p, c, t );
}
}

function downloadFromTeam( cloud, team )
{
return function( [ p, t ] )
{
    if( !Array.isArray( p ) )
        p = [ p ];
    p.unshift( team );
    p.unshift( 'Teams' );
    return downloadFile( cloud, p, t );
}
}

function loginReadTeam( user )
{
return function( team_dir )
{
    var download = null
    var team = user[ team_dir ];
    return download( [ 'key_team' ] )
    .then( function( team_key ) {
        team.main_key_exported = team_key;
        return verify_and_decrypt_ac_ed(
            user.main_key, user.verify_key, team_key, zeros );
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
            k, user.verify_key, x, zeros ); }
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

function initTeamState( team_name, user )
{
    var team = {
        name:          team_name,
        salt:          getRandomBytes( 16 ), /* TODO: make it bigger */
        dir:           makeUniqueId( user.teams ),
        self_id:       makeUniqueId( {} ),
        teammates:     {},
        db:            db_new() };
    var team_id = db_new_entity( team.db );
    var datoms = [ db_build_datom( team_id, 'team:name', team_name ) ];
    var teammate_id = db_new_entity( team.db );
    teammate_ds = [ [ 'id',    team.self_id ],
                    [ 'cloud', user.cloud_text ],
                    [ 'dir',   team.dir ],
                    [ 'key',   user.verify_key_exported ] ];
    datoms = datoms.concat( teammate_ds.map( function( [ a, v ] ) {
        return db_build_datom( teammate_id, 'teammate:'+a, v ); } ) );
    db_apply_txn( team.db, db_build_txn( [], datoms ) );
    user.teams[ team.dir ] = team;
    function generate( [ a, ops ] ) { return C.generateKey( a, true, ops ); }
    var keys =
        [ [  pub_enc_algo, [ 'deriveKey', 'deriveBits' ] ],
          [ signing_kalgo, [ 'sign', 'verify' ] ],
          [  sym_enc_algo, [ 'encrypt', 'decrypt' ] ] ];
    return P.all( keys.map( generate ) )
    .then( function( key_pairs ) {
        log( '[TeamCreate] Generated keys' );
        team.encrypt_key = key_pairs[0].publicKey;
        team.decrypt_key = key_pairs[0].privateKey;
        team.verify_key  = key_pairs[1].publicKey;
        team.signing_key = key_pairs[1].privateKey;
        team.main_key    = key_pairs[2];
        function exportKey( k ) { return C.exportKey( 'jwk', k ) }
        var keys = [ team.encrypt_key, team.decrypt_key,
                     team.verify_key, team.signing_key, team.main_key ];
        return P.all( keys.map( exportKey ) );
    } ).then( function( keys ) {
        team.encrypt_key_exported = keys[0];
        team.decrypt_key_exported = keys[1];
        team.verify_key_exported  = keys[2];
        team.signing_key_exported = keys[3];
        team.main_key_exported    = keys[4];
        return P.resolve( team );
    } );
}

function uploadTeam( team, user )
{
    /* This loop is a scalability bug, but team creation should be
     * infrequent, so it's not urgent.  Could be made incremental at
     * non-trivial cost in code complexity. */
    var tm = {};
    for( var d in user.teams )
        tm[ d ] = team.self_id;

    function encrypt( [ k, d, s ] )
    { return encrypt_and_sign_ac_ed( k, user.signing_key, d, s ); }
    function encd_jstr(x) { return encode( JSON.stringify( x ) ) };
    var to_encrypt =
        [ [ team.main_key, encd_jstr( team.db ), team.salt ],
          [ team.main_key, encd_jstr( team.decrypt_key_exported ), team.salt ],
          [ team.main_key, encd_jstr( team.signing_key_exported ), team.salt ],
          [ user.main_key, encd_jstr( team.main_key_exported ), team.salt ],
          [ user.main_key, encd_jstr( tm ), user.salt ],
          [ user.main_key, encode( '{}' ), team.salt ],
          [ user.main_key, team.salt, zeros ] ];
    return P.all( to_encrypt.map( encrypt ) )
    .then( function( [ db, kd, ks, km, teams_manifest, teammates_manifest, salt ] ) {
        log( '[TeamCreate] Encrypted files', new Uint8Array( teams_manifest ) );
        var files = [
            [ 'key_encrypt', JSON.stringify( team.encrypt_key_exported ), 'application/json' ],
            [ 'key_verify',  JSON.stringify( team.verify_key_exported ), 'application/json' ],
            [ 'key_decrypt', kd ],
            [ 'key_sign',    ks ],
            [ 'key_team',    km ],
            [ [ 'Teammates', 'manifest' ], teammates_manifest ],
            [ [ 'Teammates', 'salt' ], bufToHex( team.salt ), 'text/plain' ],
            [ [ 'Data', 'data' ], db ],
        ];
        var promises = files.map( uploadToTeam( user.cloud_text, team.dir ) );
        promises.push( uploadFile( user.cloud_text, [ 'Teams', 'manifest' ], teams_manifest ) );
        return P.all( promises );
    } );
}

function createTeam( team_name, user )
{
    var team;
    log( '[TeamCreate] Starting', team_name );
    return initTeamState( team_name, user )
    .then( function( t ) {
        team = t;
        log( '[TeamCreate] Initialized team state' );
        return uploadTeam( team , user )

    } ).then( function( [ e, v, d, s, t, c ] ) {
        log( '[TeamCreate] Team created' );
        return P.resolve( team.dir );
    } );
}


