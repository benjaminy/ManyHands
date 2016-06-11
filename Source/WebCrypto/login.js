/*
 *
 */

/**
 * User objects have the following fields
 *
 * uid
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


function login( uid, passwd, log_ctx )
{
    if( log_ctx ) log_ctx = log_ctx.push( 'Login' );
    var user = { uid: uid };
    return getRegistrationInfo( uid, passwd, user, log_ctx )
    .then( function( _ ) {
        return loginCloud( user, log_ctx );
    } ).then( function( _ ) {
        log( log_ctx, 'Logged in' );
        return P.resolve( user );
    } );
}

function getRegistrationInfo( uid, passwd, user, log_ctx )
{
    if( log_ctx ) log_ctx = log_ctx.push( 'GetReg' );
    return C.digest( 'SHA-256', encode( uid ) )
    .then( function( hashedUID ) {
        log( 'uid', log_ctx, bufToHex( hashedUID ) );
        return fetch( '/Users/'+bufToHex( hashedUID ) );
    } ).then( function( resp ) {
        log( 'central server', log_ctx, resp.status, resp.statusText );
        if( resp.ok )
            return resp.json();
        /* else */
        return P.reject( new NotFoundError() );
    } ).then( function( registration_info ) {
        log( 'RegInfo', log_ctx, registration_info );
        user.login_salt = hexToBuf( registration_info.salt );
        return p_all_resolve( [ makeLoginKey( uid, passwd, user.login_salt  ) ],
                              [ hexToBuf( registration_info.encrypted_link ) ] );
    } ).then( function( [ login_key, enc_link ] ) {
        user.login_key = login_key;
        log( log_ctx, 'Made login key' );
        return aes_cbc_ecdsa.decrypt_skip_verify_salted( user.login_key, enc_link, log_ctx );
    } ).then( function( l ) {
        user.cloud_bits = l;
        user.cloud_text = bufToHex( user.cloud_bits );
        log( 'Decrypted link', log_ctx, user.cloud_text, user.cloud_bits );
        return P.resolve( '' );
    } ).catch( function( err ) {
        if( err instanceof CryptoError )
        {
            return P.reject( new AuthenticationError() );
        }
        else return P.reject( err );
    } );
}

function loginCloud( user, log_ctx )
{
    /* TODO: download invite information */
    if( log_ctx ) log_ctx = log_ctx.push( 'Cloud' );
    function download( [ path, text ] )
    { return downloadFile( user.cloud_text, path, text, log_ctx ); }

    user.invites = {};
    /* XXX */

    return P.all( [ [ 'key_encrypt', true ], [ 'key_verify', true ], [ 'key_decrypt' ] ]
                  .map( download ) )
    .then( function( [ e, v, d ] ) {
        log( log_ctx, 'Downloaded public keys and decryption key' );
        return p_all_resolve( [ importKeyEncrypt( e ), importKeyVerify( v ) ], [ d ] );
    } ).then( function( [ e, v, d ] ) {
        log( log_ctx, 'Imported public keys' );
        user.encrypt_key = e;
        user.verify_key  = v;
        return aes_cbc_ecdsa.verify_then_decrypt_salted( user.login_key, user.verify_key, d )
    } ).then( function( d ) {
        return importKeyDecrypt( decode( d ) );
    } ).then( function( d ) {
        log( log_ctx, 'Imported decryption key', d );
        user.decrypt_key = d;
        var kp = C.deriveKey(
            { name: 'ECDH', namedCurve: 'P-521', public: user.encrypt_key },
            user.decrypt_key,
            sym_enc_algo, true, [ 'encrypt', 'decrypt' ] );
        var files = [ [ 'key_sign' ],
                      [ [ 'Teams', 'manifest' ] ],
                      [ [ 'Invites', 'manifest' ] ] ];
        return P.all( files.map( download ).concat( [ kp ] ) );
    } ).then( function( [ sign, teams_manifest, invites_manifest, k ] ) {
        log( log_ctx, 'Downloaded key, manifests; derived key' );
        user.main_key = k
        function decrypt( d )
        { return aes_cbc_ecdsa.verify_then_decrypt_salted( user.main_key, user.verify_key, d ); }
        return P.all( [ sign, teams_manifest, invites_manifest ].map( decrypt ) );
    } ).then( function( [ sign, teams_manifest, invites_manifest ] ) {
        log( log_ctx, 'Decrypted key, manifests' );
        var teams_manifest = JSON.parse( decode( teams_manifest ) );
        log( log_ctx, 'Team manifest', teams_manifest );
        user.teams = {};
        for( var dir in teams_manifest )
        {
            user.teams[ dir ] = { self_id: teams_manifest[ dir ], dir: dir };
        }
        user.invites = JSON.parse( decode( invites_manifest ) );
        return importKeySign( decode( sign ) );
    } ).then( function( s ) {
        log( log_ctx, 'Imported signing key', user.teams );
        user.signing_key = s;
        return P.all( Object.keys( user.teams ).map( loginReadTeam( user, log_ctx ) ) );
    } ).then( function( _ ) {
        log( log_ctx, 'Read teams', user.teams );
        for( var k in user.teams )
        {
            log( 'Team', log_ctx, k, user.teams[k] );
        }
        return P.resolve();
    } );
}

/*
 * Cloud:
 * -- Teams/
 *    |-- manifest (encrypted w user key)
 *    |-- XYZ/
 *    |   |-- team_key           (encrypted w user key)
 *    |   |-- pub/priv key-pairs (not currently used)
 *    |   |-- Data/
 *    |   |   |-- ... TBD ... (encrypted w team key)
 *    |   |-- Teammates/
 *    |   |   |-- manifest (encrypted w user key)
 *    |   |   |-- ABC/
 *    |   |   |   |-- team_key   (encrypted w shared key)
 *    |   |   |-- DEF/
 *    |   |   |   |-- team_key   (encrypted w shared key)
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

function loginReadTeam( user, log_ctx )
{
if( log_ctx ) log_ctx = log_ctx.push( 'Team' );
return function( team_dir )
{
    var download = downloadFromTeam( user.cloud_text, team_dir );
    var team = user.teams[ team_dir ];
    return download( [ 'key_team' ] )
    .then( function( team_key ) {
        team.main_key_exported = team_key;
        return aes_cbc_ecdsa.verify_then_decrypt_salted(
            user.main_key, user.verify_key, team_key );
    } ).then( function( team_key ) {
        return importKeySym( decode( team_key ) );
    } ).then( function( team_key ) {
        log( log_ctx, team_dir, 'main key imported' );
        team.main_key = team_key;
        var files = [ [ 'key_encrypt', true ],
                      [ 'key_verify', true ],
                      [ 'key_decrypt' ],
                      [ 'key_sign' ],
                      [ 'self_id' ],
                      [ [ 'Data', 'data' ] ],
                      [ [ 'Teammates', 'manifest' ] ] ];
        return P.all( files.map( download ) );
    } ).then( function( [ e, v, d, s, user_team_id, data, teammates_manifest ] ) {
        log( log_ctx, team_dir, 'Downloaded files', new Uint8Array( teammates_manifest ) );
        var ep = importKeyEncrypt( e );
        var vp = importKeyVerify( v );
        var to_decrypt = [ [ team.main_key, d ],
                           [ team.main_key, s ],
                           [ user.main_key, user_team_id ],
                           [ team.main_key, data ],
                           [ user.main_key, teammates_manifest ] ];
        function decrypt( [ k, data ] )
        { return aes_cbc_ecdsa.verify_then_decrypt_salted( k, user.verify_key, data ); }
        return P.all( [ ep, vp ].concat( to_decrypt.map( decrypt ) ) );
    } ).then( function( [ e, v, d, s, user_team_id, data, teammates_manifest ] ) {
        log( log_ctx, team_dir, 'Imported and decrypted', new Uint8Array( teammates_manifest ) );
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
        log( log_ctx, team_dir,'Imported' );
        team.key_decrypt = d;
        team.key_sign = s;
        user.teams[ team_dir ] = team;
        return P.resolve();
    } )
}
}

function initTeamState( team_name, user, log_ctx )
{
    if( log_ctx ) log_ctx = log_ctx.push( 'Init' );
    var team = {
        name:          team_name,
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
        log( log_ctx, 'Generated keys' );
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

function uploadTeam( team, user, log_ctx )
{
    if( log_ctx ) log_ctx = log_ctx.push( 'Cloud' );
    /* This loop is a scalability bug, but team creation should be
     * infrequent, so it's not urgent.  Could be made incremental at
     * non-trivial cost in code complexity. */
    var tm = {};
    for( var d in user.teams )
        tm[ d ] = team.self_id;


    function encrypt( [ k, d ] )
    { return aes_cbc_ecdsa.encrypt_then_sign_salted( k, user.signing_key, d ); }
    function encd_jstr(x) { return encode( JSON.stringify( x ) ) };
    var to_encrypt =
        [ [ team.main_key, encd_jstr( team.db ) ],
          [ team.main_key, encd_jstr( team.decrypt_key_exported ) ],
          [ team.main_key, encd_jstr( team.signing_key_exported ) ],
          [ user.main_key, encd_jstr( team.main_key_exported ) ],
          [ user.main_key, encd_jstr( team.self_id ) ],
          [ user.main_key, encd_jstr( tm ) ],
          [ user.main_key, encode( '{}' ) ] ];
    return P.all( to_encrypt.map( encrypt ) )
    .then( function( [ db, kd, ks, km, self, teams_manifest, teammates_manifest ] ) {
        log( log_ctx, 'Encrypted files', new Uint8Array( teams_manifest ) );
        var files = [
            [ 'key_encrypt', JSON.stringify( team.encrypt_key_exported ), 'application/json' ],
            [ 'key_verify',  JSON.stringify( team.verify_key_exported ), 'application/json' ],
            [ 'key_decrypt', kd ],
            [ 'key_sign',    ks ],
            [ 'key_team',    km ],
            [ 'self_id',     self ],
            [ [ 'Teammates', 'manifest' ], teammates_manifest ],
            [ [ 'Data', 'data' ], db ],
        ];
        var promises = files.map( uploadToTeam( user.cloud_text, team.dir ) );
        promises.push( uploadFile( user.cloud_text, [ 'Teams', 'manifest' ], teams_manifest ) );
        return P.all( promises );
    } );
}

function createTeam( team_name, user, log_ctx )
{
    if( log_ctx ) log_ctx = log_ctx.push( 'CreateTeam' );
    var team;
    log( 'Starting', log_ctx, team_name );
    return initTeamState( team_name, user, log_ctx )
    .then( function( t ) {
        team = t;
        log( log_ctx, 'Initialized team state' );
        return uploadTeam( team, user, log_ctx );
    } ).then( function( [ e, v, d, s, t, c ] ) {
        log( 'Created', log_ctx );
        return P.resolve( team.dir );
    } );
}
