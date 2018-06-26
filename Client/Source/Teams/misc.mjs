/*
 * Top Matter
 */

/*
 * File Comment
 */

import A        from "../Utilities/activities";

export const accountInit = A( function* accountInit(  ) {
    
} );


    var teams_manifest = JSON.parse( decode( decrypted[ 1 ] ) );
    user.teams = {};
    for( var dir in teams_manifest )
    {
        user.teams[ dir ] = { self_id: teams_manifest[ dir ], dir: dir };
    }
    user.invites = JSON.parse( decode( decrypted[ 2 ] ) );
    user.key_signing_exported = decode( decrypted[ 0 ] );
    user.key_signing = yield importKeySign( user.key_signing_exported );
    log( 'Imported signing key', user.teams );
    yield P.all( Object.keys( user.teams ).map( loginReadTeam( user, scp ) ) );
    log( 'Read teams', user.teams );
    for( var k in user.teams )
    {
        log( 'Team', k, user.teams[k] );
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
return async_local( scp, 'Team', function *( scp, log, team_dir )
{
    var download = downloadFromTeam( user.cloud_text, team_dir );
    var team = user.teams[ team_dir ];
    team.key_priv_dh_exported =
        decode(
            yield aes_cbc_ecdsa.verifyThenDecryptSalted(
                user.key_self, user.key_verify,
                yield download( [ 'key_priv_dh' ] ) ) ),
    team.key_pub_dh_exported = yield download( [ 'key_pub_dh', true ] );
    log( 'Main and decrypt keys decrypted; encrypt key downloaded' );
    team.key_priv_dh = yield importKeyPrivDH( team.key_priv_dh_exported );
    team.key_pub_dh  = yield importKeyPubDH(  team.key_pub_dh_exported );
    log( 'Main, decrypt and encrypt keys imported' );
    team.key_self = yield ecdh_aesDeriveKey( team.key_pub_dh, team.key_priv_dh );
    log( team_dir, 'Shared key derived' );
    var files_to_dl =
        [ [ 'key_verify', true ], [ 'key_sign' ], [ 'self_id' ], [ [ 'Data', 'data' ] ] ];
    [ team.key_verify_exported, ...files ] = yield P.all( files_to_dl.map( download ) );
    log( 'Bunch of files downloaded' );
    team.key_verify = yield importKeyVerify( team.key_verify_exported );
    var to_decrypt = [ [ user.key_self, files[ 0 ] ],
                       [ user.key_self, files[ 1 ] ],
                       [ team.key_self, files[ 2 ] ] ];
    function decrypt( [ k, d ] )
    { return aes_cbc_ecdsa.verifyThenDecryptSalted( k, user.key_verify, d ); }
    var decrypted = yield P.all( to_decrypt.map( decrypt ) );
    log( 'Bunch of files decrypted' );
    team.self_id = decode( decrypted[ 1 ] );
    team.db = JSON.parse( decode( decrypted[ 2 ] ) );
    var datoms = DB.query( team.db, 'team:name' );
    // assert( datoms.length == 1 )
    team.name = datoms[ 0 ].v;
    function stripPrefix( prefix, s ) { return s.substring( prefix.length ); }

    /* [ :find ?t
         :where [ _ :team/teammate ?t ]  ]  */
    datoms = DB.query( team.db, 'teammate:' );
    // assert( datoms.length > 0 )
    var ids = {}
    team.teammates = {};
    datoms.filter( ( d ) => { return d.a == 'teammate:id'; } )
         .forEach( ( d ) => { ids[ d.e ] = d.v; team.teammates[ d.v ] = {} } );
    datoms.filter( ( d ) => { return d.a != 'teammate:id'; } )
         .forEach( ( d ) => { team.teammates[ ids[ d.e ] ]
                              [ stripPrefix( 'teammate:', d.a ) ] = d.v } );
    team.key_signing_exported = decode( decrypted[ 0 ] );
    team.key_signing = decode( decrypted[ 0 ] );
    var vs = [];
    var importKey = async_local( scp, 'Import', function *( scp, log )
    {
        team.teammates[ ids[ dbid ] ].key_verify =
            yield importKeyVerify(
                team.teammates[ ids[ dbid ] ].key_verify_exported );
    } );
    for( dbid in ids )
    {
        vs.push( importKey( dbid ) );
    }
    yield P.all( vs );
    log( 'Imported' );
} );
}

var initTeamState = async( 'Init', function *( scp, log, user, team_name )
{
    /* assert( typeof( user ) == UWS user object ) */
    /* assert( typeof( team_name ) == string ) */
    log( 'Begin', user )
    var team = {
        name      : team_name,
        dir       : makeUniqueId( user.teams ),
        self_id   : makeUniqueId( {} ),
        teammates : {},
        db        : DB.new( team ) };
    var txn = [ DB.buildAddStmt( 'team', 'team:name', team_name ),
                DB.buildMapStmt( 'teammate', [
                    [ 'id'                 , team.self_id ],
                    [ 'cloud_text'         , user.cloud_text ],
                    [ 'key_verify_exported', user.key_verify_exported ],
                    [ 'dir'                , team.dir ] ] ) ];
    user.teams[ team.dir ] = team;
    var keys_dh   = yield C.generateKey( pub_enc_algo,  true, [ 'deriveKey', 'deriveBits' ] );
    var keys_sign = yield C.generateKey( signing_kalgo, true, [ 'sign', 'verify' ] );
    team.key_pub_dh  = keys_dh.publicKey;
    team.key_priv_dh = keys_dh.privateKey;
    team.key_verify  = keys_sign.publicKey;
    team.key_signing = keys_sign.privateKey;
    team.key_self = yield ecdh_aesDeriveKey( team.key_pub_dh, team.key_priv_dh );
    team.key_self_exported    = yield exportKeyJwk( team.key_self );
    team.key_pub_dh_exported  = yield exportKeyJwk( team.key_pub_dh );
    team.key_priv_dh_exported = yield exportKeyJwk( team.key_priv_dh );
    team.key_verify_exported  = yield exportKeyJwk( team.key_verify );
    team.key_signing_exported = yield exportKeyJwk( team.key_signing );
    team.txns = [ txn ];
    return team;
} );

var uploadTeam = async( 'Cloud', function *( scp, log, user, team )
{
    /* assert( typeof( user ) == UWS user object ) */
    /* assert( typeof( team ) == UWS team object ) */
    /* This loop is a scalability bug.  It should not be necessary to
     * recreate the manifest for all teams when uploading a single team.
     * But team creation should be infrequent, so it's not high priority.
     * Could be made incremental at non-trivial cost in code
     * complexity. */
    var teams_manifest = {};
    for( var dir in user.teams )
        teams_manifest[ dir ] = user.teams[ dir ].self_id;

    function encrypt( [ k, d ] )
    { return aes_cbc_ecdsa.encryptThenSignSalted( k, user.key_signing, d ); }
    function encd_jstr(x) { return encode( JSON.stringify( x ) ) };
    var to_encrypt =
        [ [ team.key_self, encd_jstr( team.db ) ],
          [ user.key_self, encode( team.key_priv_dh_exported ) ],
          [ user.key_self, encode( team.key_signing_exported ) ],
          [ user.key_self, encd_jstr( team.self_id ) ],
          [ user.key_self, encd_jstr( teams_manifest ) ] ];
    var files = yield P.all( to_encrypt.map( encrypt ) );
    log( 'Encrypted files. Teams manifest:', new Uint8Array( files[ 4 ] ) );
    var teams_manifest = files[ 4 ];
    var files = [
        [ 'key_pub_dh',  team.key_pub_dh_exported, 'application/json' ],
        [ 'key_verify',  team.key_verify_exported, 'application/json' ],
        [ 'key_priv_dh', files[ 1 ] ],
        [ 'key_sign',    files[ 2 ] ],
        [ 'self_id',     files[ 3 ] ],
        [ [ 'Data', 'data' ], files[ 0 ] ],
    ];
    return P.all( files.map( uploadToTeam( user.cloud_text, team.dir ) ).concat(
        uploadFile( scp, user.cloud_text, [ 'Teams', 'manifest' ], teams_manifest ) ) );
} );


var createTeam = async( 'CreateTeam', function *( scp, log, user, team_name )
{
    /* assert( typeof( user ) == UWS user object ) */
    /* assert( typeof( team_name ) == string ) */
    log( 'Start', team_name );
    var team = yield initTeamState( scp, user, team_name );
    log( 'Initialized team state' );
    var [ e, v, d, s, t, c ] = yield uploadTeam( scp, user, team );
    log( 'Finish' );
    return team.dir;
} );
