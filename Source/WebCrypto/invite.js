/*
 * Invitation process:
 * 1) Alice makes an invitation
 *    - Saves the following for later in the protocol (encrypted with her secret key):
 *      - Team ID
 *      - Something about the identity of Bob
 *    - Sends to Bob (publicly):
 *      - A link to her cloud
 *      - The (random) ID of the invitation (for Bob to send back later)
 * 2) Bob accepts the invitation
 *    - Saves Alice's invitation ID (encrypted with a shared key)
 *    - Sends to Alice (publicly):
 *      - A link to his cloud
 *      - The (random) ID of the file where he saved her ID
 * 3) Alice adds Bob to the team
 *    A) Alice downloads Bob's keys and the file he encrypted
 *    B) Alice downloads the information she saved in step 1
 *    C) Alice adds Bob
 *      - Invents a new tuid for Bob in that team
 *      - Updates the team database
 *    D) Alice saves the team ID and Bob's tuid, encrypted with a shared key
 * 4) Bob joins the team
 *    - Copy the state of the team from Alice
 */

function inviteStep1( bob, team_id, alice, log_ctx )
{
    log_ctx = log_ctx.push( 'InviteStep1' );
    var step1_id  = makeUniqueId( alice.invites );
    var step1_priv = JSON.stringify( { bob: bob, team: team_id } );
    log( log_ctx, 'E', alice.key_main, alice.key_signing );
    return aes_cbc_ecdsa.encrypt_then_sign_salted(
        alice.key_main, alice.key_signing, encode( step1_priv ), log_ctx )
    .then( function( step1_priv ) {
        log( log_ctx, 'Encrypted step1_priv' );
        function upload( [ d, n, t ] )
        { return uploadFile( alice.cloud_text, [ 'Invites', step1_id, n ], d, t ); }
        fs = [ [ step1_priv, 'step1' ], [ '', 'step3', 'text/plain' ] ];
        return P.all( fs.map( upload ) );
    } ).then( function() {
        log( log_ctx, 'Uploaded step1_priv and dummy step3' );
        var step1_pub = JSON.stringify( { cloud: alice.cloud_text, step1_id: step1_id } );
        return P.resolve( step1_pub );
    } );
}

function inviteStep2( step1_pub_text, bob, log_ctx )
{
    log_ctx = log_ctx.push( 'InviteStep2' );
    var step1_pub = JSON.parse( step1_pub_text );
    var step2_id = makeUniqueId( bob.invites );
    return downloadFile( step1_pub.cloud, 'key_encrypt', true )
    .then( function( k ) {
        log( log_ctx, 'Downloaded Alice\'s key' );
        return importKeyEncrypt( k );
    } ).then( function( k ) {
        log( log_ctx, 'Imported Alice\'s key' );
        return ecdh_aesDeriveKey( k, bob.key_decrypt );
    } ).then( function( k ) {
        log( log_ctx, 'Derived shared key' );
        var bob_dir = makeUniqueId( bob.teams );
        var step2_priv = JSON.stringify( { d: bob_dir, i: step1_pub.step1_id } );
        return aes_cbc_ecdsa.encrypt_then_sign_salted(
            k, bob.key_signing, encode( step2_priv ), log_ctx )
    } ).then( function( step2_priv ) {
        log( log_ctx, 'Encrypted and signed step2' );
        return uploadFile( bob.cloud_text, [ 'Invites', step2_id, 'step2' ], step2_priv );
    } ).then( function() {
        log( log_ctx, 'Uploaded step2' );
        var step2_pub = JSON.stringify( { cloud: bob.cloud_text, step2_id: step2_id } );
        return P.resolve( step2_pub );
    } );
}

function inviteStep3A( step2_pub, alice, bob, log_ctx )
{
    log_ctx = log_ctx.push( 'A' );
    function downloadBob( [ p, t ] ) { return downloadFile( step2_pub.cloud, p, t ) };
    bob.step2_id = step2_pub.step2_id;
    var files = [ [ 'key_encrypt', true ],
                  [ 'key_verify', true ] ];
    return P.all( files.map( downloadBob ) )
    .then( function( keys ) {
        log( log_ctx, 'Downloaded keys from Bob' );
        bob.key_encrypt_exported = keys[ 0 ];
        bob.key_verify_exported = keys[ 1 ];
        return P.all( [ importKeyEncrypt( bob.key_encrypt_exported ),
                        importKeyVerify( bob.key_verify_exported ) ] );
    } ).then( function( keys ) {
        log( log_ctx, 'Imported Bob\'s keys' );
        bob.key_encrypt = keys[ 0 ];
        bob.key_verify = keys[ 1 ];
        return P.all( [ ecdh_aesDeriveKey( bob.key_encrypt, alice.key_decrypt ),
                        downloadBob( [ [ 'Invites', bob.step2_id, 'step2' ] ] ) ] );
    } ).then( function( [ k, step2_enc ] ) {
        log( log_ctx, 'Derived shared key' );
        bob.sym_AB = k;
        return aes_cbc_ecdsa.verify_then_decrypt_salted(
            bob.sym_AB, bob.key_verify, step2_enc, log_ctx )
    } ).then( function( step2_priv ) {
        step2_priv = JSON.parse( decode( step2_priv ) );
        log( log_ctx, 'Decrypted step2', step2_priv );
        bob.step1_id = step2_priv.i;
        bob.dir = step2_priv.d;
        return P.resolve();
    } );
}

function inviteStep3B( alice, bob, log_ctx )
{
    log_ctx = log_ctx.push( 'B' );
    return downloadFile( alice.cloud_text, [ 'Invites', bob.step1_id, 'step1' ] )
    .then( function( step1_priv ) {
        log( log_ctx, 'Downloaded step1' );
        return aes_cbc_ecdsa.verify_then_decrypt_salted(
            alice.key_main, alice.key_verify, step1_priv, log_ctx )
    } ).then( function( step1_priv ) {
        step1_priv = JSON.parse( decode( step1_priv ) );
        log( log_ctx, 'Decrypted step1', step1_priv );
        return P.resolve( step1_priv );
    } );
}

function inviteStep3C( step1_priv, alice, bob, log_ctx )
{
    log_ctx = log_ctx.push( 'C' );
    function upload( [ p, c, t ] ) { return uploadFile( alice.cloud_text, p, c, t ) };
    var team = alice.teams[ step1_priv.team ];
    if( !team )
    {
        log( log_ctx, 'Got invitation response.  Mystery team in step1.',
             step1_priv.team, alice.teams );
        return P.reject( 'Invitation add failed' );
    }
    return P.resolve()
    .then( function() {
        bob.team_uid = makeUniqueId( team.teammates );
        var step3_priv = JSON.stringify( { t: team.dir,
                                           u: bob.team_uid,
                                           d: team.key_decrypt_exported,
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
        function upload( [ p, c ] ) { return uploadFile( alice.cloud_text, p, c ) };
        return P.all( files.map( upload ) );
    } );
}

function inviteStep3( step2_pub_text, alice, log_ctx )
{
    /* assert( step2_pub_text is valid ) */
    /* assert( alice is valid ) */
    log_ctx = log_ctx.push( 'InviteStep3' );
    var bob = {};
    var step2_pub = JSON.parse( step2_pub_text );
    return inviteStep3A( step2_pub, alice, bob, log_ctx )
    .then( function() {
        return inviteStep3B( alice, bob, log_ctx );
    } ).then( function( step1_priv ) {
        return inviteStep3C( step1_priv, alice, bob, log_ctx );
    } );
}

/*
 * Bob should run this after Alice has uploaded step3.  How does Bob
 * know when this happened?  Not sure.  One idea is to monitor the file
 * with long-polling/notifications.
 */
function inviteStep4( step1_pub_text, bob, log_ctx )
{
    log_ctx = log_ctx.push( 'InviteStep4' );
    function downloadAlice( [ p, t ] )
    { return downloadFile( step1_pub.cloud, p, t ); }
    function downloadBob( [ p, t ] )
    { return downloadFile( user.cloud_text, p, t ); }
    var step1_pub = JSON.parse( step1_pub_text );
    var alice = { cloud_text: step1_pub.cloud };
    var team = {};
    return P.all( [ downloadAlice( [ 'key_encrypt', true ] ),
                    downloadAlice( [ 'key_verify', true ] ) ] )
    .then( function( keys ) {
        log( log_ctx, 'Downloaded Alice\'s keys' );
        alice.key_encrypt_exported = keys[0];
        alice.key_verify_exported = keys[1];
        return P.all( [ importKeyEncrypt( alice.key_encrypt_exported ),
                        importKeyVerify( alice.key_verify_exported ) ] );
    } ).then( function( keys ) {
        log( log_ctx, 'Imported Alice\'s keys' );
        alice.key_encrypt = keys[ 0 ];
        alice.key_verify = keys[ 1 ];
        return P.all( [ ecdh_aesDeriveKey( alice.key_encrypt, bob.key_decrypt ),
                        downloadAlice( [ [ 'Invites', step1_pub.step1_id, 'step3' ] ] ) ] );
    } ).then( function( [ k, step3_enc ] ) {
        log( log_ctx, 'Derived shared key and downloaded step3' );
        alice.sym_AB = k;
        return aes_cbc_ecdsa.verify_then_decrypt_salted(
            alice.sym_AB, alice.key_verify, step3_enc, log_ctx )
    } ).then( function( step3_priv_buf ) {
        log( log_ctx, 'Decrypted step3' );
        var step3_priv = JSON.parse( decode( step3_priv_buf ) );
        alice.team_dir = step3_priv.t;
        alice.step2_id = step3_priv.i;
        team.self_id = step3_priv.u;
        team.key_decrypt_exported = step3_priv.d;
        team.key_signing_exported = step3_priv.s;
        bob.teams[ alice.team_dir ] = team;
        var downloadTeam = downloadFromTeam( alice.cloud_text, alice.team_dir );
        var files = [ [ [ 'Data', 'data' ] ],
                      [ [ 'key_verify' ], true ],
                      [ [ 'key_encrypt' ], true ] ];
        return P.all( files.map( downloadTeam )
                      .concat( [ importKeyDecrypt( team.key_decrypt_exported ),
                                 importKeySign( team.key_signing_exported ) ] ) );
    } ).then( function( files ) {
        log( log_ctx, 'Downloaded team files' );
        team.db_enc = files[ 0 ];
        team.key_decrypt = files[ 3 ];
        team.key_signing = files[ 4 ];
        return P.all( [ importKeyVerify( files[ 1 ] ),
                        importKeyEncrypt( files[ 2 ] ) ] );
    } ).then( function( keys ) {
        team.key_encrypt = keys[ 1 ];
        team.key_verify = keys[ 0 ];
        return ecdh_aesDeriveKey( alice.key_encrypt, bob.key_decrypt );
    } ).then( function( k ) {
        team.key_main = k;
    } );
}
