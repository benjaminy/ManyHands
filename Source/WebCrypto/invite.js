/*
 * Current invitation process:
 * 1) A sends cloud link to B
 * 2) B makes a placeholder Team folder,
 *    finds A's public key,
 *    sends cloud link and Team ID to A, all encrypted and signed
 * 3) A makes
 */

function makeInvite( invite_user, team_id, alice )
{
    var invite_id   = makeUniqueId( alice.invites );
    var invite_salt = getRandomBytes( 16 );
    var step1_priv  = JSON.stringify( { bob: invite_user, team: team_id } );
    var ip = encrypt_and_sign_ac_ed(
        alice.main_key, alice.signing_pair.privateKey, encode( step1_priv ), invite_salt );
    var sp = encrypt_and_sign_ac_ed(
        alice.main_key, alice.signing_pair.privateKey, invite_salt, bad_salt );
    return P.all( [ ip, sp ] )
    .then( function( [ step1_priv, salt ] ) {
        log( '[Invite] Encrypted and signed' );
        function uploadHelper( [ d, n, t ] )
        { return uploadFile( alice.cloud_text, [ 'Invites', invite_id, n ], d, t ); }

        f = [ [ step1_priv, 'step1' ], [ salt, 'salt' ], [ '', 'step3', 'text/plain' ] ];
        return P.all( f.map( uploadHelper ) );
    } ).then( function( _ ) {
        log( '[Invite] Uploaded' );
        var step1_pub = JSON.stringify( { cloud: alice.cloud_text, invite_id: invite_id } );
        return P.resolve( step1_pub );
    } );
}

function inviteAccept( step1_pub_text, bob )
{
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
            bob.encrypt_pair.privateKey,
            sym_enc_algo, true, [ 'encrypt', 'decrypt' ] );
    } ).then( function( k ) {
        log( '[InviteAccept] Derived shared key' );
        var salt_step2 = getRandomBytes( 16 );
        var team_id = makeUniqueId( bob.teams );
        var step2_priv = JSON.stringify( { team: team_id, invite_id: step1_pub.invite_id } );
        var ip = encrypt_and_sign_ac_ed(
            k, bob.signing_pair.privateKey, encode( step2_priv ), salt_step2 );
        var sp = encrypt_and_sign_ac_ed(
            k, bob.signing_pair.privateKey, salt_step2, bad_salt );
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

function inviteGetResponseFromBob( step2_pub, alice )
{
    function downloadBob( [ p, t ] ) { return downloadFile( step2_pub.cloud, p, t ) };
    var step2_priv, salt, verify_exported, verify;
    var files = [ [ 'key_encrypt', true ],
                  [ 'key_verify', true ],
                  [ [ 'Invites', step2_pub.invite_id, 'step2' ] ],
                  [ [ 'Invites', step2_pub.invite_id, 'salt' ] ] ];
    return P.all( files.map( downloadBob ) )
    .then( function( [ encrypt, v, s2, s ] ) {
        log( '[InviteAdd] Downloaded files from Bob' );
        step2_priv = s2;
        salt = s;
        verify_exported = v
        return P.all( [ importKeyEncrypt( encrypt ), importKeyVerify( v ) ] );
    } ).then( function( [ encrypt, v ] ) {
        log( '[InviteAdd] Imported Bob\'s keys' );
        verify = v;
        return C.deriveKey(
            { name: 'ECDH', namedCurve: 'P-521', public: encrypt },
            alice.encrypt_pair.privateKey,
            sym_enc_algo, true, [ 'encrypt', 'decrypt' ] );
    } ).then( function( sym_AB ) {
        log( '[InviteAdd] Derived shared key' );
        var sp = verify_and_decrypt_ac_ed( sym_AB, verify, salt, bad_salt );
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

function inviteGetOriginalInvite( step2_priv, sym_AB, alice )
{
    function downloadA( [ p, t ] ) { return downloadFile( alice.cloud_text, p, t ) };
    var downs = [ downloadA( [ [ 'Invites', step2_priv.invite_id, 'salt' ] ] ),
                  downloadA( [ [ 'Invites', step2_priv.invite_id, 'step1' ] ] ) ];
    return P.all( downs )
        .then( function( [ salt_step1, step1_priv ] ) {
        log( '[InviteAdd] Downloaded step1' );
        var sp = verify_and_decrypt_ac_ed(
            alice.main_key, alice.signing_pair.publicKey, salt_step1, bad_salt );
        return p_all_resolve( [ sp ], [ step1_priv ] );
    } ).then( function( [ salt_step1, step1_priv ] ) {
        log( '[InviteAdd] Decrypted salt', salt_step1.byteLength, step1_priv.byteLength );
        var ip = verify_and_decrypt_ac_ed(
            alice.main_key, alice.signing_pair.publicKey, step1_priv, salt_step1 );
        return p_all_resolve( [ ip ], [ salt_step1 ] );
    } ).then( function( [ step1_priv, salt_step1 ] ) {
        step1_priv = JSON.parse( decode( step1_priv ) );
        log( '[InviteAdd] Decrypted step1', alice, step1_priv );
        return P.resolve( [ step1_priv, salt_step1 ] );
    } );
}

function inviteUpdateTeamAndStep3(
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
    return C.exportKey( 'jwk', team.main_key )
    .then( function( team_key_exported ) {
        var step3 = JSON.stringify( { t: team.id, u: bob_id } );
        var salt_bob_copy = getRandomBytes( 16 );
        function encrypt( [ d, s ] )
        { encrypt_and_sign_ac_ed( sym_AB, alice.signing_pair.privateKey, d, s ); }
        var to_encrypt = [ [ encode( step3 ), salt_step1 ],
                           [ encode( JSON.stringify( team_key_exported ) ), salt_bob_copy ],
                           [ salt_bob_copy, bad_salt ] ];
        var bob_dir = scramble_id( bob_id, bad_salt );
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
            team.main_key, alice.signing_pair.privateKey, encode( team_db ), bad_salt );
    } ).then( function( [ step1, salt_step1, step2, sym_AB, verify_B ] ) {

        function upload( [ p, c, t ] ) { return uploadFile( alice.cloud_text, p, c, t ) };
    } );
}

function inviteAddToTeam( step2_pub_text, alice )
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

function inviteJoinTeam( invite, user )
{
    
}
