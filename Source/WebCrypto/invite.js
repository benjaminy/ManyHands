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

function inviteStep1( invite_user, team_id, alice, log_ctx )
{
    log_ctx = log_ctx.push( 'InviteStep1' );
    var invite_id  = makeUniqueId( alice.invites );
    var step1_priv = JSON.stringify( { bob: invite_user, team: team_id } );
    log( log_ctx, 'E', alice.key_main, alice.key_signing );
    return aes_cbc_ecdsa.encrypt_then_sign_salted(
        alice.key_main, alice.key_signing, encode( step1_priv ), log_ctx )
    .then( function( step1_priv ) {
        log( log_ctx, 'Encrypted step1_priv' );
        function upload( [ d, n, t ] )
        { return uploadFile( alice.cloud_text, [ 'Invites', invite_id, n ], d, t ); }
        fs = [ [ step1_priv, 'step1' ], [ '', 'step3', 'text/plain' ] ];
        return P.all( fs.map( upload ) );
    } ).then( function() {
        log( log_ctx, 'Uploaded step1_priv and dummy step3' );
        var step1_pub = JSON.stringify( { cloud: alice.cloud_text, invite_id: invite_id } );
        return P.resolve( step1_pub );
    } );
}

function inviteStep2( step1_pub_text, bob, log_ctx )
{
    log_ctx = log_ctx.push( 'InviteStep2' );
    var step1_pub = JSON.parse( step1_pub_text );
    var invite_id = makeUniqueId( bob.invites );
    return downloadFile( step1_pub.cloud, 'key_encrypt', true )
    .then( function( k ) {
        log( log_ctx, 'Downloaded Alice\'s key' );
        return importKeyEncrypt( k );
    } ).then( function( k ) {
        log( log_ctx, 'Imported Alice\'s key' );
        return ecdh_aesDeriveKey( k, bob.key_decrypt );
    } ).then( function( k ) {
        log( log_ctx, 'Derived shared key' );
        var team_id = makeUniqueId( bob.teams );
        var step2_priv = JSON.stringify( { team: team_id, invite_id: step1_pub.invite_id } );
        return aes_cbc_ecdsa.encrypt_then_sign_salted(
            k, bob.key_signing, encode( step2_priv ), log_ctx )
    } ).then( function( step2_priv ) {
        log( log_ctx, 'Encrypted and signed step2' );
        return uploadFile( bob.cloud_text, [ 'Invites', invite_id, 'step2' ], step2_priv );
    } ).then( function() {
        log( log_ctx, 'Uploaded step2' );
        var step2_pub = JSON.stringify( { cloud: bob.cloud_text, invite_id: invite_id } );
        return P.resolve( step2_pub );
    } );
}

function inviteStep3A( step2_pub, alice, bob, log_ctx )
{
    log_ctx = log_ctx.push( 'A' );
    function downloadBob( [ p, t ] ) { return downloadFile( step2_pub.cloud, p, t ) };
    var step2_priv;
    var files = [ [ 'key_encrypt', true ],
                  [ 'key_verify', true ],
                  [ [ 'Invites', step2_pub.invite_id, 'step2' ] ] ];
    return P.all( files.map( downloadBob ) )
    .then( function( [ bob_encrypt, v, s2 ] ) {
        log( log_ctx, 'Downloaded files from Bob' );
        step2_priv = s2;
        bob.key_verify_exported = v
        return P.all( [ importKeyEncrypt( bob_encrypt ), importKeyVerify( v ) ] );
    } ).then( function( [ bob_encrypt, v ] ) {
        log( log_ctx, 'Imported Bob\'s keys' );
        bob.key_verify = v;
        return ecdh_aesDeriveKey( bob_encrypt, alice.key_decrypt );
    } ).then( function( k ) {
        log( log_ctx, 'Derived shared key' );
        bob.sym_AB = k;
        return aes_cbc_ecdsa.verify_then_decrypt_salted(
            bob.sym_AB, bob.key_verify, step2_priv, log_ctx )
    } ).then( function( step2_priv ) {
        log( log_ctx, 'Decrypted step2', decode( step2_priv ) );
        return P.resolve( JSON.parse( decode( step2_priv ) ) );
    } );
}

function inviteStep3B( step2_priv, alice, bob, log_ctx )
{
    log_ctx = log_ctx.push( 'B' );
    return downloadFile( alice.cloud_text, [ 'Invites', step2_priv.invite_id, 'step1' ] )
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
    var bob_id = makeUniqueId( team.data.teammates );
    return C.resolve()
    .then( function() {
        var step3 = JSON.stringify( { t: team.id, u: bob_id } );
        function encrypt( d )
        { encrypt_and_sign_ac_ed( sym_AB, alice.key_signing, d ); }
        var to_encrypt = [ encode( step3 ),
                           encode( JSON.stringify( team.key_main_exported ) ) ];
        return P.all( to_encrypt.map( encrypt ).concat( bob_dir ) );
    } ).then( function( [ step3, bob_copy ] ) {
        var fs = [ [ [ 'Invites', step1_priv.invite_id, 'step3' ], step3 ],
                   [ [ 'Teams', team.dir, 'Teammates', bob_dir, 'key' ], bob_copy ] ];
        return P.all( fs );
    } ).then( function( ) {

        team.data.teammates[ bob_id ] =
            { uid: bob_id, cloud: bob_cloud, key: bob_verify };
        var team_db = JSON.stringify( { name: step1.team, teammates: team.data.teammates } );
        var team_dbp = encrypt_and_sign_ac_ed(
            team.key_main, alice.key_signing, encode( team_db ), zeros );
    } ).then( function( [ step1, step2, sym_AB, verify_B ] ) {

        function upload( [ p, c, t ] ) { return uploadFile( alice.cloud_text, p, c, t ) };
    } );
}

function inviteStep3( step2_pub_text, alice, log_ctx )
{
    /* assert( step2_pub_text is valid ) */
    /* assert( alice is valid ) */
    log_ctx = log_ctx.push( 'InviteStep3' );
    var bob = {};
    var sym_AB;
    var step2_pub = JSON.parse( step2_pub_text );
    return inviteStep3A( step2_pub, alice, bob, log_ctx )
    .then( function( step2 ) {
        return inviteStep3B( step2, alice, bob, log_ctx );
    } ).then( function( step1_priv ) {
        return inviteStep3C( step1_priv, alice, bob, log_ctx );
    } );
}

function inviteStep4( invite, user )
{
    
}
