/*
 * Invitation process:
 * 1) Alice makes an invitation
 *    - Saves the following for herself in step 3
 *        (encrypted with her secret key):
 *      - Team ID
 *      - Something about the identity of Bob
 *    - Sends to Bob (unencrypted):
 *      - A link to her cloud
 *      - The (random) ID of the invitation (for Bob to send back later)
 * 2) Bob accepts the invitation
 *    - Saves the following for Alice in step 3
 *       (encrypted with a shared key)
 *      - Alice's invitation ID
 *      - Bob's (randomly generated) team directory
 *    - Sends to Alice (unencrypted):
 *      - A link to his cloud
 *      - The (random) ID of the file where he saved the info above
 * 3) Alice adds Bob to the team
 *    A) Downloads Bob's keys and the file he encrypted
 *    B) Downloads the information she saved in step 1
 *    C) Adds Bob
 *      - Invents a new uid for Bob in that team
 *      - Updates the team database
 *    D) Saves the following for Bob in step 4
 *         (encrypted with a shared key)
 *      - The team directory in Alice's cloud
 *      - Bob's uid
 *      - The team signing and decryption keys
 *      - The ID of Bob's file from step 2
 * 4) Bob joins the team
 *    - Copy the state of the team from Alice
 */

var inviteStep1 = async( 'InviteStep1', function *( scp, log, bob, team_id, alice )
{
    var step1_id  = makeUniqueId( alice.invites );
    var step1_priv = yield aes_cbc_ecdsa.encrypt_then_sign_salted(
        alice.key_main, alice.key_signing,
        encode( JSON.stringify( { bob: bob, team: team_id } ) ), scp )
    log( 'Encrypted step1_priv' );
    function upload( [ d, n, t ] )
    { return uploadFile( alice.cloud_text, [ 'Invites', step1_id, n ], d, t, scp ); }
    fs = [ [ step1_priv, 'step1' ], [ '', 'step3', 'text/plain' ] ];
    yield P.all( fs.map( upload ) );
    log( 'Uploaded step1_priv and dummy step3' );
    var step1_pub = JSON.stringify( { cloud: alice.cloud_text, step1_id: step1_id } );
    return step1_pub;
} );

var inviteStep2 = async( 'InviteStep2', function *( scp, log, step1_pub_text, bob )
{
    var step1_pub = JSON.parse( step1_pub_text );
    var step2_id = makeUniqueId( bob.invites );
    var k = yield downloadFile( step1_pub.cloud, 'key_pub_dh', true, scp );
    log( 'Downloaded Alice\'s key' );
    var k = yield importKeyPubDH( k );
    log( 'Imported Alice\'s key' );
    var k = yield ecdh_aesDeriveKey( k, bob.key_priv_dh );
    log( 'Derived shared key' );
    var bob_dir = makeUniqueId( bob.teams );
    var step2_priv = JSON.stringify( { d: bob_dir, i: step1_pub.step1_id } );
    var step2_priv = yield aes_cbc_ecdsa.encrypt_then_sign_salted(
        k, bob.key_signing, encode( step2_priv ), scp )
    log( 'Encrypted and signed step2' );
    yield uploadFile(
        bob.cloud_text, [ 'Invites', step2_id, 'step2' ], step2_priv, false, scp );
    log( 'Uploaded step2' );
    var step2_pub = JSON.stringify( { cloud: bob.cloud_text, step2_id: step2_id } );
    return step2_pub;
} );

var inviteStep3 = async( 'InviteStep3', function *( scp, log, step2_pub_text, alice )
{
    /* assert( step2_pub_text is valid ) */
    /* assert( alice is valid ) */
    var bob = {};
    var step2_pub = JSON.parse( step2_pub_text );
                     yield inviteStep3A( scp, step2_pub, alice, bob );
    var step1_priv = yield inviteStep3B( scp, alice, bob );
    return                 inviteStep3C( scp, step1_priv, alice, bob );
} );

var inviteStep3A = async( 'A', function *( scp, log, step2_pub, alice, bob )
{
    function downloadBob( [ p, t ] ) { return downloadFile( step2_pub.cloud, p, t, scp ) };
    bob.step2_id = step2_pub.step2_id;
    var files = [ [ 'key_pub_dh', true ],
                  [ 'key_verify', true ],
                  [ [ 'Invites', bob.step2_id, 'step2' ] ]];
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
    var step2_priv = JSON.parse( decode( yield aes_cbc_ecdsa.verify_then_decrypt_salted(
        bob.sym_AB, bob.key_verify, step2_enc, scp ) ) );
    log( 'Decrypted step2', step2_priv );
    bob.step1_id = step2_priv.i;
    bob.dir = step2_priv.d;
} );

var inviteStep3B = async( 'B', function *( scp, log, alice, bob )
{
    var step1_priv = yield downloadFile(
        alice.cloud_text, [ 'Invites', bob.step1_id, 'step1' ], null, scp )
    log( 'Downloaded step1' );
    var step1_priv = yield aes_cbc_ecdsa.verify_then_decrypt_salted(
        alice.key_main, alice.key_verify, step1_priv, scp );
    step1_priv = JSON.parse( decode( step1_priv ) );
    log( 'Decrypted step1', step1_priv );
    return step1_priv;
} );

var inviteStep3C = async( 'C', function *( scp, log, step1_priv, alice, bob )
{
    function upload( [ p, c, t ] ) { return uploadFile( alice.cloud_text, p, c, t, scp ) };
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
                                       i: bob.step2_id } );
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
    { return aes_cbc_ecdsa.encrypt_then_sign_salted( k, alice.key_signing, encode( d ) ); }
    var step3_enc = yield encrypt( bob.sym_AB,    step3_priv );
    var db        = yield encrypt( team.key_main, JSON.stringify( team.db ) );
    var files = [ [ [ 'Invites', bob.step1_id, 'step3' ], step3_enc ],
                  [ [ 'Teams', team.dir, 'Data', 'data' ], db ] ];
    function upload( [ p, c ] ) { return uploadFile( alice.cloud_text, p, c, null, scp ) };
    return P.all( files.map( upload ) );
} );

/*
 * Bob should run this after Alice has uploaded step3.  How does Bob
 * know when this happened?  Not sure.  One idea is to monitor the file
 * with long-polling/notifications.
 */
var inviteStep4 = async( 'InviteStep4', function *( scp, log, step1_pub_text, bob )
{
    function downloadAlice( [ p, t ] )
    { return downloadFile( step1_pub.cloud, p, t, scp ); }
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
                       downloadAlice( [ [ 'Invites', step1_pub.step1_id, 'step3' ] ] ) ] );
    log( 'Derived shared key and downloaded step3' );
    var step3_priv = JSON.parse( decode(
        yield aes_cbc_ecdsa.verify_then_decrypt_salted(
            alice.sym_AB, alice.key_verify, step3_enc, scp ) ) );
    log( 'Decrypted step3' );
    alice.team_dir = step3_priv.t;
    alice.step2_id = step3_priv.i;
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
    team.key_main = yield ecdh_aesDeriveKey( team.key_pub_dh, team.key_priv_dh );
} );
