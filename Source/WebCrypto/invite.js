/*
 * Invitation process:
 * 1) Alice makes an invitation
 *    - Saves the following for herself later in the protocol:
 *      - Team ID
 *      - Something about the identity of Bob
 *    - Sends to Bob:
 *      - A link to her cloud
 *      - The (random) ID of the invitation (for Bob to send back later)
 * 2) Bob accepts the invitation
 *    - Saves Alice's invitation ID, encrypted with a shared key
 *    - Sends to Alice:
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
    log_ctx = log_ctx.push( 'Step1' );
    var invite_id   = makeUniqueId( alice.invites );
    var invite_salt = getRandomBytes( 16 );
    var step1_priv  = JSON.stringify( { bob: invite_user, team: team_id } );
    function encrypt( [ d, s ] )
    { encrypt_and_sign_ac_ed( alice.main_key, alice.verify_key, d, s ); }
    var to_ecrypt = [ [ encode( step1_priv ), invite_salt ], [ invite_salt, zeros ] ];
    return P.all( to_encrypt.map( encrypt ) )
    .then( function( [ step1_priv, salt ] ) {
        log( log_ctx, 'Encrypted step1_priv and salt' );
        function upload( [ d, n, t ] )
        { return uploadFile( alice.cloud_text, [ 'Invites', invite_id, n ], d, t ); }
        fs = [ [ step1_priv, 'step1' ], [ salt, 'salt' ], [ '', 'step3', 'text/plain' ] ];
        return P.all( fs.map( upload ) );
    } ).then( function() {
        log( log_ctx, 'Uploaded step1_priv, salt and dummy step3' );
        var step1_pub = JSON.stringify( { cloud: alice.cloud_text, invite_id: invite_id } );
        return P.resolve( step1_pub );
    } );
}

function inviteStep2( step1_pub_text, bob )
{
    log_ctx = log_ctx.push( 'Step2' );
    var step1_pub = JSON.parse( step1_pub_text );
    var invite_id = makeUniqueId( bob.invites );
    return downloadFile( step1_pub.cloud, 'key_encrypt', true )
    .then( function( k ) {
        log( '[InviteAccept] Downloaded Alice\'s key' );
        return importKeyEncrypt( k );
    } ).then( function( k ) {
        log( '[InviteAccept] Imported Alice\'s key' );
        return C.deriveKey(
            { name: 'ECDH', namedCurve: 'P-521', public: k },
            bob.decrypt_key,
            sym_enc_algo, true, [ 'encrypt', 'decrypt' ] );
    } ).then( function( k ) {
        log( '[InviteAccept] Derived shared key' );
        var salt_step2 = getRandomBytes( 16 );
        var team_id = makeUniqueId( bob.teams );
        var step2_priv = JSON.stringify( { team: team_id, invite_id: step1_pub.invite_id } );
        var ip = encrypt_and_sign_ac_ed(
            k, bob.verify_key, encode( step2_priv ), salt_step2 );
        var sp = encrypt_and_sign_ac_ed(
            k, bob.verify_key, salt_step2, zeros );
        return P.all( [ ip, sp ] )
    } ).then( function( [ step2_priv, s ] ) {
        log( '[InviteAccept] Encrypted and signed step2' );
        function upload( [ d, n, t ] )
        { return uploadFile( bob.cloud_text, [ 'Invites', invite_id, n ], d, t ); }
        return P.all( [ [ step2_priv, 'step2' ], [ s, 'salt' ] ].map( upload ) );
    } ).then( function( _ ) {
        log( '[InviteAccept] Uploaded step2' );
        var step2_pub = JSON.stringify( { cloud: bob.cloud_text, invite_id: invite_id } );
        return P.resolve( step2_pub );
    } ).catch( function( err ) {
        return unhandledError( 'invite accept', err )
    } );
}

function inviteStep3A( step2_pub, alice )
{
    function downloadBob( [ p, t ] ) { return downloadFile( step2_pub.cloud, p, t ) };
    var step2_priv, salt, verify_exported, verify;
    var files = [ [ 'key_encrypt', true ],
                  [ 'key_verify', true ],
                  [ [ 'Invites', step2_pub.invite_id, 'step2' ] ],
                  [ [ 'Invites', step2_pub.invite_id, 'salt' ] ] ];
    return P.all( files.map( downloadBob ) )
    .then( function( [ bob_encrypt, v, s2, s ] ) {
        log( '[InviteAdd] Downloaded files from Bob' );
        step2_priv = s2;
        salt = s;
        verify_exported = v
        return P.all( [ importKeyEncrypt( bob_encrypt ), importKeyVerify( v ) ] );
    } ).then( function( [ bob_encrypt, v ] ) {
        log( '[InviteAdd] Imported Bob\'s keys' );
        verify = v;
        return C.deriveKey(
            { name: 'ECDH', namedCurve: 'P-521', public: bob_encrypt },
            alice.decrypt_key,
            sym_enc_algo, true, [ 'encrypt', 'decrypt' ] );
    } ).then( function( sym_AB ) {
        log( '[InviteAdd] Derived shared key' );
        var sp = verify_and_decrypt_ac_ed( sym_AB, verify, salt, zeros );
        return p_all_resolve( [ sp ], [ sym_AB ] );
    } ).then( function( [ salt, sym_AB ] ) {
        log( '[InviteAdd] Decrypted Bob\'s salt' );
        var ip = verify_and_decrypt_ac_ed( sym_AB, verify, step2_priv, salt );
        return p_all_resolve( [ ip ], [ sym_AB ] );
    } ).then( function( [ step2_priv, sym_AB, verify ] ) {
        log( '[InviteAdd] Decrypted step2', decode( step2_priv ) );
        return P.resolve( [ sym_AB, JSON.parse( decode( step2_priv ) ) ] );
    } );
}

function inviteStep3B( step2_priv, sym_AB, alice )
{
    function downloadA( [ p, t ] ) { return downloadFile( alice.cloud_text, p, t ) };
    var downs = [ downloadA( [ [ 'Invites', step2_priv.invite_id, 'salt' ] ] ),
                  downloadA( [ [ 'Invites', step2_priv.invite_id, 'step1' ] ] ) ];
    return P.all( downs )
        .then( function( [ salt_step1, step1_priv ] ) {
        log( '[InviteAdd] Downloaded step1' );
        var sp = verify_and_decrypt_ac_ed(
            alice.main_key, alice.verify_key, salt_step1, zeros );
        return p_all_resolve( [ sp ], [ step1_priv ] );
    } ).then( function( [ salt_step1, step1_priv ] ) {
        log( '[InviteAdd] Decrypted salt', salt_step1.byteLength, step1_priv.byteLength );
        var ip = verify_and_decrypt_ac_ed(
            alice.main_key, alice.verify_key, step1_priv, salt_step1 );
        return p_all_resolve( [ ip ], [ salt_step1 ] );
    } ).then( function( [ step1_priv, salt_step1 ] ) {
        step1_priv = JSON.parse( decode( step1_priv ) );
        log( '[InviteAdd] Decrypted step1', alice, step1_priv );
        return P.resolve( [ step1_priv, salt_step1 ] );
    } );
}

function inviteStep3C(
    step1_priv, salt_step1, sym_AB, bob_cloud, bob_verify, alice )
{
    function upload( [ p, c, t ] ) { return uploadFile( alice.cloud_text, p, c, t ) };
    var team = alice.teams[ step1_priv.team ];
    if( !team )
    {
        log( 'Got invitation response.  Mystery team in step1.', step1_priv.team, alice.teams );
        return P.reject( 'Invitation add failed' );
    }
    var bob_id = makeUniqueId( team.data.teammates );
    return C.resolve()
    .then( function() {
        var step3 = JSON.stringify( { t: team.id, u: bob_id } );
        var salt_bob_copy = getRandomBytes( 16 );
        function encrypt( [ d, s ] )
        { encrypt_and_sign_ac_ed( sym_AB, alice.signing_key, d, s ); }
        var to_encrypt = [ [ encode( step3 ), salt_step1 ],
                           [ encode( JSON.stringify( team.main_key_exported ) ), salt_bob_copy ],
                           [ salt_bob_copy, zeros ] ];
        var bob_dir = scramble_id( bob_id, zeros );
        return P.all( to_encrypt.map( encrypt ).concat( bob_dir ) );
    } ).then( function( [ step3, bob_copy, salt_bob_copy, bob_dir ] ) {
        var fs = [ [ [ 'Invites', step1_priv.invite_id, 'step3' ], step3 ],
                   [ [ 'Teams', team.dir, 'Teammates', bob_dir, 'key' ], bob_copy ],
                   [ [ 'Teams', team.dir, 'Teammates', bob_dir, 'salt' ], salt_bob_copy ] ];
        return P.all( fs );
    } ).then( function( ) {

        team.data.teammates[ bob_id ] =
            { uid: bob_id, cloud: bob_cloud, key: bob_verify };
        var team_db = JSON.stringify( { name: step1.team, teammates: team.data.teammates } );
        var team_dbp = encrypt_and_sign_ac_ed(
            team.main_key, alice.signing_key, encode( team_db ), zeros );
    } ).then( function( [ step1, salt_step1, step2, sym_AB, verify_B ] ) {

        function upload( [ p, c, t ] ) { return uploadFile( alice.cloud_text, p, c, t ) };
    } );
}

function inviteStep3( step2_pub_text, alice )
{
    /* assert( step2_pub_text is valid ) */
    /* assert( alice is valid ) */
    var sym_AB;
    var step2_pub = JSON.parse( step2_pub_text );
    return inviteGetResponseFromBob( step2_pub, alice )
    .then( function( [ s, step2 ] ) {
        sym_AB = s;
        return inviteGetOriginalInvite( step2, sym_AB, alice );
    } ).then( function( [ step1_priv, salt_step1 ] ) {
        return inviteUpdateTeamAndStep3( step1_priv, salt_step1, sym_AB, alice );
    } ).catch( function( err ) {
        return unhandledError( 'invite complete', err );
    } );
}

function inviteStep4( invite, user )
{
    
}
