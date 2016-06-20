/*
 *
 */

/**
 * User objects have the following fields
 *
 * uid
 *
 * key_login is derived from username, password and salt.  It should
 * _only_ be used to en/decrypt the cloud link received from the central
 * server and the user's private encryption key.
 *
 * encrypt_pair is the primary public/private key pair for
 * en/decryption for the user.
 *
 * signing_pair is the primary public/private key pair for
 * signing/verification for the user.
 *
 * key_main is a symmetric key that is the workhorse for
 * en/decrypting personal information
 *
 * cloud is the information needed to access the user's cloud
 * storage
 *
 * teams
 *
 * invites
 */


function login( uid, passwd, scp )
{
    var [ scp, log ] = Scope.enter( scp, 'Login' );
    var user = { uid: uid };
    return getRegistrationInfo( uid, passwd, user, scp )
    .then( function( _ ) {
        return loginCloud( user, scp );
    } ).then( function( _ ) {
        log( 'Logged in' );
        return P.resolve( user );
    } );
}

function getRegistrationInfo( uid, passwd, user, scp )
{
    var [ scp, log ] = Scope.enter( scp, 'GetReg' );
    return C.digest( 'SHA-256', encode( uid ) )
    .then( function( hashedUID ) {
        log( 'Hashed UID', bufToHex( hashedUID ) );
        return fetch( '/Users/'+bufToHex( hashedUID ) );
    } ).then( function( resp ) {
        log( 'Fetched reg info', resp.status, resp.statusText );
        if( resp.ok )
            return resp.json();
        /* else */
        return P.reject( new NotFoundError() );
    } ).then( function( registration_info ) {
        log( 'Decoded reg info', registration_info );
        user.login_salt = hexToBuf( registration_info.salt, scp );
        return p_all_resolve( [ makeLoginKey( uid, passwd, user.login_salt ) ],
                              [ hexToBuf( registration_info.encrypted_link, scp ) ] );
    } ).then( function( [ key_login, enc_link ] ) {
        log( 'Made login key' );
        user.key_login = key_login;
        /* TODO: Verify after getting the key */
        return aes_cbc_ecdsa.decrypt_skip_verify_salted( user.key_login, enc_link, scp );
    } ).then( function( l ) {
        user.cloud_bits = l;
        user.cloud_text = bufToHex( user.cloud_bits );
        log( 'Decrypted cloud link', user.cloud_text, user.cloud_bits );
        return P.resolve();
    } ).catch( function( err ) {
        if( err instanceof CryptoError )
        {
            return P.reject( new AuthenticationError() );
        }
        else return P.reject( err );
    } );
}

function loginCloud( user, scp )
{
    /* TODO: download invite information */
    var [ scp, log ] = Scope.enter( scp, 'Cloud' );
    function download( [ path, text ] )
    { return downloadFile( user.cloud_text, path, text, scp ); }

    user.invites = {};
    /* XXX */

    return P.all( [ [ 'key_encrypt', true ], [ 'key_verify', true ], [ 'key_decrypt' ] ]
                  .map( download ) )
    .then( function( keys ) {
        log( 'Downloaded public keys and decryption key' );
        user.key_encrypt_exported = keys[ 0 ];
        user.key_verify_exported = keys[ 1 ];
        return p_all_resolve( [ importKeyEncrypt( user.key_encrypt_exported ),
                                importKeyVerify( user.key_verify_exported ) ],
                              [ keys[ 2 ] ] );
    } ).then( function( keys ) {
        log( 'Imported public keys' );
        user.key_encrypt = keys[ 0 ];
        user.key_verify  = keys[ 1 ];
        return aes_cbc_ecdsa.verify_then_decrypt_salted(
            user.key_login, user.key_verify, keys[ 2 ] );
    } ).then( function( d ) {
        log( 'Decrypted decryption key' );
        user.key_decrypt_exported = decode( d );
        return importKeyDecrypt( user.key_decrypt_exported );
    } ).then( function( d ) {
        log( 'Imported decryption key', d );
        user.key_decrypt = d;
        var kp = ecdh_aesDeriveKey( user.key_encrypt, user.key_decrypt );
        var files = [ [ 'key_sign' ],
                      [ [ 'Teams', 'manifest' ] ],
                      [ [ 'Invites', 'manifest' ] ] ];
        return P.all( files.map( download ).concat( [ kp ] ) );
    } ).then( function( files ) {
        log( 'Downloaded key, manifests; derived key', files[ 3 ], user.key_verify );
        log( 'BLAH', files.slice( 0, 3 ).map( ( d ) => { return new Uint8Array( d ); } ) );
        user.key_main = files[ 3 ];
        function decrypt( d )
        { return aes_cbc_ecdsa.verify_then_decrypt_salted( user.key_main, user.key_verify, d ); }
        return P.all( files.slice( 0, 3 ).map( decrypt ) );
    } ).then( function( files ) {
        log( 'Decrypted key, manifests' );
        var teams_manifest = JSON.parse( decode( files[ 1 ] ) );
        log( 'Team manifest', teams_manifest );
        user.teams = {};
        for( var dir in teams_manifest )
        {
            user.teams[ dir ] = { self_id: teams_manifest[ dir ], dir: dir };
        }
        user.invites = JSON.parse( decode( files[ 2 ] ) );
        user.key_signing_exported = decode( files[ 0 ] );
        return importKeySign( user.key_signing_exported );
    } ).then( function( s ) {
        log( 'Imported signing key', user.teams );
        user.key_signing = s;
        return P.all( Object.keys( user.teams ).map( loginReadTeam( user, scp ) ) );
    } ).then( function( _ ) {
        log( 'Read teams', user.teams );
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
 *    |-- XYZ/
 *    |   |-- pub/priv key-pairs (not currently used)
 *    |   |-- Data/
 *    |   |   |-- ... TBD ... (encrypted w team key)
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

function loginReadTeam( user, scp )
{
var [ scp, log ] = Scope.enter( scp, 'Team' );
return function( team_dir )
{
    // scp = Scope.enter( scp, team_dir );
    var [ scp, log ] = Scope.enter( scp, team_dir );
    var download = downloadFromTeam( user.cloud_text, team_dir );
    var team = user.teams[ team_dir ];
    return download( [ 'key_decrypt' ] )
    .then( function( k ) {
        log( 'Decrypt key downloaded' );
        return P.all( [
            aes_cbc_ecdsa.verify_then_decrypt_salted( user.key_main, user.key_verify, k ),
            download( [ 'key_encrypt', true ] ) ] );
    } ).then( function( keys ) {
        log( 'Main and decrypt keys decrypted; encrypt key downloaded', keys );
        team.key_decrypt_exported = decode( keys[0] );
        team.key_encrypt_exported = keys[1];
        return P.all( [ importKeyDecrypt( team.key_decrypt_exported ),
                        importKeyEncrypt( team.key_encrypt_exported ) ] );
    } ).then( function( keys ) {
        log( 'Main, decrypt and encrypt keys imported' );
        team.key_decrypt = keys[0];
        team.key_encrypt = keys[1];
        return ecdh_aesDeriveKey( team.key_encrypt, team.key_decrypt );
    } ).then( function( k ) {
        // scp = Scope.cont( scp, 'Shared key derived' );
        log( team_dir, 'Shared key derived' );
        team.key_main = k;
        var files = [ [ 'key_verify', true ],
                      [ 'key_sign' ],
                      [ 'self_id' ],
                      [ [ 'Data', 'data' ] ] ];
        return P.all( files.map( download ) );
    } ).then( function( files ) {
        log( 'Bunch of files downloaded' );
        team.key_verify_exported = files[ 0 ];
        var to_decrypt = [ [ user.key_main, files[ 1 ] ],
                           [ user.key_main, files[ 2 ] ],
                           [ team.key_main, files[ 3 ] ] ];
        function decrypt( [ k, d ] )
        { return aes_cbc_ecdsa.verify_then_decrypt_salted( k, user.key_verify, d ); }
        return P.all( [ importKeyVerify( files[ 0 ] ) ].concat( to_decrypt.map( decrypt ) ) );
    } ).then( function( files ) {
        log( 'Bunch of files decrypted', JSON.parse( decode( files[ 3 ] ) ) );
        team.key_verify = files[ 0 ];
        team.self_id = decode( files[ 2 ] );
        team.db = JSON.parse( decode( files[ 3 ] ) );
        var datoms = DB.query( team.db, 'team:name' );
        // assert( datoms.length == 1 )
        team.name = datoms[ 0 ].v;
        function stripPrefix( prefix, s ) { return s.substring( prefix.length ); }
        datoms = DB.query( team.db, 'teammate:' );
        // assert( datoms.length > 0 )
        var ids = {}
        team.teammates = {};
        datoms.filter( ( d ) => { return d.a == 'teammate:id'; } )
            .forEach( ( d ) => { ids[ d.e ] = d.v; team.teammates[ d.v ] = {} } );
        datoms.filter( ( d ) => { return d.a != 'teammate:id'; } )
            .forEach( ( d ) => { return team.teammates[ ids[ d.e ] ]
                                 [ stripPrefix( 'teammate:', d.a ) ] = d.v } );
        team.key_signing_exported = decode( files[ 1 ] );
        var vs = [];
        function importKey( dbid )
        {
            return importKeyVerify(
                team.teammates[ ids[ dbid ] ].key_verify_exported )
            .then( function( k ) {
                team.teammates[ ids[ dbid ] ].key_verify = k;
                return P.resolve();
            } );
        }
        for( dbid in ids )
        {
            vs.push( importKey( dbid ) );
        }
        return P.all( [ importKeySign( team.key_signing_exported ) ].concat( vs ) );
    } ).then( function( [ k ] ) {
        team.key_signing = k[ 0 ];
        log( 'Imported' );
        return P.resolve();
    } );
}
}

function initTeamState( team_name, user, scp )
{
    var [ scp, log ] = Scope.enter( scp, 'Init' );
    var team = {
        name:          team_name,
        dir:           makeUniqueId( user.teams ),
        self_id:       makeUniqueId( {} ),
        teammates:     {},
        db:            DB.new() };
    return P.resolve()
    .then( function() {
        log( 'Begin', user )
        var team_id = DB.new_entity( team.db );
        var datoms = [ DB.build_datom( team_id, 'team:name', team_name ) ];
        var teammate_ent = DB.new_entity( team.db );
        var teammate_datoms = [
            [ 'id', team.self_id ],
            [ 'cloud_text', user.cloud_text ],
            [ 'key_verify_exported', user.key_verify_exported ],
            [ 'dir', team.dir ] ];
        datoms = datoms.concat( teammate_datoms.map( function( [ a, v ] ) {
            return DB.build_datom( teammate_ent, 'teammate:'+a, v ); } ) );
        DB.apply_txn( team.db, DB.build_txn( [], datoms ) );
        user.teams[ team.dir ] = team;
        function generate( [ a, ops ] ) { return C.generateKey( a, true, ops ); }
        var keys =
            [ [  pub_enc_algo, [ 'deriveKey', 'deriveBits' ] ],
              [ signing_kalgo, [ 'sign', 'verify' ] ] ];
        return P.all( keys.map( generate ) );
    } ).then( function( keys ) {
        log( 'Generated keys', keys );
        return p_all_resolve( [ ecdh_aesDeriveKey( keys[0].publicKey, keys[0].privateKey ) ],
                              keys );
    } ).then( function( keys ) {
        log( 'Derived shared team key' );
        team.key_main    = keys[0];
        team.key_encrypt = keys[1].publicKey;
        team.key_decrypt = keys[1].privateKey;
        team.key_verify  = keys[2].publicKey;
        team.key_signing = keys[2].privateKey;
        var keys = [ team.key_main, team.key_encrypt, team.key_decrypt,
                     team.key_verify, team.key_signing ];
        return P.all( keys.map( exportKeyJwk ) );
    } ).then( function( keys ) {
        team.key_main_exported    = keys[0];
        team.key_encrypt_exported = keys[1];
        team.key_decrypt_exported = keys[2];
        team.key_verify_exported  = keys[3];
        team.key_signing_exported = keys[4];
        return P.resolve( team );
    } );
}

function uploadTeam( team, user, scp )
{
    var [ scp, log ] = Scope.enter( scp, 'Cloud' );
    return P.resolve()
    .then( function() {
        /* This loop is a scalability bug, but team creation should be
         * infrequent, so it's not urgent.  Could be made incremental at
         * non-trivial cost in code complexity. */
        var teams_manifest = {};
        for( var d in user.teams )
            teams_manifest[ d ] = team.self_id;

        function encrypt( [ k, d ] )
        { return aes_cbc_ecdsa.encrypt_then_sign_salted( k, user.key_signing, d ); }
        function encd_jstr(x) { return encode( JSON.stringify( x ) ) };
        var to_encrypt =
            [ [ team.key_main, encd_jstr( team.db ) ],
              [ user.key_main, encode( team.key_decrypt_exported ) ],
              [ user.key_main, encode( team.key_signing_exported ) ],
              [ user.key_main, encd_jstr( team.self_id ) ],
              [ user.key_main, encd_jstr( teams_manifest ) ] ];
        return P.all( to_encrypt.map( encrypt ) )
    } ).then( function( files ) {
        log( 'Encrypted files. Teams manifest:', new Uint8Array( files[ 4 ] ) );
        var teams_manifest = files[ 4 ];
        var files = [
            [ 'key_encrypt', team.key_encrypt_exported, 'application/json' ],
            [ 'key_verify',  team.key_verify_exported, 'application/json' ],
            [ 'key_decrypt', files[ 1 ] ],
            [ 'key_sign',    files[ 2 ] ],
            [ 'self_id',     files[ 3 ] ],
            [ [ 'Data', 'data' ], files[ 0 ] ],
        ];
        return P.all( files.map( uploadToTeam( user.cloud_text, team.dir ) ).concat(
            uploadFile( user.cloud_text, [ 'Teams', 'manifest' ], teams_manifest ) ) );
    } );
}

function createTeam( team_name, user, scp )
{
    var [ scp, log ] = Scope.enter( scp, 'CreateTeam' );
    var team;
    log( 'Starting', team_name );
    return initTeamState( team_name, user, scp )
    .then( function( t ) {
        team = t;
        log( 'Initialized team state' );
        return uploadTeam( team, user, scp );
    } ).then( function( [ e, v, d, s, t, c ] ) {
        log( 'Created' );
        return P.resolve( team.dir );
    } );
}
