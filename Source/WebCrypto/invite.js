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

function inviteStep1( bob, team_id, alice, scp )
{
    var [ scp, log ] = Scope.enter( scp, 'InviteStep1' );
    var step1_id  = makeUniqueId( alice.invites );
    var step1_priv = JSON.stringify( { bob: bob, team: team_id } );
    return aes_cbc_ecdsa.encrypt_then_sign_salted(
        alice.key_main, alice.key_signing, encode( step1_priv ), scp )
    .then( function( step1_priv ) {
        log( 'Encrypted step1_priv' );
        function upload( [ d, n, t ] )
        { return uploadFile( alice.cloud_text, [ 'Invites', step1_id, n ], d, t, scp ); }
        fs = [ [ step1_priv, 'step1' ], [ '', 'step3', 'text/plain' ] ];
        return P.all( fs.map( upload ) );
    } ).then( function() {
        log( 'Uploaded step1_priv and dummy step3' );
        var step1_pub = JSON.stringify( { cloud: alice.cloud_text, step1_id: step1_id } );
        return P.resolve( step1_pub );
    } );
}

function inviteStep2( step1_pub_text, bob, scp )
{
    var [ scp, log ] = Scope.enter( scp, 'InviteStep2' );
    var step1_pub = JSON.parse( step1_pub_text );
    var step2_id = makeUniqueId( bob.invites );
    return downloadFile( step1_pub.cloud, 'key_pub_dh', true, scp )
    .then( function( k ) {
        log( 'Downloaded Alice\'s key' );
        return importKeyPubDH( k );
    } ).then( function( k ) {
        log( 'Imported Alice\'s key' );
        return ecdh_aesDeriveKey( k, bob.key_priv_dh );
    } ).then( function( k ) {
        log( 'Derived shared key' );
        var bob_dir = makeUniqueId( bob.teams );
        var step2_priv = JSON.stringify( { d: bob_dir, i: step1_pub.step1_id } );
        return aes_cbc_ecdsa.encrypt_then_sign_salted(
            k, bob.key_signing, encode( step2_priv ), scp )
    } ).then( function( step2_priv ) {
        log( 'Encrypted and signed step2' );
        return uploadFile(
            bob.cloud_text, [ 'Invites', step2_id, 'step2' ], step2_priv, false, scp );
    } ).then( function() {
        log( 'Uploaded step2' );
        var step2_pub = JSON.stringify( { cloud: bob.cloud_text, step2_id: step2_id } );
        return P.resolve( step2_pub );
    } );
}

function inviteStep3( step2_pub_text, alice, scp )
{
    /* assert( step2_pub_text is valid ) */
    /* assert( alice is valid ) */
    var [ scp, log ] = Scope.enter( scp, 'InviteStep3' );
    var bob = {};
    var step2_pub = JSON.parse( step2_pub_text );
    return inviteStep3A( step2_pub, alice, bob, scp )
    .then( function() {
        return inviteStep3B( alice, bob, scp );
    } ).then( function( step1_priv ) {
        return inviteStep3C( step1_priv, alice, bob, scp );
    } );
}

function inviteStep3A( step2_pub, alice, bob, scp )
{
    var [ scp, log ] = Scope.enter( scp, 'A' );
    function downloadBob( [ p, t ] ) { return downloadFile( step2_pub.cloud, p, t, scp ) };
    bob.step2_id = step2_pub.step2_id;
    var files = [ [ 'key_pub_dh', true ],
                  [ 'key_verify', true ] ];
    return P.all( files.map( downloadBob ) )
    .then( function( keys ) {
        log( 'Downloaded keys from Bob' );
        bob.key_pub_dh_exported = keys[ 0 ];
        bob.key_verify_exported = keys[ 1 ];
        return P.all( [ importKeyPubDH( bob.key_pub_dh_exported ),
                        importKeyVerify( bob.key_verify_exported ) ] );
    } ).then( function( keys ) {
        log( 'Imported Bob\'s keys' );
        bob.key_pub_dh = keys[ 0 ];
        bob.key_verify = keys[ 1 ];
        return P.all( [ ecdh_aesDeriveKey( bob.key_pub_dh, alice.key_priv_dh ),
                        downloadBob( [ [ 'Invites', bob.step2_id, 'step2' ] ] ) ] );
    } ).then( function( [ k, step2_enc ] ) {
        log( 'Derived shared key' );
        bob.sym_AB = k;
        return aes_cbc_ecdsa.verify_then_decrypt_salted(
            bob.sym_AB, bob.key_verify, step2_enc, scp )
    } ).then( function( step2_priv ) {
        step2_priv = JSON.parse( decode( step2_priv ) );
        log( 'Decrypted step2', step2_priv );
        bob.step1_id = step2_priv.i;
        bob.dir = step2_priv.d;
        return P.resolve();
    } );
}

function inviteStep3B( alice, bob, scp )
{
    var [ scp, log ] = Scope.enter( scp, 'B' );
    return downloadFile( alice.cloud_text, [ 'Invites', bob.step1_id, 'step1' ], null, scp )
    .then( function( step1_priv ) {
        log( 'Downloaded step1' );
        return aes_cbc_ecdsa.verify_then_decrypt_salted(
            alice.key_main, alice.key_verify, step1_priv, scp )
    } ).then( function( step1_priv ) {
        step1_priv = JSON.parse( decode( step1_priv ) );
        log( 'Decrypted step1', step1_priv );
        return P.resolve( step1_priv );
    } );
}

function inviteStep3C( step1_priv, alice, bob, scp )
{
    var [ scp, log ] = Scope.enter( scp, 'C' );
    function upload( [ p, c, t ] ) { return uploadFile( alice.cloud_text, p, c, t, scp ) };
    var team = alice.teams[ step1_priv.team ];
    if( !team )
    {
        log( 'Got invitation response.  Mystery team in step1.',
             step1_priv.team, alice.teams );
        return P.reject( 'Invitation add failed' );
    }
    return P.resolve()
    .then( function() {
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
        function encrypt( [ k, d ] )
        { return aes_cbc_ecdsa.encrypt_then_sign_salted( k, alice.key_signing, d ); }
        var to_encrypt = [ [ bob.sym_AB, encode( step3_priv ) ],
                           [ team.key_main, encode( JSON.stringify( team.db ) ) ] ];
        return P.all( to_encrypt.map( encrypt ) );
    } ).then( function( [ step3_enc, db ] ) {
        var files = [ [ [ 'Invites', bob.step1_id, 'step3' ], step3_enc ],
                      [ [ 'Teams', team.dir, 'Data', 'data' ], db ] ];
        function upload( [ p, c ] ) { return uploadFile( alice.cloud_text, p, c, null, scp ) };
        return P.all( files.map( upload ) );
    } );
}

/*
 * Bob should run this after Alice has uploaded step3.  How does Bob
 * know when this happened?  Not sure.  One idea is to monitor the file
 * with long-polling/notifications.
 */
function inviteStep4( step1_pub_text, bob, scp )
{
    var [ scp, log ] = Scope.enter( scp, 'InviteStep4' );
    function downloadAlice( [ p, t ] )
    { return downloadFile( step1_pub.cloud, p, t, scp ); }
    var step1_pub = JSON.parse( step1_pub_text );
    var alice = { cloud_text: step1_pub.cloud };
    var team = {};
    return P.all( [ downloadAlice( [ 'key_pub_dh', true ] ),
                    downloadAlice( [ 'key_verify', true ] ) ] )
    .then( function( keys ) {
        log( 'Downloaded Alice\'s keys' );
        alice.key_pub_dh_exported = keys[0];
        alice.key_verify_exported = keys[1];
        return P.all( [ importKeyPubDH( alice.key_pub_dh_exported, scp ),
                        importKeyVerify( alice.key_verify_exported, scp ) ] );
    } ).then( function( keys ) {
        log( 'Imported Alice\'s keys' );
        alice.key_pub_dh = keys[ 0 ];
        alice.key_verify = keys[ 1 ];
        return P.all( [ ecdh_aesDeriveKey( alice.key_pub_dh, bob.key_priv_dh ),
                        downloadAlice( [ [ 'Invites', step1_pub.step1_id, 'step3' ] ] ) ] );
    } ).then( function( [ k, step3_enc ] ) {
        log( 'Derived shared key and downloaded step3' );
        alice.sym_AB = k;
        return aes_cbc_ecdsa.verify_then_decrypt_salted(
            alice.sym_AB, alice.key_verify, step3_enc, scp )
    } ).then( function( step3_priv_buf ) {
        log( 'Decrypted step3' );
        var step3_priv = JSON.parse( decode( step3_priv_buf ) );
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
        return P.all( files.map( downloadTeam )
                      .concat( [ importKeyPrivDH( team.key_priv_dh_exported, scp ),
                                 importKeySign( team.key_signing_exported, scp ) ] ) );
    } ).then( function( files ) {
        log( 'Downloaded team files' );
        team.db_enc = files[ 0 ];
        team.key_priv_dh = files[ 3 ];
        team.key_signing = files[ 4 ];
        return P.all( [ importKeyVerify( files[ 1 ], scp ),
                        importKeyPubDH( files[ 2 ], scp ) ] );
    } ).then( function( keys ) {
        team.key_pub_dh = keys[ 1 ];
        team.key_verify = keys[ 0 ];
        return ecdh_aesDeriveKey( team.key_pub_dh, team.key_priv_dh );
    } ).then( function( k ) {
        team.key_main = k;
    } );
}
