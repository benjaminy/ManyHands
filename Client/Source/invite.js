/*
 * Top Matter
 */

/*
 * See Documentation/invitation.md
 */

/* alice sets up an invite for bob to team_id */
let inviteStep1 = actFn( function *InviteStep1( actx, alice, bob, team_id )
{
    /* typeof( alice )   == UWS user object */
    /* typeof( bob )     == string (some identifying info about Bob) */
    /* typeof( team_id ) == UWS team ID */
    var id_step1 = makeUniqueId( alice.invites );
    var ek_a     = yield C.generateKey( dh_algo, true, [ 'deriveKey' ] );

    save_to_private_db( { bob, id_step1, ek_a } )

    alice.privateDB.add( { ":invite/invitee" : bob,
                           ":invite/id_step1" : id_step1 } )

    var step1_priv = yield aes_cbc_ecdsa.encryptThenSignSalted(
        alice.key_self, alice.key_signing,
        encode( JSON.stringify( { bob: bob, team: team_id } ) ), scp )
    actx.log( 'Encrypted step1_priv' );
    function upload( [ data, name, type ] )
    { return uploadFile( scp, alice.cloud_text,
                         [ 'Invites', step1_id, name ],
                         data,
                         type ); }
    files = [ [ step1_priv, 'step1' ],
              [ '', 'step3', 'text/plain' ] ];
    yield P.all( files.map( upload ) );
    actx.log( 'Uploaded step1_priv and dummy step3' );
    var step1_pub = JSON.stringify( { cloud: alice.cloud_text, id: step1_id } );
    return step1_pub;
} );

/* bob accepts the invitation */
var inviteStep2 = async( 'InviteStep2', function *( scp, log, bob, step1_pub )
{
    /* typeof( bob )       == UWS user object */
    /* typeof( step1_pub ) == string (serialized invitation) */
    var step1 = JSON.parse( step1_pub );
    var step2_id = makeUniqueId( bob.invites );
    var k = yield downloadFile( scp, step1.cloud, 'key_pub_dh', true );
    log( "Downloaded Alice's key" );
    var k = yield importKeyPubDH( k );
    log( "Imported Alice's key" );
    var k = yield ecdh_aesDeriveKey( k, bob.key_priv_dh );
    log( 'Derived shared key' );
    var bob_dir = makeUniqueId( bob.teams );
    var step2_priv = JSON.stringify( { dir: bob_dir, id: step1.id } );
    var step2_priv = yield aes_cbc_ecdsa.encryptThenSignSalted(
        k, bob.key_signing, encode( step2_priv ), scp )
    log( 'Encrypted and signed step2' );
    yield uploadFile(
        scp, bob.cloud_text, [ 'Invites', step2_id, 'step2' ], step2_priv, false );
    log( 'Uploaded step2' );
    var step2_pub = JSON.stringify( { cloud: bob.cloud_text, id: step2_id } );
    return step2_pub;
} );

/* alice adds bob to the team */
var inviteStep3 = async( 'InviteStep3', function *( scp, log, alice, step2_pub )
{
    /* typeof( alice )     == UWS user object */
    /* typeof( step2_pub ) == string (serialized invitation acceptance) */
    var bob = {};
    var step2 = JSON.parse( step2_pub );
    yield inviteStep3A( scp, alice, bob, step2 );
    var step1_priv = yield inviteStep3B( scp, alice, bob );
    return inviteStep3C( scp, alice, bob, step1_priv );
} );

/* alice downlods and decrypts information about bob.
 * Results stored in the bob object.  */
var inviteStep3A = async( 'A', function *( scp, log, alice, bob, step2_pub )
{
    /* typeof( alice )     == UWS user object */
    /* typeof( bob )       == empty object */
    /* typeof( step2_pub ) == step 2 invite object */
    function downloadBob( [ p, t ] ) { return downloadFile( scp, step2_pub.cloud, p, t ) };
    bob.id = step2_pub.id;
    var files = [ [ 'key_pub_dh', true ],
                  [ 'key_verify', true ],
                  [ [ 'Invites', bob.id, 'step2' ] ]];
    var step2_enc;
    [ bob.key_pub_dh_exported, bob.key_verify_exported, step2_enc ] =
        yield P.all( files.map( downloadBob ) );
    log( 'Downloaded keys and invite from Bob' );
    [ bob.key_pub_dh, bob.key_verify ] =
        yield P.all( [ importKeyPubDH( bob.key_pub_dh_exported ),
                       importKeyVerify( bob.key_verify_exported ) ] );
    log( 'Imported Bob\'s keys' );
    bob.sym_AB = yield ecdh_aesDeriveKey( bob.key_pub_dh, alice.key_priv_dh );
    log( 'Derived shared key' );
    var step2_priv = JSON.parse( decode( yield aes_cbc_ecdsa.verifyThenDecryptSalted(
        bob.sym_AB, bob.key_verify, step2_enc, scp ) ) );
    log( 'Decrypted step2', step2_priv );
    bob.id  = step2_priv.id;
    bob.dir = step2_priv.dir;
} );

/* alice downloads and decrypts her own step 1 info */
var inviteStep3B = async( 'B', function *( scp, log, alice, bob )
{
    /* typeof( alice ) == UWS user object */
    /* typeof( bob )   == object with invitation info */
    var step1_priv = yield downloadFile(
        scp, alice.cloud_text, [ 'Invites', bob.id, 'step1' ], null )
    log( 'Downloaded step1' );
    var step1_priv = yield aes_cbc_ecdsa.verifyThenDecryptSalted(
        alice.key_self, alice.key_verify, step1_priv, scp );
    step1_priv = JSON.parse( decode( step1_priv ) );
    log( 'Decrypted step1', step1_priv );
    return step1_priv;
} );

/* alice adds bob to the team */
var inviteStep3C = async( 'C', function *( scp, log, alice, bob, step1_priv )
{
    /* typeof( alice )      == UWS user object */
    /* typeof( bob )        == object with bob's invitation info */
    /* typeof( step1_priv ) == object with alice's invitation info */
    function upload( [ p, c, t ] ) { return uploadFile( scp, alice.cloud_text, p, c, t ) };
    var team = alice.teams[ step1_priv.team ];
    if( !team )
    {
        log( 'Got invitation response.  Mystery team in step1.',
             step1_priv.team, alice.teams );
        return P.reject( 'Invitation add failed' );
    }
    bob.team_uid = makeUniqueId( team.teammates );
    var step3_priv = JSON.stringify( { t: team.dir,
                                       u: bob.team_uid,
                                       d: team.key_priv_dh_exported,
                                       s: team.key_signing_exported,
                                       i: bob.id } );
    var bob_ent = DB.new_entity( team.db );
    var bob_datom_frags = [
        [ 'id', bob.team_uid ],
        [ 'cloud_text', bob.cloud_text ],
        [ 'key_verify_exported', bob.key_verify_exported ],
        [ 'dir', ] ];
    var bob_datoms = bob_datom_frags.map( function( [ a, v ] ) {
        return DB.build_datom( bob_ent, 'teammate:'+a, v ); } );
    DB.apply_txn( team.db, DB.build_txn( [], bob_datoms ) );
    function encrypt( k, d )
    { return aes_cbc_ecdsa.encryptThenSignSalted( k, alice.key_signing, encode( d ) ); }
    var step3_enc = yield encrypt( bob.sym_AB,    step3_priv );
    var db        = yield encrypt( team.key_self, JSON.stringify( team.db ) );
    var files = [ [ [ 'Invites', bob.id, 'step3' ], step3_enc ],
                  [ [ 'Teams', team.dir, 'Data', 'data' ], db ] ];
    function upload( [ p, c ] ) { return uploadFile( scp, alice.cloud_text, p, c, null ) };
    return P.all( files.map( upload ) );
} );

/*
 * Bob should run this after Alice has uploaded step3.  How does Bob
 * know when this happened?  Not sure.  One idea is to monitor the file
 * with long-polling/notifications.
 */
var inviteStep4 = async( 'InviteStep4', function *( scp, log, bob, step1_pub_text )
{
    function downloadAlice( [ p, t ] )
    { return downloadFile( scp, step1_pub.cloud, p, t ); }
    var step1_pub = JSON.parse( step1_pub_text );
    var alice = { cloud_text: step1_pub.cloud };
    var team = {};
    [ alice.key_pub_dh_exported, alice.key_verify_exported ] =
        yield P.all( [ downloadAlice( [ 'key_pub_dh', true ] ),
                       downloadAlice( [ 'key_verify', true ] ) ] );
    log( 'Downloaded Alice\'s keys' );
    alice.key_pub_dh = yield importKeyPubDH( alice.key_pub_dh_exported, scp );
    alice.key_verify = yield importKeyVerify( alice.key_verify_exported, scp );
    log( 'Imported Alice\'s keys' );
    var step3_enc;
    [ alice.sym_AB, step3_enc ] =
        yield P.all( [ ecdh_aesDeriveKey( alice.key_pub_dh, bob.key_priv_dh ),
                       downloadAlice( [ [ 'Invites', step1_pub.id, 'step3' ] ] ) ] );
    log( 'Derived shared key and downloaded step3' );
    var step3_priv = JSON.parse( decode(
        yield aes_cbc_ecdsa.verifyThenDecryptSalted(
            alice.sym_AB, alice.key_verify, step3_enc, scp ) ) );
    log( 'Decrypted step3' );
    alice.team_dir = step3_priv.t;
    alice.id = step3_priv.i;
    team.self_id = step3_priv.u;
    team.key_priv_dh_exported = step3_priv.d;
    team.key_signing_exported = step3_priv.s;
    bob.teams[ alice.team_dir ] = team;
    var downloadTeam = downloadFromTeam( alice.cloud_text, alice.team_dir, scp );
    var files = [ [ [ 'Data', 'data' ] ],
                  [ [ 'key_verify' ], true ],
                  [ [ 'key_pub_dh' ], true ] ];
    var key_verify_exported, key_dh_exported;
    [ team.db_enc, key_verify_exported, key_dh_exported, team.key_priv_dh, team.key_signing ] =
        yield P.all( files.map( downloadTeam )
                     .concat( [ importKeyPrivDH( team.key_priv_dh_exported, scp ),
                                importKeySign( team.key_signing_exported, scp ) ] ) );
    log( 'Downloaded team files' );
    team.key_verify = yield importKeyVerify( key_verify_exported, scp );
    team.key_pub_dh = yield importKeyPubDH( key_dh_exported, scp )
    team.key_self = yield ecdh_aesDeriveKey( team.key_pub_dh, team.key_priv_dh );
} );
